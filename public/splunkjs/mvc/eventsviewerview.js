
define('views/shared/delegates/Modalize',
    [
        'jquery',
        'underscore',
        'views/shared/delegates/Base'
    ],
    function(
        $,
        _,
       DelegateBase
    ){
        return DelegateBase.extend({
            initialize: function() {
                var defaults = {
                    tbody: '> tbody',
                    parentContainerSelector: 'div',
                    overlayZIndex: 404
                };
                _.defaults(this.options, defaults);
                DelegateBase.prototype.initialize.apply(this, arguments);
            },
            show: function(rowIdx, optArg) {
                this.cleanup();
                if(!_.isNumber(rowIdx)) return;
                
                this.rowIdx = rowIdx; 
                this.optArg = optArg;
                var $row = this.$(this.options.tbody).children(':not(".field-row")').eq(this.rowIdx),
                    dimens = {
                        topHeight: 0,
                        bottomHeight: 0,
                        tableHeaderHeight: 0,
                        dockedThead: 0,
                        width: this.$el[0].scrollWidth + 'px'
                    };
                this.$el.append(this.$top = $('<div class="modalize-table-top" />'));
                this.$el.append(this.$bottom = $('<div class="modalize-table-bottom" />'));
                $('.main-section-body').append(this.$overlay = $('<div class="modalize-table-overlay" />'));

                this.addEventHandlers(_.debounce(function(rowIdx, optArg) { this.show(rowIdx, optArg); }.bind(this), 100));
                
                $row.prevAll(':visible').each(function(index, el) {
                    dimens.topHeight += $(el).outerHeight(true);
	            });
                $row.nextAll(':visible').each(function(index, el) {
                    if(!(optArg && (index==0))) {
                        dimens.bottomHeight += $(el).outerHeight(true);
                    }
	            });
                this.$el.find('> table:not(.table-expanded, .table-embed)').each(function(i, el) {
                    dimens.tableHeaderHeight += $(el).find('tr').first().height();
                });
                this.applycss(dimens);
            },
            update: function() {
                if(this.rowIdx) {
                    this.show(this.rowIdx);
                }
            },
            addEventHandlers: function(show) {
                var unmodalize = function() {
                    this.$top.remove();
                    this.$bottom.remove();
                    this.$overlay.remove();
                    this.trigger('unmodalize', this.rowIdx);
                    this.$el.closest(this.options.parentContainerSelector).css({
                        'z-index': 0 
                    });
                }.bind(this);
                this.$top.on('click', unmodalize);
                this.$bottom.on('click', unmodalize);
                this.$overlay.on('click', unmodalize);

                this.lastHeight = $(window).height();
                this.lastWidth  = $(window).width();
                $(window).on('resize.' + this.cid, function() {
                    var height = $(window).height(),
                        width  = $(window).width();
                    if(height != this.lastHeight  || width != this.lastWidth) {
                        this.lastHeight = height;
                        this.lastWidth = width;
                        show(this.rowIdx, this.optArg);
                    } 
                }.bind(this));
            },
            cleanup: function() {
                if(this.rowIdx) { 
                    delete this.rowIdx;
                }
                this.$top && this.$top.remove();
                this.$bottom && this.$bottom.remove();
                this.$overlay && this.$overlay.remove();
                $(window).off('.' + this.cid);
                this.$el.closest(this.options.parentContainerSelector).css({
                    'z-index': 0 
                });
            },
            applycss: function(dimens) {
                this.$el.closest(this.options.parentContainerSelector).css({
                    'z-index': this.options.overlayZIndex + 1
                });
                this.$top.css({
                    'width': dimens.width,
                    'height': dimens.topHeight + dimens.tableHeaderHeight + 'px'
                });
                this.$bottom.css({
                    'width': dimens.width,
                    'height': dimens.bottomHeight + 'px'
                });
                this.$overlay.css({
                    'z-index': this.options.overlayZIndex
                });
            },
            remove: function() {
                DelegateBase.prototype.remove.apply(this);
                $(window).off('resize.' + this.cid);
                this.$top && this.$top.remove();
                this.$bottom && this.$bottom.remove();
                this.$overlay && this.$overlay.remove();
                return this;
            }
        });
    }
);

define('views/shared/eventsviewer/shared/TableHead',
    [
        'underscore',
        'jquery',
        'module',
        'views/Base',
        'helpers/user_agent'
    ],
    function(
        _,
        $,
        module,
        BaseView,
        user_agent
    )
    {
        return BaseView.extend({
            moduleId: module.id,
            tagName: 'thead',
            /**
             * @param {Object} options {
             *     model: <model.services.SavedSearch> (Optional),
             *     labels: <Array>,
             *     allowRowExpand: true|false
             *     allowLineNum: true|false
             * }
             */
            initialize: function() {
                var defaults = {
                    allowLineNum: true
                };
                this.options = $.extend(true, defaults, this.options);
                BaseView.prototype.initialize.apply(this, arguments);
            },
            updateLabels: function(labels) {
                this.options.labels = labels;
                this.render();
            },
            render: function() {
                this.$el.html(this.compiledTemplate({
                    _: _,
                    is_ie7: (user_agent.isIE7() || (user_agent.isIE() && user_agent.isInIE7DocumentMode())) ? 'ie7': '',
                    is_ie8: user_agent.isIE8() ? 'ie8': '',
                    labels: this.options.labels || [],
                    allowRowExpand: this.options.allowRowExpand,
                    allowLineNum: this.options.allowLineNum
                }));
                return this;
            },
            template: '\
                <tr>\
                    <% if (allowRowExpand) { %>\
                        <th class="col-info"><i class="icon-info"></i></th>\
                    <% } %>\
                    <% if (allowLineNum) { %>\
                        <th class="line-num <%- is_ie7 %>">&nbsp;</i></th>\
                    <% } %>\
                    <% _.each(labels, function(label, index) { %>\
                        <% if(index == labels.length-1) { %>\
                            <th class="col-<%- index %> <%- is_ie7 %> <%- is_ie8 %>"><%- _(label).t() %></th>\
                        <% } else { %>\
                            <th class="col-<%- index %> <%- is_ie7 %>"><%- _(label).t() %></th>\
                        <% } %>\
                    <% }) %>\
                </tr>\
            '
        });
    }
);

define('keyboard/SearchModifier',["underscore"], function(_) {
    /**
     * A lil utility to translate modifier keys pressed to a search action (negate and/or replace)
     * Finds the best match of modifier key bindings based on navigator.userAgent.
     * Merges custom and defaults members and peforms reverse iteration where the lowest index 
     * custom entry takes highest precedent and defaults takes lowest.
     */
    function Modifier(options) {
        options || (options = {});
        var defaults = options.defaults || _.extend({}, Modifier.defaults),
            custom = options.custom || _.extend([], Modifier.custom);
        this.map = this.parse(defaults, custom);
    }
    Modifier.prototype = {
        isNegation: function(e) {
            return !!e[this.map.negate];
        },
        isReplacement: function(e) {
            return !!e[this.map.replace];
        },
        parse: function(defaults, custom) {
            var userAgent = navigator.userAgent || "",
                modifierMatch = null;
            for (var i=custom.length-1; i>-1; i--) {
                var modifier = custom[i];
                if (userAgent.search(modifier.userAgentRex)!=-1) {
                    modifierMatch = modifier;
                }
            }
            if(!modifierMatch) {
                modifierMatch = defaults;
            }
            return modifierMatch;
        }
    };
    Modifier.custom = [
        {"userAgentRex": /Macintosh/, "negate": "altKey", "replace": "metaKey"},//note: FF altKey+metaKey and click results in hand only possible negate/replace combo is shiftKey+metaKey or shiftKey+altKey.
        {"userAgentRex": /Linux.*Chrome/, "negate": "ctrlKey", "replace": "shiftKey"},
        {"userAgentRex": /Linux/, "negate": "ctrlKey", "replace": "metaKey"},
        {"userAgentRex": /Windows/, "negate": "altKey", "replace": "ctrlKey"}
    ];
    Modifier.defaults = {"userAgentRex": /.*/, "negate": "altKey", "replace": "metaKey"};
    return Modifier;
});

define('views/shared/PopTart',
    [
        'underscore',
        'module',
        'views/Base',
        'views/shared/delegates/PopdownDialog'
    ],
    function(_, module, Base, PopdownDialogDelegate) {
        return Base.extend({
            moduleId: module.id,
            className: 'popdown-dialog',
            initialize: function(options) {
                options = options || {};
                var defaults = {
                    direction:'auto',
                    adjustPosition: true
                };
                _.defaults(options, defaults);
                
                Base.prototype.initialize.apply(this, arguments);
                this.children.popdownDialogDelegate = new PopdownDialogDelegate({
                    el: this.el,
                    ignoreClasses: this.options.ignoreClasses, 
                    adjustPosition: this.options.adjustPosition,
                    show: this.options.show,
                    mode: this.options.mode, // "menu" or "dialog"
                    direction: this.options.direction,
                    arrow: this.options.arrow,
                    minMargin: this.options.minMargin,
                    allowPopUp: this.options.allowPopUp,
                    scrollContainer: this.options.scrollContainer
                });
                this.activate();
            },
            startListening: function() {
                this.listenTo(this.children.popdownDialogDelegate, 'all', function() {
                    this.trigger.apply(this, arguments);
                });
                this.listenTo(this, 'shown', function() {
                    this.shown = true;
                    this.children.popdownDialogDelegate.$el.find('a').first().focus();
                });
                this.listenTo(this, 'hidden', function() {
                    this.shown = false;
                    if (this.options.onHiddenRemove) {
                        this.remove();
                    }
                });
                this.listenTo(this, 'focus-on-activator', function() {
                    if (this.$toggle) {
                        this.$toggle.focus();
                    }
                });
            },
            toggle: function () {
                return this.children.popdownDialogDelegate.toggle();
            },
            show: function ($toggle) {
                this.children.popdownDialogDelegate.show($toggle);
                this.$toggle = $toggle;
            },
            hide: function () {
                this.children.popdownDialogDelegate.hide();
            },
            render: function() {
                this.el.innerHTML = this.template;
                return this;
            },
            remove: function() {
                if(this.shown) {
                    this.hide();
                }

                Base.prototype.remove.apply(this, arguments);

            },
            template: '\
                <div class="arrow"></div>\
                <div class="popdown-dialog-body popdown-dialog-padded"></div>\
            ',
            template_menu: '\
                <div class="arrow"></div>\
            '
        });
    }
);

define('contrib/text!views/shared/FieldInfo.html',[],function () { return '<% if (field) { %>\n    <a href="#" class="close"><i class="icon-close"></i></a>\n    <h2 class="field-info-header"><%- field.get(\'name\') %></h2>\n    <div class="divider"></div>\n    <% if (selectableFields) { %>\n        <div class="pull-right">\n            <label class="select-field-label"><%- _("Selected").t() %></label>\n            <div class="btn-group btn-group-radio">\n                <% var is_selected_field = selectedFields.findWhere({\'name\': field.get(\'name\')}); %>\n                <button class="btn select <%- is_selected_field ? \'active\' : \'\' %>" data-field-name="<%- field.get(\'name\') %>"><%- _("Yes").t() %></button>\n                <button class="btn unselect <%- is_selected_field ? \'\' : \'active\' %>" data-field-name="<%- field.get(\'name\') %>"><%- _("No").t() %></button>\n            </div>\n        </div>\n    <% } %>\n    <p><%- field.get("is_exact") ? "" : ">" %><%- field.get("distinct_count") %> <%- (field.get("distinct_count")>1) ?  _("Values").t(): _("Value").t() %>, <%= i18n.format_percent(summary.frequency(field.get(\'name\'))) %> <%- _("of events").t() %></p>\n    <h3 class="reports-header"><%- _("Reports").t() %></h3>\n    <table class="fields">\n        <tbody>\n            <% if (field.isNumeric()) { %>\n                <tr class="fields-numeric">\n                    <td><a href="#" data-visualization="line" data-report="avgbytime" data-field="<%- field.get(\'name\') %>"><%- _("Average over time").t() %></a></td>\n                    <td><a href="#" data-visualization="line" data-report="maxbytime" data-field="<%- field.get(\'name\') %>"><%- _("Maximum value over time").t() %></td>\n                    <td colspan="2"><a href="#" data-visualization="line" data-report="minbytime" data-field="<%- field.get(\'name\') %>"><%- _("Minimum value over time").t() %></td>\n                </tr>\n            <% } %>\n            <tr class="fields-values">\n                <td><a href="#" data-visualization="bar" data-report="top" data-field="<%- field.get(\'name\') %>"><%- _("Top values").t() %></a></td>\n                <td><a href="#" data-visualization="line" data-report="topbytime" data-field="<%- field.get(\'name\') %>"><%- _("Top values by time").t() %></td>\n                <td colspan="2"><a href="#" data-visualization="line" data-report="rare" data-field="<%- field.get(\'name\') %>"><%- _("Rare values").t() %></td>\n            </tr>\n            <tr class="fields-events">\n                <td colspan="4"><a href="#" data-report="fieldvalue" data-field="<%- field.get(\'name\') %>" data-field-value="*"><%- _("Events with this field").t() %></td>\n            </tr>\n            <% if (field.isNumeric()) { %>\n            <tr class="field-stats">\n                <td colspan="3">\n                    <ul class="field-stats inline">\n                        <li>\n                            <strong class="stats-label"><%- _("Avg").t() %>:</strong>\n                            <span class="val numeric"><%- field.get("mean") %></span>\n                        </li>\n                        <li>\n                            <strong class="stats-label"><%- _("Min").t() %>:</strong>\n                            <span class="val numeric"><%- field.get("min") %></span>\n                        </li>\n                        <li>\n                            <strong class="stats-label"><%- _("Max").t() %>:</strong>\n                            <span class="val numeric"><%- field.get("max") %></span>\n                        </li>\n                        <li>\n                            <strong class="stats-label"><%- _("Std").t() %>&nbsp;<%- _("Dev").t() %>:</strong>\n                            <span class="val numeric"><%- field.get("stdev") %></span>\n                        </li>\n                    </ul>\n                </td>\n            </tr>\n            <% } %>\n        </tbody>\n    </table>\n    <table class="table table-condensed table-dotted">\n        <thead>\n            <tr>\n            <% if (field.get(\'modes\').length >= 10) { %>\n                <th class="value"><strong><%- _("Top 10 Values").t() %></strong></th>\n            <% } else { %>\n                <th class="value"><strong><%- _("Values").t() %></strong></th>\n            <% } %>\n            <td class="count"><%- _("Count").t() %></td>\n                <td class="percent">%</td>\n                <td class="bar">&nbsp;</td>\n            </tr>\n        </thead>\n        <tbody>\n            <% var modes_len = field.get(\'modes\').length %>\n            <% _.each(field.get(\'modes\'), function(mode) { %>\n                <tr>\n                    <td class="value"><a href="#" data-report="fieldvalue" data-field="<%- field.get(\'name\') %>" data-value="<%- mode.value %>"><%- mode.value %></a></td>\n                    <td class="count"><%- format_decimal(mode.count || -1) %></td>\n                    <% percent = mode.count/field.get(\'count\') %>\n                    <td class="percent"><%- format_percent(percent) %></td>\n                    <% if (modes_len > 1) { %>\n                        <td class="bar">\n                            <div style="width:<%- Math.round(percent * 100) %>%;" class="graph-bar"></div>\n                        </td> \n                    <% } %>\n                </tr>\n            <% }); %>\n        </tbody>\n    </table>\n<% } %>\n';});

define('views/shared/FieldInfo',
    [
        'underscore',
        'module',
        'views/shared/PopTart',
        'splunk.i18n',
        'models/services/search/IntentionsParser',
        'contrib/text!views/shared/FieldInfo.html'
    ],
    function(
        _,
        module,
        PopTartView,
        i18n,
        IntentionsParser,
        template
    )
    {
        return PopTartView.extend({
            moduleId: module.id,
            /**
             * @param {Object} options {
             *      model: {
             *          field: <model.services.search.jobs.SummaryV2.fields.field[0]>,
             *          summary: <model.services.search.jobs.SummaryV2>,
             *          report: <models.services.SavedSearch>
             *      },
             *      collection: {
             *          selectedFields: <collections.SelectedFields>
             *      }
             *      selectableFields: true|false 
             * }
             */
            initialize: function() {
                PopTartView.prototype.initialize.apply(this, arguments);
                var defaults = {
                    selectableFields: true
                };
                this.options = $.extend(true, defaults, this.options);
                this.model.intentionsParser = new IntentionsParser();
                this.model.intentionsParser.on('change', function() {
                    this.hide();
                    var search = this.model.intentionsParser.fullSearch();
                    if (this.model.intentionsParser.has('visualization')) {
                        this.model.report.entry.content.set({
                            'search': search, 
                            'display.general.type': 'visualizations',
                            'display.visualizations.charting.chart': this.model.intentionsParser.get('visualization')
                        });
                    } else {
                        this.model.report.entry.content.set('search', search);
                    }
                    this.model.report.trigger('eventsviewer:drilldown');
                }, this);
                this.model.summary.fields.on('reset', this.render, this);
                this.collection.selectedFields.on('add remove reset', this.render, this);
                this.model.field.on('change', this.render, this);
            },
            events: {
                'click .unselect': function(e) {
                    this.collection.selectedFields.remove(
                        this.collection.selectedFields.findWhere({'name': $(e.currentTarget).attr('data-field-name')})
                    );
                    e.preventDefault();
                },
                'click .select': function(e) {
                    this.collection.selectedFields.push({'name': $(e.currentTarget).attr('data-field-name')}); 
                    e.preventDefault();
                },
                'click .close': function(e) {
                    this.hide(); 
                    e.preventDefault();
                },
                'click tr.fields-values > td > a[data-field]': function(e) {
                    var $target = $(e.currentTarget),
                        data = $target.data(),
                        field = data.field,
                        report = data.report;
                    this.model.intentionsParser.clear({silent: true});
                    this.model.intentionsParser.set({ 'visualization': data.visualization }, {silent: true});
                    this.model.intentionsParser.fetch({
                        data: {
                            q: this.model.report.entry.content.get('search'),
                            action: report,
                            field: field,
                            app: this.model.application.get('app'),
                            owner: this.model.application.get('owner')
                        }
                    });
                    e.preventDefault();
                },
                'click tr.fields-events > td > a[data-field]': function(e) {
                    var $target = $(e.currentTarget),
                        data = $target.data(),
                        field = data.field,
                        report = data.report;
                    this.model.intentionsParser.clear({silent: true});
                    this.model.intentionsParser.fetch({
                        data: {
                            q: this.model.report.entry.content.get('search'),
                            action: report,
                            field: field,
                            value: '*',
                            app: this.model.application.get('app'),
                            owner: this.model.application.get('owner')
                        }
                    });
                    e.preventDefault();
                },
                'click tr.fields-numeric > td > a[data-field]': function(e) {
                    var $target = $(e.currentTarget),
                        data = $target.data(),
                        field = data.field,
                        report = data.report;
                    this.model.intentionsParser.clear({silent: true});
                    this.model.intentionsParser.set({ 'visualization': data.visualization }, {silent: true});
                    this.model.intentionsParser.fetch({
                        data: {
                            q: this.model.report.entry.content.get('search'),
                            action: report,
                            field: field,
                            app: this.model.application.get('app'),
                            owner: this.model.application.get('owner')
                        }
                    });
                    e.preventDefault();
                },
                'click td.value > a': function(e) {
                    var $target = $(e.currentTarget),
                        data = $target.data();
                    this.model.intentionsParser.clear({silent: true});
                    this.model.intentionsParser.fetch({
                        data: {
                            q: this.model.report.entry.content.get('search'),
                            stripReportsSearch: false,
                            action: data.report,
                            field: data.field,
                            value: data.value,
                            app: this.model.application.get('app'),
                            owner: this.model.application.get('owner')
                        }
                    });
                    e.preventDefault();
                }
            },
            render: function() {
                var html = this.compiledTemplate({
                    field: this.model.summary.fields.findWhere({'name': this.model.field.get('name')}),
                    summary: this.model.summary,
                    selectedFields: this.collection.selectedFields,
                    i18n: i18n,
                    _:_,
                    selectableFields: this.options.selectableFields
                });
                this.$el.html(PopTartView.prototype.template);
                this.$('.popdown-dialog-body').html(html);
                return this;
            },
            template: template
        });
    }
);

define('views/shared/eventsviewer/shared/TagDialog',
    [
        'underscore',
        'module',
        'models/services/saved/FVTags',
        'views/shared/Modal',
        'views/shared/controls/ControlGroup',
        'views/shared/FlashMessages'
    ],
    function(_, module, FVTags, Modal, ControlGroup, FlashMessage) {
        return Modal.extend({
            moduleId: module.id,
           initialize: function() {
                Modal.prototype.initialize.apply(this, arguments);
                
                this.children.flashMessage = new FlashMessage({ model: this.model.tags });

                this.children.field = new ControlGroup({
                    className: 'field-value control-group',
                    controlType: 'Textarea',
                    controlOptions: {
                        modelAttribute: 'name',
                        model: this.model.tags.entry.content,
                        save: false,
                        placeholder: 'Optional',
                        enabled: false
                    },
                    label: _('Field Value').t()
                });

                this.children.tags = new ControlGroup({
                    className: 'tags control-group',
                    controlType: 'Textarea',
                    controlOptions: {
                        modelAttribute: 'ui.tags',
                        model: this.model.tags.entry.content,
                        save: false,
                        placeholder: ''
                    },
                    label: _('Tag(s)').t(),
                    help: _('Comma or space separated list of tags.').t()
                });
            },
            events: $.extend(true, {}, Modal.prototype.events, {
                'click .btn-primary': function(e) {
                    var data = this.model.application.getPermissions('private'),
                        tags = FVTags.tagStringtoArray(_.escape(this.model.tags.entry.content.get('ui.tags')));
                    
                    this.model.tags.resetTags(tags);
                    this.model.tags.entry.content.unset('ui.tags');
                    if(this.model.tags.id) {
                        data = {};
                        if (!tags.length) {
                            this.model.tags.destroy();
                            this.trigger('tags_saved');
                            this.hide();
                            e.preventDefault();
                            return;
                        }
                    }

                    this.model.tags.save({}, {
                        data:  data,
                        success: function(model, response) {
                            this.trigger('tags_saved');
                            this.hide();
                        }.bind(this)
                    });
                    e.preventDefault();
                }
            }),
            render: function() {
                this.$el.html(Modal.TEMPLATE);
                this.$(Modal.HEADER_TITLE_SELECTOR).html(_("Create Tags").t());
                this.children.flashMessage.render().prependTo(this.$(Modal.BODY_SELECTOR));
                this.$(Modal.BODY_SELECTOR).append(Modal.FORM_HORIZONTAL);
                this.children.field.render().appendTo(this.$(Modal.BODY_FORM_SELECTOR));
                this.children.tags.render().appendTo(this.$(Modal.BODY_FORM_SELECTOR));
                this.$(Modal.FOOTER_SELECTOR).append(Modal.BUTTON_CANCEL);
                this.$(Modal.FOOTER_SELECTOR).append(Modal.BUTTON_SAVE);
                return this;
            }
        }
    );
});


