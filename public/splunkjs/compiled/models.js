
// THIS FILE IS PURPOSEFULLY EMPTY FOR R.JS COMPILER
// IT IS A COMPILER TARGET FILE, AS WE CANNOT CREATE NEW FILES DYNAMICALLY FOR 
// THE COMPILER;
define("splunkjs/compiled/models", function(){});

define('models/shared/splunkbar/SystemMenuSection',[
    'models/Base'
],
function(
    BaseModel
){
    return BaseModel.extend({
        initialize: function(){
            BaseModel.prototype.initialize.apply(this, arguments);
            
            //TODO lame...
            if( !this.get('items') ){
                this.set({items: []});
            }
        }
    });
});
define('collections/shared/splunkbar/SystemMenuSections',[
    'models/shared/splunkbar/SystemMenuSection',
    'collections/Base'
],
function(
    SystemMenuSectionModel,
    BaseCollection
){
    return BaseCollection.extend({
        model: SystemMenuSectionModel,
        initialize: function() {
            BaseCollection.prototype.initialize.apply(this, arguments);
        },
        comparator: function(a, b){
            var x = a.get('order'),
                y = b.get('order');
            if(x === y){
                return 0;
            }
            return x > y ? 1 : -1;
        }
    });
});
define('models/shared/FlashMessage',
    [
        'models/Base'
    ],
    function(BaseModel) {
        return BaseModel.extend({
            initialize: function() {
                BaseModel.prototype.initialize.apply(this, arguments);
            },
            idAttribute: 'key'
        });
    }
);

define('collections/shared/FlashMessages',
        [
            'collections/Base',
            "models/shared/FlashMessage"
        ],
        function(BaseCollection, FlashMessageModel) {
            return BaseCollection.extend({
                model: FlashMessageModel,
                initialize: function() {
                    BaseCollection.prototype.initialize.apply(this, arguments);
                }
            });
        }
);

define('models/services/authentication/CurrentContext',
    [
        'models/SplunkDBase'
    ],
    function(SplunkDBaseModel) {
        return SplunkDBaseModel.extend({
            url: "authentication/current-context",
            initialize: function() {
                SplunkDBaseModel.prototype.initialize.apply(this, arguments);
            }
        });
    }
);
define('collections/services/authentication/CurrentContexts',
    [
        "models/services/authentication/CurrentContext",
        "collections/SplunkDsBase"
    ],
    function(CurrentContextModel, SplunkDsBaseCollection) {
        return SplunkDsBaseCollection.extend({
            model: CurrentContextModel,
            url: "authentication/current-context",
            initialize: function() {
                SplunkDsBaseCollection.prototype.initialize.apply(this, arguments);
            }
        });
    }
);
define('models/services/data/ui/Manager',
    [
        'models/SplunkDBase'
    ],
    function(SplunkDBaseModel) {
        return SplunkDBaseModel.extend({
            url: "data/ui/manager",
            initialize: function() {
                SplunkDBaseModel.prototype.initialize.apply(this, arguments);
            }
        });
    }
);
define('collections/services/data/ui/Managers',
    [
        "models/services/data/ui/Manager",
        "collections/SplunkDsBase"
    ],
    function(ManagerModel, SplunkDsBaseCollection) {
        return SplunkDsBaseCollection.extend({
            url: "data/ui/manager",
            model: ManagerModel,
            initialize: function() {
                SplunkDsBaseCollection.prototype.initialize.apply(this, arguments);
            }
        });
    }
);
define('models/services/data/ui/View',
    [
     'jquery',
     'splunk.util',
     'models/SplunkDBase',
     'underscore'
    ],
    function($, splunkutil, SplunkDBaseModel, _) {
        return SplunkDBaseModel.extend({
            url: "data/ui/views",
            initialize: function() {
                SplunkDBaseModel.prototype.initialize.apply(this, arguments);
            },
            isXML: function() {
                return this.entry.content.get('eai:type') === 'views';
            },
            isHTML: function() {
                return this.entry.content.get('eai:type') === 'html';
            },
            getViewType: function() {
                var typeLabel = 'n/a';
                if(this.isXML()) {
                    typeLabel = 'XML';
                } else if(this.isHTML()) {
                    typeLabel = 'HTML';
                }
                return typeLabel;
            },
            getLabel: function() {
                return this.entry.content.get('label') || this.entry.get('name');
            },
            isRoot: function(nodeName) {
                if(!this.isXML()) {
                    return false;
                }
                var data = this.entry.content.get('eai:data');
                var $xmlDoc = this.get$XML();
                var rootNode = $xmlDoc.find(':eq(0)')[0];
                if (!rootNode) { 
                    return false;
                }
                function lower(s){ return (s && s.toLowerCase()) || s; }
                return arguments.length > 1 ?
                        _.any(arguments, function(nodeName){ return lower(rootNode.nodeName) === lower(nodeName); }) :
                        lower(rootNode.nodeName) === lower(nodeName);
            },
            isAdvanced: function(visibility) {
                var $xmlDoc, $root, type, isVisible;
                if (!this.isRoot('view')) { 
                    return false; 
                }
                if (visibility) {
                    $xmlDoc = this.get$XML();
                    $root = $xmlDoc.find(':eq(0)');
                    type = $root.attr('type');
                    isVisible = $root.attr('isVisible');
                    if (type && type=='html') {
                        return false;
                    }
                    if(isVisible && !splunkutil.normalizeBoolean(isVisible)){
                        return false;
                    }
                }
                return true;
            },
            get$XML: function() {
                var data = (this.isXML() && this.entry.content.get('eai:data')) || '<dashboard/>';
                var xmlDoc;
                try {
                    xmlDoc = $.parseXML(data);
                } catch (e) {
                    xmlDoc = $.parseXML('<dashboard/>');
                }
                // SPL-68158 Prevent any kind of XSS when modifying XML using jQuery
                $(xmlDoc).find('script').remove();
                return $(xmlDoc);
            },
            isDashboard: function() {
                return this.isRoot('dashboard');
            },
            isForm: function() {
                return this.isRoot('form');
            },
            isSimpleXML: function() {
                return this.isXML() && this.isRoot('dashboard','form');
            }
        });
    }
);

define('collections/services/data/ui/Views',
    [
        'jquery',
        'backbone',
        'models/services/data/ui/View',
        'collections/SplunkDsBase',
        'splunk.util'
    ],
    function($, Backbone, ViewModel, SplunkDsBaseCollection, splunk_utils) {
        return SplunkDsBaseCollection.extend({
            url: 'data/ui/views',
            model: ViewModel,
            initialize: function() {
                SplunkDsBaseCollection.prototype.initialize.apply(this, arguments);
            }
        });
    }
);

define('models/services/Message',
    [
        'models/SplunkDBase'
    ],
    function(SplunkDBaseModel) {
        return SplunkDBaseModel.extend({
            url: 'messages',
            initialize: function() {
                SplunkDBaseModel.prototype.initialize.apply(this, arguments);
            }
        });
    }
);

define('collections/services/Messages',
    [
        "jquery",
        "models/services/Message",
        "collections/SplunkDsBase"
    ],
    function($, MessageModel, SplunkDsBaseCollection) {
        return SplunkDsBaseCollection.extend({
            model: MessageModel,
            url: 'messages',
            initialize: function() {
                SplunkDsBaseCollection.prototype.initialize.apply(this, arguments);
            },
            destroyAll: function() {
                if (this.destroying === true) {
                    return this.destroyDFD;
                }
                this.destroying = true;
                var that = this;
                this.destroyDFD = new $.Deferred(function(dfd){
                    function destroyNext() {
                        var dummyDefered = new $.Deferred();
                        if (that.length > 0) {
                            var model = that.pop();
                            var destroyPromise = model.destroy() || dummyDefered.resolve().promise();
                            destroyPromise.always( destroyNext);
                            return destroyPromise;
                        }
                        else {
                            dfd.resolve();
                        }
                    }
                    destroyNext();
                });
                this.destroyDFD.then(function() {
                    that.destroying = false;
                });
                return this.destroyDFD.promise();
            }
        });
    }
);

define('models/services/SavedSearch',
    [
		'jquery',
		'backbone',
		'util/splunkd_utils',
		'models/Base',
		'models/SplunkDBase',
		'underscore',
		'splunk.util'
    ],
    function($, Backbone, splunkd_utils, BaseModel, SplunkDBaseModel, _, splunkUtil) {
        var Embed = BaseModel.extend({
            initialize: function(attributes, options) {
                BaseModel.prototype.initialize.apply(this, arguments);
            },
            sync: function(method, model, options) {
                var defaults = {
                    data: {
                        output_mode: 'json'
                    }
                };
                switch(method) {
                    case 'update':
                        defaults.processData = true;
                        defaults.type = 'POST';
                        defaults.url = splunkd_utils.fullpath(model.id);
                        $.extend(true, defaults, options);
                        break;
                    default:
                        throw new Error('invalid method: ' + method);
                }
                return Backbone.sync.call(this, method, model, defaults);
            }
        });
        return SplunkDBaseModel.extend({
            url: 'saved/searches',
            initialize: function() {
                SplunkDBaseModel.prototype.initialize.apply(this, arguments);
                this.on('change:id', function() {
                    var shareLink,
                        unshareLink;
                    if (this.id) {
                        shareLink = this.id + '/embed';
                        unshareLink = this.id + '/unembed';
                    }
                    this.embed.set('id', shareLink);
                    this.unembed.set('id', unshareLink); 
                }, this);
                this.embed.on('sync', function() {
                    this.safeFetch();
                }, this);
                this.unembed.on('sync', function() {
                    this.safeFetch();
                }, this);
            },
            initializeAssociated: function() {
                SplunkDBaseModel.prototype.initializeAssociated.apply(this, arguments);
                this.embed = this.embed || new this.constructor.Embed();
                this.associated.embed = this.embed;
                this.unembed = this.unembed || new this.constructor.Embed();
                this.associated.unembed = this.unembed;
            },
            parse: function(response, options) {
                response = this.migrateAttributes(response, options);
                _.extend(options, {skipClone: true});
                this.initializeAssociated();
                if (splunkd_utils.isExistingEntity(response)) { 
                    var id = response.entry[0].links.alternate;
                    this.embed.set('id', id + '/embed');
                    this.unembed.set('id', id + '/unembed'); 
                }
                return SplunkDBaseModel.prototype.parse.call(this, response, options);
            },
            setFromSplunkD: function(payload, options) {
                payload = this.migrateAttributes(payload, options);
                _.extend(options, {skipClone: true});
            	if (splunkd_utils.isExistingEntity(payload)) {
                    var id = payload.entry[0].links.alternate;  
                    this.embed.set('id', id + '/embed');
                    this.unembed.set('id', id + '/unembed');
                }
                return SplunkDBaseModel.prototype.setFromSplunkD.call(this, payload, options);
            },
            migrateAttributes: function(response, options) {
                options = options || {};
                if (!options.skipClone) {
                    response = $.extend(true, {}, response);
                }
                
                if (response && response.entry && response.entry[0].content) {
                    var content = response.entry[0].content,
                        format = content['action.email.format'];

                    if (_.indexOf(['html', 'plain', 'pdf'], format) != -1) {
                        // for backwards compatibility for SPL-79585
                        response.entry[0].content['action.email.format'] = 'table';
                    } else if (format ==='csv' && splunkUtil.normalizeBoolean(content['action.email.sendresults']) &&
                            !(splunkUtil.normalizeBoolean(content['action.email.sendcsv']) ||
                                splunkUtil.normalizeBoolean(content['action.email.sendpdf']) ||
                                splunkUtil.normalizeBoolean(content['action.email.inline']))) {
                        // for backwards compatibility for SPL-79561
                        response.entry[0].content['action.email.sendcsv'] = '1';
                    }
                }
                return response;
            }
        }, 
        {
            Embed: Embed
        });
    }
);

define('collections/services/SavedSearches',
    [
        'models/services/SavedSearch',
        'collections/SplunkDsBase'
    ],
    function(Model, Collection) {
        return Collection.extend({
            initialize: function() {
                Collection.prototype.initialize.apply(this, arguments);
            },
            url: 'saved/searches',
            model: Model
        });
    }
);

define('models/services/search/TimeParser',
    [
        'jquery',
        'underscore',
        'backbone',
        'models/Base',
        'util/splunkd_utils'
    ],
    function($, _, Backbone, BaseModel, splunkd_utils) {
        return BaseModel.extend({
            initialize: function(options) {
                BaseModel.prototype.initialize.call(this, options);
            },
            sync: function(method, model, options) {
                switch (method) {
                    case 'read':
                        var syncOptions = splunkd_utils.prepareSyncOptions(options, model.url);
                        if (options.data.time === ''){
                            model.set({key: '', value: ''});
                            return;
                        }
                        return Backbone.sync.call(this, 'read', model, syncOptions);
                    default:
                        throw 'Operation not supported';
                }
            },
            url: "/services/search/timeparser",
            parse:  function(response) {
                if (!response) {
                    return {};
                }
                var key = _.keys(response)[0],
                    value = response[key];
                return {
                    key: key,
                    value: value
                };
            },
            idAttribute: 'key'
        });
    }
);
define('collections/services/search/TimeParsers',
    [
        "underscore",
        "backbone",
        "models/services/search/TimeParser",
        "collections/Base",
        "util/splunkd_utils"
    ],
    function(_, Backbone, TimeParserModel, CollectionsBase, splunkDUtils) {
        return CollectionsBase.extend({
            model: TimeParserModel,
            intialize: function() {
                CollectionsBase.prototype.initialize.apply(this, arguments);
            },
            sync: function(method, collection, options) {
                var appOwner = {},
                    defaults = {
                        data: {output_mode: "json"},
                        traditional: true
                    };
                switch (method) {
                    case 'read':
                        if (options && options.data){
                            appOwner = $.extend(appOwner, { //JQuery purges undefined
                                app: options.data.app || undefined,
                                owner: options.data.owner || undefined
                            });
                            delete options.data.app;
                            delete options.data.owner;
                        }
                        defaults.url = splunkDUtils.fullpath(collection.url, appOwner);
                        $.extend(true, defaults, options || {});
                        return Backbone.sync.call(this, 'read', collection, defaults);
                    default:
                        throw 'Operation not supported';
                }
            },
            url: "/services/search/timeparser",
            parse: function(response) {
                var model,
                    models = [];
                for (var key in response) {
                    model = {};
                    model[key] = response[key];
                    models.push(model);
                }
                return models;
            }
        });
    }
);

define('models/services/data/ui/Nav',
    [
        'models/SplunkDBase'
    ],
    function(SplunkDBaseModel) {
        return SplunkDBaseModel.extend({
            url: "data/ui/nav",
            id: "data/ui/nav",
            initialize: function() {
                SplunkDBaseModel.prototype.initialize.apply(this, arguments);
            }
        });
    }
);
define('collections/services/data/ui/Navs',
    [
        "models/services/data/ui/Nav",
        "collections/SplunkDsBase"
    ],
    function(NavModel, SplunkDsBaseCollection) {
        return SplunkDsBaseCollection.extend({
            url: "data/ui/nav",
            model: NavModel,
            initialize: function() {
                SplunkDsBaseCollection.prototype.initialize.apply(this, arguments);
            }
        });
    }
);
define('models/search/SelectedField',
    [
        'models/Base'
    ],
    function(BaseModel) {
        return BaseModel.extend({
            initialize: function() {
                BaseModel.prototype.initialize.apply(this, arguments);
            },
            sync: function() {
                throw 'Method disabled';
            }
        });
    }
);

define('collections/search/SelectedFields',
	[
        'collections/Base',
        'models/search/SelectedField'
    ],
    function(BaseCollection, SelectedFieldModel) {
        return BaseCollection.extend({
            model: SelectedFieldModel,
            initialize: function() {
                BaseCollection.prototype.initialize.apply(this, arguments);
                this.on('reset add remove', function() {
                    delete this._names;
                }, this);
            },
            sync: function() {
                throw 'Method disabled';
            },
            valuesToJSONString: function() {
                return JSON.stringify(this.pluck('name'));
            },
            names: function() {
                if (!this._names) {
                    this._names = this.pluck('name');
                }
                return this._names;
            },
            findByName: function(name) {
                return this.find(function(model) {
                    return name === model.get('name');
                });
            }
        });
    }
);

define('models/services/configs/EventRenderer',
    [
        'models/SplunkDBase'
    ],
    function(SplunkDBaseModel) {
        return SplunkDBaseModel.extend({
            url: "configs/conf-event_renderers",
            initialize: function() {
                SplunkDBaseModel.prototype.initialize.apply(this, arguments);
            },
            getPriority: function() {
                return parseInt(this.entry.content.get('priority'), 10);
            },
            getEventtype: function() {
                return this.entry.content.get('eventtype');
            }
        });
    }
);

define('collections/services/configs/EventRenderers',
    [
        'underscore',   
        'models/services/configs/EventRenderer',
        'collections/SplunkDsBase'
    ],
    function(_, EventRendererModel, SplunkDsBaseCollection) {
        return SplunkDsBaseCollection.extend({
            url: "configs/conf-event_renderers",
            model: EventRendererModel,
            initialize: function() {
                SplunkDsBaseCollection.prototype.initialize.apply(this, arguments);
            },
            getRenderer: function(eventtypes) {
                var renderer;
                if (eventtypes) {
                    for(var i=0; i<eventtypes.length; i++) {
                        for(var j=0; j<this.models.length; j++) {
                            var model = this.models[j];
                            
                            if(model.getEventtype() === eventtypes[i]) {
                                if(!renderer || model.getPriority() > renderer.getPriority()) {
                                    renderer = model;
                                }
                                break; //we request with sorting by priority, so can bail if we find a match
                            }
                        }                    
                    }
                }
                return renderer;
            }
        });
    }
);

