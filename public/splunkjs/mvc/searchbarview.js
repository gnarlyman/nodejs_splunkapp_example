
define('views/shared/searchbar/Apps',
    [
        'underscore',
        'module',
        'views/shared/controls/SyntheticSelectControl',
        'uri/route'
    ],
    function(_, module, SyntheticSelectControl, route) {
        return SyntheticSelectControl.extend({
            moduleId: module.id,
            initialize: function() {
                this.options = _.defaults({
                    className: 'btn-group',
                    toggleClassName: 'btn',
                    iconURLClassName: "menu-icon",
                    menuClassName: "dropdown-menu-tall dropdown-menu-apps",
                    label: _("App: ").t(),
                    items: [],
                    model: this.model,
                    modelAttribute: 'display.prefs.searchContext',
                    popdownOptions: {attachDialogTo:'body'}
                }, this.options);

                this.collection.on('change', _.debounce(this.update, 0), this);
                SyntheticSelectControl.prototype.initialize.call(this, this.options);

                this.update();
            },
            update: function() {
                var items = [];
                this.collection.each(function(model) {
                    var navData = model.get('navData');
                    if (navData && navData.searchView) {
                        var appmodel = this.options.applicationModel;

                        var appIcon = route.appIconAlt(
                            appmodel.get('root'),
                            appmodel.get('locale'),
                            appmodel.get('owner'),
                            model.get('appName')
                        );

                        items.push({
                            value: model.get('appName'),
                            label: model.get('appLabel'),
                            iconURL: appIcon
                        });
                    }
                }.bind(this));

                this.setItems(items);
            }
        });
    }
);

define('models/search/SearchBar',
    [
        'models/Base'
    ],
    function(BaseModel) {
        return BaseModel.extend({
            initialize: function() {
                BaseModel.prototype.initialize.apply(this, arguments);
            },
            defaults: {
                assistantOpen: false,
                assistantRolloverEnabled: true, //required to override mouseenter function during keyboard scrolling.
                assistantCursor: 0,
                assistantRolloverTimer: 0
            },
            sync: function() {
                throw 'Method disabled';
            }
        });
    }
);
define('util/keyboard',[], function() {
    var keyboard = {};

    keyboard.KEYS = {
        ENTER : 13,
        UP_ARROW: 38,
        DOWN_ARROW: 40,
        LEFT_ARROW: 37,
        RIGHT_ARROW: 39,
        PAGE_DOWN: 34,
        PAGE_UP: 33,
        SPACE_BAR: 32,
        TAB: 9,
        ESCAPE: 27
    };

    return keyboard;
});
define('views/shared/searchbar/input/SearchField',
    [
        'jquery',
        'underscore',
        'module',
        'views/Base',
        'views/shared/delegates/TextareaResize',
        'util/keyboard',
        'util/dom_utils'
    ],
    function($, _, module, Base, TextareaResize, keyboard_utils, dom_utils) {
        return Base.extend({
            moduleId: module.id,
            className: 'search-field-wrapper',
            initialize: function() {
                Base.prototype.initialize.apply(this, arguments);
                this.multiline = false;
                this.useSyntheticPlaceholder = !dom_utils.supportsNativePlaceholder();
                
                this.activate();
            },
            startListening: function() {
                this.listenTo(this.model.searchBar, 'searchFieldfocus', this.searchFieldfocus);

                this.listenTo(this.model.searchBar, 'change:search', function() {
                    this.setSearchString(this.model.searchBar.get('search') || "");
                });
                
                this.listenTo(this.model.content, 'applied', function(options) {
                    this.model.searchBar.trigger('closeAssistant');
                    this._onFormSubmit(options);
                });
                
                this.listenTo(this.model.content, 'change:search', function() {
                    this.setSearchString(this.model.content.get('search') || "");
                });
                
                this.listenTo(this.model.content, 'change:display.page.search.mode', function() {
                    this._onFormSubmit({silent:true});
                });
                
                if (this.options.disableOnSubmit) {
                    this.listenTo(this.model.content, 'enableSearchInput', function() {
                        this.$(".search-field").attr('disabled', false);
                    });
                }

                this.listenTo(this.model.searchBar, 'setCaretPositionToEnd', this.setCaretPositionToEnd);
            },
            activate: function(options) {
                if (this.active) {
                    return Base.prototype.activate.apply(this, arguments);
                }
                
                if (this.$el.html()) {
                    if (this.options.disableOnSubmit) {
                        this.$(".search-field").attr('disabled', false);
                        this.searchFieldfocus();
                    }
                    this.render();
                }

                return Base.prototype.activate.apply(this, arguments);
            },
            deactivate: function(options) {
                if (!this.active) {
                    return Base.prototype.deactivate.apply(this, arguments);
                }
                Base.prototype.deactivate.apply(this, arguments);
                if (this.options.disableOnSubmit) {
                    if (this.$el.html()) {
                        this.$(".search-field").attr('disabled', true);
                    }
                }
                return this;
            },
            events: {
                'change textarea': function(e) {
                    this.updatePlaceholder();
                },
                'propertychange .search-field': function(e) {
                    this.updatePlaceholder();
                },
                'click .placeholder': function(e) {
                    //can only happen if you are using the synthetic placeholder when no HTML5 support
                    this.$(".search-field").focus(); 
                },
                'mouseup textarea': function(e) { //could result in pasted text
                    this.updatePlaceholder();
                },
                'focus .search-field' : function(e) {
                    this.model.searchBar.set('assistantCursor', - 1);
                },
                'keyup .search-field' : 'onSearchFieldKeyUp',
                'keydown .search-field' : 'onSearchFieldKeyDown'
            },
            updatePlaceholder: function() {
                if (this.useSyntheticPlaceholder) {
                    if (!this.$placeholder) {
                        this.$placeholder = this.$(".placeholder");
                    }
                    this.$placeholder[this.$(".search-field").val() === '' ? 'show' : 'hide']();
                }
            },
            onSearchFieldKeyUp: function(e) {
                if (!e.metaKey && !e.ctrlKey) {    
                    this.updateMultiline();
                    switch (e.keyCode) {
                        case keyboard_utils.KEYS['ESCAPE']:
                        case keyboard_utils.KEYS['LEFT_ARROW']:
                        case keyboard_utils.KEYS['RIGHT_ARROW']:
                        case keyboard_utils.KEYS['UP_ARROW']:
                            return; //don't open the search assistant.
                        case keyboard_utils.KEYS['ENTER']:
                            e.preventDefault();
                            return;
                        default:
                            break;
                    }
                    this.model.searchBar.set({search: this.$(".search-field").val()});
                    this.model.searchBar.trigger('openAssistant');
                    this.updatePlaceholder();
                }
            },
            onSearchFieldKeyDown: function(e) {
                if (!e.metaKey && !e.ctrlKey) {
                    switch (e.keyCode) {
                        case keyboard_utils.KEYS['TAB']:
                            this.model.searchBar.trigger('closeAssistant');
                            break;
                        case keyboard_utils.KEYS['DOWN_ARROW']:
                            // Left bracket and down arrow register as 40. If the shift key is down, then it must be a bracket.
                            if (!e.shiftKey) {
                                if (!this.children.resize.isMultiline() || this.children.resize.caretIsLast()) {
                                    this.model.searchBar.trigger('downArrow');
                                    e.preventDefault();
                                }
                            }
                            break;
                        case keyboard_utils.KEYS['ENTER']:
                            if (e.shiftKey) {
                                return;
                            }
                            this.model.searchBar.trigger('closeAssistant');
                            this._onFormSubmit();
                            e.preventDefault();
                            break;
                        default:
                            break;
                    }
                }
            },
            updateMultiline: function() {
                if (this.children.resize) {
                    // add mulitline class for state style
                    var multiline = this.children.resize.isMultiline();

                    if (multiline && (multiline != this.multiline)) {
                        this.$el.addClass('multiline');
                        this.multiline = true;
                    } else if (!multiline && (multiline != this.multiline)) {
                        this.$el.removeClass('multiline');
                        this.multiline = false;
                    }
                }
            },
            getSearchFieldValue: function(){
                return $.trim(this.$(".search-field").val());
            },
            _onFormSubmit: function(options) {
                options = options || {};
                // don't do anything if there's nothing in the search box
                var search = this.model.searchBar.get('search'),
                    currentSearch = this.model.content.get('search'),
                    searchFromTextarea = this.getSearchFieldValue();
                
                if (search !== searchFromTextarea) {
                    this.model.searchBar.set('search', searchFromTextarea);
                    search = searchFromTextarea;
                }
                
                if (search) {
                    if (this.options.disableOnSubmit) {
                        this.$(".search-field").attr('disabled', true);
                    }
                    if (currentSearch !== search){
                        this.model.content.set({search: search}, options);
                    } else {
                        if (!options.silent) {
                            this.model.content.unset("search", {silent: true});
                            this.model.content.set({search: search});
                        }
                    }
                }
            },
            /**
             * Sometimes, like when we're resurrecting a search, we will
             * write our own input value.
             */
            setSearchString: function(search) {
                var currentVal = this.$(".search-field").val();
                this.model.searchBar.set('search', search);
                if (search !== currentVal) {
                    this.$(".search-field").val(search);
                }
                this.updatePlaceholder();
                this.searchFieldfocus();
                if (this.children.resize) {
                    this.children.resize.resizeTextarea();
                    this.updateMultiline();
                }
            },
            searchFieldfocus: function() {
                var $searchField = this.$(".search-field");
                if (!$searchField.attr('disabled')) {
                    $searchField.focus();
                }
            },
            setCaretPositionToEnd: function() {
                var $searchField = this.$(".search-field");
                dom_utils.setCaretPosition($searchField.get(0), $searchField.val().length);                
            },
            render: function() {
                var $searchField;
                if (this.$el.html()) {
                    $searchField = this.$(".search-field");
                    this.$(".search-field").val(this.model.searchBar.get('search'));
                } else {
                    var template = _.template(this.template, {
                        placeholder: _("enter search here...").t(),
                        useSyntheticPlaceholder: this.useSyntheticPlaceholder,
                        inputValue: this.model.searchBar.get('search')
                    });
                    this.$el.html(template);
                    $searchField = this.$(".search-field");
                    
                    _.defer(function(){
                        if (this.options.useAutoFocus) {
                            this.searchFieldfocus();
                        }
                        var maxLines = Math.floor(($(window).height() - 100) / parseInt($searchField.css('lineHeight'), 10));
                        this.children.resize = new TextareaResize({el: $searchField.get(0), maxLines: maxLines, minHeight: 20});
                        this.updateMultiline();
                        this.setCaretPositionToEnd();
                    }.bind(this));
                }
                
                this.updatePlaceholder();
                
                if (this.options.disableOnSubmit) {
                    $searchField.attr('disabled', false);
                }
                
                return this;
            },
            reflow: function() {
                var el = this.$(".search-field").get(0),
                    inputValue = this.model.searchBar.get('search') || "",
                    currentCaretPos = dom_utils.getCaretPosition(el);
                dom_utils.setCaretPosition(el, (currentCaretPos || inputValue.length));
                Base.prototype.reflow.apply(this, arguments);
            },
            template: '\
                <textarea rows="1" name="q" spellcheck="false" class="search-field" autocorrect="off" autocapitalize="off"\
                <% if (!useSyntheticPlaceholder) { %> placeholder="<%- placeholder %>"\ <% } %>><%- inputValue %></textarea>\
                <% if (useSyntheticPlaceholder) { %> \
                <span class="placeholder"><%- placeholder %></span>\
                <% } %>\
                '
        });
    }
);

