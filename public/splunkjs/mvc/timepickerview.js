
define('views/shared/timerangepicker/dialog/Presets',[
    'jquery',
    'underscore',
    'backbone',
    'module',
    'views/Base',
    'util/time'
],
function(
    $,
    _,
    Backbone,
    module,
    Base,
    time_utils
){
    return Base.extend({
        moduleId: module.id,
        className: 'accordion-inner',
        /**
         * @param {Object} options {
         *     model: <models.TimeRange>,
         *     collection (Optional): <collections.services.data.ui.TimesV2>
         *     showRealTime (Optional): hide or show RealTime in the Presets panel.
         *     showRealTimeOnly (Optional): Only show RealTime in the Presets panel.
         *     showRelative (Optional): hide or show the Relative in the Presets panel.
         *     showAllTime (Optional): hide or show All Time in the Presets panel.
         * }
         */
        initialize: function() {
            this.label = _('Presets').t();

            var defaults = {
                showRealTime:true,
                showRealTimeOnly:false,
                showRelative:true, //currently partially supported. Some may slip through.
                showAllTime:true
            };

            _.defaults(this.options, defaults);

            Base.prototype.initialize.apply(this, arguments);
            
            this.activate();
        },
        startListening: function() {
            if (this.collection) {
                this.listenTo(this.collection, 'reset', this.render);
            }            
        },
        supportsRange: function() {
            var earliest = this.model.get('earliest'),
                latest = this.model.get('latest');

            return time_utils.generateAllTimeLabel(earliest, latest) || time_utils.findPresetLabel(this.collection, earliest, latest);
        },
        events: {
            'click a' : function(e) {
                e.preventDefault();
                var $target = $(e.currentTarget);
                this.model.save({
                    'earliest': $target.data('earliest'),
                    'latest': $target.data('latest')
                });
                this.model.trigger('applied');
            }
        },
        render: function() {
            var periodPresets = this.options.showRelative && !this.options.showRealTimeOnly ? this.collection.filterToPeriod() : false,
                hasPeriodPresets = periodPresets && periodPresets.length,
                lastPresets = this.options.showRelative && !this.options.showRealTimeOnly ? this.collection.filterToLast() : false,
                hasLastPresets = lastPresets && lastPresets.length;

            var template = _.template(this.template, {
                    _: _,
                    realTimePresets: this.options.showRealTime ? this.collection.filterToRealTime() : false,
                    periodPresets: periodPresets,
                    hasPeriodPresets: hasPeriodPresets,
                    lastPresets: lastPresets,
                    hasLastPresets: hasLastPresets,
                    otherPresets: !this.options.showRealTimeOnly ? this.collection.filterToOther() : false,
                    options: this.options,
                    isAllTime: this.isAllTime,
                    listElementPartial: this.listElementPartial
                });
            this.$el.html(template);
            return this;
        },
        isAllTime: function(model) {
            var noEarliest = !model.entry.content.get("earliest_time") || model.entry.content.get("earliest_time") == "0",
                noLatest =  !model.entry.content.get("latest_time") || model.entry.content.get("latest_time") == "now";

            return noEarliest && noLatest;
        },
        listElementPartial: _.template('\
            <li><a href="#" data-earliest="<%- model.entry.content.get("earliest_time") || "" %>" data-latest="<%- model.entry.content.get("latest_time") || "" %>"><%- _(model.entry.content.get("label")).t() %></a></li>\
        '),
        template: '\
            <% if (realTimePresets && realTimePresets.length) { %>\
                <ul class="unstyled presets-group">\
                    <li><%- _("Real-time").t() %></li>\
                    <% _.each(realTimePresets, function(model) { %>\
                        <%= listElementPartial({model: model}) %>\
                    <% }); %>\
                </ul>\
                <div class="presets-divider-wrap"><div class="presets-divider"></div></div>\
            <% } %>\
            <% if (hasPeriodPresets && hasLastPresets) { %>\
                    <ul class="unstyled presets-group">\
                        <li><%- _("Relative").t() %></li>\
                        <% _.each(periodPresets, function(model) { %>\
                            <%= listElementPartial({model: model}) %>\
                        <% }); %>\
                    </ul>\
                    <ul class="unstyled presets-group">\
                        <li>&nbsp;</li>\
                        <% _.each(lastPresets, function(model) { %>\
                             <%= listElementPartial({model: model}) %>\
                        <% }); %>\
                    </ul>\
                    <div class="presets-divider-wrap"><div class="presets-divider"></div></div>\
            <% } else if (hasPeriodPresets) { %>\
                <ul class="unstyled presets-group">\
                    <li><%- _("Relative").t() %></li>\
                    <% _.each(periodPresets, function(model) { %>\
                        <%= listElementPartial({model: model}) %>\
                    <% }); %>\
                </ul>\
                <div class="presets-divider-wrap"><div class="presets-divider"></div></div>\
            <% } else if (hasLastPresets) { %>\
                <ul class="unstyled presets-group">\
                    <li><%- _("Relative").t() %></li>\
                    <% _.each(lastPresets, function(model) { %>\
                        <%= listElementPartial({model: model}) %>\
                   <% }); %>\
                </ul>\
                <div class="presets-divider-wrap"><div class="presets-divider"></div></div>\
            <% } %>\
            <% if (otherPresets && otherPresets.length) { %>\
                <ul class="unstyled presets-group">\
                    <li><%- _("Other").t() %></li>\
                    <% _.each(otherPresets, function(model) { %>\
                        <% if (!(isAllTime(model) && !options.showAllTime)) { %>\
                            <%= listElementPartial({model: model}) %>\
                        <% } %>\
                    <% }); %>\
                </ul>\
            <% } %>\
        '
    });
});

define('contrib/text!views/shared/timerangepicker/dialog/Relative.html',[],function () { return '<div class="form form-horizontal">\n\t<div class="relative-time-container">\n\t\t<div class="control-group col-1 earliest_time">\n\t\t\t<label for="earliest_<%- cid %>" class="control-label" title="<%- _("Earliest:").t() %>"><%- _("Earliest:").t() %></label>\n\t\t\t<div class="controls">\n\t\t\t\t<div class="input-append">\n\t\t\t\t\t<input type="text" size="5" value="<%- time %>" class="earliest_input timerangepicker-relative-earliest-time" id="earliest_<%- cid %>"/>\n\t\t\t\t</div>\n\t\t\t\t<label for="earliest_no_snap_to_<%- cid %>" class="radio">\n\t\t\t\t\t<input type="radio" name="earliest_snap" class="earliest_snap" id="earliest_no_snap_to_<%- cid %>" value="0" checked="checked"/>\n\t\t\t\t     <%- _("No Snap-to").t() %>\n\t\t\t\t</label>\n\t\t\t\t<label class="earliest_snap_label radio" for="earliest_snap_to_<%- cid %>">\n\t\t\t\t\t<input type="radio" name="earliest_snap" class="earliest_snap" id="earliest_snap_to_<%- cid %>" value="1"/>\n\t\t\t\t<span class="text"><%= rangeMap[selectedRange].earliest %></span></label>\n\n\t\t\t\t<span id="earliest_hint_<%- cid %>" class="help-block help-block-timestamp"></span>\n\t\t\t</div>\n\t\t</div><!-- /.control-group -->\n\n\t\t<div class="control-group col-2 latest_time">\n\t\t\t<label class="control-label" for="<%- cid %>" title="<%- _("Latest:").t() %>"><%- _("Latest:").t() %></label>\n\t\t\t<div class="controls">\n\t\t\t\t<label for="latest_no_snap_to_<%- cid %>" class="radio">\n\t\t\t\t\t<input type="radio" name="latest_snap" class="latest_snap" id="latest_no_snap_to_<%- cid %>" value="0" checked="checked"/>\n\t\t\t\t\t<%- _("now").t() %>\n\t\t\t\t</label>\n\t\t\t\t<label class="latest_snap_label radio" for="latest_snap_to_<%- cid %>">\n\t\t\t\t\t<input type="radio" name="latest_snap" class="latest_snap" id="latest_snap_to_<%- cid %>" value="1"/>\n\t\t\t\t<span class="text"><%= rangeMap[selectedRange].latest %></span></label>\n\n\t\t\t\t <span id="latest_hint_<%- cid %>" class="help-block help-block-timestamp"></span>\n\t\t\t</div>\n\t\t</div><!-- /.control-group -->\n\n\t\t<div class="col-3">\n\t\t\t<button class="apply btn" id="apply_<%- cid %>"><%- _("Apply").t() %></button>\n\t\t</div>\n\t</div>\n</div>\n';});