define('models/services/data/ui/WorkflowAction',
    [
        'backbone',
        'underscore',
        'models/SplunkDBase'
    ],
    function(Backbone, _, SplunkDBaseModel) {
        var RAW_REX = /\$_raw\$/g;
        return SplunkDBaseModel.extend({
            url: "data/ui/workflow-actions",
            initialize: function() {
                SplunkDBaseModel.prototype.initialize.apply(this, arguments);
            },
            /**
             *  $field$ 
             */
            fieldSubstitute: function(text, data) {
                var settings = {
                        interpolate : /\$([\s\S]+?)\$/g 
                    },
                    $matches$ = text.match(settings.interpolate);
                
                text = this.convertRaw(text, data);
                    
                //underscore templates will raise if the value to be replaced
                //is undefined.  Like 5.0, we will strip out $ delimited values
                //if they do not exist in event.  
                if($matches$) { 
                    _($matches$).each(function($string$) {
                        if(!data[$string$.match(/\$([\s\S]+?)\$/)[1]]){
                            text = text.replace($string$, '');
                        }
                    },this);
                }
                return _.template(text, data, settings);
            },
            /**
             * $@sid$ $@offset$, $@namespace$, $@latest_time$, $@field_name$, $@field_value$ 
             */
            systemSubstitute: function(text, sid, offset, namespace, latest_time, fieldName, fieldValue) {
                var settings = {
                        interpolate : /\$@([\s\S]+?)\$/g
                    },
                    data = {
                        sid: sid,
                        offset: offset,
                        namespace: namespace,
                        latest_time: latest_time,
                        field_name: fieldName,
                        field_value: fieldValue
                    };

                return _.template(text, data, settings);
            },
            convertRaw: function(text, data) {
                /*
                 * SPL-77129, when we request results with segmentation the 
                 * _raw field is returned as an object.  Ensure that we 
                 * replace _raw with the _raw string before passing to the template.
                 */
                 if(RAW_REX.test(text) && !_(data._raw).isArray()) {
                    return text.replace(RAW_REX, data._raw.value);
                 }
                
                return text;
            },
            isInFieldMenu: function() {
                return (this.entry.content.get('display_location') != 'event_menu');
            },
            isInEventMenu: function() {
                return (this.entry.content.get('display_location') != 'field_menu');
            },
            isRestrictedByPresenceOfAllFields: function(event) {
                var eventFields   = event.toJSON(),
                    fieldsPresent = 0,
                    fields = _(this.entry.content.get('fields').split(',')).map(function(field) { 
                        return $.trim(field); 
                    },this),
                    fieldsMatching = new Array(fields.length),
                    len = fields.length;

                /*
                 * Iterate through all fields in the event until all specified fields in the workflow
                 * action have been found to be present or not.
                 */ 
                for (var field in eventFields) {
                    
                    //iteration over fields specified in workflow action
                    for(var k=0; k<len; k++) {
                        var rex = this.globber(fields[k]);
                        
                        if(rex) {
                            var value = rex.exec(field);
                            if(!fieldsMatching[k] && value && value.length > 0) {
                                fieldsMatching[k] = true;
                                fieldsPresent++;
                                
                                if(fieldsPresent >= len) {
                                    return false;
                                } 
                            }
                        }
                    }
                }
                return true;
            }, 
            isRestrictedByEventtype: function(event) {
                var eventtypes, eventTypeFromEvent;
                
                if(this.entry.content.has('eventtypes')) {
                    
                    eventtypes = _((this.entry.content.get('eventtypes')).split(',')).map(function(eventtype) {
                        return $.trim(eventtype);
                    },this);
                    
                    if(event.has('eventtype')) {
                        eventTypeFromEvent = event.get('eventtype');
                        
                        var eventtypesLen = eventtypes.length,
                            j = 0;

                        for(j; j<eventtypesLen; j++) {
                            var rex = this.globber(eventtypes[j]);
                            if(rex) {
                                
                                var len = eventTypeFromEvent.length,
                                    i = 0;
                                for(i; i<len; i++) {
                                    var value = rex.exec(eventTypeFromEvent[i]);
                                    if(value && value.length > 0) {
                                        return false;
                                    }
                                }
                            }
                        }
                    } else {
                        if(eventtypes.indexOf('*') > -1) {
                            return false;
                        }
                    }

                } else {
                    return false;
                }

                return true;
            },
            globber: function(str) {
                var rex, 
                    chars = str.split('');


                //build rex for exact match
                if(_.first(chars) !== '*') {
                    chars.unshift('^');
                }

                if(_.last(chars) !== '*') {
                    chars.push('$');
                }
                str = chars.join('').replace(/\*/g, '.*');
                
                try { 
                    rex = new RegExp(str); 
                } catch(e) {}

                return rex;
            }
        });
    }
);

define('collections/services/data/ui/WorkflowActions',
    [
        'jquery',
        'underscore',
        'backbone',
        'models/services/data/ui/WorkflowAction',
        'collections/SplunkDsBase'
    ],
    function($, _, Backbone, WorkflowActionModel, SplunkDsBaseCollection) {
        return SplunkDsBaseCollection.extend({
            url: 'data/ui/workflow-actions',
            model: WorkflowActionModel,
            initialize: function(){
                SplunkDsBaseCollection.prototype.initialize.apply(this, arguments);
            },
            getEventActions: function(event) {
                var idxs = [];
                this.each(function(model, i) {
                    if(model.isInEventMenu() && !model.isRestrictedByEventtype(event) && !model.isRestrictedByPresenceOfAllFields(event)){
                        idxs.push(i);
                    }
                },this);
                return idxs;
            },
            getFieldActions: function(event, field) {
                var idxs = [];
                this.each(function(model, q) {
                    
                    if(model.isInFieldMenu() && !model.isRestrictedByEventtype(event)) {
                        var fields = _(model.entry.content.get('fields').split(',')).map(function(field) { 
                                return $.trim(field); 
                            },this),
                            k = 0,
                            len = fields.length;
                            
                        for(k; k<len; k++) {
                            var rex = model.globber(fields[k]);
                            
                            if(rex) {
                                var value = rex.exec(field);
                                if(value && value.length > 0) {
                                    idxs.push(q);
                                    break;
                                }
                            }
                            
                        }
                    }
                },this);
                return idxs;
            }
        });
    }
);

define('models/services/search/jobs/Control',
    [
         'jquery',
         'backbone',
         'models/Base',
         'util/splunkd_utils'
     ],
     function($, Backbone, BaseModel, splunkDUtils) {
        return BaseModel.extend({
            initialize: function(attributes, options) {
                BaseModel.prototype.initialize.apply(this, arguments);
            },
            sync: function(method, model, options) {
                var defaults = {
                    data: {
                        output_mode: 'json'
                    }
                };
                switch(method) {
                case 'update':
                    defaults.processData = true;
                    defaults.type = 'POST';
                    defaults.url = splunkDUtils.fullpath(model.id);
                    $.extend(true, defaults, options);
                    break;
                default:
                    throw new Error('invalid method: ' + method);
                }
                return Backbone.sync.call(this, method, model, defaults);
            }
        });
    }
);

// TODO: a lot of repeated code here and SplunkDBaseV2, consider making this a subclass of SplunkDBaseV2

define('models/services/search/Job',
    [
        'jquery',
        'underscore',
        'backbone',
        'models/Base',
        'models/ACLReadOnly',
        'models/services/ACL',
        'models/services/search/jobs/Control',
        'util/splunkd_utils',
        'splunk.util',
        'util/console'
    ],
    function($, _, Backbone, BaseModel, ACLReadOnlyModel, ACLModel, ControlModel, splunkd_utils, splunkUtil, console) {

        //private sync CRUD methods
        var syncCreate = function(model, options){
            var rootOptions = options,
                rootModel = model,
                deferredResponse = $.Deferred(),
                createModel = new BaseModel(),
                fetchModel = new BaseModel(),
                //TODO: we have some defaults but in reality people should be responsible for passing these
                //in options.data like they are responsible for app and owner
                //Simon asks: does the endpoint set any of these defaults for us????
                createDefaults = {
                    data: {
                        rf: "*",
                        auto_cancel: Model.DEFAULT_AUTO_CANCEL,
                        status_buckets: 300,
                        output_mode: 'json'
                    }
                },
                app_and_owner = {},
                customAttrs = this.getCustomDataPayload();
                       
            options = options || {};
            options.data = options.data || {};
            app_and_owner = $.extend(app_and_owner, { //JQuery purges undefined
                app: options.data.app || undefined,
                owner: options.data.owner || undefined,
                sharing: options.data.sharing || undefined
            });
            
            var url = splunkd_utils.fullpath(model.url, app_and_owner);
            
            //append the values from the entry.content.custom model
            $.extend(true, createDefaults.data, customAttrs || {});
            $.extend(true, createDefaults.data, options.data);
            delete createDefaults.data.app;
            delete createDefaults.data.owner;
            delete createDefaults.data.sharing;
            
            //add the leading search command if it isn't present
            if (createDefaults.data.search) {
                createDefaults.data.search = splunkUtil.addLeadingSearchCommand(createDefaults.data.search, true);
            }
            
            //reset options.data to only the app and owner
            options.data = $.extend(true, {}, app_and_owner);
            
            model.trigger('request', model, deferredResponse, options);
            
            //TODO: Maybe we should be faithful to SplunkD here and make it the consumer's responsibility to fetch after create
            //this would mean that parse would need to handle the sid only payload and the full object payload
            var  createDeferred = createModel.save({}, {
                url: url,
                processData: true,
                data: createDefaults.data,
                success: function(createModel, response, options) {
                    // need an id so that in case of an empty response we don't blow up
                    rootModel.set('id', createModel.get('sid'));
                    var fetchDeferred = fetchModel.fetch({
                        url: url + "/" + encodeURIComponent(createModel.get("sid")),
                        data: {
                            output_mode: "json"
                        },
                        success: function(fetchModel, response, options) {
                            rootOptions.success(response);
                        },
                        error: function(fetchModel, response, options) {
                            rootOptions.error(response);
                        }
                    });
                    fetchDeferred.done(function() {
                        deferredResponse.resolve.apply(deferredResponse, arguments);
                    });
                    fetchDeferred.fail(function() {
                        deferredResponse.reject.apply(deferredResponse, arguments);
                    });
                },
                error: function(createModel, response, options) {
                    rootOptions.error(response);
                }
            });
            createDeferred.fail(function() {
                deferredResponse.reject.apply(deferredResponse, arguments);
            });
            return deferredResponse.promise();
        },
        syncRead = function(model, options){
            var defaults = {
                    data: {
                        output_mode: 'json'
                    }
                },
                app_and_owner = {};

            if (model.isNew()){
                throw new Error('You cannot read a job without an id.');
            }
            
            if (options && options.data){
                app_and_owner = $.extend(app_and_owner, { //JQuery purges undefined
                    app: options.data.app || undefined,
                    owner: options.data.owner || undefined,
                    sharing: options.data.sharing || undefined
                });
            }

            defaults.url = splunkd_utils.fullpath(model.url + "/" + encodeURIComponent(model.id), app_and_owner);
            $.extend(true, defaults, options || {});
            
            delete defaults.data.app;
            delete defaults.data.owner;
            delete defaults.data.sharing;
            
            return Backbone.sync.call(this, "read", model, defaults);
        },
        syncUpdate = function(model, options){
            var defaults = {data: {output_mode: 'json'}},
                app_and_owner = {},
                customAttrs = this.getCustomDataPayload();
            
            if (options && options.data){
                app_and_owner = $.extend(app_and_owner, { //JQuery purges undefined
                    app: options.data.app || undefined,
                    owner: options.data.owner || undefined,
                    sharing: options.data.sharing || undefined
                });
            }
            
            //append the values from the entry.content.custom model
            $.extend(true, defaults.data, customAttrs || {});

            defaults.url = splunkd_utils.fullpath(model.url + "/" + encodeURIComponent(model.id), app_and_owner);
            defaults.processData = true;
            defaults.type = 'POST';
            
            $.extend(true, defaults, options || {});
            
            delete defaults.data.app;
            delete defaults.data.owner;
            delete defaults.data.sharing;
            
            return Backbone.sync.call(this, "update", model, defaults);
        },
        syncDelete = function(model, options){
            var defaults = {data: {output_mode: 'json'}},
                url = model.url + "/" + encodeURIComponent(model.id);

            if(options.data && options.data.output_mode){
                //add layering of url if specified by user
                defaults.url = splunkd_utils.fullpath(url, {}) + '?output_mode=' + encodeURIComponent(options.data.output_mode);
                delete options.data.output_mode;
            } else {
                //add layering of url if specified by user
                defaults.url = splunkd_utils.fullpath(url, {}) + '?output_mode=' + encodeURIComponent(defaults.data.output_mode);
                delete defaults.data.output_mode;
            }
            $.extend(true, defaults, options);
            defaults.processData = true;

            return Backbone.sync.call(this, "delete", model, defaults);
        };
        
        var Model = BaseModel.extend({
            url: "search/jobs",
            initialize: function(attributes, options) {
                BaseModel.prototype.initialize.apply(this, arguments);
                
                this.initializeAssociated();
                
                this.entry.links.on("change:control", function() {
                    this.control.set('id', this.entry.links.get('control'));
                }, this);

                this.entry.links.on("change:alternate", function() {
                    var alt = this.entry.links.get('alternate');
                    if (alt) {
                        alt = alt + "/acl";
                    }
                    this.acl.set('id', alt);
                }, this);

                if (options && options.splunkDPayload){
                    this.setFromSplunkD(options.splunkDPayload, {silent: true});
                }
            },
            parseSplunkDMessages: function(response) {
                var messages = BaseModel.prototype.parseSplunkDMessages.call(this, response);
                if(response && response.entry && response.entry.length > 0) {
                    var entry = response.entry[0],
                        content = entry.content || {};

                    messages = _.union(
                        messages,
                        splunkd_utils.parseMessagesObject(entry.messages),
                        splunkd_utils.parseMessagesObject(content.messages)
                    );
                    // handle zombie jobs, which often show up without any associated messages
                    if(content.isZombie) {
                        messages.push(splunkd_utils.createMessageObject(splunkd_utils.FATAL, 'Job terminated unexpectedly'));
                    }
                }
                return messages;
            },
            initializeAssociated: function() {
                // do a dynamic lookup of the current constructor so that this method is inheritance-friendly
                var RootClass = this.constructor;
                this.associated = this.associated || {};

                //instance level models
                this.links = this.links || new RootClass.Links();
                this.associated.links = this.links;
                
                this.generator = this.generator || new RootClass.Generator();
                this.associated.generator = this.generator;
                
                this.paging = this.paging || new RootClass.Paging();
                this.associated.paging = this.paging;

                //nested instance level on entry
                if (!this.entry){
                    this.entry = new RootClass.Entry();

                    this.entry.links = new RootClass.Entry.Links();
                    this.entry.associated.links = this.entry.links;

                    this.entry.acl = new RootClass.Entry.ACL();
                    this.entry.associated.acl = this.entry.acl;

                    //nested on content
                    this.entry.content = new RootClass.Entry.Content();

                    this.entry.content.performance = new RootClass.Entry.Content.Performance();
                    this.entry.content.associated.performance = this.entry.content.performance;

                    this.entry.content.request = new RootClass.Entry.Content.Request();
                    this.entry.content.associated.request = this.entry.content.request;
                    
                    this.entry.content.runtime = new RootClass.Entry.Content.Runtime();
                    this.entry.content.associated.runtime = this.entry.content.runtime;
                    
                    this.entry.content.custom = new RootClass.Entry.Content.Custom();
                    this.entry.content.associated.custom = this.entry.content.custom;
                    
                    this.entry.associated.content = this.entry.content;
                }
                this.associated.entry = this.entry;
                
                //associated EAI endpoint models
                this.control = this.control || new ControlModel();
                this.associated.control = this.control;
                
                this.acl = this.acl || new ACLModel();
                this.associated.acl = this.acl;
            },
            sync: function(method, model, options) {
                switch(method){
                    case 'create':
                        return syncCreate.call(this, model, options);
                    case 'read':
                        return syncRead.call(this, model, options);
                    case 'update':
                        return syncUpdate.call(this, model, options);
                    case 'delete':
                        return syncDelete.call(this, model, options);
                    default:
                        throw new Error('invalid method: ' + method);
                }
            },
            parse: function(response) {
                // make a defensive copy of response since we are going to modify it
                response = $.extend(true, {}, response);
                //when called from the collection fetch we will need to ensure that our
                //associated models are initialized because parse is called before
                //initialize
                this.initializeAssociated();
                
                if (!response || !response.entry || response.entry.length === 0) {
                    console.log('Response has no content to parse');
                    return;
                }
                var response_entry = response.entry[0];

                //id
                //this needs to be the first thing so that people can get !isNew()
                this.id = response_entry.content.sid;
                response.id = response_entry.content.sid;

                //top-level
                this.links.set(response.links);
                delete response.links;
                this.generator.set(response.generator);
                delete response.generator;
                this.paging.set(response.paging);
                delete response.paging;
                
                //sub-entry
                this.entry.links.set(response_entry.links);
                delete response_entry.links;
                
                this.entry.acl.set(response_entry.acl);
                delete response_entry.acl;
                
                //sub-content
                this.entry.content.performance.set(response_entry.content.performance);
                delete response_entry.content.performance;
                
                this.entry.content.request.set(response_entry.content.request);
                delete response_entry.content.request;
                
                this.entry.content.runtime.set(response_entry.content.runtime);
                delete response_entry.content.runtime;
                
                this.entry.content.custom.set(response_entry.content.custom);
                delete response_entry.content.custom;
                
                //content remainder
                this.entry.content.set(response_entry.content);
                delete response_entry.content;
                
                //entry remainder
                this.entry.set(response_entry);
                delete response.entry;
                return response;
            },
            setFromSplunkD: function(payload, options) {
                this.attributes = {};
                var cloned_payload = $.extend(true, {}, payload);
                var oldId = this.id;

                //object assignment
                if (cloned_payload) {
                    if (cloned_payload.entry && cloned_payload.entry[0]) {
                        var payload_entry = cloned_payload.entry[0];

                        if(payload_entry.content){
                            //id
                            //this needs to be the first thing so that people can get !isNew()
                            this.set({id: payload_entry.content.sid}, {silent: true});
                            cloned_payload.id = payload_entry.content.sid;

                            if (payload_entry.content.performance) {
                                this.entry.content.performance.set(payload_entry.content.performance, options);
                                delete payload_entry.content.performance;
                            }

                            if (payload_entry.content.request) {
                                this.entry.content.request.set(payload_entry.content.request, options);
                                delete payload_entry.content.request;
                            }
                            
                            if (payload_entry.content.runtime) {
                                this.entry.content.runtime.set(payload_entry.content.runtime, options);
                                delete payload_entry.content.runtime;
                            }
                            
                            if (payload_entry.content.custom) {
                                this.entry.content.custom.set(payload_entry.content.custom, options);
                                delete payload_entry.content.custom;
                            }

                            this.entry.content.set(payload_entry.content, options);
                            delete payload_entry.content;
                        }

                        if(payload_entry.links){
                            this.entry.links.set(payload_entry.links, options);
                            if (payload_entry.links.control) {
                                this.control.set('id', payload_entry.links.control, options);
                            }
                            if (payload_entry.links.alternate) {
                                this.acl.set('id', payload_entry.links.alternate + "/acl", options);
                            }
                            delete payload_entry.links;
                        }

                        if(payload_entry.acl){
                            this.entry.acl.set(payload_entry.acl, options);
                            delete payload_entry.acl;
                        }
                        
                        this.entry.set(payload_entry, options);
                        delete cloned_payload.entry;
                    }
                    if(cloned_payload.links) {
                        this.links.set(cloned_payload.links, options);
                        delete cloned_payload.links;
                    }
                    if(cloned_payload.generator) {
                        this.generator.set(cloned_payload.generator, options);
                        delete cloned_payload.generator;
                    }
                    if(cloned_payload.paging) {
                        this.paging.set(cloned_payload.paging, options);
                        delete cloned_payload.paging;
                    }
                    
                    //reset the internal root model due to pre-init routine
                    this.set(cloned_payload, options);
                    if(this.id !== oldId) {
                        this.trigger('change:' + this.idAttribute);
                    }
                }
            },
            toSplunkD: function() {
                var payload = {};

                payload = $.extend(true, {}, this.toJSON());

                payload.links = $.extend(true, {}, this.links.toJSON());
                payload.generator = $.extend(true, {}, this.generator.toJSON());
                payload.paging = $.extend(true, {}, this.paging.toJSON());
                payload.entry = [$.extend(true, {}, this.entry.toJSON())];

                payload.entry[0].links = $.extend(true, {}, this.entry.links.toJSON());
                payload.entry[0].acl = $.extend(true, {}, this.entry.acl.toJSON());
                payload.entry[0].content = $.extend(true, {}, this.entry.content.toJSON());

                payload.entry[0].content.performance = $.extend(true, {}, this.entry.content.performance.toJSON());
                payload.entry[0].content.request = $.extend(true, {}, this.entry.content.request.toJSON());
                payload.entry[0].content.runtime = $.extend(true, {}, this.entry.content.runtime.toJSON());
                payload.entry[0].content.custom = $.extend(true, {}, this.entry.content.custom.toJSON());

                //cleanup
                delete payload.id;

                return payload;
            },
            getCustomDataPayload: function() {
                var payload = $.extend(true, {}, this.entry.content.custom.toJSON()),
                    keys = _.keys(payload);
                
                _.each(keys, function(key){
                    var newKey = "custom." + key;
                    payload[newKey] = payload[key];
                    delete payload[key];
                });
                
                return payload;
            },
            canSummarize: function() {
                return splunkUtil.normalizeBoolean(this.entry.content.get('canSummarize'));
            }
        },
        {
            // constants for the dispatch states
            QUEUED: 'QUEUED',
            PARSING: 'PARSING',
            RUNNING: 'RUNNING',
            PAUSED: 'PAUSED',
            FINALIZING: 'FINALIZING',
            FAILED: 'FAILED',
            DONE: 'DONE',
            
            //constants for the polling and intervals
            //seconds
            DEFAULT_AUTO_CANCEL: 30,
            DEFAULT_AUTO_PAUSE: 30,
            
            //milliseconds
            DEFAULT_POLLING_INTERVAL: 1000,
            DEFAULT_METADATA_POLLING_INTERVAL: 3000,
            DEFAULT_KEEP_ALIVE_INTERVAL: 15000,

            Links: BaseModel,
            Generator: BaseModel,
            Paging: BaseModel,
            Entry: BaseModel.extend(
                {
                    initialize: function() {
                        BaseModel.prototype.initialize.apply(this, arguments);
                    }
                },
                {
                    Links: BaseModel,
                    ACL: ACLReadOnlyModel,
                    Content: BaseModel.extend(
                        {
                            initialize: function() {
                                BaseModel.prototype.initialize.apply(this, arguments);
                            }
                        }, 
                        {
                            Performance: BaseModel,
                            Request: BaseModel,
                            Runtime: BaseModel,
                            Custom: BaseModel
                        }
	                )
                }
            )
        });

        return Model;
    }
);