define('views/shared/eventsviewer/shared/WorkflowActions',
    [
        'jquery',
        'underscore',
        'module',
        'views/shared/PopTart',
        'models/services/saved/FVTags',
        'models/SplunkDBase',
        'views/shared/eventsviewer/shared/TagDialog',
        'util/general_utils',
        'splunk.util',
        'uri/route'
    ], 
    function($, _, module, PopTartView, FVTags, SplunkDModel, TagDialog, generalUtils, util, route) {
        return PopTartView.extend({
           /**
            * @param {Object} options {
            *      model: {
            *         application: <models.Application>,
            *         summary: <models.services.search.jobs.SummaryV2>
            *         field: <models.services.search.jobs.SummaryV2.fields[i]
            *     },
            *     collection: <collections.services.data.ui.WorkflowActions>
            * } 
            */
            className: 'dropdown-menu',
            moduleId: module.id,
            initialize: function(){
                PopTartView.prototype.initialize.apply(this, arguments);
                                
                if (this.options.field) {
                    this.fname = this.options.field.name;
                    this.fvalue = this.options.field.value;
                }

                this.model.tags = new FVTags();
                
                this.actions = this.collection[ 
                    this.isFieldAction() ? 'getFieldActions' : 'getEventActions' 
                ](this.model.event, this.fname);
            },
            isFieldAction: function() {
                return (this.fname && this.fvalue);
            },
            events: $.extend(true, {}, PopTartView.prototype.events, {
                'click a.actions': function(e) {
                    var data = $(e.target).data();

                    this[data.type](this.getTransformedAttrs(this.collection.at(data.idx)), data.target);

                    e.preventDefault();

                },
                'click a.edit-tag': function(e) {
                    e.preventDefault();
                    
                    this.model.tags.entry.content.set('name', this.fname + '=' + this.fvalue);

                    this.children.tagDialog = new TagDialog({
                        model: {
                            tags: this.model.tags,
                            application: this.model.application
                        },
                        onHiddenRemove: true
                    });
                    
                    this.children.tagDialog.on('tags_saved', function() {
                        this.model.result.setTagsSynthetically(this.fname, this.fvalue, this.model.tags.entry.content.get('tags'));
                    },this);

                    this.model.tags.setId(
                        this.model.application.get('app'),
                        this.model.application.get('owner'),
                        this.fname, this.fvalue
                    );

                    this.model.clonedTags = new SplunkDModel();
                    this.model.clonedTags.setFromSplunkD(this.model.tags.toSplunkD());
                    this.model.clonedTags.id = this.model.tags.id;
                    this.model.clonedTags.fetch({
                        success: function() {
                            this.children.tagDialog.render().appendTo($("body"));
                            this.model.tags.setFromSplunkD(this.model.clonedTags.toSplunkD());
                            this.model.tags.entry.content.set('ui.tags',FVTags.tagArraytoString(this.model.tags.entry.content.get('tags')));
                            this.children.tagDialog.show();
                        }.bind(this),
                        error: function() {
                            this.children.tagDialog.render().appendTo($("body"));
                            this.model.tags.setFromSplunkD(this.model.clonedTags.toSplunkD());
                            this.model.tags.unset('id');
                            this.children.tagDialog.show();
                        }.bind(this)
                    });
                }
            }),
            uri: function(uri) {
                if(uri.indexOf('/') === 0) {
                    return route.encodeRoot(this.model.application.get('root'), this.model.application.get('locale')) + uri;
                }
                return uri;
            },
            link: function(content, target) {
                var uri = this.uri(content['link.uri']);
                if (content['link.method'].toLowerCase() === 'get') {
                    if(content['link.target'] === 'self') {
                        window.location.href = uri;
                    } else {
                        window.open(uri, '_blank');
                    }
                    return true;
                }
                var $form = $('<form class="workflow-action"/>');
                $form.attr('target', target);
                $form.attr('action', uri);
                $form.attr('method', 'post');
                _(generalUtils.filterObjectByRegexes(content, /^link\.postargs\.\d\..*/)).each(function(v, k) {
                    $form.append($('<input/>').attr({
                        'type': 'hidden',
                        'name': k.replace(/^link\.postargs\.\d\./, ''),
                        'value': v
                    }));  
                }, this);
                $('body').append($form);
                $('form.workflow-action').submit().remove();
                return false;
            },
            search: function(content, target){
                var options = {data: {}};
                if (util.normalizeBoolean(content['search.preserve_timerange'])) {
                    if(this.model.report.entry.content.get('dispatch.earliest_time'))
                        options.data.earliest = this.model.report.entry.content.get('dispatch.earliest_time');
                    if(this.model.report.entry.content.get('dispatchu.latest_time'))
                        options.data.latest = this.model.report.entry.content.get('dispatch.latest_time');
                } 
                if (content['search.earliest'] || content['search.latest']) {
                    options.data.earliest = content['search.earliest'];
                    options.data.latest = content['search.latest'];
                }
                options.data.q = content['search.search_string'];
                
                var url = route.page(
                    this.model.application.get('root'),
                    this.model.application.get('locale'),  
                    content['eai:appName'], 
                    this.model.application.get('page'),
                    options
                );

                (target === '_self') ? (window.location.href = url): window.open(url, '_blank');
                return false;
            },    
            getTransformedAttrs: function(model) {
                var obj = {},
                    key = '',
                    content = model.entry.content.toJSON(),
                    sid = this.model.searchJob.get('id'),
                    eventSorting = this.model.searchJob.entry.content.get('eventSorting'),
                    offset = this.model.result.offset(this.model.result.results.indexOf(this.model.event)),
                    namespace = this.model.application.get('app'),
                    latest_time = this.model.report.entry.content.get('display.events.timelineLatestTime');

                _.each(content, function(value, key) {
                    if (typeof value == 'string') {
                        var systemSubstitute = model.systemSubstitute(
                            value, 
                            sid, 
                            offset, 
                            namespace, 
                            latest_time, 
                            this.fname, 
                            this.fvalue
                        );
                        obj[key] = model.fieldSubstitute(systemSubstitute, this.model.event.toJSON());
                    } else {
                        obj[key] = value;
                    }
                }, this);
                                                
                return obj;
            },
            render: function() {
                this.el.innerHTML = PopTartView.prototype.template_menu;
                this.$el.append(this.compiledTemplate({ 
                    getTransformedAttrs: this.getTransformedAttrs,
                    isFieldAction: this.isFieldAction(),
                    actions: this.actions,
                    collection: this.collection,
                    trim: util.smartTrim,
                    that: this, 
                    _:_
                }));
                return this;
            },
            template: '\
                <ul>\
                    <% if (isFieldAction) { %>\
                        <li>\
                            <a href="#" class="edit-tag"><%- _("Edit Tags").t() %></a>\
                        </li>\
                    <% } %>\
                    <% var i = 0, len = actions.length %>\
                    <% for(i; i<len; i++) { %>\
                        <% var attrs = getTransformedAttrs.call(that, collection.at(actions[i])); %>\
                        <li>\
                            <a class="actions" href="#" data-target="<%- "_"+(attrs["link.target"] || attrs["search.target"]) %>" data-idx="<%- that.actions[i] %>" data-type="<%-attrs["type"] %>"><%- trim(attrs["label"], 100) %></a>\
                        </li>\
                    <% } %>\
                </ul>\
            '
        });
    }
);


define('views/shared/eventsviewer/shared/TimeInfo',
    [
        'underscore',
        'jquery',
        'module',
        'util/time',
        'splunk.util',
        'views/shared/PopTart',
        'strftime'
    ],
    function(_, $, module, timeutils, splunkutils, PopTartView) {
        return PopTartView.extend({
            moduleId: module.id,
            /**
             * @param {Object} options {
             *     model: {
             *          report: <models.services.SavedSearch>,
             *     }
             * }
             */
            initialize: function() {
                PopTartView.prototype.initialize.apply(this, arguments);
            },
            events: {
                'click td > a.et-lt': function(e) {
                    var $target = $(e.currentTarget),
                        timebounds = $target.data().time;
                    if(timebounds === 'before'){
                        this.model.report.entry.content.set('dispatch.latest_time', this.options.time);
                    } else if (timebounds == 'after') {
                        this.model.report.entry.content.set('dispatch.earliest_time', this.options.time);  
                    } else {
                        var et = parseFloat(splunkutils.getEpochTimeFromISO(this.options.time)), //inclusive
                            lt = et + 0.001; //exclusive
                        this.model.report.entry.content.set({
                            'dispatch.latest_time': lt,
                            'dispatch.earliest_time': et
                        });  
                    }
                    this.model.report.trigger('eventsviewer:drilldown');
                    e.preventDefault();
                },
                'click td > a.time-range': function(e) {
                    var $target = $(e.currentTarget),
                        ranges  = timeutils.rangeFromIsoAndOffset(this.options.time, $target.data().timeUnit);
                    this.model.report.entry.content.set({
                        'dispatch.latest_time': ranges.upperRange.strftime("%s.%Q"),
                        'dispatch.earliest_time': ranges.lowerRange.strftime("%s.%Q")
                    });  
                    this.model.report.trigger('eventsviewer:drilldown');
                    e.preventDefault();
                }
            },
            render: function() {
                this.$el.html(PopTartView.prototype.template);
                this.$('.popdown-dialog-body').html(this.compiledTemplate({_:_}));
                return this;
            },
            template: '\
                <h3>_time</h3>\
                <table>\
                    <thead>\
                        <tr><th><%- _("Events Before or After").t() %></th><th><%- _("Nearby Events").t() %></th></tr>\
                    </thead>\
                    <tbody>\
                        <tr>\
                            <td>\
                                <a class="et-lt" data-time="before" href="#"><%- _("Before this time").t() %></a><br>\
                                <a class="et-lt" data-time="after" href="#"><%- _("After this time").t() %></a><br>\
                                <a class="et-lt" data-time="at" href="#"><%- _("At this time").t() %></a><br>\
                            </td>\
                            <td>\
                                <a class="time-range" data-time-unit="w" href="#"><%- _("+/- 1 week").t() %></a><br>\
                                <a class="time-range" data-time-unit="d" href="#"><%- _("+/- 1 day").t() %></a><br>\
                                <a class="time-range" data-time-unit="h" href="#"><%- _("+/- 1 hour").t() %></a><br>\
                                <a class="time-range" data-time-unit="m" href="#"><%- _("+/- 1 minute").t() %></a><br>\
                                <a class="time-range" data-time-unit="s" href="#"><%- _("+/- 1 second").t() %></a><br>\
                                <a class="time-range" data-time-unit="ms" href="#"><%- _("+/- 1 milliseconds").t() %></a><br>\
                            </td>\
                        </tr>\
                    </tbody>\
                </table>\
            '
        });
    }
);

define('views/shared/eventsviewer/shared/BaseFields',
    [
        'jquery',
        'underscore',
        'backbone',
        'module',
        'keyboard/SearchModifier',
        'views/Base',
        'views/shared/FieldInfo',
        'views/shared/eventsviewer/shared/WorkflowActions',
        'views/shared/eventsviewer/shared/TimeInfo'
    ],
    function(
        $,
        _,
        Backbone,
        module,
        KeyboardSearchModifier,
        BaseView,
        FieldInfo,
        WorkflowActionsView,
        TimeInfoView
    ){
        return BaseView.extend({
            /**
             * @param {Object} options {
             *      model: {
             *         event: <models.services.search.job.ResultsV2.result[i]>,
             *         summary: <model.services.search.job.SummaryV2>,
             *         application: <model.Application>,
             *         report: <models.services.SavedSearch>,
             *         searchJob: <models.Job>
             *     }
             *     collection: {
             *         selectedFields: <collections.SelectedFields>
             *         workflowActions: <collections.services.data.ui.WorkflowActions>
             *     },
             *     selectableFields: true|false
             * }
             */
            initialize: function(){
                BaseView.prototype.initialize.apply(this, arguments);
                this.rowExpanded = 'r' + this.options.idx;
                this.keyboardSearchModifier = new KeyboardSearchModifier();
            },
            startListening: function() {
                this.listenTo(this.model.event, 'change', this.render);

                this.listenTo(this.collection.selectedFields, 'reset add remove', function() {
                    if (this.model.state.get(this.rowExpanded)) {
                        this.render(); 
                    }
                });              
            },
            events: {
                'click .field-value a.f-v': function(e) {
                    e.preventDefault();
                    this.drilldown($(e.target), e);
                },
                'click .tag': function(e) { 
                    e.preventDefault();
                    this.drilldown($(e.target), e, true);
                },
                'click .field-value .tag': function(e) {
                    e.preventDefault();
                    this.drilldown($(e.target), e, true);
                },
                'click ._time': function(e) {
                    e.preventDefault();
                },
                'click .field-info': function(e) {
                    e.preventDefault();
                },
                'click .field-actions': function(e) {
                    e.preventDefault();
                },
                'click .event-actions': function(e) {
                    e.preventDefault();
                },
                'mousedown ._time': 'openTimeInfo',
                'mousedown .field-info': 'openFieldInfo',
                'mousedown .field-actions': 'openFieldActions',
                'mousedown .event-actions': 'openEventActions',
                'keydown ._time': function(e) {
                    if (e.keyCode == 13)  {
                        this.openTimeInfo(e);
                    }
                },
                'keydown .field-info': function(e) {
                    if (e.keyCode == 13)  {
                        this.openFieldInfo(e);
                    }
                },
                'keydown .field-actions': function(e) {
                    if (e.keyCode == 13)  {
                        this.openFieldActions(e);
                    }
                },
                'keydown .event-actions': function(e) {
                    if (e.keyCode == 13)  {
                        this.openEventActions(e);
                    }
                }
            },
            drilldown: function($target, e, tagclick) {
                var data = $target.data(),
                    value = $.trim($target.text()),
                    field = $.trim(data.taggedFieldName || data.fieldName);

                this.model.state.trigger('drilldown', $.extend(true, {}, {
                    data: {
                        q: (tagclick) ? 
                            this.model.searchJob.getStrippedEventSearch():
                            this.model.report.entry.content.get('search'),
                        stripReportsSearch: tagclick,
                        action: 'fieldvalue',
                        field: field,
                        negate: this.keyboardSearchModifier.isNegation(e),
                        value: value,
                        app: this.model.application.get('app'),
                        owner: this.model.application.get('owner')
                    },
                    event: e,
                    idx: this.options.idx
                }));
            },
            openTimeInfo: function(e) {
                var $target = $(e.currentTarget),
                    time = $target.data().time;
                    
                if (this.children.time && this.children.time.shown) {
                    this.children.time.hide();
                }
                
                this.children.time = new TimeInfoView({
                    model: {
                        report: this.model.report
                    },
                    time: time,
                    onHiddenRemove: true
                });

                this.children.time.render().appendTo($('body')).show($target);
                e.preventDefault();
            },
            openFieldInfo: function(e) {
                var $target = $(e.currentTarget);
                var field = this.model.summary.fields.findWhere({'name': $target.attr('data-field-name') });
                var fieldName = field.get('name');
                
                if (this.children.fieldInfo && this.children.fieldInfo.shown) {
                    this.children.fieldInfo.hide();
                    if(this.lastMenu == (fieldName+'-field-info'))
                        return true;
                }
                
                if (!field) {
                    alert(_("This event is no longer within the results window.").t());
                }
                
                this.children.fieldInfo = new FieldInfo({
                    model: {
                        field: field,
                        summary: this.model.summary,
                        report: this.model.report,
                        application: this.model.application
                    },
                    collection: {selectedFields: this.collection.selectedFields},
                    onHiddenRemove: true,
                    selectableFields: this.options.selectableFields
                });
                this.lastMenu = fieldName + "-field-info";
                if(!_.isNumber(this.model.state.get('modalize'))){
                    this.model.state.set({
                        'modalize': this.options.idx,
                        'sleep': true
                    });
                }

                this.children.fieldInfo.render().appendTo($('body')).show($target);
                e.preventDefault();
            },
            openFieldActions: function(e) {
                var $target = $(e.currentTarget),
                    fieldName = $target.attr('data-field-name'),
                    fieldValue = $.trim($target.closest('tr').find('.f-v').text());
                
                if (this.children.fieldActions && this.children.fieldActions.shown) {
                    this.children.fieldActions.hide();
                    if(this.lastMenu == (fieldName+'-field-actions'))
                        return true;
                }
                
                this.children.fieldActions = new WorkflowActionsView({
                    model: this.model,
                    collection: this.collection.workflowActions,
                    field: { 'name': fieldName, 'value': fieldValue },
                    mode: 'menu'
                });

                this.lastMenu = fieldName + "-field-actions";
                if(!_.isNumber(this.model.state.get('modalize'))){
                    this.model.state.set({
                        'modalize': this.options.idx,
                        'sleep': true
                    });
                }

                this.children.fieldActions.render().appendTo($('body')).show($target);
                e.preventDefault();
            },
            openEventActions: function(e) {
                var $target = $(e.currentTarget); 
                if (this.children.eventActions && this.children.eventActions.shown) {
                    this.children.eventActions.hide();
                    return true;
                }

                this.children.eventActions = new WorkflowActionsView({
                    model: this.model,
                    collection: this.collection.workflowActions,
                    mode: 'menu',
                    onHiddenRemove: true
                });
                
                this.children.eventActions.render().appendTo($('body')).show($target);
                e.preventDefault();
            },
            _partial: _.template('\
                <%  _(fields).each(function(field, i) { %>\
                    <% var fieldlist = m.get(field) %>\
                    <% if(fieldlist.length > 1){ %>\
                        <%  _(fieldlist).each(function(mv_field, j) { %>\
                            <tr>\
                               <% if(i==0 && j==0 && label) { %>\
                                   <td rowspan="<%= m.getFieldsLength(fields) %>" class="field-type"><%- label %></td>\
                               <% } %>\
                               <% if(selectableFields && j==0) { %>\
                                   <td rowspan="<%= fieldlist.length %>" class="col-visibility"><label class="checkbox">\
                                   <a href="#" data-name="Everyone.read" class="btn <%- iconVisibility ? "hide" : "show" %>-field">\
                                   <% if(iconVisibility) { %>\
                                    <i class="icon-check"></i>\
                                    <% } %>\
                                   </label></td>\
                               <% } %>\
                               <% if(j==0 && slen>0) {%>\
                                    <td rowspan="<%=fieldlist.length %>" class="field-key">\
                                        <a class="popdown-toggle field-info" href="#" data-field-name="<%- field %>">\
                                            <span><%- field %></span><span class="caret"></span>\
                                        </a>\
                                    </td>\
                               <% } else if(j==0 && slen==0) { %>\
                                    <td rowspan="<%=fieldlist.length %>" class="field-key">\
                                        <span  data-field-name="<%- field %>"><%- field %></span>\
                                    </td>\
                               <% } %>\
                               <td class="field-value">\
                                   <a data-field-name="<%- field %>"  class="f-v" href="#"><%- mv_field %></a>\
                                   <% var tags = r.getTags(field, mv_field); %>\
                                   <% if (tags.length) { %>\
                                       (<% _(tags).each(function(tag, idx){ %><a data-tagged-field-name="tag::<%- field %>" class="tag" href="#"><%- tag %><%if(idx!=tags.length-1){%> <%}%></a><% }); %>)\
                                   <% } %>\
                               </td>\
                               <td  class="actions popdown">\
                                       <a class="popdown-toggle field-actions" href="#" data-field-name="<%- field %>">\
                                           <span class="caret"></span>\
                                       </a>\
                               </td>\
                            </tr>\
                        <% }) %>\
                    <% } else { %>\
                        <tr>\
                           <% if(i==0 && label) { %>\
                               <td rowspan="<%= m.getFieldsLength(fields) %>" class="field-type"><%- label %></td>\
                           <% } %>\
                           <% if(selectableFields) { %>\
                               <td rowspan="<%= fieldlist.length %>" class="col-visibility"><label class="checkbox">\
                               <a href="#" data-name="Everyone.read" class="btn <%- iconVisibility ? "hide" : "show" %>-field">\
                               <% if(iconVisibility) { %>\
                                <i class="icon-check"></i>\
                                <% } %>\
                               </a></label></td>\
                           <% } %>\
                           <% if(slen >0) { %>\
                               <td class="field-key">\
                                   <a class="popdown-toggle field-info" href="#" data-field-name="<%- field %>">\
                                       <span><%- field %></span><span class="caret"></span>\
                                   </a>\
                               </td>\
                           <% } else { %>\
                                <td class="field-key">\
                                    <span  data-field-name="<%- field %>"><%- field %></span>\
                                </td>\
                           <% } %>\
                           <td class="field-value">\
                               <a data-field-name="<%- field %>"  class="f-v" href="#"><%- m.get(field)[0] %></a>\
                               <% var tags = r.getTags(field, m.get(field)); %>\
                               <% if (tags.length > 0) { %>\
                                   (<% _(tags).each(function(tag, idx){ %><a data-field-name="<%- field %>" data-tagged-field-name="tag::<%- field %>" class="tag" href="#"><%- tag %><%if(idx!=tags.length-1){%> <%}%></a><% }); %>)\
                               <% } %>\
                           </td>\
                           <td  class="actions">\
                                   <a class="popdown-toggle field-actions" href="#" data-field-name="<%- field %>">\
                                       <i class="icon-chevron-down"></i>\
                                   </a>\
                           </td>\
                       </tr>\
                   <% } %>\
               <% }); %>\
           ')
        });
    }
);

