
define('collections/search/Reports',
    [
        "models/search/Report",
        "collections/services/SavedSearches"
    ],
    function(ReportModel, SavedSearchCollection) {
        return SavedSearchCollection.extend({
            model: ReportModel,
            initialize: function() {
                SavedSearchCollection.prototype.initialize.apply(this, arguments);
            }
        },
        {
            ALERT_SEARCH_STRING: '(is_scheduled=1 AND (alert_type!=always OR alert.track=1 OR (dispatch.earliest_time="rt*" AND dispatch.latest_time="rt*" AND actions="*" )))'
        });
    }
);

define('util/xml',['jquery', 'underscore'], function($, _) {

    /**
     * Create a new XML node
     * @param str {string} the XML source
     * @returns the jQuery wrapped XML node
     */
    function $node(str) {
        var document = $.parseXML(str);
        return $(document.childNodes[0]);
    }

    /**
     * Clone the given XML node
     * @param node the node the clone
     * @returns the cloned node
     */
    function clone(node) {
        return $node(serialize(node));
    }

    /**
     * Create a new CDATA section from the given text
     * @param str the text
     * @returns {CDATASection} the resulting XML CDATA node
     */
    function cdata(str) {
        var document = $.parseXML('<x></x>');
        return document.createCDATASection(str);
    }

    /**
     * Remove all empty text nodes from the given XML document or node and trim all leading and trailing whitespace
     * for all other text nodes
     * @param n the XML document or node
     * @param exceptions on object for nodes to exclude from whitespace cleanup (keys correspond to node names, values
     * should be truthy)
     */
    function stripEmptyTextNodes(n, exceptions) {
        //IE <9 does not have TEXT_NODE
        var TEXT_NODE = n.TEXT_NODE || 3,
            i, child, childNodes = n.childNodes;
        for (i = childNodes.length - 1; i >= 0; i--) {
            child = childNodes[i];
            if (child !== undefined) {
                if (child.nodeType === TEXT_NODE) {
                    if (/^\s*$/.test(child.nodeValue)) {
                        n.removeChild(child);
                    } else {
                        child.nodeValue = $.trim(child.nodeValue);
                    }
                }
            }
        }
        childNodes = n.childNodes;
        for (i = childNodes.length - 1; i >= 0; i--) {
            child = childNodes[i];
            if (child.nodeType === n.ELEMENT_NODE || child.nodeType === n.DOCUMENT_NODE) {
                if (exceptions == null || !exceptions[child.nodeName]) {
                    stripEmptyTextNodes(child, exceptions);
                }
            }
        }
    }

    var INDENT = '  ';

    function indentTxt(level) {
        var txt = ['\n'], x = level;
        while (x--) {
            txt.push(INDENT);
        }
        return txt.join('');
    }

    function indent($xml, n, level) {
        if (!n || !n.childNodes) {
            return;
        }

        //IE <9 does not have TEXT_NODE
        var TEXT_NODE = n.TEXT_NODE || 3;

        for (var i = 0; i <= n.childNodes.length; i++) {
            var child1 = n.childNodes[i - 1], child2 = n.childNodes[i];
            if (child2 && child2.nodeType !== TEXT_NODE && ((!child1) || child1.nodeType !== TEXT_NODE)) {
                n.insertBefore($xml.createTextNode(indentTxt(level)), child2);
            }
            if (i === n.childNodes.length && child1 && child1.nodeType !== TEXT_NODE) {
                n.appendChild($xml.createTextNode(indentTxt(level - 1)));
            }
        }
        _.chain(n.childNodes).filter(function(c) {
            return c.nodeType === n.ELEMENT_NODE;
        }).each(function(c) {
                indent($xml, c, level + 1);
            });
    }

    /**
     * Format the given jQuery-XML document by stripping out empty text nodes and indenting XML elements
     * @param $xml the jQuery-wrapped XML document
     * @param noStrip an array of node names to exclude from whitespace cleanup
     * @returns the formatted XML document
     */
    function formatXMLDocument($xml, noStrip) {
        stripEmptyTextNodes($xml[0], _.object(noStrip, noStrip));
        indent($xml[0], $xml[0].childNodes[0], 1);
        return $xml;
    }

    /**
     * Serialize the given XML document to string
     * @param xml either a plain XML document or an jQuery-wrapped XML document
     * @returns {string} the formatted XML
     */
    function serialize(xml) {
        if (xml instanceof $) {
            xml = xml[0];
        }
        return Object.prototype.hasOwnProperty.call(xml, 'xml') ? xml.xml : new XMLSerializer().serializeToString(xml);
    }

    /**
     * Utility method to inject a node into a container by inserting it before or after particular child elements of a
     * container. If none of the child elements can be found then a fallback can be used to either append or prepend the
     * element or to execute a function to run arbitrary alternative injection.
     *
     * @param options {object} - {
     *      node {Element}: the node to inject
     *      container {Element}: the container where the node is to be injected into
     *      where {String}: "after" or "before" - where, relative to the selectors should the node be injected
     *      selectors {Array}: child selectors of elements where node is to be injected before or after. The first match will
     *                 be used.
     *      fallback {String|Function}:
     * }
     * @returns {boolean} true if the node has been injected, false if not
     */
    function inject(options) {
        var node = options.node;
        var where = options.where;
        var container = options.container;
        var selectors = options.selectors || [];
        var fallback = options.fallback;
        var $container = $(container);
        for (var i = 0; i < selectors.length; i++) {
            var selector = selectors[i];
            var target = $container.children(selector);
            if (target.length) {
                target[where](node);
                return true;
            }
        }
        if (_.isString(fallback)) {
            $container[fallback](node);
            return true;
        } else if (_.isFunction(fallback)) {
            fallback($container, node);
            return true;
        }
        return false;
    }

    /**
     * Replace a child element matched by a selector within a container with a new node. If the no child element
     * matches the selector, then the new node is appended to the container.
     *
     * @param options {object} - {
     *      node {Element|Array|String} the node(s) to insert into the container
     *      container {element}: the container
     *      selector {String}: the child selector to use to match the elements to replace
     * }
     */
    function replaceOrAppend(options) {
        replaceOrInject(options.node, options.selector, options.container, 'append');
    }

    /**
     * Replace a child element matched by a selector within a container with a new node. If the no child element
     * matches the selector, then the new node is prepended to the container.
     *
     * @param options {object} - {
     *      node {Element|Array|String} the node(s) to insert into the container
     *      container {element}: the container
     *      selector {String}: the child selector to use to match the elements to replace
     * }
     */
    function replaceOrPrepend(options) {
        replaceOrInject(options.node, options.selector, options.container, 'prepend');
    }

    function replaceOrInject(node, selector, container, fallback) {
        var $container = $(container);
        var existing = $container.children(selector);
        if (existing.length) {
            $(_.rest(existing)).remove();
            $(existing.first()).replaceWith(node);
        } else {
            $container[fallback](node);
        }
    }

    return {
        $node: $node,
        cdata: cdata,
        stripEmptyTextNodes: stripEmptyTextNodes,
        formatXMLDocument: formatXMLDocument,
        serialize: serialize,
        clone: clone,
        inject: inject,
        replaceOrAppend: replaceOrAppend,
        replaceOrPrepend: replaceOrPrepend
    };
});
define('models/search/Dashboard',
    [
        'jquery',
        'underscore',
        'splunk.util',
        'models/services/data/ui/View',
        'util/xml',
        'models/Base'
    ],
    function($, _, splunkutil, ViewModel, xmlUtils, BaseModel) {

        var HTML_PANEL_TYPE = 'html',
            CHART_PANEL_TYPE = 'chart',
            EVENT_PANEL_TYPE = 'event',
            SINGLE_PANEL_TYPE = 'single',
            MAP_PANEL_TYPE = 'map',
            TABLE_PANEL_TYPE = 'table',
            NON_HTML_PANEL_TYPES = [CHART_PANEL_TYPE, EVENT_PANEL_TYPE, SINGLE_PANEL_TYPE, MAP_PANEL_TYPE, TABLE_PANEL_TYPE];

        /**
         * Transient Dashboard Metadata Model
         *
         * Attributes:
         * - label
         * - description
         *
         */
        var DashboardMetadata = BaseModel.extend({
            constructor: function(dashboard) {
                this._dash = dashboard;
                BaseModel.prototype.constructor.call(this);
            },
            //validation: {},
            apply: function(){
                this._dash._applyMetadata(this.toJSON());
            },
            save: function() {
                if(arguments.length) {
                    this.set.apply(this, arguments);
                }
                this._dash._applyMetadata(this.toJSON());
                return this._dash.save.apply(this._dash, arguments);
            },
            fetch: function() {
                var m = this._dash._extractMetadata();
                this.set(m);
                var dfd = $.Deferred();
                dfd.resolve(this);
                return dfd;
            }
        });

        var Dashboard = ViewModel.extend({
            /**
             * model {Object} 
             * options {
             *     indent: <boolean> (default: true)
             * }
             */
            initialize: function(model, options) {
                ViewModel.prototype.initialize.apply(this, arguments);
                this.indent = (options || {}).indent !== false;
            },
            initializeAssociated: function() {
                ViewModel.prototype.initializeAssociated.apply(this, arguments);
                var meta = this.meta = this.meta || new DashboardMetadata(this);
                this.entry.content.on('change:eai:data', function(){
                    meta.fetch();
                }, this);
                meta.fetch();
            },
            associatedOff: function(e, cb, ctx) {
                ViewModel.prototype.associatedOff.apply(this, arguments);
                this.meta.off(e, cb, ctx);
            },
            set$XML: function($xml) {
                var raw = xmlUtils.serialize(this.indent ? this.formatXML($xml) : $xml);
                this.setXML(raw);
            },
            formatXML: function($xml) {
                // Format the given XML document but don't modify the whitespace for <delimiter> nodes
                return xmlUtils.formatXMLDocument($xml, ['delimiter', 'html']);
            },
            setXML: function(raw) {
                this.entry.content.set('eai:data', raw);
                this.entry.content.set('eai:type', 'views');
            },
            setHTML: function(raw) {
                this.entry.content.set('eai:data', raw);
                this.entry.content.set('eai:type', 'html');
            },
            _extractMetadata: function() {
                var isXML = this.isXML(), $xml = isXML ? this.get$XML() : null;
                return {
                    label: this.entry.content.get('label') || this.entry.get('name'),
                    description: (isXML && $xml.find(':eq(0) > description').text()) || ''
                };
            },
            _applyMetadata: function(metadata) {
                var $xml = this.get$XML(),
                    $label = $xml.find(':eq(0) > label'),
                    $description = $xml.find(':eq(0) > description'),
                    label = metadata.label, description = metadata.description;

                if(label !== undefined && label !== null) {
                    if(!$label.length) {
                        $label = xmlUtils.$node('<label/>');
                        $xml.find(':eq(0)').prepend($label);
                    }
                    $label.text(label);
                    this.entry.content.set("label", label);
                }

                if(description !== undefined && description !== null) {
                    if((description === undefined || description === '') && $description.length) {
                        $description.remove();
                    } else {
                        if(!$description.length) {
                            $description = xmlUtils.$node('<description/>');
                            if($label.length) {
                                $description.insertAfter($label);
                            } else {
                                $xml.find(':eq(0)').prepend($description);
                            }
                        }
                    }
                    $description.text(description);
                }

                this.set$XML($xml);
            },
            getLabel: function() {
                var result = this.meta.get('label');
                return result === undefined ? "" : result;
            },
            setLabel: function(value) {
                this.setLabelAndDescription(value, undefined);
            },       
            getDescription: function() {
                return this.meta.get('description');
            },
            setDescription: function(value) {
                this.setLabelAndDescription(undefined, value);
            },
            setLabelAndDescription: function(label, description) {
                this._applyMetadata({ label: label, description: description });
            },
            get$Rows: function() {
                var $xml = this.get$XML();
                return $xml.find(':eq(0) > row');
            },
            appendNewPanel: function(panelType, properties) {
                var isNonHTML = (_.indexOf(NON_HTML_PANEL_TYPES, panelType) != -1),
                    isHTML = (panelType === HTML_PANEL_TYPE),
                    panel, $xml;

                if (isNonHTML || isHTML) {
                    if (isNonHTML) {
                        panel = _.template(this.nonHTMLPanelTemplate, {
                            panelType: panelType,
                            properties: properties
                        });
                    } else {
                        panel = _.template(this.HTMLPanelTemplate, {
                            properties: properties
                        });
                    }

                    $xml = this.get$XML();
                    var rowNode = xmlUtils.$node('<row/>');
                    var panelNode = xmlUtils.$node('<panel/>').appendTo(rowNode);
                    $(panelNode).append(xmlUtils.$node(panel));
                    $xml.find(':eq(0)').append(rowNode);
                    this.set$XML($xml);
                }
            },
            nonHTMLPanelTemplate: '\
                <<%- panelType %>>\
                    <% if (properties.title) { %>\
                        <title><%- properties.title %></title>\
                    <% } %>\
                    <% if (properties.searchString) { %>\
                        <searchString><%- properties.searchString %></searchString>\
                        <% if (properties.earliestTime !== undefined) { %>\
                            <earliestTime><%- properties.earliestTime %></earliestTime>\
                        <% } %>\
                        <% if (properties.latestTime !== undefined) { %>\
                            <latestTime><%- properties.latestTime %></latestTime>\
                        <% } %>\
                    <% } else if (properties.pivotSearch) { %>\
                        <pivotSearch>\
                            <model><%= properties.pivotSearch.model %></model>\
                            <object><%= properties.pivotSearch.object %></object>\
                            <filters><%= properties.pivotSearch.filters %></filters>\
                            <cells><%= properties.pivotSearch.cells %></cells>\
                            <rows><%= properties.pivotSearch.rows %></rows>\
                            <columns><%= properties.pivotSearch.columns %></columns>\
                        </pivotSearch>\
                    <% } else if (properties.searchName) { %>\
                        <searchName><%- properties.searchName %></searchName>\
                    <% } %>\
                    <% if (properties.fields) { %>\
                        <fields><%- properties.fields %></fields>\
                    <% } %>\
                    <% _.each(properties.options, function(value, key) { %>\
                        <option name="<%- key %>"><%- value %></option>\
                    <% }) %>\
                </<%- panelType %>>\
            ',
            HTMLPanelTemplate: '<html><%= properties.html %></html>'
        },
        {
            panelXMLToPanelTypeAndProperties: function(xml){
                var properties = {},
                    $xml = $(xml), raw;

                if (xml.nodeName === HTML_PANEL_TYPE){
                    raw = xmlUtils.serialize(xml);
                    return {
                        panelType: xml.nodeName,
                        properties: {
                            html: $.trim(raw.replace(/^\s*<html>|<\/html>\s*$/g,''))
                        }
                    };
                }
                $xml.children().each(function(index, el){
                    var $el = $(el);
                    if (el.nodeName !== 'option') {
                        properties[el.nodeName] = $el.text();
                    } else {
                        properties.options = properties.options || {};
                        properties.options[$el.attr('name')] = $el.text();
                    }
                });
                return {
                    panelType: xml.nodeName,
                    properties: properties
                };
            },
            reportToPropertiesFromPanelType: function(panelType, reportModel, isInline){
                var isNonHTML = (_.indexOf(NON_HTML_PANEL_TYPES, panelType) != -1),
                properties = {},
                search, searchName, earliestTime, latestTime;

                if (isNonHTML){
                    if (!reportModel.isNew() && !isInline){
                        properties.searchName = reportModel.entry.get('name');
                    } else {
                        properties.searchString = reportModel.entry.content.get("search");

                        earliestTime = reportModel.entry.content.get("dispatch.earliest_time");
                        if (earliestTime !== undefined) {
                            properties.earliestTime = earliestTime;
                        }

                        latestTime = reportModel.entry.content.get("dispatch.latest_time");
                        if (latestTime !== undefined) {
                            properties.latestTime = latestTime;
                        }
                    }

                    if (panelType === CHART_PANEL_TYPE) {
                        properties.options = reportModel.entry.content.filterByWildcards(
                            ["^display\.visualizations\.charting\..*"],
                            {
                                strip:'display.visualizations.'
                            }
                        );
                    } else if (panelType === SINGLE_PANEL_TYPE) {
                        properties.options = reportModel.entry.content.filterByWildcards(
                            ["^display\.visualizations\.singlevalue\..*"],
                            {
                                strip:'display.visualizations.singlevalue.'
                            }
                        );
                    } else if (panelType === MAP_PANEL_TYPE) {
                        properties.options = reportModel.entry.content.filterByWildcards(
                            ["^display\.visualizations\.mapping\..*"],
                            {
                                strip:'display.visualizations.'
                            }
                        );
                        // Remove the 'mapping.data.bounds' property which is not intended to be persisted (SPL-79034).
                        delete properties.options['mapping.data.bounds'];
                    }
                } else {
                    throw("Unsupported panel type");
                }

                return properties;
            }
        });

        // break the shared reference to Entry
        Dashboard.Entry = Dashboard.Entry.extend({});
        // now we can safely extend Entry.Content
        var Content = Dashboard.Entry.Content;
        Dashboard.Entry.Content = Content.extend({
            initialize: function() {
                Content.prototype.initialize.apply(this, arguments);
            },
            validate: function(attributes) {
                var eaiData = attributes["eai:data"],
                    xml, dashboard;

                if (eaiData != void(0)){
                    xml = $.parseXML(eaiData);

                    dashboard = xml.firstChild;
                    if (dashboard.nodeName !== 'dashboard' && dashboard.nodeName !== 'form'){
                        return {
                            'eai:data': "You must declare a dashboard node."
                        };
                    }
                }
            }
        });
        
        return Dashboard;
    }
);

define('splunkjs/mvc/simplexml/dashboardmodel',['require','underscore','jquery','../../mvc','models/search/Dashboard','util/xml','util/general_utils','util/console'],function(require) {
    var _ = require('underscore'), $ = require('jquery');
    var mvc = require('../../mvc');
    var BaseDashboardModel = require('models/search/Dashboard');
    var xmlUtils = require('util/xml');
    var GeneralUtils = require('util/general_utils');
    var console = require('util/console');

    var DashboardModel = BaseDashboardModel.extend({
        initialize: function() {
            BaseDashboardModel.prototype.initialize.apply(this, arguments);
        },
        /**
         *
         * @param options {
         *     tokens (boolean) -  whether the generated XML source should contain tokens or their values
         *     useLoadjob (boolean) - whether to use | loadjob <sid> instead of writing the actual search to the XML
         *     indent (boolean) - whether to generated pretty-printed XML or not
         * }
         * @returns {String} the serialized XML
         */
        getFlattenedXML: function(options) {
            if (!this._structure) {
                throw new Error('Cannot create flattened XML without the item order being captured first');
            }
            var $n = xmlUtils.$node, that = this;
            options = options || {};

            var dashboard = $n('<dashboard/>');
            $n('<label/>').text(this.meta.get('label')).appendTo(dashboard);
            if (this.meta.has('description')) {
                $n('<description/>').text(this.meta.get('description')).appendTo(dashboard);
            }

            //TODO add serialization of form elements (condition for pdf printing?)
            _(this._structure.rows).each(function(panels) {
                var row = $n('<row/>');

                if (_(panels).any(function(p) { return p.elements.length > 1; })) { // Are there any grouped panels?
                    var groups = _(panels).map(function(p) { return p.elements.length; }).join(',');
                    row.attr('grouping', groups);
                }

                _(panels).chain().flatten().pluck('elements').flatten().each(function(id) {
                    var element = mvc.Components.get(id);
                    var settings = element.model.mapToXML(_.extend({ tokens: false, flatten: true }, options));
                    var newNode = xmlUtils.$node('<' + settings.type + '/>');

                    if (settings.attributes !== undefined) {
                        newNode.attr(settings.attributes);
                    }

                    if (settings.content) {
                        if (settings.cdata) {
                            newNode.append(xmlUtils.cdata(settings.content));
                        } else {
                            newNode.text(settings.content);
                        }
                    } else {
                        that._applyTitle(newNode, settings);
                        var manager = mvc.Components.get(element.model.entry.content.get('display.general.manager'));
                        if (options.useLoadjob !== false && manager && manager.job) {
                            that._applySearch(newNode, {
                                search: {
                                    type: 'inline',
                                    search: '| loadjob ' + manager.job.sid + ' ignore_running=t'
                                }
                            });
                        } else {
                            that._applySearch(newNode, settings);
                        }

                        that._applyOptions(newNode, settings);
                        that._applyTags(newNode, settings);
                    }

                    newNode.appendTo(row);
                });

                row.appendTo(dashboard);

            });

            if (options && options.indent) {
                this.formatXML(dashboard);
            }

            return xmlUtils.serialize(dashboard);
        },
        /**
         * Update the dashboard element with the settings specified
         * @param id - the element id (string)
         * @param settings - a settings object containing the update information
         * @param options - persistence options
         *
         * settings contains: {
         *      type: (String) the element type (one of "table", "chart", "single", "map", "list", "html")
         *      search: (Object) {
         *          type: (String) one of 'inline', 'saved' or 'pivot'
         *          search: (String) the search string (for inline)
         *          earliest_time: (String) the earliest_time of the inline search
         *          latest_time: (String) the latest_time of the inline search
         *          name: (String) name of the saved search
         *          ... TODO pivot search params
         *      }
         *      options: (Object) options to added (or replaced) to the element (<option name="$name$">$value$</option>)
         *      removeOptions: (Array) options to be removed from the xml element
         *      tags: (Object) tags to be added (or replaced) to the element (<$tag$>$value$</$tag$>)
         * },
         * options: {
         *      clearOptions: (Boolean) true to remove all options nodes before updating the XML element
         * }
         */
        updateElement: function(id, settings, options) {
            console.log('About to update item=%o with settings=%o', id, settings);
            var $xml = this.get$XML();
            var cur = this.getXMLNode(id, $xml);
            if (!cur) {
                throw new Error("Unable to find dashboard element with ID " + id);
            }
            var newNode = xmlUtils.$node('<' + settings.type + '/>');
            // Transfer allowed attributes to the new XML node
            _(['id', 'depends', 'rejects']).each(function(attr) {
                var val = $(cur).attr(attr);
                if (val) {
                    newNode.attr(attr, val);
                }
            });
            newNode.append($(cur).children());

            if (options && options.clearOptions) {
                newNode.find('option').remove();
                delete settings.options;
            }

            this._applyTitle(newNode, settings);
            if (settings.search && settings.search.type === 'global') {
                this._applyGlobalSearch($xml, settings);
            } else {
                this._applySearch(newNode, settings);
            }
            this._applyOptions(newNode, settings);
            this._applyTags(newNode, settings);

            $(cur).replaceWith(newNode);
            if (console.DEBUG_ENABLED) {
                this.formatXML($xml);
                console.log(xmlUtils.serialize($xml));
            }
            this.set$XML($xml);
            return this.save();
        },
        deleteElement: function(id) {
            // Create new item order without the element which is to be deleted
            var newStructure = {
                fieldset: this._structure.fieldset,
                rows: _(this._structure.rows).map(function(row) {
                    return _(row).map(function(panel) {
                        return {
                            inputs: panel.inputs,
                            elements: _(panel.elements).without(id)
                        };
                    });
                })
            };
            return this.updateStructure(newStructure);
        },
        addElement: function(id, settings) {
            var row = xmlUtils.$node('<row/>');
            var panel = xmlUtils.$node('<panel/>').appendTo(row);
            var newNode = xmlUtils.$node('<' + settings.type + '/>').appendTo(panel);
            this._structure.rows.push([
                {
                    inputs: [],
                    elements: [settings.id]
                }
            ]);
            this._applyTitle(newNode, settings);
            this._applySearch(newNode, settings);
            var $xml = this.get$XML();
            $xml.find(':eq(0)').append(row);
            if (console.DEBUG_ENABLED) {
                this.formatXML($xml);
                console.log(xmlUtils.serialize($xml));
            }
            this.set$XML($xml);
            return this.save();
        },
        _migrateViewType: function($xml, tagName) {
            var curRoot = $xml.find(':eq(0)');
            if (curRoot.prop('tagName') !== tagName) {
                $xml = $($.parseXML('<' + tagName + '/>'));
                var newRoot = $xml.find(':eq(0)'), cur = curRoot[0];
                _(cur.attributes).each(function(attr) {
                    newRoot.attr(attr.nodeName, attr.nodeValue);
                });
                while (cur.childNodes.length) {
                    newRoot.append(cur.childNodes[0]);
                }
                this.trigger('change:rootNodeName', this, tagName);
            }
            return $xml;
        },
        _applyOptions: function(newNode, settings) {
            if (settings.options) {
                _.each(settings.options, function(value, name) {
                    var curOption = newNode.find('option[name="' + name + '"]');
                    if (value === "" || value === null || value === void(0)) {
                        curOption.remove();
                    } else {
                        if (curOption.length) {
                            curOption.text(value);
                        } else {
                            xmlUtils.$node('<option/>').attr('name', name).text(value).appendTo(newNode);
                        }
                    }
                });
            }
            if (settings.removeOptions) {
                _(settings.removeOptions).each(function(name) {
                    newNode.find('option[name="' + name + '"]').remove();
                });
            }
        },
        _applyTags: function(newNode, settings) {
            if (settings.tags) {
                _.each(settings.tags, function(value, tag) {
                    newNode.find(tag).remove();
                    if ((_.isArray(value) && value.length) || value) {
                        xmlUtils.$node('<' + tag + '/>').text(value).appendTo(newNode);
                    }
                });
            }
        },
        _applyTitle: function(newNode, settings) {
            var titleNode = newNode.find('title');
            if (settings.title) {
                if (!titleNode.length) {
                    titleNode = xmlUtils.$node('<title/>').prependTo(newNode);
                }
                titleNode.text(settings.title);
            } else {
                titleNode.remove();
            }
        },
        _applySearch: function(newNode, settings) {
            if (settings.search) {
                // Clear current search info
                newNode.find('searchString,searchTemplate,searchName,searchPostProcess,pivotSearch,earliestTime,latestTime').remove();
                var titleNode = newNode.find('title');
                switch (settings.search.type) {
                    case 'inline':
                    case 'global': // Apply global search as an inline search for flattened XML
                        var searchNode = xmlUtils.$node('<searchString/>').text(settings.search.search);
                        if (titleNode.length) {
                            searchNode.insertAfter(titleNode);
                        } else {
                            searchNode.prependTo(newNode);
                        }
                        if (settings.search.latest_time !== undefined) {
                            xmlUtils.$node('<latestTime/>').text(settings.search.latest_time).insertAfter(searchNode);
                        }
                        if (settings.search.earliest_time !== undefined) {
                            xmlUtils.$node('<earliestTime/>').text(settings.search.earliest_time).insertAfter(searchNode);
                        }
                        break;
                    case 'postprocess':
                        var postSearchNode = xmlUtils.$node('<searchPostProcess/>').text(settings.search.search);
                        if (titleNode.length) {
                            postSearchNode.insertAfter(titleNode);
                        } else {
                            postSearchNode.prependTo(newNode);
                        }
                        break;
                    case 'saved':
                        var savedNode = xmlUtils.$node('<searchName/>').text(settings.search.name);
                        if (titleNode.length) {
                            savedNode.insertAfter(titleNode);
                        } else {
                            savedNode.prependTo(newNode);
                        }
                        break;
                    case 'pivot':
                        throw new Error("Pivot search not implemented!");
                    default:
                        throw new Error("Unknown search type: " + settings.search.type);
                }
            }
        },
        _applyGlobalSearch: function($xml, settings) {
            var root = $xml.find(':eq(0)');
            root.children('searchTemplate,earliestTime,latestTime').remove();
            var labelNode = root.children('label');
            var descNode = root.children('description');

            var searchNode = xmlUtils.$node('<searchTemplate/>').text(settings.search.search);
            if (descNode.length) {
                searchNode.insertAfter(descNode);
            } else if (labelNode.length) {
                searchNode.insertAfter(labelNode);
            } else {
                searchNode.prependTo(root);
            }
            if (settings.search.latest_time) {
                xmlUtils.$node('<latestTime/>').text(settings.search.latest_time).insertAfter(searchNode);
            }
            if (settings.search.earliest_time) {
                xmlUtils.$node('<earliestTime/>').text(settings.search.earliest_time).insertAfter(searchNode);
            }
        },
        captureDashboardStructure: function(structure) {
            var $xml = this.get$XML();
            this.validateItemOrder(this._getItemOrderMap(structure.rows, $xml));
            this.validateInputOrder(this._getInputOrderMap(structure, $xml));
            this._structure = structure;
        },
        getStructureMap: function(structure, $xml) {
            return _.extend({},
                this._getItemOrderMap(structure.rows, $xml),
                this._getInputOrderMap(structure, $xml)
            );
        },
        getXMLNode: function(id, $xml) {
            id = String(id);
            var node = $xml.find(':eq(0)>fieldset>#' + id + ',:eq(0)>row>#' + id + ',:eq(0)>row>panel>#' + id);
            if (node.length) {
                return node[0];
            } else {
                return this.getStructureMap(this._structure, $xml)[id];
            }
        },
        _getItemOrderMap: function(rowOrder, $xml) {
            var elements = _($xml.find('row').children()).map(function(el) {
                return $(el).is('panel') ? $(el).children(':not(input)').toArray() : el;
            });
            var makeObject = function(keys, values, hint) {
                if (keys.length !== values.length) {
                    throw new Error('Item order did not match XML structure (' + keys.length + ' keys, ' + values.length + ' nodes)');
                }
                return _.object(keys, values);
            };
            return makeObject(_(rowOrder).chain().flatten().pluck('elements').flatten().value(), _.flatten(elements));
        },
        validateItemOrder: function(itemOrderMap) {
            _(itemOrderMap).each(function(node, id) {
                var nid = $(node).attr(id);
                if (!(nid === undefined || nid === id)) {
                    throw new Error('Invalid Item order. Expected node with ID ' + id + '. Instead saw ' + nid);
                }
            });
        },
        inputSettingsToXML: function(settingsModel, inputNode) {
            var $input = inputNode ? $(inputNode) : xmlUtils.$node('<input/>');
            var settings = settingsModel.toJSON({tokens: true});
            $input.attr('type', settings.type);
            $input.attr('token', settings.token || null);
            $input.attr('searchWhenChanged', settings.searchWhenChanged != null ?
                String(GeneralUtils.normalizeBoolean(settings.searchWhenChanged)) : null);
            // set the label if it is different than the token name
            var label = $.trim(settings.label);
            if (label !== undefined && label !== settings.token) {
                xmlUtils.replaceOrPrepend({ node: xmlUtils.$node('<label/>').text(label), selector: 'label', container: $input });
            } else {
                $input.children('label').remove();
            }
            // Add static choices
            if (settings.choices && settings.choices.length) {
                var newChoices = _(settings.choices).map(function(choice) {
                    return xmlUtils.$node('<choice/>').attr('value', choice.value).text(choice.label);
                });
                xmlUtils.replaceOrAppend({ node: newChoices, container: $input, selector: 'choice' });
            } else {
                $input.children('choice').remove();
            }
            // Add the search
            this._applyPopulatingSearch(settings, $input);
            // default is a named node
            var defaultValue = settings['default'];
            if (defaultValue) {
                var defaultNode = xmlUtils.$node('<default/>');
                if (settings.type == 'time') {
                    xmlUtils.$node('<earliestTime></earliestTime>').text((defaultValue.earliest_time == null) ? '' : defaultValue.earliest_time).appendTo(defaultNode);
                    xmlUtils.$node('<latestTime></latestTime>').text((defaultValue.latest_time  == null) ? '' : defaultValue.latest_time).appendTo(defaultNode);
                } else {
                    defaultNode.text(defaultValue);
                }
                xmlUtils.replaceOrAppend({ node: defaultNode, selector: 'default', container: $input });
            } else {
                $input.children('default').remove();
            }
            _(['prefix', 'suffix', 'seed', 'valuePrefix', 'valueSuffix', 'delimiter']).each(function(option) {
                var val = settings[option];
                if (val) {
                    var node = xmlUtils.$node('<' + option + '/>').text(val);
                    xmlUtils.replaceOrAppend({ node: node, container: $input, selector: option });
                } else {
                    $input.children(option).remove();
                }
            });
            return $input;
        },
        _applyPopulatingSearch: function(settings, $input) {
            var $search;
            if (settings.searchType === 'saved') {
                if (!settings.searchName) {
                    $input.children('populatingSavedSearch,populatingSearch').remove();
                    return;
                }
                $search = xmlUtils.$node('<populatingSavedSearch/>');
                $search.text(settings.searchName);
            } else {
                if (!settings.search) {
                    $input.children('populatingSavedSearch,populatingSearch').remove();
                    return;
                }
                $search = xmlUtils.$node('<populatingSearch/>');
                $search.text(settings.search);
                $search.attr('earliest', settings['earliest_time']);
                $search.attr('latest', settings['latest_time']);
            }
            if (settings.labelField) {
                $search.attr('fieldForLabel', settings.labelField);
            }
            if (settings.valueField) {
                $search.attr('fieldForValue', settings.valueField);
            }
            xmlUtils.replaceOrAppend({ node: $search, container: $input, selector: 'populatingSavedSearch,populatingSearch'});
        },
        updateInputXML: function(id, settings, options) {
            console.log('About to update input=%o with settings=%o', id, settings.toJSON());
            var $xml = this.get$XML();
            var cur = this.getXMLNode(id, $xml);
            if (!cur) {
                throw new Error('Unable to find input with ID=', id);
            }
            cur = $(cur);
            var newNode = this.inputSettingsToXML(settings, cur);
            $(cur).replaceWith(newNode);
            if (console.DEBUG_ENABLED) {
                this.formatXML($xml);
                console.log(xmlUtils.serialize($xml));
            }
            this.set$XML($xml);
            return this.save();
        },
        isFormAutoRun: function() {
            var $xml = this.get$XML();
            var fieldset = $xml.find('fieldset');
            return GeneralUtils.normalizeBoolean(fieldset.attr('autoRun'));
        },
        updateFormSettings: function(options) {
            var $xml = this._migrateViewType(this.get$XML(), 'form');
            var fieldset = $xml.find('fieldset');
            if (!fieldset.length) {
                fieldset = this._createNewFieldset($xml);
            }
            if (options.hasOwnProperty('submitButton')) {
                fieldset.attr('submitButton', String(options.submitButton));
            }
            if (options.hasOwnProperty('autoRun')) {
                fieldset.attr('autoRun', String(options.autoRun));
            }
            this.set$XML($xml);
            return this.save();
        },
        _createNewFieldset: function($xml) {
            var $fieldset = xmlUtils.$node('<fieldset submitButton="false"></fieldset>');
            xmlUtils.inject({
                node: $fieldset,
                where: 'after',
                container: $xml.find(':eq(0)'),
                selectors: ['description', 'label'],
                fallback: 'prepend'
            });
            return $fieldset;
        },
        deleteInput: function(id) {
            var newStructure = {
                fieldset: _(this._structure.fieldset).without(id),
                rows: _(this._structure.rows).map(function(row) {
                    return _(row).map(function(panel) {
                        return {
                            inputs: _(panel.inputs).without(id),
                            elements: panel.elements
                        };
                    });
                })
            };
            return this.updateStructure(newStructure);
        },
        _getInputOrderMap: function(structure, $xml) {
            var map = {};
            var makeObject = function(keys, values, hint) {
                if (keys.length !== values.length) {
                    throw new Error('Input (' + hint + ') order did not match XML structure (' + keys.length + ' keys, ' + values.length + ' nodes)');
                }
                return _.object(keys, values);
            };
            _.extend(map, makeObject(structure.fieldset, $xml.find(':eq(0)>fieldset>input,:eq(0)>fieldset>html'), 'fieldset'));
            _.extend(map, makeObject(_(structure.rows).chain().flatten().pluck('inputs').flatten().value(), $xml.find(':eq(0)>row>panel>input'), 'panels'));
            return map;
        },
        validateInputOrder: function(inputOrderMap) {
            _(inputOrderMap).each(function(node, id) {
                var nid = $(node).attr(id);
                if (!(nid === undefined || nid === id)) {
                    throw new Error('Invalid Input order. Expected node with ID ' + id + '. Instead saw ' + nid);
                }
            });
        },
        updateInput: function(settingsModel) {
            return this.updateInputXML(settingsModel.get('name'), settingsModel, {});
        },
        addInput: function(settingsModel) {
            var $input = this.inputSettingsToXML(settingsModel);
            // Ensure that we are a form
            var $xml = this._migrateViewType(this.get$XML(), 'form');
            // append xml to fieldset
            var $fieldset = $xml.find(':eq(0)>fieldset');
            if (!$fieldset.length) {
                $fieldset = this._createNewFieldset($xml);
            }
            $fieldset.append($input);
            // ensure the mapping and order is updated
            this._structure.fieldset.push(settingsModel.get('id'));
            this.set$XML($xml);
            return this.save();
        },
        updateStructure: function(structure) {
            if (!this._structure) {
                console.warn('No captured dashboard structure');
                this.captureDashboardStructure(structure);
            }

            if (!_.isEqual(structure, this._structure)) {
                // Remove empty panels from structure
                structure.rows = _(structure.rows).map(function(row) {
                    return _(row).filter(function(panel) {
                        return panel.elements.length > 0 || panel.inputs.length > 0;
                    });
                });
                // Remove empty rows from structure
                structure.rows = _(structure.rows).filter(function(row) {
                    return row.length > 0;
                });

                var $node = xmlUtils.$node;
                var $xml = this.get$XML();
                var rootNode = $xml.find(':eq(0)');

                // Update order of dashboard elements
                var itemMap = this._getItemOrderMap(this._structure.rows, $xml);
                var inputMap = this._getInputOrderMap(this._structure, $xml);

                rootNode.children('row').detach();
                _(structure.rows).each(function(rowOrder) {
                    var row = $node('<row/>');
                    _(rowOrder).each(function(panelOrder) {
                        var panel = $node('<panel/>');
                        _(panelOrder.elements).each(function(elementId) {
                            var item = itemMap[elementId];
                            $(item).find('script').remove();
                            panel.append(item);
                        });
                        row.append(panel);
                    });
                    rootNode.append(row);
                });

                // Update inputs in fieldset
                var fieldset = rootNode.children('fieldset');
                if (!fieldset.length) {
                    fieldset = this._createNewFieldset($xml);
                }
                fieldset.children().detach();
                _(structure.fieldset).each(function(inputId) {
                    var inputNode = inputMap[inputId];
                    if (inputNode) {
                        $(inputNode).find('script').remove();
                        fieldset.append(inputNode);
                    } else {
                        console.warn('input not found', inputId);
                    }
                });
                // remove the fieldset if it is empty
                if (fieldset.children().length == 0) {
                    fieldset.remove();
                }

                // Update inputs within panels
                var rows = rootNode.children('row');
                _(structure.rows).each(function(rowOrder, rowIndex) {
                    var row = rows[rowIndex];
                    var panels = $(row).children('panel');
                    _(rowOrder).each(function(panelOrder, panelIndex) {
                        var panel = panels[panelIndex];
                        // Prepend inputs in reverse order to the panel
                        _(panelOrder.inputs).chain().clone().reverse().each(function(inputId) {
                            var inputNode = inputMap[inputId];
                            $(inputNode).find('script').remove();
                            $(panel).prepend(inputNode);
                        });
                    });
                });

                console.log('Updated dashboard structure', JSON.stringify(structure), $xml.find(':eq(0)')[0]);
                this._structure = structure;

                // Remove empty panels and rows
                rootNode.children('row>panel:empty').remove();
                rootNode.children('row:empty').remove();
                if (this.hasInputs()) {
                    $xml = this._migrateViewType($xml, 'form');
                } else {
                    $xml = this._migrateViewType($xml, 'dashboard');
                }
                this.set$XML($xml);
                console.log('Saving XML changes');
                return this.save();
            } else {
                console.log('no changes to input order');
                return $.Deferred().resolve();
            }
        },
        isEditable: function() {
            return this.isDashboard() || this.isForm();
        },
        getRootNodeName: function() {
            return (this.get$XML().find(':eq(0)').prop('nodeName') || '').toLowerCase();
        },
        hasInputs: function(){
            return this._structure.fieldset.length > 0 || _(this._structure.rows).any(function(row){
                return _(row).any(function(element){
                    return element.inputs && element.inputs.length > 0;
                });
            });
        }
    });

    return DashboardModel;
});
define('splunkjs/mvc/simplexml/dashboardurl',['underscore', 'models/shared/ClassicURL', 'util/console'], function(_, ClassicURLModel, console) {

    function _encodePrimitiveValue(value) {
        if (_.isObject(value)) {
            console.error('Encountered non-primitive value %o to be encoded as URL param.', value);
            throw new Error('Non-primitive values are not allowed in the query string');
        }
        return encodeURIComponent(value);
    }

    /**
     * Subclass of the ClassicURL model which adds support for encoding and decoding arrays of strings as a repeated
     * list of URL params.
     */
    var DashboardURLModel = ClassicURLModel.extend({
        encode: function(options) {
            var object = this.toJSON();
            var queryArray = [], encodedKey;
            options = _.extend({ preserveEmptyStrings: true, preserveNull: true }, options);
            _.each(object, function(value, key) {
                if (_.isUndefined(value) || (value === null && !options.preserveNull)
                    || (value === "" && !options.preserveEmptyStrings)) {
                    return;
                }
                encodedKey = encodeURIComponent(key);
                if (value === null) {
                    queryArray.push(encodedKey);
                } else if (_.isArray(value)) {
                    _.each(value, function(v) {
                        queryArray.push(encodedKey + '=' + _encodePrimitiveValue(v));
                    });
                } else {
                    queryArray.push(encodedKey + '=' + _encodePrimitiveValue(value));
                }
            });
            return queryArray.join('&');
        },
        decode: function(queryString) {
            queryString = (queryString || '').replace(/^[&\?#]|[&#]$/g, '');
            if (!queryString) {
                return {};
            }
            var output = {};
            _(queryString.split('&')).each(function(param) {
                var parts = param.split('=', 2);
                var key = decodeURIComponent(parts[0]);
                var value = parts.length > 1 ? decodeURIComponent(parts[1]) : null;
                if (output.hasOwnProperty(key)) {
                    var cur = output[key];
                    if (!_.isArray(cur)) {
                        cur = output[key] = [cur];
                    }
                    cur.push(value);
                } else {
                    output[key] = value;
                }
            });
            return output;
        }
    });

    // Return a singleton instance of the dashboard URL model
    return new DashboardURLModel();
});
define('splunkjs/mvc/simplexml/router',['require','underscore','backbone','./dashboardurl','util/console'],function(require) {
    var _ = require('underscore');
    var Backbone = require('backbone');
    var classicurl = require('./dashboardurl');
    var console = require('util/console');

    var DashboardRouter = Backbone.Router.extend({
        initialize: function(options) {
            this.model = options.model;
            this.app = options.app;
        },
        routes: {
            ':locale/app/:app/:page?*qs': 'view',
            ':locale/app/:app/:page': 'view',
            ':locale/app/:app/:page/?*qs': 'view',
            ':locale/app/:app/:page/': 'view',
            ':locale/app/:app/:page/edit?*qs': 'edit',
            ':locale/app/:app/:page/edit': 'edit',
            '*root/:locale/app/:app/:page?*qs': 'rootedView',
            '*root/:locale/app/:app/:page': 'rootedView',
            '*root/:locale/app/:app/:page/?*qs': 'rootedView',
            '*root/:locale/app/:app/:page/': 'rootedView',
            '*root/:locale/app/:app/:page/edit?*qs': 'rootedEdit',
            '*root/:locale/app/:app/:page/edit': 'rootedEdit',
            ':locale/manager/:app/:page?*qs': 'view',
            ':locale/manager/:app/:page': 'view',
            ':locale/manager/:app/:page/?*qs': 'view',
            ':locale/manager/:app/:page/': 'view',
            '*root/:locale/manager/:app/:page?*qs': 'rootedView',
            '*root/:locale/manager/:app/:page': 'rootedView',
            '*root/:locale/manager/:app/:page/?*qs': 'rootedView',
            '*root/:locale/manager/:app/:page/': 'rootedView',
            'dj/:app/:page/': 'splunkdj',
            'dj/:app/:page/?*qs': 'splunkdj',
            '*root/dj/:app/:page/': 'rootedSplunkdj',
            '*root/dj/:app/:page/?*qs': 'rootedSplunkdj'
        },
        view: function() {
            console.log('ROUTE: view');
            this.page.apply(this, arguments);
            this.model.set('edit', false);
        },
        edit: function() {
            console.log('ROUTE: edit');
            this.page.apply(this, arguments);
            this.model.set('edit', true);
        },
        rootedView: function(root) {
            this.app.set('root', root);
            this.view.apply(this, _.rest(arguments));
        },
        rootedEdit: function(root) {
            this.app.set('root', root);
            this.edit.apply(this, _.rest(arguments));
        },
        page: function(locale, app, page) {
            console.log('ROUTE: page(locale=%o, app=%o, page=%o)', locale, app, page);
            this.app.set({
                locale: locale,
                app: app,
                page: page
            });
            classicurl.fetch();
            if(classicurl.get('dialog') === 'schedulePDF') {
                this.model.set('dialog', classicurl.get('dialog'));
                classicurl.unset('dialog');
                this.updateUrl({ replace: true });
            }
        },
        splunkdj: function(app, page) {
            this.page('en-US', app, page);
        },
        rootedSplunkdj: function(root) {
            this.app.set('root', root);
            this.splunkdj.apply(this, _.rest(arguments));
        },
        updateUrl: function(options) {
            var parts = [ this.app.get('root') || '', this.app.get('locale'), 'app', this.app.get('app'), this.app.get('page') ];
            if (this.model.get('edit')) {
                parts.push('edit');
            }
            var url = [ parts.join('/') ], params = classicurl.encode();
            if (params.length) {
                url.push(params);
            }
            this.navigate(url.join('?'), _.extend({ replace: false }, options));
        }
    });
    return DashboardRouter;
});
define('splunkjs/mvc/simplexml/controller',['require','util/router_utils','backbone','jquery','underscore','../utils','util/pdf_utils','util/console','uri/route','../sharedmodels','util/splunkd_utils','splunk.util','../protections','collections/search/Reports','./dashboardmodel','./router','util/ajax_no_cache'],function(require) {
    var routerUtils = require('util/router_utils');
    var Backbone = require('backbone');
    var $ = require('jquery');
    var _ = require('underscore');
    var utils = require('../utils');
    var pdfUtils = require('util/pdf_utils');
    var console = require('util/console');
    var route = require('uri/route');
    var sharedModels = require('../sharedmodels');
    var splunkd_utils = require('util/splunkd_utils');
    var SplunkUtil = require('splunk.util');
    var protections = require('../protections');
    var Reports = require('collections/search/Reports');
    var DashboardModel = require('./dashboardmodel');
    var DashboardRouter = require('./router');
    require('util/ajax_no_cache');

    protections.enableCSRFProtection($);
    protections.enableUnauthorizationRedirection($, SplunkUtil.make_url('account/login'), '/account/logout');


    // Singleton dashboard controller that sets up the router and holds a model representing the state of the dashboard
    var DashboardController = function() {
        this.readyDfd = $.Deferred();
        var model = this.model = new Backbone.Model();
        var collection = this.collection = {};
        
        // Set up the shared models/collections
        var app = this.model.app = sharedModels.get("app");
        var appLocal = this.model.appLocal = sharedModels.get("appLocal");
        var user = this.model.user = sharedModels.get("user");
        var times = this.collection.times = sharedModels.get("times");
        
        this.router = new DashboardRouter({
            model: this.model,
            app: app
        });
        routerUtils.start_backbone_history();
        var view = this.model.view = new DashboardModel();
        this.model.view.fetch({
            url: route.splunkdNS(app.get('root'), app.get('locale'), app.get('owner'), app.get('app'), [view.url, app.get('page')].join('/'))
        }).done(this._onViewModelLoad.bind(this));
        pdfUtils.isPdfServiceAvailable().always(function(available) {
            model.set('pdf_available', available);
        });
        this._onViewModelLoadDfd = $.Deferred();
        this.model.on('change:edit', this.router.updateUrl, this.router);
        this.on('addInput', this.model.view.addInput, this.model.view);
    };
    _.extend(DashboardController.prototype, Backbone.Events, {
        _onViewModelLoad: function() {
            var model = this.model;
            model.set('editable', model.view.isEditable() && model.view.entry.acl.canWrite());
            if(model.view.isXML()) {
                model.set('label', this.model.view.getLabel());
                model.set('description', this.model.view.getDescription());
                model.on('change:label change:description', function() {
                    model.view.setLabelAndDescription(model.get('label'), model.get('description'));
                    model.view.save();
                });
                model.set('rootNodeName', model.view.getRootNodeName());
                model.view.on('change:rootNodeName', function(m, rootTagName){
                    model.set('rootNodeName', rootTagName);
                });
            }
            this._onViewModelLoadDfd.resolve(this.model.view);
        },
        onViewModelLoad: function(cb, scope) {
            this._onViewModelLoadDfd.done(cb.bind(scope || null));
        },
        getStateModel: function() {
            return this.model;
        },
        isEditMode: function() {
            return this.model.get('edit') === true;
        },
        onReady: function(callback) {
            var dashboardReady = $.when(this.readyDfd, this._onViewModelLoadDfd);
            if (callback) {
                dashboardReady.then(callback);
            }
            return dashboardReady;
        },
        ready: function() {
            this.readyDfd.resolve();
        },
        isReady: function(){
            return this.readyDfd.state() === "resolved";
        },
        fetchCollection: function() {
            this.reportsCollection = new Reports();
            this.reportsCollection.REPORTS_LIMIT = 150; 
            var appModel = this.model.app;
            var fetchParams = {
                data: {
                    count: this.reportsCollection.REPORTS_LIMIT, 
                    app: appModel.get('app'), 
                    owner: appModel.get('owner'), 
                    search: 'is_visible="1"'
                }
            };
            this.reportsCollection.initialFetchDfd = this.reportsCollection.fetch(fetchParams);
        }
    });

    var instance = new DashboardController();
    if(console.DEBUG_ENABLED) {
        window.Dashboard = instance;
    }
    return instance;
});

define('models/services/authorization/Role',
    [
         'models/SplunkDBase'
    ],
    function(SplunkDBaseModel) {
        return SplunkDBaseModel.extend({
            url: "authorization/roles",
            initialize: function() {
                SplunkDBaseModel.prototype.initialize.apply(this, arguments);
            }
        });
    }
);

define('collections/services/authorization/Roles',
    [
        'models/services/authorization/Role',
        'collections/SplunkDsBase',
        'models/shared/fetchdata/EAIFetchData'
    ],
    function(Model, BaseCollection, EAIFetchData) {
        return BaseCollection.extend({
            FREE_PAYLOAD: {
                "links": {
                    "create": "/services/authorization/roles/_new"
                },
                "generator": {
                },
                "entry": [
                    {
                        "name": "admin",
                        "links": {
                            "alternate": "/services/authorization/roles/admin",
                            "list": "/services/authorization/roles/admin",
                            "edit": "/services/authorization/roles/admin",
                            "remove": "/services/authorization/roles/admin"
                        },
                        "author": "system",
                        "acl": {
                            "app": "",
                            "can_list": true,
                            "can_write": true,
                            "modifiable": false,
                            "owner": "system",
                            "perms": {
                                "read": [
                                    "*"
                                ],
                                "write": [
                                    "*"
                                ]
                            },
                            "removable": false,
                            "sharing": "system"
                        },
                        "content": {
                            "capabilities": [],
                            "cumulativeRTSrchJobsQuota": 400,
                            "cumulativeSrchJobsQuota": 200,
                            "defaultApp": "",
                            "eai:acl": null,
                            "imported_capabilities": [],
                            "imported_roles": [],
                            "imported_rtSrchJobsQuota": 20,
                            "imported_srchDiskQuota": 500,
                            "imported_srchFilter": "",
                            "imported_srchIndexesAllowed": [
                                "*"
                            ],
                            "imported_srchIndexesDefault": [
                                "main"
                            ],
                            "imported_srchJobsQuota": 10,
                            "imported_srchTimeWin": -1,
                            "rtSrchJobsQuota": 100,
                            "srchDiskQuota": 10000,
                            "srchFilter": "*",
                            "srchIndexesAllowed": [
                                "*",
                                "_*"
                            ],
                            "srchIndexesDefault": [
                                "main",
                                "os"
                            ],
                            "srchJobsQuota": 50,
                            "srchTimeWin": 0
                        }
                    }
                ],
                "paging": {
                    "total": 1,
                    "perPage": 30,
                    "offset": 0
                },
                "messages": []
            },
            initialize: function(models, options) {
                options = options || {};
                options.fetchData = options.fetchData || new EAIFetchData({count:0});
                BaseCollection.prototype.initialize.call(this, models, options);
            },
            url: 'authorization/roles',
            model: Model
        });
    }
);

define('splunkjs/mvc/simplexml/mapper',['require','underscore','../mvc','backbone','util/console'],function(require){
    var _ = require('underscore'), mvc = require('../mvc'),
            Backbone = require('backbone'),
            console = require('util/console');

    var Mapper = function() {};
    _.extend(Mapper.prototype, {
        tagName: '#abstract',
        map: function() {
            // tbd in concrete implementation
        },
        getSearch: function(report, options) {
            var result; 
            if(report.entry.get('name')){
                console.log('Mapping Saved Search'); 
                result = {
                    type: 'saved',
                    name: report.entry.get('name', options)
                };
            }else{
                console.log('Mapping Inline Search'); 
                result = {
                    type: report.entry.content.get('display.general.search.type') || 'inline',
                    search: report.entry.content.get('search', options), 
                    earliest_time: report.entry.content.get('dispatch.earliest_time', options), 
                    latest_time: report.entry.content.get('dispatch.latest_time', options)
                };

                // When sending flattened XML to pdfgen, swap out postProcess with a full inline search
                if (options.flatten && result.type === 'postprocess') {
                    result.type = 'inline';
                    result.search = report.entry.content.get('fullSearch', options);
                }
            }
            return result; 
        },
        toXML: function(report, options) {
            options = options || { tokens: true };
            var result = {
                type: this.tagName,
                title: report.entry.content.get('display.general.title', options),
                search: this.getSearch(report, options),
                options: {},
                tags: {}
            };
            this.map(report.entry.content, result, options);
            if (result.options.fields){
                if(!result.tags.fields) {
                    result.tags.fields = result.options.fields;
                }
                result.options['fields'] = null;
            }
            return result;
        }
    });

    var MAPPERS = {};

    Mapper.register = function(type, cls) {
        MAPPERS[type] = cls;
    };

    Mapper.get = function(type) {
        var MapperClass = MAPPERS[type];
        if(!MapperClass) {
            throw new Error('No mapper for type ' + type);
        }
        return new MapperClass();
    };

    // copy the Backbone extend method
    Mapper.extend = Backbone.Model.extend;

    return Mapper;
});
define('models/dashboards/DashboardReport',['require','jquery','underscore','models/search/Report','splunkjs/mvc/simplexml/controller','splunkjs/mvc/simplexml/mapper','util/console','splunkjs/mvc/tokenawaremodel'],function(require){
    var $ = require('jquery');
    var _ = require('underscore');
    var Report = require('models/search/Report');
    var Dashboard = require('splunkjs/mvc/simplexml/controller');
    var Mapper = require('splunkjs/mvc/simplexml/mapper');
    var console = require('util/console');
    var TokenAwareModel = require('splunkjs/mvc/tokenawaremodel');

    var DashboardReport = Report.extend({
        initialize: function() {
            Report.prototype.initialize.apply(this, arguments);
        },
        saveXML: function(options) {
            var id = this.entry.content.get('display.general.id');
            console.log('[%o] Saving Panel Element XML...', id);
            return Dashboard.model.view.updateElement(id, this.mapToXML(), options);
        },
        mapToXML: function(options) {
            var type = this.entry.content.get('display.general.type'), sub = ['display', type, 'type'].join('.');
            if(this.entry.content.has(sub)) {
                type = [type, this.entry.content.get(sub)].join(':');
            }
            console.log('Looking up mapper for type ', type);
            var mapper = Mapper.get(type);
            console.log('Found mapper', mapper);
            return mapper.toXML(this, options);
        },
        deleteXML: function() {
            return Dashboard.model.view.deleteElement(this.entry.content.get('display.general.id'));
        },
        fetch: function(options){
            var that = this;
            that.entry.content._applyTokensByDefault = false;
            that._fetching = true;
            var dfd = Report.prototype.fetch.call(this, options);
            dfd.always(function(){
                that.entry.content._applyTokensByDefault = true;
                that._fetching = false;
            });
            return dfd;
        },
        setFromSplunkD: function(payload, options){
            options || (options = {});
            if(this._fetching && options.tokens === undefined) {
                options.tokens = false;
            }
            return Report.prototype.setFromSplunkD.call(this, payload, options);
        },
        parse: function() {
            this.entry.content._applyTokensByDefault = false;
            var ret = Report.prototype.parse.apply(this, arguments);
            this.entry.content._applyTokensByDefault = true;
            return ret;
        },
        defaults: {
            'display.visualizations.charting.axisY.scale': 'linear',
            'display.visualizations.charting.axisX.scale': 'linear',
            'display.visualizations.charting.axisX.minimumNumber': '',
            'display.visualizations.charting.axisX.maximumNumber': '',
            'display.visualizations.charting.axisY.minimumNumber': '',
            'display.visualizations.charting.axisY.maximumNumber': '',
            'display.visualizations.charting.axisTitleX.text': '',
            'display.visualizations.charting.axisTitleY.text': '',
            'display.visualizations.charting.axisLabelsX.majorUnit': '',
            'display.visualizations.charting.axisLabelsY.majorUnit': '',
            'display.visualizations.charting.legend.placement': 'right',
            'display.visualizations.charting.legend.labelStyle.overflowMode': 'ellipsisMiddle',
            'display.visualizations.charting.chart.stackMode':	'default',
            'display.visualizations.charting.chart.nullValueMode': 'zero',
            'display.visualizations.charting.chart.rangeValues': '["0","30","70","100"]',
            'display.visualizations.charting.chart.style': 'shiny',
            'display.visualizations.charting.gaugeColors': [0x84E900,0xFFE800,0xBF3030],
            'display.prefs.events.count': '10',
            'display.prefs.statistics.count': '10'
        },
        validation: {
            'display.visualizations.charting.axisX.minimumNumber': [
                {
                    pattern: 'number',
                    msg: 'Please enter a number',
                    required: false
                },
                {
                    fn: 'validateXAxisExtremes',
                    required: false
                }
            ],
            'display.visualizations.charting.axisX.maximumNumber': [
                {
                    pattern: 'number',
                    msg: 'Please enter a number',
                    required: false
                },
                {
                    fn: 'validateXAxisExtremes',
                    required: false
                }
            ],
            'display.visualizations.charting.axisY.minimumNumber': [
                {
                    pattern: 'number',
                    msg: 'Please enter a number',
                    required: false
                },
                {
                    fn: 'validateYAxisExtremes',
                    required: false
                }
            ],
            'display.visualizations.charting.axisY.maximumNumber': [
                {
                    pattern: 'number',
                    msg: 'Please enter a number',
                    required: false
                },
                {
                    fn: 'validateYAxisExtremes',
                    required: false
                }
            ],
            'display.visualizations.charting.axisY2.minimumNumber': [
                {
                    pattern: 'number',
                    msg: 'Please enter a number',
                    required: false
                },
                {
                    fn: 'validateYAxis2Extremes',
                    required: false
                }
            ],
            'display.visualizations.charting.axisY2.maximumNumber': [
                {
                    pattern: 'number',
                    msg: 'Please enter a number',
                    required: false
                },
                {
                    fn: 'validateYAxis2Extremes',
                    required: false
                }
            ],
            'display.visualizations.charting.axisLabelsX.majorUnit': {
                pattern: 'number',
                min: Number.MIN_VALUE,
                msg: 'Please enter a positive number',
                required: false
            },
            'display.visualizations.charting.axisLabelsY.majorUnit': {
                pattern: 'number',
                min: Number.MIN_VALUE,
                msg: 'Please enter a positive number',
                required: false
            },
            'display.visualizations.charting.axisLabelsY2.majorUnit': {
                pattern: 'number',
                min: Number.MIN_VALUE,
                msg: 'Please enter a positive number',
                required: false
            },
            'display.visualizations.charting.axisY.scale': {
                fn: 'validateYScaleAndStacking',
                required: false
            },
            'display.visualizations.charting.chart.stackMode': {
                fn: 'validateYScaleAndStacking',
                required: false
            },
            'display.visualizations.charting.chart.rangeValues': {
                fn: 'validateRangeValues',
                required: false
            },
            'display.prefs.events.count': {
                pattern: 'number',
                min: 1,
                msg: _('Rows Per Page must be a positive number.').t(),
                required: false
            },
            'display.prefs.statistics.count': {
                pattern: 'number',
                min: 1,
                msg: _('Rows Per Page must be a positive number.').t(),
                required: false
            }
        },

        validateXAxisExtremes: function(value, attr, computedState) {
            var min = parseFloat(computedState['display.visualizations.charting.axisX.minimumNumber']),
                max = parseFloat(computedState['display.visualizations.charting.axisX.maximumNumber']);
            if(!_.isNaN(min) && !_.isNaN(max) && max <= min) {
                return 'The minimum value must be less than maximum value';
            }
        },

        validateYAxisExtremes: function(value, attr, computedState) {
            var min = parseFloat(computedState['display.visualizations.charting.axisY.minimumNumber']),
                max = parseFloat(computedState['display.visualizations.charting.axisY.maximumNumber']);

            if(!_.isNaN(min) && !_.isNaN(max) && max <= min) {
                return 'The minimum value must be less than maximum value';
            }
        },

        validateYAxis2Extremes: function(value, attr, computedState) {
            var min = parseFloat(computedState['display.visualizations.charting.axisY2.minimumNumber']),
                max = parseFloat(computedState['display.visualizations.charting.axisY2.maximumNumber']);

            if(!_.isNaN(min) && !_.isNaN(max) && max <= min) {
                return 'The minimum value must be less than maximum value';
            }
        },

        validateYScaleAndStacking: function(value, attr, computedState) {
            var yAxisScale = computedState['display.visualizations.charting.axisY.scale'],
                stackMode = computedState['display.visualizations.charting.chart.stackMode'];

            if(yAxisScale === 'log' && stackMode !== 'default') {
                return 'Log scale and stacking cannot be enabled at the same time';
            }
        },

        validateRangeValues: function(value) {
            var ranges = _(value ? JSON.parse(value) : []).map(parseFloat);
            if(_(ranges).any(_.isNaN) || !value) {
                return 'All color ranges must be valid numbers';
            }

            var dedupedRanges = _.uniq(ranges),
                sortedRanges = $.extend([], ranges).sort(function(a, b) { return a - b; });

            if(!_.isEqual(ranges, dedupedRanges) || !_.isEqual(ranges, sortedRanges)) {
                return 'Color ranges must be entered from lowest to highest';
            }
        },

        attrToArray: function(attr) {
            var value = this.get(attr);
            if(!value){
                return [];
            }
            return _.values(JSON.parse(value));
        },

        rangesValuesToArray: function() {
            return this.attrToArray('display.visualizations.charting.chart.rangeValues');
        },

        gaugeColorsToArray: function() {
            return this.attrToArray('display.visualizations.charting.gaugeColors');
        }
    },{
        Entry: Report.Entry.extend({},{
            Content: TokenAwareModel.extend({
                applyTokensByDefault: true,
                clone: function(){
                    // When cloning the report content, return a plain model instead of a token-aware
                    return new Report.Entry.Content(this.toJSON());
                }
            })
        })
    });


    return DashboardReport;

});

define('util/moment/compactFromNow',['util/moment'], function(moment) {
    var round = Math.round;
    function formatCompactRelativeTime(milliseconds, withoutSuffix, lang) {
        var seconds = round(Math.abs(milliseconds) / 1000),
                minutes = round(seconds / 60),
                hours = round(minutes / 60),
                days = round(hours / 24),
                years = round(days / 365),
                args = (seconds < 45 && ['s', seconds]) ||
                        (minutes === 1 && ['m']) ||
                        (minutes < 45 && ['mm', minutes]) ||
                        (hours === 1 && ['h']) ||
                        (hours < 22 && ['hh', hours]) ||
                        (days === 1 && ['d']) ||
                        (days <= 25 && ['dd', days]) ||
                        (days <= 45 && ['M']) ||
                        (days < 345 && ['MM', round(days / 30)]) ||
                        (years === 1 && ['y']) || ['yy', years];

        var string = args[0], number = args[1] || 1, isFuture = milliseconds > 0,
                output = (lang._compactRelativeTime || {})[string];
        if(output === undefined) {
            return lang.relativeTime(number, !!withoutSuffix, string, isFuture);
        }
        return (typeof output === 'function') ?
                output(number, withoutSuffix, string, isFuture) :
                output.replace(/%d/i, number);
    }

    moment.duration.fn.humanizeCompact = function(withSuffix) {
        var diff = +this, out = formatCompactRelativeTime(diff, !withSuffix, this.lang());
        if(withSuffix) {
            out = this.lang().pastFuture(diff, out);
        }
        return this.lang().postformat(out);
    };

    moment.fn.compactFromNow = function(noSuffix) {
        return moment.duration(this.diff(moment())).lang(this.lang()._abbr).humanizeCompact(!noSuffix);
    };

    return moment;

});

define('splunkjs/mvc/refreshtimeindicatorview',['require','exports','module','./mvc','./basesplunkview','util/moment','util/moment/compactFromNow','underscore','splunk.util','util/general_utils'],function(require, exports, module) {
    var mvc = require('./mvc');
    var BaseSplunkView = require('./basesplunkview');
    var moment = require('util/moment');
    require('util/moment/compactFromNow');
    var _ = require('underscore');
    var SplunkUtil = require("splunk.util");
    var GeneralUtils = require("util/general_utils");

    var timerCallbacks = {}, globalRefreshTimer;

    function _runCallbacks() {
        _(timerCallbacks).each(function(cb){
            cb();
        });
    }

    function removeTimerCallback(name) {
        delete timerCallbacks[name];
        if(_.isEmpty(timerCallbacks)) {
            clearInterval(globalRefreshTimer);
            globalRefreshTimer = null;
        }
    }

    function registerTimerCallback(name, cb, scope) {
        if(timerCallbacks[name]) {
            removeTimerCallback(name);
        }
        timerCallbacks[name] = _.bind(cb, scope);
        if(!globalRefreshTimer) {
            globalRefreshTimer = setInterval(_runCallbacks, 1000);
        }
    }

    var RefreshTimeIndicatorView = BaseSplunkView.extend({
        moduleId: module.id,
        
        className: 'splunk-timeindicator',
        events: {
            "click a.refresh-btn": 'refresh'
        },
        configure: function() {
            // Silently rewrite the deprecated 'manager' setting if present
            if (this.options.manager) {
                this.options.managerid = this.options.manager;
            }

            this.options["refresh.time.visible"] = GeneralUtils.normalizeBoolean(this.options["refresh.time.visible"], {'default': true});

            if (SplunkUtil.isInt(this.options["refresh.auto.interval"])){
                this.options["refresh.auto.interval"] = parseInt(this.options["refresh.auto.interval"], 10);
            }
            else {
                this.options["refresh.auto.interval"] = 0;
            }

            BaseSplunkView.prototype.configure.apply(this, arguments);
        },
        initialize: function() {
            this.configure();
            this.bindToComponentSetting('managerid', this.onManagerChange, this);
            this.timer = _.uniqueId('timer_');
            this.listenTo(this.settings, 'change', this.updateContent);
        },
        onManagerChange: function(managers, manager) {
            if(this.manager) {
                this.manager.off(null, null, this);
            }
            if(!manager) {
                return;
            }
            this.manager = manager;
            this.manager.on("search:start", this.clear, this);
            this.manager.on("search:progress", this.onSearchProgress, this);
            this.manager.on("search:done", this.onSearchProgress, this);
            this.manager.on("search:fail", this.clear, this);
            this.manager.on("search:cancelled", this.clear, this);
            manager.replayLastSearchEvent(this);
        },
        clear: function() {
            removeTimerCallback(this.timer);
            this.$el.html('&nbsp;');
        },
        updateRefreshTime: function() {
            if(this.refreshTime) {
                if(moment().diff(this.refreshTime) >= 10000) {
                    this.$('.time-freshness').text(this.refreshTime.compactFromNow()).show();
                    this.$('.time-freshness').attr('title', _("Last refresh: ").t() + this.refreshTime.format('LLL'));
                    this.$el.show();
                }
            }
        },
        onSearchProgress: function(properties) {
            this.lastContent = (properties || {}).content || {};
            this.updateContent();
        },
        updateContent: function() {
            var content = this.lastContent;
            if (this.autoRefresh){
                clearInterval(this.autoRefresh);
                this.autoRefresh = null;
            }
            if(content.dispatchState === 'FAILED') {
                this.clear();
            } else if(content.dispatchState === 'PARSING' || content.dispatchState === 'QUEUED') {
                this.clear();
            } else if(content.dispatchState === 'RUNNING') {
                if(content.isRealTimeSearch) {
                    removeTimerCallback(this.timer);
                    this.$el.text(_("Real-time").t());
                } else {
                    this.clear();
                }
            } else if(content.dispatchState === 'DONE') {
                this.$el.hide();
                this.refreshTime = moment(this.manager.job.published());
                this.clear();
                if (this.refreshTime && this.settings.get('refresh.time.visible')){
                    this.$el.append($('<span class="time-freshness"/>'));
                    this.updateRefreshTime();
                    registerTimerCallback(this.timer, this.updateRefreshTime, this);
                }
                if (this.settings.get('refresh.auto.interval')){
                    this.autoRefresh = setTimeout(_.bind(this.refresh, this), 1000 * this.settings.get('refresh.auto.interval'));
                }
            }
        },
        refresh: function(event){
            if (event){
                event.preventDefault();
            }
            this.manager.startSearch();
        },
        render: function() {
            this.$el.html('&nbsp;');
            return this;
        },
        remove: function() {
            removeTimerCallback(this.timer);
            if (this.autoRefresh){
                clearInterval(this.autoRefresh);
                this.autoRefresh = null;
            }
            this.onManagerChange(null, null);
            return BaseSplunkView.prototype.remove.call(this);
        }
    });

    return RefreshTimeIndicatorView;
});

define('splunkjs/mvc/resultslinkview',['require','exports','module','jquery','underscore','splunk.util','splunk.window','models/search/Job','uri/route','views/shared/jobstatus/buttons/ExportResultsDialog','./basesplunkview','./mvc','models/dashboards/DashboardReport','./savedsearchmanager','./utils','./sharedmodels','splunk.util','./postprocessmanager'],function(require, exports, module) {

    var $ = require("jquery");
    var _ = require("underscore");
    var SplunkUtil = require("splunk.util");
    var SplunkWindow = require("splunk.window");
    var SearchJobModel = require("models/search/Job");
    var Route = require("uri/route");
    var ExportResultsDialog = require("views/shared/jobstatus/buttons/ExportResultsDialog");
    var BaseSplunkView = require("./basesplunkview");
    var mvc = require("./mvc");
    var ReportModel = require('models/dashboards/DashboardReport');
    var SavedSearchManager = require("./savedsearchmanager");
    var Utils = require("./utils");
    var sharedModels = require('./sharedmodels');
    var util = require('splunk.util');
    var PostProcessSearchManager = require('./postprocessmanager');

    /**
     * "View results" link for dashboard panels
     * Options:
     *  - link.visible: the default visibility of each button (defaults to true)
     *  - link.openSearch.visible: whether the openSearch button is visible (defaults to link.visible)
     *  - link.openSearch.text: the label for the Open in Search button (defaults to "Open in Search")
     *  - link.openSearch.viewTarget: the target view to open the search in (defaults to "search")
     *  - link.openSearch.search: instead of passing the SID over to the target view use this search string to start a new search
     *  - link.openSearch.searchEarliestTime: the earliest_time for the new search (defaults to earliest_time of the manager's search)
     *  - link.openSearch.searchLatestTime: the latest_time for the new search (defaults to latest_time of the manager's search)
     *  - link.exportResults.visible: whether the exportResults button is visible (defaults to link.visible)
     *  - link.inspectSearch.visible: whether the inspectSearch button is visible (defaults to link.visible)
     *  - refresh.link.visible: whether the refreshButton is visible (defaults to link.visible)
     */
    var ResultsLinkView = BaseSplunkView.extend({
        moduleId: module.id,
        events: {
            "click a.refresh-button": 'refresh'
        },
        configure: function() {
            // Silently rewrite the deprecated 'manager' setting if present
            if (this.options.manager) {
                this.options.managerid = this.options.manager;
            }

            BaseSplunkView.prototype.configure.apply(this, arguments);
        },
        initialize: function() {
            this.configure();
            
            this.bindToComponentSetting('managerid', this.onManagerChange, this);

            this.searchJobModel = new SearchJobModel();
            this.applicationModel = sharedModels.get("app");

            // If this component is not part of an element, it will not 
            // have a ReportModel and needs to create one.
            this.model = this.model || new ReportModel();
            
            //so search/pivot icons re-render whenever panel switches between search/pivot
            this.listenTo(this.model.entry.content, 'change:search', _.bind(this.render, this)); 
        },
        onManagerChange: function(managers, manager) {
            if (this.manager) {
                this.manager.off(null, null, this);
                this.manager = null;
            }

            if (!manager) {
                return;
            }

            this.manager = manager;
            this.listenTo(manager, "search:start", this.onSearchStart);
            this.listenTo(manager, "search:done", this.onSearchDone);

            if (this.manager.job) {
                this.onSearchStart(this.manager.job);
            }
            
            this.manager.replayLastSearchEvent(this);
        },

        onSearchStart: function(jobInfo) {
            this.searchJobModel.set("id", jobInfo.sid);

            if (this.$pivotButton) {
                this.$pivotButton.off("click").on("click", this.openPivot.bind(this)).show(); 
            }
            if (this.$searchButton) {
                this.$searchButton.off("click").on("click", this.openSearch.bind(this)).show();
            }
            if (this.$refreshButton) {
                this.$refreshButton.show();
            }
            if (this.$exportButton) {
                if (this.manager instanceof PostProcessSearchManager) {
                    // Disable Export for post process
                    this.$exportButton.tooltip("destroy");
                    this.$exportButton.attr("title", _("Export - You cannot export results for post-process jobs.").t());
                    this.$exportButton.tooltip({ animation: false, container: "body" });
                    this.$exportButton.addClass("disabled");
                    this.$exportButton.off("click").on("click", function(e) { e.preventDefault(); }).show();
                } else {
                    this.$exportButton.addClass("disabled");
                    this.$exportButton.off("click").on("click", function(e) { e.preventDefault(); }).show();
                }
            }
            if (this.$inspectButton) {
                this.$inspectButton.off("click").on("click", this.inspectSearch.bind(this)).show();
            }
        },

        onSearchDone: function(properties) {
            this.searchJobModel.setFromSplunkD({ entry: [this.manager.job.state()] }); 
            if (this.$exportButton) {
                    if (this.manager instanceof PostProcessSearchManager) {
                        // Disable Export for post process
                        this.$exportButton.tooltip("destroy");
                        this.$exportButton.attr("title", _("Export - You cannot export results for post-process jobs.").t());
                        this.$exportButton.tooltip({ animation: false, container: "body" });
                        this.$exportButton.addClass("disabled");
                        this.$exportButton.off("click").on("click", function(e) { e.preventDefault(); }).show();
                    } else {
                        this.$exportButton.tooltip("destroy");
                        this.$exportButton.attr("title", _("Export").t());
                        this.$exportButton.tooltip({ animation: false, container: "body" });
                        this.$exportButton.removeClass("disabled");
                        this.$exportButton.off("click").on("click", this.exportResults.bind(this)).show();
                    }
            }
        },

        openSearch: function(e) {
            if (e) {
                e.preventDefault();
            }

            var options = this.options;
            var manager = this.manager;

            var params;
            var earliest;
            var latest;
            if (options["link.openSearch.search"]) {
                params = {
                    q: options["link.openSearch.search"]
                };
                earliest = options["link.openSearch.searchEarliestTime"];
                if (!earliest && manager.job.properties().earliestTime){
                    earliest = util.getEpochTimeFromISO(manager.job.properties().earliestTime);
                }
                else {
                    earliest = manager.settings.get("earliest_time");
                }
                if (earliest != null) {
                    params.earliest = earliest;
                }
                latest = options["link.openSearch.searchLatestTime"];
                if (!latest && manager.job.properties().latestTime){
                    latest = util.getEpochTimeFromISO(manager.job.properties().latestTime);
                }
                else {
                    latest = manager.settings.get("latest_time");
                }
                if (latest != null) {
                    params.latest = latest;
                }
            } else if (!options["link.openSearch.viewTarget"]) {
                params = {
                    sid: this.searchJobModel.get("id"),
                    q: manager.settings.resolve()
                };
                if (manager instanceof SavedSearchManager){
                    params['s'] = manager.get('searchname');
                }
                earliest = manager.settings.get("earliest_time");
                if (earliest != null) {
                    params.earliest = earliest;
                }
                latest = manager.settings.get("latest_time");
                if (latest != null) {
                    params.latest = latest;
                }
            } else {
                params = {
                    sid: this.searchJobModel.get("id")
                };
            }

            var pageInfo = Utils.getPageInfo();
            var url = Route.page(pageInfo.root, pageInfo.locale, pageInfo.app, options["link.openSearch.viewTarget"] || "search", { data: params });

            window.open(url, "_blank");
        },

        exportResults: function(e) {
            if (e) {
                e.preventDefault();
            }

            var exportDialog = new ExportResultsDialog({
                model: {
                    searchJob: this.searchJobModel,
                    application: this.applicationModel, 
                    report: this.model
                }, 
                usePanelType: true
            });

            exportDialog.render().appendTo($("body"));
            exportDialog.show();
        },

        inspectSearch: function(e) {
            if (e) {
                e.preventDefault();
            }

            var pageInfo = Utils.getPageInfo();
            var url = Route.jobInspector(pageInfo.root, pageInfo.locale, pageInfo.app, this.searchJobModel.get("id"));

            SplunkWindow.open(url, "splunk_job_inspector", { width: 870, height: 560, menubar: false });
        },

        openPivot: function(e){
            if (e) {
                e.preventDefault();
            }
            var pageInfo = Utils.getPageInfo(), params, url;
            if(this.model.has('id')){
                //saved pivot 
                //URI API: app/search/pivot?s=<reportId>
                //example id: "/servicesNS/admin/simplexml/saved/searches/Report%20Pivot2"
                var id = this.model.get('id');
                params = { s : id };
                if(this.model.entry.content.has('dispatch.earliest_time')) {
                    params.earliest = this.model.entry.content.get('dispatch.earliest_time');
                    params.latedst = this.model.entry.content.get('dispatch.latest_time');
                }
                url = Route.pivot(pageInfo.root, pageInfo.locale, pageInfo.app, { data: params });
                Utils.redirect(url, true);
            }else{
                //inline pivot 
                //URI API: app/search/pivot?q=<search string with pivot command>
                //example search: "| pivot Debugger RootObject_1 count(RootObject_1) AS "Count of RootObject_1" | stats count"
                var search = this.model.entry.content.get('search');
                params = { q : search };
                if(this.model.entry.content.has('dispatch.earliest_time')) {
                    params.earliest = this.model.entry.content.get('dispatch.earliest_time');
                    params.latest = this.model.entry.content.get('dispatch.latest_time');
                }
                url = Route.pivot(pageInfo.root, pageInfo.locale, pageInfo.app, { data: params });
                Utils.redirect(url, true);
            }
        },

        render: function() {
            var template; 
            if(this.model.isPivotReport()){
                template = _.template(this.pivotTemplate);
            }else{
                template = _.template(this.template);
            }

            this.$el.html(template({ options: this.options }));

            if (this.resolveBooleanOptions("link.openPivot.visible", "link.visible", true)) {
                this.$pivotButton = this.$(".pivot-button").hide();
            } else {
                this.$(".pivot-button").remove();
            }

            if (this.resolveBooleanOptions("link.openSearch.visible", "link.visible", true)) {
                this.$searchButton = this.$(".search-button").hide();
            } else {
                this.$(".search-button").remove();
            }

            if (this.resolveBooleanOptions("link.exportResults.visible", "link.visible", true)) {
                this.$exportButton = this.$(".export-button").hide();
            } else {
                this.$(".export-button").remove();
            }

            if (this.resolveBooleanOptions("link.inspectSearch.visible", "link.visible", true)) {
                this.$inspectButton = this.$(".inspect-button").hide();
            } else {
                this.$(".inspect-button").remove();
            }

            if (this.resolveBooleanOptions("refresh.link.visible", "link.visible", true)) {
                this.$refreshButton = this.$(".refresh-button").hide();
            } else {
                this.$(".refresh-button").remove();
            }

            if (this.$searchButton || this.$exportButton || this.$inspectButton || this.$refreshButton) {
                this.$el.show();
            } else {
                this.$el.hide();
            }

            this.$("> a").tooltip({ animation: false, container: "body" });

            return this;
        },

        resolveBooleanOptions: function(/*optionName1, optionName2, ..., defaultValue*/) {
            var options = this.options;
            var value;
            for (var i = 0, l = arguments.length - 1; i < l; i++) {
                value = options[arguments[i]];
                if (value != null) {
                    return SplunkUtil.normalizeBoolean(value);
                }
            }
            return SplunkUtil.normalizeBoolean(arguments[arguments.length - 1]);
        },

        refresh: function(event){
            if (event){
                event.preventDefault();
            }
            this.manager.startSearch('refresh');
        },

        template: '\
            <a href="#search" class="search-button btn-pill" title="<%- options[\'link.openSearch.text\'] || _(\'Open in Search\').t() %>">\
                <i class="icon-search"></i>\
                <span class="hide-text"><%- options[\'link.openSearch.text\'] || _("Open in Search").t() %></span>\
            </a><a href="#export" class="export-button btn-pill" title="<%- _(\'Export - You can only export results for completed jobs.\').t() %>">\
                <i class="icon-export"></i>\
                <span class="hide-text"><%- _("Export").t() %></span>\
            </a><a href="#inspect" class="inspect-button btn-pill" title="<%- _(\'Inspect\').t() %>">\
                <i class="icon-info"></i>\
                <span class="hide-text"><%- _("Inspect").t() %></span>\
            </a><a href="#refresh" class="refresh-button btn-pill" title="<%- _(\'Refresh\').t() %>">\
                <i class="icon-rotate-counter"></i>\
                <span class="hide-text"><%- _("Refresh").t() %></span>\
            </a>\
        ', 

        pivotTemplate: '\
            <a href="#pivot" class="pivot-button btn-pill" title="<%- _(\'Open in Pivot\').t() %>">\
                <i class="icon-pivot"></i>\
                <span class="hide-text"><%- _("Open in Pivot").t() %></span>\
            </a><a href="#export" class="export-button btn-pill" title="<%- _(\'Export\').t() %>">\
                <i class="icon-export"></i>\
                <span class="hide-text"><%- _("Export").t() %></span>\
            </a><a href="#inspect" class="inspect-button btn-pill" title="<%- _(\'Inspect\').t() %>">\
                <i class="icon-info"></i>\
                <span class="hide-text"><%- _("Inspect").t() %></span>\
            </a><a href="#refresh" class="refresh-button btn-pill" title="<%- _(\'Refresh\').t() %>">\
                <i class="icon-rotate-counter"></i>\
                <span class="hide-text"><%- _("Refresh").t() %></span>\
            </a>\
        '
    });
    
    return ResultsLinkView;
});

/**
 * @author sfishel
 *
 * A custom sub-class of SyntheticRadio for toggling drilldown for a chart
 *
 * Manages the fact that enabling/disabling drilldown actually affects two charting attributes
 */

 define('views/shared/vizcontrols/custom_controls/DrilldownRadio',[
            'underscore',
            'jquery',
            'module',
            'views/shared/controls/SyntheticRadioControl',
            'splunk.util'
        ],
        function(
            _,
            $,
            module,
            SyntheticRadioControl,
            splunkUtils
        ) {

    return SyntheticRadioControl.extend({

        moduleId: module.id,

        initialize: function() {
            $.extend(this.options, {
                modelAttribute: 'display.visualizations.charting.drilldown',
                items: [
                    {
                        label: _("Yes").t(),
                        value: 'all'
                    },
                    {
                        label: _("No").t(),
                        value: 'none'
                    }
                ],
                save: false,
                elastic: true
            });
            SyntheticRadioControl.prototype.initialize.call(this, this.options);
        }

    });

});

define('views/shared/vizcontrols/custom_controls/DrilldownRadioGroup',[
            'underscore',
            'module',
            'views/shared/controls/ControlGroup',
            './DrilldownRadio'
        ],
        function(
            _,
            module,
            ControlGroup,
            DrilldownRadio
        ) {

    return ControlGroup.extend({

        moduleId: module.id,

        initialize: function() {
            var control = new DrilldownRadio({ model: this.model });
            this.options.label = _("Drilldown").t();
            this.options.controls = [control];
            ControlGroup.prototype.initialize.call(this, this.options);
        }

    });

});

define('views/shared/vizcontrols/custom_controls/StackModeControlGroup',[
            'underscore',
            'module',
            'views/shared/controls/ControlGroup'
        ],
        function(
            _,
            module,
            ControlGroup
        ) {

    return ControlGroup.extend({

        moduleId: module.id,

        initialize: function() {
            var items = [
                {
                    value: 'default',
                    icon: 'bar-beside',
                    tooltip: _("not stacked").t()
                },
                {
                    value: 'stacked',
                    icon: 'bar-stacked',
                    tooltip: _("stacked").t()
                }
            ];
            if(this.options.allowStacked100 !== false) {
                items.push({
                    value: 'stacked100',
                    icon: 'bar-stacked-100',
                    tooltip: _("stacked 100%").t()
                });
            }
            this.options.label = _("Stack Mode").t();
            this.options.controlType = 'SyntheticRadio';
            this.options.controlOptions = {
                modelAttribute: 'display.visualizations.charting.chart.stackMode',
                model: this.model,
                className: 'btn-group',
                items: items
            };
            ControlGroup.prototype.initialize.call(this, this.options);
        }

    });

});

define('views/shared/vizcontrols/custom_controls/NullValueModeControlGroup',[
            'underscore',
            'module',
            'views/shared/controls/ControlGroup'
        ],
        function(
            _,
            module,
            ControlGroup
        ) {

    return ControlGroup.extend({

        moduleId: module.id,

        initialize: function() {

            this.options.label = _("Null Values").t();
            this.options.controlType = 'SyntheticRadio';
            this.options.controlOptions = {
                modelAttribute: 'display.visualizations.charting.chart.nullValueMode',
                model: this.model,
                className: 'btn-group',
                items: [
                    {
                        value: 'gaps',
                        icon: 'missing-value-skipped',
                        tooltip: _("Gaps").t()
                    },
                    {
                        value: 'zero',
                        icon: 'missing-value-zero',
                        tooltip: _("Zero").t()
                    },
                    {
                        value: 'connect',
                        icon: 'missing-value-join',
                        tooltip: _("Connect").t()
                    }
                ]
            };
            ControlGroup.prototype.initialize.call(this, this.options);
        }

    });

});

define('views/shared/vizcontrols/custom_controls/GaugeStyleControlGroup',[
            'underscore',
            'module',
            'views/shared/controls/ControlGroup'
        ],
        function(
            _,
            module,
            ControlGroup
        ) {

    return ControlGroup.extend({

        moduleId: module.id,

        initialize: function() {
            this.options.label = _("Style").t();
            this.options.controlType = 'SyntheticRadio';
            this.options.controlOptions = {
                modelAttribute: 'display.visualizations.charting.chart.style',
                model: this.model,
                items: [
                    {
                        label: _("Minimal").t(),
                        value: 'minimal'
                    },
                    {
                        label: _("Shiny").t(),
                        value: 'shiny'
                    }
                ]
            };
            ControlGroup.prototype.initialize.call(this, this.options);
        }

    });

});

define('views/shared/vizcontrols/custom_controls/SingleValueBeforeLabelControlGroup',[
            'underscore',
            'module',
            'views/shared/controls/ControlGroup'
        ],
        function(
            _,
            module,
            ControlGroup
        ) {

    return ControlGroup.extend({

        moduleId: module.id,

        initialize: function() {
            this.options.label = _("Before Label").t();
            this.options.controlType = 'Text';
            this.options.controlOptions = {
                modelAttribute: 'display.visualizations.singlevalue.beforeLabel',
                model: this.model,
                placeholder: _("optional").t(),
                inputClassName: 'input-medium'
            };
            ControlGroup.prototype.initialize.call(this, this.options);
        }

    });

});

define('views/shared/vizcontrols/custom_controls/SingleValueAfterLabelControlGroup',[
            'underscore',
            'module',
            'views/shared/controls/ControlGroup'
        ],
        function(
            _,
            module,
            ControlGroup
        ) {

    return ControlGroup.extend({

        moduleId: module.id,

        initialize: function() {
            this.options.label = _("After Label").t();
            this.options.controlType = 'Text';
            this.options.controlOptions = {
                modelAttribute: 'display.visualizations.singlevalue.afterLabel',
                model: this.model,
                placeholder: _("optional").t(),
                inputClassName: 'input-medium'
            };
            ControlGroup.prototype.initialize.call(this, this.options);
        }

    });

});

define('views/shared/vizcontrols/custom_controls/SingleValueUnderLabelControlGroup',[
            'underscore',
            'module',
            'views/shared/controls/ControlGroup'
        ],
        function(
            _,
            module,
            ControlGroup
        ) {

    return ControlGroup.extend({

        moduleId: module.id,

        initialize: function() {
            this.options.label = _("Under Label").t();
            this.options.controlType = 'Text';
            this.options.controlOptions = {
                modelAttribute: 'display.visualizations.singlevalue.underLabel',
                model: this.model,
                placeholder: _("optional").t(),
                inputClassName: 'input-medium'
            };
            ControlGroup.prototype.initialize.call(this, this.options);
        }

    });

});

define('views/shared/vizcontrols/custom_controls/MultiSeriesRadio',[
           'underscore',
           'jquery',
           'module',
           'views/shared/controls/ControlGroup'
        ],
        function(
            _,
            $,
            module,
            ControlGroup
        ) {

    return ControlGroup.extend({
        moduleId: module.id,
        initialize: function() {
            this.options.label = _("Multi-series Mode").t();
            this.options.controlType = 'SyntheticRadio';
            this.options.controlClass = 'controls-halfblock';
            this.options.controlOptions = {
                modelAttribute: 'display.visualizations.charting.layout.splitSeries',
                model: this.model,
                items: [
                    { label: _('Yes').t(), value: '1' },
                    { label: _('No').t(), value: '0' }
                ],
                save: false,
                elastic: true
            };
            ControlGroup.prototype.initialize.call(this, this.options);
        }

    });

});

 define('views/shared/vizcontrols/custom_controls/MapDrilldownControlGroup',[
            'underscore',
            'jquery',
            'module',
            'views/shared/controls/ControlGroup'
        ],
        function(
            _,
            $,
            module,
            ControlGroup
        ) {

    return ControlGroup.extend({
        moduleId: module.id,
        initialize: function() {
            this.options.label = _("Drilldown").t();
            this.options.controlType = 'SyntheticRadio';
            this.options.controlClass = 'controls-halfblock';
            this.options.controlOptions = {
                modelAttribute: 'display.visualizations.mapping.drilldown',
                model: this.model,
                items: [
                    { label: _('Yes').t(), value: 'all' },
                    { label: _('No').t(), value: 'none' }
                ],
                elastic: true
            };
            ControlGroup.prototype.initialize.call(this, this.options);
        }

    });

});

define('views/shared/vizcontrols/components/General',
    [
        'underscore',
        'jquery',
        'module',
        'views/Base',
        'views/shared/controls/ControlGroup',
        'views/shared/vizcontrols/custom_controls/DrilldownRadioGroup',
        'views/shared/vizcontrols/custom_controls/StackModeControlGroup',
        'views/shared/vizcontrols/custom_controls/NullValueModeControlGroup',
        'views/shared/vizcontrols/custom_controls/GaugeStyleControlGroup',
        'views/shared/vizcontrols/custom_controls/SingleValueBeforeLabelControlGroup',
        'views/shared/vizcontrols/custom_controls/SingleValueAfterLabelControlGroup',
        'views/shared/vizcontrols/custom_controls/SingleValueUnderLabelControlGroup',
        'views/shared/vizcontrols/custom_controls/MultiSeriesRadio',
        'views/shared/vizcontrols/custom_controls/MapDrilldownControlGroup'

    ],
    function(
        _, 
        $,
        module, 
        Base, 
        ControlGroup,
        DrilldownRadioGroup,
        StackModeControlGroup,
        NullValueModeControlGroup,
        GaugeStyleControlGroup,
        SingleValueBeforeLabelControlGroup,
        SingleValueAfterLabelControlGroup,
        SingleValueUnderLabelControlGroup,
        MultiSeriesRadio,
        MapDrilldownControlGroup
    ){
        return Base.extend({
            moduleId: module.id,
            className: 'form form-horizontal',
            vizToGeneralComponents: {
                line: ['nullValue', 'multiseries', 'drilldown'],
                area: ['stack', 'nullValue', 'multiseries', 'drilldown'],
                column: ['stack', 'multiseries', 'drilldown'],
                bar: ['stack','multiseries', 'drilldown'],
                pie: ['drilldown'],
                scatter: ['drilldown'], 
                radialGauge: ['style'],
                fillerGauge: ['style'],
                markerGauge: ['style'],
                single: ['before', 'after', 'under'],
                mapping: ['mapDrilldown']
            },
            initialize: function(options) {
                Base.prototype.initialize.apply(this, arguments);
                var controls = this.vizToGeneralComponents[this.model.get('viz_type')];
                if(_.indexOf(controls, 'stack')>-1)
                    this.children.stackMode = new StackModeControlGroup({
                        model: this.model,
                        controlClass: 'controls-thirdblock'
                    });
                if(_.indexOf(controls, 'nullValue')>-1)
                    this.children.nullValueMode = new NullValueModeControlGroup({
                        model: this.model,
                        controlClass: 'controls-thirdblock'
                    });
                if(_.indexOf(controls, 'multiseries')>-1)
                    this.children.multiSeries = new MultiSeriesRadio({ model: this.model });
                if(_.indexOf(controls, 'drilldown')>-1)
                    this.children.drilldown = new DrilldownRadioGroup({
                        model: this.model,
                        controlClass: 'controls-halfblock'
                    });
                if(_.indexOf(controls, 'style')>-1)
                    this.children.gaugeStyle = new GaugeStyleControlGroup({
                        model: this.model,
                        controlClass: 'controls-halfblock'
                    });
                if(_.indexOf(controls, 'before')>-1)
                    this.children.beforeLabel = new SingleValueBeforeLabelControlGroup({
                        model: this.model,
                        controlClass: 'controls-block'
                    });
                if(_.indexOf(controls, 'after')>-1)
                    this.children.afterLabel = new SingleValueAfterLabelControlGroup({
                        model: this.model,
                        controlClass: 'controls-block'
                    });
                if(_.indexOf(controls, 'under')>-1)
                    this.children.underLabel = new  SingleValueUnderLabelControlGroup({
                        model: this.model,
                        controlClass: 'controls-block'
                    });
                if(_.indexOf(controls, 'mapDrilldown')>-1)
                    this.children.mapDrilldown = new MapDrilldownControlGroup({
                        model: this.model
                    });
            },
            render: function() {
                this.children.stackMode && this.children.stackMode.render().appendTo(this.$el);
                this.children.nullValueMode && this.children.nullValueMode.render().appendTo(this.$el);
                this.children.multiSeries && this.children.multiSeries.render().appendTo(this.$el);
                this.children.drilldown && this.children.drilldown.render().appendTo(this.$el);
                this.children.gaugeStyle && this.children.gaugeStyle.render().appendTo(this.$el);
                this.children.beforeLabel && this.children.beforeLabel.render().appendTo(this.$el);
                this.children.afterLabel && this.children.afterLabel.render().appendTo(this.$el);
                this.children.underLabel && this.children.underLabel.render().appendTo(this.$el);
                this.children.events && this.children.events.render().appendTo(this.$el);
                this.children.statistics && this.children.statistics.render().appendTo(this.$el);
                this.children.mapDrilldown && this.children.mapDrilldown.render().appendTo(this.$el);
                return this;
            }
        });
    }
);

/**
 * @author sfishel
 *
 * A custom sub-class of ControlGroup for pivot config forms label inputs.
 *
 * Renders a text input control for the label with the model's default label as placeholder text.
 */

define('views/shared/vizcontrols/custom_controls/AxisTitleControlGroup',[
            'underscore',
            'module',
            'models/Base',
            'views/shared/controls/ControlGroup',
            'views/shared/controls/Control'
        ],
        function(
            _,
            module,
            BaseModel,
            ControlGroup,
            Control
        ) {

    return ControlGroup.extend({

        moduleId: module.id,

        /**
         * @constructor
         * @param options {Object} {
         *     model {Model} the model to operate on
         *     axisType {axisTitleX | axisTitleY | axisTitleY2} the charting attribute namespace
         * }
         */

        initialize: function() {
            this.axisTitleVisibilityAttr = 'display.visualizations.charting.' + this.options.axisType + '.visibility';
            this.axisTitleTextAttr = 'display.visualizations.charting.' + this.options.axisType + '.text';

            // we are simulating the experience of being able to set three possible title states: default, custom, or none
            // these do not map directly to visualization attributes, so we use an in-memory model to mediate
            this.titleStateModel = new BaseModel();
            this.setInitialTitleState();

            // store an in-memory copy of the most recent axis title text, since we might have to clear it to get the 'default' behavior
            this.axisTitleText = this.model.get(this.axisTitleTextAttr);

            this.options.label = _('Title').t();
            this.options.controlClass = 'controls-block';
            this.options.controls = [
                {
                    type: 'SyntheticSelect',
                    options: {
                        className: Control.prototype.className + ' input-prepend',
                        model: this.titleStateModel,
                        modelAttribute: 'state',
                        toggleClassName: 'btn',
                        menuWidth: 'narrow',
                        items: [
                            { value: 'default', label: _('Default').t() },
                            { value: 'custom', label: _('Custom').t() },
                            { value: 'none', label: _('None').t() }
                        ]
                    }
                },
                {
                    type: 'Text',
                    options: {
                        className: Control.prototype.className + ' input-prepend',
                        model: this.model,
                        modelAttribute: this.axisTitleTextAttr,
                        inputClassName: this.options.inputClassName
                    }
                }
            ];
            ControlGroup.prototype.initialize.call(this, this.options);
            // set up references to each control
            this.showHideControl = this.childList[0];
            this.labelControl = this.childList[1];

            this.titleStateModel.on('change:state', this.handleTitleState, this);
            this.model.on('change:' + this.axisTitleTextAttr, function() {
                // ignore this change event if the title state is in default mode
                // since the title text will have been artificially set to ''
                if(this.titleStateModel.get('state') !== 'default') {
                    this.axisTitleText = this.model.get(this.axisTitleTextAttr);
                }
            }, this);
        },

        setInitialTitleState: function() {
            if(this.model.get(this.axisTitleVisibilityAttr) === 'collapsed') {
                this.titleStateModel.set({ state: 'none' });
            }
            else if(this.model.get(this.axisTitleTextAttr)) {
                this.titleStateModel.set({ state: 'custom' });
            }
            else {
                this.titleStateModel.set({ state: 'default' });
            }
        },

        render: function() {
            ControlGroup.prototype.render.apply(this, arguments);
            this.handleTitleState();
            return this;
        },

        handleTitleState: function() {
            var state = this.titleStateModel.get('state'),
                setObject = {};

            if(state === 'none') {
                setObject[this.axisTitleVisibilityAttr] = 'collapsed';
                this.hideTitleTextInput();
            }
            else if(state === 'custom') {
                setObject[this.axisTitleVisibilityAttr] = 'visible';
                setObject[this.axisTitleTextAttr] = this.axisTitleText;
                this.showTitleTextInput();
            }
            else {
                // state == 'default'
                setObject[this.axisTitleVisibilityAttr] = 'visible';
                setObject[this.axisTitleTextAttr] = '';
                this.hideTitleTextInput();
            }
            this.model.set(setObject);
        },

        showTitleTextInput: function() {
            this.labelControl.insertAfter(this.showHideControl.$el);
            this.showHideControl.$el.addClass('input-prepend');
        },

        hideTitleTextInput: function() {
            this.labelControl.detach();
            this.showHideControl.$el.removeClass('input-prepend');
        }

    },
    {
        X_AXIS: 'axisTitleX',
        Y_AXIS: 'axisTitleY',
        Y_AXIS_2: 'axisTitleY2'
    });

});

define('views/shared/vizcontrols/custom_controls/AxisScaleControlGroup',[
            'underscore',
            'module',
            'views/shared/controls/ControlGroup'
        ],
        function(
            _,
            module,
            ControlGroup
        ) {

    return ControlGroup.extend({

        moduleId: module.id,

        /**
         * @constructor
         * @param options {Object} {
         *     model {Model} the model to operate on
         *     axisType {axisX | axisY | axisY2} the charting attribute namespace
         * }
         */

        initialize: function() {
            this.options.label = _("Scale").t();
            this.options.controlType = 'SyntheticRadio';
            var items = [
                {
                    label: _("Linear").t(),
                    value: 'linear'
                },
                {
                    label: _("Log").t(),
                    value: 'log'
                }
            ];
            if(this.options.supportInherit) {
                items.unshift({
                    label: _("Inherit").t(),
                    value: 'inherit'
                });
            }
            this.options.controlOptions = {
                modelAttribute: 'display.visualizations.charting.' + this.options.axisType + '.scale',
                model: this.model,
                className: 'btn-group',
                items: items
            };
            ControlGroup.prototype.initialize.call(this, this.options);
        }

    },
    {
        X_AXIS: 'axisX',
        Y_AXIS: 'axisY',
        Y_AXIS_2: 'axisY2'
    });

});

define('views/shared/vizcontrols/custom_controls/AxisIntervalControlGroup',[
            'underscore',
            'module',
            'views/shared/controls/ControlGroup'
        ],
        function(
            _,
            module,
            ControlGroup
        ) {

    return ControlGroup.extend({

        moduleId: module.id,

        /**
         * @constructor
         * @param options {Object} {
         *     model {Model} the model to operate on
         *     axisType {axisLabelsX | axisLabelsY | axisLabelsY2} the charting attribute namespace
         * }
         */

        initialize: function() {
            this.options.label = _("Interval").t();
            this.options.controlType = 'Text';
            this.options.controlOptions = {
                modelAttribute: 'display.visualizations.charting.' + this.options.axisType + '.majorUnit',
                model: this.model,
                placeholder: _("optional").t(),
                inputClassName: 'input-medium'
            };
            ControlGroup.prototype.initialize.call(this, this.options);
        }

    },
    {
        X_AXIS: 'axisLabelsX',
        Y_AXIS: 'axisLabelsY',
        Y_AXIS_2: 'axisLabelsY2'
    });

});

define('views/shared/vizcontrols/custom_controls/AxisMinValueControlGroup',[
            'underscore',
            'module',
            'views/shared/controls/ControlGroup'
        ],
        function(
            _,
            module,
            ControlGroup
        ) {

    /**
     * @constructor
     * @param options {Object} {
     *     model {Model} the model to operate on
     *     axisType {axisX | axisY | axisY2} the charting attribute namespace
     * }
     */

    return ControlGroup.extend({

        moduleId: module.id,

        initialize: function() {
            this.options.label = _("Min Value").t();
            this.options.controlType = 'Text';
            this.options.controlOptions = {
                modelAttribute: 'display.visualizations.charting.' + this.options.axisType + '.minimumNumber',
                model: this.model,
                placeholder: _("optional").t(),
                inputClassName: 'input-medium'
            };
            ControlGroup.prototype.initialize.call(this, this.options);
        }

    },
    {
        X_AXIS: 'axisX',
        Y_AXIS: 'axisY',
        Y_AXIS_2: 'axisY2'
    });

});

define('views/shared/vizcontrols/custom_controls/AxisMaxValueControlGroup',[
            'underscore',
            'module',
            'views/shared/controls/ControlGroup'
        ],
        function(
            _,
            module,
            ControlGroup
        ) {

    return ControlGroup.extend({

        moduleId: module.id,

        /**
         * @constructor
         * @param options {Object} {
         *     model {Model} the model to operate on
         *     axisType {axisX | axisY | axisY2} the charting attribute namespace
         * }
         */

        initialize: function() {
            this.options.label = _("Max Value").t();
            this.options.controlType = 'Text';
            this.options.controlOptions = {
                modelAttribute: 'display.visualizations.charting.' + this.options.axisType + '.maximumNumber',
                model: this.model,
                placeholder: _("optional").t(),
                inputClassName: 'input-medium'
            };
            ControlGroup.prototype.initialize.call(this, this.options);
        }

    },
    {
        X_AXIS: 'axisX',
        Y_AXIS: 'axisY',
        Y_AXIS_2: 'axisY2'
    });

});

define('views/shared/vizcontrols/custom_controls/AxisLabelRotationControlGroup',[
            'jquery',
            'underscore',
            'module',
            'views/shared/controls/ControlGroup'
        ],
        function(
            $,
            _,
            module,
            ControlGroup
        ) {

    return ControlGroup.extend({

        moduleId: module.id,

        initialize: function() {
            this.options.label = _("Label Rotation").t();
            this.options.controlType = 'SyntheticRadio';
            this.options.controlOptions = {
                modelAttribute: 'display.visualizations.charting.' + this.options.axisType + '.majorLabelStyle.rotation',
                model: this.model,
                items: [
                    {
                        value: '-90', 
                        icon: 'label-rotation--90',
                        tooltip: '-90&deg;'
                    },
                    {
                        value: '-45', 
                        icon: 'label-rotation--45',
                        tooltip: '-45&deg;'
                    },
                    {
                        value: '0', 
                        icon: 'label-rotation-0',
                        tooltip: '0&deg;'
                    },
                    {
                        value: '45', 
                        icon: 'label-rotation-45',
                        tooltip: '45&deg;'
                    },
                    {
                        value: '90', 
                        icon: 'label-rotation-90',
                        tooltip: '90&deg;'
                    }
                ],
                className: 'btn-group'
            };

            ControlGroup.prototype.initialize.call(this, this.options);
        }

    }, 
    {
        X_AXIS: 'axisLabelsX',
        Y_AXIS: 'axisLabelsY',
        Y_AXIS_2: 'axisLabelsY2'
    });


});

define('views/shared/vizcontrols/custom_controls/AxisLabelElisionControlGroup',[
            'underscore',
            'module',
            'views/shared/controls/ControlGroup'
        ],
        function(
            _,
            module,
            ControlGroup
        ) {

    return ControlGroup.extend({

        moduleId: module.id,

        initialize: function() {
            this.options.label = _("Label Truncation").t();
            this.options.controlType = 'SyntheticRadio';
            this.options.controlOptions = {
                modelAttribute: 'display.visualizations.charting.' + this.options.axisType + '.majorLabelStyle.overflowMode',
                model: this.model,
                className: 'btn-group',
                items: [
                    {
                        label: _("Yes").t(),
                        value: "ellipsisMiddle"
                    },
                    {
                        label: _("No").t(),
                        value: "ellipsisNone"
                    }
                ]
            };
            ControlGroup.prototype.initialize.call(this, this.options);
        }

    },
    {
        X_AXIS: 'axisLabelsX',
        Y_AXIS: 'axisLabelsY',
        Y_AXIS_2: 'axisLabelsY2'
    });

});

define('views/shared/vizcontrols/components/XAxis',
    [
        'underscore',
        'jquery',
        'module',
        'views/Base',
        'views/shared/vizcontrols/custom_controls/AxisTitleControlGroup',
        'views/shared/vizcontrols/custom_controls/AxisScaleControlGroup',
        'views/shared/vizcontrols/custom_controls/AxisIntervalControlGroup',
        'views/shared/vizcontrols/custom_controls/AxisMinValueControlGroup',
        'views/shared/vizcontrols/custom_controls/AxisMaxValueControlGroup', 
        'views/shared/vizcontrols/custom_controls/AxisLabelRotationControlGroup', 
        'views/shared/vizcontrols/custom_controls/AxisLabelElisionControlGroup'
    ],
    function(
        _, 
        $,
        module, 
        Base, 
        AxisTitleControlGroup,
        AxisScaleControlGroup,
        AxisIntervalControlGroup,
        AxisMinValueControlGroup,
        AxisMaxValueControlGroup, 
        AxisLabelRotationControlGroup, 
        AxisLabelElisionControlGroup
    ){
        return Base.extend({
            moduleId: module.id,
            className: 'form form-horizontal',
            vizToGeneralComponents: {
                line: ['title', 'elision', 'rotation'],
                area: ['title', 'elision', 'rotation'],
                column: ['title', 'elision', 'rotation'],
                bar:['title'],
                pie: [],
                scatter: ['title', 'elision', 'rotation', 'scale', 'interval', 'min', 'max'],
                radialGauge: [],
                fillerGauge: [],
                markerGauge: [],
                single: [],
                events: [],
                statistics: [] 
            },
            initialize: function(options) {
                Base.prototype.initialize.apply(this, arguments);
                var controls = this.vizToGeneralComponents[this.model.get('viz_type')];
                
                if (_.indexOf(controls, 'title')>-1) { 
                    this.children.title = new AxisTitleControlGroup({
                        model: this.model,
                        axisType: AxisTitleControlGroup.X_AXIS
                    });
                }
                if (_.indexOf(controls, 'elision')>-1) {
                    this.children.elision = new AxisLabelElisionControlGroup({
                        model: this.model,
                        axisType: AxisLabelElisionControlGroup.X_AXIS
                    });
                }
                if (_.indexOf(controls, 'rotation')>-1) {
                    this.children.rotation = new AxisLabelRotationControlGroup({
                        model: this.model,
                        axisType: AxisLabelRotationControlGroup.X_AXIS
                    });
                }
                if(_.indexOf(controls, 'scale')>-1) {
                    this.children.scale = new AxisScaleControlGroup({
                        model: this.model,
                        className: 'scale control-group',
                        controlClass: 'controls-halfblock',
                        axisType: AxisScaleControlGroup.X_AXIS
                    });
                }
                if(_.indexOf(controls, 'interval')>-1) {
                    this.children.interval = new AxisIntervalControlGroup({
                        model: this.model,
                        controlClass: 'controls-block',
                        axisType: AxisIntervalControlGroup.X_AXIS
                    });
                }    
                if(_.indexOf(controls, 'min')>-1) {
                    this.children.min = new AxisMinValueControlGroup({
                        model: this.model,
                        controlClass: 'controls-block',
                        axisType: AxisMinValueControlGroup.X_AXIS
                    });
                }
                if(_.indexOf(controls, 'max')>-1) {
                    this.children.max = new AxisMaxValueControlGroup({
                        model: this.model,
                        controlClass: 'controls-block',
                        axisType: AxisMaxValueControlGroup.X_AXIS
                    });
                }
                if(this.model.get('display.visualizations.charting.axisX.scale')=='log') {
                    if(this.children.interval) {
                        this.children.interval.$el.hide();
                    }
                }
                if(this.children.elision) {
                    this.model.on('change:display.visualizations.charting.axisLabelsX.majorLabelStyle.rotation', this.handleRotation, this);
                }
            },
            events: {
                'click .scale button': function(e){
                    this.intervalVal = this.intervalVal || this.model.get('display.visualizations.charting.axisLabelsX.majorUnit');
                    if(($(e.currentTarget).data('value'))=='log'){
                        if(this.children.interval) {
                            this.children.interval.$el.hide();
                        }
                        this.model.set('display.visualizations.charting.axisLabelsX.majorUnit', '');
                    } else {
                        if(this.children.interval) {
                            this.children.interval.$el.show();
                        }
                        this.model.set('display.visualizations.charting.axisLabelsX.majorUnit', this.intervalVal);
                    }
                }
            },
            render: function() {
                this.children.title && this.children.title.render().appendTo(this.$el);
                this.children.elision && this.children.elision.render().appendTo(this.$el);
                this.children.rotation && this.children.rotation.render().appendTo(this.$el);
                this.children.scale && this.children.scale.render().appendTo(this.$el);
                this.children.interval && this.children.interval.render().appendTo(this.$el);
                this.children.min && this.children.min.render().appendTo(this.$el);
                this.children.max && this.children.max.render().appendTo(this.$el);
                if(this.children.elision) {
                    this.handleRotation();
                }
                return this;
            }, 
            handleRotation: function() {
                if(this.model.get('display.visualizations.charting.axisLabelsX.majorLabelStyle.rotation') === '0'){
                    if(this.children.elision) {
                        this.children.elision.disable();
                    }
                }else{
                    if(this.children.elision) {
                        this.children.elision.enable();
                    }
                }
            }
        });
    }
);

define('views/shared/vizcontrols/components/YAxis',
    [
        'underscore',
        'jquery',
        'module',
        'views/Base',
        'views/shared/vizcontrols/custom_controls/AxisTitleControlGroup',
        'views/shared/vizcontrols/custom_controls/AxisScaleControlGroup',
        'views/shared/vizcontrols/custom_controls/AxisIntervalControlGroup',
        'views/shared/vizcontrols/custom_controls/AxisMinValueControlGroup',
        'views/shared/vizcontrols/custom_controls/AxisMaxValueControlGroup'
    ],
    function(
        _, 
        $,
        module, 
        Base, 
        AxisTitleControlGroup,
        AxisScaleControlGroup,
        AxisIntervalControlGroup,
        AxisMinValueControlGroup,
        AxisMaxValueControlGroup
    ){
        return Base.extend({
            moduleId: module.id,
            className: 'form form-horizontal',
            vizToYAxisComponents: {
                line: ['title', 'scale', 'interval', 'min', 'max'],
                bar: ['title', 'scale', 'interval', 'min', 'max'],
                area: ['title', 'scale', 'interval', 'min', 'max'],
                column: ['title', 'scale', 'interval', 'min', 'max'],
                scatter: ['title', 'scale', 'interval', 'min', 'max'],
                pie: [],
                radialGauge: [],
                fillerGauge: [],
                markerGauge: [],
                single: [],
                events: [],
                statistics: [] 
            },
            initialize: function(options) {
                Base.prototype.initialize.apply(this, arguments);
                var controls = this.vizToYAxisComponents[this.model.get('viz_type')];
                if(_.indexOf(controls, 'title')>-1){
                    this.children.title = new AxisTitleControlGroup({
                        className: 'y-axis-title control-group',
                        model: this.model,
                        axisType: AxisTitleControlGroup.Y_AXIS
                    });
                }

                if(_.indexOf(controls, 'scale')>-1) {
                    this.children.scale = new AxisScaleControlGroup({
                        model: this.model,
                        className: 'scale control-group',
                        controlClass: 'controls-halfblock',
                        axisType: AxisScaleControlGroup.Y_AXIS
                    });
                }
                if(_.indexOf(controls, 'interval')>-1) {
                    this.children.interval = new  AxisIntervalControlGroup({
                        model: this.model,
                        controlClass: 'controls-block',
                        axisType: AxisIntervalControlGroup.Y_AXIS
                    });
                }    
                if(_.indexOf(controls, 'min')>-1) {
                    this.children.min = new AxisMinValueControlGroup({
                        model: this.model,
                        controlClass: 'controls-block',
                        axisType: AxisMinValueControlGroup.Y_AXIS
                    });
                }
                if(_.indexOf(controls, 'max')>-1) {
                    this.children.max = new AxisMaxValueControlGroup({
                        model: this.model,
                        controlClass: 'controls-block',
                        axisType: AxisMaxValueControlGroup.Y_AXIS
                    });
                }
                if(this.model.get('display.visualizations.charting.axisY.scale')=='log') {
                    if(this.children.interval) {
                        this.children.interval.$el.hide();
                    }
                }
            },
            events: {
                'click .scale button': function(e){
                    this.intervalVal = this.intervalVal || this.model.get('display.visualizations.charting.axisLabelsY.majorUnit');
                    if(($(e.currentTarget).data('value'))=='log'){
                        if(this.children.interval) {
                            this.children.interval.$el.hide();
                        }
                        this.model.set('display.visualizations.charting.axisLabelsY.majorUnit', '');
                    } else {
                        if(this.children.interval) {
                            this.children.interval.$el.show();
                        }
                        this.model.set('display.visualizations.charting.axisLabelsY.majorUnit', this.intervalVal);
                    }
                } 
            },
            render: function() {
                this.children.title && this.children.title.render().appendTo(this.$el);
                this.children.scale && this.children.scale.render().appendTo(this.$el);
                this.children.interval && this.children.interval.render().appendTo(this.$el);
                this.children.min && this.children.min.render().appendTo(this.$el);
                this.children.max && this.children.max.render().appendTo(this.$el);
                return this;
            }
        });
    }
);

define('views/shared/controls/MultiInputControl',[
            'underscore',
            'module',
            'views/shared/controls/Control',
            'splunk.util',
            'select2/select2'
        ],
        function(
            _,
            module,
            Control,
            splunkUtils
            /* remaining modules do not export */
        ) {

    var DELIMITER = '::::';

    return Control.extend({

        moduleId: module.id,

        events: {

            'change input': function(e) {
                var values = e.val || [];
                this.setValue(splunkUtils.fieldListToString(values), false);
            }

        },

        /**
         * @constructor
         * @param {Object} options {
         *     {String, required} modelAttribute The attribute on the model to observe and update on selection
         *     {Model, required} model The model to operate on
         *     {String, optional} placeholder The placeholder text for an empty input
         *     {Array<String>, optional} autoCompleteFields A list of fields to use for auto-complete
         *     {String, optional} inputClassName A class name to apply to the input element
         * }
         */

        render: function() {
            if(this.el.innerHTML) {
                return;
            }
            this.$el.html(this.compiledTemplate({ options: this.options }));
            var $input = this.$('input');
            $input.select2({
                placeholder: this.options.placeholder,
                tags: this.options.autoCompleteFields || [],
                formatNoMatches: function() { return '&nbsp;'; },
                dropdownCssClass: 'empty-results-allowed',
                separator: DELIMITER,
                // SPL-77050, this needs to be false for use inside popdowns/modals
                openOnEnter: false,
                // SPL-77130, the default initSelection has a bizarre bug in minify_js mode
                initSelection: function($element, callback) {
                    var val = $element.val();
                    if(!val) {
                        callback([]);
                        return;
                    }
                    var data = _(val.split(DELIMITER)).map(function(str) {
                        return { id: str, text: str };
                    });
                    callback(data);
                }
            })
            .select2('val', splunkUtils.stringToFieldList(this._value || ''))
            // SPL-81507, similar to comment above about bugginess in minify_js mode, select2's string comparisons
            // are not working, so we roll our own way to make sure items are removed properly
            .on('removed', function(e) {
                var removedChoice = e.val.toString(),
                    val = $input.val();

                val = _(val).isString() ? val.split(DELIMITER) : val;
                var updatedVal = _(val).without(removedChoice);
                $input.select2('val', updatedVal);
            })
            // SPL-80073, similar to comment above about bugginess in minify_js mode, we roll our own way to make sure
            // items can't be selected twice
            .on('open', function() {
                var val = $input.val(),
                    $results = $input.data('select2').results;

                val = _(val).isString() ? val.split(DELIMITER) : val;
                $results.find('.select2-result').each(function() {
                    var $choice = $(this),
                        id = $choice.data('select2-data').id.toString();

                    if(_(val).contains(id)) {
                        $choice.addClass('select2-selected');
                    }
                });
            });
            return this;
        },

        remove: function() {
            this.$('input').select2('close').select2('destroy');
            return Control.prototype.remove.apply(this, arguments);
        },

        template: '\
            <input class="<%= options.inputClassName %>" />\
        '

    });

});
define('views/shared/vizcontrols/custom_controls/OverlayFieldsControlGroup',[
            'underscore',
            'module',
            'views/shared/controls/ControlGroup',
            'views/shared/controls/MultiInputControl'
        ],
        function(
            _,
            module,
            ControlGroup,
            MultiInputControl
        ) {

    return ControlGroup.extend({

        moduleId: module.id,

        /**
         * @constructor
         * @param options {
         *     model: {
         *         visualization: <models.shared.Visualization>
         *         report: <models.search.Report>
         *     }
         * }
         */

        initialize: function() {
            this.options.label = _("Overlay").t();
            this.options.controlType = 'Text';
            var control = new MultiInputControl({
                modelAttribute: 'display.visualizations.charting.chart.overlayFields',
                model: this.model.visualization,
                autoCompleteFields: this.model.report.entry.content.get('currentChartFields') || [],
                placeholder: _("type in field name(s)").t()
            });
            this.options.controls = [control];
            ControlGroup.prototype.initialize.call(this, this.options);
        }

    });

});
define('views/shared/vizcontrols/custom_controls/AxisEnabledControlGroup',[
            'underscore',
            'module',
            'views/shared/controls/ControlGroup'
        ],
        function(
            _,
            module,
            ControlGroup
        ) {
    
    return ControlGroup.extend({
    
        moduleId: module.id,
    
        /**
         * @constructor
         * @param options {Object} {
         *     model {Model} the model to operate on
         *     axisType {axisX | axisY | axisY2} the charting attribute namespace
         * }
         */

        initialize: function() {
            this.options.label = this.options.label || _("Enabled").t();
            this.options.controlType = 'SyntheticRadio';
            this.options.controlOptions = {
                modelAttribute: 'display.visualizations.charting.' + this.options.axisType + '.enabled',
                model: this.model,
                className: 'btn-group',
                items: [
                    {
                        label: _("Off").t(),
                        value: '0'
                    },
                    {
                        label: _("On").t(),
                        value: '1'
                    }
                ]
            };
            ControlGroup.prototype.initialize.call(this, this.options);
        }
    },
    {
        X_AXIS: 'axisX',
        Y_AXIS: 'axisY',
        Y_AXIS_2: 'axisY2'
    });
    
});
define('views/shared/vizcontrols/components/ChartOverlay',
    [
        'underscore',
        'jquery',
        'module',
        'views/Base',
        'views/shared/vizcontrols/custom_controls/OverlayFieldsControlGroup',
        'views/shared/vizcontrols/custom_controls/AxisEnabledControlGroup',
        'views/shared/vizcontrols/custom_controls/AxisTitleControlGroup',
        'views/shared/vizcontrols/custom_controls/AxisScaleControlGroup',
        'views/shared/vizcontrols/custom_controls/AxisIntervalControlGroup',
        'views/shared/vizcontrols/custom_controls/AxisMinValueControlGroup',
        'views/shared/vizcontrols/custom_controls/AxisMaxValueControlGroup',
        'splunk.util'
    ],
    function(
        _,
        $,
        module,
        Base,
        OverlayFieldsControlGroup,
        AxisEnabledControlGroup,
        AxisTitleControlGroup,
        AxisScaleControlGroup,
        AxisIntervalControlGroup,
        AxisMinValueControlGroup,
        AxisMaxValueControlGroup,
        splunkUtils
    ){
        return Base.extend({
            moduleId: module.id,
            className: 'form form-horizontal',
            vizToYAxisComponents: {
                line: ['overlayFields', 'enabled', 'title', 'scale', 'interval', 'min', 'max'],
                bar: ['overlayFields', 'enabled', 'title', 'scale', 'interval', 'min', 'max'],
                area: ['overlayFields', 'enabled', 'title', 'scale', 'interval', 'min', 'max'],
                column: ['overlayFields', 'enabled', 'title', 'scale', 'interval', 'min', 'max'],
                scatter: [],
                pie: [],
                radialGauge: [],
                fillerGauge: [],
                markerGauge: [],
                single: [],
                events: [],
                statistics: []
            },
            
            /**
             * @constructor
             * @param options {
             *     model: {
             *         visualization: <models.shared.Visualization>
             *         report: <models.search.Report>
             *     }
             * }
             */
            
            initialize: function(options) {
                Base.prototype.initialize.apply(this, arguments);
                var controls = this.vizToYAxisComponents[this.model.visualization.get('viz_type')];
                if(_.indexOf(controls, 'overlayFields')>-1){
                    this.children.overlayFields = new OverlayFieldsControlGroup({
                        model: {
                            visualization: this.model.visualization,
                            report: this.model.report
                        },
                        controlClass: 'controls-block'
                    });
                }
                if(_.indexOf(controls, 'enabled')>-1){
                    this.children.enabled = new AxisEnabledControlGroup({
                        label: _('View as Axis').t(),
                        model: this.model.visualization,
                        controlClass: 'controls-halfblock',
                        axisType: AxisEnabledControlGroup.Y_AXIS_2
                    });
                }
                if(_.indexOf(controls, 'title')>-1){
                    this.children.title = new AxisTitleControlGroup({
                        className: 'y-axis-title control-group',
                        model: this.model.visualization,
                        axisType: AxisTitleControlGroup.Y_AXIS_2
                    });
                }
                if(_.indexOf(controls, 'scale')>-1) {
                    this.children.scale = new AxisScaleControlGroup({
                        model: this.model.visualization,
                        className: 'scale control-group',
                        controlClass: 'controls-thirdblock',
                        supportInherit: true,
                        axisType: AxisScaleControlGroup.Y_AXIS_2
                    });
                }
                if(_.indexOf(controls, 'interval')>-1) {
                    this.children.interval = new  AxisIntervalControlGroup({
                        model: this.model.visualization,
                        controlClass: 'controls-block',
                        axisType: AxisIntervalControlGroup.Y_AXIS_2
                    });
                }
                if(_.indexOf(controls, 'min')>-1) {
                    this.children.min = new AxisMinValueControlGroup({
                        model: this.model.visualization,
                        controlClass: 'controls-block',
                        axisType: AxisMinValueControlGroup.Y_AXIS_2
                    });
                }
                if(_.indexOf(controls, 'max')>-1) {
                    this.children.max = new AxisMaxValueControlGroup({
                        model: this.model.visualization,
                        controlClass: 'controls-block',
                        axisType: AxisMaxValueControlGroup.Y_AXIS_2
                    });
                }
                if(this.model.visualization.get('display.visualizations.charting.axisY2.scale')=='log') {
                    this.children.interval.$el.hide();
                }
                this.model.visualization.on('change:display.visualizations.charting.axisY2.enabled', this.handleSecondAxisEnabled, this);
                this.model.visualization.on('change:display.visualizations.charting.chart.overlayFields', this.handleOverlayFields, this);
            },
            events: {
                'click .scale button': function(e){
                    this.intervalVal = this.intervalVal || this.model.visualization.get('display.visualizations.charting.axisLabelsY2.majorUnit');
                    if(($(e.currentTarget).data('value'))=='log'){
                        this.children.interval.$el.hide();
                        this.model.visualization.set('display.visualizations.charting.axisLabelsY2.majorUnit', '');
                    } else {
                        this.children.interval.$el.show();
                        this.model.visualization.set('display.visualizations.charting.axisLabelsY2.majorUnit', this.intervalVal);
                    }
                }
            },
            render: function() {
                this.children.overlayFields && this.children.overlayFields.render().appendTo(this.$el);
                this.children.enabled && this.children.enabled.render().appendTo(this.$el);
                this.children.title && this.children.title.render().appendTo(this.$el);
                this.children.scale && this.children.scale.render().appendTo(this.$el);
                this.children.interval && this.children.interval.render().appendTo(this.$el);
                this.children.min && this.children.min.render().appendTo(this.$el);
                this.children.max && this.children.max.render().appendTo(this.$el);
                this.handleSecondAxisEnabled();
                this.handleOverlayFields();
                return this;
            },
            handleSecondAxisEnabled: function() {
                var enabled = splunkUtils.normalizeBoolean(this.model.visualization.get('display.visualizations.charting.axisY2.enabled'));
                if(enabled) {
                    this.children.title.enable();
                    this.children.scale.enable();
                    this.children.interval.enable();
                    this.children.min.enable();
                    this.children.max.enable();
                }
                else {
                    this.children.title.disable();
                    this.children.scale.disable();
                    this.children.interval.disable();
                    this.children.min.disable();
                    this.children.max.disable();
                }
            },
            handleOverlayFields: function() {
                if(this.model.visualization.get('display.visualizations.charting.chart.overlayFields')) {
                    this.children.enabled.enable();
                }
                else {
                    this.children.enabled.disable();
                }
            }
        });
    }
);
define('views/shared/vizcontrols/custom_controls/LegendPlacementControlGroup',[
            'jquery',
            'underscore',
            'module',
            'views/shared/controls/ControlGroup'
        ],
        function(
            $,
            _,
            module,
            ControlGroup
        ) {

    return ControlGroup.extend({

        moduleId: module.id,

        initialize: function() {
            this.options.label = this.options.label || _("Position").t();
            this.options.controlType = 'SyntheticSelect';
            this.options.controlOptions = {
                modelAttribute: 'display.visualizations.charting.legend.placement',
                model: this.model,
                popdownOptions: this.options.popdownOptions,
                items: [
                    {
                        label: _("Right").t(),
                        value: 'right'
                    },
                    {
                        label: _("Bottom").t(),
                        value: 'bottom'
                    },
                    {
                        label: _("Left").t(),
                        value: 'left'
                    },
                    {
                        label: _("Top").t(),
                        value: 'top'
                    },
                    {
                        label: _("None").t(),
                        value: 'none'
                    }
                ],
                toggleClassName: 'btn'
            };

            ControlGroup.prototype.initialize.call(this, this.options);
        }

    });

});

define('views/shared/vizcontrols/custom_controls/LegendTruncationControlGroup',[
            'underscore',
            'module',
            'views/shared/controls/ControlGroup'
        ],
        function(
            _,
            module,
            ControlGroup
        ) {

    return ControlGroup.extend({

        moduleId: module.id,

        initialize: function() {
            this.options.label = this.options.label || _("Truncation").t();
            this.options.controlType = 'SyntheticRadio';
            this.options.controlOptions = {
                modelAttribute: 'display.visualizations.charting.legend.labelStyle.overflowMode',
                model: this.model,
                className: 'btn-group',
                items: [
                    {
                        label: _("A...").t(),
                        value: 'ellipsisEnd',
                        tooltip: _("Truncate End").t()
                    },
                    {
                        label: _("A...Z").t(),
                        value: 'ellipsisMiddle',
                        tooltip: _("Truncate Middle").t()
                    },
                    {
                        label: _("...Z").t(),
                        value: 'ellipsisStart',
                        tooltip: _("Truncate Start").t()
                    }
                ]
            };
            ControlGroup.prototype.initialize.call(this, this.options);
        }

    });

});

define('views/shared/vizcontrols/components/Legend',
    [
        'underscore',
        'jquery',
        'module',
        'views/Base',
        'views/shared/vizcontrols/custom_controls/LegendPlacementControlGroup',
        'views/shared/vizcontrols/custom_controls/LegendTruncationControlGroup'
    ],
    function(
        _, 
        $,
        module, 
        Base,
        LegendPlacementControlGroup,
        LegendTruncationControlGroup
    ){
        return Base.extend({
            moduleId: module.id,
            className: 'form form-horizontal',
            vizToLegendComponents: {
                line:    ['placement', 'truncation'],
                bar:     ['placement', 'truncation'],
                area:    ['placement', 'truncation'],
                column:  ['placement', 'truncation'],
                scatter: ['placement', 'truncation'],
                pie: [],
                radialGauge: [],
                fillerGauge: [],
                markerGauge: [],
                single: [],
                events: [],
                statistics: [] 
            },
            initialize: function(options) {
                Base.prototype.initialize.apply(this, arguments);
                var controls = this.vizToLegendComponents[this.model.get('viz_type')];
                
                if(_.indexOf(controls, 'placement')>-1)
                    this.children.placement = new LegendPlacementControlGroup({
                        model: this.model,
                        controlClass: 'controls-block'
                    });
                if(_.indexOf(controls, 'truncation')>-1)
                    this.children.truncation = new LegendTruncationControlGroup({
                        model: this.model,
                        controlClass: 'controls-thirdblock'
                    });
            },
            render: function() {
                this.children.placement && this.children.placement.render().appendTo(this.$el);
                this.children.truncation && this.children.truncation.render().appendTo(this.$el);
                return this;
            }
        });
    }
);

define('views/shared/vizcontrols/custom_controls/GaugeAutoRangesControlGroup',[
            'underscore',
            'module',
            'models/Base',
            'views/shared/controls/ControlGroup',
            'views/shared/controls/SyntheticRadioControl'
        ],
        function(
            _,
            module,
            BaseModel,
            ControlGroup,
            SyntheticRadioControl
        ) {

    var AutoRangesControl = SyntheticRadioControl.extend({

        initialize: function() {
            this.vizModel = this.options.vizModel;
            this.model.set({ autoMode: this.vizModel.gaugeIsInAutoMode() ? '1' : '0' });
            this.options.modelAttribute = 'autoMode';
            this.options.items = [
                {
                    label: _("Automatic").t(),
                    value: '1',
                    tooltip: _("Uses base search to set color ranges.").t()
                },
                {
                    label: _("Manual").t(),
                    value: '0',
                    tooltip: _("Manually set color ranges. Overrides search settings.").t()
                }
            ];
            this._ranges = '["0", "30", "70", "100"]';
            this._colors = '[0x84E900, 0xFFE800, 0xBF3030]';
            this.model.on('change:autoMode', this.handleModeChange, this);
            SyntheticRadioControl.prototype.initialize.call(this, this.options);
        },

        handleModeChange: function() {
            var goingToAutoMode = this.model.get('autoMode') === '1';
            // if going to auto mode, store the original values of the ranges and colors, then unset them
            if(goingToAutoMode) {
                this._ranges = this.vizModel.get('display.visualizations.charting.chart.rangeValues');
                this._colors = this.vizModel.get('display.visualizations.charting.gaugeColors');
                this.vizModel.set({
                    'display.visualizations.charting.chart.rangeValues': '',
                    'display.visualizations.charting.gaugeColors': ''
                });
            }
            // otherwise resurrect the old values
            else {
                this.vizModel.set({
                    'display.visualizations.charting.chart.rangeValues': this._ranges,
                    'display.visualizations.charting.gaugeColors': this._colors
                });
            }
        }

    });

    return ControlGroup.extend({

        moduleId: module.id,

        initialize: function() {
            var rangesControl = new AutoRangesControl({ model: this.model, vizModel: this.options.vizModel });
            this.options.controlClass = 'controls-halfblock';
            // this.options.label = _("Colors").t();
            this.options.controls = [rangesControl];
            ControlGroup.prototype.initialize.call(this, this.options);
        }

    });

});

define('views/shared/vizcontrols/components/color/ColorPicker',
    [
        'underscore',
        'jquery',
        'module',
        'views/shared/PopTart'
    ],
    function(_, $, module, PopTart){

        var COLORS = [
            '#7e9f44',
            '#ebe42d',
            '#d13b3b',
            '#6cb8ca',
            '#f7912c',
            '#956e96',
            '#c2da8a',
            '#fac61d',
            '#ebb7d0',
            '#324969',
            '#d85e3d',
            '#a04558'
        ];

        return PopTart.extend({
            moduleId: module.id,
            className: 'popdown-dialog color-picker-container',
            initialize: function() {
                PopTart.prototype.initialize.apply(this, arguments);
                this.clone = this.model.clone();
                this.on('shown', function() {
                    this.$('.swatch').first().focus();
                });
            },
            events: {
                'click .swatch': function(e) {
                    var hashPrefixedColor = $(e.currentTarget).data().color,
                        hexColor = '0x'+hashPrefixedColor.substring(1);
                        
                    this.clone.set({ 'color': hexColor });
                    this.$('.swatch-hex input').val(hashPrefixedColor.substring(1));
                    this.$('.big-swatch').css('background-color', hashPrefixedColor);
                    e.preventDefault();
                },
                'click .color-picker-apply': function(e) {
                    this.model.set({
                        'color': this.clone.get('color'),
                        'shadedcolor': this.options.shadeColor(this.clone.get('color').substring(2), -40)
                    });
                    this.model.trigger('color-picker-apply', this.options.index);
                    this.hide();
                    e.stopPropagation();
                },
                'click .color-picker-cancel': function(e) {
                    this.hide();
                    e.stopPropagation();
                },
                'keyup .hex-input': function(e) {
                    var colorStr = $(e.currentTarget).val();
                    
                    this.clone.set('color', '0x'+colorStr);
                    this.$('.big-swatch').css('background-color', '#'+colorStr);
                    e.preventDefault();
                }
            },
            render: function() {
                this.$el.html(PopTart.prototype.template);
                this.$el.append(this._buttonTemplate);
                this.$('.popdown-dialog-body').addClass('color-picker-content');
                var $rangePickerContent = $('<div class="clearfix"></div>').appendTo(this.$('.popdown-dialog-body'));
                $rangePickerContent.append(this.compiledTemplate({
                    model: this.clone,
                    colors: COLORS
                }));
            },
            template: '\
                <div class="swatches">\
                    <ul class="swatch-holder unstyled">\
                        <% _(colors).each(function(color) { %>\
                            <li>\
                                <a href="#" class="swatch" data-color="<%= color %>" style="background-color: <%= color %>"></a>\
                            </li>\
                        <% }) %>\
                    </ul>\
                </div>\
                <div class="big-swatch" data-color="<%- model.get("color").substring(2) %>" style="background-color: #<%- model.get("color").substring(2) %>;"></div>\
                <div class="swatch-hex">\
                    <div class="input-prepend views-shared-controls-textcontrol">\
                        <span class="add-on">#</span>\
                        <input type="text" class="hex-input" value="<%-model.get("color").substring(2) %>">\
                    </div>\
                </div>\
            ',
            _buttonTemplate: '\
                <div class="popdown-dialog-footer color-picker-buttons clearfix">\
                    <a href="#" class="color-picker-cancel btn pull-left">'+_("Cancel").t()+'</a>\
                    <a href="#" class="color-picker-apply btn btn-primary pull-right"> '+_("Apply").t()+'</a>\
                </div>\
            '
        });
    }
);

define('views/shared/vizcontrols/components/color/Ranges',
    [
        'underscore',
        'jquery',
        'module',
        'views/Base',
        'views/shared/vizcontrols/components/color/ColorPicker',
        'collections/Base'
     ],
    function(_, $, module, Base, ColorPicker, BaseCollection) {
        return Base.extend({
            className: 'tab-pane clearfix',
            moduleId: module.id,
            palette: [
                '0x7e9f44', '0xebe42d', '0xd13b3b',
                '0x6cb8ca', '0xf7912c', '0x956e96',
                '0xc2da8a', '0xfac61d', '0xebb7d0',
                '0x324969', '0xd85e3d', '0xa04558'
            ],
            initialize: function() {
                Base.prototype.initialize.apply(this, arguments);
                this.collection = {};
                this.collection.rows = new BaseCollection();
                this.initRowsFromModel();

                this.collection.rows.on('add remove color-picker-apply', function() {
                    this.syncModel();
                    this.render();
                }, this);
                this.collection.rows.on('change', this.syncModel, this);
            },
            initRowsFromModel: function() {
                var modelRanges = this.model.rangesValuesToArray(),
                    ranges = modelRanges.length > 0 ? modelRanges : ['0', '30', '70', '100'],
                    modelColors = this.model.deserializeGaugeColorArray(),
                    colors = modelColors.length > 0 ? modelColors : ['0x84E900', '0xFFE800', '0xBF3030'];

                _(ranges).each(function(range, i) {
                    // SPL-80693, if there are not enough colors for all of the ranges, repeat the last color
                    var color = colors[i-1] || colors[colors.length-1];
                    this.collection.rows.push({
                        value: range,
                        nextValue: ranges[i+1],
                        color: !(i==0) ? color: void(0),
                        shadedcolor: !(i==0) ? this.shadeColor(color, -40): void(0)
                    });
                },this);
            },
            syncModel: function() {
                this.model.set({
                    'display.visualizations.charting.chart.rangeValues': JSON.stringify(this.collection.rows.pluck('value')),
                    'display.visualizations.charting.gaugeColors': '['+_(this.collection.rows.pluck('color')).filter(function(color){
                        return !_.isUndefined(color);
                    }).join(',') + ']'
                });
            },
            events: {
                'click .add-color-range': function(e) {
                    var color = this.palette[Math.floor(Math.random()*12)];
                    this.collection.rows.push({
                        value: this.options.prepopulateNewRanges ? parseInt(this.collection.rows.last().get('value'), 10) * 2 : '',
                        nextValue: '',
                        color: color,
                        shadedcolor: this.shadeColor(color, -40)
                    });
                    e.preventDefault();
                    e.stopPropagation();
                },
                'keyup .range-value': _.debounce(function(e) {
                    var $target = $(e.currentTarget),
                        index = $target.data().index;
                    
                    this.collection.rows.at(index).set('value', $.trim($target.val()));
                    var $next = this.$el.find('[data-prev="'+index+'"]').children().eq(0);
                    
                    if($next)
                        $next.text(((parseInt($target.val(), 10)) || '') + ' ');
                    e.preventDefault();
                },300),
                'click .color-square': function(e) {
                    var $target = $(e.currentTarget),
                        color = $target.css('background-color');
                    this.children.colorPicker = new ColorPicker({
                        model: this.collection.rows.at($target.parent().siblings('input').data().index),
                        shadeColor: this.shadeColor,
                        onHiddenRemove: true
                    });
                    this.children.colorPicker.render().appendTo($('body'));
                    this.children.colorPicker.show($target);
                    e.preventDefault();
                },
                'click .remove-range': function(e) {
                    var index = $(e.currentTarget).siblings('input').data().index;
                    this.collection.rows.remove(this.collection.rows.at(index));
                    e.stopPropagation();
                }
            },
            shadeColor: function(color, shade) {
                var colorInt = parseInt(color, 16);
                var R = (colorInt & 0xFF0000) >> 16;
                var G = (colorInt & 0x00FF00) >> 8;
                var B = (colorInt & 0x0000FF) >> 0;
                R += Math.floor((shade/255)*R);
                G += Math.floor((shade/255)*G);
                B += Math.floor((shade/255)*B);
                return ((R<<16)+(G<<8)+B).toString(16);
            },
            render: function() {
                // Only sync with the model if it is not in "auto mode", since syncing can mutate the model (SPL-80658)
                if(!this.model.gaugeIsInAutoMode()) {
                    this.syncModel();
                }
                this.$el.html(this.compiledTemplate({
                    _: _,
                    collection: this.collection.rows
                }));
                return this;
            },

            template: '\
                <div class="color-rows form-horizontal">\
                    <div class="from-color-group">\
                        <div class="control-group">\
                            <label class="lower-range-label control-label"><%- _("from").t() %></label>\
                            <div class="controls">\
                                <input class="first-row-lower range-value" value="<%- collection.at(0).get("value") %>" data-index=0 type="text">\
                            </div>\
                        </div>\
                    </div>\
                    <div class="to-color-group">\
                        <div class="control-group">\
                            <label class="control-label upper-range-label to-label"><%- _("to").t() %></label>\
                            <div class="controls right-input">\
                                <div class="input-append">\
                                    <input  class="first-row-upper range-value" value="<%- collection.at(1).get("value") %>" data-index=1 type="text">\
                                    <div class="add-on color-picker-add-on">\
                                        <a href="#" class="color-square" style="border-color: #<%- collection.at(1).get("shadedcolor")%>; background-color: #<%- collection.at(1).get("color").substring(2) %>;"></a>\
                                    </div>\
                                </div>\
                            </div>\
                        </div>\
                    </div>\
                    <% collection.each(function(model, i) { %>\
                        <% if(!(i==0 || i==1)) {%>\
                            <div class="extra-color-group">\
                                <div class="control-group">\
                                    <label class="upper-range-label control-label" data-prev="<%- i-1 %>">\
                                        <span class "value"><%- (parseInt(collection.at(i-1).get("value"))) || "" %> </span>\
                                        <span class="label-to"><%- _("to").t() %></span>\
                                    </label>\
                                    <div class="controls input-append">\
                                        <input  class="range-value" value="<%- model.get("value") %>" data-index=<%-i%> type="text">\
                                        <div class="add-on color-picker-add-on">\
                                            <a href="#" class="color-square" style="border-color: #<%- model.get("shadedcolor")%>; background-color: #<%- model.get("color").substring(2) %>;"></a>\
                                        </div>\
                                        <a class="remove-range btn-link" href="#"><i class="icon-x-circle"></i></a>\
                                    </div>\
                                </div>\
                            </div>\
                        <% } %>\
                    <% }); %>\
                </div>\
                <a href="#" class="add-color-range btn pull-right"> + <%- _("Add Range").t() %></a>\
            '
    });
});

define('views/shared/vizcontrols/components/color/Master',
    [
        'underscore',
        'jquery',
        'module',
        'splunk.util',
        'models/Base',
        'views/Base',
        'views/shared/controls/ControlGroup',
        'views/shared/vizcontrols/custom_controls/GaugeAutoRangesControlGroup',
        'views/shared/vizcontrols/components/color/Ranges'
    ],
    function(
        _,
        $,
        module,
        util,
        BaseModel,
        BaseView,
        ControlGroup,
        GaugeAutoRangesControlGroup,
        Ranges
    ){
        return BaseView.extend({
            moduleId: module.id,
            className: ' form form-horizontal',
            controlClass: 'controls-halfblock',
            vizToColorRangeComponents: {
                line: [],
                area: [],
                column: [],
                bar: [],
                pie: [],
                scatter: [],
                radialGauge: ['range'],
                fillerGauge: ['range'],
                markerGauge: ['range'],
                single: [],
                events: [],
                statistics: []
            },
            initialize: function(options) {
                BaseView.prototype.initialize.apply(this, arguments);
                var controls = this.vizToColorRangeComponents[this.model.get('viz_type')];
                if(_.indexOf(controls, 'range')>-1) {
                    // use a in-memory model to mediate the boolean auto/manual mode for gauge behavior since it is not a real viz attribute
                    this.autoModeModel = new BaseModel();
                    this.children.toggle = new GaugeAutoRangesControlGroup({ model: this.autoModeModel, vizModel: this.model });
                    this.autoModeModel.on('change:autoMode', this.updateRangesVisibility, this);
                }

                this.children.colorRanges = new Ranges({
                    model: this.model
                });
            },
            render: function() {
                this.children.toggle && this.children.toggle.render().appendTo(this.$el);
                this.children.colorRanges.render().appendTo(this.$el);
                this.updateRangesVisibility();
                return this;
            },
            remove: function() {
                this.autoModeModel.off(null, null, this);
            },
            updateRangesVisibility: function() {
                if(this.autoModeModel.get('autoMode') === '1') {
                    this.children.colorRanges.$el.hide();
                }
                else {
                    this.children.colorRanges.$el.show();
                }
            }
        });
    }
);

define('views/shared/vizcontrols/components/Statistics',
    [
        'underscore',
        'module',
        'views/Base',
        'views/shared/controls/ControlGroup',
        'views/shared/controls/SyntheticSelectControl'
    ],
    function(_, module, Base, ControlGroup, SyntheticSelectControl) {
        return Base.extend({
            moduleId: module.id,
            className: 'form form-horizontal',
            // className: 'form-justified',
            initialize: function() {
                Base.prototype.initialize.apply(this, arguments);
                //child views
                this.children.drillDown = new ControlGroup({
                    label: _("Drilldown").t(),
                    controlType:'SyntheticRadio',
                    controlClass: 'controls-thirdblock',
                    controlOptions: {
                        className: "btn-group",
                        items: [
                            {value:"row", label:_("Row").t()},
                            {value:"cell", label:_("Cell").t()},
                            {value:"none", label:_("None").t()}
                        ],
                        model: this.model,
                        modelAttribute: 'display.statistics.drilldown'
                    }
                });

                this.children.rowNumbers = new ControlGroup({
                    label: _("Row Numbers").t(),
                    controlType:'SyntheticRadio',
                    controlClass: 'controls-halfblock',
                    controlOptions: {
                        className: "btn-group",
                        items: [
                            {value:"1", label:_("Yes").t()},
                            {value:"0", label:_("No").t()}
                        ],
                        model: this.model,
                        modelAttribute: 'display.statistics.rowNumbers'
                    }
                });

                this.children.wrapResults = new ControlGroup({
                    label: _("Wrap Results").t(),
                    controlType:'SyntheticRadio',
                    controlClass: 'controls-halfblock',
                    controlOptions: {
                        className: "btn-group",
                        items: [
                            {value:"1", label:_("Yes").t()},
                            {value:"0", label:_("No").t()}
                        ],
                        model: this.model,
                        modelAttribute: 'display.statistics.wrap'
                    }
                });

                this.children.dataOverlay = new ControlGroup({
                    label: _("Data Overlay").t(),
                    controlType:'SyntheticSelect',
                    controlClass: 'controls-block',
                    controlOptions: {
                        model: this.model,
                        menuWidth: "narrow",
                        items: [
                            {value: 'none', label: _("None").t()},
                            {value: 'heatmap', label: _("Heat map").t()},
                            {value: 'highlow', label: _("High and low values").t()}
                        ],
                        modelAttribute: 'display.statistics.overlay',
                        toggleClassName: "btn"
                    }
                });
                if (this.model.get('dashboard')){
                    this.children.count = new ControlGroup({
                        label: _("Rows Per Page").t(),
                        controlType:'Text',
                        controlClass: 'controls-block',
                        controlOptions: {
                            model: this.model,
                            menuWidth: "narrow",
                            modelAttribute: 'display.prefs.statistics.count'
                        }
                    });
                }
            },
            render: function() {
                this.$el.html("");
                this.children.wrapResults.render().appendTo(this.$el);
                this.children.rowNumbers.render().appendTo(this.$el);
                this.children.drillDown.render().appendTo(this.$el);
                this.children.dataOverlay.render().appendTo(this.$el);
                if (this.children.count){
                    this.children.count.render().appendTo(this.$el);
                }

                return this;
            }
        });
    }
);

define('views/shared/vizcontrols/components/Events',
    [
        'underscore',
        'module',
        'views/Base',
        'views/shared/controls/ControlGroup'
    ],
    function(_, module, Base, ControlGroup) {
        return Base.extend({
            moduleId: module.id,
            className: 'form form-horizontal',
            /**
             * @param {Object} options {
             *     model: <models.services.SavedSearch.entry.content>,
             *     showEventType: true (default) | false,
             *     showDrilldown: true (default) | false
             * }
             */
            initialize: function() {
                Base.prototype.initialize.apply(this, arguments);
                this.showEventType = this.options.showEventType === false ? false : true;
                this.showDrilldown = this.options.showDrilldown === false ? false : true;

                if (this.showEventType) {
                    this.children.eventType = new ControlGroup({
                        label: _("Display").t(),
                        controlType:'SyntheticRadio',
                        controlClass: 'controls-thirdblock',
                        controlOptions: {
                            className: "btn-group",
                            items: [
                                { label: _("Raw").t(),  value: 'raw'  },
                                { label: _("List").t(), value: 'list' },
                                { label: _("Table").t(),value: 'table'}
                            ],
                            model: this.model,
                            modelAttribute: 'display.events.type'
                        }
                    });
                }
                this.children.rowNumbers = new ControlGroup({
                    label: _("Row Numbers").t(),
                    controlType:'SyntheticRadio',
                    controlClass: 'controls-halfblock',
                    controlOptions: {
                        className: "btn-group",
                        items: [
                            {value:'1', label:_("Yes").t()},
                            {value:'0', label:_("No").t()}
                        ],
                        model: this.model,
                        modelAttribute: 'display.events.rowNumbers'
                    }
                });
                this.children.wrapResultsList = new ControlGroup({
                    label: _("Wrap Results").t(),
                    controlType:'SyntheticRadio',
                    controlClass: 'controls-halfblock',
                    controlOptions: {
                        className: "btn-group",
                        items: [
                            {value:'1', label:_("Yes").t()},
                            {value:'0', label:_("No").t()}
                        ],
                        model: this.model,
                        modelAttribute: 'display.events.list.wrap'
                    }
                });
                this.children.wrapResultsTable = new ControlGroup({
                    label: _("Wrap Results").t(),
                    controlType:'SyntheticRadio',
                    controlClass: 'controls-halfblock',
                    controlOptions: {
                        className: "btn-group",
                        items: [
                            {value:'1', label:_("Yes").t()},
                            {value:'0', label:_("No").t()}
                        ],
                        model: this.model,
                        modelAttribute: 'display.events.table.wrap'
                    }
                });

                this.children.maxlines = new ControlGroup({
                    label: _("Max Lines").t(),
                    controlType:'SyntheticSelect',
                    controlClass: 'controls-block',
                    controlOptions: {
                        model: this.model,
                        menuWidth: "narrow",
                        items: [
                            {value: '5', label: _("5 lines").t()},
                            {value: '10', label: _("10 lines").t()},
                            {value: '20', label: _("20 lines").t()},
                            {value: '50', label: _("50 lines").t()},
                            {value: '100', label: _("100 lines").t()},
                            {value: '200', label: _("200 lines").t()},
                            {value: '0', label: _("All lines").t()}
                        ],
                        modelAttribute: 'display.events.maxLines',
                        toggleClassName: "btn",
                        nearestValue: true
                    }
                });
                if (this.showDrilldown) {
                    this.children.drilldownRaw = new ControlGroup({
                        label: _("Drilldown").t(),
                        controlType:'SyntheticSelect',
                        controlClass: 'controls-block',
                        controlOptions: {
                            menuWidth: 'narrow',
                            toggleClassName: 'btn',
                            items: [
                                {value:"none", label:_("None").t()},
                                {value:"inner", label:_("Inner").t()},
                                {value:"outer", label:_("Outer").t()},
                                {value:"full", label:_("Full").t()}
                            ],
                            model: this.model,
                            modelAttribute: 'display.events.raw.drilldown'
                        }
                    });
                    this.children.drilldownList = new ControlGroup({
                        label: _("Drilldown").t(),
                        controlType:'SyntheticSelect',
                        controlClass: 'controls-block',
                        controlOptions: {
                            menuWidth: 'narrow',
                            toggleClassName: 'btn',
                            items: [
                                {value:"none", label:_("None").t()},
                                {value:"inner", label:_("Inner").t()},
                                {value:"outer", label:_("Outer").t()},
                                {value:"full", label:_("Full").t()}
                            ],
                            model: this.model,
                            modelAttribute: 'display.events.list.drilldown'
                        }
                    });
                    this.children.drilldownTable = new ControlGroup({
                        label: _("Drilldown").t(),
                        controlType:'SyntheticRadio',
                        controlClass: 'controls-halfblock',
                        controlOptions: {
                            className: "btn-group",
                            items: [
                                {value:'1', label:_("On").t()},
                                {value:'0', label:_("Off").t()}
                            ],
                            model: this.model,
                            modelAttribute: 'display.events.table.drilldown'
                        }
                    });
                }
                if (this.model.get('dashboard')){
                    this.children.count = new ControlGroup({
                        label: _("Rows Per Page").t(),
                        controlType:'Text',
                        controlClass: 'controls-block',
                        controlOptions: {
                            model: this.model,
                            menuWidth: "narrow",
                            modelAttribute: 'display.prefs.events.count'
                        }
                    });
                }
                this.activate();
            },
            startListening: function() {
                this.listenTo(this.model, 'change:display.events.type', this.visibility);
                if (this.showDrilldown) {
                    this.listenTo(this.model, 'change:display.events.list.drilldown change:display.events.raw.drilldown', this.mediateDrilldown);
                }
                this.listenTo(this.model, 'change:display.events.list.wrap change:display.events.table.wrap', this.mediateWrap);
            },
            mediateDrilldown: function() {
                (this.model.get('display.events.type') === 'list') ?
                    this.model.set('display.events.raw.drilldown', this.model.get('display.events.list.drilldown')):
                    this.model.set('display.events.list.drilldown', this.model.get('display.events.raw.drilldown'));
            },
            mediateWrap: function() {
                (this.model.get('display.events.type') === 'list') ?
                    this.model.set('display.events.table.wrap', this.model.get('display.events.list.wrap')):
                    this.model.set('display.events.list.wrap', this.model.get('display.events.table.wrap'));
            },
            visibility: function() {
                switch(this.model.get('display.events.type')){
                    case 'list':
                        this.children.wrapResultsList.$el.show();
                        this.children.wrapResultsTable.$el.hide();
                        this.children.rowNumbers.$el.show();
                        if (this.showDrilldown) {
                            this.children.drilldownList.$el.show();
                            this.children.drilldownRaw.$el.hide();
                            this.children.drilldownTable.$el.hide();
                        }
                        break;
                    case 'raw':
                        this.children.wrapResultsList.$el.hide();
                        this.children.wrapResultsTable.$el.hide();
                        this.children.rowNumbers.$el.hide();
                        if (this.showDrilldown) {
                            this.children.drilldownList.$el.hide();
                            this.children.drilldownRaw.$el.show();
                            this.children.drilldownTable.$el.hide();
                        }
                        break;
                    case 'table':
                        this.children.wrapResultsList.$el.hide();
                        this.children.wrapResultsTable.$el.show();
                        this.children.rowNumbers.$el.show();
                        if (this.showDrilldown) {
                            this.children.drilldownList.$el.hide();
                            this.children.drilldownRaw.$el.hide();
                            this.children.drilldownTable.$el.show();
                        }
                        break;
                    default:
                        break;
                }
            },
            render: function() {
                if (this.showEventType) {
                    this.children.eventType.render().appendTo(this.$el);
                }

                this.children.rowNumbers.render().appendTo(this.$el);
                this.children.wrapResultsList.render().appendTo(this.$el);
                this.children.wrapResultsTable.render().appendTo(this.$el);
                this.children.maxlines.render().appendTo(this.$el);
                
                if (this.showDrilldown) {
                    this.children.drilldownList.render().appendTo(this.$el);
                    this.children.drilldownRaw.render().appendTo(this.$el);
                    this.children.drilldownTable.render().appendTo(this.$el);
                }
                
                if (this.children.count){
                    this.children.count.render().appendTo(this.$el);
                }
                this.visibility();
                return this;
            }
        });
    }
);

define('views/shared/vizcontrols/custom_controls/MapCenterControlGroup',[
            'underscore',
            'module',
            'views/shared/controls/ControlGroup',
            'views/shared/controls/TextControl'
        ],
        function(
            _,
            module,
            ControlGroup,
            TextControl
        ) {

    var LAT_LON_REGEX = /^\(([^,\s]*)\s*,\s*([^,\s]*)\)$/;

    var MapCenterControl = TextControl.extend({

        setValueFromModel: function(render) {
            var latLon = this.readLatLon();
            this._setValue(this.options.mode === MapCenterControlGroup.LATITUDE ? latLon.lat : latLon.lon, render);
            return this;
        },

        getUpdatedModelAttributes: function() {
            var latLon = this.readLatLon(),
                updateAttrs = {};

            if(this.options.mode === MapCenterControlGroup.LATITUDE) {
                latLon.lat = this._value;
            }
            else {
                latLon.lon = this._value;
            }
            updateAttrs[this.getModelAttribute()] = '(' + latLon.lat + ',' + latLon.lon + ')';
            return updateAttrs;
        },

        readLatLon: function() {
            var matches = LAT_LON_REGEX.exec(this.model.get(this.getModelAttribute()));
            if(!matches || matches.length < 3) {
                return { lat: 0, lon: 0 };
            }
            return { lat: matches[1], lon: matches[2] };
        }

    });

    var MapCenterControlGroup = ControlGroup.extend({

        moduleId: module.id,

        /**
         * @constructor
         * @param options {Object} {
         *     model {Model} the model to operate on
         *     mode {latitude | longitude} which attribute of the center point to control
         * }
         */

        initialize: function() {
            this.options.label = this.options.mode === MapCenterControlGroup.LATITUDE ? _("Latitude").t() : _("Longitude").t();
            this.options.controls = [
                new MapCenterControl({
                    model: this.model,
                    modelAttribute: 'display.visualizations.mapping.map.center',
                    mode: this.options.mode,
                    inputClassName: 'input-medium'
                })
            ];
            ControlGroup.prototype.initialize.call(this, this.options);
        }

    },
    {
        LATITUDE: 'latitude',
        LONGITUDE: 'longitude'
    });

    return MapCenterControlGroup;

});

define('views/shared/vizcontrols/custom_controls/MapZoomControlGroup',[
            'underscore',
            'module',
            'views/shared/controls/ControlGroup'
        ],
        function(
            _,
            module,
            ControlGroup
        ) {

    return ControlGroup.extend({

        moduleId: module.id,

        initialize: function() {
            this.options.label = _("Zoom").t();
            this.options.controlType = 'Text';
            this.options.controlOptions = {
                modelAttribute: 'display.visualizations.mapping.map.zoom',
                model: this.model,
                inputClassName: 'input-medium'
            };
            ControlGroup.prototype.initialize.call(this, this.options);
        }

    });

});

define('views/shared/vizcontrols/components/Map',[
            'underscore',
            'module',
            'views/Base',
            'views/shared/vizcontrols/custom_controls/MapCenterControlGroup',
            'views/shared/vizcontrols/custom_controls/MapZoomControlGroup',
            'util/console'
        ],
        function(
            _,
            module,
            Base,
            MapCenterControlGroup,
            MapZoomControlGroup,
            console
        ) {

    return Base.extend({

        moduleId: module.id,

        className: 'form form-horizontal',

        events: {
            'click .populate-button': function(e) {
                e.preventDefault();
                var roundToHundredths = function(num) {
                    return Math.round(num * 100) / 100;
                };
                var reportContent = this.model.report.entry.content,
                    center = reportContent.get('currentMapCenter'),
                    centerString = '(' + roundToHundredths(center.lat) + ',' + roundToHundredths(center.lon) + ')';

                this.model.visualization.set({
                    'display.visualizations.mapping.map.zoom': reportContent.get('currentMapZoom'),
                    'display.visualizations.mapping.map.center': centerString
                });
            }
        },

        vizToGeneralComponents: {
            line: [],
            area: [],
            column: [],
            bar: [],
            pie: [],
            scatter: [],
            radialGauge: [],
            fillerGauge: [],
            markerGauge: [],
            single: [],
            mapping: ['centerLat', 'centerLon', 'zoom']
        },

        /**
         * @constructor
         * @param options {
         *     model: {
         *         visualization: <models.shared.Visualization>
         *         report: <models.search.Report>
         *     }
         * }
         */

        initialize: function() {
            Base.prototype.initialize.apply(this, arguments);
            var controls = this.vizToGeneralComponents[this.model.visualization.get('viz_type')];
            if(_.contains(controls, 'centerLat')) {
                this.children.centerLat = new MapCenterControlGroup({
                    model: this.model.visualization,
                    mode: MapCenterControlGroup.LATITUDE
                });
            }
            if(_.contains(controls, 'centerLon')) {
                this.children.centerLon = new MapCenterControlGroup({
                    model: this.model.visualization,
                    mode: MapCenterControlGroup.LONGITUDE
                });
            }
            if(_.contains(controls, 'zoom')) {
                this.children.zoom = new MapZoomControlGroup({
                    model: this.model.visualization
                });
            }
        },

        render: function() {
            this.children.centerLat && this.children.centerLat.render().appendTo(this.$el);
            this.children.centerLon && this.children.centerLon.render().appendTo(this.$el);
            this.children.zoom && this.children.zoom.render().appendTo(this.$el);
            var reportContent = this.model.report.entry.content;
            if(reportContent.has('currentMapZoom') && reportContent.has('currentMapCenter')) {
                this.$el.append(this.compiledTemplate());
            }
            else {
                console.warn('report content does not have current map zoom and center, disabling populate button');
            }
            return this;
        },

        template: '\
            <div class="populate-button-container">\
                <a href="#" class="populate-button"><%- _("Populate with current map settings").t() %></a>\
            </div>\
        '

    });

});
define('views/shared/controls/PercentTextControl',[
            'jquery',
            'underscore',
            'module',
            'views/shared/controls/TextControl',
            'util/math_utils'
        ],
        function(
            $,
            _,
            module,
            TextControl,
            mathUtils
        ) {

    return TextControl.extend({

        initialize: function() {
            this.options = $.extend({
                append: _('<span class="add-on"><%- _("%").t() %></span>').template({}),
                inputClassName: 'input-mini'
            }, this.options);
            TextControl.prototype.initialize.call(this, this.options);
        },

        // the next two methods normalize the model attribute from a decimal in the model to a percent when displayed to the user
        setValueFromModel: function(render) {
            var rawValue = this.model.get(this.getModelAttribute()),
                // need to do this to avoid floating point errors
                normalizedValue = mathUtils.strictParseFloat((mathUtils.strictParseFloat(rawValue) * 100).toPrecision(12));

            this._setValue(_.isNaN(normalizedValue) ? rawValue : normalizedValue, render);
            return this;
        },

        getUpdatedModelAttributes: function() {
            var updateAttrs = TextControl.prototype.getUpdatedModelAttributes.apply(this, arguments),
                rawValue = updateAttrs[this.getModelAttribute()],
                normalizedValue = mathUtils.strictParseFloat(updateAttrs[this.getModelAttribute()]) / 100;

            updateAttrs[this.getModelAttribute()] = _.isNaN(normalizedValue) ? rawValue : normalizedValue;
            return updateAttrs;
        }

    });

});
define('views/shared/vizcontrols/custom_controls/MapMarkerOpacityControlGroup',[
            'jquery',
            'underscore',
            'module',
            'views/shared/controls/PercentTextControl',
            'views/shared/controls/ControlGroup'
        ],
        function(
            $,
            _,
            module,
            PercentTextControl,
            ControlGroup
        ) {

    return ControlGroup.extend({

        moduleId: module.id,

        initialize: function() {
            this.options.label = _("Opacity").t();
            this.options.controls = [
                new PercentTextControl({
                    model: this.model,
                    modelAttribute: 'display.visualizations.mapping.markerLayer.markerOpacity'
                })
            ];
            ControlGroup.prototype.initialize.call(this, this.options);
        }

    });

});

define('views/shared/vizcontrols/custom_controls/MapMarkerMinSizeControlGroup',[
            'underscore',
            'module',
            'views/shared/controls/ControlGroup'
        ],
        function(
            _,
            module,
            ControlGroup
        ) {

    return ControlGroup.extend({

        moduleId: module.id,

        initialize: function() {
            this.options.label = _("Min Size").t();
            this.options.controlType = 'Text';
            this.options.controlOptions = {
                modelAttribute: 'display.visualizations.mapping.markerLayer.markerMinSize',
                model: this.model,
                inputClassName: 'input-medium'
            };
            ControlGroup.prototype.initialize.call(this, this.options);
        }

    });

});

define('views/shared/vizcontrols/custom_controls/MapMarkerMaxSizeControlGroup',[
            'underscore',
            'module',
            'views/shared/controls/ControlGroup'
        ],
        function(
            _,
            module,
            ControlGroup
        ) {

    return ControlGroup.extend({

        moduleId: module.id,

        initialize: function() {
            this.options.label = _("Max Size").t();
            this.options.controlType = 'Text';
            this.options.controlOptions = {
                modelAttribute: 'display.visualizations.mapping.markerLayer.markerMaxSize',
                model: this.model,
                inputClassName: 'input-medium'
            };
            ControlGroup.prototype.initialize.call(this, this.options);
        }

    });

});

define('views/shared/vizcontrols/custom_controls/MapMarkerMaxClustersControlGroup',[
            'underscore',
            'module',
            'views/shared/controls/ControlGroup'
        ],
        function(
            _,
            module,
            ControlGroup
        ) {

    return ControlGroup.extend({

        moduleId: module.id,

        initialize: function() {
            this.options.label = _("Max Clusters").t();
            this.options.controlType = 'Text';
            this.options.controlOptions = {
                modelAttribute: 'display.visualizations.mapping.data.maxClusters',
                model: this.model,
                inputClassName: 'input-medium'
            };
            ControlGroup.prototype.initialize.call(this, this.options);
        }

    });

});

define('views/shared/vizcontrols/components/Markers',[
            'underscore',
            'module',
            'views/Base',
            'views/shared/vizcontrols/custom_controls/MapMarkerOpacityControlGroup',
            'views/shared/vizcontrols/custom_controls/MapMarkerMinSizeControlGroup',
            'views/shared/vizcontrols/custom_controls/MapMarkerMaxSizeControlGroup',
            'views/shared/vizcontrols/custom_controls/MapMarkerMaxClustersControlGroup'
        ],
        function(
            _,
            module,
            Base,
            MapMarkerOpacityControlGroup,
            MapMarkerMinSizeControlGroup,
            MapMarkerMaxSizeControlGroup,
            MapMarkerMaxClustersControlGroup
        ) {

    return Base.extend({

        moduleId: module.id,

        className: 'form form-horizontal',

        vizToGeneralComponents: {
            line: [],
            area: [],
            column: [],
            bar: [],
            pie: [],
            scatter: [],
            radialGauge: [],
            fillerGauge: [],
            markerGauge: [],
            single: [],
            mapping: ['opacity', 'minSize', 'maxSize', 'maxClusters']
        },

        initialize: function() {
            Base.prototype.initialize.apply(this, arguments);
            var controls = this.vizToGeneralComponents[this.model.get('viz_type')];
            if(_.contains(controls, 'opacity')) {
                this.children.opacity = new MapMarkerOpacityControlGroup({
                    model: this.model
                });
            }
            if(_.contains(controls, 'minSize')) {
                this.children.minSize = new MapMarkerMinSizeControlGroup({
                    model: this.model
                });
            }
            if(_.contains(controls, 'maxSize')) {
                this.children.maxSize = new MapMarkerMaxSizeControlGroup({
                    model: this.model
                });
            }
            if(_.contains(controls, 'maxClusters')) {
                this.children.maxClusters = new MapMarkerMaxClustersControlGroup({
                    model: this.model
                });
            }
        },

        render: function() {
            this.children.opacity && this.children.opacity.render().appendTo(this.$el);
            this.children.minSize && this.children.minSize.render().appendTo(this.$el);
            this.children.maxSize && this.children.maxSize.render().appendTo(this.$el);
            this.children.maxClusters && this.children.maxClusters.render().appendTo(this.$el);
            return this;
        }

    });

});
/**
 * @author jszeto
 * @date 10/16/12
 *
 * Simple Menu control that displays a button as the anchor and a popdown with a list of links. Differs from
 * SyntheticSelectControl since it does not provide selection support.
 *
 * When an item is clicked, the control triggers an "itemClicked" event with the value of the clicked item.
 *
 * @param {Object} options
 *              {String} label Label for the anchor button
 *              {String} labelIcon Icon for the anchor button
 *              {String} className CSS class name for the root element (default is "btn-group pull-right")
 *              {String} anchorClassName CSS class name for the anchor (default is "btn")
 *              {String} dropdownClassName CSS class name for the drop-down menu (default is "")
 *              {Object} items Either an array of primitive item objects or an array of arrrays of primitive item objects.
 *              Use the array of arrays to group subsets of the items visually.
 *
 *              The primitive objects have keys:
 *                             label (textual display),
 *                             value (value to broadcast with the "itemClicked" event)
 *                             icon (icon name to show in menu and button label)
 *                             (ie, {label: 'Foo Bar', value: 'foo', icon: 'bar'}).
 *
 *                       Ex.
 *                       items = [
 *                          [
 *                              {label:"A One", value:"A1"},
 *                              {label:"A Two", value:"A2"}
*                           ],
 *                          [
 *                              {label:"B One", value:"B1"},
 *                              {label:"B Two", value:"B2"},
 *                              {label:"B Three", value:"B3"},
 *                              {label:"B Four", value:"B4"}
*                           ],
 *                          [
 *                              {label:"C One", value:"C1"}
 *                          ]
 *                       ]
 *
 *                       Each array of items is visually grouped together
 */
// TODO [JCS] Add comments and documentation

define('views/shared/DropDownMenu',
        [
            'jquery',
            'underscore',
            'views/Base',
            'views/shared/delegates/Popdown',
            'util/keyboard',
            'module'
        ],
        function(
            $,
            _,
            BaseView,
            Popdown,
            keyboardUtils,
            module
        )
{

    return BaseView.extend({
        moduleId: module.id,
        DEFAULT_CLASS_NAME: "btn-group pull-right",
        DEFAULT_ANCHOR_CLASS_NAME: "btn",
        initialize: function(options) {
            BaseView.prototype.initialize.call(this, options);
            options = options || {};
            this.$el.addClass(options.hasOwnProperty('className') ? options.className : this.DEFAULT_CLASS_NAME);
            this.anchorClassName = options.hasOwnProperty('anchorClassName') ? options.anchorClassName : this.DEFAULT_ANCHOR_CLASS_NAME;
            this.options.popdownOptions = $.extend(true, { el: this.el , attachDialogTo: 'body'}, this.options.popdownOptions);
        },
        setItems: function(items) {
            this.options.items = items;
            this.debouncedRender();
        },
        render: function() {
            if (this.children.popdown)
                this.children.popdown.remove();

            var html = _(this.template).template({options:this.options,
                                                  useNestedArrays: this.isArrayofArrays(this.options.items)});
            this.$el.html(html);
            this.$(".dropdown-toggle").addClass(this.anchorClassName);
            // store a reference to the menu container now in case the popdown appends it to the body
            this.$drowdownMenu = this.$(".dropdown-menu");
            this.$drowdownMenu.on("click", "ul > li > a:not(.disabled)", _(this.handleItemClick).bind(this));
            this.$drowdownMenu.on("keydown", _(function(e) {
                // 508: When escape is pressed, close the drop-down menu but stop the event propagation in case the
                // menu is inside another popdown or modal.
                if(e.which === keyboardUtils.KEYS.ESCAPE) {
                    this.children.popdown.hide();
                    e.stopPropagation();
                }
            }).bind(this));

            this.children.popdown = new Popdown(this.options.popdownOptions);
            // 508 FTW: focus the first non-disabled item when the menu is shown
            this.children.popdown.on('shown', function() {
                this.$drowdownMenu.find('a[data-value]:not(.disabled)').first().focus();
            }, this);
            // More 508 FTW: focus the activator when the popdown is closed
            this.children.popdown.on('hidden', function() {
                this.$('.dropdown-toggle').focus();
            }, this);
            return this;
        },
        isArrayofArrays: function(items) {
            if (_(items).isArray() && items.length > 0 && _(items[0]).isArray()) {
                return true;
            }

            return false;
        },
        handleItemClick: function(e) {
            e.preventDefault();
            var $target = $(e.currentTarget),
                itemValue = $target.attr('data-value'),
                itemIndex = parseInt($target.attr('data-item-index'), 10);

            if (this.isArrayofArrays(this.options.items)) {
                var itemsArrayIndex = parseInt($target.attr('data-items-array-index'), 10);
                this.trigger("itemClicked", itemValue, this.options.items[itemsArrayIndex][itemIndex]);
            } else {
                this.trigger("itemClicked", itemValue, this.options.items[itemIndex]);
            }
        },
        template: '\
            <a class="dropdown-toggle" href="#">\
                <% if (options.labelIcon) { %><i class="icon-<%- options.labelIcon %> icon-large"></i><% } %><span class="link-label"><%- options.label %></span><span class="caret"></span>\
            </a>\
            <div class="dropdown-menu <%- options.dropdownClassName || \'\' %>">\
                <div class="arrow"></div>\
                <% if (useNestedArrays) { %>\
                    <% _(options.items).each(function(itemsChild, i) { %>\
                    <ul>\
                        <% _(itemsChild).each(function(object, j) { %>\
                            <li>\
                                <a href="#" data-value="<%- object.value %>" data-items-array-index="<%- i %>" data-item-index="<%- j %>" \
                                    <% if(object.enabled === false) {%>\
                                        class="disabled"\
                                    <% } %>\
                                >\
                                    <% if (object.icon) { %> \
                                        <i class="icon-<%- object.icon %> icon-large"></i>\
                                    <% } %>\
                                    <%- object.label %>\
                                </a>\
                            </li>\
                        <% }) %>\
                    </ul>\
                    <% }) %>\
                <% } else { %>\
                    <ul>\
                        <% _(options.items).each(function(object, k) { %>\
                            <li>\
                                <a href="#" data-value="<%- object.value %>" data-item-index="<%- k %>" \
                                    <% if(object.enabled === false) {%>\
                                        class="disabled"\
                                    <% } %>\
                                    >\
                                    <% if (object.icon) { %> \
                                        <i class="icon-<%- object.icon %> icon-large"></i>\
                                    <% } %>\
                                    <%- object.label %>\
                                </a>\
                            </li>\
                        <% }) %>\
                    </ul>\
               <% } %>\
            </div>\
        '
    });
});

define('views/shared/vizcontrols/custom_controls/MapTileUrlControlGroup',[
            'underscore',
            'module',
            'views/shared/controls/ControlGroup'
        ],
        function(
            _,
            module,
            ControlGroup
        ) {

    return ControlGroup.extend({

        moduleId: module.id,

        initialize: function() {
            this.options.label = _("Url").t();
            this.options.controlType = 'Textarea';
            this.options.help = _('The URL to use for requesting tiles, ex: <br /> http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').t();
            this.options.controlOptions = {
                modelAttribute: 'display.visualizations.mapping.tileLayer.url',
                model: this.model,
                className: 'control controls-block'
            };
            ControlGroup.prototype.initialize.call(this, this.options);
        }

    });

});

define('views/shared/vizcontrols/custom_controls/MapTileMinZoomControlGroup',[
            'underscore',
            'module',
            'views/shared/controls/ControlGroup'
        ],
        function(
            _,
            module,
            ControlGroup
        ) {

    return ControlGroup.extend({

        moduleId: module.id,

        initialize: function() {
            this.options.label = _("Min Zoom").t();
            this.options.controlType = 'Text';
            this.options.controlOptions = {
                modelAttribute: 'display.visualizations.mapping.tileLayer.minZoom',
                model: this.model,
                inputClassName: 'input-medium'
            };
            ControlGroup.prototype.initialize.call(this, this.options);
        }

    });

});

define('views/shared/vizcontrols/custom_controls/MapTileMaxZoomControlGroup',[
            'underscore',
            'module',
            'views/shared/controls/ControlGroup'
        ],
        function(
            _,
            module,
            ControlGroup
        ) {

    return ControlGroup.extend({

        moduleId: module.id,

        initialize: function() {
            this.options.label = _("Max Zoom").t();
            this.options.controlType = 'Text';
            this.options.controlOptions = {
                modelAttribute: 'display.visualizations.mapping.tileLayer.maxZoom',
                model: this.model,
                inputClassName: 'input-medium'
            };
            ControlGroup.prototype.initialize.call(this, this.options);
        }

    });

});

define('views/shared/vizcontrols/components/Tiles',[
            'underscore',
            'module',
            'views/Base',
            'views/shared/DropDownMenu',
            'views/shared/vizcontrols/custom_controls/MapTileUrlControlGroup',
            'views/shared/vizcontrols/custom_controls/MapTileMinZoomControlGroup',
            'views/shared/vizcontrols/custom_controls/MapTileMaxZoomControlGroup'
        ],
        function(
            _,
            module,
            Base,
            DropDownMenu,
            MapTileUrlControlGroup,
            MapTileMinZoomControlGroup,
            MapTileMaxZoomControlGroup
        ) {

    return Base.extend({

        moduleId: module.id,

        className: 'form form-horizontal',

        vizToGeneralComponents: {
            line: [],
            area: [],
            column: [],
            bar: [],
            pie: [],
            scatter: [],
            radialGauge: [],
            fillerGauge: [],
            markerGauge: [],
            single: [],
            mapping: ['url', 'minZoom', 'maxZoom']
        },

        initialize: function() {
            Base.prototype.initialize.apply(this, arguments);
            var controls = this.vizToGeneralComponents[this.model.get('viz_type')];
            if(_.contains(controls, 'url')) {
                this.children.url = new MapTileUrlControlGroup({
                    model: this.model
                });
            }
            if(_.contains(controls, 'minZoom')) {
                this.children.minZoom = new MapTileMinZoomControlGroup({
                    model: this.model
                });
            }
            if(_.contains(controls, 'maxZoom')) {
                this.children.maxZoom = new MapTileMaxZoomControlGroup({
                    model: this.model
                });
            }
            this.children.tilePresetsMenu = new DropDownMenu({
                label: _('Populate from preset configuration').t(),
                className: '',
                dropdownClassName: 'dropdown-menu-narrow',
                anchorClassName: 'btn-pill',
                popdownOptions: { attachDialogTo: 'body' },
                items: [
                    { label: _('Splunk Tiles').t(), value: 'splunk', url: '', minZoom: '0', maxZoom: '7' },
                    { label: _('Open Street Map').t(), value: 'osm', url: 'http://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', minZoom: '0', maxZoom: '19' }
                ]
            });

            this.listenTo(this.children.tilePresetsMenu, 'itemClicked', function(type, itemData) {
                this.model.set({
                    'display.visualizations.mapping.tileLayer.url': itemData.url,
                    'display.visualizations.mapping.tileLayer.minZoom': itemData.minZoom,
                    'display.visualizations.mapping.tileLayer.maxZoom': itemData.maxZoom
                });
            });
        },

        render: function() {
            this.children.url && this.children.url.render().appendTo(this.$el);
            this.children.minZoom && this.children.minZoom.render().appendTo(this.$el);
            this.children.maxZoom && this.children.maxZoom.render().appendTo(this.$el);
            this.$el.append(this.compiledTemplate());
            this.children.tilePresetsMenu.render().appendTo(this.$('.populate-button-container'));
            return this;
        },

        template: '\
            <div class="populate-button-container"></div>\
        '

    });

});
define('views/shared/vizcontrols/components/Master',
    [
        'underscore',
        'jquery',
        'module',
        'views/Base',
        'views/shared/FlashMessages',
        'views/shared/vizcontrols/components/General',
        'views/shared/vizcontrols/components/XAxis',
        'views/shared/vizcontrols/components/YAxis',
        'views/shared/vizcontrols/components/ChartOverlay',
        'views/shared/vizcontrols/components/Legend',
        'views/shared/vizcontrols/components/color/Master',
        'views/shared/vizcontrols/components/Statistics',
        'views/shared/vizcontrols/components/Events',
        'views/shared/vizcontrols/components/Map',
        'views/shared/vizcontrols/components/Markers',
        'views/shared/vizcontrols/components/Tiles'
    ],
    function(_, $, module, Base, FlashMessages, General, XAxis, YAxis, ChartOverlay, Legend, Ranges, Statistics, Events, Map, Markers, Tiles){
        return Base.extend({
            
            moduleId: module.id,
            
            className: 'tabbable ',
            
            events: {
                'click a[data-toggle]': function(e) {
                    var $target = $(e.currentTarget),
                        type = $target.data().type;
                    
                    _(this.children).each(function(child) { 
                        child.$el.hide(); 
                    },this);
                    this.children[type].$el.show(); 
                    this.$el.find('.nav > li').removeClass('active');
                    $target.parent().addClass('active');
                    
                    e.preventDefault();
                }
            },

            /**
             * @constructor
             * @param options {
             *     model: {
             *         visualization: <models.shared.Visualization>
             *         report: <models.search.Report>
             *     }
             * }
             */
            
            initialize: function(options) {
                Base.prototype.initialize.apply(this, arguments);
                this.children.flashMessages = new FlashMessages({ model: this.model.visualization });
                this.vizType = this.model.visualization.get('viz_type');
                if(this.hasTabType('gen')) {
                    this.children.general = new General({ model: this.model.visualization });
                }
                else if(this.hasTabType('statistics')) {
                    this.children.general = new Statistics({ model: this.model.visualization });
                }
                else if(this.hasTabType('events')) {
                    this.children.general = new Events({ model: this.model.visualization });
                }

                if(this.hasTabType('x')) {
                    this.children.xaxis = new XAxis({ model: this.model.visualization });
                }
                if(this.hasTabType('y')) {
                    this.children.yaxis = new YAxis({ model: this.model.visualization });
                }
                if(this.hasTabType('overlay')) {
                    this.children.overlay = new ChartOverlay({
                        model: {
                            visualization: this.model.visualization,
                            report: this.model.report
                        }
                    });
                }
                if(this.hasTabType('leg')) {
                    this.children.legend = new Legend({ model: this.model.visualization });
                }
                if(this.hasTabType('ranges')) {
                    this.children.ranges = new Ranges({ model: this.model.visualization });
                }
                if(this.hasTabType('map')) {
                    this.children.map = new Map({
                        model: {
                            visualization: this.model.visualization,
                            report: this.model.report
                        }
                    });
                }
                if(this.hasTabType('markers')) {
                    this.children.markers = new Markers({ model: this.model.visualization });
                }
                if(this.hasTabType('tiles')) {
                    this.children.tiles = new Tiles({ model: this.model.visualization });
                }
            },
            
            render: function() {
                this.$el.html(_(this.template).template({
                    hasTabType: _(this.hasTabType).bind(this)
                }));
                this.children.flashMessages.render().prependTo(this.$('.tab-content'));
                _(this.children).each(function(child) { 
                    this.$('.tab-content').append(child.render().el);
                    child.$el.hide();
                },this);
                this.children.general.$el.show();
                return this;
            },
            
            hasTabType: function(tabType) {
                return _.contains(this.model.visualization.components[this.vizType], tabType);
            },
            
            template: '\
                <ul class="nav nav-tabs-left">\
                    <% if(hasTabType("gen") || hasTabType("statistics") || hasTabType("events")) { %>\
                        <li class="active">\
                            <a href="#" data-toggle="tab" data-type="general"><%- _("General").t() %></a>\
                        </li>\
                    <% } %>\
                    <% if(hasTabType("x")) { %>\
                        <li>\
                            <a href="#" data-toggle="tab" data-type="xaxis"><%- _("X-Axis").t() %></a>\
                        </li>\
                    <% } %>\
                    <% if(hasTabType("y")) { %>\
                        <li>\
                            <a href="#" data-toggle="tab" data-type="yaxis"><%- _("Y-Axis").t() %></a>\
                        </li>\
                    <% } %>\
                    <% if(hasTabType("overlay")) { %>\
                        <li>\
                            <a href="#" data-toggle="tab" data-type="overlay"><%- _("Chart Overlay").t() %></a>\
                        </li>\
                    <% } %>\
                    <% if(hasTabType("leg")) { %>\
                        <li>\
                            <a href="#" data-toggle="tab" data-type="legend"><%- _("Legend").t() %></a>\
                        </li>\
                    <% } %>\
                    <% if(hasTabType("ranges")) { %>\
                        <li>\
                            <a href="#" data-toggle="tab" data-type="ranges"><%- _("Color Ranges").t() %></a>\
                        </li>\
                    <% } %>\
                    <% if(hasTabType("map")) { %>\
                        <li>\
                            <a href="#" data-toggle="tab" data-type="map"><%- _("Map").t() %></a>\
                        </li>\
                    <% } %>\
                    <% if(hasTabType("markers")) { %>\
                        <li>\
                            <a href="#" data-toggle="tab" data-type="markers"><%- _("Markers").t() %></a>\
                        </li>\
                    <% } %>\
                    <% if(hasTabType("tiles")) { %>\
                        <li>\
                            <a href="#" data-toggle="tab" data-type="tiles"><%- _("Tiles").t() %></a>\
                        </li>\
                    <% } %>\
                </ul>\
                <div class="tab-content"></div>\
            '
        });
    }
);

define('views/shared/vizcontrols/Format',
    [
        'underscore',
        'jquery',
        'module',
        'views/shared/PopTart',
        'views/shared/vizcontrols/components/Master'
    ],
    function(_, $, module, PopTart, Component){
        return PopTart.extend({
            moduleId: module.id,
            /**
             * @param {Object} options {
             *     model: {
             *         report: <models.Report>,
             *         state: <models.SplunkDBaseV2>
             *     },
             *     saveOnApply: <Boolean>
             *   }
             */

            options: {
                saveOnApply: false
            },

            /**
             * @constructor
             * @param options {
             *     model: {
             *         visualization: <models.shared.Visualization>
             *         report: <models.search.Report>
             *     }
             * }
             */

            initialize: function(options) {
                PopTart.prototype.initialize.apply(this, arguments);
                this.children.visualizationControls && this.children.visualizationControls.remove();
                this.children.visualizationControls = new Component({
                    model: {
                        visualization: this.model.visualization,
                        report: this.model.report
                    }
                });
            },
            events: {
                'click .viz-editor-apply': function(e) {
                    e.preventDefault();
                    this.applyChanges(); 
                },
                'click .viz-editor-cancel': function(e) {
                    this.hide();
                    e.preventDefault();
                },
                'keypress .viz-editor-apply': function(e) {
                    e.preventDefault();
                    this.applyChanges(); 
                },
                'keypress .viz-editor-cancel': function(e) {
                    this.hide();
                    e.preventDefault();
                },
                'keypress input:text': function(e) {
                    var enterKeyCode = 13,
                        $target = $(e.target);

                    if(e.keyCode == enterKeyCode) {
                        $target.blur();
                        e.preventDefault();
                        this.applyChanges();
                    }
                }
            },
            applyChanges: function() {
                this.model.visualization.validate();
                if(this.model.visualization.isValid()) {
                    this.model.report.entry.content.set($.extend({}, this.model.visualization.toJSON()));
                    if(this.options.saveOnApply) {
                        this.model.report.save();
                    }
                    this.hide();
                }
            },
            render: function() {
                this.$el.html(PopTart.prototype.template);
                this.$el.append(this.template);
                this.children.visualizationControls.render().appendTo(this.$('.popdown-dialog-body'));
                // ghetto hack to override default padding on poptart ;_;
                this.$('.popdown-dialog-body').removeClass('popdown-dialog-padded');
                return this;
            },
            template: '\
                    <div class="popdown-dialog-footer">\
                        <a class="viz-editor-cancel btn pull-left" tabindex="0">'+_("Cancel").t()+'</a>\
                        <a class="viz-editor-apply btn btn-primary pull-right" tabindex="0"> '+_("Apply").t()+'</a>\
                    </div>\
            '
        });
    }
);

define('models/shared/Visualization',
    [
        'jquery',
        'underscore',
        'util/math_utils',
        'models/Base',
        'util/general_utils',
        'splunk.util'
    ],
    function($, _, math_utils, BaseModel, general_utils, splunk_util) {
        var parseFloat = math_utils.strictParseFloat;
        var Visualization = BaseModel.extend({
            initialize: function() {
                BaseModel.prototype.initialize.apply(this, arguments);

                // SPL-77030, if a line chart is set to log scale on the y-axis, clear any stack mode
                this.on('change:display.visualizations.charting.axisY.scale', function() {
                    if(this.get('display.visualizations.charting.chart') === 'line'
                                && this.get('display.visualizations.charting.axisY.scale') === 'log') {
                        this.set({ 'display.visualizations.charting.chart.stackMode': 'default' });
                    }
                }, this);

                // SPL-77499, if all overlay fields are removed, disable the second y-axis
                this.on('change:display.visualizations.charting.chart.overlayFields', function() {
                    if(!this.get('display.visualizations.charting.chart.overlayFields')) {
                        this.set({ 'display.visualizations.charting.axisY2.enabled': '0' });
                    }
                });
            },
            components: {
                'single': ['gen'],
                'line': ['gen', 'x', 'y', 'overlay', 'leg'],
                'area': ['gen', 'x', 'y','overlay', 'leg'],
                'column': ['gen', 'x', 'y','overlay', 'leg'],
                'bar': ['gen', 'x', 'y','overlay', 'leg'],
                'pie': ['gen'],
                'scatter':  ['gen', 'x', 'y', 'leg'],
                'radialGauge': ['gen', 'ranges'],
                'fillerGauge': ['gen', 'ranges'],
                'markerGauge': ['gen', 'ranges'],
                'statistics': ['statistics'],
                'events': ['events'],
                'mapping': ['gen', 'map', 'markers', 'tiles']
            },
            defaults: {
                'display.visualizations.charting.axisY.scale': 'linear',
                'display.visualizations.charting.axisY2.scale': 'inherit',
                'display.visualizations.charting.axisX.scale': 'linear',
                'display.visualizations.charting.axisX.minimumNumber': '',
                'display.visualizations.charting.axisX.maximumNumber': '',
                'display.visualizations.charting.axisY.minimumNumber': '',
                'display.visualizations.charting.axisY.maximumNumber': '',
                'display.visualizations.charting.axisTitleX.text': '',
                'display.visualizations.charting.axisTitleY.text': '',
                'display.visualizations.charting.axisLabelsX.majorUnit': '',
                'display.visualizations.charting.axisLabelsY.majorUnit': '',
                'display.visualizations.charting.axisLabelsX.majorLabelStyle.overflowMode': 'ellipsisNone',
                'display.visualizations.charting.axisLabelsX.majorLabelStyle.rotation': '0',
                'display.visualizations.charting.legend.placement': 'right',
                'display.visualizations.charting.legend.labelStyle.overflowMode': 'ellipsisMiddle',
                'display.visualizations.charting.chart.stackMode': 'default',
                'display.visualizations.charting.layout.splitSeries': '0',
                'display.visualizations.charting.drilldown': 'all',
                'display.visualizations.charting.chart.nullValueMode': 'gaps',
                'display.visualizations.charting.chart.sliceCollapsingThreshold': 0.01,
                'display.visualizations.charting.chart.rangeValues': '["0","30","70","100"]',
                'display.visualizations.charting.chart.style': 'shiny',
                'display.visualizations.charting.gaugeColors': [0x84E900,0xFFE800,0xBF3030],
                'display.visualizations.mapping.drilldown': 'all',
                'display.visualizations.mapping.map.center': '(0,0)',
                'display.visualizations.mapping.map.zoom': '2',
                'display.visualizations.mapping.markerLayer.markerOpacity': '0.8',
                'display.visualizations.mapping.markerLayer.markerMinSize': '10',
                'display.visualizations.mapping.markerLayer.markerMaxSize': '50',
                'display.visualizations.mapping.data.maxClusters': '100',
                'display.visualizations.mapping.tileLayer.minZoom': '0',
                'display.visualizations.mapping.tileLayer.maxZoom': '7',
                'display.prefs.events.count': '10',
                'display.prefs.statistics.count': '10',
                'display.events.type': 'list',
                'display.events.rowNumbers': '0',
                'display.events.maxLines': '5',
                'display.events.raw.drilldown': 'full',
                'display.events.list.drilldown': 'full',
                'display.events.list.wrap': '1',
                'display.events.table.drilldown': '1',
                'display.events.table.wrap': '1',
                'display.statistics.drilldown': 'cell',
                'display.statistics.rowNumbers': '0',
                'display.statistics.wrap': '1',
                'display.statistics.overlay': 'none'
            },
            validation: {

                // General chart attribute validation rules

                'display.visualizations.charting.chart.stackMode': [
                    {
                        oneOf: ['default', 'stacked', 'stacked100'],
                        required: true,
                        msg: _('Stack Mode must be default, stacked, or stacked100').t()
                    },
                    {
                        fn: 'validateYScaleAndStacking'
                    }
                ],

                'display.visualizations.charting.layout.splitSeries': {
                    fn: 'validateBoolean',
                    required: true
                },

                'display.visualizations.charting.drilldown': {
                    oneOf: ['all', 'none'],
                    required: true,
                    msg: _('Chart Drilldown must be all or none').t()
                },

                'display.visualizations.charting.chart.nullValueMode': {
                    oneOf: ['zero', 'connect', 'gaps'],
                    required: true,
                    msg: _('Null Value Mode must be zero, connect, or gaps').t()
                },

                // Legend validation rules

                'display.visualizations.charting.legend.placement': {
                    oneOf: ['right', 'left', 'top', 'bottom', 'none'],
                    required: true,
                    msg: _('Legend Placement must be right, left, top, bottom, or none').t()
                },

                'display.visualizations.charting.legend.labelStyle.overflowMode': {
                    oneOf: ['ellipsisMiddle', 'ellipsisStart', 'ellipsisEnd'],
                    required: true,
                    msg: _('Legend Truncation must be ellipsisMiddle, ellipsisStart, or ellipsisEnd').t()
                },

                // Axis validation rules

                'display.visualizations.charting.axisX.minimumNumber': [
                    {
                        fn: 'validateNumberOrAuto',
                        required: false
                    },
                    {
                        fn: 'validateXAxisExtremes',
                        required: false
                    }
                ],
                'display.visualizations.charting.axisX.maximumNumber': [
                    {
                        fn: 'validateNumberOrAuto',
                        required: false
                    },
                    {
                        fn: 'validateXAxisExtremes',
                        required: false
                    }
                ],
                'display.visualizations.charting.axisY.minimumNumber': [
                    {
                        fn: 'validateNumberOrAuto',
                        required: false
                    },
                    {
                        fn: 'validateYAxisExtremes',
                        required: false
                    }
                ],
                'display.visualizations.charting.axisY.maximumNumber': [
                    {
                        fn: 'validateNumberOrAuto',
                        required: false
                    },
                    {
                        fn: 'validateYAxisExtremes',
                        required: false
                    }
                ],
                'display.visualizations.charting.axisY2.minimumNumber': [
                    {
                        fn: 'validateNumberOrAuto',
                        required: false
                    },
                    {
                        fn: 'validateYAxis2Extremes',
                        required: false
                    }
                ],
                'display.visualizations.charting.axisY2.maximumNumber': [
                    {
                        fn: 'validateNumberOrAuto',
                        required: false
                    },
                    {
                        fn: 'validateYAxis2Extremes',
                        required: false
                    }
                ],
                'display.visualizations.charting.axisLabelsX.majorUnit': [
                    {
                        fn: 'validatePositiveNumberOrAuto',
                        required: false
                    }
                ],
                'display.visualizations.charting.axisLabelsY.majorUnit': [
                    {
                        fn: 'validatePositiveNumberOrAuto',
                        required: false
                    }
                ],
                'display.visualizations.charting.axisLabelsY2.majorUnit': [
                    {
                        fn: 'validatePositiveNumberOrAuto',
                        required: false
                    }
                ],
                'display.visualizations.charting.axisLabelsX.majorLabelStyle.rotation': {
                    oneOf: ['-90', '-45', '0', '45', '90'],
                    required: true,
                    msg: _('Axis Label Rotation must be -90, -45, 0, 45, or 90').t()
                },
                'display.visualizations.charting.axisLabelsX.majorLabelStyle.overflowMode': {
                    oneOf: ['ellipsisNone', 'ellipsisMiddle'],
                    required: true,
                    msg: _('Axis Label overflow mode must be ellipsisNone or ellipsisMiddle').t()
                },
                'display.visualizations.charting.axisY.scale': [
                    {
                        oneOf: ['linear', 'log'],
                        required: true,
                        msg: _('Y-Axis Scale must be linear or log').t()
                    },
                    {
                        fn: 'validateYScaleAndStacking'
                    }
                ],
                'display.visualizations.charting.axisX.scale': {
                    oneOf: ['linear', 'log'],
                    required: true,
                    msg: _('X-Axis Scale must be linear or log').t()
                },
                'display.visualizations.charting.axisY2.scale': {
                    oneOf: ['linear', 'log', 'inherit'],
                    required: true,
                    msg: _('X-Axis Scale must be linear, log, or inherit').t()
                },

                // Pie chart validation rules

                'display.visualizations.charting.chart.sliceCollapsingThreshold': {
                    pattern: 'number',
                    min: 0,
                    msg: _('Minimum Size must be a non-negative number.').t(),
                    required: true
                },

                // Gauge validation rules

                'display.visualizations.charting.chart.rangeValues': {
                    fn: 'validateRangeValues',
                    required: false
                },

                'display.visualizations.charting.chart.style': {
                    oneOf: ['shiny', 'minimal'],
                    required: true,
                    msg: _('Gauge Style must be shiny or minimal').t()
                },

                // Map renderer validation rules

                'display.visualizations.mapping.drilldown': {
                    oneOf: ['all', 'none'],
                    required: true,
                    msg: _('Drilldown must be all or none').t()
                },

                'display.visualizations.mapping.map.center': {
                    pattern: /^\s*\(([-+.0-9]+)\s*,\s*([-+.0-9]+)\)\s*$/,
                    required: true,
                    msg: _('Latitude and Longitude must be valid numbers').t()
                },

                'display.visualizations.mapping.map.zoom': {
                    pattern: 'digits',
                    required: true,
                    min: 0,
                    msg: _('Zoom must be a non-negative integer').t()
                },

                'display.visualizations.mapping.markerLayer.markerOpacity': {
                    pattern: 'number',
                    required: true,
                    min: 0,
                    max: 1,
                    msg: _('Marker Opacity must be between 0 and 100%').t()
                },

                'display.visualizations.mapping.markerLayer.markerMinSize': [
                    {
                        pattern: 'digits',
                        required: true,
                        min: 1,
                        msg: _('Minimum Size must be a positive integer').t()
                    },
                    {
                        fn: 'validateMapMarkerSize'
                    }
                ],

                'display.visualizations.mapping.markerLayer.markerMaxSize': [
                    {
                        pattern: 'digits',
                        required: true,
                        min: 1,
                        msg: _('Maximum Size must be a positive integer').t()
                    },
                    {
                        fn: 'validateMapMarkerSize'
                    }
                ],

                'display.visualizations.mapping.data.maxClusters': {
                    pattern: 'digits',
                    required: true,
                    min: 0,
                    msg: _('Max Clusters must be a non-negative integer').t()
                },

                'display.visualizations.mapping.tileLayer.minZoom': [
                    {
                        pattern: 'digits',
                        required: true,
                        min: 0,
                        msg: _('Minimum Zoom must be a non-negative integer').t()
                    },
                    {
                        fn: 'validateMapTileLayerZoom'
                    }
                ],

                'display.visualizations.mapping.tileLayer.maxZoom': [
                    {
                        pattern: 'digits',
                        required: true,
                        min: 0,
                        msg: _('Maximum Zoom must be a non-negative integer').t()
                    },
                    {
                        fn: 'validateMapTileLayerZoom'
                    }
                ],

                // Event renderer validation rules

                'display.prefs.events.count': {
                    pattern: 'digits',
                    min: 1,
                    max: 100,
                    msg: _('Rows Per Page must be a positive number no larger than 100.').t(),
                    required: true
                },

                'display.events.type': {
                    oneOf: ['list', 'raw', 'table'],
                    required: true,
                    msg: _('Event Display Type must be list, raw, or table').t()
                },

                'display.events.raw.drilldown': {
                    oneOf: ['full', 'none', 'inner', 'outer'],
                    required: true,
                    msg: _('Event Drilldown must be full, none, inner, or outer').t()
                },

                'display.events.list.drilldown': {
                    oneOf: ['full', 'none', 'inner', 'outer'],
                    required: true,
                    msg: _('Event Drilldown must be full, none, inner, or outer').t()
                },

                'display.events.table.drilldown': {
                    fn: 'validateBoolean',
                    required: true
                },

                'display.events.rowNumbers': {
                    fn: 'validateBoolean',
                    required: true
                },

                'display.events.list.wrap': {
                    fn: 'validateBoolean',
                    required: true
                },

                'display.events.table.wrap': {
                    fn: 'validateBoolean',
                    required: true
                },

                'display.events.maxLines': {
                    oneOf: ['0', '5', '10', '20', '50', '100', '200'],
                    required: true,
                    msg: _('Max Lines must 0, 5, 10, 20, 50, 100, or 200').t()
                },

                // Statistics table validation rules

                'display.prefs.statistics.count': {
                    pattern: 'digits',
                    min: 1,
                    max: 100,
                    msg: _('Rows Per Page must be a positive number no larger than 100.').t(),
                    required: true
                },

                'display.statistics.drilldown': {
                    oneOf: ['row', 'cell', 'none'],
                    required: true,
                    msg: _('Statistics Drilldown must be row, cell, or none').t()
                },

                'display.statistics.overlay': {
                    oneOf: ['none', 'heatmap', 'highlow'],
                    required: true,
                    msg: _('Data Overlay must be none, heatmap, or highlow').t()
                },

                'display.statistics.rowNumbers': {
                    fn: 'validateBoolean',
                    required: true
                },

                'display.statistics.wrap': {
                    fn: 'validateBoolean',
                    required: true
                }
            },

            validateXAxisExtremes: function(value, attr, computedState) {
                var min = attr === 'display.visualizations.charting.axisX.minimumNumber' ? parseFloat(value) :
                                        parseFloat(computedState['display.visualizations.charting.axisX.minimumNumber']),
                    max = attr === 'display.visualizations.charting.axisX.maximumNumber' ? parseFloat(value) :
                                        parseFloat(computedState['display.visualizations.charting.axisX.maximumNumber']);

                if(!_.isNaN(min) && !_.isNaN(max) && max <= min) {
                    return _('The X-Axis Min Value must be less than the Max Value.').t();
                }
            },

            validateYAxisExtremes: function(value, attr, computedState) {
                var min = attr === 'display.visualizations.charting.axisY.minimumNumber' ? parseFloat(value) :
                                        parseFloat(computedState['display.visualizations.charting.axisY.minimumNumber']),
                    max = attr === 'display.visualizations.charting.axisY.maximumNumber' ? parseFloat(value) :
                                        parseFloat(computedState['display.visualizations.charting.axisY.maximumNumber']);

                if(!_.isNaN(min) && !_.isNaN(max) && max <= min) {
                    return _('The Y-Axis Min Value must be less than the Max Value.').t();
                }
            },

            validateYAxis2Extremes: function(value, attr, computedState) {
                var min = attr === 'display.visualizations.charting.axisY2.minimumNumber' ? parseFloat(value) :
                                        parseFloat(computedState['display.visualizations.charting.axisY2.minimumNumber']),
                    max = attr === 'display.visualizations.charting.axisY2.maximumNumber' ? parseFloat(value) :
                                        parseFloat(computedState['display.visualizations.charting.axisY2.maximumNumber']);

                if(!_.isNaN(min) && !_.isNaN(max) && max <= min) {
                    return _('The Y-Axis Min Value must be less than the Max Value.').t();
                }
            },

            validateYScaleAndStacking: function(value, attr, computedState) {
                // SPL-77030, since line charts ignore stack mode, this validation rule does not apply
                if(computedState['display.visualizations.charting.chart'] === 'line') {
                    return false;
                }
                var yAxisScale = attr === 'display.visualizations.charting.axisY.scale' ? value :
                                                computedState['display.visualizations.charting.axisY.scale'],
                    stackMode = attr === 'display.visualizations.charting.chart.stackMode' ? value :
                                                computedState['display.visualizations.charting.chart.stackMode'];

                if(yAxisScale === 'log' && stackMode !== 'default') {
                    return _('Log scale and stacking cannot be enabled at the same time.').t();
                }
            },

            validateRangeValues: function(value) {
                var ranges;
                try {
                    ranges = _(value ? JSON.parse(value) : []).map(parseFloat);
                }
                catch (e) {
                    return _('Ranges must be of the form: ["0","30","70","100"]').t();
                }
                if(_(ranges).any(_.isNaN)) {
                    return _('All color ranges must be valid numbers.').t();
                }
                var filteredRanges = Visualization.filterToValidRangeValues(ranges);
                if(!_.isEqual(ranges, filteredRanges)) {
                    return _('Color ranges must be entered from lowest to highest.').t();
                }
            },

            validateMapMarkerSize: function(value, attr, computedState) {
                var min = attr === 'display.visualizations.mapping.markerLayer.markerMinSize' ? parseFloat(value) :
                                        parseFloat(computedState['display.visualizations.mapping.markerLayer.markerMinSize']),
                    max = attr === 'display.visualizations.mapping.markerLayer.markerMaxSize' ? parseFloat(value) :
                                        parseFloat(computedState['display.visualizations.mapping.markerLayer.markerMaxSize']);

                if(!_.isNaN(min) && !_.isNaN(max) && max <= min) {
                    return _('The Min Size must be less than the Max Size.').t();
                }
            },

            validateMapTileLayerZoom: function(value, attr, computedState) {
                var min = attr === 'display.visualizations.mapping.tileLayer.minZoom' ? parseFloat(value) :
                                        parseFloat(computedState['display.visualizations.mapping.tileLayer.minZoom']),
                    max = attr === 'display.visualizations.mapping.tileLayer.maxZoom' ? parseFloat(value) :
                                        parseFloat(computedState['display.visualizations.mapping.tileLayer.maxZoom']);

                if(!_.isNaN(min) && !_.isNaN(max) && max <= min) {
                    return _('The Min Zoom must be less than the Max Zoom.').t();
                }
            },

            validateNumberOrAuto: function(value, attr, computedState) {
                var num = parseFloat(value);
                if(value && _.isNaN(num) && !value.match(/^(auto)$/)){
                    return splunk_util.sprintf(
                        _('%s must be a number or "auto".').t(),
                        this.humanizeAttr(attr)
                    );
                }
            },

            validatePositiveNumberOrAuto: function(value, attr, computedState) {
                var numberOrAutoValidation = this.validateNumberOrAuto(value, attr, computedState);
                if(numberOrAutoValidation) {
                    return numberOrAutoValidation;
                }
                var num = parseFloat(value);
                if(!_.isNaN(num) && num <= 0) {
                    return splunk_util.sprintf(
                        _('%s must be a positive number or "auto".').t(),
                        this.humanizeAttr(attr)
                    );
                }
            },

            validateBoolean: function(value, attr) {
                if(!general_utils.isBooleanEquivalent(value)) {
                    return splunk_util.sprintf(
                        _('%s must be a valid boolean value').t(),
                        this.humanizeAttr(attr)
                    );
                }
            },

            humanizeAttr: function(attr) {
                switch(attr){
                    case 'display.visualizations.charting.axisLabelsX.majorUnit':
                        return _('X-Axis Interval').t();
                    case 'display.visualizations.charting.axisLabelsY.majorUnit':
                    case 'display.visualizations.charting.axisLabelsY2.majorUnit':
                        return _('Y-Axis Interval').t();
                    case 'display.visualizations.charting.axisX.minimumNumber':
                        return _('X-Axis Min Value').t();
                    case 'display.visualizations.charting.axisY.minimumNumber':
                    case 'display.visualizations.charting.axisY2.minimumNumber':
                        return _('Y-Axis Min Value').t();
                    case 'display.visualizations.charting.axisX.maximumNumber':
                        return _('X-Axis Max Value').t();
                    case 'display.visualizations.charting.axisY.maximumNumber':
                    case 'display.visualizations.charting.axisY2.maximumNumber':
                        return _('Y-Axis Max Value').t();
                    case 'display.visualizations.charting.layout.splitSeries':
                        return _('Split Series Mode').t();
                    case 'display.events.table.drilldown':
                        return _('Event Drilldown').t();
                    case 'display.statistics.wrap':
                    case 'display.events.list.wrap':
                    case 'display.events.table.wrap':
                        return _('Wrap Results').t();
                    case 'display.statistics.rowNumber':
                    case 'display.events.rowNumbers':
                        return _('Row Numbers').t();
                    default:
                        return attr;
                }
            },

            attrToArray: function(attr) {
                return Visualization.parseStringifiedArray(this.get(attr));
            },

            rangesValuesToArray: function() {
                return this.attrToArray('display.visualizations.charting.chart.rangeValues');
            },

            deserializeGaugeColorArray: function() {
                return Visualization.parseStringifiedColorArray(this.get('display.visualizations.charting.gaugeColors'));
            },

            // use auto mode only if ranges and colors are both not defined
            gaugeIsInAutoMode: function() {
                return !this.get('display.visualizations.charting.chart.rangeValues') && !this.get('display.visualizations.charting.gaugeColors');
            }
        },
        {
            CHARTING_ATTRS_FILTER: ['^display.visualizations.charting...*'],
            SINGLE_VALUE_ATTRS_FILTER: ['^singlevalue\..*'],

            filterToValidRangeValues: function(rangeValues) {
                if(_(rangeValues).isString()) {
                    rangeValues = Visualization.parseStringifiedArray(rangeValues);
                }
                rangeValues = _(rangeValues).chain().map(parseFloat).filter(function(val) { return !_(val).isNaN(); }).uniq().value();
                var runningMax = -Infinity;
                rangeValues = _(rangeValues).filter(function(val) {
                    if(val < runningMax) {
                        return false;
                    }
                    runningMax = val;
                    return true;
                });
                return rangeValues;
            },

            parseStringifiedArray: function(value) {
                if(!value){
                    return [];
                }
                var parsedValues = [];
                // SPL-80318 wrap this call to JSON.parse in a try-catch because the input could be invalid JSON
                try {
                    parsedValues = _.values(JSON.parse(value));
                }
                catch(e) {}
                return parsedValues;
            },

            parseStringifiedColorArray: function(value) {
                if(_(value).isArray()) {
                    return value;
                }
                if(!value || value.charAt(0) !== '[' || value.charAt(value.length - 1) !== ']') {
                    return false; //need to find a different way to bail
                }
                return splunk_util.stringToFieldList(value.substring(1, value.length - 1));
            }

        });

        return Visualization;
    }
);

define('views/shared/vizcontrols/Master',
    [
        'jquery',
        'underscore',
        'backbone',
        'module',
        'views/Base',
        'views/shared/controls/SyntheticSelectControl',
        'views/shared/vizcontrols/Format',
        'models/services/search/IntentionsParser',
        'models/shared/Visualization'
    ],
    function($, _, Backbone, module, BaseView, SyntheticSelectControl, Format, IntentionsParser, VisualizationModel) {
        return BaseView.extend({

            moduleId: module.id,

            vizToAttrs: {
                line: {
                    'display.visualizations.charting.chart': 'line',
                    'display.visualizations.type': 'charting',
                    'display.general.type': 'visualizations'
                },
                area: {
                    'display.visualizations.charting.chart': 'area',
                    'display.visualizations.type': 'charting',
                    'display.general.type': 'visualizations'
                },
                column: {
                    'display.visualizations.charting.chart': 'column',
                    'display.visualizations.type': 'charting',
                    'display.general.type': 'visualizations'
                },
                bar: {
                    'display.visualizations.charting.chart': 'bar',
                    'display.visualizations.type': 'charting',
                    'display.general.type': 'visualizations'
                },
                pie: {
                    'display.visualizations.charting.chart': 'pie',
                    'display.visualizations.type': 'charting',
                    'display.general.type': 'visualizations'
                },
                scatter: {
                    'display.visualizations.charting.chart': 'scatter',
                    'display.visualizations.type': 'charting',
                    'display.general.type': 'visualizations'
                },
                radialGauge: {
                    'display.visualizations.charting.chart': 'radialGauge',
                    'display.visualizations.type': 'charting',
                    'display.general.type': 'visualizations'
                },
                fillerGauge: {
                    'display.visualizations.charting.chart': 'fillerGauge',
                    'display.visualizations.type': 'charting',
                    'display.general.type': 'visualizations'
                },
                markerGauge: {
                    'display.visualizations.charting.chart': 'markerGauge',
                    'display.visualizations.type': 'charting',
                    'display.general.type': 'visualizations'
                },
                single: {
                    'display.visualizations.type': 'singlevalue',
                    'display.general.type': 'visualizations'
                },
                events: {
                    'display.general.type': 'events'
                },
                statistics: {
                    'display.general.type': 'statistics'
                },
                mapping: {
                    'display.visualizations.type': 'mapping',
                    'display.general.type': 'visualizations'
                }
            },

            visualizationGroupings: {
                "events": {
                    label: 'g1',
                    items: [
                        { value: 'events', label: _("Events").t(), icon: 'list' }
                    ]
                },
                 "statistics": {
                    label: 'g2',
                    items: [
                        {value: 'statistics', label: _("Statistics Table").t(), icon: 'table' }
                    ]
                },
                "visualizations": {
                    label: 'g3',
                    items: [
                        { value: 'line', label: _("Line").t(), icon: 'chart-line' },
                        { value: 'area', label: _("Area").t(), icon: 'chart-area' },
                        { value: 'column', label: _("Column").t(), icon: 'chart-column' },
                        { value: 'bar', label: _("Bar").t(), icon: 'chart-bar' },
                        { value: 'pie', label: _("Pie").t(), icon: 'chart-pie' },
                        { value: 'scatter', label: _("Scatter").t(), icon: 'chart-scatter' },
                        { value: 'single', label: _("Single Value").t(), icon: 'single-value' },
                        { value: 'radialGauge', label: _("Radial Gauge").t(), icon: 'gauge-radial' },
                        { value: 'fillerGauge', label: _("Filler Gauge").t(), icon: 'gauge-filler' },
                        { value: 'markerGauge', label: _("Marker Gauge").t(), icon: 'gauge-marker' },
                        { value: 'mapping', label: _("Map").t(), icon: 'location' }
                    ]
                }
            },

            reportTree: {
                'match': {
                    'display.general.type': {
                        'visualizations' : {
                            'match': {
                                'display.visualizations.type': {
                                    'singlevalue': {
                                        'view': 'single'
                                    },
                                    'charting': {
                                        'match': {'display.visualizations.charting.chart': {
                                                'line': {  'view': 'line' },
                                                'area': { 'view': 'area' },
                                                'column': { 'view': 'column' },
                                                'bar': { 'view': 'bar' },
                                                'pie': { 'view': 'pie' },
                                                'scatter': { 'view': 'scatter' },
                                                'radialGauge': { 'view': 'radialGauge' },
                                                'fillerGauge': { 'view': 'fillerGauge' },
                                                'markerGauge': { 'view': 'markerGauge' }
                                            }
                                        }
                                    },
                                    'mapping': {
                                        view: 'mapping'
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

            commandToChartType: {
                "timechart" : ["line", "area", "column", "statistics"],
                //"chart" : ["column", "line", "area", "bar", "pie", "scatter", "radialGauge", "fillerGauge", "markerGauge", "statistics"],
                "top" : ["column", "bar", "pie", "statistics"],
                "rare" : ["column", "bar", "pie", "statistics"],
                "predict": ["line", "statistics"],
                "geostats": ["mapping"]
            },

            allowedVizTypes: ['events', 'statistics', 'visualizations'],

            events: {
                'click .format': function(e) {
                    e.preventDefault();
                    var $target = $(e.currentTarget);
                    this.setVisualizationFromReport();
                    this.children.format = new Format({
                        model: {
                            report: this.model.report,
                            visualization: this.model.visualization
                        },
                        onHiddenRemove: true,
                        saveOnApply: this.options.saveOnApply,
                        ignoreClasses: ['color-picker-container', 'select2-drop', 'select2-drop-mask', 'dropdown-menu']
                    });
                    this.children.format.render().activate().appendTo($('body'));
                    this.children.format.show($target);
                    $target.addClass('active');

                    this.listenTo(this.children.format, 'hidden', function() {
                        $target.removeClass('active');
                    });
                }
            },

            /**
             * @param {Object} options {
             *     model: {
             *         report: <models.search.Report>,
             *         application: <models.shared.Application>
             *     },
             *     visualizationTypes (required): [events &| statistics &| visualizations],
             *     saveOnApply: <Boolean> whether to save the report when any changes are submitted
             *     bindToChangeOfSearch: <Boolean> whether to bind to changes of the search string and update recommendations
             *     dashboard: TODO [sff] what does this do?
             * }
             */
            initialize: function() {
                BaseView.prototype.initialize.apply(this, arguments);

                var defaults = {
                    bindToChangeOfSearch: true,
                    saveOnApply: false
                };
                this.options = $.extend(true, defaults, this.options);
                this.recommendations = [];

                if(!_.isArray(this.options.vizTypes) || this.options.vizTypes.length === 0) {
                    throw new Error('Vizcontrols Master must be instantiated with at least one viz type');
                }
                _(this.options.vizTypes).each(function(type) {
                    if(!_(this.allowedVizTypes).contains(type)) {
                        throw new Error(type + ' is not an allowed viz type');
                    }
                }, this);

                this.model.intentionsParser = new IntentionsParser();
                this.model.visualization = new VisualizationModel();
                this.activate();
            },
            startListening: function() {
                this.listenTo(this.model.intentionsParser, 'change', this.handleIntentionsParserUpdate);
                this.listenTo(this.model.report.entry.content, 'change:display.general.type', function(model, value, options) {
                    if (_.indexOf(this.options.vizTypes, value)>-1) {
                        this.updateVizTypeChildView({ activate: true });
                    }
                });
                
                this.listenTo(this.model.visualization, 'change:viz_type', function() {
                    var viz = this.model.visualization.get('viz_type');
                    this.model.report.entry.content.set('viz_type', viz);
                    this.model.report.entry.content.set(this.vizToAttrs[viz]);
                    this.model.visualization.set(this.vizToAttrs[viz]);
                    if(this.options.saveOnApply) {
                        this.model.report.save();
                    }
                });
                
                this.listenTo(this.model.report.entry.content, 'change:search change:id', this.updateVizTypeVisibility);

                if (this.options.bindToChangeOfSearch) {
                    this.listenTo(this.model.report.entry.content, 'change:search', this.intentionsFetch); //simplexml
                }
            },
            activate: function(options) {
                if (this.active) {
                    return BaseView.prototype.activate.apply(this, arguments);
                }

                this.model.visualization.set({dashboard: this.options.dashboard});
                // the child view will be activated when we call super below
                this.updateVizTypeChildView({ activate: false });

                this.intentionsFetch();
                return BaseView.prototype.activate.apply(this, arguments);
            },

            deactivate: function(options) {
                if (!this.active) {
                    return BaseView.prototype.deactivate.apply(this, arguments);
                }
                BaseView.prototype.deactivate.apply(this, arguments);
                this.model.intentionsParser.fetchAbort();
                this.model.intentionsParser.clear({setDefaults: true});
                this.model.visualization.clear({setDefaults: true});
                return this;
            },

            intentionsFetch: function() {
                this.model.intentionsParser.fetch({
                    data: {
                        q: this.model.report.entry.content.get('search'),
                        app: this.model.application.get('app'),
                        owner: this.model.application.get('owner'),
                        parse_only: true
                    }
                });
            },

            handleIntentionsParserUpdate: function() {
                var newRecommendations = this.getRecommendations();
                if(!_.isEqual(newRecommendations, this.recommendations)) {
                    this.recommendations = newRecommendations;
                    this.updateVizTypeChildView({ activate: true });
                }
            },

            updateVizTypeVisibility: function() {
                if (!this.children.visualizationType || !this.model.visualization.get('dashboard')){
                    return;
                }

                if (this.model.report.isPivotReport() && !this.model.report.isNew()){
                    this.children.visualizationType.disable();
                    this.children.visualizationType.tooltip({animation:false, title:_('Edit visualization with the pivot tool.').t(), container: 'body'});
                } else {
                    this.children.visualizationType.enable();
                    this.children.visualizationType.tooltip('disable');
                }
            },

            getRecommendations: function() {
                var reportsSearch = this.model.intentionsParser.get('reportsSearch');
                if(!reportsSearch) {
                    return ['events'];
                }
                var reportingCommand = reportsSearch.replace(/\s{2,}/g, ':::').split(':::')[0];
                if(this.model.intentionsParser.has('commands')) {
                    var commands = _(this.model.intentionsParser.get('commands')).pluck('command');
                    if(_(commands).contains('predict')) {
                        reportingCommand = 'predict';
                    }
                    else if(_(commands).contains('geostats')) {
                        reportingCommand = 'geostats';
                    }
                }
                return this.commandToChartType[reportingCommand] || [];
            },

            setVisualizationFromReport: function() {
                this.model.report.entry.content.unset('viz_type');
                var toSetOnViz = $.extend({}, this.model.report.entry.content.toJSON());
                // SPL-76456, pre-filter out any invalid gauge range values from the incoming attributes
                // this will be consistent with the renderer which uses the valid values even if some are invalid
                var validRanges = VisualizationModel.filterToValidRangeValues(toSetOnViz['display.visualizations.charting.chart.rangeValues']);
                toSetOnViz['display.visualizations.charting.chart.rangeValues'] = validRanges.length > 0 ? JSON.stringify(validRanges) : '';
                // SPL-80495, also pre-validate the gauge color values
                var validColors = VisualizationModel.parseStringifiedColorArray(toSetOnViz['display.visualizations.charting.gaugeColors']);
                toSetOnViz['display.visualizations.charting.gaugeColors'] = (validColors && validColors.length > 0) ? validColors : '';
                // make sure the visualization model will be in a valid state
                // any attributes that are not valid are not set
                _(toSetOnViz).each(function(value, key) {
                    if(this.model.visualization.preValidate(key, value)) {
                        delete toSetOnViz[key];
                    }
                }, this);
                this.model.visualization.set(toSetOnViz);
                var viewObj = this.setVizType(this.reportTree), view;
                view = (viewObj && viewObj.view) ? viewObj.view : 'column';
                this.model.visualization.set('viz_type', view);
            },

            updateVizTypeChildView: function(options) {
                if(this.children.visualizationType) {
                    this.children.visualizationType.remove();
                }
                this.setVisualizationFromReport();
                var vizDropdown = [];
                _(this.options.vizTypes).each(function(value) {
                    var groupConfig = $.extend(true, {}, this.visualizationGroupings[value]);
                    _(groupConfig.items).each(function(item) {
                        if(_(this.recommendations).contains(item.value)) {
                            item.description = _("Recommended").t();
                        }
                    }, this);
                    vizDropdown.push(groupConfig);
                },this);

                if(vizDropdown.length === 0) {
                    throw new Error('Vizcontrols Master updateVizTypeChildView(), no compatible groups');
                }
                this.children.visualizationType = new SyntheticSelectControl({
                    model: this.model.visualization,
                    groupedItems: vizDropdown,
                    className: "dropdown pull-left",
                    toggleClassName: 'btn-pill',
                    modelAttribute: 'viz_type',
                    menuClassName: 'viz-dropdown',
                    popdownOptions: {
                        attachDialogTo: 'body'
                    }
                });
                this.children.visualizationType.render().prependTo(this.el);
                if(options && options.activate) {
                    this.children.visualizationType.activate();
                }
                this.updateVizTypeVisibility();
            },

            setVizType: function(reportTree) {
                if (reportTree && reportTree.view){
                    return reportTree;
                } else if (reportTree && reportTree.match){
                    var match;
                    _(reportTree.match).each(function(v, k){
                       match = v[this.model.report.entry.content.get(k)];
                    }, this);
                    if (match) return this.setVizType(match);
                }
            },

            render: function() {
                if(this.children.visualizationType) {
                    this.children.visualizationType.detach();
                }
                this.$el.empty();
                if(this.children.visualizationType) {
                    this.children.visualizationType.prependTo(this.el);
                }
                this.$el.append(this.compiledTemplate());
                return this;
            },

            template: '\
                <div class="btn-group pull-left">\
                    <a class="btn-pill popdown-toggle format" href="#">\
                        <i class="icon-paintbrush"/><span class="link-label"><%- _("Format").t() %></span><span class="caret"></span>\
                    </a>\
                </div>\
            '
        });
    }
);

define('views/shared/reportcontrols/details/History',
    [
        'module',
        'views/Base'
    ],
    function(module, Base) {
        return Base.extend({
            moduleId: module.id,
            tagName: 'span',
            initialize: function() {
                Base.prototype.initialize.apply(this, arguments);
                this.model.entry.on('change:updated', this.render, this);

            },
            render: function() {
                this.$el.html(this.compiledTemplate({model: this.model}));
                return this;
            },
            template: '\
                Created June 18, 2010. Modified <%- model.entry.get("updated") %>.\
            '
        });
    }
);

define('views/shared/reportcontrols/details/Creator',
    [
        'underscore',
        'module',
        'views/Base',
        'uri/route',
        'splunk.util'
    ],
    function(_, module, Base, route, splunkUtil) {
        return Base.extend({
            moduleId: module.id,
            tagName: 'span',
            initialize: function() {
                Base.prototype.initialize.apply(this, arguments);
                this.model.report.entry.content.on('change:display.page.pivot.dataModel', this.render, this);
            },
            render: function() {
                var createdByRoute,
                    createdByAnchor,
                    root = this.model.application.get('root'),
                    locale = this.model.application.get('locale'),
                    app = this.model.application.get('app');
                if (this.model.report.openInView() === 'pivot') {
                    createdByRoute = route.pivot(root, locale, app, {data: {s: this.model.report.id}});
                    createdByAnchor = '<a href="' + createdByRoute +'" >' + _("Pivot").t() +'</a>';
                } else {
                    createdByRoute = route.search(root, locale, app, {data: {s: this.model.report.id}});
                    createdByAnchor = '<a href="' + createdByRoute +'" >' + _("Search").t() +'</a>';
                }
                this.$el.html(this.compiledTemplate({
                    _: _,
                    splunkUtil: splunkUtil,
                    createdByAnchor: createdByAnchor
                }));
                return this;
            },
            template: '\
                <%= splunkUtil.sprintf(_("Created by %s.").t(), createdByAnchor) %>\
            '
        });
    }
);

define('views/shared/documentcontrols/details/App',
    [
        'module',
        'views/Base'
    ],
    function(module, Base) {
        return Base.extend({
            moduleId: module.id,
            tagName: 'span',
            initialize: function() {
                Base.prototype.initialize.apply(this, arguments);
                this.model.entry.acl.on('change:app', this.render, this);
            },
            render: function() {
                this.$el.html(this.compiledTemplate({model: this.model}));
                return this;
            },
            template: '\
                <%- model.entry.acl.get("app") %>\
            '
        });
    }
);

define('models/shared/Cron',
    [
        'jquery',
        'underscore',
        'models/Base',
        'splunk.util'
    ],
    function($, _, BaseModel, splunkUtil) {
        var Cron = BaseModel.extend({
            initialize: function() {
                BaseModel.prototype.initialize.apply(this, arguments);
            },
            defaults: {
                minute: '0',
                hour: '6',
                dayOfMonth: '*',
                month: '*',
                dayOfWeek: "1",
                cronType: 'weekly',
                cron_schedule: '0 6 * * 1'
            },
            validation: {
                'cron_schedule': function(value, attr, computedState) {
                    var type = computedState['ui.type'] || 'scheduled';
                    if (type === 'scheduled' && computedState['cronType'] === 'custom') {
                        if (_.isUndefined(value) || $.trim(value).length === 0) {
                            return _("Custom cron is required").t();
                        }
                        if (!splunkUtil.validateCronString(value)) {
                            return _("Invalid cron").t();
                        }
                    }
                }
            },
            setCronType: function(options) {
                var minute = this.get('minute'),
                    hour = this.get('hour'),
                    dayOfMonth = this.get('dayOfMonth'),
                    month = this.get('month'),
                    dayOfWeek = this.get('dayOfWeek');

                //outliers
                if (month !== "*") {
                    this.set('cronType', Cron.CRON_TYPES.CUSTOM, options);
                    return;
                }

                //if day of week is not * then we to test for weekly
                if (/^[0-6]$/.test(dayOfWeek)) {
                    if (
                        (minute === '0') &&
                        (/^([0-9]|1[0-9]|2[0-3])$/.test(hour)) &&
                        (dayOfMonth === '*')
                    ) {
                        this.set('cronType', Cron.CRON_TYPES.WEEKLY, options);
                        return;
                    }
                } else if (dayOfWeek === '*') {
                    //test for monthly
                    if (/^([0-9]|[1-2][0-9]|3[0-1])$/.test(dayOfMonth)) {
                        if (
                            (/^([0-9]|1[0-9]|2[0-3])$/.test(hour)) &&
                            (minute === '0')
                        ) {
                            this.set('cronType', Cron.CRON_TYPES.MONTHLY, options);
                            return;
                        }
                    } else if (dayOfMonth === '*') {
                        //test for daily by testing hour
                        if (
                            (/^([0-9]|1[0-9]|2[0-3])$/.test(hour)) &&
                            (minute === '0')
                        ) {
                            this.set('cronType', Cron.CRON_TYPES.DAILY, options);
                            return;
                        } else if (
                            hour === '*' &&
                            (/^(0|15|30|45)$/.test(minute))
                        ) {
                            this.set('cronType', Cron.CRON_TYPES.HOURLY, options);
                            return;
                        }
                    }
                }

                this.set('cronType', Cron.CRON_TYPES.CUSTOM, options);
            },
            setDefaults: function() {
                switch (this.get('cronType')) {
                    case Cron.CRON_TYPES.HOURLY:
                        this.set('minute', '0');
                        break;
                    case Cron.CRON_TYPES.DAILY:
                        this.set('hour', '0');
                        break;
                    case Cron.CRON_TYPES.WEEKLY:
                        this.set({
                            dayOfWeek: '1',
                            hour: '0'
                        });
                        break;
                    case Cron.CRON_TYPES.MONTHLY:
                        this.set({
                            dayOfMonth: '1',
                            hour: '0'
                        });
                        break;
                }
            },
            getCronString: function() {
                var minute = this.get('minute'),
                    hour = this.get('hour'),
                    dayOfMonth = this.get('dayOfMonth'),
                    month = this.get('month'),
                    dayOfWeek = this.get('dayOfWeek'),
                    cron_schedule = this.get('cron_schedule'),
                    cronType = this.get('cronType');

                switch(cronType) {
                    case Cron.CRON_TYPES.HOURLY:
                        return minute + ' * * * *';
                    case Cron.CRON_TYPES.DAILY:
                        return '0 ' + hour +  ' * * *';
                    case Cron.CRON_TYPES.WEEKLY:
                        return '0 ' + hour +  ' * * ' + dayOfWeek;
                    case Cron.CRON_TYPES.MONTHLY:
                        return '0 ' + hour + ' ' + dayOfMonth + ' * *';
                    case Cron.CRON_TYPES.CUSTOM:
                        return cron_schedule;
                }
            },
            getDayOfWeekName: function() {
                return Cron.getDayOfWeekNameFromNum(parseInt(this.get('dayOfWeek'), 10));
            },
            getScheduleString: function() {
                switch(this.get('cronType')) {
                    case 'hourly':
                        return splunkUtil.sprintf(_("Hourly, at %s minutes past the hour.").t(), this.get('minute'));
                    case 'daily':
                        return splunkUtil.sprintf(_("Daily, at %s:00.").t(), this.get('hour'));
                    case 'weekly':
                        return splunkUtil.sprintf(_("Weekly, %(dayOfWeek)s at %(hour)s:00.").t(), { dayOfWeek: this.getDayOfWeekName(), hour: this.get('hour')});
                    case 'monthly':
                        return splunkUtil.sprintf(_("Monthly, on day %(dayOfMonth)s at %(hour)s:00.").t(), { dayOfMonth: this.get('dayOfMonth'), hour: this.get('hour')});
                    case 'custom':
                        return _("Cron Schedule.").t();
                }
            }
        },
        // class-level properties
        {
            createFromCronString: function(cronString) {
                var pieces = cronString.trim().split(/\s+/);
                if(!pieces || pieces.length !== 5) {
                    throw splunkUtil.sprintf(_("Invalid cron string: %s").t(), cronString);
                }
                // the above only verifies that the time string had the correct format,
                // next make sure it also represents a valid time
                var cronModel = new Cron({
                    minute: pieces[0],
                    hour: pieces[1],
                    dayOfMonth: pieces[2],
                    month: pieces[3],
                    dayOfWeek: pieces[4],
                    cron_schedule: pieces.join(' ')
                });

                cronModel.setCronType();
                return cronModel;
            },
            getDayOfWeekNameFromNum: function(dayOfWeekNum) {
                switch(dayOfWeekNum) {
                    case 0:
                        return _("Sunday").t();
                    case 1:
                        return _("Monday").t();
                    case 2:
                        return _("Tuesday").t();
                    case 3:
                        return _("Wednesday").t();
                    case 4:
                        return _("Thursday").t();
                    case 5:
                        return _("Friday").t();
                    case 6:
                        return _("Saturday").t();
                    case 7:
                        return _("Sunday").t();
                }
            },
            CRON_TYPES : {
                HOURLY: 'hourly',
                DAILY: 'daily',
                WEEKLY: 'weekly',
                MONTHLY: 'monthly',
                CUSTOM: 'custom'
            }
        });

        return Cron;
    }
);

define('views/shared/reportcontrols/details/Schedule',
    [
        'underscore',
        'module',
        'views/Base',
        'models/shared/Cron',
        'util/time',
        'splunk.util'
    ],
    function(_, module, Base, Cron, time_utils, splunkUtil) {
        return Base.extend({
            moduleId: module.id,
            tagName: 'span',
            initialize: function() {
                Base.prototype.initialize.apply(this, arguments);
                var render = _.debounce(this.render, 0);
                this.model.entry.content.on('change:is_scheduled change:cron_schedule change:action.email change:action.script', render, this);
            },
            render: function() {
                var text = _('Not Applicable for Real-time Reports.').t();

                // Check if real-time
                if (!this.model.isRealTime()) {
                    if (this.model.entry.content.get("is_scheduled")) {
                        this.cronModel = Cron.createFromCronString(this.model.entry.content.get('cron_schedule'));
                        text = this.cronModel.getScheduleString();
                        if (this.model.entry.content.get("action.email") || this.model.entry.content.get("action.script")) {
                            text += splunkUtil.sprintf(_(' Actions: %s.').t(), this.model.getStringOfActions());
                        } else {
                            text += _(" No actions.").t();
                        }
                    } else {
                        text = _("Not scheduled.").t();
                    }
                }

                this.$el.html(text);
            }
        });
    }
);

/**
 *   views/shared/delegates/ModalTimerangePicker
 *
 *   Desc:
 *     Work in progress, a delegate view to handle timerange pickers located in modals. 
 *       It provides the animation from the content view to the timerangepicker view and back. 
 *
 *   @param {Object} (Optional) options An optional object literal having one settings.
 *
 *    Usage:
 *       var p = new ModalTimerangePicker({options})
 *
 *    Options:
 *        el: The dialog and toggle container. Recommend that this is the offset container for the dialog.
 *        $visArea: jQuery object that is the visible area.
 *        $slideArea: jQuery object that slides left and right.
 *        $contentWrapper: jQuery object that holds the original content with the activator.
 *        $timeRangePickerWrapper: jQuery object that holds the timerange picker.
 *        $modalParent: jQuery object of the modal.
 *        $timeRangePicker: jQuery object of the timerange picker.
 *        activateSelector: jQuery selector that when clicked causes the animation to the timerangepicker.
 *        backButtonSelector: jQuery selector that when clicked causes the animation from the timerangepicker
 *                               back to the content view without changing the timerange.
 *        SLIDE_ANIMATION_DURATION: (Optional) time to perform animation. Default 500.
 *
 *    Methods:
 *        showTimeRangePicker: animates to the timerangepicker from content view.
 *        closeTimeRangePicker: animates from the timerangepicker to content view.
 *                               Should be called when applied is triggered on the timerange model.
 *        onBeforePaneAnimation: sets up for animation (directly calling show should be avoided and should not be necessary).
 *        onAfterPaneAnimation: clean up after animation (directly calling show should be avoided and should not be necessary).
 */


define('views/shared/delegates/ModalTimerangePicker',[
    'jquery',
    'underscore',
    'views/shared/delegates/Base',
    'views/shared/delegates/PopdownDialog',
    'views/shared/Modal'
],function(
    $,
    _,
    DelegateBase,
    PopdownDialog,
    Modal
){
    return DelegateBase.extend({
        initialize: function(){
            var defaults = {
               SLIDE_ANIMATION_DURATION: 500
            };

            _.defaults(this.options, defaults);

            this.$visArea = this.options.$visArea;
            this.$slideArea = this.options.$slideArea;
            this.$contentWrapper = this.options.$contentWrapper;
            this.$timeRangePickerWrapper = this.options.$timeRangePickerWrapper;
            this.$modalParent = this.options.$modalParent;
            this.$timeRangePicker = this.options.$timeRangePicker;

            this.title = this.$(Modal.HEADER_TITLE_SELECTOR).html();

            this.events = {};
            this.events["click " + this.options.backButtonSelector] = "closeTimeRangePicker";
            this.events["click " + this.options.activateSelector] = "showTimeRangePicker";
            this.delegateEvents(this.events);

            this.$timeRangePicker.hide();

        },
        showTimeRangePicker: function (e) {
            var $from = this.$contentWrapper,
                $to = this.$timeRangePickerWrapper,
                anamateDistance = $from.width();

            this.onBeforePaneAnimation($from, $to);

            var toWidth = $to.width(),
                toHeight = $to.height();

            this.$modalParent.animate({
                width: toWidth,
                marginLeft: -(2 * anamateDistance/3)
            }, {
                duration: this.options.SLIDE_ANIMATION_DURATION
            });
            this.$visArea.animate({
                height: toHeight
            }, {
                duration: this.options.SLIDE_ANIMATION_DURATION,
                complete: function() {
                    this.onAfterPaneAnimation($from, $to);
                }.bind(this)
            }, this);

            this.$slideArea.animate({
                marginLeft: -anamateDistance
            }, {
                duration: this.options.SLIDE_ANIMATION_DURATION
            });

            this.$el.animate({
                width: toWidth
            }, {
                duration: this.options.SLIDE_ANIMATION_DURATION
            });

            this.$(Modal.HEADER_TITLE_SELECTOR).html(_("Select Time Range").t());
            this.$('.btn.back').show();
            this.$('.btn-primary').hide();
            this.$('.btn.cancel').hide();

            if (e) {
                e.preventDefault();
            }
        },
        closeTimeRangePicker: function (e) {
            var $from = this.$timeRangePickerWrapper,
                $to = this.$contentWrapper,
                anamateDistance = $to.width();

            this.onBeforePaneAnimation($from, $to);

            this.$modalParent.animate({
                width: anamateDistance,
                marginLeft: -(anamateDistance/2)
            }, {
                duration: this.options.SLIDE_ANIMATION_DURATION,
                complete: function() {
                    //undo width and margin so applied classes continue to work
                    this.$modalParent.css({ width: ''});
                    this.$modalParent.css({ marginLeft: ''});
                }.bind(this)
            });

            this.$visArea.animate({
                height: $to.height()
            }, {
                duration: this.options.SLIDE_ANIMATION_DURATION,
                complete: function() {
                    this.onAfterPaneAnimation($from, $to);
                }.bind(this)
            }, this);

            this.$slideArea.animate({
                marginLeft: 0
            }, {
                duration: this.options.SLIDE_ANIMATION_DURATION
            });

            this.$el.animate({
                width: anamateDistance
            }, {
                duration: this.options.SLIDE_ANIMATION_DURATION
            });

            this.$(Modal.HEADER_TITLE_SELECTOR).html(this.title);
            this.$('.btn.back').hide();
            this.$('.btn-primary').show();
            this.$('.btn.cancel').show();

            if (e) {
                e.preventDefault();
            }
        },

        // sets up heights of the 'from' and 'to' elements for a smooth animation
        // during the animation, the slide area uses overflow=hidden to control visibility of the 'from' pane
        onBeforePaneAnimation: function($from, $to) {
            this.$visArea.css('overflow', 'hidden');
            this.$visArea.css({ height: $from.height() + 'px'});
            if($to === this.$timeRangePickerWrapper) {
                this.$timeRangePicker.show();
            }
            $to.css({ height: '', visibility: '' });
        },
        // undo the height manipulations that were applied to make a smooth animation
        // after the animation, the 'from' is hidden via display=none and the slide area has visible overflow
        // (this prevents vertical clipping of popup menus)
        onAfterPaneAnimation: function($from, $to) {
            if($from === this.$timeRangePickerWrapper) {
                this.$timeRangePicker.hide();
            }
            this.$visArea.css('overflow', '');
            this.$visArea.css({ height: ''});
            $from.css({ height: '2px', visibility : 'hidden'});
        }
    });
});

define('views/shared/ScheduleSentence',
    [
        'jquery',
        'module',
        'underscore',
        'views/Base',
        'views/shared/controls/ControlGroup',
        'views/shared/controls/SyntheticSelectControl',
        'uri/route',
        'splunk.util'
    ],
    function(
        $,
        module,
        _,
        BaseView,
        ControlGroup,
        SyntheticSelectControl,
        route,
        splunkUtil
    ){
        return BaseView.extend({
            moduleId: module.id,
            /**
            * @param {Object} options {
            *   model: {
            *       cron: <models.Cron>,
            *       application: <models.Application>
            *   }
            *   {String} lineOneLabel: (Optional) Label for the first line of the sentence. Defalult is none.
            *   {String} lineTwoLabel: (Optional) Label for the second line of the sentence. Defalult is none.
            * }
            */
            initialize: function() {
                BaseView.prototype.initialize.apply(this, arguments);

                var defaults = {
                    lineOneLabel: '',   
                    lineTwoLabel: ''
                };

                _.defaults(this.options, defaults);

                var makeItems = function(num) {
                        var stringNum = num.toString(); 
                        return { label: stringNum, value: stringNum};
                    },
                    hourly = _.map(_.range(0, 46, 15), makeItems),
                    daily = _.map(_.range(24), function(num) { 
                        return { label: num + ':00', value: num.toString()};
                    }),
                    monthly = _.map(_.range(1,32), makeItems);

                this.children.timeRange = new ControlGroup({
                    className: 'control-group',
                    controlType: 'SyntheticSelect',
                    controlClass: 'controls-block',
                    controlOptions: {
                        modelAttribute: 'cronType',
                        model: this.model.cron,
                        items: [
                            { label: _('Run every hour').t(), value: 'hourly' },
                            { label: _('Run every day').t(), value: 'daily' },
                            { label: _('Run every week').t(), value: 'weekly' },
                            { label: _('Run every month').t(), value: 'monthly' },
                            { label: _('Run on Cron Schedule').t(), value: 'custom' }
                        ],
                        save: false,
                        toggleClassName: 'btn',
                        labelPosition: 'outside',
                        elastic: true,
                        popdownOptions: $.extend(true, {}, this.options.popdownOptions)
                    },
                    label: this.options.lineOneLabel
                });

                this.children.hourly = new SyntheticSelectControl({
                    additionalClassNames: 'schedule_hourly',
                    modelAttribute: 'minute',
                    model: this.model.cron,
                    items: hourly,
                    save: false,
                    toggleClassName: 'btn',
                    labelPosition: 'outside',
                    elastic: true,
                    popdownOptions: $.extend(true, {}, this.options.popdownOptions)
                });

                this.children.weekly = new SyntheticSelectControl({
                    additionalClassNames: 'schedule_weekly',
                    modelAttribute: 'dayOfWeek',
                    model: this.model.cron,
                    items: [
                        { label: _('Monday').t(),    value: '1'  },
                        { label: _('Tuesday').t(),   value: '2'  },
                        { label: _('Wednesday').t(), value: '3'  },
                        { label: _('Thursday').t(),  value: '4'  },
                        { label: _('Friday').t(),    value: '5'  },
                        { label: _('Saturday').t(),  value: '6'  },
                        { label: _('Sunday').t(),    value: '0'  }
                    ],
                    save: false,
                    toggleClassName: 'btn',
                    labelPosition: 'outside',
                    popdownOptions: $.extend(true, {}, this.options.popdownOptions)
                });

                this.children.monthly = new SyntheticSelectControl({
                    menuClassName: 'dropdown-menu-short',
                    additionalClassNames: 'schedule_monthly',
                    modelAttribute: 'dayOfMonth',
                    model: this.model.cron,
                    items: monthly,
                    save: false,
                    toggleClassName: 'btn',
                    labelPosition: 'outside',
                    popdownOptions: $.extend(true, {}, this.options.popdownOptions)
                });

                this.children.daily = new SyntheticSelectControl({
                    menuClassName: 'dropdown-menu-short',
                    additionalClassNames: 'schedule_daily',
                    modelAttribute: 'hour',
                    model: this.model.cron,
                    items: daily,
                    save: false,
                    toggleClassName: 'btn',
                    labelPosition: 'outside',
                    popdownOptions: $.extend(true, {}, this.options.popdownOptions)
                });

                this.children.scheduleOptions = new ControlGroup({
                    controls: [
                        this.children.hourly,
                        this.children.weekly,
                        this.children.monthly,
                        this.children.daily
                    ],
                    label: this.options.lineTwoLabel
                });

                var docRoute = route.docHelp(
                    this.model.application.get("root"),
                    this.model.application.get("locale"),
                    'learnmore.alert.scheduled'
                );
                this.children.cronSchedule = new ControlGroup({
                    controlType: 'Text',
                    controlClass: 'controls-block',
                    controlOptions: {
                        modelAttribute: 'cron_schedule',
                        model: this.model.cron
                    },
                    label: _('Cron Expression').t(),
                    help: splunkUtil.sprintf(_('e.g. 00 18 *** (every day at 6PM). %s').t(),
                        '<a href="'+ docRoute +'" class="help" target="_blank" title="' + 
                        _("Splunk help").t() +'">' + _("Learn More").t() + '</a>')
                });
                
                this.activate();
            },
            timeRangeToggle: function() {
                var $preLabel = this.children.scheduleOptions.$el.find('.pre_label'),
                    $hourPostLabel = this.children.scheduleOptions.$el.find('.hour_post_label'),
                    $weeklyPreLabel = this.children.scheduleOptions.$el.find('.weekly_pre_label'),
                    $monthlyPreLabel = this.children.scheduleOptions.$el.find('.monthly_pre_label'),
                    $dailyPreLabel = this.children.scheduleOptions.$el.find('.daily_pre_label'),
                    $customControls = this.$el.find('.custom_time');

                this.children.hourly.$el.hide();
                this.children.daily.$el.hide();
                this.children.weekly.$el.hide();
                this.children.monthly.$el.hide();

                $preLabel.hide();
                $hourPostLabel.hide();
                $weeklyPreLabel.hide();
                $monthlyPreLabel.hide();
                $dailyPreLabel.hide();

                $customControls.css('display', 'none');

                switch(this.model.cron.get('cronType')){
                    case 'hourly':
                        this.children.scheduleOptions.$el.show();
                        this.children.hourly.$el.css('display', '');
                        $preLabel.css('display', '');
                        $hourPostLabel.css('display', '');
                        break;
                    case 'daily':
                        this.children.scheduleOptions.$el.show();
                        this.children.daily.$el.css('display', '');
                        $preLabel.css('display', '');
                        break;
                    case 'weekly':
                        this.children.scheduleOptions.$el.show();
                        this.children.weekly.$el.css('display', '');
                        this.children.daily.$el.css('display', '');
                        $weeklyPreLabel.css('display', '');
                        $dailyPreLabel.css('display', '');
                        break;
                    case 'monthly':
                        this.children.scheduleOptions.$el.show();
                        this.children.monthly.$el.css('display', '');
                        this.children.daily.$el.css('display', '');
                        $monthlyPreLabel.css('display', '');
                        $dailyPreLabel.css('display', '');
                        break;
                    case 'custom':
                        $customControls.css('display', '');
                        this.children.scheduleOptions.$el.hide();
                        break;
                }
            },
            startListening: function() {
                this.listenTo(this.model.cron, 'change:cronType', function() {
                    this.timeRangeToggle();
                    this.model.cron.setDefaults();
                });
            },
            render: function()  {
                this.$el.append(this.children.timeRange.render().el);
                this.$el.append(this.children.scheduleOptions.render().el);

                this.children.scheduleOptions.$el.find('.schedule_hourly').before(
                    '<span class="pre_label">' + _("At ").t() + '</span>');
                this.children.scheduleOptions.$el.find('.schedule_hourly').after(
                    '<span class="hour_post_label">' + _(" minutes past the hour").t() + '</span>');

                this.children.scheduleOptions.$el.find('.schedule_weekly').before(
                    '<span class="weekly_pre_label">' + _("On ").t() + '</span>');
                this.children.scheduleOptions.$el.find('.schedule_weekly .btn').width('75px');

                this.children.scheduleOptions.$el.find('.schedule_monthly').before(
                    '<span class="monthly_pre_label">' + _("On day ").t() + '</span>');
                this.children.scheduleOptions.$el.find('.schedule_monthly .btn').width('55px');

                this.children.scheduleOptions.$el.find('.schedule_daily').before(
                    '<span class="daily_pre_label">' + _(" at ").t() + '</span>');
                this.children.scheduleOptions.$el.find('.schedule_daily .btn').width('50px');

                this.$el.append('<div class="custom_time"></div>');
                this.$el.find('.custom_time').append(this.children.cronSchedule.render().el);

                this.timeRangeToggle();

                return this;
            }
        });
     }
 );

define('views/shared/reportcontrols/dialogs/schedule_dialog/step1/Schedule',
        [
            'underscore',
            'module',
            'views/Base',
            'views/shared/Modal',
            'views/shared/ScheduleSentence',
            'views/shared/controls/ControlGroup'
        ],
        function(
            _,
            module,
            Base,
            Modal,
            ScheduleSentence,
            ControlGroup
        ) {
        return Base.extend({
            moduleId: module.id,
            className: 'form form-horizontal',
            /**
            * @param {Object} options {
            *        model: {
            *            application: <models.Application>
            *            inmem: <models.Report>,
            *            cron: <models.Cron>,
            *            timeRange: <models.TimeRange>,
            *            user: <models.services.admin.User>,
            *            appLocal: <models.services.AppLocal>
            *        },
            *        collection: <collections.services.data.ui.Times>
            * }
            **/
            initialize: function() {
                Base.prototype.initialize.apply(this, arguments);

                //views
                var checkBoxLabel = this.model.inmem.entry.content.get('disabled') ? _("Enable and Schedule Report").t() : _('Schedule Report').t();

                this.children.name = new ControlGroup({
                    controlType: 'Label',
                    controlOptions: {
                        modelAttribute: 'name',
                        model: this.model.inmem.entry
                    },
                    label: _('Report').t()
                });

                this.children.scheduleCheck = new ControlGroup({
                    controlType: 'SyntheticCheckbox',
                    controlOptions: {
                        modelAttribute: 'scheduled_and_enabled',
                        model: this.model.inmem
                    },
                    label: checkBoxLabel
                });

                this.children.scheduleSentence = new ScheduleSentence({
                    model: {
                        cron: this.model.cron,
                        application: this.model.application
                    },
                    lineOneLabel: _('Schedule').t(),
                    popdownOptions: {
                        attachDialogTo: '.modal:visible',
                        scrollContainer: '.modal:visible .modal-body:visible'
                    }
                });

                //event listeners
                this.model.inmem.on('change:scheduled_and_enabled', this.isScheduledToggle, this);
                this.model.timeRange.on('applied', function() {
                    this.model.inmem.entry.content.set({
                        'dispatch.earliest_time': this.model.timeRange.get('earliest'),
                        'dispatch.latest_time':this.model.timeRange.get('latest')
                    });
                    this.setLabel();
                }, this);
                this.model.timeRange.on('change:earliest_epoch change:latest_epoch change:earliest change:latest', _.debounce(this.setLabel, 0), this);

            },
            isScheduledToggle: function() {
                if(this.model.inmem.get('scheduled_and_enabled')) {
                    this.$('.modal-btn-primary').html(_("Next").t());
                    this.children.scheduleSentence.$el.show();
                    this.$('div.timerange').show();
                } else {
                    this.children.scheduleSentence.$el.hide();
                    this.$('div.timerange').hide();
                    this.$('.modal-btn-primary').html(_("Save").t());
                }
                this.model.inmem.trigger('togglePrimaryButton');
            },
            setLabel: function() {
                var timeLabel = this.model.timeRange.generateLabel(this.collection);
                this.$el.find("span.time-label").text(timeLabel);
            },
            render: function() {
                this.children.name.render().appendTo(this.$el);
                if (this.model.inmem.entry.content.get('disabled')) {
                    this.$el.append('<div>' + _('This report is currently disabled.').t() + '</div>');
                }
                this.children.scheduleCheck.render().appendTo(this.$el);
                this.children.scheduleSentence.render().appendTo(this.$el);

                this.$el.append('<div class="timerange" style="display: block;"><label class="control-label">' + _('Time Range').t() + '</label></div>');
                this.$('div.timerange').append('<div class="controls"><a href="#" class="btn timerange-control"><span class="time-label"></span><span class="icon-triangle-right-small"></span></a></div>');
                this.setLabel();
                this.isScheduledToggle();
                return this;
            }
        });
    }
);

define('views/shared/reportcontrols/dialogs/schedule_dialog/step1/Master',
        [
            'underscore',
            'module',
            'views/Base',
            'views/shared/Modal',
            'views/shared/delegates/ModalTimerangePicker',
            'views/shared/reportcontrols/dialogs/schedule_dialog/step1/Schedule',
            'views/shared/timerangepicker/dialog/Master',
            'views/shared/FlashMessages'
        ],
        function(
            _,
            module,
            Base,
            Modal,
            TimeRangeDelegate,
            ScheduleView,
            TimeRangePickerDialog,
            FlashMessage
        ) {
        return Base.extend({
            moduleId: module.id,
            /**
            * @param {Object} options {
            *        model: {
            *            application: <models.Application>
            *            inmem: <models.Report>,
            *            cron: <models.Cron>,
            *            timeRange: <models.TimeRange>,
            *            user: <models.services.admin.User>,
            *            appLocal: <models.services.AppLocal>
            *        },
            *        collection: <collections.services.data.ui.Times>
            * }
            **/
            initialize: function() {
                Base.prototype.initialize.apply(this, arguments);

                //views
                this.children.flashMessage = new FlashMessage({ model: this.model.cron });

                this.children.scheduleView = new ScheduleView({
                    model: {
                        application: this.model.application,
                        inmem: this.model.inmem,
                        cron: this.model.cron,
                        timeRange: this.model.timeRange,
                        user: this.model.user,
                        appLocal: this.model.appLocal
                    },
                    collection: this.collection
                });


                this.children.timeRangePickerView = new TimeRangePickerDialog({
                    model: {
                        timeRange: this.model.timeRange,
                        user: this.model.user,
                        appLocal: this.model.appLocal,
                        application: this.model.application
                    },
                    collection: this.collection,
                    showPresetsRealTime:false,
                    showCustomRealTime:false,
                    showCustomDate:false,
                    showCustomDateTime:false,
                    showPresetsAllTime:true,
                    enableCustomAdvancedRealTime:false,
                    appendSelectDropdownsTo: '.modal:visible'
                });

                this.model.timeRange.on('applied', function() {
                    this.timeRangeDelegate.closeTimeRangePicker();
                }, this);

                this.model.inmem.on('togglePrimaryButton', this.togglePrimaryButton, this);
            },
            events: {
                'click .modal-btn-primary' : function(e) {
                    if(this.model.inmem.get('scheduled_and_enabled')) {
                        this.model.inmem.trigger('next');
                    } else {
                        this.model.inmem.entry.content.set('is_scheduled', 0);
                        this.model.inmem.save({}, {
                            success: function(model, response){
                                this.model.inmem.trigger('saveSuccessNotScheduled');
                            }.bind(this)
                        });
                    }
                    e.preventDefault();
                }
            },
            togglePrimaryButton: function() {
                if(this.model.inmem.get('scheduled_and_enabled')) {
                    this.$('.modal-btn-primary').html(_("Next").t());
                } else {
                    this.$('.modal-btn-primary').html(_("Save").t());
                }
            },
            render: function() {
                this.$el.html(Modal.TEMPLATE);
                this.$(Modal.HEADER_TITLE_SELECTOR).html(_("Edit Schedule").t());

                this.$(Modal.BODY_SELECTOR).remove();

                this.$(Modal.FOOTER_SELECTOR).before(
                    '<div class="vis-area">' +
                        '<div class="slide-area">' +
                            '<div class="content-wrapper schedule-wrapper">' +
                                '<div class="' + Modal.BODY_CLASS + '" >' +
                                '</div>' +
                            '</div>' +
                            '<div class="timerange-picker-wrapper">' +
                            '</div>' +
                        '</div>' +
                    '</div>'
                );

                this.$visArea = this.$('.vis-area').eq(0);
                this.$slideArea = this.$('.slide-area').eq(0);
                this.$scheduleWrapper = this.$('.schedule-wrapper').eq(0);
                this.$timeRangePickerWrapper = this.$('.timerange-picker-wrapper').eq(0);
                this.$modalParent = $('.schedule-modal').eq(0);

                this.children.flashMessage.render().prependTo(this.$(Modal.BODY_SELECTOR));
                this.children.scheduleView.render().appendTo(this.$(Modal.BODY_SELECTOR));

                this.children.timeRangePickerView.render().appendTo(this.$timeRangePickerWrapper);

                this.timeRangeDelegate = new TimeRangeDelegate({
                    el: this.el,
                    $visArea: this.$visArea,
                    $slideArea: this.$slideArea,
                    $contentWrapper: this.$scheduleWrapper,
                    $timeRangePickerWrapper: this.$timeRangePickerWrapper,
                    $modalParent: this.$modalParent,
                    $timeRangePicker: this.children.timeRangePickerView.$el,
                    activateSelector: 'a.timerange-control',
                    backButtonSelector: 'a.btn.back'
                });

                this.$(Modal.FOOTER_SELECTOR).append(Modal.BUTTON_CANCEL);
                this.$(Modal.FOOTER_SELECTOR).append('<a href="#" class="btn btn-primary modal-btn-primary">' + _('Save').t() + '</a>');
                this.$(Modal.FOOTER_SELECTOR).append('<a href="#" class="btn back modal-btn-back pull-left">' + _('Back').t() + '</a>');
                this.$('.btn.back').hide();

                this.togglePrimaryButton();

                return this;
            }
        });
    }
);

define('views/shared/EmailOptions',
    [
        'underscore',
        'backbone',
        'module',
        'views/Base',
        'views/shared/controls/ControlGroup',
        'views/shared/controls/SyntheticSelectControl',
        'splunk.util',
        'uri/route'
    ],
    function(_, Backbone, module, Base, ControlGroup, SyntheticSelectControl, splunkUtil, route) {
        return Base.extend({
            moduleId: module.id,
             /**
             * @param {Object} options {
             *     model: {
             *         state: <models.Base>,
             *         application: <models.Application>
             *     }
             *     toLabel: <String> (Optional) Default 'To'
             *     suffix: <String> report|alert|view. Default report
             *     inculedSubjectDefaultPlaceholder: <bool> Default false
             * }
             */
            className: 'enable-actions-view',
            initialize: function() {
                Base.prototype.initialize.apply(this, arguments);

                var defaults = {
                    suffix: 'report',
                    toLabel: _('To').t(),
                    inculedSubjectDefaultPlaceholder: false
                };

                _.defaults(this.options, defaults);

                this.children.toEmailAddresses = new ControlGroup({
                    className: 'control-group',
                    controlType: 'Textarea',
                    controlClass: 'controls-block',
                    controlOptions: {
                        modelAttribute: 'action.email.to',
                        model: this.model.state
                    },
                    label: this.options.toLabel,
                    help: splunkUtil.sprintf(_('Comma separated list of email addresses. %s').t(),' <a href="#" class="show-cc-bcc">' + _("Show CC and BCC").t() + '</a>')
                });
                
                this.children.ccEmailAddresses = new ControlGroup({
                    className: 'control-group',
                    controlType: 'Textarea',
                    controlClass: 'controls-block',
                    controlOptions: {
                        modelAttribute: 'action.email.cc',
                        model: this.model.state,
                        placeholder: _('optional').t()
                    },
                    label: _('CC').t()
                });

                this.children.bccEmailAddresses = new ControlGroup({
                    className: 'control-group',
                    controlType: 'Textarea',
                    controlClass: 'controls-block',
                    controlOptions: {
                        modelAttribute: 'action.email.bcc',
                        model: this.model.state,
                        placeholder: _('optional').t()
                    },
                    label: _('BCC').t()
                });

                this.children.emailPriority = new ControlGroup({
                    className: 'control-group',
                    controlType: 'SyntheticSelect',
                    controlClass: 'controls-block',
                    controlOptions: {
                        modelAttribute: 'action.email.priority',
                        model: this.model.state,
                        items:[
                            {label: _('Lowest').t(), value: '5'},
                            {label: _('Low').t(), value: '4'},
                            {label: _('Normal').t(), value: '3'},
                            {label: _('High').t(), value: '2'},
                            {label: _('Highest').t(), value: '1'}
                        ],
                        toggleClassName: 'btn',
                        popdownOptions: {
                            attachDialogTo: '.modal:visible',
                            scrollContainer: '.modal:visible .modal-body:visible'
                        }
                    },
                    label: _('Priority').t()
                });

                var configTokenHelpLink = route.docHelp(
                        this.model.application.get("root"),
                        this.model.application.get("locale"),
                        'learnmore.alert.email.tokens'
                );

                // for backwards compatibility
                var subjectModelAttribute = 'action.email.subject';
                if (splunkUtil.normalizeBoolean(this.model.state.get('action.email.useNSSubject'))) {
                    subjectModelAttribute += '.' + this.options.suffix;
                }
                this.children.emailSubject = new ControlGroup({
                    className: 'control-group',
                    controlType: 'Text',
                    controlClass: 'controls-block',
                    controlOptions: {
                        modelAttribute: subjectModelAttribute,
                        model: this.model.state,
                        placeholder: this.options.inculedSubjectDefaultPlaceholder? _('Default').t() : ''
                    },
                    label: _('Subject').t(),
                    help: splunkUtil.sprintf(_('The email subject and message can include tokens that insert text based on the results of the search. %s').t(), ' <a href="' + configTokenHelpLink + '" target="_blank" title="' + _("Splunk help").t() +'">' + _("Learn More").t() + ' <i class="icon-external"></i></a>')
                });

                this.children.emailMessage = new ControlGroup({
                    className: 'control-group',
                    controlType: 'Textarea',
                    controlClass: 'controls-block',
                    controlOptions: {
                        modelAttribute: 'action.email.message.' + this.options.suffix,
                        model: this.model.state,
                        placeholder: _('Default').t(),
                        textareaClassName: 'messagearea'
                    },
                    label: _('Message').t()
                });
            },
            events: {
                'click a.show-cc-bcc': function(e) {
                    var force = true;
                    this.showAdditionalEmailAddresses(force);
                    e.preventDefault();
                }
            },
            showAdditionalEmailAddresses: function(force) {
                if (force || this.model.state.get('action.email.cc') || this.model.state.get('action.email.bcc')) {
                    this.children.ccEmailAddresses.$el.show();
                    this.children.bccEmailAddresses.$el.show();
                    this.children.toEmailAddresses.$('a.show-cc-bcc').css('display','none');
                } else {
                    this.children.toEmailAddresses.$('a.show-cc-bcc').css('display','block');
                }
            },
            render: function()  {
                this.children.toEmailAddresses.render().appendTo(this.$el);
                this.children.ccEmailAddresses.render().appendTo(this.$el).$el.hide();
                this.children.bccEmailAddresses.render().appendTo(this.$el).$el.hide();
                this.children.emailPriority.render().appendTo(this.$el);
                this.children.emailSubject.render().appendTo(this.$el);
                this.children.emailMessage.render().appendTo(this.$el);

                this.showAdditionalEmailAddresses();
                return this;
            }
        });
});

define('views/shared/reportcontrols/dialogs/schedule_dialog/Step2',
        [
            'underscore',
            'module',
            'views/Base',
            'views/shared/Modal',
            'views/shared/EmailOptions',
            'views/shared/controls/ControlGroup',
            'views/shared/controls/SyntheticCheckboxControl',
            'views/shared/controls/SyntheticSelectControl',
            'views/shared/FlashMessages',
            'splunk.util',
            'uri/route',
            'util/console',
            'util/pdf_utils'
        ],
        function(
            _,
            module,
            Base,
            Modal,
            EmailOptions,
            ControlGroup,
            SyntheticCheckboxControl,
            SyntheticSelectControl,
            FlashMessage,
            splunkUtil,
            route,
            console,
            pdfUtils
        )
        {
        return Base.extend({
            moduleId: module.id,
            initialize: function() {
                Base.prototype.initialize.apply(this, arguments);

                //deferrs
                this.deferredPdfAvailable = pdfUtils.isPdfServiceAvailable();

                //views
                this.children.flashMessage = new FlashMessage({ model: this.model.inmem });

                // TODO: 'Remove if statement after all consumers pass the appLocal and application model'
                var configEmailHelpLink = "http://docs.splunk.com/";
                if (this.model.appLocal && this.model.application) {
                    configEmailHelpLink = route.docHelp(
                        this.model.application.get("root"),
                        this.model.application.get("locale"),
                        'learnmore.alert.email'
                    );
                } else {
                    console.warn("The schedule dialog step 2 view needs the AppLocal and Application model passed to it");
                }

                this.children.sendEmailBox = new ControlGroup({
                    controlType: 'SyntheticCheckbox',
                    controlOptions: {
                        modelAttribute: 'action.email',
                        model: this.model.inmem.entry.content
                    },
                    label: _('Send Email').t(),
                    help: splunkUtil.sprintf(_('Email must be configured in System&nbsp;Settings > Alert&nbsp;Email&nbsp;Settings. %s').t(), ' <a href="' + configEmailHelpLink + '" target="_blank">' + _("Learn More").t() + ' <i class="icon-external"></i></a>')
                });

                this.children.emailOptions = new EmailOptions({
                    model: {
                        state: this.model.inmem.entry.content,
                        application: this.model.application
                    },
                    suffix: 'report',
                    inculedSubjectDefaultPlaceholder: true
                });

                this.children.includeResultsLink = new SyntheticCheckboxControl({
                    modelAttribute: 'action.email.include.results_link',
                    model: this.model.inmem.entry.content,
                    label: _('Link to Results').t()
                });
                
                this.children.includeInline = new SyntheticCheckboxControl({
                    additionalClassNames: 'include-inline',
                    modelAttribute: 'action.email.inline',
                    model: this.model.inmem.entry.content,
                    label: _('Inline').t()
                });

                this.children.includeInlineFormat = new SyntheticSelectControl({
                    additionalClassNames: 'include-inline-format',
                    modelAttribute: 'action.email.format',
                    menuWidth: 'narrow',
                    model: this.model.inmem.entry.content,
                    items: [
                        { label: _('Table').t(), value: 'table' },
                        { label: _('Raw').t(), value: 'raw' },
                        { label: _('CSV').t(), value: 'csv' }
                    ],
                    labelPosition: 'outside',
                    popdownOptions: {
                        attachDialogTo: '.modal:visible',
                        scrollContainer: '.modal:visible .modal-body:visible'
                    }
                });
                
                this.children.includeCSV = new SyntheticCheckboxControl({
                    modelAttribute: 'action.email.sendcsv',
                    model: this.model.inmem.entry.content,
                    label: _('Attach CSV').t()
                });
                
                this.children.includePDF = new SyntheticCheckboxControl({
                    modelAttribute: 'action.email.sendpdf',
                    model: this.model.inmem.entry.content,
                    label: _('Attach PDF').t()
                });

                this.children.includeSearchString = new SyntheticCheckboxControl({
                    modelAttribute: 'action.email.include.search',
                    model: this.model.inmem.entry.content,
                    label: _('Search String').t()
                });
                this.children.includeViewLink = new SyntheticCheckboxControl({
                    modelAttribute: 'action.email.include.view_link',
                    model: this.model.inmem.entry.content,
                    label: _('Link to Report').t()
                });

                var includeCheckboxes = [
                    this.children.includeViewLink,
                    this.children.includeResultsLink,
                    this.children.includeSearchString,
                    this.children.includeInline,
                    this.children.includeInlineFormat,
                    this.children.includeCSV
                ];

                $.when(this.deferredPdfAvailable).then(function(pdfAvailable) {
                    if (pdfAvailable) {
                        includeCheckboxes.push(this.children.includePDF);
                    }

                    this.children.emailInclude = new ControlGroup({
                        controlClass: 'email-include',
                        controls: includeCheckboxes,
                        label: _('Include').t()
                    });

                }.bind(this));

                this.children.runScriptBox = new ControlGroup({
                    controlType: 'SyntheticCheckbox',
                    controlOptions: {
                        modelAttribute: 'action.script',
                        model: this.model.inmem.entry.content
                    },
                    label: _('Run a Script').t()
                });

                this.children.scriptFilename = new ControlGroup({
                    controlType: 'Text',
                    controlOptions: {
                        modelAttribute: 'action.script.filename',
                        model: this.model.inmem.entry.content
                    },
                    label: _('Filename').t(),
                    help: _('Located in $SPLUNK_HOME/bin/scripts').t()
                });

                //event listeners
                this.model.inmem.entry.content.on('change:action.email', this.toggleEmail, this);
                this.model.inmem.entry.content.on('change:action.script', this.toggleScript, this);

                this.model.inmem.entry.content.on('change:action.email.format', function(){
                    this.model.inmem.entry.content.set('action.email.inline', 1);
                }, this);

            },
            events: {
                "click .btn-primary" : function(e) {
                    var actions = [];

                    if (this.model.inmem.entry.content.get('action.email')) {
                        actions.push('email');
                    }

                    if (this.model.inmem.entry.content.get('action.script')) {
                        actions.push('script');
                    }

                    this.model.inmem.entry.content.set('actions', actions.join(', '));
                    this.model.inmem.trigger('saveSchedule');
                    e.preventDefault();
                },
                "click .back" : function(e) {
                    this.model.inmem.entry.content.trigger('back');
                    e.preventDefault();
                }
            },
            toggleEmail: function() {
                if (this.model.inmem.entry.content.get('action.email')) {
                    this.children.emailOptions.$el.show();
                    this.children.emailInclude.$el.show();
                } else {
                    this.children.emailOptions.$el.hide();
                    this.children.emailInclude.$el.hide();
                }
            },
            toggleScript: function() {
                if (this.model.inmem.entry.content.get('action.script')) {
                    this.children.scriptFilename.$el.show();
                } else {
                    this.children.scriptFilename.$el.hide();
                }
            },
            render: function() {
                $.when(this.deferredPdfAvailable).then(function() {
                    this.$el.html(Modal.TEMPLATE);

                    this.$(Modal.HEADER_TITLE_SELECTOR).html(_("Edit Schedule").t());

                    this.children.flashMessage.render().prependTo(this.$(Modal.BODY_SELECTOR));

                    this.$(Modal.BODY_SELECTOR).append(Modal.FORM_HORIZONTAL_COMPLEX);

                    if (this.model.user.isFree()) {
                        var freeHelpLink = route.docHelp(
                            this.model.application.get('root'),
                            this.model.application.get('locale'),
                            'learnmore.license.features');
                        this.children.sendEmailBox.disable();
                        this.children.runScriptBox.disable();
                        this.$(Modal.BODY_FORM_SELECTOR).append(this.compiledTemplate({
                            _: _,
                            splunkUtil: splunkUtil,
                            link: ' <a href="' + freeHelpLink + '" target="_blank">' + _("Learn More").t() + ' <i class="icon-external"></i></a>'
                        }));
                    }

                    this.$(Modal.BODY_FORM_SELECTOR).append('<p class="control-heading">' + _('Enable Actions').t() + '</p>');

                    this.children.sendEmailBox.render().appendTo(this.$(Modal.BODY_FORM_SELECTOR));
                    this.children.emailOptions.render().appendTo(this.$(Modal.BODY_FORM_SELECTOR));
                    this.children.emailInclude.render().appendTo(this.$(Modal.BODY_FORM_SELECTOR));
                    this.children.runScriptBox.render().appendTo(this.$(Modal.BODY_FORM_SELECTOR));
                    this.children.scriptFilename.render().appendTo(this.$(Modal.BODY_FORM_SELECTOR));

                    this.$(Modal.FOOTER_SELECTOR).append('<a href="#" class="btn back pull-left">' + _('Back').t() + '</a>');
                    this.$(Modal.FOOTER_SELECTOR).append(Modal.BUTTON_SAVE);

                    this.toggleEmail();
                    this.toggleScript();
                    
                    return this;
                }.bind(this));
            },
            template: '\
                <div class="alert alert-info">\
                    <i class="icon-alert"></i>\
                    <%= splunkUtil.sprintf(_("Scheduling Actions is an Enterprise-level feature. It is not available with Splunk Free. %s").t(), link) %>\
                </div>\
            '
        });
    }
);

define('views/shared/reportcontrols/dialogs/schedule_dialog/Master',[
    'underscore',
    'backbone',
    'models/shared/Cron',
    'models/shared/TimeRange',
    'collections/services/data/ui/Times',
    'views/shared/Modal',
    'module',
    'views/shared/reportcontrols/dialogs/schedule_dialog/step1/Master',
    'views/shared/reportcontrols/dialogs/schedule_dialog/Step2',
    'splunk.util'
    ],
    function(
        _,
        Backbone,
        Cron,
        TimeRangeModel,
        TimesCollection,
        Modal,
        module,
        Step1,
        Step2,
        splunkUtil
    ) {
    return Modal.extend({
            moduleId: module.id,
            /**
            * @param {Object} options {
            *       model: {
            *           application: <models.Application>
            *           report: <models.Report>,
             *          appLocal: <models.services.AppLocal>,
             *          user: <models.services.admin.User>
            *       }
            * }
            */
            initialize: function() {
                Modal.prototype.initialize.apply(this, arguments);
                //model
                this.model = {
                    application: this.model.application,
                    report: this.model.report,
                    user: this.model.user,
                    appLocal: this.model.appLocal,
                    timeRange: new TimeRangeModel({enableRealTime:false}),
                    inmem: this.model.report.clone(),
                    cron: Cron.createFromCronString(this.model.report.entry.content.get('cron_schedule') || '0 6 * * 1')
                };
                //collections
                this.collection = new TimesCollection();

                this.collectionDeferred = this.collection.fetch({
                    data: {
                        app: this.model.application.get("app"),
                        owner: this.model.application.get("owner")
                    }
                });

                this.model.inmem.set({
                    scheduled_and_enabled: !this.model.inmem.entry.content.get('disabled') && this.model.inmem.entry.content.get('is_scheduled')
                });

                //views
                this.children.step1 = new Step1({
                    model: {
                        state: this.model.inmem.entry.content,
                        application: this.model.application,
                        inmem: this.model.inmem,
                        cron: this.model.cron,
                        timeRange: this.model.timeRange,
                        user: this.model.user,
                        appLocal: this.model.appLocal
                    },
                    collection: this.collection
                });

                this.children.step2 = new Step2({
                    model: {
                        inmem: this.model.inmem,
                        application: this.model.application,
                        user: this.model.user,
                        appLocal: this.model.appLocal
                    }
                });

                //event listeners for workflow navigation
                this.model.inmem.on('next', function() {
                    this.model.cron.validate();
                },this);

                this.model.inmem.entry.content.on('back', function() {
                    this.children.step2.$el.hide();
                    this.$el.removeClass(Modal.CLASS_MODAL_WIDE);
                    this.children.step1.$el.show();
                },this);

                //event listeners for saving
                this.model.cron.on('validated', function(isValid, model, payload) {
                    if (isValid) {
                        this.children.step1.$el.hide();
                        this.$el.addClass(Modal.CLASS_MODAL_WIDE);
                        this.children.step2.$el.show();
                    }
                }, this);

                this.model.inmem.on('saveSuccessNotScheduled', function() {
                    this.model.report.entry.content.set('is_scheduled', 0);
                    this.hide();
                }, this);

                this.model.inmem.on('saveSchedule', function() {
                    this.trasposeFromUI();

                    this.model.inmem.entry.content.set('cron_schedule', this.model.cron.getCronString());

                    this.model.inmem.save({}, {
                        success: function(model, response){
                            this.model.report.fetch();
                            this.hide();
                        }.bind(this)
                    });
                }, this);
            },
            trasposeFromUI: function() {
                var sendResults =   splunkUtil.normalizeBoolean(this.model.inmem.entry.content.get('action.email.sendpdf')) ||
                                    splunkUtil.normalizeBoolean(this.model.inmem.entry.content.get('action.email.sendcsv')) ||
                                    splunkUtil.normalizeBoolean(this.model.inmem.entry.content.get('action.email.inline'));
                this.model.inmem.entry.content.set('action.email.sendresults', +sendResults);

                if (this.model.inmem.get('scheduled_and_enabled')) {
                    this.model.inmem.entry.content.set({
                        'is_scheduled': 1,
                        'disabled': 0
                    });
                }
            },
            render: function() {
                this.$el.addClass('schedule-modal');
                var timeRangeDeferred = this.model.timeRange.save({
                    'earliest': this.model.inmem.entry.content.get('dispatch.earliest_time'),
                    'latest': this.model.inmem.entry.content.get('dispatch.latest_time')
                });

                $.when(timeRangeDeferred, this.collectionDeferred).then(function() {
                    this.children.step1.render().appendTo(this.$el);
                    this.children.step2.render().appendTo(this.$el);
                    this.children.step2.$el.hide();
                }.bind(this));
            }
        }
    );
});

define('views/shared/reportcontrols/details/EditSchedule',
    [
        'underscore',
        'backbone',
        'module',
        'views/Base',
        'views/shared/reportcontrols/dialogs/schedule_dialog/Master'
    ],
    function(_, Backbone, module, Base, ScheduleDialog) {
        return Base.extend({
            moduleId: module.id,
            tagName: 'span',
            initialize: function() {
                Base.prototype.initialize.apply(this, arguments);
            },
            events: {
                'click a.edit-schedule': function(e) {
                    this.children.scheduleDialog = new ScheduleDialog({
                        model: {
                            report: this.model.report,
                            application: this.model.application,
                            user: this.model.user,
                            appLocal: this.model.appLocal
                        },
                        onHiddenRemove: true
                    });

                    this.children.scheduleDialog.render().appendTo($("body"));
                    this.children.scheduleDialog.show();

                    e.preventDefault();
                }
            },
            render: function() {
                this.$el.html(this.compiledTemplate({
                    _: _
                }));
                return this;
            },
            template: '\
                <a class="edit-schedule" href="#"><%- _("Edit").t() %></a>\
            '
        });
    }
);

define('views/shared/reportcontrols/details/Acceleration',
    [
        'underscore',
        'module',
        'views/Base',
        'splunk.util'
    ],
    function(_, module, Base, splunkUtil) {
        return Base.extend({
            moduleId: module.id,
            tagName: 'span',
            initialize: function() {
                Base.prototype.initialize.apply(this, arguments);
                var render = _.debounce(this.render, 0);
                this.model.entry.content.on('change:auto_summarize change:auto_summarize.dispatch.earliest_time', render, this);
            },
            render: function() {
                this.$el.html(this.compiledTemplate({
                    model: this.model,
                    _: _,
                    splunkUtil: splunkUtil
                }));
                return this;
            },
            convertSummarizeTime: function(relTime) {
                switch(relTime)
                {
                    case '-1d@h':
                        return _('1 Day').t();
                    case '-7d@d':
                        return _('1 Week').t();
                    case '-1mon@d':
                        return _('1 Month').t();
                    case '-3mon@d':
                        return _('3 Months').t();
                    case '-1y@d':
                        return _('1 Year').t();
                    case '0':
                        return _('All Time').t();
                    default:
                        return _('Custom').t();
                }
            },
            template: '\
                <% if (model.entry.content.get("auto_summarize")) { %>\
                    <%- splunkUtil.sprintf(_("Enabled. Summary Range: %s.").t(), this.convertSummarizeTime(model.entry.content.get("auto_summarize.dispatch.earliest_time"))) %>\
                <% } else { %>\
                    <%- _("Disabled.").t() %>\
                <% } %>\
            '
        });
    }
);

define('views/shared/reportcontrols/dialogs/AccelerationDialog',[
    'underscore',
    'backbone',
    'module',
    'models/services/search/IntentionsParser',
    'views/shared/Modal',
    'views/shared/controls/ControlGroup',
    'views/shared/FlashMessages',
    'splunk.util'
    ],
    function(
        _,
        Backbone,
        module,
        IntentionsParserModel,
        Modal,
        ControlGroup,
        FlashMessage,
        splunkUtil
    ) {
    return Modal.extend({
        moduleId: module.id,
        /**
        * @param {Object} options {
        *       model: {
        *           report: <models.Report>,
        *           searchJob: <models.services.search.Job> (optional),
        *       }
        * }
        */
        initialize: function(options) {
            Modal.prototype.initialize.apply(this, arguments);

            this.model = {
                searchJob: this.model.searchJob,
                report: this.model.report,
                inmem: this.model.report.clone(),
                application: this.model.application
            };

            if(!this.model.searchJob) {
                this.model.intentionsParser = new IntentionsParserModel();
                this.intentionsParserDeferred = this.model.intentionsParser.fetch({
                    data:{
                        q:this.model.report.entry.content.get('search'),
                        timeline: false,
                        app: this.model.application.get('app'),
                        owner: this.model.application.get('owner')
                    }
                });
            }

            this.children.flashMessage = new FlashMessage({ model: this.model.inmem });

            this.children.name = new ControlGroup({
                controlType: 'Label',
                controlOptions: {
                    modelAttribute: 'name',
                    model: this.model.inmem.entry
                },
                label: _('Report').t()
            });

            this.children.acceleration = new ControlGroup({
                controlType: 'SyntheticCheckbox',
                controlOptions: {
                    modelAttribute: 'auto_summarize',
                    model: this.model.inmem.entry.content
                },
                label: splunkUtil.sprintf(_('Accelerate %s').t(), this.model.report.isAlert() ? _('Alert').t() : _('Report').t()),
                help: _('Acceleration may increase storage and processing costs.').t()
            });

            this.children.summary_range = new ControlGroup({
                controlType: 'SyntheticSelect',
                controlOptions: {
                    modelAttribute: 'auto_summarize.dispatch.earliest_time',
                    model: this.model.inmem.entry.content,
                    items: [
                        {
                            label: _('1 Day').t(),
                            value: '-1d@h'
                        },
                        {
                            label: _('7 Days').t(),
                            value: '-7d@d'
                        },
                        {
                            label: _('1 Month').t(),
                            value: '-1mon@d'
                        },
                        {
                            label: _('3 Months').t(),
                            value: '-3mon@d'
                        },
                        {
                            label: _('1 Year').t(),
                            value: '-1y@d'
                        },
                        {
                            label: _('All Time').t(),
                            value: '0'
                        }
                    ],
                    save: false,
                    toggleClassName: 'btn',
                    labelPosition: 'outside',
                    elastic: true,
                    popdownOptions: {
                        attachDialogTo: '.modal:visible',
                        scrollContainer: '.modal:visible .modal-body:visible'
                    }
                },
                label: _('Summary Range').t(),
                tooltip: _("Sets the range of time (relative to now) for which data is accelerated. " +
                    "Example: 1 Month accelerates the last 30 days of data in your reports.").t()
            });

            this.model.inmem.entry.content.on('change:auto_summarize', function() {
                if (this.model.inmem.entry.content.get("auto_summarize")) {
                    this.children.summary_range.$el.show();
                    if(this.model.inmem.entry.content.get("auto_summarize.dispatch.earliest_time") === '') {
                        this.model.inmem.entry.content.set("auto_summarize.dispatch.earliest_time",'-1d@h');
                    }
                } else {
                    this.children.summary_range.$el.hide();
                }
            }, this);

            this.on('hidden', function() {
                if (this.model.inmem.get("updated") > this.model.report.get("updated")) {
                    //now we know have updated the clone
                    this.model.report.entry.content.set({
                        auto_summarize: this.model.inmem.entry.content.get('auto_summarize'),
                        'auto_summarize.dispatch.earliest_time': this.model.inmem.entry.content.get('auto_summarize.dispatch.earliest_time')
                    });
                }
            }, this);
        },
        events: $.extend({}, Modal.prototype.events, {
            'click .save.modal-btn-primary': function(e) {
                this.model.inmem.save({}, {
                    success: function(model, response) {
                        this.model.report.fetch();
                        this.remove();
                    }.bind(this)
                });
                e.preventDefault();
            }
        }),
        render: function() {
            this.$el.html(Modal.TEMPLATE);

            this.$(Modal.HEADER_TITLE_SELECTOR).html(_("Edit Acceleration").t());

            this.children.flashMessage.render().prependTo(this.$(Modal.BODY_SELECTOR));

            this.$(Modal.BODY_SELECTOR).append(Modal.FORM_HORIZONTAL);

            $.when(this.intentionsParserDeferred).then(function(){
                var canSummarize = (this.model.searchJob && this.model.searchJob.canSummarize()) || (this.model.intentionsParser && this.model.intentionsParser.get('canSummarize'));
                if (canSummarize) {
                    this.model.inmem.setAccelerationWarning(canSummarize);
                    this.children.name.render().appendTo(this.$(Modal.BODY_FORM_SELECTOR));
                    this.children.acceleration.render().appendTo(this.$(Modal.BODY_FORM_SELECTOR));
                    this.children.summary_range.render().appendTo(this.$(Modal.BODY_FORM_SELECTOR));

                    if (this.model.inmem.entry.content.get("auto_summarize")) {
                        this.children.summary_range.$el.show();
                    } else {
                        this.children.summary_range.$el.hide();
                    }

                    this.$(Modal.FOOTER_SELECTOR).append(Modal.BUTTON_CANCEL);
                    this.$(Modal.FOOTER_SELECTOR).append('<a href="#" class="save btn btn-primary modal-btn-primary pull-right">' + _('Save').t() + '</a>');
                } else {
                    this.$(Modal.BODY_FORM_SELECTOR).append('<div>' + _('This report cannot be accelerated.').t() + '</div>');
                    this.$(Modal.FOOTER_SELECTOR).append(Modal.BUTTON_DONE);
                }
            }.bind(this));

            return this;
        }
    });
});

define('views/shared/reportcontrols/details/EditAcceleration',
    [
        'underscore',
        'backbone',
        'module',
        'views/Base',
        'views/shared/reportcontrols/dialogs/AccelerationDialog'
    ],
    function(_, Backbone, module, Base, AccelerationDialog) {
        return Base.extend({
            moduleId: module.id,
            tagName: 'span',
            initialize: function() {
                Base.prototype.initialize.apply(this, arguments);
            },
            events: {
                'click a.edit-acceleration': function(e) {
                    this.children.accelerationDialog = new AccelerationDialog({
                        model: {
                            report: this.model.report,
                            searchJob: this.model.searchJob,
                            application: this.model.application
                        },
                        onHiddenRemove: true
                    });

                    this.children.accelerationDialog.render().appendTo($("body"));
                    this.children.accelerationDialog.show();

                    e.preventDefault();
                }
            },
            render: function() {
                this.$el.html(this.compiledTemplate({
                    _: _
                }));
                return this;
            },
            template: '\
                <a class="edit-acceleration" href="#"><%- _("Edit").t() %></a>\
            '
        });
    }
);

define('views/shared/documentcontrols/details/Permissions',
    [
        'underscore',
        'module',
        'views/Base',
        'util/splunkd_utils',
        'splunk.util'
    ],
    function(_, module, Base, splunkDUtils, splunkUtil) {
        return Base.extend({
            moduleId: module.id,
            tagName: 'span',
            initialize: function() {
                Base.prototype.initialize.apply(this, arguments);
                var render = _.debounce(this.render, 0);
                this.model.entry.acl.on('change:sharing change:owner', render, this);
            },
            render: function() {
                var sharing = this.model.entry.acl.get("sharing"),
                    owner = this.model.entry.acl.get("owner"),
                    permissionString = splunkDUtils.getPermissionLabel(sharing,owner);
                    
                this.$el.html(this.compiledTemplate({
                    permissionString:permissionString
                }));
                return this;
            },
            template: '\
               <%- permissionString %>\
            '
        });
    }
);

define('views/shared/documentcontrols/dialogs/permissions_dialog/ACL',[
    'underscore',
    'jquery',
    'backbone',
    'module',
    'views/Base',
    'views/shared/controls/SyntheticCheckboxControl'
    ],
    function(
        _,
        $,
        Backbone,
        module,
        BaseView,
        SyntheticCheckboxControl
    ) {
    return BaseView.extend({
        moduleId: module.id,
        className: 'push-margins',
        initialize: function() {
            BaseView.prototype.initialize.apply(this, arguments);

            this.children.read = new BaseView();
            this.children.write = new BaseView();

            //listeners
            this.model.perms.on('change:Everyone.read', function() {
                this.toggleEveryone('read');
            }, this);
            this.model.perms.on('change:Everyone.write', function() {
                this.toggleEveryone('write');
            }, this);
        },
        appendRow: function(role) {
            var className = role !== "Everyone" ? 'role' : '';
            this.$('tbody').append(
                '<tr class="'+ role + '">\
                    <td class="role-name">' + _.escape(this.model.perms.get(role + '.name')) + '</td>\
                    <td class="perms-read ' + role + '-checkbox"></td>\
                    <td class="perms-write ' + role + '-checkbox"></td>\
                </tr>'
            );
            this.children.readCheckbox = new SyntheticCheckboxControl({
                modelAttribute: role +'.read',
                model: this.model.perms,
                checkboxClassName: className + " read btn"
            });
            this.children.writeCheckbox = new SyntheticCheckboxControl({
                modelAttribute: role + '.write',
                model: this.model.perms,
                checkboxClassName: className + " write btn"
            });

            this.children.readCheckbox.render().appendTo(this.$('td.perms-read.'+ role + '-checkbox'));
            this.children.writeCheckbox.render().appendTo(this.$('td.perms-write.'+ role + '-checkbox'));
            this.children.read.children[role] = this.children.readCheckbox;
            this.children.write.children[role] = this.children.writeCheckbox;
        },
        toggleEveryone: function(col) {
            var everyoneChecked = this.model.perms.get('Everyone.' + col),
                checkboxes = this.children[col];
            _.each(checkboxes.children, function(checkbox, role) {
                if (role !== 'Everyone') {
                    if (everyoneChecked) {
                        checkbox.disable();
                    } else {
                        checkbox.enable();
                    }
                }
            });
        },
        render: function() {
            this.$el.html(this.compiledTemplate({
                _: _
            }));

            _(this.model.perms.toJSON()).each(function(value, key){
                var splitKey = key.split('.'),
                    role = splitKey[0],
                    type = splitKey[1];
                if (type === 'name') {
                    this.appendRow(role);
                }
            }.bind(this));

            this.toggleEveryone('read');
            this.toggleEveryone('write');

            return this;
        },
        template: '\
            <table class="table table-striped table-condensed table-scroll table-border-row">\
                <thead>\
                    <tr>\
                        <td></td>\
                        <th class="perms-read"><%- _("Read").t() %></th>\
                        <th class="perms-write"><%- _("Write").t() %></th>\
                    </tr>\
                </thead>\
                <tbody>\
                </tbody>\
            </table>\
        '
    });
});

define('views/shared/documentcontrols/dialogs/permissions_dialog/Master',[
    'jquery',
    'underscore',
    'backbone',
    'module',
    'models/Base',
    'models/ACLReadOnly',
    'views/shared/Modal',
    'views/shared/controls/ControlGroup',
    'views/shared/documentcontrols/dialogs/permissions_dialog/ACL',
    'views/shared/FlashMessages',
    'util/splunkd_utils'
    ],
    function(
        $,
        _,
        Backbone,
        module,
        BaseModel,
        ACLReadOnlyModel,
        Modal,
        ControlGroup,
        ACL,
        FlashMessage,
        splunkd_utils
    ) {
    return Modal.extend({
        moduleId: module.id,
        /**
        * @param {Object} options {
        *       model: { 
        *           document: <models.Report>,
        *           nameModel: <model> Model for name,
        *           user: <models.service.admin.user>
        *       }
        *       collection: <collections.services.authorization.Roles>,
        *       nameLabel: <string> Label for name,
        *       nameKey: <string> Key for name found in nameModel,  
        * }
        */
        initialize: function(options) {
            Modal.prototype.initialize.apply(this, arguments);

            this.model.perms = new BaseModel();
            this.model.inmem = new ACLReadOnlyModel($.extend(true, {}, this.model.document.entry.acl.toJSON()));

            var defaults = {
                nameLabel: _('Name').t(),
                nameKey: 'name'
            };

            _.defaults(this.options, defaults);

            this.translateToPermsModel();
            this.children.flashMessage = new FlashMessage({
                model: {
                    inmem: this.model.inmem,
                    report: this.model.document,
                    reportAcl: this.model.document.acl
                }
            });

            this.children.name = new ControlGroup({
                controlType: 'Label',
                controlOptions: {
                    modelAttribute: this.options.nameKey,
                    model: this.model.nameModel
                },
                label: this.options.nameLabel
            });

            this.children.owner = new ControlGroup({
                controlType: 'Label',
                controlOptions: {
                    modelAttribute: 'owner',
                    model: this.model.inmem
                },
                label: _('Owner').t()
            });

            this.children.app = new ControlGroup({
                controlType: 'Label',
                controlOptions: {
                    modelAttribute: 'app',
                    model: this.model.inmem
                },
                label: _('App').t()
            });

            this.children.display_for = new ControlGroup({
                controlType: 'SyntheticRadio',
                controlClass: 'controls-thirdblock',
                controlOptions: {
                    modelAttribute: 'sharing',
                    model: this.model.inmem,
                    items: [
                        {
                            label: _('Owner').t(),
                            value: splunkd_utils.USER,
                            className: 'user'
                        },
                        {
                            label: _('App').t(),
                            value: splunkd_utils.APP,
                            className: 'app'
                        },
                        {
                            label: _('All Apps').t(),
                            value: splunkd_utils.GLOBAL,
                            className: 'global'
                        }
                    ],
                    save: false
                },
                label: _('Display For').t()
            });

            this.children.acl = new ACL({
                model : {
                    perms: this.model.perms
                },
                collection: this.collection
            });

            this.model.inmem.on('change:sharing', function() {
                if (this.model.inmem.get("sharing") === splunkd_utils.USER) {
                    this.children.acl.$el.hide();
                } else {
                    this.children.acl.$el.show();
                }
            }, this);
        },
        events: $.extend({}, Modal.prototype.events, {
            'click .btn-primary': function(e) {
                this.translateFromPermsModel();
                var data = this.model.inmem.toDataPayload();
                this.model.document.acl.save({}, {
                    data: data,
                    success: function(model, response){
                        this.hide();
                        this.model.document.fetch({
                            url: splunkd_utils.fullpath(
                                this.model.document.url + '/' + encodeURIComponent(this.model.document.entry.get('name')),
                                {
                                    sharing: data.sharing,
                                    app: this.model.inmem.get('app'),
                                    owner: data.owner
                                }
                            ),
                            success: function() {
                                this.model.document.trigger('updateCollection');
                            }.bind(this)
                        });
                    }.bind(this)
                });

                e.preventDefault();
            }
        }),
        translateToPermsModel: function() {
            var perms = this.model.inmem.permsToObj();

            // add 'Everyone' attributes
            this.model.perms.set('Everyone.name', _('Everyone').t());
            this.model.perms.set('Everyone.read', _.indexOf(perms.read, '*')!=-1);
            this.model.perms.set('Everyone.write', _.indexOf(perms.write, '*')!=-1);

            // add 'name', 'read' and 'write' attributes for each role
            this.collection.each(function(roleModel, i){
                var roleName = roleModel.entry.get("name"), j = i + 1;
                this.model.perms.set('role_' + j + '.name', roleName);
                this.model.perms.set('role_' + j + '.read', _.indexOf(perms.read, roleName)!=-1);
                this.model.perms.set('role_' + j + '.write', _.indexOf(perms.write, roleName)!=-1);
            }, this);
        },
        translateFromPermsModel: function() {
            var perms = {
                read: [],
                write: []
            };

            _(this.model.perms.toJSON()).each(function(value, key){
                var splitKey = key.split('.'),
                    role = splitKey[0],
                    type = splitKey[1];
                if (type === 'read' || type === 'write') {
                    if (value) {
                        // can read or write
                        if(role === 'Everyone') {
                            perms[type].push('*');
                        } else {
                            perms[type].push(this.model.perms.get(role + '.name'));
                        }
                    }
                }
            }.bind(this));

            this.model.inmem.set('perms', perms);

        },
        setView: function() {
            if (!this.model.inmem.get("can_share_user")) {
                this.children.display_for.$('.user').attr('disabled', true);
            }
            if (!this.model.inmem.get("can_share_app")) {
                this.children.display_for.$('.app').attr('disabled', true);
            }
            if (!this.model.inmem.get("can_share_global")) {
                this.children.display_for.$('.global').attr('disabled', true);
            }
            if(!this.model.inmem.get("modifiable")) {
                this.children.display_for.$('.btn').attr('disabled', true);
            }
            if (this.model.inmem.get("sharing") ==='user'){
                this.children.acl.$el.hide();
            } else {
                this.children.acl.$el.show();
            }
        },
        render: function() {
            this.$el.html(Modal.TEMPLATE);

            this.$(Modal.HEADER_TITLE_SELECTOR).html(_("Edit Permissions").t());
            this.$(Modal.BODY_SELECTOR).addClass('modal-body-scrolling');

            this.children.flashMessage.render().prependTo(this.$(Modal.BODY_SELECTOR));

            this.$(Modal.BODY_SELECTOR).append(Modal.FORM_HORIZONTAL);

            this.children.name.render().appendTo(this.$(Modal.BODY_FORM_SELECTOR));
            this.children.owner.render().appendTo(this.$(Modal.BODY_FORM_SELECTOR));
            this.children.app.render().appendTo(this.$(Modal.BODY_FORM_SELECTOR));
            this.children.display_for.render().appendTo(this.$(Modal.BODY_FORM_SELECTOR));

            if (!this.model.user.isFree()) {
                this.children.acl.render().appendTo(this.$(Modal.BODY_FORM_SELECTOR));
            }

            this.$(Modal.FOOTER_SELECTOR).append(Modal.BUTTON_CANCEL);
            this.$(Modal.FOOTER_SELECTOR).append(Modal.BUTTON_SAVE);

            this.setView();

            return this;
        }
    });
});

define('views/shared/reportcontrols/details/EditPermissions',
    [
        'underscore',
        'backbone',
        'module',
        'views/Base',
        'views/shared/documentcontrols/dialogs/permissions_dialog/Master'
    ],
    function(_, Backbone, module, Base, PermissionsDialog) {
        return Base.extend({
            moduleId: module.id,
            tagName: 'span',
            initialize: function() {
                Base.prototype.initialize.apply(this, arguments);
            },
            events: {
                'click a.edit-permissions': function(e) {
                    this.children.permissionsDialog = new PermissionsDialog({
                        model: {
                            document: this.model.report,
                            nameModel: this.model.report.entry,
                            user: this.model.user
                        },
                        collection: this.collection,
                        onHiddenRemove: true,
                        nameLabel: _('Report').t()
                    });

                    this.children.permissionsDialog.render().appendTo($("body"));
                    this.children.permissionsDialog.show();

                    e.preventDefault();
                }
            },
            render: function() {
                this.$el.html(this.compiledTemplate({
                    _: _
                }));
                return this;
            },
            template: '\
                <a class="edit-permissions" href="#"><%- _("Edit").t() %></a>\
            '
        });
    }
);

define('views/shared/reportcontrols/details/Embed',
    [
        'underscore',
        'module',
        'views/Base',
        'util/general_utils'
    ],
    function(_, module, Base, Util) {
        return Base.extend({
            moduleId: module.id,
            tagName: 'span',
            initialize: function() {
                Base.prototype.initialize.apply(this, arguments);
            },
            render: function() {
                var embed = Util.normalizeBoolean(this.model.entry.content.get("embed.enabled"));
                this.$el.html(this.compiledTemplate({
                    _: _,
                    embed: embed
                }));
                return this;
            },
            template: '\
                <% if (embed) { %>\
                    <%- _("Enabled.").t() %>\
                <% } else { %>\
                    <%- _("Disabled.").t() %>\
                <% } %>\
            '
        });
    }
);

define('views/shared/reportcontrols/dialogs/embed_dialog/NotScheduled',
	[
		'underscore',
		'module',
		'views/Base',
		'views/shared/Modal',
        'views/shared/reportcontrols/dialogs/schedule_dialog/Master'
	], 
	function(_, module, BaseView, ModalView, ScheduleDialog) {
		return BaseView.extend({
			moduleId: module.id,
			events: {
				 'click a.scheduleReport': function(e) {
            	    this.trigger('hide');
                	var scheduleDialog = new ScheduleDialog({
                    	model: {
                        	report: this.model.report,
                        	application: this.model.application,
                        	user: this.model.user,
                        	appLocal: this.model.appLocal
                    	},
                    	onHiddenRemove: true
                	});

	                scheduleDialog.render().appendTo($("body"));
    	            scheduleDialog.show();

        	        e.preventDefault();
            	}
			},
			render: function() {
				this.$el.html(ModalView.TEMPLATE);
	            this.$(ModalView.HEADER_TITLE_SELECTOR).html(_("Report Must Be Scheduled").t());
	            this.$(ModalView.BODY_SELECTOR).append('<p>' + _('You cannot enable embedding for this report until it is scheduled. Embedded reports always display the results of their last scheduled run.').t() + '</p>');
	            this.$(ModalView.FOOTER_SELECTOR).append(ModalView.BUTTON_CANCEL);
	            this.$(ModalView.FOOTER_SELECTOR).append('<a href="#" class="btn btn-primary modal-btn-primary pull-right scheduleReport">' + _('Schedule Report').t() + '</a>');
	            return this;
			}
		});
	}
);
define('views/shared/reportcontrols/dialogs/embed_dialog/Confirmation',
	[
		'underscore',
		'module',
		'views/Base',
		'views/shared/Modal'
	], 
	function(_, module, BaseView, ModalView) {
		return BaseView.extend({
			moduleId: module.id,
			events: {
				'click a.enableEmbedding': function(e) {
					this.model.embed.save();
				}
			},
			render: function() {
				this.$el.html(ModalView.TEMPLATE);
	            this.$(ModalView.HEADER_TITLE_SELECTOR).html(_("Enable Report Embedding").t());
	            this.$(ModalView.BODY_SELECTOR).append('<p>' + _('Are you sure you want to enable embedding for this report? An embedded report can be viewed by anyone with access to the web page(s) in which it is inserted.').t() + '</p>');
	            this.$(ModalView.FOOTER_SELECTOR).append(ModalView.BUTTON_CANCEL);
	            this.$(ModalView.FOOTER_SELECTOR).append('<a href="#" class="btn btn-primary modal-btn-primary pull-right enableEmbedding">' + _('Enable Embedding').t() + '</a>');
	            return this;
			}
		});
	}
);
define('models/services/saved/searches/History',['models/SplunkDBase'], function(BaseModel) {
    return BaseModel.extend({
        initialize: function() {
            BaseModel.prototype.initialize.apply(this, arguments);
        },
        sync : function(method, model, options) {
            throw new Error('invalid method: ' + method);
        }
    });
});

define('collections/services/saved/searches/Histories',
    [
        'models/services/saved/searches/History',
        'collections/SplunkDsBase'
    ],
    function(Model, Collection) {
        return Collection.extend({
            initialize: function() {
                Collection.prototype.initialize.apply(this, arguments);
            },
            //url: saved/searches/$NAME$/history
            model: Model
        });
    }
);

define('views/shared/FlashMessagesLegacy',['underscore','views/Base','module'], function(_, Base,module) {

    return Base.extend({
        moduleId: module.id,
        className: 'alerts',
        initialize: function(){
            Base.prototype.initialize.apply(this, arguments);
            this.activate();
        },
        startListening: function() {
            this.listenTo(this.collection, 'add push reset', this.render);
        },
        render: function() {
            var template = _.template(this.template, {
                    flashMessages: this.collection
                });
            this.$el.html(template);

            if (this.collection.length === 0){
                this.$el.hide();
            } else {
                this.$el.show();
            }

            return this;
        },
        template: '\
            <% flashMessages.each(function(flashMessage){ %> \
                <div class="alert alert-<%- flashMessage.get("type") %>">\
                    <i class="icon-alert"></i>\
                    <%- flashMessage.get("html") %>\
                </div>\
            <% }); %> \
        '
    },
    {
        update: function(errors, parentView, flashMessagesCollection){
            var flashMessageModels = [],
                uniquifier = 0;

            _(parentView.children).each(function(child){
                child.error(false);
            });
            _(errors).each(function(error){
                parentView.children[error.name].error(true);
                flashMessageModels.push({
                    key: parentView.cid + (uniquifier++),
                    type: 'error',
                    html: error.msg
                });
            }, parentView);
            flashMessagesCollection.reset(flashMessageModels);
        }
    });

});

define('views/shared/reportcontrols/dialogs/embed_dialog/Embed',
	[
		'underscore',
		'module',
		'uri/route',
		'models/Base',
		'views/Base',
		'views/shared/Modal',
        'views/shared/controls/TextareaControl',
        'collections/services/saved/searches/Histories',
        'views/shared/FlashMessagesLegacy',
        'collections/shared/FlashMessages'
	], 
	function(
        _,
        module,
        route,
        BaseModel, 
        BaseView,
        ModalView,
        TextareaControl,
        Histories,
        FlashMessagesLegacyView,
        FlashMessagesCollection
    ) {
	return BaseView.extend({
		moduleId: module.id,
		initialize: function() {
			BaseView.prototype.initialize.apply(this, arguments);
			this.model.state = new BaseModel();
            this.collection = {
                    histories: new Histories(),
                    messages: new FlashMessagesCollection()
                };
            this.children.flashMessages = new FlashMessagesLegacyView({
                collection: this.collection.messages
            });
            this.collection.histories.url = this.model.report.entry.links.get('history');
            this.children.snippet = new TextareaControl({
                    spellcheck: false,
                    modelAttribute: 'text',
                    model: this.model.state
                }
            );
            this.model.report.entry.content.on('change:embed.token', this.setText, this);
            this.collection.histories.on('sync', this.maybeWarn, this);
            this.setText();
		},
		setText: function() {
            var src = route.embed(
                    this.model.application.get('root'),
                    this.model.application.get('locale'),
                    this.model.report.entry.content.get('embed.token'), 
                    this.model.report.get('id')
                ),
                displayGeneralType = this.model.report.entry.content.get('display.general.type'),
                displayVisualizationsType = this.model.report.entry.content.get('display.visualizations.type'),
                baseHeight = 300,
                offsetHeight = 36,
                height,
                text;
            if (displayGeneralType === 'visualizations' && displayVisualizationsType === 'charting') {
                baseHeight = parseInt(this.model.report.entry.content.get('display.visualizations.chartHeight'), 10);
            } else if(displayGeneralType === 'events' || displayGeneralType === 'statistics') {
                baseHeight = 600;
            } else if(displayGeneralType === 'visualizations' && displayVisualizationsType === 'mapping') {
                baseHeight = parseInt(this.model.report.entry.content.get('display.visualizations.mapHeight'), 0);
            } else if(displayGeneralType === 'visualizations' && displayVisualizationsType === 'singlevalue') {
                baseHeight = 60;
            }
            height = baseHeight + offsetHeight;
            text = _.template('<iframe height="<%- height %>" width="480" frameborder="0" src="<%= src %>"></iframe>', {src: src, height: height});
            this.model.state.set('text', text);
		},
        show: function() {
            this.$el.show();
            this.$('textarea').focus();
            this.collection.histories.fetch({
                data: {
                    count: 1
                }
            });
        },
        maybeWarn: function() {
            if (this.collection.histories.length) {
                this.collection.messages.reset([]);
            } else {
                this.collection.messages.reset([
                    {
                        type: 'warning',
                        html: _('Embedded Report will not have data until the scheduled search runs.').t()
                    }
                ]);
            }
        },
		events: {
            'focus textarea': function(e) {
                setTimeout(function() {
                    this.$('textarea').select();
                }.bind(this), 0);
            },
			'click a.disableEmbedding': function(e) {
				e.preventDefault();
				if (window.confirm(_('Are you sure you no longer want to share this report outside of Splunk?').t())) {
					this.model.report.unembed.save();
				}
			}
		},
		render: function() {
			this.$el.html(ModalView.TEMPLATE);
	        this.$(ModalView.HEADER_TITLE_SELECTOR).html(_("Embed").t());
            this.$(ModalView.BODY_SELECTOR).append(this.children.flashMessages.render().el);
	        this.$(ModalView.BODY_SELECTOR).append('<p>' + _('Copy and paste this code into your HTML-based web page.').t() + '</p>');
            this.children.snippet.render().appendTo(this.$(ModalView.BODY_SELECTOR));
	        this.$(ModalView.BODY_SELECTOR).append('<p>' + _('Disable embedding if you no longer want to share this report outside of Splunk.').t() + '</p>');
	        this.$(ModalView.FOOTER_SELECTOR).append('<a href="#" class="btn pull-left disableEmbedding">' + _('Disable Embedding').t() + '</a>');
            this.$(ModalView.FOOTER_SELECTOR).append(ModalView.BUTTON_DONE);
	        return this;
		}
	});
});

define('views/shared/reportcontrols/dialogs/embed_dialog/Master',[
        'underscore',
        'module',
        'views/shared/Modal',
        'views/shared/reportcontrols/dialogs/embed_dialog/NotScheduled',
        'views/shared/reportcontrols/dialogs/embed_dialog/Confirmation',
        'views/shared/reportcontrols/dialogs/embed_dialog/Embed',
        'util/general_utils'
    ],
    function(
        _,
        module,
        ModalView,
        NotScheduledView,
        ConfirmationView,
        EmbedView,
        util
    ) {
    return ModalView.extend({
        moduleId: module.id,
        /**
        * @param {Object} options {
        * }
        */
        initialize: function(options) {
            ModalView.prototype.initialize.apply(this, arguments);
            this.children.notScheduled = new NotScheduledView({
                model: {
                    report: this.model.report,
                    application: this.model.application,
                    user: this.model.user,
                    appLocal: this.model.appLocal
                }
            });
            this.children.notScheduled.on('hide', this.hide, this);
            this.children.confirmation = new ConfirmationView({
                model: this.model.report
            });
            this.children.embed = new EmbedView({
                model: {
                    report: this.model.report,
                    application: this.model.application
                }
            });
            this.children.embed.on('hide', this.hide, this);
            this.model.report.entry.content.on('change:embed.enabled', function() {
                if (util.normalizeBoolean(this.model.report.entry.content.get('embed.enabled'))) {
                    this.children.notScheduled.$el.hide();
                    this.children.confirmation.$el.hide();
                    this.children.embed.show();
                    return;
                }
                this.hide();
            }, this);
        },
        visibility: function() {
            if (!this.model.report.entry.content.get('is_scheduled')) {
                this.children.notScheduled.$el.show();
                this.children.confirmation.$el.hide();
                this.children.embed.$el.hide();
            } else if (!util.normalizeBoolean(this.model.report.entry.content.get('embed.enabled'))) {
                this.children.notScheduled.$el.hide();
                this.children.confirmation.$el.show();
                this.children.embed.$el.hide();
            } else {
                this.children.notScheduled.$el.hide();
                this.children.confirmation.$el.hide();
                this.children.embed.show();
            }
        },
        render : function() {
            this.$el.append(this.children.notScheduled.render().el);
            this.$el.append(this.children.confirmation.render().el);
            this.$el.append(this.children.embed.render().el);
            this.visibility();
        }
    });
});

define('views/shared/reportcontrols/details/EditEmbed',
    [
        'underscore',
        'backbone',
        'module',
        'views/Base',
        'views/shared/reportcontrols/dialogs/embed_dialog/Master'
    ],
    function(_, Backbone, module, Base, EmbedDialog) {
        return Base.extend({
            moduleId: module.id,
            tagName: 'span',
            initialize: function() {
                Base.prototype.initialize.apply(this, arguments);
            },
            events: {
                'click a.edit-embed': function(e) {
                    this.children.embedDialog = new EmbedDialog({
                        model: this.model,
                        onHiddenRemove: true
                    });

                    this.children.embedDialog.render().appendTo($("body"));
                    this.children.embedDialog.show();

                    e.preventDefault();
                }
            },
            render: function() {
                this.$el.html(this.compiledTemplate({
                    _: _
                }));
                return this;
            },
            template: '\
                <a class="edit-embed" href="#"><%- _("Edit").t() %></a>\
            '
        });
    }
);

define('views/shared/reportcontrols/details/Master',[
    'underscore',
    'jquery',
    'views/Base',
    'module',
    'views/shared/reportcontrols/details/History',
    'views/shared/reportcontrols/details/Creator',
    'views/shared/documentcontrols/details/App',
    'views/shared/reportcontrols/details/Schedule',
    'views/shared/reportcontrols/details/EditSchedule',
    'views/shared/reportcontrols/details/Acceleration',
    'views/shared/reportcontrols/details/EditAcceleration',
    'views/shared/documentcontrols/details/Permissions',
    'views/shared/reportcontrols/details/EditPermissions',
    'views/shared/reportcontrols/details/Embed',
    'views/shared/reportcontrols/details/EditEmbed',
    'util/general_utils',
    'bootstrap.modal'
    ],
    function(
        _,
        $,
        BaseView,
        module,
        HistoryView,
        CreatorView,
        AppView,
        ScheduleView,
        EditScheduleView,
        AccelerationView,
        EditAccelerationView,
        PermissionsView,
        EditPermissionsView,
        EmbedView,
        EditEmbedView,
        util,
        undefined
    ) {
        return BaseView.extend({
            moduleId: module.id,
            /**
            * @param {Object} options {
            *       model: {
            *           report: <models.Report>,
            *           application: <models.Application>,
            *           intentionsParser: (Optional) <models.IntentionsParser>,
            *           appLocal: <models.services.AppLocal>,
            *           user: <models.service.admin.user>
            *       },
            *       collection: <collections.services.authorization.Roles>
            * }
            */
            initialize: function() {
                BaseView.prototype.initialize.apply(this, arguments);
                //this.children.historyView = new HistoryView({model: this.model.report});
                this.children.creatorView = new CreatorView({
                    model: {
                        report: this.model.report,
                        application: this.model.application
                    }
                });
                this.children.appView = new AppView({model: this.model.report});
                this.children.scheduleView = new ScheduleView({model: this.model.report});
                this.children.editScheduleView = new EditScheduleView({
                    model: {
                        report: this.model.report,
                        application: this.model.application,
                        user: this.model.user,
                        appLocal: this.model.appLocal
                    }
                });
                this.children.accelerationView = new AccelerationView({model: this.model.report});
                this.children.editAccelerationView = new EditAccelerationView({
                    model: {
                        report: this.model.report,
                        searchJob: this.model.searchJob,
                        application: this.model.application
                    }
                });
                this.children.permissionsView = new PermissionsView({model: this.model.report});
                this.children.editPermissionsView = new EditPermissionsView({
                    model: {
                        report: this.model.report,
                        user: this.model.user
                    },
                    collection: this.collection
                });
                this.children.embedView = new EmbedView({model: this.model.report});
                this.children.editEmbedView = new EditEmbedView({model: this.model});

                if (this.model.searchJob){
                    this.model.searchJob.on("prepared", function() {
                        this.$('a.edit-acceleration').css('display', '');
                    }, this);
                }
                this.model.report.entry.content.on('change:embed.enabled', this.render, this);
            },
            render: function() {
                var canWrite = this.model.report.entry.acl.get('can_write') && !(this.model.report.entry.content.get('is_scheduled') && !this.model.user.canScheduleSearch()),
                    canEmbed = this.model.report.canEmbed(this.model.user.canScheduleSearch(), this.model.user.canEmbed()),
                    isEmbedded = util.normalizeBoolean(this.model.report.entry.content.get('embed.enabled'));
                this.el.innerHTML = this.compiledTemplate({
                    _: _
                });
                //TODO when these attributes exist
                //this.$('dd.history').append(this.children.historyView.render().el);
                this.children.creatorView.render().appendTo(this.$('dd.creator'));
                this.children.appView.render().appendTo(this.$('dd.app'));
                this.children.scheduleView.render().appendTo(this.$('dd.schedule'));
                this.children.accelerationView.render().appendTo(this.$('dd.acceleration'));
                this.children.permissionsView.render().appendTo(this.$('dd.permissions'));
                this.children.embedView.render().appendTo(this.$('dd.embed'));
                
                if (canWrite && !isEmbedded) {

                    if (this.model.user.canScheduleSearch() && !this.model.report.isRealTime()) {
                        // Check if real-time. User can not schedule a real-time search
                        this.children.editScheduleView.render().appendTo(this.$('dd.schedule'));
                    }
                    if (this.model.user.canAccelerateReport()) {
                        this.children.editAccelerationView.render().appendTo(this.$('dd.acceleration'));
                    }
                    // Only show if user has perm to change perms
                    if (this.model.report.entry.acl.get('can_change_perms')) {
                        this.children.editPermissionsView.render().appendTo(this.$('dd.permissions'));
                    }
                }

                if (canEmbed) {
                    this.children.editEmbedView.render().appendTo(this.$('dd.embed'));
                }

                if (this.model.searchJob && this.model.searchJob.isPreparing()) {
                    this.$('a.edit-acceleration').css('display', 'none');
                }

                if(this.model.report.isPivotReport()) {
                    this.$('dt.acceleration').remove();
                    this.$('dd.acceleration').remove();
                }

                return this;
            },
            template: '\
            <dl class="list-dotted">\
                <!--TODO when these attributes exist-->\
                <!--<dt class="history"><%- _("History").t() %></dt>\
                    <dd class="history"></dd>-->\
                <dt class="creator"><%- _("Creator").t() %></dt>\
                    <dd class="creator"></dd>\
                <dt class="app"><%- _("App").t() %></dt>\
                    <dd class="app"></dd>\
                <dt class="schedule"><%- _("Schedule").t() %></dt>\
                    <dd class="schedule"></dd>\
                <dt class="acceleration"><%- _("Acceleration").t() %></dt>\
                    <dd class="acceleration"></dd>\
                <dt class="permissions"><%- _("Permissions").t() %></dt>\
                    <dd class="permissions"></dd>\
                <dt class="embed"><%- _("Embedding").t() %></dt>\
                    <dd class="embed"></dd>\
            </dl>\
        '
        });
    }
);

define('views/dashboards/panelcontrols/titledialog/Modal',
    [
        'underscore',
        'jquery',
        'backbone',
        'module',
        'views/shared/controls/ControlGroup',
        'views/shared/Modal', 
        'views/shared/FlashMessages'
    ],
    function(_, $, backbone, module, ControlGroup, Modal, FlashMessagesView){
        return Modal.extend({
            moduleId: module.id,
            initialize: function() {
                Modal.prototype.initialize.apply(this, arguments);
                var titleProperty = 'display.general.title';
                this.model.workingReport = new backbone.Model(/*this.model.report.entry.content.toJSON()*/);
                this.model.workingReport.set(titleProperty, this.model.report.entry.content.get(titleProperty, { tokens: true }));
                this.children.flashMessages = new FlashMessagesView({model: this.model.dashboard});
                //reset flashmessages to clear pre-existing flash messages on 'cancel' or 'close' of dialog
                this.on('hide', this.model.dashboard.error.clear, this.model.dashboard.error); 

                this.children.panelTitleControlGroup = new ControlGroup({
                    label: _("Title").t(),
                    controlType:'Text',
                    controlClass: 'controls-block',
                    controlOptions: {
                        model: this.model.workingReport,
                        modelAttribute: titleProperty,
                        placeholder: _("optional").t()
                    }
                });

                this.listenTo(this.model.report, 'successfulSave', this.hide, this); 
            },
            events: $.extend({}, Modal.prototype.events, {
                'click .modal-btn-primary': 'onSave'
            }),
            onSave: function(e){
                var newTitle = this.model.workingReport.get('display.general.title'); 
                e.preventDefault();
                this.model.report.trigger("saveTitle", newTitle); //this.model.report is actually this.model.working due to titledialog using tokens 
           },
            render: function() {
                this.$el.html(Modal.TEMPLATE);
                this.$(Modal.HEADER_TITLE_SELECTOR).html(_("Edit Title").t());
                this.$(Modal.BODY_SELECTOR).prepend(this.children.flashMessages.render().el);                
                this.$(Modal.BODY_SELECTOR).append(Modal.FORM_HORIZONTAL);
                this.$(Modal.BODY_FORM_SELECTOR).append(this.children.panelTitleControlGroup.render().el);
                this.$(Modal.FOOTER_SELECTOR).append(Modal.BUTTON_CANCEL);
                this.$(Modal.FOOTER_SELECTOR).append(Modal.BUTTON_SAVE);
            }
        });
    }
);

define('splunkjs/mvc/simpleform/formutils',['require','exports','module','underscore','jquery','splunkjs/mvc','splunkjs/mvc/simplexml/controller'],function(require, exports, module) {
    var _ = require('underscore');
    var $ = require('jquery');
    var mvc = require('splunkjs/mvc');
    var Dashboard = require('splunkjs/mvc/simplexml/controller');

    var registeredInputTypes = {};

    var FormUtils = {

        /**
         * Submit the form data, placing tokens from the "default" token namespace into the "submitted" token
         * namespace, as well as copying all form.* tokens (including earliest and latest) from "default" to the
         * "url" namespace.
         *
         * @param options {Object} - {
         *      replaceState {Boolean} - use replaceState when updating the URL model (prevent it from adding an entry
         *                               to the browser history). Default is false.
         * }
         */
        submitForm: _.debounce(function(options) {
            if (!FormUtils.isFormReady()) {
                FormUtils.onFormReady().then(_.bind(FormUtils.submitForm, FormUtils, options));
                return;
            }
            options || (options = {});
            // submit the form
            var defaultTokenModel = mvc.Components.getInstance("default", { create: true });
            var submittedTokenModel = mvc.Components.getInstance('submitted');
            if (submittedTokenModel) {
                submittedTokenModel.set(defaultTokenModel.toJSON());
            }
            var urlTokenModel = mvc.Components.getInstance('url');
            if (urlTokenModel) {
                urlTokenModel.saveOnlyWithPrefix('form\\.', defaultTokenModel.toJSON(), {
                    replaceState: options.replaceState
                });
            }
        }),

        /**
         * Handle the change of an input value, compute and store a new token value by considering prefix, suffix, the
         * default value and options for combining values of multi-value inputs (valuePrefix, -Suffix and delimiter)
         *
         * @param input - the input component (a subclass of splunkjs/mvc/simpleform/input/base)
         */
        handleValueChange: function(input) {
            var settings = input.vizSettings;
            var inputType = settings.get('type');
            var defaultTokenModel = mvc.Components.getInstance("default", {create: true});
            var inputTypeSettings = FormUtils.getInputTypeSettings(inputType);
            var token = settings.get('token');

            if (inputType === 'time') {
                if (!settings.get('value')) {
                    var defaultValue = settings.get("default");
                    var presetValue = settings.get("preset");
                    if (defaultValue) {
                        input.val(defaultValue);
                    } else if (presetValue) {
                        // Synchronize the displayed preset and the actual set value.
                        input.visualization._onTimePresetUpdate();
                    } else {
                        settings.set('value', { earliest_time: '', latest_time: '' });
                    }
                    return;
                }
                if (token) {
                    var value = input.val();
                    var tokens = {};
                    tokens[token + '.earliest'] = value['earliest_time'] || '';
                    tokens[token + '.latest'] = value['latest_time'] || '';
                    defaultTokenModel.set(tokens);
                }
            } else {
                if (!input.hasValue()) {
                    input.defaultUpdate = true;
                    input.val(settings.get('default'));
                    return;
                }

                var newValue = input.val();

                if (newValue === undefined) {
                    defaultTokenModel.set(token, newValue);
                    input.defaultUpdate = false;
                    FormUtils._handleAutoSubmit(input);
                    return;
                }

                if (inputTypeSettings.multiValue) {
                    if (newValue === null || newValue.length === 0) {
                        defaultTokenModel.set(token, undefined);
                        input.defaultUpdate = false;
                        FormUtils._handleAutoSubmit(input);
                        return;
                    }
                    var valuePrefix = settings.has('valuePrefix') ? settings.get('valuePrefix') : '';
                    var valueSuffix = settings.has('valueSuffix') ? settings.get('valueSuffix') : '';
                    var delimiter = settings.has('delimiter') ? settings.get('delimiter') : ' ';
                    newValue = _(newValue).map(function(v) { return valuePrefix + v + valueSuffix; }).join(delimiter);
                }

                var newComputedValue = "";
                if (newValue) {
                    var prefixValue = settings.get('prefix');
                    if (prefixValue) {
                        newComputedValue += prefixValue;
                    }
                    newComputedValue += newValue;
                    var suffixValue = settings.get('suffix');
                    if (suffixValue) {
                        newComputedValue += suffixValue;
                    }
                }
                defaultTokenModel.set(token, newComputedValue);
            }

            FormUtils._handleAutoSubmit(input);
        },

        _handleAutoSubmit: function(input, options) {
            var settings = input.vizSettings;
            var autoSubmitEnabled = settings.get('searchWhenChanged') === true ||
                (settings.get('searchWhenChanged') == null && !mvc.Components.get('submit'));

            if (autoSubmitEnabled) {
                // submit the token only if it wasn't from setting the default
                if (!FormUtils.isFormReady() && input.defaultUpdate) {
                    input.defaultUpdate = false;
                } else {
                    FormUtils.submitForm();
                }
            }
        },

        getInputType: function(type) {
            var obj = registeredInputTypes[type];
            if (!obj) {
                throw new Error('Unkonwn input type: ' + type);
            }
            return obj.clazz;
        },

        getInputTypeSettings: function(type) {
            var obj = registeredInputTypes[type];
            if (!obj) {
                throw new Error('Unkonwn input type: ' + type);
            }
            return obj.settings;
        },

        registerInputType: function(name, clazz, settings) {
            registeredInputTypes[name] = {
                clazz: clazz,
                settings: settings
            };
        },

        /**
         * Returns a promise for when the form is ready (all inputs have loaded all information necessary for their
         * initial state)
         *
         * @returns {*} a promise for when the form is ready
         */
        onFormReady: _.once(function() {
            var dfd = $.Deferred();
            Dashboard.onReady(function() {
                var inputs = FormUtils.getFormInputs();
                if (inputs.length > 0) {
                    var promises = _(inputs).invoke('_onReady');
                    $.when.apply($, promises).always(dfd.resolve);
                } else {
                    dfd.resolve();
                }
            });
            return dfd.promise();
        }),

        /**
         * Check is the form is ready (all inputs have loaded the data necessary for computing the initial value).
         *
         * @returns {boolean} true if form is ready, otherwise false
         */
        isFormReady: function() {
            return FormUtils.onFormReady().state() === 'resolved';
        },

        /**
         * Check if the given argument is a dashboard form input.
         *
         * @param component the component instance to check
         * @returns {boolean} true if it's a form input, otherwise false
         */
        isFormInput: function(component) {
            return component && component._isDashboardInput;
        },

        /**
         * Fetch all currently registered form input instances.
         *
         * @returns {Array} an array containing all form input instances
         */
        getFormInputs: function() {
            return _(mvc.Components.toJSON()).filter(FormUtils.isFormInput);
        }
    };

    return FormUtils;
});

define('views/dashboards/PanelTimeRangePicker',['require','exports','module','underscore','jquery','views/Base','views/shared/controls/ControlGroup','util/console','uri/route','splunkjs/mvc','splunkjs/mvc/simpleform/formutils','splunkjs/mvc/tokenutils','splunk.util','bootstrap.tooltip'],function(require, module, exports) {
    var _ = require('underscore');
    var $ = require('jquery');
    var BaseView = require('views/Base');
    var ControlGroup = require('views/shared/controls/ControlGroup');
    var console = require('util/console');
    var route = require('uri/route');
    var mvc = require('splunkjs/mvc');
    var FormUtils = require('splunkjs/mvc/simpleform/formutils');
    var token_utils = require('splunkjs/mvc/tokenutils');
    var SplunkUtil = require('splunk.util');
    require('bootstrap.tooltip');

    return BaseView.extend({
        moduleId: module.id,
        initialize: function() {
            BaseView.prototype.initialize.apply(this, arguments);

            this.model.timeRange.on('applied', function() {
                this.updateReportTime();
                this.updateTime();
            }, this);

            var items = _(mvc.Components.toJSON()).chain().values().filter(function(value) {
                if (FormUtils.isFormInput(value) && value.settings) {
                    return value.settings.get('type') == 'time';
                }
                return false;
            }).map(function(timePicker) {
                    var token = timePicker.settings.get('token') || 'global';
                    var label = SplunkUtil.sprintf(_("Shared Time Picker (%s)").t(), token);
                    return { value: token, label: label };
                }).value();

            var useTimeFrom = 'search';
            var hasTokens =
                token_utils.hasToken(this.model.report.get("dispatch.earliest_time")) &&
                token_utils.hasToken(this.model.report.get("dispatch.latest_time"));
            if (hasTokens) {
                var earliestTokenName = token_utils.getTokenName(this.model.report.get("dispatch.earliest_time"));
                var earliestTokenPrefix = earliestTokenName.replace(/\.?earliest$/g, '');
                earliestTokenPrefix = earliestTokenPrefix === '' ? 'global' : earliestTokenPrefix;
                var latestTokenName = token_utils.getTokenName(this.model.report.get("dispatch.latest_time"));
                var latestTokenPrefix = latestTokenName.replace(/\.?latest$/g, '');
                latestTokenPrefix = latestTokenPrefix === '' ? 'global' : latestTokenPrefix;
                this.model.timeRange.set({'earliest_token': earliestTokenName, 'latest_token': latestTokenName});
                if (earliestTokenPrefix === latestTokenPrefix &&
                    _(items).find(function(item) { return item.value === earliestTokenPrefix; })) {
                    useTimeFrom = earliestTokenPrefix;
                } else {
                    useTimeFrom = "tokens";
                }
            }

            this.model.timeRange.set({useTimeFrom: useTimeFrom});
            if (items.length > 0){
                this.children.timeScope = new ControlGroup({
                    label: _("Time Range Scope").t(),
                    controlType: 'SyntheticSelect',
                    controlOptions: {
                        className: 'btn-group time-range-scope-select',
                        toggleClassName: 'btn',
                        groupedItems: [
                            {items: items},
                            {items: [{label: _('Explicit Selection').t(), value: 'search'}]},
                            {items: [{label: _('Tokens').t(), value: 'tokens'}]}
                        ],
                        model: this.model.timeRange,
                        popdownOptions: {
                            attachDialogTo: '.modal:visible',
                            scrollContainer: '.modal:visible .modal-body:visible'
                        },
                        modelAttribute: 'useTimeFrom',
                        elastic: true
                    }
                });
            } else {
                this.model.timeRange.set('useTimeFrom', 'search');
            }

            this.children.advancedEarliest = new ControlGroup({
                label: _("Earliest Token").t(),
                controlType: 'Text',
                controlOptions: {
                    model: this.model.timeRange,
                    modelAttribute: 'earliest_token'
                }
            });
            this.children.advancedLatest = new ControlGroup({
                label: _("Latest Token").t(),
                controlType: 'Text',
                controlOptions: {
                    model: this.model.timeRange,
                    modelAttribute: 'latest_token'
                }
            });

            this.listenTo(this.model.timeRange, 'change:useTimeFrom', this.updateTokens, this);
        },
        updateReportTime: function(){
            this.model.report.set({
                'dispatch.earliest_time': this.model.timeRange.get('earliest'),
                'dispatch.latest_time':this.model.timeRange.get('latest')
            }, {tokens: true});
        },
        updateTokens: function(){
            this.toggleTimeRangePicker();
            this.toggleAdvancedTokens();
        },
        toggleAdvancedTokens: function() {
            if (this.model.timeRange.get('useTimeFrom') === "tokens"){
                this.children.advancedEarliest.$el.show();
                this.children.advancedLatest.$el.show();
            }
            else{
                this.children.advancedEarliest.$el.hide();
                this.children.advancedLatest.$el.hide();
            }
        },
        toggleTimeRangePicker: function() {
            if (this.model.timeRange.get('useTimeFrom') === "search"){
                this.$('.timerange').show();
            }
            else{
                this.$('.timerange').hide();
            }
        },
        updateTime: function() {
            var timeLabel = this.model.timeRange.generateLabel(this.collection);
            this.$el.find("span.time-label").text(timeLabel);
        },
        render: function() {
            if (this.children.timeScope){
                this.children.timeScope.render().appendTo(this.el);
            }
            this.children.advancedEarliest.render().$el.appendTo(this.$el);
            this.children.advancedLatest.render().$el.appendTo(this.$el);

            this.$el.append('<div class="timerange" style="display: block;"><label class="control-label">' + _('Time Range').t() + '</label></div>');
            this.$('div.timerange').append('<div class="controls"><a href="#" class="btn timerange-control"><span class="time-label"></span><span class="icon-triangle-right-small"></span></a></div>');
            this.toggleTimeRangePicker();
            this.toggleAdvancedTokens();
            this.updateTime();


            return this;
        }
    });

});
define('views/dashboards/panelcontrols/querydialog/Modal',[
    'underscore',
    'jquery',
    'module',
    'views/shared/controls/ControlGroup',
    'views/shared/delegates/ModalTimerangePicker',
    'views/shared/timerangepicker/dialog/Master',
    'views/shared/Modal',
    'models/shared/TimeRange',
    'collections/services/data/ui/Times',
    'splunk.util',
    'splunkjs/mvc/utils',
    'views/Base',
    'uri/route',
    'util/time',
    'bootstrap.tooltip',
    'util/console',
    'splunkjs/mvc',
    'views/shared/FlashMessages',
    'views/dashboards/PanelTimeRangePicker',
    'splunkjs/mvc/tokenawaremodel'],
    function(_,
             $,
             module,
             ControlGroup,
             TimeRangeDelegate,
             TimeRangePickerView,
             Modal,
             TimeRangeModel,
             TimeRangeCollection,
             splunkUtils,
             utils,
             BaseView,
             route,
             time_utils,
             _bootstrapTooltip,
             console,
             mvc,
             FlashMessagesView,
             PanelTimeRangePicker,
             TokenAwareModel
    ){

        function mergeSearch(base, sub) {
            if (!sub) {
                return base;
            }
            return [ base.replace(/[\|\s]$/g,''), sub.replace(/^[\|\s]/g,'') ].join(' | ');
        }

        var PanelTimeRangeModel = TimeRangeModel.extend({
            validation: _.extend({
                earliest_token: function(value, attr, computedState) {
                    if(computedState.useTimeFrom === 'tokens' && !value) {
                        return 'No value specified for earliest token.';
                    }
                },
                latest_token: function(value, attr, computedState) {
                    if(computedState.useTimeFrom === 'tokens' && !value) {
                        return 'No value specified for latest token.';
                    }
                }
            }, TimeRangeModel.prototype.validation)
        });

        return Modal.extend({
            moduleId: module.id,
            className: 'modal edit-search-string',
            initialize: function() {
                Modal.prototype.initialize.apply(this, arguments);

                this.model.workingReport = new TokenAwareModel(
                    _.pick(
                            this.model.report.entry.content.toJSON({ tokens: true }),
                            ['search','dispatch.earliest_time','dispatch.latest_time']
                    ),
                    {
                        applyTokensByDefault: true,
                        retrieveTokensByDefault: true
                    }
                );
                this.children.title = new ControlGroup({
                    label: _("Title").t(), 
                    controlType: 'Label', 
                    controlClass: 'controls-block',
                    controlOptions: {
                        model: this.model.report.entry.content, 
                        modelAttribute: 'display.general.title'
                    }
                });
                this.children.searchStringInput = new ControlGroup({
                    label: _("Search String").t(),
                    controlType:'Textarea',
                    controlClass: 'controls-block',
                    controlOptions: {
                        model: this.model.workingReport,
                        modelAttribute: 'search'
                    }
                });
                if(this.model.report.isPivotReport()){
                    this.children.searchStringInput.options.help =
                        '<a href="#" class="run-pivot">'+_("Run Pivot").t()+
                        ' <i class="icon-external"></i></a>';
                }else{
                    this.children.searchStringInput.options.help =
                        '<a href="#" class="run-search">'+_("Run Search").t()+
                        ' <i class="icon-external"></i></a>';
                }
                this.collection = this.collection || {};
                this.collection.times = new TimeRangeCollection();
                this.collection.times.fetch({
                    data: {
                        app: this.model.application.get("app"),
                        owner: this.model.application.get("owner")
                    }
                });
                this.model.timeRange = new PanelTimeRangeModel();

                this.children.timeRangePickerView =  new TimeRangePickerView({
                    model: {
                        state: this.model.workingReport,
                        timeRange: this.model.timeRange,
                        application: this.model.application,
                        user: this.model.user,
                        appLocal: this.model.appLocal
                    },
                    collection: this.collection.times,
                    appendSelectDropdownsTo: '.modal:visible'
                });

                this.model.timeRange.on('applied', function() {
                    this.timeRangeDelegate.closeTimeRangePicker();
                }, this);

                this.children.panelTimeRangePicker = new PanelTimeRangePicker({
                    model: {
                        timeRange: this.model.timeRange,
                        report: this.model.workingReport,
                        state: this.model.state
                    },
                    collection: this.collection.times
                });
                this.children.flashMessages = new FlashMessagesView({ model: this.model.dashboard });
                //reset flashmessages to clear pre-existing flash messages on 'cancel' or 'close' of dialog
                this.on('hide', this.model.dashboard.error.clear, this.model.dashboard.error); 
                this.listenTo(this.model.report, 'successfulSave', this.hide, this); 

            },
            events: $.extend({}, Modal.prototype.events, {
                'click .modal-btn-primary': function(e){
                    e.preventDefault();

                    var useTimeFrom = this.model.timeRange.get('useTimeFrom');
                    var timeTokenPrefix = useTimeFrom == "global" ? '': useTimeFrom + '.';
                    this.children.flashMessages.flashMsgCollection.reset();
                    if (useTimeFrom === "tokens") {
                        var ret = this.model.timeRange.validate();
                        if(ret) {
                            _.each(ret, function(val) {
                                this.children.flashMessages.flashMsgCollection.add({
                                    key: 'token-' + val,
                                    type: 'error',
                                    html: _.escape(_(val).t())
                                });
                            }, this);
                            return;
                        }
                        var earliestToken = this.model.timeRange.get('earliest_token');
                        var latestToken = this.model.timeRange.get('latest_token');
                        this.model.workingReport.set({
                            'dispatch.earliest_time': '$' + earliestToken + '$',
                            'dispatch.latest_time': '$' + latestToken + '$'
                        }, {tokens: true});
                    } else if (useTimeFrom !== "search"){
                        this.model.workingReport.set({
                            'dispatch.earliest_time': '$' + timeTokenPrefix +'earliest$',
                            'dispatch.latest_time': '$' + timeTokenPrefix +'latest$'
                        }, {tokens: true});
                    } else {
                        this.model.workingReport.set({
                            'dispatch.earliest_time': this.model.timeRange.get('earliest') || "0",
                            'dispatch.latest_time': this.model.timeRange.get('latest') || ""
                        });
                    }
                    var newAttributes = this.model.workingReport.toJSON();
                    console.log('Applying attributes to report model: %o', newAttributes);
                    this.model.report.trigger('updateSearchString', newAttributes);
                },
                'click a.run-search': function(e) {
                    e.preventDefault();
                    var search = this.model.workingReport.get('search', { tokens: false });
                    var reportContent = this.model.report.entry.content;
                    if (reportContent.get('display.general.search.type') === 'postprocess') {
                        var baseSearch = mvc.Components.get(reportContent.get('display.general.managerid')).parent.settings.resolve();
                        search = mergeSearch(baseSearch, search);
                    }
                    if(!search) {
                        return;
                    }
                    var params = { q: search };
                    if(this.model.workingReport.has('dispatch.earliest_time')) {
                        params.earliest = this.model.workingReport.get('dispatch.earliest_time', { tokens: false } || '0');
                        params.latest = this.model.workingReport.get('dispatch.latest_time', { tokens: false }) || '';
                    }
                    var pageInfo = utils.getPageInfo();
                    var url = route.search(pageInfo.root, pageInfo.locale, pageInfo.app, { data: params });
                    utils.redirect(url, true);
                }, 
                'click a.run-pivot': function(e) {
                    e.preventDefault();
                    var search = this.model.workingReport.get('search', { tokens: false }), params = { q: search };
                    if(!search) {
                        return;
                    }
                    if(this.model.workingReport.has('dispatch.earliest_time')) {
                        params.earliest = this.model.workingReport.get('dispatch.earliest_time', { tokens: false });
                        params.latest = this.model.workingReport.get('dispatch.latest_time', { tokens: false });
                    }
                    var pageInfo = utils.getPageInfo();
                    var url = route.pivot(pageInfo.root, pageInfo.locale, pageInfo.app, { data: params });
                    utils.redirect(url, true);
                }
            }),
            handleSubmitButtonState: function(model) {
                this.$(Modal.FOOTER_SELECTOR)
                    .find('.btn-primary')[model.get('elementCreateType') === 'pivot' ? 'addClass' : 'removeClass']('disabled');
            },
            render: function() {
                this.$el.html(Modal.TEMPLATE);
                this.$(Modal.HEADER_TITLE_SELECTOR).html(_("Edit Search").t());

                this.$(Modal.BODY_SELECTOR).remove();

                this.$(Modal.FOOTER_SELECTOR).before(
                    '<div class="vis-area">' +
                        '<div class="slide-area">' +
                            '<div class="content-wrapper query-dialog-wrapper">' +
                                '<div class="' + Modal.BODY_CLASS + '" >' +
                                '</div>' +
                            '</div>' +
                            '<div class="timerange-picker-wrapper">' +
                            '</div>' +
                        '</div>' +
                    '</div>'
                );

                this.$visArea = this.$('.vis-area').eq(0);
                this.$slideArea = this.$('.slide-area').eq(0);
                this.$editSearchContent = this.$('.query-dialog-wrapper').eq(0);
                this.$timeRangePickerWrapper = this.$('.timerange-picker-wrapper').eq(0);
                this.$modalParent = this.$el;

                this.$(Modal.BODY_SELECTOR).prepend(this.children.flashMessages.render().el);                
                this.$(Modal.BODY_SELECTOR).append(Modal.FORM_HORIZONTAL_JUSTIFIED);
                this.children.title.render().appendTo(this.$(Modal.BODY_FORM_SELECTOR));
                this.children.searchStringInput.render().appendTo(this.$(Modal.BODY_FORM_SELECTOR));
                
                var dfd = this.model.timeRange.save({
                    'earliest': this.model.workingReport.get('dispatch.earliest_time', {tokens: false} || "0"),
                    'latest': this.model.workingReport.get('dispatch.latest_time', {tokens: false} || "now")
                }); 

                dfd.done(_.bind(function(){
                    this.$(Modal.BODY_FORM_SELECTOR).append(this.children.panelTimeRangePicker.render().el);
                }, this)); 

                this.$timeRangePickerWrapper.append(this.children.timeRangePickerView.render().el);

                this.timeRangeDelegate = new TimeRangeDelegate({
                    el: this.el,
                    $visArea: this.$visArea,
                    $slideArea: this.$slideArea,
                    $contentWrapper: this.$editSearchContent,
                    $timeRangePickerWrapper: this.$timeRangePickerWrapper,
                    $modalParent: this.$modalParent,
                    $timeRangePicker: this.children.timeRangePickerView.$el,
                    activateSelector: 'a.timerange-control',
                    backButtonSelector: 'a.btn.back'
                });

                this.$(Modal.FOOTER_SELECTOR).append(Modal.BUTTON_CANCEL);
                this.$(Modal.FOOTER_SELECTOR).append(Modal.BUTTON_SAVE);
                this.$(Modal.FOOTER_SELECTOR).append('<a href="#" class="btn back modal-btn-back pull-left">' + _('Back').t() + '</a>');
                this.$('.btn.back').hide();

                return this;
            }
        });
    }
);

define('views/dashboards/panelcontrols/ReportDialog',
    [
        'jquery',
        'underscore',
        'backbone',
        'module',
        'views/shared/controls/ControlGroup',
        'views/shared/Modal',
        'views/shared/FlashMessages', 
        'splunk.util', 
        'uri/route', 
        'collections/search/Reports',
        'splunkjs/mvc/utils', 
        'splunk.config'
    ],
    function($, 
        _, 
        backbone, 
        module, 
        ControlGroup, 
        Modal, 
        FlashMessage, 
        splunkUtil, 
        route, 
        Reports, 
        utils, 
        splunkConfig
    ){
        return Modal.extend({
            moduleId: module.id,
            initialize: function() {
                Modal.prototype.initialize.apply(this, arguments);

                this.model.workingReport = new backbone.Model();
                this.model.workingReport.set({"title": ""});
                this.model.workingReport.set("id", this.model.report.get('id')); 
                this.children.flashMessage = new FlashMessage({ model: this.model.dashboard });
                //reset flashmessages to clear pre-existing flash messages on 'cancel' or 'close' of dialog
                this.on('hide', this.model.dashboard.error.clear, this.model.dashboard.error); 
                this.listenTo(this.model.report, 'successfulManagerChange', this.hide, this); 
                this.controller = this.options.controller;

                if(!this.controller.reportsCollection){
                    this.controller.fetchCollection(); 
                }

                this.controller.reportsCollection.initialFetchDfd.done(_.bind(function() {  
                    this.ready = true;
                    var items = this.controller.reportsCollection.map(function(report) {
                        return { label: report.entry.get('name'), value: report.id };
                    });
                     var reportsLink = route.reports(
                        this.model.application.get("root"),
                        this.model.application.get("locale"),
                        this.model.application.get("app")
                    ); 

                    if(this.controller.reportsCollection.length === this.controller.reportsCollection.REPORTS_LIMIT){
                        this.children.reportsControlGroup = new ControlGroup({
                            label: _("Select Report").t(),
                            controlType:'SyntheticSelect',
                            controlClass: 'controls-block',
                            controlOptions: {
                                model: this.model.workingReport,
                                modelAttribute: 'id',
                                items: items,
                                toggleClassName: 'btn',
                                popdownOptions: {
                                    attachDialogTo: '.modal:visible',
                                    scrollContainer: '.modal:visible .modal-body:visible'
                                }
                            }, 
                            help: _("This does not contain all reports. Add a report that is not listed from ").t() + splunkUtil.sprintf('<a href=%s>%s</a>.', reportsLink, _('Reports').t())
                        });
                    }else{
                        this.children.reportsControlGroup = new ControlGroup({
                            label: _("Select Report").t(),
                            controlType:'SyntheticSelect',
                            controlClass: 'controls-block',
                            controlOptions: {
                                model: this.model.workingReport,
                                modelAttribute: 'id',
                                items: items,
                                toggleClassName: 'btn',
                                popdownOptions: {
                                    attachDialogTo: '.modal:visible',
                                    scrollContainer: '.modal:visible .modal-body:visible'
                                }
                            }
                        });
                    }
                }, this));

                this.children.panelTitleControlGroup = new ControlGroup({
                    label: _("Panel Title").t(),
                    controlType:'Text',
                    controlClass: 'controls-block',
                    controlOptions: {
                        model: this.model.workingReport,
                        modelAttribute: 'title',
                        placeholder: _("optional").t()
                    }
                });
            },
            events: $.extend({}, Modal.prototype.events, {
                'click .modal-btn-primary': 'onSave'
            }),
            onSave: function(e){
                e.preventDefault();
                this.model.report.trigger("updateReportID", this.model.workingReport.get('id'), this.model.workingReport.get('title'));
            },
            render: function() {
                this.$el.html(Modal.TEMPLATE);
                this.$(Modal.HEADER_TITLE_SELECTOR).html(_("Select a New Report").t());
                this.$(Modal.BODY_SELECTOR).prepend(this.children.flashMessage.render().el);
                this.$(Modal.BODY_SELECTOR).append(Modal.FORM_HORIZONTAL);
                
                this.$(Modal.BODY_FORM_SELECTOR).append(Modal.LOADING_HORIZONTAL);
                this.$(Modal.LOADING_SELECTOR).html(_('Loading...').t()); 

                this.controller.reportsCollection.initialFetchDfd.done(_.bind(function(){
                    this.$(Modal.LOADING_SELECTOR).remove(); 
                    this.$(Modal.BODY_FORM_SELECTOR).append(this.children.reportsControlGroup.render().el);
                    this.$(Modal.BODY_FORM_SELECTOR).append(this.children.panelTitleControlGroup.render().el);
                }, this));

                
                this.$(Modal.FOOTER_SELECTOR).append(Modal.BUTTON_CANCEL);
                this.$(Modal.FOOTER_SELECTOR).append(Modal.BUTTON_SAVE);
            }
        });
    }
);

define('views/dashboards/panelcontrols/CreateReportDialog',
    [
        'jquery',
        'underscore',
        'backbone',
        'module',
        'views/shared/controls/ControlGroup',
        'views/shared/Modal', 
        'views/shared/FlashMessages'
    ],
    function($, 
        _, 
        backbone, 
        module, 
        ControlGroup, 
        Modal, 
        FlashMessagesView
    ){
        return Modal.extend({
            moduleId: module.id,
            initialize: function() {
                Modal.prototype.initialize.apply(this, arguments);

                this.model.workingReport = new backbone.Model({'name': this.model.report.entry.content.get('display.general.title') });
                this.children.flashMessagesReport = new FlashMessagesView({model: this.model.report});
                this.children.flashMessagesDashboard = new FlashMessagesView({model: this.model.dashboard});
                //reset flashmessages to clear pre-existing flash messages on 'cancel' or 'close' of dialog
                this.on('hide', this.model.report.error.clear, this.model.report.error); 
                this.on('hide', this.model.dashboard.error.clear, this.model.dashboard.error); 

                this.children.reportNameControlGroup = new ControlGroup({
                    label: _("Report Title").t(),
                    controlType:'Text',
                    controlClass: 'controls-block',
                    controlOptions: {
                        model: this.model.workingReport,
                        modelAttribute: 'name'
                    }
                });

                this.children.reportDescriptionControlGroup = new ControlGroup({
                    label: _("Description").t(),
                    controlType:'Textarea',
                    controlClass: 'controls-block',
                    controlOptions: {
                        model: this.model.workingReport,
                        modelAttribute: 'description',
                        placeholder: _("optional").t()
                    }
                });

                this.listenTo(this.model.report, 'successfulReportSave', this.hide, this); 
            },
            events: $.extend({}, Modal.prototype.events, {
                'click .modal-btn-primary': 'onSave'
            }),
            onSave: function(e){
                e.preventDefault();
                this.model.report.trigger("saveAsReport", this.model.workingReport.get("name"), this.model.workingReport.get("description"));
            },
            render: function() {
                this.$el.html(Modal.TEMPLATE);
                this.$(Modal.HEADER_TITLE_SELECTOR).html(_("Convert to Report").t());
                this.$(Modal.BODY_SELECTOR).prepend(this.children.flashMessagesDashboard.render().el);
                this.$(Modal.BODY_SELECTOR).prepend(this.children.flashMessagesReport.render().el);
                this.$(Modal.BODY_SELECTOR).append(Modal.FORM_HORIZONTAL);

                this.$(Modal.BODY_FORM_SELECTOR).append(this.children.reportNameControlGroup.render().el);
                this.$(Modal.BODY_FORM_SELECTOR).append(this.children.reportDescriptionControlGroup.render().el);

                this.$(Modal.FOOTER_SELECTOR).append(Modal.BUTTON_CANCEL);
                this.$(Modal.FOOTER_SELECTOR).append(Modal.BUTTON_SAVE);
            }
        });
    }
);

/**
 * @author jszeto
 * @date 12/17/12
 */
define('views/ValidatingView',[
    'jquery',
    'backbone',
    'underscore',
    'views/Base',
    'util/general_utils'
],
    function(
        $,
        Backbone,
        _,
        BaseView,
        general_utils
        ){
        return BaseView.extend(
        {

            /**
             * A dictionary mapping the model attributes to the name of ControlGroup children views. The key is the
             * model attribute name. The value is the name of the ControlGroup in the view's children dictionary.
             * ex. {
             *         firstName: "FirstNameView",
             *         lastName: "LastNameView",
             *         zipCode: "ZipCodeView"
             *     }
             */
            modelToControlGroupMap: {},

            /**
             *  Override parent class stopListening to also call tearDownValidation()
             */
            stopListening: function() {
                this.tearDownValidation();
                BaseView.prototype.stopListening.apply(this, arguments);
            },

            /**
             * Call this function if your View has data input controls that need to perform validation. Instantiate the
             * view's model prior to calling this function.
             *
             * @param model - a model or collection The view listens for their "validated" event
             * @param flashMessagesHelper - {FlashMessagesHelper} - reference to the FlashMessagesHelper which listens to
             * "validated" events from a set of Views and applies those errors to a FlashMessages collection
             */
            setupValidation: function(modelOrCollection, flashMessagesHelper) {
                if (_.isUndefined(modelOrCollection))
                    throw "The model or collection you passed into views/Base.setupValidation is undefined";
                // Handle case of collection by iterating over it
                if (modelOrCollection instanceof Backbone.Model)
                    this._setupModelValidationListener(modelOrCollection);
                else if (modelOrCollection instanceof Backbone.Collection) {
                    modelOrCollection.each(function(model){
                        this._setupModelValidationListener(model);
                    });
                    modelOrCollection.on('add', function(model) {this._setupModelValidationListener(model);}, this);
                    modelOrCollection.on('remove', function(model) {model.off("validated", this._modelValidatedHandler, this);}, this);
                }
                // Register with the FlashMessagesHelper
                this.__flashMessagesHelper__ = flashMessagesHelper;
                this.__flashMessagesHelper__.register(this);
            },

            /**
             * Call this when destroying the View
             */
            tearDownValidation: function() {
                if (this.__flashMessagesHelper__)
                    this.__flashMessagesHelper__.unregister(this);
            },

            // Helper function to setup the validated listener on a given model. For internal use only.
            _setupModelValidationListener: function(model) {
                model.on("validated",this._modelValidatedHandler, this);
            },

            /**
             * Handle when a model has performed validation. This function decorates the error messages with labels from
             * the view's ControlGroups if the modelToControlGroupMap property is defined. It then sets the error states
             * of the ControlGroups based on the errors. The function also notifies the FlashMessagesHelper of the latest
             * validation result.
             *
             * @param isValid - true if the entire model passed validation
             * @param model - the model that was validated
             * @param invalidAttrs - an object of invalid model attributes and their error messages. The key is the attribute
             * name while the value is the error message.
             */
            _modelValidatedHandler: function(isValid, model, invalidAttrs) {

                var flashMessages = [];

                if (this.modelToControlGroupMap) {
                    // Get a dictionary where the keys are the controlGroups and the values are undefined.
                    var controlGroupToErrorMap = general_utils.invert(this.modelToControlGroupMap);
                    controlGroupToErrorMap =  _.reduce(_.keys(controlGroupToErrorMap || {}), function(memo, key) {
                        memo[key] = void 0;
                        return memo;
                    }, {});

                    _(invalidAttrs).each(function (error, invalidAttr) {
                        invalidAttrs[invalidAttr] = {message:error, label:""};
                    });

                    // Iterate over the invalidAttrs and map their error message to the controlGroupToErrorMap
                    _(invalidAttrs).each(function(error, invalidAttr) {
                        // Get the controlGroup associated with this model attribute
                        var controlGroupName = this.modelToControlGroupMap[invalidAttr];
                        var message = error.message;
                        var decoratedMessage;
                        var controlGroupLabel = "";

                        if (!_.isUndefined(controlGroupName)) {

                            // Replace the {label} placeholder with the control group's label.
                            if (this.children[controlGroupName].options.label)
                                controlGroupLabel = this.children[controlGroupName].options.label;
                            decoratedMessage = message.replace(/\{(label)\}/g, controlGroupLabel || invalidAttr);

                            controlGroupToErrorMap[controlGroupName] = decoratedMessage;
                        } else {
                            // If we can't find the attribute in the map, then just use the model attribute for the label
                            decoratedMessage = message.replace(/\{(label)\}/g, invalidAttr);
                        }

                        error.message = decoratedMessage;
                        error.label = controlGroupLabel;

                    }, this);

                    // Iterate over the View's controlGroups and set the error state
                    _(controlGroupToErrorMap).each(function(error, controlGroup) {
                        if (!_.isUndefined(error)) {
                            this.children[controlGroup].error(true, error);
                        }
                        else {
                            this.children[controlGroup].error(false, "");
                        }
                    }, this);
                }
                else {
                    _(invalidAttrs).each(function(error, invalidAttr) {
                        error.message = error.message.replace(/\{(label)\}/g, invalidAttr);
                    });
                }

                this.trigger("validated", isValid, model, invalidAttrs, this);
            }

    });
});

/**
 * @author jszeto
 * @date 10/18/12
 *
 * The DialogBase class serves as the base class for all dialog classes. It provides a template that is divided into
 * three sections, the header, body and footer. It currently uses the Bootstrap modal class for appearance and
 * functionality.
 *
 * The default behaviors are as follows:
 *
 * The header displays a title and a close button. Set the title using the settings.titleLabel attribute.
 * The body doesn't have any content. Subclasses should populate the body by overriding renderBody().
 * The footer shows a primary button and a cancel button. Set the labels of these buttons using the
 * settings.primaryButtonLabel and settings.cancelButtonLabel attributes.
 *
 * If you don't want the built-in appearance for the header, body or footer, then subclasses can override the
 * renderXHtml() functions.
 */

define('views/shared/dialogs/DialogBase',
    [
        'jquery',
        'underscore',
        'backbone',
        'views/ValidatingView',
        'module',
        'util/console',
        'bootstrap.transition',
        'bootstrap.modal'
    ],
    function(
        $,
        _,
        Backbone,
        ValidatingView,
        module,
        console
        // bootstrap transition
        // bootstrap modal
        )
    {
        var ENTER_KEY = 13,
            TEXT_INPUT_SELECTOR = 'input[type="text"], input[type="password"], textarea';

        return ValidatingView.extend({
            moduleId: module.id,
            className: "modal fade",
            attributes: {tabIndex: -1},
            /**
             * A model holding the settings for the Dialog.
             *
             * {String} primaryButtonLabel - label for the primary button. If not defined, primary button isn't shown
             * {String} cancelButtonLabel - label for the cancel button. If not defined, cancel button isn't shown
             * {String} titleLabel - label for the dialog title
             */
            settings: undefined,
            /**
             * CSS class to apply to the modal-body
             */
            bodyClassName: "modal-body-scrolling",

            // Subclasses must call super.initialize()
            initialize: function(options) {
                ValidatingView.prototype.initialize.call(this, options);

                options = options || {};
                // Initialize the modal
                // TODO [JCS] Look at other dialogs and add ability to not close on outside click
                this.$el.modal({show:false, keyboard:true});

                if (!_.isUndefined(options.bodyClassName))
                    this.bodyClassName = options.bodyClassName;
                // TODO [JCS] Override remove to remove event listeners on settings
                // Setup the settings
                this.settings = new Backbone.Model();
                this.settings.set("footerTemplate",this._footerTemplate);
                this.settings.set("headerTemplate",this._headerTemplate);

                // Re-render if any of the labels have changed

                this.settings.on('change:primaryButtonLabel change:cancelButtonLabel change:titleLabel',
                                  this.debouncedRender, this);

                // Hook up click event listeners. We avoid using the events array since subclasses might clobber it
                this.$el.on("click.dialog",".btn-dialog-primary", _.bind(function(event) {
                    event.preventDefault();
                    this.primaryButtonClicked();
                }, this));
                this.$el.on("click.dialog",".btn-dialog-cancel", _.bind(function(event) {
                    event.preventDefault();
                    this.cancelButtonClicked();
                }, this));
                this.$el.on("click.dialog",".btn-dialog-close", _.bind(function(event) {
                    event.preventDefault();
                    this.closeButtonClicked();
                }, this));
                this.$el.on("keypress", _.bind(function(event) {
                    if(event.which === ENTER_KEY) {
                        this.submitKeyPressed(event);
                    }
                }, this));
                this.$el.on("shown", _.bind(function(e) {
                    if (e.target !== e.currentTarget) return;
                    this.dialogShown();
                }, this));
                this.$el.on("hide", _.bind(function(e) {
                    if (e.target !== e.currentTarget) return;
                    this.cleanup();
                }, this));
                this.$el.on("hidden", _.bind(function(e) {
                    if (e.target !== e.currentTarget) return;
                    this.trigger("hidden");
                }, this));
            },
            render: function() {
                this.$(".modal-header").detach();
                this.$(".modal-body").detach();
                this.$(".modal-footer").detach();

                var html = this.compiledTemplate({
                    bodyClassName:this.bodyClassName,
                    showFooter: this.shouldRenderFooter()});

                this.$el.html(html);

                this.renderHeader(this.$(".modal-header"));
                this.renderBody(this.$(".modal-body"));
                if (this.shouldRenderFooter())
                    this.renderFooter(this.$(".modal-footer"));

                return this;
            },
            hide: function() {
                this.$el.modal('hide');
            },
            show: function() {
                this.$el.modal('show');
            },
            /**
             * Called when the primary button has been clicked.
             */
            primaryButtonClicked: function() {
                this.trigger("click:primaryButton", this);
            },
            /**
             * Called when the cancel button has been clicked.
             */
            cancelButtonClicked: function() {
                this.trigger("click:cancelButton", this);
            },
            /**
             * Called when the close button has been clicked.
             */
            closeButtonClicked: function() {
                this.trigger("click:closeButton", this);
            },
            /**
             * Called when the "submit key" is pressed.  Currently the submit key is hard-coded to the enter key,
             * but this may become configurable in the future.
             *
             * @param event
             */
            submitKeyPressed: function(event) {
                var $target = $(event.target);
                // Only simulate a primaryButtonClick if focus is in a Text input.
                // if the currently focused element is any kind of text input,
                // make sure to blur it so that any change listeners are notified
                if($target.is(TEXT_INPUT_SELECTOR)) {
                    $target.blur();
                    // manually trigger the primary button click handler
                    this.primaryButtonClicked();
                }

            },
            /**
             * Called when the dialog has been shown. Subclasses can override with their own handlers
             */
            dialogShown: function() {
                this.trigger("show");
                // Apply focus to the first text input in the dialog. [JCS] Doesn't work without doing a debounce. Not sure why.
                _.debounce(function() {
                    this.setFocus();  
                }.bind(this), 0)();
                return;
            },
            /**
             * Applies focus to the first text input in the dialog  
             */
            setFocus: function() {
                this.$('input:text:enabled:visible:first').focus();
            }, 
            /**
             * Called when the dialog has been closed. Subclasses can override with their own cleanup logic
             */
            cleanup: function() {
                this.trigger("hide");
                return;
            },
            /**
             * Returns true if we should render the footer
             * @return {boolean}
             */
            shouldRenderFooter: function() {
                return this.settings.has("primaryButtonLabel") || this.settings.has("cancelButtonLabel");
            },
            /**
             * Render the dialog body. Subclasses should override this function
             *
             * @param $el The jQuery DOM object of the body
             */
            renderBody : function($el) {
                // No op
            },
            /**
             * Render the header.
             *
             * @param $el The jQuery DOM object of the header
             */
            renderHeader : function($el) {
                // To perform jQuery manipulation, wrap the header template in a div.
                // Insert the titleLabel into the title placeholder
                $el.html(this.settings.get("headerTemplate"));
                $el.find(".text-dialog-title").html(this.settings.get("titleLabel"));
            },
            /**
             * Renders the dialog footer. The default implementation takes the settings.footerTemplate
             * and searches for primary and cancel buttons. If a label is defined for it, then it will show the button
             * and set its label. Otherwise, it will hide the button.
             *
             * Subclasses can override this to customize the footer html.
             *
             * @param $el The jQuery DOM object of the footer
             */
            renderFooter : function($el) {
                // To perform jQuery manipulation, wrap the header template in a div.
                $el.html(this.settings.get("footerTemplate"));

                // If the primary button label is undefined, then don't show the button
                var primaryButton = $el.find(".btn-dialog-primary.label_from_data");
                if (this.settings.has("primaryButtonLabel"))
                {
                    primaryButton.html(this.settings.get("primaryButtonLabel"));
                    primaryButton.show();
                }
                else
                {
                    primaryButton.html('');
                    primaryButton.hide();
                }

                // If the cancel button label is undefined, then don't show the button
                var cancelButton = $el.find(".btn-dialog-cancel.label_from_data");
                if (this.settings.has("cancelButtonLabel"))
                {
                    cancelButton.html(this.settings.get("cancelButtonLabel"));
                    cancelButton.show();
                }
                else
                {
                    cancelButton.html('');
                    cancelButton.hide();
                }
            },
            template: '\
                <div class="modal-header"></div>\
                <div class="modal-body <%- bodyClassName %>"></div>\
                <% if (showFooter) { %>\
                    <div class="modal-footer"></div>\
                <% } %>\
            ',
            _footerTemplate: '\
                <a href="#" class="btn btn-dialog-cancel label_from_data pull-left" data-dismiss="modal"></a>\
                <a href="#" class="btn btn-primary btn-dialog-primary label_from_data pull-right"></a>\
            ',
            _headerTemplate: '\
                <button type="button" class="close btn-dialog-close" data-dismiss="modal">x</button>\
                <h3 class="text-dialog-title"></h3>\
            '
        });
    }
);

/**
 * @author jszeto
 * @date 10/22/12
 */

define('views/shared/dialogs/TextDialog',
    [
        'jquery',
        'underscore',
        'views/shared/dialogs/DialogBase',
        'module', 
        'views/shared/FlashMessages'
    ],
    function(
        $,
        _,
        DialogBase,
        module, 
        FlashMessagesView
    )
    {

        return DialogBase.extend({ 
            moduleId: module.id,
            _text: "",
            initialize: function(options) {
                DialogBase.prototype.initialize.call(this, options);
                // Set default values for the button labels
                this.settings.set("primaryButtonLabel",_("Ok").t());
                this.settings.set("cancelButtonLabel",_("Cancel").t());
                if(this.options.flashModel){
                    this.children.flashMessages = new FlashMessagesView({model: this.options.flashModel});
                    //reset flashmessages to clear pre-existing flash messages on 'cancel' or 'close' of dialog
                    this.on('hide', this.options.flashModel.error.clear, this.options.flashModel.error); 
                }
                this.on('hidden', this.remove, this); //clean up dialog after it is closed
                this.doDefault = true; 
            },
            primaryButtonClicked: function() {
                DialogBase.prototype.primaryButtonClicked.call(this);
                if (this.doDefault){
                    this.hide();
                }
            },
            setText : function(value) {
                this._text = value;
                this.debouncedRender();
            },
            closeDialog: function(){
            //if delete succeeds
                this.hide(); 
                this.remove(); 
            },
            preventDefault: function(){
                this.doDefault = false; 
            },
            /**
             * Render the dialog body. Subclasses should override this function
             *
             * @param $el The jQuery DOM object of the body
             */
            renderBody : function($el) {
                $el.html(this.bodyTemplate);
                $el.find(".text-dialog-placeholder").html(this._text);
                if(this.children.flashMessages){
                    $el.find(".text-dialog-placeholder").prepend(this.children.flashMessages.render().el);
                }
            },
            bodyTemplate: '\
                <span class="text-dialog-placeholder"></span>\
            '
        });
    }
);


define('views/dashboards/panelcontrols/Master',[
    'underscore',
    'views/Base',
    'models/Base',
    'jquery',
    'module',
    'views/shared/controls/SyntheticSelectControl',
    'views/shared/delegates/Popdown',
    'views/shared/reportcontrols/details/Master',
    'collections/services/authorization/Roles',
    'models/shared/Application',
    'views/dashboards/panelcontrols/titledialog/Modal',
    'views/dashboards/panelcontrols/querydialog/Modal',
    'views/dashboards/panelcontrols/ReportDialog',
    'views/dashboards/panelcontrols/CreateReportDialog',
    'uri/route',
    'util/console', 
    'splunk.util',
    'views/shared/dialogs/TextDialog',
    'bootstrap.tooltip'
],
function(_,
         BaseView,
         BaseModel,
         $,
         module,
         SyntheticSelectControl,
         Popdown,
         ReportDetailsView,
         RolesCollection,
         ApplicationModel,
         TitleDialogModal,
         QueryDialogModal,
         ReportDialog,
         CreateReportDialog,
         route,
         console,
         splunkUtils,
         TextDialog,
         _bootstrapTooltip
    ){

    var PanelControls = BaseView.extend({
        moduleId: module.id,
        initialize: function(options){
            BaseView.prototype.initialize.apply(this, arguments);

            this.model.report.on('change:id', this.updateReportView, this);
            this.model.report.entry.content.on('change', this.updateReportView, this);

            this.collection = this.collection || {};
            this.collection.roles = new RolesCollection({});
            this.collection.roles.fetch();
        },
        onChangeElementTitle: function(e) {
            e.preventDefault();
            this.children.titleDialogModal = new TitleDialogModal({
                model:  {
                    report: this.model.working, 
                    dashboard: this.model.dashboard
                },
                onHiddenRemove: true
            });

            $("body").append(this.children.titleDialogModal.render().el);
            this.children.titleDialogModal.show();
            this.children.popdown.hide();
        },
        onChangeSearchString: function(e) {
            e.preventDefault();
            if ($(e.currentTarget).is('.disabled')) {
                return;
            }
            this.children.queryDialogModal = new QueryDialogModal({
                model:  {
                    report: this.model.report,
                    appLocal: this.model.appLocal,
                    application: this.model.application,
                    user: this.model.user,
                    dashboard: this.model.dashboard,
                    state: this.model.state
                },
                onHiddenRemove: true
            });

            $("body").append(this.children.queryDialogModal.render().el);
            this.children.queryDialogModal.show();
            this.children.popdown.hide();
        },
        updateReportView: function(){
            this.debouncedRender();
        },
        render: function(){
            var panelClass,
                templateArgs = {};

            if (this.model.report.get('id')){
                panelClass = this.model.report.isPivotReport() ? "icon-report-pivot" : "icon-report-search";
            }
            else {
                panelClass = this.model.report.isPivotReport() ? "icon-pivot" : "icon-search-thin";
            }
            templateArgs['panelClass'] = panelClass;

            this.$el.html(this.compiledTemplate(templateArgs));
            this.children.popdown = new Popdown({ el: this.el, mode: 'dialog' });

            this._renderPanelControls();

            return this;
        },
        _renderPanelControls: function(){
            this.$('.dropdown-menu').html(_.template(this._panelControlsTemplate, { _:_ }));
            var panelType;
            if (this.model.report.get('id')){
                panelType = this.model.report.isPivotReport() ? _("PIVOT REPORT").t() : _("SEARCH REPORT").t();
            }
            else {
                panelType = this.model.report.isPivotReport() ? _("INLINE PIVOT").t() : _("INLINE SEARCH").t();
            }

            var panelTypeLI = _.template('<li class="panelType"><%- panelType %></li>', {panelType: panelType});
            if (this.model.report.get('id')){
                var reportList = _.template('<ul class="report_actions"><%= panelTypeLI %>' +
                        '<li><a class="viewPanelReport" href="#"><%- reportName %>' +
                        '<span class="icon-triangle-right-small"></span></a></li></ul>',
                        {panelTypeLI: panelTypeLI, reportName: this.model.report.entry.get('name')});

                this.$('.panel_actions').before(reportList);
                this.$('.panel_actions').prepend('<li><a href="#" class="changeElementTitle">'+_("Edit Title").t()+'</a></li>');
            }
            else {
                var convertToReportItem = $('<li><a class="convertToReport" href="#">' + _("Convert to Report").t() + '</a></li>');
                var editSearchItem = $('<li><a href="#" class="changeSearchString">' + _("Edit Search String").t() + '</a></li>');
                if (this.model.report.entry.content.get('display.general.search.type') === 'global') {
                    convertToReportItem.find('a').addClass('disabled').tooltip({
                        animation: false,
                        title: _("Cannot convert global search to report.").t()
                    });
                    editSearchItem.find('a').addClass('disabled').tooltip({
                        animation: false,
                        title: _("Cannot edit global search.").t()
                    });
                }
                this.$('.panel_actions').prepend(convertToReportItem);
                this.$('.panel_actions').prepend(editSearchItem);
                this.$('.panel_actions').prepend('<li><a href="#" class="changeElementTitle">'+_("Edit Title").t()+'</a></li>');
                this.$('.panel_actions').prepend(panelTypeLI);
            }
        },
        _panelControlsTemplate: '\
                <div class="arrow"></div>\
                <ul class="panel_actions">\
                    <li><a class="deletePanel" href="#"><%- _("Delete").t() %></a></li>\
                </ul>\
        ',
        template: '\
            <a class="dropdown-toggle btn-pill" href="#">\
                    <span class="<%- panelClass %>"></span><span class="caret"></span>\
            </a>\
            <div class="dropdown-menu">\
            </div>\
        ',
        onDelete: function(e){
            e.preventDefault();

            this.children.dialog = new TextDialog({
                id: "modal_delete", 
                "flashModel": this.model.dashboard
            });

            this.model.report.on('successfulDelete', this.children.dialog.closeDialog, this.children.dialog);  
            this.children.dialog.settings.set("primaryButtonLabel",_("Delete").t());
            this.children.dialog.settings.set("cancelButtonLabel",_("Cancel").t());
            this.children.dialog.on('click:primaryButton', this._dialogDeleteHandler, this);
            this.children.dialog.settings.set("titleLabel",_("Delete").t());
            this.children.dialog.setText(splunkUtils.sprintf(
                _("Are you sure you want to delete %s?").t(), '<em>' + _.escape(this.model.report.entry.content.get('display.general.title')) + '</em>'));
            $("body").append(this.children.dialog.render().el);
            this.children.dialog.show();
            this.children.popdown.hide();
        },
        
        _dialogDeleteHandler: function(e) {
            e.preventDefault(); 
            this.model.report.trigger('deleteReport'); 
            console.log('deleteReport event triggered');
        },
        onViewPanelReport: function(e){
            e.preventDefault();
            e.stopPropagation();
            var template = '', viewReportLink, editReportLink,
                root = this.model.application.get('root'),
                locale = this.model.application.get('locale'),
                app = this.model.application.get('app');
            viewReportLink = route.report(root, locale, app, {data: {s: this.model.report.get('id')}});
            if (this.model.report.isPivotReport()){
                template = this.pivotReportDetailsTemplate;
                editReportLink = route.pivot(root, locale, app, {data: {s: this.model.report.get('id')}});
            } else {
                template = this.searchReportDetailsTemplate;
                editReportLink = route.search(root, locale, app, {data: {s: this.model.report.get('id')}});
            }
            this.$('.dropdown-menu').html(_.template(template, { viewReportLink: viewReportLink, editReportLink: editReportLink, _:_ }));

            if(this.children.reportDetails) {
                this.children.reportDetails.remove();
            }

            this.children.reportDetails = new ReportDetailsView({
                model: {
                    report: this.model.report,
                    application: this.model.application,
                    appLocal: this.model.appLocal,
                    user: this.model.user
                },
                collection: this.collection.roles
            });

            this.$('.reportDetails').prepend($("<li/>").addClass('reportDetailsView').append(this.children.reportDetails.render().el));
            var desc = this.model.report.entry.content.get('description');
            if(desc) {
                this.$('.reportDetails').prepend($("<li/>").addClass('report-description').text(desc));
            }
            this.$('.reportDetails').prepend($("<li/>").addClass('report-name').text(this.model.report.entry.get('name')));
            this.$('.dropdown-menu').addClass('show-details');
            $(window).trigger('resize');
        },
        searchReportDetailsTemplate: '\
            <div class="arrow"></div>\
            <a class="dialogBack btn" href="#"><span class="icon-chevron-left"/> <%- _("Back").t() %></a>\
            <ul class="reportDetails">\
                <li><a href="<%- viewReportLink %>" class="viewSearchReport"><%- _("View").t() %></a></li>\
                <li><a href="<%- editReportLink %>" class="openSearchReport"><%- _("Open in Search").t() %></a></li>\
                <li><a href="#" class="cloneSearchReport"><%- _("Clone to an Inline Search").t() %></a></li>\
            </ul>\
            <ul class="reportActions">\
                <li><a href="#" class="selectNewReport"><%- _("Select New Report").t() %></a></li>\
                <li><a href="#" class="useReportFormatting"><%- _("Use Report\'s Formatting for this Content").t() %></a></li>\
            </ul>\
        ',
        pivotReportDetailsTemplate: '\
            <div class="arrow"></div>\
            <a class="dialogBack btn" href="#"><span class="icon-chevron-left"/> <%- _("Back").t() %></a>\
            <ul class="reportDetails">\
                <li><a href="<%- viewReportLink %>" class="viewPivotReport"><%- _("View").t() %></a></li>\
                <li><a href="<%- editReportLink %>" class="openPivotReport"><%- _("Open in Pivot").t() %></a></li>\
                <li><a href="#" class="clonePivotReport"><%- _("Clone to an Inline Pivot").t() %></a></li>\
            </ul>\
            <ul class="reportActions">\
                <li><a class="selectNewReport"><%- _("Select New Report").t() %></a></li>\
                <li><a class="useReportFormatting"><%- _("Use Report\'s Formatting for this Content").t() %></a></li>\
            </ul>\
        ',
        onDialogBack: function(e){
            e.preventDefault();
            e.stopPropagation();
            this._renderPanelControls();
            this.$('.dropdown-menu').removeClass('show-details');
            $(window).trigger('resize');
        },
        tbd: function(e){
            e.preventDefault();
            alert("Coming soon to a Splunk near you!");
        },
        convertToInlineSearch: function(e){
            e.preventDefault();
            this.children.dialog = new TextDialog({
                id: "modal_inline",
                "flashModel": this.model.dashboard
            });
            this.children.dialog.settings.set("primaryButtonLabel",_("Clone to Inline Search").t());
            this.children.dialog.settings.set("cancelButtonLabel",_("Cancel").t());
            this.children.dialog.on('click:primaryButton', this._convertToInlineSearch, this);
            this.model.report.on('successfulManagerChange', this.children.dialog.closeDialog, this.children.dialog);  
            this.children.dialog.settings.set("titleLabel", _("Clone to Inline Search").t());
            this.children.dialog.setText('<div>\
                <p>'+_("The report will be cloned to an inline search.").t()+'</p>\
                <p>'+_("The inline search:").t()+'\
                </p><ul>\
                <li>'+_("Cannot be scheduled.").t()+'</li>\
                <li>'+_("Will run every time the dashboard is loaded.").t()+'</li>\
                <li>'+_("Will use the permissions of the dashboard.").t()+'</li>\
                </ul>\
                </div>');
            $("body").append(this.children.dialog.render().el);
            this.children.dialog.show();
            this.children.popdown.hide();
        },
        convertToInlinePivot: function(e){
            e.preventDefault();
            this.children.dialog = new TextDialog ({
                id: "modal_inline",
                "flashModel": this.model.dashboard
            });
            this.children.dialog.settings.set("primaryButtonLabel",_("Clone to Inline Pivot").t());
            this.children.dialog.settings.set("cancelButtonLabel",_("Cancel").t());
            this.children.dialog.on('click:primaryButton', this._convertToInlineSearch, this);
            this.model.report.on('successfulManagerChange', this.children.dialog.closeDialog, this.children.dialog);
            this.children.dialog.settings.set("titleLabel", _("Clone to Inline Pivot").t());
            this.children.dialog.setText('<div>\
                <p>'+_("The report will be cloned to an inline pivot.").t()+'</p>\
                <p>'+_("The inline pivot:").t()+'\
                </p><ul>\
                <li>'+_("Cannot be scheduled.").t()+'</li>\
                <li>'+_("Will run every time the dashboard is loaded.").t()+'</li>\
                <li>'+_("Will use the permissions of the dashboard.").t()+'</li>\
                </ul>\
                </div>');
            $("body").append(this.children.dialog.render().el);
            this.children.dialog.show();
            this.children.popdown.hide();
            
        },
        _convertToInlineSearch: function(e){
            e.preventDefault();
            this.model.report.trigger("makeInline");
            console.log("makeInline event triggered"); 
        },
        useReportFormatting: function(e){
            e.preventDefault();

            this.children.dialog = new TextDialog({
                id: "modal_use_report_formatting", 
                "flashModel": this.model.dashboard
            });

            this.children.dialog.settings.set("primaryButtonLabel",_("Use Report's Formatting").t());
            this.children.dialog.settings.set("cancelButtonLabel",_("Cancel").t());
            this.children.dialog.on('click:primaryButton', this._useReportFormatting, this);
            this.model.report.on('successfulReportFormatting', this.children.dialog.closeDialog, this.children.dialog);  
            this.children.dialog.settings.set("titleLabel",_("Use Report's Formatting").t());
            this.children.dialog.setText(_("This will change the content's formatting to the report's formatting. Are you sure you want use the report's formatting?").t());
            $("body").append(this.children.dialog.render().el);
            this.children.dialog.show();
            this.children.popdown.hide();
        },
        _useReportFormatting: function(e){
            e.preventDefault(); 
            this.model.report.trigger("useReportFormatting");
            console.log('useReportFormatting event triggered');
        },
        selectNewReport: function(e) {
            e.preventDefault();
            this.children.newReportDialog = new ReportDialog({
                model:  {
                    report: this.model.report, 
                    dashboard: this.model.dashboard, 
                    application: this.model.application
                },
                controller: this.options.controller, 
                onHiddenRemove: true
            });

            $("body").append(this.children.newReportDialog.render().el);
            this.children.newReportDialog.show();
            this.children.popdown.hide();
        },
        convertToReport: function(e){
            e.preventDefault();
            if ($(e.currentTarget).is('.disabled')) {
                return;
            }
            this.children.createReportDialog = new CreateReportDialog({
                model:  {
                    report: this.model.report, 
                    dashboard: this.model.dashboard
                },
                onHiddenRemove: true
            });

            $("body").append(this.children.createReportDialog.render().el);
            this.children.createReportDialog.show();
            this.children.popdown.hide();
        },
        events: {
            'click a.deletePanel': 'onDelete',
            'click a.viewPanelReport': 'onViewPanelReport',
            'click a.changeElementTitle': "onChangeElementTitle",
            'click a.changeSearchString': "onChangeSearchString",
            'click a.dialogBack': "onDialogBack",
            'click a.cloneSearchReport': "convertToInlineSearch",
            'click a.clonePivotReport': "convertToInlinePivot",
            'click a.selectNewReport': "selectNewReport",
            'click a.convertToReport': "convertToReport",
            'click a.useReportFormatting': "useReportFormatting",
            'click a': function(e){
                // SPL-66074 - Catch all: open regular links in a new window
                var link = $(e.currentTarget).attr('href');
                if(link && link[link.length-1] !== '#') {
                    e.preventDefault();
                    window.open(link);
                }
            }, 
            'click li.reportDetailsView a': function(e){
                this.children.popdown.hide(); 
            }
        }

    });
    return PanelControls;
});

define('splunkjs/mvc/simplexml/paneleditor',['require','exports','module','../mvc','../basesplunkview','views/shared/vizcontrols/Master','views/dashboards/panelcontrols/Master','../savedsearchmanager','../searchmanager','splunkjs/mvc/utils','underscore','splunk.config','models/Base','util/console','./controller','../tokenawaremodel','models/dashboards/DashboardReport'],function(require, exports, module) {
    var mvc = require('../mvc');
    var BaseSplunkView = require('../basesplunkview');
    var FormatControls = require('views/shared/vizcontrols/Master');
    var PanelControls = require('views/dashboards/panelcontrols/Master');
    var SavedSearchManager = require('../savedsearchmanager');
    var SearchManager = require('../searchmanager');
    var utils = require('splunkjs/mvc/utils');
    var _ = require('underscore');
    var splunkConfig = require('splunk.config');
    var BaseModel = require('models/Base');
    var console = require('util/console');
    var controller = require('./controller');
    var TokenAwareModel = require('../tokenawaremodel');
    var DashboardReport = require('models/dashboards/DashboardReport');

    /**
     * Working model for a DashboardReport model
     * Delegates to saveXML() when save() is called
     */
    var WorkingModel = DashboardReport.extend({
        initialize: function(attrs, options) {
            DashboardReport.prototype.initialize.apply(this, arguments);
            this._report = options.report;

            this.entry.content = new TokenAwareModel({}, {
                applyTokensByDefault: true,
                retrieveTokensByDefault: true
            });

            this.setFromSplunkD(this._report.toSplunkD());

            // Make sure the working model stays up-to-date while in edit mode
            this.contentSyncer = utils.syncModels({
                source: this._report.entry.content,
                dest: this.entry.content,
                auto: 'push'
            });
            this.entrySyncer = utils.syncModels({
                source: this._report.entry,
                dest: this.entry,
                auto: 'push'
            });
        },
        save: function(attrs, options) {
            if(attrs) {
                this.set(attrs, options);
            }
            this._report.entry.set(this.entry.toJSON());
            this._report.entry.content.set(this.entry.content.toJSON({ tokens: true }));

            //return deferred that is returned by .save()
            return this._report.saveXML(options); 
        },
        syncOff: function() {
            this.contentSyncer.destroy();
            this.entrySyncer.destroy();
            this.off();
        }
    });

    var EditPanel = BaseSplunkView.extend({
        className: 'panel-editor',
        initialize: function() {
            this.children = this.children || {};
            BaseSplunkView.prototype.initialize.call(this);
            //create the report and state models
            this.model = this.model || {};
            this.model.report = this.model.report || new DashboardReport();
            this.model.working = new WorkingModel({}, { report: this.model.report });
            this.model.application = controller.model.app;
            this.manager = this.options.manager;
            this._instantiateChildren();
            this.bindToComponent(this.manager, this.onManagerChange, this);

            this.listenTo(this.model.report, 'makeInline', this._makePanelInline, this);
            this.listenTo(this.model.report, 'useReportFormatting', this._useReportFormatting, this);
            this.listenTo(this.model.report, 'updateReportID', this._updateReportID, this);
            this.listenTo(this.model.report, 'saveAsReport', this._saveAsReport, this);
            this.listenTo(this.model.report, 'updateSearchString', this._updateSearchManager, this);
            this.listenTo(this.model.report, 'deleteReport', this._deleteReport, this);
            //use this.model.working instead of this.model.report for dialogs that use tokens
            this.listenTo(this.model.working, 'saveTitle', this._saveTitle, this);

            this.model.user = controller.model.user;
            this.model.appLocal = controller.model.appLocal;
        },
        _instantiateChildren: function() {
            //create the child views
            this.children.vizControl = new FormatControls({
                model: { report: this.model.working, application: this.model.application },
                vizTypes: ['events', 'statistics', 'visualizations'],
                saveOnApply: true,
                dashboard: true
            });
            
            this.children.panelControl = new PanelControls({
                model: {
                    report: this.model.report,
                    working: this.model.working,
                    application: this.model.application,
                    appLocal: this.model.appLocal,
                    user: this.model.user, 
                    dashboard: controller.model.view,
                    state: controller.getStateModel()
                }, 
                controller: controller
            });
        },
        remove: function() {
            this.model.working.syncOff();
            this._removeChildren();
            BaseSplunkView.prototype.remove.apply(this, arguments);
        },
        _removeChildren: function() {
            this.children.vizControl.remove();
            this.children.panelControl.remove();
        },
        _updateSearchManager: function(newAttributes) {
            //preserve old state before search info is updated
            var oldState = this.model.report.toSplunkD(); 

            //update search info (note: we are passing newAttributes instead of newState as model.workingReport does not have toSplunkD() method)
            this.model.report.entry.content.set(newAttributes);

            var dfd = this.model.report.saveXML();
            dfd.done(_.bind(function(){
                //notify modal dialog of save success, so that the dialog knows to hide itself
                this.model.report.trigger("successfulSave"); 
                //update search manager with new search info 
                var manager = mvc.Components.get(this.manager);
                if(manager.settings) {
                    manager.settings.set('search', this.model.report.entry.content.get('search', { tokens: true }), { tokens: true, silent: false });
                    manager.settings.set({
                        'earliest_time': this.model.report.entry.content.get('dispatch.earliest_time', { tokens: true }),
                        'latest_time': this.model.report.entry.content.get('dispatch.latest_time', { tokens: true })
                    }, {tokens: true});
                }
            }, this)); 
            dfd.fail(_.bind(function(){
                //restore state and notify listeners to re-render views
                this.model.report.setFromSplunkD(oldState, {silent: false}); 
            }, this));             
        },

        onManagerChange: function() {
            this._removeChildren();
            this._instantiateChildren();
            this.render();

        },
        render: function() {
            this.$el.append(this.children.panelControl.render().el);
            this.$el.append(this.children.vizControl.render().el);
            return this;
        },
        _makePanelInline: function() {
            var oldState = this.model.report.toSplunkD(); 
            var oldName = this.model.report.entry.get('name'); 
            var oldId = this.model.report.get('id'); 

            delete this.model.report.id;
            this.model.report.unset('id', {silent: true});
            this.model.report.entry.unset('name', {silent: true}); //making inline, so remove name for getSearch() in mapper.js

            var dfd = this.model.report.saveXML();
            dfd.fail(_.bind(function(){
                //restore state and notify listeners to re-render views
                this.model.report.setFromSplunkD(oldState, {silent: false}); 
            }, this)); 
            dfd.done(_.bind(function(){
                this.model.report.trigger('successfulManagerChange'); 
                new SearchManager({
                    "id": this.manager,
                    "latest_time": this.model.report.entry.content.get('dispatch.latest_time'),
                    "earliest_time": this.model.report.entry.content.get('dispatch.earliest_time'),
                    "search": this.model.report.entry.content.get('search'),
                    "app": utils.getCurrentApp(),
                    "auto_cancel": 90,
                    "status_buckets": 0,
                    "preview": true,
                    "timeFormat": "%s.%Q",
                    "wait": 0
                }, { replace: true });

                //trigger change events on 'id' and 'name' 
                this.model.report.set({'id': oldId}, {silent: true}); 
                this.model.report.unset('id', {silent: false});

                this.model.report.entry.set({'name': oldName}, {silent: true}); 
                this.model.report.entry.unset('name', {silent: false}); 
            }, this)); 

        },
        _useReportFormatting: function() {
            //this.model.report.clear({silent: true});

            //preserve copy of report's attributes before fetch on model 
            var oldState = this.model.report.toSplunkD(); 
            var dfd = this.model.report.fetch({}, {silent: true});
            dfd.done(_.bind(function(){
                //get copy of report's attributes after fetch on model
                var newState = this.model.report.toSplunkD();
                var dfd = this.model.report.saveXML({clearOptions: true});                 
                dfd.fail(_.bind(function(){
                    //restore state and notify listeners to re-render views
                    this.model.report.setFromSplunkD(oldState, {silent: false}); 
                }, this)); 
                dfd.done(_.bind(function(){
                    this.model.report.setFromSplunkD(oldState, {silent: true}); //reset to enable listener notification in next line
                    this.model.report.setFromSplunkD(newState, {silent: false}); //notify listeners 
                    this.model.report.trigger("successfulReportFormatting"); 
                }, this)); 

            }, this)); 

        },
        _updateReportID: function(id, title) {
            //preserve copy of report's attributes before ID reset and fetch
            var oldState = this.model.report.toSplunkD(); 
            if(id){
                //set new attributes
                this.model.report.set({'id': id}, {silent: true});
                this.model.report.entry.set({'id': id}, {silent: true});
                this.model.report.id = id;
            }
            if(title){
                this.model.report.entry.content.set({"display.general.title": title});
            }

            var dfd = this.model.report.fetch({}, {silent: true});
            dfd.done(_.bind(function() {
                var dfd = this.model.report.saveXML();
                dfd.fail(_.bind(function(){
                    //restore old state and views 
                    this.model.report.setFromSplunkD(oldState, {silent: false}); 
                }, this)); 
                dfd.done(_.bind(function(){
                    //tell dialog to close itself
                    this.model.report.trigger('successfulManagerChange'); 
                    // tbd: overlay the defaults from the XML
                    
                    //update view to reflect new, successfully-saved attributes 
                    new SavedSearchManager({
                        "id": this.manager, 
                        "searchname": this.model.report.entry.get("name"),
                        "app": utils.getCurrentApp(),
                        "auto_cancel": 90,
                        "status_buckets": 0,
                        "preview": true,
                        "timeFormat": "%s.%Q",
                        "wait": 0
                    }, { replace: true });

                }, this));               
            }, this));
        },
        _saveAsReport: function(name, description) {
            var oldState = this.model.report.toSplunkD();

            //would like to add option {silent: true} to avoid notifying listeners (which updates the view) but adding it causes network 'bad request' response
            this.model.report.entry.content.set({"name": name, "description": description, "display.general.title": name}); 
            this.model.report.entry.set({'name': name}, {silent: true});

            if(this.model.report.entry.content.get('display.general.search.type') === 'postprocess') {
                // Apply base-search + post process as search for new report
                this.model.report.entry.content.set('search', mvc.Components.get(this.manager).settings.resolve());
            }

            var dfd = this.model.report.save({}, { data: { app: utils.getCurrentApp(), owner: splunkConfig.USERNAME }});
            dfd.done(_.bind(function() {
                var dfd = this.model.report.saveXML(); 
                dfd.fail(_.bind(function(){
                    this.model.report.destroy(); 
                    this.model.report.unset('id', {silent: true});
                    this.model.report.setFromSplunkD(oldState, {silent: false}); //notify listeners to restore old view 
                }, this)); 
                dfd.done(_.bind(function(){
                    this.model.report.trigger("successfulReportSave");
                    new SavedSearchManager({
                        "id": this.manager,
                        "searchname": name,
                        "app": utils.getCurrentApp(),
                        "auto_cancel": 90,
                        "status_buckets": 0,
                        "preview": true,
                        "timeFormat": "%s.%Q",
                        "wait": 0
                    }, { replace: true });
                }, this));       
            }, this));
        },
        _saveTitle: function(newTitle){
            var oldState = this.model.report.toSplunkD(); 
            this.model.working.entry.content.set({'display.general.title': newTitle});
            //use this.model.working instead of this.model.report for dialogs that use tokens
            var dfd = this.model.working.save();
            dfd.fail(_.bind(function(){
                //restore old title as new title could not be saved, and notify listners to restore old views 
                this.model.report.setFromSplunkD(oldState, {silent: false}); 
            }, this)); 
            dfd.done(_.bind(function(){
                //notify modal dialog of save success, so that the dialog knows to hide itself
                this.model.working.trigger("successfulSave"); 
                //notify listeners so they update their views on displayed report model 
                this.model.report.entry.content.set({'display.general.title': ""}, {silent: false});   
                this.model.report.entry.content.set({'display.general.title': newTitle}, {silent: false});   
            }, this)); 
        }, 
        _deleteReport: function(){
            var dfd = this.model.report.deleteXML(); //returns deferred - removes panel from dashboard view
            dfd.done(_.bind(function(){
                this.model.report.trigger("successfulDelete");  
                this.model.report.trigger("removedPanel"); //removes report's XML
            }, this)); 
        }
    });

    return EditPanel;
});

define('splunkjs/mvc/simplexml/element/base',['require','underscore','jquery','backbone','../../basesplunkview','../../../mvc','../../utils','../controller','models/dashboards/DashboardReport','util/console','../../progressbarview','../../refreshtimeindicatorview','../../resultslinkview','../paneleditor','../../savedsearchmanager','../../postprocessmanager','../../messages','../../tokenutils','util/general_utils'],function(require){
    var _ = require('underscore'), $ = require('jquery'), Backbone = require('backbone');
    var BaseSplunkView = require('../../basesplunkview');
    var mvc = require('../../../mvc');
    var utils = require('../../utils');
    var Dashboard = require('../controller');
    var ReportModel = require('models/dashboards/DashboardReport');
    var console = require('util/console');
    var ProgressBarView = require('../../progressbarview');
    var RefreshTimeView = require("../../refreshtimeindicatorview");
    var ResultsLinkView = require("../../resultslinkview");
    var PanelElementEditor = require('../paneleditor');
    var SavedSearchManager = require('../../savedsearchmanager');
    var PostProcessSearchManager = require('../../postprocessmanager');
    var Messages = require("../../messages");
    var TokenUtils = require('../../tokenutils');
    var GeneralUtils = require("util/general_utils");

    // Enable to warn whenever a SimpleXML element or visualization
    // is created without the tokens=true option.
    // 
    // All product code should be using the option.
    // Only custom JS code from the user may omit it.
    var WARN_ON_MISSING_TOKENS_TRUE = false;

    var ELEMENT_TYPES = {};

    var REPORT_DEFAULTS_LOADED = new ReportModel().fetch();

    var DashboardElement = BaseSplunkView.extend({
        initialVisualization: '#abstract',
        configure: function() {
            this.options.settingsOptions = _.extend({
                retainUnmatchedTokens: true
            }, this.options.settingsOptions || {});

            // Augment the options with the extra information we need
            this.options = _.extend(this.options, {
                id: this.id,
                // NOTE: Aliasing 'managerid' to the deprecated 'manager'
                //       setting since old code may still be depending on it.
                //       However any such code will behave oddly if the manager
                //       is changed after initialization.
                manager: this.options.managerid,
                title: this.$('h3').text()
            });

            if (WARN_ON_MISSING_TOKENS_TRUE &&
                this.options.settingsOptions.tokens !== true)
            {
                console.warn('element created without tokens=true: ' + this.id);
            }

            BaseSplunkView.prototype.configure.apply(this, arguments);
        },
        initialize: function () {
            this.configure();
            this.visualization = null;
            this.model = new ReportModel();
            this.managerid = this.options.managerid;

            this.settings._sync = utils.syncModels(this.settings, this.model.entry.content, {
                auto: true,
                prefix: 'display.general.',
                include: ['id', 'title', 'manager', 'managerid']
            });

            // JIRA: Not using bindToComponentSetting('managerid', ...) here
            //       because this view inconsistently uses *both* the 'manager'
            //       and 'managerid' options. Thus it is not presently possible
            //       to dynamically change the 'managerid' option for SimpleXML
            //       elements, although you can for MVC components.
            //
            //       If usage of the 'manager' property can be eliminated and
            //       any assumptions about a constant manager at initialization
            //       time can be eliminated, this code can be safely
            //       transitioned. (SPL-72466)
            this.bindToComponent(this.managerid, this.onManagerChange, this);

            var typeModel = this.typeModel = new Backbone.Model({
                type: this.initialVisualization
            });

            // Deferred object is resolved once the report model is fully loaded
            this.reportReady = $.Deferred();

            this.listenTo(this.typeModel, 'change', this.createVisualization, this);
            this.listenTo(Dashboard.getStateModel(), 'change:edit', this.onEditModeChange, this);
            this.reportReady.done(_.bind(function(){
                this.listenTo(this.model.entry.content, 'change:display.general.type change:display.visualizations.type change:display.events.type', function (m) {
                    var general = m.get('display.general.type'), subName = ['display', general, 'type'].join('.'), sub = m.get(subName),
                        qualifiedType = sub ? [general, sub].join(':') : general;
                    typeModel.set('type', ELEMENT_TYPES.hasOwnProperty(qualifiedType) ? qualifiedType : general);
                }, this);
                this.listenTo(this.settings, 'change:title', this.updateTitle, this);
                this.listenTo(this.model, 'removedPanel', this.remove, this);
            },this));
            this._setupTokenDependencies();
        },
        remove: function(){
            this._removeVisualization();
            _([this.refreshTime, this.panelEditor]).chain().filter(_.identity).invoke('remove');
            if(this.settings) {
                if(this.settings._sync) {
                    this.settings._sync.destroy();
                }
            }
            mvc.Components.get('dashboard').removeElement(this.id);
            BaseSplunkView.prototype.remove.call(this);
        },
        onManagerChange: function(managers, manager) {
            var that = this;
            if(manager instanceof SavedSearchManager) {
                var name = manager.get('searchname'),
                        appModel = Dashboard.getStateModel().app,
                        initial = !this.model.entry.content.has('display.general.type');
                this.model.id = ['','servicesNS',encodeURIComponent(appModel.get('owner')),encodeURIComponent(appModel.get('app')),'saved','searches', encodeURIComponent(name)].join('/');
                this.model.fetch({ tokens: false }).done(function(){
                    if (initial) {
                        that.model.entry.content.set(that._initialVisualizationToAttributes());
                    }
                    that.reportReady.resolve(that.model);
                }).fail(function(xhr){
                            console.error('Failed to load saved search', arguments);
                            if(xhr.status === 404) {
                                that.showErrorMessage(_("Warning: saved search not found: ").t() + JSON.stringify(name));
                            }
                        });
            } else if(manager) {
                REPORT_DEFAULTS_LOADED.done(function(response){
                    // Apply the report defaults (from the _new entity) to our report model before applying specific settings
                    if (!that.model.entry.content.has('display.general.type')) {
                        // Apply defaults and initial visualization attributes if they aren't set yet
                        that.model.entry.content.set(response.entry[0].content, { tokens: false });
                        if(that.initialVisualization !== '#abstract') {
                            that.model.entry.content.set(that._initialVisualizationToAttributes());
                        }
                    }
                    var searchType = 'inline';
                    if (manager instanceof PostProcessSearchManager) {
                        searchType = 'postprocess';
                        that.model.entry.content.set('fullSearch', manager.settings.resolve());
                    } else if (manager.has('metadata') && manager.get('metadata').global) {
                        searchType = 'global';
                    }
                    that.model.entry.content.set('display.general.search.type', searchType);
                    that.model.entry.content.set({
                        search: manager.get('search', {tokens: true}),
                        "dispatch.earliest_time": manager.get('earliest_time', {tokens: true}),
                        "dispatch.latest_time": manager.get('latest_time', {tokens: true})
                    }, {tokens: true});
                    that.reportReady.resolve(that.model);
                });
            } else {
                REPORT_DEFAULTS_LOADED.done(function(response){
                    // Apply the report defaults (from the _new entity) to our report model
                    if (!that.model.entry.content.has('display.general.type')) {
                        // Apply defaults and initial visualization attributes if they aren't set yet
                        that.model.entry.content.set(response.entry[0].content, { tokens: false });
                        if(that.initialVisualization !== '#abstract') {
                            that.model.entry.content.set(that._initialVisualizationToAttributes());
                        }
                    }
                    that.reportReady.resolve(that.model);
                });
            }
        },
        showErrorMessage: function(message) {
            this._removeInitialPlaceholder();
            var el = this.$('.panel-body>.msg');
            if(!el.length) {
                el = $('<div class="msg"></div>').appendTo(this.$('.panel-body'));
            }
            Messages.render({
                level: "error",
                icon: "warning-sign",
                message: message
            }, el);
        },
        _initialVisualizationToAttributes: function() {
            var type = this.initialVisualization.split(':'),
                attr = {
                    'display.general.type': type[0]
                };
            if (type.length > 1) {
                attr[['display', type[0], 'type'].join('.')] = type[1];
            }
            return attr;
        },
        onEditModeChange: function (model) {
            var handler = this._debouncedOnEditModeChange;
            if(!handler) {
                handler = this._debouncedOnEditModeChange = _.debounce(_.bind(this._onEditModeChange, this), 0);
            }
            this.reportReady.done(function(){
                handler(model);
            });
        },
        _onEditModeChange: function (model) {
            if (model.get('edit')) {
                if (this.refreshTime) {
                    this.refreshTime.remove();
                    this.refreshTime = null;
                }
                this.updateTitle();
                this.createPanelElementEditor();
                if(this.$el.is('.hidden')) {
                    this.$el.show().parents('.dashboard-panel').trigger('elementVisibilityChanged');
                }
            } else {
                if (this.panelEditor) {
                    this.panelEditor.remove();
                    this.panelEditor = null;
                }
                this.createRefreshTimeIndicator();
                this.updateTitle();
                if(this.$el.is('.hidden')) {
                    this.$el.hide().parents('.dashboard-panel').trigger('elementVisibilityChanged');
                }
            }
        },
        _setupTokenDependencies: function() {
            var deps = this.settings.get('tokenDependencies', { tokens: true });
            if (deps) {
                var element = this;
                var registry = mvc.Components;
                var requiredTokens = deps.depends ? TokenUtils.getTokens(deps.depends, { tokenNamespace: 'submitted' }) : [];
                var rejectedTokens = deps.rejects ? TokenUtils.getTokens(deps.rejects, { tokenNamespace: 'submitted' }) : [];
                var allTokens = requiredTokens.concat(rejectedTokens);

                function isTokenDefined(token) {
                    return registry.get(token.namespace).has(token.name);
                }

                function handleTokenChange() {
                    if (_(requiredTokens).all(isTokenDefined) && !_(rejectedTokens).any(isTokenDefined)) {
                        element.show();
                    } else {
                        element.hide();
                    }
                }

                _(allTokens).each(function(token) {
                    var ns = registry.get(token.namespace);
                    element.listenTo(ns, 'change:' + token.name, handleTokenChange, element);
                });
                handleTokenChange();
            }
        },
        hide: function() {
            if (!this.$el.is('.hidden')) {
                if(!Dashboard.getStateModel().get('edit')) {
                    this.$el.hide();
                }
                this.$el.addClass('hidden').parents('.dashboard-panel').trigger('elementVisibilityChanged');
            }
        },
        show: function() {
            if (this.$el.is('.hidden')) {
                this.$el.show().removeClass('hidden').parents('.dashboard-panel').trigger('elementVisibilityChanged');
                if(this.visualization) {
                    // Force viz to re-render
                    this.visualization.render();
                }
            }
        },
        createPanelElementEditor: function() {
            if (this.panelEditor) {
                this.panelEditor.remove();
                this.panelEditor = null;
            }
            this.panelEditor = new PanelElementEditor({ manager: this.managerid, model: { report: this.model } });
            this.$el.prepend(this.panelEditor.render().el);
        },
        createRefreshTimeIndicator: function () {
            var refreshTimeVisible = this.settings.get('refresh.time.visible');
            var showRefreshTime = (refreshTimeVisible === undefined || GeneralUtils.normalizeBoolean(refreshTimeVisible, {'default': false}));
            var refreshTimeInterval = this.settings.get('refresh.auto.interval');
            if (!this.refreshTime && (showRefreshTime || refreshTimeInterval)) {
                this.refreshTime = new RefreshTimeView({
                    id: _.uniqueId(this.id + '-refreshtime'),
                    el: $('<div class="refresh-time-indicator pull-right"></div>').prependTo(this.$('.panel-head')),
                    manager: this.managerid,
                    "refresh.auto.interval": this.settings.get('refresh.auto.interval'),
                    "refresh.time.visible": this.settings.get('refresh.time.visible')
                }).render();
            }
        },
        createVisualization: function (applyOptions) {
            var createFn = this._debouncedCreateViz;
            if(!createFn) {
                createFn = this._debouncedCreateViz = _.debounce(_.bind(this._createVisualization, this), 0);
            }
            $.when(this.reportReady).then(function(){
                createFn(applyOptions === true);
            });
        },
        _removeVisualization: function() {
            if (this.visualization) {
                if (this.visualization.panelClassName) {
                    this.$el.removeClass(this.visualization.panelClassName);
                }
                this.visualization.off();
                // Remove will revoke it from the registry
                this.visualization.remove();
                this.visualization = null;
            }
            if (this.resultsLink) {
                this.resultsLink.off();
                // Remove will revoke it from the registry
                this.resultsLink.remove();
                this.resultsLink = null;
            }
        },
        _removeInitialPlaceholder: function(){
            this.$('.panel-body > .msg, .panel-body > .initial-placeholder').remove();
        },
        _createVisualization: function (applyOptions) {
            var initial = !this.visualization;
            this._removeInitialPlaceholder();
            this._removeVisualization();
            var type = this.typeModel.get('type'),
                Element = ELEMENT_TYPES[type];

            if (!Element) {
                this.showErrorMessage(_("Unsupported visualization type: ").t() + JSON.stringify(type));
                return;
            }
            var options = {
                el: $('<div></div>').appendTo(this.$('.panel-body')),
                reportModel: this.model.entry.content,
                managerid: this.settings.get('manager'),
                id: _.uniqueId(this.id + '-viz-')
            };
            if (initial || applyOptions) {
                // Only pass the component options down when the initial visualization is created
                options = _.extend({}, this.options, options);
            }
            if (options.settingsOptions) {
                // Do not pass through retainUnmatchedTokens=true to visualization
                options.settingsOptions.retainUnmatchedTokens = false;
            }
            if (WARN_ON_MISSING_TOKENS_TRUE &&
                (options.settingsOptions || {}).tokens !== true)
            {
                console.warn('viz created without tokens=true: ' + options.id);
            }
            this.visualization = new Element(options).render();

            if (this.visualization.panelClassName) {
                this.$el.addClass(this.visualization.panelClassName);
            }

            // If we are switching this visualization to the events visualization,
            // then we need to set any search manager to have status_buckets > 0
            if (type.indexOf("events") === 0) {
                var manager = mvc.Components.getInstance(this.settings.get('manager'));
                manager.settings.set('status_buckets', 300);
            }

            this.trigger('create:visualization', this.visualization);

            if (initial) {
                this.model.entry.content.set(_.defaults(this.model.entry.content.toJSON({ tokens: true }), this.visualization.reportDefaults));
            }
            if (typeof this.visualization.getResultsLinkOptions === 'function') {
                var resultsLinkOptions = this.visualization.getResultsLinkOptions(this.options) || {};
                this.resultsLink = new ResultsLinkView(_.extend({}, resultsLinkOptions, this.options, {
                    id: _.uniqueId(this.id + '-resultslink'),
                    el: $('<div class="view-results pull-left"></div>').appendTo(this.$('.panel-footer')),
                    manager: this.managerid,
                    model: this.model
                })).render();
            }

            this.visualization.on('all', this.trigger, this);
        },
        getVisualization: function(callback) {
            var dfd = $.Deferred();
            if(callback) {
                dfd.done(callback);
            }
            if(this.visualization) {
                dfd.resolve(this.visualization);
            } else {
                this.once('create:visualization', dfd.resolve, dfd);
            }
            return dfd.promise();
        },
        render: function () {
            this.createPanelStructure();

            if (!this.progressBar) {
                this.progressBar = new ProgressBarView({
                    id: _.uniqueId(this.id + "-progressbar"),
                    manager: this.managerid,
                    el: $('<div class="progress-container pull-right"></div>').prependTo(this.$('.panel-footer'))
                }).render();
            }

            this.createRefreshTimeIndicator();
            this.createVisualization();
            this.onEditModeChange(Dashboard.getStateModel());
            return this;
        },
        createPanelStructure: function () {
            if (!this.$('.panel-head').length) {
                $('<div class="panel-head"></div>').prependTo(this.$el);
            }
            var $title = this.$('.panel-head>h3');
            if (!$title.length) {
                $('<h3></h3>').prependTo(this.$('.panel-head'));
            }
            this.updateTitle();

            if (!this.$('.panel-body').length) {
                $('<div class="panel-body"></div>').appendTo(this.$el);
            }
            var el = $('<div class="initial-placeholder"></div>').addClass('placeholder-' + this.initialVisualization.replace(/\W+/,'-'));
            el.appendTo(this.$('.panel-body'));
            if (!this.$('panel-footer').length) {
                $('<div class="panel-footer"></div>').appendTo(this.$el);
            }
            // this.$('.panel-footer').addClass('clearfix');
        },
        updateTitle: function () {
            var title = this.settings.get('title') || '';
            if(Dashboard.getStateModel().get('edit') && !title) {
                this.$('.panel-head>h3').empty().append($('<span class="untitled">'+_("Untitled Panel").t()+'</span>'));
            } else {
                this.$('.panel-head>h3').text(title);
            }
        },
        getExportParams: function(prefix) {
            var manager = mvc.Components.get(this.managerid), result = {};
            if(manager && (!(manager instanceof PostProcessSearchManager)) && manager.job && manager.job.sid) {
                result[prefix] = manager.job.sid;
            }
            return result;
        }
    }, {
        registerVisualization: function (name, clazz) {
            ELEMENT_TYPES[name] = clazz;
        },
        getVisualization: function(name) {
            var viz = ELEMENT_TYPES[name];
            if(!viz) {
                viz = ELEMENT_TYPES[name.split(':')[0]];
            }
            return viz;
        }
    });

    return DashboardElement;
});

define('splunkjs/mvc/simplexml/dialog/addpanel/inline',['require','underscore','jquery','views/Base','views/shared/controls/ControlGroup','util/console','../../../utils','uri/route','util/time','views/dashboards/PanelTimeRangePicker','bootstrap.tooltip'],function(require){
    var _ = require('underscore'),
        $ = require('jquery'),
        BaseView = require('views/Base');
    var ControlGroup = require('views/shared/controls/ControlGroup');
    var console = require('util/console');
    var utils = require('../../../utils');
    var route = require('uri/route');
    var time_utils = require('util/time');
    var PanelTimeRangePicker = require('views/dashboards/PanelTimeRangePicker');
    require('bootstrap.tooltip');

    return BaseView.extend({
        initialize: function() {
            BaseView.prototype.initialize.apply(this, arguments);

            this.children.searchField = new ControlGroup({
                controlType: 'Textarea',
                controlOptions: {
                    modelAttribute: 'search',
                    model: this.model.report
                },
                label: _("Search String").t(),
                help: '<a href="#" class="run-search">'+_("Run Search").t()+' <i class="icon-external"></i></a>'
            });

            this.listenTo(this.model.report, 'change:elementCreateType', this.onModeChange, this);

            this.children.panelTimeRangePicker = new PanelTimeRangePicker({
                model: {
                    timeRange: this.model.timeRange,
                    report: this.model.report,
                    state: this.model.state
                },
                collection: this.collection
            });

            this.model.report.set({
                'dispatch.earliest_time': this.model.timeRange.get('earliest'),
                'dispatch.latest_time':this.model.timeRange.get('latest')
            }, {tokens: true});
        },
        events: {
            'click a.run-search': function(e) {
                e.preventDefault();
                var search = this.model.report.get('search'), params = { q: search }, pageInfo = utils.getPageInfo();
                if(!search) {
                    return;
                }
                if(this.model.report.has('dispatch.earliest_time')) {
                    params.earliest = this.model.report.get('dispatch.earliest_time');
                    params.latest = this.model.report.get('dispatch.latest_time');
                }
                utils.redirect(route.search(pageInfo.root, pageInfo.locale, pageInfo.app, { data: params }), true);
            }
        },
        onModeChange: function() {
            var fn = this.model.report.get('elementCreateType') === 'inline' ? 'show' : 'hide';
            this.$el[fn]();
        },
        render: function() {
            this.children.searchField.render().appendTo(this.el);

            this.children.panelTimeRangePicker.render().appendTo(this.el);

            this.onModeChange();
            
            return this;
        }
    });

});
define('splunkjs/mvc/simplexml/dialog/addpanel/report',['require','underscore','jquery','views/Base','views/shared/controls/ControlGroup','../../../utils','util/time','models/shared/Cron','splunk.util','uri/route','collections/services/SavedSearches','views/shared/Modal'],function(require) {
    var _ = require('underscore'),
            $ = require('jquery'),
            Base = require('views/Base');
    var ControlGroup = require('views/shared/controls/ControlGroup');
    var utils = require('../../../utils');
    var timeUtils = require('util/time');
    var Cron = require('models/shared/Cron');
    var splunkUtil = require('splunk.util');
    var route = require('uri/route');
    var SavedSearches = require('collections/services/SavedSearches');
    var Modal = require('views/shared/Modal');

    return Base.extend({
        initialize: function() {
            Base.prototype.initialize.apply(this, arguments);
            this.children.reportPlaceholder = new Base();
            this.controller = this.options.controller;

            if(!this.controller.reportsCollection){
                this.controller.fetchCollection();
            }

            this.controller.reportsCollection.initialFetchDfd.done(_.bind(function() {
                var items = this.controller.reportsCollection.map(function(report){
                    return { label: report.entry.get('name'), value: report.entry.get('name') };
                });
                var pageInfo = utils.getPageInfo();
                var reportsLink = route.reports(
                    pageInfo.root,
                    pageInfo.locale,
                    pageInfo.app
                );

                if(this.controller.reportsCollection.length === this.controller.reportsCollection.REPORTS_LIMIT){
                    this.children.report = new ControlGroup({
                        label: "",
                        controlType: 'SyntheticSelect',
                        controlOptions: {
                            className: 'btn-group add-panel-report',
                            toggleClassName: 'btn',
                            model: this.model,
                            modelAttribute: 'savedSearchName',
                            items: items,
                            popdownOptions: this.options.popdownOptions || {
                                attachDialogTo: '.modal:visible',
                                scrollContainer: '.modal:visible .modal-body:visible'
                            }
                        },
                        help: _("This does not contain all reports. Add a report that is not listed from ").t() + splunkUtil.sprintf('<a href=%s>%s</a>.', reportsLink, _('Reports').t())
                    });
                }else{
                    this.children.report = new ControlGroup({
                        label: "",
                        controlType: 'SyntheticSelect',
                        controlOptions: {
                            className: 'btn-group add-panel-report',
                            toggleClassName: 'btn',
                            model: this.model,
                            modelAttribute: 'savedSearchName',
                            items: items,
                            popdownOptions: this.options.popdownOptions || {
                                attachDialogTo: '.modal:visible',
                                scrollContainer: '.modal:visible .modal-body:visible'
                            }
                        }
                    });
                }

                if (!this.model.get('savedSearchName')) {
                    this.model.set('savedSearchName', items[0].value);
                }
            }, this));

            this.children.searchField = new ControlGroup({
                controlType: 'Textarea',
                controlOptions: {
                    modelAttribute: 'savedSearchString',
                    model: this.model
                },
                label: _("Search String").t(),
                help: '<a href="#" class="run-search">'+_("Run Search").t()+' <i class="icon-external"></i></a>'
            });

            this.children.timerangeField = new ControlGroup({
                controlType: 'Label',
                controlOptions: {
                    modelAttribute: 'savedSearchTimerange',
                    model: this.model
                },
                label: _("Time Range").t()
            });

            this.children.schedule = new ControlGroup({
                controlType: 'Label',
                controlOptions: {
                    modelAttribute: 'savedSearchSchedule',
                    model: this.model
                },
                label: _("Schedule").t()
            });

            this.children.permissions = new ControlGroup({
                controlType: 'Label',
                controlOptions: {
                    modelAttribute: 'savedSearchPermissions',
                    model: this.model
                },
                label: _("Permissions").t()
            });

            this.model.set('savedSearchString', '...');
            this.listenTo(this.model, 'change:elementCreateType', this.onModeChange, this);
            this.listenTo(this.model, 'change:savedSearchName', this.searchSelected, this);
        },
        events: {
            'click a.run-search': function(e) {
                e.preventDefault();
                var savedSearchName = this.model.get('savedSearchName');
                if(!savedSearchName) {
                    return;
                }

                var pageInfo = utils.getPageInfo(), url = route.search(pageInfo.root, pageInfo.locale, pageInfo.app, {
                    data: { s: savedSearchName }
                });
                utils.redirect(url, true);
            }
        },
        searchSelected: function() {
            var savedSearchName = this.model.get('savedSearchName');
            var report = this.controller.reportsCollection.find(function(model) {
                return (model.entry.get('name') === savedSearchName);
            });

            if (!report) {
                return;
            }

            this.model.set('savedSearch', report.get('id'));
            this.model.set('savedSearchString', report.entry.content.get('search'));
            var et = report.entry.content.get('dispatch.earliest_time'),
                    lt = report.entry.content.get('dispatch.latest_time');

            var vizType = 'statistics', sub;
            if(report.entry.content.has('display.general.type')) {
                vizType = report.entry.content.get('display.general.type');
                sub = ['display', vizType, 'type'].join('.');
                if(report.entry.content.has(sub)) {
                    vizType = [vizType, report.entry.content.get(sub)].join(':');
                }
            }
            this.model.set('savedSearchVisualization', vizType);
            this.model.set('savedSearchTimerange', timeUtils.generateLabel(this.collection.timeRanges, et, null, lt, null));
            var schedule = _("Never").t();
            if(report.entry.content.get('is_scheduled')) {
                var cronModel = Cron.createFromCronString(report.entry.content.get('cron_schedule'));
                schedule = cronModel.getScheduleString();
            }
            this.model.set('savedSearchSchedule', schedule);
            this.model.set('savedSearchPermissions', splunkUtil.sprintf(_("%s. Owned by %s.").t(),
                    (report.entry.acl.get("perms")) ? _("Shared").t() : _("Not Shared").t(),
                    report.entry.acl.get("owner")));
        },
        onModeChange: function() {
            this.$el[ this.model.get('elementCreateType') === 'saved' ? 'show' : 'hide' ]();
            //if reports have not been fetched and there is no loading message yet, then create a loading message
            if(this.model.get('elementCreateType') === 'saved' && this.controller.reportsCollection.initialFetchDfd.readyState !== 4 && this.$(Modal.LOADING_SELECTOR).length === 0){
                this.$el.append(Modal.LOADING_HORIZONTAL);
                this.$(Modal.LOADING_SELECTOR).html(_('Loading...').t());
            }
        },
        render: function() {
            this.children.reportPlaceholder.render().appendTo(this.el);
            this.controller.reportsCollection.initialFetchDfd.done(_.bind(function() {
                //reports fetch is done so remove any loading message and render other elements
                if(this.$(Modal.LOADING_SELECTOR).length > 0){
                   this.$(Modal.LOADING_SELECTOR).remove();
                }
                this.children.report.render().appendTo(this.children.reportPlaceholder.el);
                this.searchSelected();
                this.children.searchField.render().appendTo(this.el);
                this.children.searchField.$('textarea').attr('readonly', 'readonly');

                this.children.timerangeField.render().appendTo(this.el);
                this.children.schedule.render().appendTo(this.el);
                this.children.permissions.render().appendTo(this.el);

                this.onModeChange();
            }, this));

            return this;
        }
    });

});

define('splunkjs/mvc/simplexml/dialog/addpanel/pivot',['require','underscore','views/Base','../../../utils','uri/route'],function(require){
    var _ = require('underscore'),
        Base = require('views/Base'),
        utils = require('../../../utils'),
        route = require('uri/route');

    return Base.extend({
        initialize: function() {
            Base.prototype.initialize.apply(this, arguments);
            this.listenTo(this.model, 'change:elementCreateType', this.onModeChange, this);
        },
        render: function() {
            if(!this.el.innerHTML) {
                var pageInfo = utils.getPageInfo();
                this.$el.html(_.template(this.template, {
                    pivotLink: route.pivot(pageInfo.root, pageInfo.locale, pageInfo.app)
                }));
            }
            this.onModeChange();
            return this;
        },
        onModeChange: function() {
            var fn = this.model.get('elementCreateType') === 'pivot' ? 'show' : 'hide';
            this.$el[fn]();
        },
        template: '<label class="control-label"></label><div class="controls">' +
                _("Use the Pivot tool to summarize Data Model information and add it as a dashboard panel. You'll need to know the name of this dashboard when you save from the Pivot tool.").t()+
                '</div>'
    });

});
define('splunkjs/mvc/simplexml/dialog/addpanel/master',['require','exports','module','underscore','jquery','splunkjs/mvc','views/Base','views/shared/controls/ControlGroup','../../controller','./inline','./report','./pivot','util/console'],function(require, module, exports) {
    var _ = require('underscore'), $ = require('jquery'), mvc = require('splunkjs/mvc');
    var BaseView = require('views/Base');
    var ControlGroup = require('views/shared/controls/ControlGroup');
    var Dashboard = require('../../controller');
    var InlineForm = require('./inline');
    var ReportForm = require('./report');
    var PivotForm = require('./pivot');
    var console = require('util/console');

    return BaseView.extend({
        moduleId: module.id,
        className: 'add-panel',
        initialize: function() {
            BaseView.prototype.initialize.apply(this, arguments);
            this.children.panelTitleControlGroup = new ControlGroup({
                label: _("Content Title").t(),
                controlType: 'Text',
                controlClass: 'controls-block',
                controlOptions: {
                    model: this.model.report,
                    modelAttribute: 'title',
                    placeholder: _("optional").t()
                }
            });

            this.children.elementCreateType = new ControlGroup({
                label: _("Content Type").t(),
                controlType: 'SyntheticRadio',
                controlClass: 'controls-thirdblock',
                controlOptions: {
                    className: 'btn-group btn-group-3 add-panel-select',
                    items: [
                        {value: 'inline', label: '<i class="icon-search-thin"></i>', tooltip: _("Inline Search").t()},
                        {value: 'pivot', label: '<i class="icon-pivot"></i>', tooltip: _("Inline Pivot").t()},
                        {value: 'saved', label: '<i class="icon-report"></i>', tooltip: _("Report").t()}
                    ],
                    model: this.model.report,
                    modelAttribute: 'elementCreateType'
                }
            });

            var timesCollection = Dashboard.collection.times;

            this.children.inline = new InlineForm({
                model: this.model,
                collection: {
                    timeRanges: timesCollection
                }
            });
            this.children.report = new ReportForm({
                model: this.model.report,
                collection: {
                    timeRanges: timesCollection
                }, 
                controller: this.options.controller
            });

            this.children.pivot = new PivotForm({
                model: this.model.report
            });

        },
        render: function() {

            this.$el.append(this.children.panelTitleControlGroup.render().el);
            this.$el.append(this.children.elementCreateType.render().el);
            this.$el.append(this.children.inline.render().el);
            this.$el.append(this.children.pivot.render().el);
            this.$el.append(this.children.report.render().el);

            return this;
        }
    });

});

define('splunkjs/mvc/simplexml/dialog/addpanel',['require','exports','module','underscore','jquery','splunkjs/mvc','views/shared/Modal','models/Base','../../utils','../controller','../element/base','../mapper','./addpanel/master','../../searchmanager','../../savedsearchmanager','util/console','views/shared/timerangepicker/dialog/Master','models/shared/TimeRange','views/shared/delegates/ModalTimerangePicker','../controller','uri/route','views/shared/FlashMessages'],function(require, module, exports) {
    var _ = require('underscore'), $ = require('jquery'), mvc = require('splunkjs/mvc');
    var Modal = require('views/shared/Modal');
    var BaseModel = require('models/Base');
    var utils = require('../../utils');
    var Dashboard = require('../controller');
    var DashboardElement = require('../element/base');
    var Mapper = require('../mapper');
    var AddPanelView = require('./addpanel/master');
    var SearchManager = require('../../searchmanager');
    var SavedSearchManager = require('../../savedsearchmanager');
    var console = require('util/console');
    var TimeRangePickerView = require('views/shared/timerangepicker/dialog/Master');
    var TimeRangeModel = require('models/shared/TimeRange');
    var TimeRangeDelegate = require('views/shared/delegates/ModalTimerangePicker');
    var controller = require('../controller');
    var route = require('uri/route');
    var FlashMessages = require('views/shared/FlashMessages'); 
    
    /**
     * Transient model representing the information for a new dashboard panel element
     */
    var NewPanelModel = BaseModel.extend({
        defaults: {
            elementCreateType: 'inline',
            'dispatch.earliest_time': '0',
            'dispatch.latest_time': ''
        },
        validation: {
            search: {
                fn: 'validateSearchQuery'
            }
        },
        validateSearchQuery: function(value, attr, computedState) {
            if(computedState['elementCreateType'] === 'inline' && !value) {
                return 'Search string is required.';
            }
        },
        sync: function(method, model, options) {
            console.log('NewPanelModel.sync(%o, %o, %o)', method, model, options);
            if(method !== 'create') {
                throw new Error('Unsupported sync method: ' + method);
            }
            if(!model.isValid()) {
                return false;
            }
            var dfd = $.Deferred();
            var searchType = this.get('elementCreateType');
            var elementId, i = 1;
            do {
                elementId = 'element' + (i++);
            } while(mvc.Components.has(elementId));

            var vizType = searchType === 'saved' ? this.get('savedSearchVisualization') || 'visualizations:charting' : 'visualizations:charting',
                    mapper = Mapper.get(vizType);

            Dashboard.getStateModel().view.addElement(elementId, {
                type: mapper.tagName,
                title: this.get('title'),
                search: {
                    type: searchType,
                    search: this.get('search'),
                    earliest_time: this.get('dispatch.earliest_time'),
                    latest_time: this.get('dispatch.latest_time'),
                    name: this.get('savedSearchName')
                }
            }).done(_.bind(function() {
                        var newItemElement = mvc.Components.get('dashboard').createNewElement({
                            title: this.get('title'),
                            id: elementId
                        });
                        var newSearchId = _.uniqueId('new-search');
                        switch(searchType) {
                            case 'inline':
                                new SearchManager({
                                    "id": newSearchId,
                                    "search": this.get('search'),
                                    "earliest_time": this.get('dispatch.earliest_time') || "0",
                                    "latest_time": this.get('dispatch.latest_time') || '',
                                    "app": utils.getCurrentApp(),
                                    "auto_cancel": 90,
                                    "status_buckets": 0,
                                    "preview": true,
                                    "timeFormat": "%s.%Q",
                                    "wait": 0,
                                    "runOnSubmit": true
                                }, {tokens: true});
                                break;
                            case 'saved':
                                new SavedSearchManager({
                                    "id": newSearchId,
                                    "searchname": this.get('savedSearchName'),
                                    "app": utils.getCurrentApp(),
                                    "auto_cancel": 90,
                                    "status_buckets": 0,
                                    "preview": true,
                                    "timeFormat": "%s.%Q",
                                    "wait": 0
                                });
                                break;
                        }

                        var ElementType = DashboardElement.extend({
                            initialVisualization: vizType
                        });

                        var component = new ElementType({
                            id: elementId,
                            managerid: newSearchId,
                            el: newItemElement
                        }, {tokens: true});
                        component.render();
                        dfd.resolve();
                    }, this));

            return dfd.promise();
        }
    });
    
    var PanelTimeRangeModel = TimeRangeModel.extend({
        validation: _.extend({
            earliest_token: function(value, attr, computedState) {
                if(computedState.useTimeFrom === 'tokens' && !value) {
                    return 'No value specified for earliest token.';
                }
            },
            latest_token: function(value, attr, computedState) {
                if(computedState.useTimeFrom === 'tokens' && !value) {
                    return 'No value specified for latest token.';
                }
            }
        })
    });

    return Modal.extend({
        moduleId: module.id,
        className: 'modal add-panel',
        initialize: function() {
            Modal.prototype.initialize.apply(this, arguments);
            this.model=  this.model || {};
            this.model.report = new NewPanelModel();
            this.model.timeRange = new PanelTimeRangeModel({
                'earliest': "0",
                'latest': ""
            });

            var appModel = Dashboard.model.app;
            var userModel = Dashboard.model.user;
            var appLocalModel = Dashboard.model.appLocal;
            var timesCollection = Dashboard.collection.times;

            this.children.addPanel = new AddPanelView({ 
                model: {
                    report: this.model.report,
                    timeRange: this.model.timeRange,
                    state: controller.getStateModel()
                }, 
                collection: {
                    times: timesCollection
                }, 
                controller: this.options.controller  
            });

            this.children.timeRangePickerView = new TimeRangePickerView({
                model: {
                    timeRange: this.model.timeRange,
                    user: userModel,
                    appLocal: appLocalModel,
                    application: appModel
                },
                collection: timesCollection,
                appendSelectDropdownsTo: '.modal:visible'
            });

            this.children.flashMessages = new FlashMessages({model: this.model});

            this.model.timeRange.on('applied', function() {
                this.timeRangeDelegate.closeTimeRangePicker();
            }, this);

            this.listenTo(this.model.report, 'change:elementCreateType', this.handleSubmitButtonState, this);

        },
        events: {
            'click a.modal-btn-primary': function(e) {
                if(this.model.report.get('elementCreateType') === 'pivot') {
                    return;
                }
                e.preventDefault();
                Dashboard.getStateModel().set('edit', false);
                var modal = this;
                var useTimeFrom = this.model.timeRange.get('useTimeFrom');
                var timeTokenPrefix = useTimeFrom == "global" ? '': useTimeFrom + '.';
                var errors = this.model.report.validate();

                if (useTimeFrom === "tokens") {
                    var timeRangeErrors = this.model.timeRange.validate();
                    if (timeRangeErrors) {
                        errors = (errors) ? _.extend(errors, timeRangeErrors) : timeRangeErrors;
                    }
                }

                if (errors) {
                    this.children.flashMessages.flashMsgCollection.reset();
                    _.each(errors, function(val) {
                        this.children.flashMessages.flashMsgCollection.add({
                            key: 'addpanel-' + val,
                            type: 'error',
                            html: _.escape(_(val).t())
                        });
                    }, this);
                    return;
                }

                if (useTimeFrom === "tokens") {
                    this.model.report.set({
                        'dispatch.earliest_time': '$' + this.model.timeRange.get('earliest_token') +'$',
                        'dispatch.latest_time': '$' + this.model.timeRange.get('latest_token') +'$',
                        'useTimeFrom': 'tokens'
                    }, {tokens: true});
                } else if (useTimeFrom !== "search"){
                    this.model.report.set({
                        'dispatch.earliest_time': '$' + timeTokenPrefix +'earliest$',
                        'dispatch.latest_time': '$' + timeTokenPrefix +'latest$'
                    }, {tokens: true});
                }
                var dfd = this.model.report.save();

                if(dfd) {
                    dfd.done(function() {
                        setTimeout(function() {
                            Dashboard.getStateModel().set('edit', true);
                        }, 250);
                        modal.hide();
                    });
                } else {
                    Dashboard.getStateModel().set('edit', true);
                }
            }, 
            'hide': function(e){
                //if 'hide' event is triggered on this modal and not bubbled up from its child elements
                if( e.target === this.el ){ 
                    this.remove(); 
                }      
            }
        },
        handleSubmitButtonState: function(model) {
   
            if(this.model.report.get('elementCreateType') === 'pivot') {
                var pageInfo = utils.getPageInfo();
                this.$(Modal.FOOTER_SELECTOR)
                    .find('.btn-primary').replaceWith('<a href="'+route.pivot(pageInfo.root, pageInfo.locale, pageInfo.app)+'" class="btn btn-primary modal-btn-primary">' + _('Go to Pivot').t() + '</a>');
            }
            else{
                this.$(Modal.FOOTER_SELECTOR)
                    .find('.btn-primary').replaceWith('<a href="#" class="btn btn-primary modal-btn-primary">' + _('Add Panel').t() + '</a>');             
            }

        },
        setLabel: function() {
            var timeLabel = this.model.timeRange.generateLabel(this.collection);
            this.$el.find("span.time-label").text(timeLabel);
        },
        render: function() {
            this.$el.html(Modal.TEMPLATE);

            this.$(Modal.HEADER_TITLE_SELECTOR).html(_("Add Panel").t());

            this.$(Modal.BODY_SELECTOR).remove();

            this.$(Modal.FOOTER_SELECTOR).before(
                '<div class="vis-area">' +
                    '<div class="slide-area">' +
                        '<div class="content-wrapper add-panel-wrapper">' +
                            '<div class="' + Modal.BODY_CLASS + '" >' +
                            '</div>' +
                        '</div>' +
                        '<div class="timerange-picker-wrapper">' +
                        '</div>' +
                    '</div>' +
                '</div>'
            );

            this.$(Modal.BODY_SELECTOR).prepend(this.children.flashMessages.render().el);
            this.$(Modal.BODY_SELECTOR).append(Modal.FORM_HORIZONTAL_JUSTIFIED);

            this.$visArea = this.$('.vis-area').eq(0);
            this.$slideArea = this.$('.slide-area').eq(0);
            this.$addpanelContent = this.$('.add-panel-wrapper').eq(0);
            this.$timeRangePickerWrapper = this.$('.timerange-picker-wrapper').eq(0);

            this.$(Modal.BODY_FORM_SELECTOR).append(this.children.addPanel.render().el);
            this.$timeRangePickerWrapper.append(this.children.timeRangePickerView.render().el);

            this.$modalParent = this.$el;

            this.timeRangeDelegate = new TimeRangeDelegate({
                el: this.el,
                $visArea: this.$visArea,
                $slideArea: this.$slideArea,
                $contentWrapper: this.$addpanelContent,
                $timeRangePickerWrapper: this.$timeRangePickerWrapper,
                $modalParent: this.$modalParent,
                $timeRangePicker: this.children.timeRangePickerView.$el,
                activateSelector: 'a.timerange-control',
                backButtonSelector: 'a.btn.back'
            });

            this.$(Modal.FOOTER_SELECTOR).append(Modal.BUTTON_CANCEL);
            this.$(Modal.FOOTER_SELECTOR).append('<a href="#" class="btn btn-primary modal-btn-primary">' + _('Add Panel').t() + '</a>');

            this.$(Modal.FOOTER_SELECTOR).append('<a href="#" class="btn back modal-btn-back pull-left">' + _('Back').t() + '</a>');
            this.$('.btn.back').hide();

            return this;
        }
    });

});

define('views/shared/documentcontrols/dialogs/TitleDescriptionDialog',[
    'underscore',
    'backbone',
    'module',
    'views/shared/Modal',
    'views/shared/controls/ControlGroup',
    'views/shared/FlashMessages'
    ],
    function(
        _,
        Backbone,
        module,
        Modal,
        ControlGroup,
        FlashMessage
    ) {
    return Modal.extend({
        moduleId: module.id,
        /**
        * @param {Object} options {
        *       model: <models.Report>
        * }
        */
        initialize: function(options) {
            Modal.prototype.initialize.apply(this, arguments);

            this.model = {
                inmem: this.model.clone(),
                report: this.model
            };

            this.children.flashMessage = new FlashMessage({ model: this.model.inmem });

            this.children.titleField = new ControlGroup({
                controlType: 'Label',
                controlOptions: {
                    modelAttribute: 'name',
                    model: this.model.inmem.entry
                },
                label: _('Title').t()
            });

            this.children.descriptionField = new ControlGroup({
                controlType: 'Textarea',
                controlOptions: {
                    modelAttribute: 'description',
                    model: this.model.inmem.entry.content,
                    placeholder: _('optional').t()
                },
                label: _('Description').t()
            });

            this.on('hidden', function() {
                if (this.model.inmem.get("updated") > this.model.report.get("updated")) {
                    //now we know have updated the clone
                    this.model.report.entry.content.set('description', this.model.inmem.entry.content.get("description"));
                }
            }, this);
        },
        events: $.extend({}, Modal.prototype.events, {
            'click .btn-primary': function(e) {
                this.model.inmem.save({}, {
                    success: function(model, response) {
                        this.hide();
                    }.bind(this)
                });

                e.preventDefault();
            }
        }),
        render : function() {
            this.$el.html(Modal.TEMPLATE);

            this.$(Modal.HEADER_TITLE_SELECTOR).html(_("Edit Description").t());

            this.children.flashMessage.render().prependTo(this.$(Modal.BODY_SELECTOR));

            this.$(Modal.BODY_SELECTOR).append(Modal.FORM_HORIZONTAL);

            this.children.titleField.render().appendTo(this.$(Modal.BODY_FORM_SELECTOR));
            this.children.descriptionField.render().appendTo(this.$(Modal.BODY_FORM_SELECTOR));

            this.$(Modal.FOOTER_SELECTOR).append(Modal.BUTTON_CANCEL);
            this.$(Modal.FOOTER_SELECTOR).append(Modal.BUTTON_SAVE);

            return this;
        }
    });
});

define('views/shared/documentcontrols/dialogs/DeleteDialog',[
    'underscore',
    'backbone',
    'module',
    'models/search/Report',
    'views/shared/Modal',
    'views/shared/FlashMessages',
    'uri/route',
    'splunk.util'
    ],
    function(
        _,
        Backbone,
        module,
        ReportModel,
        Modal,
        FlashMessage,
        route,
        splunkUtil
    ) {
    return Modal.extend({
        moduleId: module.id,
        /**
        * @param {Object} options {
        *       model: {
        *           report <models.Report>,
        *           application: <models.Application>
        *       },
        *       {Boolean} deleteRedirect: (Optional) Whether or not to redirect to reports page after delete. Default is false.        * }
        */
        initialize: function(options) {
            Modal.prototype.initialize.apply(this, arguments);

            this.children.flashMessage = new FlashMessage({ model: this.model.report });
        },
        events: $.extend({}, Modal.prototype.events, {
            'click .btn-primary': function(e) {
                var deleteDeferred = this.model.report.destroy({wait: true});

                $.when(deleteDeferred).then(function() {
                    this.hide();
                    if (this.options.deleteRedirect) {
                        if (this.model.report.isAlert()) {
                            window.location = route.alerts(this.model.application.get("root"), this.model.application.get("locale"), this.model.application.get("app"));
                        } else {
                            window.location = route.reports(this.model.application.get("root"), this.model.application.get("locale"), this.model.application.get("app"));
                        }
                    }
                }.bind(this));

                e.preventDefault();
            }
        }),
        render : function() {
            this.$el.html(Modal.TEMPLATE);

            this.children.flashMessage.render().prependTo(this.$(Modal.BODY_SELECTOR));

            if (this.model.report.isAlert()) {
                this.$(Modal.HEADER_TITLE_SELECTOR).html(_("Delete Alert").t());
            } else {
                this.$(Modal.HEADER_TITLE_SELECTOR).html(_("Delete Report").t());
            }
            this.$(Modal.BODY_SELECTOR).append('<span>' + splunkUtil.sprintf(_('Are you sure you want to delete %s?').t(), '<em>' + _.escape(this.model.report.entry.get('name')) + '</em>') + '</span>');
            
            

            this.$(Modal.FOOTER_SELECTOR).append(Modal.BUTTON_CANCEL);

            this.$(Modal.FOOTER_SELECTOR).append(this.compiledTemplate({
                _: _
            }));

            return this;
        },
        template: '\
            <a href="#" class="btn btn-primary"><%- _("Delete").t() %></a>\
        '
    });
});

define('views/dashboards/table/controls/ConvertSuccess',[
    'jquery',
    'underscore', 
    'module', 
    'views/shared/Modal',
    'uri/route',
    'views/shared/documentcontrols/dialogs/permissions_dialog/Master'
    ],
    function(
        $,
        _, 
        module, 
        Modal, 
        route, 
        PermissionsDialog
    )
{

    return Modal.extend({
        moduleId: module.id,
        options: {
            refreshOnDismiss: false
        },
        initialize: function() {
            Modal.prototype.initialize.apply(this, arguments);

            if (this.options.refreshOnDismiss) {
                this.on('hide hidden', function() {
                    window.location.reload();
                });
            }
        },
        events: $.extend({}, Modal.prototype.events, {
            'click .edit-perms': function(e) {
                e.preventDefault();
                var that = this;
                var model = that.model, roles = that.collection.roles;
                _.defer(function(){
                    var permissionsDialog = new PermissionsDialog({
                        model: {
                            document: model.dashboard,
                            nameModel: model.dashboard.entry.content,
                            user: model.user
                        },
                        collection: roles,
                        nameLabel:  "Dashboard",
                        nameKey: 'label',
                        onHiddenRemove: true
                    });

                    if (that.options.refreshOnDismiss) {
                        permissionsDialog.on('hide hidden', function() {
                            window.location.reload();
                        });
                    }

                    $("body").append(permissionsDialog.render().el);
                    permissionsDialog.show();
                });

                if (that.options.refreshOnDismiss) {
                    that.off('hide hidden');
                }

                that.hide();
                that.remove();
            }
        }),
        render: function() {
            this.$el.html(Modal.TEMPLATE);
            this.$(Modal.HEADER_TITLE_SELECTOR).html(_("Dashboard has been converted.").t());
            this.$(Modal.BODY_SELECTOR).append(Modal.FORM_HORIZONTAL);

            var app = this.model.dashboard.entry.acl.get("app");
            var name = this.model.dashboard.entry.get('name');


            var link = route.page(this.model.application.get("root"), this.model.application.get("locale"),
                    app, name);

            // TODO some refactoring could be done here with editdashboard.js "Edit source" button
            var newDashboardLink = route.page(this.model.application.get('root'), this.model.application.get('locale'), this.model.application.get('app'), this.model.dashboard.entry.get('name')); 
            var editLink = "/manager/" + app + 
                    "/data/ui/views/" + name + 
                    "?action=edit&ns=" +  app + 
                    "&redirect_override=" + encodeURIComponent(newDashboardLink);

            this.$(Modal.BODY_FORM_SELECTOR).append(_.template(this.messageTemplate, {
                dashboardLink: link,
                _: _
            }));

            this.$(Modal.FOOTER_SELECTOR).append(_.template(this.buttonTemplate, {
                dashboardLink: link,
                editLink: editLink,
                _: _
            }));

            this.$(Modal.FOOTER_SELECTOR).append('');
            return this;
        },
        buttonTemplate: '<a href="<%= editLink %>" class="btn edit-panels"><%- _("Edit HTML").t() %></a>' +
                        '<a href="<%= dashboardLink %>" class="btn btn-primary modal-btn-primary"><%- _("View").t() %></a>',
        messageTemplate: '<p><%- _("You may now view your dashboard, change additional settings, or edit the HTML.").t() %></p>' +
                        '<p><%- _("Additional Settings").t() %>:' +
                            '<ul>' +
                                '<li><a href="#" class="edit-perms"><%- _("Permissions").t() %></a></li>' +
                            '</ul>' +
                        '</p>'
    });

});

/**
 * @author jszeto
 * @date 6/14/13
 *
 * Given two TextControls, copies the value of the source TextControl over to the destination TextControl. If the user
 * types into the destination TextControl, the pairing ends. Call the enablePairing or disablePairing functions to
 * customize the behavior. The text that is copied over can be modified by the transformFunction.
 *
 * Inputs:
 *    sourceDelegate {views/shared/controls/TextControl} - Text Control from which to copy text
 *    destDelegate {views/shared/controls/TextControl} - Text Control that receives the copied text
 *    transformFunction {Function} - Takes a string as an input and returns a transformed string
 */
define('views/shared/delegates/PairedTextControls',['jquery',
        'underscore',
        'backbone',
        'views/shared/controls/TextControl',
        'views/shared/delegates/Base'
       ],
    function(
        $,
        _,
        Backbone,
        TextControl,
        DelegateBase) {

        return DelegateBase.extend({

            transformFunction: undefined,

            /**
             * @constructor
             * @param options {Object} {
             * }
             */

            initialize: function(options) {
                options = options || {};

                this.sourceDelegate = options.sourceDelegate;
                this.destDelegate = options.destDelegate;
                this.transformFunction = options.transformFunction;

                if (!(this.sourceDelegate instanceof TextControl) ||
                    !(this.destDelegate instanceof TextControl)) {
                    throw new Error("SourceDelegate and destDelegate must be TextControls");
                }

                this.enablePairing();
            },

            enablePairing: function() {
                this.sourceDelegate.on("keyup", this.sourceChangeHandler, this);
                this.destDelegate.on("keyup", this.destChangeHandler, this);
            },

            disablePairing: function() {
                this.sourceDelegate.off("keyup", this.sourceChangeHandler, this);
            },

            sourceChangeHandler: function(e, value) {
                var destValue = value;
                if (this.transformFunction)
                    destValue = this.transformFunction(value);
                this.destDelegate.setValue(destValue);
            },

            destChangeHandler: function(e, value) {
                // If we get a non-tab or non-shift key, then disable the pairing
                if (e.keyCode != 9 && e.keyCode != 16) {
                    this.disablePairing();
                    this.destDelegate.off("keyup", this.destChangeHandler);
                }
            }


        });
    });
define('views/dashboards/table/controls/ConvertDashboard',[
    'underscore',
    'jquery',
    'module', 
    'views/shared/Modal',
    'views/shared/controls/ControlGroup', 
    'models/Base', 
    'models/search/Dashboard',
    'views/shared/FlashMessages', 
    'views/dashboards/table/controls/ConvertSuccess', 
    'views/shared/delegates/PairedTextControls',
    'views/shared/controls/TextControl',
    'util/splunkd_utils',
    'uri/route', 
    'util/xml'],
    
    function(
        _,
        $,
        module, 
        Modal, 
        ControlGroup, 
        BaseModel, 
        DashboardModel, 
        FlashMessagesView, 
        ConvertSuccessView, 
        PairedTextControls,
        TextControl,
        splunkDUtils, 
        route, 
        xmlUtils
    ) 
{

    var ConvertMode = {
        NEW: 0,
        REPLACE: 1
    };

    return Modal.extend({
        moduleId: module.id,
        
        initialize: function () {
            var that = this;

            Modal.prototype.initialize.apply(this, arguments);

            this.model.perms = new BaseModel({
                perms: 'private'
            });

            this.model.convertMode = new BaseModel({
                mode: ConvertMode.NEW
            });

            this.children.flashMessages = new FlashMessagesView({
                model: {
                    dashboard: this.model.dashboard,
                    dashboardMeta: this.model.dashboard.meta
                }
            });

            this.model.dashboard.meta.set({
                label: this.model.dashboard.meta.get('label') + _(' HTML').t()
            });

            this.children.titleTextControl = new TextControl({
                modelAttribute: 'label',
                model: this.model.dashboard.meta,
                placeholder: _('optional').t(),
                save: false
            });

            this.children.filenameTextControl = new TextControl({
                modelAttribute: 'name',
                model: this.model.dashboard.entry.content,
                save: false
            });

            this.children.filenameTextControl.setValue(
                splunkDUtils.nameFromString(this.model.dashboard.meta.get('label'))
            );

            this.pairedTextControls = new PairedTextControls({
                sourceDelegate: this.children.titleTextControl,
                destDelegate: this.children.filenameTextControl,
                transformFunction: splunkDUtils.nameFromString
            });

            this.children.mode = new ControlGroup({
                controlType: 'SyntheticRadio',
                controlClass: 'controls-halfblock',
                controlOptions: {
                    className: "btn-group btn-group-2",
                    modelAttribute: 'mode',
                    model: this.model.convertMode,
                    items: [
                        { label: _("Create New").t(), value: ConvertMode.NEW },
                        { label: _("Replace Current").t(), value: ConvertMode.REPLACE }
                    ],
                    save: false
                },
                label: _("Dashboard").t(),
                help: _("Recommended").t()

            });

            this.children.title = new ControlGroup({
                controls: this.children.titleTextControl,
                label: _("Title").t()
            });

            this.children.filename = new ControlGroup({
                controls: this.children.filenameTextControl,
                label: _("ID").t(),
                help: _("Can only contain letters, numbers and underscores.").t(),
                tooltip: _("The ID is used as the filename on disk. Cannot be changed later.").t()
            });

            this.children.description = new ControlGroup({
                controlType: 'Textarea',
                controlOptions: {
                    modelAttribute: 'description',
                    model: this.model.dashboard.meta,
                    placeholder: _("optional").t(),
                    save: false
                },
                label: _("Description").t()
            });


            this.children.permissions = new ControlGroup({
                controlType: 'SyntheticRadio',
                controlClass: 'controls-halfblock',
                controlOptions: {
                    className: "btn-group btn-group-2",
                    modelAttribute: 'perms',
                    model: this.model.perms,
                    items: [
                        { label: _("Private").t(), value: 'private' },
                        { label: _("Shared").t(), value: 'shared' }
                    ],
                    save: false
                },
                label: _("Permissions").t()
            });

            this.model.convertMode.on('change:mode', function() {
                that.children.flashMessages.flashMsgCollection.reset();

                if (that.model.convertMode.get('mode') === ConvertMode.NEW) {
                    that.children.title.show();
                    that.children.filename.show();
                    that.children.description.show();
                    that.children.permissions.show();
                } else { // === ConvertMode.REPLACE
                     that.children.flashMessages.flashMsgCollection.add({
                        type: 'warning',
                        html: _("This change cannot be undone.").t()
                    });
                    that.children.title.hide();
                    that.children.filename.hide();
                    that.children.description.hide();
                    that.children.permissions.hide();
                }
            });

        },
        events: $.extend({}, Modal.prototype.events, {
            'click a.modal-btn-primary': function(e) {
                e.preventDefault();
                this.submit();
            }
        }),
        submit: function() {
            var that = this;
            var dashboard = that.model.dashboard;
            var currentDashboard = that.model.currentDashboard;
            var app = that.model.application;
            var user = that.model.user;
            var sourceLink = route.page(app.get("root"), app.get("locale"), currentDashboard.entry.acl.get("app"), currentDashboard.entry.get('name')) + '/converttohtml';
            var updateCollection = that.collection && that.collection.dashboards;


            if (this.model.convertMode.get('mode') === ConvertMode.NEW) {
                dashboard.meta.validate();
                if (dashboard.meta.isValid()) { 
                    var meta = dashboard.meta.toJSON();
                    dashboard.entry.content.set('eai:data', currentDashboard.entry.content.get('eai:data'));
                    dashboard.entry.content.set('eai:type', 'views'); // necessary to make dashboard.meta.apply work
                    dashboard.meta.set(meta);
                    dashboard.meta.apply();

                    $.post(
                        sourceLink,
                        {
                            xmlString: dashboard.entry.content.get('eai:data'), 
                            newViewID: dashboard.entry.content.get('name')
                        }
                    ).done(function(htmlSource) {
                        dashboard.entry.content.set('eai:type', 'html');
                        dashboard.entry.content.set('eai:data', htmlSource);

                        dashboard.save({}, {
                            data: app.getPermissions(that.model.perms.get('perms'))
                        }).done(function() { 
                            if (updateCollection) { 
                                that.collection.dashboards.add(that.model.dashboard); 
                            }

                            _.defer(function() {
                                var successDialog = new ConvertSuccessView({
                                    model: {
                                        dashboard: dashboard,
                                        application: app,
                                        user: user
                                    },
                                    collection: that.collection 
                                });
                                successDialog.render().show();

                            });

                            that.hide();
                            that.remove();
                        });
                    });
                }
            } else { // === ConvertMode.REPLACE

                $.post(
                    sourceLink,
                    {
                        xmlString: currentDashboard.entry.content.get('eai:data')
                    }
                ).done(function(htmlSource) {
                    currentDashboard.entry.content.set('eai:type', 'html');
                    currentDashboard.entry.content.set('eai:data', htmlSource);

                    currentDashboard.save().done(function() {

                        if (updateCollection) {
                            currentDashboard.trigger('updateCollection');
                        }

                        _.defer(function() {
                            var successDialog = new ConvertSuccessView({
                                model: {
                                    dashboard: currentDashboard,
                                    application: app
                                },
                                collection: that.collection,
                                refreshOnDismiss: !updateCollection
                            });
                            successDialog.render().show();

                        });

                        that.hide();
                        that.remove();
                    });
                });
            }
        },
        render: function () {
            var helpLink = route.docHelp(
                this.model.application.get("root"),
                this.model.application.get("locale"),
                'learnmore.html.dashboard'
            ); 

            this.$el.html(Modal.TEMPLATE);
            this.$(Modal.HEADER_TITLE_SELECTOR).html(_("Convert Dashboard to HTML").t());
            this.$(Modal.BODY_SELECTOR).prepend(this.children.flashMessages.render().el);
            this.$(Modal.BODY_SELECTOR).append('<p>' + _("HTML dashboards cannot be edited using Splunk's visual editors.").t() +
                 '<br />' + _('Integrated PDF generation is not available for HTML dashboards.').t() + '<br />' + 
                 '<a href=' + helpLink + '>' +_("Learn More").t() + ' <i class="icon-external"></i></a></p>'); 
            this.$(Modal.BODY_SELECTOR).append(Modal.FORM_HORIZONTAL);

            this.$(Modal.BODY_FORM_SELECTOR).append(this.children.mode.render().el);
            this.$(Modal.BODY_FORM_SELECTOR).append(this.children.title.render().el);
            this.$(Modal.BODY_FORM_SELECTOR).append(this.children.filename.render().el);
            this.$(Modal.BODY_FORM_SELECTOR).append(this.children.description.render().el);
            this.$(Modal.BODY_FORM_SELECTOR).append(this.children.permissions.render().el);

            this.$(Modal.FOOTER_SELECTOR).append(Modal.BUTTON_CANCEL);
            this.$(Modal.FOOTER_SELECTOR).append('<a href="#" class="btn btn-primary modal-btn-primary">' + _("Convert Dashboard").t() + '</a>');
            return this;
        }
    });

});

define('models/services/ScheduledView',['jquery','underscore','backbone','models/SplunkDBase','models/Base', 'splunk.util', 'backbone_validation'],
function($, _, Backbone, SplunkDBase, BaseModel, splunkUtil, Val){

    var ScheduledView =  SplunkDBase.extend({
        defaults: {
            'is_scheduled': false,
            'action.email.subject.view': "Splunk Dashboard: '$name$'",
            'action.email.message.view': 'A PDF was generated for $name$',
            'action.email.useNSSubject': '1',
            'action.email.papersize': 'letter',
            'action.email.paperorientation': 'portrait',
            'action.email.priority': '3',
            'cron_schedule': '0 6 * * 1'
        },
        initialize: function() {
            SplunkDBase.prototype.initialize.apply(this, arguments);
        },
        url: function() {
            return 'scheduled/views/' + this.viewName;
        },
        findByName: function(viewName, app, owner) {
            this.viewName = viewName;
            this.id = 'scheduled/views/'+viewName;
            var dfd = this.fetch({ data: { app: app, owner: owner }});
            dfd.done(_.bind(this.applyDefaultsIfNotScheduled, this));
            return dfd;
        },
        applyDefaultsIfNotScheduled: function() {
            if(!this.entry.content.get('is_scheduled')) {
                this.entry.content.set(this.defaults);
            }
        }
    });

    ScheduledView.Entry = ScheduledView.Entry.extend({});
    ScheduledView.Entry.Content = ScheduledView.Entry.Content.extend({
        validation: {
            'action.email.to': {
                fn: 'validateEmailList'
            },
            'action.email.subject.view': {
                fn: 'validateNSSubject'
            },
            'action.email.subject': {
                fn: 'validateSubject'
            }
        },
        validateSubject: function(value, attr, computedState) {
            if (splunkUtil.normalizeBoolean(computedState['is_scheduled']) &&
                !splunkUtil.normalizeBoolean(computedState['action.email.useNSSubject']) &&
                (_.isUndefined(value) || $.trim(value).length === 0)) {
                
                return _('Subject is empty').t();
            }
        },
        validateNSSubject: function(value, attr, computedState) {
            if (splunkUtil.normalizeBoolean(computedState['is_scheduled']) &&
                splunkUtil.normalizeBoolean(computedState['action.email.useNSSubject']) &&
                (_.isUndefined(value) || $.trim(value).length === 0)) {
                
                return _('Subject is empty').t();
            }
        },
        validateEmailList: function(value, attr, model) {
            if(model.is_scheduled) {
                if(!value) {
                    return _("Email Address list is empty").t();
                }
                if(_(value.split(/\s*,\s*/)).any(function(v){ return !Val.patterns.email.test(v); })) {
                    return _("Email Address list is invalid").t();
                }
            }
        }
    });

    return ScheduledView;
});

define('views/dashboards/table/controls/SchedulePDF',
    [
        'module',
        'jquery',
        'underscore',
        'backbone',
        'util/console',
        'util/pdf_utils',
        'models/services/ScheduledView',
        'models/shared/Cron',
        'views/Base',
        'views/shared/Modal',
        'views/shared/controls/ControlGroup',
        'views/shared/EmailOptions',
        'views/shared/ScheduleSentence',
        'views/shared/FlashMessages', 
        'uri/route'
    ],
    function(
        module, 
        $, 
        _, 
        Backbone, 
        console, 
        pdfUtils, 
        ScheduledViewModel, 
        Cron, 
        BaseView, 
        Modal, 
        ControlGroup,
        EmailOptions, 
        ScheduleSentence, 
        FlashMessagesView, 
        route
    ){

        var ControlWrapper = BaseView.extend({
            render: function() {
                if(!this.el.innerHTML) {
                    this.$el.html(_.template(this.template, {
                        label: this.options.label || '',
                        controlClass: this.options.controlClass || '',
                        body: _.template(this.options.body||'')(this.model ? (this.model.toJSON ? this.model.toJSON() : this.model) : {})
                    }));
                }
                var target = this.$('.controls');
                _.each(this.options.children, function(child){
                    child.render().appendTo(target);
                });
                return this;
            },
            template: '<label class="control-label"><%- label %></label><div class="controls <%- controlClass %>"><%= body %></div>'
        });


        return Modal.extend({
            moduleId: module.id,
            className: 'modal schedule-pdf modal-wide',
             /**
             * @param {Object} options {
             *     model: {
             *         scheduledView: <models.services.ScheduledView>,
             *         dashboard: <models.services.data.ui.Views>
             *     }
             * }
             */
            initialize: function() {
                Modal.prototype.initialize.apply(this, arguments);


                this.model.inmem = new ScheduledViewModel.Entry.Content(this.model.scheduledView.entry.content.toJSON());
                // default come froma different model.  Since this is async, we should only do as needed
                if (!this.model.inmem.get('action.email.papersize')){
                    pdfUtils.getEmailAlertSettings().done(_.bind(function(emailSettings) {
                        // Since async souble check that user hasn't set this yet
                        if (!this.model.inmem.get('action.email.papersize')){
                            this.model.inmem.set('action.email.papersize', emailSettings.entry.content.get('reportPaperSize'));
                        }
                    }, this));
                }
                if (!this.model.inmem.get('action.email.paperorientation')){
                    pdfUtils.getEmailAlertSettings().done(_.bind(function(emailSettings) {
                        // Since async souble check that user hasn't set this yet
                        if (!this.model.inmem.get('action.email.paperorientation')){
                            this.model.inmem.set('action.email.paperorientation', emailSettings.entry.content.get('reportPaperOrientation'));
                        }
                    }, this));
                }
                 var cronModel = this.model.cron = Cron.createFromCronString(this.model.inmem.get('cron_schedule') || '0 6 * * 1');
                 this.listenTo(cronModel, 'change', function(){
                     this.model.inmem.set('cron_schedule', cronModel.getCronString());
                 }, this);

                 var helpLink = route.docHelp(
                    this.model.application.get("root"),
                    this.model.application.get("locale"),
                    'learnmore.alert.email'
                ); 

                this.children.flashMessages = new FlashMessagesView({
                    model: {
                        scheduledView: this.model.scheduledView,
                        content: this.model.inmem
                    }
                });

                this.children.name = new ControlGroup({
                    controlType: 'Label',
                    controlOptions: {
                        modelAttribute: 'label',
                        model: this.model.dashboard.entry.content
                    },
                    label: _('Dashboard').t()
                });

                this.children.schedule = new ControlGroup({
                    controlType: 'SyntheticCheckbox',
                    controlOptions: {
                        modelAttribute: 'is_scheduled',
                        model: this.model.inmem,
                        save: false
                    },
                    label: _("Schedule PDF").t()
                });

                this.children.scheduleSentence = new ScheduleSentence({
                    model: {
                        cron: this.model.cron,
                        application: this.model.application
                    },
                    lineOneLabel: _("Schedule").t(),
                    popdownOptions: {
                        attachDialogTo: '.modal:visible',
                        scrollContainer: '.modal:visible .modal-body:visible'
                    }
                });

                this.children.emailOptions = new EmailOptions({
                    model: {
                        state: this.model.inmem,
                        application: this.model.application
                    },
                    toLabel: _('Email To').t(),
                    suffix: 'view'
                });

                this.children.paperSize = new ControlGroup({
                    className: 'control-group',
                    controlType: 'SyntheticSelect',
                    controlOptions: {
                        modelAttribute: 'action.email.papersize',
                        model: this.model.inmem,
                        items: [
                            { label: _("A2").t(), value: 'a2' },
                            { label: _("A3").t(), value: 'a3' },
                            { label: _("A4").t(), value: 'a4' },
                            { label: _("A5").t(), value: 'a5' },
                            { label: _("Letter").t(), value: 'letter' },
                            { label: _("Legal").t(), value: 'legal' }
                        ],
                        save: false,
                        toggleClassName: 'btn',
                        popdownOptions: {
                            attachDialogTo: '.modal:visible',
                            scrollContainer: '.modal:visible .modal-body:visible'
                        }
                    },
                    label: _("Paper Size").t()
                });

                this.children.paperLayout = new ControlGroup({
                    controlType: 'SyntheticRadio',
                    controlOptions: {
                        modelAttribute: 'action.email.paperorientation',
                        model: this.model.inmem,
                        items: [
                            { label: _("Portrait").t(), value: 'portrait' },
                            { label: _("Landscape").t(), value: 'landscape' }
                        ],
                        save: false
                    },
                    label: _("Paper Layout").t()
                });

                this.children.previewLinks = new ControlWrapper({
                    body: '<div class="preview-actions">' +
                        '<div class="test-email"><a href="#" class="action-send-test">'+_("Send Test Email").t()+'</a></div> ' +
                        '<a href="#" class="action-preview">'+_("Preview PDF").t()+'</a>' +
                        '</div>'
                });

                 this.model.inmem.on('change:is_scheduled', this._toggle, this);
            },
            events: $.extend({}, Modal.prototype.events, {
                'click .action-send-test': function(e) {
                    e.preventDefault();
                    this.model.inmem.validate();
                    if(this.model.inmem.isValid()) {
                        var $status = this.$('.test-email'), flashMessages = this.children.flashMessages.flashMsgCollection;
                        $status.html(_("Sending...").t());
                        pdfUtils.sendTestEmail(
                                this.model.dashboard.entry.get('name'),
                                this.model.dashboard.entry.acl.get('app'),
                                this.model.inmem.get('action.email.to'),
                                {
                                    paperSize: this.model.inmem.get('action.email.papersize'),
                                    paperOrientation: this.model.inmem.get('action.email.paperorientation')
                                }
                        ).done(function(){
                                    $status.html('<i class="icon-check"></i> '+_("Email sent.").t());
                        }).fail(function(error){
                                    $status.html('<span class="error"><i class="icon-warning-sign"></i> '+_("Failed!").t()+'</span>');
                                    if(error) {
                                        flashMessages.add({
                                            type: 'warning',
                                            html: _("Sending the test email failed: ").t() + _.escape(error)
                                        });
                                    }
                                }).always(function(){
                                    setTimeout(function(){
                                        $status.html('<a href="#" class="action-send-test">'+_("Send Test Email").t()+'</a>');
                                    }, 5000);
                                });
                    }
                },
                'click .action-preview': function(e) {
                    e.preventDefault();
                    var orientationSuffix = '',
                        orientation = this.model.inmem.get('action.email.paperorientation'),
                        pageSize = this.model.inmem.get('action.email.papersize') || 'a2';
                    if(orientation === 'landscape') {
                        orientationSuffix = '-landscape';
                    }
                    pdfUtils.getRenderURL(
                            this.model.dashboard.entry.get('name'), this.model.dashboard.entry.acl.get('app'),{
                                'paper-size': pageSize + orientationSuffix
                            }
                    ).done(function(url){
                        window.open(url);
                    });
                },
                'click .modal-btn-primary': function(e){
                    e.preventDefault();
                    this.model.inmem.validate();
                    if(this.model.inmem.isValid()) {
                        //use == instead of === in first part of conditional to cover false and 0
                        if(this.model.inmem.get('is_scheduled') == false && this.model.scheduledView.entry.content.get('is_scheduled') === false) {
                            this.hide();
                        } else {
                            this.model.scheduledView.entry.content.set(this.model.inmem.toJSON());
                            var modal = this;
                            this.model.scheduledView.save({},{success: function(){
                                modal.hide();
                            }});
                        }
                    }
                }
            }),
            _toggle: function() {
                var action = this.model.inmem.get('is_scheduled') ? 'show' : 'hide';
                this.children.scheduleSentence.$el[action]();
                this.$emailOptions[action]();
                this.children.paperSize.$el[action]();
                this.children.paperLayout.$el[action]();
                this.children.previewLinks.$el[action]();

            },
            render: function() {
                this.$el.html(Modal.TEMPLATE);
                this.$(Modal.HEADER_TITLE_SELECTOR).html(_("Edit PDF Schedule").t());
                this.children.flashMessages.render().prependTo(this.$(Modal.BODY_SELECTOR));
                this.$(Modal.BODY_SELECTOR).append(Modal.FORM_HORIZONTAL_COMPLEX);
                this.children.name.render().appendTo(this.$(Modal.BODY_FORM_SELECTOR));
                this.children.schedule.render().appendTo(this.$(Modal.BODY_FORM_SELECTOR));

                this.children.scheduleSentence.render().appendTo(this.$(Modal.BODY_FORM_SELECTOR));
                
                this.$(Modal.BODY_FORM_SELECTOR).append('<fieldset class="email-options outline"></fieldset>');
                this.$emailOptions = this.$el.find('.email-options');
                this.children.emailOptions.render().appendTo(this.$emailOptions); 

                this.children.paperSize.render().appendTo(this.$(Modal.BODY_FORM_SELECTOR)); 
                this.children.paperLayout.render().appendTo(this.$(Modal.BODY_FORM_SELECTOR)); 
    
                this.children.previewLinks.render().appendTo(this.$(Modal.BODY_FORM_SELECTOR)); 

                this.$(Modal.FOOTER_SELECTOR).append(Modal.BUTTON_CANCEL);
                this.$(Modal.FOOTER_SELECTOR).append(Modal.BUTTON_SAVE);
                this._toggle();
                return this;
            }
        });
    }
);

define('views/dashboards/table/controls/CloneSuccess',['underscore', 'module', 'views/shared/Modal','uri/route','views/shared/documentcontrols/dialogs/permissions_dialog/Master','views/dashboards/table/controls/SchedulePDF','models/services/ScheduledView'],
        function(_, module, Modal, route, PermissionsDialog, SchedulePDF, ScheduledViewModel){

    return Modal.extend({
        moduleId: module.id,
        events: $.extend({}, Modal.prototype.events, {
            'click .edit-perms': function(e) {
                e.preventDefault();
                var model = this.model, roles = this.collection.roles;
                _.defer(function(){
                    var permissionsDialog = new PermissionsDialog({
                        model: {
                            document: model.dashboard,
                            nameModel: model.dashboard.entry.content,
                            user: model.user
                        },
                        collection: roles,
                        nameLabel:  "Dashboard",
                        nameKey: 'label',
                        onHiddenRemove: true
                    });

                    $("body").append(permissionsDialog.render().el);
                    permissionsDialog.show();
                });

                this.hide();
                this.remove();
            },
            'click .schedule-pdf': function(e) {
                e.preventDefault();
                var model = this.model;
                var createDialog = function() {
                    var schedulePDF = new SchedulePDF({
                        model: {
                            scheduledView: model.scheduledView,
                            dashboard: model.dashboard,
                            application: model.application,
                            appLocal: model.appLocal
                        },
                        onHiddenRemove: true
                    });
                    $("body").append(schedulePDF.render().el);
                    schedulePDF.show();
                };
                if(!this.model.scheduledView) {
                    var scheduledView = model.scheduledView = new ScheduledViewModel(),
                        dfd = scheduledView.findByName(this.model.dashboard.entry.get('name'), this.model.application.get('app'), this.model.application.get('owner'));
                    dfd.done(createDialog);
                } else {
                    _.defer(createDialog);
                }
                this.hide();
                this.remove();
            }
        }),
        render: function() {
            this.$el.html(Modal.TEMPLATE);
            this.$(Modal.HEADER_TITLE_SELECTOR).html(_("Dashboard has been cloned.").t());
            this.$(Modal.BODY_SELECTOR).append(Modal.FORM_HORIZONTAL);

            var link = route.page(this.model.application.get("root"), this.model.application.get("locale"),
                    this.model.dashboard.entry.acl.get("app"), this.model.dashboard.entry.get('name'));
            var canChangePerms = this.model.dashboard.entry.acl.get('can_change_perms');
            var canSchedule = this.model.user.canScheduleSearch() && !this.model.user.isFree() && (this.model.dashboard.isSimpleXML() ||
                        (this.model.dashboard.isAdvanced() && this.model.state.get('pdfgen_type') === 'deprecated'));
            this.$(Modal.BODY_FORM_SELECTOR).append(_.template(this.messageTemplate, {
                dashboardLink: link,
                canChangePerms: canChangePerms,
                canSchedule: canSchedule
            }));

            this.$(Modal.FOOTER_SELECTOR).append(_.template(this.buttonTemplate, {
                dashboardLink: link,
                _: _
            }));

            this.$(Modal.FOOTER_SELECTOR).append('');
            return this;
        },
        buttonTemplate: '<a href="<%= dashboardLink %>/edit" class="btn edit-panels"><%- _("Edit Panels").t() %></a>' +
                        '<a href="<%= dashboardLink %>" class="btn btn-primary modal-btn-primary"><%- _("View").t() %></a>',
        messageTemplate: '<p><%- _("You may now view your dashboard, change additional settings, or edit the panels.").t() %></p>' +
                        '<p><% if(canChangePerms || canSchedule){ %>' +
                                '<%- _("Additional Settings").t() %>:' +
                                '<ul>' +
                                    '<% if(canChangePerms) { %><li><a href="#" class="edit-perms"><%- _("Permissions").t() %><% } %></a></li>' +
                                    '<% if(canSchedule) { %><li><a href="#" class="schedule-pdf"><%- _("Schedule PDF Delivery").t() %><% } %></a></li>' +
                                '</ul>' +
                            '<% } %>' +
                        '</p>'
    });

});

define('views/dashboards/table/controls/CloneDashboard',[
    'underscore',
    'module',
    'views/shared/Modal',
    'views/shared/controls/ControlGroup',
    'models/Base',
    'models/search/Dashboard',
    'views/shared/FlashMessages',
    'util/splunkd_utils',
    'views/dashboards/table/controls/CloneSuccess',
    'views/shared/delegates/PairedTextControls',
    'views/shared/controls/TextControl'
],

    function (
        _,
        module,
        Modal,
        ControlGroup,
        BaseModel,
        DashboardModel,
        FlashMessagesView,
        splunkDUtils,
        CloneSuccessView,
        PairedTextControls,
        TextControl
    )
{

    return Modal.extend({
        moduleId: module.id,
        initialize: function () {
            Modal.prototype.initialize.apply(this, arguments);

            this.model.perms = new BaseModel({
                'clonePermissions': false
            });

            this.children.flashMessages = new FlashMessagesView({
                model: {
                    dashboard: this.model.dashboard,
                    dashboardMeta: this.model.dashboard.meta
                }
            });

            this.model.dashboard.meta.set({
                label: this.model.dashboard.meta.get('label') + _(' Clone').t()
            });

             this.children.titleTextControl = new TextControl({
                modelAttribute: 'label',
                model: this.model.dashboard.meta,
                placeholder: _('optional').t(),
                save: false
            });

            this.children.filenameTextControl = new TextControl({
                modelAttribute: 'name',
                model: this.model.dashboard.entry.content,
                save: false
            });
            this.children.filenameTextControl.setValue(
                splunkDUtils.nameFromString(this.model.dashboard.meta.get('label'))
            );

            this.pairedTextControls = new PairedTextControls({
                sourceDelegate: this.children.titleTextControl,
                destDelegate: this.children.filenameTextControl,
                transformFunction: splunkDUtils.nameFromString
            });

            this.children.title = new ControlGroup({
                controls: this.children.titleTextControl,
                label: _("Title").t()
            });

            this.children.filename = new ControlGroup({
                controls: this.children.filenameTextControl,
                label: _("ID").t(),
                help: _("Can only contain letters, numbers and underscores.").t(),
                tooltip: _("The ID is used as the filename on disk. Cannot be changed later.").t()
            });

            this.children.description = new ControlGroup({
                controlType: 'Textarea',
                controlOptions: {
                    modelAttribute: 'description',
                    model: this.model.dashboard.meta,
                    placeholder: _("optional").t(),
                    save: false
                },
                label: _("New Description").t()
            });

            this.children.permissions = new ControlGroup({
                controlType: 'SyntheticRadio',
                controlClass: 'controls-halfblock',
                controlOptions: {
                    className: "btn-group btn-group-2",
                    modelAttribute: 'clonePermissions',
                    model: this.model.perms,
                    items: [
                        { label: _("Private").t(), value: false },
                        { label: _("Clone").t(), value: true }
                    ],
                    save: false
                },
                label: _("Permissions").t()
            });

        },
        events: $.extend({}, Modal.prototype.events, {
            'click a.modal-btn-primary': function (e) {
                e.preventDefault();
                this.submit();
            }
        }),
        createSuccess: function() {
            if(this.collection && this.collection.dashboards) {
                this.collection.dashboards.add(this.model.dashboard);
            }

            _.defer(function(){
                var successDialog = new CloneSuccessView({
                    model: {
                        dashboard: this.model.dashboard,
                        application: this.model.application,
                        scheduledView: this.model.scheduledView, 
                        appLocal: this.model.appLocal, 
                        state: this.model.state, 
                        user: this.model.user
                    },
                    collection: this.collection
                });
                successDialog.render().show();
            }.bind(this));

            this.hide();
            this.remove();
        },
        submit: function() {
            var dashboard = this.model.dashboard;
            dashboard.meta.validate();
            if (dashboard.meta.isValid()) {
                if(dashboard.entry.content.get('eai:type') === 'views'){
                    dashboard.meta.apply();
                }
                var clonePermissions = this.model.perms.get('clonePermissions'),
                    data = {app: this.model.application.get('app')};
                data.owner = (clonePermissions && this.model.acl.get('sharing') !== splunkDUtils.USER) ?
                    splunkDUtils.NOBODY : this.model.application.get("owner");
                dashboard.save({}, {
                    data: data,
                    success: function(model, response) {
                        if (clonePermissions) {
                            var data = this.model.acl.toDataPayload();
                            data.owner = this.model.application.get('owner');
                            dashboard.acl.save({}, {
                                data: data,
                                success: function(model, response){
                                    this.createSuccess();
                                }.bind(this)
                            });
                        } else {
                            this.createSuccess();
                        }
                    }.bind(this)
                });
            }
        },
        render: function () {
            this.$el.html(Modal.TEMPLATE);
            this.$(Modal.HEADER_TITLE_SELECTOR).html(_("Clone").t());
            this.$(Modal.BODY_SELECTOR).prepend(this.children.flashMessages.render().el);
            this.$(Modal.BODY_SELECTOR).append(Modal.FORM_HORIZONTAL);

            this.$(Modal.BODY_FORM_SELECTOR).append(this.children.title.render().el);
            this.$(Modal.BODY_FORM_SELECTOR).append(this.children.filename.render().el);
            this.$(Modal.BODY_FORM_SELECTOR).append(this.children.description.render().el);

            var sharing = this.model.acl.get('sharing');
            if ((sharing===splunkDUtils.APP && this.model.dashboard.entry.acl.get("can_share_app")) ||
                (sharing===splunkDUtils.GLOBAL && this.model.dashboard.entry.acl.get("can_share_global"))) {
                this.$(Modal.BODY_FORM_SELECTOR).append(this.children.permissions.render().el);
            }

            this.$(Modal.FOOTER_SELECTOR).append(Modal.BUTTON_CANCEL);
            this.$(Modal.FOOTER_SELECTOR).append('<a href="#" class="btn btn-primary modal-btn-primary">' + _("Clone Dashboard").t() + '</a>');
            return this;
        }
    });

});

define('splunkjs/mvc/simplexml/dialog/dashboardtitle',[
    'underscore',
    'backbone',
    'module',
    'views/shared/Modal',
    'views/shared/controls/ControlGroup',
    'views/shared/FlashMessages'
    ],
    function(
        _,
        Backbone,
        module,
        Modal,
        ControlGroup,
        FlashMessage
    ) {
    return Modal.extend({
        moduleId: module.id,
        /**
        * @param {Object} options {
        *       model: <models.Report>
        * }
        */
        initialize: function(options) {
            Modal.prototype.initialize.apply(this, arguments);

            this.workingModel = this.model.clone(); 

            this.children.flashMessage = new FlashMessage({ model: this.model });

            this.children.titleField = new ControlGroup({
                controlType: 'Text',
                controlOptions: {
                    modelAttribute: 'label',
                    model: this.workingModel,
                    placeholder: _("optional").t()
                },
                label: _("Title").t()
            });

            this.children.descriptionField = new ControlGroup({
                controlType: 'Textarea',
                controlOptions: {
                    modelAttribute: 'description',
                    model: this.workingModel,
                    placeholder: _("optional").t()
                },
                label: _("Description").t()
            });

        },
        events: $.extend({}, Modal.prototype.events, {
            'click .btn-primary': function(e) {
                this.model.set('label', this.workingModel.get('label')); 
                this.model.set('description', this.workingModel.get('description')); 
                this.hide();
                e.preventDefault();
            }
        }),
        render : function() {
            this.$el.html(Modal.TEMPLATE);

            this.$(Modal.HEADER_TITLE_SELECTOR).html(_("Edit Title or Description").t());

            this.$(Modal.BODY_SELECTOR).prepend(this.children.flashMessage.render().el);

            this.$(Modal.BODY_SELECTOR).append(Modal.FORM_HORIZONTAL);

            this.$(Modal.BODY_FORM_SELECTOR).append(this.children.titleField.render().el);
            this.$(Modal.BODY_FORM_SELECTOR).append(this.children.descriptionField.render().el);

            this.$(Modal.FOOTER_SELECTOR).append(Modal.BUTTON_CANCEL);
            this.$(Modal.FOOTER_SELECTOR).append(Modal.BUTTON_SAVE);

            return this;
        }
    });
});

define('splunkjs/mvc/simplexml/editdashboard/editmenu',
    [
        'module',
        'jquery',
        'underscore',
        '../dashboardurl',
        'views/shared/PopTart',
        'views/shared/documentcontrols/dialogs/TitleDescriptionDialog',
        'views/shared/documentcontrols/dialogs/permissions_dialog/Master',
        'views/shared/documentcontrols/dialogs/DeleteDialog',
        'uri/route',
        'bootstrap.modal', 
        'models/search/Dashboard',
        'views/dashboards/table/controls/ConvertDashboard', 
        'views/dashboards/table/controls/CloneDashboard', 
        'views/dashboards/table/controls/SchedulePDF', 
        'views/shared/dialogs/TextDialog', 
        'splunk.util',  
        '../dialog/dashboardtitle', 
        'models/services/ScheduledView', 
        '../../utils',
        'models/ACLReadOnly'

    ],
    function(
        module,
        $,
        _,
        classicUrlModel,
        PopTartView,
        TitleDescriptionDialog,
        PermissionsDialog,
        DeleteDialog,
        route,
        undefined, 
        DashboardModel, 
        ConvertDialog, 
        CloneDialog, 
        SchedulePDFDialog, 
        TextDialog, 
        splunkUtils, 
        TitleDialog, 
        ScheduledViewModel, 
        utils,
        ACLReadOnlyModel
    )
    {
        return PopTartView.extend({
            moduleId: module.id,
            className: 'dropdown-menu',
            initialize: function() {
                PopTartView.prototype.initialize.apply(this, arguments);
                var defaults = {
                        button: true,
                        showOpenActions: true,
                        deleteRedirect: false
                    };

                _.defaults(this.options, defaults);
            },
            events: {
                'click a.edit-panels': function(e) {
                    e.preventDefault();
                    this.hide(); 
                    this.remove(); 
                    this.model.state.set('edit', true);
                },
                'click a.schedule-pdf': function(e){
                    e.preventDefault();
                    if ($(e.currentTarget).is('.disabled')) {
                        return;
                    }
                    this.hide(); 
                    this.remove(); 

                     var dialog = new SchedulePDFDialog({
                         model: {
                             scheduledView: this.model.scheduledView,
                             dashboard: this.model.dashboard,
                             application: this.model.application, 
                             appLocal: this.model.state.appLocal
                         },
                         onHiddenRemove: true
                     });
                     dialog.render().appendTo($('body'));
                     dialog.show();
                },
                'click a.delete': function(e){
                    e.preventDefault();
                    this.hide(); 
                    this.remove(); 
                    var dialog = new TextDialog({id: "modal-delete-dashboard"});
                    //override DialogBase dialogShown to put focus on the Delete button
                    dialog.dialogShown =  function() {
                        this.trigger("show");
                        // Apply focus to the first text input in the dialog. [JCS] Doesn't work without doing a debounce. Not sure why.
                        _.debounce(function() {
                            this.$('.btn-primary:first').focus();
                        }.bind(this), 0)();
                        return;
                    };
                    dialog.settings.set("primaryButtonLabel",_("Delete").t());
                    dialog.settings.set("cancelButtonLabel",_("Cancel").t());
                    dialog.settings.set("titleLabel",_("Delete").t());
                    dialog.setText(splunkUtils.sprintf(_("Are you sure you want to delete %s?").t(), 
                        '<em>' + _.escape(this.model.state.get('label') !== "" ? this.model.state.get('label') : this.model.dashboard.entry.get('name')) + '</em>'));
                    dialog.render().appendTo(document.body);

                    dialog.once('click:primaryButton', function(){
                        this.model.dashboard.destroy().done(function(){
                            var cur = utils.getPageInfo();
                            utils.redirect(route.page(cur.root, cur.locale, cur.app, 'dashboards'));
                        });
                    }, this);

                    dialog.on("hidden", function(){
                        dialog.remove();
                    }, this);

                    dialog.show();
                },
                'click a.edit-title-desc': function(e){
                    e.preventDefault();
                    this.hide(); 
                    this.remove(); 
                    this.children.titleDialog = new TitleDialog({
                        model: this.model.state,
                        onHiddenRemove: true
                    });
                    $("body").append(this.children.titleDialog.render().el);
                    this.children.titleDialog.show();
                },
                'click a.edit-perms': function(e) {
                    e.preventDefault();
                    this.hide(); 
                    this.remove(); 
                    this.children.permissionsDialog = new PermissionsDialog({
                        model: {
                            document: this.model.dashboard,
                            nameModel: this.model.dashboard.entry.content,
                            user: this.model.state.user
                        },
                        collection: this.collection,
                        nameLabel:  "Dashboard",
                        nameKey: 'label',
                        onHiddenRemove: true
                    });
                    $("body").append(this.children.permissionsDialog.render().el);
                    this.children.permissionsDialog.show();
                },
                'click a.convert-to-html': function(e) {
                    e.preventDefault();
                    this.hide(); 
                    this.remove(); 
                    var dashboard = new DashboardModel();
                    dashboard.meta.set(this.model.dashboard.meta.toJSON());

                    var convertDialog = this.children.convertDialog = new ConvertDialog({
                        model: {
                            dashboard: dashboard, 
                            currentDashboard: this.model.dashboard,
                            application: this.model.application,
                            user: this.model.state.user
                        },
                        collection: {
                            roles: this.collection 
                        },
                        onHiddenRemove: true

                    });

                    $("body").append(convertDialog.render().el);
                    convertDialog.show();
                },
                'click a.clone': function(e) {
                    e.preventDefault();
                    this.hide();
                    this.remove();
                    var clone = new DashboardModel();
                    clone.fetch({
                        success: function() {
                            if(this.model.dashboard.entry.content.get('eai:type') === 'html'){
                                clone.setHTML(this.model.dashboard.entry.content.get('eai:data'));
                            }else{
                                clone.setXML(this.model.dashboard.entry.content.get('eai:data'));
                            }
                            clone.meta.set(this.model.dashboard.meta.toJSON());

                            var cloneDialog  = this.children.cloneDialog = new CloneDialog({
                                model: {
                                    dashboard: clone,
                                    acl: new ACLReadOnlyModel($.extend(true, {}, this.model.dashboard.entry.acl.toJSON())),
                                    application: this.model.application,
                                    appLocal: this.model.state.appLocal,
                                    state: this.model.state,
                                    user: this.model.state.user
                                },
                                collection: {
                                    roles: this.collection
                                },
                                onHiddenRemove: true
                            });
                            $("body").append(cloneDialog.render().el);
                            cloneDialog.show();
                        }.bind(this)
                    });
                }
            },
            render: function() {
                var app = this.model.application.toJSON();
                var renderModel = {
                    dashboard: this.model.dashboard.isDashboard(),
                    editLinkViewMode: route.manager(app.root, app.locale, app.app, ['data','ui','views', app.page], {
                        data: {
                            action: 'edit',
                            ns: app.app,
                            redirect_override: route.page(app.root, app.locale, app.app, app.page)
                        }
                    }),
                    editLinkEditMode: route.manager(app.root, app.locale, app.app, ['data','ui','views', app.page], {
                        data: {
                            action: 'edit',
                            ns: app.app,
                            redirect_override: route.page(app.root, app.locale, app.app, app.page) + '/edit'
                        }
                    }),
                    dashboardType: this.model.dashboard.getViewType(),
                    editable: this.model.state.get('editable'),
                    canWrite: this.model.dashboard.entry.acl.canWrite(),
                    canCangePerms: this.model.dashboard.entry.acl.get('can_change_perms'),
                    canEditHtml: this.model.state.user.canEditViewHtml(),
                    removable: this.model.dashboard.entry.acl.get('removable'),
                    isXML: this.model.dashboard.isXML(),
                    isForm: this.model.dashboard.isForm(),
                    isSimpleXML: this.model.dashboard.isSimpleXML(),
                    isHTML: this.model.dashboard.isHTML(),
                    canSchedulePDF: this.model.state.user.canScheduleSearch() && !this.model.state.user.isFree() && (this.model.dashboard.isSimpleXML() ||
                        (this.model.dashboard.isAdvanced() && this.model.state.get('pdfgen_type') === 'deprecated')),
                    isPdfServiceAvailable: this.model.state.get('pdf_available'),
                    showAddTRP: !this.model.state.get('default_timerange'),
                    _: _
                };

                var html = this.compiledTemplate(renderModel);
                this.$el.html(PopTartView.prototype.template_menu);
                this.$el.append(html);

                return this;
            },
            template: '\
                <% if (canWrite && (editable || (!isHTML || canEditHtml) || (isSimpleXML && canEditHtml))) { %>\
                    <ul class="first-group">\
                        <% if(editable) { %>\
                        <li><a href="#" class="edit-panels"><%- _("Edit Panels").t() %></a></li>\
                        <% } %>\
                        <% if (!isHTML || canEditHtml) { %>\
                        <li><a href="<%- editLinkViewMode %>" class="edit-source"><%- _("Edit Source").t() %> <span class="dashboard-source-type"><%= dashboardType %></span></a></li>\
                        <% } %>\
                        <% if (isSimpleXML && canEditHtml) { %>\
                        <li><a href="#" class="convert-to-html"><%- _("Convert to HTML").t() %></a></li>\
                        <% } %>\
                    </ul>\
                    <% } %>\
                    <% if(canCangePerms || (canWrite && isXML) || canSchedulePDF) { %>\
                    <ul class="second-group">\
                        <% if(isXML && canWrite) { %>\
                        <li><a href="#" class="edit-title-desc"><%- _("Edit Title or Description").t() %></a></li>\
                        <% } %>\
                        <% if(canCangePerms) { %>\
                            <li><a href="#" class="edit-perms"><%- _("Edit Permissions").t() %></a></li>\
                        <% } %>\
                        <% if(canSchedulePDF) { %>\
                        <li>\
                        <% if(isForm) {%>\
                            <a class="schedule-pdf disabled" href="#" title="<%- _("You cannot schedule PDF delivery for a dashboard with form elements.").t() %>">\
                        <% } else { %>\
                            <a class="schedule-pdf" href="#">\
                        <% } %>\
                                <%- _("Schedule PDF Delivery").t() %>\
                            </a>\
                        </li>\
                        <% } %>\
                    </ul>\
                    <% } %>\
                    <% if ((!isHTML || canEditHtml) || (canWrite && removable)) { %>\
                    <ul class="third-group">\
                        <% if (!isHTML || canEditHtml) { %>\
                        <li><a href="#" class="clone"><%- _("Clone").t() %></a></li>\
                        <% } %>\
                        <% if(canWrite && removable) { %>\
                        <li><a href="#" class="delete"><%- _("Delete").t() %></a></li>\
                        <% } %>\
                    </ul>\
                <% } %>\
            '
        });
    }
);






define('splunkjs/mvc/simplexml/editdashboard/moreinfomenu',
    [
        'module',
        'jquery',
        'underscore',
        '../dashboardurl',
        'views/shared/PopTart',
        'views/shared/documentcontrols/dialogs/TitleDescriptionDialog',
        'views/shared/documentcontrols/dialogs/permissions_dialog/Master',
        'views/shared/documentcontrols/dialogs/DeleteDialog',
        'uri/route',
        'bootstrap.modal',
        'util/splunkd_utils',
        'views/dashboards/table/controls/SchedulePDF',
        'models/services/ScheduledView',
        'models/shared/Cron'
    ],
    function(
        module,
        $,
        _,
        classicUrlModel,
        PopTartView,
        TitleDescriptionDialog,
        PermissionsDialog,
        DeleteDialog,
        route,
        undefined,
        splunkDUtils,
        SchedulePDF,
        ScheduledViewModel,
        Cron
    )
    {
        return PopTartView.extend({
            moduleId: module.id,
            className: 'dropdown-menu more-info popdown-dialog',
            initialize: function() {
                PopTartView.prototype.initialize.apply(this, arguments);
                var defaults = {
                        button: true,
                        showOpenActions: true,
                        deleteRedirect: false
                    };

                _.defaults(this.options, defaults);
            },
            events: {
                'click .edit-schedule': function (e) {
                        e.preventDefault();
                        this.hide();
                        this.remove();
                        this.children.schedulePDF = new SchedulePDF({
                            model: {
                                scheduledView: this.model.scheduledView,
                                dashboard: this.model.dashboard,
                                application: this.model.application,
                                appLocal: this.model.state.appLocal
                            },
                            onHiddenRemove: true
                        });
                        $("body").append(this.children.schedulePDF.render().el);
                        this.children.schedulePDF.show();

                },
                'click a.edit-permissions': function(e) {
                    e.preventDefault();
                    this.hide();
                    this.remove();
                    this.children.permissionsDialog = new PermissionsDialog({
                        model: {
                            document: this.model.dashboard,
                            nameModel: this.model.dashboard.entry.content,
                            user: this.model.state.user
                        },
                        collection: this.collection,
                        nameLabel:  "Dashboard",
                        nameKey: 'label',
                        onHiddenRemove: true
                    });

                    $("body").append(this.children.permissionsDialog.render().el);
                    this.children.permissionsDialog.show();
                }
            },
            render: function() {
                var isScheduled = this.model.scheduledView.entry.content.get('is_scheduled'), schedule = '-', recipients = [],
                    sharing = this.model.dashboard.entry.acl.get("sharing"),
                    owner = this.model.dashboard.entry.acl.get("owner"),
                    permissionString = splunkDUtils.getPermissionLabel(sharing, owner),
                    appString = this.model.dashboard.entry.acl.get('app');
                    if (isScheduled) {
                        var expr = this.model.scheduledView.entry.content.get('cron_schedule'), cron = expr ? Cron.createFromCronString(expr) : null;
                        if(cron) {
                            switch (cron.get('cronType')) {
                                case 'hourly':
                                    schedule = _("Sent Hourly").t();
                                    break;
                                case 'daily':
                                    schedule = _("Sent Daily").t();
                                    break;
                                case 'weekly':
                                    schedule = _("Sent Weekly").t();
                                    break;
                                case 'monthly':
                                    schedule = _("Sent Monthly").t();
                                    break;
                                case 'custom':
                                    schedule = _("Sent on a custom schedule").t();
                                    break;
                            }
                        }
                        recipients = (this.model.scheduledView.entry.content.get('action.email.to')||'').split(/\s*,\s*/);
                    }
                var renderModel = {
                    _:_,
                    isScheduled: isScheduled,
                    schedule: schedule,
                    recipients: _(recipients).chain().filter(_.identity).map(function(recipient){
                        return ['<a href="mailto:',encodeURIComponent(recipient),'">',_.escape(recipient),'</a>'].join('');
                    }).value(),
                    shared: this.model.dashboard.entry.acl.get("perms"),
                    owner: owner,
                    permissionString: permissionString,
                    canChangePerms: this.model.dashboard.entry.acl.get('can_change_perms'),
                    canScheduleXML: ((this.model.dashboard.isSimpleXML() && !this.model.dashboard.isForm()) ||
                        (this.model.dashboard.isAdvanced() && this.model.state.get('pdfgen_type') === 'deprecated')),
                    canScheduleUser: this.model.state.user.canScheduleSearch() && !this.model.state.user.isFree(),
                    isPdfServiceAvailable: this.model.state.get('pdf_available'),
                    appString: appString
                };

                var html = this.compiledTemplate(renderModel);
                this.$el.html(PopTartView.prototype.template_menu);
                this.$el.append(html);

                return this;
            },
            template: '\
                <div class="popdown-dialog-body">\
                    <div>\
                        <dl class="list-dotted">\
                            <dt class="app"><%- _("App").t() %></dt>\
                            <dd>\
                                <%= appString %>\
                            </dd>\
                            <% if(canScheduleXML) { %>\
                                <dt class="schedule"><%- _("Schedule").t() %></dt>\
                                <dd>\
                                    <% if(isScheduled) { %>\
                                        <%= schedule %> <%- _("to").t() %> \
                                        <%= recipients.join(", ") %>.\
                                    <% } else { %>\
                                        <%- _("Not scheduled").t() %>.\
                                    <% } %> \
                                    <% if(canScheduleUser && isPdfServiceAvailable) { %>\
                                        <a href="#" class="edit-schedule"><%- _("Edit").t() %></a>\
                                    <% } %> \
                                </dd>\
                            <% } %> \
                            <dt class="permissions"><%- _("Permissions").t() %></dt>\
                            <dd class="edit-permissions">\
                                <%- _(permissionString).t() %>\
                                <% if(canChangePerms) { %>\
                                    <a href="#" class="edit-permissions"><%- _("Edit").t() %></a>\
                                <% } %> \
                        </dl>\
                    </div>\
                </div>\
            '
        });
    }
);

define('splunkjs/mvc/simpleform/inputsettings',['require','underscore','jquery','../settings','../simplexml/controller'],function(require) {
    var _ = require('underscore');
    var $ = require('jquery');
    var Settings = require('../settings');
    var DashboardController = require('../simplexml/controller');

    var InputSettings = Settings.extend({
        validation: {
            'token': {
                fn: 'validateToken'
            },
            'labelField': {
                fn: 'validateLabelAndValueFields'
            },
            'valueField': {
                fn: 'validateLabelAndValueFields'
            },
            'choices': {
                fn: 'validateChoices'
            }
        },
        validateToken: function(val, attr){
            if (!val && this.get('type') !== 'time') {
                return _('Token is required').t();
            }
        },
        validateLabelAndValueFields: function(val, attr, options){
            var type = (this.get('type') !== 'time' && this.get('type') !== 'text'),
                isEmpty;

            if (options.searchType == 'inline') {
                isEmpty = !options.search;
            } else {
                isEmpty = false;
            }

            if (type && !val && !isEmpty) {
                return _('Field For Label and Value are required for search').t();
            }
        },
        validateChoices: function(val, attr, options) {
            var type = (this.get('type') !== 'time' && this.get('type') !== 'text');

            if (type && options.choices.length > 0) {
                var isMissingName = false;
                var hasDupes = false;
                var dupesMap = {};

                _.each(options.choices, function(choice) {
                    if (choice.value) {
                        if (!choice.label) {
                            isMissingName = true;
                        }
                        if (_.has(dupesMap, choice.value)) {
                            hasDupes = true;
                        }
                        dupesMap[choice.value] = true;
                    }
                });

                if (isMissingName) {
                    return _('Static option values must have a name attributed to them').t();
                } else if (hasDupes) {
                    return _('Static option values must be unique').t();
                }
            }
        },
        save: function(key, val, options) {
            // pulled from backbone
            var attrs, method, xhr, attributes = this.attributes;

            // Handle both `"key", value` and `{key: value}` -style arguments.
            if (key == null || typeof key === 'object') {
              attrs = key;
              options = val;
            } else {
              (attrs = {})[key] = val;
            }

            options = _.extend({validate: true}, options);

            // If we're not waiting and attributes exist, save acts as
            // `set(attr).save(null, opts)` with validation. Otherwise, check if
            // the model will be valid when the attributes, if any, are set.
            if (attrs && !options.wait) {
              if (!this.set(attrs, options)) return false;
            } else {
              if (!this._validate(attrs, options)) return false;
            }

            // save the xml
            return DashboardController.model.view.updateInput(this);
        },
        destroy: function(){
            var dfd = $.Deferred();
            var that = this;
            DashboardController.model.view.deleteInput(that.get('id')).done(function(){
                dfd.resolve();
                that.trigger('removeInput');
            }).fail(function(err){
                dfd.reject(err);
            });
            return dfd.promise();
        }
    });

    return InputSettings;
});

/**
 *   views/shared/delegates/concertina
 *
 *   Desc:
 *     This class applies concertina behaviors.
 *     Default markup is based on Twitter Bootstrap's Collapse
 *     http://twitter.github.com/bootstrap/
 *
 *     @param {Object} (Optional) options An optional object literal having one or more settings.
 *
 *    Usage:
 *       var p = new Concertina({options})
 *
 *    Options:
 *        el (required): The event delegate.
 *        group: jQuery selector for the toggle and body wrapper ".concertina-group".
 *        toggle: jQuery selector for the concertina group's toggle. Defaults to ".concertina-toggle".
 *        body: jQuery selector for the concertina group's body. Defaults to ".concertina-body".
 *        default: jQuery selector or object for the default group. Defaults to ".concertina-group:first-child".
 *
 *    Methods:
 *        show: show a panel. Parameters are the group, which can be a selector or jQuery object, and a boolean to enable or disable animation.
 */


define('views/shared/delegates/Concertina',[
    'jquery',
    'underscore',
    'views/shared/delegates/Base'
],function(
    $,
    _,
    DelegateBase
){
    return DelegateBase.extend({
        initialize: function(){
            var defaults = {
                body: ".concertina-body",
                group: ".concertina-group",
                heading: ".concertina-heading",
                toggle: ".concertina-toggle",
                groupBody: ".concertina-group-body",
                dockTop: ".concertina-dock-top",
                dockBottom: ".concertina-dock-bottom",
                icon: ".icon-concertina-toggle",
                activeClass: "active",
                speedMin: 100,
                speedMax: 300,
                speedMinDistance: 200,
                speedMaxDistance: 800,
                easing: 'swing'
            };

            _.defaults(this.options, defaults);
            
            this.events= {};
            this.events['click ' + this.options.body + ' ' + this.options.toggle] = 'clickToggle';
            this.events['click '  + this.options.dockTop + ' ' + this.options.toggle] = 'clickToggleTop';
            this.events['click ' + this.options.dockBottom + ' ' + this.options.toggle] = 'clickToggleBottom';
            _.defer(this.delegateEvents.bind(this), this.events);
            
            this.measurements = {};
            this.elements = {};
            
            this.reset();
            $(window).on('resize.' + this.cid, this.reset.bind(this));
            
        },
        clickToggleTop: function(e) {
            e.preventDefault();
            
            var $el = $(e.currentTarget),
                $original = $el.parent().data('original'),
                topMargin = $el.parent().position().top,
                scrollFrom = this.elements.$body.scrollTop(),
                scrollTo = $original.position().top - topMargin + scrollFrom;
            
            this.elements.$body.animate({'scrollTop': scrollTo}, this.adjustSpeed(scrollFrom, scrollTo), this.options.easing);
        },
        clickToggle: function(e) {
            e.preventDefault();
            this.scrollUp($(e.currentTarget).closest(this.options.group), this.elements.$bottomDock.outerHeight());  
        },
        clickToggleBottom: function(e) {
            e.preventDefault();
            
            var $el = $(e.currentTarget),
                $group = $(e.currentTarget).parent().data('original').closest(this.options.group);
             
            this.scrollUp($group, $group.nextAll().length * $el.outerHeight());
        },
        scrollUp: function($group, bottomMargin) {            
            var concertinaHeight = this.elements.$body.height(),
                scrollFrom = this.elements.$body.scrollTop(),
                scrollTo = $group.height() + ($group.position().top + scrollFrom) - concertinaHeight + bottomMargin,
                topMargin = $group.prevAll().length * ($group.find(this.options.toggle).outerHeight() -1),
                groupTop = $group.position().top;
            
            //if it's already in view, don't do anything
            if (scrollFrom > scrollTo) {
                return;
            }
            
            //ensure there is enough room to scrollUp
            if (groupTop + scrollFrom  < scrollTo + topMargin) {
                scrollTo = scrollFrom + groupTop - topMargin;
            }
             
            this.elements.$body.animate({'scrollTop': scrollTo}, this.adjustSpeed(scrollFrom, scrollTo), this.options.easing);       
        },
        adjustSpeed: function(from, to) {
            //Map the distance to the min/max speed based on the min/max distance
            var distance = Math.abs(from - to),       
                speed = (distance-this.options.speedMinDistance)/(this.options.speedMaxDistance-this.options.speedMinDistance) * (this.options.speedMax-this.options.speedMin) + this.options.speedMin;
            return Math.min(Math.max(speed, this.options.speedMin), this.options.speedMax);
        },
        reset: function() {            
            this.elements.$body = this.$(this.options.body);
            this.elements.$body.off('scroll.' + this.cid);
            this.elements.$body.on('scroll.' + this.cid, this.updateDocking.bind(this));
        
            this.elements.$headings = this.elements.$body.find(this.options.heading);
            this.measurements.scrollBarWidth = this.elements.$body.parent().width() - this.elements.$headings.first().width();
            this.elements.$topDock = this.$(this.options.dockTop).css('right', this.measurements.scrollBarWidth + 'px').html('');
            this.elements.$bottomDock = this.$(this.options.dockBottom).css('right', this.measurements.scrollBarWidth + 'px').html('');
            this.measurements.containerHeight = this.$el.height();
            
            this.updateDocking();
        },
        updateDocking: function() {
            this.elements.$topDock.html('');
            this.elements.$bottomDock.html('');
        
            //Top Dock
            this.elements.$headings.each(function(index, element) {
                var $el = $(element);
                if ($el.position().top < this.elements.$topDock.height()) {
                    $el.clone().appendTo(this.elements.$topDock).data('original', $el);
                }
            }.bind(this));
            
            //Bottom Dock
            $(this.elements.$headings.get().reverse()).each(function(index, element) {
                var $el = $(element);
                if ($el.position().top + $el.height() > this.measurements.containerHeight - this.elements.$bottomDock.height()) {
                    $el.clone().prependTo(this.elements.$bottomDock).data('original', $el);
                }
            }.bind(this));
        },
        remove: function() {
            DelegateBase.prototype.remove.apply(this);
            $(window).off('resize.' + this.cid);
            this.elements.$body && this.elements.$body.off('scroll.' + this.cid);
            return this;
        }
    });
});
define('splunkjs/mvc/simpleform/edit/concertinasettingseditor',['require','exports','module','underscore','jquery','util/console','../../../mvc','views/Base','views/shared/delegates/Concertina','views/shared/controls/ControlGroup'],function(require, exports, module) {

    var _ = require('underscore');
    var $ = require('jquery');
    var console = require('util/console');
    var mvc = require('../../../mvc');
    var Base = require('views/Base');
    var Concertina = require('views/shared/delegates/Concertina');
    var ControlGroup = require('views/shared/controls/ControlGroup');

    return Base.extend({

        moduleId: module.id,

        className: 'concertina',

        initialize: function() {
            Base.prototype.initialize.apply(this, arguments);
        },

        render: function() {
            if (!this.children.concertina) {
                this.$el.html(this.template);
                this.children.concertina = new Concertina({ el: this.el });

                _(this.options.panels || []).each(function(panelOptions, i) {
                    this.renderPanel(panelOptions);
                }, this);
            }

            return this;
        },

        renderPanel: function(panelOptions) {
            var $panel = $(_.template(this.templatePanel, panelOptions));
            var $panelBody = $panel.find(".concertina-group-body");

            _(panelOptions.controls || []).each(function(controlOptions, i) {
               controlOptions.controlOptions.model = this.model;
               var controlTypeClass = controlOptions.controlTypeClass || ControlGroup;
               var control = this.children[_.unique("control_")] = new controlTypeClass(controlOptions);
               $panelBody.append(control.render().$el);
            }, this);

            this.$(".concertina-body").append($panel);
        },

        activate: function(){
            if (this.children.concertina) {
                this.children.concertina.reset();
            }
        },

        template: '\
            <div class="concertina-dock-top"></div>\
            <div class="concertina-body"></div>\
            <div class="concertina-dock-bottom"></div>\
        ',

        templatePanel: '\
            <div class="concertina-group">\
            <div class="concertina-heading <%- headingClassName || \'\' %>">\
                <a href="#" class="concertina-toggle">\
                    <%- title %>\
                </a>\
            </div>\
            <div class="concertina-group-body panel-body <%- headingClassName ? (headingClassName + \'-body\') : \'\' %>">\
            </div>\
            </div>\
        '

    });

});

/*!
 * jQuery UI Droppable 1.10.3
 * http://jqueryui.com
 *
 * Copyright 2013 jQuery Foundation and other contributors
 * Released under the MIT license.
 * http://jquery.org/license
 *
 * http://api.jqueryui.com/droppable/
 *
 * Depends:
 *	jquery.ui.core.js
 *	jquery.ui.widget.js
 *	jquery.ui.mouse.js
 *	jquery.ui.draggable.js
 */
(function( $, undefined ) {

function isOverAxis( x, reference, size ) {
	return ( x > reference ) && ( x < ( reference + size ) );
}

$.widget("ui.droppable", {
	version: "1.10.3",
	widgetEventPrefix: "drop",
	options: {
		accept: "*",
		activeClass: false,
		addClasses: true,
		greedy: false,
		hoverClass: false,
		scope: "default",
		tolerance: "intersect",

		// callbacks
		activate: null,
		deactivate: null,
		drop: null,
		out: null,
		over: null
	},
	_create: function() {

		var o = this.options,
			accept = o.accept;

		this.isover = false;
		this.isout = true;

		this.accept = $.isFunction(accept) ? accept : function(d) {
			return d.is(accept);
		};

		//Store the droppable's proportions
		this.proportions = { width: this.element[0].offsetWidth, height: this.element[0].offsetHeight };

		// Add the reference and positions to the manager
		$.ui.ddmanager.droppables[o.scope] = $.ui.ddmanager.droppables[o.scope] || [];
		$.ui.ddmanager.droppables[o.scope].push(this);

		(o.addClasses && this.element.addClass("ui-droppable"));

	},

	_destroy: function() {
		var i = 0,
			drop = $.ui.ddmanager.droppables[this.options.scope];

		for ( ; i < drop.length; i++ ) {
			if ( drop[i] === this ) {
				drop.splice(i, 1);
			}
		}

		this.element.removeClass("ui-droppable ui-droppable-disabled");
	},

	_setOption: function(key, value) {

		if(key === "accept") {
			this.accept = $.isFunction(value) ? value : function(d) {
				return d.is(value);
			};
		}
		$.Widget.prototype._setOption.apply(this, arguments);
	},

	_activate: function(event) {
		var draggable = $.ui.ddmanager.current;
		if(this.options.activeClass) {
			this.element.addClass(this.options.activeClass);
		}
		if(draggable){
			this._trigger("activate", event, this.ui(draggable));
		}
	},

	_deactivate: function(event) {
		var draggable = $.ui.ddmanager.current;
		if(this.options.activeClass) {
			this.element.removeClass(this.options.activeClass);
		}
		if(draggable){
			this._trigger("deactivate", event, this.ui(draggable));
		}
	},

	_over: function(event) {

		var draggable = $.ui.ddmanager.current;

		// Bail if draggable and droppable are same element
		if (!draggable || (draggable.currentItem || draggable.element)[0] === this.element[0]) {
			return;
		}

		if (this.accept.call(this.element[0],(draggable.currentItem || draggable.element))) {
			if(this.options.hoverClass) {
				this.element.addClass(this.options.hoverClass);
			}
			this._trigger("over", event, this.ui(draggable));
		}

	},

	_out: function(event) {

		var draggable = $.ui.ddmanager.current;

		// Bail if draggable and droppable are same element
		if (!draggable || (draggable.currentItem || draggable.element)[0] === this.element[0]) {
			return;
		}

		if (this.accept.call(this.element[0],(draggable.currentItem || draggable.element))) {
			if(this.options.hoverClass) {
				this.element.removeClass(this.options.hoverClass);
			}
			this._trigger("out", event, this.ui(draggable));
		}

	},

	_drop: function(event,custom) {

		var draggable = custom || $.ui.ddmanager.current,
			childrenIntersection = false;

		// Bail if draggable and droppable are same element
		if (!draggable || (draggable.currentItem || draggable.element)[0] === this.element[0]) {
			return false;
		}

		this.element.find(":data(ui-droppable)").not(".ui-draggable-dragging").each(function() {
			var inst = $.data(this, "ui-droppable");
			if(
				inst.options.greedy &&
				!inst.options.disabled &&
				inst.options.scope === draggable.options.scope &&
				inst.accept.call(inst.element[0], (draggable.currentItem || draggable.element)) &&
				$.ui.intersect(draggable, $.extend(inst, { offset: inst.element.offset() }), inst.options.tolerance)
			) { childrenIntersection = true; return false; }
		});
		if(childrenIntersection) {
			return false;
		}

		if(this.accept.call(this.element[0],(draggable.currentItem || draggable.element))) {
			if(this.options.activeClass) {
				this.element.removeClass(this.options.activeClass);
			}
			if(this.options.hoverClass) {
				this.element.removeClass(this.options.hoverClass);
			}
			this._trigger("drop", event, this.ui(draggable));
			return this.element;
		}

		return false;

	},

	ui: function(c) {
		return {
			draggable: (c.currentItem || c.element),
			helper: c.helper,
			position: c.position,
			offset: c.positionAbs
		};
	}

});

$.ui.intersect = function(draggable, droppable, toleranceMode) {

	if (!droppable.offset) {
		return false;
	}

	var draggableLeft, draggableTop,
		x1 = (draggable.positionAbs || draggable.position.absolute).left, x2 = x1 + draggable.helperProportions.width,
		y1 = (draggable.positionAbs || draggable.position.absolute).top, y2 = y1 + draggable.helperProportions.height,
		l = droppable.offset.left, r = l + droppable.proportions.width,
		t = droppable.offset.top, b = t + droppable.proportions.height;

	switch (toleranceMode) {
		case "fit":
			return (l <= x1 && x2 <= r && t <= y1 && y2 <= b);
		case "intersect":
			return (l < x1 + (draggable.helperProportions.width / 2) && // Right Half
				x2 - (draggable.helperProportions.width / 2) < r && // Left Half
				t < y1 + (draggable.helperProportions.height / 2) && // Bottom Half
				y2 - (draggable.helperProportions.height / 2) < b ); // Top Half
		case "pointer":
			draggableLeft = ((draggable.positionAbs || draggable.position.absolute).left + (draggable.clickOffset || draggable.offset.click).left);
			draggableTop = ((draggable.positionAbs || draggable.position.absolute).top + (draggable.clickOffset || draggable.offset.click).top);
			return isOverAxis( draggableTop, t, droppable.proportions.height ) && isOverAxis( draggableLeft, l, droppable.proportions.width );
		case "touch":
			return (
				(y1 >= t && y1 <= b) ||	// Top edge touching
				(y2 >= t && y2 <= b) ||	// Bottom edge touching
				(y1 < t && y2 > b)		// Surrounded vertically
			) && (
				(x1 >= l && x1 <= r) ||	// Left edge touching
				(x2 >= l && x2 <= r) ||	// Right edge touching
				(x1 < l && x2 > r)		// Surrounded horizontally
			);
		default:
			return false;
		}

};

/*
	This manager tracks offsets of draggables and droppables
*/
$.ui.ddmanager = {
	current: null,
	droppables: { "default": [] },
	prepareOffsets: function(t, event) {

		var i, j,
			m = $.ui.ddmanager.droppables[t.options.scope] || [],
			type = event ? event.type : null, // workaround for #2317
			list = (t.currentItem || t.element).find(":data(ui-droppable)").addBack();

		droppablesLoop: for (i = 0; i < m.length; i++) {

			//No disabled and non-accepted
			if(m[i].options.disabled || (t && !m[i].accept.call(m[i].element[0],(t.currentItem || t.element)))) {
				continue;
			}

			// Filter out elements in the current dragged item
			for (j=0; j < list.length; j++) {
				if(list[j] === m[i].element[0]) {
					m[i].proportions.height = 0;
					continue droppablesLoop;
				}
			}

			m[i].visible = m[i].element.css("display") !== "none";
			if(!m[i].visible) {
				continue;
			}

			//Activate the droppable if used directly from draggables
			if(type === "mousedown") {
				m[i]._activate.call(m[i], event);
			}

			m[i].offset = m[i].element.offset();
			m[i].proportions = { width: m[i].element[0].offsetWidth, height: m[i].element[0].offsetHeight };

		}

	},
	drop: function(draggable, event) {

		var dropped = false;
		// Create a copy of the droppables in case the list changes during the drop (#9116)
		$.each(($.ui.ddmanager.droppables[draggable.options.scope] || []).slice(), function() {

			if(!this.options) {
				return;
			}
			if (!this.options.disabled && this.visible && $.ui.intersect(draggable, this, this.options.tolerance)) {
				dropped = this._drop.call(this, event) || dropped;
			}

			if (!this.options.disabled && this.visible && this.accept.call(this.element[0],(draggable.currentItem || draggable.element))) {
				this.isout = true;
				this.isover = false;
				this._deactivate.call(this, event);
			}

		});
		return dropped;

	},
	dragStart: function( draggable, event ) {
		//Listen for scrolling so that if the dragging causes scrolling the position of the droppables can be recalculated (see #5003)
		draggable.element.parentsUntil( "body" ).bind( "scroll.droppable", function() {
			if( !draggable.options.refreshPositions ) {
				$.ui.ddmanager.prepareOffsets( draggable, event );
			}
		});
	},
	drag: function(draggable, event) {

		//If you have a highly dynamic page, you might try this option. It renders positions every time you move the mouse.
		if(draggable.options.refreshPositions) {
			$.ui.ddmanager.prepareOffsets(draggable, event);
		}

		//Run through all droppables and check their positions based on specific tolerance options
		$.each($.ui.ddmanager.droppables[draggable.options.scope] || [], function() {

			if(this.options.disabled || this.greedyChild || !this.visible) {
				return;
			}

			var parentInstance, scope, parent,
				intersects = $.ui.intersect(draggable, this, this.options.tolerance),
				c = !intersects && this.isover ? "isout" : (intersects && !this.isover ? "isover" : null);
			if(!c) {
				return;
			}

			if (this.options.greedy) {
				// find droppable parents with same scope
				scope = this.options.scope;
				parent = this.element.parents(":data(ui-droppable)").filter(function () {
					return $.data(this, "ui-droppable").options.scope === scope;
				});

				if (parent.length) {
					parentInstance = $.data(parent[0], "ui-droppable");
					parentInstance.greedyChild = (c === "isover");
				}
			}

			// we just moved into a greedy child
			if (parentInstance && c === "isover") {
				parentInstance.isover = false;
				parentInstance.isout = true;
				parentInstance._out.call(parentInstance, event);
			}

			this[c] = true;
			this[c === "isout" ? "isover" : "isout"] = false;
			this[c === "isover" ? "_over" : "_out"].call(this, event);

			// we just moved out of a greedy child
			if (parentInstance && c === "isout") {
				parentInstance.isout = false;
				parentInstance.isover = true;
				parentInstance._over.call(parentInstance, event);
			}
		});

	},
	dragStop: function( draggable, event ) {
		draggable.element.parentsUntil( "body" ).unbind( "scroll.droppable" );
		//Call prepareOffsets one final time since IE does not fire return scroll events when overflow was caused by drag (see #5003)
		if( !draggable.options.refreshPositions ) {
			$.ui.ddmanager.prepareOffsets( draggable, event );
		}
	}
};

})(jQuery);

define("jquery.ui.droppable", ["jquery.ui.widget","jquery.ui.mouse"], function(){});

/*!
 * jQuery UI Sortable 1.10.3
 * http://jqueryui.com
 *
 * Copyright 2013 jQuery Foundation and other contributors
 * Released under the MIT license.
 * http://jquery.org/license
 *
 * http://api.jqueryui.com/sortable/
 *
 * Depends:
 *	jquery.ui.core.js
 *	jquery.ui.mouse.js
 *	jquery.ui.widget.js
 */
(function( $, undefined ) {

/*jshint loopfunc: true */

function isOverAxis( x, reference, size ) {
	return ( x > reference ) && ( x < ( reference + size ) );
}

function isFloating(item) {
	return (/left|right/).test(item.css("float")) || (/inline|table-cell/).test(item.css("display"));
}

$.widget("ui.sortable", $.ui.mouse, {
	version: "1.10.3",
	widgetEventPrefix: "sort",
	ready: false,
	options: {
		appendTo: "parent",
		axis: false,
		connectWith: false,
		containment: false,
		cursor: "auto",
		cursorAt: false,
		dropOnEmpty: true,
		forcePlaceholderSize: false,
		forceHelperSize: false,
		grid: false,
		handle: false,
		helper: "original",
		items: "> *",
		opacity: false,
		placeholder: false,
		revert: false,
		scroll: true,
		scrollSensitivity: 20,
		scrollSpeed: 20,
		scope: "default",
		tolerance: "intersect",
		zIndex: 1000,

		// callbacks
		activate: null,
		beforeStop: null,
		change: null,
		deactivate: null,
		out: null,
		over: null,
		receive: null,
		remove: null,
		sort: null,
		start: null,
		stop: null,
		update: null
	},
	_create: function() {

		var o = this.options;
		this.containerCache = {};
		this.element.addClass("ui-sortable");

		//Get the items
		this.refresh();

		//Let's determine if the items are being displayed horizontally
		this.floating = this.items.length ? o.axis === "x" || isFloating(this.items[0].item) : false;

		//Let's determine the parent's offset
		this.offset = this.element.offset();

		//Initialize mouse events for interaction
		this._mouseInit();

		//We're ready to go
		this.ready = true;

	},

	_destroy: function() {
		this.element
			.removeClass("ui-sortable ui-sortable-disabled");
		this._mouseDestroy();

		for ( var i = this.items.length - 1; i >= 0; i-- ) {
			this.items[i].item.removeData(this.widgetName + "-item");
		}

		return this;
	},

	_setOption: function(key, value){
		if ( key === "disabled" ) {
			this.options[ key ] = value;

			this.widget().toggleClass( "ui-sortable-disabled", !!value );
		} else {
			// Don't call widget base _setOption for disable as it adds ui-state-disabled class
			$.Widget.prototype._setOption.apply(this, arguments);
		}
	},

	_mouseCapture: function(event, overrideHandle) {
		var currentItem = null,
			validHandle = false,
			that = this;

		if (this.reverting) {
			return false;
		}

		if(this.options.disabled || this.options.type === "static") {
			return false;
		}

		//We have to refresh the items data once first
		this._refreshItems(event);

		//Find out if the clicked node (or one of its parents) is a actual item in this.items
		$(event.target).parents().each(function() {
			if($.data(this, that.widgetName + "-item") === that) {
				currentItem = $(this);
				return false;
			}
		});
		if($.data(event.target, that.widgetName + "-item") === that) {
			currentItem = $(event.target);
		}

		if(!currentItem) {
			return false;
		}
		if(this.options.handle && !overrideHandle) {
			$(this.options.handle, currentItem).find("*").addBack().each(function() {
				if(this === event.target) {
					validHandle = true;
				}
			});
			if(!validHandle) {
				return false;
			}
		}

		this.currentItem = currentItem;
		this._removeCurrentsFromItems();
		return true;

	},

	_mouseStart: function(event, overrideHandle, noActivation) {

		var i, body,
			o = this.options;

		this.currentContainer = this;

		//We only need to call refreshPositions, because the refreshItems call has been moved to mouseCapture
		this.refreshPositions();

		//Create and append the visible helper
		this.helper = this._createHelper(event);

		//Cache the helper size
		this._cacheHelperProportions();

		/*
		 * - Position generation -
		 * This block generates everything position related - it's the core of draggables.
		 */

		//Cache the margins of the original element
		this._cacheMargins();

		//Get the next scrolling parent
		this.scrollParent = this.helper.scrollParent();

		//The element's absolute position on the page minus margins
		this.offset = this.currentItem.offset();
		this.offset = {
			top: this.offset.top - this.margins.top,
			left: this.offset.left - this.margins.left
		};

		$.extend(this.offset, {
			click: { //Where the click happened, relative to the element
				left: event.pageX - this.offset.left,
				top: event.pageY - this.offset.top
			},
			parent: this._getParentOffset(),
			relative: this._getRelativeOffset() //This is a relative to absolute position minus the actual position calculation - only used for relative positioned helper
		});

		// Only after we got the offset, we can change the helper's position to absolute
		// TODO: Still need to figure out a way to make relative sorting possible
		this.helper.css("position", "absolute");
		this.cssPosition = this.helper.css("position");

		//Generate the original position
		this.originalPosition = this._generatePosition(event);
		this.originalPageX = event.pageX;
		this.originalPageY = event.pageY;

		//Adjust the mouse offset relative to the helper if "cursorAt" is supplied
		(o.cursorAt && this._adjustOffsetFromHelper(o.cursorAt));

		//Cache the former DOM position
		this.domPosition = { prev: this.currentItem.prev()[0], parent: this.currentItem.parent()[0] };

		//If the helper is not the original, hide the original so it's not playing any role during the drag, won't cause anything bad this way
		if(this.helper[0] !== this.currentItem[0]) {
			this.currentItem.hide();
		}

		//Create the placeholder
		this._createPlaceholder();

		//Set a containment if given in the options
		if(o.containment) {
			this._setContainment();
		}

		if( o.cursor && o.cursor !== "auto" ) { // cursor option
			body = this.document.find( "body" );

			// support: IE
			this.storedCursor = body.css( "cursor" );
			body.css( "cursor", o.cursor );

			this.storedStylesheet = $( "<style>*{ cursor: "+o.cursor+" !important; }</style>" ).appendTo( body );
		}

		if(o.opacity) { // opacity option
			if (this.helper.css("opacity")) {
				this._storedOpacity = this.helper.css("opacity");
			}
			this.helper.css("opacity", o.opacity);
		}

		if(o.zIndex) { // zIndex option
			if (this.helper.css("zIndex")) {
				this._storedZIndex = this.helper.css("zIndex");
			}
			this.helper.css("zIndex", o.zIndex);
		}

		//Prepare scrolling
		if(this.scrollParent[0] !== document && this.scrollParent[0].tagName !== "HTML") {
			this.overflowOffset = this.scrollParent.offset();
		}

		//Call callbacks
		this._trigger("start", event, this._uiHash());

		//Recache the helper size
		if(!this._preserveHelperProportions) {
			this._cacheHelperProportions();
		}


		//Post "activate" events to possible containers
		if( !noActivation ) {
			for ( i = this.containers.length - 1; i >= 0; i-- ) {
				this.containers[ i ]._trigger( "activate", event, this._uiHash( this ) );
			}
		}

		//Prepare possible droppables
		if($.ui.ddmanager) {
			$.ui.ddmanager.current = this;
		}

		if ($.ui.ddmanager && !o.dropBehaviour) {
			$.ui.ddmanager.prepareOffsets(this, event);
		}

		this.dragging = true;

		this.helper.addClass("ui-sortable-helper");
		this._mouseDrag(event); //Execute the drag once - this causes the helper not to be visible before getting its correct position
		return true;

	},

	_mouseDrag: function(event) {
		var i, item, itemElement, intersection,
			o = this.options,
			scrolled = false;

		//Compute the helpers position
		this.position = this._generatePosition(event);
		this.positionAbs = this._convertPositionTo("absolute");

		if (!this.lastPositionAbs) {
			this.lastPositionAbs = this.positionAbs;
		}

		//Do scrolling
		if(this.options.scroll) {
			if(this.scrollParent[0] !== document && this.scrollParent[0].tagName !== "HTML") {

				if((this.overflowOffset.top + this.scrollParent[0].offsetHeight) - event.pageY < o.scrollSensitivity) {
					this.scrollParent[0].scrollTop = scrolled = this.scrollParent[0].scrollTop + o.scrollSpeed;
				} else if(event.pageY - this.overflowOffset.top < o.scrollSensitivity) {
					this.scrollParent[0].scrollTop = scrolled = this.scrollParent[0].scrollTop - o.scrollSpeed;
				}

				if((this.overflowOffset.left + this.scrollParent[0].offsetWidth) - event.pageX < o.scrollSensitivity) {
					this.scrollParent[0].scrollLeft = scrolled = this.scrollParent[0].scrollLeft + o.scrollSpeed;
				} else if(event.pageX - this.overflowOffset.left < o.scrollSensitivity) {
					this.scrollParent[0].scrollLeft = scrolled = this.scrollParent[0].scrollLeft - o.scrollSpeed;
				}

			} else {

				if(event.pageY - $(document).scrollTop() < o.scrollSensitivity) {
					scrolled = $(document).scrollTop($(document).scrollTop() - o.scrollSpeed);
				} else if($(window).height() - (event.pageY - $(document).scrollTop()) < o.scrollSensitivity) {
					scrolled = $(document).scrollTop($(document).scrollTop() + o.scrollSpeed);
				}

				if(event.pageX - $(document).scrollLeft() < o.scrollSensitivity) {
					scrolled = $(document).scrollLeft($(document).scrollLeft() - o.scrollSpeed);
				} else if($(window).width() - (event.pageX - $(document).scrollLeft()) < o.scrollSensitivity) {
					scrolled = $(document).scrollLeft($(document).scrollLeft() + o.scrollSpeed);
				}

			}

			if(scrolled !== false && $.ui.ddmanager && !o.dropBehaviour) {
				$.ui.ddmanager.prepareOffsets(this, event);
			}
		}

		//Regenerate the absolute position used for position checks
		this.positionAbs = this._convertPositionTo("absolute");

		//Set the helper position
		if(!this.options.axis || this.options.axis !== "y") {
			this.helper[0].style.left = this.position.left+"px";
		}
		if(!this.options.axis || this.options.axis !== "x") {
			this.helper[0].style.top = this.position.top+"px";
		}

		//Rearrange
		for (i = this.items.length - 1; i >= 0; i--) {

			//Cache variables and intersection, continue if no intersection
			item = this.items[i];
			itemElement = item.item[0];
			intersection = this._intersectsWithPointer(item);
			if (!intersection) {
				continue;
			}

			// Only put the placeholder inside the current Container, skip all
			// items form other containers. This works because when moving
			// an item from one container to another the
			// currentContainer is switched before the placeholder is moved.
			//
			// Without this moving items in "sub-sortables" can cause the placeholder to jitter
			// beetween the outer and inner container.
			if (item.instance !== this.currentContainer) {
				continue;
			}

			// cannot intersect with itself
			// no useless actions that have been done before
			// no action if the item moved is the parent of the item checked
			if (itemElement !== this.currentItem[0] &&
				this.placeholder[intersection === 1 ? "next" : "prev"]()[0] !== itemElement &&
				!$.contains(this.placeholder[0], itemElement) &&
				(this.options.type === "semi-dynamic" ? !$.contains(this.element[0], itemElement) : true)
			) {

				this.direction = intersection === 1 ? "down" : "up";

				if (this.options.tolerance === "pointer" || this._intersectsWithSides(item)) {
					this._rearrange(event, item);
				} else {
					break;
				}

				this._trigger("change", event, this._uiHash());
				break;
			}
		}

		//Post events to containers
		this._contactContainers(event);

		//Interconnect with droppables
		if($.ui.ddmanager) {
			$.ui.ddmanager.drag(this, event);
		}

		//Call callbacks
		this._trigger("sort", event, this._uiHash());

		this.lastPositionAbs = this.positionAbs;
		return false;

	},

	_mouseStop: function(event, noPropagation) {

		if(!event) {
			return;
		}

		//If we are using droppables, inform the manager about the drop
		if ($.ui.ddmanager && !this.options.dropBehaviour) {
			$.ui.ddmanager.drop(this, event);
		}

		if(this.options.revert) {
			var that = this,
				cur = this.placeholder.offset(),
				axis = this.options.axis,
				animation = {};

			if ( !axis || axis === "x" ) {
				animation.left = cur.left - this.offset.parent.left - this.margins.left + (this.offsetParent[0] === document.body ? 0 : this.offsetParent[0].scrollLeft);
			}
			if ( !axis || axis === "y" ) {
				animation.top = cur.top - this.offset.parent.top - this.margins.top + (this.offsetParent[0] === document.body ? 0 : this.offsetParent[0].scrollTop);
			}
			this.reverting = true;
			$(this.helper).animate( animation, parseInt(this.options.revert, 10) || 500, function() {
				that._clear(event);
			});
		} else {
			this._clear(event, noPropagation);
		}

		return false;

	},

	cancel: function() {

		if(this.dragging) {

			this._mouseUp({ target: null });

			if(this.options.helper === "original") {
				this.currentItem.css(this._storedCSS).removeClass("ui-sortable-helper");
			} else {
				this.currentItem.show();
			}

			//Post deactivating events to containers
			for (var i = this.containers.length - 1; i >= 0; i--){
				this.containers[i]._trigger("deactivate", null, this._uiHash(this));
				if(this.containers[i].containerCache.over) {
					this.containers[i]._trigger("out", null, this._uiHash(this));
					this.containers[i].containerCache.over = 0;
				}
			}

		}

		if (this.placeholder) {
			//$(this.placeholder[0]).remove(); would have been the jQuery way - unfortunately, it unbinds ALL events from the original node!
			if(this.placeholder[0].parentNode) {
				this.placeholder[0].parentNode.removeChild(this.placeholder[0]);
			}
			if(this.options.helper !== "original" && this.helper && this.helper[0].parentNode) {
				this.helper.remove();
			}

			$.extend(this, {
				helper: null,
				dragging: false,
				reverting: false,
				_noFinalSort: null
			});

			if(this.domPosition.prev) {
				$(this.domPosition.prev).after(this.currentItem);
			} else {
				$(this.domPosition.parent).prepend(this.currentItem);
			}
		}

		return this;

	},

	serialize: function(o) {

		var items = this._getItemsAsjQuery(o && o.connected),
			str = [];
		o = o || {};

		$(items).each(function() {
			var res = ($(o.item || this).attr(o.attribute || "id") || "").match(o.expression || (/(.+)[\-=_](.+)/));
			if (res) {
				str.push((o.key || res[1]+"[]")+"="+(o.key && o.expression ? res[1] : res[2]));
			}
		});

		if(!str.length && o.key) {
			str.push(o.key + "=");
		}

		return str.join("&");

	},

	toArray: function(o) {

		var items = this._getItemsAsjQuery(o && o.connected),
			ret = [];

		o = o || {};

		items.each(function() { ret.push($(o.item || this).attr(o.attribute || "id") || ""); });
		return ret;

	},

	/* Be careful with the following core functions */
	_intersectsWith: function(item) {

		var x1 = this.positionAbs.left,
			x2 = x1 + this.helperProportions.width,
			y1 = this.positionAbs.top,
			y2 = y1 + this.helperProportions.height,
			l = item.left,
			r = l + item.width,
			t = item.top,
			b = t + item.height,
			dyClick = this.offset.click.top,
			dxClick = this.offset.click.left,
			isOverElementHeight = ( this.options.axis === "x" ) || ( ( y1 + dyClick ) > t && ( y1 + dyClick ) < b ),
			isOverElementWidth = ( this.options.axis === "y" ) || ( ( x1 + dxClick ) > l && ( x1 + dxClick ) < r ),
			isOverElement = isOverElementHeight && isOverElementWidth;

		if ( this.options.tolerance === "pointer" ||
			this.options.forcePointerForContainers ||
			(this.options.tolerance !== "pointer" && this.helperProportions[this.floating ? "width" : "height"] > item[this.floating ? "width" : "height"])
		) {
			return isOverElement;
		} else {

			return (l < x1 + (this.helperProportions.width / 2) && // Right Half
				x2 - (this.helperProportions.width / 2) < r && // Left Half
				t < y1 + (this.helperProportions.height / 2) && // Bottom Half
				y2 - (this.helperProportions.height / 2) < b ); // Top Half

		}
	},

	_intersectsWithPointer: function(item) {

		var isOverElementHeight = (this.options.axis === "x") || isOverAxis(this.positionAbs.top + this.offset.click.top, item.top, item.height),
			isOverElementWidth = (this.options.axis === "y") || isOverAxis(this.positionAbs.left + this.offset.click.left, item.left, item.width),
			isOverElement = isOverElementHeight && isOverElementWidth,
			verticalDirection = this._getDragVerticalDirection(),
			horizontalDirection = this._getDragHorizontalDirection();

		if (!isOverElement) {
			return false;
		}

		return this.floating ?
			( ((horizontalDirection && horizontalDirection === "right") || verticalDirection === "down") ? 2 : 1 )
			: ( verticalDirection && (verticalDirection === "down" ? 2 : 1) );

	},

	_intersectsWithSides: function(item) {

		var isOverBottomHalf = isOverAxis(this.positionAbs.top + this.offset.click.top, item.top + (item.height/2), item.height),
			isOverRightHalf = isOverAxis(this.positionAbs.left + this.offset.click.left, item.left + (item.width/2), item.width),
			verticalDirection = this._getDragVerticalDirection(),
			horizontalDirection = this._getDragHorizontalDirection();

		if (this.floating && horizontalDirection) {
			return ((horizontalDirection === "right" && isOverRightHalf) || (horizontalDirection === "left" && !isOverRightHalf));
		} else {
			return verticalDirection && ((verticalDirection === "down" && isOverBottomHalf) || (verticalDirection === "up" && !isOverBottomHalf));
		}

	},

	_getDragVerticalDirection: function() {
		var delta = this.positionAbs.top - this.lastPositionAbs.top;
		return delta !== 0 && (delta > 0 ? "down" : "up");
	},

	_getDragHorizontalDirection: function() {
		var delta = this.positionAbs.left - this.lastPositionAbs.left;
		return delta !== 0 && (delta > 0 ? "right" : "left");
	},

	refresh: function(event) {
		this._refreshItems(event);
		this.refreshPositions();
		return this;
	},

	_connectWith: function() {
		var options = this.options;
		return options.connectWith.constructor === String ? [options.connectWith] : options.connectWith;
	},

	_getItemsAsjQuery: function(connected) {

		var i, j, cur, inst,
			items = [],
			queries = [],
			connectWith = this._connectWith();

		if(connectWith && connected) {
			for (i = connectWith.length - 1; i >= 0; i--){
				cur = $(connectWith[i]);
				for ( j = cur.length - 1; j >= 0; j--){
					inst = $.data(cur[j], this.widgetFullName);
					if(inst && inst !== this && !inst.options.disabled) {
						queries.push([$.isFunction(inst.options.items) ? inst.options.items.call(inst.element) : $(inst.options.items, inst.element).not(".ui-sortable-helper").not(".ui-sortable-placeholder"), inst]);
					}
				}
			}
		}

		queries.push([$.isFunction(this.options.items) ? this.options.items.call(this.element, null, { options: this.options, item: this.currentItem }) : $(this.options.items, this.element).not(".ui-sortable-helper").not(".ui-sortable-placeholder"), this]);

		for (i = queries.length - 1; i >= 0; i--){
			queries[i][0].each(function() {
				items.push(this);
			});
		}

		return $(items);

	},

	_removeCurrentsFromItems: function() {

		var list = this.currentItem.find(":data(" + this.widgetName + "-item)");

		this.items = $.grep(this.items, function (item) {
			for (var j=0; j < list.length; j++) {
				if(list[j] === item.item[0]) {
					return false;
				}
			}
			return true;
		});

	},

	_refreshItems: function(event) {

		this.items = [];
		this.containers = [this];

		var i, j, cur, inst, targetData, _queries, item, queriesLength,
			items = this.items,
			queries = [[$.isFunction(this.options.items) ? this.options.items.call(this.element[0], event, { item: this.currentItem }) : $(this.options.items, this.element), this]],
			connectWith = this._connectWith();

		if(connectWith && this.ready) { //Shouldn't be run the first time through due to massive slow-down
			for (i = connectWith.length - 1; i >= 0; i--){
				cur = $(connectWith[i]);
				for (j = cur.length - 1; j >= 0; j--){
					inst = $.data(cur[j], this.widgetFullName);
					if(inst && inst !== this && !inst.options.disabled) {
						queries.push([$.isFunction(inst.options.items) ? inst.options.items.call(inst.element[0], event, { item: this.currentItem }) : $(inst.options.items, inst.element), inst]);
						this.containers.push(inst);
					}
				}
			}
		}

		for (i = queries.length - 1; i >= 0; i--) {
			targetData = queries[i][1];
			_queries = queries[i][0];

			for (j=0, queriesLength = _queries.length; j < queriesLength; j++) {
				item = $(_queries[j]);

				item.data(this.widgetName + "-item", targetData); // Data for target checking (mouse manager)

				items.push({
					item: item,
					instance: targetData,
					width: 0, height: 0,
					left: 0, top: 0
				});
			}
		}

	},

	refreshPositions: function(fast) {

		//This has to be redone because due to the item being moved out/into the offsetParent, the offsetParent's position will change
		if(this.offsetParent && this.helper) {
			this.offset.parent = this._getParentOffset();
		}

		var i, item, t, p;

		for (i = this.items.length - 1; i >= 0; i--){
			item = this.items[i];

			//We ignore calculating positions of all connected containers when we're not over them
			if(item.instance !== this.currentContainer && this.currentContainer && item.item[0] !== this.currentItem[0]) {
				continue;
			}

			t = this.options.toleranceElement ? $(this.options.toleranceElement, item.item) : item.item;

			if (!fast) {
				item.width = t.outerWidth();
				item.height = t.outerHeight();
			}

			p = t.offset();
			item.left = p.left;
			item.top = p.top;
		}

		if(this.options.custom && this.options.custom.refreshContainers) {
			this.options.custom.refreshContainers.call(this);
		} else {
			for (i = this.containers.length - 1; i >= 0; i--){
				p = this.containers[i].element.offset();
				this.containers[i].containerCache.left = p.left;
				this.containers[i].containerCache.top = p.top;
				this.containers[i].containerCache.width	= this.containers[i].element.outerWidth();
				this.containers[i].containerCache.height = this.containers[i].element.outerHeight();
			}
		}

		return this;
	},

	_createPlaceholder: function(that) {
		that = that || this;
		var className,
			o = that.options;

		if(!o.placeholder || o.placeholder.constructor === String) {
			className = o.placeholder;
			o.placeholder = {
				element: function() {

					var nodeName = that.currentItem[0].nodeName.toLowerCase(),
						element = $( "<" + nodeName + ">", that.document[0] )
							.addClass(className || that.currentItem[0].className+" ui-sortable-placeholder")
							.removeClass("ui-sortable-helper");

					if ( nodeName === "tr" ) {
						that.currentItem.children().each(function() {
							$( "<td>&#160;</td>", that.document[0] )
								.attr( "colspan", $( this ).attr( "colspan" ) || 1 )
								.appendTo( element );
						});
					} else if ( nodeName === "img" ) {
						element.attr( "src", that.currentItem.attr( "src" ) );
					}

					if ( !className ) {
						element.css( "visibility", "hidden" );
					}

					return element;
				},
				update: function(container, p) {

					// 1. If a className is set as 'placeholder option, we don't force sizes - the class is responsible for that
					// 2. The option 'forcePlaceholderSize can be enabled to force it even if a class name is specified
					if(className && !o.forcePlaceholderSize) {
						return;
					}

					//If the element doesn't have a actual height by itself (without styles coming from a stylesheet), it receives the inline height from the dragged item
					if(!p.height()) { p.height(that.currentItem.innerHeight() - parseInt(that.currentItem.css("paddingTop")||0, 10) - parseInt(that.currentItem.css("paddingBottom")||0, 10)); }
					if(!p.width()) { p.width(that.currentItem.innerWidth() - parseInt(that.currentItem.css("paddingLeft")||0, 10) - parseInt(that.currentItem.css("paddingRight")||0, 10)); }
				}
			};
		}

		//Create the placeholder
		that.placeholder = $(o.placeholder.element.call(that.element, that.currentItem));

		//Append it after the actual current item
		that.currentItem.after(that.placeholder);

		//Update the size of the placeholder (TODO: Logic to fuzzy, see line 316/317)
		o.placeholder.update(that, that.placeholder);

	},

	_contactContainers: function(event) {
		var i, j, dist, itemWithLeastDistance, posProperty, sizeProperty, base, cur, nearBottom, floating,
			innermostContainer = null,
			innermostIndex = null;

		// get innermost container that intersects with item
		for (i = this.containers.length - 1; i >= 0; i--) {

			// never consider a container that's located within the item itself
			if($.contains(this.currentItem[0], this.containers[i].element[0])) {
				continue;
			}

			if(this._intersectsWith(this.containers[i].containerCache)) {

				// if we've already found a container and it's more "inner" than this, then continue
				if(innermostContainer && $.contains(this.containers[i].element[0], innermostContainer.element[0])) {
					continue;
				}

				innermostContainer = this.containers[i];
				innermostIndex = i;

			} else {
				// container doesn't intersect. trigger "out" event if necessary
				if(this.containers[i].containerCache.over) {
					this.containers[i]._trigger("out", event, this._uiHash(this));
					this.containers[i].containerCache.over = 0;
				}
			}

		}

		// if no intersecting containers found, return
		if(!innermostContainer) {
			return;
		}

		// move the item into the container if it's not there already
		if(this.containers.length === 1) {
			if (!this.containers[innermostIndex].containerCache.over) {
				this.containers[innermostIndex]._trigger("over", event, this._uiHash(this));
				this.containers[innermostIndex].containerCache.over = 1;
			}
		} else {

			//When entering a new container, we will find the item with the least distance and append our item near it
			dist = 10000;
			itemWithLeastDistance = null;
			floating = innermostContainer.floating || isFloating(this.currentItem);
			posProperty = floating ? "left" : "top";
			sizeProperty = floating ? "width" : "height";
			base = this.positionAbs[posProperty] + this.offset.click[posProperty];
			for (j = this.items.length - 1; j >= 0; j--) {
				if(!$.contains(this.containers[innermostIndex].element[0], this.items[j].item[0])) {
					continue;
				}
				if(this.items[j].item[0] === this.currentItem[0]) {
					continue;
				}
				if (floating && !isOverAxis(this.positionAbs.top + this.offset.click.top, this.items[j].top, this.items[j].height)) {
					continue;
				}
				cur = this.items[j].item.offset()[posProperty];
				nearBottom = false;
				if(Math.abs(cur - base) > Math.abs(cur + this.items[j][sizeProperty] - base)){
					nearBottom = true;
					cur += this.items[j][sizeProperty];
				}

				if(Math.abs(cur - base) < dist) {
					dist = Math.abs(cur - base); itemWithLeastDistance = this.items[j];
					this.direction = nearBottom ? "up": "down";
				}
			}

			//Check if dropOnEmpty is enabled
			if(!itemWithLeastDistance && !this.options.dropOnEmpty) {
				return;
			}

			if(this.currentContainer === this.containers[innermostIndex]) {
				return;
			}

			itemWithLeastDistance ? this._rearrange(event, itemWithLeastDistance, null, true) : this._rearrange(event, null, this.containers[innermostIndex].element, true);
			this._trigger("change", event, this._uiHash());
			this.containers[innermostIndex]._trigger("change", event, this._uiHash(this));
			this.currentContainer = this.containers[innermostIndex];

			//Update the placeholder
			this.options.placeholder.update(this.currentContainer, this.placeholder);

			this.containers[innermostIndex]._trigger("over", event, this._uiHash(this));
			this.containers[innermostIndex].containerCache.over = 1;
		}


	},

	_createHelper: function(event) {

		var o = this.options,
			helper = $.isFunction(o.helper) ? $(o.helper.apply(this.element[0], [event, this.currentItem])) : (o.helper === "clone" ? this.currentItem.clone() : this.currentItem);

		//Add the helper to the DOM if that didn't happen already
		if(!helper.parents("body").length) {
			$(o.appendTo !== "parent" ? o.appendTo : this.currentItem[0].parentNode)[0].appendChild(helper[0]);
		}

		if(helper[0] === this.currentItem[0]) {
			this._storedCSS = { width: this.currentItem[0].style.width, height: this.currentItem[0].style.height, position: this.currentItem.css("position"), top: this.currentItem.css("top"), left: this.currentItem.css("left") };
		}

		if(!helper[0].style.width || o.forceHelperSize) {
			helper.width(this.currentItem.width());
		}
		if(!helper[0].style.height || o.forceHelperSize) {
			helper.height(this.currentItem.height());
		}

		return helper;

	},

	_adjustOffsetFromHelper: function(obj) {
		if (typeof obj === "string") {
			obj = obj.split(" ");
		}
		if ($.isArray(obj)) {
			obj = {left: +obj[0], top: +obj[1] || 0};
		}
		if ("left" in obj) {
			this.offset.click.left = obj.left + this.margins.left;
		}
		if ("right" in obj) {
			this.offset.click.left = this.helperProportions.width - obj.right + this.margins.left;
		}
		if ("top" in obj) {
			this.offset.click.top = obj.top + this.margins.top;
		}
		if ("bottom" in obj) {
			this.offset.click.top = this.helperProportions.height - obj.bottom + this.margins.top;
		}
	},

	_getParentOffset: function() {


		//Get the offsetParent and cache its position
		this.offsetParent = this.helper.offsetParent();
		var po = this.offsetParent.offset();

		// This is a special case where we need to modify a offset calculated on start, since the following happened:
		// 1. The position of the helper is absolute, so it's position is calculated based on the next positioned parent
		// 2. The actual offset parent is a child of the scroll parent, and the scroll parent isn't the document, which means that
		//    the scroll is included in the initial calculation of the offset of the parent, and never recalculated upon drag
		if(this.cssPosition === "absolute" && this.scrollParent[0] !== document && $.contains(this.scrollParent[0], this.offsetParent[0])) {
			po.left += this.scrollParent.scrollLeft();
			po.top += this.scrollParent.scrollTop();
		}

		// This needs to be actually done for all browsers, since pageX/pageY includes this information
		// with an ugly IE fix
		if( this.offsetParent[0] === document.body || (this.offsetParent[0].tagName && this.offsetParent[0].tagName.toLowerCase() === "html" && $.ui.ie)) {
			po = { top: 0, left: 0 };
		}

		return {
			top: po.top + (parseInt(this.offsetParent.css("borderTopWidth"),10) || 0),
			left: po.left + (parseInt(this.offsetParent.css("borderLeftWidth"),10) || 0)
		};

	},

	_getRelativeOffset: function() {

		if(this.cssPosition === "relative") {
			var p = this.currentItem.position();
			return {
				top: p.top - (parseInt(this.helper.css("top"),10) || 0) + this.scrollParent.scrollTop(),
				left: p.left - (parseInt(this.helper.css("left"),10) || 0) + this.scrollParent.scrollLeft()
			};
		} else {
			return { top: 0, left: 0 };
		}

	},

	_cacheMargins: function() {
		this.margins = {
			left: (parseInt(this.currentItem.css("marginLeft"),10) || 0),
			top: (parseInt(this.currentItem.css("marginTop"),10) || 0)
		};
	},

	_cacheHelperProportions: function() {
		this.helperProportions = {
			width: this.helper.outerWidth(),
			height: this.helper.outerHeight()
		};
	},

	_setContainment: function() {

		var ce, co, over,
			o = this.options;
		if(o.containment === "parent") {
			o.containment = this.helper[0].parentNode;
		}
		if(o.containment === "document" || o.containment === "window") {
			this.containment = [
				0 - this.offset.relative.left - this.offset.parent.left,
				0 - this.offset.relative.top - this.offset.parent.top,
				$(o.containment === "document" ? document : window).width() - this.helperProportions.width - this.margins.left,
				($(o.containment === "document" ? document : window).height() || document.body.parentNode.scrollHeight) - this.helperProportions.height - this.margins.top
			];
		}

		if(!(/^(document|window|parent)$/).test(o.containment)) {
			ce = $(o.containment)[0];
			co = $(o.containment).offset();
			over = ($(ce).css("overflow") !== "hidden");

			this.containment = [
				co.left + (parseInt($(ce).css("borderLeftWidth"),10) || 0) + (parseInt($(ce).css("paddingLeft"),10) || 0) - this.margins.left,
				co.top + (parseInt($(ce).css("borderTopWidth"),10) || 0) + (parseInt($(ce).css("paddingTop"),10) || 0) - this.margins.top,
				co.left+(over ? Math.max(ce.scrollWidth,ce.offsetWidth) : ce.offsetWidth) - (parseInt($(ce).css("borderLeftWidth"),10) || 0) - (parseInt($(ce).css("paddingRight"),10) || 0) - this.helperProportions.width - this.margins.left,
				co.top+(over ? Math.max(ce.scrollHeight,ce.offsetHeight) : ce.offsetHeight) - (parseInt($(ce).css("borderTopWidth"),10) || 0) - (parseInt($(ce).css("paddingBottom"),10) || 0) - this.helperProportions.height - this.margins.top
			];
		}

	},

	_convertPositionTo: function(d, pos) {

		if(!pos) {
			pos = this.position;
		}
		var mod = d === "absolute" ? 1 : -1,
			scroll = this.cssPosition === "absolute" && !(this.scrollParent[0] !== document && $.contains(this.scrollParent[0], this.offsetParent[0])) ? this.offsetParent : this.scrollParent,
			scrollIsRootNode = (/(html|body)/i).test(scroll[0].tagName);

		return {
			top: (
				pos.top	+																// The absolute mouse position
				this.offset.relative.top * mod +										// Only for relative positioned nodes: Relative offset from element to offset parent
				this.offset.parent.top * mod -											// The offsetParent's offset without borders (offset + border)
				( ( this.cssPosition === "fixed" ? -this.scrollParent.scrollTop() : ( scrollIsRootNode ? 0 : scroll.scrollTop() ) ) * mod)
			),
			left: (
				pos.left +																// The absolute mouse position
				this.offset.relative.left * mod +										// Only for relative positioned nodes: Relative offset from element to offset parent
				this.offset.parent.left * mod	-										// The offsetParent's offset without borders (offset + border)
				( ( this.cssPosition === "fixed" ? -this.scrollParent.scrollLeft() : scrollIsRootNode ? 0 : scroll.scrollLeft() ) * mod)
			)
		};

	},

	_generatePosition: function(event) {

		var top, left,
			o = this.options,
			pageX = event.pageX,
			pageY = event.pageY,
			scroll = this.cssPosition === "absolute" && !(this.scrollParent[0] !== document && $.contains(this.scrollParent[0], this.offsetParent[0])) ? this.offsetParent : this.scrollParent, scrollIsRootNode = (/(html|body)/i).test(scroll[0].tagName);

		// This is another very weird special case that only happens for relative elements:
		// 1. If the css position is relative
		// 2. and the scroll parent is the document or similar to the offset parent
		// we have to refresh the relative offset during the scroll so there are no jumps
		if(this.cssPosition === "relative" && !(this.scrollParent[0] !== document && this.scrollParent[0] !== this.offsetParent[0])) {
			this.offset.relative = this._getRelativeOffset();
		}

		/*
		 * - Position constraining -
		 * Constrain the position to a mix of grid, containment.
		 */

		if(this.originalPosition) { //If we are not dragging yet, we won't check for options

			if(this.containment) {
				if(event.pageX - this.offset.click.left < this.containment[0]) {
					pageX = this.containment[0] + this.offset.click.left;
				}
				if(event.pageY - this.offset.click.top < this.containment[1]) {
					pageY = this.containment[1] + this.offset.click.top;
				}
				if(event.pageX - this.offset.click.left > this.containment[2]) {
					pageX = this.containment[2] + this.offset.click.left;
				}
				if(event.pageY - this.offset.click.top > this.containment[3]) {
					pageY = this.containment[3] + this.offset.click.top;
				}
			}

			if(o.grid) {
				top = this.originalPageY + Math.round((pageY - this.originalPageY) / o.grid[1]) * o.grid[1];
				pageY = this.containment ? ( (top - this.offset.click.top >= this.containment[1] && top - this.offset.click.top <= this.containment[3]) ? top : ((top - this.offset.click.top >= this.containment[1]) ? top - o.grid[1] : top + o.grid[1])) : top;

				left = this.originalPageX + Math.round((pageX - this.originalPageX) / o.grid[0]) * o.grid[0];
				pageX = this.containment ? ( (left - this.offset.click.left >= this.containment[0] && left - this.offset.click.left <= this.containment[2]) ? left : ((left - this.offset.click.left >= this.containment[0]) ? left - o.grid[0] : left + o.grid[0])) : left;
			}

		}

		return {
			top: (
				pageY -																// The absolute mouse position
				this.offset.click.top -													// Click offset (relative to the element)
				this.offset.relative.top	-											// Only for relative positioned nodes: Relative offset from element to offset parent
				this.offset.parent.top +												// The offsetParent's offset without borders (offset + border)
				( ( this.cssPosition === "fixed" ? -this.scrollParent.scrollTop() : ( scrollIsRootNode ? 0 : scroll.scrollTop() ) ))
			),
			left: (
				pageX -																// The absolute mouse position
				this.offset.click.left -												// Click offset (relative to the element)
				this.offset.relative.left	-											// Only for relative positioned nodes: Relative offset from element to offset parent
				this.offset.parent.left +												// The offsetParent's offset without borders (offset + border)
				( ( this.cssPosition === "fixed" ? -this.scrollParent.scrollLeft() : scrollIsRootNode ? 0 : scroll.scrollLeft() ))
			)
		};

	},

	_rearrange: function(event, i, a, hardRefresh) {

		a ? a[0].appendChild(this.placeholder[0]) : i.item[0].parentNode.insertBefore(this.placeholder[0], (this.direction === "down" ? i.item[0] : i.item[0].nextSibling));

		//Various things done here to improve the performance:
		// 1. we create a setTimeout, that calls refreshPositions
		// 2. on the instance, we have a counter variable, that get's higher after every append
		// 3. on the local scope, we copy the counter variable, and check in the timeout, if it's still the same
		// 4. this lets only the last addition to the timeout stack through
		this.counter = this.counter ? ++this.counter : 1;
		var counter = this.counter;

		this._delay(function() {
			if(counter === this.counter) {
				this.refreshPositions(!hardRefresh); //Precompute after each DOM insertion, NOT on mousemove
			}
		});

	},

	_clear: function(event, noPropagation) {

		this.reverting = false;
		// We delay all events that have to be triggered to after the point where the placeholder has been removed and
		// everything else normalized again
		var i,
			delayedTriggers = [];

		// We first have to update the dom position of the actual currentItem
		// Note: don't do it if the current item is already removed (by a user), or it gets reappended (see #4088)
		if(!this._noFinalSort && this.currentItem.parent().length) {
			this.placeholder.before(this.currentItem);
		}
		this._noFinalSort = null;

		if(this.helper[0] === this.currentItem[0]) {
			for(i in this._storedCSS) {
				if(this._storedCSS[i] === "auto" || this._storedCSS[i] === "static") {
					this._storedCSS[i] = "";
				}
			}
			this.currentItem.css(this._storedCSS).removeClass("ui-sortable-helper");
		} else {
			this.currentItem.show();
		}

		if(this.fromOutside && !noPropagation) {
			delayedTriggers.push(function(event) { this._trigger("receive", event, this._uiHash(this.fromOutside)); });
		}
		if((this.fromOutside || this.domPosition.prev !== this.currentItem.prev().not(".ui-sortable-helper")[0] || this.domPosition.parent !== this.currentItem.parent()[0]) && !noPropagation) {
			delayedTriggers.push(function(event) { this._trigger("update", event, this._uiHash()); }); //Trigger update callback if the DOM position has changed
		}

		// Check if the items Container has Changed and trigger appropriate
		// events.
		if (this !== this.currentContainer) {
			if(!noPropagation) {
				delayedTriggers.push(function(event) { this._trigger("remove", event, this._uiHash()); });
				delayedTriggers.push((function(c) { return function(event) { c._trigger("receive", event, this._uiHash(this)); };  }).call(this, this.currentContainer));
				delayedTriggers.push((function(c) { return function(event) { c._trigger("update", event, this._uiHash(this));  }; }).call(this, this.currentContainer));
			}
		}


		//Post events to containers
		for (i = this.containers.length - 1; i >= 0; i--){
			if(!noPropagation) {
				delayedTriggers.push((function(c) { return function(event) { c._trigger("deactivate", event, this._uiHash(this)); };  }).call(this, this.containers[i]));
			}
			if(this.containers[i].containerCache.over) {
				delayedTriggers.push((function(c) { return function(event) { c._trigger("out", event, this._uiHash(this)); };  }).call(this, this.containers[i]));
				this.containers[i].containerCache.over = 0;
			}
		}

		//Do what was originally in plugins
		if ( this.storedCursor ) {
			this.document.find( "body" ).css( "cursor", this.storedCursor );
			this.storedStylesheet.remove();
		}
		if(this._storedOpacity) {
			this.helper.css("opacity", this._storedOpacity);
		}
		if(this._storedZIndex) {
			this.helper.css("zIndex", this._storedZIndex === "auto" ? "" : this._storedZIndex);
		}

		this.dragging = false;
		if(this.cancelHelperRemoval) {
			if(!noPropagation) {
				this._trigger("beforeStop", event, this._uiHash());
				for (i=0; i < delayedTriggers.length; i++) {
					delayedTriggers[i].call(this, event);
				} //Trigger all delayed events
				this._trigger("stop", event, this._uiHash());
			}

			this.fromOutside = false;
			return false;
		}

		if(!noPropagation) {
			this._trigger("beforeStop", event, this._uiHash());
		}

		//$(this.placeholder[0]).remove(); would have been the jQuery way - unfortunately, it unbinds ALL events from the original node!
		this.placeholder[0].parentNode.removeChild(this.placeholder[0]);

		if(this.helper[0] !== this.currentItem[0]) {
			this.helper.remove();
		}
		this.helper = null;

		if(!noPropagation) {
			for (i=0; i < delayedTriggers.length; i++) {
				delayedTriggers[i].call(this, event);
			} //Trigger all delayed events
			this._trigger("stop", event, this._uiHash());
		}

		this.fromOutside = false;
		return true;

	},

	_trigger: function() {
		if ($.Widget.prototype._trigger.apply(this, arguments) === false) {
			this.cancel();
		}
	},

	_uiHash: function(_inst) {
		var inst = _inst || this;
		return {
			helper: inst.helper,
			placeholder: inst.placeholder || $([]),
			position: inst.position,
			originalPosition: inst.originalPosition,
			offset: inst.positionAbs,
			item: inst.currentItem,
			sender: _inst ? _inst.element : null
		};
	}

});

})(jQuery);

define("jquery.ui.sortable", ["jquery.ui.widget","jquery.ui.mouse","jquery.ui.draggable","jquery.ui.droppable"], function(){});

define('splunkjs/mvc/simpleform/edit/staticoptionscontrol',['require','exports','module','underscore','jquery','util/console','../../../mvc','views/Base','views/shared/controls/TextControl','jquery.ui.sortable'],function(require, exports, module) {

    var _ = require('underscore');
    var $ = require('jquery');
    var console = require('util/console');
    var mvc = require('../../../mvc');
    var Base = require('views/Base');
    var TextControl = require('views/shared/controls/TextControl');
    var sortable = require('jquery.ui.sortable');

    var StaticOptionsControl = Base.extend({

        moduleId: module.id,

        initialize: function() {
            Base.prototype.initialize.apply(this, arguments);

            this._optionsModel = this.options.controlOptions && this.options.controlOptions.model;
            this._optionsAttribute = this.options.controlOptions && this.options.controlOptions.modelAttribute;

            this._optionPairMap = {};
        },

        events: {
            "click a.static-options-add": function(e) {
                e.preventDefault();
                this._addOptionPair();
            }
        },

        render: function() {
            this.$el.html(this.compiledTemplate({ _: _ }));

            var optionList = (this._optionsModel && this._optionsAttribute) ? this._optionsModel.get(this._optionsAttribute) : null;
            if (optionList && optionList.length) {
                for (var i = 0, l = optionList.length; i < l; i++) {
                    this._addOptionPair(optionList[i]);
                }
            } else {
                this._addOptionPair();
            }
            this._updateValue();

            var self = this;
            var sortable = this.$(".static-options-body").sortable({
                handle: ".drag-handle",
                tolerance: "pointer"
            }).on("sortupdate", function(e) {
                self._updateValue();
            }).on("stop", function(e) {
                self._updateValue();
            });

            return this;
        },

        _addOptionPair: function(options) {
            var pair = new OptionPair(options || {});
            pair.on("change", this._updateValue, this);
            pair.on("click:remove", function() {
                this._removeOptionPair(pair);
            }, this);
            this.$(".static-options-body").append(pair.render().$el);
            this._optionPairMap[pair.cid] = pair;
        },

        _removeOptionPair: function(pair) {
            delete this._optionPairMap[pair.cid];
            pair.remove();
            this._updateValue();

            // ensure there is at least one OptionPair available
            if (this.$(".static-option-pair").length === 0) {
                this._addOptionPair();
            }
        },

        _updateValue: function() {
            var value = [];
            var optionPairList = this.$(".static-option-pair").removeClass('error');
            var optionPairMap = this._optionPairMap;
            var optionPairCid;
            var optionPair;
            var optionLabel;
            var optionValue;
            var optionDupesMap = {};
            for (var i = 0, l = optionPairList.length; i < l; i++) {
                optionPairCid = $(optionPairList[i]).data("cid");
                if (optionPairCid) {
                    optionPair = optionPairMap[optionPairCid];
                    if (optionPair) {
                        optionLabel = optionPair.getLabel();
                        optionValue = optionPair.getValue();
                        if (optionLabel || optionValue) {
                            value.push({ label: optionLabel, value: optionValue });
                        }
                        if (optionValue) {
                            if (!optionLabel || _.has(optionDupesMap, optionValue)) {
                                optionPair.$el.addClass('error');
                            }
                            optionDupesMap[optionValue] = true;
                        }
                    }
                }
            }

            if (this._optionsModel && this._optionsAttribute) {
                this._optionsModel.set(this._optionsAttribute, value);
            }
        },

        template: '\
            <div class="static-options-heading">\
                <div class="static-options-heading-name"><%- _("Name").t() %></div>\
                <div class="static-options-heading-value"><%- _("Value").t() %></div>\
            </div>\
            <div class="static-options-body">\
            </div>\
            <a class="static-options-add btn-link pull-right" href="#"><%- _("Add Option").t() %></a>\
        '
    });

    var OptionPair = Base.extend({

        className: "static-option-pair control-group",

        initialize: function() {
            Base.prototype.initialize.apply(this, arguments);

            this._labelControl = new TextControl({ defaultValue: this.options.label || "" });
            this._labelControl.on("change", this._notifyChange, this);

            this._valueControl = new TextControl({ defaultValue: this.options.value || "" });
            this._valueControl.on("change", this._notifyChange, this);
        },

        events: {
            "click a.static-option-remove": function(e) {
                e.preventDefault();
                this.trigger("click:remove");
            }
        },

        getLabel: function() {
            return this._labelControl.getValue();
        },

        setLabel: function(value) {
            this._labelControl.setValue(value);
        },

        getValue: function() {
            return this._valueControl.getValue();
        },

        setValue: function(value) {
            this._valueControl.setValue(value);
        },

        render: function() {
            this.$el.append($(this.template));

            this.$(".static-option-label").append(this._labelControl.render().$el);
            this.$(".static-option-value").append(this._valueControl.render().$el);

            return this;
        },

        _notifyChange: function() {
            this.trigger("change");
        },

        template: '\
            <div class="drag-handle"></div>\
            <div class="static-option-label"></div>\
            <div class="static-option-value"></div>\
            <a class="static-option-remove btn-link" href="#"><i class="icon-x-circle"></i></a>\
        '

    });

    return StaticOptionsControl;

});

define('splunkjs/mvc/simpleform/edit/dynamicoptionscontrol',['require','exports','module','underscore','jquery','backbone','util/console','../../../mvc','views/Base','views/shared/controls/ControlGroup','../../simplexml/controller','../../simplexml/dialog/addpanel/report','../../timerangeview','../../utils','uri/route','util/time','bootstrap.tooltip'],function(require, exports, module) {

    var _ = require('underscore');
    var $ = require('jquery');
    var Backbone = require('backbone');
    var console = require('util/console');
    var mvc = require('../../../mvc');
    var Base = require('views/Base');
    var ControlGroup = require('views/shared/controls/ControlGroup');
    var Dashboard = require('../../simplexml/controller');
    var ReportForm = require('../../simplexml/dialog/addpanel/report');
    var TimeRangeView = require('../../timerangeview');
    var utils = require('../../utils');
    var route = require('uri/route');
    var time_utils = require('util/time');
    require('bootstrap.tooltip');

    var DynamicOptionsControl = Base.extend({

        moduleId: module.id,

        initialize: function() {
            Base.prototype.initialize.apply(this, arguments);

            this._optionsModel = (this.options.controlOptions && this.options.controlOptions.model) || new Backbone.Model();
            this._optionsModelProxy = new Backbone.Model();

            this.listenTo(this._optionsModel, "change", this.onOptionsModelChange, this);
            this.listenTo(this._optionsModelProxy, "change", this.onProxyModelChange, this);

            this.onOptionsModelChange();

            this.children.elementCreateType = new ControlGroup({
                label: _("Content Type").t(),
                controlType: 'SyntheticRadio',
                controlClass: 'controls-thirdblock',
                controlOptions: {
                    className: 'btn-group btn-group-3 add-panel-select',
                    items: [
                        {value: 'inline', label: '<i class="icon-search-thin"></i>', tooltip: _("Inline Search").t()},
                        {value: 'saved', label: '<i class="icon-report"></i>', tooltip: _("Report").t()}
                    ],
                    model: this._optionsModelProxy,
                    modelAttribute: 'elementCreateType'
                }
            });

            this.children.inline = new InlineForm({
                model: this._optionsModelProxy,
                collection: {
                    timeRanges: Dashboard.collection.times
                }
            });

            this.children.report = new ReportForm({
                model: this._optionsModelProxy,
                collection: {
                    timeRanges: Dashboard.collection.times
                },
                controller: Dashboard,
                popdownOptions: {
                    attachDialogTo: '.popdown-dialog.open',
                    scrollContainer: '.popdown-dialog.open .concertina-body'
                }
            });
        },

        onOptionsModelChange: function() {
            if (this._isProxySyncing) {
                return;
            }

            try {
                this._isProxySyncing = true;

                this._optionsModelProxy.set({
                    elementCreateType: this._optionsModel.get("searchType") || "inline",
                    savedSearchName: this._optionsModel.get("searchName"),
                    search: this._optionsModel.get("search"),
                    earliest_time: this._optionsModel.get("earliest_time"),
                    latest_time: this._optionsModel.get("latest_time")
                });
            } finally {
                this._isProxySyncing = false;
            }
        },

        onProxyModelChange: function() {
            if (this._isProxySyncing) {
                return;
            }

            try {
                this._isProxySyncing = true;

                this._optionsModel.set({
                    searchType: this._optionsModelProxy.get("elementCreateType"),
                    searchName: this._optionsModelProxy.get("savedSearchName"),
                    search: this._optionsModelProxy.get("search"),
                    earliest_time: this._optionsModelProxy.get("earliest_time"),
                    latest_time: this._optionsModelProxy.get("latest_time")
                });
            } finally {
                this._isProxySyncing = false;
            }
        },

        render: function() {
            this.$el.append(this.children.elementCreateType.render().el);
            this.$el.append(this.children.inline.render().el);
            this.$el.append(this.children.report.render().el);
            return this;
        }

    });

    var InlineForm = Base.extend({

        initialize: function() {
            Base.prototype.initialize.apply(this, arguments);

            this.children.searchField = new ControlGroup({
                controlType: 'Textarea',
                controlOptions: {
                    modelAttribute: 'search',
                    model: this.model
                },
                label: _("Search String").t(),
                help: '<a href="#" class="run-search">'+_("Run Search").t()+' <i class="icon-external"></i></a>'
            });

            this.children.timeRangeView = new TimeRangeView({
                popdownOptions: {
                    attachDialogTo: '.popdown-dialog.open',
                    scrollContainer: '.popdown-dialog.open .concertina-body'
                }
            });
            this.children.timeRangeView.val({
                earliest_time: this.model.get("earliest_time"),
                latest_time: this.model.get("latest_time")
            });

            this.listenTo(this.model, 'change:elementCreateType', this.onModeChange, this);
            this.listenTo(this.children.timeRangeView, 'change', this.onTimeRangeChange, this);
        },

        events: {
            'click a.run-search': function(e) {
                e.preventDefault();
                var search = this.model.get('search'), params = { q: search }, pageInfo = utils.getPageInfo();
                if(!search) {
                    return;
                }
                if(this.model.has('dispatch.earliest_time')) {
                    params.earliest = this.model.get('dispatch.earliest_time');
                    params.latest = this.model.get('dispatch.latest_time');
                }
                utils.redirect(route.search(pageInfo.root, pageInfo.locale, pageInfo.app, { data: params }), true);
            }
        },

        onModeChange: function() {
            var fn = this.model.get('elementCreateType') === 'inline' ? 'show' : 'hide';
            this.$el[fn]();
        },

        onTimeRangeChange: function(e) {
            this.model.set(this.children.timeRangeView.val());
        },

        render: function() {
            this.children.searchField.render().appendTo(this.el);
            this.children.timeRangeView.render().$el.appendTo(this.el);

            this.onModeChange();

            return this;
        }

    });

    return DynamicOptionsControl;

});

define('splunkjs/mvc/simpleform/edit/defaultcontrol',['require','exports','module','underscore','jquery','util/console','../../../mvc','../inputsettings','views/shared/controls/ControlGroup'],function(require, exports, module) {

    var _ = require('underscore');
    var $ = require('jquery');
    var console = require('util/console');
    var mvc = require('../../../mvc');
    var Settings = require('../inputsettings');
    var ControlGroup = require('views/shared/controls/ControlGroup');

    var DefaultControl = ControlGroup.extend({

        moduleId: module.id,

        initialize: function() {
            this._optionsModel = this.options.controlOptions && this.options.controlOptions.model;
            this._optionsAttribute = this.options.controlOptions && this.options.controlOptions.modelAttribute;
            this._optionsModelProxy = new Settings($.extend(true, {}, this._optionsModel ? this._optionsModel.toJSON() : {}));

            if (this.options.controlOptions) {
                this._optionsModelProxy.set(this.options.controlOptions);
            }

            if (this._optionsModel && this._optionsAttribute) {
                this._optionsModelProxy.set("value", this._optionsModel.get(this._optionsAttribute));

                this.listenTo(this._optionsModel, "change", this.onOptionsModelChange, this);
                this.listenTo(this._optionsModelProxy, "change:value", this.onProxyValueChange, this);
            }

            var inputTypeClass = this.options.inputTypeClass;
            if (inputTypeClass) {
                this.options.controls = [ new inputTypeClass({ settings: this._optionsModelProxy }) ];
            }

            ControlGroup.prototype.initialize.apply(this, arguments);
        },

        events: {
            "click a.default-clear-selection": function(e) {
                e.preventDefault();
                this._optionsModelProxy.set("value", null);
            }
        },

        render: function() {
            ControlGroup.prototype.render.apply(this, arguments);

            if (this.options.enableClearSelection) {
                if (!this._clearSelectionButton) {
                    this._clearSelectionButton = $(_.template(this.clearSelectionTemplate, { _: _ }));
                }
                this.$(".controls").append(this._clearSelectionButton);
            }

            return this;
        },

        onOptionsModelChange: function() {
            if (this._isProxySyncing) {
                return;
            }

            try {
                this._isProxySyncing = true;

                var changed = $.extend(true, {}, this._optionsModel.changed);
                delete changed["value"];  // don't sync value attribute
                this._optionsModelProxy.set(changed);
            } finally {
                this._isProxySyncing = false;
            }
        },

        onProxyValueChange: function() {
            if (this._isProxySyncing) {
                return;
            }

            try {
                this._isProxySyncing = true;

                this._optionsModel.set(this._optionsAttribute, this._optionsModelProxy.get("value"));
            } finally {
                this._isProxySyncing = false;
            }
        },

        clearSelectionTemplate: '\
            <a class="default-clear-selection btn-link" href="#"><%- _("Clear Selection").t() %></a>\
        '

    });

    return DefaultControl;

});

define('splunkjs/mvc/simpleform/edit/tokenpreviewcontrol',['require','exports','module','underscore','jquery','util/console','../../../mvc','views/shared/controls/ControlGroup'],function(require, exports, module) {

    var _ = require('underscore');
    var $ = require('jquery');
    var console = require('util/console');
    var mvc = require('../../../mvc');
    var ControlGroup = require('views/shared/controls/ControlGroup');

    var TokenPreviewControl = ControlGroup.extend({

        moduleId: module.id,

        initialize: function() {
            this.options = _.extend({ controlType: "Label" }, this.options);

            ControlGroup.prototype.initialize.apply(this, arguments);

            this._optionsModel = this.options.controlOptions && this.options.controlOptions.model;
            if (this._optionsModel) {
                this.listenTo(this._optionsModel, "change", this.onOptionsModelChange, this);
                this.onOptionsModelChange();
            }
        },

        onOptionsModelChange: function() {
            var prefix = this._optionsModel.get("prefix") || "";
            var suffix = this._optionsModel.get("suffix") || "";
            var valuePrefix = this._optionsModel.get("valuePrefix") || "";
            var valueSuffix = this._optionsModel.get("valueSuffix") || "";
            var delimiter = this._optionsModel.get("delimiter") || "";

            var previewString = "";
            previewString += prefix;
            previewString += valuePrefix + "value1" + valueSuffix;
            previewString += delimiter;
            previewString += valuePrefix + "value2" + valueSuffix;
            previewString += delimiter + "...";
            previewString += suffix;

            this.getAllControls()[0].setValue(previewString);
        }

    });

    return TokenPreviewControl;

});

define('splunkjs/mvc/simpleform/edit/editinputmenu',['require','exports','module','underscore','jquery','util/console','../../../mvc','views/shared/PopTart','../inputsettings','./concertinasettingseditor','../../savedsearchmanager','../../searchmanager','../../utils','./staticoptionscontrol','./dynamicoptionscontrol','./defaultcontrol','./tokenpreviewcontrol','../../radiogroupview','../../dropdownview','../../checkboxgroupview','../../multiselectview','../../timerangeview','views/shared/FlashMessages'],function(require, exports, module) {

    var _ = require('underscore');
    var $ = require('jquery');
    var console = require('util/console');
    var mvc = require('../../../mvc');
    var PopTartView = require('views/shared/PopTart');
    var Settings = require('../inputsettings');
    var ConcertinaSettingsEditor = require('./concertinasettingseditor');
    var SavedSearchManager = require('../../savedsearchmanager');
    var SearchManager = require('../../searchmanager');
    var utils = require('../../utils');
    var StaticOptionsControl = require('./staticoptionscontrol');
    var DynamicOptionsControl = require('./dynamicoptionscontrol');
    var DefaultControl = require('./defaultcontrol');
    var TokenPreviewControl = require('./tokenpreviewcontrol');
    var RadioInput = require('../../radiogroupview');
    var DropdownInput = require('../../dropdownview');
    var CheckboxInput = require('../../checkboxgroupview');
    var MultiselectInput = require('../../multiselectview');
    var TimeInput = require('../../timerangeview');
    var FlashMessages = require('views/shared/FlashMessages');

    var EditInputMenuView = PopTartView.extend({

        moduleId: module.id,

        initialize: function() {
            this.options.ignoreClasses = ["select2-drop-mask", "dropdown-menu", "ui-datepicker"];

            PopTartView.prototype.initialize.apply(this, arguments);

            this.workingSettings = new Settings(this.model.toJSON({ tokens: true }), {
                applyTokensByDefault: true,
                retrieveTokensByDefault: true
            });
            this.on("shown", this.onShown, this);
            this.children.flashMessage = new FlashMessages({ model: this.workingSettings });
        },

        events: {
            'click a.input-editor-toggle': function(e) {
                e.preventDefault();
                var label = $(e.currentTarget).data("label");
                if (label) {
                    this.toggleEditType(label);
                }
            },
            'click .input-editor-apply': function(e) {
                e.preventDefault();
                this.applyChanges();
            },
            'click .input-editor-cancel': function(e) {
                e.preventDefault();
                this.hide();
            },
            'keypress .input-editor-apply': function(e) {
                e.preventDefault();
                this.applyChanges();
            },
            'keypress .input-editor-cancel': function(e) {
                e.preventDefault();
                this.hide();
            }
        },

        toggleEditType: function(type) {
            if (this._currentToggle) {
                this._currentToggle.removeClass("selected");
            }
            if (this._currentEditor) {
                this._currentEditor.remove();
                this._currentEditor = null;
            }

            this.workingSettings.set("type", type);

            this._currentToggle = this.$("[data-label='" + type + "']");
            this._currentToggle.addClass("selected");

            var inputOptions = _INPUT_OPTIONS_MAP[type];
            if (inputOptions) {
                this._currentEditor = new ConcertinaSettingsEditor({
                    model:  this.workingSettings,
                    panels: inputOptions
                });
                this.$(".input-editor-format").append(this._currentEditor.render().$el);
                this._currentEditor.activate();
            }
        },

        onShown: function(){
            //Hack since poptart will do this.
            _.defer(_.bind(this._currentToggle.focus, this._currentToggle));
            if (this._currentEditor) {
                this._currentEditor.activate();
            }
        },

        applyChanges: function() {
            this.workingSettings.validate();
            if (this.workingSettings.isValid()) {
                var previousSearch = this.model.get('search'),
                    previousEarliest = this.model.get('earliest_time'),
                    previousLatest = this.model.get('latest_time'),
                    previousSearchName = this.model.get('searchName');
                this.model.set(this.workingSettings.toJSON({ tokens: true}), { tokens: true });
                this.model.save().done(_.bind(function(){
                    //If the search settings change we need to update the manager
                    var type = this.model.get('searchType');
                    this.model.set('managerid', this.model.get('managerid') || _.uniqueId());
                    if ((!type || type === 'inline') && this.model.get('search')) {
                        if (previousSearch != this.model.get('search')
                            || previousEarliest != this.model.get('earliest_time')
                            || previousLatest != this.model.get('latest_time')) {
                            new SearchManager({
                                "id": this.model.get('managerid'),
                                "latest_time": this.model.get('latest_time'),
                                "earliest_time": this.model.get('earliest_time'),
                                "search": this.model.get('search'),
                                "app": utils.getCurrentApp(),
                                "auto_cancel": 90,
                                "status_buckets": 0,
                                "preview": true,
                                "timeFormat": "%s.%Q",
                                "wait": 0
                            }, { replace: true });
                        }
                    } else if (type === 'saved' && this.model.get('searchName')) {
                        if (previousSearchName != this.model.get('searchName')) {
                            new SavedSearchManager({
                                "id": this.model.get('managerid'),
                                "searchname": this.model.get("searchName"),
                                "app": utils.getCurrentApp(),
                                "auto_cancel": 90,
                                "status_buckets": 0,
                                "preview": true,
                                "timeFormat": "%s.%Q",
                                "wait": 0
                            }, { replace: true });
                        }
                    }
                    this.hide();
                },this));
            }
        },

        render: function() {
            var renderModel = {
                _: _
            };
            this.$el.html(PopTartView.prototype.template);
            this.$('.popdown-dialog-body').append($(this.compiledTemplate(renderModel)));
            // ghetto hack to override default padding on poptart ;_;
            this.$('.popdown-dialog-body').removeClass('popdown-dialog-padded');
            $('.flash-messages-placeholder', this.$el).append(this.children.flashMessage.render().el);
            this.toggleEditType(this.workingSettings.get("type"));

            return this;
        },

        template: '\
            <div class="input-editor-body">\
                <ul class="input-editor-type">\
                    <li><a class="edit-text input-editor-toggle" href="#" data-label="text"><i class="icon-text"></i> <%- _("Text").t() %></a></li>\
                    <li><a class="edit-radio input-editor-toggle" href="#" data-label="radio"><i class="icon-boolean"></i> <%- _("Radio").t() %></a></li>\
                    <li><a class="edit-dropdown input-editor-toggle" href="#" data-label="dropdown"><i class="icon-triangle-down-small"></i> <%- _("Dropdown").t() %></a></li>\
                    <li><a class="edit-checkbox input-editor-toggle" href="#" data-label="checkbox"><i class="icon-box-checked"></i> <%- _("Checkbox").t() %></a></li>\
                    <li><a class="edit-multiselect input-editor-toggle" href="#" data-label="multiselect"><i class="icon-triangle-down-small"></i> <%- _("Multiselect").t() %></a></li>\
                    <li><a class="edit-trp input-editor-toggle" href="#" data-label="time"><i class="icon-clock"></i> <%- _("Time").t() %></a></li>\
                </ul>\
                <div class="input-editor-format"></div>\
                <div class="flash-messages-placeholder"></div>\
            </div>\
            <a class="input-editor-cancel btn pull-left" tabindex="0">'+_("Cancel").t()+'</a>\
            <a class="input-editor-apply btn btn-primary pull-right" tabindex="0"> '+_("Apply").t()+'</a>\
        '

    });

    // Controls Config

    var _LABEL_CONTROL = {
        label: _("Label").t(),
        controlType: "Text",
        controlOptions: {
            modelAttribute: "label"
        }
    };

    var _SEARCH_ON_CHANGE_CONTROL = {
        label: _("Search on Change").t(),
        controlType: "SyntheticCheckbox",
        controlOptions: {
            modelAttribute: "searchWhenChanged"
        },
        className: 'editcheckbox'
    };

    var _TOKEN_CONTROL = {
        label: _("Token").t(),
        controlType: "Text",
        controlOptions: {
            modelAttribute: "token"
        },
        tooltip: _("ID to reference the selected value in search (reference as $token$)").t()
    };

    var _DEFAULT_CONTROL_TEXT = {
        label: _("Default").t(),
        controlType: "Text",
        controlOptions: {
            modelAttribute: "default"
        },
        tooltip: _("The default value of the input.").t()
    };

    var _DEFAULT_CONTROL_RADIO = {
        label: _("Default").t(),
        controlTypeClass: DefaultControl,
        inputTypeClass: RadioInput,
        enableClearSelection: true,
        controlOptions: {
            modelAttribute: "default"
        },
        tooltip: _("The default value of the input.").t()
    };

    var _DEFAULT_CONTROL_DROPDOWN = {
        label: _("Default").t(),
        controlTypeClass: DefaultControl,
        inputTypeClass: DropdownInput,
        enableClearSelection: true,
        controlOptions: {
            modelAttribute: "default"
        },
        tooltip: _("The default value of the input.").t()
    };

    var _DEFAULT_CONTROL_CHECKBOX = {
        label: _("Default").t(),
        controlTypeClass: DefaultControl,
        inputTypeClass: CheckboxInput,
        controlOptions: {
            modelAttribute: "default"
        },
        tooltip: _("The default value of the input.").t(),
        className: 'editcheckbox'
    };

    var _DEFAULT_CONTROL_MULTISELECT = {
        label: _("Default").t(),
        controlTypeClass: DefaultControl,
        inputTypeClass: MultiselectInput,
        controlOptions: {
            modelAttribute: "default"
        },
        tooltip: _("The default value of the input.").t()
    };

    var _DEFAULT_CONTROL_TIME = {
        label: _("Default").t(),
        controlTypeClass: DefaultControl,
        inputTypeClass: TimeInput,
        controlOptions: {
            modelAttribute: "default",
            popdownOptions: {
                attachDialogTo: '.popdown-dialog.open',
                scrollContainer: '.popdown-dialog.open .concertina-body'
            }
        },
        tooltip: _("The default value of the input.").t()
    };

    var _SEED_CONTROL = {
        label: _("Seed").t(),
        controlType: "Text",
        controlOptions: {
            modelAttribute: "seed"
        },
        tooltip: _("Initial value on page load. Ignored when Default is specified.").t()
    };

    var _TOKEN_PREFIX_CONTROL = {
        label: _("Token Prefix").t(),
        controlType: "Text",
        controlOptions: {
            modelAttribute: "prefix",
            updateOnKeyUp: true
        },
        tooltip: _("String prefixed to the value retrieved by the token").t()
    };

    var _TOKEN_SUFFIX_CONTROL = {
        label: _("Token Suffix").t(),
        controlType: "Text",
        controlOptions: {
            modelAttribute: "suffix",
            updateOnKeyUp: true
        },
        tooltip: _("String appended to the value retrieved by the token").t()
    };

    var _TOKEN_VALUE_PREFIX_CONTROL = {
        label: _("Token Value Prefix").t(),
        controlType: "Text",
        controlOptions: {
            modelAttribute: "valuePrefix",
            updateOnKeyUp: true
        },
        tooltip: _("String prefixed to each specified value of a multiple selection input").t()
    };

    var _TOKEN_VALUE_SUFFIX_CONTROL = {
        label: _("Token Value Suffix").t(),
        controlType: "Text",
        controlOptions: {
            modelAttribute: "valueSuffix",
            updateOnKeyUp: true
        },
        tooltip: _("String appended to each specified value of a multiple selection input").t()
    };

    var _DELIMITER_CONTROL = {
        label: _("Delimiter").t(),
        controlType: "Text",
        controlOptions: {
            modelAttribute: "delimiter",
            trimLeadingSpace: false,
            trimTrailingSpace: false,
            updateOnKeyUp: true
        },
        tooltip: _("String inserted between each value (typical values: AND,OR). Specify a leading and trailing space in the string.").t()
    };

    var _PREVIEW_CONTROL = {
        label: _("Preview").t(),
        controlTypeClass: TokenPreviewControl,
        controlOptions: {
            modelAttribute: "TEMP"
        }
    };

    var _STATIC_CONTROL = {
        controlTypeClass: StaticOptionsControl,
        controlOptions: {
            modelAttribute: "choices"
        }
    };

    var _DYNAMIC_CONTROL = {
        controlTypeClass: DynamicOptionsControl,
        controlOptions: {
            modelAttribute: "TEMP"
        }
    };

    var _FIELD_FOR_LABEL_CONTROL = {
        label: _("Field For Label").t(),
        controlType: "Text",
        controlOptions: {
            modelAttribute: "labelField"
        },
        tooltip: _("Field returned from the search to use as the option label").t()
    };

    var _FIELD_FOR_VALUE_CONTROL = {
        label: _("Field For Value").t(),
        controlType: "Text",
        controlOptions: {
            modelAttribute: "valueField"
        },
        tooltip: _("Field returned from the search to use as the option value").t()
    };

    // Options Config

    var _GENERAL_OPTIONS = {
        headingClassName: "general-input-settings",
        title: _("General").t(),
        controls: [
            _LABEL_CONTROL,
            _SEARCH_ON_CHANGE_CONTROL
        ]
    };

    var _TOKEN_OPTIONS_TEXT = {
        headingClassName: "token-input-settings",
        title: _("Token Options").t(),
        controls: [
            _TOKEN_CONTROL,
            _DEFAULT_CONTROL_TEXT,
            _SEED_CONTROL,
            _TOKEN_PREFIX_CONTROL,
            _TOKEN_SUFFIX_CONTROL
        ]
    };

    var _TOKEN_OPTIONS_RADIO = {
        headingClassName: "token-input-settings",
        title: _("Token Options").t(),
        controls: [
            _TOKEN_CONTROL,
            _DEFAULT_CONTROL_RADIO,
            _TOKEN_PREFIX_CONTROL,
            _TOKEN_SUFFIX_CONTROL
        ]
    };

    var _TOKEN_OPTIONS_DROPDOWN = {
        headingClassName: "token-input-settings",
        title: _("Token Options").t(),
        controls: [
            _TOKEN_CONTROL,
            _DEFAULT_CONTROL_DROPDOWN,
            _TOKEN_PREFIX_CONTROL,
            _TOKEN_SUFFIX_CONTROL
        ]
    };

    var _TOKEN_OPTIONS_CHECKBOX = {
        headingClassName: "token-input-settings",
        title: _("Token Options").t(),
        controls: [
            _TOKEN_CONTROL,
            _DEFAULT_CONTROL_CHECKBOX,
            _TOKEN_PREFIX_CONTROL,
            _TOKEN_SUFFIX_CONTROL,
            _TOKEN_VALUE_PREFIX_CONTROL,
            _TOKEN_VALUE_SUFFIX_CONTROL,
            _DELIMITER_CONTROL,
            _PREVIEW_CONTROL
        ]
    };

    var _TOKEN_OPTIONS_MULTISELECT = {
        headingClassName: "token-input-settings",
        title: _("Token Options").t(),
        controls: [
            _TOKEN_CONTROL,
            _DEFAULT_CONTROL_MULTISELECT,
            _TOKEN_PREFIX_CONTROL,
            _TOKEN_SUFFIX_CONTROL,
            _TOKEN_VALUE_PREFIX_CONTROL,
            _TOKEN_VALUE_SUFFIX_CONTROL,
            _DELIMITER_CONTROL,
            _PREVIEW_CONTROL
        ]
    };

    var _TOKEN_OPTIONS_TIME = {
        headingClassName: "token-input-settings",
        title: _("Token Options").t(),
        controls: [
            _TOKEN_CONTROL,
            _DEFAULT_CONTROL_TIME
        ]
    };

    var _STATIC_OPTIONS = {
        headingClassName: "static-input-settings",
        title: _("Static Options").t(),
        controls: [
            _STATIC_CONTROL
        ]
    };

    var _DYNAMIC_OPTIONS = {
        headingClassName: "dynamic-input-settings",
        title: _("Dynamic Options").t(),
        controls: [
            _DYNAMIC_CONTROL,
            _FIELD_FOR_LABEL_CONTROL,
            _FIELD_FOR_VALUE_CONTROL
        ]
    };

    // Options Map

    var _INPUT_OPTIONS_MAP = {

        "text": [
            _GENERAL_OPTIONS,
            _TOKEN_OPTIONS_TEXT
        ],

        "radio": [
            _GENERAL_OPTIONS,
            _TOKEN_OPTIONS_RADIO,
            _STATIC_OPTIONS,
            _DYNAMIC_OPTIONS
        ],

        "dropdown": [
            _GENERAL_OPTIONS,
            _TOKEN_OPTIONS_DROPDOWN,
            _STATIC_OPTIONS,
            _DYNAMIC_OPTIONS
        ],

        "checkbox": [
            _GENERAL_OPTIONS,
            _TOKEN_OPTIONS_CHECKBOX,
            _STATIC_OPTIONS,
            _DYNAMIC_OPTIONS
        ],

        "multiselect": [
            _GENERAL_OPTIONS,
            _TOKEN_OPTIONS_MULTISELECT,
            _STATIC_OPTIONS,
            _DYNAMIC_OPTIONS
        ],

        "time": [
            _GENERAL_OPTIONS,
            _TOKEN_OPTIONS_TIME
        ]

    };

    return EditInputMenuView;

});

define('splunkjs/mvc/simpleform/edit/menu',['require','exports','module','underscore','jquery','views/shared/dialogs/TextDialog','views/Base','../../simplexml/controller','splunk.util','./editinputmenu'],function(require, exports, module) {
    var _ = require('underscore');
    var $ = require('jquery');
    var TextDialog = require('views/shared/dialogs/TextDialog');
    var BaseView = require('views/Base');
    var Dashboard = require('../../simplexml/controller');
    var SplunkUtil = require('splunk.util');
    var EditInputMenu = require('./editinputmenu');

    var MenuView = BaseView.extend({
        events: {
            'click a.edit-input': function(e) {
                e.preventDefault();

                var $target = $(e.currentTarget);
                if (this.editInputMenu && this.editInputMenu.shown) {
                    this.editInputMenu.hide();
                    return;
                }

                $target.addClass('active');

                this.editInputMenu = new EditInputMenu({
                    model: this.model,
                    onHiddenRemove: true
                });

                $('body').append(this.editInputMenu.render().el);

                this.editInputMenu.show($target);
                this.editInputMenu.on('hide', function() {
                    $target.removeClass('active');
                }, this);
            },
            'click a.delete-input': function(e) {
                e.preventDefault();

                var dialog = new TextDialog({
                    id: "modal_delete",
                    flashModel: Dashboard.model.view
                });

                var model = this.model;
                dialog.on('click:primaryButton', function() {
                    dialog.preventDefault();
                    model.destroy().then(function(){
                        dialog.closeDialog();
                    });
                });

                dialog.settings.set("primaryButtonLabel", _("Delete").t());
                dialog.settings.set("cancelButtonLabel", _("Cancel").t());
                dialog.settings.set("titleLabel", _("Delete").t());

                var label = $.trim(this.model.get('label')) || SplunkUtil.sprintf(_('the %s input').t(), _(this.model.get('type')).t());
                dialog.setText(SplunkUtil.sprintf(
                    _("Are you sure you want to delete %s?").t(), '<em>' + _.escape(label) + '</em>'));

                $("body").append(dialog.render().el);
                dialog.show();
            }
        },
        render: function() {
            this.$el.html(this.template);
            return this;
        },
        template: '<div class="edit-dropdown">' +
            '<a href="#" class="edit-input" title="' + _("Edit Input").t() + '"><i class="icon-pencil"></i></a>' +
            '<a href="#" class="delete-input" title="' + _("Delete Input").t() + '"><i class="icon-x"></i></a>' +
            '</div>'
    });
    return MenuView;
});
define('splunkjs/mvc/simpleform/input/base',['require','underscore','jquery','../../basesplunkview','../inputsettings','../../utils','../../simplexml/controller','../edit/menu','splunkjs/mvc','util/console','splunkjs/mvc/tokenutils','../../savedsearchmanager','../formutils'],function(require) {
    var _ = require('underscore');
    var $ = require('jquery');
    var BaseSplunkView = require('../../basesplunkview');
    var Settings = require('../inputsettings');
    var utils = require('../../utils');
    var Dashboard = require('../../simplexml/controller');
    var EditMenu = require('../edit/menu');
    var mvc = require('splunkjs/mvc');
    var console = require('util/console');
    var TokenUtils = require('splunkjs/mvc/tokenutils');
    var SavedSearchManager = require('../../savedsearchmanager');
    var FormUtils = require('../formutils');

    var BaseInput = BaseSplunkView.extend({
        _isDashboardInput: true,
        options: {
            submitOnChange: false
        },
        omitted: ['id', 'name', 'model', 'collection', 'el', 'attributes', 'className', 'tagName', 'events',
            'settingsOptions'],
        initialize: function(options) {
            this.configure();
            if (this.initialVisualization) {
                this.settings.set('type', this.initialVisualization);
            }
            options = options || {};
            this.inputId = options.inputId || _.uniqueId((this.id || 'input') + '_');
            this.settings.set('id', this.id);

            // Update self when settings change
            this._extractTokenName();
            this.listenTo(this.settings, 'change:label', this.renderLabel);
            this.listenTo(this.settings, 'change:token change:type', this._applyTokenName);
            this.listenTo(this.settings, 'change:type', this._updateType);
            this.listenToOnce(this.settings, 'removeInput', this.remove);
            this.listenTo(Dashboard.getStateModel(), 'change:edit', this.onEditModeChange);
            this.bindToComponent(this.settings.get('managerid'), this.onManagerChange, this);
        },
        configure: function() {
            BaseSplunkView.prototype.configure.apply(this, arguments);
            var filteredSettings = this.settings.toJSON({tokens: true});
            this.settings = new Settings(filteredSettings, this.options.settingsOptions);
            return this;
        },
        onManagerChange: function(managers, manager) {
            if (manager instanceof SavedSearchManager) {
                this.settings.set({
                    searchName: manager.get('searchname'),
                    searchType: 'saved'
                }, {tokens: true});
            } else if (manager) {
                this.settings.set({
                    searchType: 'inline',
                    search: manager.get('search', {tokens: true}),
                    earliest_time: manager.get('earliest_time', {tokens: true}),
                    latest_time: manager.get('latest_time', {tokens: true})
                }, {tokens: true});
            }
        },
        _updateType: function() {
            this._removeVisualization();

            var type = this.settings.get('type') || this.initialVisualization;
            var Input = FormUtils.getInputType(type);
            console.log('Creating input of type=%o class=%o', type, Input);

            if (!Input) {
                this.trigger("typenotfound", type);
                return;
            }

            this._bindVizSettings();
            var options = this.vizSettings.toJSON({tokens: true});
            options['settings'] = this.vizSettings;
            options['id'] = this.inputId;

            var viz = this.visualization = new Input(options);
            viz.render().$el.appendTo(this.$el);
            this.listenTo(viz, 'all', this.trigger, this);
            this.trigger('create:visualization', viz);
            _.defer(_.bind(function(){
                this.trigger('change', this.visualization.val(), this.visualization);
            }, this));
        },
        _onReady: function() {
            var dfd = $.Deferred();
            var onVizReady = function(viz) {
                viz._onReady(function() {
                    dfd.resolve();
                });
            };
            if (this.visualization) {
                onVizReady(this.visualization);
            } else {
                this.listenToOnce('create:visualization', onVizReady);
            }
            return dfd.promise();
        },
        _bindVizSettings: function() {
            this.vizSettings = new Settings(_.omit(this.options, this.omitted), this.options.settingsOptions);
            this.vizSettings.id = this.inputId;
            this.settings._sync = utils.syncModels(this.settings, this.vizSettings, {
                auto: true,
                exclude: this.omitted.concat(['value', 'earliest_time', 'latest_time'])
            });
        },
        _unbindVizSettings: function() {
            if (this.settings._sync) {
                this.settings._sync.destroy();
                this.settings._sync = null;
            }
            if (this.vizSettings) {
                this.vizSettings.dispose();
                this.vizSettings = null;
            }
        },
        _extractTokenName: function() {
            var type = this.settings.get('type');
            // helper to extract name from actual form token
            var getTokenPart = function(str, prefix, suffix) {
                if (str.indexOf(prefix) === 0) {
                    if (suffix && str.slice(-(suffix.length)) === suffix) {
                        return str.substring(prefix.length, str.length - suffix.length);
                    } else {
                        return str.substring(prefix.length);
                    }
                }
                return null;
            };
            if (type !== 'time') {
                var value = this.settings.get('value', { tokens: true });
                if (TokenUtils.isToken(value)) {
                    var token = getTokenPart(TokenUtils.getTokenName(value), 'form.');
                    if (token) {
                        this.settings.set('token', token);
                    }
                }
            } else {
                var et = this.settings.get('earliest_time', { tokens: true});
                var lt = this.settings.get('latest_time', { tokens: true});
                if (TokenUtils.isToken(et) && TokenUtils.isToken(lt)) {
                    et = getTokenPart(TokenUtils.getTokenName(et), 'form.', '.earliest');
                    lt = getTokenPart(TokenUtils.getTokenName(lt), 'form.', '.latest');
                    if (et && lt && et === lt) {
                        this.settings.set('token', et);
                    }
                }
            }
        },
        _applyTokenName: function() {
            var type = this.settings.get('type');
            var tokenName = this.settings.get('token');
            if (type === 'time') {
                this.settings.unset('value', { tokens: true });
                var newSettings = {};
                newSettings['earliest_time'] = tokenName ? '$form.' + tokenName + '.earliest$' : '$earliest$';
                newSettings['latest_time'] = tokenName ? '$form.' + tokenName + '.latest$' : '$latest$';
                this.settings.set(newSettings, { tokens: true });
            } else {
                this.settings.set({ earliest_time: null, latest_time: null }, { unset: true, tokens: true });
                this.settings.set('value', '$form.' + tokenName + '$', { tokens: true });
            }
        },
        remove: function() {
            this._removeEditMenu();
            this._removeVisualization();
            var parent = this.$el.parent();
            BaseSplunkView.prototype.remove.call(this);
            parent.trigger('itemRemoved');
        },
        _removeVisualization: function() {
            this._unbindVizSettings();
            if (this.visualization) {
                this.stopListening(this.visualization);
                this.visualization.off();
                // Remove will revoke it from the registry
                this.visualization.remove();
                this.visualization = null;
            }
        },
        _createEditMenu: function() {
            return new EditMenu({ model: this.settings });
        },
        _removeEditMenu: function() {
            if (this.editMenu) {
                this.editMenu.remove();
                this.editMenu = null;
            }
        },
        onEditModeChange: function() {
            this.$('.drag-handle').remove();
            if (Dashboard.getStateModel().get('edit')) {
                $('<div class="drag-handle"></div>').prependTo(this.$el);
                if (!this.editMenu) {
                    this.editMenu = this._createEditMenu().render().prependTo(this.$el);
                }
            } else {
                this._removeEditMenu();
            }
        },
        renderLabel: function() {
            var label = this.$el.children('label');
            if (!label.length) {
                label = $('<label></label>').appendTo(this.el);
            }
            label.attr('for', this.inputId);
            if (this.settings.has('label')) {
                label.html(_.escape(this.settings.get('label')) || '&nbsp;');
            } else {
                var v = label.text();
                if (v) {
                    this.settings.set('label', v);
                }
            }
        },
        hasValue: function() {
            return this.visualization ? this.visualization._hasValueForDashboards() : false;
        },
        // For API compatibility with MVC controls.
        val: function(newValue) {
            // NOTE: Ignore parameters beyond the first one.
            if (this.visualization) {
                return this.visualization.val.apply(this.visualization, arguments);
            }
        },
        render: function() {
            this.renderLabel();
            this._updateType();
            this.onEditModeChange();
            return this;
        }
    });

    return BaseInput;
});

define('splunkjs/mvc/simpleform/input/submit',['require','underscore','jquery','../../basesplunkview','../../simplexml/controller','../formutils'],function(require) {
    var _ = require('underscore');
    var $ = require('jquery');
    var BaseSplunkView = require('../../basesplunkview');
    var Dashboard = require('../../simplexml/controller');
    var FormUtils = require('../formutils');

    var SubmitButton = BaseSplunkView.extend({
        className: 'splunk-submit-button form-submit',
        options: {
            text: _('Submit').t(),
            useIcon: false
        },
        events: {
            'click button': function(e) {
                e.preventDefault();
                if (!this.$('button').is('.disabled')) {
                    this.trigger('submit', this);
                }
            },
            'click .delete-input': function(e) {
                e.preventDefault();
                Dashboard.model.view.updateFormSettings({ submitButton: false }).done(_.bind(this.remove, this));
            }
        },
        initialize: function() {
            this.configure();
            this.listenTo(this.settings, 'change', this.render);
            this.listenTo(Dashboard.getStateModel(), 'change:edit', this.onEditModeChange);
            var settings = this.settings;
            settings.set('formReady', FormUtils.isFormReady());
            _.defer(function() {
                FormUtils.onFormReady().then(function() {
                    settings.set('formReady', true);
                });
            });
            this.listenTo(settings, 'change', this.render);
        },
        onEditModeChange: function(){
            this.$('.edit-dropdown').remove();
            if (Dashboard.isEditMode()) {
                var el = $('<div class="edit-dropdown"><a href="#" class="delete-input"><i class="icon-x"/></a></div>');
                el.find('.delete-input').attr('title', _('Delete submit button').t());
                el.prependTo(this.el);
            }
        },
        render: function() {
            var button = this.$('button');
            if (!button.length) {
                button = $('<button class="btn btn-primary"></button>').appendTo(this.el);
            }
            if (this.settings.get('useIcon')) {
                button.html('<i class="icon-search"></i>');
            } else if (this.settings.has('text')) {
                button.text(this.settings.get('text'));
            } else {
                this.settings.set('text', button.text());
            }
            button[this.settings.get('formReady') ? 'removeClass' : 'addClass']('disabled');
            this.onEditModeChange();
            return this;
        }
    });

    return SubmitButton;
});
define('splunkjs/mvc/simpleform/input/timerange',['require','./base','../../timerangeview','../formutils'],function(require) {
    var BaseInput = require('./base');
    var TimeRangeView = require('../../timerangeview');
    var FormUtils = require('../formutils');

    FormUtils.registerInputType('time', TimeRangeView);

    var TimeRangeInput = BaseInput.extend({
        initialVisualization: 'time'
    });

    return TimeRangeInput;
});

define('splunkjs/mvc/simplexml/editdashboard/addformmenu',['require','exports','module','underscore','jquery','util/console','../../../mvc','../controller','../../simpleform/input/base','../../simpleform/input/submit','../../simpleform/input/timerange','views/shared/PopTart','../../simpleform/formutils'],function(require, exports, module) {

    var _ = require('underscore');
    var $ = require('jquery');
    var console = require('util/console');
    var mvc = require('../../../mvc');
    var Dashboard = require('../controller');
    var DashboardInput = require('../../simpleform/input/base');
    var SubmitButton = require('../../simpleform/input/submit');
    var TimeRangePickerInput = require('../../simpleform/input/timerange');
    var PopTartView = require('views/shared/PopTart');
    var FormUtils = require('../../simpleform/formutils');

    var AddFormMenuView = PopTartView.extend({

        moduleId: module.id,
        className: 'dropdown-menu',

        initialize: function() {
            PopTartView.prototype.initialize.apply(this, arguments);
            this.listenTo(mvc.Components, 'change:submit', this.render);
        },

        events: {
            'click a.add-text': function(e) {
                e.preventDefault();
                this.hide();
                this.remove();
                addInput("text");
            },
            'click a.add-radio': function(e) {
                e.preventDefault();
                this.hide();
                this.remove();
                addInput("radio");
            },
            'click a.add-dropdown': function(e) {
                e.preventDefault();
                this.hide();
                this.remove();
                addInput("dropdown");
            },
            'click a.add-checkbox': function(e) {
                e.preventDefault();
                this.hide();
                this.remove();
                addInput("checkbox");
            },
            'click a.add-multiselect': function(e) {
                e.preventDefault();
                this.hide();
                this.remove();
                addInput("multiselect");
            },
            'click a.add-trp': function(e) {
                e.preventDefault();
                this.hide();
                this.remove();
                addInput("timerangepicker");
            },
            'click a.add-submit': function(e) {
                e.preventDefault();
                if ($(e.currentTarget).is(".disabled")) {
                    return;
                }
                this.hide();
                this.remove();
                addInput("submit");
            }
        },

        render: function() {
            var fieldset = $('body>.dashboard-body>.fieldset');
            var submitButton = fieldset.find('.form-submit');

            var renderModel = {
                showAddSubmit: !submitButton.length,
                _: _
            };

            var html = this.compiledTemplate(renderModel);
            this.$el.html(PopTartView.prototype.template_menu);
            this.$el.append(html);

            return this;
        },

        template: '\
            <ul>\
                <li><a class="add-text" href="#"><i class="icon-text"></i> <%- _("Text").t() %></a></li>\
                <li><a class="add-radio" href="#"><i class="icon-boolean"></i> <%- _("Radio").t() %></a></li>\
                <li><a class="add-dropdown" href="#"><i class="icon-triangle-down-small"></i> <%- _("Dropdown").t() %></a></li>\
                <li><a class="add-checkbox" href="#"><i class="icon-box-checked"></i> <%- _("Checkbox").t() %></a></li>\
                <li><a class="add-multiselect" href="#"><i class="icon-triangle-down-small"></i> <%- _("Multiselect").t() %></a></li>\
                <li><a class="add-trp" href="#"><i class="icon-clock"></i> <%- _("Time").t() %></a></li>\
                <li>\
                    <% if (showAddSubmit) { %>\
                        <a class="add-submit" href="#">\
                    <% } else {%>\
                        <a class="add-submit disabled" href="#" title="<%- _("You cannot add more than one Submit Button.").t() %>">\
                    <% } %>\
                    <i class="icon-search"></i> <%- _("Submit").t() %></a>\
                </li>\
            </ul>\
        '

    });

    var getNextFieldId = function() {
        // Get max N for all fieldN of input IDs or token names
        return _(mvc.Components.toJSON()).chain()
            .filter(FormUtils.isFormInput)
            .map(function(component) { return [component.id, component.settings.get('token')]; })
            .flatten()
            .filter(function(id) { return id && /^field\d+$/.test(id); })
            .map(function(id) { return parseInt(id.slice('field'.length), 10); })
            .push(0)
            .max()
            .value();
    };

    // TODO: move the logic in these functions to controller

    var addInput = function(type) {
        var $inputEl;
        var fieldset = $('body>.dashboard-body>.fieldset');

        // add submit button at the end
        if (type === "submit") {
            $inputEl = $('<div></div>');
            $inputEl.appendTo(fieldset);
        // add other inputs before time range picker or submit button, if they exist
        } else {
            $inputEl = $(_.template('<div class="input input-<%- type %>"><label>&nbsp;</label></div>', { type: type }));
            var submitButton = fieldset.find('.form-submit');
            if (submitButton.length) {
                $inputEl.insertBefore(submitButton);
            } else {
                $inputEl.appendTo(fieldset);
            }
        }

        // Avoid ID or token collisions with other elements
        var seq = (getNextFieldId() || 0) + 1, id;
        do {
            id = 'field' + (seq++);
        } while(mvc.Components.has(id));

        if (type === "submit") {
            addInputSubmit(id, $inputEl);
        } else if (type === "timerangepicker") {
            addInputTime(id, $inputEl);
        } else {
            addInputByType(type, id, $inputEl);
        }

        Dashboard.trigger('formupdate');
    };

    var addInputSubmit = function(id, $inputEl) {
        var input = new SubmitButton({
            id: 'search_btn',
            el: $inputEl
        }, {tokens: true}).render();

        input.on("submit", function() {
            FormUtils.submitForm();
        });

        Dashboard.model.view.updateFormSettings({ submitButton: true }).fail(function(){
            input.remove();
        });
    };

    var addInputTime = function(id, $inputEl) {
        var input = new TimeRangePickerInput({
            id: id,
            el: $inputEl,
            earliest_time: "$form." + id + ".earliest$",
            latest_time: "$form." + id + ".latest$",
            "default": {
                earliest_time: '0',
                latest_time: ''
            }
        }, {tokens: true}).render();

        input.on('change', function() {
            FormUtils.handleValueChange(input);
        });

        Dashboard.trigger("addInput", input.settings);
    };

    var addInputByType = function(type, id, $inputEl) {
        var vizSpecificOptions;
        var vizSettings = FormUtils.getInputType(type);
        if(vizSettings.multiValue) {
            vizSpecificOptions = {
                valuePrefix: '',
                valueSuffix: '',
                delimiter: ' '
            };
        }
        var input = new DashboardInput(_.extend({
            type: type,
            id: id,
            el: $inputEl,
            label: id,
            value: "$form." + id + "$"
        }, vizSpecificOptions), {tokens: true}).render();

        input.on('change', function() {
            FormUtils.handleValueChange(input);
        });

        Dashboard.trigger("addInput", input.settings);
    };

    return AddFormMenuView;

});

define('splunkjs/mvc/simplexml/editdashboard/menuview',['require','exports','module','underscore','jquery','views/Base','../dialog/addpanel','util/pdf_utils','../controller','util/console','../../../mvc','../../utils','uri/route','./editmenu','./moreinfomenu','./addformmenu','helpers/Printer'],function(require, exports, module) {
    var _ = require('underscore');
    var $ = require('jquery');
    var BaseView = require('views/Base');
    var AddPanelDialog = require('../dialog/addpanel');
    var pdfUtils = require('util/pdf_utils');
    var Dashboard = require('../controller');
    var console = require('util/console');
    var mvc = require('../../../mvc');
    var utils = require('../../utils');
    var route = require('uri/route');
    var EditMenu = require('./editmenu');
    var MoreInfoMenu = require('./moreinfomenu');
    var AddFormMenu = require('./addformmenu');
    var Printer = require('helpers/Printer');

    var MenuView = BaseView.extend({
        moduleId: module.id,
        className: 'edit-menu',
        initialize: function() {
            BaseView.prototype.initialize.apply(this, arguments);
            this.model.state.on('change:edit', this.onEditModeChange, this);
            this.model.state.on('change:editable change:pdf_available', this.render, this);
            this.model.state.user.on("change", this.render, this);
        },
        events: {
            'click a.edit-btn': function(e) {
                e.preventDefault();
                var $target = $(e.currentTarget);
                if (this.children.editMenu && this.children.editMenu.shown) {
                    this.children.editMenu.hide();
                    return;
                }
                if (this.children.moreInfoMenu && this.children.moreInfoMenu.shown) {
                    this.children.moreInfoMenu.hide();
                }
                $target.addClass('active');

                this.children.editMenu = new EditMenu({
                    model: {
                        application: this.model.application,
                        dashboard: this.model.dashboard,
                        state: this.model.state, 
                        scheduledView: this.model.scheduledView
                    },
                    collection: this.collection,
                    showOpenActions: this.options.showOpenActions,
                    deleteRedirect: this.options.deleteRedirect,
                    onHiddenRemove: true
                });
                $('body').append(this.children.editMenu.render().el);
                this.children.editMenu.show($target);
                this.children.editMenu.on('hide', function() {
                    $target.removeClass('active');
                }, this);
            },
            'click a.more-info-btn': function(e) {
                e.preventDefault();
                var $target = $(e.currentTarget);
                if (this.children.moreInfoMenu && this.children.moreInfoMenu.shown) {
                    this.children.moreInfoMenu.hide();
                    return;
                }
                if (this.children.editMenu && this.children.editMenu.shown) {
                    this.children.editMenu.hide();
                }
                $target.addClass('active');
                this.children.moreInfoMenu= new MoreInfoMenu({
                    model: {
                        application: this.model.application,
                        dashboard: this.model.dashboard,
                        state: this.model.state,
                        scheduledView: this.model.scheduledView
                    },
                    collection: this.collection,
                    onHiddenRemove: true
                });
                
                $('body').append(this.children.moreInfoMenu.render().el);
                this.children.moreInfoMenu.show($target);
                this.children.moreInfoMenu.on('hide', function() {
                    $target.removeClass('active');
                }, this);
            },
            'click a.edit-done': function(e){
                e.preventDefault();
                this.model.state.set('edit', false);
            },
            'click a.add-form': function(e) {
                e.preventDefault();
                var $target = $(e.currentTarget);
                if ($target.hasClass('disabled')) {
                    return;
                }
                if (this.children.addFormMenu && this.children.addFormMenu.shown) {
                    this.children.addFormMenu.hide();
                    return;
                }
                $target.addClass('active');

                this.children.addFormMenu = new AddFormMenu({
                    model: {
                        application: this.model.application,
                        dashboard: this.model.dashboard,
                        state: this.model.state,
                        scheduledView: this.model.scheduledView
                    },
                    collection: this.collection,
                    onHiddenRemove: true
                });
                $('body').append(this.children.addFormMenu.render().el);
                this.children.addFormMenu.show($target);
                this.children.addFormMenu.on('hide', function() {
                    $target.removeClass('active');
                }, this);
            },
            'click a.add-panel': function(e) {
                e.preventDefault();
                this.children.addPanelDialog = new AddPanelDialog({
                    controller: this.options.controller
                });
                this.children.addPanelDialog.render().appendTo($("body")).show();
            },
            'click a.print-dashboard': function(e){
                e.preventDefault();
                Printer.printPage();
            },
            'click a.generate-pdf': function(e){
                e.preventDefault();
                var view = this.model.dashboard.entry.get('name'),
                    app = this.model.dashboard.entry.acl.get('app'),
                    params = {}, idx = 0;

                // Collect SIDs for search jobs on the dashboard
                _.map(mvc.Components.get('dashboard').getElementIds(), function(id){
                    var element = mvc.Components.get(id);
                    if(element && element.getExportParams) {
                        _.extend(params, element.getExportParams('sid_'+idx));
                    }
                    idx++;
                });

                pdfUtils.isPdfServiceAvailable().done(function(available, type){
                    if(type === 'pdfgen') {
                        var xml = Dashboard.model.view.getFlattenedXML({
                            useLoadjob: false,
                            indent: false,
                            pdf: true
                        });
                        if(console.DEBUG_ENABLED) {
                            console.log(xml);
                        }
                        pdfUtils.downloadReportFromXML(xml, app, params);
                    } else if(type === 'deprecated') {
                        pdfUtils.getRenderURL(view, app, params).done(function(url){
                            window.open(url);
                        });
                    }
                });
            }
        },
        onEditModeChange: function() {
            var edit = this.model.state.get('edit');
            this.$('.dashboard-view-controls')[edit ? 'hide' : 'show']();
            this.$('.dashboard-edit-controls')[edit ? 'show' : 'hide']();
            this.setAddInputState();
        },
        setAddInputState: function(){
            var isScheduled = this.model.scheduledView.entry.content.get('is_scheduled');
            if (isScheduled) {
                this.$('.add-form').addClass('disabled').tooltip({ animation:false, placement: 'bottom', title: _("You must unschedule this dashboard to add form fields. To do this, use the \"Schedule PDF Delivery\" link in the edit menu.").t() });
            } else {
                this.$('.add-form').removeClass('disabled').tooltip('destroy');
            }
        },
        render: function() {
            var app = this.model.application.toJSON();
            var renderModel = {
                dashboard: this.model.dashboard.isDashboard(),
                editLinkViewMode: route.manager(app.root, app.locale, app.app, ['data','ui','views', app.page], {
                            data: {
                                action: 'edit',
                                ns: app.app,
                                redirect_override: route.page(app.root, app.locale, app.app, app.page)
                            }
                        }),
                editLinkEditMode: route.manager(app.root, app.locale, app.app, ['data','ui','views', app.page], {
                            data: {
                                action: 'edit',
                                ns: app.app,
                                redirect_override: route.page(app.root, app.locale, app.app, app.page) + '/edit'
                            }
                        }),
                dashboardType: this.model.dashboard.getViewType(),
                editable: this.model.state.get('editable'),
                canWrite: this.model.dashboard.entry.acl.canWrite(),
                removable: this.model.dashboard.entry.links.get('remove') ? true : false,
                isSimpleXML: this.model.dashboard.isSimpleXML(),
                isHTML: this.model.dashboard.isHTML(),
                isPdfServiceAvailable: this.model.state.get('pdf_available'),
                showAddTRP: !this.model.state.get('default_timerange'),
                isScheduled: this.model.scheduledView.entry.content.get('is_scheduled'),
                _: _
            };

            this.$el.html(this.compiledTemplate(renderModel));
            this.setAddInputState();

            this.$('.generate-pdf').tooltip({ animation:false, title: _("Export PDF").t() });
            this.$('.print-dashboard').tooltip({ animation:false, title: _("Print").t() });
            this.onEditModeChange();
            return this;
        },
        template: '\
            <span class="dashboard-view-controls">\
                <% if(canWrite) { %>\
                    <div class="btn-group">\
                        <a class="btn edit-btn" href="#"><%- _("Edit").t() %> <span class="caret"></span></a>\
                        <a class="btn more-info-btn" href="#"><%- _("More Info").t() %> <span class="caret"></span></a>\
                    </div>\
                <% }else{ %>\
                    <div class="btn-group">\
                        <a class="btn edit-btn" href="#"><%- _("Edit").t() %> <span class="caret"></span></a>\
                    </div>\
                <% } %>\
                <div class="btn-group">\
                    <% if(isSimpleXML && isPdfServiceAvailable) { %>\
                        <a class="btn generate-pdf" href="#"><i class="icon-export icon-large"></i></a>\
                    <% } %>\
                    <a class="btn print-dashboard" href="#"><i class="icon-print icon-large"></i></a>\
                </div>\
            </span>\
            <span class="dashboard-edit-controls" style="display:none;">\
                <div class="btn-group">\
                    <a class="btn add-form" href="#"><i class="icon-plus"></i> <%- _("Add Input").t() %> <span class="caret"></span></a>\
                    <a class="btn add-panel" href="#"><i class="icon-plus"></i> <%- _("Add Panel").t() %></a>\
                    <a class="btn edit-source" href="<%- editLinkEditMode %>"><i class="icon-code"></i> <%- _("Edit Source").t() %></a>\
                </div>\
                <a class="btn btn-primary edit-done" href="#"><%- _("Done").t() %></a>\
            </span>\
        '
    });
    
    return MenuView;
}); 

define('splunkjs/mvc/simplexml/editdashboard/master',['require','exports','module','underscore','jquery','views/Base','collections/services/authorization/Roles','./menuview'],function(require, exports, module) {
    var _ = require('underscore');
    var $ = require('jquery');
    var BaseView = require('views/Base');
    var Roles = require('collections/services/authorization/Roles');
    var MenuView = require('./menuview'); 

    return BaseView.extend({
        className: "splunk-dashboard-controls",

        initialize: function() {
            BaseView.prototype.initialize.apply(this, arguments);
            this.rolesCollection = new Roles();
            this.rolesCollection.fetch();

            this.children.menuView = new MenuView({
                model: {
                    state: this.model.state,
                    dashboard: this.model.dashboard,
                    application: this.model.application,
                    scheduledView: this.model.scheduledView
                },
                collection: this.rolesCollection, 
                controller: this.options.controller 
            });
        },
        render: function(){
            this.$el.append(this.children.menuView.render().el);
            return this;
        }
    });
});

define('splunkjs/mvc/simplexml/dragndrop',['require','backbone','underscore','jquery','util/console','./controller'],function(require){
    var Backbone = require('backbone');
    var _ = require('underscore');
    var $ = require('jquery');
    var console = require('util/console');
    var Dashboard = require('./controller');

    var libraryLoaded = $.Deferred(), div = document.createElement('div'),
        supportsHTML5 = (('draggable' in div) || ('ondragstart' in div && 'ondrop' in div)),
        useHTML5 = false, //supportsHTML5 && !/jqueryDD/g.test(window.location),
        SORTABLE = useHTML5 ? 'sortable5' : 'sortable';
    if(useHTML5) {
        console.log('loading html5 sortable');
        require(['splunkjs/contrib/jquery.sortable.html5'], libraryLoaded.resolve);
    } else {
        console.log('loading jquery ui sortable');
        require(['jquery.ui.sortable'], libraryLoaded.resolve);
    }

    return Backbone.View.extend({
        render: function() {
//            Drag&Drop library indicator (for test purposes)
//            this.$('.dashboard-header').append($('<a class="badge badge-info dd-lib-debug" title="Click to switch drag and drop library" href="#"></a>')
//                    .attr('href',(useHTML5 ? '?jqueryDD=1':'?')).text('Drag&Drop: ' + (useHTML5 ? 'HTML5':'jQueryDD')));
            libraryLoaded.done(this.startDragAndDrop.bind(this));
            return this;
        },
        events: {
            'mouseover .drag-handle': function(e){
                $(e.target).parents('.dashboard-panel').addClass('drag-hover');
            },
            'mouseout .drag-handle': function(e){
                $(e.target).parents('.dashboard-panel').removeClass('drag-hover');
            }
        },
        startDragAndDrop: function() {
            this.$el.addClass('dragndrop-enabled');
            _.defer(_.bind(function(){
                this.enablePanelDragAndDrop();
                this.enableInputDragAndDrop();
            }, this));
        },
        enablePanelDragAndDrop: function() {
            var that = this;
            var sortable, updateDims = _.debounce(that.updateDimensions.bind(this), 0),
                enableDragAndDrop = _(this.enablePanelDragAndDrop).bind(this),
                onEnd = _.once(function(){
                    console.log('sort STOP');
                    if(sortable) {
                        try {
                            sortable[SORTABLE]('destroy');
                        } catch(e){}
                        _.defer(enableDragAndDrop);
                        that.cleanupEmptyRows();
                        that.trigger('sortupdate');
                        sortable = null;
                        $(window).trigger('resize');
                        that.$('.dashboard-row').trigger('panelVisibilityChanged');
                    }
                });
            this.createNewDropRow();
            sortable = this.$('.dashboard-row')[ SORTABLE ]({
                    handle: '.drag-handle',
                    connectWith: this.$('.dashboard-row'),
                    placeholder: {
                        element: function(){
                            return $('<div class="sortable-placeholder"><div class="dashboard-panel"></div></div>');
                        },
                        update: function(ct, p) {
                            that.updateRow(p.parents('.dashboard-row'));
                        }
                    },
                    tolerance: "pointer"
                }).on('sort', function(e){
                    updateDims();
                }).on('sortupdate', function(e){
                    onEnd();
                }).on('stop', function(e){
                    onEnd();
                });
            updateDims();
            $(window).trigger('resize');
        },
        enableInputDragAndDrop: function(){
            var that = this;
            var sortable;
            var onEnd = _.once(function(){
                if(sortable) {
                    try {
                        sortable[SORTABLE]('destroy');
                    } catch(e){}
                    _.defer(function(){
                        that.enableInputDragAndDrop();
                    });
                    that.trigger('sortupdate');
                    sortable = null;
                }
            });
            sortable = this.$('.fieldset')[ SORTABLE ]({
                handle: '.drag-handle',
                connectWith: this.$('.fieldset'),
                items: '>.input',
                tolerance: "pointer",
                placeholder: {
                    element: function(cur) {
                        var el = $('<div class="input ui-sortable-placeholder"><div class="placeholder-inner"></div></div>');
                        // Adjust height of the placeholder element to roughly match the size of the input being moved
                        var height = cur.height();
                        el.height(height-5);
                        el.children().height(height - 15);
                        return el[0];
                    },
                    update: function() {
                    }
                },
                start: function() {
                    $('.dashboard-body').addClass('form-drag');
                    $('#search_btn').hide();
                },
                stop: function() {
                    $('.dashboard-body').removeClass('form-drag');
                    var submitButton = $('#search_btn');
                    if (submitButton.length) {
                        submitButton.appendTo(submitButton.parent()).show();
                    }
                    Dashboard.trigger('formupdate');
                }
            }).on('sortupdate', onEnd).on('stop', onEnd);
        },
        destroy: function() {
            this.$el.removeClass('dragndrop-enabled');
            this.cleanupEmptyRows();
            try {
                this.$('.dashboard-row')[SORTABLE]('destroy');
                this.$('.fieldset')[SORTABLE]('destroy');
            } catch(e){}
            this.updateDimensions();
        },
        updateRow: function(r) {
            var els = $(r).children().not('.ui-sortable-helper'), w = String(Math.floor(10000/(els.not('.sortable-dragging').length))/100)+'%';
            els.css({ width: w });
            var items = $(r).find('.dashboard-panel');
            items.css({ 'min-height': 100 }).css({ 'min-height': _.max(_.map(items, function(i){ return $(i).height(); })) });
        },
        updateDimensions: function() {
            _(this.$('.dashboard-row')).each(this.updateRow);
        },
        createNewDropRow: function() {
            this.cleanupEmptyRows();
            this.$('.dashboard-row').after($('<div class="dashboard-row empty"></div>'));
            this.$('.dashboard-row').first().before($('<div class="dashboard-row empty"></div>'));
        },
        cleanupEmptyRows: function() {
            // console.log('removing empty rows');
            this.$('.dashboard-row').each(function(){
                var r = $(this);
                if(r.is(':empty') || r.html().match(/^\s+$/)) {
                    r.remove();
                }
            });
            this.$('.dashboard-row.empty').removeClass('empty');
        },
        getItemOrder: function() {
            return _(this.$('.dashboard-row')).map(function(row){
                return _($(row).find('.dashboard-panel')).map(function(panel){
                    return _($(panel).find('.dashboard-element')).map(function(element){
                        return $(element).attr('id');
                    });
                });
            });
        }
    });

});
define('splunkjs/mvc/simpleform/fieldsetview',['require','exports','module','underscore','jquery','views/Base','../simplexml/controller'],function(require, module){
    var _ = require('underscore'),
        $ = require('jquery'),
        BaseView = require('views/Base'),
        Dashboard = require('../simplexml/controller');

    return BaseView.extend({
        moduleId: module.id,
        className: 'fieldset',
        initialize: function() {
            this.listenTo(Dashboard, 'formupdate', this.render);
            this.listenTo(Dashboard.model, 'change:edit change:rootNodeName', this.render);
            BaseView.prototype.initialize.apply(this, arguments);
        },
        isEmpty: function(){
            return !$.trim(this.$el.html());
        },
        render: function() {
            if(Dashboard.isEditMode() || !_.all(this.$el.find('.input>label'), function(label) {
                return !$.trim($(label).text());
            })) {
                this.$el.removeClass('hide-label');
            } else {
                this.$el.addClass('hide-label');
            }
            var rootNodeName = Dashboard.model.get('rootNodeName');
            if (rootNodeName != null && rootNodeName !== 'form') {
                this.$el.hide();
            } else {
                this.$el.show();
            }
            return this;
        }
    });
});
define('splunkjs/mvc/simplexml/dashboard/title',['require','underscore','jquery','backbone'],function(require) {
    var _ = require('underscore'),
            $ = require('jquery'),
            Backbone = require('backbone');

    var DashboardTitle = Backbone.View.extend({
        initialize: function() {
            this.model.on('change:edit change:label', this.render, this);
        },
        render: function() {
            if(!this.model.has('label')) {
                this.model.set({ label: this.$el.text() }, { silent: true });
            }
            this.$('.edit-label').remove();
            this.$el.text(_(this.model.get('label')).t());
            if(this.model.get('edit')) {
                $('<span class="edit-label">' + _("Edit").t() + ': </span>').prependTo(this.$el);
            }
            return this;
        }
    });

    return DashboardTitle;

});
define('splunkjs/mvc/simplexml/dashboard/description',['require','underscore','backbone'],function(require) {
    var _ = require('underscore'),
        Backbone = require('backbone');

    return Backbone.View.extend({
        initialize: function() {
            this.listenTo(this.model, 'change:description', this.render, this);
            this.listenTo(this.model, 'change:edit', this.render, this);
        },
        render: function() {
            if(this.model.has('description')) {
                var txt = _(this.model.get('description') || '').t(),
                    edit = this.model.get('edit');
                this.$el.text(txt)[ txt && !edit ? 'show' : 'hide' ]();
            }
            return this;
        }
    });

});
define('splunkjs/mvc/simplexml/dashboard/row',['require','underscore','jquery','backbone'],function(require) {
    var _ = require('underscore'),
            $ = require('jquery'),
            Backbone = require('backbone');

    /**
     * The dashboard row view is a delegate view which handles the layout of dashboard panels within a row. Actions are
     * executed when panels are shown, hidden or removed.
     */
    var DashboardRowView = Backbone.View.extend({
        initialize: function() {
            this.listenTo(this.model, 'change:edit', this.onEditStateChange, this);
        },
        onEditStateChange: function() {
            this.$el.off('DOMSubtreeModified');
            if((!this.model.get('edit')) && this.$('.dashboard-panel').length > 1) {
                var fn = _.debounce(this.alignItemHeights.bind(this), 1000);
                this.$el.bind('DOMSubtreeModified', fn);
                fn();
            }
        },
        onContentChange: function() {
            this.$el.off('DOMSubtreeModified');
            var cells = this.$('.dashboard-cell');
            if(cells.length === 0) {
                return this.remove();
            }
            cells.removeClass('last-visible');
            if (!this.model.get('edit')) {
                cells = _(cells).filter(function(el) {
                    return $(el).find('.dashboard-element:not(.hidden)').length > 0 || !!$.trim($(el).find('.fieldset').html());
                });
                if (cells.length > 0) {
                    $(cells).last().addClass('last-visible');
                }
            }
            $(cells).css({ width: String(100 / cells.length) + '%' }).find('.panel-element-row').each(function() {
                var elements = $(this).find('.dashboard-element');
                elements.css({ width: String(100 / elements.length) + '%' });
            });
            if(cells.length > 1) {
                this.alignItemHeights();
            }
            this.onEditStateChange();
        },
        onPanelVisibilityChange: function(){
            this.onContentChange();
            // Force charts to re-render since widths of the panels have probably changed
            $(window).trigger('resize');
        },
        alignItemHeights: function() {
            var row = this.$el, items = row.find('.dashboard-panel');
            items.css({ 'min-height': 0 }).css({
                'min-height': _.max(_.map(items, function(i) { return $(i).height(); }))
            });
        },
        render: function() {
            this.onContentChange();
            this.$el.off('cellRemoved');
            this.$el.off('panelVisibilityChanged');
            this.$el.on('cellRemoved', _.bind(this.onContentChange, this));
            this.$el.on('panelVisibilityChanged', _.bind(this.onPanelVisibilityChange, this));
            return this;
        }
    });

    return DashboardRowView;
});

define('splunkjs/mvc/simplexml/dashboard/panel',['require','underscore','jquery','backbone','../../simpleform/fieldsetview'],function(require) {
    var _ = require('underscore');
    var $ = require('jquery');
    var Backbone = require('backbone');
    var FieldsetView = require('../../simpleform/fieldsetview');
    /**
     * Delegate view for dashboard panels that deals with hiding/showing the drag-handle for edit mode as well as
     * hiding the panel if all dashboard elements it contains are hidden.
     */
    var DashboardPanelView = Backbone.View.extend({
        initialize: function() {
            this.listenTo(this.model, 'change:edit', this.onEditStateChange, this);
        },
        onElementVisibilityChange: function() {
            if (this.$('.dashboard-element:not(.hidden)').length === 0 && (this.fieldset == null || this.fieldset.isEmpty())) {
                // Hide the panel if all dashboard elements are hidden
                this.hide();
            } else {
                this.show();
            }
            var isEditMode = this.model.get('edit');
            _(this.$el.children('.panel-element-row.grouped')).each(function(panelRow) {
                var selector = '.dashboard-element' + (isEditMode ? '' : ':not(.hidden)');
                var elements = $(panelRow).children(selector);
                if (elements.length > 0) {
                    elements.css({ width: String(100 / elements.length) + '%' });
                }
            });
        },
        hide: function() {
            if (!this.$el.is('.hidden')) {
                if (!this.model.get('edit')) {
                    this.$el.hide();
                }
                this.$el.addClass('hidden').trigger('panelVisibilityChanged');
            }
        },
        show: function() {
            if (this.$el.is('.hidden')) {
                this.$el.show().removeClass('hidden').trigger('panelVisibilityChanged');
            }
        },
        onEditStateChange: function(model) {
            if (model.get('edit')) {
                if (!this._dragHandle) {
                    this._dragHandle = $('<div class="drag-handle"><div class="handle-inner"></div></div>');
                }
                this._dragHandle.prependTo(this.el);
                if (this.$el.is('.hidden')) {
                    this.$el.show().trigger('panelVisibilityChanged');
                }
                if (!this.fieldset) {
                    this.fieldset = new FieldsetView({
                        el: $('<div class="fieldset"></div>').insertAfter(this._dragHandle)
                    }).render();
                }
            } else {
                if (this._dragHandle) {
                    this._dragHandle.detach();
                }
                if (this.$el.is('.hidden')) {
                    this.$el.hide().trigger('panelVisibilityChanged');
                }
                if (this.fieldset && this.fieldset.isEmpty()) {
                    this.fieldset.remove();
                    this.fieldset = null;
                }
            }
            this.onElementVisibilityChange();
        },
        markGroupedElementRows: function(){
            // Find all panel-rows with more than 1 element in order to re-layout them on visibility changes
            _(this.$el.children('.panel-element-row'))
                .chain()
                .map($)
                .invoke('removeClass', 'grouped')
                .filter(function($el){ return $el.children('.dashboard-element').length > 1; })
                .invoke('addClass', 'grouped');
        },
        render: function() {
            if ((!this.fieldset)) {
                var fieldsetEl = this.$el.children('.fieldset');
                if (fieldsetEl.length) {
                    this.fieldset = new FieldsetView({ el: fieldsetEl }).render();
                }
            }
            this.onEditStateChange(this.model);
            this.$el.off('elementVisibilityChanged');
            this.markGroupedElementRows();
            this.$el.on('elementVisibilityChanged', _.bind(this.onElementVisibilityChange, this));
            return this;
        },
        isEmpty: function() {
            var panelElementRows = this.$el.children('.panel-element-row');
            var inputs = this.$el.children('.fieldset').children('.input');
            return panelElementRows.length === 0 && inputs.length === 0;
        },
        events: {
            'itemRemoved': function(e) {
                if (this.isEmpty()) {
                    this.remove();
                }
            }
        },
        remove: function() {
            if (this.fieldset) {
                this.fieldset.remove();
            }
            this.$el.off('elementVisibilityChanged');
            var parent = this.$el.parent();
            Backbone.View.prototype.remove.call(this);
            parent.trigger('panelRemoved');
        }
    });

    return DashboardPanelView;
});
define('splunkjs/mvc/simplexml/dashboard/empty',['require','exports','module','underscore','jquery','backbone','splunk.util','uri/route'],function(require, exports, module) {
    var _ = require('underscore');
    var $ = require('jquery');
    var Backbone = require('backbone');
    var SplunkUtil = require('splunk.util');
    var route = require('uri/route');

    var DashboardEmptyState = Backbone.View.extend({
        initialize: function(options) {
            Backbone.View.prototype.initialize.apply(this, arguments);
            this.listenTo(this.model.state, 'change:editable change:edit', this.render, this);
        },
        events: {
            'click a.start-edit': function(e) {
                e.preventDefault();
                this.model.state.set('edit', true);
            }
        },
        render: function() {
            this.$el.empty().removeClass('empty-dashboard');
            this.$el.addClass('empty-dashboard');
            var alert = $('<div class="alert alert-error"><i class="icon-alert"></i></div>');
            if (this.model.state.get('editable')) {
                var msg;
                if (this.model.state.get('edit')) {
                    msg = _('Click Add Panel to start.').t();
                } else {
                    msg = _('This dashboard has no panels. %s to add panels.').t();
                    var startEditLink = SplunkUtil.sprintf('<a class="start-edit" href="#edit">%s</a>', _('Start editing').t());
                    msg = SplunkUtil.sprintf(msg, startEditLink);
                }
                $('<span></span>').html(msg).appendTo(alert);
            } else {
                $('<span></span>').text(_('This dashboard has no panels.').t()).appendTo(alert);
            }
            alert.appendTo(this.$el);
            return this;
        }
    });

    return DashboardEmptyState;
});
define('splunkjs/mvc/simpleform/edit/formsettings',['require','exports','module','underscore','jquery','backbone','views/Base','../../simplexml/controller'],function(require, exports, module) {
    var _ = require('underscore');
    var $ = require('jquery');
    var Backbone = require('backbone');
    var BaseView = require('views/Base');
    var Dashboard = require('../../simplexml/controller');

    return BaseView.extend({
        className: 'form-settings',
        initialize: function() {
            BaseView.prototype.initialize.apply(this, arguments);
            this.model = new Backbone.Model({
                value: !!Dashboard.model.view.isFormAutoRun()
            });
            this.listenTo(this.model, 'change', this.update);
            this.listenTo(this.model, 'change:value', function(model, value) {
                Dashboard.model.view.updateFormSettings({ autoRun: value }).fail(function(){
                    // Revert if persisting XML failed
                    model.set('value', !value);
                });
            });
            this.listenTo(Dashboard.model, 'change:rootNodeName', this.render);
        },
        events: {
            'click label': function(e) {
                e.preventDefault();
                if (!this.model.get('disabled')) {
                    this.model.set('value', !this.model.get('value'));
                }
            },
            'click .btn': function(e) {
                e.preventDefault();
            }
        },
        update: function() {
            this.$('i.icon-check')[this.model.get('value') ? 'show' : 'hide']();
            this.$('label,.btn')[this.model.get('disabled') ? 'addClass' : 'removeClass']('disabled');
        },
        render: function() {
            if(Dashboard.model.get('rootNodeName') === 'form') {
                this.$el.html(this.compiledTemplate({
                    label: _('Autorun dashboard').t(),
                    checked: this.model.get('value')
                }));
            } else {
                this.$el.empty();
            }
            return this;
        },
        template: '\
            <label class="checkbox">\
                  <a href="#" class="btn"><i class="icon-check" <% if (!checked) {%>style="display:none"<% } %>></i></a>\
                  <%= label%>\
            </label>\
        '
    });

});
define('splunkjs/mvc/simplexml/dashboardview',['require','../basesplunkview','../mvc','underscore','jquery','./controller','./editdashboard/master','./dragndrop','util/console','../simpleform/fieldsetview','./dashboard/title','./dashboard/description','./dashboard/row','./dashboard/panel','models/services/ScheduledView','./dashboard/empty','../simpleform/edit/formsettings','views/dashboards/table/controls/SchedulePDF'],function(require) {
    var BaseSplunkView = require('../basesplunkview');
    var mvc = require('../mvc');
    var _ = require('underscore');
    var $ = require('jquery');
    var controller = require('./controller');
    var EditControls = require('./editdashboard/master');
    var DragnDropView = require('./dragndrop');
    var console = require('util/console');
    var FieldsetView = require('../simpleform/fieldsetview');

    var DashboardTitleView = require('./dashboard/title');
    var DashboardDescriptionView = require('./dashboard/description');
    var DashboardRowView = require('./dashboard/row');
    var DashboardPanel = require('./dashboard/panel');
    var ScheduledView = require('models/services/ScheduledView');
    var EmptyStateView = require('./dashboard/empty');
    var FormSettingsView = require('../simpleform/edit/formsettings');
    var SchedulePDF = require('views/dashboards/table/controls/SchedulePDF');

    var DashboardView = BaseSplunkView.extend({
        initialize: function() {
            this.model = controller.getStateModel();
            this.model.scheduledView = new ScheduledView(); 
                    
            this.scheduledViewDfd = $.Deferred();
            controller.onViewModelLoad(function(){
                var dfd = this.model.scheduledView.findByName(this.model.view.entry.get('name'),
                    this.model.app.get('app'),
                    this.model.app.get('owner'));
                dfd.done(_.bind(this.scheduledViewDfd.resolve, this.scheduledViewDfd));
                dfd.fail(_.bind(this.scheduledViewDfd.reject, this.scheduledViewDfd));
            }, this);

            this.editControls = new EditControls({
                model: {
                    state: this.model,
                    dashboard: this.model.view,
                    application: this.model.app,
                    scheduledView: this.model.scheduledView
                }, 
                controller: controller 
            });
            this.model.on('change:edit', this.onEditStateChange, this);
            this.listenTo(this.model, 'change:dialog', this.handleDialog);
            if (this.model.has('dialog')) {
                this.handleDialog(this.model);
            }
        },
        render: function() {
            var model = this.model;
            this.rows = _.map(this.$('.dashboard-row'), function(row) {
                return new DashboardRowView({
                    el: row,
                    model: model
                }).render();
            });
            this.titleView = new DashboardTitleView({
                model: this.model,
                el: this.$('.dashboard-header h2')
            }).render();

            var descEl = this.$('p.description');
            if(!descEl.length) {
                descEl = $('<p class="description"></p>').appendTo(this.$('.dashboard-header')).hide();
            }

            this.descriptionView = new DashboardDescriptionView({
                el: descEl,
                model: model
            }).render();

            var fieldsetEl = this.$el.children('.fieldset');
            if(!fieldsetEl.length) {
                fieldsetEl = $('<div class="fieldset"></div>').insertAfter(this.$('.dashboard-header'));
            }
            this.fieldsetView = new FieldsetView({
                el: fieldsetEl
            }).render();

            var editEl = $('<div class="edit-dashboard-menu pull-right"></div>').prependTo(this.$('.dashboard-header'));            
            $.when(this.scheduledViewDfd).then(function() {
                this.editControls.render().appendTo(editEl);
            }.bind(this));

            this.panels = _(this.$('.dashboard-panel')).map(function(el){
                return new DashboardPanel({ el: el, model: model }).render();
            });

            this.onEditStateChange();

            _.defer(function() {
                $('body').removeClass('preload');
            });

            this.$el.addClass(this.model.get('edit') ? 'edit-mode' : 'view-mode');

            controller.onViewModelLoad(function() {
                if (this.model.view.isSimpleXML()) {
                    try {
                        this.model.view.captureDashboardStructure(this.getDashboardStructure());
                    } catch (e) {
                        console.error('Error capturing dashboard structure - disabling edit mode!', e);
                        this.model.set('editable', false);
                        this.model.set('edit', false);
                    }
                }
            }, this);

            this.updateEmptyState();
            return this;
        },
        getController: function() {
            return controller;
        },
        getStateModel: function() {
            return this.model;
        },
        getDashboardStructure: function() {
            return {
                fieldset: _(this.$el.children('.fieldset').children(':not(.form-submit)')).map(function(input) {
                    return $(input).attr('id');
                }),
                rows: _(this.$('.dashboard-row:not(.empty)')).map(function(row) {
                    return _($(row).find('.dashboard-panel')).map(function(panel) {
                        var elements = _($(panel).find('.dashboard-element')).map(function(element) {
                            return $(element).attr('id');
                        });
                        var inputs = _($(panel).find('.input')).map(function(input) {
                            return $(input).attr('id');
                        });
                        return { inputs: inputs, elements: elements };
                    });
                })
            };
        },
        isEmptyDashboard: function() {
            return !_(this.getDashboardStructure().rows).any(function(row) {
                return _(row).any(function(p) {
                    return p.elements.length || p.inputs.length;
                });
            });
        },
        getElementIds: function() {
            return _(this.getDashboardStructure().rows).chain().flatten().pluck('elements').flatten().value();
        },
        updateEmptyState: function(forceNotEmpty){
            if(this.isEmptyDashboard() && forceNotEmpty !== true) {
                if(!this.emptyStateView) {
                    this.emptyStateView = new EmptyStateView({
                        model: {
                            app: this.model.app,
                            state: this.model
                        }
                    });
                }
                this.emptyStateView.render().$el.appendTo(this.$el);
            } else if(this.emptyStateView) {
                this.emptyStateView.remove();
                this.emptyStateView = null;
            }
        },
        enterEditMode: function() {
            this.leaveEditMode();

            if(this.model.get('editable')) {
                console.log('Entering edit mode');
                this.dragnDrop = new DragnDropView({
                    el: this.el
                });
                try {
                    this.model.view.captureDashboardStructure(this.getDashboardStructure());
                } catch (e) {
                    console.error('Error capturing dashboard structure - disabling edit mode!', e);
                    this.model.set('editable', false);
                    this.model.set('edit', false);
                    return;
                }
                this.dragnDrop.on('sortupdate', _.debounce(this.updatePanelOrder, 0), this);
                this.dragnDrop.render();
                if (this.$el.is('.view-mode')) {
                    this.$el.addClass('edit-mode').removeClass('view-mode');
                }
                this.formSettings = new FormSettingsView().render().insertBefore(this.$el.children('.fieldset'));
            } else {
                console.log('Aborting edit mode: Dashboard is not editable');
                this.model.set('edit', false);
            }
        },
        updatePanelOrder: function() {
            if(this.model.get('editable')) {
                this.model.view.updateStructure(this.getDashboardStructure());
            }
        },
        leaveEditMode: function() {
            if (this.formSettings) {
                this.formSettings.remove();
                this.formSettings = null;
            }
            if(this.dragnDrop) {
                this.dragnDrop.off();
                this.dragnDrop.destroy();
                this.updatePanelOrder();
                this.dragnDrop = null;
            }
            if (this.$el.is('.edit-mode')) {
                this.$el.removeClass('edit-mode').addClass('view-mode');
            }
            this.updateEmptyState();
        },
        onEditStateChange: function() {
            if(this.model.get('edit')) {
                controller.onViewModelLoad(this.enterEditMode, this);
            } else {
                this.leaveEditMode();
            }
        },
        removeElement: function(id) {
            var cur = this.$('#' + id), parent = cur.parent();
            if(cur.siblings('.dashboard-element').length) {
                cur.remove();
            } else {
                var elRow = cur.parents('.panel-element-row');
                if (elRow.siblings('.panel-element-row').length || elRow.siblings('.fieldset').children('.input').length) {
                    parent = elRow.parent();
                    elRow.remove();
                } else {
                    var cell = cur.parents('.dashboard-cell');
                    parent = cell.parent();
                    cell.remove();
                }
            }
            parent.trigger('cellRemoved');
            this.updateEmptyState();
        },
        events: {
            'panelRemoved': function(e) {
                this.onPanelRemoved($(e.target));
            }
        },
        onPanelRemoved: function(cell) {
            var parent = cell.parent();
            cell.remove();
            parent.trigger('cellRemoved');
            this.updateEmptyState();
        },
        createNewElement: function(options) {
            var row = $(_.template(this.rowTemplate, options));
            row.appendTo(this.$el);
            this.rows.push(new DashboardRowView({
                el: row,
                model: this.model
            }).render());

            this.panels.push(new DashboardPanel({
                el: row.find('.dashboard-panel'),
                model: this.model
            }).render());

            this.updateEmptyState(true);
            return row.find('.dashboard-element');
        },
        handleDialog: function(model) {
            if (model.get('dialog')) {
                controller.onViewModelLoad(function() {
                    if (model.get('dialog') === 'schedulePDF') {
                        model.unset('dialog');
                        if (!model.view.isForm()) {
                            this.openSchedulePDFDialog();
                        }
                    }
                }, this);
            }
        },
        openSchedulePDFDialog: function() {
            var model = this.model;
            this.scheduledViewDfd.done(function() {
                var schedulePDF = new SchedulePDF({
                    model: {
                        scheduledView: model.scheduledView,
                        dashboard: model.view,
                        application: model.app,
                        appLocal: model.appLocal
                    },
                    onHiddenRemove: true
                });
                $("body").append(schedulePDF.render().el);
                schedulePDF.show();
            });
        },
        rowTemplate: '  <div class="dashboard-row">\
                            <div class="dashboard-cell" style="width: 100%;">\
                                <div class="dashboard-panel clearfix">\
                                    <div class="panel-element-row">\
                                        <div class="dashboard-element" id="<%= id %>" style="width: 100%">\
                                            <div class="panel-head"><h3><%- title %></h3></div>\
                                            <div class="panel-body"></div>\
                                        </div>\
                                    </div>\
                                </div>\
                            </div>\
                        </div>'
    });

    return DashboardView;
});

define('splunkjs/mvc/simplexml/dashboard',['require','util/console','./dashboardview'],function(require) {
    var console = require('util/console');

    console.warn(
        '%s is deprecated. Please require %s instead.',
        'splunkjs/mvc/simplexml/dashboard',
        'splunkjs/mvc/dashboardview');

    return require('./dashboardview');
});

define('splunkjs/mvc/simplexml/element/table',['require','underscore','../../../mvc','./base','../../tableview','util/console','../mapper','splunk.util','../../drilldown'],function(require){
    var _ = require('underscore');
    var mvc = require('../../../mvc');
    var DashboardElement = require('./base');
    var TableView = require('../../tableview');
    var console = require('util/console');
    var Mapper = require('../mapper');
    var SplunkUtil = require('splunk.util');
    var Drilldown = require('../../drilldown');

    var TableMapper = Mapper.extend({
        tagName: 'table',
        map: function(report, result, options) {
            result.options.wrap = String(SplunkUtil.normalizeBoolean(report.get('display.statistics.wrap', options)));
            result.options.rowNumbers = String(SplunkUtil.normalizeBoolean(report.get('display.statistics.rowNumbers', options)));
            result.options.dataOverlayMode = report.get('display.statistics.overlay', options);
            result.options.drilldown = Drilldown.getNormalizedDrilldownType(
                report.get('display.statistics.drilldown', options),
                { validValues: ['cell','row','none'], 'default': 'row', aliasMap: { all: 'cell', off: 'none' } });
            result.options.count = report.get('display.prefs.statistics.count', options);

            result.options.labelField = null;
            result.options.valueField = null;

            var fields = report.get('display.statistics.fields', options);
            result.tags.fields = _.isArray(fields) ?
                    (_.isEmpty(fields) ? null : JSON.stringify(fields)) :
                    (fields === '[]' ? null : fields);

        }
    });
    Mapper.register('statistics', TableMapper);

    var TableVisualization = TableView.extend({
        panelClassName: 'table',
        prefix: 'display.statistics.',
        reportDefaults: {
            'display.general.type': 'statistics',
            'display.prefs.statistics.count' : 10,
            'display.statistics.drilldown': 'cell'
        },
        getResultsLinkOptions: function(options) {
            return {};
        }
    });
    DashboardElement.registerVisualization('statistics', TableVisualization);

    var TableElement = DashboardElement.extend({
        initialVisualization: 'statistics'
    });
    
    return TableElement;
});
define('splunkjs/mvc/simplexml/element/chart',['require','underscore','jquery','backbone','../../../mvc','./base','../../chartview','../mapper','util/console','splunk.util','../../drilldown'],function(require){
    var _ = require('underscore'), $ = require('jquery'), Backbone = require('backbone');
    var mvc = require('../../../mvc');
    var DashboardElement = require('./base');
    var ChartView = require('../../chartview');
    var Mapper = require('../mapper');
    var console = require('util/console');
    var SplunkUtil = require('splunk.util');
    var Drilldown = require('../../drilldown');

    var chartingPrefix = 'display.visualizations.charting.', vizPrefix = 'display.visualizations.';
    Mapper.register('visualizations:charting', Mapper.extend({
        tagName: 'chart',
        map: function(report, result, options) {
            _(report.toJSON(options)).each(function(value, key){
                if(key.substring(0, chartingPrefix.length) === chartingPrefix) {
                    result.options[key.substring(vizPrefix.length)] = report.get(key, options);
                }
            });
            options['charting.drilldown'] = Drilldown.getNormalizedDrilldownType(
                options['charting.drilldown'] || options.drilldown,
                { allowBoolean: true });
            delete options.drilldown;
            result.removeOptions = ['drilldown'];
            result.options['charting.axisY2.enabled'] = String(SplunkUtil.normalizeBoolean(result.options['charting.axisY2.enabled']));
        }
    }));

    var ChartViz = ChartView.extend({
        panelClassName: 'chart',
        reportDefaults: {
            "display.visualizations.show": true,
            "display.visualizations.type": "charting",
            "display.general.type": "visualizations"
        },
        options: _.defaults({
            resizable: true
        }, ChartView.prototype.options),
        getResultsLinkOptions: function() {
            return {};
        }
    });
    DashboardElement.registerVisualization('visualizations:charting', ChartViz);
    DashboardElement.registerVisualization('visualizations', ChartViz);

    var ChartElement = DashboardElement.extend({
        initialVisualization: 'visualizations:charting'
    });

    return ChartElement;
});
define('splunkjs/mvc/simplexml/element/event',['require','underscore','jquery','backbone','../../../mvc','./base','../../eventsviewerview','../mapper','util/console','splunk.util'],function(require){
    var _ = require('underscore'), $ = require('jquery'), Backbone = require('backbone');
    var mvc = require('../../../mvc');
    var DashboardElement = require('./base');
    var EventsViewer = require('../../eventsviewerview');
    var Mapper = require('../mapper');
    var console = require('util/console');
    var SplunkUtil = require("splunk.util");

    var eventsPrefix = 'display.events.';

    var EventMapper = Mapper.extend({
        tagName: 'event',
        map: function(report, result, options) {
            result.options.count = report.get('display.prefs.events.count', options);
            _(report.toJSON(options)).each(function(v, key){
                if(key.indexOf(eventsPrefix) === 0) {
                    var value = report.get(key, options);
                    if(_.isArray(value)) {
                        value = JSON.stringify(value);
                    }
                    result.options[key.substring(eventsPrefix.length)] = (value != null) ? String(value) : null;
                }
            });
            if(result.options['table.drilldown']) {
                result.options['table.drilldown'] =
                    SplunkUtil.normalizeBoolean(result.options['table.drilldown']) ? 'all' : 'none';
            }
            result.removeOptions = ['drilldown', 'segmentation'];
        }
    });
    Mapper.register('events:raw', EventMapper);
    Mapper.register('events:list', EventMapper);
    Mapper.register('events:table', EventMapper);

    var EventsVisualization = EventsViewer.extend({
        reportDefaults: {
            'display.general.type': 'events',
            'display.prefs.events.count' : 10
        },
        getResultsLinkOptions: function() {
            return {};
        }
    });
    DashboardElement.registerVisualization('events', EventsVisualization);
    DashboardElement.registerVisualization('events:raw', EventsVisualization);
    DashboardElement.registerVisualization('events:list', EventsVisualization);
    DashboardElement.registerVisualization('events:table', EventsVisualization);

    var EventElement = DashboardElement.extend({
        initialVisualization: 'events'
    });
    
    return EventElement;
});
define('splunkjs/mvc/simplexml/element/single',['require','underscore','../../../mvc','./base','../../singleview','../mapper','util/console','../../drilldown'],function(require) {
    var _ = require('underscore');
    var mvc = require('../../../mvc');
    var DashboardElement = require('./base');
    var SingleView = require('../../singleview');
    var Mapper = require('../mapper');
    var console = require('util/console');
    var Drilldown = require('../../drilldown');

    Mapper.register('visualizations:singlevalue', Mapper.extend({
        tagName: 'single',
        map: function(report, result, options) {
            var prefix = 'display.visualizations.singlevalue.';
            console.log(report.toJSON(options));
            _(report.toJSON(options)).each(function(v, k) {
                if(k.substring(0, prefix.length) === prefix) {
                    result.options[k.substring(prefix.length)] = v;
                }
            });
            console.log('single export options: ', result.options);
            result.options.drilldown = Drilldown.getNormalizedDrilldownType(result.options.drilldown, { 'default': 'none' });
        }
    }));

    var SingleViz = SingleView.extend({
        panelClassName: 'single',
        reportDefaults: {
            "display.visualizations.show": true,
            "display.visualizations.type": "singlevalue",
            "display.general.type": "visualizations"
        },
        getResultsLinkOptions: function(options) {
            return { "link.visible": false };
        }
    });
    DashboardElement.registerVisualization('visualizations:singlevalue', SingleViz);

    var SingleElement = DashboardElement.extend({
        initialVisualization: 'visualizations:singlevalue'
    });
    
    return SingleElement;
});
define('splunkjs/mvc/simplexml/element/map',['require','underscore','jquery','backbone','../../../mvc','./base','../../splunkmapview','../mapper','util/console','../../drilldown'],function(require){
    var _ = require('underscore'), $ = require('jquery'), Backbone = require('backbone');
    var mvc = require('../../../mvc');
    var DashboardElement = require('./base');
    var SplunkMapView = require('../../splunkmapview');
    var Mapper = require('../mapper');
    var console = require('util/console');
    var Drilldown = require('../../drilldown');

    var mappingPrefix = 'display.visualizations.mapping.', vizPrefix = 'display.visualizations.';
    Mapper.register('visualizations:mapping', Mapper.extend({
        tagName: 'map',
        map: function(report, result, options) {
            _(report.toJSON()).each(function(value, key){
                if (key.indexOf(mappingPrefix) === 0) {
                    result.options[key.substring(vizPrefix.length)] = report.get(key, options);
                }
            });
            if (!(options || {}).pdf) {
                // Excluding 'mapping.data.bounds' when we don't generate XML for pdfgen
                delete result.options['mapping.data.bounds'];
            }
            result.options.drilldown = Drilldown.getNormalizedDrilldownType(
                result.options['mapping.drilldown'],
                { allowBoolean: true }
            );
            delete result.options['mapping.drilldown'];
        }
    }));

    var MapViz = SplunkMapView.extend({
        panelClassName: 'map',
        options: _.defaults({
            drilldown: true,
            resizable: true
        }, SplunkMapView.prototype.options),
        reportDefaults: {
            "display.visualizations.show": true,
            "display.visualizations.type": "mapping",
            "display.general.type": "visualizations"
        },
        getResultsLinkOptions: function() {
            return {};
        }
    });
    DashboardElement.registerVisualization('visualizations:mapping', MapViz);

    var MapElement = DashboardElement.extend({
        initialVisualization: 'visualizations:mapping'
    });
    
    return MapElement;
});
define('splunkjs/mvc/simplexml/element/list',['require','underscore','jquery','backbone','../../../mvc','./base','util/console'],function(require){
    var _ = require('underscore'), $ = require('jquery'), Backbone = require('backbone');
    var mvc = require('../../../mvc');
    var DashboardElement = require('./base');
    var console = require('util/console');

    var ListElement = DashboardElement.extend({
        initialVisualization: 'statistics',
        constructor: function(options) {
            _.extend(options, {
                displayRowNumbers: false,
                fields: [ options.labelField || '', options.valueField || '' ],
                sortKey: options.initialSort || options.labelField,
                sortDirection: options.initialSortDir || 'asc'
            });

            console.log('[%o] Creating table with options: %o', options.id, options);
            return DashboardElement.prototype.constructor.call(this, options);
        }
    });
    
    return ListElement;
});

define('splunkjs/mvc/simplexml/element/html',['require','underscore','jquery','backbone','../../../mvc','../../utils','./base','../controller','../../tokenutils','splunk.util'],function(require) {
    var _ = require('underscore'), $ = require('jquery'), Backbone = require('backbone');
    var mvc = require('../../../mvc');
    var utils = require('../../utils');
    var DashboardElement = require('./base');
    var Dashboard = require('../controller');
    var TokenUtils = require('../../tokenutils');
    var SplunkUtil = require('splunk.util');

    var HtmlElement = DashboardElement.extend({
        configure: function() {
            this.options.settingsOptions = _.extend({
                tokenEscaper: TokenUtils.getEscaper('html')
            }, this.options.settingsOptions || {});
            
            DashboardElement.prototype.configure.apply(this, arguments);
        },
        initialize: function() {
            this.configure();
            this.model = new Backbone.Model();
            this.reportReady = $.Deferred();
            this.reportReady.resolve(this.model);
            this.model.mapToXML = _.bind(this.mapToXML, this);
            this.settings.on("change", this.render, this);
            this.listenTo(Dashboard.getStateModel(), 'change:edit', this.onEditModeChange, this);
            this._setupTokenDependencies();
        },
        mapToXML: function(report, result, options) {
            return {
                type: 'html',
                content: this.settings.get('html', options),
                cdata: true,
                attributes: {
                    encoded: "1"
                }
            };
        },
        updateTitle: function() {
            this.$('.panel-head').remove();
            if(Dashboard.isEditMode()) {
                $('<div class="panel-head"><h3><span class="untitled">HTML Panel</span></h3></div>').prependTo(this.$el);
            }
        },
        createPanelElementEditor: function() {

        },
        createRefreshTimeIndicator: function() {

        },
        render: function() {
            this.$('script').remove();
            
            // If no 'html' setting was specified, initialize it with
            // the contents of this view's div upon first render.
            if(!this.settings.has('html')) {
                this.settings.set('html',
                    $.trim(this.$('.panel-body').html()),
                    {tokens: true});
            }
            
            this.$('.panel-body').html(this.settings.get('html'));

            // SPL-70655 root-endpoint/locale prefix for server-relative URLs
            this.$('a').each(function(){
                var el = $(this), href = el.attr('href');
                if(href && href[0] === '/' && href[1] !== '/') {
                    el.attr('href', SplunkUtil.make_url(href));
                }
            });

            this.onEditModeChange(Dashboard.getStateModel());
            return this;
        },
        getExportParams: function() {
            // Nothing to export
            return {};
        }
    });
    
    return HtmlElement;
});
define('splunkjs/mvc/simplexml/urltokenmodel',['require','exports','module','../basetokenmodel','./dashboardurl','./controller','util/general_utils'],function(require, exports, module) {
    var BaseTokenModel = require('../basetokenmodel');
    var dashboardUrl = require('./dashboardurl');
    var DashboardController = require("./controller");
    var general_utils = require('util/general_utils');

    /**
     * Automatically mirrors the current URL query parameters.
     */
    var UrlTokenModel = BaseTokenModel.extend({
        moduleId: module.id,
        initialize: function() {
            dashboardUrl.on('change', function(model, options) {
                this.setFromClassicUrl();
            }, this);

            this.setFromClassicUrl();

            DashboardController.router.on('route', function() {
                this.trigger("url:navigate");
            }, this);
        },
        /** Saves this model's current attributes to the URL. */
        save: function(attributes, options) {
            this.set(attributes);
            this.saveClassicUrl(options);
        },
        saveOnlyWithPrefix: function(prefix, attributes, options){
            var filter =["^"+prefix+".*", "^earliest$", "^latest$"];
            this.save(general_utils.filterObjectByRegexes(attributes, filter,  { allowEmpty: true, allowObject: true } ), options);
        },
        saveClassicUrl: function(options){
            dashboardUrl.save(this.toJSON(), options);
        },
        setFromClassicUrl: function(){
            this.set(dashboardUrl.toJSON());
        }
    });

    return UrlTokenModel;
});
define('splunkjs/mvc/simpleform/input/text',['require','./base','../../textinputview','../formutils'],function(require) {
    var BaseInput = require('./base');
    var TextInputView = require('../../textinputview');
    var FormUtils = require('../formutils');

    FormUtils.registerInputType('text', TextInputView, { blankIsUndefined: true });

    var TextInput = BaseInput.extend({
        initialVisualization: 'text'
    });
    
    return TextInput;
});
define('splunkjs/mvc/simpleform/input/dropdown',['require','./base','../../dropdownview','../formutils'],function(require) {
    var BaseInput = require('./base');
    var SelectView = require('../../dropdownview');
    var FormUtils = require('../formutils');

    FormUtils.registerInputType('dropdown', SelectView, { choices: true, multiValue: false });

    var DropdownInput = BaseInput.extend({
        initialVisualization: 'dropdown'
    });
    
    return DropdownInput;
});

define('splunkjs/mvc/simpleform/input/radiogroup',['require','./base','../../radiogroupview','../formutils'],function(require) {
    var BaseInput = require('./base');
    var RadioGroupView = require('../../radiogroupview');
    var FormUtils = require('../formutils');

    FormUtils.registerInputType('radio', RadioGroupView, { choices: true, multiValue: false });

    var RadioGroupInput = BaseInput.extend({
        initialVisualization: 'radio'
    });
    
    return RadioGroupInput;
});

define('splunkjs/mvc/simpleform/input',['require','./input/submit','./input/text','./input/dropdown','./input/radiogroup','./input/timerange','./input/submit','./input/text','./input/dropdown','./input/radiogroup','./input/timerange'],function(require) {
    return {
        SubmitButton: require('./input/submit'),
        TextInput: require('./input/text'),
        DropdownInput: require('./input/dropdown'),
        RadioGroupInput: require('./input/radiogroup'),
        TimeRangeInput: require('./input/timerange'),
        
        /* Deprecated */
        Submit: require('./input/submit'),
        Text: require('./input/text'),
        Dropdown: require('./input/dropdown'),
        Radio: require('./input/radiogroup'),
        TimeRangePicker: require('./input/timerange')
    };
});
define('splunkjs/mvc/simpleform/input/checkboxgroup',['require','./base','../../checkboxgroupview','../formutils'],function(require) {
    var BaseInput = require('./base');
    var CheckboxGroupView = require('../../checkboxgroupview');
    var FormUtils = require('../formutils');

    FormUtils.registerInputType('checkbox', CheckboxGroupView, { choices: true, multiValue: true });

    var CheckboxGroupInput = BaseInput.extend({
        initialVisualization: 'checkbox'
    });

    return CheckboxGroupInput;
});

define('splunkjs/mvc/simpleform/input/multiselect',['require','./base','../../multiselectview','../formutils'],function(require) {
    var BaseInput = require('./base');
    var MultiSelectView = require('../../multiselectview');
    var FormUtils = require('../formutils');

    FormUtils.registerInputType('multiselect', MultiSelectView, { choices: true, multiValue: true });

    var MultiSelectInput = BaseInput.extend({
        initialVisualization: 'multiselect'
    });

    return MultiSelectInput;
});

define('splunkjs/mvc/simplexml',['require','./simplexml/controller','./simplexml/dashboardview','./simplexml/dashboard','./simplexml/element/table','./simplexml/element/chart','./simplexml/element/event','./simplexml/element/single','./simplexml/element/map','./simplexml/element/list','./simplexml/element/html','./simplexml/urltokenmodel','./searchmanager','./savedsearchmanager','./postprocessmanager','./drilldown','./headerview','./footerview','./simpleform/formutils','./simpleform/input','./simpleform/input/submit','./simpleform/input/text','./simpleform/input/dropdown','./simpleform/input/radiogroup','./simpleform/input/timerange','./simpleform/input/checkboxgroup','./simpleform/input/multiselect','./utils'],function(require){

    var Controller = require("./simplexml/controller");
    
    require("./simplexml/dashboardview");
    require("./simplexml/dashboard");
    require("./simplexml/element/table");
    require("./simplexml/element/chart");
    require("./simplexml/element/event");
    require("./simplexml/element/single");
    require("./simplexml/element/map");
    require("./simplexml/element/list");
    require("./simplexml/element/html");
    require("./simplexml/urltokenmodel");
    require("./searchmanager");
    require("./savedsearchmanager");
    require("./postprocessmanager");
    require("./drilldown");
    require("./headerview");
    require("./footerview");
    require("./simpleform/formutils");
    require("./simpleform/input");
    require('./simpleform/input/submit');
    require('./simpleform/input/text');
    require('./simpleform/input/dropdown');
    require('./simpleform/input/radiogroup');
    require('./simpleform/input/timerange');
    require('./simpleform/input/checkboxgroup');
    require('./simpleform/input/multiselect');
    require("./utils");

    return Controller;
});
