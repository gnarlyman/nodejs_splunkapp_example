
define('splunkjs/mvc/progressbarview',['require','exports','module','jquery','./mvc','backbone','./basesplunkview','underscore','views/shared/delegates/Popdown','splunk.util','splunk.config'],function(require, exports, module) {
    var $ = require('jquery');
    var mvc = require('./mvc');
    var Backbone = require('backbone');
    var BaseSplunkView = require('./basesplunkview');
    var _ = require('underscore');
    var PopdownView = require('views/shared/delegates/Popdown');
    var SplunkUtil = require('splunk.util');
    var splunkConfig = require('splunk.config');

    // Image assets are in a different place depending on whether we are running 
    // in independent mode. Here we figure out which image to use and decide
    // on the path to get it from depending on whether we are in independent mode
    var IMAGE_NAME = (window.devicePixelRatio > 1) ? 'progress@2x.gif' : 'progress.gif';
    var IMAGE_URL = (splunkConfig.INDEPENDENT_MODE)
        // toUrl called with an empty string gives us the base require 
        // url relative to this page. Location of the images is hardcoded
        // relative to the base when in independent mode
        ? require.toUrl('') + 'splunkjs/css/img/splunk/' + IMAGE_NAME
        : SplunkUtil.make_url('/static/img/splunk/' + IMAGE_NAME);
    
    var ProgressBarView = BaseSplunkView.extend({
        moduleId: module.id,
        
        className: 'splunk-progressbar',
        configure: function() {
            // Silently rewrite the deprecated 'manager' setting if present
            if (this.options.manager) {
                this.options.managerid = this.options.manager;
            }
            
            BaseSplunkView.prototype.configure.apply(this, arguments);
        },
        initialize: function() {
            this.configure();
            
            if(!this.children) {
                this.children = {};
            }
            this.bindToComponentSetting('managerid', this.onManagerChange, this);
            this.model = { jobState: new Backbone.Model(), messages: new Backbone.Model() };
            var debouncedRender = _.debounce(this.render);
            this.model.jobState.on('change', debouncedRender, this);
            this.model.messages.on('change', debouncedRender, this);
        },
        onManagerChange: function(ctxs, ctx) {
            if(this.manager) {
                this.manager.off(null, null, this);
            }
            this.manager = ctx;
            if(!ctx) {
                return;
            }
            this.model.jobState.clear();
            this.model.messages.clear();
            this.manager.on("search:start", this.onSearchStart, this);
            this.manager.on("search:progress", this.onSearchProgress, this);
            this.manager.on("search:error", this.onSearchFail, this);
            this.manager.on("search:fail", this.onSearchFail, this);
            this.manager.on("search:cancelled", this.onSearchCancelled, this);
            this.manager.replayLastSearchEvent(this);
        },
        onSearchStart: function() {
            this.model.messages.clear();
            this.model.jobState.set({ text: '', progress: 0, active: true });
        },
        onSearchProgress: function(properties) {
            var content = properties.content || {};
            var dispatchState = content.dispatchState;

            this.model.jobState.set({ 'realTime': content.isRealTimeSearch });

            if(content.messages) {
                var errMsgs = _(content.messages).chain().where({ 'type': 'ERROR' }).pluck('text').value();
                var warnMsgs = _(content.messages).chain().where({ 'type': 'WARN' }).pluck('text').value();
                this.model.messages.set('errors', errMsgs, { unset: _.isEmpty(errMsgs) });
                this.model.messages.set('warnings', warnMsgs, { unset: _.isEmpty(warnMsgs) });
            }

            if(dispatchState === undefined) {
                this.model.jobState.clear();
            } else if(dispatchState === 'FAILED') {
                this.model.jobState.clear();
            } else {

                var progress = content.doneProgress, pct, msg, active = true;
                if(_.isNumber(progress) && !_.isNaN(progress)) {
                    pct = String(Math.floor(progress * 100));
                }
                var status = _("Loading").t();  
                active = true;
                msg = [status, ' - ', pct + '%'].join('');

                if(content.dispatchState === 'PAUSED') {
                    msg = _("Paused").t();
                    active = false;
                } else {
                    active = true;
                }

                if(content.dispatchState === 'DONE') {
                    this.model.jobState.clear();
                } else {
                    this.model.jobState.set({
                        text: msg,
                        progress: pct,
                        active: active
                    });
                }
            }
        },
        onSearchFail: function() {
            this.model.jobState.clear();
        },
        onSearchCancelled: function() {
            this.model.jobState.clear();
        },
        render: function() {
            if(this.model.jobState.has('progress') && this.model.jobState.get('realTime') !== true) {
                if(!this.$progress) {
                    this.$progress = $('<div class="progress-bar"><div class="progress-msg"></div>' +
                            '<div class="progress">' +
                            '<div class="bar" style="width: 0%"></div>' +
                            '</div>' +
                            '</div>').appendTo(this.el);

                    $('<img/>').attr('src', IMAGE_URL).appendTo(this.$progress.find('.bar'));
                }
                this.$('.progress-msg').text(this.model.jobState.get('text'));
                this.$('.progress').find('.bar').width((this.model.jobState.get('progress') || 0) + '%');

            } else {
                if(this.$progress) {
                    this.$progress.remove();
                    this.$progress = null;
                }
            }
            if(this.model.messages.has('errors') || this.model.messages.has('warnings')) {
                if(!this.$error) {
                    this.$error = $('<div class="error-details">' +
                                    '<a href="#" class="dropdown-toggle error-indicator"><i class="icon-warning-sign"></i></a>' +
                                    '<div class="dropdown-menu"><div class="arrow"></div>' +
                                        '<ul class="first-group error-list">' +
                                        '</ul>' +
                                    '</div>' +
                                    '</div>').appendTo(this.$el);
                }
                this.$error.find('.error-list').html(this.errorStatusTemplate(_.extend({ _:_, errors: null, warnings: null }, this.model.messages.toJSON())));

                if(!this.children.errorPopdown) {
                    this.children.errorPopdown = new PopdownView({ el: this.$error });
                }
                this.$error[this.model.messages.has('errors') ? 'addClass' : 'removeClass']('severe');
            } else {
                if(this.$error) {
                    this.$error.remove();
                    this.$error = null;
                }
                if(this.children.errorPopdown) {
                    this.children.errorPopdown.remove();
                    this.children.errorPopdown = null;
                }
            }

            return this;
        },
        remove: function() {
            _(this.children).invoke('remove');
            _(this.model).invoke('off');
            if(this.manager) {
                this.manager.off(null, null, this);
            }
            return BaseSplunkView.prototype.remove.call(this);
        },
        errorStatusTemplate: _.template(
                '<% _(errors).each(function(error){ %>' +
                    '<li class="error"><i class="icon-warning-sign"></i> <%- error %></li>' +
                '<% }); %>' +
                '<% _(warnings).each(function(warn){ %>' +
                    '<li class="warning"><i class="icon-warning-sign"></i> <%- warn %></li>' +
                '<% }); %>')
    });

    return ProgressBarView;
});