define('collections/services/search/Jobs',
    [
        "models/services/search/Job",
        "collections/SplunkDsBase"
    ],
    function(JobModel, SplunkDsBaseCollection) {
        return SplunkDsBaseCollection.extend({
            url: 'search/jobs',
            model: JobModel,
            initialize: function() {
                SplunkDsBaseCollection.prototype.initialize.apply(this, arguments);
            }
        });
    }
);
define('models/search/Job',
    [
        'jquery',
        'underscore',
        'backbone',
        'models/services/search/Job',
        'util/splunkd_utils',
        'util/time',
        'util/console',
        'splunk.util',
        'helpers/Session',
        'util/Ticker'
    ],
    function($, _, Backbone, SearchJob, splunkd_utils, time_utils, console, splunkUtil, Session, Ticker) {
        
        var JobModel = SearchJob.extend({
            initialize: function(attributes, options) {
                SearchJob.prototype.initialize.apply(this, arguments);
                this.options = options || {};
                
                this.setInstanceDefaults();

                this.entry.content.on('change', function() {
                    var changedAttributes = this.entry.content.changedAttributes(),
                        previousAttributes = this.entry.content.previousAttributes();

                    this.handleJobProgress(changedAttributes, previousAttributes);
                }, this);
                
                this.entry.content.on("change:dispatchState", function() {
                    if (this.entry.content.get('dispatchState') && !this.isPreparing() && !this.prepared) {
                        this.prepared = true;
                        this.trigger("prepared");
                    }
                }, this);
                    
                //poll aggressively to begin with
                this.ticker = new Ticker({interval:100});
                this.ticker.on('tick', function() {
                    this.safeFetch({
                        data: {
                            app: this.entry.acl.get('app'),
                            owner: this.entry.acl.get('owner'),
                            sharing: this.entry.acl.get('sharing')
                        }
                    });
                }, this);

                this.entry.content.on('change:dispatchState', function() {
                    //stop polling when the job is done
                    if (this.entry.content.get('isDone') || this.entry.content.get('isFailed')) {
                        this.stopPolling();
                    }
                }, this);

                this.on("prepared", function() {
                    var attemptCount = 0;
                    var maxAttempts = 30;

                    var _private_progress = function() {
                        var count;
                        attemptCount++;

                        if (this.entry.content.get('isDone') || this.entry.content.get('isFailed')) {
                            this.off('sync', _private_progress, this);
                            return;
                        }

                        if (this.isReportSearch()) {
                            if (this.entry.content.get('isPreviewEnabled')) {
                                count = this.entry.content.get('resultPreviewCount');
                            } else {
                                count = this.entry.content.get('resultCount');
                            }
                        } else {
                            count = this.entry.content.get('eventAvailableCount');
                        }

                        if ((count > 0) || (attemptCount === maxAttempts)) {
                            this.off('sync', _private_progress, this);
                            this.trigger('slowDownPoller');
                        }

                    }.bind(this);

                    this.on('slowDownPoller', function() {
                        if (this._poll) {
                            this.ticker.restart({
                                interval: this.pollingDelay
                            });
                        }
                    }, this);

                    this.on('sync', _private_progress, this);
                }, this);
                
                this.on("error", function(){
                    if (splunkd_utils.messagesContainsOneOfTypes(this.error.get("messages"), [splunkd_utils.NOT_FOUND, splunkd_utils.FATAL])) {
                        this.handleJobDestroy();
                    }
                }, this);
                
                this.entry.content.on("change:isFailed", function(){
                    if (this.entry.content.get("isFailed")) {
                        this.handleJobDestroy();
                    }
                }, this);
                
                this.on('destroy', this.handleJobDestroy, this);
            },
            setInstanceDefaults: function() {
                //poller setup
                this._poll = false;
                this.pollingDelay = this.options.delay || SearchJob.DEFAULT_POLLING_INTERVAL;
                
                this.prepared = (this.entry.content.get('dispatchState') && !this.isPreparing());
                this.processKeepAlive = this.options.processKeepAlive || false;
                this.keepAlivePoller = null;
                this.keepAliveInterval = this.options.keepAliveInterval || SearchJob.DEFAULT_KEEP_ALIVE_INTERVAL;
            },
            clear: function() {
                SearchJob.prototype.clear.apply(this, arguments);
                this.setInstanceDefaults();
                return this;
            },
            handleJobProgress: function(changed, previous) {
                if (this.isNew()) {
                    return false;
                }
                
                var jobIsRealTime = this.entry.content.get('isRealTimeSearch'),
                    jobIsReportSearch = this.entry.content.get('reportSearch'),
                    jobAdHocModeIsVerbose = (this.getAdhocSearchMode() === splunkd_utils.VERBOSE),
                    jobPreviewEnabled = this.entry.content.get('isPreviewEnabled'),
                    jobIsDoneInModel = this.entry.content.get('isDone'),
                    changeIsEmpty = _.isEmpty(changed);
                
                // if the job is not previewable and also not done, ignore the progress 
                if (
                    changeIsEmpty ||
                    (!jobIsDoneInModel && jobIsReportSearch && !jobPreviewEnabled && !jobAdHocModeIsVerbose)
                ) {
                    return false;
                }
                
                // examine changes to the job model and determine if the child objects should be updated
                var scanCountChanged = !_(changed.scanCount).isUndefined() && (changed.scanCount > previous.scanCount),
                    eventCountChanged = !_(changed.eventCount).isUndefined(),
                    resultCountChanged = !_(changed.resultCount).isUndefined(),
                    jobIsDone = !_(changed.isDone).isUndefined() && (changed.isDone === true),
                    jobIsUpdated = scanCountChanged || eventCountChanged || resultCountChanged || jobIsDone || jobIsRealTime;

                if (!jobIsUpdated) {
                    return false;
                }
                
                //we have determined that the job has been updated, so trigger all relevant events
                //we could be smarter about this, for now always notifying each sub-endpoint on every progress event
                this.trigger("jobProgress");
                var links = this.entry.links;
                this.trigger("jobProgress:" + JobModel.RESULTS_PREVIEW, links.get(JobModel.RESULTS_PREVIEW));
                this.trigger("jobProgress:" + JobModel.RESULTS, links.get(JobModel.RESULTS));
                this.trigger("jobProgress:" + JobModel.SUMMARY, links.get(JobModel.SUMMARY));
                this.trigger("jobProgress:" + JobModel.TIMELINE, links.get(JobModel.TIMELINE));
                this.trigger("jobProgress:" + JobModel.EVENTS, links.get(JobModel.EVENTS));
                
                if (jobIsDone && this.processKeepAlive) {
                    this.startKeepAlive();
                }
                
                return true;
            },
            
            registerJobProgressLinksChild: function(linksKey, child, callback, scope) {
                // NOTE: Only register after the job has been created/fetched!
                var id = this.entry.links.get(linksKey);
                if (id) {
                    child.set("id", id);
                    callback.call(scope);
                    this.on("jobProgress", callback, scope);
                    return true;
                }
                console.warn('Search Job Model: You attempted to register a child model with a links key that doesn\'t exist. Have you fetched your job lately? Key:', linksKey);
                return false;
            },
            
            unregisterJobProgressLinksChild: function(callback, scope) {
                this.off("jobProgress", callback, scope);
            },
            
            handleJobDestroy: function() {
                this.stopPolling();
                this.processKeepAlive = false;
                this.stopKeepAlive();
                this.fetchAbort();
                this.control.fetchAbort();
            },
            
            startKeepAlive: function() {
                //remove/add session observers to start/stop the keep alive poller based on UI session
                this.stopPolling();
                Session.on('timeout', this.stopKeepAlive, this);
                Session.on('start', this.startKeepAlive, this);
                
                this.stopKeepAlive();//ensure you never create more than one keep alive poller
                this.keepAlivePoller = new Ticker({interval:this.keepAliveInterval});
                this.keepAlivePoller.on('tick', function() {
                    this.control.save({}, {
                        data: {
                            action: 'touch' 
                        },
                        success: function(model, response, options) {
                            console.log('touched job:', model.id);
                        }.bind(this),
                        error: function(model, response, options) {
                            if (response.hasOwnProperty('status') && (response.status == 0 || response.status == 12029)) {
                                return;
                            }
                            console.log("error touching job (stopping keep alive):", model.id);
                            this.stopKeepAlive();
                        }.bind(this)
                    });
                }, this);
                this.keepAlivePoller.start();
            },
            
            stopKeepAlive: function() {
                if (this.keepAlivePoller) {
                    this.keepAlivePoller.stop();
                    this.keepAlivePoller.off();
                }
            },
            
            startPolling: function(force) {
                if (!this._poll || force) {
                    this._poll = true;
                    
                    //remove/add session observers to start/stop the job poller based on UI session
                    Session.off('timeout', null, this);
                    Session.off('start', null, this);
                    Session.on('timeout', this.stopPolling, this);
                    Session.on('start', function() {
                        this.startPolling(true);//force a new update from the server
                    }, this);
                    
                    if (force || (!this.entry.content.get('isDone') && !this.entry.content.get('isFailed'))) {
                        this.ticker.start(true);
                    }
                }
            },
            
            stopPolling: function() {
                if (this._poll) {
                    this._poll = false;
                    Session.off('timeout', null, this);
                    Session.off('start', null, this);
                    this.ticker.stop();                    
                }
            },
            
            noParamControlUpdate: function(action, options) {
                if(options && options.data) {
                    delete options.data;
                }
                return this.control.save({}, $.extend(true, options, { data: { action: action } }));                
            },

            pause: function(options) {
                return this.noParamControlUpdate("pause", options);
            },

            unpause: function(options) {
                return this.noParamControlUpdate("unpause", options);
            },

            finalize: function(options) {
                return this.noParamControlUpdate("finalize", options);
            },
            
            cancel: function(options) {
                return this.noParamControlUpdate("cancel", options);
            },
            
            touch: function(options) {
                return this.noParamControlUpdate("touch", options);
            },
            
            setTTL: function(ttl, options) {
                if(options && options.data) {
                    delete options.data;
                }
                return this.control.save({}, $.extend(true, options, { data: { action: 'setttl', ttl: ttl} }));
            },
            
            setPriority: function(priority, options) {
                if(options && options.data) {
                    delete options.data;
                }
                return this.control.save({}, $.extend(true, options, { data: { action: 'setpriority', priority: priority} } ));
            },
            
            enablePreview: function(options) {
                return this.noParamControlUpdate("enablepreview", options);
            },
            
            disablePreview: function(options) {
                return this.noParamControlUpdate("disablepreview", options);
            },
            
            setPreview: function(preview, options) {
                var currentPreview = this.entry.content.get('isPreviewEnabled');
                if (preview !== currentPreview) {
                    if (preview) {
                        return this.enablePreview(options);
                    }
                    return this.disablePreview(options);
                }
                if (options && options.success && _.isFunction(options.success)) {
                    options.success(this, {}, options);
                }
                return $.Deferred().resolve();
            },
            
            saveControlUpdate: function(action, options) {
                options = options || {};
                options.data = options.data || {};
                
                var data = {
                    action: action,
                    auto_cancel: options.data.auto_cancel,
                    auto_pause: options.data.auto_pause,
                    email_list: options.data.email_list,
                    email_subject: options.data.email_subject,
                    email_results: options.data.email_results,
                    ttl: options.data.ttl
                }; 
                
                if(options && options.data) {
                    delete options.data;
                }
                
                return this.control.save({}, $.extend(true, options, {data: data}));               
            },
            
            saveJob: function(options) {                
                return this.saveControlUpdate("save", options);
            },
            
            unsaveJob: function(options) {
                return this.saveControlUpdate("unsave", options);
            },
            
            makeWorldReadable: function(options) {
                var owner = this.entry.acl.get("owner"),
                    data = {
                        sharing: splunkd_utils.GLOBAL,
                        owner: this.entry.acl.get("owner"),
                        'perms.read': "*"                
                    };
                
                if (options && options.data) {
                    delete options.data;
                }
                
                return this.acl.save({}, $.extend(true, options, { data: data }));                
            },
            
            undoWorldReadable: function(options) {
                var owner = this.entry.acl.get("owner"),
                    data = {
                        sharing: splunkd_utils.GLOBAL,
                        owner: owner,
                        'perms.read': ""              
                    };
                
                if (options && options.data) {
                    delete options.data;
                }
                
                return this.acl.save({}, $.extend(true, options, { data: data }));                
            },
            
            isSharedAccordingToTTL: function(defaultSaveTTL) {
                var perms = this.entry.acl.permsToObj();
                if ((perms.read.indexOf("*") != -1) && (this.entry.content.get("ttl") === defaultSaveTTL)) {
                    return true;
                }
                return false;
            },
            
            saveIsBackground: function(options) {
                this.entry.content.custom.set("isBackground", "1");
                return this.save({}, options);
            },
            
            isBackground: function() {
                return splunkUtil.normalizeBoolean(this.entry.content.custom.get("isBackground"));
            },
            
            resultCountSafe: function() {
                return (this.entry.content.get('isPreviewEnabled') && !this.entry.content.get('isDone')) ? this.entry.content.get('resultPreviewCount') : this.entry.content.get('resultCount');
            },
            
            eventAvailableCountSafe: function() {
                return (this.entry.content.get('statusBuckets') == 0) ? this.resultCountSafe() : this.entry.content.get('eventAvailableCount');
            },


            // a job can be dispatched without a latest time, in which case return the published time
            latestTimeSafe: function() {
                var entry = this.entry;
                return entry.content.get('latestTime') || entry.get('published');
            },
            
            isQueued: function() {
                return this.checkUppercaseValue('dispatchState', JobModel.QUEUED);
            },
            
            isParsing: function() {
                return this.checkUppercaseValue('dispatchState', JobModel.PARSING);
            },
            
            isFinalizing: function() {
                return this.checkUppercaseValue('dispatchState', JobModel.FINALIZING);
            },
            
            isPreparing: function() {
                return this.isQueued() || this.isParsing();
            },
            
            isRunning: function() {
                return !this.isNew() && !this.entry.content.get('isPaused') && !this.entry.content.get('isDone') && !this.isPreparing() && !this.isFinalizing();
            },
            
            isReportSearch: function() {
                return (this.entry.content.get('reportSearch') ? true : false);
            },

            // returns true if the job was dispatched over all time, returns false for all-time real-time
            isOverAllTime: function() {
                var dispatchEarliestTime = this.getDispatchEarliestTime();
                return ((!dispatchEarliestTime || dispatchEarliestTime === '0') && !this.getDispatchLatestTime());
            },

            isRealtime: function() {
                return this.entry.content.get('isRealTimeSearch');
            },
            
            checkUppercaseValue: function(key, uc_value) {
                var value = this.entry.content.get(key);
                if (!value) {
                    return false;
                }
                return (value.toUpperCase() === uc_value);
            },
            
            getDispatchEarliestTime: function() {
                var earliest = this.entry.content.request.get('earliest_time');
                if (earliest === void(0)) {
                    return this.entry.content.get('searchEarliestTime');
                }
                return earliest;
            },
            
            getDispatchEarliestTimeOrAllTime: function() {
                if (this.entry.content.get('delegate')==='scheduler' && this.entry.content.get('searchLatestTime') !== void(0)) {
                    // windowed rt or all time rt alerts
                    return this.entry.content.get('searchEarliestTime') || '';
                } else {
                    return this.entry.content.request.get('earliest_time') || '';
                }
            },
            
            getDispatchLatestTime: function() {
                var latest = this.entry.content.request.get('latest_time');
                if (latest === void(0)) {
                    return this.entry.content.get('searchLatestTime');
                }
                return latest;
            },
            
            getDispatchLatestTimeOrAllTime: function() {
                var searchLatestTime = this.entry.content.get('searchLatestTime');
                if (this.entry.content.get('delegate')==='scheduler' && searchLatestTime !== void(0)) {
                    return searchLatestTime;
                } else {
                    return this.entry.content.request.get('latest_time') || '';
                }
            },
            
            getStrippedEventSearch: function() {
                var search = this.entry.content.get('eventSearch');
                if (search) {
                    search = splunkUtil.stripLeadingSearchCommand(search);
                }
                return search;
            },
            
            getSearch: function() {
                var search = this.entry.get('name');
                if (!search) {
                    return this.entry.content.request.get('search');
                }
                return search;
            },
            
            getAdhocSearchMode: function() {
                var mode = this.entry.content.request.get('adhoc_search_level'),
                    statusBuckets = this.entry.content.get('statusBuckets'),
                    delegate;
                
                if (!mode) {
                    if ((statusBuckets !== void(0)) && (statusBuckets == 0)) {
                        return splunkd_utils.FAST;
                    }
                    
                    delegate = this.entry.content.get('delegate');
                    if (this.entry.content.get('isSavedSearch') && delegate === 'scheduler') {
                        return splunkd_utils.FAST;
                    }
                }
                
                return mode;
            },
            
            canBePausedOnRemove: function() {
                if (!this.isNew() &&
                        (!this.entry.content.get("isDone") && !this.get("cannotPauseOnRemove")) &&
                        !this.entry.content.get("isPaused") &&
                        !this.isBackground() && 
                        !this.entry.content.get("isSaved")) {
                    return true;
                }
                return false;
            },

            deepOff: function () {
                SearchJob.prototype.deepOff.apply(this, arguments);
                Session.off(null, null, this);
            }
            
        },
        {
            RESULTS_PREVIEW: "results_preview",
            SUMMARY: "summary",
            TIMELINE: "timeline",
            EVENTS: "events",
            RESULTS: "results",
            createMetaDataSearch: function(search, deferred, applicationModel) {
                var job = new JobModel({}, {delay: SearchJob.DEFAULT_METADATA_POLLING_INTERVAL});
                    
                job.save({}, {
                    data: {
                        app: applicationModel.get("app"),
                        owner: applicationModel.get("owner"),
                        search: search,
                        preview: "true",
                        earliest_time: "rt",
                        latest_time: "rt",
                        auto_cancel: SearchJob.DEFAULT_AUTO_CANCEL,
                        max_count: 100000
                    },
                    success: function(model, response) {
                        deferred.resolve();
                    },
                    error: function(model, response) {
                        deferred.resolve();
                    }
                });
                
                return job;
            }
        });
        
        return JobModel;
    }
);