define('views/shared/timerangepicker/dialog/Relative',
    [
        "jquery",
        "underscore",
        "backbone",
        "module",
        "models/services/search/TimeParser",
        "models/shared/TimeRange",
        "views/Base",
        "views/shared/controls/SyntheticSelectControl",
        "views/shared/FlashMessages",
        "util/time",
        "util/splunkd_utils",
        "splunk.i18n",
        'contrib/text!views/shared/timerangepicker/dialog/Relative.html'
    ],
    function(
        $,
        _,
        Backbone,
        module,
        TimeParserModel,
        TimeRangeModel,
        Base,
        SyntheticSelectControl,
        FlashMessages,
        time_utils,
        splunkd_utils,
        i18n,
        relativeTemplate
        ) {
        return Base.extend({
            moduleId: module.id,
            className: 'accordion-inner',
            template: relativeTemplate,
            initialize: function(options) {
                Base.prototype.initialize.apply(this, arguments);

                _.defaults(this.options, {appendSelectDropdownsTo: 'body'});

                this.label = _('Relative').t();

                this.model = {
                    timeRange: this.model,
                    workingRange: new TimeRangeModel(),
                    earliestTimeParser: new TimeParserModel(),
                    latestTimeParser: new TimeParserModel()
                };
                this.syncInternals();

                this.rangeMap = {
                        's': {
                            earliest: _('Beginning of second').t(),
                            latest: _('Beginning of current second').t()
                        },
                        'm': {
                            earliest: _('Beginning of minute').t(),
                            latest: _('Beginning of current minute').t()
                        },
                        'h': {
                            earliest: _('Beginning of hour').t(),
                            latest: _('Beginning of current hour').t()
                        },
                        'd': {
                            earliest: _('Beginning of day').t(),
                            latest: _('Beginning of today').t()
                        },
                        'w': {
                            earliest: _('First day of week').t(),
                            latest: _('First day of this week').t()
                        },
                        'mon': {
                            earliest: _('First day of month').t(),
                            latest: _('First day of this month').t()
                        },
                        'q': {
                            earliest: _('First day of quarter').t(),
                            latest: _('First day of this quarter').t()
                        },
                        'y': {
                            earliest: _('First day of year').t(),
                            latest: _('First day of this year').t()
                        }
                };

                this.children.rangeTypeSelect = new SyntheticSelectControl({
                    model: this.model.workingRange,
                    items: [
                        {value: 's', label: _('Seconds Ago').t()},
                        {value: 'm', label: _('Minutes Ago').t()},
                        {value: 'h', label: _('Hours Ago').t()},
                        {value: 'd', label: _('Days Ago').t()},
                        {value: 'w', label: _('Weeks Ago').t()},
                        {value: 'mon', label: _('Months Ago').t()},
                        {value: 'q', label: _('Quarters Ago').t()},
                        {value: 'y', label: _('Years Ago').t()}
                    ],
                    modelAttribute: 'relative_range_unit',
                    className: 'btn-group timerangepicker-relative_range_unit',
                    toggleClassName: 'btn',
                    menuWidth: 'narrow',
                    popdownOptions: {attachDialogTo: this.options.appendSelectDropdownsTo},
                    save: false
                });

                this.children.flashMessages = new FlashMessages({
                    model: {
                        workingRange: this.model.workingRange,
                        earliestTimeParser: this.model.earliestTimeParser,
                        latestTimeParser: this.model.latestTimeParser
                    }
                });

                this.activate();
            },
            startListening: function() {
                this.listenTo(this.model.workingRange, "change:relative_range_unit", function() {
                    var timeRange = this.model.workingRange.get("relative_range_unit");
                    this.$(".earliest_snap_label .text").html(this.rangeMap[timeRange].earliest);
                    this.$(".latest_snap_label .text").html(this.rangeMap[timeRange].latest);
                    this.fetchEarliestTime();
                    this.fetchLatestTime();
                });

                this.listenTo(this.model.workingRange, "change:relative_earliest_snap_to change:relative_earliest_value", _.debounce(this.fetchEarliestTime, 0));
                this.listenTo(this.model.workingRange, "change:relative_latest_snap_to", _.debounce(this.fetchLatestTime, 0));

                this.listenTo(this.model.earliestTimeParser, "change", this.updateEarliestHint);

                this.listenTo(this.model.earliestTimeParser, "error", function() {
                    this.$("#earliest_hint_" + this.cid).html(this.model.earliestTimeParser.error.get("messages")[0].message);
                    this.disableApply();
                });

                this.listenTo(this.model.latestTimeParser, "change", this.updateLatestHint);

                this.listenTo(this.model.latestTimeParser, "error", function() {
                    this.$("#latest_hint_" + this.cid).html(this.model.latestTimeParser.error.get("messages")[0].message);
                    this.disableApply();
                });

                this.listenTo(this.model.timeRange, 'change:earliest change:latest prepopulate', _.debounce(this.prepopulate, 0));
            },
            syncInternals: function() {
                this.model.workingRange.set(
                    $.extend(true, {}, this.model.timeRange.toJSON(), {relative_range_unit: 's'})
                );

                this.model.earliestTimeParser.set({
                    key: time_utils.stripRTSafe(this.model.timeRange.get("earliest"), false),
                    value: this.model.timeRange.get("earliest_iso")
                });

                this.model.latestTimeParser.set({
                    key: time_utils.stripRTSafe(this.model.timeRange.get("latest"), true),
                    value: this.model.timeRange.get("latest_iso")
                });
            },
            activate: function(options) {
                if (this.active) {
                    return Base.prototype.activate.apply(this, arguments);
                }
                this.syncInternals();
                return Base.prototype.activate.apply(this, arguments);
            },
            deactivate: function(options) {
                if (!this.active) {
                    return Base.prototype.deactivate.apply(this, arguments);
                }
                Base.prototype.deactivate.apply(this, arguments);

                this.model.workingRange.fetchAbort();
                this.model.workingRange.clear({setDefaults: true});
                this.model.earliestTimeParser.fetchAbort();
                this.model.earliestTimeParser.clear({setDefaults: true});
                this.model.latestTimeParser.fetchAbort();
                this.model.latestTimeParser.clear({setDefaults: true});

                return this;
            },
            updateEarliestHint: function() {
                var date = time_utils.isoToDateObject(this.model.earliestTimeParser.get("value"));
                this.$("#earliest_hint_" + this.cid).html(i18n.format_datetime_microseconds(time_utils.jsDateToSplunkDateTimeWithMicroseconds(date), "short", "full"));
                this.enableApply();
            },
            updateLatestHint: function() {
                var date = time_utils.isoToDateObject(this.model.latestTimeParser.get("value"));
                this.$("#latest_hint_" + this.cid).html(i18n.format_datetime_microseconds(time_utils.jsDateToSplunkDateTimeWithMicroseconds(date), "short", "full"));
                this.enableApply();
            },
            prepopulate: function() {
                var earliestParse = this.model.timeRange.getTimeParse('earliest'),
                    latestParse = this.model.timeRange.getTimeParse('latest'),
                    attrValues = {};

                if (!earliestParse) return;

                attrValues.relative_earliest_value = earliestParse.amount;
                attrValues.relative_earliest_snap_to = (earliestParse.hasSnap ? 1 : 0);
                attrValues.relative_latest_snap_to = ((latestParse && latestParse.hasSnap) ? 1 : 0);
                if (this.rangeMap.hasOwnProperty(earliestParse.unit)) {
                    attrValues.relative_range_unit = earliestParse.unit;
                }

                this.model.workingRange.set(attrValues);

                this.$('.earliest_input').val(earliestParse.amount);
                this.$('[name=earliest_snap][value=' + this.model.workingRange.get('relative_earliest_snap_to') + ']').prop('checked', true);
                this.$('[name=latest_snap][value=' + this.model.workingRange.get('relative_latest_snap_to') + ']').prop('checked', true);
            },
            supportsRange: function() {
                return time_utils.generateRelativeTimeLabel(this.model.timeRange.get('earliest'), this.model.timeRange.get('latest'));
            },
            getEarliestTime: function() {
                var amount = this.model.workingRange.get('relative_earliest_value'),
                    unit = this.model.workingRange.get('relative_range_unit') || "s",
                    snap = this.model.workingRange.get('relative_earliest_snap_to');
                if (!amount){
                    return null;
                }
                return "-" + amount + unit + (snap ? ("@" + unit) : "");
            },
            fetchEarliestTime: function() {
                var time = this.getEarliestTime(),
                    id = time_utils.stripRTSafe(this.model.earliestTimeParser.id, false);

                if (time && (time !== id)) {
                    this.model.earliestTimeParser.fetch({
                        data : {
                            time: time
                        }
                    });
                } else if (this.model.earliestTimeParser.get("value")) {
                    this.updateEarliestHint();
                } else {
                    this.$("#earliest_hint_" + this.cid).html("");
                    this.enableApply();
                }
            },
            getLatestTime: function() {
                var type = this.model.workingRange.get('relative_range_unit') || "mon",
                    snap = this.model.workingRange.get('relative_latest_snap_to'),
                    time = "now";
                if (snap){
                    time = "@" + type;
                }
                return time;
            },
            fetchLatestTime: function() {
                var time = this.getLatestTime(),
                    id = this.model.latestTimeParser.id;

                if (time && (time !== id)) {
                    this.model.latestTimeParser.fetch({
                        data : {
                            time: time
                        }
                    });
                } else if (this.model.latestTimeParser.get("value")) {
                    this.updateLatestHint();
                } else {
                    this.$("#latest_hint_" + this.cid).html("");
                }
            },
            events: {
                "keyup .earliest_input": function(event) {
                    this.model.workingRange.set('relative_earliest_value', this.$("#earliest_" + this.cid).val());
                },
                "change .earliest_snap": function(event) {
                    var value = parseInt(this.$("input:radio[name=earliest_snap]:checked").val(), 10);
                    this.model.workingRange.set("relative_earliest_snap_to", value);
                },
                "change .latest_snap": function(event) {
                    var value = parseInt(this.$("input:radio[name=latest_snap]:checked").val(), 10);
                    this.model.workingRange.set("relative_latest_snap_to", value);
                },
                "click .apply": function(event) {
                    if ($(event.currentTarget).hasClass("disabled")) {
                        event.preventDefault();
                        return;
                    }

                    var that = this,
                        earliest = this.getEarliestTime(),
                        latest = this.getLatestTime();

                    if (!earliest){
                        var error = splunkd_utils.createSplunkDMessage(splunkd_utils.ERROR, "Earliest cannot be blank.");
                        this.model.earliestTimeParser.trigger("error", this.model.earliestTimeParser, error);
                        return false;
                    }

                    this.disableApply();

                    this.model.workingRange.save(
                        {
                            earliest: earliest,
                            latest: latest
                        },
                        {
                            success: function(model) {
                                that.enableApply();
                                that.model.timeRange.set({
                                    'earliest': earliest,
                                    'latest': latest,
                                    'earliest_epoch': model.get('earliest_epoch'),
                                    'latest_epoch': model.get('latest_epoch'),
                                    'earliest_iso': model.get('earliest_iso'),
                                    'latest_iso': model.get('latest_iso'),
                                    'earliest_date': new Date(model.get('earliest_date').getTime()),
                                    'latest_date': new Date(model.get('latest_date').getTime())
                                });
                                that.model.timeRange.trigger("applied");
                            },
                            error: function(model, error) {
                                that.disableApply();
                            }
                        }
                    );
                    event.preventDefault();
                }
            },
            generateLabel: function() {
                return "Custom Time";
            },
            enableApply: function() {
                this.$("#apply_" + this.cid).removeClass('disabled');
            },
            disableApply: function() {
                this.$("#apply_" + this.cid).addClass('disabled');
            },
            render: function() {
                var template = _.template(this.template, {
                    cid: this.cid,
                    time: this.model.workingRange.get('relative_earliest_value') || "",
                    rangeMap: this.rangeMap,
                    selectedRange: this.model.workingRange.get('relative_range_unit') || "mon",
                    _: _
                });
                this.$el.html(template);

                this.children.flashMessages.render().prependTo(this.$el);
                this.children.rangeTypeSelect.render().insertAfter(this.$(".earliest_input"));
                if (this.model.latestTimeParser.isNew()) {
                    this.fetchLatestTime();
                }

                return this;
            }
        });
    }
);

define('contrib/text!views/shared/timerangepicker/dialog/RealTime.html',[],function () { return '<div class="form form-horizontal real-time-container">\n    <div class="control-group col-1">\n        <label class="control-label" for="earliest_<%- cid %>" title="<%- _("Earliest:").t() %>"><%- _("Earliest:").t() %></label>\n        <div class="controls">\n            <div class="input-append"><input type="text" size="5" value="<%- time %>" class="earliest_input timerangepicker-real-time-earliest-time" id="earliest_<%- cid %>"/></div>\n\n            <span id="hint_<%- cid %>" class="help-block help-block-timestamp"></span>\n        </div>\n    </div>\n    <div class="control-group col-2">\n        <label class="control-label" title="<%- _("Latest:").t() %>"><%- _("Latest:").t() %></label>\n        <div class="controls">\n            <span class="form-value uneditable-input">now</span>\n        </div>\n    </div>\n    <div class="col-3">\n        <button class="apply btn" id="apply_<%- cid %>"><%- _("Apply").t() %></button>\n    </div>\n\n</div>\n';});

define('views/shared/timerangepicker/dialog/RealTime',
	[
        "jquery",
        "underscore",
        "backbone",
        "module",
        "models/services/search/TimeParser",
        "models/shared/TimeRange",
        "views/Base",
        "views/shared/controls/SyntheticSelectControl",
        "views/shared/FlashMessages",
        "util/time",
        "splunk.i18n",
        'contrib/text!views/shared/timerangepicker/dialog/RealTime.html'
    ],
    function($,
        _,
        Backbone,
        module,
        TimeParserModel,
        TimeRangeModel,
        Base,
        SyntheticSelectControl,
        FlashMessages,
        time_utils,
        i18n,
        realTimeTemplate
        ) {
        return Base.extend({
            moduleId: module.id,
            className: 'accordion-inner',
            template: realTimeTemplate,
            defaultRangeType: "s",
            initialize: function(options) {
                Base.prototype.initialize.apply(this, arguments);

                _.defaults(this.options, {appendSelectDropdownsTo: 'body'});

                this.label = _('Real-time').t();

                this.model = {
                    timeRange: this.model,
                    workingRange: new TimeRangeModel(),
                    earliestTimeParser: new TimeParserModel()
                };
                this.syncInternals();

                this.children.rangeTypeSelect = new SyntheticSelectControl({
                    model: this.model.workingRange,
                    items: [
                        {value: 's', label: _('Seconds Ago').t()},
                        {value: 'm', label: _('Minutes Ago').t()},
                        {value: 'h', label: _('Hours Ago').t()},
                        {value: 'd', label: _('Days Ago').t()},
                        {value: 'w', label: _('Weeks Ago').t()},
                        {value: 'mon', label: _('Months Ago').t()},
                        {value: 'q', label: _('Quarters Ago').t()},
                        {value: 'y', label: _('Years Ago').t()}
                    ],
                    modelAttribute: 'realtime_range_type',
                    className: 'btn-group timerangepicker-realtime_range_type',
                    toggleClassName: 'btn',
                    menuWidth: 'narrow',
                    popdownOptions: {attachDialogTo: this.options.appendSelectDropdownsTo},
                    save: false
                });

                this.children.flashMessages = new FlashMessages({
                    model: {
                        workingRange: this.model.workingRange,
                        earliestTimeParser: this.model.earliestTimeParser
                    }
                });

                this.activate();
            },
            startListening: function() {
                this.listenTo(this.model.workingRange, "change:realtime_range_type change:realtime_earliest_value", _.debounce(function() {
                    this.fetchEarliestTime();
                }.bind(this), 0));

                this.listenTo(this.model.earliestTimeParser, "change", this.updateEarliestHint);

                this.listenTo(this.model.earliestTimeParser, "error", function() {
                    this.$("#hint_" + this.cid).html(this.model.earliestTimeParser.error.get("messages")[0].message);
                    this.disableApply();
                });

                this.listenTo(this.model.timeRange, 'change:earliest change:latest prepopulate', _.debounce(this.prepopulate, 0));
            },
            syncInternals: function() {
                this.model.workingRange.set(
                    $.extend(true, {}, this.model.timeRange.toJSON(), {realtime_range_type: this.defaultRangeType})
                );

                this.model.earliestTimeParser.set({
                    key: time_utils.stripRTSafe(this.model.timeRange.get("earliest"), false),
                    value: this.model.timeRange.get("earliest_iso")
                });
            },
            activate: function(options) {
                if (this.active) {
                    return Base.prototype.activate.apply(this, arguments);
                }
                this.syncInternals();
                return Base.prototype.activate.apply(this, arguments);
            },
            deactivate: function(options) {
                if (!this.active) {
                    return Base.prototype.deactivate.apply(this, arguments);
                }
                Base.prototype.deactivate.apply(this, arguments);

                this.model.workingRange.fetchAbort();
                this.model.workingRange.clear({setDefaults: true});
                this.model.earliestTimeParser.fetchAbort();
                this.model.earliestTimeParser.clear({setDefaults: true});

                return this;
            },
            updateEarliestHint: function() {
                var date = time_utils.isoToDateObject(this.model.earliestTimeParser.get("value"));
                this.$("#hint_" + this.cid).html(i18n.format_datetime_microseconds(time_utils.jsDateToSplunkDateTimeWithMicroseconds(date), "short", "full"));
                this.enableApply();
            },
            prepopulate: function() {
                var earliestParse = this.model.timeRange.getTimeParse('earliest'),
                    attrValues = {};

                if (!earliestParse) { return;}

                this.$('.earliest_input').val(earliestParse.amount);

                attrValues.realtime_earliest_value = earliestParse.amount;
                attrValues.realtime_range_type = earliestParse.unit;

                this.model.workingRange.set(attrValues);
            },
            supportsRange: function() {
                var earliestParse = this.model.timeRange.getTimeParse('earliest'),
                    latestParse = this.model.timeRange.getTimeParse('latest');

                if (!earliestParse) { return false; }

                return earliestParse.isRealTime && earliestParse.amount && !earliestParse.snapUnit
                        && latestParse.isRealTime && latestParse.isNow && !latestParse.snapUnit ;
            },
            getEarliestTime: function(withoutRT) {
                var amount = this.model.workingRange.get('realtime_earliest_value'),
                    type = this.model.workingRange.get('realtime_range_type') || this.defaultRangeType;

                if (!amount){
                    return null;
                }
                return (withoutRT ? "" : "rt") + "-" + amount + type;
            },
            fetchEarliestTime: function() {
                var time = this.getEarliestTime(true),
                    id = time_utils.stripRTSafe(this.model.earliestTimeParser.id, false);

                if (time && (time !== id)) {
                    this.model.earliestTimeParser.fetch({
                        data : {
                            time: time
                        }
                    });
                } else if (this.model.earliestTimeParser.get("value")) {
                    this.updateEarliestHint();
                } else {
                    this.$("#hint_" + this.cid).html("");
                    this.enableApply();
                }
            },
            events: {
                "keyup .earliest_input": function(event) {
                    this.model.workingRange.set('realtime_earliest_value', this.$("#earliest_" + this.cid).val());
                },
                "click .apply": function(event) {
                    if ($(event.currentTarget).hasClass("disabled")) {
                        event.preventDefault();
                        return;
                    }

                    var that = this,
                        earliest = this.getEarliestTime();
                    this.disableApply();

                    this.model.workingRange.save(
                            {
                                earliest: earliest,
                                latest: "rtnow"
                            },
                            {
                                success: function(model) {
                                    that.enableApply();
                                    that.model.timeRange.set({
                                        'earliest': earliest,
                                        'latest': "rtnow",
                                        'earliest_epoch': model.get('earliest_epoch'),
                                        'latest_epoch': model.get('latest_epoch'),
                                        'earliest_iso': model.get('earliest_iso'),
                                        'latest_iso': model.get('latest_iso'),
                                        'earliest_date': new Date(model.get('earliest_date').getTime()),
                                        'latest_date': new Date(model.get('latest_date').getTime())
                                    });
                                    that.model.timeRange.trigger("applied");
                                },
                                error: function(model, error) {
                                    that.enableApply();
                                }
                            }
                    );
                    event.preventDefault();
                }
            },
            enableApply: function() {
                this.$("#apply_" + this.cid).removeClass('disabled');
            },
            disableApply: function() {
                this.$("#apply_" + this.cid).addClass('disabled');
            },
            render: function() {
                var template = _.template(this.template, {
                    _: _,
                    cid: this.cid,
                    time: this.model.workingRange.get('realtime_earliest_value') || ""
                });
                this.$el.html(template);

                this.children.flashMessages.render().prependTo(this.$el);
                this.children.rangeTypeSelect.render().insertAfter(this.$(".earliest_input"));

                return this;
            }
        });
    }
);