define('views/shared/eventsviewer/list/body/row/SelectedFields',
    [
        'jquery',
        'underscore',
        'backbone',
        'module',
        'views/shared/eventsviewer/shared/BaseFields'
    ],
    function($, _, Backbone, module, BaseFields){
        return BaseFields.extend({
            moduleId: module.id,
            /**
             * @param {Object} options {
             *      model: {
             *         event: <models.services.search.job.ResultsV2.results[i]>,
             *     },
             *     collection: {
             *         selectedFields: <collections.SelectedFields>
             *     },
             *     selectableFields: true|false
             */
            initialize: function(){
                BaseFields.prototype.initialize.apply(this, arguments);
                this.rowExpanded = this.options.rowExpanded;
            },
            startListening: function() {
                this.listenTo(this.collection.selectedFields, 'add remove reset', function() {
                    if(this.model.state.get(this.rowExpanded)) { 
                        this.render(); 
                    }
                });
            },
            render: function() {
                var strippedfields = this.model.event.strip(),
                    selectedfields = _.intersection(strippedfields, this.collection.selectedFields.pluck('name')).sort();
                this.$el.html(this.compiledTemplate({
                    selectedfields: selectedfields,
                    m: this.model.event,
                    r: this.model.result,
                    selected: selectedfields.length,
                    _:_
                }));                
                return this;
            },
            template: '\
                <% if (selected) { %>\
                    <ul class="condensed-selected-fields">\
                    <%  _(selectedfields).each(function(field, i) { %>\
                        <% var values = m.get(field) %>\
                        <li>\
                            <% _(values).each(function(value, idx) { %>\
                                <span class="field"><%- field %> =</span>\
                                <span class="field-value"><a class="f-v" data-field-name="<%-field %>" title="<%= value ? value : "&nbsp;"%>"><% if(value) {%><%- value %><% } else { %>&nbsp;<% } %></a></span>\
                                <% var tags = r.getTags(field, value); %>\
                                <% if (tags.length) { %>\
                                      <% _(tags).each(function(tag, idx){ %><a data-tagged-field-name="tag::<%- field %>" class="tag" href="#"><%- tag %>\
                                            <%if(idx!=tags.length-1){%> <%}%>\
                                        </a><% }); %>\
                                <% } %>\
                            <% }) %>\
                        </li>\
                    <% }) %>\
                  </ul>\
                <% } %>\
           '
        });
    }
);

define('views/shared/eventsviewer/shared/EventFields',
    [
        'jquery',
        'underscore',
        'backbone',
        'module',
        'views/shared/eventsviewer/shared/BaseFields'
    ],
    function(
        $,
        _,
        Backbone,
        module,
        FieldsView
     ){
        return FieldsView.extend({
            moduleId: module.id,
            /**
             * @param {Object} options {
             *      model: {
             *         event: <models.services.search.job.ResultsV2.result[i]>,
             *         summary: <model.services.search.job.SummaryV2>,
             *         application: <model.Application>,
             *         searchJob: <models.Job>
             *     }
             *     collection: {
             *         selectedFields: <collections.SelectedFields>
             *     },
             *     selectableFields: true|false,
             *     swappingKey: The swap key to observe a loading event on
             * }
             */
            initialize: function(){
                FieldsView.prototype.initialize.apply(this, arguments);
                this.swappingKey  = this.options.swappingKey;
                this.showAllLines = this.options.showAllLines;
                this.rowExpanded  = 'r' + this.options.idx;
            },
            startListening: function() {
                FieldsView.prototype.startListening.apply(this, arguments);
                
                this.listenTo(this.model.event, 'change', function(model, options) {
                    if (options.swap) {
                        this.isSwapping = false;
                    }
                    this.render();
                });
                
                this.listenTo(this.model.result, 'tags-updated', this.render);
                
                this.listenTo(this.model.event, 'failed-swap', function() {
                    this.$('.event-fields-loading').text(_('We were unable to provide the correct event').t());
                });

                this.listenTo(this.model.state, 'change:timeExpanded', this.render);
                
                this.listenTo(this.model.state, 'change:' + this.showAllLines, function() { this.isSwapping = true; });
                this.listenTo(this.model.state, 'unmodalize' + this.options.idx, function() { this.isSwapping = true; });
                this.listenTo(this.model.result, this.swappingKey, function() { this.isSwapping = true; });                
            },
            activate: function(options) {
                if (this.active) {
                    return FieldsView.prototype.activate.apply(this, arguments);
                }
                this.isSwapping = true;                
                return FieldsView.prototype.activate.apply(this, arguments);
            },
            events: $.extend({}, FieldsView.prototype.events, {
                'click ._time-expand' : function(e) {
                    this.model.state.set('timeExpanded', !this.model.state.get('timeExpanded'));
                    e.preventDefault();
                },
                'click a.show-field': function(e) {
                   var $eye = $(e.currentTarget),
                       fieldName = $.trim($eye.closest('td').siblings('.field-key').text());
                   this.collection.selectedFields.push({ 'name': fieldName });
                   e.preventDefault();
                },
                'click a.hide-field': function(e) {
                   var $eye = $(e.currentTarget),
                        fieldName = $.trim($eye.closest('td').siblings('.field-key').text());
                    this.collection.selectedFields.remove(this.collection.selectedFields.find(function(model) {
                        return model.get('name')===fieldName;
                    }, this));
                    e.preventDefault();
                },
                'click a.btn.disabled': function(e) {
                    e.preventDefault();
                },

                /*
                * For 508 compliance we will refocus the user on the first tabbable 
                * element in the event fields (implementing circular tabbing) when 
                * they tab out of the last tabbable elem. 
                */
                'keydown td.actions:last': function(e) {
                    if(!e.shiftKey && e.keyCode === 9) {
                        e.preventDefault();
                        this.$el.parent().find('a.event-actions').focus();
                    }
                },
                'keydown': function(e) {
                    if(e.keyCode === 27) {
                        e.preventDefault();
                        this.model.state.set(this.rowExpanded, false);
                    }
                }
            }),
            setMaxWidth: function() {
                if (!this.el.innerHTML || !this.$el.is(":visible")) {
                    return false;
                }
            
                var $stylesheet =  $("#"+this.cid+"-styles");
                $stylesheet && $stylesheet.remove();
                
                var $wrapper = this.$el.closest('table').parent(),
                    wrapperWidth=$wrapper.width(),
                    wrapperLeft=$wrapper.offset().left - $wrapper.scrollLeft(),
                    margin=20,
                    elLeft=this.$el.offset().left,
                    maxWidth= wrapperWidth - (elLeft - wrapperLeft) - margin,
                    maxWidthPx = (maxWidth > 500? maxWidth : 500) + "px";
                
                this.$('table').css('maxWidth', maxWidthPx);
            },
            reflow: function() {
                this.setMaxWidth();
            },
            render: function() {
                var strippedfields = this.model.event.strip(),
                    selectedfields = _.intersection(strippedfields, this.collection.selectedFields.pluck('name')).sort(),
                    eventfields = _.difference(_.intersection(strippedfields, this.model.event.notSystemOrTime()), selectedfields).sort(),
                    timefields = _.difference(this.model.event.time(), selectedfields).sort(),
                    timefieldsNoTime = _.difference(timefields, ['_time']),
                    systemfields = _.difference(this.model.event.system(), selectedfields).sort();
                                
                this.$el.html(this.compiledTemplate({
                    selectedfields: selectedfields,
                    eventfields: eventfields,
                    timefields: (this.model.state.get('timeExpanded')) ? timefieldsNoTime : [],
                    systemfields: systemfields,
                    expanded: (timefields.length === 1) ? '': (this.model.state.get('timeExpanded') ? 'icon-minus-circle': 'icon-plus-circle'),
                    selectableFields: this.options.selectableFields,
                    hideEventActions: (this.model.searchJob.isRealtime()),
                    r: this.model.result,
                    m: this.model.event,
                    mTime: this.model.event.get('_time'),
                    slen: this.model.summary.fields.length,
                    _partial: this._partial,
                    isSwapping: false,
                    _:_
                }));
                this.setMaxWidth();
                return this;
            },
            template:'\
                <% if (!isSwapping) { %>\
                    <% if (!hideEventActions) { %>\
                        <a class="btn popdown-toggle event-actions" href="#"><span><%-_("Event Actions").t()%></span><span class="caret"></span></a>\
                    <% } %>\
                    <table class="table table-condensed table-embed table-expanded table-dotted">\
                        <thead>\
                            <th class="col-field-type"><%- _("Type").t() %></th>\
                            <% if(selectableFields){ %> <th class="col-visibility"><label class="checkbox"><a href="#" class="btn disabled"><i class="icon-check"></i></a></label></th><% } %>\
                            <th class="col-field-name"><%- _("Field").t() %></th>\
                            <th class="col-field-value"><%- _("Value").t() %></th>\
                            <th class="col-field-action"><%- _("Actions").t() %></th>\
                        </thead>\
                        <tbody>\
                        <%= _partial({fields: selectedfields, slen: slen, iconVisibility: true, m: m, r:r, label: _("Selected").t(), selectableFields: selectableFields}) %>\
                        <%= _partial({fields: eventfields, slen: slen, iconVisibility: false, m: m, r:r, label: _("Event").t(), selectableFields: selectableFields}) %>\
                        <% if (mTime) { %>\
                            <tr>\
                                <td rowspan="<%- timefields.length+1 %>" class="field-type"><%- _("Time").t() %><a class="_time-expand <%= expanded %>" href=""></a></td>\
                                <% if (selectableFields) { %>\
                                    <td></td>\
                                <% } %>\
                               <td class="time">\
                                   <a class="popdown-toggle _time" href="#" data-time="<%- mTime[0] %>">\
                                       <span>_time</span><span class="caret"></span>\
                                   </a>\
                               </td>\
                               <td class="field-value f-v"><%- mTime[0] %>\
                                   <% var tags = r.getTags("_time", mTime); %>\
                                   <% if (tags.length > 0) { %>(<% _(tags).each(function(tag, idx){ %><a data-field-name="_time" data-tagged-field-name="tag::_time" class="tag" href="#"><%- tag %><%if(idx!=tags.length-1){%> <%}%></a><% }); %>)<% } %>\
                               </td>\
                               <td class="actions"></td>\
                            </tr>\
                        <% } %>\
                        <%= _partial({fields: timefields, slen: slen, iconVisibility: false, m: m, r:r, label: null, selectableFields: selectableFields}) %>\
                        <%= _partial({fields: systemfields, slen: slen, iconVisibility: false, m: m, r:r, label: _("Default").t(), selectableFields: selectableFields}) %>\
                        </tbody>\
                    </table>\
                <% } else { %>\
                    <div class="event-fields-loading">Loading...</div>\
                <% } %>\
            '
        });
    }
);

define('views/shared/JSONTree',
    [
        'jquery',
        'underscore',
        'module',
        'views/Base'
    ],
    function($, _, module, BaseView) {
        return BaseView.extend({
            moduleId: module.id,
            className: "json-tree",
            /**
             * @param {Object} options {
             *     json: <json stringified object>
             *     isValidJSON: <a flag allowing opt-out of safe set json routine>
             */
            initialize: function() {
                BaseView.prototype.initialize.apply(this, arguments);
                
                var defaults = {
                        isValidJSON: false,
                        json: '{}'
                };
                this.options = $.extend(true, defaults, this.options);

                if(this.options.isValidJSON) {
                    this._json = this.options.json;
                } else {
                    this.setJSON(this.options.json);
                }
            },
            setJSON: function(json) {
                var parsed;

                if(typeof json !== 'string') {
                    json = JSON.stringify(json);
                } 

                try{
                    parsed = JSON.parse(json);
                } catch(e) {}
                
                this._json = parsed;
            }, 
            isValidJSON: function() {
                return !!this._json;
            },
            events: {
                'click .jsexpands': function(e) {
                    var $target = $(e.currentTarget);
                    this.trigger('interaction');
                    this.interacted = true;
                    $target.removeClass('jsexpands').addClass('jscollapse').text('[-]').next().show();
                    e.preventDefault();
                },
                'click .jscollapse': function(e) {
                    var $target = $(e.currentTarget);
                    this.trigger('interaction');
                    this.interacted = true;
                    $target.removeClass('jscollapse').addClass('jsexpands').text('[+]').next().hide();
                    e.preventDefault();
                }
            },
            render: function() {
                if(!this.interacted) {
                    this.$el.html(this.compiledTemplate({ 
                        obj: this._json,
                        indent: 0,
                        template: this.compiledTemplate,
                        _: _
                    }));
 
                }
                return this;
            },
            template: '\
                <% var indent = indent + 2; %>\
                <% var level  = indent/2; %>\
                <% var type   = (obj === null) ? "null": typeof obj; %>\
                \
                <% if(!_.isObject(obj)) { %>\
                    <span class="t <%- type %>"><%- obj || "null" %></span>\
                <% } else { %>\
                    <% var isObj = !(obj instanceof Array) %>\
                    <% var list  = (isObj) ? _.keys(obj).sort() : obj.sort(); %>\
                    <span><%if(isObj) { %>{<% } else { %>[<% } %></span>\
                    \
                    <% if (list.length > 0) { %>\
                        <% if(!(level < 2)) { %>\
                            <a class="jsexpands">[+]</a>\
                        <% } else { %>\
                            <a class="jscollapse">[-]</a>\
                        <% } %>\
                    <% } %>\
                    \
                    <% if (level != 1) { %>\
                        <span style="display: none;">\
                    <% } else { %>\
                        <span>\
                    <% } %>\
                    \
                    <% var i = 0; %>\
                    <% for(; i<list.length; i++){ %>\
                        <br><% for(var j=0; j<indent; j++){ %>&nbsp;<% } %>\
                        <% if(isObj) { %>\
                            <span class="key level-<%-level%>">\
                                <span class="key-name"><%-list[i]%></span>:\
                                <%= template({ obj:obj[list[i]], indent: indent, template: template, _:_}) %>\
                            </span>\
                        <% } else { %>\
                            <%= template({ obj:list[i], indent: indent, template: template, _:_}) %>\
                        <% } %>\
                    <% } %>\
                    </span><br>\
                    <span>\
                        <% for(var j=0; j<indent-2; j++){ %>&nbsp;<% } %>\
                        <% if(isObj){ %><span>}</span><% } else { %><span>]</span><%}%>\
                    </span>\
                \
                <% } %>\
                \
            '
        });
    }
 );

 define('views/shared/eventsviewer/shared/RawField',
    [
        'underscore',
        'module',
        'keyboard/SearchModifier',
        'splunk.util', 
        'views/Base',
        'views/shared/JSONTree'
    ],
    function(_, module, KeyboardSearchModifier, util, BaseView, JSONTree){
        return BaseView.extend({
            decorations: {
                'decoration_audit_valid': {"msg": "Valid", "label": "label-success", "icon": "icon-check-circle"} ,
                'decoration_audit_gap': {"msg": "Gap", "label": "label-warning", "icon": "icon-minus-circle"} ,
                'decoration_audit_tampered': {"msg": "Tampered!", "label": "label-important", "icon": "icon-alert-circle"} ,
                'decoration_audit_cantvalidate': {"msg": "Can't validate!", "label": "label-info", "icon": "icon-question-circle" }
            },
            moduleId: module.id,
            tagName: 'div',
            /**
             * @param {Object} options {
             *     model: {
             *         event: <models.services.search.job.ResultsV2.results[i]>,
             *         result: <models.services.search.job.ResultsV2,
             *         report: <models.services.SavedSearch>,
             *         state: <models.Base>,
             *         searchJob: <models.Job>
             *     },
             *     collection: {
             *         eventRenderers: <collections.services.configs.EventRenderers>
             *     }
             */
            initialize: function(){
                BaseView.prototype.initialize.apply(this, arguments);
                this.keyboardSearchModifier = new KeyboardSearchModifier();
                
                this.options = $.extend(true, { segmentation: true }, this.options);

                this.interaction       = 'i' + this.options.idx;
                this.showFormattedJSON = 'j' + this.options.idx;
                this.showAllLines      = 's' + this.options.idx;

                this.children.json = new JSONTree({
                    json: this.model.event.getRawText()
                });

                this.model.state.set(this.showFormattedJSON, this.children.json.isValidJSON());
            },
            startListening: function() {
                this.listenTo(this.model.event, 'change', function() {
                    this.children.json.setJSON(this.model.event.getRawText(), false);
                    this.render(); 
                });

                this.listenTo(this.model.report.entry.content, 'change:display.events.type', function() {
                    var wrap = util.normalizeBoolean(this.model.report.entry.content.get("display.events.list.wrap")),
                        $raw = this.$('.raw-event');
                    $raw.removeClass('wrap');
                    if (this.model.report.entry.content.get('display.events.type') === 'raw' || wrap) {
                       $raw.addClass('wrap');
                    } 
                });
                
                this.listenTo(this.model.report.entry.content, 'change:display.events.list.wrap', function() {
                    var wrap = util.normalizeBoolean(this.model.report.entry.content.get("display.events.list.wrap")),
                        $raw = this.$('.raw-event');
                    (wrap && !$raw.hasClass('wrap')) ? $raw.addClass('wrap') : $raw.removeClass('wrap');
                });
                
                //any interaction with json should force modalization
                this.listenTo(this.children.json, 'interaction', function() {
                    this.model.state.trigger(this.interaction);
                });                 
            },
            events: {
                'mouseover .t': function(e) {
                    var $elem = this.getSegmentParent(e.target);
                    $elem.addClass('h');
                    e.preventDefault();
                },
                'mouseout .t': function(e) {
                    var $elem = this.getSegmentParent(e.target);
                    $elem.removeClass('h');

                },
                'click .t': function(e) {
                    var $root = this.getSegmentRoot($(e.currentTarget)), data;
                    if(!$root) {
                        $root = this.getSegmentParent(e.currentTarget);
                    }
                    data = {
                        value: $root.text(),
                        app: this.model.application.get('app'),
                        owner: this.model.application.get('owner'),
                        stripReportsSearch: false
                    };

                    if ($root.hasClass('a')) {
                        data = $.extend(data, {
                            q: this.model.report.entry.content.get('search'),
                            action: 'removeterm'
                        });
                    } else if(this.children.json.isValidJSON()) {
                        data = $.extend(data, {
                            q: this.keyboardSearchModifier.isReplacement(e) ? '*' : this.model.report.entry.content.get('search'),
                            action: 'fieldvalue',
                            field: $root.siblings().eq(0).text(),
                            value: $root.text(),
                            negate: this.keyboardSearchModifier.isNegation(e),
                            usespath: true
                        });
                    } else {
                        data = $.extend(data, {
                            q: this.keyboardSearchModifier.isReplacement(e) ? '*' : this.model.report.entry.content.get('search'),
                            action: 'addterm',
                            negate: this.keyboardSearchModifier.isNegation(e)
                        });
                    }
                    this.model.state.trigger('drilldown', { data: data, event: e, idx: this.options.idx });
                    return false;
                },
                'click .hideinline': function(e) {
                    this.model.state.set(this.showAllLines, false);
                    e.preventDefault();
                 },
                'click .showinline': function(e) {
                    this.model.state.set(this.showAllLines, true);
                    e.preventDefault();
                },
                'click .toggle-raw-json': function(e) {
                    this.model.state.set(this.showFormattedJSON, !this.model.state.get(this.showFormattedJSON));
                    this.render();
                    this.model.state.trigger(this.interaction);
                    e.preventDefault();
                }
            },
            getSegmentParent: function(element){
                var parent = element.parentNode;
                if (parent.childNodes[parent.childNodes.length-1]==element && $(parent).hasClass('t')) {
                    element = parent;
                }
                return $(element);
            },
            isType: function(type) {
                return (this.model.report.entry.content.get('display.events.type') === type);
            },
            getSegmentRoot: function($element) {
                if($element.hasClass('event')) {
                    return void(0);
                } else if($element.hasClass('a')) {
                    return $element;
                } else {
                    return this.getSegmentRoot($element.parent());
                }
            },
            render: function() {
                var wrap = true,
                    content = this.model.report.entry.content,
                    linecount = parseInt(this.model.event.get('_fulllinecount'), 10);
                
                if(this.isType('list') || this.isType('table')) {
                    wrap = util.normalizeBoolean(content.get('display.events.list.wrap'));
                }

                this.el.innerHTML = this.compiledTemplate({
                    _:_,
                    isTable: this.isType('table'),
                    isJSON: this.children.json.isValidJSON(),
                    isFormatted: this.model.state.get(this.showFormattedJSON),
                    model: this.model.event,
                    linecount: linecount,
                    wrap: wrap,  
                    expanded: this.model.state.get(this.showAllLines),
                    decorations: this.decorations
                });
                
                var $rawevent = this.$('.raw-event'),
                    $jsonevent = this.$('.json-event');

                if(!this.isType('table') && this.model.state.get(this.showFormattedJSON)) {
                    this.children.json.render().appendTo($jsonevent);
                } else if(this.isType('table')) {
                    $rawevent.append(_.escape(this.model.event.getRawText()));
                } else {
                    $rawevent[0].innerHTML = this.model.event.getRawSegmentation();
                }
                return this;
            },
            template: '\
                <% if(model.has("_decoration") && decorations[model.get("_decoration")]) { %>\
                    <% var decoration = decorations[model.get("_decoration")]; %>\
                    <span class="audit label  <%- decoration.label %>"><i class="<%- decoration.icon %>"></i> <%- decoration.msg %></span>\
                <% } %>\
                <div class="json-event"></div>\
                <div class="raw-event normal <% if(wrap){ %> wrap <% } %>"></div>\
                <% if(isJSON && !isTable) { %><a href="#" class="toggle-raw-json"><%- (!isFormatted) ? _("Show syntax highlighted").t(): _("Show as raw text").t() %></a> <% } %>\
                <% if (expanded) { %>\
                    <a href="#" class="hideinline">Collapse</a>\
                <% } else if (model.isTruncated()) { %>\
                    <a href="#" class="showinline">Show all <%= linecount %> lines</a>\
                <% } %>\
            '
        });
    }
);