define('collections/search/Jobs',
    [
        "underscore",
        "models/search/Job",
        "collections/services/search/Jobs"
    ],
    function(_, JobModel, JobsCollection) {
        return JobsCollection.extend({
            model: JobModel,
            comparator: function(job) {
                var date = new Date(job.entry.get('published'));
                return date.valueOf() || 0;
            },
            initialize: function() {
                JobsCollection.prototype.initialize.apply(this, arguments);
            },
            fetchNonAutoSummaryJobs: function(options) {
                //this is the port of modules/jobs/JobManager.py's generateResults()
                var omit_autosummary = '(NOT _AUTOSUMMARY AND NOT "|*summarize*action=")',
                    filters = {};
                
                options = options || {};
                options.data = options.data || {};
                options.data.count = options.data.count || 10;
                options.data.offset = options.data.offset || 0;
                options.data.sortKey = options.data.sortKey || 'dispatch_time';
                options.data.sortDir = options.data.sortDir || 'desc';
                
                //Omit _AUTOSUMMARY_ jobs and their summarization jobs
                if (options.data.search) {
                    options.data.search = omit_autosummary + ' AND (' + options.data.search + ')';
                } else {
                    options.data.search = omit_autosummary;
                }
                
                //Omit data preview jobs by adding to the search string.
                filters['NOT isDataPreview'] = '1';
                
                if (options.data.app && (options.data.app !== '*')){
                    filters['eai:acl.app'] = options.data.app;
                }
                delete options.data.app;
                
                if (options.data.owner && (options.data.owner !== '*')){
                    filters['eai:acl.owner'] = options.data.owner;
                }
                delete options.data.owner;
                
                if (options.data.label){
                    filters.label = options.data.label;
                }
                delete options.data.label;
                    
                if (options.data.jobStatus && (options.data.jobStatus !== '*')){
                    if (options.data.jobStatus === 'running') {
                        filters['isDone'] = 0;
                        filters['isPaused'] = 0;
                        filters['isFinalized'] = 0;                 
                    } else if (options.data.jobStatus === 'done') {
                        filters['isDone'] = 1;
                    } else if (options.data.jobStatus === 'paused') {
                        filters['isPaused'] = 1;
                    } else if (options.data.jobStatus === 'finalized') {
                        filters['isFinalized'] = 1;
                    }
                }
                delete options.data.jobStatus;
                
                _.each(filters, function(value, key) {
                    options.data.search = options.data.search + ' ' + key + '="' + value + '"'; 
                });
                
                return this.fetch(options);
            }
        });
    }
);
define('models/shared/DateInput',
    [
        'jquery',
        'underscore',
        'models/Base',
        'jquery.ui.datepicker',
        'strftime'
    ],
    function($, _, BaseModel) {

        var ISO_WITH_TZ_REGEX = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.(\d+)/;

        var DateTime = BaseModel.extend({
            initialize: function() {
                BaseModel.prototype.initialize.apply(this, arguments);
            },
            defaults: function() {
                var now = new Date();
                return this.convertDateToAttrsObject(now);
            },
            validation: {
                year: {
                    required: true,
                    range: [1000, 9999],
                    pattern: 'digits',
                    msg: _("Year must be a 4 digit number.").t()
                },
                month: {
                    required: true,
                    range: [0, 11],
                    pattern: 'digits',
                    msg: _("Month must be a number between 0 and 11.").t()
                },
                day: {
                    required: true,
                    range: [1, 31],
                    pattern: 'digits',
                    msg: _("Day must be a number between 1 and 31.").t()
                },
                hour: [
                    {
                        required: true,
                        range: [0, 24],
                        pattern: 'digits',
                        msg: _("Hour must be a number between 0 and 24.").t()
                    },
                    {
                        fn: 'validateFullTime'
                    }
                ],
                minute: [
                    {
                        required: true,
                        range: [0, 59],
                        pattern: 'digits',
                        msg: _("Minute must be a number between 0 and 59.").t()
                    },
                    {
                        fn: 'validateFullTime'
                    }
                ],
                second: [
                    {
                        required: true,
                        range: [0, 59],
                        pattern: 'digits',
                        msg: _("Second must be a number between 0 and 59.").t()
                    },
                    {
                        fn: 'validateFullTime'
                    }
                ],
                millisecond: [
                    {
                        required: true,
                        range: [0, 999],
                        pattern: 'digits',
                        msg: _("Millisecond must be a number between 0 and 999.").t()
                    },
                    {
                        fn: 'validateFullTime'
                    }
                ]
            },
            validateFullTime: function(value, attr, computedState) {
                if (computedState.hour === 24) {
                    if (((attr === "minute") || (attr === "second") || (attr === "millisecond")) && (value > 0)) {
                        return _("You cannot set the time greater than 24:00:00.000.").t();
                    }
                }
            },
            setHoursMinSecFromStr: function(time, options) {
                //assumes format hours:min:sec.millsec (00:00:00.000)
                var error_msg, error_object,
                    timeArray = time.split(":");
                if (timeArray.length == 3){
                    var secondsArray = timeArray[2].split('.');
                    if (secondsArray.length == 2){
                        return this.set(
                            {
                                hour: parseInt(timeArray[0], 10),
                                minute: parseInt(timeArray[1], 10),
                                second: parseInt(secondsArray[0], 10),
                                millisecond: parseInt(secondsArray[1], 10)
                            },
                            options
                        );
                    }
                    error_msg = _("Could not parse the time stamp given into second and millisecond.").t();                    
                } else {
                    error_msg = _("Could not parse the time stamp given into hour, minute, second, and millisecond.").t();
                }
                error_object = {
                    second: error_msg
                };
                this.trigger("validated", false, this, error_object);
                this.trigger("validated:invalid", this, error_object);
                return false;
            },
            setMonDayYearFromJSDate: function(jsDate, options) {
                return this.set(
                    {
                        year: jsDate.getFullYear(),
                        month: jsDate.getMonth(),
                        day: jsDate.getDate(),
                        hour: 0,
                        minute: 0,
                        second: 0,
                        millisecond: 0
                    }, 
                    options
                );
            },
            setFromJSDate: function(jsDate, options) {
                return this.set(this.convertDateToAttrsObject(jsDate), options);
            },
            jsDate: function(){
                var year = this.get('year'),
                    month = this.get('month'),
                    day = this.get('day'),
                    hour =  this.get('hour'),
                    minute = this.get('minute'),
                    second = this.get('second'),
                    millisecond = this.get('millisecond');
                if (this.isValid(true) && !_.isUndefined(year) && !_.isUndefined(month) &&
                        !_.isUndefined(day) && !_.isUndefined(hour) && !_.isUndefined(minute) &&
                        !_.isUndefined(second) && !_.isUndefined(millisecond)){
                    return new Date(year, month, day, hour, minute, second, millisecond);
                }
                throw "You have an invalid DateTime object for creating a JSDate.";
            },
            strftime: function(formatString) {
                return this.jsDate().strftime(formatString);
            },
            isoWithoutTZ: function(){
                return this.strftime("%Y-%m-%dT%H:%M:%S.%Q");
            },
            time: function(){
                return this.strftime("%H:%M:%S.%Q");
            },
            dateFormat: function(){
                return $.datepicker._defaults['dateFormat'];
            },
            formattedDate: function(){
                return $.datepicker.formatDate(this.dateFormat(), this.jsDate());
            },
            convertDateToAttrsObject: function(jsDate) {
                return ({
                    year: jsDate.getFullYear(),
                    month: jsDate.getMonth(),
                    day: jsDate.getDate(),
                    hour: jsDate.getHours(),
                    minute: jsDate.getMinutes(),
                    second: jsDate.getSeconds(),
                    millisecond: jsDate.getMilliseconds()
                });
            }
        },
        // class-level properties
        {
            createFromIsoString: function(isoString) {
                var pieces = ISO_WITH_TZ_REGEX.exec(isoString);
                if(!pieces || pieces.length !== 8) {
                    throw ('Invalid ISO string: ' + isoString);
                }
                // the above only verifies that the time string had the correct format,
                // next make sure it also represents a valid time
                var dtModel = new DateTime({
                    year: parseInt(pieces[1], 10),
                    month: parseInt(pieces[2], 10) - 1, // convert to zero-indexed
                    day: parseInt(pieces[3], 10),
                    hour: parseInt(pieces[4], 10),
                    minute: parseInt(pieces[5], 10),
                    second: parseInt(pieces[6], 10),
                    millisecond: parseInt(pieces[7], 10)
                });

                if(!dtModel.isValid(true)) {
                    throw ('Invalid time encoded: ' + isoString);
                }
                return dtModel;
            }
        });

        return DateTime;
    }
);

define('models/shared/TimeRange',
    [
        'jquery',
        'underscore',
        'splunk.i18n',
        'models/Base',
        'collections/services/search/TimeParsers',
        'util/splunkd_utils',
        'util/time'
    ],
    function($, _, i18n, BaseModel, TimeParsersCollection, splunkd_utils, time_utils) {
        return BaseModel.extend({
            initialize: function() {
                BaseModel.prototype.initialize.apply(this, arguments);
                this.timeParsers = new TimeParsersCollection();
                this.associated.timeParsers = this.timeParsers;
                this.units = time_utils.TIME_UNITS;
            },
            clear: function(options) {
                delete this.timeParsersXHR;
                return BaseModel.prototype.clear.apply(this, arguments);
            },
            defaults: {
                enableRealTime: true
            },
            validation: {
                earliest: [
                    {},
                    {
                        fn: 'validateTime'
                    }
                ],
                latest: [
                    {},
                    {
                        fn: 'validateTime'
                    }
                ]
            },
            validateTime: function(value, attr, computedState) {
                var earliest_time_attr = (computedState.earliest || ""),
                    latest_time_attr = (computedState.latest || ""),
                    enableRealTime = this.get('enableRealTime'),
                    is_earliest_rt = time_utils.isRealtime(earliest_time_attr),
                    is_latest_rt = time_utils.isRealtime(latest_time_attr),
                    earliest_time = time_utils.stripRTSafe(earliest_time_attr, false),
                    latest_time = time_utils.stripRTSafe(latest_time_attr, true);
                
                if (earliest_time && latest_time && (earliest_time === latest_time) && (attr === "latest")) {
                    return _("You cannot have equivalent times.").t();
                } else if (!enableRealTime) {
                    if (((is_earliest_rt && is_latest_rt) && (attr === "latest")) ||
                            ((is_earliest_rt && !is_latest_rt && (attr === "earliest")) ||
                            (is_latest_rt && !is_earliest_rt && (attr === "latest")))) {
                        return _("rt time values are not allowed").t();
                    }
                } else {
                    if (is_earliest_rt && !is_latest_rt && (attr === "latest")) {
                        return _("You must set a rt value for latest time if you set a rt value for earliest time.").t();
                    } else if (!is_earliest_rt && is_latest_rt && (attr === "earliest")) {
                        return _("You must set a rt value for earliest time if you set a rt value for latest time.").t();
                    }                    
                }
            },
            sync: function(method, model, options) {
                var deferredResponse = $.Deferred(),
                    rootModel = model,
                    rootOptions = options,
                    timeParsers,
                    timeParsersISO,
                    times = [],
                    data = {},
                    error_msg,
                    latest,
                    earliest;
                
                model.trigger('request', model, deferredResponse, options);

                switch (method) {
                    case 'create':
                        earliest = time_utils.stripRTSafe(((model.get('earliest') || '') + ''), false);
                        if (earliest) {
                            times.push(earliest);
                        }   
                        latest = time_utils.stripRTSafe(((model.get('latest') || '') + ''), true);
                        if (latest) {
                            times.push(latest);
                        }
                        if (!times.length) {
                            options.success(data);
                            deferredResponse.resolve.apply(deferredResponse);
                            return deferredResponse.promise();
                        }

                        //get epoch
                        this.timeParsers.reset([]);
                        this.timeParsersXHR = this.timeParsers.fetch({
                            data: {
                                time: times,
                                output_time_format: '%s.%Q|%Y-%m-%dT%H:%M:%S.%Q%:z'
                            },  
                            success: function() {
                                var timeParserEarliest = this.timeParsers.get(earliest),
                                    timeParserEarliestParts = timeParserEarliest ? (timeParserEarliest.get('value') || '').split('|') : [],
                                    timeParserEarliestEpoch = timeParserEarliestParts[0],
                                    timeParserEarliestISO = timeParserEarliestParts[1],
                                    timeParserLatest = this.timeParsers.get(latest),
                                    timeParserLatestParts = timeParserLatest ? (timeParserLatest.get('value') || '').split('|') : [],
                                    timeParserLatestEpoch = timeParserLatestParts[0],
                                    timeParserLatestISO = timeParserLatestParts[1];
                                if (timeParserEarliest) {
                                    data.earliest_epoch = parseFloat(timeParserEarliestEpoch);
                                }
                                if (timeParserLatest) {
                                    data.latest_epoch = parseFloat(timeParserLatestEpoch);
                                }
                                if (timeParserEarliestISO) {
                                    data.earliest_iso = timeParserEarliestISO;
                                    data.earliest_date = time_utils.isoToDateObject(timeParserEarliestISO);
                                }
                                if (timeParserLatestISO) {
                                    data.latest_iso = timeParserLatestISO;
                                    data.latest_date = time_utils.isoToDateObject(timeParserLatestISO);
                                }
                                if (timeParserEarliest && timeParserLatest) {
                                    var earliestRounded = (Math.round(data.earliest_epoch * 1000) / 1000),
                                        latestRounded = (Math.round(data.latest_epoch * 1000) / 1000);
                                    
                                    if (earliestRounded === latestRounded) {
                                        error_msg = splunkd_utils.createSplunkDMessage(
                                            splunkd_utils.ERROR,
                                            _("You cannot have equivalent times.").t()
                                        );
                                    }
                                    if (earliestRounded > latestRounded) {
                                        error_msg = splunkd_utils.createSplunkDMessage(
                                            splunkd_utils.ERROR,
                                            _("Earliest time cannot be greater than latest time.").t()
                                        );
                                    }
                                    if (error_msg) {
                                        rootOptions.error(error_msg);
                                        return;
                                    }
                                }
                                rootOptions.success(data);
                            }.bind(this),
                            error: function() {
                                var message = splunkd_utils.createSplunkDMessage(
                                    splunkd_utils.ERROR,
                                    _("You have an invalid time in your range.").t()
                                );
                                rootOptions.error(message);                                
                            }
                        });
                        
                        this.timeParsersXHR.done(function(){
                            deferredResponse.resolve.apply(deferredResponse, arguments);
                        });
                        
                        this.timeParsersXHR.fail(function(){
                            deferredResponse.reject.apply(deferredResponse, arguments);
                        });
                        
                        return deferredResponse.promise();
                    default:
                        throw 'Operation not supported';
                }
            },
            
            /**
             * Convenience pass through methods to time_utils
             */
            getTimeParse: function(attr) {
                return time_utils.parseTimeString(this.get(attr));
            },
            isRealtime: function(attr) {
                return time_utils.isRealtime(this.get(attr));
            },
            isAbsolute: function(attr) {
                return time_utils.isAbsolute(this.get(attr));
            },
            isEpoch: function(attr) {
                return time_utils.isEpoch(this.get(attr));
            },
            isWholeDay: function(attr) {
                return time_utils.timeAndJsDateIsWholeDay(this.get(attr), this.get(attr + '_date'));
            },
            latestIsNow: function() {
                return time_utils.isNow(this.get('latest'));
            },
            hasNoEarliest: function() {
                return time_utils.isEmpty(this.get('earliest'));
            },

            /**
            * presets: <collections.services.data.ui.TimesV2>
            **/
            generateLabel: function(presets) {               
                return time_utils.generateLabel(presets, this.get('earliest'), this.get("earliest_date"), this.get('latest'), this.get("latest_date"));
            },
            fetchAbort: function() {
                BaseModel.prototype.fetchAbort();
                if (this.timeParsersXHR && this.timeParsersXHR.state && this.timeParsersXHR.state()==='pending') {
                    this.timeParsersXHR.abort();
                }
            }
        });
    }
);