define('views/shared/timerangepicker/dialog/daterange/BetweenDates',[
        "jquery",
        "underscore",
        "backbone",
        "module",
        "models/shared/DateInput",
        "models/shared/TimeRange",
        'views/Base',
        "views/shared/controls/DateControl",
        "views/shared/FlashMessages"
      ],
     function($, _, Backbone, module, DateInputModel, TimeRangeModel, Base, DateControl, FlashMessages) {
        return Base.extend({
            // tagName: 'tbody',
            moduleId: module.id,
            initialize: function() {
                Base.prototype.initialize.apply(this, arguments);

                this.model = {
                    timeRange: this.model,
                    workingRange: new TimeRangeModel(),
                    earliestDateInput: new DateInputModel(),
                    latestDateInput: new DateInputModel()
                };
                this.syncInternals();

                this.children.earliestTimeInput = new DateControl({
                    model: this.model.earliestDateInput,
                    inputClassName: "timerangepicker-earliest-date",
                    validate: true
                });

                this.children.latestTimeInput = new DateControl({
                    model: this.model.latestDateInput,
                    inputClassName: "timerangepicker-latest-date",
                    validate: true
                });

                this.children.flashMessages = new FlashMessages({
                    model: {
                        workingRange: this.model.workingRange,
                        earliestDateInput: this.model.earliestDateInput,
                        latestDateInput: this.model.latestDateInput
                    }
                });

                this.activate();
            },
            startListening: function() {
                this.listenTo(this.model.timeRange, 'change:earliest_date change:latest_date prepopulate', _.debounce(this.prepopulate, 0));

                this.listenTo(this.model.earliestDateInput, "validated:invalid", this.disableApply);
                this.listenTo(this.model.earliestDateInput, "validated:valid", this.enableApply);

                this.listenTo(this.model.earliestDateInput, "change", function(){
                    this.model.workingRange.trigger("validated", true, this.model.workingRange, {});
                    this.model.workingRange.trigger("serverValidated", true, this.model.workingRange, []);
                });

                this.listenTo(this.model.latestDateInput, "validated:invalid", this.disableApply);
                this.listenTo(this.model.latestDateInput, "validated:valid", this.enableApply);

                this.listenTo(this.model.latestDateInput, "change", function(){
                    this.model.workingRange.trigger("validated", true, this.model.workingRange, {});
                    this.model.workingRange.trigger("serverValidated", true, this.model.workingRange, []);
                });
            },
            syncInternals: function() {
                this.yesterday = new Date();
                this.yesterday.setDate(this.yesterday.getDate() - 1);
                this.yesterday.setHours(0, 0, 0, 0);
                this.model.earliestDateInput.setFromJSDate(this.yesterday, {silent:true});

                this.today = new Date();
                this.today.setHours(0, 0, 0, 0);
                this.model.latestDateInput.setFromJSDate(this.today, {silent:true});
            },
            activate: function(options) {
                if (this.active) {
                    return Base.prototype.activate.apply(this, arguments);
                }
                this.syncInternals();
                return Base.prototype.activate.apply(this, arguments);
            },
            deactivate: function(options) {
                if (!this.active) {
                    return Base.prototype.deactivate.apply(this, arguments);
                }
                Base.prototype.deactivate.apply(this, arguments);
                this.model.workingRange.fetchAbort();
                this.model.workingRange.clear({setDefaults: true});
                this.model.earliestDateInput.clear({setDefaults: true});
                this.model.latestDateInput.clear({setDefaults: true});

                return this;
            },
            prepopulate: function() {
                var earliest = this.model.timeRange.get('earliest_date'),
                    latest =  this.model.timeRange.get('latest_date');

                if (!this.model.timeRange.hasNoEarliest() && earliest) {
                    this.model.earliestDateInput.setFromJSDate(earliest, {validate: true});
                }
                if (latest) {
                    var latestDate= new Date(latest.getTime());

                    if (latestDate.getHours() == 0) {
                        latestDate.setDate((latestDate.getDate() - 1), {validate: true});
                    }
                    this.model.latestDateInput.setFromJSDate(latestDate, {validate: true});
                }
            },
            events: {
                "click .apply": function(event) {
                    if ($(event.currentTarget).hasClass("disabled")) {
                        event.preventDefault();
                        return;
                    }

                    this.model.earliestDateInput.setHoursMinSecFromStr("00:00:00.000", {silent:true, validate: true});
                    this.model.latestDateInput.setHoursMinSecFromStr("24:00:00.000", {silent:true, validate: true});

                    var that = this,
                    earliestIsoWithoutTZ = this.model.earliestDateInput.isoWithoutTZ(),
                    latestIsoWithoutTZ = this.model.latestDateInput.isoWithoutTZ();

                    this.disableApply();

                    this.model.workingRange.save(
                            {
                                earliest: earliestIsoWithoutTZ,
                                latest: latestIsoWithoutTZ

                            },
                            {
                                success: function(model) {
                                    that.enableApply();
                                    that.model.timeRange.set({
                                        'earliest': model.get('earliest_epoch'),
                                        'latest': model.get('latest_epoch'),
                                        'earliest_epoch': model.get('earliest_epoch'),
                                        'latest_epoch': model.get('latest_epoch'),
                                        'earliest_iso': model.get('earliest_iso'),
                                        'latest_iso': model.get('latest_iso'),
                                        'earliest_date': new Date(model.get('earliest_date').getTime()),
                                        'latest_date': new Date(model.get('latest_date').getTime())
                                    });
                                    that.model.timeRange.trigger("applied");
                                },
                                error: function(model, error) {
                                    that.enableApply();
                                }
                            }
                    );
                    event.preventDefault();
                }
            },
            generateLabel: function() {
                //This is a temporary generator. Should move this into the model?
                var earliest = this.model.earliestDateInput.jsDate();
                var latest = this.model.latestDateInput.jsDate();
                latest.setDate(latest.getDate() -1);

                return earliest.toDateString().slice(4, -5) + " - " + latest.toDateString().slice(4, -5);

            },
            enableApply: function() {
                this.$("#apply_" + this.cid).removeClass('disabled');
            },
            disableApply: function() {
                this.$("#apply_" + this.cid).addClass('disabled');
            },
            render: function() {
                var template = _.template(this.template, {
                    _: _,
                    cid: this.cid
                });
                this.$el.html(template);
                this.children.flashMessages.render().appendTo(this.$(".flash_messages"));
                this.children.earliestTimeInput.render().prependTo(this.$('.earliest-date'));
                this.children.latestTimeInput.render().prependTo(this.$('.latest-date'));

                return this;
            },
            template: '\
            <div class="time-between-dates">\
                <div class="flash_messages"></div>\
                <div class="earliest-date col-1">\
                    <span class="help-block"><%- _("00:00:00").t() %></span>\
                </div>\
                <label class="control-label"><%- _("and").t() %></label>\
                <div class="latest-date col-2">\
                    <span class="help-block"><%- _("24:00:00").t() %></span>\
                </div>\
                <div class="col-3">\
                    <button class="apply btn" id="apply_<%- cid %>"><%- _("Apply").t() %></button>\
                </div>\
            </div>\
            '
        });
    }
);

define('views/shared/timerangepicker/dialog/daterange/BeforeDate',[
        "jquery",
        "underscore",
        "backbone",
        "module",
        "models/shared/DateInput",
        "models/shared/TimeRange",
        'views/Base',
        "views/shared/controls/DateControl",
        "views/shared/FlashMessages"
      ],
     function($, _, Backbone, module, DateInputModel, TimeRangeModel, Base, DateControl, FlashMessages) {
        return Base.extend({
            // tagName: 'tbody',
            moduleId: module.id,
            initialize: function() {
                Base.prototype.initialize.apply(this, arguments);

                this.model = {
                    timeRange: this.model,
                    workingRange: new TimeRangeModel(),
                    latestDateInput: new DateInputModel()
                };
                this.syncInternals();

                this.children.latestTimeInput = new DateControl({
                    model:  this.model.latestDateInput,
                    validate: true
                });

                this.children.flashMessages = new FlashMessages({
                    model: {
                        workingRange: this.model.workingRange,
                        latestDateInput: this.model.latestDateInput
                    }
                });

                this.activate();
            },
            startListening: function() {
                this.listenTo(this.model.timeRange, 'change:latest_date prepopulate', _.debounce(this.prepopulate, 0));

                this.listenTo(this.model.latestDateInput, "validated:invalid", this.disableApply);
                this.listenTo(this.model.latestDateInput, "validated:valid", this.enableApply);

                this.listenTo(this.model.latestDateInput, "change", function(){
                    this.model.workingRange.trigger("validated", true, this.model.workingRange, {});
                    this.model.workingRange.trigger("serverValidated", true, this.model.workingRange, []);
                });
            },
            syncInternals: function() {
                this.today = new Date();
                this.today.setHours(0, 0, 0, 0);
                this.model.latestDateInput.setFromJSDate(this.today, {silent:true});
            },
            activate: function(options) {
                if (this.active) {
                    return Base.prototype.activate.apply(this, arguments);
                }
                this.syncInternals();
                return Base.prototype.activate.apply(this, arguments);
            },
            deactivate: function(options) {
                if (!this.active) {
                    return Base.prototype.deactivate.apply(this, arguments);
                }
                Base.prototype.deactivate.apply(this, arguments);

                this.model.workingRange.fetchAbort();
                this.model.workingRange.clear({setDefaults: true});
                this.model.latestDateInput.clear({setDefaults: true});

                return this;
            },
            prepopulate: function() {
                var latest = this.model.timeRange.get('latest_date');

                if (latest) {
                    this.model.latestDateInput.setFromJSDate(latest, {validate: true});
                    this.model.latestDateInput.setHoursMinSecFromStr("00:00:00.000", {silent:true});
                }
            },
            events: {
                "click .apply": function(event) {
                    if ($(event.currentTarget).hasClass("disabled")) {
                        event.preventDefault();
                        return;
                    }

                    this.model.latestDateInput.setHoursMinSecFromStr("00:00:00.000", {silent:true, validate:true});

                    var that = this,
                    latestIsoWithoutTZ = this.model.latestDateInput.isoWithoutTZ();

                    this.disableApply();

                    this.model.workingRange.save(
                            {
                                earliest: "",
                                latest: latestIsoWithoutTZ
                            },
                            {
                                success: function(model) {
                                    that.enableApply();
                                    that.model.timeRange.set({
                                        'earliest': "",
                                        'latest': model.get('latest_epoch'),
                                        'earliest_epoch': model.get('earliest_epoch'),
                                        'latest_epoch': model.get('latest_epoch'),
                                        'earliest_iso': model.get('earliest_iso'),
                                        'latest_iso': model.get('latest_iso'),
                                        'earliest_date': new Date(0),
                                        'latest_date': new Date(model.get('latest_date').getTime())
                                    });
                                    that.model.timeRange.trigger("applied");
                                },
                                error: function(model, error) {
                                    that.enableApply();
                                }
                            }
                    );
                    event.preventDefault();
                }
            },
            enableApply: function() {
                this.$("#apply_" + this.cid).removeClass('disabled');
            },
            disableApply: function() {
                this.$("#apply_" + this.cid).addClass('disabled');
            },
            render: function() {
                var template = _.template(this.template, {
                    _: _,
                    cid: this.cid
                });
                this.$el.html(template);
                this.children.flashMessages.render().appendTo(this.$(".flash_messages"));
                this.children.latestTimeInput.render().prependTo(this.$(".latest_time"));
                return this;
            },
            template: '\
                <div class="time-before-date">\
                    <div class="flash_messages"></div>\
                    <div class="latest_time col-1">\
                        <span class="help-block"><%- _("00:00:00").t() %></span>\
                    </div>\
                    <div class="col-2">\
                        <button class="apply btn" id="apply_<%- cid %>"><%- _("Apply").t() %></button>\
                    </div>\
                </div>\
            '
        });
    }
);