define('models/search/SHelper',
    [
        'jquery',
        'underscore',
        'models/Base',
        'backbone',
        'splunk.util'
    ],
    function($, _, BaseModel, Backbone, splunkUtil) {
        var SHelper = BaseModel.extend({
            initialize: function() {
                BaseModel.prototype.initialize.apply(this, arguments);
            },
            url: splunkUtil.make_url('api/shelper'),
            sync: function(method, model, options) {
                if (method!=='read') {
                    throw new Error('invalid method: ' + method);
                }
                options = options || {};
                var defaults = {
                        data: {},
                        dataType: 'text'
                    },
                    url = _.isFunction(model.url) ? model.url() : model.url || model.id;
                defaults.url = url;
                $.extend(true, defaults, options);
                return Backbone.sync.call(this, method, model, defaults);
            },
            parse: function(response) {
                return {raw: response};
            }
        });
        return SHelper;
    }
);
define('views/shared/searchbar/input/SearchAssistant',
    [
        'jquery',
        'underscore',
        'module',
        'views/Base',
        'models/search/SHelper',
        'util/keyboard',
        'util/dom_utils',
        'splunk.util',
        'jquery.bgiframe'
    ],
    function($, _, module, Base, SHelperModel, keyboard_utils, dom_utils, splunkUtils) {
        return Base.extend({
            moduleId: module.id,
            className: 'search-assistant-wrapper',
            initialize: function() {
                Base.prototype.initialize.apply(this, arguments);
                this.debouncedFillAssistant = _.debounce(this.fillAssistant, 250).bind(this);
                this.nameSpace = this.uniqueNS();
                this.model.sHelper = new SHelperModel();
                this.windowListenersActive = false;
                
                this.activate({skipRender: true});
            },
            startListening: function() {
                this.listenTo(this.model.searchBar, 'change:assistantCursor', this._highlightKeyword);
                this.listenTo(this.model.searchBar, 'openAssistant', function() {
                    if (!this.model.searchBar.get('assistantOpen')) {
                        if (this.options.autoOpenAssistant) {
                            this.openAssistant();
                        }
                    } else {
                        this.debouncedFillAssistant();
                    }
                });
                this.listenTo(this.model.searchBar, 'closeAssistant', this.closeAssistant);
                this.listenTo(this.model.searchBar, 'downArrow', this.handleDownArrow);
            },
            activate: function(options) {
                options = options || {};
                this.ensureDeactivated();
                
                if (!this.windowListenersActive) {
                    $(window).on('resize.' + this.nameSpace, this.setAssistantWidth.bind(this));
            
                    $(document).on('keyup.' + this.nameSpace, function(e) {
                        if (e.keyCode == keyboard_utils.KEYS['ESCAPE']) {
                            this.closeAssistant();
                        }
                    }.bind(this));
                   
                    $(document).on('click.' + this.nameSpace, function(e) {
                        if ((e.target === this.$el[0]) ||($.contains(this.$el[0], e.target))) {
                            return;
                        }
                        this.closeAssistant();
                    }.bind(this));
                    
                    this.windowListenersActive = true;
                }
                
                if (!options.skipRender) {
                    this.options.autoOpenAssistant = splunkUtils.normalizeBoolean(
                        this.model.content.get('display.prefs.autoOpenSearchAssistant'));
                    
                    this.render();
                }

                return Base.prototype.activate.apply(this, arguments);
            },
            deactivate: function(options) {
                if (!this.active) {
                   return Base.prototype.deactivate.apply(this, arguments);
                }
                Base.prototype.deactivate.apply(this, arguments);
                this.model.sHelper.fetchAbort();
                this.resetFillAssistantFlags();
                this.closeAssistant();
                $(document).off(".assistantResizeActive");
                return this;
            },
            events: {
                'click .search-assistant-autoopen-toggle': function(e) {
                    this.setAutoOpen(!this.options.autoOpenAssistant);
                    e.preventDefault();                    
                },
                'click .search-assistant-activator': function(e) {
                    this.model.searchBar.trigger('focusSearchField');
                    if (this.model.searchBar.get('assistantOpen')) {
                        this.closeAssistant();
                    } else {
                        this.openAssistant();
                    }
                    e.preventDefault();                    
                },
                'keydown a.sakeyword': function(e) {
                    if (!e.metaKey && !e.ctrlKey) {
                        switch (e.keyCode) {
                            case keyboard_utils.KEYS['DOWN_ARROW']:
                                // Left bracket and down arrow register as 40. If the shift key is down, then it must be a bracket.
                                if (!e.shiftKey) {
                                    return this.handleDownArrow(e);
                                }
                                break;
                            case keyboard_utils.KEYS['UP_ARROW']:
                                if (this.model.searchBar.get('assistantOpen') && (this.model.searchBar.get('assistantKeywordCount')>0)) {
                                    this.selectPreviousKeyword();
                                    e.preventDefault();
                                }
                                return;
                            case keyboard_utils.KEYS['TAB']:
                            case keyboard_utils.KEYS['ENTER']:
                            case keyboard_utils.KEYS['RIGHT_ARROW']:
                            case keyboard_utils.KEYS['SPACE_BAR']:
                                return this.onSuggestionSelect(e);
                            default:
                                break;
                        }
                    }
                },
                'keyup a.sakeyword': 'onKeywordKeyUp',
                'keyup .salink': 'onKeywordKeyUp',
                'click .search-assistant-container a': 'onSuggestionSelect',
                'mousedown .search-assistant-resize': 'resizeAssistant',
                //this is a port of the generated javascript from within the shelper mako template
                'click .saMoreLink': function(e) {
                    var $element = $(e.target);
                    if ($element.hasClass('saMoreLinkOpen')) {
                        $element.removeClass('saMoreLinkOpen')
                               .html(_.t('More &raquo;'));
                        $($element.attr('divToShow')).css('display','none');   
                    } else {
                        $element.addClass('saMoreLinkOpen')
                               .html(_.t('&laquo; Less'));
                        $($element.attr('divToShow')).css('display', 'block');
                    }
                }                
            },
            setAutoOpen: function(isEnabled) {
                this.options.autoOpenAssistant = isEnabled;

                if (splunkUtils.normalizeBoolean(this.model.content.get('display.prefs.autoOpenSearchAssistant')) !== isEnabled) {
                    this.model.content.set({'display.prefs.autoOpenSearchAssistant': isEnabled});
                }

                this.$assistantAutoOpenToggle.find("i").toggleClass('icon-check', this.options.autoOpenAssistant);
            },
            handleDownArrow: function(e) {
                var assistantOpen = this.model.searchBar.get('assistantOpen'),
                    assistantKeywordCount = this.model.searchBar.get('assistantKeywordCount'),
                    keywordPosition = this.model.searchBar.get("assistantCursor");
                
                if (e) {
                    e.preventDefault();
                }

                if (assistantOpen && assistantKeywordCount > 0) {
                    if (keywordPosition >= (assistantKeywordCount-1)) {
                        this.model.searchBar.set("assistantCursor", assistantKeywordCount - 1);
                    } else {
                        this.model.searchBar.set("assistantCursor", ++keywordPosition);
                    }
                } else if (!assistantOpen && !this.model.searchBar.get('search')) {
                    this.openAssistant();
                }
            },
            onKeywordKeyUp: function(e) {
                if (!e.metaKey && !e.ctrlKey && !e.shiftKey) {
                    switch (e.keyCode) {
                        case keyboard_utils.KEYS['DOWN_ARROW']:
                        case keyboard_utils.KEYS['UP_ARROW']:
                        case keyboard_utils.KEYS['TAB']:
                        case keyboard_utils.KEYS['ENTER']:
                        case keyboard_utils.KEYS['LEFT_ARROW']:
                        case keyboard_utils.KEYS['RIGHT_ARROW']:
                        case keyboard_utils.KEYS['SPACE_BAR']:
                            e.preventDefault();
                            return;
                        default:
                            break;
                    }
                }
            },
            resizeAssistant: function(e) {
                var startY = e.pageY;
                var startHeight = this.$assistantContainer.height();
                e.preventDefault();
                e.stopPropagation();

                this.$assistantResize.on("click.assistantResizeActive",
                    function(e){
                        e.preventDefault();
                        e.stopPropagation();
                    }.bind(this)
                );

                $(document).on("mousemove.assistantResizeActive",
                    function(e){
                        var newHeight = startHeight - (startY - e.pageY);
                        newHeight = newHeight < 75 ? 0 : newHeight;
                        newHeight = Math.min(newHeight, 500);
                        this.setAssistantHeight(newHeight);
                        e.preventDefault();
                        e.stopPropagation();
                    }.bind(this)
                );

                $(document).on("mouseup.assistantResizeActive",
                    function(e){
                        var newHeight = startHeight - (startY - e.pageY);
                        if (newHeight < 75) {
                            this.closeAssistant();
                            this.setAssistantHeight(startHeight);
                        }
                        $(document).off(".assistantResizeActive");
                    }.bind(this)
                );
            },
            closeAssistant: function() {
                //try to kill any fetches to the search helper
                this.model.sHelper.fetchAbort();
                this.resetFillAssistantFlags();

                // Exit early if closeAssistant has been called before render has created all of the views
                if (!this.$assistantContainer || !this.model.searchBar.get("assistantOpen")) {
                    return;
                }
                
                this.$assistantContainer.hide();
                this.$assistantAutoOpenToggle.hide();
                this.$assistantActivator.addClass("icon-triangle-down-small").removeClass("icon-triangle-up-small");
                this.$assistantResize.removeClass("search-assistant-resize-active");
                this.$el.removeClass('open');
                
                this.model.searchBar.set('assistantOpen', false);
            },
            openAssistant: function() {
                if (!this.model.searchBar.get("assistantOpen")) {                
                    this.$assistantActivator.addClass("icon-triangle-up-small").removeClass("icon-triangle-down-small");
                    this.$assistantResize.addClass("search-assistant-resize-active");
                    this.$el.addClass('open');
                    this.model.searchBar.set("assistantOpen", true);
                    this.fillAssistant();
                }
            },
            resetFillAssistantFlags: function() {
                this.assistantFillPending = false;
                this.assistantNeedsUpdate = false;
            },
            fillAssistant: function() {
                if (this.model.searchBar.get("assistantOpen")){
                    if (!this.assistantFillPending) {
                        var searchString = splunkUtils.addLeadingSearchCommand(this.model.searchBar.get('search') || '*', true);

                        this.assistantFillPending = true;
                        this.model.sHelper.safeFetch({
                            data: {
                                'snippet': 'true',
                                'snippetEmbedJS': 'false',
                                'namespace': this.model.application.get('app') || 'search',
                                'search': searchString,
                                'useTypeahead': this.options.useTypeahead,
                                'useAssistant': this.options.useAssistant,
                                'showCommandHelp': this.options.showCommandHelp,
                                'showCommandHistory': this.options.showCommandHistory,
                                'showFieldInfo': this.options.showFieldInfo
                            },
                            success: function() {
                                this.$assistantContainer.html(this.model.sHelper.get('raw') || '');
                                this.assistantFillPending = false;
                                this.fillAssistantCompleteCallback();
                            }.bind(this)
                        });
                    } else {
                        this.assistantNeedsUpdate = true;
                    }
                }
            },
            fillAssistantCompleteCallback: function() {
                if (this.model.searchBar.get('assistantOpen')) {
                    if (this.assistantNeedsUpdate) {
                        this.assistantNeedsUpdate = false;
                        this.fillAssistant();
                    }

                    this.setAssistantWidth();

                    this.$assistantContainer.show().bgiframe().scrollTop(0);
                    this.$assistantAutoOpenToggle.show();
                    this.setAssistantHeight(this.$assistantContainer.height() || 250);

                    this.model.searchBar.set({
                        assistantKeywordCount: this.$('.sakeyword').length,
                        assistantCursor: -1
                    });

                    this.model.searchBar.trigger('searchFieldfocus');
                }
            },
            setAssistantHeight: function(newHeight) {
                if (newHeight > 500) {
                    newHeight = 500; // make sure we don't go over 500px
                }
                this.$assistantContainer.height(newHeight);
                this.$('.saHelpWrapper').css('min-height', newHeight);
            },
            setAssistantWidth: function() {
                var assistantInner = this.$('.assistantInner');
                if (assistantInner.length && (this.$el.width() < this.options.minWithForTwoColumns)) {
                    assistantInner.addClass('assistant-inner-narrow');
                } else {
                    assistantInner.removeClass('assistant-inner-narrow');
                }
           },
            _highlightKeyword: function() {
                if (this.model.searchBar.get('assistantOpen')) {
                    var keywordPosition = this.model.searchBar.get("assistantCursor");
                
                    // set the CSS style for selected
                    var el = $('.sakeyword', this.$assistantContainer
                        ).removeClass('saKeywordSelected'
                        ).slice(keywordPosition, keywordPosition + 1
                        ).addClass('saKeywordSelected');

                    if (el.length) {
                        // keep selected item in view
                        var win = this.$assistantContainer;
                        var visibleWindowTop = win.scrollTop();
                        var visibleWindowBottom = win.scrollTop() + win.height();
                        var elementTop = el.position().top + visibleWindowTop;

                        var elementHeight = el.outerHeight();
                        if (elementTop < visibleWindowTop) {
                            win.scrollTop(elementTop);
                        } else if (elementTop + elementHeight > visibleWindowBottom) {
                            win.scrollTop(elementTop + elementHeight - win.height());
                        }

                        el.focus();
                    }
                }
            },
            selectPreviousKeyword: function() {
                var keywordPosition = this.model.searchBar.get("assistantCursor");
                if (keywordPosition <= 0) {
                    this.model.searchBar.set("assistantCursor", -1);
                    this.model.searchBar.trigger('searchFieldfocus');
                } else {
                    this.model.searchBar.set("assistantCursor", --keywordPosition);
                }
            },
            onSuggestionSelect: function(e) {
                var newval = $.trim($(e.currentTarget).attr('replacement'));

                if (this.model.searchBar.get('assistantOpen') && newval) {

                    if (newval.substr(-1) != '=') {
                           newval += ' '; // don't add space after =
                    }
                    this.model.searchBar.set('search', newval);
                    this.fillAssistant();
                    this.model.searchBar.trigger('setCaretPositionToEnd');

                    e.preventDefault();
                }
            },
            remove: function() {
                $(window).off('resize.' + this.nameSpace);
                $(document).off('keyup.' + this.nameSpace);
                $(document).off('click.' + this.nameSpace);
                $(document).off(".assistantResizeActive");
                return Base.prototype.remove.apply(this, arguments);
            },
            render: function() {
                if (this.$el.html()) {
                    return this;
                }
                
                var template = _.template(this.template, {});
                this.$el.html(template);
                
                // Setup shortcuts
                this.$assistantWrapper = this.$el;
                this.$assistantContainer = this.$('.search-assistant-container');
                this.$assistantAutoOpenToggle = this.$('.search-assistant-autoopen-toggle');
                this.$assistantActivator = this.$('.search-assistant-activator');
                this.$assistantResize = this.$('.search-assistant-resize');

                this.setAutoOpen(this.options.autoOpenAssistant);
                
                return this;
            },
            template: '\
                <div class="search-assistant-container-wrapper"><div class="search-assistant-container"></div></div>\
                <a class="search-assistant-autoopen-toggle" href="" style="display:none;"><i></i><%= _("Auto Open").t() %></a>\
                   <div class="search-assistant-resize"></div>\
                <a href="#" class="search-assistant-activator icon-triangle-down-small"></a>\
            '
        });
    }
);