define('views/shared/eventsviewer/list/body/row/Master',
    [
        'jquery',
        'underscore',
        'backbone',
        'module',
        'views/Base',
        'views/shared/eventsviewer/list/body/row/SelectedFields',
        'views/shared/eventsviewer/shared/EventFields',
        'views/shared/eventsviewer/shared/RawField',
        'splunk.util'
    ],
    function(
        $,
        _,
        Backbone,
        module,
        BaseView,
        SelectedFieldsView,
        EventFieldsView,
        RawField,
        splunkUtil
    ){
        return BaseView.extend({
            moduleId: module.id,
            tagName: 'tr',
            /**
             * @param {Object} options {
             *      model: {
             *         event: <models.services.search.job.ResultsV2.results[i]>,
             *         result: <models.services.search.job.ResultsV2>,
             *         state: <models.Base>,
             *         summary: <models.services.searchjob.SummaryV2>,
             *         report: <models.services.SavedSearch>,
             *         searchJob: <models.Job>,
             *         application: <models.Application>
             *     },
             *     collection: {
             *         selectedFields: <collections.SelectedFields>,
             *         eventRenderers: <collections.services.configs.EventRenderers>,
             *         workflowActions: <collections.services.data.ui.WorkflowActions>
             *     },
             *     selectableFields: true|false
             */
            initialize: function(){
                BaseView.prototype.initialize.apply(this, arguments);
                
                this.interaction  = 'i' + this.options.idx;
                this.rowExpanded  = 'r' + this.options.idx;
                this.showAllLines = 's' + this.options.idx;
                
                this.model.state.unset(this.showAllLines);

                this.model.renderer = this.collection.eventRenderers.getRenderer(this.model.event.get('eventtype'));

                this.children.raw = new RawField({
                    model: {
                        event: this.model.event,
                        state: this.model.state,
                        result: this.model.result,
                        report: this.model.report,
                        searchJob: this.model.searchJob,
                        application: this.model.application
                    },
                    collection: {
                        eventRenderers: this.collection.eventRenderers
                    },
                    idx: this.options.idx
                });

                this.children.selectedFields = new SelectedFieldsView({
                    model: {
                        event: this.model.event,
                        state: this.model.state,
                        result: this.model.result,
                        summary: this.model.summary,
                        application: this.model.application,
                        report: this.model.report,
                        searchJob: this.model.searchJob
                    },
                    collection: {
                        selectedFields: this.collection.selectedFields,
                        workflowActions: this.collection.workflowActions
                    },
                    rowExpanded: this.rowExpanded,
                    selectableFields: this.options.selectableFields
                });
            },
            startListening: function() {
                this.listenTo(this.model.state, this.interaction, function() {
                    if(!this.isExpanded()) {
                        this.expand();
                    }
                });
                
                /*
                 * Our bus for communication from our grandparent regarding clicks on the
                 * modalization mask.
                 */
                this.listenTo(this.model.state, 'change:' + this.rowExpanded, function(model, value, options){
                    if(!value) {
                        this.collapseState();
                    }
                });
                
                this.listenTo(this.model.state, 'change:' + this.showAllLines, function(model, value, options){
                    (!this.isExpanded() && this.options.allowRowExpand) ? this.expand(): this.eventFetch();
                });
                
                //on change of the search string we should unmodalize
                this.listenTo(this.model.state, 'intentions-fetch', this.collapseState);
                
                this.listenTo(this.model.report.entry.content, 'change:display.events.type', this.manageListRawState);
            },
            manageListRawState: function() {
                if (this.isList()) {
                    this.$('td._time').show();
                    if(!this.children.selectedFields.active) {
                        this.children.selectedFields.activate().$el.show(); 
                    } else {
                        this.children.selectedFields.$el.show(); 
                    }
                } else {
                    this.children.selectedFields.deactivate().$el.hide(); 
                    this.$('td._time').hide();
                }
            },
            events: {
                'click td.expands': function(e) {
                    this.expand();
                    e.preventDefault();
                },
                'click .formated-time': function(e) {
                    e.preventDefault();
                    this.drilldown($(e.currentTarget), e);
                },
                'keyup ._time': function(e) {
                    e.preventDefault();
                    if(e.which === 13) {
                        this.drilldown($(e.currentTarget).find('span.formated-time'), e);
                    }
                }
            },
            drilldown: function($target, e) {
                //TODO: this looks exactly like table/body/PrimaryRow's drilldown method. They should come from a base class most likely.
                var data = $target.data(), timeIso, epoch;
                if (data.timeIso) {
                    timeIso = data.timeIso;
                    epoch = splunkUtil.getEpochTimeFromISO(timeIso);
                    this.model.state.trigger('drilldown', {
                        noFetch: true, 
                        data: {
                            'dispatch.earliest_time': epoch,
                            'dispatch.latest_time': '' + (parseFloat(epoch) + 1)
                        },
                        event: e,
                        _time: timeIso,
                        idx: this.options.idx
                    });                    
                }                
            },
            eventFieldsFactory: function() {
                this.children.eventFields = new EventFieldsView({
                    model: {
                        event: this.model.event,
                        state: this.model.state,
                        result: this.model.result,
                        summary: this.model.summary,
                        application: this.model.application,
                        report: this.model.report,
                        searchJob: this.model.searchJob
                    },
                    collection: {
                        selectedFields: this.collection.selectedFields,
                        workflowActions: this.collection.workflowActions
                    },
                    selectableFields: this.options.selectableFields,
                    allowRowExpand: this.options.allowRowExpand,
                    idx: this.options.idx,
                    swappingKey: this.swappingKey,
                    showAllLines: this.showAllLines
                });
                //remove and put into another function
                this.children.eventFields.render().insertAfter(this.$('.event').find(this.children.raw.el));
            },
            expand: function(options) {
                if (this.options.allowRowExpand) {
                    if(!this.children.eventFields) {
                        this.eventFieldsFactory();
                    }
                    (this.isExpanded()) ? this.collapseState(): this.expandState();
                }
            },
            eventFetch: function(showAll) {
                this.model.event.id = this.model.searchJob.entry.links.get('events');
                this.model.event.fetch({
                    data: $.extend(true, this.model.application.toJSON(), {
                        isRt: this.model.searchJob.isRealtime(),
                        search: this.model.report.getSortingSearch(),
                        earliest_time: this.model.report.entry.content.get('display.events.timelineEarliestTime'),
                        latest_time: this.model.report.entry.content.get('display.events.timelineLatestTime'),
                        segmentation:  this.model.report.entry.content.get('display.events.list.drilldown'),
                        max_lines: this.model.state.get(this.showAllLines) ? 0: this.model.report.getNearestMaxlines(),
                        eventsOffset: +this.model.report.entry.content.get('display.prefs.events.offset') || 0,
                        oid: this.model.application.get('oid')
                    })     
                });
            },
            isExpanded: function() {
                return this.model.state.get(this.rowExpanded);
            },
            expandState: function() {
                this.eventFetch();
                this.model.state.set(this.rowExpanded, true);
                this.children.eventFields && this.children.eventFields.activate().$el.show();
                this.isList() && this.children.selectedFields.deactivate().$el.hide();
                this.toggleArrow(true);
            },
            collapseState: function() {
                this.model.state.set(this.rowExpanded, false);                
                this.children.eventFields && this.children.eventFields.deactivate().$el.hide();
                this.isList() && this.children.selectedFields.activate().$el.show();
                this.toggleArrow(false);
            },
            isList: function() {
                return (this.model.report.entry.content.get('display.events.type') === 'list');
            },
            toggleArrow: function(open) {
                var $arrow =  this.$('td.expands > a > i').removeClass('icon-triangle-right-small icon-triangle-down-small');
                $arrow.addClass((open) ? 'icon-triangle-down-small':  'icon-triangle-right-small');
            },
            render: function() {
               this.$el.html(this.compiledTemplate({
                    $: $,
                    event: this.model.event,
                    lineNum: this.options.lineNum,
                    application: this.model.application, //ghetto and inconsistent 
                    expanded: this.isExpanded(),
                    isList: this.isList(),
                    formattedTime: this.model.event.formattedTime(),
                    colorClass: (this.model.renderer) ? this.model.renderer.entry.content.get('css_class'): '',
                    allowRowExpand: this.options.allowRowExpand //misuse by data model
                }));
               
                this.children.raw.render().appendTo(this.$('.event'));
                this.children.selectedFields.render().appendTo(this.$('.event'));

                if(!this.isList()) {
                    this.children.selectedFields.deactivate().$el.hide();
                }

                return this;
            },
            template: '\
                <% if (allowRowExpand) { %>\
                <td class="expands <%- colorClass %>">\
                    <a href="#"><i class="icon-triangle-<%- expanded ? "down" : "right" %>-small"></i></a>\
                </td>\
                <% } %>\
                <td class="line-num"><span><%- lineNum %></span></td>\
                <td class="_time" <% if (!isList) { %> style="display:none" <%}%> tabindex="0">\
                    <span class="formated-time" data-time-iso="<%- event.get("_time") %>">\
                    <% if(application.get("locale").indexOf("en") > -1){ %>\
                         <span><%- $.trim(formattedTime.slice(0, formattedTime.indexOf(" "))) %></span>\
                         <br>\
                         <span><%- $.trim(formattedTime.slice(formattedTime.indexOf(" "))) %></span>\
                    <% } else { %>\
                         <%- formattedTime %>\
                    <% } %>\
                    </span>\
                </td>\
                <td class="event"></td>\
            '
        });
    }
);

define('views/shared/eventsviewer/list/body/Master',
    [
        'module',
        'underscore',
        'views/Base',
        'views/shared/eventsviewer/list/body/row/Master',
        'util/console'
    ],
    function(module, _, BaseView, Row, console){
        return BaseView.extend({
            moduleId: module.id,
            tagName: 'tbody',
            /**
             * @param {Object} options {
             *     model: {
             *         result: <models.services.search.job.ResultsV2>,
             *         summary: <model.services.search.job.SummaryV2>
             *         state: <models.BaseV2>,
             *         searchJob: <models.Job>,
             *         report: <models.services.SavedSearch>,
             *         application: <models.Application>
             *     },
             *     collection: {
             *         selectedFields: <collections.SelectedFields>,
             *         eventRenderers: <collections.services.configs.EventRenderers>,
             *         workflowActions: <collections.services.data.ui.WorkflowActions>
             *     },
             *     selectableFields: true|false  
             */
            initialize: function(){
                BaseView.prototype.initialize.apply(this, arguments);
            },
            startListening: function() {
                this.listenTo(this.model.result.results, 'reset', function() {
                    if (!this.model.state.get('isModalized')) {
                        this.debouncedCleanupAndRender();
                    }
                });
            },
            activate: function(options) {
                var clonedOptions = _.extend({}, (options || {}));
                delete clonedOptions.deep;
                
                if (this.active) {
                    return BaseView.prototype.activate.call(this, clonedOptions);
                }
                
                BaseView.prototype.activate.call(this, clonedOptions);
                
                this.synchronousCleanupAndDebouncedRender();
                
                return this;
            },
            synchronousCleanupAndDebouncedRender: function() {
                if (this.active) {
                    this.cleanup();
                    this.debouncedRender();
                }
            },
            debouncedCleanupAndRender: _.debounce(function() {
                if (this.active) {
                    this.cleanup();
                    this.render();
                }
            }, 0),
            cleanup: function() {
                this.trigger('rows:pre-remove');
                this.eachChild(function(child){
                    child.deactivate({deep: true});
                    child.debouncedRemove({detach: true});
                }, this);
                this.children = {};
            },
            render: function() {
                if (_.isEmpty(this.children)) {
                    var fragment = document.createDocumentFragment(),
                        isRT = this.model.searchJob.entry.content.get('isRealTimeSearch'),
                        results = isRT ? this.model.result.results.reverse({mutate: false}) : this.model.result.results.models;
    
                    console.debug('Events Lister: rendering', results.length, 'events', isRT ? 'in real-time mode' : 'in historical mode');
                    _.each(results, function(event, idx) {
                        var lineNum,
                            id = 'row_' + idx;
                        if (isRT) {
                            lineNum = this.model.result.endOffset() - idx;
                        } else {
                            lineNum = this.model.result.get('init_offset') + idx + 1;
                        }
    
                        this.children[id] = new Row({ 
                            lineNum: lineNum,
                            model: {
                                state: this.model.state,
                                event: event,
                                result: this.model.result,
                                summary: this.model.summary,
                                report: this.model.report,
                                application: this.model.application,
                                searchJob: this.model.searchJob
                            },
                            collection: {
                                selectedFields: this.collection.selectedFields,
                                eventRenderers: this.collection.eventRenderers,
                                workflowActions: this.collection.workflowActions
                            },
                            idx: idx,
                            selectableFields: this.options.selectableFields,
                            allowRowExpand: this.options.allowRowExpand
                        });
                        this.children[id].render().appendTo(fragment);
                        this.children[id].activate({deep:true});
                    }, this);
                    this.el.appendChild(fragment);
    
                    //bulk purge of remove mutex
                    _(this.model.state.toJSON()).each(function(value, key) {
                        if(key.indexOf('pendingRemove') === 0) {
                            this.model.state.unset(key);
                        }
                    },this);
                    
                    this.trigger('rows:added');
                }
                return this;
            }
        });
    }
);

define('views/shared/eventsviewer/list/Master',
    [
        'underscore',
        'module',
        'views/Base',
        'views/shared/delegates/Modalize',
        'views/shared/delegates/TableDock',
        'views/shared/delegates/TableHeadStatic',
        'views/shared/eventsviewer/shared/TableHead',
        'views/shared/eventsviewer/list/body/Master',
        'splunk.util'
    ],
    function(_, module, BaseView, Modalize, TableDock, TableHeadStatic, TableHeadView, TableBodyView, util){
        return BaseView.extend({
            moduleId: module.id,
            /**
             * @param {Object} options {
             *     model: {
             *         result: <models.services.search.job.ResultsV2>,
             *         summary: <model.services.search.job.SummaryV2>,
             *         searchJob: <models.Job>,
             *         report: <models.services.SavedSearch>,
             *         application: <models.Application>
             *     },
             *     collection: {
             *         selectedFields: <collections.SelectedFields>,
             *         eventRenderers: <collections.services.configs.EventRenderers>,
             *         workflowActions: <collections.services.data.ui.WorkflowActions>
             *     },
             *     selectableFields: true|false,
             *     headerMode: dock|static|none (default),
             *     headerOffset: integer (only applicable with headerMode=dock),
             *     allowRowExpand: true|false              
             */
            className: 'scrolling-table-wrapper',
            initialize: function(){
                BaseView.prototype.initialize.apply(this, arguments);
                
                this.tableId = this.cid + '-table';

                /*
                * Modalize Delegate: enrichment of view with
                * modalize related logic.
                */
                this.children.modalize = new Modalize({
                    el: this.el, 
                    tbody: '#' + this.tableId + ' > tbody'
                });
                
                /*
                * Based on the state of the report, customize thead columns 
                * to contain contain time. 
                *
                */
                this.children.head = new TableHeadView({
                    model: this.model.report,
                    labels: this.isList() ? ['Time', 'Event']: ['Event'],
                    allowRowExpand: this.options.allowRowExpand
                });
                
                this.children.body = new TableBodyView({
                    model: { 
                        result: this.model.result,
                        summary: this.model.summary,
                        state: this.model.state,
                        searchJob: this.model.searchJob,
                        report: this.model.report,
                        application: this.model.application
                    },
                    collection: {
                        selectedFields: this.collection.selectedFields,
                        eventRenderers: this.collection.eventRenderers,
                        workflowActions: this.collection.workflowActions
                    },
                    selectableFields: this.options.selectableFields,
                    allowRowExpand: this.options.allowRowExpand
                });
                
                if (this.options.headerMode === 'dock') {
                    this.children.tableDock = new TableDock({ 
                        el: this.el, 
                        offset: this.options.headerOffset, 
                        defaultLayout: 'fixed'
                    });
                } else if (this.options.headerMode === 'static') {
                    // class below enables vertical scrolling - Consumer must set height or use updateContainerHeight()
                    this.children.staticHead = new TableHeadStatic({
                        el: this.el,
                        scrollContainer: '> .vertical-scrolling-table-wrapper',
                        flexWidthColumn: false
                    });
                }
            },
            isList: function() {
                return (this.model.report.entry.content.get('display.events.type') === 'list');
            },
            modalize: function(idx) {
                this.children.modalize.show(idx);
            },
            activate: function(options) {
                if (this.active) {
                    return BaseView.prototype.activate.apply(this, arguments);
                }
                this.showHideRowNum();
                this.children.head.updateLabels(this.isList() ? ['Time', 'Event']: ['Event']);

                return BaseView.prototype.activate.apply(this, arguments);
            },
            startListening: function() {
                var modalize = _.debounce(this.modalize);
                
                /*
                 * Funnel all changes on state through a regex to test
                 * whether we need to modalize or not. 
                 */
                this.listenTo(this.model.state, 'change', function(model) {
                    var key;
                    for (key in model.changed) {
                        if (this.model.state.ROW_EXPAND_REX.test(key)) {
                            if (model.changed[key]) {
                                this.model.state.set('isModalized', true);
                                //intimate knowledge of the keys structure (rethink)
                                modalize.call(this, +/\d+/.exec(key)[0]);
                                this.children.tableDock && this.children.tableDock.disable();
                                this.children.staticHead && this.children.staticHead.deactivate();
                            } else {
                                this.model.state.set('isModalized', false);
                                modalize.call(this);
                                this.children.tableDock && this.children.tableDock.enable();
                                this.children.staticHead && this.children.staticHead.activate();
                            }
                            break;
                        }
                    }
                }); //TODO: extract out to method on the state model for sharing between table/list_raw
                
                /*
                 * Changes to the selected fields have potential to change the row dimensions. We 
                 * should rerender the modalize mask on any add/remove/reset.
                 */
                this.listenTo(this.collection.selectedFields, 'reset add remove', this.children.modalize.update);
                
                /*
                 * Again, promiscuous in the sense that we have intimate knowledge of the key structure,
                 * allowing us to fire change that only one observer will acknowledge.
                 */
                this.listenTo(this.children.modalize, 'unmodalize', function(idx) {
                    this.model.state.set('r'+idx, false);
                });
                
                /*
                    LOTS OF CALLERS TO DEFER UPDATE TABLE HEAD!....fix me please :(
                */
                this.listenTo(this.model.report.entry.content, 'change:display.events.rowNumbers', function(model, value) {
                    var $table = this.$('table:not(.table-embed)'),
                        hasRowNumbers = util.normalizeBoolean(value);
                        
                    hasRowNumbers ? $table.removeClass('hide-line-num'): $table.addClass('hide-line-num');
                    this.updateTableHead();
                });
                
                this.listenTo(this.model.report.entry.content, 'change:display.events.type', function(model, value) {
                    this.showHideRowNum();
                    this.children.head.updateLabels(this.isList() ? ['Time', 'Event']: ['Event']);
                    this.updateTableHead();
                });
                
                this.listenTo(this.model.report.entry.content, 'change:display.events.list.wrap', function() {
                    this.updateTableHead();
                });
                
                this.listenTo(this.model.result.results, 'reset', function() {
                    if(!this.model.state.get('isModalized')) {
                        this.updateTableHead();
                    }
                });
               
                this.listenTo(this.children.body, 'rows:pre-remove', function() { this.$el.css('minHeight', this.$el.height()); });
                this.listenTo(this.children.body, 'rows:added', function() { this.$el.css('minHeight', ''); });
            },
            deactivate: function(options) {
                if (!this.active) {
                    return BaseView.prototype.deactivate.apply(this, arguments);
                }
                
                //once delegates can easily cleanup dom they create we can remove this.
                this.$('.header-table-docked').remove();

                BaseView.prototype.deactivate.apply(this, arguments);
                return this;
            },
            showHideRowNum: function() {
                var $table = this.$('#' + this.tableId),
                    hasRowNumbers = util.normalizeBoolean(this.model.report.entry.content.get('display.events.rowNumbers'));

                if(this.isList() && hasRowNumbers) {
                    $table.removeClass('hide-line-num');
                } else if(!this.isList() || !hasRowNumbers){
                    $table.addClass('hide-line-num');
                }
            },
            updateTableHead: function() {
                if (this.children.tableDock) {
                    _.defer(this.children.tableDock.update.bind(this.children.tableDock));
                } else if (this.children.staticHead) {
                    // staggered defers to ensure scroll bar UI updates are flushed
                    // before subsequent dependent static head UI updates
                    _.defer(function(){
                        this.updateContainerHeight();
                        _.defer(function(){
                            this.children.staticHead.update();
                        }.bind(this));
                    }.bind(this));
                }
            },
            updateContainerHeight: function(height) {
                // use this during 'static' header mode to update vertical scroll bars.
                // If no height argument set, this maxes out table wrapper height to available window size
                if (height) {
                    this.$('> .vertical-scrolling-table-wrapper').css('height', height);
                } else {
                    this.$('> .vertical-scrolling-table-wrapper').css('max-height', $(window).height() - this.$el.offset().top);
                }
            },
            render: function() {
                this.$el.html(this.compiledTemplate({
                     hidelinenums: !util.normalizeBoolean(this.model.report.entry.content.get("display.events.rowNumbers")),
                     addstatichead: !!this.children.staticHead,
                     tableId: this.tableId
                }));
                this.children.head.render().appendTo(this.$('#' + this.tableId));
                this.children.body.render().appendTo(this.$('#' + this.tableId));
                return this;
            },
            reflow: function() {
                this.updateTableHead();
                return this;
            },
            template: '\
                <% if (addstatichead) { %>\
                    <div class="header-table-static"></div>\
                    <div class="vertical-scrolling-table-wrapper">\
                <% } %>\
                <table class="table table-chrome <% if(hidelinenums){ %> hide-line-num <% } %> table-row-expanding events-results events-results-table" id="<%= tableId %>"></table>\
                <% if (addstatichead) { %>\
                    </div>\
                <% } %>\
            '
        });
    }
);

define('views/shared/eventsviewer/table/TableHead',
    [
        'underscore',
        'module',
        'views/Base',
        'splunk.util',
        'helpers/user_agent'
    ],
    function(
        _,
        module,
        BaseView,
        util,
        user_agent
    )
    {
        return BaseView.extend({
            moduleId: module.id,
            tagName: 'thead',
            /**
             * @param {Object} options {
             *     model: <models.services.SavedSearch>,
             *     collection: <Backbone.Collection>,
             *     sortableFields: true|false (default true),
             * }
             */
            initialize: function() {
                BaseView.prototype.initialize.apply(this, arguments);
                _.defaults(this.options, {sortableFields: true});
            },
            startListening: function() {
                this.listenTo(this.collection.intersectedFields, 'reset', this.render);
                this.listenTo(this.model.report.entry.content, 'change:display.events.rowNumbers change:display.events.table.sortDirection change:display.events.table.sortColumn', this.render);
            },
            activate: function(options) {
                if (this.active) {
                    return BaseView.prototype.activate.apply(this, arguments);
                }

                BaseView.prototype.activate.apply(this, arguments);
                
                /*
                 * Listeners for intersected fields were not set up when the call to 
                 * update the collection in table Master took place.  Manually render
                 * given a correct state of the collection.
                 */ 
                this.render();

                return this;
            },
            events: {
                'click th': function(e) {
                    var $target = $(e.currentTarget);
                    this.model.report.entry.content.set({
                        'display.events.table.sortDirection': ($target.hasClass('asc') ? 'desc' : 'asc'),
                        'display.events.table.sortColumn': $target.attr('data-name')
                    });
                    e.preventDefault();
                }
            },
            render: function() {
                this.$el.html(this.compiledTemplate({
                    collection: this.collection.intersectedFields,
                    hasRowNum: util.normalizeBoolean(this.model.report.entry.content.get('display.events.rowNumbers')),
                    allowRowExpand: this.options.allowRowExpand,
                    content: this.model.report.entry.content,
                    sortableFields: this.options.sortableFields,
                    reorderableHandle: this.options.selectableFields ? 'on': 'off',
                    isRealTime: this.model.searchJob.entry.content.get('isRealTimeSearch'),
                    is_ie7: (user_agent.isIE7()) ? 'ie7': '',
                    _: _
                }));
                return this;
            },
            template: '\
                <tr class="">\
                    <% if (allowRowExpand) { %>\
                        <th class="col-info"><i class="icon-info"></i></th>\
                    <% } %>\
                    <% if(hasRowNum) { %>\
                        <th class="line-num <%- is_ie7 %>">&nbsp;</th>\
                    <% }%>\
                    <th class="col-time <%- content.get("display.events.table.sortColumn") ? "sorts" : "" %> <%- is_ie7 %>">_time</th>\
                    <% collection.each(function(model) { %>\
                        <% var active = (!isRealTime && (content.get("display.events.table.sortColumn") == model.get("name"))) ? "active": ""%>\
                        <% var dir = (!isRealTime && (active==="active")) ? content.get("display.events.table.sortDirection") : ""%>\
                        <% var sorts = (!isRealTime && sortableFields) ? "sorts" : ""; %>\
                        <% var reorderable = (!isRealTime) ? "reorderable" : ""; %>\
                        <% var reorderableLabel = (!isRealTime) ? "reorderable-label" : ""; %>\
                        <th class=" <%- reorderable %> <%- sorts %> <%-active%> <%-dir%>" data-name="<%- model.get("name") %>"><span class="<%- reorderableLabel %> <%- reorderableHandle %>"><%- _(model.get("name")).t() %></span></th>\
                    <% }) %>\
                </tr>\
            '
        });
    }
);