define('models/services/data/UserPref',
    [
        'models/SplunkDBase'
    ],
    function(SplunkDBaseModel) {
        return SplunkDBaseModel.extend({
            url: "data/user-prefs",
            id: "data/user-prefs/general",
            initialize: function() {
                SplunkDBaseModel.prototype.initialize.apply(this, arguments);
            }
        });
    }
);
define('models/services/configs/Web',
    [
        'models/SplunkDBase'
    ],
    function(SplunkDBaseModel) {
        return SplunkDBaseModel.extend({
            url: "configs/conf-web",
            urlRoot: "configs/conf-web",
            initialize: function() {
                SplunkDBaseModel.prototype.initialize.apply(this, arguments);
            }
        });
    }
);
define('models/services/search/jobs/Summary',
    [
        'jquery',
        'underscore',
        'backbone',
        'models/Base',
        'collections/Base',
        'util/splunkd_utils'
    ],
    function(
        $,
        _,
        Backbone,
        BaseModel,
        BaseCollection,
        splunkdutils
    ) 
    {
        var Field = Backbone.Model.extend(
            {
                idAttribute: 'name',
                isNumeric: function() {
                    return this.get('numeric_count') > this.get('count') / 2;
                },
                replace: function() {
                    return BaseModel.prototype.replace.apply(this, arguments);
                },
                deepOff: function() {
                    this.off();
                }
            }
        );
        var Fields = BaseCollection.extend({
            model: Field
        });
        
        var Model = BaseModel.extend({
            url: '',
            initialize: function(data, options) {
                BaseModel.prototype.initialize.apply(this, arguments);
                this.initializeAssociated();
                if (options && options.splunkDPayload) {
                    this.setFromSplunkD(options.splunkDPayload, {silent: true});
                }
                this.memoizedFrequency = {};
                this.memoizedFields = {};
                this.memoizedFilterByMinFrequency = {};

                this.getFields().on('reset', function() {
                    this.memoizedFrequency = {};
                    this.memoizedFields = {};
                    this.memoizedFilterByMinFrequency = {};
                }, this);
            },
            initializeAssociated: function() {
                // do a dynamic lookup of the current constructor so that this method is inheritance-friendly
                var RootClass = this.constructor;
                this.associated = this.associated || {};
                //instance level models
                this.fields = this.fields || new RootClass.Fields();
                this.associated.fields = this.fields;
            },
            sync: function(method, model, options) {
                if (method!=='read') {
                    throw new Error('invalid method: ' + method);
                }
                options = options || {};
                var appOwner = {},
                    defaults = {data: {output_mode: 'json'}},
                    url = _.isFunction(model.url) ? model.url() : model.url || model.id;
                    
                if(options.data){
                    appOwner = $.extend(appOwner, { //JQuery purges undefined
                        app: options.data.app || undefined,
                        owner: options.data.owner || undefined,
                        sharing: options.data.sharing || undefined
                    });
                }
                defaults.url = splunkdutils.fullpath(url, appOwner);
                $.extend(true, defaults, options);
                delete defaults.data.app;
                delete defaults.data.owner;
                delete defaults.data.sharing;
                return Backbone.sync.call(this, method, model, defaults);
            },
            _fields: function(data) {
                var fields = [];
                _.each(data, function(fieldValue, fieldName) {
                    var field = {name: fieldName};
                    _.each(fieldValue, function(fieldPropertyValue, fieldPropertyName){
                        field[fieldPropertyName] = fieldPropertyValue;
                    });
                    fields.push(field);
                }, this);
                return fields;
            },
            parse: function(response, options) {
                this.initializeAssociated();
                if (!response) {
                    return {};
                }

                response = $.extend(true, {}, response);
                return this.parseAssociated(response, options);
            },
            setFromSplunkD: function(payload, options) {
                var fields;
                payload = $.extend(true, {}, payload);
                this.attributes = {};
                if (payload) {
                    this.parseAssociated(payload, options);
                }
            },
            parseAssociated: function(response, options) {
                var fields = this._fields(this.getFieldsFromResponse(response));
                this.deleteFieldsFromResponse(response);
                this.set(response, options);
                var resetOptions = $.extend(true, {parse:true}, options);
                this.getFields().reset(fields, resetOptions);

                return response;
            },

            filterByMinFrequency: function(frequency) {
                if (this.memoizedFilterByMinFrequency.hasOwnProperty(frequency)) {
                    return this.memoizedFilterByMinFrequency[frequency];
                }
                
                var eventCount = this.getEventCount(),
                    filteredByMinFreq = this.getFields().filter(function(field) {
                        return (field.get('count')/eventCount) >= frequency;
                    });
                this.memoizedFilterByMinFrequency[frequency] = filteredByMinFreq;
                return filteredByMinFreq;
            },
            frequency: function(fieldName) {
                if (this.memoizedFrequency[fieldName] !== void(0)) {
                    return this.memoizedFrequency[fieldName];
                }
                
                var field = this.findByFieldName(fieldName),
                    freq;
                
                if (!field) {
                    this.memoizedFrequency[fieldName] = 0;
                    return 0;
                }
                
                freq = field.get('count')/this.getEventCount();
                this.memoizedFrequency[fieldName] = freq;
                return freq;
            },
            findByFieldName: function(fieldName) {
                if (this.memoizedFields.hasOwnProperty(fieldName)) {
                    return this.memoizedFields[fieldName];
                }
                
                var field = this.getFields().get(fieldName);

                this.memoizedFields[fieldName] = field;
                return field;
            },
            distribution: function(fieldName) {
                var fieldHistogram,
                    field = this.findByFieldName(fieldName),
                    rootHistogram = this.get('histogram');
                if (!field) {
                    return [];
                }
                fieldHistogram = field.get('histogram');
                if (!rootHistogram || !fieldHistogram) {
                    return [];
                }

                var numBuckets = Math.min(rootHistogram.length, fieldHistogram.length);
                
                // flatten histogram and summaryHistogram data into arrays of counts and totals
                var counts = [];
                var totals = [];
                var i;
                for (i = 0; i < numBuckets; i++) {
                    counts.push(fieldHistogram[i].count);
                    totals.push(rootHistogram[i].count);
                }
    
                // merge buckets so there are no more than maxBuckets
                var maxBuckets = 30;
                var mergedCounts;
                var mergedTotals;
                while (numBuckets > maxBuckets) {
                    mergedCounts = [];
                    mergedTotals = [];
                    for (i = numBuckets - 1; i >= 0; i -= 2) {
                        if (i > 0) {
                            mergedCounts.unshift(counts[i] + counts[i - 1]);
                            mergedTotals.unshift(totals[i] + totals[i - 1]);
                        } else {
                            mergedCounts.unshift(counts[i]);
                            mergedTotals.unshift(totals[i]);
                        }
                    }
                    counts = mergedCounts;
                    totals = mergedTotals;
                    numBuckets = counts.length;
                }
    
                // compute percentages from counts and totals
                var percentages = [];
                for (i = 0; i < numBuckets; i++) {
                    percentages.push((totals[i] > 0) ? (Math.min(100, ((counts[i] / totals[i]) * 100))) : 0);
                }
                
                return percentages;
            },
            /**
             * Accessor function to get the event count. Subclasses can override
             * @return {number} number of fields
             */
            getEventCount: function() {
                return this.get('event_count');
            },
            /**
             * Accessor function to get the collection of fields. Subclasses can override
             * @return {Collection} collection of fields
             */
            getFields: function() {
                return this.fields;
            },
            /**
             * Accessor function to get the fields from a response object. Subclasses can override
             * @param response
             * @return {Array} array of the fields in the response
             */
            getFieldsFromResponse: function(response) {
                return response.fields;
            },
            deleteFieldsFromResponse: function(response) {
                delete response.fields;
            }

        },
        {
            Fields: Fields,
            Field: Field
        });
        
        return Model;
    }
);

/**
 * A reusable model encapsulating the fetch data for "results-like" endpoints.
 *
 * Adds special handling of the "sortKey" and "sortDirection" attributes, which are mapped to a trailing "| sort" in the
 * post-process search, and the "filter" attribute, which is mapped from a dictionary of string pairs
 * to keyword filters in the post-process search string.
 */

define('models/shared/fetchdata/ResultsFetchData',[
            'underscore',
            'models/Base'
        ],
        function(
            _,
            Base
        ) {

    return Base.extend({

        defaults: {
            filter: {}
        },

        toJSON: function(options) {
            var json = Base.prototype.toJSON.apply(this, arguments),
                sortKey = json.sortKey,
                sortDirection = json.sortDirection,
                search = [];
            if(_(json.filter).size() > 0) {
                _(json.filter).each(function(match, key) {
                    var matches = _.isArray(match)? match : match.split(' ');
                    if(matches.length > 1) {
                        search.push('(' +
                            _.chain(matches).map(function(match) {
                                return key + '=*' + match + '*';
                            }, this)
                            .join(' AND ')
                            .value() + ')'
                        );
                    } else {
                        search.push( '(' + key + '=*' + matches[0] + '*' + ')');
                    }
                });
                search = ['search ' + search.join(' OR ')];
            }
            delete json.filter;

            if(sortKey) {
                search.push('| sort 0 ' + (sortDirection === 'desc' ? '-' : '') + '"' + sortKey + '"');
            }
            delete json.sortKey;
            delete json.sortDirection;

            if(search.length > 0) {
                // Append to the search string, if it exists
                json.search = (json.search != undefined ? json.search : "") + search.join(' ');
            }
            return json;
        }

    });

});

define('models/services/search/jobs/Result',
    [
        'jquery',
        'underscore',
        'backbone',
        'models/Base',
        'models/shared/fetchdata/ResultsFetchData',
        'collections/Base',
        'util/splunkd_utils',
        'util/time',
        'splunk.i18n'
    ],
    function(
        $,
        _,
        Backbone,
        BaseModel,
        ResultsFetchData,
        BaseCollection,
        splunkd_utils,
        time_utils, 
        i18n
    ) 
    {
        var Result = Backbone.Model.extend({
            initialize: function(attributes, options) {
                //cache buster
                this.on('change', function() {
                    this._keys = void(0); 
                    this._strip = void(0);
                }, this);
            },
            clear: function(options) {
                delete this._keys; 
                delete this._strip;
                Backbone.Model.prototype.clear.apply(this, arguments);
            },
            idAttribute: '1ee63861-c188-11e2-8743-0017f209b4d8',
            systemFields: [
                 'host', 
                 'source', 
                 'sourcetype',
                 'punct'
            ],
            timeFields: [
                 '_time',
                 'date_zone',
                 'date_year',
                 'date_month',
                 'date_mday',
                 'date_wday',
                 'date_hour',
                 'date_minute',
                 'date_second',
                 'timeendpos',
                 'timestartpos'
            ],
            //cache keys
            keys: function() {
                if(!this._keys) {
                    this._keys = _.keys(this.toJSON());
                }
                return this._keys; 
            },
            strip: function() {
                if(!this._strip){
                    this._strip = _.intersection(this.keys(),  _.filter(this.keys(), function(key) {
                        return !(key.indexOf('_')===0 || key.indexOf('tag::')===0 || key.indexOf('_raw')===0);
                    }));
                }
                return this._strip;
            },
            system: function() {
                 return _.intersection(this.strip(), this.systemFields);
            },
            notSystemOrTime: function() {
                var fields = this.strip();
                return _.intersection(fields, _.difference(fields, _.union(this.time(), this.system())));
            },
            time: function() {
                return _.intersection(this.keys(), this.timeFields);
            },
            isTruncated: function() {
                return this.has('_fulllinecount');
            },
            getFieldsLength: function(fields) {
                return _(fields).reduce(function(m, f){ 
                    return m + this.get(f).length; 
                }, 0, this);
            },
            rawToHTML: function(segment) {
                var raw    = this.get('_raw');
                if (!raw) {return '';}
                var tokens = raw.tokens,
                    stree  = raw.segment_tree,
                    types  = raw.types;
        
                function _rawToHtml (stree) {
                    var html = [], i = 0;
                    for (i=0; i<stree.length; i++) {
                        var leaf = stree[i];
                        if(typeof leaf === 'object' ) {
                            html.push('<span class="t'+((leaf.highlight)?' a':'')+'">', _rawToHtml(leaf.array), '</span>');
                        } else {
                            html.push(_.escape(tokens[leaf] || ''));
                        }
                    }
                    return html.join('');
                }
                return _rawToHtml(stree);
            },
            getRawText: function() {
                var raw = this.get('_raw');
                if (!raw) {return '';}
                return _.isArray(raw) ? raw[0]: raw.value;
            },
            getRawSegmentation: function(){
                var raw = this.get('_raw');
                return _.isArray(raw) ? _.escape(raw[0]): this.rawToHTML();
            },
            formattedTime: function() {
                var time = this.get('_time');
                if (!time) {
                    return '';
                }
                return i18n.format_datetime_microseconds(
                    time_utils.jsDateToSplunkDateTimeWithMicroseconds(time_utils.isoToDateObject(time[0]))
                );    
            },
            replace: function() {
                return BaseModel.prototype.replace.apply(this, arguments);
            },
            deepOff: function() {
                this.off();
            },
            sync: function(method, model, options) {
                if (method!=='read') {
                    throw new Error('invalid method: ' + method);
                }
                options = options || {};
                var offset, 
                    search = options.data.search,
                    appOwner = {},
                    defaults = {
                        data: {
                            output_mode: 'json'
                        }
                    },
                    url = model.id;
                
                if(options.data){
                    appOwner = $.extend(appOwner, {
                        app: options.data.app || undefined,
                        owner: options.data.owner || undefined,
                        sharing: options.data.sharing || undefined
                    });
                }
                
                if(options.data.isRt) {
                    defaults.data.search = ['search _serial=', this.get('_serial')[0], ' AND ', 'splunk_server=', this.get('splunk_server')[0], ' | head 1'].join('');
                } else {
                    defaults.data.offset = this.collection.indexOf(this) + options.data.eventsOffset;
                }

                defaults.url = splunkd_utils.fullpath(url, appOwner);
                defaults.data.count = 1;
                defaults.truncation_mode = 'abstract';

                $.extend(true, defaults , options);

                delete defaults.data.isRt;
                delete defaults.data.app;
                delete defaults.data.owner;
                delete defaults.data.sharing;
                delete defaults.data.eventsOffset;

                return Backbone.sync.call(this, method, model, defaults);
            },
            parse: function(response, options) {
                
                _(response.results).each(function(result, idx) {
                    _.each(result, function(v, k) {
                        result[k] = (typeof v === 'string') ? [v]: v;
                    },this);
                },this);

                return response.results[0];
            }
        });
        
        var Model = BaseModel.extend({
            url: '',
            initialize: function(data, options) {
                options = options || {};
                options.fetchData = options.fetchData || new ResultsFetchData();
                BaseModel.prototype.initialize.call(this, data, options);
                this.initializeAssociated();
                if (options && options.splunkDPayload) {
                    this.setFromSplunkD(options.splunkDPayload, {silent: true});
                }
            },
            clear: function() {
                delete this.responseText;
                return BaseModel.prototype.clear.apply(this, arguments);
            },
            initializeAssociated: function() {
                // do a dynamic lookup of the current constructor so that this method is inheritance-friendly
                var RootClass = this.constructor;
                this.associated = this.associated || {};
                
                //instance level models
                this.results = this.results || new RootClass.Results();
                this.associated.results = this.results;
                this.messages = this.messages || new RootClass.Messages();
                this.associated.messages = this.messages;
                this.fields = this.fields || new RootClass.Fields();
                this.associated.fields = this.fields;
            },
            sync: function(method, model, options) {
                if (method!=='read') {
                    throw new Error('invalid method: ' + method);
                }
                options = options || {};
                var appOwner = {},
                    defaults = {
                        data: {output_mode: 'json'},
                        dataType: 'text'
                    },
                    url = _.isFunction(model.url) ? model.url() : model.url || model.id;
                    
                if(options.data){
                    appOwner = $.extend(appOwner, { //JQuery purges undefined
                        app: options.data.app || undefined,
                        owner: options.data.owner || undefined,
                        sharing: options.data.sharing || undefined
                    });
                }
                
                defaults.url = splunkd_utils.fullpath(url, appOwner);
                $.extend(true, defaults, options);
                
                delete defaults.data.app;
                delete defaults.data.owner;
                delete defaults.data.sharing;
                
                return Backbone.sync.call(this, method, model, defaults);
            },
            setFromSplunkD: function(payload, options) {
                options = options || {};
                
                /*
                 * :: Slightly confusing ::
                 * => consumers of this model do no necessarily load data 
                 * via convential means (fetch followed by the parse code path 
                 * below).  This being said, by default we will store a text
                 * response of the payload for compatibility with shared components
                 * that try utilize lazy loading for performance gains.
                 *
                 */
                if(!options.skipStoringResponseText) {
                    this.responseText = JSON.stringify(payload);    
                }

                this.attributes = {};
                if (payload) {
                    if (payload.messages) {
                        this.messages.reset(payload.messages, options);
                        delete payload.messages;
                    }
                    if (payload.fields) {
                        this.fields.reset(payload.fields, options);
                        delete payload.fields;
                    }
                    this.set(payload, options);
                    
                    if (payload.results) {
                        this.normalizeResults(payload.results);
                        this.results.reset(payload.results, options);
                        delete payload.results;
                    }
                }
            },
            parse: function(response, options) {
                this.initializeAssociated();

                //store string representation of the response
                this.responseText = response; 
                
                response = JSON.parse(response);
                
                /* 
                 * Set a lightweight collection of empty objects.  The collections 
                 * length will be that of the actualy payload.  Useful for lazy loading 
                 * the results via parsing the string response stored on the instance. 
                 */
                if (options.parseLite) {
                    this.results.reset(_(response.results).map(function() { return {}; }));
                    return {};
                }
                
                this.normalizeResults(response.results);

                this.messages.reset(response.messages);
                delete response.messages;
                
                this.fields.reset(response.fields);
                delete response.fields;
                
                var results = response.results;
                delete response.results;
                
                this.set(response);

                this.results.reset(results);
                return {};
            },
            /*
             * The enum of possible types returned for a field value is:
             * => string, array, object ::: where only _raw can be of type object (segmentation)
             * 
             * Normalize the results such that if the field is not _raw, the value
             * will be of type array. 
             */
            normalizeResults: function(results) {
                _(results).each(function(result, idx) {
                    _(result).each(function(v, k) {
                        result[k] = (typeof v === 'string') ? [v]: v;
                    },this);
                },this);
            },
            endOffset: function() {
                return (this.get('init_offset') || 0) + this.results.length;
            },
            lineNumber: function(offset, isRealTime) {
                return isRealTime ? this.endOffset() - offset : (this.get('init_offset') || 0) + offset + 1;
            },
            offset: function(index) {
                return (this.get('init_offset') || 0) + index;
            },
            getTags: function(field, value) {
                var tags = this.get('tags'),
                    matched = [];
      
                if (tags) {
                    matched = tags[field];
                    if (matched) {
                        matched = matched[value] || [];
                    }
                }
                return matched || [];
            },
            setTagsSynthetically: function(field, value, tags) {
                if (!this.get('tags')) {
                   this.set('tags', {});
                }
                if (!this.get('tags')[field]) {
                    this.get('tags')[field] = {}; 
                }
                if (!this.get('tags')[field][value]) {
                    this.get('tags')[field][value] = [];
                }
                this.get('tags')[field][value] = tags;
                this.trigger('tags-updated');
            }
        },
        {
            Results: BaseCollection.extend(
                {
                    model: Result,
                    get: function(obj) {
                      if (obj == null) return void 0;
                      this._idAttr || (this._idAttr = this.model.prototype.idAttribute);
                      return this._byId[obj[this._idAttr]];
                    }
                },
                {
                    Result: Result
                }
            ),
            Messages: BaseCollection.extend({model: BaseModel}),
            Fields: BaseCollection.extend({model: BaseModel})
        });
    
        return Model;
    }
);

define('models/services/saved/FVTags',['jquery', 'underscore', 'models/SplunkDBase'], function($, _, BaseModel) {
    return BaseModel.extend({
        url: 'saved/fvtags',
        initialize: function() {
            BaseModel.prototype.initialize.apply(this, arguments);
        },
        resetTags: function(tags) {

            //unset tag prefixed keys 
            _(this.entry.content.toJSON()).each(function(v, k) {
                if(k.match(/^tag.+/g)){
                    this.entry.content.unset(k);
                }
            }, this);
            //unset the tags array
            this.entry.content.unset('tags');
            
            if (tags) {
                var attrs = {};
                _(tags).each(function(tag) {
                    attrs['tag.' + tag] = tag;
                }, this);
                this.entry.content.set(attrs);
            }

        },
        setId: function(app, owner, fieldName, fieldValue){
            this.set('id', '/servicesNS/' + encodeURIComponent(owner) + '/' + encodeURIComponent(app) + '/saved/fvtags/' + encodeURIComponent(fieldName) + '%3D' + encodeURIComponent(fieldValue));
        }
    },
    // class-level properties
    {
        tagStringtoArray: function(tag) {
            return tag ? $.trim(tag.replace(/,/g,' ')).split(/\s+/): [];
        },
        tagArraytoString: function(tags) {
            return tags.join(', ');
        }
    });
});