define('views/shared/searchbar/input/Master',
    [
        'jquery',
        'underscore',
        'models/search/SearchBar',
        'module',
        'views/Base',
        'views/shared/searchbar/input/SearchField',
        'views/shared/searchbar/input/SearchAssistant',
        'util/keyboard',
        'splunk.util'
    ],
    function($, _, SearchBarModel, module, Base, SearchField, SearchAssistant, keyboard_utils, splunkUtils) {
        return Base.extend({
            moduleId: module.id,
            initialize: function(options) {
                Base.prototype.initialize.apply(this, arguments);

                this.options = $.extend(true, {}, this.options, (options || {}));

                var defaults = {
                    useTypeahead: true,
                    useAssistant: true,
                    useAutoFocus: true,
                    autoOpenAssistant: splunkUtils.normalizeBoolean(this.model.content.get('display.prefs.autoOpenSearchAssistant')),
                    showCommandHelp: true,
                    showCommandHistory: true,
                    showFieldInfo: false,
                    maxSearchBarLines: 80,
                    minWithForTwoColumns: 560,
                    disableOnSubmit: false
                };
                _.defaults(this.options, defaults);
                
                this.model.searchBar = new SearchBarModel();
                
                this.children.searchField = new SearchField($.extend(true, {}, this.options, {
                    model: {
                        content: this.model.content,
                        searchBar: this.model.searchBar
                    }
                }));
                
                if (this.options.useAssistant) {
                    this.children.searchAssistant = new SearchAssistant($.extend(true, {}, this.options, {
                        model: {
                            searchBar: this.model.searchBar,
                            content: this.model.content,
                            application: this.model.application
                        }
                    }));
                }
                
                this.activate();
            },
            startListening: function() {
                this.listenTo(this.model.searchBar, 'change:assistantOpen', function() {
                    if (this.model.searchBar.get('assistantOpen')) {
                        this.$el.addClass('search-assistant-open');
                    } else {
                        this.$el.removeClass('search-assistant-open');
                    }
                });
            },
            activate: function(options) {
                if (this.active) {
                    return Base.prototype.activate.apply(this, arguments);
                }
                this.model.searchBar.set({search: this.model.content.get("search")});
                return Base.prototype.activate.apply(this, arguments);
            },
            deactivate: function(options) {
                if (!this.active) {
                    return Base.prototype.deactivate.apply(this, arguments);
                }
                Base.prototype.deactivate.apply(this, arguments);
                this.model.searchBar.clear({setDefaults: true});
                return this;
            },
            render: function() {
                if (this.$el.html()) {
                    return this;
                }
                
                var template = _.template(this.template, {});
                this.$el.html(template);
                
                this.children.searchField.render().appendTo(this.$el);

                if (this.options.useAssistant) {
                    this.children.searchAssistant.render().appendTo(this.$el);
                }

                return this;
            },
            template: '\
                <div class="search-field-background"></div>\
            '
        });
    }
);

