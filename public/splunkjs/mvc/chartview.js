
define('util/jscharting_utils',['underscore', 'helpers/user_agent', 'splunk.util'], function(_, userAgent, splunkUtils) {

    var normalizePointLimit = function(limitValue) {
        return parseInt(limitValue, 10) || Infinity;
    };

    var VISIBLE_FIELD_REGEX = /^[^_]|^_time/,
        MAX_SERIES = 50,
        MAX_POINTS = (function() {
            var crossBrowserLimit = splunkUtils.getConfigValue('JSCHART_TRUNCATION_LIMIT', 20000);
            if(crossBrowserLimit !== null) {
                return normalizePointLimit(crossBrowserLimit);
            }

            if(userAgent.isFirefox()) {
                return normalizePointLimit(splunkUtils.getConfigValue('JSCHART_TRUNCATION_LIMIT_FIREFOX', 20000));
            }
            if(userAgent.isSafari()) {
                return normalizePointLimit(splunkUtils.getConfigValue('JSCHART_TRUNCATION_LIMIT_SAFARI', 20000));
            }
            if(userAgent.isIE11()) {
                return normalizePointLimit(splunkUtils.getConfigValue('JSCHART_TRUNCATION_LIMIT_IE11', 20000));
            }
            if(userAgent.isIE10()) {
                return normalizePointLimit(splunkUtils.getConfigValue('JSCHART_TRUNCATION_LIMIT_IE10', 20000));
            }
            if(userAgent.isIE9()) {
                return normalizePointLimit(splunkUtils.getConfigValue('JSCHART_TRUNCATION_LIMIT_IE9', 20000));
            }
            if(userAgent.isIE8()) {
                return normalizePointLimit(splunkUtils.getConfigValue('JSCHART_TRUNCATION_LIMIT_IE8', 2000));
            }
            if(userAgent.isIE7()) {
                return normalizePointLimit(splunkUtils.getConfigValue('JSCHART_TRUNCATION_LIMIT_IE7', 2000));
            }
            // if the user agent didn't match any of the above, treat it as Chrome
            return normalizePointLimit(splunkUtils.getConfigValue('JSCHART_TRUNCATION_LIMIT_CHROME', 20000));
        }());

    // sort of a "catch-all" method for adding display properties based on the data set and the web.conf config
    // this method is used by consumers of the JSCharting library to share custom logic that doesn't belong
    // in the library itself
    var getCustomDisplayProperties = function(chartData, webConfig) {
        webConfig = webConfig || {};
        var customProps = {};
        if(webConfig['JSCHART_TEST_MODE']) {
            customProps.testMode = true;
        }

        if(chartData.hasField('_tc')) {
            customProps.fieldHideList = ['percent'];
        }
        return customProps;
    };

    var sliceResultsToSeriesLength = function(rawData, length) {
        var sliced = {
            fields: rawData.fields,
            columns: []
        };

        _(rawData.columns).each(function(column, i) {
            sliced.columns[i] = column.slice(0, length);
        });

        return sliced;
    };

    var fieldIsVisible = function(field) {
        var fieldName = _.isString(field) ? field : field.name;
        return VISIBLE_FIELD_REGEX.test(fieldName);
    };

    // pre-process chart data, truncating either the number of series or the number of points per series
    // default truncation constants are defined above, though a custom limit for total number of points can be
    // passed in as part of the display properties
    var preprocessChartData = function(rawData, displayProperties) {
        if(rawData.columns.length === 0 || rawData.columns[0].length === 0) {
            return rawData;
        }
        var chartType = displayProperties.chart || 'column';
        if(chartType in { pie: true, scatter: true, radialGauge: true, fillerGauge: true, markerGauge: true }) {
            return rawData;
        }

        if(rawData.fields.length >= MAX_SERIES) {
            var spanColumn,
                normalizedFields = _(rawData.fields).map(function(field) {
                    return _.isString(field) ? field : field.name;
                }),
                spanIndex = _(normalizedFields).indexOf('_span');

            if(spanIndex > -1 && spanIndex >= MAX_SERIES) {
                spanColumn = rawData.columns[spanIndex];
            }

            // slice the number of series
            rawData = {
                columns: rawData.columns.slice(0, MAX_SERIES),
                fields: rawData.fields.slice(0, MAX_SERIES)
            };

            // if our slicing removed _span, put it back
            if(spanColumn) {
                rawData.columns.push(spanColumn);
                rawData.fields.push('_span');
            }
        }

        var perChartLimit = parseInt(displayProperties['chart.resultTruncationLimit'], 10) || parseInt(displayProperties['resultTruncationLimit'], 10),
            truncationLimit = perChartLimit > 0 ? perChartLimit : MAX_POINTS,
            visibleFields = _(rawData.fields).filter(fieldIsVisible),
            numDataSeries = visibleFields.length - 1, // subtract one because the first field is the x-axis
            pointsPerSeries = rawData.columns[0].length,
            // numSeries is guaranteed not to be zero based on the first check in this method
            allowedPointsPerSeries =  Math.floor(truncationLimit / numDataSeries);

        if(pointsPerSeries > allowedPointsPerSeries) {
            return sliceResultsToSeriesLength(rawData, allowedPointsPerSeries);
        }
        return rawData;
    };

    return ({

        getCustomDisplayProperties: getCustomDisplayProperties,
        preprocessChartData: preprocessChartData

    });
});