define('views/shared/timerangepicker/dialog/daterange/AfterDate',
    [
        "jquery",
        "underscore",
        "backbone",
        "module",
        "models/shared/DateInput",
        "models/shared/TimeRange",
        'views/Base',
        "views/shared/controls/DateControl",
        "views/shared/FlashMessages"
    ],
    function($, _, Backbone, module, DateInputModel, TimeRangeModel, Base, DateControl, FlashMessages) {
        return Base.extend({
            // tagName: 'tbody',
            moduleId: module.id,
            initialize: function() {
                Base.prototype.initialize.apply(this, arguments);

                this.model = {
                    timeRange: this.model,
                    workingRange: new TimeRangeModel(),
                    earliestDateInput: new DateInputModel()
                };
                this.syncInternals();

                this.children.earliestTimeInput = new DateControl({
                    model: this.model.earliestDateInput,
                    validate: true
                });

                this.children.flashMessages = new FlashMessages({
                    model: {
                        workingRange: this.model.workingRange,
                        earliestDateInput: this.model.earliestDateInput
                    }
                });

                this.activate();
            },
            startListening: function() {
                this.listenTo(this.model.timeRange, 'change:earliest_date prepopulate', _.debounce(this.prepopulate, 0));

                this.listenTo(this.model.earliestDateInput, "validated:invalid", this.disableApply);
                this.listenTo(this.model.earliestDateInput, "validated:valid", this.enableApply);

                this.listenTo(this.model.earliestDateInput, "change", function(){
                    this.model.workingRange.trigger("validated", true, this.model.workingRange, {});
                    this.model.workingRange.trigger("serverValidated", true, this.model.workingRange, []);
                });
            },
            syncInternals: function() {
                this.yesterday = new Date();
                this.yesterday.setDate(this.yesterday.getDate() - 1);
                this.yesterday.setHours(0, 0, 0, 0);
                this.model.earliestDateInput.setFromJSDate(this.yesterday, {silent:true});
            },
            activate: function(options) {
                if (this.active) {
                    return Base.prototype.activate.apply(this, arguments);
                }
                this.syncInternals();
                return Base.prototype.activate.apply(this, arguments);
            },
            deactivate: function(options) {
                if (!this.active) {
                    return Base.prototype.deactivate.apply(this, arguments);
                }
                Base.prototype.deactivate.apply(this, arguments);

                this.model.workingRange.fetchAbort();
                this.model.workingRange.clear({setDefaults: true});
                this.model.earliestDateInput.clear({setDefaults: true});

                return this;
            },
            prepopulate: function() {
                var earliest = this.model.timeRange.get('earliest_date');

                if (earliest && !this.model.timeRange.hasNoEarliest()) {
                    this.model.earliestDateInput.setFromJSDate(earliest, {validate: true});
                    this.model.earliestDateInput.setHoursMinSecFromStr("00:00:00.000", {silent:true});
                }
            },
            events: {
                "click .apply": function(event) {
                    if ($(event.currentTarget).hasClass("disabled")) {
                        event.preventDefault();
                        return;
                    }

                    var that = this,
                    earliestIsoWithoutTZ = this.model.earliestDateInput.isoWithoutTZ();
                    this.disableApply();

                    this.model.workingRange.save(
                            {
                                earliest: earliestIsoWithoutTZ,
                                latest: "now"
                            },
                            {
                                success: function(model) {
                                    that.enableApply();
                                    that.model.timeRange.set({
                                        'earliest': model.get('earliest_epoch'),
                                        'latest': 'now',
                                        'earliest_epoch': model.get('earliest_epoch'),
                                        'latest_epoch': model.get('latest_epoch'),
                                        'earliest_iso': model.get('earliest_iso'),
                                        'latest_iso': model.get('latest_iso'),
                                        'earliest_date': new Date(model.get('earliest_date').getTime()),
                                        'latest_date': new Date(model.get('latest_date').getTime())
                                    });
                                    that.model.timeRange.trigger("applied");
                                },
                                error: function(model, error) {
                                    that.enableApply();
                                }
                            }
                    );
                    event.preventDefault();
                }
            },
            enableApply: function() {
                this.$("#apply_" + this.cid).removeClass('disabled');
            },
            disableApply: function() {
                this.$("#apply_" + this.cid).addClass('disabled');
            },
            render: function() {
                var template = _.template(this.template, {
                    _: _,
                    cid: this.cid
                });
                this.$el.html(template);
                
                this.children.flashMessages.render().appendTo(this.$(".flash_messages"));
                this.children.earliestTimeInput.render().prependTo(this.$(".earliest_time"));
                return this;
            },
            template: '\
                <div class="time-after-date">\
                    <div class="flash_messages"></div>\
                    <div class="earliest_time col-1">\
                        <span class="help-block"><%- _("00:00:00").t() %></span>\
                    </div>\
                    <div class="col-2">\
                        <button class="apply btn" id="apply_<%- cid %>"><%- _("Apply").t() %></button>\
                    </div>\
                </div>\
            '
        });
    }
);

define('views/shared/timerangepicker/dialog/daterange/Master',[
        "jquery",
        "underscore",
        "backbone",
        "module",
        "views/Base",
        "views/shared/controls/SyntheticSelectControl",
        "views/shared/timerangepicker/dialog/daterange/BetweenDates",
        "views/shared/timerangepicker/dialog/daterange/BeforeDate",
        "views/shared/timerangepicker/dialog/daterange/AfterDate"
        ],
        function($, _, Backbone, module, Base, SyntheticSelectControl, BetweenDates, BeforeDate, AfterDate) {
            return Base.extend({
                className: 'accordion-inner',
                moduleId: module.id,
                initialize: function(options) {
                    Base.prototype.initialize.apply(this, arguments);

                    _.defaults(this.options, {appendSelectDropdownsTo: 'body'});

                    this.label = _("Date Range").t();

                    this.children.rangeTypeSelect = new SyntheticSelectControl({
                        model: this.model,
                        items: [
                            {value: 'between_dates', label: _('Between').t()},
                            {value: 'before_date', label: _('Before').t()},
                            {value: 'after_date', label: _('Since').t()}
                        ],
                        modelAttribute: 'range_type',
                        className: 'timerangepicker-range-type',
                        toggleClassName: 'btn',
                        menuWidth: 'narrow',
                        popdownOptions: {attachDialogTo: this.options.appendSelectDropdownsTo},
                        save: false
                    });

                    var rangeTypeOptions = {
                        model: this.model,
                        parentCid: this.cid
                    };
                    this.children.betweenDates = new BetweenDates(rangeTypeOptions);
                    this.children.beforeDate = new BeforeDate(rangeTypeOptions);
                    this.children.afterDate = new AfterDate(rangeTypeOptions);

                    this.activate();
                },
                startListening: function() {
                    this.listenTo(this.model, "change:range_type", function() {
                        var range_type = this.model.get('range_type') || "";
                        this.children.betweenDates.$el.hide();
                        this.children.beforeDate.$el.hide();
                        this.children.afterDate.$el.hide();
                        switch(range_type){
                            case "before_date":
                                this.children.beforeDate.$el.show();
                                break;
                            case "after_date":
                                this.children.afterDate.$el.show();
                                break;
                            default:
                                this.children.betweenDates.$el.show();
                            break;
                        }
                    });
                    
                    this.listenTo(this.model, 'change:earliest change:latest prepopulate', _.debounce(this.prepopulate, 0));
                },
                prepopulate: function() {
                    var earliestIsAbsolute = this.model.isAbsolute('earliest'),
                        hasNoEarliest = this.model.hasNoEarliest(),
                        latestIsAbsolute =  this.model.isAbsolute('latest');

                    if (!hasNoEarliest && earliestIsAbsolute && latestIsAbsolute) {
                        this.model.set('range_type', 'between_dates');
                    } else if (hasNoEarliest && latestIsAbsolute) {
                        this.model.set('range_type', 'before_date');
                    } else if (earliestIsAbsolute && this.model.latestIsNow()) {
                        this.model.set('range_type', 'after_date');
                    }
                },
                supportsRange: function() {
                    var supportsEarliest = false,
                        supportsLatest = false,
                        hasNoEarliest = this.model.hasNoEarliest(),
                        latestIsNow = this.model.latestIsNow(),
                        earliestIsWholeDay = this.model.isWholeDay('earliest'),
                        latestIsWholeDay = this.model.isWholeDay('latest');

                    if (hasNoEarliest && latestIsNow) {
                        return false;
                    }

                    return (earliestIsWholeDay && latestIsWholeDay)
                            || (earliestIsWholeDay && latestIsNow)
                            || (hasNoEarliest && latestIsWholeDay);
                },
                render: function() {
                    this.$el.append( this.children.rangeTypeSelect.render().el);

                    var template = _.template(this.template, {
                        cid: this.cid
                    });
                    this.$el.append(template);

                    this.children.betweenDates.render().appendTo(this.$('.date-range-container'));
                    this.children.beforeDate.render().appendTo(this.$('.date-range-container'));
                    this.children.beforeDate.$el.hide();
                    this.children.afterDate.render().appendTo(this.$('.date-range-container'));
                    this.children.afterDate.$el.hide();

                    return this;
                },
                template: '\
                    <div class="form form-inline date-range-container">\
                    </div>\
                '
        });
    }
);

// footer nav
define('views/shared/timerangepicker/dialog/dateandtimerange/timeinput/HoursMinutesSeconds',[
    'jquery',
    'underscore',
    'backbone',
    'module',
    'views/Base'
],
function(
    $,
    _,
    Backbone,
    module,
    Base
){
    return Base.extend({
        tagName: 'span',
        className: "view-time-range-picker-time-and-date-range-hours-minutes-seconds pull-left",
        moduleId: module.id,
        initialize: function() {
            Base.prototype.initialize.apply(this, arguments);
            this.activate();
        },
        startListening: function() {
            this.listenTo(this.model, "attributeValidated:second", function(isValid, key, error) {
                if (isValid) {
                    this.$("input").removeClass("error");
                } else {
                    this.$("input").addClass("error");
                }
            });
            
            this.listenTo(this.model, "change", this.updateTime);
        },
        events: {
            'keyup input[type="text"]': function(){
                this.stopListening(this.model, "change", this.updateTime);
                this.model.setHoursMinSecFromStr(this.$('input').val(), {validate: true});
                this.listenTo(this.model, "change", this.updateTime);
            }
        },
        updateTime: function() {
            var time = this.model.time();
            this.$('input').val(time).removeClass("error");
        },
        render: function() {
            var time = this.model.time();

            var template = _.template(this.template, {
                time: time
            });
            this.$el.html(template);

            return this;
        },
        template: '\
            <input type="text" size="10" value="<%- time %>"/>\
            <span class="help-block"><%- _("HH:MM:SS.SSS").t() %></span>\
            '
    });
});