define('views/shared/searchbar/Submit',
    [
        'jquery',
        'underscore',
        'backbone',
        'module',
        'views/Base'
    ],
    function($, _, Backbone, module, BaseView) {
        return BaseView.extend({
            moduleId: module.id,
            initialize: function() {
                BaseView.prototype.initialize.apply(this, arguments);
            },
            events: {
                'click .btn': function(e) {
                    this.model.trigger('applied');
                    e.preventDefault();
                }
            },
            render: function() {
                if (this.$el.html()) {
                    return this;
                }
                
                var template = _.template(this.template, {});
                this.$el.html(template);

                return this;
            },
            template: '\
                <a class="btn" href="#"><i class="icon-search-thin"></i></a>\
            '
        });
    }
);

define('views/shared/searchbar/Master',
    [
        'jquery',
        'underscore',
        'backbone',
        'module',
        'views/Base',
        'views/shared/searchbar/Apps',
        'views/shared/searchbar/input/Master',
        'views/shared/timerangepicker/Master',
        'views/shared/searchbar/Submit'
    ],
    function($, _, Backbone, module, BaseView, Apps, Input, TimeRangePicker, Submit) {
        return BaseView.extend({
            moduleId: module.id,
            className: 'search-bar-wrapper',
            /**
             * @param {Object} options {
             *     model: {
             *         state: <models.Report.entry.content>,
             *         timeRange: <models.TimeRange>,
             *         appLocal: <models.services.AppLocal>,
             *         user: <models.services.authentication.User>,
             *         application: <models.Application>
             *     },
             *     collection: {
             *         times (Optional): <collections.services.data.ui.TimesV2>,
             *         apps (Optional): <collections.services.AppsLocals>
             *     }
             * }
             */
            initialize: function() {
                BaseView.prototype.initialize.apply(this, arguments);

                _.defaults(this.options, {
                    showTimeRangePicker:true,
                    disableOnSubmit: false,
                    primaryAction: false
                });
                this.showTimeRangePicker = this.options.showTimeRangePicker;

                if (this.collection && this.collection.apps) {
                    this.children.apps = new Apps({
                        collection: this.collection.apps,
                        model: this.model.state,
                        applicationModel: this.model.application
                    });
                }

                this.children.searchInput = new Input($.extend(true, {}, this.options, {
                    model: {
                        content: this.model.state,
                        application: this.model.application
                    }
                }));

                this.children.submit = new Submit({
                    model: this.model.state
                });

            },
            render: function() {
                if (!this.$el.html()) {
                    var template = _.template(this.template, {showTimeRangePicker: this.showTimeRangePicker, primary: this.options.primaryAction});
                    this.$el.html(template);
    
                    if (this.children.apps) {
                        this.children.apps.render().appendTo(this.$('.search-apps'));
                    }
                    this.children.searchInput.render().appendTo(this.$('.search-input'));
                    if (this.showTimeRangePicker) {
                        this.children.timeRangePicker = new TimeRangePicker({
                            model: {
                                state: this.model.state,
                                timeRange: this.model.timeRange,
                                appLocal: this.model.appLocal,
                                user: this.model.user,
                                application: this.model.application
                            },
                            collection: this.collection.times,
                            timerangeClassName: 'btn'
                        });
                        this.children.timeRangePicker.render().appendTo(this.$('.search-timerange'));
                    }
                    this.children.submit.render().appendTo(this.$('.search-button'));
                }
                return this;
            },
            template: '\
                <form method="get" action="" class="search-form">\
                    <table class="search-bar <%- primary ? "search-bar-primary" : "" %>">\
                        <tbody>\
                            <tr>\
                                <td class="search-input" width="100%"></td>\
                                <td class="search-apps"></td>\
                                <% if (showTimeRangePicker) { %>\
                                    <td class="search-timerange"></td>\
                                <% } %>\
                                <td class="search-button"></td>\
                            </tr>\
                        </tbody>\
                    </table>\
                </form>\
            '
        });
    }
);