define('helpers/user_agent',['underscore'], function(_) {

    /*
     * Based on following browsers supported by Splunk and sample user agent strings:
     *
     * Chrome 26 - "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/537.31 (KHTML, like Gecko) Chrome/26.0.1410.65 Safari/537.31"
     * Firefox 21 - "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.6; rv:21.0) Gecko/20100101 Firefox/21.0"
     * Safari 6 - "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_8) AppleWebKit/536.25 (KHTML, like Gecko) Version/6.0 Safari/536.25"
     * IE 10 - "Mozilla/5.0 (compatible; MSIE 10.0; Windows NT 6.2; Trident/6.0)"
     * IE 9 - "Mozilla/5.0 (compatible; MSIE 9.0; Windows NT 6.1; Trident/5.0)"
     * IE 8 - "Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.0; Trident/4.0)"
     * IE 7 - "Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 5.1)"
     *
     * (not officially supported)
     *
     * Safari (iOS iPhone) - "Mozilla/5.0 (iPhone; CPU iPhone OS 6_0 like Mac OS X) AppleWebKit/536.26 (KHTML, like Gecko) Version/6.0 Mobile/10A5376e Safari/8536.25"
     * Safari (iOS iPad) - "Mozilla/5.0 (iPad; CPU OS 6_0 like Mac OS X) AppleWebKit/536.26 (KHTML, like Gecko) Version/6.0 Mobile/10A5376e Safari/8536.25"
     */

    var TESTS = {
        Chrome: /chrome/i,
        Firefox: /firefox/i,
        Safari: /safari/i,
        //User-agent string has been changed for IE11
        //Here is the sample user-agent string: "Mozilla/5.0 (Windows NT 6.1; Trident/7.0; rv:11.0) like Gecko"
        IE: /(?=.*msie ([\d.]+))|(?=.*trident)(?=.*rv\:([\d.]+))/i,
        IE11: /(?=.*trident)(?=.*rv\:11)/i,
        IE10: /msie 10\.0/i,
        IE9: /msie 9\.0/i,
        IE8: /msie 8\.0/i,
        IE7: /msie 7\.0/i,
        SafariiPhone: /iPhone/,
        SafariiPad: /iPad/
    };

    var IE_URL_LIMIT = 2048;

    var helper = {

        // put this here so it can be mocked in unit tests
        agentString: window.navigator.userAgent,

        // add methods for each of the test regexes
        isChrome: function() { return TESTS.Chrome.test(helper.agentString); },
        isFirefox: function() { return TESTS.Firefox.test(helper.agentString); },
        isIE: function() { return TESTS.IE.test(helper.agentString); },
        isIE11: function() { return TESTS.IE11.test(helper.agentString); },
        isIE10: function() { return TESTS.IE10.test(helper.agentString); },
        isIE9: function() { return TESTS.IE9.test(helper.agentString); },
        isIE8: function() { return TESTS.IE8.test(helper.agentString); },
        isIE7: function() { return TESTS.IE7.test(helper.agentString); },
        // Safari is a little more complicated
        isSafari: function() { return !helper.isChrome() && !helper.isSafariiPhone() && !helper.isSafariiPad() && TESTS.Safari.test(helper.agentString); },
        isSafariiPhone: function() { return TESTS.SafariiPhone.test(helper.agentString); },
        isSafariiPad: function() { return TESTS.SafariiPad.test(helper.agentString); },
        isiOS: function() { return helper.isSafariiPhone() || helper.isSafariiPad(); },

        isIELessThan: function(testVersion) {
            return helper.isIE() && parseFloat((TESTS.IE.exec(helper.agentString).sort(function(a, b) {return b - a;}))[0]) < testVersion;
        },

        isInIE7DocumentMode: function() {
            return document.documentMode == 7 ? true : false;
        },

        hasUrlLimit: function() {
            return helper.isIE() ? true : false;
        },
        getUrlLimit: function() {
            return helper.hasUrlLimit() ? IE_URL_LIMIT : Infinity;
        }

    };

    // memoize all of the things
    _(_.functions(helper)).chain().each(function(fnName) { helper[fnName] = _(helper[fnName]).memoize(); });

    return helper;

});