define('views/shared/timerangepicker/dialog/dateandtimerange/timeinput/Master',[
            "jquery",
            "underscore",
            "backbone",
            "module",
            "views/Base",
            "views/shared/controls/DateControl",
            "views/shared/timerangepicker/dialog/dateandtimerange/timeinput/HoursMinutesSeconds"
      ],
     function($, _, Backbone, module, Base, DateControl, HoursMinutesSeconds) {
        return Base.extend({
            // tagName: 'table',
            className: 'form form-inline',
            moduleId: module.id,
            initialize: function() {
                Base.prototype.initialize.apply(this, arguments);

                this.children.monthDayYear = new DateControl({
                    parentCid: this.cid,
                    model: this.model.dateTime,
                    className: 'control pull-left',
                    inputClassName: this.options.inputClassName || 'date',
                    validate: true
                });

                this.children.hoursMinutesSeconds = new HoursMinutesSeconds({
                    model: this.model.dateTime
                });
            },
            render: function() {
                if (!this.el.innerHTML) {
                    var template = _.template(this.template, {
                        _: _,
                        cid: this.cid,
                        label: this.options.label
                    });
                    this.$el.html(template);

                    this.children.monthDayYear.render().appendTo(this.$(".time-mdy").last());
                    this.children.hoursMinutesSeconds.render().appendTo(this.$(".time-hms").last());
                } else {
                    this.children.monthDayYear.render();
                    this.children.hoursMinutesSeconds.render();
                }
                return this;
            },
            template: '\
                <span class="time-datetime-range">\
                    <label class="control-label" for="monthdayyear_<%- cid %>" title="<%- label %><%- _(":").t() %>"><%- label %><%- _(":").t() %></label>\
                    <span class="time-mdy"></span>\
                    <span class="time-hms"></span>\
                </span>\
            '
        });
    }
);

define('views/shared/timerangepicker/dialog/dateandtimerange/Master',
        [
            "jquery",
            "underscore",
            "backbone",
            "module",
            "models/shared/DateInput",
            "models/shared/TimeRange",
            "views/Base",
            "views/shared/timerangepicker/dialog/dateandtimerange/timeinput/Master",
            "views/shared/FlashMessages",
            "util/time"
        ],
        function($, _, Backbone, module, DateInputModel, TimeRangeModel, Base, TimeInput, FlashMessages, time_utils) {
            return Base.extend({
                className: 'accordion-inner',
                moduleId: module.id,
                initialize: function() {
                    Base.prototype.initialize.apply(this, arguments);
            
                    this.model = {
                        timeRange: this.model,
                        workingRange: new TimeRangeModel(),
                        earliestDateInput: new DateInputModel(),
                        latestDateInput: new DateInputModel()
                    };
                    this.syncInternals();
                        
                    this.label = _("Date & Time Range").t();
                    this.earliest_errored = false;
                    this.latest_errored = false;
                    
                    //views
                    this.children.earliestTimeInput = new TimeInput({
                        label: _("Earliest").t(),
                        inputClassName: 'date-earliest',
                        model: {
                            dateTime: this.model.earliestDateInput
                        }
                    });
            
                    this.children.latestTimeInput = new TimeInput({
                        label: _("Latest").t(),
                        inputClassName: 'date-latest',
                        model: {
                            dateTime: this.model.latestDateInput
                        }
                    });
                    
                    this.children.flashMessages = new FlashMessages({
                        model: {
                            workingRange: this.model.workingRange,
                            earliestDateInput: this.model.earliestDateInput,
                            latestDateInput: this.model.latestDateInput
                        }
                    });
                    
                    this.activate();
                },
                startListening: function() {
                    this.listenTo(this.model.workingRange, "sync error", this.enableApply);
                    
                    this.listenTo(this.model.earliestDateInput, "validated:invalid", function(){
                        this.earliest_errored = true;
                        this.disableApply();
                    });

                    this.listenTo(this.model.earliestDateInput, "validated:valid", function(){
                        this.earliest_errored = false;
                        this.enableApply();
                    });

                    this.listenTo(this.model.latestDateInput, "validated:invalid", function(){
                        this.latest_errored = true;
                        this.disableApply();
                    });

                    this.listenTo(this.model.latestDateInput, "validated:valid", function(){
                        this.latest_errored = false;
                        this.enableApply();
                    });

                    this.listenTo(this.model.earliestDateInput, "change", function(){
                        this.model.workingRange.trigger("validated", true, this.model.workingRange, {});
                    });

                    this.listenTo(this.model.latestDateInput, "change", function(){
                        this.model.workingRange.trigger("validated", true, this.model.workingRange, {});
                    });

                    this.listenTo(this.model.timeRange, 'change:earliest_iso change:latest_iso prepopulate', _.debounce(this.prepopulate, 0));
                },
                syncInternals: function() {
                    this.yesterday = new Date();
                    this.yesterday.setDate(this.yesterday.getDate() - 1);
                    this.yesterday.setHours(12, 0, 0, 0);
                    this.model.earliestDateInput.setFromJSDate(this.yesterday, {silent:true});
                                        
                    this.today = new Date();
                    this.today.setHours(12, 0, 0, 0);
                    this.model.latestDateInput.setFromJSDate(this.today, {silent:true});
                },
                activate: function(options) {
                    if (this.active) {
                        return Base.prototype.activate.apply(this, arguments);
                    }
                    this.syncInternals();
                    return Base.prototype.activate.apply(this, arguments);
                },
                deactivate: function(options) {
                    if (!this.active) {
                        return Base.prototype.deactivate.apply(this, arguments);
                    }
                    Base.prototype.deactivate.apply(this, arguments);
                    
                    this.model.workingRange.fetchAbort();
                    this.model.workingRange.clear({setDefaults: true});
                    this.model.earliestDateInput.clear({setDefaults: true});
                    this.model.latestDateInput.clear({setDefaults: true});
                    
                    return this;
                },
                remove: function() {
                    Base.prototype.remove.apply(this, arguments);
                    this.model.workingRange.deepOff();
                    this.model.workingRange.fetchAbort();
                },
                prepopulate: function() {
                    var earliest = this.model.timeRange.get('earliest_iso'),
                        latest =  this.model.timeRange.get('latest_iso'),
                        earliest_date = this.model.timeRange.get('earliest_date'),
                        latest_date = this.model.timeRange.get('latest_date');
                                        
                    if (earliest_date) {
                        this.model.earliestDateInput.setFromJSDate(earliest_date, {validate: true});
                    }
                    if (latest_date) {
                        this.model.latestDateInput.setFromJSDate(latest_date, {validate: true});
                    }
                },
                supportsRange: function() {
                    return time_utils.generateDateTimeRangeLabel(this.model.timeRange.get('earliest'), this.model.timeRange.get('latest'));
                },
                events: {
                    "click .apply": function(event) {
                        if ($(event.currentTarget).hasClass("disabled")) {
                            event.preventDefault();
                            return;
                        }
                    
                        if (!this.earliest_errored && !this.latest_errored){
                            var that = this,
                            earliestIsoWithoutTZ = this.model.earliestDateInput.isoWithoutTZ(),
                            latestIsoWithoutTZ = this.model.latestDateInput.isoWithoutTZ();

                            this.disableApply();
                            this.model.workingRange.save(
                                    {
                                        earliest: earliestIsoWithoutTZ,
                                        latest: latestIsoWithoutTZ
                                    },
                                    {
                                        success: function(model) {
                                            that.enableApply();
                                            that.model.timeRange.set({
                                                'earliest': model.get('earliest_epoch'),
                                                'latest': model.get('latest_epoch'),
                                                'earliest_epoch': model.get('earliest_epoch'),
                                                'latest_epoch': model.get('latest_epoch'),
                                                'earliest_iso': model.get('earliest_iso'),
                                                'latest_iso': model.get('latest_iso'),
                                                'earliest_date': new Date(model.get('earliest_date').getTime()),
                                                'latest_date': new Date(model.get('latest_date').getTime())
                                            });
                                            that.model.timeRange.trigger("applied");
                                        },
                                        error: function(model, error) {
                                            that.enableApply();
                                        }
                                    }
                            );
                        }
                        event.preventDefault();
                    }
                },
                enableApply: function() {
                    this.$("#apply_" + this.cid).removeClass('disabled');
                },
                disableApply: function() {
                    this.$("#apply_" + this.cid).addClass('disabled');
                },
                render: function() {
                    var template = _.template(this.template, {
                        _: _,
                        cid: this.cid
                    });
                    this.$el.html(template);

                    this.children.flashMessages.render().insertBefore(this.$(".apply"));
                    this.children.earliestTimeInput.render().insertBefore(this.$(".apply"));
                    this.children.latestTimeInput.render().insertBefore(this.$(".apply"));

                    return this;
                },
                template: '\
                    <button class="apply btn pull-left" id="apply_<%- cid %>"><%- _("Apply").t() %></button>\
                '
        });
    }
);

define('views/shared/timerangepicker/dialog/advanced/timeinput/Hint',[
    'jquery',
    'underscore',
    'backbone',
    'module',
    'views/Base',
    'util/time',
    'splunk.i18n'
],
function(
    $,
    _,
    Backbone,
    module,
    Base,
    time_utils,
    i18n
){
    return Base.extend({
        moduleId: module.id,
        tagName: 'span',
        initialize: function() {
            Base.prototype.initialize.apply(this, arguments);
            this.activate();
        },
        startListening: function() {
            this.listenTo(this.model.timeParser, 'error sync', this.render);
        },
        render: function() {
            var parseError = this.model.timeParser.error.get("messages"),
                date = time_utils.isoToDateObject(this.model.timeParser.get("value")),
                error = parseError || isNaN(date.getTime());

            var template = _.template(this.template, {
                    _: _,
                    timeParser: this.model.timeParser,
                    error: error,
                    value: error || i18n.format_datetime_microseconds(time_utils.jsDateToSplunkDateTimeWithMicroseconds(date), "short", "full")
                });
            this.$el.html(template);
            return this;
        },
        template: '\
            <% if (error) { %>\
                <%- _("Invalid time").t() %>\
            <% } else if (timeParser.get("value")) { %>\
                <%- value %>\
            <% } %>\
            '
    });
});

define('views/shared/timerangepicker/dialog/advanced/timeinput/Master',[
    'jquery',
    'underscore',
    'backbone',
    "module",
    "views/Base",
    "views/shared/timerangepicker/dialog/advanced/timeinput/Hint",
    "util/time"
],
function(
    $,
    _,
    Backbone,
    module,
    Base,
    Hint,
    time_utils
){
        return Base.extend({
            // tagName: 'table',
            className: 'form form-inline pull-left',
            moduleId: module.id,
            initialize: function() {
                Base.prototype.initialize.apply(this, arguments);

                this.children.hint = new Hint({
                    model: {
                        timeParser: this.model.timeParser
                    }
                });

                this.activate();
            },
            startListening: function() {
                this.listenTo(this.model.working, 'change:' + this.options.modelAttribute, function() {
                    this.update_value();
                    this.update_hint();
                });              
            },
            events: {
                'keyup input[type="text"]': 'update_hint',
                'focusout input[type="text"]': 'update_hint'
            },
            update_hint: function(event) {
                var time = time_utils.stripRTSafe((this.$('input').val() || this.options.blankValue), this.options.isLatest) || 'now';

                this.model.timeParser.fetch({
                    data: {
                        time: time
                    }
                });
            },
            update_value: function() {
                var time = this.model.working.get(this.options.modelAttribute) || "";
                if (time !== this.options.blankValue){
                    this.$('input').val(time);
                }
            },
            render: function() {
                var template = _.template(this.template, {
                    _: _,
                    cid: this.cid,
                    label: this.options.label,
                    time: this.model.working.get(this.options.modelAttribute) || ""
                });
                this.$el.html(template);

                //hint
                this.children.hint.render().replaceContentsOf(this.$("#hint_" + this.cid));
                this.update_hint();

                return this;
            },
            template: '\
            <div class="time-advanced">\
                <label class="control-label" for="<%- cid %>" title="<%- label %><%- _(":").t() %>"><%- label %><%- _(":").t() %></label>\
                <div class="controls">\
                    <input type="text" size="18" value="<%- time %>" id="<%- cid %>"/>\
                    <span id="hint_<%- cid %>" class="help-block help-block-timestamp"></span>\
                </div>\
            </div>\
            '
        });
    }
);