requirejs.s.contexts._.nextTick = function(f){f()}; require(['css'], function(css) { css.addBuffer('splunkjs/css/search-bar.css'); }); requirejs.s.contexts._.nextTick = requirejs.nextTick;
define('splunkjs/mvc/searchbarview',['require','exports','module','jquery','underscore','./mvc','backbone','./basesplunkview','util/console','./timerangeview','views/shared/searchbar/Master','models/shared/TimeRange','./utils','./sharedmodels','splunk.config','css!../css/search-bar'],function(require, exports, module) {
    var $ = require("jquery");
    var _ = require("underscore");
    var mvc = require('./mvc');
    var Backbone = require("backbone");
    var BaseSplunkView = require("./basesplunkview");
    var console = require('util/console');
    var TimeRangeView = require("./timerangeview");
    var InternalSearchBar = require("views/shared/searchbar/Master");
    var TimeRangeModel = require('models/shared/TimeRange');
    var utils = require('./utils');
    var sharedModels = require('./sharedmodels');
    var splunkConfig = require('splunk.config');

    require("css!../css/search-bar");
    
    var SearchBarView = BaseSplunkView.extend({
        moduleId: module.id,
        
        className: "splunk-searchbar",
        
        options: {
            "default": undefined,
            managerid: null,
            /**
             * Whether or not to display an embedded time range view
             * in this search bar.
             */
            timerange: true,
            /**
             * Whether to display the search assistant.
             * 
             * When the framework is in independent-mode the search assistant
             * does not function and this option will be ignored.
             * 
             * Initialization-only.
             */
            useAssistant: true,
            /**
             * Whether to automatically open the search assistant
             * while the search bar is being typed in.
             * 
             * Only applies if useAssistant is true.
             * 
             * Initialization-only.
             */
            autoOpenAssistant: true,
            value: undefined
        },
        
        initialize: function() {
            var that = this;
            
            this.configure();
            this.settings.enablePush("value");
            
            if (this.settings.has('timepicker')) {
                console.warn(
                    'The "%s" setting of class "%s" is deprecated. Use "%s" instead.',
                    'timepicker', 'SearchBarView', 'timerange');
                this.settings.set('timerange', this.settings.get('timepicker'));
                this.settings.unset('timepicker');
            }
            
            // Initialize value with default, if provided
            this._onDefaultChange();
            
            this._state = new Backbone.Model({
                'dispatch.earliest_time': this.settings.get("earliest_time"),
                'dispatch.latest_time': this.settings.get("latest_time"),
                'search': this.settings.get('value') || ""
            });
            
            // Get the shared models
            var appModel = sharedModels.get("app");
            var userModel = sharedModels.get("user");
            var appLocalModel = sharedModels.get("appLocal");
            var timesCollection = sharedModels.get("times");
            
            var timeRangeModel = new TimeRangeModel();
            timeRangeModel.save({
                'earliest': this.settings.get("earliest_time"),
                'latest': this.settings.get("latest_time")
            });
            
            // Create embedded time range view even if we don't
            // plan to actually show it.
            this.timerange = this._createTimeRange(this.settings);
            
            // Permit deprecated access to the 'timepicker' field
            this.timepicker = this.timerange;
            
            // We cannot create the searchbar until these internal models
            // have been fetched, and so we wait on them being done.
            this._dfd = $.when(timesCollection.dfd, userModel.dfd, appLocalModel.dfd).done(function() {
                var useAssistant = 
                    that.settings.get('useAssistant') &&
                    // JIRA: Remove search assistant's dependency on splunkweb,
                    //       making it depend on splunkd directly.
                    //       Then enable the search assistant in independent
                    //       mode. (SPL-80734)
                    !splunkConfig.INDEPENDENT_MODE;
                
                var autoOpenAssistant = 
                    that.settings.get('autoOpenAssistant') &&
                    useAssistant;
                
                that.searchbar = new InternalSearchBar({
                    showTimeRangePicker: true,
                    useAssistant: useAssistant,
                    autoOpenAssistant: autoOpenAssistant,
                    disableOnSubmit: false,
                    collection: {
                        times: timesCollection
                    },
                    model: {
                        state: that._state,
                        timeRange: timeRangeModel,
                        user: userModel,
                        appLocal: appLocalModel,
                        application: appModel
                    }
                });
            });
            
            // Update view if model changes
            this.settings.on("change:value", function(model, value, options) {
                options = options || {};
                var suppressValSet = options._self;
                if (!suppressValSet) {
                    that.val(value || "");
                }
            });
            
            this.bindToComponentSetting('managerid', this._onManagerChange, this);
            
            this._state.on("change:search", this._onSearchChange, this);
            this.settings.on("change:timerange", this._onDisplayTimeRangeChange, this);
            this.settings.on("change:default", this._onDefaultChange, this);
        },
        
        _createTimeRange: function(settings) {
            var timeRangeOptions = settings.extractWithPrefix('timerange_');
            var timePickerOptions = settings.extractWithPrefix('timepicker_');
            if (!_.isEmpty(timePickerOptions)) {
                console.warn(
                    'The "%s" settings of class "%s" are deprecated. Use "%s" instead.',
                    'timepicker_*', 'SearchBarView', 'timerange_*');
            }
            
            var options = _.extend(
                { managerid: settings.get("managerid") },
                timeRangeOptions,
                timePickerOptions);
            
            return new TimeRangeView(options);
        },
        
        _onDefaultChange: function(model, value, options) {
            // Initialize value with default, if provided
            var oldDefaultValue = this.settings.previous("default");
            var defaultValue = this.settings.get("default");
            var currentValue = this.settings.get('value');
            
            if (defaultValue !== undefined &&
                (currentValue === oldDefaultValue || currentValue === undefined))
            {
                this.settings.set('value', defaultValue);
            }
        },
        
        _onDisplayTimeRangeChange: function() {
            // We cannot work with the searchbar/timerange until they
            // are done being created.
            var that = this;
            $.when(this._dfd).done(function() {
                if (that.settings.get("timerange")) {
                    that.searchbar.children.timeRangePicker.$el.show();
                }
                else {
                    that.searchbar.children.timeRangePicker.$el.hide();
                }
            });
        },
        
        _onManagerChange: function(managers, manager) {
            if (this.manager) {
                this.manager.off(null, null, this);
                this.manager = null;
            }

            this.manager = manager;
            
            // We defer setting the query to let the underlying search bar
            // have enough to finish setting up. Since we might get a 
            // a manager synchronously, it may have not finished setting up
            // (e.g. it is setting its own deferred actions).
            var that = this;
            _.defer(function() {
                that._updateQuery();
            });
        },
        
        render: function() {
            // We cannot work with the searchbar/timerange until they
            // are done being created.
            var that = this;
            $.when(this._dfd).done(function() {
                if (!that._rendered) {
                    that.searchbar.render();
                    that._patchTimePicker();
                    
                    that.$el.append(that.searchbar.el);
                    
                    // Ensure we properly show/hide the timerange
                    that._onDisplayTimeRangeChange();
                    
                    // Prevent multiple renderings
                    that._rendered = true;
                }
            });
                            
            return this;
        },
        
        _patchTimePicker: function() {
            // Patch the internal search bar to display our time range view
            // (which may have special customizations) instead of the search
            // bar's original internal time range view.
            // 
            // The MVC time range view is patched in instead of its
            // underlying internal time range for backward compatibility
            // with existing CSS. We may break this compatibility later.
            {
                this.searchbar.children.timeRangePicker.setElement(
                    this.timerange.el);
                
                // Manually rerender the time range view in the DOM
                this.timerange.render();
                this.searchbar.$('.search-timerange')
                    .empty()
                    .append(this.timerange.el);
            }
            
            // Add back the 'btn-group' CSS class, which is necessary
            // for the vertical divider between the time range view
            // and the search button to display.
            $(this.timerange.el).addClass('btn-group');
            
            // Patch our time range view to synchronize its state with
            // the internal search bar's internal time range view.
            utils.syncModels(
                // embedded internal time range's model
                this.timerange.timepicker.model.timeRange,
                // internal search bar's internal time range's model
                this.searchbar.children.timeRangePicker.model.timeRange,
                // bidirectional sync; initialize with first model
                { auto: true });
        },
        
        val: function(value) {
            if (value !== undefined) {
                this._setSearch(value);
                
                /* 
                 * Force firing of a new change event, even if the new
                 * value is the same as the old value. This provides
                 * the expected behavior if the user presses enter in
                 * a search box to refresh the search.
                 */
                this.settings.unset("value", {_self: true});
                this.settings.set("value", value, {_self: true});
                
                this.trigger("change", value, this);
            }
            else {
                return this._getSearch();
            }
        },
        
        _onSearchChange: function(model, value, options) {
            options = options || {};
            var suppressValSet = options._self;
            if (!suppressValSet) {
                this.val(value);
            }
        },
        
        _getSearch: function() {
            return this._state.get("search");
        },
        
        _setSearch: function(newSearch) {
            this._state.set("search", newSearch, {_self: true});
        },
        
        _updateQuery: function() {
            // If we have a previous search query set, display it
            if (this.manager) {
                var currentSearch = this._state.get("search") || "";
                var newSearch = (this.manager.settings.resolve() || "").trim();
                
                if (!currentSearch && newSearch) {
                    this._setSearch(newSearch);
                }
            }
        }
    });
    
    return SearchBarView;
});