define('views/shared/eventsviewer/table/body/PrimaryRow',
    [
        'jquery',
        'underscore',
        'module',
        'keyboard/SearchModifier',
        'views/Base',
        'splunk.util'
    ],
    function($, _, module, KeyboardSearchModifier, BaseView, splunkUtil){
        return BaseView.extend({
            moduleId: module.id,
            tagName: 'tr',
            /**
             * @param {Object} options {
             *     model: { 
             *         event: <models.services.search.job.ResultsV2.results[i]>,
             *         report: <models.services.SavedSearch>,
             *         state: <models.Base>
             *     },
             *     collection: {
             *         selectedFields: <collections.SelectedFields>
             *         eventRenderers: <collections.services.configs.EventRenderers>,
             *     }
             *     
             */
            initialize: function(){
                BaseView.prototype.initialize.apply(this, arguments);
                this.$el.addClass((!!(this.options.idx%2))?'even':'odd');
                
                this.keyboardSearchModifier = new KeyboardSearchModifier();

                this.model.renderer = this.collection.eventRenderers.getRenderer(this.model.event.get('eventtype'));
                
                //suite of namespaced keys
                this.rowExpanded = 'r' + this.options.idx;
                this.interaction = 'i' + this.options.idx;
                this.showAllLines = 's' + this.options.idx;
            },
            startListening: function() {
                /*
                 * Our bus for communication from our grandparent regarding clicks on the
                 * modalization mask.
                 */
                this.listenTo(this.model.state, 'change:' + this.rowExpanded, function(model, value, options) {
                    if (!value) {
                        this.collapseState();
                    }
                    this.$('.expands').attr('rowspan', (value) ? 2: 1);
                });
                 
                 /*
                  * Columns in the table are dynamic based on the users 
                  * field selection.
                  */
                this.listenTo(this.collection.selectedFields, 'reset add remove', this.render);

                this.listenTo(this.model.report.entry.content, 'change:display.events.table.drilldown', this.render);

                this.listenTo(this.model.report.entry.content, 'change:display.prefs.events.offset', this.collapseState);
                this.listenTo(this.model.report.entry.content, 'change:display.events.list.wrap', function() {
                    var wrap = splunkUtil.normalizeBoolean(this.model.report.entry.content.get("display.events.list.wrap")),
                        $cells = this.$('a.field-val').parents('td');
                   (wrap) ? $cells.removeClass('no-wrap'):  $cells.addClass('no-wrap');
                });
            },
            events: {
                'click td.expands': function(e) {
                    this.expand();
                    e.preventDefault();
                },
                'click ._time-drilldown > a': function(e) {
                    e.preventDefault(); // handled by the cell.
                },
                'click ._time-drilldown': function(e) {
                    e.preventDefault();
                    if(splunkUtil.normalizeBoolean(this.model.report.entry.content.get('display.events.table.drilldown'))){
                        this.drilldown($(e.currentTarget).find('a'), e);
                    }
                },
                'click .one-value-drilldown > a.field-val': function(e) {
                    e.preventDefault(); // handled by the cell.
                },
                'click .one-value-drilldown': function(e) {
                    e.preventDefault();
                    this.drilldown($(e.currentTarget).find('a'), e);
                },
                'click .multi-value-drilldown > a.field-val': function(e) {
                    e.preventDefault();
                    this.drilldown($(e.currentTarget), e);
                },
                'keypress td': function(e) {
                    e.preventDefault();
                    if(e.which === 13) {
                        this.drilldown($(e.currentTarget).find('a'), e);
                    }
                } 
            },
            expand: function(options) {
                (this.isExpanded()) ? this.collapseState(): this.expandState();
            },
            isExpanded: function() {
                return this.model.state.get(this.rowExpanded);
            },
            eventFetch: function() {
                this.model.event.id = this.model.searchJob.entry.links.get('events');
                this.model.event.fetch({
                    data: $.extend(true, this.model.application.toJSON(), {
                        isRt: this.model.searchJob.isRealtime(),
                        search: this.model.report.getSortingSearch(),
                        earliest_time: this.model.report.entry.content.get('display.events.timelineEarliestTime'),
                        latest_time: this.model.report.entry.content.get('display.events.timelineLatestTime'),
                        segmentation:  this.model.report.entry.content.get('display.events.list.drilldown'),
                        max_lines: this.model.state.get(this.showAllLines) ? 0: this.model.report.getNearestMaxlines(),
                        eventsOffset: +this.model.report.entry.content.get('display.prefs.events.offset') || 0
                    })     
                });
            },
            debouncedRemove: function() {
                this.model.state.set(this.pendingRemove, true);
                BaseView.prototype.debouncedRemove.apply(this, arguments);
                return this;
            },
            drilldown: function($target, e) {
                //TODO: this looks exactly like list/body/row/Master's drilldown method. They should come from a base class most likely.
                var data = $target.data(), timeIso, epoch;
                if (data.timeIso) {
                    timeIso = data.timeIso;
                    epoch = splunkUtil.getEpochTimeFromISO(timeIso);
                    this.model.state.trigger('drilldown', {
                        noFetch: true, 
                        data: {
                            'dispatch.earliest_time': epoch,
                            'dispatch.latest_time': '' + (parseFloat(epoch) + 1)
                        },
                        event: e,
                        _time: timeIso,
                        idx: this.options.idx
                    });                    
                } else {
                    this.model.state.trigger('drilldown', {
                        data: {
                             q: this.model.report.entry.content.get('search'),
                             negate: this.keyboardSearchModifier.isNegation(e),
                             action: 'fieldvalue', 
                             field: $target.data().name,
                             value: $.trim($target.text()),
                             app: this.model.application.get('app'),
                             owner: this.model.application.get('owner')
                         },
                         event: e,
                         idx: this.options.idx
                    });                    
                }
            },
            expandState: function() {
                this.eventFetch();
                this.model.state.set(this.rowExpanded, true);
                this.toggleArrow(true);
            },
            collapseState: function() {
                this.model.state.set(this.rowExpanded, false);                
                this.toggleArrow(false);
            },
            toggleArrow: function(open) {
                var $arrow =  this.$('td.expands > a > i').removeClass('icon-triangle-right-small icon-triangle-down-small');
                $arrow.addClass((open) ? 'icon-triangle-down-small':  'icon-triangle-right-small');
            },
            render: function() {
                var root = this.el;
                //rows are read only (innerHTML) for ie
                this.$el.find('> td').each(function(key, element) {
                    root.removeChild(element);
                });
                this.$el.append(this.compiledTemplate({
                    $: $,
                    _:_,
                    event: this.model.event,
                    lineNum: this.options.lineNum,
                    expanded: this.model.state.get(this.rowExpanded),
                    drilldown: splunkUtil.normalizeBoolean(this.model.report.entry.content.get('display.events.table.drilldown')),
                    application: this.model.application,
                    selectedFields: this.collection.selectedFields,
                    colorClass: (this.model.renderer) ? this.model.renderer.entry.content.get('css_class'): '',
                    formattedTime: this.model.event.formattedTime(),
                    allowRowExpand: this.options.allowRowExpand,
                    wrap: splunkUtil.normalizeBoolean(this.model.report.entry.content.get('display.events.table.wrap'))
                }));
                return this;
            },
            template: '\
                <% if (allowRowExpand) { %>\
                    <td <%if(expanded) {%>rowspan=2<%}%> class="expands <%- colorClass %>">\
                        <a href="#"><i class="icon-triangle-<%- expanded ? "down" : "right" %>-small"></i></a>\
                    </td>\
                <% } %>\
                <td class="line-num"><span><%- lineNum %></span></td>\
                <td class="_time <%= drilldown ? "_time-drilldown" : "" %>" tabindex="0">\
                    <% if(drilldown) { %>\
                        <a data-time-iso="<%- event.get("_time") %>">\
                    <% } else { %>\
                        <span data-time-iso="<%- event.get("_time") %>">\
                    <% } %>\
                        <% if(application.get("locale").indexOf("en") > -1){ %>\
                             <span><%- $.trim(formattedTime.slice(0, formattedTime.indexOf(" "))) %></span>\
                             <br>\
                             <span><%- $.trim(formattedTime.slice(formattedTime.indexOf(" "))) %></span>\
                        <% } else { %>\
                             <%- formattedTime %>\
                        <% } %>\
                    <% if(drilldown) { %>  </a>  <% } else { %> </span> <% } %>\
                </td>\
                <% selectedFields.each(function(model) { %>\
                    <% var fields = event.get(model.get("name")); %>\
                    <% if (drilldown) { %>\
                        <td class="<% if(!wrap) { %>no-wrap<% } %> <%= drilldown && fields && fields.length > 1 ? "multi-value-drilldown" : ""  %> <%= drilldown && fields && fields.length == 1 ? "one-value-drilldown" : ""  %>"  tabindex="0"><% _(fields).each(function(field) { %><a class="field-val" data-name="<%- model.get("name") %>"><%- field %></a><% }) %></td>\
                    <% } else { %>\
                        <td class="<% if(!wrap) { %>no-wrap<% } %>"  tabindex="0"><% _(fields).each(function(field) { %><span class="field-val" data-name="<%- model.get("name") %>"><%- field %></span><% }) %></td>\
                    <% } %>\
                <% }) %>\
            '
        });
    }
);  

 define('views/shared/eventsviewer/table/body/SecondaryRow',
    [
        'module',
        'underscore',
        'views/Base',
        'views/shared/eventsviewer/shared/EventFields',
        'views/shared/eventsviewer/shared/RawField',
        'splunk.util'
    ],
    function(module, _, BaseView, EventFields, RawField, util){
        return BaseView.extend({
            moduleId: module.id,
            tagName: 'tr',
            className: 'field-row',
            /**
             * @param {Object} options {
             *      model: {
             *         result: <models.services.search.job.ResultsV2>,
             *         event: <models.services.search.job.ResultsV2.result[i]>,
             *         summary: <model.services.search.job.SummaryV2>
             *         state: <models.Base>,
             *         application: <models.Application>
             *     }
             *     collection: {
             *         selectedFields: <collections.SelectedFields>
             *         workflowActions: <collections.services.data.ui.WorkflowActions> 
             *     },
             *     selectableFields: true|false
             * } 
             */
            initialize: function(){
                BaseView.prototype.initialize.apply(this, arguments);
                this.$el.addClass((!!(this.options.idx%2))?'even':'odd');
                
                this.rowExpanded  = 'r' + this.options.idx;
                this.showAllLines = 's' + this.options.idx;
                
                this.children.eventFields = new EventFields({
                    model: { 
                        event: this.model.event,
                        report: this.model.report,
                        summary: this.model.summary,
                        result: this.model.result,
                        state: this.model.state,
                        application: this.model.application,
                        searchJob: this.model.searchJob
                    },
                    collection: {
                        workflowActions: this.collection.workflowActions,
                        selectedFields: this.collection.selectedFields
                    },
                    selectableFields: this.options.selectableFields,
                    idx: this.options.idx
                });
                //event 
                this.children.raw = new RawField({
                    model: {
                        event: this.model.event,
                        state: this.model.state,
                        result: this.model.result,
                        report: this.model.report,
                        searchJob: this.model.searchJob,
                        application: this.model.application
                    },
                    segmentation: false,
                    idx: this.options.idx
                });

            },
            startListening: function() {
                this.listenTo(this.model.state, 'change:' + this.rowExpanded, this.visibility);
                
                this.listenTo(this.model.result, 'tags-updated', function() { 
                    if (this.model.state.get(this.rowExpanded)){
                        this.render(); 
                    }
                });
                
                this.listenTo(this.model.state, 'change:' + this.showAllLines, this.eventFetch);
                this.listenTo(this.model.state, 'unmodalize' + this.options.idx, this.collapseState);
                this.listenTo(this.collection.selectedFields, 'reset add remove', function() {
                    if (this.model.state.get(this.rowExpanded)) {
                        this.$('.event').attr('colspan', this.model.event.keys().length);
                    }
                });            
            },
            eventFetch: function(showAll) {
                this.model.event.id = this.model.searchJob.entry.links.get('events');
                this.model.event.fetch({
                    data: $.extend(true, this.model.application.toJSON(), {
                        isRt: this.model.searchJob.isRealtime(),
                        search: this.model.report.getSortingSearch(),
                        earliest_time: this.model.report.entry.content.get('display.events.timelineEarliestTime'),
                        latest_time: this.model.report.entry.content.get('display.events.timelineLatestTime'),
                        segmentation:  this.model.report.entry.content.get('display.events.list.drilldown'),
                        max_lines: this.model.state.get(this.showAllLines) ? 0: this.model.report.getNearestMaxlines(),
                        eventsOffset: +this.model.report.entry.content.get('display.prefs.events.offset') || 0
                    })     
                });
            },
            visibility: function() {
                var $arrow =  this.$('td.expands > a > i').removeClass('icon-triangle-right-small icon-triangle-down-small');
                if (this.model.state.get(this.rowExpanded)) {
                    this.$el.css('display', '');
                    $arrow.addClass('icon-triangle-down-small');
                    this.children.raw.activate().$el.show();
                    this.children.eventFields.activate().$el.show();
                } else {
                    this.$el.hide();
                    $arrow.addClass('icon-triangle-right-small');
                    this.children.raw.deactivate().$el.hide();
                    this.children.eventFields.deactivate().$el.hide();
                }
            },
            getCalculatedColSpan: function() {
                return this.collection.selectedFields.length + 1 +((util.normalizeBoolean(
                    this.model.report.entry.content.get("display.events.rowNumbers"))
                ) ? 1 : 0);
            
            },
            collapseState: function() {
                this.model.state.unset('modalize');
                this.model.state.unset(this.rowExpanded);
                this.model.state.unset('sleep');
            },
            render: function() {
                var root = this.el;
                //rows are read only (innerHTML) for ie
                this.$el.find('> td').each(function(key, element) {
                    root.removeChild(element);
                });
                this.$el.append(this.compiledTemplate({
                    cspan: this.getCalculatedColSpan(), 
                    raw: this.model.event.getRawText()
                }));
                this.children.raw.render().appendTo(this.$('.event'));
                this.children.eventFields.render().appendTo(this.$('.event'));
                this.visibility();
                return this;
            },
            template: '\
                <td class="event" colspan="<%- cspan %>"></td>\
            '
        });
    }
);  

define('views/shared/eventsviewer/table/body/Master',
    [
        'jquery',
        'underscore',
        'module',
        'views/Base',
        'views/shared/eventsviewer/table/body/PrimaryRow',
        'views/shared/eventsviewer/table/body/SecondaryRow',
        'util/console'
    ],
    function($, _, module, BaseView, PrimaryRow, SecondaryRow, console){
        return BaseView.extend({
            moduleId: module.id,
            tagName: 'tbody',
            /**
             * @param {Object} options {
             *     model: {
             *         result: <models.services.search.job.ResultsV2>,
             *         searchJob: <models.Job>,
             *         report: <models.services.SavedSearch>,
             *         summary: <model.services.search.job.SummaryV2>,
             *         application: <models.Application>
             *     },
             *     collection: {
             *         selectedFields: <collections.SelectedFields>
             *         eventRenderers: <collections.services.configs.EventRenderers>,
             *         workflowActions: <collections.services.data.ui.WorkflowActions> 
             *     },
             *     selectableFields: true|false
             * } 
             */
            initialize: function() {
                BaseView.prototype.initialize.apply(this, arguments);
            },
            startListening: function() {
                this.listenTo(this.model.result.results, 'reset', this.debouncedCleanupAndRender);
                this.listenTo(this.collection.intersectedFields, 'reset', this.debouncedCleanupAndRender);
            },
            activate: function(options) {
                var clonedOptions = _.extend({}, (options || {}));
                delete clonedOptions.deep;
                
                if (this.active) {
                    return BaseView.prototype.activate.call(this, clonedOptions);
                }
                
                BaseView.prototype.activate.call(this, clonedOptions);
                
                this.synchronousCleanupAndDebouncedRender();
                
                return this;
            },
            synchronousCleanupAndDebouncedRender: function() {
                if (this.active) {
                    this.cleanup();
                    this.debouncedRender();
                }
            },
            debouncedCleanupAndRender: _.debounce(function() {
                if (this.active) {
                    this.cleanup();
                    this.render();
                }
            }, 0),
            cleanup: function() {
                this.trigger('rows:pre-remove');
                this.eachChild(function(child){
                    child.deactivate({deep: true});
                    child.debouncedRemove({detach: true});
                }, this);
                this.children = {};
            },
            render: function() {
                if (_.isEmpty(this.children)) {
                    var fragment = document.createDocumentFragment(),
                        isRealTimeSearch = this.model.searchJob.entry.content.get('isRealTimeSearch'),
                        results = isRealTimeSearch ? this.model.result.results.reverse({mutate: false}) : this.model.result.results.models;
    
                    console.debug('Events Table: rendering', results.length, 'events', isRealTimeSearch ? 'in real-time mode' : 'in historical mode');
                    _.each(results, function(event, idx) {
                        var lineNum;
    
                        if (this.model.searchJob.entry.content.get('isRealTimeSearch')) {
                            lineNum = this.model.result.endOffset() - idx;
                        } else {
                            lineNum = this.model.result.get('init_offset') + idx + 1;
                        }
    
                        this.children['masterRow_' + idx] = new PrimaryRow({ 
                            model: { 
                                event : event, 
                                report: this.model.report,
                                application: this.model.application,
                                searchJob: this.model.searchJob,
                                result: this.model.result,
                                state: this.model.state
                            }, 
                            collection: {
                                eventRenderers: this.collection.eventRenderers,
                                selectedFields: this.collection.intersectedFields
                            },
                            lineNum: lineNum,
                            idx: idx,
                            allowRowExpand: this.options.allowRowExpand
                        });
                        this.children['masterRow_'+idx].render().appendTo(fragment);
                        this.children['masterRow_' + idx].activate({deep: true});
                        
                        this.children['fieldRow_' + idx] = new SecondaryRow({
                            model: { 
                                event : event,
                                report: this.model.report,
                                result: this.model.result,
                                summary: this.model.summary,
                                state: this.model.state,
                                application: this.model.application,
                                searchJob: this.model.searchJob
                            }, 
                            collection: {
                                workflowActions: this.collection.workflowActions,
                                selectedFields: this.collection.selectedFields
                            },
                            idx: idx,
                            selectableFields: this.options.selectableFields
                        });
                        this.children['fieldRow_'+idx].render().appendTo(fragment);
                        this.children['fieldRow_' + idx].activate({deep: true});
                    },this);
                    this.el.appendChild(fragment);
                    
                    //bulk purge of remove mutex
                    _(this.model.state.toJSON()).each(function(value, key) {
                        if(key.indexOf('pendingRemove') === 0) {
                            this.model.state.unset(key);
                        }
                    },this);
                    
                    this.trigger('rows:added');
                    this.reflow();
                }
                return this;
            },
            reflow: function() {
                this.model.state.trigger('init-draggable');
            }
        });
    }
);

