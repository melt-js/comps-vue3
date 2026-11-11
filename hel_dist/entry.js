(function (global, factory) {
	typeof exports === 'object' && typeof module !== 'undefined' ? factory(exports, require('hel-lib-proxy')) :
	typeof define === 'function' && define.amd ? define(['exports', 'hel-lib-proxy'], factory) :
	(global = typeof globalThis !== 'undefined' ? globalThis : global || self, factory(global["comps-vue3"] = {}, global.helLibProxy));
})(this, (function (exports, helLibProxy) { 'use strict';

	/*
	|--------------------------------------------------------------------------
	|
	| 对应 package.json/appGroupName
	|
	|--------------------------------------------------------------------------
	*/
	const LIB_NAME = 'comps-vue3';

	/**
	 * 将提供给用户的lib暴露出去（同时也暴露了类型）
	 */
	const dtlib = helLibProxy.exposeLib(LIB_NAME);

	exports.default = dtlib;
	exports.dtlib = dtlib;

	Object.defineProperty(exports, '__esModule', { value: true });

}));