define('util/router_utils',
    [
        'jquery',
        'underscore',
        'backbone',
        'splunk.util',
        'helpers/user_agent'
    ],
    function($, _, Backbone, splunkutil, userAgent) {
        var exports = {},
            routeStripper = /^[#\/]|\s+$/g,
            // create an in-memory dictionary to store URL history when the URL itself would be too long
            inMemoryHistory = {};

        // visible for testing only
        exports.AGENT_HAS_URL_LIMIT = userAgent.hasUrlLimit();
        exports.URL_MAX_LENGTH = userAgent.getUrlLimit();

        var fragmentIsLegal = function(fragment) {
            if(!exports.AGENT_HAS_URL_LIMIT) {
                return true;
            }
            var loc = window.location,
                urlMinusFragment = loc.href.split('#')[0];

            return (urlMinusFragment.length + fragment.length) < exports.URL_MAX_LENGTH;
        };

        var historyIdCounter = 0;
        var nextHistoryId = function() {
            return '_suid_' + (++historyIdCounter);
        };

        var historyIdRegex = /^#?_suid_\d+$/;
        var fragmentIsHistoryId = function(fragment) {
            return historyIdRegex.test(fragment);
        };

        var storeFullFragment = function(fragment) {
            var historyId = nextHistoryId();
            inMemoryHistory[historyId] = fragment;
            return historyId;
        };

        //Introduced in 0.9.9, see https://github.com/documentcloud/backbone/issues/2440
        Backbone.history.getFragment = function(fragment, forcePushState) {
            var trailingSlash = /\/$/;
            if (fragment == null) {
                if (this._hasPushState || !this._wantsHashChange || forcePushState) {
                    fragment = this.location.pathname;
                    var search = window.location.search;
                    if (search) {
                        fragment += search;
                    }
                    var root = this.root.replace(trailingSlash, '');
                    if (!fragment.indexOf(root)) {
                        fragment = fragment.substr(root.length);
                    }
                } else {
                    fragment = this.getHash();
                }
            }
            if(fragmentIsHistoryId(fragment)) {
                fragment = inMemoryHistory[fragment] || '';
            }
            return exports.strip_route(fragment);
        };

        //Introduced in 1.1.0, Backbone is stripping query string and hash before comparing the new route to the old one,
        //meaning that changes to those data structures are ignored
        Backbone.history.navigate = function(fragment, options) {
          var History = Backbone.History;
          // start Backbone code...
          /*jsl:ignore*/
          if (!History.started) return false;
          if (!options || options === true) options = {trigger: !!options};

          var url = this.root + (fragment = this.getFragment(fragment || ''));

          // Here is where we patched...
          // - fragment = fragment.replace(pathStripper, '');

          if (this.fragment === fragment) return;
          this.fragment = fragment;

          // Don't include a trailing slash on the root.
          if (fragment === '' && url !== '/') url = url.slice(0, -1);

          // If pushState is available, we use it to set the fragment as a real URL.
          if (this._hasPushState) {
            this.history[options.replace ? 'replaceState' : 'pushState']({}, document.title, url);

          // If hash changes haven't been explicitly disabled, update the hash
          // fragment to store history.
          } else if (this._wantsHashChange) {
            this._updateHash(this.location, fragment, options.replace);
            if (this.iframe && (fragment !== this.getFragment(this.getHash(this.iframe)))) {
              // Opening and closing the iframe tricks IE7 and earlier to push a
              // history entry on hash-tag change.  When replace is true, we don't
              // want this.
              if(!options.replace) this.iframe.document.open().close();
              this._updateHash(this.iframe.location, fragment, options.replace);
            }

          // If you've told us that you explicitly don't want fallback hashchange-
          // based history, then `navigate` becomes a page refresh.
          } else {
            return this.location.assign(url);
          }
          if (options.trigger) return this.loadUrl(fragment);
          /*jsl:end*/
        };

        Backbone.history._updateHash = _(Backbone.history._updateHash).wrap(function(originalFn, location, fragment, replace) {
            if(!fragmentIsLegal(fragment)) {
                fragment = storeFullFragment(fragment);
                if(replace) {
                    // if doing replace state operation, we can safely remove the old entry in the inMemoryHistory
                    var currentHash = this.getHash();
                    delete inMemoryHistory[currentHash];
                }
            }
            originalFn.call(Backbone.history, location, fragment, replace);
        });

        exports.strip_route = function(route) {
            return route.replace(routeStripper, '');
        };

        // the forceNoPushState argument is FOR TESTING ONLY
        // in production, start_backbone_history should always be called with no arguments
        exports.start_backbone_history = function(forceNoPushState) {
            var hasPushstate = "pushState" in window.history;
            //Due to the URL length constraint, forcing IE to use fragment identifier for the history management
            if (forceNoPushState || !hasPushstate || userAgent.isIE()) {
                $(document).ready(function() {
                    var hash = Backbone.history.getHash(),
                        splitHash = hash.split('?'),
                        hashPath = splitHash[0] || "",
                        hashQuery = splunkutil.queryStringToProp(splitHash[1] || ''),
                        locationQuery = splunkutil.queryStringToProp(window.location.search.split('?')[1] || ''),
                        mergedQuery = $.extend(locationQuery, hashQuery),
                        flattenedQuery = splunkutil.propToQueryString(mergedQuery),
                        adjustedHash = (hashPath && !fragmentIsHistoryId(hashPath) ? hashPath : exports.strip_route(window.location.pathname))
                                                + (flattenedQuery ? ("?" + flattenedQuery) : "");

                    if(!fragmentIsLegal(adjustedHash)) {
                        adjustedHash = storeFullFragment(adjustedHash);
                    }
                    window.location.replace(window.location.href.split('#')[0] + '#' + adjustedHash);
                    Backbone.history.start();
                });
            } else {
                Backbone.history.start({pushState: true});
            }
        };
        return exports;
    }
);

define('models/shared/ClassicURL',
    [
        'jquery',
        'underscore',
        'splunk.util',
        'backbone',
        'models/Base',
        'util/router_utils',
        'util/console'
    ],
    function($, _, util, Backbone, BaseModel, routerUtils, console) {

        var ClassicURLModel = BaseModel.extend({
            id: 'classicURL',
            initialize: function() {
                BaseModel.prototype.initialize.apply(this, arguments);
            },
            sync: function(method, model, options) {
                var resp,
                    state,
                    dfd = $.Deferred();
                options = options || {};

                var silentClear = options.silentClear;
                var replaceState = options.replaceState;

                delete options.silentClear;
                delete options.replaceState;

                if (silentClear) {
                    model.clear({silent: true});
                }

                if (method === 'read') {
                    resp = model.currentQueryString();
                } else if (method === 'create' || method === 'update') {
                    state = model.encode(options);
                    if (replaceState) {
                        model.replaceState(state, options);
                    } else {
                        model.pushState(state, options);
                    }
                    resp = this.currentQueryString();
                } else if (method === 'delete') {
                    this.pushState('', options);
                    resp = this.currentQueryString();
                } else {
                    throw new Error('invalid method: ' + method);
                }

                model.trigger('request', model, dfd, options);
                options.success(resp);
                return dfd.resolve().promise();
            },
            parse: function(response) {
                var urlQueryParameters = this.decode(response);

                /*
                 * Insert undefined values for each old attribute that
                 * is not specified in the new query parameters.
                 *
                 * That way, attributes missing from the new URL will
                 * be blanked out appropriately.
                 */
                var newAttributesWithBlanks = _.clone(this.attributes);
                _.each(newAttributesWithBlanks, function(value, key) {
                    newAttributesWithBlanks[key] = undefined;
                });
                _.extend(newAttributesWithBlanks, urlQueryParameters);

                return newAttributesWithBlanks;
            },
            /**
             * Convert the model to a query string
             * @param  {Object} options
             *         * preserveEmptyStrings: if a string is empty, still encode it in
             *         the query string. Defaults to true.
             *
             * @return {String} The model encoded as a query string.
             */
            encode: function(options) {
                var queryArray = [], encodedKey;
                _.each(this.toJSON(), function(value, key) {
                    if (_.isUndefined(value)) {
                        return;
                    }

                    if (value === "" && options && options.preserveEmptyStrings === false) {
                        return;
                    }

                    encodedKey = encodeURIComponent(key);
                    if (_.isObject(value)) {
                        console.error('Non-primitive values are not allowed in the query string: ', value);
                        throw new Error('Non-primitive values are not allowed in the query string');
                    } else {
                        queryArray.push(encodedKey + '=' + encodeURIComponent(value));
                    }
                });
                return queryArray.join('&');
            },
            decode: function(queryString) {
                return util.queryStringToProp(queryString);
            },
            currentQueryString: function() {
                var fragment;
                if (Backbone.history._hasPushState) {
                    return window.location.href.split('?')[1] || '';//not safe to read directly
                }
                fragment = Backbone.history.getFragment(window.location.href.split('#')[1] || '');//not safe to read directly
                return fragment.split('?')[1] || '';
            },
            pushState: function(data, options) {
                if (data) {
                    data = '?' + data;
                }
                Backbone.history.navigate(this.root() + data, $.extend(true, {}, options, {replace: false}));
            },
            replaceState: function(data, options) {
                if (data) {
                    data = '?' + data;
                }
                Backbone.history.navigate(this.root() + data, $.extend(true, {}, options, {replace: true}));
            },
            root: function() {
                return Backbone.history._hasPushState ? window.location.pathname :
                    '#' + routerUtils.strip_route(window.location.pathname);
            }
        });

        return ClassicURLModel;
    }
);

define('models/classicurl',['models/shared/ClassicURL'], function(ClassicURLModel) {

    // Return the singleton instance of the classic url model
    return new ClassicURLModel();

});
define('models/services/configs/AlertAction',['underscore','models/SplunkDBase'],function(_, Base){

    return Base.extend({
        urlRoot: 'configs/conf-alert_actions',
        getSetting: function(key, defaultValue) {
            return this.entry.content.has(key) ? this.entry.content.get(key) : defaultValue;
        },
        initialize: function() {
            Base.prototype.initialize.apply(this, arguments);
        }
    });

});
define('models/services/data/ui/Viewstate',
    [
        'underscore',
        'models/SplunkDBase',
        'util/splunkd_utils',
        'splunk.util'
    ],
    function(
        _,
        BaseModel,
        splunkd_utils,
        splunkUtil
    ) {
        return BaseModel.extend({
            url: 'data/ui/viewstates',
            initialize: function() {
                BaseModel.prototype.initialize.apply(this, arguments);
            },
            getFlattenedAndDedupedModules: function() {
                var content = this.entry.content.toJSON(),
                    flattenedModules = {};
                
                delete content['eai:acl'];
                delete content['eai:appName'];
                delete content['eai:userName'];
                delete content['disabled'];
            
                //flatten the contents
                _.each(content, function(value, module){
                    var keySplit = module.split("."),
                        key = keySplit[0].split("_")[0],
                        child = keySplit[1];
                    
                    if (!flattenedModules[key]) {
                        flattenedModules[key] = {};
                    }
                    
                    if (!flattenedModules[key][child]) {
                        flattenedModules[key][child] = value;
                    }
                });

                return flattenedModules;
            },
            convertToReportPoperties: function() {
                var flattenedModules = this.getFlattenedAndDedupedModules(),
                    props = {},
                    eventsTabSelected, statsTabSelected, vizTabSelected,
                    buttonSwitcher, count, softWrap, segmentation, fields, rowNumbers;
                
                /*
                 * AxisScaleFormatter.default => display.visualizations.charting.axisY.scale
                 * ChartTitleFormatter.default => NOT IMPLEMENTED
                 * ChartTypeFormatter.default => display.visualizations.charting.chart
                 * FancyChartTypeFormatter.default => display.visualizations.charting.chart
                 * LegendFormatter.default => display.visualizations.charting.legend.placement
                 * LineMarkerFormatter.default => display.visualizations.charting.axisX.markers (MISSING)
                 * NullValueFormatter.default => display.visualizations.charting.chart.nullValueMode
                 * SplitModeFormatter.default => NOT IMPLEMENTED
                 * StackModeFormatter.default => display.visualizations.charting.chart.stackMode
                 * XAxisTitleFormatter.default => display.visualizations.charting.axisTitleX.text
                 * YAxisRangeMaximumFormatter.default => display.visualizations.charting.axisY.maximumNumber
                 * YAxisRangeMinimumFormatter.default => display.visualizations.charting.axisY.minimumNumber
                 * YAxisTitleFormatter.default => display.visualizations.charting.axisTitleY.text
                 * FlashChart.height => display.visualizations.chartHeight
                 * FlashTimeline.height => NOT IMPLEMENTED
                 * FlashTimeline.minimized => display.page.search.timeline.format = [hidden|compact|full] (MUST REMAP FROM BOOLEAN)
                 * FlashWrapper.height => NOT IMPLEMENTED
                 * JSChart.height => display.visualizations.chartHeight
                 * Count.default OR Count.count => display.prefs.statistics.count OR display.prefs.events.count
                 * DataOverlay.default OR DataOverlay.dataOverlayMode => display.statistics.overlay
                 * HiddenSoftWrap.enable => display.events.list.wrap OR display.events.table.wrap OR display.statistics.wrap
                 * SoftWrap.enable => display.events.list.wrap OR display.events.table.wrap OR display.statistics.wrap
                 * MaxLines.default OR MaxLines.maxLines => display.events.maxLines
                 * RowNumbers.default OR RowNumbers.displayRowNumbers => display.events.rowNumbers OR display.statistics.rowNumbers
                 * Segmentation.default OR Segmentation.segmentation => display.events.raw.drilldown OR display.events.list.drilldown OR display.statistics.drilldown
                 * FieldPicker.fields => display.events.fields
                 * FieldPicker.sidebarDisplay => display.page.search.showFields
                 * ButtonSwitcher.selected => display.general.type REQUIRES REMAPPING
                 * 
                 * 
                Possible values from flashtimeline:
                |    ButtonSwitcher_0_9_0.selected =  "splIcon-results-table"
                |    ChartTypeFormatter_0_14_0.default =  "column"
                |    Count_0_8_1.default =  "50"
                |    DataOverlay_0_14_0.dataOverlayMode =  "none"
                |    DataOverlay_0_14_0.default =  "heatmap"
                |    FieldPicker_0_6_0.fields =  "host,sourcetype,source"
                |    FieldPicker_0_6_0.sidebarDisplay =  "True"
                |    FlashTimeline_0_4_1.height =  "95px"
                |    FlashTimeline_0_4_1.minimized =  "False"
                |    JSChart_0_14_1.height =  "300px"
                |    LegendFormatter_0_20_0.default =  "top"
                |    MaxLines_0_14_0.default =  "10"
                |    MaxLines_0_14_0.maxLines =  "10"
                |    NullValueFormatter_0_19_0.default =  "gaps"
                |    RowNumbers_0_13_0.default =  "true"
                |    RowNumbers_0_13_0.displayRowNumbers =  "true"
                |    RowNumbers_1_13_0.default =  "true"
                |    RowNumbers_1_13_0.displayRowNumbers =  "true"
                |    Segmentation_0_15_0.default =  "full"
                |    Segmentation_0_15_0.segmentation =  "full"
                |    SoftWrap_0_12_0.enable =  "True"
                |    SplitModeFormatter_0_18_0.default =  "false"
                |    StackModeFormatter_0_17_0.default =  "default"
                
                From Report Builder:
                |    ChartTypeFormatter_0_4_0.default =  "column"
                |    DataOverlay_0_5_0.dataOverlayMode =  "none"
                |    DataOverlay_0_5_0.default =  "none"
                |    JSChart_0_4_1.height =  "300px"
                |    LegendFormatter_0_10_0.default =  "right"
                |    LineMarkerFormatter_0_7_0.default =  "false"
                |    NullValueFormatter_0_9_0.default =  "gaps"
                |    SplitModeFormatter_0_8_0.default =  "false"
                |    StackModeFormatter_0_7_0.default =  "default"
                
                From Advanced Charting:
                |    ChartTypeFormatter_0_7_0.default =  "line"
                |    JSChart_0_7_1.height =  "300px"
                |    LegendFormatter_0_13_0.default =  "right"
                |    LineMarkerFormatter_0_10_0.default =  "false"
                |    NullValueFormatter_0_12_0.default =  "gaps"
                |    SplitModeFormatter_0_11_0.default =  "false"
                |    StackModeFormatter_0_10_0.default =  "default"
                 * 
                 */
                
                if (flattenedModules['ButtonSwitcher']) {
                    buttonSwitcher = flattenedModules['ButtonSwitcher']['selected'];
                    if (buttonSwitcher === "splIcon-results-table") {
                        props['display.general.type'] = 'statistics';
                        statsTabSelected = true;
                    } else if (buttonSwitcher === "splIcon-events-list") {
                        props['display.general.type'] = 'events';
                        eventsTabSelected = true;
                    }
                } else {
                    props['display.general.type'] = 'visualizations';
                    vizTabSelected = true;
                }
                
                if (flattenedModules['AxisScaleFormatter']) {
                    props['display.visualizations.charting.axisY.scale'] = flattenedModules['AxisScaleFormatter']['default'];
                }
                if (flattenedModules['FancyChartTypeFormatter']) {
                    props['display.visualizations.type'] = 'charting';
                    props['display.visualizations.charting.chart'] = flattenedModules['FancyChartTypeFormatter']['default'];
                }
                if (flattenedModules['ChartTypeFormatter']) {
                    //unfancy wins
                    props['display.visualizations.type'] = 'charting';
                    props['display.visualizations.charting.chart'] = flattenedModules['ChartTypeFormatter']['default'];
                }
                if (flattenedModules['LegendFormatter']) {
                    props['display.visualizations.charting.legend.placement'] = flattenedModules['LegendFormatter']['default'];
                }
                if (flattenedModules['LineMarkerFormatter']) {
                    props['display.visualizations.charting.axisX.markers'] = splunkd_utils.normalizeBooleanTo01String(flattenedModules['LineMarkerFormatter']['default']);
                }
                if (flattenedModules['NullValueFormatter']) {
                    props['display.visualizations.charting.chart.nullValueMode'] = flattenedModules['NullValueFormatter']['default'];
                }
                if (flattenedModules['StackModeFormatter']) {
                    props['display.visualizations.charting.chart.stackMode'] = flattenedModules['StackModeFormatter']['default'];
                }
                if (flattenedModules['XAxisTitleFormatter']) {
                    props['display.visualizations.charting.axisTitleX.text'] = flattenedModules['XAxisTitleFormatter']['default'];
                }
                if (flattenedModules['YAxisRangeMaximumFormatter']) {
                    props['display.visualizations.charting.axisY.maximumNumber'] = flattenedModules['YAxisRangeMaximumFormatter']['default'];
                }
                if (flattenedModules['YAxisRangeMinimumFormatter']) {
                    props['display.visualizations.charting.axisY.minimumNumber'] = flattenedModules['YAxisRangeMinimumFormatter']['default'];
                }
                if (flattenedModules['YAxisRangeMinimumFormatter']) {
                    props['display.visualizations.charting.axisY.minimumNumber'] = flattenedModules['YAxisRangeMinimumFormatter']['default'];
                }
                if (flattenedModules['YAxisTitleFormatter']) {
                    props['display.visualizations.charting.axisTitleY.text'] = flattenedModules['YAxisTitleFormatter']['default'];
                }
                if (flattenedModules['FlashChart']) {
                    props['display.visualizations.chartHeight'] = (flattenedModules['FlashChart']['height']).replace('px', '');
                }
                if (flattenedModules['JSChart']) {
                    //The viewstate will have either FlashChart OR JSChart
                    props['display.visualizations.chartHeight'] = (flattenedModules['JSChart']['height']).replace('px', '');
                }                
                if (flattenedModules['FlashTimeline']) {
                    if (splunkUtil.normalizeBoolean(flattenedModules['FlashTimeline']['minimized'])) {
                        props['display.page.search.timeline.format'] = 'compact';
                    } else {
                        props['display.page.search.timeline.format'] = 'hidden';
                    }
                }
                if (flattenedModules['Count']) {
                    count = flattenedModules['Count']['default'] || flattenedModules['Count']['count'];
                    
                    if (statsTabSelected || vizTabSelected) {
                        props['display.prefs.statistics.count'] = count;
                    } else {
                        props['display.prefs.events.count'] = count;
                    }    
                }
                if (flattenedModules['DataOverlay']) {
                    props['display.statistics.overlay'] = flattenedModules['DataOverlay']['default'] || flattenedModules['DataOverlay']['dataOverlayMode'];
                }
                if (flattenedModules['HiddenSoftWrap']) {
                    softWrap = splunkd_utils.normalizeBooleanTo01String(flattenedModules['HiddenSoftWrap']['enable']);
                    
                    if (statsTabSelected || vizTabSelected) {
                        props['display.statistics.wrap'] = softWrap;
                    } else {
                        props['display.events.list.wrap'] = softWrap;
                        props['display.events.table.wrap'] = softWrap;                       
                    }
                }
                if (flattenedModules['SoftWrap']) {
                    //non hidden wins
                    softWrap = splunkd_utils.normalizeBooleanTo01String(flattenedModules['SoftWrap']['enable']);
                    
                    if (statsTabSelected || vizTabSelected) {
                        props['display.statistics.wrap'] = softWrap;
                    } else {
                        props['display.events.list.wrap'] = softWrap;
                        props['display.events.table.wrap'] = softWrap;                        
                    }
                }
                if (flattenedModules['MaxLines']) {
                    props['display.events.maxLines'] = flattenedModules['MaxLines']['default'] || flattenedModules['MaxLines']['maxLines'];
                }
                if (flattenedModules['RowNumbers']) {
                    rowNumbers = flattenedModules['RowNumbers']['default'] || flattenedModules['RowNumbers']['displayRowNumbers'];
                    rowNumbers = splunkd_utils.normalizeBooleanTo01String(rowNumbers);
                    
                    if (statsTabSelected || vizTabSelected) {
                        props['display.statistics.rowNumbers'] = rowNumbers;
                    } else {
                        props['display.events.rowNumbers'] = rowNumbers;
                    }
                }
                if (flattenedModules['Segmentation']) {
                    segmentation = flattenedModules['Segmentation']['default'] || flattenedModules['Segmentation']['segmentation'];
                    
                    if (statsTabSelected || vizTabSelected) {
                        if (['row', 'cell', 'none'].indexOf(segmentation) > -1) {
                            props['display.statistics.drilldown'] = segmentation;
                        }
                    } else {
                        if (['inner', 'outer', 'full', 'none'].indexOf(segmentation) > -1) {
                            props['display.events.list.drilldown'] = segmentation;
                            props['display.events.raw.drilldown'] = segmentation;
                        }
                    }
                }
                if (flattenedModules['FieldPicker']) {
                    //example: display.events.fields":"[\"host\",\"source\",\"sourcetype\"]"
                    fields = flattenedModules['FieldPicker']['fields'].split(',');
                    props['display.events.fields'] = '[\"' + fields.join('\",\"') + '\"]';
                    props['display.page.search.showFields'] = splunkd_utils.normalizeBooleanTo01String(flattenedModules['FieldPicker']['sidebarDisplay']);
                }
                
                return props;
            }
        });
    }
);
define('models/search/Report',
    [
        'jquery',
        'underscore',
        'models/services/SavedSearch',
        'models/services/data/ui/Viewstate',
        'collections/search/Jobs',
        'util/time',
        'util/splunkd_utils',
        'util/general_utils',
        'splunk.util',
        'splunk.i18n',
        'uri/route',
        'util/math_utils'
    ],
    function($, _, SavedSearch, Viewstate, JobsCollection, time_utils, splunkd_utils, general_utils, splunkUtil, i18n, route, math_utils) {
        var ReportModel =  SavedSearch.extend({
            reportTree: {
                'match': { 
                    'display.general.type': {
                        'visualizations' : {
                            'match': {
                                'display.visualizations.type': {
                                    'singlevalue': {
                                        'view': 'single', icon: 'single-value', label: _('Single Value').t()
                                    },
                                    'charting': {
                                        'match': {'display.visualizations.charting.chart': {
                                                'line': { 'view': 'line', icon: 'chart-line', label: _('Line').t() },
                                                'area': { 'view': 'area', icon: 'chart-area',label: _('Area').t() },
                                                'column': { 'view': 'column', icon: 'chart-column', label: _('Column').t() },
                                                'bar': { 'view': 'bar', icon: 'chart-bar', label: _('Bar').t() },
                                                'pie': { 'view': 'pie', icon: 'chart-pie', label: _('Pie').t()},
                                                'scatter': { 'view': 'scatter', icon: 'chart-scatter', label: _('Scatter').t() },
                                                'radialGauge': { 'view': 'radialGauge', icon: 'gauge-radial', label: _('Radial').t() },
                                                'fillerGauge': { 'view': 'fillerGauge', icon: 'gauge-filler', label: _('Filler').t() },
                                                'markerGauge': { 'view': 'markerGauge', icon: 'gauge-marker', label: _('Marker').t() }
                                            }
                                        }
                                    },
                                    'mapping': {
                                        'view': 'mapping', icon: 'location', label: _('Map').t()
                                    }
                                }
                            }
                        },
                        'statistics': { 
                            'view': 'statistics'
                        },
                        'events': { 
                            'view': 'events'
                        }
                    }
                }
            },    
            initialize: function() {
                SavedSearch.prototype.initialize.apply(this, arguments);

                //associated
                this.jobs = new JobsCollection();
                this.associated.jobs = this.jobs;
            },
            sync: function(method, model, options) {
                options = options || {};
                _.defaults(options, {migrateViewState: true});
                
                if (!options.migrateViewState || method !== 'read') {
                    return SavedSearch.prototype.sync.apply(this, arguments);
                }
                
                var deferredResponse = $.Deferred(),
                    viewstateDeferred = $.Deferred(),
                    savedSearchProxy = new SavedSearch({id: this.id}),
                    bbXHR;
                
                model.trigger('request', model, deferredResponse, options);

                bbXHR = savedSearchProxy.fetch($.extend(true, {}, options, {
                    success: function(model, savedSearchResponse) {
                        this.setFromSplunkD(savedSearchProxy.toSplunkD());
                        
                        var vsid = this.entry.content.get("vsid"),
                            displayview = this.entry.content.get("displayview"),
                            hasBeenMigrated = splunkUtil.normalizeBoolean(this.entry.content.get("display.general.migratedFromViewState")),
                            name, viewstate;
                        
                        if (vsid && displayview && !hasBeenMigrated) {
                            name = /.*:/.test(vsid) ? vsid : (displayview + ":" + vsid);
                            viewstate = new Viewstate();
                            
                            viewstate.fetch({
                                url: splunkd_utils.fullpath(
                                    viewstate.url + "/" + encodeURIComponent(name),
                                    {
                                        app: options.data.app,
                                        owner: options.data.owner                               
                                    }
                                 ),
                                 success: function(model, response) {
                                     var viewstateConversionAttrs = viewstate.convertToReportPoperties();
                                     viewstateConversionAttrs["display.general.migratedFromViewState"] = "1";
                                     
                                     //layer in the viewstate properties
                                     this.entry.content.set(viewstateConversionAttrs);
                                     
                                     options.success(savedSearchResponse);
                                     viewstateDeferred.resolve();
                                 }.bind(this),
                                 error: function(model, response) {
                                     //the viewstate could not be found. Party on, but make sure if they save we never lookup the viewstate again.
                                     this.entry.content.set("display.general.migratedFromViewState", "1");
                                     
                                     options.success(savedSearchResponse);
                                     viewstateDeferred.resolve();
                                 }.bind(this)
                            });
                        } else {
                            options.success(savedSearchResponse);
                            viewstateDeferred.resolve();
                        }                        
                    }.bind(this),
                    error: function(model, savedSearchResponse) {
                        options.error(savedSearchResponse);                       
                    }.bind(this)
                }));
                
                $.when(viewstateDeferred).then(function() {
                    bbXHR.done(function(){
                        deferredResponse.resolve.apply(deferredResponse, arguments);
                    }.bind(this));
                }.bind(this));
                
                bbXHR.fail(function() {
                    deferredResponse.reject.apply(deferredResponse, arguments);
                }.bind(this));
                
                return deferredResponse.promise();                
            },
            parse: function(response) {
                var parsedResponse = SavedSearch.prototype.parse.apply(this, arguments),
                    contentModel = this.entry.content;

                // SPL-78883 unfortunately due to some case inconsistencies there are some reports in the wild with
                // display.visualizations.type "singleValue" instead of "singlevalue"
                // to deal with this, normalize to all lower case here
                if(contentModel.has('display.visualizations.type')) {
                    contentModel.set({
                        'display.visualizations.type': contentModel.get('display.visualizations.type').toLowerCase()
                    });
                }
                return parsedResponse;
            },
            fetchJobs: function(options) {
                var label = this.entry.get('name');
                if (!label) {
                    throw "Report must have a name to associate it with Jobs";
                }

                options = options || {};
                options.data = options.data || {};
                options.data.app = this.entry.acl.get('app');
                options.data.owner = this.entry.acl.get('owner');
                options.data.label = label;

                return this.jobs.fetchNonAutoSummaryJobs(options);
            },
            openInView: function () {
                if (this.entry.content.get('request.ui_dispatch_view') === 'pivot' || 
                    (this.entry.content.get('request.ui_dispatch_view') === "" && this.isPivotReport())) {
                    return 'pivot';
                } else {
                    return 'search';
                }
            },
            getVizType: function() {
                var that = this,
                    _vizTree = function(tree) { 
                    if (tree && tree.view){
                        return tree;
                    } else if (tree && tree.match){
                        var match;
                        _(tree.match).each(function(v, k){
                           match = v[that.entry.content.get(k)];
                        }, that);
                        if (match) return _vizTree(match);
                    } 
                };
                return _vizTree(this.reportTree.match['display.general.type'].visualizations);
            },
            isAlert: function () {
                var is_scheduled = this.entry.content.get('is_scheduled'),
                    alert_type = this.entry.content.get('alert_type'),
                    alert_track = this.entry.content.get('alert.track'),
                    actions = this.entry.content.get('actions'),
                    isRealTime = this.isRealTime();

                return is_scheduled &&
                        (alert_type !== 'always' ||
                            alert_track ||
                            (isRealTime && actions)
                        );
            },
            isRealTime: function() {
                var isEarliestRealtime = time_utils.isRealtime(this.entry.content.get('dispatch.earliest_time')),
                    isLatestRealtime = time_utils.isRealtime(this.entry.content.get('dispatch.latest_time'));

                return (isEarliestRealtime && isLatestRealtime);
            },
            // see documentation of isValidPivotSearch, this is not an exhaustive check, just a quick guess.
            isPivotReport: function() {
                return general_utils.isValidPivotSearch(this.entry.content.get('search'));
            },
            stripAlertAttributes: function(options) {
                return this.entry.content.set({
                        'alert.track': 0,
                        alert_type: 'always',
                        is_scheduled: 0
                    }, options);
            },
            stripReportAttributesToSaveAsAlert: function(options) {
                return this.entry.content.set({
                    auto_summarize: false
                },options);
            },
            stripPivotAttributes: function() {
                this.entry.content.set({
                    'display.page.pivot.dataModel': ''
                });
            },
            setTimeRangeWarnings: function(reportPristine) {
                var earliest = this.entry.content.get("dispatch.earliest_time"),
                    latest = this.entry.content.get("dispatch.latest_time"),
                    messages = [],
                    pristineEarliest, pristineLatest;

                if ((!time_utils.isEmpty(earliest) && time_utils.isAbsolute(earliest)) ||
                        (!time_utils.isEmpty(latest) && time_utils.isAbsolute(latest))) {
                    messages.push(
                       splunkd_utils.createMessageObject(
                            splunkd_utils.WARNING,
                            _("Your report has an absolute time range.").t()
                        )
                    );
                }

                if (reportPristine) {
                    if (reportPristine.isAlert()) {
                        pristineEarliest = reportPristine.entry.content.get("dispatch.earliest_time");
                        pristineLatest = reportPristine.entry.content.get("dispatch.latest_time");

                        if ((earliest !== pristineEarliest) || (latest !== pristineLatest)) {
                            this.entry.content.set({
                                "dispatch.earliest_time": pristineEarliest,
                                "dispatch.latest_time": pristineLatest
                            });

                            messages.push(
                               splunkd_utils.createMessageObject(
                                    splunkd_utils.WARNING,
                                    _("Your changes to the time range of this alert will not be saved.").t()
                                )
                            );
                        }
                    } else if (!reportPristine.isRealTime() && (reportPristine.entry.content.get('is_scheduled')) && this.isRealTime()) {
                        this.entry.content.set({
                            "is_scheduled": false
                        });

                        messages.push(
                           splunkd_utils.createMessageObject(
                                splunkd_utils.WARNING,
                                _("Saving a scheduled report as a real-time report will remove the schedule.").t()
                            )
                        );
                    }
                }

                if (messages.length) {
                    this.error.set({
                        messages: messages
                    });
                }
            },
            setAccelerationWarning: function(canSummarize, reportPristine) {
                var isCurrentModeVerbose = this.entry.content.get('display.page.search.mode') === splunkd_utils.VERBOSE,
                    messages = [];
                if (!canSummarize){
                    messages.push(
                        splunkd_utils.createMessageObject(
                            splunkd_utils.WARNING,
                            _("This report cannot be accelerated. Acceleration will be disabled.").t()
                        )
                    );
                    this.entry.content.set('auto_summarize', false);
                }
                else if (isCurrentModeVerbose && (_.isUndefined(reportPristine) || reportPristine.entry.content.get('display.page.search.mode') === splunkd_utils.VERBOSE)) {
                    messages.push(
                        splunkd_utils.createMessageObject(
                            splunkd_utils.WARNING,
                            _("A report running in verbose mode cannot be accelerated. Your search mode will be saved as Smart Mode.").t()
                        )
                    );
                    this.entry.content.set('display.page.search.mode', splunkd_utils.SMART);
                }
                else if (isCurrentModeVerbose && !_.isUndefined(reportPristine)) {
                    messages.push(
                        splunkd_utils.createMessageObject(
                            splunkd_utils.WARNING,
                            _("A report running in verbose mode cannot be accelerated. Your search mode will not be saved.").t()
                        )
                    );
                    this.entry.content.set('display.page.search.mode', reportPristine.entry.content.get('display.page.search.mode'));
                }
                if (messages.length) {
                    this.trigger('serverValidated', false, this, messages);
                    this.error.set({
                        messages: messages
                    });
                }
            },
            setPivotWarning: function() {
                var messages = [];
                if (this.isPivotReport()) {
                    messages.push(
                        splunkd_utils.createMessageObject(
                            splunkd_utils.WARNING,
                            _("Saving from Search will prevent this report from opening in Pivot.").t()
                        )
                    );
                    this.stripPivotAttributes();
                }
                if (messages.length) {
                    this.trigger('serverValidated', false, this, messages);
                    this.error.set({
                        messages: messages
                    });
                }
            },
            setDisplayType: function(isTransforming, reportSearch, options) {
                var type = this.entry.content.get('display.general.type') || 'statistics',
                    searchSpecificDefaults = reportSearch ? this.getSearchSpecificDefaults(reportSearch) : {};

                if (type === 'events') {
                    if(isTransforming){
                        type = searchSpecificDefaults['display.general.type'] || 'statistics';
                    }
                } else if ((type === 'statistics') || (type === 'visualizations')) {
                    if(!isTransforming){
                        type = 'events';
                    }
                }
                this.entry.content.set({'display.general.type': type}, options);
            },
            getSearchSpecificDefaults: function(reportSearch) {
                // if the search string is using 'geostats', the report should show as a map
                if(/(^geostats)|([|\s]geostats\s)/.test(reportSearch || '')) {
                    return ({
                        'display.general.type': 'visualizations',
                        'display.visualizations.type': 'mapping'
                    });
                }
                return {};
            },
            isDirty: function(otherReport, whitelist) {
                whitelist = whitelist || ReportModel.DIRTY_WHITELIST;
                
                var thisContent = general_utils.filterObjectByRegexes(this.entry.content.toJSON(), whitelist),
                    otherContent = general_utils.filterObjectByRegexes(otherReport.entry.content.toJSON(), whitelist);
                
                return !(_.isEqual(thisContent, otherContent));
            },
            canDelete: function() {
                return this.entry.links.get("remove") ? true : false;
            },
            canWrite: function(canScheduleSearch, canRTSearch) {
                return this.entry.acl.get('can_write') &&
                        !(this.entry.content.get('is_scheduled') && !canScheduleSearch) &&
                        !(this.isRealTime() && !canRTSearch);
            },
            canClone: function(canScheduleSearch, canRTSearch) {
                return !(this.entry.content.get('is_scheduled') && !canScheduleSearch) &&
                        !(this.isRealTime() && !canRTSearch);
            },
            canEmbed: function(canScheduleSearch, canEmbed) {
                return this.entry.acl.get('can_write') && canScheduleSearch && !this.isRealTime() && canEmbed;
            },
            getAlertTriggerConditionString: function() {
                var type = this.entry.content.get('alert_type'),
                    earliestTime = this.entry.content.get('dispatch.earliest_time'),
                    latestTime = this.entry.content.get('dispatch.latest_time'),
                    isRealtime = (earliestTime && time_utils.isRealtime(earliestTime)) || (latestTime && time_utils.isRealtime(latestTime)),
                    threshold = this.entry.content.get('alert_threshold'),
                    timeParse = time_utils.parseTimeString(earliestTime),
                    alertCondition = this.entry.content.get('alert_condition'),
                    isAllTimeRT = earliestTime === 'rt' ||latestTime === 'rt';
                switch(type) {
                    case 'always':
                        if (isRealtime) {
                            return _('Per-Result.').t();
                        }
                        return _('Number of Results is > 0.').t();
                    case 'number of events':
                    case 'number of hosts':
                    case 'number of sources':
                        if (isAllTimeRT) {
                            return _('Unsupported.').t();
                        }
                        var typeText = {
                            'number of events': _("Results").t(),
                            'number of hosts': _("Hosts").t(),
                            'number of sources': _("Sources").t()
                        };
                        switch(this.entry.content.get('alert_comparator')){
                            case 'greater than':
                                if (isRealtime) {
                                    switch(timeParse.unit) {
                                        case 'm':
                                            return splunkUtil.sprintf(i18n.ungettext('Number of %(typetext)s is > %(threshold)s in %(timeAmount)s minute.', 'Number of %(typetext)s is > %(threshold)s in %(timeAmount)s minutes.', timeParse.amount), {typetext: typeText[type], threshold: threshold, timeAmount: timeParse.amount});
                                        case 'h':
                                            return splunkUtil.sprintf(i18n.ungettext('Number of %(typetext)s is > %(threshold)s in %(timeAmount)s hour.', 'Number of %(typetext)s is > %(threshold)s in %(timeAmount)s hours.', timeParse.amount), {typetext: typeText[type], threshold: threshold, timeAmount: timeParse.amount});
                                        case 'd':
                                            return splunkUtil.sprintf(i18n.ungettext('Number of %(typetext)s is > %(threshold)s in %(timeAmount)s day.', 'Number of %(typetext)s is > %(threshold)s in %(timeAmount)s days.', timeParse.amount), {typetext: typeText[type], threshold: threshold, timeAmount: timeParse.amount});
                                    }
                                } else {
                                    return splunkUtil.sprintf(_('Number of %(typetext)s is > %(threshold)s.').t(), {typetext: typeText[type], threshold:threshold});
                                }
                                break;
                            case 'less than':
                                if (isRealtime) {
                                    switch(timeParse.unit) {
                                        case 'm':
                                            return splunkUtil.sprintf(i18n.ungettext('Number of %(typetext)s is < %(threshold)s in %(timeAmount)s minute.', 'Number of %(typetext)s is < %(threshold)s in %(timeAmount)s minutes.', timeParse.amount), {typetext: typeText[type], threshold: threshold, timeAmount: timeParse.amount});
                                        case 'h':
                                            return splunkUtil.sprintf(i18n.ungettext('Number of %(typetext)s is < %(threshold)s in %(timeAmount)s hour.', 'Number of %(typetext)s is < %(threshold)s in %(timeAmount)s hours.', timeParse.amount), {typetext: typeText[type], threshold: threshold, timeAmount: timeParse.amount});
                                        case 'd':
                                            return splunkUtil.sprintf(i18n.ungettext('Number of %(typetext)s is < %(threshold)s in %(timeAmount)s day.', 'Number of %(typetext)s is < %(threshold)s in %(timeAmount)s days.', timeParse.amount), {typetext: typeText[type], threshold: threshold, timeAmount: timeParse.amount});
                                    }
                                } else {
                                    return splunkUtil.sprintf(_('Number of %(typetext)s is < %(threshold)s.').t(), {typetext: typeText[type], threshold:threshold});
                                }
                                break;
                            case 'equal to':
                                if (isRealtime) {
                                    switch(timeParse.unit) {
                                        case 'm':
                                            return splunkUtil.sprintf(i18n.ungettext('Number of %(typetext)s is = %(threshold)s in %(timeAmount)s minute.', 'Number of %(typetext)s is = %(threshold)s in %(timeAmount)s minutes.', timeParse.amount), {typetext: typeText[type], threshold: threshold, timeAmount: timeParse.amount});
                                        case 'h':
                                            return splunkUtil.sprintf(i18n.ungettext('Number of %(typetext)s is = %(threshold)s in %(timeAmount)s hour.', 'Number of %(typetext)s is = %(threshold)s in %(timeAmount)s hours.', timeParse.amount), {typetext: typeText[type], threshold: threshold, timeAmount: timeParse.amount});
                                        case 'd':
                                            return splunkUtil.sprintf(i18n.ungettext('Number of %(typetext)s is = %(threshold)s in %(timeAmount)s day.', 'Number of %(typetext)s is = %(threshold)s in %(timeAmount)s days.', timeParse.amount), {typetext: typeText[type], threshold: threshold, timeAmount: timeParse.amount});
                                    }
                                } else {
                                    return splunkUtil.sprintf(_('Number of %(typetext)s is = %(threshold)s.').t(), {typetext: typeText[type], threshold:threshold});
                                }
                                break;
                            case 'not equal to':
                                if (isRealtime) {
                                    switch(timeParse.unit) {
                                        case 'm':
                                            return splunkUtil.sprintf(i18n.ungettext('Number of %(typetext)s is &#8800; %(threshold)s in %(timeAmount)s minute.', 'Number of %(typetext)s is &#8800; %(threshold)s in %(timeAmount)s minutes.', timeParse.amount), {typetext: typeText[type], threshold: threshold, timeAmount: timeParse.amount});
                                        case 'h':
                                            return splunkUtil.sprintf(i18n.ungettext('Number of %(typetext)s is &#8800; %(threshold)s in %(timeAmount)s hour.', 'Number of %(typetext)s is &#8800; %(threshold)s in %(timeAmount)s hours.', timeParse.amount), {typetext: typeText[type], threshold: threshold, timeAmount: timeParse.amount});
                                        case 'd':
                                            return splunkUtil.sprintf(i18n.ungettext('Number of %(typetext)s is &#8800; %(threshold)s in %(timeAmount)s day.', 'Number of %(typetext)s is &#8800; %(threshold)s in %(timeAmount)s days.', timeParse.amount), {typetext: typeText[type], threshold: threshold, timeAmount: timeParse.amount});
                                    }
                                } else {
                                    return splunkUtil.sprintf(_('Number of %(typetext)s is &#8800; %(threshold)s.').t(), {typetext: typeText[type], threshold:threshold});
                                }
                                break;
                            case 'drops by':
                                // drops by is only supported for non-realtime saved searches
                                return splunkUtil.sprintf(_('Number of %(typetext)s drops by %(threshold)s.').t(), {typetext: typeText[type], threshold:threshold});
                            case 'rises by':
                                // rises by is only supported for non-realtime saved searches
                                return splunkUtil.sprintf(_('Number of %(typetext)s rises by %(threshold)s.').t(), {typetext: typeText[type], threshold:threshold});
                        }
                        break;
                    case 'custom':
                        if (isAllTimeRT) {
                            return _('Unsupported.').t();
                        }
                        if (isRealtime) {
                            switch(timeParse.unit) {
                                case 'm':
                                    return splunkUtil.sprintf(i18n.ungettext('Custom. "%(alertCondition)s" in %(timeAmount)s minute.', 'Custom. "%(alertCondition)s" in %(timeAmount)s minutes.', timeParse.amount), {alertCondition: alertCondition, timeAmount: timeParse.amount});
                                case 'h':
                                    return splunkUtil.sprintf(i18n.ungettext('Custom. "%(alertCondition)s" in %(timeAmount)s hour.', 'Custom. "%(alertCondition)s" in %(timeAmount)s hours.', timeParse.amount), {alertCondition: alertCondition, timeAmount: timeParse.amount});
                                case 'd':
                                    return splunkUtil.sprintf(i18n.ungettext('Custom. "%(alertCondition)s" in %(timeAmount)s day.', 'Custom. "%(alertCondition)s" in %(timeAmount)s days.', timeParse.amount), {alertCondition: alertCondition, timeAmount: timeParse.amount});
                            }
                        } else {
                            return splunkUtil.sprintf(_('Custom. "%s".').t(), alertCondition);
                        }
                        break;
                }
            },
            getStringOfActions: function() {
                var actionArray = [];

                if (this.entry.content.get("action.email") || this.entry.content.get("action.script")) {
                    var actions = this.entry.content.get("actions");

                    if (actions.search('email') != -1) {
                        actionArray.push(_('Send Email').t());
                    }
                    if (actions.search('script') != -1) {
                        actionArray.push(_('Run a Script').t());
                    }
                }

                if (this.entry.content.get('alert.track')) {
                    actionArray.push(_('List in Triggered Alerts').t());
                }

                return actionArray.join(_(', ').t());
            },
            routeToViewReport: function(root, locale, app, sid) {
                var data = {s: this.id};
                
                if (this.isAlert()) {
                    return route.alert(root, locale, app, {data: data});
                }
                if (sid) {
                    data.sid = sid;
                }
                return route.report(root, locale, app, {data: data});
            },
            getNearestMaxlines: function() {
                var maxLines = parseInt(this.entry.content.get('display.events.maxLines'), 10);
                if (isNaN(maxLines)) {
                    maxLines = 5;
                }
                return "" + math_utils.nearestMatchAndIndexInArray(maxLines, [5, 10, 20, 50, 100, 200, 0]).value;
            },
            getSortingSearch: function() {
                var search,
                    content = this.entry.content,
                    offset = content.get('display.prefs.events.offset'),
                    count = content.get('display.prefs.events.count'),
                    sortColumn = content.get('display.events.table.sortColumn');
                    
                if (sortColumn && !_.isUndefined(offset) && !_.isUndefined(count)) {
                    search = ('| sort ' + (parseInt(offset, 10) + parseInt(count, 10)) + ((content.get('display.events.table.sortDirection') === 'desc') ? ' - ': ' ') + sortColumn);
                }
                return search;
            },
            getDisplayEventsFields: function(options) {
                options || (options={});
                var object,
                    fields = [];
                _.each(this.entry.content.toObject('display.events.fields') || [], function(value) {
                    if (options.key) {
                        object = {};
                        object[options.key] = value;
                        fields.push(object);
                    } else {
                        fields.push(value);
                    }
                });
                
                return fields;
            }
        },
        {
            DOCUMENT_TYPES: {
                ALERT: 'alert',
                PIVOT_REPORT: 'pivot-report',
                REPORT: 'report'
            },
            DIRTY_WHITELIST: [
                '^dispatch\.earliest_time$',
                '^dispatch\.latest_time$',
                '^display\.events\.fields$',
                '^display\.events\.list\.drilldown$',
                '^display\.events\.list\.wrap$',
                '^display\.events\.maxLines$',
                '^display\.events\.raw\.drilldown$',
                '^display\.events\.rowNumbers$',
                '^display\.events\.table\.drilldown$',
                '^display\.events\.table\.wrap$',
                '^display\.events\.type$',
                '^display\.general\.enablePreview$',
                '^display\.general\.migratedFromViewState$',
                '^display\.general\.timeRangePicker\.show$',
                '^display\.general\.type$',
                '^display\.page\.pivot\.dataModel$',
                '^display\.page\.search\.mode$',
                '^display\.page\.search\.showFields$',
                '^display\.page\.search\.timeline\.format$',
                '^display\.page\.search\.timeline\.scale$',
                '^display\.statistics\.drilldown$',
                '^display\.statistics\.overlay$',
                '^display\.statistics\.rowNumbers$',
                '^display\.statistics\.wrap$',
                '^display\.visualizations\.chartHeight$',
                '^display\.visualizations\.charting\.axisLabelsX\.majorLabelStyle\.overflowMode$',
                '^display\.visualizations\.charting\.axisLabelsX\.majorLabelStyle\.rotation$',
                '^display\.visualizations\.charting\.axisLabelsX\.majorUnit$',
                '^display\.visualizations\.charting\.axisLabelsY2\.majorUnit$',
                '^display\.visualizations\.charting\.axisLabelsY\.majorUnit$',
                '^display\.visualizations\.charting\.axisTitleX\.text$',
                '^display\.visualizations\.charting\.axisTitleX\.visibility$',
                '^display\.visualizations\.charting\.axisTitleY2\.text$',
                '^display\.visualizations\.charting\.axisTitleY2\.visibility$',
                '^display\.visualizations\.charting\.axisTitleY\.text$',
                '^display\.visualizations\.charting\.axisTitleY\.visibility$',
                '^display\.visualizations\.charting\.axisX\.maximumNumber$',
                '^display\.visualizations\.charting\.axisX\.minimumNumber$',
                '^display\.visualizations\.charting\.axisX\.scale$',
                '^display\.visualizations\.charting\.axisY2\.enabled$',
                '^display\.visualizations\.charting\.axisY2\.maximumNumber$',
                '^display\.visualizations\.charting\.axisY2\.minimumNumber$',
                '^display\.visualizations\.charting\.axisY2\.scale$',
                '^display\.visualizations\.charting\.axisY\.maximumNumber$',
                '^display\.visualizations\.charting\.axisY\.minimumNumber$',
                '^display\.visualizations\.charting\.axisY\.scale$',
                '^display\.visualizations\.charting\.chart$',
                '^display\.visualizations\.charting\.chart\.nullValueMode$',
                '^display\.visualizations\.charting\.chart\.overlayFields$',
                '^display\.visualizations\.charting\.chart\.rangeValues$',
                '^display\.visualizations\.charting\.chart\.sliceCollapsingThreshold$',
                '^display\.visualizations\.charting\.chart\.stackMode$',
                '^display\.visualizations\.charting\.chart\.style$',
                '^display\.visualizations\.charting\.drilldown$',
                '^display\.visualizations\.charting\.gaugeColors$',
                '^display\.visualizations\.charting\.layout\.splitSeries$',
                '^display\.visualizations\.charting\.legend\.labelStyle\.overflowMode$',
                '^display\.visualizations\.charting\.legend\.placement$',
                '^display\.visualizations\.mapHeight$',
                '^display\.visualizations\.mapping\.data\.maxClusters$',
                '^display\.visualizations\.mapping\.drilldown$',
                '^display\.visualizations\.mapping\.map\.center$',
                '^display\.visualizations\.mapping\.map\.zoom$',
                '^display\.visualizations\.mapping\.markerLayer\.markerMaxSize$',
                '^display\.visualizations\.mapping\.markerLayer\.markerMinSize$',
                '^display\.visualizations\.mapping\.markerLayer\.markerOpacity$',
                '^display\.visualizations\.mapping\.tileLayer\.maxZoom$',
                '^display\.visualizations\.mapping\.tileLayer\.minZoom$',
                '^display\.visualizations\.mapping\.tileLayer\.url$',
                '^display\.visualizations\.show$',
                '^display\.visualizations\.singlevalue\.afterLabel$',
                '^display\.visualizations\.singlevalue\.beforeLabel$',
                '^display\.visualizations\.singlevalue\.underLabel$',
                '^display\.visualizations\.type$',
                '^search$'
            ]
        });
        return ReportModel;
    }
);

define('models/shared/eventsviewer/UIWorkflowAction',
    [
        'underscore',
        'models/Base'
    ],
    function(_, BaseModel) {
        return BaseModel.extend({
            initialize: function() {
                BaseModel.prototype.initialize.apply(this, arguments);
            },

            sync: function(method, model, options) {
                throw 'unsupported method:' + method;
            }
        });
    }
);