define('views/shared/timerangepicker/dialog/advanced/Master',
    [
        'jquery',
        'underscore',
        'backbone',
        "module",
        "views/Base",
        "views/shared/timerangepicker/dialog/advanced/timeinput/Master",
        "views/shared/FlashMessages",
        "models/services/search/TimeParser",
        "models/shared/TimeRange",
        'uri/route',
        'util/console',
        'util/time'
    ],
    function($, _, Backbone, module, Base, TimeInput, FlashMessages, TimeParserModel, TimeRangeModel, route, console, time_utils) {
        return Base.extend({
            moduleId: module.id,
            className: 'accordion-inner',
            initialize: function() {
                Base.prototype.initialize.apply(this, arguments);

                this.label = _("Advanced").t();

                this.model.workingRange = new TimeRangeModel();
                this.model.earliestTimeParser = new TimeParserModel();
                this.model.latestTimeParser = new TimeParserModel();

                this.syncInternals();

                this.children.earliestTimeInput = new TimeInput({
                    model: {
                        working: this.model.workingRange,
                        timeParser: this.model.earliestTimeParser
                    },
                    label: _("Earliest").t(),
                    blankValue: '0',
                    modelAttribute: "earliest",
                    isLatest: false
                });

                this.children.latestTimeInput = new TimeInput({
                    model: {
                        working: this.model.workingRange,
                        timeParser: this.model.latestTimeParser
                    },
                    label: _("Latest").t(),
                    blankValue: '',
                    modelAttribute: "latest",
                    isLatest: true
                });

                this.children.flashMessages = new FlashMessages({
                    model: {
                        workingRange: this.model.workingRange,
                        earliestTimeParser: this.model.earliestTimeParser,
                        latestTimeParser: this.model.latestTimeParser
                    }
                });

                this.activate();
            },
            syncInternals: function() {
                this.model.workingRange.set($.extend(true, {
                    enableRealTime: this.options.enableCustomAdvancedRealTime
                }, this.model.timeRange.toJSON()));

                this.model.earliestTimeParser.set({
                    key: time_utils.stripRTSafe(this.model.timeRange.get("earliest"), false),
                    value: this.model.timeRange.get("earliest_iso")
                });

                this.model.latestTimeParser.set({
                    key: time_utils.stripRTSafe(this.model.timeRange.get("latest"), true),
                    value: this.model.timeRange.get("latest_iso")
                });
            },
            startListening: function() {
                this.listenTo(this.model.timeRange, 'change:earliest change:latest prepopulate', _.debounce(function() {
                    this.model.workingRange.set({
                        'earliest': this.model.timeRange.get('earliest'),
                        'latest': this.model.timeRange.get('latest')
                    });
                 }, 0));

                this.listenTo(this.model.workingRange, 'validated', function(validated, model, error_payload){
                    if (!validated) {
                        this.enableApply();
                    }
                });
            },
            activate: function(options) {
                if (this.active) {
                    return Base.prototype.activate.apply(this, arguments);
                }
                this.syncInternals();
                return Base.prototype.activate.apply(this, arguments);
            },
            deactivate: function(options) {
                if (!this.active) {
                    return Base.prototype.deactivate.apply(this, arguments);
                }
                Base.prototype.deactivate.apply(this, arguments);

                this.model.workingRange.fetchAbort();
                this.model.workingRange.clear({setDefaults: true});
                this.model.earliestTimeParser.fetchAbort();
                this.model.earliestTimeParser.clear({setDefaults: true});
                this.model.latestTimeParser.fetchAbort();
                this.model.latestTimeParser.clear({setDefaults: true});

                return this;
            },
            remove: function() {
                Base.prototype.remove.apply(this, arguments);
                _.chain(this.model).omit(['appLocal', 'application', 'timeRange']).each(function(model){
                    model.deepOff();
                    model.fetchAbort();
                });
             },
            supportsRange: function() {
                return true; //supports anything
            },
            events: {
                "click .apply": function(event) {
                    if ($(event.currentTarget).hasClass("disabled")) {
                        event.preventDefault();
                        return;
                    }

                    var that = this,
                        earliest = this.children.earliestTimeInput.$('input').val() || '0',
                        latest = this.children.latestTimeInput.$('input').val() || '';

                    this.disableApply();

                    this.model.workingRange.save(
                            {
                                earliest: earliest,
                                latest: latest
                            },
                            {
                                success: function(model) {
                                    that.enableApply();
                                    var latest_date = model.get('latest_date'),
                                        latest_js_date = latest_date ? Date(latest_date.getTime()) : latest_date;
                                    that.model.timeRange.set({
                                        'earliest': model.get('earliest'),
                                        'latest': model.get('latest'),
                                        'earliest_epoch': model.get('earliest_epoch'),
                                        'latest_epoch': model.get('latest_epoch'),
                                        'earliest_iso': model.get('earliest_iso'),
                                        'latest_iso': model.get('latest_iso'),
                                        'earliest_date': new Date(model.get('earliest_date').getTime()),
                                        'latest_date': latest_js_date
                                    });
                                    that.model.timeRange.trigger("applied");
                                },
                                error: function(model, error) {
                                    that.enableApply();
                                }
                            }
                    );
                    event.preventDefault();
                }
            },
            enableApply: function() {
                this.$("#apply_" + this.cid).removeClass('disabled');
            },
            disableApply: function() {
                this.$("#apply_" + this.cid).addClass('disabled');
            },
            render: function() {
                // TODO: 'Remove if statement after all consumers pass the appLocal and application model'
                var docRoute = "http://docs.splunk.com/";
                if (this.model.appLocal && this.model.application) {
                    docRoute = route.docHelp(
                        this.model.application.get("root"),
                        this.model.application.get("locale"),
                        'learnmore.timerange.picker'
                    );
                } else {
                    console.warn("The timerangepicker advanced view needs the AppLocal and Application model passed to it");
                }
                var template = _.template(this.template, {
                    _: _,
                    cid: this.cid,
                    docRoute: docRoute
                });
                this.$el.html(template);
                this.children.flashMessages.render().insertBefore(this.$(".apply"));
                this.children.earliestTimeInput.render().insertBefore(this.$(".apply"));
                this.children.latestTimeInput.render().insertBefore(this.$(".apply"));

                return this;
            },
            template: '\
                    <button class="apply btn" id="apply_<%- cid %>"><%- _("Apply").t() %></button>\
                    <a href="<%- docRoute %>" target="_blank" title="<%- _("Splunk help").t() %>" class="btn-documentation"><%- _("Documentation").t() %> <i class="icon-external"></i></a>\
            '
    });
}
);

define('views/shared/timerangepicker/dialog/Master',[
        'jquery',
        'underscore',
        'backbone',
        'module',
        'models/services/authentication/User',
        'views/Base',
        'views/shared/timerangepicker/dialog/Presets',
        'views/shared/timerangepicker/dialog/Relative',
        'views/shared/timerangepicker/dialog/RealTime',
        'views/shared/timerangepicker/dialog/daterange/Master',
        'views/shared/timerangepicker/dialog/dateandtimerange/Master',
        'views/shared/timerangepicker/dialog/advanced/Master',
        'views/shared/delegates/Accordion'
    ],
    function($, _, Backbone, module, UserModel, Base, Presets, Relative, RealTime, DateRange, DateAndTimeRange, Advanced, Accordion) {
        /**
         * @param {Object} options {
         *     model: {
         *          timeRange: <models.TimeRange>,
         *          user: <models.services.authentication.User>,
         *          appLocal: <models.services.AppLocal>,
         *          application: <models.Application>
         *     },
         *     collection (Optional): <collections.services.data.ui.TimesV2>
         *     showPresets (Optional): hide or show the Presets panel.
         *     showPresetsRealTime (Optional): hide or show RealTime in the Presets panel.
         *     showPresetsRealTimeOnly (Optional): Only show RealTime in the Presets panel.
         *     showPresetsRelative (Optional): hide or show the Relative in the Presets panel.
         *     showPresetsAllTime (Optional): hide or show All Time in the Presets panel.
         *     showCustom (Optional): hide or show all the Custom panels.
         *     showCustomRealTime (Optional): hide or show the RealTime panel.
         *     showCustomRelative (Optional): hide or show the Relative panel.
         *     showCustomDate (Optional): hide or show the Date Range panel.
         *     showCustomDateTime (Optional): hide or show the Date Time Range panel.
         *     showCustomAdvanced (Optional): hide or show the Advanced panel.
         *     enableCustomAdvancedRealTime (optional): allows the advanced inputs to accept realtime values
         * }
         */
        return Base.extend({
            moduleId: module.id,
            className: 'accordion view-new-time-range-picker-dialog',
            initialize: function() {
                this.model.user = this.model.user || new UserModel();
                var canRTSearch = this.model.user.canRTSearch(),
                    defaults = {
                        showPresets:true,
                        showPresetsRealTime: canRTSearch,
                        showPresetsRealTimeOnly:false,
                        showPresetsRelative:true,
                        showPresetsAllTime:true,
                        showCustom:true,
                        showCustomRealTime: canRTSearch,
                        showCustomRelative:true,
                        showCustomDate:true,
                        showCustomDateTime:true,
                        showCustomAdvanced:true,
                        enableCustomAdvancedRealTime: canRTSearch,
                        appendSelectDropdownsTo: 'body'
                    };
                
                _.defaults(this.options, defaults);
                Base.prototype.initialize.apply(this, arguments);
                
                this.renderedDfd = $.Deferred();
                
                //Panels
                if (this.options.showPresets && this.collection) {
                    this.children.presets = new Presets({
                        collection: this.collection,
                        model: this.model.timeRange,
                        showRealTime:this.options.showPresetsRealTime,
                        showRealTimeOnly:this.options.showPresetsRealTimeOnly,
                        showRelative:this.options.showPresetsRelative,
                        showAllTime:this.options.showPresetsAllTime
                    });
                }
                if (this.options.showCustom) {
                    if (this.options.showCustomRelative) {
                        this.children.relative = new Relative({
                            model: this.model.timeRange,
                            appendSelectDropdownsTo: this.options.appendSelectDropdownsTo
                        });
                    }
                    if (this.options.showCustomRealTime) {
                        this.children.realtime = new RealTime({
                            model: this.model.timeRange,
                            appendSelectDropdownsTo: this.options.appendSelectDropdownsTo
                        });
                    }
                    if (this.options.showCustomDate) {
                        this.children.daterange = new DateRange({
                            model: this.model.timeRange,
                            appendSelectDropdownsTo: this.options.appendSelectDropdownsTo
                        });
                    }
                    if (this.options.showCustomDateTime) {
                        this.children.dateandtimerange = new DateAndTimeRange({model: this.model.timeRange});
                    }
                    if (this.options.showCustomAdvanced) {
                        this.children.advanced = new Advanced({
                            model: {
                                timeRange: this.model.timeRange,
                                appLocal: this.model.appLocal,
                                application: this.model.application
                            },
                            enableCustomAdvancedRealTime: this.options.enableCustomAdvancedRealTime
                        });
                    }
                }
                
                this.activate({skipOnChange: true});
            },
            startListening: function() {
                //note this listens for changes on earliest_epoch and latest_epoch because they change after the ajax request completes.
                this.listenTo(this.model.timeRange, 'change:earliest_epoch change:latest_epoch', _.debounce(this.onChange, 0));

                if (this.collection) {
                    this.listenTo(this.collection, 'reset', this.onChange);
                }                
            },
            activate: function(options) {
                options = options || {};
                if (this.active) {
                    return Base.prototype.activate.apply(this, arguments);
                }
                
                Base.prototype.activate.apply(this, arguments);
                
                if (!options.skipOnChange) {
                    this.onChange();
                }
                
                return this;
            },
            onChange: function() {
                $.when(this.renderedDfd).then(function() {
                    return this.$el.is(":visible") ? false : this.children.accordion.show(this.getBestGroup(), false);
                }.bind(this));

            },
            getBestGroup: function() {
                var bestPanel = false;
                
                _.each(this.children, function(panel, key) {
                    if (bestPanel) return false;
                    bestPanel = panel.supportsRange() ? panel : bestPanel;
                }, this);
                
                bestPanel = bestPanel || this.children.presets || this.children.advanced || this.children.daterange || this.children.dateandtimerange || this.children.relative || this.children.realtime;
                
                return bestPanel.$el.closest('.accordion-group');
            },
            render: function() {
                var template = _.template(this.template, {
                    cid: this.cid,
                    panels: this.children
                });
                this.$el.html(template);
                
                _.each(this.children, function(panel, key) {
                    panel.render().appendTo(this.$("#" + key + "_" + this.cid + ' .accordion-body'));
                }, this);

                this.children.accordion = new Accordion({el: this.el, defaultGroup: this.getBestGroup()});
                this.renderedDfd.resolve();
                return this;
            },
            onShown: function() {
                this.$('.accordion-group.active a.accordion-toggle').focus();
            },
            template: '\
                <% _.each(panels, function(panel, key) { %> \
                <div class="accordion-group" id="<%- key + "_" + cid %>">\
                    <div class="accordion-heading">\
                      <a class="accordion-toggle" href="#">\
                        <i class="icon-accordion-toggle"></i><%- panel.label %>\
                      </a>\
                    </div>\
                    <div class="accordion-body">\
                    </div>\
                </div>\
                <% }); %> \
            '
      });
  }
);