requirejs.s.contexts._.nextTick = function(f){f()}; require(['css'], function(css) { css.addBuffer('splunkjs/css/jschart.css'); }); requirejs.s.contexts._.nextTick = requirejs.nextTick;
define('splunkjs/mvc/chartview',['require','exports','module','underscore','jquery','./mvc','./basesplunkview','./messages','./drilldown','./utils','util/console','splunk.util','splunk.legend','util/jscharting_utils','splunk.config','jquery.ui.resizable','util/general_utils','./tokenawaremodel','uri/route','helpers/Printer','css!../css/jschart'],function(require, exports, module) {
    var _ = require('underscore');
    var $ = require('jquery');
    var mvc = require("./mvc");
    var BaseSplunkView = require("./basesplunkview");
    var Messages = require("./messages");
    var Drilldown = require('./drilldown');
    var utils = require('./utils');
    var console = require('util/console');
    var SplunkUtil = require('splunk.util');
    var SplunkLegend = require('splunk.legend');
    var jschartingUtils = require('util/jscharting_utils');
    var splunkConfig = require('splunk.config');
    var resizable = require('jquery.ui.resizable');
    var JSCharting;
    var GeneralUtils = require('util/general_utils');
    var TokenAwareModel = require('./tokenawaremodel');
    var Route = require('uri/route');
    var Printer = require('helpers/Printer');
    
    require('css!../css/jschart');

    var ChartView = BaseSplunkView.extend({
        moduleId: module.id,

        className: "splunk-chart",
        chartOptionPrefix: 'charting.',

        options: {
            'height': '250px',
            'data': 'preview',
            'type': 'column',
            'drilldownRedirect': true,
            'charting.drilldown': 'all',
            'resizable': false
        },

        omitFromSettings: ['el', 'reportModel', 'drilldown'],

        normalizeOptions: function(settings, options) {
            this._normalizeDrilldownType(settings, options[options.hasOwnProperty('charting.drilldown') ? 'charting.drilldown' : 'drilldown']);

            if (options.hasOwnProperty("charting.layout.splitSeries")) {
                if(GeneralUtils.isBooleanEquivalent(options["charting.layout.splitSeries"])) {
                    settings.set("charting.layout.splitSeries", GeneralUtils.normalizeBoolean(options["charting.layout.splitSeries"]) ? "1" : "0");
                }
                else {
                    settings.set("charting.layout.splitSeries", options["charting.layout.splitSeries"]);
                }
            }

            if (options.hasOwnProperty("show")) {
                settings.set("show", SplunkUtil.normalizeBoolean(options.show) ? "1" : "0");
            }

            if (options.hasOwnProperty("charting.axisY2.enabled")) {
                if(GeneralUtils.isBooleanEquivalent(options["charting.axisY2.enabled"])) {
                    settings.set("charting.axisY2.enabled", GeneralUtils.normalizeBoolean(options["charting.axisY2.enabled"]) ? "1" : "0");
                }
                else {
                    settings.set("charting.axisY2.enabled", options["charting.axisY2.enabled"]);
                }
            }

            if (options.hasOwnProperty("charting.legend.labelStyle.overflowMode")) {
                if (options["charting.legend.labelStyle.overflowMode"] === "default") {
                    settings.set("charting.legend.labelStyle.overflowMode", "ellipsisMiddle");
                } else {
                    settings.set("charting.legend.labelStyle.overflowMode", options["charting.legend.labelStyle.overflowMode"]);
                }
            }
        },

        _normalizeDrilldownType: function(settings, value) {
            settings.set('charting.drilldown', Drilldown.getNormalizedDrilldownType(value, { allowBoolean: true }));
        },

        initialize: function(options) {
            this.configure();
            this.model = this.options.reportModel || TokenAwareModel._createReportModel();
            this.settings._sync = utils.syncModels(this.settings, this.model, {
                auto: true,
                prefix: 'display.visualizations.',
                exclude: ['managerid','id','name','data', 'type', 'drilldownRedirect', 'height']
            });

            this.normalizeOptions(this.settings, options);
            this.settings.on('change:drilldown change:charting.drilldown', this._normalizeDrilldownType, this);

            // set our maxResultCount to the current value 'charting.chart.data', or default to 1000
            this.maxResultCount = 1000;
            if(this.settings.has('charting.data.count') && !_.isNaN(parseInt(this.settings.get('charting.data.count'), 10))) {
                this.maxResultCount = parseInt(this.settings.get('charting.data.count'), 10);
            }

            this._currentHeight = parseInt(this.settings.get('height'), 10);

            // initialize containers as detached DOM
            this.$chart = $('<div></div>');
            this.$msg = $('<div></div>');
            this.$inlineMsg = $('<div></div>');

            this.settings.on("change", this.render, this);
            var self = this;
            require(['js_charting/js_charting'], function(JSChartingLib){
                JSCharting = JSChartingLib;
                // Only create the chart if there is a pending create AND we
                // have data. For example, if we were just rendered but have not
                // received any data, no reason to create us just yet.
                if (self._chartCreationPending && self.chartData) {
                    self._createChart();
                }
                self.createChart = self._createChart;
            });

            this.bindToComponentSetting('managerid', this._onManagerChange, this);
            SplunkLegend.register(this.cid);

            // Setup resizing
            this._onResizeMouseup = _.bind(this._onResizeMouseup, this);
            this.settings.on('change:resizable', function(model, value, options) {
                value ? this._enableResize() : this._disableResize();
            }, this);
            if (this.settings.get('resizable')) {
                this._enableResize();
            }

            // Height Handler
            this.settings.on('change:height', this._onChartHeightChange, this);

            this.listenTo(Printer, Printer.PRINT_START, this.resizeChart);
            this.listenTo(Printer, Printer.PRINT_END, this.resizeChart);

            // If we don't have a manager by this point, then we're going to
            // kick the manager change machinery so that it does whatever is
            // necessary when no manager is present.
            if (!this.manager) {
                this._onManagerChange(mvc.Components, null);
            }
        },

        _onManagerChange: function(managers, manager) {
            if (this.manager) {
                this.manager.off(null, null, this);
                this.manager = null;
            }
            if (this.resultsModel) {
                this.resultsModel.off(null, null, this);
                this.resultsModel = null;
            }

            if (!manager) {
                this.message("no-search");
                return;
            }

            // Clear any messages, since we have a new manager.
            this.message("empty");

            this._err = false;
            this.manager = manager;
            this.resultsModel = this.manager.data(this.settings.get("data"), {
                autofetch: true,
                output_mode: "json_cols",
                show_metadata: true,
                count: this.maxResultCount
            });
            this.resultsModel.on("data", this._onDataChanged, this);
            this.resultsModel.on("error", this._onSearchError, this);
            manager.on("search:start", this._onSearchStart, this);
            manager.on("search:progress", this._onSearchProgress, this);
            manager.on("search:done", this._onSearchProgress, this);
            manager.on("search:cancelled", this._onSearchCancelled, this);
            manager.on("search:refresh", this._onSearchRefresh, this);
            manager.on("search:fail", this._onSearchFailed, this);
            manager.on("search:error", this._onSearchError, this);
            manager.replayLastSearchEvent(this);
        },

        _onDataChanged: function() {
            if (!this.resultsModel.hasData()) {
                if (this._isJobDone) {
                    this.message('no-results');
                }
                return;
            }

            var chartData = this.resultsModel.data();
            console.log('chart data changed:', chartData);

            if (chartData.fields.length) {
                this.chartData = chartData;
                this.updateChart();
            }
        },

        _onSearchProgress: function(properties) {
            this._err = false;
            properties = properties || {};
            var content = properties.content || {};
            var previewCount = content.resultPreviewCount || 0;
            var isJobDone = this._isJobDone = content.isDone || false;

            if (previewCount === 0 && isJobDone) {
                this.message('no-results');
                return;
            }

            if (previewCount === 0) {
                this.message('waiting');
            }

        },

        _onSearchCancelled: function() {
            this._isJobDone = false;
            this.message('cancelled');
        },

        _onSearchRefresh: function() {
            this._isJobDone = false;
            this.message('refresh');
        },

        _onSearchError: function(message, err) {
            this._isJobDone = false;
            this._err = true;
            var msg = Messages.getSearchErrorMessage(err) || message;
            this.message({
                level: "error",
                icon: "warning-sign",
                message: msg
            });
        },

        _onSearchFailed: function(state) {
            this._isJobDone = false;
            this._err = true;
            var msg = Messages.getSearchFailureMessage(state);
            this.message({
                level: "error",
                icon: "warning-sign",
                message: msg
            });
        },

        _onSearchStart: function() {
            this._isJobDone = false;
            this._err = false;
            this.destroyChart();
            this.message('waiting');
        },

        message: function(info) {
            this.$msg.detach();
            Messages.render(info, this.$msg);
            this.$msg.prependTo(this.$el);
        },

        inlineMessage: function(info) {
            info.compact = true;
            Messages.render(info, this.$inlineMsg);
        },

        render: function() {
            this.$el.height(this._currentHeight).css('overflow', 'hidden');
            this.$msg.height(this._currentHeight).css('overflow', 'hidden');
            this.$chart.appendTo(this.$el);
            this.$inlineMsg.appendTo(this.$el);
            if (this.chart) {
                this.destroyChart();
            }

            if(!this._boundInvalidateChart) {
                this._boundInvalidateChart = _.bind(this.invalidateChart, this);
            }
            SplunkLegend.removeEventListener('labelIndexMapChanged', this._boundInvalidateChart);
            SplunkLegend.addEventListener('labelIndexMapChanged', this._boundInvalidateChart);

            if(!this._debouncedResize) {
                this._debouncedResize = _.debounce(_.bind(this.resizeChart, this), 100);
            }
            $(window).off('resize', this._debouncedResize);
            $(window).on('resize', this._debouncedResize);

            this.createChart();

            return this;
        },

        show: function() {
            this.$el.css('display', '');
        },

        hide: function() {
            this.$el.css('display', 'none');
        },

        createChart: function() {
            this._chartCreationPending = true;
        },

        _enableResize: function() {
            if (this._canEnableResize()) {
                this.$el.resizable({autoHide: true, handles: "s", stop: this._onResizeStop.bind(this)});
                // workaround until jquery ui is updated
                this.$el.on('mouseup', this._onResizeMouseup);
            }
        },

        _disableResize: function() {
            if (this._canEnableResize()) {
                this.$el.resizable('destroy');
                this.$el.off('mouseup', this._onResizeMouseup);
            }
        },

        // NOTE: Bound to 'this' by constructor
        _onResizeMouseup: function(event) {
            $(this).width("100%");
        },

        _onResizeStop: function(event, ui) {
            $(event.target).width("100%");
            this._currentHeight = this.$el.height();
            this.settings.set('height', this._currentHeight);
            this.resizeChart();
        },

        _canEnableResize: function() {
            return true;
        },

        _createChart: function() {
            // Initialize the chart with the type if it is there. If somebody
            // actually specified charting.chart, that option will win.
            var displayProperties = {'chart': this.settings.get("type")};

            // Copy over the settings for everything that starts with the
            // prefix (charting.) by default.
            var prefix = this.chartOptionPrefix;
            _.each(this.settings.toJSON(), function(value, key){
                if(key.substring(0, prefix.length) == prefix) {
                    displayProperties[key.substring(prefix.length)] = value;
                }
            }, this);

            if(this._err) { return; }

            this.$msg.detach();
            console.log('Creating chart with data: ', displayProperties);
            var chart = this.chart = JSCharting.createChart(this.$chart, displayProperties);
            chart.on('pointClick', this.emitDrilldownEvent.bind(this));
            chart.on('legendClick', this.emitDrilldownEvent.bind(this));
            chart.on('chartRangeSelect', this.emitSelectionEvent.bind(this));
            this.updateChart();
        },

        _onChartHeightChange: function() {
            this._currentHeight = parseInt(this.settings.get('height'), 10);
            this.resizeChart();
        },

        resizeChart: function() {
            if(this.chart) {
                this.updateChartContainerHeight();
                this.chart.resize();
            }
        },

        updateChart: function() {
            if(this._err) { return; }
            console.log('updateChart data=%o this.chart=%o', this.chartData, this.chart);
            if (this.chartData) {
                if(this.chart) {
                    this.$msg.detach();
                    this.$inlineMsg.empty();
                    var processedChartData = jschartingUtils.preprocessChartData(this.chartData, this.chart.getCurrentDisplayProperties()),
                        chartReadyData = JSCharting.extractChartReadyData(processedChartData);

                    this.chart.prepare(
                        chartReadyData,
                        jschartingUtils.getCustomDisplayProperties(chartReadyData, splunkConfig)
                    );
                    // if the preprocessChartData method truncated the data, show a message to that effect
                    if(processedChartData.columns.length > 0 &&
                            (processedChartData.columns.length < this.chartData.columns.length ||
                                processedChartData.columns[0].length < this.chartData.columns[0].length)) {

                        var rawMessage = 'These results may be truncated. Your search generated too much data for' +
                                            ' the current visualization configuration.',
                            message = _(rawMessage).t(),
                            pageInfo = utils.getPageInfo(),
                            docsHref = Route.docHelp(pageInfo.root, pageInfo.locale, 'learnmore.charting.datatruncation'),
                            helpLink = ' <a href="<%- href %>" target="_blank">' +
                                            '<span><%- text %></span>' +
                                            '<i class="icon-external icon-no-underline"></i>' +
                                        '</a>';

                        message += _(helpLink).template({ href: docsHref, text: _('Learn More').t() });
                        this.inlineMessage({
                            level: 'warn',
                            message: message
                        });
                    }
                    // otherwise if the number of results matches the max result count that was used to fetch,
                    // show a message that we might not be displaying the full data set
                    else if(this.chartData.columns.length > 0 && this.maxResultCount > 0 &&
                            this.chartData.columns[0].length >= this.maxResultCount) {
                        this.inlineMessage({
                            level: 'warn',
                            message: SplunkUtil.sprintf(
                                _('These results may be truncated. This visualization is configured to display a maximum of %s results per series, and that limit has been reached.').t(),
                                this.maxResultCount
                            )
                        });
                    }
                    this.updateChartContainerHeight();
                    if(this.chart.requiresExternalColorPalette()) {
                        var fieldList = this.chart.getFieldList();
                        SplunkLegend.setLabels(this.cid, fieldList);
                    }
                    this.invalidateChart();
                } else {
                    this.createChart();
                }
            }
        },

        destroyChart: function() {
            if (this.chart) {
                this.chart.off();
                this.chart.destroy();
                this.chart = null;
                clearTimeout(this._redrawChartTimeout);
            }
        },

        updateChartContainerHeight: function() {
            this.$chart.height(this._currentHeight - this.$inlineMsg.outerHeight());
        },

        invalidateChart: function() {
            clearTimeout(this._redrawChartTimeout);
            if(!this.chart || !this.chartData) {
                return;
            }
            var self = this;
            this._redrawChartTimeout = setTimeout(function() {
                if(self.chart.requiresExternalColorPalette()) {
                    self.setChartColorPalette();
                }
                var startTime = new Date().getTime();
                self.chart.draw().done(function() {
                    if (console.DEBUG_ENABLED) {
                        console.log('Chart=%o drawn in duration=%o ms',
                                self.model.get('display.visualizations.charting.chart'), new Date().getTime() - startTime);
                    }
                    self.trigger('rendered', self);
                    self.model.set({
                        currentChartFields: self.chart.getFieldList()
                    });
                });
            }, 5);
        },

        setChartColorPalette: function() {
            var fieldIndexMap = {};
            _(this.chart.getFieldList()).each(function(field) {
                fieldIndexMap[field] = SplunkLegend.getLabelIndex(field);
            });
            this.chart.setExternalColorPalette(fieldIndexMap, SplunkLegend.numLabels());
        },

        emitDrilldownEvent: function(e) {
            var manager = this.manager;
            var drilldownType = Drilldown.getNormalizedDrilldownType(
                this.settings.get('charting.drilldown'), {allowBoolean: true});

            var payload = Drilldown.createEventPayload({
                field: e.name2 || e.name,
                data: Drilldown.normalizeDrilldownEventData(e, {
                    manager: manager,
                    contextProperty: 'rowContext'
                }),
                event: e
            }, function(){
                Drilldown.autoDrilldown(e, manager, {
                    drilldownType: (drilldownType === 'all') ? 'all' : 'none'
                });
            });
            
            this.trigger('drilldown click', payload, this);
            this.trigger(
                (e.type === "legendClick")
                    ? "clicked:legend click:legend"
                    : "clicked:chart click:chart",
                _.extend({}, e, {
                    preventDefault: payload.preventDefault,
                    drilldown: payload.drilldown
                }),
                this);

            if (drilldownType === 'all' && this.settings.get("drilldownRedirect") && !payload.defaultPrevented()) {
                payload.drilldown();
            }
        },

        emitSelectionEvent: function(e) {
            var data = {
                start: e.startXValue,
                end: e.endXValue
            };
            var results = this.resultsModel.data();
            _(results.fields).each(function(field, idx){
                data['start.' + field.name] = results.columns[idx][e.startXIndex];
                data['end.' + field.name] = results.columns[idx][e.endXIndex];
            });
            var eventObj = {
                data: data,
                preventDefault: function() {
                    e.preventDefault();
                },
                results: results,
                selection: function() {
                    var data = [];
                    for (var i = e.startXIndex; i <= e.endXIndex; i++) {
                        data.push(_(results.columns).pluck(i));
                    }
                    var fields = _(results.fields).pluck('name');
                    return _(data).map(function(d) { return _.object(fields, d); });
                },
                startIndex: e.startXIndex,
                endIndex: e.endXIndex,
                startValue: e.startXValue,
                endValue: e.endXValue,
                isReset: e.isReset,
                event: e
            };
            this.trigger('selection', eventObj, this);
        },

        remove: function() {
            SplunkLegend.unregister(this.cid);
            if(this._boundInvalidateChart) {
                SplunkLegend.removeEventListener('labelIndexMapChanged', this._boundInvalidateChart);
            }
            if(this._debouncedResize) {
                $(window).off('resize', this._debouncedResize);
            }
            if(this.chart) {
                this.destroyChart();
            }
            if(this.settings) {
                this.settings.off();
                if(this.settings._sync) {
                    this.settings._sync.destroy();
                }
            }
            BaseSplunkView.prototype.remove.call(this);
        }
    });

    return ChartView;
});

