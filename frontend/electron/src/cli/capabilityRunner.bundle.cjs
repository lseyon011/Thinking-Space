"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// node_modules/@capacitor/core/dist/index.cjs.js
var require_index_cjs = __commonJS({
  "node_modules/@capacitor/core/dist/index.cjs.js"(exports2) {
    "use strict";
    Object.defineProperty(exports2, "__esModule", { value: true });
    exports2.ExceptionCode = void 0;
    (function(ExceptionCode) {
      ExceptionCode["Unimplemented"] = "UNIMPLEMENTED";
      ExceptionCode["Unavailable"] = "UNAVAILABLE";
    })(exports2.ExceptionCode || (exports2.ExceptionCode = {}));
    var CapacitorException = class extends Error {
      constructor(message, code, data) {
        super(message);
        this.message = message;
        this.code = code;
        this.data = data;
      }
    };
    var getPlatformId = (win) => {
      var _a, _b;
      if (win === null || win === void 0 ? void 0 : win.androidBridge) {
        return "android";
      } else if ((_b = (_a = win === null || win === void 0 ? void 0 : win.webkit) === null || _a === void 0 ? void 0 : _a.messageHandlers) === null || _b === void 0 ? void 0 : _b.bridge) {
        return "ios";
      } else {
        return "web";
      }
    };
    var createCapacitor = (win) => {
      const capCustomPlatform = win.CapacitorCustomPlatform || null;
      const cap = win.Capacitor || {};
      const Plugins = cap.Plugins = cap.Plugins || {};
      const getPlatform = () => {
        return capCustomPlatform !== null ? capCustomPlatform.name : getPlatformId(win);
      };
      const isNativePlatform = () => getPlatform() !== "web";
      const isPluginAvailable = (pluginName) => {
        const plugin = registeredPlugins.get(pluginName);
        if (plugin === null || plugin === void 0 ? void 0 : plugin.platforms.has(getPlatform())) {
          return true;
        }
        if (getPluginHeader(pluginName)) {
          return true;
        }
        return false;
      };
      const getPluginHeader = (pluginName) => {
        var _a;
        return (_a = cap.PluginHeaders) === null || _a === void 0 ? void 0 : _a.find((h) => h.name === pluginName);
      };
      const handleError = (err) => win.console.error(err);
      const registeredPlugins = /* @__PURE__ */ new Map();
      const registerPlugin2 = (pluginName, jsImplementations = {}) => {
        const registeredPlugin = registeredPlugins.get(pluginName);
        if (registeredPlugin) {
          console.warn(`Capacitor plugin "${pluginName}" already registered. Cannot register plugins twice.`);
          return registeredPlugin.proxy;
        }
        const platform = getPlatform();
        const pluginHeader = getPluginHeader(pluginName);
        let jsImplementation;
        const loadPluginImplementation = async () => {
          if (!jsImplementation && platform in jsImplementations) {
            jsImplementation = typeof jsImplementations[platform] === "function" ? jsImplementation = await jsImplementations[platform]() : jsImplementation = jsImplementations[platform];
          } else if (capCustomPlatform !== null && !jsImplementation && "web" in jsImplementations) {
            jsImplementation = typeof jsImplementations["web"] === "function" ? jsImplementation = await jsImplementations["web"]() : jsImplementation = jsImplementations["web"];
          }
          return jsImplementation;
        };
        const createPluginMethod = (impl, prop) => {
          var _a, _b;
          if (pluginHeader) {
            const methodHeader = pluginHeader === null || pluginHeader === void 0 ? void 0 : pluginHeader.methods.find((m) => prop === m.name);
            if (methodHeader) {
              if (methodHeader.rtype === "promise") {
                return (options) => cap.nativePromise(pluginName, prop.toString(), options);
              } else {
                return (options, callback) => cap.nativeCallback(pluginName, prop.toString(), options, callback);
              }
            } else if (impl) {
              return (_a = impl[prop]) === null || _a === void 0 ? void 0 : _a.bind(impl);
            }
          } else if (impl) {
            return (_b = impl[prop]) === null || _b === void 0 ? void 0 : _b.bind(impl);
          } else {
            throw new CapacitorException(`"${pluginName}" plugin is not implemented on ${platform}`, exports2.ExceptionCode.Unimplemented);
          }
        };
        const createPluginMethodWrapper = (prop) => {
          let remove2;
          const wrapper = (...args) => {
            const p = loadPluginImplementation().then((impl) => {
              const fn = createPluginMethod(impl, prop);
              if (fn) {
                const p2 = fn(...args);
                remove2 = p2 === null || p2 === void 0 ? void 0 : p2.remove;
                return p2;
              } else {
                throw new CapacitorException(`"${pluginName}.${prop}()" is not implemented on ${platform}`, exports2.ExceptionCode.Unimplemented);
              }
            });
            if (prop === "addListener") {
              p.remove = async () => remove2();
            }
            return p;
          };
          wrapper.toString = () => `${prop.toString()}() { [capacitor code] }`;
          Object.defineProperty(wrapper, "name", {
            value: prop,
            writable: false,
            configurable: false
          });
          return wrapper;
        };
        const addListener = createPluginMethodWrapper("addListener");
        const removeListener = createPluginMethodWrapper("removeListener");
        const addListenerNative = (eventName, callback) => {
          const call = addListener({ eventName }, callback);
          const remove2 = async () => {
            const callbackId = await call;
            removeListener({
              eventName,
              callbackId
            }, callback);
          };
          const p = new Promise((resolve2) => call.then(() => resolve2({ remove: remove2 })));
          p.remove = async () => {
            console.warn(`Using addListener() without 'await' is deprecated.`);
            await remove2();
          };
          return p;
        };
        const proxy = new Proxy({}, {
          get(_, prop) {
            switch (prop) {
              // https://github.com/facebook/react/issues/20030
              case "$$typeof":
                return void 0;
              case "toJSON":
                return () => ({});
              case "addListener":
                return pluginHeader ? addListenerNative : addListener;
              case "removeListener":
                return removeListener;
              default:
                return createPluginMethodWrapper(prop);
            }
          }
        });
        Plugins[pluginName] = proxy;
        registeredPlugins.set(pluginName, {
          name: pluginName,
          proxy,
          platforms: /* @__PURE__ */ new Set([...Object.keys(jsImplementations), ...pluginHeader ? [platform] : []])
        });
        return proxy;
      };
      if (!cap.convertFileSrc) {
        cap.convertFileSrc = (filePath) => filePath;
      }
      cap.getPlatform = getPlatform;
      cap.handleError = handleError;
      cap.isNativePlatform = isNativePlatform;
      cap.isPluginAvailable = isPluginAvailable;
      cap.registerPlugin = registerPlugin2;
      cap.Exception = CapacitorException;
      cap.DEBUG = !!cap.DEBUG;
      cap.isLoggingEnabled = !!cap.isLoggingEnabled;
      return cap;
    };
    var initCapacitorGlobal = (win) => win.Capacitor = createCapacitor(win);
    var Capacitor2 = /* @__PURE__ */ initCapacitorGlobal(typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {});
    var registerPlugin = Capacitor2.registerPlugin;
    var WebPlugin = class {
      constructor() {
        this.listeners = {};
        this.retainedEventArguments = {};
        this.windowListeners = {};
      }
      addListener(eventName, listenerFunc) {
        let firstListener = false;
        const listeners = this.listeners[eventName];
        if (!listeners) {
          this.listeners[eventName] = [];
          firstListener = true;
        }
        this.listeners[eventName].push(listenerFunc);
        const windowListener = this.windowListeners[eventName];
        if (windowListener && !windowListener.registered) {
          this.addWindowListener(windowListener);
        }
        if (firstListener) {
          this.sendRetainedArgumentsForEvent(eventName);
        }
        const remove2 = async () => this.removeListener(eventName, listenerFunc);
        const p = Promise.resolve({ remove: remove2 });
        return p;
      }
      async removeAllListeners() {
        this.listeners = {};
        for (const listener in this.windowListeners) {
          this.removeWindowListener(this.windowListeners[listener]);
        }
        this.windowListeners = {};
      }
      notifyListeners(eventName, data, retainUntilConsumed) {
        const listeners = this.listeners[eventName];
        if (!listeners) {
          if (retainUntilConsumed) {
            let args = this.retainedEventArguments[eventName];
            if (!args) {
              args = [];
            }
            args.push(data);
            this.retainedEventArguments[eventName] = args;
          }
          return;
        }
        listeners.forEach((listener) => listener(data));
      }
      hasListeners(eventName) {
        var _a;
        return !!((_a = this.listeners[eventName]) === null || _a === void 0 ? void 0 : _a.length);
      }
      registerWindowListener(windowEventName, pluginEventName) {
        this.windowListeners[pluginEventName] = {
          registered: false,
          windowEventName,
          pluginEventName,
          handler: (event) => {
            this.notifyListeners(pluginEventName, event);
          }
        };
      }
      unimplemented(msg = "not implemented") {
        return new Capacitor2.Exception(msg, exports2.ExceptionCode.Unimplemented);
      }
      unavailable(msg = "not available") {
        return new Capacitor2.Exception(msg, exports2.ExceptionCode.Unavailable);
      }
      async removeListener(eventName, listenerFunc) {
        const listeners = this.listeners[eventName];
        if (!listeners) {
          return;
        }
        const index = listeners.indexOf(listenerFunc);
        this.listeners[eventName].splice(index, 1);
        if (!this.listeners[eventName].length) {
          this.removeWindowListener(this.windowListeners[eventName]);
        }
      }
      addWindowListener(handle) {
        window.addEventListener(handle.windowEventName, handle.handler);
        handle.registered = true;
      }
      removeWindowListener(handle) {
        if (!handle) {
          return;
        }
        window.removeEventListener(handle.windowEventName, handle.handler);
        handle.registered = false;
      }
      sendRetainedArgumentsForEvent(eventName) {
        const args = this.retainedEventArguments[eventName];
        if (!args) {
          return;
        }
        delete this.retainedEventArguments[eventName];
        args.forEach((arg) => {
          this.notifyListeners(eventName, arg);
        });
      }
    };
    var WebView = /* @__PURE__ */ registerPlugin("WebView");
    var encode = (str2) => encodeURIComponent(str2).replace(/%(2[346B]|5E|60|7C)/g, decodeURIComponent).replace(/[()]/g, escape);
    var decode = (str2) => str2.replace(/(%[\dA-F]{2})+/gi, decodeURIComponent);
    var CapacitorCookiesPluginWeb = class extends WebPlugin {
      async getCookies() {
        const cookies = document.cookie;
        const cookieMap = {};
        cookies.split(";").forEach((cookie) => {
          if (cookie.length <= 0)
            return;
          let [key, value] = cookie.replace(/=/, "CAP_COOKIE").split("CAP_COOKIE");
          key = decode(key).trim();
          value = decode(value).trim();
          cookieMap[key] = value;
        });
        return cookieMap;
      }
      async setCookie(options) {
        try {
          const encodedKey = encode(options.key);
          const encodedValue = encode(options.value);
          const expires = options.expires ? `; expires=${options.expires.replace("expires=", "")}` : "";
          const path3 = (options.path || "/").replace("path=", "");
          const domain = options.url != null && options.url.length > 0 ? `domain=${options.url}` : "";
          document.cookie = `${encodedKey}=${encodedValue || ""}${expires}; path=${path3}; ${domain};`;
        } catch (error) {
          return Promise.reject(error);
        }
      }
      async deleteCookie(options) {
        try {
          document.cookie = `${options.key}=; Max-Age=0`;
        } catch (error) {
          return Promise.reject(error);
        }
      }
      async clearCookies() {
        try {
          const cookies = document.cookie.split(";") || [];
          for (const cookie of cookies) {
            document.cookie = cookie.replace(/^ +/, "").replace(/=.*/, `=;expires=${(/* @__PURE__ */ new Date()).toUTCString()};path=/`);
          }
        } catch (error) {
          return Promise.reject(error);
        }
      }
      async clearAllCookies() {
        try {
          await this.clearCookies();
        } catch (error) {
          return Promise.reject(error);
        }
      }
    };
    var CapacitorCookies = registerPlugin("CapacitorCookies", {
      web: () => new CapacitorCookiesPluginWeb()
    });
    var readBlobAsBase64 = async (blob) => new Promise((resolve2, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64String = reader.result;
        resolve2(base64String.indexOf(",") >= 0 ? base64String.split(",")[1] : base64String);
      };
      reader.onerror = (error) => reject(error);
      reader.readAsDataURL(blob);
    });
    var normalizeHttpHeaders = (headers = {}) => {
      const originalKeys = Object.keys(headers);
      const loweredKeys = Object.keys(headers).map((k) => k.toLocaleLowerCase());
      const normalized = loweredKeys.reduce((acc, key, index) => {
        acc[key] = headers[originalKeys[index]];
        return acc;
      }, {});
      return normalized;
    };
    var buildUrlParams = (params, shouldEncode = true) => {
      if (!params)
        return null;
      const output = Object.entries(params).reduce((accumulator, entry) => {
        const [key, value] = entry;
        let encodedValue;
        let item;
        if (Array.isArray(value)) {
          item = "";
          value.forEach((str2) => {
            encodedValue = shouldEncode ? encodeURIComponent(str2) : str2;
            item += `${key}=${encodedValue}&`;
          });
          item.slice(0, -1);
        } else {
          encodedValue = shouldEncode ? encodeURIComponent(value) : value;
          item = `${key}=${encodedValue}`;
        }
        return `${accumulator}&${item}`;
      }, "");
      return output.substr(1);
    };
    var buildRequestInit = (options, extra = {}) => {
      const output = Object.assign({ method: options.method || "GET", headers: options.headers }, extra);
      const headers = normalizeHttpHeaders(options.headers);
      const type2 = headers["content-type"] || "";
      if (typeof options.data === "string") {
        output.body = options.data;
      } else if (type2.includes("application/x-www-form-urlencoded")) {
        const params = new URLSearchParams();
        for (const [key, value] of Object.entries(options.data || {})) {
          params.set(key, value);
        }
        output.body = params.toString();
      } else if (type2.includes("multipart/form-data") || options.data instanceof FormData) {
        const form = new FormData();
        if (options.data instanceof FormData) {
          options.data.forEach((value, key) => {
            form.append(key, value);
          });
        } else {
          for (const key of Object.keys(options.data)) {
            form.append(key, options.data[key]);
          }
        }
        output.body = form;
        const headers2 = new Headers(output.headers);
        headers2.delete("content-type");
        output.headers = headers2;
      } else if (type2.includes("application/json") || typeof options.data === "object") {
        output.body = JSON.stringify(options.data);
      }
      return output;
    };
    var CapacitorHttpPluginWeb = class extends WebPlugin {
      /**
       * Perform an Http request given a set of options
       * @param options Options to build the HTTP request
       */
      async request(options) {
        const requestInit = buildRequestInit(options, options.webFetchExtra);
        const urlParams = buildUrlParams(options.params, options.shouldEncodeUrlParams);
        const url = urlParams ? `${options.url}?${urlParams}` : options.url;
        const response = await fetch(url, requestInit);
        const contentType = response.headers.get("content-type") || "";
        let { responseType = "text" } = response.ok ? options : {};
        if (contentType.includes("application/json")) {
          responseType = "json";
        }
        let data;
        let blob;
        switch (responseType) {
          case "arraybuffer":
          case "blob":
            blob = await response.blob();
            data = await readBlobAsBase64(blob);
            break;
          case "json":
            data = await response.json();
            break;
          case "document":
          case "text":
          default:
            data = await response.text();
        }
        const headers = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });
        return {
          data,
          headers,
          status: response.status,
          url: response.url
        };
      }
      /**
       * Perform an Http GET request given a set of options
       * @param options Options to build the HTTP request
       */
      async get(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "GET" }));
      }
      /**
       * Perform an Http POST request given a set of options
       * @param options Options to build the HTTP request
       */
      async post(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "POST" }));
      }
      /**
       * Perform an Http PUT request given a set of options
       * @param options Options to build the HTTP request
       */
      async put(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "PUT" }));
      }
      /**
       * Perform an Http PATCH request given a set of options
       * @param options Options to build the HTTP request
       */
      async patch(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "PATCH" }));
      }
      /**
       * Perform an Http DELETE request given a set of options
       * @param options Options to build the HTTP request
       */
      async delete(options) {
        return this.request(Object.assign(Object.assign({}, options), { method: "DELETE" }));
      }
    };
    var CapacitorHttp = registerPlugin("CapacitorHttp", {
      web: () => new CapacitorHttpPluginWeb()
    });
    exports2.SystemBarsStyle = void 0;
    (function(SystemBarsStyle) {
      SystemBarsStyle["Dark"] = "DARK";
      SystemBarsStyle["Light"] = "LIGHT";
      SystemBarsStyle["Default"] = "DEFAULT";
    })(exports2.SystemBarsStyle || (exports2.SystemBarsStyle = {}));
    exports2.SystemBarType = void 0;
    (function(SystemBarType) {
      SystemBarType["StatusBar"] = "StatusBar";
      SystemBarType["NavigationBar"] = "NavigationBar";
    })(exports2.SystemBarType || (exports2.SystemBarType = {}));
    var SystemBarsPluginWeb = class extends WebPlugin {
      async setStyle() {
        this.unavailable("not available for web");
      }
      async setAnimation() {
        this.unavailable("not available for web");
      }
      async show() {
        this.unavailable("not available for web");
      }
      async hide() {
        this.unavailable("not available for web");
      }
    };
    var SystemBars = registerPlugin("SystemBars", {
      web: () => new SystemBarsPluginWeb()
    });
    exports2.Capacitor = Capacitor2;
    exports2.CapacitorCookies = CapacitorCookies;
    exports2.CapacitorException = CapacitorException;
    exports2.CapacitorHttp = CapacitorHttp;
    exports2.SystemBars = SystemBars;
    exports2.WebPlugin = WebPlugin;
    exports2.WebView = WebView;
    exports2.buildRequestInit = buildRequestInit;
    exports2.registerPlugin = registerPlugin;
  }
});

// node_modules/@capacitor/synapse/dist/synapse.cjs
var require_synapse = __commonJS({
  "node_modules/@capacitor/synapse/dist/synapse.cjs"(exports2) {
    "use strict";
    Object.defineProperty(exports2, Symbol.toStringTag, { value: "Module" });
    function s(t) {
      t.CapacitorUtils.Synapse = new Proxy({}, { get(a, o) {
        return new Proxy({}, { get(d, n) {
          return (c, p, r) => {
            const e = t.Capacitor.Plugins[o];
            if (e === void 0) {
              r(new Error(`Capacitor plugin ${o} not found`));
              return;
            }
            if (typeof e[n] != "function") {
              r(new Error(`Method ${n} not found in Capacitor plugin ${o}`));
              return;
            }
            (async () => {
              try {
                const i = await e[n](c);
                p(i);
              } catch (i) {
                r(i);
              }
            })();
          };
        } });
      } });
    }
    function u(t) {
      t.CapacitorUtils.Synapse = new Proxy({}, { get(a, o) {
        return t.cordova.plugins[o];
      } });
    }
    function y(t = false) {
      typeof window > "u" || (window.CapacitorUtils = window.CapacitorUtils || {}, window.Capacitor !== void 0 && !t ? s(window) : window.cordova !== void 0 && u(window));
    }
    exports2.exposeSynapse = y;
  }
});

// node_modules/@capacitor/filesystem/dist/plugin.cjs.js
var require_plugin_cjs = __commonJS({
  "node_modules/@capacitor/filesystem/dist/plugin.cjs.js"(exports2) {
    "use strict";
    var core2 = require_index_cjs();
    var synapse = require_synapse();
    exports2.Directory = void 0;
    (function(Directory) {
      Directory["Documents"] = "DOCUMENTS";
      Directory["Data"] = "DATA";
      Directory["Library"] = "LIBRARY";
      Directory["Cache"] = "CACHE";
      Directory["External"] = "EXTERNAL";
      Directory["ExternalStorage"] = "EXTERNAL_STORAGE";
      Directory["ExternalCache"] = "EXTERNAL_CACHE";
      Directory["LibraryNoCloud"] = "LIBRARY_NO_CLOUD";
      Directory["Temporary"] = "TEMPORARY";
    })(exports2.Directory || (exports2.Directory = {}));
    exports2.Encoding = void 0;
    (function(Encoding) {
      Encoding["UTF8"] = "utf8";
      Encoding["ASCII"] = "ascii";
      Encoding["UTF16"] = "utf16";
    })(exports2.Encoding || (exports2.Encoding = {}));
    var FilesystemDirectory = exports2.Directory;
    var FilesystemEncoding = exports2.Encoding;
    var Filesystem = core2.registerPlugin("Filesystem", {
      web: () => Promise.resolve().then(function() {
        return web;
      }).then((m) => new m.FilesystemWeb())
    });
    synapse.exposeSynapse();
    function resolve2(path3) {
      const posix = path3.split("/").filter((item) => item !== ".");
      const newPosix = [];
      posix.forEach((item) => {
        if (item === ".." && newPosix.length > 0 && newPosix[newPosix.length - 1] !== "..") {
          newPosix.pop();
        } else {
          newPosix.push(item);
        }
      });
      return newPosix.join("/");
    }
    function isPathParent(parent, children) {
      parent = resolve2(parent);
      children = resolve2(children);
      const pathsA = parent.split("/");
      const pathsB = children.split("/");
      return parent !== children && pathsA.every((value, index) => value === pathsB[index]);
    }
    var FilesystemWeb = class _FilesystemWeb extends core2.WebPlugin {
      constructor() {
        super(...arguments);
        this.DB_VERSION = 1;
        this.DB_NAME = "Disc";
        this._writeCmds = ["add", "put", "delete"];
        this.downloadFile = async (options) => {
          var _a, _b;
          const requestInit = core2.buildRequestInit(options, options.webFetchExtra);
          const response = await fetch(options.url, requestInit);
          let blob;
          if (!options.progress)
            blob = await response.blob();
          else if (!(response === null || response === void 0 ? void 0 : response.body))
            blob = new Blob();
          else {
            const reader = response.body.getReader();
            let bytes = 0;
            const chunks = [];
            const contentType = response.headers.get("content-type");
            const contentLength = parseInt(response.headers.get("content-length") || "0", 10);
            while (true) {
              const { done, value } = await reader.read();
              if (done)
                break;
              chunks.push(value);
              bytes += (value === null || value === void 0 ? void 0 : value.length) || 0;
              const status = {
                url: options.url,
                bytes,
                contentLength
              };
              this.notifyListeners("progress", status);
            }
            const allChunks = new Uint8Array(bytes);
            let position = 0;
            for (const chunk of chunks) {
              if (typeof chunk === "undefined")
                continue;
              allChunks.set(chunk, position);
              position += chunk.length;
            }
            blob = new Blob([allChunks.buffer], { type: contentType || void 0 });
          }
          const result = await this.writeFile({
            path: options.path,
            directory: (_a = options.directory) !== null && _a !== void 0 ? _a : void 0,
            recursive: (_b = options.recursive) !== null && _b !== void 0 ? _b : false,
            data: blob
          });
          return { path: result.uri, blob };
        };
      }
      readFileInChunks(_options, _callback) {
        throw this.unavailable("Method not implemented.");
      }
      async initDb() {
        if (this._db !== void 0) {
          return this._db;
        }
        if (!("indexedDB" in window)) {
          throw this.unavailable("This browser doesn't support IndexedDB");
        }
        return new Promise((resolve3, reject) => {
          const request = indexedDB.open(this.DB_NAME, this.DB_VERSION);
          request.onupgradeneeded = _FilesystemWeb.doUpgrade;
          request.onsuccess = () => {
            this._db = request.result;
            resolve3(request.result);
          };
          request.onerror = () => reject(request.error);
          request.onblocked = () => {
            console.warn("db blocked");
          };
        });
      }
      static doUpgrade(event) {
        const eventTarget = event.target;
        const db = eventTarget.result;
        switch (event.oldVersion) {
          case 0:
          case 1:
          default: {
            if (db.objectStoreNames.contains("FileStorage")) {
              db.deleteObjectStore("FileStorage");
            }
            const store = db.createObjectStore("FileStorage", { keyPath: "path" });
            store.createIndex("by_folder", "folder");
          }
        }
      }
      async dbRequest(cmd, args) {
        const readFlag = this._writeCmds.indexOf(cmd) !== -1 ? "readwrite" : "readonly";
        return this.initDb().then((conn) => {
          return new Promise((resolve3, reject) => {
            const tx = conn.transaction(["FileStorage"], readFlag);
            const store = tx.objectStore("FileStorage");
            const req = store[cmd](...args);
            req.onsuccess = () => resolve3(req.result);
            req.onerror = () => reject(req.error);
          });
        });
      }
      async dbIndexRequest(indexName, cmd, args) {
        const readFlag = this._writeCmds.indexOf(cmd) !== -1 ? "readwrite" : "readonly";
        return this.initDb().then((conn) => {
          return new Promise((resolve3, reject) => {
            const tx = conn.transaction(["FileStorage"], readFlag);
            const store = tx.objectStore("FileStorage");
            const index = store.index(indexName);
            const req = index[cmd](...args);
            req.onsuccess = () => resolve3(req.result);
            req.onerror = () => reject(req.error);
          });
        });
      }
      getPath(directory, uriPath) {
        const cleanedUriPath = uriPath !== void 0 ? uriPath.replace(/^[/]+|[/]+$/g, "") : "";
        let fsPath = "";
        if (directory !== void 0)
          fsPath += "/" + directory;
        if (uriPath !== "")
          fsPath += "/" + cleanedUriPath;
        return fsPath;
      }
      async clear() {
        const conn = await this.initDb();
        const tx = conn.transaction(["FileStorage"], "readwrite");
        const store = tx.objectStore("FileStorage");
        store.clear();
      }
      /**
       * Read a file from disk
       * @param options options for the file read
       * @return a promise that resolves with the read file data result
       */
      async readFile(options) {
        const path3 = this.getPath(options.directory, options.path);
        const entry = await this.dbRequest("get", [path3]);
        if (entry === void 0)
          throw Error("File does not exist.");
        return { data: entry.content ? entry.content : "" };
      }
      /**
       * Write a file to disk in the specified location on device
       * @param options options for the file write
       * @return a promise that resolves with the file write result
       */
      async writeFile(options) {
        const path3 = this.getPath(options.directory, options.path);
        let data = options.data;
        const encoding = options.encoding;
        const doRecursive = options.recursive;
        const occupiedEntry = await this.dbRequest("get", [path3]);
        if (occupiedEntry && occupiedEntry.type === "directory")
          throw Error("The supplied path is a directory.");
        const parentPath = path3.substr(0, path3.lastIndexOf("/"));
        const parentEntry = await this.dbRequest("get", [parentPath]);
        if (parentEntry === void 0) {
          const subDirIndex = parentPath.indexOf("/", 1);
          if (subDirIndex !== -1) {
            const parentArgPath = parentPath.substr(subDirIndex);
            await this.mkdir({
              path: parentArgPath,
              directory: options.directory,
              recursive: doRecursive
            });
          }
        }
        if (!encoding && !(data instanceof Blob)) {
          data = data.indexOf(",") >= 0 ? data.split(",")[1] : data;
          if (!this.isBase64String(data))
            throw Error("The supplied data is not valid base64 content.");
        }
        const now = Date.now();
        const pathObj = {
          path: path3,
          folder: parentPath,
          type: "file",
          size: data instanceof Blob ? data.size : data.length,
          ctime: now,
          mtime: now,
          content: data
        };
        await this.dbRequest("put", [pathObj]);
        return {
          uri: pathObj.path
        };
      }
      /**
       * Append to a file on disk in the specified location on device
       * @param options options for the file append
       * @return a promise that resolves with the file write result
       */
      async appendFile(options) {
        const path3 = this.getPath(options.directory, options.path);
        let data = options.data;
        const encoding = options.encoding;
        const parentPath = path3.substr(0, path3.lastIndexOf("/"));
        const now = Date.now();
        let ctime = now;
        const occupiedEntry = await this.dbRequest("get", [path3]);
        if (occupiedEntry && occupiedEntry.type === "directory")
          throw Error("The supplied path is a directory.");
        const parentEntry = await this.dbRequest("get", [parentPath]);
        if (parentEntry === void 0) {
          const subDirIndex = parentPath.indexOf("/", 1);
          if (subDirIndex !== -1) {
            const parentArgPath = parentPath.substr(subDirIndex);
            await this.mkdir({
              path: parentArgPath,
              directory: options.directory,
              recursive: true
            });
          }
        }
        if (!encoding && !this.isBase64String(data))
          throw Error("The supplied data is not valid base64 content.");
        if (occupiedEntry !== void 0) {
          if (occupiedEntry.content instanceof Blob) {
            throw Error("The occupied entry contains a Blob object which cannot be appended to.");
          }
          if (occupiedEntry.content !== void 0 && !encoding) {
            data = btoa(atob(occupiedEntry.content) + atob(data));
          } else {
            data = occupiedEntry.content + data;
          }
          ctime = occupiedEntry.ctime;
        }
        const pathObj = {
          path: path3,
          folder: parentPath,
          type: "file",
          size: data.length,
          ctime,
          mtime: now,
          content: data
        };
        await this.dbRequest("put", [pathObj]);
      }
      /**
       * Delete a file from disk
       * @param options options for the file delete
       * @return a promise that resolves with the deleted file data result
       */
      async deleteFile(options) {
        const path3 = this.getPath(options.directory, options.path);
        const entry = await this.dbRequest("get", [path3]);
        if (entry === void 0)
          throw Error("File does not exist.");
        const entries = await this.dbIndexRequest("by_folder", "getAllKeys", [IDBKeyRange.only(path3)]);
        if (entries.length !== 0)
          throw Error("Folder is not empty.");
        await this.dbRequest("delete", [path3]);
      }
      /**
       * Create a directory.
       * @param options options for the mkdir
       * @return a promise that resolves with the mkdir result
       */
      async mkdir(options) {
        const path3 = this.getPath(options.directory, options.path);
        const doRecursive = options.recursive;
        const parentPath = path3.substr(0, path3.lastIndexOf("/"));
        const depth = (path3.match(/\//g) || []).length;
        const parentEntry = await this.dbRequest("get", [parentPath]);
        const occupiedEntry = await this.dbRequest("get", [path3]);
        if (depth === 1)
          throw Error("Cannot create Root directory");
        if (occupiedEntry !== void 0)
          throw Error("Current directory does already exist.");
        if (!doRecursive && depth !== 2 && parentEntry === void 0)
          throw Error("Parent directory must exist");
        if (doRecursive && depth !== 2 && parentEntry === void 0) {
          const parentArgPath = parentPath.substr(parentPath.indexOf("/", 1));
          await this.mkdir({
            path: parentArgPath,
            directory: options.directory,
            recursive: doRecursive
          });
        }
        const now = Date.now();
        const pathObj = {
          path: path3,
          folder: parentPath,
          type: "directory",
          size: 0,
          ctime: now,
          mtime: now
        };
        await this.dbRequest("put", [pathObj]);
      }
      /**
       * Remove a directory
       * @param options the options for the directory remove
       */
      async rmdir(options) {
        const { path: path3, directory, recursive } = options;
        const fullPath = this.getPath(directory, path3);
        const entry = await this.dbRequest("get", [fullPath]);
        if (entry === void 0)
          throw Error("Folder does not exist.");
        if (entry.type !== "directory")
          throw Error("Requested path is not a directory");
        const readDirResult = await this.readdir({ path: path3, directory });
        if (readDirResult.files.length !== 0 && !recursive)
          throw Error("Folder is not empty");
        for (const entry2 of readDirResult.files) {
          const entryPath = `${path3}/${entry2.name}`;
          const entryObj = await this.stat({ path: entryPath, directory });
          if (entryObj.type === "file") {
            await this.deleteFile({ path: entryPath, directory });
          } else {
            await this.rmdir({ path: entryPath, directory, recursive });
          }
        }
        await this.dbRequest("delete", [fullPath]);
      }
      /**
       * Return a list of files from the directory (not recursive)
       * @param options the options for the readdir operation
       * @return a promise that resolves with the readdir directory listing result
       */
      async readdir(options) {
        const path3 = this.getPath(options.directory, options.path);
        const entry = await this.dbRequest("get", [path3]);
        if (options.path !== "" && entry === void 0)
          throw Error("Folder does not exist.");
        const entries = await this.dbIndexRequest("by_folder", "getAllKeys", [IDBKeyRange.only(path3)]);
        const files = await Promise.all(entries.map(async (e) => {
          let subEntry = await this.dbRequest("get", [e]);
          if (subEntry === void 0) {
            subEntry = await this.dbRequest("get", [e + "/"]);
          }
          return {
            name: e.substring(path3.length + 1),
            type: subEntry.type,
            size: subEntry.size,
            ctime: subEntry.ctime,
            mtime: subEntry.mtime,
            uri: subEntry.path
          };
        }));
        return { files };
      }
      /**
       * Return full File URI for a path and directory
       * @param options the options for the stat operation
       * @return a promise that resolves with the file stat result
       */
      async getUri(options) {
        const path3 = this.getPath(options.directory, options.path);
        let entry = await this.dbRequest("get", [path3]);
        if (entry === void 0) {
          entry = await this.dbRequest("get", [path3 + "/"]);
        }
        return {
          uri: (entry === null || entry === void 0 ? void 0 : entry.path) || path3
        };
      }
      /**
       * Return data about a file
       * @param options the options for the stat operation
       * @return a promise that resolves with the file stat result
       */
      async stat(options) {
        const path3 = this.getPath(options.directory, options.path);
        let entry = await this.dbRequest("get", [path3]);
        if (entry === void 0) {
          entry = await this.dbRequest("get", [path3 + "/"]);
        }
        if (entry === void 0)
          throw Error("Entry does not exist.");
        return {
          name: entry.path.substring(path3.length + 1),
          type: entry.type,
          size: entry.size,
          ctime: entry.ctime,
          mtime: entry.mtime,
          uri: entry.path
        };
      }
      /**
       * Rename a file or directory
       * @param options the options for the rename operation
       * @return a promise that resolves with the rename result
       */
      async rename(options) {
        await this._copy(options, true);
        return;
      }
      /**
       * Copy a file or directory
       * @param options the options for the copy operation
       * @return a promise that resolves with the copy result
       */
      async copy(options) {
        return this._copy(options, false);
      }
      async requestPermissions() {
        return { publicStorage: "granted" };
      }
      async checkPermissions() {
        return { publicStorage: "granted" };
      }
      /**
       * Function that can perform a copy or a rename
       * @param options the options for the rename operation
       * @param doRename whether to perform a rename or copy operation
       * @return a promise that resolves with the result
       */
      async _copy(options, doRename = false) {
        let { toDirectory } = options;
        const { to, from, directory: fromDirectory } = options;
        if (!to || !from) {
          throw Error("Both to and from must be provided");
        }
        if (!toDirectory) {
          toDirectory = fromDirectory;
        }
        const fromPath = this.getPath(fromDirectory, from);
        const toPath = this.getPath(toDirectory, to);
        if (fromPath === toPath) {
          return {
            uri: toPath
          };
        }
        if (isPathParent(fromPath, toPath)) {
          throw Error("To path cannot contain the from path");
        }
        let toObj;
        try {
          toObj = await this.stat({
            path: to,
            directory: toDirectory
          });
        } catch (e) {
          const toPathComponents = to.split("/");
          toPathComponents.pop();
          const toPath2 = toPathComponents.join("/");
          if (toPathComponents.length > 0) {
            const toParentDirectory = await this.stat({
              path: toPath2,
              directory: toDirectory
            });
            if (toParentDirectory.type !== "directory") {
              throw new Error("Parent directory of the to path is a file");
            }
          }
        }
        if (toObj && toObj.type === "directory") {
          throw new Error("Cannot overwrite a directory with a file");
        }
        const fromObj = await this.stat({
          path: from,
          directory: fromDirectory
        });
        const updateTime = async (path3, ctime2, mtime) => {
          const fullPath = this.getPath(toDirectory, path3);
          const entry = await this.dbRequest("get", [fullPath]);
          entry.ctime = ctime2;
          entry.mtime = mtime;
          await this.dbRequest("put", [entry]);
        };
        const ctime = fromObj.ctime ? fromObj.ctime : Date.now();
        switch (fromObj.type) {
          // The "from" object is a file
          case "file": {
            const file = await this.readFile({
              path: from,
              directory: fromDirectory
            });
            if (doRename) {
              await this.deleteFile({
                path: from,
                directory: fromDirectory
              });
            }
            let encoding;
            if (!(file.data instanceof Blob) && !this.isBase64String(file.data)) {
              encoding = exports2.Encoding.UTF8;
            }
            const writeResult = await this.writeFile({
              path: to,
              directory: toDirectory,
              data: file.data,
              encoding
            });
            if (doRename) {
              await updateTime(to, ctime, fromObj.mtime);
            }
            return writeResult;
          }
          case "directory": {
            if (toObj) {
              throw Error("Cannot move a directory over an existing object");
            }
            try {
              await this.mkdir({
                path: to,
                directory: toDirectory,
                recursive: false
              });
              if (doRename) {
                await updateTime(to, ctime, fromObj.mtime);
              }
            } catch (e) {
            }
            const contents = (await this.readdir({
              path: from,
              directory: fromDirectory
            })).files;
            for (const filename of contents) {
              await this._copy({
                from: `${from}/${filename.name}`,
                to: `${to}/${filename.name}`,
                directory: fromDirectory,
                toDirectory
              }, doRename);
            }
            if (doRename) {
              await this.rmdir({
                path: from,
                directory: fromDirectory
              });
            }
          }
        }
        return {
          uri: toPath
        };
      }
      isBase64String(str2) {
        try {
          return btoa(atob(str2)) == str2;
        } catch (err) {
          return false;
        }
      }
    };
    FilesystemWeb._debug = true;
    var web = /* @__PURE__ */ Object.freeze({
      __proto__: null,
      FilesystemWeb
    });
    exports2.Filesystem = Filesystem;
    exports2.FilesystemDirectory = FilesystemDirectory;
    exports2.FilesystemEncoding = FilesystemEncoding;
  }
});

// node_modules/dexie/dist/dexie.js
var require_dexie = __commonJS({
  "node_modules/dexie/dist/dexie.js"(exports2, module2) {
    "use strict";
    (function(global2, factory) {
      typeof exports2 === "object" && typeof module2 !== "undefined" ? module2.exports = factory() : typeof define === "function" && define.amd ? define(factory) : (global2 = typeof globalThis !== "undefined" ? globalThis : global2 || self, global2.Dexie = factory());
    })(exports2, (function() {
      "use strict";
      var extendStatics = function(d, b) {
        extendStatics = Object.setPrototypeOf || { __proto__: [] } instanceof Array && function(d2, b2) {
          d2.__proto__ = b2;
        } || function(d2, b2) {
          for (var p in b2) if (Object.prototype.hasOwnProperty.call(b2, p)) d2[p] = b2[p];
        };
        return extendStatics(d, b);
      };
      function __extends(d, b) {
        if (typeof b !== "function" && b !== null)
          throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() {
          this.constructor = d;
        }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
      }
      var __assign = function() {
        __assign = Object.assign || function __assign2(t) {
          for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
          }
          return t;
        };
        return __assign.apply(this, arguments);
      };
      function __spreadArray(to, from, pack) {
        if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
          if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
          }
        }
        return to.concat(ar || Array.prototype.slice.call(from));
      }
      typeof SuppressedError === "function" ? SuppressedError : function(error, suppressed, message) {
        var e = new Error(message);
        return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
      };
      var _global = typeof globalThis !== "undefined" ? globalThis : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : global;
      var keys = Object.keys;
      var isArray = Array.isArray;
      if (typeof Promise !== "undefined" && !_global.Promise) {
        _global.Promise = Promise;
      }
      function extend3(obj, extension) {
        if (typeof extension !== "object")
          return obj;
        keys(extension).forEach(function(key) {
          obj[key] = extension[key];
        });
        return obj;
      }
      var getProto = Object.getPrototypeOf;
      var _hasOwn = {}.hasOwnProperty;
      function hasOwn(obj, prop) {
        return _hasOwn.call(obj, prop);
      }
      function props(proto, extension) {
        if (typeof extension === "function")
          extension = extension(getProto(proto));
        (typeof Reflect === "undefined" ? keys : Reflect.ownKeys)(extension).forEach(function(key) {
          setProp(proto, key, extension[key]);
        });
      }
      var defineProperty = Object.defineProperty;
      function setProp(obj, prop, functionOrGetSet, options) {
        defineProperty(obj, prop, extend3(functionOrGetSet && hasOwn(functionOrGetSet, "get") && typeof functionOrGetSet.get === "function" ? { get: functionOrGetSet.get, set: functionOrGetSet.set, configurable: true } : { value: functionOrGetSet, configurable: true, writable: true }, options));
      }
      function derive(Child) {
        return {
          from: function(Parent) {
            Child.prototype = Object.create(Parent.prototype);
            setProp(Child.prototype, "constructor", Child);
            return {
              extend: props.bind(null, Child.prototype)
            };
          }
        };
      }
      var getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
      function getPropertyDescriptor(obj, prop) {
        var pd = getOwnPropertyDescriptor(obj, prop);
        var proto;
        return pd || (proto = getProto(obj)) && getPropertyDescriptor(proto, prop);
      }
      var _slice = [].slice;
      function slice(args, start, end) {
        return _slice.call(args, start, end);
      }
      function override(origFunc, overridedFactory) {
        return overridedFactory(origFunc);
      }
      function assert(b) {
        if (!b)
          throw new Error("Assertion Failed");
      }
      function asap$1(fn) {
        if (_global.setImmediate)
          setImmediate(fn);
        else
          setTimeout(fn, 0);
      }
      function arrayToObject(array, extractor) {
        return array.reduce(function(result, item, i) {
          var nameAndValue = extractor(item, i);
          if (nameAndValue)
            result[nameAndValue[0]] = nameAndValue[1];
          return result;
        }, {});
      }
      function getByKeyPath(obj, keyPath) {
        if (typeof keyPath === "string" && hasOwn(obj, keyPath))
          return obj[keyPath];
        if (!keyPath)
          return obj;
        if (typeof keyPath !== "string") {
          var rv = [];
          for (var i = 0, l = keyPath.length; i < l; ++i) {
            var val = getByKeyPath(obj, keyPath[i]);
            rv.push(val);
          }
          return rv;
        }
        var period = keyPath.indexOf(".");
        if (period !== -1) {
          var innerObj = obj[keyPath.substr(0, period)];
          return innerObj == null ? void 0 : getByKeyPath(innerObj, keyPath.substr(period + 1));
        }
        return void 0;
      }
      function setByKeyPath(obj, keyPath, value) {
        if (!obj || keyPath === void 0)
          return;
        if ("isFrozen" in Object && Object.isFrozen(obj))
          return;
        if (typeof keyPath !== "string" && "length" in keyPath) {
          assert(typeof value !== "string" && "length" in value);
          for (var i = 0, l = keyPath.length; i < l; ++i) {
            setByKeyPath(obj, keyPath[i], value[i]);
          }
        } else {
          var period = keyPath.indexOf(".");
          if (period !== -1) {
            var currentKeyPath = keyPath.substr(0, period);
            var remainingKeyPath = keyPath.substr(period + 1);
            if (remainingKeyPath === "")
              if (value === void 0) {
                if (isArray(obj) && !isNaN(parseInt(currentKeyPath)))
                  obj.splice(currentKeyPath, 1);
                else
                  delete obj[currentKeyPath];
              } else
                obj[currentKeyPath] = value;
            else {
              var innerObj = obj[currentKeyPath];
              if (!innerObj || !hasOwn(obj, currentKeyPath))
                innerObj = obj[currentKeyPath] = {};
              setByKeyPath(innerObj, remainingKeyPath, value);
            }
          } else {
            if (value === void 0) {
              if (isArray(obj) && !isNaN(parseInt(keyPath)))
                obj.splice(keyPath, 1);
              else
                delete obj[keyPath];
            } else
              obj[keyPath] = value;
          }
        }
      }
      function delByKeyPath(obj, keyPath) {
        if (typeof keyPath === "string")
          setByKeyPath(obj, keyPath, void 0);
        else if ("length" in keyPath)
          [].map.call(keyPath, function(kp) {
            setByKeyPath(obj, kp, void 0);
          });
      }
      function shallowClone(obj) {
        var rv = {};
        for (var m in obj) {
          if (hasOwn(obj, m))
            rv[m] = obj[m];
        }
        return rv;
      }
      var concat = [].concat;
      function flatten(a) {
        return concat.apply([], a);
      }
      var intrinsicTypeNames = "BigUint64Array,BigInt64Array,Array,Boolean,String,Date,RegExp,Blob,File,FileList,FileSystemFileHandle,FileSystemDirectoryHandle,ArrayBuffer,DataView,Uint8ClampedArray,ImageBitmap,ImageData,Map,Set,CryptoKey".split(",").concat(flatten([8, 16, 32, 64].map(function(num) {
        return ["Int", "Uint", "Float"].map(function(t) {
          return t + num + "Array";
        });
      }))).filter(function(t) {
        return _global[t];
      });
      var intrinsicTypes = new Set(intrinsicTypeNames.map(function(t) {
        return _global[t];
      }));
      function cloneSimpleObjectTree(o) {
        var rv = {};
        for (var k in o)
          if (hasOwn(o, k)) {
            var v = o[k];
            rv[k] = !v || typeof v !== "object" || intrinsicTypes.has(v.constructor) ? v : cloneSimpleObjectTree(v);
          }
        return rv;
      }
      function objectIsEmpty(o) {
        for (var k in o)
          if (hasOwn(o, k))
            return false;
        return true;
      }
      var circularRefs = null;
      function deepClone(any) {
        circularRefs = /* @__PURE__ */ new WeakMap();
        var rv = innerDeepClone(any);
        circularRefs = null;
        return rv;
      }
      function innerDeepClone(x) {
        if (!x || typeof x !== "object")
          return x;
        var rv = circularRefs.get(x);
        if (rv)
          return rv;
        if (isArray(x)) {
          rv = [];
          circularRefs.set(x, rv);
          for (var i = 0, l = x.length; i < l; ++i) {
            rv.push(innerDeepClone(x[i]));
          }
        } else if (intrinsicTypes.has(x.constructor)) {
          rv = x;
        } else {
          var proto = getProto(x);
          rv = proto === Object.prototype ? {} : Object.create(proto);
          circularRefs.set(x, rv);
          for (var prop in x) {
            if (hasOwn(x, prop)) {
              rv[prop] = innerDeepClone(x[prop]);
            }
          }
        }
        return rv;
      }
      var toString2 = {}.toString;
      function toStringTag(o) {
        return toString2.call(o).slice(8, -1);
      }
      var iteratorSymbol = typeof Symbol !== "undefined" ? Symbol.iterator : "@@iterator";
      var getIteratorOf = typeof iteratorSymbol === "symbol" ? function(x) {
        var i;
        return x != null && (i = x[iteratorSymbol]) && i.apply(x);
      } : function() {
        return null;
      };
      function delArrayItem(a, x) {
        var i = a.indexOf(x);
        if (i >= 0)
          a.splice(i, 1);
        return i >= 0;
      }
      var NO_CHAR_ARRAY = {};
      function getArrayOf(arrayLike) {
        var i, a, x, it;
        if (arguments.length === 1) {
          if (isArray(arrayLike))
            return arrayLike.slice();
          if (this === NO_CHAR_ARRAY && typeof arrayLike === "string")
            return [arrayLike];
          if (it = getIteratorOf(arrayLike)) {
            a = [];
            while (x = it.next(), !x.done)
              a.push(x.value);
            return a;
          }
          if (arrayLike == null)
            return [arrayLike];
          i = arrayLike.length;
          if (typeof i === "number") {
            a = new Array(i);
            while (i--)
              a[i] = arrayLike[i];
            return a;
          }
          return [arrayLike];
        }
        i = arguments.length;
        a = new Array(i);
        while (i--)
          a[i] = arguments[i];
        return a;
      }
      var isAsyncFunction = typeof Symbol !== "undefined" ? function(fn) {
        return fn[Symbol.toStringTag] === "AsyncFunction";
      } : function() {
        return false;
      };
      var dexieErrorNames = [
        "Modify",
        "Bulk",
        "OpenFailed",
        "VersionChange",
        "Schema",
        "Upgrade",
        "InvalidTable",
        "MissingAPI",
        "NoSuchDatabase",
        "InvalidArgument",
        "SubTransaction",
        "Unsupported",
        "Internal",
        "DatabaseClosed",
        "PrematureCommit",
        "ForeignAwait"
      ];
      var idbDomErrorNames = [
        "Unknown",
        "Constraint",
        "Data",
        "TransactionInactive",
        "ReadOnly",
        "Version",
        "NotFound",
        "InvalidState",
        "InvalidAccess",
        "Abort",
        "Timeout",
        "QuotaExceeded",
        "Syntax",
        "DataClone"
      ];
      var errorList = dexieErrorNames.concat(idbDomErrorNames);
      var defaultTexts = {
        VersionChanged: "Database version changed by other database connection",
        DatabaseClosed: "Database has been closed",
        Abort: "Transaction aborted",
        TransactionInactive: "Transaction has already completed or failed",
        MissingAPI: "IndexedDB API missing. Please visit https://tinyurl.com/y2uuvskb"
      };
      function DexieError(name, msg) {
        this.name = name;
        this.message = msg;
      }
      derive(DexieError).from(Error).extend({
        toString: function() {
          return this.name + ": " + this.message;
        }
      });
      function getMultiErrorMessage(msg, failures) {
        return msg + ". Errors: " + Object.keys(failures).map(function(key) {
          return failures[key].toString();
        }).filter(function(v, i, s) {
          return s.indexOf(v) === i;
        }).join("\n");
      }
      function ModifyError(msg, failures, successCount, failedKeys) {
        this.failures = failures;
        this.failedKeys = failedKeys;
        this.successCount = successCount;
        this.message = getMultiErrorMessage(msg, failures);
      }
      derive(ModifyError).from(DexieError);
      function BulkError(msg, failures) {
        this.name = "BulkError";
        this.failures = Object.keys(failures).map(function(pos) {
          return failures[pos];
        });
        this.failuresByPos = failures;
        this.message = getMultiErrorMessage(msg, this.failures);
      }
      derive(BulkError).from(DexieError);
      var errnames = errorList.reduce(function(obj, name) {
        return obj[name] = name + "Error", obj;
      }, {});
      var BaseException = DexieError;
      var exceptions = errorList.reduce(function(obj, name) {
        var fullName = name + "Error";
        function DexieError2(msgOrInner, inner) {
          this.name = fullName;
          if (!msgOrInner) {
            this.message = defaultTexts[name] || fullName;
            this.inner = null;
          } else if (typeof msgOrInner === "string") {
            this.message = "".concat(msgOrInner).concat(!inner ? "" : "\n " + inner);
            this.inner = inner || null;
          } else if (typeof msgOrInner === "object") {
            this.message = "".concat(msgOrInner.name, " ").concat(msgOrInner.message);
            this.inner = msgOrInner;
          }
        }
        derive(DexieError2).from(BaseException);
        obj[name] = DexieError2;
        return obj;
      }, {});
      exceptions.Syntax = SyntaxError;
      exceptions.Type = TypeError;
      exceptions.Range = RangeError;
      var exceptionMap = idbDomErrorNames.reduce(function(obj, name) {
        obj[name + "Error"] = exceptions[name];
        return obj;
      }, {});
      function mapError(domError, message) {
        if (!domError || domError instanceof DexieError || domError instanceof TypeError || domError instanceof SyntaxError || !domError.name || !exceptionMap[domError.name])
          return domError;
        var rv = new exceptionMap[domError.name](message || domError.message, domError);
        if ("stack" in domError) {
          setProp(rv, "stack", { get: function() {
            return this.inner.stack;
          } });
        }
        return rv;
      }
      var fullNameExceptions = errorList.reduce(function(obj, name) {
        if (["Syntax", "Type", "Range"].indexOf(name) === -1)
          obj[name + "Error"] = exceptions[name];
        return obj;
      }, {});
      fullNameExceptions.ModifyError = ModifyError;
      fullNameExceptions.DexieError = DexieError;
      fullNameExceptions.BulkError = BulkError;
      function nop() {
      }
      function mirror(val) {
        return val;
      }
      function pureFunctionChain(f1, f2) {
        if (f1 == null || f1 === mirror)
          return f2;
        return function(val) {
          return f2(f1(val));
        };
      }
      function callBoth(on1, on2) {
        return function() {
          on1.apply(this, arguments);
          on2.apply(this, arguments);
        };
      }
      function hookCreatingChain(f1, f2) {
        if (f1 === nop)
          return f2;
        return function() {
          var res = f1.apply(this, arguments);
          if (res !== void 0)
            arguments[0] = res;
          var onsuccess = this.onsuccess, onerror = this.onerror;
          this.onsuccess = null;
          this.onerror = null;
          var res2 = f2.apply(this, arguments);
          if (onsuccess)
            this.onsuccess = this.onsuccess ? callBoth(onsuccess, this.onsuccess) : onsuccess;
          if (onerror)
            this.onerror = this.onerror ? callBoth(onerror, this.onerror) : onerror;
          return res2 !== void 0 ? res2 : res;
        };
      }
      function hookDeletingChain(f1, f2) {
        if (f1 === nop)
          return f2;
        return function() {
          f1.apply(this, arguments);
          var onsuccess = this.onsuccess, onerror = this.onerror;
          this.onsuccess = this.onerror = null;
          f2.apply(this, arguments);
          if (onsuccess)
            this.onsuccess = this.onsuccess ? callBoth(onsuccess, this.onsuccess) : onsuccess;
          if (onerror)
            this.onerror = this.onerror ? callBoth(onerror, this.onerror) : onerror;
        };
      }
      function hookUpdatingChain(f1, f2) {
        if (f1 === nop)
          return f2;
        return function(modifications) {
          var res = f1.apply(this, arguments);
          extend3(modifications, res);
          var onsuccess = this.onsuccess, onerror = this.onerror;
          this.onsuccess = null;
          this.onerror = null;
          var res2 = f2.apply(this, arguments);
          if (onsuccess)
            this.onsuccess = this.onsuccess ? callBoth(onsuccess, this.onsuccess) : onsuccess;
          if (onerror)
            this.onerror = this.onerror ? callBoth(onerror, this.onerror) : onerror;
          return res === void 0 ? res2 === void 0 ? void 0 : res2 : extend3(res, res2);
        };
      }
      function reverseStoppableEventChain(f1, f2) {
        if (f1 === nop)
          return f2;
        return function() {
          if (f2.apply(this, arguments) === false)
            return false;
          return f1.apply(this, arguments);
        };
      }
      function promisableChain(f1, f2) {
        if (f1 === nop)
          return f2;
        return function() {
          var res = f1.apply(this, arguments);
          if (res && typeof res.then === "function") {
            var thiz = this, i = arguments.length, args = new Array(i);
            while (i--)
              args[i] = arguments[i];
            return res.then(function() {
              return f2.apply(thiz, args);
            });
          }
          return f2.apply(this, arguments);
        };
      }
      var debug = typeof location !== "undefined" && /^(http|https):\/\/(localhost|127\.0\.0\.1)/.test(location.href);
      function setDebug(value, filter) {
        debug = value;
      }
      var INTERNAL = {};
      var ZONE_ECHO_LIMIT = 100, _a$1 = typeof Promise === "undefined" ? [] : (function() {
        var globalP = Promise.resolve();
        if (typeof crypto === "undefined" || !crypto.subtle)
          return [globalP, getProto(globalP), globalP];
        var nativeP = crypto.subtle.digest("SHA-512", new Uint8Array([0]));
        return [
          nativeP,
          getProto(nativeP),
          globalP
        ];
      })(), resolvedNativePromise = _a$1[0], nativePromiseProto = _a$1[1], resolvedGlobalPromise = _a$1[2], nativePromiseThen = nativePromiseProto && nativePromiseProto.then;
      var NativePromise = resolvedNativePromise && resolvedNativePromise.constructor;
      var patchGlobalPromise = !!resolvedGlobalPromise;
      function schedulePhysicalTick() {
        queueMicrotask(physicalTick);
      }
      var asap = function(callback, args) {
        microtickQueue.push([callback, args]);
        if (needsNewPhysicalTick) {
          schedulePhysicalTick();
          needsNewPhysicalTick = false;
        }
      };
      var isOutsideMicroTick = true, needsNewPhysicalTick = true, unhandledErrors = [], rejectingErrors = [], rejectionMapper = mirror;
      var globalPSD = {
        id: "global",
        global: true,
        ref: 0,
        unhandleds: [],
        onunhandled: nop,
        pgp: false,
        env: {},
        finalize: nop
      };
      var PSD = globalPSD;
      var microtickQueue = [];
      var numScheduledCalls = 0;
      var tickFinalizers = [];
      function DexiePromise(fn) {
        if (typeof this !== "object")
          throw new TypeError("Promises must be constructed via new");
        this._listeners = [];
        this._lib = false;
        var psd = this._PSD = PSD;
        if (typeof fn !== "function") {
          if (fn !== INTERNAL)
            throw new TypeError("Not a function");
          this._state = arguments[1];
          this._value = arguments[2];
          if (this._state === false)
            handleRejection(this, this._value);
          return;
        }
        this._state = null;
        this._value = null;
        ++psd.ref;
        executePromiseTask(this, fn);
      }
      var thenProp = {
        get: function() {
          var psd = PSD, microTaskId = totalEchoes;
          function then(onFulfilled, onRejected) {
            var _this = this;
            var possibleAwait = !psd.global && (psd !== PSD || microTaskId !== totalEchoes);
            var cleanup = possibleAwait && !decrementExpectedAwaits();
            var rv = new DexiePromise(function(resolve2, reject) {
              propagateToListener(_this, new Listener(nativeAwaitCompatibleWrap(onFulfilled, psd, possibleAwait, cleanup), nativeAwaitCompatibleWrap(onRejected, psd, possibleAwait, cleanup), resolve2, reject, psd));
            });
            if (this._consoleTask)
              rv._consoleTask = this._consoleTask;
            return rv;
          }
          then.prototype = INTERNAL;
          return then;
        },
        set: function(value) {
          setProp(this, "then", value && value.prototype === INTERNAL ? thenProp : {
            get: function() {
              return value;
            },
            set: thenProp.set
          });
        }
      };
      props(DexiePromise.prototype, {
        then: thenProp,
        _then: function(onFulfilled, onRejected) {
          propagateToListener(this, new Listener(null, null, onFulfilled, onRejected, PSD));
        },
        catch: function(onRejected) {
          if (arguments.length === 1)
            return this.then(null, onRejected);
          var type3 = arguments[0], handler = arguments[1];
          return typeof type3 === "function" ? this.then(null, function(err) {
            return err instanceof type3 ? handler(err) : PromiseReject(err);
          }) : this.then(null, function(err) {
            return err && err.name === type3 ? handler(err) : PromiseReject(err);
          });
        },
        finally: function(onFinally) {
          return this.then(function(value) {
            return DexiePromise.resolve(onFinally()).then(function() {
              return value;
            });
          }, function(err) {
            return DexiePromise.resolve(onFinally()).then(function() {
              return PromiseReject(err);
            });
          });
        },
        timeout: function(ms, msg) {
          var _this = this;
          return ms < Infinity ? new DexiePromise(function(resolve2, reject) {
            var handle = setTimeout(function() {
              return reject(new exceptions.Timeout(msg));
            }, ms);
            _this.then(resolve2, reject).finally(clearTimeout.bind(null, handle));
          }) : this;
        }
      });
      if (typeof Symbol !== "undefined" && Symbol.toStringTag)
        setProp(DexiePromise.prototype, Symbol.toStringTag, "Dexie.Promise");
      globalPSD.env = snapShot();
      function Listener(onFulfilled, onRejected, resolve2, reject, zone) {
        this.onFulfilled = typeof onFulfilled === "function" ? onFulfilled : null;
        this.onRejected = typeof onRejected === "function" ? onRejected : null;
        this.resolve = resolve2;
        this.reject = reject;
        this.psd = zone;
      }
      props(DexiePromise, {
        all: function() {
          var values = getArrayOf.apply(null, arguments).map(onPossibleParallellAsync);
          return new DexiePromise(function(resolve2, reject) {
            if (values.length === 0)
              resolve2([]);
            var remaining = values.length;
            values.forEach(function(a, i) {
              return DexiePromise.resolve(a).then(function(x) {
                values[i] = x;
                if (!--remaining)
                  resolve2(values);
              }, reject);
            });
          });
        },
        resolve: function(value) {
          if (value instanceof DexiePromise)
            return value;
          if (value && typeof value.then === "function")
            return new DexiePromise(function(resolve2, reject) {
              value.then(resolve2, reject);
            });
          var rv = new DexiePromise(INTERNAL, true, value);
          return rv;
        },
        reject: PromiseReject,
        race: function() {
          var values = getArrayOf.apply(null, arguments).map(onPossibleParallellAsync);
          return new DexiePromise(function(resolve2, reject) {
            values.map(function(value) {
              return DexiePromise.resolve(value).then(resolve2, reject);
            });
          });
        },
        PSD: {
          get: function() {
            return PSD;
          },
          set: function(value) {
            return PSD = value;
          }
        },
        totalEchoes: { get: function() {
          return totalEchoes;
        } },
        newPSD: newScope,
        usePSD,
        scheduler: {
          get: function() {
            return asap;
          },
          set: function(value) {
            asap = value;
          }
        },
        rejectionMapper: {
          get: function() {
            return rejectionMapper;
          },
          set: function(value) {
            rejectionMapper = value;
          }
        },
        follow: function(fn, zoneProps) {
          return new DexiePromise(function(resolve2, reject) {
            return newScope(function(resolve3, reject2) {
              var psd = PSD;
              psd.unhandleds = [];
              psd.onunhandled = reject2;
              psd.finalize = callBoth(function() {
                var _this = this;
                run_at_end_of_this_or_next_physical_tick(function() {
                  _this.unhandleds.length === 0 ? resolve3() : reject2(_this.unhandleds[0]);
                });
              }, psd.finalize);
              fn();
            }, zoneProps, resolve2, reject);
          });
        }
      });
      if (NativePromise) {
        if (NativePromise.allSettled)
          setProp(DexiePromise, "allSettled", function() {
            var possiblePromises = getArrayOf.apply(null, arguments).map(onPossibleParallellAsync);
            return new DexiePromise(function(resolve2) {
              if (possiblePromises.length === 0)
                resolve2([]);
              var remaining = possiblePromises.length;
              var results = new Array(remaining);
              possiblePromises.forEach(function(p, i) {
                return DexiePromise.resolve(p).then(function(value) {
                  return results[i] = { status: "fulfilled", value };
                }, function(reason) {
                  return results[i] = { status: "rejected", reason };
                }).then(function() {
                  return --remaining || resolve2(results);
                });
              });
            });
          });
        if (NativePromise.any && typeof AggregateError !== "undefined")
          setProp(DexiePromise, "any", function() {
            var possiblePromises = getArrayOf.apply(null, arguments).map(onPossibleParallellAsync);
            return new DexiePromise(function(resolve2, reject) {
              if (possiblePromises.length === 0)
                reject(new AggregateError([]));
              var remaining = possiblePromises.length;
              var failures = new Array(remaining);
              possiblePromises.forEach(function(p, i) {
                return DexiePromise.resolve(p).then(function(value) {
                  return resolve2(value);
                }, function(failure) {
                  failures[i] = failure;
                  if (!--remaining)
                    reject(new AggregateError(failures));
                });
              });
            });
          });
        if (NativePromise.withResolvers)
          DexiePromise.withResolvers = NativePromise.withResolvers;
      }
      function executePromiseTask(promise, fn) {
        try {
          fn(function(value) {
            if (promise._state !== null)
              return;
            if (value === promise)
              throw new TypeError("A promise cannot be resolved with itself.");
            var shouldExecuteTick = promise._lib && beginMicroTickScope();
            if (value && typeof value.then === "function") {
              executePromiseTask(promise, function(resolve2, reject) {
                value instanceof DexiePromise ? value._then(resolve2, reject) : value.then(resolve2, reject);
              });
            } else {
              promise._state = true;
              promise._value = value;
              propagateAllListeners(promise);
            }
            if (shouldExecuteTick)
              endMicroTickScope();
          }, handleRejection.bind(null, promise));
        } catch (ex) {
          handleRejection(promise, ex);
        }
      }
      function handleRejection(promise, reason) {
        rejectingErrors.push(reason);
        if (promise._state !== null)
          return;
        var shouldExecuteTick = promise._lib && beginMicroTickScope();
        reason = rejectionMapper(reason);
        promise._state = false;
        promise._value = reason;
        addPossiblyUnhandledError(promise);
        propagateAllListeners(promise);
        if (shouldExecuteTick)
          endMicroTickScope();
      }
      function propagateAllListeners(promise) {
        var listeners = promise._listeners;
        promise._listeners = [];
        for (var i = 0, len = listeners.length; i < len; ++i) {
          propagateToListener(promise, listeners[i]);
        }
        var psd = promise._PSD;
        --psd.ref || psd.finalize();
        if (numScheduledCalls === 0) {
          ++numScheduledCalls;
          asap(function() {
            if (--numScheduledCalls === 0)
              finalizePhysicalTick();
          }, []);
        }
      }
      function propagateToListener(promise, listener) {
        if (promise._state === null) {
          promise._listeners.push(listener);
          return;
        }
        var cb = promise._state ? listener.onFulfilled : listener.onRejected;
        if (cb === null) {
          return (promise._state ? listener.resolve : listener.reject)(promise._value);
        }
        ++listener.psd.ref;
        ++numScheduledCalls;
        asap(callListener, [cb, promise, listener]);
      }
      function callListener(cb, promise, listener) {
        try {
          var ret, value = promise._value;
          if (!promise._state && rejectingErrors.length)
            rejectingErrors = [];
          ret = debug && promise._consoleTask ? promise._consoleTask.run(function() {
            return cb(value);
          }) : cb(value);
          if (!promise._state && rejectingErrors.indexOf(value) === -1) {
            markErrorAsHandled(promise);
          }
          listener.resolve(ret);
        } catch (e) {
          listener.reject(e);
        } finally {
          if (--numScheduledCalls === 0)
            finalizePhysicalTick();
          --listener.psd.ref || listener.psd.finalize();
        }
      }
      function physicalTick() {
        usePSD(globalPSD, function() {
          beginMicroTickScope() && endMicroTickScope();
        });
      }
      function beginMicroTickScope() {
        var wasRootExec = isOutsideMicroTick;
        isOutsideMicroTick = false;
        needsNewPhysicalTick = false;
        return wasRootExec;
      }
      function endMicroTickScope() {
        var callbacks, i, l;
        do {
          while (microtickQueue.length > 0) {
            callbacks = microtickQueue;
            microtickQueue = [];
            l = callbacks.length;
            for (i = 0; i < l; ++i) {
              var item = callbacks[i];
              item[0].apply(null, item[1]);
            }
          }
        } while (microtickQueue.length > 0);
        isOutsideMicroTick = true;
        needsNewPhysicalTick = true;
      }
      function finalizePhysicalTick() {
        var unhandledErrs = unhandledErrors;
        unhandledErrors = [];
        unhandledErrs.forEach(function(p) {
          p._PSD.onunhandled.call(null, p._value, p);
        });
        var finalizers = tickFinalizers.slice(0);
        var i = finalizers.length;
        while (i)
          finalizers[--i]();
      }
      function run_at_end_of_this_or_next_physical_tick(fn) {
        function finalizer() {
          fn();
          tickFinalizers.splice(tickFinalizers.indexOf(finalizer), 1);
        }
        tickFinalizers.push(finalizer);
        ++numScheduledCalls;
        asap(function() {
          if (--numScheduledCalls === 0)
            finalizePhysicalTick();
        }, []);
      }
      function addPossiblyUnhandledError(promise) {
        if (!unhandledErrors.some(function(p) {
          return p._value === promise._value;
        }))
          unhandledErrors.push(promise);
      }
      function markErrorAsHandled(promise) {
        var i = unhandledErrors.length;
        while (i)
          if (unhandledErrors[--i]._value === promise._value) {
            unhandledErrors.splice(i, 1);
            return;
          }
      }
      function PromiseReject(reason) {
        return new DexiePromise(INTERNAL, false, reason);
      }
      function wrap(fn, errorCatcher) {
        var psd = PSD;
        return function() {
          var wasRootExec = beginMicroTickScope(), outerScope = PSD;
          try {
            switchToZone(psd, true);
            return fn.apply(this, arguments);
          } catch (e) {
            errorCatcher && errorCatcher(e);
          } finally {
            switchToZone(outerScope, false);
            if (wasRootExec)
              endMicroTickScope();
          }
        };
      }
      var task = { awaits: 0, echoes: 0, id: 0 };
      var taskCounter = 0;
      var zoneStack = [];
      var zoneEchoes = 0;
      var totalEchoes = 0;
      var zone_id_counter = 0;
      function newScope(fn, props2, a1, a2) {
        var parent = PSD, psd = Object.create(parent);
        psd.parent = parent;
        psd.ref = 0;
        psd.global = false;
        psd.id = ++zone_id_counter;
        globalPSD.env;
        psd.env = patchGlobalPromise ? {
          Promise: DexiePromise,
          PromiseProp: { value: DexiePromise, configurable: true, writable: true },
          all: DexiePromise.all,
          race: DexiePromise.race,
          allSettled: DexiePromise.allSettled,
          any: DexiePromise.any,
          resolve: DexiePromise.resolve,
          reject: DexiePromise.reject
        } : {};
        if (props2)
          extend3(psd, props2);
        ++parent.ref;
        psd.finalize = function() {
          --this.parent.ref || this.parent.finalize();
        };
        var rv = usePSD(psd, fn, a1, a2);
        if (psd.ref === 0)
          psd.finalize();
        return rv;
      }
      function incrementExpectedAwaits() {
        if (!task.id)
          task.id = ++taskCounter;
        ++task.awaits;
        task.echoes += ZONE_ECHO_LIMIT;
        return task.id;
      }
      function decrementExpectedAwaits() {
        if (!task.awaits)
          return false;
        if (--task.awaits === 0)
          task.id = 0;
        task.echoes = task.awaits * ZONE_ECHO_LIMIT;
        return true;
      }
      if (("" + nativePromiseThen).indexOf("[native code]") === -1) {
        incrementExpectedAwaits = decrementExpectedAwaits = nop;
      }
      function onPossibleParallellAsync(possiblePromise) {
        if (task.echoes && possiblePromise && possiblePromise.constructor === NativePromise) {
          incrementExpectedAwaits();
          return possiblePromise.then(function(x) {
            decrementExpectedAwaits();
            return x;
          }, function(e) {
            decrementExpectedAwaits();
            return rejection(e);
          });
        }
        return possiblePromise;
      }
      function zoneEnterEcho(targetZone) {
        ++totalEchoes;
        if (!task.echoes || --task.echoes === 0) {
          task.echoes = task.awaits = task.id = 0;
        }
        zoneStack.push(PSD);
        switchToZone(targetZone, true);
      }
      function zoneLeaveEcho() {
        var zone = zoneStack[zoneStack.length - 1];
        zoneStack.pop();
        switchToZone(zone, false);
      }
      function switchToZone(targetZone, bEnteringZone) {
        var currentZone = PSD;
        if (bEnteringZone ? task.echoes && (!zoneEchoes++ || targetZone !== PSD) : zoneEchoes && (!--zoneEchoes || targetZone !== PSD)) {
          queueMicrotask(bEnteringZone ? zoneEnterEcho.bind(null, targetZone) : zoneLeaveEcho);
        }
        if (targetZone === PSD)
          return;
        PSD = targetZone;
        if (currentZone === globalPSD)
          globalPSD.env = snapShot();
        if (patchGlobalPromise) {
          var GlobalPromise = globalPSD.env.Promise;
          var targetEnv = targetZone.env;
          if (currentZone.global || targetZone.global) {
            Object.defineProperty(_global, "Promise", targetEnv.PromiseProp);
            GlobalPromise.all = targetEnv.all;
            GlobalPromise.race = targetEnv.race;
            GlobalPromise.resolve = targetEnv.resolve;
            GlobalPromise.reject = targetEnv.reject;
            if (targetEnv.allSettled)
              GlobalPromise.allSettled = targetEnv.allSettled;
            if (targetEnv.any)
              GlobalPromise.any = targetEnv.any;
          }
        }
      }
      function snapShot() {
        var GlobalPromise = _global.Promise;
        return patchGlobalPromise ? {
          Promise: GlobalPromise,
          PromiseProp: Object.getOwnPropertyDescriptor(_global, "Promise"),
          all: GlobalPromise.all,
          race: GlobalPromise.race,
          allSettled: GlobalPromise.allSettled,
          any: GlobalPromise.any,
          resolve: GlobalPromise.resolve,
          reject: GlobalPromise.reject
        } : {};
      }
      function usePSD(psd, fn, a1, a2, a3) {
        var outerScope = PSD;
        try {
          switchToZone(psd, true);
          return fn(a1, a2, a3);
        } finally {
          switchToZone(outerScope, false);
        }
      }
      function nativeAwaitCompatibleWrap(fn, zone, possibleAwait, cleanup) {
        return typeof fn !== "function" ? fn : function() {
          var outerZone = PSD;
          if (possibleAwait)
            incrementExpectedAwaits();
          switchToZone(zone, true);
          try {
            return fn.apply(this, arguments);
          } finally {
            switchToZone(outerZone, false);
            if (cleanup)
              queueMicrotask(decrementExpectedAwaits);
          }
        };
      }
      function execInGlobalContext(cb) {
        if (Promise === NativePromise && task.echoes === 0) {
          if (zoneEchoes === 0) {
            cb();
          } else {
            enqueueNativeMicroTask(cb);
          }
        } else {
          setTimeout(cb, 0);
        }
      }
      var rejection = DexiePromise.reject;
      function tempTransaction(db, mode, storeNames, fn) {
        if (!db.idbdb || !db._state.openComplete && (!PSD.letThrough && !db._vip)) {
          if (db._state.openComplete) {
            return rejection(new exceptions.DatabaseClosed(db._state.dbOpenError));
          }
          if (!db._state.isBeingOpened) {
            if (!db._state.autoOpen)
              return rejection(new exceptions.DatabaseClosed());
            db.open().catch(nop);
          }
          return db._state.dbReadyPromise.then(function() {
            return tempTransaction(db, mode, storeNames, fn);
          });
        } else {
          var trans = db._createTransaction(mode, storeNames, db._dbSchema);
          try {
            trans.create();
            db._state.PR1398_maxLoop = 3;
          } catch (ex) {
            if (ex.name === errnames.InvalidState && db.isOpen() && --db._state.PR1398_maxLoop > 0) {
              console.warn("Dexie: Need to reopen db");
              db.close({ disableAutoOpen: false });
              return db.open().then(function() {
                return tempTransaction(db, mode, storeNames, fn);
              });
            }
            return rejection(ex);
          }
          return trans._promise(mode, function(resolve2, reject) {
            return newScope(function() {
              PSD.trans = trans;
              return fn(resolve2, reject, trans);
            });
          }).then(function(result) {
            if (mode === "readwrite")
              try {
                trans.idbtrans.commit();
              } catch (_a2) {
              }
            return mode === "readonly" ? result : trans._completion.then(function() {
              return result;
            });
          });
        }
      }
      var DEXIE_VERSION = "4.3.0";
      var maxString = String.fromCharCode(65535);
      var minKey = -Infinity;
      var INVALID_KEY_ARGUMENT = "Invalid key provided. Keys must be of type string, number, Date or Array<string | number | Date>.";
      var STRING_EXPECTED = "String expected.";
      var connections = [];
      var DBNAMES_DB = "__dbnames";
      var READONLY = "readonly";
      var READWRITE = "readwrite";
      function combine(filter1, filter2) {
        return filter1 ? filter2 ? function() {
          return filter1.apply(this, arguments) && filter2.apply(this, arguments);
        } : filter1 : filter2;
      }
      var AnyRange = {
        type: 3,
        lower: -Infinity,
        lowerOpen: false,
        upper: [[]],
        upperOpen: false
      };
      function workaroundForUndefinedPrimKey(keyPath) {
        return typeof keyPath === "string" && !/\./.test(keyPath) ? function(obj) {
          if (obj[keyPath] === void 0 && keyPath in obj) {
            obj = deepClone(obj);
            delete obj[keyPath];
          }
          return obj;
        } : function(obj) {
          return obj;
        };
      }
      function Entity2() {
        throw exceptions.Type("Entity instances must never be new:ed. Instances are generated by the framework bypassing the constructor.");
      }
      function cmp3(a, b) {
        try {
          var ta = type2(a);
          var tb = type2(b);
          if (ta !== tb) {
            if (ta === "Array")
              return 1;
            if (tb === "Array")
              return -1;
            if (ta === "binary")
              return 1;
            if (tb === "binary")
              return -1;
            if (ta === "string")
              return 1;
            if (tb === "string")
              return -1;
            if (ta === "Date")
              return 1;
            if (tb !== "Date")
              return NaN;
            return -1;
          }
          switch (ta) {
            case "number":
            case "Date":
            case "string":
              return a > b ? 1 : a < b ? -1 : 0;
            case "binary": {
              return compareUint8Arrays(getUint8Array(a), getUint8Array(b));
            }
            case "Array":
              return compareArrays(a, b);
          }
        } catch (_a2) {
        }
        return NaN;
      }
      function compareArrays(a, b) {
        var al = a.length;
        var bl = b.length;
        var l = al < bl ? al : bl;
        for (var i = 0; i < l; ++i) {
          var res = cmp3(a[i], b[i]);
          if (res !== 0)
            return res;
        }
        return al === bl ? 0 : al < bl ? -1 : 1;
      }
      function compareUint8Arrays(a, b) {
        var al = a.length;
        var bl = b.length;
        var l = al < bl ? al : bl;
        for (var i = 0; i < l; ++i) {
          if (a[i] !== b[i])
            return a[i] < b[i] ? -1 : 1;
        }
        return al === bl ? 0 : al < bl ? -1 : 1;
      }
      function type2(x) {
        var t = typeof x;
        if (t !== "object")
          return t;
        if (ArrayBuffer.isView(x))
          return "binary";
        var tsTag = toStringTag(x);
        return tsTag === "ArrayBuffer" ? "binary" : tsTag;
      }
      function getUint8Array(a) {
        if (a instanceof Uint8Array)
          return a;
        if (ArrayBuffer.isView(a))
          return new Uint8Array(a.buffer, a.byteOffset, a.byteLength);
        return new Uint8Array(a);
      }
      function builtInDeletionTrigger(table, keys2, res) {
        var yProps = table.schema.yProps;
        if (!yProps)
          return res;
        if (keys2 && res.numFailures > 0)
          keys2 = keys2.filter(function(_, i) {
            return !res.failures[i];
          });
        return Promise.all(yProps.map(function(_a2) {
          var updatesTable = _a2.updatesTable;
          return keys2 ? table.db.table(updatesTable).where("k").anyOf(keys2).delete() : table.db.table(updatesTable).clear();
        })).then(function() {
          return res;
        });
      }
      var PropModification2 = (function() {
        function PropModification3(spec) {
          this["@@propmod"] = spec;
        }
        PropModification3.prototype.execute = function(value) {
          var _a2;
          var spec = this["@@propmod"];
          if (spec.add !== void 0) {
            var term = spec.add;
            if (isArray(term)) {
              return __spreadArray(__spreadArray([], isArray(value) ? value : [], true), term, true).sort();
            }
            if (typeof term === "number")
              return (Number(value) || 0) + term;
            if (typeof term === "bigint") {
              try {
                return BigInt(value) + term;
              } catch (_b) {
                return BigInt(0) + term;
              }
            }
            throw new TypeError("Invalid term ".concat(term));
          }
          if (spec.remove !== void 0) {
            var subtrahend_1 = spec.remove;
            if (isArray(subtrahend_1)) {
              return isArray(value) ? value.filter(function(item) {
                return !subtrahend_1.includes(item);
              }).sort() : [];
            }
            if (typeof subtrahend_1 === "number")
              return Number(value) - subtrahend_1;
            if (typeof subtrahend_1 === "bigint") {
              try {
                return BigInt(value) - subtrahend_1;
              } catch (_c) {
                return BigInt(0) - subtrahend_1;
              }
            }
            throw new TypeError("Invalid subtrahend ".concat(subtrahend_1));
          }
          var prefixToReplace = (_a2 = spec.replacePrefix) === null || _a2 === void 0 ? void 0 : _a2[0];
          if (prefixToReplace && typeof value === "string" && value.startsWith(prefixToReplace)) {
            return spec.replacePrefix[1] + value.substring(prefixToReplace.length);
          }
          return value;
        };
        return PropModification3;
      })();
      function applyUpdateSpec(obj, changes) {
        var keyPaths = keys(changes);
        var numKeys = keyPaths.length;
        var anythingModified = false;
        for (var i = 0; i < numKeys; ++i) {
          var keyPath = keyPaths[i];
          var value = changes[keyPath];
          var origValue = getByKeyPath(obj, keyPath);
          if (value instanceof PropModification2) {
            setByKeyPath(obj, keyPath, value.execute(origValue));
            anythingModified = true;
          } else if (origValue !== value) {
            setByKeyPath(obj, keyPath, value);
            anythingModified = true;
          }
        }
        return anythingModified;
      }
      var Table = (function() {
        function Table2() {
        }
        Table2.prototype._trans = function(mode, fn, writeLocked) {
          var trans = this._tx || PSD.trans;
          var tableName = this.name;
          var task2 = debug && typeof console !== "undefined" && console.createTask && console.createTask("Dexie: ".concat(mode === "readonly" ? "read" : "write", " ").concat(this.name));
          function checkTableInTransaction(resolve2, reject, trans2) {
            if (!trans2.schema[tableName])
              throw new exceptions.NotFound("Table " + tableName + " not part of transaction");
            return fn(trans2.idbtrans, trans2);
          }
          var wasRootExec = beginMicroTickScope();
          try {
            var p = trans && trans.db._novip === this.db._novip ? trans === PSD.trans ? trans._promise(mode, checkTableInTransaction, writeLocked) : newScope(function() {
              return trans._promise(mode, checkTableInTransaction, writeLocked);
            }, { trans, transless: PSD.transless || PSD }) : tempTransaction(this.db, mode, [this.name], checkTableInTransaction);
            if (task2) {
              p._consoleTask = task2;
              p = p.catch(function(err) {
                console.trace(err);
                return rejection(err);
              });
            }
            return p;
          } finally {
            if (wasRootExec)
              endMicroTickScope();
          }
        };
        Table2.prototype.get = function(keyOrCrit, cb) {
          var _this = this;
          if (keyOrCrit && keyOrCrit.constructor === Object)
            return this.where(keyOrCrit).first(cb);
          if (keyOrCrit == null)
            return rejection(new exceptions.Type("Invalid argument to Table.get()"));
          return this._trans("readonly", function(trans) {
            return _this.core.get({ trans, key: keyOrCrit }).then(function(res) {
              return _this.hook.reading.fire(res);
            });
          }).then(cb);
        };
        Table2.prototype.where = function(indexOrCrit) {
          if (typeof indexOrCrit === "string")
            return new this.db.WhereClause(this, indexOrCrit);
          if (isArray(indexOrCrit))
            return new this.db.WhereClause(this, "[".concat(indexOrCrit.join("+"), "]"));
          var keyPaths = keys(indexOrCrit);
          if (keyPaths.length === 1)
            return this.where(keyPaths[0]).equals(indexOrCrit[keyPaths[0]]);
          var compoundIndex = this.schema.indexes.concat(this.schema.primKey).filter(function(ix) {
            if (ix.compound && keyPaths.every(function(keyPath) {
              return ix.keyPath.indexOf(keyPath) >= 0;
            })) {
              for (var i = 0; i < keyPaths.length; ++i) {
                if (keyPaths.indexOf(ix.keyPath[i]) === -1)
                  return false;
              }
              return true;
            }
            return false;
          }).sort(function(a, b) {
            return a.keyPath.length - b.keyPath.length;
          })[0];
          if (compoundIndex && this.db._maxKey !== maxString) {
            var keyPathsInValidOrder = compoundIndex.keyPath.slice(0, keyPaths.length);
            return this.where(keyPathsInValidOrder).equals(keyPathsInValidOrder.map(function(kp) {
              return indexOrCrit[kp];
            }));
          }
          if (!compoundIndex && debug)
            console.warn("The query ".concat(JSON.stringify(indexOrCrit), " on ").concat(this.name, " would benefit from a ") + "compound index [".concat(keyPaths.join("+"), "]"));
          var idxByName = this.schema.idxByName;
          function equals(a, b) {
            return cmp3(a, b) === 0;
          }
          var _a2 = keyPaths.reduce(function(_a3, keyPath) {
            var prevIndex = _a3[0], prevFilterFn = _a3[1];
            var index = idxByName[keyPath];
            var value = indexOrCrit[keyPath];
            return [
              prevIndex || index,
              prevIndex || !index ? combine(prevFilterFn, index && index.multi ? function(x) {
                var prop = getByKeyPath(x, keyPath);
                return isArray(prop) && prop.some(function(item) {
                  return equals(value, item);
                });
              } : function(x) {
                return equals(value, getByKeyPath(x, keyPath));
              }) : prevFilterFn
            ];
          }, [null, null]), idx = _a2[0], filterFunction = _a2[1];
          return idx ? this.where(idx.name).equals(indexOrCrit[idx.keyPath]).filter(filterFunction) : compoundIndex ? this.filter(filterFunction) : this.where(keyPaths).equals("");
        };
        Table2.prototype.filter = function(filterFunction) {
          return this.toCollection().and(filterFunction);
        };
        Table2.prototype.count = function(thenShortcut) {
          return this.toCollection().count(thenShortcut);
        };
        Table2.prototype.offset = function(offset) {
          return this.toCollection().offset(offset);
        };
        Table2.prototype.limit = function(numRows) {
          return this.toCollection().limit(numRows);
        };
        Table2.prototype.each = function(callback) {
          return this.toCollection().each(callback);
        };
        Table2.prototype.toArray = function(thenShortcut) {
          return this.toCollection().toArray(thenShortcut);
        };
        Table2.prototype.toCollection = function() {
          return new this.db.Collection(new this.db.WhereClause(this));
        };
        Table2.prototype.orderBy = function(index) {
          return new this.db.Collection(new this.db.WhereClause(this, isArray(index) ? "[".concat(index.join("+"), "]") : index));
        };
        Table2.prototype.reverse = function() {
          return this.toCollection().reverse();
        };
        Table2.prototype.mapToClass = function(constructor) {
          var _a2 = this, db = _a2.db, tableName = _a2.name;
          this.schema.mappedClass = constructor;
          if (constructor.prototype instanceof Entity2) {
            constructor = (function(_super) {
              __extends(class_1, _super);
              function class_1() {
                return _super !== null && _super.apply(this, arguments) || this;
              }
              Object.defineProperty(class_1.prototype, "db", {
                get: function() {
                  return db;
                },
                enumerable: false,
                configurable: true
              });
              class_1.prototype.table = function() {
                return tableName;
              };
              return class_1;
            })(constructor);
          }
          var inheritedProps = /* @__PURE__ */ new Set();
          for (var proto = constructor.prototype; proto; proto = getProto(proto)) {
            Object.getOwnPropertyNames(proto).forEach(function(propName) {
              return inheritedProps.add(propName);
            });
          }
          var readHook = function(obj) {
            if (!obj)
              return obj;
            var res = Object.create(constructor.prototype);
            for (var m in obj)
              if (!inheritedProps.has(m))
                try {
                  res[m] = obj[m];
                } catch (_) {
                }
            return res;
          };
          if (this.schema.readHook) {
            this.hook.reading.unsubscribe(this.schema.readHook);
          }
          this.schema.readHook = readHook;
          this.hook("reading", readHook);
          return constructor;
        };
        Table2.prototype.defineClass = function() {
          function Class(content) {
            extend3(this, content);
          }
          return this.mapToClass(Class);
        };
        Table2.prototype.add = function(obj, key) {
          var _this = this;
          var _a2 = this.schema.primKey, auto = _a2.auto, keyPath = _a2.keyPath;
          var objToAdd = obj;
          if (keyPath && auto) {
            objToAdd = workaroundForUndefinedPrimKey(keyPath)(obj);
          }
          return this._trans("readwrite", function(trans) {
            return _this.core.mutate({ trans, type: "add", keys: key != null ? [key] : null, values: [objToAdd] });
          }).then(function(res) {
            return res.numFailures ? DexiePromise.reject(res.failures[0]) : res.lastResult;
          }).then(function(lastResult) {
            if (keyPath) {
              try {
                setByKeyPath(obj, keyPath, lastResult);
              } catch (_) {
              }
            }
            return lastResult;
          });
        };
        Table2.prototype.upsert = function(key, modifications) {
          var _this = this;
          var keyPath = this.schema.primKey.keyPath;
          return this._trans("readwrite", function(trans) {
            return _this.core.get({ trans, key }).then(function(existing) {
              var obj = existing !== null && existing !== void 0 ? existing : {};
              applyUpdateSpec(obj, modifications);
              if (keyPath)
                setByKeyPath(obj, keyPath, key);
              return _this.core.mutate({
                trans,
                type: "put",
                values: [obj],
                keys: [key],
                upsert: true,
                updates: { keys: [key], changeSpecs: [modifications] }
              }).then(function(res) {
                return res.numFailures ? DexiePromise.reject(res.failures[0]) : !!existing;
              });
            });
          });
        };
        Table2.prototype.update = function(keyOrObject, modifications) {
          if (typeof keyOrObject === "object" && !isArray(keyOrObject)) {
            var key = getByKeyPath(keyOrObject, this.schema.primKey.keyPath);
            if (key === void 0)
              return rejection(new exceptions.InvalidArgument("Given object does not contain its primary key"));
            return this.where(":id").equals(key).modify(modifications);
          } else {
            return this.where(":id").equals(keyOrObject).modify(modifications);
          }
        };
        Table2.prototype.put = function(obj, key) {
          var _this = this;
          var _a2 = this.schema.primKey, auto = _a2.auto, keyPath = _a2.keyPath;
          var objToAdd = obj;
          if (keyPath && auto) {
            objToAdd = workaroundForUndefinedPrimKey(keyPath)(obj);
          }
          return this._trans("readwrite", function(trans) {
            return _this.core.mutate({ trans, type: "put", values: [objToAdd], keys: key != null ? [key] : null });
          }).then(function(res) {
            return res.numFailures ? DexiePromise.reject(res.failures[0]) : res.lastResult;
          }).then(function(lastResult) {
            if (keyPath) {
              try {
                setByKeyPath(obj, keyPath, lastResult);
              } catch (_) {
              }
            }
            return lastResult;
          });
        };
        Table2.prototype.delete = function(key) {
          var _this = this;
          return this._trans("readwrite", function(trans) {
            return _this.core.mutate({ trans, type: "delete", keys: [key] }).then(function(res) {
              return builtInDeletionTrigger(_this, [key], res);
            }).then(function(res) {
              return res.numFailures ? DexiePromise.reject(res.failures[0]) : void 0;
            });
          });
        };
        Table2.prototype.clear = function() {
          var _this = this;
          return this._trans("readwrite", function(trans) {
            return _this.core.mutate({ trans, type: "deleteRange", range: AnyRange }).then(function(res) {
              return builtInDeletionTrigger(_this, null, res);
            });
          }).then(function(res) {
            return res.numFailures ? DexiePromise.reject(res.failures[0]) : void 0;
          });
        };
        Table2.prototype.bulkGet = function(keys2) {
          var _this = this;
          return this._trans("readonly", function(trans) {
            return _this.core.getMany({
              keys: keys2,
              trans
            }).then(function(result) {
              return result.map(function(res) {
                return _this.hook.reading.fire(res);
              });
            });
          });
        };
        Table2.prototype.bulkAdd = function(objects, keysOrOptions, options) {
          var _this = this;
          var keys2 = Array.isArray(keysOrOptions) ? keysOrOptions : void 0;
          options = options || (keys2 ? void 0 : keysOrOptions);
          var wantResults = options ? options.allKeys : void 0;
          return this._trans("readwrite", function(trans) {
            var _a2 = _this.schema.primKey, auto = _a2.auto, keyPath = _a2.keyPath;
            if (keyPath && keys2)
              throw new exceptions.InvalidArgument("bulkAdd(): keys argument invalid on tables with inbound keys");
            if (keys2 && keys2.length !== objects.length)
              throw new exceptions.InvalidArgument("Arguments objects and keys must have the same length");
            var numObjects = objects.length;
            var objectsToAdd = keyPath && auto ? objects.map(workaroundForUndefinedPrimKey(keyPath)) : objects;
            return _this.core.mutate({ trans, type: "add", keys: keys2, values: objectsToAdd, wantResults }).then(function(_a3) {
              var numFailures = _a3.numFailures, results = _a3.results, lastResult = _a3.lastResult, failures = _a3.failures;
              var result = wantResults ? results : lastResult;
              if (numFailures === 0)
                return result;
              throw new BulkError("".concat(_this.name, ".bulkAdd(): ").concat(numFailures, " of ").concat(numObjects, " operations failed"), failures);
            });
          });
        };
        Table2.prototype.bulkPut = function(objects, keysOrOptions, options) {
          var _this = this;
          var keys2 = Array.isArray(keysOrOptions) ? keysOrOptions : void 0;
          options = options || (keys2 ? void 0 : keysOrOptions);
          var wantResults = options ? options.allKeys : void 0;
          return this._trans("readwrite", function(trans) {
            var _a2 = _this.schema.primKey, auto = _a2.auto, keyPath = _a2.keyPath;
            if (keyPath && keys2)
              throw new exceptions.InvalidArgument("bulkPut(): keys argument invalid on tables with inbound keys");
            if (keys2 && keys2.length !== objects.length)
              throw new exceptions.InvalidArgument("Arguments objects and keys must have the same length");
            var numObjects = objects.length;
            var objectsToPut = keyPath && auto ? objects.map(workaroundForUndefinedPrimKey(keyPath)) : objects;
            return _this.core.mutate({ trans, type: "put", keys: keys2, values: objectsToPut, wantResults }).then(function(_a3) {
              var numFailures = _a3.numFailures, results = _a3.results, lastResult = _a3.lastResult, failures = _a3.failures;
              var result = wantResults ? results : lastResult;
              if (numFailures === 0)
                return result;
              throw new BulkError("".concat(_this.name, ".bulkPut(): ").concat(numFailures, " of ").concat(numObjects, " operations failed"), failures);
            });
          });
        };
        Table2.prototype.bulkUpdate = function(keysAndChanges) {
          var _this = this;
          var coreTable = this.core;
          var keys2 = keysAndChanges.map(function(entry) {
            return entry.key;
          });
          var changeSpecs = keysAndChanges.map(function(entry) {
            return entry.changes;
          });
          var offsetMap = [];
          return this._trans("readwrite", function(trans) {
            return coreTable.getMany({ trans, keys: keys2, cache: "clone" }).then(function(objs) {
              var resultKeys = [];
              var resultObjs = [];
              keysAndChanges.forEach(function(_a2, idx) {
                var key = _a2.key, changes = _a2.changes;
                var obj = objs[idx];
                if (obj) {
                  for (var _i = 0, _b = Object.keys(changes); _i < _b.length; _i++) {
                    var keyPath = _b[_i];
                    var value = changes[keyPath];
                    if (keyPath === _this.schema.primKey.keyPath) {
                      if (cmp3(value, key) !== 0) {
                        throw new exceptions.Constraint("Cannot update primary key in bulkUpdate()");
                      }
                    } else {
                      setByKeyPath(obj, keyPath, value);
                    }
                  }
                  offsetMap.push(idx);
                  resultKeys.push(key);
                  resultObjs.push(obj);
                }
              });
              var numEntries = resultKeys.length;
              return coreTable.mutate({
                trans,
                type: "put",
                keys: resultKeys,
                values: resultObjs,
                updates: {
                  keys: keys2,
                  changeSpecs
                }
              }).then(function(_a2) {
                var numFailures = _a2.numFailures, failures = _a2.failures;
                if (numFailures === 0)
                  return numEntries;
                for (var _i = 0, _b = Object.keys(failures); _i < _b.length; _i++) {
                  var offset = _b[_i];
                  var mappedOffset = offsetMap[Number(offset)];
                  if (mappedOffset != null) {
                    var failure = failures[offset];
                    delete failures[offset];
                    failures[mappedOffset] = failure;
                  }
                }
                throw new BulkError("".concat(_this.name, ".bulkUpdate(): ").concat(numFailures, " of ").concat(numEntries, " operations failed"), failures);
              });
            });
          });
        };
        Table2.prototype.bulkDelete = function(keys2) {
          var _this = this;
          var numKeys = keys2.length;
          return this._trans("readwrite", function(trans) {
            return _this.core.mutate({ trans, type: "delete", keys: keys2 }).then(function(res) {
              return builtInDeletionTrigger(_this, keys2, res);
            });
          }).then(function(_a2) {
            var numFailures = _a2.numFailures, lastResult = _a2.lastResult, failures = _a2.failures;
            if (numFailures === 0)
              return lastResult;
            throw new BulkError("".concat(_this.name, ".bulkDelete(): ").concat(numFailures, " of ").concat(numKeys, " operations failed"), failures);
          });
        };
        return Table2;
      })();
      function Events(ctx) {
        var evs = {};
        var rv = function(eventName, subscriber) {
          if (subscriber) {
            var i2 = arguments.length, args = new Array(i2 - 1);
            while (--i2)
              args[i2 - 1] = arguments[i2];
            evs[eventName].subscribe.apply(null, args);
            return ctx;
          } else if (typeof eventName === "string") {
            return evs[eventName];
          }
        };
        rv.addEventType = add3;
        for (var i = 1, l = arguments.length; i < l; ++i) {
          add3(arguments[i]);
        }
        return rv;
        function add3(eventName, chainFunction, defaultFunction) {
          if (typeof eventName === "object")
            return addConfiguredEvents(eventName);
          if (!chainFunction)
            chainFunction = reverseStoppableEventChain;
          if (!defaultFunction)
            defaultFunction = nop;
          var context = {
            subscribers: [],
            fire: defaultFunction,
            subscribe: function(cb) {
              if (context.subscribers.indexOf(cb) === -1) {
                context.subscribers.push(cb);
                context.fire = chainFunction(context.fire, cb);
              }
            },
            unsubscribe: function(cb) {
              context.subscribers = context.subscribers.filter(function(fn) {
                return fn !== cb;
              });
              context.fire = context.subscribers.reduce(chainFunction, defaultFunction);
            }
          };
          evs[eventName] = rv[eventName] = context;
          return context;
        }
        function addConfiguredEvents(cfg) {
          keys(cfg).forEach(function(eventName) {
            var args = cfg[eventName];
            if (isArray(args)) {
              add3(eventName, cfg[eventName][0], cfg[eventName][1]);
            } else if (args === "asap") {
              var context = add3(eventName, mirror, function fire() {
                var i2 = arguments.length, args2 = new Array(i2);
                while (i2--)
                  args2[i2] = arguments[i2];
                context.subscribers.forEach(function(fn) {
                  asap$1(function fireEvent() {
                    fn.apply(null, args2);
                  });
                });
              });
            } else
              throw new exceptions.InvalidArgument("Invalid event config");
          });
        }
      }
      function makeClassConstructor(prototype, constructor) {
        derive(constructor).from({ prototype });
        return constructor;
      }
      function createTableConstructor(db) {
        return makeClassConstructor(Table.prototype, function Table2(name, tableSchema, trans) {
          this.db = db;
          this._tx = trans;
          this.name = name;
          this.schema = tableSchema;
          this.hook = db._allTables[name] ? db._allTables[name].hook : Events(null, {
            "creating": [hookCreatingChain, nop],
            "reading": [pureFunctionChain, mirror],
            "updating": [hookUpdatingChain, nop],
            "deleting": [hookDeletingChain, nop]
          });
        });
      }
      function isPlainKeyRange(ctx, ignoreLimitFilter) {
        return !(ctx.filter || ctx.algorithm || ctx.or) && (ignoreLimitFilter ? ctx.justLimit : !ctx.replayFilter);
      }
      function addFilter(ctx, fn) {
        ctx.filter = combine(ctx.filter, fn);
      }
      function addReplayFilter(ctx, factory, isLimitFilter) {
        var curr = ctx.replayFilter;
        ctx.replayFilter = curr ? function() {
          return combine(curr(), factory());
        } : factory;
        ctx.justLimit = isLimitFilter && !curr;
      }
      function addMatchFilter(ctx, fn) {
        ctx.isMatch = combine(ctx.isMatch, fn);
      }
      function getIndexOrStore(ctx, coreSchema) {
        if (ctx.isPrimKey)
          return coreSchema.primaryKey;
        var index = coreSchema.getIndexByKeyPath(ctx.index);
        if (!index)
          throw new exceptions.Schema("KeyPath " + ctx.index + " on object store " + coreSchema.name + " is not indexed");
        return index;
      }
      function openCursor(ctx, coreTable, trans) {
        var index = getIndexOrStore(ctx, coreTable.schema);
        return coreTable.openCursor({
          trans,
          values: !ctx.keysOnly,
          reverse: ctx.dir === "prev",
          unique: !!ctx.unique,
          query: {
            index,
            range: ctx.range
          }
        });
      }
      function iter(ctx, fn, coreTrans, coreTable) {
        var filter = ctx.replayFilter ? combine(ctx.filter, ctx.replayFilter()) : ctx.filter;
        if (!ctx.or) {
          return iterate(openCursor(ctx, coreTable, coreTrans), combine(ctx.algorithm, filter), fn, !ctx.keysOnly && ctx.valueMapper);
        } else {
          var set_1 = {};
          var union = function(item, cursor, advance) {
            if (!filter || filter(cursor, advance, function(result) {
              return cursor.stop(result);
            }, function(err) {
              return cursor.fail(err);
            })) {
              var primaryKey = cursor.primaryKey;
              var key = "" + primaryKey;
              if (key === "[object ArrayBuffer]")
                key = "" + new Uint8Array(primaryKey);
              if (!hasOwn(set_1, key)) {
                set_1[key] = true;
                fn(item, cursor, advance);
              }
            }
          };
          return Promise.all([
            ctx.or._iterate(union, coreTrans),
            iterate(openCursor(ctx, coreTable, coreTrans), ctx.algorithm, union, !ctx.keysOnly && ctx.valueMapper)
          ]);
        }
      }
      function iterate(cursorPromise, filter, fn, valueMapper) {
        var mappedFn = valueMapper ? function(x, c, a) {
          return fn(valueMapper(x), c, a);
        } : fn;
        var wrappedFn = wrap(mappedFn);
        return cursorPromise.then(function(cursor) {
          if (cursor) {
            return cursor.start(function() {
              var c = function() {
                return cursor.continue();
              };
              if (!filter || filter(cursor, function(advancer) {
                return c = advancer;
              }, function(val) {
                cursor.stop(val);
                c = nop;
              }, function(e) {
                cursor.fail(e);
                c = nop;
              }))
                wrappedFn(cursor.value, cursor, function(advancer) {
                  return c = advancer;
                });
              c();
            });
          }
        });
      }
      var Collection = (function() {
        function Collection2() {
        }
        Collection2.prototype._read = function(fn, cb) {
          var ctx = this._ctx;
          return ctx.error ? ctx.table._trans(null, rejection.bind(null, ctx.error)) : ctx.table._trans("readonly", fn).then(cb);
        };
        Collection2.prototype._write = function(fn) {
          var ctx = this._ctx;
          return ctx.error ? ctx.table._trans(null, rejection.bind(null, ctx.error)) : ctx.table._trans("readwrite", fn, "locked");
        };
        Collection2.prototype._addAlgorithm = function(fn) {
          var ctx = this._ctx;
          ctx.algorithm = combine(ctx.algorithm, fn);
        };
        Collection2.prototype._iterate = function(fn, coreTrans) {
          return iter(this._ctx, fn, coreTrans, this._ctx.table.core);
        };
        Collection2.prototype.clone = function(props2) {
          var rv = Object.create(this.constructor.prototype), ctx = Object.create(this._ctx);
          if (props2)
            extend3(ctx, props2);
          rv._ctx = ctx;
          return rv;
        };
        Collection2.prototype.raw = function() {
          this._ctx.valueMapper = null;
          return this;
        };
        Collection2.prototype.each = function(fn) {
          var ctx = this._ctx;
          return this._read(function(trans) {
            return iter(ctx, fn, trans, ctx.table.core);
          });
        };
        Collection2.prototype.count = function(cb) {
          var _this = this;
          return this._read(function(trans) {
            var ctx = _this._ctx;
            var coreTable = ctx.table.core;
            if (isPlainKeyRange(ctx, true)) {
              return coreTable.count({
                trans,
                query: {
                  index: getIndexOrStore(ctx, coreTable.schema),
                  range: ctx.range
                }
              }).then(function(count2) {
                return Math.min(count2, ctx.limit);
              });
            } else {
              var count = 0;
              return iter(ctx, function() {
                ++count;
                return false;
              }, trans, coreTable).then(function() {
                return count;
              });
            }
          }).then(cb);
        };
        Collection2.prototype.sortBy = function(keyPath, cb) {
          var parts = keyPath.split(".").reverse(), lastPart = parts[0], lastIndex = parts.length - 1;
          function getval(obj, i) {
            if (i)
              return getval(obj[parts[i]], i - 1);
            return obj[lastPart];
          }
          var order = this._ctx.dir === "next" ? 1 : -1;
          function sorter(a, b) {
            var aVal = getval(a, lastIndex), bVal = getval(b, lastIndex);
            return cmp3(aVal, bVal) * order;
          }
          return this.toArray(function(a) {
            return a.sort(sorter);
          }).then(cb);
        };
        Collection2.prototype.toArray = function(cb) {
          var _this = this;
          return this._read(function(trans) {
            var ctx = _this._ctx;
            if (ctx.dir === "next" && isPlainKeyRange(ctx, true) && ctx.limit > 0) {
              var valueMapper_1 = ctx.valueMapper;
              var index = getIndexOrStore(ctx, ctx.table.core.schema);
              return ctx.table.core.query({
                trans,
                limit: ctx.limit,
                values: true,
                query: {
                  index,
                  range: ctx.range
                }
              }).then(function(_a2) {
                var result = _a2.result;
                return valueMapper_1 ? result.map(valueMapper_1) : result;
              });
            } else {
              var a_1 = [];
              return iter(ctx, function(item) {
                return a_1.push(item);
              }, trans, ctx.table.core).then(function() {
                return a_1;
              });
            }
          }, cb);
        };
        Collection2.prototype.offset = function(offset) {
          var ctx = this._ctx;
          if (offset <= 0)
            return this;
          ctx.offset += offset;
          if (isPlainKeyRange(ctx)) {
            addReplayFilter(ctx, function() {
              var offsetLeft = offset;
              return function(cursor, advance) {
                if (offsetLeft === 0)
                  return true;
                if (offsetLeft === 1) {
                  --offsetLeft;
                  return false;
                }
                advance(function() {
                  cursor.advance(offsetLeft);
                  offsetLeft = 0;
                });
                return false;
              };
            });
          } else {
            addReplayFilter(ctx, function() {
              var offsetLeft = offset;
              return function() {
                return --offsetLeft < 0;
              };
            });
          }
          return this;
        };
        Collection2.prototype.limit = function(numRows) {
          this._ctx.limit = Math.min(this._ctx.limit, numRows);
          addReplayFilter(this._ctx, function() {
            var rowsLeft = numRows;
            return function(cursor, advance, resolve2) {
              if (--rowsLeft <= 0)
                advance(resolve2);
              return rowsLeft >= 0;
            };
          }, true);
          return this;
        };
        Collection2.prototype.until = function(filterFunction, bIncludeStopEntry) {
          addFilter(this._ctx, function(cursor, advance, resolve2) {
            if (filterFunction(cursor.value)) {
              advance(resolve2);
              return bIncludeStopEntry;
            } else {
              return true;
            }
          });
          return this;
        };
        Collection2.prototype.first = function(cb) {
          return this.limit(1).toArray(function(a) {
            return a[0];
          }).then(cb);
        };
        Collection2.prototype.last = function(cb) {
          return this.reverse().first(cb);
        };
        Collection2.prototype.filter = function(filterFunction) {
          addFilter(this._ctx, function(cursor) {
            return filterFunction(cursor.value);
          });
          addMatchFilter(this._ctx, filterFunction);
          return this;
        };
        Collection2.prototype.and = function(filter) {
          return this.filter(filter);
        };
        Collection2.prototype.or = function(indexName) {
          return new this.db.WhereClause(this._ctx.table, indexName, this);
        };
        Collection2.prototype.reverse = function() {
          this._ctx.dir = this._ctx.dir === "prev" ? "next" : "prev";
          if (this._ondirectionchange)
            this._ondirectionchange(this._ctx.dir);
          return this;
        };
        Collection2.prototype.desc = function() {
          return this.reverse();
        };
        Collection2.prototype.eachKey = function(cb) {
          var ctx = this._ctx;
          ctx.keysOnly = !ctx.isMatch;
          return this.each(function(val, cursor) {
            cb(cursor.key, cursor);
          });
        };
        Collection2.prototype.eachUniqueKey = function(cb) {
          this._ctx.unique = "unique";
          return this.eachKey(cb);
        };
        Collection2.prototype.eachPrimaryKey = function(cb) {
          var ctx = this._ctx;
          ctx.keysOnly = !ctx.isMatch;
          return this.each(function(val, cursor) {
            cb(cursor.primaryKey, cursor);
          });
        };
        Collection2.prototype.keys = function(cb) {
          var ctx = this._ctx;
          ctx.keysOnly = !ctx.isMatch;
          var a = [];
          return this.each(function(item, cursor) {
            a.push(cursor.key);
          }).then(function() {
            return a;
          }).then(cb);
        };
        Collection2.prototype.primaryKeys = function(cb) {
          var ctx = this._ctx;
          if (ctx.dir === "next" && isPlainKeyRange(ctx, true) && ctx.limit > 0) {
            return this._read(function(trans) {
              var index = getIndexOrStore(ctx, ctx.table.core.schema);
              return ctx.table.core.query({
                trans,
                values: false,
                limit: ctx.limit,
                query: {
                  index,
                  range: ctx.range
                }
              });
            }).then(function(_a2) {
              var result = _a2.result;
              return result;
            }).then(cb);
          }
          ctx.keysOnly = !ctx.isMatch;
          var a = [];
          return this.each(function(item, cursor) {
            a.push(cursor.primaryKey);
          }).then(function() {
            return a;
          }).then(cb);
        };
        Collection2.prototype.uniqueKeys = function(cb) {
          this._ctx.unique = "unique";
          return this.keys(cb);
        };
        Collection2.prototype.firstKey = function(cb) {
          return this.limit(1).keys(function(a) {
            return a[0];
          }).then(cb);
        };
        Collection2.prototype.lastKey = function(cb) {
          return this.reverse().firstKey(cb);
        };
        Collection2.prototype.distinct = function() {
          var ctx = this._ctx, idx = ctx.index && ctx.table.schema.idxByName[ctx.index];
          if (!idx || !idx.multi)
            return this;
          var set2 = {};
          addFilter(this._ctx, function(cursor) {
            var strKey = cursor.primaryKey.toString();
            var found = hasOwn(set2, strKey);
            set2[strKey] = true;
            return !found;
          });
          return this;
        };
        Collection2.prototype.modify = function(changes) {
          var _this = this;
          var ctx = this._ctx;
          return this._write(function(trans) {
            var modifyer;
            if (typeof changes === "function") {
              modifyer = changes;
            } else {
              modifyer = function(item) {
                return applyUpdateSpec(item, changes);
              };
            }
            var coreTable = ctx.table.core;
            var _a2 = coreTable.schema.primaryKey, outbound = _a2.outbound, extractKey2 = _a2.extractKey;
            var limit = 200;
            var modifyChunkSize = _this.db._options.modifyChunkSize;
            if (modifyChunkSize) {
              if (typeof modifyChunkSize == "object") {
                limit = modifyChunkSize[coreTable.name] || modifyChunkSize["*"] || 200;
              } else {
                limit = modifyChunkSize;
              }
            }
            var totalFailures = [];
            var successCount = 0;
            var failedKeys = [];
            var applyMutateResult = function(expectedCount, res) {
              var failures = res.failures, numFailures = res.numFailures;
              successCount += expectedCount - numFailures;
              for (var _i = 0, _a3 = keys(failures); _i < _a3.length; _i++) {
                var pos = _a3[_i];
                totalFailures.push(failures[pos]);
              }
            };
            var isUnconditionalDelete = changes === deleteCallback;
            return _this.clone().primaryKeys().then(function(keys2) {
              var criteria = isPlainKeyRange(ctx) && ctx.limit === Infinity && (typeof changes !== "function" || isUnconditionalDelete) && {
                index: ctx.index,
                range: ctx.range
              };
              var nextChunk = function(offset) {
                var count = Math.min(limit, keys2.length - offset);
                var keysInChunk = keys2.slice(offset, offset + count);
                return (isUnconditionalDelete ? Promise.resolve([]) : coreTable.getMany({
                  trans,
                  keys: keysInChunk,
                  cache: "immutable"
                })).then(function(values) {
                  var addValues = [];
                  var putValues = [];
                  var putKeys = outbound ? [] : null;
                  var deleteKeys = isUnconditionalDelete ? keysInChunk : [];
                  if (!isUnconditionalDelete)
                    for (var i = 0; i < count; ++i) {
                      var origValue = values[i];
                      var ctx_1 = {
                        value: deepClone(origValue),
                        primKey: keys2[offset + i]
                      };
                      if (modifyer.call(ctx_1, ctx_1.value, ctx_1) !== false) {
                        if (ctx_1.value == null) {
                          deleteKeys.push(keys2[offset + i]);
                        } else if (!outbound && cmp3(extractKey2(origValue), extractKey2(ctx_1.value)) !== 0) {
                          deleteKeys.push(keys2[offset + i]);
                          addValues.push(ctx_1.value);
                        } else {
                          putValues.push(ctx_1.value);
                          if (outbound)
                            putKeys.push(keys2[offset + i]);
                        }
                      }
                    }
                  return Promise.resolve(addValues.length > 0 && coreTable.mutate({ trans, type: "add", values: addValues }).then(function(res) {
                    for (var pos in res.failures) {
                      deleteKeys.splice(parseInt(pos), 1);
                    }
                    applyMutateResult(addValues.length, res);
                  })).then(function() {
                    return (putValues.length > 0 || criteria && typeof changes === "object") && coreTable.mutate({
                      trans,
                      type: "put",
                      keys: putKeys,
                      values: putValues,
                      criteria,
                      changeSpec: typeof changes !== "function" && changes,
                      isAdditionalChunk: offset > 0
                    }).then(function(res) {
                      return applyMutateResult(putValues.length, res);
                    });
                  }).then(function() {
                    return (deleteKeys.length > 0 || criteria && isUnconditionalDelete) && coreTable.mutate({
                      trans,
                      type: "delete",
                      keys: deleteKeys,
                      criteria,
                      isAdditionalChunk: offset > 0
                    }).then(function(res) {
                      return builtInDeletionTrigger(ctx.table, deleteKeys, res);
                    }).then(function(res) {
                      return applyMutateResult(deleteKeys.length, res);
                    });
                  }).then(function() {
                    return keys2.length > offset + count && nextChunk(offset + limit);
                  });
                });
              };
              return nextChunk(0).then(function() {
                if (totalFailures.length > 0)
                  throw new ModifyError("Error modifying one or more objects", totalFailures, successCount, failedKeys);
                return keys2.length;
              });
            });
          });
        };
        Collection2.prototype.delete = function() {
          var ctx = this._ctx, range = ctx.range;
          if (isPlainKeyRange(ctx) && !ctx.table.schema.yProps && (ctx.isPrimKey || range.type === 3)) {
            return this._write(function(trans) {
              var primaryKey = ctx.table.core.schema.primaryKey;
              var coreRange = range;
              return ctx.table.core.count({ trans, query: { index: primaryKey, range: coreRange } }).then(function(count) {
                return ctx.table.core.mutate({ trans, type: "deleteRange", range: coreRange }).then(function(_a2) {
                  var failures = _a2.failures, numFailures = _a2.numFailures;
                  if (numFailures)
                    throw new ModifyError("Could not delete some values", Object.keys(failures).map(function(pos) {
                      return failures[pos];
                    }), count - numFailures);
                  return count - numFailures;
                });
              });
            });
          }
          return this.modify(deleteCallback);
        };
        return Collection2;
      })();
      var deleteCallback = function(value, ctx) {
        return ctx.value = null;
      };
      function createCollectionConstructor(db) {
        return makeClassConstructor(Collection.prototype, function Collection2(whereClause, keyRangeGenerator) {
          this.db = db;
          var keyRange = AnyRange, error = null;
          if (keyRangeGenerator)
            try {
              keyRange = keyRangeGenerator();
            } catch (ex) {
              error = ex;
            }
          var whereCtx = whereClause._ctx;
          var table = whereCtx.table;
          var readingHook = table.hook.reading.fire;
          this._ctx = {
            table,
            index: whereCtx.index,
            isPrimKey: !whereCtx.index || table.schema.primKey.keyPath && whereCtx.index === table.schema.primKey.name,
            range: keyRange,
            keysOnly: false,
            dir: "next",
            unique: "",
            algorithm: null,
            filter: null,
            replayFilter: null,
            justLimit: true,
            isMatch: null,
            offset: 0,
            limit: Infinity,
            error,
            or: whereCtx.or,
            valueMapper: readingHook !== mirror ? readingHook : null
          };
        });
      }
      function simpleCompare(a, b) {
        return a < b ? -1 : a === b ? 0 : 1;
      }
      function simpleCompareReverse(a, b) {
        return a > b ? -1 : a === b ? 0 : 1;
      }
      function fail(collectionOrWhereClause, err, T) {
        var collection = collectionOrWhereClause instanceof WhereClause ? new collectionOrWhereClause.Collection(collectionOrWhereClause) : collectionOrWhereClause;
        collection._ctx.error = T ? new T(err) : new TypeError(err);
        return collection;
      }
      function emptyCollection(whereClause) {
        return new whereClause.Collection(whereClause, function() {
          return rangeEqual("");
        }).limit(0);
      }
      function upperFactory(dir) {
        return dir === "next" ? function(s) {
          return s.toUpperCase();
        } : function(s) {
          return s.toLowerCase();
        };
      }
      function lowerFactory(dir) {
        return dir === "next" ? function(s) {
          return s.toLowerCase();
        } : function(s) {
          return s.toUpperCase();
        };
      }
      function nextCasing(key, lowerKey, upperNeedle, lowerNeedle, cmp4, dir) {
        var length = Math.min(key.length, lowerNeedle.length);
        var llp = -1;
        for (var i = 0; i < length; ++i) {
          var lwrKeyChar = lowerKey[i];
          if (lwrKeyChar !== lowerNeedle[i]) {
            if (cmp4(key[i], upperNeedle[i]) < 0)
              return key.substr(0, i) + upperNeedle[i] + upperNeedle.substr(i + 1);
            if (cmp4(key[i], lowerNeedle[i]) < 0)
              return key.substr(0, i) + lowerNeedle[i] + upperNeedle.substr(i + 1);
            if (llp >= 0)
              return key.substr(0, llp) + lowerKey[llp] + upperNeedle.substr(llp + 1);
            return null;
          }
          if (cmp4(key[i], lwrKeyChar) < 0)
            llp = i;
        }
        if (length < lowerNeedle.length && dir === "next")
          return key + upperNeedle.substr(key.length);
        if (length < key.length && dir === "prev")
          return key.substr(0, upperNeedle.length);
        return llp < 0 ? null : key.substr(0, llp) + lowerNeedle[llp] + upperNeedle.substr(llp + 1);
      }
      function addIgnoreCaseAlgorithm(whereClause, match, needles, suffix) {
        var upper, lower, compare, upperNeedles, lowerNeedles, direction, nextKeySuffix, needlesLen = needles.length;
        if (!needles.every(function(s) {
          return typeof s === "string";
        })) {
          return fail(whereClause, STRING_EXPECTED);
        }
        function initDirection(dir) {
          upper = upperFactory(dir);
          lower = lowerFactory(dir);
          compare = dir === "next" ? simpleCompare : simpleCompareReverse;
          var needleBounds = needles.map(function(needle) {
            return { lower: lower(needle), upper: upper(needle) };
          }).sort(function(a, b) {
            return compare(a.lower, b.lower);
          });
          upperNeedles = needleBounds.map(function(nb) {
            return nb.upper;
          });
          lowerNeedles = needleBounds.map(function(nb) {
            return nb.lower;
          });
          direction = dir;
          nextKeySuffix = dir === "next" ? "" : suffix;
        }
        initDirection("next");
        var c = new whereClause.Collection(whereClause, function() {
          return createRange(upperNeedles[0], lowerNeedles[needlesLen - 1] + suffix);
        });
        c._ondirectionchange = function(direction2) {
          initDirection(direction2);
        };
        var firstPossibleNeedle = 0;
        c._addAlgorithm(function(cursor, advance, resolve2) {
          var key = cursor.key;
          if (typeof key !== "string")
            return false;
          var lowerKey = lower(key);
          if (match(lowerKey, lowerNeedles, firstPossibleNeedle)) {
            return true;
          } else {
            var lowestPossibleCasing = null;
            for (var i = firstPossibleNeedle; i < needlesLen; ++i) {
              var casing = nextCasing(key, lowerKey, upperNeedles[i], lowerNeedles[i], compare, direction);
              if (casing === null && lowestPossibleCasing === null)
                firstPossibleNeedle = i + 1;
              else if (lowestPossibleCasing === null || compare(lowestPossibleCasing, casing) > 0) {
                lowestPossibleCasing = casing;
              }
            }
            if (lowestPossibleCasing !== null) {
              advance(function() {
                cursor.continue(lowestPossibleCasing + nextKeySuffix);
              });
            } else {
              advance(resolve2);
            }
            return false;
          }
        });
        return c;
      }
      function createRange(lower, upper, lowerOpen, upperOpen) {
        return {
          type: 2,
          lower,
          upper,
          lowerOpen,
          upperOpen
        };
      }
      function rangeEqual(value) {
        return {
          type: 1,
          lower: value,
          upper: value
        };
      }
      var WhereClause = (function() {
        function WhereClause2() {
        }
        Object.defineProperty(WhereClause2.prototype, "Collection", {
          get: function() {
            return this._ctx.table.db.Collection;
          },
          enumerable: false,
          configurable: true
        });
        WhereClause2.prototype.between = function(lower, upper, includeLower, includeUpper) {
          includeLower = includeLower !== false;
          includeUpper = includeUpper === true;
          try {
            if (this._cmp(lower, upper) > 0 || this._cmp(lower, upper) === 0 && (includeLower || includeUpper) && !(includeLower && includeUpper))
              return emptyCollection(this);
            return new this.Collection(this, function() {
              return createRange(lower, upper, !includeLower, !includeUpper);
            });
          } catch (e) {
            return fail(this, INVALID_KEY_ARGUMENT);
          }
        };
        WhereClause2.prototype.equals = function(value) {
          if (value == null)
            return fail(this, INVALID_KEY_ARGUMENT);
          return new this.Collection(this, function() {
            return rangeEqual(value);
          });
        };
        WhereClause2.prototype.above = function(value) {
          if (value == null)
            return fail(this, INVALID_KEY_ARGUMENT);
          return new this.Collection(this, function() {
            return createRange(value, void 0, true);
          });
        };
        WhereClause2.prototype.aboveOrEqual = function(value) {
          if (value == null)
            return fail(this, INVALID_KEY_ARGUMENT);
          return new this.Collection(this, function() {
            return createRange(value, void 0, false);
          });
        };
        WhereClause2.prototype.below = function(value) {
          if (value == null)
            return fail(this, INVALID_KEY_ARGUMENT);
          return new this.Collection(this, function() {
            return createRange(void 0, value, false, true);
          });
        };
        WhereClause2.prototype.belowOrEqual = function(value) {
          if (value == null)
            return fail(this, INVALID_KEY_ARGUMENT);
          return new this.Collection(this, function() {
            return createRange(void 0, value);
          });
        };
        WhereClause2.prototype.startsWith = function(str2) {
          if (typeof str2 !== "string")
            return fail(this, STRING_EXPECTED);
          return this.between(str2, str2 + maxString, true, true);
        };
        WhereClause2.prototype.startsWithIgnoreCase = function(str2) {
          if (str2 === "")
            return this.startsWith(str2);
          return addIgnoreCaseAlgorithm(this, function(x, a) {
            return x.indexOf(a[0]) === 0;
          }, [str2], maxString);
        };
        WhereClause2.prototype.equalsIgnoreCase = function(str2) {
          return addIgnoreCaseAlgorithm(this, function(x, a) {
            return x === a[0];
          }, [str2], "");
        };
        WhereClause2.prototype.anyOfIgnoreCase = function() {
          var set2 = getArrayOf.apply(NO_CHAR_ARRAY, arguments);
          if (set2.length === 0)
            return emptyCollection(this);
          return addIgnoreCaseAlgorithm(this, function(x, a) {
            return a.indexOf(x) !== -1;
          }, set2, "");
        };
        WhereClause2.prototype.startsWithAnyOfIgnoreCase = function() {
          var set2 = getArrayOf.apply(NO_CHAR_ARRAY, arguments);
          if (set2.length === 0)
            return emptyCollection(this);
          return addIgnoreCaseAlgorithm(this, function(x, a) {
            return a.some(function(n) {
              return x.indexOf(n) === 0;
            });
          }, set2, maxString);
        };
        WhereClause2.prototype.anyOf = function() {
          var _this = this;
          var set2 = getArrayOf.apply(NO_CHAR_ARRAY, arguments);
          var compare = this._cmp;
          try {
            set2.sort(compare);
          } catch (e) {
            return fail(this, INVALID_KEY_ARGUMENT);
          }
          if (set2.length === 0)
            return emptyCollection(this);
          var c = new this.Collection(this, function() {
            return createRange(set2[0], set2[set2.length - 1]);
          });
          c._ondirectionchange = function(direction) {
            compare = direction === "next" ? _this._ascending : _this._descending;
            set2.sort(compare);
          };
          var i = 0;
          c._addAlgorithm(function(cursor, advance, resolve2) {
            var key = cursor.key;
            while (compare(key, set2[i]) > 0) {
              ++i;
              if (i === set2.length) {
                advance(resolve2);
                return false;
              }
            }
            if (compare(key, set2[i]) === 0) {
              return true;
            } else {
              advance(function() {
                cursor.continue(set2[i]);
              });
              return false;
            }
          });
          return c;
        };
        WhereClause2.prototype.notEqual = function(value) {
          return this.inAnyRange([[minKey, value], [value, this.db._maxKey]], { includeLowers: false, includeUppers: false });
        };
        WhereClause2.prototype.noneOf = function() {
          var set2 = getArrayOf.apply(NO_CHAR_ARRAY, arguments);
          if (set2.length === 0)
            return new this.Collection(this);
          try {
            set2.sort(this._ascending);
          } catch (e) {
            return fail(this, INVALID_KEY_ARGUMENT);
          }
          var ranges = set2.reduce(function(res, val) {
            return res ? res.concat([[res[res.length - 1][1], val]]) : [[minKey, val]];
          }, null);
          ranges.push([set2[set2.length - 1], this.db._maxKey]);
          return this.inAnyRange(ranges, { includeLowers: false, includeUppers: false });
        };
        WhereClause2.prototype.inAnyRange = function(ranges, options) {
          var _this = this;
          var cmp4 = this._cmp, ascending = this._ascending, descending = this._descending, min = this._min, max = this._max;
          if (ranges.length === 0)
            return emptyCollection(this);
          if (!ranges.every(function(range) {
            return range[0] !== void 0 && range[1] !== void 0 && ascending(range[0], range[1]) <= 0;
          })) {
            return fail(this, "First argument to inAnyRange() must be an Array of two-value Arrays [lower,upper] where upper must not be lower than lower", exceptions.InvalidArgument);
          }
          var includeLowers = !options || options.includeLowers !== false;
          var includeUppers = options && options.includeUppers === true;
          function addRange2(ranges2, newRange) {
            var i = 0, l = ranges2.length;
            for (; i < l; ++i) {
              var range = ranges2[i];
              if (cmp4(newRange[0], range[1]) < 0 && cmp4(newRange[1], range[0]) > 0) {
                range[0] = min(range[0], newRange[0]);
                range[1] = max(range[1], newRange[1]);
                break;
              }
            }
            if (i === l)
              ranges2.push(newRange);
            return ranges2;
          }
          var sortDirection = ascending;
          function rangeSorter(a, b) {
            return sortDirection(a[0], b[0]);
          }
          var set2;
          try {
            set2 = ranges.reduce(addRange2, []);
            set2.sort(rangeSorter);
          } catch (ex) {
            return fail(this, INVALID_KEY_ARGUMENT);
          }
          var rangePos = 0;
          var keyIsBeyondCurrentEntry = includeUppers ? function(key) {
            return ascending(key, set2[rangePos][1]) > 0;
          } : function(key) {
            return ascending(key, set2[rangePos][1]) >= 0;
          };
          var keyIsBeforeCurrentEntry = includeLowers ? function(key) {
            return descending(key, set2[rangePos][0]) > 0;
          } : function(key) {
            return descending(key, set2[rangePos][0]) >= 0;
          };
          function keyWithinCurrentRange(key) {
            return !keyIsBeyondCurrentEntry(key) && !keyIsBeforeCurrentEntry(key);
          }
          var checkKey = keyIsBeyondCurrentEntry;
          var c = new this.Collection(this, function() {
            return createRange(set2[0][0], set2[set2.length - 1][1], !includeLowers, !includeUppers);
          });
          c._ondirectionchange = function(direction) {
            if (direction === "next") {
              checkKey = keyIsBeyondCurrentEntry;
              sortDirection = ascending;
            } else {
              checkKey = keyIsBeforeCurrentEntry;
              sortDirection = descending;
            }
            set2.sort(rangeSorter);
          };
          c._addAlgorithm(function(cursor, advance, resolve2) {
            var key = cursor.key;
            while (checkKey(key)) {
              ++rangePos;
              if (rangePos === set2.length) {
                advance(resolve2);
                return false;
              }
            }
            if (keyWithinCurrentRange(key)) {
              return true;
            } else if (_this._cmp(key, set2[rangePos][1]) === 0 || _this._cmp(key, set2[rangePos][0]) === 0) {
              return false;
            } else {
              advance(function() {
                if (sortDirection === ascending)
                  cursor.continue(set2[rangePos][0]);
                else
                  cursor.continue(set2[rangePos][1]);
              });
              return false;
            }
          });
          return c;
        };
        WhereClause2.prototype.startsWithAnyOf = function() {
          var set2 = getArrayOf.apply(NO_CHAR_ARRAY, arguments);
          if (!set2.every(function(s) {
            return typeof s === "string";
          })) {
            return fail(this, "startsWithAnyOf() only works with strings");
          }
          if (set2.length === 0)
            return emptyCollection(this);
          return this.inAnyRange(set2.map(function(str2) {
            return [str2, str2 + maxString];
          }));
        };
        return WhereClause2;
      })();
      function createWhereClauseConstructor(db) {
        return makeClassConstructor(WhereClause.prototype, function WhereClause2(table, index, orCollection) {
          this.db = db;
          this._ctx = {
            table,
            index: index === ":id" ? null : index,
            or: orCollection
          };
          this._cmp = this._ascending = cmp3;
          this._descending = function(a, b) {
            return cmp3(b, a);
          };
          this._max = function(a, b) {
            return cmp3(a, b) > 0 ? a : b;
          };
          this._min = function(a, b) {
            return cmp3(a, b) < 0 ? a : b;
          };
          this._IDBKeyRange = db._deps.IDBKeyRange;
          if (!this._IDBKeyRange)
            throw new exceptions.MissingAPI();
        });
      }
      function eventRejectHandler(reject) {
        return wrap(function(event) {
          preventDefault(event);
          reject(event.target.error);
          return false;
        });
      }
      function preventDefault(event) {
        if (event.stopPropagation)
          event.stopPropagation();
        if (event.preventDefault)
          event.preventDefault();
      }
      var DEXIE_STORAGE_MUTATED_EVENT_NAME = "storagemutated";
      var STORAGE_MUTATED_DOM_EVENT_NAME = "x-storagemutated-1";
      var globalEvents = Events(null, DEXIE_STORAGE_MUTATED_EVENT_NAME);
      var Transaction = (function() {
        function Transaction2() {
        }
        Transaction2.prototype._lock = function() {
          assert(!PSD.global);
          ++this._reculock;
          if (this._reculock === 1 && !PSD.global)
            PSD.lockOwnerFor = this;
          return this;
        };
        Transaction2.prototype._unlock = function() {
          assert(!PSD.global);
          if (--this._reculock === 0) {
            if (!PSD.global)
              PSD.lockOwnerFor = null;
            while (this._blockedFuncs.length > 0 && !this._locked()) {
              var fnAndPSD = this._blockedFuncs.shift();
              try {
                usePSD(fnAndPSD[1], fnAndPSD[0]);
              } catch (e) {
              }
            }
          }
          return this;
        };
        Transaction2.prototype._locked = function() {
          return this._reculock && PSD.lockOwnerFor !== this;
        };
        Transaction2.prototype.create = function(idbtrans) {
          var _this = this;
          if (!this.mode)
            return this;
          var idbdb = this.db.idbdb;
          var dbOpenError = this.db._state.dbOpenError;
          assert(!this.idbtrans);
          if (!idbtrans && !idbdb) {
            switch (dbOpenError && dbOpenError.name) {
              case "DatabaseClosedError":
                throw new exceptions.DatabaseClosed(dbOpenError);
              case "MissingAPIError":
                throw new exceptions.MissingAPI(dbOpenError.message, dbOpenError);
              default:
                throw new exceptions.OpenFailed(dbOpenError);
            }
          }
          if (!this.active)
            throw new exceptions.TransactionInactive();
          assert(this._completion._state === null);
          idbtrans = this.idbtrans = idbtrans || (this.db.core ? this.db.core.transaction(this.storeNames, this.mode, { durability: this.chromeTransactionDurability }) : idbdb.transaction(this.storeNames, this.mode, { durability: this.chromeTransactionDurability }));
          idbtrans.onerror = wrap(function(ev) {
            preventDefault(ev);
            _this._reject(idbtrans.error);
          });
          idbtrans.onabort = wrap(function(ev) {
            preventDefault(ev);
            _this.active && _this._reject(new exceptions.Abort(idbtrans.error));
            _this.active = false;
            _this.on("abort").fire(ev);
          });
          idbtrans.oncomplete = wrap(function() {
            _this.active = false;
            _this._resolve();
            if ("mutatedParts" in idbtrans) {
              globalEvents.storagemutated.fire(idbtrans["mutatedParts"]);
            }
          });
          return this;
        };
        Transaction2.prototype._promise = function(mode, fn, bWriteLock) {
          var _this = this;
          if (mode === "readwrite" && this.mode !== "readwrite")
            return rejection(new exceptions.ReadOnly("Transaction is readonly"));
          if (!this.active)
            return rejection(new exceptions.TransactionInactive());
          if (this._locked()) {
            return new DexiePromise(function(resolve2, reject) {
              _this._blockedFuncs.push([function() {
                _this._promise(mode, fn, bWriteLock).then(resolve2, reject);
              }, PSD]);
            });
          } else if (bWriteLock) {
            return newScope(function() {
              var p2 = new DexiePromise(function(resolve2, reject) {
                _this._lock();
                var rv = fn(resolve2, reject, _this);
                if (rv && rv.then)
                  rv.then(resolve2, reject);
              });
              p2.finally(function() {
                return _this._unlock();
              });
              p2._lib = true;
              return p2;
            });
          } else {
            var p = new DexiePromise(function(resolve2, reject) {
              var rv = fn(resolve2, reject, _this);
              if (rv && rv.then)
                rv.then(resolve2, reject);
            });
            p._lib = true;
            return p;
          }
        };
        Transaction2.prototype._root = function() {
          return this.parent ? this.parent._root() : this;
        };
        Transaction2.prototype.waitFor = function(promiseLike) {
          var root = this._root();
          var promise = DexiePromise.resolve(promiseLike);
          if (root._waitingFor) {
            root._waitingFor = root._waitingFor.then(function() {
              return promise;
            });
          } else {
            root._waitingFor = promise;
            root._waitingQueue = [];
            var store = root.idbtrans.objectStore(root.storeNames[0]);
            (function spin() {
              ++root._spinCount;
              while (root._waitingQueue.length)
                root._waitingQueue.shift()();
              if (root._waitingFor)
                store.get(-Infinity).onsuccess = spin;
            })();
          }
          var currentWaitPromise = root._waitingFor;
          return new DexiePromise(function(resolve2, reject) {
            promise.then(function(res) {
              return root._waitingQueue.push(wrap(resolve2.bind(null, res)));
            }, function(err) {
              return root._waitingQueue.push(wrap(reject.bind(null, err)));
            }).finally(function() {
              if (root._waitingFor === currentWaitPromise) {
                root._waitingFor = null;
              }
            });
          });
        };
        Transaction2.prototype.abort = function() {
          if (this.active) {
            this.active = false;
            if (this.idbtrans)
              this.idbtrans.abort();
            this._reject(new exceptions.Abort());
          }
        };
        Transaction2.prototype.table = function(tableName) {
          var memoizedTables = this._memoizedTables || (this._memoizedTables = {});
          if (hasOwn(memoizedTables, tableName))
            return memoizedTables[tableName];
          var tableSchema = this.schema[tableName];
          if (!tableSchema) {
            throw new exceptions.NotFound("Table " + tableName + " not part of transaction");
          }
          var transactionBoundTable = new this.db.Table(tableName, tableSchema, this);
          transactionBoundTable.core = this.db.core.table(tableName);
          memoizedTables[tableName] = transactionBoundTable;
          return transactionBoundTable;
        };
        return Transaction2;
      })();
      function createTransactionConstructor(db) {
        return makeClassConstructor(Transaction.prototype, function Transaction2(mode, storeNames, dbschema, chromeTransactionDurability, parent) {
          var _this = this;
          if (mode !== "readonly")
            storeNames.forEach(function(storeName) {
              var _a2;
              var yProps = (_a2 = dbschema[storeName]) === null || _a2 === void 0 ? void 0 : _a2.yProps;
              if (yProps)
                storeNames = storeNames.concat(yProps.map(function(p) {
                  return p.updatesTable;
                }));
            });
          this.db = db;
          this.mode = mode;
          this.storeNames = storeNames;
          this.schema = dbschema;
          this.chromeTransactionDurability = chromeTransactionDurability;
          this.idbtrans = null;
          this.on = Events(this, "complete", "error", "abort");
          this.parent = parent || null;
          this.active = true;
          this._reculock = 0;
          this._blockedFuncs = [];
          this._resolve = null;
          this._reject = null;
          this._waitingFor = null;
          this._waitingQueue = null;
          this._spinCount = 0;
          this._completion = new DexiePromise(function(resolve2, reject) {
            _this._resolve = resolve2;
            _this._reject = reject;
          });
          this._completion.then(function() {
            _this.active = false;
            _this.on.complete.fire();
          }, function(e) {
            var wasActive = _this.active;
            _this.active = false;
            _this.on.error.fire(e);
            _this.parent ? _this.parent._reject(e) : wasActive && _this.idbtrans && _this.idbtrans.abort();
            return rejection(e);
          });
        });
      }
      function createIndexSpec(name, keyPath, unique, multi, auto, compound, isPrimKey, type3) {
        return {
          name,
          keyPath,
          unique,
          multi,
          auto,
          compound,
          src: (unique && !isPrimKey ? "&" : "") + (multi ? "*" : "") + (auto ? "++" : "") + nameFromKeyPath(keyPath),
          type: type3
        };
      }
      function nameFromKeyPath(keyPath) {
        return typeof keyPath === "string" ? keyPath : keyPath ? "[" + [].join.call(keyPath, "+") + "]" : "";
      }
      function createTableSchema(name, primKey, indexes) {
        return {
          name,
          primKey,
          indexes,
          mappedClass: null,
          idxByName: arrayToObject(indexes, function(index) {
            return [index.name, index];
          })
        };
      }
      function safariMultiStoreFix(storeNames) {
        return storeNames.length === 1 ? storeNames[0] : storeNames;
      }
      var getMaxKey = function(IdbKeyRange) {
        try {
          IdbKeyRange.only([[]]);
          getMaxKey = function() {
            return [[]];
          };
          return [[]];
        } catch (e) {
          getMaxKey = function() {
            return maxString;
          };
          return maxString;
        }
      };
      function getKeyExtractor(keyPath) {
        if (keyPath == null) {
          return function() {
            return void 0;
          };
        } else if (typeof keyPath === "string") {
          return getSinglePathKeyExtractor(keyPath);
        } else {
          return function(obj) {
            return getByKeyPath(obj, keyPath);
          };
        }
      }
      function getSinglePathKeyExtractor(keyPath) {
        var split = keyPath.split(".");
        if (split.length === 1) {
          return function(obj) {
            return obj[keyPath];
          };
        } else {
          return function(obj) {
            return getByKeyPath(obj, keyPath);
          };
        }
      }
      function arrayify(arrayLike) {
        return [].slice.call(arrayLike);
      }
      var _id_counter = 0;
      function getKeyPathAlias(keyPath) {
        return keyPath == null ? ":id" : typeof keyPath === "string" ? keyPath : "[".concat(keyPath.join("+"), "]");
      }
      function createDBCore(db, IdbKeyRange, tmpTrans) {
        function extractSchema(db2, trans) {
          var tables2 = arrayify(db2.objectStoreNames);
          return {
            schema: {
              name: db2.name,
              tables: tables2.map(function(table) {
                return trans.objectStore(table);
              }).map(function(store) {
                var keyPath = store.keyPath, autoIncrement = store.autoIncrement;
                var compound = isArray(keyPath);
                var outbound = keyPath == null;
                var indexByKeyPath = {};
                var result = {
                  name: store.name,
                  primaryKey: {
                    name: null,
                    isPrimaryKey: true,
                    outbound,
                    compound,
                    keyPath,
                    autoIncrement,
                    unique: true,
                    extractKey: getKeyExtractor(keyPath)
                  },
                  indexes: arrayify(store.indexNames).map(function(indexName) {
                    return store.index(indexName);
                  }).map(function(index) {
                    var name = index.name, unique = index.unique, multiEntry = index.multiEntry, keyPath2 = index.keyPath;
                    var compound2 = isArray(keyPath2);
                    var result2 = {
                      name,
                      compound: compound2,
                      keyPath: keyPath2,
                      unique,
                      multiEntry,
                      extractKey: getKeyExtractor(keyPath2)
                    };
                    indexByKeyPath[getKeyPathAlias(keyPath2)] = result2;
                    return result2;
                  }),
                  getIndexByKeyPath: function(keyPath2) {
                    return indexByKeyPath[getKeyPathAlias(keyPath2)];
                  }
                };
                indexByKeyPath[":id"] = result.primaryKey;
                if (keyPath != null) {
                  indexByKeyPath[getKeyPathAlias(keyPath)] = result.primaryKey;
                }
                return result;
              })
            },
            hasGetAll: tables2.length > 0 && "getAll" in trans.objectStore(tables2[0]) && !(typeof navigator !== "undefined" && /Safari/.test(navigator.userAgent) && !/(Chrome\/|Edge\/)/.test(navigator.userAgent) && [].concat(navigator.userAgent.match(/Safari\/(\d*)/))[1] < 604)
          };
        }
        function makeIDBKeyRange(range) {
          if (range.type === 3)
            return null;
          if (range.type === 4)
            throw new Error("Cannot convert never type to IDBKeyRange");
          var lower = range.lower, upper = range.upper, lowerOpen = range.lowerOpen, upperOpen = range.upperOpen;
          var idbRange = lower === void 0 ? upper === void 0 ? null : IdbKeyRange.upperBound(upper, !!upperOpen) : upper === void 0 ? IdbKeyRange.lowerBound(lower, !!lowerOpen) : IdbKeyRange.bound(lower, upper, !!lowerOpen, !!upperOpen);
          return idbRange;
        }
        function createDbCoreTable(tableSchema) {
          var tableName = tableSchema.name;
          function mutate(_a3) {
            var trans = _a3.trans, type3 = _a3.type, keys2 = _a3.keys, values = _a3.values, range = _a3.range;
            return new Promise(function(resolve2, reject) {
              resolve2 = wrap(resolve2);
              var store = trans.objectStore(tableName);
              var outbound = store.keyPath == null;
              var isAddOrPut = type3 === "put" || type3 === "add";
              if (!isAddOrPut && type3 !== "delete" && type3 !== "deleteRange")
                throw new Error("Invalid operation type: " + type3);
              var length = (keys2 || values || { length: 1 }).length;
              if (keys2 && values && keys2.length !== values.length) {
                throw new Error("Given keys array must have same length as given values array.");
              }
              if (length === 0)
                return resolve2({ numFailures: 0, failures: {}, results: [], lastResult: void 0 });
              var req;
              var reqs = [];
              var failures = [];
              var numFailures = 0;
              var errorHandler = function(event) {
                ++numFailures;
                preventDefault(event);
              };
              if (type3 === "deleteRange") {
                if (range.type === 4)
                  return resolve2({ numFailures, failures, results: [], lastResult: void 0 });
                if (range.type === 3)
                  reqs.push(req = store.clear());
                else
                  reqs.push(req = store.delete(makeIDBKeyRange(range)));
              } else {
                var _a4 = isAddOrPut ? outbound ? [values, keys2] : [values, null] : [keys2, null], args1 = _a4[0], args2 = _a4[1];
                if (isAddOrPut) {
                  for (var i = 0; i < length; ++i) {
                    reqs.push(req = args2 && args2[i] !== void 0 ? store[type3](args1[i], args2[i]) : store[type3](args1[i]));
                    req.onerror = errorHandler;
                  }
                } else {
                  for (var i = 0; i < length; ++i) {
                    reqs.push(req = store[type3](args1[i]));
                    req.onerror = errorHandler;
                  }
                }
              }
              var done = function(event) {
                var lastResult = event.target.result;
                reqs.forEach(function(req2, i2) {
                  return req2.error != null && (failures[i2] = req2.error);
                });
                resolve2({
                  numFailures,
                  failures,
                  results: type3 === "delete" ? keys2 : reqs.map(function(req2) {
                    return req2.result;
                  }),
                  lastResult
                });
              };
              req.onerror = function(event) {
                errorHandler(event);
                done(event);
              };
              req.onsuccess = done;
            });
          }
          function openCursor2(_a3) {
            var trans = _a3.trans, values = _a3.values, query2 = _a3.query, reverse = _a3.reverse, unique = _a3.unique;
            return new Promise(function(resolve2, reject) {
              resolve2 = wrap(resolve2);
              var index = query2.index, range = query2.range;
              var store = trans.objectStore(tableName);
              var source = index.isPrimaryKey ? store : store.index(index.name);
              var direction = reverse ? unique ? "prevunique" : "prev" : unique ? "nextunique" : "next";
              var req = values || !("openKeyCursor" in source) ? source.openCursor(makeIDBKeyRange(range), direction) : source.openKeyCursor(makeIDBKeyRange(range), direction);
              req.onerror = eventRejectHandler(reject);
              req.onsuccess = wrap(function(ev) {
                var cursor = req.result;
                if (!cursor) {
                  resolve2(null);
                  return;
                }
                cursor.___id = ++_id_counter;
                cursor.done = false;
                var _cursorContinue = cursor.continue.bind(cursor);
                var _cursorContinuePrimaryKey = cursor.continuePrimaryKey;
                if (_cursorContinuePrimaryKey)
                  _cursorContinuePrimaryKey = _cursorContinuePrimaryKey.bind(cursor);
                var _cursorAdvance = cursor.advance.bind(cursor);
                var doThrowCursorIsNotStarted = function() {
                  throw new Error("Cursor not started");
                };
                var doThrowCursorIsStopped = function() {
                  throw new Error("Cursor not stopped");
                };
                cursor.trans = trans;
                cursor.stop = cursor.continue = cursor.continuePrimaryKey = cursor.advance = doThrowCursorIsNotStarted;
                cursor.fail = wrap(reject);
                cursor.next = function() {
                  var _this = this;
                  var gotOne = 1;
                  return this.start(function() {
                    return gotOne-- ? _this.continue() : _this.stop();
                  }).then(function() {
                    return _this;
                  });
                };
                cursor.start = function(callback) {
                  var iterationPromise = new Promise(function(resolveIteration, rejectIteration) {
                    resolveIteration = wrap(resolveIteration);
                    req.onerror = eventRejectHandler(rejectIteration);
                    cursor.fail = rejectIteration;
                    cursor.stop = function(value) {
                      cursor.stop = cursor.continue = cursor.continuePrimaryKey = cursor.advance = doThrowCursorIsStopped;
                      resolveIteration(value);
                    };
                  });
                  var guardedCallback = function() {
                    if (req.result) {
                      try {
                        callback();
                      } catch (err) {
                        cursor.fail(err);
                      }
                    } else {
                      cursor.done = true;
                      cursor.start = function() {
                        throw new Error("Cursor behind last entry");
                      };
                      cursor.stop();
                    }
                  };
                  req.onsuccess = wrap(function(ev2) {
                    req.onsuccess = guardedCallback;
                    guardedCallback();
                  });
                  cursor.continue = _cursorContinue;
                  cursor.continuePrimaryKey = _cursorContinuePrimaryKey;
                  cursor.advance = _cursorAdvance;
                  guardedCallback();
                  return iterationPromise;
                };
                resolve2(cursor);
              }, reject);
            });
          }
          function query(hasGetAll2) {
            return function(request) {
              return new Promise(function(resolve2, reject) {
                resolve2 = wrap(resolve2);
                var trans = request.trans, values = request.values, limit = request.limit, query2 = request.query;
                var nonInfinitLimit = limit === Infinity ? void 0 : limit;
                var index = query2.index, range = query2.range;
                var store = trans.objectStore(tableName);
                var source = index.isPrimaryKey ? store : store.index(index.name);
                var idbKeyRange = makeIDBKeyRange(range);
                if (limit === 0)
                  return resolve2({ result: [] });
                if (hasGetAll2) {
                  var req = values ? source.getAll(idbKeyRange, nonInfinitLimit) : source.getAllKeys(idbKeyRange, nonInfinitLimit);
                  req.onsuccess = function(event) {
                    return resolve2({ result: event.target.result });
                  };
                  req.onerror = eventRejectHandler(reject);
                } else {
                  var count_1 = 0;
                  var req_1 = values || !("openKeyCursor" in source) ? source.openCursor(idbKeyRange) : source.openKeyCursor(idbKeyRange);
                  var result_1 = [];
                  req_1.onsuccess = function(event) {
                    var cursor = req_1.result;
                    if (!cursor)
                      return resolve2({ result: result_1 });
                    result_1.push(values ? cursor.value : cursor.primaryKey);
                    if (++count_1 === limit)
                      return resolve2({ result: result_1 });
                    cursor.continue();
                  };
                  req_1.onerror = eventRejectHandler(reject);
                }
              });
            };
          }
          return {
            name: tableName,
            schema: tableSchema,
            mutate,
            getMany: function(_a3) {
              var trans = _a3.trans, keys2 = _a3.keys;
              return new Promise(function(resolve2, reject) {
                resolve2 = wrap(resolve2);
                var store = trans.objectStore(tableName);
                var length = keys2.length;
                var result = new Array(length);
                var keyCount = 0;
                var callbackCount = 0;
                var req;
                var successHandler = function(event) {
                  var req2 = event.target;
                  if ((result[req2._pos] = req2.result) != null)
                    ;
                  if (++callbackCount === keyCount)
                    resolve2(result);
                };
                var errorHandler = eventRejectHandler(reject);
                for (var i = 0; i < length; ++i) {
                  var key = keys2[i];
                  if (key != null) {
                    req = store.get(keys2[i]);
                    req._pos = i;
                    req.onsuccess = successHandler;
                    req.onerror = errorHandler;
                    ++keyCount;
                  }
                }
                if (keyCount === 0)
                  resolve2(result);
              });
            },
            get: function(_a3) {
              var trans = _a3.trans, key = _a3.key;
              return new Promise(function(resolve2, reject) {
                resolve2 = wrap(resolve2);
                var store = trans.objectStore(tableName);
                var req = store.get(key);
                req.onsuccess = function(event) {
                  return resolve2(event.target.result);
                };
                req.onerror = eventRejectHandler(reject);
              });
            },
            query: query(hasGetAll),
            openCursor: openCursor2,
            count: function(_a3) {
              var query2 = _a3.query, trans = _a3.trans;
              var index = query2.index, range = query2.range;
              return new Promise(function(resolve2, reject) {
                var store = trans.objectStore(tableName);
                var source = index.isPrimaryKey ? store : store.index(index.name);
                var idbKeyRange = makeIDBKeyRange(range);
                var req = idbKeyRange ? source.count(idbKeyRange) : source.count();
                req.onsuccess = wrap(function(ev) {
                  return resolve2(ev.target.result);
                });
                req.onerror = eventRejectHandler(reject);
              });
            }
          };
        }
        var _a2 = extractSchema(db, tmpTrans), schema2 = _a2.schema, hasGetAll = _a2.hasGetAll;
        var tables = schema2.tables.map(function(tableSchema) {
          return createDbCoreTable(tableSchema);
        });
        var tableMap = {};
        tables.forEach(function(table) {
          return tableMap[table.name] = table;
        });
        return {
          stack: "dbcore",
          transaction: db.transaction.bind(db),
          table: function(name) {
            var result = tableMap[name];
            if (!result)
              throw new Error("Table '".concat(name, "' not found"));
            return tableMap[name];
          },
          MIN_KEY: -Infinity,
          MAX_KEY: getMaxKey(IdbKeyRange),
          schema: schema2
        };
      }
      function createMiddlewareStack(stackImpl, middlewares) {
        return middlewares.reduce(function(down, _a2) {
          var create = _a2.create;
          return __assign(__assign({}, down), create(down));
        }, stackImpl);
      }
      function createMiddlewareStacks(middlewares, idbdb, _a2, tmpTrans) {
        var IDBKeyRange2 = _a2.IDBKeyRange;
        _a2.indexedDB;
        var dbcore = createMiddlewareStack(createDBCore(idbdb, IDBKeyRange2, tmpTrans), middlewares.dbcore);
        return {
          dbcore
        };
      }
      function generateMiddlewareStacks(db, tmpTrans) {
        var idbdb = tmpTrans.db;
        var stacks = createMiddlewareStacks(db._middlewares, idbdb, db._deps, tmpTrans);
        db.core = stacks.dbcore;
        db.tables.forEach(function(table) {
          var tableName = table.name;
          if (db.core.schema.tables.some(function(tbl) {
            return tbl.name === tableName;
          })) {
            table.core = db.core.table(tableName);
            if (db[tableName] instanceof db.Table) {
              db[tableName].core = table.core;
            }
          }
        });
      }
      function setApiOnPlace(db, objs, tableNames, dbschema) {
        tableNames.forEach(function(tableName) {
          var schema2 = dbschema[tableName];
          objs.forEach(function(obj) {
            var propDesc = getPropertyDescriptor(obj, tableName);
            if (!propDesc || "value" in propDesc && propDesc.value === void 0) {
              if (obj === db.Transaction.prototype || obj instanceof db.Transaction) {
                setProp(obj, tableName, {
                  get: function() {
                    return this.table(tableName);
                  },
                  set: function(value) {
                    defineProperty(this, tableName, { value, writable: true, configurable: true, enumerable: true });
                  }
                });
              } else {
                obj[tableName] = new db.Table(tableName, schema2);
              }
            }
          });
        });
      }
      function removeTablesApi(db, objs) {
        objs.forEach(function(obj) {
          for (var key in obj) {
            if (obj[key] instanceof db.Table)
              delete obj[key];
          }
        });
      }
      function lowerVersionFirst(a, b) {
        return a._cfg.version - b._cfg.version;
      }
      function runUpgraders(db, oldVersion, idbUpgradeTrans, reject) {
        var globalSchema = db._dbSchema;
        if (idbUpgradeTrans.objectStoreNames.contains("$meta") && !globalSchema.$meta) {
          globalSchema.$meta = createTableSchema("$meta", parseIndexSyntax("")[0], []);
          db._storeNames.push("$meta");
        }
        var trans = db._createTransaction("readwrite", db._storeNames, globalSchema);
        trans.create(idbUpgradeTrans);
        trans._completion.catch(reject);
        var rejectTransaction = trans._reject.bind(trans);
        var transless = PSD.transless || PSD;
        newScope(function() {
          PSD.trans = trans;
          PSD.transless = transless;
          if (oldVersion === 0) {
            keys(globalSchema).forEach(function(tableName) {
              createTable(idbUpgradeTrans, tableName, globalSchema[tableName].primKey, globalSchema[tableName].indexes);
            });
            generateMiddlewareStacks(db, idbUpgradeTrans);
            DexiePromise.follow(function() {
              return db.on.populate.fire(trans);
            }).catch(rejectTransaction);
          } else {
            generateMiddlewareStacks(db, idbUpgradeTrans);
            return getExistingVersion(db, trans, oldVersion).then(function(oldVersion2) {
              return updateTablesAndIndexes(db, oldVersion2, trans, idbUpgradeTrans);
            }).catch(rejectTransaction);
          }
        });
      }
      function patchCurrentVersion(db, idbUpgradeTrans) {
        createMissingTables(db._dbSchema, idbUpgradeTrans);
        if (idbUpgradeTrans.db.version % 10 === 0 && !idbUpgradeTrans.objectStoreNames.contains("$meta")) {
          idbUpgradeTrans.db.createObjectStore("$meta").add(Math.ceil(idbUpgradeTrans.db.version / 10 - 1), "version");
        }
        var globalSchema = buildGlobalSchema(db, db.idbdb, idbUpgradeTrans);
        adjustToExistingIndexNames(db, db._dbSchema, idbUpgradeTrans);
        var diff = getSchemaDiff(globalSchema, db._dbSchema);
        var _loop_1 = function(tableChange2) {
          if (tableChange2.change.length || tableChange2.recreate) {
            console.warn("Unable to patch indexes of table ".concat(tableChange2.name, " because it has changes on the type of index or primary key."));
            return { value: void 0 };
          }
          var store = idbUpgradeTrans.objectStore(tableChange2.name);
          tableChange2.add.forEach(function(idx) {
            if (debug)
              console.debug("Dexie upgrade patch: Creating missing index ".concat(tableChange2.name, ".").concat(idx.src));
            addIndex(store, idx);
          });
        };
        for (var _i = 0, _a2 = diff.change; _i < _a2.length; _i++) {
          var tableChange = _a2[_i];
          var state_1 = _loop_1(tableChange);
          if (typeof state_1 === "object")
            return state_1.value;
        }
      }
      function getExistingVersion(db, trans, oldVersion) {
        if (trans.storeNames.includes("$meta")) {
          return trans.table("$meta").get("version").then(function(metaVersion) {
            return metaVersion != null ? metaVersion : oldVersion;
          });
        } else {
          return DexiePromise.resolve(oldVersion);
        }
      }
      function updateTablesAndIndexes(db, oldVersion, trans, idbUpgradeTrans) {
        var queue = [];
        var versions = db._versions;
        var globalSchema = db._dbSchema = buildGlobalSchema(db, db.idbdb, idbUpgradeTrans);
        var versToRun = versions.filter(function(v) {
          return v._cfg.version >= oldVersion;
        });
        if (versToRun.length === 0) {
          return DexiePromise.resolve();
        }
        versToRun.forEach(function(version) {
          queue.push(function() {
            var oldSchema = globalSchema;
            var newSchema = version._cfg.dbschema;
            adjustToExistingIndexNames(db, oldSchema, idbUpgradeTrans);
            adjustToExistingIndexNames(db, newSchema, idbUpgradeTrans);
            globalSchema = db._dbSchema = newSchema;
            var diff = getSchemaDiff(oldSchema, newSchema);
            diff.add.forEach(function(tuple) {
              createTable(idbUpgradeTrans, tuple[0], tuple[1].primKey, tuple[1].indexes);
            });
            diff.change.forEach(function(change) {
              if (change.recreate) {
                throw new exceptions.Upgrade("Not yet support for changing primary key");
              } else {
                var store_1 = idbUpgradeTrans.objectStore(change.name);
                change.add.forEach(function(idx) {
                  return addIndex(store_1, idx);
                });
                change.change.forEach(function(idx) {
                  store_1.deleteIndex(idx.name);
                  addIndex(store_1, idx);
                });
                change.del.forEach(function(idxName) {
                  return store_1.deleteIndex(idxName);
                });
              }
            });
            var contentUpgrade = version._cfg.contentUpgrade;
            if (contentUpgrade && version._cfg.version > oldVersion) {
              generateMiddlewareStacks(db, idbUpgradeTrans);
              trans._memoizedTables = {};
              var upgradeSchema_1 = shallowClone(newSchema);
              diff.del.forEach(function(table) {
                upgradeSchema_1[table] = oldSchema[table];
              });
              removeTablesApi(db, [db.Transaction.prototype]);
              setApiOnPlace(db, [db.Transaction.prototype], keys(upgradeSchema_1), upgradeSchema_1);
              trans.schema = upgradeSchema_1;
              var contentUpgradeIsAsync_1 = isAsyncFunction(contentUpgrade);
              if (contentUpgradeIsAsync_1) {
                incrementExpectedAwaits();
              }
              var returnValue_1;
              var promiseFollowed = DexiePromise.follow(function() {
                returnValue_1 = contentUpgrade(trans);
                if (returnValue_1) {
                  if (contentUpgradeIsAsync_1) {
                    var decrementor = decrementExpectedAwaits.bind(null, null);
                    returnValue_1.then(decrementor, decrementor);
                  }
                }
              });
              return returnValue_1 && typeof returnValue_1.then === "function" ? DexiePromise.resolve(returnValue_1) : promiseFollowed.then(function() {
                return returnValue_1;
              });
            }
          });
          queue.push(function(idbtrans) {
            var newSchema = version._cfg.dbschema;
            deleteRemovedTables(newSchema, idbtrans);
            removeTablesApi(db, [db.Transaction.prototype]);
            setApiOnPlace(db, [db.Transaction.prototype], db._storeNames, db._dbSchema);
            trans.schema = db._dbSchema;
          });
          queue.push(function(idbtrans) {
            if (db.idbdb.objectStoreNames.contains("$meta")) {
              if (Math.ceil(db.idbdb.version / 10) === version._cfg.version) {
                db.idbdb.deleteObjectStore("$meta");
                delete db._dbSchema.$meta;
                db._storeNames = db._storeNames.filter(function(name) {
                  return name !== "$meta";
                });
              } else {
                idbtrans.objectStore("$meta").put(version._cfg.version, "version");
              }
            }
          });
        });
        function runQueue() {
          return queue.length ? DexiePromise.resolve(queue.shift()(trans.idbtrans)).then(runQueue) : DexiePromise.resolve();
        }
        return runQueue().then(function() {
          createMissingTables(globalSchema, idbUpgradeTrans);
        });
      }
      function getSchemaDiff(oldSchema, newSchema) {
        var diff = {
          del: [],
          add: [],
          change: []
        };
        var table;
        for (table in oldSchema) {
          if (!newSchema[table])
            diff.del.push(table);
        }
        for (table in newSchema) {
          var oldDef = oldSchema[table], newDef = newSchema[table];
          if (!oldDef) {
            diff.add.push([table, newDef]);
          } else {
            var change = {
              name: table,
              def: newDef,
              recreate: false,
              del: [],
              add: [],
              change: []
            };
            if ("" + (oldDef.primKey.keyPath || "") !== "" + (newDef.primKey.keyPath || "") || oldDef.primKey.auto !== newDef.primKey.auto) {
              change.recreate = true;
              diff.change.push(change);
            } else {
              var oldIndexes = oldDef.idxByName;
              var newIndexes = newDef.idxByName;
              var idxName = void 0;
              for (idxName in oldIndexes) {
                if (!newIndexes[idxName])
                  change.del.push(idxName);
              }
              for (idxName in newIndexes) {
                var oldIdx = oldIndexes[idxName], newIdx = newIndexes[idxName];
                if (!oldIdx)
                  change.add.push(newIdx);
                else if (oldIdx.src !== newIdx.src)
                  change.change.push(newIdx);
              }
              if (change.del.length > 0 || change.add.length > 0 || change.change.length > 0) {
                diff.change.push(change);
              }
            }
          }
        }
        return diff;
      }
      function createTable(idbtrans, tableName, primKey, indexes) {
        var store = idbtrans.db.createObjectStore(tableName, primKey.keyPath ? { keyPath: primKey.keyPath, autoIncrement: primKey.auto } : { autoIncrement: primKey.auto });
        indexes.forEach(function(idx) {
          return addIndex(store, idx);
        });
        return store;
      }
      function createMissingTables(newSchema, idbtrans) {
        keys(newSchema).forEach(function(tableName) {
          if (!idbtrans.db.objectStoreNames.contains(tableName)) {
            if (debug)
              console.debug("Dexie: Creating missing table", tableName);
            createTable(idbtrans, tableName, newSchema[tableName].primKey, newSchema[tableName].indexes);
          }
        });
      }
      function deleteRemovedTables(newSchema, idbtrans) {
        [].slice.call(idbtrans.db.objectStoreNames).forEach(function(storeName) {
          return newSchema[storeName] == null && idbtrans.db.deleteObjectStore(storeName);
        });
      }
      function addIndex(store, idx) {
        store.createIndex(idx.name, idx.keyPath, { unique: idx.unique, multiEntry: idx.multi });
      }
      function buildGlobalSchema(db, idbdb, tmpTrans) {
        var globalSchema = {};
        var dbStoreNames = slice(idbdb.objectStoreNames, 0);
        dbStoreNames.forEach(function(storeName) {
          var store = tmpTrans.objectStore(storeName);
          var keyPath = store.keyPath;
          var primKey = createIndexSpec(nameFromKeyPath(keyPath), keyPath || "", true, false, !!store.autoIncrement, keyPath && typeof keyPath !== "string", true);
          var indexes = [];
          for (var j = 0; j < store.indexNames.length; ++j) {
            var idbindex = store.index(store.indexNames[j]);
            keyPath = idbindex.keyPath;
            var index = createIndexSpec(idbindex.name, keyPath, !!idbindex.unique, !!idbindex.multiEntry, false, keyPath && typeof keyPath !== "string", false);
            indexes.push(index);
          }
          globalSchema[storeName] = createTableSchema(storeName, primKey, indexes);
        });
        return globalSchema;
      }
      function readGlobalSchema(db, idbdb, tmpTrans) {
        db.verno = idbdb.version / 10;
        var globalSchema = db._dbSchema = buildGlobalSchema(db, idbdb, tmpTrans);
        db._storeNames = slice(idbdb.objectStoreNames, 0);
        setApiOnPlace(db, [db._allTables], keys(globalSchema), globalSchema);
      }
      function verifyInstalledSchema(db, tmpTrans) {
        var installedSchema = buildGlobalSchema(db, db.idbdb, tmpTrans);
        var diff = getSchemaDiff(installedSchema, db._dbSchema);
        return !(diff.add.length || diff.change.some(function(ch) {
          return ch.add.length || ch.change.length;
        }));
      }
      function adjustToExistingIndexNames(db, schema2, idbtrans) {
        var storeNames = idbtrans.db.objectStoreNames;
        for (var i = 0; i < storeNames.length; ++i) {
          var storeName = storeNames[i];
          var store = idbtrans.objectStore(storeName);
          db._hasGetAll = "getAll" in store;
          for (var j = 0; j < store.indexNames.length; ++j) {
            var indexName = store.indexNames[j];
            var keyPath = store.index(indexName).keyPath;
            var dexieName = typeof keyPath === "string" ? keyPath : "[" + slice(keyPath).join("+") + "]";
            if (schema2[storeName]) {
              var indexSpec = schema2[storeName].idxByName[dexieName];
              if (indexSpec) {
                indexSpec.name = indexName;
                delete schema2[storeName].idxByName[dexieName];
                schema2[storeName].idxByName[indexName] = indexSpec;
              }
            }
          }
        }
        if (typeof navigator !== "undefined" && /Safari/.test(navigator.userAgent) && !/(Chrome\/|Edge\/)/.test(navigator.userAgent) && _global.WorkerGlobalScope && _global instanceof _global.WorkerGlobalScope && [].concat(navigator.userAgent.match(/Safari\/(\d*)/))[1] < 604) {
          db._hasGetAll = false;
        }
      }
      function parseIndexSyntax(primKeyAndIndexes) {
        return primKeyAndIndexes.split(",").map(function(index, indexNum) {
          var _a2;
          var typeSplit = index.split(":");
          var type3 = (_a2 = typeSplit[1]) === null || _a2 === void 0 ? void 0 : _a2.trim();
          index = typeSplit[0].trim();
          var name = index.replace(/([&*]|\+\+)/g, "");
          var keyPath = /^\[/.test(name) ? name.match(/^\[(.*)\]$/)[1].split("+") : name;
          return createIndexSpec(name, keyPath || null, /\&/.test(index), /\*/.test(index), /\+\+/.test(index), isArray(keyPath), indexNum === 0, type3);
        });
      }
      var Version = (function() {
        function Version2() {
        }
        Version2.prototype._createTableSchema = function(name, primKey, indexes) {
          return createTableSchema(name, primKey, indexes);
        };
        Version2.prototype._parseIndexSyntax = function(primKeyAndIndexes) {
          return parseIndexSyntax(primKeyAndIndexes);
        };
        Version2.prototype._parseStoresSpec = function(stores, outSchema) {
          var _this = this;
          keys(stores).forEach(function(tableName) {
            if (stores[tableName] !== null) {
              var indexes = _this._parseIndexSyntax(stores[tableName]);
              var primKey = indexes.shift();
              if (!primKey) {
                throw new exceptions.Schema("Invalid schema for table " + tableName + ": " + stores[tableName]);
              }
              primKey.unique = true;
              if (primKey.multi)
                throw new exceptions.Schema("Primary key cannot be multiEntry*");
              indexes.forEach(function(idx) {
                if (idx.auto)
                  throw new exceptions.Schema("Only primary key can be marked as autoIncrement (++)");
                if (!idx.keyPath)
                  throw new exceptions.Schema("Index must have a name and cannot be an empty string");
              });
              var tblSchema = _this._createTableSchema(tableName, primKey, indexes);
              outSchema[tableName] = tblSchema;
            }
          });
        };
        Version2.prototype.stores = function(stores) {
          var db = this.db;
          this._cfg.storesSource = this._cfg.storesSource ? extend3(this._cfg.storesSource, stores) : stores;
          var versions = db._versions;
          var storesSpec = {};
          var dbschema = {};
          versions.forEach(function(version) {
            extend3(storesSpec, version._cfg.storesSource);
            dbschema = version._cfg.dbschema = {};
            version._parseStoresSpec(storesSpec, dbschema);
          });
          db._dbSchema = dbschema;
          removeTablesApi(db, [db._allTables, db, db.Transaction.prototype]);
          setApiOnPlace(db, [db._allTables, db, db.Transaction.prototype, this._cfg.tables], keys(dbschema), dbschema);
          db._storeNames = keys(dbschema);
          return this;
        };
        Version2.prototype.upgrade = function(upgradeFunction) {
          this._cfg.contentUpgrade = promisableChain(this._cfg.contentUpgrade || nop, upgradeFunction);
          return this;
        };
        return Version2;
      })();
      function createVersionConstructor(db) {
        return makeClassConstructor(Version.prototype, function Version2(versionNumber) {
          this.db = db;
          this._cfg = {
            version: versionNumber,
            storesSource: null,
            dbschema: {},
            tables: {},
            contentUpgrade: null
          };
        });
      }
      function getDbNamesTable(indexedDB2, IDBKeyRange2) {
        var dbNamesDB = indexedDB2["_dbNamesDB"];
        if (!dbNamesDB) {
          dbNamesDB = indexedDB2["_dbNamesDB"] = new Dexie$1(DBNAMES_DB, {
            addons: [],
            indexedDB: indexedDB2,
            IDBKeyRange: IDBKeyRange2
          });
          dbNamesDB.version(1).stores({ dbnames: "name" });
        }
        return dbNamesDB.table("dbnames");
      }
      function hasDatabasesNative(indexedDB2) {
        return indexedDB2 && typeof indexedDB2.databases === "function";
      }
      function getDatabaseNames(_a2) {
        var indexedDB2 = _a2.indexedDB, IDBKeyRange2 = _a2.IDBKeyRange;
        return hasDatabasesNative(indexedDB2) ? Promise.resolve(indexedDB2.databases()).then(function(infos) {
          return infos.map(function(info) {
            return info.name;
          }).filter(function(name) {
            return name !== DBNAMES_DB;
          });
        }) : getDbNamesTable(indexedDB2, IDBKeyRange2).toCollection().primaryKeys();
      }
      function _onDatabaseCreated(_a2, name) {
        var indexedDB2 = _a2.indexedDB, IDBKeyRange2 = _a2.IDBKeyRange;
        !hasDatabasesNative(indexedDB2) && name !== DBNAMES_DB && getDbNamesTable(indexedDB2, IDBKeyRange2).put({ name }).catch(nop);
      }
      function _onDatabaseDeleted(_a2, name) {
        var indexedDB2 = _a2.indexedDB, IDBKeyRange2 = _a2.IDBKeyRange;
        !hasDatabasesNative(indexedDB2) && name !== DBNAMES_DB && getDbNamesTable(indexedDB2, IDBKeyRange2).delete(name).catch(nop);
      }
      function vip(fn) {
        return newScope(function() {
          PSD.letThrough = true;
          return fn();
        });
      }
      function idbReady() {
        var isSafari = !navigator.userAgentData && /Safari\//.test(navigator.userAgent) && !/Chrom(e|ium)\//.test(navigator.userAgent);
        if (!isSafari || !indexedDB.databases)
          return Promise.resolve();
        var intervalId;
        return new Promise(function(resolve2) {
          var tryIdb = function() {
            return indexedDB.databases().finally(resolve2);
          };
          intervalId = setInterval(tryIdb, 100);
          tryIdb();
        }).finally(function() {
          return clearInterval(intervalId);
        });
      }
      var _a;
      function isEmptyRange(node) {
        return !("from" in node);
      }
      var RangeSet2 = function(fromOrTree, to) {
        if (this) {
          extend3(this, arguments.length ? { d: 1, from: fromOrTree, to: arguments.length > 1 ? to : fromOrTree } : { d: 0 });
        } else {
          var rv = new RangeSet2();
          if (fromOrTree && "d" in fromOrTree) {
            extend3(rv, fromOrTree);
          }
          return rv;
        }
      };
      props(RangeSet2.prototype, (_a = {
        add: function(rangeSet) {
          mergeRanges2(this, rangeSet);
          return this;
        },
        addKey: function(key) {
          addRange(this, key, key);
          return this;
        },
        addKeys: function(keys2) {
          var _this = this;
          keys2.forEach(function(key) {
            return addRange(_this, key, key);
          });
          return this;
        },
        hasKey: function(key) {
          var node = getRangeSetIterator(this).next(key).value;
          return node && cmp3(node.from, key) <= 0 && cmp3(node.to, key) >= 0;
        }
      }, _a[iteratorSymbol] = function() {
        return getRangeSetIterator(this);
      }, _a));
      function addRange(target, from, to) {
        var diff = cmp3(from, to);
        if (isNaN(diff))
          return;
        if (diff > 0)
          throw RangeError();
        if (isEmptyRange(target))
          return extend3(target, { from, to, d: 1 });
        var left = target.l;
        var right = target.r;
        if (cmp3(to, target.from) < 0) {
          left ? addRange(left, from, to) : target.l = { from, to, d: 1, l: null, r: null };
          return rebalance(target);
        }
        if (cmp3(from, target.to) > 0) {
          right ? addRange(right, from, to) : target.r = { from, to, d: 1, l: null, r: null };
          return rebalance(target);
        }
        if (cmp3(from, target.from) < 0) {
          target.from = from;
          target.l = null;
          target.d = right ? right.d + 1 : 1;
        }
        if (cmp3(to, target.to) > 0) {
          target.to = to;
          target.r = null;
          target.d = target.l ? target.l.d + 1 : 1;
        }
        var rightWasCutOff = !target.r;
        if (left && !target.l) {
          mergeRanges2(target, left);
        }
        if (right && rightWasCutOff) {
          mergeRanges2(target, right);
        }
      }
      function mergeRanges2(target, newSet) {
        function _addRangeSet(target2, _a2) {
          var from = _a2.from, to = _a2.to, l = _a2.l, r = _a2.r;
          addRange(target2, from, to);
          if (l)
            _addRangeSet(target2, l);
          if (r)
            _addRangeSet(target2, r);
        }
        if (!isEmptyRange(newSet))
          _addRangeSet(target, newSet);
      }
      function rangesOverlap2(rangeSet1, rangeSet2) {
        var i1 = getRangeSetIterator(rangeSet2);
        var nextResult1 = i1.next();
        if (nextResult1.done)
          return false;
        var a = nextResult1.value;
        var i2 = getRangeSetIterator(rangeSet1);
        var nextResult2 = i2.next(a.from);
        var b = nextResult2.value;
        while (!nextResult1.done && !nextResult2.done) {
          if (cmp3(b.from, a.to) <= 0 && cmp3(b.to, a.from) >= 0)
            return true;
          cmp3(a.from, b.from) < 0 ? a = (nextResult1 = i1.next(b.from)).value : b = (nextResult2 = i2.next(a.from)).value;
        }
        return false;
      }
      function getRangeSetIterator(node) {
        var state = isEmptyRange(node) ? null : { s: 0, n: node };
        return {
          next: function(key) {
            var keyProvided = arguments.length > 0;
            while (state) {
              switch (state.s) {
                case 0:
                  state.s = 1;
                  if (keyProvided) {
                    while (state.n.l && cmp3(key, state.n.from) < 0)
                      state = { up: state, n: state.n.l, s: 1 };
                  } else {
                    while (state.n.l)
                      state = { up: state, n: state.n.l, s: 1 };
                  }
                case 1:
                  state.s = 2;
                  if (!keyProvided || cmp3(key, state.n.to) <= 0)
                    return { value: state.n, done: false };
                case 2:
                  if (state.n.r) {
                    state.s = 3;
                    state = { up: state, n: state.n.r, s: 0 };
                    continue;
                  }
                case 3:
                  state = state.up;
              }
            }
            return { done: true };
          }
        };
      }
      function rebalance(target) {
        var _a2, _b;
        var diff = (((_a2 = target.r) === null || _a2 === void 0 ? void 0 : _a2.d) || 0) - (((_b = target.l) === null || _b === void 0 ? void 0 : _b.d) || 0);
        var r = diff > 1 ? "r" : diff < -1 ? "l" : "";
        if (r) {
          var l = r === "r" ? "l" : "r";
          var rootClone = __assign({}, target);
          var oldRootRight = target[r];
          target.from = oldRootRight.from;
          target.to = oldRootRight.to;
          target[r] = oldRootRight[r];
          rootClone[r] = oldRootRight[l];
          target[l] = rootClone;
          rootClone.d = computeDepth(rootClone);
        }
        target.d = computeDepth(target);
      }
      function computeDepth(_a2) {
        var r = _a2.r, l = _a2.l;
        return (r ? l ? Math.max(r.d, l.d) : r.d : l ? l.d : 0) + 1;
      }
      function extendObservabilitySet(target, newSet) {
        keys(newSet).forEach(function(part) {
          if (target[part])
            mergeRanges2(target[part], newSet[part]);
          else
            target[part] = cloneSimpleObjectTree(newSet[part]);
        });
        return target;
      }
      function obsSetsOverlap(os1, os2) {
        return os1.all || os2.all || Object.keys(os1).some(function(key) {
          return os2[key] && rangesOverlap2(os2[key], os1[key]);
        });
      }
      var cache = {};
      var unsignaledParts = {};
      var isTaskEnqueued = false;
      function signalSubscribersLazily(part, optimistic) {
        extendObservabilitySet(unsignaledParts, part);
        if (!isTaskEnqueued) {
          isTaskEnqueued = true;
          setTimeout(function() {
            isTaskEnqueued = false;
            var parts = unsignaledParts;
            unsignaledParts = {};
            signalSubscribersNow(parts, false);
          }, 0);
        }
      }
      function signalSubscribersNow(updatedParts, deleteAffectedCacheEntries) {
        if (deleteAffectedCacheEntries === void 0) {
          deleteAffectedCacheEntries = false;
        }
        var queriesToSignal = /* @__PURE__ */ new Set();
        if (updatedParts.all) {
          for (var _i = 0, _a2 = Object.values(cache); _i < _a2.length; _i++) {
            var tblCache = _a2[_i];
            collectTableSubscribers(tblCache, updatedParts, queriesToSignal, deleteAffectedCacheEntries);
          }
        } else {
          for (var key in updatedParts) {
            var parts = /^idb\:\/\/(.*)\/(.*)\//.exec(key);
            if (parts) {
              var dbName = parts[1], tableName = parts[2];
              var tblCache = cache["idb://".concat(dbName, "/").concat(tableName)];
              if (tblCache)
                collectTableSubscribers(tblCache, updatedParts, queriesToSignal, deleteAffectedCacheEntries);
            }
          }
        }
        queriesToSignal.forEach(function(requery) {
          return requery();
        });
      }
      function collectTableSubscribers(tblCache, updatedParts, outQueriesToSignal, deleteAffectedCacheEntries) {
        var updatedEntryLists = [];
        for (var _i = 0, _a2 = Object.entries(tblCache.queries.query); _i < _a2.length; _i++) {
          var _b = _a2[_i], indexName = _b[0], entries = _b[1];
          var filteredEntries = [];
          for (var _c = 0, entries_1 = entries; _c < entries_1.length; _c++) {
            var entry = entries_1[_c];
            if (obsSetsOverlap(updatedParts, entry.obsSet)) {
              entry.subscribers.forEach(function(requery) {
                return outQueriesToSignal.add(requery);
              });
            } else if (deleteAffectedCacheEntries) {
              filteredEntries.push(entry);
            }
          }
          if (deleteAffectedCacheEntries)
            updatedEntryLists.push([indexName, filteredEntries]);
        }
        if (deleteAffectedCacheEntries) {
          for (var _d = 0, updatedEntryLists_1 = updatedEntryLists; _d < updatedEntryLists_1.length; _d++) {
            var _e = updatedEntryLists_1[_d], indexName = _e[0], filteredEntries = _e[1];
            tblCache.queries.query[indexName] = filteredEntries;
          }
        }
      }
      function dexieOpen(db) {
        var state = db._state;
        var indexedDB2 = db._deps.indexedDB;
        if (state.isBeingOpened || db.idbdb)
          return state.dbReadyPromise.then(function() {
            return state.dbOpenError ? rejection(state.dbOpenError) : db;
          });
        state.isBeingOpened = true;
        state.dbOpenError = null;
        state.openComplete = false;
        var openCanceller = state.openCanceller;
        var nativeVerToOpen = Math.round(db.verno * 10);
        var schemaPatchMode = false;
        function throwIfCancelled() {
          if (state.openCanceller !== openCanceller)
            throw new exceptions.DatabaseClosed("db.open() was cancelled");
        }
        var resolveDbReady = state.dbReadyResolve, upgradeTransaction = null, wasCreated = false;
        var tryOpenDB = function() {
          return new DexiePromise(function(resolve2, reject) {
            throwIfCancelled();
            if (!indexedDB2)
              throw new exceptions.MissingAPI();
            var dbName = db.name;
            var req = state.autoSchema || !nativeVerToOpen ? indexedDB2.open(dbName) : indexedDB2.open(dbName, nativeVerToOpen);
            if (!req)
              throw new exceptions.MissingAPI();
            req.onerror = eventRejectHandler(reject);
            req.onblocked = wrap(db._fireOnBlocked);
            req.onupgradeneeded = wrap(function(e) {
              upgradeTransaction = req.transaction;
              if (state.autoSchema && !db._options.allowEmptyDB) {
                req.onerror = preventDefault;
                upgradeTransaction.abort();
                req.result.close();
                var delreq = indexedDB2.deleteDatabase(dbName);
                delreq.onsuccess = delreq.onerror = wrap(function() {
                  reject(new exceptions.NoSuchDatabase("Database ".concat(dbName, " doesnt exist")));
                });
              } else {
                upgradeTransaction.onerror = eventRejectHandler(reject);
                var oldVer = e.oldVersion > Math.pow(2, 62) ? 0 : e.oldVersion;
                wasCreated = oldVer < 1;
                db.idbdb = req.result;
                if (schemaPatchMode) {
                  patchCurrentVersion(db, upgradeTransaction);
                }
                runUpgraders(db, oldVer / 10, upgradeTransaction, reject);
              }
            }, reject);
            req.onsuccess = wrap(function() {
              upgradeTransaction = null;
              var idbdb = db.idbdb = req.result;
              var objectStoreNames = slice(idbdb.objectStoreNames);
              if (objectStoreNames.length > 0)
                try {
                  var tmpTrans = idbdb.transaction(safariMultiStoreFix(objectStoreNames), "readonly");
                  if (state.autoSchema)
                    readGlobalSchema(db, idbdb, tmpTrans);
                  else {
                    adjustToExistingIndexNames(db, db._dbSchema, tmpTrans);
                    if (!verifyInstalledSchema(db, tmpTrans) && !schemaPatchMode) {
                      console.warn("Dexie SchemaDiff: Schema was extended without increasing the number passed to db.version(). Dexie will add missing parts and increment native version number to workaround this.");
                      idbdb.close();
                      nativeVerToOpen = idbdb.version + 1;
                      schemaPatchMode = true;
                      return resolve2(tryOpenDB());
                    }
                  }
                  generateMiddlewareStacks(db, tmpTrans);
                } catch (e) {
                }
              connections.push(db);
              idbdb.onversionchange = wrap(function(ev) {
                state.vcFired = true;
                db.on("versionchange").fire(ev);
              });
              idbdb.onclose = wrap(function() {
                db.close({ disableAutoOpen: false });
              });
              if (wasCreated)
                _onDatabaseCreated(db._deps, dbName);
              resolve2();
            }, reject);
          }).catch(function(err) {
            switch (err === null || err === void 0 ? void 0 : err.name) {
              case "UnknownError":
                if (state.PR1398_maxLoop > 0) {
                  state.PR1398_maxLoop--;
                  console.warn("Dexie: Workaround for Chrome UnknownError on open()");
                  return tryOpenDB();
                }
                break;
              case "VersionError":
                if (nativeVerToOpen > 0) {
                  nativeVerToOpen = 0;
                  return tryOpenDB();
                }
                break;
            }
            return DexiePromise.reject(err);
          });
        };
        return DexiePromise.race([
          openCanceller,
          (typeof navigator === "undefined" ? DexiePromise.resolve() : idbReady()).then(tryOpenDB)
        ]).then(function() {
          throwIfCancelled();
          state.onReadyBeingFired = [];
          return DexiePromise.resolve(vip(function() {
            return db.on.ready.fire(db.vip);
          })).then(function fireRemainders() {
            if (state.onReadyBeingFired.length > 0) {
              var remainders_1 = state.onReadyBeingFired.reduce(promisableChain, nop);
              state.onReadyBeingFired = [];
              return DexiePromise.resolve(vip(function() {
                return remainders_1(db.vip);
              })).then(fireRemainders);
            }
          });
        }).finally(function() {
          if (state.openCanceller === openCanceller) {
            state.onReadyBeingFired = null;
            state.isBeingOpened = false;
          }
        }).catch(function(err) {
          state.dbOpenError = err;
          try {
            upgradeTransaction && upgradeTransaction.abort();
          } catch (_a2) {
          }
          if (openCanceller === state.openCanceller) {
            db._close();
          }
          return rejection(err);
        }).finally(function() {
          state.openComplete = true;
          resolveDbReady();
        }).then(function() {
          if (wasCreated) {
            var everything_1 = {};
            db.tables.forEach(function(table) {
              table.schema.indexes.forEach(function(idx) {
                if (idx.name)
                  everything_1["idb://".concat(db.name, "/").concat(table.name, "/").concat(idx.name)] = new RangeSet2(-Infinity, [[[]]]);
              });
              everything_1["idb://".concat(db.name, "/").concat(table.name, "/")] = everything_1["idb://".concat(db.name, "/").concat(table.name, "/:dels")] = new RangeSet2(-Infinity, [[[]]]);
            });
            globalEvents(DEXIE_STORAGE_MUTATED_EVENT_NAME).fire(everything_1);
            signalSubscribersNow(everything_1, true);
          }
          return db;
        });
      }
      function awaitIterator(iterator) {
        var callNext = function(result) {
          return iterator.next(result);
        }, doThrow = function(error) {
          return iterator.throw(error);
        }, onSuccess = step(callNext), onError = step(doThrow);
        function step(getNext) {
          return function(val) {
            var next = getNext(val), value = next.value;
            return next.done ? value : !value || typeof value.then !== "function" ? isArray(value) ? Promise.all(value).then(onSuccess, onError) : onSuccess(value) : value.then(onSuccess, onError);
          };
        }
        return step(callNext)();
      }
      function extractTransactionArgs(mode, _tableArgs_, scopeFunc) {
        var i = arguments.length;
        if (i < 2)
          throw new exceptions.InvalidArgument("Too few arguments");
        var args = new Array(i - 1);
        while (--i)
          args[i - 1] = arguments[i];
        scopeFunc = args.pop();
        var tables = flatten(args);
        return [mode, tables, scopeFunc];
      }
      function enterTransactionScope(db, mode, storeNames, parentTransaction, scopeFunc) {
        return DexiePromise.resolve().then(function() {
          var transless = PSD.transless || PSD;
          var trans = db._createTransaction(mode, storeNames, db._dbSchema, parentTransaction);
          trans.explicit = true;
          var zoneProps = {
            trans,
            transless
          };
          if (parentTransaction) {
            trans.idbtrans = parentTransaction.idbtrans;
          } else {
            try {
              trans.create();
              trans.idbtrans._explicit = true;
              db._state.PR1398_maxLoop = 3;
            } catch (ex) {
              if (ex.name === errnames.InvalidState && db.isOpen() && --db._state.PR1398_maxLoop > 0) {
                console.warn("Dexie: Need to reopen db");
                db.close({ disableAutoOpen: false });
                return db.open().then(function() {
                  return enterTransactionScope(db, mode, storeNames, null, scopeFunc);
                });
              }
              return rejection(ex);
            }
          }
          var scopeFuncIsAsync = isAsyncFunction(scopeFunc);
          if (scopeFuncIsAsync) {
            incrementExpectedAwaits();
          }
          var returnValue;
          var promiseFollowed = DexiePromise.follow(function() {
            returnValue = scopeFunc.call(trans, trans);
            if (returnValue) {
              if (scopeFuncIsAsync) {
                var decrementor = decrementExpectedAwaits.bind(null, null);
                returnValue.then(decrementor, decrementor);
              } else if (typeof returnValue.next === "function" && typeof returnValue.throw === "function") {
                returnValue = awaitIterator(returnValue);
              }
            }
          }, zoneProps);
          return (returnValue && typeof returnValue.then === "function" ? DexiePromise.resolve(returnValue).then(function(x) {
            return trans.active ? x : rejection(new exceptions.PrematureCommit("Transaction committed too early. See http://bit.ly/2kdckMn"));
          }) : promiseFollowed.then(function() {
            return returnValue;
          })).then(function(x) {
            if (parentTransaction)
              trans._resolve();
            return trans._completion.then(function() {
              return x;
            });
          }).catch(function(e) {
            trans._reject(e);
            return rejection(e);
          });
        });
      }
      function pad(a, value, count) {
        var result = isArray(a) ? a.slice() : [a];
        for (var i = 0; i < count; ++i)
          result.push(value);
        return result;
      }
      function createVirtualIndexMiddleware(down) {
        return __assign(__assign({}, down), { table: function(tableName) {
          var table = down.table(tableName);
          var schema2 = table.schema;
          var indexLookup = {};
          var allVirtualIndexes = [];
          function addVirtualIndexes(keyPath, keyTail, lowLevelIndex) {
            var keyPathAlias = getKeyPathAlias(keyPath);
            var indexList = indexLookup[keyPathAlias] = indexLookup[keyPathAlias] || [];
            var keyLength = keyPath == null ? 0 : typeof keyPath === "string" ? 1 : keyPath.length;
            var isVirtual = keyTail > 0;
            var virtualIndex = __assign(__assign({}, lowLevelIndex), { name: isVirtual ? "".concat(keyPathAlias, "(virtual-from:").concat(lowLevelIndex.name, ")") : lowLevelIndex.name, lowLevelIndex, isVirtual, keyTail, keyLength, extractKey: getKeyExtractor(keyPath), unique: !isVirtual && lowLevelIndex.unique });
            indexList.push(virtualIndex);
            if (!virtualIndex.isPrimaryKey) {
              allVirtualIndexes.push(virtualIndex);
            }
            if (keyLength > 1) {
              var virtualKeyPath = keyLength === 2 ? keyPath[0] : keyPath.slice(0, keyLength - 1);
              addVirtualIndexes(virtualKeyPath, keyTail + 1, lowLevelIndex);
            }
            indexList.sort(function(a, b) {
              return a.keyTail - b.keyTail;
            });
            return virtualIndex;
          }
          var primaryKey = addVirtualIndexes(schema2.primaryKey.keyPath, 0, schema2.primaryKey);
          indexLookup[":id"] = [primaryKey];
          for (var _i = 0, _a2 = schema2.indexes; _i < _a2.length; _i++) {
            var index = _a2[_i];
            addVirtualIndexes(index.keyPath, 0, index);
          }
          function findBestIndex(keyPath) {
            var result2 = indexLookup[getKeyPathAlias(keyPath)];
            return result2 && result2[0];
          }
          function translateRange(range, keyTail) {
            return {
              type: range.type === 1 ? 2 : range.type,
              lower: pad(range.lower, range.lowerOpen ? down.MAX_KEY : down.MIN_KEY, keyTail),
              lowerOpen: true,
              upper: pad(range.upper, range.upperOpen ? down.MIN_KEY : down.MAX_KEY, keyTail),
              upperOpen: true
            };
          }
          function translateRequest(req) {
            var index2 = req.query.index;
            return index2.isVirtual ? __assign(__assign({}, req), { query: {
              index: index2.lowLevelIndex,
              range: translateRange(req.query.range, index2.keyTail)
            } }) : req;
          }
          var result = __assign(__assign({}, table), { schema: __assign(__assign({}, schema2), { primaryKey, indexes: allVirtualIndexes, getIndexByKeyPath: findBestIndex }), count: function(req) {
            return table.count(translateRequest(req));
          }, query: function(req) {
            return table.query(translateRequest(req));
          }, openCursor: function(req) {
            var _a3 = req.query.index, keyTail = _a3.keyTail, isVirtual = _a3.isVirtual, keyLength = _a3.keyLength;
            if (!isVirtual)
              return table.openCursor(req);
            function createVirtualCursor(cursor) {
              function _continue(key) {
                key != null ? cursor.continue(pad(key, req.reverse ? down.MAX_KEY : down.MIN_KEY, keyTail)) : req.unique ? cursor.continue(cursor.key.slice(0, keyLength).concat(req.reverse ? down.MIN_KEY : down.MAX_KEY, keyTail)) : cursor.continue();
              }
              var virtualCursor = Object.create(cursor, {
                continue: { value: _continue },
                continuePrimaryKey: {
                  value: function(key, primaryKey2) {
                    cursor.continuePrimaryKey(pad(key, down.MAX_KEY, keyTail), primaryKey2);
                  }
                },
                primaryKey: {
                  get: function() {
                    return cursor.primaryKey;
                  }
                },
                key: {
                  get: function() {
                    var key = cursor.key;
                    return keyLength === 1 ? key[0] : key.slice(0, keyLength);
                  }
                },
                value: {
                  get: function() {
                    return cursor.value;
                  }
                }
              });
              return virtualCursor;
            }
            return table.openCursor(translateRequest(req)).then(function(cursor) {
              return cursor && createVirtualCursor(cursor);
            });
          } });
          return result;
        } });
      }
      var virtualIndexMiddleware = {
        stack: "dbcore",
        name: "VirtualIndexMiddleware",
        level: 1,
        create: createVirtualIndexMiddleware
      };
      function getObjectDiff(a, b, rv, prfx) {
        rv = rv || {};
        prfx = prfx || "";
        keys(a).forEach(function(prop) {
          if (!hasOwn(b, prop)) {
            rv[prfx + prop] = void 0;
          } else {
            var ap = a[prop], bp = b[prop];
            if (typeof ap === "object" && typeof bp === "object" && ap && bp) {
              var apTypeName = toStringTag(ap);
              var bpTypeName = toStringTag(bp);
              if (apTypeName !== bpTypeName) {
                rv[prfx + prop] = b[prop];
              } else if (apTypeName === "Object") {
                getObjectDiff(ap, bp, rv, prfx + prop + ".");
              } else if (ap !== bp) {
                rv[prfx + prop] = b[prop];
              }
            } else if (ap !== bp)
              rv[prfx + prop] = b[prop];
          }
        });
        keys(b).forEach(function(prop) {
          if (!hasOwn(a, prop)) {
            rv[prfx + prop] = b[prop];
          }
        });
        return rv;
      }
      function getEffectiveKeys(primaryKey, req) {
        if (req.type === "delete")
          return req.keys;
        return req.keys || req.values.map(primaryKey.extractKey);
      }
      var hooksMiddleware = {
        stack: "dbcore",
        name: "HooksMiddleware",
        level: 2,
        create: function(downCore) {
          return __assign(__assign({}, downCore), { table: function(tableName) {
            var downTable = downCore.table(tableName);
            var primaryKey = downTable.schema.primaryKey;
            var tableMiddleware = __assign(__assign({}, downTable), { mutate: function(req) {
              var dxTrans = PSD.trans;
              var _a2 = dxTrans.table(tableName).hook, deleting = _a2.deleting, creating = _a2.creating, updating = _a2.updating;
              switch (req.type) {
                case "add":
                  if (creating.fire === nop)
                    break;
                  return dxTrans._promise("readwrite", function() {
                    return addPutOrDelete(req);
                  }, true);
                case "put":
                  if (creating.fire === nop && updating.fire === nop)
                    break;
                  return dxTrans._promise("readwrite", function() {
                    return addPutOrDelete(req);
                  }, true);
                case "delete":
                  if (deleting.fire === nop)
                    break;
                  return dxTrans._promise("readwrite", function() {
                    return addPutOrDelete(req);
                  }, true);
                case "deleteRange":
                  if (deleting.fire === nop)
                    break;
                  return dxTrans._promise("readwrite", function() {
                    return deleteRange(req);
                  }, true);
              }
              return downTable.mutate(req);
              function addPutOrDelete(req2) {
                var dxTrans2 = PSD.trans;
                var keys2 = req2.keys || getEffectiveKeys(primaryKey, req2);
                if (!keys2)
                  throw new Error("Keys missing");
                req2 = req2.type === "add" || req2.type === "put" ? __assign(__assign({}, req2), { keys: keys2 }) : __assign({}, req2);
                if (req2.type !== "delete")
                  req2.values = __spreadArray([], req2.values, true);
                if (req2.keys)
                  req2.keys = __spreadArray([], req2.keys, true);
                return getExistingValues(downTable, req2, keys2).then(function(existingValues) {
                  var contexts = keys2.map(function(key, i) {
                    var existingValue = existingValues[i];
                    var ctx = { onerror: null, onsuccess: null };
                    if (req2.type === "delete") {
                      deleting.fire.call(ctx, key, existingValue, dxTrans2);
                    } else if (req2.type === "add" || existingValue === void 0) {
                      var generatedPrimaryKey = creating.fire.call(ctx, key, req2.values[i], dxTrans2);
                      if (key == null && generatedPrimaryKey != null) {
                        key = generatedPrimaryKey;
                        req2.keys[i] = key;
                        if (!primaryKey.outbound) {
                          setByKeyPath(req2.values[i], primaryKey.keyPath, key);
                        }
                      }
                    } else {
                      var objectDiff = getObjectDiff(existingValue, req2.values[i]);
                      var additionalChanges_1 = updating.fire.call(ctx, objectDiff, key, existingValue, dxTrans2);
                      if (additionalChanges_1) {
                        var requestedValue_1 = req2.values[i];
                        Object.keys(additionalChanges_1).forEach(function(keyPath) {
                          if (hasOwn(requestedValue_1, keyPath)) {
                            requestedValue_1[keyPath] = additionalChanges_1[keyPath];
                          } else {
                            setByKeyPath(requestedValue_1, keyPath, additionalChanges_1[keyPath]);
                          }
                        });
                      }
                    }
                    return ctx;
                  });
                  return downTable.mutate(req2).then(function(_a3) {
                    var failures = _a3.failures, results = _a3.results, numFailures = _a3.numFailures, lastResult = _a3.lastResult;
                    for (var i = 0; i < keys2.length; ++i) {
                      var primKey = results ? results[i] : keys2[i];
                      var ctx = contexts[i];
                      if (primKey == null) {
                        ctx.onerror && ctx.onerror(failures[i]);
                      } else {
                        ctx.onsuccess && ctx.onsuccess(
                          req2.type === "put" && existingValues[i] ? req2.values[i] : primKey
                        );
                      }
                    }
                    return { failures, results, numFailures, lastResult };
                  }).catch(function(error) {
                    contexts.forEach(function(ctx) {
                      return ctx.onerror && ctx.onerror(error);
                    });
                    return Promise.reject(error);
                  });
                });
              }
              function deleteRange(req2) {
                return deleteNextChunk(req2.trans, req2.range, 1e4);
              }
              function deleteNextChunk(trans, range, limit) {
                return downTable.query({ trans, values: false, query: { index: primaryKey, range }, limit }).then(function(_a3) {
                  var result = _a3.result;
                  return addPutOrDelete({ type: "delete", keys: result, trans }).then(function(res) {
                    if (res.numFailures > 0)
                      return Promise.reject(res.failures[0]);
                    if (result.length < limit) {
                      return { failures: [], numFailures: 0, lastResult: void 0 };
                    } else {
                      return deleteNextChunk(trans, __assign(__assign({}, range), { lower: result[result.length - 1], lowerOpen: true }), limit);
                    }
                  });
                });
              }
            } });
            return tableMiddleware;
          } });
        }
      };
      function getExistingValues(table, req, effectiveKeys) {
        return req.type === "add" ? Promise.resolve([]) : table.getMany({ trans: req.trans, keys: effectiveKeys, cache: "immutable" });
      }
      function getFromTransactionCache(keys2, cache2, clone) {
        try {
          if (!cache2)
            return null;
          if (cache2.keys.length < keys2.length)
            return null;
          var result = [];
          for (var i = 0, j = 0; i < cache2.keys.length && j < keys2.length; ++i) {
            if (cmp3(cache2.keys[i], keys2[j]) !== 0)
              continue;
            result.push(clone ? deepClone(cache2.values[i]) : cache2.values[i]);
            ++j;
          }
          return result.length === keys2.length ? result : null;
        } catch (_a2) {
          return null;
        }
      }
      var cacheExistingValuesMiddleware = {
        stack: "dbcore",
        level: -1,
        create: function(core2) {
          return {
            table: function(tableName) {
              var table = core2.table(tableName);
              return __assign(__assign({}, table), { getMany: function(req) {
                if (!req.cache) {
                  return table.getMany(req);
                }
                var cachedResult = getFromTransactionCache(req.keys, req.trans["_cache"], req.cache === "clone");
                if (cachedResult) {
                  return DexiePromise.resolve(cachedResult);
                }
                return table.getMany(req).then(function(res) {
                  req.trans["_cache"] = {
                    keys: req.keys,
                    values: req.cache === "clone" ? deepClone(res) : res
                  };
                  return res;
                });
              }, mutate: function(req) {
                if (req.type !== "add")
                  req.trans["_cache"] = null;
                return table.mutate(req);
              } });
            }
          };
        }
      };
      function isCachableContext(ctx, table) {
        return ctx.trans.mode === "readonly" && !!ctx.subscr && !ctx.trans.explicit && ctx.trans.db._options.cache !== "disabled" && !table.schema.primaryKey.outbound;
      }
      function isCachableRequest(type3, req) {
        switch (type3) {
          case "query":
            return req.values && !req.unique;
          case "get":
            return false;
          case "getMany":
            return false;
          case "count":
            return false;
          case "openCursor":
            return false;
        }
      }
      var observabilityMiddleware = {
        stack: "dbcore",
        level: 0,
        name: "Observability",
        create: function(core2) {
          var dbName = core2.schema.name;
          var FULL_RANGE = new RangeSet2(core2.MIN_KEY, core2.MAX_KEY);
          return __assign(__assign({}, core2), { transaction: function(stores, mode, options) {
            if (PSD.subscr && mode !== "readonly") {
              throw new exceptions.ReadOnly("Readwrite transaction in liveQuery context. Querier source: ".concat(PSD.querier));
            }
            return core2.transaction(stores, mode, options);
          }, table: function(tableName) {
            var table = core2.table(tableName);
            var schema2 = table.schema;
            var primaryKey = schema2.primaryKey, indexes = schema2.indexes;
            var extractKey2 = primaryKey.extractKey, outbound = primaryKey.outbound;
            var indexesWithAutoIncPK = primaryKey.autoIncrement && indexes.filter(function(index) {
              return index.compound && index.keyPath.includes(primaryKey.keyPath);
            });
            var tableClone = __assign(__assign({}, table), { mutate: function(req) {
              var _a2, _b;
              var trans = req.trans;
              var mutatedParts = req.mutatedParts || (req.mutatedParts = {});
              var getRangeSet = function(indexName) {
                var part = "idb://".concat(dbName, "/").concat(tableName, "/").concat(indexName);
                return mutatedParts[part] || (mutatedParts[part] = new RangeSet2());
              };
              var pkRangeSet = getRangeSet("");
              var delsRangeSet = getRangeSet(":dels");
              var type3 = req.type;
              var _c = req.type === "deleteRange" ? [req.range] : req.type === "delete" ? [req.keys] : req.values.length < 50 ? [getEffectiveKeys(primaryKey, req).filter(function(id) {
                return id;
              }), req.values] : [], keys2 = _c[0], newObjs = _c[1];
              var oldCache = req.trans["_cache"];
              if (isArray(keys2)) {
                pkRangeSet.addKeys(keys2);
                var oldObjs = type3 === "delete" || keys2.length === newObjs.length ? getFromTransactionCache(keys2, oldCache) : null;
                if (!oldObjs) {
                  delsRangeSet.addKeys(keys2);
                }
                if (oldObjs || newObjs) {
                  trackAffectedIndexes(getRangeSet, schema2, oldObjs, newObjs);
                }
              } else if (keys2) {
                var range = {
                  from: (_a2 = keys2.lower) !== null && _a2 !== void 0 ? _a2 : core2.MIN_KEY,
                  to: (_b = keys2.upper) !== null && _b !== void 0 ? _b : core2.MAX_KEY
                };
                delsRangeSet.add(range);
                pkRangeSet.add(range);
              } else {
                pkRangeSet.add(FULL_RANGE);
                delsRangeSet.add(FULL_RANGE);
                schema2.indexes.forEach(function(idx) {
                  return getRangeSet(idx.name).add(FULL_RANGE);
                });
              }
              return table.mutate(req).then(function(res) {
                if (keys2 && (req.type === "add" || req.type === "put")) {
                  pkRangeSet.addKeys(res.results);
                  if (indexesWithAutoIncPK) {
                    indexesWithAutoIncPK.forEach(function(idx) {
                      var idxVals = req.values.map(function(v) {
                        return idx.extractKey(v);
                      });
                      var pkPos = idx.keyPath.findIndex(function(prop) {
                        return prop === primaryKey.keyPath;
                      });
                      for (var i = 0, len = res.results.length; i < len; ++i) {
                        idxVals[i][pkPos] = res.results[i];
                      }
                      getRangeSet(idx.name).addKeys(idxVals);
                    });
                  }
                }
                trans.mutatedParts = extendObservabilitySet(trans.mutatedParts || {}, mutatedParts);
                return res;
              });
            } });
            var getRange = function(_a2) {
              var _b, _c;
              var _d = _a2.query, index = _d.index, range = _d.range;
              return [
                index,
                new RangeSet2((_b = range.lower) !== null && _b !== void 0 ? _b : core2.MIN_KEY, (_c = range.upper) !== null && _c !== void 0 ? _c : core2.MAX_KEY)
              ];
            };
            var readSubscribers = {
              get: function(req) {
                return [primaryKey, new RangeSet2(req.key)];
              },
              getMany: function(req) {
                return [primaryKey, new RangeSet2().addKeys(req.keys)];
              },
              count: getRange,
              query: getRange,
              openCursor: getRange
            };
            keys(readSubscribers).forEach(function(method) {
              tableClone[method] = function(req) {
                var subscr = PSD.subscr;
                var isLiveQuery = !!subscr;
                var cachable = isCachableContext(PSD, table) && isCachableRequest(method, req);
                var obsSet = cachable ? req.obsSet = {} : subscr;
                if (isLiveQuery) {
                  var getRangeSet = function(indexName) {
                    var part = "idb://".concat(dbName, "/").concat(tableName, "/").concat(indexName);
                    return obsSet[part] || (obsSet[part] = new RangeSet2());
                  };
                  var pkRangeSet_1 = getRangeSet("");
                  var delsRangeSet_1 = getRangeSet(":dels");
                  var _a2 = readSubscribers[method](req), queriedIndex = _a2[0], queriedRanges = _a2[1];
                  if (method === "query" && queriedIndex.isPrimaryKey && !req.values) {
                    delsRangeSet_1.add(queriedRanges);
                  } else {
                    getRangeSet(queriedIndex.name || "").add(queriedRanges);
                  }
                  if (!queriedIndex.isPrimaryKey) {
                    if (method === "count") {
                      delsRangeSet_1.add(FULL_RANGE);
                    } else {
                      var keysPromise_1 = method === "query" && outbound && req.values && table.query(__assign(__assign({}, req), { values: false }));
                      return table[method].apply(this, arguments).then(function(res) {
                        if (method === "query") {
                          if (outbound && req.values) {
                            return keysPromise_1.then(function(_a3) {
                              var resultingKeys = _a3.result;
                              pkRangeSet_1.addKeys(resultingKeys);
                              return res;
                            });
                          }
                          var pKeys = req.values ? res.result.map(extractKey2) : res.result;
                          if (req.values) {
                            pkRangeSet_1.addKeys(pKeys);
                          } else {
                            delsRangeSet_1.addKeys(pKeys);
                          }
                        } else if (method === "openCursor") {
                          var cursor_1 = res;
                          var wantValues_1 = req.values;
                          return cursor_1 && Object.create(cursor_1, {
                            key: {
                              get: function() {
                                delsRangeSet_1.addKey(cursor_1.primaryKey);
                                return cursor_1.key;
                              }
                            },
                            primaryKey: {
                              get: function() {
                                var pkey = cursor_1.primaryKey;
                                delsRangeSet_1.addKey(pkey);
                                return pkey;
                              }
                            },
                            value: {
                              get: function() {
                                wantValues_1 && pkRangeSet_1.addKey(cursor_1.primaryKey);
                                return cursor_1.value;
                              }
                            }
                          });
                        }
                        return res;
                      });
                    }
                  }
                }
                return table[method].apply(this, arguments);
              };
            });
            return tableClone;
          } });
        }
      };
      function trackAffectedIndexes(getRangeSet, schema2, oldObjs, newObjs) {
        function addAffectedIndex(ix) {
          var rangeSet = getRangeSet(ix.name || "");
          function extractKey2(obj) {
            return obj != null ? ix.extractKey(obj) : null;
          }
          var addKeyOrKeys = function(key) {
            return ix.multiEntry && isArray(key) ? key.forEach(function(key2) {
              return rangeSet.addKey(key2);
            }) : rangeSet.addKey(key);
          };
          (oldObjs || newObjs).forEach(function(_, i) {
            var oldKey = oldObjs && extractKey2(oldObjs[i]);
            var newKey = newObjs && extractKey2(newObjs[i]);
            if (cmp3(oldKey, newKey) !== 0) {
              if (oldKey != null)
                addKeyOrKeys(oldKey);
              if (newKey != null)
                addKeyOrKeys(newKey);
            }
          });
        }
        schema2.indexes.forEach(addAffectedIndex);
      }
      function adjustOptimisticFromFailures(tblCache, req, res) {
        if (res.numFailures === 0)
          return req;
        if (req.type === "deleteRange") {
          return null;
        }
        var numBulkOps = req.keys ? req.keys.length : "values" in req && req.values ? req.values.length : 1;
        if (res.numFailures === numBulkOps) {
          return null;
        }
        var clone = __assign({}, req);
        if (isArray(clone.keys)) {
          clone.keys = clone.keys.filter(function(_, i) {
            return !(i in res.failures);
          });
        }
        if ("values" in clone && isArray(clone.values)) {
          clone.values = clone.values.filter(function(_, i) {
            return !(i in res.failures);
          });
        }
        return clone;
      }
      function isAboveLower(key, range) {
        return range.lower === void 0 ? true : range.lowerOpen ? cmp3(key, range.lower) > 0 : cmp3(key, range.lower) >= 0;
      }
      function isBelowUpper(key, range) {
        return range.upper === void 0 ? true : range.upperOpen ? cmp3(key, range.upper) < 0 : cmp3(key, range.upper) <= 0;
      }
      function isWithinRange(key, range) {
        return isAboveLower(key, range) && isBelowUpper(key, range);
      }
      function applyOptimisticOps(result, req, ops, table, cacheEntry, immutable) {
        if (!ops || ops.length === 0)
          return result;
        var index = req.query.index;
        var multiEntry = index.multiEntry;
        var queryRange = req.query.range;
        var primaryKey = table.schema.primaryKey;
        var extractPrimKey = primaryKey.extractKey;
        var extractIndex = index.extractKey;
        var extractLowLevelIndex = (index.lowLevelIndex || index).extractKey;
        var finalResult = ops.reduce(function(result2, op) {
          var modifedResult = result2;
          var includedValues = [];
          if (op.type === "add" || op.type === "put") {
            var includedPKs = new RangeSet2();
            for (var i = op.values.length - 1; i >= 0; --i) {
              var value = op.values[i];
              var pk = extractPrimKey(value);
              if (includedPKs.hasKey(pk))
                continue;
              var key = extractIndex(value);
              if (multiEntry && isArray(key) ? key.some(function(k) {
                return isWithinRange(k, queryRange);
              }) : isWithinRange(key, queryRange)) {
                includedPKs.addKey(pk);
                includedValues.push(value);
              }
            }
          }
          switch (op.type) {
            case "add": {
              var existingKeys_1 = new RangeSet2().addKeys(req.values ? result2.map(function(v) {
                return extractPrimKey(v);
              }) : result2);
              modifedResult = result2.concat(req.values ? includedValues.filter(function(v) {
                var key2 = extractPrimKey(v);
                if (existingKeys_1.hasKey(key2))
                  return false;
                existingKeys_1.addKey(key2);
                return true;
              }) : includedValues.map(function(v) {
                return extractPrimKey(v);
              }).filter(function(k) {
                if (existingKeys_1.hasKey(k))
                  return false;
                existingKeys_1.addKey(k);
                return true;
              }));
              break;
            }
            case "put": {
              var keySet_1 = new RangeSet2().addKeys(op.values.map(function(v) {
                return extractPrimKey(v);
              }));
              modifedResult = result2.filter(
                function(item) {
                  return !keySet_1.hasKey(req.values ? extractPrimKey(item) : item);
                }
              ).concat(
                req.values ? includedValues : includedValues.map(function(v) {
                  return extractPrimKey(v);
                })
              );
              break;
            }
            case "delete":
              var keysToDelete_1 = new RangeSet2().addKeys(op.keys);
              modifedResult = result2.filter(function(item) {
                return !keysToDelete_1.hasKey(req.values ? extractPrimKey(item) : item);
              });
              break;
            case "deleteRange":
              var range_1 = op.range;
              modifedResult = result2.filter(function(item) {
                return !isWithinRange(extractPrimKey(item), range_1);
              });
              break;
          }
          return modifedResult;
        }, result);
        if (finalResult === result)
          return result;
        finalResult.sort(function(a, b) {
          return cmp3(extractLowLevelIndex(a), extractLowLevelIndex(b)) || cmp3(extractPrimKey(a), extractPrimKey(b));
        });
        if (req.limit && req.limit < Infinity) {
          if (finalResult.length > req.limit) {
            finalResult.length = req.limit;
          } else if (result.length === req.limit && finalResult.length < req.limit) {
            cacheEntry.dirty = true;
          }
        }
        return immutable ? Object.freeze(finalResult) : finalResult;
      }
      function areRangesEqual(r1, r2) {
        return cmp3(r1.lower, r2.lower) === 0 && cmp3(r1.upper, r2.upper) === 0 && !!r1.lowerOpen === !!r2.lowerOpen && !!r1.upperOpen === !!r2.upperOpen;
      }
      function compareLowers(lower1, lower2, lowerOpen1, lowerOpen2) {
        if (lower1 === void 0)
          return lower2 !== void 0 ? -1 : 0;
        if (lower2 === void 0)
          return 1;
        var c = cmp3(lower1, lower2);
        if (c === 0) {
          if (lowerOpen1 && lowerOpen2)
            return 0;
          if (lowerOpen1)
            return 1;
          if (lowerOpen2)
            return -1;
        }
        return c;
      }
      function compareUppers(upper1, upper2, upperOpen1, upperOpen2) {
        if (upper1 === void 0)
          return upper2 !== void 0 ? 1 : 0;
        if (upper2 === void 0)
          return -1;
        var c = cmp3(upper1, upper2);
        if (c === 0) {
          if (upperOpen1 && upperOpen2)
            return 0;
          if (upperOpen1)
            return -1;
          if (upperOpen2)
            return 1;
        }
        return c;
      }
      function isSuperRange(r1, r2) {
        return compareLowers(r1.lower, r2.lower, r1.lowerOpen, r2.lowerOpen) <= 0 && compareUppers(r1.upper, r2.upper, r1.upperOpen, r2.upperOpen) >= 0;
      }
      function findCompatibleQuery(dbName, tableName, type3, req) {
        var tblCache = cache["idb://".concat(dbName, "/").concat(tableName)];
        if (!tblCache)
          return [];
        var queries = tblCache.queries[type3];
        if (!queries)
          return [null, false, tblCache, null];
        var indexName = req.query ? req.query.index.name : null;
        var entries = queries[indexName || ""];
        if (!entries)
          return [null, false, tblCache, null];
        switch (type3) {
          case "query":
            var equalEntry = entries.find(function(entry) {
              return entry.req.limit === req.limit && entry.req.values === req.values && areRangesEqual(entry.req.query.range, req.query.range);
            });
            if (equalEntry)
              return [
                equalEntry,
                true,
                tblCache,
                entries
              ];
            var superEntry = entries.find(function(entry) {
              var limit = "limit" in entry.req ? entry.req.limit : Infinity;
              return limit >= req.limit && (req.values ? entry.req.values : true) && isSuperRange(entry.req.query.range, req.query.range);
            });
            return [superEntry, false, tblCache, entries];
          case "count":
            var countQuery = entries.find(function(entry) {
              return areRangesEqual(entry.req.query.range, req.query.range);
            });
            return [countQuery, !!countQuery, tblCache, entries];
        }
      }
      function subscribeToCacheEntry(cacheEntry, container, requery, signal) {
        cacheEntry.subscribers.add(requery);
        signal.addEventListener("abort", function() {
          cacheEntry.subscribers.delete(requery);
          if (cacheEntry.subscribers.size === 0) {
            enqueForDeletion(cacheEntry, container);
          }
        });
      }
      function enqueForDeletion(cacheEntry, container) {
        setTimeout(function() {
          if (cacheEntry.subscribers.size === 0) {
            delArrayItem(container, cacheEntry);
          }
        }, 3e3);
      }
      var cacheMiddleware = {
        stack: "dbcore",
        level: 0,
        name: "Cache",
        create: function(core2) {
          var dbName = core2.schema.name;
          var coreMW = __assign(__assign({}, core2), { transaction: function(stores, mode, options) {
            var idbtrans = core2.transaction(stores, mode, options);
            if (mode === "readwrite") {
              var ac_1 = new AbortController();
              var signal = ac_1.signal;
              var endTransaction = function(wasCommitted) {
                return function() {
                  ac_1.abort();
                  if (mode === "readwrite") {
                    var affectedSubscribers_1 = /* @__PURE__ */ new Set();
                    for (var _i = 0, stores_1 = stores; _i < stores_1.length; _i++) {
                      var storeName = stores_1[_i];
                      var tblCache = cache["idb://".concat(dbName, "/").concat(storeName)];
                      if (tblCache) {
                        var table = core2.table(storeName);
                        var ops = tblCache.optimisticOps.filter(function(op) {
                          return op.trans === idbtrans;
                        });
                        if (idbtrans._explicit && wasCommitted && idbtrans.mutatedParts) {
                          for (var _a2 = 0, _b = Object.values(tblCache.queries.query); _a2 < _b.length; _a2++) {
                            var entries = _b[_a2];
                            for (var _c = 0, _d = entries.slice(); _c < _d.length; _c++) {
                              var entry = _d[_c];
                              if (obsSetsOverlap(entry.obsSet, idbtrans.mutatedParts)) {
                                delArrayItem(entries, entry);
                                entry.subscribers.forEach(function(requery) {
                                  return affectedSubscribers_1.add(requery);
                                });
                              }
                            }
                          }
                        } else if (ops.length > 0) {
                          tblCache.optimisticOps = tblCache.optimisticOps.filter(function(op) {
                            return op.trans !== idbtrans;
                          });
                          for (var _e = 0, _f = Object.values(tblCache.queries.query); _e < _f.length; _e++) {
                            var entries = _f[_e];
                            for (var _g = 0, _h = entries.slice(); _g < _h.length; _g++) {
                              var entry = _h[_g];
                              if (entry.res != null && idbtrans.mutatedParts) {
                                if (wasCommitted && !entry.dirty) {
                                  var freezeResults = Object.isFrozen(entry.res);
                                  var modRes = applyOptimisticOps(entry.res, entry.req, ops, table, entry, freezeResults);
                                  if (entry.dirty) {
                                    delArrayItem(entries, entry);
                                    entry.subscribers.forEach(function(requery) {
                                      return affectedSubscribers_1.add(requery);
                                    });
                                  } else if (modRes !== entry.res) {
                                    entry.res = modRes;
                                    entry.promise = DexiePromise.resolve({ result: modRes });
                                  }
                                } else {
                                  if (entry.dirty) {
                                    delArrayItem(entries, entry);
                                  }
                                  entry.subscribers.forEach(function(requery) {
                                    return affectedSubscribers_1.add(requery);
                                  });
                                }
                              }
                            }
                          }
                        }
                      }
                    }
                    affectedSubscribers_1.forEach(function(requery) {
                      return requery();
                    });
                  }
                };
              };
              idbtrans.addEventListener("abort", endTransaction(false), {
                signal
              });
              idbtrans.addEventListener("error", endTransaction(false), {
                signal
              });
              idbtrans.addEventListener("complete", endTransaction(true), {
                signal
              });
            }
            return idbtrans;
          }, table: function(tableName) {
            var downTable = core2.table(tableName);
            var primKey = downTable.schema.primaryKey;
            var tableMW = __assign(__assign({}, downTable), { mutate: function(req) {
              var trans = PSD.trans;
              if (primKey.outbound || trans.db._options.cache === "disabled" || trans.explicit || trans.idbtrans.mode !== "readwrite") {
                return downTable.mutate(req);
              }
              var tblCache = cache["idb://".concat(dbName, "/").concat(tableName)];
              if (!tblCache)
                return downTable.mutate(req);
              var promise = downTable.mutate(req);
              if ((req.type === "add" || req.type === "put") && (req.values.length >= 50 || getEffectiveKeys(primKey, req).some(function(key) {
                return key == null;
              }))) {
                promise.then(function(res) {
                  var reqWithResolvedKeys = __assign(__assign({}, req), { values: req.values.map(function(value, i) {
                    var _a2;
                    if (res.failures[i])
                      return value;
                    var valueWithKey = ((_a2 = primKey.keyPath) === null || _a2 === void 0 ? void 0 : _a2.includes(".")) ? deepClone(value) : __assign({}, value);
                    setByKeyPath(valueWithKey, primKey.keyPath, res.results[i]);
                    return valueWithKey;
                  }) });
                  var adjustedReq = adjustOptimisticFromFailures(tblCache, reqWithResolvedKeys, res);
                  tblCache.optimisticOps.push(adjustedReq);
                  queueMicrotask(function() {
                    return req.mutatedParts && signalSubscribersLazily(req.mutatedParts);
                  });
                });
              } else {
                tblCache.optimisticOps.push(req);
                req.mutatedParts && signalSubscribersLazily(req.mutatedParts);
                promise.then(function(res) {
                  if (res.numFailures > 0) {
                    delArrayItem(tblCache.optimisticOps, req);
                    var adjustedReq = adjustOptimisticFromFailures(tblCache, req, res);
                    if (adjustedReq) {
                      tblCache.optimisticOps.push(adjustedReq);
                    }
                    req.mutatedParts && signalSubscribersLazily(req.mutatedParts);
                  }
                });
                promise.catch(function() {
                  delArrayItem(tblCache.optimisticOps, req);
                  req.mutatedParts && signalSubscribersLazily(req.mutatedParts);
                });
              }
              return promise;
            }, query: function(req) {
              var _a2;
              if (!isCachableContext(PSD, downTable) || !isCachableRequest("query", req))
                return downTable.query(req);
              var freezeResults = ((_a2 = PSD.trans) === null || _a2 === void 0 ? void 0 : _a2.db._options.cache) === "immutable";
              var _b = PSD, requery = _b.requery, signal = _b.signal;
              var _c = findCompatibleQuery(dbName, tableName, "query", req), cacheEntry = _c[0], exactMatch = _c[1], tblCache = _c[2], container = _c[3];
              if (cacheEntry && exactMatch) {
                cacheEntry.obsSet = req.obsSet;
              } else {
                var promise = downTable.query(req).then(function(res) {
                  var result = res.result;
                  if (cacheEntry)
                    cacheEntry.res = result;
                  if (freezeResults) {
                    for (var i = 0, l = result.length; i < l; ++i) {
                      Object.freeze(result[i]);
                    }
                    Object.freeze(result);
                  } else {
                    res.result = deepClone(result);
                  }
                  return res;
                }).catch(function(error) {
                  if (container && cacheEntry)
                    delArrayItem(container, cacheEntry);
                  return Promise.reject(error);
                });
                cacheEntry = {
                  obsSet: req.obsSet,
                  promise,
                  subscribers: /* @__PURE__ */ new Set(),
                  type: "query",
                  req,
                  dirty: false
                };
                if (container) {
                  container.push(cacheEntry);
                } else {
                  container = [cacheEntry];
                  if (!tblCache) {
                    tblCache = cache["idb://".concat(dbName, "/").concat(tableName)] = {
                      queries: {
                        query: {},
                        count: {}
                      },
                      objs: /* @__PURE__ */ new Map(),
                      optimisticOps: [],
                      unsignaledParts: {}
                    };
                  }
                  tblCache.queries.query[req.query.index.name || ""] = container;
                }
              }
              subscribeToCacheEntry(cacheEntry, container, requery, signal);
              return cacheEntry.promise.then(function(res) {
                return {
                  result: applyOptimisticOps(res.result, req, tblCache === null || tblCache === void 0 ? void 0 : tblCache.optimisticOps, downTable, cacheEntry, freezeResults)
                };
              });
            } });
            return tableMW;
          } });
          return coreMW;
        }
      };
      function vipify(target, vipDb) {
        return new Proxy(target, {
          get: function(target2, prop, receiver) {
            if (prop === "db")
              return vipDb;
            return Reflect.get(target2, prop, receiver);
          }
        });
      }
      var Dexie$1 = (function() {
        function Dexie3(name, options) {
          var _this = this;
          this._middlewares = {};
          this.verno = 0;
          var deps = Dexie3.dependencies;
          this._options = options = __assign({
            addons: Dexie3.addons,
            autoOpen: true,
            indexedDB: deps.indexedDB,
            IDBKeyRange: deps.IDBKeyRange,
            cache: "cloned"
          }, options);
          this._deps = {
            indexedDB: options.indexedDB,
            IDBKeyRange: options.IDBKeyRange
          };
          var addons = options.addons;
          this._dbSchema = {};
          this._versions = [];
          this._storeNames = [];
          this._allTables = {};
          this.idbdb = null;
          this._novip = this;
          var state = {
            dbOpenError: null,
            isBeingOpened: false,
            onReadyBeingFired: null,
            openComplete: false,
            dbReadyResolve: nop,
            dbReadyPromise: null,
            cancelOpen: nop,
            openCanceller: null,
            autoSchema: true,
            PR1398_maxLoop: 3,
            autoOpen: options.autoOpen
          };
          state.dbReadyPromise = new DexiePromise(function(resolve2) {
            state.dbReadyResolve = resolve2;
          });
          state.openCanceller = new DexiePromise(function(_, reject) {
            state.cancelOpen = reject;
          });
          this._state = state;
          this.name = name;
          this.on = Events(this, "populate", "blocked", "versionchange", "close", { ready: [promisableChain, nop] });
          this.once = function(event, callback) {
            var fn = function() {
              var args = [];
              for (var _i = 0; _i < arguments.length; _i++) {
                args[_i] = arguments[_i];
              }
              _this.on(event).unsubscribe(fn);
              callback.apply(_this, args);
            };
            return _this.on(event, fn);
          };
          this.on.ready.subscribe = override(this.on.ready.subscribe, function(subscribe) {
            return function(subscriber, bSticky) {
              Dexie3.vip(function() {
                var state2 = _this._state;
                if (state2.openComplete) {
                  if (!state2.dbOpenError)
                    DexiePromise.resolve().then(subscriber);
                  if (bSticky)
                    subscribe(subscriber);
                } else if (state2.onReadyBeingFired) {
                  state2.onReadyBeingFired.push(subscriber);
                  if (bSticky)
                    subscribe(subscriber);
                } else {
                  subscribe(subscriber);
                  var db_1 = _this;
                  if (!bSticky)
                    subscribe(function unsubscribe() {
                      db_1.on.ready.unsubscribe(subscriber);
                      db_1.on.ready.unsubscribe(unsubscribe);
                    });
                }
              });
            };
          });
          this.Collection = createCollectionConstructor(this);
          this.Table = createTableConstructor(this);
          this.Transaction = createTransactionConstructor(this);
          this.Version = createVersionConstructor(this);
          this.WhereClause = createWhereClauseConstructor(this);
          this.on("versionchange", function(ev) {
            if (ev.newVersion > 0)
              console.warn("Another connection wants to upgrade database '".concat(_this.name, "'. Closing db now to resume the upgrade."));
            else
              console.warn("Another connection wants to delete database '".concat(_this.name, "'. Closing db now to resume the delete request."));
            _this.close({ disableAutoOpen: false });
          });
          this.on("blocked", function(ev) {
            if (!ev.newVersion || ev.newVersion < ev.oldVersion)
              console.warn("Dexie.delete('".concat(_this.name, "') was blocked"));
            else
              console.warn("Upgrade '".concat(_this.name, "' blocked by other connection holding version ").concat(ev.oldVersion / 10));
          });
          this._maxKey = getMaxKey(options.IDBKeyRange);
          this._createTransaction = function(mode, storeNames, dbschema, parentTransaction) {
            return new _this.Transaction(mode, storeNames, dbschema, _this._options.chromeTransactionDurability, parentTransaction);
          };
          this._fireOnBlocked = function(ev) {
            _this.on("blocked").fire(ev);
            connections.filter(function(c) {
              return c.name === _this.name && c !== _this && !c._state.vcFired;
            }).map(function(c) {
              return c.on("versionchange").fire(ev);
            });
          };
          this.use(cacheExistingValuesMiddleware);
          this.use(cacheMiddleware);
          this.use(observabilityMiddleware);
          this.use(virtualIndexMiddleware);
          this.use(hooksMiddleware);
          var vipDB = new Proxy(this, {
            get: function(_, prop, receiver) {
              if (prop === "_vip")
                return true;
              if (prop === "table")
                return function(tableName) {
                  return vipify(_this.table(tableName), vipDB);
                };
              var rv = Reflect.get(_, prop, receiver);
              if (rv instanceof Table)
                return vipify(rv, vipDB);
              if (prop === "tables")
                return rv.map(function(t) {
                  return vipify(t, vipDB);
                });
              if (prop === "_createTransaction")
                return function() {
                  var tx = rv.apply(this, arguments);
                  return vipify(tx, vipDB);
                };
              return rv;
            }
          });
          this.vip = vipDB;
          addons.forEach(function(addon) {
            return addon(_this);
          });
        }
        Dexie3.prototype.version = function(versionNumber) {
          if (isNaN(versionNumber) || versionNumber < 0.1)
            throw new exceptions.Type("Given version is not a positive number");
          versionNumber = Math.round(versionNumber * 10) / 10;
          if (this.idbdb || this._state.isBeingOpened)
            throw new exceptions.Schema("Cannot add version when database is open");
          this.verno = Math.max(this.verno, versionNumber);
          var versions = this._versions;
          var versionInstance = versions.filter(function(v) {
            return v._cfg.version === versionNumber;
          })[0];
          if (versionInstance)
            return versionInstance;
          versionInstance = new this.Version(versionNumber);
          versions.push(versionInstance);
          versions.sort(lowerVersionFirst);
          versionInstance.stores({});
          this._state.autoSchema = false;
          return versionInstance;
        };
        Dexie3.prototype._whenReady = function(fn) {
          var _this = this;
          return this.idbdb && (this._state.openComplete || PSD.letThrough || this._vip) ? fn() : new DexiePromise(function(resolve2, reject) {
            if (_this._state.openComplete) {
              return reject(new exceptions.DatabaseClosed(_this._state.dbOpenError));
            }
            if (!_this._state.isBeingOpened) {
              if (!_this._state.autoOpen) {
                reject(new exceptions.DatabaseClosed());
                return;
              }
              _this.open().catch(nop);
            }
            _this._state.dbReadyPromise.then(resolve2, reject);
          }).then(fn);
        };
        Dexie3.prototype.use = function(_a2) {
          var stack = _a2.stack, create = _a2.create, level = _a2.level, name = _a2.name;
          if (name)
            this.unuse({ stack, name });
          var middlewares = this._middlewares[stack] || (this._middlewares[stack] = []);
          middlewares.push({ stack, create, level: level == null ? 10 : level, name });
          middlewares.sort(function(a, b) {
            return a.level - b.level;
          });
          return this;
        };
        Dexie3.prototype.unuse = function(_a2) {
          var stack = _a2.stack, name = _a2.name, create = _a2.create;
          if (stack && this._middlewares[stack]) {
            this._middlewares[stack] = this._middlewares[stack].filter(function(mw) {
              return create ? mw.create !== create : name ? mw.name !== name : false;
            });
          }
          return this;
        };
        Dexie3.prototype.open = function() {
          var _this = this;
          return usePSD(
            globalPSD,
            function() {
              return dexieOpen(_this);
            }
          );
        };
        Dexie3.prototype._close = function() {
          this.on.close.fire(new CustomEvent("close"));
          var state = this._state;
          var idx = connections.indexOf(this);
          if (idx >= 0)
            connections.splice(idx, 1);
          if (this.idbdb) {
            try {
              this.idbdb.close();
            } catch (e) {
            }
            this.idbdb = null;
          }
          if (!state.isBeingOpened) {
            state.dbReadyPromise = new DexiePromise(function(resolve2) {
              state.dbReadyResolve = resolve2;
            });
            state.openCanceller = new DexiePromise(function(_, reject) {
              state.cancelOpen = reject;
            });
          }
        };
        Dexie3.prototype.close = function(_a2) {
          var _b = _a2 === void 0 ? { disableAutoOpen: true } : _a2, disableAutoOpen = _b.disableAutoOpen;
          var state = this._state;
          if (disableAutoOpen) {
            if (state.isBeingOpened) {
              state.cancelOpen(new exceptions.DatabaseClosed());
            }
            this._close();
            state.autoOpen = false;
            state.dbOpenError = new exceptions.DatabaseClosed();
          } else {
            this._close();
            state.autoOpen = this._options.autoOpen || state.isBeingOpened;
            state.openComplete = false;
            state.dbOpenError = null;
          }
        };
        Dexie3.prototype.delete = function(closeOptions) {
          var _this = this;
          if (closeOptions === void 0) {
            closeOptions = { disableAutoOpen: true };
          }
          var hasInvalidArguments = arguments.length > 0 && typeof arguments[0] !== "object";
          var state = this._state;
          return new DexiePromise(function(resolve2, reject) {
            var doDelete = function() {
              _this.close(closeOptions);
              var req = _this._deps.indexedDB.deleteDatabase(_this.name);
              req.onsuccess = wrap(function() {
                _onDatabaseDeleted(_this._deps, _this.name);
                resolve2();
              });
              req.onerror = eventRejectHandler(reject);
              req.onblocked = _this._fireOnBlocked;
            };
            if (hasInvalidArguments)
              throw new exceptions.InvalidArgument("Invalid closeOptions argument to db.delete()");
            if (state.isBeingOpened) {
              state.dbReadyPromise.then(doDelete);
            } else {
              doDelete();
            }
          });
        };
        Dexie3.prototype.backendDB = function() {
          return this.idbdb;
        };
        Dexie3.prototype.isOpen = function() {
          return this.idbdb !== null;
        };
        Dexie3.prototype.hasBeenClosed = function() {
          var dbOpenError = this._state.dbOpenError;
          return dbOpenError && dbOpenError.name === "DatabaseClosed";
        };
        Dexie3.prototype.hasFailed = function() {
          return this._state.dbOpenError !== null;
        };
        Dexie3.prototype.dynamicallyOpened = function() {
          return this._state.autoSchema;
        };
        Object.defineProperty(Dexie3.prototype, "tables", {
          get: function() {
            var _this = this;
            return keys(this._allTables).map(function(name) {
              return _this._allTables[name];
            });
          },
          enumerable: false,
          configurable: true
        });
        Dexie3.prototype.transaction = function() {
          var args = extractTransactionArgs.apply(this, arguments);
          return this._transaction.apply(this, args);
        };
        Dexie3.prototype._transaction = function(mode, tables, scopeFunc) {
          var _this = this;
          var parentTransaction = PSD.trans;
          if (!parentTransaction || parentTransaction.db !== this || mode.indexOf("!") !== -1)
            parentTransaction = null;
          var onlyIfCompatible = mode.indexOf("?") !== -1;
          mode = mode.replace("!", "").replace("?", "");
          var idbMode, storeNames;
          try {
            storeNames = tables.map(function(table) {
              var storeName = table instanceof _this.Table ? table.name : table;
              if (typeof storeName !== "string")
                throw new TypeError("Invalid table argument to Dexie.transaction(). Only Table or String are allowed");
              return storeName;
            });
            if (mode == "r" || mode === READONLY)
              idbMode = READONLY;
            else if (mode == "rw" || mode == READWRITE)
              idbMode = READWRITE;
            else
              throw new exceptions.InvalidArgument("Invalid transaction mode: " + mode);
            if (parentTransaction) {
              if (parentTransaction.mode === READONLY && idbMode === READWRITE) {
                if (onlyIfCompatible) {
                  parentTransaction = null;
                } else
                  throw new exceptions.SubTransaction("Cannot enter a sub-transaction with READWRITE mode when parent transaction is READONLY");
              }
              if (parentTransaction) {
                storeNames.forEach(function(storeName) {
                  if (parentTransaction && parentTransaction.storeNames.indexOf(storeName) === -1) {
                    if (onlyIfCompatible) {
                      parentTransaction = null;
                    } else
                      throw new exceptions.SubTransaction("Table " + storeName + " not included in parent transaction.");
                  }
                });
              }
              if (onlyIfCompatible && parentTransaction && !parentTransaction.active) {
                parentTransaction = null;
              }
            }
          } catch (e) {
            return parentTransaction ? parentTransaction._promise(null, function(_, reject) {
              reject(e);
            }) : rejection(e);
          }
          var enterTransaction = enterTransactionScope.bind(null, this, idbMode, storeNames, parentTransaction, scopeFunc);
          return parentTransaction ? parentTransaction._promise(idbMode, enterTransaction, "lock") : PSD.trans ? usePSD(PSD.transless, function() {
            return _this._whenReady(enterTransaction);
          }) : this._whenReady(enterTransaction);
        };
        Dexie3.prototype.table = function(tableName) {
          if (!hasOwn(this._allTables, tableName)) {
            throw new exceptions.InvalidTable("Table ".concat(tableName, " does not exist"));
          }
          return this._allTables[tableName];
        };
        return Dexie3;
      })();
      var symbolObservable = typeof Symbol !== "undefined" && "observable" in Symbol ? Symbol.observable : "@@observable";
      var Observable = (function() {
        function Observable2(subscribe) {
          this._subscribe = subscribe;
        }
        Observable2.prototype.subscribe = function(x, error, complete) {
          return this._subscribe(!x || typeof x === "function" ? { next: x, error, complete } : x);
        };
        Observable2.prototype[symbolObservable] = function() {
          return this;
        };
        return Observable2;
      })();
      var domDeps;
      try {
        domDeps = {
          indexedDB: _global.indexedDB || _global.mozIndexedDB || _global.webkitIndexedDB || _global.msIndexedDB,
          IDBKeyRange: _global.IDBKeyRange || _global.webkitIDBKeyRange
        };
      } catch (e) {
        domDeps = { indexedDB: null, IDBKeyRange: null };
      }
      function liveQuery2(querier) {
        var hasValue = false;
        var currentValue;
        var observable = new Observable(function(observer) {
          var scopeFuncIsAsync = isAsyncFunction(querier);
          function execute(ctx) {
            var wasRootExec = beginMicroTickScope();
            try {
              if (scopeFuncIsAsync) {
                incrementExpectedAwaits();
              }
              var rv = newScope(querier, ctx);
              if (scopeFuncIsAsync) {
                rv = rv.finally(decrementExpectedAwaits);
              }
              return rv;
            } finally {
              wasRootExec && endMicroTickScope();
            }
          }
          var closed = false;
          var abortController;
          var accumMuts = {};
          var currentObs = {};
          var subscription = {
            get closed() {
              return closed;
            },
            unsubscribe: function() {
              if (closed)
                return;
              closed = true;
              if (abortController)
                abortController.abort();
              if (startedListening)
                globalEvents.storagemutated.unsubscribe(mutationListener);
            }
          };
          observer.start && observer.start(subscription);
          var startedListening = false;
          var doQuery = function() {
            return execInGlobalContext(_doQuery);
          };
          function shouldNotify() {
            return obsSetsOverlap(currentObs, accumMuts);
          }
          var mutationListener = function(parts) {
            extendObservabilitySet(accumMuts, parts);
            if (shouldNotify()) {
              doQuery();
            }
          };
          var _doQuery = function() {
            if (closed || !domDeps.indexedDB) {
              return;
            }
            accumMuts = {};
            var subscr = {};
            if (abortController)
              abortController.abort();
            abortController = new AbortController();
            var ctx = {
              subscr,
              signal: abortController.signal,
              requery: doQuery,
              querier,
              trans: null
            };
            var ret = execute(ctx);
            Promise.resolve(ret).then(function(result) {
              hasValue = true;
              currentValue = result;
              if (closed || ctx.signal.aborted) {
                return;
              }
              accumMuts = {};
              currentObs = subscr;
              if (!objectIsEmpty(currentObs) && !startedListening) {
                globalEvents(DEXIE_STORAGE_MUTATED_EVENT_NAME, mutationListener);
                startedListening = true;
              }
              execInGlobalContext(function() {
                return !closed && observer.next && observer.next(result);
              });
            }, function(err) {
              hasValue = false;
              if (!["DatabaseClosedError", "AbortError"].includes(err === null || err === void 0 ? void 0 : err.name)) {
                if (!closed)
                  execInGlobalContext(function() {
                    if (closed)
                      return;
                    observer.error && observer.error(err);
                  });
              }
            });
          };
          setTimeout(doQuery, 0);
          return subscription;
        });
        observable.hasValue = function() {
          return hasValue;
        };
        observable.getValue = function() {
          return currentValue;
        };
        return observable;
      }
      var Dexie2 = Dexie$1;
      props(Dexie2, __assign(__assign({}, fullNameExceptions), {
        delete: function(databaseName) {
          var db = new Dexie2(databaseName, { addons: [] });
          return db.delete();
        },
        exists: function(name) {
          return new Dexie2(name, { addons: [] }).open().then(function(db) {
            db.close();
            return true;
          }).catch("NoSuchDatabaseError", function() {
            return false;
          });
        },
        getDatabaseNames: function(cb) {
          try {
            return getDatabaseNames(Dexie2.dependencies).then(cb);
          } catch (_a2) {
            return rejection(new exceptions.MissingAPI());
          }
        },
        defineClass: function() {
          function Class(content) {
            extend3(this, content);
          }
          return Class;
        },
        ignoreTransaction: function(scopeFunc) {
          return PSD.trans ? usePSD(PSD.transless, scopeFunc) : scopeFunc();
        },
        vip,
        async: function(generatorFn) {
          return function() {
            try {
              var rv = awaitIterator(generatorFn.apply(this, arguments));
              if (!rv || typeof rv.then !== "function")
                return DexiePromise.resolve(rv);
              return rv;
            } catch (e) {
              return rejection(e);
            }
          };
        },
        spawn: function(generatorFn, args, thiz) {
          try {
            var rv = awaitIterator(generatorFn.apply(thiz, args || []));
            if (!rv || typeof rv.then !== "function")
              return DexiePromise.resolve(rv);
            return rv;
          } catch (e) {
            return rejection(e);
          }
        },
        currentTransaction: {
          get: function() {
            return PSD.trans || null;
          }
        },
        waitFor: function(promiseOrFunction, optionalTimeout) {
          var promise = DexiePromise.resolve(typeof promiseOrFunction === "function" ? Dexie2.ignoreTransaction(promiseOrFunction) : promiseOrFunction).timeout(optionalTimeout || 6e4);
          return PSD.trans ? PSD.trans.waitFor(promise) : promise;
        },
        Promise: DexiePromise,
        debug: {
          get: function() {
            return debug;
          },
          set: function(value) {
            setDebug(value);
          }
        },
        derive,
        extend: extend3,
        props,
        override,
        Events,
        on: globalEvents,
        liveQuery: liveQuery2,
        extendObservabilitySet,
        getByKeyPath,
        setByKeyPath,
        delByKeyPath,
        shallowClone,
        deepClone,
        getObjectDiff,
        cmp: cmp3,
        asap: asap$1,
        minKey,
        addons: [],
        connections,
        errnames,
        dependencies: domDeps,
        cache,
        semVer: DEXIE_VERSION,
        version: DEXIE_VERSION.split(".").map(function(n) {
          return parseInt(n);
        }).reduce(function(p, c, i) {
          return p + c / Math.pow(10, i * 2);
        })
      }));
      Dexie2.maxKey = getMaxKey(Dexie2.dependencies.IDBKeyRange);
      if (typeof dispatchEvent !== "undefined" && typeof addEventListener !== "undefined") {
        globalEvents(DEXIE_STORAGE_MUTATED_EVENT_NAME, function(updatedParts) {
          if (!propagatingLocally) {
            var event_1;
            event_1 = new CustomEvent(STORAGE_MUTATED_DOM_EVENT_NAME, {
              detail: updatedParts
            });
            propagatingLocally = true;
            dispatchEvent(event_1);
            propagatingLocally = false;
          }
        });
        addEventListener(STORAGE_MUTATED_DOM_EVENT_NAME, function(_a2) {
          var detail = _a2.detail;
          if (!propagatingLocally) {
            propagateLocally(detail);
          }
        });
      }
      function propagateLocally(updateParts) {
        var wasMe = propagatingLocally;
        try {
          propagatingLocally = true;
          globalEvents.storagemutated.fire(updateParts);
          signalSubscribersNow(updateParts, true);
        } finally {
          propagatingLocally = wasMe;
        }
      }
      var propagatingLocally = false;
      var bc;
      var createBC = function() {
      };
      if (typeof BroadcastChannel !== "undefined") {
        createBC = function() {
          bc = new BroadcastChannel(STORAGE_MUTATED_DOM_EVENT_NAME);
          bc.onmessage = function(ev) {
            return ev.data && propagateLocally(ev.data);
          };
        };
        createBC();
        if (typeof bc.unref === "function") {
          bc.unref();
        }
        globalEvents(DEXIE_STORAGE_MUTATED_EVENT_NAME, function(changedParts) {
          if (!propagatingLocally) {
            bc.postMessage(changedParts);
          }
        });
      }
      if (typeof addEventListener !== "undefined") {
        addEventListener("pagehide", function(event) {
          if (!Dexie$1.disableBfCache && event.persisted) {
            if (debug)
              console.debug("Dexie: handling persisted pagehide");
            bc === null || bc === void 0 ? void 0 : bc.close();
            for (var _i = 0, connections_1 = connections; _i < connections_1.length; _i++) {
              var db = connections_1[_i];
              db.close({ disableAutoOpen: false });
            }
          }
        });
        addEventListener("pageshow", function(event) {
          if (!Dexie$1.disableBfCache && event.persisted) {
            if (debug)
              console.debug("Dexie: handling persisted pageshow");
            createBC();
            propagateLocally({ all: new RangeSet2(-Infinity, [[]]) });
          }
        });
      }
      function add2(value) {
        return new PropModification2({ add: value });
      }
      function remove2(value) {
        return new PropModification2({ remove: value });
      }
      function replacePrefix2(a, b) {
        return new PropModification2({ replacePrefix: [a, b] });
      }
      DexiePromise.rejectionMapper = mapError;
      setDebug(debug);
      var namedExports = /* @__PURE__ */ Object.freeze({
        __proto__: null,
        Dexie: Dexie$1,
        Entity: Entity2,
        PropModification: PropModification2,
        RangeSet: RangeSet2,
        add: add2,
        cmp: cmp3,
        default: Dexie$1,
        liveQuery: liveQuery2,
        mergeRanges: mergeRanges2,
        rangesOverlap: rangesOverlap2,
        remove: remove2,
        replacePrefix: replacePrefix2
      });
      __assign(Dexie$1, namedExports, { default: Dexie$1 });
      return Dexie$1;
    }));
  }
});

// scripts/agent/capabilityRunner.ts
var capabilityRunner_exports = {};
__export(capabilityRunner_exports, {
  NodeVaultFS: () => NodeVaultFS,
  buildCLIInvokePayload: () => buildCLIInvokePayload,
  buildOrganizerContextFromArgs: () => buildOrganizerContextFromArgs,
  installLocalStorageShim: () => installLocalStorageShim,
  materializeFileBackedInputs: () => materializeFileBackedInputs,
  parseOrganizerContextUrl: () => parseOrganizerContextUrl,
  renderCapabilityHelp: () => renderCapabilityHelp,
  renderOrganizerContextHelp: () => renderOrganizerContextHelp,
  renderOrganizerContextOutput: () => renderOrganizerContextOutput,
  renderRunnerHelp: () => renderRunnerHelp,
  resolveCommandShortcut: () => resolveCommandShortcut,
  resolveOutputFormat: () => resolveOutputFormat,
  runCapabilityRunnerCommand: () => runCapabilityRunnerCommand
});
module.exports = __toCommonJS(capabilityRunner_exports);

// node_modules/fake-indexeddb/build/esm/lib/errors.js
var messages = {
  AbortError: "A request was aborted, for example through a call to IDBTransaction.abort.",
  ConstraintError: "A mutation operation in the transaction failed because a constraint was not satisfied. For example, an object such as an object store or index already exists and a request attempted to create a new one.",
  DataCloneError: "The data being stored could not be cloned by the internal structured cloning algorithm.",
  DataError: "Data provided to an operation does not meet requirements.",
  InvalidAccessError: "An invalid operation was performed on an object. For example transaction creation attempt was made, but an empty scope was provided.",
  InvalidStateError: "An operation was called on an object on which it is not allowed or at a time when it is not allowed. Also occurs if a request is made on a source object that has been deleted or removed. Use TransactionInactiveError or ReadOnlyError when possible, as they are more specific variations of InvalidStateError.",
  NotFoundError: "The operation failed because the requested database object could not be found. For example, an object store did not exist but was being opened.",
  ReadOnlyError: 'The mutating operation was attempted in a "readonly" transaction.',
  TransactionInactiveError: "A request was placed against a transaction which is currently not active, or which is finished.",
  SyntaxError: "The keypath argument contains an invalid key path",
  VersionError: "An attempt was made to open a database using a lower version than the existing version."
};
var setErrorCode = (error, value) => {
  Object.defineProperty(error, "code", {
    value,
    writable: false,
    enumerable: true,
    configurable: false
  });
};
var AbortError = class extends DOMException {
  constructor(message = messages.AbortError) {
    super(message, "AbortError");
  }
};
var ConstraintError = class extends DOMException {
  constructor(message = messages.ConstraintError) {
    super(message, "ConstraintError");
  }
};
var DataError = class extends DOMException {
  constructor(message = messages.DataError) {
    super(message, "DataError");
    setErrorCode(this, 0);
  }
};
var InvalidAccessError = class extends DOMException {
  constructor(message = messages.InvalidAccessError) {
    super(message, "InvalidAccessError");
  }
};
var InvalidStateError = class extends DOMException {
  constructor(message = messages.InvalidStateError) {
    super(message, "InvalidStateError");
    setErrorCode(this, 11);
  }
};
var NotFoundError = class extends DOMException {
  constructor(message = messages.NotFoundError) {
    super(message, "NotFoundError");
  }
};
var ReadOnlyError = class extends DOMException {
  constructor(message = messages.ReadOnlyError) {
    super(message, "ReadOnlyError");
  }
};
var SyntaxError2 = class extends DOMException {
  constructor(message = messages.VersionError) {
    super(message, "SyntaxError");
    setErrorCode(this, 12);
  }
};
var TransactionInactiveError = class extends DOMException {
  constructor(message = messages.TransactionInactiveError) {
    super(message, "TransactionInactiveError");
    setErrorCode(this, 0);
  }
};
var VersionError = class extends DOMException {
  constructor(message = messages.VersionError) {
    super(message, "VersionError");
  }
};

// node_modules/fake-indexeddb/build/esm/lib/isSharedArrayBuffer.js
function isSharedArrayBuffer(input) {
  return typeof SharedArrayBuffer !== "undefined" && input instanceof SharedArrayBuffer;
}

// node_modules/fake-indexeddb/build/esm/lib/valueToKeyWithoutThrowing.js
var INVALID_TYPE = Symbol("INVALID_TYPE");
var INVALID_VALUE = Symbol("INVALID_VALUE");
var valueToKeyWithoutThrowing = (input, seen) => {
  if (typeof input === "number") {
    if (isNaN(input)) {
      return INVALID_VALUE;
    }
    return input;
  } else if (Object.prototype.toString.call(input) === "[object Date]") {
    const ms = input.valueOf();
    if (isNaN(ms)) {
      return INVALID_VALUE;
    }
    return new Date(ms);
  } else if (typeof input === "string") {
    return input;
  } else if (
    // https://w3c.github.io/IndexedDB/#ref-for-dfn-buffer-source-type
    input instanceof ArrayBuffer || isSharedArrayBuffer(input) || typeof ArrayBuffer !== "undefined" && ArrayBuffer.isView && ArrayBuffer.isView(input)
  ) {
    if ("detached" in input ? input.detached : input.byteLength === 0) {
      return INVALID_VALUE;
    }
    let arrayBuffer;
    let offset = 0;
    let length = 0;
    if (input instanceof ArrayBuffer || isSharedArrayBuffer(input)) {
      arrayBuffer = input;
      length = input.byteLength;
    } else {
      arrayBuffer = input.buffer;
      offset = input.byteOffset;
      length = input.byteLength;
    }
    return arrayBuffer.slice(offset, offset + length);
  } else if (Array.isArray(input)) {
    if (seen === void 0) {
      seen = /* @__PURE__ */ new Set();
    } else if (seen.has(input)) {
      return INVALID_VALUE;
    }
    seen.add(input);
    let hasInvalid = false;
    const keys = Array.from({
      length: input.length
    }, (_, i) => {
      if (hasInvalid) {
        return;
      }
      const hop = Object.hasOwn(input, i);
      if (!hop) {
        hasInvalid = true;
        return;
      }
      const entry = input[i];
      const key = valueToKeyWithoutThrowing(entry, seen);
      if (key === INVALID_VALUE || key === INVALID_TYPE) {
        hasInvalid = true;
        return;
      }
      return key;
    });
    if (hasInvalid) {
      return INVALID_VALUE;
    }
    return keys;
  } else {
    return INVALID_TYPE;
  }
};
var valueToKeyWithoutThrowing_default = valueToKeyWithoutThrowing;

// node_modules/fake-indexeddb/build/esm/lib/valueToKey.js
var valueToKey = (input, seen) => {
  const result = valueToKeyWithoutThrowing_default(input, seen);
  if (result === INVALID_VALUE || result === INVALID_TYPE) {
    throw new DataError();
  }
  return result;
};
var valueToKey_default = valueToKey;

// node_modules/fake-indexeddb/build/esm/lib/cmp.js
var getType = (x) => {
  if (typeof x === "number") {
    return "Number";
  }
  if (Object.prototype.toString.call(x) === "[object Date]") {
    return "Date";
  }
  if (Array.isArray(x)) {
    return "Array";
  }
  if (typeof x === "string") {
    return "String";
  }
  if (x instanceof ArrayBuffer) {
    return "Binary";
  }
  throw new DataError();
};
var cmp = (first, second) => {
  if (second === void 0) {
    throw new TypeError();
  }
  first = valueToKey_default(first);
  second = valueToKey_default(second);
  const t1 = getType(first);
  const t2 = getType(second);
  if (t1 !== t2) {
    if (t1 === "Array") {
      return 1;
    }
    if (t1 === "Binary" && (t2 === "String" || t2 === "Date" || t2 === "Number")) {
      return 1;
    }
    if (t1 === "String" && (t2 === "Date" || t2 === "Number")) {
      return 1;
    }
    if (t1 === "Date" && t2 === "Number") {
      return 1;
    }
    return -1;
  }
  if (t1 === "Binary") {
    first = new Uint8Array(first);
    second = new Uint8Array(second);
  }
  if (t1 === "Array" || t1 === "Binary") {
    const length = Math.min(first.length, second.length);
    for (let i = 0; i < length; i++) {
      const result = cmp(first[i], second[i]);
      if (result !== 0) {
        return result;
      }
    }
    if (first.length > second.length) {
      return 1;
    }
    if (first.length < second.length) {
      return -1;
    }
    return 0;
  }
  if (t1 === "Date") {
    if (first.getTime() === second.getTime()) {
      return 0;
    }
  } else {
    if (first === second) {
      return 0;
    }
  }
  return first > second ? 1 : -1;
};
var cmp_default = cmp;

// node_modules/fake-indexeddb/build/esm/FDBKeyRange.js
var FDBKeyRange = class _FDBKeyRange {
  static only(value) {
    if (arguments.length === 0) {
      throw new TypeError();
    }
    value = valueToKey_default(value);
    return new _FDBKeyRange(value, value, false, false);
  }
  static lowerBound(lower, open = false) {
    if (arguments.length === 0) {
      throw new TypeError();
    }
    lower = valueToKey_default(lower);
    return new _FDBKeyRange(lower, void 0, open, true);
  }
  static upperBound(upper, open = false) {
    if (arguments.length === 0) {
      throw new TypeError();
    }
    upper = valueToKey_default(upper);
    return new _FDBKeyRange(void 0, upper, true, open);
  }
  static bound(lower, upper, lowerOpen = false, upperOpen = false) {
    if (arguments.length < 2) {
      throw new TypeError();
    }
    const cmpResult = cmp_default(lower, upper);
    if (cmpResult === 1 || cmpResult === 0 && (lowerOpen || upperOpen)) {
      throw new DataError();
    }
    lower = valueToKey_default(lower);
    upper = valueToKey_default(upper);
    return new _FDBKeyRange(lower, upper, lowerOpen, upperOpen);
  }
  constructor(lower, upper, lowerOpen, upperOpen) {
    this.lower = lower;
    this.upper = upper;
    this.lowerOpen = lowerOpen;
    this.upperOpen = upperOpen;
  }
  // https://w3c.github.io/IndexedDB/#dom-idbkeyrange-includes
  includes(key) {
    if (arguments.length === 0) {
      throw new TypeError();
    }
    key = valueToKey_default(key);
    if (this.lower !== void 0) {
      const cmpResult = cmp_default(this.lower, key);
      if (cmpResult === 1 || cmpResult === 0 && this.lowerOpen) {
        return false;
      }
    }
    if (this.upper !== void 0) {
      const cmpResult = cmp_default(this.upper, key);
      if (cmpResult === -1 || cmpResult === 0 && this.upperOpen) {
        return false;
      }
    }
    return true;
  }
  get [Symbol.toStringTag]() {
    return "IDBKeyRange";
  }
};
var FDBKeyRange_default = FDBKeyRange;

// node_modules/fake-indexeddb/build/esm/lib/extractKey.js
var extractKey = (keyPath, value) => {
  if (Array.isArray(keyPath)) {
    const result = [];
    for (let item of keyPath) {
      if (item !== void 0 && item !== null && typeof item !== "string" && item.toString) {
        item = item.toString();
      }
      const key = extractKey(item, value).key;
      result.push(valueToKey_default(key));
    }
    return {
      type: "found",
      key: result
    };
  }
  if (keyPath === "") {
    return {
      type: "found",
      key: value
    };
  }
  let remainingKeyPath = keyPath;
  let object = value;
  while (remainingKeyPath !== null) {
    let identifier;
    const i = remainingKeyPath.indexOf(".");
    if (i >= 0) {
      identifier = remainingKeyPath.slice(0, i);
      remainingKeyPath = remainingKeyPath.slice(i + 1);
    } else {
      identifier = remainingKeyPath;
      remainingKeyPath = null;
    }
    const isSpecialIdentifier = identifier === "length" && (typeof object === "string" || Array.isArray(object)) || (identifier === "size" || identifier === "type") && typeof Blob !== "undefined" && object instanceof Blob || (identifier === "name" || identifier === "lastModified") && typeof File !== "undefined" && object instanceof File;
    if (!isSpecialIdentifier && (typeof object !== "object" || object === null || !Object.hasOwn(object, identifier))) {
      return {
        type: "notFound"
      };
    }
    object = object[identifier];
  }
  return {
    type: "found",
    key: object
  };
};
var extractKey_default = extractKey;

// node_modules/fake-indexeddb/build/esm/lib/cloneValueForInsertion.js
function cloneValueForInsertion(value, transaction) {
  if (transaction._state !== "active") {
    throw new Error("Assert: transaction state is active");
  }
  transaction._state = "inactive";
  try {
    return structuredClone(value);
  } finally {
    transaction._state = "active";
  }
}

// node_modules/fake-indexeddb/build/esm/FDBCursor.js
var getEffectiveObjectStore = (cursor) => {
  if (cursor.source instanceof FDBObjectStore_default) {
    return cursor.source;
  }
  return cursor.source.objectStore;
};
var makeKeyRange = (range, lowers, uppers) => {
  let lower = range !== void 0 ? range.lower : void 0;
  let upper = range !== void 0 ? range.upper : void 0;
  for (const lowerTemp of lowers) {
    if (lowerTemp === void 0) {
      continue;
    }
    if (lower === void 0 || cmp_default(lower, lowerTemp) === 1) {
      lower = lowerTemp;
    }
  }
  for (const upperTemp of uppers) {
    if (upperTemp === void 0) {
      continue;
    }
    if (upper === void 0 || cmp_default(upper, upperTemp) === -1) {
      upper = upperTemp;
    }
  }
  if (lower !== void 0 && upper !== void 0) {
    return FDBKeyRange_default.bound(lower, upper);
  }
  if (lower !== void 0) {
    return FDBKeyRange_default.lowerBound(lower);
  }
  if (upper !== void 0) {
    return FDBKeyRange_default.upperBound(upper);
  }
};
var FDBCursor = class {
  _gotValue = false;
  _position = void 0;
  // Key of previously returned record
  _objectStorePosition = void 0;
  _keyOnly = false;
  _key = void 0;
  _primaryKey = void 0;
  constructor(source, range, direction = "next", request, keyOnly = false) {
    this._range = range;
    this._source = source;
    this._direction = direction;
    this._request = request;
    this._keyOnly = keyOnly;
  }
  // Read only properties
  get source() {
    return this._source;
  }
  set source(val) {
  }
  get request() {
    return this._request;
  }
  set request(val) {
  }
  get direction() {
    return this._direction;
  }
  set direction(val) {
  }
  get key() {
    return this._key;
  }
  set key(val) {
  }
  get primaryKey() {
    return this._primaryKey;
  }
  set primaryKey(val) {
  }
  // https://w3c.github.io/IndexedDB/#iterate-a-cursor
  _iterate(key, primaryKey) {
    const sourceIsObjectStore = this.source instanceof FDBObjectStore_default;
    const records = this.source instanceof FDBObjectStore_default ? this.source._rawObjectStore.records : this.source._rawIndex.records;
    let foundRecord;
    if (this.direction === "next") {
      const range = makeKeyRange(this._range, [key, this._position], []);
      for (const record of records.values(range)) {
        const cmpResultKey = key !== void 0 ? cmp_default(record.key, key) : void 0;
        const cmpResultPosition = this._position !== void 0 ? cmp_default(record.key, this._position) : void 0;
        if (key !== void 0) {
          if (cmpResultKey === -1) {
            continue;
          }
        }
        if (primaryKey !== void 0) {
          if (cmpResultKey === -1) {
            continue;
          }
          const cmpResultPrimaryKey = cmp_default(record.value, primaryKey);
          if (cmpResultKey === 0 && cmpResultPrimaryKey === -1) {
            continue;
          }
        }
        if (this._position !== void 0 && sourceIsObjectStore) {
          if (cmpResultPosition !== 1) {
            continue;
          }
        }
        if (this._position !== void 0 && !sourceIsObjectStore) {
          if (cmpResultPosition === -1) {
            continue;
          }
          if (cmpResultPosition === 0 && cmp_default(record.value, this._objectStorePosition) !== 1) {
            continue;
          }
        }
        if (this._range !== void 0) {
          if (!this._range.includes(record.key)) {
            continue;
          }
        }
        foundRecord = record;
        break;
      }
    } else if (this.direction === "nextunique") {
      const range = makeKeyRange(this._range, [key, this._position], []);
      for (const record of records.values(range)) {
        if (key !== void 0) {
          if (cmp_default(record.key, key) === -1) {
            continue;
          }
        }
        if (this._position !== void 0) {
          if (cmp_default(record.key, this._position) !== 1) {
            continue;
          }
        }
        if (this._range !== void 0) {
          if (!this._range.includes(record.key)) {
            continue;
          }
        }
        foundRecord = record;
        break;
      }
    } else if (this.direction === "prev") {
      const range = makeKeyRange(this._range, [], [key, this._position]);
      for (const record of records.values(range, "prev")) {
        const cmpResultKey = key !== void 0 ? cmp_default(record.key, key) : void 0;
        const cmpResultPosition = this._position !== void 0 ? cmp_default(record.key, this._position) : void 0;
        if (key !== void 0) {
          if (cmpResultKey === 1) {
            continue;
          }
        }
        if (primaryKey !== void 0) {
          if (cmpResultKey === 1) {
            continue;
          }
          const cmpResultPrimaryKey = cmp_default(record.value, primaryKey);
          if (cmpResultKey === 0 && cmpResultPrimaryKey === 1) {
            continue;
          }
        }
        if (this._position !== void 0 && sourceIsObjectStore) {
          if (cmpResultPosition !== -1) {
            continue;
          }
        }
        if (this._position !== void 0 && !sourceIsObjectStore) {
          if (cmpResultPosition === 1) {
            continue;
          }
          if (cmpResultPosition === 0 && cmp_default(record.value, this._objectStorePosition) !== -1) {
            continue;
          }
        }
        if (this._range !== void 0) {
          if (!this._range.includes(record.key)) {
            continue;
          }
        }
        foundRecord = record;
        break;
      }
    } else if (this.direction === "prevunique") {
      let tempRecord;
      const range = makeKeyRange(this._range, [], [key, this._position]);
      for (const record of records.values(range, "prev")) {
        if (key !== void 0) {
          if (cmp_default(record.key, key) === 1) {
            continue;
          }
        }
        if (this._position !== void 0) {
          if (cmp_default(record.key, this._position) !== -1) {
            continue;
          }
        }
        if (this._range !== void 0) {
          if (!this._range.includes(record.key)) {
            continue;
          }
        }
        tempRecord = record;
        break;
      }
      if (tempRecord) {
        foundRecord = records.get(tempRecord.key);
      }
    }
    let result;
    if (!foundRecord) {
      this._key = void 0;
      if (!sourceIsObjectStore) {
        this._objectStorePosition = void 0;
      }
      if (!this._keyOnly && this.toString() === "[object IDBCursorWithValue]") {
        this.value = void 0;
      }
      result = null;
    } else {
      this._position = foundRecord.key;
      if (!sourceIsObjectStore) {
        this._objectStorePosition = foundRecord.value;
      }
      this._key = foundRecord.key;
      if (sourceIsObjectStore) {
        this._primaryKey = structuredClone(foundRecord.key);
        if (!this._keyOnly && this.toString() === "[object IDBCursorWithValue]") {
          this.value = structuredClone(foundRecord.value);
        }
      } else {
        this._primaryKey = structuredClone(foundRecord.value);
        if (!this._keyOnly && this.toString() === "[object IDBCursorWithValue]") {
          if (this.source instanceof FDBObjectStore_default) {
            throw new Error("This should never happen");
          }
          const value = this.source.objectStore._rawObjectStore.getValue(foundRecord.value);
          this.value = structuredClone(value);
        }
      }
      this._gotValue = true;
      result = this;
    }
    return result;
  }
  // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBCursor-update-IDBRequest-any-value
  update(value) {
    if (value === void 0) {
      throw new TypeError();
    }
    const effectiveObjectStore = getEffectiveObjectStore(this);
    const effectiveKey = Object.hasOwn(this.source, "_rawIndex") ? this.primaryKey : this._position;
    const transaction = effectiveObjectStore.transaction;
    if (transaction._state !== "active") {
      throw new TransactionInactiveError();
    }
    if (transaction.mode === "readonly") {
      throw new ReadOnlyError();
    }
    if (effectiveObjectStore._rawObjectStore.deleted) {
      throw new InvalidStateError();
    }
    if (!(this.source instanceof FDBObjectStore_default) && this.source._rawIndex.deleted) {
      throw new InvalidStateError();
    }
    if (!this._gotValue || !Object.hasOwn(this, "value")) {
      throw new InvalidStateError();
    }
    const clone = cloneValueForInsertion(value, transaction);
    if (effectiveObjectStore.keyPath !== null) {
      let tempKey;
      try {
        tempKey = extractKey_default(effectiveObjectStore.keyPath, clone).key;
      } catch (err) {
      }
      if (cmp_default(tempKey, effectiveKey) !== 0) {
        throw new DataError();
      }
    }
    const record = {
      key: effectiveKey,
      value: clone
    };
    return transaction._execRequestAsync({
      operation: effectiveObjectStore._rawObjectStore.storeRecord.bind(effectiveObjectStore._rawObjectStore, record, false, transaction._rollbackLog),
      source: this
    });
  }
  // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBCursor-advance-void-unsigned-long-count
  advance(count) {
    if (!Number.isInteger(count) || count <= 0) {
      throw new TypeError();
    }
    const effectiveObjectStore = getEffectiveObjectStore(this);
    const transaction = effectiveObjectStore.transaction;
    if (transaction._state !== "active") {
      throw new TransactionInactiveError();
    }
    if (effectiveObjectStore._rawObjectStore.deleted) {
      throw new InvalidStateError();
    }
    if (!(this.source instanceof FDBObjectStore_default) && this.source._rawIndex.deleted) {
      throw new InvalidStateError();
    }
    if (!this._gotValue) {
      throw new InvalidStateError();
    }
    if (this._request) {
      this._request.readyState = "pending";
    }
    transaction._execRequestAsync({
      operation: () => {
        let result;
        for (let i = 0; i < count; i++) {
          result = this._iterate();
          if (!result) {
            break;
          }
        }
        return result;
      },
      request: this._request,
      source: this.source
    });
    this._gotValue = false;
  }
  // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBCursor-continue-void-any-key
  continue(key) {
    const effectiveObjectStore = getEffectiveObjectStore(this);
    const transaction = effectiveObjectStore.transaction;
    if (transaction._state !== "active") {
      throw new TransactionInactiveError();
    }
    if (effectiveObjectStore._rawObjectStore.deleted) {
      throw new InvalidStateError();
    }
    if (!(this.source instanceof FDBObjectStore_default) && this.source._rawIndex.deleted) {
      throw new InvalidStateError();
    }
    if (!this._gotValue) {
      throw new InvalidStateError();
    }
    if (key !== void 0) {
      key = valueToKey_default(key);
      const cmpResult = cmp_default(key, this._position);
      if (cmpResult <= 0 && (this.direction === "next" || this.direction === "nextunique") || cmpResult >= 0 && (this.direction === "prev" || this.direction === "prevunique")) {
        throw new DataError();
      }
    }
    if (this._request) {
      this._request.readyState = "pending";
    }
    transaction._execRequestAsync({
      operation: this._iterate.bind(this, key),
      request: this._request,
      source: this.source
    });
    this._gotValue = false;
  }
  // hthttps://w3c.github.io/IndexedDB/#dom-idbcursor-continueprimarykey
  continuePrimaryKey(key, primaryKey) {
    const effectiveObjectStore = getEffectiveObjectStore(this);
    const transaction = effectiveObjectStore.transaction;
    if (transaction._state !== "active") {
      throw new TransactionInactiveError();
    }
    if (effectiveObjectStore._rawObjectStore.deleted) {
      throw new InvalidStateError();
    }
    if (!(this.source instanceof FDBObjectStore_default) && this.source._rawIndex.deleted) {
      throw new InvalidStateError();
    }
    if (this.source instanceof FDBObjectStore_default || this.direction !== "next" && this.direction !== "prev") {
      throw new InvalidAccessError();
    }
    if (!this._gotValue) {
      throw new InvalidStateError();
    }
    if (key === void 0 || primaryKey === void 0) {
      throw new DataError();
    }
    key = valueToKey_default(key);
    const cmpResult = cmp_default(key, this._position);
    if (cmpResult === -1 && this.direction === "next" || cmpResult === 1 && this.direction === "prev") {
      throw new DataError();
    }
    const cmpResult2 = cmp_default(primaryKey, this._objectStorePosition);
    if (cmpResult === 0) {
      if (cmpResult2 <= 0 && this.direction === "next" || cmpResult2 >= 0 && this.direction === "prev") {
        throw new DataError();
      }
    }
    if (this._request) {
      this._request.readyState = "pending";
    }
    transaction._execRequestAsync({
      operation: this._iterate.bind(this, key, primaryKey),
      request: this._request,
      source: this.source
    });
    this._gotValue = false;
  }
  delete() {
    const effectiveObjectStore = getEffectiveObjectStore(this);
    const effectiveKey = Object.hasOwn(this.source, "_rawIndex") ? this.primaryKey : this._position;
    const transaction = effectiveObjectStore.transaction;
    if (transaction._state !== "active") {
      throw new TransactionInactiveError();
    }
    if (transaction.mode === "readonly") {
      throw new ReadOnlyError();
    }
    if (effectiveObjectStore._rawObjectStore.deleted) {
      throw new InvalidStateError();
    }
    if (!(this.source instanceof FDBObjectStore_default) && this.source._rawIndex.deleted) {
      throw new InvalidStateError();
    }
    if (!this._gotValue || !Object.hasOwn(this, "value")) {
      throw new InvalidStateError();
    }
    return transaction._execRequestAsync({
      operation: effectiveObjectStore._rawObjectStore.deleteRecord.bind(effectiveObjectStore._rawObjectStore, effectiveKey, transaction._rollbackLog),
      source: this
    });
  }
  get [Symbol.toStringTag]() {
    return "IDBCursor";
  }
};
var FDBCursor_default = FDBCursor;

// node_modules/fake-indexeddb/build/esm/FDBCursorWithValue.js
var FDBCursorWithValue = class extends FDBCursor_default {
  value = void 0;
  constructor(source, range, direction, request) {
    super(source, range, direction, request);
  }
  get [Symbol.toStringTag]() {
    return "IDBCursorWithValue";
  }
};
var FDBCursorWithValue_default = FDBCursorWithValue;

// node_modules/fake-indexeddb/build/esm/lib/FakeEventTarget.js
var stopped = (event, listener) => {
  return event.immediatePropagationStopped || event.eventPhase === event.CAPTURING_PHASE && listener.capture === false || event.eventPhase === event.BUBBLING_PHASE && listener.capture === true;
};
var invokeEventListeners = (event, obj) => {
  event.currentTarget = obj;
  const errors = [];
  const invoke = (callbackOrObject) => {
    try {
      const callback2 = typeof callbackOrObject === "function" ? callbackOrObject : callbackOrObject.handleEvent;
      callback2.call(event.currentTarget, event);
    } catch (err) {
      errors.push(err);
    }
  };
  for (const listener of obj.listeners.slice()) {
    if (event.type !== listener.type || stopped(event, listener)) {
      continue;
    }
    invoke(listener.callback);
  }
  const typeToProp = {
    abort: "onabort",
    blocked: "onblocked",
    close: "onclose",
    complete: "oncomplete",
    error: "onerror",
    success: "onsuccess",
    upgradeneeded: "onupgradeneeded",
    versionchange: "onversionchange"
  };
  const prop = typeToProp[event.type];
  if (prop === void 0) {
    throw new Error(`Unknown event type: "${event.type}"`);
  }
  const callback = event.currentTarget[prop];
  if (callback) {
    const listener = {
      callback,
      capture: false,
      type: event.type
    };
    if (!stopped(event, listener)) {
      invoke(listener.callback);
    }
  }
  if (errors.length) {
    throw new AggregateError(errors);
  }
};
var FakeEventTarget = class {
  listeners = [];
  // These will be overridden in individual subclasses and made not readonly
  addEventListener(type2, callback, options) {
    const capture = !!(typeof options === "object" && options ? options.capture : options);
    this.listeners.push({
      callback,
      capture,
      type: type2
    });
  }
  removeEventListener(type2, callback, options) {
    const capture = !!(typeof options === "object" && options ? options.capture : options);
    const i = this.listeners.findIndex((listener) => {
      return listener.type === type2 && listener.callback === callback && listener.capture === capture;
    });
    this.listeners.splice(i, 1);
  }
  // http://www.w3.org/TR/dom/#dispatching-events
  dispatchEvent(event) {
    if (event.dispatched || !event.initialized) {
      throw new InvalidStateError("The object is in an invalid state.");
    }
    event.isTrusted = false;
    event.dispatched = true;
    event.target = this;
    event.eventPhase = event.CAPTURING_PHASE;
    for (const obj of event.eventPath) {
      if (!event.propagationStopped) {
        invokeEventListeners(event, obj);
      }
    }
    event.eventPhase = event.AT_TARGET;
    if (!event.propagationStopped) {
      invokeEventListeners(event, event.target);
    }
    if (event.bubbles) {
      event.eventPath.reverse();
      event.eventPhase = event.BUBBLING_PHASE;
      for (const obj of event.eventPath) {
        if (!event.propagationStopped) {
          invokeEventListeners(event, obj);
        }
      }
    }
    event.dispatched = false;
    event.eventPhase = event.NONE;
    event.currentTarget = null;
    if (event.canceled) {
      return false;
    }
    return true;
  }
};
var FakeEventTarget_default = FakeEventTarget;

// node_modules/fake-indexeddb/build/esm/FDBRequest.js
var FDBRequest = class extends FakeEventTarget_default {
  _result = null;
  _error = null;
  source = null;
  transaction = null;
  readyState = "pending";
  onsuccess = null;
  onerror = null;
  get error() {
    if (this.readyState === "pending") {
      throw new InvalidStateError();
    }
    return this._error;
  }
  set error(value) {
    this._error = value;
  }
  get result() {
    if (this.readyState === "pending") {
      throw new InvalidStateError();
    }
    return this._result;
  }
  set result(value) {
    this._result = value;
  }
  get [Symbol.toStringTag]() {
    return "IDBRequest";
  }
};
var FDBRequest_default = FDBRequest;

// node_modules/fake-indexeddb/build/esm/lib/FakeDOMStringList.js
var FakeDOMStringList = class {
  constructor(...values) {
    this._values = values;
    for (let i = 0; i < values.length; i++) {
      this[i] = values[i];
    }
  }
  contains(value) {
    return this._values.includes(value);
  }
  item(i) {
    if (i < 0 || i >= this._values.length) {
      return null;
    }
    return this._values[i];
  }
  get length() {
    return this._values.length;
  }
  [Symbol.iterator]() {
    return this._values[Symbol.iterator]();
  }
  // Handled by proxy
  // Used internally, should not be used by others. I could maybe get rid of these and replace rather than mutate, but too lazy to check the spec.
  _push(...values) {
    for (let i = 0; i < values.length; i++) {
      this[this._values.length + i] = values[i];
    }
    this._values.push(...values);
  }
  _sort(...values) {
    this._values.sort(...values);
    for (let i = 0; i < this._values.length; i++) {
      this[i] = this._values[i];
    }
    return this;
  }
};
var FakeDOMStringList_default = FakeDOMStringList;

// node_modules/fake-indexeddb/build/esm/lib/valueToKeyRange.js
var valueToKeyRange = (value, nullDisallowedFlag = false) => {
  if (value instanceof FDBKeyRange_default) {
    return value;
  }
  if (value === null || value === void 0) {
    if (nullDisallowedFlag) {
      throw new DataError();
    }
    return new FDBKeyRange_default(void 0, void 0, false, false);
  }
  const key = valueToKey_default(value);
  return FDBKeyRange_default.only(key);
};
var valueToKeyRange_default = valueToKeyRange;

// node_modules/fake-indexeddb/build/esm/lib/getKeyPath.js
var convertKey = (key) => typeof key === "object" && key ? key + "" : key;
function getKeyPath(keyPath) {
  return Array.isArray(keyPath) ? keyPath.map(convertKey) : convertKey(keyPath);
}

// node_modules/fake-indexeddb/build/esm/lib/isPotentiallyValidKeyRange.js
var isPotentiallyValidKeyRange = (value) => {
  if (value instanceof FDBKeyRange_default) {
    return true;
  }
  const key = valueToKeyWithoutThrowing_default(value);
  return key !== INVALID_TYPE;
};
var isPotentiallyValidKeyRange_default = isPotentiallyValidKeyRange;

// node_modules/fake-indexeddb/build/esm/lib/enforceRange.js
var enforceRange = (num, type2) => {
  const min = 0;
  const max = type2 === "unsigned long" ? 4294967295 : 9007199254740991;
  if (isNaN(num) || num < min || num > max) {
    throw new TypeError();
  }
  if (num >= 0) {
    return Math.floor(num);
  }
};
var enforceRange_default = enforceRange;

// node_modules/fake-indexeddb/build/esm/lib/extractGetAllOptions.js
var extractGetAllOptions = (queryOrOptions, count, numArguments) => {
  let query;
  let direction;
  if (queryOrOptions === void 0 || queryOrOptions === null || isPotentiallyValidKeyRange_default(queryOrOptions)) {
    query = queryOrOptions;
    if (numArguments > 1 && count !== void 0) {
      count = enforceRange_default(count, "unsigned long");
    }
  } else {
    const getAllOptions = queryOrOptions;
    if (getAllOptions.query !== void 0) {
      query = getAllOptions.query;
    }
    if (getAllOptions.count !== void 0) {
      count = enforceRange_default(getAllOptions.count, "unsigned long");
    }
    if (getAllOptions.direction !== void 0) {
      direction = getAllOptions.direction;
    }
  }
  return {
    query,
    count,
    direction
  };
};
var extractGetAllOptions_default = extractGetAllOptions;

// node_modules/fake-indexeddb/build/esm/FDBIndex.js
var confirmActiveTransaction = (index) => {
  if (index._rawIndex.deleted || index.objectStore._rawObjectStore.deleted) {
    throw new InvalidStateError();
  }
  if (index.objectStore.transaction._state !== "active") {
    throw new TransactionInactiveError();
  }
};
var FDBIndex = class {
  constructor(objectStore, rawIndex) {
    this._rawIndex = rawIndex;
    this._name = rawIndex.name;
    this.objectStore = objectStore;
    this.keyPath = getKeyPath(rawIndex.keyPath);
    this.multiEntry = rawIndex.multiEntry;
    this.unique = rawIndex.unique;
  }
  get name() {
    return this._name;
  }
  // https://w3c.github.io/IndexedDB/#dom-idbindex-name
  set name(name) {
    const transaction = this.objectStore.transaction;
    if (!transaction.db._runningVersionchangeTransaction) {
      throw transaction._state === "active" ? new InvalidStateError() : new TransactionInactiveError();
    }
    if (transaction._state !== "active") {
      throw new TransactionInactiveError();
    }
    if (this._rawIndex.deleted || this.objectStore._rawObjectStore.deleted) {
      throw new InvalidStateError();
    }
    name = String(name);
    if (name === this._name) {
      return;
    }
    if (this.objectStore.indexNames.contains(name)) {
      throw new ConstraintError();
    }
    const oldName = this._name;
    const oldIndexNames = [...this.objectStore.indexNames];
    this._name = name;
    this._rawIndex.name = name;
    this.objectStore._indexesCache.delete(oldName);
    this.objectStore._indexesCache.set(name, this);
    this.objectStore._rawObjectStore.rawIndexes.delete(oldName);
    this.objectStore._rawObjectStore.rawIndexes.set(name, this._rawIndex);
    this.objectStore.indexNames = new FakeDOMStringList_default(...Array.from(this.objectStore._rawObjectStore.rawIndexes.keys()).filter((indexName) => {
      const index = this.objectStore._rawObjectStore.rawIndexes.get(indexName);
      return index && !index.deleted;
    }).sort());
    if (!this.objectStore.transaction._createdIndexes.has(this._rawIndex)) {
      transaction._rollbackLog.push(() => {
        this._name = oldName;
        this._rawIndex.name = oldName;
        this.objectStore._indexesCache.delete(name);
        this.objectStore._indexesCache.set(oldName, this);
        this.objectStore._rawObjectStore.rawIndexes.delete(name);
        this.objectStore._rawObjectStore.rawIndexes.set(oldName, this._rawIndex);
        this.objectStore.indexNames = new FakeDOMStringList_default(...oldIndexNames);
      });
    }
  }
  // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBIndex-openCursor-IDBRequest-any-range-IDBCursorDirection-direction
  openCursor(range, direction) {
    confirmActiveTransaction(this);
    if (range === null) {
      range = void 0;
    }
    if (range !== void 0 && !(range instanceof FDBKeyRange_default)) {
      range = FDBKeyRange_default.only(valueToKey_default(range));
    }
    const request = new FDBRequest_default();
    request.source = this;
    request.transaction = this.objectStore.transaction;
    const cursor = new FDBCursorWithValue_default(this, range, direction, request);
    return this.objectStore.transaction._execRequestAsync({
      operation: cursor._iterate.bind(cursor),
      request,
      source: this
    });
  }
  // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBIndex-openKeyCursor-IDBRequest-any-range-IDBCursorDirection-direction
  openKeyCursor(range, direction) {
    confirmActiveTransaction(this);
    if (range === null) {
      range = void 0;
    }
    if (range !== void 0 && !(range instanceof FDBKeyRange_default)) {
      range = FDBKeyRange_default.only(valueToKey_default(range));
    }
    const request = new FDBRequest_default();
    request.source = this;
    request.transaction = this.objectStore.transaction;
    const cursor = new FDBCursor_default(this, range, direction, request, true);
    return this.objectStore.transaction._execRequestAsync({
      operation: cursor._iterate.bind(cursor),
      request,
      source: this
    });
  }
  get(key) {
    confirmActiveTransaction(this);
    if (!(key instanceof FDBKeyRange_default)) {
      key = valueToKey_default(key);
    }
    return this.objectStore.transaction._execRequestAsync({
      operation: this._rawIndex.getValue.bind(this._rawIndex, key),
      source: this
    });
  }
  // http://w3c.github.io/IndexedDB/#dom-idbindex-getall
  getAll(queryOrOptions, count) {
    const options = extractGetAllOptions_default(queryOrOptions, count, arguments.length);
    confirmActiveTransaction(this);
    const range = valueToKeyRange_default(options.query);
    return this.objectStore.transaction._execRequestAsync({
      operation: this._rawIndex.getAllValues.bind(this._rawIndex, range, options.count, options.direction),
      source: this
    });
  }
  // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBIndex-getKey-IDBRequest-any-key
  getKey(key) {
    confirmActiveTransaction(this);
    if (!(key instanceof FDBKeyRange_default)) {
      key = valueToKey_default(key);
    }
    return this.objectStore.transaction._execRequestAsync({
      operation: this._rawIndex.getKey.bind(this._rawIndex, key),
      source: this
    });
  }
  // http://w3c.github.io/IndexedDB/#dom-idbindex-getallkeys
  getAllKeys(queryOrOptions, count) {
    const options = extractGetAllOptions_default(queryOrOptions, count, arguments.length);
    confirmActiveTransaction(this);
    const range = valueToKeyRange_default(options.query);
    return this.objectStore.transaction._execRequestAsync({
      operation: this._rawIndex.getAllKeys.bind(this._rawIndex, range, options.count, options.direction),
      source: this
    });
  }
  // https://www.w3.org/TR/IndexedDB/#dom-idbobjectstore-getallrecords
  getAllRecords(options) {
    let query;
    let count;
    let direction;
    if (options !== void 0) {
      if (options.query !== void 0) {
        query = options.query;
      }
      if (options.count !== void 0) {
        count = enforceRange_default(options.count, "unsigned long");
      }
      if (options.direction !== void 0) {
        direction = options.direction;
      }
    }
    confirmActiveTransaction(this);
    const range = valueToKeyRange_default(query);
    return this.objectStore.transaction._execRequestAsync({
      operation: this._rawIndex.getAllRecords.bind(this._rawIndex, range, count, direction),
      source: this
    });
  }
  // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBIndex-count-IDBRequest-any-key
  count(key) {
    confirmActiveTransaction(this);
    if (key === null) {
      key = void 0;
    }
    if (key !== void 0 && !(key instanceof FDBKeyRange_default)) {
      key = FDBKeyRange_default.only(valueToKey_default(key));
    }
    return this.objectStore.transaction._execRequestAsync({
      operation: () => {
        return this._rawIndex.count(key);
      },
      source: this
    });
  }
  get [Symbol.toStringTag]() {
    return "IDBIndex";
  }
};
var FDBIndex_default = FDBIndex;

// node_modules/fake-indexeddb/build/esm/lib/canInjectKey.js
var canInjectKey = (keyPath, value) => {
  if (Array.isArray(keyPath)) {
    throw new Error("The key paths used in this section are always strings and never sequences, since it is not possible to create a object store which has a key generator and also has a key path that is a sequence.");
  }
  const identifiers = keyPath.split(".");
  if (identifiers.length === 0) {
    throw new Error("Assert: identifiers is not empty");
  }
  identifiers.pop();
  for (const identifier of identifiers) {
    if (typeof value !== "object" && !Array.isArray(value)) {
      return false;
    }
    const hop = Object.hasOwn(value, identifier);
    if (!hop) {
      return true;
    }
    value = value[identifier];
  }
  return typeof value === "object" || Array.isArray(value);
};
var canInjectKey_default = canInjectKey;

// node_modules/fake-indexeddb/build/esm/FDBRecord.js
var FDBRecord = class {
  constructor(key, primaryKey, value) {
    this._key = key;
    this._primaryKey = primaryKey;
    this._value = value;
  }
  get key() {
    return this._key;
  }
  set key(_) {
  }
  get primaryKey() {
    return this._primaryKey;
  }
  set primaryKey(_) {
  }
  get value() {
    return this._value;
  }
  set value(_) {
  }
  get [Symbol.toStringTag]() {
    return "IDBRecord";
  }
};
var FDBRecord_default = FDBRecord;

// node_modules/fake-indexeddb/build/esm/lib/binarySearchTree.js
var MAX_TOMBSTONE_FACTOR = 2 / 3;
var EVERYTHING_KEY_RANGE = new FDBKeyRange_default(void 0, void 0, false, false);
var BinarySearchTree = class {
  _numTombstones = 0;
  _numNodes = 0;
  /**
   *
   * @param keysAreUnique - whether keys can be unique, and thus whether we cn skip checking `record.value` when
   * comparing. This is basically used to distinguish ObjectStores (where the value is the entire object, not used
   * as a key) from non-unique Indexes (where both the key and the value are meaningful keys used for sorting)
   */
  constructor(keysAreUnique) {
    this._keysAreUnique = !!keysAreUnique;
  }
  size() {
    return this._numNodes - this._numTombstones;
  }
  get(record) {
    return this._getByComparator(this._root, (otherRecord) => this._compare(record, otherRecord));
  }
  contains(record) {
    return !!this.get(record);
  }
  _compare(a, b) {
    const keyComparison = cmp_default(a.key, b.key);
    if (keyComparison !== 0) {
      return keyComparison;
    }
    return this._keysAreUnique ? 0 : cmp_default(a.value, b.value);
  }
  _getByComparator(node, comparator) {
    let current = node;
    while (current) {
      const comparison = comparator(current.record);
      if (comparison < 0) {
        current = current.left;
      } else if (comparison > 0) {
        current = current.right;
      } else {
        return current.record;
      }
    }
  }
  /**
   * Put a new record, and return the overwritten record if an overwrite occurred.
   * @param record
   * @param noOverwrite - throw a ConstraintError in case of overwrite
   */
  put(record, noOverwrite = false) {
    if (!this._root) {
      this._root = {
        record,
        left: void 0,
        right: void 0,
        parent: void 0,
        deleted: false,
        // the root is always black in a red-black tree
        red: false
      };
      this._numNodes++;
      return;
    }
    return this._put(this._root, record, noOverwrite);
  }
  _put(node, record, noOverwrite) {
    const comparison = this._compare(record, node.record);
    if (comparison < 0) {
      if (node.left) {
        return this._put(node.left, record, noOverwrite);
      } else {
        node.left = {
          record,
          left: void 0,
          right: void 0,
          parent: node,
          deleted: false,
          red: true
        };
        this._onNewNodeInserted(node.left);
      }
    } else if (comparison > 0) {
      if (node.right) {
        return this._put(node.right, record, noOverwrite);
      } else {
        node.right = {
          record,
          left: void 0,
          right: void 0,
          parent: node,
          deleted: false,
          red: true
        };
        this._onNewNodeInserted(node.right);
      }
    } else if (node.deleted) {
      node.deleted = false;
      node.record = record;
      this._numTombstones--;
    } else if (noOverwrite) {
      throw new ConstraintError();
    } else {
      const overwrittenRecord = node.record;
      node.record = record;
      return overwrittenRecord;
    }
  }
  delete(record) {
    if (!this._root) {
      return;
    }
    this._delete(this._root, record);
    if (this._numTombstones > this._numNodes * MAX_TOMBSTONE_FACTOR) {
      const records = [...this.getAllRecords()];
      this._root = this._rebuild(records, void 0, false);
      this._numNodes = records.length;
      this._numTombstones = 0;
    }
  }
  _delete(node, record) {
    if (!node) {
      return;
    }
    const comparison = this._compare(record, node.record);
    if (comparison < 0) {
      this._delete(node.left, record);
    } else if (comparison > 0) {
      this._delete(node.right, record);
    } else if (!node.deleted) {
      this._numTombstones++;
      node.deleted = true;
    }
  }
  *getAllRecords(descending = false) {
    yield* this.getRecords(EVERYTHING_KEY_RANGE, descending);
  }
  *getRecords(keyRange, descending = false) {
    yield* this._getRecordsForNode(this._root, keyRange, descending);
  }
  *_getRecordsForNode(node, keyRange, descending = false) {
    if (!node) {
      return;
    }
    yield* this._findRecords(node, keyRange, descending);
  }
  *_findRecords(node, keyRange, descending = false) {
    const {
      lower,
      upper,
      lowerOpen,
      upperOpen
    } = keyRange;
    const {
      record: {
        key
      }
    } = node;
    const lowerComparison = lower === void 0 ? -1 : cmp_default(lower, key);
    const upperComparison = upper === void 0 ? 1 : cmp_default(upper, key);
    const moreLeft = this._keysAreUnique ? lowerComparison < 0 : lowerComparison <= 0;
    const moreRight = this._keysAreUnique ? upperComparison > 0 : upperComparison >= 0;
    const moreStart = descending ? moreRight : moreLeft;
    const moreEnd = descending ? moreLeft : moreRight;
    const start = descending ? "right" : "left";
    const end = descending ? "left" : "right";
    const lowerMatches = lowerOpen ? lowerComparison < 0 : lowerComparison <= 0;
    const upperMatches = upperOpen ? upperComparison > 0 : upperComparison >= 0;
    if (moreStart && node[start]) {
      yield* this._findRecords(node[start], keyRange, descending);
    }
    if (lowerMatches && upperMatches && !node.deleted) {
      yield node.record;
    }
    if (moreEnd && node[end]) {
      yield* this._findRecords(node[end], keyRange, descending);
    }
  }
  _onNewNodeInserted(newNode) {
    this._numNodes++;
    this._rebalanceTree(newNode);
  }
  // based on https://en.wikipedia.org/wiki/Red%E2%80%93black_tree#Insertion
  _rebalanceTree(node) {
    let parent = node.parent;
    do {
      if (!parent.red) {
        return;
      }
      const grandparent = parent.parent;
      if (!grandparent) {
        parent.red = false;
        return;
      }
      const parentIsRightChild = parent === grandparent.right;
      const uncle = parentIsRightChild ? grandparent.left : grandparent.right;
      if (!uncle || !uncle.red) {
        if (node === (parentIsRightChild ? parent.left : parent.right)) {
          this._rotateSubtree(parent, parentIsRightChild);
          node = parent;
          parent = parentIsRightChild ? grandparent.right : grandparent.left;
        }
        this._rotateSubtree(grandparent, !parentIsRightChild);
        parent.red = false;
        grandparent.red = true;
        return;
      }
      parent.red = false;
      uncle.red = false;
      grandparent.red = true;
      node = grandparent;
    } while (node.parent ? parent = node.parent : false);
  }
  // based on https://en.wikipedia.org/wiki/Red%E2%80%93black_tree#Implementation
  _rotateSubtree(node, right) {
    const parent = node.parent;
    const newRoot = right ? node.left : node.right;
    const newChild = right ? newRoot.right : newRoot.left;
    node[right ? "left" : "right"] = newChild;
    if (newChild) {
      newChild.parent = node;
    }
    newRoot[right ? "right" : "left"] = node;
    newRoot.parent = parent;
    node.parent = newRoot;
    if (parent) {
      parent[node === parent.right ? "right" : "left"] = newRoot;
    } else {
      this._root = newRoot;
    }
    return newRoot;
  }
  // rebuild the whole tree from scratch, used to avoid too many deletion tombstones accumulating
  _rebuild(records, parent, red) {
    const {
      length
    } = records;
    if (!length) {
      return void 0;
    }
    const mid = length >>> 1;
    const node = {
      record: records[mid],
      left: void 0,
      right: void 0,
      parent,
      deleted: false,
      red
    };
    const left = this._rebuild(records.slice(0, mid), node, !red);
    const right = this._rebuild(records.slice(mid + 1), node, !red);
    node.left = left;
    node.right = right;
    return node;
  }
};

// node_modules/fake-indexeddb/build/esm/lib/RecordStore.js
var RecordStore = class {
  constructor(keysAreUnique) {
    this.keysAreUnique = keysAreUnique;
    this.records = new BinarySearchTree(this.keysAreUnique);
  }
  get(key) {
    const range = key instanceof FDBKeyRange_default ? key : FDBKeyRange_default.only(key);
    return this.records.getRecords(range).next().value;
  }
  /**
   * Put a new record, and return the overwritten record if an overwrite occurred.
   * @param newRecord
   * @param noOverwrite - throw a ConstraintError in case of overwrite
   */
  put(newRecord, noOverwrite = false) {
    return this.records.put(newRecord, noOverwrite);
  }
  delete(key) {
    const range = key instanceof FDBKeyRange_default ? key : FDBKeyRange_default.only(key);
    const deletedRecords = [...this.records.getRecords(range)];
    for (const record of deletedRecords) {
      this.records.delete(record);
    }
    return deletedRecords;
  }
  deleteByValue(key) {
    const range = key instanceof FDBKeyRange_default ? key : FDBKeyRange_default.only(key);
    const deletedRecords = [];
    for (const record of this.records.getAllRecords()) {
      if (range.includes(record.value)) {
        this.records.delete(record);
        deletedRecords.push(record);
      }
    }
    return deletedRecords;
  }
  clear() {
    const deletedRecords = [...this.records.getAllRecords()];
    this.records = new BinarySearchTree(this.keysAreUnique);
    return deletedRecords;
  }
  values(range, direction = "next") {
    const descending = direction === "prev" || direction === "prevunique";
    const records = range ? this.records.getRecords(range, descending) : this.records.getAllRecords(descending);
    return {
      [Symbol.iterator]: () => {
        const next = () => {
          return records.next();
        };
        if (direction === "next" || direction === "prev") {
          return {
            next
          };
        }
        if (direction === "nextunique") {
          let previousValue = void 0;
          return {
            next: () => {
              let current2 = next();
              while (!current2.done && previousValue !== void 0 && cmp_default(previousValue.key, current2.value.key) === 0) {
                current2 = next();
              }
              previousValue = current2.value;
              return current2;
            }
          };
        }
        let current = next();
        let nextResult = next();
        return {
          next: () => {
            while (!nextResult.done && cmp_default(current.value.key, nextResult.value.key) === 0) {
              current = nextResult;
              nextResult = next();
            }
            const result = current;
            current = nextResult;
            nextResult = next();
            return result;
          }
        };
      }
    };
  }
  size() {
    return this.records.size();
  }
};
var RecordStore_default = RecordStore;

// node_modules/fake-indexeddb/build/esm/lib/Index.js
var Index = class {
  deleted = false;
  // Initialized should be used to decide whether to throw an error or abort the versionchange transaction when there is a
  // constraint
  initialized = false;
  constructor(rawObjectStore, name, keyPath, multiEntry, unique) {
    this.rawObjectStore = rawObjectStore;
    this.name = name;
    this.keyPath = keyPath;
    this.multiEntry = multiEntry;
    this.unique = unique;
    this.records = new RecordStore_default(unique);
  }
  // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-retrieving-a-value-from-an-index
  getKey(key) {
    const record = this.records.get(key);
    return record !== void 0 ? record.value : void 0;
  }
  // http://w3c.github.io/IndexedDB/#retrieve-multiple-referenced-values-from-an-index
  getAllKeys(range, count, direction) {
    if (count === void 0 || count === 0) {
      count = Infinity;
    }
    const records = [];
    for (const record of this.records.values(range, direction)) {
      records.push(structuredClone(record.value));
      if (records.length >= count) {
        break;
      }
    }
    return records;
  }
  // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#index-referenced-value-retrieval-operation
  getValue(key) {
    const record = this.records.get(key);
    return record !== void 0 ? this.rawObjectStore.getValue(record.value) : void 0;
  }
  // http://w3c.github.io/IndexedDB/#retrieve-multiple-referenced-values-from-an-index
  getAllValues(range, count, direction) {
    if (count === void 0 || count === 0) {
      count = Infinity;
    }
    const records = [];
    for (const record of this.records.values(range, direction)) {
      records.push(this.rawObjectStore.getValue(record.value));
      if (records.length >= count) {
        break;
      }
    }
    return records;
  }
  // https://www.w3.org/TR/IndexedDB/#dom-idbindex-getallrecords
  getAllRecords(range, count, direction) {
    if (count === void 0 || count === 0) {
      count = Infinity;
    }
    const records = [];
    for (const record of this.records.values(range, direction)) {
      records.push(new FDBRecord_default(structuredClone(record.key), structuredClone(this.rawObjectStore.getKey(record.value)), this.rawObjectStore.getValue(record.value)));
      if (records.length >= count) {
        break;
      }
    }
    return records;
  }
  // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-storing-a-record-into-an-object-store (step 7)
  storeRecord(newRecord) {
    let indexKey;
    try {
      indexKey = extractKey_default(this.keyPath, newRecord.value).key;
    } catch (err) {
      if (err.name === "DataError") {
        return;
      }
      throw err;
    }
    if (!this.multiEntry || !Array.isArray(indexKey)) {
      try {
        valueToKey_default(indexKey);
      } catch (e) {
        return;
      }
    } else {
      const keep = [];
      for (const part of indexKey) {
        if (keep.indexOf(part) < 0) {
          try {
            keep.push(valueToKey_default(part));
          } catch (err) {
          }
        }
      }
      indexKey = keep;
    }
    if (!this.multiEntry || !Array.isArray(indexKey)) {
      if (this.unique) {
        const existingRecord = this.records.get(indexKey);
        if (existingRecord) {
          throw new ConstraintError();
        }
      }
    } else {
      if (this.unique) {
        for (const individualIndexKey of indexKey) {
          const existingRecord = this.records.get(individualIndexKey);
          if (existingRecord) {
            throw new ConstraintError();
          }
        }
      }
    }
    if (!this.multiEntry || !Array.isArray(indexKey)) {
      this.records.put({
        key: indexKey,
        value: newRecord.key
      });
    } else {
      for (const individualIndexKey of indexKey) {
        this.records.put({
          key: individualIndexKey,
          value: newRecord.key
        });
      }
    }
  }
  initialize(transaction) {
    if (this.initialized) {
      throw new Error("Index already initialized");
    }
    transaction._execRequestAsync({
      operation: () => {
        try {
          for (const record of this.rawObjectStore.records.values()) {
            this.storeRecord(record);
          }
          this.initialized = true;
        } catch (err) {
          transaction._abort(err.name);
        }
      },
      source: null
    });
  }
  count(range) {
    let count = 0;
    for (const record of this.records.values(range)) {
      count += 1;
    }
    return count;
  }
};
var Index_default = Index;

// node_modules/fake-indexeddb/build/esm/lib/validateKeyPath.js
var validateKeyPath = (keyPath, parent) => {
  if (keyPath !== void 0 && keyPath !== null && typeof keyPath !== "string" && keyPath.toString && (parent === "array" || !Array.isArray(keyPath))) {
    keyPath = keyPath.toString();
  }
  if (typeof keyPath === "string") {
    if (keyPath === "" && parent !== "string") {
      return;
    }
    try {
      const validIdentifierRegex = (
        // eslint-disable-next-line no-misleading-character-class
        /^(?:[$A-Z_a-z\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0370-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u05D0-\u05EA\u05F0-\u05F2\u0620-\u064A\u066E\u066F\u0671-\u06D3\u06D5\u06E5\u06E6\u06EE\u06EF\u06FA-\u06FC\u06FF\u0710\u0712-\u072F\u074D-\u07A5\u07B1\u07CA-\u07EA\u07F4\u07F5\u07FA\u0800-\u0815\u081A\u0824\u0828\u0840-\u0858\u08A0-\u08B2\u0904-\u0939\u093D\u0950\u0958-\u0961\u0971-\u0980\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BD\u09CE\u09DC\u09DD\u09DF-\u09E1\u09F0\u09F1\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A59-\u0A5C\u0A5E\u0A72-\u0A74\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABD\u0AD0\u0AE0\u0AE1\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3D\u0B5C\u0B5D\u0B5F-\u0B61\u0B71\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BD0\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D\u0C58\u0C59\u0C60\u0C61\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBD\u0CDE\u0CE0\u0CE1\u0CF1\u0CF2\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D\u0D4E\u0D60\u0D61\u0D7A-\u0D7F\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0E01-\u0E30\u0E32\u0E33\u0E40-\u0E46\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB0\u0EB2\u0EB3\u0EBD\u0EC0-\u0EC4\u0EC6\u0EDC-\u0EDF\u0F00\u0F40-\u0F47\u0F49-\u0F6C\u0F88-\u0F8C\u1000-\u102A\u103F\u1050-\u1055\u105A-\u105D\u1061\u1065\u1066\u106E-\u1070\u1075-\u1081\u108E\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1711\u1720-\u1731\u1740-\u1751\u1760-\u176C\u176E-\u1770\u1780-\u17B3\u17D7\u17DC\u1820-\u1877\u1880-\u18A8\u18AA\u18B0-\u18F5\u1900-\u191E\u1950-\u196D\u1970-\u1974\u1980-\u19AB\u19C1-\u19C7\u1A00-\u1A16\u1A20-\u1A54\u1AA7\u1B05-\u1B33\u1B45-\u1B4B\u1B83-\u1BA0\u1BAE\u1BAF\u1BBA-\u1BE5\u1C00-\u1C23\u1C4D-\u1C4F\u1C5A-\u1C7D\u1CE9-\u1CEC\u1CEE-\u1CF1\u1CF5\u1CF6\u1D00-\u1DBF\u1E00-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u2071\u207F\u2090-\u209C\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CEE\u2CF2\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D80-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2E2F\u3005-\u3007\u3021-\u3029\u3031-\u3035\u3038-\u303C\u3041-\u3096\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA61F\uA62A\uA62B\uA640-\uA66E\uA67F-\uA69D\uA6A0-\uA6EF\uA717-\uA71F\uA722-\uA788\uA78B-\uA78E\uA790-\uA7AD\uA7B0\uA7B1\uA7F7-\uA801\uA803-\uA805\uA807-\uA80A\uA80C-\uA822\uA840-\uA873\uA882-\uA8B3\uA8F2-\uA8F7\uA8FB\uA90A-\uA925\uA930-\uA946\uA960-\uA97C\uA984-\uA9B2\uA9CF\uA9E0-\uA9E4\uA9E6-\uA9EF\uA9FA-\uA9FE\uAA00-\uAA28\uAA40-\uAA42\uAA44-\uAA4B\uAA60-\uAA76\uAA7A\uAA7E-\uAAAF\uAAB1\uAAB5\uAAB6\uAAB9-\uAABD\uAAC0\uAAC2\uAADB-\uAADD\uAAE0-\uAAEA\uAAF2-\uAAF4\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB5F\uAB64\uAB65\uABC0-\uABE2\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D\uFB1F-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE70-\uFE74\uFE76-\uFEFC\uFF21-\uFF3A\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC])(?:[$0-9A-Z_a-z\xAA\xB5\xBA\xC0-\xD6\xD8-\xF6\xF8-\u02C1\u02C6-\u02D1\u02E0-\u02E4\u02EC\u02EE\u0300-\u0374\u0376\u0377\u037A-\u037D\u037F\u0386\u0388-\u038A\u038C\u038E-\u03A1\u03A3-\u03F5\u03F7-\u0481\u0483-\u0487\u048A-\u052F\u0531-\u0556\u0559\u0561-\u0587\u0591-\u05BD\u05BF\u05C1\u05C2\u05C4\u05C5\u05C7\u05D0-\u05EA\u05F0-\u05F2\u0610-\u061A\u0620-\u0669\u066E-\u06D3\u06D5-\u06DC\u06DF-\u06E8\u06EA-\u06FC\u06FF\u0710-\u074A\u074D-\u07B1\u07C0-\u07F5\u07FA\u0800-\u082D\u0840-\u085B\u08A0-\u08B2\u08E4-\u0963\u0966-\u096F\u0971-\u0983\u0985-\u098C\u098F\u0990\u0993-\u09A8\u09AA-\u09B0\u09B2\u09B6-\u09B9\u09BC-\u09C4\u09C7\u09C8\u09CB-\u09CE\u09D7\u09DC\u09DD\u09DF-\u09E3\u09E6-\u09F1\u0A01-\u0A03\u0A05-\u0A0A\u0A0F\u0A10\u0A13-\u0A28\u0A2A-\u0A30\u0A32\u0A33\u0A35\u0A36\u0A38\u0A39\u0A3C\u0A3E-\u0A42\u0A47\u0A48\u0A4B-\u0A4D\u0A51\u0A59-\u0A5C\u0A5E\u0A66-\u0A75\u0A81-\u0A83\u0A85-\u0A8D\u0A8F-\u0A91\u0A93-\u0AA8\u0AAA-\u0AB0\u0AB2\u0AB3\u0AB5-\u0AB9\u0ABC-\u0AC5\u0AC7-\u0AC9\u0ACB-\u0ACD\u0AD0\u0AE0-\u0AE3\u0AE6-\u0AEF\u0B01-\u0B03\u0B05-\u0B0C\u0B0F\u0B10\u0B13-\u0B28\u0B2A-\u0B30\u0B32\u0B33\u0B35-\u0B39\u0B3C-\u0B44\u0B47\u0B48\u0B4B-\u0B4D\u0B56\u0B57\u0B5C\u0B5D\u0B5F-\u0B63\u0B66-\u0B6F\u0B71\u0B82\u0B83\u0B85-\u0B8A\u0B8E-\u0B90\u0B92-\u0B95\u0B99\u0B9A\u0B9C\u0B9E\u0B9F\u0BA3\u0BA4\u0BA8-\u0BAA\u0BAE-\u0BB9\u0BBE-\u0BC2\u0BC6-\u0BC8\u0BCA-\u0BCD\u0BD0\u0BD7\u0BE6-\u0BEF\u0C00-\u0C03\u0C05-\u0C0C\u0C0E-\u0C10\u0C12-\u0C28\u0C2A-\u0C39\u0C3D-\u0C44\u0C46-\u0C48\u0C4A-\u0C4D\u0C55\u0C56\u0C58\u0C59\u0C60-\u0C63\u0C66-\u0C6F\u0C81-\u0C83\u0C85-\u0C8C\u0C8E-\u0C90\u0C92-\u0CA8\u0CAA-\u0CB3\u0CB5-\u0CB9\u0CBC-\u0CC4\u0CC6-\u0CC8\u0CCA-\u0CCD\u0CD5\u0CD6\u0CDE\u0CE0-\u0CE3\u0CE6-\u0CEF\u0CF1\u0CF2\u0D01-\u0D03\u0D05-\u0D0C\u0D0E-\u0D10\u0D12-\u0D3A\u0D3D-\u0D44\u0D46-\u0D48\u0D4A-\u0D4E\u0D57\u0D60-\u0D63\u0D66-\u0D6F\u0D7A-\u0D7F\u0D82\u0D83\u0D85-\u0D96\u0D9A-\u0DB1\u0DB3-\u0DBB\u0DBD\u0DC0-\u0DC6\u0DCA\u0DCF-\u0DD4\u0DD6\u0DD8-\u0DDF\u0DE6-\u0DEF\u0DF2\u0DF3\u0E01-\u0E3A\u0E40-\u0E4E\u0E50-\u0E59\u0E81\u0E82\u0E84\u0E87\u0E88\u0E8A\u0E8D\u0E94-\u0E97\u0E99-\u0E9F\u0EA1-\u0EA3\u0EA5\u0EA7\u0EAA\u0EAB\u0EAD-\u0EB9\u0EBB-\u0EBD\u0EC0-\u0EC4\u0EC6\u0EC8-\u0ECD\u0ED0-\u0ED9\u0EDC-\u0EDF\u0F00\u0F18\u0F19\u0F20-\u0F29\u0F35\u0F37\u0F39\u0F3E-\u0F47\u0F49-\u0F6C\u0F71-\u0F84\u0F86-\u0F97\u0F99-\u0FBC\u0FC6\u1000-\u1049\u1050-\u109D\u10A0-\u10C5\u10C7\u10CD\u10D0-\u10FA\u10FC-\u1248\u124A-\u124D\u1250-\u1256\u1258\u125A-\u125D\u1260-\u1288\u128A-\u128D\u1290-\u12B0\u12B2-\u12B5\u12B8-\u12BE\u12C0\u12C2-\u12C5\u12C8-\u12D6\u12D8-\u1310\u1312-\u1315\u1318-\u135A\u135D-\u135F\u1380-\u138F\u13A0-\u13F4\u1401-\u166C\u166F-\u167F\u1681-\u169A\u16A0-\u16EA\u16EE-\u16F8\u1700-\u170C\u170E-\u1714\u1720-\u1734\u1740-\u1753\u1760-\u176C\u176E-\u1770\u1772\u1773\u1780-\u17D3\u17D7\u17DC\u17DD\u17E0-\u17E9\u180B-\u180D\u1810-\u1819\u1820-\u1877\u1880-\u18AA\u18B0-\u18F5\u1900-\u191E\u1920-\u192B\u1930-\u193B\u1946-\u196D\u1970-\u1974\u1980-\u19AB\u19B0-\u19C9\u19D0-\u19D9\u1A00-\u1A1B\u1A20-\u1A5E\u1A60-\u1A7C\u1A7F-\u1A89\u1A90-\u1A99\u1AA7\u1AB0-\u1ABD\u1B00-\u1B4B\u1B50-\u1B59\u1B6B-\u1B73\u1B80-\u1BF3\u1C00-\u1C37\u1C40-\u1C49\u1C4D-\u1C7D\u1CD0-\u1CD2\u1CD4-\u1CF6\u1CF8\u1CF9\u1D00-\u1DF5\u1DFC-\u1F15\u1F18-\u1F1D\u1F20-\u1F45\u1F48-\u1F4D\u1F50-\u1F57\u1F59\u1F5B\u1F5D\u1F5F-\u1F7D\u1F80-\u1FB4\u1FB6-\u1FBC\u1FBE\u1FC2-\u1FC4\u1FC6-\u1FCC\u1FD0-\u1FD3\u1FD6-\u1FDB\u1FE0-\u1FEC\u1FF2-\u1FF4\u1FF6-\u1FFC\u200C\u200D\u203F\u2040\u2054\u2071\u207F\u2090-\u209C\u20D0-\u20DC\u20E1\u20E5-\u20F0\u2102\u2107\u210A-\u2113\u2115\u2119-\u211D\u2124\u2126\u2128\u212A-\u212D\u212F-\u2139\u213C-\u213F\u2145-\u2149\u214E\u2160-\u2188\u2C00-\u2C2E\u2C30-\u2C5E\u2C60-\u2CE4\u2CEB-\u2CF3\u2D00-\u2D25\u2D27\u2D2D\u2D30-\u2D67\u2D6F\u2D7F-\u2D96\u2DA0-\u2DA6\u2DA8-\u2DAE\u2DB0-\u2DB6\u2DB8-\u2DBE\u2DC0-\u2DC6\u2DC8-\u2DCE\u2DD0-\u2DD6\u2DD8-\u2DDE\u2DE0-\u2DFF\u2E2F\u3005-\u3007\u3021-\u302F\u3031-\u3035\u3038-\u303C\u3041-\u3096\u3099\u309A\u309D-\u309F\u30A1-\u30FA\u30FC-\u30FF\u3105-\u312D\u3131-\u318E\u31A0-\u31BA\u31F0-\u31FF\u3400-\u4DB5\u4E00-\u9FCC\uA000-\uA48C\uA4D0-\uA4FD\uA500-\uA60C\uA610-\uA62B\uA640-\uA66F\uA674-\uA67D\uA67F-\uA69D\uA69F-\uA6F1\uA717-\uA71F\uA722-\uA788\uA78B-\uA78E\uA790-\uA7AD\uA7B0\uA7B1\uA7F7-\uA827\uA840-\uA873\uA880-\uA8C4\uA8D0-\uA8D9\uA8E0-\uA8F7\uA8FB\uA900-\uA92D\uA930-\uA953\uA960-\uA97C\uA980-\uA9C0\uA9CF-\uA9D9\uA9E0-\uA9FE\uAA00-\uAA36\uAA40-\uAA4D\uAA50-\uAA59\uAA60-\uAA76\uAA7A-\uAAC2\uAADB-\uAADD\uAAE0-\uAAEF\uAAF2-\uAAF6\uAB01-\uAB06\uAB09-\uAB0E\uAB11-\uAB16\uAB20-\uAB26\uAB28-\uAB2E\uAB30-\uAB5A\uAB5C-\uAB5F\uAB64\uAB65\uABC0-\uABEA\uABEC\uABED\uABF0-\uABF9\uAC00-\uD7A3\uD7B0-\uD7C6\uD7CB-\uD7FB\uF900-\uFA6D\uFA70-\uFAD9\uFB00-\uFB06\uFB13-\uFB17\uFB1D-\uFB28\uFB2A-\uFB36\uFB38-\uFB3C\uFB3E\uFB40\uFB41\uFB43\uFB44\uFB46-\uFBB1\uFBD3-\uFD3D\uFD50-\uFD8F\uFD92-\uFDC7\uFDF0-\uFDFB\uFE00-\uFE0F\uFE20-\uFE2D\uFE33\uFE34\uFE4D-\uFE4F\uFE70-\uFE74\uFE76-\uFEFC\uFF10-\uFF19\uFF21-\uFF3A\uFF3F\uFF41-\uFF5A\uFF66-\uFFBE\uFFC2-\uFFC7\uFFCA-\uFFCF\uFFD2-\uFFD7\uFFDA-\uFFDC])*$/
      );
      if (keyPath.length >= 1 && validIdentifierRegex.test(keyPath)) {
        return;
      }
    } catch (err) {
      throw new SyntaxError2(err.message);
    }
    if (keyPath.indexOf(" ") >= 0) {
      throw new SyntaxError2("The keypath argument contains an invalid key path (no spaces allowed).");
    }
  }
  if (Array.isArray(keyPath) && keyPath.length > 0) {
    if (parent) {
      throw new SyntaxError2("The keypath argument contains an invalid key path (nested arrays).");
    }
    for (const part of keyPath) {
      validateKeyPath(part, "array");
    }
    return;
  } else if (typeof keyPath === "string" && keyPath.indexOf(".") >= 0) {
    keyPath = keyPath.split(".");
    for (const part of keyPath) {
      validateKeyPath(part, "string");
    }
    return;
  }
  throw new SyntaxError2();
};
var validateKeyPath_default = validateKeyPath;

// node_modules/fake-indexeddb/build/esm/FDBObjectStore.js
var confirmActiveTransaction2 = (objectStore) => {
  if (objectStore._rawObjectStore.deleted) {
    throw new InvalidStateError();
  }
  if (objectStore.transaction._state !== "active") {
    throw new TransactionInactiveError();
  }
};
var buildRecordAddPut = (objectStore, value, key) => {
  confirmActiveTransaction2(objectStore);
  if (objectStore.transaction.mode === "readonly") {
    throw new ReadOnlyError();
  }
  if (objectStore.keyPath !== null) {
    if (key !== void 0) {
      throw new DataError();
    }
  }
  const clone = cloneValueForInsertion(value, objectStore.transaction);
  if (objectStore.keyPath !== null) {
    const tempKey = extractKey_default(objectStore.keyPath, clone);
    if (tempKey.type === "found") {
      valueToKey_default(tempKey.key);
    } else {
      if (!objectStore._rawObjectStore.keyGenerator) {
        throw new DataError();
      } else if (!canInjectKey_default(objectStore.keyPath, clone)) {
        throw new DataError();
      }
    }
  }
  if (objectStore.keyPath === null && objectStore._rawObjectStore.keyGenerator === null && key === void 0) {
    throw new DataError();
  }
  if (key !== void 0) {
    key = valueToKey_default(key);
  }
  return {
    key,
    value: clone
  };
};
var FDBObjectStore = class {
  _indexesCache = /* @__PURE__ */ new Map();
  constructor(transaction, rawObjectStore) {
    this._rawObjectStore = rawObjectStore;
    this._name = rawObjectStore.name;
    this.keyPath = getKeyPath(rawObjectStore.keyPath);
    this.autoIncrement = rawObjectStore.autoIncrement;
    this.transaction = transaction;
    this.indexNames = new FakeDOMStringList_default(...Array.from(rawObjectStore.rawIndexes.keys()).sort());
  }
  get name() {
    return this._name;
  }
  // http://w3c.github.io/IndexedDB/#dom-idbobjectstore-name
  set name(name) {
    const transaction = this.transaction;
    if (!transaction.db._runningVersionchangeTransaction) {
      throw transaction._state === "active" ? new InvalidStateError() : new TransactionInactiveError();
    }
    confirmActiveTransaction2(this);
    name = String(name);
    if (name === this._name) {
      return;
    }
    if (this._rawObjectStore.rawDatabase.rawObjectStores.has(name)) {
      throw new ConstraintError();
    }
    const oldName = this._name;
    const oldObjectStoreNames = [...transaction.db.objectStoreNames];
    this._name = name;
    this._rawObjectStore.name = name;
    this.transaction._objectStoresCache.delete(oldName);
    this.transaction._objectStoresCache.set(name, this);
    this._rawObjectStore.rawDatabase.rawObjectStores.delete(oldName);
    this._rawObjectStore.rawDatabase.rawObjectStores.set(name, this._rawObjectStore);
    transaction.db.objectStoreNames = new FakeDOMStringList_default(...Array.from(this._rawObjectStore.rawDatabase.rawObjectStores.keys()).filter((objectStoreName) => {
      const objectStore = this._rawObjectStore.rawDatabase.rawObjectStores.get(objectStoreName);
      return objectStore && !objectStore.deleted;
    }).sort());
    const oldScope = new Set(transaction._scope);
    const oldTransactionObjectStoreNames = [...transaction.objectStoreNames];
    this.transaction._scope.delete(oldName);
    transaction._scope.add(name);
    transaction.objectStoreNames = new FakeDOMStringList_default(...Array.from(transaction._scope).sort());
    if (!this.transaction._createdObjectStores.has(this._rawObjectStore)) {
      transaction._rollbackLog.push(() => {
        this._name = oldName;
        this._rawObjectStore.name = oldName;
        this.transaction._objectStoresCache.delete(name);
        this.transaction._objectStoresCache.set(oldName, this);
        this._rawObjectStore.rawDatabase.rawObjectStores.delete(name);
        this._rawObjectStore.rawDatabase.rawObjectStores.set(oldName, this._rawObjectStore);
        transaction.db.objectStoreNames = new FakeDOMStringList_default(...oldObjectStoreNames);
        transaction._scope = oldScope;
        transaction.objectStoreNames = new FakeDOMStringList_default(...oldTransactionObjectStoreNames);
      });
    }
  }
  put(value, key) {
    if (arguments.length === 0) {
      throw new TypeError();
    }
    const record = buildRecordAddPut(this, value, key);
    return this.transaction._execRequestAsync({
      operation: this._rawObjectStore.storeRecord.bind(this._rawObjectStore, record, false, this.transaction._rollbackLog),
      source: this
    });
  }
  add(value, key) {
    if (arguments.length === 0) {
      throw new TypeError();
    }
    const record = buildRecordAddPut(this, value, key);
    return this.transaction._execRequestAsync({
      operation: this._rawObjectStore.storeRecord.bind(this._rawObjectStore, record, true, this.transaction._rollbackLog),
      source: this
    });
  }
  delete(key) {
    if (arguments.length === 0) {
      throw new TypeError();
    }
    confirmActiveTransaction2(this);
    if (this.transaction.mode === "readonly") {
      throw new ReadOnlyError();
    }
    if (!(key instanceof FDBKeyRange_default)) {
      key = valueToKey_default(key);
    }
    return this.transaction._execRequestAsync({
      operation: this._rawObjectStore.deleteRecord.bind(this._rawObjectStore, key, this.transaction._rollbackLog),
      source: this
    });
  }
  get(key) {
    if (arguments.length === 0) {
      throw new TypeError();
    }
    confirmActiveTransaction2(this);
    if (!(key instanceof FDBKeyRange_default)) {
      key = valueToKey_default(key);
    }
    return this.transaction._execRequestAsync({
      operation: this._rawObjectStore.getValue.bind(this._rawObjectStore, key),
      source: this
    });
  }
  // http://w3c.github.io/IndexedDB/#dom-idbobjectstore-getall
  getAll(queryOrOptions, count) {
    const options = extractGetAllOptions_default(queryOrOptions, count, arguments.length);
    confirmActiveTransaction2(this);
    const range = valueToKeyRange_default(options.query);
    return this.transaction._execRequestAsync({
      operation: this._rawObjectStore.getAllValues.bind(this._rawObjectStore, range, options.count, options.direction),
      source: this
    });
  }
  // http://w3c.github.io/IndexedDB/#dom-idbobjectstore-getkey
  getKey(key) {
    if (arguments.length === 0) {
      throw new TypeError();
    }
    confirmActiveTransaction2(this);
    if (!(key instanceof FDBKeyRange_default)) {
      key = valueToKey_default(key);
    }
    return this.transaction._execRequestAsync({
      operation: this._rawObjectStore.getKey.bind(this._rawObjectStore, key),
      source: this
    });
  }
  // http://w3c.github.io/IndexedDB/#dom-idbobjectstore-getallkeys
  getAllKeys(queryOrOptions, count) {
    const options = extractGetAllOptions_default(queryOrOptions, count, arguments.length);
    confirmActiveTransaction2(this);
    const range = valueToKeyRange_default(options.query);
    return this.transaction._execRequestAsync({
      operation: this._rawObjectStore.getAllKeys.bind(this._rawObjectStore, range, options.count, options.direction),
      source: this
    });
  }
  // https://www.w3.org/TR/IndexedDB/#dom-idbobjectstore-getallrecords
  getAllRecords(options) {
    let query;
    let count;
    let direction;
    if (options !== void 0) {
      if (options.query !== void 0) {
        query = options.query;
      }
      if (options.count !== void 0) {
        count = enforceRange_default(options.count, "unsigned long");
      }
      if (options.direction !== void 0) {
        direction = options.direction;
      }
    }
    confirmActiveTransaction2(this);
    const range = valueToKeyRange_default(query);
    return this.transaction._execRequestAsync({
      operation: this._rawObjectStore.getAllRecords.bind(this._rawObjectStore, range, count, direction),
      source: this
    });
  }
  clear() {
    confirmActiveTransaction2(this);
    if (this.transaction.mode === "readonly") {
      throw new ReadOnlyError();
    }
    return this.transaction._execRequestAsync({
      operation: this._rawObjectStore.clear.bind(this._rawObjectStore, this.transaction._rollbackLog),
      source: this
    });
  }
  openCursor(range, direction) {
    confirmActiveTransaction2(this);
    if (range === null) {
      range = void 0;
    }
    if (range !== void 0 && !(range instanceof FDBKeyRange_default)) {
      range = FDBKeyRange_default.only(valueToKey_default(range));
    }
    const request = new FDBRequest_default();
    request.source = this;
    request.transaction = this.transaction;
    const cursor = new FDBCursorWithValue_default(this, range, direction, request);
    return this.transaction._execRequestAsync({
      operation: cursor._iterate.bind(cursor),
      request,
      source: this
    });
  }
  openKeyCursor(range, direction) {
    confirmActiveTransaction2(this);
    if (range === null) {
      range = void 0;
    }
    if (range !== void 0 && !(range instanceof FDBKeyRange_default)) {
      range = FDBKeyRange_default.only(valueToKey_default(range));
    }
    const request = new FDBRequest_default();
    request.source = this;
    request.transaction = this.transaction;
    const cursor = new FDBCursor_default(this, range, direction, request, true);
    return this.transaction._execRequestAsync({
      operation: cursor._iterate.bind(cursor),
      request,
      source: this
    });
  }
  // tslint:-next-line max-line-length
  // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBObjectStore-createIndex-IDBIndex-DOMString-name-DOMString-sequence-DOMString--keyPath-IDBIndexParameters-optionalParameters
  createIndex(name, keyPath, optionalParameters = {}) {
    if (arguments.length < 2) {
      throw new TypeError();
    }
    const multiEntry = optionalParameters.multiEntry !== void 0 ? optionalParameters.multiEntry : false;
    const unique = optionalParameters.unique !== void 0 ? optionalParameters.unique : false;
    if (this.transaction.mode !== "versionchange") {
      throw new InvalidStateError();
    }
    confirmActiveTransaction2(this);
    if (this.indexNames.contains(name)) {
      throw new ConstraintError();
    }
    validateKeyPath_default(keyPath);
    if (Array.isArray(keyPath) && multiEntry) {
      throw new InvalidAccessError();
    }
    const indexNames = [...this.indexNames];
    const index = new Index_default(this._rawObjectStore, name, keyPath, multiEntry, unique);
    this.indexNames._push(name);
    this.indexNames._sort();
    this.transaction._createdIndexes.add(index);
    this._rawObjectStore.rawIndexes.set(name, index);
    index.initialize(this.transaction);
    this.transaction._rollbackLog.push(() => {
      index.deleted = true;
      this.indexNames = new FakeDOMStringList_default(...indexNames);
      this._rawObjectStore.rawIndexes.delete(index.name);
    });
    return new FDBIndex_default(this, index);
  }
  // https://w3c.github.io/IndexedDB/#dom-idbobjectstore-index
  index(name) {
    if (arguments.length === 0) {
      throw new TypeError();
    }
    if (this._rawObjectStore.deleted || this.transaction._state === "finished") {
      throw new InvalidStateError();
    }
    const index = this._indexesCache.get(name);
    if (index !== void 0) {
      return index;
    }
    const rawIndex = this._rawObjectStore.rawIndexes.get(name);
    if (!this.indexNames.contains(name) || rawIndex === void 0) {
      throw new NotFoundError();
    }
    const index2 = new FDBIndex_default(this, rawIndex);
    this._indexesCache.set(name, index2);
    return index2;
  }
  deleteIndex(name) {
    if (arguments.length === 0) {
      throw new TypeError();
    }
    if (this.transaction.mode !== "versionchange") {
      throw new InvalidStateError();
    }
    confirmActiveTransaction2(this);
    const rawIndex = this._rawObjectStore.rawIndexes.get(name);
    if (rawIndex === void 0) {
      throw new NotFoundError();
    }
    this.transaction._rollbackLog.push(() => {
      rawIndex.deleted = false;
      this._rawObjectStore.rawIndexes.set(rawIndex.name, rawIndex);
      this.indexNames._push(rawIndex.name);
      this.indexNames._sort();
    });
    this.indexNames = new FakeDOMStringList_default(...Array.from(this.indexNames).filter((indexName) => {
      return indexName !== name;
    }));
    rawIndex.deleted = true;
    this.transaction._execRequestAsync({
      operation: () => {
        const rawIndex2 = this._rawObjectStore.rawIndexes.get(name);
        if (rawIndex === rawIndex2) {
          this._rawObjectStore.rawIndexes.delete(name);
        }
      },
      source: this
    });
  }
  // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBObjectStore-count-IDBRequest-any-key
  count(key) {
    confirmActiveTransaction2(this);
    if (key === null) {
      key = void 0;
    }
    if (key !== void 0 && !(key instanceof FDBKeyRange_default)) {
      key = FDBKeyRange_default.only(valueToKey_default(key));
    }
    return this.transaction._execRequestAsync({
      operation: () => {
        return this._rawObjectStore.count(key);
      },
      source: this
    });
  }
  get [Symbol.toStringTag]() {
    return "IDBObjectStore";
  }
};
var FDBObjectStore_default = FDBObjectStore;

// node_modules/fake-indexeddb/build/esm/lib/FakeEvent.js
var Event = class {
  eventPath = [];
  NONE = 0;
  CAPTURING_PHASE = 1;
  AT_TARGET = 2;
  BUBBLING_PHASE = 3;
  // Flags
  propagationStopped = false;
  immediatePropagationStopped = false;
  canceled = false;
  initialized = true;
  dispatched = false;
  target = null;
  currentTarget = null;
  eventPhase = 0;
  defaultPrevented = false;
  isTrusted = false;
  timeStamp = Date.now();
  constructor(type2, eventInitDict = {}) {
    this.type = type2;
    this.bubbles = eventInitDict.bubbles !== void 0 ? eventInitDict.bubbles : false;
    this.cancelable = eventInitDict.cancelable !== void 0 ? eventInitDict.cancelable : false;
  }
  preventDefault() {
    if (this.cancelable) {
      this.canceled = true;
    }
  }
  stopPropagation() {
    this.propagationStopped = true;
  }
  stopImmediatePropagation() {
    this.propagationStopped = true;
    this.immediatePropagationStopped = true;
  }
};
var FakeEvent_default = Event;

// node_modules/fake-indexeddb/build/esm/lib/scheduling.js
function getSetImmediateFromJsdom() {
  if (typeof navigator !== "undefined" && /jsdom/.test(navigator.userAgent)) {
    const outerRealmFunctionConstructor = Node.constructor;
    return new outerRealmFunctionConstructor("return setImmediate")();
  } else {
    return void 0;
  }
}
var schedulerPostTask = typeof scheduler !== "undefined" && ((fn) => scheduler.postTask(fn));
var doSetTimeout = (fn) => setTimeout(fn, 0);
var queueTask = (fn) => {
  const setImmediate2 = globalThis.setImmediate || getSetImmediateFromJsdom() || schedulerPostTask || doSetTimeout;
  setImmediate2(fn);
};

// node_modules/fake-indexeddb/build/esm/FDBTransaction.js
var prioritizedListenerTypes = ["error", "abort", "complete"];
var FDBTransaction = class extends FakeEventTarget_default {
  _state = "active";
  _started = false;
  _rollbackLog = [];
  _objectStoresCache = /* @__PURE__ */ new Map();
  _openRequest = null;
  error = null;
  onabort = null;
  oncomplete = null;
  onerror = null;
  _prioritizedListeners = /* @__PURE__ */ new Map();
  _requests = [];
  _createdIndexes = /* @__PURE__ */ new Set();
  _createdObjectStores = /* @__PURE__ */ new Set();
  constructor(storeNames, mode, durability, db) {
    super();
    this._scope = new Set(storeNames);
    this.mode = mode;
    this.durability = durability;
    this.db = db;
    this.objectStoreNames = new FakeDOMStringList_default(...Array.from(this._scope).sort());
    for (const type2 of prioritizedListenerTypes) {
      this.addEventListener(type2, () => {
        this._prioritizedListeners.get(type2)?.();
      });
    }
  }
  // https://w3c.github.io/IndexedDB/#abort-transaction
  _abort(errName) {
    for (const f of this._rollbackLog.reverse()) {
      f();
    }
    if (errName !== null) {
      const e = new DOMException(void 0, errName);
      this.error = e;
    }
    for (const {
      request
    } of this._requests) {
      if (request.readyState !== "done") {
        request.readyState = "done";
        if (request.source) {
          queueTask(() => {
            request.result = void 0;
            request.error = new AbortError();
            const event = new FakeEvent_default("error", {
              bubbles: true,
              cancelable: true
            });
            event.eventPath = [this.db, this];
            try {
              request.dispatchEvent(event);
            } catch (_err) {
              if (this._state === "active") {
                this._abort("AbortError");
              }
            }
          });
        }
      }
    }
    queueTask(() => {
      const isUpgradeTransaction = this.mode === "versionchange";
      if (isUpgradeTransaction) {
        this.db._rawDatabase.connections = this.db._rawDatabase.connections.filter((connection) => !connection._rawDatabase.transactions.includes(this));
      }
      const event = new FakeEvent_default("abort", {
        bubbles: true,
        cancelable: false
      });
      event.eventPath = [this.db];
      this.dispatchEvent(event);
      if (isUpgradeTransaction) {
        const request = this._openRequest;
        request.transaction = null;
        request.result = void 0;
      }
    });
    this._state = "finished";
  }
  abort() {
    if (this._state === "committing" || this._state === "finished") {
      throw new InvalidStateError();
    }
    this._state = "active";
    this._abort(null);
  }
  // http://w3c.github.io/IndexedDB/#dom-idbtransaction-objectstore
  objectStore(name) {
    if (this._state !== "active") {
      throw new InvalidStateError();
    }
    const objectStore = this._objectStoresCache.get(name);
    if (objectStore !== void 0) {
      return objectStore;
    }
    const rawObjectStore = this.db._rawDatabase.rawObjectStores.get(name);
    if (!this._scope.has(name) || rawObjectStore === void 0) {
      throw new NotFoundError();
    }
    const objectStore2 = new FDBObjectStore_default(this, rawObjectStore);
    this._objectStoresCache.set(name, objectStore2);
    return objectStore2;
  }
  // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-asynchronously-executing-a-request
  _execRequestAsync(obj) {
    const source = obj.source;
    const operation = obj.operation;
    let request = Object.hasOwn(obj, "request") ? obj.request : null;
    if (this._state !== "active") {
      throw new TransactionInactiveError();
    }
    if (!request) {
      if (!source) {
        request = new FDBRequest_default();
      } else {
        request = new FDBRequest_default();
        request.source = source;
        request.transaction = source.transaction;
      }
    }
    this._requests.push({
      operation,
      request
    });
    return request;
  }
  _start() {
    this._started = true;
    let operation;
    let request;
    while (this._requests.length > 0) {
      const r = this._requests.shift();
      if (r && r.request.readyState !== "done") {
        request = r.request;
        operation = r.operation;
        break;
      }
    }
    if (request && operation) {
      if (!request.source) {
        operation();
      } else {
        let defaultAction;
        let event;
        try {
          const result = operation();
          request.readyState = "done";
          request.result = result;
          request.error = void 0;
          if (this._state === "inactive") {
            this._state = "active";
          }
          event = new FakeEvent_default("success", {
            bubbles: false,
            cancelable: false
          });
        } catch (err) {
          request.readyState = "done";
          request.result = void 0;
          request.error = err;
          if (this._state === "inactive") {
            this._state = "active";
          }
          event = new FakeEvent_default("error", {
            bubbles: true,
            cancelable: true
          });
          defaultAction = this._abort.bind(this, err.name);
        }
        try {
          event.eventPath = [this.db, this];
          request.dispatchEvent(event);
        } catch (_err) {
          if (this._state === "active") {
            this._abort("AbortError");
            defaultAction = void 0;
          }
        }
        if (!event.canceled) {
          if (defaultAction) {
            defaultAction();
          }
        }
      }
      queueTask(this._start.bind(this));
      return;
    }
    if (this._state !== "finished") {
      this._state = "finished";
      if (!this.error) {
        const event = new FakeEvent_default("complete");
        this.dispatchEvent(event);
      }
    }
  }
  commit() {
    if (this._state !== "active") {
      throw new InvalidStateError();
    }
    this._state = "committing";
  }
  get [Symbol.toStringTag]() {
    return "IDBTransaction";
  }
};
var FDBTransaction_default = FDBTransaction;

// node_modules/fake-indexeddb/build/esm/lib/KeyGenerator.js
var MAX_KEY = 9007199254740992;
var KeyGenerator = class {
  // This is kind of wrong. Should start at 1 and increment only after record is saved
  num = 0;
  next() {
    if (this.num >= MAX_KEY) {
      throw new ConstraintError();
    }
    this.num += 1;
    return this.num;
  }
  // https://w3c.github.io/IndexedDB/#possibly-update-the-key-generator
  setIfLarger(num) {
    const value = Math.floor(Math.min(num, MAX_KEY)) - 1;
    if (value >= this.num) {
      this.num = value + 1;
    }
  }
};
var KeyGenerator_default = KeyGenerator;

// node_modules/fake-indexeddb/build/esm/lib/ObjectStore.js
var ObjectStore = class {
  deleted = false;
  records = new RecordStore_default(true);
  rawIndexes = /* @__PURE__ */ new Map();
  constructor(rawDatabase, name, keyPath, autoIncrement) {
    this.rawDatabase = rawDatabase;
    this.keyGenerator = autoIncrement === true ? new KeyGenerator_default() : null;
    this.deleted = false;
    this.name = name;
    this.keyPath = keyPath;
    this.autoIncrement = autoIncrement;
  }
  // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-retrieving-a-value-from-an-object-store
  getKey(key) {
    const record = this.records.get(key);
    return record !== void 0 ? structuredClone(record.key) : void 0;
  }
  // http://w3c.github.io/IndexedDB/#retrieve-multiple-keys-from-an-object-store
  getAllKeys(range, count, direction) {
    if (count === void 0 || count === 0) {
      count = Infinity;
    }
    const records = [];
    for (const record of this.records.values(range, direction)) {
      records.push(structuredClone(record.key));
      if (records.length >= count) {
        break;
      }
    }
    return records;
  }
  // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-retrieving-a-value-from-an-object-store
  getValue(key) {
    const record = this.records.get(key);
    return record !== void 0 ? structuredClone(record.value) : void 0;
  }
  // http://w3c.github.io/IndexedDB/#retrieve-multiple-values-from-an-object-store
  getAllValues(range, count, direction) {
    if (count === void 0 || count === 0) {
      count = Infinity;
    }
    const records = [];
    for (const record of this.records.values(range, direction)) {
      records.push(structuredClone(record.value));
      if (records.length >= count) {
        break;
      }
    }
    return records;
  }
  // https://www.w3.org/TR/IndexedDB/#dom-idbobjectstore-getallrecords
  getAllRecords(range, count, direction) {
    if (count === void 0 || count === 0) {
      count = Infinity;
    }
    const records = [];
    for (const record of this.records.values(range, direction)) {
      records.push(new FDBRecord_default(structuredClone(record.key), structuredClone(record.key), structuredClone(record.value)));
      if (records.length >= count) {
        break;
      }
    }
    return records;
  }
  // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-storing-a-record-into-an-object-store
  storeRecord(newRecord, noOverwrite, rollbackLog) {
    if (this.keyPath !== null) {
      const key = extractKey_default(this.keyPath, newRecord.value).key;
      if (key !== void 0) {
        newRecord.key = key;
      }
    }
    const rollbackLogForThisOperation = [];
    if (this.keyGenerator !== null && newRecord.key === void 0) {
      let rolledBack2 = false;
      const keyGeneratorBefore = this.keyGenerator.num;
      const rollbackKeyGenerator = () => {
        if (rolledBack2) {
          return;
        }
        rolledBack2 = true;
        if (this.keyGenerator) {
          this.keyGenerator.num = keyGeneratorBefore;
        }
      };
      rollbackLogForThisOperation.push(rollbackKeyGenerator);
      if (rollbackLog) {
        rollbackLog.push(rollbackKeyGenerator);
      }
      newRecord.key = this.keyGenerator.next();
      if (this.keyPath !== null) {
        if (Array.isArray(this.keyPath)) {
          throw new Error("Cannot have an array key path in an object store with a key generator");
        }
        let remainingKeyPath = this.keyPath;
        let object = newRecord.value;
        let identifier;
        let i = 0;
        while (i >= 0) {
          if (typeof object !== "object") {
            throw new DataError();
          }
          i = remainingKeyPath.indexOf(".");
          if (i >= 0) {
            identifier = remainingKeyPath.slice(0, i);
            remainingKeyPath = remainingKeyPath.slice(i + 1);
            if (!Object.hasOwn(object, identifier)) {
              Object.defineProperty(object, identifier, {
                configurable: true,
                enumerable: true,
                writable: true,
                value: {}
              });
            }
            object = object[identifier];
          }
        }
        identifier = remainingKeyPath;
        Object.defineProperty(object, identifier, {
          configurable: true,
          enumerable: true,
          writable: true,
          value: newRecord.key
        });
      }
    } else if (this.keyGenerator !== null && typeof newRecord.key === "number") {
      this.keyGenerator.setIfLarger(newRecord.key);
    }
    const existingRecord = this.records.put(newRecord, noOverwrite);
    let rolledBack = false;
    const rollbackStoreRecord = () => {
      if (rolledBack) {
        return;
      }
      rolledBack = true;
      if (existingRecord) {
        this.storeRecord(existingRecord, false);
      } else {
        this.deleteRecord(newRecord.key);
      }
    };
    rollbackLogForThisOperation.push(rollbackStoreRecord);
    if (rollbackLog) {
      rollbackLog.push(rollbackStoreRecord);
    }
    if (existingRecord) {
      for (const rawIndex of this.rawIndexes.values()) {
        rawIndex.records.deleteByValue(newRecord.key);
      }
    }
    try {
      for (const rawIndex of this.rawIndexes.values()) {
        if (rawIndex.initialized) {
          rawIndex.storeRecord(newRecord);
        }
      }
    } catch (err) {
      if (err.name === "ConstraintError") {
        for (const rollback of rollbackLogForThisOperation) {
          rollback();
        }
      }
      throw err;
    }
    return newRecord.key;
  }
  // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-deleting-records-from-an-object-store
  deleteRecord(key, rollbackLog) {
    const deletedRecords = this.records.delete(key);
    if (rollbackLog) {
      for (const record of deletedRecords) {
        rollbackLog.push(() => {
          this.storeRecord(record, true);
        });
      }
    }
    for (const rawIndex of this.rawIndexes.values()) {
      rawIndex.records.deleteByValue(key);
    }
  }
  // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#dfn-steps-for-clearing-an-object-store
  clear(rollbackLog) {
    const deletedRecords = this.records.clear();
    if (rollbackLog) {
      for (const record of deletedRecords) {
        rollbackLog.push(() => {
          this.storeRecord(record, true);
        });
      }
    }
    for (const rawIndex of this.rawIndexes.values()) {
      rawIndex.records.clear();
    }
  }
  count(range) {
    if (range === void 0 || range.lower === void 0 && range.upper === void 0) {
      return this.records.size();
    }
    let count = 0;
    for (const record of this.records.values(range)) {
      count += 1;
    }
    return count;
  }
};
var ObjectStore_default = ObjectStore;

// node_modules/fake-indexeddb/build/esm/lib/closeConnection.js
var closeConnection = (connection, forced = false) => {
  connection._closePending = true;
  const transactionsComplete = connection._rawDatabase.transactions.every((transaction) => {
    return transaction._state === "finished";
  });
  if (transactionsComplete) {
    connection._closed = true;
    connection._rawDatabase.connections = connection._rawDatabase.connections.filter((otherConnection) => {
      return connection !== otherConnection;
    });
    if (forced) {
      const event = new FakeEvent_default("close", {
        bubbles: false,
        cancelable: false
      });
      event.eventPath = [];
      connection.dispatchEvent(event);
    }
  } else {
    queueTask(() => {
      closeConnection(connection, forced);
    });
  }
};
var closeConnection_default = closeConnection;

// node_modules/fake-indexeddb/build/esm/FDBDatabase.js
var confirmActiveVersionchangeTransaction = (database) => {
  let transaction;
  if (database._runningVersionchangeTransaction) {
    transaction = database._rawDatabase.transactions.findLast((tx) => {
      return tx.mode === "versionchange";
    });
  }
  if (!transaction) {
    throw new InvalidStateError();
  }
  if (transaction._state !== "active") {
    throw new TransactionInactiveError();
  }
  return transaction;
};
var FDBDatabase = class extends FakeEventTarget_default {
  _closePending = false;
  _closed = false;
  _runningVersionchangeTransaction = false;
  constructor(rawDatabase) {
    super();
    this._rawDatabase = rawDatabase;
    this._rawDatabase.connections.push(this);
    this.name = rawDatabase.name;
    this.version = rawDatabase.version;
    this.objectStoreNames = new FakeDOMStringList_default(...Array.from(rawDatabase.rawObjectStores.keys()).sort());
  }
  // http://w3c.github.io/IndexedDB/#dom-idbdatabase-createobjectstore
  createObjectStore(name, options = {}) {
    if (name === void 0) {
      throw new TypeError();
    }
    const transaction = confirmActiveVersionchangeTransaction(this);
    const keyPath = options !== null && options.keyPath !== void 0 ? options.keyPath : null;
    const autoIncrement = options !== null && options.autoIncrement !== void 0 ? options.autoIncrement : false;
    if (keyPath !== null) {
      validateKeyPath_default(keyPath);
    }
    if (this._rawDatabase.rawObjectStores.has(name)) {
      throw new ConstraintError();
    }
    if (autoIncrement && (keyPath === "" || Array.isArray(keyPath))) {
      throw new InvalidAccessError();
    }
    const objectStoreNames = [...this.objectStoreNames];
    const transactionObjectStoreNames = [...transaction.objectStoreNames];
    const rawObjectStore = new ObjectStore_default(this._rawDatabase, name, keyPath, autoIncrement);
    this.objectStoreNames._push(name);
    this.objectStoreNames._sort();
    transaction._scope.add(name);
    transaction._createdObjectStores.add(rawObjectStore);
    this._rawDatabase.rawObjectStores.set(name, rawObjectStore);
    transaction.objectStoreNames = new FakeDOMStringList_default(...this.objectStoreNames);
    transaction._rollbackLog.push(() => {
      rawObjectStore.deleted = true;
      this.objectStoreNames = new FakeDOMStringList_default(...objectStoreNames);
      transaction.objectStoreNames = new FakeDOMStringList_default(...transactionObjectStoreNames);
      transaction._scope.delete(rawObjectStore.name);
      this._rawDatabase.rawObjectStores.delete(rawObjectStore.name);
    });
    return transaction.objectStore(name);
  }
  // https://www.w3.org/TR/IndexedDB/#dom-idbdatabase-deleteobjectstore
  deleteObjectStore(name) {
    if (name === void 0) {
      throw new TypeError();
    }
    const transaction = confirmActiveVersionchangeTransaction(this);
    const store = this._rawDatabase.rawObjectStores.get(name);
    if (store === void 0) {
      throw new NotFoundError();
    }
    this.objectStoreNames = new FakeDOMStringList_default(...Array.from(this.objectStoreNames).filter((objectStoreName) => {
      return objectStoreName !== name;
    }));
    transaction.objectStoreNames = new FakeDOMStringList_default(...this.objectStoreNames);
    const objectStore = transaction._objectStoresCache.get(name);
    let prevIndexNames;
    if (objectStore) {
      prevIndexNames = [...objectStore.indexNames];
      objectStore.indexNames = new FakeDOMStringList_default();
    }
    transaction._rollbackLog.push(() => {
      store.deleted = false;
      this._rawDatabase.rawObjectStores.set(store.name, store);
      this.objectStoreNames._push(store.name);
      transaction.objectStoreNames._push(store.name);
      this.objectStoreNames._sort();
      if (objectStore && prevIndexNames) {
        objectStore.indexNames = new FakeDOMStringList_default(...prevIndexNames);
      }
    });
    store.deleted = true;
    this._rawDatabase.rawObjectStores.delete(name);
    transaction._objectStoresCache.delete(name);
  }
  transaction(storeNames, mode, options) {
    mode = mode !== void 0 ? mode : "readonly";
    if (mode !== "readonly" && mode !== "readwrite" && mode !== "versionchange") {
      throw new TypeError("Invalid mode: " + mode);
    }
    const hasActiveVersionchange = this._rawDatabase.transactions.some((transaction) => {
      return transaction._state === "active" && transaction.mode === "versionchange" && transaction.db === this;
    });
    if (hasActiveVersionchange) {
      throw new InvalidStateError();
    }
    if (this._closePending) {
      throw new InvalidStateError();
    }
    if (!Array.isArray(storeNames)) {
      storeNames = [storeNames];
    }
    if (storeNames.length === 0 && mode !== "versionchange") {
      throw new InvalidAccessError();
    }
    for (const storeName of storeNames) {
      if (!this.objectStoreNames.contains(storeName)) {
        throw new NotFoundError("No objectStore named " + storeName + " in this database");
      }
    }
    const durability = options?.durability ?? "default";
    if (durability !== "default" && durability !== "strict" && durability !== "relaxed") {
      throw new TypeError(
        // based on Firefox's error message
        `'${durability}' (value of 'durability' member of IDBTransactionOptions) is not a valid value for enumeration IDBTransactionDurability`
      );
    }
    const tx = new FDBTransaction_default(storeNames, mode, durability, this);
    this._rawDatabase.transactions.push(tx);
    this._rawDatabase.processTransactions();
    return tx;
  }
  close() {
    closeConnection_default(this);
  }
  get [Symbol.toStringTag]() {
    return "IDBDatabase";
  }
};
var FDBDatabase_default = FDBDatabase;

// node_modules/fake-indexeddb/build/esm/FDBOpenDBRequest.js
var FDBOpenDBRequest = class extends FDBRequest_default {
  onupgradeneeded = null;
  onblocked = null;
  get [Symbol.toStringTag]() {
    return "IDBOpenDBRequest";
  }
};
var FDBOpenDBRequest_default = FDBOpenDBRequest;

// node_modules/fake-indexeddb/build/esm/FDBVersionChangeEvent.js
var FDBVersionChangeEvent = class extends FakeEvent_default {
  constructor(type2, parameters = {}) {
    super(type2);
    this.newVersion = parameters.newVersion !== void 0 ? parameters.newVersion : null;
    this.oldVersion = parameters.oldVersion !== void 0 ? parameters.oldVersion : 0;
  }
  get [Symbol.toStringTag]() {
    return "IDBVersionChangeEvent";
  }
};
var FDBVersionChangeEvent_default = FDBVersionChangeEvent;

// node_modules/fake-indexeddb/build/esm/lib/intersection.js
function intersection(set1, set2) {
  if ("intersection" in set1) {
    return set1.intersection(set2);
  }
  return new Set([...set1].filter((item) => set2.has(item)));
}

// node_modules/fake-indexeddb/build/esm/lib/Database.js
var Database = class {
  transactions = [];
  rawObjectStores = /* @__PURE__ */ new Map();
  connections = [];
  constructor(name, version) {
    this.name = name;
    this.version = version;
    this.processTransactions = this.processTransactions.bind(this);
  }
  processTransactions() {
    queueTask(() => {
      const running = this.transactions.filter((transaction) => transaction._started && transaction._state !== "finished");
      const waiting = this.transactions.filter((transaction) => !transaction._started && transaction._state !== "finished");
      const next = waiting.find((transaction, i) => {
        const anyRunning = running.some((other) => !(transaction.mode === "readonly" && other.mode === "readonly") && intersection(other._scope, transaction._scope).size > 0);
        if (anyRunning) {
          return false;
        }
        const anyWaiting = waiting.slice(0, i).some((other) => intersection(other._scope, transaction._scope).size > 0);
        return !anyWaiting;
      });
      if (next) {
        next.addEventListener("complete", this.processTransactions);
        next.addEventListener("abort", this.processTransactions);
        next._start();
      }
    });
  }
};
var Database_default = Database;

// node_modules/fake-indexeddb/build/esm/lib/validateRequiredArguments.js
function validateRequiredArguments(numArguments, expectedNumArguments, methodName) {
  if (numArguments < expectedNumArguments) {
    throw new TypeError(`${methodName}: At least ${expectedNumArguments} ${expectedNumArguments === 1 ? "argument" : "arguments"} required, but only ${arguments.length} passed`);
  }
}

// node_modules/fake-indexeddb/build/esm/FDBFactory.js
var runTaskInConnectionQueue = (connectionQueues, name, task) => {
  const queue = connectionQueues.get(name) ?? Promise.resolve();
  connectionQueues.set(name, queue.then(task));
};
var waitForOthersClosedDelete = (databases, name, openDatabases, cb) => {
  const anyOpen = openDatabases.some((openDatabase2) => {
    return !openDatabase2._closed && !openDatabase2._closePending;
  });
  if (anyOpen) {
    queueTask(() => waitForOthersClosedDelete(databases, name, openDatabases, cb));
    return;
  }
  databases.delete(name);
  cb(null);
};
var deleteDatabase = (databases, connectionQueues, name, request, cb) => {
  const deleteDBTask = () => {
    return new Promise((resolve2) => {
      const db = databases.get(name);
      const oldVersion = db !== void 0 ? db.version : 0;
      const onComplete = (err) => {
        try {
          if (err) {
            cb(err);
          } else {
            cb(null, oldVersion);
          }
        } finally {
          resolve2();
        }
      };
      try {
        const db2 = databases.get(name);
        if (db2 === void 0) {
          onComplete(null);
          return;
        }
        const openConnections = db2.connections.filter((connection) => {
          return !connection._closed;
        });
        for (const openDatabase2 of openConnections) {
          if (!openDatabase2._closePending) {
            queueTask(() => {
              const event = new FDBVersionChangeEvent_default("versionchange", {
                newVersion: null,
                oldVersion: db2.version
              });
              openDatabase2.dispatchEvent(event);
            });
          }
        }
        queueTask(() => {
          const anyOpen = openConnections.some((openDatabase3) => {
            return !openDatabase3._closed && !openDatabase3._closePending;
          });
          if (anyOpen) {
            queueTask(() => {
              const event = new FDBVersionChangeEvent_default("blocked", {
                newVersion: null,
                oldVersion: db2.version
              });
              request.dispatchEvent(event);
            });
          }
          waitForOthersClosedDelete(databases, name, openConnections, onComplete);
        });
      } catch (err) {
        onComplete(err);
      }
    });
  };
  runTaskInConnectionQueue(connectionQueues, name, deleteDBTask);
};
var runVersionchangeTransaction = (connection, version, request, cb) => {
  connection._runningVersionchangeTransaction = true;
  const oldVersion = connection._oldVersion = connection.version;
  const openConnections = connection._rawDatabase.connections.filter((otherDatabase) => {
    return connection !== otherDatabase;
  });
  for (const openDatabase2 of openConnections) {
    if (!openDatabase2._closed && !openDatabase2._closePending) {
      queueTask(() => {
        const event = new FDBVersionChangeEvent_default("versionchange", {
          newVersion: version,
          oldVersion
        });
        openDatabase2.dispatchEvent(event);
      });
    }
  }
  queueTask(() => {
    const anyOpen = openConnections.some((openDatabase3) => {
      return !openDatabase3._closed && !openDatabase3._closePending;
    });
    if (anyOpen) {
      queueTask(() => {
        const event = new FDBVersionChangeEvent_default("blocked", {
          newVersion: version,
          oldVersion
        });
        request.dispatchEvent(event);
      });
    }
    const waitForOthersClosed = () => {
      const anyOpen2 = openConnections.some((openDatabase2) => {
        return !openDatabase2._closed && !openDatabase2._closePending;
      });
      if (anyOpen2) {
        queueTask(waitForOthersClosed);
        return;
      }
      connection._rawDatabase.version = version;
      connection.version = version;
      const transaction = connection.transaction(Array.from(connection.objectStoreNames), "versionchange");
      transaction._openRequest = request;
      request.result = connection;
      request.readyState = "done";
      request.transaction = transaction;
      transaction._rollbackLog.push(() => {
        connection._rawDatabase.version = oldVersion;
        connection.version = oldVersion;
      });
      transaction._state = "active";
      const event = new FDBVersionChangeEvent_default("upgradeneeded", {
        newVersion: version,
        oldVersion
      });
      let didThrow = false;
      try {
        request.dispatchEvent(event);
      } catch (_err) {
        didThrow = true;
      }
      const concludeUpgrade = () => {
        if (transaction._state === "active") {
          transaction._state = "inactive";
          if (didThrow) {
            transaction._abort("AbortError");
          }
        }
      };
      if (didThrow) {
        concludeUpgrade();
      } else {
        queueTask(concludeUpgrade);
      }
      transaction._prioritizedListeners.set("error", () => {
        connection._runningVersionchangeTransaction = false;
        connection._oldVersion = void 0;
      });
      transaction._prioritizedListeners.set("abort", () => {
        connection._runningVersionchangeTransaction = false;
        connection._oldVersion = void 0;
        queueTask(() => {
          request.transaction = null;
          cb(new AbortError());
        });
      });
      transaction._prioritizedListeners.set("complete", () => {
        connection._runningVersionchangeTransaction = false;
        connection._oldVersion = void 0;
        queueTask(() => {
          request.transaction = null;
          if (connection._closePending) {
            cb(new AbortError());
          } else {
            cb(null);
          }
        });
      });
    };
    waitForOthersClosed();
  });
};
var openDatabase = (databases, connectionQueues, name, version, request, cb) => {
  const openDBTask = () => {
    return new Promise((resolve2) => {
      const onComplete = (err) => {
        try {
          if (err) {
            cb(err);
          } else {
            cb(null, connection);
          }
        } finally {
          resolve2();
        }
      };
      let db = databases.get(name);
      if (db === void 0) {
        db = new Database_default(name, 0);
        databases.set(name, db);
      }
      if (version === void 0) {
        version = db.version !== 0 ? db.version : 1;
      }
      if (db.version > version) {
        return onComplete(new VersionError());
      }
      const connection = new FDBDatabase_default(db);
      if (db.version < version) {
        runVersionchangeTransaction(connection, version, request, (err) => {
          onComplete(err);
        });
      } else {
        onComplete(null);
      }
    });
  };
  runTaskInConnectionQueue(connectionQueues, name, openDBTask);
};
var FDBFactory = class {
  _databases = /* @__PURE__ */ new Map();
  // https://w3c.github.io/IndexedDB/#connection-queue
  _connectionQueues = /* @__PURE__ */ new Map();
  // promise chain as lightweight FIFO task queue
  // https://w3c.github.io/IndexedDB/#dom-idbfactory-cmp
  cmp(first, second) {
    validateRequiredArguments(arguments.length, 2, "IDBFactory.cmp");
    return cmp_default(first, second);
  }
  // https://w3c.github.io/IndexedDB/#dom-idbfactory-deletedatabase
  deleteDatabase(name) {
    validateRequiredArguments(arguments.length, 1, "IDBFactory.deleteDatabase");
    const request = new FDBOpenDBRequest_default();
    request.source = null;
    queueTask(() => {
      deleteDatabase(this._databases, this._connectionQueues, name, request, (err, oldVersion) => {
        if (err) {
          request.error = new DOMException(err.message, err.name);
          request.readyState = "done";
          const event = new FakeEvent_default("error", {
            bubbles: true,
            cancelable: true
          });
          event.eventPath = [];
          request.dispatchEvent(event);
          return;
        }
        request.result = void 0;
        request.readyState = "done";
        const event2 = new FDBVersionChangeEvent_default("success", {
          newVersion: null,
          oldVersion
        });
        request.dispatchEvent(event2);
      });
    });
    return request;
  }
  // http://www.w3.org/TR/2015/REC-IndexedDB-20150108/#widl-IDBFactory-open-IDBOpenDBRequest-DOMString-name-unsigned-long-long-version
  open(name, version) {
    validateRequiredArguments(arguments.length, 1, "IDBFactory.open");
    if (arguments.length > 1 && version !== void 0) {
      version = enforceRange_default(version, "MAX_SAFE_INTEGER");
    }
    if (version === 0) {
      throw new TypeError("Database version cannot be 0");
    }
    const request = new FDBOpenDBRequest_default();
    request.source = null;
    queueTask(() => {
      openDatabase(this._databases, this._connectionQueues, name, version, request, (err, connection) => {
        if (err) {
          request.result = void 0;
          request.readyState = "done";
          request.error = new DOMException(err.message, err.name);
          const event = new FakeEvent_default("error", {
            bubbles: true,
            cancelable: true
          });
          event.eventPath = [];
          request.dispatchEvent(event);
          return;
        }
        request.result = connection;
        request.readyState = "done";
        const event2 = new FakeEvent_default("success");
        event2.eventPath = [];
        request.dispatchEvent(event2);
      });
    });
    return request;
  }
  // https://w3c.github.io/IndexedDB/#dom-idbfactory-databases
  databases() {
    return Promise.resolve(Array.from(this._databases.entries(), ([name, database]) => {
      const activeVersionChangeConnection = database.connections.find((connection) => connection._runningVersionchangeTransaction);
      const version = activeVersionChangeConnection ? activeVersionChangeConnection._oldVersion : database.version;
      return {
        name,
        version
      };
    }).filter(({
      version
    }) => {
      return version > 0;
    }));
  }
  get [Symbol.toStringTag]() {
    return "IDBFactory";
  }
};
var FDBFactory_default = FDBFactory;

// node_modules/fake-indexeddb/build/esm/fakeIndexedDB.js
var fakeIndexedDB = new FDBFactory_default();
var fakeIndexedDB_default = fakeIndexedDB;

// node_modules/fake-indexeddb/auto/index.mjs
var globalVar = typeof window !== "undefined" ? window : typeof WorkerGlobalScope !== "undefined" ? self : typeof global !== "undefined" ? global : Function("return this;")();
var createPropertyDescriptor = (value) => {
  return {
    value,
    enumerable: false,
    configurable: true,
    writable: true
  };
};
Object.defineProperties(globalVar, {
  indexedDB: createPropertyDescriptor(fakeIndexedDB_default),
  IDBCursor: createPropertyDescriptor(FDBCursor_default),
  IDBCursorWithValue: createPropertyDescriptor(FDBCursorWithValue_default),
  IDBDatabase: createPropertyDescriptor(FDBDatabase_default),
  IDBFactory: createPropertyDescriptor(FDBFactory_default),
  IDBIndex: createPropertyDescriptor(FDBIndex_default),
  IDBKeyRange: createPropertyDescriptor(FDBKeyRange_default),
  IDBObjectStore: createPropertyDescriptor(FDBObjectStore_default),
  IDBOpenDBRequest: createPropertyDescriptor(FDBOpenDBRequest_default),
  IDBRecord: createPropertyDescriptor(FDBRecord_default),
  IDBRequest: createPropertyDescriptor(FDBRequest_default),
  IDBTransaction: createPropertyDescriptor(FDBTransaction_default),
  IDBVersionChangeEvent: createPropertyDescriptor(FDBVersionChangeEvent_default)
});

// scripts/agent/capabilityRunner.ts
var fsPromises = __toESM(require("node:fs/promises"), 1);
var path2 = __toESM(require("node:path"), 1);
var import_node_process = __toESM(require("node:process"), 1);
var import_node_url = require("node:url");
var import_node_util = require("node:util");

// electron/src/config/vaultExcludedDirs.json
var vaultExcludedDirs_default = [
  ".obsidian",
  "node_modules",
  "__pycache__",
  ".venv",
  "think-space",
  ".git",
  ".trash"
];

// src/services/lego_blocks/units/vaultConstantsBlock.ts
var EXCLUDED_DIRS = new Set(vaultExcludedDirs_default);

// src/services/lego_blocks/units/storageKeyBlock.ts
var STORAGE_KEYS = {
  vaultRoot: "ltm-vault-root",
  thinkingOrganizerTab: "ltm-thinking-organizer-tab",
  thinkingOrganizerTemplates: "ltm-thinking-organizer-level-templates",
  thinkingOrganizerRecentTemplates: "ltm-thinking-organizer-recent-templates",
  thinkingOrganizerNodeKinds: "ltm-thinking-organizer-node-kinds",
  thinkingOrganizerFolderRoots: "ltm-thinking-organizer-folder-roots",
  thinkingOrganizerProjectRoots: "ltm-thinking-organizer-project-roots",
  thinkingOrganizerSelectedProjectRoot: "ltm-thinking-organizer-selected-project-root",
  thinkingOrganizerProjects: "ltm-thinking-organizer-projects",
  thinkingOrganizerProjectPresetTags: "ltm-thinking-organizer-project-preset-tags",
  thinkingOrganizerProjectTagColors: "ltm-thinking-organizer-project-tag-colors",
  thinkingOrganizerProjectProgramGroups: "ltm-thinking-organizer-project-program-groups",
  thinkingOrganizerProjectPinBoardGroups: "ltm-thinking-organizer-project-pin-board-groups",
  thinkingOrganizerProjectCreateDestination: "ltm-thinking-organizer-project-create-destination",
  appShellSidebarCollapsed: "ltm-app-shell-sidebar-collapsed",
  appShellExcalidrawExpanded: "ltm-app-shell-excalidraw-expanded",
  appShellTabs: "ltm-app-shell-tabs",
  appShellActiveTabId: "ltm-app-shell-active-tab-id",
  appTheme: "ltm-app-theme",
  appColorMode: "ltm-app-color-mode",
  thinkingSpaceExplorerCollapsed: "ltm-thinking-space-explorer-collapsed",
  thinkingSpaceExplorerWidthPx: "ltm-thinking-space-explorer-width-px",
  capabilityFeatureFlags: "ltm-capability-feature-flags",
  stewardProposalQueue: "ltm-steward-proposal-queue",
  aiTelemetryEvents: "ltm-ai-telemetry-events",
  aiSettings: "ltm-ai-settings",
  markdownEditorSettings: "ltm-markdown-editor-settings",
  schedulerSettings: "ltm-scheduler-settings",
  schedulerTaskLastAttemptById: "ltm-scheduler-task-last-attempt-by-id",
  markdownDocumentTopBarHidden: "ltm-markdown-document-top-bar-hidden",
  userProfileCache: "ltm-user-profile-cache",
  gitSyncActionsByVault: "ltm-git-sync-actions-by-vault",
  webullExecutionSettings: "ltm-webull-execution-settings",
  webullProjectPresetTags: "ltm-webull-project-preset-tags",
  webullOverallRememberByProjectRoot: "ltm-webull-overall-remember-by-project-root",
  aiManualCredentials: "ltm-ai-manual-credentials",
  aiOauthCredentials: "ltm-ai-oauth-credentials",
  googleDriveAuth: "ltm-google-drive-auth",
  googleDriveOauthClientId: "ltm-google-drive-oauth-client-id",
  rssFeedConfigs: "ltm-rss-feed-configs",
  rssReadItemIds: "ltm-rss-read-item-ids",
  rssFeedRetentionDays: "ltm-rss-feed-retention-days",
  aiWebsites: "ltm-ai-websites",
  webSites: "ltm-web-sites",
  fileActivityIgnoredPaths: "ltm-file-activity-ignored-paths"
};
function getLocalStorageItemBlock(key) {
  try {
    if (typeof localStorage === "undefined") return null;
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function setLocalStorageItemBlock(key, value) {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(key, value);
  } catch {
  }
}
function isElectronVaultRootBridgeAvailableBlock() {
  return typeof window !== "undefined" && !!window.electronAPI?.isElectron && typeof window.electronAPI.vaultRootGetPersisted === "function";
}
function normalizeVaultRootValueBlock(value) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}
function readElectronPersistedVaultRootBlock() {
  if (!isElectronVaultRootBridgeAvailableBlock()) return null;
  const persisted = normalizeVaultRootValueBlock(window.electronAPI?.vaultRootGetPersisted?.());
  if (persisted) return persisted;
  const legacy = normalizeVaultRootValueBlock(getLocalStorageItemBlock(STORAGE_KEYS.vaultRoot));
  if (!legacy) return null;
  void window.electronAPI?.vaultRootSetPersisted?.(legacy);
  try {
    localStorage.removeItem(STORAGE_KEYS.vaultRoot);
  } catch {
  }
  return legacy;
}
function writeElectronPersistedVaultRootBlock(value) {
  const normalized = normalizeVaultRootValueBlock(value);
  void window.electronAPI?.vaultRootSetPersisted?.(normalized);
}
function getStorageItem(key) {
  if (key === STORAGE_KEYS.vaultRoot) {
    const electronPersisted = readElectronPersistedVaultRootBlock();
    if (electronPersisted) return electronPersisted;
  }
  return getLocalStorageItemBlock(key);
}
function setStorageItem(key, value) {
  if (key === STORAGE_KEYS.vaultRoot && isElectronVaultRootBridgeAvailableBlock()) {
    writeElectronPersistedVaultRootBlock(value);
    return;
  }
  setLocalStorageItemBlock(key, value);
}
function getJsonStorageItem(key, fallback) {
  const raw = getStorageItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function getStoredVaultRoot() {
  return getStorageItem(STORAGE_KEYS.vaultRoot);
}
function setStoredVaultRoot(path3) {
  setStorageItem(STORAGE_KEYS.vaultRoot, path3);
}

// src/services/lego_blocks/integrations/capabilityRegistryBlock.ts
var CAPABILITY_REGISTRY = [
  {
    name: "read_note",
    description: "Read a markdown note as structured frontmatter plus body.",
    readOnly: true
  },
  {
    name: "write_note",
    description: "Write a markdown note with optional frontmatter and safe overwrite control.",
    readOnly: false
  },
  {
    name: "patch_note_frontmatter",
    description: "Patch selected frontmatter fields without rewriting the note body manually.",
    readOnly: false
  },
  {
    name: "resolve_ai_synthesis_path",
    description: "Resolve the canonical destination path for an AI Synthesis note.",
    readOnly: true
  },
  {
    name: "create_ai_synthesis_note",
    description: "Create an AI Synthesis scaffold note with mechanical metadata and template body.",
    readOnly: false
  },
  {
    name: "get_impacted_ai_synthesis_notes",
    description: "Return likely impacted AI Synthesis notes and missing canonical pages for changed notes.",
    readOnly: true
  },
  {
    name: "update_ai_synthesis_compile_state",
    description: "Update AI Synthesis compile timestamps and compile_status metadata.",
    readOnly: false
  },
  {
    name: "list_domain_ai_synthesis_health",
    description: "Scan a domain AI Synthesis area for missing, stale, or inconsistent notes.",
    readOnly: true
  },
  {
    name: "organizer.nodes.list_roots",
    description: "List root nodes in the organizer hierarchy, optionally filtered by type.",
    readOnly: true
  },
  {
    name: "organizer.nodes.list_children",
    description: "List children for a parent node key.",
    readOnly: true
  },
  {
    name: "organizer.nodes.list_all",
    description: "List all organizer nodes from cache.",
    readOnly: true
  },
  {
    name: "organizer.nodes.search",
    description: "Search organizer nodes by lexical query.",
    readOnly: true
  },
  {
    name: "organizer.node.get",
    description: "Get an organizer node by uuid.",
    readOnly: true
  },
  {
    name: "organizer.node.get_by_key",
    description: "Get an organizer node by key.",
    readOnly: true
  },
  {
    name: "organizer.node.read_frontmatter",
    description: "Read YAML frontmatter by file path.",
    readOnly: true
  },
  {
    name: "organizer.node.create",
    description: "Create a hierarchy node and persist it to YAML + cache.",
    readOnly: false
  },
  {
    name: "organizer.node.rename",
    description: "Rename a node title.",
    readOnly: false
  },
  {
    name: "organizer.node.update",
    description: "Update node metadata fields.",
    readOnly: false
  },
  {
    name: "organizer.node.move",
    description: "Move a node to a new parent key.",
    readOnly: false
  },
  {
    name: "organizer.node.delete",
    description: "Delete a node from cache/source of truth workflow.",
    readOnly: false
  },
  {
    name: "task.claim",
    description: "Claim a task node for an owner and set task status.",
    readOnly: false
  },
  {
    name: "task.update_status",
    description: "Update status of an existing task node.",
    readOnly: false
  },
  {
    name: "run.log",
    description: "Create a run log node with traceability metadata.",
    readOnly: false
  },
  {
    name: "handoff.create",
    description: "Create a handoff node with source and artifact references.",
    readOnly: false
  },
  {
    name: "comment.add",
    description: "Append a comment entry to an existing organizer node.",
    readOnly: false
  },
  {
    name: "thoughts.create",
    description: "Create a thought markdown note with YAML metadata.",
    readOnly: false
  },
  {
    name: "todos.create",
    description: "Create or append todos into a daily todo markdown note.",
    readOnly: false
  },
  {
    name: "todos.toggle",
    description: "Toggle a single todo checkbox in a file.",
    readOnly: false
  },
  {
    name: "tools.files.list_markdown",
    description: "List markdown files in the vault.",
    readOnly: true
  },
  {
    name: "tools.files.list_pdf",
    description: "List PDF files in the vault.",
    readOnly: true
  },
  {
    name: "tools.folders.list",
    description: "List folder paths in the vault.",
    readOnly: true
  },
  {
    name: "tools.excalidraw.preview",
    description: "Preview markdown formatting for Excalidraw import.",
    readOnly: true
  },
  {
    name: "tools.excalidraw.format",
    description: "Format markdown for Excalidraw and persist output file.",
    readOnly: false
  },
  {
    name: "tools.pdf.preview",
    description: "Preview PDF to markdown conversion.",
    readOnly: true
  },
  {
    name: "tools.pdf.convert",
    description: "Convert PDF to markdown and persist output file.",
    readOnly: false
  },
  {
    name: "tools.transcript.preview",
    description: "Preview transcript cleanup output.",
    readOnly: true
  },
  {
    name: "tools.transcript.clean_save",
    description: "Clean a transcript and save markdown output.",
    readOnly: false
  }
];
function getCapabilityDefinition(name) {
  return CAPABILITY_REGISTRY.find((capability) => capability.name === name);
}

// node_modules/js-yaml/dist/js-yaml.mjs
function isNothing(subject) {
  return typeof subject === "undefined" || subject === null;
}
function isObject(subject) {
  return typeof subject === "object" && subject !== null;
}
function toArray(sequence) {
  if (Array.isArray(sequence)) return sequence;
  else if (isNothing(sequence)) return [];
  return [sequence];
}
function extend(target, source) {
  var index, length, key, sourceKeys;
  if (source) {
    sourceKeys = Object.keys(source);
    for (index = 0, length = sourceKeys.length; index < length; index += 1) {
      key = sourceKeys[index];
      target[key] = source[key];
    }
  }
  return target;
}
function repeat(string, count) {
  var result = "", cycle;
  for (cycle = 0; cycle < count; cycle += 1) {
    result += string;
  }
  return result;
}
function isNegativeZero(number) {
  return number === 0 && Number.NEGATIVE_INFINITY === 1 / number;
}
var isNothing_1 = isNothing;
var isObject_1 = isObject;
var toArray_1 = toArray;
var repeat_1 = repeat;
var isNegativeZero_1 = isNegativeZero;
var extend_1 = extend;
var common = {
  isNothing: isNothing_1,
  isObject: isObject_1,
  toArray: toArray_1,
  repeat: repeat_1,
  isNegativeZero: isNegativeZero_1,
  extend: extend_1
};
function formatError(exception2, compact) {
  var where = "", message = exception2.reason || "(unknown reason)";
  if (!exception2.mark) return message;
  if (exception2.mark.name) {
    where += 'in "' + exception2.mark.name + '" ';
  }
  where += "(" + (exception2.mark.line + 1) + ":" + (exception2.mark.column + 1) + ")";
  if (!compact && exception2.mark.snippet) {
    where += "\n\n" + exception2.mark.snippet;
  }
  return message + " " + where;
}
function YAMLException$1(reason, mark) {
  Error.call(this);
  this.name = "YAMLException";
  this.reason = reason;
  this.mark = mark;
  this.message = formatError(this, false);
  if (Error.captureStackTrace) {
    Error.captureStackTrace(this, this.constructor);
  } else {
    this.stack = new Error().stack || "";
  }
}
YAMLException$1.prototype = Object.create(Error.prototype);
YAMLException$1.prototype.constructor = YAMLException$1;
YAMLException$1.prototype.toString = function toString(compact) {
  return this.name + ": " + formatError(this, compact);
};
var exception = YAMLException$1;
function getLine(buffer, lineStart, lineEnd, position, maxLineLength) {
  var head = "";
  var tail = "";
  var maxHalfLength = Math.floor(maxLineLength / 2) - 1;
  if (position - lineStart > maxHalfLength) {
    head = " ... ";
    lineStart = position - maxHalfLength + head.length;
  }
  if (lineEnd - position > maxHalfLength) {
    tail = " ...";
    lineEnd = position + maxHalfLength - tail.length;
  }
  return {
    str: head + buffer.slice(lineStart, lineEnd).replace(/\t/g, "\u2192") + tail,
    pos: position - lineStart + head.length
    // relative position
  };
}
function padStart(string, max) {
  return common.repeat(" ", max - string.length) + string;
}
function makeSnippet(mark, options) {
  options = Object.create(options || null);
  if (!mark.buffer) return null;
  if (!options.maxLength) options.maxLength = 79;
  if (typeof options.indent !== "number") options.indent = 1;
  if (typeof options.linesBefore !== "number") options.linesBefore = 3;
  if (typeof options.linesAfter !== "number") options.linesAfter = 2;
  var re = /\r?\n|\r|\0/g;
  var lineStarts = [0];
  var lineEnds = [];
  var match;
  var foundLineNo = -1;
  while (match = re.exec(mark.buffer)) {
    lineEnds.push(match.index);
    lineStarts.push(match.index + match[0].length);
    if (mark.position <= match.index && foundLineNo < 0) {
      foundLineNo = lineStarts.length - 2;
    }
  }
  if (foundLineNo < 0) foundLineNo = lineStarts.length - 1;
  var result = "", i, line;
  var lineNoLength = Math.min(mark.line + options.linesAfter, lineEnds.length).toString().length;
  var maxLineLength = options.maxLength - (options.indent + lineNoLength + 3);
  for (i = 1; i <= options.linesBefore; i++) {
    if (foundLineNo - i < 0) break;
    line = getLine(
      mark.buffer,
      lineStarts[foundLineNo - i],
      lineEnds[foundLineNo - i],
      mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo - i]),
      maxLineLength
    );
    result = common.repeat(" ", options.indent) + padStart((mark.line - i + 1).toString(), lineNoLength) + " | " + line.str + "\n" + result;
  }
  line = getLine(mark.buffer, lineStarts[foundLineNo], lineEnds[foundLineNo], mark.position, maxLineLength);
  result += common.repeat(" ", options.indent) + padStart((mark.line + 1).toString(), lineNoLength) + " | " + line.str + "\n";
  result += common.repeat("-", options.indent + lineNoLength + 3 + line.pos) + "^\n";
  for (i = 1; i <= options.linesAfter; i++) {
    if (foundLineNo + i >= lineEnds.length) break;
    line = getLine(
      mark.buffer,
      lineStarts[foundLineNo + i],
      lineEnds[foundLineNo + i],
      mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo + i]),
      maxLineLength
    );
    result += common.repeat(" ", options.indent) + padStart((mark.line + i + 1).toString(), lineNoLength) + " | " + line.str + "\n";
  }
  return result.replace(/\n$/, "");
}
var snippet = makeSnippet;
var TYPE_CONSTRUCTOR_OPTIONS = [
  "kind",
  "multi",
  "resolve",
  "construct",
  "instanceOf",
  "predicate",
  "represent",
  "representName",
  "defaultStyle",
  "styleAliases"
];
var YAML_NODE_KINDS = [
  "scalar",
  "sequence",
  "mapping"
];
function compileStyleAliases(map2) {
  var result = {};
  if (map2 !== null) {
    Object.keys(map2).forEach(function(style) {
      map2[style].forEach(function(alias) {
        result[String(alias)] = style;
      });
    });
  }
  return result;
}
function Type$1(tag, options) {
  options = options || {};
  Object.keys(options).forEach(function(name) {
    if (TYPE_CONSTRUCTOR_OPTIONS.indexOf(name) === -1) {
      throw new exception('Unknown option "' + name + '" is met in definition of "' + tag + '" YAML type.');
    }
  });
  this.options = options;
  this.tag = tag;
  this.kind = options["kind"] || null;
  this.resolve = options["resolve"] || function() {
    return true;
  };
  this.construct = options["construct"] || function(data) {
    return data;
  };
  this.instanceOf = options["instanceOf"] || null;
  this.predicate = options["predicate"] || null;
  this.represent = options["represent"] || null;
  this.representName = options["representName"] || null;
  this.defaultStyle = options["defaultStyle"] || null;
  this.multi = options["multi"] || false;
  this.styleAliases = compileStyleAliases(options["styleAliases"] || null);
  if (YAML_NODE_KINDS.indexOf(this.kind) === -1) {
    throw new exception('Unknown kind "' + this.kind + '" is specified for "' + tag + '" YAML type.');
  }
}
var type = Type$1;
function compileList(schema2, name) {
  var result = [];
  schema2[name].forEach(function(currentType) {
    var newIndex = result.length;
    result.forEach(function(previousType, previousIndex) {
      if (previousType.tag === currentType.tag && previousType.kind === currentType.kind && previousType.multi === currentType.multi) {
        newIndex = previousIndex;
      }
    });
    result[newIndex] = currentType;
  });
  return result;
}
function compileMap() {
  var result = {
    scalar: {},
    sequence: {},
    mapping: {},
    fallback: {},
    multi: {
      scalar: [],
      sequence: [],
      mapping: [],
      fallback: []
    }
  }, index, length;
  function collectType(type2) {
    if (type2.multi) {
      result.multi[type2.kind].push(type2);
      result.multi["fallback"].push(type2);
    } else {
      result[type2.kind][type2.tag] = result["fallback"][type2.tag] = type2;
    }
  }
  for (index = 0, length = arguments.length; index < length; index += 1) {
    arguments[index].forEach(collectType);
  }
  return result;
}
function Schema$1(definition) {
  return this.extend(definition);
}
Schema$1.prototype.extend = function extend2(definition) {
  var implicit = [];
  var explicit = [];
  if (definition instanceof type) {
    explicit.push(definition);
  } else if (Array.isArray(definition)) {
    explicit = explicit.concat(definition);
  } else if (definition && (Array.isArray(definition.implicit) || Array.isArray(definition.explicit))) {
    if (definition.implicit) implicit = implicit.concat(definition.implicit);
    if (definition.explicit) explicit = explicit.concat(definition.explicit);
  } else {
    throw new exception("Schema.extend argument should be a Type, [ Type ], or a schema definition ({ implicit: [...], explicit: [...] })");
  }
  implicit.forEach(function(type$1) {
    if (!(type$1 instanceof type)) {
      throw new exception("Specified list of YAML types (or a single Type object) contains a non-Type object.");
    }
    if (type$1.loadKind && type$1.loadKind !== "scalar") {
      throw new exception("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
    }
    if (type$1.multi) {
      throw new exception("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.");
    }
  });
  explicit.forEach(function(type$1) {
    if (!(type$1 instanceof type)) {
      throw new exception("Specified list of YAML types (or a single Type object) contains a non-Type object.");
    }
  });
  var result = Object.create(Schema$1.prototype);
  result.implicit = (this.implicit || []).concat(implicit);
  result.explicit = (this.explicit || []).concat(explicit);
  result.compiledImplicit = compileList(result, "implicit");
  result.compiledExplicit = compileList(result, "explicit");
  result.compiledTypeMap = compileMap(result.compiledImplicit, result.compiledExplicit);
  return result;
};
var schema = Schema$1;
var str = new type("tag:yaml.org,2002:str", {
  kind: "scalar",
  construct: function(data) {
    return data !== null ? data : "";
  }
});
var seq = new type("tag:yaml.org,2002:seq", {
  kind: "sequence",
  construct: function(data) {
    return data !== null ? data : [];
  }
});
var map = new type("tag:yaml.org,2002:map", {
  kind: "mapping",
  construct: function(data) {
    return data !== null ? data : {};
  }
});
var failsafe = new schema({
  explicit: [
    str,
    seq,
    map
  ]
});
function resolveYamlNull(data) {
  if (data === null) return true;
  var max = data.length;
  return max === 1 && data === "~" || max === 4 && (data === "null" || data === "Null" || data === "NULL");
}
function constructYamlNull() {
  return null;
}
function isNull(object) {
  return object === null;
}
var _null = new type("tag:yaml.org,2002:null", {
  kind: "scalar",
  resolve: resolveYamlNull,
  construct: constructYamlNull,
  predicate: isNull,
  represent: {
    canonical: function() {
      return "~";
    },
    lowercase: function() {
      return "null";
    },
    uppercase: function() {
      return "NULL";
    },
    camelcase: function() {
      return "Null";
    },
    empty: function() {
      return "";
    }
  },
  defaultStyle: "lowercase"
});
function resolveYamlBoolean(data) {
  if (data === null) return false;
  var max = data.length;
  return max === 4 && (data === "true" || data === "True" || data === "TRUE") || max === 5 && (data === "false" || data === "False" || data === "FALSE");
}
function constructYamlBoolean(data) {
  return data === "true" || data === "True" || data === "TRUE";
}
function isBoolean(object) {
  return Object.prototype.toString.call(object) === "[object Boolean]";
}
var bool = new type("tag:yaml.org,2002:bool", {
  kind: "scalar",
  resolve: resolveYamlBoolean,
  construct: constructYamlBoolean,
  predicate: isBoolean,
  represent: {
    lowercase: function(object) {
      return object ? "true" : "false";
    },
    uppercase: function(object) {
      return object ? "TRUE" : "FALSE";
    },
    camelcase: function(object) {
      return object ? "True" : "False";
    }
  },
  defaultStyle: "lowercase"
});
function isHexCode(c) {
  return 48 <= c && c <= 57 || 65 <= c && c <= 70 || 97 <= c && c <= 102;
}
function isOctCode(c) {
  return 48 <= c && c <= 55;
}
function isDecCode(c) {
  return 48 <= c && c <= 57;
}
function resolveYamlInteger(data) {
  if (data === null) return false;
  var max = data.length, index = 0, hasDigits = false, ch;
  if (!max) return false;
  ch = data[index];
  if (ch === "-" || ch === "+") {
    ch = data[++index];
  }
  if (ch === "0") {
    if (index + 1 === max) return true;
    ch = data[++index];
    if (ch === "b") {
      index++;
      for (; index < max; index++) {
        ch = data[index];
        if (ch === "_") continue;
        if (ch !== "0" && ch !== "1") return false;
        hasDigits = true;
      }
      return hasDigits && ch !== "_";
    }
    if (ch === "x") {
      index++;
      for (; index < max; index++) {
        ch = data[index];
        if (ch === "_") continue;
        if (!isHexCode(data.charCodeAt(index))) return false;
        hasDigits = true;
      }
      return hasDigits && ch !== "_";
    }
    if (ch === "o") {
      index++;
      for (; index < max; index++) {
        ch = data[index];
        if (ch === "_") continue;
        if (!isOctCode(data.charCodeAt(index))) return false;
        hasDigits = true;
      }
      return hasDigits && ch !== "_";
    }
  }
  if (ch === "_") return false;
  for (; index < max; index++) {
    ch = data[index];
    if (ch === "_") continue;
    if (!isDecCode(data.charCodeAt(index))) {
      return false;
    }
    hasDigits = true;
  }
  if (!hasDigits || ch === "_") return false;
  return true;
}
function constructYamlInteger(data) {
  var value = data, sign = 1, ch;
  if (value.indexOf("_") !== -1) {
    value = value.replace(/_/g, "");
  }
  ch = value[0];
  if (ch === "-" || ch === "+") {
    if (ch === "-") sign = -1;
    value = value.slice(1);
    ch = value[0];
  }
  if (value === "0") return 0;
  if (ch === "0") {
    if (value[1] === "b") return sign * parseInt(value.slice(2), 2);
    if (value[1] === "x") return sign * parseInt(value.slice(2), 16);
    if (value[1] === "o") return sign * parseInt(value.slice(2), 8);
  }
  return sign * parseInt(value, 10);
}
function isInteger(object) {
  return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 === 0 && !common.isNegativeZero(object));
}
var int = new type("tag:yaml.org,2002:int", {
  kind: "scalar",
  resolve: resolveYamlInteger,
  construct: constructYamlInteger,
  predicate: isInteger,
  represent: {
    binary: function(obj) {
      return obj >= 0 ? "0b" + obj.toString(2) : "-0b" + obj.toString(2).slice(1);
    },
    octal: function(obj) {
      return obj >= 0 ? "0o" + obj.toString(8) : "-0o" + obj.toString(8).slice(1);
    },
    decimal: function(obj) {
      return obj.toString(10);
    },
    /* eslint-disable max-len */
    hexadecimal: function(obj) {
      return obj >= 0 ? "0x" + obj.toString(16).toUpperCase() : "-0x" + obj.toString(16).toUpperCase().slice(1);
    }
  },
  defaultStyle: "decimal",
  styleAliases: {
    binary: [2, "bin"],
    octal: [8, "oct"],
    decimal: [10, "dec"],
    hexadecimal: [16, "hex"]
  }
});
var YAML_FLOAT_PATTERN = new RegExp(
  // 2.5e4, 2.5 and integers
  "^(?:[-+]?(?:[0-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$"
);
function resolveYamlFloat(data) {
  if (data === null) return false;
  if (!YAML_FLOAT_PATTERN.test(data) || // Quick hack to not allow integers end with `_`
  // Probably should update regexp & check speed
  data[data.length - 1] === "_") {
    return false;
  }
  return true;
}
function constructYamlFloat(data) {
  var value, sign;
  value = data.replace(/_/g, "").toLowerCase();
  sign = value[0] === "-" ? -1 : 1;
  if ("+-".indexOf(value[0]) >= 0) {
    value = value.slice(1);
  }
  if (value === ".inf") {
    return sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
  } else if (value === ".nan") {
    return NaN;
  }
  return sign * parseFloat(value, 10);
}
var SCIENTIFIC_WITHOUT_DOT = /^[-+]?[0-9]+e/;
function representYamlFloat(object, style) {
  var res;
  if (isNaN(object)) {
    switch (style) {
      case "lowercase":
        return ".nan";
      case "uppercase":
        return ".NAN";
      case "camelcase":
        return ".NaN";
    }
  } else if (Number.POSITIVE_INFINITY === object) {
    switch (style) {
      case "lowercase":
        return ".inf";
      case "uppercase":
        return ".INF";
      case "camelcase":
        return ".Inf";
    }
  } else if (Number.NEGATIVE_INFINITY === object) {
    switch (style) {
      case "lowercase":
        return "-.inf";
      case "uppercase":
        return "-.INF";
      case "camelcase":
        return "-.Inf";
    }
  } else if (common.isNegativeZero(object)) {
    return "-0.0";
  }
  res = object.toString(10);
  return SCIENTIFIC_WITHOUT_DOT.test(res) ? res.replace("e", ".e") : res;
}
function isFloat(object) {
  return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 !== 0 || common.isNegativeZero(object));
}
var float = new type("tag:yaml.org,2002:float", {
  kind: "scalar",
  resolve: resolveYamlFloat,
  construct: constructYamlFloat,
  predicate: isFloat,
  represent: representYamlFloat,
  defaultStyle: "lowercase"
});
var json = failsafe.extend({
  implicit: [
    _null,
    bool,
    int,
    float
  ]
});
var core = json;
var YAML_DATE_REGEXP = new RegExp(
  "^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$"
);
var YAML_TIMESTAMP_REGEXP = new RegExp(
  "^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$"
);
function resolveYamlTimestamp(data) {
  if (data === null) return false;
  if (YAML_DATE_REGEXP.exec(data) !== null) return true;
  if (YAML_TIMESTAMP_REGEXP.exec(data) !== null) return true;
  return false;
}
function constructYamlTimestamp(data) {
  var match, year, month, day, hour, minute, second, fraction = 0, delta = null, tz_hour, tz_minute, date;
  match = YAML_DATE_REGEXP.exec(data);
  if (match === null) match = YAML_TIMESTAMP_REGEXP.exec(data);
  if (match === null) throw new Error("Date resolve error");
  year = +match[1];
  month = +match[2] - 1;
  day = +match[3];
  if (!match[4]) {
    return new Date(Date.UTC(year, month, day));
  }
  hour = +match[4];
  minute = +match[5];
  second = +match[6];
  if (match[7]) {
    fraction = match[7].slice(0, 3);
    while (fraction.length < 3) {
      fraction += "0";
    }
    fraction = +fraction;
  }
  if (match[9]) {
    tz_hour = +match[10];
    tz_minute = +(match[11] || 0);
    delta = (tz_hour * 60 + tz_minute) * 6e4;
    if (match[9] === "-") delta = -delta;
  }
  date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));
  if (delta) date.setTime(date.getTime() - delta);
  return date;
}
function representYamlTimestamp(object) {
  return object.toISOString();
}
var timestamp = new type("tag:yaml.org,2002:timestamp", {
  kind: "scalar",
  resolve: resolveYamlTimestamp,
  construct: constructYamlTimestamp,
  instanceOf: Date,
  represent: representYamlTimestamp
});
function resolveYamlMerge(data) {
  return data === "<<" || data === null;
}
var merge = new type("tag:yaml.org,2002:merge", {
  kind: "scalar",
  resolve: resolveYamlMerge
});
var BASE64_MAP = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\n\r";
function resolveYamlBinary(data) {
  if (data === null) return false;
  var code, idx, bitlen = 0, max = data.length, map2 = BASE64_MAP;
  for (idx = 0; idx < max; idx++) {
    code = map2.indexOf(data.charAt(idx));
    if (code > 64) continue;
    if (code < 0) return false;
    bitlen += 6;
  }
  return bitlen % 8 === 0;
}
function constructYamlBinary(data) {
  var idx, tailbits, input = data.replace(/[\r\n=]/g, ""), max = input.length, map2 = BASE64_MAP, bits = 0, result = [];
  for (idx = 0; idx < max; idx++) {
    if (idx % 4 === 0 && idx) {
      result.push(bits >> 16 & 255);
      result.push(bits >> 8 & 255);
      result.push(bits & 255);
    }
    bits = bits << 6 | map2.indexOf(input.charAt(idx));
  }
  tailbits = max % 4 * 6;
  if (tailbits === 0) {
    result.push(bits >> 16 & 255);
    result.push(bits >> 8 & 255);
    result.push(bits & 255);
  } else if (tailbits === 18) {
    result.push(bits >> 10 & 255);
    result.push(bits >> 2 & 255);
  } else if (tailbits === 12) {
    result.push(bits >> 4 & 255);
  }
  return new Uint8Array(result);
}
function representYamlBinary(object) {
  var result = "", bits = 0, idx, tail, max = object.length, map2 = BASE64_MAP;
  for (idx = 0; idx < max; idx++) {
    if (idx % 3 === 0 && idx) {
      result += map2[bits >> 18 & 63];
      result += map2[bits >> 12 & 63];
      result += map2[bits >> 6 & 63];
      result += map2[bits & 63];
    }
    bits = (bits << 8) + object[idx];
  }
  tail = max % 3;
  if (tail === 0) {
    result += map2[bits >> 18 & 63];
    result += map2[bits >> 12 & 63];
    result += map2[bits >> 6 & 63];
    result += map2[bits & 63];
  } else if (tail === 2) {
    result += map2[bits >> 10 & 63];
    result += map2[bits >> 4 & 63];
    result += map2[bits << 2 & 63];
    result += map2[64];
  } else if (tail === 1) {
    result += map2[bits >> 2 & 63];
    result += map2[bits << 4 & 63];
    result += map2[64];
    result += map2[64];
  }
  return result;
}
function isBinary(obj) {
  return Object.prototype.toString.call(obj) === "[object Uint8Array]";
}
var binary = new type("tag:yaml.org,2002:binary", {
  kind: "scalar",
  resolve: resolveYamlBinary,
  construct: constructYamlBinary,
  predicate: isBinary,
  represent: representYamlBinary
});
var _hasOwnProperty$3 = Object.prototype.hasOwnProperty;
var _toString$2 = Object.prototype.toString;
function resolveYamlOmap(data) {
  if (data === null) return true;
  var objectKeys = [], index, length, pair, pairKey, pairHasKey, object = data;
  for (index = 0, length = object.length; index < length; index += 1) {
    pair = object[index];
    pairHasKey = false;
    if (_toString$2.call(pair) !== "[object Object]") return false;
    for (pairKey in pair) {
      if (_hasOwnProperty$3.call(pair, pairKey)) {
        if (!pairHasKey) pairHasKey = true;
        else return false;
      }
    }
    if (!pairHasKey) return false;
    if (objectKeys.indexOf(pairKey) === -1) objectKeys.push(pairKey);
    else return false;
  }
  return true;
}
function constructYamlOmap(data) {
  return data !== null ? data : [];
}
var omap = new type("tag:yaml.org,2002:omap", {
  kind: "sequence",
  resolve: resolveYamlOmap,
  construct: constructYamlOmap
});
var _toString$1 = Object.prototype.toString;
function resolveYamlPairs(data) {
  if (data === null) return true;
  var index, length, pair, keys, result, object = data;
  result = new Array(object.length);
  for (index = 0, length = object.length; index < length; index += 1) {
    pair = object[index];
    if (_toString$1.call(pair) !== "[object Object]") return false;
    keys = Object.keys(pair);
    if (keys.length !== 1) return false;
    result[index] = [keys[0], pair[keys[0]]];
  }
  return true;
}
function constructYamlPairs(data) {
  if (data === null) return [];
  var index, length, pair, keys, result, object = data;
  result = new Array(object.length);
  for (index = 0, length = object.length; index < length; index += 1) {
    pair = object[index];
    keys = Object.keys(pair);
    result[index] = [keys[0], pair[keys[0]]];
  }
  return result;
}
var pairs = new type("tag:yaml.org,2002:pairs", {
  kind: "sequence",
  resolve: resolveYamlPairs,
  construct: constructYamlPairs
});
var _hasOwnProperty$2 = Object.prototype.hasOwnProperty;
function resolveYamlSet(data) {
  if (data === null) return true;
  var key, object = data;
  for (key in object) {
    if (_hasOwnProperty$2.call(object, key)) {
      if (object[key] !== null) return false;
    }
  }
  return true;
}
function constructYamlSet(data) {
  return data !== null ? data : {};
}
var set = new type("tag:yaml.org,2002:set", {
  kind: "mapping",
  resolve: resolveYamlSet,
  construct: constructYamlSet
});
var _default = core.extend({
  implicit: [
    timestamp,
    merge
  ],
  explicit: [
    binary,
    omap,
    pairs,
    set
  ]
});
var _hasOwnProperty$1 = Object.prototype.hasOwnProperty;
var CONTEXT_FLOW_IN = 1;
var CONTEXT_FLOW_OUT = 2;
var CONTEXT_BLOCK_IN = 3;
var CONTEXT_BLOCK_OUT = 4;
var CHOMPING_CLIP = 1;
var CHOMPING_STRIP = 2;
var CHOMPING_KEEP = 3;
var PATTERN_NON_PRINTABLE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
var PATTERN_NON_ASCII_LINE_BREAKS = /[\x85\u2028\u2029]/;
var PATTERN_FLOW_INDICATORS = /[,\[\]\{\}]/;
var PATTERN_TAG_HANDLE = /^(?:!|!!|![a-z\-]+!)$/i;
var PATTERN_TAG_URI = /^(?:!|[^,\[\]\{\}])(?:%[0-9a-f]{2}|[0-9a-z\-#;\/\?:@&=\+\$,_\.!~\*'\(\)\[\]])*$/i;
function _class(obj) {
  return Object.prototype.toString.call(obj);
}
function is_EOL(c) {
  return c === 10 || c === 13;
}
function is_WHITE_SPACE(c) {
  return c === 9 || c === 32;
}
function is_WS_OR_EOL(c) {
  return c === 9 || c === 32 || c === 10 || c === 13;
}
function is_FLOW_INDICATOR(c) {
  return c === 44 || c === 91 || c === 93 || c === 123 || c === 125;
}
function fromHexCode(c) {
  var lc;
  if (48 <= c && c <= 57) {
    return c - 48;
  }
  lc = c | 32;
  if (97 <= lc && lc <= 102) {
    return lc - 97 + 10;
  }
  return -1;
}
function escapedHexLen(c) {
  if (c === 120) {
    return 2;
  }
  if (c === 117) {
    return 4;
  }
  if (c === 85) {
    return 8;
  }
  return 0;
}
function fromDecimalCode(c) {
  if (48 <= c && c <= 57) {
    return c - 48;
  }
  return -1;
}
function simpleEscapeSequence(c) {
  return c === 48 ? "\0" : c === 97 ? "\x07" : c === 98 ? "\b" : c === 116 ? "	" : c === 9 ? "	" : c === 110 ? "\n" : c === 118 ? "\v" : c === 102 ? "\f" : c === 114 ? "\r" : c === 101 ? "\x1B" : c === 32 ? " " : c === 34 ? '"' : c === 47 ? "/" : c === 92 ? "\\" : c === 78 ? "\x85" : c === 95 ? "\xA0" : c === 76 ? "\u2028" : c === 80 ? "\u2029" : "";
}
function charFromCodepoint(c) {
  if (c <= 65535) {
    return String.fromCharCode(c);
  }
  return String.fromCharCode(
    (c - 65536 >> 10) + 55296,
    (c - 65536 & 1023) + 56320
  );
}
function setProperty(object, key, value) {
  if (key === "__proto__") {
    Object.defineProperty(object, key, {
      configurable: true,
      enumerable: true,
      writable: true,
      value
    });
  } else {
    object[key] = value;
  }
}
var simpleEscapeCheck = new Array(256);
var simpleEscapeMap = new Array(256);
for (i = 0; i < 256; i++) {
  simpleEscapeCheck[i] = simpleEscapeSequence(i) ? 1 : 0;
  simpleEscapeMap[i] = simpleEscapeSequence(i);
}
var i;
function State$1(input, options) {
  this.input = input;
  this.filename = options["filename"] || null;
  this.schema = options["schema"] || _default;
  this.onWarning = options["onWarning"] || null;
  this.legacy = options["legacy"] || false;
  this.json = options["json"] || false;
  this.listener = options["listener"] || null;
  this.implicitTypes = this.schema.compiledImplicit;
  this.typeMap = this.schema.compiledTypeMap;
  this.length = input.length;
  this.position = 0;
  this.line = 0;
  this.lineStart = 0;
  this.lineIndent = 0;
  this.firstTabInLine = -1;
  this.documents = [];
}
function generateError(state, message) {
  var mark = {
    name: state.filename,
    buffer: state.input.slice(0, -1),
    // omit trailing \0
    position: state.position,
    line: state.line,
    column: state.position - state.lineStart
  };
  mark.snippet = snippet(mark);
  return new exception(message, mark);
}
function throwError(state, message) {
  throw generateError(state, message);
}
function throwWarning(state, message) {
  if (state.onWarning) {
    state.onWarning.call(null, generateError(state, message));
  }
}
var directiveHandlers = {
  YAML: function handleYamlDirective(state, name, args) {
    var match, major, minor;
    if (state.version !== null) {
      throwError(state, "duplication of %YAML directive");
    }
    if (args.length !== 1) {
      throwError(state, "YAML directive accepts exactly one argument");
    }
    match = /^([0-9]+)\.([0-9]+)$/.exec(args[0]);
    if (match === null) {
      throwError(state, "ill-formed argument of the YAML directive");
    }
    major = parseInt(match[1], 10);
    minor = parseInt(match[2], 10);
    if (major !== 1) {
      throwError(state, "unacceptable YAML version of the document");
    }
    state.version = args[0];
    state.checkLineBreaks = minor < 2;
    if (minor !== 1 && minor !== 2) {
      throwWarning(state, "unsupported YAML version of the document");
    }
  },
  TAG: function handleTagDirective(state, name, args) {
    var handle, prefix;
    if (args.length !== 2) {
      throwError(state, "TAG directive accepts exactly two arguments");
    }
    handle = args[0];
    prefix = args[1];
    if (!PATTERN_TAG_HANDLE.test(handle)) {
      throwError(state, "ill-formed tag handle (first argument) of the TAG directive");
    }
    if (_hasOwnProperty$1.call(state.tagMap, handle)) {
      throwError(state, 'there is a previously declared suffix for "' + handle + '" tag handle');
    }
    if (!PATTERN_TAG_URI.test(prefix)) {
      throwError(state, "ill-formed tag prefix (second argument) of the TAG directive");
    }
    try {
      prefix = decodeURIComponent(prefix);
    } catch (err) {
      throwError(state, "tag prefix is malformed: " + prefix);
    }
    state.tagMap[handle] = prefix;
  }
};
function captureSegment(state, start, end, checkJson) {
  var _position, _length, _character, _result;
  if (start < end) {
    _result = state.input.slice(start, end);
    if (checkJson) {
      for (_position = 0, _length = _result.length; _position < _length; _position += 1) {
        _character = _result.charCodeAt(_position);
        if (!(_character === 9 || 32 <= _character && _character <= 1114111)) {
          throwError(state, "expected valid JSON character");
        }
      }
    } else if (PATTERN_NON_PRINTABLE.test(_result)) {
      throwError(state, "the stream contains non-printable characters");
    }
    state.result += _result;
  }
}
function mergeMappings(state, destination, source, overridableKeys) {
  var sourceKeys, key, index, quantity;
  if (!common.isObject(source)) {
    throwError(state, "cannot merge mappings; the provided source object is unacceptable");
  }
  sourceKeys = Object.keys(source);
  for (index = 0, quantity = sourceKeys.length; index < quantity; index += 1) {
    key = sourceKeys[index];
    if (!_hasOwnProperty$1.call(destination, key)) {
      setProperty(destination, key, source[key]);
      overridableKeys[key] = true;
    }
  }
}
function storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, startLine, startLineStart, startPos) {
  var index, quantity;
  if (Array.isArray(keyNode)) {
    keyNode = Array.prototype.slice.call(keyNode);
    for (index = 0, quantity = keyNode.length; index < quantity; index += 1) {
      if (Array.isArray(keyNode[index])) {
        throwError(state, "nested arrays are not supported inside keys");
      }
      if (typeof keyNode === "object" && _class(keyNode[index]) === "[object Object]") {
        keyNode[index] = "[object Object]";
      }
    }
  }
  if (typeof keyNode === "object" && _class(keyNode) === "[object Object]") {
    keyNode = "[object Object]";
  }
  keyNode = String(keyNode);
  if (_result === null) {
    _result = {};
  }
  if (keyTag === "tag:yaml.org,2002:merge") {
    if (Array.isArray(valueNode)) {
      for (index = 0, quantity = valueNode.length; index < quantity; index += 1) {
        mergeMappings(state, _result, valueNode[index], overridableKeys);
      }
    } else {
      mergeMappings(state, _result, valueNode, overridableKeys);
    }
  } else {
    if (!state.json && !_hasOwnProperty$1.call(overridableKeys, keyNode) && _hasOwnProperty$1.call(_result, keyNode)) {
      state.line = startLine || state.line;
      state.lineStart = startLineStart || state.lineStart;
      state.position = startPos || state.position;
      throwError(state, "duplicated mapping key");
    }
    setProperty(_result, keyNode, valueNode);
    delete overridableKeys[keyNode];
  }
  return _result;
}
function readLineBreak(state) {
  var ch;
  ch = state.input.charCodeAt(state.position);
  if (ch === 10) {
    state.position++;
  } else if (ch === 13) {
    state.position++;
    if (state.input.charCodeAt(state.position) === 10) {
      state.position++;
    }
  } else {
    throwError(state, "a line break is expected");
  }
  state.line += 1;
  state.lineStart = state.position;
  state.firstTabInLine = -1;
}
function skipSeparationSpace(state, allowComments, checkIndent) {
  var lineBreaks = 0, ch = state.input.charCodeAt(state.position);
  while (ch !== 0) {
    while (is_WHITE_SPACE(ch)) {
      if (ch === 9 && state.firstTabInLine === -1) {
        state.firstTabInLine = state.position;
      }
      ch = state.input.charCodeAt(++state.position);
    }
    if (allowComments && ch === 35) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (ch !== 10 && ch !== 13 && ch !== 0);
    }
    if (is_EOL(ch)) {
      readLineBreak(state);
      ch = state.input.charCodeAt(state.position);
      lineBreaks++;
      state.lineIndent = 0;
      while (ch === 32) {
        state.lineIndent++;
        ch = state.input.charCodeAt(++state.position);
      }
    } else {
      break;
    }
  }
  if (checkIndent !== -1 && lineBreaks !== 0 && state.lineIndent < checkIndent) {
    throwWarning(state, "deficient indentation");
  }
  return lineBreaks;
}
function testDocumentSeparator(state) {
  var _position = state.position, ch;
  ch = state.input.charCodeAt(_position);
  if ((ch === 45 || ch === 46) && ch === state.input.charCodeAt(_position + 1) && ch === state.input.charCodeAt(_position + 2)) {
    _position += 3;
    ch = state.input.charCodeAt(_position);
    if (ch === 0 || is_WS_OR_EOL(ch)) {
      return true;
    }
  }
  return false;
}
function writeFoldedLines(state, count) {
  if (count === 1) {
    state.result += " ";
  } else if (count > 1) {
    state.result += common.repeat("\n", count - 1);
  }
}
function readPlainScalar(state, nodeIndent, withinFlowCollection) {
  var preceding, following, captureStart, captureEnd, hasPendingContent, _line, _lineStart, _lineIndent, _kind = state.kind, _result = state.result, ch;
  ch = state.input.charCodeAt(state.position);
  if (is_WS_OR_EOL(ch) || is_FLOW_INDICATOR(ch) || ch === 35 || ch === 38 || ch === 42 || ch === 33 || ch === 124 || ch === 62 || ch === 39 || ch === 34 || ch === 37 || ch === 64 || ch === 96) {
    return false;
  }
  if (ch === 63 || ch === 45) {
    following = state.input.charCodeAt(state.position + 1);
    if (is_WS_OR_EOL(following) || withinFlowCollection && is_FLOW_INDICATOR(following)) {
      return false;
    }
  }
  state.kind = "scalar";
  state.result = "";
  captureStart = captureEnd = state.position;
  hasPendingContent = false;
  while (ch !== 0) {
    if (ch === 58) {
      following = state.input.charCodeAt(state.position + 1);
      if (is_WS_OR_EOL(following) || withinFlowCollection && is_FLOW_INDICATOR(following)) {
        break;
      }
    } else if (ch === 35) {
      preceding = state.input.charCodeAt(state.position - 1);
      if (is_WS_OR_EOL(preceding)) {
        break;
      }
    } else if (state.position === state.lineStart && testDocumentSeparator(state) || withinFlowCollection && is_FLOW_INDICATOR(ch)) {
      break;
    } else if (is_EOL(ch)) {
      _line = state.line;
      _lineStart = state.lineStart;
      _lineIndent = state.lineIndent;
      skipSeparationSpace(state, false, -1);
      if (state.lineIndent >= nodeIndent) {
        hasPendingContent = true;
        ch = state.input.charCodeAt(state.position);
        continue;
      } else {
        state.position = captureEnd;
        state.line = _line;
        state.lineStart = _lineStart;
        state.lineIndent = _lineIndent;
        break;
      }
    }
    if (hasPendingContent) {
      captureSegment(state, captureStart, captureEnd, false);
      writeFoldedLines(state, state.line - _line);
      captureStart = captureEnd = state.position;
      hasPendingContent = false;
    }
    if (!is_WHITE_SPACE(ch)) {
      captureEnd = state.position + 1;
    }
    ch = state.input.charCodeAt(++state.position);
  }
  captureSegment(state, captureStart, captureEnd, false);
  if (state.result) {
    return true;
  }
  state.kind = _kind;
  state.result = _result;
  return false;
}
function readSingleQuotedScalar(state, nodeIndent) {
  var ch, captureStart, captureEnd;
  ch = state.input.charCodeAt(state.position);
  if (ch !== 39) {
    return false;
  }
  state.kind = "scalar";
  state.result = "";
  state.position++;
  captureStart = captureEnd = state.position;
  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    if (ch === 39) {
      captureSegment(state, captureStart, state.position, true);
      ch = state.input.charCodeAt(++state.position);
      if (ch === 39) {
        captureStart = state.position;
        state.position++;
        captureEnd = state.position;
      } else {
        return true;
      }
    } else if (is_EOL(ch)) {
      captureSegment(state, captureStart, captureEnd, true);
      writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
      captureStart = captureEnd = state.position;
    } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
      throwError(state, "unexpected end of the document within a single quoted scalar");
    } else {
      state.position++;
      captureEnd = state.position;
    }
  }
  throwError(state, "unexpected end of the stream within a single quoted scalar");
}
function readDoubleQuotedScalar(state, nodeIndent) {
  var captureStart, captureEnd, hexLength, hexResult, tmp, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch !== 34) {
    return false;
  }
  state.kind = "scalar";
  state.result = "";
  state.position++;
  captureStart = captureEnd = state.position;
  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    if (ch === 34) {
      captureSegment(state, captureStart, state.position, true);
      state.position++;
      return true;
    } else if (ch === 92) {
      captureSegment(state, captureStart, state.position, true);
      ch = state.input.charCodeAt(++state.position);
      if (is_EOL(ch)) {
        skipSeparationSpace(state, false, nodeIndent);
      } else if (ch < 256 && simpleEscapeCheck[ch]) {
        state.result += simpleEscapeMap[ch];
        state.position++;
      } else if ((tmp = escapedHexLen(ch)) > 0) {
        hexLength = tmp;
        hexResult = 0;
        for (; hexLength > 0; hexLength--) {
          ch = state.input.charCodeAt(++state.position);
          if ((tmp = fromHexCode(ch)) >= 0) {
            hexResult = (hexResult << 4) + tmp;
          } else {
            throwError(state, "expected hexadecimal character");
          }
        }
        state.result += charFromCodepoint(hexResult);
        state.position++;
      } else {
        throwError(state, "unknown escape sequence");
      }
      captureStart = captureEnd = state.position;
    } else if (is_EOL(ch)) {
      captureSegment(state, captureStart, captureEnd, true);
      writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
      captureStart = captureEnd = state.position;
    } else if (state.position === state.lineStart && testDocumentSeparator(state)) {
      throwError(state, "unexpected end of the document within a double quoted scalar");
    } else {
      state.position++;
      captureEnd = state.position;
    }
  }
  throwError(state, "unexpected end of the stream within a double quoted scalar");
}
function readFlowCollection(state, nodeIndent) {
  var readNext = true, _line, _lineStart, _pos, _tag = state.tag, _result, _anchor = state.anchor, following, terminator, isPair, isExplicitPair, isMapping, overridableKeys = /* @__PURE__ */ Object.create(null), keyNode, keyTag, valueNode, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch === 91) {
    terminator = 93;
    isMapping = false;
    _result = [];
  } else if (ch === 123) {
    terminator = 125;
    isMapping = true;
    _result = {};
  } else {
    return false;
  }
  if (state.anchor !== null) {
    state.anchorMap[state.anchor] = _result;
  }
  ch = state.input.charCodeAt(++state.position);
  while (ch !== 0) {
    skipSeparationSpace(state, true, nodeIndent);
    ch = state.input.charCodeAt(state.position);
    if (ch === terminator) {
      state.position++;
      state.tag = _tag;
      state.anchor = _anchor;
      state.kind = isMapping ? "mapping" : "sequence";
      state.result = _result;
      return true;
    } else if (!readNext) {
      throwError(state, "missed comma between flow collection entries");
    } else if (ch === 44) {
      throwError(state, "expected the node content, but found ','");
    }
    keyTag = keyNode = valueNode = null;
    isPair = isExplicitPair = false;
    if (ch === 63) {
      following = state.input.charCodeAt(state.position + 1);
      if (is_WS_OR_EOL(following)) {
        isPair = isExplicitPair = true;
        state.position++;
        skipSeparationSpace(state, true, nodeIndent);
      }
    }
    _line = state.line;
    _lineStart = state.lineStart;
    _pos = state.position;
    composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
    keyTag = state.tag;
    keyNode = state.result;
    skipSeparationSpace(state, true, nodeIndent);
    ch = state.input.charCodeAt(state.position);
    if ((isExplicitPair || state.line === _line) && ch === 58) {
      isPair = true;
      ch = state.input.charCodeAt(++state.position);
      skipSeparationSpace(state, true, nodeIndent);
      composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
      valueNode = state.result;
    }
    if (isMapping) {
      storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos);
    } else if (isPair) {
      _result.push(storeMappingPair(state, null, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos));
    } else {
      _result.push(keyNode);
    }
    skipSeparationSpace(state, true, nodeIndent);
    ch = state.input.charCodeAt(state.position);
    if (ch === 44) {
      readNext = true;
      ch = state.input.charCodeAt(++state.position);
    } else {
      readNext = false;
    }
  }
  throwError(state, "unexpected end of the stream within a flow collection");
}
function readBlockScalar(state, nodeIndent) {
  var captureStart, folding, chomping = CHOMPING_CLIP, didReadContent = false, detectedIndent = false, textIndent = nodeIndent, emptyLines = 0, atMoreIndented = false, tmp, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch === 124) {
    folding = false;
  } else if (ch === 62) {
    folding = true;
  } else {
    return false;
  }
  state.kind = "scalar";
  state.result = "";
  while (ch !== 0) {
    ch = state.input.charCodeAt(++state.position);
    if (ch === 43 || ch === 45) {
      if (CHOMPING_CLIP === chomping) {
        chomping = ch === 43 ? CHOMPING_KEEP : CHOMPING_STRIP;
      } else {
        throwError(state, "repeat of a chomping mode identifier");
      }
    } else if ((tmp = fromDecimalCode(ch)) >= 0) {
      if (tmp === 0) {
        throwError(state, "bad explicit indentation width of a block scalar; it cannot be less than one");
      } else if (!detectedIndent) {
        textIndent = nodeIndent + tmp - 1;
        detectedIndent = true;
      } else {
        throwError(state, "repeat of an indentation width identifier");
      }
    } else {
      break;
    }
  }
  if (is_WHITE_SPACE(ch)) {
    do {
      ch = state.input.charCodeAt(++state.position);
    } while (is_WHITE_SPACE(ch));
    if (ch === 35) {
      do {
        ch = state.input.charCodeAt(++state.position);
      } while (!is_EOL(ch) && ch !== 0);
    }
  }
  while (ch !== 0) {
    readLineBreak(state);
    state.lineIndent = 0;
    ch = state.input.charCodeAt(state.position);
    while ((!detectedIndent || state.lineIndent < textIndent) && ch === 32) {
      state.lineIndent++;
      ch = state.input.charCodeAt(++state.position);
    }
    if (!detectedIndent && state.lineIndent > textIndent) {
      textIndent = state.lineIndent;
    }
    if (is_EOL(ch)) {
      emptyLines++;
      continue;
    }
    if (state.lineIndent < textIndent) {
      if (chomping === CHOMPING_KEEP) {
        state.result += common.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
      } else if (chomping === CHOMPING_CLIP) {
        if (didReadContent) {
          state.result += "\n";
        }
      }
      break;
    }
    if (folding) {
      if (is_WHITE_SPACE(ch)) {
        atMoreIndented = true;
        state.result += common.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
      } else if (atMoreIndented) {
        atMoreIndented = false;
        state.result += common.repeat("\n", emptyLines + 1);
      } else if (emptyLines === 0) {
        if (didReadContent) {
          state.result += " ";
        }
      } else {
        state.result += common.repeat("\n", emptyLines);
      }
    } else {
      state.result += common.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
    }
    didReadContent = true;
    detectedIndent = true;
    emptyLines = 0;
    captureStart = state.position;
    while (!is_EOL(ch) && ch !== 0) {
      ch = state.input.charCodeAt(++state.position);
    }
    captureSegment(state, captureStart, state.position, false);
  }
  return true;
}
function readBlockSequence(state, nodeIndent) {
  var _line, _tag = state.tag, _anchor = state.anchor, _result = [], following, detected = false, ch;
  if (state.firstTabInLine !== -1) return false;
  if (state.anchor !== null) {
    state.anchorMap[state.anchor] = _result;
  }
  ch = state.input.charCodeAt(state.position);
  while (ch !== 0) {
    if (state.firstTabInLine !== -1) {
      state.position = state.firstTabInLine;
      throwError(state, "tab characters must not be used in indentation");
    }
    if (ch !== 45) {
      break;
    }
    following = state.input.charCodeAt(state.position + 1);
    if (!is_WS_OR_EOL(following)) {
      break;
    }
    detected = true;
    state.position++;
    if (skipSeparationSpace(state, true, -1)) {
      if (state.lineIndent <= nodeIndent) {
        _result.push(null);
        ch = state.input.charCodeAt(state.position);
        continue;
      }
    }
    _line = state.line;
    composeNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
    _result.push(state.result);
    skipSeparationSpace(state, true, -1);
    ch = state.input.charCodeAt(state.position);
    if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
      throwError(state, "bad indentation of a sequence entry");
    } else if (state.lineIndent < nodeIndent) {
      break;
    }
  }
  if (detected) {
    state.tag = _tag;
    state.anchor = _anchor;
    state.kind = "sequence";
    state.result = _result;
    return true;
  }
  return false;
}
function readBlockMapping(state, nodeIndent, flowIndent) {
  var following, allowCompact, _line, _keyLine, _keyLineStart, _keyPos, _tag = state.tag, _anchor = state.anchor, _result = {}, overridableKeys = /* @__PURE__ */ Object.create(null), keyTag = null, keyNode = null, valueNode = null, atExplicitKey = false, detected = false, ch;
  if (state.firstTabInLine !== -1) return false;
  if (state.anchor !== null) {
    state.anchorMap[state.anchor] = _result;
  }
  ch = state.input.charCodeAt(state.position);
  while (ch !== 0) {
    if (!atExplicitKey && state.firstTabInLine !== -1) {
      state.position = state.firstTabInLine;
      throwError(state, "tab characters must not be used in indentation");
    }
    following = state.input.charCodeAt(state.position + 1);
    _line = state.line;
    if ((ch === 63 || ch === 58) && is_WS_OR_EOL(following)) {
      if (ch === 63) {
        if (atExplicitKey) {
          storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
          keyTag = keyNode = valueNode = null;
        }
        detected = true;
        atExplicitKey = true;
        allowCompact = true;
      } else if (atExplicitKey) {
        atExplicitKey = false;
        allowCompact = true;
      } else {
        throwError(state, "incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line");
      }
      state.position += 1;
      ch = following;
    } else {
      _keyLine = state.line;
      _keyLineStart = state.lineStart;
      _keyPos = state.position;
      if (!composeNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) {
        break;
      }
      if (state.line === _line) {
        ch = state.input.charCodeAt(state.position);
        while (is_WHITE_SPACE(ch)) {
          ch = state.input.charCodeAt(++state.position);
        }
        if (ch === 58) {
          ch = state.input.charCodeAt(++state.position);
          if (!is_WS_OR_EOL(ch)) {
            throwError(state, "a whitespace character is expected after the key-value separator within a block mapping");
          }
          if (atExplicitKey) {
            storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
            keyTag = keyNode = valueNode = null;
          }
          detected = true;
          atExplicitKey = false;
          allowCompact = false;
          keyTag = state.tag;
          keyNode = state.result;
        } else if (detected) {
          throwError(state, "can not read an implicit mapping pair; a colon is missed");
        } else {
          state.tag = _tag;
          state.anchor = _anchor;
          return true;
        }
      } else if (detected) {
        throwError(state, "can not read a block mapping entry; a multiline key may not be an implicit key");
      } else {
        state.tag = _tag;
        state.anchor = _anchor;
        return true;
      }
    }
    if (state.line === _line || state.lineIndent > nodeIndent) {
      if (atExplicitKey) {
        _keyLine = state.line;
        _keyLineStart = state.lineStart;
        _keyPos = state.position;
      }
      if (composeNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, allowCompact)) {
        if (atExplicitKey) {
          keyNode = state.result;
        } else {
          valueNode = state.result;
        }
      }
      if (!atExplicitKey) {
        storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _keyLine, _keyLineStart, _keyPos);
        keyTag = keyNode = valueNode = null;
      }
      skipSeparationSpace(state, true, -1);
      ch = state.input.charCodeAt(state.position);
    }
    if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) {
      throwError(state, "bad indentation of a mapping entry");
    } else if (state.lineIndent < nodeIndent) {
      break;
    }
  }
  if (atExplicitKey) {
    storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
  }
  if (detected) {
    state.tag = _tag;
    state.anchor = _anchor;
    state.kind = "mapping";
    state.result = _result;
  }
  return detected;
}
function readTagProperty(state) {
  var _position, isVerbatim = false, isNamed = false, tagHandle, tagName, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch !== 33) return false;
  if (state.tag !== null) {
    throwError(state, "duplication of a tag property");
  }
  ch = state.input.charCodeAt(++state.position);
  if (ch === 60) {
    isVerbatim = true;
    ch = state.input.charCodeAt(++state.position);
  } else if (ch === 33) {
    isNamed = true;
    tagHandle = "!!";
    ch = state.input.charCodeAt(++state.position);
  } else {
    tagHandle = "!";
  }
  _position = state.position;
  if (isVerbatim) {
    do {
      ch = state.input.charCodeAt(++state.position);
    } while (ch !== 0 && ch !== 62);
    if (state.position < state.length) {
      tagName = state.input.slice(_position, state.position);
      ch = state.input.charCodeAt(++state.position);
    } else {
      throwError(state, "unexpected end of the stream within a verbatim tag");
    }
  } else {
    while (ch !== 0 && !is_WS_OR_EOL(ch)) {
      if (ch === 33) {
        if (!isNamed) {
          tagHandle = state.input.slice(_position - 1, state.position + 1);
          if (!PATTERN_TAG_HANDLE.test(tagHandle)) {
            throwError(state, "named tag handle cannot contain such characters");
          }
          isNamed = true;
          _position = state.position + 1;
        } else {
          throwError(state, "tag suffix cannot contain exclamation marks");
        }
      }
      ch = state.input.charCodeAt(++state.position);
    }
    tagName = state.input.slice(_position, state.position);
    if (PATTERN_FLOW_INDICATORS.test(tagName)) {
      throwError(state, "tag suffix cannot contain flow indicator characters");
    }
  }
  if (tagName && !PATTERN_TAG_URI.test(tagName)) {
    throwError(state, "tag name cannot contain such characters: " + tagName);
  }
  try {
    tagName = decodeURIComponent(tagName);
  } catch (err) {
    throwError(state, "tag name is malformed: " + tagName);
  }
  if (isVerbatim) {
    state.tag = tagName;
  } else if (_hasOwnProperty$1.call(state.tagMap, tagHandle)) {
    state.tag = state.tagMap[tagHandle] + tagName;
  } else if (tagHandle === "!") {
    state.tag = "!" + tagName;
  } else if (tagHandle === "!!") {
    state.tag = "tag:yaml.org,2002:" + tagName;
  } else {
    throwError(state, 'undeclared tag handle "' + tagHandle + '"');
  }
  return true;
}
function readAnchorProperty(state) {
  var _position, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch !== 38) return false;
  if (state.anchor !== null) {
    throwError(state, "duplication of an anchor property");
  }
  ch = state.input.charCodeAt(++state.position);
  _position = state.position;
  while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) {
    ch = state.input.charCodeAt(++state.position);
  }
  if (state.position === _position) {
    throwError(state, "name of an anchor node must contain at least one character");
  }
  state.anchor = state.input.slice(_position, state.position);
  return true;
}
function readAlias(state) {
  var _position, alias, ch;
  ch = state.input.charCodeAt(state.position);
  if (ch !== 42) return false;
  ch = state.input.charCodeAt(++state.position);
  _position = state.position;
  while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) {
    ch = state.input.charCodeAt(++state.position);
  }
  if (state.position === _position) {
    throwError(state, "name of an alias node must contain at least one character");
  }
  alias = state.input.slice(_position, state.position);
  if (!_hasOwnProperty$1.call(state.anchorMap, alias)) {
    throwError(state, 'unidentified alias "' + alias + '"');
  }
  state.result = state.anchorMap[alias];
  skipSeparationSpace(state, true, -1);
  return true;
}
function composeNode(state, parentIndent, nodeContext, allowToSeek, allowCompact) {
  var allowBlockStyles, allowBlockScalars, allowBlockCollections, indentStatus = 1, atNewLine = false, hasContent = false, typeIndex, typeQuantity, typeList, type2, flowIndent, blockIndent;
  if (state.listener !== null) {
    state.listener("open", state);
  }
  state.tag = null;
  state.anchor = null;
  state.kind = null;
  state.result = null;
  allowBlockStyles = allowBlockScalars = allowBlockCollections = CONTEXT_BLOCK_OUT === nodeContext || CONTEXT_BLOCK_IN === nodeContext;
  if (allowToSeek) {
    if (skipSeparationSpace(state, true, -1)) {
      atNewLine = true;
      if (state.lineIndent > parentIndent) {
        indentStatus = 1;
      } else if (state.lineIndent === parentIndent) {
        indentStatus = 0;
      } else if (state.lineIndent < parentIndent) {
        indentStatus = -1;
      }
    }
  }
  if (indentStatus === 1) {
    while (readTagProperty(state) || readAnchorProperty(state)) {
      if (skipSeparationSpace(state, true, -1)) {
        atNewLine = true;
        allowBlockCollections = allowBlockStyles;
        if (state.lineIndent > parentIndent) {
          indentStatus = 1;
        } else if (state.lineIndent === parentIndent) {
          indentStatus = 0;
        } else if (state.lineIndent < parentIndent) {
          indentStatus = -1;
        }
      } else {
        allowBlockCollections = false;
      }
    }
  }
  if (allowBlockCollections) {
    allowBlockCollections = atNewLine || allowCompact;
  }
  if (indentStatus === 1 || CONTEXT_BLOCK_OUT === nodeContext) {
    if (CONTEXT_FLOW_IN === nodeContext || CONTEXT_FLOW_OUT === nodeContext) {
      flowIndent = parentIndent;
    } else {
      flowIndent = parentIndent + 1;
    }
    blockIndent = state.position - state.lineStart;
    if (indentStatus === 1) {
      if (allowBlockCollections && (readBlockSequence(state, blockIndent) || readBlockMapping(state, blockIndent, flowIndent)) || readFlowCollection(state, flowIndent)) {
        hasContent = true;
      } else {
        if (allowBlockScalars && readBlockScalar(state, flowIndent) || readSingleQuotedScalar(state, flowIndent) || readDoubleQuotedScalar(state, flowIndent)) {
          hasContent = true;
        } else if (readAlias(state)) {
          hasContent = true;
          if (state.tag !== null || state.anchor !== null) {
            throwError(state, "alias node should not have any properties");
          }
        } else if (readPlainScalar(state, flowIndent, CONTEXT_FLOW_IN === nodeContext)) {
          hasContent = true;
          if (state.tag === null) {
            state.tag = "?";
          }
        }
        if (state.anchor !== null) {
          state.anchorMap[state.anchor] = state.result;
        }
      }
    } else if (indentStatus === 0) {
      hasContent = allowBlockCollections && readBlockSequence(state, blockIndent);
    }
  }
  if (state.tag === null) {
    if (state.anchor !== null) {
      state.anchorMap[state.anchor] = state.result;
    }
  } else if (state.tag === "?") {
    if (state.result !== null && state.kind !== "scalar") {
      throwError(state, 'unacceptable node kind for !<?> tag; it should be "scalar", not "' + state.kind + '"');
    }
    for (typeIndex = 0, typeQuantity = state.implicitTypes.length; typeIndex < typeQuantity; typeIndex += 1) {
      type2 = state.implicitTypes[typeIndex];
      if (type2.resolve(state.result)) {
        state.result = type2.construct(state.result);
        state.tag = type2.tag;
        if (state.anchor !== null) {
          state.anchorMap[state.anchor] = state.result;
        }
        break;
      }
    }
  } else if (state.tag !== "!") {
    if (_hasOwnProperty$1.call(state.typeMap[state.kind || "fallback"], state.tag)) {
      type2 = state.typeMap[state.kind || "fallback"][state.tag];
    } else {
      type2 = null;
      typeList = state.typeMap.multi[state.kind || "fallback"];
      for (typeIndex = 0, typeQuantity = typeList.length; typeIndex < typeQuantity; typeIndex += 1) {
        if (state.tag.slice(0, typeList[typeIndex].tag.length) === typeList[typeIndex].tag) {
          type2 = typeList[typeIndex];
          break;
        }
      }
    }
    if (!type2) {
      throwError(state, "unknown tag !<" + state.tag + ">");
    }
    if (state.result !== null && type2.kind !== state.kind) {
      throwError(state, "unacceptable node kind for !<" + state.tag + '> tag; it should be "' + type2.kind + '", not "' + state.kind + '"');
    }
    if (!type2.resolve(state.result, state.tag)) {
      throwError(state, "cannot resolve a node with !<" + state.tag + "> explicit tag");
    } else {
      state.result = type2.construct(state.result, state.tag);
      if (state.anchor !== null) {
        state.anchorMap[state.anchor] = state.result;
      }
    }
  }
  if (state.listener !== null) {
    state.listener("close", state);
  }
  return state.tag !== null || state.anchor !== null || hasContent;
}
function readDocument(state) {
  var documentStart = state.position, _position, directiveName, directiveArgs, hasDirectives = false, ch;
  state.version = null;
  state.checkLineBreaks = state.legacy;
  state.tagMap = /* @__PURE__ */ Object.create(null);
  state.anchorMap = /* @__PURE__ */ Object.create(null);
  while ((ch = state.input.charCodeAt(state.position)) !== 0) {
    skipSeparationSpace(state, true, -1);
    ch = state.input.charCodeAt(state.position);
    if (state.lineIndent > 0 || ch !== 37) {
      break;
    }
    hasDirectives = true;
    ch = state.input.charCodeAt(++state.position);
    _position = state.position;
    while (ch !== 0 && !is_WS_OR_EOL(ch)) {
      ch = state.input.charCodeAt(++state.position);
    }
    directiveName = state.input.slice(_position, state.position);
    directiveArgs = [];
    if (directiveName.length < 1) {
      throwError(state, "directive name must not be less than one character in length");
    }
    while (ch !== 0) {
      while (is_WHITE_SPACE(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }
      if (ch === 35) {
        do {
          ch = state.input.charCodeAt(++state.position);
        } while (ch !== 0 && !is_EOL(ch));
        break;
      }
      if (is_EOL(ch)) break;
      _position = state.position;
      while (ch !== 0 && !is_WS_OR_EOL(ch)) {
        ch = state.input.charCodeAt(++state.position);
      }
      directiveArgs.push(state.input.slice(_position, state.position));
    }
    if (ch !== 0) readLineBreak(state);
    if (_hasOwnProperty$1.call(directiveHandlers, directiveName)) {
      directiveHandlers[directiveName](state, directiveName, directiveArgs);
    } else {
      throwWarning(state, 'unknown document directive "' + directiveName + '"');
    }
  }
  skipSeparationSpace(state, true, -1);
  if (state.lineIndent === 0 && state.input.charCodeAt(state.position) === 45 && state.input.charCodeAt(state.position + 1) === 45 && state.input.charCodeAt(state.position + 2) === 45) {
    state.position += 3;
    skipSeparationSpace(state, true, -1);
  } else if (hasDirectives) {
    throwError(state, "directives end mark is expected");
  }
  composeNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, true);
  skipSeparationSpace(state, true, -1);
  if (state.checkLineBreaks && PATTERN_NON_ASCII_LINE_BREAKS.test(state.input.slice(documentStart, state.position))) {
    throwWarning(state, "non-ASCII line breaks are interpreted as content");
  }
  state.documents.push(state.result);
  if (state.position === state.lineStart && testDocumentSeparator(state)) {
    if (state.input.charCodeAt(state.position) === 46) {
      state.position += 3;
      skipSeparationSpace(state, true, -1);
    }
    return;
  }
  if (state.position < state.length - 1) {
    throwError(state, "end of the stream or a document separator is expected");
  } else {
    return;
  }
}
function loadDocuments(input, options) {
  input = String(input);
  options = options || {};
  if (input.length !== 0) {
    if (input.charCodeAt(input.length - 1) !== 10 && input.charCodeAt(input.length - 1) !== 13) {
      input += "\n";
    }
    if (input.charCodeAt(0) === 65279) {
      input = input.slice(1);
    }
  }
  var state = new State$1(input, options);
  var nullpos = input.indexOf("\0");
  if (nullpos !== -1) {
    state.position = nullpos;
    throwError(state, "null byte is not allowed in input");
  }
  state.input += "\0";
  while (state.input.charCodeAt(state.position) === 32) {
    state.lineIndent += 1;
    state.position += 1;
  }
  while (state.position < state.length - 1) {
    readDocument(state);
  }
  return state.documents;
}
function loadAll$1(input, iterator, options) {
  if (iterator !== null && typeof iterator === "object" && typeof options === "undefined") {
    options = iterator;
    iterator = null;
  }
  var documents = loadDocuments(input, options);
  if (typeof iterator !== "function") {
    return documents;
  }
  for (var index = 0, length = documents.length; index < length; index += 1) {
    iterator(documents[index]);
  }
}
function load$1(input, options) {
  var documents = loadDocuments(input, options);
  if (documents.length === 0) {
    return void 0;
  } else if (documents.length === 1) {
    return documents[0];
  }
  throw new exception("expected a single document in the stream, but found more");
}
var loadAll_1 = loadAll$1;
var load_1 = load$1;
var loader = {
  loadAll: loadAll_1,
  load: load_1
};
var _toString = Object.prototype.toString;
var _hasOwnProperty = Object.prototype.hasOwnProperty;
var CHAR_BOM = 65279;
var CHAR_TAB = 9;
var CHAR_LINE_FEED = 10;
var CHAR_CARRIAGE_RETURN = 13;
var CHAR_SPACE = 32;
var CHAR_EXCLAMATION = 33;
var CHAR_DOUBLE_QUOTE = 34;
var CHAR_SHARP = 35;
var CHAR_PERCENT = 37;
var CHAR_AMPERSAND = 38;
var CHAR_SINGLE_QUOTE = 39;
var CHAR_ASTERISK = 42;
var CHAR_COMMA = 44;
var CHAR_MINUS = 45;
var CHAR_COLON = 58;
var CHAR_EQUALS = 61;
var CHAR_GREATER_THAN = 62;
var CHAR_QUESTION = 63;
var CHAR_COMMERCIAL_AT = 64;
var CHAR_LEFT_SQUARE_BRACKET = 91;
var CHAR_RIGHT_SQUARE_BRACKET = 93;
var CHAR_GRAVE_ACCENT = 96;
var CHAR_LEFT_CURLY_BRACKET = 123;
var CHAR_VERTICAL_LINE = 124;
var CHAR_RIGHT_CURLY_BRACKET = 125;
var ESCAPE_SEQUENCES = {};
ESCAPE_SEQUENCES[0] = "\\0";
ESCAPE_SEQUENCES[7] = "\\a";
ESCAPE_SEQUENCES[8] = "\\b";
ESCAPE_SEQUENCES[9] = "\\t";
ESCAPE_SEQUENCES[10] = "\\n";
ESCAPE_SEQUENCES[11] = "\\v";
ESCAPE_SEQUENCES[12] = "\\f";
ESCAPE_SEQUENCES[13] = "\\r";
ESCAPE_SEQUENCES[27] = "\\e";
ESCAPE_SEQUENCES[34] = '\\"';
ESCAPE_SEQUENCES[92] = "\\\\";
ESCAPE_SEQUENCES[133] = "\\N";
ESCAPE_SEQUENCES[160] = "\\_";
ESCAPE_SEQUENCES[8232] = "\\L";
ESCAPE_SEQUENCES[8233] = "\\P";
var DEPRECATED_BOOLEANS_SYNTAX = [
  "y",
  "Y",
  "yes",
  "Yes",
  "YES",
  "on",
  "On",
  "ON",
  "n",
  "N",
  "no",
  "No",
  "NO",
  "off",
  "Off",
  "OFF"
];
var DEPRECATED_BASE60_SYNTAX = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;
function compileStyleMap(schema2, map2) {
  var result, keys, index, length, tag, style, type2;
  if (map2 === null) return {};
  result = {};
  keys = Object.keys(map2);
  for (index = 0, length = keys.length; index < length; index += 1) {
    tag = keys[index];
    style = String(map2[tag]);
    if (tag.slice(0, 2) === "!!") {
      tag = "tag:yaml.org,2002:" + tag.slice(2);
    }
    type2 = schema2.compiledTypeMap["fallback"][tag];
    if (type2 && _hasOwnProperty.call(type2.styleAliases, style)) {
      style = type2.styleAliases[style];
    }
    result[tag] = style;
  }
  return result;
}
function encodeHex(character) {
  var string, handle, length;
  string = character.toString(16).toUpperCase();
  if (character <= 255) {
    handle = "x";
    length = 2;
  } else if (character <= 65535) {
    handle = "u";
    length = 4;
  } else if (character <= 4294967295) {
    handle = "U";
    length = 8;
  } else {
    throw new exception("code point within a string may not be greater than 0xFFFFFFFF");
  }
  return "\\" + handle + common.repeat("0", length - string.length) + string;
}
var QUOTING_TYPE_SINGLE = 1;
var QUOTING_TYPE_DOUBLE = 2;
function State(options) {
  this.schema = options["schema"] || _default;
  this.indent = Math.max(1, options["indent"] || 2);
  this.noArrayIndent = options["noArrayIndent"] || false;
  this.skipInvalid = options["skipInvalid"] || false;
  this.flowLevel = common.isNothing(options["flowLevel"]) ? -1 : options["flowLevel"];
  this.styleMap = compileStyleMap(this.schema, options["styles"] || null);
  this.sortKeys = options["sortKeys"] || false;
  this.lineWidth = options["lineWidth"] || 80;
  this.noRefs = options["noRefs"] || false;
  this.noCompatMode = options["noCompatMode"] || false;
  this.condenseFlow = options["condenseFlow"] || false;
  this.quotingType = options["quotingType"] === '"' ? QUOTING_TYPE_DOUBLE : QUOTING_TYPE_SINGLE;
  this.forceQuotes = options["forceQuotes"] || false;
  this.replacer = typeof options["replacer"] === "function" ? options["replacer"] : null;
  this.implicitTypes = this.schema.compiledImplicit;
  this.explicitTypes = this.schema.compiledExplicit;
  this.tag = null;
  this.result = "";
  this.duplicates = [];
  this.usedDuplicates = null;
}
function indentString(string, spaces) {
  var ind = common.repeat(" ", spaces), position = 0, next = -1, result = "", line, length = string.length;
  while (position < length) {
    next = string.indexOf("\n", position);
    if (next === -1) {
      line = string.slice(position);
      position = length;
    } else {
      line = string.slice(position, next + 1);
      position = next + 1;
    }
    if (line.length && line !== "\n") result += ind;
    result += line;
  }
  return result;
}
function generateNextLine(state, level) {
  return "\n" + common.repeat(" ", state.indent * level);
}
function testImplicitResolving(state, str2) {
  var index, length, type2;
  for (index = 0, length = state.implicitTypes.length; index < length; index += 1) {
    type2 = state.implicitTypes[index];
    if (type2.resolve(str2)) {
      return true;
    }
  }
  return false;
}
function isWhitespace(c) {
  return c === CHAR_SPACE || c === CHAR_TAB;
}
function isPrintable(c) {
  return 32 <= c && c <= 126 || 161 <= c && c <= 55295 && c !== 8232 && c !== 8233 || 57344 <= c && c <= 65533 && c !== CHAR_BOM || 65536 <= c && c <= 1114111;
}
function isNsCharOrWhitespace(c) {
  return isPrintable(c) && c !== CHAR_BOM && c !== CHAR_CARRIAGE_RETURN && c !== CHAR_LINE_FEED;
}
function isPlainSafe(c, prev, inblock) {
  var cIsNsCharOrWhitespace = isNsCharOrWhitespace(c);
  var cIsNsChar = cIsNsCharOrWhitespace && !isWhitespace(c);
  return (
    // ns-plain-safe
    (inblock ? (
      // c = flow-in
      cIsNsCharOrWhitespace
    ) : cIsNsCharOrWhitespace && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET) && c !== CHAR_SHARP && !(prev === CHAR_COLON && !cIsNsChar) || isNsCharOrWhitespace(prev) && !isWhitespace(prev) && c === CHAR_SHARP || prev === CHAR_COLON && cIsNsChar
  );
}
function isPlainSafeFirst(c) {
  return isPrintable(c) && c !== CHAR_BOM && !isWhitespace(c) && c !== CHAR_MINUS && c !== CHAR_QUESTION && c !== CHAR_COLON && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET && c !== CHAR_SHARP && c !== CHAR_AMPERSAND && c !== CHAR_ASTERISK && c !== CHAR_EXCLAMATION && c !== CHAR_VERTICAL_LINE && c !== CHAR_EQUALS && c !== CHAR_GREATER_THAN && c !== CHAR_SINGLE_QUOTE && c !== CHAR_DOUBLE_QUOTE && c !== CHAR_PERCENT && c !== CHAR_COMMERCIAL_AT && c !== CHAR_GRAVE_ACCENT;
}
function isPlainSafeLast(c) {
  return !isWhitespace(c) && c !== CHAR_COLON;
}
function codePointAt(string, pos) {
  var first = string.charCodeAt(pos), second;
  if (first >= 55296 && first <= 56319 && pos + 1 < string.length) {
    second = string.charCodeAt(pos + 1);
    if (second >= 56320 && second <= 57343) {
      return (first - 55296) * 1024 + second - 56320 + 65536;
    }
  }
  return first;
}
function needIndentIndicator(string) {
  var leadingSpaceRe = /^\n* /;
  return leadingSpaceRe.test(string);
}
var STYLE_PLAIN = 1;
var STYLE_SINGLE = 2;
var STYLE_LITERAL = 3;
var STYLE_FOLDED = 4;
var STYLE_DOUBLE = 5;
function chooseScalarStyle(string, singleLineOnly, indentPerLevel, lineWidth, testAmbiguousType, quotingType, forceQuotes, inblock) {
  var i;
  var char = 0;
  var prevChar = null;
  var hasLineBreak = false;
  var hasFoldableLine = false;
  var shouldTrackWidth = lineWidth !== -1;
  var previousLineBreak = -1;
  var plain = isPlainSafeFirst(codePointAt(string, 0)) && isPlainSafeLast(codePointAt(string, string.length - 1));
  if (singleLineOnly || forceQuotes) {
    for (i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
      char = codePointAt(string, i);
      if (!isPrintable(char)) {
        return STYLE_DOUBLE;
      }
      plain = plain && isPlainSafe(char, prevChar, inblock);
      prevChar = char;
    }
  } else {
    for (i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
      char = codePointAt(string, i);
      if (char === CHAR_LINE_FEED) {
        hasLineBreak = true;
        if (shouldTrackWidth) {
          hasFoldableLine = hasFoldableLine || // Foldable line = too long, and not more-indented.
          i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ";
          previousLineBreak = i;
        }
      } else if (!isPrintable(char)) {
        return STYLE_DOUBLE;
      }
      plain = plain && isPlainSafe(char, prevChar, inblock);
      prevChar = char;
    }
    hasFoldableLine = hasFoldableLine || shouldTrackWidth && (i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ");
  }
  if (!hasLineBreak && !hasFoldableLine) {
    if (plain && !forceQuotes && !testAmbiguousType(string)) {
      return STYLE_PLAIN;
    }
    return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
  }
  if (indentPerLevel > 9 && needIndentIndicator(string)) {
    return STYLE_DOUBLE;
  }
  if (!forceQuotes) {
    return hasFoldableLine ? STYLE_FOLDED : STYLE_LITERAL;
  }
  return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
}
function writeScalar(state, string, level, iskey, inblock) {
  state.dump = (function() {
    if (string.length === 0) {
      return state.quotingType === QUOTING_TYPE_DOUBLE ? '""' : "''";
    }
    if (!state.noCompatMode) {
      if (DEPRECATED_BOOLEANS_SYNTAX.indexOf(string) !== -1 || DEPRECATED_BASE60_SYNTAX.test(string)) {
        return state.quotingType === QUOTING_TYPE_DOUBLE ? '"' + string + '"' : "'" + string + "'";
      }
    }
    var indent = state.indent * Math.max(1, level);
    var lineWidth = state.lineWidth === -1 ? -1 : Math.max(Math.min(state.lineWidth, 40), state.lineWidth - indent);
    var singleLineOnly = iskey || state.flowLevel > -1 && level >= state.flowLevel;
    function testAmbiguity(string2) {
      return testImplicitResolving(state, string2);
    }
    switch (chooseScalarStyle(
      string,
      singleLineOnly,
      state.indent,
      lineWidth,
      testAmbiguity,
      state.quotingType,
      state.forceQuotes && !iskey,
      inblock
    )) {
      case STYLE_PLAIN:
        return string;
      case STYLE_SINGLE:
        return "'" + string.replace(/'/g, "''") + "'";
      case STYLE_LITERAL:
        return "|" + blockHeader(string, state.indent) + dropEndingNewline(indentString(string, indent));
      case STYLE_FOLDED:
        return ">" + blockHeader(string, state.indent) + dropEndingNewline(indentString(foldString(string, lineWidth), indent));
      case STYLE_DOUBLE:
        return '"' + escapeString(string) + '"';
      default:
        throw new exception("impossible error: invalid scalar style");
    }
  })();
}
function blockHeader(string, indentPerLevel) {
  var indentIndicator = needIndentIndicator(string) ? String(indentPerLevel) : "";
  var clip = string[string.length - 1] === "\n";
  var keep = clip && (string[string.length - 2] === "\n" || string === "\n");
  var chomp = keep ? "+" : clip ? "" : "-";
  return indentIndicator + chomp + "\n";
}
function dropEndingNewline(string) {
  return string[string.length - 1] === "\n" ? string.slice(0, -1) : string;
}
function foldString(string, width) {
  var lineRe = /(\n+)([^\n]*)/g;
  var result = (function() {
    var nextLF = string.indexOf("\n");
    nextLF = nextLF !== -1 ? nextLF : string.length;
    lineRe.lastIndex = nextLF;
    return foldLine(string.slice(0, nextLF), width);
  })();
  var prevMoreIndented = string[0] === "\n" || string[0] === " ";
  var moreIndented;
  var match;
  while (match = lineRe.exec(string)) {
    var prefix = match[1], line = match[2];
    moreIndented = line[0] === " ";
    result += prefix + (!prevMoreIndented && !moreIndented && line !== "" ? "\n" : "") + foldLine(line, width);
    prevMoreIndented = moreIndented;
  }
  return result;
}
function foldLine(line, width) {
  if (line === "" || line[0] === " ") return line;
  var breakRe = / [^ ]/g;
  var match;
  var start = 0, end, curr = 0, next = 0;
  var result = "";
  while (match = breakRe.exec(line)) {
    next = match.index;
    if (next - start > width) {
      end = curr > start ? curr : next;
      result += "\n" + line.slice(start, end);
      start = end + 1;
    }
    curr = next;
  }
  result += "\n";
  if (line.length - start > width && curr > start) {
    result += line.slice(start, curr) + "\n" + line.slice(curr + 1);
  } else {
    result += line.slice(start);
  }
  return result.slice(1);
}
function escapeString(string) {
  var result = "";
  var char = 0;
  var escapeSeq;
  for (var i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
    char = codePointAt(string, i);
    escapeSeq = ESCAPE_SEQUENCES[char];
    if (!escapeSeq && isPrintable(char)) {
      result += string[i];
      if (char >= 65536) result += string[i + 1];
    } else {
      result += escapeSeq || encodeHex(char);
    }
  }
  return result;
}
function writeFlowSequence(state, level, object) {
  var _result = "", _tag = state.tag, index, length, value;
  for (index = 0, length = object.length; index < length; index += 1) {
    value = object[index];
    if (state.replacer) {
      value = state.replacer.call(object, String(index), value);
    }
    if (writeNode(state, level, value, false, false) || typeof value === "undefined" && writeNode(state, level, null, false, false)) {
      if (_result !== "") _result += "," + (!state.condenseFlow ? " " : "");
      _result += state.dump;
    }
  }
  state.tag = _tag;
  state.dump = "[" + _result + "]";
}
function writeBlockSequence(state, level, object, compact) {
  var _result = "", _tag = state.tag, index, length, value;
  for (index = 0, length = object.length; index < length; index += 1) {
    value = object[index];
    if (state.replacer) {
      value = state.replacer.call(object, String(index), value);
    }
    if (writeNode(state, level + 1, value, true, true, false, true) || typeof value === "undefined" && writeNode(state, level + 1, null, true, true, false, true)) {
      if (!compact || _result !== "") {
        _result += generateNextLine(state, level);
      }
      if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
        _result += "-";
      } else {
        _result += "- ";
      }
      _result += state.dump;
    }
  }
  state.tag = _tag;
  state.dump = _result || "[]";
}
function writeFlowMapping(state, level, object) {
  var _result = "", _tag = state.tag, objectKeyList = Object.keys(object), index, length, objectKey, objectValue, pairBuffer;
  for (index = 0, length = objectKeyList.length; index < length; index += 1) {
    pairBuffer = "";
    if (_result !== "") pairBuffer += ", ";
    if (state.condenseFlow) pairBuffer += '"';
    objectKey = objectKeyList[index];
    objectValue = object[objectKey];
    if (state.replacer) {
      objectValue = state.replacer.call(object, objectKey, objectValue);
    }
    if (!writeNode(state, level, objectKey, false, false)) {
      continue;
    }
    if (state.dump.length > 1024) pairBuffer += "? ";
    pairBuffer += state.dump + (state.condenseFlow ? '"' : "") + ":" + (state.condenseFlow ? "" : " ");
    if (!writeNode(state, level, objectValue, false, false)) {
      continue;
    }
    pairBuffer += state.dump;
    _result += pairBuffer;
  }
  state.tag = _tag;
  state.dump = "{" + _result + "}";
}
function writeBlockMapping(state, level, object, compact) {
  var _result = "", _tag = state.tag, objectKeyList = Object.keys(object), index, length, objectKey, objectValue, explicitPair, pairBuffer;
  if (state.sortKeys === true) {
    objectKeyList.sort();
  } else if (typeof state.sortKeys === "function") {
    objectKeyList.sort(state.sortKeys);
  } else if (state.sortKeys) {
    throw new exception("sortKeys must be a boolean or a function");
  }
  for (index = 0, length = objectKeyList.length; index < length; index += 1) {
    pairBuffer = "";
    if (!compact || _result !== "") {
      pairBuffer += generateNextLine(state, level);
    }
    objectKey = objectKeyList[index];
    objectValue = object[objectKey];
    if (state.replacer) {
      objectValue = state.replacer.call(object, objectKey, objectValue);
    }
    if (!writeNode(state, level + 1, objectKey, true, true, true)) {
      continue;
    }
    explicitPair = state.tag !== null && state.tag !== "?" || state.dump && state.dump.length > 1024;
    if (explicitPair) {
      if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
        pairBuffer += "?";
      } else {
        pairBuffer += "? ";
      }
    }
    pairBuffer += state.dump;
    if (explicitPair) {
      pairBuffer += generateNextLine(state, level);
    }
    if (!writeNode(state, level + 1, objectValue, true, explicitPair)) {
      continue;
    }
    if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) {
      pairBuffer += ":";
    } else {
      pairBuffer += ": ";
    }
    pairBuffer += state.dump;
    _result += pairBuffer;
  }
  state.tag = _tag;
  state.dump = _result || "{}";
}
function detectType(state, object, explicit) {
  var _result, typeList, index, length, type2, style;
  typeList = explicit ? state.explicitTypes : state.implicitTypes;
  for (index = 0, length = typeList.length; index < length; index += 1) {
    type2 = typeList[index];
    if ((type2.instanceOf || type2.predicate) && (!type2.instanceOf || typeof object === "object" && object instanceof type2.instanceOf) && (!type2.predicate || type2.predicate(object))) {
      if (explicit) {
        if (type2.multi && type2.representName) {
          state.tag = type2.representName(object);
        } else {
          state.tag = type2.tag;
        }
      } else {
        state.tag = "?";
      }
      if (type2.represent) {
        style = state.styleMap[type2.tag] || type2.defaultStyle;
        if (_toString.call(type2.represent) === "[object Function]") {
          _result = type2.represent(object, style);
        } else if (_hasOwnProperty.call(type2.represent, style)) {
          _result = type2.represent[style](object, style);
        } else {
          throw new exception("!<" + type2.tag + '> tag resolver accepts not "' + style + '" style');
        }
        state.dump = _result;
      }
      return true;
    }
  }
  return false;
}
function writeNode(state, level, object, block, compact, iskey, isblockseq) {
  state.tag = null;
  state.dump = object;
  if (!detectType(state, object, false)) {
    detectType(state, object, true);
  }
  var type2 = _toString.call(state.dump);
  var inblock = block;
  var tagStr;
  if (block) {
    block = state.flowLevel < 0 || state.flowLevel > level;
  }
  var objectOrArray = type2 === "[object Object]" || type2 === "[object Array]", duplicateIndex, duplicate;
  if (objectOrArray) {
    duplicateIndex = state.duplicates.indexOf(object);
    duplicate = duplicateIndex !== -1;
  }
  if (state.tag !== null && state.tag !== "?" || duplicate || state.indent !== 2 && level > 0) {
    compact = false;
  }
  if (duplicate && state.usedDuplicates[duplicateIndex]) {
    state.dump = "*ref_" + duplicateIndex;
  } else {
    if (objectOrArray && duplicate && !state.usedDuplicates[duplicateIndex]) {
      state.usedDuplicates[duplicateIndex] = true;
    }
    if (type2 === "[object Object]") {
      if (block && Object.keys(state.dump).length !== 0) {
        writeBlockMapping(state, level, state.dump, compact);
        if (duplicate) {
          state.dump = "&ref_" + duplicateIndex + state.dump;
        }
      } else {
        writeFlowMapping(state, level, state.dump);
        if (duplicate) {
          state.dump = "&ref_" + duplicateIndex + " " + state.dump;
        }
      }
    } else if (type2 === "[object Array]") {
      if (block && state.dump.length !== 0) {
        if (state.noArrayIndent && !isblockseq && level > 0) {
          writeBlockSequence(state, level - 1, state.dump, compact);
        } else {
          writeBlockSequence(state, level, state.dump, compact);
        }
        if (duplicate) {
          state.dump = "&ref_" + duplicateIndex + state.dump;
        }
      } else {
        writeFlowSequence(state, level, state.dump);
        if (duplicate) {
          state.dump = "&ref_" + duplicateIndex + " " + state.dump;
        }
      }
    } else if (type2 === "[object String]") {
      if (state.tag !== "?") {
        writeScalar(state, state.dump, level, iskey, inblock);
      }
    } else if (type2 === "[object Undefined]") {
      return false;
    } else {
      if (state.skipInvalid) return false;
      throw new exception("unacceptable kind of an object to dump " + type2);
    }
    if (state.tag !== null && state.tag !== "?") {
      tagStr = encodeURI(
        state.tag[0] === "!" ? state.tag.slice(1) : state.tag
      ).replace(/!/g, "%21");
      if (state.tag[0] === "!") {
        tagStr = "!" + tagStr;
      } else if (tagStr.slice(0, 18) === "tag:yaml.org,2002:") {
        tagStr = "!!" + tagStr.slice(18);
      } else {
        tagStr = "!<" + tagStr + ">";
      }
      state.dump = tagStr + " " + state.dump;
    }
  }
  return true;
}
function getDuplicateReferences(object, state) {
  var objects = [], duplicatesIndexes = [], index, length;
  inspectNode(object, objects, duplicatesIndexes);
  for (index = 0, length = duplicatesIndexes.length; index < length; index += 1) {
    state.duplicates.push(objects[duplicatesIndexes[index]]);
  }
  state.usedDuplicates = new Array(length);
}
function inspectNode(object, objects, duplicatesIndexes) {
  var objectKeyList, index, length;
  if (object !== null && typeof object === "object") {
    index = objects.indexOf(object);
    if (index !== -1) {
      if (duplicatesIndexes.indexOf(index) === -1) {
        duplicatesIndexes.push(index);
      }
    } else {
      objects.push(object);
      if (Array.isArray(object)) {
        for (index = 0, length = object.length; index < length; index += 1) {
          inspectNode(object[index], objects, duplicatesIndexes);
        }
      } else {
        objectKeyList = Object.keys(object);
        for (index = 0, length = objectKeyList.length; index < length; index += 1) {
          inspectNode(object[objectKeyList[index]], objects, duplicatesIndexes);
        }
      }
    }
  }
}
function dump$1(input, options) {
  options = options || {};
  var state = new State(options);
  if (!state.noRefs) getDuplicateReferences(input, state);
  var value = input;
  if (state.replacer) {
    value = state.replacer.call({ "": value }, "", value);
  }
  if (writeNode(state, 0, value, true, true)) return state.dump + "\n";
  return "";
}
var dump_1 = dump$1;
var dumper = {
  dump: dump_1
};
function renamed(from, to) {
  return function() {
    throw new Error("Function yaml." + from + " is removed in js-yaml 4. Use yaml." + to + " instead, which is now safe by default.");
  };
}
var Type = type;
var Schema = schema;
var FAILSAFE_SCHEMA = failsafe;
var JSON_SCHEMA = json;
var CORE_SCHEMA = core;
var DEFAULT_SCHEMA = _default;
var load = loader.load;
var loadAll = loader.loadAll;
var dump = dumper.dump;
var YAMLException = exception;
var types = {
  binary,
  float,
  map,
  null: _null,
  pairs,
  set,
  timestamp,
  bool,
  int,
  merge,
  omap,
  seq,
  str
};
var safeLoad = renamed("safeLoad", "load");
var safeLoadAll = renamed("safeLoadAll", "loadAll");
var safeDump = renamed("safeDump", "dump");
var jsYaml = {
  Type,
  Schema,
  FAILSAFE_SCHEMA,
  JSON_SCHEMA,
  CORE_SCHEMA,
  DEFAULT_SCHEMA,
  load,
  loadAll,
  dump,
  YAMLException,
  types,
  safeLoad,
  safeLoadAll,
  safeDump
};

// node_modules/uuid/dist-node/stringify.js
var byteToHex = [];
for (let i = 0; i < 256; ++i) {
  byteToHex.push((i + 256).toString(16).slice(1));
}
function unsafeStringify(arr, offset = 0) {
  return (byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + "-" + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + "-" + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + "-" + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + "-" + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]]).toLowerCase();
}

// node_modules/uuid/dist-node/rng.js
var import_node_crypto = require("node:crypto");
var rnds8Pool = new Uint8Array(256);
var poolPtr = rnds8Pool.length;
function rng() {
  if (poolPtr > rnds8Pool.length - 16) {
    (0, import_node_crypto.randomFillSync)(rnds8Pool);
    poolPtr = 0;
  }
  return rnds8Pool.slice(poolPtr, poolPtr += 16);
}

// node_modules/uuid/dist-node/native.js
var import_node_crypto2 = require("node:crypto");
var native_default = { randomUUID: import_node_crypto2.randomUUID };

// node_modules/uuid/dist-node/v4.js
function _v4(options, buf, offset) {
  options = options || {};
  const rnds = options.random ?? options.rng?.() ?? rng();
  if (rnds.length < 16) {
    throw new Error("Random bytes length must be >= 16");
  }
  rnds[6] = rnds[6] & 15 | 64;
  rnds[8] = rnds[8] & 63 | 128;
  if (buf) {
    offset = offset || 0;
    if (offset < 0 || offset + 16 > buf.length) {
      throw new RangeError(`UUID byte range ${offset}:${offset + 15} is out of buffer bounds`);
    }
    for (let i = 0; i < 16; ++i) {
      buf[offset + i] = rnds[i];
    }
    return buf;
  }
  return unsafeStringify(rnds);
}
function v4(options, buf, offset) {
  if (native_default.randomUUID && !buf && !options) {
    return native_default.randomUUID();
  }
  return _v4(options, buf, offset);
}
var v4_default = v4;

// src/services/lego_blocks/units/yamlNoteBlock.ts
var NODE_TYPES = [
  "program",
  "epic",
  "idea_bucket",
  "idea",
  "thought_bucket",
  "thought",
  "task",
  "run",
  "handoff"
];
var NODE_STATUSES = [
  "active",
  "paused",
  "incomplete",
  "taken",
  "planned",
  "watchlist",
  "completed",
  "cancelled",
  "archived"
];
var NODE_TYPE_LEVEL = {
  program: 0,
  epic: 1,
  idea_bucket: 2,
  idea: 3,
  thought_bucket: 4,
  thought: 5,
  task: 5,
  run: 5,
  handoff: 5
};
var ALLOWED_RECORD_KINDS = [
  ...NODE_TYPES,
  "run",
  "handoff",
  "decision",
  "principle",
  "note"
];
var FM_OPEN = "---";
var FM_CLOSE_RE = /^---\s*$/m;
function parseNote(content) {
  const trimmed = content.trimStart();
  if (!trimmed.startsWith(FM_OPEN)) return null;
  const afterOpen = trimmed.indexOf("\n");
  if (afterOpen === -1) return null;
  const rest = trimmed.slice(afterOpen + 1);
  const closeMatch = FM_CLOSE_RE.exec(rest);
  if (!closeMatch) return null;
  const yamlStr = rest.slice(0, closeMatch.index);
  const body = rest.slice(closeMatch.index + closeMatch[0].length).replace(/^\n/, "");
  let parsed;
  try {
    parsed = jsYaml.load(yamlStr);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const frontmatter = normalizeFrontmatter(parsed);
  return { frontmatter, body };
}
function stringifyNote(note) {
  const clean = {};
  for (const [k, v] of Object.entries(note.frontmatter)) {
    if (v !== void 0 && v !== null) {
      clean[k] = v;
    }
  }
  const yamlStr = jsYaml.dump(clean, {
    lineWidth: -1,
    // don't wrap lines
    noRefs: true,
    // no YAML anchors
    sortKeys: false,
    // preserve insertion order
    quotingType: '"'
    // use double quotes
  }).trimEnd();
  const parts = [FM_OPEN, yamlStr, FM_OPEN];
  if (note.body) {
    parts.push("");
    parts.push(note.body);
  } else {
    parts.push("");
  }
  return parts.join("\n");
}
function generateKey(title) {
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}
function createNote(params) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const frontmatter = {
    uuid: v4_default(),
    key: generateKey(params.title),
    title: params.title,
    type: params.type,
    level: NODE_TYPE_LEVEL[params.type],
    status: "active",
    created_at: now,
    updated_at: now
  };
  if (params.parent) frontmatter.parent = params.parent;
  if (params.parent_uuid) frontmatter.parent_uuid = params.parent_uuid;
  if (params.parent_type) frontmatter.parent_type = params.parent_type;
  if (params.tags && params.tags.length > 0) frontmatter.tags = params.tags;
  return {
    frontmatter,
    body: params.body ?? ""
  };
}
function suggestFilename(frontmatter) {
  return `${frontmatter.type}-${frontmatter.key}.md`;
}
function hasFrontmatter(content) {
  return content.trimStart().startsWith(FM_OPEN);
}
function normalizeFrontmatter(raw) {
  const rest = { ...raw };
  delete rest.children;
  delete rest.child_types;
  const type2 = normalizeNodeType(raw.type);
  return {
    ...rest,
    uuid: String(raw.uuid || ""),
    key: String(raw.key || ""),
    title: String(raw.title || ""),
    type: type2,
    level: typeof raw.level === "number" ? raw.level : NODE_TYPE_LEVEL[type2] ?? 5,
    status: normalizeNodeStatus(raw.status),
    created_at: String(raw.created_at || (/* @__PURE__ */ new Date()).toISOString()),
    updated_at: String(raw.updated_at || (/* @__PURE__ */ new Date()).toISOString()),
    parent: raw.parent != null ? String(raw.parent) : void 0,
    parent_uuid: raw.parent_uuid != null ? String(raw.parent_uuid) : void 0,
    parent_type: normalizeOptionalNodeType(raw.parent_type),
    tags: Array.isArray(raw.tags) ? raw.tags.map(String) : void 0,
    project_preset_tags: Array.isArray(raw.project_preset_tags) ? raw.project_preset_tags.map(String) : void 0,
    categories: Array.isArray(raw.categories) ? raw.categories.map(String) : void 0,
    progress: typeof raw.progress === "number" ? raw.progress : void 0,
    priority: raw.priority,
    ai_summary: raw.ai_summary != null ? String(raw.ai_summary) : void 0,
    ai_generated: typeof raw.ai_generated === "boolean" ? raw.ai_generated : void 0,
    last_ai_update: raw.last_ai_update != null ? String(raw.last_ai_update) : void 0,
    ai_suggestions: raw.ai_suggestions,
    excalidraw: raw.excalidraw != null ? String(raw.excalidraw) : void 0,
    project_root: raw.project_root != null ? String(raw.project_root) : void 0,
    ticket: raw.ticket != null ? String(raw.ticket) : void 0,
    description: raw.description != null ? String(raw.description) : void 0,
    comments: normalizeComments(raw.comments),
    epic_completed_at: raw.epic_completed_at != null ? String(raw.epic_completed_at) : void 0,
    sort_order: normalizeSortOrder(raw.sort_order),
    task_id: raw.task_id != null ? String(raw.task_id) : void 0,
    task_status: raw.task_status != null ? String(raw.task_status) : void 0,
    depends_on: normalizeStringArray(raw.depends_on),
    blocked_by: normalizeStringArray(raw.blocked_by),
    acceptance_criteria: normalizeStringArray(raw.acceptance_criteria),
    owner: raw.owner != null ? String(raw.owner) : void 0,
    run_id: raw.run_id != null ? String(raw.run_id) : void 0,
    session_id: raw.session_id != null ? String(raw.session_id) : void 0,
    agent_name: raw.agent_name != null ? String(raw.agent_name) : void 0,
    model: raw.model != null ? String(raw.model) : void 0,
    started_at: raw.started_at != null ? String(raw.started_at) : void 0,
    ended_at: raw.ended_at != null ? String(raw.ended_at) : void 0,
    result: raw.result != null ? String(raw.result) : void 0,
    source_repo: raw.source_repo != null ? String(raw.source_repo) : void 0,
    branch: raw.branch != null ? String(raw.branch) : void 0,
    commit: raw.commit != null ? String(raw.commit) : void 0,
    artifacts: normalizeStringArray(raw.artifacts),
    related_nodes: normalizeStringArray(raw.related_nodes),
    schema_version: raw.schema_version != null ? String(raw.schema_version) : void 0,
    record_kind: normalizeRecordKind(raw.record_kind),
    state_history: normalizeStateHistory(raw.state_history)
  };
}
function normalizeNodeType(raw) {
  if (typeof raw !== "string") return "thought";
  const normalized = raw.trim();
  if (!normalized) return "thought";
  if (NODE_TYPES.includes(normalized)) return normalized;
  return "thought";
}
function normalizeNodeStatus(raw) {
  if (typeof raw !== "string") return "active";
  const normalized = raw.trim().toLowerCase();
  if (!normalized) return "active";
  if (NODE_STATUSES.includes(normalized)) return normalized;
  return "active";
}
function normalizeOptionalNodeType(raw) {
  if (typeof raw !== "string") return void 0;
  const normalized = raw.trim();
  if (!normalized) return void 0;
  if (NODE_TYPES.includes(normalized)) return normalized;
  return void 0;
}
function normalizeComments(raw) {
  if (!Array.isArray(raw)) return void 0;
  const comments = raw.map(normalizeComment).filter((comment) => comment !== null);
  return comments.length > 0 ? comments : void 0;
}
function normalizeComment(value) {
  if (typeof value === "string") {
    const text2 = value.trim();
    if (!text2) return null;
    return { text: text2 };
  }
  if (!value || typeof value !== "object") return null;
  const record = value;
  const rawText = typeof record.text === "string" ? record.text : typeof record.comment === "string" ? record.comment : "";
  const text = rawText.trim();
  if (!text) return null;
  return {
    text,
    added_at: typeof record.added_at === "string" ? record.added_at : void 0,
    added_by: typeof record.added_by === "string" ? record.added_by : void 0
  };
}
function normalizeStringArray(raw) {
  if (!Array.isArray(raw)) return void 0;
  const values = raw.map((value) => String(value).trim()).filter(Boolean);
  return values.length > 0 ? values : void 0;
}
function normalizeSortOrder(raw) {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const parsed = Number(raw.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return void 0;
}
function normalizeStateHistory(raw) {
  if (!Array.isArray(raw)) return void 0;
  const values = raw.map(normalizeStateHistoryEntry).filter((entry) => entry !== null);
  return values.length > 0 ? values : void 0;
}
function normalizeStateHistoryEntry(value) {
  if (!value || typeof value !== "object") return null;
  const record = value;
  const at = typeof record.at === "string" && record.at.trim() ? record.at.trim() : "";
  if (!at) return null;
  return {
    ...record,
    at,
    by: typeof record.by === "string" ? record.by : void 0,
    from: typeof record.from === "string" ? record.from : void 0,
    to: typeof record.to === "string" ? record.to : void 0,
    note: typeof record.note === "string" ? record.note : void 0
  };
}
function normalizeRecordKind(raw) {
  if (typeof raw !== "string") return void 0;
  const normalized = raw.trim();
  if (!normalized) return void 0;
  if (ALLOWED_RECORD_KINDS.includes(normalized)) return normalized;
  return void 0;
}

// src/services/lego_blocks/integrations/statusPolicyBlock.ts
var TASK_STATUS_ALIASES = {
  inprogress: "in_progress",
  in_progress: "in_progress",
  doing: "in_progress",
  underway: "in_progress",
  open: "ready",
  todo: "ready",
  to_do: "ready",
  pending: "ready",
  backlog: "ready",
  blocked: "blocked",
  stuck: "blocked",
  waiting: "blocked",
  on_hold: "blocked",
  paused: "blocked",
  done: "done",
  complete: "done",
  completed: "done",
  closed: "done",
  resolved: "done",
  shipped: "done",
  archived: "cancelled",
  canceled: "cancelled",
  cancelled: "cancelled",
  dropped: "cancelled"
};
var TERMINAL_DONE = /* @__PURE__ */ new Set(["done"]);
var TERMINAL_ARCHIVED = /* @__PURE__ */ new Set(["cancelled"]);
var NON_TERMINAL_ACTIVE = /* @__PURE__ */ new Set(["ready", "in_progress", "blocked"]);
function normalizeTaskStatus(taskStatus) {
  if (!taskStatus) return void 0;
  const canonical = taskStatus.trim().toLowerCase().replace(/\s+/g, "_");
  if (!canonical) return void 0;
  return TASK_STATUS_ALIASES[canonical] ?? canonical;
}
function isTaskLikeNode(node) {
  return node.type === "task" || node.recordKind === "task" || !!normalizeTaskStatus(node.taskStatus);
}
function nodeStatusFromTaskStatus(taskStatus) {
  const normalized = normalizeTaskStatus(taskStatus);
  if (!normalized) return "active";
  if (TERMINAL_ARCHIVED.has(normalized)) return "cancelled";
  if (TERMINAL_DONE.has(normalized)) return "completed";
  if (normalized === "blocked") return "paused";
  return "active";
}
function taskStatusFromNodeStatus(status) {
  if (status === "completed") return "done";
  if (status === "archived" || status === "cancelled") return "cancelled";
  if (status === "taken") return "in_progress";
  if (status === "planned") return "ready";
  if (status === "watchlist") return "blocked";
  if (status === "incomplete") return "ready";
  if (status === "paused") return "blocked";
  return "in_progress";
}
function deriveEpicStatusFromTaskStatuses(taskStatuses) {
  const normalized = taskStatuses.map((status) => normalizeTaskStatus(status)).filter((value) => !!value);
  if (normalized.length === 0) return null;
  const hasNonTerminal = normalized.some((status) => NON_TERMINAL_ACTIVE.has(status));
  if (hasNonTerminal) return "active";
  const allArchived = normalized.every((status) => TERMINAL_ARCHIVED.has(status));
  if (allArchived) return "cancelled";
  return "completed";
}

// src/services/lego_blocks/integrations/capabilityAuditLogBlock.ts
var THINKING_SPACE_DIR = ".thinking-space";
var LEGACY_THINK_SPACE_DIR = ".think-space";
var AUDIT_DIR = `${THINKING_SPACE_DIR}/audit`;
var AUDIT_FILE = `${AUDIT_DIR}/capability-audit.log`;
var LEGACY_AUDIT_FILE = `${LEGACY_THINK_SPACE_DIR}/audit/capability-audit.log`;
async function writeCapabilityAuditEntry(entry, fs) {
  if (!fs) return;
  await ensureAuditDir(fs);
  await migrateLegacyAuditLogIfNeeded(fs);
  const line = JSON.stringify(entry);
  const exists = await fs.exists(AUDIT_FILE);
  if (!exists) {
    await fs.create(AUDIT_FILE, `${line}
`);
    return;
  }
  await fs.process(AUDIT_FILE, (current) => {
    const needsBreak = current.length > 0 && !current.endsWith("\n");
    return `${current}${needsBreak ? "\n" : ""}${line}
`;
  });
}
function createCapabilityInputHash(value) {
  const stable = stableStringify(value);
  return hashString(stable);
}
function stableStringify(value) {
  if (value === null || value === void 0) return "null";
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }
  const record = value;
  const keys = Object.keys(record).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`).join(",")}}`;
}
function hashString(value) {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash << 5) + hash ^ value.charCodeAt(i);
  }
  return `h${(hash >>> 0).toString(16)}`;
}
async function ensureAuditDir(fs) {
  try {
    await fs.mkdir(THINKING_SPACE_DIR);
  } catch {
  }
  try {
    await fs.mkdir(AUDIT_DIR);
  } catch {
  }
}
async function migrateLegacyAuditLogIfNeeded(fs) {
  const hasCurrent = await fs.exists(AUDIT_FILE).catch(() => false);
  if (hasCurrent) return;
  const hasLegacy = await fs.exists(LEGACY_AUDIT_FILE).catch(() => false);
  if (!hasLegacy) return;
  const legacyContent = await fs.read(LEGACY_AUDIT_FILE).catch(() => "");
  await fs.create(AUDIT_FILE, legacyContent);
}

// src/services/lego_blocks/integrations/capabilityPolicyBlock.ts
var MAX_INPUT_BYTES = 64e3;
var DESTRUCTIVE_CAPABILITIES = /* @__PURE__ */ new Set([
  "organizer.node.delete"
]);
var WRITE_CAPABILITIES = /* @__PURE__ */ new Set([
  "write_note",
  "patch_note_frontmatter",
  "create_ai_synthesis_note",
  "update_ai_synthesis_compile_state",
  "organizer.node.create",
  "organizer.node.rename",
  "organizer.node.update",
  "organizer.node.move",
  "organizer.node.delete",
  "task.claim",
  "task.update_status",
  "run.log",
  "handoff.create",
  "comment.add",
  "thoughts.create",
  "todos.create",
  "todos.toggle",
  "tools.excalidraw.format",
  "tools.pdf.convert",
  "tools.transcript.clean_save"
]);
var STORAGE_KEY = "ltm-capability-policy";
function validateCapabilityPolicy(params) {
  const policy = getCapabilityPolicy();
  const inputSize = encodeUtf8Size(JSON.stringify(params.input ?? {}));
  if (inputSize > policy.maxInputBytes) {
    throw new Error(`Capability input exceeds max payload size (${policy.maxInputBytes} bytes).`);
  }
  if (params.actor.kind === "agent") {
    if (!policy.allowAgentWrites && WRITE_CAPABILITIES.has(params.capability)) {
      throw new Error(`Agent writes are blocked by policy for capability: ${params.capability}`);
    }
    if (!policy.allowAgentDestructive && DESTRUCTIVE_CAPABILITIES.has(params.capability)) {
      throw new Error(`Agent destructive action is blocked by policy for capability: ${params.capability}`);
    }
  }
  const input = params.input;
  const type2 = input.type;
  if (type2 && typeof type2 === "string" && policy.allowedNodeTypes && policy.allowedNodeTypes.length > 0) {
    if (!policy.allowedNodeTypes.includes(type2)) {
      throw new Error(`Node type "${type2}" is blocked by policy.`);
    }
  }
  const projectRoot = input.projectRoot;
  if (projectRoot && typeof projectRoot === "string" && policy.allowedProjectRoots && policy.allowedProjectRoots.length > 0) {
    const normalized = normalizePath(projectRoot);
    const allow = policy.allowedProjectRoots.some((root) => normalizePath(root) === normalized);
    if (!allow) {
      throw new Error(`Project root "${projectRoot}" is blocked by policy.`);
    }
  }
  if (projectRoot && typeof projectRoot === "string" && WRITE_CAPABILITIES.has(params.capability) && policy.allowedWritableProjectRoots && policy.allowedWritableProjectRoots.length > 0) {
    const normalized = normalizePath(projectRoot);
    const allow = policy.allowedWritableProjectRoots.some((root) => normalizePath(root) === normalized);
    if (!allow) {
      throw new Error(`Writable project root "${projectRoot}" is blocked by policy.`);
    }
  }
  const recordKind = extractRecordKind(input);
  if (recordKind && policy.allowedRecordKinds && policy.allowedRecordKinds.length > 0 && !policy.allowedRecordKinds.includes(recordKind)) {
    throw new Error(`record_kind "${recordKind}" is blocked by policy.`);
  }
}
function getCapabilityPolicy() {
  const fallback = {
    allowAgentWrites: true,
    allowAgentDestructive: true,
    maxInputBytes: MAX_INPUT_BYTES
  };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return {
      allowAgentWrites: parsed.allowAgentWrites ?? fallback.allowAgentWrites,
      allowAgentDestructive: parsed.allowAgentDestructive ?? fallback.allowAgentDestructive,
      maxInputBytes: parsed.maxInputBytes ?? fallback.maxInputBytes,
      allowedWritableProjectRoots: Array.isArray(parsed.allowedWritableProjectRoots) ? parsed.allowedWritableProjectRoots.filter((v) => typeof v === "string") : void 0,
      allowedProjectRoots: Array.isArray(parsed.allowedProjectRoots) ? parsed.allowedProjectRoots.filter((v) => typeof v === "string") : void 0,
      allowedNodeTypes: Array.isArray(parsed.allowedNodeTypes) ? parsed.allowedNodeTypes.filter((v) => typeof v === "string") : void 0,
      allowedRecordKinds: Array.isArray(parsed.allowedRecordKinds) ? parsed.allowedRecordKinds.filter((v) => typeof v === "string") : void 0
    };
  } catch {
    return fallback;
  }
}
function encodeUtf8Size(value) {
  return new TextEncoder().encode(value).length;
}
function normalizePath(value) {
  return value.replace(/\\/g, "/").replace(/\/+$/g, "");
}
function extractRecordKind(input) {
  if (typeof input.record_kind === "string" && input.record_kind.trim()) {
    return input.record_kind.trim();
  }
  const extraFields = input.extraFields;
  if (extraFields && typeof extraFields === "object") {
    const record = extraFields;
    if (typeof record.record_kind === "string" && record.record_kind.trim()) {
      return record.record_kind.trim();
    }
  }
  const updates = input.updates;
  if (updates && typeof updates === "object") {
    const record = updates;
    if (typeof record.record_kind === "string" && record.record_kind.trim()) {
      return record.record_kind.trim();
    }
    const updateExtra = record.extraFields;
    if (updateExtra && typeof updateExtra === "object") {
      const extra = updateExtra;
      if (typeof extra.record_kind === "string" && extra.record_kind.trim()) {
        return extra.record_kind.trim();
      }
    }
  }
  return null;
}

// src/services/lego_blocks/integrations/fsBlock.ts
var import_core = __toESM(require_index_cjs(), 1);

// src/services/lego_blocks/units/crossWindowSyncBlock.ts
var CHANNEL_NAME = "ltm-vault-sync";
var _channel = null;
function getChannel() {
  if (!_channel) _channel = new BroadcastChannel(CHANNEL_NAME);
  return _channel;
}
function notifyFileChanged(filePath) {
  getChannel().postMessage({
    type: "file-changed",
    filePath,
    timestamp: Date.now()
  });
}

// src/services/lego_blocks/units/byteEncodingBlock.ts
function utf8ToBytesBlock(input) {
  return new TextEncoder().encode(input);
}
function bytesToUtf8Block(bytes) {
  return new TextDecoder().decode(bytes);
}
function bytesToBase64Block(bytes) {
  if (typeof btoa === "function") {
    let binary2 = "";
    const chunkSize = 32768;
    for (let i = 0; i < bytes.length; i += chunkSize) {
      const chunk = bytes.subarray(i, i + chunkSize);
      binary2 += String.fromCharCode(...chunk);
    }
    return btoa(binary2);
  }
  const maybeBuffer = globalThis.Buffer;
  if (maybeBuffer) return maybeBuffer.from(bytes).toString("base64");
  throw new Error("Base64 encoding is unavailable in this runtime");
}
function base64ToBytesBlock(base64) {
  if (typeof atob === "function") {
    const binary2 = atob(base64);
    const bytes = new Uint8Array(binary2.length);
    for (let i = 0; i < binary2.length; i++) {
      bytes[i] = binary2.charCodeAt(i);
    }
    return bytes;
  }
  const maybeBuffer = globalThis.Buffer;
  if (maybeBuffer) {
    const buf = maybeBuffer.from(base64, "base64");
    const out = new Uint8Array(buf.length);
    for (let i = 0; i < buf.length; i++) out[i] = buf[i];
    return out;
  }
  throw new Error("Base64 decoding is unavailable in this runtime");
}

// src/services/lego_blocks/integrations/fsBlock.ts
function isAlreadyExistsFilesystemErrorBlock(error) {
  const maybeRecord = typeof error === "object" && error !== null ? error : null;
  const code = typeof maybeRecord?.code === "string" ? maybeRecord.code : "";
  const message = error instanceof Error ? error.message : typeof maybeRecord?.message === "string" ? maybeRecord.message : String(error);
  const normalized = message.toLowerCase();
  return code === "OS-PLUG-FILE-0010" || normalized.includes("already exists") || normalized.includes("cannot be overwritten") || normalized.includes("eexist");
}
var WebVaultFS = class {
  async read(path3) {
    const res = await fetch(`/api/tools/file-content?path=${encodeURIComponent(path3)}`);
    if (!res.ok) {
      let detail = "";
      try {
        const payload = await res.json();
        if (payload?.detail) detail = String(payload.detail);
      } catch {
      }
      const suffix = detail || res.statusText || `HTTP ${res.status}`;
      throw new Error(`Failed to read file: ${path3} (${suffix})`);
    }
    const data = await res.json();
    return data.content;
  }
  async write(path3, data) {
    const res = await fetch("/api/tools/vault/write", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: path3, content: data })
    });
    if (!res.ok) throw new Error(`Failed to write file: ${path3}`);
    notifyFileChanged(path3);
  }
  async readBytes(path3) {
    const res = await fetch(`/api/tools/vault/read-bytes?path=${encodeURIComponent(path3)}`);
    if (!res.ok) {
      let detail = "";
      try {
        const payload2 = await res.json();
        if (payload2?.detail) detail = String(payload2.detail);
      } catch {
      }
      const suffix = detail || res.statusText || `HTTP ${res.status}`;
      throw new Error(`Failed to read bytes: ${path3} (${suffix})`);
    }
    const payload = await res.json();
    return base64ToBytesBlock(payload.data_base64 || "");
  }
  async writeBytes(path3, data) {
    const res = await fetch("/api/tools/vault/write-bytes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        path: path3,
        data_base64: bytesToBase64Block(data)
      })
    });
    if (!res.ok) throw new Error(`Failed to write bytes: ${path3}`);
    notifyFileChanged(path3);
  }
  async create(path3, data) {
    if (await this.exists(path3)) throw new Error(`File already exists: ${path3}`);
    await this.write(path3, data);
  }
  async list(path3) {
    const res = await fetch(`/api/tools/vault/readdir?path=${encodeURIComponent(path3)}`);
    if (!res.ok) throw new Error(`Failed to list directory: ${path3}`);
    const json2 = await res.json();
    const files = [];
    const folders = [];
    for (const e of json2.entries) {
      if (e.isDirectory) folders.push(e.name);
      else files.push(e.name);
    }
    return { files, folders };
  }
  async walkVault(extensions = [".md"]) {
    const ext = extensions.join(",");
    const res = await fetch(`/api/tools/vault/walk?extensions=${encodeURIComponent(ext)}`);
    if (!res.ok) throw new Error("Failed to walk vault");
    const data = await res.json();
    return data.files.map((f) => ({
      path: f.path,
      size: f.size,
      mtime: f.mtime,
      ctime: f.birthtime ?? f.ctime ?? f.mtime
    }));
  }
  async stat(path3) {
    const res = await fetch(`/api/tools/vault/stat?path=${encodeURIComponent(path3)}`);
    if (!res.ok) throw new Error(`Failed to stat: ${path3}`);
    const s = await res.json();
    return {
      size: s.size,
      mtime: s.mtime,
      ctime: s.birthtime ?? s.ctime,
      isDirectory: Boolean(s.isDirectory)
    };
  }
  async exists(path3) {
    try {
      await this.stat(path3);
      return true;
    } catch {
      return false;
    }
  }
  async mkdir(path3) {
    const res = await fetch("/api/tools/vault/mkdir", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: path3 })
    });
    if (!res.ok) throw new Error(`Failed to mkdir: ${path3}`);
  }
  async delete(path3) {
    const res = await fetch("/api/tools/vault/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: path3, recursive: false })
    });
    if (!res.ok) throw new Error(`Failed to delete: ${path3}`);
  }
  async process(path3, fn) {
    const content = await this.read(path3);
    await this.write(path3, fn(content));
  }
};
var ElectronVaultFS = class {
  vaultRoot;
  constructor(vaultRoot) {
    this.vaultRoot = vaultRoot;
  }
  get api() {
    return window.electronAPI;
  }
  async read(path3) {
    return this.api.read(this.vaultRoot, path3);
  }
  async write(path3, data) {
    await this.api.write(this.vaultRoot, path3, data);
    notifyFileChanged(path3);
  }
  async readBytes(path3) {
    if (this.api.readBytesBase64) {
      const base64 = await this.api.readBytesBase64(this.vaultRoot, path3);
      return base64ToBytesBlock(base64);
    }
    const text = await this.read(path3);
    return utf8ToBytesBlock(text);
  }
  async writeBytes(path3, data) {
    if (this.api.writeBytesBase64) {
      await this.api.writeBytesBase64(this.vaultRoot, path3, bytesToBase64Block(data));
      notifyFileChanged(path3);
      return;
    }
    await this.write(path3, bytesToUtf8Block(data));
  }
  async create(path3, data) {
    if (await this.exists(path3)) throw new Error(`File already exists: ${path3}`);
    await this.write(path3, data);
  }
  async list(path3) {
    return this.api.list(this.vaultRoot, path3 || ".");
  }
  async walkVault(extensions = [".md"]) {
    return this.api.walkVault(this.vaultRoot, extensions);
  }
  async stat(path3) {
    return this.api.stat(this.vaultRoot, path3);
  }
  async exists(path3) {
    return this.api.exists(this.vaultRoot, path3);
  }
  async mkdir(path3) {
    return this.api.mkdir(this.vaultRoot, path3);
  }
  async delete(path3) {
    if (this.api.deletePath) {
      await this.api.deletePath(this.vaultRoot, path3, false);
    }
  }
  async process(path3, fn) {
    const content = await this.read(path3);
    await this.write(path3, fn(content));
  }
};
var CapacitorVaultFS = class {
  vaultRoot;
  isAbsolute;
  constructor(vaultRoot) {
    this.isAbsolute = vaultRoot.startsWith("/");
    this.vaultRoot = vaultRoot;
  }
  resolve(path3) {
    const base = path3 ? `${this.vaultRoot}/${path3}` : this.vaultRoot;
    if (this.isAbsolute) return `file://${base}`;
    return base;
  }
  async fsOpts(path3) {
    if (this.isAbsolute) {
      return { path: this.resolve(path3) };
    }
    const { Directory } = await Promise.resolve().then(() => __toESM(require_plugin_cjs(), 1));
    return { path: this.resolve(path3), directory: Directory.Documents };
  }
  async read(path3) {
    const { Filesystem, Encoding } = await Promise.resolve().then(() => __toESM(require_plugin_cjs(), 1));
    const opts = await this.fsOpts(path3);
    const result = await Filesystem.readFile({ ...opts, encoding: Encoding.UTF8 });
    return result.data;
  }
  async write(path3, data) {
    const { Filesystem, Encoding } = await Promise.resolve().then(() => __toESM(require_plugin_cjs(), 1));
    const opts = await this.fsOpts(path3);
    await Filesystem.writeFile({ ...opts, data, encoding: Encoding.UTF8, recursive: true });
    notifyFileChanged(path3);
  }
  async readBytes(path3) {
    const { Filesystem } = await Promise.resolve().then(() => __toESM(require_plugin_cjs(), 1));
    const opts = await this.fsOpts(path3);
    const result = await Filesystem.readFile(opts);
    if (typeof result.data === "string") {
      return base64ToBytesBlock(result.data);
    }
    const arrayBuffer = await result.data.arrayBuffer();
    return new Uint8Array(arrayBuffer);
  }
  async writeBytes(path3, data) {
    const { Filesystem } = await Promise.resolve().then(() => __toESM(require_plugin_cjs(), 1));
    const opts = await this.fsOpts(path3);
    await Filesystem.writeFile({
      ...opts,
      data: bytesToBase64Block(data),
      recursive: true
    });
    notifyFileChanged(path3);
  }
  async create(path3, data) {
    if (await this.exists(path3)) throw new Error(`File already exists: ${path3}`);
    await this.write(path3, data);
  }
  async list(path3) {
    const { Filesystem } = await Promise.resolve().then(() => __toESM(require_plugin_cjs(), 1));
    const exists = await this.exists(path3).catch(() => false);
    if (!exists) return { files: [], folders: [] };
    const opts = await this.fsOpts(path3);
    const result = await Filesystem.readdir(opts);
    const files = [];
    const folders = [];
    for (const f of result.files) {
      if (f.name.startsWith(".")) continue;
      if (f.type === "directory") folders.push(f.name);
      else files.push(f.name);
    }
    return { files, folders };
  }
  async walkVault(extensions = [".md"]) {
    const extSet = new Set(extensions);
    const entries = [];
    const walk = async (dirPath, dirUri, relPrefix) => {
      const { Filesystem } = await Promise.resolve().then(() => __toESM(require_plugin_cjs(), 1));
      const opts = dirUri ? { path: dirUri } : this.isAbsolute ? { path: `file://${dirPath}` } : { path: dirPath, directory: (await Promise.resolve().then(() => __toESM(require_plugin_cjs(), 1))).Directory.Documents };
      const result = await Filesystem.readdir(opts);
      const subdirPromises = [];
      const fileStatPromises = [];
      for (const item of result.files) {
        if (item.name.startsWith(".") || EXCLUDED_DIRS.has(item.name)) continue;
        const relPath = relPrefix ? `${relPrefix}/${item.name}` : item.name;
        const itemUri = item.uri;
        if (item.type === "directory") {
          const childDir = `${dirPath}/${item.name}`;
          subdirPromises.push(walk(childDir, itemUri ?? null, relPath));
        } else {
          const ext = "." + item.name.split(".").pop()?.toLowerCase();
          if (!extSet.has(ext || "")) continue;
          const stOpts = itemUri ? { path: itemUri } : this.isAbsolute ? { path: `file://${dirPath}/${item.name}` } : { path: `${dirPath}/${item.name}`, directory: (await Promise.resolve().then(() => __toESM(require_plugin_cjs(), 1))).Directory.Documents };
          fileStatPromises.push(
            Filesystem.stat(stOpts).then((st) => {
              entries.push({
                path: relPath,
                size: st.size,
                mtime: (st.mtime || 0) / 1e3,
                ctime: (st.ctime || st.mtime || 0) / 1e3
              });
            }).catch((err) => {
              console.warn(`[CapacitorVaultFS] Skipping file that failed stat: ${relPath}`, err);
            })
          );
        }
      }
      await Promise.all([...subdirPromises, ...fileStatPromises]);
    };
    await walk(this.vaultRoot, null, "");
    return entries;
  }
  async stat(path3) {
    const { Filesystem } = await Promise.resolve().then(() => __toESM(require_plugin_cjs(), 1));
    const opts = await this.fsOpts(path3);
    const st = await Filesystem.stat(opts);
    return {
      size: st.size,
      mtime: (st.mtime || 0) / 1e3,
      ctime: (st.ctime || st.mtime || 0) / 1e3
    };
  }
  async exists(path3) {
    if (!path3) return true;
    const normalized = path3.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
    if (!normalized) return true;
    const slashIndex = normalized.lastIndexOf("/");
    const parent = slashIndex >= 0 ? normalized.slice(0, slashIndex) : "";
    const name = slashIndex >= 0 ? normalized.slice(slashIndex + 1) : normalized;
    if (!name) return true;
    const { Filesystem, Directory } = await Promise.resolve().then(() => __toESM(require_plugin_cjs(), 1));
    try {
      const parentOpts = this.isAbsolute ? { path: parent ? this.resolve(parent) : this.resolve("") } : { path: parent ? this.resolve(parent) : this.vaultRoot, directory: Directory.Documents };
      const listed = await Filesystem.readdir(parentOpts);
      return listed.files.some((entry) => entry.name === name);
    } catch {
      return false;
    }
  }
  async mkdir(path3) {
    const { Filesystem } = await Promise.resolve().then(() => __toESM(require_plugin_cjs(), 1));
    const opts = await this.fsOpts(path3);
    const exists = await this.exists(path3).catch(() => false);
    if (exists) return;
    try {
      await Filesystem.mkdir({ ...opts, recursive: true });
    } catch (error) {
      if (isAlreadyExistsFilesystemErrorBlock(error)) return;
      throw error;
    }
  }
  async delete(path3) {
    const { Filesystem } = await Promise.resolve().then(() => __toESM(require_plugin_cjs(), 1));
    const opts = await this.fsOpts(path3);
    await Filesystem.deleteFile(opts);
  }
  async process(path3, fn) {
    const content = await this.read(path3);
    await this.write(path3, fn(content));
  }
};
var _instance = null;
var DEFAULT_CAPACITOR_VAULT_ROOT = "LTM-Vault";
function getVaultFS() {
  if (_instance) return _instance;
  _instance = createVaultFS();
  return _instance;
}
function createVaultFS() {
  if (isElectron()) {
    const vaultRoot = getStoredVaultRoot() ?? "";
    return new ElectronVaultFS(vaultRoot);
  }
  if (isCapacitorNative()) {
    const { vaultRoot, normalizedStoredRoot } = normalizeCapacitorStoredVaultRoot(getStoredVaultRoot());
    if (normalizedStoredRoot) {
      setStoredVaultRoot(normalizedStoredRoot);
    }
    return new CapacitorVaultFS(vaultRoot);
  }
  return new WebVaultFS();
}
function isElectron() {
  if (typeof window === "undefined") return false;
  return !!window.electronAPI?.isElectron;
}
function isCapacitorNative() {
  try {
    return import_core.Capacitor.isNativePlatform();
  } catch {
    return false;
  }
}
function getPlatformName() {
  if (isElectron()) return "electron";
  if (isCapacitorNative()) {
    try {
      const platform = import_core.Capacitor.getPlatform();
      if (platform === "ios") return "ios";
      if (platform === "android") return "android";
    } catch {
    }
  }
  return "web";
}
function normalizeCapacitorStoredVaultRoot(storedRoot) {
  const stored = storedRoot ?? "";
  if (stored.startsWith("cap-picker:")) {
    return {
      vaultRoot: stored.slice("cap-picker:".length),
      normalizedStoredRoot: null
    };
  }
  if (stored.startsWith("/")) {
    return {
      vaultRoot: DEFAULT_CAPACITOR_VAULT_ROOT,
      normalizedStoredRoot: DEFAULT_CAPACITOR_VAULT_ROOT
    };
  }
  const resolved = stored || DEFAULT_CAPACITOR_VAULT_ROOT;
  return {
    vaultRoot: resolved,
    normalizedStoredRoot: null
  };
}

// src/services/lego_blocks/integrations/organizerBodyBlock.ts
var COMMENT_BLOCK_SEPARATOR_RE = /\n{2,}---\n{2,}/;
var COMMENT_META_RE = /^<!--\s*ltm-comment-meta:(.+?)\s*-->\s*\n?/s;
function parseOrganizerBodySections(body) {
  const parsed = splitTopLevelSections(body);
  const descriptionSection = parsed.sections.find((section) => section.headingNormalized === "description");
  const commentsSection = parsed.sections.find((section) => section.headingNormalized === "comments");
  return {
    description: normalizeSectionText(descriptionSection?.content),
    comments: parseCommentSection(commentsSection?.content ?? "")
  };
}
function upsertOrganizerBodySections(body, updates) {
  const parsed = splitTopLevelSections(body);
  const preservedSections = parsed.sections.filter((section) => section.headingNormalized !== "description" && section.headingNormalized !== "comments");
  const blocks = [];
  const preface = normalizeSectionText(parsed.preface);
  if (preface) blocks.push(preface);
  const description = normalizeSectionText(updates.description);
  if (description) {
    blocks.push(["## Description", "", description].join("\n"));
  }
  if (updates.comments.length > 0) {
    blocks.push(["## Comments", "", serializeCommentSection(updates.comments)].join("\n"));
  }
  for (const section of preservedSections) {
    const content = normalizeSectionText(section.content);
    blocks.push(content ? [`## ${section.heading}`, "", content].join("\n") : `## ${section.heading}`);
  }
  return blocks.join("\n\n").trim();
}
function splitTopLevelSections(body) {
  const normalized = normalizeBody(body);
  const headingRe = /^##\s+(.+?)\s*$/gm;
  const matches = [];
  for (const match of normalized.matchAll(headingRe)) {
    if (typeof match.index !== "number") continue;
    matches.push({
      start: match.index,
      end: match.index + match[0].length,
      heading: match[1].trim()
    });
  }
  if (matches.length === 0) {
    return {
      preface: normalized.trim(),
      sections: []
    };
  }
  const preface = normalized.slice(0, matches[0].start).trim();
  const sections = [];
  for (let i = 0; i < matches.length; i += 1) {
    const current = matches[i];
    const next = matches[i + 1];
    const sectionEnd = next ? next.start : normalized.length;
    const content = normalized.slice(current.end, sectionEnd).replace(/^\n+/, "").trim();
    sections.push({
      heading: current.heading,
      headingNormalized: current.heading.toLowerCase(),
      content
    });
  }
  return { preface, sections };
}
function parseCommentSection(content) {
  const normalized = normalizeSectionText(content);
  if (!normalized) return [];
  const lines = normalized.split("\n");
  const bulletItems = lines.map((line) => line.trim()).filter((line) => line.startsWith("- ")).map((line) => line.slice(2).trim()).filter(Boolean);
  if (bulletItems.length > 0 && bulletItems.length === lines.filter((line) => line.trim()).length) {
    return bulletItems.map((text) => ({ text }));
  }
  const blocks = normalized.split(COMMENT_BLOCK_SEPARATOR_RE).map((block) => block.trim()).filter(Boolean);
  if (blocks.length === 0) return [];
  return blocks.map(parseCommentBlock).filter((entry) => entry !== null);
}
function parseCommentBlock(block) {
  const metaMatch = block.match(COMMENT_META_RE);
  let text = block;
  let added_at;
  let added_by;
  if (metaMatch) {
    text = block.slice(metaMatch[0].length).trim();
    const meta = parseCommentMeta(metaMatch[1]);
    added_at = meta.added_at;
    added_by = meta.added_by;
  }
  const normalizedText = text.trim();
  if (!normalizedText) return null;
  return {
    text: normalizedText,
    added_at,
    added_by
  };
}
function parseCommentMeta(raw) {
  try {
    const parsed = JSON.parse(raw);
    return {
      added_at: typeof parsed.added_at === "string" ? parsed.added_at : void 0,
      added_by: typeof parsed.added_by === "string" ? parsed.added_by : void 0
    };
  } catch {
    return {};
  }
}
function serializeCommentSection(comments) {
  return comments.map((comment) => serializeCommentBlock(comment)).filter(Boolean).join("\n\n---\n\n");
}
function serializeCommentBlock(comment) {
  const text = comment.text?.trim() ?? "";
  if (!text) return "";
  const meta = {
    added_at: comment.added_at ?? "",
    added_by: comment.added_by ?? ""
  };
  return [
    `<!-- ltm-comment-meta:${JSON.stringify(meta)} -->`,
    text
  ].join("\n");
}
function normalizeSectionText(value) {
  const normalized = normalizeBody(value ?? "").trim();
  return normalized || void 0;
}
function normalizeBody(value) {
  return value.replace(/\r\n/g, "\n");
}

// node_modules/dexie/import-wrapper.mjs
var import_dexie = __toESM(require_dexie(), 1);
var DexieSymbol = Symbol.for("Dexie");
var Dexie = globalThis[DexieSymbol] || (globalThis[DexieSymbol] = import_dexie.default);
if (import_dexie.default.semVer !== Dexie.semVer) {
  throw new Error(`Two different versions of Dexie loaded in the same app: ${import_dexie.default.semVer} and ${Dexie.semVer}`);
}
var {
  liveQuery,
  mergeRanges,
  rangesOverlap,
  RangeSet,
  cmp: cmp2,
  Entity,
  PropModification,
  replacePrefix,
  add,
  remove,
  DexieYProvider
} = Dexie;
var import_wrapper_default = Dexie;

// src/services/lego_blocks/integrations/dbBlock.ts
var ThinkingSpaceDB = class extends import_wrapper_default {
  nodes;
  links;
  constructor() {
    super("ThinkingSpaceDB");
    this.version(1).stores({
      nodes: "++id, &uuid, &key, type, parent, parentUuid, filePath, updatedAt, status, *tags"
    });
    this.version(2).stores({
      nodes: "++id, &uuid, &key, type, parent, parentUuid, filePath, updatedAt, status, taskStatus, owner, runId, sessionId, recordKind, *tags, *dependsOn, *blockedBy, *relatedNodes, *metadataKeys"
    }).upgrade(async (tx) => {
      const table = tx.table("nodes");
      await table.toCollection().modify((raw) => {
        const normalized = normalizeRecordForStorage(raw);
        Object.assign(raw, normalized);
      });
    });
    this.version(3).stores({
      nodes: "++id, &uuid, &key, type, parent, parentUuid, filePath, updatedAt, status, taskStatus, owner, runId, sessionId, recordKind, *tags, *dependsOn, *blockedBy, *relatedNodes, *metadataKeys",
      links: "++id, sourceFilePath, targetFilePath, linkType"
    });
  }
};
var _db = null;
function getDb() {
  if (!_db) _db = new ThinkingSpaceDB();
  return _db;
}
async function upsertNode(record) {
  const db = getDb();
  const normalized = normalizeRecordForStorage(record);
  const existing = await db.nodes.where("uuid").equals(record.uuid).first();
  const conflictingByKey = await db.nodes.where("key").equals(normalized.key).first();
  if (conflictingByKey && conflictingByKey.uuid !== normalized.uuid) {
    throw new Error(formatNodeKeyConflictMessage({
      key: normalized.key,
      uuid: normalized.uuid,
      filePath: normalized.filePath,
      conflictingUuid: conflictingByKey.uuid,
      conflictingFilePath: conflictingByKey.filePath
    }));
  }
  if (existing) {
    await db.nodes.update(existing.id, normalized);
  } else {
    await db.nodes.add(normalized);
  }
}
async function bulkUpsertNodes(records) {
  if (records.length === 0) return { writtenCount: 0, conflicts: [] };
  const db = getDb();
  const dedupedByUuid = /* @__PURE__ */ new Map();
  for (const record of records.map(normalizeRecordForStorage)) {
    dedupedByUuid.set(record.uuid, record);
  }
  const normalized = [...dedupedByUuid.values()];
  const uuids = normalized.map((r) => r.uuid);
  const existingNodes = await db.nodes.where("uuid").anyOf(uuids).toArray();
  const existingByUuid = new Map(existingNodes.map((n) => [n.uuid, n]));
  const keys = [...new Set(normalized.map((r) => r.key).filter(Boolean))];
  const existingKeyNodes = keys.length > 0 ? await db.nodes.where("key").anyOf(keys).toArray() : [];
  const existingByKey = new Map(existingKeyNodes.map((n) => [n.key, n]));
  const incomingByKey = /* @__PURE__ */ new Map();
  const toUpdate = [];
  const toAdd = [];
  const conflicts = [];
  for (const record of normalized) {
    const incomingConflict = incomingByKey.get(record.key);
    if (incomingConflict && incomingConflict.uuid !== record.uuid) {
      conflicts.push({
        key: record.key,
        uuid: record.uuid,
        filePath: record.filePath,
        conflictingUuid: incomingConflict.uuid,
        conflictingFilePath: incomingConflict.filePath
      });
      continue;
    }
    const existingKeyNode = existingByKey.get(record.key);
    if (existingKeyNode && existingKeyNode.uuid !== record.uuid) {
      conflicts.push({
        key: record.key,
        uuid: record.uuid,
        filePath: record.filePath,
        conflictingUuid: existingKeyNode.uuid,
        conflictingFilePath: existingKeyNode.filePath
      });
      continue;
    }
    incomingByKey.set(record.key, record);
    const existingNode = existingByUuid.get(record.uuid);
    if (existingNode?.id !== void 0) {
      toUpdate.push({ ...record, id: existingNode.id });
    } else {
      toAdd.push(record);
    }
  }
  await db.transaction("rw", db.nodes, async () => {
    if (toUpdate.length > 0) await db.nodes.bulkPut(toUpdate);
    if (toAdd.length > 0) await db.nodes.bulkAdd(toAdd);
  });
  return {
    writtenCount: toUpdate.length + toAdd.length,
    conflicts
  };
}
async function getChildren(parentKey) {
  const db = getDb();
  const children = await db.nodes.where("parent").equals(parentKey).toArray();
  return children.sort(compareNodeDisplayOrder);
}
async function getNodeByKey(key) {
  const db = getDb();
  return db.nodes.where("key").equals(key).first();
}
async function getNodeByUuid(uuid) {
  const db = getDb();
  return db.nodes.where("uuid").equals(uuid).first();
}
async function getRootNodes() {
  const db = getDb();
  const roots = await db.nodes.where("parent").equals("").toArray();
  return roots.sort(compareNodeDisplayOrder);
}
async function getAllNodes() {
  const db = getDb();
  return db.nodes.orderBy("type").toArray();
}
async function searchNodes(query, limit = 20) {
  const db = getDb();
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  const scored = [];
  let earlyExitCount = 0;
  const maxScan = limit * 50;
  await db.nodes.each((node) => {
    if (earlyExitCount >= maxScan) return;
    earlyExitCount++;
    const searchable = node.searchText || "";
    let score = 0;
    for (const term of terms) {
      if (searchable.includes(term)) score++;
    }
    if (score > 0) {
      scored.push({ node, score });
    }
  });
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.node);
}
async function deleteNode(uuid) {
  const db = getDb();
  await db.nodes.where("uuid").equals(uuid).delete();
}
async function clearAll() {
  const db = getDb();
  await db.nodes.clear();
}
async function getAllFilePaths() {
  const db = getDb();
  const paths = await db.nodes.orderBy("filePath").uniqueKeys();
  return new Set(paths);
}
async function replaceLinksForFile(sourceFilePath, links) {
  const db = getDb();
  await db.transaction("rw", db.links, async () => {
    await db.links.where("sourceFilePath").equals(sourceFilePath).delete();
    if (links.length > 0) await db.links.bulkAdd(links);
  });
}
async function bulkUpsertLinks(links) {
  const db = getDb();
  if (links.length === 0) return;
  await db.links.bulkAdd(links);
}
async function clearAllLinks() {
  const db = getDb();
  await db.links.clear();
}
function normalizeRecordForStorage(record) {
  const metadata = record.metadata ? structuredClone(record.metadata) : void 0;
  const parent = record.parent || "";
  const tags = (record.tags ?? []).filter(Boolean);
  const projectPresetTags = record.projectPresetTags?.filter(Boolean);
  const metadataText = record.metadataText ?? buildMetadataSearchText(metadata);
  const searchText = buildSearchText(record, tags, projectPresetTags, metadataText);
  return {
    ...record,
    parent,
    dependsOn: record.dependsOn?.filter(Boolean),
    blockedBy: record.blockedBy?.filter(Boolean),
    acceptanceCriteria: record.acceptanceCriteria?.filter(Boolean),
    artifacts: record.artifacts?.filter(Boolean),
    relatedNodes: record.relatedNodes?.filter(Boolean),
    metadata,
    metadataKeys: (record.metadataKeys ?? extractMetadataKeys(metadata)).filter(Boolean),
    metadataText,
    tags,
    projectPresetTags,
    searchText
  };
}
function buildSearchText(record, tags, projectPresetTags, metadataText) {
  const parts = [
    record.title,
    record.key
  ];
  if (tags.length > 0) parts.push(tags.join(" "));
  if (projectPresetTags && projectPresetTags.length > 0) parts.push(projectPresetTags.join(" "));
  if (record.bodyExcerpt) parts.push(record.bodyExcerpt);
  if (record.aiSummary) parts.push(record.aiSummary);
  if (record.taskId) parts.push(record.taskId);
  if (record.taskStatus) parts.push(record.taskStatus);
  if (record.owner) parts.push(record.owner);
  if (record.agentName) parts.push(record.agentName);
  if (record.recordKind) parts.push(record.recordKind);
  if (record.description) parts.push(record.description);
  if (metadataText) parts.push(metadataText);
  return parts.join(" ").toLowerCase();
}
function compareNodeDisplayOrder(a, b) {
  const aOrder = typeof a.sortOrder === "number" && Number.isFinite(a.sortOrder) ? a.sortOrder : Number.POSITIVE_INFINITY;
  const bOrder = typeof b.sortOrder === "number" && Number.isFinite(b.sortOrder) ? b.sortOrder : Number.POSITIVE_INFINITY;
  if (aOrder !== bOrder) return aOrder - bOrder;
  const byTitle = a.title.localeCompare(b.title);
  if (byTitle !== 0) return byTitle;
  return a.key.localeCompare(b.key);
}
function extractMetadataKeys(metadata) {
  if (!metadata) return [];
  const keys = /* @__PURE__ */ new Set();
  collectMetadataKeys("", metadata, keys);
  return [...keys];
}
function collectMetadataKeys(prefix, value, out) {
  if (value === null || value === void 0) return;
  if (Array.isArray(value)) {
    for (const item of value) {
      collectMetadataKeys(prefix, item, out);
    }
    return;
  }
  if (typeof value !== "object") return;
  const record = value;
  for (const [key, inner] of Object.entries(record)) {
    const path3 = prefix ? `${prefix}.${key}` : key;
    out.add(path3);
    collectMetadataKeys(path3, inner, out);
  }
}
function buildMetadataSearchText(metadata) {
  if (!metadata) return "";
  const values = [];
  collectMetadataValues(metadata, values);
  return values.join(" ").toLowerCase();
}
function collectMetadataValues(value, out) {
  if (value === null || value === void 0) return;
  if (Array.isArray(value)) {
    for (const item of value) {
      collectMetadataValues(item, out);
    }
    return;
  }
  if (typeof value === "object") {
    const record = value;
    for (const [key, inner] of Object.entries(record)) {
      out.push(key);
      collectMetadataValues(inner, out);
    }
    return;
  }
  out.push(String(value));
}
function formatNodeKeyConflictMessage(conflict) {
  return `Duplicate node key "${conflict.key}" in "${conflict.filePath}" conflicts with "${conflictingFilePath(conflict)}". Node keys must be unique.`;
}
function conflictingFilePath(conflict) {
  return conflict.conflictingFilePath || `[uuid:${conflict.conflictingUuid}]`;
}

// src/services/lego_blocks/integrations/projectStorageBlock.ts
var THINKING_ORGANIZER_DIR = "thinking-organizer";
var TYPE_FOLDERS = {
  program: "programs",
  epic: "epics",
  idea_bucket: "idea_buckets",
  idea: "ideas",
  thought_bucket: "thought_buckets",
  thought: "thoughts",
  task: "tasks",
  run: "runs",
  handoff: "handoffs"
};
function getProjectStoragePath(projectRoot, nodeType) {
  const root = projectRoot.replace(/\/+$/, "");
  return `${root}/${THINKING_ORGANIZER_DIR}/${TYPE_FOLDERS[nodeType]}`;
}

// src/services/lego_blocks/integrations/obsidianWikilinkBlock.ts
var WIKILINK_TOKEN_PATTERN = /(!)?\[\[([^[\]]+?)\]\]/g;
function normalizeVaultPath(path3) {
  const sanitized = path3.replace(/\\/g, "/").trim();
  if (!sanitized) return "";
  const parts = sanitized.split("/").filter(Boolean);
  const stack = [];
  for (const part of parts) {
    if (part === ".") continue;
    if (part === "..") {
      if (stack.length > 0) stack.pop();
      continue;
    }
    stack.push(part);
  }
  return stack.join("/");
}
function dirnameOf(path3) {
  const normalized = normalizeVaultPath(path3);
  const idx = normalized.lastIndexOf("/");
  if (idx < 0) return "";
  return normalized.slice(0, idx);
}
function leafOf(path3) {
  const normalized = normalizeVaultPath(path3);
  const idx = normalized.lastIndexOf("/");
  if (idx < 0) return normalized;
  return normalized.slice(idx + 1);
}
function joinVaultPath(parent, child) {
  const base = normalizeVaultPath(parent);
  const relRaw = child.replace(/\\/g, "/").trim();
  if (!base) return normalizeVaultPath(relRaw);
  if (!relRaw) return base;
  return normalizeVaultPath(`${base}/${relRaw}`);
}
function hasExplicitExtension(path3) {
  const leaf = leafOf(path3);
  const idx = leaf.lastIndexOf(".");
  return idx > 0;
}
function stripMarkdownExtension(path3) {
  if (path3.toLowerCase().endsWith(".md")) return path3.slice(0, -3);
  return path3;
}
function extensionVariants(path3) {
  const normalized = normalizeVaultPath(path3);
  if (!normalized) return [];
  if (hasExplicitExtension(normalized)) return [normalized];
  return [
    normalized,
    `${normalized}.md`,
    `${normalized}.excalidraw.md`,
    `${normalized}.excalidraw`
  ];
}
function addLookupKey(map2, key, path3) {
  const normalizedKey = normalizeVaultPath(key).toLowerCase();
  if (!normalizedKey) return;
  const existing = map2.get(normalizedKey);
  if (existing) {
    existing.add(path3);
    return;
  }
  map2.set(normalizedKey, /* @__PURE__ */ new Set([path3]));
}
function buildCandidateLookup(candidatePaths) {
  const map2 = /* @__PURE__ */ new Map();
  for (const rawPath of candidatePaths) {
    const path3 = normalizeVaultPath(rawPath);
    if (!path3) continue;
    addLookupKey(map2, path3, path3);
    const withoutMd = stripMarkdownExtension(path3);
    addLookupKey(map2, withoutMd, path3);
    const fileName = leafOf(path3);
    addLookupKey(map2, fileName, path3);
    addLookupKey(map2, stripMarkdownExtension(fileName), path3);
  }
  return map2;
}
function sharedPathPrefixLength(a, b) {
  const aParts = normalizeVaultPath(a).split("/").filter(Boolean);
  const bParts = normalizeVaultPath(b).split("/").filter(Boolean);
  const len = Math.min(aParts.length, bParts.length);
  let shared = 0;
  for (let i = 0; i < len; i += 1) {
    if (aParts[i].toLowerCase() !== bParts[i].toLowerCase()) break;
    shared += 1;
  }
  return shared;
}
function chooseBestCandidate(paths, currentPath) {
  if (paths.length <= 1) return paths[0] ?? "";
  const currentDir = dirnameOf(currentPath);
  return [...paths].sort((a, b) => {
    const dirA = dirnameOf(a);
    const dirB = dirnameOf(b);
    const sameDirA = dirA.toLowerCase() === currentDir.toLowerCase() ? 0 : 1;
    const sameDirB = dirB.toLowerCase() === currentDir.toLowerCase() ? 0 : 1;
    if (sameDirA !== sameDirB) return sameDirA - sameDirB;
    const sharedA = sharedPathPrefixLength(currentDir, dirA);
    const sharedB = sharedPathPrefixLength(currentDir, dirB);
    if (sharedA !== sharedB) return sharedB - sharedA;
    return a.localeCompare(b);
  })[0];
}
function splitTargetAndAlias(rawInner) {
  const pipeIdx = rawInner.indexOf("|");
  if (pipeIdx < 0) {
    return { target: rawInner.trim(), alias: null };
  }
  const target = rawInner.slice(0, pipeIdx).trim();
  const alias = rawInner.slice(pipeIdx + 1).trim();
  return { target, alias: alias || null };
}
function normalizeWikilinkPath(path3) {
  return path3.replace(/\\/g, "/").replace(/^\/+/g, "").replace(/\/+/g, "/").trim();
}
function parseWikilinkTargetBlock(rawTarget) {
  const raw = rawTarget.trim();
  if (!raw) {
    return {
      raw,
      path: "",
      heading: null,
      blockRef: null
    };
  }
  const hashIdx = raw.indexOf("#");
  if (hashIdx < 0) {
    return {
      raw,
      path: normalizeWikilinkPath(raw),
      heading: null,
      blockRef: null
    };
  }
  const pathPart = normalizeWikilinkPath(raw.slice(0, hashIdx));
  const suffix = raw.slice(hashIdx + 1).trim();
  if (!suffix) {
    return {
      raw,
      path: pathPart,
      heading: null,
      blockRef: null
    };
  }
  if (suffix.startsWith("^")) {
    const blockRef = suffix.slice(1).trim();
    return {
      raw,
      path: pathPart,
      heading: null,
      blockRef: blockRef || null
    };
  }
  return {
    raw,
    path: pathPart,
    heading: suffix,
    blockRef: null
  };
}
function splitTextByWikilinksBlock(text) {
  if (!text) {
    return [{ kind: "text", text: "", target: null, alias: null, embed: false }];
  }
  const output = [];
  let cursor = 0;
  let match;
  while ((match = WIKILINK_TOKEN_PATTERN.exec(text)) !== null) {
    const index = match.index;
    if (index > cursor) {
      output.push({
        kind: "text",
        text: text.slice(cursor, index),
        target: null,
        alias: null,
        embed: false
      });
    }
    const embed = Boolean(match[1]);
    const inner = match[2] ?? "";
    const { target, alias } = splitTargetAndAlias(inner);
    const raw = match[0] ?? `[[${inner}]]`;
    if (!target) {
      output.push({
        kind: "text",
        text: raw,
        target: null,
        alias: null,
        embed: false
      });
    } else {
      output.push({
        kind: "wikilink",
        text: raw,
        target,
        alias,
        embed
      });
    }
    cursor = index + raw.length;
  }
  if (cursor < text.length) {
    output.push({
      kind: "text",
      text: text.slice(cursor),
      target: null,
      alias: null,
      embed: false
    });
  }
  return output.length > 0 ? output : [{ kind: "text", text, target: null, alias: null, embed: false }];
}
function resolveWikilinkPathBlock(input) {
  const parsed = parseWikilinkTargetBlock(input.target);
  if (!parsed.path) {
    return {
      path: normalizeVaultPath(input.currentPath) || null,
      heading: parsed.heading,
      blockRef: parsed.blockRef
    };
  }
  const lookup = buildCandidateLookup(input.candidatePaths);
  const currentDir = dirnameOf(input.currentPath);
  const hasRelativePrefix = parsed.path.startsWith("./") || parsed.path.startsWith("../");
  const hasSlash = parsed.path.includes("/");
  const pathQueries = [];
  const appendVariants = (basePath) => {
    for (const variant of extensionVariants(basePath)) {
      pathQueries.push(variant.toLowerCase());
    }
  };
  if (hasRelativePrefix) {
    appendVariants(joinVaultPath(currentDir, parsed.path));
  } else if (hasSlash) {
    appendVariants(parsed.path);
    appendVariants(joinVaultPath(currentDir, parsed.path));
  } else {
    appendVariants(joinVaultPath(currentDir, parsed.path));
    appendVariants(parsed.path);
  }
  for (const query of pathQueries) {
    const matched = lookup.get(query);
    if (!matched || matched.size === 0) continue;
    const selected = chooseBestCandidate([...matched], input.currentPath);
    return {
      path: selected || null,
      heading: parsed.heading,
      blockRef: parsed.blockRef
    };
  }
  return {
    path: null,
    heading: parsed.heading,
    blockRef: parsed.blockRef
  };
}

// src/services/lego_blocks/units/linkIndexBlock.ts
function splitFrontmatterDocumentBlock(content) {
  const openMatch = content.match(/^---(\r?\n)/);
  if (!openMatch) return { frontmatter: "", body: content };
  const lineBreak = openMatch[1];
  const start = openMatch[0].length;
  const closeToken = `${lineBreak}---`;
  const closeIndex = content.indexOf(closeToken, start);
  if (closeIndex < 0) return { frontmatter: "", body: content };
  let frontmatterEnd = closeIndex + closeToken.length;
  if (content.startsWith(lineBreak, frontmatterEnd)) {
    frontmatterEnd += lineBreak.length;
  }
  return {
    frontmatter: content.slice(0, frontmatterEnd),
    body: content.slice(frontmatterEnd)
  };
}
function isLikelyYamlPathScalarBlock(value) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (/^(true|false|null|~|yes|no|on|off)$/i.test(trimmed)) return false;
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return false;
  if (trimmed.startsWith("|") || trimmed.startsWith(">")) return false;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return false;
  if (trimmed.startsWith("&") || trimmed.startsWith("*") || trimmed.startsWith("!")) return false;
  if (trimmed.includes("[[") || trimmed.includes("](") || trimmed.includes("{{")) return false;
  return trimmed.startsWith("./") || trimmed.startsWith("../") || trimmed.startsWith("/") || trimmed.includes("/") || /\.[A-Za-z0-9]{1,8}$/i.test(trimmed);
}
function findYamlCommentStartIndexBlock(value) {
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < value.length; i += 1) {
    const ch = value[i];
    if (ch === "'" && !inDouble) {
      const next = value[i + 1];
      if (inSingle && next === "'") {
        i += 1;
        continue;
      }
      inSingle = !inSingle;
      continue;
    }
    if (ch === '"' && !inSingle) {
      const prev = value[i - 1];
      if (prev !== "\\") inDouble = !inDouble;
      continue;
    }
    if (ch === "#" && !inSingle && !inDouble) {
      if (i === 0 || /\s/.test(value[i - 1] ?? "")) return i;
    }
  }
  return -1;
}
function hasUriScheme(value) {
  return /^[A-Za-z][A-Za-z0-9+.-]*:/.test(value);
}
function normalizeLinkPath(path3) {
  const sanitized = path3.replace(/\\/g, "/").trim();
  if (!sanitized) return "";
  const parts = sanitized.split("/").filter(Boolean);
  const stack = [];
  for (const part of parts) {
    if (part === ".") continue;
    if (part === "..") {
      if (stack.length > 0) stack.pop();
      continue;
    }
    stack.push(part);
  }
  return stack.join("/");
}
function dirnameLinkPath(path3) {
  const normalized = normalizeLinkPath(path3);
  const idx = normalized.lastIndexOf("/");
  if (idx < 0) return "";
  return normalized.slice(0, idx);
}
function joinLinkPath(parent, child) {
  const base = normalizeLinkPath(parent);
  const relRaw = child.replace(/\\/g, "/").trim();
  if (!base) return normalizeLinkPath(relRaw);
  if (!relRaw) return base;
  return normalizeLinkPath(`${base}/${relRaw}`);
}
function extractWikilinks(content, filePath, candidatePaths) {
  const links = [];
  const tokens = splitTextByWikilinksBlock(content);
  const normalizedFilePath = normalizeLinkPath(filePath);
  for (const token of tokens) {
    if (token.kind !== "wikilink" || !token.target) continue;
    const parsed = parseWikilinkTargetBlock(token.target);
    if (!parsed.path) continue;
    const resolved = resolveWikilinkPathBlock({
      currentPath: normalizedFilePath,
      target: token.target,
      candidatePaths
    });
    if (!resolved.path) continue;
    links.push({
      targetFilePath: resolved.path,
      linkType: "wikilink",
      rawText: token.text
    });
  }
  return links;
}
var MARKDOWN_LINK_PATTERN = /(!?)\[([^\]]*?)\]\(([^)\n]+)\)/g;
function extractMarkdownLinks(content, filePath) {
  const links = [];
  const normalizedFilePath = normalizeLinkPath(filePath);
  const currentDir = dirnameLinkPath(normalizedFilePath);
  let match;
  while ((match = MARKDOWN_LINK_PATTERN.exec(content)) !== null) {
    const rawDestination = (match[3] ?? "").trim();
    if (!rawDestination) continue;
    const wrapped = rawDestination.startsWith("<") && rawDestination.endsWith(">");
    const unwrapped = wrapped ? rawDestination.slice(1, -1).trim() : rawDestination;
    const destMatch = /^(\S+)([\s\S]*)$/.exec(unwrapped);
    if (!destMatch) continue;
    const linkPathWithSuffix = destMatch[1] ?? "";
    if (!linkPathWithSuffix || linkPathWithSuffix.startsWith("#") || hasUriScheme(linkPathWithSuffix)) {
      continue;
    }
    const hashIdx = linkPathWithSuffix.indexOf("#");
    const pathPart = (hashIdx >= 0 ? linkPathWithSuffix.slice(0, hashIdx) : linkPathWithSuffix).trim();
    if (!pathPart) continue;
    const absolutePath = pathPart.startsWith("/") ? normalizeLinkPath(pathPart.slice(1)) : normalizeLinkPath(joinLinkPath(currentDir, pathPart));
    if (!absolutePath) continue;
    links.push({
      targetFilePath: absolutePath,
      linkType: "markdown",
      rawText: match[0]
    });
  }
  return links;
}
function extractYamlPathScalars(content, filePath, candidatePaths) {
  const { frontmatter } = splitFrontmatterDocumentBlock(content);
  if (!frontmatter) return [];
  const links = [];
  const normalizedFilePath = normalizeLinkPath(filePath);
  const currentDir = dirnameLinkPath(normalizedFilePath);
  const normalizedCandidateSet = new Set(candidatePaths.map(normalizeLinkPath));
  const lines = frontmatter.split(/\r?\n/);
  if (lines.length < 3 || lines[0] !== "---") return [];
  const closeIndex = lines.findIndex((line, index) => index > 0 && line === "---");
  if (closeIndex < 0) return [];
  for (let i = 1; i < closeIndex; i += 1) {
    const line = lines[i];
    if (!line || /^\s*#/.test(line)) continue;
    const mappingMatch = /^(\s*[^:#\n][^:\n]*:\s*)(.+)$/.exec(line);
    const listMatch = mappingMatch ? null : /^(\s*-\s+)(.+)$/.exec(line);
    const valuePart = mappingMatch?.[2] ?? listMatch?.[2];
    if (!valuePart) continue;
    if (valuePart.trimStart().startsWith("|") || valuePart.trimStart().startsWith(">")) continue;
    if (/^[^"'#\s][^:]*:\s+/.test(valuePart.trimStart())) continue;
    const trimmedValue = valuePart.trimStart();
    const commentStart = findYamlCommentStartIndexBlock(trimmedValue);
    const scalarSegment = (commentStart >= 0 ? trimmedValue.slice(0, commentStart) : trimmedValue).trimEnd();
    if (!scalarSegment) continue;
    const quote = scalarSegment.startsWith('"') && scalarSegment.endsWith('"') ? '"' : scalarSegment.startsWith("'") && scalarSegment.endsWith("'") ? "'" : "";
    const unquoted = quote ? scalarSegment.slice(1, -1) : scalarSegment;
    if (!isLikelyYamlPathScalarBlock(unquoted)) continue;
    if (unquoted.startsWith("#") || hasUriScheme(unquoted)) continue;
    const resolved = resolveWikilinkPathBlock({
      currentPath: normalizedFilePath,
      target: unquoted,
      candidatePaths
    }).path;
    if (resolved) {
      links.push({
        targetFilePath: resolved,
        linkType: "yaml",
        rawText: scalarSegment
      });
      continue;
    }
    let absolutePath = null;
    if (unquoted.startsWith("/")) {
      absolutePath = normalizeLinkPath(unquoted.slice(1));
    } else if (unquoted.startsWith("./") || unquoted.startsWith("../")) {
      absolutePath = joinLinkPath(currentDir, unquoted);
    } else if (unquoted.includes("/")) {
      absolutePath = normalizeLinkPath(unquoted);
    }
    if (absolutePath && normalizedCandidateSet.has(absolutePath)) {
      links.push({
        targetFilePath: absolutePath,
        linkType: "yaml",
        rawText: scalarSegment
      });
    }
  }
  return links;
}
function extractLinksFromContentBlock(content, filePath, candidatePaths) {
  const wikilinks = extractWikilinks(content, filePath, candidatePaths);
  const markdownLinks = extractMarkdownLinks(content, filePath);
  const yamlLinks = extractYamlPathScalars(content, filePath, candidatePaths);
  return wikilinks.concat(markdownLinks, yamlLinks);
}

// src/services/orchestrators/vaultSyncOrch.ts
var _cachedFilePaths = null;
var _cachedFilePathsAge = 0;
var FILE_PATHS_CACHE_TTL_MS = 3e4;
function getCachedFilePaths() {
  if (_cachedFilePaths && Date.now() - _cachedFilePathsAge < FILE_PATHS_CACHE_TTL_MS) {
    return _cachedFilePaths;
  }
  _cachedFilePaths = null;
  return null;
}
function setCachedFilePaths(paths) {
  _cachedFilePaths = paths;
  _cachedFilePathsAge = Date.now();
}
var IOS_MAX_SYNC_FILE_SIZE_BYTES = 2 * 1024 * 1024;
var DEFAULT_MAX_SYNC_FILE_SIZE_BYTES = 12 * 1024 * 1024;
function resolveMaxSyncFileSizeBytes(options) {
  if (typeof options?.maxFileSizeBytes === "number" && Number.isFinite(options.maxFileSizeBytes)) {
    return Math.max(1, Math.floor(options.maxFileSizeBytes));
  }
  return getPlatformName() === "ios" ? IOS_MAX_SYNC_FILE_SIZE_BYTES : DEFAULT_MAX_SYNC_FILE_SIZE_BYTES;
}
async function fullSync(fs, options) {
  const vaultFs = fs ?? getVaultFS();
  const start = Date.now();
  await clearAll();
  await clearAllLinks();
  const entries = await vaultFs.walkVault([".md"]);
  const candidatePaths = entries.map((e) => e.path);
  setCachedFilePaths(new Set(candidatePaths));
  const result = await syncEntries(vaultFs, entries, options, candidatePaths);
  result.durationMs = Date.now() - start;
  return result;
}
async function syncSingleFile(filePath, fs, options) {
  const vaultFs = fs ?? getVaultFS();
  const maxFileSizeBytes = resolveMaxSyncFileSizeBytes(options);
  try {
    const stat2 = await vaultFs.stat(filePath);
    if (stat2.size > maxFileSizeBytes) return false;
    const content = await vaultFs.read(filePath);
    if (!hasFrontmatter(content)) return false;
    const note = parseNote(content);
    if (!note) return false;
    const record = frontmatterToRecord(note.frontmatter, filePath, note.body);
    await upsertNode(record);
    const candidatePaths = getCachedFilePaths() ?? await getAllFilePaths();
    const links = extractLinksFromContentBlock(content, filePath, [...candidatePaths]);
    const linkRecords = links.map((l) => ({
      sourceFilePath: filePath,
      targetFilePath: l.targetFilePath,
      linkType: l.linkType,
      rawText: l.rawText
    }));
    await replaceLinksForFile(filePath, linkRecords);
    return true;
  } catch {
    return false;
  }
}
var LINK_BATCH_SIZE = 500;
async function syncEntries(fs, entries, options, candidatePaths) {
  const maxFileSizeBytes = resolveMaxSyncFileSizeBytes(options);
  const result = {
    totalFiles: entries.length,
    parsedNodes: 0,
    skippedFiles: 0,
    deletedNodes: 0,
    errors: [],
    durationMs: 0
  };
  const allCandidatePaths = candidatePaths ?? entries.map((e) => e.path);
  const pendingLinks = [];
  const pendingNodes = [];
  const isFullSync = candidatePaths !== void 0;
  const NODE_BATCH_SIZE = 200;
  async function flushNodes() {
    if (pendingNodes.length === 0) return;
    const batch = pendingNodes.splice(0);
    const { conflicts } = await bulkUpsertNodes(batch);
    if (conflicts.length > 0) {
      result.errors.push(...conflicts.map((conflict) => ({
        path: conflict.filePath,
        error: formatNodeKeyConflictError(conflict)
      })));
    }
  }
  async function flushLinks() {
    if (pendingLinks.length === 0) return;
    if (isFullSync) {
      await bulkUpsertLinks(pendingLinks.splice(0));
    } else {
      const bySource = /* @__PURE__ */ new Map();
      for (const link of pendingLinks.splice(0)) {
        const existing = bySource.get(link.sourceFilePath);
        if (existing) existing.push(link);
        else bySource.set(link.sourceFilePath, [link]);
      }
      for (const [source, links] of bySource) {
        await replaceLinksForFile(source, links);
      }
    }
  }
  for (const entry of entries) {
    try {
      if (entry.size > maxFileSizeBytes) {
        result.skippedFiles++;
        continue;
      }
      const content = await fs.read(entry.path);
      if (!hasFrontmatter(content)) {
        result.skippedFiles++;
        continue;
      }
      const note = parseNote(content);
      if (!note) {
        result.skippedFiles++;
        continue;
      }
      const record = frontmatterToRecord(note.frontmatter, entry.path, note.body);
      pendingNodes.push(record);
      result.parsedNodes++;
      const extracted = extractLinksFromContentBlock(content, entry.path, allCandidatePaths);
      for (const link of extracted) {
        pendingLinks.push({
          sourceFilePath: entry.path,
          targetFilePath: link.targetFilePath,
          linkType: link.linkType,
          rawText: link.rawText
        });
      }
      if (pendingNodes.length >= NODE_BATCH_SIZE) {
        await flushNodes();
      }
      if (pendingLinks.length >= LINK_BATCH_SIZE) {
        await flushLinks();
      }
    } catch (err) {
      result.errors.push({
        path: entry.path,
        error: err instanceof Error ? err.message : String(err)
      });
    }
  }
  await flushNodes();
  await flushLinks();
  return result;
}
function formatNodeKeyConflictError(conflict) {
  return `Duplicate YAML key "${conflict.key}" conflicts with "${conflict.conflictingFilePath}". Node keys must be unique.`;
}
function frontmatterToRecord(fm, filePath, body) {
  const { metadata, metadataKeys, metadataText } = extractGenericMetadata(fm);
  const bodySections = parseOrganizerBodySections(body);
  const yamlComments = Array.isArray(fm.comments) ? fm.comments.map((comment) => ({
    text: comment.text,
    added_at: comment.added_at,
    added_by: comment.added_by
  })) : [];
  return {
    uuid: fm.uuid,
    key: fm.key,
    title: fm.title,
    type: fm.type,
    level: fm.level,
    parent: fm.parent,
    parentUuid: fm.parent_uuid,
    parentType: fm.parent_type,
    filePath,
    projectRoot: fm.project_root,
    ticket: typeof fm.ticket === "string" ? fm.ticket : void 0,
    description: bodySections.description ?? (typeof fm.description === "string" ? fm.description : void 0),
    comments: bodySections.comments.length > 0 ? bodySections.comments : yamlComments.length > 0 ? yamlComments : void 0,
    epicCompletedAt: typeof fm.epic_completed_at === "string" ? fm.epic_completed_at : void 0,
    sortOrder: typeof fm.sort_order === "number" && Number.isFinite(fm.sort_order) ? fm.sort_order : void 0,
    taskId: typeof fm.task_id === "string" ? fm.task_id : void 0,
    taskStatus: typeof fm.task_status === "string" ? fm.task_status : void 0,
    dependsOn: Array.isArray(fm.depends_on) ? fm.depends_on.filter(Boolean) : void 0,
    blockedBy: Array.isArray(fm.blocked_by) ? fm.blocked_by.filter(Boolean) : void 0,
    acceptanceCriteria: Array.isArray(fm.acceptance_criteria) ? fm.acceptance_criteria.filter(Boolean) : void 0,
    owner: typeof fm.owner === "string" ? fm.owner : void 0,
    runId: typeof fm.run_id === "string" ? fm.run_id : void 0,
    sessionId: typeof fm.session_id === "string" ? fm.session_id : void 0,
    agentName: typeof fm.agent_name === "string" ? fm.agent_name : void 0,
    model: typeof fm.model === "string" ? fm.model : void 0,
    startedAt: typeof fm.started_at === "string" ? fm.started_at : void 0,
    endedAt: typeof fm.ended_at === "string" ? fm.ended_at : void 0,
    result: typeof fm.result === "string" ? fm.result : void 0,
    sourceRepo: typeof fm.source_repo === "string" ? fm.source_repo : void 0,
    branch: typeof fm.branch === "string" ? fm.branch : void 0,
    commit: typeof fm.commit === "string" ? fm.commit : void 0,
    artifacts: Array.isArray(fm.artifacts) ? fm.artifacts.filter(Boolean) : void 0,
    relatedNodes: Array.isArray(fm.related_nodes) ? fm.related_nodes.filter(Boolean) : void 0,
    schemaVersion: fm.schema_version != null ? String(fm.schema_version) : void 0,
    recordKind: typeof fm.record_kind === "string" ? fm.record_kind : void 0,
    stateHistory: Array.isArray(fm.state_history) ? fm.state_history.map((entry) => ({ ...entry })) : void 0,
    metadata,
    metadataKeys,
    metadataText,
    tags: fm.tags ?? [],
    projectPresetTags: fm.project_preset_tags ?? [],
    status: fm.status,
    priority: fm.priority,
    progress: fm.progress,
    createdAt: fm.created_at,
    updatedAt: fm.updated_at,
    aiSummary: fm.ai_summary,
    bodyExcerpt: body.slice(0, 200).trim() || void 0
  };
}
var KNOWN_FRONTMATTER_KEYS = /* @__PURE__ */ new Set([
  "uuid",
  "key",
  "title",
  "type",
  "level",
  "parent",
  "parent_uuid",
  "parent_type",
  "tags",
  "project_preset_tags",
  "categories",
  "progress",
  "status",
  "priority",
  "created_at",
  "updated_at",
  "ai_summary",
  "ai_generated",
  "last_ai_update",
  "ai_suggestions",
  "excalidraw",
  "project_root",
  "ticket",
  "description",
  "comments",
  "epic_completed_at",
  "sort_order",
  "task_id",
  "task_status",
  "depends_on",
  "blocked_by",
  "acceptance_criteria",
  "owner",
  "run_id",
  "session_id",
  "agent_name",
  "model",
  "started_at",
  "ended_at",
  "result",
  "source_repo",
  "branch",
  "commit",
  "artifacts",
  "related_nodes",
  "schema_version",
  "record_kind",
  "state_history"
]);
function extractGenericMetadata(frontmatter) {
  const metadata = {};
  for (const [key, value] of Object.entries(frontmatter)) {
    if (KNOWN_FRONTMATTER_KEYS.has(key)) continue;
    if (value === void 0 || value === null || value === "") continue;
    metadata[key] = value;
  }
  const keys = Object.keys(metadata);
  if (keys.length === 0) return {};
  const metadataKeys = collectMetadataKeys2(metadata);
  const metadataText = buildMetadataText(metadata);
  return {
    metadata,
    metadataKeys,
    metadataText
  };
}
function collectMetadataKeys2(metadata) {
  const out = /* @__PURE__ */ new Set();
  walkMetadata("", metadata, (path3) => out.add(path3));
  return [...out];
}
function buildMetadataText(metadata) {
  const out = [];
  walkMetadata("", metadata, (path3, value) => {
    out.push(path3);
    if (value !== null && value !== void 0 && typeof value !== "object") {
      out.push(String(value));
    }
  });
  return out.join(" ").toLowerCase();
}
function walkMetadata(prefix, value, visitor) {
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i += 1) {
      const path3 = prefix ? `${prefix}[${i}]` : `[${i}]`;
      visitor(path3, value[i]);
      walkMetadata(path3, value[i], visitor);
    }
    return;
  }
  if (value && typeof value === "object") {
    const record = value;
    for (const [key, inner] of Object.entries(record)) {
      const path3 = prefix ? `${prefix}.${key}` : key;
      visitor(path3, inner);
      walkMetadata(path3, inner, visitor);
    }
  }
}

// src/services/lego_blocks/integrations/yamlHierarchyBlock.ts
var TYPE_FOLDERS2 = {
  program: "programs",
  epic: "epics",
  idea_bucket: "idea_buckets",
  idea: "ideas",
  thought_bucket: "thought_buckets",
  thought: "thoughts",
  task: "tasks",
  run: "runs",
  handoff: "handoffs"
};
var TYPE_TICKET_CODES = {
  program: "P",
  epic: "E",
  idea_bucket: "IB",
  idea: "I",
  thought_bucket: "TB",
  thought: "T",
  task: "T",
  run: "R",
  handoff: "H"
};
async function createYamlNode(params) {
  const fs = params.fs ?? getVaultFS();
  const projectRoot = await resolveProjectRoot({
    explicitProjectRoot: params.projectRoot,
    parentKey: params.parentKey,
    fs
  });
  const programCode = await resolveProgramCode({
    type: params.type,
    title: params.title,
    parentKey: params.parentKey
  });
  const ticket = projectRoot ? await generateProjectTicket(projectRoot, programCode, params.type) : void 0;
  const note = createNote({
    type: params.type,
    title: params.title,
    parent: params.parentKey,
    parent_uuid: params.parentUuid,
    parent_type: params.parentType,
    tags: params.tags,
    body: params.body
  });
  const description = params.description?.trim();
  const comments = normalizeCommentEntries(params.comments);
  if (description) {
    note.frontmatter.description = description;
  }
  if (description || comments.length > 0) {
    note.body = upsertOrganizerBodySections(note.body, {
      description,
      comments
    });
  } else if (!note.body.trim()) {
    note.body = "";
  }
  delete note.frontmatter.comments;
  applyExtraFrontmatterFields(note.frontmatter, params.extraFields);
  if (projectRoot) {
    note.frontmatter.project_root = projectRoot;
    note.frontmatter.ticket = ticket;
    if (ticket) {
      note.frontmatter.title = prependTicketToTitle(ticket, note.frontmatter.title);
      const keyFromTitle = generateKey(note.frontmatter.title);
      if (keyFromTitle) {
        note.frontmatter.key = keyFromTitle;
      }
    }
  }
  const filename = suggestFilename(note.frontmatter);
  let folder;
  if (projectRoot) {
    folder = getProjectStoragePath(projectRoot, params.type);
  } else {
    folder = TYPE_FOLDERS2[params.type];
  }
  const filePath = `${folder}/${filename}`;
  try {
    await fs.mkdir(folder);
  } catch {
  }
  const content = stringifyNote(note);
  await fs.write(filePath, content);
  await syncSingleFile(filePath, fs);
  const record = await getNodeByKey(note.frontmatter.key);
  if (!record) throw new Error(`Failed to sync created node: ${note.frontmatter.key}`);
  return record;
}
async function renameYamlNode(uuid, newTitle, fs) {
  const vaultFs = fs ?? getVaultFS();
  const record = await getNodeByUuid(uuid);
  if (!record) throw new Error(`Node not found: ${uuid}`);
  const content = await vaultFs.read(record.filePath);
  const note = parseNote(content);
  if (!note) throw new Error(`Failed to parse YAML for: ${record.filePath}`);
  note.frontmatter.title = newTitle;
  note.frontmatter.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  await vaultFs.write(record.filePath, stringifyNote(note));
  await syncSingleFile(record.filePath, vaultFs);
  const updated = await getNodeByUuid(uuid);
  if (!updated) throw new Error(`Failed to sync renamed node: ${uuid}`);
  return updated;
}
async function updateYamlNode(uuid, updates, fs) {
  const vaultFs = fs ?? getVaultFS();
  const record = await getNodeByUuid(uuid);
  if (!record) throw new Error(`Node not found: ${uuid}`);
  const content = await vaultFs.read(record.filePath);
  const note = parseNote(content);
  if (!note) throw new Error(`Failed to parse YAML for: ${record.filePath}`);
  if (updates.type !== void 0) {
    note.frontmatter.type = updates.type;
    note.frontmatter.level = NODE_TYPE_LEVEL[updates.type];
  }
  if (updates.title !== void 0) note.frontmatter.title = updates.title;
  if (updates.tags !== void 0) note.frontmatter.tags = updates.tags;
  if (updates.projectPresetTags !== void 0) note.frontmatter.project_preset_tags = updates.projectPresetTags;
  if (updates.status !== void 0) note.frontmatter.status = updates.status;
  if (updates.priority !== void 0) note.frontmatter.priority = updates.priority;
  if (updates.description !== void 0) {
    const normalizedDescription = updates.description.trim();
    if (normalizedDescription) note.frontmatter.description = normalizedDescription;
    else delete note.frontmatter.description;
  }
  const shouldSyncBodySections = updates.description !== void 0 || updates.comments !== void 0 || Array.isArray(note.frontmatter.comments);
  if (shouldSyncBodySections) {
    const parsedSections = parseOrganizerBodySections(note.body);
    const fallbackYamlComments = normalizeCommentEntries(
      Array.isArray(note.frontmatter.comments) ? note.frontmatter.comments : void 0
    );
    const currentDescription = parsedSections.description ?? (typeof note.frontmatter.description === "string" ? note.frontmatter.description.trim() : void 0);
    const currentComments = parsedSections.comments.length > 0 ? parsedSections.comments : fallbackYamlComments;
    const nextDescription = updates.description !== void 0 ? updates.description.trim() || void 0 : currentDescription;
    const nextComments = updates.comments !== void 0 ? normalizeCommentEntries(updates.comments) : currentComments;
    note.body = upsertOrganizerBodySections(note.body, {
      description: nextDescription,
      comments: nextComments
    });
  }
  delete note.frontmatter.comments;
  if (updates.extraFields !== void 0) {
    applyExtraFrontmatterFields(note.frontmatter, updates.extraFields);
  }
  note.frontmatter.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  await vaultFs.write(record.filePath, stringifyNote(note));
  await syncSingleFile(record.filePath, vaultFs);
  const updated = await getNodeByUuid(uuid);
  if (!updated) throw new Error(`Failed to sync updated node: ${uuid}`);
  return updated;
}
async function moveYamlNode(uuid, newParentKey, fs) {
  const vaultFs = fs ?? getVaultFS();
  const record = await getNodeByUuid(uuid);
  if (!record) throw new Error(`Node not found: ${uuid}`);
  const content = await vaultFs.read(record.filePath);
  const note = parseNote(content);
  if (!note) throw new Error(`Failed to parse YAML for: ${record.filePath}`);
  if (newParentKey) {
    const parentRecord = await getNodeByKey(newParentKey);
    if (!parentRecord) throw new Error(`Parent not found: ${newParentKey}`);
    note.frontmatter.parent = parentRecord.key;
    note.frontmatter.parent_uuid = parentRecord.uuid;
    note.frontmatter.parent_type = parentRecord.type;
    const projectRoot = await resolveProjectRoot({
      parentKey: parentRecord.key,
      fs: vaultFs
    });
    if (projectRoot) note.frontmatter.project_root = projectRoot;
    else delete note.frontmatter.project_root;
  } else {
    delete note.frontmatter.parent;
    delete note.frontmatter.parent_uuid;
    delete note.frontmatter.parent_type;
    if (note.frontmatter.type !== "program") {
      delete note.frontmatter.project_root;
    }
  }
  note.frontmatter.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  await vaultFs.write(record.filePath, stringifyNote(note));
  await syncSingleFile(record.filePath, vaultFs);
  const updated = await getNodeByUuid(uuid);
  if (!updated) throw new Error(`Failed to sync moved node: ${uuid}`);
  return updated;
}
async function deleteYamlNode(uuid, fs) {
  void fs;
  const record = await getNodeByUuid(uuid);
  if (!record) return;
  try {
  } catch {
  }
  await deleteNode(uuid);
}
async function listYamlChildren(parentKey) {
  return getChildren(parentKey);
}
async function listYamlRootNodes(typeFilter) {
  const roots = await getRootNodes();
  if (!typeFilter) return roots;
  return roots.filter((n) => n.type === typeFilter);
}
async function getYamlNode(uuid) {
  return getNodeByUuid(uuid);
}
async function getYamlNodeByKey(key) {
  return getNodeByKey(key);
}
async function readYamlFrontmatterByPath(filePath, fs) {
  const vaultFs = fs ?? getVaultFS();
  const content = await vaultFs.read(filePath);
  const note = parseNote(content);
  if (!note) return null;
  return note.frontmatter;
}
async function listAllYamlNodes() {
  return getAllNodes();
}
async function searchYamlNodes(query, limit) {
  return searchNodes(query, limit);
}
async function resolveProjectRoot(params) {
  const explicit = normalizeProjectRoot(params.explicitProjectRoot);
  if (explicit) return explicit;
  const parentKey = params.parentKey?.trim();
  if (!parentKey) return void 0;
  const parentRecord = await getNodeByKey(parentKey);
  if (!parentRecord) return void 0;
  const cached = normalizeProjectRoot(parentRecord.projectRoot);
  if (cached) return cached;
  const parsed = await readProjectRootFromFile(parentRecord.filePath, params.fs);
  return normalizeProjectRoot(parsed);
}
async function generateProjectTicket(projectRoot, programCode, type2) {
  const projectCode = deriveProjectCode(projectRoot);
  const normalizedProgramCode = normalizeTicketToken(programCode, "PG");
  const typeCode = TYPE_TICKET_CODES[type2];
  const prefix = `${projectCode}-${normalizedProgramCode}-${typeCode}-`;
  const allNodes = await getAllNodes();
  const existing = new Set(
    allNodes.filter((node) => normalizeProjectRoot(node.projectRoot) === normalizeProjectRoot(projectRoot)).map((node) => typeof node.ticket === "string" ? node.ticket : "").filter(Boolean)
  );
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const suffix = String(Math.floor(100 + Math.random() * 900));
    const ticket = `${prefix}${suffix}`;
    if (!existing.has(ticket)) return ticket;
  }
  return `${prefix}${Date.now().toString().slice(-3)}`;
}
function deriveProjectCode(projectRoot) {
  const normalized = normalizeProjectRoot(projectRoot);
  if (!normalized) return "PR";
  const segment = normalized.split("/").filter(Boolean).pop() ?? normalized;
  const tokens = segment.split(/[-_\\s]+/).filter(Boolean);
  if (tokens.length >= 2) {
    return `${tokens[0][0] ?? ""}${tokens[1][0] ?? ""}`.toUpperCase();
  }
  const token = (tokens[0] ?? segment).replace(/[^a-zA-Z0-9]/g, "");
  if (!token) return "PR";
  if (token.length <= 3) return token.toUpperCase();
  const letter = token.match(/[A-Za-z]/)?.[0] ?? token[0];
  const digit = token.match(/[0-9]/)?.[0];
  if (letter && digit) return `${letter}${digit}`.toUpperCase();
  return token.slice(0, 2).toUpperCase();
}
async function resolveProgramCode(params) {
  if (params.type === "program") return deriveProgramCode(params.title);
  const parentKey = params.parentKey?.trim();
  if (!parentKey) return "PG";
  let cursor = await getNodeByKey(parentKey);
  for (let depth = 0; depth < 20 && cursor; depth += 1) {
    if (cursor.type === "program") {
      const codeFromTicket = deriveProgramCodeFromTicket(cursor.ticket);
      if (codeFromTicket) return codeFromTicket;
      return deriveProgramCode(cursor.key || cursor.title);
    }
    cursor = cursor.parent ? await getNodeByKey(cursor.parent) : void 0;
  }
  return "PG";
}
function deriveProgramCode(value) {
  const normalized = value.trim().toUpperCase();
  if (!normalized) return "PG";
  const tokens = normalized.replace(/[^A-Z0-9\s_-]/g, " ").split(/[\s_-]+/).filter(Boolean);
  if (tokens.length >= 2) {
    return `${tokens[0][0] ?? ""}${tokens[1][0] ?? ""}`.toUpperCase();
  }
  const single = tokens[0] ?? normalized;
  if (single.length <= 3) return single.toUpperCase();
  return single.slice(0, 3).toUpperCase();
}
function deriveProgramCodeFromTicket(ticket) {
  if (!ticket) return void 0;
  const match = ticket.trim().toUpperCase().match(/^[A-Z0-9]+-([A-Z0-9]+)-P-\d{3}$/);
  return match?.[1] || void 0;
}
function normalizeTicketToken(value, fallback) {
  const token = value.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  return token || fallback;
}
function prependTicketToTitle(ticket, title) {
  const trimmedTitle = title.trim();
  if (!trimmedTitle) return ticket;
  if (trimmedTitle.startsWith(`${ticket} `)) return trimmedTitle;
  if (trimmedTitle.startsWith(`${ticket} - `)) return trimmedTitle;
  return `${ticket} - ${trimmedTitle}`;
}
async function readProjectRootFromFile(filePath, fs) {
  try {
    const content = await fs.read(filePath);
    const note = parseNote(content);
    if (!note) return void 0;
    const raw = note.frontmatter.project_root;
    if (typeof raw !== "string") return void 0;
    return raw;
  } catch {
    return void 0;
  }
}
function normalizeProjectRoot(value) {
  if (!value) return void 0;
  const normalized = value.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
  return normalized || void 0;
}
function normalizeCommentEntries(comments) {
  if (!comments || comments.length === 0) return [];
  const now = (/* @__PURE__ */ new Date()).toISOString();
  return comments.map((comment) => normalizeSingleCommentEntry(comment, now)).filter((comment) => comment !== null);
}
function normalizeSingleCommentEntry(comment, now) {
  if (typeof comment === "string") {
    const text2 = comment.trim();
    if (!text2) return null;
    return {
      text: text2,
      added_at: now,
      added_by: "unknown"
    };
  }
  const text = comment.text?.trim() ?? "";
  if (!text) return null;
  const addedAt = comment.added_at?.trim();
  const addedBy = comment.added_by?.trim();
  return {
    text,
    added_at: addedAt || now,
    added_by: addedBy || "unknown"
  };
}
function applyExtraFrontmatterFields(frontmatter, extraFields) {
  if (!extraFields) return;
  const reserved = /* @__PURE__ */ new Set([
    "uuid",
    "key",
    "title",
    "type",
    "level",
    "parent",
    "parent_uuid",
    "parent_type",
    "tags",
    "project_preset_tags",
    "status",
    "priority",
    "project_root",
    "ticket",
    "description",
    "comments",
    "created_at",
    "updated_at"
  ]);
  for (const [key, value] of Object.entries(extraFields)) {
    if (!key.trim()) continue;
    if (reserved.has(key)) continue;
    if (value === void 0 || value === null || value === "") {
      delete frontmatter[key];
      continue;
    }
    if (key === "record_kind") {
      if (typeof value !== "string" || !ALLOWED_RECORD_KINDS.includes(value)) {
        throw new Error(`Invalid record_kind: ${String(value)}`);
      }
    }
    frontmatter[key] = value;
  }
}

// src/services/lego_blocks/units/userProfileBlock.ts
var USER_PROFILE_DIR_PATH_BLOCK = ".thinking-space";
var USER_PROFILE_FILE_PATH_BLOCK = `${USER_PROFILE_DIR_PATH_BLOCK}/profile.json`;
var DEFAULT_USER_NAME_BLOCK = "You";
function normalizeIsoTimestampBlock(value, fallback) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  if (!trimmed) return fallback;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return fallback;
  return parsed.toISOString();
}
function deriveUserProfileSymbolBlock(name) {
  const tokens = name.trim().split(/[\s._-]+/).filter(Boolean);
  if (tokens.length === 0) return DEFAULT_USER_NAME_BLOCK[0];
  const first = Array.from(tokens[0])[0];
  return (first ?? DEFAULT_USER_NAME_BLOCK[0]).toUpperCase();
}
function normalizeUserNameBlock(value) {
  if (typeof value !== "string") return DEFAULT_USER_NAME_BLOCK;
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) return DEFAULT_USER_NAME_BLOCK;
  return trimmed.slice(0, 72);
}
function normalizeUserSymbolBlock(value, fallbackName) {
  if (typeof value !== "string") return deriveUserProfileSymbolBlock(fallbackName);
  const trimmed = value.trim();
  if (!trimmed) return deriveUserProfileSymbolBlock(fallbackName);
  return Array.from(trimmed).slice(0, 2).join("");
}
function normalizeMemoriesBlock(value) {
  if (!Array.isArray(value)) return [];
  const seen = /* @__PURE__ */ new Set();
  const output = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const next = item.trim();
    if (!next) continue;
    const normalized = next.slice(0, 600);
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(normalized);
    if (output.length >= 200) break;
  }
  return output;
}
function getDefaultUserProfileBlock() {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  return {
    name: DEFAULT_USER_NAME_BLOCK,
    symbol: deriveUserProfileSymbolBlock(DEFAULT_USER_NAME_BLOCK),
    memories: [],
    createdAt: now,
    updatedAt: now
  };
}
function sanitizeUserProfileBlock(raw, previous) {
  const fallback = previous ?? getDefaultUserProfileBlock();
  const name = normalizeUserNameBlock(raw?.name ?? fallback.name);
  const symbol = normalizeUserSymbolBlock(raw?.symbol ?? fallback.symbol, name);
  const memories = normalizeMemoriesBlock(raw?.memories ?? fallback.memories);
  const createdAt = normalizeIsoTimestampBlock(raw?.createdAt ?? fallback.createdAt, fallback.createdAt);
  const updatedAt = normalizeIsoTimestampBlock(raw?.updatedAt ?? fallback.updatedAt, (/* @__PURE__ */ new Date()).toISOString());
  return {
    name,
    symbol,
    memories,
    createdAt,
    updatedAt
  };
}
function readCachedUserProfileBlock() {
  const raw = getJsonStorageItem(
    STORAGE_KEYS.userProfileCache,
    null
  );
  return sanitizeUserProfileBlock(raw);
}
function getUserCommentAuthorBlock() {
  return readCachedUserProfileBlock().name;
}

// src/services/orchestrators/thoughtsOrch.ts
async function createThought(params) {
  const fs = getVaultFS();
  const outputPath = `${params.folder_path}/${params.filename}`;
  const bodyParts = [];
  const customTitle = params.title?.trim() || "";
  const emotions = (params.emotions || []).filter((e) => e && e.trim());
  if (customTitle) {
    bodyParts.push(`# ${customTitle}`);
    bodyParts.push("");
  }
  if (params.date_header) {
    const today = /* @__PURE__ */ new Date();
    const dayName = today.toLocaleDateString("en-US", { weekday: "long" });
    const monthName = today.toLocaleDateString("en-US", { month: "long" });
    bodyParts.push(`*${dayName}, ${monthName} ${today.getDate()}, ${today.getFullYear()}*`);
    bodyParts.push("");
  }
  bodyParts.push(params.content);
  const noteTitle = customTitle || deriveTitleFromFilename(params.filename);
  const note = createNote({
    type: "thought",
    title: noteTitle,
    tags: emotions.length > 0 ? ["thought", ...emotions.map(emotionToTag)] : ["thought"],
    body: bodyParts.join("\n")
  });
  note.frontmatter.key = await ensureUniqueKeyForPath(outputPath, note.frontmatter.key);
  if (emotions.length > 0) {
    note.frontmatter.emotions = emotions;
  }
  await fs.mkdir(params.folder_path);
  await fs.create(outputPath, stringifyNote(note));
  await syncSingleFile(outputPath, fs);
  return { output_path: outputPath };
}
function deriveTitleFromFilename(filename) {
  const basename2 = filename.replace(/\.md$/i, "");
  const normalized = basename2.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  return normalized || "Untitled Note";
}
function emotionToTag(emotion) {
  const slug = generateKey(emotion.trim());
  return slug ? `emotion/${slug}` : "emotion/unknown";
}
async function ensureUniqueKeyForPath(filePath, suggested) {
  const fallback = generateKey(filePath) || "thought";
  const base = suggested || fallback;
  let candidate = base;
  let suffix = 2;
  while (suffix < 1e3) {
    const existing = await getNodeByKey(candidate);
    if (!existing || existing.filePath === filePath) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  throw new Error(`Could not generate a unique key for ${filePath}`);
}

// src/services/lego_blocks/integrations/todoScannerBlock.ts
var CHECKBOX_RE = /^- \[([ xX])\] (.+)$/;
async function toggleTodo(fs, filePath, lineNumber) {
  let resultText = "";
  let resultChecked = false;
  await fs.process(filePath, (content) => {
    const lines = content.split("\n");
    if (lineNumber < 1 || lineNumber > lines.length) {
      throw new Error(`Line ${lineNumber} out of range (file has ${lines.length} lines)`);
    }
    const line = lines[lineNumber - 1];
    const m = line.trim().match(CHECKBOX_RE);
    if (!m) throw new Error(`Line ${lineNumber} is not a checkbox line`);
    const leading = line.slice(0, line.length - line.trimStart().length);
    const wasChecked = m[1].toLowerCase() === "x";
    resultText = m[2].trim();
    resultChecked = !wasChecked;
    lines[lineNumber - 1] = wasChecked ? `${leading}- [ ] ${resultText}` : `${leading}- [x] ${resultText}`;
    return lines.join("\n");
  });
  return {
    text: resultText,
    checked: resultChecked,
    line: lineNumber,
    file: filePath
  };
}
async function createTodo(fs, folderPath, dateStr, items) {
  await fs.mkdir(folderPath);
  const filename = `${dateStr}.md`;
  const filePath = `${folderPath}/${filename}`;
  const newLines = items.filter((item) => item.trim()).map((item) => `- [ ] ${item.trim()}`);
  if (newLines.length === 0) throw new Error("No valid items provided");
  let content;
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const defaultTitle = `Todos ${dateStr}`;
  const todoKeyBase = generateKey(`${folderPath}-${dateStr}-todos`) || generateKey(`${dateStr}-todos`) || "todos";
  const fileExists = await fs.exists(filePath);
  if (fileExists) {
    const existing = await fs.read(filePath);
    const parsed = parseNote(existing);
    if (parsed) {
      const note = parsed;
      const fallback = createNote({
        type: "thought",
        title: defaultTitle,
        tags: ["todo"],
        body: ""
      });
      note.frontmatter.uuid = nonEmpty(note.frontmatter.uuid) || fallback.frontmatter.uuid;
      note.frontmatter.type = "thought";
      note.frontmatter.level = NODE_TYPE_LEVEL.thought;
      note.frontmatter.title = nonEmpty(note.frontmatter.title) ? note.frontmatter.title : defaultTitle;
      note.frontmatter.key = nonEmpty(note.frontmatter.key) ? note.frontmatter.key : todoKeyBase;
      note.frontmatter.status = note.frontmatter.status || "active";
      note.frontmatter.created_at = nonEmpty(note.frontmatter.created_at) ? note.frontmatter.created_at : fallback.frontmatter.created_at;
      note.frontmatter.updated_at = now;
      note.frontmatter.tags = [.../* @__PURE__ */ new Set([...note.frontmatter.tags ?? [], "todo"])];
      note.frontmatter.todo_date = dateStr;
      let body = note.body;
      if (body && !body.endsWith("\n")) body += "\n";
      note.body = body + newLines.join("\n") + "\n";
      content = stringifyNote(note);
    } else {
      let legacyBody = existing;
      if (legacyBody && !legacyBody.endsWith("\n")) legacyBody += "\n";
      const note = createNote({
        type: "thought",
        title: defaultTitle,
        tags: ["todo"],
        body: legacyBody + newLines.join("\n") + "\n"
      });
      note.frontmatter.key = todoKeyBase;
      note.frontmatter.todo_date = dateStr;
      content = stringifyNote(note);
    }
  } else {
    const note = createNote({
      type: "thought",
      title: defaultTitle,
      tags: ["todo"],
      body: newLines.join("\n") + "\n"
    });
    note.frontmatter.key = todoKeyBase;
    note.frontmatter.todo_date = dateStr;
    content = stringifyNote(note);
  }
  await fs.write(filePath, content);
  return {
    output_path: filePath,
    items_added: newLines.length,
    appended: fileExists
  };
}
function nonEmpty(value) {
  return typeof value === "string" && value.trim() ? value : "";
}

// src/services/orchestrators/todosOrch.ts
async function toggleTodo2(filePath, lineNumber) {
  const fs = getVaultFS();
  await toggleTodo(fs, filePath, lineNumber);
  await syncSingleFile(filePath, fs);
}
async function createTodos(folderPath, date, items) {
  const fs = getVaultFS();
  const result = await createTodo(fs, folderPath, date, items);
  await syncSingleFile(result.output_path, fs);
  return result;
}

// src/services/orchestrators/fileSystemOrch.ts
async function listFiles(limit) {
  const fs = getVaultFS();
  const files = (await fs.walkVault([".md"])).map((e) => e.path).filter((p) => !p.includes(".excalidraw")).sort();
  if (typeof limit === "number" && Number.isFinite(limit) && limit >= 0) {
    return files.slice(0, limit);
  }
  return files;
}
async function listFolders(limit = 1e3) {
  const fs = getVaultFS();
  const entries = await fs.walkVault([".md"]);
  const folderSet = /* @__PURE__ */ new Set();
  for (const entry of entries) {
    const parts = entry.path.split("/");
    for (let i = 1; i < parts.length; i++) {
      folderSet.add(parts.slice(0, i).join("/"));
    }
  }
  return [...folderSet].sort().slice(0, limit);
}
async function listPdfFiles(limit = 500) {
  const fs = getVaultFS();
  const entries = await fs.walkVault([".pdf"]);
  return entries.map((e) => e.path).sort().slice(0, limit);
}

// src/services/lego_blocks/units/formatExcalidrawBlock.ts
var PART_RE = /^PART\s+[IVXLC]+\s*$/i;
var CHAPTER_RE = /^(?:##\s*)?Chapter\s+(\d+)(?::\s*(.+))?$/i;
var CHAPTER_LINE_RE = /^CHAPTER\s+(\d+)\s*$/i;
var CHAPTER_MARKER_RE = /^(?:#{1,6}\s*)?CHAPTER\s+(\d+)\s*$/i;
var MARKDOWN_HEADING_RE = /^#{1,6}\s+(.+)$/;
var CHAPTER_SECTION_RE = /^##\s+Chapter\s+(\d+)(?::\s*(.+))?$/i;
var TRANSCRIPT_SECTION_RE = /^(?:\*\*|__)\s*(\d{1,3})[.)]\s+(.+?)\s*(?:\*\*|__)$/;
var CONTENTS_HEADING_RE = /^(?:#{1,6}\s*)?(?:table of contents|contents|index)\s*$/i;
var NOTES_HEADING_RE = /^#{1,6}\s+notes\b/i;
var INDEX_DOT_LEADER_RE = /\.{2,}\s*\d+\s*$/;
var CHAPTER_PART_WORD_LIMIT = 2e3;
function countWords(text) {
  const parts = text.trim().match(/\S+/g);
  return parts ? parts.length : 0;
}
function cleanChapterTitle(raw) {
  let title = raw.trim();
  title = title.replace(/\s*\.{2,}\s*\d+\s*$/, "");
  title = title.replace(/\s{2,}\d+\s*$/, "");
  return title.trim();
}
function stripHeadingPrefix(line) {
  const match = line.trim().match(MARKDOWN_HEADING_RE);
  return match ? match[1].trim() : line.trim();
}
function normalizeHeadingKey(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}
function findNextNonEmptyLine(lines, startIndex, maxLookahead = 8) {
  const limit = Math.min(lines.length, startIndex + maxLookahead + 1);
  for (let i = startIndex + 1; i < limit; i += 1) {
    const text = lines[i].trim();
    if (text) return { index: i, text };
  }
  return null;
}
function parseIndexChapterEntry(line) {
  const stripped = line.trim();
  if (!stripped) return null;
  const withoutMarker = stripHeadingPrefix(stripped).replace(/^[-*•]\s+/, "");
  let m = withoutMarker.match(/^Chapter\s+(\d+)\s*[:.\-–]?\s*(.+)$/i);
  if (m) {
    const chapterTitle = cleanChapterTitle(m[2] ?? "");
    if (chapterTitle) return { chapterNum: m[1], chapterTitle };
  }
  m = withoutMarker.match(/^(\d{1,3})[.)]\s+(.+)$/);
  if (m) {
    const chapterTitle = cleanChapterTitle(m[2] ?? "");
    if (chapterTitle) return { chapterNum: m[1], chapterTitle };
  }
  m = withoutMarker.match(/^(\d{1,3})\s+(.+)$/);
  if (m) {
    const chapterTitle = cleanChapterTitle(m[2] ?? "");
    if (chapterTitle && /^[A-Z]/.test(chapterTitle) && countWords(chapterTitle) <= 12 && !/[.!?]["'\u201d]?\s*$/.test(chapterTitle)) {
      return { chapterNum: m[1], chapterTitle };
    }
  }
  return null;
}
function parseTranscriptSectionEntry(line) {
  const match = line.trim().match(TRANSCRIPT_SECTION_RE);
  if (!match) return null;
  const chapterTitle = cleanChapterTitle(match[2] ?? "");
  if (!chapterTitle) return null;
  return {
    chapterNum: match[1],
    chapterTitle
  };
}
function hasTranscriptSectionStructure(lines) {
  let transcriptHeadingCount = 0;
  for (const line of lines) {
    if (!parseTranscriptSectionEntry(line)) continue;
    transcriptHeadingCount += 1;
    if (transcriptHeadingCount >= 2) return true;
  }
  return false;
}
function collectIndexChapterHints(lines) {
  const hints = /* @__PURE__ */ new Map();
  const contentsIndex = lines.findIndex((line) => CONTENTS_HEADING_RE.test(line.trim()));
  const hasContentsHeading = contentsIndex >= 0;
  const start = hasContentsHeading ? contentsIndex + 1 : 0;
  const limit = hasContentsHeading ? Math.min(lines.length, start + 500) : Math.min(lines.length, 400);
  for (let i = start; i < limit; i += 1) {
    const stripped = lines[i].trim();
    if (!stripped) continue;
    if (hasContentsHeading) {
      if (/^```/.test(stripped)) continue;
      const headingLevelMatch = stripped.match(/^(#{1,6})\s+/);
      if (headingLevelMatch && headingLevelMatch[1].length === 1) break;
    }
    let chapterEntry = parseIndexChapterEntry(stripped);
    if (!chapterEntry) {
      const chapterOnly = stripHeadingPrefix(stripped).match(/^Chapter\s+(\d+)\s*$/i);
      const nextContent = chapterOnly ? findNextNonEmptyLine(lines, i, 6) : null;
      if (chapterOnly && nextContent) {
        const maybeTitle = cleanChapterTitle(stripHeadingPrefix(nextContent.text));
        if (maybeTitle && !/^Chapter\s+\d+/i.test(maybeTitle)) {
          chapterEntry = { chapterNum: chapterOnly[1], chapterTitle: maybeTitle };
        }
      }
    }
    if (!chapterEntry) continue;
    const shouldTrustHint = hasContentsHeading || INDEX_DOT_LEADER_RE.test(stripped) || /^Chapter\s+\d+/i.test(stripHeadingPrefix(stripped));
    if (shouldTrustHint && !hints.has(chapterEntry.chapterNum)) {
      hints.set(chapterEntry.chapterNum, chapterEntry.chapterTitle);
    }
  }
  return hints;
}
function looksLikeChapterTitleCandidate(line) {
  const stripped = line.trim();
  if (!stripped) return false;
  if (stripped.startsWith("#")) return false;
  if (countWords(stripped) > 16) return false;
  if (/[.!?]["'\u201d]?\s*$/.test(stripped)) return false;
  return /[A-Za-z]/.test(stripped);
}
function looksLikeParagraph(text) {
  const wordCount = text.split(/\s+/).length;
  if (wordCount >= 18) return true;
  if (text.length >= 80) return true;
  if ((text.match(/\./g) || []).length >= 2) return true;
  if (text.length >= 50 && /[.]["'\u201d]?\s*$/.test(text)) return true;
  return false;
}
function demoteDeepHeadings(lines) {
  const out = [];
  for (const line of lines) {
    const m = line.trim().match(/^(#{4,})\s+(.+)$/);
    if (!m) {
      out.push(line);
      continue;
    }
    const content = m[2].trim();
    if (looksLikeParagraph(content)) {
      out.push(content);
    } else {
      out.push(line);
    }
  }
  return out;
}
function normalizeBookStructure(lines, chapterIndexHints) {
  const out = [];
  let i = 0;
  const n = lines.length;
  let inContentsSection = false;
  let inNotesSection = false;
  const chapterTitleToNumber = /* @__PURE__ */ new Map();
  const emittedChapterNumbers = /* @__PURE__ */ new Set();
  for (const [chapterNum, chapterTitle] of chapterIndexHints.entries()) {
    const key = normalizeHeadingKey(chapterTitle);
    if (key && !chapterTitleToNumber.has(key)) {
      chapterTitleToNumber.set(key, chapterNum);
    }
  }
  while (i < n) {
    const line = lines[i];
    const stripped = line.trim();
    if (CONTENTS_HEADING_RE.test(stripped)) {
      inContentsSection = true;
      i++;
      continue;
    }
    if (inContentsSection) {
      if (!stripped) {
        i++;
        continue;
      }
      const headingLevelMatch = stripped.match(/^(#{1,6})\s+/);
      if (headingLevelMatch) {
        const headingLevel = headingLevelMatch[1].length;
        if (headingLevel === 1 && !CONTENTS_HEADING_RE.test(stripped)) {
          inContentsSection = false;
        } else {
          i++;
          continue;
        }
      } else if (CHAPTER_LINE_RE.test(stripped)) {
        inContentsSection = false;
      } else if (parseIndexChapterEntry(stripped) || CHAPTER_MARKER_RE.test(stripped)) {
        i++;
        continue;
      } else if (/^```/.test(stripped)) {
        inContentsSection = false;
      } else {
        inContentsSection = false;
      }
      if (inContentsSection) {
        i++;
        continue;
      }
    }
    if (CHAPTER_MARKER_RE.test(stripped) && !CHAPTER_LINE_RE.test(stripped)) {
      if (stripped.startsWith("#")) {
        i++;
        continue;
      }
    }
    if (NOTES_HEADING_RE.test(stripped)) {
      inNotesSection = true;
      out.push(line);
      i++;
      continue;
    }
    if (inNotesSection) {
      out.push(line);
      i++;
      continue;
    }
    const transcriptSection = parseTranscriptSectionEntry(stripped);
    if (transcriptSection) {
      out.push(`
## ${transcriptSection.chapterNum} ${transcriptSection.chapterTitle}
`);
      emittedChapterNumbers.add(transcriptSection.chapterNum);
      i++;
      continue;
    }
    let m = stripped.match(CHAPTER_RE);
    if (!m) m = stripped.match(CHAPTER_LINE_RE);
    if (!m) m = stripped.match(CHAPTER_MARKER_RE);
    if (m) {
      const chapNum = m[1];
      let chapTitle = cleanChapterTitle(m.length >= 3 && m[2] ? m[2] : "");
      if (!chapTitle) {
        const nextContent = findNextNonEmptyLine(lines, i, 6);
        const nextLine = nextContent?.text ?? "";
        if (nextLine && !nextLine.toUpperCase().startsWith("CHAPTER") && !PART_RE.test(nextLine) && looksLikeChapterTitleCandidate(nextLine)) {
          chapTitle = cleanChapterTitle(nextLine);
          i = nextContent?.index ?? i;
        }
      }
      if (!chapTitle) {
        chapTitle = chapterIndexHints.get(chapNum) ?? "";
      }
      if (chapTitle) {
        out.push(`
## Chapter ${chapNum}: ${chapTitle}
`);
      } else {
        out.push(`
## Chapter ${chapNum}
`);
      }
      emittedChapterNumbers.add(chapNum);
      inContentsSection = false;
      i++;
      continue;
    }
    if (PART_RE.test(stripped)) {
      const partLine = stripped;
      let title = "";
      if (i + 1 < n) {
        const nextLine = lines[i + 1].trim();
        if (nextLine && !nextLine.toUpperCase().startsWith("CHAPTER")) {
          title = nextLine;
          i++;
        }
      }
      if (title) {
        out.push(`
---

# ${partLine}: ${title}
`);
      } else {
        out.push(`
---

# ${partLine}
`);
      }
      i++;
      continue;
    }
    const headingMatch = stripped.match(MARKDOWN_HEADING_RE);
    if (headingMatch) {
      const headingTitle = cleanChapterTitle(headingMatch[1]);
      const chapterNum = chapterTitleToNumber.get(normalizeHeadingKey(headingTitle));
      if (chapterNum && !emittedChapterNumbers.has(chapterNum)) {
        out.push(`
## Chapter ${chapterNum}: ${chapterIndexHints.get(chapterNum) ?? headingTitle}
`);
        emittedChapterNumbers.add(chapterNum);
        i++;
        continue;
      }
    }
    out.push(line);
    i++;
  }
  return out;
}
function stripStandaloneFences(lines) {
  return lines.filter((ln) => ln.trim() !== "```");
}
function cleanExcessNewlines(text) {
  return text.replace(/\n{4,}/g, "\n\n\n");
}
function autoDetectBook(lines) {
  if (hasTranscriptSectionStructure(lines)) return true;
  for (const line of lines) {
    const s = line.trim();
    if (PART_RE.test(s) || CHAPTER_RE.test(s) || CHAPTER_LINE_RE.test(s) || CHAPTER_MARKER_RE.test(s) || CONTENTS_HEADING_RE.test(s)) return true;
  }
  return false;
}
function normalizeBulletText(text) {
  let cleaned = text.trim();
  while (cleaned.startsWith("\u2022 ")) {
    cleaned = cleaned.slice(2).trim();
  }
  return cleaned;
}
function isParagraphEnd(line) {
  const stripped = line.trimEnd();
  if (!stripped) return false;
  return /[.!?]["'\u201c\u201d]?\s*$/.test(stripped);
}
function isParagraphStart(line) {
  const stripped = line.trim();
  if (!stripped) return false;
  return /^[A-Z]/.test(stripped);
}
function bulletizeParagraphs(lines, _splitLong, _joinLines) {
  const out = [];
  let para = [];
  function flushPara() {
    if (para.length === 0) return;
    let text = para.map((s) => s.trim()).filter(Boolean).join(" ");
    text = text.replace(/\s{2,}/g, " ").trim();
    if (text) {
      out.push(`\u2022 ${text}`);
      out.push("");
      out.push("");
    }
    para = [];
  }
  for (const line of lines) {
    const stripped = line.trim();
    if (!stripped) {
      flushPara();
      continue;
    }
    if (stripped === "---") {
      flushPara();
      out.push(line);
      continue;
    }
    if (stripped.startsWith("#")) {
      flushPara();
      out.push(line);
      continue;
    }
    if (/^(\s*)(?:-|\*|\d+\.)\s+.+$/.test(line)) {
      flushPara();
      const text = line.replace(/^(\s*)(?:-|\*|\d+\.)\s+/, "").trim();
      out.push(`\u2022 ${normalizeBulletText(text)}`);
      out.push("");
      out.push("");
      continue;
    }
    if (/^\s*\u2022\s+.+$/.test(line)) {
      flushPara();
      const text = line.replace(/^\s*\u2022\s+/, "").trim();
      out.push(`\u2022 ${normalizeBulletText(text)}`);
      out.push("");
      out.push("");
      continue;
    }
    if (para.length > 0 && isParagraphEnd(para[para.length - 1]) && isParagraphStart(stripped)) {
      flushPara();
    }
    para.push(line);
  }
  flushPara();
  return out;
}
function splitIntoWordSegments(text, maxWords) {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length <= maxWords) return [text.trim()];
  const segments = [];
  for (let i = 0; i < words.length; i += maxWords) {
    segments.push(words.slice(i, i + maxWords).join(" "));
  }
  return segments;
}
function trimBlankEdges(lines) {
  const out = [...lines];
  while (out.length > 0 && !out[0].trim()) out.shift();
  while (out.length > 0 && !out[out.length - 1].trim()) out.pop();
  return out;
}
function splitChapterBodyIntoChunks(lines, maxWords) {
  const chunks = [];
  let currentChunk = [];
  let currentWordCount = 0;
  function flushChunk() {
    const trimmed = trimBlankEdges(currentChunk);
    if (trimmed.length > 0) chunks.push(trimmed);
    currentChunk = [];
    currentWordCount = 0;
  }
  for (const line of lines) {
    const stripped = line.trim();
    if (!stripped) {
      if (currentChunk.length > 0 && currentChunk[currentChunk.length - 1] !== "") {
        currentChunk.push("");
      }
      continue;
    }
    if (stripped.startsWith("#") || stripped === "---") {
      currentChunk.push(line);
      continue;
    }
    const isBullet = stripped.startsWith("\u2022 ");
    const textBody = isBullet ? stripped.slice(2).trim() : stripped;
    const segments = splitIntoWordSegments(textBody, maxWords);
    for (const segment of segments) {
      const segmentWords = countWords(segment);
      if (segmentWords > 0 && currentWordCount > 0 && currentWordCount + segmentWords > maxWords) {
        flushChunk();
      }
      currentChunk.push(isBullet ? `\u2022 ${segment}` : segment);
      currentWordCount += segmentWords;
      if (isBullet) {
        currentChunk.push("");
        currentChunk.push("");
      }
    }
  }
  flushChunk();
  return chunks;
}
function splitChapterSections(lines, maxWordsPerPart) {
  const out = [];
  let i = 0;
  let inNotesSection = false;
  while (i < lines.length) {
    if (NOTES_HEADING_RE.test(lines[i].trim())) {
      inNotesSection = true;
      out.push(lines[i]);
      i++;
      continue;
    }
    if (inNotesSection) {
      out.push(lines[i]);
      i++;
      continue;
    }
    const chapterMatch = lines[i].trim().match(CHAPTER_SECTION_RE);
    if (!chapterMatch) {
      out.push(lines[i]);
      i++;
      continue;
    }
    const chapterNum = chapterMatch[1];
    out.push(lines[i]);
    i++;
    const chapterBody = [];
    while (i < lines.length && !lines[i].trim().match(CHAPTER_SECTION_RE)) {
      chapterBody.push(lines[i]);
      i++;
    }
    const parts = splitChapterBodyIntoChunks(chapterBody, maxWordsPerPart);
    const safeParts = parts.length > 0 ? parts : [[]];
    for (let partIndex = 0; partIndex < safeParts.length; partIndex += 1) {
      out.push(`### Chapter ${chapterNum} Part ${partIndex + 1}`);
      const body = safeParts[partIndex];
      if (body.length > 0) out.push(...body);
      if (partIndex < safeParts.length - 1) out.push("");
    }
  }
  return out;
}
function splitOversizedHeadingBlocks(lines, maxWordsPerPart) {
  const out = [];
  let i = 0;
  while (i < lines.length) {
    const headingLine = lines[i];
    const headingMatch = headingLine.trim().match(MARKDOWN_HEADING_RE);
    if (!headingMatch) {
      out.push(headingLine);
      i += 1;
      continue;
    }
    const levelMatch = headingLine.trim().match(/^(#{1,6})\s+/);
    const headingLevel = levelMatch ? levelMatch[1].length : 1;
    const partHeadingLevel = Math.min(headingLevel + 1, 6);
    const headingText = headingMatch[1].trim();
    const partBaseTitle = headingText.replace(/\s+Part\s+\d+\s*$/i, "").trim() || headingText;
    i += 1;
    const body = [];
    while (i < lines.length && !lines[i].trim().match(MARKDOWN_HEADING_RE)) {
      body.push(lines[i]);
      i += 1;
    }
    const bodyWordCount = body.reduce((sum, line) => {
      const stripped = line.trim();
      if (!stripped || stripped === "---") return sum;
      const normalized = stripped.startsWith("\u2022 ") ? stripped.slice(2).trim() : stripped;
      return sum + countWords(normalized);
    }, 0);
    out.push(headingLine);
    if (bodyWordCount <= maxWordsPerPart) {
      out.push(...body);
      continue;
    }
    const chunks = splitChapterBodyIntoChunks(body, maxWordsPerPart);
    const safeChunks = chunks.length > 0 ? chunks : [[]];
    const partPrefix = "#".repeat(partHeadingLevel);
    for (let partIndex = 0; partIndex < safeChunks.length; partIndex += 1) {
      out.push(`${partPrefix} ${partBaseTitle} Part ${partIndex + 1}`);
      const chunkLines = safeChunks[partIndex];
      if (chunkLines.length > 0) out.push(...chunkLines);
      if (partIndex < safeChunks.length - 1) out.push("");
    }
  }
  return out;
}
function formatMarkdown(text, options) {
  let lines = text.split("\n");
  if (options.strip_fences) {
    lines = stripStandaloneFences(lines);
  }
  const shouldNormalize = options.normalize_book && autoDetectBook(lines);
  if (shouldNormalize) {
    const chapterIndexHints = collectIndexChapterHints(lines);
    lines = normalizeBookStructure(lines, chapterIndexHints);
    lines = lines.join("\n").split("\n");
  }
  lines = demoteDeepHeadings(lines);
  lines = bulletizeParagraphs(lines, options.split_long_paragraphs, options.join_lines);
  lines = splitChapterSections(lines, CHAPTER_PART_WORD_LIMIT);
  lines = splitOversizedHeadingBlocks(lines, CHAPTER_PART_WORD_LIMIT);
  let result = lines.join("\n");
  result = cleanExcessNewlines(result);
  if (!result.endsWith("\n")) result += "\n";
  return result;
}

// src/services/orchestrators/formatExcalidrawOrch.ts
async function previewFormat(inputPath, options) {
  const fs = getVaultFS();
  const content = await fs.read(inputPath);
  const formatted = formatMarkdown(content, options);
  return {
    original: content,
    formatted,
    original_lines: content.split("\n").length,
    formatted_lines: formatted.split("\n").length
  };
}
async function formatAndSave(inputPath, options) {
  const fs = getVaultFS();
  const content = await fs.read(inputPath);
  const formatted = formatMarkdown(content, options);
  const lastSlash = inputPath.lastIndexOf("/");
  const dir = lastSlash >= 0 ? inputPath.slice(0, lastSlash) : "";
  const filename = lastSlash >= 0 ? inputPath.slice(lastSlash + 1) : inputPath;
  const stem = filename.replace(/\.md$/, "");
  const outputPath = dir ? `${dir}/${stem} (formatted for excalidraw).md` : `${stem} (formatted for excalidraw).md`;
  await fs.write(outputPath, formatted);
  return {
    success: true,
    output_path: outputPath,
    message: `Formatted successfully: ${stem} (formatted for excalidraw).md`
  };
}

// src/services/orchestrators/pdfToMarkdownOrch.ts
function toolsApiUrl(path3) {
  const base = globalThis.__LTM_API_BASE__;
  if (base) return `${base}${path3}`;
  return path3;
}
async function previewPdf(inputPath, options) {
  const res = await fetch(toolsApiUrl("/api/tools/pdf-to-markdown/preview"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input_path: inputPath, options })
  });
  if (!res.ok) throw new Error("Failed to load preview");
  return res.json();
}
async function convertPdf(inputPath, options) {
  const res = await fetch(toolsApiUrl("/api/tools/pdf-to-markdown"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ input_path: inputPath, options })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Conversion failed");
  return data;
}

// src/services/lego_blocks/units/transcriptCleanerBlock.ts
var HEADING_LINE_RE = /^(?:\d{1,2}:)?\d{1,2}:\d{2}\s+.+$/;
var TIMESTAMP_LINE_RE = /^\(([^)]+)\):\s*(.*)$/;
var TIMESTAMP_ONLY_LINE_RE = /^((?:\d{1,2}:)?\d{1,2}:\d{2})\s*$/;
var COMPACT_TIMESTAMP_LINE_RE = /^((?:\d{1,2}:)?\d{1,2}:\d{2})(.*)$/;
var INLINE_TIMESTAMP_RE = /^\s*(?:\(\s*[^)]+\s*\)|\d{1,2}:\d{2}:\d{2}|\d{1,2}:\d{2})\s*:?\s*/;
var COMPACT_TIMESTAMP_FRAGMENT_RE = /(^|[\s([{"'“‘.,!?;:-])(?:((?:\d{1,2}:)?\d{1,2}:\d{2})(?:\d{1,4}\s*seconds?)?)(?=[A-Za-z])/g;
var TIMESTAMP_ANY_RE = /\(\s*\d+\s*h\s*\d+\s*m\s*\d+\s*s\s*\)|\(\s*\d+\s*m\s*\d+\s*s\s*\)|\(\s*\d+\s*s\s*\)|\b\d{1,2}:\d{2}:\d{2}\b|\b\d{1,2}:\d{2}\b/g;
function parseTimeToSeconds(value) {
  const v = value.trim();
  if (!v) return null;
  if (v.includes(":")) {
    const parts = v.split(":");
    const nums = parts.map(Number);
    if (nums.some(isNaN)) return null;
    if (nums.length === 3) return nums[0] * 3600 + nums[1] * 60 + nums[2];
    if (nums.length === 2) return nums[0] * 60 + nums[1];
    return nums[0];
  }
  if (/[a-zA-Z]/.test(v)) {
    let h = 0, m = 0, s = 0;
    const hMatch = v.match(/(\d+)\s*h/);
    if (hMatch) h = parseInt(hMatch[1], 10);
    const mMatch = v.match(/(\d+)\s*m/);
    if (mMatch) m = parseInt(mMatch[1], 10);
    const sMatch = v.match(/(\d+)\s*s/);
    if (sMatch) s = parseInt(sMatch[1], 10);
    return h * 3600 + m * 60 + s;
  }
  if (/^\d+$/.test(v)) return parseInt(v, 10);
  return null;
}
function stripRepeatedDurationPrefix(raw) {
  let next = raw.replace(/^[\s:,-]+/, "");
  const repeatedDurationMatch = next.match(/^(\d{1,4})(?:\s*)seconds?/i);
  if (repeatedDurationMatch) {
    next = next.slice(repeatedDurationMatch[0].length);
  }
  return next.replace(/^[\s:,-]+/, "");
}
function parseCompactTimestampLine(line) {
  const match = line.match(COMPACT_TIMESTAMP_LINE_RE);
  if (!match) return null;
  const timestamp2 = parseTimeToSeconds(match[1] ?? "");
  if (timestamp2 === null) return null;
  return {
    timestamp: timestamp2,
    remainder: stripRepeatedDurationPrefix(match[2] ?? "")
  };
}
function stripTimestampFragments(raw) {
  let next = raw.replace(COMPACT_TIMESTAMP_FRAGMENT_RE, "$1");
  next = next.replace(TIMESTAMP_ANY_RE, "");
  return next.replace(/\s{2,}/g, " ").trim();
}
function extractHeadingLines(lines) {
  const headingLines = [];
  const contentLines = [...lines];
  let i = lines.length - 1;
  while (i >= 0 && !lines[i].trim()) i--;
  while (i >= 0) {
    const line = lines[i].trim();
    if (!line) {
      i--;
      continue;
    }
    if (HEADING_LINE_RE.test(line)) {
      headingLines.push(lines[i]);
      i--;
      continue;
    }
    break;
  }
  if (headingLines.length > 0) {
    headingLines.reverse();
    return [lines.slice(0, i + 1), headingLines];
  }
  let j = 0;
  while (j < lines.length && !lines[j].trim()) j++;
  const topHeadingLines = [];
  while (j < lines.length && HEADING_LINE_RE.test(lines[j].trim())) {
    topHeadingLines.push(lines[j]);
    j++;
  }
  if (topHeadingLines.length > 0) {
    while (j < lines.length && !lines[j].trim()) j++;
    const remaining = lines.slice(j);
    const hasTimestampBlocks = remaining.some((line) => {
      const trimmed = line.trim();
      return TIMESTAMP_LINE_RE.test(trimmed) || TIMESTAMP_ONLY_LINE_RE.test(trimmed) || parseCompactTimestampLine(trimmed) !== null;
    });
    if (hasTimestampBlocks) return [remaining, topHeadingLines];
  }
  return [contentLines, headingLines];
}
function parseHeadingMap(headingLines) {
  const headings = /* @__PURE__ */ new Map();
  for (const line of headingLines) {
    const parts = line.trim().split(/\s+(.+)/);
    if (parts.length < 2) continue;
    const ts = parts[0];
    const title = parts[1].trim();
    const seconds = parseTimeToSeconds(ts);
    if (seconds === null) continue;
    headings.set(seconds, title);
  }
  return headings;
}
function closestHeading(headings, timestamp2) {
  if (headings.has(timestamp2)) return [timestamp2, headings.get(timestamp2)];
  const earlier = [...headings.keys()].filter((t2) => t2 <= timestamp2);
  if (earlier.length === 0) return null;
  const t = Math.max(...earlier);
  return [t, headings.get(t)];
}
function cleanTranscript(transcriptText, headingsText, options) {
  const opts = options ?? { heading_level: 2 };
  const transcriptLines = transcriptText.split("\n");
  let contentLines;
  let headingLines;
  if (headingsText && headingsText.trim()) {
    headingLines = headingsText.split("\n");
    contentLines = transcriptLines;
  } else {
    ;
    [contentLines, headingLines] = extractHeadingLines(transcriptLines);
  }
  const headings = parseHeadingMap(headingLines);
  const blocks = [];
  let currentTs = null;
  let currentLines = [];
  function flush() {
    if (currentTs === null) {
      currentLines = [];
      return;
    }
    const textLines = currentLines.map((ln) => ln.trim()).filter(Boolean);
    blocks.push([currentTs, textLines]);
    currentLines = [];
  }
  for (const line of contentLines) {
    const trimmed = line.trim();
    const match = trimmed.match(TIMESTAMP_LINE_RE);
    if (match) {
      flush();
      const tsRaw = match[1];
      const remainder = match[2].trim();
      const tsSeconds = parseTimeToSeconds(tsRaw);
      currentTs = tsSeconds;
      if (remainder) currentLines.push(remainder);
      continue;
    }
    const tsOnlyMatch = trimmed.match(TIMESTAMP_ONLY_LINE_RE);
    if (tsOnlyMatch) {
      flush();
      currentTs = parseTimeToSeconds(tsOnlyMatch[1]);
      continue;
    }
    const compactMatch = parseCompactTimestampLine(trimmed);
    if (compactMatch) {
      flush();
      currentTs = compactMatch.timestamp;
      if (compactMatch.remainder) currentLines.push(compactMatch.remainder);
      continue;
    }
    if (currentTs === null) continue;
    const cleanedLine = line.replace(INLINE_TIMESTAMP_RE, "");
    currentLines.push(cleanedLine);
  }
  flush();
  const headingPrefix = "#".repeat(Math.max(1, Math.min(6, opts.heading_level)));
  const outputLines = [];
  let lastHeadingKey = null;
  for (const [ts, blockLines] of blocks) {
    const heading = closestHeading(headings, ts);
    const headingKey = heading ? heading[0] : null;
    let title = heading ? heading[1].trim() : "";
    title = stripTimestampFragments(title);
    if (!title) title = "Section";
    if (headingKey !== lastHeadingKey) {
      outputLines.push(`${headingPrefix} ${title}`);
      lastHeadingKey = headingKey;
    }
    if (blockLines.length > 0) {
      let paragraph = blockLines.join(" ");
      paragraph = stripTimestampFragments(paragraph);
      outputLines.push(`\u2022 ${paragraph}`);
    }
    outputLines.push("");
  }
  return outputLines.join("\n").trim() + "\n";
}

// src/services/orchestrators/transcriptCleanerOrch.ts
function previewTranscript(inputText, headingsText, options) {
  try {
    const preview = cleanTranscript(inputText, headingsText, options);
    return { success: true, output_path: null, preview, message: "OK" };
  } catch (err) {
    return {
      success: false,
      output_path: null,
      preview: "",
      message: err instanceof Error ? err.message : "Unknown error"
    };
  }
}
async function cleanAndSave(params) {
  const cleaned = cleanTranscript(params.input_text, params.headings_text, params.options);
  const fs = getVaultFS();
  const basePath = params.base_folder ? `${params.base_folder}/${params.output_folder}` : params.output_folder;
  await fs.mkdir(basePath);
  const outputPath = `${basePath}/${params.output_name}.md`;
  await fs.write(outputPath, cleaned);
  return {
    success: true,
    output_path: outputPath,
    preview: cleaned.slice(0, 2e3) + (cleaned.length > 2e3 ? "..." : ""),
    message: "Transcript cleaned and saved"
  };
}

// src/services/lego_blocks/integrations/capabilityFeatureFlagsBlock.ts
var DEFAULT_FLAGS = {
  agent_capabilities_enabled: false,
  fastapi_capability_adapter_enabled: false,
  extension_host_enabled: false,
  extension_builder_enabled: false
};
function getCapabilityFeatureFlags() {
  return getJsonStorageItem(
    STORAGE_KEYS.capabilityFeatureFlags,
    DEFAULT_FLAGS
  );
}

// src/services/lego_blocks/integrations/aiSynthesisInfraBlock.ts
var import_node_path = __toESM(require("node:path"), 1);

// src/services/lego_blocks/units/markdownFrontmatterBlock.ts
function splitMarkdownFrontmatterBlock(content) {
  const normalized = content.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  if (lines[0] !== "---") return { frontmatterBlock: "", body: normalized };
  let closingIndex = -1;
  for (let index = 1; index < lines.length; index += 1) {
    if (lines[index] === "---") {
      closingIndex = index;
      break;
    }
  }
  if (closingIndex < 0) return { frontmatterBlock: "", body: normalized };
  return {
    frontmatterBlock: `${lines.slice(0, closingIndex + 1).join("\n")}
`,
    body: lines.slice(closingIndex + 1).join("\n").replace(/^\n/, "")
  };
}
function parseMarkdownFrontmatterBlock(content) {
  const { frontmatterBlock, body } = splitMarkdownFrontmatterBlock(content);
  if (!frontmatterBlock) {
    return {
      frontmatter: {},
      body: content.replace(/\r\n/g, "\n"),
      hasFrontmatter: false
    };
  }
  const yamlText = frontmatterBlockToYamlText(frontmatterBlock);
  if (!yamlText.trim()) {
    return {
      frontmatter: {},
      body,
      hasFrontmatter: true
    };
  }
  const parsed = jsYaml.load(yamlText);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Frontmatter must be a YAML object.");
  }
  return {
    frontmatter: { ...parsed },
    body,
    hasFrontmatter: true
  };
}
function stringifyMarkdownFrontmatterBlock(note) {
  const normalizedBody = note.body.replace(/\r\n/g, "\n");
  const frontmatter = sanitizeFrontmatterBlock(note.frontmatter ?? {});
  const keys = Object.keys(frontmatter);
  if (keys.length === 0) return normalizedBody;
  const yamlText = jsYaml.dump(frontmatter, {
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    sortKeys: false
  }).trimEnd();
  const lines = ["---", yamlText, "---", ""];
  if (normalizedBody) lines.push(normalizedBody);
  return lines.join("\n");
}
function patchFrontmatterValuesBlock(currentFrontmatter, params) {
  const next = { ...currentFrontmatter };
  for (const [key, value] of Object.entries(params.set ?? {})) {
    if (value === void 0) continue;
    next[key] = value;
  }
  for (const [key, value] of Object.entries(params.appendUnique ?? {})) {
    if (!Array.isArray(value)) {
      throw new Error(`append_unique.${key} must be an array.`);
    }
    const existing = Array.isArray(next[key]) ? [...next[key]] : [];
    const seen = new Set(existing.map((item) => JSON.stringify(item)));
    for (const item of value) {
      const marker = JSON.stringify(item);
      if (seen.has(marker)) continue;
      existing.push(item);
      seen.add(marker);
    }
    next[key] = existing;
  }
  return next;
}
function sanitizeFrontmatterBlock(frontmatter) {
  const out = {};
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value === void 0) continue;
    out[key] = value;
  }
  return out;
}
function frontmatterBlockToYamlText(frontmatterBlock) {
  const normalized = frontmatterBlock.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  if (lines[0]?.trim() === "---") lines.shift();
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  if (lines[lines.length - 1]?.trim() === "---") lines.pop();
  while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
  return lines.join("\n");
}

// src/services/lego_blocks/integrations/aiSynthesisInfraBlock.ts
var AI_SYNTHESIS_ROOT = "AI Synthesis";
var REQUIRED_AI_SYNTHESIS_FIELDS = [
  "type",
  "domain",
  "layer",
  "synthesis_type",
  "derived_from",
  "last_compiled_at",
  "compile_status"
];
var CANONICAL_PAGES = [
  "AI Synthesis/index.md",
  "AI Synthesis/Reference/Concepts/core-concepts.md",
  "AI Synthesis/Experiential/Themes/current-patterns.md",
  "AI Synthesis/Operational/Active Focus/current-focus.md",
  "AI Synthesis/Integrated/Domain Overviews/current-state.md",
  "AI Synthesis/Questions/open-questions.md"
];
var LAYER_FOLDER_MAP = {
  reference: "Reference",
  experiential: "Experiential",
  operational: "Operational",
  integrated: "Integrated"
};
var SYNTHESIS_PATH_MAP = {
  source_summary: ["Reference", "Sources"],
  concept: ["Reference", "Concepts"],
  entity: ["Reference", "Entities"],
  theme: ["Reference", "Themes"],
  timeline: ["Reference", "Timelines"],
  comparison: ["Reference", "Themes"],
  pattern: ["Experiential", "Patterns"],
  belief_state: ["Experiential", "Beliefs"],
  tension: ["Experiential", "Tensions"],
  period_summary: ["Experiential", "Period Summaries"],
  theme_summary: ["Experiential", "Themes"],
  operational_summary: ["Operational", "Programs"],
  decision_summary: ["Operational", "Decisions"],
  focus_summary: ["Operational", "Active Focus"],
  blocker_summary: ["Operational", "Blockers"],
  integrated_memo: ["Integrated", "Bridges"],
  domain_state: ["Integrated", "Domain Overviews"],
  bridge_note: ["Integrated", "Bridges"],
  promotion_candidate: ["Integrated", "Promotion Candidates"],
  question: ["Questions"],
  map: ["Maps"],
  answer: ["Outputs", "Answers"]
};
var TEMPLATE_HEADINGS = {
  source_summary: ["Summary", "Key Ideas", "Important Entities", "Related Concepts", "Open Questions"],
  concept: ["What This Concept Is", "Why It Matters", "Supporting Notes", "Related Entities", "Open Questions"],
  entity: ["Who Or What This Is", "Why It Matters", "Related Concepts", "Supporting Notes", "Open Questions"],
  theme: ["Theme", "Why It Matters", "Supporting Notes", "Related Concepts", "Open Questions"],
  timeline: ["Timeline", "Important Moments", "Open Questions"],
  comparison: ["Compared Items", "Common Ground", "Important Differences", "Open Questions"],
  pattern: ["Pattern", "Evidence", "What Seems To Drive It", "Open Questions"],
  belief_state: ["Belief State", "Evidence", "Competing Views", "Open Questions"],
  tension: ["Tension", "Evidence", "Why It Matters", "Open Questions"],
  period_summary: ["Period Summary", "What Changed", "What Still Feels Open"],
  theme_summary: ["Theme Summary", "Evidence", "Why It Matters", "Open Questions"],
  operational_summary: ["Operational Summary", "Active Work", "Open Questions"],
  decision_summary: ["Decision Summary", "Inputs", "Decision State", "Open Questions"],
  focus_summary: ["Current Focus", "Active Threads", "Blockers", "Next Steps"],
  blocker_summary: ["Blocker", "Why It Matters", "Possible Unblocks"],
  integrated_memo: ["Summary", "Reference Context", "Experiential Context", "Operational Context", "Open Questions"],
  domain_state: ["What The World Says", "What Anurag Seems To Think", "What Is Active Right Now", "Tensions", "Open Questions", "Promotion Candidates"],
  bridge_note: ["Bridge", "Why These Notes Connect", "Implications", "Open Questions"],
  promotion_candidate: ["Candidate", "Why It Should Be Promoted", "Supporting Notes"],
  question: ["Question", "Why It Matters", "Related Notes", "Possible Next Step"],
  map: ["Map", "Important Nodes", "Important Connections"],
  answer: ["Answer", "Supporting Notes", "Follow-Up Questions"]
};
async function readNoteBlock(fs, notePath) {
  const normalizedPath = normalizeVaultPathBlock(notePath);
  if (!await fs.exists(normalizedPath)) {
    return {
      path: normalizedPath,
      exists: false,
      frontmatter: {},
      body: "",
      raw: ""
    };
  }
  const raw = await fs.read(normalizedPath);
  const parsed = parseMarkdownFrontmatterBlock(raw);
  return {
    path: normalizedPath,
    exists: true,
    frontmatter: parsed.frontmatter,
    body: parsed.body,
    raw
  };
}
async function writeNoteBlock(fs, input) {
  const normalizedPath = normalizeVaultPathBlock(input.path);
  const exists = await fs.exists(normalizedPath);
  if (exists && !input.overwrite) {
    throw new Error(`File already exists: ${normalizedPath}. Pass overwrite=true to replace it.`);
  }
  const body = (input.body ?? "").replace(/\r\n/g, "\n");
  const frontmatter = { ...input.frontmatter ?? {} };
  const raw = stringifyMarkdownFrontmatterBlock({ frontmatter, body });
  await fs.write(normalizedPath, raw);
  return {
    path: normalizedPath,
    written: true,
    created: !exists,
    frontmatter,
    body
  };
}
async function patchNoteFrontmatterBlock(fs, input) {
  const existing = await readNoteBlock(fs, input.path);
  if (!existing.exists) throw new Error(`Note not found: ${existing.path}`);
  const nextFrontmatter = patchFrontmatterValuesBlock(existing.frontmatter, {
    set: input.set,
    appendUnique: input.append_unique
  });
  const raw = stringifyMarkdownFrontmatterBlock({
    frontmatter: nextFrontmatter,
    body: existing.body
  });
  await fs.write(existing.path, raw);
  return {
    path: existing.path,
    patched: true,
    frontmatter: nextFrontmatter
  };
}
async function resolveAiSynthesisPathBlock(_fs, input) {
  const domainRoot = normalizeVaultPathBlock(input.domain_root);
  const folderSegments = resolveSynthesisFolderSegmentsBlock(input);
  const slug = normalizeSlugBlock(input.slug);
  if (!slug) throw new Error("slug is required");
  return {
    path: joinVaultPathBlock(domainRoot, AI_SYNTHESIS_ROOT, ...folderSegments, `${slug}.md`),
    domain_root: domainRoot,
    domain: domainSlugFromRootBlock(domainRoot)
  };
}
async function createAiSynthesisNoteBlock(fs, input) {
  const title = (input.title ?? "").trim() || buildDefaultTitleBlock(input.synthesis_type, input.slug);
  const slug = normalizeSlugBlock(input.slug || title);
  if (!slug) throw new Error("title or slug is required");
  const resolved = await resolveAiSynthesisPathBlock(fs, {
    domain_root: input.domain_root,
    layer: input.layer,
    synthesis_type: input.synthesis_type,
    source_title: input.source_title,
    concept_root: input.concept_root,
    concept_subpath: input.concept_subpath,
    slug
  });
  const ifExists = input.if_exists ?? "return_existing";
  const existing = await readNoteBlock(fs, resolved.path);
  if (existing.exists && ifExists === "return_existing") {
    return {
      created: false,
      path: existing.path,
      frontmatter: existing.frontmatter,
      body: existing.body
    };
  }
  if (existing.exists && ifExists === "error") {
    throw new Error(`AI synthesis note already exists: ${existing.path}`);
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const frontmatter = {
    title,
    type: "ai_synthesis",
    domain: resolved.domain,
    layer: input.layer,
    synthesis_type: input.synthesis_type,
    derived_from: uniqueStringsBlock(input.derived_from.map(normalizeVaultPathBlock)),
    last_compiled_at: now,
    compile_status: "stub",
    promotion_status: "none",
    related_notes: [],
    related_entities: [],
    related_concepts: [],
    coverage: [],
    open_questions: [],
    summary: ""
  };
  const body = renderTemplateBodyBlock(title, input.synthesis_type);
  await writeNoteBlock(fs, {
    path: resolved.path,
    frontmatter,
    body,
    overwrite: ifExists === "overwrite"
  });
  return {
    created: true,
    path: resolved.path,
    frontmatter,
    body
  };
}
async function getImpactedAiSynthesisNotesBlock(fs, input) {
  const changedPaths = uniqueStringsBlock(input.changed_paths.map(normalizeVaultPathBlock));
  if (changedPaths.length === 0) throw new Error("changed_paths is required");
  const resolvedRoots = await Promise.all(changedPaths.map((changedPath) => resolveDomainRootForPathBlock(fs, changedPath)));
  const domainRoots = uniqueStringsBlock(resolvedRoots.filter((value) => Boolean(value)));
  if (domainRoots.length !== 1) {
    throw new Error(`changed_paths must resolve to a single domain root. Got: ${domainRoots.join(", ") || "(none)"}`);
  }
  const domainRoot = domainRoots[0];
  const aiRoot = joinVaultPathBlock(domainRoot, AI_SYNTHESIS_ROOT);
  const notes = await listMarkdownNotesUnderBlock(fs, aiRoot);
  const impacted = /* @__PURE__ */ new Set();
  for (const note of notes) {
    const derivedFrom = normalizeStringArrayBlock(note.frontmatter.derived_from);
    if (derivedFrom.some((source) => changedPaths.includes(source))) {
      impacted.add(note.path);
      continue;
    }
    if (changedPaths.includes(note.path)) {
      impacted.add(note.path);
      continue;
    }
  }
  for (const changedPath of changedPaths) {
    const layer = await inferLayerForPathBlock(fs, changedPath);
    const canonicalForLayer = layer ? canonicalPagesForLayerBlock(domainRoot, layer) : [];
    for (const candidate of canonicalForLayer) {
      if (!await fs.exists(candidate)) impacted.add(candidate);
    }
  }
  const missingCandidates = [];
  for (const canonical of canonicalPathsForDomainBlock(domainRoot)) {
    if (await fs.exists(canonical)) continue;
    missingCandidates.push(canonical);
  }
  return {
    domain_root: domainRoot,
    likely_impacted: [...impacted].sort(),
    missing_candidates: uniqueStringsBlock(missingCandidates).sort()
  };
}
async function updateAiSynthesisCompileStateBlock(fs, input) {
  return patchNoteFrontmatterBlock(fs, {
    path: input.path,
    set: {
      last_compiled_at: input.last_compiled_at ?? (/* @__PURE__ */ new Date()).toISOString(),
      compile_status: input.compile_status
    }
  }).then((result) => ({
    path: result.path,
    updated: true,
    frontmatter: result.frontmatter
  }));
}
async function listDomainAiSynthesisHealthBlock(fs, input) {
  const domainRoot = normalizeVaultPathBlock(input.domain_root);
  const aiRoot = joinVaultPathBlock(domainRoot, AI_SYNTHESIS_ROOT);
  const notes = await listMarkdownNotesUnderBlock(fs, aiRoot);
  const missingCanonicalPages = [];
  for (const candidate of canonicalPathsForDomainBlock(domainRoot)) {
    if (!await fs.exists(candidate)) missingCanonicalPages.push(candidate);
  }
  const stalePages = [];
  const missingRequiredMetadata = [];
  const unansweredQuestions = [];
  const questionLinksToOutputs = /* @__PURE__ */ new Set();
  const outputPaths = /* @__PURE__ */ new Set();
  for (const note of notes) {
    const synthesisType = asTrimmedStringBlock(note.frontmatter.synthesis_type);
    const compileStatus = asTrimmedStringBlock(note.frontmatter.compile_status);
    const missingFields = REQUIRED_AI_SYNTHESIS_FIELDS.filter((field) => isMissingMechanicalFieldBlock(note.frontmatter[field]));
    if (Array.isArray(note.frontmatter.derived_from) && note.frontmatter.derived_from.length === 0) {
      if (!missingFields.includes("derived_from")) missingFields.push("derived_from");
    }
    if (missingFields.length > 0) {
      missingRequiredMetadata.push({
        path: note.path,
        missing_fields: missingFields
      });
    }
    if (compileStatus === "stale" || compileStatus === "needs_review") {
      stalePages.push(note.path);
    }
    if (isQuestionNoteBlock(note.path, synthesisType, note.frontmatter)) {
      if (!isAnsweredQuestionBlock(note.frontmatter)) unansweredQuestions.push(note.path);
      for (const linkedOutput of collectOutputLinksBlock(note.frontmatter)) {
        questionLinksToOutputs.add(linkedOutput);
      }
    }
    if (note.path.startsWith(joinVaultPathBlock(aiRoot, "Outputs"))) {
      outputPaths.add(note.path);
    }
  }
  const orphanOutputs = [...outputPaths].filter((outputPath) => !questionLinksToOutputs.has(outputPath)).sort();
  return {
    domain_root: domainRoot,
    missing_canonical_pages: missingCanonicalPages.sort(),
    stale_pages: stalePages.sort(),
    missing_required_metadata: missingRequiredMetadata.sort((left, right) => left.path.localeCompare(right.path)),
    unanswered_questions: unansweredQuestions.sort(),
    orphan_outputs: orphanOutputs
  };
}
async function listMarkdownNotesUnderBlock(fs, rootPath) {
  const normalizedRoot = normalizeVaultPathBlock(rootPath);
  const entries = await fs.walkVault([".md"]);
  const notes = [];
  for (const entry of entries) {
    const normalizedPath = normalizeVaultPathBlock(entry.path);
    if (!(normalizedPath === normalizedRoot || normalizedPath.startsWith(`${normalizedRoot}/`))) continue;
    const raw = await fs.read(normalizedPath);
    const parsed = parseMarkdownFrontmatterBlock(raw);
    notes.push({
      path: normalizedPath,
      frontmatter: parsed.frontmatter,
      body: parsed.body
    });
  }
  return notes;
}
async function inferLayerForPathBlock(fs, notePath) {
  const normalizedPath = normalizeVaultPathBlock(notePath);
  if (normalizedPath.includes("/AI Synthesis/Reference/")) return "reference";
  if (normalizedPath.includes("/AI Synthesis/Experiential/")) return "experiential";
  if (normalizedPath.includes("/AI Synthesis/Operational/")) return "operational";
  if (normalizedPath.includes("/AI Synthesis/Integrated/")) return "integrated";
  if (await fs.exists(normalizedPath)) {
    try {
      const raw = await fs.read(normalizedPath);
      const parsed = parseMarkdownFrontmatterBlock(raw);
      const layer = asTrimmedStringBlock(parsed.frontmatter.layer);
      if (layer && ["reference", "experiential", "operational", "integrated"].includes(layer)) {
        return layer;
      }
      const kind = asTrimmedStringBlock(parsed.frontmatter.kind);
      if (kind === "thought") return "experiential";
      if (kind === "task" || kind === "todo") return "operational";
      if (kind === "reference") return "reference";
    } catch {
    }
  }
  const lowered = normalizedPath.toLowerCase();
  if (lowered.includes("/thoughts/")) return "experiential";
  if (lowered.includes("/thinking-organizer/") || lowered.includes("/todos/")) return "operational";
  return "reference";
}
async function resolveDomainRootForPathBlock(fs, notePath) {
  const normalizedPath = normalizeVaultPathBlock(notePath);
  const segments = normalizedPath.split("/").filter(Boolean);
  const aiIndex = segments.indexOf(AI_SYNTHESIS_ROOT);
  if (aiIndex > 0) return segments.slice(0, aiIndex).join("/");
  let cursor = normalizedPath.includes(".") ? import_node_path.default.posix.dirname(normalizedPath) : normalizedPath;
  while (cursor && cursor !== ".") {
    const candidate = joinVaultPathBlock(cursor, AI_SYNTHESIS_ROOT);
    if (await fs.exists(candidate)) return cursor;
    cursor = import_node_path.default.posix.dirname(cursor);
    if (cursor === "." || cursor === "/") break;
  }
  if (segments.length >= 2) return `${segments[0]}/${segments[1]}`;
  if (segments.length === 1) return segments[0];
  return null;
}
function resolveSynthesisFolderSegmentsBlock(input) {
  if (input.synthesis_type === "source_summary" && input.source_title) {
    return ["Reference", "Sources", normalizeFolderTitleBlock(input.source_title)];
  }
  if (input.synthesis_type === "concept" && input.concept_root) {
    const conceptSegments = [
      "Reference",
      "Concepts",
      normalizeFolderTitleBlock(input.concept_root),
      ...normalizeFolderSegmentsBlock(input.concept_subpath)
    ];
    return conceptSegments;
  }
  const mapped = SYNTHESIS_PATH_MAP[input.synthesis_type];
  if (mapped) return mapped;
  if (input.layer) return [LAYER_FOLDER_MAP[input.layer]];
  throw new Error(`Unsupported synthesis_type without layer fallback: ${input.synthesis_type}`);
}
function canonicalPathsForDomainBlock(domainRoot) {
  return CANONICAL_PAGES.map((relativePath) => joinVaultPathBlock(domainRoot, relativePath));
}
function canonicalPagesForLayerBlock(domainRoot, layer) {
  const byLayer = {
    reference: [
      joinVaultPathBlock(domainRoot, "AI Synthesis/Reference/Concepts/core-concepts.md"),
      joinVaultPathBlock(domainRoot, "AI Synthesis/index.md"),
      joinVaultPathBlock(domainRoot, "AI Synthesis/Questions/open-questions.md")
    ],
    experiential: [
      joinVaultPathBlock(domainRoot, "AI Synthesis/Experiential/Themes/current-patterns.md"),
      joinVaultPathBlock(domainRoot, "AI Synthesis/Integrated/Domain Overviews/current-state.md"),
      joinVaultPathBlock(domainRoot, "AI Synthesis/Questions/open-questions.md")
    ],
    operational: [
      joinVaultPathBlock(domainRoot, "AI Synthesis/Operational/Active Focus/current-focus.md"),
      joinVaultPathBlock(domainRoot, "AI Synthesis/Integrated/Domain Overviews/current-state.md"),
      joinVaultPathBlock(domainRoot, "AI Synthesis/Questions/open-questions.md")
    ],
    integrated: [
      joinVaultPathBlock(domainRoot, "AI Synthesis/Integrated/Domain Overviews/current-state.md"),
      joinVaultPathBlock(domainRoot, "AI Synthesis/Questions/open-questions.md"),
      joinVaultPathBlock(domainRoot, "AI Synthesis/index.md")
    ]
  };
  return byLayer[layer];
}
function isMissingMechanicalFieldBlock(value) {
  if (value === void 0 || value === null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}
function isQuestionNoteBlock(notePath, synthesisType, frontmatter) {
  if (synthesisType === "question") return true;
  if (notePath.includes("/AI Synthesis/Questions/")) return true;
  return asTrimmedStringBlock(frontmatter.type) === "question";
}
function isAnsweredQuestionBlock(frontmatter) {
  if (frontmatter.answered === true || frontmatter.resolved === true) return true;
  const answerPath = asTrimmedStringBlock(frontmatter.answer_path);
  if (answerPath) return true;
  const answerPaths = normalizeStringArrayBlock(frontmatter.answer_paths);
  if (answerPaths.length > 0) return true;
  const outputPaths = normalizeStringArrayBlock(frontmatter.output_paths);
  if (outputPaths.length > 0) return true;
  return false;
}
function collectOutputLinksBlock(frontmatter) {
  const paths = [
    ...normalizeStringArrayBlock(frontmatter.answer_paths),
    ...normalizeStringArrayBlock(frontmatter.output_paths)
  ];
  const answerPath = asTrimmedStringBlock(frontmatter.answer_path);
  if (answerPath) paths.push(answerPath);
  return uniqueStringsBlock(paths.map(normalizeVaultPathBlock));
}
function renderTemplateBodyBlock(title, synthesisType) {
  const headings = TEMPLATE_HEADINGS[synthesisType] ?? ["Summary", "Supporting Notes", "Open Questions"];
  const sections = [`# ${title}`];
  for (const heading of headings) {
    sections.push("", `## ${heading}`, "");
  }
  return sections.join("\n").trimEnd();
}
function buildDefaultTitleBlock(synthesisType, rawSlug) {
  const slug = normalizeSlugBlock(rawSlug ?? synthesisType);
  const human = slug.split("-").filter(Boolean).map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
  const typeLabel = synthesisType.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
  return human ? `${typeLabel} - ${human}` : typeLabel;
}
function domainSlugFromRootBlock(domainRoot) {
  const basename2 = domainRoot.split("/").filter(Boolean).pop() ?? domainRoot;
  return normalizeSlugBlock(basename2);
}
function normalizeSlugBlock(value) {
  return String(value || "").trim().toLowerCase().replace(/[^a-z0-9\s-]/g, "").replace(/\s+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
}
function normalizeFolderTitleBlock(value) {
  return String(value || "").replace(/\r\n/g, " ").replace(/\//g, "-").trim();
}
function normalizeFolderSegmentsBlock(values) {
  if (!Array.isArray(values)) return [];
  return values.map(normalizeFolderTitleBlock).filter(Boolean);
}
function normalizeVaultPathBlock(value) {
  const normalized = import_node_path.default.posix.normalize(String(value || "").replace(/\\/g, "/"));
  return normalized.replace(/^\/+/, "").replace(/\/+$/g, "").replace(/^\.\//, "").replace(/^$/, "");
}
function joinVaultPathBlock(...parts) {
  return normalizeVaultPathBlock(parts.filter(Boolean).join("/"));
}
function uniqueStringsBlock(values) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
function asTrimmedStringBlock(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}
function normalizeStringArrayBlock(value) {
  if (!Array.isArray(value)) return [];
  return uniqueStringsBlock(value.map((item) => String(item)));
}

// src/services/orchestrators/aiSynthesisInfraOrch.ts
async function readNoteOrch(fs, path3) {
  return readNoteBlock(fs, path3);
}
async function writeNoteOrch(fs, input) {
  return writeNoteBlock(fs, input);
}
async function patchNoteFrontmatterOrch(fs, input) {
  return patchNoteFrontmatterBlock(fs, input);
}
async function resolveAiSynthesisPathOrch(fs, input) {
  return resolveAiSynthesisPathBlock(fs, input);
}
async function createAiSynthesisNoteOrch(fs, input) {
  return createAiSynthesisNoteBlock(fs, input);
}
async function getImpactedAiSynthesisNotesOrch(fs, input) {
  return getImpactedAiSynthesisNotesBlock(fs, input);
}
async function updateAiSynthesisCompileStateOrch(fs, input) {
  return updateAiSynthesisCompileStateBlock(fs, input);
}
async function listDomainAiSynthesisHealthOrch(fs, input) {
  return listDomainAiSynthesisHealthBlock(fs, input);
}

// src/services/orchestrators/capabilityRouterOrch.ts
var DEFAULT_ACTOR = {
  kind: "human",
  id: "ui.unknown"
};
var WRITE_CAPABILITIES2 = /* @__PURE__ */ new Set([
  "write_note",
  "patch_note_frontmatter",
  "create_ai_synthesis_note",
  "update_ai_synthesis_compile_state",
  "organizer.node.create",
  "organizer.node.rename",
  "organizer.node.update",
  "organizer.node.move",
  "organizer.node.delete",
  "task.claim",
  "task.update_status",
  "run.log",
  "handoff.create",
  "comment.add",
  "thoughts.create",
  "todos.create",
  "todos.toggle",
  "tools.excalidraw.format",
  "tools.pdf.convert",
  "tools.transcript.clean_save"
]);
function listCapabilitiesOrch() {
  return CAPABILITY_REGISTRY;
}
async function invokeCapabilityOrch(request, options) {
  const requestId = request.requestId || createRequestId();
  const auditId = createAuditId();
  const actor = request.actor ?? DEFAULT_ACTOR;
  const dryRun = !!request.dryRun;
  const warnings = [];
  const fs = options?.fs;
  const definition = getCapabilityDefinition(request.capability);
  if (!definition) {
    const response = {
      ok: false,
      capability: request.capability,
      requestId,
      actor,
      dryRun,
      auditId,
      warnings,
      error: {
        code: "CAPABILITY_NOT_FOUND",
        message: `Unknown capability: ${request.capability}`
      }
    };
    await auditCapability({
      auditId,
      requestId,
      request,
      actor,
      dryRun,
      warnings,
      ok: false,
      errorCode: response.error.code,
      errorMessage: response.error.message,
      fs
    });
    return response;
  }
  try {
    if (actor.kind === "agent" && !getCapabilityFeatureFlags().agent_capabilities_enabled) {
      throw new Error("Agent capabilities are disabled by feature flag.");
    }
    validateCapabilityPolicy({
      capability: request.capability,
      input: request.input,
      actor
    });
    if (dryRun && WRITE_CAPABILITIES2.has(request.capability)) {
      const preview = await executeDryRunCapability(request.capability, request.input);
      if (preview) {
        warnings.push("Dry-run preview only. No files were modified.");
        const success2 = {
          ok: true,
          capability: request.capability,
          requestId,
          actor,
          dryRun,
          auditId,
          warnings,
          data: preview
        };
        await auditCapability({
          auditId,
          requestId,
          request,
          actor,
          dryRun,
          warnings,
          ok: true,
          touchedPaths: extractTouchedPaths(request.capability, success2.data),
          fs
        });
        return success2;
      }
      const unsupported = {
        ok: false,
        capability: request.capability,
        requestId,
        actor,
        dryRun,
        auditId,
        warnings,
        error: {
          code: "CAPABILITY_DRY_RUN_UNSUPPORTED",
          message: `Dry-run is not implemented for ${request.capability}.`
        }
      };
      await auditCapability({
        auditId,
        requestId,
        request,
        actor,
        dryRun,
        warnings,
        ok: false,
        errorCode: unsupported.error.code,
        errorMessage: unsupported.error.message,
        fs
      });
      return unsupported;
    }
    const data = await executeCapability(request.capability, request.input, fs);
    const success = {
      ok: true,
      capability: request.capability,
      requestId,
      actor,
      dryRun,
      auditId,
      warnings,
      data
    };
    await auditCapability({
      auditId,
      requestId,
      request,
      actor,
      dryRun,
      warnings,
      ok: true,
      touchedPaths: extractTouchedPaths(request.capability, data),
      fs
    });
    return success;
  } catch (error) {
    const failure = {
      ok: false,
      capability: request.capability,
      requestId,
      actor,
      dryRun,
      auditId,
      warnings,
      error: {
        code: "CAPABILITY_EXECUTION_FAILED",
        message: error instanceof Error ? error.message : String(error)
      }
    };
    await auditCapability({
      auditId,
      requestId,
      request,
      actor,
      dryRun,
      warnings,
      ok: false,
      errorCode: failure.error.code,
      errorMessage: failure.error.message,
      fs
    });
    return failure;
  }
}
async function executeCapability(capability, input, fs) {
  switch (capability) {
    case "read_note": {
      const payload = input;
      assertNonEmptyString(payload.path, "path");
      const note = await readNoteOrch(fs ?? getVaultFS(), payload.path);
      return note;
    }
    case "write_note": {
      const payload = input;
      assertNonEmptyString(payload.path, "path");
      const result = await writeNoteOrch(fs ?? getVaultFS(), payload);
      return result;
    }
    case "patch_note_frontmatter": {
      const payload = input;
      assertNonEmptyString(payload.path, "path");
      const result = await patchNoteFrontmatterOrch(fs ?? getVaultFS(), payload);
      return result;
    }
    case "resolve_ai_synthesis_path": {
      const payload = input;
      assertNonEmptyString(payload.domain_root, "domain_root");
      assertNonEmptyString(payload.synthesis_type, "synthesis_type");
      assertNonEmptyString(payload.slug, "slug");
      const result = await resolveAiSynthesisPathOrch(fs ?? getVaultFS(), payload);
      return result;
    }
    case "create_ai_synthesis_note": {
      const payload = input;
      assertNonEmptyString(payload.domain_root, "domain_root");
      assertNonEmptyString(payload.layer, "layer");
      assertNonEmptyString(payload.synthesis_type, "synthesis_type");
      if (!Array.isArray(payload.derived_from) || payload.derived_from.length === 0) {
        throw new Error("derived_from must contain at least one path");
      }
      const result = await createAiSynthesisNoteOrch(fs ?? getVaultFS(), payload);
      return result;
    }
    case "get_impacted_ai_synthesis_notes": {
      const payload = input;
      if (!Array.isArray(payload.changed_paths) || payload.changed_paths.length === 0) {
        throw new Error("changed_paths must contain at least one path");
      }
      const result = await getImpactedAiSynthesisNotesOrch(fs ?? getVaultFS(), payload);
      return result;
    }
    case "update_ai_synthesis_compile_state": {
      const payload = input;
      assertNonEmptyString(payload.path, "path");
      assertNonEmptyString(payload.compile_status, "compile_status");
      const result = await updateAiSynthesisCompileStateOrch(fs ?? getVaultFS(), payload);
      return result;
    }
    case "list_domain_ai_synthesis_health": {
      const payload = input;
      assertNonEmptyString(payload.domain_root, "domain_root");
      const result = await listDomainAiSynthesisHealthOrch(fs ?? getVaultFS(), payload);
      return result;
    }
    case "organizer.nodes.list_roots": {
      const payload = input;
      const nodes = await listYamlRootNodes(payload.typeFilter);
      return { nodes };
    }
    case "organizer.nodes.list_children": {
      const payload = input;
      assertNonEmptyString(payload.parentKey, "parentKey");
      const nodes = await listYamlChildren(payload.parentKey);
      return { nodes };
    }
    case "organizer.nodes.list_all": {
      const nodes = await listAllYamlNodes();
      return { nodes };
    }
    case "organizer.nodes.search": {
      const payload = input;
      assertNonEmptyString(payload.query, "query");
      const nodes = await searchYamlNodes(payload.query, payload.limit);
      return { nodes };
    }
    case "organizer.node.get": {
      const payload = input;
      assertNonEmptyString(payload.uuid, "uuid");
      const node = await getYamlNode(payload.uuid);
      return { node: node ?? null };
    }
    case "organizer.node.get_by_key": {
      const payload = input;
      assertNonEmptyString(payload.key, "key");
      const node = await getYamlNodeByKey(payload.key);
      return { node: node ?? null };
    }
    case "organizer.node.read_frontmatter": {
      const payload = input;
      assertNonEmptyString(payload.filePath, "filePath");
      const frontmatter = await readYamlFrontmatterByPath(payload.filePath, fs);
      return { frontmatter };
    }
    case "organizer.node.create": {
      const payload = input;
      assertNonEmptyString(payload.title, "title");
      assertValidNodeType(payload.type);
      assertValidRecordKind(payload.extraFields?.record_kind);
      assertWritableProjectRootAllowed(payload.projectRoot, "organizer.node.create");
      const normalizedCreatePayload = normalizeCreatePayloadForStatusPolicy(payload);
      const node = await createYamlNode({ ...normalizedCreatePayload, fs });
      await applyEpicStatusPolicyForAffectedNodes({
        changedNodes: [node],
        changedParentKeys: [payload.parentKey],
        fs
      });
      return { node };
    }
    case "organizer.node.rename": {
      const payload = input;
      assertNonEmptyString(payload.uuid, "uuid");
      assertNonEmptyString(payload.newTitle, "newTitle");
      const node = await renameYamlNode(payload.uuid, payload.newTitle, fs);
      return { node };
    }
    case "organizer.node.update": {
      const payload = input;
      assertNonEmptyString(payload.uuid, "uuid");
      if (payload.updates.type !== void 0) assertValidNodeType(payload.updates.type);
      assertValidRecordKind(payload.updates.extraFields?.record_kind);
      const existing = await getYamlNode(payload.uuid);
      if (!existing) throw new Error(`Node not found: ${payload.uuid}`);
      const normalizedUpdates = normalizeNodeUpdatesForStatusPolicy(existing, payload.updates);
      const manualEpicStatusOverrideKey = existing.type === "epic" && normalizedUpdates.status !== void 0 ? existing.key : void 0;
      const node = await updateYamlNode(payload.uuid, normalizedUpdates, fs);
      await applyEpicStatusPolicyForAffectedNodes({
        changedNodes: [node],
        changedParentKeys: [existing.parent, node.parent],
        skipEpicKeys: manualEpicStatusOverrideKey ? [manualEpicStatusOverrideKey] : void 0,
        fs
      });
      return { node };
    }
    case "organizer.node.move": {
      const payload = input;
      assertNonEmptyString(payload.uuid, "uuid");
      const existing = await getYamlNode(payload.uuid);
      const node = await moveYamlNode(payload.uuid, payload.newParentKey, fs);
      await applyEpicStatusPolicyForAffectedNodes({
        changedNodes: [node],
        changedParentKeys: [existing?.parent, node.parent, payload.newParentKey],
        fs
      });
      return { node };
    }
    case "organizer.node.delete": {
      const payload = input;
      assertNonEmptyString(payload.uuid, "uuid");
      const existing = await getYamlNode(payload.uuid);
      const childCount = existing ? (await listYamlChildren(existing.key)).length : 0;
      await deleteYamlNode(payload.uuid, fs);
      await applyEpicStatusPolicyForAffectedNodes({
        changedNodes: [],
        changedParentKeys: [existing?.parent],
        fs
      });
      return {
        deleted: true,
        preview: existing ? {
          nodeUuid: existing.uuid,
          filePath: existing.filePath,
          parentKey: existing.parent ?? null,
          childCount,
          touchedPaths: [existing.filePath]
        } : void 0
      };
    }
    case "task.claim": {
      const payload = input;
      assertNonEmptyString(payload.uuid, "uuid");
      assertNonEmptyString(payload.owner, "owner");
      const source = await getYamlNode(payload.uuid);
      if (!source) throw new Error(`Node not found: ${payload.uuid}`);
      assertTaskNode(source);
      assertWritableProjectRootAllowed(source.projectRoot, "task.claim");
      const status = payload.taskStatus?.trim() || "in_progress";
      const normalizedTaskStatus = normalizeTaskStatus(status) ?? "in_progress";
      const history = appendStateHistory(source, {
        from: source.taskStatus,
        to: normalizedTaskStatus,
        note: payload.note ?? `Claimed by ${payload.owner}`
      }, payload.owner);
      const node = await updateYamlNode(payload.uuid, {
        status: nodeStatusFromTaskStatus(normalizedTaskStatus),
        extraFields: {
          record_kind: "task",
          task_status: normalizedTaskStatus,
          owner: payload.owner.trim(),
          state_history: history,
          schema_version: "2"
        }
      }, fs);
      await applyEpicStatusPolicyForAffectedNodes({
        changedNodes: [node],
        changedParentKeys: [source.parent, node.parent],
        fs
      });
      return { node };
    }
    case "task.update_status": {
      const payload = input;
      assertNonEmptyString(payload.uuid, "uuid");
      assertNonEmptyString(payload.taskStatus, "taskStatus");
      const source = await getYamlNode(payload.uuid);
      if (!source) throw new Error(`Node not found: ${payload.uuid}`);
      assertTaskNode(source);
      assertWritableProjectRootAllowed(source.projectRoot, "task.update_status");
      const status = normalizeTaskStatus(payload.taskStatus.trim()) ?? "in_progress";
      const history = appendStateHistory(source, {
        from: source.taskStatus,
        to: status,
        note: payload.note
      }, source.owner || "unknown");
      const node = await updateYamlNode(payload.uuid, {
        status: nodeStatusFromTaskStatus(status),
        extraFields: {
          record_kind: "task",
          task_status: status,
          state_history: history,
          schema_version: "2"
        }
      }, fs);
      await applyEpicStatusPolicyForAffectedNodes({
        changedNodes: [node],
        changedParentKeys: [source.parent, node.parent],
        fs
      });
      return { node };
    }
    case "run.log": {
      const payload = input;
      assertNonEmptyString(payload.title, "title");
      assertNonEmptyString(payload.projectRoot, "projectRoot");
      assertWritableProjectRootAllowed(payload.projectRoot, "run.log");
      const node = await createYamlNode({
        type: "run",
        title: payload.title,
        parentKey: payload.parentKey,
        parentUuid: payload.parentUuid,
        parentType: payload.parentType,
        body: payload.body,
        tags: ["ops/run"],
        projectRoot: payload.projectRoot,
        extraFields: {
          record_kind: "run",
          schema_version: "2",
          run_id: payload.runId || createRunId(),
          session_id: payload.sessionId,
          agent_name: payload.agentName,
          model: payload.model,
          started_at: payload.startedAt || (/* @__PURE__ */ new Date()).toISOString(),
          ended_at: payload.endedAt,
          result: payload.result,
          source_repo: payload.sourceRepo,
          branch: payload.branch,
          commit: payload.commit,
          artifacts: payload.artifacts,
          related_nodes: payload.relatedNodes
        },
        fs
      });
      return { node };
    }
    case "handoff.create": {
      const payload = input;
      assertNonEmptyString(payload.title, "title");
      assertNonEmptyString(payload.projectRoot, "projectRoot");
      assertNonEmptyString(payload.summary, "summary");
      assertWritableProjectRootAllowed(payload.projectRoot, "handoff.create");
      const body = payload.body || buildHandoffBody({
        summary: payload.summary,
        fromAgent: payload.fromAgent,
        toAgent: payload.toAgent
      });
      const node = await createYamlNode({
        type: "handoff",
        title: payload.title,
        parentKey: payload.parentKey,
        parentUuid: payload.parentUuid,
        parentType: payload.parentType,
        body,
        description: payload.summary.trim(),
        tags: ["ops/handoff"],
        projectRoot: payload.projectRoot,
        extraFields: {
          record_kind: "handoff",
          schema_version: "2",
          source_repo: payload.sourceRepo,
          branch: payload.branch,
          commit: payload.commit,
          artifacts: payload.artifacts,
          related_nodes: payload.relatedNodes,
          state_history: [
            {
              at: (/* @__PURE__ */ new Date()).toISOString(),
              from: "",
              to: "created",
              note: payload.summary || "Handoff created"
            }
          ]
        },
        fs
      });
      return { node };
    }
    case "comment.add": {
      const payload = input;
      assertNonEmptyString(payload.uuid, "uuid");
      assertNonEmptyString(payload.text, "text");
      const source = await getYamlNode(payload.uuid);
      if (!source) throw new Error(`Node not found: ${payload.uuid}`);
      assertWritableProjectRootAllowed(source.projectRoot, "comment.add");
      const comments = [
        ...source.comments ?? [],
        {
          text: payload.text.trim(),
          added_at: (/* @__PURE__ */ new Date()).toISOString(),
          added_by: payload.addedBy?.trim() || getUserCommentAuthorBlock()
        }
      ];
      const node = await updateYamlNode(payload.uuid, { comments }, fs);
      return { node };
    }
    case "thoughts.create": {
      const payload = input;
      assertNonEmptyString(payload.folder_path, "folder_path");
      assertNonEmptyString(payload.filename, "filename");
      assertNonEmptyString(payload.content, "content");
      const output = await createThought(payload);
      return output;
    }
    case "todos.create": {
      const payload = input;
      assertNonEmptyString(payload.folderPath, "folderPath");
      assertNonEmptyString(payload.date, "date");
      const output = await createTodos(payload.folderPath, payload.date, payload.items);
      return output;
    }
    case "todos.toggle": {
      const payload = input;
      assertNonEmptyString(payload.filePath, "filePath");
      if (!Number.isInteger(payload.lineNumber) || payload.lineNumber <= 0) {
        throw new Error("lineNumber must be a positive integer");
      }
      await toggleTodo2(payload.filePath, payload.lineNumber);
      return {
        toggled: true,
        filePath: payload.filePath
      };
    }
    case "tools.files.list_markdown": {
      const payload = input;
      const files = await listFiles(payload.limit);
      return { files };
    }
    case "tools.files.list_pdf": {
      const payload = input;
      const files = await listPdfFiles(payload.limit);
      return { files };
    }
    case "tools.folders.list": {
      const payload = input;
      const folders = await listFolders(payload.limit);
      return { folders };
    }
    case "tools.excalidraw.preview": {
      const payload = input;
      assertNonEmptyString(payload.inputPath, "inputPath");
      const preview = await previewFormat(payload.inputPath, payload.options);
      return { preview };
    }
    case "tools.excalidraw.format": {
      const payload = input;
      assertNonEmptyString(payload.inputPath, "inputPath");
      const result = await formatAndSave(payload.inputPath, payload.options);
      return { result };
    }
    case "tools.pdf.preview": {
      const payload = input;
      assertNonEmptyString(payload.inputPath, "inputPath");
      const preview = await previewPdf(payload.inputPath, payload.options);
      return { preview };
    }
    case "tools.pdf.convert": {
      const payload = input;
      assertNonEmptyString(payload.inputPath, "inputPath");
      const result = await convertPdf(payload.inputPath, payload.options);
      return { result };
    }
    case "tools.transcript.preview": {
      const payload = input;
      assertNonEmptyString(payload.inputText, "inputText");
      const result = previewTranscript(payload.inputText, payload.headingsText, payload.options);
      return { result };
    }
    case "tools.transcript.clean_save": {
      const payload = input;
      assertNonEmptyString(payload.input_text, "input_text");
      assertNonEmptyString(payload.output_folder, "output_folder");
      assertNonEmptyString(payload.output_name, "output_name");
      const result = await cleanAndSave(payload);
      return { result };
    }
    default:
      throw new Error(`Capability not implemented: ${String(capability)}`);
  }
}
async function executeDryRunCapability(capability, input) {
  switch (capability) {
    case "write_note":
    case "patch_note_frontmatter":
    case "create_ai_synthesis_note":
    case "update_ai_synthesis_compile_state":
    case "organizer.node.move": {
      if (capability !== "organizer.node.move") return null;
      const payload = input;
      assertNonEmptyString(payload.uuid, "uuid");
      const source = await getYamlNode(payload.uuid);
      if (!source) throw new Error(`Node not found: ${payload.uuid}`);
      const fromParentKey = source.parent ?? null;
      let toParentKey = payload.newParentKey;
      let toParentUuid = source.parentUuid;
      let toParentType = source.parentType;
      if (payload.newParentKey) {
        const parent = await getYamlNodeByKey(payload.newParentKey);
        if (!parent) throw new Error(`Parent not found: ${payload.newParentKey}`);
        toParentKey = parent.key;
        toParentUuid = parent.uuid;
        toParentType = parent.type;
      } else {
        toParentKey = null;
        toParentUuid = void 0;
        toParentType = void 0;
      }
      const previewNode = {
        ...source,
        parent: toParentKey ?? void 0,
        parentUuid: toParentUuid,
        parentType: toParentType,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      return {
        node: previewNode,
        preview: {
          nodeUuid: source.uuid,
          fromParentKey,
          toParentKey,
          touchedPaths: [source.filePath]
        }
      };
    }
    case "organizer.node.delete": {
      const payload = input;
      assertNonEmptyString(payload.uuid, "uuid");
      const target = await getYamlNode(payload.uuid);
      if (!target) {
        return {
          deleted: true,
          preview: {
            nodeUuid: payload.uuid,
            parentKey: null,
            childCount: 0,
            touchedPaths: []
          }
        };
      }
      const childCount = (await listYamlChildren(target.key)).length;
      return {
        deleted: true,
        preview: {
          nodeUuid: target.uuid,
          filePath: target.filePath,
          parentKey: target.parent ?? null,
          childCount,
          touchedPaths: [target.filePath]
        }
      };
    }
    default:
      return null;
  }
}
function assertNonEmptyString(value, field) {
  if (!value || !value.trim()) {
    throw new Error(`Missing required field: ${field}`);
  }
}
function createRequestId() {
  const rand = Math.random().toString(36).slice(2, 8);
  return `cap-${Date.now().toString(36)}-${rand}`;
}
function createAuditId() {
  const rand = Math.random().toString(36).slice(2, 8);
  return `audit-${Date.now().toString(36)}-${rand}`;
}
function createRunId() {
  const rand = Math.random().toString(36).slice(2, 8);
  return `run-${Date.now().toString(36)}-${rand}`;
}
function extractTouchedPaths(capability, data) {
  switch (capability) {
    case "write_note":
    case "patch_note_frontmatter":
    case "resolve_ai_synthesis_path":
    case "create_ai_synthesis_note":
    case "update_ai_synthesis_compile_state": {
      const output = data;
      return output.path ? [output.path] : [];
    }
    case "organizer.node.create":
    case "organizer.node.rename":
    case "organizer.node.update":
    case "organizer.node.move": {
      const node = data.node;
      return node?.filePath ? [node.filePath] : [];
    }
    case "task.claim":
    case "task.update_status":
    case "run.log":
    case "handoff.create":
    case "comment.add": {
      const node = data.node;
      return node?.filePath ? [node.filePath] : [];
    }
    case "organizer.node.delete": {
      const preview = data.preview;
      return preview?.touchedPaths ?? [];
    }
    case "thoughts.create": {
      const output = data;
      return output.output_path ? [output.output_path] : [];
    }
    case "todos.create": {
      const output = data;
      return output.output_path ? [output.output_path] : [];
    }
    case "todos.toggle": {
      const output = data;
      return output.filePath ? [output.filePath] : [];
    }
    case "tools.excalidraw.format": {
      const output = data;
      return output.result.output_path ? [output.result.output_path] : [];
    }
    case "tools.pdf.convert": {
      const output = data;
      return output.result.output_path ? [output.result.output_path] : [];
    }
    case "tools.transcript.clean_save": {
      const output = data;
      return output.result.output_path ? [output.result.output_path] : [];
    }
    default:
      return [];
  }
}
function normalizeCreatePayloadForStatusPolicy(payload) {
  const extra = payload.extraFields ? { ...payload.extraFields } : {};
  const recordKind = typeof extra.record_kind === "string" ? extra.record_kind.trim() : void 0;
  const rawTaskStatus = typeof extra.task_status === "string" ? extra.task_status : void 0;
  const normalizedTaskStatus = normalizeTaskStatus(rawTaskStatus);
  const taskType = payload.type === "task" || recordKind === "task" || !!normalizedTaskStatus;
  const nextType = taskType ? "task" : payload.type;
  const normalizedExtra = {
    ...extra,
    record_kind: nextType
  };
  if (nextType === "task") normalizedExtra.task_status = normalizedTaskStatus ?? "in_progress";
  else delete normalizedExtra.task_status;
  return {
    ...payload,
    type: nextType,
    extraFields: normalizedExtra
  };
}
function normalizeNodeUpdatesForStatusPolicy(existing, updates) {
  const normalized = {
    ...updates,
    extraFields: updates.extraFields ? { ...updates.extraFields } : void 0
  };
  const extraFields = normalized.extraFields ? { ...normalized.extraFields } : {};
  if (existing.type === "epic" && normalized.status !== void 0) {
    if (normalized.status === "completed") {
      const explicitEpicCompletedAt = normalizeEpicCompletedDate(
        typeof extraFields.epic_completed_at === "string" ? extraFields.epic_completed_at : void 0
      );
      if (!explicitEpicCompletedAt && !normalizeEpicCompletedDate(existing.epicCompletedAt)) {
        extraFields.epic_completed_at = currentDateStamp();
      }
    } else {
      extraFields.epic_completed_at = null;
    }
  }
  const nextRecordKind = typeof extraFields.record_kind === "string" ? extraFields.record_kind.trim() : existing.recordKind;
  let nextType = normalized.type ?? existing.type;
  const rawTaskStatus = typeof extraFields.task_status === "string" ? extraFields.task_status : void 0;
  const normalizedTaskStatus = normalizeTaskStatus(rawTaskStatus);
  if (nextType === "task" || nextRecordKind === "task" || normalizedTaskStatus || isTaskLikeNode(existing)) {
    nextType = "task";
  }
  normalized.type = nextType;
  if (normalizedTaskStatus) {
    extraFields.task_status = normalizedTaskStatus;
    normalized.status = nodeStatusFromTaskStatus(normalizedTaskStatus);
  } else if (nextType === "task" && normalized.status) {
    extraFields.task_status = taskStatusFromNodeStatus(normalized.status);
  } else if (nextType !== "task") {
    delete extraFields.task_status;
  }
  extraFields.record_kind = nextType;
  normalized.extraFields = extraFields;
  return normalized;
}
async function applyEpicStatusPolicyForAffectedNodes(params) {
  const allNodes = await listAllYamlNodes();
  if (allNodes.length === 0) return;
  const nodesByKey = new Map(allNodes.map((node) => [node.key, node]));
  const childrenByParent = /* @__PURE__ */ new Map();
  for (const node of allNodes) {
    if (!node.parent) continue;
    const siblings = childrenByParent.get(node.parent) ?? [];
    siblings.push(node);
    childrenByParent.set(node.parent, siblings);
  }
  const candidateEpicKeys = /* @__PURE__ */ new Set();
  const visitAncestors = (startParentKey) => {
    let cursor = startParentKey ?? void 0;
    const seen = /* @__PURE__ */ new Set();
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor);
      const node = nodesByKey.get(cursor);
      if (!node) break;
      if (node.type === "epic") candidateEpicKeys.add(node.key);
      cursor = node.parent;
    }
  };
  for (const node of params.changedNodes) {
    if (node.type === "epic") candidateEpicKeys.add(node.key);
    visitAncestors(node.parent);
  }
  for (const parentKey of params.changedParentKeys ?? []) {
    visitAncestors(parentKey);
  }
  if (candidateEpicKeys.size === 0) return;
  const skipEpicKeys = new Set(
    (params.skipEpicKeys ?? []).map((key) => key.trim()).filter(Boolean)
  );
  for (const epicKey of candidateEpicKeys) {
    if (skipEpicKeys.has(epicKey)) continue;
    const epic = nodesByKey.get(epicKey);
    if (!epic || epic.type !== "epic") continue;
    const taskStatuses = collectDescendantTaskStatuses(epic.key, childrenByParent);
    const derivedStatus = deriveEpicStatusFromTaskStatuses(taskStatuses);
    if (!derivedStatus) continue;
    const normalizedEpicCompletedAt = normalizeEpicCompletedDate(epic.epicCompletedAt);
    const shouldUpdateStatus = derivedStatus !== epic.status;
    const shouldSetCompletionDate = derivedStatus === "completed" && epic.status !== "completed" && !normalizedEpicCompletedAt;
    if (!shouldUpdateStatus && !shouldSetCompletionDate) continue;
    const updated = await updateYamlNode(epic.uuid, {
      status: shouldUpdateStatus ? derivedStatus : void 0,
      extraFields: shouldSetCompletionDate ? { epic_completed_at: currentDateStamp() } : void 0
    }, params.fs);
    nodesByKey.set(updated.key, updated);
  }
}
function currentDateStamp() {
  return (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
}
function normalizeEpicCompletedDate(value) {
  if (!value) return void 0;
  const trimmed = value.trim();
  if (!trimmed) return void 0;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return void 0;
  return parsed.toISOString().slice(0, 10);
}
function collectDescendantTaskStatuses(rootKey, childrenByParent) {
  const collected = [];
  const seen = /* @__PURE__ */ new Set();
  const stack = [...childrenByParent.get(rootKey) ?? []];
  while (stack.length > 0) {
    const current = stack.pop();
    if (seen.has(current.key)) continue;
    seen.add(current.key);
    if (isTaskLikeNode(current)) {
      collected.push(current.taskStatus ?? "in_progress");
    }
    const children = childrenByParent.get(current.key);
    if (!children || children.length === 0) continue;
    for (const child of children) stack.push(child);
  }
  return collected;
}
function assertValidRecordKind(recordKind) {
  if (recordKind === void 0 || recordKind === null || recordKind === "") return;
  if (typeof recordKind !== "string") {
    throw new Error(`record_kind must be a string, received ${typeof recordKind}`);
  }
  if (!ALLOWED_RECORD_KINDS.includes(recordKind)) {
    throw new Error(`Invalid record_kind: ${recordKind}`);
  }
}
function assertValidNodeType(type2) {
  if (typeof type2 !== "string") {
    throw new Error(`type must be a string, received ${typeof type2}`);
  }
  const normalized = type2.trim();
  if (!NODE_TYPES.includes(normalized)) {
    throw new Error(`Invalid type: ${type2}`);
  }
}
function assertTaskNode(node) {
  if (!(node.type === "task" || node.recordKind === "task" || !!normalizeTaskStatus(node.taskStatus))) {
    throw new Error("Node is not a task record (type=task or record_kind=task or task_status required).");
  }
}
function assertWritableProjectRootAllowed(projectRoot, capability) {
  if (!projectRoot) return;
  const policy = getCapabilityPolicy();
  const allowlist = policy.allowedWritableProjectRoots;
  if (!allowlist || allowlist.length === 0) return;
  const normalized = normalizePath2(projectRoot);
  const allowed = allowlist.some((root) => normalizePath2(root) === normalized);
  if (!allowed) {
    throw new Error(`Writable project root "${projectRoot}" is blocked for ${capability}.`);
  }
}
function normalizePath2(value) {
  return value.replace(/\\/g, "/").replace(/\/+$/g, "");
}
function appendStateHistory(source, transition, by) {
  const existing = Array.isArray(source.stateHistory) ? source.stateHistory.map((entry) => ({ ...entry })) : [];
  existing.push({
    at: (/* @__PURE__ */ new Date()).toISOString(),
    by,
    from: transition.from ?? source.taskStatus ?? "",
    to: transition.to,
    note: transition.note
  });
  return existing;
}
function buildHandoffBody(params) {
  const lines = ["## Handoff"];
  if (params.summary) {
    lines.push("");
    lines.push(params.summary);
  }
  if (params.fromAgent || params.toAgent) {
    lines.push("");
    lines.push("## Routing");
    lines.push("");
    if (params.fromAgent) lines.push(`- From: ${params.fromAgent}`);
    if (params.toAgent) lines.push(`- To: ${params.toAgent}`);
  }
  return lines.join("\n");
}
async function auditCapability(params) {
  try {
    const fs = params.fs ?? getVaultFS();
    await writeCapabilityAuditEntry({
      auditId: params.auditId,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      requestId: params.requestId,
      capability: params.request.capability,
      origin: params.request.extensionContext ? "extension" : "core",
      extensionId: params.request.extensionContext?.extensionId,
      extensionRegistryKey: params.request.extensionContext?.extensionRegistryKey,
      actorKind: params.actor.kind,
      actorId: params.actor.id,
      dryRun: params.dryRun,
      ok: params.ok,
      inputHash: createCapabilityInputHash(params.request.input),
      touchedPaths: params.touchedPaths ?? [],
      warnings: params.warnings,
      errorCode: params.errorCode,
      errorMessage: params.errorMessage
    }, fs);
  } catch {
  }
}

// scripts/agent/capabilityRunner.ts
var import_meta = {};
var InMemoryLocalStorage = class {
  store = /* @__PURE__ */ new Map();
  get length() {
    return this.store.size;
  }
  clear() {
    this.store.clear();
  }
  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }
  key(index) {
    if (index < 0 || index >= this.store.size) return null;
    return [...this.store.keys()][index] ?? null;
  }
  removeItem(key) {
    this.store.delete(key);
  }
  setItem(key, value) {
    this.store.set(key, value);
  }
};
function isUsableLocalStorage(value) {
  if (!value || typeof value !== "object") return false;
  const candidate = value;
  return typeof candidate.getItem === "function" && typeof candidate.setItem === "function" && typeof candidate.removeItem === "function" && typeof candidate.clear === "function";
}
var NodeVaultFS = class {
  vaultRoot;
  constructor(vaultRoot) {
    this.vaultRoot = path2.resolve(vaultRoot);
  }
  async read(relPath) {
    const full = this.assertInsideVault(relPath);
    return fsPromises.readFile(full, "utf-8");
  }
  async write(relPath, data) {
    const full = this.assertInsideVault(relPath);
    await fsPromises.mkdir(path2.dirname(full), { recursive: true });
    await fsPromises.writeFile(full, data, "utf-8");
  }
  async create(relPath, data) {
    if (await this.exists(relPath)) {
      throw new Error(`File already exists: ${relPath}`);
    }
    await this.write(relPath, data);
  }
  async list(relPath) {
    const full = this.assertInsideVault(relPath || ".");
    const entries = await fsPromises.readdir(full, { withFileTypes: true });
    const files = [];
    const folders = [];
    for (const entry of entries) {
      if (entry.name.startsWith(".") || EXCLUDED_DIRS.has(entry.name)) continue;
      if (entry.isDirectory()) folders.push(entry.name);
      else files.push(entry.name);
    }
    return { files, folders };
  }
  async walkVault(extensions = [".md"]) {
    const extSet = new Set(extensions.map((ext) => ext.toLowerCase()));
    const results = [];
    const walk = async (dir) => {
      let entries;
      try {
        entries = await fsPromises.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (entry.name.startsWith(".") || EXCLUDED_DIRS.has(entry.name)) continue;
        const full = path2.join(dir, entry.name);
        if (entry.isDirectory()) {
          await walk(full);
          continue;
        }
        if (entry.isFile()) {
          const ext = path2.extname(entry.name).toLowerCase();
          if (!extSet.has(ext)) continue;
          try {
            const stat2 = await fsPromises.stat(full);
            results.push({
              path: this.toVaultRelativePath(full),
              size: stat2.size,
              mtime: stat2.mtimeMs / 1e3,
              ctime: stat2.birthtimeMs / 1e3
            });
          } catch {
          }
        }
      }
    };
    await walk(this.vaultRoot);
    return results;
  }
  async stat(relPath) {
    const full = this.assertInsideVault(relPath);
    const stat2 = await fsPromises.stat(full);
    return {
      size: stat2.size,
      mtime: stat2.mtimeMs / 1e3,
      ctime: stat2.birthtimeMs / 1e3,
      isDirectory: stat2.isDirectory()
    };
  }
  async exists(relPath) {
    const full = this.assertInsideVault(relPath);
    try {
      await fsPromises.access(full);
      return true;
    } catch {
      return false;
    }
  }
  async mkdir(relPath) {
    const full = this.assertInsideVault(relPath);
    await fsPromises.mkdir(full, { recursive: true });
  }
  async process(relPath, fn) {
    const content = await this.read(relPath);
    await this.write(relPath, fn(content));
  }
  assertInsideVault(relPath) {
    const candidate = path2.resolve(this.vaultRoot, relPath || ".");
    const relative2 = path2.relative(this.vaultRoot, candidate);
    if (relative2.startsWith("..") || path2.isAbsolute(relative2)) {
      throw new Error(`Path traversal detected: ${relPath}`);
    }
    return candidate;
  }
  toVaultRelativePath(fullPath) {
    return path2.relative(this.vaultRoot, fullPath).split(path2.sep).join("/");
  }
};
var NUMBER_FIELDS = /* @__PURE__ */ new Set(["limit", "lineNumber"]);
var ARRAY_FIELDS = /* @__PURE__ */ new Set(["tags", "items", "artifacts", "relatedNodes", "emotions", "comments", "derived_from", "changed_paths", "concept_subpath"]);
var BOOLEAN_FIELDS = /* @__PURE__ */ new Set(["dryRun", "dry-run", "date_header", "text-stdin", "overwrite"]);
var JSON_FIELDS = /* @__PURE__ */ new Set(["frontmatter", "set", "append_unique"]);
var GREEDY_TEXT_FIELDS = /* @__PURE__ */ new Set([
  "text",
  "note",
  "summary",
  "description",
  "body",
  "content",
  "inputText",
  "headingsText",
  "input_text",
  "headings_text",
  "title"
]);
var COMMAND_SHORTCUTS = {
  context: "organizer.context",
  search: "organizer.nodes.search",
  claim: "task.claim",
  comment: "comment.add"
};
function hasFlagArg(args, flag) {
  return args.some((arg) => arg === `--${flag}` || arg.startsWith(`--${flag}=`));
}
function resolveCommandShortcut(command, args) {
  const normalized = command.trim();
  if (!normalized) return { command: normalized, args, warnings: [] };
  const directAlias = COMMAND_SHORTCUTS[normalized];
  if (directAlias) {
    return {
      command: directAlias,
      args,
      warnings: [`Shortcut "${normalized}" expanded to "${directAlias}".`]
    };
  }
  const taskStatusShortcut = {
    done: "done",
    wip: "in_progress",
    blocked: "blocked",
    ready: "ready"
  };
  const shortcutStatus = taskStatusShortcut[normalized];
  if (!shortcutStatus) return { command: normalized, args, warnings: [] };
  const nextArgs = [...args];
  if (!hasFlagArg(nextArgs, "taskStatus")) {
    nextArgs.unshift(shortcutStatus);
    nextArgs.unshift("--taskStatus");
  }
  return {
    command: "task.update_status",
    args: nextArgs,
    warnings: [`Shortcut "${normalized}" expanded to "task.update_status --taskStatus ${shortcutStatus}".`]
  };
}
var WRAPPED_CAPABILITIES = {
  "organizer.node.update": "updates"
};
var IDENTITY_FIELDS = /* @__PURE__ */ new Set(["uuid", "key"]);
var EXTRA_FIELD_ALIASES = {
  "organizer.node.create": {
    "extra-type": "type",
    "extra-title": "title",
    "extra-parentKey": "parentKey",
    "extra-parentUuid": "parentUuid",
    "extra-parentType": "parentType",
    "extra-tags": "tags",
    "extra-body": "body",
    "extra-description": "description",
    "extra-comments": "comments",
    "extra-projectRoot": "projectRoot"
  },
  "organizer.node.update": {
    "extra-type": "type",
    "extra-title": "title",
    "extra-tags": "tags",
    "extra-status": "status",
    "extra-priority": "priority",
    "extra-description": "description",
    "extra-comments": "comments"
  }
};
function shellQuote(value) {
  return `"${value.replace(/([\\`"$])/g, "\\$1")}"`;
}
function parseHttpUrl(input) {
  try {
    return new URL(input);
  } catch {
    if (/^localhost(?::\d+)?\//.test(input)) {
      return new URL(`http://${input}`);
    }
    throw new Error(`Invalid URL: ${input}`);
  }
}
function looksLikeHttpUrl(input) {
  return /^https?:\/\//i.test(input) || /^localhost(?::\d+)?\//i.test(input);
}
function hashQueryParams(hashValue) {
  const withoutHash = hashValue.startsWith("#") ? hashValue.slice(1) : hashValue;
  const queryIndex = withoutHash.indexOf("?");
  if (queryIndex < 0) return new URLSearchParams();
  return new URLSearchParams(withoutHash.slice(queryIndex + 1));
}
function parseOrganizerContextUrl(urlValue) {
  const parsed = parseHttpUrl(urlValue);
  const queryParams = parsed.searchParams;
  const hashParams = hashQueryParams(parsed.hash);
  const projectRoot = hashParams.get("projectRoot") ?? queryParams.get("projectRoot");
  const tab = hashParams.get("tab") ?? queryParams.get("tab");
  return {
    sourceUrl: parsed.toString(),
    projectRoot: projectRoot?.trim() || null,
    tab: tab?.trim() || null
  };
}
function buildOrganizerContextFromArgs(args) {
  const { input } = parseCLIArgs("organizer.context", args);
  const urlValue = asString(input.url);
  const parsedFromUrl = urlValue ? parseOrganizerContextUrl(urlValue) : null;
  const projectRoot = asString(input.projectRoot) ?? parsedFromUrl?.projectRoot ?? null;
  const tab = asString(input.tab) ?? parsedFromUrl?.tab ?? "backlog";
  const query = asString(input.query) ?? "status active";
  const parsedLimit = typeof input.limit === "number" && Number.isFinite(input.limit) ? Math.max(1, Math.trunc(input.limit)) : 10;
  return {
    sourceUrl: parsedFromUrl?.sourceUrl ?? null,
    projectRoot,
    tab,
    query,
    limit: parsedLimit
  };
}
function renderOrganizerContextHelp() {
  return [
    "Organizer agent context helper",
    "",
    "Usage:",
    '  thinkspc organizer.context --url "http://localhost:5173/thinking-space/thinking-organizer?tab=backlog&projectRoot=operations%2Fsfw"',
    "  thinkspc organizer.context --projectRoot operations/sfw --tab backlog",
    '  thinkspc organizer.context --projectRoot operations/sfw --query "taskStatus ready" --limit 20',
    "",
    "Purpose:",
    "  Converts human organizer links into agent-native capability command suggestions."
  ].join("\n");
}
function renderOrganizerContextOutput(context) {
  const lines = [];
  lines.push("Organizer agent context");
  if (context.sourceUrl) lines.push(`Source URL: ${context.sourceUrl}`);
  lines.push(`Project root: ${context.projectRoot || "(not provided)"}`);
  lines.push(`Tab: ${context.tab || "(not provided)"}`);
  lines.push(`Default query: ${context.query}`);
  lines.push(`Default limit: ${context.limit}`);
  lines.push("");
  lines.push("Recommended agent commands:");
  const projectRootArg = context.projectRoot ? ` --projectRoot ${shellQuote(context.projectRoot)}` : "";
  const queryArg = ` --query ${shellQuote(context.query)} --limit ${context.limit}`;
  lines.push(`  thinkspc organizer.nodes.search${queryArg}${projectRootArg}`);
  lines.push(`  thinkspc organizer.nodes.search --query "taskStatus ready" --limit ${context.limit}${projectRootArg}`);
  lines.push('  thinkspc task.claim --uuid "<task-uuid>" --owner codex-cli');
  lines.push('  thinkspc comment.add --uuid "<task-uuid>" --text "Progress update" --addedBy codex-cli');
  lines.push('  thinkspc task.update_status --uuid "<task-uuid>" --taskStatus done');
  return lines.join("\n");
}
function parseScalarOrCollectionValue(key, value) {
  return coerceStringInputValue(key, value, "flag");
}
function coerceStringInputValue(key, value, source) {
  const trimmed = value.trim();
  if (NUMBER_FIELDS.has(key)) {
    const parsed = Number(trimmed);
    if (!Number.isFinite(parsed)) {
      throw new Error(`Invalid number for ${source === "file" ? `${key}-file` : `--${key}`}: ${value}`);
    }
    return parsed;
  }
  if (BOOLEAN_FIELDS.has(key)) {
    const normalized = trimmed.toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) return true;
    if (["false", "0", "no", "off"].includes(normalized)) return false;
    if (source === "flag") {
      throw new Error(`Invalid boolean for --${key}: ${value}. Use true or false.`);
    }
    throw new Error(`Invalid boolean in ${key}-file: ${value}. Use true or false.`);
  }
  if (JSON_FIELDS.has(key)) {
    try {
      const parsed = JSON.parse(value);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("expected a JSON object");
      }
      return parsed;
    } catch (error) {
      const prefix = source === "file" ? `${key}-file` : `--${key}`;
      throw new Error(`Invalid JSON for ${prefix}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  if (ARRAY_FIELDS.has(key)) {
    const raw = value.replace(/\r\n/g, "\n").trim();
    if (!raw) return [];
    if (raw.startsWith("[")) {
      try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) throw new Error("expected a JSON array");
        return parsed.map((item) => String(item).trim()).filter(Boolean);
      } catch (error) {
        const prefix = source === "file" ? `${key}-file` : `--${key}`;
        throw new Error(`Invalid array value for ${prefix}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    const parts = raw.includes("\n") ? raw.split("\n") : raw.split(",");
    return parts.map((part) => part.trim()).filter(Boolean);
  }
  return value;
}
function getAliasedKey(capability, key) {
  const aliases = EXTRA_FIELD_ALIASES[capability];
  const canonicalByFieldAlias = resolveCapabilityFieldAlias(capability, key);
  const resolvedInputKey = canonicalByFieldAlias ?? key;
  if (!aliases) return { key: resolvedInputKey };
  const canonical = aliases[resolvedInputKey];
  if (!canonical) return { key: resolvedInputKey };
  if (canonical === "comments") {
    return {
      key: canonical,
      warning: `Flag --${key} is deprecated for ${capability}. Use --comments. For append-only notes, use comment.add with --text.`
    };
  }
  return {
    key: canonical,
    warning: `Flag --${key} is deprecated for ${capability}. Use --${canonical} instead.`
  };
}
function resolveCapabilityFieldAlias(capability, key) {
  const fields = CAPABILITY_INPUT_FIELDS[capability];
  if (!fields || fields.length === 0) return null;
  for (const field of fields) {
    const aliases = expandFieldAliases(field.flag);
    if (aliases.has(key)) return field.flag;
  }
  return null;
}
function expandFieldAliases(field) {
  const aliases = /* @__PURE__ */ new Set([field]);
  const snake = field.replace(/([a-z0-9])([A-Z])/g, "$1_$2").replace(/-/g, "_").toLowerCase();
  const kebab = snake.replace(/_/g, "-");
  const camel = snake.replace(/_([a-z0-9])/g, (_, char) => char.toUpperCase());
  aliases.add(snake);
  aliases.add(kebab);
  aliases.add(camel);
  return aliases;
}
function parseCLIArgs(capability, args) {
  const result = {};
  const warnings = [];
  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (!arg.startsWith("--")) {
      if (capability === "comment.add" && typeof result.text !== "string") {
        const parts = [];
        let cursor = i;
        while (cursor < args.length && !args[cursor].startsWith("--")) {
          parts.push(args[cursor]);
          cursor += 1;
        }
        const text = parts.join(" ").trim();
        if (!text) {
          throw new Error(`Unexpected positional argument: ${arg}`);
        }
        result.text = text;
        warnings.push('Detected positional text for comment.add. Prefer --text "..." (or --text-stdin for multi-line text).');
        i = cursor;
        continue;
      }
      throw new Error(`Unexpected positional argument: ${arg}`);
    }
    const inlineEqualsIndex = arg.indexOf("=");
    const hasInlineValue = inlineEqualsIndex > 2;
    const rawKey = hasInlineValue ? arg.slice(2, inlineEqualsIndex) : arg.slice(2);
    const key = normalizeFileBackedFlagKey(capability, rawKey);
    const inlineValue = hasInlineValue ? arg.slice(inlineEqualsIndex + 1) : null;
    if (!hasInlineValue && BOOLEAN_FIELDS.has(key) && (i + 1 >= args.length || args[i + 1].startsWith("--"))) {
      result[key] = true;
      i++;
      continue;
    }
    if (!hasInlineValue && i + 1 >= args.length) {
      throw new Error(`Missing value for --${key}`);
    }
    const { key: resolvedKey, warning } = getAliasedKey(capability, key);
    if (warning) warnings.push(warning);
    let value = inlineValue ?? args[i + 1];
    i += hasInlineValue ? 1 : 2;
    if (!hasInlineValue && GREEDY_TEXT_FIELDS.has(resolvedKey)) {
      while (i < args.length && !args[i].startsWith("--")) {
        value = `${value} ${args[i]}`;
        i += 1;
      }
    }
    if (resolvedKey.startsWith("extra-")) {
      const extraKey = resolvedKey.slice(6);
      const extraFields = result.extraFields ?? {};
      extraFields[extraKey] = value;
      result.extraFields = extraFields;
    } else {
      result[resolvedKey] = parseScalarOrCollectionValue(resolvedKey, value);
    }
  }
  return { input: result, warnings };
}
function normalizeFileBackedFlagKey(capability, key) {
  const fileSuffix = key.endsWith("-file") ? "-file" : key.endsWith("_file") ? "_file" : null;
  if (!fileSuffix) return key;
  const baseKey = key.slice(0, -fileSuffix.length);
  const canonicalBase = resolveCapabilityFieldAlias(capability, baseKey) ?? baseKey;
  return `${canonicalBase}-file`;
}
function writeCLIWarnings(warnings) {
  for (const warning of warnings) {
    import_node_process.default.stderr.write(`[thinkspc] ${warning}
`);
  }
}
function buildCLIInvokePayload(capability, cliArgs) {
  const vaultRoot = import_node_process.default.env.THINKSPC_VAULT_ROOT || import_node_process.default.env.LTM_VAULT_ROOT;
  if (!vaultRoot) {
    throw new Error(
      "THINKSPC_VAULT_ROOT/LTM_VAULT_ROOT is not set. Use thinkspc (or the ltm compatibility alias), or set it in .env."
    );
  }
  const parsed = parseCLIArgs(capability, cliArgs);
  const { input: inputArgs, warnings } = parsed;
  const actorKind = inputArgs["actor-kind"] ?? "agent";
  const actorId = inputArgs["actor-id"] ?? "claude-code";
  delete inputArgs["actor-kind"];
  delete inputArgs["actor-id"];
  const dryRun = inputArgs.dryRun === true || inputArgs["dry-run"] === true;
  delete inputArgs.dryRun;
  delete inputArgs["dry-run"];
  if (capability === "comment.add" && typeof inputArgs.addedBy !== "string") {
    inputArgs.addedBy = actorId;
  }
  const wrapKey = WRAPPED_CAPABILITIES[capability];
  let input;
  if (wrapKey) {
    const identity = {};
    const wrapped = {};
    for (const [k, v] of Object.entries(inputArgs)) {
      if (IDENTITY_FIELDS.has(k)) {
        identity[k] = v;
      } else {
        wrapped[k] = v;
      }
    }
    input = { ...identity, [wrapKey]: wrapped };
  } else {
    input = inputArgs;
  }
  return {
    payload: {
      vaultRoot,
      request: {
        capability,
        input,
        actor: { kind: actorKind, id: actorId },
        dryRun
      }
    },
    warnings
  };
}
var CAPABILITY_EXAMPLES = {
  "read_note": [
    'thinkspc read_note --path "lifeblood_systems/Understanding Myself/thoughts/2025-12-19.md"'
  ],
  "write_note": [
    `thinkspc write_note --path "lifeblood_systems/Understanding Myself/AI Synthesis/Outputs/Answers/what-are-habits.md" --frontmatter '{"title":"Answer - What Are Habits?"}' --body-file ./answer.md`
  ],
  "patch_note_frontmatter": [
    `thinkspc patch_note_frontmatter --path "lifeblood_systems/Understanding Myself/thoughts/2025-12-19.md" --set '{"related_concepts":["understanding-hunger"]}' --append_unique '{"tags":["brain"]}'`
  ],
  "resolve_ai_synthesis_path": [
    'thinkspc resolve_ai_synthesis_path --domain_root "lifeblood_systems/Understanding Myself" --layer reference --synthesis_type concept --slug what-are-habits',
    'thinkspc resolve_ai_synthesis_path --domain_root "lifeblood_systems/Understanding Myself" --layer reference --synthesis_type source_summary --source_title "The Science of Making and Breaking Habits - Huberman" --slug limbic-friction'
  ],
  "create_ai_synthesis_note": [
    'thinkspc create_ai_synthesis_note --domain_root "lifeblood_systems/Understanding Myself" --layer reference --synthesis_type concept --title "Concept - What Are Habits?" --slug what-are-habits --derived_from "lifeblood_systems/Understanding Myself/AI Synthesis/Reference/Sources/science-of-making-and-breaking-habits.md"',
    'thinkspc create_ai_synthesis_note --domain_root "lifeblood_systems/Understanding Myself" --layer reference --synthesis_type concept --concept_root "Habits" --concept_subpath "Formation" --title "Concept - What Are Habits?" --slug what-are-habits --derived_from "lifeblood_systems/Understanding Myself/AI Synthesis/Reference/Sources/The Science of Making and Breaking Habits - Huberman/what-are-habits.md"'
  ],
  "get_impacted_ai_synthesis_notes": [
    'thinkspc get_impacted_ai_synthesis_notes --changed_paths "lifeblood_systems/Understanding Myself/thoughts/2025-12-19.md"'
  ],
  "update_ai_synthesis_compile_state": [
    'thinkspc update_ai_synthesis_compile_state --path "lifeblood_systems/Understanding Myself/AI Synthesis/Reference/Concepts/what-are-habits.md" --compile_status draft'
  ],
  "list_domain_ai_synthesis_health": [
    'thinkspc list_domain_ai_synthesis_health --domain_root "lifeblood_systems/Understanding Myself"'
  ],
  "organizer.nodes.list_roots": [
    "thinkspc organizer.nodes.list_roots",
    "thinkspc organizer.nodes.list_roots --typeFilter program"
  ],
  "organizer.nodes.list_children": [
    "thinkspc organizer.nodes.list_children --parentKey task-backlog"
  ],
  "organizer.nodes.list_all": [
    "thinkspc organizer.nodes.list_all"
  ],
  "organizer.nodes.search": [
    'thinkspc organizer.nodes.search --query "status active" --limit 10',
    'thinkspc organizer.nodes.search --query "taskStatus ready"'
  ],
  "organizer.node.get": [
    'thinkspc organizer.node.get --uuid "abc-123"'
  ],
  "organizer.node.get_by_key": [
    'thinkspc organizer.node.get_by_key --key "task-backlog"'
  ],
  "organizer.node.read_frontmatter": [
    'thinkspc organizer.node.read_frontmatter --filePath "coding-projects/thinking-space/some-note.md"'
  ],
  "organizer.node.create": [
    'thinkspc organizer.node.create --type task --title "My task" --parentKey task-backlog --projectRoot coding-projects/thinking-space --description "Short description" --extra-record_kind task'
  ],
  "organizer.node.rename": [
    'thinkspc organizer.node.rename --uuid "abc-123" --newTitle "Better title"'
  ],
  "organizer.node.update": [
    'thinkspc organizer.node.update --uuid "abc-123" --status active --priority high',
    'thinkspc organizer.node.update --uuid "abc-123" --description "Updated description"'
  ],
  "organizer.node.move": [
    'thinkspc organizer.node.move --uuid "abc-123" --newParentKey "epic-auth"'
  ],
  "organizer.node.delete": [
    'thinkspc organizer.node.delete --uuid "abc-123"',
    'thinkspc organizer.node.delete --uuid "abc-123" --dryRun'
  ],
  "task.claim": [
    'thinkspc task.claim --uuid "abc-123" --owner claude-code',
    'thinkspc task.claim --uuid "abc-123" --owner codex-cli --taskStatus in_progress'
  ],
  "task.update_status": [
    'thinkspc task.update_status --uuid "abc-123" --taskStatus done',
    'thinkspc task.update_status --uuid "abc-123" --taskStatus blocked --note "Waiting on API key"'
  ],
  "run.log": [
    'thinkspc run.log --title "Session log" --projectRoot coding-projects/thinking-space --agentName claude-code --result success'
  ],
  "handoff.create": [
    'thinkspc handoff.create --title "Auth handoff" --projectRoot coding-projects/thinking-space --summary "Completed login flow" --fromAgent claude-code --toAgent human --parentKey handoffs-agent-operations'
  ],
  "comment.add": [
    'thinkspc comment.add --uuid "abc-123" --text "Implemented parser hardening" --addedBy claude-code',
    'echo "Long comment" | thinkspc comment.add --uuid "abc-123" --addedBy claude-code --text-stdin'
  ],
  "thoughts.create": [
    'thinkspc thoughts.create --folder_path "journal" --filename "reflection" --content "Today I learned..." --title "Daily reflection" --date_header --emotions "curious,focused"'
  ],
  "todos.create": [
    'thinkspc todos.create --folderPath "todos" --date "2025-01-15" --items "Buy groceries,Fix bug,Review PR"'
  ],
  "todos.toggle": [
    'thinkspc todos.toggle --filePath "todos/2025-01-15.md" --lineNumber 3'
  ],
  "tools.files.list_markdown": [
    "thinkspc tools.files.list_markdown",
    "thinkspc tools.files.list_markdown --limit 50"
  ],
  "tools.files.list_pdf": [
    "thinkspc tools.files.list_pdf"
  ],
  "tools.folders.list": [
    "thinkspc tools.folders.list",
    "thinkspc tools.folders.list --limit 20"
  ],
  "tools.excalidraw.preview": [
    'thinkspc tools.excalidraw.preview --inputPath "notes/diagram.md"'
  ],
  "tools.excalidraw.format": [
    'thinkspc tools.excalidraw.format --inputPath "notes/diagram.md"'
  ],
  "tools.pdf.preview": [
    'thinkspc tools.pdf.preview --inputPath "docs/paper.pdf"'
  ],
  "tools.pdf.convert": [
    'thinkspc tools.pdf.convert --inputPath "docs/paper.pdf"'
  ],
  "tools.transcript.preview": [
    'thinkspc tools.transcript.preview --inputText "Speaker 1: Hello..."'
  ],
  "tools.transcript.clean_save": [
    'thinkspc tools.transcript.clean_save --input_text "Speaker 1: Hello..." --output_folder "transcripts" --output_name "meeting-notes"'
  ]
};
function formatExamples(capability) {
  const examples = CAPABILITY_EXAMPLES[capability];
  if (!examples || examples.length === 0) return "";
  return [
    "",
    "Examples:",
    ...examples.map((example) => `  ${example}`)
  ].join("\n");
}
function renderRunnerHelp() {
  return [
    "Thinking Space capability runner",
    "",
    "Usage:",
    "  thinkspc [--text|--json] [--brief|--full] <command>",
    "  thinkspc list",
    "  thinkspc invoke < payload.json",
    "  thinkspc <capability> [--flag value ...]",
    '  thinkspc organizer.context --url "<organizer-url>"',
    "  thinkspc help",
    "  thinkspc <capability> --help",
    "",
    "Notes:",
    "  - Output defaults to text in terminals and json in non-interactive mode.",
    "  - Global output flags (--json, --text) must appear before the command.",
    "  - Output verbosity flags (--brief, --full) must appear before the command.",
    "  - --extra-* is for custom metadata only (extraFields).",
    "  - For first-class fields use first-class flags (e.g., --comments, --description).",
    "  - Use comment.add for append-only task notes.",
    "  - You can load long text values from files via --<flag>-file (e.g., --text-file ./note.md).",
    "  - ltm remains a compatibility alias for thinkspc.",
    "  - Passing a thinking-organizer URL directly is treated like organizer.context.",
    "  - Shortcuts: context, search, claim, comment, done, wip, ready, blocked.",
    "  - For long/multi-line text, use --text-stdin and pipe via stdin:",
    '      echo "my long text" | thinkspc comment.add --uuid <id> --addedBy agent --text-stdin',
    "      thinkspc comment.add --uuid <id> --addedBy agent --text-stdin <<'EOF'",
    '      Multi-line text with $pecial "chars" here.',
    "      EOF",
    "",
    "Discover capabilities:",
    "  thinkspc list"
  ].join("\n");
}
var CAPABILITY_INPUT_FIELDS = {
  "read_note": [{ flag: "path", required: true }],
  "write_note": [
    { flag: "path", required: true },
    { flag: "frontmatter", required: false, note: "JSON object" },
    { flag: "body", required: false, note: "or use --body-file" },
    { flag: "overwrite", required: false, note: "boolean flag" }
  ],
  "patch_note_frontmatter": [
    { flag: "path", required: true },
    { flag: "set", required: false, note: "JSON object" },
    { flag: "append_unique", required: false, note: "JSON object of array fields" }
  ],
  "resolve_ai_synthesis_path": [
    { flag: "domain_root", required: true },
    { flag: "layer", required: false, note: "reference, experiential, operational, integrated" },
    { flag: "synthesis_type", required: true },
    { flag: "source_title", required: false, note: "for source-shaped source summaries" },
    { flag: "concept_root", required: false, note: "for concept-root grouping" },
    { flag: "concept_subpath", required: false, note: "comma-separated conceptual subfolders" },
    { flag: "slug", required: true }
  ],
  "create_ai_synthesis_note": [
    { flag: "domain_root", required: true },
    { flag: "layer", required: true, note: "reference, experiential, operational, integrated" },
    { flag: "synthesis_type", required: true },
    { flag: "title", required: false },
    { flag: "slug", required: false },
    { flag: "source_title", required: false, note: "for source-shaped source summaries" },
    { flag: "concept_root", required: false, note: "for concept-root grouping" },
    { flag: "concept_subpath", required: false, note: "comma-separated conceptual subfolders" },
    { flag: "derived_from", required: true, note: "comma-separated paths" },
    { flag: "if_exists", required: false, note: "error, return_existing, overwrite" }
  ],
  "get_impacted_ai_synthesis_notes": [
    { flag: "changed_paths", required: true, note: "comma-separated paths" }
  ],
  "update_ai_synthesis_compile_state": [
    { flag: "path", required: true },
    { flag: "last_compiled_at", required: false, note: "ISO-8601; defaults to now" },
    { flag: "compile_status", required: true }
  ],
  "list_domain_ai_synthesis_health": [
    { flag: "domain_root", required: true }
  ],
  "organizer.nodes.list_roots": [{ flag: "typeFilter", required: false, note: "e.g. program, epic, task" }],
  "organizer.nodes.list_children": [{ flag: "parentKey", required: true }],
  "organizer.nodes.list_all": [],
  "organizer.nodes.search": [
    { flag: "query", required: true },
    { flag: "limit", required: false, note: "default 10" }
  ],
  "organizer.node.get": [{ flag: "uuid", required: true }],
  "organizer.node.get_by_key": [{ flag: "key", required: true }],
  "organizer.node.read_frontmatter": [{ flag: "filePath", required: true }],
  "organizer.node.create": [
    { flag: "type", required: true, note: "e.g. task, epic, idea" },
    { flag: "title", required: true },
    { flag: "parentKey", required: false },
    { flag: "projectRoot", required: false },
    { flag: "description", required: false },
    { flag: "tags", required: false, note: "comma-separated" },
    { flag: "extra-record_kind", required: false, note: "e.g. task, run, handoff" }
  ],
  "organizer.node.rename": [
    { flag: "uuid", required: true },
    { flag: "newTitle", required: true }
  ],
  "organizer.node.update": [
    { flag: "uuid", required: true },
    { flag: "status", required: false },
    { flag: "priority", required: false },
    { flag: "description", required: false },
    { flag: "tags", required: false, note: "comma-separated" }
  ],
  "organizer.node.move": [
    { flag: "uuid", required: true },
    { flag: "newParentKey", required: true }
  ],
  "organizer.node.delete": [{ flag: "uuid", required: true }],
  "task.claim": [
    { flag: "uuid", required: true },
    { flag: "owner", required: true },
    { flag: "taskStatus", required: false, note: "default in_progress" },
    { flag: "note", required: false }
  ],
  "task.update_status": [
    { flag: "uuid", required: true },
    { flag: "taskStatus", required: true, note: "e.g. in_progress, done, blocked" },
    { flag: "note", required: false }
  ],
  "run.log": [
    { flag: "title", required: true },
    { flag: "projectRoot", required: true },
    { flag: "agentName", required: false },
    { flag: "result", required: false, note: "e.g. success, failure" },
    { flag: "parentKey", required: false }
  ],
  "handoff.create": [
    { flag: "title", required: true },
    { flag: "projectRoot", required: true },
    { flag: "summary", required: true },
    { flag: "fromAgent", required: false },
    { flag: "toAgent", required: false },
    { flag: "parentKey", required: false }
  ],
  "comment.add": [
    { flag: "uuid", required: true },
    { flag: "text", required: true, note: "or use --text-stdin to pipe from stdin" },
    { flag: "addedBy", required: false }
  ],
  "thoughts.create": [
    { flag: "folder_path", required: true },
    { flag: "filename", required: true },
    { flag: "content", required: true },
    { flag: "title", required: false },
    { flag: "date_header", required: false, note: "boolean flag" },
    { flag: "emotions", required: false, note: "comma-separated" }
  ],
  "todos.create": [
    { flag: "folderPath", required: true },
    { flag: "date", required: true, note: "YYYY-MM-DD" },
    { flag: "items", required: true, note: "comma-separated" }
  ],
  "todos.toggle": [
    { flag: "filePath", required: true },
    { flag: "lineNumber", required: true, note: "positive integer" }
  ],
  "tools.files.list_markdown": [{ flag: "limit", required: false }],
  "tools.files.list_pdf": [{ flag: "limit", required: false }],
  "tools.folders.list": [{ flag: "limit", required: false }],
  "tools.excalidraw.preview": [{ flag: "inputPath", required: true }],
  "tools.excalidraw.format": [{ flag: "inputPath", required: true }],
  "tools.pdf.preview": [{ flag: "inputPath", required: true }],
  "tools.pdf.convert": [{ flag: "inputPath", required: true }],
  "tools.transcript.preview": [
    { flag: "inputText", required: true },
    { flag: "headingsText", required: false }
  ],
  "tools.transcript.clean_save": [
    { flag: "input_text", required: true },
    { flag: "output_folder", required: true },
    { flag: "output_name", required: true },
    { flag: "headings_text", required: false },
    { flag: "base_folder", required: false }
  ]
};
function formatInputFields(capability) {
  const fields = CAPABILITY_INPUT_FIELDS[capability];
  if (!fields || fields.length === 0) return "\nFlags: (none)\n";
  const lines = ["", "Flags:"];
  for (const field of fields) {
    const req = field.required ? " (required)" : "";
    const note = field.note ? ` \u2014 ${field.note}` : "";
    lines.push(`  --${field.flag}${req}${note}`);
  }
  return lines.join("\n");
}
function renderCapabilityHelp(capability) {
  const definition = listCapabilitiesOrch().find((entry) => entry.name === capability);
  if (!definition) {
    return `Unknown capability: ${capability}

Run thinkspc list to view available capabilities.`;
  }
  return [
    `Capability: ${definition.name}`,
    `Description: ${definition.description}`,
    `Mode: ${definition.readOnly ? "read-only" : "write"}`,
    "",
    `Usage: thinkspc ${definition.name} --flag value ...`,
    formatInputFields(definition.name),
    ...formatExamples(definition.name).split("\n")
  ].join("\n").trim();
}
function writeText(text) {
  import_node_process.default.stdout.write(`${text}
`);
}
function normalizeOutputFormat(value) {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "json") return "json";
  if (normalized === "text") return "text";
  return null;
}
function normalizeOutputVerbosity(value) {
  const normalized = (value || "").trim().toLowerCase();
  if (normalized === "brief") return "brief";
  if (normalized === "full") return "full";
  if (normalized === "1" || normalized === "true" || normalized === "yes") return "brief";
  if (normalized === "0" || normalized === "false" || normalized === "no") return "full";
  return null;
}
function resolveOutputFormat(args, options) {
  let explicit = null;
  let explicitVerbosity = null;
  const passthrough = [...args];
  while (passthrough.length > 0) {
    const head = passthrough[0];
    if (head === "--json") {
      explicit = "json";
      passthrough.shift();
      continue;
    }
    if (head === "--text") {
      explicit = "text";
      passthrough.shift();
      continue;
    }
    if (head === "--brief") {
      explicitVerbosity = "brief";
      passthrough.shift();
      continue;
    }
    if (head === "--full") {
      explicitVerbosity = "full";
      passthrough.shift();
      continue;
    }
    break;
  }
  const envFormat = normalizeOutputFormat(options?.envFormat ?? import_node_process.default.env.LTM_OUTPUT_FORMAT);
  const envVerbosity = normalizeOutputVerbosity(import_node_process.default.env.LTM_OUTPUT_BRIEF);
  const isTTY = options?.isTTY ?? Boolean(import_node_process.default.stdout.isTTY);
  const format = explicit ?? envFormat ?? (isTTY ? "text" : "json");
  const verbosity = explicitVerbosity ?? envVerbosity ?? "full";
  return { format, verbosity, args: passthrough };
}
async function materializeFileBackedInputs(input) {
  const baseDir = import_node_process.default.env.THINKSPC_CALLER_CWD ? path2.resolve(import_node_process.default.env.THINKSPC_CALLER_CWD) : import_node_process.default.cwd();
  const entries = Object.entries(input);
  for (const [key, rawValue] of entries) {
    if (!key.endsWith("-file")) continue;
    const targetKey = key.slice(0, -5);
    const filePath = typeof rawValue === "string" ? rawValue.trim() : "";
    if (!filePath) {
      throw new Error(`Missing file path for --${key}.`);
    }
    if (input[targetKey] !== void 0) {
      throw new Error(`Cannot combine --${targetKey} with --${key}.`);
    }
    const resolvedFilePath = path2.resolve(baseDir, filePath);
    const fileText = await fsPromises.readFile(resolvedFilePath, "utf-8");
    const normalizedText = fileText.trimEnd();
    if (!normalizedText) {
      throw new Error(`File for --${key} is empty: ${resolvedFilePath}`);
    }
    input[targetKey] = coerceStringInputValue(targetKey, normalizedText, "file");
    delete input[key];
  }
}
function asRecord(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value;
}
function asString(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed || null;
}
function indentText(value, spaces = 2) {
  const prefix = " ".repeat(spaces);
  return value.split("\n").map((line) => `${prefix}${line}`).join("\n");
}
function formatUnknown(value) {
  return (0, import_node_util.inspect)(value, {
    depth: 5,
    colors: Boolean(import_node_process.default.stdout.isTTY),
    compact: false,
    breakLength: 100
  });
}
function nodeLabel(node) {
  const ticket = asString(node.ticket);
  const title = asString(node.title);
  const key = asString(node.key);
  if (ticket && title && !title.startsWith(ticket)) return `${ticket} - ${title}`;
  return ticket || title || key || "Untitled node";
}
function nodeSummary(node) {
  const bits = [];
  const type2 = asString(node.type);
  const status = asString(node.status);
  const taskStatus = asString(node.taskStatus);
  const owner = asString(node.owner);
  if (type2) bits.push(type2);
  const label = nodeLabel(node);
  bits.push(label);
  if (status) bits.push(`status:${status}`);
  if (taskStatus) bits.push(`task:${taskStatus}`);
  if (owner) bits.push(`owner:${owner}`);
  return bits.join(" | ");
}
function renderNodesSection(nodes, heading) {
  const lines = [];
  lines.push(`${heading}: ${nodes.length}`);
  const maxRows = 12;
  const rows = nodes.slice(0, maxRows);
  rows.forEach((entry, index) => {
    const record = asRecord(entry);
    if (!record) {
      lines.push(`  ${index + 1}. ${String(entry)}`);
      return;
    }
    lines.push(`  ${index + 1}. ${nodeSummary(record)}`);
  });
  if (nodes.length > maxRows) {
    lines.push(`  ... ${nodes.length - maxRows} more`);
  }
  return lines;
}
function renderListOutput(payload) {
  const record = asRecord(payload);
  const capabilities = Array.isArray(record?.capabilities) ? record.capabilities : [];
  const lines = [];
  lines.push(`Capabilities (${capabilities.length})`);
  for (const capability of capabilities) {
    const entry = asRecord(capability);
    if (!entry) continue;
    const name = asString(entry.name) || "<unknown>";
    const mode = entry.readOnly === true ? "read" : "write";
    const description = asString(entry.description) || "";
    lines.push(`- ${name} [${mode}]${description ? `: ${description}` : ""}`);
  }
  lines.push("");
  lines.push("Tip: run thinkspc <capability> --help for usage examples.");
  return lines.join("\n");
}
function renderListOutputBrief(payload) {
  const record = asRecord(payload);
  const capabilities = Array.isArray(record?.capabilities) ? record.capabilities : [];
  const names = capabilities.map((capability) => asRecord(capability)).filter((entry) => Boolean(entry)).map((entry) => asString(entry.name)).filter((name) => Boolean(name));
  return `Capabilities (${names.length}): ${names.join(", ")}`;
}
function renderInvokeOutput(payload) {
  const record = asRecord(payload);
  if (!record) return formatUnknown(payload);
  const capability = asString(record.capability) || "<unknown>";
  const ok = record.ok === true;
  const failed = record.ok === false;
  if (!ok && !failed) return formatUnknown(payload);
  const lines = [];
  lines.push(`${ok ? "Success" : "Failure"}: ${capability}`);
  const requestId = asString(record.requestId);
  const auditId = asString(record.auditId);
  if (requestId) lines.push(`Request: ${requestId}`);
  if (auditId) lines.push(`Audit: ${auditId}`);
  const actor = asRecord(record.actor);
  if (actor) {
    const actorKind = asString(actor.kind) || "unknown";
    const actorId = asString(actor.id) || "unknown";
    lines.push(`Actor: ${actorKind}/${actorId}`);
  }
  const warnings = Array.isArray(record.warnings) ? record.warnings : [];
  if (warnings.length > 0) {
    lines.push("Warnings:");
    warnings.forEach((warning) => lines.push(`- ${String(warning)}`));
  }
  if (!ok) {
    const error = asRecord(record.error);
    if (error) {
      lines.push(`Error: ${asString(error.code) || "UNKNOWN"} - ${asString(error.message) || "Unknown error"}`);
    }
    return lines.join("\n");
  }
  const data = asRecord(record.data);
  if (!data) {
    lines.push("Data:");
    lines.push(indentText(formatUnknown(record.data)));
    return lines.join("\n");
  }
  if (Array.isArray(data.nodes)) {
    lines.push(...renderNodesSection(data.nodes, "Nodes"));
    return lines.join("\n");
  }
  if (data.node) {
    const node = asRecord(data.node);
    if (node) {
      lines.push("Node:");
      lines.push(`  ${nodeSummary(node)}`);
      const filePath = asString(node.filePath);
      if (filePath) lines.push(`  file: ${filePath}`);
      return lines.join("\n");
    }
  }
  const dataPath = asString(data.path);
  if (dataPath) lines.push(`Path: ${dataPath}`);
  if (Array.isArray(data.likely_impacted)) {
    lines.push(`Likely impacted: ${data.likely_impacted.length}`);
    data.likely_impacted.slice(0, 12).forEach((entry) => lines.push(`  - ${String(entry)}`));
  }
  if (Array.isArray(data.missing_candidates)) {
    lines.push(`Missing candidates: ${data.missing_candidates.length}`);
    data.missing_candidates.slice(0, 12).forEach((entry) => lines.push(`  - ${String(entry)}`));
  }
  if (Array.isArray(data.missing_canonical_pages)) {
    lines.push(`Missing canonical pages: ${data.missing_canonical_pages.length}`);
    data.missing_canonical_pages.slice(0, 12).forEach((entry) => lines.push(`  - ${String(entry)}`));
  }
  if (Array.isArray(data.stale_pages)) {
    lines.push(`Stale pages: ${data.stale_pages.length}`);
    data.stale_pages.slice(0, 12).forEach((entry) => lines.push(`  - ${String(entry)}`));
  }
  lines.push("Data:");
  lines.push(indentText(formatUnknown(data)));
  return lines.join("\n");
}
function renderInvokeOutputBrief(payload) {
  const record = asRecord(payload);
  if (!record) return formatUnknown(payload);
  const capability = asString(record.capability) || "<unknown>";
  const ok = record.ok === true;
  const failed = record.ok === false;
  if (!ok && !failed) return formatUnknown(payload);
  if (!ok) {
    const error = asRecord(record.error);
    if (error) {
      return `Failure: ${capability}
Error: ${asString(error.code) || "UNKNOWN"} - ${asString(error.message) || "Unknown error"}`;
    }
    return `Failure: ${capability}`;
  }
  const lines = [`Success: ${capability}`];
  const data = asRecord(record.data);
  if (!data) return lines.join("\n");
  if (Array.isArray(data.nodes)) {
    const nodes = data.nodes.slice(0, 5);
    lines.push(`Nodes: ${data.nodes.length}`);
    nodes.forEach((entry, index) => {
      const rec = asRecord(entry);
      lines.push(`  ${index + 1}. ${rec ? nodeSummary(rec) : String(entry)}`);
    });
    if (data.nodes.length > nodes.length) {
      lines.push(`  ... ${data.nodes.length - nodes.length} more`);
    }
    return lines.join("\n");
  }
  if (data.node) {
    const node = asRecord(data.node);
    if (node) {
      lines.push(`Node: ${nodeSummary(node)}`);
      return lines.join("\n");
    }
  }
  const dataPath = asString(data.path);
  if (dataPath) lines.push(`Path: ${dataPath}`);
  if (Array.isArray(data.likely_impacted)) lines.push(`Likely impacted: ${data.likely_impacted.length}`);
  if (Array.isArray(data.missing_canonical_pages)) lines.push(`Missing canonical pages: ${data.missing_canonical_pages.length}`);
  return lines.join("\n");
}
function writeOutput(payload, format, context, verbosity) {
  if (format === "json") {
    writeJson(payload);
    return;
  }
  if (context === "list") {
    writeText(verbosity === "brief" ? renderListOutputBrief(payload) : renderListOutput(payload));
    return;
  }
  writeText(verbosity === "brief" ? renderInvokeOutputBrief(payload) : renderInvokeOutput(payload));
}
async function main() {
  const { format: outputFormat, verbosity: outputVerbosity, args } = resolveOutputFormat(import_node_process.default.argv.slice(2));
  const command = args[0];
  if (!command || command === "help" || command === "--help" || command === "-h") {
    writeText(renderRunnerHelp());
    return;
  }
  if (command === "list") {
    writeOutput(await runCapabilityRunnerCommand("list"), outputFormat, "list", outputVerbosity);
    return;
  }
  if (command === "invoke") {
    const payload = await parseInvokePayload();
    writeOutput(await runCapabilityRunnerCommand("invoke", payload), outputFormat, "invoke", outputVerbosity);
    return;
  }
  if (command && looksLikeHttpUrl(command)) {
    const context = buildOrganizerContextFromArgs(["--url", command, ...args.slice(1)]);
    if (outputFormat === "json") {
      writeJson({
        ok: true,
        command: "organizer.context",
        data: context
      });
    } else {
      writeText(renderOrganizerContextOutput(context));
    }
    return;
  }
  const shortcutResolution = resolveCommandShortcut(command, args.slice(1));
  writeCLIWarnings(shortcutResolution.warnings);
  const resolvedCommand = shortcutResolution.command;
  const resolvedArgs = shortcutResolution.args;
  if (resolvedCommand === "organizer.context") {
    const cliArgs = resolvedArgs;
    if (cliArgs.includes("--help") || cliArgs.includes("-h")) {
      writeText(renderOrganizerContextHelp());
      return;
    }
    const context = buildOrganizerContextFromArgs(cliArgs);
    if (outputFormat === "json") {
      writeJson({
        ok: true,
        command: "organizer.context",
        data: context
      });
    } else {
      writeText(renderOrganizerContextOutput(context));
    }
    return;
  }
  if (listCapabilitiesOrch().some((capability) => capability.name === resolvedCommand)) {
    const cliArgs = resolvedArgs;
    if (cliArgs.includes("--help") || cliArgs.includes("-h")) {
      writeText(renderCapabilityHelp(resolvedCommand));
      return;
    }
    const { payload, warnings } = buildCLIInvokePayload(resolvedCommand, cliArgs);
    const input = payload.request.input;
    await materializeFileBackedInputs(input);
    if (input["text-stdin"] === true) {
      delete input["text-stdin"];
      if (typeof input.text === "string" && input.text.trim()) {
        throw new Error("Cannot combine --text-stdin with --text/--text-file.");
      }
      const stdinText = await readStdin();
      if (!stdinText.trim()) {
        throw new Error("--text-stdin was set but stdin was empty. Pipe text via stdin.");
      }
      input.text = stdinText.trim();
    }
    writeCLIWarnings(warnings);
    writeOutput(await runCapabilityRunnerCommand("invoke", payload), outputFormat, "invoke", outputVerbosity);
    return;
  }
  throw new Error(`Unknown command: ${command ?? "<missing>"}. Use "list", "invoke", organizer shortcuts (e.g. search, claim, done), or a capability name (e.g. organizer.nodes.list_roots).`);
}
async function runCapabilityRunnerCommand(command, payload) {
  ensureRunnerEnvironment();
  if (command === "list") {
    return {
      ok: true,
      capabilities: listCapabilitiesOrch()
    };
  }
  if (!payload) {
    throw new Error("Invoke command requires payload.");
  }
  if (payload.apiBaseUrl) {
    ;
    globalThis.__LTM_API_BASE__ = payload.apiBaseUrl;
  }
  const fs = new NodeVaultFS(payload.vaultRoot);
  if (capabilityRequiresVaultSync(payload.request.capability)) {
    await fullSync(fs);
  }
  return invokeCapabilityOrch(payload.request, { fs });
}
function capabilityRequiresVaultSync(capability) {
  return capability === "organizer.node.create" || capability === "organizer.node.rename" || capability === "organizer.node.update" || capability === "organizer.node.move" || capability === "organizer.node.delete" || capability === "task.claim" || capability === "task.update_status" || capability === "run.log" || capability === "handoff.create" || capability === "comment.add";
}
async function parseInvokePayload() {
  const stdin = await readStdin();
  if (!stdin.trim()) {
    throw new Error("Missing invoke payload in stdin.");
  }
  let parsed;
  try {
    parsed = JSON.parse(stdin);
  } catch (error) {
    throw new Error(`Invalid JSON payload: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!parsed || typeof parsed !== "object") {
    throw new Error("Invoke payload must be a JSON object.");
  }
  const payload = parsed;
  if (!payload.vaultRoot || typeof payload.vaultRoot !== "string") {
    throw new Error('Invoke payload requires a string "vaultRoot".');
  }
  if (!payload.request || typeof payload.request !== "object") {
    throw new Error('Invoke payload requires a "request" object.');
  }
  return {
    vaultRoot: payload.vaultRoot,
    request: payload.request
  };
}
async function readStdin() {
  const chunks = [];
  for await (const chunk of import_node_process.default.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf-8");
}
function writeJson(payload) {
  import_node_process.default.stdout.write(`${JSON.stringify(payload)}
`);
}
function ensureRunnerEnvironment() {
  installLocalStorageShim();
  applyRunnerFeatureFlagsFromEnv();
}
function installLocalStorageShim() {
  if (isUsableLocalStorage(globalThis.localStorage)) return;
  Object.defineProperty(globalThis, "localStorage", {
    value: new InMemoryLocalStorage(),
    configurable: true,
    enumerable: false,
    writable: false
  });
}
function applyRunnerFeatureFlagsFromEnv() {
  const hasAgent = import_node_process.default.env.LTM_AGENT_CAPABILITIES_ENABLED !== void 0;
  const hasFastapi = import_node_process.default.env.LTM_FASTAPI_CAPABILITY_ADAPTER_ENABLED !== void 0;
  if (!hasAgent && !hasFastapi) return;
  let flags = {
    agent_capabilities_enabled: false,
    fastapi_capability_adapter_enabled: false
  };
  try {
    const existingRaw = globalThis.localStorage.getItem(STORAGE_KEYS.capabilityFeatureFlags);
    if (existingRaw) {
      const existing = JSON.parse(existingRaw);
      flags = {
        agent_capabilities_enabled: existing.agent_capabilities_enabled ?? flags.agent_capabilities_enabled,
        fastapi_capability_adapter_enabled: existing.fastapi_capability_adapter_enabled ?? flags.fastapi_capability_adapter_enabled
      };
    }
  } catch {
  }
  if (hasAgent) {
    flags.agent_capabilities_enabled = parseBooleanEnv(import_node_process.default.env.LTM_AGENT_CAPABILITIES_ENABLED);
  }
  if (hasFastapi) {
    flags.fastapi_capability_adapter_enabled = parseBooleanEnv(import_node_process.default.env.LTM_FASTAPI_CAPABILITY_ADAPTER_ENABLED);
  }
  globalThis.localStorage.setItem(STORAGE_KEYS.capabilityFeatureFlags, JSON.stringify(flags));
}
function parseBooleanEnv(value) {
  const normalized = (value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "yes" || normalized === "on";
}
var isDirectRun = (() => {
  if (import_node_process.default.env.LTM_CAPABILITY_RUNNER_CLI === "1") return true;
  try {
    const current = (0, import_node_url.fileURLToPath)(import_meta.url);
    const currentName = path2.basename(current);
    return import_node_process.default.argv.some((arg) => arg.includes(currentName));
  } catch {
    return false;
  }
})();
if (isDirectRun) {
  main().catch((error) => {
    const message = error instanceof Error ? error.message : String(error);
    import_node_process.default.stderr.write(`${message}
`);
    import_node_process.default.exit(1);
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  NodeVaultFS,
  buildCLIInvokePayload,
  buildOrganizerContextFromArgs,
  installLocalStorageShim,
  materializeFileBackedInputs,
  parseOrganizerContextUrl,
  renderCapabilityHelp,
  renderOrganizerContextHelp,
  renderOrganizerContextOutput,
  renderRunnerHelp,
  resolveCommandShortcut,
  resolveOutputFormat,
  runCapabilityRunnerCommand
});
/*! Bundled license information:

@capacitor/core/dist/index.cjs.js:
  (*! Capacitor: https://capacitorjs.com/ - MIT License *)

js-yaml/dist/js-yaml.mjs:
  (*! js-yaml 4.1.1 https://github.com/nodeca/js-yaml @license MIT *)
*/