define('views/shared/eventsviewer/table/Master',
    [
        'module',
        'underscore',
        'splunk.util',
        'jquery.ui.draggable',
        'views/Base',
        'views/shared/delegates/Modalize',
        'views/shared/delegates/TableDock',
        'views/shared/delegates/TableHeadStatic',
        'views/shared/eventsviewer/table/TableHead',
        'views/shared/eventsviewer/table/body/Master'
    ],
    function(module, _, util, undefined, BaseView, Modalize, TableDock, TableHeadStatic, TableHeadView, TableBodyView){
        return BaseView.extend({
            moduleId: module.id,
            /**
             * @param {Object} options {
             *     model: {
             *         result: <models.services.search.job.ResultsV2>,
             *         summary: <model.services.search.job.SummaryV2>,
             *         searchJob: <models.Job>,
             *         report: <models.services.SavedSearch>,
             *         application: <models.Application>,
             *         state: <models.BaseV2> (optional)
             *     },
             *     collection: {
             *         selectedFields: <collections.SelectedFields>
             *         eventRenderers: <collections.services.configs.EventRenderers>,
             *         workflowActions: <collections.services.data.ui.WorkflowActions> 
             *     },
             *     selectableFields: true|false,
             *     sortableFields: true|false (default true),
             *     headerMode: dock|static|none (default),
             *     headerOffset: integer (only applicable with headerMode=dock),
             *     allowRowExpand: true|false
             */
            className: 'scrolling-table-wrapper',
            initialize: function(){
                BaseView.prototype.initialize.apply(this, arguments);
                
                _.defaults(this.options, {sortableFields: true});
                
                this.tableId = this.cid + '-table';

                this.drag = {};
                
                this.collection.intersectedFields = this.collection.selectedFields.deepClone();                

                this.children.modalize = new Modalize({
                    el: this.el,
                    tbody: '#' + this.tableId + ' > tbody'
                });

                this.children.head = new TableHeadView({
                    model: {
                        report: this.model.report,
                        searchJob: this.model.searchJob
                    },
                    collection: { 
                        intersectedFields: this.collection.intersectedFields,
                        selectedFields: this.collection.selectedFields
                    },
                    selectableFields: this.options.selectableFields,
                    sortableFields: this.options.sortableFields,
                    allowRowExpand: this.options.allowRowExpand,
                    isRealTime: this.model.searchJob.entry.content.get('isRealTimeSearch')
                });

                this.children.body = new TableBodyView({
                    model: {
                        result: this.model.result,
                        state: this.model.state,
                        summary: this.model.summary,
                        searchJob: this.model.searchJob,
                        report: this.model.report,
                        application: this.model.application
                    },
                    collection: { 
                        workflowActions: this.collection.workflowActions,
                        intersectedFields: this.collection.intersectedFields,
                        eventRenderers: this.collection.eventRenderers,
                        selectedFields: this.collection.selectedFields
                    },
                    selectableFields: this.options.selectableFields,
                    allowRowExpand: this.options.allowRowExpand
                });

                  
                if (this.options.headerMode==='dock') {
                    this.children.tableDock = new TableDock({
                        el: this.el,
                        offset: this.options.headerOffset,
                        defaultLayout: 'fixed'
                    });
                } else if (this.options.headerMode === 'static') {
                    // class below enables vertical scrolling - Consumer must set height or use updateContainerHeight()
                    this.children.staticHead = new TableHeadStatic({
                        el: this.el,
                        scrollContainer: '> .vertical-scrolling-table-wrapper',
                        flexWidthColumn: false
                    });
                }

            },
            startListening: function() {
                var modalize = _.debounce(function(idx, optArg) { this.modalize(idx, optArg); }.bind(this), 0);

                /*
                * Funnel all changes on state through a regex to test
                * whether we need to modalize or not. 
                */
                this.listenTo(this.model.state, 'change', function(model) {
                    var key;
                    for (key in model.changed) {
                        if (this.model.state.ROW_EXPAND_REX.test(key)) {
                            if (model.changed[key]) {
                                this.model.state.set('isModalized', true);
                                //intimate knowledge of the keys structure (rethink)
                                modalize.call(this, +/\d+/.exec(key)[0], true);
                                this.children.tableDock && this.children.tableDock.disable();
                                this.children.staticHead && this.children.staticHead.deactivate();
                            } else {
                                this.model.state.set('isModalized', false);
                                modalize.call(this);
                                this.children.tableDock && this.children.tableDock.enable();
                                this.children.staticHead && this.children.staticHead.activate();
                            }
                            break;
                        }
                    }
                });

                /*
                * Again, promiscuous in the sense that we have intimate knowledge of the key,
                * allowing us to fire change that only one observer will acknowledge
                */
                this.listenTo(this.children.modalize, 'unmodalize', function(idx) {
                    this.model.state.set('r'+idx, false);
                    this.updateIntersectedFields();
                });

                this.listenTo(this.model.state, 'init-draggable', this.initDraggable);
               
                this.listenTo(this.collection.selectedFields, 'reset add remove', function(model, collection, options) {
                    // handles reset event callback which has different arguments than add/remove
                    if (!options) {
                        options = collection;
                        collection = model;
                        model = undefined;
                    }
                    if (this.model.state.get('isModalized')) {
                        return;
                    }
                    if (model && (model.get('name') === this.model.report.entry.content.get('display.events.table.sortColumn'))) {
                        this.model.report.entry.content.set({
                            'display.events.table.sortColumn': '',
                            'display.events.table.sortDirection': ''
                        }); 
                    }
                    this.updateIntersectedFields();
                    modalize(this.model.state.get('modalize'), 'table');
                });

                this.listenTo(this.model.result.results, 'reset', function() {
                    if (!this.model.state.get('isModalized')) {
                        this.updateIntersectedFields();
                    }
                });

                this.listenTo(this.model.report.entry.content, 'change:display.events.rowNumbers', this.showHideRowNum);
                
                this.listenTo(this.model.report.entry.content, 'change:display.events.table.wrap', this.updateTableHead);

                this.listenTo(this.model.report.entry.content, 'change:display.page.search.showFields', this.updateTableHead);
                
                if (this.options.selectableFields && this.children.tableDock) {
                    this.listenTo(this.children.tableDock, 'updated', this.initDraggable);
                }
                
                this.listenTo(this.children.body, 'rows:pre-remove', function() { this.$el.css('minHeight', this.$el.height()); });
                this.listenTo(this.children.body, 'rows:added', function() { 
                    this.$el.css('minHeight', '');
                    this.updateTableHead(); 
                });
            },
            activate: function(options) {
                options = options || {};
                options.startListening = false;
                if (this.active) {
                    return BaseView.prototype.activate.apply(this, arguments);
                }
                this.stopListening();
                this.startListening();
                this.updateIntersectedFields();
                this.showHideRowNum();
                return BaseView.prototype.activate.call(this, options);
            },
            deactivate: function(options) {
                if (!this.active) {
                    return BaseView.prototype.deactivate.apply(this, arguments);
                }
                
                //once delegates can easily cleanup dom they create we can remove this.
                this.$('.header-table-docked').remove();

                BaseView.prototype.deactivate.apply(this, arguments);
                return this;
            },
            updateIntersectedFields: function() {
                var fields = [], models = [];
                if(!!this.model.result.results.length){
                    _.each(_(this.collection.selectedFields.pluck('name')).intersection(this.model.result.fields.pluck('name')), function(value) {
                        models.push({name: value});
                    });
                    this.collection.intersectedFields.reset(models); 
                }
            },
            showHideRowNum: function() {
                var $table = this.$('#' + this.tableId),
                    hasRowNumbers = util.normalizeBoolean(this.model.report.entry.content.get('display.events.rowNumbers'));

                if (hasRowNumbers) {
                    $table.removeClass('hide-line-num');
                } else {
                    $table.addClass('hide-line-num');
                }
            },
            remove: function() {
                BaseView.prototype.remove.apply(this, arguments);
                $(window).off('.'+this.cid);
            },
            reflow: function() {
                BaseView.prototype.reflow.apply(this, arguments);
                if(this.isAttachedToDocument() && this.children.head.$el.is(':visible')) {
                    this.updateTableHead();
                }
                return this;
            },
            style: function() {
                var maxWidth=this.$el.width();
                return '#' + this.tableId + " .table-expanded{max-width:" + (maxWidth ? maxWidth - 80 : 500) + "px}";
            },
            modalize: function(idx, optArg) {
                this.children.modalize.show(idx, optArg);
            },
            render: function() {
                this.$el.html(this.compiledTemplate({
                     hidelinenums: !util.normalizeBoolean(this.model.report.entry.content.get("display.events.rowNumbers")),
                     addstatichead: !!this.children.staticHead,
                     tableId: this.tableId
                }));
                this.children.head.render().appendTo(this.$('#' + this.tableId));
                this.children.body.render().appendTo(this.$('#' + this.tableId));
                return this;
            },
            initDraggable: function() {
                if (this.options.selectableFields) {
                    this.drag.$theads = this.$el.find('.reorderable');
                    //TO DO!!!!!!!!
                    //1) Needs to add draggables to the dockable header;
                    //2) Needs to get called after table header, body and header dock are fully rendered;
                    this.drag.$theads.draggable({
                        helper: this.dragHelper.bind(this),
                        start: this.startDrag.bind(this),
                        stop: this.stopDrag.bind(this),
                        drag: this.dragged.bind(this), 
                        containment: this.el,
                        distance: 5,
                        scroll: true
                    });
                }
            },
            updateTableHead: function() {
                if (this.children.tableDock) {
                    _.defer(this.children.tableDock.update.bind(this.children.tableDock));
                } else if (this.children.staticHead) {
                    // staggered defers to ensure scroll bar UI updates are flushed
                    // before subsequent dependent static head UI updates
                    _.defer(function(){
                        this.updateContainerHeight();
                        _.defer(function(){
                            this.children.staticHead.update();
                        }.bind(this));
                    }.bind(this));
                }
            },
            updateContainerHeight: function(height) {
                // use this during 'static' header mode to update vertical scroll bars.
                // If no height argument set, this maxes out table wrapper height to available window size
                if (height) {
                    this.$('> .vertical-scrolling-table-wrapper').css('height', height);
                } else {
                    this.$('> .vertical-scrolling-table-wrapper').css('max-height', $(window).height() - this.$el.offset().top);
                }
            },
            dragHelper: function(e, ui) {
                this.drag.$th = $(e.currentTarget).addClass('moving');
                this.drag.thOffsetTop = this.drag.$th.offset().top;
                this.drag.containerLeft = this.$el.position().left;
                this.drag.$insertionCursor = this.$('.table-insertion-cursor');
                    
                this.drag.$insertionCursor.show();
                this.drag.$helper = $("<div class='reorderable-helper'><span class='reorderable-label'>" + this.drag.$th.text() + "</span></div>").appendTo(this.$el);
                this.drag.$helper.width(this.drag.$th.width());
                this.drag.$helper.css('marginRight', -this.drag.$th.width() + 'px');
                this.findInsertionPoints();
                return this.drag.$helper[0];
            },
            findInsertionPoints: function() {
                this.drag.insertionPoints = [];
                var $headers = this.$('#' + this.tableId + ' > thead > tr > th.reorderable');
                var originalEl = $headers.filter('[data-name=' + this.drag.$th.data('name') + ']')[0]; //this compensates for the possibility of dragging the docked clone
                var originalIndex = this.drag.originalIndex = $headers.index(originalEl);
                
                $headers.each(function(index, el) {
                    var $el = $(el),
                        left = $el.position().left + this.$el.scrollLeft(); 
                        
                    if (index < originalIndex ) { 
                        this.drag.insertionPoints.push({left: left, index: index});
                    } else if (index == originalIndex ) { 
                        this.drag.insertionPoints.push({left: left, index: index});
                        this.drag.insertionPoints.push({left:left + $el.outerWidth(), index: index});
                    } else {
                        this.drag.insertionPoints.push({left:left + $el.outerWidth(), index: index});
                    }
                }.bind(this));
            },
            findClosestInsertion: function(e, ui) {
                if(ui.helper.offset().top - this.drag.thOffsetTop > 100) {
                    return -1;
                } else {
                    var closest = -1,
                        closestDistance = 10000000,
                        cursorLeft = (e.pageX - this.drag.containerLeft) + this.$el.scrollLeft();
                        
                        $.each(this.drag.insertionPoints, function name(index, point) {
                            var distance = Math.abs(point.left - cursorLeft);
                            if (distance < closestDistance) {
                                closest = point;
                                closestDistance = distance;
                            }   
                        });
                   return closest;
                }
            },
            startDrag: function(e, ui){
                    //TO DO!!!!!!!!
                    //need to stop rendering;
            }, 
            stopDrag: function(e, ui){
                var closest = this.findClosestInsertion(e, ui),
                    movingModel = this.collection.selectedFields.findWhere({'name': this.drag.$th.data().name});
                if (closest == -1) {
                    this.collection.selectedFields.remove(movingModel);
                } else if (closest.index !== this.drag.originalIndex) {
                    this.collection.selectedFields.remove(movingModel, {silent: true});
                    this.collection.selectedFields.add(movingModel, {at: closest.index});
                }
                this.drag.$th.removeClass('moving');
                this.drag.$insertionCursor.hide();
            },
            dragged: function(e, ui) {
                var closest = this.findClosestInsertion(e, ui);
                if (closest === -1) { 
                    this.drag.$insertionCursor.hide();
                    ui.helper.addClass("reorderable-remove");
                } else {
                    this.drag.$insertionCursor.show().css('left', closest.left);
                    ui.helper.removeClass("reorderable-remove");
                }
            },
            template: '\
                <% if (addstatichead) { %>\
                    <div class="header-table-static"></div>\
                    <div class="vertical-scrolling-table-wrapper">\
                <% } %>\
                <table class="table table-chrome table-striped <% if(hidelinenums){ %> hide-line-num <% } %> table-row-expanding events-results events-results-table" id="<%= tableId %>"></table>\
                <% if (addstatichead) { %>\
                    </div>\
                <% } %>\
                <div class="table-insertion-cursor"></div>\
            '
        });
    }
);

define('views/shared/eventsviewer/Master',
    [
        'jquery',
        'underscore',
        'module',
        'models/Base',
        'models/services/search/jobs/Result',
        'models/services/search/IntentionsParser',
        'views/Base',
        'views/shared/eventsviewer/list/Master',
        'views/shared/eventsviewer/table/Master'
    ],
    function($, _, module, BaseModel, ResultModel, IntentionsParser, BaseView, EventsListRawView, EventsTableView){
        var ROW_EXPAND_REX = /r\d+/; 
        return BaseView.extend({
            moduleId: module.id,
            /**
             * @param {Object} options {
             *     model: {
             *         result: <models.services.search.jobs.ResultsV2>,
             *         summary: <model.services.search.jobs.SummaryV2>,
             *         searchJob: <models.Job>,
             *         report: <models.services.SavedSearch>,
             *         application: <models.Application>,
             *         state: <models.BaseV2> (optional)
             *     },
             *     collection: {
             *         selectedFields: <collections.SelectedFields>
             *         eventRenderers: <collections.services.configs.EventRenderers>,
             *         workflowActions: <collections.services.data.ui.WorkflowActions>,
             *     },
             *     selectableFields: true|false,
             *     sortableFields: true|false (default true),
             *     headerMode: dock|static|none (default),
             *     headerOffset: integer (only applicable with headerMode=dock),
             *     allowRowExpand: true|false
             * }
             */
            initialize: function(){
                BaseView.prototype.initialize.apply(this, arguments);

                this.options = $.extend(true, {
                    selectableFields: true,
                    sortableFields: true,
                    headerMode: 'dock',
                    headerOffset: 0,
                    allowRowExpand: true,
                    scrollToTopOnPagination: false,
                    defaultDrilldown: true
                }, this.options);
                
                this.rendered = {
                    listraw: false,
                    table: false
                };


                //CLONE RESULTS 
                this.model._result      = new ResultModel();
                this.model.state        =  this.model.state || new BaseModel();
                this.model.listrawState =  new BaseModel();
                this.model.tableState   =  new BaseModel();
                this.model.intentions   =  new IntentionsParser();


                /*
                 * Due to mediation of info to/from the row level views regarding 
                 * row expansion we need to store a rex that matches the structure
                 * of the rows expand key. 
                 */
                this.model.state.ROW_EXPAND_REX        = ROW_EXPAND_REX;
                this.model.listrawState.ROW_EXPAND_REX = ROW_EXPAND_REX;
                this.model.tableState.ROW_EXPAND_REX   = ROW_EXPAND_REX;

                this.children.listraw = new EventsListRawView({
                    model: { 
                        result: this.model._result,
                        summary: this.model.summary,
                        searchJob: this.model.searchJob,
                        report: this.model.report,
                        application: this.model.application,
                        state: this.model.listrawState
                    },
                    collection: {
                        selectedFields: this.collection.selectedFields,
                        eventRenderers: this.collection.eventRenderers,
                        workflowActions: this.collection.workflowActions
                    },
                    selectableFields: this.options.selectableFields,
                    headerMode: this.options.headerMode,
                    headerOffset: this.options.headerOffset,
                    allowRowExpand: this.options.allowRowExpand
                });
                
                this.children.table = new EventsTableView({
                    model: { 
                        result: this.model._result,
                        summary: this.model.summary,
                        searchJob: this.model.searchJob,
                        report: this.model.report,
                        application: this.model.application,
                        state: this.model.tableState
                    },
                    collection: {
                        selectedFields: this.collection.selectedFields,
                        eventRenderers: this.collection.eventRenderers,
                        workflowActions: this.collection.workflowActions
                    },
                    selectableFields: this.options.selectableFields,
                    sortableFields: this.options.sortableFields,
                    headerMode: this.options.headerMode,
                    headerOffset: this.options.headerOffset,
                    allowRowExpand: this.options.allowRowExpand
                });
                
                /*
                 * This is called in initialize purely for backwards compatibility. Eventually,
                 * this views activate should be slave to its parent invoking it. 
                 */
                this.activate({stopRender: true});
            },
            startListening: function() {
                this.listenTo(this.model.result.results, 'reset', function() {
                    if (this.model.state.get('isModalized')) {
                        this.model.state.set('pendingRender', true);
                    } else {
                        var responseText = this.model.result.responseText ? JSON.parse(this.model.result.responseText) : {};
                        this.model._result.setFromSplunkD(responseText, {skipStoringResponseText: true});
                    }
                });

                /*
                 * A click on the docked controls needs to be mediated back
                 * down to unmodalize the table.
                 */
                this.listenTo(this.model.state, 'unmodalize', function() {
                    var key, state = this.getType() + 'State';

                    for (key in this.model[state].toJSON()) {
                        if (ROW_EXPAND_REX.test(key) && this.model[state].get(key)) {
                            this.model[state].set(key, false);        
                            break;
                        }
                    }
                    
                    this.handlePendingRender();
                });

                /*
                 * Proxy modalize state information up to the top-level state model
                 * to inform eventspane controls of the state change.
                 */
                this.listenTo(this.model.listrawState, 'change:isModalized', function(model, value) {
                    this.model.state.set('isModalized', value);  
                });

                this.listenTo(this.model.tableState, 'change:isModalized', function(model, value) {
                    this.model.state.set('isModalized', value);  
                });
                
                this.listenTo(this.model.state, 'change:isModalized', this.handlePendingRender);
                
                //Drilldown related handlers.....................
                this.listenTo(this.model.intentions, 'change', function() {
                    this.model.state.trigger('unmodalize'); 
                    this.model.report.entry.content.set('search', this.model.intentions.fullSearch());
                });
                
                this.listenTo(this.model.tableState, 'drilldown', this.drilldownHandler);
                this.listenTo(this.model.listrawState, 'drilldown', this.drilldownHandler);

                this.listenTo(this.model.report.entry.content, 'change:display.events.type', function(model, value, options) {
                    var previousType = model.previousAttributes()['display.events.type'];
                    if (value === 'table' || previousType === 'table') {
                        this.manageStateOfChildren(); 
                    } 
                });
                
                this.listenTo(this.model.state, 'change:fieldpicker', function() { 
                    this.children.table && this.children.table.updateTableHead();
                });

                this.listenTo(this.model.report.entry.content, 'change:display.page.search.showFields', function() {
                    this.children.table.updateTableHead();
                    this.children.listraw.updateTableHead();
                });
                
                this.listenTo(this.model.report.entry.content, 'change:display.prefs.events.offset', function() {
                    if (this.options.scrollToTopOnPagination) {
                        var containerTop = this.$el.offset().top,
                            currentScrollPos = $(document).scrollTop(),
                            headerHeight = this.$el.children(':visible').find('thead:visible').height(),
                            eventControlsHeight = $('.events-controls-inner').height();
                        if (currentScrollPos > containerTop) {
                            $(document).scrollTop(containerTop - (headerHeight + eventControlsHeight));
                        }
                    }
                });
            },
            activate: function(options) {
                var clonedOptions = _.extend({}, (options || {}));
                delete clonedOptions.deep;
                
                if (this.active) {
                    return BaseView.prototype.activate.call(this, clonedOptions);
                }

                this.model._result.setFromSplunkD(this.model.result.responseText ? JSON.parse(this.model.result.responseText) : {});

                BaseView.prototype.activate.call(this, clonedOptions);
                
                this.manageStateOfChildren(clonedOptions);
                
                return this; 
            },
            deactivate: function(options) {
                if (!this.active) {
                    return BaseView.prototype.deactivate.apply(this, arguments);
                }
                
                //destroy the modalize state
                if (this.model.state.get('isModalized')){
                    this.model.state.trigger('unmodalize');
                    this.model.state.set('isModalized', false);
                }
                
                BaseView.prototype.deactivate.apply(this, arguments);

                //clear any stale attrs
                this.model._result.clear();
                this.model.intentions.clear();
                this.model.listrawState.clear();
                this.model.tableState.clear();
                return this;
            },
            drilldownHandler: function(drilldownInfo) {
                var drilldown = this.getDrilldownCallback(drilldownInfo.data, drilldownInfo.noFetch);

                if(this.options.defaultDrilldown) {
                    drilldown();    
                }
                
                this.trigger('drilldown', drilldownInfo, drilldown);
            },
            getDrilldownCallback: function(data, noFetch) {
                var that = this;
                return function() {
                    if(noFetch) {
                        that.model.state.trigger('unmodalize');
                        that.model.report.entry.content.set(data);
                        return $.Deferred().resolve();   
                    } else {
                        return that.model.intentions.fetch({ data: data });
                    }
                };
            },
            events: {
                'click .header-table-docked.disabled': function(e) {
                    this.model.state.trigger('unmodalize');
                    e.preventDefault();
                }
            },
            handlePendingRender: function() {
                if (this.model.state.get('pendingRender')) {
                    var responseText = this.model.result.responseText ? JSON.parse(this.model.result.responseText) : {};
                    this.model._result.setFromSplunkD(responseText, {clone: true});
                    this.model.state.set('pendingRender', false);
                }
            },
            getType: function() {
                var type = this.model.report.entry.content.get('display.events.type');
                return (type === 'table') ? 'table': 'listraw';
            },
            manageStateOfChildren: function(options) {
                options || (options = {});

                var type = this.getType();
                
                if(!options.stopRender) {
                    this._render(type);
                }
                
                switch (type) {
                    case 'listraw':
                        this.children.listraw.activate({deep: true}).$el.show();
                        this.children.table.deactivate({deep: true}).$el.hide();
                        break;
                    case 'table':
                        this.children.listraw.deactivate({deep: true}).$el.hide();
                        this.children.table.activate({deep: true}).$el.show();
                        break;
                    default:
                        this.children.listraw.deactivate({deep: true}).$el.hide();
                        this.children.table.deactivate({deep: true}).$el.hide();
                        break;
                }
            },
            updateTableHead: function() {
                this.children[this.getType()].updateTableHead();
            },
            updateContainerHeight: function(height) {
                // use this during 'static' header mode to update vertical scroll bars.
                // If no height argument set, this maxes out wrapper height to available window size
                this.children[this.getType()].updateContainerHeight(height);
            },
            _render: function(type) {
                if(!this.rendered[type]) {
                    this.children[type].render().appendTo(this.$el);
                    this.rendered[type] = true;
                }
            },
            render: function() {
                this._render(this.getType());
                return this;
            }
        });
    }
);