define('views/shared/timerangepicker/Master',
    [
        'jquery',
        'underscore',
        'module',
        'views/Base',
        'views/shared/timerangepicker/dialog/Master',
        'views/shared/delegates/Popdown',
        'collections/SplunkDsBase',
        'splunk.util',
        'util/console'
    ],
    function($, _, module, Base, Dialog, Popdown, SplunkDsBaseCollection, splunk_util, console) {
        /**
         * @param {Object} options {
         *      model: {
         *          state: <models.services.SavedSearch.entry.content>,
         *          timeRange: <models.TimeRange>,
         *          user: <models.services.admin.User>,
         *          appLocal: <models.services.AppLocal>,
         *          application: <models.Application>
         *      },
         *      collection: <collections.services.data.ui.TimesV2>
         *      {String} timerangeClassName (Optional) Class attribute to the button element. Default is btn.
         *      {Object} dialogOptions: (Optional) Keys and values passed to the dialog for customization. See views/shared/timerangepicker/dialog/Master.
         *      {Object} popdownOptions: (Optional) Keys and values passed to the popdown for customization.
         * }
         */
        return Base.extend({
            moduleId: module.id,
            className: 'btn-group',
            initialize: function(options) {
                var defaults = {
                    timerangeClassName: 'btn'
                };

                _.defaults(this.options, defaults);

                Base.prototype.initialize.call(this, options);

                this.children.dialog = new Dialog(
                    $.extend(
                        {
                            model: {
                                timeRange: this.model.timeRange,
                                user: this.model.user,
                                appLocal: this.model.appLocal,
                                application: this.model.application
                            },
                            collection: this.collection
                        },
                        this.options.dialogOptions || {}
                     )
                );

                this.activate({skipSetLabel: true});
            },
            startListening: function() {
                if (this.collection) {
                    this.listenTo(this.collection, 'reset', function(){
                        console.warn("timerangepicker setting label because of collection reset");
                        this.setLabel();
                    });
                }

                this.listenToModels();                
            },
            listenToModels: function() {
                this.listenTo(this.model.timeRange, 'change:earliest change:latest', _.debounce(function() {
                    if (this.active) {
                        this.timeRangeChange();
                    }
                }, 0));

                this.listenTo(this.model.timeRange, 'applied', this.timeRangeApplied);
                this.listenTo(this.model.timeRange, 'change:earliest_epoch change:latest_epoch change:earliest change:latest', _.debounce(function() {
                    if (this.active) {
                        this.setLabel();
                    }
                }, 0));

                this.listenTo(this.model.state, 'change:dispatch.earliest_time change:dispatch.latest_time', _.debounce(function(){
                    if (this.active) {
                        this.stateChange();
                    }
                }, 0));
            },
            stopListeningToModels: function() {
                this.stopListening(this.model.timeRange);
                this.stopListening(this.model.state);
            },
            activate: function(options) {
                options = options || {};
                
                if (this.active) {
                    return Base.prototype.activate.apply(this, arguments);
                }

                if (!options.skipSetLabel) {
                    this.setLabel();
                }

                Base.prototype.activate.apply(this, arguments);

                this.model.timeRange.trigger("prepopulate");

                return this;
            },
            stateChange: function() {
                this.stopListeningToModels();
                this.model.timeRange.clear({silent:true, setDefaults: true});
                this.model.timeRange.save(
                    {
                        'earliest': this.model.state.get('dispatch.earliest_time'),
                        'latest':this.model.state.get('dispatch.latest_time')
                    },
                    {
                        wait: true,
                        success: function(model, response) {
                            this.listenToModels();
                            this.setLabel();
                        }.bind(this),
                        error: function(model, response) {
                            this.listenToModels();
                            this.setLabel();
                        }.bind(this)
                    }
                );
            },
            timeRangeChange: function() {
                this.stopListeningToModels();
                this.model.state.set({
                    'dispatch.earliest_time': this.model.timeRange.get('earliest'),
                    'dispatch.latest_time':this.model.timeRange.get('latest')
                });
                this.listenToModels();
            },
            timeRangeApplied: function() {
                this.children.popdown.hide();
                this.model.state.trigger("applied", {silent: splunk_util.normalizeBoolean(this.model.state.get('disable_timerange_trigger'))});
            },
            setLabel: function() {
                if (this.$el.html()) {
                    var timeLabel = this.model.timeRange.generateLabel(this.collection || new SplunkDsBaseCollection());
                    this.$el.children('a').find(".time-label").text(_(timeLabel).t()).attr('title', _(timeLabel).t());
                }
            },
            render: function() {
                if (this.$el.html()) {
                    return this;
                }

                this.$el.html(this.compiledTemplate({
                    options: this.options
                }));

                this.children.dialog.render().appendTo(this.$('.popdown-dialog'));

                this.children.popdown = new Popdown(_.extend({
                    el: this.el,
                    toggle:'> a',
                    mode: "dialog",
                    attachDialogTo: 'body',
                    ignoreClasses: [
                        "ui-datepicker",
                        "ui-datepicker-header",
                        "dropdown-menu"
                    ]
                }, this.options.popdownOptions || {}));

                this.children.popdown.on('shown', function() {
                    if (this.children.dialog.$(".accordion-group.active").length){
                        this.children.dialog.onShown();
                        return;
                    }
                    var timePanel = "presets";
                    this.children.dialog.children[timePanel].$el.closest(".accordion-group").find(".accordion-toggle").first().click();
                    this.children.dialog.onShown();
                }, this);

                this.setLabel();

                return this;
            },
            template: '\
                <a class=" splBorder splBorder-nsew splBackground-primary <%- options.timerangeClassName %>" href="#"><span class="time-label"></span><span class="caret"></span></a>\
                <div class="popdown-dialog">\
                    <div class="arrow"></div>\
                </div>\
                '
        });
    }
);

define('collections/shared/Times',
    [
        'collections/services/data/ui/Times',
        'underscore'
    ],
    function(TimesCollection, _) {
        var SharedTimesCollection = TimesCollection.extend({
            // no instance methods
        }, {
            /**
             * Creates a times collection from a list of provided
             * preset definitions.
             * 
             * A preset definition is a dictionary with structure similar to:
             * {label: 'Last 10 minutes', earliest_time: '-10m', latest_time: 'now'}.
             */
            createFromPresets: function(presets) {
                var entries = [];
                _.each(presets, function(preset) {
                    var id = _.uniqueId('time_');
                    entries.push({
                        'name': id,
                        'id': id,
                        'links': {},
                        'author': 'nobody',
                        'acl': {},
                        'content': preset
                    });
                });
                
                // Emulate the format of the data/ui/times REST endpoint,
                // which is the closest thing to an API this class appears to have.
                var collection = new TimesCollection();
                collection.setFromSplunkD({
                    'links': {
                       'create': '/services/data/ui/times/_new',
                       '_reload': '/services/data/ui/times/_reload'
                    },
                    'origin': '',
                    'updated': '',
                    'generator': {},
                    'entry': entries
                });
                return collection;
            }
        });
        
        return SharedTimesCollection;
    }
);
requirejs.s.contexts._.nextTick = function(f){f()}; require(['css'], function(css) { css.addBuffer('splunkjs/css/timerange-picker.css'); }); requirejs.s.contexts._.nextTick = requirejs.nextTick;
define('splunkjs/mvc/timerangeview',['require','exports','module','underscore','./mvc','backbone','./basesplunkview','util/console','views/shared/timerangepicker/Master','collections/shared/Times','models/shared/TimeRange','./tokenutils','./utils','./sharedmodels','css!../css/timerange-picker'],function(require, exports, module) {
    var _ = require("underscore");
    var mvc = require('./mvc');
    var Backbone = require("backbone");
    var BaseSplunkView = require("./basesplunkview");
    var console = require('util/console');
    var InternalTimeRangePicker = require('views/shared/timerangepicker/Master');
    var SharedTimesCollection = require('collections/shared/Times');
    var TimeRangeModel = require('models/shared/TimeRange');
    var TokenUtils = require('./tokenutils');
    var utils = require('./utils');
    var sharedModels = require('./sharedmodels');

    require("css!../css/timerange-picker");
    
    // DOC: The 'timepicker' field is private.
    var TimeRangeView = BaseSplunkView.extend({
        moduleId: module.id,
        
        className: "splunk-timerange",
        
        options: {
            'default': undefined,
            managerid: null,
            earliest_time: undefined,
            latest_time: undefined,
            /**
             * Name of the preset (ex: "Last 24 hours") that specifies the
             * default value of this view. Overrides 'default' if
             * both are present.
             */
            preset: undefined,
            /**
             * List of preset definitions to display in this view.
             * If omitted, the standard presets will be used.
             * Initialization-only.
             * 
             * A preset definition is a dictionary with structure similar to:
             * {label: 'Last 10 minutes', earliest_time: '-10m', latest_time: 'now'}.
             */
            presets: undefined,
            value: undefined,
            /**
             * Options to customize the dialog that appears when the
             * time range view is clicked. Initialization-only.
             * 
             * See views/shared/timerangepicker/dialog/Master for the
             * specific options available.
             */
            dialogOptions: {},
            popdownOptions: {}
        },
        
        initialize: function() {
            var that = this;
            
            this.configure();
            this.settings.enablePush('value');
            this.settings.enablePush('earliest_time');
            this.settings.enablePush('latest_time');
            
            this._initializeValue();
            
            // Initialize view state
            var initialValue = this.settings.get('value');
            this._state = new Backbone.Model({
                'dispatch.earliest_time': (initialValue !== undefined)
                    ? initialValue['earliest_time']
                    : '',
                'dispatch.latest_time': (initialValue !== undefined)
                    ? initialValue['latest_time']
                    : ''
            });
            
            // Get the shared models
            var appModel = sharedModels.get('app');
            var userModel = sharedModels.get('user');
            var appLocalModel = sharedModels.get('appLocal');
            var timesCollection = (this.settings.get('presets') !== undefined)
                ? SharedTimesCollection.createFromPresets(this.settings.get('presets'))
                : sharedModels.get('times');
            
            this._timesCollection = timesCollection;
            
            // We cannot create the timepicker until these internal models
            // have been fetched, and so we wait on them being done.
            this._pickerDfd = $.when(timesCollection.dfd, userModel.dfd, appLocalModel.dfd).done(function() {
                var timeRangeModel = new TimeRangeModel();
                timeRangeModel.save({
                    'earliest': that._state.get('dispatch.earliest_time'),
                    'latest': that._state.get('dispatch.latest_time')
                });
                
                that.timepicker = new InternalTimeRangePicker({
                    className: "controls",
                    model: {
                        state: that._state,
                        timeRange: timeRangeModel,
                        user: userModel,
                        appLocal: appLocalModel,
                        application: appModel
                    },
                    collection: timesCollection,
                    dialogOptions: that.settings.get('dialogOptions'),
                    popdownOptions: that.settings.get('popdownOptions')
                });
            
                // We don't register the change handler on the internal 
                // state until we're done creating the timepicker
                that._state.on(
                    "change:dispatch.earliest_time change:dispatch.latest_time", 
                    _.debounce(that._onTimeRangeChange), 
                    that
                );
            });
                
            // Whenever the times collection changes and/or the preset changes,
            // we update the timepicker
            this._timesCollection.on("change reset", this._onTimePresetUpdate, this);
            this.settings.on("change:preset", this._onTimePresetUpdate, this);
            
            // Update view if model changes
            this.settings.on("change:value", function(model, value, options) {
                that.val(value || {earliest_time: '', latest_time: ''});
            });
            
            // Update model if view changes
            this.on("change", function() {
                that.settings.set("value", that._getTimeRange());
            });
            
            // Update the default if it changes
            this.settings.on("change:default", this._onDefaultChange, this);
            
            this.bindToComponentSetting('managerid', this._onManagerChange, this);
            
            // Initialize value to preset (asynchronously) if no other
            // initial value was determined
            if (this.settings.get('value') === undefined) {
                that._onTimePresetUpdate();
            }

            this._onReady(_.bind(this.trigger, this, 'ready'));
        },

        _onReady: function(cb) {
            // If the time input is configured to use a preset (such as "Last 24 hours") we wait unit the presets are
            // fetched before signaling readiness. Otherwise we return a pre-resolved promise.
            var dfd = $.Deferred().resolve();
            if (this.settings.get('preset') && !this.settings.get('value')) {
                this._presetDfd = $.Deferred();
                dfd = this._presetDfd.promise();
            }
            if (cb) {
                dfd.always(cb);
            }
            return dfd;
        },

        _initializeValue: function() {
            var that = this;
            
            // Reconcile initial {value, earliest_time, latest_time}
            var initialValue = this.settings.get('value');
            if (initialValue !== undefined) {
                this.settings.set({
                    'earliest_time': initialValue['earliest_time'],
                    'latest_time': initialValue['latest_time']
                });
            } else if (this.settings.get('earliest_time') !== undefined ||
                       this.settings.get('latest_time') !== undefined)
            {
                this.settings.set('value', {
                    'earliest_time': this.settings.get('earliest_time'),
                    'latest_time': this.settings.get('latest_time')
                });
            } else {
                // NOTE: This should be a no-op, but I'm just being explicit
                this.settings.set({
                    'value': undefined,
                    'earliest_time': undefined,
                    'latest_time': undefined
                });
            }
            
            // Keep {value, earliest_time, latest_time} in sync
            this.settings.on("change:value", function(model, value, options) {
                if (value) {
                    that.settings.set({
                        "earliest_time": value.earliest_time,
                        "latest_time": value.latest_time
                    });
                }
            });
            
            // These values can be pushed in two separate events when they
            // are bound to tokens. As such, we debounce so that we send
            // only a single upstream event.
            this.settings.on('change:earliest_time change:latest_time', _.debounce(function() {
                var newValue = _.clone(that.settings.get('value')) || {};
                newValue.earliest_time = that.settings.get('earliest_time');
                newValue.latest_time = that.settings.get('latest_time');
                that.settings.set("value", newValue);
            }), this);
            
            // If value is bound to $token$, automatically bind
            // {earliest_time, latest_time} to derived tokens as a
            // convenience unless they are already bound to a
            // non-literal template
            if (TokenUtils.isToken(this.settings.get('value', {tokens: true}))) {
                var token = TokenUtils.getTokens(
                    this.settings.get('value', {tokens: true}))[0];
                
                var settingIsLiteralOrUndefined = function(settingName) {
                    return (
                        that.settings.get(settingName, {tokens: true}) ===
                        that.settings.get(settingName, {tokens: false})
                    );
                };
                
                // NOTE: This will automatically propagate any preexisting
                //       literal values to the new tokens that are set here.
                if (settingIsLiteralOrUndefined('earliest_time')) {
                    this.settings.set(
                        'earliest_time',
                        '$' + token.namespace + ':' + token.name + '.earliest_time$',
                        {tokens: true});
                }
                if (settingIsLiteralOrUndefined('latest_time')) {
                    this.settings.set(
                        'latest_time',
                        '$' + token.namespace + ':' + token.name + '.latest_time$',
                        {tokens: true});
                }
            }
            
            // If value is still undefined, use a default if available
            if (this.settings.get('value') === undefined) {
                this.settings.set('value', this.settings.get('default'));
            }
        },
        
        _onDefaultChange: function(model, value, options) {
            // Initialize value with default, if provided
            var oldDefaultValue = this.settings.previous("default");
            var defaultValue = this.settings.get("default");
            var currentValue = this.settings.get('value');
            
            if (defaultValue !== undefined &&
                (_.isEqual(currentValue, oldDefaultValue) || currentValue === undefined))
            {
                this.settings.set('value', defaultValue);
            }
        },
        
        _onTimePresetUpdate: function() {
            var preset = this.settings.get("preset");
            if (!preset) {
                return;
            }
            
            this._presetInFlightCancelled = false;
            
            // We can only look at the times collection when it has finished
            // fetching
            var that = this;
            $.when(this._pickerDfd).done(function() {
                var timeModel = that._timesCollection.find(function(model) {
                    return model.entry.content.get("label") === preset;
                });
                
                if (timeModel) {
                    // Don't apply the preset if an intervening value change occurred
                    if (!that._presetInFlightCancelled) {
                        that.val({
                            earliest_time: timeModel.entry.content.get('earliest_time'),
                            latest_time: timeModel.entry.content.get('latest_time')
                        });
                    }
                } else {
                    console.warn('Could not find matching preset "' + preset + '" for time range view.');
                    that.val({
                        // All time
                        earliest_time: "0",
                        latest_time: ""
                    });
                }
                if (this._presetDfd) {
                    this._presetDfd.resolve();
                }
            });
        },
        
        _onManagerChange: function(managers, manager) {
            if (this.manager) {
                this.manager.off(null, null, this);
                this.manager = null;
            }

            this.manager = manager;
            if (manager.search) {
                this.listenTo(
                    manager.search, 
                    "change:earliest_time change:latest_time", 
                    _.debounce(this._onManagerTimeRangeChange)
                );
                
                this._onManagerTimeRangeChange();
            }
        },
        
        _onManagerTimeRangeChange: function() {
            // Get the current time range                
            var timeRange = this.val();
            
            // The manager's time range, if it has one, overrides the timepicker's
            // current range.
            timeRange.earliest_time = this.manager.settings.get("earliest_time") || timeRange.earliest_time;
            timeRange.latest_time = this.manager.settings.get("latest_time") || timeRange.latest_time;
            
            // Set it back
            this.val(timeRange);
        },
        
        _onTimeRangeChange: function(model, value, options) {
            if (!options || (options && !options._self)) {
                this.trigger("change", this._getTimeRange(), this);
            }
        },
        
        render: function() {
            var that = this;
            $.when(this._pickerDfd).done(function() {
                that.timepicker.render();
                that.$el.append(that.timepicker.el);
            });
            
            return this;
        },
        
        val: function(newValue) {
            if (arguments.length === 0) {
                return this._getTimeRange();
            }
            newValue = newValue || {earliest_time: undefined, latest_time: undefined};
            
            var oldValue = this.val();
            
            this._setTimeRange(newValue);
            var realNewValue = this.val();
            
            // Trigger change event manually since programmatic DOM
            // manipulations don't trigger events automatically.
            if (!_.isEqual(realNewValue, oldValue)) {
                this.trigger('change', realNewValue, this);
            }
            
            // If there is an asynchronous preset change
            // in progress, abort it.
            this._presetInFlightCancelled = true;
            
            return this._getTimeRange();
        },

        // This logic applies what Dashboards expects in order for an input to have a "value" - it is not a generally
        // applicable construct, and should only be used by the Dashboard helpers
        _hasValueForDashboards: function() {
            var value = this.settings.get("value");
            var defaultValue = this.settings.get("default");
            var valueIsDefined = value !== undefined && value !== null;
            return valueIsDefined || defaultValue === undefined || value === defaultValue;
        },
        
        _setTimeRange: function(value) {
            this._state.set({
                "dispatch.earliest_time": value.earliest_time,
                "dispatch.latest_time": value.latest_time 
            }, { _self: true });
        },
        
        _getTimeRange: function() {
            return {
                "earliest_time": this._state.get("dispatch.earliest_time"),
                "latest_time": this._state.get("dispatch.latest_time")
            };
        },
        
        remove: function() {
            var that = this;
        
            // We can't remove the timepicker until it is created
            $.when(this._pickerDfd).done(function() {
                that.timepicker.remove();
            });
            
            mvc.Components.revokeInstance(this.id);
            BaseSplunkView.prototype.remove.apply(this, arguments);
        }
    });
    
    return TimeRangeView;
});