requirejs.s.contexts._.nextTick = function(f){f()}; require(['css'], function(css) { css.setBuffer('.clearfix{*zoom:1;}.clearfix:before,.clearfix:after{display:table;content:\"\";line-height:0;}\n.clearfix:after{clear:both;}\n.hide-text{font:0/0 a;color:transparent;text-shadow:none;background-color:transparent;border:0;}\n.input-block-level{display:block;width:100%;min-height:26px;-webkit-box-sizing:border-box;-moz-box-sizing:border-box;box-sizing:border-box;}\n.ie7-force-layout{*min-width:0;}\n.btn-pan-left,.btn-pan-right{background:#525252;background:rgba(0, 0, 0, 0.32);position:absolute;z-index:9999;padding:4px 5px;color:#FFFFFF;line-height:10px;-webkit-border-radius:1px;-moz-border-radius:1px;border-radius:1px;}.btn-pan-left:hover,.btn-pan-right:hover,.btn-pan-left.active,.btn-pan-right.active{background:#454545;background:rgba(0, 0, 0, 0.27);text-decoration:none;color:#FFFFFF;-webkit-border-radius:1px;-moz-border-radius:1px;border-radius:1px;}\n.btn-zoom-out,.btn-reset-selection{position:absolute;z-index:9999;}\n.btn-reset-selection{margin-top:5px;margin-right:10px;}\n'); }); requirejs.s.contexts._.nextTick = requirejs.nextTick; 