requirejs.s.contexts._.nextTick = function(f){f()}; require(['css'], function(css) { css.addBuffer('splunkjs/css/events-viewer.css'); }); requirejs.s.contexts._.nextTick = requirejs.nextTick;
define('splunkjs/mvc/eventsviewerview',['require','exports','module','jquery','underscore','splunk.util','collections/search/SelectedFields','collections/services/configs/EventRenderers','collections/services/data/ui/WorkflowActions','models/search/Job','models/services/search/jobs/Result','splunk.config','models/services/search/jobs/Summary','util/console','views/shared/eventsviewer/Master','./basesplunkview','./messages','./mvc','./paginatorview','./utils','./sharedmodels','util/general_utils','./tokenawaremodel','models/search/Report','./drilldown','css!../css/events-viewer'],function(require, exports, module) {
    var $ = require("jquery");
    var _ = require("underscore");
    var SplunkUtil = require("splunk.util");
    var SelectedFieldsCollection = require("collections/search/SelectedFields");
    var EventRenderersCollection = require("collections/services/configs/EventRenderers");
    var WorkflowActionsCollection = require("collections/services/data/ui/WorkflowActions");
    var SearchJobModel = require("models/search/Job");
    var ResultModel = require("models/services/search/jobs/Result");
    var splunkConfig = require('splunk.config');
    var SummaryModel = require("models/services/search/jobs/Summary");
    var console = require("util/console");
    var EventsViewerMaster = require("views/shared/eventsviewer/Master");
    var BaseSplunkView = require("./basesplunkview");
    var Messages = require("./messages");
    var mvc = require("./mvc");
    var PaginatorView = require("./paginatorview");
    var Utils = require("./utils");
    var sharedModels = require('./sharedmodels');
    var GeneralUtils = require('util/general_utils');
    var TokenAwareModel = require('./tokenawaremodel');
    var ReportModel = require('models/search/Report');
    var Drilldown = require('./drilldown');

    require("css!../css/events-viewer");

    // This regex will take a space or comma separated list of fields, with quotes
    // for escaping strings with spaces in them, and match each individual
    // field.
    var fieldSplitterRegex = /(["'].*?["']|[^"',\s]+)(?=\s*|\s*,|\s*$)/g;

    // This regex will take a string that may or may not have leading quotes,
    // and strip them.
    var quoteStripperRegex = /^["']|["|']$/g;

    var EventsViewerView = BaseSplunkView.extend({

        className: "splunk-events-viewer",

        options: {
            "managerid": null,
            "data": "events",
            "showPager": true,
            "pagerPosition": "bottom",
            "drilldownRedirect": true,
            "maxCount" : 100
        },

        reportDefaults: {
            "display.events.fields": '["host", "source", "sourcetype"]',
            "display.events.type": "list",
            "display.prefs.events.count": 10,
            "display.events.rowNumbers": "1",
            "display.events.maxLines": "5",
            "display.events.histogram": "0",
            "display.events.raw.drilldown": "full",
            "display.events.list.wrap": "1",
            "display.events.list.drilldown": "full",
            "display.events.table.wrap": "1",
            "display.events.table.drilldown": "1",
            "display.events.table.sortDirection": "asc"
        },

        omitFromSettings: ["el", "id", "name", "manager",
            "reportModel", "displayRowNumbers", "segmentation",
            "softWrap"],

        normalizeOptions: function(settings, options) {
            if (options.hasOwnProperty("rowNumbers")) {
                if(GeneralUtils.isBooleanEquivalent(options.rowNumbers)) {
                    settings.set("rowNumbers", GeneralUtils.normalizeBoolean(options.rowNumbers) ? "1" : "0");
                } else {
                    settings.set("rowNumbers", options.rowNumbers);
                }
            } else if (options.hasOwnProperty("displayRowNumbers")) {
                settings.set("rowNumbers", SplunkUtil.normalizeBoolean(options.displayRowNumbers) ? "1" : "0");
            }

            if (options.hasOwnProperty('drilldown')) {
                this._applyDrilldownType(options.drilldown, settings);
            }
            if (options.hasOwnProperty("raw.drilldown")) {
                settings.set("raw.drilldown", options["raw.drilldown"]);
            } else if (options.hasOwnProperty("segmentation") && !options.hasOwnProperty('drilldown')) {
                settings.set("raw.drilldown", options.segmentation);
            }

            if (options.hasOwnProperty("list.drilldown")) {
                settings.set("list.drilldown", options["list.drilldown"]);
            } else if (options.hasOwnProperty("segmentation") && !options.hasOwnProperty('drilldown')) {
                settings.set("list.drilldown", options.segmentation);
            }

            if (options.hasOwnProperty("table.drilldown")) {
                var drilldown = options["table.drilldown"];
                if (drilldown === 'all') {
                    drilldown = true;
                } else if (drilldown === 'none') {
                    drilldown = false;
                }

                if(GeneralUtils.isBooleanEquivalent(drilldown)) {
                    settings.set("table.drilldown", GeneralUtils.normalizeBoolean(drilldown) ? "1" : "0");
                } else {
                    settings.set("table.drilldown", drilldown);
                }
            } else if (options.hasOwnProperty("segmentation")) {
                settings.set("table.drilldown", (options.segmentation !== "none") ? "1" : "0");
            }

            if (options.hasOwnProperty("list.wrap")) {
                if(GeneralUtils.isBooleanEquivalent(options["list.wrap"])) {
                    settings.set("list.wrap", GeneralUtils.normalizeBoolean(options["list.wrap"]) ? "1" : "0");
                } else {
                    settings.set("list.wrap", options["list.wrap"]);
                }
            } else if (options.hasOwnProperty("softWrap")) {
                settings.set("list.wrap", SplunkUtil.normalizeBoolean(options.softWrap) ? "1" : "0");
            }

            if (options.hasOwnProperty("table.wrap")) {
                if(GeneralUtils.isBooleanEquivalent(options["table.wrap"])) {
                    settings.set("table.wrap", GeneralUtils.normalizeBoolean(options["table.wrap"]) ? "1" : "0");
                } else {
                    settings.set("table.wrap", options["table.wrap"]);
                }
            } else if (options.hasOwnProperty("softWrap")) {
                settings.set("table.wrap", SplunkUtil.normalizeBoolean(options.softWrap) ? "1" : "0");
            }

            if (!options.hasOwnProperty("count") && !settings.has("count")) {
                settings.set("count", this.reportDefaults['display.prefs.events.count']);
            }

            if (!options.hasOwnProperty("maxLines") && !settings.has("maxLines")) {
                settings.set("maxLines", this.reportDefaults['display.events.count'].toString());
            } else {
                settings.set("maxLines", settings.get('maxLines').toString());
            }
        },

        initialize: function(options) {
            this.configure();
            this.model = this.options.reportModel || TokenAwareModel._createReportModel(this.reportDefaults);
            this.settings._sync = Utils.syncModels({
                source: this.settings,
                dest: this.model,
                prefix: "display.events.",
                include: ["fields", "type", "count", "rowNumbers", "maxLines", "raw.drilldown", "list.drilldown",
                    "list.wrap", "table.drilldown", "table.wrap", "table.sortDirection", "table.sortColumn"],
                exclude: ["drilldownRedirect", "managerid"],
                auto: true,
                alias: {
                    count: 'display.prefs.events.count'
                }
            });
            this.settings.on("change", this.onSettingsChange, this);
            this.model.on("change", this.onReportChange, this);

            this.normalizeOptions(this.settings, options);

            this.resultModel = new ResultModel();

            this.summaryModel = new SummaryModel();

            this.searchJobModel = new SearchJobModel();

            this.reportModel = new ReportModel();
            this.reportModel._syncPush = Utils.syncModels({
                source: this.model,
                dest: this.reportModel.entry.content,
                tokens: false,
                auto: 'push'
            });
            this.reportModel._syncPull = Utils.syncModels({
                source: this.model,
                dest: this.reportModel.entry.content,
                tokens: false,
                include: ['display.events.table.sortColumn','display.events.table.sortDirection'],
                auto: 'pull'
            });
            this.listenTo(this.reportModel, 'eventsviewer:drilldown', this.handleMiscDrilldown);

            this.applicationModel = sharedModels.get("app");

            this.selectedFieldsCollection = new SelectedFieldsCollection();

            this.workflowActionsCollection = new WorkflowActionsCollection();
            this.workflowActionsCollection.fetch({
                data: {
                    app: this.applicationModel.get("app"),
                    owner: this.applicationModel.get("owner"),
                    count: -1,
                    sort_key: "name"
                },
                success: _.bind(function() {
                    this._isWorkflowActionsCollectionReady = true;
                    this.render();
                }, this)
            });

            this.eventRenderersCollection = new EventRenderersCollection();
            this.eventRenderersCollection.fetch({
                success: _.bind(function() {
                    this._isEventRenderersCollectionReady = true;
                    this.render();
                }, this)
            });

            this._lastJobFetched = null;

            this.updateSelectedFields();
            this.bindToComponentSetting('managerid', this.onManagerChange, this);
            
            this.eventsViewer = new EventsViewerMaster({
                model: {
                    result: this.resultModel,  // <models.services.search.jobs.Results>
                    summary: this.summaryModel,  // <models.services.search.jobs.Summary>
                    searchJob: this.searchJobModel,  // <models.Job>
                    report: this.reportModel,  // <models.services.SavedSearch>
                    application: this.applicationModel//,  // <models.Application>
                },
                collection: {
                    selectedFields: this.selectedFieldsCollection,  // <collections.SelectedFields>
                    workflowActions: this.workflowActionsCollection,  // <collections.services.data.ui.WorkflowActions>
                    eventRenderers: this.eventRenderersCollection  // <collections/services/configs/EventRenderers>
                },
                selectableFields: false,  // true|false
                headerMode: "none",  // dock|none (eventually this will have static mode)
                allowRowExpand: true,  // true|false
                defaultDrilldown: false
            });
            this.listenTo(this.eventsViewer, 'drilldown', this.emitDrilldownEvent);

            // If we don't have a manager by this point, then we're going to
            // kick the manager change machinery so that it does whatever is
            // necessary when no manager is present.
            if (!this.manager) {
                this.onManagerChange(mvc.Components, null);
            }
        },

        onManagerChange: function(ctxs, manager) {
            if (this.manager) {
                this.manager.off(null, null, this);
                this.manager = null;
            }
            if (this.eventData) {
                this.eventData.off();
                this.eventData.destroy();
                this.eventData = null;
            }
            if (this.summaryData) {
                this.summaryData.off();
                this.summaryData.destroy();
                this.summaryData = null;
            }

            this._searchStatus = null;
            this._eventCount = 0;
            this._isSummaryModelReady = false;
            this._isSearchJobModelReady = false;
            this._lastJobFetched = null;

            this.resultModel.setFromSplunkD({});
            this.summaryModel.setFromSplunkD({});

            if (!manager) {
                this._searchStatus = { state: "nomanager" };
                this.render();
                return;
            }

            // Clear any messages, since we have a new manager.
            this._searchStatus = { state: "start" };

            this.manager = manager;
            this.manager.on("search:start", this.onSearchStart, this);
            this.manager.on("search:progress", this.onSearchProgress, this);
            this.manager.on("search:done", this.onSearchDone, this);
            this.manager.on("search:cancelled", this.onSearchCancelled, this);
            this.manager.on("search:refresh", this.onSearchRefreshed, this);
            this.manager.on("search:error", this.onSearchError, this);
            this.manager.on("search:fail", this.onSearchFailed, this);

            this.eventData = this.manager.data("events", {
                autofetch: false,
                output_mode: "json",
                truncation_mode: "abstract"
            });
            this.eventData.on("data", this.onEventData, this);
            this.eventData.on("error", this.onSearchError, this);

            this.summaryData = this.manager.data("summary", {
                autofetch: false,
                output_mode: "json",
                top_count: 10,
                output_time_format: "%d/%m/%y %l:%M:%S.%Q %p"
            });
            this.summaryData.on("data", this.onSummaryData, this);
            this.summaryData.on("error", this._onSummaryError, this);

            // Handle existing job
            var content = this.manager.get("data");
            if (content && content.eventAvailableCount) {
                this.onSearchStart(content);
                this.onSearchProgress({ content: content });
                if (content.isDone) {
                    this.onSearchDone({ content: content });
                }
            } else {
                this.render();
            }
            manager.replayLastSearchEvent(this);
        },

        _fetchJob: function(job) {
            this._isRealTimeSearch = job.isRealTimeSearch;
            if (this._lastJobFetched !== job.sid || !this._isSearchJobModelReady) {
                this._lastJobFetched = job.sid;
                this.searchJobModel.set("id", job.sid);
                var state = this.manager.job.state();
                if (_(state).size() === 0) {
                    return;
                }
                this.searchJobModel.setFromSplunkD({ entry: [state] });
                if (!this._isSearchJobModelReady) {
                    this._isSearchJobModelReady = true;
                    this.render();
                }

            }
        },

        onSearchStart: function(job) {
            this._searchStatus = { state: "running" };
            this._eventCount = 0;
            this._statusBuckets = undefined;
            this._lastJobFetched = null;
            this._isSummaryModelReady = false;
            this._isSearchJobModelReady = false;

            this.resultModel.setFromSplunkD({});
            this.summaryModel.setFromSplunkD({});
            this._fetchJob(job);

            this.render();
        },

        onSearchProgress: function(properties) {
            this._searchStatus = { state: "running" };
            properties = properties || {};
            var job = properties.content || {};
            var eventCount = job.eventAvailableCount || 0;
            var statusBuckets = this._statusBuckets = job.statusBuckets || 0;
            var searchString = properties.name;
            var isRealTimeSearch = job.isRealTimeSearch;
            this._fetchJob(job);

            // If we have a search string, then we set it on the report model,
            // otherwise things like the intentions parser don't work. We do it
            // silently however to ensure that nobody picks it up until they 
            // need it.
            if (searchString) {
                // Since this search comes from the API, we need to strip away
                // the leading search command safely.
                searchString = SplunkUtil.stripLeadingSearchCommand(searchString);
                this.reportModel.entry.content.set('search', searchString, {silent: true});
            }

            this._eventCount = eventCount;

            if (eventCount > 0) {
                this.updateEventData();
            }

            // (Continuously request realtime summaries, even if there are
            //  no status buckets, as some kind of summary data - even blank
            //  data - is required for the EventsViewerView to display anything.
            //  Non-realtime jobs will eventually complete and get summary data
            //  at that time even if statusBuckets is 0 because we ask for
            //  summary data when the search is done.)
            if (statusBuckets > 0 || isRealTimeSearch) {
                this.updateSummaryData();
            }

            this.render();
        },

        onSearchDone: function(properties) {
            this._searchStatus = { state: "done" };

            properties = properties || {};
            var job = properties.content || {};
            var eventCount = job.eventAvailableCount || 0;
            this._fetchJob(job);

            this._eventCount = eventCount;

            this.updateEventData();
            this.updateSummaryData();
            this.render();
        },

        onSearchCancelled: function() {
            this._searchStatus = { state: "cancelled" };
            this.render();
        },

        onSearchRefreshed: function() {
            this._searchStatus = { state: "refresh" };
            this.render();
        },

        onSearchError: function(message, err) {
            var msg = Messages.getSearchErrorMessage(err) || message;
            this._searchStatus = { state: "error", message: msg };
            this.render();
        },

        onSearchFailed: function(state) {
            var msg = Messages.getSearchFailureMessage(state);
            this._searchStatus = { state: "error", message: msg };
            this.render();
        },

        onEventData: function(model, data) {
            this.resultModel.setFromSplunkD(data);
            this.render();
        },

        onSummaryData: function(model, data) {
            this.summaryModel.setFromSplunkD(data);
            if (!this._isSummaryModelReady) {
                this._isSummaryModelReady = true;
                this.render();
            }
        },
        
        _onSummaryError: function(message, err) {
            this.onSearchError(message, err);
        },

        onSettingsChange: function(model) {
            if (model.hasChanged('fields')) {
                this.updateSelectedFields();
            }
            if (model.hasChanged("showPager") ||
                model.hasChanged("pagerPosition") ||
                model.hasChanged("count") ||
                model.hasChanged("fields")) {
                this.render();
            }
            if (model.hasChanged("showPager") ||
                model.hasChanged("type") ||
                model.hasChanged("count") ||
                model.hasChanged("maxLines") ||
                model.hasChanged("raw.drilldown") ||
                model.hasChanged("table.drilldown") ||
                model.hasChanged("list.drilldown")) {
                this.updateEventData();
            }
            if (model.hasChanged('drilldown')) {
                this._applyDrilldownType(model.get('drilldown'), model);
            } else if (model.hasChanged('table.drilldown') || model.hasChanged('raw.drilldown') ||
                model.hasChanged('list.drilldown')) {
                var segmentation = this.options.segmentation;
                var checkSetting = _.bind(function(settings, value, name) {
                    return settings.get(name+'.drilldown') === value;
                }, null, this.settings);
                if (_({ table: '1', raw: segmentation || 'full', list: segmentation || 'full' }).all(checkSetting)) {
                    this.settings.set('drilldown', 'all');
                } else if (_({ table: '0', raw: 'none', list: 'none' }).all(checkSetting)) {
                    this.settings.set('drilldown', 'none');
                } else {
                    this.settings.unset('drilldown');
                }
            }
        },

        _applyDrilldownType: function(type, settings) {
            // React to changes of the "virtual" drilldown setting
            if (type === 'all') {
                var segmentation = this.options.segmentation || 'full';
                settings.set({
                    'raw.drilldown': segmentation,
                    'list.drilldown': segmentation,
                    'table.drilldown': '1'
                });
            } else if (type === 'none') {
                settings.set({
                    'raw.drilldown': 'none',
                    'list.drilldown': 'none',
                    'table.drilldown': '0'
                });
            }
            if (type) {
                settings.set('drilldown', type, { silent: true });
            }
        },

        onReportChange: function(model) {
            if (model.hasChanged("display.events.table.sortColumn") ||
                model.hasChanged("display.events.table.sortDirection")) {
                this.updateEventData();
            }
        },

        emitDrilldownEvent: function(e, defaultDrilldown) {
            var displayType = this.model.get('display.events.type');
            var drilldownMode = this.settings.get(displayType + '.drilldown');
            if (drilldownMode === 'none' ||
                (displayType === 'table' && SplunkUtil.normalizeBoolean(drilldownMode) === false)) {
                return;
            }
            var field = e.data.field;
            var value = e.data.value;
            if (field === undefined && e.data.action === 'addterm') {
                field = '_raw';
            } else if (field === undefined && e._time) {
                field = '_time';
                value = SplunkUtil.getEpochTimeFromISO(e._time);
            }
            var data = {
                'click.name': field,
                'click.value': value,
                'click.name2': field,
                'click.value2': value
            };
            var idx = e.idx;
            if (idx !== undefined && idx >= 0) {
                var event = this.resultModel.results.at(idx).toJSON();
                if (event) {
                    _.each(event, function(value, field) {
                        data['row.' + field] = value.length > 1 ? value.join(',') : value[0];
                    });
                    var earliest = SplunkUtil.getEpochTimeFromISO(event._time);
                    data.earliest = earliest;
                    data.latest = String(parseFloat(earliest) + 1);
                }
            }

            var defaultDrilldownCallback = _.bind(this._onIntentionsApplied, this, e);
            var reportModel = this.model;
            var payload = Drilldown.createEventPayload({
                field: field,
                data: data,
                event: e
            }, function() {
                var searchAttributes = _.pick(reportModel.toJSON({ tokens: true }),
                    'search', 'dispatch.earliest_time', 'dispatch.latest_time');
                defaultDrilldown()
                    .done(defaultDrilldownCallback)
                    .always(function() {
                        // Restore search settings on the report model
                        reportModel.set(searchAttributes, { tokens: true, silent: true });
                    });
            });
            this.trigger('drilldown click', payload, this);
            if (this.settings.get("drilldownRedirect") && !payload.defaultPrevented()) {
                payload.drilldown();
            }
        },

        _onIntentionsApplied: function(e) {
            var model = this.reportModel.entry.content;
            var search = model.get("search");
            var timeRange = {
                earliest: model.get("dispatch.earliest_time"),
                latest: model.get("dispatch.latest_time")
            };
            if (timeRange.earliest === this.manager.get('earliest_time') &&
                timeRange.latest === this.manager.get('latest_time')) {
                timeRange = Drilldown.getNormalizedTimerange(this.manager);
            }
            var data = _.extend({ q: search }, timeRange);
            var preventRedirect = false;
            this.trigger('drilldown:redirect', { data: data, preventDefault: function() { preventRedirect = true; }});
            if (!preventRedirect) {
                var drilldownFunction = splunkConfig.ON_DRILLDOWN || Drilldown.redirectToSearchPage;
                drilldownFunction(data, e.event.ctrlKey || e.event.metaKey);
            }
        },

        // Handle clicks on links in the field info dropdown ("Top values over time", etc)
        handleMiscDrilldown: function() {
            var drilldownFunction = splunkConfig.ON_DRILLDOWN || Drilldown.redirectToSearchPage;
            var data = {
                q: this.reportModel.entry.content.get('search'),
                earliest: this.reportModel.entry.content.get('dispatch.earliest_time') || '',
                latest: this.reportModel.entry.content.get('dispatch.latest_time') || ''
            };
            drilldownFunction(data);
        },

        onPageChange: function() {
            this.updateEventData();
        },

        updateEventData: function() {
            if (this.eventData) {
                var pageSize = this.paginator ? parseInt(this.paginator.settings.get("pageSize"), 10) : 0;
                var page = this.paginator ? parseInt(this.paginator.settings.get("page"), 10) : 0;
                var type = this.settings.get("type");
                var offset = pageSize * page;
                var count = parseInt(this.settings.get("count"), 10) || this.reportDefaults['display.prefs.events.count'];
                var postProcessSearch = _.isFunction(this.manager.query.postProcessResolve)? this.manager.query.postProcessResolve():"";
                if (this._isRealTimeSearch && !postProcessSearch) {
                    // For real-time searches we want the tail of available events, therefore we set a negative offset
                    // based on the currently selected page
                    offset = 0 - count - offset;
                }
                var maxLines = this.settings.get("maxLines").toString();
                var rawDrilldown = this.settings.get("raw.drilldown");
                var listDrilldown = this.settings.get("list.drilldown");
                var tableSortColumn = this.model.get("display.events.table.sortColumn");
                var tableSortDirection = this.model.get("display.events.table.sortDirection");
                var segmentation = null;
                var search = null;

                // if user explicitly sets count over 100, it will display the default
                count = (count > this.options.maxCount || count < 1) ? this.reportDefaults['display.prefs.events.count'] : count;

                // determine segmentation

                if (type === "raw") {
                    segmentation = rawDrilldown;
                } else if (type === "list") {
                    segmentation = listDrilldown;
                }

                // Ensuring segmentation is one of "inner", "outer", or "full".
                // Although "none" is a valid value for segmentation,
                // and segmentation is an optional parameter for the events endpoint,
                // either case causes the Result model to throw errors.
                segmentation = segmentation ? segmentation.toLowerCase() : null;
                switch (segmentation) {
                    case "inner":
                    case "outer":
                    case "full":
                    case "none":
                        break;
                    default:
                        segmentation = "full";
                        break;
                }

                // determine post process search for table sorting

                if ((type === "table") && tableSortColumn) {
                    if (tableSortDirection === "desc") {
                        search = "| sort " + (offset + count) + " - " + tableSortColumn;
                    } else {
                        search = "| sort " + (offset + count) + " " + tableSortColumn;
                    }
                }

                // add in fields required for events viewer
                // note that we store the fields internally as JSON strings, so
                // we need to parse them out.
                var fields = JSON.parse(this.settings.get("fields"));
                fields = _.union(fields, ['_raw', '_time', '_audit', '_decoration', 'eventtype', 'linecount', '_fulllinecount']);
                if (this._isRealTimeSearch) {
                    fields = _.union(fields, ['_serial', 'splunk_server']);
                }

                // fetch events
                this.eventData.set({
                    offset: offset,
                    count: count,
                    max_lines: maxLines,
                    segmentation: segmentation,
                    search: search,
                    fields: fields
                });

                this.eventData.fetch();
            }
        },

        updateSummaryData: function() {
            if (this.summaryData) {
                this.summaryData.fetch();
            }
        },

        updateSelectedFields: function() {
            var fields = this.settings.get("fields");

            // update selected fields

            if (fields) {
                if (_.isString(fields)) {
                    fields = $.trim(fields);
                    if (fields[0] === '[' && fields.slice(-1) === ']') {
                        // treat fields as JSON if the start and end with a square bracket
                        try {
                            fields = JSON.parse(fields);
                        } catch (e) {
                            // ignore
                        }
                    } else {
                        // Since this is a string, we're going to treat it as a
                        // space separated list of strings, with quoting. This is
                        // similar to what Splunk's 'fields' command takes.
                        fields = _.map(fields.match(fieldSplitterRegex), function(field) {
                            return field.replace(quoteStripperRegex, "");
                        });
                        // Update setting with JSON formatted string
                        this.settings.set('fields', JSON.stringify(fields), {silent: true});
                    }
                } else {
                    // Update setting with JSON formatted string
                    this.settings.set('fields', JSON.stringify(fields), {silent: true});
                }
                // convert list of fields to list of name:field pairs for consumption by backbone collection
                fields = _.map(fields, function(field) {
                    return { name: field };
                });

                // handle fields * case
                if ((fields.length === 0) || (fields[0].name === "*")) {
                    fields = _.filter(this.resultModel.fields.toJSON(), function(field) {
                        return (field.name.charAt(0) !== "_");
                    });
                }
            }
            this.selectedFieldsCollection.reset(fields);
            this.updateEventData();
        },

        render: function() {            
            var searchStatus = this._searchStatus || null;
            var eventCount = this._eventCount || 0;
            var hasStatusBuckets = this._statusBuckets === undefined || this._statusBuckets > 0;
            var isSummaryModelReady = (this._isSummaryModelReady === true);
            var isSearchJobModelReady = (this._isSearchJobModelReady === true);
            var isWorkflowActionsCollectionReady = (this._isWorkflowActionsCollectionReady === true);
            var isEventRenderersCollectionReady = (this._isEventRenderersCollectionReady === true);
            var areModelsReady = (isSummaryModelReady && isSearchJobModelReady && isWorkflowActionsCollectionReady && isEventRenderersCollectionReady);
            var showPager = SplunkUtil.normalizeBoolean(this.settings.get("showPager"));
            var pagerPosition = this.settings.get("pagerPosition");
            var count = parseInt(this.settings.get("count"), 10) || this.reportDefaults['display.prefs.events.count'];

            // if user explicitly sets count over 100, it will display the default
            count = (count > this.options.maxCount || count < 1) ? this.reportDefaults['display.prefs.events.count'] : count;

            // render message
            var message = null;
            if (searchStatus) {
                switch (searchStatus.state) {
                    case "nomanager":
                        message = "no-search";
                        break;
                    case "start":
                        message = "empty";
                        break;
                    case "running":
                        if (eventCount === 0 || !areModelsReady) {
                            message = "waiting";
                        }
                        break;
                    case "cancelled":
                        message = "cancelled";
                        break;
                    case "refresh":
                        message = "refresh";
                        break;
                    case "done":
                        if (eventCount === 0) {
                            message = "no-events";
                        }
                        break;
                    case "error":
                        message = {
                            level: "error",
                            icon: "warning-sign",
                            message: searchStatus.message
                        };
                        break;
                }
            }

            if (message) {
                if (!this.messageElement) {
                    this.messageElement = $('<div class="msg"></div>');
                }

                Messages.render(message, this.messageElement);

                this.$el.append(this.messageElement);
            } else {
                if (this.messageElement) {
                    this.messageElement.remove();
                    this.messageElement = null;
                }
            }

            // render eventsViewer
            if (areModelsReady && searchStatus && !message) {
                if (this.eventsViewer && !this._eventsViewerRendered) {
                    this._eventsViewerRendered = true;
                    this.eventsViewer.render();
                    this.$el.append(this.eventsViewer.el);
                }
                this.eventsViewer.activate({deep: true}).$el.show();
            } else {
                if (this.eventsViewer) {
                    this.eventsViewer.deactivate({deep: true}).$el.hide();
                }
            }

            // render paginator

            if (areModelsReady && searchStatus && !message && showPager) {
                if (!this.paginator) {
                    this.paginator = new PaginatorView({
                        id: _.uniqueId(this.id + "-paginator")
                    });
                    this.paginator.settings.on("change:page", this.onPageChange, this);
                }

                this.paginator.settings.set({
                    pageSize: count,
                    itemCount: eventCount
                });

                if (pagerPosition === "top") {
                    this.$el.prepend(this.paginator.el);
                } else {
                    this.$el.append(this.paginator.el);
                }
            } else {
                if (this.paginator) {
                    this.paginator.settings.off("change:page", this.onPageChange, this);
                    this.paginator.remove();
                    this.paginator = null;
                }
            }

            this.trigger('rendered', this);

            return this;
        },

        remove: function() {
            if (this.eventsViewer) {
                this.eventsViewer.deactivate({deep: true});
                this.eventsViewer.remove();
                this.eventsViewer = null;
            }

            if (this.paginator) {
                this.paginator.settings.off("change:page", this.onPageChange, this);
                this.paginator.remove();
                this.paginator = null;
            }

            if (this.eventData) {
                this.eventData.off();
                this.eventData.destroy();
                this.eventData = null;
            }

            if (this.summaryData) {
                this.summaryData.off();
                this.summaryData.destroy();
                this.summaryData = null;
            }

            if (this.settings) {
                this.settings.off();
                if (this.settings._sync) {
                    this.settings._sync.destroy();
                }
            }

            if (this.reportModel) {
                this.reportModel.off();
                if (this.reportModel._syncPush) {
                    this.reportModel._syncPush.destroy();
                }
                if (this.reportModel._syncPull) {
                    this.reportModel._syncPull.destroy();
                }
            }

            if (this.model) {
                this.model.off("change", this.onReportChange, this);
            }

            BaseSplunkView.prototype.remove.call(this);
        }

    });

    return EventsViewerView;

});

requirejs.s.contexts._.nextTick = function(f){f()}; require(['css'], function(css) { css.setBuffer('.clearfix{*zoom:1;}.clearfix:before,.clearfix:after{display:table;content:\"\";line-height:0;}\n.clearfix:after{clear:both;}\n.hide-text{font:0/0 a;color:transparent;text-shadow:none;background-color:transparent;border:0;}\n.input-block-level{display:block;width:100%;min-height:26px;-webkit-box-sizing:border-box;-moz-box-sizing:border-box;box-sizing:border-box;}\n.ie7-force-layout{*min-width:0;}\n.search-results-wrapper{clear:both;min-height:400px;*zoom:1;}.search-results-wrapper:before,.search-results-wrapper:after{display:table;content:\"\";line-height:0;}\n.search-results-wrapper:after{clear:both;}\n.event .raw-event,.event .json-event{font-family:\'Droid Sans Mono\',\'Consolas\',\'Monaco\',\'Courier New\',Courier,monospace;font-size:12px;color:#333333;border:none;background-color:transparent;margin:auto;padding:0;}.event .raw-event em,.event .json-event em{font-style:normal ;}\n.event .raw-event .a,.event .json-event .a,.event .raw-event .h,.event .json-event .h,.event .raw-event .fields .v:hover,.event .json-event .fields .v:hover,.event .raw-event .fields .tg:hover,.event .json-event .fields .tg:hover,.event .raw-event .time:hover,.event .json-event .time:hover{background-color:#fde9a8;border-top:4px solid #fde9a8;border-bottom:4px solid #fde9a8;color:#32496a;}\n.event .raw-event .key-name,.event .json-event .key-name{color:#d85d3c;font-weight:bold;}\n.event .raw-event .string,.event .json-event .string{color:#1abb97;}\n.event .raw-event .number,.event .json-event .number{color:#956d95;}\n.event .raw-event .boolean,.event .json-event .boolean{color:#f7902b;}\n.event .raw-event .null,.event .json-event .null{color:#f7902b;}\n.shared-eventsviewer th.col-0,.shared-eventsviewer th.line-num,.shared-eventsviewer th.col-time{width:1px;}\n.shared-eventsviewer th.col-time.ie7,.shared-eventsviewer th.col-0.ie7{width:150px;}\n.shared-eventsviewer th.line-num.ie7{width:50px;}\n.shared-eventsviewer th.col-0:last-child,.shared-eventsviewer th.col-time:last-child{width:auto;}\n.shared-eventsviewer th.col-0.ie8{width:auto;}\n.shared-eventsviewer td._time>span>span{white-space:nowrap;}\n.shared-eventsviewer .shared-eventsviewer-table-body-primaryrow>td.no-wrap{white-space:pre;}\n.shared-eventsviewer td.expands.et_blue{background-color:#5379af !important;border-right:1px solid #5379af !important;}.shared-eventsviewer td.expands.et_blue:hover{background-color:#6b8cba !important;}\n.shared-eventsviewer td.expands.et_green{background-color:#9ac23c !important;border-right:1px solid #9ac23c !important;}.shared-eventsviewer td.expands.et_green:hover{background-color:#a8cb57 !important;}\n.shared-eventsviewer td.expands.et_magenta{background-color:#dd86af !important;border-right:1px solid #dd86af !important;}.shared-eventsviewer td.expands.et_magenta:hover{background-color:#e5a2c1 !important;}\n.shared-eventsviewer td.expands.et_orange{background-color:#f7902b !important;border-right:1px solid #f7902b !important;}.shared-eventsviewer td.expands.et_orange:hover{background-color:#f8a24d !important;}\n.shared-eventsviewer td.expands.et_purple{background-color:#956d95 !important;border-right:1px solid #956d95 !important;}.shared-eventsviewer td.expands.et_purple:hover{background-color:#a482a4 !important;}\n.shared-eventsviewer td.expands.et_red{background-color:#d85d3c !important;border-right:1px solid #d85d3c !important;}.shared-eventsviewer td.expands.et_red:hover{background-color:#de765a !important;}\n.shared-eventsviewer td.expands.et_sky{background-color:#6ab7c7 !important;border-right:1px solid #6ab7c7 !important;}.shared-eventsviewer td.expands.et_sky:hover{background-color:#84c4d1 !important;}\n.shared-eventsviewer td.expands.et_teal{background-color:#1abb97 !important;border-right:1px solid #1abb97 !important;}.shared-eventsviewer td.expands.et_teal:hover{background-color:#1edab0 !important;}\n.shared-eventsviewer td.expands.et_yellow{background-color:#fac51c !important;border-right:1px solid #fac51c !important;}.shared-eventsviewer td.expands.et_yellow:hover{background-color:#fbce3f !important;}\n.shared-eventsviewer .event-fields-loading{padding:20px 0;color:#999999;}\n.shared-eventsviewer ul.condensed-selected-fields{margin:5px 0 0 0;max-width:100%;}.shared-eventsviewer ul.condensed-selected-fields li{color:#999999;margin-right:10px;float:left;list-style:none;display:inline;max-width:100%;}.shared-eventsviewer ul.condensed-selected-fields li>:last-child{padding-right:10px;border-right:1px dashed #cccccc;}\n.shared-eventsviewer ul.condensed-selected-fields li:last-child{margin-right:0;}.shared-eventsviewer ul.condensed-selected-fields li:last-child>:last-child{padding-right:0;border-right:none;}\n.shared-eventsviewer ul.condensed-selected-fields li .field-value{display:inline-block;}\n.shared-eventsviewer ul.condensed-selected-fields li .f-v{display:inline-block;max-width:500px;word-wrap:normal;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;vertical-align:top;}\n.shared-eventsviewer ul.condensed-selected-fields li .f-v,.shared-eventsviewer ul.condensed-selected-fields li .more-fields{color:#333333;cursor:pointer;}.shared-eventsviewer ul.condensed-selected-fields li .f-v:hover,.shared-eventsviewer ul.condensed-selected-fields li .more-fields:hover{color:#32496a;}\n.shared-eventsviewer ul.condensed-selected-fields li>.tag{color:inherit;}.shared-eventsviewer ul.condensed-selected-fields li>.tag:hover{color:#32496a;}\n.shared-eventsviewer .formated-time:hover{color:#32496a;text-decoration:underline;cursor:pointer;}\n.shared-eventsviewer .table-embed{margin-top:10px;margin-bottom:0;background-color:transparent;width:auto;clear:left;min-width:0;}.shared-eventsviewer .table-embed th:first-child{padding-left:0;}\n.shared-eventsviewer .table-embed td>a._time-expand{display:inline;margin-left:2px;}\n.shared-eventsviewer .table-embed td>a._time-expand:hover{text-decoration:none;}\n.shared-eventsviewer .table-embed td{border-bottom:none ;line-height:20px;}\n.shared-eventsviewer .table-embed tbody:first-child tr:first-child td{border-top:none ;}\n.shared-eventsviewer .table-embed a{text-decoration:none;display:block;min-width:16px;padding:0 3px;}.shared-eventsviewer .table-embed a:hover{background:#ebebeb;color:#32496a !important;}\n.shared-eventsviewer .table-embed a._time-expand:hover,.shared-eventsviewer .table-embed a.more-fields:hover{text-decoration:underline;background:none;}\n.shared-eventsviewer .table-embed .field-actions{font-size:14px;height:20px;overflow:hidden;text-align:center;padding-right:0;}\n.shared-eventsviewer .table-embed .btn-group{font-size:inherit;}\n.shared-eventsviewer .table-embed .field-type{padding-left:0;}\n.shared-eventsviewer .table-embed .field-key{padding:0 8px 0 0;}\n.shared-eventsviewer .table-embed td.field-value{word-break:break-all;padding-left:0;}\n.shared-eventsviewer .table-embed .field-value a{display:inline-block;}\n.shared-eventsviewer tr.row-more-fields+tr>td{border-top:none;border-bottom:none;}\n.shared-eventsviewer .col-more-fields{padding-left:10px;vertical-align:middle;}\n.shared-eventsviewer .col-visibility{text-align:left;font-size:20px;padding:0 !important;width:auto;}.shared-eventsviewer .col-visibility .checkbox{padding:1px 5px 1px 0;margin:0;}.shared-eventsviewer .col-visibility .checkbox>a,.shared-eventsviewer .col-visibility .checkbox>a:hover{padding:0;color:#333333 !important;}\n.shared-eventsviewer th.col-visibility{padding-bottom:4px !important;}\n.shared-eventsviewer th.col-field-name,.shared-eventsviewer th.col-field-value{padding-left:4px;}\n.shared-eventsviewer a:hover .icon-hidden{color:inherit;}\n.shared-eventsviewer .table-expanded a{color:#5379af !important;}\n.shared-eventsviewer .table-expanded a:hover{color:#32496a !important;}\n.shared-eventsviewer .table{margin-bottom:0;}\n.shared-eventsviewer .hide-line-num th.line-num,.shared-eventsviewer .hide-line-num td.line-num{display:none;}\n.shared-eventsviewer .normal.raw-event{background-color:inherit;border:none;white-space:pre;}\n.shared-eventsviewer .normal.raw-event.wrap{white-space:pre-wrap;word-break:break-all;}\n.shared-eventsviewer .event-actions{margin-top:10px;}\n.shared-eventsviewer .showinline,.shared-eventsviewer .hideinline{white-space:nowrap;word-wrap:normal;display:block;}\n.shared-eventsviewer-list,.shared-eventsviewer-table,.shared-eventsviewer-raw{background:#ffffff;}\n.events-results-table{min-width:100%;width:auto;*width:100%;}.events-results-table>tbody>tr>td>a,.events-results-table>tbody>tr>td>span.field-val{text-decoration:none;display:block;}\n.events-results-table>tbody>tr>td.one-value-drilldown:hover,.events-results-table>tbody>tr>td._time-drilldown:hover,.events-results-table>tbody>tr>td.multi-value-drilldown>a.field-val:hover{background-color:#ffffff;cursor:pointer;}\n.events-results-table>tbody>tr>td.one-value-drilldown:hover>a.field-val,.events-results-table>tbody>tr>td._time-drilldown:hover>a{color:#32496a;}\n.docked-header-table>table{border-top:0;}\n.reorderable{border-left:1px solid #d5d5d5;}\n.reorderable-label{position:relative;display:block;padding:4px 8px 4px 18px;}\n.sorts .reorderable-label:after{font-family:\"Splunk Icons\";content:\"\\2195 \";padding-left:5px;color:#bbbbbb;}\n.sorts.asc .reorderable-label:after,.sorts.Asc .reorderable-label:after{content:\"\\21A5 \";color:#333333;}\n.sorts.desc .reorderable-label:after,.sorts.Desc .reorderable-label:after{content:\"\\21A7 \";color:#333333;}\n.reorderable-helper{background-color:#d85d3c;background-color:#f4f4f4;background-image:-moz-linear-gradient(top, #f8f8f8, #eeeeee);background-image:-webkit-gradient(linear, 0 0, 0 100%, from(#f8f8f8), to(#eeeeee));background-image:-webkit-linear-gradient(top, #f8f8f8, #eeeeee);background-image:-o-linear-gradient(top, #f8f8f8, #eeeeee);background-image:linear-gradient(to bottom, #f8f8f8, #eeeeee);filter:progid:DXImageTransform.Microsoft.gradient(startColorstr=\'#fff8f8f8\', endColorstr=\'#ffeeeeee\', GradientType=0);background-color:#eeeeee;border:1px solid #bfbfbf;border-top-color:#bfbfbf;border-bottom-color:#bfbfbf;color:#333333;-webkit-box-shadow:inset 0px 1px 0 #fdfdfd;-moz-box-shadow:inset 0px 1px 0 #fdfdfd;box-shadow:inset 0px 1px 0 #fdfdfd;background-image:-moz-linear-gradient(top, #f8f8f8, #f8f8f8);background-image:-webkit-gradient(linear, 0 0, 0 100%, from(#f8f8f8), to(#f8f8f8));background-image:-webkit-linear-gradient(top, #f8f8f8, #f8f8f8);background-image:-o-linear-gradient(top, #f8f8f8, #f8f8f8);background-image:linear-gradient(to bottom, #f8f8f8, #f8f8f8);background-repeat:repeat-x;filter:progid:DXImageTransform.Microsoft.gradient(startColorstr=\'#fff8f8f8\', endColorstr=\'#fff8f8f8\', GradientType=0);-webkit-box-shadow:0px 1px 1px rgba(0, 0, 0, 0.08);-moz-box-shadow:0px 1px 1px rgba(0, 0, 0, 0.08);box-shadow:0px 1px 1px rgba(0, 0, 0, 0.08);background-color:#f8f8f8;border-color:#c7c7c7;border-top-color:#c7c7c7;border-bottom-color:#c7c7c7;background-position:0 0;-webkit-border-radius:0;-moz-border-radius:0;border-radius:0;z-index:10;line-height:16px;}\n.reorderable-helper.reorderable-remove{background-color:#fdf7f5;background-image:-moz-linear-gradient(top, #ffffff, #faeae6);background-image:-webkit-gradient(linear, 0 0, 0 100%, from(#ffffff), to(#faeae6));background-image:-webkit-linear-gradient(top, #ffffff, #faeae6);background-image:-o-linear-gradient(top, #ffffff, #faeae6);background-image:linear-gradient(to bottom, #ffffff, #faeae6);background-repeat:repeat-x;filter:progid:DXImageTransform.Microsoft.gradient(startColorstr=\'#ffffffff\', endColorstr=\'#fffaeae6\', GradientType=0);border-color:#cfb3ab;}\nth.reorderable{cursor:move;padding:0;}th.reorderable.sorts:after{display:none;}\n.on.reorderable-label:before{content:\"\";position:absolute;display:block;height:20px;width:7px;background:url(data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAG0lEQVQIW2M0Njb+f/bsWUYYzciABuAyOFUAAKKMEAXhn6ySAAAAAElFTkSuQmCC) repeat;top:3px;left:3px;opacity:0.5;margin-bottom:-10px;}\nth.reorderable.moving{color:transparent;text-shadow:none;background:#cccccc;}\nth.reorderable.moving .reorderable-label:before{background:none;}\nth.reorderable.moving .reorderable-label:after{color:transparent;}\n.table-insertion-cursor{border-left:1px dashed #d85d3c;position:absolute;top:0;left:-100px;bottom:0;margin-left:-1px;display:none;}\n@media print{td.expands,td.actions,th.col-info{display:none !important;} .reorderable-label{padding-left:8px !important;}.reorderable-label:before{background:none !important;} .shared-eventsviewer pre.raw-event{word-break:break-all !important;word-wrap:break-word !important;overflow-wrap:break-word !important;white-space:normal !important;} .shared-eventsviewer,.events-viewer-wrapper{max-width:100% !important;width:100% !important;overflow:hidden !important;}}.shared-fieldinfo{width:600px;}.shared-fieldinfo .popdown-dialog-body{padding:0 20px 20px 20px;}\n.shared-fieldinfo h2{margin:-1px -21px 10px -21px;line-height:40px;font-size:16px;font-weight:normal;color:#333333;padding:0 60px 0 20px;-webkit-border-top-right-radius:3px;-moz-border-radius-topright:3px;border-top-right-radius:3px;-webkit-border-top-left-radius:3px;-moz-border-radius-topleft:3px;border-top-left-radius:3px;border-bottom:1px solid #cccccc;box-shadow:none;*zoom:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}\n.shared-fieldinfo h3{font-size:12px;font-weight:bold;margin:15px 0 0 0;}\n.shared-fieldinfo p{line-height:30px;}\n.shared-fieldinfo .select-field-label{display:inline-block;margin:0 5px 0 20px;line-height:26px;color:#999999;vertical-align:top;}\n.shared-fieldinfo .graph-bar{margin:0 20px 0 0;height:16px;background-color:#999999;background-color:#b8b8b8;background-image:-moz-linear-gradient(top, #cccccc, #999999);background-image:-webkit-gradient(linear, 0 0, 0 100%, from(#cccccc), to(#999999));background-image:-webkit-linear-gradient(top, #cccccc, #999999);background-image:-o-linear-gradient(top, #cccccc, #999999);background-image:linear-gradient(to bottom, #cccccc, #999999);background-repeat:repeat-x;filter:progid:DXImageTransform.Microsoft.gradient(startColorstr=\'#ffcccccc\', endColorstr=\'#ff999999\', GradientType=0);max-width:100%;}\n.shared-fieldinfo table.table-condensed{margin:13px -20px -5px -20px;width:598px;}\n.shared-fieldinfo table.fields{width:100%;}.shared-fieldinfo table.fields td{padding:3px 0px;vertical-align:top;}\n.shared-fieldinfo td.value{max-width:200px;word-wrap:break-word;padding-left:20px;}\n.shared-fieldinfo th.value{padding-left:20px;}\n.shared-fieldinfo ul.inline{line-height:20px;margin-bottom:0;}.shared-fieldinfo ul.inline li{padding-left:0;}\n.shared-fieldinfo .close{display:block;top:12px;right:20px;opacity:0.4;filter:alpha(opacity=40);overflow:hidden;position:absolute;font-size:16px;}.shared-fieldinfo .close:hover{opacity:0.8;filter:alpha(opacity=80);}\n'); }); requirejs.s.contexts._.nextTick = requirejs.nextTick; 