define('splunkjs/mvc/timepickerview',['require','util/console','./timerangeview'],function(require) {
    var console = require('util/console');
    
    console.warn(
        '%s is deprecated. Please require %s instead.',
        'splunkjs/mvc/simpleform/timepickerview',
        'splunkjs/mvc/simpleform/timerangeview');
    
    return require('./timerangeview');
});

requirejs.s.contexts._.nextTick = function(f){f()}; require(['css'], function(css) { css.setBuffer('.clearfix{*zoom:1;}.clearfix:before,.clearfix:after{display:table;content:\"\";line-height:0;}\n.clearfix:after{clear:both;}\n.hide-text{font:0/0 a;color:transparent;text-shadow:none;background-color:transparent;border:0;}\n.input-block-level{display:block;width:100%;min-height:26px;-webkit-box-sizing:border-box;-moz-box-sizing:border-box;box-sizing:border-box;}\n.ie7-force-layout{*min-width:0;}\n.shared-timerangepicker-dialog{width:640px;}.shared-timerangepicker-dialog td{vertical-align:top;}\n.timeRangeMenu,.trpCustomDateTime{display:none;}\n.shared-timerangepicker-dialog-advanced .control-group{width:50%;float:left;}\n.help-block-timestamp{min-height:1em;line-height:1em;padding:3px;margin-top:5px;margin-right:15px;border-radius:3px;background-color:#eeeeee;}\n.timerangepicker-range-type{margin-right:25px;float:left;}\n.timerangepicker-range-type .btn{min-width:65px;}\n.btn.timerange-control>.icon-triangle-right-small{padding-left:5px;}\ninput.timerangepicker-earliest-date{margin-right:0;}\ninput.timerangepicker-real-time-earliest-time,input.timerangepicker-relative-earliest-time{margin-right:0;}\n.timerangepicker-realtime_range_type,.timerangepicker-relative_range_type{display:inline-block;vertical-align:middle;margin-right:25px;}\n.shared-timerangepicker-dialog-daterange-betweendates>tr:first-child>td{padding-bottom:0;}.shared-timerangepicker-dialog-daterange-betweendates>tr:first-child>td>.alerts{margin-top:0;}\n.form-inline .radio{line-height:18px;padding-top:5px;padding-bottom:5px;display:block;}\n.form-inline .radio+.radio{padding-top:0;}\ninput.date-before-time{margin-right:5px;}\n.advanced-time-documentation{clear:left;margin:10px 0 0 55px;display:block;float:left;}\n.presets-group{float:left;width:130px;}\n.presets-group+.presets-group{margin-left:10px;}\n.presets-divider-wrap{float:left;margin:10px;}\n.presets-divider{position:absolute;top:10px;bottom:10px;border-right:1px dotted #cccccc;}\n.presets-group li{color:#999999;padding-left:20px;text-indent:-20px;overflow:hidden;text-overflow:ellipsis;}\n.vis-area{*zoom:1;}.vis-area:before,.vis-area:after{display:table;content:\"\";line-height:0;}\n.vis-area:after{clear:both;}\n.slide-area{width:1090px;}\n.content-wrapper{width:450px;float:left;}\n.modal .timerange-picker-wrapper{float:left;}.modal .timerange-picker-wrapper .shared-timerangepicker-dialog{width:640px;}\n.modal .timerange-picker-wrapper .accordion .accordion-heading .accordion-toggle{border-left:none;border-right:none;}\n.modal .timerange-picker-wrapper .accordion .accordion-body{border:none;}\n.modal .timerange-picker-wrapper .accordion .accordion-group.active:last-child .accordion-body{border:none;}\n.modal .timerange-picker-wrapper .accordion .accordion-group:last-child .accordion-toggle{border-bottom:none;border-radius:0px;}\n.modal .timerange-picker-wrapper .accordion .accordion-group:first-child .accordion-toggle{border-top:none;border-radius:0px;}\n.shared-timerangepicker .btn{max-width:99%;}.shared-timerangepicker .btn .time-label{display:inline-block;display:inline\\9;vertical-align:middle;max-width:99%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}\n.relative-time-container .control-label,.real-time-container .control-label{width:50px;overflow:hidden;text-overflow:ellipsis;}\n.relative-time-container .controls,.real-time-container .controls{margin-left:60px;}\n.relative-time-container input,.real-time-container input,.relative-time-container .uneditable-input,.real-time-container .uneditable-input{width:4em;}\n.relative-time-container input[type=\"file\"],.real-time-container input[type=\"file\"],.relative-time-container input[type=\"image\"],.real-time-container input[type=\"image\"],.relative-time-container input[type=\"submit\"],.real-time-container input[type=\"submit\"],.relative-time-container input[type=\"reset\"],.real-time-container input[type=\"reset\"],.relative-time-container input[type=\"button\"],.real-time-container input[type=\"button\"],.relative-time-container input[type=\"radio\"],.real-time-container input[type=\"radio\"],.relative-time-container input[type=\"checkbox\"],.real-time-container input[type=\"checkbox\"]{width:auto;}\n.relative-time-container .col-1,.real-time-container .col-1,.relative-time-container .col-2,.real-time-container .col-2{width:250px;}\n.relative-time-container .col-3,.real-time-container .col-3{width:98px;}\n.relative-time-container .col-1,.real-time-container .col-1,.relative-time-container .col-2,.real-time-container .col-2,.relative-time-container .col-3,.real-time-container .col-3{float:left;}\n.relative-time-container .input-append .btn,.real-time-container .input-append .btn{max-width:8em;overflow:hidden;text-overflow:ellipsis;}\n.relative-time-container .col-3 .btn,.real-time-container .col-3 .btn{max-width:9em;overflow:hidden;text-overflow:ellipsis;}\n.date-range-container{overflow:hidden;}.date-range-container .shared-controls-datecontrol{display:inline-block;}\n.date-range-container .help-block{display:inline;}\n.time-before-date .col-1,.time-after-date .col-1{float:left;max-width:100px;}\n.time-before-date .help-block,.time-after-date .help-block{display:block;}\n.time-between-dates .col-1,.time-between-dates .col-2,.time-between-dates .col-3{float:left;max-width:100px;}\n.time-between-dates .help-block{display:block;}\n.time-between-dates .control-label{float:left;margin-left:1em;margin-right:1em;}\n.shared-timerangepicker-dialog-dateandtimerange .control-label{float:left;margin-right:0.5em;max-width:4em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}\n.shared-timerangepicker-dialog-dateandtimerange input{margin-right:0.5em;}\n.btn-documentation{line-height:22px;white-space:nowrap;}\n.time-advanced .control-label{float:left;margin-right:0.25em;max-width:4em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}\n.accordion-body .time-advanced .controls{float:left;}\n'); }); requirejs.s.contexts._.nextTick = requirejs.nextTick; 