requirejs.s.contexts._.nextTick = function(f){f()}; require(['css'], function(css) { css.setBuffer('.clearfix{*zoom:1;}.clearfix:before,.clearfix:after{display:table;content:\"\";line-height:0;}\n.clearfix:after{clear:both;}\n.hide-text{font:0/0 a;color:transparent;text-shadow:none;background-color:transparent;border:0;}\n.input-block-level{display:block;width:100%;min-height:26px;-webkit-box-sizing:border-box;-moz-box-sizing:border-box;box-sizing:border-box;}\n.ie7-force-layout{*min-width:0;}\nform.search-form{margin-bottom:0;}\n.search-bar .btn,.search-bar .btn.dropdown-toggle{background-color:#f4f4f4;background-image:-moz-linear-gradient(top, #f8f8f8, #eeeeee);background-image:-webkit-gradient(linear, 0 0, 0 100%, from(#f8f8f8), to(#eeeeee));background-image:-webkit-linear-gradient(top, #f8f8f8, #eeeeee);background-image:-o-linear-gradient(top, #f8f8f8, #eeeeee);background-image:linear-gradient(to bottom, #f8f8f8, #eeeeee);background-repeat:repeat-x;filter:progid:DXImageTransform.Microsoft.gradient(startColorstr=\'#fff8f8f8\', endColorstr=\'#ffeeeeee\', GradientType=0);background-color:#eeeeee;border:1px solid #bfbfbf;border-top-color:#bfbfbf;border-bottom-color:#bfbfbf;color:#333333;-webkit-box-shadow:inset 0px 1px 0 #fdfdfd;-moz-box-shadow:inset 0px 1px 0 #fdfdfd;box-shadow:inset 0px 1px 0 #fdfdfd;-webkit-border-radius:0;-moz-border-radius:0;border-radius:0;line-height:28px;height:28px;white-space:nowrap;border-left:none;}.search-bar .btn:hover,.search-bar .btn.dropdown-toggle:hover{background-image:-moz-linear-gradient(top, #f8f8f8, #f8f8f8);background-image:-webkit-gradient(linear, 0 0, 0 100%, from(#f8f8f8), to(#f8f8f8));background-image:-webkit-linear-gradient(top, #f8f8f8, #f8f8f8);background-image:-o-linear-gradient(top, #f8f8f8, #f8f8f8);background-image:linear-gradient(to bottom, #f8f8f8, #f8f8f8);background-repeat:repeat-x;filter:progid:DXImageTransform.Microsoft.gradient(startColorstr=\'#fff8f8f8\', endColorstr=\'#fff8f8f8\', GradientType=0);-webkit-box-shadow:0px 1px 1px rgba(0, 0, 0, 0.08);-moz-box-shadow:0px 1px 1px rgba(0, 0, 0, 0.08);box-shadow:0px 1px 1px rgba(0, 0, 0, 0.08);background-color:#f8f8f8;border-color:#c7c7c7;border-top-color:#c7c7c7;border-bottom-color:#c7c7c7;background-position:0 0;}\n.search-bar td{padding:0;vertical-align:top;}\n.search-bar td.search-input{width:100%;}\n.search-bar .search-timerange .btn{white-space:nowrap;-webkit-border-radius:0;-moz-border-radius:0;border-radius:0;min-width:55px;*display:inline;*zoom:1;*position:relative;*margin-top:-1px;}\n.search-bar .search-button .btn{-webkit-border-top-right-radius:4px;-moz-border-radius-topright:4px;border-top-right-radius:4px;-webkit-border-bottom-right-radius:4px;-moz-border-radius-bottomright:4px;border-bottom-right-radius:4px;margin-left:-2px;font-size:26px;}\n.search-bar .search-timerange .shared-timerangepicker .btn .time-label{display:inline-block;*display:inline;vertical-align:middle;max-width:10em;overflow:hidden;text-overflow:ellipsis;}\n.shared-searchbar-input{position:relative;padding:0;}.shared-searchbar-input span.placeholder{display:none;padding:8px 0 ;line-height:20px;display:block;position:absolute;z-index:1;margin:0;top:0;left:9px;color:#999999;cursor:text;z-index:3;}\n.shared-searchbar-input textarea[disabled=\"disabled\"]{background-color:#eeeeee;}\n.shared-searchbar-input textarea.search-field{width:100%;display:block;line-height:20px;min-height:38px;margin:0;overflow:hidden;resize:none;-webkit-box-sizing:border-box;-moz-box-sizing:border-box;box-sizing:border-box;border:1px solid #bfbfbf;border-top-color:#bfbfbf;border-bottom-color:#bfbfbf;-webkit-border-top-left-radius:4px;-moz-border-radius-topleft:4px;border-top-left-radius:4px;-webkit-border-bottom-left-radius:4px;-moz-border-radius-bottomleft:4px;border-bottom-left-radius:4px;-webkit-border-top-right-radius:0;-moz-border-radius-topright:0;border-top-right-radius:0;-webkit-border-bottom-right-radius:0;-moz-border-radius-bottomright:0;border-bottom-right-radius:0;position:relative;font-family:\'Droid Sans Mono\',\'Consolas\',\'Monaco\',\'Courier New\',Courier,monospace;padding-top:8px;padding-bottom:8px;}\n.shared-searchbar-input .shadowTextarea{*white-space:pre;*word-wrap:break-word;}\n.shared-searchbar-input.multiline .search-assistant-resize{margin:0;}\n.shared-searchbar-input.multiline textarea.search-field,.shared-searchbar-input.search-assistant-open textarea.search-field{-webkit-border-bottom-right-radius:0;-moz-border-radius-bottomright:0;border-bottom-right-radius:0;-webkit-border-bottom-left-radius:0;-moz-border-radius-bottomleft:0;border-bottom-left-radius:0;border-bottom-color:#cccccc;}\n.search-assistant-wrapper{position:relative;width:100%;height:0;}.search-assistant-wrapper.open{z-index:406;}\n.search-assistant-wrapper .search-assistant-autoopen-toggle{height:20px;position:absolute;right:17px;top:0;padding:5px 3px 5px 10px;background-color:rgba(245, 245, 245, 0.8);}.search-assistant-wrapper .search-assistant-autoopen-toggle>.icon-check{text-decoration:none;display:inline-block;margin-right:3px;}\n.search-assistant-wrapper .search-assistant-container{display:none;position:relative;border:1px solid #cccccc;border-bottom:0px;border-top:0px;overflow:auto;background:#eeeeee url(\'/static/img/skins/default/bg_search_assistant.png\') left top repeat-y;background:-moz-linear-gradient(left, #ffffff 369px, transparent 370px),#f5f5f5;background:-ms-linear-gradient(left, #ffffff 369px, transparent 370px),#f5f5f5;background:-webkit-gradient(linear, 369px 0, 370px 0, from(#ffffff), to(transparent)),#f5f5f5;background:-webkit-linear-gradient(left, #ffffff 369px, transparent 370px),#f5f5f5;background:linear-gradient(left, #ffffff 369px, transparent 370px),#f5f5f5;background-position:0 0;}.search-assistant-wrapper .search-assistant-container .saTypeaheadWrapper,.search-assistant-wrapper .search-assistant-container .saHelpWrapper{float:left;max-width:50%;}\n.search-assistant-wrapper .search-assistant-container .saTypeaheadWrapper{margin-right:-370px;width:370px;}.search-assistant-wrapper .search-assistant-container .saTypeaheadWrapper h4{font-size:inherit;color:#333333;font-weight:normal;padding:5px 10px 0 5px;}\n.search-assistant-wrapper .search-assistant-container .saTypeaheadWrapper a+h4{margin-top:10px;}\n.search-assistant-wrapper .search-assistant-container .saTypeaheadWrapper a{padding:0 10px 0 5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}\n.search-assistant-wrapper .search-assistant-container .saTypeaheadWrapper a:hover{text-decoration:none;}\n.search-assistant-wrapper .search-assistant-container .saHelpWrapper{margin-left:370px;max-width:605px;}\n.search-assistant-wrapper .search-assistant-container .saNotice>strong{font-weight:normal;}\n.search-assistant-wrapper .search-assistant-container .saHelpContent{padding:9px;}.search-assistant-wrapper .search-assistant-container .saHelpContent:before{content:\'\';display:block;float:right;height:20px;width:85px;}\n.search-assistant-wrapper .search-assistant-container .saHelpContent .splFont-mono{background:transparent;border:none;}\n.search-assistant-wrapper .search-assistant-container .saHelpContent h4{margin-top:1px;font-size:inherit;color:#333333;}\n.search-assistant-wrapper .search-assistant-container .saHelpContent h4:first-child{margin-top:0;}\n.search-assistant-wrapper .search-assistant-container .saHelpContent .intro>h4{color:#65a637;}\n.search-assistant-wrapper .search-assistant-container .saHelpContent .intro+h4{margin-top:10px;}\n.search-assistant-wrapper .search-assistant-container .saHelpContent .saHeadingNav{margin-top:10px;}.search-assistant-wrapper .search-assistant-container .saHelpContent .saHeadingNav h4{color:#333333;display:inline;}\n.search-assistant-wrapper .search-assistant-container .saHelpContent .saHeadingNav .splPipe{display:inline-block;width:30px;overflow:hidden;text-indent:50px;}\n.search-assistant-wrapper .search-assistant-container .saHelpContent h4.saExamplesHeader{margin-top:10px;color:#333333;}\n.search-assistant-wrapper .search-assistant-container .saHelpContent .saExamples{margin-top:0px;}\n.search-assistant-wrapper .search-assistant-container .saHelpContent dt{margin-top:10px;}\n.search-assistant-wrapper .search-assistant-container .saHelpContent dt,.search-assistant-wrapper .search-assistant-container .saHelpContent dt h4{font-weight:normal;color:#333333;}\n.search-assistant-wrapper .search-assistant-container .saHelpContent dd{margin-left:20px;}\n.search-assistant-wrapper .search-assistant-container .saHelpContent a{cursor:pointer;}\n.search-assistant-wrapper .search-assistant-container code{color:#65a637;}\n.search-assistant-wrapper .search-assistant-container .introstep{font-weight:bold;margin-top:1em;display:block;}\n.search-assistant-wrapper .search-assistant-container .sakeyword{display:block;}.search-assistant-wrapper .search-assistant-container .sakeyword:focus,.search-assistant-wrapper .search-assistant-container .sakeyword:hover{background-color:#eeeeee;cursor:pointer;}\n.search-assistant-wrapper .search-assistant-container .saClearBottom{*zoom:1;}.search-assistant-wrapper .search-assistant-container .saClearBottom:before,.search-assistant-wrapper .search-assistant-container .saClearBottom:after{display:table;content:\"\";line-height:0;}\n.search-assistant-wrapper .search-assistant-container .saClearBottom:after{clear:both;}\n.search-assistant-wrapper .search-assistant-resize-active{background-color:#eeeeee;border:0 solid #bfbfbf;border-top-color:#bfbfbf;border-bottom-color:#bfbfbf;border-bottom-width:1px;margin:0 3px;height:3px;margin:0;}\n.search-assistant-wrapper .search-assistant-resize-active{margin:0;cursor:ns-resize;}\n.search-assistant-wrapper .search-assistant-resize-active:before{content:\"\";display:block;height:1px;width:10px;margin:0 auto;border-width:1px 0;border-style:solid;opacity:0.8;filter:alpha(opacity=80);}\n.search-assistant-wrapper .search-assistant-activator{background-color:#ffffff;cursor:pointer;-webkit-border-bottom-left-radius:3px;-moz-border-radius-bottomleft:3px;border-bottom-left-radius:3px;-webkit-border-bottom-right-radius:3px;-moz-border-radius-bottomright:3px;border-bottom-right-radius:3px;border:1px solid #bfbfbf;border-top:none;width:15px;height:4px;*height:5px;line-height:4px;*line-height:5px;padding-bottom:2px;font-size:11px;display:block;color:#333333;text-align:center;text-decoration:none;margin:-1px 0 0 7px;}\n.search-assistant-wrapper .icon-triangle-down-small:before{content:\"\\02C5\";}\n.search-assistant-wrapper .icon-triangle-up-small:before{content:\"\\02C4\";}\n.search-assistant-wrapper.search-assistant-enabled{-webkit-box-shadow:0 3px 7px rgba(0, 0, 0, 0.3);-moz-box-shadow:0 3px 7px rgba(0, 0, 0, 0.3);box-shadow:0 3px 7px rgba(0, 0, 0, 0.3);}\n.multiline .search-assistant-resize,.search-assistant-open .search-assistant-resize{border-width:1px;}\n.search-bar-primary .btn{background-color:#61a035;background-image:-moz-linear-gradient(top, #65a637, #5c9732);background-image:-webkit-gradient(linear, 0 0, 0 100%, from(#65a637), to(#5c9732));background-image:-webkit-linear-gradient(top, #65a637, #5c9732);background-image:-o-linear-gradient(top, #65a637, #5c9732);background-image:linear-gradient(to bottom, #65a637, #5c9732);background-repeat:repeat-x;filter:progid:DXImageTransform.Microsoft.gradient(startColorstr=\'#ff65a637\', endColorstr=\'#ff5c9732\', GradientType=0);border-color:#4e802a;border-top-color:#4e802a;border-bottom-color:#4e802a;color:#ffffff;}.search-bar-primary .btn:hover{background-color:#72b13b;background-image:-moz-linear-gradient(top, #7bb93d, #65a637);background-image:-webkit-gradient(linear, 0 0, 0 100%, from(#7bb93d), to(#65a637));background-image:-webkit-linear-gradient(top, #7bb93d, #65a637);background-image:-o-linear-gradient(top, #7bb93d, #65a637);background-image:linear-gradient(to bottom, #7bb93d, #65a637);background-repeat:repeat-x;filter:progid:DXImageTransform.Microsoft.gradient(startColorstr=\'#ff7bb93d\', endColorstr=\'#ff65a637\', GradientType=0);background-color:#7ec44c;border-color:#55802a;border-bottom-color:#55802a;border-top-color:#55802a;background-position:0 0;-webkit-box-shadow:0px 1px 1px rgba(0, 0, 0, 0.08);-moz-box-shadow:0px 1px 1px rgba(0, 0, 0, 0.08);box-shadow:0px 1px 1px rgba(0, 0, 0, 0.08);}\n.search-bar-primary .search-field-wrapper-inner{background-color:#61a035;background-image:-moz-linear-gradient(top, #65a637, #5c9732);background-image:-webkit-gradient(linear, 0 0, 0 100%, from(#65a637), to(#5c9732));background-image:-webkit-linear-gradient(top, #65a637, #5c9732);background-image:-o-linear-gradient(top, #65a637, #5c9732);background-image:linear-gradient(to bottom, #65a637, #5c9732);background-repeat:repeat-x;filter:progid:DXImageTransform.Microsoft.gradient(startColorstr=\'#ff65a637\', endColorstr=\'#ff5c9732\', GradientType=0);border-color:#4e802a;border-top-color:#4e802a;border-bottom-color:#4e802a;}\n.search-bar-primary .search-field-background{background-color:#61a035;background-image:-moz-linear-gradient(top, #65a637, #5c9732);background-image:-webkit-gradient(linear, 0 0, 0 100%, from(#65a637), to(#5c9732));background-image:-webkit-linear-gradient(top, #65a637, #5c9732);background-image:-o-linear-gradient(top, #65a637, #5c9732);background-image:linear-gradient(to bottom, #65a637, #5c9732);background-repeat:repeat-x;filter:progid:DXImageTransform.Microsoft.gradient(startColorstr=\'#ff65a637\', endColorstr=\'#ff5c9732\', GradientType=0);border-color:#4e802a;border-top-color:#4e802a;border-bottom-color:#4e802a;}\n.search-bar-primary .search-assistant-resize{border-bottom:1px solid #4e802a;}\n.search-bar-primary .search-assistant-activator{background-color:#5c9732;color:#ffffff;border-color:#4e802a;}\n.search-bar-primary .search-assistant-resize{background-color:#5c9732;color:#ffffff;border-color:#4e802a;}\n.search-bar-primary .multiline .search-assistant-resize{border-right-color:#4e802a;border-left-color:#4e802a;}\n.search-bar-primary .search-assistant-resize-active{border-left:1px solid #4e802a;}\n.search-bar-primary textarea.search-field{border:1px solid #4e802a;border-top-color:#4e802a;border-bottom-color:#4e802a;}\n.search-bar-primary .search-apps .link-label,.search-bar-primary .search-apps .label-prefix{display:inline-block;*display:inline;*zoom:1;vertical-align:middle;line-height:1.2em;max-width:10em;overflow:hidden;text-overflow:ellipsis;}\n.search-bar-primary .search-apps .caret{line-height:1em;vertical-align:middle;}\n.dropdown-menu-apps li{line-height:20px;position:relative;}\n.dropdown-menu-apps .link-label{display:block;white-space:nowrap;word-wrap:normal;overflow:hidden;text-overflow:ellipsis;padding-right:28px;}\n.dropdown-menu-apps .menu-icon{width:18px;height:18px;position:absolute;right:10px;top:7px;}\n.lt-ie9 .shared-search-input{*min-height:28px;}\n.lt-ie9 .search-field-wrapper{*min-height:28px;}\n.lt-ie9 .placeholder{*padding:4px 0 !important;*min-height:15px !important;}\n.lt-ie9 .search-field{padding:2px 0px 0 0px;min-height:20px !important;*margin-top:-1px;}\n.ie7 .search-bar-wrapper{*position:relative;*z-index:1;}\n.ie7 .search-bar *{*min-width:1px;}\n.ie7 .icon-search-thin{*line-height:1.2em;}\n.ie7 .search-field-background,.ie7 .search-assistant-resize{display:none;}\n.ie7 .search-assistant-resize-active{display:block;}\n.ie7 .shared-searchbar-input{top:-1px;}\n@media print{.shared-searchbar-input{padding:0 !important;} .search-bar{width:100%;display:block;}.search-bar td,.search-bar tbody,.search-bar tr{display:block;width:100%;} .search-field{display:none !important;} .shadowTextarea{width:100% !important;left:auto !important;top:auto !important;position:static !important;border-color:transparent !important;} .search-field-background,.search-assistant-wrapper,.search-button{display:none !important;}}\n'); }); requirejs.s.contexts._.nextTick = requirejs.nextTick; 
