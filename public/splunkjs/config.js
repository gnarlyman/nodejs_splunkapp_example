
/** vim: et:ts=4:sw=4:sts=4
 * @license RequireJS 2.1.8 Copyright (c) 2010-2012, The Dojo Foundation All Rights Reserved.
 * Available via the MIT or new BSD license.
 * see: http://github.com/jrburke/requirejs for details
 */
//Not using strict: uneven strict support in browsers, #392, and causes
//problems with requirejs.exec()/transpiler plugins that may not be strict.
/*jslint regexp: true, nomen: true, sloppy: true */
/*global window, navigator, document, importScripts, setTimeout, opera */

var requirejs, require, define;
(function (global) {
    var req, s, head, baseElement, dataMain, src,
        interactiveScript, currentlyAddingScript, mainScript, subPath,
        version = '2.1.8',
        commentRegExp = /(\/\*([\s\S]*?)\*\/|([^:]|^)\/\/(.*)$)/mg,
        cjsRequireRegExp = /[^.]\s*require\s*\(\s*["']([^'"\s]+)["']\s*\)/g,
        jsSuffixRegExp = /\.js$/,
        currDirRegExp = /^\.\//,
        op = Object.prototype,
        ostring = op.toString,
        hasOwn = op.hasOwnProperty,
        ap = Array.prototype,
        apsp = ap.splice,
        isBrowser = !!(typeof window !== 'undefined' && navigator && window.document),
        isWebWorker = !isBrowser && typeof importScripts !== 'undefined',
        //PS3 indicates loaded and complete, but need to wait for complete
        //specifically. Sequence is 'loading', 'loaded', execution,
        // then 'complete'. The UA check is unfortunate, but not sure how
        //to feature test w/o causing perf issues.
        readyRegExp = isBrowser && navigator.platform === 'PLAYSTATION 3' ?
                      /^complete$/ : /^(complete|loaded)$/,
        defContextName = '_',
        //Oh the tragedy, detecting opera. See the usage of isOpera for reason.
        isOpera = typeof opera !== 'undefined' && opera.toString() === '[object Opera]',
        contexts = {},
        cfg = {},
        globalDefQueue = [],
        useInteractive = false;

    function isFunction(it) {
        return ostring.call(it) === '[object Function]';
    }

    function isArray(it) {
        return ostring.call(it) === '[object Array]';
    }

    /**
     * Helper function for iterating over an array. If the func returns
     * a true value, it will break out of the loop.
     */
    function each(ary, func) {
        if (ary) {
            var i;
            for (i = 0; i < ary.length; i += 1) {
                if (ary[i] && func(ary[i], i, ary)) {
                    break;
                }
            }
        }
    }

    /**
     * Helper function for iterating over an array backwards. If the func
     * returns a true value, it will break out of the loop.
     */
    function eachReverse(ary, func) {
        if (ary) {
            var i;
            for (i = ary.length - 1; i > -1; i -= 1) {
                if (ary[i] && func(ary[i], i, ary)) {
                    break;
                }
            }
        }
    }

    function hasProp(obj, prop) {
        return hasOwn.call(obj, prop);
    }

    function getOwn(obj, prop) {
        return hasProp(obj, prop) && obj[prop];
    }

    /**
     * Cycles over properties in an object and calls a function for each
     * property value. If the function returns a truthy value, then the
     * iteration is stopped.
     */
    function eachProp(obj, func) {
        var prop;
        for (prop in obj) {
            if (hasProp(obj, prop)) {
                if (func(obj[prop], prop)) {
                    break;
                }
            }
        }
    }

    /**
     * Simple function to mix in properties from source into target,
     * but only if target does not already have a property of the same name.
     */
    function mixin(target, source, force, deepStringMixin) {
        if (source) {
            eachProp(source, function (value, prop) {
                if (force || !hasProp(target, prop)) {
                    if (deepStringMixin && typeof value !== 'string') {
                        if (!target[prop]) {
                            target[prop] = {};
                        }
                        mixin(target[prop], value, force, deepStringMixin);
                    } else {
                        target[prop] = value;
                    }
                }
            });
        }
        return target;
    }

    //Similar to Function.prototype.bind, but the 'this' object is specified
    //first, since it is easier to read/figure out what 'this' will be.
    function bind(obj, fn) {
        return function () {
            return fn.apply(obj, arguments);
        };
    }

    function scripts() {
        return document.getElementsByTagName('script');
    }

    function defaultOnError(err) {
        throw err;
    }

    //Allow getting a global that expressed in
    //dot notation, like 'a.b.c'.
    function getGlobal(value) {
        if (!value) {
            return value;
        }
        var g = global;
        each(value.split('.'), function (part) {
            g = g[part];
        });
        return g;
    }

    /**
     * Constructs an error with a pointer to an URL with more information.
     * @param {String} id the error ID that maps to an ID on a web page.
     * @param {String} message human readable error.
     * @param {Error} [err] the original error, if there is one.
     *
     * @returns {Error}
     */
    function makeError(id, msg, err, requireModules) {
        var e = new Error(msg + '\nhttp://requirejs.org/docs/errors.html#' + id);
        e.requireType = id;
        e.requireModules = requireModules;
        if (err) {
            e.originalError = err;
        }
        return e;
    }

    if (typeof define !== 'undefined') {
        //If a define is already in play via another AMD loader,
        //do not overwrite.
        return;
    }

    if (typeof requirejs !== 'undefined') {
        if (isFunction(requirejs)) {
            //Do not overwrite and existing requirejs instance.
            return;
        }
        cfg = requirejs;
        requirejs = undefined;
    }

    //Allow for a require config object
    if (typeof require !== 'undefined' && !isFunction(require)) {
        //assume it is a config object.
        cfg = require;
        require = undefined;
    }

    function newContext(contextName) {
        var inCheckLoaded, Module, context, handlers,
            checkLoadedTimeoutId,
            config = {
                //Defaults. Do not set a default for map
                //config to speed up normalize(), which
                //will run faster if there is no default.
                waitSeconds: 7,
                baseUrl: './',
                paths: {},
                pkgs: {},
                shim: {},
                config: {}
            },
            registry = {},
            //registry of just enabled modules, to speed
            //cycle breaking code when lots of modules
            //are registered, but not activated.
            enabledRegistry = {},
            undefEvents = {},
            defQueue = [],
            defined = {},
            urlFetched = {},
            requireCounter = 1,
            unnormalizedCounter = 1;

        /**
         * Trims the . and .. from an array of path segments.
         * It will keep a leading path segment if a .. will become
         * the first path segment, to help with module name lookups,
         * which act like paths, but can be remapped. But the end result,
         * all paths that use this function should look normalized.
         * NOTE: this method MODIFIES the input array.
         * @param {Array} ary the array of path segments.
         */
        function trimDots(ary) {
            var i, part;
            for (i = 0; ary[i]; i += 1) {
                part = ary[i];
                if (part === '.') {
                    ary.splice(i, 1);
                    i -= 1;
                } else if (part === '..') {
                    if (i === 1 && (ary[2] === '..' || ary[0] === '..')) {
                        //End of the line. Keep at least one non-dot
                        //path segment at the front so it can be mapped
                        //correctly to disk. Otherwise, there is likely
                        //no path mapping for a path starting with '..'.
                        //This can still fail, but catches the most reasonable
                        //uses of ..
                        break;
                    } else if (i > 0) {
                        ary.splice(i - 1, 2);
                        i -= 2;
                    }
                }
            }
        }

        /**
         * Given a relative module name, like ./something, normalize it to
         * a real name that can be mapped to a path.
         * @param {String} name the relative name
         * @param {String} baseName a real name that the name arg is relative
         * to.
         * @param {Boolean} applyMap apply the map config to the value. Should
         * only be done if this normalization is for a dependency ID.
         * @returns {String} normalized name
         */
        function normalize(name, baseName, applyMap) {
            var pkgName, pkgConfig, mapValue, nameParts, i, j, nameSegment,
                foundMap, foundI, foundStarMap, starI,
                baseParts = baseName && baseName.split('/'),
                normalizedBaseParts = baseParts,
                map = config.map,
                starMap = map && map['*'];

            //Adjust any relative paths.
            if (name && name.charAt(0) === '.') {
                //If have a base name, try to normalize against it,
                //otherwise, assume it is a top-level require that will
                //be relative to baseUrl in the end.
                if (baseName) {
                    if (getOwn(config.pkgs, baseName)) {
                        //If the baseName is a package name, then just treat it as one
                        //name to concat the name with.
                        normalizedBaseParts = baseParts = [baseName];
                    } else {
                        //Convert baseName to array, and lop off the last part,
                        //so that . matches that 'directory' and not name of the baseName's
                        //module. For instance, baseName of 'one/two/three', maps to
                        //'one/two/three.js', but we want the directory, 'one/two' for
                        //this normalization.
                        normalizedBaseParts = baseParts.slice(0, baseParts.length - 1);
                    }

                    name = normalizedBaseParts.concat(name.split('/'));
                    trimDots(name);

                    //Some use of packages may use a . path to reference the
                    //'main' module name, so normalize for that.
                    pkgConfig = getOwn(config.pkgs, (pkgName = name[0]));
                    name = name.join('/');
                    if (pkgConfig && name === pkgName + '/' + pkgConfig.main) {
                        name = pkgName;
                    }
                } else if (name.indexOf('./') === 0) {
                    // No baseName, so this is ID is resolved relative
                    // to baseUrl, pull off the leading dot.
                    name = name.substring(2);
                }
            }

            //Apply map config if available.
            if (applyMap && map && (baseParts || starMap)) {
                nameParts = name.split('/');

                for (i = nameParts.length; i > 0; i -= 1) {
                    nameSegment = nameParts.slice(0, i).join('/');

                    if (baseParts) {
                        //Find the longest baseName segment match in the config.
                        //So, do joins on the biggest to smallest lengths of baseParts.
                        for (j = baseParts.length; j > 0; j -= 1) {
                            mapValue = getOwn(map, baseParts.slice(0, j).join('/'));

                            //baseName segment has config, find if it has one for
                            //this name.
                            if (mapValue) {
                                mapValue = getOwn(mapValue, nameSegment);
                                if (mapValue) {
                                    //Match, update name to the new value.
                                    foundMap = mapValue;
                                    foundI = i;
                                    break;
                                }
                            }
                        }
                    }

                    if (foundMap) {
                        break;
                    }

                    //Check for a star map match, but just hold on to it,
                    //if there is a shorter segment match later in a matching
                    //config, then favor over this star map.
                    if (!foundStarMap && starMap && getOwn(starMap, nameSegment)) {
                        foundStarMap = getOwn(starMap, nameSegment);
                        starI = i;
                    }
                }

                if (!foundMap && foundStarMap) {
                    foundMap = foundStarMap;
                    foundI = starI;
                }

                if (foundMap) {
                    nameParts.splice(0, foundI, foundMap);
                    name = nameParts.join('/');
                }
            }

            return name;
        }

        function removeScript(name) {
            if (isBrowser) {
                each(scripts(), function (scriptNode) {
                    if (scriptNode.getAttribute('data-requiremodule') === name &&
                            scriptNode.getAttribute('data-requirecontext') === context.contextName) {
                        scriptNode.parentNode.removeChild(scriptNode);
                        return true;
                    }
                });
            }
        }

        function hasPathFallback(id) {
            var pathConfig = getOwn(config.paths, id);
            if (pathConfig && isArray(pathConfig) && pathConfig.length > 1) {
                removeScript(id);
                //Pop off the first array value, since it failed, and
                //retry
                pathConfig.shift();
                context.require.undef(id);
                context.require([id]);
                return true;
            }
        }

        //Turns a plugin!resource to [plugin, resource]
        //with the plugin being undefined if the name
        //did not have a plugin prefix.
        function splitPrefix(name) {
            var prefix,
                index = name ? name.indexOf('!') : -1;
            if (index > -1) {
                prefix = name.substring(0, index);
                name = name.substring(index + 1, name.length);
            }
            return [prefix, name];
        }

        /**
         * Creates a module mapping that includes plugin prefix, module
         * name, and path. If parentModuleMap is provided it will
         * also normalize the name via require.normalize()
         *
         * @param {String} name the module name
         * @param {String} [parentModuleMap] parent module map
         * for the module name, used to resolve relative names.
         * @param {Boolean} isNormalized: is the ID already normalized.
         * This is true if this call is done for a define() module ID.
         * @param {Boolean} applyMap: apply the map config to the ID.
         * Should only be true if this map is for a dependency.
         *
         * @returns {Object}
         */
        function makeModuleMap(name, parentModuleMap, isNormalized, applyMap) {
            var url, pluginModule, suffix, nameParts,
                prefix = null,
                parentName = parentModuleMap ? parentModuleMap.name : null,
                originalName = name,
                isDefine = true,
                normalizedName = '';

            //If no name, then it means it is a require call, generate an
            //internal name.
            if (!name) {
                isDefine = false;
                name = '_@r' + (requireCounter += 1);
            }

            nameParts = splitPrefix(name);
            prefix = nameParts[0];
            name = nameParts[1];

            if (prefix) {
                prefix = normalize(prefix, parentName, applyMap);
                pluginModule = getOwn(defined, prefix);
            }

            //Account for relative paths if there is a base name.
            if (name) {
                if (prefix) {
                    if (pluginModule && pluginModule.normalize) {
                        //Plugin is loaded, use its normalize method.
                        normalizedName = pluginModule.normalize(name, function (name) {
                            return normalize(name, parentName, applyMap);
                        });
                    } else {
                        normalizedName = normalize(name, parentName, applyMap);
                    }
                } else {
                    //A regular module.
                    normalizedName = normalize(name, parentName, applyMap);

                    //Normalized name may be a plugin ID due to map config
                    //application in normalize. The map config values must
                    //already be normalized, so do not need to redo that part.
                    nameParts = splitPrefix(normalizedName);
                    prefix = nameParts[0];
                    normalizedName = nameParts[1];
                    isNormalized = true;

                    url = context.nameToUrl(normalizedName);
                }
            }

            //If the id is a plugin id that cannot be determined if it needs
            //normalization, stamp it with a unique ID so two matching relative
            //ids that may conflict can be separate.
            suffix = prefix && !pluginModule && !isNormalized ?
                     '_unnormalized' + (unnormalizedCounter += 1) :
                     '';

            return {
                prefix: prefix,
                name: normalizedName,
                parentMap: parentModuleMap,
                unnormalized: !!suffix,
                url: url,
                originalName: originalName,
                isDefine: isDefine,
                id: (prefix ?
                        prefix + '!' + normalizedName :
                        normalizedName) + suffix
            };
        }

        function getModule(depMap) {
            var id = depMap.id,
                mod = getOwn(registry, id);

            if (!mod) {
                mod = registry[id] = new context.Module(depMap);
            }

            return mod;
        }

        function on(depMap, name, fn) {
            var id = depMap.id,
                mod = getOwn(registry, id);

            if (hasProp(defined, id) &&
                    (!mod || mod.defineEmitComplete)) {
                if (name === 'defined') {
                    fn(defined[id]);
                }
            } else {
                mod = getModule(depMap);
                if (mod.error && name === 'error') {
                    fn(mod.error);
                } else {
                    mod.on(name, fn);
                }
            }
        }

        function onError(err, errback) {
            var ids = err.requireModules,
                notified = false;

            if (errback) {
                errback(err);
            } else {
                each(ids, function (id) {
                    var mod = getOwn(registry, id);
                    if (mod) {
                        //Set error on module, so it skips timeout checks.
                        mod.error = err;
                        if (mod.events.error) {
                            notified = true;
                            mod.emit('error', err);
                        }
                    }
                });

                if (!notified) {
                    req.onError(err);
                }
            }
        }

        /**
         * Internal method to transfer globalQueue items to this context's
         * defQueue.
         */
        function takeGlobalQueue() {
            //Push all the globalDefQueue items into the context's defQueue
            if (globalDefQueue.length) {
                //Array splice in the values since the context code has a
                //local var ref to defQueue, so cannot just reassign the one
                //on context.
                apsp.apply(defQueue,
                           [defQueue.length - 1, 0].concat(globalDefQueue));
                globalDefQueue = [];
            }
        }

        handlers = {
            'require': function (mod) {
                if (mod.require) {
                    return mod.require;
                } else {
                    return (mod.require = context.makeRequire(mod.map));
                }
            },
            'exports': function (mod) {
                mod.usingExports = true;
                if (mod.map.isDefine) {
                    if (mod.exports) {
                        return mod.exports;
                    } else {
                        return (mod.exports = defined[mod.map.id] = {});
                    }
                }
            },
            'module': function (mod) {
                if (mod.module) {
                    return mod.module;
                } else {
                    return (mod.module = {
                        id: mod.map.id,
                        uri: mod.map.url,
                        config: function () {
                            var c,
                                pkg = getOwn(config.pkgs, mod.map.id);
                            // For packages, only support config targeted
                            // at the main module.
                            c = pkg ? getOwn(config.config, mod.map.id + '/' + pkg.main) :
                                      getOwn(config.config, mod.map.id);
                            return  c || {};
                        },
                        exports: defined[mod.map.id]
                    });
                }
            }
        };

        function cleanRegistry(id) {
            //Clean up machinery used for waiting modules.
            delete registry[id];
            delete enabledRegistry[id];
        }

        function breakCycle(mod, traced, processed) {
            var id = mod.map.id;

            if (mod.error) {
                mod.emit('error', mod.error);
            } else {
                traced[id] = true;
                each(mod.depMaps, function (depMap, i) {
                    var depId = depMap.id,
                        dep = getOwn(registry, depId);

                    //Only force things that have not completed
                    //being defined, so still in the registry,
                    //and only if it has not been matched up
                    //in the module already.
                    if (dep && !mod.depMatched[i] && !processed[depId]) {
                        if (getOwn(traced, depId)) {
                            mod.defineDep(i, defined[depId]);
                            mod.check(); //pass false?
                        } else {
                            breakCycle(dep, traced, processed);
                        }
                    }
                });
                processed[id] = true;
            }
        }

        function checkLoaded() {
            var map, modId, err, usingPathFallback,
                waitInterval = config.waitSeconds * 1000,
                //It is possible to disable the wait interval by using waitSeconds of 0.
                expired = waitInterval && (context.startTime + waitInterval) < new Date().getTime(),
                noLoads = [],
                reqCalls = [],
                stillLoading = false,
                needCycleCheck = true;

            //Do not bother if this call was a result of a cycle break.
            if (inCheckLoaded) {
                return;
            }

            inCheckLoaded = true;

            //Figure out the state of all the modules.
            eachProp(enabledRegistry, function (mod) {
                map = mod.map;
                modId = map.id;

                //Skip things that are not enabled or in error state.
                if (!mod.enabled) {
                    return;
                }

                if (!map.isDefine) {
                    reqCalls.push(mod);
                }

                if (!mod.error) {
                    //If the module should be executed, and it has not
                    //been inited and time is up, remember it.
                    if (!mod.inited && expired) {
                        if (hasPathFallback(modId)) {
                            usingPathFallback = true;
                            stillLoading = true;
                        } else {
                            noLoads.push(modId);
                            removeScript(modId);
                        }
                    } else if (!mod.inited && mod.fetched && map.isDefine) {
                        stillLoading = true;
                        if (!map.prefix) {
                            //No reason to keep looking for unfinished
                            //loading. If the only stillLoading is a
                            //plugin resource though, keep going,
                            //because it may be that a plugin resource
                            //is waiting on a non-plugin cycle.
                            return (needCycleCheck = false);
                        }
                    }
                }
            });

            if (expired && noLoads.length) {
                //If wait time expired, throw error of unloaded modules.
                err = makeError('timeout', 'Load timeout for modules: ' + noLoads, null, noLoads);
                err.contextName = context.contextName;
                return onError(err);
            }

            //Not expired, check for a cycle.
            if (needCycleCheck) {
                each(reqCalls, function (mod) {
                    breakCycle(mod, {}, {});
                });
            }

            //If still waiting on loads, and the waiting load is something
            //other than a plugin resource, or there are still outstanding
            //scripts, then just try back later.
            if ((!expired || usingPathFallback) && stillLoading) {
                //Something is still waiting to load. Wait for it, but only
                //if a timeout is not already in effect.
                if ((isBrowser || isWebWorker) && !checkLoadedTimeoutId) {
                    checkLoadedTimeoutId = setTimeout(function () {
                        checkLoadedTimeoutId = 0;
                        checkLoaded();
                    }, 50);
                }
            }

            inCheckLoaded = false;
        }

        Module = function (map) {
            this.events = getOwn(undefEvents, map.id) || {};
            this.map = map;
            this.shim = getOwn(config.shim, map.id);
            this.depExports = [];
            this.depMaps = [];
            this.depMatched = [];
            this.pluginMaps = {};
            this.depCount = 0;

            /* this.exports this.factory
               this.depMaps = [],
               this.enabled, this.fetched
            */
        };

        Module.prototype = {
            init: function (depMaps, factory, errback, options) {
                options = options || {};

                //Do not do more inits if already done. Can happen if there
                //are multiple define calls for the same module. That is not
                //a normal, common case, but it is also not unexpected.
                if (this.inited) {
                    return;
                }

                this.factory = factory;

                if (errback) {
                    //Register for errors on this module.
                    this.on('error', errback);
                } else if (this.events.error) {
                    //If no errback already, but there are error listeners
                    //on this module, set up an errback to pass to the deps.
                    errback = bind(this, function (err) {
                        this.emit('error', err);
                    });
                }

                //Do a copy of the dependency array, so that
                //source inputs are not modified. For example
                //"shim" deps are passed in here directly, and
                //doing a direct modification of the depMaps array
                //would affect that config.
                this.depMaps = depMaps && depMaps.slice(0);

                this.errback = errback;

                //Indicate this module has be initialized
                this.inited = true;

                this.ignore = options.ignore;

                //Could have option to init this module in enabled mode,
                //or could have been previously marked as enabled. However,
                //the dependencies are not known until init is called. So
                //if enabled previously, now trigger dependencies as enabled.
                if (options.enabled || this.enabled) {
                    //Enable this module and dependencies.
                    //Will call this.check()
                    this.enable();
                } else {
                    this.check();
                }
            },

            defineDep: function (i, depExports) {
                //Because of cycles, defined callback for a given
                //export can be called more than once.
                if (!this.depMatched[i]) {
                    this.depMatched[i] = true;
                    this.depCount -= 1;
                    this.depExports[i] = depExports;
                }
            },

            fetch: function () {
                if (this.fetched) {
                    return;
                }
                this.fetched = true;

                context.startTime = (new Date()).getTime();

                var map = this.map;

                //If the manager is for a plugin managed resource,
                //ask the plugin to load it now.
                if (this.shim) {
                    context.makeRequire(this.map, {
                        enableBuildCallback: true
                    })(this.shim.deps || [], bind(this, function () {
                        return map.prefix ? this.callPlugin() : this.load();
                    }));
                } else {
                    //Regular dependency.
                    return map.prefix ? this.callPlugin() : this.load();
                }
            },

            load: function () {
                var url = this.map.url;

                //Regular dependency.
                if (!urlFetched[url]) {
                    urlFetched[url] = true;
                    context.load(this.map.id, url);
                }
            },

            /**
             * Checks if the module is ready to define itself, and if so,
             * define it.
             */
            check: function () {
                if (!this.enabled || this.enabling) {
                    return;
                }

                var err, cjsModule,
                    id = this.map.id,
                    depExports = this.depExports,
                    exports = this.exports,
                    factory = this.factory;

                if (!this.inited) {
                    this.fetch();
                } else if (this.error) {
                    this.emit('error', this.error);
                } else if (!this.defining) {
                    //The factory could trigger another require call
                    //that would result in checking this module to
                    //define itself again. If already in the process
                    //of doing that, skip this work.
                    this.defining = true;

                    if (this.depCount < 1 && !this.defined) {
                        if (isFunction(factory)) {
                            //If there is an error listener, favor passing
                            //to that instead of throwing an error. However,
                            //only do it for define()'d  modules. require
                            //errbacks should not be called for failures in
                            //their callbacks (#699). However if a global
                            //onError is set, use that.
                            if ((this.events.error && this.map.isDefine) ||
                                req.onError !== defaultOnError) {
                                try {
                                    exports = context.execCb(id, factory, depExports, exports);
                                } catch (e) {
                                    err = e;
                                }
                            } else {
                                exports = context.execCb(id, factory, depExports, exports);
                            }

                            if (this.map.isDefine) {
                                //If setting exports via 'module' is in play,
                                //favor that over return value and exports. After that,
                                //favor a non-undefined return value over exports use.
                                cjsModule = this.module;
                                if (cjsModule &&
                                        cjsModule.exports !== undefined &&
                                        //Make sure it is not already the exports value
                                        cjsModule.exports !== this.exports) {
                                    exports = cjsModule.exports;
                                } else if (exports === undefined && this.usingExports) {
                                    //exports already set the defined value.
                                    exports = this.exports;
                                }
                            }

                            if (err) {
                                err.requireMap = this.map;
                                err.requireModules = this.map.isDefine ? [this.map.id] : null;
                                err.requireType = this.map.isDefine ? 'define' : 'require';
                                return onError((this.error = err));
                            }

                        } else {
                            //Just a literal value
                            exports = factory;
                        }

                        this.exports = exports;

                        if (this.map.isDefine && !this.ignore) {
                            defined[id] = exports;

                            if (req.onResourceLoad) {
                                req.onResourceLoad(context, this.map, this.depMaps);
                            }
                        }

                        //Clean up
                        cleanRegistry(id);

                        this.defined = true;
                    }

                    //Finished the define stage. Allow calling check again
                    //to allow define notifications below in the case of a
                    //cycle.
                    this.defining = false;

                    if (this.defined && !this.defineEmitted) {
                        this.defineEmitted = true;
                        this.emit('defined', this.exports);
                        this.defineEmitComplete = true;
                    }

                }
            },

            callPlugin: function () {
                var map = this.map,
                    id = map.id,
                    //Map already normalized the prefix.
                    pluginMap = makeModuleMap(map.prefix);

                //Mark this as a dependency for this plugin, so it
                //can be traced for cycles.
                this.depMaps.push(pluginMap);

                on(pluginMap, 'defined', bind(this, function (plugin) {
                    var load, normalizedMap, normalizedMod,
                        name = this.map.name,
                        parentName = this.map.parentMap ? this.map.parentMap.name : null,
                        localRequire = context.makeRequire(map.parentMap, {
                            enableBuildCallback: true
                        });

                    //If current map is not normalized, wait for that
                    //normalized name to load instead of continuing.
                    if (this.map.unnormalized) {
                        //Normalize the ID if the plugin allows it.
                        if (plugin.normalize) {
                            name = plugin.normalize(name, function (name) {
                                return normalize(name, parentName, true);
                            }) || '';
                        }

                        //prefix and name should already be normalized, no need
                        //for applying map config again either.
                        normalizedMap = makeModuleMap(map.prefix + '!' + name,
                                                      this.map.parentMap);
                        on(normalizedMap,
                            'defined', bind(this, function (value) {
                                this.init([], function () { return value; }, null, {
                                    enabled: true,
                                    ignore: true
                                });
                            }));

                        normalizedMod = getOwn(registry, normalizedMap.id);
                        if (normalizedMod) {
                            //Mark this as a dependency for this plugin, so it
                            //can be traced for cycles.
                            this.depMaps.push(normalizedMap);

                            if (this.events.error) {
                                normalizedMod.on('error', bind(this, function (err) {
                                    this.emit('error', err);
                                }));
                            }
                            normalizedMod.enable();
                        }

                        return;
                    }

                    load = bind(this, function (value) {
                        this.init([], function () { return value; }, null, {
                            enabled: true
                        });
                    });

                    load.error = bind(this, function (err) {
                        this.inited = true;
                        this.error = err;
                        err.requireModules = [id];

                        //Remove temp unnormalized modules for this module,
                        //since they will never be resolved otherwise now.
                        eachProp(registry, function (mod) {
                            if (mod.map.id.indexOf(id + '_unnormalized') === 0) {
                                cleanRegistry(mod.map.id);
                            }
                        });

                        onError(err);
                    });

                    //Allow plugins to load other code without having to know the
                    //context or how to 'complete' the load.
                    load.fromText = bind(this, function (text, textAlt) {
                        /*jslint evil: true */
                        var moduleName = map.name,
                            moduleMap = makeModuleMap(moduleName),
                            hasInteractive = useInteractive;

                        //As of 2.1.0, support just passing the text, to reinforce
                        //fromText only being called once per resource. Still
                        //support old style of passing moduleName but discard
                        //that moduleName in favor of the internal ref.
                        if (textAlt) {
                            text = textAlt;
                        }

                        //Turn off interactive script matching for IE for any define
                        //calls in the text, then turn it back on at the end.
                        if (hasInteractive) {
                            useInteractive = false;
                        }

                        //Prime the system by creating a module instance for
                        //it.
                        getModule(moduleMap);

                        //Transfer any config to this other module.
                        if (hasProp(config.config, id)) {
                            config.config[moduleName] = config.config[id];
                        }

                        try {
                            req.exec(text);
                        } catch (e) {
                            return onError(makeError('fromtexteval',
                                             'fromText eval for ' + id +
                                            ' failed: ' + e,
                                             e,
                                             [id]));
                        }

                        if (hasInteractive) {
                            useInteractive = true;
                        }

                        //Mark this as a dependency for the plugin
                        //resource
                        this.depMaps.push(moduleMap);

                        //Support anonymous modules.
                        context.completeLoad(moduleName);

                        //Bind the value of that module to the value for this
                        //resource ID.
                        localRequire([moduleName], load);
                    });

                    //Use parentName here since the plugin's name is not reliable,
                    //could be some weird string with no path that actually wants to
                    //reference the parentName's path.
                    plugin.load(map.name, localRequire, load, config);
                }));

                context.enable(pluginMap, this);
                this.pluginMaps[pluginMap.id] = pluginMap;
            },

            enable: function () {
                enabledRegistry[this.map.id] = this;
                this.enabled = true;

                //Set flag mentioning that the module is enabling,
                //so that immediate calls to the defined callbacks
                //for dependencies do not trigger inadvertent load
                //with the depCount still being zero.
                this.enabling = true;

                //Enable each dependency
                each(this.depMaps, bind(this, function (depMap, i) {
                    var id, mod, handler;

                    if (typeof depMap === 'string') {
                        //Dependency needs to be converted to a depMap
                        //and wired up to this module.
                        depMap = makeModuleMap(depMap,
                                               (this.map.isDefine ? this.map : this.map.parentMap),
                                               false,
                                               !this.skipMap);
                        this.depMaps[i] = depMap;

                        handler = getOwn(handlers, depMap.id);

                        if (handler) {
                            this.depExports[i] = handler(this);
                            return;
                        }

                        this.depCount += 1;

                        on(depMap, 'defined', bind(this, function (depExports) {
                            this.defineDep(i, depExports);
                            this.check();
                        }));

                        if (this.errback) {
                            on(depMap, 'error', bind(this, this.errback));
                        }
                    }

                    id = depMap.id;
                    mod = registry[id];

                    //Skip special modules like 'require', 'exports', 'module'
                    //Also, don't call enable if it is already enabled,
                    //important in circular dependency cases.
                    if (!hasProp(handlers, id) && mod && !mod.enabled) {
                        context.enable(depMap, this);
                    }
                }));

                //Enable each plugin that is used in
                //a dependency
                eachProp(this.pluginMaps, bind(this, function (pluginMap) {
                    var mod = getOwn(registry, pluginMap.id);
                    if (mod && !mod.enabled) {
                        context.enable(pluginMap, this);
                    }
                }));

                this.enabling = false;

                this.check();
            },

            on: function (name, cb) {
                var cbs = this.events[name];
                if (!cbs) {
                    cbs = this.events[name] = [];
                }
                cbs.push(cb);
            },

            emit: function (name, evt) {
                each(this.events[name], function (cb) {
                    cb(evt);
                });
                if (name === 'error') {
                    //Now that the error handler was triggered, remove
                    //the listeners, since this broken Module instance
                    //can stay around for a while in the registry.
                    delete this.events[name];
                }
            }
        };

        function callGetModule(args) {
            //Skip modules already defined.
            if (!hasProp(defined, args[0])) {
                getModule(makeModuleMap(args[0], null, true)).init(args[1], args[2]);
            }
        }

        function removeListener(node, func, name, ieName) {
            //Favor detachEvent because of IE9
            //issue, see attachEvent/addEventListener comment elsewhere
            //in this file.
            if (node.detachEvent && !isOpera) {
                //Probably IE. If not it will throw an error, which will be
                //useful to know.
                if (ieName) {
                    node.detachEvent(ieName, func);
                }
            } else {
                node.removeEventListener(name, func, false);
            }
        }

        /**
         * Given an event from a script node, get the requirejs info from it,
         * and then removes the event listeners on the node.
         * @param {Event} evt
         * @returns {Object}
         */
        function getScriptData(evt) {
            //Using currentTarget instead of target for Firefox 2.0's sake. Not
            //all old browsers will be supported, but this one was easy enough
            //to support and still makes sense.
            var node = evt.currentTarget || evt.srcElement;

            //Remove the listeners once here.
            removeListener(node, context.onScriptLoad, 'load', 'onreadystatechange');
            removeListener(node, context.onScriptError, 'error');

            return {
                node: node,
                id: node && node.getAttribute('data-requiremodule')
            };
        }

        function intakeDefines() {
            var args;

            //Any defined modules in the global queue, intake them now.
            takeGlobalQueue();

            //Make sure any remaining defQueue items get properly processed.
            while (defQueue.length) {
                args = defQueue.shift();
                if (args[0] === null) {
                    return onError(makeError('mismatch', 'Mismatched anonymous define() module: ' + args[args.length - 1]));
                } else {
                    //args are id, deps, factory. Should be normalized by the
                    //define() function.
                    callGetModule(args);
                }
            }
        }

        context = {
            config: config,
            contextName: contextName,
            registry: registry,
            defined: defined,
            urlFetched: urlFetched,
            defQueue: defQueue,
            Module: Module,
            makeModuleMap: makeModuleMap,
            nextTick: req.nextTick,
            onError: onError,

            /**
             * Set a configuration for the context.
             * @param {Object} cfg config object to integrate.
             */
            configure: function (cfg) {
                //Make sure the baseUrl ends in a slash.
                if (cfg.baseUrl) {
                    if (cfg.baseUrl.charAt(cfg.baseUrl.length - 1) !== '/') {
                        cfg.baseUrl += '/';
                    }
                }

                //Save off the paths and packages since they require special processing,
                //they are additive.
                var pkgs = config.pkgs,
                    shim = config.shim,
                    objs = {
                        paths: true,
                        config: true,
                        map: true
                    };

                eachProp(cfg, function (value, prop) {
                    if (objs[prop]) {
                        if (prop === 'map') {
                            if (!config.map) {
                                config.map = {};
                            }
                            mixin(config[prop], value, true, true);
                        } else {
                            mixin(config[prop], value, true);
                        }
                    } else {
                        config[prop] = value;
                    }
                });

                //Merge shim
                if (cfg.shim) {
                    eachProp(cfg.shim, function (value, id) {
                        //Normalize the structure
                        if (isArray(value)) {
                            value = {
                                deps: value
                            };
                        }
                        if ((value.exports || value.init) && !value.exportsFn) {
                            value.exportsFn = context.makeShimExports(value);
                        }
                        shim[id] = value;
                    });
                    config.shim = shim;
                }

                //Adjust packages if necessary.
                if (cfg.packages) {
                    each(cfg.packages, function (pkgObj) {
                        var location;

                        pkgObj = typeof pkgObj === 'string' ? { name: pkgObj } : pkgObj;
                        location = pkgObj.location;

                        //Create a brand new object on pkgs, since currentPackages can
                        //be passed in again, and config.pkgs is the internal transformed
                        //state for all package configs.
                        pkgs[pkgObj.name] = {
                            name: pkgObj.name,
                            location: location || pkgObj.name,
                            //Remove leading dot in main, so main paths are normalized,
                            //and remove any trailing .js, since different package
                            //envs have different conventions: some use a module name,
                            //some use a file name.
                            main: (pkgObj.main || 'main')
                                  .replace(currDirRegExp, '')
                                  .replace(jsSuffixRegExp, '')
                        };
                    });

                    //Done with modifications, assing packages back to context config
                    config.pkgs = pkgs;
                }

                //If there are any "waiting to execute" modules in the registry,
                //update the maps for them, since their info, like URLs to load,
                //may have changed.
                eachProp(registry, function (mod, id) {
                    //If module already has init called, since it is too
                    //late to modify them, and ignore unnormalized ones
                    //since they are transient.
                    if (!mod.inited && !mod.map.unnormalized) {
                        mod.map = makeModuleMap(id);
                    }
                });

                //If a deps array or a config callback is specified, then call
                //require with those args. This is useful when require is defined as a
                //config object before require.js is loaded.
                if (cfg.deps || cfg.callback) {
                    context.require(cfg.deps || [], cfg.callback);
                }
            },

            makeShimExports: function (value) {
                function fn() {
                    var ret;
                    if (value.init) {
                        ret = value.init.apply(global, arguments);
                    }
                    return ret || (value.exports && getGlobal(value.exports));
                }
                return fn;
            },

            makeRequire: function (relMap, options) {
                options = options || {};

                function localRequire(deps, callback, errback) {
                    var id, map, requireMod;

                    if (options.enableBuildCallback && callback && isFunction(callback)) {
                        callback.__requireJsBuild = true;
                    }

                    if (typeof deps === 'string') {
                        if (isFunction(callback)) {
                            //Invalid call
                            return onError(makeError('requireargs', 'Invalid require call'), errback);
                        }

                        //If require|exports|module are requested, get the
                        //value for them from the special handlers. Caveat:
                        //this only works while module is being defined.
                        if (relMap && hasProp(handlers, deps)) {
                            return handlers[deps](registry[relMap.id]);
                        }

                        //Synchronous access to one module. If require.get is
                        //available (as in the Node adapter), prefer that.
                        if (req.get) {
                            return req.get(context, deps, relMap, localRequire);
                        }

                        //Normalize module name, if it contains . or ..
                        map = makeModuleMap(deps, relMap, false, true);
                        id = map.id;

                        if (!hasProp(defined, id)) {
                            return onError(makeError('notloaded', 'Module name "' +
                                        id +
                                        '" has not been loaded yet for context: ' +
                                        contextName +
                                        (relMap ? '' : '. Use require([])')));
                        }
                        return defined[id];
                    }

                    //Grab defines waiting in the global queue.
                    intakeDefines();

                    //Mark all the dependencies as needing to be loaded.
                    context.nextTick(function () {
                        //Some defines could have been added since the
                        //require call, collect them.
                        intakeDefines();

                        requireMod = getModule(makeModuleMap(null, relMap));

                        //Store if map config should be applied to this require
                        //call for dependencies.
                        requireMod.skipMap = options.skipMap;

                        requireMod.init(deps, callback, errback, {
                            enabled: true
                        });

                        checkLoaded();
                    });

                    return localRequire;
                }

                mixin(localRequire, {
                    isBrowser: isBrowser,

                    /**
                     * Converts a module name + .extension into an URL path.
                     * *Requires* the use of a module name. It does not support using
                     * plain URLs like nameToUrl.
                     */
                    toUrl: function (moduleNamePlusExt) {
                        var ext,
                            index = moduleNamePlusExt.lastIndexOf('.'),
                            segment = moduleNamePlusExt.split('/')[0],
                            isRelative = segment === '.' || segment === '..';

                        //Have a file extension alias, and it is not the
                        //dots from a relative path.
                        if (index !== -1 && (!isRelative || index > 1)) {
                            ext = moduleNamePlusExt.substring(index, moduleNamePlusExt.length);
                            moduleNamePlusExt = moduleNamePlusExt.substring(0, index);
                        }

                        return context.nameToUrl(normalize(moduleNamePlusExt,
                                                relMap && relMap.id, true), ext,  true);
                    },

                    defined: function (id) {
                        return hasProp(defined, makeModuleMap(id, relMap, false, true).id);
                    },

                    specified: function (id) {
                        id = makeModuleMap(id, relMap, false, true).id;
                        return hasProp(defined, id) || hasProp(registry, id);
                    }
                });

                //Only allow undef on top level require calls
                if (!relMap) {
                    localRequire.undef = function (id) {
                        //Bind any waiting define() calls to this context,
                        //fix for #408
                        takeGlobalQueue();

                        var map = makeModuleMap(id, relMap, true),
                            mod = getOwn(registry, id);

                        delete defined[id];
                        delete urlFetched[map.url];
                        delete undefEvents[id];

                        if (mod) {
                            //Hold on to listeners in case the
                            //module will be attempted to be reloaded
                            //using a different config.
                            if (mod.events.defined) {
                                undefEvents[id] = mod.events;
                            }

                            cleanRegistry(id);
                        }
                    };
                }

                return localRequire;
            },

            /**
             * Called to enable a module if it is still in the registry
             * awaiting enablement. A second arg, parent, the parent module,
             * is passed in for context, when this method is overriden by
             * the optimizer. Not shown here to keep code compact.
             */
            enable: function (depMap) {
                var mod = getOwn(registry, depMap.id);
                if (mod) {
                    getModule(depMap).enable();
                }
            },

            /**
             * Internal method used by environment adapters to complete a load event.
             * A load event could be a script load or just a load pass from a synchronous
             * load call.
             * @param {String} moduleName the name of the module to potentially complete.
             */
            completeLoad: function (moduleName) {
                var found, args, mod,
                    shim = getOwn(config.shim, moduleName) || {},
                    shExports = shim.exports;

                takeGlobalQueue();

                while (defQueue.length) {
                    args = defQueue.shift();
                    if (args[0] === null) {
                        args[0] = moduleName;
                        //If already found an anonymous module and bound it
                        //to this name, then this is some other anon module
                        //waiting for its completeLoad to fire.
                        if (found) {
                            break;
                        }
                        found = true;
                    } else if (args[0] === moduleName) {
                        //Found matching define call for this script!
                        found = true;
                    }

                    callGetModule(args);
                }

                //Do this after the cycle of callGetModule in case the result
                //of those calls/init calls changes the registry.
                mod = getOwn(registry, moduleName);

                if (!found && !hasProp(defined, moduleName) && mod && !mod.inited) {
                    if (config.enforceDefine && (!shExports || !getGlobal(shExports))) {
                        if (hasPathFallback(moduleName)) {
                            return;
                        } else {
                            return onError(makeError('nodefine',
                                             'No define call for ' + moduleName,
                                             null,
                                             [moduleName]));
                        }
                    } else {
                        //A script that does not call define(), so just simulate
                        //the call for it.
                        callGetModule([moduleName, (shim.deps || []), shim.exportsFn]);
                    }
                }

                checkLoaded();
            },

            /**
             * Converts a module name to a file path. Supports cases where
             * moduleName may actually be just an URL.
             * Note that it **does not** call normalize on the moduleName,
             * it is assumed to have already been normalized. This is an
             * internal API, not a public one. Use toUrl for the public API.
             */
            nameToUrl: function (moduleName, ext, skipExt) {
                var paths, pkgs, pkg, pkgPath, syms, i, parentModule, url,
                    parentPath;

                //If a colon is in the URL, it indicates a protocol is used and it is just
                //an URL to a file, or if it starts with a slash, contains a query arg (i.e. ?)
                //or ends with .js, then assume the user meant to use an url and not a module id.
                //The slash is important for protocol-less URLs as well as full paths.
                if (req.jsExtRegExp.test(moduleName)) {
                    //Just a plain path, not module name lookup, so just return it.
                    //Add extension if it is included. This is a bit wonky, only non-.js things pass
                    //an extension, this method probably needs to be reworked.
                    url = moduleName + (ext || '');
                } else {
                    //A module that needs to be converted to a path.
                    paths = config.paths;
                    pkgs = config.pkgs;

                    syms = moduleName.split('/');
                    //For each module name segment, see if there is a path
                    //registered for it. Start with most specific name
                    //and work up from it.
                    for (i = syms.length; i > 0; i -= 1) {
                        parentModule = syms.slice(0, i).join('/');
                        pkg = getOwn(pkgs, parentModule);
                        parentPath = getOwn(paths, parentModule);
                        if (parentPath) {
                            //If an array, it means there are a few choices,
                            //Choose the one that is desired
                            if (isArray(parentPath)) {
                                parentPath = parentPath[0];
                            }
                            syms.splice(0, i, parentPath);
                            break;
                        } else if (pkg) {
                            //If module name is just the package name, then looking
                            //for the main module.
                            if (moduleName === pkg.name) {
                                pkgPath = pkg.location + '/' + pkg.main;
                            } else {
                                pkgPath = pkg.location;
                            }
                            syms.splice(0, i, pkgPath);
                            break;
                        }
                    }

                    //Join the path parts together, then figure out if baseUrl is needed.
                    url = syms.join('/');
                    url += (ext || (/\?/.test(url) || skipExt ? '' : '.js'));
                    url = (url.charAt(0) === '/' || url.match(/^[\w\+\.\-]+:/) ? '' : config.baseUrl) + url;
                }

                return config.urlArgs ? url +
                                        ((url.indexOf('?') === -1 ? '?' : '&') +
                                         config.urlArgs) : url;
            },

            //Delegates to req.load. Broken out as a separate function to
            //allow overriding in the optimizer.
            load: function (id, url) {
                req.load(context, id, url);
            },

            /**
             * Executes a module callback function. Broken out as a separate function
             * solely to allow the build system to sequence the files in the built
             * layer in the right sequence.
             *
             * @private
             */
            execCb: function (name, callback, args, exports) {
                return callback.apply(exports, args);
            },

            /**
             * callback for script loads, used to check status of loading.
             *
             * @param {Event} evt the event from the browser for the script
             * that was loaded.
             */
            onScriptLoad: function (evt) {
                //Using currentTarget instead of target for Firefox 2.0's sake. Not
                //all old browsers will be supported, but this one was easy enough
                //to support and still makes sense.
                if (evt.type === 'load' ||
                        (readyRegExp.test((evt.currentTarget || evt.srcElement).readyState))) {
                    //Reset interactive script so a script node is not held onto for
                    //to long.
                    interactiveScript = null;

                    //Pull out the name of the module and the context.
                    var data = getScriptData(evt);
                    context.completeLoad(data.id);
                }
            },

            /**
             * Callback for script errors.
             */
            onScriptError: function (evt) {
                var data = getScriptData(evt);
                if (!hasPathFallback(data.id)) {
                    return onError(makeError('scripterror', 'Script error for: ' + data.id, evt, [data.id]));
                }
            }
        };

        context.require = context.makeRequire();
        return context;
    }

    /**
     * Main entry point.
     *
     * If the only argument to require is a string, then the module that
     * is represented by that string is fetched for the appropriate context.
     *
     * If the first argument is an array, then it will be treated as an array
     * of dependency string names to fetch. An optional function callback can
     * be specified to execute when all of those dependencies are available.
     *
     * Make a local req variable to help Caja compliance (it assumes things
     * on a require that are not standardized), and to give a short
     * name for minification/local scope use.
     */
    req = requirejs = function (deps, callback, errback, optional) {

        //Find the right context, use default
        var context, config,
            contextName = defContextName;

        // Determine if have config object in the call.
        if (!isArray(deps) && typeof deps !== 'string') {
            // deps is a config object
            config = deps;
            if (isArray(callback)) {
                // Adjust args if there are dependencies
                deps = callback;
                callback = errback;
                errback = optional;
            } else {
                deps = [];
            }
        }

        if (config && config.context) {
            contextName = config.context;
        }

        context = getOwn(contexts, contextName);
        if (!context) {
            context = contexts[contextName] = req.s.newContext(contextName);
        }

        if (config) {
            context.configure(config);
        }

        return context.require(deps, callback, errback);
    };

    /**
     * Support require.config() to make it easier to cooperate with other
     * AMD loaders on globally agreed names.
     */
    req.config = function (config) {
        return req(config);
    };

    /**
     * Execute something after the current tick
     * of the event loop. Override for other envs
     * that have a better solution than setTimeout.
     * @param  {Function} fn function to execute later.
     */
    req.nextTick = typeof setTimeout !== 'undefined' ? function (fn) {
        setTimeout(fn, 4);
    } : function (fn) { fn(); };

    /**
     * Export require as a global, but only if it does not already exist.
     */
    if (!require) {
        require = req;
    }

    req.version = version;

    //Used to filter out dependencies that are already paths.
    req.jsExtRegExp = /^\/|:|\?|\.js$/;
    req.isBrowser = isBrowser;
    s = req.s = {
        contexts: contexts,
        newContext: newContext
    };

    //Create default context.
    req({});

    //Exports some context-sensitive methods on global require.
    each([
        'toUrl',
        'undef',
        'defined',
        'specified'
    ], function (prop) {
        //Reference from contexts instead of early binding to default context,
        //so that during builds, the latest instance of the default context
        //with its config gets used.
        req[prop] = function () {
            var ctx = contexts[defContextName];
            return ctx.require[prop].apply(ctx, arguments);
        };
    });

    if (isBrowser) {
        head = s.head = document.getElementsByTagName('head')[0];
        //If BASE tag is in play, using appendChild is a problem for IE6.
        //When that browser dies, this can be removed. Details in this jQuery bug:
        //http://dev.jquery.com/ticket/2709
        baseElement = document.getElementsByTagName('base')[0];
        if (baseElement) {
            head = s.head = baseElement.parentNode;
        }
    }

    /**
     * Any errors that require explicitly generates will be passed to this
     * function. Intercept/override it if you want custom error handling.
     * @param {Error} err the error object.
     */
    req.onError = defaultOnError;

    /**
     * Creates the node for the load command. Only used in browser envs.
     */
    req.createNode = function (config, moduleName, url) {
        var node = config.xhtml ?
                document.createElementNS('http://www.w3.org/1999/xhtml', 'html:script') :
                document.createElement('script');
        node.type = config.scriptType || 'text/javascript';
        node.charset = 'utf-8';
        node.async = true;
        return node;
    };

    /**
     * Does the request to load a module for the browser case.
     * Make this a separate function to allow other environments
     * to override it.
     *
     * @param {Object} context the require context to find state.
     * @param {String} moduleName the name of the module.
     * @param {Object} url the URL to the module.
     */
    req.load = function (context, moduleName, url) {
        var config = (context && context.config) || {},
            node;
        if (isBrowser) {
            //In the browser so use a script tag
            node = req.createNode(config, moduleName, url);

            node.setAttribute('data-requirecontext', context.contextName);
            node.setAttribute('data-requiremodule', moduleName);

            //Set up load listener. Test attachEvent first because IE9 has
            //a subtle issue in its addEventListener and script onload firings
            //that do not match the behavior of all other browsers with
            //addEventListener support, which fire the onload event for a
            //script right after the script execution. See:
            //https://connect.microsoft.com/IE/feedback/details/648057/script-onload-event-is-not-fired-immediately-after-script-execution
            //UNFORTUNATELY Opera implements attachEvent but does not follow the script
            //script execution mode.
            if (node.attachEvent &&
                    //Check if node.attachEvent is artificially added by custom script or
                    //natively supported by browser
                    //read https://github.com/jrburke/requirejs/issues/187
                    //if we can NOT find [native code] then it must NOT natively supported.
                    //in IE8, node.attachEvent does not have toString()
                    //Note the test for "[native code" with no closing brace, see:
                    //https://github.com/jrburke/requirejs/issues/273
                    !(node.attachEvent.toString && node.attachEvent.toString().indexOf('[native code') < 0) &&
                    !isOpera) {
                //Probably IE. IE (at least 6-8) do not fire
                //script onload right after executing the script, so
                //we cannot tie the anonymous define call to a name.
                //However, IE reports the script as being in 'interactive'
                //readyState at the time of the define call.
                useInteractive = true;

                node.attachEvent('onreadystatechange', context.onScriptLoad);
                //It would be great to add an error handler here to catch
                //404s in IE9+. However, onreadystatechange will fire before
                //the error handler, so that does not help. If addEventListener
                //is used, then IE will fire error before load, but we cannot
                //use that pathway given the connect.microsoft.com issue
                //mentioned above about not doing the 'script execute,
                //then fire the script load event listener before execute
                //next script' that other browsers do.
                //Best hope: IE10 fixes the issues,
                //and then destroys all installs of IE 6-9.
                //node.attachEvent('onerror', context.onScriptError);
            } else {
                node.addEventListener('load', context.onScriptLoad, false);
                node.addEventListener('error', context.onScriptError, false);
            }
            node.src = url;

            //For some cache cases in IE 6-8, the script executes before the end
            //of the appendChild execution, so to tie an anonymous define
            //call to the module name (which is stored on the node), hold on
            //to a reference to this node, but clear after the DOM insertion.
            currentlyAddingScript = node;
            if (baseElement) {
                head.insertBefore(node, baseElement);
            } else {
                head.appendChild(node);
            }
            currentlyAddingScript = null;

            return node;
        } else if (isWebWorker) {
            try {
                //In a web worker, use importScripts. This is not a very
                //efficient use of importScripts, importScripts will block until
                //its script is downloaded and evaluated. However, if web workers
                //are in play, the expectation that a build has been done so that
                //only one script needs to be loaded anyway. This may need to be
                //reevaluated if other use cases become common.
                importScripts(url);

                //Account for anonymous modules
                context.completeLoad(moduleName);
            } catch (e) {
                context.onError(makeError('importscripts',
                                'importScripts failed for ' +
                                    moduleName + ' at ' + url,
                                e,
                                [moduleName]));
            }
        }
    };

    function getInteractiveScript() {
        if (interactiveScript && interactiveScript.readyState === 'interactive') {
            return interactiveScript;
        }

        eachReverse(scripts(), function (script) {
            if (script.readyState === 'interactive') {
                return (interactiveScript = script);
            }
        });
        return interactiveScript;
    }

    //Look for a data-main script attribute, which could also adjust the baseUrl.
    if (isBrowser) {
        //Figure out baseUrl. Get it from the script tag with require.js in it.
        eachReverse(scripts(), function (script) {
            //Set the 'head' where we can append children by
            //using the script's parent.
            if (!head) {
                head = script.parentNode;
            }

            //Look for a data-main attribute to set main script for the page
            //to load. If it is there, the path to data main becomes the
            //baseUrl, if it is not already set.
            dataMain = script.getAttribute('data-main');
            if (dataMain) {
                //Preserve dataMain in case it is a path (i.e. contains '?')
                mainScript = dataMain;

                //Set final baseUrl if there is not already an explicit one.
                if (!cfg.baseUrl) {
                    //Pull off the directory of data-main for use as the
                    //baseUrl.
                    src = mainScript.split('/');
                    mainScript = src.pop();
                    subPath = src.length ? src.join('/')  + '/' : './';

                    cfg.baseUrl = subPath;
                }

                //Strip off any trailing .js since mainScript is now
                //like a module name.
                mainScript = mainScript.replace(jsSuffixRegExp, '');

                 //If mainScript is still a path, fall back to dataMain
                if (req.jsExtRegExp.test(mainScript)) {
                    mainScript = dataMain;
                }

                //Put the data-main script in the files to load.
                cfg.deps = cfg.deps ? cfg.deps.concat(mainScript) : [mainScript];

                return true;
            }
        });
    }

    /**
     * The function that handles definitions of modules. Differs from
     * require() in that a string for the module should be the first argument,
     * and the function to execute after dependencies are loaded should
     * return a value to define the module corresponding to the first argument's
     * name.
     */
    define = function (name, deps, callback) {
        var node, context;

        //Allow for anonymous modules
        if (typeof name !== 'string') {
            //Adjust args appropriately
            callback = deps;
            deps = name;
            name = null;
        }

        //This module may not have dependencies
        if (!isArray(deps)) {
            callback = deps;
            deps = null;
        }

        //If no name, and callback is a function, then figure out if it a
        //CommonJS thing with dependencies.
        if (!deps && isFunction(callback)) {
            deps = [];
            //Remove comments from the callback string,
            //look for require calls, and pull them into the dependencies,
            //but only if there are function args.
            if (callback.length) {
                callback
                    .toString()
                    .replace(commentRegExp, '')
                    .replace(cjsRequireRegExp, function (match, dep) {
                        deps.push(dep);
                    });

                //May be a CommonJS thing even without require calls, but still
                //could use exports, and module. Avoid doing exports and module
                //work though if it just needs require.
                //REQUIRES the function to expect the CommonJS variables in the
                //order listed below.
                deps = (callback.length === 1 ? ['require'] : ['require', 'exports', 'module']).concat(deps);
            }
        }

        //If in IE 6-8 and hit an anonymous define() call, do the interactive
        //work.
        if (useInteractive) {
            node = currentlyAddingScript || getInteractiveScript();
            if (node) {
                if (!name) {
                    name = node.getAttribute('data-requiremodule');
                }
                context = contexts[node.getAttribute('data-requirecontext')];
            }
        }

        //Always save off evaluating the def call until the script onload handler.
        //This allows multiple modules to be in a file without prematurely
        //tracing dependencies, and allows for anonymous module support,
        //where the module name is not known until the script onload event
        //occurs. If no context, use the global queue, and get it processed
        //in the onscript load callback.
        (context ? context.defQueue : globalDefQueue).push([name, deps, callback]);
    };

    define.amd = {
        jQuery: true
    };


    /**
     * Executes the text. Normally just uses eval, but can be modified
     * to use a better, environment-specific call. Only used for transpiling
     * loader plugins, not for plain JS modules.
     * @param {String} text the text to execute/evaluate.
     */
    req.exec = function (text) {
        /*jslint evil: true */
        return eval(text);
    };

    //Set up with config info.
    req(cfg);
}(this));

define("contrib/require", function(){});

define('splunkjs/config',{});
// reference this from another build profile with mainConfigFile: './shared.build.profile.js'
require.config({
    baseUrl: '../',
    preserveLicenseComments: false,
    wrap: {
        startFile: [
            // load the json2 library so that all modules get the cross-browser JSON support
            // without having to declare it as a dependency
            '../contrib/json2.js'
        ],
        end: ' '
    },
    stubModules: ['contrib/text'],
    map: {
        "*": {
            css: "splunkjs/contrib/require-css/css"
        }
    },
    paths: {
        // paths outside of baseUrl
        'templates': '../../templates',

        // jQuery and contrib plugins
        'jquery': 'contrib/jquery-1.10.2',
        'jquery.history': 'contrib/jquery.history',
        'jquery.bgiframe': 'contrib/jquery.bgiframe-3.0.0',
        'jquery.cookie': 'contrib/jquery.cookie',

        // internal jQuery plugins
        'splunk.jquery.csrf': 'splunk.jquery.csrf_protection',

        // jQuery UI plugins
        'jquery.ui.core': 'contrib/jquery-ui-1.10.3/jquery.ui.core',
        'jquery.ui.widget': 'contrib/jquery-ui-1.10.3/jquery.ui.widget',
        'jquery.ui.datepicker': 'contrib/jquery-ui-1.10.3/jquery.ui.datepicker',
        'jquery.ui.position': 'contrib/jquery-ui-1.10.3/jquery.ui.position',
        'jquery.ui.mouse': 'contrib/jquery-ui-1.10.3/jquery.ui.mouse',
        'jquery.ui.draggable': 'contrib/jquery-ui-1.10.3/jquery.ui.draggable',
        'jquery.ui.droppable': 'contrib/jquery-ui-1.10.3/jquery.ui.droppable',
        'jquery.ui.sortable': 'contrib/jquery-ui-1.10.3/jquery.ui.sortable',
        'jquery.ui.resizable': 'contrib/jquery-ui-1.10.3/jquery.ui.resizable',
        'jquery.ui.button': 'contrib/jquery-ui-1.10.3/jquery.ui.button',
        'jquery.ui.spinner': 'contrib/jquery-ui-1.10.3/jquery.ui.spinner',

        // bootstrap components
        // FIXME: bootstrap.button collides with jquery.ui.button on the jQuery prototype !!
        'bootstrap.affix': 'contrib/bootstrap-2.3.1/bootstrap-affix',
        'bootstrap.alert': 'contrib/bootstrap-2.3.1/bootstrap-alert',
        'bootstrap.button': 'contrib/bootstrap-2.3.1/bootstrap-button',
        'bootstrap.carousel': 'contrib/bootstrap-2.3.1/bootstrap-carousel',
        'bootstrap.collapse': 'contrib/bootstrap-2.3.1/bootstrap-collapse',
        'bootstrap.dropdown': 'contrib/bootstrap-2.3.1/bootstrap-dropdown',
        'bootstrap.modal': 'contrib/bootstrap-2.3.1/bootstrap-modal',
        'bootstrap.popover': 'contrib/bootstrap-2.3.1/bootstrap-popover',
        'bootstrap.scrollspy': 'contrib/bootstrap-2.3.1/bootstrap-scrollspy',
        'bootstrap.tab': 'contrib/bootstrap-2.3.1/bootstrap-tab',
        'bootstrap.tooltip': 'contrib/bootstrap-2.3.1/bootstrap-tooltip',
        'bootstrap.transition': 'contrib/bootstrap-2.3.1/bootstrap-transition',
        'bootstrap.typeahead': 'contrib/bootstrap-2.3.1/bootstrap-typeahead',

        // other contrib libraries
        'moment': 'contrib/moment',
        
        'underscore': 'contrib/lodash',
        'lodash': 'contrib/lodash.underscore',
        
        'backbone': 'contrib/backbone',
        'highcharts': 'contrib/highcharts-3.0.7/highcharts',
        'highcharts.runtime_patches': 'contrib/highcharts-3.0.7/runtime_patches',
        'json': 'contrib/json2',
        'backbone_validation': 'contrib/backbone-validation-amd',
        'prettify': 'contrib/google-code-prettify/prettify',
        /* augments builtin prototype */
        'strftime': 'contrib/strftime',
        'swfobject': 'contrib/swfobject',
        'leaflet': 'contrib/leaflet/leaflet',
        'jg_global': 'contrib/jg_global',
        'jgatt': 'contrib/jg_library',
        'lowpro': 'contrib/lowpro_for_jquery',
        'spin': 'contrib/spin',

        // Splunk legacy
        'splunk': 'splunk',
        'splunk.legend': 'legend',
        'splunk.logger': 'logger',
        'splunk.error': 'error',
        'splunk.util': 'util',
        'splunk.pdf': 'pdf',
        'splunk.i18n': 'stubs/i18n',
        'splunk.config': 'stubs/splunk.config',
        'splunk.paginator': 'paginator',
        'splunk.messenger': 'messenger',
        'splunk.time': 'splunk_time',
        'splunk.timerange': 'time_range',
        'splunk.window': 'window',
        'splunk.jabridge': 'ja_bridge',
        'splunk.print': 'print',
        'splunk.session': 'session',
        
        // splunkjs
        "async": "splunkjs/contrib/requirejs-plugins/async",
        "select2": "contrib/select2-3.3.1",

        // paths for deprecated versions of jquery
        'contrib/jquery-1.8.2': 'contrib/deprecated/jquery-1.8.2',
        'contrib/jquery-1.8.3': 'contrib/deprecated/jquery-1.8.3'
    },
    shim: {

        /* START splunkjs */
        'splunkjs/splunk': {
            deps: ['jquery'],
            exports: 'splunkjs'
        },
        
        /* Select2*/
        "select2/select2": {
            deps: ["jquery"],
            exports: "Select2"
        },

        /* START contrib jQuery plugins */
        'jquery.migrate': {
            deps: ['contrib/jquery-1.10.2'],
            exports: 'jQuery'
        },
        'jquery.cookie': {
            deps: ['jquery']
        },
        'jquery.history': {
            deps: ['jquery'],
                exports: 'History'
        },
        'jquery.bgiframe': {
            deps: ['jquery']
        },

        "jquery.attributes": {
            deps: ['jquery']
        },

        "jquery.spin": {
            deps: ['jquery']
        },

        "jquery.sparkline": {
            deps: ['jquery']
        },

        "jquery.deparam": {
            deps: ['jquery']
        },

        /* START internal jQuery plugins */
        'splunk.jquery.csrf_protection': {
            deps: ['jquery.cookie', 'splunk.util']
        },

        /* START jQuery UI plugins */
        'jquery.ui.core': {
            deps: ['jquery']
        },
        'jquery.ui.widget': {
            deps: ['jquery.ui.core']
        },
        'jquery.ui.position': {
            deps: ['jquery.ui.widget']
        },
        'jquery.ui.mouse': {
            deps: ['jquery.ui.widget']
        },
        'jquery.ui.sortable': {
            deps: ['jquery.ui.widget', 'jquery.ui.mouse', 'jquery.ui.draggable', 'jquery.ui.droppable']
        },
        'jquery.ui.draggable': {
            deps: ['jquery.ui.widget', 'jquery.ui.mouse']
        },
        'jquery.ui.droppable': {
            deps: ['jquery.ui.widget', 'jquery.ui.mouse']
        },
        'jquery.ui.resizable': {
            deps: ['jquery.ui.widget', 'jquery.ui.mouse']
        },
        'jquery.ui.datepicker': {
            deps: ['jquery', 'jquery.ui.widget', 'splunk.i18n'],
            exports: 'jquery.ui.datepicker',
            init: function(jQuery, widget, i18n) {
                var initFn = i18n.jQuery_ui_datepicker_install;
                if (typeof initFn === 'function') {
                    initFn(jQuery);
                }
                return jQuery.ui.datepicker;
            }
        },
        'jquery.ui.button': {
            deps: ['jquery.ui.widget', 'jquery.ui.core']
        },
        'jquery.ui.spinner': {
            deps: ['jquery.ui.widget', 'jquery.ui.core', 'jquery.ui.button']
        },

        // bootstrap components
        'bootstrap.affix': {
            deps: ['jquery']
        },
        'bootstrap.alert': {
            deps: ['jquery']
        },
        'bootstrap.button': {
            deps: ['jquery']
        },
        'bootstrap.carousel': {
            deps: ['jquery']
        },
        'bootstrap.collapse': {
            deps: ['jquery']
        },
        'bootstrap.dropdown': {
            deps: ['jquery']
        },
        'bootstrap.modal': {
            deps: ['jquery']
        },
        'bootstrap.popover': {
            deps: ['jquery', 'bootstrap.tooltip']
        },
        'bootstrap.scrollspy': {
            deps: ['jquery']
        },
        'bootstrap.tab': {
            deps: ['jquery']
        },
        'bootstrap.tooltip': {
            deps: ['jquery']
        },
        'bootstrap.transition': {
            deps: ['jquery']
        },
        'bootstrap.typeahead': {
            deps: ['jquery']
        },

        /* START other contrib libraries */
        backbone: {
            deps: ['jquery', 'underscore'],
            exports: 'Backbone',
            init: function($, _) {
                // now that Backbone has a reference to underscore, we need to give the '_' back to i18n
                _.noConflict();

                // inject a reference to jquery in case we ever run it in no conflict mode
                // set up for forward compatibility with Backbone, setDomLibrary is being replaced with Backbone.$
                if(this.Backbone.hasOwnProperty('setDomLibrary')) {
                    this.Backbone.setDomLibrary($);
                }
                else {
                    this.Backbone.$ = $;
                }
                return this.Backbone.noConflict();
            }
        },
        "backbone.nested": {
            // Not sure if needed
            deps: ['backbone'],
            exports: 'Backbone.NestedModel'
        },
        highcharts: {
            deps: ['jquery', 'highcharts.runtime_patches'],
            exports: 'Highcharts',
            init: function($, runtimePatches) {
                runtimePatches.applyPatches(this.Highcharts);
                return this.Highcharts;
            }
        },
        json: {
            exports: 'JSON'
        },
        swfobject: {
            exports: 'swfobject'
        },
        prettify: {
            exports: 'prettyPrint'
        },
        leaflet: {
            deps: ['jquery', 'splunk.util', 'splunk.config', 'helpers/user_agent', 'contrib/text!contrib/leaflet/leaflet.css', 'contrib/text!contrib/leaflet/leaflet.ie.css'],
            exports: 'L',
            init: function($, SplunkUtil, splunkConfig, userAgent, css, iecss) {
                if (splunkConfig.INDEPENDENT_MODE) {
                    var imageUrl = require.toUrl('') + 'splunkjs/contrib/leaflet/images';
                    css = css.replace(/url\(images/g, 'url(' + imageUrl);     
                }
                else {
                    // resolve image urls
                    css = css.replace(/url\(images/g, "url(" + SplunkUtil.make_url("/static/js/contrib/leaflet/images"));
                }
                // inject css into head
                $("head").append("<style type=\"text/css\">" + css + "</style>");

                // if IE <= 8, inject iecss into head
                if (userAgent.isIELessThan(9))
                    $("head").append("<style type=\"text/css\">" + iecss + "</style>");
            }
        },
        jg_global: {
            // exports just needs to be one of the globals that is created so that require can verify that the source was loaded
            exports: 'jg_namespace',
            init: function() {
                return {
                    jg_namespace: this.jg_namespace,
                    jg_extend: this.jg_extend,
                    jg_static: this.jg_static,
                    jg_mixin: this.jg_mixin,
                    jg_has_mixin: this.jg_has_mixin
                };
            }
        },
        jgatt: {
            deps: ['jg_global'],
            exports: 'jgatt'
        },
        lowpro: {
            deps: ['jquery']
        },

        /* Start Splunk legacy */
        splunk: {
            exports: 'Splunk'
        },
        'splunk.util': {
            deps: ['jquery', 'splunk', 'splunk.config'],
            exports: 'Splunk.util',
            init: function($, Splunk, config) {
                return $.extend({ sprintf: this.sprintf }, Splunk.util);
            }
        },
        'splunk.legend': {
            deps: ['splunk'],
                exports: 'Splunk.Legend'
        },
        'splunk.logger': {
            deps: ['splunk', 'splunk.util'],
                exports: 'Splunk.Logger'
        },
        'splunk.error': {
            deps: ['jquery', 'splunk', 'splunk.logger'],
            exports: 'Splunk.Error'
        },
        'splunk.pdf': {
            deps: ['splunk', 'splunk.util', 'jquery'],
            exports: 'Splunk.pdf'
        },
        strftime: {
            deps: []
        },
        'splunk.paginator': {
            deps: ['splunk'],
                exports: 'Splunk.paginator'
        },
        'splunk.jquery.csrf': {
            deps: ['jquery', 'jquery.cookie', 'splunk.util']
        },
        'splunk.messenger': {
            deps: ['splunk', 'splunk.util', 'splunk.logger', 'splunk.i18n', 'lowpro'],
            exports: 'Splunk.Messenger'
        },
        'splunk.time': {
            deps: ['jg_global', 'jgatt'],
            exports: 'splunk.time'
        },
        'splunk.timerange': {
            deps: ['splunk', 'splunk.util', 'splunk.logger', 'splunk.i18n', 'splunk.time', 'lowpro'],
            exports: 'Splunk.Timerange',
            init: function(Splunk) {
                Splunk.namespace("Globals");
                if (!Splunk.Globals.timeZone) {
                    Splunk.Globals.timeZone = new Splunk.TimeZone(Splunk.util.getConfigValue('SERVER_ZONEINFO'));
                }
                return Splunk.TimeRange;
            }
        },
        'splunk.window': {
            deps: ['splunk', 'splunk.util', 'splunk.i18n'],
            exports: 'Splunk.window'
        },
        'splunk.jabridge': {
            deps: ['splunk'],
            exports: 'Splunk.JABridge'
        },
        'splunk.print': {
            deps: ['jquery', 'lowpro', 'splunk', 'splunk.logger'],
            exports: 'Splunk.Print'
        },
        'splunk.session': {
            deps: ['lowpro', 'splunk', 'jquery', 'splunk.logger', 'splunk.util', 'swfobject'],
            exports: 'Splunk.Session'
        },

        // shim handlers for the various versions of jquery

        'contrib/jquery-1.10.2': {
            exports: 'jQuery'
        },
        'contrib/jquery-1.8.2': {
            exports: 'jQuery',
            init: function() {
                if(this.console && typeof this.console.warn === 'function') {
                    this.console.warn('You are using a deprecated version of jQuery, please upgrade to the latest version');
                }
                return this.jQuery;
            }
        },
        'contrib/jquery-1.8.3': {
            exports: 'jQuery',
            init: function() {
                if(this.console && typeof this.console.warn === 'function') {
                    this.console.warn('You are using a deprecated version of jQuery, please upgrade to the latest version');
                }
                return this.jQuery;
            }
        }
    }
})


;
define("profiles/shared", function(){});

/*
    http://www.JSON.org/json2.js
    2009-04-16

    Public Domain.

    NO WARRANTY EXPRESSED OR IMPLIED. USE AT YOUR OWN RISK.

    See http://www.JSON.org/js.html

    This file creates a global JSON object containing two methods: stringify
    and parse.

        JSON.stringify(value, replacer, space)
            value       any JavaScript value, usually an object or array.

            replacer    an optional parameter that determines how object
                        values are stringified for objects. It can be a
                        function or an array of strings.

            space       an optional parameter that specifies the indentation
                        of nested structures. If it is omitted, the text will
                        be packed without extra whitespace. If it is a number,
                        it will specify the number of spaces to indent at each
                        level. If it is a string (such as '\t' or '&nbsp;'),
                        it contains the characters used to indent at each level.

            This method produces a JSON text from a JavaScript value.

            When an object value is found, if the object contains a toJSON
            method, its toJSON method will be called and the result will be
            stringified. A toJSON method does not serialize: it returns the
            value represented by the name/value pair that should be serialized,
            or undefined if nothing should be serialized. The toJSON method
            will be passed the key associated with the value, and this will be
            bound to the object holding the key.

            For example, this would serialize Dates as ISO strings.

                Date.prototype.toJSON = function (key) {
                    function f(n) {
                        // Format integers to have at least two digits.
                        return n < 10 ? '0' + n : n;
                    }

                    return this.getUTCFullYear()   + '-' +
                         f(this.getUTCMonth() + 1) + '-' +
                         f(this.getUTCDate())      + 'T' +
                         f(this.getUTCHours())     + ':' +
                         f(this.getUTCMinutes())   + ':' +
                         f(this.getUTCSeconds())   + 'Z';
                };

            You can provide an optional replacer method. It will be passed the
            key and value of each member, with this bound to the containing
            object. The value that is returned from your method will be
            serialized. If your method returns undefined, then the member will
            be excluded from the serialization.

            If the replacer parameter is an array of strings, then it will be
            used to select the members to be serialized. It filters the results
            such that only members with keys listed in the replacer array are
            stringified.

            Values that do not have JSON representations, such as undefined or
            functions, will not be serialized. Such values in objects will be
            dropped; in arrays they will be replaced with null. You can use
            a replacer function to replace those with JSON values.
            JSON.stringify(undefined) returns undefined.

            The optional space parameter produces a stringification of the
            value that is filled with line breaks and indentation to make it
            easier to read.

            If the space parameter is a non-empty string, then that string will
            be used for indentation. If the space parameter is a number, then
            the indentation will be that many spaces.

            Example:

            text = JSON.stringify(['e', {pluribus: 'unum'}]);
            // text is '["e",{"pluribus":"unum"}]'


            text = JSON.stringify(['e', {pluribus: 'unum'}], null, '\t');
            // text is '[\n\t"e",\n\t{\n\t\t"pluribus": "unum"\n\t}\n]'

            text = JSON.stringify([new Date()], function (key, value) {
                return this[key] instanceof Date ?
                    'Date(' + this[key] + ')' : value;
            });
            // text is '["Date(---current time---)"]'


        JSON.parse(text, reviver)
            This method parses a JSON text to produce an object or array.
            It can throw a SyntaxError exception.

            The optional reviver parameter is a function that can filter and
            transform the results. It receives each of the keys and values,
            and its return value is used instead of the original value.
            If it returns what it received, then the structure is not modified.
            If it returns undefined then the member is deleted.

            Example:

            // Parse the text. Values that look like ISO date strings will
            // be converted to Date objects.

            myData = JSON.parse(text, function (key, value) {
                var a;
                if (typeof value === 'string') {
                    a =
/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*)?)Z$/.exec(value);
                    if (a) {
                        return new Date(Date.UTC(+a[1], +a[2] - 1, +a[3], +a[4],
                            +a[5], +a[6]));
                    }
                }
                return value;
            });

            myData = JSON.parse('["Date(09/09/2001)"]', function (key, value) {
                var d;
                if (typeof value === 'string' &&
                        value.slice(0, 5) === 'Date(' &&
                        value.slice(-1) === ')') {
                    d = new Date(value.slice(5, -1));
                    if (d) {
                        return d;
                    }
                }
                return value;
            });


    This is a reference implementation. You are free to copy, modify, or
    redistribute.

    This code should be minified before deployment.
    See http://javascript.crockford.com/jsmin.html

    USE YOUR OWN COPY. IT IS EXTREMELY UNWISE TO LOAD CODE FROM SERVERS YOU DO
    NOT CONTROL.
*/

/*jslint evil: true */

/*global JSON */

/*members "", "\b", "\t", "\n", "\f", "\r", "\"", JSON, "\\", apply,
    call, charCodeAt, getUTCDate, getUTCFullYear, getUTCHours,
    getUTCMinutes, getUTCMonth, getUTCSeconds, hasOwnProperty, join,
    lastIndex, length, parse, prototype, push, replace, slice, stringify,
    test, toJSON, toString, valueOf
*/

// Create a JSON object only if one does not already exist. We create the
// methods in a closure to avoid creating global variables.

if (!this.JSON) {
    JSON = {};
}
(function () {

    function f(n) {
        // Format integers to have at least two digits.
        return n < 10 ? '0' + n : n;
    }

    if (typeof Date.prototype.toJSON !== 'function') {

        Date.prototype.toJSON = function (key) {

            return this.getUTCFullYear()   + '-' +
                 f(this.getUTCMonth() + 1) + '-' +
                 f(this.getUTCDate())      + 'T' +
                 f(this.getUTCHours())     + ':' +
                 f(this.getUTCMinutes())   + ':' +
                 f(this.getUTCSeconds())   + 'Z';
        };

        String.prototype.toJSON =
        Number.prototype.toJSON =
        Boolean.prototype.toJSON = function (key) {
            return this.valueOf();
        };
    }

    var cx = /[\u0000\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
        escapable = /[\\\"\x00-\x1f\x7f-\x9f\u00ad\u0600-\u0604\u070f\u17b4\u17b5\u200c-\u200f\u2028-\u202f\u2060-\u206f\ufeff\ufff0-\uffff]/g,
        gap,
        indent,
        meta = {    // table of character substitutions
            '\b': '\\b',
            '\t': '\\t',
            '\n': '\\n',
            '\f': '\\f',
            '\r': '\\r',
            '"' : '\\"',
            '\\': '\\\\'
        },
        rep;


    function quote(string) {

// If the string contains no control characters, no quote characters, and no
// backslash characters, then we can safely slap some quotes around it.
// Otherwise we must also replace the offending characters with safe escape
// sequences.

        escapable.lastIndex = 0;
        return escapable.test(string) ?
            '"' + string.replace(escapable, function (a) {
                var c = meta[a];
                return typeof c === 'string' ? c :
                    '\\u' + ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
            }) + '"' :
            '"' + string + '"';
    }


    function str(key, holder) {

// Produce a string from holder[key].

        var i,          // The loop counter.
            k,          // The member key.
            v,          // The member value.
            length,
            mind = gap,
            partial,
            value = holder[key];

// If the value has a toJSON method, call it to obtain a replacement value.

        if (value && typeof value === 'object' &&
                typeof value.toJSON === 'function') {
            value = value.toJSON(key);
        }

// If we were called with a replacer function, then call the replacer to
// obtain a replacement value.

        if (typeof rep === 'function') {
            value = rep.call(holder, key, value);
        }

// What happens next depends on the value's type.

        switch (typeof value) {
        case 'string':
            return quote(value);

        case 'number':

// JSON numbers must be finite. Encode non-finite numbers as null.

            return isFinite(value) ? String(value) : 'null';

        case 'boolean':
        case 'null':

// If the value is a boolean or null, convert it to a string. Note:
// typeof null does not produce 'null'. The case is included here in
// the remote chance that this gets fixed someday.

            return String(value);

// If the type is 'object', we might be dealing with an object or an array or
// null.

        case 'object':

// Due to a specification blunder in ECMAScript, typeof null is 'object',
// so watch out for that case.

            if (!value) {
                return 'null';
            }

// Make an array to hold the partial results of stringifying this object value.

            gap += indent;
            partial = [];

// Is the value an array?

            if (Object.prototype.toString.apply(value) === '[object Array]') {

// The value is an array. Stringify every element. Use null as a placeholder
// for non-JSON values.

                length = value.length;
                for (i = 0; i < length; i += 1) {
                    partial[i] = str(i, value) || 'null';
                }

// Join all of the elements together, separated with commas, and wrap them in
// brackets.

                v = partial.length === 0 ? '[]' :
                    gap ? '[\n' + gap +
                            partial.join(',\n' + gap) + '\n' +
                                mind + ']' :
                          '[' + partial.join(',') + ']';
                gap = mind;
                return v;
            }

// If the replacer is an array, use it to select the members to be stringified.

            if (rep && typeof rep === 'object') {
                length = rep.length;
                for (i = 0; i < length; i += 1) {
                    k = rep[i];
                    if (typeof k === 'string') {
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (gap ? ': ' : ':') + v);
                        }
                    }
                }
            } else {

// Otherwise, iterate through all of the keys in the object.

                for (k in value) {
                    if (Object.hasOwnProperty.call(value, k)) {
                        v = str(k, value);
                        if (v) {
                            partial.push(quote(k) + (gap ? ': ' : ':') + v);
                        }
                    }
                }
            }

// Join all of the member texts together, separated with commas,
// and wrap them in braces.

            v = partial.length === 0 ? '{}' :
                gap ? '{\n' + gap + partial.join(',\n' + gap) + '\n' +
                        mind + '}' : '{' + partial.join(',') + '}';
            gap = mind;
            return v;
        }
    }

// If the JSON object does not yet have a stringify method, give it one.

    if (typeof JSON.stringify !== 'function') {
        JSON.stringify = function (value, replacer, space) {

// The stringify method takes a value and an optional replacer, and an optional
// space parameter, and returns a JSON text. The replacer can be a function
// that can replace values, or an array of strings that will select the keys.
// A default replacer method can be provided. Use of the space parameter can
// produce text that is more easily readable.

            var i;
            gap = '';
            indent = '';

// If the space parameter is a number, make an indent string containing that
// many spaces.

            if (typeof space === 'number') {
                for (i = 0; i < space; i += 1) {
                    indent += ' ';
                }

// If the space parameter is a string, it will be used as the indent string.

            } else if (typeof space === 'string') {
                indent = space;
            }

// If there is a replacer, it must be a function or an array.
// Otherwise, throw an error.

            rep = replacer;
            if (replacer && typeof replacer !== 'function' &&
                    (typeof replacer !== 'object' ||
                     typeof replacer.length !== 'number')) {
                throw new Error('JSON.stringify');
            }

// Make a fake root object containing our value under the key of ''.
// Return the result of stringifying the value.

            return str('', {'': value});
        };
    }


// If the JSON object does not yet have a parse method, give it one.

    if (typeof JSON.parse !== 'function') {
        JSON.parse = function (text, reviver) {

// The parse method takes a text and an optional reviver function, and returns
// a JavaScript value if the text is a valid JSON text.

            var j;

            function walk(holder, key) {

// The walk method is used to recursively walk the resulting structure so
// that modifications can be made.

                var k, v, value = holder[key];
                if (value && typeof value === 'object') {
                    for (k in value) {
                        if (Object.hasOwnProperty.call(value, k)) {
                            v = walk(value, k);
                            if (v !== undefined) {
                                value[k] = v;
                            } else {
                                delete value[k];
                            }
                        }
                    }
                }
                return reviver.call(holder, key, value);
            }


// Parsing happens in four stages. In the first stage, we replace certain
// Unicode characters with escape sequences. JavaScript handles many characters
// incorrectly, either silently deleting them, or treating them as line endings.

            cx.lastIndex = 0;
            if (cx.test(text)) {
                text = text.replace(cx, function (a) {
                    return '\\u' +
                        ('0000' + a.charCodeAt(0).toString(16)).slice(-4);
                });
            }

// In the second stage, we run the text against regular expressions that look
// for non-JSON patterns. We are especially concerned with '()' and 'new'
// because they can cause invocation, and '=' because it can cause mutation.
// But just to be safe, we want to reject all unexpected forms.

// We split the second stage into 4 regexp operations in order to work around
// crippling inefficiencies in IE's and Safari's regexp engines. First we
// replace the JSON backslash pairs with '@' (a non-JSON character). Second, we
// replace all simple value tokens with ']' characters. Third, we delete all
// open brackets that follow a colon or comma or that begin the text. Finally,
// we look to see that the remaining characters are only whitespace or ']' or
// ',' or ':' or '{' or '}'. If that is so, then the text is safe for eval.

            if (/^[\],:{}\s]*$/.
test(text.replace(/\\(?:["\\\/bfnrt]|u[0-9a-fA-F]{4})/g, '@').
replace(/"[^"\\\n\r]*"|true|false|null|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?/g, ']').
replace(/(?:^|:|,)(?:\s*\[)+/g, ''))) {

// In the third stage we use the eval function to compile the text into a
// JavaScript structure. The '{' operator is subject to a syntactic ambiguity
// in JavaScript: it can begin a block or an object literal. We wrap the text
// in parens to eliminate the ambiguity.

                j = eval('(' + text + ')');

// In the optional fourth stage, we recursively walk the new structure, passing
// each name/value pair to a reviver function for possible transformation.

                return typeof reviver === 'function' ?
                    walk({'': j}, '') : j;
            }

// If the text is not JSON parseable, then a SyntaxError is thrown.

            throw new SyntaxError('JSON.parse');
        };
    }
}());

define("json", (function (global) {
    return function () {
        var ret, fn;
        return ret || global.JSON;
    };
}(this)));

// preload.js is executed immediately when splunkjs/config is required
// when the framework is run in a compiled mode.
// 
// JIRA: Make splunkjs.config() available even when running in splunkweb
//       with use_built_files:false. (DVPL-3551)

// Create splunkjs global
if (!window.splunkjs) {
    window.splunkjs = {};
}

(function() {
    var _configureErrorHandler = function() {
        // splunk.error is a legacy module which ignores JS_LOGGER_MODE = None
        // and always patches window.onerror to log to the splunk server
        // However, in this context, the splunkweb server is not available. 
        // In order to re-patch window.onerror not to log to the server,
        // this intercepts imports of splunk.error and patches the window's
        // error handler to do nothing. 
        require.config({
            map: {
                '*': {
                    'splunk.error': 'errorintercept'
                }
            }
        });
        define('errorintercept',['require','exports','module'], function(require, exports, module) {
            // Repatch window.onerror to override patch by error.js (splunk.error)
            window.onerror = function(e) {
                // Ignore errors similarly to JS_LOGGER_MODE = None

                // This is for test use only. If the test sets up an
                // error function on window, we call it.
                if (window._SPLUNK_TEST_ERROR) {
                    window._SPLUNK_TEST_ERROR();
                }
            };
            return {};
        });
    };

    // A check for minification. This is the only 
    // place there should be a runtime check for this.
    // For now we check the require base URL to see if we are 
    // in minified mode. 
    var _isMinified = function(){
        var mvcUrl = require.toUrl('splunkjs/mvc');
        return mvcUrl.indexOf('splunkjs.min') > -1;
    };

    var _configureMinify = function() {
        // If minified, we re-map the path to urlResolver
        if (_isMinified()) {
            require.config({
                paths: {
                    'splunkjs/generated/urlresolver': 'splunkjs.min/generated/urlresolver'
                }
            });
        }
    };

    /**
     * Configures the SplunkJS Stack.
     * 
     * Accepts a dictionary with the following keys:
     *  - proxyPath:
     *      Absolute URL path of the server-side proxy to splunkd.
     *      If omitted, no proxy will be used to communicate with splunkd.
     *      Instead, splunkd will be directly accessed via CORS at <scheme>://<host>:<port>/.
     *  - scheme:
     *      Scheme of the splunkd server to connect to. Either 'https' or 'http'.
     *      Default: 'https'
     *  - host:
     *      Hostname of the splunkd server to connect to.
     *      Default: 'localhost'
     *  - port:
     *      Port of the splunkd server to connect to.
     *      Default: 8089
     *  - authenticate:
     *      Either (1) a function of signature `(done)` that logs in to splunkd and
     *                 then invokes the callback `done`. The signature of `done` is
     *                 `(err, {sessionKey: <key>, username: <username>})`. A falsy 
                       `err` is interpreted as success.
     *          or (2) a dictionary of {username: 'admin', password: 'changeme'}
     *      If a dictionary is passed, an default authentication function will be
     *      generated internally.
     *      Required. Example: {username: 'admin', password: 'changeme'}
     *  - onSessionExpired:
     *      A function of signature `(authFunction, done)` that will be called upon session
     *      timeout. The original authenticate function (possibly generated) is passed as `authFunction`
     *      Default: if no onSessionExpired is provided, the original authenticate will be used.      
     *  - app:
     *      Default app in which Splunk entities will be accessed.
     *      Default: 'search'
     *  - locale:
     *      Language code for the locale in which the UI should be displayed.
     *      Default: 'en-us'
     *  - freeLicense:
     *      Whether Splunk is using the free license.
     *      Default: false
     *  - onDrilldown:
     *      A function of signature `(params, newWindow)` that will be called as the
     *      default drilldown action for controls. `params` are the parameters to
     *      send to the target view. `newWindow` is whether to open the target view
     *      in a new window.
     *      Default: no-op
     *  - custom:
     *      Accepts additional keys. Only use this if instructed by Splunk Support.
     */
    window.splunkjs.config = function(params) {

        // Setting up error handler before any top-level errors.
        _configureErrorHandler();

        // Set up minified-specific paths
        _configureMinify();

        if (window.$C) {
            throw new Error('splunkjs.config: Called multiple times. Or $C is already defined.');
        }
        
        if (!params.authenticate) {
            throw new Error('splunkjs.config: Missing required key: authenticate');
        }

        if (params.onSessionExpired && (typeof(params.onSessionExpired) !== "function")) {
            throw new Error("splunkjs.config: Must be a function: onSessionExpired");  
        }

        // This path is used if there is no proxyPath set
        var splunkdPath = (params.scheme || 'https') 
            + '://' 
            + (params.host || 'localhost')
            + ':'
            + (params.port || '8089');

        var app = params.app || 'search';
        var freeLicense = params.hasOwnProperty('freeLicense')
            ? params.freeLicense
            : false;
        
        // Define global client-side configuration
        window.$C = {
            'SPLUNKD_PATH': params.proxyPath || splunkdPath,
            'SPLUNKD_IS_PROXIED': params.proxyPath ? true : false,
            'SCHEME': params.scheme || 'https',
            'HOST': params.host || 'localhost',
            'PORT': params.port || 8089,
            'AUTHENTICATE': params.authenticate || {username: 'admin', password: 'changeme'},
            'ON_SESSION_EXPIRED': params.onSessionExpired,
            
            'LOCALE': params.locale || 'en-us',
            
            'APP': app,
            'APP_DISPLAYNAME': app,
            
            // These get set in login
            'SERVER_ZONEINFO': null,
            'USERNAME': null,
            'USER_DISPLAYNAME': null,

            // NOTE: Can derive from (service.info.get('isFree', '0') != '0').
            //       Currently we're requiring the user to specify this explicitly.
            'SPLUNKD_FREE_LICENSE': freeLicense,

            // In independent mode we provide a silent no-op function
            'ON_DRILLDOWN': params.onDrilldown || function() {},
            
            // Constants
            'JS_LOGGER_MODE': 'None',

            // Signal that the framework is running in independent mode.
            // In particular that means that the URL structure is different than in other modes.
            // 
            // It is safe to signal this unconditionally in the splunkjs.config() function because it is
            // currently only ever called from independent-mode HTML pages.
            // This may change in the future.
            'INDEPENDENT_MODE': true
        };
        
        // Extend client-side configuration with custom variables
        if (params.custom) {
            for (var key in params.custom) {
                var value = params.custom[key];
                window.$C[key] = value;
            }
        }
    };
})();
define("splunkjs/preload", function(){});

// This is a snapshot of the en-US i18n.js
// Do not change this file manually - instead, take it from /en-US/static/js/i18n.js

// Locale data for en_US
_i18n_locale={"scientific_format": "#E0", "locale_name": "en_US", "minus_sign": "-", "percent_format": "#,##0%", "number_format": "#,##0.###", "eras": {"abbreviated": {"0": "BC", "1": "AD"}, "narrow": {"0": "B", "1": "A"}, "wide": {"0": "Before Christ", "1": "Anno Domini"}}, "date_formats": {"medium": {"format": "%(MMM)s %(d)s, %(yyyy)s", "pattern": "MMM d, yyyy"}, "long": {"format": "%(MMMM)s %(d)s, %(yyyy)s", "pattern": "MMMM d, yyyy"}, "short": {"format": "%(M)s/%(d)s/%(yy)s", "pattern": "M/d/yy"}, "full": {"format": "%(EEEE)s, %(MMMM)s %(d)s, %(yyyy)s", "pattern": "EEEE, MMMM d, yyyy"}}, "min_week_days": 1, "months": {"format": {"abbreviated": {"1": "Jan", "2": "Feb", "3": "Mar", "4": "Apr", "5": "May", "6": "Jun", "7": "Jul", "8": "Aug", "9": "Sep", "10": "Oct", "11": "Nov", "12": "Dec"}, "narrow": {"1": "J", "2": "F", "3": "M", "4": "A", "5": "M", "6": "J", "7": "J", "8": "A", "9": "S", "10": "O", "11": "N", "12": "D"}, "wide": {"1": "January", "2": "February", "3": "March", "4": "April", "5": "May", "6": "June", "7": "July", "8": "August", "9": "September", "10": "October", "11": "November", "12": "December"}}, "stand-alone": {"abbreviated": {"1": "January", "2": "February", "3": "March", "4": "April", "5": "May", "6": "June", "7": "July", "8": "August", "9": "September", "10": "October", "11": "November", "12": "December"}, "narrow": {"1": "J", "2": "F", "3": "M", "4": "A", "5": "M", "6": "J", "7": "J", "8": "A", "9": "S", "10": "O", "11": "N", "12": "D"}, "wide": {"1": "January", "2": "February", "3": "March", "4": "April", "5": "May", "6": "June", "7": "July", "8": "August", "9": "September", "10": "October", "11": "November", "12": "December"}}}, "time_formats": {"medium": {"format": "%(h)s:%(mm)s:%(ss)s %(a)s", "pattern": "h:mm:ss a"}, "long": {"format": "%(h)s:%(mm)s:%(ss)s %(a)s %(z)s", "pattern": "h:mm:ss a z"}, "short": {"format": "%(h)s:%(mm)s %(a)s", "pattern": "h:mm a"}, "full": {"format": "%(h)s:%(mm)s:%(ss)s %(a)s %(v)s", "pattern": "h:mm:ss a v"}}, "group_symbol": ",", "periods": {"am": "AM", "pm": "PM"}, "decimal_symbol": ".", "quarters": {"format": {"abbreviated": {"1": "Q1", "2": "Q2", "3": "Q3", "4": "Q4"}, "narrow": {"1": "1", "2": "2", "3": "3", "4": "4"}, "wide": {"1": "1st quarter", "2": "2nd quarter", "3": "3rd quarter", "4": "4th quarter"}}, "stand-alone": {"abbreviated": {"1": "1st quarter", "2": "2nd quarter", "3": "3rd quarter", "4": "4th quarter"}, "narrow": {"1": "1", "2": "2", "3": "3", "4": "4"}, "wide": {"1": "1st quarter", "2": "2nd quarter", "3": "3rd quarter", "4": "4th quarter"}}}, "exp_symbol": "E", "days": {"format": {"abbreviated": {"0": "Mon", "1": "Tue", "2": "Wed", "3": "Thu", "4": "Fri", "5": "Sat", "6": "Sun"}, "narrow": {"0": "M", "1": "T", "2": "W", "3": "T", "4": "F", "5": "S", "6": "S"}, "wide": {"0": "Monday", "1": "Tuesday", "2": "Wednesday", "3": "Thursday", "4": "Friday", "5": "Saturday", "6": "Sunday"}}, "stand-alone": {"abbreviated": {"0": "Monday", "1": "Tuesday", "2": "Wednesday", "3": "Thursday", "4": "Friday", "5": "Saturday", "6": "Sunday"}, "narrow": {"0": "M", "1": "T", "2": "W", "3": "T", "4": "F", "5": "S", "6": "S"}, "wide": {"0": "Monday", "1": "Tuesday", "2": "Wednesday", "3": "Thursday", "4": "Friday", "5": "Saturday", "6": "Sunday"}}}, "datetime_formats": {"null": "{1} {0}"}, "first_week_day": 6, "plus_sign": "+"};
/**
** i18n / L10n support routines
*/



/**
* Translate a simple string
*/
function _(message) {
    if (_i18n_locale.locale_name == 'en_DEBUG') return __debug_trans_str(message);
    var entry = _i18n_catalog['+-'+message];
    return entry == undefined ? message : entry;
}

// create a more verbose pointer to the translate function in case of naming collisions with '_'
var gettext = _;

/**
* Translate a string containing a number
*
* Eg. ungettext('Delete %(files)d file?', 'Delete %(files)d files?', files)
* Use in conjuction with sprintf():
*   sprintf( ungettext('Delete %(files)d file?', 'Delete %(files)d files?', files), { files: 14 } )
*/
function ungettext(msgid1, msgid2, n) {
    if (_i18n_locale.locale_name == 'en_DEBUG') return __debug_trans_str(msgid1);
    var pluralForm = _i18n_plural(n);
    //added this IF to normalize/cast the return value from the plural function to an int. see SPL-56112
    if(typeof pluralForm === 'boolean'){
        pluralForm = pluralForm ? 1 : 0;
    }
    var id = ''+pluralForm+'-'+msgid1;
    var entry = _i18n_catalog[id];
    return entry == undefined ? (n==1 ? msgid1 : msgid2)  : entry;
}


function __debug_trans_str(str) {
    var parts = str.split(/(\%(:?\(\w+\))?\w)|(<[^>]+>)|(\s+)/);
    parts = jQuery.grep(parts, function(en) { return en!==undefined; });
    var result = [];
    for(var i=0; i<parts.length; i++) {
        var startsWithSpace = /^\s+/.test(parts[i]);
        if (i && parts[i-1].substr(0, 2)=='%(')
            continue;
        if (parts[i][0] == '%')
            result.push('**'+parts[i]+'**');
        else if (parts[i][0] == '<' || startsWithSpace)
            result.push(parts[i]);
         else
            result.push('\u270c'.repeat(parts[i].length));
    }
    return result.join('');
}

// Locale routines

/**
* Format a number according to the current locale
* The default format for en_US is #,##0.###
* See http://babel.edgewall.org/wiki/Documentation/numbers.html for details on format specs
*/
function format_decimal(num, format) {
    if (!format)
        format = _i18n_locale['number_format'];
    var pattern = parse_number_pattern(format);
    if (_i18n_locale.locale_name == 'en_DEBUG')
        return pattern.apply(num).replace(/\d/g, '0');
    else
        return pattern.apply(num);
}

format_number = format_decimal; // Maintain parity with the Python library

/**
* Format a percentage
*/
function format_percent(num, format) {
    if (!format)
        format = _i18n_locale['percent_format'];
    var pattern = parse_number_pattern(format);
    pattern.frac_prec = [0, 3]; // Appserver has standardized on between 0 and 3 decimal places for percentages
    return pattern.apply(num);
}

/**
* Format a number in scientific notation
*/
function format_scientific(num, format) {
    if (!format)
        format = _i18n_locale['scientific_format'];
    var pattern = parse_number_pattern(format);
    return pattern.apply(num);
}


/**
* Format a date according to the user's current locale
*
* standard formats (en-US examples):
* short: 1/31/08
* medium: Jan 31, 2008
* long: January 31, 2008
* full: Thursday, January 31, 2008
*
* Custom format can also be used
*
* @date Date object or unix timestamp or null for current time
* @format format specifier ('short', 'medium', 'long', 'full', 'MMM d, yyyy', etc)
*/
function format_date(date, format) {
    if (!date)
        date = new Date();
    if (Splunk.util.isInt(date)) {
        date = new Date(date*1000);
    }
    if (!format)
        format = 'medium';
    if (['full','long','medium','short'].indexOf(format)!==-1)
        format = get_date_format(format);
    var pattern = parse_datetime_pattern(format);
    return pattern.apply(new DateTime(date), _i18n_locale);
}


/**
* Format a date and time according to the user's current locale
*
* standard formats (en-US examples)
* short: 1/31/08 10:00 AM
* medium: Jan 31, 2008 10:00:00 AM
* long: January 31, 2008 10:00:00 AM
* full: Thursday, January 31, 2008 10:00:00 AM
*
* Custom format can also be used
*
* @date Date object or unix timestamp or null for current time
* @format format specifier ('short', 'medium', 'long', 'full', 'MMM d, yyyy', etc)
*/
function format_datetime(datetime, date_format, time_format) {
    if (datetime == undefined)
        datetime = new Date();
    if (Splunk.util.isInt(datetime)) {
        datetime = new Date(datetime*1000);
    }
    datetime = new DateTime(datetime);
    if (!date_format)
        date_format = 'medium';
    if (!time_format)
        time_format = date_format;
    var td_format = get_datetime_format(date_format);
    return td_format.replace('{0}', format_time(datetime, time_format)).replace('{1}', format_date(datetime, date_format));
}

/**
* Format a time according to the user's current locale
*
* NOTE: Time is automatically translated to the user's timezone
*
* standard formats (en-US only defines short/medium)
* short: 10:00 AM
* medium: 10:00:00 AM
*
* other locales may also define long/full and may use 24 hour time, etc
*
* @time An object of class Time (see below), or a Date object or null for current time
* @format format specifier ('short', 'medium', 'long', 'full', 'h:mm:ss a', etc)
*/
function format_time(time, format) {
    if (!format)
        format = 'medium';
    if (!time) {
        timenow = new Date();
        time = new Time(timenow.getHours(), timenow.getMinutes(), timenow.getSeconds());
    } else if (time instanceof Date) {
        time = new DateTime(time);
    }
    if (['full','long','medium','short'].indexOf(format)!==-1)
        format = get_time_format(format);
    var pattern = parse_datetime_pattern(format);
    return pattern.apply(time, _i18n_locale);
}

/**
* Like format_datetime, but converts the seconds to seconds+microseconds as ss.QQQ
* Also lets you specify the format to use for date and time individually
*
* For sub-second resolution, dt must be a DateTime object
*/
function format_datetime_microseconds(dt, date_base_format, time_base_format) {
    if (!date_base_format)
        date_base_format = 'short';
    if (!time_base_format)
        time_base_format = 'medium';
    if (!dt) {
        var timenow = new Date();
        dt = new Time(timenow.getHours(), timenow.getMinutes(), timenow.getSeconds());
    } else if (dt instanceof Date) {
        dt = new DateTime(dt);
    }

    var locale = _i18n_locale;
    var time_format = locale.time_formats[time_base_format + '-microsecond'];
    if (!time_format) {
        time_format = get_time_format(time_base_format);
        time_format = (time_format instanceof DateTimePattern) ? time_format.pattern  : time_format;
        time_format = time_format.replace(/ss/, 'ss_TTT', 'g'); // seconds.microseconds
        time_format = locale.time_formats[time_base_format + '-microsecond'] = parse_datetime_pattern(time_format);
    }

    return get_datetime_format(time_base_format).replace('{0}', format_time(dt, time_format)).replace('{1}', format_date(dt, date_base_format));
}

/**
* Like format_time, but converts the seconds to seconds+microseconds as ss.QQQ
* Also lets you specify the format to use for date and time individually
*
* For sub-second resolution, dt must be a DateTime or Time object
*/
function format_time_microseconds(time, time_base_format) {
    if (!time_base_format)
        time_base_format = 'medium';

    if (!time) {
        timenow = new Date();
        time = new Time(timenow.getHours(), timenow.getMinutes(), timenow.getSeconds());
    } else if (time instanceof Date) {
        time = new DateTime(time);
    }

    var locale = _i18n_locale;
    var time_format = locale.time_formats[time_base_format + '-microsecond'];
    if (!time_format) {
        time_format = get_time_format(time_base_format);
        time_format = (time_format instanceof DateTimePattern) ? time_format.pattern  : time_format;
        time_format = time_format.replace(/ss/, 'ss_TTT', 'g'); // seconds.microseconds
        time_format = locale.time_formats[time_base_format + '-microsecond'] = parse_datetime_pattern(time_format);
    }

    return format_time(time, time_format);
}

function locale_name() {
    return _i18n_locale.locale_name;
}

/**
* Returns true if the current locale displays times using the 12h clock
*/
function locale_uses_12h() {
     var time_format = get_time_format('medium');
     return time_format.format.indexOf('%(a)')!=-1;
}
function locale_uses_day_before_month() {
    var time_format = get_date_format("short");
    var formatStr = time_format.format.toLowerCase();
    if (formatStr.indexOf('%(d)')>-1 && formatStr.indexOf('%(m)')>-1) {
        return (formatStr.indexOf('%(d)') < formatStr.indexOf('%(m)'));
    }
    return false;
}

/**
* Class to hold time information in lieu of datetime.time
*/
function Time(hour, minute, second, microsecond) {
    if (_i18n_locale.locale_name == 'en_DEBUG') {
        this.hour = 11;
        this.minute = 22;
        this.second = 33;
        this.microsecond = 123000;
    } else {
        this.hour = hour;
        this.minute = minute;
        this.second = second;
        this.microsecond = microsecond ? microsecond : 0;
    }
}

/**
* Wrapper object for JS Date objects
*/
function DateTime(date) {
    if (date instanceof DateTime)
        return date;
    if (_i18n_locale.locale_name == 'en_DEBUG')
        date = new Date(3333, 10, 22, 11, 22, 33, 123);
    if (date instanceof Date) {
        this.date = date;
        this.hour = date.getHours();
        this.minute = date.getMinutes();
        this.second = date.getSeconds();
        this.microsecond = 0;
        this.year = date.getFullYear();
        this.month = date.getMonth()+1;
        this.day = date.getDate();
    } else {
        for(var k in date) {
            this[k] = date[k];
        }
    }
}

DateTime.prototype.weekday = function() {
    // python DateTime compatible function
    var d = this.date.getDay()-1;
    if (d<0) d=6;
    return d;
};


// No user serviceable parts below
// See your prefecture's Mr Sparkle representative for quality servicing

// This is mostly directly ported from Babel

function parse_number_pattern(pattern) {
    // Parse number format patterns
    var PREFIX_END = '[^0-9@#.,]';
    var NUMBER_TOKEN = '[0-9@#.,E+\-]';

    var PREFIX_PATTERN = "((?:'[^']*'|"+PREFIX_END+")*)";
    var NUMBER_PATTERN = "("+NUMBER_TOKEN+"+)";
    var SUFFIX_PATTERN = "(.*)";

    var number_re = new RegExp(PREFIX_PATTERN + NUMBER_PATTERN + SUFFIX_PATTERN);
    if (pattern instanceof NumberPattern) {
        return pattern;
    }

    var neg_pattern, pos_suffix, pos_prefix, neg_prefix, neg_suffix, num, exp, dum, sp;
    // Do we have a negative subpattern?
    if (pattern.indexOf(';')!==-1) {
        sp = pattern.split(';', 2);
        pattern=sp[0]; neg_pattern=sp[1];

        sp = pattern.match(number_re).slice(1);
        pos_prefix=sp[0]; num=sp[1]; pos_suffix=sp[2];

        sp = neg_pattern.match(number_re).slice(1);
        neg_prefix=sp[0]; neg_suffix=[2];
    } else {
        sp = pattern.match(number_re).slice(1);
        pos_prefix=sp[0]; num=sp[1]; pos_suffix=sp[2];
        neg_prefix = '-' + pos_prefix;
        neg_suffix = pos_suffix;
    }
    if (num.indexOf('E')!==-1) {
        sp = num.split('E', 2);
        num = sp[0]; exp=sp[1];
    } else {
        exp = null;
    }
    if (num.indexOf('@')!==-1) {
        if (num.indexOf('.')!==-1 && num.indexOf('0')!==-1)
            return alert('Significant digit patterns can not contain "@" or "0"');
    }
    var integer, fraction;
    if (num.indexOf('.')!==-1)  {
        sp = num.rsplit('.', 2);
        integer=sp[0]; fraction=sp[1];
    } else {
        integer = num;
        fraction = '';
    }
    var min_frac = 0, max_frac = 0 ;

    function parse_precision(p) {
        // Calculate the min and max allowed digits
        var min = 0; var max = 0;
        for(var i=0; i<p.length; i++) {
            var c = p.substr(i, 1);
            if ('@0'.indexOf(c)!==-1) {
                min += 1;
                max += 1;
            } else if (c == '#') {
                max += 1;
            } else if (c == ',') {
                continue;
            } else {
                break;
            }
        }
        return [min, max];
    }

    function parse_grouping(p) {
        /*
        Parse primary and secondary digit grouping

        >>> parse_grouping('##')
        0, 0
        >>> parse_grouping('#,###')
        3, 3
        >>> parse_grouping('#,####,###')
        3, 4
        */
        var width = p.length;
        var g1 = p.lastIndexOf(',');
        if (g1 == -1)
            return [1000, 1000];
        g1 = width - g1 - 1;
        // var g2 = p[:-g1 - 1].lastIndexOf(',')
        var g2 = p.substr(0, p.length-g1-1).lastIndexOf(',');
        if (g2 == -1)
            return [g1, g1];
        g2 = width - g1 - g2 - 2 ;
        return [g1, g2];
    }

    var int_prec = parse_precision(integer);
    var frac_prec = parse_precision(fraction);
    var exp_plus;
    var exp_prec;
    if (exp) {
        frac_prec = parse_precision(integer+fraction);
        exp_plus = exp.substr(0, 1) == '+';
        exp = exp.replace(/^\++/, '');
        exp_prec = parse_precision(exp);
    } else {
        exp_plus = null;
        exp_prec = null;
    }
    var grouping = parse_grouping(integer);
    return new NumberPattern(pattern, [pos_prefix, neg_prefix],
                         [pos_suffix, neg_suffix], grouping,
                         int_prec, frac_prec,
                         exp_prec, exp_plus);
}

// Don't instantiate this class directly; use the format_number() function
function NumberPattern(pattern, prefix, suffix, grouping, int_prec, frac_prec, exp_prec, exp_plus) {
    this.pattern = pattern;
    this.prefix = prefix;
    this.suffix = suffix;
    this.grouping = grouping;
    this.int_prec = int_prec;
    this.frac_prec = frac_prec;
    this.exp_prec = exp_prec;
    this.exp_plus = exp_plus;
    if ((this.prefix+this.suffix).indexOf('%')!==-1)
        this.scale = 100;
    else if ((this.prefix+this.suffix).indexOf('\u2030')!==-1)
        this.scale = 1000;
    else
        this.scale = 1;
}

(function() {

     split_number = function(value) {
        // Convert a number into a (intasstring, fractionasstring) tuple
        var a, b, sp;
        value = ''+value;
        if (value.indexOf('.')!==-1) {
            sp = (''+value).split('.');
            a=sp[0]; b=sp[1];
            if (b == '0')
                b = '';
        } else {
            a = value;
            b = '';
        }
        return [a, b];
    };


    bankersround = function(value, ndigits) {
        var a, b;
        if (!ndigits)
            ndigits = 0;
        var sign = value < 0 ? -1 : 1;
        value = Math.abs(value);
        var sp = split_number(value);
        a=sp[0]; b=sp[1];
        var digits = a + b;
        var add = 0;
        var i = a.length + ndigits;
        if (i < 0 || i >= digits.length) {
            // pass
            add = 0;
        } else if (digits.substr(i, 1) > '5') {
            add = 1;
        } else if (digits.substr(i, 1) == '5' && '13579'.indexOf(digits[i-1])!==-1) {
            add = 1;
        }
        var scale = Math.pow(10, ndigits);
        return parseInt(value * scale + add, 10) / scale * sign;
    };


    NumberPattern.prototype.apply = function(value, locale) {
        if (!locale)
            locale = _i18n_locale;
        value *= this.scale;
        var is_negative = value < 0 ? 1 : 0;
        if (this.exp_prec) { // Scientific notation
            value = Math.abs(value);
            var exp;
            if (value)
                exp = Math.floor(Math.log(value) / Math.log(10));
            else
                exp = 0;

            // Minimum number of integer digits
            if (this.int_prec[0] == this.int_prec[1])
                exp -= this.int_prec[0] - 1;
            // Exponent grouping
            else if (this.int_prec[1])
                exp = parseInt(exp, 10) / this.int_prec[1] * this.int_prec[1];

            if (exp < 0)
                value = value * Math.pow(10, -exp);
            else
                value = value / Math.pow(10, exp);

            var exp_sign = '';
            if (exp < 0)
                exp_sign = locale.minus_sign;
            else if (this.exp_plus)
                exp_sign = locale.plus_sign;
            exp = Math.abs(exp);
            var num = ''+
                 this._format_sigdig(value, this.frac_prec[0], this.frac_prec[1]) + locale.exp_symbol + exp_sign + this._format_int(''+exp, this.exp_prec[0], this.exp_prec[1], locale);
        } else if(this.pattern.indexOf('@')!==-1) { //  Is it a siginificant digits pattern?
            var text = this._format_sigdig(Math.abs(value), this.int_prec[0], this.int_prec[1]);
            if (text.indexOf('.')!==-1) {
                var a, b;
                var sp = text.split('.');
                a=sp[0]; b=sp[1];
                a = this._format_int(a, 0, 1000, locale);
                if (b)
                    b = locale.decimal_symbol + b;
                num = a + b;
            } else {
                num = this._format_int(text, 0, 1000, locale);
            }
        } else { // A normal number pattern
            var c, d;
            var cd_sp = split_number(bankersround(Math.abs(value), this.frac_prec[1]));
            c=cd_sp[0]; d=cd_sp[1];
            d = d || '0';
            c = this._format_int(c, this.int_prec[0], this.int_prec[1], locale);
            d = this._format_frac(d, locale);
            num = c + d;
        }
        var retval = '' + this.prefix[is_negative] + num + this.suffix[is_negative];
        return retval;
    };

    NumberPattern.prototype._format_sigdig = function(value, min, max) {
        var a, b;
        var sp = split_number(value);
        a=sp[0]; b=sp[1];
        var ndecimals = a.length;
        if (a=='0' && b!='') {
            ndecimals = 0;
            while(b[0] == '0') {
                b = b.substr(1);
                ndecimals -= 1;
            }
        }
        sp = split_number(bankersround(value, max - ndecimals));
        a=sp[0]; b=sp[1];
        var digits = ((a+b).replace(/^0+/, '')).length;
        if (!digits)
            digits = 1;
        // Figure out if we need to add any trailing '0':s
        if (a.length >= max && a!= '0')
            return a;
        if (digits < min)
            b += ('0'.repeat(min - digits));
        if (b)
            return a+'.'+b;
        return a;
    };

    NumberPattern.prototype._format_int = function(value, min, max, locale) {
        var width = value.length;
        if (width < min)
            value = '0'.repeat(min - width) + value;
        var gsize = this.grouping[0];
        var ret = '';
        var symbol = locale.group_symbol;
        while (value.length > gsize) {
            ret = symbol + value.substr(value.length - gsize) + ret;
            value = value.substr(0, value.length - gsize);
            gsize = this.grouping[1];
        }
        return value + ret;
    };

    NumberPattern.prototype._format_frac = function(value, locale) {
        var min = this.frac_prec[0];
        var max = this.frac_prec[1];
        if (value.length < min)
            value += '0'.repeat(min - value.length);
        if (max == 0 || (min == 0 && parseInt(value, 10) == 0))
            return '';
        var width = value.length;
        while (value.length > min && value.substr(value.length-1) == '0')
            value = value.substr(0, value.length-1);
        return locale.decimal_symbol + value;
    };

})();



// Date / time routines

function get_period_names(locale) {
    if (!locale)
        locale = _i18n_locale;
    return locale.periods;
}

function get_day_names(width, context, locale) {
    if (!width)
        width = 'wide';
    if (!context)
        context = 'format';
    if (!locale)
        locale = _i18n_locale;
    return locale.days[context][width];
}


function get_month_names(width, context, locale) {
    if (!width)
        width = 'wide';
    if (!context)
        context = 'format';
    if (!locale)
        locale = _i18n_locale;
    return locale.months[context][width];
}


function get_quarter_names(width, context, locale) {
    if (!width)
        width = 'wide';
    if (!context)
        context = 'format';
    if (!locale)
        locale = _i18n_locale;
    return locale.quarters[context][width];
}

function get_erar_names(width, locale) {
    if (!width)
        width = 'wide';
    if (!locale)
        locale = _i18n_locale;
    return locale.eras[width];
}

function get_date_format(format, locale) {
    if (!format)
        format = 'medium';
    if (!locale)
        locale = _i18n_locale;
    var dtp = locale.date_formats[format];
    return new DateTimePattern(dtp.pattern, dtp.format);
}

function get_datetime_format(format, locale) {
    if (!format)
        format = 'medium';
    if (!locale)
        locale = _i18n_locale;
    if (locale.datetime_formats[format] == undefined)
        return locale.datetime_formats[null];
    return locale.datetime_formats[format];
}

function get_time_format(format, locale) {
    if (!format)
        format = 'medium';
    if (!locale)
        locale = _i18n_locale;
    var dtp = locale.time_formats[format];
    return new DateTimePattern(dtp.pattern, dtp.format);
}

var PATTERN_CHARS = {
    'G': [1, 2, 3, 4, 5],                                           // era
    'y': null, 'Y': null, 'u': null,                                // year
    'Q': [1, 2, 3, 4], 'q': [1, 2, 3, 4],                           // quarter
    'M': [1, 2, 3, 4, 5], 'L': [1, 2, 3, 4, 5],                     // month
    'w': [1, 2], 'W': [1],                                          // week
    'd': [1, 2], 'D': [1, 2, 3], 'F': [1], 'g': null,               // day
    'E': [1, 2, 3, 4, 5], 'e': [1, 2, 3, 4, 5], 'c': [1, 3, 4, 5],  // week day
    'a': [1],                                                       // period
    'h': [1, 2], 'H': [1, 2], 'K': [1, 2], 'k': [1, 2],             // hour
    'm': [1, 2],                                                    // minute
    's': [1, 2], 'S': null, 'A': null,                              // second
    'T': null,                                                      // decimal microseconds
    'z': [1, 2, 3, 4], 'Z': [1, 2, 3, 4], 'v': [1, 4], 'V': [1, 4],  // zone
    '_': [1]                                                        // locale decimal symbol
};

function parse_datetime_pattern(pattern) {
    /*
    Parse date, time, and datetime format patterns.

    >>> parse_pattern("MMMMd").format
    u'%(MMMM)s%(d)s'
    >>> parse_pattern("MMM d, yyyy").format
    u'%(MMM)s %(d)s, %(yyyy)s'

    Pattern can contain literal strings in single quotes:

    >>> parse_pattern("H:mm' Uhr 'z").format
    u'%(H)s:%(mm)s Uhr %(z)s'

    An actual single quote can be used by using two adjacent single quote
    characters:

    >>> parse_pattern("hh' o''clock'").format
    u"%(hh)s o'clock"

    :param pattern: the formatting pattern to parse
    */
    if (pattern instanceof DateTimePattern)
        return pattern;

    var result = [];
    var quotebuf = null;
    var charbuf = [];
    var fieldchar = [''];
    var fieldnum = [0];

    function append_chars() {
        result.push(charbuf.join('').replace('%', '%%'));
        charbuf = [];
    }

    function append_field() {
        var limit = PATTERN_CHARS[fieldchar[0]];
        if (limit && limit.indexOf(fieldnum[0])==-1) {
            return alert('Invalid length for field: '+fieldchar[0].repeat(fieldnum[0]));
        }
        result.push('%('+(fieldchar[0].repeat(fieldnum[0]))+')s');
        fieldchar[0] = '';
        fieldnum[0] = 0;
    }

    //for idx, char in enumerate(pattern.replace("''", '\0')):
    var patterntmp = pattern.replace("''", '\0');
    for(var idx=0; idx<patterntmp.length; idx++) {
        var ch = patterntmp.substr(idx, 1);
        if (quotebuf === null) {
            if (ch == "'") { // # quote started
                if (fieldchar[0]) {
                    append_field();
                } else if (charbuf) {
                    append_chars();
                }
                quotebuf = [];
            } else if (ch in PATTERN_CHARS) {
                if (charbuf) {
                    append_chars();
                }
                if (ch == fieldchar[0]) {
                    fieldnum[0] += 1;
                } else {
                    if (fieldchar[0]) {
                        append_field();
                    }
                    fieldchar[0] = ch;
                    fieldnum[0] = 1;
                }
            } else {
                if (fieldchar[0]) {
                    append_field();
                }
                charbuf.push(ch);
            }

        } else if (quotebuf!=null) {
            if (ch == "'") { // end of quote
                charbuf.extend(quotebuf);
                quotebuf = null;
            } else { // # inside quote
                quotebuf.append(ch);
            }
        }
    }
    if (fieldchar[0]) {
        append_field();
    } else if (charbuf) {
        append_chars();
    }

    return new DateTimePattern(pattern, result.join('').replace('\0', "'"));
}

function DateTimePattern(pattern, format) {
    this.pattern = pattern;
    this.format = format;
}

DateTimePattern.prototype.apply = function(datetime, locale) {
    return sprintf(this.format, new DateTimeFormat(datetime, locale));
};

function DateTimeFormat(value, locale) {
    this.value = value;
    this.locale = locale;
}

DateTimeFormat.prototype.__getitem__ = function(name) {
    var ch = name.substr(0, 1);
    var num = name.length;
    switch(ch) {
        case 'G':
            return this.format_era(ch, num);
        case 'y':
        case 'Y':
        case 'u':
            return this.format_year(ch, num);
        case 'q':
        case 'Q':
            return this.format_quarter(ch, num);
        case 'M':
        case 'L':
            return this.format_month(ch, num);
        case 'w':
        case 'W':
            return this.format_week(ch, num);
        case 'd':
            return this.format(this.value.day, num);
        case 'D':
            return this.format_day_of_year(num);
        case 'F':
            return this.format_day_of_week_in_month();
        case 'E':
        case 'e':
        case 'c':
            return this.format_weekday(ch, num);
        case 'a':
            return this.format_period(ch);
        case 'h':
            if (this.value.hour % 12 == 0)
                return this.format(12, num);
            else
                return this.format(this.value.hour % 12, num);
        case 'H':
            return this.format(this.value.hour, num);
        case 'K':
            return this.format(this.value.hour % 12, num);
        case 'k':
            if (this.value.hour == 0)
                return this.format(24, num);
            else
                return this.format(this.value.hour, num);
        case 'm':
            return this.format(this.value.minute, num);
        case 's':
            return this.format(this.value.second, num);
        case 'S':
            return this.format_frac_seconds(num);
        case 'T':
            return this.format_decimal_frac_seconds(num);
        case 'A':
            return this.format_milliseconds_in_day(num);
        case 'z':
        case 'Z':
        case 'v':
        case 'V':
            return this.format_timezone(ch, num);
        case '_':
            return this.locale.decimal_symbol;
        default:
            return alert('Unsupported date/time field '+ch);
    }
};

DateTimeFormat.prototype.format_era = function(ch, num) {
    var width = {3: 'abbreviated', 4: 'wide', 5: 'narrow'}[max(3, num)];
    var era = this.value.year >= 0 ? 1 : 0;
    return get_era_names(width, this.locale)[era];
};

DateTimeFormat.prototype.format_year = function(ch, num) {
    var value = this.value.year;
    if (ch == ch.toUpperCase()) {
        var week = this.get_week_number(this.get_day_of_year());
        if (week == 0)
            value -= 1;
    }
    var year = this.format(value, num);
    if (num == 2)
        year = year.substr(year.length-2);
    return year;
};

DateTimeFormat.prototype.format_quarter = function(ch, num) {
    var quarter = Math.floor( (this.value.month - 1) / 3 + 1 );
    if (num <= 2)
        return sprintf(sprintf('%%0%dd', num),  quarter);
    var width = {3: 'abbreviated', 4: 'wide', 5: 'narrow'}[num];
    var context = {'Q': 'format', 'q': 'stand-alone'}[ch];
    return get_quarter_names(width, context, this.locale)[quarter];
};

DateTimeFormat.prototype.format_month = function(ch, num) {
    if (num <= 2)
        return sprintf(sprintf('%%0%dd', num), this.value.month);
    var width = {3: 'abbreviated', 4: 'wide', 5: 'narrow'}[num];
    var context = {'M': 'format', 'L': 'stand-alone'}[ch];
    return get_month_names(width, context, this.locale)[this.value.month];
};

DateTimeFormat.prototype.format_week = function(ch, num) {
    if (ch == ch.toLowerCase()) { //  # week of year
        var day_of_year = this.get_day_of_year();
        var week = this.get_week_number(day_of_year);
        if (week == 0) {
            var date = this.value - timedelta(days=day_of_year);
            week = this.get_week_number(this.get_day_of_year(date), date.weekday());
        }
        return this.format(week, num);
    } else { // # week of month
        var mon_week = this.get_week_number(this.value.day);
        if (mon_week == 0) {
            var mon_date = this.value - timedelta(days=this.value.day);
            mon_week = this.get_week_number(mon_date.day, mon_date.weekday());
        }
        return mon_week;
    }
};

DateTimeFormat.prototype.format_weekday = function(ch, num) {
    if (num < 3) {
        if (ch == ch.toLowerCase()) {
            var value = 7 - this.locale.first_week_day + this.value.weekday();
            return this.format(value % 7 + 1, num);
        }
        num = 3;
    }
    var weekday = this.value.weekday();
    var width = {3: 'abbreviated', 4: 'wide', 5: 'narrow'}[num];
    var context = {3: 'format', 4: 'format', 5: 'stand-alone'}[num];
    return get_day_names(width, context, this.locale)[weekday];
};

DateTimeFormat.prototype.format_day_of_year = function(num) {
    return this.format(this.get_day_of_year(), num);
};

DateTimeFormat.prototype.format_day_of_week_in_month = function() {
    return ((this.value.day - 1) / 7 + 1);
};

DateTimeFormat.prototype.format_period = function(ch) {
    var period = {0: 'am', 1: 'pm'}[this.value.hour >= 12 ? 1 : 0];
    return get_period_names(this.locale)[period];
};

DateTimeFormat.prototype.format_frac_seconds = function(num) {
    var value = this.value.microsecond;
    return this.format(parseFloat('0.'+value) * Math.pow(10, num), num);
};

DateTimeFormat.prototype.format_decimal_frac_seconds = function(num) {
    return this.format(this.value.microsecond, 6).substr(0, num);
};

DateTimeFormat.prototype.format_milliseconds_in_day = function(num) {
    var msecs = Math.floor(this.value.microsecond / 1000) + this.value.second * 1000 + this.value.minute * 60000 + this.value.hour * 3600000;
    return this.format(msecs, num);
};

DateTimeFormat.prototype.format_timezone = function(ch, num) {
    return ''; // XXX
};

DateTimeFormat.prototype.format = function(value, length) {
    return sprintf(sprintf('%%0%dd', length), value);
};

DateTimeFormat.prototype.get_day_of_year = function(date) {
    if (date == undefined)
        date = this.value;
    var yearstart = new Date(date.year, 0, 1);
    return Math.ceil((date.date - yearstart) / 86400000)+1;
};

DateTimeFormat.prototype.get_week_number = function(day_of_period, day_of_week) {
    /*"Return the number of the week of a day within a period. This may be
    the week number in a year or the week number in a month.

    Usually this will return a value equal to or greater than 1, but if the
    first week of the period is so short that it actually counts as the last
    week of the previous period, this function will return 0.

    >>> format = DateTimeFormat(date(2006, 1, 8), Locale.parse('de_DE'))
    >>> format.get_week_number(6)
    1

    >>> format = DateTimeFormat(date(2006, 1, 8), Locale.parse('en_US'))
    >>> format.get_week_number(6)
    2

    :param day_of_period: the number of the day in the period (usually
                          either the day of month or the day of year)
    :param day_of_week: the week day; if ommitted, the week day of the
                        current date is assumed
    */
    if (day_of_week==undefined)
        day_of_week = this.value.weekday();
    var first_day = (day_of_week - this.locale.first_week_day - day_of_period + 1) % 7;
    if (first_day < 0)
        first_day += 7;
    var week_number = (day_of_period + first_day - 1) / 7;
    if (7 - first_day >= this.locale.min_week_days)
        week_number += 1;
    return week_number;
};






var _i18n_catalog = {};
var _i18n_plural = undefined;
function i18n_register(catalog) {
    _i18n_plural = catalog['plural'];
    for(var k in catalog['catalog']) {
        _i18n_catalog[k] = catalog['catalog'][k];
    }
}



function BaseTimeRangeFormatter() {
    this.DATE_METHODS  = [
        {name: "year",   getter : "getFullYear",     setter: "setFullYear", minValue: "1974"},
        {name: "month",  getter : "getMonth",        setter: "setMonth",    minValue: "0"},
        {name: "day",    getter : "getDate",         setter: "setDate",     minValue: "1"},
        {name: "hour",   getter : "getHours",        setter: "setHours",    minValue: "0"},
        {name: "minute", getter : "getMinutes",      setter: "setMinutes",  minValue: "0"},
        {name: "second", getter : "getSeconds",      setter: "setSeconds",  minValue: "0"},
        {name: "millisecond", getter : "getMilliseconds", setter: "setMilliseconds",  minValue: "0"}
    ];
    //this.logger = Splunk.Logger.getLogger("i18n.js");
}
/*
 * Given absolute args, returns an object literal with four keys:
 * rangeIsSingleUnitOf, rangeIsIntegerUnitsOf, valuesDifferAt, and valuesHighestNonMinimalAt,
 * which are all one of [false, "second", "minute", "hour", "day", "month", "year"]
 */
BaseTimeRangeFormatter.prototype.get_summary_data = function(absEarliest, absLatest) {

    // Step 1 --  find the highest level at which there is a difference.
    var differAtLevel = this.get_differing_level(absEarliest, absLatest);
    var valuesDifferAt = (differAtLevel < this.DATE_METHODS.length) ? this.DATE_METHODS[differAtLevel].name : false;
    var rangeIsSingleUnitOf = false;
    var rangeIsIntegerUnitsOf = false;

    if (differAtLevel >= this.DATE_METHODS.length) {
        //this.logger.error("get_differing_level returned an invalid response");
        return {
            "rangeIsSingleUnitOf"   : false,
            "rangeIsIntegerUnitsOf" : false,
            "valuesDifferAt"    : false,
            "valuesHighestNonMinimalAt": false
        };
    }

    var methodDict = this.DATE_METHODS[differAtLevel];
    var earliestCopy;

    // Step 2 -- find if the range is an exact integral number of any particular unit.
    // for example lets say that valuesDifferAt is 'hour'.
    var highestNonMinimalLevel = this.get_highest_non_minimal_level(absEarliest, absLatest);
    var valuesHighestNonMinimalAt = (highestNonMinimalLevel < this.DATE_METHODS.length) ? this.DATE_METHODS[highestNonMinimalLevel].name : false;
    if (highestNonMinimalLevel == differAtLevel) {
        rangeIsIntegerUnitsOf = valuesDifferAt;

    // Step 3 -- catch some tricky corner cases that we missed. of 'last day of month',  'last month of year'
    } else {
        var methodDictInner = this.DATE_METHODS[highestNonMinimalLevel];
        earliestCopy = new Date();
        earliestCopy.setTime(absEarliest.valueOf());

        earliestCopy[methodDictInner.setter](earliestCopy[methodDictInner.getter]() + 1);
        if (earliestCopy.getTime() == absLatest.getTime()) {
            rangeIsSingleUnitOf = rangeIsIntegerUnitsOf = this.DATE_METHODS[highestNonMinimalLevel].name;
        }
    }

    // Step 4 -- if we're an integer number, check if we're also a single unit of something.
    if (rangeIsIntegerUnitsOf && !rangeIsSingleUnitOf) {
        earliestCopy = new Date();
        earliestCopy.setTime(absEarliest.valueOf());

        // in our example this earliest one hour ahead.
        if (rangeIsIntegerUnitsOf=="hour") {
            // JS resolves the 2AM DST ambiguity in the fall, by picking the
            // later of the two 2AM's. This avoids the ambiguity for the one
            // problematic case.
            earliestCopy.setTime(earliestCopy.valueOf() + 3600000);
        } else {
            earliestCopy[methodDict.setter](earliestCopy[methodDict.getter]() + 1);
        }
        // if they are now the same time, it's a single unit.
        if (earliestCopy.getTime() == absLatest.getTime()) {
            rangeIsSingleUnitOf = this.DATE_METHODS[differAtLevel].name;
        }
    }

    return {
        "rangeIsSingleUnitOf"   : rangeIsSingleUnitOf,
        "rangeIsIntegerUnitsOf" : rangeIsIntegerUnitsOf,
        "valuesDifferAt"    : valuesDifferAt,
        "valuesHighestNonMinimalAt": valuesHighestNonMinimalAt
    };
};
BaseTimeRangeFormatter.prototype.get_highest_non_minimal_level = function(absEarliest, absLatest) {
    for (var i=this.DATE_METHODS.length-1; i>=0; i--) {
        var methodDict = this.DATE_METHODS[i];
        var name = methodDict.name;
        var minValue = methodDict.minValue;
        var earliestValue = absEarliest[methodDict["getter"]]();
        var latestValue   = absLatest[methodDict["getter"]]();

        if (earliestValue != minValue || latestValue != minValue) {
            return i;
        }
    }
};
BaseTimeRangeFormatter.prototype.get_differing_level= function(absEarliest, absLatest) {
    var differAtLevel = 0;
    for (var i=0; i<this.DATE_METHODS.length; i++) {
        var methodDict = this.DATE_METHODS[i];
        var name = methodDict.name;
        var earliestValue = absEarliest[methodDict["getter"]]();
        var latestValue   = absLatest[methodDict["getter"]]();
        if (earliestValue == latestValue) {
            differAtLevel = i+1;
        } else break;
    }
    return differAtLevel;
};
BaseTimeRangeFormatter.prototype.format_range = function(earliestTime, latestTime) {
    var argsDict;
    if (earliestTime && !latestTime) {
        argsDict = {
            startDateTime: format_datetime(earliestTime, 'medium')
        };
        return sprintf(_("since %(startDateTime)s"), argsDict);
    }

    if (!earliestTime && latestTime) {
        argsDict = {
            endDateTime: format_datetime(latestTime, 'medium')
        };
        return sprintf(_("before %(endDateTime)s"), argsDict);
    }

    // there's some low hanging fruit for some simple localizable optimizations
    // pull out the 3 salient facts about the time range
    var summary = this.get_summary_data(earliestTime,latestTime);
    switch (summary["rangeIsSingleUnitOf"]) {
        case "day" :
            return format_date(earliestTime, "medium");
        case "second" :
            return format_datetime(earliestTime, "medium");
        default:
            break;
    }
    // if format_date(earliestTime)  and format_date(latestTime) are identical
    // then only display the date once, and then show the difference with just format_time
    var argDict;
    if (format_date(earliestTime, "medium")  == format_date(latestTime, "medium")) {
        argDict = {
            date : format_date(earliestTime, "medium"),
            start             : format_time(earliestTime, 'medium'),
            end               : format_time(latestTime,   'medium')
        };
        // TRANS: in this particular case the date is the same for both start and end.
        return sprintf(_("%(date)s from %(start)s to %(end)s"), argDict);
    }

    argDict = {
        start : format_datetime(earliestTime, 'medium'),
        end   : format_datetime(latestTime,   'medium')
    };
    return sprintf(_("from %(start)s to %(end)s"), argDict);
};

function EnglishRangeFormatter(use24HourClock, useEuropeanDateAndMonth, abbreviateDayAndMonth) {
    this.use24HourClock = use24HourClock || false;
    this.useEuropeanDateAndMonth = useEuropeanDateAndMonth || false;
    this.abbreviateDayAndMonth = abbreviateDayAndMonth || false;
}
EnglishRangeFormatter.prototype = new BaseTimeRangeFormatter();
EnglishRangeFormatter.prototype.constructor = EnglishRangeFormatter;
EnglishRangeFormatter.superClass  = BaseTimeRangeFormatter.prototype;

/*
 * Given a summary dictionary ( see get_summary_data() above ),
 * this method will return a dictionary with two keys "earliest" and "latest"
 * both of whose values are time format strings.
 * THIS IS FOR USE ONLY IN english locales,
 * NOTICE NO STRINGS ARE LOCALIZED.  THIS IS DELIBERATE
 *
 */
EnglishRangeFormatter.prototype.get_format_strings= function(summary) {
    switch (summary["rangeIsSingleUnitOf"]) {
        case "year" :
            return {"earliest" : "during %Y"};
        case "month" :
            return {"earliest" : "during %B %Y"};
        case "day" :
            return {"earliest" : "during %A, %B %e, %Y"};
        case "hour" :
            return {"earliest" : "at %l %p on %A, %B %e, %Y"};
        case "minute" :
            return {"earliest" : "at %l:%M %p %A, %B %e, %Y"};
        case "second" :
            return {"earliest" : "at %l:%M:%S %p on %A, %B %e, %Y"};
        case "millisecond" :
            return {"earliest" : "at %l:%M:%S.%Q %p on %A, %B %e, %Y"};
        default :
            /*  step 2 harder weirder corner cases where the range satisfies both
              a)  it is an integer number of X where x is months | days | hours | minutes | seconds
              b)  the range does not span a boundary of X's parent Y.
            */
            switch (summary["rangeIsIntegerUnitsOf"]) {
                case "year" :
                    return {
                        "earliest" : "from %Y",
                        "latest"   : " through %Y"
                    };
                case "month" :
                    return {
                        "earliest" : "from %B",
                        "latest"   : " through %B, %Y"
                    };
                case "day" :
                    return {
                        "earliest" : "from %B %e",
                        "latest"   : " through %B %e, %Y"
                    };
                case "hour" :
                    return {
                        "earliest" : "from %l %p",
                        "latest"   : " to %l %p on %A, %B %e, %Y"
                    };
                case "minute" :
                    return {
                        "earliest" : "from %l:%M %p",
                        "latest"   : " to %l:%M %p on %A, %B %e, %Y"
                    };
                case "second" :
                    return {
                        "earliest" : "from %l:%M:%S %p",
                        "latest"   : " to %l:%M:%S %p on %A, %B %e, %Y"
                    };
                case "millisecond" :
                    return {
                        "earliest" : "from %l:%M:%S.%Q %p",
                        "latest"   : " to %l:%M:%S.%Q %p on %A, %B %e, %Y"
                    };
                default :
                    var timeFormat = "";
                    switch (summary["valuesHighestNonMinimalAt"]) {
                        case "hour" :
                            timeFormat = " %l %p";
                            break;
                        case "minute" :
                            timeFormat = " %l:%M %p";
                            break;
                        case "second" :
                            timeFormat = " %l:%M:%S %p";
                            break;
                        case "millisecond" :
                            timeFormat = " %l:%M:%S.%Q %p";
                            break;
                        default:
                            break;
                    }
                    var rangeFormat = timeFormat ? " to" : " through";
                    switch (summary["valuesDifferAt"]) {
                        case "millisecond" :
                        case "second" :
                        case "minute" :
                        case "hour" :
                            return {
                                "earliest" : "from" + timeFormat,
                                "latest"   : rangeFormat + timeFormat + " on %A, %B %e, %Y"
                            };
                        case "day" :
                        case "month" :
                            return {
                                "earliest" : "from" + timeFormat + " %B %e",
                                "latest"   : rangeFormat + timeFormat + " %B %e, %Y"
                            };
                        default :
                            return {
                                "earliest" : "from" + timeFormat + " %B %e, %Y",
                                "latest"   : rangeFormat + timeFormat + " %B %e, %Y"
                            };
                    }
            }
    }
    //this.logger.error("Assertion failed - get_format_strings should have returned in all cases. rangeIsSingleUnitOf=", summary["rangeIsSingleUnitOf"], " rangeIsIntegerUnitsOf=", summary["rangeIsIntegerUnitsOf"]  , " valuesDifferAt=", summary["valuesDifferAt"]);
};
/**
 * This implementation would not scale well beyond these two little configs,
 * NOTE THE ASSUMPTIONS INLINE.  Possibly should be replaced with actual assertions
 * but that's a lot of regex to add.
 */
EnglishRangeFormatter.prototype.applyCustomOptions = function(timeFormatStr) {
    if (this.use24HourClock) {
        // ASSUMPTION 1 - where %p appears in the class' internal literals and has
        //                no :%S value right before it,
        //                there is always a single space, ie %H %p;
        timeFormatStr = timeFormatStr.replace(/%l %p/g, "%H:00");
        // now that we've rescued relevant ones and replaced with %H:00
        // ASSUMPTION 2 - where %p in the classes internal formatstrings it
        //                is always preceded by a space .
        timeFormatStr = timeFormatStr.replace(/ %p/g, "");
        // And now we safely replace all the instances of 12-hour hours with 24-hour hours.
        timeFormatStr = timeFormatStr.replace(/%l/g, "%H");
    }
    if (this.useEuropeanDateAndMonth) {
        // ASSUMPTION 3 - where day and month appear in the classes internal formatstrings
        //                they are ALWAYS %B and %e and there is exactly one space in between.
        timeFormatStr = timeFormatStr.replace(/%B %e/g, "%e %B");
    }
    if (this.abbreviateDayAndMonth) {
        timeFormatStr = timeFormatStr.replace('%A', "%a");
        timeFormatStr = timeFormatStr.replace('%B', "%b");
    }
    return timeFormatStr;
};
EnglishRangeFormatter.prototype.format_range = function(earliestTime, latestTime) {
    // if only earliestTime is defined
    if (earliestTime && !latestTime) {
        return earliestTime.strftime(this.applyCustomOptions("since %l:%M:%S %p %B %e, %Y"));
    }
    // if only latestTime is defined.
    else if (!earliestTime && latestTime) {
        return latestTime.strftime(this.applyCustomOptions("before %l:%M:%S %p %B %e, %Y"));
    }
    // ASSUME BOTH ARE DEFINED
    if (!earliestTime || !latestTime) throw("Assertion failed. format_range expected defined values for both earliest and latest, but one or more was undefined.");

    // pull out the 3 salient facts about the time range
    var summary = this.get_summary_data(earliestTime,latestTime);

    // we pass those salient facts into a function that gives us back
    // a dictionary with either two format strings, 'earliest' and 'latest',
    // or in the case of certain simple searches, just 'earliest'
    var formatStrings = this.get_format_strings(summary);

    // we cheat a bit here.  For year, month, day, we subtract a day so we can say
    // the more definitive "through 2005" instead of the kinda-confusing "to 2006"
    if (summary["valuesHighestNonMinimalAt"] && (summary["valuesHighestNonMinimalAt"] == "year" ||
        summary["valuesHighestNonMinimalAt"] == "month" || summary["valuesHighestNonMinimalAt"] == "day")) {
        latestTime = new Date(latestTime.getTime());
        latestTime.setDate(latestTime.getDate() - 1);
    }
    if (formatStrings["latest"]) {
        return earliestTime.strftime(this.applyCustomOptions(formatStrings["earliest"])) + latestTime.strftime(this.applyCustomOptions(formatStrings["latest"]));
    }
    return earliestTime.strftime(this.applyCustomOptions(formatStrings["earliest"]));
};
/**
 * delegates internally to the format_range method of the appropriate instance of
 * BaseTimeRangeFormatter.
 * Through this mechanism, if you want to localize your time formatting but you find
 * that BaseTimeRangeFormatter can be a bit heavy-handed, you can write your own
 * Formatter class, and you have the option of extending BaseTimeRangeFormatter
 * to get the summary logic there, but you dont have to if you dont want to.
 */
function format_datetime_range(locale, earliestTime, latestTime, abbreviateDayAndMonth) {
    locale = locale || locale_name().replace('_', '-');
    //locale = "en-AR";
    var f = null;
    var use24HourClock = !locale_uses_12h();
    var useEuropeanDateAndMonth = locale_uses_day_before_month();
    if (Splunk.util.trim(locale).indexOf("en-") == 0) {
        f = new EnglishRangeFormatter(use24HourClock, useEuropeanDateAndMonth, abbreviateDayAndMonth);
    } else {
        f = new BaseTimeRangeFormatter();
    }
    return f.format_range(earliestTime, latestTime);
}


function epochToDateTime(time, timeZoneOffset) {
    var date = new Date(Math.floor((time + timeZoneOffset) * 1000));
    var dateTime = new DateTime({
        date: date,
        year: date.getUTCFullYear(),
        month: date.getUTCMonth() + 1,
        day: date.getUTCDate(),
        hour: date.getUTCHours(),
        minute: date.getUTCMinutes(),
        second: date.getUTCSeconds(),
        microsecond: date.getUTCMilliseconds() * 1000
    });
    dateTime.weekday = function() {
        var d = this.date.getUTCDay() - 1;
        if (d < 0)
            d = 6;
        return d;
    };
    return dateTime;
}


// Translations for en_US
i18n_register({"catalog": {"+-from %(start)s to %(end)s": "from %(start)s to %(end)s", "+-since %(startDateTime)s": "since %(startDateTime)s", "+-before %(endDateTime)s": "before %(endDateTime)s", "+-%(date)s from %(start)s to %(end)s": "%(date)s from %(start)s to %(end)s"}, "plural": function(n) { return n == 1 ? 0 : 1; }});

define("framework.i18n", function(){});


requirejs.config({"paths":{"contrib/require":"splunkjs/config","splunkjs/config":"splunkjs/config","profiles/shared":"splunkjs/config","json":"splunkjs/config","errorintercept":"splunkjs/config","splunkjs/preload":"splunkjs/config","framework.i18n":"splunkjs/config","strftime":"splunkjs/mvc","jquery":"splunkjs/mvc","splunk":"splunkjs/mvc","splunk.config":"splunkjs/mvc","splunk.util":"splunkjs/mvc","splunk.i18n":"splunkjs/mvc","lodash":"splunkjs/mvc","underscore":"splunkjs/mvc","backbone":"splunkjs/mvc","util/console_dev":"splunkjs/mvc","splunk.logger":"splunkjs/mvc","util/console":"splunkjs/mvc","splunkjs/contrib/jquery.deparam":"splunkjs/mvc","splunkjs/mvc/protections":"splunkjs/mvc","splunkjs/mvc/basetokenmodel":"splunkjs/mvc","splunkjs/mvc/registry":"splunkjs/mvc","path":"splunkjs/mvc","/package.json":"splunkjs/mvc","/index.js":"splunkjs/mvc","/lib/log.js":"splunkjs/mvc","/lib/utils.js":"splunkjs/mvc","/lib/context.js":"splunkjs/mvc","/lib/paths.js":"splunkjs/mvc","/lib/jquery.class.js":"splunkjs/mvc","/lib/http.js":"splunkjs/mvc","/lib/service.js":"splunkjs/mvc","/lib/async.js":"splunkjs/mvc","/lib/platform/client/jquery_http.js":"splunkjs/mvc","/lib/platform/client/proxy_http.js":"splunkjs/mvc","/lib/entries/browser.ui.entry.js":"splunkjs/mvc","/contrib/script.js":"splunkjs/mvc","/browser.entry.js":"splunkjs/mvc","splunkjs/splunk":"splunkjs/mvc","splunkjs/mvc/tokenescapestring":"splunkjs/mvc","splunkjs/mvc/tokensafestring":"splunkjs/mvc","splunkjs/mvc/tokenutils":"splunkjs/mvc","splunkjs/mvc/utils":"splunkjs/mvc","splunk.error":"splunkjs/mvc","util/ajax_logging":"splunkjs/mvc","splunkjs/mvc/mvc":"splunkjs/mvc","splunkjs/mvc":"splunkjs/mvc","contrib/text":"splunkjs/mvc","splunkjs/contrib/require-css/normalize":"splunkjs/mvc","splunkjs/contrib/require-css/css":"splunkjs/mvc","jquery.ui.core":"splunkjs/mvc","jquery.ui.widget":"splunkjs/mvc","jquery.ui.position":"splunkjs/mvc","jquery.ui.datepicker":"splunkjs/mvc","jquery.ui.mouse":"splunkjs/mvc","jquery.ui.resizable":"splunkjs/mvc","jquery.ui.draggable":"splunkjs/mvc","lowpro":"splunkjs/mvc","jquery.bgiframe":"splunkjs/mvc","bootstrap.tooltip":"splunkjs/mvc","bootstrap.modal":"splunkjs/mvc","bootstrap.dropdown":"splunkjs/mvc","bootstrap.transition":"splunkjs/mvc","bootstrap.tab":"splunkjs/mvc","select2/select2":"splunkjs/mvc","highcharts.runtime_patches":"splunkjs/mvc","highcharts":"splunkjs/mvc","splunk.legend":"splunkjs/mvc","jquery.cookie":"splunkjs/mvc","splunk.jquery.csrf":"splunkjs/mvc","splunk.print":"splunkjs/mvc","util/dom_utils":"splunkjs/mvc","splunk.window":"splunkjs/mvc","swfobject":"splunkjs/mvc","splunk.session":"splunkjs/mvc","splunk.messenger":"splunkjs/mvc","jg_global":"splunkjs/mvc","jgatt.events.EventData":"splunkjs/mvc","jgatt.utils.TypeUtils":"splunkjs/mvc","jgatt.properties.Property":"splunkjs/mvc","jgatt.utils.Dictionary":"splunkjs/mvc","jgatt.properties.MPropertyTarget":"splunkjs/mvc","jgatt.utils.ErrorUtils":"splunkjs/mvc","jgatt.events.Event":"splunkjs/mvc","jgatt.events.ChainedEvent":"splunkjs/mvc","jgatt.events.MEventTarget":"splunkjs/mvc","jgatt.events.MObservable":"splunkjs/mvc","jgatt.geom.Point":"splunkjs/mvc","jgatt.geom.Matrix":"splunkjs/mvc","jgatt.geom.Rectangle":"splunkjs/mvc","jgatt.graphics.Caps":"splunkjs/mvc","jgatt.utils.NumberUtils":"splunkjs/mvc","jgatt.graphics.ColorUtils":"splunkjs/mvc","jgatt.graphics.GradientType":"splunkjs/mvc","jgatt.graphics.Graphics":"splunkjs/mvc","jgatt.graphics.Joints":"splunkjs/mvc","jgatt.properties.PropertyEventData":"splunkjs/mvc","jgatt.graphics.brushes.Brush":"splunkjs/mvc","jgatt.graphics.brushes.DrawingUtils":"splunkjs/mvc","jgatt.utils.FunctionUtils":"splunkjs/mvc","jgatt.properties.ObservableProperty":"splunkjs/mvc","jgatt.graphics.brushes.TileBrush":"splunkjs/mvc","jgatt.properties.ObservableArrayProperty":"splunkjs/mvc","jgatt.graphics.brushes.GradientFillBrush":"splunkjs/mvc","jgatt.graphics.brushes.GroupBrush":"splunkjs/mvc","jgatt.graphics.brushes.SolidFillBrush":"splunkjs/mvc","jgatt.graphics.brushes.SolidStrokeBrush":"splunkjs/mvc","jgatt.graphics.brushes.StretchMode":"splunkjs/mvc","jgatt.motion.easers.Easer":"splunkjs/mvc","jgatt.motion.Tween":"splunkjs/mvc","jgatt.properties.ArrayProperty":"splunkjs/mvc","jgatt.motion.GroupTween":"splunkjs/mvc","jgatt.motion.interpolators.Interpolator":"splunkjs/mvc","jgatt.motion.interpolators.NumberInterpolator":"splunkjs/mvc","jgatt.motion.MethodTween":"splunkjs/mvc","jgatt.motion.PropertyTween":"splunkjs/mvc","jgatt.motion.TweenRunner":"splunkjs/mvc","jgatt.motion.easers.CubicEaser":"splunkjs/mvc","jgatt.motion.easers.EaseDirection":"splunkjs/mvc","jgatt.utils.Comparator":"splunkjs/mvc","jgatt.utils.AlphabeticComparator":"splunkjs/mvc","jgatt.utils.NaturalComparator":"splunkjs/mvc","jgatt.utils.ArrayUtils":"splunkjs/mvc","jgatt.utils.FunctionComparator":"splunkjs/mvc","jgatt.utils.GroupComparator":"splunkjs/mvc","jgatt.utils.NumericComparator":"splunkjs/mvc","jgatt.utils.PropertyComparator":"splunkjs/mvc","jgatt.utils.ReverseComparator":"splunkjs/mvc","jgatt.utils.SequentialNumericComparator":"splunkjs/mvc","jgatt.utils.StringUtils":"splunkjs/mvc","jgatt.validation.ValidateEventData":"splunkjs/mvc","jgatt.validation.ValidatePass":"splunkjs/mvc","jgatt.validation.ValidateQueue":"splunkjs/mvc","jgatt.validation.MValidateTarget":"splunkjs/mvc","jgatt":"splunkjs/mvc","splunk.time.TimeZone":"splunkjs/mvc","splunk.time.SimpleTimeZone":"splunkjs/mvc","splunk.time.LocalTimeZone":"splunkjs/mvc","splunk.time.TimeZones":"splunkjs/mvc","splunk.time.DateTime":"splunkjs/mvc","splunk.time.Duration":"splunkjs/mvc","splunk.time.SplunkTimeZone":"splunkjs/mvc","splunk.time.TimeUtils":"splunkjs/mvc","splunk.time":"splunkjs/mvc","splunk.timerange":"splunkjs/mvc","splunk.jabridge":"splunkjs/mvc","util/Ticker":"splunkjs/mvc","helpers/Session":"splunkjs/mvc","mixins/modelcollection":"splunkjs/mvc","util/math_utils":"splunkjs/mvc","util/general_utils":"splunkjs/mvc","util/splunkd_utils":"splunkjs/mvc","backbone_validation":"splunkjs/mvc","validation/ValidationMixin":"splunkjs/mvc","models/Base":"splunkjs/mvc","models/shared/Application":"splunkjs/mvc","models/SplunkDWhiteList":"splunkjs/mvc","models/services/ACL":"splunkjs/mvc","models/ACLReadOnly":"splunkjs/mvc","models/SplunkDBase":"splunkjs/mvc","models/services/AppLocal":"splunkjs/mvc","models/services/authentication/User":"splunkjs/mvc","moment":"splunkjs/mvc","util/moment":"splunkjs/mvc","util/time":"splunkjs/mvc","models/services/data/ui/Time":"splunkjs/mvc","models/shared/fetchdata/EAIFetchData":"splunkjs/mvc","collections/Base":"splunkjs/mvc","collections/SplunkDsBase":"splunkjs/mvc","collections/services/data/ui/Times":"splunkjs/mvc","models/services/server/ServerInfo":"splunkjs/mvc","collections/services/AppLocals":"splunkjs/mvc","splunkjs/mvc/sharedmodels":"splunkjs/mvc","splunkjs/mvc/tokenawaremodel":"splunkjs/mvc","splunkjs/ready":"splunkjs/mvc","uri/route":"splunkjs/mvc","models/services/search/IntentionsParser":"splunkjs/mvc","splunkjs/mvc/drilldown":"splunkjs/mvc","mixins/domtracker":"splunkjs/mvc","splunkjs/mvc/basemanager":"splunkjs/mvc","splunkjs/mvc/settings":"splunkjs/mvc","mixins/viewlogging":"splunkjs/mvc","splunkjs/mvc/basesplunkview":"splunkjs/mvc","splunkjs/mvc/basemodel":"splunkjs/mvc","splunkjs/mvc/messages":"splunkjs/mvc","splunkjs/mvc/splunkresultsmodel":"splunkjs/mvc","splunkjs/mvc/searchmodel":"splunkjs/mvc","splunkjs/mvc/jobtracker":"splunkjs/mvc","splunkjs/mvc/searchmanager":"splunkjs/mvc","splunkjs/mvc/savedsearchmanager":"splunkjs/mvc","splunkjs/mvc/simplesplunkview":"splunkjs/mvc","splunkjs/mvc/postprocessmanager":"splunkjs/mvc","splunkjs/compiled/models":"splunkjs/compiled/models","models/shared/splunkbar/SystemMenuSection":"splunkjs/compiled/models","collections/shared/splunkbar/SystemMenuSections":"splunkjs/compiled/models","models/shared/FlashMessage":"splunkjs/compiled/models","collections/shared/FlashMessages":"splunkjs/compiled/models","models/services/authentication/CurrentContext":"splunkjs/compiled/models","collections/services/authentication/CurrentContexts":"splunkjs/compiled/models","models/services/data/ui/Manager":"splunkjs/compiled/models","collections/services/data/ui/Managers":"splunkjs/compiled/models","models/services/data/ui/View":"splunkjs/compiled/models","collections/services/data/ui/Views":"splunkjs/compiled/models","models/services/Message":"splunkjs/compiled/models","collections/services/Messages":"splunkjs/compiled/models","models/services/SavedSearch":"splunkjs/compiled/models","collections/services/SavedSearches":"splunkjs/compiled/models","models/services/search/TimeParser":"splunkjs/compiled/models","collections/services/search/TimeParsers":"splunkjs/compiled/models","models/services/data/ui/Nav":"splunkjs/compiled/models","collections/services/data/ui/Navs":"splunkjs/compiled/models","models/search/SelectedField":"splunkjs/compiled/models","collections/search/SelectedFields":"splunkjs/compiled/models","models/services/configs/EventRenderer":"splunkjs/compiled/models","collections/services/configs/EventRenderers":"splunkjs/compiled/models","models/services/data/ui/WorkflowAction":"splunkjs/compiled/models","collections/services/data/ui/WorkflowActions":"splunkjs/compiled/models","models/services/search/jobs/Control":"splunkjs/compiled/models","models/services/search/Job":"splunkjs/compiled/models","collections/services/search/Jobs":"splunkjs/compiled/models","models/search/Job":"splunkjs/compiled/models","collections/search/Jobs":"splunkjs/compiled/models","models/shared/DateInput":"splunkjs/compiled/models","models/shared/TimeRange":"splunkjs/compiled/models","models/services/data/UserPref":"splunkjs/compiled/models","models/services/configs/Web":"splunkjs/compiled/models","models/services/search/jobs/Summary":"splunkjs/compiled/models","models/shared/fetchdata/ResultsFetchData":"splunkjs/compiled/models","models/services/search/jobs/Result":"splunkjs/compiled/models","models/services/saved/FVTags":"splunkjs/compiled/models","helpers/user_agent":"splunkjs/compiled/models","util/router_utils":"splunkjs/compiled/models","models/shared/ClassicURL":"splunkjs/compiled/models","models/classicurl":"splunkjs/compiled/models","models/services/configs/AlertAction":"splunkjs/compiled/models","models/services/data/ui/Viewstate":"splunkjs/compiled/models","models/search/Report":"splunkjs/compiled/models","models/shared/eventsviewer/UIWorkflowAction":"splunkjs/compiled/models","splunkjs/compiled/views":"splunkjs/compiled/views","views/Base":"splunkjs/compiled/views","views/shared/Modal":"splunkjs/compiled/views","views/shared/controls/Control":"splunkjs/compiled/views","views/shared/delegates/Base":"splunkjs/compiled/views","views/shared/delegates/PopdownDialog":"splunkjs/compiled/views","views/shared/delegates/Popdown":"splunkjs/compiled/views","views/shared/controls/SyntheticSelectControl":"splunkjs/compiled/views","views/shared/controls/SyntheticRadioControl":"splunkjs/compiled/views","views/shared/controls/SyntheticCheckboxControl":"splunkjs/compiled/views","views/shared/controls/TextareaControl":"splunkjs/compiled/views","views/shared/controls/LabelControl":"splunkjs/compiled/views","views/shared/controls/TextControl":"splunkjs/compiled/views","views/shared/controls/DateControl":"splunkjs/compiled/views","views/shared/controls/ControlGroup":"splunkjs/compiled/views","helpers/FlashMessagesHelper":"splunkjs/compiled/views","views/shared/FlashMessages":"splunkjs/compiled/views","util/pdf_utils":"splunkjs/compiled/views","views/shared/jobstatus/buttons/ExportResultsDialog":"splunkjs/compiled/views","views/shared/delegates/StopScrollPropagation":"splunkjs/compiled/views","views/shared/delegates/TextareaResize":"splunkjs/compiled/views","views/shared/delegates/Accordion":"splunkjs/compiled/views","views/shared/delegates/ColumnSort":"splunkjs/compiled/views","views/shared/delegates/DetachedTableHeader":"splunkjs/compiled/views","views/shared/delegates/TableDock":"splunkjs/compiled/views","views/shared/delegates/TableHeadStatic":"splunkjs/compiled/views","views/shared/timerangepicker/dialog/Presets":"splunkjs/mvc/timepickerview","contrib/text!views/shared/timerangepicker/dialog/Relative.html":"splunkjs/mvc/timepickerview","views/shared/timerangepicker/dialog/Relative":"splunkjs/mvc/timepickerview","contrib/text!views/shared/timerangepicker/dialog/RealTime.html":"splunkjs/mvc/timepickerview","views/shared/timerangepicker/dialog/RealTime":"splunkjs/mvc/timepickerview","views/shared/timerangepicker/dialog/daterange/BetweenDates":"splunkjs/mvc/timepickerview","views/shared/timerangepicker/dialog/daterange/BeforeDate":"splunkjs/mvc/timepickerview","views/shared/timerangepicker/dialog/daterange/AfterDate":"splunkjs/mvc/timepickerview","views/shared/timerangepicker/dialog/daterange/Master":"splunkjs/mvc/timepickerview","views/shared/timerangepicker/dialog/dateandtimerange/timeinput/HoursMinutesSeconds":"splunkjs/mvc/timepickerview","views/shared/timerangepicker/dialog/dateandtimerange/timeinput/Master":"splunkjs/mvc/timepickerview","views/shared/timerangepicker/dialog/dateandtimerange/Master":"splunkjs/mvc/timepickerview","views/shared/timerangepicker/dialog/advanced/timeinput/Hint":"splunkjs/mvc/timepickerview","views/shared/timerangepicker/dialog/advanced/timeinput/Master":"splunkjs/mvc/timepickerview","views/shared/timerangepicker/dialog/advanced/Master":"splunkjs/mvc/timepickerview","views/shared/timerangepicker/dialog/Master":"splunkjs/mvc/timepickerview","views/shared/timerangepicker/Master":"splunkjs/mvc/timepickerview","collections/shared/Times":"splunkjs/mvc/timepickerview","splunkjs/mvc/timerangeview":"splunkjs/mvc/timepickerview","splunkjs/mvc/timepickerview":"splunkjs/mvc/timepickerview","views/shared/results_table/ResultsTableHeader":"splunkjs/mvc/tableview","views/shared/results_table/renderers/BaseCellRenderer":"splunkjs/mvc/tableview","views/shared/results_table/renderers/BaseRowExpansionRenderer":"splunkjs/mvc/tableview","views/shared/results_table/ResultsTableRow":"splunkjs/mvc/tableview","helpers/grid/RowIterator":"splunkjs/mvc/tableview","helpers/Printer":"splunkjs/mvc/tableview","jquery.sparkline":"splunkjs/mvc/tableview","views/shared/results_table/renderers/NullCellRenderer":"splunkjs/mvc/tableview","views/shared/results_table/renderers/NumberCellRenderer":"splunkjs/mvc/tableview","views/shared/results_table/renderers/SparklineCellRenderer":"splunkjs/mvc/tableview","views/shared/results_table/renderers/StringCellRenderer":"splunkjs/mvc/tableview","views/shared/results_table/renderers/TimeCellRenderer":"splunkjs/mvc/tableview","views/shared/results_table/ResultsTableMaster":"splunkjs/mvc/tableview","splunkjs/mvc/paginatorview":"splunkjs/mvc/tableview","splunkjs/mvc/tableview":"splunkjs/mvc/tableview","contrib/text!views/shared/splunkbar/AppMenu.html":"splunkjs/mvc/headerview","views/shared/splunkbar/AppMenu":"splunkjs/mvc/headerview","contrib/text!views/shared/splunkbar/SystemMenuSection.html":"splunkjs/mvc/headerview","views/shared/splunkbar/SystemMenuSection":"splunkjs/mvc/headerview","contrib/text!views/shared/splunkbar/SystemMenu.html":"splunkjs/mvc/headerview","views/shared/splunkbar/SystemMenu":"splunkjs/mvc/headerview","contrib/text!views/shared/splunkbar/UserMenu.html":"splunkjs/mvc/headerview","views/shared/splunkbar/UserMenu":"splunkjs/mvc/headerview","views/shared/splunkbar/messages/Message":"splunkjs/mvc/headerview","views/shared/splunkbar/messages/LegacyMessage":"splunkjs/mvc/headerview","contrib/text!views/shared/splunkbar/messages/Master.html":"splunkjs/mvc/headerview","views/shared/splunkbar/messages/Master":"splunkjs/mvc/headerview","contrib/text!views/shared/splunkbar/ActivityMenu.html":"splunkjs/mvc/headerview","views/shared/splunkbar/ActivityMenu":"splunkjs/mvc/headerview","contrib/text!views/shared/whatsnewdialog/Master.html":"splunkjs/mvc/headerview","views/shared/whatsnewdialog/Master":"splunkjs/mvc/headerview","contrib/text!views/shared/splunkbar/HelpMenu.html":"splunkjs/mvc/headerview","views/shared/splunkbar/HelpMenu":"splunkjs/mvc/headerview","views/shared/WaitSpinner":"splunkjs/mvc/headerview","contrib/text!views/shared/splunkbar/messages/NoConnectionOverlay.html":"splunkjs/mvc/headerview","views/shared/splunkbar/messages/NoConnectionOverlay":"splunkjs/mvc/headerview","contrib/text!views/shared/splunkbar/Master.html":"splunkjs/mvc/headerview","util/csrf_protection":"splunkjs/mvc/headerview","util/ajax_no_cache":"splunkjs/mvc/headerview","views/shared/splunkbar/Master":"splunkjs/mvc/headerview","contrib/text!views/shared/appbar/NavItem.html":"splunkjs/mvc/headerview","contrib/text!views/shared/AppNav-SlideNavTemplate.html":"splunkjs/mvc/headerview","splunk.widget.slidenav":"splunkjs/mvc/headerview","views/shared/appbar/NavItem":"splunkjs/mvc/headerview","views/shared/appbar/AppNav":"splunkjs/mvc/headerview","contrib/text!views/shared/appbar/AppLabel.html":"splunkjs/mvc/headerview","views/shared/appbar/AppLabel":"splunkjs/mvc/headerview","contrib/text!views/shared/appbar/Master.html":"splunkjs/mvc/headerview","helpers/AppNav":"splunkjs/mvc/headerview","util/color_utils":"splunkjs/mvc/headerview","views/shared/appbar/Master":"splunkjs/mvc/headerview","models/config":"splunkjs/mvc/headerview","splunkjs/mvc/headerview":"splunkjs/mvc/headerview","contrib/text!views/shared/footer/AboutDialog.html":"splunkjs/mvc/footerview","views/shared/footer/AboutDialog":"splunkjs/mvc/footerview","contrib/text!views/shared/footer/Master.html":"splunkjs/mvc/footerview","views/shared/footer/Master":"splunkjs/mvc/footerview","splunkjs/mvc/footerview":"splunkjs/mvc/footerview","views/shared/searchbar/Apps":"splunkjs/mvc/searchbarview","models/search/SearchBar":"splunkjs/mvc/searchbarview","util/keyboard":"splunkjs/mvc/searchbarview","views/shared/searchbar/input/SearchField":"splunkjs/mvc/searchbarview","models/search/SHelper":"splunkjs/mvc/searchbarview","views/shared/searchbar/input/SearchAssistant":"splunkjs/mvc/searchbarview","views/shared/searchbar/input/Master":"splunkjs/mvc/searchbarview","views/shared/searchbar/Submit":"splunkjs/mvc/searchbarview","views/shared/searchbar/Master":"splunkjs/mvc/searchbarview","splunkjs/mvc/searchbarview":"splunkjs/mvc/searchbarview","views/shared/SingleValue":"splunkjs/mvc/singleview","splunkjs/mvc/singleview":"splunkjs/mvc/singleview","splunkjs/mvc/aceheader/acemenubuilder":"splunkjs/mvc/aceheader/aceheader","splunkjs/mvc/aceheader/aceheader":"splunkjs/mvc/aceheader/aceheader","splunkjs/mvc/d3chart/d3/d3.v2":"splunkjs/mvc/d3chart/d3chartview","splunkjs/mvc/d3chart/d3/fisheye":"splunkjs/mvc/d3chart/d3chartview","splunkjs/mvc/d3chart/d3/nv.d3":"splunkjs/mvc/d3chart/d3chartview","splunkjs/mvc/d3chart/d3chartview":"splunkjs/mvc/d3chart/d3chartview","splunkjs/compiled/forms":"splunkjs/compiled/forms","splunkjs/mvc/baseinputview":"splunkjs/compiled/forms","splunkjs/mvc/checkboxview":"splunkjs/compiled/forms","splunkjs/mvc/basechoiceview":"splunkjs/compiled/forms","splunkjs/mvc/basemultichoiceview":"splunkjs/compiled/forms","splunkjs/mvc/checkboxgroupview":"splunkjs/compiled/forms","splunkjs/mvc/radiogroupview":"splunkjs/compiled/forms","splunkjs/mvc/basedropdownviewmixin":"splunkjs/compiled/forms","splunkjs/mvc/multidropdownview":"splunkjs/compiled/forms","splunkjs/mvc/multiselectview":"splunkjs/compiled/forms","splunkjs/mvc/dropdownview":"splunkjs/compiled/forms","splunkjs/mvc/selectview":"splunkjs/compiled/forms","splunkjs/mvc/textinputview":"splunkjs/compiled/forms","splunkjs/mvc/textboxview":"splunkjs/compiled/forms","splunkjs/mvc/progressbarview":"splunkjs/mvc/progressbarview","splunkjs/mvc/datatemplateview":"splunkjs/mvc/datatemplateview","async":"splunkjs/mvc/googlemapview","splunkjs/mvc/googlemapview":"splunkjs/mvc/googlemapview","views/shared/delegates/Modalize":"splunkjs/mvc/eventsviewerview","views/shared/eventsviewer/shared/TableHead":"splunkjs/mvc/eventsviewerview","keyboard/SearchModifier":"splunkjs/mvc/eventsviewerview","views/shared/PopTart":"splunkjs/mvc/eventsviewerview","contrib/text!views/shared/FieldInfo.html":"splunkjs/mvc/eventsviewerview","views/shared/FieldInfo":"splunkjs/mvc/eventsviewerview","views/shared/eventsviewer/shared/TagDialog":"splunkjs/mvc/eventsviewerview","views/shared/eventsviewer/shared/WorkflowActions":"splunkjs/mvc/eventsviewerview","views/shared/eventsviewer/shared/TimeInfo":"splunkjs/mvc/eventsviewerview","views/shared/eventsviewer/shared/BaseFields":"splunkjs/mvc/eventsviewerview","views/shared/eventsviewer/list/body/row/SelectedFields":"splunkjs/mvc/eventsviewerview","views/shared/eventsviewer/shared/EventFields":"splunkjs/mvc/eventsviewerview","views/shared/JSONTree":"splunkjs/mvc/eventsviewerview","views/shared/eventsviewer/shared/RawField":"splunkjs/mvc/eventsviewerview","views/shared/eventsviewer/list/body/row/Master":"splunkjs/mvc/eventsviewerview","views/shared/eventsviewer/list/body/Master":"splunkjs/mvc/eventsviewerview","views/shared/eventsviewer/list/Master":"splunkjs/mvc/eventsviewerview","views/shared/eventsviewer/table/TableHead":"splunkjs/mvc/eventsviewerview","views/shared/eventsviewer/table/body/PrimaryRow":"splunkjs/mvc/eventsviewerview","views/shared/eventsviewer/table/body/SecondaryRow":"splunkjs/mvc/eventsviewerview","views/shared/eventsviewer/table/body/Master":"splunkjs/mvc/eventsviewerview","views/shared/eventsviewer/table/Master":"splunkjs/mvc/eventsviewerview","views/shared/eventsviewer/Master":"splunkjs/mvc/eventsviewerview","splunkjs/mvc/eventsviewerview":"splunkjs/mvc/eventsviewerview","views/shared/jobstatus/Count":"splunkjs/mvc/searchcontrolsview","views/shared/jobstatus/controls/Cancel":"splunkjs/mvc/searchcontrolsview","views/shared/jobstatus/controls/Stop":"splunkjs/mvc/searchcontrolsview","views/shared/jobstatus/controls/PlayPause":"splunkjs/mvc/searchcontrolsview","views/shared/jobstatus/controls/Reload":"splunkjs/mvc/searchcontrolsview","views/shared/jobstatus/controls/menu/Messages":"splunkjs/mvc/searchcontrolsview","views/shared/jobstatus/controls/menu/EditModal":"splunkjs/mvc/searchcontrolsview","views/shared/jobstatus/controls/menu/Edit":"splunkjs/mvc/searchcontrolsview","views/shared/jobstatus/controls/menu/sendbackgroundmodal/Settings":"splunkjs/mvc/searchcontrolsview","views/shared/jobstatus/controls/menu/sendbackgroundmodal/Success":"splunkjs/mvc/searchcontrolsview","views/shared/jobstatus/controls/menu/sendbackgroundmodal/Master":"splunkjs/mvc/searchcontrolsview","views/shared/jobstatus/controls/menu/SendBackground":"splunkjs/mvc/searchcontrolsview","views/shared/jobstatus/controls/menu/Inspect":"splunkjs/mvc/searchcontrolsview","views/shared/jobstatus/controls/menu/DeleteModal":"splunkjs/mvc/searchcontrolsview","views/shared/jobstatus/controls/menu/Delete":"splunkjs/mvc/searchcontrolsview","views/shared/jobstatus/controls/menu/Master":"splunkjs/mvc/searchcontrolsview","views/shared/jobstatus/controls/Master":"splunkjs/mvc/searchcontrolsview","views/shared/jobstatus/buttons/ShareDialog":"splunkjs/mvc/searchcontrolsview","views/shared/jobstatus/buttons/ShareButton":"splunkjs/mvc/searchcontrolsview","views/shared/jobstatus/buttons/ExportButton":"splunkjs/mvc/searchcontrolsview","views/shared/jobstatus/buttons/PrintButton":"splunkjs/mvc/searchcontrolsview","views/shared/jobstatus/buttons/Master":"splunkjs/mvc/searchcontrolsview","views/shared/jobstatus/SearchMode":"splunkjs/mvc/searchcontrolsview","views/shared/jobstatus/AutoPause":"splunkjs/mvc/searchcontrolsview","views/shared/jobstatus/Progress":"splunkjs/mvc/searchcontrolsview","views/shared/jobstatus/Master":"splunkjs/mvc/searchcontrolsview","splunkjs/mvc/searchcontrolsview":"splunkjs/mvc/searchcontrolsview","splunkjs/compiled/js_charting":"splunkjs/compiled/js_charting","js_charting/util/math_utils":"splunkjs/compiled/js_charting","js_charting/helpers/DataSet":"splunkjs/compiled/js_charting","js_charting/util/dom_utils":"splunkjs/compiled/js_charting","js_charting/helpers/EventMixin":"splunkjs/compiled/js_charting","js_charting/util/color_utils":"splunkjs/compiled/js_charting","js_charting/util/parsing_utils":"splunkjs/compiled/js_charting","js_charting/visualizations/Visualization":"splunkjs/compiled/js_charting","js_charting/components/ColorPalette":"splunkjs/compiled/js_charting","js_charting/helpers/font_data/widths/helvetica":"splunkjs/compiled/js_charting","js_charting/helpers/Formatter":"splunkjs/compiled/js_charting","js_charting/components/axes/Axis":"splunkjs/compiled/js_charting","js_charting/util/lang_utils":"splunkjs/compiled/js_charting","js_charting/components/axes/CategoryAxis":"splunkjs/compiled/js_charting","js_charting/util/time_utils":"splunkjs/compiled/js_charting","js_charting/components/axes/TimeAxis":"splunkjs/compiled/js_charting","js_charting/components/axes/NumericAxis":"splunkjs/compiled/js_charting","js_charting/helpers/HoverEventThrottler":"splunkjs/compiled/js_charting","js_charting/components/Legend":"splunkjs/compiled/js_charting","js_charting/components/Tooltip":"splunkjs/compiled/js_charting","js_charting/components/SelectionWindow":"splunkjs/compiled/js_charting","js_charting/components/PanButtons":"splunkjs/compiled/js_charting","js_charting/components/ZoomOutButton":"splunkjs/compiled/js_charting","js_charting/series/Series":"splunkjs/compiled/js_charting","js_charting/series/ManyShapeSeries":"splunkjs/compiled/js_charting","js_charting/series/ColumnSeries":"splunkjs/compiled/js_charting","js_charting/series/BarSeries":"splunkjs/compiled/js_charting","js_charting/series/SingleShapeSeries":"splunkjs/compiled/js_charting","js_charting/series/LineSeries":"splunkjs/compiled/js_charting","js_charting/series/AreaSeries":"splunkjs/compiled/js_charting","js_charting/series/PieSeries":"splunkjs/compiled/js_charting","js_charting/series/ScatterSeries":"splunkjs/compiled/js_charting","js_charting/series/MultiSeries":"splunkjs/compiled/js_charting","js_charting/series/RangeSeries":"splunkjs/compiled/js_charting","js_charting/series/series_factory":"splunkjs/compiled/js_charting","js_charting/util/testing_utils":"splunkjs/compiled/js_charting","js_charting/util/async_utils":"splunkjs/compiled/js_charting","js_charting/visualizations/charts/Chart":"splunkjs/compiled/js_charting","js_charting/visualizations/charts/SplitSeriesChart":"splunkjs/compiled/js_charting","js_charting/components/DataLabels":"splunkjs/compiled/js_charting","js_charting/visualizations/charts/PieChart":"splunkjs/compiled/js_charting","js_charting/visualizations/charts/ScatterChart":"splunkjs/compiled/js_charting","js_charting/visualizations/gauges/Gauge":"splunkjs/compiled/js_charting","js_charting/visualizations/gauges/RadialGauge":"splunkjs/compiled/js_charting","js_charting/visualizations/gauges/FillerGauge":"splunkjs/compiled/js_charting","js_charting/visualizations/gauges/HorizontalFillerGauge":"splunkjs/compiled/js_charting","js_charting/visualizations/gauges/VerticalFillerGauge":"splunkjs/compiled/js_charting","js_charting/visualizations/gauges/MarkerGauge":"splunkjs/compiled/js_charting","js_charting/visualizations/gauges/HorizontalMarkerGauge":"splunkjs/compiled/js_charting","js_charting/visualizations/gauges/VerticalMarkerGauge":"splunkjs/compiled/js_charting","js_charting/js_charting":"splunkjs/compiled/js_charting","util/jscharting_utils":"splunkjs/mvc/chartview","splunkjs/mvc/chartview":"splunkjs/mvc/chartview","splunk/charting/Legend":"splunkjs/mvc/splunkmapview","splunk/charting/ExternalLegend":"splunkjs/mvc/splunkmapview","contrib/text!contrib/leaflet/leaflet.css":"splunkjs/mvc/splunkmapview","contrib/text!contrib/leaflet/leaflet.ie.css":"splunkjs/mvc/splunkmapview","leaflet":"splunkjs/mvc/splunkmapview","splunk/events/GenericEventData":"splunkjs/mvc/splunkmapview","splunk/mapping/LatLon":"splunkjs/mvc/splunkmapview","splunk/mapping/LatLonBounds":"splunkjs/mvc/splunkmapview","splunk/viz/MRenderTarget":"splunkjs/mvc/splunkmapview","splunk/mapping/layers/LayerBase":"splunkjs/mvc/splunkmapview","splunk/viz/VizBase":"splunkjs/mvc/splunkmapview","splunk/mapping/Map":"splunkjs/mvc/splunkmapview","splunk/vectors/VectorElement":"splunkjs/mvc/splunkmapview","splunk/vectors/Group":"splunkjs/mvc/splunkmapview","splunk/vectors/VectorUtils":"splunkjs/mvc/splunkmapview","splunk/vectors/Viewport":"splunkjs/mvc/splunkmapview","splunk/mapping/layers/VectorLayerBase":"splunkjs/mvc/splunkmapview","splunk/palettes/ColorPalette":"splunkjs/mvc/splunkmapview","splunk/palettes/ListColorPalette":"splunkjs/mvc/splunkmapview","splunk/vectors/Shape":"splunkjs/mvc/splunkmapview","splunk/vectors/Wedge":"splunkjs/mvc/splunkmapview","splunk/viz/MDataTarget":"splunkjs/mvc/splunkmapview","splunk/mapping/layers/PieMarkerLayer":"splunkjs/mvc/splunkmapview","splunk/parsers/Parser":"splunkjs/mvc/splunkmapview","splunk/parsers/ParseUtils":"splunkjs/mvc/splunkmapview","splunk/parsers/NumberParser":"splunkjs/mvc/splunkmapview","splunk/mapping/parsers/LatLonBoundsParser":"splunkjs/mvc/splunkmapview","splunk/mapping/parsers/LatLonParser":"splunkjs/mvc/splunkmapview","splunk/palettes/FieldColorPalette":"splunkjs/mvc/splunkmapview","splunk/parsers/StringParser":"splunkjs/mvc/splunkmapview","splunk/parsers/ArrayParser":"splunkjs/mvc/splunkmapview","splunk/parsers/BooleanParser":"splunkjs/mvc/splunkmapview","splunk/parsers/ObjectParser":"splunkjs/mvc/splunkmapview","views/shared/Map":"splunkjs/mvc/splunkmapview","splunkjs/mvc/splunkmapview":"splunkjs/mvc/splunkmapview","splunk/brushes/BorderStrokeBrush":"splunkjs/mvc/timelineview","splunk/charting/LogScale":"splunkjs/mvc/timelineview","splunk/time/TimeZone":"splunkjs/mvc/timelineview","splunk/time/SimpleTimeZone":"splunkjs/mvc/timelineview","splunk/time/LocalTimeZone":"splunkjs/mvc/timelineview","splunk/time/TimeZones":"splunkjs/mvc/timelineview","splunk/time/DateTime":"splunkjs/mvc/timelineview","splunk/viz/GraphicsVizBase":"splunkjs/mvc/timelineview","splunk/charting/Histogram":"splunkjs/mvc/timelineview","splunk/charting/ClickDragRangeMarker":"splunkjs/mvc/timelineview","splunk/charting/CursorMarker":"splunkjs/mvc/timelineview","splunk/charting/NumericAxisLabels":"splunkjs/mvc/timelineview","splunk/charting/GridLines":"splunkjs/mvc/timelineview","splunk/time/Duration":"splunkjs/mvc/timelineview","splunk/time/TimeUtils":"splunkjs/mvc/timelineview","splunk/charting/TimeAxisLabels":"splunkjs/mvc/timelineview","splunk/charting/Tooltip":"splunkjs/mvc/timelineview","splunk/time/SplunkTimeZone":"splunkjs/mvc/timelineview","splunk/charting/Timeline":"splunkjs/mvc/timelineview","views/shared/CanvasTimeline":"splunkjs/mvc/timelineview","splunkjs/mvc/timelineview":"splunkjs/mvc/timelineview","collections/search/Reports":"splunkjs/mvc/simplexml","util/xml":"splunkjs/mvc/simplexml","models/search/Dashboard":"splunkjs/mvc/simplexml","splunkjs/mvc/simplexml/dashboardmodel":"splunkjs/mvc/simplexml","splunkjs/mvc/simplexml/dashboardurl":"splunkjs/mvc/simplexml","splunkjs/mvc/simplexml/router":"splunkjs/mvc/simplexml","splunkjs/mvc/simplexml/controller":"splunkjs/mvc/simplexml","models/services/authorization/Role":"splunkjs/mvc/simplexml","collections/services/authorization/Roles":"splunkjs/mvc/simplexml","splunkjs/mvc/simplexml/mapper":"splunkjs/mvc/simplexml","models/dashboards/DashboardReport":"splunkjs/mvc/simplexml","util/moment/compactFromNow":"splunkjs/mvc/simplexml","splunkjs/mvc/refreshtimeindicatorview":"splunkjs/mvc/simplexml","splunkjs/mvc/resultslinkview":"splunkjs/mvc/simplexml","views/shared/vizcontrols/custom_controls/DrilldownRadio":"splunkjs/mvc/simplexml","views/shared/vizcontrols/custom_controls/DrilldownRadioGroup":"splunkjs/mvc/simplexml","views/shared/vizcontrols/custom_controls/StackModeControlGroup":"splunkjs/mvc/simplexml","views/shared/vizcontrols/custom_controls/NullValueModeControlGroup":"splunkjs/mvc/simplexml","views/shared/vizcontrols/custom_controls/GaugeStyleControlGroup":"splunkjs/mvc/simplexml","views/shared/vizcontrols/custom_controls/SingleValueBeforeLabelControlGroup":"splunkjs/mvc/simplexml","views/shared/vizcontrols/custom_controls/SingleValueAfterLabelControlGroup":"splunkjs/mvc/simplexml","views/shared/vizcontrols/custom_controls/SingleValueUnderLabelControlGroup":"splunkjs/mvc/simplexml","views/shared/vizcontrols/custom_controls/MultiSeriesRadio":"splunkjs/mvc/simplexml","views/shared/vizcontrols/custom_controls/MapDrilldownControlGroup":"splunkjs/mvc/simplexml","views/shared/vizcontrols/components/General":"splunkjs/mvc/simplexml","views/shared/vizcontrols/custom_controls/AxisTitleControlGroup":"splunkjs/mvc/simplexml","views/shared/vizcontrols/custom_controls/AxisScaleControlGroup":"splunkjs/mvc/simplexml","views/shared/vizcontrols/custom_controls/AxisIntervalControlGroup":"splunkjs/mvc/simplexml","views/shared/vizcontrols/custom_controls/AxisMinValueControlGroup":"splunkjs/mvc/simplexml","views/shared/vizcontrols/custom_controls/AxisMaxValueControlGroup":"splunkjs/mvc/simplexml","views/shared/vizcontrols/custom_controls/AxisLabelRotationControlGroup":"splunkjs/mvc/simplexml","views/shared/vizcontrols/custom_controls/AxisLabelElisionControlGroup":"splunkjs/mvc/simplexml","views/shared/vizcontrols/components/XAxis":"splunkjs/mvc/simplexml","views/shared/vizcontrols/components/YAxis":"splunkjs/mvc/simplexml","views/shared/controls/MultiInputControl":"splunkjs/mvc/simplexml","views/shared/vizcontrols/custom_controls/OverlayFieldsControlGroup":"splunkjs/mvc/simplexml","views/shared/vizcontrols/custom_controls/AxisEnabledControlGroup":"splunkjs/mvc/simplexml","views/shared/vizcontrols/components/ChartOverlay":"splunkjs/mvc/simplexml","views/shared/vizcontrols/custom_controls/LegendPlacementControlGroup":"splunkjs/mvc/simplexml","views/shared/vizcontrols/custom_controls/LegendTruncationControlGroup":"splunkjs/mvc/simplexml","views/shared/vizcontrols/components/Legend":"splunkjs/mvc/simplexml","views/shared/vizcontrols/custom_controls/GaugeAutoRangesControlGroup":"splunkjs/mvc/simplexml","views/shared/vizcontrols/components/color/ColorPicker":"splunkjs/mvc/simplexml","views/shared/vizcontrols/components/color/Ranges":"splunkjs/mvc/simplexml","views/shared/vizcontrols/components/color/Master":"splunkjs/mvc/simplexml","views/shared/vizcontrols/components/Statistics":"splunkjs/mvc/simplexml","views/shared/vizcontrols/components/Events":"splunkjs/mvc/simplexml","views/shared/vizcontrols/custom_controls/MapCenterControlGroup":"splunkjs/mvc/simplexml","views/shared/vizcontrols/custom_controls/MapZoomControlGroup":"splunkjs/mvc/simplexml","views/shared/vizcontrols/components/Map":"splunkjs/mvc/simplexml","views/shared/controls/PercentTextControl":"splunkjs/mvc/simplexml","views/shared/vizcontrols/custom_controls/MapMarkerOpacityControlGroup":"splunkjs/mvc/simplexml","views/shared/vizcontrols/custom_controls/MapMarkerMinSizeControlGroup":"splunkjs/mvc/simplexml","views/shared/vizcontrols/custom_controls/MapMarkerMaxSizeControlGroup":"splunkjs/mvc/simplexml","views/shared/vizcontrols/custom_controls/MapMarkerMaxClustersControlGroup":"splunkjs/mvc/simplexml","views/shared/vizcontrols/components/Markers":"splunkjs/mvc/simplexml","views/shared/DropDownMenu":"splunkjs/mvc/simplexml","views/shared/vizcontrols/custom_controls/MapTileUrlControlGroup":"splunkjs/mvc/simplexml","views/shared/vizcontrols/custom_controls/MapTileMinZoomControlGroup":"splunkjs/mvc/simplexml","views/shared/vizcontrols/custom_controls/MapTileMaxZoomControlGroup":"splunkjs/mvc/simplexml","views/shared/vizcontrols/components/Tiles":"splunkjs/mvc/simplexml","views/shared/vizcontrols/components/Master":"splunkjs/mvc/simplexml","views/shared/vizcontrols/Format":"splunkjs/mvc/simplexml","models/shared/Visualization":"splunkjs/mvc/simplexml","views/shared/vizcontrols/Master":"splunkjs/mvc/simplexml","views/shared/reportcontrols/details/History":"splunkjs/mvc/simplexml","views/shared/reportcontrols/details/Creator":"splunkjs/mvc/simplexml","views/shared/documentcontrols/details/App":"splunkjs/mvc/simplexml","models/shared/Cron":"splunkjs/mvc/simplexml","views/shared/reportcontrols/details/Schedule":"splunkjs/mvc/simplexml","views/shared/delegates/ModalTimerangePicker":"splunkjs/mvc/simplexml","views/shared/ScheduleSentence":"splunkjs/mvc/simplexml","views/shared/reportcontrols/dialogs/schedule_dialog/step1/Schedule":"splunkjs/mvc/simplexml","views/shared/reportcontrols/dialogs/schedule_dialog/step1/Master":"splunkjs/mvc/simplexml","views/shared/EmailOptions":"splunkjs/mvc/simplexml","views/shared/reportcontrols/dialogs/schedule_dialog/Step2":"splunkjs/mvc/simplexml","views/shared/reportcontrols/dialogs/schedule_dialog/Master":"splunkjs/mvc/simplexml","views/shared/reportcontrols/details/EditSchedule":"splunkjs/mvc/simplexml","views/shared/reportcontrols/details/Acceleration":"splunkjs/mvc/simplexml","views/shared/reportcontrols/dialogs/AccelerationDialog":"splunkjs/mvc/simplexml","views/shared/reportcontrols/details/EditAcceleration":"splunkjs/mvc/simplexml","views/shared/documentcontrols/details/Permissions":"splunkjs/mvc/simplexml","views/shared/documentcontrols/dialogs/permissions_dialog/ACL":"splunkjs/mvc/simplexml","views/shared/documentcontrols/dialogs/permissions_dialog/Master":"splunkjs/mvc/simplexml","views/shared/reportcontrols/details/EditPermissions":"splunkjs/mvc/simplexml","views/shared/reportcontrols/details/Embed":"splunkjs/mvc/simplexml","views/shared/reportcontrols/dialogs/embed_dialog/NotScheduled":"splunkjs/mvc/simplexml","views/shared/reportcontrols/dialogs/embed_dialog/Confirmation":"splunkjs/mvc/simplexml","models/services/saved/searches/History":"splunkjs/mvc/simplexml","collections/services/saved/searches/Histories":"splunkjs/mvc/simplexml","views/shared/FlashMessagesLegacy":"splunkjs/mvc/simplexml","views/shared/reportcontrols/dialogs/embed_dialog/Embed":"splunkjs/mvc/simplexml","views/shared/reportcontrols/dialogs/embed_dialog/Master":"splunkjs/mvc/simplexml","views/shared/reportcontrols/details/EditEmbed":"splunkjs/mvc/simplexml","views/shared/reportcontrols/details/Master":"splunkjs/mvc/simplexml","views/dashboards/panelcontrols/titledialog/Modal":"splunkjs/mvc/simplexml","splunkjs/mvc/simpleform/formutils":"splunkjs/mvc/simplexml","views/dashboards/PanelTimeRangePicker":"splunkjs/mvc/simplexml","views/dashboards/panelcontrols/querydialog/Modal":"splunkjs/mvc/simplexml","views/dashboards/panelcontrols/ReportDialog":"splunkjs/mvc/simplexml","views/dashboards/panelcontrols/CreateReportDialog":"splunkjs/mvc/simplexml","views/ValidatingView":"splunkjs/mvc/simplexml","views/shared/dialogs/DialogBase":"splunkjs/mvc/simplexml","views/shared/dialogs/TextDialog":"splunkjs/mvc/simplexml","views/dashboards/panelcontrols/Master":"splunkjs/mvc/simplexml","splunkjs/mvc/simplexml/paneleditor":"splunkjs/mvc/simplexml","splunkjs/mvc/simplexml/element/base":"splunkjs/mvc/simplexml","splunkjs/mvc/simplexml/dialog/addpanel/inline":"splunkjs/mvc/simplexml","splunkjs/mvc/simplexml/dialog/addpanel/report":"splunkjs/mvc/simplexml","splunkjs/mvc/simplexml/dialog/addpanel/pivot":"splunkjs/mvc/simplexml","splunkjs/mvc/simplexml/dialog/addpanel/master":"splunkjs/mvc/simplexml","splunkjs/mvc/simplexml/dialog/addpanel":"splunkjs/mvc/simplexml","views/shared/documentcontrols/dialogs/TitleDescriptionDialog":"splunkjs/mvc/simplexml","views/shared/documentcontrols/dialogs/DeleteDialog":"splunkjs/mvc/simplexml","views/dashboards/table/controls/ConvertSuccess":"splunkjs/mvc/simplexml","views/shared/delegates/PairedTextControls":"splunkjs/mvc/simplexml","views/dashboards/table/controls/ConvertDashboard":"splunkjs/mvc/simplexml","models/services/ScheduledView":"splunkjs/mvc/simplexml","views/dashboards/table/controls/SchedulePDF":"splunkjs/mvc/simplexml","views/dashboards/table/controls/CloneSuccess":"splunkjs/mvc/simplexml","views/dashboards/table/controls/CloneDashboard":"splunkjs/mvc/simplexml","splunkjs/mvc/simplexml/dialog/dashboardtitle":"splunkjs/mvc/simplexml","splunkjs/mvc/simplexml/editdashboard/editmenu":"splunkjs/mvc/simplexml","splunkjs/mvc/simplexml/editdashboard/moreinfomenu":"splunkjs/mvc/simplexml","splunkjs/mvc/simpleform/inputsettings":"splunkjs/mvc/simplexml","views/shared/delegates/Concertina":"splunkjs/mvc/simplexml","splunkjs/mvc/simpleform/edit/concertinasettingseditor":"splunkjs/mvc/simplexml","jquery.ui.droppable":"splunkjs/mvc/simplexml","jquery.ui.sortable":"splunkjs/mvc/simplexml","splunkjs/mvc/simpleform/edit/staticoptionscontrol":"splunkjs/mvc/simplexml","splunkjs/mvc/simpleform/edit/dynamicoptionscontrol":"splunkjs/mvc/simplexml","splunkjs/mvc/simpleform/edit/defaultcontrol":"splunkjs/mvc/simplexml","splunkjs/mvc/simpleform/edit/tokenpreviewcontrol":"splunkjs/mvc/simplexml","splunkjs/mvc/simpleform/edit/editinputmenu":"splunkjs/mvc/simplexml","splunkjs/mvc/simpleform/edit/menu":"splunkjs/mvc/simplexml","splunkjs/mvc/simpleform/input/base":"splunkjs/mvc/simplexml","splunkjs/mvc/simpleform/input/submit":"splunkjs/mvc/simplexml","splunkjs/mvc/simpleform/input/timerange":"splunkjs/mvc/simplexml","splunkjs/mvc/simplexml/editdashboard/addformmenu":"splunkjs/mvc/simplexml","splunkjs/mvc/simplexml/editdashboard/menuview":"splunkjs/mvc/simplexml","splunkjs/mvc/simplexml/editdashboard/master":"splunkjs/mvc/simplexml","splunkjs/mvc/simplexml/dragndrop":"splunkjs/mvc/simplexml","splunkjs/mvc/simpleform/fieldsetview":"splunkjs/mvc/simplexml","splunkjs/mvc/simplexml/dashboard/title":"splunkjs/mvc/simplexml","splunkjs/mvc/simplexml/dashboard/description":"splunkjs/mvc/simplexml","splunkjs/mvc/simplexml/dashboard/row":"splunkjs/mvc/simplexml","splunkjs/mvc/simplexml/dashboard/panel":"splunkjs/mvc/simplexml","splunkjs/mvc/simplexml/dashboard/empty":"splunkjs/mvc/simplexml","splunkjs/mvc/simpleform/edit/formsettings":"splunkjs/mvc/simplexml","splunkjs/mvc/simplexml/dashboardview":"splunkjs/mvc/simplexml","splunkjs/mvc/simplexml/dashboard":"splunkjs/mvc/simplexml","splunkjs/mvc/simplexml/element/table":"splunkjs/mvc/simplexml","splunkjs/mvc/simplexml/element/chart":"splunkjs/mvc/simplexml","splunkjs/mvc/simplexml/element/event":"splunkjs/mvc/simplexml","splunkjs/mvc/simplexml/element/single":"splunkjs/mvc/simplexml","splunkjs/mvc/simplexml/element/map":"splunkjs/mvc/simplexml","splunkjs/mvc/simplexml/element/list":"splunkjs/mvc/simplexml","splunkjs/mvc/simplexml/element/html":"splunkjs/mvc/simplexml","splunkjs/mvc/simplexml/urltokenmodel":"splunkjs/mvc/simplexml","splunkjs/mvc/simpleform/input/text":"splunkjs/mvc/simplexml","splunkjs/mvc/simpleform/input/dropdown":"splunkjs/mvc/simplexml","splunkjs/mvc/simpleform/input/radiogroup":"splunkjs/mvc/simplexml","splunkjs/mvc/simpleform/input":"splunkjs/mvc/simplexml","splunkjs/mvc/simpleform/input/checkboxgroup":"splunkjs/mvc/simplexml","splunkjs/mvc/simpleform/input/multiselect":"splunkjs/mvc/simplexml","splunkjs/mvc/simplexml":"splunkjs/mvc/simplexml"}});

