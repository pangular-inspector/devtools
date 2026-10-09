(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=Object.defineProperty,t=Object.getOwnPropertySymbols,n=Object.prototype.hasOwnProperty,r=Object.prototype.propertyIsEnumerable,i=(t,n,r)=>n in t?e(t,n,{enumerable:!0,configurable:!0,writable:!0,value:r}):t[n]=r,a=(e,a)=>{for(var o in a||={})n.call(a,o)&&i(e,o,a[o]);if(t)for(var o of t(a))r.call(a,o)&&i(e,o,a[o]);return e},o=(e,t,n)=>(i(e,typeof t==`symbol`?t:t+``,n),n),s=globalThis;function c(e){let t=s.__Zone_symbol_prefix;return(typeof t==`string`?t:`__zone_symbol__`)+e}function l(){let e=s.performance;function t(t){e&&e.mark&&e.mark(t)}function n(t,n){e&&e.measure&&e.measure(t,n)}t(`Zone`);let r=class e{constructor(e,t){o(this,`_parent`),o(this,`_name`),o(this,`_properties`),o(this,`_zoneDelegate`),this._parent=e,this._name=t?t.name||`unnamed`:`<root>`,this._properties=t&&t.properties||{},this._zoneDelegate=new l(this,this._parent&&this._parent._zoneDelegate,t)}static assertZonePatched(){if(s.Promise!==fe.ZoneAwarePromise)throw Error("Zone.js has detected that ZoneAwarePromise `(window|global).Promise` has been overwritten.\nMost likely cause is that a Promise polyfill has been loaded after Zone.js (Polyfilling Promise api is not necessary when zone.js is loaded. If you must load one, do so before loading zone.js.)")}static get root(){let t=e.current;for(;t.parent;)t=t.parent;return t}static get current(){return me.zone}static get currentTask(){return he}static __load_patch(r,i,a=!1){if(Object.hasOwn(fe,r)){let e=s[c(`forceDuplicateZoneCheck`)]===!0;if(!a&&e)throw Error(`Already loaded patch: `+r)}else if(!s[`__Zone_disable_`+r]){let a=`Zone:`+r;t(a),fe[r]=i(s,e,pe),n(a,a)}}get parent(){return this._parent}get name(){return this._name}get(e){let t=this.getZoneWith(e);if(t)return t._properties[e]}getZoneWith(e){let t=this;for(;t;){if(Object.hasOwn(t._properties,e))return t;t=t._parent}return null}fork(e){if(!e)throw Error(`ZoneSpec required!`);return this._zoneDelegate.fork(this,e)}wrap(e,t){if(typeof e!=`function`)throw Error(`Expecting function got: `+e);let n=this._zoneDelegate.intercept(this,e,t),r=this;return function(){return r.runGuarded(n,this,arguments,t)}}run(e,t,n,r){me={parent:me,zone:this};try{return this._zoneDelegate.invoke(this,e,t,n,r)}finally{me=me.parent}}runGuarded(e,t=null,n,r){me={parent:me,zone:this};try{try{return this._zoneDelegate.invoke(this,e,t,n,r)}catch(e){if(this._zoneDelegate.handleError(this,e))throw e}}finally{me=me.parent}}runTask(e,t,n){if(e.zone!=this)throw Error(`A task can only be run in the zone of creation! (Creation: `+(e.zone||ne).name+`; Execution: `+this.name+`)`);let r=e,{type:i,data:{isPeriodic:a=!1,isRefreshable:o=!1}={}}=e;if(e.state===re&&(i===de||i===ue))return;let s=e.state!=oe;s&&r._transitionTo(oe,ae);let c=he;he=r,me={parent:me,zone:this};try{i==ue&&e.data&&!a&&!o&&(e.cancelFn=void 0);try{return this._zoneDelegate.invokeTask(this,r,t,n)}catch(e){if(this._zoneDelegate.handleError(this,e))throw e}}finally{let t=e.state;if(t!==re&&t!==ce){if(i==de||a||o&&t===ie)s&&r._transitionTo(ae,oe,ie);else{let e=r._zoneDelegates;this._updateTaskCount(r,-1),s&&r._transitionTo(re,oe,re),o&&(r._zoneDelegates=e)}}me=me.parent,he=c}}scheduleTask(e){if(e.zone&&e.zone!==this){let t=this;for(;t;){if(t===e.zone)throw Error(`can not reschedule task to ${this.name} which is descendants of the original zone ${e.zone.name}`);t=t.parent}}e._transitionTo(ie,re);let t=[];e._zoneDelegates=t,e._zone=this;try{e=this._zoneDelegate.scheduleTask(this,e)}catch(t){throw e._transitionTo(ce,ie,re),this._zoneDelegate.handleError(this,t),t}return e._zoneDelegates===t&&this._updateTaskCount(e,1),e.state==ie&&e._transitionTo(ae,ie),e}scheduleMicroTask(e,t,n,r){return this.scheduleTask(new u(le,e,t,n,r,void 0))}scheduleMacroTask(e,t,n,r,i){return this.scheduleTask(new u(ue,e,t,n,r,i))}scheduleEventTask(e,t,n,r,i){return this.scheduleTask(new u(de,e,t,n,r,i))}cancelTask(e){if(e.zone!=this)throw Error(`A task can only be cancelled in the zone of creation! (Creation: `+(e.zone||ne).name+`; Execution: `+this.name+`)`);if(e.state===ae||e.state===oe){e._transitionTo(se,ae,oe);try{this._zoneDelegate.cancelTask(this,e)}catch(t){throw e._transitionTo(ce,se),this._zoneDelegate.handleError(this,t),t}return this._updateTaskCount(e,-1),e._transitionTo(re,se),e.runCount=-1,e}}_updateTaskCount(e,t){let n=e._zoneDelegates;t==-1&&(e._zoneDelegates=null);for(let r=0;r<n.length;r++)n[r]._updateTaskCount(e.type,t)}};o(r,`__symbol__`,c);let i=r,a={name:``,onHasTask:(e,t,n,r)=>e.hasTask(n,r),onScheduleTask:(e,t,n,r)=>e.scheduleTask(n,r),onInvokeTask:(e,t,n,r,i,a)=>e.invokeTask(n,r,i,a),onCancelTask:(e,t,n,r)=>e.cancelTask(n,r)};class l{constructor(e,t,n){o(this,`_zone`),o(this,`_taskCounts`,{microTask:0,macroTask:0,eventTask:0}),o(this,`_forkDlgt`),o(this,`_forkZS`),o(this,`_forkCurrZone`),o(this,`_interceptDlgt`),o(this,`_interceptZS`),o(this,`_interceptCurrZone`),o(this,`_invokeDlgt`),o(this,`_invokeZS`),o(this,`_invokeCurrZone`),o(this,`_handleErrorDlgt`),o(this,`_handleErrorZS`),o(this,`_handleErrorCurrZone`),o(this,`_scheduleTaskDlgt`),o(this,`_scheduleTaskZS`),o(this,`_scheduleTaskCurrZone`),o(this,`_invokeTaskDlgt`),o(this,`_invokeTaskZS`),o(this,`_invokeTaskCurrZone`),o(this,`_cancelTaskDlgt`),o(this,`_cancelTaskZS`),o(this,`_cancelTaskCurrZone`),o(this,`_hasTaskDlgt`),o(this,`_hasTaskDlgtOwner`),o(this,`_hasTaskZS`),o(this,`_hasTaskCurrZone`),this._zone=e,this._forkZS=n&&(n&&n.onFork?n:t._forkZS),this._forkDlgt=n&&(n.onFork?t:t._forkDlgt),this._forkCurrZone=n&&(n.onFork?this._zone:t._forkCurrZone),this._interceptZS=n&&(n.onIntercept?n:t._interceptZS),this._interceptDlgt=n&&(n.onIntercept?t:t._interceptDlgt),this._interceptCurrZone=n&&(n.onIntercept?this._zone:t._interceptCurrZone),this._invokeZS=n&&(n.onInvoke?n:t._invokeZS),this._invokeDlgt=n&&(n.onInvoke?t:t._invokeDlgt),this._invokeCurrZone=n&&(n.onInvoke?this._zone:t._invokeCurrZone),this._handleErrorZS=n&&(n.onHandleError?n:t._handleErrorZS),this._handleErrorDlgt=n&&(n.onHandleError?t:t._handleErrorDlgt),this._handleErrorCurrZone=n&&(n.onHandleError?this._zone:t._handleErrorCurrZone),this._scheduleTaskZS=n&&(n.onScheduleTask?n:t._scheduleTaskZS),this._scheduleTaskDlgt=n&&(n.onScheduleTask?t:t._scheduleTaskDlgt),this._scheduleTaskCurrZone=n&&(n.onScheduleTask?this._zone:t._scheduleTaskCurrZone),this._invokeTaskZS=n&&(n.onInvokeTask?n:t._invokeTaskZS),this._invokeTaskDlgt=n&&(n.onInvokeTask?t:t._invokeTaskDlgt),this._invokeTaskCurrZone=n&&(n.onInvokeTask?this._zone:t._invokeTaskCurrZone),this._cancelTaskZS=n&&(n.onCancelTask?n:t._cancelTaskZS),this._cancelTaskDlgt=n&&(n.onCancelTask?t:t._cancelTaskDlgt),this._cancelTaskCurrZone=n&&(n.onCancelTask?this._zone:t._cancelTaskCurrZone),this._hasTaskZS=null,this._hasTaskDlgt=null,this._hasTaskDlgtOwner=null,this._hasTaskCurrZone=null;let r=n&&n.onHasTask,i=t&&t._hasTaskZS;(r||i)&&(this._hasTaskZS=r?n:a,this._hasTaskDlgt=t,this._hasTaskDlgtOwner=this,this._hasTaskCurrZone=this._zone,n.onScheduleTask||(this._scheduleTaskZS=a,this._scheduleTaskDlgt=t,this._scheduleTaskCurrZone=this._zone),n.onInvokeTask||(this._invokeTaskZS=a,this._invokeTaskDlgt=t,this._invokeTaskCurrZone=this._zone),n.onCancelTask||(this._cancelTaskZS=a,this._cancelTaskDlgt=t,this._cancelTaskCurrZone=this._zone))}get zone(){return this._zone}fork(e,t){return this._forkZS?this._forkZS.onFork(this._forkDlgt,this.zone,e,t):new i(e,t)}intercept(e,t,n){return this._interceptZS?this._interceptZS.onIntercept(this._interceptDlgt,this._interceptCurrZone,e,t,n):t}invoke(e,t,n,r,i){return this._invokeZS?this._invokeZS.onInvoke(this._invokeDlgt,this._invokeCurrZone,e,t,n,r,i):t.apply(n,r)}handleError(e,t){return!this._handleErrorZS||this._handleErrorZS.onHandleError(this._handleErrorDlgt,this._handleErrorCurrZone,e,t)}scheduleTask(e,t){let n=t;if(this._scheduleTaskZS)this._hasTaskZS&&n._zoneDelegates.push(this._hasTaskDlgtOwner),n=this._scheduleTaskZS.onScheduleTask(this._scheduleTaskDlgt,this._scheduleTaskCurrZone,e,t),n||=t;else if(t.scheduleFn)t.scheduleFn(t);else if(t.type==le)v(t);else throw Error(`Task is missing scheduleFn.`);return n}invokeTask(e,t,n,r){return this._invokeTaskZS?this._invokeTaskZS.onInvokeTask(this._invokeTaskDlgt,this._invokeTaskCurrZone,e,t,n,r):t.callback.apply(n,r)}cancelTask(e,t){let n;if(this._cancelTaskZS)n=this._cancelTaskZS.onCancelTask(this._cancelTaskDlgt,this._cancelTaskCurrZone,e,t);else{if(!t.cancelFn)throw Error(`Task is not cancelable`);n=t.cancelFn(t)}return n}hasTask(e,t){try{this._hasTaskZS&&this._hasTaskZS.onHasTask(this._hasTaskDlgt,this._hasTaskCurrZone,e,t)}catch(t){this.handleError(e,t)}}_updateTaskCount(e,t){let n=this._taskCounts,r=n[e],i=n[e]=r+t;if(i<0)throw Error(`More tasks executed then were scheduled.`);if(r==0||i==0){let t={microTask:n.microTask>0,macroTask:n.macroTask>0,eventTask:n.eventTask>0,change:e};this.hasTask(this._zone,t)}}}class u{constructor(e,t,n,r,i,a){if(o(this,`type`),o(this,`source`),o(this,`invoke`),o(this,`callback`),o(this,`data`),o(this,`scheduleFn`),o(this,`cancelFn`),o(this,`_zone`,null),o(this,`runCount`,0),o(this,`_zoneDelegates`,null),o(this,`_state`,`notScheduled`),this.type=e,this.source=t,this.data=r,this.scheduleFn=i,this.cancelFn=a,!n)throw Error(`callback is not defined`);this.callback=n;let c=this;this.invoke=e===de&&r&&r.useG?u.invokeTask:function(){return u.invokeTask.call(s,c,this,arguments)}}static invokeTask(e,t,n){e||=this,ge++;try{return e.runCount++,e.zone.runTask(e,t,n)}finally{try{ge===1&&!s[m]&&te()}finally{ge--}}}get zone(){return this._zone}get state(){return this._state}cancelScheduleRequest(){this._transitionTo(re,ie)}_transitionTo(e,t,n){if(this._state===t||this._state===n)this._state=e,e==re&&(this._zoneDelegates=null);else throw Error(`${this.type} '${this.source}': can not transition to '${e}', expecting state '${t}'${n?` or '`+n+`'`:``}, was '${this._state}'.`)}toString(){return this.data&&this.data.handleId!==void 0?this.data.handleId.toString():Object.prototype.toString.call(this)}toJSON(){return{type:this.type,state:this.state,source:this.source,zone:this.zone.name,runCount:this.runCount}}}let d=c(`setTimeout`),f=c(`Promise`),p=c(`then`),m=c(`enable_native_microtask_draining`),h=[],g=!1,_;function ee(e){!_&&s[f]&&(_=s[f].resolve(0)),_?(_[p]??_.then).call(_,e):s[d](e,0)}function v(e){let t=s[m],n=t&&h.length===0&&!g,r=!t&&ge===0&&h.length===0;(n||r)&&ee(te),e&&h.push(e)}function te(){if(!g){g=!0;try{for(;h.length;){let e=h;h=[];for(let t of e)try{t.zone.runTask(t,null,null)}catch(e){pe.onUnhandledError(e)}}}finally{if(s[m])g=!1,pe.microtaskDrainDone();else try{pe.microtaskDrainDone()}finally{g=!1}}}}let ne={name:`NO ZONE`},re=`notScheduled`,ie=`scheduling`,ae=`scheduled`,oe=`running`,se=`canceling`,ce=`unknown`,le=`microTask`,ue=`macroTask`,de=`eventTask`,fe=Object.create(null),pe={symbol:c,currentZoneFrame:()=>me,onUnhandledError:_e,microtaskDrainDone:_e,scheduleMicroTask:v,showUncaughtError:()=>!i[c(`ignoreConsoleErrorUncaughtError`)],patchEventTarget:()=>[],patchOnProperties:_e,patchMethod:()=>_e,bindArguments:()=>[],patchThen:()=>_e,patchMacroTask:()=>_e,patchEventPrototype:()=>_e,getGlobalObjects:()=>void 0,ObjectDefineProperty:()=>_e,ObjectGetOwnPropertyDescriptor:()=>void 0,ObjectCreate:()=>void 0,ArraySlice:()=>[],patchClass:()=>_e,wrapWithCurrentZone:()=>_e,filterProperties:()=>[],attachOriginToPatched:()=>_e,_redefineProperty:()=>_e,patchCallbacks:()=>_e,nativeScheduleMicroTask:ee},me={parent:null,zone:new i(null,null)},he=null,ge=0;function _e(){}return n(`Zone`,`Zone`),i}function u(){let e=globalThis,t=e[c(`forceDuplicateZoneCheck`)]===!0;if(e.Zone&&(t||typeof e.Zone.__symbol__!=`function`))throw Error(`Zone already loaded.`);return e.Zone??=l(),e.Zone}var d=Object.getOwnPropertyDescriptor,f=Object.defineProperty,p=Object.getPrototypeOf,m=Object.create,h=Array.prototype.slice,g=`addEventListener`,_=`removeEventListener`,ee=c(g),v=c(_),te=`true`,ne=`false`,re=c(``);function ie(e,t){return Zone.current.wrap(e,t)}function ae(e,t,n,r,i){return Zone.current.scheduleMacroTask(e,t,n,r,i)}var oe=c,se=typeof window<`u`,ce=se?window:void 0,le=se&&ce||globalThis,ue=`removeAttribute`;function de(e,t){for(let n=e.length-1;n>=0;n--)typeof e[n]==`function`&&(e[n]=ie(e[n],t+`_`+n));return e}function fe(e,t){let n=e.constructor.name;for(let r=0;r<t.length;r++){let i=t[r],a=e[i];if(a){if(!pe(d(e,i)))continue;e[i]=(e=>{let t=function(){return e.apply(this,de(arguments,n+`.`+i))};return De(t,e),t})(a)}}}function pe(e){return e?e.writable===!1?!1:typeof e.get!=`function`||e.set!==void 0:!0}var me=typeof WorkerGlobalScope<`u`&&self instanceof WorkerGlobalScope,he=!(`nw`in le)&&le.process!==void 0&&le.process.toString()===`[object process]`,ge=!he&&!me&&!!(se&&ce.HTMLElement),_e=le.process!==void 0&&le.process.toString()===`[object process]`&&!me&&!!(se&&ce.HTMLElement),ve=Object.create(null),ye=oe(`enable_beforeunload`),be=function(e){if(e||=le.event,!e)return;let t=ve[e.type];t||=ve[e.type]=oe(`ON_PROPERTY`+e.type);let n=this||e.target||le,r=n[t],i;if(ge&&n===ce&&e.type===`error`){let t=e;i=r&&r.call(this,t.message,t.filename,t.lineno,t.colno,t.error),i===!0&&e.preventDefault()}else i=r&&r.apply(this,arguments),e.type===`beforeunload`&&le[ye]&&typeof i==`string`?e.returnValue=i:i!=null&&!i&&e.preventDefault();return i};function xe(e,t,n){let r=d(e,t);if(!r&&n&&d(n,t)&&(r={enumerable:!0,configurable:!0}),!r||!r.configurable)return;let i=oe(`on`+t+`patched`);if(Object.hasOwn(e,i)&&e[i])return;delete r.writable,delete r.value;let a=r.get,o=r.set,s=t.slice(2),c=ve[s];c||=ve[s]=oe(`ON_PROPERTY`+s),r.set=function(t){let n=this;!n&&e===le&&(n=le),n&&(typeof n[c]==`function`&&n.removeEventListener(s,be),o?.call(n,null),n[c]=t,typeof t==`function`&&n.addEventListener(s,be,!1))},r.get=function(){let n=this;if(!n&&e===le&&(n=le),!n)return null;let i=n[c];if(i)return i;if(a){let e=a.call(this);if(e)return r.set.call(this,e),typeof n[ue]==`function`&&n.removeAttribute(t),e}return null},f(e,t,r),e[i]=!0}function Se(e,t,n){if(t)for(let r=0;r<t.length;r++)xe(e,`on`+t[r],n);else{let t=[];for(let n in e)n.slice(0,2)==`on`&&t.push(n);for(let r=0;r<t.length;r++)xe(e,t[r],n)}}var Ce=oe(`originalInstance`);function we(e){let t=le[e];if(!t)return;le[oe(e)]=t,le[e]=function(){let n=de(arguments,e);switch(n.length){case 0:this[Ce]=new t;break;case 1:this[Ce]=new t(n[0]);break;case 2:this[Ce]=new t(n[0],n[1]);break;case 3:this[Ce]=new t(n[0],n[1],n[2]);break;case 4:this[Ce]=new t(n[0],n[1],n[2],n[3]);break;default:throw Error(`Arg list too long.`)}},De(le[e],t);let n=new t(function(){}),r;for(r in n)(e!==`XMLHttpRequest`||r!==`responseBlob`)&&(function(t){typeof n[t]==`function`?le[e].prototype[t]=function(){return this[Ce][t].apply(this[Ce],arguments)}:f(le[e].prototype,t,{set:function(n){typeof n==`function`?(this[Ce][t]=ie(n,e+`.`+t),De(this[Ce][t],n)):this[Ce][t]=n},get:function(){return this[Ce][t]}})})(r);for(r in t)r!==`prototype`&&Object.hasOwn(t,r)&&(le[e][r]=t[r])}function Te(e,t,n){let r=e;for(;r&&!Object.hasOwn(r,t);)r=p(r);!r&&e[t]&&(r=e);let i=oe(t),a=null;if(r&&(!(a=r[i])||!Object.hasOwn(r,i))&&(a=r[i]=r[t],pe(r&&d(r,t)))){let e=n(a,i,t);r[t]=function(){return e(this,arguments)},De(r[t],a)}return a}function Ee(e,t,n){let r=null;function i(e){let t=e.data;return t.args[t.cbIdx]=function(){e.invoke.apply(this,arguments)},r.apply(t.target,t.args),e}r=Te(e,t,e=>function(t,r){let a=n(t,r);return a.cbIdx>=0&&typeof r[a.cbIdx]==`function`?ae(a.name,r[a.cbIdx],a,i):e.apply(t,r)})}function De(e,t){e[oe(`OriginalDelegate`)]=t}function Oe(e){return typeof e==`function`}function ke(e){return typeof e==`number`}var Ae={useG:!0},je=Object.create(null),Me={},Ne=RegExp(`^`+re+`(\\w+)(true|false)$`),Pe=oe(`propagationStopped`),Fe=[`capture`,`once`,`passive`,`signal`];function Ie(e,t){let n=(t?t(e):e)+ne,r=(t?t(e):e)+te,i=re+n,a=re+r;je[e]={[ne]:i,[te]:a}}function Le(e,t,n,r){let i=r&&r.add||g,o=r&&r.rm||_,s=r&&r.listeners||`eventListeners`,c=r&&r.rmAll||`removeAllListeners`,l=oe(i),u=`.`+i+`:`,d=function(e,t,n){if(e.isRemoved)return;let r=e.callback;typeof r==`object`&&r.handleEvent&&(e.callback=e=>r.handleEvent(e),e.originalDelegate=r);let i;try{e.invoke(e,t,[n])}catch(e){i=e}let a=e.options;if(a&&typeof a==`object`&&a.once){let r=e.originalDelegate?e.originalDelegate:e.callback;t[o].call(t,n.type,r,a)}return i};function f(n,r,i){if(r||=e.event,!r)return;let a=n||r.target||e,o=a[je[r.type][i?te:ne]];if(o){let e=[];if(o.length===1){let t=d(o[0],a,r);t&&e.push(t)}else{let t=o.slice();for(let n=0;n<t.length&&!(r&&r[Pe]===!0);n++){let i=d(t[n],a,r);i&&e.push(i)}}if(e.length===1)throw e[0];for(let n=0;n<e.length;n++){let r=e[n];t.nativeScheduleMicroTask(()=>{throw r})}}}let m=function(e){return f(this,e,!1)},h=function(e){return f(this,e,!0)};function ee(t,n){if(!t)return!1;let r=!0;n&&n.useG!==void 0&&(r=n.useG);let d=n&&n.vh,f=!0;n&&n.chkDup!==void 0&&(f=n.chkDup);let g=!1;n&&n.rt!==void 0&&(g=n.rt);let _=t;for(;_&&!Object.hasOwn(_,i);)_=p(_);if(!_&&t[i]&&(_=t),!_||_[l])return!1;let ee=n&&n.eventNameToString,v={},ie=_[l]=_[i],ae=_[oe(o)]=_[o],se=_[oe(s)]=_[s],ce=_[oe(c)]=_[c],le;n&&n.prepend&&(le=_[oe(n.prepend)]=_[n.prepend]);function ue(e,t){return t?typeof e==`boolean`?{capture:e,passive:!0}:e?(typeof e==`object`&&e.passive!==!1&&(e.passive=!0),e):{passive:!0}:e}let de=function(e){if(!v.isExisting)return ie.call(v.target,v.eventName,v.capture?h:m,v.options)},fe=function(e){if(!e.isRemoved){let t=je[e.eventName],n;t&&(n=t[e.capture?te:ne]);let r=n&&e.target[n];if(r){for(let t=0;t<r.length;t++)if(r[t]===e){r.splice(t,1),e.isRemoved=!0,e.removeAbortListener&&=(e.removeAbortListener(),null),r.length===0&&(e.allRemoved=!0,e.target[n]=null);break}}}if(e.allRemoved)return ae.call(e.target,e.eventName,e.capture?h:m,e.options)},pe=function(e){return ie.call(v.target,v.eventName,e.invoke,v.options)},me=function(e){return le.call(v.target,v.eventName,e.invoke,v.options)},ge=function(e){return ae.call(e.target,e.eventName,e.invoke,e.options)},_e=r?de:pe,ve=r?fe:ge,ye=n?.diff||function(e,t){let n=typeof t;return n===`function`&&e.callback===t||n===`object`&&e.originalDelegate===t},be=Zone[oe(`UNPATCHED_EVENTS`)],xe=e[oe(`PASSIVE_EVENTS`)];function Se(e){if(typeof e!=`object`||!e)return e;let t=a({},e);for(let n of Fe)!Object.hasOwn(t,n)&&n in e&&(t[n]=e[n]);return t}let Ce=function(t,i,a,o,s=!1,c=!1){return function(){let l=this||e,u=arguments[0];n&&n.transferEventName&&(u=n.transferEventName(u));let p=arguments[1];if(!p||he&&u===`uncaughtException`)return t.apply(this,arguments);let m=!1;if(typeof p!=`function`){if(!p.handleEvent)return t.apply(this,arguments);m=!0}if(d&&!d(t,p,l,arguments))return;let h=!!xe&&xe.indexOf(u)!==-1,g=ue(Se(arguments[2]),h),_=g?.signal;if(_?.aborted)return;if(be){for(let e=0;e<be.length;e++)if(u===be[e])return h?t.call(l,u,p,g):t.apply(this,arguments)}let re=g?typeof g==`boolean`||g.capture:!1,ie=g&&typeof g==`object`?g.once:!1,ae=Zone.current,oe=je[u];oe||=(Ie(u,ee),je[u]);let se=oe[re?te:ne],ce=l[se],le=!1;if(ce){if(le=!0,f){for(let e=0;e<ce.length;e++)if(ye(ce[e],p))return}}else ce=l[se]=[];let de,fe=l.constructor.name,pe=Me[fe];pe&&(de=pe[u]),de||=fe+i+(ee?ee(u):u),v.options=g,ie&&(v.options.once=!1),v.target=l,v.capture=re,v.eventName=u,v.isExisting=le;let me=r?Ae:void 0;me&&(me.taskData=v),_&&(v.options.signal=void 0);let ge=ae.scheduleEventTask(de,p,me,a,o);if(_){v.options.signal=_;let e=()=>ge.zone.cancelTask(ge);t.call(_,`abort`,e,{once:!0}),ge.removeAbortListener=()=>_.removeEventListener(`abort`,e)}if(v.target=null,me&&(me.taskData=null),ie&&(v.options.once=!0),typeof ge.options!=`boolean`&&(ge.options=g),ge.target=l,ge.capture=re,ge.eventName=u,m&&(ge.originalDelegate=p),c?ce.unshift(ge):ce.push(ge),s)return l}};return _[i]=Ce(ie,u,_e,ve,g),le&&(_.prependListener=Ce(le,`.prependListener:`,me,ve,g,!0)),_[o]=function(){let t=this||e,r=arguments[0];n&&n.transferEventName&&(r=n.transferEventName(r));let i=arguments[2],a=i?typeof i==`boolean`||i.capture:!1,o=arguments[1];if(!o)return ae.apply(this,arguments);if(d&&!d(ae,o,t,arguments))return;let s=je[r],c;s&&(c=s[a?te:ne]);let l=c&&t[c];if(l)for(let e=0;e<l.length;e++){let n=l[e];if(ye(n,o)){if(l.splice(e,1),n.isRemoved=!0,l.length===0&&(n.allRemoved=!0,t[c]=null,!a&&typeof r==`string`)){let e=re+`ON_PROPERTY`+r;t[e]=null}return n.zone.cancelTask(n),g?t:void 0}}return ae.apply(this,arguments)},_[s]=function(){let t=this||e,r=arguments[0];n&&n.transferEventName&&(r=n.transferEventName(r));let i=[],a=Re(t,ee?ee(r):r);for(let e=0;e<a.length;e++){let t=a[e],n=t.originalDelegate?t.originalDelegate:t.callback;i.push(n)}return i},_[c]=function(){let t=this||e,r=arguments[0];if(r){n&&n.transferEventName&&(r=n.transferEventName(r));let e=je[r];if(e){let n=e[ne],i=e[te],a=t[n],s=t[i];if(a){let e=a.slice();for(let t=0;t<e.length;t++){let n=e[t],i=n.originalDelegate?n.originalDelegate:n.callback;this[o].call(this,r,i,n.options)}}if(s){let e=s.slice();for(let t=0;t<e.length;t++){let n=e[t],i=n.originalDelegate?n.originalDelegate:n.callback;this[o].call(this,r,i,n.options)}}}}else{let e=Object.keys(t);for(let t=0;t<e.length;t++){let n=e[t],r=Ne.exec(n),i=r&&r[1];i&&i!==`removeListener`&&this[c].call(this,i)}this[c].call(this,`removeListener`)}if(g)return this},De(_[i],ie),De(_[o],ae),ce&&De(_[c],ce),se&&De(_[s],se),!0}let v=[];for(let e=0;e<n.length;e++)v[e]=ee(n[e],r);return v}function Re(e,t){if(!t){let n=[];for(let r in e){let i=Ne.exec(r),a=i&&i[1];if(a&&(!t||a===t)){let t=e[r];if(t)for(let e=0;e<t.length;e++)n.push(t[e])}}return n}let n=je[t];n||=(Ie(t),je[t]);let r=e[n[ne]],i=e[n[te]];return r?i?r.concat(i):r.slice():i?i.slice():[]}function ze(e,t){let n=e.Event;n&&n.prototype&&t.patchMethod(n.prototype,`stopImmediatePropagation`,e=>function(t,n){t[Pe]=!0,e&&e.apply(t,n)})}function Be(e,t){t.patchMethod(e,`queueMicrotask`,e=>function(e,t){Zone.current.scheduleMicroTask(`queueMicrotask`,t[0])})}var Ve=oe(`zoneTask`);function He(e,t,n,r){let i=null,a=null;t+=r,n+=r;let o={};function s(t){let n=t.data;n.args[0]=function(){return t.invoke.apply(this,arguments)};let r=i.apply(e,n.args);return ke(r)?n.handleId=r:(n.handle=r,n.isRefreshable=Oe(r?.refresh)),t}function c(t){let{handle:n,handleId:r}=t.data;return a.call(e,n??r)}i=Te(e,t,n=>function(i,a){if(Oe(a[0])){let e={isRefreshable:!1,isPeriodic:r===`Interval`,delay:r===`Timeout`||r===`Interval`?a[1]||0:void 0,args:a},n=a[0];a[0]=function(){try{return n.apply(this,arguments)}finally{let{handle:t,handleId:n,isPeriodic:r,isRefreshable:i}=e;!r&&!i&&(n?delete o[n]:t&&(t[Ve]=null))}};let i=ae(t,a[0],e,s,c);if(!i)return i;let{handleId:l,handle:u,isRefreshable:d,isPeriodic:f}=i.data;if(l)o[l]=i;else if(u&&(u[Ve]=i,d&&!f)){let e=u.refresh;u.refresh=function(){let{zone:t,state:n}=i;return n===`notScheduled`?(i._state=`scheduled`,t._updateTaskCount(i,1)):n===`running`&&(i._state=`scheduling`),e.call(this)}}return u??l??i}return n.apply(e,a)}),a=Te(e,n,t=>function(n,r){let i=r[0],a;ke(i)?(a=o[i],delete o[i]):(a=i?.[Ve],a?i[Ve]=null:a=i),a?.type?a.cancelFn&&a.zone.cancelTask(a):t.apply(e,r)})}function Ue(e,t){let{isBrowser:n,isMix:r}=t.getGlobalObjects();(n||r)&&e.customElements&&`customElements`in e&&t.patchCallbacks(t,e.customElements,`customElements`,`define`,[`connectedCallback`,`disconnectedCallback`,`adoptedCallback`,`attributeChangedCallback`,`formAssociatedCallback`,`formDisabledCallback`,`formResetCallback`,`formStateRestoreCallback`])}function We(e,t){if(Zone[t.symbol(`patchEventTarget`)])return;let{eventNames:n,zoneSymbolEventNames:r,TRUE_STR:i,FALSE_STR:a,ZONE_SYMBOL_PREFIX:o}=t.getGlobalObjects();for(let e=0;e<n.length;e++){let t=n[e],s=t+a,c=t+i,l=o+s,u=o+c;r[t]={},r[t][a]=l,r[t][i]=u}let s=e.EventTarget;if(s&&s.prototype)return t.patchEventTarget(e,t,[s&&s.prototype]),!0}function Ge(e,t){t.patchEventPrototype(e,t)}function Ke(e,t,n){if(!n||n.length===0)return t;let r=n.filter(t=>t.target===e);if(r.length===0)return t;let i=r[0].ignoreProperties;return t.filter(e=>i.indexOf(e)===-1)}function qe(e,t,n,r){e&&Se(e,Ke(e,t,n),r)}function Je(e){return Object.getOwnPropertyNames(e).filter(e=>e.startsWith(`on`)&&e.length>2).map(e=>e.substring(2))}function Ye(e,t){if(he&&!_e||Zone[e.symbol(`patchEvents`)])return;let n=t.__Zone_ignore_on_properties,r=[];if(ge){let e=window;r=r.concat([`Document`,`SVGElement`,`Element`,`HTMLElement`,`HTMLBodyElement`,`HTMLMediaElement`,`HTMLFrameSetElement`,`HTMLFrameElement`,`HTMLIFrameElement`,`HTMLMarqueeElement`,`Worker`]),qe(e,Je(e),n,p(e))}r=r.concat([`XMLHttpRequest`,`XMLHttpRequestEventTarget`,`IDBIndex`,`IDBRequest`,`IDBOpenDBRequest`,`IDBDatabase`,`IDBTransaction`,`IDBCursor`,`WebSocket`]);for(let e=0;e<r.length;e++){let i=t[r[e]];i!=null&&i.prototype&&qe(i.prototype,Je(i.prototype),n)}}function Xe(e){e.__load_patch(`timers`,e=>{let t=`clear`;He(e,`set`,t,`Timeout`),He(e,`set`,t,`Interval`),He(e,`set`,t,`Immediate`)}),e.__load_patch(`requestAnimationFrame`,e=>{He(e,`request`,`cancel`,`AnimationFrame`),He(e,`mozRequest`,`mozCancel`,`AnimationFrame`),He(e,`webkitRequest`,`webkitCancel`,`AnimationFrame`)}),e.__load_patch(`blocking`,(e,t)=>{let n=[`alert`,`prompt`,`confirm`];for(let r=0;r<n.length;r++){let i=n[r];Te(e,i,(n,r,i)=>function(r,a){return t.current.run(n,e,a,i)})}}),e.__load_patch(`EventTarget`,(e,t,n)=>{Ge(e,n),We(e,n);let r=e.XMLHttpRequestEventTarget;r&&r.prototype&&n.patchEventTarget(e,n,[r.prototype])}),e.__load_patch(`MutationObserver`,(e,t,n)=>{we(`MutationObserver`),we(`WebKitMutationObserver`)}),e.__load_patch(`IntersectionObserver`,(e,t,n)=>{we(`IntersectionObserver`)}),e.__load_patch(`FileReader`,(e,t,n)=>{we(`FileReader`)}),e.__load_patch(`on_property`,(e,t,n)=>{Ye(n,e)}),e.__load_patch(`customElements`,(e,t,n)=>{Ue(e,n)}),e.__load_patch(`XHR`,(e,t)=>{c(e);let n=oe(`xhrTask`),r=oe(`xhrSync`),i=oe(`xhrListener`),a=oe(`xhrScheduled`),o=oe(`xhrURL`),s=oe(`xhrErrorBeforeScheduled`);function c(e){let c=e.XMLHttpRequest;if(!c)return;let l=c.prototype;function u(e){return e[n]}let d=l[ee],f=l[v];if(!d){let t=e.XMLHttpRequestEventTarget;if(t){let e=t.prototype;d=e[ee],f=e[v]}}let p=`readystatechange`,m=`scheduled`;function h(e){let r=e.data,o=r.target;o[a]=!1,o[s]=!1;let c=o[i];d||(d=o[ee],f=o[v]),c&&f.call(o,p,c);let l=o[i]=()=>{if(o.readyState===o.DONE){if(!r.aborted&&o[a]&&e.state===m){let n=o[t.__symbol__(`loadfalse`)];if(o.status!==0&&n&&n.length>0){let i=e.invoke;e.invoke=function(){let n=o[t.__symbol__(`loadfalse`)];for(let t=0;t<n.length;t++)n[t]===e&&n.splice(t,1);!r.aborted&&e.state===m&&i.call(e)},n.push(e)}else e.invoke()}else!r.aborted&&o[a]===!1&&(o[s]=!0)}};return d.call(o,p,l),o[n]||(o[n]=e),ie.apply(o,r.args),o[a]=!0,e}function g(){}function _(e){let t=e.data;return t.aborted=!0,se.apply(t.target,t.args)}let te=Te(l,`open`,()=>function(e,t){return e[r]=t[2]==0,e[o]=t[1],te.apply(e,t)}),ne=oe(`fetchTaskAborting`),re=oe(`fetchTaskScheduling`),ie=Te(l,`send`,()=>function(e,n){if(t.current[re]===!0||e[r])return ie.apply(e,n);{let t={target:e,url:e[o],isPeriodic:!1,args:n,aborted:!1},r=ae(`XMLHttpRequest.send`,g,t,h,_);e&&e[s]===!0&&!t.aborted&&r.state===m&&r.invoke()}}),se=Te(l,`abort`,()=>function(e,n){let r=u(e);if(r&&typeof r.type==`string`){if(r.cancelFn==null||r.data&&r.data.aborted)return;r.zone.cancelTask(r)}else if(t.current[ne]===!0)return se.apply(e,n)})}}),e.__load_patch(`geolocation`,e=>{e.navigator&&e.navigator.geolocation&&fe(e.navigator.geolocation,[`getCurrentPosition`,`watchPosition`])}),e.__load_patch(`PromiseRejectionEvent`,(e,t)=>{function n(t){return function(n){Re(e,t).forEach(r=>{let i=e.PromiseRejectionEvent;if(i){let e=new i(t,{promise:n.promise,reason:n.rejection});r.invoke(e)}})}}e.PromiseRejectionEvent&&(t[oe(`unhandledPromiseRejectionHandler`)]=n(`unhandledrejection`),t[oe(`rejectionHandledHandler`)]=n(`rejectionhandled`))}),e.__load_patch(`queueMicrotask`,(e,t,n)=>{Be(e,n)})}function Ze(e){e.__load_patch(`ZoneAwarePromise`,(e,t,n)=>{let r=Object.getOwnPropertyDescriptor,i=Object.defineProperty;function a(e){return e&&e.toString===Object.prototype.toString?(e.constructor&&e.constructor.name||``)+`: `+JSON.stringify(e):e?e.toString():Object.prototype.toString.call(e)}let o=n.symbol,s=[],c=e[o(`DISABLE_WRAPPING_UNCAUGHT_PROMISE_REJECTION`)]!==!1,l=o(`Promise`),u=o(`then`);n.onUnhandledError=e=>{if(n.showUncaughtError()){let t=e&&e.rejection;t&&e.zone&&e.task?console.error(`Unhandled Promise rejection:`,t instanceof Error?t.message:t,`; Zone:`,e.zone.name,`; Task:`,e.task&&e.task.source,`; Value:`,t,t instanceof Error?t.stack:void 0):console.error(e)}},n.microtaskDrainDone=()=>{for(;s.length;){let e=s.shift();try{e.zone.runGuarded(()=>{throw e.throwOriginal?e.rejection:e})}catch(e){f(e)}}};let d=o(`unhandledPromiseRejectionHandler`);function f(e){n.onUnhandledError(e);try{let n=t[d];typeof n==`function`&&n.call(this,e)}catch{}}function p(e){return e&&typeof e.then==`function`}function m(e){return e}function h(e){return de.reject(e)}let g=o(`state`),_=o(`value`),ee=o(`finally`),v=o(`parentPromiseValue`),te=o(`parentPromiseState`);function ne(e,t){return n=>{try{ae(e,t,n)}catch(t){ae(e,!1,t)}}}let re=function(){let e=!1;return function(t){return function(){e||(e=!0,t.apply(null,arguments))}}},ie=o(`currentTaskTrace`);function ae(e,r,o){let l=re();if(e===o)throw TypeError(`Promise resolved with itself`);if(e[g]===null){let u=null;try{(typeof o==`object`||typeof o==`function`)&&(u=o&&o.then)}catch(t){return l(()=>{ae(e,!1,t)})(),e}if(r!==!1&&o instanceof de&&Object.hasOwn(o,g)&&Object.hasOwn(o,_)&&o[g]!==null)se(o),ae(e,o[g],o[_]);else if(r!==!1&&typeof u==`function`)try{u.call(o,l(ne(e,r)),l(ne(e,!1)))}catch(t){l(()=>{ae(e,!1,t)})()}else{e[g]=r;let l=e[_];if(e[_]=o,e[ee]===ee&&r===!0&&(e[g]=e[te],e[_]=e[v]),r===!1&&o instanceof Error){let e=t.currentTask&&t.currentTask.data&&t.currentTask.data.__creationTrace__;e&&i(o,ie,{configurable:!0,enumerable:!1,writable:!0,value:e})}for(let t=0;t<l.length;)ce(e,l[t++],l[t++],l[t++],l[t++]);if(l.length==0&&r==0){e[g]=0;let r=o;try{throw Error(`Uncaught (in promise): `+a(o)+(o&&o.stack?`
`+o.stack:``))}catch(e){r=e}c&&(r.throwOriginal=!0),r.rejection=o,r.promise=e,r.zone=t.current,r.task=t.currentTask,s.push(r),n.scheduleMicroTask()}}}return e}let oe=o(`rejectionHandledHandler`);function se(e){if(e[g]===0){try{let n=t[oe];n&&typeof n==`function`&&n.call(this,{rejection:e[_],promise:e})}catch{}e[g]=!1;for(let t=0;t<s.length;t++)e===s[t].promise&&s.splice(t,1)}}function ce(e,t,n,r,i){se(e);let a=e[g],o=a?typeof r==`function`?r:m:typeof i==`function`?i:h;t.scheduleMicroTask(`Promise.then`,()=>{try{let r=e[_],i=!!n&&ee===n[ee];i&&(n[v]=r,n[te]=a),ae(n,!0,t.run(o,void 0,i&&o!==h&&o!==m?[]:[r]))}catch(e){ae(n,!1,e)}},n)}let le=function(){},ue=e.AggregateError;class de{static toString(){return`function ZoneAwarePromise() { [native code] }`}static resolve(e){return e instanceof de?e:ae(new this(null),!0,e)}static reject(e){return ae(new this(null),!1,e)}static withResolvers(){let e={};return e.promise=new de((t,n)=>{e.resolve=t,e.reject=n}),e}static any(e){if(!e||typeof e[Symbol.iterator]!=`function`)return Promise.reject(new ue([],`All promises were rejected`));let t=[],n=0;try{for(let r of e)n++,t.push(de.resolve(r))}catch{return Promise.reject(new ue([],`All promises were rejected`))}if(n===0)return Promise.reject(new ue([],`All promises were rejected`));let r=!1,i=[];return new de((e,a)=>{for(let o=0;o<t.length;o++)t[o].then(t=>{r||(r=!0,e(t))},e=>{i.push(e),n--,n===0&&(r=!0,a(new ue(i,`All promises were rejected`)))})})}static race(e){let t,n,r=new this((e,r)=>{t=e,n=r});function i(e){t(e)}function a(e){n(e)}for(let t of e)p(t)||(t=this.resolve(t)),t.then(i,a);return r}static all(e){return de.allWithCallback(e)}static allSettled(e){return(this&&this.prototype instanceof de?this:de).allWithCallback(e,{thenCallback:e=>({status:`fulfilled`,value:e}),errorCallback:e=>({status:`rejected`,reason:e})})}static allWithCallback(e,t){let n,r,i=new this((e,t)=>{n=e,r=t}),a=2,o=0,s=[];for(let i of e){p(i)||(i=this.resolve(i));let e=o;try{i.then(r=>{s[e]=t?t.thenCallback(r):r,a--,a===0&&n(s)},i=>{t?(s[e]=t.errorCallback(i),a--,a===0&&n(s)):r(i)})}catch(e){r(e)}a++,o++}return a-=2,a===0&&n(s),i}constructor(e){let t=this;if(!(t instanceof de))throw Error(`Must be an instanceof Promise.`);t[g]=null,t[_]=[];try{let n=re();e&&e(n(ne(t,!0)),n(ne(t,!1)))}catch(e){ae(t,!1,e)}}get[Symbol.toStringTag](){return`Promise`}get[Symbol.species](){return de}then(e,n){let r=this.constructor?.[Symbol.species];(!r||typeof r!=`function`)&&(r=this.constructor||de);let i=new r(le),a=t.current;return this[g]==null?this[_].push(a,i,e,n):ce(this,a,i,e,n),i}catch(e){return this.then(null,e)}finally(e){let n=this.constructor?.[Symbol.species];(!n||typeof n!=`function`)&&(n=de);let r=new n(le);r[ee]=ee;let i=t.current;return this[g]==null?this[_].push(i,r,e,e):ce(this,i,r,e,e),r}}de.resolve=de.resolve,de.reject=de.reject,de.race=de.race,de.all=de.all;let fe=e[l]=e.Promise;e.Promise=de;let pe=o(`thenPatched`);function me(e){let t=e.prototype,n=r(t,`then`);if(n&&(n.writable===!1||!n.configurable))return;let i=t.then;t[u]=i,e.prototype.then=function(e,t){return new de((e,t)=>{i.call(this,e,t)}).then(e,t)},e[pe]=!0}n.patchThen=me;function he(e){return function(t,n){let r=e.apply(t,n);if(r instanceof de)return r;let i=r.constructor;return i[pe]||me(i),r}}if(fe){me(fe);let t=fe.try;t&&typeof t==`function`&&(de.try=t),Te(e,`fetch`,e=>he(e))}return Promise[t.__symbol__(`uncaughtPromiseErrors`)]=s,de})}function Qe(e){e.__load_patch(`toString`,e=>{let t=Function.prototype.toString,n=oe(`OriginalDelegate`),r=oe(`Promise`),i=oe(`Error`),a=function(){if(typeof this==`function`){let a=this[n];if(a)return typeof a==`function`?t.call(a):Object.prototype.toString.call(a);if(this===Promise){let n=e[r];if(n)return t.call(n)}if(this===Error){let n=e[i];if(n)return t.call(n)}}return t.call(this)};a[n]=t,Function.prototype.toString=a;let o=Object.prototype.toString;Object.prototype.toString=function(){return typeof Promise==`function`&&this instanceof Promise?`[object Promise]`:o.call(this)}})}function $e(e,t,n,r,i){let a=Zone.__symbol__(r);if(t[a])return;let o=t[a]=t[r];t[r]=function(a,s,c){return s&&s.prototype&&i.forEach(function(t){let i=`${n}.${r}::`+t,a=s.prototype;try{if(Object.hasOwn(a,t)){let n=e.ObjectGetOwnPropertyDescriptor(a,t);n&&n.value?(n.value=e.wrapWithCurrentZone(n.value,i),e._redefineProperty(s.prototype,t,n)):a[t]&&(a[t]=e.wrapWithCurrentZone(a[t],i))}else a[t]&&(a[t]=e.wrapWithCurrentZone(a[t],i))}catch{}}),o.call(t,a,s,c)},e.attachOriginToPatched(t[r],o)}function et(e){e.__load_patch(`util`,(e,t,n)=>{let r=Je(e);n.patchOnProperties=Se,n.patchMethod=Te,n.bindArguments=de,n.patchMacroTask=Ee;let i=t.__symbol__(`BLACK_LISTED_EVENTS`),a=t.__symbol__(`UNPATCHED_EVENTS`);e[a]&&(e[i]=e[a]),e[i]&&(t[i]=t[a]=e[i]),n.patchEventPrototype=ze,n.patchEventTarget=Le,n.ObjectDefineProperty=f,n.ObjectGetOwnPropertyDescriptor=d,n.ObjectCreate=m,n.ArraySlice=h,n.patchClass=we,n.wrapWithCurrentZone=ie,n.filterProperties=Ke,n.attachOriginToPatched=De,n._redefineProperty=Object.defineProperty,n.patchCallbacks=$e,n.getGlobalObjects=()=>({globalSources:Me,zoneSymbolEventNames:je,eventNames:r,isBrowser:ge,isMix:_e,isNode:he,TRUE_STR:te,FALSE_STR:ne,ZONE_SYMBOL_PREFIX:re,ADD_EVENT_LISTENER_STR:g,REMOVE_EVENT_LISTENER_STR:_})})}function tt(e){Ze(e),Qe(e),et(e)}var nt=u();tt(nt),Xe(nt);var rt=(function(e){return e[e.NONE=0]=`NONE`,e[e.HTML=1]=`HTML`,e[e.STYLE=2]=`STYLE`,e[e.SCRIPT=3]=`SCRIPT`,e[e.URL=4]=`URL`,e[e.RESOURCE_URL=5]=`RESOURCE_URL`,e[e.ATTRIBUTE_NO_BINDING=6]=`ATTRIBUTE_NO_BINDING`,e})(rt||{}),it=(function(e){return e[e.None=0]=`None`,e[e.Const=1]=`Const`,e})(it||{}),at=class{modifiers;constructor(e=it.None){this.modifiers=e}hasModifier(e){return(this.modifiers&e)!==0}},ot=(function(e){return e[e.Dynamic=0]=`Dynamic`,e[e.Bool=1]=`Bool`,e[e.String=2]=`String`,e[e.Int=3]=`Int`,e[e.Number=4]=`Number`,e[e.Function=5]=`Function`,e[e.Inferred=6]=`Inferred`,e[e.None=7]=`None`,e})(ot||{}),st=class extends at{name;constructor(e,t){super(t),this.name=e}visitType(e,t){return e.visitBuiltinType(this,t)}};ot.Dynamic;var ct=new st(ot.Inferred);ot.Bool,ot.Int,ot.Number,ot.String,ot.Function,ot.None;var y=(function(e){return e[e.Equals=0]=`Equals`,e[e.NotEquals=1]=`NotEquals`,e[e.Assign=2]=`Assign`,e[e.Identical=3]=`Identical`,e[e.NotIdentical=4]=`NotIdentical`,e[e.Minus=5]=`Minus`,e[e.Plus=6]=`Plus`,e[e.Divide=7]=`Divide`,e[e.Multiply=8]=`Multiply`,e[e.Modulo=9]=`Modulo`,e[e.And=10]=`And`,e[e.Or=11]=`Or`,e[e.BitwiseOr=12]=`BitwiseOr`,e[e.BitwiseAnd=13]=`BitwiseAnd`,e[e.Lower=14]=`Lower`,e[e.LowerEquals=15]=`LowerEquals`,e[e.Bigger=16]=`Bigger`,e[e.BiggerEquals=17]=`BiggerEquals`,e[e.NullishCoalesce=18]=`NullishCoalesce`,e[e.Exponentiation=19]=`Exponentiation`,e[e.In=20]=`In`,e[e.InstanceOf=21]=`InstanceOf`,e[e.AdditionAssignment=22]=`AdditionAssignment`,e[e.SubtractionAssignment=23]=`SubtractionAssignment`,e[e.MultiplicationAssignment=24]=`MultiplicationAssignment`,e[e.DivisionAssignment=25]=`DivisionAssignment`,e[e.RemainderAssignment=26]=`RemainderAssignment`,e[e.ExponentiationAssignment=27]=`ExponentiationAssignment`,e[e.AndAssignment=28]=`AndAssignment`,e[e.OrAssignment=29]=`OrAssignment`,e[e.NullishCoalesceAssignment=30]=`NullishCoalesceAssignment`,e})(y||{});function lt(e,t){return e==null||t==null?e==t:e.isEquivalent(t)}function ut(e,t,n){let r=e.length;if(r!==t.length)return!1;for(let i=0;i<r;i++)if(!n(e[i],t[i]))return!1;return!0}function dt(e,t){return ut(e,t,(e,t)=>e.isEquivalent(t))}var ft=class{leadingComments;type;sourceSpan;constructor(e,t,n){this.leadingComments=n,this.type=e||null,this.sourceSpan=t||null}prop(e,t){return new St(this,e,null,t)}key(e,t,n){return new Ct(this,e,t,n)}callFn(e,t,n,r){return new ht(this,e,null,t,n,r)}instantiate(e,t,n,r){return new gt(this,e,t,n)}conditional(e,t=null,n,r){return new bt(this,e,t,null,n)}equals(e,t){return new xt(y.Equals,this,e,null,t)}notEquals(e,t){return new xt(y.NotEquals,this,e,null,t)}identical(e,t){return new xt(y.Identical,this,e,null,t)}notIdentical(e,t){return new xt(y.NotIdentical,this,e,null,t)}minus(e,t){return new xt(y.Minus,this,e,null,t)}plus(e,t){return new xt(y.Plus,this,e,null,t)}divide(e,t){return new xt(y.Divide,this,e,null,t)}multiply(e,t){return new xt(y.Multiply,this,e,null,t)}modulo(e,t){return new xt(y.Modulo,this,e,null,t)}power(e,t){return new xt(y.Exponentiation,this,e,null,t)}and(e,t){return new xt(y.And,this,e,null,t)}bitwiseOr(e,t){return new xt(y.BitwiseOr,this,e,null,t)}bitwiseAnd(e,t){return new xt(y.BitwiseAnd,this,e,null,t)}or(e,t){return new xt(y.Or,this,e,null,t)}lower(e,t){return new xt(y.Lower,this,e,null,t)}lowerEquals(e,t){return new xt(y.LowerEquals,this,e,null,t)}bigger(e,t){return new xt(y.Bigger,this,e,null,t)}biggerEquals(e,t){return new xt(y.BiggerEquals,this,e,null,t)}isBlank(e){return this.equals(Ot,e)}nullishCoalesce(e,t){return new xt(y.NullishCoalesce,this,e,null,t)}toStmt(e){return new jt(this,null,e)}},pt=class e extends ft{name;constructor(e,t,n,r){super(t,n,r),this.name=e}isEquivalent(t){return t instanceof e&&this.name===t.name}isConstant(){return!1}visitExpression(e,t){return e.visitReadVarExpr(this,t)}clone(){return new e(this.name,this.type,this.sourceSpan)}set(e){return new xt(y.Assign,this,e,null,this.sourceSpan)}},mt=class e extends ft{expr;constructor(e,t,n,r){super(t,n,r),this.expr=e}visitExpression(e,t){return e.visitTypeofExpr(this,t)}isEquivalent(t){return t instanceof e&&t.expr.isEquivalent(this.expr)}isConstant(){return this.expr.isConstant()}clone(){return new e(this.expr.clone())}},ht=class e extends ft{fn;args;pure;isOptional;constructor(e,t,n,r,i=!1,a,o=!1){super(n,r,a),this.fn=e,this.args=t,this.pure=i,this.isOptional=o}get receiver(){return this.fn}isEquivalent(t){return t instanceof e&&this.fn.isEquivalent(t.fn)&&dt(this.args,t.args)&&this.pure===t.pure}isConstant(){return!1}visitExpression(e,t){return e.visitInvokeFunctionExpr(this,t)}clone(){return new e(this.fn.clone(),this.args.map(e=>e.clone()),this.type,this.sourceSpan,this.pure,[],this.isOptional)}},gt=class e extends ft{classExpr;args;constructor(e,t,n,r,i){super(n,r,i),this.classExpr=e,this.args=t}isEquivalent(t){return t instanceof e&&this.classExpr.isEquivalent(t.classExpr)&&dt(this.args,t.args)}isConstant(){return!1}visitExpression(e,t){return e.visitInstantiateExpr(this,t)}clone(){return new e(this.classExpr.clone(),this.args.map(e=>e.clone()),this.type,this.sourceSpan)}},_t=class e extends ft{body;flags;constructor(e,t,n,r){super(null,n,r),this.body=e,this.flags=t}isEquivalent(t){return t instanceof e&&this.body===t.body&&this.flags===t.flags}isConstant(){return!0}visitExpression(e,t){return e.visitRegularExpressionLiteral(this,t)}clone(){return new e(this.body,this.flags,this.sourceSpan)}},vt=class e extends ft{value;constructor(e,t,n,r){super(t,n,r),this.value=e}isEquivalent(t){return t instanceof e&&this.value===t.value}isConstant(){return!0}visitExpression(e,t){return e.visitLiteralExpr(this,t)}clone(){return new e(this.value,this.type,this.sourceSpan)}},yt=class e extends ft{value;typeParams;constructor(e,t,n=null,r,i){super(t,r,i),this.value=e,this.typeParams=n}isEquivalent(t){return t instanceof e&&this.value.name===t.value.name&&this.value.moduleName===t.value.moduleName}isConstant(){return!1}visitExpression(e,t){return e.visitExternalExpr(this,t)}clone(){return new e(this.value,this.type,this.typeParams,this.sourceSpan)}},bt=class e extends ft{condition;falseCase;trueCase;constructor(e,t,n=null,r,i,a){super(r||t.type,i,a),this.condition=e,this.falseCase=n,this.trueCase=t}isEquivalent(t){return t instanceof e&&this.condition.isEquivalent(t.condition)&&this.trueCase.isEquivalent(t.trueCase)&&lt(this.falseCase,t.falseCase)}isConstant(){return!1}visitExpression(e,t){return e.visitConditionalExpr(this,t)}clone(){return new e(this.condition.clone(),this.trueCase.clone(),this.falseCase?.clone(),this.type,this.sourceSpan)}},xt=class e extends ft{operator;rhs;lhs;constructor(e,t,n,r,i,a){super(r||t.type,i,a),this.operator=e,this.rhs=n,this.lhs=t}isEquivalent(t){return t instanceof e&&this.operator===t.operator&&this.lhs.isEquivalent(t.lhs)&&this.rhs.isEquivalent(t.rhs)}isConstant(){return!1}visitExpression(e,t){return e.visitBinaryOperatorExpr(this,t)}clone(){return new e(this.operator,this.lhs.clone(),this.rhs.clone(),this.type,this.sourceSpan)}isAssignment(){let e=this.operator;return e===y.Assign||e===y.AdditionAssignment||e===y.SubtractionAssignment||e===y.MultiplicationAssignment||e===y.DivisionAssignment||e===y.RemainderAssignment||e===y.ExponentiationAssignment||e===y.AndAssignment||e===y.OrAssignment||e===y.NullishCoalesceAssignment}},St=class e extends ft{receiver;name;isOptional;constructor(e,t,n,r,i,a=!1){super(n,r,i),this.receiver=e,this.name=t,this.isOptional=a}get index(){return this.name}isEquivalent(t){return t instanceof e&&this.receiver.isEquivalent(t.receiver)&&this.name===t.name&&this.isOptional===t.isOptional}isConstant(){return!1}visitExpression(e,t){return e.visitReadPropExpr(this,t)}set(e){return new xt(y.Assign,this.receiver.prop(this.name),e,null,this.sourceSpan)}clone(){return new e(this.receiver.clone(),this.name,this.type,this.sourceSpan,[],this.isOptional)}},Ct=class e extends ft{receiver;index;isOptional;constructor(e,t,n,r,i,a=!1){super(n,r,i),this.receiver=e,this.index=t,this.isOptional=a}isEquivalent(t){return t instanceof e&&this.receiver.isEquivalent(t.receiver)&&this.index.isEquivalent(t.index)&&this.isOptional===t.isOptional}isConstant(){return!1}visitExpression(e,t){return e.visitReadKeyExpr(this,t)}set(e){return new xt(y.Assign,this.receiver.key(this.index),e,null,this.sourceSpan)}clone(){return new e(this.receiver.clone(),this.index.clone(),this.type,this.sourceSpan,[],this.isOptional)}},wt=class e extends ft{entries;constructor(e,t,n,r){super(t,n,r),this.entries=e}isConstant(){return this.entries.every(e=>e.isConstant())}isEquivalent(t){return t instanceof e&&dt(this.entries,t.entries)}visitExpression(e,t){return e.visitLiteralArrayExpr(this,t)}clone(){return new e(this.entries.map(e=>e.clone()),this.type,this.sourceSpan)}},Tt=class e{expression;constructor(e){this.expression=e}isEquivalent(t){return t instanceof e&&this.expression.isEquivalent(t.expression)}clone(){return new e(this.expression.clone())}isConstant(){return this.expression.isConstant()}},Et=class e extends ft{entries;valueType=null;constructor(e,t,n,r){super(t,n,r),this.entries=e,t&&(this.valueType=t.valueType)}isEquivalent(t){return t instanceof e&&dt(this.entries,t.entries)}isConstant(){return this.entries.every(e=>e.isConstant())}visitExpression(e,t){return e.visitLiteralMapExpr(this,t)}clone(){let t=this.entries.map(e=>e.clone());return new e(t,this.type,this.sourceSpan)}},Dt=class e extends ft{expression;constructor(e,t,n){super(null,t,n),this.expression=e}isEquivalent(t){return t instanceof e&&this.expression.isEquivalent(t.expression)}isConstant(){return this.expression.isConstant()}visitExpression(e,t){return e.visitSpreadElementExpr(this,t)}clone(){return new e(this.expression.clone(),this.sourceSpan)}},Ot=new vt(null,ct,null),kt=(function(e){return e[e.None=0]=`None`,e[e.Final=1]=`Final`,e[e.Private=2]=`Private`,e[e.Exported=4]=`Exported`,e[e.Static=8]=`Static`,e})(kt||{}),At=class{modifiers;sourceSpan;leadingComments;constructor(e=kt.None,t=null,n){this.modifiers=e,this.sourceSpan=t,this.leadingComments=n}hasModifier(e){return(this.modifiers&e)!==0}addLeadingComment(e){this.leadingComments=this.leadingComments??[],this.leadingComments.push(e)}},jt=class e extends At{expr;constructor(e,t,n){super(kt.None,t,n),this.expr=e}isEquivalent(t){return t instanceof e&&this.expr.isEquivalent(t.expr)}visitStatement(e,t){return e.visitExpressionStmt(this,t)}};(class e{static INSTANCE=new e;keyOf(e){if(e instanceof vt&&typeof e.value==`string`)return`"${e.value}"`;if(e instanceof vt)return String(e.value);if(e instanceof _t)return`/${e.body}/${e.flags??``}`;if(e instanceof wt){let t=[];for(let n of e.entries)t.push(this.keyOf(n));return`[${t.join(`,`)}]`}if(e instanceof Et){let t=[];for(let n of e.entries)if(n instanceof Tt)t.push(`...`+this.keyOf(n.expression));else{let e=n.key;n.quoted&&(e=`"${e}"`),t.push(e+`:`+this.keyOf(n.value))}return`{${t.join(`,`)}}`}if(e instanceof yt)return`import("${e.value.moduleName}", ${e.value.name})`;if(e instanceof pt)return`read(${e.name})`;if(e instanceof mt)return`typeof(${this.keyOf(e.expr)})`;if(e instanceof Dt)return`...${this.keyOf(e.expression)}`;throw Error(`${this.constructor.name} does not handle expressions of type ${e.constructor.name}`)}});var b=`@angular/core`,x=(()=>{class e{static core={name:null,moduleName:b};static namespaceHTML={name:`ɵɵnamespaceHTML`,moduleName:b};static namespaceMathML={name:`ɵɵnamespaceMathML`,moduleName:b};static namespaceSVG={name:`ɵɵnamespaceSVG`,moduleName:b};static element={name:`ɵɵelement`,moduleName:b};static elementStart={name:`ɵɵelementStart`,moduleName:b};static elementEnd={name:`ɵɵelementEnd`,moduleName:b};static foreignComponent={name:`ɵɵforeignComponent`,moduleName:b};static foreignContent={name:`ɵɵforeignContent`,moduleName:b};static foreignContentFn={name:`ɵɵforeignContentFn`,moduleName:b};static domElement={name:`ɵɵdomElement`,moduleName:b};static domElementStart={name:`ɵɵdomElementStart`,moduleName:b};static domElementEnd={name:`ɵɵdomElementEnd`,moduleName:b};static domElementContainer={name:`ɵɵdomElementContainer`,moduleName:b};static domElementContainerStart={name:`ɵɵdomElementContainerStart`,moduleName:b};static domElementContainerEnd={name:`ɵɵdomElementContainerEnd`,moduleName:b};static domTemplate={name:`ɵɵdomTemplate`,moduleName:b};static domListener={name:`ɵɵdomListener`,moduleName:b};static advance={name:`ɵɵadvance`,moduleName:b};static syntheticHostProperty={name:`ɵɵsyntheticHostProperty`,moduleName:b};static syntheticHostListener={name:`ɵɵsyntheticHostListener`,moduleName:b};static attribute={name:`ɵɵattribute`,moduleName:b};static classProp={name:`ɵɵclassProp`,moduleName:b};static elementContainerStart={name:`ɵɵelementContainerStart`,moduleName:b};static elementContainerEnd={name:`ɵɵelementContainerEnd`,moduleName:b};static elementContainer={name:`ɵɵelementContainer`,moduleName:b};static styleMap={name:`ɵɵstyleMap`,moduleName:b};static classMap={name:`ɵɵclassMap`,moduleName:b};static styleProp={name:`ɵɵstyleProp`,moduleName:b};static interpolate={name:`ɵɵinterpolate`,moduleName:b};static interpolate1={name:`ɵɵinterpolate1`,moduleName:b};static interpolate2={name:`ɵɵinterpolate2`,moduleName:b};static interpolate3={name:`ɵɵinterpolate3`,moduleName:b};static interpolate4={name:`ɵɵinterpolate4`,moduleName:b};static interpolate5={name:`ɵɵinterpolate5`,moduleName:b};static interpolate6={name:`ɵɵinterpolate6`,moduleName:b};static interpolate7={name:`ɵɵinterpolate7`,moduleName:b};static interpolate8={name:`ɵɵinterpolate8`,moduleName:b};static interpolateV={name:`ɵɵinterpolateV`,moduleName:b};static nextContext={name:`ɵɵnextContext`,moduleName:b};static resetView={name:`ɵɵresetView`,moduleName:b};static templateCreate={name:`ɵɵtemplate`,moduleName:b};static defer={name:`ɵɵdefer`,moduleName:b};static deferWhen={name:`ɵɵdeferWhen`,moduleName:b};static deferOnIdle={name:`ɵɵdeferOnIdle`,moduleName:b};static deferOnImmediate={name:`ɵɵdeferOnImmediate`,moduleName:b};static deferOnTimer={name:`ɵɵdeferOnTimer`,moduleName:b};static deferOnHover={name:`ɵɵdeferOnHover`,moduleName:b};static deferOnInteraction={name:`ɵɵdeferOnInteraction`,moduleName:b};static deferOnViewport={name:`ɵɵdeferOnViewport`,moduleName:b};static deferPrefetchWhen={name:`ɵɵdeferPrefetchWhen`,moduleName:b};static deferPrefetchOnIdle={name:`ɵɵdeferPrefetchOnIdle`,moduleName:b};static deferPrefetchOnImmediate={name:`ɵɵdeferPrefetchOnImmediate`,moduleName:b};static deferPrefetchOnTimer={name:`ɵɵdeferPrefetchOnTimer`,moduleName:b};static deferPrefetchOnHover={name:`ɵɵdeferPrefetchOnHover`,moduleName:b};static deferPrefetchOnInteraction={name:`ɵɵdeferPrefetchOnInteraction`,moduleName:b};static deferPrefetchOnViewport={name:`ɵɵdeferPrefetchOnViewport`,moduleName:b};static deferHydrateWhen={name:`ɵɵdeferHydrateWhen`,moduleName:b};static deferHydrateNever={name:`ɵɵdeferHydrateNever`,moduleName:b};static deferHydrateOnIdle={name:`ɵɵdeferHydrateOnIdle`,moduleName:b};static deferHydrateOnImmediate={name:`ɵɵdeferHydrateOnImmediate`,moduleName:b};static deferHydrateOnTimer={name:`ɵɵdeferHydrateOnTimer`,moduleName:b};static deferHydrateOnHover={name:`ɵɵdeferHydrateOnHover`,moduleName:b};static deferHydrateOnInteraction={name:`ɵɵdeferHydrateOnInteraction`,moduleName:b};static deferHydrateOnViewport={name:`ɵɵdeferHydrateOnViewport`,moduleName:b};static deferEnableTimerScheduling={name:`ɵɵdeferEnableTimerScheduling`,moduleName:b};static enableIncrementalHydrationRuntime={name:`ɵɵenableIncrementalHydrationRuntime`,moduleName:b};static conditionalCreate={name:`ɵɵconditionalCreate`,moduleName:b};static conditionalBranchCreate={name:`ɵɵconditionalBranchCreate`,moduleName:b};static conditional={name:`ɵɵconditional`,moduleName:b};static repeater={name:`ɵɵrepeater`,moduleName:b};static repeaterCreate={name:`ɵɵrepeaterCreate`,moduleName:b};static repeaterTrackByIndex={name:`ɵɵrepeaterTrackByIndex`,moduleName:b};static repeaterTrackByIdentity={name:`ɵɵrepeaterTrackByIdentity`,moduleName:b};static componentInstance={name:`ɵɵcomponentInstance`,moduleName:b};static text={name:`ɵɵtext`,moduleName:b};static enableBindings={name:`ɵɵenableBindings`,moduleName:b};static disableBindings={name:`ɵɵdisableBindings`,moduleName:b};static getCurrentView={name:`ɵɵgetCurrentView`,moduleName:b};static textInterpolate={name:`ɵɵtextInterpolate`,moduleName:b};static textInterpolate1={name:`ɵɵtextInterpolate1`,moduleName:b};static textInterpolate2={name:`ɵɵtextInterpolate2`,moduleName:b};static textInterpolate3={name:`ɵɵtextInterpolate3`,moduleName:b};static textInterpolate4={name:`ɵɵtextInterpolate4`,moduleName:b};static textInterpolate5={name:`ɵɵtextInterpolate5`,moduleName:b};static textInterpolate6={name:`ɵɵtextInterpolate6`,moduleName:b};static textInterpolate7={name:`ɵɵtextInterpolate7`,moduleName:b};static textInterpolate8={name:`ɵɵtextInterpolate8`,moduleName:b};static textInterpolateV={name:`ɵɵtextInterpolateV`,moduleName:b};static restoreView={name:`ɵɵrestoreView`,moduleName:b};static pureFunction0={name:`ɵɵpureFunction0`,moduleName:b};static pureFunction1={name:`ɵɵpureFunction1`,moduleName:b};static pureFunction2={name:`ɵɵpureFunction2`,moduleName:b};static pureFunction3={name:`ɵɵpureFunction3`,moduleName:b};static pureFunction4={name:`ɵɵpureFunction4`,moduleName:b};static pureFunction5={name:`ɵɵpureFunction5`,moduleName:b};static pureFunction6={name:`ɵɵpureFunction6`,moduleName:b};static pureFunction7={name:`ɵɵpureFunction7`,moduleName:b};static pureFunction8={name:`ɵɵpureFunction8`,moduleName:b};static pureFunctionV={name:`ɵɵpureFunctionV`,moduleName:b};static pipeBind1={name:`ɵɵpipeBind1`,moduleName:b};static pipeBind2={name:`ɵɵpipeBind2`,moduleName:b};static pipeBind3={name:`ɵɵpipeBind3`,moduleName:b};static pipeBind4={name:`ɵɵpipeBind4`,moduleName:b};static pipeBindV={name:`ɵɵpipeBindV`,moduleName:b};static domProperty={name:`ɵɵdomProperty`,moduleName:b};static ariaProperty={name:`ɵɵariaProperty`,moduleName:b};static property={name:`ɵɵproperty`,moduleName:b};static control={name:`ɵɵcontrol`,moduleName:b};static controlCreate={name:`ɵɵcontrolCreate`,moduleName:b};static animationEnterListener={name:`ɵɵanimateEnterListener`,moduleName:b};static animationLeaveListener={name:`ɵɵanimateLeaveListener`,moduleName:b};static animationEnter={name:`ɵɵanimateEnter`,moduleName:b};static animationLeave={name:`ɵɵanimateLeave`,moduleName:b};static i18n={name:`ɵɵi18n`,moduleName:b};static i18nAttributes={name:`ɵɵi18nAttributes`,moduleName:b};static i18nExp={name:`ɵɵi18nExp`,moduleName:b};static i18nStart={name:`ɵɵi18nStart`,moduleName:b};static i18nEnd={name:`ɵɵi18nEnd`,moduleName:b};static i18nApply={name:`ɵɵi18nApply`,moduleName:b};static i18nPostprocess={name:`ɵɵi18nPostprocess`,moduleName:b};static pipe={name:`ɵɵpipe`,moduleName:b};static projection={name:`ɵɵprojection`,moduleName:b};static projectionDef={name:`ɵɵprojectionDef`,moduleName:b};static reference={name:`ɵɵreference`,moduleName:b};static inject={name:`ɵɵinject`,moduleName:b};static injectAttribute={name:`ɵɵinjectAttribute`,moduleName:b};static directiveInject={name:`ɵɵdirectiveInject`,moduleName:b};static invalidFactory={name:`ɵɵinvalidFactory`,moduleName:b};static invalidFactoryDep={name:`ɵɵinvalidFactoryDep`,moduleName:b};static templateRefExtractor={name:`ɵɵtemplateRefExtractor`,moduleName:b};static forwardRef={name:`forwardRef`,moduleName:b};static resolveForwardRef={name:`resolveForwardRef`,moduleName:b};static replaceMetadata={name:`ɵɵreplaceMetadata`,moduleName:b};static getReplaceMetadataURL={name:`ɵɵgetReplaceMetadataURL`,moduleName:b};static ɵɵdefineInjectable={name:`ɵɵdefineInjectable`,moduleName:b};static declareInjectable={name:`ɵɵngDeclareInjectable`,moduleName:b};static InjectableDeclaration={name:`ɵɵInjectableDeclaration`,moduleName:b};static defineService={name:`ɵɵdefineService`,moduleName:b};static declareService={name:`ɵɵngDeclareService`,moduleName:b};static resolveWindow={name:`ɵɵresolveWindow`,moduleName:b};static resolveDocument={name:`ɵɵresolveDocument`,moduleName:b};static resolveBody={name:`ɵɵresolveBody`,moduleName:b};static getComponentDepsFactory={name:`ɵɵgetComponentDepsFactory`,moduleName:b};static defineComponent={name:`ɵɵdefineComponent`,moduleName:b};static declareComponent={name:`ɵɵngDeclareComponent`,moduleName:b};static setComponentScope={name:`ɵɵsetComponentScope`,moduleName:b};static ChangeDetectionStrategy={name:`ChangeDetectionStrategy`,moduleName:b};static ViewEncapsulation={name:`ViewEncapsulation`,moduleName:b};static ComponentDeclaration={name:`ɵɵComponentDeclaration`,moduleName:b};static FactoryDeclaration={name:`ɵɵFactoryDeclaration`,moduleName:b};static declareFactory={name:`ɵɵngDeclareFactory`,moduleName:b};static FactoryTarget={name:`ɵɵFactoryTarget`,moduleName:b};static defineDirective={name:`ɵɵdefineDirective`,moduleName:b};static declareDirective={name:`ɵɵngDeclareDirective`,moduleName:b};static DirectiveDeclaration={name:`ɵɵDirectiveDeclaration`,moduleName:b};static InjectorDef={name:`ɵɵInjectorDef`,moduleName:b};static InjectorDeclaration={name:`ɵɵInjectorDeclaration`,moduleName:b};static defineInjector={name:`ɵɵdefineInjector`,moduleName:b};static declareInjector={name:`ɵɵngDeclareInjector`,moduleName:b};static NgModuleDeclaration={name:`ɵɵNgModuleDeclaration`,moduleName:b};static ModuleWithProviders={name:`ModuleWithProviders`,moduleName:b};static defineNgModule={name:`ɵɵdefineNgModule`,moduleName:b};static declareNgModule={name:`ɵɵngDeclareNgModule`,moduleName:b};static setNgModuleScope={name:`ɵɵsetNgModuleScope`,moduleName:b};static registerNgModuleType={name:`ɵɵregisterNgModuleType`,moduleName:b};static PipeDeclaration={name:`ɵɵPipeDeclaration`,moduleName:b};static definePipe={name:`ɵɵdefinePipe`,moduleName:b};static declarePipe={name:`ɵɵngDeclarePipe`,moduleName:b};static declareClassMetadata={name:`ɵɵngDeclareClassMetadata`,moduleName:b};static declareClassMetadataAsync={name:`ɵɵngDeclareClassMetadataAsync`,moduleName:b};static setClassMetadata={name:`ɵsetClassMetadata`,moduleName:b};static setClassMetadataAsync={name:`ɵsetClassMetadataAsync`,moduleName:b};static setClassDebugInfo={name:`ɵsetClassDebugInfo`,moduleName:b};static queryRefresh={name:`ɵɵqueryRefresh`,moduleName:b};static viewQuery={name:`ɵɵviewQuery`,moduleName:b};static loadQuery={name:`ɵɵloadQuery`,moduleName:b};static contentQuery={name:`ɵɵcontentQuery`,moduleName:b};static viewQuerySignal={name:`ɵɵviewQuerySignal`,moduleName:b};static contentQuerySignal={name:`ɵɵcontentQuerySignal`,moduleName:b};static queryAdvance={name:`ɵɵqueryAdvance`,moduleName:b};static twoWayProperty={name:`ɵɵtwoWayProperty`,moduleName:b};static twoWayBindingSet={name:`ɵɵtwoWayBindingSet`,moduleName:b};static twoWayListener={name:`ɵɵtwoWayListener`,moduleName:b};static declareLet={name:`ɵɵdeclareLet`,moduleName:b};static storeLet={name:`ɵɵstoreLet`,moduleName:b};static readContextLet={name:`ɵɵreadContextLet`,moduleName:b};static arrowFunction={name:`ɵɵarrowFunction`,moduleName:b};static attachSourceLocations={name:`ɵɵattachSourceLocations`,moduleName:b};static NgOnChangesFeature={name:`ɵɵNgOnChangesFeature`,moduleName:b};static ControlFeature={name:`ɵɵControlFeature`,moduleName:b};static InheritDefinitionFeature={name:`ɵɵInheritDefinitionFeature`,moduleName:b};static ProvidersFeature={name:`ɵɵProvidersFeature`,moduleName:b};static HostDirectivesFeature={name:`ɵɵHostDirectivesFeature`,moduleName:b};static ExternalStylesFeature={name:`ɵɵExternalStylesFeature`,moduleName:b};static listener={name:`ɵɵlistener`,moduleName:b};static getInheritedFactory={name:`ɵɵgetInheritedFactory`,moduleName:b};static sanitizeHtml={name:`ɵɵsanitizeHtml`,moduleName:b};static sanitizeStyle={name:`ɵɵsanitizeStyle`,moduleName:b};static validateAttribute={name:`ɵɵvalidateAttribute`,moduleName:b};static sanitizeResourceUrl={name:`ɵɵsanitizeResourceUrl`,moduleName:b};static sanitizeScript={name:`ɵɵsanitizeScript`,moduleName:b};static sanitizeUrl={name:`ɵɵsanitizeUrl`,moduleName:b};static sanitizeUrlOrResourceUrl={name:`ɵɵsanitizeUrlOrResourceUrl`,moduleName:b};static trustConstantHtml={name:`ɵɵtrustConstantHtml`,moduleName:b};static trustConstantResourceUrl={name:`ɵɵtrustConstantResourceUrl`,moduleName:b};static inputDecorator={name:`Input`,moduleName:b};static outputDecorator={name:`Output`,moduleName:b};static viewChildDecorator={name:`ViewChild`,moduleName:b};static viewChildrenDecorator={name:`ViewChildren`,moduleName:b};static contentChildDecorator={name:`ContentChild`,moduleName:b};static contentChildrenDecorator={name:`ContentChildren`,moduleName:b};static InputSignalBrandWriteType={name:`ɵINPUT_SIGNAL_BRAND_WRITE_TYPE`,moduleName:b};static UnwrapDirectiveSignalInputs={name:`ɵUnwrapDirectiveSignalInputs`,moduleName:b};static unwrapWritableSignal={name:`ɵunwrapWritableSignal`,moduleName:b};static assertType={name:`ɵassertType`,moduleName:b}}return e})();y.And,y.Bigger,y.BiggerEquals,y.BitwiseOr,y.BitwiseAnd,y.Divide,y.Assign,y.Equals,y.Identical,y.Lower,y.LowerEquals,y.Minus,y.Modulo,y.Exponentiation,y.Multiply,y.NotEquals,y.NotIdentical,y.NullishCoalesce,y.Or,y.Plus,y.In,y.InstanceOf,y.AdditionAssignment,y.SubtractionAssignment,y.MultiplicationAssignment,y.DivisionAssignment,y.RemainderAssignment,y.ExponentiationAssignment,y.AndAssignment,y.OrAssignment,y.NullishCoalesceAssignment;var Mt=class{span;sourceSpan;constructor(e,t){this.span=e,this.sourceSpan=t}toString(){return`AST`}},Nt=class extends Mt{receiver;args;argumentSpan;constructor(e,t,n,r,i){super(e,t),this.receiver=n,this.args=r,this.argumentSpan=i}visit(e,t=null){return e.visitCall(this,t)}},Pt=(function(e){return e[e.Property=0]=`Property`,e[e.Attribute=1]=`Attribute`,e[e.Class=2]=`Class`,e[e.Style=3]=`Style`,e[e.LegacyAnimation=4]=`LegacyAnimation`,e[e.TwoWay=5]=`TwoWay`,e[e.Animation=6]=`Animation`,e})(Pt||{}),Ft=`(:(where|is)\\()?`,It=`-shadowcsshost`,Lt=`-shadowcsscontext`,Rt=`[^)(]*`,zt=String.raw`(?:\(${Rt}\)|${Rt})+?`,Bt=String.raw`(?:\(${zt}\)|${Rt})+?`,Vt=String.raw`(?:\((${Bt})\))`;String.raw`(:nth-[-\w]+)`+Vt,It+Vt+``,`${Ft}`,Lt+Vt+``;var S=(function(e){return e[e.ListEnd=0]=`ListEnd`,e[e.Statement=1]=`Statement`,e[e.Variable=2]=`Variable`,e[e.ElementStart=3]=`ElementStart`,e[e.Element=4]=`Element`,e[e.ForeignComponent=5]=`ForeignComponent`,e[e.Template=6]=`Template`,e[e.ElementEnd=7]=`ElementEnd`,e[e.ContainerStart=8]=`ContainerStart`,e[e.Container=9]=`Container`,e[e.ContainerEnd=10]=`ContainerEnd`,e[e.DisableBindings=11]=`DisableBindings`,e[e.ConditionalCreate=12]=`ConditionalCreate`,e[e.ConditionalBranchCreate=13]=`ConditionalBranchCreate`,e[e.Conditional=14]=`Conditional`,e[e.EnableBindings=15]=`EnableBindings`,e[e.Text=16]=`Text`,e[e.Listener=17]=`Listener`,e[e.InterpolateText=18]=`InterpolateText`,e[e.Binding=19]=`Binding`,e[e.Property=20]=`Property`,e[e.StyleProp=21]=`StyleProp`,e[e.ClassProp=22]=`ClassProp`,e[e.StyleMap=23]=`StyleMap`,e[e.ClassMap=24]=`ClassMap`,e[e.Advance=25]=`Advance`,e[e.Pipe=26]=`Pipe`,e[e.Attribute=27]=`Attribute`,e[e.ExtractedAttribute=28]=`ExtractedAttribute`,e[e.Defer=29]=`Defer`,e[e.DeferOn=30]=`DeferOn`,e[e.DeferWhen=31]=`DeferWhen`,e[e.I18nMessage=32]=`I18nMessage`,e[e.DomProperty=33]=`DomProperty`,e[e.Namespace=34]=`Namespace`,e[e.ProjectionDef=35]=`ProjectionDef`,e[e.EnableIncrementalHydrationRuntime=36]=`EnableIncrementalHydrationRuntime`,e[e.Projection=37]=`Projection`,e[e.Content=38]=`Content`,e[e.RepeaterCreate=39]=`RepeaterCreate`,e[e.Repeater=40]=`Repeater`,e[e.TwoWayProperty=41]=`TwoWayProperty`,e[e.TwoWayListener=42]=`TwoWayListener`,e[e.DeclareLet=43]=`DeclareLet`,e[e.StoreLet=44]=`StoreLet`,e[e.I18nStart=45]=`I18nStart`,e[e.I18n=46]=`I18n`,e[e.I18nEnd=47]=`I18nEnd`,e[e.I18nExpression=48]=`I18nExpression`,e[e.I18nApply=49]=`I18nApply`,e[e.IcuStart=50]=`IcuStart`,e[e.IcuEnd=51]=`IcuEnd`,e[e.IcuPlaceholder=52]=`IcuPlaceholder`,e[e.I18nContext=53]=`I18nContext`,e[e.I18nAttributes=54]=`I18nAttributes`,e[e.SourceLocation=55]=`SourceLocation`,e[e.Animation=56]=`Animation`,e[e.AnimationString=57]=`AnimationString`,e[e.AnimationBinding=58]=`AnimationBinding`,e[e.AnimationListener=59]=`AnimationListener`,e[e.Control=60]=`Control`,e[e.ControlCreate=61]=`ControlCreate`,e})(S||{}),Ht=(function(e){return e[e.LexicalRead=0]=`LexicalRead`,e[e.Context=1]=`Context`,e[e.TrackContext=2]=`TrackContext`,e[e.ReadVariable=3]=`ReadVariable`,e[e.NextContext=4]=`NextContext`,e[e.Reference=5]=`Reference`,e[e.StoreLet=6]=`StoreLet`,e[e.ContextLetReference=7]=`ContextLetReference`,e[e.GetCurrentView=8]=`GetCurrentView`,e[e.RestoreView=9]=`RestoreView`,e[e.ResetView=10]=`ResetView`,e[e.PureFunctionExpr=11]=`PureFunctionExpr`,e[e.PureFunctionParameterExpr=12]=`PureFunctionParameterExpr`,e[e.PipeBinding=13]=`PipeBinding`,e[e.PipeBindingVariadic=14]=`PipeBindingVariadic`,e[e.SafePropertyRead=15]=`SafePropertyRead`,e[e.SafeKeyedRead=16]=`SafeKeyedRead`,e[e.SafeNavigationMigration=17]=`SafeNavigationMigration`,e[e.SafeTernaryExpr=18]=`SafeTernaryExpr`,e[e.EmptyExpr=19]=`EmptyExpr`,e[e.AssignTemporaryExpr=20]=`AssignTemporaryExpr`,e[e.ReadTemporaryExpr=21]=`ReadTemporaryExpr`,e[e.SlotLiteralExpr=22]=`SlotLiteralExpr`,e[e.ConditionalCase=23]=`ConditionalCase`,e[e.ConstCollected=24]=`ConstCollected`,e[e.TwoWayBindingSet=25]=`TwoWayBindingSet`,e[e.ForeignContent=26]=`ForeignContent`,e[e.ArrowFunction=27]=`ArrowFunction`,e})(Ht||{}),Ut=(function(e){return e[e.None=0]=`None`,e[e.AlwaysInline=1]=`AlwaysInline`,e})(Ut||{}),Wt=(function(e){return e[e.Context=0]=`Context`,e[e.Identifier=1]=`Identifier`,e[e.SavedView=2]=`SavedView`,e[e.Alias=3]=`Alias`,e})(Wt||{}),Gt=(function(e){return e[e.Attribute=0]=`Attribute`,e[e.ClassName=1]=`ClassName`,e[e.StyleProperty=2]=`StyleProperty`,e[e.Property=3]=`Property`,e[e.Template=4]=`Template`,e[e.I18n=5]=`I18n`,e[e.LegacyAnimation=6]=`LegacyAnimation`,e[e.TwoWayProperty=7]=`TwoWayProperty`,e[e.Animation=8]=`Animation`,e})(Gt||{}),Kt=(function(e){return e[e.Creation=0]=`Creation`,e[e.Postproccessing=1]=`Postproccessing`,e})(Kt||{}),qt=(function(e){return e[e.I18nText=0]=`I18nText`,e[e.I18nAttribute=1]=`I18nAttribute`,e})(qt||{}),Jt=(function(e){return e[e.None=0]=`None`,e[e.ElementTag=1]=`ElementTag`,e[e.TemplateTag=2]=`TemplateTag`,e[e.OpenTag=4]=`OpenTag`,e[e.CloseTag=8]=`CloseTag`,e[e.ExpressionIndex=16]=`ExpressionIndex`,e})(Jt||{}),Yt=(function(e){return e[e.HTML=0]=`HTML`,e[e.SVG=1]=`SVG`,e[e.Math=2]=`Math`,e})(Yt||{}),Xt=(function(e){return e[e.Idle=0]=`Idle`,e[e.Immediate=1]=`Immediate`,e[e.Timer=2]=`Timer`,e[e.Hover=3]=`Hover`,e[e.Interaction=4]=`Interaction`,e[e.Viewport=5]=`Viewport`,e[e.Never=6]=`Never`,e})(Xt||{}),Zt=(function(e){return e[e.RootI18n=0]=`RootI18n`,e[e.Icu=1]=`Icu`,e[e.Attr=2]=`Attr`,e})(Zt||{}),Qt=(function(e){return e[e.NgTemplate=0]=`NgTemplate`,e[e.Structural=1]=`Structural`,e[e.Block=2]=`Block`,e})(Qt||{}),$t=(function(e){return e[e.None=0]=`None`,e[e.InChildOperation=1]=`InChildOperation`,e[e.InArrowFunctionOperation=2]=`InArrowFunctionOperation`,e[e.InSafeNavigationMigration=4]=`InSafeNavigationMigration`,e})($t||{});S.Element,S.ElementStart,S.Container,S.ContainerStart,S.Template,S.RepeaterCreate,S.ConditionalCreate,S.ConditionalBranchCreate;var C=(function(e){return e[e.Tmpl=0]=`Tmpl`,e[e.Host=1]=`Host`,e[e.Both=2]=`Both`,e})(C||{}),en=(function(e){return e[e.Full=0]=`Full`,e[e.DomOnly=1]=`DomOnly`,e})(en||{});x.ariaProperty,x.ariaProperty,x.attribute,x.attribute,x.classProp,x.classProp,x.element,x.element,x.elementContainer,x.elementContainer,x.elementContainerEnd,x.elementContainerEnd,x.elementContainerStart,x.elementContainerStart,x.elementEnd,x.elementEnd,x.elementStart,x.elementStart,x.domProperty,x.domProperty,x.i18nExp,x.i18nExp,x.listener,x.listener,x.listener,x.listener,x.property,x.property,x.styleProp,x.styleProp,x.syntheticHostListener,x.syntheticHostListener,x.syntheticHostProperty,x.syntheticHostProperty,x.templateCreate,x.templateCreate,x.twoWayProperty,x.twoWayProperty,x.twoWayListener,x.twoWayListener,x.declareLet,x.declareLet,x.conditionalCreate,x.conditionalBranchCreate,x.conditionalBranchCreate,x.conditionalBranchCreate,x.domElement,x.domElement,x.domElementStart,x.domElementStart,x.domElementEnd,x.domElementEnd,x.domElementContainer,x.domElementContainer,x.domElementContainerStart,x.domElementContainerStart,x.domElementContainerEnd,x.domElementContainerEnd,x.domListener,x.domListener,x.domTemplate,x.domTemplate,x.animationEnter,x.animationEnter,x.animationLeave,x.animationLeave,x.animationEnterListener,x.animationEnterListener,x.animationLeaveListener,x.animationLeaveListener,y.And,y.Bigger,y.BiggerEquals,y.BitwiseOr,y.BitwiseAnd,y.Divide,y.Assign,y.Equals,y.Identical,y.Lower,y.LowerEquals,y.Minus,y.Modulo,y.Exponentiation,y.Multiply,y.NotEquals,y.NotIdentical,y.NullishCoalesce,y.Or,y.Plus,y.In,y.InstanceOf,y.AdditionAssignment,y.SubtractionAssignment,y.MultiplicationAssignment,y.DivisionAssignment,y.RemainderAssignment,y.ExponentiationAssignment,y.AndAssignment,y.OrAssignment,y.NullishCoalesceAssignment,S.Property,S.Property,S.Property,S.Attribute,S.Attribute,S.Property,S.TwoWayProperty,S.Container,S.ContainerStart,S.ContainerEnd,S.Element,S.ElementStart,S.ElementEnd,S.Template,S.ElementEnd,S.ElementStart,S.Element,S.ContainerEnd,S.ContainerStart,S.Container,S.I18nEnd,S.I18nStart,S.I18n,S.Pipe;var tn=` \f
\r	\v ᠎ - \u2028\u2029  　﻿`;`${tn}`,`${tn}`;var nn=(function(e){return e[e.Character=0]=`Character`,e[e.Identifier=1]=`Identifier`,e[e.PrivateIdentifier=2]=`PrivateIdentifier`,e[e.Keyword=3]=`Keyword`,e[e.String=4]=`String`,e[e.Operator=5]=`Operator`,e[e.Number=6]=`Number`,e[e.RegExpBody=7]=`RegExpBody`,e[e.RegExpFlags=8]=`RegExpFlags`,e[e.Error=9]=`Error`,e})(nn||{}),rn=(function(e){return e[e.Plain=0]=`Plain`,e[e.TemplateLiteralPart=1]=`TemplateLiteralPart`,e[e.TemplateLiteralEnd=2]=`TemplateLiteralEnd`,e})(rn||{});nn.Character,S.StyleMap,S.ClassMap,S.StyleProp,S.ClassProp,S.Attribute,S.Property,S.Attribute,S.Control,S.DomProperty,S.DomProperty,S.Attribute,S.StyleMap,S.ClassMap,S.StyleProp,S.ClassProp,S.Listener,S.TwoWayListener,S.AnimationListener,S.StyleMap,S.ClassMap,S.StyleProp,S.ClassProp,S.Property,S.TwoWayProperty,S.DomProperty,S.Attribute,S.Animation,S.Control,Xt.Idle,x.deferOnIdle,x.deferPrefetchOnIdle,x.deferHydrateOnIdle,Xt.Immediate,x.deferOnImmediate,x.deferPrefetchOnImmediate,x.deferHydrateOnImmediate,Xt.Timer,x.deferOnTimer,x.deferPrefetchOnTimer,x.deferHydrateOnTimer,Xt.Hover,x.deferOnHover,x.deferPrefetchOnHover,x.deferHydrateOnHover,Xt.Interaction,x.deferOnInteraction,x.deferPrefetchOnInteraction,x.deferHydrateOnInteraction,Xt.Viewport,x.deferOnViewport,x.deferPrefetchOnViewport,x.deferHydrateOnViewport,Xt.Never,x.deferHydrateNever,x.deferHydrateNever,x.deferHydrateNever,x.pipeBind1,x.pipeBind2,x.pipeBind3,x.pipeBind4,x.textInterpolate,x.textInterpolate1,x.textInterpolate2,x.textInterpolate3,x.textInterpolate4,x.textInterpolate5,x.textInterpolate6,x.textInterpolate7,x.textInterpolate8,x.textInterpolateV,x.interpolate,x.interpolate1,x.interpolate2,x.interpolate3,x.interpolate4,x.interpolate5,x.interpolate6,x.interpolate7,x.interpolate8,x.interpolateV,x.pureFunction0,x.pureFunction1,x.pureFunction2,x.pureFunction3,x.pureFunction4,x.pureFunction5,x.pureFunction6,x.pureFunction7,x.pureFunction8,x.pureFunctionV,x.resolveWindow,x.resolveDocument,x.resolveBody,rt.HTML,x.sanitizeHtml,rt.RESOURCE_URL,x.sanitizeResourceUrl,rt.SCRIPT,x.sanitizeScript,rt.STYLE,x.sanitizeStyle,rt.URL,x.sanitizeUrl,rt.ATTRIBUTE_NO_BINDING,x.validateAttribute,rt.HTML,x.trustConstantHtml,rt.RESOURCE_URL,x.trustConstantResourceUrl;var an=(function(e){return e[e.None=0]=`None`,e[e.ViewContextRead=1]=`ViewContextRead`,e[e.ViewContextWrite=2]=`ViewContextWrite`,e[e.SideEffectful=4]=`SideEffectful`,e})(an||{});C.Tmpl,C.Tmpl,C.Both,C.Host,C.Tmpl,C.Tmpl,C.Tmpl,C.Both,C.Both,C.Both,C.Tmpl,C.Both,C.Both,C.Tmpl,C.Both,C.Tmpl,C.Both,C.Both,C.Tmpl,C.Tmpl,C.Tmpl,C.Tmpl,C.Tmpl,C.Both,C.Both,C.Tmpl,C.Tmpl,C.Tmpl,C.Tmpl,C.Both,C.Both,C.Both,C.Tmpl,C.Tmpl,C.Both,C.Tmpl,C.Tmpl,C.Tmpl,C.Both,C.Both,C.Tmpl,C.Both,C.Both,C.Both,C.Both,C.Both,C.Tmpl,C.Tmpl,C.Tmpl,C.Tmpl,C.Tmpl,C.Tmpl,C.Tmpl,C.Tmpl,C.Tmpl,C.Tmpl,C.Tmpl,C.Tmpl,C.Both,C.Tmpl,C.Both,C.Tmpl,C.Both,C.Tmpl,C.Tmpl,C.Tmpl,C.Tmpl,C.Tmpl,C.Tmpl,C.Both,C.Both,C.Both,Pt.Property,Gt.Property,Pt.TwoWay,Gt.TwoWayProperty,Pt.Attribute,Gt.Attribute,Pt.Class,Gt.ClassName,Pt.Style,Gt.StyleProperty,Pt.LegacyAnimation,Gt.LegacyAnimation,Pt.Animation,Gt.Animation;var on=`%COMP%`;`${on}`,`${on}`,class e{static SINGLETON=new e;static veWillInferAnyFor(t){let n=e.SINGLETON;return t instanceof Nt?t.visit(n):t.receiver.visit(n)}visitUnary(e){return e.expr.visit(this)}visitBinary(e){return e.left.visit(this)||e.right.visit(this)}visitChain(){return!1}visitConditional(e){return e.condition.visit(this)||e.trueExp.visit(this)||e.falseExp.visit(this)}visitCall(){return!0}visitSafeCall(){return!1}visitImplicitReceiver(){return!1}visitThisReceiver(){return!1}visitInterpolation(e){return e.expressions.some(e=>e.visit(this))}visitKeyedRead(){return!1}visitLiteralArray(){return!0}visitLiteralMap(){return!0}visitLiteralPrimitive(){return!1}visitPipe(){return!0}visitPrefixNot(e){return e.expression.visit(this)}visitTypeofExpression(e){return e.expression.visit(this)}visitVoidExpression(e){return e.expression.visit(this)}visitNonNullAssert(e){return e.expression.visit(this)}visitPropertyRead(){return!1}visitSafePropertyRead(){return!1}visitSafeKeyedRead(){return!1}visitTemplateLiteral(){return!1}visitTemplateLiteralElement(){return!1}visitTaggedTemplateLiteral(){return!1}visitParenthesizedExpression(e){return e.expression.visit(this)}visitRegularExpressionLiteral(){return!1}visitSpreadElement(e){return e.expression.visit(this)}visitArrowFunction(e,t){return!1}};var sn=null,cn=!1,ln=1,un=null,dn=Symbol(`SIGNAL`);function w(e){let t=sn;return sn=e,t}function fn(){return sn}var pn={version:0,lastCleanEpoch:0,dirty:!1,producers:void 0,producersTail:void 0,consumers:void 0,consumersTail:void 0,recomputing:!1,consumerAllowSignalWrites:!1,consumerIsAlwaysLive:!1,kind:`unknown`,producerMustRecompute:()=>!1,producerRecomputeValue:()=>{},consumerMarkedDirty:()=>{},consumerOnSignalRead:()=>{}};function mn(e){if(cn)throw Error(``);if(sn===null)return;sn.consumerOnSignalRead(e);let t=sn.producersTail;if(t!==void 0&&t.producer===e)return;let n,r=sn.recomputing;if(r&&(n=t===void 0?sn.producers:t.nextProducer,n!==void 0&&n.producer===e)){sn.producersTail=n,n.lastReadVersion=e.version,n.knownValidAtEpoch=ln;return}let i=e.consumersTail;if(i!==void 0&&i.consumer===sn&&(!r||i.knownValidAtEpoch===ln))return;let a=kn(sn),o={producer:e,consumer:sn,nextProducer:n,prevConsumer:void 0,knownValidAtEpoch:ln,lastReadVersion:e.version,nextConsumer:void 0};sn.producersTail=o,t===void 0?sn.producers=o:t.nextProducer=o,a&&Dn(e,o)}function hn(){ln++}function gn(e){if((!kn(e)||e.dirty)&&(e.dirty||e.lastCleanEpoch!==ln)){if(!e.producerMustRecompute(e)&&!Tn(e)){bn(e);return}e.producerRecomputeValue(e),bn(e)}}function _n(e){if(e.consumers===void 0)return;let t=cn;cn=!0;try{for(let t=e.consumers;t!==void 0;t=t.nextConsumer){let e=t.consumer;e.dirty||yn(e)}}finally{cn=t}}function vn(){return sn?.consumerAllowSignalWrites!==!1}function yn(e){e.dirty=!0,_n(e),e.consumerMarkedDirty?.(e)}function bn(e){e.dirty=!1,e.lastCleanEpoch=ln}function xn(e){return e&&Sn(e),w(e)}function Sn(e){if(e.producersTail?.knownValidAtEpoch===ln){let t=e.producers;for(;t!==void 0;)t.knownValidAtEpoch=null,t=t.nextProducer}e.producersTail=void 0,e.recomputing=!0}function Cn(e,t){w(t),e&&wn(e)}function wn(e){e.recomputing=!1;let t=e.producersTail,n=t===void 0?e.producers:t.nextProducer;if(n!==void 0){if(kn(e))do n=On(n);while(n!==void 0);t===void 0?e.producers=void 0:t.nextProducer=void 0}}function Tn(e){for(let t=e.producers;t!==void 0;t=t.nextProducer){let e=t.producer,n=t.lastReadVersion;if(n!==e.version||(gn(e),n!==e.version))return!0}return!1}function En(e){if(kn(e)){let t=e.producers;for(;t!==void 0;)t=On(t)}e.producers=void 0,e.producersTail=void 0,e.consumers=void 0,e.consumersTail=void 0}function Dn(e,t){let n=e.consumersTail,r=kn(e);if(n===void 0?(t.nextConsumer=void 0,e.consumers=t):(t.nextConsumer=n.nextConsumer,n.nextConsumer=t),t.prevConsumer=n,e.consumersTail=t,!r)for(let t=e.producers;t!==void 0;t=t.nextProducer)Dn(t.producer,t)}function On(e){let t=e.producer,n=e.nextProducer,r=e.nextConsumer,i=e.prevConsumer;if(e.nextConsumer=void 0,e.prevConsumer=void 0,r===void 0?t.consumersTail=i:r.prevConsumer=i,i!==void 0)i.nextConsumer=r;else if(t.consumers=r,!kn(t)){let e=t.producers;for(;e!==void 0;)e=On(e)}return n}function kn(e){return e.consumerIsAlwaysLive||e.consumers!==void 0}function An(e){un?.(e)}function jn(e,t){return Object.is(e,t)}function Mn(e,t){let n=Object.create(In);n.computation=e,t!==void 0&&(n.equal=t);let r=()=>{if(gn(n),mn(n),n.value===Fn)throw n.error;return n.value};return r[dn]=n,An(n),r}var Nn=Symbol(`UNSET`),Pn=Symbol(`COMPUTING`),Fn=Symbol(`ERRORED`),In={...pn,value:Nn,dirty:!0,error:null,equal:jn,kind:`computed`,producerMustRecompute(e){return e.value===Nn||e.value===Pn},producerRecomputeValue(e){if(e.value===Pn)throw Error(``);let t=e.value;e.value=Pn;let n=xn(e),r,i=!1;try{r=e.computation(),w(null),i=t!==Nn&&t!==Fn&&r!==Fn&&e.equal(t,r)}catch(t){r=Fn,e.error=t}finally{Cn(e,n)}if(i){e.value=t;return}e.value=r,e.version++}};function Ln(){throw Error()}var Rn=Ln;function zn(e){Rn(e)}function Bn(e){Rn=e}var Vn=null;function Hn(e,t){let n=Object.create(Kn);n.value=e,t!==void 0&&(n.equal=t);let r=()=>Un(n);return r[dn]=n,An(n),[r,e=>Wn(n,e),e=>Gn(n,e)]}function Un(e){return mn(e),e.value}function Wn(e,t){vn()||zn(e),e.equal(e.value,t)||(e.value=t,qn(e))}function Gn(e,t){vn()||zn(e),Wn(e,t(e.value))}var Kn={...pn,equal:jn,value:void 0,kind:`signal`};function qn(e){e.version++,hn(),_n(e),Vn?.(e)}var Jn={...pn,consumerIsAlwaysLive:!0,consumerAllowSignalWrites:!0,dirty:!0,kind:`effect`};function Yn(e){if(e.dirty=!1,e.version>0&&!Tn(e))return;e.version++;let t=xn(e);try{e.cleanup(),e.fn()}finally{Cn(e,t)}}var Xn=void 0;function Zn(){return Xn}function Qn(e){let t=Xn;return Xn=e,t}var $n=Symbol(`NotFound`);function er(e){return e===$n||e?.name===`ɵNotFound`}function tr(e,t,n){let r=Object.create(ir);r.source=e,r.computation=t,n!=null&&(r.equal=n);let i=()=>{if(gn(r),mn(r),r.value===Fn)throw r.error;return r.value};return i[dn]=r,An(r),i}function nr(e,t){gn(e),Wn(e,t),bn(e)}function rr(e,t){if(gn(e),e.value===Fn)throw e.error;Gn(e,t),bn(e)}var ir={...pn,value:Nn,dirty:!0,error:null,equal:jn,kind:`linkedSignal`,producerMustRecompute(e){return e.value===Nn||e.value===Pn},producerRecomputeValue(e){if(e.value===Pn)throw Error(``);let t=e.value;e.value=Pn;let n=xn(e),r,i=!1;try{let n=e.source(),a=t!==Nn&&t!==Fn,o=a?{source:e.sourceValue,value:t}:void 0;r=e.computation(n,o),e.sourceValue=n,w(null),i=a&&r!==Fn&&e.equal(t,r)}catch(t){r=Fn,e.error=t}finally{Cn(e,n)}if(i){e.value=t;return}e.value=r,e.version++}};function ar(e){let t=w(null);try{return e()}finally{w(t)}}var or=function(e,t){return or=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(e,t){e.__proto__=t}||function(e,t){for(var n in t)Object.prototype.hasOwnProperty.call(t,n)&&(e[n]=t[n])},or(e,t)};function sr(e,t){if(typeof t!=`function`&&t!==null)throw TypeError(`Class extends value `+String(t)+` is not a constructor or null`);or(e,t);function n(){this.constructor=e}e.prototype=t===null?Object.create(t):(n.prototype=t.prototype,new n)}function cr(e){var t=typeof Symbol==`function`&&Symbol.iterator,n=t&&e[t],r=0;if(n)return n.call(e);if(e&&typeof e.length==`number`)return{next:function(){return e&&r>=e.length&&(e=void 0),{value:e&&e[r++],done:!e}}};throw TypeError(t?`Object is not iterable.`:`Symbol.iterator is not defined.`)}function lr(e,t){var n=typeof Symbol==`function`&&e[Symbol.iterator];if(!n)return e;var r=n.call(e),i,a=[],o;try{for(;(t===void 0||t-->0)&&!(i=r.next()).done;)a.push(i.value)}catch(e){o={error:e}}finally{try{i&&!i.done&&(n=r.return)&&n.call(r)}finally{if(o)throw o.error}}return a}function ur(e,t,n){if(n||arguments.length===2)for(var r=0,i=t.length,a;r<i;r++)(a||!(r in t))&&(a||=Array.prototype.slice.call(t,0,r),a[r]=t[r]);return e.concat(a||Array.prototype.slice.call(t))}function dr(e){return typeof e==`function`}function fr(e){var t=e(function(e){Error.call(e),e.stack=Error().stack});return t.prototype=Object.create(Error.prototype),t.prototype.constructor=t,t}var pr=fr(function(e){return function(t){e(this),this.message=t?t.length+` errors occurred during unsubscription:
`+t.map(function(e,t){return t+1+`) `+e.toString()}).join(`
  `):``,this.name=`UnsubscriptionError`,this.errors=t}});function mr(e,t){if(e){var n=e.indexOf(t);0<=n&&e.splice(n,1)}}var hr=function(){function e(e){this.initialTeardown=e,this.closed=!1,this._parentage=null,this._finalizers=null}return e.prototype.unsubscribe=function(){var e,t,n,r,i;if(!this.closed){this.closed=!0;var a=this._parentage;if(a){if(this._parentage=null,Array.isArray(a))try{for(var o=cr(a),s=o.next();!s.done;s=o.next())s.value.remove(this)}catch(t){e={error:t}}finally{try{s&&!s.done&&(t=o.return)&&t.call(o)}finally{if(e)throw e.error}}else a.remove(this)}var c=this.initialTeardown;if(dr(c))try{c()}catch(e){i=e instanceof pr?e.errors:[e]}var l=this._finalizers;if(l){this._finalizers=null;try{for(var u=cr(l),d=u.next();!d.done;d=u.next()){var f=d.value;try{vr(f)}catch(e){i??=[],e instanceof pr?i=ur(ur([],lr(i)),lr(e.errors)):i.push(e)}}}catch(e){n={error:e}}finally{try{d&&!d.done&&(r=u.return)&&r.call(u)}finally{if(n)throw n.error}}}if(i)throw new pr(i)}},e.prototype.add=function(t){if(t&&t!==this){if(this.closed)vr(t);else{if(t instanceof e){if(t.closed||t._hasParent(this))return;t._addParent(this)}(this._finalizers=this._finalizers??[]).push(t)}}},e.prototype._hasParent=function(e){var t=this._parentage;return t===e||Array.isArray(t)&&t.includes(e)},e.prototype._addParent=function(e){var t=this._parentage;this._parentage=Array.isArray(t)?(t.push(e),t):t?[t,e]:e},e.prototype._removeParent=function(e){var t=this._parentage;t===e?this._parentage=null:Array.isArray(t)&&mr(t,e)},e.prototype.remove=function(t){var n=this._finalizers;n&&mr(n,t),t instanceof e&&t._removeParent(this)},e.EMPTY=(function(){var t=new e;return t.closed=!0,t})(),e}(),gr=hr.EMPTY;function _r(e){return e instanceof hr||e&&`closed`in e&&dr(e.remove)&&dr(e.add)&&dr(e.unsubscribe)}function vr(e){dr(e)?e():e.unsubscribe()}var yr={onUnhandledError:null,onStoppedNotification:null,Promise:void 0,useDeprecatedSynchronousErrorHandling:!1,useDeprecatedNextContext:!1},br={setTimeout:function(e,t){var n=[...arguments].slice(2),r=br.delegate;return r?.setTimeout?r.setTimeout.apply(r,ur([e,t],lr(n))):setTimeout.apply(void 0,ur([e,t],lr(n)))},clearTimeout:function(e){return(br.delegate?.clearTimeout||clearTimeout)(e)},delegate:void 0};function xr(e){br.setTimeout(function(){var t=yr.onUnhandledError;if(t)t(e);else throw e})}function Sr(){}var Cr=(function(){return Er(`C`,void 0,void 0)})();function wr(e){return Er(`E`,void 0,e)}function Tr(e){return Er(`N`,e,void 0)}function Er(e,t,n){return{kind:e,value:t,error:n}}var Dr=null;function Or(e){if(yr.useDeprecatedSynchronousErrorHandling){var t=!Dr;if(t&&(Dr={errorThrown:!1,error:null}),e(),t){var n=Dr,r=n.errorThrown,i=n.error;if(Dr=null,r)throw i}}else e()}function kr(e){yr.useDeprecatedSynchronousErrorHandling&&Dr&&(Dr.errorThrown=!0,Dr.error=e)}var Ar=function(e){sr(t,e);function t(t){var n=e.call(this)||this;return n.isStopped=!1,t?(n.destination=t,_r(t)&&t.add(n)):n.destination=Rr,n}return t.create=function(e,t,n){return new Pr(e,t,n)},t.prototype.next=function(e){this.isStopped?Lr(Tr(e),this):this._next(e)},t.prototype.error=function(e){this.isStopped?Lr(wr(e),this):(this.isStopped=!0,this._error(e))},t.prototype.complete=function(){this.isStopped?Lr(Cr,this):(this.isStopped=!0,this._complete())},t.prototype.unsubscribe=function(){this.closed||(this.isStopped=!0,e.prototype.unsubscribe.call(this),this.destination=null)},t.prototype._next=function(e){this.destination.next(e)},t.prototype._error=function(e){try{this.destination.error(e)}finally{this.unsubscribe()}},t.prototype._complete=function(){try{this.destination.complete()}finally{this.unsubscribe()}},t}(hr),jr=Function.prototype.bind;function Mr(e,t){return jr.call(e,t)}var Nr=function(){function e(e){this.partialObserver=e}return e.prototype.next=function(e){var t=this.partialObserver;if(t.next)try{t.next(e)}catch(e){Fr(e)}},e.prototype.error=function(e){var t=this.partialObserver;if(t.error)try{t.error(e)}catch(e){Fr(e)}else Fr(e)},e.prototype.complete=function(){var e=this.partialObserver;if(e.complete)try{e.complete()}catch(e){Fr(e)}},e}(),Pr=function(e){sr(t,e);function t(t,n,r){var i=e.call(this)||this,a;if(dr(t)||!t)a={next:t??void 0,error:n??void 0,complete:r??void 0};else{var o;i&&yr.useDeprecatedNextContext?(o=Object.create(t),o.unsubscribe=function(){return i.unsubscribe()},a={next:t.next&&Mr(t.next,o),error:t.error&&Mr(t.error,o),complete:t.complete&&Mr(t.complete,o)}):a=t}return i.destination=new Nr(a),i}return t}(Ar);function Fr(e){yr.useDeprecatedSynchronousErrorHandling?kr(e):xr(e)}function Ir(e){throw e}function Lr(e,t){var n=yr.onStoppedNotification;n&&br.setTimeout(function(){return n(e,t)})}var Rr={closed:!0,next:Sr,error:Ir,complete:Sr},zr=(function(){return typeof Symbol==`function`&&Symbol.observable||`@@observable`})();function Br(e){return e}function Vr(e){return e.length===0?Br:e.length===1?e[0]:function(t){return e.reduce(function(e,t){return t(e)},t)}}var Hr=function(){function e(e){e&&(this._subscribe=e)}return e.prototype.lift=function(t){var n=new e;return n.source=this,n.operator=t,n},e.prototype.subscribe=function(e,t,n){var r=this,i=Gr(e)?e:new Pr(e,t,n);return Or(function(){var e=r,t=e.operator,n=e.source;i.add(t?t.call(i,n):n?r._subscribe(i):r._trySubscribe(i))}),i},e.prototype._trySubscribe=function(e){try{return this._subscribe(e)}catch(t){e.error(t)}},e.prototype.forEach=function(e,t){var n=this;return t=Ur(t),new t(function(t,r){var i=new Pr({next:function(t){try{e(t)}catch(e){r(e),i.unsubscribe()}},error:r,complete:t});n.subscribe(i)})},e.prototype._subscribe=function(e){return this.source?.subscribe(e)},e.prototype[zr]=function(){return this},e.prototype.pipe=function(){return Vr([...arguments])(this)},e.prototype.toPromise=function(e){var t=this;return e=Ur(e),new e(function(e,n){var r;t.subscribe(function(e){return r=e},function(e){return n(e)},function(){return e(r)})})},e.create=function(t){return new e(t)},e}();function Ur(e){return e??yr.Promise??Promise}function Wr(e){return e&&dr(e.next)&&dr(e.error)&&dr(e.complete)}function Gr(e){return e&&e instanceof Ar||Wr(e)&&_r(e)}function Kr(e){return dr(e?.lift)}function qr(e){return function(t){if(Kr(t))return t.lift(function(t){try{return e(t,this)}catch(e){this.error(e)}});throw TypeError(`Unable to lift unknown Observable type`)}}function Jr(e,t,n,r,i){return new Yr(e,t,n,r,i)}var Yr=function(e){sr(t,e);function t(t,n,r,i,a,o){var s=e.call(this,t)||this;return s.onFinalize=a,s.shouldUnsubscribe=o,s._next=n?function(e){try{n(e)}catch(e){t.error(e)}}:e.prototype._next,s._error=i?function(e){try{i(e)}catch(e){t.error(e)}finally{this.unsubscribe()}}:e.prototype._error,s._complete=r?function(){try{r()}catch(e){t.error(e)}finally{this.unsubscribe()}}:e.prototype._complete,s}return t.prototype.unsubscribe=function(){var t;if(!this.shouldUnsubscribe||this.shouldUnsubscribe()){var n=this.closed;e.prototype.unsubscribe.call(this),!n&&((t=this.onFinalize)==null||t.call(this))}},t}(Ar),Xr=fr(function(e){return function(){e(this),this.name=`ObjectUnsubscribedError`,this.message=`object unsubscribed`}}),Zr=function(e){sr(t,e);function t(){var t=e.call(this)||this;return t.closed=!1,t.currentObservers=null,t.observers=[],t.isStopped=!1,t.hasError=!1,t.thrownError=null,t}return t.prototype.lift=function(e){var t=new Qr(this,this);return t.operator=e,t},t.prototype._throwIfClosed=function(){if(this.closed)throw new Xr},t.prototype.next=function(e){var t=this;Or(function(){var n,r;if(t._throwIfClosed(),!t.isStopped){t.currentObservers||=Array.from(t.observers);try{for(var i=cr(t.currentObservers),a=i.next();!a.done;a=i.next())a.value.next(e)}catch(e){n={error:e}}finally{try{a&&!a.done&&(r=i.return)&&r.call(i)}finally{if(n)throw n.error}}}})},t.prototype.error=function(e){var t=this;Or(function(){if(t._throwIfClosed(),!t.isStopped){t.hasError=t.isStopped=!0,t.thrownError=e;for(var n=t.observers;n.length;)n.shift().error(e)}})},t.prototype.complete=function(){var e=this;Or(function(){if(e._throwIfClosed(),!e.isStopped){e.isStopped=!0;for(var t=e.observers;t.length;)t.shift().complete()}})},t.prototype.unsubscribe=function(){this.isStopped=this.closed=!0,this.observers=this.currentObservers=null},Object.defineProperty(t.prototype,"observed",{get:function(){return this.observers?.length>0},enumerable:!1,configurable:!0}),t.prototype._trySubscribe=function(t){return this._throwIfClosed(),e.prototype._trySubscribe.call(this,t)},t.prototype._subscribe=function(e){return this._throwIfClosed(),this._checkFinalizedStatuses(e),this._innerSubscribe(e)},t.prototype._innerSubscribe=function(e){var t=this,n=this,r=n.hasError,i=n.isStopped,a=n.observers;return r||i?gr:(this.currentObservers=null,a.push(e),new hr(function(){t.currentObservers=null,mr(a,e)}))},t.prototype._checkFinalizedStatuses=function(e){var t=this,n=t.hasError,r=t.thrownError,i=t.isStopped;n?e.error(r):i&&e.complete()},t.prototype.asObservable=function(){var e=new Hr;return e.source=this,e},t.create=function(e,t){return new Qr(e,t)},t}(Hr),Qr=function(e){sr(t,e);function t(t,n){var r=e.call(this)||this;return r.destination=t,r.source=n,r}return t.prototype.next=function(e){var t,n;(n=(t=this.destination)?.next)==null||n.call(t,e)},t.prototype.error=function(e){var t,n;(n=(t=this.destination)?.error)==null||n.call(t,e)},t.prototype.complete=function(){var e,t;(t=(e=this.destination)?.complete)==null||t.call(e)},t.prototype._subscribe=function(e){return this.source?.subscribe(e)??gr},t}(Zr),$r=function(e){sr(t,e);function t(t){var n=e.call(this)||this;return n._value=t,n}return Object.defineProperty(t.prototype,"value",{get:function(){return this.getValue()},enumerable:!1,configurable:!0}),t.prototype._subscribe=function(t){var n=e.prototype._subscribe.call(this,t);return!n.closed&&t.next(this._value),n},t.prototype.getValue=function(){var e=this,t=e.hasError,n=e.thrownError,r=e._value;if(t)throw n;return this._throwIfClosed(),r},t.prototype.next=function(t){e.prototype.next.call(this,this._value=t)},t}(Zr);function ei(e,t){return qr(function(n,r){var i=0;n.subscribe(Jr(r,function(n){r.next(e.call(t,n,i++))}))})}var ti=`https://angular.dev/best-practices/security#preventing-cross-site-scripting-xss`,T=class extends Error{code;constructor(e,t){super(ri(e,t)),this.code=e}};function ni(e){return`NG0${Math.abs(e)}`}function ri(e,t){return`${ni(e)}${t?`: `+t:``}`}function ii(e){for(let t in e)if(e[t]===ii)return t;throw Error(``)}function ai(e){if(typeof e==`string`)return e;if(Array.isArray(e))return`[${e.map(ai).join(`, `)}]`;if(e==null)return``+e;let t=e.overriddenName||e.name;if(t)return`${t}`;let n=e.toString();if(n==null)return``+n;let r=n.indexOf(`
`);return r>=0?n.slice(0,r):n}function oi(e,t){return e?t?`${e} ${t}`:e:t||``}var si=ii({__forward_ref__:ii});function ci(e){return e.__forward_ref__=ci,e}function li(e){return ui(e)?e():e}function ui(e){return typeof e==`function`&&Object.hasOwn(e,si)&&e.__forward_ref__===ci}function di(e){return{token:e.token,providedIn:e.providedIn||null,factory:e.factory,value:void 0}}function fi(e){return pi(e,gi)}function pi(e,t){return Object.hasOwn(e,t)&&e[t]||null}function mi(e){return(e?.[gi]??null)||null}function hi(e){return e&&Object.hasOwn(e,_i)?e[_i]:null}var gi=ii({ɵprov:ii}),_i=ii({ɵinj:ii}),vi=class{_desc;ngMetadataName=`InjectionToken`;ɵprov;constructor(e,t){this._desc=e,this.ɵprov=void 0,typeof t==`number`?this.__NG_ELEMENT_ID__=t:t!==void 0&&(this.ɵprov=di({token:this,providedIn:t.providedIn||`root`,factory:t.factory}))}get multi(){return this}toString(){return`InjectionToken ${this._desc}`}};function yi(e){return e&&!!e.ɵproviders}var bi=ii({ɵcmp:ii}),xi=ii({ɵdir:ii}),Si=ii({ɵpipe:ii}),Ci=ii({ɵfac:ii}),wi=ii({__NG_ELEMENT_ID__:ii}),Ti=ii({__NG_ENV_ID__:ii});function Ei(e){return ki(e,`@Component`),e[bi]||null}function Di(e){return ki(e,`@Directive`),e[xi]||null}function Oi(e){return ki(e,`@Pipe`),e[Si]||null}function ki(e,t){if(e==null)throw new T(-919,!1)}function Ai(e){return typeof e==`string`?e:e==null?``:String(e)}var ji=ii({ngErrorCode:ii}),Mi=ii({ngErrorMessage:ii}),Ni=ii({ngTokenPath:ii});function Pi(e,t){return Ii(``,-200,t)}function Fi(e,t){throw new T(-201,!1)}function Ii(e,t,n){let r=new T(t,e);return r[ji]=t,r[Mi]=e,n&&(r[Ni]=n),r}function Li(e){return e[ji]}var Ri;function zi(){return Ri}function Bi(e){let t=Ri;return Ri=e,t}function Vi(e,t,n){let r=fi(e);if(r&&r.providedIn==`root`)return r.value===void 0?r.value=r.factory():r.value;if(n&8)return null;if(t!==void 0)return t;Fi(e,``)}var Hi=globalThis,Ui={},Wi=`__NG_DI_FLAG__`,Gi=class{injector;constructor(e){this.injector=e}retrieve(e,t){let n=Ji(t)||0;try{return this.injector.get(e,n&8?null:Ui,n)}catch(e){if(er(e))return e;throw e}}};function Ki(e,t=0){let n=Zn();if(n===void 0)throw new T(-203,!1);if(n===null)return Vi(e,void 0,t);{let r=Yi(t),i=n.retrieve(e,r);if(er(i)){if(r.optional)return null;throw i}return i}}function qi(e,t=0){return(zi()||Ki)(li(e),t)}function E(e,t){return qi(e,Ji(t))}function Ji(e){return e===void 0||typeof e==`number`?e:0|(e.optional&&8)|(e.host&&1)|(e.self&&2)|(e.skipSelf&&4)}function Yi(e){return{optional:!!(e&8),host:!!(e&1),self:!!(e&2),skipSelf:!!(e&4)}}function Xi(e){let t=[];for(let n=0;n<e.length;n++){let r=li(e[n]);if(Array.isArray(r)){if(r.length===0)throw new T(900,!1);let e,n=0;for(let t=0;t<r.length;t++){let i=r[t],a=Zi(i);typeof a==`number`?a===-1?e=i.token:n|=a:e=i}t.push(qi(e,n))}else t.push(qi(r))}return t}function Zi(e){return e[Wi]}function Qi(e,t){return Object.hasOwn(e,Ci)?e[Ci]:null}function $i(e,t,n){if(e.length!==t.length)return!1;for(let r=0;r<e.length;r++){let i=e[r],a=t[r];if(n&&(i=n(i),a=n(a)),a!==i)return!1}return!0}function ea(e){return e.flat(1/0)}function ta(e,t){e.forEach(e=>Array.isArray(e)?ta(e,t):t(e))}function na(e,t,n){t>=e.length?e.push(n):e.splice(t,0,n)}function ra(e,t){return t>=e.length-1?e.pop():e.splice(t,1)[0]}function ia(e,t,n,r){let i=e.length;if(i==t)e.push(n,r);else if(i===1)e.push(r,e[0]),e[0]=n;else{for(i--,e.push(e[i-1],e[i]);i>t;){let t=i-2;e[i]=e[t],i--}e[t]=n,e[t+1]=r}}function aa(e,t,n){let r=sa(e,t);return r>=0?e[r|1]=n:(r=~r,ia(e,r,t,n)),r}function oa(e,t){let n=sa(e,t);if(n>=0)return e[n|1]}function sa(e,t){return ca(e,t,1)}function ca(e,t,n){let r=0,i=e.length>>n;for(;i!==r;){let a=r+(i-r>>1),o=e[a<<n];if(t===o)return a<<n;o>t?i=a:r=a+1}return~(i<<n)}var la={},ua=[],da=new vi(``),fa=new vi(``,-1),pa=new vi(``),ma=class{get(e,t=Ui){if(t===Ui){let e=Ii(``,-201);throw e.name=`ɵNotFound`,e}return t}};function ha(...e){return{ɵproviders:ga(!0,e),ɵfromNgModule:!0}}function ga(e,...t){let n=[],r=new Set,i,a=e=>{n.push(e)};return ta(t,e=>{let t=e;va(t,a,[],r)&&(i||=[],i.push(t))}),i!==void 0&&_a(i,a),n}function _a(e,t){for(let n=0;n<e.length;n++){let{ngModule:r,providers:i}=e[n];ya(i,e=>{t(e,r)})}}function va(e,t,n,r){if(e=li(e),!e)return!1;let i=null,a=hi(e),o=!a&&Ei(e);if(!a&&!o){let t=e.ngModule;if(a=hi(t),a)i=t;else return!1}else if(o&&!o.standalone)return!1;else i=e;let s=r.has(i);if(o){if(s)return!1;if(r.add(i),o.dependencies){let e=typeof o.dependencies==`function`?o.dependencies():o.dependencies;for(let i of e)va(i,t,n,r)}}else if(a){if(a.imports!=null&&!s){r.add(i);let e;try{ta(a.imports,i=>{va(i,t,n,r)&&(e||=[],e.push(i))})}finally{}e!==void 0&&_a(e,t)}if(!s){let e=Qi(i)||(()=>new i);t({provide:i,useFactory:e,deps:ua},i),t({provide:pa,useValue:i,multi:!0},i),t({provide:da,useValue:()=>qi(i),multi:!0},i)}let o=a.providers;if(o!=null&&!s){let n=e;ya(o,e=>{t(e,n)})}}else return!1;return i!==e&&e.providers!==void 0}function ya(e,t){for(let n of e)yi(n)&&(n=n.ɵproviders),Array.isArray(n)?ya(n,t):t(n)}var ba=ii({provide:String,useValue:ii});function xa(e){return typeof e==`object`&&!!e&&ba in e}function Sa(e){return!!(e&&e.useExisting)}function Ca(e){return!!(e&&e.useFactory)}function wa(e){return typeof e==`function`}var Ta=new vi(``),Ea={},Da={},Oa=void 0;function ka(){return Oa===void 0&&(Oa=new ma),Oa}var Aa=class{},ja=class extends Aa{parent;source;scopes;records=new Map;_ngOnDestroyHooks=new Set;_onDestroyHooks=[];get destroyed(){return this._destroyed}_destroyed=!1;injectorDefTypes;constructor(e,t,n,r){super(),this.parent=t,this.source=n,this.scopes=r,Va(e,e=>this.processProvider(e)),this.records.set(fa,La(void 0,this)),r.has(`environment`)&&this.records.set(Aa,La(void 0,this));let i=this.records.get(Ta);i!=null&&typeof i.value==`string`&&this.scopes.add(i.value),this.injectorDefTypes=new Set(this.get(pa,ua,{self:!0}))}retrieve(e,t){let n=Ji(t)||0;try{return this.get(e,Ui,n)}catch(e){if(er(e))return e;throw e}}destroy(){Ia(this),this._destroyed=!0;let e=w(null);try{for(let e of this._ngOnDestroyHooks)e.ngOnDestroy();let e=this._onDestroyHooks;this._onDestroyHooks=[];for(let t of e)t()}finally{this.records.clear(),this._ngOnDestroyHooks.clear(),this.injectorDefTypes.clear(),w(e)}}onDestroy(e){return Ia(this),this._onDestroyHooks.push(e),()=>this.removeOnDestroy(e)}runInContext(e){Ia(this);let t=Qn(this),n=Bi(void 0);try{return e()}finally{Qn(t),Bi(n)}}get(e,t=Ui,n){if(Ia(this),Object.hasOwn(e,Ti))return e[Ti](this);let r=Ji(n),i=Qn(this),a=Bi(void 0);try{if(!(r&4)){let t=this.records.get(e);if(t===void 0){let n=Ba(e)&&fi(e);t=n&&this.injectableDefInScope(n)?La(Ma(e),Ea):null,this.records.set(e,t)}if(t!=null)return this.hydrate(e,t,r)}let n=r&2?ka():this.parent;return t=r&8&&t===Ui?null:t,n.get(e,t)}catch(e){let t=Li(e);throw t===-200||t===-201?new T(t,null):e}finally{Bi(a),Qn(i)}}resolveInjectorInitializers(){let e=w(null),t=Qn(this),n=Bi(void 0);try{let e=this.get(da,ua,{self:!0});for(let t of e)t()}finally{Qn(t),Bi(n),w(e)}}toString(){return`R3Injector[...]`}processProvider(e){e=li(e);let t=wa(e)?e:li(e&&e.provide),n=Pa(e);if(!wa(e)&&e.multi===!0){let n=this.records.get(t);n||(n=La(void 0,Ea,!0),n.factory=()=>Xi(n.multi),this.records.set(t,n)),t=e,n.multi.push(e)}this.records.set(t,n)}hydrate(e,t,n){let r=w(null);try{if(t.value===Da)throw Pi(``);return t.value===Ea&&(t.value=Da,t.value=t.factory(void 0,n)),typeof t.value==`object`&&t.value&&za(t.value)&&this._ngOnDestroyHooks.add(t.value),t.value}finally{w(r)}}injectableDefInScope(e){if(!e.providedIn)return!1;let t=li(e.providedIn);return typeof t==`string`?t===`any`||this.scopes.has(t):this.injectorDefTypes.has(t)}removeOnDestroy(e){let t=this._onDestroyHooks.indexOf(e);t!==-1&&this._onDestroyHooks.splice(t,1)}};function Ma(e){let t=fi(e),n=t===null?Qi(e):t.factory;if(n!==null)return n;if(e instanceof vi)throw new T(-204,!1);if(e instanceof Function)return Na(e);throw new T(-204,!1)}function Na(e){if(e.length>0)throw new T(-204,!1);let t=mi(e);return t===null?()=>new e:()=>t.factory(e)}function Pa(e){return xa(e)?La(void 0,e.useValue):La(Fa(e),Ea)}function Fa(e,t,n){let r;if(wa(e)){let t=li(e);return Qi(t)||Ma(t)}if(xa(e))r=()=>li(e.useValue);else if(Ca(e))r=()=>e.useFactory(...Xi(e.deps||[]));else if(Sa(e))r=(t,n)=>qi(li(e.useExisting),n!==void 0&&n&8?8:void 0);else{let t=li(e&&(e.useClass||e.provide));if(Ra(e))r=()=>new t(...Xi(e.deps));else return Qi(t)||Ma(t)}return r}function Ia(e){if(e.destroyed)throw new T(-205,!1)}function La(e,t,n=!1){return{factory:e,value:t,multi:n?[]:void 0}}function Ra(e){return!!e.deps}function za(e){return typeof e==`object`&&!!e&&typeof e.ngOnDestroy==`function`}function Ba(e){return typeof e==`function`||typeof e==`object`&&e.ngMetadataName===`InjectionToken`}function Va(e,t){for(let n of e)Array.isArray(n)?Va(n,t):n&&yi(n)?Va(n.ɵproviders,t):t(n)}function Ha(e,t){let n;e instanceof ja?(Ia(e),n=e):n=new Gi(e);let r=Qn(n),i=Bi(void 0);try{return t()}finally{Qn(r),Bi(i)}}function Ua(){return zi()!==void 0||Zn()!=null}var Wa=1;function Ga(e){return Array.isArray(e)&&typeof e[Wa]==`object`}function Ka(e){return Array.isArray(e)&&e[Wa]===!0}function qa(e){return!!(e.flags&4)}function Ja(e){return e.componentOffset>-1}function Ya(e){return(e.flags&1)==1}function Xa(e){return!!e.template}function Za(e){return!!(e[2]&512)}function Qa(e){return(e[2]&256)==256}var $a=(function(e){return e[e.NONE=0]=`NONE`,e[e.HTML=1]=`HTML`,e[e.STYLE=2]=`STYLE`,e[e.SCRIPT=3]=`SCRIPT`,e[e.URL=4]=`URL`,e[e.RESOURCE_URL=5]=`RESOURCE_URL`,e[e.ATTRIBUTE_NO_BINDING=6]=`ATTRIBUTE_NO_BINDING`,e})($a||{}),eo=`math`;function to(e){for(;Array.isArray(e);)e=e[0];return e}function no(e,t){return to(t[e])}function ro(e,t){return to(t[e.index])}function io(e,t){return e.data[t]}function ao(e,t){return e[t]}function oo(e,t,n,r){n>=e.data.length&&(e.data[n]=null,e.blueprint[n]=null),t[n]=r}function so(e,t){let n=t[e];return Ga(n)?n:n[0]}function co(e){return(e[2]&128)==128}function lo(e){return Ka(e[3])}function uo(e,t){return t==null?null:e[t]}function fo(e){e[17]=0}function po(e){e[2]&1024||(e[2]|=1024,co(e)&&_o(e))}function mo(e,t){for(;e>0;)t=t[14],e--;return t}function ho(e){return!!(e[2]&9216||e[24]?.dirty)}function go(e){e[10].changeDetectionScheduler?.notify(8),e[2]&64&&(e[2]|=1024),ho(e)&&_o(e)}function _o(e){e[10].changeDetectionScheduler?.notify(0);let t=bo(e);for(;t!==null&&!(t[2]&8192||(t[2]|=8192,!co(t)));)t=bo(t)}function vo(e,t){if(Qa(e))throw new T(911,!1);e[21]===null&&(e[21]=[]),e[21].push(t)}function yo(e,t){if(e[21]===null)return;let n=e[21].indexOf(t);n!==-1&&e[21].splice(n,1)}function bo(e){let t=e[3];return Ka(t)?t[3]:t}function xo(e){return e[7]??=[]}function So(e){return e.cleanup??=[]}function Co(e,t,n,r){let i=xo(t);i.push(n),e.firstCreatePass&&So(e).push(r,i.length-1)}var wo={lFrame:as(null),bindingsEnabled:!0,skipHydrationRootTNode:null},To=!1;function Eo(){return wo.lFrame.elementDepthCount}function Do(){wo.lFrame.elementDepthCount++}function Oo(){wo.lFrame.elementDepthCount--}function ko(){return wo.bindingsEnabled}function Ao(){return wo.skipHydrationRootTNode!==null}function jo(e){return wo.skipHydrationRootTNode===e}function Mo(){wo.skipHydrationRootTNode=null}function D(){return wo.lFrame.lView}function No(){return wo.lFrame.tView}function O(e){return wo.lFrame.contextLView=e,e[8]}function k(e){return wo.lFrame.contextLView=null,e}function Po(){let e=Fo();for(;e!==null&&e.type===64;)e=e.parent;return e}function Fo(){return wo.lFrame.currentTNode}function Io(){let e=wo.lFrame,t=e.currentTNode;return e.isParent?t:t.parent}function Lo(e,t){let n=wo.lFrame;n.currentTNode=e,n.isParent=t}function Ro(){return wo.lFrame.isParent}function zo(){wo.lFrame.isParent=!1}function Bo(){return wo.lFrame.contextLView}function Vo(){return To}function Ho(e){let t=To;return To=e,t}function Uo(){let e=wo.lFrame,t=e.bindingRootIndex;return t===-1&&(t=e.bindingRootIndex=e.tView.bindingStartIndex),t}function Wo(){return wo.lFrame.bindingIndex}function Go(e){return wo.lFrame.bindingIndex=e}function Ko(){return wo.lFrame.bindingIndex++}function qo(e){let t=wo.lFrame,n=t.bindingIndex;return t.bindingIndex+=e,n}function Jo(){return wo.lFrame.inI18n}function Yo(e,t){let n=wo.lFrame;n.bindingIndex=n.bindingRootIndex=e,Zo(t)}function Xo(){return wo.lFrame.currentDirectiveIndex}function Zo(e){wo.lFrame.currentDirectiveIndex=e}function Qo(e){let t=wo.lFrame.currentDirectiveIndex;return t===-1?null:e[t]}function $o(){return wo.lFrame.currentQueryIndex}function es(e){wo.lFrame.currentQueryIndex=e}function ts(e){let t=e[1];return t.type===2?t.declTNode:t.type===1?e[5]:null}function ns(e,t,n){if(n&4){let r=t,i=e;for(;r=r.parent,r===null&&!(n&1)&&(r=ts(i),!(r===null||(i=i[14],r.type&10))););if(r===null)return!1;t=r,e=i}let r=wo.lFrame=is();return r.currentTNode=t,r.lView=e,!0}function rs(e){let t=is(),n=e[1];wo.lFrame=t,t.currentTNode=n.firstChild,t.lView=e,t.tView=n,t.contextLView=e,t.bindingIndex=n.bindingStartIndex,t.inI18n=!1}function is(){let e=wo.lFrame,t=e===null?null:e.child;return t===null?as(e):t}function as(e){let t={currentTNode:null,isParent:!0,lView:null,tView:null,selectedIndex:-1,contextLView:null,elementDepthCount:0,currentNamespace:null,currentDirectiveIndex:-1,bindingRootIndex:-1,bindingIndex:-1,currentQueryIndex:0,parent:e,child:null,inI18n:!1};return e!==null&&(e.child=t),t}function os(){let e=wo.lFrame;return wo.lFrame=e.parent,e.currentTNode=null,e.lView=null,e}var ss=os;function cs(){let e=os();e.isParent=!0,e.tView=null,e.selectedIndex=-1,e.contextLView=null,e.elementDepthCount=0,e.currentDirectiveIndex=-1,e.currentNamespace=null,e.bindingRootIndex=-1,e.bindingIndex=-1,e.currentQueryIndex=0}function ls(e){return(wo.lFrame.contextLView=mo(e,wo.lFrame.contextLView))[8]}function us(){return wo.lFrame.selectedIndex}function ds(e){wo.lFrame.selectedIndex=e}function fs(){let e=wo.lFrame;return io(e.tView,e.selectedIndex)}function A(){wo.lFrame.currentNamespace=`svg`}function ps(){ms()}function ms(){wo.lFrame.currentNamespace=null}function hs(){return wo.lFrame.currentNamespace}var gs=!0;function _s(){return gs}function vs(e){gs=e}function ys(e,t=null,n=null,r){let i=bs(e,t,n,r);return i.resolveInjectorInitializers(),i}function bs(e,t=null,n=null,r,i=new Set){return new ja([n||ua,ha(e)],t||ka(),null,i)}var xs=class e{static THROW_IF_NOT_FOUND=Ui;static NULL=new ma;static create(e,t){if(Array.isArray(e))return ys({name:``},t,e,``);{let t=e.name??``;return ys({name:t},e.parent,e.providers,t)}}static ɵprov=di({token:e,providedIn:`any`,factory:()=>qi(fa)});static __NG_ELEMENT_ID__=-1},Ss=new vi(``),Cs=class{static __NG_ELEMENT_ID__=Ts;static __NG_ENV_ID__=e=>e},ws=class extends Cs{_lView;constructor(e){super(),this._lView=e}get destroyed(){return Qa(this._lView)}onDestroy(e){let t=this._lView;return vo(t,e),()=>yo(t,e)}};function Ts(){return new ws(D())}var Es=new vi(``),Ds=(()=>{class e{taskId=0;pendingTasks=new Set;destroyed=!1;pendingTask=new $r(!1);debugTaskTracker=E(Es,{optional:!0});get hasPendingTasks(){return!this.destroyed&&this.pendingTask.value}get hasPendingTasksObservable(){return this.destroyed?new Hr(e=>{e.next(!1),e.complete()}):this.pendingTask}add(){!this.hasPendingTasks&&!this.destroyed&&this.pendingTask.next(!0);let e=this.taskId++;return this.pendingTasks.add(e),this.debugTaskTracker?.add(e),e}has(e){return this.pendingTasks.has(e)}remove(e){this.pendingTasks.delete(e),this.debugTaskTracker?.remove(e),this.pendingTasks.size===0&&this.hasPendingTasks&&this.pendingTask.next(!1)}ngOnDestroy(){this.pendingTasks.clear(),this.hasPendingTasks&&this.pendingTask.next(!1),this.destroyed=!0,this.pendingTask.unsubscribe()}static ɵprov=di({token:e,providedIn:`root`,factory:()=>new e})}return e})(),Os=class extends Zr{__isAsync;destroyRef=void 0;pendingTasks=void 0;constructor(e=!1){super(),this.__isAsync=e,Ua()&&(this.destroyRef=E(Cs,{optional:!0})??void 0,this.pendingTasks=E(Ds,{optional:!0})??void 0)}emit(e){let t=w(null);try{super.next(e)}finally{w(t)}}subscribe(e,t,n){let r=e,i=t||(()=>null),a=n;if(e&&typeof e==`object`){let t=e;r=t.next?.bind(t),i=t.error?.bind(t),a=t.complete?.bind(t)}this.__isAsync&&(i=this.wrapInTimeout(i),r&&=this.wrapInTimeout(r),a&&=this.wrapInTimeout(a));let o=super.subscribe({next:r,error:i,complete:a});return e instanceof hr&&e.add(o),o}wrapInTimeout(e){return t=>{let n=this.pendingTasks?.add();setTimeout(()=>{try{e(t)}finally{n!==void 0&&this.pendingTasks?.remove(n)}})}}};function ks(...e){}function As(e){let t,n;function r(){e=ks;try{n!==void 0&&typeof cancelAnimationFrame==`function`&&cancelAnimationFrame(n),t!==void 0&&clearTimeout(t)}catch{}}return t=setTimeout(()=>{e(),r()}),typeof requestAnimationFrame==`function`&&(n=requestAnimationFrame(()=>{e(),r()})),()=>r()}function js(e){return queueMicrotask(()=>e()),()=>{e=ks}}var Ms=`isAngularZone`,Ns=`isAngularZone_ID`,Ps=0,Fs=class e{hasPendingMacrotasks=!1;hasPendingMicrotasks=!1;isStable=!0;onUnstable=new Os(!1);onMicrotaskEmpty=new Os(!1);onStable=new Os(!1);onError=new Os(!1);constructor(e){let{enableLongStackTrace:t=!1,shouldCoalesceEventChangeDetection:n=!1,shouldCoalesceRunChangeDetection:r=!1,scheduleInRootZone:i=!1}=e;if(typeof Zone>`u`)throw new T(908,!1);Zone.assertZonePatched();let a=this;a._nesting=0,a._outer=a._inner=Zone.current,Zone.TaskTrackingZoneSpec&&(a._inner=a._inner.fork(new Zone.TaskTrackingZoneSpec)),t&&Zone.longStackTraceZoneSpec&&(a._inner=a._inner.fork(Zone.longStackTraceZoneSpec)),a.shouldCoalesceEventChangeDetection=!r&&n,a.shouldCoalesceRunChangeDetection=r,a.callbackScheduled=!1,a.scheduleInRootZone=i,zs(a)}static isInAngularZone(){return typeof Zone<`u`&&Zone.current.get(Ms)===!0}static assertInAngularZone(){if(!e.isInAngularZone())throw new T(909,!1)}static assertNotInAngularZone(){if(e.isInAngularZone())throw new T(909,!1)}run(e,t,n){return this._inner.run(e,t,n)}runTask(e,t,n,r){let i=this._inner,a=i.scheduleEventTask(`NgZoneEvent: `+r,e,Is,ks,ks);try{return i.runTask(a,t,n)}finally{i.cancelTask(a)}}runGuarded(e,t,n){return this._inner.runGuarded(e,t,n)}runOutsideAngular(e){return this._outer.run(e)}},Is={};function Ls(e){if(e._nesting==0&&!e.hasPendingMicrotasks&&!e.isStable)try{e._nesting++,e.onMicrotaskEmpty.emit(null)}finally{if(e._nesting--,!e.hasPendingMicrotasks)try{e.runOutsideAngular(()=>e.onStable.emit(null))}finally{e.isStable=!0}}}function Rs(e){if(e.isCheckStableRunning||e.callbackScheduled)return;e.callbackScheduled=!0;function t(){As(()=>{e.callbackScheduled=!1,Bs(e),e.isCheckStableRunning=!0,Ls(e),e.isCheckStableRunning=!1})}e.scheduleInRootZone?Zone.root.run(()=>{t()}):e._outer.run(()=>{t()}),Bs(e)}function zs(e){let t=()=>{Rs(e)},n=Ps++;e._inner=e._inner.fork({name:`angular`,properties:{[Ms]:!0,[Ns]:n,[Ns+n]:!0},onInvokeTask:(n,r,i,a,o,s)=>{if(Ws(s))return n.invokeTask(i,a,o,s);try{return Vs(e),n.invokeTask(i,a,o,s)}finally{(e.shouldCoalesceEventChangeDetection&&a.type===`eventTask`||e.shouldCoalesceRunChangeDetection)&&t(),Hs(e)}},onInvoke:(n,r,i,a,o,s,c)=>{try{return Vs(e),n.invoke(i,a,o,s,c)}finally{e.shouldCoalesceRunChangeDetection&&!e.callbackScheduled&&!Gs(s)&&t(),Hs(e)}},onHasTask:(t,n,r,i)=>{t.hasTask(r,i),n===r&&(i.change==`microTask`?(e._hasPendingMicrotasks=i.microTask,Bs(e),Ls(e)):i.change==`macroTask`&&(e.hasPendingMacrotasks=i.macroTask))},onHandleError:(t,n,r,i)=>(t.handleError(r,i),e.runOutsideAngular(()=>e.onError.emit(i)),!1)})}function Bs(e){e.hasPendingMicrotasks=!!(e._hasPendingMicrotasks||(e.shouldCoalesceEventChangeDetection||e.shouldCoalesceRunChangeDetection)&&e.callbackScheduled===!0)}function Vs(e){e._nesting++,e.isStable&&(e.isStable=!1,e.onUnstable.emit(null))}function Hs(e){e._nesting--,Ls(e)}var Us=class{hasPendingMicrotasks=!1;hasPendingMacrotasks=!1;isStable=!0;onUnstable=new Os;onMicrotaskEmpty=new Os;onStable=new Os;onError=new Os;run(e,t,n){return e.apply(t,n)}runGuarded(e,t,n){return e.apply(t,n)}runOutsideAngular(e){return e()}runTask(e,t,n,r){return e.apply(t,n)}};function Ws(e){return Ks(e,`__ignore_ng_zone__`)}function Gs(e){return Ks(e,`__scheduler_tick__`)}function Ks(e,t){return!Array.isArray(e)||e.length!==1?!1:e[0]?.data?.[t]===!0}var qs=class{_console=console;handleError(e){this._console.error(`ERROR`,e)}},Js=new vi(``,{factory:()=>{let e=E(Fs),t=E(Aa),n;return r=>{e.runOutsideAngular(()=>{t.destroyed&&!n?setTimeout(()=>{throw r}):(n??=t.get(qs),n.handleError(r))})}}}),Ys={provide:da,useValue:()=>{E(qs,{optional:!0})},multi:!0};function j(e,t){let[n,r,i]=Hn(e,t?.equal),a=n;return a[dn],a.set=r,a.update=i,a.asReadonly=Xs.bind(a),a}function Xs(){let e=this[dn];if(e.readonlyFn===void 0){let t=()=>this();t[dn]=e,e.readonlyFn=t}return e.readonlyFn}var Zs=new vi(``,{factory:()=>Qs}),Qs=`ng`,$s=new vi(``),ec=new vi(``,{providedIn:`platform`,factory:()=>`unknown`}),tc=new vi(``,{factory:()=>E(Ss).body?.querySelector(`[ngCspNonce]`)?.getAttribute(`ngCspNonce`)||null}),nc=(()=>{class e{view;node;constructor(e,t){this.view=e,this.node=t}static __NG_ELEMENT_ID__=rc}return e})();function rc(){return new nc(D(),Po())}var ic=class{},ac=new vi(``,{factory:()=>!0}),oc=new vi(``),sc=(()=>{class e{static ɵprov=di({token:e,providedIn:`root`,factory:()=>new cc})}return e})(),cc=class{dirtyEffectCount=0;queues=new Map;add(e){this.enqueue(e),this.schedule(e)}schedule(e){e.dirty&&this.dirtyEffectCount++}remove(e){let t=e.zone,n=this.queues.get(t);n.has(e)&&(n.delete(e),e.dirty&&this.dirtyEffectCount--)}enqueue(e){let t=e.zone;this.queues.has(t)||this.queues.set(t,new Set);let n=this.queues.get(t);n.has(e)||n.add(e)}flush(){for(;this.dirtyEffectCount>0;){let e=!1;for(let[t,n]of this.queues)e||=t===null?this.flushQueue(n):t.run(()=>this.flushQueue(n));e||(this.dirtyEffectCount=0)}}flushQueue(e){let t=!1;for(let n of e)n.dirty&&(this.dirtyEffectCount--,t=!0,n.run());return t}},lc=class{[dn];constructor(e){this[dn]=e}destroy(){this[dn].destroy()}};function uc(e,t){let n=t?.injector??E(xs),r=t?.manualCleanup===!0?null:n.get(Cs),i,a=n.get(nc,null,{optional:!0}),o=n.get(ic);return a===null?i=hc(e,n.get(sc),o):(i=mc(a.view,o,e),r instanceof ws&&r._lView===a.view&&(r=null)),i.injector=n,r!==null&&(i.onDestroyFns=[r.onDestroy(()=>i.destroy())]),new lc(i)}var dc={...Jn,cleanupFns:void 0,zone:null,onDestroyFns:null,run(){let e=Ho(!1);try{Yn(this)}finally{Ho(e)}},cleanup(){if(!this.cleanupFns?.length)return;let e=w(null);try{for(;this.cleanupFns.length;)this.cleanupFns.pop()()}finally{this.cleanupFns=[],w(e)}}},fc={...dc,consumerMarkedDirty(){this.scheduler.schedule(this),this.notifier.notify(12)},destroy(){if(En(this),this.onDestroyFns!==null)for(let e of this.onDestroyFns)e();this.cleanup(),this.scheduler.remove(this)}},pc={...dc,consumerMarkedDirty(){this.view[2]|=8192,_o(this.view),this.notifier.notify(13)},destroy(){if(En(this),this.onDestroyFns!==null)for(let e of this.onDestroyFns)e();this.cleanup(),this.view[23]?.delete(this)}};function mc(e,t,n){let r=Object.create(pc);return r.view=e,r.zone=typeof Zone<`u`?Zone.current:null,r.notifier=t,r.fn=gc(r,n),e[23]??=new Set,e[23].add(r),r.consumerMarkedDirty(r),r}function hc(e,t,n){let r=Object.create(fc);return r.fn=gc(r,e),r.scheduler=t,r.notifier=n,r.zone=typeof Zone<`u`?Zone.current:null,r.scheduler.add(r),r.notifier.notify(12),r}function gc(e,t){return()=>{t(t=>(e.cleanupFns??=[]).push(t))}}function _c(e){return typeof e==`function`&&e[dn]!==void 0}function vc(e){return _c(e)&&typeof e.set==`function`}var yc=Symbol(`InputSignalNode#UNSET`),bc={...Kn,transformFn:void 0,applyValueToInputSignal(e,t){Wn(e,t)}};function xc(e){return{toString:e}.toString()}var Sc=(function(e){return e[e.TemplateCreateStart=0]=`TemplateCreateStart`,e[e.TemplateCreateEnd=1]=`TemplateCreateEnd`,e[e.TemplateUpdateStart=2]=`TemplateUpdateStart`,e[e.TemplateUpdateEnd=3]=`TemplateUpdateEnd`,e[e.LifecycleHookStart=4]=`LifecycleHookStart`,e[e.LifecycleHookEnd=5]=`LifecycleHookEnd`,e[e.OutputStart=6]=`OutputStart`,e[e.OutputEnd=7]=`OutputEnd`,e[e.BootstrapApplicationStart=8]=`BootstrapApplicationStart`,e[e.BootstrapApplicationEnd=9]=`BootstrapApplicationEnd`,e[e.BootstrapComponentStart=10]=`BootstrapComponentStart`,e[e.BootstrapComponentEnd=11]=`BootstrapComponentEnd`,e[e.ChangeDetectionStart=12]=`ChangeDetectionStart`,e[e.ChangeDetectionEnd=13]=`ChangeDetectionEnd`,e[e.ChangeDetectionSyncStart=14]=`ChangeDetectionSyncStart`,e[e.ChangeDetectionSyncEnd=15]=`ChangeDetectionSyncEnd`,e[e.AfterRenderHooksStart=16]=`AfterRenderHooksStart`,e[e.AfterRenderHooksEnd=17]=`AfterRenderHooksEnd`,e[e.ComponentStart=18]=`ComponentStart`,e[e.ComponentEnd=19]=`ComponentEnd`,e[e.DeferBlockStateStart=20]=`DeferBlockStateStart`,e[e.DeferBlockStateEnd=21]=`DeferBlockStateEnd`,e[e.DynamicComponentStart=22]=`DynamicComponentStart`,e[e.DynamicComponentEnd=23]=`DynamicComponentEnd`,e[e.HostBindingsUpdateStart=24]=`HostBindingsUpdateStart`,e[e.HostBindingsUpdateEnd=25]=`HostBindingsUpdateEnd`,e})(Sc||{}),Cc=class{previousValue;currentValue;firstChange;constructor(e,t,n){this.previousValue=e,this.currentValue=t,this.firstChange=n}isFirstChange(){return this.firstChange}};function wc(e,t,n,r){t===null?e[n]=r:t.applyValueToInputSignal(t,r)}var Tc=null,Ec=(()=>{Tc=Oc;let e=()=>Oc;return e.ngInherit=!0,e})();function Dc(){return Tc}function Oc(e){return e.type.prototype.ngOnChanges&&(e.setInput=Ac),kc}function kc(){let e=Mc(this),t=e?.current;if(t){let n=e.previous;if(n===la)e.previous=t;else for(let e in t)n[e]=t[e];e.current=null,this.ngOnChanges(t)}}function Ac(e,t,n,r,i){let a=this.declaredInputs[r],o=Mc(e)||Nc(e,{previous:la,current:null}),s=o.current||={},c=o.previous,l=c[a];s[a]=new Cc(l&&l.currentValue,n,c===la),wc(e,t,i,n)}var jc=`__ngSimpleChanges__`;function Mc(e){return Object.hasOwn(e,jc)&&e[jc]||null}function Nc(e,t){return e[jc]=t}var Pc=[],Fc=function(e,t=null,n){for(let r=0;r<Pc.length;r++){let i=Pc[r];i(e,t,n)}};function Ic(e,t,n){let{ngOnChanges:r,ngOnInit:i,ngDoCheck:a}=t.type.prototype;if(r){let r=Dc()(t);(n.preOrderHooks??=[]).push(e,r),(n.preOrderCheckHooks??=[]).push(e,r)}i&&(n.preOrderHooks??=[]).push(0-e,i),a&&((n.preOrderHooks??=[]).push(e,a),(n.preOrderCheckHooks??=[]).push(e,a))}function Lc(e,t){for(let n=t.directiveStart,r=t.directiveEnd;n<r;n++){let{ngAfterContentInit:t,ngAfterContentChecked:r,ngAfterViewInit:i,ngAfterViewChecked:a,ngOnDestroy:o}=e.data[n].type.prototype;t&&(e.contentHooks??=[]).push(-n,t),r&&((e.contentHooks??=[]).push(n,r),(e.contentCheckHooks??=[]).push(n,r)),i&&(e.viewHooks??=[]).push(-n,i),a&&((e.viewHooks??=[]).push(n,a),(e.viewCheckHooks??=[]).push(n,a)),o!=null&&(e.destroyHooks??=[]).push(n,o)}}function Rc(e,t,n){Vc(e,t,3,n)}function zc(e,t,n,r){(e[2]&3)===n&&Vc(e,t,n,r)}function Bc(e,t){let n=e[2];(n&3)===t&&(n&=16383,n+=1,e[2]=n)}function Vc(e,t,n,r){let i=r===void 0?0:e[17]&65535,a=r??-1,o=t.length-1,s=0;for(let c=i;c<o;c++)if(typeof t[c+1]==`number`){if(s=t[c],r!=null&&s>=r)break}else t[c]<0&&(e[17]+=65536),(s<a||a==-1)&&(Uc(e,n,t,c),e[17]=(e[17]&4294901760)+c+2),c++}function Hc(e,t){Fc(Sc.LifecycleHookStart,e,t);let n=w(null);try{t.call(e)}finally{w(n),Fc(Sc.LifecycleHookEnd,e,t)}}function Uc(e,t,n,r){let i=n[r]<0,a=n[r+1],o=e[i?-n[r]:n[r]];i?e[2]>>14<e[17]>>16&&(e[2]&3)===t&&(e[2]+=16384,Hc(o,a)):Hc(o,a)}var Wc=-1,Gc=class{factory;name;injectImpl;resolving=!1;canSeeViewProviders;multi;componentProviders;index;providerFactory;constructor(e,t,n,r){this.factory=e,this.name=r,this.canSeeViewProviders=t,this.injectImpl=n}};function Kc(e){return!!(e.flags&8)}function qc(e){return!!(e.flags&16)}function Jc(e,t,n){let r=0;for(;r<n.length;){let i=n[r];if(typeof i==`number`){if(i!==0)break;r++;let a=n[r++],o=n[r++],s=n[r++];e.setAttribute(t,o,s,a)}else{let a=i,o=n[++r];Xc(a)?e.setProperty(t,a,o):e.setAttribute(t,a,o),r++}}return r}function Yc(e){return e===3||e===4||e===6}function Xc(e){return e.charCodeAt(0)===64}function Zc(e,t){if(t!==null&&t.length!==0){if(e===null||e.length===0)e=t.slice();else{let n=-1;for(let r=0;r<t.length;r++){let i=t[r];typeof i==`number`?n=i:n===0||(n===-1||n===2?Qc(e,n,i,null,t[++r]):Qc(e,n,i,null,null))}}}return e}function Qc(e,t,n,r,i){let a=0,o=e.length;if(t===-1)o=-1;else for(;a<e.length;){let n=e[a++];if(typeof n==`number`){if(n===t){o=-1;break}if(n>t){o=a-1;break}}}for(;a<e.length;){let t=e[a];if(typeof t==`number`)break;if(t===n){i!==null&&(e[a+1]=i);return}a++,i!==null&&a++}o!==-1&&(e.splice(o,0,t),a=o+1),e.splice(a++,0,n),i!==null&&e.splice(a++,0,i)}function $c(e){return e!==Wc}function el(e){return e&32767}function tl(e){return e>>16}function nl(e,t){let n=tl(e),r=t;for(;n>0;)r=r[14],n--;return r}var rl=!0;function il(e){let t=rl;return rl=e,t}var al=255,ol=5,sl=0,cl={};function ll(e,t,n){let r;typeof n==`string`?r=n.charCodeAt(0)||0:Object.hasOwn(n,wi)&&(r=n[wi]),r??=n[wi]=sl++;let i=r&al,a=1<<i;t.data[e+(i>>ol)]|=a}function ul(e,t){let n=fl(e,t);if(n!==-1)return n;let r=t[1];r.firstCreatePass&&(e.injectorIndex=t.length,dl(r.data,e),dl(t,null),dl(r.blueprint,null));let i=pl(e,t),a=e.injectorIndex;if($c(i)){let e=el(i),n=nl(i,t),r=n[1].data;for(let i=0;i<8;i++)t[a+i]=n[e+i]|r[e+i]}return t[a+8]=i,a}function dl(e,t){e.push(0,0,0,0,0,0,0,0,t)}function fl(e,t){return e.injectorIndex===-1||e.parent&&e.parent.injectorIndex===e.injectorIndex||t[e.injectorIndex+8]===null?-1:e.injectorIndex}function pl(e,t){if(e.parent&&e.parent.injectorIndex!==-1)return e.parent.injectorIndex;let n=0,r=null,i=t;for(;i!==null;){if(r=Ol(i),r===null)return Wc;if(n++,i=i[14],r.injectorIndex!==-1)return r.injectorIndex|n<<16}return Wc}function ml(e,t,n){ll(e,t,n)}function hl(e,t,n){if(n&8||e!==void 0)return e;Fi(t,`NodeInjector`)}function gl(e,t,n,r){if(n&8&&r===void 0&&(r=null),!(n&3)){let i=e[9],a=Bi(void 0);try{return i?i.get(t,r,n&8):Vi(t,r,n&8)}finally{Bi(a)}}return hl(r,t,n)}function _l(e,t,n,r=0,i){if(e!==null){if(t[2]&2048&&!(r&2)){let i=Dl(e,t,n,r,cl);if(i!==cl)return i}let i=vl(e,t,n,r,cl);if(i!==cl)return i}return gl(t,n,r,i)}function vl(e,t,n,r,i){let a=Sl(n);if(typeof a==`function`){if(!ns(t,e,r))return r&1?hl(i,n,r):gl(t,n,r,i);try{let e;if(e=a(r),e==null&&!(r&8))Fi(n);else return e}finally{ss()}}else if(typeof a==`number`){let i=null,o=fl(e,t),s=Wc,c=r&1?t[15][5]:null;for((o===-1||r&4)&&(s=o===-1?pl(e,t):t[o+8],s===Wc||!wl(r,!1)?o=-1:(i=t[1],o=el(s),t=nl(s,t)));o!==-1;){let e=t[1];if(Cl(a,o,e.data)){let e=yl(o,t,n,i,r,c);if(e!==cl)return e}s=t[o+8],s!==Wc&&wl(r,t[1].data[o+8]===c)&&Cl(a,o,t)?(i=e,o=el(s),t=nl(s,t)):o=-1}}return i}function yl(e,t,n,r,i,a){let o=t[1],s=o.data[e+8],c=bl(s,o,n,r==null?Ja(s)&&rl:r!=o&&!!(s.type&3),i&1&&a===s);return c===null?cl:xl(t,o,c,s,i)}function bl(e,t,n,r,i){let a=e.providerIndexes,o=t.data,s=a&1048575,c=e.directiveStart,l=e.directiveEnd,u=a>>20,d=r?s:s+u,f=i?s+u:l;for(let e=d;e<f;e++){let t=o[e];if(e<c&&n===t||e>=c&&t.type===n)return e}if(i){let e=o[c];if(e&&Xa(e)&&e.type===n)return c}return null}function xl(e,t,n,r,i){let a=e[n],o=t.data;if(a instanceof Gc){let s=a;if(s.resolving)throw Pi(``);let c=il(s.canSeeViewProviders);s.resolving=!0,o[n].type||o[n];let l=s.injectImpl?Bi(s.injectImpl):null;ns(e,r,0);try{a=e[n]=s.factory(void 0,i,o,e,r),t.firstCreatePass&&n>=r.directiveStart&&Ic(n,o[n],t)}finally{l!==null&&Bi(l),il(c),s.resolving=!1,ss()}}return a}function Sl(e){if(typeof e==`string`)return e.charCodeAt(0)||0;let t=Object.hasOwn(e,wi)?e[wi]:void 0;return typeof t==`number`?t>=0?t&al:El:t}function Cl(e,t,n){let r=1<<e;return!!(n[t+(e>>ol)]&r)}function wl(e,t){return!(e&2)&&!(e&1&&t)}var Tl=class{_tNode;_lView;constructor(e,t){this._tNode=e,this._lView=t}get(e,t,n){return _l(this._tNode,this._lView,e,Ji(n),t)}};function El(){return new Tl(Po(),D())}function Dl(e,t,n,r,i){let a=e,o=t;for(;a!==null&&o!==null&&o[2]&2048&&!Za(o);){let e=vl(a,o,n,r|2,cl);if(e!==cl)return e;r&=-5;let t=a.parent;if(!t){let e=o[20];if(e){let t=e.get(n,cl,r);if(t!==cl)return t}t=Ol(o),o=o[14]}a=t}return i}function Ol(e){let t=e[1],n=t.type;return n===2?t.declTNode:n===1?e[5]:null}function kl(e){return{token:e.token,providedIn:e.autoProvided===!1?null:`root`,factory:e.factory,value:void 0}}function Al(){return jl(Po(),D())}function jl(e,t){return new Ml(ro(e,t))}var Ml=(()=>{class e{nativeElement;constructor(e){this.nativeElement=e}static __NG_ELEMENT_ID__=Al}return e})();function Nl(e){return e instanceof Ml?e.nativeElement:e}function Pl(){return this._results[Symbol.iterator]()}var Fl=class{_emitDistinctChangesOnly;dirty=!0;_onDirty=void 0;_results=[];_changesDetected=!1;_changes=void 0;length=0;first=void 0;last=void 0;get changes(){return this._changes??=new Zr}constructor(e=!1){this._emitDistinctChangesOnly=e}get(e){return this._results[e]}map(e){return this._results.map(e)}filter(e){return this._results.filter(e)}find(e){return this._results.find(e)}reduce(e,t){return this._results.reduce(e,t)}forEach(e){this._results.forEach(e)}some(e){return this._results.some(e)}toArray(){return this._results.slice()}toString(){return this._results.toString()}reset(e,t){this.dirty=!1;let n=ea(e);(this._changesDetected=!$i(this._results,n,t))&&(this._results=n,this.length=n.length,this.last=n[this.length-1],this.first=n[0])}notifyOnChanges(){this._changes!==void 0&&(this._changesDetected||!this._emitDistinctChangesOnly)&&this._changes.next(this)}onDirty(e){this._onDirty=e}setDirty(){this.dirty=!0,this._onDirty?.()}destroy(){this._changes!==void 0&&(this._changes.complete(),this._changes.unsubscribe())}[Symbol.iterator]=Pl};function Il(e){return(e.flags&128)==128}var Ll=(function(e){return e[e.OnPush=0]=`OnPush`,e[e.Eager=1]=`Eager`,e[e.Default=1]=`Default`,e})(Ll||{}),Rl=new Map,zl=0;function Bl(){return zl++}function Vl(e){Rl.set(e[19],e)}function Hl(e){Rl.delete(e[19])}var Ul=`__ngContext__`;function Wl(e,t){Ga(t)?(e[Ul]=t[19],Vl(t)):e[Ul]=t}function Gl(e){return ql(e[12])}function Kl(e){return ql(e[4])}function ql(e){for(;e!==null&&!Ka(e);)e=e[4];return e}var Jl=void 0;function Yl(e){Jl=e}function Xl(){if(Jl!==void 0)return Jl;if(typeof document<`u`)return document;throw new T(210,!1)}var Zl=!1,Ql=new vi(``,{factory:()=>Zl}),$l=new WeakMap;function eu(e,t){if(typeof e!=`object`||!e)return;let n=$l.get(e);n||(n=new WeakSet,$l.set(e,n)),n.add(t)}function tu(e){return(e.flags&32)==32}var nu=()=>null;function ru(e,t,n=!1){return nu(e,t,n)}function iu(e,t){let n=e.contentQueries;if(n!==null){let r=w(null);try{for(let r=0;r<n.length;r+=2){let i=n[r],a=n[r+1];if(a!==-1){let n=e.data[a];es(i),n.contentQueries(2,t[a],a)}}}finally{w(r)}}}function au(e,t,n){es(0);let r=w(null);try{t(e,n)}finally{w(r)}}function ou(e,t,n){if(qa(t)){let r=w(null);try{let r=t.directiveStart,i=t.directiveEnd;for(let t=r;t<i;t++){let r=e.data[t];if(r.contentQueries){let e=n[t];r.contentQueries(1,e,t)}}}finally{w(r)}}}var su=(function(e){return e[e.Emulated=0]=`Emulated`,e[e.None=2]=`None`,e[e.ShadowDom=3]=`ShadowDom`,e[e.ExperimentalIsolatedShadowDom=4]=`ExperimentalIsolatedShadowDom`,e})(su||{}),cu=class{changingThisBreaksApplicationSecurity;constructor(e){this.changingThisBreaksApplicationSecurity=e}toString(){return`SafeValue must use [property]=binding: ${this.changingThisBreaksApplicationSecurity} (see ${ti})`}};function lu(e){return e instanceof cu?e.changingThisBreaksApplicationSecurity:e}function uu(e,t){let n=du(e);if(n!=null&&n!==t){if(n===`ResourceURL`&&t===`URL`)return!0;throw Error(`Required a safe ${t}, got a ${n} (see ${ti})`)}return n===t}function du(e){return e instanceof cu&&e.getTypeName()||null}var fu=/^(?!javascript:)(?:[a-z0-9+.-]+:|[^&:\/?#]*(?:[\/?#]|$))/i;function pu(e){return e=String(e),e.match(fu)?e:`unsafe:`+e}var mu=/^>|^->|<!--|-->|--!>|<!-$/g,hu=/(<|>)/g,gu=`​$1​`;function _u(e){return e.replace(mu,e=>e.replace(hu,gu))}function vu(e,t){return e.createText(t)}function yu(e,t,n){e.setValue(t,n)}function bu(e,t){return e.createComment(_u(t))}function xu(e,t,n){return e.createElement(t,n)}function Su(e,t,n,r,i){e.insertBefore(t,n,r,i)}function Cu(e,t,n){e.appendChild(t,n)}function wu(e,t,n,r,i){r===null?Cu(e,t,n):Su(e,t,n,r,i)}function Tu(e,t,n,r){e.removeChild(null,t,n,r)}function Eu(e,t,n){e.setAttribute(t,`style`,n)}function Du(e,t,n){n===``?e.removeAttribute(t,`class`):e.setAttribute(t,`class`,n)}function Ou(e,t,n){let{mergedAttrs:r,classes:i,styles:a}=n;r!==null&&Jc(e,t,r),i!==null&&Du(e,t,i),a!==null&&Eu(e,t,a)}function ku(e){let t=Au();return t?t.sanitize($a.URL,e)||``:uu(e,`URL`)?lu(e):pu(Ai(e))}function Au(){let e=D();return e&&e[10].sanitizer}function ju(e){return e.ownerDocument.defaultView}function Mu(e){return e.ownerDocument}function Nu(e,t,n){let r=e.length;for(;;){let i=e.indexOf(t,n);if(i===-1)return i;if(i===0||e.charCodeAt(i-1)<=32){let n=t.length;if(i+n===r||e.charCodeAt(i+n)<=32)return i}n=i+1}}var Pu=`ng-template`;function Fu(e,t,n,r){let i=0;if(r){for(;i<t.length&&typeof t[i]==`string`;i+=2)if(t[i]===`class`&&Nu(t[i+1].toLowerCase(),n,0)!==-1)return!0}else if(Iu(e))return!1;if(i=t.indexOf(1,i),i>-1){let e;for(;++i<t.length&&typeof(e=t[i])==`string`;)if(e.toLowerCase()===n)return!0}return!1}function Iu(e){return e.type===4&&e.value!==Pu}function Lu(e,t,n){return t===(e.type===4&&!n?Pu:e.value)}function Ru(e,t,n){let r=4,i=e.attrs,a=i===null?0:Hu(i),o=!1;for(let s=0;s<t.length;s++){let c=t[s];if(typeof c==`number`){if(!o&&!zu(r)&&!zu(c))return!1;if(o&&zu(c))continue;o=!1,r=c|r&1;continue}if(!o){if(r&4){if(r=2|r&1,c!==``&&!Lu(e,c,n)||c===``&&t.length===1){if(zu(r))return!1;o=!0}}else if(r&8){if(i===null||!Fu(e,i,c,n)){if(zu(r))return!1;o=!0}}else{let l=t[++s],u=Bu(c,i,Iu(e),n);if(u===-1){if(zu(r))return!1;o=!0;continue}if(l!==``){let e;if(e=u>a?``:i[u+1].toLowerCase(),r&2&&l!==e){if(zu(r))return!1;o=!0}}}}}return zu(r)||o}function zu(e){return!(e&1)}function Bu(e,t,n,r){if(t===null)return-1;let i=0;if(r||!n){let n=!1;for(;i<t.length;){let r=t[i];if(r===e)return i;if(r===3||r===6)n=!0;else if(r===1||r===2){let e=t[++i];for(;typeof e==`string`;)e=t[++i];continue}else if(r===4)break;else if(r===0){i+=4;continue}i+=n?1:2}return-1}return Uu(t,e)}function Vu(e,t,n=!1){for(let r=0;r<t.length;r++)if(Ru(e,t[r],n))return!0;return!1}function Hu(e){for(let t=0;t<e.length;t++){let n=e[t];if(Yc(n))return t}return e.length}function Uu(e,t){let n=e.indexOf(4);if(n>-1)for(n++;n<e.length;){let r=e[n];if(typeof r==`number`)return-1;if(r===t)return n;n++}return-1}function Wu(e,t){return e?`:not(`+t.trim()+`)`:t}function Gu(e){let t=e[0],n=1,r=2,i=``,a=!1;for(;n<e.length;){let o=e[n];if(typeof o==`string`){if(r&2){let t=e[++n];i+=`[`+o+(t.length>0?`="`+t+`"`:``)+`]`}else r&8?i+=`.`+o:r&4&&(i+=` `+o)}else i!==``&&!zu(o)&&(t+=Wu(a,i),i=``),r=o,a||=!zu(r);n++}return i!==``&&(t+=Wu(a,i)),t}function Ku(e){return e.map(Gu).join(`,`)}function qu(e){let t=[],n=[],r=1,i=2;for(;r<e.length;){let a=e[r];if(typeof a==`string`)i===2?a!==``&&t.push(a,e[++r]):i===8&&n.push(a);else{if(!zu(i))break;i=a}r++}return n.length&&t.push(1,...n),t}var Ju={},Yu=(function(e){return e[e.Important=1]=`Important`,e[e.DashCase=2]=`DashCase`,e})(Yu||{}),Xu;function Zu(e,t){return Xu(e,t)}var Qu=new vi(``,{factory:()=>!1});function $u(e){if(!e)return 0;let t=e.toLowerCase().indexOf(`ms`)>-1?1:1e3;return parseFloat(e)*t}function ed(e,t){return e.getPropertyValue(t).split(`,`).map(e=>e.trim())}function td(e){let t=ed(e,`transition-property`),n=ed(e,`transition-duration`),r=ed(e,`transition-delay`),i={propertyName:``,duration:0,animationName:void 0};for(let e=0;e<t.length;e++){let a=$u(r[e])+$u(n[e]);a>i.duration&&(i.propertyName=t[e],i.duration=a)}return i}function nd(e){let t=ed(e,`animation-name`),n=ed(e,`animation-delay`),r=ed(e,`animation-duration`),i=ed(e,`animation-iteration-count`),a={animationName:``,propertyName:void 0,duration:0};for(let e=0;e<t.length;e++){let o=$u(n[e])+$u(r[e]),s=i[e];o>a.duration&&s!==`infinite`&&(a.animationName=t[e],a.duration=o)}return a}function rd(e,t){return e!==void 0&&e.duration>t.duration}function id(e){return(e.animationName!=null||e.propertyName!=null)&&e.duration>0}function ad(e){let t=e.effect?.getTiming();if(t===void 0)return;let n=typeof t.duration==`number`?t.duration:0,r=(t.delay??0)+n,i=e.playbackRate;return i!==void 0&&i!==0&&i!==1&&(r/=Math.abs(i)),r}function od(e,t){let n=getComputedStyle(e),r=nd(n),i=td(n),a=r.duration>i.duration?r:i;rd(t.get(e),a)||id(a)&&t.set(e,a)}function sd(e,t,n){if(!n)return;let r=e.getAnimations();return r.length===0?od(e,t):cd(e,t,r)}function cd(e,t,n){let r={animationName:void 0,propertyName:void 0,duration:0};for(let e of n){if(e.effect?.getTiming()?.iterations===1/0)continue;let t=ad(e)??0,n,i;e.animationName?i=e.animationName:n=e.transitionProperty,t>=r.duration&&(r={animationName:i,propertyName:n,duration:t})}rd(t.get(e),r)||id(r)&&t.set(e,r)}var ld=new Set,ud=!1,dd=1,fd=typeof document<`u`&&typeof document?.documentElement?.getAnimations==`function`;function pd(e){return e[9].get(Qu,ud)}function md(e,t,n){let r=gd.get(e);if(r){for(let e of t)r.classList.push(e);for(let e of n)r.cleanupFns.push(e)}else gd.set(e,{classList:t,cleanupFns:n})}function hd(e){let t=gd.get(e);if(t){for(let e of t.cleanupFns)e();gd.delete(e)}_d.delete(e)}var gd=new WeakMap,_d=new WeakMap,vd=new WeakMap;function yd(e){return e?e[14]??e:null}var bd=new WeakSet;function xd(e,t,n){let r=vd.get(e);if(!r||r.length===0)return;let i=t.parentNode,a=t.previousSibling,o=yd(n);for(let e=r.length-1;e>=0;e--){let{el:n,declarationView:s}=r[e],c=n.parentNode;n===t?(r.splice(e,1),bd.add(n),n.dispatchEvent(new CustomEvent(`animationend`,{detail:{cancel:!0}}))):(a&&n===a||c&&i&&c!==i&&(o===null||s===null||o===s))&&(r.splice(e,1),n.dispatchEvent(new CustomEvent(`animationend`,{detail:{cancel:!0}})),n.parentNode?.removeChild(n))}}function Sd(e,t,n){let r=yd(n),i=vd.get(e);i?i.some(e=>e.el===t)||i.push({el:t,declarationView:r}):vd.set(e,[{el:t,declarationView:r}])}function Cd(e){let t=e[26]??={};return t.enter??=new Map}function wd(e){let t=typeof e==`function`?e():e,n=Array.isArray(t)?t:null;return typeof t==`string`&&(n=t.trim().split(/\s+/).filter(e=>e)),n}function Td(e){return e.composedPath?e.composedPath()[0]:e.target}function Ed(e,t){let n=_d.get(t);if(n===void 0)return!0;if(t!==Td(e))return!1;let r=e.animation;if(r){let e=ad(r);if(e!==void 0&&e+dd<n.duration)return!1}return n.animationName===void 0?n.propertyName===void 0?!1:n.propertyName===`all`||e.propertyName===n.propertyName:e.animationName===n.animationName}function Dd(e,t,n){let r=e.get(t.index)??{animateFns:[]};r.animateFns.push(n),e.set(t.index,r)}var Od=(function(e){return e[e.CHANGE_DETECTION=0]=`CHANGE_DETECTION`,e[e.AFTER_NEXT_RENDER=1]=`AFTER_NEXT_RENDER`,e})(Od||{}),kd=new vi(``),Ad=new Set;function jd(e){Ad.has(e)||(Ad.add(e),performance?.mark?.(`mark_feature_usage`,{detail:{feature:e}}))}var Md=(()=>{class e{impl=null;execute(){this.impl?.execute()}static ɵprov=di({token:e,providedIn:`root`,factory:()=>new e})}return e})(),Nd=[0,1,2,3],Pd=(()=>{class e{ngZone=E(Fs);scheduler=E(ic);errorHandler=E(qs,{optional:!0});sequences=new Set;deferredRegistrations=new Set;executing=!1;constructor(){E(kd,{optional:!0})}execute(){let e=this.sequences.size>0;e&&Fc(Sc.AfterRenderHooksStart),this.executing=!0;for(let e of Nd)for(let t of this.sequences)if(!t.erroredOrDestroyed&&t.hooks[e])try{t.pipelinedValue=this.ngZone.runOutsideAngular(()=>this.maybeTrace(()=>{let n=t.hooks[e];return n(t.pipelinedValue)},t.snapshot))}catch(e){t.erroredOrDestroyed=!0,this.errorHandler?.handleError(e)}this.executing=!1;for(let e of this.sequences)e.afterRun(),e.once&&(this.sequences.delete(e),e.destroy());for(let e of this.deferredRegistrations)this.sequences.add(e);this.deferredRegistrations.size>0&&this.scheduler.notify(7),this.deferredRegistrations.clear(),e&&Fc(Sc.AfterRenderHooksEnd)}register(e){let{view:t}=e;t===void 0?this.executing?this.deferredRegistrations.add(e):this.addSequence(e):((t[25]??=[]).push(e),_o(t),t[2]|=8192)}addSequence(e){this.sequences.add(e),this.scheduler.notify(7)}unregister(e){this.executing&&this.sequences.has(e)?(e.erroredOrDestroyed=!0,e.pipelinedValue=void 0,e.once=!0):(this.sequences.delete(e),this.deferredRegistrations.delete(e))}maybeTrace(e,t){return t?t.run(Od.AFTER_NEXT_RENDER,e):e()}static ɵprov=di({token:e,providedIn:`root`,factory:()=>new e})}return e})(),Fd=class{impl;hooks;view;once;snapshot;erroredOrDestroyed=!1;pipelinedValue=void 0;unregisterOnDestroy;constructor(e,t,n,r,i,a=null){this.impl=e,this.hooks=t,this.view=n,this.once=r,this.snapshot=a,this.unregisterOnDestroy=i?.onDestroy(()=>this.destroy())}afterRun(){this.erroredOrDestroyed=!1,this.pipelinedValue=void 0,this.snapshot?.dispose(),this.snapshot=null}destroy(){this.impl.unregister(this),this.unregisterOnDestroy?.();let e=this.view?.[25];e&&(this.view[25]=e.filter(e=>e!==this))}};function Id(e,t){let n=t?.injector??E(xs);return jd(`NgAfterNextRender`),Rd(e,n,t,!0)}function Ld(e){return e instanceof Function?[void 0,void 0,e,void 0]:[e.earlyRead,e.write,e.mixedReadWrite,e.read]}function Rd(e,t,n,r){let i=t.get(Md);i.impl??=t.get(Pd);let a=t.get(kd,null,{optional:!0}),o=n?.manualCleanup===!0?null:t.get(Cs),s=t.get(nc,null,{optional:!0}),c=new Fd(i.impl,Ld(e),s?.view,r,o,a?.snapshot(null));return i.impl.register(c),c}var zd=new vi(``,{factory:()=>{let e=E(Aa),t=new Set;return e.onDestroy(()=>t.clear()),{queue:t,isScheduled:!1,scheduler:null,injector:e}}});function Bd(e,t,n){let r=e.get(zd);if(Array.isArray(t))for(let e of t)r.queue.add(e),n?.detachedLeaveAnimationFns?.push(e);else r.queue.add(t),n?.detachedLeaveAnimationFns?.push(t);r.scheduler&&r.scheduler(e)}function Vd(e,t){let n=e.get(zd);if(Array.isArray(t))for(let e of t)n.queue.delete(e);else n.queue.delete(t)}function Hd(e,t){let n=e.get(zd);if(t.detachedLeaveAnimationFns){for(let e of t.detachedLeaveAnimationFns)n.queue.delete(e);t.detachedLeaveAnimationFns=void 0}}function Ud(e){let t=e.get(zd);t.isScheduled||=(Id(()=>{t.isScheduled=!1;for(let e of t.queue)e();t.queue.clear()},{injector:t.injector}),!0)}function Wd(e){let t=e.get(zd);t.scheduler=Ud,t.scheduler(e)}function Gd(e,t){for(let[n,r]of t)Bd(e,r.animateFns)}function Kd(e,t,n,r){let i=e?.[26]?.enter;t!==null&&i&&i.has(n.index)&&Gd(r,i)}function qd(e,t,n,r){try{n.get(fa)}catch{return r(!1)}let i=e?.[26];i?.enter?.has(t.index)&&Vd(n,i.enter.get(t.index).animateFns);let a=Jd(e,t,i);if(a.size===0){let n=!1;if(e){let r=[];Xd(e,t,r),n=r.length>0}if(!n)return r(!1)}e&&ld.add(e[19]),Bd(n,()=>Yd(e,t,i||void 0,a,r),i||void 0)}function Jd(e,t,n){let r=new Map,i=n?.leave;if(i&&i.has(t.index)&&r.set(t.index,i.get(t.index)),e&&i)for(let[n,a]of i){if(r.has(n))continue;let i=e[1].data[n].parent;for(;i;){if(i===t){r.set(n,a);break}i=i.parent}}return r}function Yd(e,t,n,r,i){let a=[];if(n&&n.leave)for(let[e]of r){if(!n.leave.has(e))continue;let t=n.leave.get(e);for(let e of t.animateFns){let{promise:t}=e();a.push(t)}n.detachedLeaveAnimationFns=void 0}if(e&&Xd(e,t,a),a.length>0){let t=n||e?.[26];if(t){let n=t.running;n&&a.push(n),t.running=Promise.allSettled(a),Qd(e,t.running,i)}else Promise.allSettled(a).then(()=>{e&&ld.delete(e[19]),i(!0)})}else e&&ld.delete(e[19]),i(!1)}function Xd(e,t,n){if(t.type&12){let r=e[t.index];if(Ka(r))for(let e=10;e<r.length;e++){let t=r[e];t[1].type===2&&Zd(t,n)}}let r=t.child;for(;r;)Xd(e,r,n),r=r.next}function Zd(e,t){let n=e[26];if(n&&n.leave)for(let e of n.leave.values())for(let n of e.animateFns){let{promise:e}=n();t.push(e)}let r=e[1].firstChild;for(;r;)Xd(e,r,t),r=r.next}function Qd(e,t,n){t.then(()=>{e[26]?.running===t&&(e[26].running=void 0,ld.delete(e[19])),n(!0)})}function $d(e,t,n,r,i,a,o,s){if(i!=null){let c,l=!1;Ka(i)?c=i:Ga(i)&&(l=!0,i=i[0]);let u=to(i);e===0&&r!==null?(Kd(s,r,a,n),o==null?Cu(t,r,u):Su(t,r,u,o||null,!0)):e===1&&r!==null?(Kd(s,r,a,n),Su(t,r,u,o||null,!0),xd(a,u,s)):e===2?(s?.[26]?.leave?.has(a.index)&&Sd(a,u,s),bd.delete(u),qd(s,a,n,e=>{if(bd.has(u)){bd.delete(u);return}Tu(t,u,l,e)})):e===3&&(bd.delete(u),qd(s,a,n,()=>{t.destroyNode(u)})),c!=null&&Cf(t,e,n,c,a,r,o)}}function ef(e,t){nf(e,t),t[0]=null,t[5]=null}function tf(e,t,n,r,i,a){r[0]=i,r[5]=t,bf(e,r,n,1,i,a)}function nf(e,t){t[10].changeDetectionScheduler?.notify(9),bf(e,t,t[11],2,null,null)}function rf(e){let t=e[12];if(!t)return sf(e[1],e);for(;t;){let n=null;if(Ga(t))n=t[12];else{let e=t[10];e&&(n=e)}if(!n){for(;t&&!t[4]&&t!==e;)Ga(t)&&sf(t[1],t),t=t[3];t===null&&(t=e),Ga(t)&&sf(t[1],t),n=t&&t[4]}t=n}}function af(e,t){let n=e[9],r=n.indexOf(t);n.splice(r,1)}function of(e,t){if(Qa(t))return;let n=t[11];n.destroyNode&&bf(e,t,n,3,null,null),rf(t)}function sf(e,t){if(Qa(t))return;let n=w(null);try{t[2]&=-129,t[2]|=256,t[24]&&En(t[24]),lf(e,t),cf(e,t),t[1].type===1&&t[11].destroy();let n=t[16];if(n!==null&&Ka(t[3])){n!==t[3]&&af(n,t);let r=t[18];r!==null&&r.detachView(e)}Hl(t)}finally{w(n)}}function cf(e,t){let n=e.cleanup,r=t[7];if(n!==null)for(let e=0;e<n.length-1;e+=2)if(typeof n[e]==`string`){let t=n[e+3];t>=0?r[t]():r[-t].unsubscribe(),e+=2}else{let t=r[n[e+1]];n[e].call(t)}r!==null&&(t[7]=null);let i=t[21];if(i!==null){t[21]=null;for(let e=0;e<i.length;e++){let t=i[e];t()}}let a=t[23];if(a!==null){t[23]=null;for(let e of a)e.destroy()}}function lf(e,t){let n;if(e!=null&&(n=e.destroyHooks)!=null)for(let e=0;e<n.length;e+=2){let r=t[n[e]];if(!(r instanceof Gc)){let t=n[e+1];if(Array.isArray(t))for(let e=0;e<t.length;e+=2){let n=r[t[e]],i=t[e+1];Fc(Sc.LifecycleHookStart,n,i);try{i.call(n)}finally{Fc(Sc.LifecycleHookEnd,n,i)}}else{Fc(Sc.LifecycleHookStart,r,t);try{t.call(r)}finally{Fc(Sc.LifecycleHookEnd,r,t)}}}}}function uf(e,t,n){if(t===null)throw new T(510,!1);return df(e,t.parent,n)}function df(e,t,n){let r=t;for(;r!==null&&r.type&168;)t=r,r=t.parent;if(r===null)return n[0];if(Ja(r)){let{encapsulation:t}=e.data[r.directiveStart+r.componentOffset];if(t===su.None||t===su.Emulated)return null}return ro(r,n)}function ff(e,t,n){return mf(e,t,n)}function pf(e,t,n){return e.type&40?ro(e,n):null}var mf=pf;function hf(e,t,n,r){let i=uf(e,r,t),a=t[11],o=ff(r.parent||t[5],r,t);if(i!=null){if(Array.isArray(n))for(let e=0;e<n.length;e++)wu(a,i,n[e],o,!1);else wu(a,i,n,o,!1)}}function gf(e,t){if(t!==null){let n=t.type;if(n&3)return ro(t,e);if(n&4)return vf(-1,e[t.index]);if(n&8){let n=t.child;if(n!==null)return gf(e,n);{let n=e[t.index];return Ka(n)?vf(-1,n):to(n)}}if(n&128)return gf(e,t.next);if(n&32)return Zu(t,e)()||to(e[t.index]);{let n=_f(e,t);return n===null?gf(e,t.next):Array.isArray(n)?n[0]:gf(bo(e[15]),n)}}return null}function _f(e,t){if(t!==null){let n=e[15][5],r=t.projection;return n.projection[r]}return null}function vf(e,t){let n=10+e+1;if(n<t.length){let e=t[n],r=e[1].firstChild;if(r!==null)return gf(e,r)}return t[7]}function yf(e,t,n,r,i,a,o){for(;n!=null;){let s=r[9];if(n.type===128){n=n.next;continue}let c=r[n.index],l=n.type;if(o&&t===0&&(c&&Wl(to(c),r),n.flags|=2),!tu(n)){if(l&8)yf(e,t,n.child,r,i,a,!1),$d(t,e,s,i,c,n,a,r);else if(l&32){let o=Zu(n,r),l;for(;l=o();)$d(t,e,s,i,l,n,a,r);$d(t,e,s,i,c,n,a,r)}else l&16?Sf(e,t,r,n,i,a):$d(t,e,s,i,c,n,a,r)}n=o?n.projectionNext:n.next}}function bf(e,t,n,r,i,a){e.type===3?xf(n,r,t,i,a):yf(n,r,e.firstChild,t,i,a,!1)}function xf(e,t,n,r,i){let a=n[1].firstChild,o=a.next,s=to(n[a.index]),c=to(n[o.index]),l=o.index+1,u=n[l];if(t===1||t===0)r!==null&&(u&&u.hasChildNodes()?Su(e,r,u,i,!0):(Su(e,r,s,i,!0),Su(e,r,c,i,!0)));else if(t===2){if(u||(u=document.createDocumentFragment(),n[l]=u),s&&s.parentNode===u)return;let e=s;for(;e!==null;){let t=e.nextSibling;if(u.appendChild(e),e===c)break;e=t}}}function Sf(e,t,n,r,i,a){let o=n[15],s=o[5].projection[r.projection];if(Array.isArray(s))for(let o=0;o<s.length;o++){let c=s[o];$d(t,e,n[9],i,c,r,a,n)}else{let n=s,c=o[3];Il(r)&&(n.flags|=128),yf(e,t,n,c,i,a,!0)}}function Cf(e,t,n,r,i,a,o){let s=r[7];if(s!==to(r)&&$d(t,e,n,a,s,i,o),!(r[2]&4))for(let n=10;n<r.length;n++){let i=r[n];bf(i[1],i,e,t,a,s)}}function wf(e,t,n,r,i){if(t)i?e.addClass(n,r):e.removeClass(n,r);else{let t=r.indexOf(`-`)===-1?void 0:Yu.DashCase;i==null?e.removeStyle(n,r,t):(typeof i==`string`&&i.endsWith(`!important`)&&(i=i.slice(0,-10),t|=Yu.Important),e.setStyle(n,r,i,t))}}function Tf(e,t,n,r,i,a,o,s,c,l,u){let d=27+r,f=d+i,p=Ef(d,f),m=typeof l==`function`?l():l;return p[1]={type:e,blueprint:p,template:n,queries:null,viewQuery:s,declTNode:t,data:p.slice().fill(null,d),bindingStartIndex:d,expandoStartIndex:f,hostBindingOpCodes:null,firstCreatePass:!0,firstUpdatePass:!0,staticViewQueries:!1,staticContentQueries:!1,preOrderHooks:null,preOrderCheckHooks:null,contentHooks:null,contentCheckHooks:null,viewHooks:null,viewCheckHooks:null,destroyHooks:null,cleanup:null,contentQueries:null,components:null,directiveRegistry:typeof a==`function`?a():a,pipeRegistry:typeof o==`function`?o():o,firstChild:null,schemas:c,consts:m,incompleteFirstPass:!1,ssrId:u}}function Ef(e,t){let n=[];for(let r=0;r<t;r++)n.push(r<e?null:Ju);return n}function Df(e){let t=e.tView;return t===null||t.incompleteFirstPass?e.tView=Tf(1,null,e.template,e.decls,e.vars,e.directiveDefs,e.pipeDefs,e.viewQuery,e.schemas,e.consts,e.id):t}function Of(e,t,n,r,i,a,o,s,c,l,u){let d=t.blueprint.slice();return d[0]=i,d[2]=r|1228,(l!==null||e&&e[2]&2048)&&(d[2]|=2048),fo(d),d[3]=d[14]=e,d[8]=n,d[10]=o||e&&e[10],d[11]=s||e&&e[11],d[9]=c||e&&e[9]||null,d[5]=a,d[19]=Bl(),d[6]=u,d[20]=l,d[15]=t.type==2?e[15]:d,d}function kf(e,t,n){let r=ro(t,e),i=Df(n),a=e[10].rendererFactory,o=Mf(e,Of(e,i,null,Af(n),r,t,null,a.createRenderer(r,n),null,null,null));return e[t.index]=o}function Af(e){let t=16;return e.signals?t=4096:e.onPush&&(t=64),t}function jf(e,t,n,r){if(n===0)return-1;let i=t.length;for(let i=0;i<n;i++)t.push(r),e.blueprint.push(r),e.data.push(null);return i}function Mf(e,t){return e[12]?e[13][4]=t:e[12]=t,e[13]=t,t}function M(e=1){Nf(No(),D(),us()+e,!1)}function Nf(e,t,n,r){if(!r){if((t[2]&3)==3){let r=e.preOrderCheckHooks;r!==null&&Rc(t,r,n)}else{let r=e.preOrderHooks;r!==null&&zc(t,r,0,n)}}ds(n)}var Pf=(function(e){return e[e.None=0]=`None`,e[e.SignalBased=1]=`SignalBased`,e[e.HasDecoratorInputTransform=2]=`HasDecoratorInputTransform`,e})(Pf||{});function Ff(e,t,n,r){let i=w(null);try{let[i,a,o]=e.inputs[n],s=null;(a&Pf.SignalBased)!==0&&(s=t[i][dn]),s!==null&&s.transformFn!==void 0?r=s.transformFn(r):o!==null&&(r=o.call(t,r)),e.setInput===null?wc(t,s,i,r):e.setInput(t,s,r,n,i)}finally{w(i)}}function If(e,t,n,r,i){let a=us(),o=r&2;try{ds(-1),o&&t.length>27&&Nf(e,t,27,!1),Fc(o?Sc.TemplateUpdateStart:Sc.TemplateCreateStart,i,n),n(r,i)}finally{ds(a),Fc(o?Sc.TemplateUpdateEnd:Sc.TemplateCreateEnd,i,n)}}function Lf(e,t,n){Wf(e,t,n),(n.flags&64)==64&&Gf(e,t,n)}function Rf(e,t,n=ro){let r=t.localNames;if(r!==null){let i=t.index+1;for(let a=0;a<r.length;a+=2){let o=r[a+1],s=o===-1?n(t,e):e[o];e[i++]=s}}}function zf(e,t,n,r){let i=r.get(Ql,Zl)||n===su.ShadowDom||n===su.ExperimentalIsolatedShadowDom;return e.selectRootElement(t,i)}function Bf(e){return e===`class`?`className`:e===`for`?`htmlFor`:e===`formaction`?`formAction`:e===`innerHtml`?`innerHTML`:e===`readonly`?`readOnly`:e===`tabindex`?`tabIndex`:e}function Vf(e,t,n,r,i,a){let o=t[1];if(ep(e,o,t,n,r)){Ja(e)&&Uf(t,e.index);return}e.type&3&&(n=Bf(n)),Hf(e,t,n,r,i,a)}function Hf(e,t,n,r,i,a){if(e.type&3){let o=ro(e,t);r=a==null?r:a(r,e.value||``,n),i.setProperty(o,n,r)}else e.type&12}function Uf(e,t){let n=so(t,e);n[2]&16||(n[2]|=64)}function Wf(e,t,n){let r=n.directiveStart,i=n.directiveEnd;Ja(n)&&kf(t,n,e.data[r+n.componentOffset]),e.firstCreatePass||ul(n,t);let a=n.initialInputs;for(let o=r;o<i;o++){let i=e.data[o],s=xl(t,e,o,n);if(Wl(s,t),a!==null&&Xf(t,o-r,s,i,n,a),Xa(i)){let r=so(n.index,t);r[8]=xl(t,e,o,n)}}}function Gf(e,t,n){let r=n.directiveStart,i=n.directiveEnd,a=n.index,o=Xo();try{ds(a);for(let n=r;n<i;n++){let r=e.data[n],i=t[n];Zo(n),(r.hostBindings!==null||r.hostVars!==0||r.hostAttrs!==null)&&Kf(r,i)}}finally{ds(-1),Zo(o)}}function Kf(e,t){e.hostBindings!==null&&e.hostBindings(1,t)}function qf(e,t){let n=e.directiveRegistry,r=null;if(n)for(let e=0;e<n.length;e++){let i=n[e];Vu(t,i.selectors,!1)&&(r??=[],Xa(i)?r.unshift(i):r.push(i))}return r}function Jf(e,t,n,r,i,a){let o=ro(e,t);Yf(t[11],o,a,e.value,n,r,i)}function Yf(e,t,n,r,i,a,o){if(a==null)o?.(a,r||``,i),e.removeAttribute(t,i,n);else{let s=o==null?Ai(a):o(a,r||``,i);e.setAttribute(t,i,s,n)}}function Xf(e,t,n,r,i,a){let o=a[t];if(o!==null)for(let e=0;e<o.length;e+=2){let t=o[e],i=o[e+1];Ff(r,n,t,i)}}function Zf(e,t,n,r,i){let a=27+n,o=t[1],s=i(o,t,e,r,n);t[a]=s,Lo(e,!0);let c=e.type===2;return c?(Ou(t[11],s,e),(Eo()===0||Ya(e))&&Wl(s,t),Do()):Wl(s,t),_s()&&(!c||!tu(e))&&hf(o,t,s,e),e}function Qf(e){let t=e;return Ro()?zo():(t=t.parent,Lo(t,!1)),t}function $f(e,t){let n=e[9];if(!n)return;let r;try{r=n.get(Js,null)}catch{r=null}r?.(t)}function ep(e,t,n,r,i){let a=e.inputs?.[r],o=e.hostDirectiveInputs?.[r],s=!1;if(o)for(let e=0;e<o.length;e+=2){let r=o[e],a=o[e+1],c=t.data[r];Ff(c,n[r],a,i),s=!0}if(a)for(let e of a){let a=n[e],o=t.data[e];Ff(o,a,r,i),s=!0}return s}function tp(e,t){let n=so(t,e),r=n[1];np(r,n);let i=n[0];i!==null&&n[6]===null&&(n[6]=ru(i,n[9])),Fc(Sc.ComponentStart);try{rp(r,n,n[8])}finally{Fc(Sc.ComponentEnd,n[8])}}function np(e,t){for(let n=t.length;n<e.blueprint.length;n++)t.push(e.blueprint[n])}function rp(e,t,n){rs(t);try{let r=e.viewQuery;r!==null&&au(1,r,n);let i=e.template;i!==null&&If(e,t,i,1,n),e.firstCreatePass&&=!1,t[18]?.finishViewCreation(e),e.staticContentQueries&&iu(e,t),e.staticViewQueries&&au(2,e.viewQuery,n);let a=e.components;a!==null&&ip(t,a)}catch(t){throw e.firstCreatePass&&=(e.incompleteFirstPass=!0,!1),t}finally{t[2]&=-5,cs()}}function ip(e,t){for(let n=0;n<t.length;n++)tp(e,t[n])}function ap(e,t,n,r){let i=w(null);try{let i=t.tView,a=Of(e,i,n,e[2]&4096?4096:16,null,t,null,null,r?.injector??null,r?.embeddedViewInjector??null,r?.dehydratedView??null);a[16]=e[t.index];let o=e[18];return o!==null&&(a[18]=o.createEmbeddedView(i)),rp(i,a,n),a}finally{w(i)}}function op(e,t){return!t||t.firstChild===null||Il(e)}function sp(e,t,n,r,i=!1){if(e.type===3){let n=e.firstChild,i=n.next,a=to(t[n.index]),o=to(t[i.index]),s=a;for(;s!==null&&(r.push(s),s!==o);)s=s.nextSibling;return r}for(;n!==null;){if(n.type===128){n=i?n.projectionNext:n.next;continue}let a=t[n.index];if(a!==null){if(Ka(a)){let e=a[7];e!==a[0]&&r.push(to(a)),a[2]&4||cp(a,r),r.push(e)}else r.push(to(a))}let o=n.type;if(o&8)sp(e,t,n.child,r);else if(o&32){let e=Zu(n,t),i;for(;i=e();)r.push(i)}else if(o&16){let e=_f(t,n);if(Array.isArray(e))r.push(...e);else{let n=bo(t[15]);sp(n[1],n,e,r,!0)}}n=i?n.projectionNext:n.next}return r}function cp(e,t){for(let n=10;n<e.length;n++){let r=e[n],i=r[1].firstChild;i!==null&&sp(r[1],r,i,t)}}function lp(e){if(e[25]!==null){for(let t of e[25])t.impl.addSequence(t);e[25].length=0}}var up=[];function dp(e){return e[24]??fp(e)}function fp(e){let t=up.pop()??Object.create(mp);return t.lView=e,t}function pp(e){e.lView[24]!==e&&(e.lView=null,up.push(e))}var mp={...pn,consumerIsAlwaysLive:!0,kind:`template`,consumerMarkedDirty:e=>{_o(e.lView)},consumerOnSignalRead(){this.lView[24]=this}};function hp(e){let t=e[24]??Object.create(gp);return t.lView=e,t}var gp={...pn,consumerIsAlwaysLive:!0,kind:`template`,consumerMarkedDirty:e=>{let t=bo(e.lView);for(;t&&!_p(t[1]);)t=bo(t);t&&po(t)},consumerOnSignalRead(){this.lView[24]=this}};function _p(e){return e.type!==2}function vp(e){if(e[23]===null)return;let t=!0;for(;t;){let n=!1;for(let t of e[23])if(t.dirty&&(n=!0,t.zone===null||Zone.current===t.zone?t.run():t.zone.run(()=>t.run()),e[23]===null))return;t=n&&!!(e[2]&8192)}}var yp=100;function bp(e,t=0){let n=e[10].rendererFactory;n.begin?.();try{xp(e,t)}finally{n.end?.()}}function xp(e,t){let n=Vo();try{Ho(!0),Dp(e,t);let n=0;for(;ho(e);){if(n===yp)throw new T(103,!1);n++,Dp(e,1)}}finally{Ho(n)}}function Sp(e,t,n,r){if(Qa(t))return;let i=t[2];rs(t);let a=!0,o=null,s=null;_p(e)?(s=dp(t),o=xn(s)):fn()===null?(a=!1,s=hp(t),o=xn(s)):t[24]&&=(En(t[24]),null);try{fo(t),Go(e.bindingStartIndex),n!==null&&If(e,t,n,2,r);let a=(i&3)==3;if(a){let n=e.preOrderCheckHooks;n!==null&&Rc(t,n,null)}else{let n=e.preOrderHooks;n!==null&&zc(t,n,0,null),Bc(t,0)}if(wp(t),vp(t),Cp(t,0),e.contentQueries!==null&&iu(e,t),a){let n=e.contentCheckHooks;n!==null&&Rc(t,n)}else{let n=e.contentHooks;n!==null&&zc(t,n,1),Bc(t,1)}kp(e,t);let o=e.components;o!==null&&Op(t,o,0);let s=e.viewQuery;if(s!==null&&au(2,s,r),a){let n=e.viewCheckHooks;n!==null&&Rc(t,n)}else{let n=e.viewHooks;n!==null&&zc(t,n,2),Bc(t,2)}if(e.firstUpdatePass===!0&&(e.firstUpdatePass=!1),t[22]){for(let e of t[22])e();t[22]=null}lp(t),t[2]&=-73}catch(e){throw _o(t),e}finally{s!==null&&(Cn(s,o),a&&pp(s)),cs()}}function Cp(e,t){for(let n=Gl(e);n!==null;n=Kl(n))for(let e=10;e<n.length;e++){let r=n[e];Ep(r,t)}}function wp(e){for(let t=Gl(e);t!==null;t=Kl(t)){if(!(t[2]&2))continue;let e=t[9];for(let t=0;t<e.length;t++){let n=e[t];po(n)}}}function Tp(e,t,n){Fc(Sc.ComponentStart);let r=so(t,e);try{Ep(r,n)}finally{Fc(Sc.ComponentEnd,r[8])}}function Ep(e,t){co(e)&&Dp(e,t)}function Dp(e,t){let n=e[1],r=e[2],i=e[24],a=!!(t===0&&r&16);if(a||=!!(r&64&&t===0),a||=!!(r&1024),a||=!!(i?.dirty&&Tn(i)),a||=!1,i&&(i.dirty=!1),e[2]&=-9217,a)Sp(n,e,n.template,e[8]);else if(r&8192){let t=w(null);try{vp(e),Cp(e,1);let t=n.components;t!==null&&Op(e,t,1),lp(e)}finally{w(t)}}}function Op(e,t,n){for(let r=0;r<t.length;r++)Tp(e,t[r],n)}function kp(e,t){let n=e.hostBindingOpCodes;if(n!==null)try{for(let e=0;e<n.length;e++){let r=n[e];if(r<0)ds(~r);else{let i=r,a=n[++e],o=n[++e];Yo(a,i);let s=t[i];Fc(Sc.HostBindingsUpdateStart,s);try{o(2,s)}finally{Fc(Sc.HostBindingsUpdateEnd,s)}}}}finally{ds(-1)}}function Ap(e,t){let n=Vo()?64:1088;for(e[10].changeDetectionScheduler?.notify(t);e;){e[2]|=n;let t=bo(e);if(Za(e)&&!t)return e;e=t}return null}function jp(e,t,n,r){return[e,!0,0,t,null,r,null,n,null,null]}function Mp(e,t){let n=10+t;if(n<e.length)return e[n]}function Np(e,t,n,r=!0){let i=t[1];if(Ip(i,t,e,n),r){let r=vf(n,e),a=t[11],o=a.parentNode(e[7]);o!==null&&tf(i,e[5],a,t,o,r)}let a=t[6];a!==null&&a.firstChild!==null&&(a.firstChild=null)}function Pp(e,t){let n=Fp(e,t);return n!==void 0&&of(n[1],n),n}function Fp(e,t){if(e.length<=10)return;let n=10+t,r=e[n];if(r){let i=r[16];i!==null&&i!==e&&af(i,r),t>0&&(e[n-1][4]=r[4]);let a=ra(e,10+t);ef(r[1],r);let o=a[18];o!==null&&o.detachView(a[1]),r[3]=null,r[4]=null,r[2]&=-129}return r}function Ip(e,t,n,r){let i=10+r,a=n.length;r>0&&(n[i-1][4]=t),r<a-10?(t[4]=n[i],na(n,10+r,t)):(n.push(t),t[4]=null),t[3]=n;let o=t[16];o!==null&&n!==o&&Lp(o,t);let s=t[18];s!==null&&s.insertView(e),go(t),t[2]|=128}function Lp(e,t){let n=e[9],r=t[3];if(Ga(r))e[2]|=2;else{let n=r[3][15];t[15]!==n&&(e[2]|=2)}n===null?e[9]=[t]:n.push(t)}var Rp=class{_lView;_cdRefInjectingView;_appRef=null;_attachedToViewContainer=!1;exhaustive;get rootNodes(){let e=this._lView,t=e[1];return sp(t,e,t.firstChild,[])}constructor(e,t){this._lView=e,this._cdRefInjectingView=t}get context(){return this._lView[8]}set context(e){this._lView[8]=e}get destroyed(){return Qa(this._lView)}destroy(){if(this._appRef)this._appRef.detachView(this);else if(this._attachedToViewContainer){let e=this._lView[3];if(Ka(e)){let t=e[8],n=t?t.indexOf(this):-1;n>-1&&(Fp(e,n),ra(t,n))}this._attachedToViewContainer=!1}of(this._lView[1],this._lView)}onDestroy(e){vo(this._lView,e)}markForCheck(){Ap(this._cdRefInjectingView||this._lView,4)}detach(){this._lView[2]&=-129}reattach(){go(this._lView),this._lView[2]|=128}detectChanges(){this._lView[2]|=1024,bp(this._lView)}checkNoChanges(){}attachToViewContainerRef(){if(this._appRef)throw new T(902,!1);this._attachedToViewContainer=!0}detachFromAppRef(){this._appRef=null;let e=Za(this._lView),t=this._lView[16];t!==null&&!e&&af(t,this._lView),nf(this._lView[1],this._lView)}attachToAppRef(e){if(this._attachedToViewContainer)throw new T(902,!1);this._appRef=e;let t=Za(this._lView),n=this._lView[16];n!==null&&!t&&Lp(n,this._lView),go(this._lView)}},zp=(()=>{class e{_declarationLView;_declarationTContainer;elementRef;static __NG_ELEMENT_ID__=Bp;constructor(e,t,n){this._declarationLView=e,this._declarationTContainer=t,this.elementRef=n}get ssrId(){return this._declarationTContainer.tView?.ssrId||null}createEmbeddedView(e,t){return this.createEmbeddedViewImpl(e,t)}createEmbeddedViewImpl(e,t,n){return new Rp(ap(this._declarationLView,this._declarationTContainer,e,{embeddedViewInjector:t,dehydratedView:n}))}}return e})();function Bp(){return Vp(Po(),D())}function Vp(e,t){return e.type&4?new zp(t,e,jl(e,t)):null}function Hp(e,t,n,r,i){let a=e.data[t];if(a===null)a=Up(e,t,n,r,i),Jo()&&(a.flags|=32);else if(a.type&64){a.type=n,a.value=r,a.attrs=i;let e=Io();a.injectorIndex=e===null?-1:e.injectorIndex}return Lo(a,!0),a}function Up(e,t,n,r,i){let a=Fo(),o=Ro(),s=o?a:a&&a.parent,c=e.data[t]=Gp(e,s,n,t,r,i);return Wp(e,c,a,o),c}function Wp(e,t,n,r){e.firstChild===null&&(e.firstChild=t),n!==null&&(r?n.child==null&&t.parent!==null&&(n.child=t):n.next===null&&(n.next=t,t.prev=n))}function Gp(e,t,n,r,i,a){let o=t?t.injectorIndex:-1,s=0;return Ao()&&(s|=128),{type:n,index:r,insertBeforeIndex:null,injectorIndex:o,directiveStart:-1,directiveEnd:-1,directiveStylingLast:-1,componentOffset:-1,controlDirectiveIndex:-1,customControlIndex:-1,propertyBindings:null,flags:s,providerIndexes:0,value:i,namespace:hs(),attrs:a,mergedAttrs:null,localNames:null,initialInputs:null,inputs:null,hostDirectiveInputs:null,outputs:null,hostDirectiveOutputs:null,directiveToIndex:null,tView:null,next:null,prev:null,projectionNext:null,child:null,parent:t,projection:null,styles:null,stylesWithoutHost:null,residualStyles:void 0,classes:null,classesWithoutHost:null,residualClasses:void 0,classBindings:0,styleBindings:0}}function Kp(e){let t=e[6]??[],n=e[3][11],r=[];for(let e of t)e.data.di===void 0?qp(e,n):r.push(e);e[6]=r}function qp(e,t){let n=0,r=e.firstChild;if(r){let i=e.data.r;for(;n<i;){let e=r.nextSibling;Tu(t,r,!1),r=e,n++}}}var Jp=()=>null,Yp=()=>null;function Xp(e,t){return Jp(e,t)}function Zp(e,t,n){return Yp(e,t,n)}var Qp=class{},$p=class{},em=(()=>{class e{static ɵprov=di({token:e,providedIn:`root`,factory:()=>null})}return e})();function tm(e){return e.debugInfo?.className||e.type.name||null}var nm={},rm=class{injector;parentInjector;constructor(e,t){this.injector=e,this.parentInjector=t}get(e,t,n){let r=this.injector.get(e,nm,n);return r!==nm||t===nm?r:this.parentInjector.get(e,t,n)}};function im(e,t,n){return e[t]=n}function am(e,t){return e[t]}function om(e,t,n){if(n===Ju)return!1;let r=e[t];return!Object.is(r,n)&&(e[t]=n,!0)}function sm(e,t,n,r){let i=om(e,t,n);return om(e,t+1,r)||i}function cm(e,t,n,r,i){let a=sm(e,t,n,r);return om(e,t+2,i)||a}function lm(e,t,n,r,i,a){let o=sm(e,t,n,r);return sm(e,t+2,i,a)||o}function um(e,t,n){return function r(i){let a=r.__ngNativeEl__;a!==void 0&&eu(i,a),Ap(Ja(e)?so(e.index,t):t,5);let o=t[8],s=dm(t,o,n,i),c=r.__ngNextListenerFn__;for(;c;)s=dm(t,o,c,i)&&s,c=c.__ngNextListenerFn__;return s}}function dm(e,t,n,r){let i=w(null);try{return Fc(Sc.OutputStart,t,n),n(r)!==!1}catch(t){return $f(e,t),!1}finally{Fc(Sc.OutputEnd,t,n),w(i)}}function fm(e,t,n,r,i,a,o,s){let c=Ya(e),l=!1,u=null;if(!r&&c&&(u=mm(t,n,a,e.index)),u!==null){let e=u.__ngLastListenerFn__||u;e.__ngNextListenerFn__=o,u.__ngLastListenerFn__=o,l=!0}else{let o=ro(e,n),c=r?r(o):o;r||(s.__ngNativeEl__=o);let l=i.listen(c,a,s);pm(a)||hm(r?t=>r(to(t[e.index])):e.index,t,n,a,s,l,!1)}return l}function pm(e){return e.startsWith(`animation`)||e.startsWith(`transition`)}function mm(e,t,n,r){let i=e.cleanup;if(i!=null)for(let e=0;e<i.length-1;e+=2){let a=i[e];if(a===n&&i[e+1]===r){let n=t[7],r=i[e+2];return n&&n.length>r?n[r]:null}typeof a==`string`&&(e+=2)}return null}function hm(e,t,n,r,i,a,o){let s=t.firstCreatePass?So(t):null,c=xo(n),l=c.length;c.push(i,a),s&&s.push(r,e,l,(l+1)*(o?-1:1))}function gm(e,t,n,r,i,a){let o=t[n],s=t[1],c=o[s.data[n].outputs[r]].subscribe(a);hm(e.index,s,t,i,a,c,!0)}var _m=Symbol(`BINDING`),vm=new vi(``);function ym(e,t,n){let r=n?e.styles:null,i=n?e.classes:null,a=0;if(t!==null)for(let e=0;e<t.length;e++){let n=t[e];if(typeof n==`number`)a=n;else if(a==1)i=oi(i,n);else if(a==2){let i=n,a=t[++e];r=oi(r,i+`: `+a+`;`)}}n?e.styles=r:e.stylesWithoutHost=r,n?e.classes=i:e.classesWithoutHost=i}function bm(e,t=0){let n=D();return n===null?qi(e,t):_l(Po(),n,li(e),t)}function xm(e,t,n,r,i){let a=r===null?null:{"":-1},o=i(e,n);if(o!==null){let r=o,i=null,s=null;for(let e of o)if(e.resolveHostDirectives!==null){[r,i,s]=e.resolveHostDirectives(o);break}wm(e,t,n,r,a,i,s)}a!==null&&r!==null&&Sm(n,r,a)}function Sm(e,t,n){let r=e.localNames=[];for(let e=0;e<t.length;e+=2){let i=n[t[e+1]];if(i==null)throw new T(-301,!1);r.push(t[e],i)}}function Cm(e,t,n){t.componentOffset=n,(e.components??=[]).push(t.index)}function wm(e,t,n,r,i,a,o){let s=r.length,c=null;for(let i=0;i<s;i++){let a=r[i];c===null&&Xa(a)&&(c=a,Cm(e,n,i)),ml(ul(n,t),e,a.type)}Pm(n,e.data.length,s),c?.viewProvidersResolver&&c.viewProvidersResolver(c);for(let e=0;e<s;e++){let t=r[e];t.providersResolver&&t.providersResolver(t)}let l=!1,u=!1,d=jf(e,t,s,null);s>0&&(n.directiveToIndex=new Map);for(let c=0;c<s;c++){let s=r[c];if(n.mergedAttrs=Zc(n.mergedAttrs,s.hostAttrs),Am(e,n,t,d,s),Nm(d,s,i),o!==null&&o.has(s)){let[e,t]=o.get(s);n.directiveToIndex.set(s.type,[d,e+n.directiveStart,t+n.directiveStart])}else(a===null||!a.has(s))&&n.directiveToIndex.set(s.type,d);s.contentQueries!==null&&(n.flags|=4),(s.hostBindings!==null||s.hostAttrs!==null||s.hostVars!==0)&&(n.flags|=64);let f=s.type.prototype;!l&&(f.ngOnChanges||f.ngOnInit||f.ngDoCheck)&&((e.preOrderHooks??=[]).push(n.index),l=!0),!u&&(f.ngOnChanges||f.ngDoCheck)&&((e.preOrderCheckHooks??=[]).push(n.index),u=!0),d++}Tm(e,n,a)}function Tm(e,t,n){for(let r=t.directiveStart;r<t.directiveEnd;r++){let i=e.data[r];if(n===null||!n.has(i))Em(0,t,i,r),Em(1,t,i,r),km(t,r,!1);else{let e=n.get(i);Dm(0,t,e,r),Dm(1,t,e,r),km(t,r,!0)}}}function Em(e,t,n,r){let i=e===0?n.inputs:n.outputs;for(let n in i)if(Object.hasOwn(i,n)){let i;i=e===0?t.inputs??={}:t.outputs??={},i[n]??=[],i[n].push(r),Om(t,n)}}function Dm(e,t,n,r){let i=e===0?n.inputs:n.outputs;for(let n in i)if(Object.hasOwn(i,n)){let a=i[n],o;o=e===0?t.hostDirectiveInputs??={}:t.hostDirectiveOutputs??={},o[a]??=[],o[a].push(r,n),Om(t,a)}}function Om(e,t){t===`class`?e.flags|=8:t===`style`&&(e.flags|=16)}function km(e,t,n){let{attrs:r,inputs:i,hostDirectiveInputs:a}=e;if(r===null||!n&&i===null||n&&a===null||Iu(e)){e.initialInputs??=[],e.initialInputs.push(null);return}let o=null,s=0;for(;s<r.length;){let e=r[s];if(e===0){s+=4;continue}if(e===5){s+=2;continue}if(typeof e==`number`)break;if(!n&&Object.hasOwn(i,e)){let n=i[e];for(let i of n)if(i===t){o??=[],o.push(e,r[s+1]);break}}else if(n&&Object.hasOwn(a,e)){let n=a[e];for(let e=0;e<n.length;e+=2)if(n[e]===t){o??=[],o.push(n[e+1],r[s+1]);break}}s+=2}e.initialInputs??=[],e.initialInputs.push(o)}function Am(e,t,n,r,i){e.data[r]=i;let a=new Gc(i.factory||=Qi(i.type,!0),Xa(i),bm,null);e.blueprint[r]=a,n[r]=a,jm(e,t,r,jf(e,n,i.hostVars,Ju),i)}function jm(e,t,n,r,i){let a=i.hostBindings;if(a){let i=e.hostBindingOpCodes;i===null&&(i=e.hostBindingOpCodes=[]);let o=~t.index;Mm(i)!=o&&i.push(o),i.push(n,r,a)}}function Mm(e){let t=e.length;for(;t>0;){let n=e[--t];if(typeof n==`number`&&n<0)return n}return 0}function Nm(e,t,n){if(n){if(t.exportAs)for(let r=0;r<t.exportAs.length;r++)n[t.exportAs[r]]=e;Xa(t)&&(n[``]=e)}}function Pm(e,t,n){e.flags|=1,e.directiveStart=t,e.directiveEnd=t+n,e.providerIndexes=t}function Fm(e,t,n,r,i,a,o,s){let c=t[1],l=c.consts,u=Hp(c,e,n,r,uo(l,o));return a&&xm(c,t,u,uo(l,s),i),u.mergedAttrs=Zc(u.mergedAttrs,u.attrs),u.attrs!==null&&ym(u,u.attrs,!1),u.mergedAttrs!==null&&ym(u,u.mergedAttrs,!0),c.queries!==null&&c.queries.elementStart(c,u),u}function Im(e,t){Lc(e,t),qa(t)&&e.queries.elementEnd(t)}function Lm(e,t,n,r,i,a){let o=t.consts,s=Hp(t,e,n,r,uo(o,i));if(s.mergedAttrs=Zc(s.mergedAttrs,s.attrs),a!=null){let e=uo(o,a);s.localNames=[];for(let t=0;t<e.length;t+=2)s.localNames.push(e[t],-1)}return s.attrs!==null&&ym(s,s.attrs,!1),s.mergedAttrs!==null&&ym(s,s.mergedAttrs,!0),t.queries!==null&&t.queries.elementStart(t,s),s}var Rm=typeof ShadowRoot<`u`,zm=typeof Document<`u`;function Bm(e){return Object.keys(e).map(t=>{let[n,r,i]=e[t],a={propName:n,templateName:t,isSignal:(r&Pf.SignalBased)!==0};return i&&(a.transform=i),a})}function Vm(e){return Object.keys(e).map(t=>({propName:e[t],templateName:t}))}function Hm(e,t,n){let r=t instanceof Aa?t:t?.injector;return r&&e.getStandaloneInjector!==null&&(r=e.getStandaloneInjector(r)||r),r?new rm(n,r):n}function Um(e){let t=e.get($p,null);if(t===null)throw new T(407,!1);return{rendererFactory:t,sanitizer:e.get(em,null),changeDetectionScheduler:e.get(ic,null),ngReflect:!1,tracingService:e.get(kd,null,{optional:!0})}}function Wm(e,t,n){let r=Km(e);return xu(t,r,r===`svg`?`svg`:r===`math`?eo:n)}function Gm(e){if((e&&`localName`in e&&typeof e.localName==`string`?e.localName:e?.tagName)?.toLowerCase()===`script`)throw new T(905,!1)}function Km(e){return(e.selectors[0][0]||`div`).toLowerCase()}var qm=class{componentDef;ngModule;selector;componentType;ngContentSelectors;isBoundToModule;cachedInputs=null;cachedOutputs=null;get inputs(){return this.cachedInputs??=Bm(this.componentDef.inputs),this.cachedInputs}get outputs(){return this.cachedOutputs??=Vm(this.componentDef.outputs),this.cachedOutputs}constructor(e,t){this.componentDef=e,this.ngModule=t,this.componentType=e.type,this.selector=Ku(e.selectors),this.ngContentSelectors=e.ngContentSelectors??[],this.isBoundToModule=!!t}create(e,t,n,r,i,a,o){Fc(Sc.DynamicComponentStart);let s=w(null);try{let s=this.componentDef,c=Hm(s,r||this.ngModule,e),l=Um(c),u=l.tracingService;return u&&u.componentCreate?u.componentCreate(tm(s),()=>this.createComponentRef(l,c,t,n,i,a,o)):this.createComponentRef(l,c,t,n,i,a,o)}finally{w(s)}}createComponentRef(e,t,n,r,i,a,o){let s=this.componentDef,c=Jm(r,s,a,i),l=e.rendererFactory.createRenderer(null,s),u=r?zf(l,r,s.encapsulation,t):Wm(s,l,o??null);Gm(u);let d=t.get(vm,null),f=Ym(u,()=>t.get(Ss,null)??Xl());d&&d.addHost(f);let p=a?.some(Zm)||i?.some(e=>typeof e!=`function`&&e.bindings.some(Zm)),m=Of(null,c,null,512|Af(s),null,null,e,l,t,null,ru(u,t,!0));d&&Rm&&f instanceof ShadowRoot&&vo(m,()=>{d.removeHost(f)}),m[27]=u,rs(m);let h=null;try{let e=Fm(27,m,2,`#host`,()=>c.directiveRegistry,!0,0);Ou(l,u,e),Wl(u,m),Lf(c,m,e),ou(c,e,m),Im(c,e),n!==void 0&&$m(e,this.ngContentSelectors,n),h=so(e.index,m),m[8]=h[8],rp(c,m,null)}catch(e){throw h!==null&&Hl(h),Hl(m),e}finally{Fc(Sc.DynamicComponentEnd),cs()}return new Qm(this.componentType,m,!!p)}};function Jm(e,t,n,r){let i=e?[`ng-version`,`22.1.7`]:qu(t.selectors[0]),a=null,o=null,s=0;if(n)for(let e of n)s+=e[_m].requiredVars,e.create&&(e.targetIdx=0,(a??=[]).push(e)),e.update&&(e.targetIdx=0,(o??=[]).push(e));if(r)for(let e=0;e<r.length;e++){let t=r[e];if(typeof t!=`function`)for(let n of t.bindings){s+=n[_m].requiredVars;let t=e+1;n.create&&(n.targetIdx=t,(a??=[]).push(n)),n.update&&(n.targetIdx=t,(o??=[]).push(n))}}let c=[t];if(r)for(let e of r){let t=Di(typeof e==`function`?e:e.type);c.push(t)}return Tf(0,null,Xm(a,o),1,s,c,null,null,null,[i],null)}function Ym(e,t){let n=e.getRootNode?.();return zm&&n instanceof Document?n.head:n&&Rm&&n instanceof ShadowRoot?n:t().head}function Xm(e,t){return!e&&!t?null:n=>{if(n&1&&e)for(let t of e)t.create();if(n&2&&t)for(let e of t)e.update()}}function Zm(e){let t=e[_m].kind;return t===`input`||t===`twoWay`}var Qm=class extends Qp{_rootLView;_hasInputBindings;instance;hostView;changeDetectorRef;componentType;location;previousInputValues=null;_tNode;constructor(e,t,n){super(),this._rootLView=t,this._hasInputBindings=n,this._tNode=io(t[1],27),this.location=jl(this._tNode,t),this.instance=so(this._tNode.index,t)[8],this.hostView=this.changeDetectorRef=new Rp(t,void 0),this.componentType=e}setInput(e,t){this._hasInputBindings;let n=this._tNode;if(this.previousInputValues??=new Map,this.previousInputValues.has(e)&&Object.is(this.previousInputValues.get(e),t))return;let r=this._rootLView;ep(n,r[1],r,e,t),this.previousInputValues.set(e,t),Ap(so(n.index,r),1)}get injector(){return new Tl(this._tNode,this._rootLView)}destroy(){this.hostView.destroy()}onDestroy(e){this.hostView.onDestroy(e)}};function $m(e,t,n){let r=e.projection=[];for(let e=0;e<t.length;e++){let t=n[e];r.push(t!=null&&t.length?Array.from(t):null)}}var eh=(()=>{class e{static __NG_ELEMENT_ID__=th}return e})();function th(){return ah(Po(),D())}var nh=class e extends eh{_lContainer;_hostTNode;_hostLView;constructor(e,t,n){super(),this._lContainer=e,this._hostTNode=t,this._hostLView=n}get element(){return jl(this._hostTNode,this._hostLView)}get injector(){return new Tl(this._hostTNode,this._hostLView)}get parentInjector(){let e=pl(this._hostTNode,this._hostLView);if($c(e)){let t=nl(e,this._hostLView),n=el(e),r=t[1].data[n+8];return new Tl(r,t)}return new Tl(null,this._hostLView)}clear(){for(;this.length>0;)this.remove(this.length-1)}get(e){let t=rh(this._lContainer);return t!==null&&t[e]||null}get length(){return this._lContainer.length-10}createEmbeddedView(e,t,n){let r,i;typeof n==`number`?r=n:n!=null&&(r=n.index,i=n.injector);let a=Xp(this._lContainer,e.ssrId),o=e.createEmbeddedViewImpl(t||{},i,a);return this.insertImpl(o,r,op(this._hostTNode,a)),o}createComponent(e,t,n,r,i,a,o){let s,c=t||{};s=c.index,n=c.injector,r=c.projectableNodes,i=c.environmentInjector||c.ngModuleRef,a=c.directives,o=c.bindings;let l=new qm(Ei(e)),u=n||this.parentInjector;if(!i&&l.ngModule==null){let e=this.parentInjector.get(Aa,null);e&&(i=e)}let d=Ei(l.componentType??{}),f=Xp(this._lContainer,d?.id??null),p=f?.firstChild??null,m=l.create(u,r,p,i,a,o,this._getHostElementNamespace());return this.insertImpl(m.hostView,s,op(this._hostTNode,f)),m}_getHostElementNamespace(){if(this._hostTNode.type&2){let e=this._hostTNode.parent??this._hostLView[5];return e!==null&&e.type&2&&typeof e.value==`string`&&e.value.toLowerCase()===`foreignobject`?null:e?.namespace??null}return this._hostTNode.namespace}insert(e,t){return this.insertImpl(e,t,!0)}insertImpl(t,n,r){let i=t._lView;if(lo(i)){let n=this.indexOf(t);if(n!==-1)this.detach(n);else{let n=i[3],r=new e(n,n[5],n[3]);r.detach(r.indexOf(t))}}let a=this._adjustIndex(n),o=this._lContainer;return Np(o,i,a,r),t.attachToViewContainerRef(),na(ih(o),a,t),t}move(e,t){return this.insert(e,t)}indexOf(e){let t=rh(this._lContainer);return t===null?-1:t.indexOf(e)}remove(e){let t=this._adjustIndex(e,-1),n=Fp(this._lContainer,t);n&&(ra(ih(this._lContainer),t),of(n[1],n))}detach(e){let t=this._adjustIndex(e,-1),n=Fp(this._lContainer,t);return n&&ra(ih(this._lContainer),t)!=null?new Rp(n):null}_adjustIndex(e,t=0){return e??this.length+t}};function rh(e){return e[8]}function ih(e){return e[8]||=[]}function ah(e,t){let n,r=t[e.index];return Ka(r)?n=r:(n=jp(r,t,null,e),t[e.index]=n,Mf(t,n)),sh(n,t,e,r),new nh(n,e,t)}function oh(e,t){let n=e[11],r=n.createComment(``),i=ro(t,e);return Su(n,n.parentNode(i),r,n.nextSibling(i),!1),r}var sh=uh,ch=()=>!1;function lh(e,t,n){return ch(e,t,n)}function uh(e,t,n,r){if(e[7])return;let i;i=n.type&8?to(r):oh(t,n),e[7]=i}var dh=class e{queryList;matches=null;constructor(e){this.queryList=e}clone(){return new e(this.queryList)}setDirty(){this.queryList.setDirty()}},fh=class e{queries;constructor(e=[]){this.queries=e}createEmbeddedView(t){let n=t.queries;if(n!==null){let r=t.contentQueries===null?n.length:t.contentQueries[0],i=[];for(let e=0;e<r;e++){let t=n.getByIndex(e),r=this.queries[t.indexInDeclarationView];i.push(r.clone())}return new e(i)}return null}insertView(e){this.dirtyQueriesWithMatches(e)}detachView(e){this.dirtyQueriesWithMatches(e)}finishViewCreation(e){this.dirtyQueriesWithMatches(e)}dirtyQueriesWithMatches(e){for(let t=0;t<this.queries.length;t++)Dh(e,t).matches!==null&&this.queries[t].setDirty()}},ph=class{flags;read;predicate;constructor(e,t,n=null){this.flags=t,this.read=n,this.predicate=typeof e==`string`?Th(e):e}},mh=class e{queries;constructor(e=[]){this.queries=e}elementStart(e,t){for(let n=0;n<this.queries.length;n++)this.queries[n].elementStart(e,t)}elementEnd(e){for(let t=0;t<this.queries.length;t++)this.queries[t].elementEnd(e)}embeddedTView(t){let n=null;for(let e=0;e<this.length;e++){let r=n===null?0:n.length,i=this.getByIndex(e).embeddedTView(t,r);i&&(i.indexInDeclarationView=e,n===null?n=[i]:n.push(i))}return n===null?null:new e(n)}template(e,t){for(let n=0;n<this.queries.length;n++)this.queries[n].template(e,t)}getByIndex(e){return this.queries[e]}get length(){return this.queries.length}track(e){this.queries.push(e)}},hh=class e{metadata;matches=null;indexInDeclarationView=-1;crossesNgTemplate=!1;_declarationNodeIndex;_appliesToNextNode=!0;constructor(e,t=-1){this.metadata=e,this._declarationNodeIndex=t}elementStart(e,t){this.isApplyingToNode(t)&&this.matchTNode(e,t)}elementEnd(e){this._declarationNodeIndex===e.index&&(this._appliesToNextNode=!1)}template(e,t){this.elementStart(e,t)}embeddedTView(t,n){return this.isApplyingToNode(t)?(this.crossesNgTemplate=!0,this.addMatch(-t.index,n),new e(this.metadata)):null}isApplyingToNode(e){if(this._appliesToNextNode&&(this.metadata.flags&1)!=1){let t=this._declarationNodeIndex,n=e.parent;for(;n!==null&&n.type&8&&n.index!==t;)n=n.parent;return t===(n===null?-1:n.index)}return this._appliesToNextNode}matchTNode(e,t){let n=this.metadata.predicate;if(Array.isArray(n))for(let r=0;r<n.length;r++){let i=n[r];this.matchTNodeWithReadOption(e,t,gh(t,i)),this.matchTNodeWithReadOption(e,t,bl(t,e,i,!1,!1))}else n===zp?t.type&4&&this.matchTNodeWithReadOption(e,t,-1):this.matchTNodeWithReadOption(e,t,bl(t,e,n,!1,!1))}matchTNodeWithReadOption(e,t,n){if(n!==null){let r=this.metadata.read;if(r!==null){if(r===Ml||r===eh||r===zp&&t.type&4)this.addMatch(t.index,-2);else{let n=bl(t,e,r,!1,!1);n!==null&&this.addMatch(t.index,n)}}else this.addMatch(t.index,n)}}addMatch(e,t){this.matches===null?this.matches=[e,t]:this.matches.push(e,t)}};function gh(e,t){let n=e.localNames;if(n!==null){for(let e=0;e<n.length;e+=2)if(n[e]===t)return n[e+1]}return null}function _h(e,t){return e.type&11?jl(e,t):e.type&4?Vp(e,t):null}function vh(e,t,n,r){return n===-1?_h(t,e):n===-2?yh(e,t,r):xl(e,e[1],n,t)}function yh(e,t,n){if(n===Ml)return jl(t,e);if(n===zp)return Vp(t,e);if(n===eh)return ah(t,e)}function bh(e,t,n,r){let i=t[18].queries[r];if(i.matches===null){let r=e.data,a=n.matches,o=[];for(let e=0;a!==null&&e<a.length;e+=2){let i=a[e];if(i<0)o.push(null);else{let s=r[i];o.push(vh(t,s,a[e+1],n.metadata.read))}}i.matches=o}return i.matches}function xh(e,t,n,r){let i=e.queries.getByIndex(n),a=i.matches;if(a!==null){let o=bh(e,t,i,n);for(let e=0;e<a.length;e+=2){let n=a[e];if(n>0)r.push(o[e/2]);else{let i=a[e+1],o=t[-n];for(let e=10;e<o.length;e++){let t=o[e];t[16]===t[3]&&xh(t[1],t,i,r)}if(o[9]!==null){let e=o[9];for(let t=0;t<e.length;t++){let n=e[t];xh(n[1],n,i,r)}}}}}return r}function Sh(e,t){return e[18].queries[t].queryList}function Ch(e,t,n){let r=new Fl((n&4)==4);return Co(e,t,r,r.destroy),(t[18]??=new fh).queries.push(new dh(r))-1}function wh(e,t,n){let r=No();return r.firstCreatePass&&(Eh(r,new ph(e,t,n),-1),(t&2)==2&&(r.staticViewQueries=!0)),Ch(r,D(),t)}function Th(e){return e.split(`,`).map(e=>e.trim())}function Eh(e,t,n){e.queries===null&&(e.queries=new mh),e.queries.track(new hh(t,n))}function Dh(e,t){return e.queries.getByIndex(t)}function Oh(e,t){let n=e[1],r=Dh(n,t);return r.crossesNgTemplate?xh(n,e,t,[]):bh(n,e,r,t)}function kh(e,t,n){let r,i=Mn(()=>{r._dirtyCounter();let n=Nh(r,e);if(t&&n===void 0)throw new T(-951,!1);return n});return r=i[dn],r._dirtyCounter=j(0),r._flatValue=void 0,i}function Ah(e){return kh(!0,!1,e)}function jh(e){return kh(!0,!0,e)}function Mh(e,t){let n=e[dn];n._lView=D(),n._queryIndex=t,n._queryList=Sh(n._lView,t),n._queryList.onDirty(()=>n._dirtyCounter.update(e=>e+1))}function Nh(e,t){let n=e._lView,r=e._queryIndex;if(n===void 0||r===void 0||n[2]&4)return t?void 0:ua;let i=Sh(n,r),a=Oh(n,r);return i.reset(a,Nl),t?i.first:i._changesDetected||e._flatValue===void 0?e._flatValue=i.toArray():e._flatValue}function Ph(e){return!!e&&typeof e.then==`function`}function Fh(e){return!!e&&typeof e.subscribe==`function`}var Ih=class{},Lh=class extends Ih{injector;instance=null;constructor(e){super();let t=new ja([...e.providers,{provide:Ih,useValue:this}],e.parent||ka(),e.debugName,new Set([`environment`]));this.injector=t,e.runEnvironmentInitializers&&t.resolveInjectorInitializers()}destroy(){this.injector.destroy()}onDestroy(e){this.injector.onDestroy(e)}};function Rh(e,t,n=null){return new Lh({providers:e,parent:t,debugName:n,runEnvironmentInitializers:!0}).injector}var zh=(()=>{class e{_injector;cachedInjectors=new Map;constructor(e){this._injector=e}getOrCreateStandaloneInjector(e){if(!e.standalone)return null;if(!this.cachedInjectors.has(e)){let t=ga(!1,e.type),n=t.length>0?Rh([t],this._injector,``):null;this.cachedInjectors.set(e,n)}return this.cachedInjectors.get(e)}ngOnDestroy(){try{for(let e of this.cachedInjectors.values())e!==null&&e.destroy()}finally{this.cachedInjectors.clear()}}static ɵprov=di({token:e,providedIn:`environment`,factory:()=>new e(qi(Aa))})}return e})();function Bh(e){return xc(()=>{let t=Kh(e),n={...t,decls:e.decls,vars:e.vars,template:e.template,consts:e.consts||null,ngContentSelectors:e.ngContentSelectors,onPush:e.changeDetection!==Ll.Eager,directiveDefs:null,pipeDefs:null,dependencies:t.standalone&&e.dependencies||null,getStandaloneInjector:t.standalone?e=>e.get(zh).getOrCreateStandaloneInjector(n):null,getExternalStyles:null,signals:e.signals??!1,data:e.data||{},encapsulation:e.encapsulation||su.Emulated,styles:e.styles||ua,_:null,schemas:e.schemas||null,tView:null,id:``};t.standalone&&jd(`NgStandalone`),qh(n);let r=e.dependencies;return n.directiveDefs=Jh(r,Vh),n.pipeDefs=Jh(r,Oi),n.id=Yh(n),n})}function Vh(e){return Ei(e)||Di(e)}function Hh(e,t){if(e==null)return la;let n={};for(let r in e)if(Object.hasOwn(e,r)){let i=e[r],a,o,s,c;Array.isArray(i)?(s=i[0],a=i[1],o=i[2]??a,c=i[3]||null):(a=i,o=i,s=Pf.None,c=null),n[a]=[r,s,c],t[a]=o}return n}function Uh(e){if(e==null)return la;let t={};for(let n in e)Object.hasOwn(e,n)&&(t[e[n]]=n);return t}function Wh(e){return xc(()=>{let t=Kh(e);return qh(t),t})}function Gh(e){return{type:e.type,name:e.name,factory:null,pure:e.pure!==!1,standalone:e.standalone??!0,onDestroy:e.type.prototype.ngOnDestroy||null}}function Kh(e){let t={};return{type:e.type,providersResolver:null,viewProvidersResolver:null,factory:null,hostBindings:e.hostBindings||null,hostVars:e.hostVars||0,hostAttrs:e.hostAttrs||null,contentQueries:e.contentQueries||null,declaredInputs:t,inputConfig:e.inputs||la,exportAs:e.exportAs||null,standalone:e.standalone??!0,signals:e.signals===!0,selectors:e.selectors||ua,viewQuery:e.viewQuery||null,features:e.features||null,setInput:null,resolveHostDirectives:null,hostDirectives:null,controlDef:null,signalFormsInputPresence:null,inputs:Hh(e.inputs,t),outputs:Uh(e.outputs),debugInfo:null}}function qh(e){e.features?.forEach(t=>t(e))}function Jh(e,t){return e?()=>{let n=typeof e==`function`?e():e,r=[];for(let e of n){let n=t(e);n!==null&&r.push(n)}return r}:null}function Yh(e){let t=0,n=typeof e.consts==`function`?``:e.consts,r=[e.selectors,e.ngContentSelectors,e.hostVars,e.hostAttrs,n,e.vars,e.decls,e.encapsulation,e.standalone,e.signals,e.exportAs,JSON.stringify(e.inputs),JSON.stringify(e.outputs),Object.getOwnPropertyNames(e.type.prototype),!!e.contentQueries,!!e.viewQuery];for(let e of r.join(`|`))t=Math.imul(31,t)+e.charCodeAt(0)<<0;return t+=2147483648,`c`+t}var Xh=new vi(``),Zh=(()=>{class e{resolve;reject;initialized=!1;done=!1;donePromise=new Promise((e,t)=>{this.resolve=e,this.reject=t});appInits=E(Xh,{optional:!0})??[];injector=E(xs);constructor(){}runInitializers(){if(this.initialized)return;let e=[];for(let t of this.appInits){let n=Ha(this.injector,t);if(Ph(n))e.push(n);else if(Fh(n)){let t=new Promise((e,t)=>{n.subscribe({complete:e,error:t})});e.push(t)}}let t=()=>{this.done=!0,this.resolve()};Promise.all(e).then(()=>{t()}).catch(e=>{this.reject(e)}),e.length===0&&t(),this.initialized=!0}static ɵfac=function(t){return new(t||e)};static ɵprov=kl({token:e,factory:e.ɵfac})}return e})();function Qh(e,t,n,r,i,a,o,s){if(n.firstCreatePass){e.mergedAttrs=Zc(e.mergedAttrs,e.attrs);let t=e.tView=Tf(2,e,i,a,o,n.directiveRegistry,n.pipeRegistry,null,n.schemas,n.consts,null);n.queries!==null&&(n.queries.template(n,e),t.queries=n.queries.embeddedTView(e))}s&&(e.flags|=s),Lo(e,!1);let c=ng(n,t,e,r);_s()&&hf(n,t,c,e),Wl(c,t);let l=jp(c,t,c,e);t[r+27]=l,Mf(t,l),lh(l,e,t)}function $h(e,t,n,r,i,a,o,s,c,l,u){let d=n+27,f;return t.firstCreatePass?(f=Hp(t,d,4,o||null,s||null),ko()&&xm(t,e,f,uo(t.consts,l),qf),Lc(t,f)):f=t.data[d],Qh(f,e,t,n,r,i,a,c),Ya(f)&&Lf(t,e,f),l!=null&&Rf(e,f,u),f}function eg(e,t,n,r,i,a,o,s,c,l,u){let d=n+27,f;if(t.firstCreatePass){if(f=Hp(t,d,4,o||null,s||null),l!=null){let e=uo(t.consts,l);f.localNames=[];for(let t=0;t<e.length;t+=2)f.localNames.push(e[t],-1)}}else f=t.data[d];return Qh(f,e,t,n,r,i,a,c),l!=null&&Rf(e,f,u),f}function tg(e,t,n,r,i,a,o,s){let c=D(),l=No();return $h(c,l,e,t,n,r,i,uo(l.consts,a),void 0,o,s),tg}var ng=rg;function rg(e,t,n,r){return vs(!0),t[11].createComment(``)}var ig=new vi(``),ag=new vi(``);function og(){Bn(()=>{throw new T(600,``)})}var sg=10,cg=(()=>{class e{_runningTick=!1;_destroyed=!1;_destroyListeners=[];_views=[];internalErrorHandler=E(Js);afterRenderManager=E(Md);zonelessEnabled=E(ac);rootEffectScheduler=E(sc);dirtyFlags=0;tracingSnapshot=null;allTestViews=new Set;autoDetectTestViews=new Set;includeAllTestViews=!1;afterTick=new Zr;get allViews(){return[...(this.includeAllTestViews?this.allTestViews:this.autoDetectTestViews).keys(),...this._views]}get destroyed(){return this._destroyed}componentTypes=[];components=[];internalPendingTask=E(Ds);get isStable(){return this.internalPendingTask.hasPendingTasksObservable.pipe(ei(e=>!e))}constructor(){E(kd,{optional:!0})}whenStable(){let e;return new Promise(t=>{e=this.isStable.subscribe({next:e=>{e&&t()}})}).finally(()=>{e.unsubscribe()})}_injector=E(Aa);_rendererFactory=null;get injector(){return this._injector}bootstrap(e,t){return this.bootstrapImpl(e,t)}bootstrapImpl(e,t,n=xs.NULL){return this._injector.get(Fs).run(()=>{if(Fc(Sc.BootstrapComponentStart),!this._injector.get(Zh).done)throw new T(405,``);let r=Ei(e),i=this._injector.get(Ih),a=new qm(r,i);this.componentTypes.push(e);let{hostElement:o,directives:s,bindings:c}=lg(t),l=o||a.selector,u=a.create(n,[],l,i.injector,s,c),d=u.location.nativeElement,f=u.injector.get(ig,null);return f?.registerApplication(d),u.onDestroy(()=>{this.detachView(u.hostView),ug(this.components,u),f?.unregisterApplication(d)}),this._loadComponent(u),Fc(Sc.BootstrapComponentEnd,u),u})}tick(){this.zonelessEnabled||(this.dirtyFlags|=1),this._tick()}_tick(){Fc(Sc.ChangeDetectionStart),this.tracingSnapshot===null?this.tickImpl():this.tracingSnapshot.run(Od.CHANGE_DETECTION,this.tickImpl)}tickImpl=()=>{if(this._runningTick)throw Fc(Sc.ChangeDetectionEnd),new T(101,!1);let e=w(null);try{this._runningTick=!0,this.synchronize()}finally{this._runningTick=!1,this.tracingSnapshot?.dispose(),this.tracingSnapshot=null,w(e),this.afterTick.next(),Fc(Sc.ChangeDetectionEnd)}};synchronize(){this._rendererFactory===null&&!this._injector.destroyed&&(this._rendererFactory=this._injector.get($p,null,{optional:!0}));let e=0;for(;this.dirtyFlags!==0&&e++<sg;){Fc(Sc.ChangeDetectionSyncStart);try{this.synchronizeOnce()}finally{Fc(Sc.ChangeDetectionSyncEnd)}}}synchronizeOnce(){this.dirtyFlags&16&&(this.dirtyFlags&=-17,this.rootEffectScheduler.flush());let e=!1;if(this.dirtyFlags&7){let t=!!(this.dirtyFlags&1);this.dirtyFlags&=-8,this.dirtyFlags|=8;for(let{_lView:n}of this.allViews)(t||ho(n))&&(bp(n,t&&!this.zonelessEnabled?0:1),e=!0);if(this.dirtyFlags&=-5,this.syncDirtyFlagsWithViews(),this.dirtyFlags&23)return}e||(this._rendererFactory?.begin?.(),this._rendererFactory?.end?.()),this.dirtyFlags&8&&(this.dirtyFlags&=-9,this.afterRenderManager.execute()),this.syncDirtyFlagsWithViews()}syncDirtyFlagsWithViews(){if(this.allViews.some(({_lView:e})=>ho(e))){this.dirtyFlags|=2;return}this.dirtyFlags&=-8}attachView(e){let t=e;this._views.push(t),t.attachToAppRef(this)}detachView(e){let t=e;ug(this._views,t),t.detachFromAppRef()}_loadComponent(e){this.attachView(e.hostView);try{this.tick()}catch(e){this.internalErrorHandler(e)}this.components.push(e),this._injector.get(ag,[]).forEach(t=>t(e))}ngOnDestroy(){if(!this._destroyed)try{this._destroyListeners.forEach(e=>e()),this._views.slice().forEach(e=>e.destroy())}finally{this._destroyed=!0,this._views=[],this._destroyListeners=[]}}onDestroy(e){return this._destroyListeners.push(e),()=>ug(this._destroyListeners,e)}destroy(){if(this._destroyed)throw new T(406,!1);let e=this._injector;e.destroy&&!e.destroyed&&e.destroy()}get viewCount(){return this._views.length}static ɵfac=function(t){return new(t||e)};static ɵprov=kl({token:e,factory:e.ɵfac})}return e})();function lg(e){return e===void 0||typeof e==`string`||e instanceof Element?{hostElement:e}:e}function ug(e,t){let n=e.indexOf(t);n>-1&&e.splice(n,1)}function N(e,t,n,r){let i=D();return om(i,Ko(),t)&&(No(),Jf(fs(),i,e,t,n,r)),N}function dg(e){if(jd(`NgAnimateEnter`),!fd)return dg;let t=D();if(pd(t))return dg;let n=Po(),r=t[9].get(Fs);return Dd(Cd(t),n,()=>fg(t,n,e,r)),Wd(t[9]),Gd(t[9],Cd(t)),dg}function fg(e,t,n,r){let i=ro(t,e),a=e[11],o=wd(n),s=[],c=!1,l=e=>{if(Td(e)!==i)return;let t=e instanceof AnimationEvent?`animationend`:`transitionend`;r.runOutsideAngular(()=>{a.listen(i,t,u)})},u=e=>{Td(e)===i&&(Ed(e,i)&&(c=!0),pg(e,i,a))};if(o&&o.length>0){r.runOutsideAngular(()=>{s.push(a.listen(i,`animationstart`,l)),s.push(a.listen(i,`transitionstart`,l))}),md(i,o,s);for(let e of o)a.addClass(i,e);r.runOutsideAngular(()=>{requestAnimationFrame(()=>{if(!c&&(sd(i,_d,fd),!_d.has(i))){for(let e of o)a.removeClass(i,e);hd(i)}})})}}function pg(e,t,n){let r=gd.get(t);if(Td(e)===t&&r&&Ed(e,t)){e.stopPropagation();for(let e of r.classList)n.removeClass(t,e);hd(t)}}var mg=class{destroy(e){}updateValue(e,t){}swap(e,t){let n=Math.min(e,t),r=Math.max(e,t),i=this.detach(r);if(r-n>1){let e=this.detach(n);this.attach(n,i),this.attach(r,e)}else this.attach(n,i)}move(e,t){this.attach(t,this.detach(e))}};function hg(e,t,n,r,i){return e===n&&Object.is(t,r)?1:Object.is(i(e,t),i(n,r))?-1:0}function gg(e,t,n,r){let i,a,o=0,s=e.length-1;if(Array.isArray(t)){w(r);let c=t.length-1;for(w(null);o<=s&&o<=c;){let r=e.at(o),l=t[o],u=hg(o,r,o,l,n);if(u!==0){u<0&&e.updateValue(o,l),o++;continue}let d=e.at(s),f=t[c],p=hg(s,d,c,f,n);if(p!==0){p<0&&e.updateValue(s,f),s--,c--;continue}let m=n(o,r),h=n(s,d),g=n(o,l);if(Object.is(g,h)){let t=n(c,f);Object.is(t,m)?(e.swap(o,s),e.updateValue(s,f),c--,s--):e.move(s,o),e.updateValue(o,l),o++;continue}if(i??=new bg,a??=yg(e,o,s,n),_g(e,i,o,g))e.updateValue(o,l),o++,s++;else if(a.has(g))i.set(m,e.detach(o)),s--;else{let n=e.create(o,t[o]);e.attach(o,n),o++,s++}}for(;o<=c;)vg(e,i,n,o,t[o]),o++}else if(t!=null){w(r);let c=t[Symbol.iterator]();w(null);let l=c.next();for(;!l.done&&o<=s;){let t=e.at(o),r=l.value,u=hg(o,t,o,r,n);if(u!==0)u<0&&e.updateValue(o,r),o++,l=c.next();else{i??=new bg,a??=yg(e,o,s,n);let u=n(o,r);if(_g(e,i,o,u))e.updateValue(o,r),o++,s++,l=c.next();else if(!a.has(u))e.attach(o,e.create(o,r)),o++,s++,l=c.next();else{let r=n(o,t);i.set(r,e.detach(o)),s--}}}for(;!l.done;)vg(e,i,n,e.length,l.value),l=c.next()}for(;o<=s;)e.destroy(e.detach(s--));i?.forEach(t=>{e.destroy(t)})}function _g(e,t,n,r){return t!==void 0&&t.has(r)?(e.attach(n,t.get(r)),t.delete(r),!0):!1}function vg(e,t,n,r,i){if(_g(e,t,r,n(r,i)))e.updateValue(r,i);else{let t=e.create(r,i);e.attach(r,t)}}function yg(e,t,n,r){let i=new Set;for(let a=t;a<=n;a++)i.add(r(a,e.at(a)));return i}var bg=class{kvMap=new Map;_vMap=void 0;has(e){return this.kvMap.has(e)}delete(e){if(!this.has(e))return!1;let t=this.kvMap.get(e);return this._vMap!==void 0&&this._vMap.has(t)?(this.kvMap.set(e,this._vMap.get(t)),this._vMap.delete(t)):this.kvMap.delete(e),!0}get(e){return this.kvMap.get(e)}set(e,t){if(this.kvMap.has(e)){let n=this.kvMap.get(e);this._vMap===void 0&&(this._vMap=new Map);let r=this._vMap;for(;r.has(n);)n=r.get(n);r.set(n,t)}else this.kvMap.set(e,t)}forEach(e){for(let[t,n]of this.kvMap)if(e(n,t),this._vMap!==void 0){let r=this._vMap;for(;r.has(n);)n=r.get(n),e(n,t)}}};function P(e,t,n,r,i,a,o,s){jd(`NgControlFlow`);let c=D(),l=No();return eg(c,l,e,t,n,r,i,uo(l.consts,a),256,o,s),xg}function xg(e,t,n,r,i,a,o,s){jd(`NgControlFlow`);let c=D(),l=No();return eg(c,l,e,t,n,r,i,uo(l.consts,a),512,o,s),xg}function F(e,t){jd(`NgControlFlow`);let n=D(),r=Ko(),i=n[r]===Ju?-1:n[r],a=i===-1?void 0:Dg(n,27+i);if(om(n,r,e)){let r=w(null);try{if(a!==void 0&&Pp(a,0),e!==-1){let r=27+e,i=Dg(n,r),a=Mg(n[1],r),o=Zp(i,a,n);Np(i,ap(n,a,t,{dehydratedView:o}),0,op(a,o))}}finally{w(r)}}else if(a!==void 0){let e=Mp(a,0);e!==void 0&&(e[8]=t)}}var Sg=class{lContainer;$implicit;$index;constructor(e,t,n){this.lContainer=e,this.$implicit=t,this.$index=n}get $count(){return this.lContainer.length-10}};function Cg(e){return e}function wg(e,t){return t}var Tg=class{hasEmptyBlock;trackByFn;liveCollection;constructor(e,t,n){this.hasEmptyBlock=e,this.trackByFn=t,this.liveCollection=n}};function I(e,t,n,r,i,a,o,s,c,l,u,d,f){jd(`NgControlFlow`);let p=D(),m=No(),h=c!==void 0,g=D(),_=new Tg(h,s?o.bind(g[15][8]):o);g[27+e]=_,eg(p,m,e+1,t,n,r,i,uo(m.consts,a),256),h&&eg(p,m,e+2,c,l,u,d,uo(m.consts,f),512)}var Eg=class extends mg{lContainer;hostLView;templateTNode;operationsCounter=void 0;needsIndexUpdate=!1;constructor(e,t,n){super(),this.lContainer=e,this.hostLView=t,this.templateTNode=n}get length(){return this.lContainer.length-10}at(e){return this.getLView(e)[8].$implicit}attach(e,t){let n=t[6];this.needsIndexUpdate||=e!==this.length,Np(this.lContainer,t,e,op(this.templateTNode,n)),Og(this.lContainer,e)}detach(e){return this.needsIndexUpdate||=e!==this.length-1,kg(this.lContainer,e),Ag(this.lContainer,e)}create(e,t){let n=Xp(this.lContainer,this.templateTNode.tView.ssrId);return ap(this.hostLView,this.templateTNode,new Sg(this.lContainer,t,e),{dehydratedView:n})}destroy(e){of(e[1],e)}updateValue(e,t){this.getLView(e)[8].$implicit=t}reset(){this.needsIndexUpdate=!1}updateIndexes(){if(this.needsIndexUpdate)for(let e=0;e<this.length;e++)this.getLView(e)[8].$index=e}getLView(e){return jg(this.lContainer,e)}};function L(e){let t=w(null),n=us();try{let r=D(),i=r[1],a=r[n],o=n+1,s=Dg(r,o);a.liveCollection===void 0?a.liveCollection=new Eg(s,r,Mg(i,o)):a.liveCollection.reset();let c=a.liveCollection;if(gg(c,e,a.trackByFn,t),c.updateIndexes(),a.hasEmptyBlock){let e=Ko(),t=c.length===0;if(om(r,e,t)){let e=n+2,a=Dg(r,e);if(t){let t=Mg(i,e),n=Zp(a,t,r);Np(a,ap(r,t,void 0,{dehydratedView:n}),0,op(t,n))}else i.firstUpdatePass&&Kp(a),Pp(a,0)}}}finally{w(t)}}function Dg(e,t){return e[t]}function Og(e,t){if(e.length<=10)return;let n=e[10+t],r=n?n[26]:void 0;if(n&&r&&r.detachedLeaveAnimationFns&&r.detachedLeaveAnimationFns.length>0){let e=n[9];Hd(e,r),ld.delete(n[19]),r.detachedLeaveAnimationFns=void 0}}function kg(e,t){if(e.length<=10)return;let n=e[10+t],r=n?n[26]:void 0;r&&r.leave&&r.leave.size>0&&(r.detachedLeaveAnimationFns=[])}function Ag(e,t){return Fp(e,t)}function jg(e,t){return Mp(e,t)}function Mg(e,t){return io(e,t)}function R(e,t,n){let r=D();return om(r,Ko(),t)&&(No(),Vf(fs(),r,e,t,r[11],n)),R}function Ng(e,t,n,r,i){ep(t,e,n,i?`class`:`style`,r)}function z(e,t,n,r){let i=D(),a=i[1],o=e+27,s=a.firstCreatePass?Fm(o,i,2,t,qf,ko(),n,r):a.data[o];if(Ja(s)){let n=i[10].tracingService;if(n&&n.componentCreate){let o=a.data[s.directiveStart+s.componentOffset];return n.componentCreate(tm(o),()=>(Pg(e,t,i,s,r),z))}}return Pg(e,t,i,s,r),z}function Pg(e,t,n,r,i){if(Zf(r,n,e,t,Ig),Ya(r)){let e=n[1];Lf(e,n,r),ou(e,r,n)}i!=null&&Rf(n,r)}function B(){let e=No(),t=Qf(Po());return e.firstCreatePass&&Im(e,t),jo(t)&&Mo(),Oo(),t.classesWithoutHost!=null&&Kc(t)&&Ng(e,t,D(),t.classesWithoutHost,!0),t.stylesWithoutHost!=null&&qc(t)&&Ng(e,t,D(),t.stylesWithoutHost,!1),B}function V(e,t,n,r){return z(e,t,n,r),B(),V}function H(e,t,n,r){let i=D(),a=i[1],o=e+27,s=a.firstCreatePass?Lm(o,a,2,t,n,r):a.data[o];return Zf(s,i,e,t,Ig),r!=null&&Rf(i,s),H}function U(){return jo(Qf(Po()))&&Mo(),Oo(),U}function Fg(e,t,n,r){return H(e,t,n,r),U(),Fg}var Ig=(e,t,n,r,i)=>(vs(!0),xu(t[11],r,hs()));function Lg(e,t,n){let r=D(),i=r[1],a=e+27,o=i.firstCreatePass?Fm(a,r,8,`ng-container`,qf,ko(),t,n):i.data[a];if(Zf(o,r,e,`ng-container`,Bg),Ya(o)){let e=r[1];Lf(e,r,o),ou(e,o,r)}return n!=null&&Rf(r,o),Lg}function Rg(){let e=No(),t=Qf(Po());return e.firstCreatePass&&Im(e,t),Rg}function zg(e,t,n){return Lg(e,t,n),Rg(),zg}var Bg=(e,t,n,r,i)=>(vs(!0),bu(t[11],``));function W(){return D()}function Vg(e,t,n){let r=D();return om(r,Ko(),t)&&(No(),Hf(fs(),r,e,t,r[11],n)),Vg}var Hg=void 0;function Ug(e){let t=Math.floor(Math.abs(e)),n=e.toString().replace(/^[^.]*\.?/,``).length;return t===1&&n===0?1:5}var Wg=[`en`,[[`a`,`p`],[`AM`,`PM`]],[[`AM`,`PM`]],[[`S`,`M`,`T`,`W`,`T`,`F`,`S`],[`Sun`,`Mon`,`Tue`,`Wed`,`Thu`,`Fri`,`Sat`],[`Sunday`,`Monday`,`Tuesday`,`Wednesday`,`Thursday`,`Friday`,`Saturday`],[`Su`,`Mo`,`Tu`,`We`,`Th`,`Fr`,`Sa`]],Hg,[[`J`,`F`,`M`,`A`,`M`,`J`,`J`,`A`,`S`,`O`,`N`,`D`],[`Jan`,`Feb`,`Mar`,`Apr`,`May`,`Jun`,`Jul`,`Aug`,`Sep`,`Oct`,`Nov`,`Dec`],[`January`,`February`,`March`,`April`,`May`,`June`,`July`,`August`,`September`,`October`,`November`,`December`]],Hg,[[`B`,`A`],[`BC`,`AD`],[`Before Christ`,`Anno Domini`]],0,[6,0],[`M/d/yy`,`MMM d, y`,`MMMM d, y`,`EEEE, MMMM d, y`],[`h:mm a`,`h:mm:ss a`,`h:mm:ss a z`,`h:mm:ss a zzzz`],[`{1}, {0}`,Hg,Hg,Hg],[`.`,`,`,`;`,`%`,`+`,`-`,`E`,`×`,`‰`,`∞`,`NaN`,`:`],[`#,##0.###`,`#,##0%`,`¤#,##0.00`,`#E0`],`USD`,`$`,`US Dollar`,{},`ltr`,Ug],Gg=Object.create(null);function Kg(e){let t=Yg(e),n=qg(t);if(n)return n;let r=t.split(`-`)[0];if(n=qg(r),n)return n;if(r===`en`)return Wg;throw new T(701,!1)}function qg(e){if(!(e in Gg)){let t=Hi.ng&&Hi.ng.common&&Hi.ng.common.locales&&Hi.ng.common.locales[e];return t!==void 0&&(Gg[e]=t),t}return Gg[e]}var Jg={LocaleId:0,DayPeriodsFormat:1,DayPeriodsStandalone:2,DaysFormat:3,DaysStandalone:4,MonthsFormat:5,MonthsStandalone:6,Eras:7,FirstDayOfWeek:8,WeekendRange:9,DateFormat:10,TimeFormat:11,DateTimeFormat:12,NumberSymbols:13,NumberFormats:14,CurrencyCode:15,CurrencySymbol:16,CurrencyName:17,Currencies:18,Directionality:19,PluralCase:20,ExtraData:21};function Yg(e){return e.toLowerCase().replace(/_/g,`-`)}var Xg=`en-US`;function Zg(e){typeof e==`string`&&e.toLowerCase().replace(/_/g,`-`)}function G(e,t,n){let r=D(),i=No(),a=Po();return $g(i,r,r[11],a,e,t,n),G}function Qg(e,t,n){let r=D(),i=No(),a=Po();return(a.type&3||n)&&fm(a,i,r,n,r[11],e,t,um(a,r,t)),Qg}function $g(e,t,n,r,i,a,o){let s=!0,c=null;if((r.type&3||o)&&(c??=um(r,t,a),fm(r,e,t,o,n,i,a,c)&&(s=!1)),s){let e=r.outputs?.[i],n=r.hostDirectiveOutputs?.[i];if(n&&n.length)for(let e=0;e<n.length;e+=2){let o=n[e],s=n[e+1];c??=um(r,t,a),gm(r,t,o,s,i,c)}if(e&&e.length)for(let n of e)c??=um(r,t,a),gm(r,t,n,i,i,c)}}function K(e=1){return ls(e)}function e_(e,t,n,r){return Mh(e,wh(t,n,r)),e_}function t_(e=1){es($o()+e)}function n_(e){return ao(Bo(),27+e)}function r_(e,t){return e<<17|t<<2}function i_(e){return e>>17&32767}function a_(e){return(e&2)==2}function o_(e,t){return e&131071|t<<17}function s_(e){return e|2}function c_(e){return(e&131068)>>2}function l_(e,t){return e&-131069|t<<2}function u_(e){return(e&1)==1}function d_(e){return e|1}function f_(e,t,n,r,i,a){let o=a?t.classBindings:t.styleBindings,s=i_(o),c=c_(o);e[r]=n;let l=!1,u;if(Array.isArray(n)){let e=n;u=e[1],(u===null||sa(e,u)>0)&&(l=!0)}else u=n;if(i){if(c!==0){let t=i_(e[s+1]);e[r+1]=r_(t,s),t!==0&&(e[t+1]=l_(e[t+1],r)),e[s+1]=o_(e[s+1],r)}else e[r+1]=r_(s,0),s!==0&&(e[s+1]=l_(e[s+1],r)),s=r}else e[r+1]=r_(c,0),s===0?s=r:e[c+1]=l_(e[c+1],r),c=r;l&&(e[r+1]=s_(e[r+1])),m_(e,u,r,!0),m_(e,u,r,!1),p_(t,u,e,r,a),o=r_(s,c),a?t.classBindings=o:t.styleBindings=o}function p_(e,t,n,r,i){let a=i?e.residualClasses:e.residualStyles;a!=null&&typeof t==`string`&&sa(a,t)>=0&&(n[r+1]=d_(n[r+1]))}function m_(e,t,n,r){let i=e[n+1],a=t===null,o=r?i_(i):c_(i),s=!1;for(;o!==0&&(s===!1||a);){let n=e[o],i=e[o+1];h_(n,t)&&(s=!0,e[o+1]=r?d_(i):s_(i)),o=r?i_(i):c_(i)}s&&(e[n+1]=r?s_(i):d_(i))}function h_(e,t){return e===null||t==null||(Array.isArray(e)?e[1]:e)===t?!0:Array.isArray(e)&&typeof t==`string`?sa(e,t)>=0:!1}var g_={textEnd:0,key:0,keyEnd:0,value:0,valueEnd:0};function __(e){return e.substring(g_.key,g_.keyEnd)}function v_(e){return b_(e),y_(e,x_(e,0,g_.textEnd))}function y_(e,t){let n=g_.textEnd;return n===t?-1:(t=g_.keyEnd=S_(e,g_.key=t,n),x_(e,t,n))}function b_(e){g_.key=0,g_.keyEnd=0,g_.value=0,g_.valueEnd=0,g_.textEnd=e.length}function x_(e,t,n){for(;t<n&&e.charCodeAt(t)<=32;)t++;return t}function S_(e,t,n){for(;t<n&&e.charCodeAt(t)>32;)t++;return t}function C_(e,t,n){return E_(e,t,n,!1),C_}function q(e,t){return E_(e,t,null,!0),q}function w_(e){D_(L_,T_,e,!0)}function T_(e,t){for(let n=v_(t);n>=0;n=y_(t,n))aa(e,__(t),!0)}function E_(e,t,n,r){let i=D(),a=No(),o=qo(2);if(a.firstUpdatePass&&k_(a,e,o,r),t!==Ju&&om(i,o,t)){let s=a.data[us()];z_(a,s,i,i[11],e,i[o+1]=H_(t,n),r,o)}}function D_(e,t,n,r){let i=No(),a=qo(2);i.firstUpdatePass&&k_(i,null,a,r);let o=D();if(n!==Ju&&om(o,a,n)){let s=i.data[us()];if(U_(s,r)&&!O_(i,a)){let e=r?s.classesWithoutHost:s.stylesWithoutHost;e!==null&&(n=oi(e,n||``)),Ng(i,s,o,n,r)}else R_(i,s,o,o[11],o[a+1],o[a+1]=I_(e,t,n),r,a)}}function O_(e,t){return t>=e.expandoStartIndex}function k_(e,t,n,r){let i=e.data;if(i[n+1]===null){let a=i[us()],o=O_(e,n);U_(a,r)&&t===null&&!o&&(t=!1),t=A_(i,a,t,r),f_(i,a,t,n,o,r)}}function A_(e,t,n,r){let i=Qo(e),a=r?t.residualClasses:t.residualStyles;if(i===null)(r?t.classBindings:t.styleBindings)===0&&(n=P_(null,e,t,n,r),n=F_(n,t.attrs,r),a=null);else{let o=t.directiveStylingLast;if(o===-1||e[o]!==i){if(n=P_(i,e,t,n,r),a===null){let n=j_(e,t,r);n!==void 0&&Array.isArray(n)&&(n=P_(null,e,t,n[1],r),n=F_(n,t.attrs,r),M_(e,t,r,n))}else a=N_(e,t,r)}}return a!==void 0&&(r?t.residualClasses=a:t.residualStyles=a),n}function j_(e,t,n){let r=n?t.classBindings:t.styleBindings;if(c_(r)!==0)return e[i_(r)]}function M_(e,t,n,r){let i=n?t.classBindings:t.styleBindings;e[i_(i)]=r}function N_(e,t,n){let r,i=t.directiveEnd;for(let a=1+t.directiveStylingLast;a<i;a++){let t=e[a].hostAttrs;r=F_(r,t,n)}return F_(r,t.attrs,n)}function P_(e,t,n,r,i){let a=null,o=n.directiveEnd,s=n.directiveStylingLast;for(s===-1?s=n.directiveStart:s++;s<o&&(a=t[s],r=F_(r,a.hostAttrs,i),a!==e);)s++;return e!==null&&(n.directiveStylingLast=s),r}function F_(e,t,n){let r=n?1:2,i=-1;if(t!==null)for(let a=0;a<t.length;a++){let o=t[a];typeof o==`number`?i=o:i===r&&(Array.isArray(e)||(e=e===void 0?[]:[``,e]),aa(e,o,n?!0:t[++a]))}return e===void 0?null:e}function I_(e,t,n){if(n==null||n===``)return ua;let r=[],i=lu(n);if(Array.isArray(i))for(let t=0;t<i.length;t++)e(r,i[t],!0);else if(i instanceof Set)for(let t of i)e(r,t,!0);else if(typeof i==`object`)for(let t in i)Object.hasOwn(i,t)&&e(r,t,i[t]);else typeof i==`string`&&t(r,i);return r}function L_(e,t,n){let r=String(t);r!==``&&!r.includes(` `)&&aa(e,r,n)}function R_(e,t,n,r,i,a,o,s){i===Ju&&(i=ua);let c=0,l=0,u=0<i.length?i[0]:null,d=0<a.length?a[0]:null;for(;u!==null||d!==null;){let f=c<i.length?i[c+1]:void 0,p=l<a.length?a[l+1]:void 0,m=null,h;u===d?(c+=2,l+=2,f!==p&&(m=d,h=p)):d===null||u!==null&&u<d?(c+=2,m=u):(l+=2,m=d,h=p),m!==null&&z_(e,t,n,r,m,h,o,s),u=c<i.length?i[c]:null,d=l<a.length?a[l]:null}}function z_(e,t,n,r,i,a,o,s){if(!(t.type&3))return;let c=e.data,l=c[s+1];V_(u_(l)?B_(c,t,n,i,c_(l),o):void 0)||(V_(a)||a_(l)&&(a=B_(c,null,n,i,s,o)),wf(r,o,no(us(),n),i,a))}function B_(e,t,n,r,i,a){let o=t===null,s;for(;i>0;){let t=e[i],a=Array.isArray(t),c=a?t[1]:t,l=c===null,u=n[i+1];u===Ju&&(u=l?ua:void 0);let d=l?oa(u,r):c===r?u:void 0;if(a&&!V_(d)&&(d=oa(t,r)),V_(d)&&(s=d,o))return s;let f=e[i+1];i=o?i_(f):c_(f)}if(t!==null){let e=a?t.residualClasses:t.residualStyles;e!=null&&(s=oa(e,r))}return s}function V_(e){return e!==void 0}function H_(e,t){return e==null||e===``||(typeof t==`string`?e=lu(e)+t:typeof e==`object`&&(e=ai(lu(e)))),e}function U_(e,t){return!!(e.flags&(t?8:16))}function J(e,t=``){let n=D(),r=No(),i=e+27,a=r.firstCreatePass?Hp(r,i,1,t,null):r.data[i],o=W_(r,n,a,t);n[i]=o,_s()&&hf(r,n,o,a),Lo(a,!1)}var W_=(e,t,n,r)=>(vs(!0),vu(t[11],r));function G_(e,t,n,r=``){return om(e,Ko(),n)?t+Ai(n)+r:Ju}function K_(e,t,n,r,i,a=``){let o=sm(e,Wo(),n,i);return qo(2),o?t+Ai(n)+r+Ai(i)+a:Ju}function q_(e,t,n,r,i,a,o,s=``){let c=cm(e,Wo(),n,i,o);return qo(3),c?t+Ai(n)+r+Ai(i)+a+Ai(o)+s:Ju}function J_(e,t,n,r,i,a,o,s,c,l=``){let u=lm(e,Wo(),n,i,o,c);return qo(4),u?t+Ai(n)+r+Ai(i)+a+Ai(o)+s+Ai(c)+l:Ju}function Y(e){return X(``,e),Y}function X(e,t,n){let r=D(),i=G_(r,e,t,n);return i!==Ju&&Z_(r,us(),i),X}function Z(e,t,n,r,i){let a=D(),o=K_(a,e,t,n,r,i);return o!==Ju&&Z_(a,us(),o),Z}function Y_(e,t,n,r,i,a,o){let s=D(),c=q_(s,e,t,n,r,i,a,o);return c!==Ju&&Z_(s,us(),c),Y_}function X_(e,t,n,r,i,a,o,s,c){let l=D(),u=J_(l,e,t,n,r,i,a,o,s,c);return u!==Ju&&Z_(l,us(),u),X_}function Z_(e,t,n){let r=no(t,e);yu(e[11],r,n)}function Q_(e,t,n){vc(t)&&(t=t());let r=D();return om(r,Ko(),t)&&(No(),Vf(fs(),r,e,t,r[11],n)),Q_}function $_(e,t){let n=vc(e);return n&&e.set(t),n}function ev(e,t){let n=D(),r=No(),i=Po();return $g(r,n,n[11],i,e,t),ev}var tv={};function nv(e){jd(`NgLet`);let t=No(),n=D(),r=e+27;return Lo(Hp(t,r,128,null,null),!1),oo(t,n,r,tv),nv}function rv(e){return oo(No(),D(),us(),e),e}function iv(e){let t=ao(Bo(),27+e);if(t===tv)throw new T(314,!1);return t}function av(e,t,n=``){return G_(D(),e,t,n)}function ov(e,t){let n=Uo()+e,r=D();return r[n]===Ju?im(r,n,t()):am(r,n)}function sv(e,t,n){return lv(D(),Uo(),e,t,n)}function cv(e,t){let n=e[t];return n===Ju?void 0:n}function lv(e,t,n,r,i,a){let o=t+n;return om(e,o,i)?im(e,o+1,a?r.call(a,i):r(i)):cv(e,o+1)}function uv(e,t,n,r,i,a,o){let s=t+n;return sm(e,s,i,a)?im(e,s+2,o?r.call(o,i,a):r(i,a)):cv(e,s+2)}function dv(e,t){let n=No(),r,i=e+27;n.firstCreatePass?(r=fv(t,n.pipeRegistry),n.data[i]=r,r.onDestroy&&(n.destroyHooks??=[]).push(i,r.onDestroy)):r=n.data[i];let a=r.factory||(r.factory=Qi(r.type,!0)),o=Bi(bm);try{let e=il(!1),t=a();return il(e),oo(n,D(),i,t),t}finally{Bi(o)}}function fv(e,t){if(t)for(let n=t.length-1;n>=0;n--){let r=t[n];if(e===r.name)return r}}function pv(e,t,n){let r=e+27,i=D(),a=ao(i,r);return hv(i,r)?lv(i,Uo(),t,a.transform,n,a):a.transform(n)}function mv(e,t,n,r){let i=e+27,a=D(),o=ao(a,i);return hv(a,i)?uv(a,Uo(),t,o.transform,n,r,o):o.transform(n,r)}function hv(e,t){return e[1].data[t].pure}function gv(e,t){return Vp(e,t)}var _v=(()=>{class e{applicationErrorHandler=E(Js);appRef=E(cg);taskService=E(Ds);ngZone=E(Fs);zonelessEnabled=E(ac);tracing=E(kd,{optional:!0});zoneIsDefined=typeof Zone<`u`&&!!Zone.root.run;schedulerTickApplyArgs=[{data:{__scheduler_tick__:!0}}];subscriptions=new hr;angularZoneId=this.zoneIsDefined?this.ngZone._inner?.get(Ns):null;scheduleInRootZone=!this.zonelessEnabled&&this.zoneIsDefined&&(E(oc,{optional:!0})??!1);cancelScheduledCallback=null;useMicrotaskScheduler=!1;runningTick=!1;pendingRenderTaskId=null;constructor(){this.subscriptions.add(this.appRef.afterTick.subscribe(()=>{let e=this.taskService.add();if(!this.runningTick&&(this.cleanup(),!this.zonelessEnabled||this.appRef.includeAllTestViews)){this.taskService.remove(e);return}this.switchToMicrotaskScheduler(),this.taskService.remove(e)})),this.subscriptions.add(this.ngZone.onUnstable.subscribe(()=>{this.runningTick||this.cleanup()}))}switchToMicrotaskScheduler(){this.ngZone.runOutsideAngular(()=>{let e=this.taskService.add();this.useMicrotaskScheduler=!0,queueMicrotask(()=>{this.useMicrotaskScheduler=!1,this.taskService.remove(e)})})}notify(e){if(!this.zonelessEnabled&&e===5)return;switch(e){case 0:case 2:this.appRef.dirtyFlags|=2;break;case 3:case 4:case 5:case 1:this.appRef.dirtyFlags|=4;break;case 6:this.appRef.dirtyFlags|=2;break;case 12:this.appRef.dirtyFlags|=16;break;case 13:this.appRef.dirtyFlags|=2;break;case 11:break;default:this.appRef.dirtyFlags|=8}if(this.appRef.tracingSnapshot=this.tracing?.snapshot(this.appRef.tracingSnapshot)??null,!this.shouldScheduleTick())return;let t=this.useMicrotaskScheduler?js:As;this.pendingRenderTaskId=this.taskService.add(),this.cancelScheduledCallback=this.scheduleInRootZone?Zone.root.run(()=>t(()=>this.tick())):this.ngZone.runOutsideAngular(()=>t(()=>this.tick()))}shouldScheduleTick(){return!(this.appRef.destroyed||this.pendingRenderTaskId!==null||this.runningTick||this.appRef._runningTick||!this.zonelessEnabled&&this.zoneIsDefined&&Zone.current.get(`isAngularZone_ID`+this.angularZoneId))}tick(){if(this.runningTick||this.appRef.destroyed)return;if(this.appRef.dirtyFlags===0){this.cleanup();return}!this.zonelessEnabled&&this.appRef.dirtyFlags&7&&(this.appRef.dirtyFlags|=1);let e=this.taskService.add();try{this.ngZone.run(()=>{this.runningTick=!0,this.appRef._tick()},void 0,this.schedulerTickApplyArgs)}catch(e){this.applicationErrorHandler(e)}finally{this.taskService.remove(e),this.cleanup()}}ngOnDestroy(){this.subscriptions.unsubscribe(),this.cleanup()}cleanup(){if(this.runningTick=!1,this.cancelScheduledCallback?.(),this.cancelScheduledCallback=null,this.pendingRenderTaskId!==null){let e=this.pendingRenderTaskId;this.pendingRenderTaskId=null,this.taskService.remove(e)}}static ɵfac=function(t){return new(t||e)};static ɵprov=kl({token:e,factory:e.ɵfac})}return e})();function vv(){return[{provide:ic,useExisting:_v},{provide:Fs,useClass:Us},{provide:ac,useValue:!0}]}function yv(){return typeof $localize<`u`&&$localize.locale||`en-US`}var bv=new vi(``,{factory:()=>E(bv,{optional:!0,skipSelf:!0})||yv()}),xv=class{destroyed=!1;listeners=null;errorHandler=E(qs,{optional:!0});isEmitting=!1;hasNullListeners=!1;destroyRef=E(Cs);constructor(){this.destroyRef.onDestroy(()=>{this.destroyed=!0,this.listeners=null})}subscribe(e){if(this.destroyed)throw new T(953,!1);return(this.listeners??=[]).push(e),{unsubscribe:()=>{let t=this.listeners?this.listeners.indexOf(e):-1;t>-1&&(this.isEmitting?(this.hasNullListeners=!0,this.listeners[t]=null):this.listeners.splice(t,1))}}}emit(e){if(this.destroyed){console.warn(ri(953,!1));return}if(this.listeners===null)return;this.isEmitting=!0;let t=w(null);try{for(let t of this.listeners)try{t!==null&&t(e)}catch(e){this.errorHandler?.handleError(e)}}finally{this.hasNullListeners&&(this.hasNullListeners=!1,this.listeners&&Sv(this.listeners)),w(t),this.isEmitting=!1}}};function Sv(e){let t=e.length-1;for(;t>-1;)e[t]===null&&e.splice(t,1),t--}function Q(e,t){return Mn(e,t?.equal)}function Cv(e){return ar(e)}(class e extends Error{_brand;constructor(e){super(e)}static IDLE=new e(`IDLE`);static LOADING=new e(`LOADING`)});var wv=e=>e;function Tv(e,t){return typeof e==`function`?Ev(tr(e,wv,t?.equal),t?.debugName,t?.set):Ev(tr(e.source,e.computation,e.equal),e.debugName,e.set)}function Ev(e,t,n){let r=e[dn],i=e;if(n!==void 0){let t=e=>nr(r,e);i.set=e=>n(e,t),i.update=r=>n(r(Cv(e)),t)}else i.set=e=>nr(r,e),i.update=e=>rr(r,e);return i.asReadonly=Xs.bind(e),i}function Dv(e,t){let n=Object.create(bc);n.value=e,n.transformFn=t?.transform;function r(){if(mn(n),n.value===yc)throw new T(-950,null);return n.value}return r[dn]=n,r}function Ov(e){return new xv}function kv(e,t){return Dv(e,t)}function Av(e){return Dv(yc,e)}var $=(kv.required=Av,kv);function jv(e,t){let n=Object.create(bc),r=new xv;n.value=e;function i(){return mn(n),Mv(n.value),n.value}return i[dn]=n,i.asReadonly=Xs.bind(i),i.set=e=>{n.equal(n.value,e)||(Wn(n,e),r.emit(e))},i.update=e=>{Mv(n.value),i.set(e(n.value))},i.subscribe=r.subscribe.bind(r),i.destroyRef=r.destroyRef,i}function Mv(e){if(e===yc)throw new T(952,!1)}function Nv(e,t){return jv(e,t)}function Pv(e){return jv(yc,e)}var Fv=(Nv.required=Pv,Nv);function Iv(e,t){return Ah(t)}function Lv(e,t){return jh(t)}var Rv=(Iv.required=Lv,Iv),zv=new vi(``),Bv=new vi(``);function Vv(e){return!e.moduleRef}function Hv(e){let t=Vv(e)?e.r3Injector:e.moduleRef.injector,n=t.get(Fs);return n.run(()=>{Vv(e)?e.r3Injector.resolveInjectorInitializers():e.moduleRef.resolveInjectorInitializers();let r=t.get(Js),i;if(n.runOutsideAngular(()=>{i=n.onError.subscribe({next:r})}),Vv(e)){let n=()=>t.destroy(),r=e.platformInjector.get(zv);r.add(n),t.onDestroy(()=>{i.unsubscribe(),r.delete(n)})}else{let t=()=>e.moduleRef.destroy(),n=e.platformInjector.get(zv);n.add(t),e.moduleRef.onDestroy(()=>{ug(e.allPlatformModules,e.moduleRef),i.unsubscribe(),n.delete(t)})}return Wv(r,n,()=>{let n=t.get(Ds),r=n.add(),i=t.get(Zh);return i.runInitializers(),i.donePromise.then(()=>{if(Zg(t.get(bv,Xg)||`en-US`),!t.get(Bv,!0))return Vv(e)?t.get(cg):(e.allPlatformModules.push(e.moduleRef),e.moduleRef);if(Vv(e)){let n=t.get(cg);return e.rootComponent!==void 0&&n.bootstrap(e.rootComponent),n}return Uv?.(e.moduleRef,e.allPlatformModules),e.moduleRef}).finally(()=>void n.remove(r))})})}var Uv;function Wv(e,t,n){try{let r=n();return Ph(r)?r.catch(n=>{throw t.runOutsideAngular(()=>e(n)),n}):r}catch(n){throw t.runOutsideAngular(()=>e(n)),n}}var Gv=null;function Kv(e=[],t){return xs.create({name:t,providers:[{provide:Ta,useValue:`platform`},{provide:zv,useValue:new Set([()=>Gv=null])},...e]})}function qv(e=[]){if(Gv)return Gv;let t=Kv(e);return Gv=t,og(),Jv(t),t}function Jv(e){let t=e.get($s,null);Ha(e,()=>{t?.forEach(e=>e())})}function Yv(e){let{rootComponent:t,appProviders:n,platformProviders:r,platformRef:i}=e;Fc(Sc.BootstrapApplicationStart);try{let e=i?.injector??qv(r);return Hv({r3Injector:new Lh({providers:[vv(),Ys,...n||[]],parent:e,debugName:``,runEnvironmentInitializers:!1}).injector,platformInjector:e,rootComponent:t})}catch(e){return Promise.reject(e)}finally{Fc(Sc.BootstrapApplicationEnd)}}var Xv=Symbol(`NOT_SET`),Zv=new Set,Qv={...Kn,kind:`afterRenderEffectPhase`,consumerIsAlwaysLive:!0,consumerAllowSignalWrites:!0,value:Xv,cleanup:null,consumerMarkedDirty(){if(this.sequence.impl.executing){if(this.sequence.lastPhase===null||this.sequence.lastPhase<this.phase)return;this.sequence.erroredOrDestroyed=!0}this.sequence.scheduler.notify(7)},phaseFn(e){if(this.sequence.lastPhase=this.phase,!this.dirty||(this.dirty=!1,this.value!==Xv&&!Tn(this)))return this.signal;try{for(let e of this.cleanup??Zv)e()}finally{this.cleanup?.clear()}let t=[];e!==void 0&&t.push(e),t.push(this.registerCleanupFn);let n=xn(this),r;try{r=this.userFn.apply(null,t)}finally{Cn(this,n)}return(this.value===Xv||!this.equal(this.value,r))&&(this.value=r,this.version++),this.signal}},$v=class extends Fd{scheduler;lastPhase=null;nodes=[void 0,void 0,void 0,void 0];onDestroyFns=null;constructor(e,t,n,r,i,a=null){super(e,[void 0,void 0,void 0,void 0],n,!1,i.get(Cs),a),this.scheduler=r;for(let e of Nd){let n=t[e];if(n===void 0)continue;let r=Object.create(Qv);r.sequence=this,r.phase=e,r.userFn=n,r.dirty=!0,r.signal=()=>(mn(r),r.value),r.signal[dn]=r,r.registerCleanupFn=e=>(r.cleanup??=new Set).add(e),this.nodes[e]=r,this.hooks[e]=e=>r.phaseFn(e)}}afterRun(){super.afterRun(),this.lastPhase=null}destroy(){if(this.onDestroyFns!==null)for(let e of this.onDestroyFns)e();super.destroy();for(let e of this.nodes)if(e)try{for(let t of e.cleanup??Zv)t()}finally{En(e)}}};function ey(e,t){let n=t?.injector??E(xs),r=n.get(ic),i=n.get(Md),a=n.get(kd,null,{optional:!0});i.impl??=n.get(Pd);let o=e;typeof o==`function`&&(o={mixedReadWrite:e});let s=n.get(nc,null,{optional:!0}),c=new $v(i.impl,[o.earlyRead,o.write,o.mixedReadWrite,o.read],s?.view,r,n,a?.snapshot(null));return i.impl.register(c),c}var ty=null;function ny(){return ty}function ry(e){ty??=e}var iy=class{},ay=(function(e){return e[e.Format=0]=`Format`,e[e.Standalone=1]=`Standalone`,e})(ay||{}),oy=(function(e){return e[e.Narrow=0]=`Narrow`,e[e.Abbreviated=1]=`Abbreviated`,e[e.Wide=2]=`Wide`,e[e.Short=3]=`Short`,e})(oy||{}),sy=(function(e){return e[e.Short=0]=`Short`,e[e.Medium=1]=`Medium`,e[e.Long=2]=`Long`,e[e.Full=3]=`Full`,e})(sy||{}),cy={Decimal:0,Group:1,List:2,PercentSign:3,PlusSign:4,MinusSign:5,Exponential:6,SuperscriptingExponent:7,PerMille:8,Infinity:9,NaN:10,TimeSeparator:11,CurrencyDecimal:12,CurrencyGroup:13};function ly(e){return Kg(e)[Jg.LocaleId]}function uy(e,t,n){let r=Kg(e);return xy(xy([r[Jg.DayPeriodsFormat],r[Jg.DayPeriodsStandalone]],t),n)}function dy(e,t,n){let r=Kg(e);return xy(xy([r[Jg.DaysFormat],r[Jg.DaysStandalone]],t),n)}function fy(e,t,n){let r=Kg(e);return xy(xy([r[Jg.MonthsFormat],r[Jg.MonthsStandalone]],t),n)}function py(e,t){let n=Kg(e)[Jg.Eras];return xy(n,t)}function my(e,t){return xy(Kg(e)[Jg.DateFormat],t)}function hy(e,t){return xy(Kg(e)[Jg.TimeFormat],t)}function gy(e,t){let n=Kg(e)[Jg.DateTimeFormat];return xy(n,t)}function _y(e,t){let n=Kg(e),r=n[Jg.NumberSymbols][t];if(r===void 0){if(t===cy.CurrencyDecimal)return n[Jg.NumberSymbols][cy.Decimal];if(t===cy.CurrencyGroup)return n[Jg.NumberSymbols][cy.Group]}return r}function vy(e){if(!e[Jg.ExtraData])throw new T(2303,!1)}function yy(e){let t=Kg(e);return vy(t),(t[Jg.ExtraData][2]||[]).map(e=>typeof e==`string`?Sy(e):[Sy(e[0]),Sy(e[1])])}function by(e,t,n){let r=Kg(e);return vy(r),xy(xy([r[Jg.ExtraData][0],r[Jg.ExtraData][1]],t)||[],n)||[]}function xy(e,t){for(let n=t;n>-1;n--)if(e[n]!==void 0)return e[n];throw new T(2304,!1)}function Sy(e){let[t,n]=e.split(`:`);return{hours:+t,minutes:+n}}var Cy=/^(\d{4,})-?(\d\d)-?(\d\d)(?:T(\d\d)(?::?(\d\d)(?::?(\d\d)(?:\.(\d+))?)?)?(Z|([+-])(\d\d):?(\d\d))?)?$/,wy=Object.create(null),Ty=/((?:[^BEGHLMOSWYZabcdhmswyz']+)|(?:'(?:[^']|'')*')|(?:G{1,5}|y{1,4}|Y{1,4}|M{1,5}|L{1,5}|w{1,2}|W{1}|d{1,2}|E{1,6}|c{1,6}|a{1,5}|b{1,5}|B{1,5}|h{1,2}|H{1,2}|m{1,2}|s{1,2}|S{1,3}|z{1,4}|Z{1,5}|O{1,4}))([\s\S]*)/,Ey=256;function Dy(e,t,n,r){let i=Xy(e);Oy(t),t=Ay(n,t)||t;let a=[],o;for(;t;)if(o=Ty.exec(t),o){a=a.concat(o.slice(1));let e=a.pop();if(!e)break;t=e}else{a.push(t);break}let s=i.getTimezoneOffset();r&&(s=qy(r,s),i=Yy(i,r));let c=``;return a.forEach(e=>{let t=Ky(e);c+=t?t(i,n,s):e===`''`?`'`:e.replace(/(^'|'$)/g,``).replace(/''/g,`'`)}),c}function Oy(e){if(e.length>Ey)throw new T(2300,!1)}function ky(e,t,n){let r=new Date(0);return r.setFullYear(e,t,n),r.setHours(0,0,0),r}function Ay(e,t){let n=ly(e);if(wy[n]??=Object.create(null),wy[n][t])return wy[n][t];let r=``;switch(t){case`shortDate`:r=my(e,sy.Short);break;case`mediumDate`:r=my(e,sy.Medium);break;case`longDate`:r=my(e,sy.Long);break;case`fullDate`:r=my(e,sy.Full);break;case`shortTime`:r=hy(e,sy.Short);break;case`mediumTime`:r=hy(e,sy.Medium);break;case`longTime`:r=hy(e,sy.Long);break;case`fullTime`:r=hy(e,sy.Full);break;case`short`:let t=Ay(e,`shortTime`),n=Ay(e,`shortDate`);r=jy(gy(e,sy.Short),[t,n]);break;case`medium`:let i=Ay(e,`mediumTime`),a=Ay(e,`mediumDate`);r=jy(gy(e,sy.Medium),[i,a]);break;case`long`:let o=Ay(e,`longTime`),s=Ay(e,`longDate`);r=jy(gy(e,sy.Long),[o,s]);break;case`full`:let c=Ay(e,`fullTime`),l=Ay(e,`fullDate`);r=jy(gy(e,sy.Full),[c,l])}return r&&(wy[n][t]=r),r}function jy(e,t){return t&&(e=e.replace(/\{([^}]+)}/g,function(e,n){return Object.hasOwn(t,n)?t[n]:e})),e}function My(e,t,n=`-`,r,i){let a=``;(e<0||i&&e<=0)&&(i?e=-e+1:(e=-e,a=n));let o=String(e);for(;o.length<t;)o=`0`+o;return r&&(o=o.slice(o.length-t)),a+o}function Ny(e,t){return My(e,3).substring(0,t)}function Py(e,t,n=0,r=!1,i=!1){return function(a,o){let s=Fy(e,a);if((n>0||s>-n)&&(s+=n),e===3)s===0&&n===-12&&(s=12);else if(e===6)return Ny(s,t);let c=_y(o,cy.MinusSign);return My(s,t,c,r,i)}}function Fy(e,t){switch(e){case 0:return t.getFullYear();case 1:return t.getMonth();case 2:return t.getDate();case 3:return t.getHours();case 4:return t.getMinutes();case 5:return t.getSeconds();case 6:return t.getMilliseconds();case 7:return t.getDay();default:throw new T(2301,!1)}}function Iy(e,t,n=ay.Format,r=!1){return function(i,a){return Ly(i,a,e,t,n,r)}}function Ly(e,t,n,r,i,a){switch(n){case 2:return fy(t,i,r)[e.getMonth()];case 1:return dy(t,i,r)[e.getDay()];case 0:let n=e.getHours(),o=e.getMinutes();if(a){let e=yy(t),a=by(t,i,r),s=e.findIndex(e=>{if(Array.isArray(e)){let[t,r]=e,i=n>=t.hours&&o>=t.minutes,a=n<r.hours||n===r.hours&&o<r.minutes;if(t.hours<r.hours){if(i&&a)return!0}else if(i||a)return!0}else if(e.hours===n&&e.minutes===o)return!0;return!1});if(s!==-1)return a[s]}return uy(t,i,r)[n<12?0:1];case 3:return py(t,r)[e.getFullYear()<=0?0:1];default:throw new T(2302,!1)}}function Ry(e){return function(t,n,r){let i=-1*r,a=_y(n,cy.MinusSign),o=i>0?Math.floor(i/60):Math.ceil(i/60);switch(e){case 0:return(i>=0?`+`:``)+My(o,2,a)+My(Math.abs(i%60),2,a);case 1:return`GMT`+(i>=0?`+`:``)+My(o,1,a);case 2:return`GMT`+(i>=0?`+`:``)+My(o,2,a)+`:`+My(Math.abs(i%60),2,a);case 3:return r===0?`Z`:(i>=0?`+`:``)+My(o,2,a)+`:`+My(Math.abs(i%60),2,a);default:throw new T(2310,!1)}}}var zy=0,By=4;function Vy(e){let t=ky(e,zy,1).getDay();return ky(e,0,1+(t<=By?By:11)-t)}function Hy(e){let t=e.getDay(),n=t===0?-3:By-t;return ky(e.getFullYear(),e.getMonth(),e.getDate()+n)}function Uy(e,t=!1){return function(n,r){let i;if(t){let e=new Date(n.getFullYear(),n.getMonth(),1).getDay()-1,t=n.getDate();i=1+Math.floor((t+e)/7)}else{let e=Hy(n),t=Vy(e.getFullYear()),r=e.getTime()-t.getTime();i=1+Math.round(r/6048e5)}return My(i,e,_y(r,cy.MinusSign))}}function Wy(e,t=!1){return function(n,r){return My(Hy(n).getFullYear(),e,_y(r,cy.MinusSign),t)}}var Gy=Object.create(null);function Ky(e){if(Gy[e])return Gy[e];let t;switch(e){case`G`:case`GG`:case`GGG`:t=Iy(3,oy.Abbreviated);break;case`GGGG`:t=Iy(3,oy.Wide);break;case`GGGGG`:t=Iy(3,oy.Narrow);break;case`y`:t=Py(0,1,0,!1,!0);break;case`yy`:t=Py(0,2,0,!0,!0);break;case`yyy`:t=Py(0,3,0,!1,!0);break;case`yyyy`:t=Py(0,4,0,!1,!0);break;case`Y`:t=Wy(1);break;case`YY`:t=Wy(2,!0);break;case`YYY`:t=Wy(3);break;case`YYYY`:t=Wy(4);break;case`M`:case`L`:t=Py(1,1,1);break;case`MM`:case`LL`:t=Py(1,2,1);break;case`MMM`:t=Iy(2,oy.Abbreviated);break;case`MMMM`:t=Iy(2,oy.Wide);break;case`MMMMM`:t=Iy(2,oy.Narrow);break;case`LLL`:t=Iy(2,oy.Abbreviated,ay.Standalone);break;case`LLLL`:t=Iy(2,oy.Wide,ay.Standalone);break;case`LLLLL`:t=Iy(2,oy.Narrow,ay.Standalone);break;case`w`:t=Uy(1);break;case`ww`:t=Uy(2);break;case`W`:t=Uy(1,!0);break;case`d`:t=Py(2,1);break;case`dd`:t=Py(2,2);break;case`c`:case`cc`:t=Py(7,1);break;case`ccc`:t=Iy(1,oy.Abbreviated,ay.Standalone);break;case`cccc`:t=Iy(1,oy.Wide,ay.Standalone);break;case`ccccc`:t=Iy(1,oy.Narrow,ay.Standalone);break;case`cccccc`:t=Iy(1,oy.Short,ay.Standalone);break;case`E`:case`EE`:case`EEE`:t=Iy(1,oy.Abbreviated);break;case`EEEE`:t=Iy(1,oy.Wide);break;case`EEEEE`:t=Iy(1,oy.Narrow);break;case`EEEEEE`:t=Iy(1,oy.Short);break;case`a`:case`aa`:case`aaa`:t=Iy(0,oy.Abbreviated);break;case`aaaa`:t=Iy(0,oy.Wide);break;case`aaaaa`:t=Iy(0,oy.Narrow);break;case`b`:case`bb`:case`bbb`:t=Iy(0,oy.Abbreviated,ay.Standalone,!0);break;case`bbbb`:t=Iy(0,oy.Wide,ay.Standalone,!0);break;case`bbbbb`:t=Iy(0,oy.Narrow,ay.Standalone,!0);break;case`B`:case`BB`:case`BBB`:t=Iy(0,oy.Abbreviated,ay.Format,!0);break;case`BBBB`:t=Iy(0,oy.Wide,ay.Format,!0);break;case`BBBBB`:t=Iy(0,oy.Narrow,ay.Format,!0);break;case`h`:t=Py(3,1,-12);break;case`hh`:t=Py(3,2,-12);break;case`H`:t=Py(3,1);break;case`HH`:t=Py(3,2);break;case`m`:t=Py(4,1);break;case`mm`:t=Py(4,2);break;case`s`:t=Py(5,1);break;case`ss`:t=Py(5,2);break;case`S`:t=Py(6,1);break;case`SS`:t=Py(6,2);break;case`SSS`:t=Py(6,3);break;case`Z`:case`ZZ`:case`ZZZ`:t=Ry(0);break;case`ZZZZZ`:t=Ry(3);break;case`O`:case`OO`:case`OOO`:case`z`:case`zz`:case`zzz`:t=Ry(1);break;case`OOOO`:case`ZZZZ`:case`zzzz`:t=Ry(2);break;default:return null}return Gy[e]=t,t}function qy(e,t){e=e.replace(/:/g,``);let n=Date.parse(`Jan 01, 1970 00:00:00 `+e)/6e4;return isNaN(n)?t:n}function Jy(e,t){return e=new Date(e.getTime()),e.setMinutes(e.getMinutes()+t),e}function Yy(e,t,n){let r=e.getTimezoneOffset();return Jy(e,-1*(qy(t,r)-r))}function Xy(e){if(Qy(e))return e;if(typeof e==`number`&&!isNaN(e))return new Date(e);if(typeof e==`string`){if(e=e.trim(),/^(\d{4}(-\d{1,2}(-\d{1,2})?)?)$/.test(e)){let[t,n=1,r=1]=e.split(`-`).map(e=>+e);return ky(t,n-1,r)}let t=parseFloat(e);if(!isNaN(e-t))return new Date(t);let n;if(n=e.match(Cy))return Zy(n)}let t=new Date(e);if(!Qy(t))throw new T(2311,!1);return t}function Zy(e){let t=new Date(0),n=0,r=0,i=e[8]?t.setUTCFullYear:t.setFullYear,a=e[8]?t.setUTCHours:t.setHours;e[9]&&(n=Number(e[9]+e[10]),r=Number(e[9]+e[11])),i.call(t,Number(e[1]),Number(e[2])-1,Number(e[3]));let o=Number(e[4]||0)-n,s=Number(e[5]||0)-r,c=Number(e[6]||0),l=Math.floor(parseFloat(`0.`+(e[7]||0))*1e3);return a.call(t,o,s,c,l),t}function Qy(e){return e instanceof Date&&!isNaN(e.valueOf())}var $y=(()=>{class e{_viewContainerRef;_viewRef=null;ngTemplateOutletContext=null;ngTemplateOutlet=null;ngTemplateOutletInjector=null;injector=E(xs);constructor(e){this._viewContainerRef=e}ngOnChanges(e){if(this._shouldRecreateView(e)){let e=this._viewContainerRef;if(this._viewRef&&e.remove(e.indexOf(this._viewRef)),!this.ngTemplateOutlet){this._viewRef=null;return}let t=this._createContextForwardProxy();this._viewRef=e.createEmbeddedView(this.ngTemplateOutlet,t,{injector:this._getInjector()})}}_getInjector(){return this.ngTemplateOutletInjector===`outlet`?this.injector:this.ngTemplateOutletInjector??void 0}_shouldRecreateView(e){return!!e.ngTemplateOutlet||!!e.ngTemplateOutletInjector}_createContextForwardProxy(){return new Proxy({},{set:(e,t,n)=>this.ngTemplateOutletContext?Reflect.set(this.ngTemplateOutletContext,t,n):!1,get:(e,t,n)=>{if(this.ngTemplateOutletContext)return Reflect.get(this.ngTemplateOutletContext,t,n)}})}static ɵfac=function(t){return new(t||e)(bm(eh))};static ɵdir=Wh({type:e,selectors:[[``,`ngTemplateOutlet`,``]],inputs:{ngTemplateOutletContext:`ngTemplateOutletContext`,ngTemplateOutlet:`ngTemplateOutlet`,ngTemplateOutletInjector:`ngTemplateOutletInjector`},features:[Ec]})}return e})();function eb(e,t){return new T(2100,!1)}var tb=`mediumDate`,nb=new vi(``),rb=new vi(``),ib=(()=>{class e{locale;defaultTimezone;defaultOptions;constructor(e,t,n){this.locale=e,this.defaultTimezone=t,this.defaultOptions=n}transform(t,n,r,i){if(t==null||t===``||t!==t)return null;try{let e=n??this.defaultOptions?.dateFormat??tb,a=r??this.defaultOptions?.timezone??this.defaultTimezone??void 0;return Dy(t,e,i||this.locale,a)}catch(t){throw eb(e,t.message)}}static ɵfac=function(t){return new(t||e)(bm(bv,16),bm(nb,24),bm(rb,24))};static ɵpipe=Gh({name:`date`,type:e,pure:!0})}return e})(),ab=(()=>{class e{transform(e){return JSON.stringify(e,null,2)}static ɵfac=function(t){return new(t||e)};static ɵpipe=Gh({name:`json`,type:e,pure:!1})}return e})();function ob(e,t){t=encodeURIComponent(t);for(let n of e.split(`;`)){let e=n.indexOf(`=`),[r,i]=e==-1?[n,``]:[n.slice(0,e),n.slice(e+1)];if(r.trim()!==t)continue;let a=i;try{a=decodeURIComponent(i)}catch{}return a.length>1&&a[0]===`"`&&a[a.length-1]===`"`&&(a=a.slice(1,-1)),a}return null}var sb=`browser`,cb=class{_doc;constructor(e){this._doc=e}manager},lb=(()=>{class e extends cb{constructor(e){super(e)}supports(e){return!0}addEventListener(e,t,n,r){return e.addEventListener(t,n,r),()=>this.removeEventListener(e,t,n,r)}removeEventListener(e,t,n,r){return e.removeEventListener(t,n,r)}static ɵfac=function(t){return new(t||e)(qi(Ss))};static ɵprov=di({token:e,factory:e.ɵfac})}return e})(),ub=new vi(``),db=(()=>{class e{_zone;_plugins;_eventNameToPlugin=new Map;constructor(e,t){this._zone=t,e.forEach(e=>{e.manager=this});let n=e.filter(e=>!(e instanceof lb));this._plugins=n.slice().reverse();let r=e.find(e=>e instanceof lb);r&&this._plugins.push(r)}addEventListener(e,t,n,r){return this._findPluginFor(t).addEventListener(e,t,n,r)}getZone(){return this._zone}_findPluginFor(e){let t=this._eventNameToPlugin.get(e);if(t)return t;if(t=this._plugins.find(t=>t.supports(e)),!t)throw new T(-5101,!1);return this._eventNameToPlugin.set(e,t),t}static ɵfac=function(t){return new(t||e)(qi(ub),qi(Fs))};static ɵprov=di({token:e,factory:e.ɵfac})}return e})(),fb=`ng-app-id`;function pb(e){for(let t of e)t.remove()}function mb(e,t){let n=t.createElement(`style`);return n.textContent=e,n}function hb(e,t,n,r){let i=e.head?.querySelectorAll(`style[${fb}="${t}"],link[${fb}="${t}"]`);if(!i||i.length===0)return!1;for(let e of i)e.removeAttribute(fb),e instanceof HTMLLinkElement?r.set(e.href.slice(e.href.lastIndexOf(`/`)+1),{usage:0,elements:[e]}):e.textContent&&n.set(e.textContent,{usage:0,elements:[e]});return!0}function gb(e,t){let n=t.createElement(`link`);return n.setAttribute(`rel`,`stylesheet`),n.setAttribute(`href`,e),n}var _b=(()=>{class e{doc;appId;nonce;inline=new Map;external=new Map;hosts=new Set;constructor(e,t,n,r={}){this.doc=e,this.appId=t,this.nonce=n,hb(e,t,this.inline,this.external)&&this.hosts.add(e.head)}addStyles(e,t){for(let t of e)this.addUsage(t,this.inline,mb);t?.forEach(e=>this.addUsage(e,this.external,gb))}removeStyles(e,t){for(let t of e)this.removeUsage(t,this.inline);t?.forEach(e=>this.removeUsage(e,this.external))}addUsage(e,t,n){let r=t.get(e);r?r.usage++:t.set(e,{usage:1,elements:[...this.hosts].map(t=>this.addElement(t,n(e,this.doc)))})}removeUsage(e,t){let n=t.get(e);n&&(n.usage--,n.usage<=0&&(pb(n.elements),t.delete(e)))}ngOnDestroy(){for(let[,{elements:e}]of[...this.inline,...this.external])pb(e);this.hosts.clear()}addHost(e){if(!this.hosts.has(e)){this.hosts.add(e);for(let[t,{elements:n}]of this.inline)n.push(this.addElement(e,mb(t,this.doc)));for(let[t,{elements:n}]of this.external)n.push(this.addElement(e,gb(t,this.doc)))}}removeHost(e){this.hosts.delete(e);for(let t of[...this.inline.values(),...this.external.values()]){let n=[];for(let r of t.elements)r.parentNode===e?r.remove():n.push(r);t.elements=n}}addElement(e,t){return this.nonce&&t.setAttribute(`nonce`,this.nonce),e.appendChild(t)}static ɵfac=function(t){return new(t||e)(qi(Ss),qi(Zs),qi(tc,8),qi(ec))};static ɵprov=di({token:e,factory:e.ɵfac})}return e})(),vb={svg:`http://www.w3.org/2000/svg`,xhtml:`http://www.w3.org/1999/xhtml`,xlink:`http://www.w3.org/1999/xlink`,xml:`http://www.w3.org/XML/1998/namespace`,xmlns:`http://www.w3.org/2000/xmlns/`,math:`http://www.w3.org/1998/Math/MathML`},yb=/%COMP%/g,bb=`%COMP%`,xb=`_nghost-${bb}`,Sb=`_ngcontent-${bb}`,Cb=!0,wb=new vi(``,{factory:()=>Cb}),Tb=new vi(``);function Eb(e){return Sb.replace(yb,e)}function Db(e){return xb.replace(yb,e)}function Ob(e,t){return t.map(t=>t.replace(yb,e))}var kb=(()=>{class e{eventManager;sharedStylesHost;appId;removeStylesOnCompDestroy;doc;ngZone;nonce;tracingService;rendererByCompId=new Map;defaultRenderer;cssVarNamespace;constructor(e,t,n,r,i,a,o=null,s=null,c=null){this.eventManager=e,this.sharedStylesHost=t,this.appId=n,this.removeStylesOnCompDestroy=r,this.doc=i,this.ngZone=a,this.nonce=o,this.tracingService=s,this.cssVarNamespace=c??``,this.defaultRenderer=new Ab(e,i,a,this.tracingService,this.cssVarNamespace)}createRenderer(e,t){if(!e||!t)return this.defaultRenderer;let n=this.getOrCreateRenderer(e,t);return n instanceof Pb?n.applyToHost(e):n instanceof Nb&&n.applyStyles(),n}getOrCreateRenderer(e,t){let n=this.rendererByCompId,r=n.get(t.id);if(!r){let i=this.doc,a=this.ngZone,o=this.eventManager,s=this.sharedStylesHost,c=this.removeStylesOnCompDestroy,l=this.tracingService;switch(t.encapsulation){case su.Emulated:r=new Pb(o,s,t,this.appId,c,i,a,l,this.cssVarNamespace);break;case su.ShadowDom:return new Mb(o,e,t,i,a,this.nonce,l,this.cssVarNamespace,s);case su.ExperimentalIsolatedShadowDom:return new Mb(o,e,t,i,a,this.nonce,l,this.cssVarNamespace);default:r=new Nb(o,s,t,c,i,a,l,this.cssVarNamespace)}n.set(t.id,r)}return r}ngOnDestroy(){this.rendererByCompId.clear()}componentReplaced(e){this.rendererByCompId.delete(e)}static ɵfac=function(t){return new(t||e)(qi(db),qi(vm),qi(Zs),qi(wb),qi(Ss),qi(Fs),qi(tc),qi(kd,8),qi(Tb,8))};static ɵprov=di({token:e,factory:e.ɵfac})}return e})(),Ab=class{eventManager;doc;ngZone;tracingService;cssVarNamespace;data=Object.create(null);throwOnSyntheticProps=!0;constructor(e,t,n,r,i=``){this.eventManager=e,this.doc=t,this.ngZone=n,this.tracingService=r,this.cssVarNamespace=i}destroy(){}destroyNode=null;createElement(e,t){return t?this.doc.createElementNS(vb[t]||t,e):this.doc.createElement(e)}createComment(e){return this.doc.createComment(e)}createText(e){return this.doc.createTextNode(e)}appendChild(e,t){(jb(e)?e.content:e).appendChild(t)}insertBefore(e,t,n){if(e){let r=jb(e)?e.content:e;if(n!=null&&n.parentNode!==r)throw new T(-5106,!1);r.insertBefore(t,n)}}removeChild(e,t){t.remove()}selectRootElement(e,t){let n=typeof e==`string`?this.doc.querySelector(e):e;if(!n)throw new T(-5104,!1);return t||(n.textContent=``),n}parentNode(e){return e.parentNode}nextSibling(e){return e.nextSibling}setAttribute(e,t,n,r){if(r){t=r+`:`+t;let i=vb[r];i?e.setAttributeNS(i,t,n):e.setAttribute(t,n)}else e.setAttribute(t,n)}removeAttribute(e,t,n){if(n){let r=vb[n];r?e.removeAttributeNS(r,t):e.removeAttribute(`${n}:${t}`)}else e.removeAttribute(t)}addClass(e,t){e.classList.add(t)}removeClass(e,t){e.classList.remove(t)}setStyle(e,t,n,r){let i=t.startsWith(`--`);i&&(t=t.replace(`%NS%`,this.cssVarNamespace)),i||r&(Yu.DashCase|Yu.Important)?e.style.setProperty(t,n,r&Yu.Important?`important`:``):e.style[t]=n}removeStyle(e,t,n){let r=t.startsWith(`--`);r&&(t=t.replace(`%NS%`,this.cssVarNamespace)),r||n&Yu.DashCase?e.style.removeProperty(t):e.style[t]=``}setProperty(e,t,n){e!=null&&(e[t]=n)}setValue(e,t){e.nodeValue=t}listen(e,t,n,r){if(typeof e==`string`&&(e=ny().getGlobalEventTarget(this.doc,e),!e))throw new T(-5102,!1);let i=this.decoratePreventDefault(n);return this.tracingService?.wrapEventListener&&(i=this.tracingService.wrapEventListener(e,t,i)),this.eventManager.addEventListener(e,t,i,r)}decoratePreventDefault(e){return t=>{if(t===`__ngUnwrap__`)return e;e(t)===!1&&t.preventDefault()}}};function jb(e){return e.tagName===`TEMPLATE`&&e.content!==void 0}var Mb=class extends Ab{hostEl;sharedStylesHost;shadowRoot;constructor(e,t,n,r,i,a,o,s,c){super(e,r,i,o,s),this.hostEl=t,this.sharedStylesHost=c,this.shadowRoot=t.attachShadow({mode:`open`}),this.sharedStylesHost&&this.sharedStylesHost.addHost(this.shadowRoot);let l=n.styles;l=Ob(n.id,l).map(e=>e.replace(/%NS%/g,s));for(let e of l){let t=document.createElement(`style`);a&&t.setAttribute(`nonce`,a),t.textContent=e,this.shadowRoot.appendChild(t)}let u=n.getExternalStyles?.();if(u)for(let e of u){let t=gb(e,r);a&&t.setAttribute(`nonce`,a),this.shadowRoot.appendChild(t)}}nodeOrShadowRoot(e){return e===this.hostEl?this.shadowRoot:e}appendChild(e,t){return super.appendChild(this.nodeOrShadowRoot(e),t)}insertBefore(e,t,n){return super.insertBefore(this.nodeOrShadowRoot(e),t,n)}removeChild(e,t){return super.removeChild(null,t)}parentNode(e){return this.nodeOrShadowRoot(super.parentNode(this.nodeOrShadowRoot(e)))}destroy(){this.sharedStylesHost&&this.sharedStylesHost.removeHost(this.shadowRoot)}},Nb=class extends Ab{sharedStylesHost;removeStylesOnCompDestroy;styles;styleUrls;constructor(e,t,n,r,i,a,o,s,c){super(e,i,a,o,s),this.sharedStylesHost=t,this.removeStylesOnCompDestroy=r;let l=n.styles,u=c?Ob(c,l):l;this.styles=u.map(e=>e.replace(/%NS%/g,s)),this.styleUrls=n.getExternalStyles?.(c)}applyStyles(){this.sharedStylesHost.addStyles(this.styles,this.styleUrls)}destroy(){this.removeStylesOnCompDestroy&&ld.size===0&&this.sharedStylesHost.removeStyles(this.styles,this.styleUrls)}},Pb=class extends Nb{contentAttr;hostAttr;constructor(e,t,n,r,i,a,o,s,c){let l=r+`-`+n.id;super(e,t,n,i,a,o,s,c,l),this.contentAttr=Eb(l),this.hostAttr=Db(l)}applyToHost(e){this.applyStyles(),this.setAttribute(e,this.hostAttr,``)}createElement(e,t){let n=super.createElement(e,t);return super.setAttribute(n,this.contentAttr,``),n}},Fb=class e extends iy{supportsDOMEvents=!0;static makeCurrent(){ry(new e)}onAndCancel(e,t,n,r){return e.addEventListener(t,n,r),()=>{e.removeEventListener(t,n,r)}}dispatchEvent(e,t){e.dispatchEvent(t)}remove(e){e.remove()}createElement(e,t){return t||=this.getDefaultDocument(),t.createElement(e)}createHtmlDocument(){return document.implementation.createHTMLDocument(`fakeTitle`)}getDefaultDocument(){return document}isElementNode(e){return e.nodeType===Node.ELEMENT_NODE}isShadowRoot(e){return e instanceof DocumentFragment}getGlobalEventTarget(e,t){return t===`window`?window:t===`document`?e:t===`body`?e.body:null}getBaseHref(e){let t=Lb();return t==null?null:Rb(t)}resetBaseElement(){Ib=null}getUserAgent(){return window.navigator.userAgent}getCookie(e){return ob(document.cookie,e)}},Ib=null;function Lb(){return Ib||=document.head.querySelector(`base`),Ib?Ib.getAttribute(`href`):null}function Rb(e){return new URL(e,document.baseURI).pathname}var zb=[`alt`,`control`,`meta`,`shift`],Bb={"\b":`Backspace`,"	":`Tab`,"":`Delete`,"\x1B":`Escape`,Del:`Delete`,Esc:`Escape`,Left:`ArrowLeft`,Right:`ArrowRight`,Up:`ArrowUp`,Down:`ArrowDown`,Menu:`ContextMenu`,Scroll:`ScrollLock`,Win:`OS`},Vb={alt:e=>e.altKey,control:e=>e.ctrlKey,meta:e=>e.metaKey,shift:e=>e.shiftKey},Hb=(()=>{class e extends cb{constructor(e){super(e)}supports(t){return e.parseEventName(t)!=null}addEventListener(t,n,r,i){let a=e.parseEventName(n),o=e.eventCallback(a.fullKey,r,this.manager.getZone());return this.manager.getZone().runOutsideAngular(()=>ny().onAndCancel(t,a.domEventName,o,i))}static parseEventName(t){let n=t.toLowerCase().split(`.`),r=n.shift();if(n.length===0||r!==`keydown`&&r!==`keyup`)return null;let i=e._normalizeKey(n.pop()),a=``,o=n.indexOf(`code`);if(o>-1&&(n.splice(o,1),a=`code.`),zb.forEach(e=>{let t=n.indexOf(e);t>-1&&(n.splice(t,1),a+=e+`.`)}),a+=i,n.length!=0||i.length===0)return null;let s={};return s.domEventName=r,s.fullKey=a,s}static matchEventFullKeyCode(e,t){let n=Bb[e.key]||e.key,r=``;return t.indexOf(`code.`)>-1&&(n=e.code,r=`code.`),n==null||!n?!1:(n=n.toLowerCase(),n===` `?n=`space`:n===`.`&&(n=`dot`),zb.forEach(t=>{if(t!==n){let n=Vb[t];n(e)&&(r+=t+`.`)}}),r+=n,r===t)}static eventCallback(t,n,r){return i=>{e.matchEventFullKeyCode(i,t)&&r.runGuarded(()=>n(i))}}static _normalizeKey(e){return e===`esc`?`escape`:e}static ɵfac=function(t){return new(t||e)(qi(Ss))};static ɵprov=di({token:e,factory:e.ɵfac})}return e})();async function Ub(e,t,n){return Yv({rootComponent:e,...Wb(t,n)})}function Wb(e,t){return{platformRef:t?.platformRef,appProviders:[...Yb,...e?.providers??[]],platformProviders:Jb}}function Gb(){Fb.makeCurrent()}function Kb(){return new qs}function qb(){return Yl(document),document}var Jb=[{provide:ec,useValue:sb},{provide:$s,useValue:Gb,multi:!0},{provide:Ss,useFactory:qb}],Yb=[{provide:Ta,useValue:`root`},{provide:qs,useFactory:Kb},{provide:ub,useClass:lb,multi:!0},{provide:ub,useClass:Hb,multi:!0},kb,{provide:vm,useClass:_b},{provide:_b,useExisting:vm},db,{provide:$p,useExisting:kb},[]];function Xb(e,t){let n=`\x1B[${e}m`,r=`\x1B[${t}m`;return((e,...t)=>{if(Array.isArray(e)&&`raw`in e){let i=e,a=``;for(let e=0;e<i.length;e++)a+=i[e],e<t.length&&(a+=String(t[e]));return`${n}${a}${r}`}return`${n}${String(e)}${r}`})}var Zb={blue:Xb(34,39),cyan:Xb(36,39),gray:Xb(90,39),green:Xb(32,39),red:Xb(31,39),yellow:Xb(33,39),bold:Xb(1,22),dim:Xb(2,22),reset:Xb(0,0),underline:Xb(4,24)};function Qb(e,...t){return typeof e==`function`?e(...t):e}var $b=Error.captureStackTrace,ex=class e extends Error{name;code;docs;fix;sources;data;get why(){return this.message}constructor(t,n=e){super(t.why,{cause:t.cause}),this.code=this.name=t.code,this.fix=t.fix,this.docs=t.docs,this.sources=t.sources,this.data=t.data,$b?.(this,n)}toJSON(){return{name:this.name,why:this.why,fix:this.fix,docs:this.docs,sources:this.sources,cause:this.cause,data:this.data,stack:this.stack}}};function tx(e,t){return typeof e==`string`?`${e}/${t.toLowerCase()}`:e?.(t)}function nx(e){let t=e.reporters??[],n={},{docsBase:r}=e;for(let i of Object.keys(e.codes)){let a=e.codes[i],o=a.docs===!1?void 0:a.docs||tx(r,i),s=(e={},n={})=>{let r=new ex({code:i,why:Qb(a.why,e),fix:Qb(a.fix,e),docs:o,cause:e.cause,sources:e.sources,data:Qb(a.data,e)},s);for(let e of t)e(r,n);return r};n[i]=s}return n}function rx(e){return t=>{let n=`${e.bold(e.red(`[${t.name}]`))} ${t.message}`,r=[];return t.fix&&r.push(`${e.dim(`fix:`)} ${t.fix}`),t.sources?.length&&r.push(`${e.dim(`sources:`)} ${t.sources.join(`, `)}`),t.docs&&r.push(`${e.dim(`see:`)} ${e.cyan(t.docs)}`),r.length===0?n:[n,...r.map((t,n)=>`${e.dim(n<r.length-1?`├▶`:`╰▶`)} ${t}`)].join(`
`)}}var ix={bus:{agentManifestChanged:`agent:manifest:changed`,agentToolRegistered:`agent:tool:registered`,agentToolUnregistered:`agent:tool:unregistered`,agentResourceRegistered:`agent:resource:registered`,agentResourceUnregistered:`agent:resource:unregistered`},client:{isTrustedUpdated:`rpc:is-trusted:updated`,error:`rpc:error`,connectionStatus:`connection:status`,connectionError:`connection:error`},broadcast:{authRevoked:`devframe:auth:revoked`,clientStateUpdated:`devframe:rpc:client-state:updated`,clientStatePatch:`devframe:rpc:client-state:patch`,streamingChunk:`devframe:streaming:chunk`,streamingEnd:`devframe:streaming:end`,streamingUploadCancel:`devframe:streaming:upload-cancel`},inPageChannel:{panelStateUpdated:`devframe:in-page:panel-state:updated`,panelStatePatch:`devframe:in-page:panel-state:patch`},postMessage:{remoteAssetsError:`devframe:remote-assets-error`,inPageChannel:`devframe:in-page-channel`}},ax=rx(Zb);function ox(e,{method:t=`warn`}={}){console[t](ax(e))}function sx(e){return nx({...e,reporters:[ox,...e.reporters??[]]})}function cx(){let e,t;return{promise:new Promise((n,r)=>{e=n,t=r}),resolve:e,reject:t}}var lx=Math.random.bind(Math),ux=`useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict`;function dx(e=21){let t=``,n=e;for(;n--;)t+=ux[lx()*64|0];return t}var fx=6e4,px=e=>e,mx=px,{clearTimeout:hx,setTimeout:gx}=globalThis;function _x(e,t){let{post:n,on:r,off:i=()=>{},eventNames:a=[],serialize:o=px,deserialize:s=mx,resolver:c,bind:l=`rpc`,timeout:u=fx,proxify:d=!0}=t,f=!1,p=new Map,m,h;async function g(e,r,i,a){if(f)throw Error(`[birpc] rpc is closed, cannot call "${e}"`);let s={m:e,a:r,t:`q`};a&&(s.o=!0);let c=async e=>n(o(e));if(i){await c(s);return}if(m)try{await m}finally{m=void 0}let{promise:l,resolve:d,reject:g}=cx(),_=dx();s.i=_;let ee;async function v(n=s){return u>=0&&(ee=gx(()=>{try{if(t.onTimeoutError?.call(h,e,r)!==!0)throw Error(`[birpc] timeout on calling "${e}"`)}catch(e){g(e)}p.delete(_)},u),typeof ee==`object`&&(ee=ee.unref?.())),p.set(_,{resolve:d,reject:g,timeoutId:ee,method:e}),await c(n),l}try{t.onRequest?await t.onRequest.call(h,s,v,d):await v()}catch(e){if(t.onGeneralError?.call(h,e)!==!0)throw e;return}finally{hx(ee),p.delete(_)}return l}let _={$call:(e,...t)=>g(e,t,!1),$callOptional:(e,...t)=>g(e,t,!1,!0),$callEvent:(e,...t)=>g(e,t,!0),$callRaw:e=>g(e.method,e.args,e.event,e.optional),$rejectPendingCalls:v,get $closed(){return f},get $meta(){return t.meta},$close:ee,$functions:e};h=d?new Proxy({},{get(t,n){if(Object.hasOwn(_,n))return _[n];if(n===`then`&&!a.includes(`then`)&&!(`then`in e))return;let r=(...e)=>g(n,e,!0);if(a.includes(n))return r.asEvent=r,r;let i=(...e)=>g(n,e,!1);return i.asEvent=r,i}}):_;function ee(e){f=!0,p.forEach(({reject:t,method:n})=>{let r=Error(`[birpc] rpc is closed, cannot call "${n}"`);if(e)return e.cause??=r,t(e);t(r)}),p.clear(),i(te)}function v(e){let t=Array.from(p.values()).map(({method:t,reject:n})=>e?e({method:t,reject:n}):n(Error(`[birpc]: rejected pending call "${t}".`)));return p.clear(),t}async function te(r,...i){let a;try{a=s(r)}catch(e){if(t.onGeneralError?.call(h,e)!==!0)throw e;return}if(a.t===`q`){let{m:r,a:s,o:u}=a,d,f,p=await(c?c.call(h,r,e[r]):e[r]);if(u&&(p||=()=>void 0),!p)f=Error(`[birpc] function "${r}" not found`);else try{d=await p.apply(l===`rpc`?h:e,s)}catch(e){f=e}if(a.i){if(f&&t.onFunctionError&&t.onFunctionError.call(h,f,r,s)===!0)return;if(!f)try{await n(o({t:`s`,i:a.i,r:d}),...i);return}catch(e){if(f=e,t.onGeneralError?.call(h,e,r,s)!==!0)throw e}try{await n(o({t:`s`,i:a.i,e:f}),...i)}catch(e){if(t.onGeneralError?.call(h,e,r,s)!==!0)throw e}}}else{let{i:e,r:t,e:n}=a,r=p.get(e);r&&(hx(r.timeoutId),n?r.reject(n):r.resolve(t)),p.delete(e)}}return m=r(te),h}function vx(e,t){return t.safety?t.safety:e===`static`||e===`query`||e==null?`read`:`action`}var yx=Object.freeze({type:`object`,additionalProperties:!0});function bx(e){let t=e[`~standard`];if(t.jsonSchema)try{return t.jsonSchema.input({target:`draft-2020-12`})}catch{return yx}return yx}function xx(e){if(!e||e.length===0)return{type:`object`,properties:{}};let t={},n=[];for(let r=0;r<e.length;r++){let i=`arg${r}`;t[i]=bx(e[r]),n.push(i)}return{type:`object`,properties:t,required:n,additionalProperties:!1}}function Sx(e,t){if(Array.isArray(e))return e;if(e==null)return[];if(typeof e!=`object`)return;let n=e;if(t!=null)return Array.from({length:t},(e,t)=>n[`arg${t}`]);if(`arg0`in n){let e=[];for(;`arg${e.length}`in n;)e.push(n[`arg${e.length}`]);return e}return Object.keys(n).length===0?[]:void 0}function Cx(e,t){return Sx(e,t)??[e]}function wx(e){return typeof e==`string`?`'${e}'`:new Ox().serialize(e)}var Tx=` _-,;:!?.'"()[]{}@*/\\&#%\`^+<=>|~$0123456789abcdefghijklmnopqrstuvwxyz`,Ex=(function(){let e=new Uint8Array(128);for(let t=0;t<69;t++)e[Tx.charCodeAt(t)]=t+1;for(let t=65;t<=90;t++)e[t]=e[t+32];return e})();function Dx(e,t){if(e===t)return 0;let n=Math.min(e.length,t.length),r=0;for(let i=0;i<n;i++){let n=e.charCodeAt(i),a=t.charCodeAt(i);if(n===a)continue;let o=n<128&&Ex[n]?Ex[n]:n+128,s=a<128&&Ex[a]?Ex[a]:a+128;if(o!==s)return o<s?-1:1;r===0&&(r=n>a?-1:1)}return e.length===t.length?r:e.length<t.length?-1:1}var Ox=(function(){class e{#e=new Map;compare(e,t){let n=typeof e,r=typeof t;return n===`string`&&r===`string`?Dx(e,t):n===`number`&&r===`number`?e-t:Dx(this.serialize(e,!0),this.serialize(t,!0))}serialize(e,t){if(e===null)return`null`;switch(typeof e){case`string`:return t?e:`'${e}'`;case`bigint`:return`${e}n`;case`object`:return this.$object(e);case`function`:return this.$function(e)}return String(e)}serializeObject(e){let t=Object.prototype.toString.call(e);if(t!==`[object Object]`)return this.serializeBuiltInType(t.length<10?`unknown:${t}`:t.slice(8,-1),e);let n=e.constructor,r=n===Object||n===void 0?``:n.name;if(r!==``&&globalThis[r]===n)return this.serializeBuiltInType(r,e);if(`toJSON`in e&&typeof e.toJSON==`function`){let t=e.toJSON();return r+(typeof t==`object`&&t?this.$object(t):`(${this.serialize(t)})`)}let i=Object.keys(e).sort(Dx),a=`${r}{`;for(let t=0;t<i.length;t++){let n=i[t];a+=`${n}:${this.serialize(e[n])}`,t<i.length-1&&(a+=`,`)}return a+`}`}serializeBuiltInType(e,t){let n=this[`$`+e];if(n)return n.call(this,t);if(typeof t.entries==`function`)return this.serializeObjectEntries(e,t.entries());throw Error(`Cannot serialize ${e}`)}serializeObjectEntries(e,t){let n=Array.from(t).sort((e,t)=>this.compare(e[0],t[0])),r=`${e}{`;for(let e=0;e<n.length;e++){let[t,i]=n[e];r+=`${this.serialize(t,!0)}:${this.serialize(i)}`,e<n.length-1&&(r+=`,`)}return r+`}`}$object(e){let t=this.#e.get(e);return t===void 0&&(this.#e.set(e,`#${this.#e.size}`),t=this.serializeObject(e),this.#e.set(e,t)),t}$function(e){let t=Function.prototype.toString.call(e);return t.slice(-15)===`[native code] }`?`${e.name||``}()[native]`:`${e.name}(${e.length})${t.replace(/\s*\n\s*/g,``)}`}$Array(e){let t=`[`;for(let n=0;n<e.length;n++)t+=this.serialize(e[n]),n<e.length-1&&(t+=`,`);return t+`]`}$Date(e){try{return`Date(${e.toISOString()})`}catch{return`Date(null)`}}$ArrayBuffer(e){return`ArrayBuffer[${new Uint8Array(e).join(`,`)}]`}$Set(e){return`Set${this.$Array(Array.from(e).sort((e,t)=>this.compare(e,t)))}`}$Map(e){return this.serializeObjectEntries(`Map`,e.entries())}}for(let t of[`Error`,`RegExp`,`URL`])e.prototype[`$`+t]=function(e){return`${t}(${e})`};for(let t of[`Int8Array`,`Uint8Array`,`Uint8ClampedArray`,`Int16Array`,`Uint16Array`,`Int32Array`,`Uint32Array`,`Float32Array`,`Float64Array`])e.prototype[`$`+t]=function(e){return`${t}[${e.join(`,`)}]`};for(let t of[`BigInt64Array`,`BigUint64Array`])e.prototype[`$`+t]=function(e){return`${t}[${e.join(`n,`)}${e.length>0?`n`:``}]`};return e})(),kx=[1779033703,-1150833019,1013904242,-1521486534,1359893119,-1694144372,528734635,1541459225],Ax=[1116352408,1899447441,-1245643825,-373957723,961987163,1508970993,-1841331548,-1424204075,-670586216,310598401,607225278,1426881987,1925078388,-2132889090,-1680079193,-1046744716,-459576895,-272742522,264347078,604807628,770255983,1249150122,1555081692,1996064986,-1740746414,-1473132947,-1341970488,-1084653625,-958395405,-710438585,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,-2117940946,-1838011259,-1564481375,-1474664885,-1035236496,-949202525,-778901479,-694614492,-200395387,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,-2067236844,-1933114872,-1866530822,-1538233109,-1090935817,-965641998],jx=`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_`,Mx=[],Nx=class{_data=new Px;_hash=new Px([...kx]);_nDataBytes=0;_minBufferSize=0;finalize(e){e&&this._append(e);let t=this._nDataBytes*8,n=this._data.sigBytes*8;return this._data.words[n>>>5]|=128<<24-n%32,this._data.words[(n+64>>>9<<4)+14]=Math.floor(t/4294967296),this._data.words[(n+64>>>9<<4)+15]=t,this._data.sigBytes=this._data.words.length*4,this._process(),this._hash}_doProcessBlock(e,t){let n=this._hash.words,r=n[0],i=n[1],a=n[2],o=n[3],s=n[4],c=n[5],l=n[6],u=n[7];for(let n=0;n<64;n++){if(n<16)Mx[n]=e[t+n]|0;else{let e=Mx[n-15],t=(e<<25|e>>>7)^(e<<14|e>>>18)^e>>>3,r=Mx[n-2],i=(r<<15|r>>>17)^(r<<13|r>>>19)^r>>>10;Mx[n]=t+Mx[n-7]+i+Mx[n-16]}let d=s&c^~s&l,f=r&i^r&a^i&a,p=(r<<30|r>>>2)^(r<<19|r>>>13)^(r<<10|r>>>22),m=(s<<26|s>>>6)^(s<<21|s>>>11)^(s<<7|s>>>25),h=u+m+d+Ax[n]+Mx[n],g=p+f;u=l,l=c,c=s,s=o+h|0,o=a,a=i,i=r,r=h+g|0}n[0]=n[0]+r|0,n[1]=n[1]+i|0,n[2]=n[2]+a|0,n[3]=n[3]+o|0,n[4]=n[4]+s|0,n[5]=n[5]+c|0,n[6]=n[6]+l|0,n[7]=n[7]+u|0}_append(e){typeof e==`string`&&(e=Px.fromUtf8(e)),this._data.concat(e),this._nDataBytes+=e.sigBytes}_process(e){let t,n=this._data.sigBytes/64;n=e?Math.ceil(n):Math.max((n|0)-this._minBufferSize,0);let r=n*16,i=Math.min(r*4,this._data.sigBytes);if(r){for(let e=0;e<r;e+=16)this._doProcessBlock(this._data.words,e);t=this._data.words.splice(0,r),this._data.sigBytes-=i}return new Px(t,i)}},Px=class e{words;sigBytes;constructor(e,t){e=this.words=e||[],this.sigBytes=t===void 0?e.length*4:t}static fromUtf8(t){let n=unescape(encodeURIComponent(t)),r=n.length,i=[];for(let e=0;e<r;e++)i[e>>>2]|=(n.charCodeAt(e)&255)<<24-e%4*8;return new e(i,r)}toBase64(){let e=[];for(let t=0;t<this.sigBytes;t+=3){let n=this.words[t>>>2]>>>24-t%4*8&255,r=this.words[t+1>>>2]>>>24-(t+1)%4*8&255,i=this.words[t+2>>>2]>>>24-(t+2)%4*8&255,a=n<<16|r<<8|i;for(let n=0;n<4&&t*8+n*6<this.sigBytes*8;n++)e.push(jx.charAt(a>>>6*(3-n)&63))}return e.join(``)}concat(e){if(this.words[this.sigBytes>>>2]&=4294967295<<32-this.sigBytes%4*8,this.words.length=Math.ceil(this.sigBytes/4),this.sigBytes%4)for(let t=0;t<e.sigBytes;t++){let n=e.words[t>>>2]>>>24-t%4*8&255;this.words[this.sigBytes+t>>>2]|=n<<24-(this.sigBytes+t)%4*8}else for(let t=0;t<e.sigBytes;t+=4)this.words[this.sigBytes+t>>>2]=e.words[t>>>2];this.sigBytes+=e.sigBytes}};function Fx(e){return new Nx().finalize(e).toBase64()}function Ix(e){return Fx(wx(e))}function Lx(e){return Ix(e)}function Rx(){let e={};function t(t,...n){let r=e[t]||[];for(let e=0,t=r.length;e<t;e++){let t=r[e];t&&t(...n)}}function n(n,...r){t(n,...r),delete e[n]}function r(t,n){return(e[t]||=[]).push(n),()=>{e[t]=e[t]?.filter(e=>n!==e)}}function i(e,t){let n=r(e,((...e)=>(n(),t(...e))));return n}return{_listeners:e,emit:t,emitOnce:n,on:r,once:i}}var zx=/^[\w+.-]{2,}:\/\//;function Bx(e){return e.endsWith(`/`)?e:`${e}/`}function Vx(e){return(e.endsWith(`/`)?e.slice(0,-1):e)||`/`}function Hx(e,...t){let n=e;for(let e of t)e&&e!==`/`&&(n=n?Bx(n)+e.replace(/^\.?\//,``):e);return n}function Ux(e,t){if(!t||t===`/`||zx.test(e))return e;let n=Vx(t);return e.startsWith(n)?e:Hx(n,e)}function Wx(e,t){let n=e.match(zx);return t+(n?e.slice(n[0].length):e)}var Gx=`useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict`;function Kx(e=21){let t=``,n=e;for(;n--;)t+=Gx[Math.random()*64|0];return t}var qx=Symbol.for(`immer-nothing`),Jx=Symbol.for(`immer-draftable`),Yx=Symbol.for(`immer-state`),Xx=[function(e){return`The plugin for '${e}' has not been loaded into Immer. To enable the plugin, import and call \`enable${e}()\` when initializing your application.`},function(e){return`produce can only be called on things that are draftable: plain objects, arrays, Map, Set or classes that are marked with '[immerable]: true'. Got '${e}'`},`This object has been frozen and should not be mutated`,function(e){return`Cannot use a proxy that has been revoked. Did you pass an object from inside an immer function to an async process? `+e},`An immer producer returned a new value *and* modified its draft. Either return a new value *or* modify the draft.`,`Immer forbids circular references`,"The first or second argument to `produce` must be a function","The third argument to `produce` must be a function or undefined","First argument to `createDraft` must be a plain object, an array, or an immerable object","First argument to `finishDraft` must be a draft returned by `createDraft`",function(e){return`'current' expects a draft, got: ${e}`},`Object.defineProperty() cannot be used on an Immer draft`,`Object.setPrototypeOf() cannot be used on an Immer draft`,`Immer only supports deleting array indices`,`Immer only supports setting array indices and the 'length' property`,function(e){return`'original' expects a draft, got: ${e}`}];function Zx(e,...t){{let n=Xx[e],r=xS(n)?n.apply(null,t):n;throw Error(`[Immer] ${r}`)}}var Qx=Object,$x=Qx.getPrototypeOf,eS=`constructor`,tS=`prototype`,nS=`configurable`,rS=`enumerable`,iS=`writable`,aS=`value`,oS=e=>!!e&&!!e[Yx];function sS(e){return e?uS(e)||_S(e)||!!e[Jx]||!!e[eS]?.[Jx]||vS(e)||yS(e):!1}var cS=Qx[tS][eS].toString(),lS=new WeakMap;function uS(e){if(!e||!bS(e))return!1;let t=$x(e);if(t===null||t===Qx[tS])return!0;let n=Qx.hasOwnProperty.call(t,eS)&&t[eS];if(n===Object)return!0;if(!xS(n))return!1;let r=lS.get(n);return r===void 0&&(r=Function.toString.call(n),lS.set(n,r)),r===cS}function dS(e,t,n=!0){fS(e)===0?(n?Reflect.ownKeys(e):Qx.keys(e)).forEach(n=>{t(n,e[n],e)}):e.forEach((n,r)=>t(r,n,e))}function fS(e){let t=e[Yx];return t?t.type_:_S(e)?1:vS(e)?2:yS(e)?3:0}var pS=(e,t,n=fS(e))=>n===2?e.has(t):Qx[tS].hasOwnProperty.call(e,t),mS=(e,t,n=fS(e))=>n===2?e.get(t):e[t],hS=(e,t,n,r=fS(e))=>{r===2?e.set(t,n):r===3?e.add(n):e[t]=n};function gS(e,t){return e===t?e!==0||1/e==1/t:e!==e&&t!==t}var _S=Array.isArray,vS=e=>e instanceof Map,yS=e=>e instanceof Set,bS=e=>typeof e==`object`,xS=e=>typeof e==`function`,SS=e=>typeof e==`boolean`;function CS(e){let t=+e;return Number.isInteger(t)&&String(t)===e}var wS=e=>bS(e)?e?.[Yx]:null,TS=e=>e.copy_||e.base_,ES=e=>e.modified_?e.copy_:e.base_;function DS(e,t){if(vS(e))return new Map(e);if(yS(e))return new Set(e);if(_S(e))return Array[tS].slice.call(e);let n=uS(e);if(t===!0||t===`class_only`&&!n){let t=Qx.getOwnPropertyDescriptors(e);delete t[Yx];let n=Reflect.ownKeys(t);for(let r=0;r<n.length;r++){let i=n[r],a=t[i];a[iS]===!1&&(a[iS]=!0,a[nS]=!0),(a.get||a.set)&&(t[i]={[nS]:!0,[iS]:!0,[rS]:a[rS],[aS]:e[i]})}return Qx.create($x(e),t)}{let t=$x(e);if(t!==null&&n)return{...e};let r=Qx.create(t);return Qx.assign(r,e)}}function OS(e,t=!1){return jS(e)||oS(e)||!sS(e)?e:(fS(e)>1&&Qx.defineProperties(e,{set:AS,add:AS,clear:AS,delete:AS}),Qx.freeze(e),t&&dS(e,(e,t)=>{OS(t,!0)},!1),e)}function kS(){Zx(2)}var AS={[aS]:kS};function jS(e){return e===null||!bS(e)||Qx.isFrozen(e)}var MS=`MapSet`,NS=`Patches`,PS=`ArrayMethods`,FS={};function IS(e){let t=FS[e];return t||Zx(0,e),t}var LS=e=>!!FS[e];function RS(e,t){FS[e]||(FS[e]=t)}var zS,BS=()=>zS,VS=(e,t)=>({drafts_:[],parent_:e,immer_:t,canAutoFreeze_:!0,unfinalizedDrafts_:0,handledSet_:new Set,processedForPatches_:new Set,mapSetPlugin_:LS(MS)?IS(MS):void 0,arrayMethodsPlugin_:LS(PS)?IS(PS):void 0});function HS(e,t){t&&(e.patchPlugin_=IS(NS),e.patches_=[],e.inversePatches_=[],e.patchListener_=t)}function US(e){WS(e),e.drafts_.forEach(KS),e.drafts_=null}function WS(e){e===zS&&(zS=e.parent_)}var GS=e=>zS=VS(zS,e);function KS(e){let t=e[Yx];t.type_===0||t.type_===1?t.revoke_():t.revoked_=!0}function qS(e,t){t.unfinalizedDrafts_=t.drafts_.length;let n=t.drafts_[0];if(e!==void 0&&e!==n){n[Yx].modified_&&(US(t),Zx(4)),sS(e)&&(e=JS(t,e));let{patchPlugin_:r}=t;r&&r.generateReplacementPatches_(n[Yx].base_,e,t)}else e=JS(t,n);return YS(t,e,!0),US(t),t.patches_&&t.patchListener_(t.patches_,t.inversePatches_),e===qx?void 0:e}function JS(e,t){if(jS(t))return t;let n=t[Yx];if(!n)return rC(t,e.handledSet_,e);if(!ZS(n,e))return t;if(!n.modified_)return n.base_;if(!n.finalized_){let{callbacks_:t}=n;if(t)for(;t.length>0;)t.pop()(e);tC(n,e)}return n.copy_}function YS(e,t,n=!1){!e.parent_&&e.immer_.autoFreeze_&&e.canAutoFreeze_&&OS(t,n)}function XS(e){e.finalized_=!0,e.scope_.unfinalizedDrafts_--}var ZS=(e,t)=>e.scope_===t,QS=[];function $S(e,t,n,r){let i=TS(e),a=e.type_;if(r!==void 0&&mS(i,r,a)===t){hS(i,r,n,a);return}if(!e.draftLocations_){let t=e.draftLocations_=new Map;dS(i,(e,n)=>{if(oS(n)){let r=t.get(n)||[];r.push(e),t.set(n,r)}})}let o=e.draftLocations_.get(t)??QS;for(let e of o)hS(i,e,n,a)}function eC(e,t,n){e.callbacks_.push(function(r){let i=t;if(!i||!ZS(i,r))return;r.mapSetPlugin_?.fixSetContents(i);let a=ES(i);$S(e,i.draft_??i,a,n),tC(i,r)})}function tC(e,t){if(e.modified_&&!e.finalized_&&(e.type_===3||e.type_===1&&e.allIndicesReassigned_||(e.assigned_?.size??0)>0)){let{patchPlugin_:n}=t;if(n){let r=n.getPath(e);r&&n.generatePatches_(e,r,t)}XS(e)}}function nC(e,t,n){let{scope_:r}=e;if(oS(n)){let i=n[Yx];ZS(i,r)&&i.callbacks_.push(function(){fC(e),$S(e,n,ES(i),t)})}else sS(n)&&e.callbacks_.push(function(){let i=TS(e);e.type_===3?i.has(n)&&rC(n,r.handledSet_,r):mS(i,t,e.type_)===n&&r.drafts_.length>1&&(e.assigned_.get(t)??!1)===!0&&e.copy_&&rC(mS(e.copy_,t,e.type_),r.handledSet_,r)})}function rC(e,t,n){return!n.immer_.autoFreeze_&&n.unfinalizedDrafts_<1||oS(e)||t.has(e)||!sS(e)||jS(e)?e:(t.add(e),dS(e,(r,i)=>{if(oS(i)){let t=i[Yx];ZS(t,n)&&(hS(e,r,ES(t),e.type_),XS(t))}else sS(i)&&rC(i,t,n)}),e)}function iC(e,t){let n=_S(e),r={type_:+!!n,scope_:t?t.scope_:BS(),modified_:!1,finalized_:!1,assigned_:void 0,parent_:t,base_:e,draft_:null,copy_:null,revoke_:null,isManual_:!1,callbacks_:void 0},i=r,a=aC;n&&(i=[r],a=oC);let{revoke:o,proxy:s}=Proxy.revocable(i,a);return r.draft_=s,r.revoke_=o,[s,r]}var aC={get(e,t){if(t===Yx)return e;let n=e.scope_.arrayMethodsPlugin_,r=e.type_===1&&typeof t==`string`;if(r&&n?.isArrayOperationMethod(t))return n.createMethodInterceptor(e,t);let i=TS(e);if(!pS(i,t,e.type_))return lC(e,i,t);let a=i[t];if(e.finalized_||!sS(a)||r&&e.operationMethod&&n?.isMutatingArrayMethod(e.operationMethod)&&CS(t))return a;if(a===sC(e.base_,t)||cC(e,t,a)){fC(e);let n=e.type_===1?+t:t,r=mC(e.scope_,a,e,n);return e.copy_[n]=r}return a},has(e,t){return t in TS(e)},ownKeys(e){return Reflect.ownKeys(TS(e))},set(e,t,n){let r=uC(TS(e),t);if(r?.set)return r.set.call(e.draft_,n),!0;if(!e.modified_){let r=sC(TS(e),t),i=r?.[Yx];if(i&&i.base_===n)return e.copy_[t]=n,e.assigned_.delete(t),!0;if(gS(n,r)&&(n!==void 0||pS(e.base_,t,e.type_)))return!0;fC(e),dC(e)}return e.copy_[t]===n&&(n!==void 0||pS(e.copy_,t,e.type_))||Number.isNaN(n)&&Number.isNaN(e.copy_[t])?!0:(e.copy_[t]=n,e.assigned_.set(t,!0),nC(e,t,n),!0)},deleteProperty(e,t){return fC(e),sC(e.base_,t)!==void 0||t in e.base_?(e.assigned_.set(t,!1),dC(e)):e.assigned_.delete(t),e.copy_&&delete e.copy_[t],!0},getOwnPropertyDescriptor(e,t){let n=TS(e),r=Reflect.getOwnPropertyDescriptor(n,t);return r&&{[iS]:!0,[nS]:e.type_!==1||t!==`length`,[rS]:r[rS],[aS]:n[t]}},defineProperty(){Zx(11)},getPrototypeOf(e){return $x(e.base_)},setPrototypeOf(){Zx(12)}},oC={};for(let e in aC){let t=aC[e];oC[e]=function(){let e=arguments;return e[0]=e[0][0],t.apply(this,e)}}oC.deleteProperty=function(e,t){return isNaN(parseInt(t))&&Zx(13),oC.set.call(this,e,t,void 0)},oC.set=function(e,t,n){return t!==`length`&&isNaN(parseInt(t))&&Zx(14),aC.set.call(this,e[0],t,n,e[0])};function sC(e,t){let n=e[Yx];return(n?TS(n):e)[t]}function cC(e,t,n){return e.type_!==1||!e.allIndicesReassigned_||e.assigned_?.get(t)||!sS(n)||n[Yx]?!1:e.baseRefs_.has(n)}function lC(e,t,n){let r=uC(t,n);return r?aS in r?r[aS]:r.get?.call(e.draft_):void 0}function uC(e,t){if(!(t in e))return;let n=$x(e);for(;n;){let e=Object.getOwnPropertyDescriptor(n,t);if(e)return e;n=$x(n)}}function dC(e){e.modified_||(e.modified_=!0,e.parent_&&dC(e.parent_))}function fC(e){e.copy_||=(e.assigned_=new Map,DS(e.base_,e.scope_.immer_.useStrictShallowCopy_))}var pC=class{constructor(e){this.autoFreeze_=!0,this.useStrictShallowCopy_=!1,this.useStrictIteration_=!1,this.produce=(e,t,n)=>{if(xS(e)&&!xS(t)){let n=t;t=e;let r=this;return function(e=n,...i){return r.produce(e,e=>t.call(this,e,...i))}}xS(t)||Zx(6),n!==void 0&&!xS(n)&&Zx(7);let r;if(sS(e)){let i=GS(this),a=mC(i,e,void 0),o=!0;try{r=t(a),o=!1}finally{o?US(i):WS(i)}return HS(i,n),qS(r,i)}if(!e||!bS(e)){if(r=t(e),r===void 0&&(r=e),r===qx&&(r=void 0),this.autoFreeze_&&OS(r,!0),n){let t=[],i=[];IS(NS).generateReplacementPatches_(e,r,{patches_:t,inversePatches_:i}),n(t,i)}return r}Zx(1,e)},this.produceWithPatches=(e,t)=>{if(xS(e))return(t,...n)=>this.produceWithPatches(t,t=>e(t,...n));let n,r;return[this.produce(e,t,(e,t)=>{n=e,r=t}),n,r]},SS(e?.autoFreeze)&&this.setAutoFreeze(e.autoFreeze),SS(e?.useStrictShallowCopy)&&this.setUseStrictShallowCopy(e.useStrictShallowCopy),SS(e?.useStrictIteration)&&this.setUseStrictIteration(e.useStrictIteration)}createDraft(e){sS(e)||Zx(8),oS(e)&&(e=hC(e));let t=GS(this),n=mC(t,e,void 0);return n[Yx].isManual_=!0,WS(t),n}finishDraft(e,t){let n=e&&e[Yx];(!n||!n.isManual_)&&Zx(9);let{scope_:r}=n;return HS(r,t),qS(void 0,r)}setAutoFreeze(e){this.autoFreeze_=e}setUseStrictShallowCopy(e){this.useStrictShallowCopy_=e}setUseStrictIteration(e){this.useStrictIteration_=e}shouldUseStrictIteration(){return this.useStrictIteration_}applyPatches(e,t){let n;for(n=t.length-1;n>=0;n--){let r=t[n];if(r.path.length===0&&r.op===`replace`){e=r.value;break}}n>-1&&(t=t.slice(n+1));let r=IS(NS).applyPatches_;return oS(e)?r(e,t):this.produce(e,e=>r(e,t))}};function mC(e,t,n,r){let[i,a]=vS(t)?IS(MS).proxyMap_(t,n):yS(t)?IS(MS).proxySet_(t,n):iC(t,n);return(n?.scope_??BS()).drafts_.push(i),a.callbacks_=n?.callbacks_??[],a.key_=r,n&&r!==void 0?eC(n,a,r):a.callbacks_.push(function(e){e.mapSetPlugin_?.fixSetContents(a);let{patchPlugin_:t}=e;a.modified_&&t&&t.generatePatches_(a,[],e)}),i}function hC(e){return oS(e)||Zx(10,e),gC(e)}function gC(e){if(!sS(e)||jS(e))return e;let t=e[Yx],n,r=!0;if(t){if(!t.modified_)return t.base_;t.finalized_=!0,n=DS(e,t.scope_.immer_.useStrictShallowCopy_),r=t.scope_.immer_.shouldUseStrictIteration()}else n=DS(e,!0);return dS(n,(e,t)=>{hS(n,e,gC(t))},r),t&&(t.finalized_=!1),n}function _C(){Xx.push(`Sets cannot have "replace" patches.`,function(e){return`Unsupported patch operation: `+e},function(e){return`Cannot apply patch, path doesn't resolve: `+e},`Patching reserved attributes like __proto__, prototype and constructor is not allowed`);function e(n,r=[]){if(n.key_!==void 0){let e=n.parent_.copy_??n.parent_.base_,t=wS(mS(e,n.key_)),i=mS(e,n.key_);if(i===void 0||i!==n.draft_&&i!==n.base_&&i!==n.copy_||t!=null&&t.base_!==n.base_)return null;let a=n.parent_.type_===3,o;if(a){let e=n.parent_;o=Array.from(e.drafts_.keys()).indexOf(n.key_)}else o=n.key_;if(!(a&&e.size>o||pS(e,o)))return null;r.push(o)}if(n.parent_)return e(n.parent_,r);r.reverse();try{t(n.copy_,r)}catch{return null}return r}function t(e,t){let n=e;for(let e=0;e<t.length-1;e++){let r=t[e];if(n=mS(n,r),!bS(n)||n===null)throw Error(`Cannot resolve path at '${t.join(`/`)}'`)}return n}let n=`replace`,r=`remove`;function i(e,t,n){if(e.scope_.processedForPatches_.has(e))return;e.scope_.processedForPatches_.add(e);let{patches_:r,inversePatches_:i}=n;switch(e.type_){case 0:case 2:return o(e,t,r,i);case 1:return a(e,t,r,i);case 3:return s(e,t,r,i)}}function a(e,t,i,a){let{base_:o,assigned_:s}=e,c=e.copy_;c.length<o.length&&([o,c]=[c,o],[i,a]=[a,i]);let l=e.allIndicesReassigned_===!0;for(let e=0;e<o.length;e++){let r=c[e],u=o[e];if((l||s?.get(e.toString()))&&r!==u){let o=r?.[Yx];if(o&&o.modified_)continue;let s=t.concat([e]);i.push({op:n,path:s,value:d(r)}),a.push({op:n,path:s,value:d(u)})}}for(let e=o.length;e<c.length;e++){let n=t.concat([e]);i.push({op:`add`,path:n,value:d(c[e])})}for(let e=c.length-1;o.length<=e;--e){let n=t.concat([e]);a.push({op:r,path:n})}}function o(e,t,i,a){let{base_:o,copy_:s,type_:c}=e;dS(e.assigned_,(e,l)=>{let u=mS(o,e,c),f=mS(s,e,c),p=l?pS(o,e)?n:`add`:r;if(u===f&&p===n)return;let m=t.concat(e);i.push(p===r?{op:p,path:m}:{op:p,path:m,value:d(f)}),a.push(p===`add`?{op:r,path:m}:p===r?{op:`add`,path:m,value:d(u)}:{op:n,path:m,value:d(u)})})}function s(e,t,n,i){let{base_:a,copy_:o}=e,s=0;a.forEach(e=>{if(!o.has(e)){let a=t.concat([s]);n.push({op:r,path:a,value:e}),i.unshift({op:`add`,path:a,value:e})}s++}),s=0,o.forEach(e=>{if(!a.has(e)){let a=t.concat([s]);n.push({op:`add`,path:a,value:e}),i.unshift({op:r,path:a,value:e})}s++})}function c(e,t,r){let{patches_:i,inversePatches_:a}=r;i.push({op:n,path:[],value:t===qx?void 0:t}),a.push({op:n,path:[],value:e})}function l(e,t){return t.forEach(t=>{let{path:i,op:a}=t,o=e;for(let e=0;e<i.length-1;e++){let t=fS(o),n=i[e];typeof n!=`string`&&typeof n!=`number`&&(n=``+n),(t===0||t===1)&&(n===`__proto__`||n===eS)&&Zx(19),xS(o)&&n===tS&&Zx(19),o=mS(o,n),(o===null||!bS(o))&&Zx(18,i.join(`/`))}let s=fS(o),c=u(t.value),l=i[i.length-1];switch(a){case n:switch(s){case 2:return o.set(l,c);case 3:Zx(16);default:return o[l]=c}case`add`:switch(s){case 1:return l===`-`?o.push(c):o.splice(l,0,c);case 2:return o.set(l,c);case 3:return o.add(c);default:return o[l]=c}case r:switch(s){case 1:return o.splice(l,1);case 2:return o.delete(l);case 3:return o.delete(t.value);default:return delete o[l]}default:Zx(17,a)}}),e}function u(e){if(!sS(e))return e;if(_S(e))return e.map(u);if(vS(e))return new Map(Array.from(e.entries()).map(([e,t])=>[e,u(t)]));if(yS(e))return new Set(Array.from(e).map(u));let t=Object.create($x(e));for(let n in e)t[n]=u(e[n]);return pS(e,Jx)&&(t[Jx]=e[Jx]),t}function d(e){return oS(e)?u(e):e}RS(NS,{applyPatches_:l,generatePatches_:i,generateReplacementPatches_:c,getPath:e})}globalThis.Iterator?.from;var vC=new pC,yC=vC.produce,bC=vC.produceWithPatches.bind(vC),xC=vC.applyPatches.bind(vC),SC=1e3;function CC(e,t){if(e.add(t),e.size>SC){let t=e.values().next().value;t!==void 0&&e.delete(t)}}function wC(e){let{enablePatches:t=!1}=e;t&&_C();let n=Rx(),r=e.initialValue,i=new Set;return{on:n.on,value:()=>r,patch:(e,t=Kx())=>{i.has(t)||(_C(),r=xC(r,e),CC(i,t),n.emit(`updated`,r,void 0,t))},mutate:(e,a=Kx())=>{if(!i.has(a)){if(CC(i,a),t){let[t,i]=bC(r,e);if(t===r)return;r=t,n.emit(`updated`,r,i,a)}else{let t=yC(r,e);if(t===r)return;r=t,n.emit(`updated`,r,void 0,a)}}},syncIds:i}}var TC=typeof self==`object`?self:globalThis,EC=new Set([`Error`,`EvalError`,`RangeError`,`ReferenceError`,`SyntaxError`,`TypeError`,`URIError`,`AggregateError`]),DC=new Set([`Boolean`,`Number`,`String`,`Int8Array`,`Uint8Array`,`Uint8ClampedArray`,`Int16Array`,`Uint16Array`,`Int32Array`,`Uint32Array`,`Float16Array`,`Float32Array`,`Float64Array`,`BigInt64Array`,`BigUint64Array`]);function OC(e,t){let n=(t,n)=>(e.set(n,t),t),r=i=>{if(e.has(i))return e.get(i);let[a,o]=t[i];switch(a){case 0:case-1:return n(o,i);case 1:{let e=n([],i);for(let t of o)e.push(r(t));return e}case 2:{let e=n({},i);for(let[t,n]of o)e[r(t)]=r(n);return e}case 3:return n(new Date(o),i);case 4:{let{source:e,flags:t}=o;return n(new RegExp(e,t),i)}case 5:{let e=n(new Map,i);for(let[t,n]of o)e.set(r(t),r(n));return e}case 6:{let e=n(new Set,i);for(let t of o)e.add(r(t));return e}case 7:{let{name:e,message:t}=o,r=EC.has(e)?TC[e]:void 0;return n(new(r??TC.Error)(t),i)}case 8:return n(BigInt(o),i);case`BigInt`:return n(Object(BigInt(o)),i);case`ArrayBuffer`:return n(new Uint8Array(o).buffer,o);case`DataView`:{let{buffer:e}=new Uint8Array(o);return n(new DataView(e),o)}}if(typeof a==`string`&&DC.has(a))return n(new TC[a](o),i);throw TypeError(`unable to deserialize unsafe or unknown type: ${String(a)}`)};return r}function kC(e){return OC(new Map,e)(0)}var AC=``,{toString:jC}={},{keys:MC}=Object;function NC(e){let t=typeof e;if(t!==`object`||!e)return[0,t];let n=jC.call(e).slice(8,-1);switch(n){case`Array`:return[1,AC];case`Object`:return[2,AC];case`Date`:return[3,AC];case`RegExp`:return[4,AC];case`Map`:return[5,AC];case`Set`:return[6,AC];case`DataView`:return[1,n]}return n.includes(`Array`)?[1,n]:n.includes(`Error`)?[7,n]:[2,n]}function PC([e,t]){return e===0&&(t===`function`||t===`symbol`)}function FC(e,t,n,r){let i=(e,t)=>{let i=r.push(e)-1;return n.set(t,i),i},a=r=>{if(n.has(r))return n.get(r);let[o,s]=NC(r);switch(o){case 0:{let t=r;switch(s){case`bigint`:o=8,t=r.toString();break;case`function`:case`symbol`:if(e)throw TypeError(`unable to serialize ${s}`);t=null;break;case`undefined`:return i([-1],r)}return i([o,t],r)}case 1:{if(s){let e=r;return s===`DataView`?e=new Uint8Array(r.buffer):s===`ArrayBuffer`&&(e=new Uint8Array(r)),i([s,[...e]],r)}let e=[],t=i([o,e],r);for(let t of r)e.push(a(t));return t}case 2:{if(s)switch(s){case`BigInt`:return i([s,r.toString()],r);case`Boolean`:case`Number`:case`String`:return i([s,r.valueOf()],r)}if(t&&`toJSON`in r)return a(r.toJSON());let n=[],c=i([o,n],r);for(let t of MC(r))(e||!PC(NC(r[t])))&&n.push([a(t),a(r[t])]);return c}case 3:return i([o,r.toISOString()],r);case 4:{let{source:e,flags:t}=r;return i([o,{source:e,flags:t}],r)}case 5:{let t=[],n=i([o,t],r);for(let[n,i]of r)(e||!(PC(NC(n))||PC(NC(i))))&&t.push([a(n),a(i)]);return n}case 6:{let t=[],n=i([o,t],r);for(let n of r)(e||!PC(NC(n)))&&t.push(a(n));return n}}let{message:c}=r;return i([o,{name:s,message:c}],r)};return a}function IC(e,t={}){let n=[];return FC(!(t.json||t.lossy),!!t.json,new Map,n)(e),n}var{parse:LC,stringify:RC}=JSON,zC={json:!0,lossy:!0};function BC(e){return kC(LC(e))}function VC(e){return RC(IC(e,zC))}function HC(e){return kC(e)}function UC(e){return VC(e)}function WC(e){return BC(e)}var GC=256,KC=class extends Error{name=`StreamClosedError`};function qC(e={}){let t=e.id??Kx(),n=Math.max(0,e.replayWindow??0),r=Rx(),i=new AbortController,a=[],o=!1,s=0;function c(e){if(o)throw new KC(`Cannot write to a closed stream "${t}"`);s+=1,n>0&&(a.push({seq:s,chunk:e}),a.length>n&&(a.length-n===1?a.shift():a.splice(0,a.length-n))),r.emit(`chunk`,s,e)}function l(e){if(o)return;o=!0;let t=YC(e);i.abort(e),r.emit(`end`,t)}function u(){o||(o=!0,i.signal.aborted||i.abort(`stream closed`),r.emit(`end`,void 0))}function d(e){o||i.signal.aborted||i.abort(e??`aborted`)}let f=new WritableStream({write(e){c(e)},close(){u()},abort(e){l(e)}});return{id:t,signal:i.signal,get closed(){return o},get lastSeq(){return s},write:c,error:l,close:u,abort:d,writable:f,events:r,buffer:a}}function JC(e={}){let t=e.id??Kx(),n=Math.max(1,e.highWaterMark??GC),r=[],i=0,a=!1,o=!1,s,c,l,u;function d(){if(c){if(r.length>0){let e=r.shift(),t=c;c=void 0,t.resolve({value:e,done:!1});return}if(a){let e=c;if(c=void 0,s){let t=Error(s.message);t.name=s.name,e.reject(t)}else e.resolve({value:void 0,done:!0})}}}function f(){if(l){for(;r.length>0;){let e=r.shift();try{l.enqueue(e)}catch{break}}if(a&&l){try{if(s){let e=Error(s.message);e.name=s.name,l.error(e)}else l.close()}catch{}l=void 0}}}function p(t,s){if(!(a||o)&&!(t<=i)){if(i=t,r.push(s),r.length>n){let t=r.length-n;r.splice(0,t),e.onOverflow?.(t)}d(),u&&f()}}function m(e){a||(a=!0,s=e,d(),u&&f())}function h(){o||a||(o=!0,e.onCancel?.(),m(void 0))}function g(){return u||(u=new ReadableStream({start(e){l=e,f()},cancel(){h()}}),u)}return{id:t,get cancelled(){return o},get done(){return a},get lastSeenSeq(){return i},get readable(){return g()},cancel:h,_push:p,_end:m,[Symbol.asyncIterator](){return{next(){if(r.length>0)return Promise.resolve({value:r.shift(),done:!1});if(a){if(s){let e=Error(s.message);return e.name=s.name,Promise.reject(e)}return Promise.resolve({value:void 0,done:!0})}return new Promise((e,t)=>{c={resolve:e,reject:t}})},return(){return h(),Promise.resolve({value:void 0,done:!0})}}}}}function YC(e){if(e instanceof Error)return{name:e.name||`Error`,message:e.message};if(typeof e==`string`)return{name:`Error`,message:e};try{return{name:`Error`,message:JSON.stringify(e)}}catch{return{name:`Error`,message:String(e)}}}var XC=128;function ZC(e){return e.replace(/[^\w-]+/g,`_`).slice(0,XC)}var QC=`modulepreload`,$C=function(e,t){return new URL(e,t).href},ew={},tw=function(e,t,n){let r=Promise.resolve();if(t&&t.length>0){let e=document.getElementsByTagName(`link`),i=document.querySelector(`meta[property=csp-nonce]`),a=i?.nonce||i?.getAttribute(`nonce`);function o(e){return Promise.all(e.map(e=>Promise.resolve(e).then(e=>({status:`fulfilled`,value:e}),e=>({status:`rejected`,reason:e}))))}function s(e){return import.meta.resolve?import.meta.resolve(e):new URL(e,import.meta.url).href}r=o(t.map(t=>{if(t=$C(t,n),t=s(t),t in ew)return;ew[t]=!0;let r=t.endsWith(`.css`);for(let n=e.length-1;n>=0;n--){let i=e[n];if(i.href===t&&(!r||i.rel===`stylesheet`))return}let i=document.createElement(`link`);if(i.rel=r?`stylesheet`:QC,r||(i.as=`script`),i.crossOrigin=``,i.href=t,a&&i.setAttribute(`nonce`,a),document.head.appendChild(i),r)return new Promise((e,n)=>{i.addEventListener(`load`,e),i.addEventListener(`error`,()=>n(Error(`Unable to preload CSS for ${t}`)))})}).filter(e=>e!==void 0))}function i(e){let t=new Event(`vite:preloadError`,{cancelable:!0});if(t.payload=e,window.dispatchEvent(t),!t.defaultPrevented)throw e}return r.then(t=>{for(let e of t||[])e.status===`rejected`&&i(e.reason);return e().catch(i)})},nw=`__connection.json`,rw=`__DEVFRAME_CONNECTION__`,iw=`x-birpc-session`,aw=`__rpc-dump/index.json`,ow=`devframe:services`,sw=`devframe_otp`,cw=`devframe_auth_token`;ix.postMessage.remoteAssetsError;var lw=class{cacheMap=new Map;options;keySerializer;constructor(e){this.options=e,this.keySerializer=e.keySerializer||(e=>Lx(e))}updateOptions(e){this.options={...this.options,...e}}cached(e,t){let n=this.cacheMap.get(e);if(n)return n.get(this.keySerializer(t))}has(e,t){return this.cacheMap.get(e)?.has(this.keySerializer(t))??!1}apply(e,t){let n=this.cacheMap.get(e.m)||new Map;n.set(this.keySerializer(e.a),t),this.cacheMap.set(e.m,n)}validate(e){return this.options.functions.includes(e)}clear(e){e?this.cacheMap.delete(e):this.cacheMap.clear()}},uw=sx({docsBase:`https://devfra.me/errors`,codes:{DF0019:{why:e=>`RPC function "${e.name}" has \`agent\` set but \`jsonSerializable\` is \`false\`; MCP requires JSON-serializable data.`,fix:"Remove `jsonSerializable: false`, or remove `agent` to keep it RPC-only."},DF0020:{why:e=>`RPC function "${e.name}" declares \`jsonSerializable: true\` but the value at "${e.path}" is a ${e.type}.`,fix:"Either drop `jsonSerializable: true` (falls back to structured-clone) or change the value to a JSON-safe shape."},DF0021:{why:e=>`RPC function "${e.name}" is already registered`,fix:"Use the `force` parameter to overwrite an existing registration."},DF0022:{why:e=>`RPC function "${e.name}" is not registered. Use register() to add new functions.`},DF0023:{why:e=>`RPC function "${e.name}" is not registered`},DF0024:{why:e=>`Either handler or setup function must be provided for RPC function "${e.name}"`},DF0025:{why:e=>`Function "${e.name}" not found in dump store`},DF0026:{why:e=>`No dump match for "${e.name}" with args: ${e.args}`},DF0027:{why:e=>`Function "${e.name}" with type "${e.type}" cannot have dump configuration. Only "static" and "query" types support dumps.`},DF0028:{why:e=>`Function "${e.name}" with type "${e.type}" cannot use \`snapshot: true\`. Only "query" functions support this sugar; "static" functions have equivalent default behavior already.`,fix:"Remove `snapshot: true`, or change the function type to `query`."},DF0043:{why:e=>`RPC function "${e.name}" received an invalid argument at position ${e.index}: ${e.issues}`,fix:"Pass a value that satisfies the `args` schema declared for this function."},DF0044:{why:e=>`RPC function "${e.name}" returned a value that failed its \`returns\` schema: ${e.issues}`,fix:"Make the handler return a value that satisfies the `returns` schema, or relax the schema."}}});function dw(e){if(e.agent&&e.jsonSerializable===!1)throw uw.DF0019({name:e.name});e.agent&&!e.jsonSerializable&&(e.jsonSerializable=!0)}async function fw(e,t){let n=e[`~standard`].validate(t);return n instanceof Promise?await n:n}function pw(e){return e.map(e=>{let t=e.path?.map(e=>typeof e==`object`?e.key:e).join(`.`);return t?`${t}: ${e.message}`:e.message}).join(`; `)}async function mw(e,t,n){let r=n.slice();if(!t||t.length===0)return r;for(let r=0;r<t.length;r++){let i=t[r];if(!i)continue;let a=await fw(i,n[r]);if(a.issues)throw uw.DF0043({name:e,index:r,issues:pw(a.issues)})}return r}async function hw(e,t,n){if(!t)return n;let r=await fw(t,n);if(r.issues)throw uw.DF0044({name:e,issues:pw(r.issues)});return n}async function gw(e,t){if(!e.setup)return{};if(typeof t==`object`&&t){e.__cache??=new WeakMap;let n=e.__cache,r=n.get(t);return r||(r=Promise.resolve(e.setup(t)),r.catch(()=>{n.get(t)===r&&n.delete(t)}),n.set(t,r)),await r}if(!e.__promise){let n=Promise.resolve(e.setup(t));n.catch(()=>{e.__promise===n&&(e.__promise=void 0)}),e.__promise=n}return await e.__promise}async function _w(e,t){let n=e.handler;if(!n){let r=await gw(e,t);if(!r.handler)throw uw.DF0024({name:e.name});n=r.handler}let r=e.args,i=e.returns;if(!r&&!i)return n;let a=n;return async(...t)=>{let n=await mw(e.name,r,t),o=await a(...n);return await hw(e.name,i,o)}}var vw=class{context;definitions=new Map;functions;_onChanged=[];constructor(e){this.context=e;let t=this.definitions,n=this;this.functions=new Proxy({},{get(e,r){let i=t.get(r);if(i)return _w(i,n.context)},has(e,n){return t.has(n)},getOwnPropertyDescriptor(e,n){return{value:t.get(n)?.handler,configurable:!0,enumerable:!0}},ownKeys(){return Array.from(t.keys())}})}register(e,t=!1){if(this.definitions.has(e.name)&&!t)throw uw.DF0021({name:e.name});dw(e),this.definitions.set(e.name,e),this._onChanged.forEach(t=>t(e.name))}update(e,t=!1){if(!this.definitions.has(e.name)&&!t)throw uw.DF0022({name:e.name});dw(e),this.definitions.set(e.name,e),this._onChanged.forEach(t=>t(e.name))}onChanged(e){return this._onChanged.push(e),()=>{let t=this._onChanged.indexOf(e);t!==-1&&this._onChanged.splice(t,1)}}async getHandler(e){return await _w(this.definitions.get(e),this.context)}getSchema(e){let t=this.definitions.get(e);if(!t)throw uw.DF0023({name:String(e)});return{args:t.args,returns:t.returns}}has(e){return this.definitions.has(e)}get(e){return this.definitions.get(e)}list(){return Array.from(this.definitions.keys())}};function yw(e,t=``){return JSON.stringify(e,function(e,n){let r=this,i=r==null?n:r[e];if(i===void 0){if(Array.isArray(r))throw xw(t,`undefined`,r,e);return n}return i!==null&&bw(i,r,e,t),n})}function bw(e,t,n,r){if(typeof e==`bigint`)throw xw(r,`BigInt`,t,n);if(typeof e!=`object`)return;if(e instanceof Map)throw xw(r,`Map`,t,n);if(e instanceof Set)throw xw(r,`Set`,t,n);if(e instanceof Date)throw xw(r,`Date`,t,n);if(Array.isArray(e))return;let i=Object.getPrototypeOf(e);if(i!==null&&i!==Object.prototype)throw xw(r,e.constructor?.name??`class instance`,t,n)}function xw(e,t,n,r){let i=Sw(n,r);return uw.DF0020({name:e||`<anonymous>`,type:t,path:i})}function Sw(e,t){return Array.isArray(e)?`[${t}]`:t===``?`<root>`:t}var Cw=`__DEVFRAME_CONNECTION_META__`,ww=`__DEVFRAME_CONNECTION_AUTH_TOKEN__`;function Tw(e){let t=[()=>window?.[e],()=>globalThis?.[e],()=>parent.window?.[e]];for(let e of t)try{let t=e();if(t)return t}catch{}}function Ew(){return Tw(rw)}function Dw(){return Tw(Cw)}function Ow(e){if(e)return e;try{let e=localStorage.getItem(ww);if(e)return e}catch{}return Tw(ww)}function kw(e){globalThis[rw]=e,globalThis[Cw]={...e.connectionMeta,baseUrl:e.metaBaseUrl},e.authToken&&Aw(e.authToken)}function Aw(e){try{localStorage.setItem(ww,e)}catch{}globalThis[ww]=e;let t=Ew();t&&(globalThis[rw]={...t,authToken:e})}function jw(e){let t=Ux(nw,e);try{return new URL(t,globalThis.location?.href).href}catch{return t}}function Mw(e,t){return t&&t!==e.authToken?{...e,authToken:t}:e}function Nw(){let e=Ew();if(e)return Mw(e,Ow()??e.authToken??e.connectionMeta.authToken);let t=Dw();if(t)return{connectionMeta:t,metaBaseUrl:t.baseUrl??jw(`./`),authToken:Ow(t.authToken)}}async function Pw(e={}){if(e.connection){let t=Mw(e.connection,Ow(e.authToken??e.connection.authToken??e.connection.connectionMeta.authToken));return kw(t),t}let t=Array.isArray(e.baseURL)?e.baseURL:[e.baseURL??`./`];if(e.connectionMeta){let n={connectionMeta:e.connectionMeta,metaBaseUrl:jw(t[0]??`./`),authToken:Ow(e.authToken??e.connectionMeta.authToken)};return kw(n),n}let n=Nw();if(n){let t=Mw(n,Ow(e.authToken??n.authToken??n.connectionMeta.authToken));return kw(t),t}let r=[];for(let n of t){let t=Ux(nw,n),i=jw(n);try{let n=await fetch(t);if(!n.ok)throw Error(`Failed to fetch connection meta from ${i}: ${n.status}`);let r=await n.json(),a=n.url||i,o={connectionMeta:r,metaBaseUrl:r.baseUrl?new URL(r.baseUrl,a).href:a,authToken:Ow(e.authToken??r.authToken)};return kw(o),o}catch(e){r.push(e)}}throw Error(`Failed to get connection meta from ${t.join(`, `)}`,{cause:r})}var Fw=class extends Error{name=`DevframeConnectionError`;kind;constructor(e,t,n){super(t,n),this.kind=e}};function Iw(e=sw){try{let t=globalThis.location?.hash?.replace(/^#/,``)??``;return new URLSearchParams(t).get(e)||void 0}catch{return}}function Lw(e){try{let t=new URL(globalThis.location.href),n=new URLSearchParams(t.hash.replace(/^#/,``));if(!n.has(e))return;n.delete(e),t.hash=n.toString(),globalThis.history?.replaceState(globalThis.history.state,``,t.href)}catch{}}function Rw(e=sw){let t=Iw(e);return t&&Lw(e),t}async function zw(e,t={}){let n=Rw(t.param??`devframe_otp`);return n?e.isTrusted?!0:e.requestTrustWithCode(n):!1}function Bw(e){let t={},n=new WeakMap,r,i=()=>(r??=e.sharedState.get(ow,{initialValue:{}}).then(e=>(t=e.value(),e.on(`updated`,e=>{t=e}),e)),r);return i(),{state:i,has:e=>e in t,keys:()=>Object.keys(t),get:r=>{let i=t[r];if(!i)return;let a=n.get(i);return a||(a={...i,rpc:e.scope(i.scope).rpc},n.set(i,a)),a}}}function Vw(e){let t=new Map,n=new Map,r=new Map,i=new Set,a=e.connectionMeta.backend===`static`;function o(e,t){let n=r.get(e);return n&&typeof n==`object`&&!Array.isArray(n)&&typeof t==`object`&&!Array.isArray(t)?{...n,...t}:t}e.client.register({name:ix.broadcast.clientStateUpdated,type:`event`,handler:(e,n,r)=>{let i=t.get(e);i&&!i.syncIds.has(r)&&i.mutate(()=>o(e,n),r)}}),e.client.register({name:ix.broadcast.clientStatePatch,type:`event`,handler:(e,n,r)=>{let i=t.get(e);i&&!i.syncIds.has(r)&&i.patch(n,r)}});function s(t,n){let r=[];return r.push(n.on(`updated`,(n,r,i)=>{a||(r?e.callEvent(`devframe:rpc:server-state:patch`,t,r,i):e.callEvent(`devframe:rpc:server-state:set`,t,n,i))})),()=>{for(let e of r)e()}}return{keys:()=>Array.from(t.keys()),onKeyAdded(e){return i.add(e),()=>{i.delete(e)}},delete(e){let i=n.get(e);n.delete(e);let a=t.delete(e);return r.delete(e),i?.(),a},get:async(c,l)=>{if(l?.initialValue!==void 0&&r.set(c,l.initialValue),t.has(c))return t.get(c);let u=wC({initialValue:l?.initialValue,enablePatches:!1});async function d(){if(a||e.callEvent(`devframe:rpc:server-state:subscribe`,c),l?.initialValue!==void 0){t.set(c,u);for(let e of i)e(c);return e.call(`devframe:rpc:server-state:get`,c).then(e=>{e!==void 0&&u.mutate(()=>o(c,e))}).catch(e=>{console.error(`Error getting server state`,e)}),n.set(c,s(c,u)),u}{let r=await e.call(`devframe:rpc:server-state:get`,c);u.mutate(()=>o(c,r)),t.set(c,u);for(let e of i)e(c);return n.set(c,s(c,u)),u}}return new Promise(t=>{if(e.isTrusted)d().then(t);else{t(u);let n=!1;e.events.on(ix.client.isTrustedUpdated,e=>{e&&!n&&(n=!0,d())})}})}}}var Hw=new Map;function Uw(e=Hw){let t=new Map;return{serialize:n=>{let r;return n.t===`q`?r=n.m:(r=t.get(n.i),t.delete(n.i)),!(n.t===`s`&&`e`in n)&&r&&e.get(r)?.jsonSerializable===!0?yw(n,r??``):`s:${UC(n)}`},deserialize:e=>{let n=e.startsWith(`s:`)?WC(e.slice(2)):JSON.parse(e);return n.t===`q`&&n.i&&n.m&&t.set(n.i,n.m),n}}}function Ww(){}function Gw(e){let t=e.search(/\n\n|\r\n\r\n/);if(!(t<0))return{frame:e.slice(0,t),rest:e.slice(t+(e[t]===`\r`?4:2))}}function Kw(e){let t=`message`,n=[];for(let r of e.split(/\r?\n/))r.startsWith(`:`)||(r.startsWith(`event:`)?t=r.slice(6).trimStart():r.startsWith(`data:`)&&n.push(r.slice(5).replace(/^ /,``)));return{event:t,data:n}}function qw(e){let{onConnected:t=Ww,onError:n=Ww,onDisconnected:r=Ww,definitions:i,fetch:a=globalThis.fetch.bind(globalThis)}=e,o=e.url;e.authToken&&(o=`${o}${o.includes(`?`)?`&`:`?`}${cw}=${encodeURIComponent(e.authToken)}`);let s=Uw(i),c=new AbortController,l=!1,u,d,f,p,m=new Promise((e,t)=>{f=e,p=t});m.catch(()=>{});function h(e){l||(l=!0,p(e),n(e),r())}function g(){l||(l=!0,p(Error(`Devframe SSE stream closed`)),r())}function _(e,n){if(e===`session`){f(n),t();return}u?.(n)}async function ee(e){let t=e.getReader();d=t;let n=new TextDecoder,r=``;for(;;){let{done:e,value:i}=await t.read();if(e)break;for(r+=n.decode(i,{stream:!0});;){let e=Gw(r);if(!e)break;r=e.rest;let{event:t,data:n}=Kw(e.frame);n.length>0&&_(t,n.join(`
`))}}g()}return(async()=>{try{let e=await a(o,{headers:{accept:`text/event-stream`},signal:c.signal});if(!e.ok||!e.body)throw Error(`Devframe SSE stream request failed: ${e.status}`);await ee(e.body)}catch(e){if(c.signal.aborted){g();return}h(e instanceof Error?e:Error(String(e)))}})(),{close:()=>{l=!0,c.abort(),d?.cancel().catch(()=>{})},on:e=>{u=e},post:async e=>{let t;try{t=await m}catch{return}if(l){n(Error(`Devframe SSE channel is closed; message dropped`));return}try{let n=await a(o,{method:`POST`,headers:{"content-type":`text/plain; charset=utf-8`,[iw]:t},body:e});if(n.status===200){let e=await n.text();e&&u?.(e);return}if(!n.ok)throw Error(`Devframe SSE POST failed: ${n.status}`)}catch(e){n(e instanceof Error?e:Error(String(e)))}},serialize:s.serialize,deserialize:s.deserialize}}function Jw(e,t){let{channel:n,rpcOptions:r={}}=t;return _x(e,{...n,timeout:-1,...r,proxify:!1})}function Yw(e){let{transport:t,authToken:n,connectionMeta:r,events:i,clientRpc:a,rpcOptions:o={},callTimeout:s=0}=e,c=!1,l=`connecting`,u=null,d=Promise.withResolvers();function f(e,t=null){if(t?u=t:e===`connected`&&(u=null),e===l)return;let n=l;l=e,i.emit(ix.client.connectionStatus,e,n)}let p=new Set;function m(e){for(let t of[...p])t.reject(e)}function h(){return l===`disconnected`||l===`error`?new Fw(`connection`,`[devframe] Not connected to the devframe server`,{cause:u??void 0}):l===`unauthorized`?new Fw(`auth`,`[devframe] Not authorized by the devframe server`,{cause:u??void 0}):null}function g(e,t){return new Promise((n,r)=>{let a=!1,o,c={reject(e){a||(l(),i.emit(ix.client.error,e,t),r(e))}};function l(){a=!0,p.delete(c),o&&clearTimeout(o)}p.add(c),s>0&&(o=setTimeout(()=>{c.reject(new Fw(`timeout`,`[devframe] RPC call "${t}" timed out after ${s}ms`))},s)),e.then(e=>{a||(l(),n(e))},e=>{if(a)return;l();let n=e instanceof Error?e:Error(String(e));i.emit(ix.client.error,n,t),r(n)})})}let _=new Map;for(let e of r.jsonSerializableMethods??[])_.set(e,{jsonSerializable:!0});let ee=e.createChannel({definitions:_,onError(e){f(`error`,e),i.emit(ix.client.connectionError,e),m(new Fw(`connection`,`[devframe] Connection to the devframe server failed`,{cause:e}))},onDisconnected(){l!==`error`&&f(`disconnected`),m(new Fw(`connection`,`[devframe] Disconnected from the devframe server`,{cause:u??void 0}))}}),v=Jw(a.functions,{channel:ee,rpcOptions:o});a.register({name:ix.broadcast.authRevoked,type:`event`,handler:()=>{c=!1;let e=new Fw(`auth`,`[devframe] The devframe server revoked this client's trust`);f(`unauthorized`,e),i.emit(ix.client.connectionError,e),m(e),i.emit(ix.client.isTrustedUpdated,!1)}});let te=n;async function ne(e){te=e;let t=await v.$call(`anonymous:devframe:auth`,{authToken:e,ua:navigator.userAgent,origin:location.origin});if(c=t.isTrusted,c)d.resolve(!0),f(`connected`);else{let e=new Fw(`auth`,`[devframe] The devframe server refused this client's credentials`);f(`unauthorized`,e),i.emit(ix.client.connectionError,e)}return i.emit(ix.client.isTrustedUpdated,c),t.isTrusted}async function re(e){let t=(await v.$call(`anonymous:devframe:auth:exchange`,{code:e,ua:navigator.userAgent,origin:location.origin}))?.authToken??null;return t&&(te=t,c=!0,d.resolve(!0),f(`connected`),i.emit(ix.client.isTrustedUpdated,!0)),t}async function ie(e={}){await v.$call(`anonymous:devframe:auth:request-code`,{ua:navigator.userAgent,origin:location.origin,...e.reissue?{reissue:!0}:{}})}async function ae(){return c?!0:ne(te??``)}async function oe(e=6e4){if(c&&d.resolve(!0),e<=0)return d.promise;let t;try{return await Promise.race([d.promise,new Promise((n,r)=>{t=setTimeout(()=>{r(Error(`[devframe] Timeout waiting for rpc to be trusted`))},e)})]),c}finally{clearTimeout(t)}}return{transport:t,get isTrusted(){return c},get status(){return l},get connectionError(){return u},requestTrust:ae,requestTrustWithToken:ne,requestTrustWithCode:re,requestAuthCode:ie,ensureTrusted:oe,call:(...e)=>{let t=String(e[0]),n=h();return n?(i.emit(ix.client.error,n,t),Promise.reject(n)):g(v.$call(...e),t)},callEvent:(...e)=>{let t=h();if(t){i.emit(ix.client.error,t,String(e[0]));return}return v.$callEvent(...e)},callOptional:(...e)=>{let t=String(e[0]),n=h();return n?(i.emit(ix.client.error,n,t),Promise.reject(n)):g(v.$callOptional(...e),t)},close:()=>{ee.close()}}}function Xw(e,t,n){let r=(()=>{try{return new URL(t,n.href)}catch{return new URL(n.href)}})();if(e&&typeof e==`object`){if(e.host!=null||e.port!=null){let t=e.host??`${r.hostname}:${e.port}`;return new URL(e.path??`/`,`${r.protocol}//${t}`).href}return new URL(e.path??``,r).href}let i=e??``;return/^https?:\/\//i.test(i)?i:new URL(i,r).href}function Zw(e){let{authToken:t,connectionMeta:n,metaBaseUrl:r,events:i,clientRpc:a,rpcOptions:o={},sseOptions:s={},callTimeout:c=0}=e,l=Xw(n.sse,r??`./`,location);return Yw({transport:`sse`,authToken:t,connectionMeta:n,events:i,clientRpc:a,rpcOptions:o,callTimeout:c,createChannel:e=>qw({url:l,authToken:t,definitions:e.definitions,...s,onConnected(){s.onConnected?.()},onError(t){e.onError(t),s.onError?.(t)},onDisconnected(){e.onDisconnected(),s.onDisconnected?.()}})})}function Qw(e){let{name:t,message:n,cause:r,...i}=e,a=r instanceof Error?r:$w(r)?Qw(r):r,o=a===void 0?Error(n):Error(n,{cause:a});return o.name=t,Object.assign(o,i),o}function $w(e){return typeof e==`object`&&!!e&&typeof e.message==`string`&&typeof e.name==`string`}function eT(e){return typeof e==`object`&&!!e&&e.type===`static`&&typeof e.path==`string`}function tT(e){return typeof e==`object`&&!!e&&e.type===`query`&&typeof e.records==`object`&&e.records!==null}function nT(e){return typeof e==`object`&&!!e&&(`output`in e||`error`in e)}function rT(e){if(e.error)throw Qw(e.error);return e.output}function iT(e){return e.some(e=>e!=null)}function aT(e){return typeof e==`object`&&e&&`serialization`in e&&`data`in e?e.data:e}function oT(e,t){let n=new Map,r=new Map;function i(e,t){return t===`structured-clone`&&Array.isArray(e)?HC(e):e}function a(e,t){return i(aT(e),t)}async function o(e){n.has(e.path)||n.set(e.path,t(e.path).then(t=>a(t,e.serialization)));let r=await n.get(e.path);return nT(r)?rT(r):r}async function s(e,n){return r.has(e)||r.set(e,t(e).then(e=>a(e,n))),await r.get(e)}async function c(t,n){if(!(t in e))throw Error(`[devframe-rpc] Function "${t}" not found in dump store`);let r=e[t];if(eT(r)){if(iT(n))throw Error(`[devframe-rpc] No dump match for "${t}" with args: ${JSON.stringify(n)}`);return await o(r)}if(tT(r)){let e=Lx(n),i=r.records[e];if(i)return rT(await s(i,r.serialization));if(r.fallback)return rT(await s(r.fallback,r.serialization));throw Error(`[devframe-rpc] No dump match for "${t}" with args: ${JSON.stringify(n)}`)}if(!iT(n))return r;throw Error(`[devframe-rpc] No dump match for "${t}" with args: ${JSON.stringify(n)}`)}return{call:async(e,t)=>await c(e,t),callOptional:async(t,n)=>{if(t in e)return await c(t,n)},callEvent:async(e,t)=>{}}}async function sT(e){let t=oT(await e.fetchJsonFromBases(aw),e.fetchJsonFromBases);return{transport:`static`,isTrusted:!0,status:`connected`,connectionError:null,requestTrust:async()=>!0,requestTrustWithToken:async()=>!0,requestTrustWithCode:async()=>null,requestAuthCode:async()=>{},ensureTrusted:async()=>!0,call:(...e)=>t.call(e[0],e.slice(1)),callEvent:(...e)=>t.callEvent(e[0],e.slice(1)),callOptional:(...e)=>t.callOptional(e[0],e.slice(1)),close:()=>{}}}var cT=``;function lT(e,t){return`${e}${cT}${t}`}function uT(e){let t=new Map,n=new Map;e.client.register({name:ix.broadcast.streamingChunk,type:`event`,handler(e,n,r,i){t.get(lT(e,n))?._push(r,i)}}),e.client.register({name:ix.broadcast.streamingEnd,type:`event`,handler(e,n,r){let i=lT(e,n),a=t.get(i);a&&(a._end(r),t.delete(i))}}),e.client.register({name:ix.broadcast.streamingUploadCancel,type:`event`,handler(e,t){let r=lT(e,t),i=n.get(r);i&&(i.abort(`server cancelled upload`),n.delete(r))}}),e.events.on(ix.client.isTrustedUpdated,n=>{if(n)for(let[n,r]of t){if(r.cancelled||r.done)continue;let t=n.indexOf(cT);if(t<0)continue;let i=n.slice(0,t),a=n.slice(t+1);e.callEvent(`devframe:streaming:subscribe`,i,a,{afterSeq:r.lastSeenSeq})}});function r(n,r,i={}){let a=lT(n,r),o=t.get(a);if(o)return o;let s=JC({id:r,highWaterMark:i.highWaterMark,onOverflow(e){console.warn(`[devframe] DF0029: Stream "${n}#${r}" dropped ${e} chunk(s) after exceeding the client high-water mark.`)},onCancel(){e.callEvent(`devframe:streaming:cancel`,n,r),t.delete(a)}});if(t.set(a,s),e.isTrusted)e.callEvent(`devframe:streaming:subscribe`,n,r,{afterSeq:0});else{let i=e.events.on(ix.client.isTrustedUpdated,o=>{o&&(i(),t.has(a)&&!s.cancelled&&!s.done&&e.callEvent(`devframe:streaming:subscribe`,n,r,{afterSeq:s.lastSeenSeq}))})}return s}function i(t,r){let i=lT(t,r),a=n.get(i);if(a)return a;let o=qC({id:r});return o.events.on(`chunk`,(n,i)=>{e.callEvent(`devframe:streaming:upload-chunk`,t,r,n,i)}),o.events.on(`end`,a=>{e.callEvent(`devframe:streaming:upload-end`,t,r,a),n.delete(i)}),n.set(i,o),o}return{subscribe:r,upload:i}}function dT(){}var fT=new Map;function pT(e){let t=e.url;e.authToken&&(t=`${t}?${cw}=${encodeURIComponent(e.authToken)}`);let n=new WebSocket(t),{onConnected:r=dT,onError:i=dT,onDisconnected:a=dT,definitions:o=fT}=e;n.addEventListener(`open`,e=>{r(e)}),n.addEventListener(`error`,e=>{let t=e instanceof Error?e:Error(e.type);i(t)}),n.addEventListener(`close`,e=>{a(e)});let s=Uw(o);return{close:()=>{n.close()},on:e=>{n.addEventListener(`message`,t=>{e(t.data)})},post:e=>{if(n.readyState===WebSocket.OPEN){n.send(e);return}if(n.readyState===WebSocket.CONNECTING){let t=()=>{i(),n.readyState===WebSocket.OPEN&&n.send(e)},r=()=>i();function i(){n.removeEventListener(`open`,t),n.removeEventListener(`close`,r)}n.addEventListener(`open`,t),n.addEventListener(`close`,r);return}i(Error(`Devframe WebSocket is not open; message dropped`))},serialize:s.serialize,deserialize:s.deserialize}}function mT(e,t,n){let r=(()=>{try{return new URL(t,n.href)}catch{return new URL(n.href)}})(),i=r.protocol===`https:`?`wss:`:`ws:`;if(e&&typeof e==`object`){if(e.host!=null||e.port!=null){let t=e.host??`${r.hostname}:${e.port}`,n=new URL(e.path??`/`,`${i}//${t}`);return n.protocol=i,n.href}let t=new URL(e.path??``,r);return t.protocol=i,t.href}if(typeof e==`number`)return`${i}//${r.hostname}:${e}`;let a=e??``;if(/^wss?:\/\//i.test(a))return a;if(/^https?:\/\//i.test(a))return Wx(a,/^https/i.test(a)?`wss://`:`ws://`);let o=new URL(a,r);return o.protocol=i,o.href}function hT(e){let{authToken:t,connectionMeta:n,metaBaseUrl:r,events:i,clientRpc:a,rpcOptions:o={},wsOptions:s={},callTimeout:c=0}=e,l=mT(n.websocket,r??`./`,location);return Yw({transport:`websocket`,authToken:t,connectionMeta:n,events:i,clientRpc:a,rpcOptions:o,callTimeout:c,createChannel:e=>pT({url:l,authToken:t,definitions:e.definitions,...s,onConnected(e){s.onConnected?.(e)},onError(t){e.onError(t),s.onError?.(t)},onDisconnected(t){e.onDisconnected(),s.onDisconnected?.(t)}})})}function gT(e){return e.includes(`:`)}function _T(e,t){return gT(t)?t:`${e}:${t}`}function vT(e){return{async get(t){return(await e()).value()[t]},async set(t,n){(await e()).mutate(e=>{e[t]=n})},async delete(t){(await e()).mutate(e=>{delete e[t]})},async all(){return(await e()).value()},async onChange(t){return(await e()).on(`updated`,e=>t(e))}}}function yT(e,t,n){let r=`devframe:settings:${n}:${t}`,i;function a(){return i||=e.sharedState.get(r,{initialValue:{}}),i}return vT(a)}function bT(e,t){return{global:yT(e,t,`global`),project:yT(e,t,`project`)}}function xT(e,t){return{namespace:t,base:e,rpc:{namespace:t,register(n){if(gT(n.name))throw Error(`[devframe] Scoped client RPC registration for namespace "${t}" received an already-namespaced function name "${n.name}". Pass a bare name without a ":" separator.`);e.client.register({...n,name:`${t}:${n.name}`})},call:((n,...r)=>e.call(_T(t,n),...r)),callEvent:((n,...r)=>e.callEvent(_T(t,n),...r)),callOptional:((n,...r)=>e.callOptional(_T(t,n),...r)),sharedState:((n,r)=>e.sharedState.get(_T(t,n),r)),streaming:{subscribe:(n,r,i)=>e.streaming.subscribe(_T(t,n),r,i),upload:(n,r)=>e.streaming.upload(_T(t,n),r)}},settings:bT(e,t),scope:e.scope}}function ST(){if(typeof document<`u`){let e=document.modelContext;if(e)return e}if(typeof navigator<`u`){let e=navigator.modelContext;if(e)return e}}function CT(e,t={}){let n=t.modelContext??ST();if(!n)return()=>{};let r=n,i=new Map,a=new Map;function o(t,n){let o=ZC(t.name),s=a.get(o);if(s&&s!==t.name){console.warn(`[devframe] WebMCP tool name "${o}" (from "${t.name}") collides with "${s}"; keeping the first registration.`);return}let c=new AbortController,l=vx(t.type,n),u=r.registerTool({name:o,description:n.description,inputSchema:xx(t.args),annotations:{title:n.title??t.name,readOnlyHint:l===`read`,destructiveHint:l===`destructive`},execute:n=>wT(t,e.context,n)},{signal:c.signal});u&&`then`in u&&u.then(()=>{},()=>{}),a.set(o,t.name),i.set(t.name,()=>{c.abort(),u&&`unregister`in u&&typeof u.unregister==`function`&&u.unregister(),a.delete(o)})}function s(t){let n=t?[t]:[...e.definitions.keys()];for(let t of n){i.get(t)?.(),i.delete(t);let n=e.definitions.get(t),r=n?.agent;n&&r&&o(n,r)}}s();let c=e.onChanged(e=>s(e));return()=>{c();for(let e of i.values())e();i.clear()}}async function wT(e,t,n){try{let r=Cx(n,e.args?.length);return{content:[{type:`text`,text:TT(await(await _w(e,t))(...r))}]}}catch(e){return{isError:!0,content:[{type:`text`,text:ET(e)}]}}}function TT(e){return e===void 0?`undefined`:typeof e==`string`?e:JSON.stringify(e,null,2)}function ET(e){if(!(e instanceof Error))return String(e);let t=e.cause instanceof Error?` (cause: ${e.cause.message})`:``;return`${e.name}: ${e.message}${t}`}function DT(e,t){if(t.backend===`static`)return`static`;let n=t.websocket!==void 0,r=t.sse!==void 0;if(e===`websocket`){if(!n)throw Error(`[devframe] transport: 'websocket' was requested, but this server does not advertise a WebSocket endpoint`);return`websocket`}if(e===`sse`){if(!r)throw Error(`[devframe] transport: 'sse' was requested, but this server does not advertise an SSE endpoint`);return`sse`}if(t.backend===`sse`&&r)return`sse`;if(n)return`websocket`;if(r)return`sse`;throw Error(`[devframe] This server advertises no RPC transport (backend "none"), so there is nothing to connect to. Enable the WebSocket or SSE endpoint on the server, or use its static/MCP surfaces instead.`)}async function OT(e={}){let{baseURL:t=`./`,rpcOptions:n={},cacheOptions:r=!1}=e,i=Rx(),a=Array.isArray(t)?t:[t],o=await Pw(e),{connectionMeta:s,metaBaseUrl:c,authToken:l}=o,u=a[0]??`./`;try{u=new URL(`.`,c).href}catch{}let d=new lw({functions:[],...typeof e.cacheOptions==`object`?e.cacheOptions:{}}),f={rpc:void 0},p=new vw(f),m=e.webmcp===!1?void 0:CT(p),h,g=!1;async function _(e){let t=[u,...a.filter(e=>e!==u)].filter(e=>e!=null),n=[];for(let r of t)try{return await fetch(Ux(e,r)).then(t=>{if(!t.ok)throw Error(`Failed to fetch ${e} from ${r}: ${t.status}`);return t.json()})}catch(e){n.push(e)}throw Error(`Failed to load ${e} from ${t.join(`, `)}`,{cause:n})}let ee={authToken:l,connectionMeta:s,metaBaseUrl:c,events:i,clientRpc:p,callTimeout:e.callTimeout,rpcOptions:{...n,async onRequest(e,t,i){if(await n.onRequest?.call(this,e,t,i),r&&d?.validate(e.m)){if(d.has(e.m,e.a))return i(d.cached(e.m,e.a));let n=await t(e);d.apply(e,n)}else await t(e)}}},v=DT(e.transport??`auto`,s),te=v===`static`?await sT({fetchJsonFromBases:_}):v===`sse`?Zw({...ee,sseOptions:e.sseOptions}):hT({...ee,wsOptions:e.wsOptions}),ne;try{ne=new BroadcastChannel(`devframe-auth`)}catch{}let re,ie=!1;function ae(e){return((...t)=>ie||!re?e(...t):re.then(()=>e(...t)))}function oe(){g=!0;try{h?.(),m?.()}finally{try{ne?.close()}finally{te.close?.()}}}let se={events:i,get isTrusted(){return te.isTrusted},get status(){return te.status},get connectionError(){return te.connectionError},get transport(){return te.transport??v},get connection(){return o},connectionMeta:s,ensureTrusted:te.ensureTrusted,requestTrust:te.requestTrust,requestTrustWithToken:async e=>(Aw(e),o={...o,authToken:e},te.requestTrustWithToken(e)),requestTrustWithCode:async e=>{let t=await te.requestTrustWithCode(e);if(!t)return!1;Aw(t),o={...o,authToken:t};try{ne?.postMessage({type:`auth-update`,authToken:t})}catch{}return!0},requestAuthCode:e=>te.requestAuthCode(e),call:ae(te.call),callEvent:ae(te.callEvent),callOptional:ae(te.callOptional),client:p,sharedState:void 0,services:void 0,streaming:void 0,cacheManager:d,scope:void 0,close:oe};se.sharedState=Vw(se),se.streaming=uT(se),se.services=Bw(se);let ce=new Map;se.scope=(e=>{if(!e)return se;let t=ce.get(e);return t||(t=xT(se,e),ce.set(e,t)),t}),f.rpc=se;function le(){try{return typeof window<`u`&&window.self===window.top}catch{return!1}}async function ue(){if(e.simpleAuth!==!1&&le()&&typeof globalThis.prompt==`function`)for(await se.requestAuthCode().catch(()=>{});!se.isTrusted;){let e=globalThis.prompt(`devframe: enter the authentication code shown in your terminal`);if(e==null)return;let t=e.trim();if(t&&await se.requestTrustWithCode(t))return}}async function de(){let t=await te.requestTrust(),n=e.otpParam??`devframe_otp`,r=n?await zw(se,{param:n}):!1;t||r||se.isTrusted||await ue()}return re=de().then(()=>{ie=!0},()=>{ie=!0}),s.mcp&&tw(async()=>{let{setupBrowserAgentRpcBridge:e}=await import(`./browser-agent-rpc-BXhoSh1z-Bhxzy5Us.js`);return{setupBrowserAgentRpcBridge:e}},[],import.meta.url).then(({setupBrowserAgentRpcBridge:e})=>{g||(h=e(se))}).catch(()=>{}),ne&&(ne.onmessage=e=>{e.data?.type===`auth-update`&&e.data.authToken&&se.requestTrustWithToken(e.data.authToken)}),se}var kT=OT,AT=[`components`,`injectors`,`signals`,`ngrx`,`forms`,`router`,`pipes`,`http`,`analog`],jT=[`forms`,`router`,`ngrx`,`http`,`analog`],MT={refreshMs:{default:3e3,min:500,max:8e3},navigations:{default:50,min:5,max:500},formTimeline:{default:200,min:10,max:2e3},httpCalls:{default:200,min:10,max:2e3},changeLog:{default:200,min:10,max:2e3},cdCycles:{default:200,min:10,max:2e3}},NT=[[200,`OK`],[201,`Created`],[202,`Accepted`],[203,`Non-Authoritative Information`],[204,`No Content`],[205,`Reset Content`],[206,`Partial Content`],[207,`Multi-Status`],[208,`Already Reported`],[226,`IM Used`],[300,`Multiple Choices`],[301,`Moved Permanently`],[302,`Found`],[303,`See Other`],[304,`Not Modified`],[307,`Temporary Redirect`],[308,`Permanent Redirect`],[400,`Bad Request`],[401,`Unauthorized`],[402,`Payment Required`],[403,`Forbidden`],[404,`Not Found`],[405,`Method Not Allowed`],[406,`Not Acceptable`],[407,`Proxy Authentication Required`],[408,`Request Timeout`],[409,`Conflict`],[410,`Gone`],[411,`Length Required`],[412,`Precondition Failed`],[413,`Content Too Large`],[414,`URI Too Long`],[415,`Unsupported Media Type`],[416,`Range Not Satisfiable`],[417,`Expectation Failed`],[418,`I'm a Teapot`],[421,`Misdirected Request`],[422,`Unprocessable Content`],[423,`Locked`],[424,`Failed Dependency`],[425,`Too Early`],[426,`Upgrade Required`],[428,`Precondition Required`],[429,`Too Many Requests`],[431,`Request Header Fields Too Large`],[451,`Unavailable For Legal Reasons`],[499,`Client Closed Request`],[500,`Internal Server Error`],[501,`Not Implemented`],[502,`Bad Gateway`],[503,`Service Unavailable`],[504,`Gateway Timeout`],[505,`HTTP Version Not Supported`],[506,`Variant Also Negotiates`],[507,`Insufficient Storage`],[508,`Loop Detected`],[510,`Not Extended`],[511,`Network Authentication Required`],[520,`Web Server Returned an Unknown Error`],[521,`Web Server Is Down`],[522,`Connection Timed Out`],[523,`Origin Is Unreachable`],[524,`A Timeout Occurred`]];function PT(e){return NT.some(([t])=>t===e)}var FT=`pangular`;function IT(e){return e&&typeof e==`object`&&!Array.isArray(e)?e:{}}function LT(e,t){return typeof e==`boolean`?e:t}var RT=100,zT=100;function BT(e){if(!Array.isArray(e))return[];let t=e.filter(e=>typeof e==`string`).map(e=>e.trim()).filter(e=>e&&e.length<=zT);return[...new Set(t)].slice(0,RT)}function VT(e,t){let{default:n,min:r,max:i}=MT[t];return typeof e!=`number`||!Number.isFinite(e)?n:Math.min(i,Math.max(r,Math.round(e)))}function HT(e,t){return Object.fromEntries(e.map(e=>[e,t(e)]))}function UT(e){let t=IT(e),n=IT(t.agent),r=IT(t.inspectors),i=IT(n.tools),a=IT(t.actions),o=LT(t.actions,!0),s=IT(t.redaction),c=IT(t.limits),l=HT(AT,e=>LT(r[e],!0));return{inspectors:l,agent:{readOnly:LT(n.readOnly,!1),tools:HT(AT,e=>l[e]&&LT(i[e],!0))},actions:HT(jT,e=>l[e]&&LT(a[e],o)),redaction:{secretNames:BT(s.secretNames),unmask:BT(s.unmask)},limits:Object.fromEntries(Object.keys(MT).map(e=>[e,VT(c[e],e)]))}}function WT(e){let t=e?.configs;return UT(t?.[FT])}function GT(e){return`${{forms:`Writing to forms`,router:`Navigating`,ngrx:`Restoring NgRx state and dispatching actions`,http:`Changing HTTP mock rules and clearing HTTP calls`,analog:`Calling API routes`}[e]} is turned off in the devtools config (actions.${e}).`}var KT={components:`Components`,injectors:`Injectors`,signals:`Signals`,ngrx:`NgRx`,forms:`Forms`,router:`Router`,pipes:`Pipes`,http:`HTTP`,analog:`Analog`},qT={forms:`Form writes`,router:`Navigation`,ngrx:`NgRx restore and dispatch`,http:`HTTP mocking`,analog:`Analog API calls`},JT={refreshMs:e=>`poll every ${e} ms`,navigations:e=>`${e} navigations`,formTimeline:e=>`${e} form events`,httpCalls:e=>`${e} HTTP calls`,changeLog:e=>`${e} NgRx changes`,cdCycles:e=>`${e} change detection cycles`};function YT(e){let t=[],n=(e,n)=>{n.length&&t.push({label:e,value:n.join(`, `)})},r=AT.filter(t=>e.inspectors[t]);return n(`Inspectors off`,AT.filter(t=>!e.inspectors[t]).map(e=>KT[e])),n(`Agent`,e.agent.readOnly?[`Read-only`]:[]),n(`Hidden from the agent`,r.filter(t=>!e.agent.tools[t]).map(e=>KT[e])),n(`Blocked actions`,jT.filter(t=>e.inspectors[t]&&!e.actions[t]).map(e=>qT[e])),n(`Extra secret names`,e.redaction.secretNames),n(`Unmasked names`,e.redaction.unmask),n(`Limits`,Object.keys(MT).filter(t=>e.limits[t]!==MT[t].default).map(t=>JT[t](e.limits[t]))),t}var XT=`pangular-page-id`,ZT=null;function QT(e){ZT=e}function $T(){if(ZT)return ZT;try{return new URLSearchParams(location.search).get(`pageId`)||(window.top===window?null:sessionStorage.getItem(XT)||null)}catch{return null}}function eE(e,t){if(t.chosen&&e[t.chosen])return t.chosen;if(t.host)return t.host;if(t.previous&&e[t.previous])return t.previous;let n=null;for(let t of Object.values(e))(!n||t.reportedAt>n.reportedAt)&&(n=t);return n?.pageId??null}function tE(e,t){return e?t?e.pages?.[t]??null:e:null}function nE(e,t){return e?t?e.pages?.[t]??null:e.graph??null:null}function rE(e,t,n){return e?e.scope(`pangular`).rpc.call(t,...n===void 0?[]:[n]):Promise.resolve(null)}function iE(e,t,n){return rE(e,t,n).then(e=>e,()=>null)}function aE(e){return e?.connectionMeta.backend===`static`}function oE(e){let t=()=>{let t=e()?.scope(`pangular`).rpc;t&&(t.callEvent(`request-page-highlight`,null),t.callEvent(`request-form-highlight`,null))};return addEventListener(`pagehide`,t),()=>{removeEventListener(`pagehide`,t),t()}}function sE(e){return WT(e?.connectionMeta)}function cE(e,t){return sE(e).actions[t]}var lE={components:`components`,routes:`router`,signals:`signals`,injectors:`injectors`,store:`ngrx`,forms:`forms`,pipes:`pipes`,network:`http`,analog:`analog`};function uE(e,t){let n=lE[e];return!n||t.inspectors[n]}function dE(e,t){e&1&&(A(),Fg(0,`rect`,3)(1,`rect`,4)(2,`rect`,5)(3,`rect`,6))}function fE(e,t){e&1&&(A(),Fg(0,`path`,7)(1,`path`,8)(2,`path`,9))}function pE(e,t){e&1&&(A(),Fg(0,`circle`,10)(1,`path`,11)(2,`circle`,12))}function mE(e,t){e&1&&(A(),Fg(0,`path`,1))}function hE(e,t){e&1&&(A(),Fg(0,`path`,13)(1,`path`,14)(2,`path`,15)(3,`path`,16))}function gE(e,t){e&1&&(A(),Fg(0,`ellipse`,17)(1,`path`,18)(2,`path`,19))}function _E(e,t){e&1&&(A(),Fg(0,`rect`,20)(1,`path`,21)(2,`path`,22)(3,`path`,23))}function vE(e,t){e&1&&(A(),Fg(0,`circle`,24)(1,`path`,25)(2,`path`,26))}function yE(e,t){e&1&&(A(),Fg(0,`path`,27)(1,`path`,28)(2,`path`,29)(3,`path`,30)(4,`circle`,31))}function bE(e,t){e&1&&(A(),Fg(0,`path`,2))}var xE=class e{name=$.required();static ɵfac=function(t){return new(t||e)};static ɵcmp=Bh({type:e,selectors:[[`app-tab-icon`]],inputs:{name:[1,`name`]},decls:11,vars:1,consts:[[`viewBox`,`0 0 24 24`,`width`,`16`,`height`,`16`,`fill`,`none`,`stroke`,`currentColor`,`stroke-width`,`1.8`,`stroke-linecap`,`round`,`stroke-linejoin`,`round`,`aria-hidden`,`true`],[`d`,`M22 12h-4l-3 9L9 3l-3 9H2`],[`d`,`m8 3 4 8 5-5 5 15H2L8 3z`],[`x`,`3`,`y`,`3`,`width`,`7`,`height`,`9`,`rx`,`1.5`],[`x`,`14`,`y`,`3`,`width`,`7`,`height`,`5`,`rx`,`1.5`],[`x`,`14`,`y`,`12`,`width`,`7`,`height`,`9`,`rx`,`1.5`],[`x`,`3`,`y`,`16`,`width`,`7`,`height`,`5`,`rx`,`1.5`],[`d`,`M12 2 3 7l9 5 9-5-9-5Z`],[`d`,`m3 12 9 5 9-5`],[`d`,`m3 17 9 5 9-5`],[`cx`,`6`,`cy`,`19`,`r`,`3`],[`d`,`M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15`],[`cx`,`18`,`cy`,`5`,`r`,`3`],[`d`,`M12 22v-5`],[`d`,`M9 8V2`],[`d`,`M15 8V2`],[`d`,`M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z`],[`cx`,`12`,`cy`,`5`,`rx`,`9`,`ry`,`3`],[`d`,`M3 5v14a9 3 0 0 0 18 0V5`],[`d`,`M3 12a9 3 0 0 0 18 0`],[`x`,`3`,`y`,`4`,`width`,`18`,`height`,`16`,`rx`,`2`],[`d`,`M7 9h10`],[`d`,`M7 13h6`],[`d`,`M7 17h8`],[`cx`,`12`,`cy`,`12`,`r`,`9`],[`d`,`M3 12h18`],[`d`,`M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18Z`],[`d`,`M4 7h10`],[`d`,`M4 17h6`],[`d`,`m14 13 4 4-4 4`],[`d`,`M10 17h8`],[`cx`,`18`,`cy`,`7`,`r`,`3`]],template:function(e,t){if(e&1&&(A(),H(0,`svg`,0),P(1,dE,4,0)(2,fE,3,0)(3,pE,3,0)(4,mE,1,0,`:svg:path`,1)(5,hE,4,0)(6,gE,3,0)(7,_E,4,0)(8,vE,3,0)(9,yE,5,0)(10,bE,1,0,`:svg:path`,2),U()),e&2){let e;M(),F((e=t.name())===`dashboard`?1:e===`components`?2:e===`routes`?3:e===`signals`?4:e===`injectors`?5:e===`store`?6:e===`forms`?7:e===`network`?8:e===`pipes`?9:e===`analog`?10:-1)}},styles:[`[_nghost-%COMP%] {
  display: inline-flex;
  flex-shrink: 0;
}`]})},SE=(e,t)=>t.tab,CE=(e,t)=>t.label;function wE(e,t){e&1&&J(0),e&2&&X(` `,K().meta()?.projectName,` `)}function TE(e,t){e&1&&J(0,` Project details unavailable `)}function EE(e,t){e&1&&J(0,` Loading… `)}function DE(e,t){e&1&&(J(0,` Run `),z(1,`code`),J(2,`pangular build`),B(),J(3,` again to rebuild the report. `))}function OE(e,t){e&1&&J(0,` Check that the dev server is running, then reload the panel. `)}function kE(e,t){if(e&1&&(z(0,`p`,4),P(1,DE,4,0)(2,OE,1,0),B()),e&2){let e=K();M(),F(e.staticReport()?1:2)}}function AE(e,t){e&1&&(z(0,`li`,6)(1,`span`),J(2,`Analog`),B(),J(3),B()),e&2&&(M(3),Y(t))}function jE(e,t){e&1&&(z(0,`li`)(1,`span`),J(2,`Change detection`),B(),J(3),B()),e&2&&(M(3),Y(t))}function ME(e,t){if(e&1&&(z(0,`span`,17),J(1),B(),z(2,`span`,18),J(3),B()),e&2){let e=K().$implicit,t=K();M(),Y(t.cards()[e.tab]?.value),M(2),Y(t.cards()[e.tab]?.sub)}}function NE(e,t){e&1&&(z(0,`span`,19),J(1,`–`),B(),z(2,`span`,18),J(3,`Count unavailable`),B())}function PE(e,t){e&1&&(V(0,`span`,20),z(1,`span`,18),J(2,`Counting…`),B())}function FE(e,t){if(e&1){let e=W();z(0,`button`,11),G(`click`,function(){let t=O(e).$implicit;return k(K().navigate.emit(t.tab))}),z(1,`span`,12)(2,`span`,13),V(3,`app-tab-icon`,14),B(),z(4,`span`,15),J(5,`→`),B()(),z(6,`span`,16),J(7),B(),P(8,ME,4,2)(9,NE,4,0)(10,PE,3,0),B()}if(e&2){let e,n=t.$implicit,r=t.$index,i=K().stateOf(n.tab);C_(`animation-delay`,60*r,`ms`),N(`aria-busy`,i===`loading`),M(3),R(`name`,n.tab),M(4),Y(n.label),M(),F((e=i)===`ready`?8:e===`error`?9:10)}}function IE(e,t){e&1&&(z(0,`p`),J(1,`Loading…`),B())}function LE(e,t){if(e&1&&(z(0,`div`)(1,`dt`),J(2),B(),z(3,`dd`),J(4),B()()),e&2){let e=t.$implicit;M(2),Y(e.label),M(2),Y(e.value)}}function RE(e,t){if(e&1&&(z(0,`dl`),I(1,LE,5,2,`div`,null,CE),B()),e&2){let e=K();M(),L(e.configItems())}}function zE(e,t){e&1&&(z(0,`p`),J(1,`Defaults`),B())}var BE=[{tab:`components`,label:`Components`},{tab:`routes`,label:`Routes`},{tab:`signals`,label:`Signals`},{tab:`injectors`,label:`Injectors`},{tab:`store`,label:`NgRx declarations`},{tab:`pipes`,label:`Pipes`}],VE={zoneless:`Zoneless`,zone:`zone.js`,"zone-unused":`Zoneless, zone.js loaded`};function HE(e){return e&&Object.hasOwn(VE,e)?VE[e]:null}var UE=new Set([`signal`,`computed`,`linkedSignal`,`effect`]),WE={action:[`action`,`actions`],reducer:[`reducer`,`reducers`],effect:[`effect`,`effects`],selector:[`selector`,`selectors`],feature:[`feature`,`features`],"store-setup":[`setup call`,`setup calls`],"signal-store":[`signal store`,`signal stores`],"signal-state":[`signal state`,`signal states`],"signal-method":[`signal method`,`signal methods`]};function GE(e,t,n){return`${e} ${e===1?t:n}`}function KE(e,t){for(let n of e??[])t(n),KE(n.children,t)}function qE(e){if(!e.some(e=>e.kind))return{value:e.length,sub:`discovered in source`};let t=e.filter(e=>e.kind===`directive`).length;return{value:e.length-t,sub:`components · ${GE(t,`directive`,`directives`)}`}}function JE(e){if(!e.some(e=>e.kind))return{value:e.length,sub:`route entries in source`};let t=e.filter(e=>e.kind===`redirect`).length;return{value:new Set(e.filter(e=>e.kind===`page`).map(e=>e.fullPath??e.path??``)).size,sub:`navigable paths · ${GE(t,`redirect`,`redirects`)}`}}function YE(e){let t=new Map;for(let n of e)n.kind&&t.set(n.kind,(t.get(n.kind)??0)+1);if(!t.size)return{value:e.length,sub:`declarations in source`};let n=[...t].sort((e,t)=>t[1]-e[1]).map(([e,t])=>{let[n,r]=WE[e]??[e,e];return GE(t,n,r)});return{value:e.length,sub:n.join(` · `)}}var XE=class e{rpc=$(null);navigate=Ov();staticReport=Q(()=>aE(this.rpc()));meta=j(null);config=Q(()=>sE(this.rpc()));stats=Q(()=>this.rpc()?BE.filter(e=>uE(e.tab,this.config())):[]);configItems=Q(()=>YT(this.config()));metaState=j(`loading`);states=j({});rows=j({});injectorTree=j(null);signalGraph=j(null);pageId=$T();destroyRef=E(Cs);stopLive=[];zone=Q(()=>HE(tE(this.injectorTree(),this.pageId)?.zone));liveInjectors=Q(()=>{let e=tE(this.injectorTree(),this.pageId);if(!e?.roots?.length)return null;let t=0,n=0,r=e=>{t++,n+=e.providers?.length??0};return KE(e.roots,r),KE(e.environment,r),{injectors:t,providers:n}});liveSignals=Q(()=>{let e=nE(this.signalGraph(),this.pageId);return e?.nodes?.length?e.nodes.filter(e=>UE.has(e.kind??``)).length:null});cards=Q(()=>{let e=this.rows(),t={};if(e.components&&(t.components=qE(e.components)),e.routes&&(t.routes=JE(e.routes)),e.store&&(t.store=YE(e.store)),e.pipes){let n=e.pipes.filter(e=>e.builtin).length;t.pipes={value:e.pipes.length-n,sub:n?`custom pipes · ${n} built-in in use`:`custom pipes in source`}}let n=this.liveSignals();n===null?e.signals&&(t.signals={value:e.signals.length,sub:`signal declarations in source`}):t.signals={value:n,sub:e.signals?`live on the page · ${e.signals.length} declared in source`:`live on the page`};let r=this.liveInjectors();return r?t.injectors={value:r.injectors,sub:`live injectors · ${GE(r.providers,`provider`,`providers`)}`}:e.injectors&&(t.injectors={value:e.injectors.filter(e=>e.type!==`injection`).length,sub:`provider declarations in source`}),t});constructor(){uc(()=>{let e=this.rpc();if(!e)return;let t=e.scope(`pangular`);this.metaState.set(`loading`),this.states.set({}),this.rows.set({}),t.rpc.call(`build-meta`).then(e=>{this.meta.set(e),this.metaState.set(`ready`)}).catch(()=>this.metaState.set(`error`));let n=sE(e),r=e=>uE(e,n);r(`components`)&&this.load(t.rpc.call(`get-components`),`components`),r(`routes`)&&this.load(t.rpc.call(`get-routes`),`routes`),r(`signals`)&&this.load(t.rpc.call(`get-signals`),`signals`),r(`injectors`)&&this.load(t.rpc.call(`get-providers`),`injectors`),r(`store`)&&this.load(t.rpc.call(`get-ngrx-store`),`store`),r(`pipes`)&&this.load(t.rpc.call(`get-pipes`),`pipes`),this.watchLive(e,n)}),this.destroyRef.onDestroy(()=>this.unwatch())}stateOf(e){return(e===`signals`?this.liveSignals():e===`injectors`?this.liveInjectors():null)===null?this.states()[e]??`loading`:`ready`}load(e,t){let n=e=>this.states.update(n=>({...n,[t]:e}));e.then(e=>{this.rows.update(n=>({...n,[t]:Array.isArray(e)?e:[]})),n(`ready`)}).catch(()=>n(`error`))}async watchLive(e,t){this.unwatch();let n=e.scope(`pangular`).rpc,r=async(t,r)=>{try{let i=await n.sharedState(t);if(this.destroyRef.destroyed||this.rpc()!==e)return;r(i.value()),this.stopLive.push(i.on(`updated`,e=>r(e)))}catch{r(null)}};await Promise.all([t.inspectors.injectors&&r(`injector-tree`,e=>this.injectorTree.set(e)),t.inspectors.signals&&r(`signal-graph`,e=>this.signalGraph.set(e))])}unwatch(){for(let e of this.stopLive.splice(0))e()}static ɵfac=function(t){return new(t||e)};static ɵcmp=Bh({type:e,selectors:[[`app-dashboard`]],inputs:{rpc:[1,`rpc`]},outputs:{navigate:`navigate`},decls:33,vars:14,consts:[[`aria-labelledby`,`project-title`,1,`project`],[1,`project-head`],[1,`eyebrow`],[`id`,`project-title`],[1,`hint`],[1,`chips`],[1,`analog`],[1,`grid`],[`type`,`button`,1,`stat`,3,`animation-delay`],[`aria-labelledby`,`config-title`,1,`config`],[`id`,`config-title`],[`type`,`button`,1,`stat`,3,`click`],[1,`top`],[1,`icon`],[3,`name`],[`aria-hidden`,`true`,1,`go`],[1,`label`],[1,`big`],[1,`sub`],[1,`big`,`muted`],[`aria-hidden`,`true`,1,`big`,`skeleton`]],template:function(e,t){if(e&1&&(z(0,`section`,0)(1,`div`,1)(2,`p`,2),J(3,`Project`),B(),z(4,`h2`,3),P(5,wE,1,1)(6,TE,1,0)(7,EE,1,0),B(),P(8,kE,3,1,`p`,4),B(),z(9,`ul`,5)(10,`li`)(11,`span`),J(12,`Angular`),B(),J(13),B(),z(14,`li`)(15,`span`),J(16,`TypeScript`),B(),J(17),B(),z(18,`li`)(19,`span`),J(20,`SSR`),B(),J(21),B(),P(22,AE,4,1,`li`,6),P(23,jE,4,1,`li`),B()(),z(24,`div`,7),I(25,FE,11,6,`button`,8,SE),B(),z(27,`section`,9)(28,`h2`,10),J(29,`Configuration`),B(),P(30,IE,2,0,`p`)(31,RE,3,0,`dl`)(32,zE,2,0,`p`),B()),e&2){let e,n,r;N(`aria-busy`,t.metaState()===`loading`),M(4),q(`muted`,t.metaState()!==`ready`),M(),F((e=t.metaState())===`ready`?5:e===`error`?6:7),M(3),F(t.metaState()===`error`?8:-1),M(),q(`pending`,t.metaState()===`loading`),M(4),Y(t.meta()?.angularVersion??`…`),M(4),Y(t.meta()?.typescript??`…`),M(4),Y(t.meta()?t.meta()?.ssr?`On`:`Off`:`…`),M(),F((n=t.meta()?.analog)?22:-1,n),M(),F((r=t.zone())?23:-1,r),M(2),L(t.stats()),M(2),N(`aria-busy`,!t.rpc()),M(3),F(t.rpc()?t.configItems().length?31:32:30)}},dependencies:[xE],styles:[`[_nghost-%COMP%] {
  display: block;
  max-width: 1200px;
}

.project[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 16px 24px;
  margin-bottom: 16px;
  padding: 24px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: radial-gradient(420px 180px at 100% 0%, var(--%NS%accent-soft), transparent 70%), linear-gradient(180deg, var(--%NS%surface-2), var(--%NS%surface));
  box-shadow: var(--%NS%shadow);
}

.project-head[_ngcontent-%COMP%] {
  flex: 1 1 240px;
  min-width: 0;
}

.eyebrow[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin: 0 0 4px;
  color: var(--%NS%accent);
}

h2[_ngcontent-%COMP%] {
  margin: 0;
  color: var(--%NS%text-strong);
  font-size: 24px;
  line-height: 1.25;
  letter-spacing: -0.02em;
  overflow-wrap: anywhere;
}

h2.muted[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
  font-weight: 600;
}

.hint[_ngcontent-%COMP%] {
  margin: 8px 0 0;
  color: var(--%NS%text-2);
  font-size: 13px;
  line-height: 1.5;
}

.chips[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-width: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.chips[_ngcontent-%COMP%]   li[_ngcontent-%COMP%] {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: 28px;
  max-width: 100%;
  padding: 0 12px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: 99px;
  background: var(--%NS%bg);
  color: var(--%NS%text-strong);
  font-size: 12px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.chips[_ngcontent-%COMP%]   span[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-weight: 500;
}

.chips.pending[_ngcontent-%COMP%]   li[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
}

.chips[_ngcontent-%COMP%]   .analog[_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, #dd0330 55%, transparent);
}

.grid[_ngcontent-%COMP%] {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 150px), 1fr));
  gap: 12px;
}

.stat[_ngcontent-%COMP%] {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  min-width: 0;
  padding: 16px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  color: inherit;
  text-align: left;
  font: inherit;
  cursor: pointer;
  animation: enter 0.4s var(--%NS%ease) both;
  transition: border-color 0.2s var(--%NS%ease), transform 0.2s var(--%NS%ease), background-color 0.2s var(--%NS%ease), box-shadow 0.2s var(--%NS%ease);
}

.stat[_ngcontent-%COMP%]:hover {
  border-color: var(--%NS%accent-line);
  background: var(--%NS%surface-2);
  box-shadow: var(--%NS%shadow);
  transform: translateY(-2px);
}

.stat[_ngcontent-%COMP%]:active {
  transform: translateY(0);
  background: var(--%NS%surface-3);
}

.stat[_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: 2px;
}

.top[_ngcontent-%COMP%] {
  display: flex;
  align-items: center;
  justify-content: space-between;
  align-self: stretch;
  margin-bottom: 12px;
}

.icon[_ngcontent-%COMP%] {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  border: 1px solid var(--%NS%accent-line);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%accent-soft);
  color: var(--%NS%accent);
}

.go[_ngcontent-%COMP%] {
  display: grid;
  place-items: center;
  width: 24px;
  height: 24px;
  color: var(--%NS%text-3);
  transition: transform 0.2s var(--%NS%ease), color 0.2s var(--%NS%ease);
}

.stat[_ngcontent-%COMP%]:hover   .go[_ngcontent-%COMP%], 
.stat[_ngcontent-%COMP%]:focus-visible   .go[_ngcontent-%COMP%] {
  color: var(--%NS%accent);
  transform: translateX(3px);
}

.label[_ngcontent-%COMP%] {
  max-width: 100%;
  overflow: hidden;
  color: var(--%NS%text-2);
  font-size: 13px;
  font-weight: 500;
  line-height: 16px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.big[_ngcontent-%COMP%] {
  margin: 4px 0;
  color: var(--%NS%text-strong);
  font-size: 32px;
  font-weight: 750;
  line-height: 40px;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}

.big.muted[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
}

.skeleton[_ngcontent-%COMP%] {
  display: block;
  width: 56px;
  height: 32px;
  margin-block: 8px;
  border-radius: var(--%NS%radius-sm);
  background: linear-gradient(90deg, var(--%NS%surface-2), var(--%NS%surface-3), var(--%NS%surface-2)) 0 0/200% 100%;
  animation: _ngcontent-%COMP%_shimmer 1.4s linear infinite;
}

.sub[_ngcontent-%COMP%] {
  max-width: 100%;
  color: var(--%NS%text-3);
  font-size: 12px;
  line-height: 16px;
}

.config[_ngcontent-%COMP%] {
  margin-top: 16px;
  padding: 16px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
}

.config[_ngcontent-%COMP%]   h2[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin: 0 0 8px;
  color: var(--%NS%text-2);
}

.config[_ngcontent-%COMP%]   p[_ngcontent-%COMP%], 
.config[_ngcontent-%COMP%]   dl[_ngcontent-%COMP%] {
  margin: 0;
  color: var(--%NS%text);
  font-size: 13px;
  line-height: 1.5;
}

.config[_ngcontent-%COMP%]   dl[_ngcontent-%COMP%] {
  display: grid;
  gap: 4px;
}

.config[_ngcontent-%COMP%]   dl[_ngcontent-%COMP%]   div[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
}

.config[_ngcontent-%COMP%]   dt[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
}

.config[_ngcontent-%COMP%]   dt[_ngcontent-%COMP%]::after {
  content: ":";
}

.config[_ngcontent-%COMP%]   dd[_ngcontent-%COMP%] {
  margin: 0;
  color: var(--%NS%text-strong);
  overflow-wrap: anywhere;
}

@keyframes _ngcontent-%COMP%_shimmer {
  to {
    background-position: -200% 0;
  }
}
@media (max-width: 480px) {
  .project[_ngcontent-%COMP%] {
    padding: 16px;
  }
  h2[_ngcontent-%COMP%] {
    font-size: 20px;
  }
  .stat[_ngcontent-%COMP%] {
    padding: 12px;
  }
  .big[_ngcontent-%COMP%] {
    font-size: 28px;
    line-height: 36px;
  }
}
@media (prefers-reduced-motion: reduce) {
  .stat[_ngcontent-%COMP%], 
   .stat[_ngcontent-%COMP%]:hover, 
   .stat[_ngcontent-%COMP%]:active {
    transform: none;
  }
  .stat[_ngcontent-%COMP%]:hover   .go[_ngcontent-%COMP%] {
    transform: none;
  }
  .skeleton[_ngcontent-%COMP%] {
    animation: none;
  }
}`]})},ZE=`pangular:panel-action-result`,QE=6e3,$E=0;function eD(e=window){return e.location.protocol===`chrome-extension:`&&e.parent!==e}function tD(e,t=window){let n=`pa-${Date.now().toString(36)}-${++$E}`;return new Promise(r=>{let i=e=>{t.clearTimeout(o),t.removeEventListener(`message`,a),r(e)},a=({source:e,origin:r,data:a})=>{if(e!==t.parent||r!==t.location.origin)return;let o=a;if(o?.type!==ZE||o.requestId!==n)return;let{opened:s,error:c}=a;i({ok:o.ok===!0,...s===`file`||s===`class`?{opened:s}:{},...typeof c==`string`?{error:c}:{}})},o=t.setTimeout(()=>i({ok:!1,error:`timeout`}),QE);t.addEventListener(`message`,a),t.parent.postMessage({...e,requestId:n},t.location.origin)})}var nD=class e{available=eD();reveal(e,t){return tD({type:`pangular:reveal-element`,pageId:e,id:t})}openSource(e,t,n){return tD({type:`pangular:open-source`,pageId:e,id:t,...n?{file:n.file,line:n.line}:{}})}static ɵfac=function(t){return new(t||e)};static ɵprov=kl({token:e,factory:e.ɵfac})};function rD(e){return e?.platform===`angular-native`}function iD(e,t){let n=Object.values(e??{}).filter(rD);if(t&&n.some(e=>e.pageId===t))return t;let r=null;for(let e of n)(!r||e.reportedAt>r.reportedAt)&&(r=e);return r?.pageId??null}var aD=[`trigger`],oD=[`list`],sD=(e,t)=>t.value;function cD(e,t){if(e&1&&(H(0,`span`,4),J(1),U()),e&2){let e=K();M(),Y(e.current().hint)}}function lD(e,t){if(e&1&&(H(0,`span`,15),J(1),U()),e&2){let e=K().$implicit;M(),Y(e.hint)}}function uD(e,t){if(e&1){let e=W();H(0,`li`,11),Qg(`pointerenter`,function(){let t=O(e).$index;return k(K(2).active.set(t))})(`pointerdown`,function(e){return e.preventDefault()})(`click`,function(){let t=O(e).$index;return k(K(2).choose(t))}),A(),H(1,`svg`,12),Fg(2,`path`,13),U(),ps(),H(3,`span`,14),J(4),U(),P(5,lD,2,1,`span`,15),U()}if(e&2){let e=t.$implicit,n=t.$index,r=K(2);q(`active`,n===r.active())(`selected`,e.value===r.value()),N(`id`,r.uid+`-opt-`+n)(`aria-selected`,e.value===r.value())(`aria-disabled`,e.disabled||null),M(4),Y(e.label),M(),F(e.hint?5:-1)}}function dD(e,t){if(e&1&&(H(0,`li`,10),J(1),U()),e&2){let e=K(2);M(),Y(e.emptyText())}}function fD(e,t){if(e&1&&(H(0,`ul`,8,1),dg(`list-in`),Qg(`pointerdown`,function(e){return e.preventDefault()}),I(2,uD,6,9,`li`,9,sD,!1,dD,2,1,`li`,10),U()),e&2){let e=K();q(`up`,e.dropUp()),N(`id`,e.uid+`-list`)(`aria-labelledby`,e.labelledBy()||e.uid+`-trigger`),M(2),L(e.options())}}var pD=0,mD=class e{options=$.required();value=Fv(null);placeholder=$(`Select…`);ariaLabel=$(``);labelledBy=$(``);disabled=$(!1);emptyText=$(`Nothing to choose`);uid=`app-select-${++pD}`;open=j(!1);active=j(-1);dropUp=j(!1);current=Q(()=>this.options().find(e=>e.value===this.value())??null);host=E(Ml);injector=E(xs);trigger=Rv.required(`trigger`);list=Rv(`list`);typed=``;typedAt=0;toggle(){this.open()?this.close():this.show()}choose(e){let t=this.options()[e];t&&!t.disabled&&(this.value.set(t.value),this.close(),this.trigger().nativeElement.focus())}onKey(e){let t=this.options(),n=this.open();switch(e.key){case`ArrowDown`:case`ArrowUp`:if(e.preventDefault(),!n){this.show();return}this.move(e.key===`ArrowDown`?1:-1);return;case`Home`:case`End`:if(!n)return;e.preventDefault(),this.setActive(e.key===`Home`?this.firstEnabled(0,1):this.firstEnabled(t.length-1,-1));return;case`Enter`:case` `:e.preventDefault(),n&&this.active()>=0?this.choose(this.active()):this.show();return;case`Escape`:if(!n)return;e.preventDefault(),e.stopPropagation(),this.close();return;case`Tab`:n&&this.close();return;default:e.key.length===1&&!e.metaKey&&!e.ctrlKey&&!e.altKey&&this.typeAhead(e.key)}}onBlur(e){let t=e.relatedTarget;t&&this.host.nativeElement.contains(t)||this.close()}onOutside(e){this.open()&&!this.host.nativeElement.contains(e.target)&&this.close()}show(){if(this.disabled())return;let e=this.host.nativeElement.getBoundingClientRect(),t=window.innerHeight-e.bottom;this.dropUp.set(t<220&&e.top>t);let n=this.options().findIndex(e=>e.value===this.value());this.open.set(!0),this.setActive(n>=0?n:this.firstEnabled(0,1))}close(){this.open.set(!1),this.active.set(-1)}move(e){let t=this.firstEnabled(this.active()+e,e);t>=0&&this.setActive(t)}firstEnabled(e,t){let n=this.options();for(let r=e;r>=0&&r<n.length;r+=t)if(!n[r].disabled)return r;return-1}setActive(e){this.active.set(e),!(e<0)&&Id(()=>{(this.list()?.nativeElement.querySelector(`#${this.uid}-opt-${e}`))?.scrollIntoView({block:`nearest`})},{injector:this.injector})}typeAhead(e){let t=performance.now();this.typed=t-this.typedAt>600?e.toLowerCase():this.typed+e.toLowerCase(),this.typedAt=t;let n=this.options().findIndex(e=>!e.disabled&&e.label.toLowerCase().startsWith(this.typed));n<0||(this.open()?this.setActive(n):this.value.set(this.options()[n].value))}static ɵfac=function(t){return new(t||e)};static ɵcmp=Bh({type:e,selectors:[[`app-select`]],viewQuery:function(e,t){e&1&&e_(t.trigger,aD,5)(t.list,oD,5),e&2&&t_(2)},hostAttrs:[1,`app-select`],hostVars:2,hostBindings:function(e,t){e&1&&G(`pointerdown`,function(e){return t.onOutside(e)},Mu),e&2&&q(`open`,t.open())},inputs:{options:[1,`options`],value:[1,`value`],placeholder:[1,`placeholder`],ariaLabel:[1,`ariaLabel`],labelledBy:[1,`labelledBy`],disabled:[1,`disabled`],emptyText:[1,`emptyText`]},outputs:{value:`valueChange`},decls:8,vars:12,consts:[[`trigger`,``],[`list`,``],[`type`,`button`,`role`,`combobox`,`aria-haspopup`,`listbox`,1,`trigger`,3,`click`,`keydown`,`blur`,`disabled`],[1,`value`],[1,`value-hint`],[`viewBox`,`0 0 24 24`,`aria-hidden`,`true`,1,`chevron`],[`d`,`m6 9 6 6 6-6`],[`role`,`listbox`,`tabindex`,`-1`,1,`list`,3,`up`],[`role`,`listbox`,`tabindex`,`-1`,1,`list`,3,`pointerdown`],[`role`,`option`,3,`active`,`selected`],[`role`,`option`,`aria-disabled`,`true`,1,`empty`],[`role`,`option`,3,`pointerenter`,`pointerdown`,`click`],[`viewBox`,`0 0 24 24`,`aria-hidden`,`true`,1,`check`],[`d`,`m5 12 5 5 9-10`],[1,`label`],[1,`hint`]],template:function(e,t){e&1&&(H(0,`button`,2,0),Qg(`click`,function(){return t.toggle()})(`keydown`,function(e){return t.onKey(e)})(`blur`,function(e){return t.onBlur(e)}),H(2,`span`,3),J(3),U(),P(4,cD,2,1,`span`,4),A(),H(5,`svg`,5),Fg(6,`path`,6),U()(),P(7,fD,5,5,`ul`,7)),e&2&&(Vg(`disabled`,t.disabled()),N(`id`,t.uid+`-trigger`)(`aria-controls`,t.uid+`-list`)(`aria-expanded`,t.open())(`aria-label`,t.ariaLabel()||null)(`aria-labelledby`,t.labelledBy()||null)(`aria-activedescendant`,t.open()&&t.active()>=0?t.uid+`-opt-`+t.active():null),M(2),q(`placeholder`,!t.current()),M(),X(` `,t.current()?.label??t.placeholder(),` `),M(),F(t.current()?.hint?4:-1),M(3),F(t.open()?7:-1))},styles:[`[_nghost-%COMP%] {
  position: relative;
  display: inline-flex;
  min-width: 0;
  vertical-align: middle;
}

.trigger[_ngcontent-%COMP%] {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-width: 0;
  height: var(--%NS%control-h, 34px);
  padding: 0 10px 0 12px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%bg);
  color: var(--%NS%text);
  font: inherit;
  font-size: 13px;
  text-align: left;
  cursor: pointer;
  transition: border-color 150ms var(--%NS%ease), box-shadow 150ms var(--%NS%ease), background-color 150ms var(--%NS%ease);
}

.trigger[_ngcontent-%COMP%]:hover:not(:disabled) {
  border-color: color-mix(in srgb, var(--%NS%border-strong) 55%, var(--%NS%text-3));
}

.trigger[_ngcontent-%COMP%]:focus-visible, 
.open[_nghost-%COMP%]   .trigger[_ngcontent-%COMP%] {
  outline: none;
  border-color: var(--%NS%accent);
  box-shadow: 0 0 0 3px var(--%NS%accent-soft);
}

.trigger[_ngcontent-%COMP%]:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.value[_ngcontent-%COMP%] {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.value.placeholder[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
}

.value-hint[_ngcontent-%COMP%] {
  flex: 0 1 auto;
  min-width: 0;
  overflow: hidden;
  color: var(--%NS%text-3);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chevron[_ngcontent-%COMP%] {
  flex: none;
  width: 14px;
  height: 14px;
  fill: none;
  stroke: var(--%NS%text-3);
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform 150ms var(--%NS%ease);
}

.open[_nghost-%COMP%]   .chevron[_ngcontent-%COMP%] {
  transform: rotate(180deg);
  stroke: var(--%NS%accent);
}

.list[_ngcontent-%COMP%] {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  z-index: 50;
  box-sizing: border-box;
  min-width: 100%;
  max-width: min(480px, 100vw - 24px);
  max-height: 280px;
  margin: 0;
  padding: 4px;
  overflow: auto;
  list-style: none;
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%surface-2);
  box-shadow: 0 16px 40px -12px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(0, 0, 0, 0.2);
  overscroll-behavior: contain;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme=dark])   [_nghost-%COMP%]   .list[_ngcontent-%COMP%] {
    box-shadow: 0 12px 32px -12px rgba(0, 0, 0, 0.25);
  }
}
:root[data-theme=light]   [_nghost-%COMP%]   .list[_ngcontent-%COMP%] {
  box-shadow: 0 12px 32px -12px rgba(0, 0, 0, 0.25);
}

.list.up[_ngcontent-%COMP%] {
  top: auto;
  bottom: calc(100% + 6px);
}

.list-in[_ngcontent-%COMP%] {
  animation: _ngcontent-%COMP%_list-in 140ms var(--%NS%ease) both;
}

@keyframes _ngcontent-%COMP%_list-in {
  from {
    opacity: 0;
    transform: translateY(-4px) scale(0.98);
  }
}
li[_ngcontent-%COMP%] {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 32px;
  padding: 0 10px 0 8px;
  border-radius: 6px;
  color: var(--%NS%text);
  font-size: 13px;
  cursor: pointer;
  white-space: nowrap;
}

li.active[_ngcontent-%COMP%] {
  background: var(--%NS%surface-3);
}

li.selected[_ngcontent-%COMP%] {
  color: var(--%NS%text-strong);
  font-weight: 600;
}

li[aria-disabled=true][_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  cursor: default;
}

.check[_ngcontent-%COMP%] {
  flex: none;
  width: 14px;
  height: 14px;
  fill: none;
  stroke: var(--%NS%accent);
  stroke-width: 2.4;
  stroke-linecap: round;
  stroke-linejoin: round;
  visibility: hidden;
}

li.selected[_ngcontent-%COMP%]   .check[_ngcontent-%COMP%] {
  visibility: visible;
}

.label[_ngcontent-%COMP%] {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.hint[_ngcontent-%COMP%] {
  flex: none;
  max-width: 50%;
  overflow: hidden;
  color: var(--%NS%text-3);
  font-size: 12px;
  font-weight: 400;
  text-overflow: ellipsis;
}

.empty[_ngcontent-%COMP%] {
  justify-content: center;
}

@media (prefers-reduced-motion: reduce) {
  .list-in[_ngcontent-%COMP%] {
    animation: none;
  }
  .chevron[_ngcontent-%COMP%] {
    transition: none;
  }
}`]})};function hD(e,t){let n=t.trim().toLowerCase();if(!n)return{nodes:e,matches:0};let r=0,i=e=>e.name.toLowerCase().includes(n)||e.tag.toLowerCase().includes(n)||!!e.directives?.some(e=>e.toLowerCase().includes(n)),a=e=>e.flatMap(e=>{let t=i(e);t&&r++;let n=a(e.children);return t||n.length?[{...e,children:n}]:[]});return{nodes:a(e),matches:r}}function gD(e,t,n,r=!1){let i=r?`${e}+`:`${e}`;return n?`${t} of ${i}`:`${i} ${e===1&&!r?`instance`:`instances`}`}function _D(e,t,n,r=!1){return n.trim()?t?`${t} of ${r?`${e}+`:`${e}`} ${e===1&&!r?`instance`:`instances`} match.`:`No components match.`:``}function vD(e){let t=e?.components,n=e?.depth;return t&&n?`Showing the first ${t} component instances, and none nested more than ${n} elements deep. Others are not listed or searchable.`:t?`Showing the first ${t} component instances. Others are not listed or searchable.`:n?`Components nested more than ${n} elements deep are not listed or searchable.`:`The page has more components than the tree shows.`}function yD(e,t){let n=t?.detail?.id??null,r=t?.pageId??null;if(r!==e.pageId)return{pageId:r,selectedId:n,detailId:n,destroyed:null};let i=e.selectedId;return n&&n!==e.detailId&&n!==i&&(i=n),i&&t&&!t.truncated&&!bD(t.roots,i)?{pageId:r,selectedId:null,detailId:n,destroyed:i}:{pageId:r,selectedId:i,detailId:n,destroyed:null}}function bD(e,t){return e.some(e=>e.id===t||bD(e.children,t))}function xD(e,t,n){let r=e.indexOf(n);if(r<0)return null;for(let n=r+1;n<e.length;n++)if(t.has(e[n]))return e[n];for(let n=r-1;n>=0;n--)if(t.has(e[n]))return e[n];return null}function SD(e){return new Date(e).toLocaleTimeString()}function CD(e,t){if(e&1&&(H(0,`p`,0),J(1),H(2,`code`),J(3),U(),J(4,` to keep more. `),H(5,`a`,1),J(6,`About limits`),U()()),e&2){let e=K();M(),X_(` Showing the latest `,e.max(),` `,e.what(),`. `,e.dropped(),` older `,e.dropped()===1?`entry was`:`entries were`,` dropped. Raise `),M(2),X(`limits.`,e.limit()),M(2),Vg(`href`,e.docsUrl,ku)}}var wD=`https://pangular-inspector.dev/getting-started/configuration/#limits`,TD=class e{dropped=$(0);max=$.required();what=$.required();limit=$.required();docsUrl=wD;static ɵfac=function(t){return new(t||e)};static ɵcmp=Bh({type:e,selectors:[[`app-limit-note`]],inputs:{dropped:[1,`dropped`],max:[1,`max`],what:[1,`what`],limit:[1,`limit`]},decls:1,vars:1,consts:[[1,`note`],[`target`,`_blank`,`rel`,`noopener noreferrer`,3,`href`]],template:function(e,t){e&1&&P(0,CD,7,6,`p`,0),e&2&&F(t.dropped()>0?0:-1)},styles:[`[_nghost-%COMP%] {
  display: block;
}

.note[_ngcontent-%COMP%] {
  margin: 0 0 12px;
  padding: 8px 12px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%surface);
  color: var(--%NS%text-2);
  line-height: 1.5;
}

code[_ngcontent-%COMP%] {
  font-family: var(--%NS%font-mono);
  color: var(--%NS%text);
}

a[_ngcontent-%COMP%] {
  color: var(--%NS%accent);
  border-radius: 2px;
}

a[_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: 2px;
}`]})},ED=(e,t)=>t.id;function DD(e,t){if(e&1){let e=W();z(0,`button`,12),G(`click`,function(){return O(e),k(K().clear())}),J(1,`Clear`),B()}}function OD(e,t){e&1&&(z(0,`p`,8),J(1,`This page can't record change detection. It needs Angular 20 or later.`),B())}function kD(e,t){if(e&1&&(z(0,`tr`)(1,`td`,16),J(2),B(),z(3,`td`,17),J(4),B(),z(5,`td`,17),J(6),B(),z(7,`td`,17),J(8),B()()),e&2){let e=t.$implicit,n=K(2);M(2),Y(e.name),M(2),Y(e.checks),M(2),Y(n.ms(e.ms)),M(2),Y(n.ms(e.maxMs))}}function AD(e,t){if(e&1&&(z(0,`span`,19),J(1,`after `),z(2,`span`,16),J(3),B()()),e&2){let e=K().$implicit;M(3),Y(e.trigger)}}function jD(e,t){if(e&1&&(z(0,`span`,20),J(1,` slowest `),z(2,`span`,16),J(3),B(),J(4),B()),e&2){let e=t,n=K(3);M(3),Y(e.name),M(),X(` `,n.ms(e.ms),` `)}}function MD(e,t){if(e&1&&(z(0,`li`)(1,`span`,18),J(2),B(),z(3,`span`,16),J(4),B(),z(5,`span`),J(6),B(),P(7,AD,4,1,`span`,19),P(8,jD,5,2,`span`,20),B()),e&2){let e,n=t.$implicit,r=K(2);M(2),Y(r.clock(n.at)),M(2),Y(r.ms(n.ms)),M(2),X_(` `,n.checks,` `,n.checks===1?`check`:`checks`,`, `,n.passes,` `,n.passes===1?`pass`:`passes`,` `),M(),F(n.trigger?7:-1),M(),F((e=n.components[0])?8:-1,e)}}function ND(e,t){if(e&1&&(z(0,`div`,10)(1,`div`)(2,`h3`),J(3,`Slowest components`),B(),z(4,`table`)(5,`thead`)(6,`tr`)(7,`th`,13),J(8,`Component`),B(),z(9,`th`,14),J(10,`Checks`),B(),z(11,`th`,14),J(12,`Self time`),B(),z(13,`th`,14),J(14,`Slowest`),B()()(),z(15,`tbody`),I(16,kD,9,4,`tr`,null,Cg),B()()(),z(18,`div`)(19,`h3`),J(20,`Latest cycles`),B(),z(21,`ol`,15),I(22,MD,9,8,`li`,null,ED),B()()()),e&2){let e=K();M(16),L(e.slowest()),M(6),L(e.latest())}}function PD(e,t){e&1&&(z(0,`p`,11),J(1,`Use the app. Cycles show up here as Angular runs change detection.`),B())}var FD=10,ID=class e{page=$(null);pageId=$(null);rpc=$(null);message=j(``);recording=Q(()=>this.page()?.recording===!0);cycles=Q(()=>this.page()?.cycles??[]);maxCycles=Q(()=>sE(this.rpc()).limits.cdCycles);slowest=Q(()=>[...this.page()?.components??[]].sort((e,t)=>t.ms-e.ms).slice(0,FD));latest=Q(()=>this.cycles().slice(-30).reverse());status=Q(()=>{if(this.message())return this.message();let e=this.cycles().length;return this.recording()?`Recording. ${e} ${e===1?`cycle`:`cycles`} so far.`:e?`${e} ${e===1?`cycle`:`cycles`} recorded.`:``});ms(e){return`${e<10?e.toFixed(2):Math.round(e)} ms`}clock(e){return SD(e)}async toggle(){await this.send({on:!this.recording()},this.recording()?``:`Starting…`)}async clear(){await this.send({clear:!0},``)}async send(e,t){this.message.set(t);try{await rE(this.rpc(),`request-change-detection-record`,{pageId:this.pageId(),...e}),this.message.set(``)}catch{this.message.set(`Could not reach the page.`)}}static ɵfac=function(t){return new(t||e)};static ɵcmp=Bh({type:e,selectors:[[`app-cd-recording`]],inputs:{page:[1,`page`],pageId:[1,`pageId`],rpc:[1,`rpc`]},decls:16,vars:10,consts:[[`aria-labelledby`,`cd-heading`,1,`cd`],[1,`cd-head`],[`id`,`cd-heading`],[`type`,`button`,3,`click`,`disabled`],[`aria-hidden`,`true`,1,`dot`],[`type`,`button`],[`role`,`status`,1,`status`],[1,`hint`],[1,`note`],[`what`,`cycles`,`limit`,`cdCycles`,3,`dropped`,`max`],[1,`cd-grid`],[1,`empty`],[`type`,`button`,3,`click`],[`scope`,`col`],[`scope`,`col`,1,`num`],[`aria-label`,`Latest change detection cycles, newest first`,1,`cycles`],[1,`mono`],[1,`num`],[1,`when`],[1,`trigger`],[1,`top`]],template:function(e,t){e&1&&(z(0,`section`,0)(1,`div`,1)(2,`h2`,2),J(3,`Change detection`),B(),z(4,`button`,3),G(`click`,function(){return t.toggle()}),V(5,`span`,4),J(6),B(),P(7,DD,2,0,`button`,5),z(8,`p`,6),J(9),B()(),z(10,`p`,7),J(11,` Records each change detection cycle with Angular's profiler: how long it took, how many components it checked and the output that ran before it. Tree rows show how often each instance was checked. Times come from a development build. `),B(),P(12,OD,2,0,`p`,8),V(13,`app-limit-note`,9),P(14,ND,24,0,`div`,10)(15,PD,2,0,`p`,11),B()),e&2&&(M(4),q(`on`,t.recording()),R(`disabled`,!t.pageId()),M(2),X(` `,t.recording()?`Stop recording`:`Record`,` `),M(),F(t.cycles().length?7:-1),M(2),Y(t.status()),M(3),F(t.page()?.supported===!1?12:-1),M(),R(`dropped`,t.page()?.dropped??0)(`max`,t.maxCycles()),M(),F(t.slowest().length?14:t.recording()?15:-1))},dependencies:[TD],styles:[`[_nghost-%COMP%] {
  display: block;
  margin-top: 16px;
}

.cd[_ngcontent-%COMP%] {
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  padding: 12px 14px;
}

.cd-head[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

h2[_ngcontent-%COMP%] {
  margin: 0;
  font-size: 14px;
  color: var(--%NS%text-strong);
}

h3[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin: 12px 0 6px;
}

button[_ngcontent-%COMP%] {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  height: var(--%NS%control-h);
  padding: 0 12px;
  background: var(--%NS%surface-2);
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  color: var(--%NS%text);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
}

button[_ngcontent-%COMP%]:hover:not(:disabled) {
  background: var(--%NS%surface-3);
  border-color: var(--%NS%accent-line);
}

button[_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: 2px;
}

button[_ngcontent-%COMP%]:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}

.dot[_ngcontent-%COMP%] {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--%NS%text-3);
}

button.on[_ngcontent-%COMP%]   .dot[_ngcontent-%COMP%] {
  background: var(--%NS%danger);
}

.status[_ngcontent-%COMP%] {
  margin: 0;
  color: var(--%NS%text-2);
  font-size: 12px;
}

.hint[_ngcontent-%COMP%], 
.note[_ngcontent-%COMP%], 
.empty[_ngcontent-%COMP%] {
  margin: 8px 0;
  color: var(--%NS%text-2);
  line-height: 1.5;
}

.cd-grid[_ngcontent-%COMP%] {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 0 16px;
}

@media (min-width: 880px) {
  .cd-grid[_ngcontent-%COMP%] {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  }
}
table[_ngcontent-%COMP%] {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

th[_ngcontent-%COMP%], 
td[_ngcontent-%COMP%] {
  padding: 4px 6px;
  border-bottom: 1px solid var(--%NS%border);
  text-align: left;
}

th[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
  font-weight: 500;
}

td.mono[_ngcontent-%COMP%] {
  overflow-wrap: anywhere;
}

.num[_ngcontent-%COMP%] {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.mono[_ngcontent-%COMP%] {
  font-family: var(--%NS%font-mono);
}

.cycles[_ngcontent-%COMP%] {
  margin: 0;
  padding: 0;
  list-style: none;
  font-size: 12px;
}

.cycles[_ngcontent-%COMP%]   li[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  padding: 4px 0;
  border-bottom: 1px solid var(--%NS%border);
  color: var(--%NS%text);
}

.when[_ngcontent-%COMP%], 
.trigger[_ngcontent-%COMP%], 
.top[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
}

.trigger[_ngcontent-%COMP%]   .mono[_ngcontent-%COMP%], 
.top[_ngcontent-%COMP%]   .mono[_ngcontent-%COMP%] {
  overflow-wrap: anywhere;
}`]})},LD=()=>[],RD=(e,t)=>t.node.id,zD=(e,t)=>t.outlet+t.route,BD=(e,t)=>t.formId,VD=(e,t)=>t.name+e,HD=(e,t)=>t.name,UD=(e,t)=>t.token+e,WD=(e,t)=>t.id;function GD(e,t){return this.sourceKey(t)}function KD(e,t){if(e&1){let e=W();z(0,`span`,21),J(1,`Page`),B(),z(2,`app-select`,22),G(`valueChange`,function(t){return O(e),k(K(2).selectPage(t))}),B()}if(e&2){let e=K(2);M(2),R(`options`,e.pageOptions())(`value`,e.page()?.pageId??null)}}function qD(e,t){if(e&1){let e=W();z(0,`button`,23),G(`click`,function(){O(e);let t=K(2);return k(t.picking()?t.cancelPick():t.pick())}),A(),z(1,`svg`,24),V(2,`path`,25),B(),J(3),B()}if(e&2){let e=K(2);q(`on`,e.picking()),M(3),X(` `,e.picking()?`Cancel pick`:`Pick component on page`,` `)}}function JD(e,t){if(e&1&&(z(0,`p`,10),J(1),B()),e&2){let e=K(2);M(),Y(e.pickMessage())}}function YD(e,t){if(e&1&&(z(0,`p`,11),J(1),B()),e&2){let e=K(2);M(),Y(e.truncationText())}}function XD(e,t){e&1&&(z(0,`p`,27),J(1,`The filter only searches the components the tree lists.`),B())}function ZD(e,t){if(e&1){let e=W();z(0,`div`,14)(1,`p`,26),J(2),B(),P(3,XD,2,0,`p`,27),z(4,`button`,28),G(`click`,function(){return O(e),k(K(2).setFilter(``))}),J(5,`Clear filter`),B()()}if(e&2){let e=K(2);M(2),X(`No components match “`,e.filter().trim(),`”`),M(),F(e.page().truncated?3:-1)}}function QD(e,t){if(e&1){let e=W();z(0,`span`,37),G(`click`,function(t){O(e);let n=K().$implicit;return k(K(2).toggle(n.node.id,t))}),A(),z(1,`svg`,38),V(2,`path`,39),B()()}if(e&2){let e=K().$implicit;q(`open`,e.expanded)}}function $D(e,t){e&1&&V(0,`span`,31)}function eO(e,t){if(e&1&&(z(0,`span`,34),J(1),B()),e&2){let e=t.$implicit;M(),Y(e.route||`/`)}}function tO(e,t){if(e&1&&(z(0,`span`,35),J(1),z(2,`span`,13),J(3),B()()),e&2){let e=t;M(),X(` `,e),M(2),X(` `,e===1?`check`:`checks`,` while recording`)}}function nO(e,t){if(e&1&&(z(0,`span`,36),J(1),z(2,`span`,13),J(3),B()()),e&2){let e=K().$implicit;N(`title`,e.node.directives.join(`, `)),M(),X(` +`,e.node.directives.length,` `),M(2),X(` `,e.node.directives.length===1?`directive`:`directives`,` `)}}function rO(e,t){if(e&1){let e=W();z(0,`div`,29),G(`click`,function(){let t=O(e).$implicit;return k(K(2).select(t.node.id))})(`focus`,function(){let t=O(e).$implicit,n=K(2);return n.focusId.set(t.node.id),k(n.highlight(t.node.id))})(`blur`,function(){return O(e),k(K(2).highlight(null))})(`mouseenter`,function(){let t=O(e).$implicit;return k(K(2).highlight(t.node.id))})(`mouseleave`,function(){return O(e),k(K(2).highlight(null))}),P(1,QD,3,2,`span`,30)(2,$D,1,0,`span`,31),z(3,`span`,32),J(4),B(),z(5,`span`,33),J(6),B(),I(7,eO,2,1,`span`,34,zD),P(9,tO,4,2,`span`,35),P(10,nO,4,3,`span`,36),B()}if(e&2){let e,n=t.$implicit,r=K(2);C_(`--%NS%depth`,n.depth),q(`selected`,r.selectedId()===n.node.id),N(`aria-level`,n.depth+1)(`aria-expanded`,n.hasChildren?n.expanded:null)(`aria-selected`,r.selectedId()===n.node.id)(`tabindex`,r.rovingId()===n.node.id?0:-1)(`data-id`,n.node.id),M(),F(n.hasChildren?1:2),M(3),Y(n.node.name),M(2),X(`<`,n.node.tag,`>`),M(),L(r.routedById().get(n.node.id)??ov(14,LD)),M(2),F((e=r.cdHosts()[n.node.id])?9:-1,e),M(),F(n.node.directives?.length?10:-1)}}function iO(e,t){if(e&1&&(z(0,`p`,44),J(1),B()),e&2){let e=t;M(),Z(``,e.file,`:`,e.line)}}function aO(e,t){if(e&1){let e=W();z(0,`div`,46)(1,`button`,28),G(`click`,function(){O(e);let t=K();return k(K(2).revealInElements(t))}),J(2,`Reveal in Elements`),B(),z(3,`button`,28),G(`click`,function(){O(e);let t=K();return k(K(2).openSource(t))}),J(4,`Open source`),B()(),z(5,`p`,47),J(6),B()}if(e&2){let e=K(3);M(6),Y(e.actionMessage())}}function oO(e,t){if(e&1){let e=W();z(0,`button`,50),G(`click`,function(){let t=O(e).$implicit;return k(K(5).showForm.emit(t.formId))}),J(1),B()}if(e&2){let e=t.$implicit;M(),X(` Show `,e.label,` in Forms `)}}function sO(e,t){if(e&1&&(z(0,`div`,48),I(1,oO,2,1,`button`,49,BD),B()),e&2){let e=K(),t=K(3);M(),L(t.formsIn(e.file))}}function cO(e,t){e&1&&P(0,sO,3,0,`div`,48),e&2&&F(K(3).formsIn(t.file).length?0:-1)}function lO(e,t){if(e&1&&(z(0,`dt`),J(1,`Routed`),B(),z(2,`dd`,52),J(3),B()),e&2){let e=t.$implicit;M(3),Z(``,e.route||`/`,` in outlet `,e.outlet)}}function uO(e,t){if(e&1&&(z(0,`span`,61),J(1),B()),e&2){let e=K().$implicit;M(),X(`(`,e.prop,`)`)}}function dO(e,t){if(e&1&&(z(0,`li`,59)(1,`span`,60),J(2),P(3,uO,2,1,`span`,61),B(),z(4,`pre`),J(5),dv(6,`json`),B()()),e&2){let e=t.$implicit;M(2),X(` `,e.name,` `),M(),F(e.prop===e.name?-1:3),M(2),Y(pv(6,3,e.value))}}function fO(e,t){if(e&1&&(z(0,`ul`,55),I(1,dO,7,5,`li`,59,HD),B()),e&2){let e=K();M(),L(e.inputs)}}function pO(e,t){e&1&&(z(0,`p`,56),J(1,`No inputs.`),B())}function mO(e,t){if(e&1&&(z(0,`li`,63)(1,`span`,52),J(2),B(),z(3,`span`,64),J(4),B()()),e&2){let e=t.$implicit;q(`on`,e.listened),M(2),Y(e.name),M(2),Y(e.listened?`listened`:`no listener`)}}function hO(e,t){if(e&1&&(z(0,`ul`,57),I(1,mO,5,4,`li`,62,HD),B()),e&2){let e=K();M(),L(e.outputs)}}function gO(e,t){e&1&&(z(0,`p`,56),J(1,`No outputs.`),B())}function _O(e,t){if(e&1&&(z(0,`span`,65),J(1),B()),e&2){let e=K().$implicit;M(),Y(e.kind)}}function vO(e,t){if(e&1&&(z(0,`li`,59)(1,`span`,60),J(2),P(3,_O,2,1,`span`,65),B(),z(4,`pre`),J(5),dv(6,`json`),B()()),e&2){let e=t.$implicit;M(2),X(` `,e.name,` `),M(),F(e.kind?3:-1),M(2),Y(pv(6,3,e.value))}}function yO(e,t){if(e&1&&(z(0,`ul`,55),I(1,vO,7,5,`li`,59,HD),B()),e&2){let e=K();M(),L(e.properties)}}function bO(e,t){e&1&&(z(0,`p`,56),J(1,`No other properties.`),B())}function xO(e,t){if(e&1&&(z(0,`li`,66),J(1),B()),e&2){let e=t.$implicit;M(),Y(e)}}function SO(e,t){if(e&1&&(z(0,`div`,53)(1,`h3`),J(2,` DOM listeners `),z(3,`span`,54),J(4),B()(),z(5,`ul`,57),I(6,xO,2,1,`li`,66,wg),B()()),e&2){let e=K();M(4),Y(e.listeners.length),M(2),L(e.listeners)}}function CO(e,t){if(e&1&&(z(0,`li`,59)(1,`span`,60),J(2),B(),z(3,`pre`),J(4),dv(5,`json`),B()()),e&2){let e=t.$implicit;M(2),Y(e.name),M(2),Y(pv(5,2,e.value))}}function wO(e,t){if(e&1&&(z(0,`ul`,55),I(1,CO,6,4,`li`,59,HD),B()),e&2){let e=K().$implicit;M(),L(e.inputs)}}function TO(e,t){if(e&1&&(z(0,`li`,63)(1,`span`,52),J(2),B(),z(3,`span`,64),J(4),B()()),e&2){let e=t.$implicit;q(`on`,e.listened),M(2),Y(e.name),M(2),Y(e.listened?`listened`:`no listener`)}}function EO(e,t){if(e&1&&(z(0,`ul`,57),I(1,TO,5,4,`li`,62,HD),B()),e&2){let e=K().$implicit;M(),L(e.outputs)}}function DO(e,t){e&1&&(z(0,`p`,56),J(1,`No inputs or outputs.`),B())}function OO(e,t){if(e&1&&(z(0,`div`,53)(1,`h3`)(2,`span`,52),J(3),B(),z(4,`span`,65),J(5,`directive on host`),B()(),P(6,wO,3,0,`ul`,55),P(7,EO,3,0,`ul`,57),P(8,DO,2,0,`p`,56),B()),e&2){let e=t.$implicit;M(3),Y(e.name),M(3),F(e.inputs.length?6:-1),M(),F(e.outputs.length?7:-1),M(),F(!e.inputs.length&&!e.outputs.length?8:-1)}}function kO(e,t){if(e&1&&(z(0,`span`,65),J(1),B()),e&2){let e=t.$implicit;M(),Y(e)}}function AO(e,t){if(e&1&&(z(0,`span`,69),J(1,`from `),z(2,`span`,52),J(3),B()()),e&2){let e=K().$implicit;M(3),Y(e.providedByName??`an injector`)}}function jO(e,t){e&1&&(z(0,`span`,70),J(1,`not provided`),B())}function MO(e,t){if(e&1&&(z(0,`li`,67)(1,`span`,68),J(2),B(),I(3,kO,2,1,`span`,65,wg),P(5,AO,4,1,`span`,69)(6,jO,2,0,`span`,70),B()),e&2){let e=t.$implicit;M(2),Y(e.token),M(),L(e.flags),M(2),F(e.providedBy?5:6)}}function NO(e,t){if(e&1&&(z(0,`ul`,58),I(1,MO,7,2,`li`,67,UD),B()),e&2){let e=K();M(),L(e.dependencies)}}function PO(e,t){e&1&&(z(0,`p`,56),J(1,`Nothing is injected through the constructor or inject().`),B())}function FO(e,t){if(e&1&&(z(0,`dl`,51)(1,`dt`),J(2,`Change detection`),B(),z(3,`dd`),J(4),B(),z(5,`dt`),J(6,`Encapsulation`),B(),z(7,`dd`),J(8),B(),z(9,`dt`),J(10,`Host path`),B(),z(11,`dd`,52),J(12),B(),I(13,lO,4,2,null,null,zD),B(),z(15,`div`,53)(16,`h3`),J(17,` Inputs `),z(18,`span`,54),J(19),B()(),P(20,fO,3,0,`ul`,55)(21,pO,2,0,`p`,56),B(),z(22,`div`,53)(23,`h3`),J(24,` Outputs `),z(25,`span`,54),J(26),B()(),P(27,hO,3,0,`ul`,57)(28,gO,2,0,`p`,56),B(),z(29,`div`,53)(30,`h3`),J(31,` Properties `),z(32,`span`,54),J(33),B()(),P(34,yO,3,0,`ul`,55)(35,bO,2,0,`p`,56),B(),P(36,SO,8,1,`div`,53),I(37,OO,9,4,`div`,53,VD),z(39,`div`,53)(40,`h3`),J(41,` Injected `),z(42,`span`,54),J(43),B()(),P(44,NO,3,0,`ul`,58)(45,PO,2,0,`p`,56),B()),e&2){let e=t,n=K(),r=K(2);M(4),Y(e.changeDetection??`Unknown`),M(4),Y(e.encapsulation??`Unknown`),M(4),Y(e.path),M(),L(r.routedById().get(n.id)??ov(12,LD)),M(6),Y(e.inputs.length),M(),F(e.inputs.length?20:21),M(6),Y(e.outputs.length),M(),F(e.outputs.length?27:28),M(6),Y(e.properties?.length??0),M(),F(e.properties?.length?34:35),M(2),F(e.listeners.length?36:-1),M(),L(e.directives),M(6),Y(e.dependencies.length),M(),F(e.dependencies.length?44:45)}}function IO(e,t){e&1&&(z(0,`div`,45),V(1,`span`,71),z(2,`p`,27),J(3,`Reading live values from the page…`),B()())}function LO(e,t){if(e&1&&(z(0,`section`,17)(1,`header`,40)(2,`span`,41),J(3,`component`),B(),z(4,`h2`,42),J(5),B(),z(6,`span`,43),J(7),B(),P(8,iO,2,2,`p`,44),P(9,aO,7,1),P(10,cO,1,1),B(),P(11,FO,46,13)(12,IO,4,0,`div`,45),B()),e&2){let e,n,r,i=t,a=K(2);M(5),Y(i.name),M(2),X(`<`,i.tag,`>`),M(),F((e=a.whereOf(i))?8:-1,e),M(),F(a.devtoolsActions()?9:-1),M(),F((n=a.sourceFor(i))?10:-1,n),M(),F((r=a.detail())?11:12,r)}}function RO(e,t){e&1&&(z(0,`p`,26),J(1,`The selected component was destroyed`),B(),z(2,`p`,27)(3,`span`,52),J(4),B(),J(5,` is no longer on the page. Select another component to see its live values. `),B()),e&2&&(M(4),Y(t))}function zO(e,t){e&1&&(z(0,`p`,27),J(1,` Select a component to see its live inputs, properties, outputs, change detection and injected services. `),B())}function BO(e,t){if(e&1&&(z(0,`div`,18),P(1,RO,6,1)(2,zO,2,0,`p`,27),B()),e&2){let e,t=K(2);M(),F((e=t.destroyed())?1:2,e)}}function VO(e,t){e&1&&(z(0,`span`,65),J(1,`hydrate never`),B())}function HO(e,t){if(e&1&&(z(0,`span`,65),J(1),B()),e&2){let e=K().$implicit;M(),Y(e.hydration)}}function UO(e,t){if(e&1){let e=W();z(0,`li`)(1,`button`,74),G(`click`,function(){let t=O(e).$implicit;return k(K(3).showOwner(t))})(`focus`,function(){let t=O(e).$implicit;return k(K(3).highlightBlock(t))})(`blur`,function(){return O(e),k(K(3).highlight(null))})(`mouseenter`,function(){let t=O(e).$implicit;return k(K(3).highlightBlock(t))})(`mouseleave`,function(){return O(e),k(K(3).highlight(null))}),z(2,`span`,32),J(3),B(),z(4,`span`,75),J(5),B(),P(6,VO,2,0,`span`,65)(7,HO,2,1,`span`,65),z(8,`span`,76),J(9),B()()()}if(e&2){let e=t.$implicit;M(),R(`disabled`,!e.owner),M(2),Y(e.owner?.name??`Unknown component`),M(),w_(`defer-state-`+e.state),M(),Y(e.state),M(),F(e.hydrateNever?6:e.hydration===`not-configured`?-1:7),M(3),Y(e.triggers.join(`, `)||`no triggers`)}}function WO(e,t){if(e&1&&(z(0,`section`,19)(1,`h2`,72),J(2,` Defer blocks `),z(3,`span`,54),J(4),B()(),z(5,`ul`,73),I(6,UO,10,7,`li`,null,WD),B()()),e&2){let e=K(2);M(4),Y(e.deferBlocks().length),M(2),L(e.deferBlocks())}}function GO(e,t){if(e&1&&V(0,`app-cd-recording`,20),e&2){let e=K(2);R(`page`,e.cdPage())(`pageId`,e.page().pageId)(`rpc`,e.rpc())}}function KO(e,t){if(e&1){let e=W();z(0,`p`,0),J(1,` Every component instance on the page, in the order Angular rendered them. Hover a row to highlight its host in the page, and select it to read its live inputs, properties, outputs and injected services. `),B(),z(2,`div`,1)(3,`div`,2),A(),z(4,`svg`,3),V(5,`circle`,4)(6,`path`,5),B(),ps(),z(7,`input`,6),G(`input`,function(t){return O(e),k(K().setFilter(t.target.value))})(`keydown.escape`,function(){return O(e),k(K().setFilter(``))}),B()(),P(8,KD,3,2),z(9,`span`,7),J(10),B(),P(11,qD,4,3,`button`,8),B(),z(12,`p`,9),J(13),B(),P(14,JD,2,1,`p`,10),P(15,YD,2,1,`p`,11),z(16,`div`,12)(17,`div`)(18,`h2`,13),J(19,`Component tree`),B(),P(20,ZD,6,2,`div`,14),z(21,`div`,15),G(`keydown`,function(t){return O(e),k(K().onTreeKey(t))}),I(22,rO,11,15,`div`,16,RD),B()(),P(24,LO,13,6,`section`,17)(25,BO,3,1,`div`,18),B(),P(26,WO,8,1,`section`,19),P(27,GO,1,3,`app-cd-recording`,20)}if(e&2){let e,t=K();M(7),R(`value`,t.filter()),M(),F(t.pageOptions().length>1?8:-1),M(2),Y(t.countLabel()),M(),F(t.native()?-1:11),M(2),Y(t.announcement()),M(),F(t.pickMessage()?14:-1),M(),F(t.page().truncated?15:-1),M(5),F(t.rows().length?-1:20),M(),R(`hidden`,!t.rows().length),M(),L(t.rows()),M(2),F((e=t.selectedNode())?24:25,e),M(2),F(t.deferBlocks().length?26:-1),M(),F(!t.staticReport()&&!t.native()?27:-1)}}function qO(e,t){e&1&&(z(0,`p`,11),J(1,` The page reported no component instances. The live tree needs a development build with Angular's debug API. Showing what the source declares instead. `),B())}function JO(e,t){e&1&&(z(0,`p`,77),J(1,` No page is connected, so this lists what the source declares. Open the app in a browser with the devtools connected to see each rendered instance. `),B())}function YO(e,t){if(e&1&&J(0),e&2){let e=K(3);Z(` `,e.filteredSource().length,` of `,e.source().length,` `)}}function XO(e,t){if(e&1&&J(0),e&2){let e=K(3);X_(` `,e.sourceCounts().components,` `,e.sourceCounts().components===1?`component`:`components`,` · `,e.sourceCounts().directives,` `,e.sourceCounts().directives===1?`directive`:`directives`,` `)}}function ZO(e,t){if(e&1&&(z(0,`span`,79),P(1,YO,1,2)(2,XO,1,4),B()),e&2){let e=K(2);M(),F(e.filter().trim()?1:2)}}function QO(e,t){e&1&&(z(0,`div`,83),V(1,`span`,71),z(2,`p`,26),J(3,`Scanning components…`),B()())}function $O(e,t){e&1&&(J(0,` Run `),z(1,`code`),J(2,`pangular build`),B(),J(3,` again to rebuild the report. `))}function ek(e,t){e&1&&J(0,` Check that the dev server is running, then try again. `)}function tk(e,t){if(e&1){let e=W();z(0,`div`,84)(1,`p`,26),J(2,`Could not load components`),B(),z(3,`p`,27),P(4,$O,4,0)(5,ek,1,0),B(),z(6,`button`,28),G(`click`,function(){return O(e),k(K(2).refresh())}),J(7,`Retry`),B()()}if(e&2){let e=K(2);M(4),F(e.staticReport()?4:5)}}function nk(e,t){e&1&&(z(0,`div`,85)(1,`p`,26),J(2,`No components found`),B(),z(3,`p`,27),J(4,`No @Component or @Directive was found in the source.`),B()())}function rk(e,t){if(e&1){let e=W();z(0,`div`,85)(1,`p`,26),J(2),B(),z(3,`button`,28),G(`click`,function(){return O(e),k(K(2).filter.set(``))}),J(4,`Clear filter`),B()()}if(e&2){let e=K(2);M(2),X(`No components match “`,e.filter().trim(),`”`)}}function ik(e,t){if(e&1&&J(0),e&2){let e=K().$implicit;X(` `,K(3).bareName(e.className),` · `)}}function ak(e,t){if(e&1&&(z(0,`dt`),J(1,`Change detection`),B(),z(2,`dd`),J(3),B()),e&2){let e=K(2).$implicit;M(3),Y(e.changeDetection??`Unknown`)}}function ok(e,t){if(e&1){let e=W();z(0,`button`,50),G(`click`,function(){let t=O(e).$implicit;return k(K(5).showForm.emit(t.formId))}),J(1),B()}if(e&2){let e=t.$implicit;M(),X(` Show `,e.label,` in Forms `)}}function sk(e,t){if(e&1&&(z(0,`div`,95)(1,`dl`,51)(2,`dt`),J(3,`Class`),B(),z(4,`dd`,52),J(5),B(),z(6,`dt`),J(7,`File`),B(),z(8,`dd`,52),J(9),B(),z(10,`dt`),J(11,`Standalone`),B(),z(12,`dd`),J(13),B(),P(14,ak,4,1),z(15,`dt`),J(16,`Inputs`),B(),z(17,`dd`,52),J(18),B(),z(19,`dt`),J(20,`Outputs`),B(),z(21,`dd`,52),J(22),B()(),I(23,ok,2,1,`button`,49,BD),B()),e&2){let e=K(),t=e.$implicit,n=e.$index,r=K(3);R(`id`,`ct-source-`+n),M(5),Y(r.bareName(t.className)),M(4),Z(``,t.file,`:`,t.line),M(4),Y(t.isStandalone?`Yes`:`No`),M(),F(t.kind===`component`?14:-1),M(4),Y(t.inputs.join(`, `)||`None`),M(4),Y(t.outputs.join(`, `)||`None`),M(),L(r.formsIn(t.file))}}function ck(e,t){if(e&1){let e=W();z(0,`li`,88)(1,`button`,89),G(`click`,function(){let t=O(e).$implicit,n=K(3);return k(n.openKey.set(n.openKey()===n.sourceKey(t)?null:n.sourceKey(t)))}),z(2,`span`,90),J(3),B(),z(4,`span`,91)(5,`span`,92),J(6),B(),z(7,`span`,93),P(8,ik,1,1),J(9),B()(),A(),z(10,`svg`,94),V(11,`path`,39),B()(),P(12,sk,25,8,`div`,95),B()}if(e&2){let e=t.$implicit,n=t.$index,r=K(3);q(`expanded`,r.openKey()===r.sourceKey(e)),M(),N(`aria-expanded`,r.openKey()===r.sourceKey(e))(`aria-controls`,r.openKey()===r.sourceKey(e)?`ct-source-`+n:null),M(),q(`directive`,e.kind===`directive`),M(),Y(e.kind),M(3),Y(r.sourceLabel(e)),M(2),F(e.selector?8:-1),M(),Z(` `,e.file,`:`,e.line,` `),M(3),F(r.openKey()===r.sourceKey(e)?12:-1)}}function lk(e,t){if(e&1&&(z(0,`ul`,86),I(1,ck,13,12,`li`,87,GD,!0),B()),e&2){let e=K(2);M(),L(e.filteredSource())}}function uk(e,t){if(e&1){let e=W();P(0,qO,2,0,`p`,11)(1,JO,2,0,`p`,77),z(2,`div`,1)(3,`div`,2),A(),z(4,`svg`,3),V(5,`circle`,4)(6,`path`,5),B(),ps(),z(7,`input`,78),G(`input`,function(t){return O(e),k(K().filter.set(t.target.value))})(`keydown.escape`,function(){return O(e),k(K().filter.set(``))}),B()(),P(8,ZO,3,1,`span`,79),z(9,`button`,80),G(`click`,function(){return O(e),k(K().refresh())}),A(),z(10,`svg`,24),V(11,`path`,81)(12,`path`,82),B(),J(13,` Refresh `),B()(),P(14,QO,4,0,`div`,83)(15,tk,8,1,`div`,84)(16,nk,5,0,`div`,85)(17,rk,5,1,`div`,85)(18,lk,3,0,`ul`,86)}if(e&2){let e=K();F(+!e.page()),M(7),R(`value`,e.filter()),M(),F(e.source().length?8:-1),M(),q(`spinning`,e.loading()),N(`aria-busy`,e.loading()),M(5),F(e.loading()&&!e.source().length?14:e.error()&&!e.source().length?15:e.source().length?e.filteredSource().length?18:17:16)}}function dk(e){return e.replace(/^_(?=[A-Z])/,``)}var fk=class e{rpc=$(null);staticReport=Q(()=>aE(this.rpc()));focus=$(null);showForm=Ov();focusHandled=Ov();filter=j(``);loading=j(!1);error=j(!1);source=j([]);formOwners=j([]);pages=j({});chosenPageId=j(null);selectedId=j(null);destroyed=j(null);announcement=j(``);picking=j(!1);pickMessage=j(``);pickPageId=null;pickSeq=0;focusId=j(null);bridge=E(nD);actionMessage=Tv({source:this.selectedId,computation:()=>``});collapsed=j(new Set);openKey=j(null);routerPages=j([]);pageId=$T();destroyRef=E(Cs);injector=E(xs);host=E(Ml);cleanups=[];selection={pageId:null,detailId:null};shownPageId=Tv({source:()=>({pages:this.pages(),chosen:this.chosenPageId()}),computation:({pages:e,chosen:t},n)=>eE(e,{chosen:t,host:this.pageId,previous:n?.value??null})});page=Q(()=>{let e=this.shownPageId();return e?this.pages()[e]??null:null});pageOptions=Q(()=>Object.values(this.pages()).map(e=>({value:e.pageId,label:e.title||e.url||`Page ${e.pageId}`,hint:e.url})));live=Q(()=>(this.page()?.roots.length??0)>0);native=Q(()=>rD(this.page()));devtoolsActions=Q(()=>this.bridge.available&&!!this.page()&&!this.native()&&!this.staticReport());cdPages=j({});cdPage=Q(()=>{let e=this.page()?.pageId;return e?this.cdPages()[e]??null:null});cdHosts=Q(()=>this.cdPage()?.hosts??{});index=Q(()=>{let e=new Map,t=new Map,n=(r,i)=>{for(let a of r)e.set(a.id,a),i&&t.set(a.id,i),n(a.children,a.id)};return n(this.page()?.roots??[],null),{map:e,parents:t}});query=Q(()=>this.filter().trim().toLowerCase());filtered=Q(()=>hD(this.page()?.roots??[],this.query()));deferBlocks=Q(()=>this.page()?.deferBlocks??[]);countLabel=Q(()=>gD(this.page()?.count??0,this.filtered().matches,!!this.query(),!!this.page()?.truncated));truncationText=Q(()=>vD(this.page()?.truncatedBy));rows=Q(()=>{let e=[],t=this.collapsed(),n=!!this.query(),r=(i,a)=>{for(let o of i){let i=n||!t.has(o.id);e.push({node:o,depth:a,hasChildren:o.children.length>0,expanded:i}),i&&r(o.children,a+1)}};return r(this.filtered().nodes,0),e});selectedNode=Q(()=>{let e=this.selectedId();return e?this.index().map.get(e)??null:null});detail=Q(()=>{let e=this.page()?.detail;return e&&e.id===this.selectedId()?e:null});rovingId=Q(()=>{let e=this.rows(),t=new Set(e.map(e=>e.node.id)),n=this.focusId();if(n&&t.has(n))return n;let r=this.selectedId();return r&&t.has(r)?r:e[0]?.node.id??null});outlets=Q(()=>{let e=this.page()?.pageId;return this.routerPages().find(t=>t.pageId===e)?.outlets??[]});routedById=Q(()=>{let e=new Map,t=n=>{for(let r of n){if(r.activated&&r.devtoolsId){let t=e.get(r.devtoolsId)??[];t.push({route:r.route??``,outlet:r.outlet}),e.set(r.devtoolsId,t)}r.children&&t(r.children)}};return t(this.outlets()),e});sourceByClass=Q(()=>{let e=new Map;for(let t of this.source()){let n=dk(t.className);e.set(n,[...e.get(n)??[],t])}return e});filteredSource=Q(()=>{let e=this.query(),t=this.source();return e?t.filter(t=>t.selector.toLowerCase().includes(e)||t.className.toLowerCase().includes(e)||t.file.toLowerCase().includes(e)):t});sourceCounts=Q(()=>{let e=this.source().filter(e=>e.kind===`component`).length;return{components:e,directives:this.source().length-e}});constructor(){uc(()=>{let e=this.page()?.pageId??null;Cv(()=>{this.picking()&&e!==this.pickPageId&&this.dropPick()})}),uc(()=>{let e=this.rpc();e&&(this.refresh(),this.watch(e))}),uc(()=>{let e=this.focus();e&&this.live()&&Cv(()=>{this.index().map.has(e.id)&&this.reveal(e.id),this.focusHandled.emit()})}),this.destroyRef.onDestroy(()=>{this.highlight(null);for(let e of this.cleanups.splice(0))e()})}async watch(e){for(let e of this.cleanups.splice(0))e();let t=e.scope(`pangular`);try{let e=await t.rpc.sharedState(`component-tree`);if(this.destroyRef.destroyed)return;let n=e=>{let t=e?.pages;this.applyPages(t&&typeof t==`object`?t:{})};n(e.value()),this.cleanups.push(e.on(`updated`,n))}catch{this.applyPages({})}try{let e=await t.rpc.sharedState(`change-detection`);if(this.destroyRef.destroyed)return;let n=e=>{let t=e?.pages;this.cdPages.set(t&&typeof t==`object`?t:{})};n(e.value()),this.cleanups.push(e.on(`updated`,n))}catch{this.cdPages.set({})}try{let e=await t.rpc.sharedState(`router`);if(this.destroyRef.destroyed)return;let n=e=>{let t=e?.pages;this.routerPages.set(Array.isArray(t)?t:[])};n(e.value()),this.cleanups.push(e.on(`updated`,n))}catch{this.routerPages.set([])}}async refresh(){let e=this.rpc();if(!e)return;this.loading.set(!0);let t=e.scope(`pangular`);try{this.source.set(await t.rpc.call(`get-components`)),this.error.set(!1)}catch{this.error.set(!0)}finally{this.loading.set(!1)}let n=await t.rpc.call(`forms-owners`).catch(()=>[]);this.formOwners.set(n??[])}formsIn(e){return this.formOwners().filter(t=>t.file===e)}whereOf(e){return this.detail()?.source??this.sourceFor(e)}async revealInElements(e){let t=this.page()?.pageId;if(!t)return;this.actionMessage.set(``);let n=await this.bridge.reveal(t,e.id);this.selectedId()===e.id&&this.actionMessage.set(n.ok?``:`Could not reveal it. The component must be rendered in the tab these DevTools inspect.`)}async openSource(e){let t=this.page()?.pageId;if(!t)return;let n=this.whereOf(e);this.actionMessage.set(``);let r=await this.bridge.openSource(t,e.id,n);this.selectedId()===e.id&&(r.ok||this.actionMessage.set(n?`Not found in Sources. Open ${n.file}:${n.line} in your editor.`:`Could not open the source. The component must be rendered in the tab these DevTools inspect.`))}sourceFor(e){let t=(this.sourceByClass().get(dk(e.name))??[]).filter(e=>e.kind===`component`);return t.find(t=>t.selector===e.tag)??t[0]??null}sourceKey(e){return`${e.file}#${e.className}`}sourceLabel(e){return e.selector?e.kind===`component`&&/^[a-z][\w-]*$/i.test(e.selector)?`<${e.selector}>`:e.selector:dk(e.className)}bareName(e){return dk(e)}applyPages(e){let t=document.activeElement,n=t instanceof HTMLElement&&this.host.nativeElement.contains(t)?t.closest(`.row`)?.dataset.id??null:null,r=n?this.rows().map(e=>e.node.id):[],i=this.index().map;if(this.pages.set(e),this.syncSelection(i),!n)return;let a=new Set(this.rows().map(e=>e.node.id));if(a.has(n))return;let o=xD(r,a,n);o&&(this.focusId.set(o),Id(()=>this.rowElement(o)?.focus(),{injector:this.injector}))}syncSelection(e=this.index().map){let t=this.page(),n=yD({...this.selection,selectedId:this.selectedId()},t?{pageId:t.pageId,roots:t.roots,detail:t.detail,truncated:t.truncated}:null),r=n.destroyed?e.get(n.destroyed)?.name:void 0;this.selection={pageId:n.pageId,detailId:n.detailId},n.selectedId!==this.selectedId()&&this.selectedId.set(n.selectedId),n.selectedId&&this.destroyed.set(null),n.destroyed&&(this.destroyed.set(r??`The component`),this.announcement.set(`The selected component was destroyed.`),this.sendSelection(null))}selectPage(e){e&&(this.chosenPageId.set(e),this.destroyed.set(null),this.syncSelection())}setFilter(e){this.filter.set(e);let{matches:t}=this.filtered();this.announcement.set(_D(this.page()?.count??0,t,e,!!this.page()?.truncated))}async pick(){let e=this.rpc();if(!e||this.picking())return;let t=++this.pickSeq;this.pickPageId=this.page()?.pageId??null,this.picking.set(!0),this.say(`Click a component in the app. Press Escape to cancel.`);let n=await e.scope(`pangular`).rpc.call(`request-component-pick`,{pageId:this.pickPageId??void 0}).catch(()=>({ok:!1,error:`Could not reach the devtools server.`}));if(t===this.pickSeq){if(this.picking.set(!1),!n?.ok||!n.id){this.say(n?.error??`No component was picked.`);return}n.pageId&&n.pageId!==this.page()?.pageId&&this.selectPage(n.pageId),this.say(`Picked ${n.name??`a component`}.`),this.destroyed.set(null),this.index().map.has(n.id)?this.reveal(n.id):this.selectedId.set(n.id)}}cancelPick(){let e=this.rpc();e&&this.picking()&&e.scope(`pangular`).rpc.call(`cancel-component-pick`,{pageId:this.pickPageId??void 0}).catch(()=>{})}dropPick(){this.cancelPick(),this.pickSeq++,this.picking.set(!1),this.say(`Picking stopped because the page changed.`)}say(e){this.pickMessage.set(e),this.announcement.set(e)}sendSelection(e){let t=this.rpc();t&&t.scope(`pangular`).rpc.call(`select-component`,{pageId:this.page()?.pageId,id:e}).catch(()=>{})}rowElement(e){return this.host.nativeElement.querySelector(`.row[data-id="${CSS.escape(e)}"]`)}select(e){let t=this.selectedId()===e?null:e;this.selectedId.set(t),this.destroyed.set(null),this.focusId.set(e),this.sendSelection(t)}reveal(e){let{parents:t}=this.index();this.collapsed.update(n=>{let r=new Set(n);for(let n=t.get(e);n;n=t.get(n))r.delete(n);return r}),this.rows().some(t=>t.node.id===e)||this.setFilter(``),this.selectedId()!==e&&this.select(e),Id(()=>document.querySelector(`.row[data-id="${CSS.escape(e)}"]`)?.scrollIntoView({block:`nearest`}),{injector:this.injector})}toggle(e,t){t?.stopPropagation(),!this.query()&&this.collapsed.update(t=>{let n=new Set(t);return n.has(e)?n.delete(e):n.add(e),n})}highlight(e){let t=this.rpc();if(!t)return;let n=e?{pageId:this.page()?.pageId,id:e}:null;t.scope(`pangular`).rpc.call(`request-page-highlight`,n).catch(()=>{})}highlightBlock(e){this.highlight(e.rootIds[0]??e.owner?.id??null)}showOwner(e){e.owner&&this.index().map.has(e.owner.id)&&this.reveal(e.owner.id)}onTreeKey(e){let t=this.rows();if(!t.length)return;let n=t.findIndex(e=>e.node.id===this.rovingId()),r=Math.max(n,0),i=t[r],a=-1;switch(e.key){case`ArrowDown`:a=Math.min(r+1,t.length-1);break;case`ArrowUp`:a=Math.max(r-1,0);break;case`Home`:a=0;break;case`End`:a=t.length-1;break;case`ArrowRight`:i.hasChildren&&!i.expanded?this.toggle(i.node.id):i.hasChildren&&(a=r+1);break;case`ArrowLeft`:if(i.hasChildren&&i.expanded&&!this.query())this.toggle(i.node.id);else{let e=this.index().parents.get(i.node.id);a=t.findIndex(t=>t.node.id===e)}break;case`Enter`:case` `:this.select(i.node.id);break;default:return}if(e.preventDefault(),a>=0){let e=t[a].node.id;this.focusId.set(e),queueMicrotask(()=>{let t=document.querySelector(`.row[data-id="${CSS.escape(e)}"]`);t?.focus(),t?.scrollIntoView({block:`nearest`})})}}static ɵfac=function(t){return new(t||e)};static ɵcmp=Bh({type:e,selectors:[[`app-component-tree`]],hostBindings:function(e,t){e&1&&G(`keydown.escape`,function(){return t.cancelPick()})},inputs:{rpc:[1,`rpc`],focus:[1,`focus`]},outputs:{showForm:`showForm`,focusHandled:`focusHandled`},decls:2,vars:1,consts:[[1,`intro`],[1,`toolbar`],[1,`search`],[`viewBox`,`0 0 24 24`,`aria-hidden`,`true`,1,`search-icon`],[`cx`,`11`,`cy`,`11`,`r`,`7`],[`d`,`m20 20-3.5-3.5`],[`type`,`search`,`placeholder`,`Filter by class, tag or directive…`,`aria-label`,`Filter components by class, tag or directive`,`autocomplete`,`off`,`spellcheck`,`false`,3,`input`,`keydown.escape`,`value`],[1,`count`],[`type`,`button`,1,`pick`,3,`on`],[`role`,`status`,1,`sr-only`],[1,`pick-message`],[`role`,`status`,1,`notice`],[1,`layout`],[1,`sr-only`],[1,`state`,`compact`,`tree`],[`role`,`tree`,`aria-label`,`Component instances`,1,`tree`,3,`keydown`,`hidden`],[`role`,`treeitem`,1,`row`,3,`selected`,`--%NS%depth`],[`aria-labelledby`,`ct-detail-title`,1,`detail`],[1,`detail`,`placeholder`],[`aria-labelledby`,`ct-defer-title`,1,`defer`],[3,`page`,`pageId`,`rpc`],[`id`,`ct-page-label`,1,`sr-only`],[`labelledBy`,`ct-page-label`,1,`page-select`,3,`valueChange`,`options`,`value`],[`type`,`button`,1,`pick`,3,`click`],[`viewBox`,`0 0 24 24`,`aria-hidden`,`true`],[`d`,`M4 4l6.5 16 2.3-6.7L19.5 11z`],[1,`state-title`],[1,`state-hint`],[`type`,`button`,3,`click`],[`role`,`treeitem`,1,`row`,3,`click`,`focus`,`blur`,`mouseenter`,`mouseleave`],[`aria-hidden`,`true`,1,`twisty`,3,`open`],[`aria-hidden`,`true`,1,`twisty-space`],[1,`name`,`mono`],[1,`tag`,`mono`],[1,`routed`],[1,`checks`],[1,`dirs`],[`aria-hidden`,`true`,1,`twisty`,3,`click`],[`viewBox`,`0 0 24 24`],[`d`,`m9 6 6 6-6 6`],[1,`detail-head`],[1,`badge`],[`id`,`ct-detail-title`,1,`mono`],[1,`mono`,`muted`],[1,`where`,`mono`],[`role`,`status`,1,`state`,`compact`],[`role`,`group`,`aria-label`,`Chrome DevTools`,1,`actions`],[`role`,`status`,1,`where`,`action-message`],[1,`actions`],[`type`,`button`,1,`show-form`],[`type`,`button`,1,`show-form`,3,`click`],[1,`facts`],[1,`mono`],[1,`block`],[1,`pill`],[1,`props`],[1,`empty-line`],[1,`chips`],[1,`deps`],[1,`prop`],[1,`prop-name`,`mono`],[1,`muted`],[1,`chip`,3,`on`],[1,`chip`],[1,`chip-note`],[1,`flag`],[1,`chip`,`mono`],[1,`dep`],[1,`token`,`mono`],[1,`from`],[1,`from`,`missing`],[`aria-hidden`,`true`,1,`spinner`],[`id`,`ct-defer-title`,1,`defer-title`],[1,`defer-list`],[`type`,`button`,1,`defer-row`,3,`click`,`focus`,`blur`,`mouseenter`,`mouseleave`,`disabled`],[1,`defer-state`],[1,`triggers`,`mono`],[1,`notice`],[`type`,`search`,`placeholder`,`Filter by selector, class or file…`,`aria-label`,`Filter components by selector, class or file`,`autocomplete`,`off`,`spellcheck`,`false`,3,`input`,`keydown.escape`,`value`],[`aria-live`,`polite`,1,`count`],[`type`,`button`,1,`refresh`,3,`click`],[`d`,`M20 12a8 8 0 1 1-2.34-5.66`],[`d`,`M20 4v5h-5`],[`role`,`status`,1,`state`],[`role`,`alert`,1,`state`],[1,`state`],[`role`,`list`,1,`source-list`],[1,`source-item`,3,`expanded`],[1,`source-item`],[`type`,`button`,1,`source-toggle`,3,`click`],[1,`kind-flag`],[1,`row-main`],[1,`selector`,`mono`],[1,`file`,`mono`],[`viewBox`,`0 0 24 24`,`aria-hidden`,`true`,1,`chevron`],[1,`inline-detail`,3,`id`]],template:function(e,t){e&1&&P(0,KO,28,12)(1,uk,19,7),e&2&&F(+!t.live())},dependencies:[mD,ID,ab],styles:[`[_nghost-%COMP%] {
  display: block;
  color: var(--%NS%text);
  font-size: 13px;
}

.mono[_ngcontent-%COMP%] {
  font-family: var(--%NS%font-mono);
}

.muted[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
}

.intro[_ngcontent-%COMP%] {
  max-width: 720px;
  margin: 0 0 12px;
  color: var(--%NS%text-2);
  line-height: 1.5;
}

.notice[_ngcontent-%COMP%] {
  margin: 0 0 12px;
  padding: 10px 12px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%surface);
  color: var(--%NS%text-2);
  line-height: 1.5;
}

.toolbar[_ngcontent-%COMP%] {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin: 0 0 12px;
  padding: 8px;
  background: color-mix(in srgb, var(--%NS%surface) 85%, transparent);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
}

.search[_ngcontent-%COMP%] {
  position: relative;
  flex: 1 1 220px;
  min-width: 0;
}

.search-icon[_ngcontent-%COMP%] {
  position: absolute;
  top: 50%;
  left: 12px;
  width: 14px;
  height: 14px;
  transform: translateY(-50%);
  fill: none;
  stroke: var(--%NS%text-3);
  stroke-width: 2.2;
  stroke-linecap: round;
  pointer-events: none;
}

.search[_ngcontent-%COMP%]:focus-within   .search-icon[_ngcontent-%COMP%] {
  stroke: var(--%NS%accent);
}

input[type=search][_ngcontent-%COMP%] {
  width: 100%;
  height: 34px;
  padding: 0 12px 0 34px;
  background: var(--%NS%bg);
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  color: var(--%NS%text);
  font: inherit;
  font-size: 13px;
}

input[type=search][_ngcontent-%COMP%]::placeholder {
  color: var(--%NS%text-3);
}

input[type=search][_ngcontent-%COMP%]:focus-visible {
  outline: none;
  border-color: var(--%NS%accent);
  box-shadow: 0 0 0 3px var(--%NS%accent-soft);
}

.count[_ngcontent-%COMP%] {
  flex: none;
  color: var(--%NS%text-2);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

button[_ngcontent-%COMP%] {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 34px;
  padding: 0 14px;
  background: var(--%NS%surface-2);
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  color: var(--%NS%text);
  cursor: pointer;
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  transition: background-color 150ms var(--%NS%ease), border-color 150ms var(--%NS%ease);
}

button[_ngcontent-%COMP%]:hover {
  background: var(--%NS%surface-3);
  border-color: var(--%NS%accent-line);
}

button[_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: 2px;
}

button[_ngcontent-%COMP%]   svg[_ngcontent-%COMP%] {
  flex: none;
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.refresh.spinning[_ngcontent-%COMP%]   svg[_ngcontent-%COMP%] {
  animation: spin 0.8s linear infinite;
}

.page-select[_ngcontent-%COMP%] {
  flex: 0 1 220px;
  min-width: 0;
}

.pick.on[_ngcontent-%COMP%] {
  background: var(--%NS%accent-soft);
  border-color: var(--%NS%accent-line);
  color: var(--%NS%text-strong);
}

.defer[_ngcontent-%COMP%] {
  margin-top: 16px;
}

.defer-title[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 8px;
}

.defer-list[_ngcontent-%COMP%] {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.defer-row[_ngcontent-%COMP%] {
  justify-content: flex-start;
  flex-wrap: wrap;
  width: 100%;
  height: auto;
  min-height: var(--%NS%control-h);
  padding: 6px 12px;
  background: var(--%NS%surface);
  border-color: var(--%NS%border);
  text-align: left;
}

.defer-row[_ngcontent-%COMP%]:disabled {
  cursor: default;
}

.defer-state[_ngcontent-%COMP%] {
  padding: 0 8px;
  border-radius: 99px;
  background: var(--%NS%surface-3);
  color: var(--%NS%text-2);
  font-size: 11px;
  line-height: 18px;
}

.defer-state-complete[_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%ok) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%ok) 12%, transparent);
  color: var(--%NS%ok);
}

.defer-state-error[_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%danger) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%danger) 12%, transparent);
  color: var(--%NS%danger);
}

.defer-state-loading[_ngcontent-%COMP%], 
.defer-state-placeholder[_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%warn) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%warn) 12%, transparent);
  color: var(--%NS%warn);
}

.triggers[_ngcontent-%COMP%] {
  min-width: 0;
  color: var(--%NS%text-2);
  font-size: 12px;
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pick-message[_ngcontent-%COMP%] {
  margin: 0 0 12px;
  color: var(--%NS%text-2);
  line-height: 1.5;
}

.layout[_ngcontent-%COMP%] {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}

@media (min-width: 880px) {
  .layout[_ngcontent-%COMP%] {
    grid-template-columns: minmax(0, 1fr) minmax(340px, 44%);
  }
  .detail[_ngcontent-%COMP%] {
    position: sticky;
    top: 64px;
    max-height: calc(100vh - 150px);
    overflow: auto;
  }
}
.tree[_ngcontent-%COMP%] {
  min-width: 0;
  padding: 6px;
  background: var(--%NS%surface);
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  animation: enter 0.35s var(--%NS%ease) both;
}

.row[_ngcontent-%COMP%] {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 8px 0 calc(4px + var(--%NS%depth, 0) * 18px);
  border-radius: var(--%NS%radius-sm);
  cursor: pointer;
  transition: background-color 120ms var(--%NS%ease);
}

.row[_ngcontent-%COMP%]::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 14px;
  width: calc(var(--%NS%depth, 0) * 18px);
  background: repeating-linear-gradient(to right, var(--%NS%border) 0 1px, transparent 1px 18px);
  pointer-events: none;
}

.row[_ngcontent-%COMP%]:hover {
  background: var(--%NS%surface-2);
}

.row[_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: -2px;
}

.row.selected[_ngcontent-%COMP%] {
  background: var(--%NS%accent-soft);
  box-shadow: inset 2px 0 0 var(--%NS%accent);
}

.twisty[_ngcontent-%COMP%], 
.twisty-space[_ngcontent-%COMP%] {
  flex: none;
  width: 20px;
  height: 20px;
}

.twisty[_ngcontent-%COMP%] {
  display: grid;
  place-items: center;
  border-radius: 4px;
  color: var(--%NS%text-3);
}

.twisty[_ngcontent-%COMP%]:hover {
  color: var(--%NS%text);
  background: var(--%NS%surface-3);
}

.twisty[_ngcontent-%COMP%]   svg[_ngcontent-%COMP%] {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform 150ms var(--%NS%ease);
}

.twisty.open[_ngcontent-%COMP%]   svg[_ngcontent-%COMP%] {
  transform: rotate(90deg);
}

.name[_ngcontent-%COMP%] {
  min-width: 0;
  color: var(--%NS%text-strong);
  font-size: 12px;
  font-weight: 600;
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tag[_ngcontent-%COMP%] {
  flex: 0 1 auto;
  min-width: 0;
  color: var(--%NS%text-2);
  font-size: 12px;
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.routed[_ngcontent-%COMP%] {
  flex: none;
  max-width: 40%;
  padding: 0 8px;
  border: 1px solid var(--%NS%accent-line);
  border-radius: 99px;
  background: var(--%NS%accent-soft);
  color: var(--%NS%accent);
  font-family: var(--%NS%font-mono);
  font-size: 11px;
  line-height: 18px;
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.checks[_ngcontent-%COMP%] {
  flex: none;
  margin-left: auto;
  padding: 0 7px;
  border-radius: 99px;
  background: var(--%NS%accent-soft);
  color: var(--%NS%text);
  font-size: 11px;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
}

.checks[_ngcontent-%COMP%]    + .dirs[_ngcontent-%COMP%] {
  margin-left: 0;
}

.dirs[_ngcontent-%COMP%] {
  flex: none;
  margin-left: auto;
  padding: 0 7px;
  border-radius: 99px;
  background: var(--%NS%surface-3);
  color: var(--%NS%text-2);
  font-size: 11px;
  line-height: 18px;
}

.detail[_ngcontent-%COMP%] {
  min-width: 0;
  background: var(--%NS%surface);
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  animation: enter 0.35s var(--%NS%ease) both;
}

.detail.placeholder[_ngcontent-%COMP%] {
  padding: 24px 16px;
  border-style: dashed;
  text-align: center;
}

.detail-head[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--%NS%border);
}

.detail-head[_ngcontent-%COMP%]   h2[_ngcontent-%COMP%] {
  min-width: 0;
  margin: 0;
  color: var(--%NS%text-strong);
  font-size: 15px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.where[_ngcontent-%COMP%] {
  width: 100%;
  margin: 0;
  color: var(--%NS%text-2);
  font-size: 12px;
  overflow-wrap: anywhere;
}

.badge[_ngcontent-%COMP%] {
  padding: 2px 8px;
  border-radius: 99px;
  border-color: color-mix(in srgb, var(--%NS%accent) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%accent) 12%, transparent);
  color: var(--%NS%accent);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.actions[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  width: 100%;
}

.show-form[_ngcontent-%COMP%] {
  background: var(--%NS%accent);
  border-color: var(--%NS%accent);
  color: var(--%NS%accent-ink);
  font-weight: 600;
}

.show-form[_ngcontent-%COMP%]:hover {
  background: var(--%NS%accent-hover);
  border-color: var(--%NS%accent-hover);
}

.facts[_ngcontent-%COMP%] {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 8px 16px;
  margin: 0;
  padding: 14px 16px;
  border-bottom: 1px solid var(--%NS%border);
}

.facts[_ngcontent-%COMP%]   dt[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  align-self: center;
}

.facts[_ngcontent-%COMP%]   dd[_ngcontent-%COMP%] {
  min-width: 0;
  margin: 0;
  color: var(--%NS%text);
  overflow-wrap: anywhere;
}

.block[_ngcontent-%COMP%] {
  padding: 14px 16px;
  border-bottom: 1px solid var(--%NS%border);
}

.block[_ngcontent-%COMP%]:last-child {
  border-bottom: 0;
}

h3[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 8px;
}

.pill[_ngcontent-%COMP%] {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 16px;
  padding: 0 5px;
  border-radius: 99px;
  background: var(--%NS%surface-3);
  color: var(--%NS%text-2);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0;
}

.props[_ngcontent-%COMP%], 
.deps[_ngcontent-%COMP%], 
.chips[_ngcontent-%COMP%] {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.chips[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
}

.prop[_ngcontent-%COMP%], 
.dep[_ngcontent-%COMP%] {
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%bg);
}

.prop-name[_ngcontent-%COMP%] {
  display: block;
  margin-bottom: 4px;
  color: var(--%NS%text-strong);
  font-size: 12px;
  font-weight: 600;
}

pre[_ngcontent-%COMP%] {
  max-height: 200px;
  margin: 0;
  overflow: auto;
  color: var(--%NS%text);
  font-family: var(--%NS%font-mono);
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.chip[_ngcontent-%COMP%] {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 10px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: 99px;
  color: var(--%NS%text);
  font-size: 12px;
}

.chip.on[_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%ok) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%ok) 12%, transparent);
  color: var(--%NS%ok);
}

.chip-note[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
  font-size: 11px;
}

.chip.on[_ngcontent-%COMP%]   .chip-note[_ngcontent-%COMP%] {
  color: inherit;
}

.dep[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
}

.token[_ngcontent-%COMP%] {
  min-width: 0;
  color: var(--%NS%text-strong);
  font-size: 12px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.flag[_ngcontent-%COMP%] {
  padding: 0 6px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: 5px;
  color: var(--%NS%text-2);
  font-family: var(--%NS%font-mono);
  font-size: 10px;
  font-weight: 400;
  letter-spacing: 0;
  line-height: 16px;
  text-transform: none;
}

.from[_ngcontent-%COMP%] {
  margin-left: auto;
  color: var(--%NS%text-2);
  font-size: 12px;
}

.from[_ngcontent-%COMP%]   .mono[_ngcontent-%COMP%] {
  color: var(--%NS%text);
}

.from.missing[_ngcontent-%COMP%] {
  color: var(--%NS%warn);
}

.empty-line[_ngcontent-%COMP%] {
  margin: 0;
  color: var(--%NS%text-2);
}

.state[_ngcontent-%COMP%] {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px 16px;
  text-align: center;
  background: var(--%NS%surface);
  border: 1px dashed var(--%NS%border-strong);
  border-radius: var(--%NS%radius);
}

.state.compact[_ngcontent-%COMP%] {
  padding: 24px 12px;
  border: 0;
  background: none;
}

.state-title[_ngcontent-%COMP%] {
  margin: 0;
  color: var(--%NS%text-strong);
  font-size: 14px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.state-hint[_ngcontent-%COMP%] {
  max-width: 440px;
  margin: 0 auto;
  color: var(--%NS%text-2);
  line-height: 1.5;
}

.spinner[_ngcontent-%COMP%] {
  width: 20px;
  height: 20px;
  border: 2px solid var(--%NS%border-strong);
  border-top-color: var(--%NS%accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .spinner[_ngcontent-%COMP%], 
   .refresh.spinning[_ngcontent-%COMP%]   svg[_ngcontent-%COMP%] {
    animation: none;
  }
}
.source-list[_ngcontent-%COMP%] {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.source-item[_ngcontent-%COMP%] {
  min-width: 0;
  background: var(--%NS%surface);
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  overflow: hidden;
}

.source-item.expanded[_ngcontent-%COMP%] {
  border-color: var(--%NS%accent-line);
  box-shadow: inset 2px 0 0 var(--%NS%accent);
}

.source-toggle[_ngcontent-%COMP%] {
  justify-content: flex-start;
  gap: 12px;
  width: 100%;
  height: auto;
  min-height: 52px;
  padding: 10px 16px;
  background: none;
  border: 0;
  border-radius: 0;
  text-align: left;
}

.source-toggle[_ngcontent-%COMP%]:hover {
  background: var(--%NS%surface-2);
}

.source-toggle[_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: -2px;
}

.kind-flag[_ngcontent-%COMP%] {
  flex: none;
  padding: 1px 8px;
  border-radius: 99px;
  border-color: color-mix(in srgb, var(--%NS%accent) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%accent) 12%, transparent);
  color: var(--%NS%accent);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.kind-flag.directive[_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%ok) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%ok) 12%, transparent);
  color: var(--%NS%ok);
}

.row-main[_ngcontent-%COMP%] {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.selector[_ngcontent-%COMP%] {
  color: var(--%NS%text-strong);
  font-weight: 600;
  overflow-wrap: anywhere;
}

.file[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
  font-size: 12px;
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.chevron[_ngcontent-%COMP%] {
  flex: none;
  width: 16px;
  height: 16px;
  fill: none;
  stroke: var(--%NS%text-3);
  stroke-width: 2.2;
  transition: transform 200ms var(--%NS%ease);
}

.expanded[_ngcontent-%COMP%]   .chevron[_ngcontent-%COMP%] {
  transform: rotate(90deg);
  stroke: var(--%NS%accent);
}

.inline-detail[_ngcontent-%COMP%] {
  padding: 0 0 12px;
  border-top: 1px solid var(--%NS%border);
}

.inline-detail[_ngcontent-%COMP%]   .facts[_ngcontent-%COMP%] {
  border-bottom: 0;
}

.inline-detail[_ngcontent-%COMP%]   .show-form[_ngcontent-%COMP%] {
  margin: 0 16px;
}`]})};function pk(e){return e.line?`${e.file}:${e.line}`:e.file}function mk(e,t){let n=t.filter(t=>t.fullPath===e.fullPath&&t.redirectTo!==void 0==(e.redirectTo!==void 0));return n.find(t=>!!e.component&&t.component===e.component)??n.find(t=>!t.component||!e.component)}var hk=iE;function gk(e){return e.startsWith(`/`)&&!e.startsWith(`//`)&&!/^\/*[a-z][a-z0-9+.-]*:/i.test(e)&&!e.includes(`[redacted]`)&&e.length<=2e3}var _k=`Could not reach the page.`;async function vk(e,t,n){return await hk(e,`request-router-action`,{pageId:t,request:n})??{error:`Could not reach the page.`}}function yk(e){return e===`succeeded`?`good`:e===`redirected`||e===`pending`||e===`skipped`?`warn`:e===`cancelled`||e===`failed`?`bad`:``}var bk=()=>[],xk=(e,t)=>t[0],Sk=(e,t)=>t.input;function Ck(e,t){if(e&1&&(H(0,`p`,3),J(1,` The browser shows `),H(2,`code`),J(3),U(),J(4,`, not the router URL (skipLocationChange, browserUrl, a failed navigation or code that changed history). `),U()),e&2){let e=K();M(3),Y(e.browserUrl)}}function wk(e,t){if(e&1&&(H(0,`p`,12),J(1),U()),e&2){let e=K(3);M(),Y(e.navigationOff)}}function Tk(e,t){if(e&1){let e=W();H(0,`div`,8),Fg(1,`span`,9),H(2,`span`,10),J(3,`Navigating to `),H(4,`code`),J(5),U(),J(6),U(),H(7,`button`,11),Qg(`click`,function(){return O(e),k(K(2).abort())}),J(8,` Abort `),U()(),P(9,wk,2,1,`p`,12)}if(e&2){let e=t,n=K(2);M(5),Y(e.url),M(),X(` (#`,e.id,`)`),M(),Vg(`disabled`,!n.navigationAllowed()),N(`aria-describedby`,n.navigationAllowed()?null:`route-current-writes-off`),M(2),F(n.navigationAllowed()?-1:9)}}function Ek(e,t){if(e&1&&(H(0,`p`,4),J(1),U()),e&2){let e=K(2);M(),Y(e.message())}}function Dk(e,t){if(e&1&&(H(0,`dt`),J(1,`Document title`),U(),H(2,`dd`),J(3),U()),e&2){let e=K();M(3),Y(e.title)}}function Ok(e,t){if(e&1&&(H(0,`dt`),J(1,`Query params`),U(),H(2,`dd`)(3,`code`),J(4),dv(5,`json`),U()()),e&2){let e=K();M(4),Y(pv(5,1,e.queryParams))}}function kk(e,t){if(e&1&&(H(0,`dt`),J(1,`Fragment`),U(),H(2,`dd`)(3,`code`),J(4),U()()),e&2){let e=K();M(4),Y(e.fragment)}}function Ak(e,t){if(e&1&&(H(0,`span`,14),J(1),U()),e&2){let e=K().$implicit;M(),Y(e.route.outlet)}}function jk(e,t){e&1&&(H(0,`span`,14),J(1,`lazy`),U())}function Mk(e,t){if(e&1&&(H(0,`div`,15),J(1),U()),e&2){let e=K().$implicit;M(),Z(` title `,e.route.title,``,e.route.ownTitle===!1?` (inherited)`:``,` `)}}function Nk(e,t){if(e&1&&(H(0,`code`,16),J(1),U()),e&2){let e=K().$implicit;M(),Y(e.route.component)}}function Pk(e,t){e&1&&(H(0,`span`,19),J(1,`–`),U(),H(2,`span`,20),J(3,`none`),U())}function Fk(e,t){e&1&&(H(0,`span`,14),J(1,`inherited`),U())}function Ik(e,t){if(e&1&&(H(0,`div`,17)(1,`code`),J(2),dv(3,`json`),U(),P(4,Fk,2,0,`span`,14),U()),e&2){let e=t.$implicit,n=K().$implicit;M(2),Z(``,e[0],`: `,pv(3,3,e[1])),M(2),F(n.route.paramSources?.[e[0]]===`inherited`?4:-1)}}function Lk(e,t){e&1&&(H(0,`span`,19),J(1,`–`),U(),H(2,`span`,20),J(3,`none`),U())}function Rk(e,t){e&1&&(H(0,`span`,14),J(1),U()),e&2&&(M(),Y(t))}function zk(e,t){if(e&1&&(H(0,`div`,18)(1,`code`),J(2),dv(3,`json`),U(),P(4,Rk,2,1,`span`,14),U()),e&2){let e,n=t.$implicit,r=K().$implicit;M(2),Z(``,n[0],`: `,pv(3,3,n[1])),M(2),F((e=r.route.dataSources?.[n[0]])?4:-1,e)}}function Bk(e,t){e&1&&(H(0,`span`,19),J(1,`–`),U(),H(2,`span`,20),J(3,`none`),U())}function Vk(e,t){if(e&1&&(H(0,`span`,14),J(1),U()),e&2){let e=t.$implicit;M(),Y(e)}}function Hk(e,t){if(e&1&&(H(0,`span`,14),J(1),U()),e&2){let e=t.$implicit;M(),X(`resolve `,e)}}function Uk(e,t){e&1&&(H(0,`span`,19),J(1,`–`),U(),H(2,`span`,20),J(3,`none`),U())}function Wk(e,t){if(e&1&&(H(0,`tr`)(1,`td`,13),J(2),P(3,Ak,2,1,`span`,14),P(4,jk,2,0,`span`,14),P(5,Mk,2,2,`div`,15),U(),H(6,`td`),P(7,Nk,2,1,`code`,16)(8,Pk,4,0),U(),H(9,`td`),I(10,Ik,5,5,`div`,17,xk,!1,Lk,4,0),U(),H(13,`td`),I(14,zk,5,5,`div`,18,xk,!1,Bk,4,0),U(),H(17,`td`),I(18,Vk,2,1,`span`,14,wg),I(20,Hk,2,1,`span`,14,wg),P(22,Uk,4,0),U()()),e&2){let e=t.$implicit,n=K(2);M(),C_(`padding-left`,14+e.depth*16,`px`),M(),X(` `,e.depth===0&&!e.route.path?`(root)`:`/`+e.route.path,` `),M(),F(e.route.outlet===`primary`?-1:3),M(),F(e.route.lazy?4:-1),M(),F(e.route.title?5:-1),M(2),F(e.route.component?7:8),M(3),L(n.entries(e.route.params)),M(4),L(n.entries(e.route.data)),M(4),L(n.guardList(e.route)),M(2),L(e.route.resolvers??ov(10,bk)),M(2),F(!n.guardList(e.route).length&&!e.route.resolvers?.length?22:-1)}}function Gk(e,t){if(e&1&&(H(0,`code`),J(1),U(),J(2,` for `),H(3,`code`),J(4),U()),e&2){let e=K().$implicit;M(),Y(e.outlet.component??`?`),M(3),Y(e.outlet.route??`?`)}}function Kk(e,t){e&1&&(H(0,`span`,23),J(1,`not activated`),U())}function qk(e,t){e&1&&(H(0,`span`,14),J(1,`detached by reuse strategy`),U())}function Jk(e,t){if(e&1&&(H(0,`span`,14),J(1),U()),e&2){let e=t.$implicit;M(),Z(`input `,e.input,` ← `,e.source)}}function Yk(e,t){if(e&1&&(H(0,`span`,24),J(1,`routerOutletData `),H(2,`code`),J(3),U()()),e&2){let e=K().$implicit;M(3),Y(e.outlet.data)}}function Xk(e,t){if(e&1&&(H(0,`li`)(1,`span`,14),J(2),U(),P(3,Gk,5,2)(4,Kk,2,0,`span`,23),P(5,qk,2,0,`span`,14),I(6,Jk,2,2,`span`,14,Sk),P(8,Yk,4,1,`span`,24),U()),e&2){let e=t.$implicit,n=K(3);C_(`padding-left`,10+e.depth*16,`px`),M(2),Y(e.outlet.outlet),M(),F(e.outlet.activated?3:4),M(2),F(e.outlet.detached?5:-1),M(),L(n.boundInputs(e.outlet)),M(2),F(e.outlet.data===void 0?-1:8)}}function Zk(e,t){if(e&1&&(H(0,`h3`),J(1,`Outlets`),U(),H(2,`ul`,21),I(3,Xk,9,6,`li`,22,Cg),U()),e&2){let e=K(2);M(3),L(e.outletRows())}}function Qk(e,t){if(e&1&&(H(0,`p`,1)(1,`span`,2),J(2,`URL`),U(),H(3,`code`),J(4),U()(),P(5,Ck,5,1,`p`,3),P(6,Tk,10,5),P(7,Ek,2,1,`p`,4),H(8,`dl`,5),P(9,Dk,4,1),P(10,Ok,6,3),P(11,kk,5,1),U(),H(12,`h3`),J(13,`Active routes`),U(),H(14,`div`,6)(15,`table`)(16,`thead`)(17,`tr`)(18,`th`,7),J(19,`Route`),U(),H(20,`th`,7),J(21,`Component`),U(),H(22,`th`,7),J(23,`Params`),U(),H(24,`th`,7),J(25,`Data`),U(),H(26,`th`,7),J(27,`Guards and resolvers`),U()()(),H(28,`tbody`),I(29,Wk,23,11,`tr`,null,Cg),U()()(),P(31,Zk,5,0)),e&2){let e,n=t,r=K();M(4),Y(n.url),M(),F(n.urlDrift&&n.browserUrl?5:-1),M(),F((e=n.pending)?6:-1,e),M(),F(r.message()?7:-1),M(2),F(n.title?9:-1),M(),F(r.hasKeys(n.queryParams)?10:-1),M(),F(n.fragment?11:-1),M(18),L(r.rows()),M(2),F(r.outletRows().length?31:-1)}}function $k(e,t){e&1&&(H(0,`div`,0)(1,`p`,25),J(2,`This page reports no Router.`),U(),H(3,`p`,23),J(4,` Add `),H(5,`code`),J(6,`provideRouter()`),U(),J(7,` to the app config and navigate once to see the active routes here. `),U()())}var eA=class e{page=$.required();rpc=$(null);navigationAllowed=Q(()=>cE(this.rpc(),`router`));navigationOff=GT(`router`);message=j(``);rows=Q(()=>{let e=[],t=(n,r)=>{e.push({route:n,depth:r});for(let e of n.children)t(e,r+1)},n=this.page().snapshot?.root;return n&&t(n,0),e});outletRows=Q(()=>{let e=[],t=(n,r)=>{for(let i of n)e.push({outlet:i,depth:r}),i.children&&t(i.children,r+1)};return t(this.page().outlets??[],0),e});hasKeys(e){return Object.keys(e).length>0}entries(e){return Object.entries(e)}guardList(e){return Object.entries(e.guards??{}).flatMap(([e,t])=>t.map(t=>`${e} ${t}`))}boundInputs(e){return(e.inputs??[]).filter(e=>e.source!==`unset`)}async abort(){let e=await vk(this.rpc(),this.page().pageId,{action:`abort`});this.message.set(e.error?String(e.error):`Aborted navigation #${e.aborted}.`)}static ɵfac=function(t){return new(t||e)};static ɵcmp=Bh({type:e,selectors:[[`app-route-current`]],inputs:{page:[1,`page`],rpc:[1,`rpc`]},decls:2,vars:1,consts:[[1,`empty`],[1,`url`],[1,`url-label`],[`role`,`note`,1,`note`],[`role`,`status`,1,`muted`],[1,`facts`],[`role`,`region`,`aria-label`,`Active routes`,`tabindex`,`0`,1,`table-scroll`],[`scope`,`col`],[`role`,`status`,1,`pending`],[`aria-hidden`,`true`,1,`pulse`],[1,`pending-text`],[`type`,`button`,1,`small`,3,`click`,`disabled`],[`id`,`route-current-writes-off`,1,`muted`],[1,`path`],[1,`tag`],[1,`sub`],[1,`component`],[1,`entry`],[1,`entry`,`data`],[`aria-hidden`,`true`,1,`nil`],[1,`visually-hidden`],[1,`outlets`],[3,`padding-left`],[1,`muted`],[1,`outlet-data`],[1,`empty-title`]],template:function(e,t){if(e&1&&P(0,Qk,32,8)(1,$k,8,0,`div`,0),e&2){let e;F((e=t.page().snapshot)?0:1,e)}},dependencies:[ab],styles:[`.muted[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
  font-size: 13px;
  line-height: 1.5;
}

.nil[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
}

code[_ngcontent-%COMP%] {
  font-family: var(--%NS%font-mono);
  font-size: 12.5px;
  color: var(--%NS%text);
  overflow-wrap: anywhere;
}

.tag[_ngcontent-%COMP%] {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  min-height: 20px;
  margin: 2px 4px 2px 0;
  padding: 0 8px;
  border: 1px solid var(--%NS%border);
  border-radius: 99px;
  background: var(--%NS%surface-2);
  color: var(--%NS%text);
  font-family: var(--%NS%font-mono);
  font-size: 11.5px;
  line-height: 1.4;
  vertical-align: middle;
  overflow-wrap: anywhere;
  white-space: normal;
}

.badge[_ngcontent-%COMP%] {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  padding: 0 8px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: 99px;
  background: var(--%NS%surface-2);
  color: var(--%NS%text);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
  vertical-align: middle;
}

.badge[data-tone=good][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%ok) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%ok) 12%, transparent);
  color: var(--%NS%ok);
}

.badge[data-tone=warn][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%warn) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%warn) 12%, transparent);
  color: var(--%NS%warn);
}

.badge[data-tone=bad][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%danger) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%danger) 12%, transparent);
  color: var(--%NS%danger);
}

button.small[_ngcontent-%COMP%] {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%surface-2);
  color: var(--%NS%text);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.15s var(--%NS%ease), border-color 0.15s var(--%NS%ease), transform 0.1s var(--%NS%ease);
}

button.small[_ngcontent-%COMP%]:hover:not(:disabled) {
  background: var(--%NS%surface-3);
  border-color: color-mix(in srgb, var(--%NS%text-3) 50%, var(--%NS%border-strong));
}

button.small[_ngcontent-%COMP%]:active:not(:disabled) {
  transform: translateY(1px);
}

button.small[_ngcontent-%COMP%]:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

button.small.primary[_ngcontent-%COMP%] {
  border-color: var(--%NS%accent);
  background: var(--%NS%accent);
  color: var(--%NS%accent-ink);
  font-weight: 600;
}

button.small.primary[_ngcontent-%COMP%]:hover:not(:disabled) {
  border-color: var(--%NS%accent-hover);
  background: var(--%NS%accent-hover);
}

button.small[_ngcontent-%COMP%]:focus-visible, 
.table-scroll[_ngcontent-%COMP%]:focus-visible, 
input[type=checkbox][_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: 2px;
}

input.field[_ngcontent-%COMP%], 
select[_ngcontent-%COMP%] {
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  background-color: var(--%NS%bg);
  color: var(--%NS%text);
  font: inherit;
  font-size: 13px;
  transition: border-color 0.15s var(--%NS%ease), box-shadow 0.15s var(--%NS%ease);
}

input.field[_ngcontent-%COMP%] {
  text-overflow: ellipsis;
}

input.field[_ngcontent-%COMP%]::placeholder {
  color: var(--%NS%text-3);
}

input.field[_ngcontent-%COMP%]:hover:not(:focus), 
select[_ngcontent-%COMP%]:hover:not(:focus) {
  border-color: color-mix(in srgb, var(--%NS%text-3) 50%, var(--%NS%border-strong));
}

input.field[_ngcontent-%COMP%]:focus-visible, 
select[_ngcontent-%COMP%]:focus-visible {
  outline: none;
  border-color: var(--%NS%accent);
  box-shadow: 0 0 0 3px var(--%NS%accent-soft);
}

.note[_ngcontent-%COMP%] {
  margin: 0;
  padding: 10px 14px;
  border: 1px solid color-mix(in srgb, var(--%NS%warn) 30%, transparent);
  border-radius: var(--%NS%radius-sm);
  background: color-mix(in srgb, var(--%NS%warn) 10%, transparent);
  color: var(--%NS%text);
  font-size: 13px;
  line-height: 1.5;
}

.empty[_ngcontent-%COMP%] {
  display: grid;
  gap: 6px;
  justify-items: center;
  margin: 0;
  padding: 40px 24px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  text-align: center;
  animation: enter 0.35s var(--%NS%ease) both;
}

.empty[_ngcontent-%COMP%]   p[_ngcontent-%COMP%] {
  margin: 0;
  max-width: 480px;
  line-height: 1.6;
}

.empty-title[_ngcontent-%COMP%] {
  color: var(--%NS%text-strong);
  font-size: 14px;
  font-weight: 600;
}

.empty[_ngcontent-%COMP%]   .small[_ngcontent-%COMP%] {
  margin-top: 8px;
}

.facts[_ngcontent-%COMP%] {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  align-items: baseline;
  gap: 8px 24px;
  margin: 0;
  padding: 14px 16px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  font-size: 13px;
}

.facts[_ngcontent-%COMP%]:empty {
  display: none;
}

dt[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

dd[_ngcontent-%COMP%] {
  min-width: 0;
  margin: 0;
  color: var(--%NS%text);
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}

.table-scroll[_ngcontent-%COMP%] {
  overflow-x: auto;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  box-shadow: var(--%NS%shadow);
  animation: enter 0.35s var(--%NS%ease) both;
}

table[_ngcontent-%COMP%] {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

th[_ngcontent-%COMP%] {
  padding: 10px 14px;
  border-bottom: 1px solid var(--%NS%border);
  background: color-mix(in srgb, var(--%NS%surface-2) 60%, var(--%NS%surface));
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-align: left;
  text-transform: uppercase;
  white-space: nowrap;
}

td[_ngcontent-%COMP%] {
  padding: 10px 14px;
  border-bottom: 1px solid var(--%NS%border);
  color: var(--%NS%text);
  line-height: 1.5;
  vertical-align: top;
  transition: background-color 0.15s var(--%NS%ease);
}

tbody[_ngcontent-%COMP%]   tr[_ngcontent-%COMP%]:last-child   td[_ngcontent-%COMP%] {
  border-bottom: none;
}

tbody[_ngcontent-%COMP%]   tr[_ngcontent-%COMP%]:hover   td[_ngcontent-%COMP%] {
  background: var(--%NS%surface-2);
}

.path[_ngcontent-%COMP%] {
  color: var(--%NS%accent);
  font-family: var(--%NS%font-mono);
  font-size: 12.5px;
  white-space: nowrap;
}

h3[_ngcontent-%COMP%] {
  margin: 8px 0 -4px;
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

@media (max-width: 480px) {
  .facts[_ngcontent-%COMP%] {
    grid-template-columns: minmax(0, 1fr);
    gap: 2px;
  }
  .facts[_ngcontent-%COMP%]   dd[_ngcontent-%COMP%]    + dt[_ngcontent-%COMP%] {
    margin-top: 8px;
  }
}
[_nghost-%COMP%] {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.url[_ngcontent-%COMP%] {
  display: flex;
  align-items: baseline;
  gap: 12px;
  min-width: 0;
  margin: 0;
  padding: 12px 16px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  box-shadow: var(--%NS%shadow);
}

.url-label[_ngcontent-%COMP%] {
  flex: none;
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.url[_ngcontent-%COMP%]   code[_ngcontent-%COMP%] {
  min-width: 0;
  color: var(--%NS%accent);
  font-size: 14px;
  font-weight: 500;
}

.pending[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
  padding: 6px 6px 6px 14px;
  border: 1px solid color-mix(in srgb, var(--%NS%warn) 30%, transparent);
  border-radius: var(--%NS%radius-sm);
  background: color-mix(in srgb, var(--%NS%warn) 10%, transparent);
  color: var(--%NS%warn);
  font-size: 13px;
}

.pending-text[_ngcontent-%COMP%] {
  flex: 1 1 200px;
  min-width: 0;
}

.pending[_ngcontent-%COMP%]   code[_ngcontent-%COMP%] {
  color: var(--%NS%text-strong);
}

.pulse[_ngcontent-%COMP%] {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 99px;
  background: var(--%NS%warn);
  animation: _ngcontent-%COMP%_pulse 1.2s ease-in-out infinite;
}

@keyframes _ngcontent-%COMP%_pulse {
  50% {
    opacity: 0.35;
  }
}
@media (prefers-reduced-motion: reduce) {
  .pulse[_ngcontent-%COMP%] {
    animation: none;
  }
}
.sub[_ngcontent-%COMP%] {
  margin-top: 4px;
  color: var(--%NS%text-2);
  font-family: var(--%NS%font-sans);
  font-size: 12px;
  white-space: normal;
}

.component[_ngcontent-%COMP%] {
  color: var(--%NS%text-strong);
}

.entry[_ngcontent-%COMP%]    + .entry[_ngcontent-%COMP%] {
  margin-top: 2px;
}

.data[_ngcontent-%COMP%] {
  max-width: 360px;
}

.outlets[_ngcontent-%COMP%] {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 6px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  color: var(--%NS%text);
  font-size: 13px;
  list-style: none;
  animation: enter 0.35s var(--%NS%ease) both;
}

.outlets[_ngcontent-%COMP%]   li[_ngcontent-%COMP%] {
  padding-top: 6px;
  padding-right: 10px;
  padding-bottom: 6px;
  border-radius: var(--%NS%radius-sm);
  line-height: 1.8;
  overflow-wrap: anywhere;
  transition: background-color 0.15s var(--%NS%ease);
}

.outlets[_ngcontent-%COMP%]   li[_ngcontent-%COMP%]:hover {
  background: var(--%NS%surface-2);
}

.outlet-data[_ngcontent-%COMP%] {
  display: block;
  color: var(--%NS%text-2);
  font-size: 12px;
}`]})};function tA(e,t){if(e&1&&(H(0,`span`,8),J(1),U()),e&2){let e=K(2);M(),X(``,e.counts().error,` error(s)`)}}function nA(e,t){if(e&1&&(H(0,`span`,9),J(1),U()),e&2){let e=K(2);M(),X(``,e.counts().warning,` warning(s)`)}}function rA(e,t){if(e&1&&(H(0,`span`,10),J(1),U()),e&2){let e=K(2);M(),X(``,e.counts().info,` info`)}}function iA(e,t){if(e&1&&(H(0,`span`,3),P(1,tA,2,1,`span`,8),P(2,nA,2,1,`span`,9),P(3,rA,2,1,`span`,10),U()),e&2){let e=K();M(),F(e.counts().error?1:-1),M(),F(e.counts().warning?2:-1),M(),F(e.counts().info?3:-1)}}function aA(e,t){if(e&1){let e=W();H(0,`div`,4)(1,`p`,11),J(2,`The route checks could not run.`),U(),H(3,`p`,2),J(4,`The devtools server did not answer. Check that it is still running.`),U(),H(5,`button`,1),Qg(`click`,function(){return O(e),k(K().run())}),J(6,`Retry`),U()()}}function oA(e,t){e&1&&(H(0,`p`,5),J(1,`Checking…`),U())}function sA(e,t){e&1&&J(0,` This page runs in events-only mode: it has no debug utils (a production build or an unusual setup), so it cannot report its route config. `)}function cA(e,t){e&1&&J(0,` The page has not reported its route config yet. It appears after the app finishes bootstrapping. `)}function lA(e,t){e&1&&J(0,` No page with a router is connected. `)}function uA(e,t){if(e&1&&(H(0,`div`,6)(1,`p`,11),J(2,`No checks ran.`),U(),H(3,`p`,2),P(4,sA,1,0)(5,cA,1,0)(6,lA,1,0),U()()),e&2){let e;M(4),F((e=t)===`events-only`?4:e===`no-config`?5:6)}}function dA(e,t){if(e&1&&(H(0,`li`)(1,`div`,12)(2,`span`,10),J(3),U(),H(4,`code`,13),J(5),U(),H(6,`code`,14),J(7),U()(),H(8,`p`,15),J(9),U(),H(10,`p`,16)(11,`span`,17),J(12,`Fix`),U(),H(13,`span`,18),J(14),H(15,`span`,2),J(16),U()()()()),e&2){let e=t.$implicit,n=K(2);N(`data-severity`,e.severity),M(2),N(`data-tone`,n.severityTone(e.severity)),M(),Y(e.severity),M(2),Y(e.rule),M(2),Y(e.route),M(2),Y(e.message),M(5),X(``,e.fix,` `),M(2),X(`(Angular `,e.angular===`throws`?`throws`:e.angular===`warns`?`warns`:`does not warn`,`)`)}}function fA(e,t){if(e&1&&(H(0,`ul`,7),I(1,dA,17,8,`li`,null,Cg),U()),e&2){let e=K();N(`aria-busy`,e.checking()),M(),L(e.findings())}}function pA(e,t){e&1&&(H(0,`div`,6)(1,`span`,19),A(),H(2,`svg`,20),Fg(3,`path`,21),U()(),ps(),H(4,`p`,11),J(5,`No route config problems found.`),U(),H(6,`p`,2),J(7,`The check runs again after each navigation or config change.`),U()())}var mA=class e{page=$.required();rpc=$(null);result=j(null);failed=j(!1);checking=j(!1);findings=Q(()=>{let e=this.result();return e?.checked?e.findings:[]});notChecked=Q(()=>{let e=this.result();return e&&!e.checked?e.reason:null});counts=Q(()=>{let e={error:0,warning:0,info:0};for(let t of this.findings())e[t.severity]++;return e});key=Q(()=>{let e=this.page(),t=e.navigations[e.navigations.length-1],n=JSON.stringify((e.links??[]).map(e=>[e.text,e.href,e.linkActive!==void 0,e.ariaCurrent===void 0])),r=`${e.setup?.mode}/${e.setup?.features?.componentInputBinding}`;return`${e.pageId}:${e.generation}:${t?.id}:${t?.outcome}:${n}:${r}`});seq=0;checkedPage=null;constructor(){uc(()=>{this.key(),Cv(()=>void this.run())})}severityTone(e){return e===`error`?`bad`:e===`warning`?`warn`:``}async run(){let e=++this.seq,t=this.page().pageId;t!==this.checkedPage&&this.result.set(null),this.checking.set(!0);let n=await hk(this.rpc(),`router-lint`,t);e===this.seq&&(this.checking.set(!1),this.failed.set(!n),n&&(this.result.set(n),this.checkedPage=t))}static ɵfac=function(t){return new(t||e)};static ɵcmp=Bh({type:e,selectors:[[`app-route-lint`]],inputs:{page:[1,`page`],rpc:[1,`rpc`]},decls:11,vars:4,consts:[[1,`toolbar`],[`type`,`button`,1,`small`,3,`click`],[1,`muted`],[1,`summary`],[`role`,`alert`,1,`empty`],[`role`,`status`,1,`muted`,`empty`],[1,`empty`],[1,`findings`],[`data-tone`,`bad`,1,`badge`],[`data-tone`,`warn`,1,`badge`],[1,`badge`],[1,`empty-title`],[1,`head`],[1,`rule`],[1,`route`],[1,`message`],[1,`fix`],[1,`fix-label`],[1,`fix-text`],[`aria-hidden`,`true`,1,`ok-mark`],[`width`,`16`,`height`,`16`,`viewBox`,`0 0 24 24`,`fill`,`none`,`stroke`,`currentColor`,`stroke-width`,`2.5`,`stroke-linecap`,`round`,`stroke-linejoin`,`round`],[`d`,`M20 6 9 17l-5-5`]],template:function(e,t){if(e&1&&(H(0,`div`,0)(1,`button`,1),Qg(`click`,function(){return t.run()}),J(2),U(),H(3,`span`,2),J(4,`Checks the live config, links and recent navigations. Lazy routes that have not loaded are skipped.`),U(),P(5,iA,4,3,`span`,3),U(),P(6,aA,7,0,`div`,4)(7,oA,2,0,`p`,5)(8,uA,7,1,`div`,6)(9,fA,3,1,`ul`,7)(10,pA,8,0,`div`,6)),e&2){let e;M(),N(`aria-busy`,t.checking()),M(),X(` `,t.checking()?`Checking…`:`Check again`,` `),M(3),F(t.result()?.checked&&t.findings().length?5:-1),M(),F(t.failed()?6:t.result()?(e=t.notChecked())?8:t.findings().length?9:10:7,e)}},styles:[`.muted[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
  font-size: 13px;
  line-height: 1.5;
}

.nil[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
}

code[_ngcontent-%COMP%] {
  font-family: var(--%NS%font-mono);
  font-size: 12.5px;
  color: var(--%NS%text);
  overflow-wrap: anywhere;
}

.tag[_ngcontent-%COMP%] {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  min-height: 20px;
  margin: 2px 4px 2px 0;
  padding: 0 8px;
  border: 1px solid var(--%NS%border);
  border-radius: 99px;
  background: var(--%NS%surface-2);
  color: var(--%NS%text);
  font-family: var(--%NS%font-mono);
  font-size: 11.5px;
  line-height: 1.4;
  vertical-align: middle;
  overflow-wrap: anywhere;
  white-space: normal;
}

.badge[_ngcontent-%COMP%] {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  padding: 0 8px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: 99px;
  background: var(--%NS%surface-2);
  color: var(--%NS%text);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
  vertical-align: middle;
}

.badge[data-tone=good][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%ok) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%ok) 12%, transparent);
  color: var(--%NS%ok);
}

.badge[data-tone=warn][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%warn) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%warn) 12%, transparent);
  color: var(--%NS%warn);
}

.badge[data-tone=bad][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%danger) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%danger) 12%, transparent);
  color: var(--%NS%danger);
}

button.small[_ngcontent-%COMP%] {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%surface-2);
  color: var(--%NS%text);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.15s var(--%NS%ease), border-color 0.15s var(--%NS%ease), transform 0.1s var(--%NS%ease);
}

button.small[_ngcontent-%COMP%]:hover:not(:disabled) {
  background: var(--%NS%surface-3);
  border-color: color-mix(in srgb, var(--%NS%text-3) 50%, var(--%NS%border-strong));
}

button.small[_ngcontent-%COMP%]:active:not(:disabled) {
  transform: translateY(1px);
}

button.small[_ngcontent-%COMP%]:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

button.small.primary[_ngcontent-%COMP%] {
  border-color: var(--%NS%accent);
  background: var(--%NS%accent);
  color: var(--%NS%accent-ink);
  font-weight: 600;
}

button.small.primary[_ngcontent-%COMP%]:hover:not(:disabled) {
  border-color: var(--%NS%accent-hover);
  background: var(--%NS%accent-hover);
}

button.small[_ngcontent-%COMP%]:focus-visible, 
.table-scroll[_ngcontent-%COMP%]:focus-visible, 
input[type=checkbox][_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: 2px;
}

input.field[_ngcontent-%COMP%], 
select[_ngcontent-%COMP%] {
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  background-color: var(--%NS%bg);
  color: var(--%NS%text);
  font: inherit;
  font-size: 13px;
  transition: border-color 0.15s var(--%NS%ease), box-shadow 0.15s var(--%NS%ease);
}

input.field[_ngcontent-%COMP%] {
  text-overflow: ellipsis;
}

input.field[_ngcontent-%COMP%]::placeholder {
  color: var(--%NS%text-3);
}

input.field[_ngcontent-%COMP%]:hover:not(:focus), 
select[_ngcontent-%COMP%]:hover:not(:focus) {
  border-color: color-mix(in srgb, var(--%NS%text-3) 50%, var(--%NS%border-strong));
}

input.field[_ngcontent-%COMP%]:focus-visible, 
select[_ngcontent-%COMP%]:focus-visible {
  outline: none;
  border-color: var(--%NS%accent);
  box-shadow: 0 0 0 3px var(--%NS%accent-soft);
}

.note[_ngcontent-%COMP%] {
  margin: 0;
  padding: 10px 14px;
  border: 1px solid color-mix(in srgb, var(--%NS%warn) 30%, transparent);
  border-radius: var(--%NS%radius-sm);
  background: color-mix(in srgb, var(--%NS%warn) 10%, transparent);
  color: var(--%NS%text);
  font-size: 13px;
  line-height: 1.5;
}

.empty[_ngcontent-%COMP%] {
  display: grid;
  gap: 6px;
  justify-items: center;
  margin: 0;
  padding: 40px 24px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  text-align: center;
  animation: enter 0.35s var(--%NS%ease) both;
}

.empty[_ngcontent-%COMP%]   p[_ngcontent-%COMP%] {
  margin: 0;
  max-width: 480px;
  line-height: 1.6;
}

.empty-title[_ngcontent-%COMP%] {
  color: var(--%NS%text-strong);
  font-size: 14px;
  font-weight: 600;
}

.empty[_ngcontent-%COMP%]   .small[_ngcontent-%COMP%] {
  margin-top: 8px;
}

.facts[_ngcontent-%COMP%] {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  align-items: baseline;
  gap: 8px 24px;
  margin: 0;
  padding: 14px 16px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  font-size: 13px;
}

.facts[_ngcontent-%COMP%]:empty {
  display: none;
}

dt[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

dd[_ngcontent-%COMP%] {
  min-width: 0;
  margin: 0;
  color: var(--%NS%text);
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}

.table-scroll[_ngcontent-%COMP%] {
  overflow-x: auto;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  box-shadow: var(--%NS%shadow);
  animation: enter 0.35s var(--%NS%ease) both;
}

table[_ngcontent-%COMP%] {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

th[_ngcontent-%COMP%] {
  padding: 10px 14px;
  border-bottom: 1px solid var(--%NS%border);
  background: color-mix(in srgb, var(--%NS%surface-2) 60%, var(--%NS%surface));
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-align: left;
  text-transform: uppercase;
  white-space: nowrap;
}

td[_ngcontent-%COMP%] {
  padding: 10px 14px;
  border-bottom: 1px solid var(--%NS%border);
  color: var(--%NS%text);
  line-height: 1.5;
  vertical-align: top;
  transition: background-color 0.15s var(--%NS%ease);
}

tbody[_ngcontent-%COMP%]   tr[_ngcontent-%COMP%]:last-child   td[_ngcontent-%COMP%] {
  border-bottom: none;
}

tbody[_ngcontent-%COMP%]   tr[_ngcontent-%COMP%]:hover   td[_ngcontent-%COMP%] {
  background: var(--%NS%surface-2);
}

.path[_ngcontent-%COMP%] {
  color: var(--%NS%accent);
  font-family: var(--%NS%font-mono);
  font-size: 12.5px;
  white-space: nowrap;
}

h3[_ngcontent-%COMP%] {
  margin: 8px 0 -4px;
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

@media (max-width: 480px) {
  .facts[_ngcontent-%COMP%] {
    grid-template-columns: minmax(0, 1fr);
    gap: 2px;
  }
  .facts[_ngcontent-%COMP%]   dd[_ngcontent-%COMP%]    + dt[_ngcontent-%COMP%] {
    margin-top: 8px;
  }
}
[_nghost-%COMP%] {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.toolbar[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
  padding: 8px 12px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
}

.toolbar[_ngcontent-%COMP%]   .muted[_ngcontent-%COMP%] {
  flex: 1 1 240px;
  font-size: 12px;
}

.summary[_ngcontent-%COMP%] {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px;
  font-variant-numeric: tabular-nums;
}

.ok-mark[_ngcontent-%COMP%] {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  margin-bottom: 4px;
  border: 1px solid color-mix(in srgb, var(--%NS%ok) 30%, transparent);
  border-radius: 99px;
  background: color-mix(in srgb, var(--%NS%ok) 12%, transparent);
  color: var(--%NS%ok);
}

.findings[_ngcontent-%COMP%] {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.findings[_ngcontent-%COMP%]   li[_ngcontent-%COMP%] {
  padding: 12px 16px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  color: var(--%NS%text);
  font-size: 13px;
  line-height: 1.5;
  animation: enter 0.35s var(--%NS%ease) both;
  transition: border-color 0.15s var(--%NS%ease);
}

.findings[_ngcontent-%COMP%]   li[_ngcontent-%COMP%]:hover {
  border-color: var(--%NS%border-strong);
}

.findings[_ngcontent-%COMP%]   li[data-severity=error][_ngcontent-%COMP%] {
  box-shadow: inset 3px 0 0 var(--%NS%danger);
}

.findings[_ngcontent-%COMP%]   li[data-severity=warning][_ngcontent-%COMP%] {
  box-shadow: inset 3px 0 0 var(--%NS%warn);
}

.head[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  min-width: 0;
}

.rule[_ngcontent-%COMP%] {
  color: var(--%NS%text-strong);
  font-weight: 500;
}

.route[_ngcontent-%COMP%] {
  color: var(--%NS%accent);
}

.message[_ngcontent-%COMP%] {
  margin: 8px 0 0;
}

.fix[_ngcontent-%COMP%] {
  display: flex;
  gap: 10px;
  align-items: baseline;
  margin: 10px 0 0;
  padding: 8px 12px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%surface-2);
  color: var(--%NS%text);
}

.fix-label[_ngcontent-%COMP%] {
  flex: none;
  color: var(--%NS%accent);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.fix-text[_ngcontent-%COMP%] {
  min-width: 0;
  overflow-wrap: anywhere;
}

.fix[_ngcontent-%COMP%]   .muted[_ngcontent-%COMP%] {
  font-size: 12px;
}`]})},hA=(e,t)=>t.name,gA=(e,t)=>t[0];function _A(e,t){e&1&&(H(0,`p`,1),J(1,` Events-only mode: this build has no debug utils (production build or unusual setup), so the route config, lint and actions are limited. `),U())}function vA(e,t){if(e&1&&(H(0,`dt`),J(1,`Angular`),U(),H(2,`dd`),J(3),U()),e&2){let e=K();M(3),Y(e.angularVersion)}}function yA(e,t){if(e&1&&(H(0,`dt`),J(1,`Base href`),U(),H(2,`dd`)(3,`code`),J(4),U()()),e&2){let e=K();M(4),Y(e.baseHref)}}function bA(e,t){if(e&1&&(H(0,`dt`),J(1,`Hydration`),U(),H(2,`dd`),J(3),U()),e&2){let e=K();M(3),X(``,e.hydrated,` component(s) hydrated from server HTML`)}}function xA(e,t){if(e&1&&(H(0,`tr`)(1,`td`,5)(2,`code`),J(3),U()(),H(4,`td`)(5,`code`),J(6),U()(),H(7,`td`,6)(8,`span`,7),J(9),U()()()),e&2){let e=t.$implicit;M(3),Y(e.name),M(3),Y(e.value),M(2),N(`data-tone`,e.set?`warn`:``),M(),Y(e.set?`set`:`default`)}}function SA(e,t){if(e&1&&(H(0,`li`)(1,`span`,7),J(2),U()()),e&2){let e=t.$implicit;M(),N(`data-tone`,e[1]===`off`?``:`good`),M(),Z(``,e[0],`: `,e[1])}}function CA(e,t){if(e&1&&(H(0,`h3`),J(1,`Features`),U(),H(2,`ul`,8),I(3,SA,3,3,`li`,null,gA),U()),e&2){let e=K(),t=K();M(3),L(t.entries(e.features))}}function wA(e,t){if(e&1&&(H(0,`dt`),J(1),U(),H(2,`dd`)(3,`code`),J(4),U()()),e&2){let e=t.$implicit;M(),Y(e[0]),M(3),Y(e[1])}}function TA(e,t){if(e&1&&(H(0,`h3`),J(1,`Strategies`),U(),H(2,`dl`,2),I(3,wA,5,2,null,null,gA),U()),e&2){let e=K(),t=K();M(3),L(t.entries(e.strategies))}}function EA(e,t){if(e&1&&(P(0,_A,2,0,`p`,1),H(1,`dl`,2)(2,`dt`),J(3,`Set up with`),U(),H(4,`dd`),J(5),U(),P(6,vA,4,1),P(7,yA,5,1),P(8,bA,4,1),U(),H(9,`h3`),J(10,`Options`),U(),H(11,`div`,3)(12,`table`)(13,`thead`)(14,`tr`)(15,`th`,4),J(16,`Option`),U(),H(17,`th`,4),J(18,`Value`),U(),H(19,`th`,4),J(20,`Source`),U()()(),H(21,`tbody`),I(22,xA,10,4,`tr`,null,hA),U()()(),P(24,CA,5,0),P(25,TA,5,0)),e&2){let e=t,n=K();F(e.mode===`events-only`?0:-1),M(5),Z(` `,e.setupKind,``,e.routers>1?`, `+e.routers+` routers on the page`:``,` `),M(),F(e.angularVersion?6:-1),M(),F(e.baseHref?7:-1),M(),F(e.hydrated?8:-1),M(14),L(e.options),M(2),F(n.entries(e.features).length?24:-1),M(),F(n.entries(e.strategies).length?25:-1)}}function DA(e,t){e&1&&(H(0,`div`,0)(1,`p`,9),J(2,`The page has not reported its router setup yet.`),U(),H(3,`p`,10),J(4,` It appears after the app finishes bootstrapping. Reload the app if it stays empty. `),U()())}var OA=class e{page=$.required();entries(e){return Object.entries(e)}static ɵfac=function(t){return new(t||e)};static ɵcmp=Bh({type:e,selectors:[[`app-route-setup`]],inputs:{page:[1,`page`]},decls:2,vars:1,consts:[[1,`empty`],[`role`,`note`,1,`note`],[1,`facts`],[`role`,`region`,`aria-label`,`Router options`,`tabindex`,`0`,1,`table-scroll`],[`scope`,`col`],[1,`name`],[1,`source`],[1,`badge`],[1,`chips`],[1,`empty-title`],[1,`muted`]],template:function(e,t){if(e&1&&P(0,EA,26,8)(1,DA,5,0,`div`,0),e&2){let e;F((e=t.page().setup)?0:1,e)}},styles:[`.muted[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
  font-size: 13px;
  line-height: 1.5;
}

.nil[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
}

code[_ngcontent-%COMP%] {
  font-family: var(--%NS%font-mono);
  font-size: 12.5px;
  color: var(--%NS%text);
  overflow-wrap: anywhere;
}

.tag[_ngcontent-%COMP%] {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  min-height: 20px;
  margin: 2px 4px 2px 0;
  padding: 0 8px;
  border: 1px solid var(--%NS%border);
  border-radius: 99px;
  background: var(--%NS%surface-2);
  color: var(--%NS%text);
  font-family: var(--%NS%font-mono);
  font-size: 11.5px;
  line-height: 1.4;
  vertical-align: middle;
  overflow-wrap: anywhere;
  white-space: normal;
}

.badge[_ngcontent-%COMP%] {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  padding: 0 8px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: 99px;
  background: var(--%NS%surface-2);
  color: var(--%NS%text);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
  vertical-align: middle;
}

.badge[data-tone=good][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%ok) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%ok) 12%, transparent);
  color: var(--%NS%ok);
}

.badge[data-tone=warn][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%warn) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%warn) 12%, transparent);
  color: var(--%NS%warn);
}

.badge[data-tone=bad][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%danger) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%danger) 12%, transparent);
  color: var(--%NS%danger);
}

button.small[_ngcontent-%COMP%] {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%surface-2);
  color: var(--%NS%text);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.15s var(--%NS%ease), border-color 0.15s var(--%NS%ease), transform 0.1s var(--%NS%ease);
}

button.small[_ngcontent-%COMP%]:hover:not(:disabled) {
  background: var(--%NS%surface-3);
  border-color: color-mix(in srgb, var(--%NS%text-3) 50%, var(--%NS%border-strong));
}

button.small[_ngcontent-%COMP%]:active:not(:disabled) {
  transform: translateY(1px);
}

button.small[_ngcontent-%COMP%]:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

button.small.primary[_ngcontent-%COMP%] {
  border-color: var(--%NS%accent);
  background: var(--%NS%accent);
  color: var(--%NS%accent-ink);
  font-weight: 600;
}

button.small.primary[_ngcontent-%COMP%]:hover:not(:disabled) {
  border-color: var(--%NS%accent-hover);
  background: var(--%NS%accent-hover);
}

button.small[_ngcontent-%COMP%]:focus-visible, 
.table-scroll[_ngcontent-%COMP%]:focus-visible, 
input[type=checkbox][_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: 2px;
}

input.field[_ngcontent-%COMP%], 
select[_ngcontent-%COMP%] {
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  background-color: var(--%NS%bg);
  color: var(--%NS%text);
  font: inherit;
  font-size: 13px;
  transition: border-color 0.15s var(--%NS%ease), box-shadow 0.15s var(--%NS%ease);
}

input.field[_ngcontent-%COMP%] {
  text-overflow: ellipsis;
}

input.field[_ngcontent-%COMP%]::placeholder {
  color: var(--%NS%text-3);
}

input.field[_ngcontent-%COMP%]:hover:not(:focus), 
select[_ngcontent-%COMP%]:hover:not(:focus) {
  border-color: color-mix(in srgb, var(--%NS%text-3) 50%, var(--%NS%border-strong));
}

input.field[_ngcontent-%COMP%]:focus-visible, 
select[_ngcontent-%COMP%]:focus-visible {
  outline: none;
  border-color: var(--%NS%accent);
  box-shadow: 0 0 0 3px var(--%NS%accent-soft);
}

.note[_ngcontent-%COMP%] {
  margin: 0;
  padding: 10px 14px;
  border: 1px solid color-mix(in srgb, var(--%NS%warn) 30%, transparent);
  border-radius: var(--%NS%radius-sm);
  background: color-mix(in srgb, var(--%NS%warn) 10%, transparent);
  color: var(--%NS%text);
  font-size: 13px;
  line-height: 1.5;
}

.empty[_ngcontent-%COMP%] {
  display: grid;
  gap: 6px;
  justify-items: center;
  margin: 0;
  padding: 40px 24px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  text-align: center;
  animation: enter 0.35s var(--%NS%ease) both;
}

.empty[_ngcontent-%COMP%]   p[_ngcontent-%COMP%] {
  margin: 0;
  max-width: 480px;
  line-height: 1.6;
}

.empty-title[_ngcontent-%COMP%] {
  color: var(--%NS%text-strong);
  font-size: 14px;
  font-weight: 600;
}

.empty[_ngcontent-%COMP%]   .small[_ngcontent-%COMP%] {
  margin-top: 8px;
}

.facts[_ngcontent-%COMP%] {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  align-items: baseline;
  gap: 8px 24px;
  margin: 0;
  padding: 14px 16px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  font-size: 13px;
}

.facts[_ngcontent-%COMP%]:empty {
  display: none;
}

dt[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

dd[_ngcontent-%COMP%] {
  min-width: 0;
  margin: 0;
  color: var(--%NS%text);
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}

.table-scroll[_ngcontent-%COMP%] {
  overflow-x: auto;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  box-shadow: var(--%NS%shadow);
  animation: enter 0.35s var(--%NS%ease) both;
}

table[_ngcontent-%COMP%] {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

th[_ngcontent-%COMP%] {
  padding: 10px 14px;
  border-bottom: 1px solid var(--%NS%border);
  background: color-mix(in srgb, var(--%NS%surface-2) 60%, var(--%NS%surface));
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-align: left;
  text-transform: uppercase;
  white-space: nowrap;
}

td[_ngcontent-%COMP%] {
  padding: 10px 14px;
  border-bottom: 1px solid var(--%NS%border);
  color: var(--%NS%text);
  line-height: 1.5;
  vertical-align: top;
  transition: background-color 0.15s var(--%NS%ease);
}

tbody[_ngcontent-%COMP%]   tr[_ngcontent-%COMP%]:last-child   td[_ngcontent-%COMP%] {
  border-bottom: none;
}

tbody[_ngcontent-%COMP%]   tr[_ngcontent-%COMP%]:hover   td[_ngcontent-%COMP%] {
  background: var(--%NS%surface-2);
}

.path[_ngcontent-%COMP%] {
  color: var(--%NS%accent);
  font-family: var(--%NS%font-mono);
  font-size: 12.5px;
  white-space: nowrap;
}

h3[_ngcontent-%COMP%] {
  margin: 8px 0 -4px;
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

@media (max-width: 480px) {
  .facts[_ngcontent-%COMP%] {
    grid-template-columns: minmax(0, 1fr);
    gap: 2px;
  }
  .facts[_ngcontent-%COMP%]   dd[_ngcontent-%COMP%]    + dt[_ngcontent-%COMP%] {
    margin-top: 8px;
  }
}
[_nghost-%COMP%] {
  display: grid;
  gap: 16px;
  min-width: 0;
}

.name[_ngcontent-%COMP%]   code[_ngcontent-%COMP%] {
  color: var(--%NS%text-strong);
}

.source[_ngcontent-%COMP%] {
  width: 1%;
  white-space: nowrap;
}

.chips[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.chips[_ngcontent-%COMP%]   .badge[_ngcontent-%COMP%] {
  font-family: var(--%NS%font-mono);
  font-weight: 500;
}

.facts[_ngcontent-%COMP%]   code[_ngcontent-%COMP%] {
  color: var(--%NS%text-strong);
}`]})},kA=(e,t)=>t.id,AA=(e,t)=>t.phase;function jA(e,t){if(e&1&&(z(0,`p`,6),J(1),B()),e&2){let e=K();M(),Y(e.message())}}function MA(e,t){if(e&1&&(z(0,`p`,7),J(1),B()),e&2){let e=K();M(),Y(e.navigationOff)}}function NA(e,t){e&1&&(z(0,`span`,16),J(1,`→`),B(),z(2,`span`,17),J(3,`then`),B())}function PA(e,t){if(e&1&&(P(0,NA,4,0),z(1,`code`),J(2),B()),e&2){let e=t.$implicit,n=t.$index;F(n===0?-1:0),M(2),Y(e)}}function FA(e,t){if(e&1&&(z(0,`li`)(1,`code`),J(2),B(),z(3,`span`,16),J(4,` → `),B(),z(5,`span`,17),J(6,` to `),B(),z(7,`code`),J(8),B(),J(9),B()),e&2){let e=t.$implicit,n=K(3);M(2),Y(e.from),M(6),Y(e.to),M(),X(`: `,n.hopCause(e),` `)}}function IA(e,t){if(e&1&&(z(0,`div`,11)(1,`p`,12)(2,`span`,13),J(3),B(),I(4,PA,3,2,null,null,Cg),B(),z(6,`ol`,14),I(7,FA,10,3,`li`,null,Cg),B(),z(9,`p`,15),J(10),B()()),e&2){let e=t.$implicit,n=K(2);M(3),Y(n.loopTitle(e)),M(),L(e.cycle),M(3),L(e.hops),M(3),Y(n.loopMeta(e))}}function LA(e,t){if(e&1&&(z(0,`section`,9)(1,`h3`,10),J(2),B(),I(3,IA,11,2,`div`,11,Cg),B()),e&2){let e=K();M(2),X(` `,e.loops().length===1?`Loop detected`:e.loops().length+` loops detected`,` `),M(),L(e.loops())}}function RA(e,t){if(e&1&&(z(0,`span`),V(1,`i`),J(2),B()),e&2){let e=t.$implicit,n=K(2);M(),C_(`background`,n.color(e)),M(),Y(e)}}function zA(e,t){if(e&1&&(z(0,`time`),J(1),B()),e&2){let e=K().$implicit,t=K(2);M(),Y(t.time(e.startedAt))}}function BA(e,t){if(e&1&&(z(0,`span`,16),J(1,`→`),B(),z(2,`span`,17),J(3,`redirected to`),B(),z(4,`code`,25),J(5),B()),e&2){let e=K().$implicit;M(5),Y(e.finalUrl)}}function VA(e,t){if(e&1&&(z(0,`span`,28),J(1),B()),e&2){let e=K().$implicit;M(),Y(e.endedAt===void 0&&e.outcome!==`pending`?`before Pangular Inspector connected`:`started before Pangular Inspector connected`)}}function HA(e,t){if(e&1&&(z(0,`span`,29),J(1),B()),e&2){let e=K().$implicit;M(),X(``,e.phases?.total,`ms`)}}function UA(e,t){if(e&1&&(z(0,`span`,29),J(1),B()),e&2){let e=K().$implicit;M(),X(``,e.endedAt-e.startedAt,`ms`)}}function WA(e,t){e&1&&(z(0,`span`,30),J(1,`probe`),B())}function GA(e,t){if(e&1&&(z(0,`span`,13),J(1,`loop`),z(2,`span`,17),J(3),B()()),e&2){let e=t,n=K(3);M(3),Z(`: part of `,n.loopTitle(e),` `,e.cycle.join(` then `))}}function KA(e,t){if(e&1&&V(0,`span`),e&2){let e=t.$implicit,n=K(4);C_(`width`,e.width,`%`)(`background`,n.color(e.phase)),N(`title`,e.phase+` `+e.ms+`ms`)}}function qA(e,t){if(e&1&&(z(0,`div`,31),I(1,KA,1,5,`span`,37,AA),B()),e&2){let e=K().$implicit,t=K(2);N(`aria-label`,t.barLabel(e)),M(),L(t.bars(e))}}function JA(e,t){if(e&1&&(z(0,`dt`),J(1,`From`),B(),z(2,`dd`)(3,`code`),J(4),B()()),e&2){let e=K().$implicit;M(4),Y(e.from)}}function YA(e,t){if(e&1&&(z(0,`dt`),J(1,`Started by`),B(),z(2,`dd`),J(3),B()),e&2){let e=K().$implicit;M(3),Z(``,e.caller,` (`,e.trigger,`)`)}}function XA(e,t){if(e&1&&(z(0,`dt`),J(1,`Extras`),B(),z(2,`dd`),J(3),B()),e&2){let e=K().$implicit;M(3),Y(e.extras?.join(`, `))}}function ZA(e,t){if(e&1&&(z(0,`dt`),J(1,`Redirect of`),B(),z(2,`dd`),J(3),B()),e&2){let e=K().$implicit;M(3),X(`#`,e.redirectedFrom)}}function QA(e,t){if(e&1&&(z(0,`div`),J(1,` This navigation: `),z(2,`code`),J(3),B(),J(4,` to `),z(5,`code`),J(6),B(),J(7),B()),e&2){let e=t.$implicit,n=K(4);M(3),Y(e.from),M(3),Y(e.to),M(),X(`, `,n.hopCause(e),` `)}}function $A(e,t){if(e&1&&(z(0,`dt`),J(1,`Loop`),B(),z(2,`dd`,38),J(3),I(4,QA,8,3,`div`,null,Cg),B()),e&2){let e=t,n=K().$implicit,r=K(2);M(3),X(` `,e.cycle.join(` → `),` `),M(),L(r.hopsOf(e,n))}}function ej(e,t){if(e&1&&(z(0,`dt`),J(1,`Redirects to`),B(),z(2,`dd`)(3,`code`),J(4),B(),J(5),B()),e&2){let e=K().$implicit;M(4),Y(e.redirectTo),M(),X(` (`,e.redirectKind,`) `)}}function tj(e,t){if(e&1&&(z(0,`dt`),J(1,`Guards`),B(),z(2,`dd`),J(3),B()),e&2){let e=K().$implicit,t=K(2);M(3),Z(``,e.guards.names.join(`, `)||`none`,`: `,t.guardResult(e))}}function nj(e,t){if(e&1&&(z(0,`div`)(1,`code`),J(2),B(),J(3),z(4,`code`),J(5),B(),J(6,`: `),z(7,`strong`),J(8),B(),J(9),B()),e&2){let e=t.$implicit,n=K(4);M(2),Y(e.guard),M(),X(` `,e.kind,` on `),M(2),Y(e.route),M(2),q(`bad`,n.isBad(e.result)),M(),Y(e.result),M(),X(` (`,e.ms,`ms) `)}}function rj(e,t){if(e&1&&(z(0,`dt`),J(1,`Runs`),B(),z(2,`dd`),I(3,nj,10,7,`div`,null,Cg),B()),e&2){let e=K().$implicit;M(3),L(e.runs)}}function ij(e,t){if(e&1&&J(0),e&2){let e=K(2).$implicit;X(` leaving `,e.checked.deactivate.join(`, `),`; `)}}function aj(e,t){if(e&1&&(z(0,`dt`),J(1,`Checked`),B(),z(2,`dd`),P(3,ij,1,1),J(4),B()),e&2){let e=K().$implicit;M(3),F(e.checked.deactivate.length?3:-1),M(),X(` entering `,e.checked.activate.join(`, `)||`nothing new`,` `)}}function oj(e,t){if(e&1&&(z(0,`dt`),J(1,`Resolvers`),B(),z(2,`dd`),J(3),B()),e&2){let e=K().$implicit;M(3),Y(e.resolvers?.names?.join(`, `))}}function sj(e,t){if(e&1&&(z(0,`dt`),J(1,`Lazy loaded`),B(),z(2,`dd`),J(3),B()),e&2){let e=K().$implicit;M(3),Y(e.lazyLoaded?.join(`, `))}}function cj(e,t){if(e&1&&(z(0,`dt`),J(1,`Reused`),B(),z(2,`dd`),J(3),B()),e&2){let e=K().$implicit;M(3),X(` `,e.reused?.join(`, `),` (component kept, only inputs and params change) `)}}function lj(e,t){if(e&1&&(z(0,`dt`),J(1,`HTTP`),B(),z(2,`dd`),J(3),B()),e&2){let e=K().$implicit;M(3),Z(``,e.requests.count,` request(s): `,e.requests.urls.join(`, `))}}function uj(e,t){if(e&1&&(z(0,`dt`),J(1,`Scroll`),B(),z(2,`dd`),J(3),B()),e&2){let e=K().$implicit;M(3),Y(e.scroll)}}function dj(e,t){if(e&1&&(z(0,`dt`),J(1,`Title after`),B(),z(2,`dd`),J(3),B()),e&2){let e=K().$implicit;M(3),Y(e.title)}}function fj(e,t){if(e&1&&(z(0,`dt`),J(1,`Warnings`),B(),z(2,`dd`),J(3),B()),e&2){let e=K().$implicit;M(3),Y(e.warnings?.join(` · `))}}function pj(e,t){if(e&1&&(z(0,`dt`),J(1,`Reason`),B(),z(2,`dd`,38),J(3),B()),e&2){let e=K().$implicit,t=K(2);M(3),Y(t.reasonText(e))}}function mj(e,t){if(e&1&&(z(0,`dt`),J(1,`Error`),B(),z(2,`dd`,38),J(3),B()),e&2){let e=K().$implicit;M(3),Y(e.errorCode)}}function hj(e,t){if(e&1&&(z(0,`dt`),J(1,`Error handler`),B(),z(2,`dd`),J(3),B()),e&2){let e=K().$implicit;M(3),Y(e.errorHandler)}}function gj(e,t){if(e&1&&(z(0,`dt`),J(1,`Earlier`),B(),z(2,`dd`),J(3),B()),e&2){let e=K().$implicit;M(3),X(``,e.earlier,` navigation(s) before Pangular Inspector connected`)}}function _j(e,t){if(e&1&&(z(0,`p`,36),J(1,` Replay is off: the URL is redacted or not relative. `),B()),e&2){let e=K().$implicit;R(`id`,av(`replay-note-`,e.id))}}function vj(e,t){if(e&1){let e=W();z(0,`li`)(1,`div`,23),P(2,zA,2,1,`time`),z(3,`span`,24),J(4),B(),z(5,`code`,25),J(6),B(),P(7,BA,6,1),z(8,`span`,26)(9,`span`,27),J(10),B(),P(11,VA,2,1,`span`,28)(12,HA,2,1,`span`,29)(13,UA,2,1,`span`,29),P(14,WA,2,0,`span`,30),P(15,GA,4,2,`span`,13),B()(),P(16,qA,3,1,`div`,31),z(17,`dl`,32),P(18,JA,5,1),P(19,YA,4,2),P(20,XA,4,1),P(21,ZA,4,1),P(22,$A,6,1),P(23,ej,6,2),P(24,tj,4,2),P(25,rj,5,0),P(26,aj,5,2),P(27,oj,4,1),P(28,sj,4,1),P(29,cj,4,1),P(30,lj,4,2),P(31,uj,4,1),P(32,dj,4,1),P(33,fj,4,1),P(34,pj,4,1),P(35,mj,4,1),P(36,hj,4,1),P(37,gj,4,1),B(),z(38,`div`,33)(39,`button`,34),G(`click`,function(){let t=O(e).$implicit;return k(K(2).replay(t))}),J(40,` Replay `),B(),z(41,`button`,35),G(`click`,function(){let t=O(e).$implicit;return k(K(2).copy(t))}),J(42,` Copy repro `),B(),P(43,_j,2,2,`p`,36),B()()}if(e&2){let e,n,r=t.$implicit,i=K(2);q(`in-loop`,!!i.loopOf(r)),M(2),F(r.beforeConnect?-1:2),M(2),X(`#`,r.id),M(2),Y(r.url),M(),F(r.finalUrl&&r.finalUrl!==r.url?7:-1),M(2),N(`data-tone`,i.tone(r.outcome)),M(),Y(r.outcome),M(),F(r.beforeConnect?11:r.phases?.total===void 0?r.endedAt===void 0?-1:13:12),M(3),F(r.probe?14:-1),M(),F((e=i.loopOf(r))?15:-1,e),M(),F(i.bars(r).length?16:-1),M(2),F(r.from?18:-1),M(),F(r.caller?19:-1),M(),F(r.extras?.length?20:-1),M(),F(r.redirectedFrom===void 0?-1:21),M(),F((n=i.loopOf(r))?22:-1,n),M(),F(r.redirectTo?23:-1),M(),F(r.guards&&(r.guards.names.length||r.guards.passed===!1)?24:-1),M(),F(r.runs?.length?25:-1),M(),F(r.checked&&(r.checked.activate.length||r.checked.deactivate.length)?26:-1),M(),F(r.resolvers?.names?.length?27:-1),M(),F(r.lazyLoaded?.length?28:-1),M(),F(r.reused?.length?29:-1),M(),F(r.requests?30:-1),M(),F(r.scroll?31:-1),M(),F(r.title?32:-1),M(),F(r.warnings?.length?33:-1),M(),F(r.reason||r.code?34:-1),M(),F(r.errorCode?35:-1),M(),F(r.errorHandler?36:-1),M(),F(r.earlier?37:-1),M(2),R(`disabled`,!i.navigationAllowed()||!i.replayable(r)),N(`aria-describedby`,i.replayNote(r))(`aria-label`,`Replay navigation `+r.id),M(2),N(`aria-label`,`Copy repro for navigation `+r.id),M(2),F(i.replayable(r)?-1:43)}}function yj(e,t){if(e&1&&(z(0,`div`,18)(1,`span`,19),J(2),B(),z(3,`div`,20),I(4,RA,3,3,`span`,null,wg),B()(),z(6,`ol`,21),I(7,vj,44,37,`li`,22,kA),B()),e&2){let e=K();M(2),Z(``,e.items().length,` of `,e.page().navigations.length,` navigation(s)`),M(2),L(e.phases),M(3),L(e.items())}}function bj(e,t){if(e&1){let e=W();z(0,`div`,39)(1,`p`,40),J(2,`No navigations match the current filters.`),B(),z(3,`p`,28),J(4),B(),z(5,`button`,35),G(`click`,function(){O(e);let t=K(2),n=n_(2);return t.clearFilters(),k(n.focus())}),J(6,` Clear filters `),B()()}if(e&2){let e=K(2);M(4),X(` `,e.page().navigations.length,` navigation(s) are hidden. Clear the filters to see them. `)}}function xj(e,t){e&1&&(z(0,`div`,39)(1,`p`,40),J(2,`No navigations since Pangular Inspector connected.`),B(),z(3,`p`,28),J(4,`Earlier ones are not visible. Click a link in the app to record one.`),B()())}function Sj(e,t){e&1&&P(0,bj,7,1,`div`,39)(1,xj,5,0,`div`,39),e&2&&F(+!K().page().navigations.length)}var Cj=[`recognize`,`guards`,`resolve`,`activate`],wj={recognize:`#60a5fa`,guards:`#f59e0b`,resolve:`#2dd4bf`,activate:`#34d399`},Tj=class e{page=$.required();rpc=$(null);maxNavigations=Q(()=>sE(this.rpc()).limits.navigations);navigationAllowed=Q(()=>cE(this.rpc(),`router`));navigationOff=GT(`router`);phases=Cj;filter=j(``);onlyProblems=j(!1);message=j(``);loops=Q(()=>this.page().loops??[]);loopById=Q(()=>{let e=new Map;for(let t of this.loops())for(let n of t.ids)e.set(n,t);return e});items=Q(()=>{let e=this.filter().toLowerCase();return[...this.page().navigations].reverse().filter(t=>(!e||t.url.toLowerCase().includes(e)||!!t.finalUrl?.toLowerCase().includes(e))&&(!this.onlyProblems()||![`succeeded`,`pending`].includes(t.outcome)||this.loopById().has(t.id)))});loopOf(e){return this.loopById().get(e.id)}loopTitle(e){return e.kind===`burst`?`navigation loop`:`redirect loop`}hopsOf(e,t){return e.hops.filter(e=>e.id===t.id)}hopCause(e){return e.via===`navigate`?`#${e.id} started by ${e.by??`code`}`:`${e.via===`redirectTo`?`config`:`${e.via} redirect`}${e.by?` ${e.by}`:e.via===`redirectTo`?` redirectTo`:``} in #${e.id}`}loopMeta(e){let t=e.ids.length>1?`Navigations #${e.ids[0]} to #${e.ids[e.ids.length-1]}`:`Navigation #${e.ids[0]}`,n=e.bounces>1?`, came back ${e.bounces} times`:``,r=e.guards.length?` Guards involved: ${e.guards.join(`, `)}.`:``;return`${t}${n}; ${e.end}.${r}`}reasonText(e){return[e.code,e.reason].filter(Boolean).join(`: `)}clearFilters(){this.filter.set(``),this.onlyProblems.set(!1)}tone(e){return yk(e)}color(e){return wj[e]}bars(e){let t=e.phases?.total;return t?Cj.filter(t=>(e.phases?.[t]??0)>0).map(n=>({phase:n,ms:e.phases[n],width:Math.max(1,e.phases[n]/t*100)})):[]}barLabel(e){return`Phases: ${this.bars(e).map(e=>`${e.phase} ${e.ms}ms`).join(`, `)}`}guardResult(e){let t=e.guards?.passed;return t===!0?`passed`:t===!1?e.outcome===`redirected`?`redirected`:`blocked`:e.outcome===`pending`?`running`:`did not finish, navigation ${e.outcome}`}isBad(e){return e===`false`||/^(UrlTree|RedirectCommand|threw)/.test(e)}time=SD;async toggleInstrument(e){let t=e.target,n=t.checked,r=await vk(this.rpc(),this.page().pageId,{action:`instrument`,on:n});if(r.error){t.checked=!!this.page().instrumented,this.message.set(String(r.error));return}this.message.set(n?`Recording each guard and resolver.`:`Stopped recording guards and resolvers.`)}replayable(e){return gk(e.url)}replayNote(e){return this.navigationAllowed()?this.replayable(e)?null:`replay-note-${e.id}`:`route-timeline-writes-off`}async replay(e){this.message.set(`Replaying #${e.id}…`);let t=await vk(this.rpc(),this.page().pageId,{action:`replay`,id:e.id});if(t.error){this.message.set(String(t.error));return}let n=t.replay;this.message.set(`Replay of #${e.id}: ${n?.outcome??`unknown`}${t.same?` (same as before)`:` (different from before)`}.`)}async copy(e){let t=await hk(this.rpc(),`router-export`,{pageId:this.page().pageId,id:e.id});if(!t){this.message.set(`Could not build the repro.`);return}try{await navigator.clipboard.writeText(t),this.message.set(`Copied a markdown repro of #${e.id}.`)}catch{this.message.set(`The clipboard is not available here.`)}}exportJson(){let e=new Blob([JSON.stringify(this.page().navigations,null,2)],{type:`application/json`}),t=URL.createObjectURL(e),n=document.createElement(`a`);n.href=t,n.download=`navigations-${this.page().pageId}.json`,n.click(),URL.revokeObjectURL(t)}static ɵfac=function(t){return new(t||e)};static ɵcmp=Bh({type:e,selectors:[[`app-route-timeline`]],inputs:{page:[1,`page`],rpc:[1,`rpc`]},decls:17,vars:9,consts:[[`filterInput`,``],[1,`toolbar`],[`type`,`text`,`aria-label`,`Filter navigations by URL`,`placeholder`,`Filter by URL`,1,`field`,3,`input`,`value`],[1,`check`],[`type`,`checkbox`,3,`change`,`checked`],[`type`,`button`,1,`small`,`export`,3,`click`],[`role`,`status`,1,`message`],[`id`,`route-timeline-writes-off`,1,`message`],[`what`,`navigations`,`limit`,`navigations`,3,`dropped`,`max`],[`aria-labelledby`,`loops-heading`,1,`loops`],[`id`,`loops-heading`],[1,`loop`],[1,`chain`],[`data-tone`,`bad`,1,`badge`],[1,`hops`],[1,`muted`,`loop-meta`],[`aria-hidden`,`true`,1,`arrow`],[1,`visually-hidden`],[1,`meta-row`],[1,`muted`,`count`],[`aria-hidden`,`true`,1,`legend`],[1,`navs`],[3,`in-loop`],[1,`head`],[1,`id`],[1,`url`],[1,`meta`],[1,`badge`],[1,`muted`],[1,`muted`,`ms`],[1,`tag`],[`role`,`img`,1,`bar`],[1,`details`],[1,`actions`],[`type`,`button`,1,`small`,3,`click`,`disabled`],[`type`,`button`,1,`small`,3,`click`],[1,`muted`,`replay-note`,3,`id`],[3,`width`,`background`],[1,`reason`],[1,`empty`],[1,`empty-title`]],template:function(e,t){e&1&&(z(0,`div`,1)(1,`input`,2,0),G(`input`,function(e){return t.filter.set(e.target.value)}),B(),z(3,`label`,3)(4,`input`,4),G(`change`,function(e){return t.onlyProblems.set(e.target.checked)}),B(),J(5,` Only problems `),B(),z(6,`label`,3)(7,`input`,4),G(`change`,function(e){return t.toggleInstrument(e)}),B(),J(8,` Record each guard and resolver `),B(),z(9,`button`,5),G(`click`,function(){return t.exportJson()}),J(10,`Export JSON`),B()(),P(11,jA,2,1,`p`,6),P(12,MA,2,1,`p`,7),V(13,`app-limit-note`,8),P(14,LA,5,1,`section`,9),P(15,yj,9,2)(16,Sj,2,1)),e&2&&(M(),R(`value`,t.filter()),M(3),R(`checked`,t.onlyProblems()),M(3),R(`checked`,t.page().instrumented),M(4),F(t.message()?11:-1),M(),F(t.navigationAllowed()?-1:12),M(),R(`dropped`,t.page().dropped??0)(`max`,t.maxNavigations()),M(),F(t.loops().length?14:-1),M(),F(t.items().length?15:16))},dependencies:[TD],styles:[`.muted[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
  font-size: 13px;
  line-height: 1.5;
}

.nil[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
}

code[_ngcontent-%COMP%] {
  font-family: var(--%NS%font-mono);
  font-size: 12.5px;
  color: var(--%NS%text);
  overflow-wrap: anywhere;
}

.tag[_ngcontent-%COMP%] {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  min-height: 20px;
  margin: 2px 4px 2px 0;
  padding: 0 8px;
  border: 1px solid var(--%NS%border);
  border-radius: 99px;
  background: var(--%NS%surface-2);
  color: var(--%NS%text);
  font-family: var(--%NS%font-mono);
  font-size: 11.5px;
  line-height: 1.4;
  vertical-align: middle;
  overflow-wrap: anywhere;
  white-space: normal;
}

.badge[_ngcontent-%COMP%] {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  padding: 0 8px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: 99px;
  background: var(--%NS%surface-2);
  color: var(--%NS%text);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
  vertical-align: middle;
}

.badge[data-tone=good][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%ok) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%ok) 12%, transparent);
  color: var(--%NS%ok);
}

.badge[data-tone=warn][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%warn) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%warn) 12%, transparent);
  color: var(--%NS%warn);
}

.badge[data-tone=bad][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%danger) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%danger) 12%, transparent);
  color: var(--%NS%danger);
}

button.small[_ngcontent-%COMP%] {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%surface-2);
  color: var(--%NS%text);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.15s var(--%NS%ease), border-color 0.15s var(--%NS%ease), transform 0.1s var(--%NS%ease);
}

button.small[_ngcontent-%COMP%]:hover:not(:disabled) {
  background: var(--%NS%surface-3);
  border-color: color-mix(in srgb, var(--%NS%text-3) 50%, var(--%NS%border-strong));
}

button.small[_ngcontent-%COMP%]:active:not(:disabled) {
  transform: translateY(1px);
}

button.small[_ngcontent-%COMP%]:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

button.small.primary[_ngcontent-%COMP%] {
  border-color: var(--%NS%accent);
  background: var(--%NS%accent);
  color: var(--%NS%accent-ink);
  font-weight: 600;
}

button.small.primary[_ngcontent-%COMP%]:hover:not(:disabled) {
  border-color: var(--%NS%accent-hover);
  background: var(--%NS%accent-hover);
}

button.small[_ngcontent-%COMP%]:focus-visible, 
.table-scroll[_ngcontent-%COMP%]:focus-visible, 
input[type=checkbox][_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: 2px;
}

input.field[_ngcontent-%COMP%], 
select[_ngcontent-%COMP%] {
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  background-color: var(--%NS%bg);
  color: var(--%NS%text);
  font: inherit;
  font-size: 13px;
  transition: border-color 0.15s var(--%NS%ease), box-shadow 0.15s var(--%NS%ease);
}

input.field[_ngcontent-%COMP%] {
  text-overflow: ellipsis;
}

input.field[_ngcontent-%COMP%]::placeholder {
  color: var(--%NS%text-3);
}

input.field[_ngcontent-%COMP%]:hover:not(:focus), 
select[_ngcontent-%COMP%]:hover:not(:focus) {
  border-color: color-mix(in srgb, var(--%NS%text-3) 50%, var(--%NS%border-strong));
}

input.field[_ngcontent-%COMP%]:focus-visible, 
select[_ngcontent-%COMP%]:focus-visible {
  outline: none;
  border-color: var(--%NS%accent);
  box-shadow: 0 0 0 3px var(--%NS%accent-soft);
}

.note[_ngcontent-%COMP%] {
  margin: 0;
  padding: 10px 14px;
  border: 1px solid color-mix(in srgb, var(--%NS%warn) 30%, transparent);
  border-radius: var(--%NS%radius-sm);
  background: color-mix(in srgb, var(--%NS%warn) 10%, transparent);
  color: var(--%NS%text);
  font-size: 13px;
  line-height: 1.5;
}

.empty[_ngcontent-%COMP%] {
  display: grid;
  gap: 6px;
  justify-items: center;
  margin: 0;
  padding: 40px 24px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  text-align: center;
  animation: enter 0.35s var(--%NS%ease) both;
}

.empty[_ngcontent-%COMP%]   p[_ngcontent-%COMP%] {
  margin: 0;
  max-width: 480px;
  line-height: 1.6;
}

.empty-title[_ngcontent-%COMP%] {
  color: var(--%NS%text-strong);
  font-size: 14px;
  font-weight: 600;
}

.empty[_ngcontent-%COMP%]   .small[_ngcontent-%COMP%] {
  margin-top: 8px;
}

.facts[_ngcontent-%COMP%] {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  align-items: baseline;
  gap: 8px 24px;
  margin: 0;
  padding: 14px 16px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  font-size: 13px;
}

.facts[_ngcontent-%COMP%]:empty {
  display: none;
}

dt[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

dd[_ngcontent-%COMP%] {
  min-width: 0;
  margin: 0;
  color: var(--%NS%text);
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}

.table-scroll[_ngcontent-%COMP%] {
  overflow-x: auto;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  box-shadow: var(--%NS%shadow);
  animation: enter 0.35s var(--%NS%ease) both;
}

table[_ngcontent-%COMP%] {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

th[_ngcontent-%COMP%] {
  padding: 10px 14px;
  border-bottom: 1px solid var(--%NS%border);
  background: color-mix(in srgb, var(--%NS%surface-2) 60%, var(--%NS%surface));
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-align: left;
  text-transform: uppercase;
  white-space: nowrap;
}

td[_ngcontent-%COMP%] {
  padding: 10px 14px;
  border-bottom: 1px solid var(--%NS%border);
  color: var(--%NS%text);
  line-height: 1.5;
  vertical-align: top;
  transition: background-color 0.15s var(--%NS%ease);
}

tbody[_ngcontent-%COMP%]   tr[_ngcontent-%COMP%]:last-child   td[_ngcontent-%COMP%] {
  border-bottom: none;
}

tbody[_ngcontent-%COMP%]   tr[_ngcontent-%COMP%]:hover   td[_ngcontent-%COMP%] {
  background: var(--%NS%surface-2);
}

.path[_ngcontent-%COMP%] {
  color: var(--%NS%accent);
  font-family: var(--%NS%font-mono);
  font-size: 12.5px;
  white-space: nowrap;
}

h3[_ngcontent-%COMP%] {
  margin: 8px 0 -4px;
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

@media (max-width: 480px) {
  .facts[_ngcontent-%COMP%] {
    grid-template-columns: minmax(0, 1fr);
    gap: 2px;
  }
  .facts[_ngcontent-%COMP%]   dd[_ngcontent-%COMP%]    + dt[_ngcontent-%COMP%] {
    margin-top: 8px;
  }
}
[_nghost-%COMP%] {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.toolbar[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: center;
  padding: 8px 12px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  color: var(--%NS%text);
  font-size: 13px;
}

.toolbar[_ngcontent-%COMP%]   .field[_ngcontent-%COMP%] {
  flex: 1 1 200px;
  min-width: 0;
}

.export[_ngcontent-%COMP%] {
  margin-left: auto;
}

.check[_ngcontent-%COMP%] {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  min-height: 34px;
  color: var(--%NS%text-2);
  cursor: pointer;
  user-select: none;
  transition: color 0.15s var(--%NS%ease);
}

.check[_ngcontent-%COMP%]:hover {
  color: var(--%NS%text);
}

.check[_ngcontent-%COMP%]   input[_ngcontent-%COMP%] {
  flex: none;
  width: 14px;
  height: 14px;
  margin: 0;
  accent-color: var(--%NS%accent);
  cursor: pointer;
}

.message[_ngcontent-%COMP%] {
  margin: 0;
  padding: 8px 12px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%surface-2);
  color: var(--%NS%text);
  font-size: 13px;
  overflow-wrap: anywhere;
}

.meta-row[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  align-items: center;
  justify-content: space-between;
  padding: 0 4px;
}

.count[_ngcontent-%COMP%] {
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.legend[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 16px;
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.legend[_ngcontent-%COMP%]   span[_ngcontent-%COMP%] {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.legend[_ngcontent-%COMP%]   i[_ngcontent-%COMP%] {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 99px;
}

.navs[_ngcontent-%COMP%] {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.navs[_ngcontent-%COMP%]    > li[_ngcontent-%COMP%] {
  min-width: 0;
  padding: 12px 16px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  font-size: 13px;
  animation: enter 0.35s var(--%NS%ease) both;
  transition: border-color 0.15s var(--%NS%ease);
}

.navs[_ngcontent-%COMP%]    > li[_ngcontent-%COMP%]:hover {
  border-color: var(--%NS%border-strong);
}

.head[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
  align-items: center;
  min-width: 0;
  font-variant-numeric: tabular-nums;
}

.head[_ngcontent-%COMP%]   .url[_ngcontent-%COMP%] {
  min-width: 0;
  color: var(--%NS%text-strong);
  font-weight: 500;
}

.id[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-family: var(--%NS%font-mono);
  font-size: 12px;
}

.arrow[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
}

.meta[_ngcontent-%COMP%] {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 6px 8px;
  align-items: center;
  margin-left: auto;
}

.ms[_ngcontent-%COMP%] {
  font-family: var(--%NS%font-mono);
  font-size: 12px;
}

time[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-family: var(--%NS%font-mono);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.bar[_ngcontent-%COMP%] {
  display: flex;
  gap: 2px;
  height: 6px;
  margin: 12px 0 4px;
  overflow: hidden;
  border-radius: 99px;
  background: var(--%NS%surface-3);
}

.bar[_ngcontent-%COMP%]   span[_ngcontent-%COMP%] {
  display: block;
  min-width: 2px;
}

.details[_ngcontent-%COMP%] {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  align-items: baseline;
  gap: 6px 16px;
  margin: 12px 0 0;
  font-size: 12.5px;
  line-height: 1.5;
}

.details[_ngcontent-%COMP%]:empty {
  display: none;
}

.details[_ngcontent-%COMP%]   dt[_ngcontent-%COMP%] {
  letter-spacing: 0.06em;
}

.reason[_ngcontent-%COMP%], 
.bad[_ngcontent-%COMP%] {
  color: var(--%NS%danger);
}

.navs[_ngcontent-%COMP%]    > li.in-loop[_ngcontent-%COMP%] {
  box-shadow: inset 3px 0 0 var(--%NS%danger);
}

.loops[_ngcontent-%COMP%] {
  display: grid;
  gap: 8px;
  padding: 12px 16px;
  border: 1px solid color-mix(in srgb, var(--%NS%danger) 35%, var(--%NS%border));
  border-radius: var(--%NS%radius);
  background: color-mix(in srgb, var(--%NS%danger) 6%, var(--%NS%surface));
  color: var(--%NS%text);
  font-size: 13px;
  line-height: 1.5;
}

.loops[_ngcontent-%COMP%]   h3[_ngcontent-%COMP%] {
  margin: 0;
  color: var(--%NS%text-strong);
  font-size: 13px;
  letter-spacing: normal;
  text-transform: none;
}

.loop[_ngcontent-%COMP%]    + .loop[_ngcontent-%COMP%] {
  padding-top: 8px;
  border-top: 1px solid var(--%NS%border);
}

.chain[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  align-items: center;
  margin: 0;
}

.hops[_ngcontent-%COMP%] {
  margin: 6px 0 0;
  padding-left: 20px;
}

.hops[_ngcontent-%COMP%]   li[_ngcontent-%COMP%]    + li[_ngcontent-%COMP%] {
  margin-top: 2px;
}

.loop-meta[_ngcontent-%COMP%] {
  margin: 6px 0 0;
  font-size: 12px;
}

.actions[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--%NS%border);
}

.replay-note[_ngcontent-%COMP%] {
  align-self: center;
  margin: 0;
  font-size: 12px;
}

@media (max-width: 480px) {
  .details[_ngcontent-%COMP%] {
    grid-template-columns: minmax(0, 1fr);
    gap: 2px;
  }
  .details[_ngcontent-%COMP%]   dd[_ngcontent-%COMP%]    + dt[_ngcontent-%COMP%] {
    margin-top: 6px;
  }
  .export[_ngcontent-%COMP%] {
    margin-left: 0;
  }
}`]})},Ej=()=>[],Dj=(e,t)=>t.node.id;function Oj(e,t){if(e&1&&(J(0,` with `),H(1,`code`),J(2),dv(3,`json`),U()),e&2){let e=K(2);M(2),Y(pv(3,1,e.params))}}function kj(e,t){if(e&1&&(H(0,`span`,16),J(1,`match`),U(),J(2,` Matches `),H(3,`code`,17),J(4),U(),P(5,Oj,4,3)),e&2){let e=K(),t=K();M(4),Y(t.chainText(e)),M(),F(t.hasKeys(e.params)?5:-1)}}function Aj(e,t){if(e&1&&(J(0,` Nearest: `),H(1,`code`),J(2),U()),e&2){let e=K(2);M(2),Y(e.nearest.join(`, `))}}function jj(e,t){if(e&1&&(H(0,`span`,18),J(1,`no match`),U(),J(2,` Matches no route (NG04002). `),P(3,Aj,3,1)),e&2){let e=K();M(3),F(e.nearest.length?3:-1)}}function Mj(e,t){if(e&1&&(H(0,`div`,15),J(1),U()),e&2){let e=t.$implicit;M(),Y(e)}}function Nj(e,t){if(e&1&&(H(0,`div`,7),P(1,kj,6,2)(2,jj,4,1),I(3,Mj,2,1,`div`,15,wg),U()),e&2){let e=t;N(`data-matched`,e.matched),M(),F(e.matched?1:2),M(2),L(e.notes)}}function Pj(e,t){if(e&1&&(H(0,`p`,8),J(1),U()),e&2){let e=K();M(),Y(e.message())}}function Fj(e,t){if(e&1&&(H(0,`p`,9),J(1),U()),e&2){let e=K();M(),Y(e.navigationOff)}}function Ij(e,t){e&1&&J(0),e&2&&X(` `,t,` route(s) left out: the page lists at most 200 routes per level and 1000 in total. `)}function Lj(e,t){if(e&1&&(H(0,`p`,12),J(1),P(2,Ij,1,1),U()),e&2){let e,t=K();M(),Z(` Generation `,t.page().generation,` · `,t.rows().length,` route(s). Lazy routes show their children once loaded. `),M(),F((e=t.page().configTruncated)?2:-1,e)}}function Rj(e,t){if(e&1&&(H(0,`div`,13)(1,`p`,19),J(2),U(),H(3,`p`,15),J(4),U()()),e&2){let e=K();M(2),X(` `,e.page().setup?.mode===`events-only`?`This build has no debug utils, so the live config cannot be read.`:`The page has not reported its route config yet.`,` `),M(2),X(` `,e.page().setup?.mode===`events-only`?`Run the app with the development build to inspect the live config.`:`It appears once the router initializes. Navigate in the app if it stays empty.`,` `)}}function zj(e,t){if(e&1){let e=W();H(0,`div`,13)(1,`p`,19),J(2,`No routes match the filter.`),U(),H(3,`p`,15),J(4,`Try a shorter path or a component name.`),U(),H(5,`button`,20),Qg(`click`,function(){O(e);let t=K(),n=n_(13);return t.filter.set(``),k(n.focus())}),J(6,` Clear filter `),U()()}}function Bj(e,t){e&1&&(H(0,`span`,24),J(1,`active`),U())}function Vj(e,t){if(e&1&&(H(0,`span`,24),J(1),U()),e&2){let e=K().$implicit;M(),X(`lazy `,e.node.lazy)}}function Hj(e,t){if(e&1&&(H(0,`span`,24),J(1),U()),e&2){let e=K().$implicit;M(),X(`outlet `,e.node.outlet)}}function Uj(e,t){if(e&1&&(H(0,`span`,25)(1,`span`,22),J(2,`declared in `),U(),J(3),U()),e&2){let e=K().$implicit;M(3),Y(e.source)}}function Wj(e,t){if(e&1&&(H(0,`span`,26),J(1,`redirect `),H(2,`span`,31),J(3,`→`),U(),H(4,`code`),J(5),U()()),e&2){let e=K().$implicit;M(5),Y(e.node.redirectTo)}}function Gj(e,t){if(e&1&&J(0),e&2){let e=K().$implicit;X(` `,e.node.component??(e.node.lazy===`unloaded`?`lazy, not loaded yet`:e.node.kind),` `)}}function Kj(e,t){if(e&1&&(H(0,`span`,24),J(1),U()),e&2){let e=t.$implicit;M(),Y(e)}}function qj(e,t){if(e&1&&(H(0,`span`,24),J(1),U()),e&2){let e=t.$implicit;M(),X(`resolve `,e)}}function Jj(e,t){e&1&&(H(0,`span`,32),J(1,`–`),U(),H(2,`span`,22),J(3,`none`),U())}function Yj(e,t){if(e&1&&J(0),e&2){let e=K().$implicit;X(` `,e.node.title,` `)}}function Xj(e,t){e&1&&(H(0,`span`,32),J(1,`–`),U(),H(2,`span`,22),J(3,`none`),U())}function Zj(e,t){if(e&1){let e=W();H(0,`input`,34),Qg(`input`,function(t){let n=O(e).$implicit,r=K(2).$implicit;return k(K(2).setParam(r.node.id,n,t.target.value))}),U()}if(e&2){let e=t.$implicit,n=K(2).$implicit,r=K(2);Vg(`placeholder`,e)(`value`,r.paramValues()[n.node.id]?.[e]??``),N(`aria-label`,e+` for `+n.node.fullPath)(`aria-invalid`,r.isInvalid(n.node,e)?`true`:null)(`aria-describedby`,r.isInvalid(n.node,e)?`route-tree-row-result`:null)}}function Qj(e,t){if(e&1){let e=W();I(0,Zj,1,5,`input`,33,wg),H(2,`button`,6),Qg(`click`,function(){O(e);let t=K().$implicit,n=n_(1);return k(K(2).navigate(t.node,n))}),J(3,` Go `),U()}if(e&2){let e=K().$implicit,t=K(2);L(t.params(e.node)),M(2),Vg(`disabled`,!t.navigationAllowed()),N(`aria-describedby`,t.navigationAllowed()?null:`route-tree-writes-off`)(`aria-label`,`Navigate to `+e.node.fullPath)}}function $j(e,t){if(e&1){let e=W();H(0,`button`,20),Qg(`click`,function(){O(e);let t=K().$implicit;return k(K(2).resolveLazy(t.node))}),J(1,` Read lazy `),U()}if(e&2){let e=K().$implicit;N(`aria-label`,`Read lazy routes of `+e.node.fullPath)}}function eM(e,t){if(e&1&&(H(0,`tr`,30)(1,`td`,35)(2,`p`,36),J(3),U()()()),e&2){let e=K(3);M(3),Y(e.rowResult()?.text)}}function tM(e,t){if(e&1&&(H(0,`tr`,null,1)(2,`td`,23),J(3),P(4,Bj,2,0,`span`,24),P(5,Vj,2,1,`span`,24),P(6,Hj,2,1,`span`,24),P(7,Uj,4,1,`span`,25),U(),H(8,`td`),P(9,Wj,6,1,`span`,26)(10,Gj,1,1),U(),H(11,`td`),I(12,Kj,2,1,`span`,24,Cg),I(14,qj,2,1,`span`,24,wg),P(16,Jj,4,0),U(),H(17,`td`),P(18,Yj,1,1)(19,Xj,4,0),U(),H(20,`td`,27)(21,`div`,28),P(22,Qj,4,3),P(23,$j,2,1,`button`,29),U()()(),P(24,eM,4,1,`tr`,30)),e&2){let e=t.$implicit,n=K(2);q(`active`,n.isActive(e.node)),M(2),C_(`padding-left`,14+e.depth*16,`px`),M(),X(` `,e.node.fullPath,` `),M(),F(n.isActive(e.node)?4:-1),M(),F(e.node.lazy?5:-1),M(),F(e.node.outlet?6:-1),M(),F(e.source?7:-1),M(2),F(e.node.redirectTo===void 0?10:9),M(3),L(n.guardList(e.node)),M(2),L(e.node.resolvers??ov(15,Ej)),M(2),F(!n.guardList(e.node).length&&!e.node.resolvers?.length?16:-1),M(2),F(e.node.title?18:19),M(4),F(n.canNavigate(e.node)?22:-1),M(),F(e.node.kind===`lazy`&&e.node.lazy===`unloaded`?23:-1),M(),F(n.rowResult()?.id===e.node.id?24:-1)}}function nM(e,t){if(e&1&&(H(0,`div`,14)(1,`table`)(2,`thead`)(3,`tr`)(4,`th`,21),J(5,`Path`),U(),H(6,`th`,21),J(7,`Target`),U(),H(8,`th`,21),J(9,`Guards and resolvers`),U(),H(10,`th`,21),J(11,`Title`),U(),H(12,`th`,21)(13,`span`,22),J(14,`Actions`),U()()()(),H(15,`tbody`),I(16,tM,25,16,null,null,Dj),U()()()),e&2){let e=K();M(16),L(e.rows())}}var rM=class e{page=$.required();rpc=$(null);navigationAllowed=Q(()=>cE(this.rpc(),`router`));navigationOff=GT(`router`);sources=$([]);filter=j(``);testUrl=j(``);match=j(null);message=j(``);rowResult=j(null);paramValues=j({});checkedRow=j(null);active=Q(()=>new Set(this.page().activeIds??[]));rows=Q(()=>{let e=this.filter().toLowerCase(),t=this.sources(),n=[],r=(i,a)=>{for(let o of i){let i=mk(o,t),s=i&&pk(i);(!e||o.fullPath.toLowerCase().includes(e)||o.component?.toLowerCase().includes(e)||s?.toLowerCase().includes(e))&&n.push({node:o,depth:a,source:s}),o.children&&r(o.children,a+1)}};return r(this.page().config??[],0),n});hasKeys(e){return Object.keys(e).length>0}isActive(e){return this.active().has(e.id)}guardList(e){return Object.entries(e.guards??{}).flatMap(([e,t])=>t.map(t=>`${e} ${t}`))}params(e){return(e.fullPath.match(/:([A-Za-z0-9_]+)/g)??[]).map(e=>e.slice(1))}canNavigate(e){return e.redirectTo===void 0&&!e.matcher&&!e.outlet&&!e.fullPath.includes(`**`)&&(!!e.component||e.kind===`component`||e.kind===`lazy`)}setParam(e,t,n){this.paramValues.update(r=>({...r,[e]:{...r[e],[t]:n}}))}missingParams(e){let t=this.paramValues()[e.id]??{};return this.params(e).filter(e=>!t[e])}isInvalid(e,t){return this.checkedRow()===e.id&&!this.paramValues()[e.id]?.[t]}chainText(e){return e.chain.map(e=>e.fullPath).join(` → `)}async predict(){let e=this.testUrl().trim();if(!e)return;let t=await hk(this.rpc(),`router-match`,{pageId:this.page().pageId,url:e});this.match.set(t),t?this.message()===`Could not reach the page.`&&this.message.set(``):this.message.set(_k)}async probe(){let e=this.testUrl().trim();if(!e)return;this.message.set(`Running the real matcher in the app…`);let t=await vk(this.rpc(),this.page().pageId,{action:`probe`,url:e});if(t.error){this.message.set(String(t.error));return}this.message.set(t.matched?`The app recognized ${e} and its canMatch guards passed. The probe stopped before canActivate guards and resolvers, so those did not run. See the probe entry in Navigations.`:typeof t.redirectedTo==`string`?`A canMatch guard or the navigation error handler redirected ${e} to ${t.redirectedTo}. The probe stopped that navigation before it rendered anything.`:`The app could not recognize ${e}: ${String(t.reason??``)}`)}async navigate(e,t){let n=this.missingParams(e);if(n.length){this.checkedRow.set(e.id),this.rowResult.set({id:e.id,text:`Fill in ${n.map(e=>`:${e}`).join(`, `)} to navigate.`}),Array.from(t?.querySelectorAll(`input.param`)??[]).find(e=>!e.value)?.focus();return}this.checkedRow.set(null),this.rowResult.set({id:e.id,text:`Navigating to ${e.fullPath}…`});let r=await vk(this.rpc(),this.page().pageId,{action:`navigate`,pattern:e.fullPath,params:this.paramValues()[e.id]??{}});this.rowResult.set({id:e.id,text:r.error?String(r.error):`Navigation #${r.id}: ${r.outcome}${r.finalUrl?` at ${r.finalUrl}`:``}.`})}async resolveLazy(e){let t=await vk(this.rpc(),this.page().pageId,{action:`resolve-lazy`,id:e.id});if(t.error){this.rowResult.set({id:e.id,text:String(t.error)});return}let n=t.routes??[];this.rowResult.set({id:e.id,text:`${e.fullPath} declares ${n.length} route(s): ${n.map(e=>`/${e.path}`).join(`, `)}. The router loads them for real on the first navigation that needs them.`})}static ɵfac=function(t){return new(t||e)};static ɵcmp=Bh({type:e,selectors:[[`app-route-tree`]],inputs:{page:[1,`page`],rpc:[1,`rpc`],sources:[1,`sources`]},decls:18,vars:9,consts:[[`filterInput`,``],[`rowEl`,``],[1,`test`,3,`submit`],[`for`,`test-url`],[`id`,`test-url`,`type`,`text`,`placeholder`,`/users/42`,1,`field`,3,`input`,`value`],[`type`,`submit`,1,`small`,`primary`],[`type`,`button`,1,`small`,3,`click`,`disabled`],[`role`,`status`,1,`result`],[`role`,`status`,1,`message`],[`id`,`route-tree-writes-off`,1,`message`],[1,`filter-row`],[`type`,`text`,`aria-label`,`Filter routes`,`placeholder`,`Filter by path, component or file`,1,`field`,`filter`,3,`input`,`value`],[1,`muted`,`summary`],[1,`empty`],[`role`,`region`,`aria-label`,`Live route config`,`tabindex`,`0`,1,`table-scroll`],[1,`muted`],[`data-tone`,`good`,1,`badge`],[1,`chain`],[`data-tone`,`bad`,1,`badge`],[1,`empty-title`],[`type`,`button`,1,`small`,3,`click`],[`scope`,`col`],[1,`visually-hidden`],[1,`path`],[1,`tag`],[1,`src`],[1,`redirect`],[1,`actions`],[1,`actions-inner`],[`type`,`button`,1,`small`],[1,`row-result`],[`aria-hidden`,`true`],[`aria-hidden`,`true`,1,`nil`],[`type`,`text`,1,`field`,`param`,3,`placeholder`,`value`],[`type`,`text`,1,`field`,`param`,3,`input`,`placeholder`,`value`],[`colspan`,`5`],[`id`,`route-tree-row-result`,`role`,`status`]],template:function(e,t){if(e&1){let e=W();H(0,`form`,2),Qg(`submit`,function(n){return O(e),n.preventDefault(),k(t.predict())}),H(1,`label`,3),J(2,`Test a URL`),U(),H(3,`input`,4),Qg(`input`,function(e){return t.testUrl.set(e.target.value)}),U(),H(4,`button`,5),J(5,`Predict`),U(),H(6,`button`,6),Qg(`click`,function(){return t.probe()}),J(7,` Probe in app `),U()(),P(8,Nj,5,2,`div`,7),P(9,Pj,2,1,`p`,8),P(10,Fj,2,1,`p`,9),H(11,`div`,10)(12,`input`,11,0),Qg(`input`,function(e){return t.filter.set(e.target.value)}),U(),P(14,Lj,3,3,`p`,12),U(),P(15,Rj,5,2,`div`,13)(16,zj,7,0,`div`,13)(17,nM,18,0,`div`,14)}if(e&2){let e;M(3),Vg(`value`,t.testUrl()),M(3),Vg(`disabled`,!t.navigationAllowed()),N(`aria-describedby`,t.navigationAllowed()?null:`route-tree-writes-off`),M(2),F((e=t.match())?8:-1,e),M(),F(t.message()?9:-1),M(),F(t.navigationAllowed()?-1:10),M(2),Vg(`value`,t.filter()),M(2),F(t.page().config?14:-1),M(),F(t.page().config?t.rows().length?17:16:15)}},dependencies:[ab],styles:[`.muted[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
  font-size: 13px;
  line-height: 1.5;
}

.nil[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
}

code[_ngcontent-%COMP%] {
  font-family: var(--%NS%font-mono);
  font-size: 12.5px;
  color: var(--%NS%text);
  overflow-wrap: anywhere;
}

.tag[_ngcontent-%COMP%] {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  min-height: 20px;
  margin: 2px 4px 2px 0;
  padding: 0 8px;
  border: 1px solid var(--%NS%border);
  border-radius: 99px;
  background: var(--%NS%surface-2);
  color: var(--%NS%text);
  font-family: var(--%NS%font-mono);
  font-size: 11.5px;
  line-height: 1.4;
  vertical-align: middle;
  overflow-wrap: anywhere;
  white-space: normal;
}

.badge[_ngcontent-%COMP%] {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  padding: 0 8px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: 99px;
  background: var(--%NS%surface-2);
  color: var(--%NS%text);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
  vertical-align: middle;
}

.badge[data-tone=good][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%ok) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%ok) 12%, transparent);
  color: var(--%NS%ok);
}

.badge[data-tone=warn][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%warn) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%warn) 12%, transparent);
  color: var(--%NS%warn);
}

.badge[data-tone=bad][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%danger) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%danger) 12%, transparent);
  color: var(--%NS%danger);
}

button.small[_ngcontent-%COMP%] {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%surface-2);
  color: var(--%NS%text);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.15s var(--%NS%ease), border-color 0.15s var(--%NS%ease), transform 0.1s var(--%NS%ease);
}

button.small[_ngcontent-%COMP%]:hover:not(:disabled) {
  background: var(--%NS%surface-3);
  border-color: color-mix(in srgb, var(--%NS%text-3) 50%, var(--%NS%border-strong));
}

button.small[_ngcontent-%COMP%]:active:not(:disabled) {
  transform: translateY(1px);
}

button.small[_ngcontent-%COMP%]:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

button.small.primary[_ngcontent-%COMP%] {
  border-color: var(--%NS%accent);
  background: var(--%NS%accent);
  color: var(--%NS%accent-ink);
  font-weight: 600;
}

button.small.primary[_ngcontent-%COMP%]:hover:not(:disabled) {
  border-color: var(--%NS%accent-hover);
  background: var(--%NS%accent-hover);
}

button.small[_ngcontent-%COMP%]:focus-visible, 
.table-scroll[_ngcontent-%COMP%]:focus-visible, 
input[type=checkbox][_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: 2px;
}

input.field[_ngcontent-%COMP%], 
select[_ngcontent-%COMP%] {
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  background-color: var(--%NS%bg);
  color: var(--%NS%text);
  font: inherit;
  font-size: 13px;
  transition: border-color 0.15s var(--%NS%ease), box-shadow 0.15s var(--%NS%ease);
}

input.field[_ngcontent-%COMP%] {
  text-overflow: ellipsis;
}

input.field[_ngcontent-%COMP%]::placeholder {
  color: var(--%NS%text-3);
}

input.field[_ngcontent-%COMP%]:hover:not(:focus), 
select[_ngcontent-%COMP%]:hover:not(:focus) {
  border-color: color-mix(in srgb, var(--%NS%text-3) 50%, var(--%NS%border-strong));
}

input.field[_ngcontent-%COMP%]:focus-visible, 
select[_ngcontent-%COMP%]:focus-visible {
  outline: none;
  border-color: var(--%NS%accent);
  box-shadow: 0 0 0 3px var(--%NS%accent-soft);
}

.note[_ngcontent-%COMP%] {
  margin: 0;
  padding: 10px 14px;
  border: 1px solid color-mix(in srgb, var(--%NS%warn) 30%, transparent);
  border-radius: var(--%NS%radius-sm);
  background: color-mix(in srgb, var(--%NS%warn) 10%, transparent);
  color: var(--%NS%text);
  font-size: 13px;
  line-height: 1.5;
}

.empty[_ngcontent-%COMP%] {
  display: grid;
  gap: 6px;
  justify-items: center;
  margin: 0;
  padding: 40px 24px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  text-align: center;
  animation: enter 0.35s var(--%NS%ease) both;
}

.empty[_ngcontent-%COMP%]   p[_ngcontent-%COMP%] {
  margin: 0;
  max-width: 480px;
  line-height: 1.6;
}

.empty-title[_ngcontent-%COMP%] {
  color: var(--%NS%text-strong);
  font-size: 14px;
  font-weight: 600;
}

.empty[_ngcontent-%COMP%]   .small[_ngcontent-%COMP%] {
  margin-top: 8px;
}

.facts[_ngcontent-%COMP%] {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  align-items: baseline;
  gap: 8px 24px;
  margin: 0;
  padding: 14px 16px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  font-size: 13px;
}

.facts[_ngcontent-%COMP%]:empty {
  display: none;
}

dt[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

dd[_ngcontent-%COMP%] {
  min-width: 0;
  margin: 0;
  color: var(--%NS%text);
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}

.table-scroll[_ngcontent-%COMP%] {
  overflow-x: auto;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  box-shadow: var(--%NS%shadow);
  animation: enter 0.35s var(--%NS%ease) both;
}

table[_ngcontent-%COMP%] {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

th[_ngcontent-%COMP%] {
  padding: 10px 14px;
  border-bottom: 1px solid var(--%NS%border);
  background: color-mix(in srgb, var(--%NS%surface-2) 60%, var(--%NS%surface));
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-align: left;
  text-transform: uppercase;
  white-space: nowrap;
}

td[_ngcontent-%COMP%] {
  padding: 10px 14px;
  border-bottom: 1px solid var(--%NS%border);
  color: var(--%NS%text);
  line-height: 1.5;
  vertical-align: top;
  transition: background-color 0.15s var(--%NS%ease);
}

tbody[_ngcontent-%COMP%]   tr[_ngcontent-%COMP%]:last-child   td[_ngcontent-%COMP%] {
  border-bottom: none;
}

tbody[_ngcontent-%COMP%]   tr[_ngcontent-%COMP%]:hover   td[_ngcontent-%COMP%] {
  background: var(--%NS%surface-2);
}

.path[_ngcontent-%COMP%] {
  color: var(--%NS%accent);
  font-family: var(--%NS%font-mono);
  font-size: 12.5px;
  white-space: nowrap;
}

h3[_ngcontent-%COMP%] {
  margin: 8px 0 -4px;
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

@media (max-width: 480px) {
  .facts[_ngcontent-%COMP%] {
    grid-template-columns: minmax(0, 1fr);
    gap: 2px;
  }
  .facts[_ngcontent-%COMP%]   dd[_ngcontent-%COMP%]    + dt[_ngcontent-%COMP%] {
    margin-top: 8px;
  }
}
[_nghost-%COMP%] {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.test[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  box-shadow: var(--%NS%shadow);
  color: var(--%NS%text);
  font-size: 13px;
}

.test[_ngcontent-%COMP%]   label[_ngcontent-%COMP%] {
  margin-right: 4px;
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
}

.test[_ngcontent-%COMP%]   input[_ngcontent-%COMP%] {
  flex: 1 1 200px;
  min-width: 0;
  font-family: var(--%NS%font-mono);
  font-size: 12.5px;
}

.result[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  align-items: center;
  padding: 10px 14px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%surface-2);
  color: var(--%NS%text);
  font-size: 13px;
  line-height: 1.5;
  animation: enter 0.35s var(--%NS%ease) both;
}

.result[data-matched=true][_ngcontent-%COMP%] {
  box-shadow: inset 3px 0 0 var(--%NS%ok);
}

.result[data-matched=false][_ngcontent-%COMP%] {
  box-shadow: inset 3px 0 0 var(--%NS%danger);
}

.result[_ngcontent-%COMP%]   .muted[_ngcontent-%COMP%] {
  flex-basis: 100%;
  font-size: 12px;
}

.chain[_ngcontent-%COMP%] {
  color: var(--%NS%accent);
}

.message[_ngcontent-%COMP%] {
  margin: 0;
  padding: 8px 12px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%surface-2);
  color: var(--%NS%text);
  font-size: 13px;
  overflow-wrap: anywhere;
}

.filter-row[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: center;
}

.filter[_ngcontent-%COMP%] {
  flex: 0 1 320px;
  min-width: 0;
}

.summary[_ngcontent-%COMP%] {
  flex: 1 1 240px;
  margin: 0;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

td[_ngcontent-%COMP%] {
  vertical-align: middle;
}

.redirect[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
}

.src[_ngcontent-%COMP%] {
  display: block;
  margin-top: 2px;
  color: var(--%NS%text-2);
  font-family: var(--%NS%font-mono);
  font-size: 11.5px;
  overflow-wrap: anywhere;
}

tr.active[_ngcontent-%COMP%]   td[_ngcontent-%COMP%] {
  background: var(--%NS%accent-soft);
  color: var(--%NS%text-strong);
}

tr.active[_ngcontent-%COMP%]:hover   td[_ngcontent-%COMP%] {
  background: color-mix(in srgb, var(--%NS%accent) 16%, transparent);
}

tr.active[_ngcontent-%COMP%]   td[_ngcontent-%COMP%]:first-child {
  box-shadow: inset 3px 0 0 var(--%NS%accent);
}

.actions[_ngcontent-%COMP%] {
  width: 1%;
  padding-top: 6px;
  padding-bottom: 6px;
  white-space: nowrap;
}

.actions-inner[_ngcontent-%COMP%] {
  display: flex;
  gap: 6px;
  align-items: center;
  justify-content: flex-end;
}

.param[_ngcontent-%COMP%] {
  width: 96px;
  font-family: var(--%NS%font-mono);
  font-size: 12px;
}

.param[aria-invalid=true][_ngcontent-%COMP%] {
  border-color: var(--%NS%danger);
}

.row-result[_ngcontent-%COMP%]   td[_ngcontent-%COMP%] {
  padding-top: 0;
  background: transparent;
}

.row-result[_ngcontent-%COMP%]   p[_ngcontent-%COMP%] {
  margin: 0;
  color: var(--%NS%text);
  font-size: 13px;
  overflow-wrap: anywhere;
}

@media (max-width: 480px) {
  .filter[_ngcontent-%COMP%] {
    flex-basis: 100%;
  }
}`]})},iM=(e,t)=>t.id;function aM(e,t){if(e&1){let e=W();z(0,`div`,4)(1,`span`,5),J(2,`Page`),B(),z(3,`app-select`,6),G(`valueChange`,function(t){return O(e),k(K(2).pageId.set(t))}),B()()}if(e&2){let e=K(),t=K();M(3),R(`options`,t.pageOptions())(`value`,e.pageId)}}function oM(e,t){e&1&&P(0,aM,4,2,`div`,4),e&2&&F(K().pages().length>1?0:-1)}function sM(e,t){if(e&1){let e=W();z(0,`div`,1)(1,`p`,7),J(2,`Could not load the live router state.`),B(),z(3,`p`,8),J(4,` Check that the dev server with Pangular Inspector is still running, then retry. `),B(),z(5,`button`,9),G(`click`,function(){return O(e),k(K().retry())}),J(6,`Retry`),B()()}}function cM(e,t){e&1&&(z(0,`p`,2),J(1,`Loading the live router state…`),B())}function lM(e,t){if(e&1&&(z(0,`span`,17),J(1),B(),z(2,`span`,18),J(3),B()),e&2){let e=K(3);M(),Y(e.problems()),M(2),X(`, `,e.problems(),` problem navigations`)}}function uM(e,t){if(e&1){let e=W();z(0,`button`,16),G(`click`,function(){let t=O(e).$implicit;return k(K(2).selected.set(t.id))}),J(1),P(2,lM,4,2),B()}if(e&2){let e=t.$implicit,n=K(2);R(`id`,`router-tab-`+e.id),N(`aria-selected`,e.id===n.selected())(`aria-controls`,`router-panel-`+e.id)(`tabindex`,e.id===n.selected()?0:-1),M(),X(` `,e.label,` `),M(),F(e.id===`navigations`&&n.problems()>0?2:-1)}}function dM(e,t){if(e&1&&V(0,`app-route-current`,13),e&2){let e=K(),t=K();R(`page`,e)(`rpc`,t.rpc())}}function fM(e,t){if(e&1&&V(0,`app-route-timeline`,13),e&2){let e=K(),t=K();R(`page`,e)(`rpc`,t.rpc())}}function pM(e,t){if(e&1&&V(0,`app-route-tree`,14),e&2){let e=K(),t=K();R(`page`,e)(`rpc`,t.rpc())(`sources`,t.sources())}}function mM(e,t){e&1&&V(0,`app-route-setup`,15),e&2&&R(`page`,K())}function hM(e,t){if(e&1&&V(0,`app-route-lint`,13),e&2){let e=K(),t=K();R(`page`,e)(`rpc`,t.rpc())}}function gM(e,t){if(e&1){let e=W();z(0,`div`,10),G(`keydown`,function(t){return O(e),k(K().onKey(t))}),I(1,uM,3,6,`button`,11,iM),B(),z(3,`div`,12),P(4,dM,1,2,`app-route-current`,13)(5,fM,1,2,`app-route-timeline`,13)(6,pM,1,3,`app-route-tree`,14)(7,mM,1,1,`app-route-setup`,15)(8,hM,1,2,`app-route-lint`,13),B()}if(e&2){let e,t=K();M(),L(t.tabs),M(2),R(`id`,`router-panel-`+t.selected()),N(`aria-labelledby`,`router-tab-`+t.selected()),M(),F((e=t.selected())===`current`?4:e===`navigations`?5:e===`routes`?6:e===`setup`?7:e===`lint`?8:-1)}}function _M(e,t){e&1&&(z(0,`div`,3)(1,`p`,7),J(2,`No page is reporting router state yet.`),B(),z(3,`p`,8),J(4,` Open the app in a browser. This view updates as soon as a page connects. `),B()())}var vM=[{id:`current`,label:`Current`},{id:`navigations`,label:`Navigations`},{id:`routes`,label:`Routes`},{id:`setup`,label:`Setup`},{id:`lint`,label:`Lint`}],yM=class e{rpc=$(null);sources=$([]);tabs=vM;selected=j(`current`);pages=j([]);hostPageId=$T();loading=j(!0);failed=j(!1);pageId=Tv({source:this.pages,computation:(e,t)=>t?.value&&e.some(e=>e.pageId===t.value)?t.value:this.hostPageId?e.find(e=>e.pageId===this.hostPageId)?.pageId??null:e.find(e=>e.snapshot)?.pageId??e[0]?.pageId??null});unsubscribe=null;destroyRef=E(Cs);page=Q(()=>{let e=this.pages();return e.find(e=>e.pageId===this.pageId())??(this.hostPageId?null:e[0])??null});problems=Q(()=>(this.page()?.navigations??[]).filter(e=>!e.probe&&[`failed`,`cancelled`,`redirected`].includes(e.outcome)).length);constructor(){uc(()=>{let e=this.rpc();e&&this.load(e)}),this.destroyRef.onDestroy(()=>this.unsubscribe?.())}async load(e){this.loading.set(!0),this.failed.set(!1);try{let t=await e.scope(`pangular`).rpc.sharedState(`router`);if(this.destroyRef.destroyed)return;let n=e=>{this.pages.set(e?.pages??[])};n(t.value()),this.unsubscribe?.(),this.unsubscribe=t.on(`updated`,n)}catch{this.failed.set(!0)}finally{this.loading.set(!1)}}retry(){let e=this.rpc();e&&this.load(e)}pageOptions=Q(()=>this.pages().map(e=>({value:e.pageId,label:e.snapshot?.url??e.pageId,hint:e.pageId})));onKey(e){let t=this.tabs.map(e=>e.id),n=t.indexOf(this.selected()),r=n;if(e.key===`ArrowRight`)r=(n+1)%t.length;else if(e.key===`ArrowLeft`)r=(n-1+t.length)%t.length;else if(e.key===`Home`)r=0;else if(e.key===`End`)r=t.length-1;else return;e.preventDefault(),this.selected.set(t[r]);let i=e.currentTarget;queueMicrotask(()=>i.querySelector(`#router-tab-${t[r]}`)?.focus())}static ɵfac=function(t){return new(t||e)};static ɵcmp=Bh({type:e,selectors:[[`app-live-route`]],inputs:{rpc:[1,`rpc`],sources:[1,`sources`]},decls:8,vars:2,consts:[[1,`section-head`],[`role`,`alert`,1,`empty`],[`role`,`status`,1,`muted`,`empty`],[1,`empty`],[1,`page-pick`],[`id`,`live-route-page-label`,1,`page-label`],[`labelledBy`,`live-route-page-label`,3,`valueChange`,`options`,`value`],[1,`empty-title`],[1,`muted`],[`type`,`button`,1,`retry`,3,`click`],[`role`,`tablist`,`aria-label`,`Router views`,1,`tabs`,3,`keydown`],[`type`,`button`,`role`,`tab`,3,`id`],[`role`,`tabpanel`,1,`panel`,3,`id`],[3,`page`,`rpc`],[3,`page`,`rpc`,`sources`],[3,`page`],[`type`,`button`,`role`,`tab`,3,`click`,`id`],[`aria-hidden`,`true`,1,`count`],[1,`visually-hidden`]],template:function(e,t){if(e&1&&(z(0,`div`,0)(1,`h2`),J(2,`Live router`),B(),P(3,oM,1,1),B(),P(4,sM,7,0,`div`,1)(5,cM,2,0,`p`,2)(6,gM,9,3)(7,_M,5,0,`div`,3)),e&2){let e,n;M(3),F((e=t.page())?3:-1,e),M(),F(t.failed()?4:t.loading()?5:(n=t.page())?6:7,n)}},dependencies:[eA,mA,OA,Tj,rM,mD],styles:[`[_nghost-%COMP%] {
  display: grid;
  gap: 16px;
  min-width: 0;
  margin-bottom: 32px;
}

.section-head[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 16px;
  align-items: center;
  justify-content: space-between;
  min-height: 34px;
}

h2[_ngcontent-%COMP%] {
  margin: 0;
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.muted[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
  font-size: 13px;
  line-height: 1.5;
}

.empty[_ngcontent-%COMP%] {
  display: grid;
  gap: 6px;
  justify-items: center;
  margin: 0;
  padding: 40px 24px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  text-align: center;
  animation: enter 0.35s var(--%NS%ease) both;
}

.empty[_ngcontent-%COMP%]   p[_ngcontent-%COMP%] {
  margin: 0;
  max-width: 480px;
}

.empty-title[_ngcontent-%COMP%] {
  color: var(--%NS%text-strong);
  font-size: 14px;
  font-weight: 600;
}

.retry[_ngcontent-%COMP%] {
  height: 34px;
  margin-top: 8px;
  padding: 0 12px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%surface-2);
  color: var(--%NS%text);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s var(--%NS%ease);
}

.retry[_ngcontent-%COMP%]:hover {
  background: var(--%NS%surface-3);
}

.retry[_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: 2px;
}

.page-pick[_ngcontent-%COMP%] {
  display: flex;
  flex: 0 1 420px;
  gap: 10px;
  align-items: center;
  min-width: 0;
}

.page-label[_ngcontent-%COMP%] {
  flex: none;
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.page-pick[_ngcontent-%COMP%]   app-select[_ngcontent-%COMP%] {
  flex: 1 1 auto;
  width: 100%;
}

.tabs[_ngcontent-%COMP%] {
  display: flex;
  justify-self: start;
  max-width: 100%;
  gap: 2px;
  padding: 3px;
  overflow-x: auto;
  border: 1px solid var(--%NS%border);
  border-radius: 10px;
  background: var(--%NS%bg);
}

[role=tab][_ngcontent-%COMP%] {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 12px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--%NS%text-2);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.15s var(--%NS%ease), color 0.15s var(--%NS%ease), box-shadow 0.15s var(--%NS%ease);
}

[role=tab][_ngcontent-%COMP%]:hover {
  background: var(--%NS%surface-2);
  color: var(--%NS%text);
}

[role=tab][aria-selected=true][_ngcontent-%COMP%] {
  background: var(--%NS%surface-3);
  color: var(--%NS%text-strong);
  box-shadow: inset 0 0 0 1px var(--%NS%border-strong);
}

[role=tab][_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: -2px;
}

.panel[_ngcontent-%COMP%] {
  min-width: 0;
  animation: enter 0.35s var(--%NS%ease) both;
}

.count[_ngcontent-%COMP%] {
  min-width: 18px;
  padding: 0 6px;
  border: 1px solid color-mix(in srgb, var(--%NS%danger) 30%, transparent);
  border-radius: 99px;
  background: color-mix(in srgb, var(--%NS%danger) 12%, transparent);
  color: var(--%NS%danger);
  font-size: 11px;
  font-weight: 600;
  line-height: 16px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}`]})};function bM(e,t){e&1&&J(0,` The Routes tab above shows what the router uses. `)}function xM(e,t){if(e&1){let e=W();z(0,`button`,13),G(`click`,function(){O(e);let t=K();return k(t.expanded.set(!t.expanded()))}),J(1),B()}if(e&2){let e=K();N(`aria-expanded`,e.expanded()),M(),X(` `,e.expanded()?`Hide table`:`Show table`,` `)}}function SM(e,t){e&1&&(J(0,` Run `),z(1,`code`),J(2,`pangular build`),B(),J(3,` again to rebuild the report. `))}function CM(e,t){e&1&&J(0,` Check that the dev server is running, then refresh. `)}function wM(e,t){if(e&1&&(z(0,`div`,11)(1,`p`,14),J(2,`Could not scan the route files.`),B(),z(3,`p`,15),P(4,SM,4,0)(5,CM,1,0),B()()),e&2){let e=K();M(4),F(e.staticReport()?4:5)}}function TM(e,t){e&1&&(z(0,`p`,12),J(1,`Scanning routes…`),B())}function EM(e,t){if(e&1){let e=W();z(0,`div`,16)(1,`p`,14),J(2,`No routes match the filter.`),B(),z(3,`p`,15),J(4,`Search by path, component, guard, title or file name.`),B(),z(5,`button`,10),G(`click`,function(){O(e);let t=K(2),n=n_(12);return t.filter.set(``),k(n.focus())}),J(6,` Clear filter `),B()()}}function DM(e,t){e&1&&(z(0,`div`,16)(1,`p`,14),J(2,`No routes found.`),B(),z(3,`p`,15),J(4,` Routes are read from `),z(5,`code`),J(6,`*.routes.ts`),B(),J(7,` and `),z(8,`code`),J(9,`*routing.module.ts`),B(),J(10,` files, the files they lazy load, plus Analog pages. Add one and refresh. `),B()())}function OM(e,t){e&1&&P(0,EM,7,0,`div`,16)(1,DM,11,0,`div`,16),e&2&&F(+!K().routes().length)}function kM(e,t){if(e&1&&(z(0,`span`,21),J(1),B()),e&2){let e=K().$implicit;M(),Y(e.kind)}}function AM(e,t){if(e&1&&(z(0,`span`,22)(1,`span`,25),J(2,`→`),B(),z(3,`span`,26),J(4,`redirects to`),B(),J(5),B()),e&2){let e=K().$implicit;M(5),X(` `,e.redirectTo)}}function jM(e,t){if(e&1&&(z(0,`code`,23),J(1),B()),e&2){let e=K().$implicit;M(),Y(e.component)}}function MM(e,t){e&1&&(z(0,`span`,27),J(1,`–`),B(),z(2,`span`,26),J(3,`none`),B())}function NM(e,t){if(e&1&&(z(0,`span`,21),J(1),B()),e&2){let e=t.$implicit;M(),Y(e)}}function PM(e,t){e&1&&(z(0,`span`,27),J(1,`–`),B(),z(2,`span`,26),J(3,`none`),B())}function FM(e,t){if(e&1&&J(0),e&2){let e=K().$implicit;X(` `,e.title,` `)}}function IM(e,t){e&1&&(z(0,`span`,27),J(1,`–`),B(),z(2,`span`,26),J(3,`none`),B())}function LM(e,t){if(e&1&&(z(0,`tr`)(1,`td`,20),J(2),P(3,kM,2,1,`span`,21),B(),z(4,`td`),P(5,AM,6,1,`span`,22)(6,jM,2,1,`code`,23)(7,MM,4,0),B(),z(8,`td`),I(9,NM,2,1,`span`,21,Cg,!1,PM,4,0),B(),z(12,`td`),P(13,FM,1,1)(14,IM,4,0),B(),z(15,`td`,24),J(16),B()()),e&2){let e=t.$implicit,n=K(2);M(2),X(` `,e.fullPath,` `),M(),F(e.kind===`page`?-1:3),M(2),F(e.redirectTo===void 0?e.component?6:7:5),M(4),L(n.checks(e)),M(4),F(e.title?13:14),M(3),Y(n.location(e))}}function RM(e,t){if(e&1&&(z(0,`p`,17),J(1),B(),z(2,`div`,18)(3,`table`)(4,`thead`)(5,`tr`)(6,`th`,19),J(7,`Path`),B(),z(8,`th`,19),J(9,`Component / Target`),B(),z(10,`th`,19),J(11,`Guards and resolvers`),B(),z(12,`th`,19),J(13,`Title`),B(),z(14,`th`,19),J(15,`Declared in`),B()()(),z(16,`tbody`),I(17,LM,17,6,`tr`,null,Cg),B()()()),e&2){let e=K();M(),Y_(` `,e.filtered().length,` of `,e.routes().length,` route entries, `,e.navigable(),` navigable `),M(16),L(e.filtered())}}var zM=class e{rpc=$(null);staticReport=Q(()=>aE(this.rpc()));routes=j([]);filter=j(``);loading=j(!1);error=j(!1);live=Rv(yM);liveHasConfig=Q(()=>!!this.live()?.page()?.config);expanded=Tv(()=>!this.liveHasConfig());navigable=Q(()=>this.filtered().filter(e=>e.kind===`page`).length);filtered=Q(()=>{let e=this.filter().toLowerCase().trim(),t=this.routes();return e?t.filter(t=>t.fullPath.toLowerCase().includes(e)||t.component&&t.component.toLowerCase().includes(e)||t.redirectTo&&t.redirectTo.toLowerCase().includes(e)||t.title&&t.title.toLowerCase().includes(e)||this.checks(t).some(t=>t.toLowerCase().includes(e))||t.file.toLowerCase().includes(e)):t});constructor(){uc(()=>{this.rpc()&&this.refresh()})}checks(e){return[...Object.entries(e.guards??{}).flatMap(([e,t])=>t.map(t=>`${e} ${t}`)),...(e.resolvers??[]).map(e=>`resolve ${e}`)]}location(e){return pk(e)}onFilterInput(e){let t=e.target;this.filter.set(t?.value??``)}async refresh(){let e=this.rpc();if(e){this.loading.set(!0),this.error.set(!1);try{let t=await e.scope(`pangular`).rpc.call(`get-routes`);this.routes.set(t)}catch{this.error.set(!0)}finally{this.loading.set(!1)}}}static ɵfac=function(t){return new(t||e)};static ɵcmp=Bh({type:e,selectors:[[`app-route-inspector`]],viewQuery:function(e,t){e&1&&e_(t.live,yM,5),e&2&&t_()},inputs:{rpc:[1,`rpc`]},decls:19,vars:9,consts:[[`filterInput`,``],[3,`rpc`,`sources`],[`aria-labelledby`,`config-heading`,1,`config`],[1,`section-head`],[`id`,`config-heading`],[1,`muted`,`hint`],[`type`,`button`,`aria-controls`,`config-body`,1,`small`,`toggle`],[`id`,`config-body`,1,`config-body`,3,`hidden`],[1,`toolbar`],[`type`,`text`,`aria-label`,`Filter source routes`,`placeholder`,`Filter routes…`,1,`field`,3,`input`,`value`],[`type`,`button`,1,`small`,3,`click`],[`role`,`alert`,1,`empty`],[`role`,`status`,1,`muted`,`empty`],[`type`,`button`,`aria-controls`,`config-body`,1,`small`,`toggle`,3,`click`],[1,`empty-title`],[1,`muted`],[1,`empty`],[1,`muted`,`count`],[`role`,`region`,`aria-label`,`Source route config table`,`tabindex`,`0`,1,`table-scroll`],[`scope`,`col`],[1,`path`],[1,`tag`],[1,`redirect`],[1,`component`],[1,`file`],[`aria-hidden`,`true`],[1,`visually-hidden`],[`aria-hidden`,`true`,1,`nil`]],template:function(e,t){e&1&&(V(0,`app-live-route`,1),z(1,`section`,2)(2,`div`,3)(3,`h2`,4),J(4,`Source route config`),B(),z(5,`span`,5),J(6,` Read from your source files. `),P(7,bM,1,0),B(),P(8,xM,2,2,`button`,6),B(),z(9,`div`,7)(10,`div`,8)(11,`input`,9,0),G(`input`,function(e){return t.onFilterInput(e)}),B(),z(13,`button`,10),G(`click`,function(){return t.refresh()}),J(14),B()(),P(15,wM,6,1,`div`,11)(16,TM,2,0,`p`,12)(17,OM,2,1)(18,RM,19,3),B()()),e&2&&(R(`rpc`,t.rpc())(`sources`,t.routes()),M(7),F(t.liveHasConfig()?7:-1),M(),F(t.liveHasConfig()?8:-1),M(),R(`hidden`,!t.expanded()),M(2),R(`value`,t.filter()),M(2),N(`aria-busy`,t.loading()),M(),X(` `,t.loading()?`Scanning…`:`Refresh`,` `),M(),F(t.error()?15:t.loading()&&t.routes().length===0?16:t.filtered().length===0?17:18))},dependencies:[yM],styles:[`.muted[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
  font-size: 13px;
  line-height: 1.5;
}

.nil[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
}

code[_ngcontent-%COMP%] {
  font-family: var(--%NS%font-mono);
  font-size: 12.5px;
  color: var(--%NS%text);
  overflow-wrap: anywhere;
}

.tag[_ngcontent-%COMP%] {
  display: inline-flex;
  align-items: center;
  max-width: 100%;
  min-height: 20px;
  margin: 2px 4px 2px 0;
  padding: 0 8px;
  border: 1px solid var(--%NS%border);
  border-radius: 99px;
  background: var(--%NS%surface-2);
  color: var(--%NS%text);
  font-family: var(--%NS%font-mono);
  font-size: 11.5px;
  line-height: 1.4;
  vertical-align: middle;
  overflow-wrap: anywhere;
  white-space: normal;
}

.badge[_ngcontent-%COMP%] {
  display: inline-flex;
  align-items: center;
  min-height: 20px;
  padding: 0 8px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: 99px;
  background: var(--%NS%surface-2);
  color: var(--%NS%text);
  font-size: 11px;
  font-weight: 600;
  line-height: 1.4;
  white-space: nowrap;
  vertical-align: middle;
}

.badge[data-tone=good][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%ok) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%ok) 12%, transparent);
  color: var(--%NS%ok);
}

.badge[data-tone=warn][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%warn) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%warn) 12%, transparent);
  color: var(--%NS%warn);
}

.badge[data-tone=bad][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%danger) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%danger) 12%, transparent);
  color: var(--%NS%danger);
}

button.small[_ngcontent-%COMP%] {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%surface-2);
  color: var(--%NS%text);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.15s var(--%NS%ease), border-color 0.15s var(--%NS%ease), transform 0.1s var(--%NS%ease);
}

button.small[_ngcontent-%COMP%]:hover:not(:disabled) {
  background: var(--%NS%surface-3);
  border-color: color-mix(in srgb, var(--%NS%text-3) 50%, var(--%NS%border-strong));
}

button.small[_ngcontent-%COMP%]:active:not(:disabled) {
  transform: translateY(1px);
}

button.small[_ngcontent-%COMP%]:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

button.small.primary[_ngcontent-%COMP%] {
  border-color: var(--%NS%accent);
  background: var(--%NS%accent);
  color: var(--%NS%accent-ink);
  font-weight: 600;
}

button.small.primary[_ngcontent-%COMP%]:hover:not(:disabled) {
  border-color: var(--%NS%accent-hover);
  background: var(--%NS%accent-hover);
}

button.small[_ngcontent-%COMP%]:focus-visible, 
.table-scroll[_ngcontent-%COMP%]:focus-visible, 
input[type=checkbox][_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: 2px;
}

input.field[_ngcontent-%COMP%], 
select[_ngcontent-%COMP%] {
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  background-color: var(--%NS%bg);
  color: var(--%NS%text);
  font: inherit;
  font-size: 13px;
  transition: border-color 0.15s var(--%NS%ease), box-shadow 0.15s var(--%NS%ease);
}

input.field[_ngcontent-%COMP%] {
  text-overflow: ellipsis;
}

input.field[_ngcontent-%COMP%]::placeholder {
  color: var(--%NS%text-3);
}

input.field[_ngcontent-%COMP%]:hover:not(:focus), 
select[_ngcontent-%COMP%]:hover:not(:focus) {
  border-color: color-mix(in srgb, var(--%NS%text-3) 50%, var(--%NS%border-strong));
}

input.field[_ngcontent-%COMP%]:focus-visible, 
select[_ngcontent-%COMP%]:focus-visible {
  outline: none;
  border-color: var(--%NS%accent);
  box-shadow: 0 0 0 3px var(--%NS%accent-soft);
}

.note[_ngcontent-%COMP%] {
  margin: 0;
  padding: 10px 14px;
  border: 1px solid color-mix(in srgb, var(--%NS%warn) 30%, transparent);
  border-radius: var(--%NS%radius-sm);
  background: color-mix(in srgb, var(--%NS%warn) 10%, transparent);
  color: var(--%NS%text);
  font-size: 13px;
  line-height: 1.5;
}

.empty[_ngcontent-%COMP%] {
  display: grid;
  gap: 6px;
  justify-items: center;
  margin: 0;
  padding: 40px 24px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  text-align: center;
  animation: enter 0.35s var(--%NS%ease) both;
}

.empty[_ngcontent-%COMP%]   p[_ngcontent-%COMP%] {
  margin: 0;
  max-width: 480px;
  line-height: 1.6;
}

.empty-title[_ngcontent-%COMP%] {
  color: var(--%NS%text-strong);
  font-size: 14px;
  font-weight: 600;
}

.empty[_ngcontent-%COMP%]   .small[_ngcontent-%COMP%] {
  margin-top: 8px;
}

.facts[_ngcontent-%COMP%] {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  align-items: baseline;
  gap: 8px 24px;
  margin: 0;
  padding: 14px 16px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  font-size: 13px;
}

.facts[_ngcontent-%COMP%]:empty {
  display: none;
}

dt[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

dd[_ngcontent-%COMP%] {
  min-width: 0;
  margin: 0;
  color: var(--%NS%text);
  overflow-wrap: anywhere;
  font-variant-numeric: tabular-nums;
}

.table-scroll[_ngcontent-%COMP%] {
  overflow-x: auto;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  box-shadow: var(--%NS%shadow);
  animation: enter 0.35s var(--%NS%ease) both;
}

table[_ngcontent-%COMP%] {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
}

th[_ngcontent-%COMP%] {
  padding: 10px 14px;
  border-bottom: 1px solid var(--%NS%border);
  background: color-mix(in srgb, var(--%NS%surface-2) 60%, var(--%NS%surface));
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-align: left;
  text-transform: uppercase;
  white-space: nowrap;
}

td[_ngcontent-%COMP%] {
  padding: 10px 14px;
  border-bottom: 1px solid var(--%NS%border);
  color: var(--%NS%text);
  line-height: 1.5;
  vertical-align: top;
  transition: background-color 0.15s var(--%NS%ease);
}

tbody[_ngcontent-%COMP%]   tr[_ngcontent-%COMP%]:last-child   td[_ngcontent-%COMP%] {
  border-bottom: none;
}

tbody[_ngcontent-%COMP%]   tr[_ngcontent-%COMP%]:hover   td[_ngcontent-%COMP%] {
  background: var(--%NS%surface-2);
}

.path[_ngcontent-%COMP%] {
  color: var(--%NS%accent);
  font-family: var(--%NS%font-mono);
  font-size: 12.5px;
  white-space: nowrap;
}

h3[_ngcontent-%COMP%] {
  margin: 8px 0 -4px;
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

@media (max-width: 480px) {
  .facts[_ngcontent-%COMP%] {
    grid-template-columns: minmax(0, 1fr);
    gap: 2px;
  }
  .facts[_ngcontent-%COMP%]   dd[_ngcontent-%COMP%]    + dt[_ngcontent-%COMP%] {
    margin-top: 8px;
  }
}
[_nghost-%COMP%] {
  display: block;
  min-width: 0;
}

.config[_ngcontent-%COMP%] {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.section-head[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  align-items: baseline;
}

h2[_ngcontent-%COMP%] {
  margin: 0;
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.hint[_ngcontent-%COMP%], 
.count[_ngcontent-%COMP%] {
  margin: 0;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.count[_ngcontent-%COMP%] {
  margin-bottom: -4px;
  padding: 0 4px;
}

.config-body[_ngcontent-%COMP%] {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.config-body[hidden][_ngcontent-%COMP%] {
  display: none;
}

.toggle[_ngcontent-%COMP%] {
  margin-left: auto;
}

.toolbar[_ngcontent-%COMP%] {
  display: flex;
  gap: 8px;
  align-items: center;
}

.toolbar[_ngcontent-%COMP%]   .field[_ngcontent-%COMP%] {
  flex: 1;
  min-width: 0;
}

.component[_ngcontent-%COMP%] {
  color: var(--%NS%text-strong);
}

.redirect[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
  font-family: var(--%NS%font-mono);
  font-size: 12.5px;
  overflow-wrap: anywhere;
}

.file[_ngcontent-%COMP%] {
  min-width: 160px;
  color: var(--%NS%text-2);
  font-family: var(--%NS%font-mono);
  font-size: 12px;
  overflow-wrap: anywhere;
}`]})},BM=e=>({id:e,label:`Status history`}),VM=e=>({id:e,label:`Value history`}),HM=(e,t)=>t.kind,UM=(e,t)=>t.name+t.file+t.line,WM=(e,t)=>t.epoch,GM=(e,t)=>t.id;function KM(e,t){if(e&1){let e=W();z(0,`div`,3)(1,`span`,11),J(2,`Graph of`),B(),z(3,`app-select`,12),G(`valueChange`,function(t){return O(e),k(K().pickComponent(t))}),B()()}if(e&2){let e=K();M(3),R(`options`,e.componentOptions())(`value`,e.pickerValue())}}function qM(e,t){if(e&1&&(z(0,`span`,15),J(1),B()),e&2){let e=K(2);M(),Y(e.sourceNote(e.graph().source))}}function JM(e,t){if(e&1&&(z(0,`p`,4)(1,`span`,13),J(2),B(),z(3,`span`,14),J(4),B(),P(5,qM,2,1,`span`,15),B()),e&2){let e=t,n=K();M(2),Y(e.name),M(2),Y(e.path),M(),F(n.graph().source?5:-1)}}function YM(e,t){if(e&1&&(z(0,`p`,4)(1,`span`,13),J(2),B(),z(3,`span`,15),J(4,`environment injector`),B()()),e&2){let e=K();M(2),Y(e.injectorLabel(t))}}function XM(e,t){e&1&&(z(0,`p`,5),J(1,` The picked component or injector is gone or has no signal graph, so this shows another one. `),B())}function ZM(e,t){e&1&&J(0,` The effects registered on this injector and the signals they read. A signal that no effect reads is not part of the graph. Pick a kind to filter. `)}function QM(e,t){e&1&&J(0,` The live signal graph of one component. Only signals that its template or an effect has read appear here; a signal nothing has read yet is not part of the graph. Pick a kind to filter. `)}function $M(e,t){e&1&&J(0,` Every signal, computed and effect found in your source. Pick a kind to filter. `)}function eN(e,t){e&1&&(z(0,`p`,5),J(1,` The live signal graph needs Angular 20.1 or later. This list comes from a source scan. `),B())}function tN(e,t){e&1&&(z(0,`p`,5),J(1,` The signal write hook did not load. Value history shows sampled values only, with no exact set entries. `),B())}function nN(e,t){if(e&1&&(z(0,`p`,5),J(1),B()),e&2){let e=K();M(),Z(` Showing `,e.graph().nodes.length,` of `,t,` signals. The rest and their edges are left out. `)}}function rN(e,t){if(e&1){let e=W();z(0,`button`,16),G(`click`,function(){let t=O(e).$implicit,n=K(2);return k(n.kind.set(n.kind()===t.kind?null:t.kind))}),V(1,`span`,19),z(2,`span`,20),J(3),B(),z(4,`span`,17),J(5),B()()}if(e&2){let e=t.$implicit,n=K(2);q(`active`,n.kind()===e.kind),N(`aria-pressed`,n.kind()===e.kind),M(),C_(`background`,n.kindColor(e.kind)),M(2),Y(e.kind),M(2),Y(e.count)}}function iN(e,t){if(e&1){let e=W();z(0,`div`,7)(1,`button`,16),G(`click`,function(){return O(e),k(K().kind.set(null))}),J(2,` All `),z(3,`span`,17),J(4),B()(),I(5,rN,6,7,`button`,18,HM),B()}if(e&2){let e=K();M(),q(`active`,!e.kind()),N(`aria-pressed`,!e.kind()),M(3),Y(e.kindTotal()),M(),L(e.kindCounts())}}function aN(e,t){e&1&&(z(0,`div`,8),V(1,`span`,21),z(2,`p`,22),J(3,`Scanning source for signals…`),B()())}function oN(e,t){e&1&&(z(0,`div`,9)(1,`p`,22),J(2,`No signals found.`),B(),z(3,`p`,23),J(4,` No `),z(5,`code`),J(6,`signal()`),B(),J(7,`, `),z(8,`code`),J(9,`computed()`),B(),J(10,` or `),z(11,`code`),J(12,`effect()`),B(),J(13,` calls were found in your source. To see the live graph, run Angular 20.1 or later with the overlay connected and select a component. `),B()())}function sN(e,t){if(e&1&&(z(0,`span`,33),J(1,`·`),B(),z(2,`span`),J(3),B()),e&2){let e=K().$implicit;M(3),X(`in <`,e.component,`>`)}}function cN(e,t){if(e&1&&(z(0,`div`,26)(1,`div`,28)(2,`span`,29),J(3),B(),z(4,`span`,30),J(5),B()(),z(6,`div`,31)(7,`span`,32),J(8),B(),P(9,sN,4,1),B()()),e&2){let e=t.$implicit,n=K(2);M(2),C_(`background`,n.kindColor(e.kind)),M(),Y(e.kind),M(2),Y(e.name),M(2),R(`title`,e.file+`:`+e.line),M(),Z(``,e.file,`:`,e.line),M(),F(e.component?9:-1)}}function lN(e,t){if(e&1){let e=W();z(0,`div`,27)(1,`p`,22),J(2,`No signals match.`),B(),z(3,`p`,23),J(4,`Try a different name or kind.`),B(),z(5,`button`,34),G(`click`,function(){return O(e),k(K(2).clearFilters())}),J(6,`Clear filters`),B()()}}function uN(e,t){if(e&1&&(z(0,`p`,24),J(1,`Signals from source scan (static analysis):`),B(),z(2,`div`,25),I(3,cN,10,8,`div`,26,UM,!1,lN,7,0,`div`,27),B()),e&2){let e=K();M(3),L(e.filteredSourceSignals())}}function dN(e,t){if(e&1&&(z(0,`span`,40),J(1),B()),e&2){let e=K().$implicit;M(),X(``,e.missed,` earlier not captured`)}}function fN(e,t){if(e&1&&(z(0,`li`)(1,`span`,38)(2,`time`),J(3),dv(4,`date`),B(),z(5,`span`,39),J(6),B(),z(7,`span`),J(8),B(),P(9,dN,2,1,`span`,40),B(),z(10,`pre`),J(11),dv(12,`json`),B()()),e&2){let e=t.$implicit,n=K(3);M(3),Y(mv(4,7,e.at,`HH:mm:ss.SSS`)),M(2),w_(`source-`+e.source),M(),Y(n.sourceLabel(e.source)),M(2),X(`epoch `,e.epoch),M(),F(e.missed?9:-1),M(2),Y(pv(12,10,e.value))}}function pN(e,t){if(e&1&&(z(0,`h4`,35),J(1),B(),z(2,`p`,36),J(3),B(),z(4,`ol`,37),I(5,fN,13,12,`li`,null,WM),B()),e&2){let e=K(),t=e.id,n=e.label,r=K();R(`id`,`history-heading-`+t),M(),Y(n),M(2),Y(r.historySummary(t)),M(),N(`aria-labelledby`,`history-heading-`+t),M(),L(r.selectedHistory())}}function mN(e,t){e&1&&P(0,pN,7,4),e&2&&F(K().selectedHistory().length?0:-1)}function hN(e,t){if(e&1&&(z(0,`span`,49),J(1),B()),e&2){let e=K().$implicit;w_(`tone-`+K(2).statusTone(e.status)),M(),Y(e.status)}}function gN(e,t){if(e&1&&(z(0,`span`,45),J(1),B()),e&2){let e=t;M(),Z(``,e,` `,e===1?`change`:`changes`)}}function _N(e,t){if(e&1&&(z(0,`span`,47),J(1),dv(2,`json`),B()),e&2){let e=K().$implicit;M(),Y(pv(2,1,e.error))}}function vN(e,t){if(e&1&&(z(0,`span`,47),J(1),dv(2,`json`),B()),e&2){let e=K().$implicit;M(),Y(pv(2,1,e.value))}}function yN(e,t){e&1&&(z(0,`p`,23),J(1,` This resource has no name. Pass `),z(2,`code`),J(3,`debugName`),B(),J(4,` to `),z(5,`code`),J(6,`resource()`),B(),J(7,` or `),z(8,`code`),J(9,`httpResource()`),B(),J(10,` to name it here. `),B())}function bN(e,t){if(e&1&&(z(0,`dt`),J(1,`Loading`),B(),z(2,`dd`),J(3),B()),e&2){let e=K(2).$implicit;M(3),Y(e.isLoading?`yes`:`no`)}}function xN(e,t){if(e&1&&(z(0,`dt`),J(1,`HTTP status`),B(),z(2,`dd`),J(3),B()),e&2){let e=K(2).$implicit;M(3),Y(e.statusCode)}}function SN(e,t){if(e&1&&(z(0,`dt`),J(1,`Params`),B(),z(2,`dd`)(3,`pre`,53),J(4),dv(5,`json`),B()()),e&2){let e=K(2).$implicit;M(3),N(`aria-label`,`Params of `+e.name),M(),Y(pv(5,2,e.params))}}function CN(e,t){if(e&1&&(z(0,`dt`),J(1,`Value`),B(),z(2,`dd`)(3,`pre`,53),J(4),dv(5,`json`),B()()),e&2){let e=K(2).$implicit;M(3),N(`aria-label`,`Value of `+e.name),M(),Y(pv(5,2,e.value))}}function wN(e,t){if(e&1&&(z(0,`dt`),J(1,`Error`),B(),z(2,`dd`)(3,`pre`,53),J(4),dv(5,`json`),B()()),e&2){let e=K(2).$implicit;M(3),N(`aria-label`,`Error of `+e.name),M(),Y(pv(5,2,e.error))}}function TN(e,t){if(e&1&&(z(0,`li`)(1,`span`,54),J(2),B(),z(3,`span`,55),J(4),B()()),e&2){let e=t.$implicit,n=K(5);M(),C_(`background`,n.kindColor(e.kind)),M(),Y(e.kind),M(2),Y(e.label??e.id)}}function EN(e,t){if(e&1&&(z(0,`ul`,35),I(1,TN,5,4,`li`,null,GM),B()),e&2){let e=K(2).$implicit,t=K(2);R(`id`,`resource-internals-`+e.id),M(),L(t.internalsOf(e))}}function DN(e,t){if(e&1){let e=W();z(0,`div`,48)(1,`h3`,50),J(2),B(),P(3,yN,11,0,`p`,23),z(4,`dl`)(5,`dt`),J(6,`Status`),B(),z(7,`dd`),J(8),B(),P(9,bN,4,1),P(10,xN,4,1),P(11,SN,6,4),P(12,CN,6,4),P(13,wN,6,4),B(),zg(14,51),z(15,`button`,52),G(`click`,function(){O(e);let t=K(3);return k(t.showInternals.set(!t.showInternals()))}),J(16),B(),P(17,EN,3,1,`ul`,35),B()}if(e&2){let e=K().$implicit,t=K(2),n=n_(18);R(`id`,`signal-detail-`+e.id),M(2),Y(e.name),M(),F(e.named?-1:3),M(5),Y(e.status??`unknown`),M(),F(e.isLoading===void 0?-1:9),M(),F(e.statusCode===void 0?-1:10),M(),F(e.params===void 0?-1:11),M(),F(e.value===void 0?-1:12),M(),F(e.error===void 0?-1:13),M(),R(`ngTemplateOutlet`,n)(`ngTemplateOutletContext`,sv(16,BM,e.id)),M(),N(`aria-expanded`,t.showInternals())(`aria-controls`,`resource-internals-`+e.id),M(),Z(` `,t.showInternals()?`Hide`:`Show`,` internal signals (`,e.nodeIds.length,`) `),M(),F(t.showInternals()?17:-1)}}function ON(e,t){if(e&1){let e=W();z(0,`li`)(1,`button`,43),G(`click`,function(){let t=O(e).$implicit;return k(K(2).select(t.id))}),z(2,`span`,28)(3,`span`,29),J(4,`resource`),B(),z(5,`span`,30),J(6),B(),P(7,hN,2,3,`span`,44),P(8,gN,2,2,`span`,45),V(9,`span`,46),B(),P(10,_N,3,3,`span`,47)(11,vN,3,3,`span`,47),B(),P(12,DN,18,18,`div`,48),B()}if(e&2){let e,n=t.$implicit,r=K(2);M(),q(`selected`,r.selectedId()===n.id),N(`aria-expanded`,r.selectedId()===n.id)(`aria-controls`,`signal-detail-`+n.id)(`data-card`,n.id),M(2),C_(`background`,r.kindColor(`resource`)),M(3),Y(n.name),M(),F(n.status?7:-1),M(),F((e=n.changes)?8:-1,e),M(2),F(n.error===void 0?n.value===void 0?-1:11:10),M(2),F(r.selectedId()===n.id?12:-1)}}function kN(e,t){if(e&1&&(z(0,`h2`,41),J(1,`Resources`),B(),z(2,`ul`,42),I(3,ON,13,12,`li`,null,GM),B()),e&2){let e=K();M(3),L(e.filteredResources())}}function AN(e,t){if(e&1&&(z(0,`span`,45),J(1),B()),e&2){let e=t;M(),Z(``,e,` `,e===1?`change`:`changes`)}}function jN(e,t){if(e&1&&(z(0,`span`,47),J(1),dv(2,`json`),B()),e&2){let e=K().$implicit;M(),Y(pv(2,1,e.value))}}function MN(e,t){if(e&1&&(z(0,`span`,33),J(1,`·`),B(),z(2,`span`),J(3),B()),e&2){let e=K().$implicit,t=K(2);M(3),X(`Deps: `,t.getDependencies(e).length)}}function NN(e,t){if(e&1&&(z(0,`span`,33),J(1,`·`),B(),z(2,`span`),J(3),B()),e&2){let e=K().$implicit,t=K(2);M(3),X(`Consumers: `,t.getConsumers(e).length)}}function PN(e,t){if(e&1&&(z(0,`dt`),J(1,`Value`),B(),z(2,`dd`)(3,`pre`,53),J(4),dv(5,`json`),B()()),e&2){let e=K(4);M(3),N(`aria-label`,`Value of `+(e.selectedNode().label??`signal`)),M(),Y(pv(5,2,e.selectedNode().value))}}function FN(e,t){if(e&1){let e=W();z(0,`li`)(1,`button`,58),G(`click`,function(){let t=O(e).$implicit;return k(K(5).jumpTo(t))}),z(2,`span`,54),J(3),B(),z(4,`span`,55),J(5),B()()()}if(e&2){let e=t.$implicit,n=K(5);M(),N(`aria-label`,`Go to `+e.kind+` `+(e.label??e.id)),M(),C_(`background`,n.kindColor(e.kind)),M(),Y(e.kind),M(2),Y(e.label??e.id)}}function IN(e,t){if(e&1&&(z(0,`h4`),J(1,`Dependencies (producers)`),B(),z(2,`ul`),I(3,FN,6,5,`li`,null,GM),B()),e&2){let e=K(4);M(3),L(e.getDependencies(e.selectedNode()))}}function LN(e,t){if(e&1){let e=W();z(0,`li`)(1,`button`,58),G(`click`,function(){let t=O(e).$implicit;return k(K(5).jumpTo(t))}),z(2,`span`,54),J(3),B(),z(4,`span`,55),J(5),B()()()}if(e&2){let e=t.$implicit,n=K(5);M(),N(`aria-label`,`Go to `+e.kind+` `+(e.label??e.id)),M(),C_(`background`,n.kindColor(e.kind)),M(),Y(e.kind),M(2),Y(e.label??e.id)}}function RN(e,t){if(e&1&&(z(0,`h4`),J(1,`Consumers`),B(),z(2,`ul`),I(3,LN,6,5,`li`,null,GM),B()),e&2){let e=K(4);M(3),L(e.getConsumers(e.selectedNode()))}}function zN(e,t){if(e&1&&(z(0,`div`,48)(1,`h3`,50),J(2),B(),z(3,`dl`)(4,`dt`),J(5,`Kind`),B(),z(6,`dd`),J(7),B(),z(8,`dt`),J(9,`Epoch`),B(),z(10,`dd`),J(11),B(),P(12,PN,6,4),B(),P(13,IN,5,0),P(14,RN,5,0),zg(15,51),B()),e&2){let e=K().$implicit,t=K(2),n=n_(18);R(`id`,`signal-detail-`+e.id),M(2),Y(t.selectedNode().label??t.selectedNode().id),M(5),Y(t.selectedNode().kind),M(4),Y(t.selectedNode().epoch),M(),F(t.selectedNode().value===void 0?-1:12),M(),F(t.getDependencies(t.selectedNode()).length?13:-1),M(),F(t.getConsumers(t.selectedNode()).length?14:-1),M(),R(`ngTemplateOutlet`,n)(`ngTemplateOutletContext`,sv(9,VM,e.id))}}function BN(e,t){if(e&1){let e=W();z(0,`li`)(1,`button`,43),G(`click`,function(){let t=O(e).$implicit;return k(K(2).select(t.id))}),z(2,`span`,28)(3,`span`,29),J(4),B(),z(5,`span`,30),J(6),B(),P(7,AN,2,2,`span`,45),V(8,`span`,46),B(),P(9,jN,3,3,`span`,47),z(10,`span`,31)(11,`span`),J(12),B(),P(13,MN,4,1),P(14,NN,4,1),B()(),P(15,zN,16,11,`div`,48),B()}if(e&2){let e,n=t.$implicit,r=K(2);M(),q(`selected`,r.selectedId()===n.id),N(`aria-expanded`,r.selectedId()===n.id)(`aria-controls`,`signal-detail-`+n.id)(`data-card`,n.id),M(2),C_(`background`,r.kindColor(n.kind)),M(),Y(n.kind),M(2),Y(n.label??`(unnamed)`),M(),F((e=r.changeCount(n.id))?7:-1,e),M(2),F(n.value===void 0?-1:9),M(3),X(`Epoch: `,n.epoch),M(),F(r.getDependencies(n).length?13:-1),M(),F(r.getConsumers(n).length?14:-1),M(),F(r.selectedId()===n.id&&r.selectedNode()?15:-1)}}function VN(e,t){if(e&1){let e=W();z(0,`button`,34),G(`click`,function(){return O(e),k(K(3).clearFilters())}),J(1,`Clear filters`),B()}}function HN(e,t){if(e&1&&(z(0,`li`,57)(1,`p`,22),J(2),B(),z(3,`p`,23),J(4),B(),P(5,VN,2,0,`button`,59),B()),e&2){let e=K(2);M(2),X(` `,e.hasAnySignals()?`No signals match.`:`No signals in this graph.`,` `),M(2),X(` `,e.hasAnySignals()?`Try a different name or kind.`:`Select a component that reads signals, or interact with the page to create some.`,` `),M(),F(e.hasAnySignals()?5:-1)}}function UN(e,t){if(e&1&&(z(0,`h2`,41),J(1,`Signals`),B(),z(2,`ul`,56),I(3,BN,16,15,`li`,null,GM,!1,HN,6,3,`li`,57),B()),e&2){let e=K();M(3),L(e.filteredNodes())}}var WN=`follow`,GN=`env:`,KN=50,qN={selected:`picked`,routed:`rendered by the router`,root:`first component with signals`},JN={write:`set`,sample:`sampled`,initial:`initial`},YN={resolved:`ok`,local:`ok`,loading:`warn`,reloading:`warn`,error:`danger`},XN={signal:`#facc15`,computed:`#60a5fa`,linkedSignal:`#34d399`,effect:`#fb923c`,template:`#94a3b8`,afterRenderEffectPhase:`#f472b6`,childSignalProp:`#fef08a`,"input (signal)":`#f59e0b`,"input.required (signal)":`#f59e0b`,"output (signal)":`#ec4899`,"model (signal)":`#14b8a6`,"model.required (signal)":`#14b8a6`,"viewChild (signal)":`#a3e635`,"viewChild.required (signal)":`#a3e635`,"viewChildren (signal)":`#a3e635`,"contentChild (signal)":`#fda4af`,"contentChild.required (signal)":`#fda4af`,"contentChildren (signal)":`#fda4af`,resource:`#06b6d4`,unknown:`#a1a1aa`},ZN=class e{rpc=$(null);destroyRef=E(Cs);host=E(Ml);injector=E(xs);pageId=$T();cleanups=[];treePages=j({});picked=j(null);graph=j(null);unsupported=j(!1);showInternals=j(!1);sourceSignals=j([]);sourceLoaded=j(!1);filter=j(``);kind=j(null);resources=Q(()=>this.graph()?.resources??[]);internalIds=Q(()=>new Set(this.resources().flatMap(e=>e.nodeIds)));visibleNodes=Q(()=>{let e=this.internalIds();return(this.graph()?.nodes??[]).filter(t=>!e.has(t.id))});hasAnySignals=Q(()=>this.visibleNodes().length+this.resources().length>0);kindCounts=Q(()=>{let e=this.graph()?[...this.visibleNodes().map(e=>e.kind),...this.resources().map(()=>`resource`)]:this.sourceSignals().map(e=>e.kind),t=new Map;for(let n of e)t.set(n,(t.get(n)??0)+1);return[...t].map(([e,t])=>({kind:e,count:t}))});kindTotal=Q(()=>this.kindCounts().reduce((e,t)=>e+t.count,0));selectedId=j(null);selectedNode=Q(()=>this.graph()?.nodes.find(e=>e.id===this.selectedId())??null);jumpedPast=j(null);jumpNote=Q(()=>{let e=this.jumpedPast();return!e||this.filter()||this.kind()||this.selectedId()!==e.id?``:`Cleared the filters to show ${e.label}.`});selectedHistory=Q(()=>{let e=this.selectedId();return e?[...this.graph()?.history?.[e]??[]].reverse():[]});kindLegend=Object.entries(XN).map(([e,t])=>({kind:e,color:t}));filteredResources=Q(()=>{let e=this.filter().toLowerCase(),t=this.kind();return t&&t!==`resource`?[]:this.resources().filter(t=>!e||t.name.toLowerCase().includes(e)||`resource`.includes(e))});filteredNodes=Q(()=>{let e=this.filter().toLowerCase(),t=this.kind();return this.visibleNodes().filter(n=>(!t||n.kind===t)&&(!e||(n.label??``).toLowerCase().includes(e)||n.kind.toLowerCase().includes(e))).sort((e,t)=>e.id.localeCompare(t.id,void 0,{numeric:!0}))});filteredSourceSignals=Q(()=>{let e=this.filter().toLowerCase(),t=this.kind();return this.sourceSignals().filter(n=>(!t||n.kind===t)&&(!e||n.name.toLowerCase().includes(e)||n.kind.toLowerCase().includes(e)||n.file.toLowerCase().includes(e)))});targetPageId=Q(()=>this.pageId??this.graph()?.pageId??this.latestTreePage()?.pageId??null);latestTreePage=Q(()=>{let e=null;for(let[t,n]of Object.entries(this.treePages())){let r=n.reportedAt??0;(!e||r>e.reportedAt)&&(e={pageId:t,reportedAt:r})}return e});componentOptions=Q(()=>{let e=this.targetPageId(),t=(e?this.treePages()[e]?.roots:void 0)??[],n=[],r=e=>{for(let t of e)n.push(t),r(t.children)};r(t);let i=this.graph()?.environments??[];if(!n.length&&!i.length)return[];let a=new Map;for(let e of n)a.set(e.name,(a.get(e.name)??0)+1);let o=new Map,s=[{value:WN,label:`Follow the routed component`,hint:`automatic`},...i.map(e=>({value:GN+e.id,label:this.injectorLabel(e),hint:`injector`}))];for(let e of n){let t=(o.get(e.name)??0)+1;o.set(e.name,t),s.push({value:e.id,label:(a.get(e.name)??0)>1?`${e.name} #${t}`:e.name,hint:`<${e.tag}>`})}return s});pickerValue=Q(()=>{let e=this.picked();return e&&this.componentOptions().some(t=>t.value===e)?e:WN});constructor(){uc(()=>{let e=this.rpc();e&&(this.loadSignalGraph(e),this.loadSourceSignals(e))}),this.destroyRef.onDestroy(()=>{for(let e of this.cleanups.splice(0))e()})}async loadSignalGraph(e){for(let e of this.cleanups.splice(0))e();let t=e.scope(`pangular`);try{let e=await t.rpc.sharedState(`signal-graph`);if(this.destroyRef.destroyed)return;let n=e=>{let t=e,n=this.reportedGraph(t);this.unsupported.set(!!n?.unsupported);let r=n?.unsupported?null:n,i=e=>e?.component?.id??e?.injector?.id;i(r)!==i(this.graph())&&this.selectedId.set(null),this.graph.set(r)};n(e.value()),this.cleanups.push(e.on(`updated`,n))}catch{this.graph.set(null)}try{let e=await t.rpc.sharedState(`component-tree`);if(this.destroyRef.destroyed)return;let n=e=>{let t=e?.pages;this.treePages.set(t&&typeof t==`object`?t:{})};n(e.value()),this.cleanups.push(e.on(`updated`,n))}catch{this.treePages.set({})}}lockedPage=null;reportedGraph(e){if(this.pageId)return e?.pages?.[this.pageId]??null;let t=this.lockedPage?e?.pages?.[this.lockedPage]:void 0;if(t)return t;let n=e?.graph??null;return this.lockedPage=n?.pageId??null,n}pickComponent(e){let t=e&&e!==WN?e:null;this.picked.set(t);let n=this.rpc();if(!n)return;let r=this.targetPageId()??void 0,i=t?.startsWith(GN)?{pageId:r,env:t.slice(4)}:{pageId:r,id:t};n.scope(`pangular`).rpc.call(`select-signal-target`,i).catch(()=>{})}injectorLabel(e){return e.name===`Root`?`Root services`:e.name}sourceNote(e){return qN[e]}async loadSourceSignals(e){let t=e.scope(`pangular`);try{let e=await t.rpc.call(`get-signals`);this.sourceSignals.set(e)}catch{}finally{this.sourceLoaded.set(!0)}}clearFilters(){this.filter.set(``),this.kind.set(null)}select(e){this.selectedId.set(this.selectedId()===e?null:e),this.showInternals.set(!1)}jumpTo(e){let t=this.resources().find(t=>t.nodeIds.includes(e.id)),n=t?.id??e.id,r=t?!this.filteredResources().some(e=>e.id===n):!this.filteredNodes().some(e=>e.id===n);r&&this.clearFilters(),this.jumpedPast.set(r?{id:n,label:t?.name??e.label??e.id}:null),this.selectedId.set(n),this.showInternals.set(!!t),Id(()=>{let e=[...this.host.nativeElement.querySelectorAll(`.node-card[data-card]`)].find(e=>e.dataset.card===n);e?.scrollIntoView?.({block:`nearest`}),e?.focus({preventScroll:!0})},{injector:this.injector})}changeCount(e){let t=this.graph(),n=t?.nodes.find(t=>t.id===e)?.changes??t?.resources?.find(t=>t.id===e)?.changes;return n===void 0?(t?.history?.[e]??[]).reduce((e,t)=>e+(t.source===`initial`?0:1+(t.missed??0)),0):n}historySummary(e){let t=this.changeCount(e),n=this.graph()?.history?.[e]?.length??0;return t?`${`${t} ${t===1?`change`:`changes`} recorded`}${n>=KN&&t>=n?`, showing the last ${n}`:``}, newest first.`:`No changes recorded yet. The entry below is the value seen first.`}statusTone(e){return YN[e]??`neutral`}internalsOf(e){let t=new Set(e.nodeIds);return(this.graph()?.nodes??[]).filter(e=>t.has(e.id))}sourceLabel(e){return JN[e]}kindColor(e){return XN[e]??XN.unknown}getDependencies(e){let t=this.graph();if(!t)return[];let n=t.nodes.findIndex(t=>t.id===e.id);return t.edges.filter(e=>e.consumer===n).map(e=>t.nodes[e.producer]).filter(Boolean)}getConsumers(e){let t=this.graph();if(!t)return[];let n=t.nodes.findIndex(t=>t.id===e.id);return t.edges.filter(e=>e.producer===n).map(e=>t.nodes[e.consumer]).filter(Boolean)}static ɵfac=function(t){return new(t||e)};static ɵcmp=Bh({type:e,selectors:[[`app-signal-inspector`]],inputs:{rpc:[1,`rpc`]},decls:23,vars:15,consts:[[`historyTpl`,``],[1,`toolbar`],[`type`,`text`,`placeholder`,`Filter by name or kind…`,`aria-label`,`Filter signals by name or kind`,3,`input`,`value`],[1,`picker`],[1,`showing`],[`role`,`status`,1,`fallback`],[1,`intro`],[`role`,`group`,`aria-label`,`Filter by kind`,1,`kinds`],[`role`,`status`,1,`empty`],[1,`empty`],[`role`,`status`,1,`jump-note`],[`id`,`signals-component-label`,1,`label-key`],[`labelledBy`,`signals-component-label`,3,`valueChange`,`options`,`value`],[1,`showing-name`],[1,`mono`],[1,`source-note`],[`type`,`button`,1,`kind-chip`,3,`click`],[1,`count`],[`type`,`button`,1,`kind-chip`,3,`active`],[`aria-hidden`,`true`,1,`dot`],[1,`chip-text`],[`aria-hidden`,`true`,1,`spinner`],[1,`empty-title`],[1,`hint`],[1,`source-label`],[1,`nodes`],[1,`node-card`],[`role`,`status`,1,`empty`,`compact`],[1,`node-header`],[1,`kind-badge`],[1,`node-label`],[1,`node-meta`],[1,`file`,3,`title`],[`aria-hidden`,`true`,1,`sep`],[`type`,`button`,1,`reset`,3,`click`],[3,`id`],[1,`history-summary`],[`tabindex`,`0`,1,`history`,`scroll-box`],[1,`history-meta`],[1,`source-tag`],[1,`missed`],[1,`list-heading`],[`role`,`list`,1,`nodes`,`resources`],[`type`,`button`,1,`node-card`,3,`click`],[1,`status-tag`,3,`class`],[1,`changed-badge`],[`aria-hidden`,`true`,1,`chevron`],[1,`node-value`],[1,`detail-panel`,3,`id`],[1,`status-tag`],[1,`detail-title`],[3,`ngTemplateOutlet`,`ngTemplateOutletContext`],[`type`,`button`,1,`reset`,`internals-toggle`,3,`click`],[`role`,`region`,`tabindex`,`0`,1,`scroll-box`],[1,`kind-badge`,`sm`],[1,`rel-label`],[`role`,`list`,1,`nodes`],[1,`empty`,`compact`],[`type`,`button`,1,`rel-link`,3,`click`],[`type`,`button`,1,`reset`]],template:function(e,t){if(e&1&&(z(0,`div`,1)(1,`input`,2),G(`input`,function(e){return t.filter.set(e.target.value)}),B(),P(2,KM,4,2,`div`,3),B(),P(3,JM,6,3,`p`,4)(4,YM,5,1,`p`,4),P(5,XM,2,0,`p`,5),z(6,`p`,6),P(7,ZM,1,0)(8,QM,1,0)(9,$M,1,0),B(),P(10,eN,2,0,`p`,5),P(11,tN,2,0,`p`,5),P(12,nN,2,2,`p`,5),P(13,iN,7,4,`div`,7),P(14,aN,4,0,`div`,8),P(15,oN,14,0,`div`,9),P(16,uN,6,1),tg(17,mN,1,1,`ng-template`,null,0,gv),z(19,`p`,10),J(20),B(),P(21,kN,5,0),P(22,UN,6,1)),e&2){let e,n;M(),R(`value`,t.filter()),M(),F(t.componentOptions().length?2:-1),M(),F((e=t.graph()?.component)?3:(e=t.graph()?.injector)?4:-1,e),M(2),F(t.graph()&&t.picked()&&t.graph().source!==`selected`?5:-1),M(2),F(t.graph()?.injector?7:t.graph()?8:9),M(3),F(t.unsupported()?10:-1),M(),F(t.graph()?.writeHook===!1?11:-1),M(),F((n=t.graph()?.nodeCount)?12:-1,n),M(),F(t.kindCounts().length?13:-1),M(),F(!t.graph()&&!t.sourceLoaded()?14:-1),M(),F(!t.graph()&&t.sourceLoaded()&&t.sourceSignals().length===0?15:-1),M(),F(!t.graph()&&t.sourceSignals().length>0?16:-1),M(4),Y(t.jumpNote()),M(),F(t.graph()&&t.filteredResources().length?21:-1),M(),F(t.graph()&&(t.visibleNodes().length||!t.filteredResources().length)?22:-1)}},dependencies:[$y,mD,ib,ab],styles:[`[_nghost-%COMP%] {
  display: block;
  min-width: 0;
  color: var(--%NS%text);
  font-size: 13px;
}

.toolbar[_ngcontent-%COMP%] {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
  margin: 0 0 16px;
  padding: 10px 12px;
  background: color-mix(in srgb, var(--%NS%surface) 85%, transparent);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
}

input[_ngcontent-%COMP%] {
  flex: 1 1 200px;
  min-width: 0;
  height: 34px;
  padding: 0 12px;
  background: var(--%NS%bg);
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  color: var(--%NS%text);
  font: inherit;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s var(--%NS%ease), box-shadow 0.15s var(--%NS%ease);
}

input[_ngcontent-%COMP%]::placeholder {
  color: var(--%NS%text-3);
}

input[_ngcontent-%COMP%]:hover {
  border-color: color-mix(in srgb, var(--%NS%text-3) 60%, var(--%NS%border-strong));
}

input[_ngcontent-%COMP%]:focus-visible {
  outline: none;
  border-color: var(--%NS%accent);
  box-shadow: 0 0 0 3px var(--%NS%accent-soft);
}

.empty[_ngcontent-%COMP%] {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
  padding: 40px 24px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  animation: enter 0.35s var(--%NS%ease) both;
}

.empty.compact[_ngcontent-%COMP%] {
  padding: 24px 16px;
  border-style: dashed;
  background: transparent;
}

.empty-title[_ngcontent-%COMP%] {
  margin: 0;
  color: var(--%NS%text-strong);
  font-size: 14px;
  font-weight: 600;
}

.hint[_ngcontent-%COMP%] {
  max-width: 460px;
  margin: 0;
  color: var(--%NS%text-2);
  font-size: 13px;
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.hint[_ngcontent-%COMP%]   code[_ngcontent-%COMP%] {
  padding: 1px 5px;
  font-family: var(--%NS%font-mono);
  font-size: 12px;
  color: var(--%NS%text);
  background: var(--%NS%surface-3);
  border: 1px solid var(--%NS%border);
  border-radius: 5px;
}

.reset[_ngcontent-%COMP%] {
  height: 34px;
  margin-top: 4px;
  padding: 0 14px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%surface-2);
  color: var(--%NS%text);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s var(--%NS%ease), border-color 0.15s var(--%NS%ease);
}

.reset[_ngcontent-%COMP%]:hover {
  background: var(--%NS%surface-3);
}

.reset[_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: 2px;
}

.spinner[_ngcontent-%COMP%] {
  width: 18px;
  height: 18px;
  border: 2px solid var(--%NS%border-strong);
  border-top-color: var(--%NS%accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .spinner[_ngcontent-%COMP%] {
    animation: none;
    border-top-color: var(--%NS%border-strong);
  }
}
.intro[_ngcontent-%COMP%] {
  margin: 0 0 12px;
  color: var(--%NS%text-2);
  font-size: 13px;
  line-height: 1.5;
}

.kinds[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-bottom: 16px;
}

.kind-chip[_ngcontent-%COMP%] {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--%NS%border);
  border-radius: 99px;
  background: var(--%NS%surface-2);
  color: var(--%NS%text-2);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s var(--%NS%ease), border-color 0.15s var(--%NS%ease), color 0.15s var(--%NS%ease);
}

.kind-chip[_ngcontent-%COMP%]:hover {
  border-color: var(--%NS%border-strong);
  background: var(--%NS%surface-3);
  color: var(--%NS%text);
}

.kind-chip[_ngcontent-%COMP%]:active {
  transform: translateY(0.5px);
}

.kind-chip.active[_ngcontent-%COMP%] {
  border-color: var(--%NS%accent-line);
  background: var(--%NS%accent-soft);
  color: var(--%NS%text-strong);
}

.kind-chip[_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: 2px;
}

.chip-text[_ngcontent-%COMP%] {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kind-chip[_ngcontent-%COMP%]   .count[_ngcontent-%COMP%] {
  flex: none;
  min-width: 18px;
  padding: 0 5px;
  border-radius: 99px;
  background: var(--%NS%surface-3);
  color: var(--%NS%text-2);
  font-size: 11px;
  line-height: 16px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.kind-chip.active[_ngcontent-%COMP%]   .count[_ngcontent-%COMP%] {
  background: color-mix(in srgb, var(--%NS%accent) 22%, transparent);
  color: var(--%NS%text-strong);
}

.dot[_ngcontent-%COMP%] {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.node-header[_ngcontent-%COMP%] {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px 8px;
  min-width: 0;
}

.kind-badge[_ngcontent-%COMP%] {
  flex: none;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10.5px;
  line-height: 18px;
  padding: 0 8px;
  border-radius: 99px;
  color: #0b0b0e;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.node-label[_ngcontent-%COMP%] {
  min-width: 0;
  font-family: var(--%NS%font-mono);
  font-size: 13px;
  font-weight: 500;
  color: var(--%NS%text-strong);
  overflow-wrap: anywhere;
}

.node-meta[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 6px;
  min-width: 0;
  margin-top: 6px;
  font-size: 12px;
  color: var(--%NS%text-3);
  font-variant-numeric: tabular-nums;
}

.node-meta[_ngcontent-%COMP%]   .file[_ngcontent-%COMP%] {
  min-width: 0;
  font-family: var(--%NS%font-mono);
  font-size: 11.5px;
  overflow-wrap: anywhere;
}

.sep[_ngcontent-%COMP%] {
  color: var(--%NS%border-strong);
}

dl[_ngcontent-%COMP%] {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 8px 16px;
  margin: 0;
  font-size: 13px;
}

dt[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding-top: 2px;
}

dd[_ngcontent-%COMP%] {
  min-width: 0;
  margin: 0;
  color: var(--%NS%text);
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

pre[_ngcontent-%COMP%] {
  font-family: var(--%NS%font-mono);
  font-size: 12.5px;
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  margin: 0;
  color: var(--%NS%text);
}

.nodes[_ngcontent-%COMP%] {
  display: flex;
  flex-direction: column;
  gap: 8px;
  list-style: none;
  padding: 0;
  margin: 0;
  animation: enter 0.35s var(--%NS%ease) both;
}

.node-card[_ngcontent-%COMP%] {
  display: block;
  width: 100%;
  min-width: 0;
  text-align: left;
  font: inherit;
  color: inherit;
  background: var(--%NS%surface);
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius-sm);
  padding: 12px 16px;
  transition: background-color 0.15s var(--%NS%ease), border-color 0.15s var(--%NS%ease), box-shadow 0.15s var(--%NS%ease);
}

.node-card[_ngcontent-%COMP%]:hover {
  background: var(--%NS%surface-2);
  border-color: var(--%NS%border-strong);
}

.picker[_ngcontent-%COMP%] {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1 1 260px;
  min-width: 0;
}

.picker[_ngcontent-%COMP%]   app-select[_ngcontent-%COMP%] {
  flex: 1 1 auto;
  min-width: 0;
}

.label-key[_ngcontent-%COMP%] {
  flex: none;
  color: var(--%NS%text-2);
  font-size: 12px;
}

.showing[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 4px 10px;
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--%NS%text-2);
}

.showing-name[_ngcontent-%COMP%] {
  color: var(--%NS%text-strong);
  font-family: var(--%NS%font-mono);
  font-size: 13px;
  font-weight: 600;
}

.mono[_ngcontent-%COMP%] {
  font-family: var(--%NS%font-mono);
  overflow-wrap: anywhere;
}

.source-note[_ngcontent-%COMP%] {
  padding: 0 8px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: 99px;
  line-height: 18px;
}

.fallback[_ngcontent-%COMP%] {
  margin: 0 0 8px;
  color: var(--%NS%warn);
  font-size: 12px;
}

.source-label[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin: 0 0 12px;
}

.nodes[_ngcontent-%COMP%]    > li[_ngcontent-%COMP%] {
  display: block;
  min-width: 0;
  padding: 0;
}

button.node-card[_ngcontent-%COMP%] {
  cursor: pointer;
}

.node-card[_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: 2px;
}

.node-card.selected[_ngcontent-%COMP%] {
  background: var(--%NS%accent-soft);
  border-color: var(--%NS%accent-line);
  box-shadow: inset 2px 0 0 var(--%NS%accent);
}

.chevron[_ngcontent-%COMP%] {
  flex: none;
  width: 7px;
  height: 7px;
  margin-left: auto;
  border-right: 1.5px solid var(--%NS%text-3);
  border-bottom: 1.5px solid var(--%NS%text-3);
  transform: translateY(-2px) rotate(45deg);
  transition: transform 0.2s var(--%NS%ease), border-color 0.15s var(--%NS%ease);
}

.node-card[_ngcontent-%COMP%]:hover   .chevron[_ngcontent-%COMP%] {
  border-color: var(--%NS%text);
}

.node-card.selected[_ngcontent-%COMP%]   .chevron[_ngcontent-%COMP%] {
  border-color: var(--%NS%accent);
  transform: translateY(2px) rotate(-135deg);
}

.node-value[_ngcontent-%COMP%] {
  display: block;
  margin-top: 8px;
  padding: 4px 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--%NS%font-mono);
  font-size: 12px;
  color: var(--%NS%text-2);
  background: var(--%NS%bg);
  border: 1px solid var(--%NS%border);
  border-radius: 6px;
}

.node-card.selected[_ngcontent-%COMP%]   .node-value[_ngcontent-%COMP%] {
  background: color-mix(in srgb, var(--%NS%bg) 70%, transparent);
}

.kind-badge.sm[_ngcontent-%COMP%] {
  font-size: 10px;
  line-height: 16px;
  padding: 0 6px;
}

.changed-badge[_ngcontent-%COMP%] {
  flex: none;
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
  padding: 0 8px;
  border: 1px solid;
  border-radius: 99px;
  font-variant-numeric: tabular-nums;
}

.changed-badge[_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%warn) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%warn) 12%, transparent);
  color: var(--%NS%warn);
}

.detail-panel[_ngcontent-%COMP%] {
  margin-top: 8px;
  padding: 16px;
  background: var(--%NS%surface);
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  box-shadow: var(--%NS%shadow);
  animation: enter 0.25s var(--%NS%ease) both;
}

.detail-title[_ngcontent-%COMP%] {
  margin: 0 0 16px;
  font-family: var(--%NS%font-mono);
  font-size: 14px;
  font-weight: 600;
  color: var(--%NS%accent);
  overflow-wrap: anywhere;
}

.detail-panel[_ngcontent-%COMP%]   h4[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin: 20px 0 8px;
}

.detail-panel[_ngcontent-%COMP%]   dd[_ngcontent-%COMP%]   pre[_ngcontent-%COMP%] {
  max-height: 240px;
  overflow: auto;
  padding: 8px 12px;
  background: var(--%NS%surface-2);
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius-sm);
}

.scroll-box[_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: -2px;
}

.list-heading[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin: 16px 0 8px;
}

.resources[_ngcontent-%COMP%] {
  margin-bottom: 8px;
}

.status-tag[_ngcontent-%COMP%] {
  flex: none;
  font-size: 11px;
  font-weight: 500;
  line-height: 16px;
  padding: 0 8px;
  border: 1px solid;
  border-radius: 99px;
}

.tone-ok[_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%ok) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%ok) 12%, transparent);
  color: var(--%NS%ok);
}

.tone-warn[_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%warn) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%warn) 12%, transparent);
  color: var(--%NS%warn);
}

.tone-danger[_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%danger) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%danger) 12%, transparent);
  color: var(--%NS%danger);
}

.tone-neutral[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
  border-color: var(--%NS%border-strong);
}

.detail-panel[_ngcontent-%COMP%]   .hint[_ngcontent-%COMP%] {
  margin: 0 0 12px;
}

.internals-toggle[_ngcontent-%COMP%] {
  margin-top: 16px;
}

.detail-panel[_ngcontent-%COMP%]   .internals-toggle[_ngcontent-%COMP%]    + ul[_ngcontent-%COMP%] {
  margin-top: 8px;
}

.detail-panel[_ngcontent-%COMP%]   ul[_ngcontent-%COMP%] {
  display: flex;
  flex-direction: column;
  gap: 2px;
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: 13px;
}

.detail-panel[_ngcontent-%COMP%]   ul[_ngcontent-%COMP%]   li[_ngcontent-%COMP%], 
.rel-link[_ngcontent-%COMP%] {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  min-height: 28px;
  padding: 4px 8px;
  color: var(--%NS%text-2);
  border-radius: 6px;
}

.detail-panel[_ngcontent-%COMP%]   ul[_ngcontent-%COMP%]   li[_ngcontent-%COMP%]:has(> .rel-link) {
  padding: 0;
}

.rel-link[_ngcontent-%COMP%] {
  width: 100%;
  font: inherit;
  text-align: left;
  background: none;
  border: 0;
  cursor: pointer;
  transition: background-color 0.15s var(--%NS%ease), color 0.15s var(--%NS%ease);
}

.rel-link[_ngcontent-%COMP%]:hover {
  background: var(--%NS%surface-2);
  color: var(--%NS%text);
}

.rel-link[_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: 2px;
}

.jump-note[_ngcontent-%COMP%] {
  margin: 0;
  font-size: 12px;
  color: var(--%NS%text-2);
}

.jump-note[_ngcontent-%COMP%]:not(:empty) {
  margin-bottom: 8px;
}

.rel-label[_ngcontent-%COMP%] {
  min-width: 0;
  font-family: var(--%NS%font-mono);
  font-size: 12.5px;
  overflow-wrap: anywhere;
}

.history-summary[_ngcontent-%COMP%] {
  margin: 0 0 8px;
  font-size: 12px;
  color: var(--%NS%text-2);
  font-variant-numeric: tabular-nums;
}

.history[_ngcontent-%COMP%] {
  list-style: none;
  padding: 4px;
  margin: 0;
  max-height: 320px;
  overflow: auto;
  background: var(--%NS%surface-2);
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius-sm);
}

.history[_ngcontent-%COMP%]   li[_ngcontent-%COMP%] {
  display: block;
  padding: 8px;
  border-radius: 6px;
  transition: background-color 0.15s var(--%NS%ease);
}

.history[_ngcontent-%COMP%]   li[_ngcontent-%COMP%]    + li[_ngcontent-%COMP%] {
  border-top: 1px solid var(--%NS%border);
}

.history[_ngcontent-%COMP%]   li[_ngcontent-%COMP%]:hover {
  background: var(--%NS%surface-3);
}

.history-meta[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  align-items: center;
  margin-bottom: 4px;
  font-size: 11px;
  color: var(--%NS%text-2);
  font-variant-numeric: tabular-nums;
}

.history-meta[_ngcontent-%COMP%]   time[_ngcontent-%COMP%] {
  font-family: var(--%NS%font-mono);
  color: var(--%NS%text);
}

.source-tag[_ngcontent-%COMP%] {
  line-height: 16px;
  padding: 0 8px;
  border-radius: 99px;
  background: var(--%NS%surface-3);
  border: 1px solid var(--%NS%border-strong);
  color: var(--%NS%text);
}

.source-write[_ngcontent-%COMP%] {
  color: #93c5fd;
  background: color-mix(in srgb, #60a5fa 12%, transparent);
  border-color: color-mix(in srgb, #60a5fa 30%, transparent);
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme=dark])   [_nghost-%COMP%]   .source-write[_ngcontent-%COMP%] {
    border-color: color-mix(in srgb, #1d4ed8 30%, transparent);
    background: color-mix(in srgb, #1d4ed8 12%, transparent);
    color: #1d4ed8;
  }
}
:root[data-theme=light]   [_nghost-%COMP%]   .source-write[_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, #1d4ed8 30%, transparent);
  background: color-mix(in srgb, #1d4ed8 12%, transparent);
  color: #1d4ed8;
}

.missed[_ngcontent-%COMP%] {
  color: var(--%NS%warn);
}

@media (max-width: 480px) {
  .toolbar[_ngcontent-%COMP%] {
    padding: 8px;
  }
  .toolbar[_ngcontent-%COMP%]   input[_ngcontent-%COMP%], 
   .picker[_ngcontent-%COMP%] {
    flex-basis: 100%;
  }
  .node-card[_ngcontent-%COMP%], 
   .detail-panel[_ngcontent-%COMP%] {
    padding: 12px;
  }
  dl[_ngcontent-%COMP%] {
    grid-template-columns: minmax(0, 1fr);
    gap: 4px;
  }
  dd[_ngcontent-%COMP%]    + dt[_ngcontent-%COMP%] {
    margin-top: 8px;
  }
}`]})},QN=(e,t)=>t.node.injector.id,$N=(e,t)=>t.id,eP=(e,t)=>t.from+t.token+e,tP=(e,t)=>t.token+e,nP=(e,t)=>t.type,rP=(e,t)=>t.token+t.file+t.line;function iP(e,t){if(e&1){let e=W();H(0,`label`,12)(1,`input`,13),Qg(`change`,function(){O(e);let t=K(2);return k(t.componentsOnly.set(!t.componentsOnly()))}),U(),J(2,` Components only `),U()}if(e&2){let e=K(2);M(),Vg(`checked`,e.componentsOnly())}}function aP(e,t){e&1&&(H(0,`p`,14),A(),H(1,`svg`,21),Fg(2,`circle`,22)(3,`path`,23),U(),ps(),H(4,`span`)(5,`strong`),J(6,`This page has more than 2000 element injectors.`),U(),J(7,` Only the first 2000 are shown, so a lookup path or a provider can point to one that is not listed. `),U()())}function oP(e,t){if(e&1){let e=W();H(0,`button`,26),Qg(`click`,function(){let t=O(e).$implicit;return k(K(3).reveal(t.id))}),Fg(1,`span`,27),H(2,`span`,28),J(3),U(),H(4,`span`,29),J(5),U()()}if(e&2){let e=t.$implicit,n=K(3);M(),C_(`background`,n.tone(e.kind)),M(2),Y(e.label),M(2),Y(e.tokens)}}function sP(e,t){if(e&1&&(H(0,`div`,15)(1,`span`,24),J(2,`Provided by`),U(),I(3,oP,6,4,`button`,25,$N),U()),e&2){let e=K(2);M(3),L(e.providedBy())}}function cP(e,t){if(e&1){let e=W();H(0,`div`,16),J(1),H(2,`button`,30),Qg(`click`,function(){return O(e),k(K(2).query.set(``))}),J(3,`Clear search`),U()()}if(e&2){let e=K(2);M(),X(` Nothing here matches “`,e.query().trim(),`”. `)}}function lP(e,t){e&1&&J(0,` None of them provide anything themselves. `)}function uP(e,t){e&1&&J(0,` Turn off “Components only” to see directives. `)}function dP(e,t){e&1&&J(0,` Try a different search. `)}function fP(e,t){if(e&1&&(H(0,`div`,1)(1,`p`,31),J(2,`No injectors to show`),U(),H(3,`p`,32),P(4,lP,1,0)(5,uP,1,0)(6,dP,1,0),U()()),e&2){let e=K(2);M(4),F(e.onlyProviding()?4:e.componentsOnly()&&e.view()===`element`?5:6)}}function pP(e,t){if(e&1){let e=W();H(0,`span`,43),Qg(`click`,function(t){O(e);let n=K().$implicit;return k(K(2).toggle(n.node.injector.id,t))}),A(),H(1,`svg`,44),Fg(2,`path`,45),U()()}if(e&2){let e=K().$implicit;q(`open`,e.expanded)}}function mP(e,t){e&1&&Fg(0,`span`,35)}function hP(e,t){if(e&1&&(H(0,`span`,39),J(1),U()),e&2){let e=K().$implicit;M(),Y(e.node.injector.component)}}function gP(e,t){if(e&1&&(H(0,`span`,39),J(1),U()),e&2){let e=K().$implicit;M(),Y(e.node.injector.directives.join(`, `))}}function _P(e,t){if(e&1&&(H(0,`span`,41),A(),H(1,`svg`,21),Fg(2,`path`,46),U(),ps(),H(3,`span`,37),J(4,`injects`),U(),J(5),U()),e&2){let e=K().$implicit;N(`title`,e.node.dependencies.length+` injected`),M(5),X(` `,e.node.dependencies.length,` `)}}function vP(e,t){if(e&1&&(H(0,`span`,42),A(),H(1,`svg`,21),Fg(2,`path`,47),U(),ps(),H(3,`span`,37),J(4,`provides`),U(),J(5),U()),e&2){let e=K().$implicit;N(`title`,e.node.injector.providerCount+` provided`),M(5),X(` `,e.node.injector.providerCount,` `)}}function yP(e,t){if(e&1){let e=W();H(0,`div`,33),Qg(`click`,function(){let t=O(e).$implicit;return k(K(2).select(t.node.injector.id))})(`focus`,function(){let t=O(e).$implicit,n=K(2);return n.focusId.set(t.node.injector.id),k(n.highlight(t.node))})(`blur`,function(){return O(e),k(K(2).highlight(null))})(`mouseenter`,function(){let t=O(e).$implicit;return k(K(2).highlight(t.node))})(`mouseleave`,function(){return O(e),k(K(2).highlight(null))}),P(1,pP,3,2,`span`,34)(2,mP,1,0,`span`,35),H(3,`span`,36),J(4),U(),H(5,`span`,37),J(6),U(),H(7,`span`,38),J(8),U(),P(9,hP,2,1,`span`,39)(10,gP,2,1,`span`,39),H(11,`span`,40),P(12,_P,6,2,`span`,41),P(13,vP,6,2,`span`,42),U()()}if(e&2){let e=t.$implicit,n=K(2);C_(`--%NS%depth`,e.depth),q(`selected`,n.selected()?.injector?.id===e.node.injector.id),N(`aria-level`,e.depth+1)(`aria-expanded`,e.hasChildren?e.expanded:null)(`aria-selected`,n.selected()?.injector?.id===e.node.injector.id)(`tabindex`,n.rovingId()===e.node.injector.id?0:-1)(`data-id`,e.node.injector.id),M(),F(e.hasChildren?1:2),M(2),C_(`--%NS%tone`,n.tone(n.kind(e.node))),N(`title`,n.kind(e.node)),M(),Y(n.kind(e.node)[0].toUpperCase()),M(2),Y(n.kind(e.node)),M(2),Y(n.label(e.node)),M(),F(e.node.injector.component?9:e.node.injector.directives?.length?10:-1),M(3),F((e.node.dependencies?.length??0)>0?12:-1),M(),F(e.node.injector.providerCount>0?13:-1)}}function bP(e,t){if(e&1&&(H(0,`li`),J(1),U()),e&2){let e=t.$implicit;q(`is-component`,e===K(2).injector.component),M(),Y(e)}}function xP(e,t){if(e&1&&(H(0,`ul`,51),I(1,bP,2,3,`li`,58,wg),U()),e&2){let e=K();M(),L(e.injector.directives)}}function SP(e,t){if(e&1&&(H(0,`span`,59),Fg(1,`span`,27),J(2,` Null injector `),H(3,`span`,61),J(4,`throws NullInjectorError`),U()()),e&2){let e=K(4);M(),C_(`background`,e.tone(`null`))}}function CP(e,t){if(e&1&&(H(0,`span`,63),J(1),H(2,`span`,37),J(3),U()()),e&2){let e=K(2).$implicit;M(),X(` `,e.providers,` `),M(2),Y(e.providers===1?`provider`:`providers`)}}function wP(e,t){if(e&1){let e=W();H(0,`button`,62),Qg(`click`,function(){O(e);let t=K().$implicit;return k(K(3).reveal(t.id))}),Fg(1,`span`,27),H(2,`span`,28),J(3),U(),P(4,CP,4,2,`span`,63),U()}if(e&2){let e=K().$implicit,t=K(3);M(),C_(`background`,t.tone(e.kind)),M(2),Y(e.label),M(),F(e.providers?4:-1)}}function TP(e,t){if(e&1&&(H(0,`li`),P(1,SP,5,2,`span`,59)(2,wP,5,4,`button`,60),U()),e&2){let e=t.$implicit,n=t.$index,r=K(3);q(`current`,n===0),M(),F(e.id===r.nullId?1:2)}}function EP(e,t){e&1&&(H(0,`p`,53),J(1,`Only services this injector has already created are listed.`),U())}function DP(e,t){if(e&1&&(H(0,`span`,69),J(1),U()),e&2){let e=t.$implicit;M(),Y(e)}}function OP(e,t){if(e&1&&(H(0,`span`),J(1),U()),e&2){let e=K().$implicit;M(),X(`for `,e.from)}}function kP(e,t){if(e&1){let e=W();H(0,`button`,74),Qg(`click`,function(){let t=O(e);return k(K(6).reveal(t))}),Fg(1,`span`,27),J(2,` from `),H(3,`span`,28),J(4),U()()}if(e&2){let e=t,n=K(6);M(),C_(`background`,n.tone(n.kindById(e))),M(3),Y(n.labelById(e))}}function AP(e,t){e&1&&(H(0,`span`,72),J(1,`optional, not provided`),U())}function jP(e,t){e&1&&(H(0,`span`,73),J(1,`not provided anywhere`),U())}function MP(e,t){if(e&1&&(H(0,`li`,66)(1,`div`,67)(2,`span`,68),J(3),U(),I(4,DP,2,1,`span`,69,wg),U(),H(6,`div`,70),P(7,OP,2,1,`span`),P(8,kP,5,3,`button`,71)(9,AP,2,0,`span`,72)(10,jP,2,0,`span`,73),U()()),e&2){let e,n=t.$implicit,r=K(3);q(`hit`,K(2).matches(n.token)),M(3),Y(n.token),M(),L(n.flags),M(3),F(r.injector.type!==`element`||r.injector.directives&&r.injector.directives.length>1?7:-1),M(),F((e=n.providedBy)?8:n.flags.includes(`optional`)?9:10,e)}}function NP(e,t){if(e&1&&(H(0,`ul`,64),I(1,MP,11,5,`li`,65,eP),U()),e&2){let e=K(2);M(),L(e.dependencies)}}function PP(e,t){e&1&&(H(0,`p`,57),J(1,`Nothing is injected through the constructor or inject().`),U())}function FP(e,t){e&1&&(H(0,`p`,57),J(1,`No service created here has injected anything yet.`),U())}function IP(e,t){if(e&1&&(H(0,`div`,52)(1,`h3`),J(2),H(3,`span`,6),J(4),U()(),P(5,EP,2,0,`p`,53),P(6,NP,3,0,`ul`,64)(7,PP,2,0,`p`,57)(8,FP,2,0,`p`,57),U()),e&2){let e=K();M(2),X(` `,e.injector.type===`element`?`Injected here`:`Injected by its services`,` `),M(2),Y(e.dependencies?.length??0),M(),F(e.injector.type===`element`?-1:5),M(),F(e.dependencies?.length?6:e.injector.type===`element`?7:8)}}function LP(e,t){e&1&&(H(0,`span`,69),J(1,`viewProviders`),U())}function RP(e,t){e&1&&(H(0,`span`,69),J(1,`multi`),U())}function zP(e,t){if(e&1&&(H(0,`div`,70),J(1),U()),e&2){let e=K().$implicit;M(),X(`via `,e.importPath.join(` › `))}}function BP(e,t){if(e&1&&(H(0,`li`,76)(1,`div`,67)(2,`span`,68),J(3),U(),H(4,`span`,77),J(5),U(),P(6,LP,2,0,`span`,69),P(7,RP,2,0,`span`,69),U(),P(8,zP,2,1,`div`,70),U()),e&2){let e=t.$implicit,n=K(4);q(`hit`,n.matches(e.token)),M(3),Y(e.token),M(2),Y(e.type===`unknown`?`provider`:`use`+n.capital(e.type)),M(),F(e.isViewProvider?6:-1),M(),F(e.multi?7:-1),M(),F(e.importPath?.length?8:-1)}}function VP(e,t){if(e&1&&(H(0,`ul`,56),I(1,BP,9,7,`li`,75,tP),U()),e&2){let e=K();M(),L(e.providers)}}function HP(e,t){e&1&&J(0,` No providers or viewProviders on this element. `)}function UP(e,t){e&1&&J(0,` This injector has no providers of its own. `)}function WP(e,t){if(e&1&&(H(0,`p`,57),P(1,HP,1,0)(2,UP,1,0),U()),e&2){let e=K();M(),F(e.injector.type===`element`?1:2)}}function GP(e,t){if(e&1&&(H(0,`section`,20)(1,`header`,48)(2,`span`,49),J(3),U(),H(4,`h2`,50),J(5),U(),P(6,xP,3,0,`ul`,51),U(),H(7,`div`,52)(8,`h3`),J(9,`Lookup path`),U(),H(10,`p`,53),J(11,`Angular asks these injectors in order until one has the token.`),U(),H(12,`ol`,54),I(13,TP,3,3,`li`,55,$N),U()(),P(15,IP,9,4,`div`,52),H(16,`div`,52)(17,`h3`),J(18,` Provides `),H(19,`span`,6),J(20),U()(),P(21,VP,3,0,`ul`,56)(22,WP,3,1,`p`,57),U()()),e&2){let e=t,n=K(2);M(2),C_(`--%NS%tone`,n.tone(n.kind(e))),M(),Y(n.kind(e)),M(2),Y(n.label(e)),M(),F(e.injector.directives?.length?6:-1),M(7),L(n.path()),M(2),F(e.injector.type===`element`||e.dependencies?15:-1),M(5),Y(e.providers.length),M(),F(e.providers.length?21:22)}}function KP(e,t){if(e&1){let e=W();H(0,`p`,2),J(1,` Every component and directive gets an injector. When it asks for a token, Angular walks up this tree, then through the environment injectors, until something provides it. `),U(),H(2,`div`,3)(3,`div`,4)(4,`button`,5),Qg(`click`,function(){return O(e),k(K().setView(`element`))}),J(5,` Elements `),H(6,`span`,6),J(7),U()(),H(8,`button`,5),Qg(`click`,function(){return O(e),k(K().setView(`environment`))}),J(9,` Environment `),H(10,`span`,6),J(11),U()()(),H(12,`div`,7),A(),H(13,`svg`,8),Fg(14,`circle`,9)(15,`path`,10),U(),ps(),H(16,`input`,11),Qg(`input`,function(t){return O(e),k(K().query.set(t.target.value))})(`keydown.escape`,function(){return O(e),k(K().query.set(``))}),U()(),P(17,iP,3,1,`label`,12),H(18,`label`,12)(19,`input`,13),Qg(`change`,function(){O(e);let t=K();return k(t.onlyProviding.set(!t.onlyProviding()))}),U(),J(20,` With providers `),U()(),P(21,aP,8,0,`p`,14),P(22,sP,5,0,`div`,15)(23,cP,4,1,`div`,16),H(24,`div`,17),P(25,fP,7,1,`div`,1),H(26,`div`,18),Qg(`keydown`,function(t){return O(e),k(K().onTreeKey(t))}),I(27,yP,14,19,`div`,19,QN),U(),P(29,GP,23,8,`section`,20),U()}if(e&2){let e,t=K();M(4),q(`active`,t.view()===`element`),N(`aria-pressed`,t.view()===`element`),M(3),Y(t.elementCount()),M(),q(`active`,t.view()===`environment`),N(`aria-pressed`,t.view()===`environment`),M(3),Y(t.environmentCount()),M(5),Vg(`value`,t.query()),M(),F(t.view()===`element`?17:-1),M(2),Vg(`checked`,t.onlyProviding()),M(2),F(t.truncated()?21:-1),M(),F(t.providedBy().length?22:t.query().trim()&&!t.rows().length?23:-1),M(3),F(t.rows().length?-1:25),M(),Vg(`hidden`,!t.rows().length),N(`aria-label`,t.view()===`element`?`Element injectors`:`Environment injectors`),M(),L(t.rows()),M(2),F((e=t.selected())?29:-1,e)}}function qP(e,t){e&1&&(H(0,`div`,0),Fg(1,`span`,78),H(2,`p`,31),J(3,`Loading dependency injection data…`),U()())}function JP(e,t){e&1&&(H(0,`div`,1)(1,`p`,31),J(2,`No DI data found`),U(),H(3,`p`,32),J(4,` Open the app in a browser with the devtools connected to see its live injectors. No providers, injectables or inject() calls were found in the source either. `),U()())}function YP(e,t){if(e&1){let e=W();H(0,`div`,1)(1,`p`,31),J(2),U(),H(3,`p`,32),J(4,`Try part of a token name or a file path.`),U(),H(5,`button`,5),Qg(`click`,function(){return O(e),k(K(2).query.set(``))}),J(6,`Clear filter`),U()()}if(e&2){let e=K(2);M(2),X(`No providers match “`,e.query(),`”`)}}function XP(e,t){if(e&1&&(H(0,`span`,88),J(1),U()),e&2){let e=K().$implicit;M(),X(`providedIn: `,e.providedIn)}}function ZP(e,t){if(e&1&&(H(0,`span`,90),J(1),U()),e&2){let e=K().$implicit;M(),X(`as `,e.source)}}function QP(e,t){if(e&1&&(H(0,`li`,85)(1,`div`,86)(2,`span`,87),J(3),U(),P(4,XP,2,1,`span`,88),U(),H(5,`div`,89)(6,`span`,54),J(7),U(),P(8,ZP,2,1,`span`,90),U()()),e&2){let e=t.$implicit;M(3),Y(e.token),M(),F(e.providedIn?4:-1),M(3),Z(``,e.file,`:`,e.line),M(),F(e.source!==`class`&&e.source!==`providers array`?8:-1)}}function $P(e,t){if(e&1&&(H(0,`section`,82)(1,`h2`),J(2),H(3,`span`,83),J(4),U()(),H(5,`ul`,84),I(6,QP,9,5,`li`,85,rP),U()()),e&2){let e=t.$implicit;M(2),X(` `,e.label,` `),M(2),Y(e.items.length),M(2),L(e.items)}}function eF(e,t){if(e&1&&(H(0,`div`,81),I(1,$P,8,2,`section`,82,nP),U()),e&2){let e=K(2);M(),L(e.groupedProviders())}}function tF(e,t){if(e&1){let e=W();H(0,`div`,3)(1,`div`,7),A(),H(2,`svg`,8),Fg(3,`circle`,9)(4,`path`,10),U(),ps(),H(5,`input`,79),Qg(`input`,function(t){return O(e),k(K().query.set(t.target.value))})(`keydown.escape`,function(){return O(e),k(K().query.set(``))}),U()(),H(6,`span`,80),J(7),U()(),H(8,`p`,14),A(),H(9,`svg`,21),Fg(10,`circle`,22)(11,`path`,23),U(),ps(),H(12,`span`)(13,`strong`),J(14,`DI from source scan (static analysis).`),U(),J(15,` Connect the overlay on Angular 20 or later to see the live injector tree. `),U()(),P(16,YP,7,1,`div`,1)(17,eF,3,0,`div`,81)}if(e&2){let e=K();M(5),Vg(`value`,e.query()),M(2),Z(` `,e.sourceMatchCount(),` of `,e.sourceProviders().length,` `),M(9),F(e.groupedProviders().length===0?16:17)}}var nF=`inj-null`,rF={component:`var(--accent)`,directive:`var(--directive)`,environment:`var(--ok)`,null:`var(--text-3)`};function iF(e){return e.injector.type===`element`?e.injector.component?`component`:`directive`:`environment`}function aF(e){return e.injector.type===`element`?`<${e.injector.name}>`:e.injector.name}function oF(e){return Array.isArray(e)}var sF=class e{rpc=$(null);injector=E(xs);nullId=nF;roots=j([]);environment=j([]);sourceProviders=j([]);loaded=j(!1);truncated=j(!1);view=j(`element`);query=j(``);onlyProviding=j(!1);componentsOnly=j(!0);collapsed=j(new Set);selectedId=j(null);focusId=j(null);index=Q(()=>{let e=new Map,t=new Map,n=(r,i)=>{for(let a of r)e.set(a.injector.id,a),i&&t.set(a.injector.id,i),n(a.children,a.injector.id)};return n(this.roots(),null),n(this.environment(),null),{map:e,parents:t}});elementCount=Q(()=>this.count(this.roots()));environmentCount=Q(()=>this.count(this.environment()));visible=Q(()=>{let e=this.view()===`element`?this.roots():this.environment();this.view()===`element`&&this.componentsOnly()&&(e=this.prune(e,e=>!!e.injector.component)),this.onlyProviding()&&(e=this.prune(e,e=>e.providers.length>0));let t=this.normalizedQuery();return t&&(e=this.prune(e,e=>this.nodeMatches(e,t))),e});rows=Q(()=>{let e=[],t=this.collapsed(),n=!!this.normalizedQuery(),r=(i,a)=>{for(let o of i){let i=n||!t.has(o.injector.id);e.push({node:o,depth:a,hasChildren:o.children.length>0,expanded:i}),i&&r(o.children,a+1)}};return r(this.visible(),0),e});selected=Q(()=>{let e=this.selectedId();return(e?this.index().map.get(e):void 0)??this.rows()[0]?.node??null});rovingId=Q(()=>{let e=this.rows(),t=this.focusId()??this.selected()?.injector.id;return t&&e.some(e=>e.node.injector.id===t)?t:e[0]?.node.injector.id??null});path=Q(()=>{let e=this.selected();if(!e)return[];let{map:t,parents:n}=this.index(),r=e.injector.path??[];if(!r.length){r=[e.injector.id];let t=n.get(e.injector.id);for(;t;)r.push(t),t=n.get(t);r.push(nF)}return r.map(e=>{let n=t.get(e);return{id:e,label:n?aF(n):e===nF?`Null injector`:`Not listed`,kind:n?iF(n):`null`,providers:n?.providers.length??0}})});providedBy=Q(()=>{let e=this.normalizedQuery();if(!e)return[];let t=[];for(let n of this.index().map.values()){let r=n.providers.filter(t=>t.token.toLowerCase().includes(e));r.length&&t.push({id:n.injector.id,label:aF(n),kind:iF(n),tokens:r.map(e=>e.token).join(`, `)})}return t.slice(0,12)});groupedProviders=Q(()=>{let e=this.normalizedQuery(),t=e?this.sourceProviders().filter(t=>t.token.toLowerCase().includes(e)||t.file.toLowerCase().includes(e)):this.sourceProviders(),n=[{type:`root-provider`,label:`Root Providers (provide*)`,items:[]},{type:`injectable`,label:`Injectable Services`,items:[]},{type:`injection`,label:`inject() Calls`,items:[]},{type:`provider`,label:`Component Providers`,items:[]}];for(let e of t)n.find(t=>t.type===e.type)?.items.push(e);return n.filter(e=>e.items.length>0)});sourceMatchCount=Q(()=>this.groupedProviders().reduce((e,t)=>e+t.items.length,0));normalizedQuery=Q(()=>this.query().trim().toLowerCase());destroyRef=E(Cs);stopTree=null;treeLoad=0;constructor(){uc(()=>{let e=this.rpc();e&&(this.loadInjectorTree(e),this.loadSourceProviders(e))}),this.destroyRef.onDestroy(()=>{this.stopTree?.(),this.highlight(null)})}label(e){return aF(e)}kind(e){return iF(e)}tone(e){return rF[e]??rF.null}kindById(e){let t=this.index().map.get(e);return t?iF(t):`null`}labelById(e){let t=this.index().map.get(e);return t?aF(t):e===nF?`Null injector`:`not listed`}capital(e){return e.charAt(0).toUpperCase()+e.slice(1)}matches(e){let t=this.normalizedQuery();return!!t&&e.toLowerCase().includes(t)}setView(e){this.view()!==e&&(this.view.set(e),this.selectedId.set(null),this.focusId.set(null))}select(e){this.selectedId.set(e),this.focusId.set(e)}toggle(e,t){t?.stopPropagation(),!this.normalizedQuery()&&this.collapsed.update(t=>{let n=new Set(t);return n.has(e)?n.delete(e):n.add(e),n})}reveal(e){let t=this.index().map.get(e);if(!t)return;this.setView(t.injector.type===`element`?`element`:`environment`);let{parents:n}=this.index();this.collapsed.update(t=>{let r=new Set(t),i=n.get(e);for(;i;)r.delete(i),i=n.get(i);return r}),this.onlyProviding()&&t.providers.length===0&&this.onlyProviding.set(!1),t.injector.type===`element`&&!t.injector.component&&this.componentsOnly.set(!1),this.select(e),Id(()=>this.focusRow(e,!1),{injector:this.injector})}highlight(e){let t=this.rpc();if(!t)return;let n=e?.injector.type===`element`?e.injector.selector??null:null,r=n?{pageId:$T(),selector:n}:null;t.scope(`pangular`).rpc.call(`request-page-highlight`,r).catch(()=>{})}onTreeKey(e){let t=this.rows();if(!t.length)return;let n=this.rovingId(),r=t.findIndex(e=>e.node.injector.id===n),i=Math.max(r,0),a=t[i],o=-1;switch(e.key){case`ArrowDown`:o=Math.min(i+1,t.length-1);break;case`ArrowUp`:o=Math.max(i-1,0);break;case`Home`:o=0;break;case`End`:o=t.length-1;break;case`ArrowRight`:a.hasChildren&&!a.expanded?this.toggle(a.node.injector.id):a.hasChildren&&(o=i+1);break;case`ArrowLeft`:if(a.hasChildren&&a.expanded&&!this.normalizedQuery())this.toggle(a.node.injector.id);else{let e=this.index().parents.get(a.node.injector.id);o=t.findIndex(t=>t.node.injector.id===e)}break;case`Enter`:case` `:this.select(a.node.injector.id);break;default:return}if(e.preventDefault(),o>=0){let e=t[o].node.injector.id;this.focusId.set(e),this.selectedId.set(e),queueMicrotask(()=>this.focusRow(e,!0))}}focusRow(e,t){let n=document.querySelector(`.row[data-id="${CSS.escape(e)}"]`);n&&(t&&n.focus(),n.scrollIntoView({block:`nearest`}))}clearTree(){this.stopTree?.(),this.stopTree=null}async loadInjectorTree(e){let t=++this.treeLoad;this.clearTree();let n=e.scope(`pangular`),r;try{r=await n.rpc.sharedState(`injector-tree`)}catch{return}if(this.destroyRef.destroyed||this.rpc()!==e||t!==this.treeLoad)return;let i=$T(),a=e=>{let t=e,n=i?t?.pages?.[i]:t;this.roots.set(oF(n?.roots)?n.roots:[]),this.environment.set(oF(n?.environment)?n.environment:[]),this.truncated.set(n?.truncated===!0)};a(r.value()),this.clearTree(),this.stopTree=r.on(`updated`,a)}async loadSourceProviders(e){let t=e.scope(`pangular`);try{this.sourceProviders.set(await t.rpc.call(`get-providers`))}catch{this.sourceProviders.set([])}finally{this.loaded.set(!0)}}count(e){return e.reduce((e,t)=>e+1+this.count(t.children),0)}nodeMatches(e,t){let n=e.injector;return n.name.toLowerCase().includes(t)||!!n.component?.toLowerCase().includes(t)||!!n.directives?.some(e=>e.toLowerCase().includes(t))||e.providers.some(e=>e.token.toLowerCase().includes(t))||!!e.dependencies?.some(e=>e.token.toLowerCase().includes(t))}prune(e,t){let n=[];for(let r of e){let e=this.prune(r.children,t);(t(r)||e.length)&&n.push({...r,children:e})}return n}static ɵfac=function(t){return new(t||e)};static ɵcmp=Bh({type:e,selectors:[[`app-di-inspector`]],inputs:{rpc:[1,`rpc`]},decls:4,vars:1,consts:[[`role`,`status`,1,`state`],[1,`state`],[1,`intro`],[1,`toolbar`],[`role`,`group`,`aria-label`,`Injector tree`,1,`segmented`],[`type`,`button`,3,`click`],[1,`pill`],[1,`search`],[`viewBox`,`0 0 24 24`,`aria-hidden`,`true`,1,`search-icon`],[`cx`,`11`,`cy`,`11`,`r`,`7`],[`d`,`m20 20-3.5-3.5`],[`type`,`search`,`placeholder`,`Find a token, component or injector…`,`aria-label`,`Find a token, component or injector`,`autocomplete`,`off`,`spellcheck`,`false`,3,`input`,`keydown.escape`,`value`],[1,`checkbox`],[`type`,`checkbox`,3,`change`,`checked`],[1,`notice`],[`role`,`status`,1,`where`],[`role`,`status`,1,`where`,`muted`],[1,`layout`],[`role`,`tree`,1,`tree`,3,`keydown`,`hidden`],[`role`,`treeitem`,1,`row`,3,`selected`,`--%NS%depth`],[`aria-labelledby`,`di-detail-title`,1,`detail`],[`viewBox`,`0 0 24 24`,`aria-hidden`,`true`],[`cx`,`12`,`cy`,`12`,`r`,`9`],[`d`,`M12 11v5M12 8h.01`],[1,`where-label`],[`type`,`button`,1,`chip`],[`type`,`button`,1,`chip`,3,`click`],[`aria-hidden`,`true`,1,`dot`],[1,`mono`],[1,`chip-tokens`],[`type`,`button`,1,`link`,3,`click`],[1,`state-title`],[1,`state-hint`],[`role`,`treeitem`,1,`row`,3,`click`,`focus`,`blur`,`mouseenter`,`mouseleave`],[`aria-hidden`,`true`,1,`twisty`,3,`open`],[`aria-hidden`,`true`,1,`twisty-space`],[`aria-hidden`,`true`,1,`kind`],[1,`sr-only`],[1,`name`,`mono`],[1,`sub`],[1,`meta`],[1,`count`],[1,`count`,`provides`],[`aria-hidden`,`true`,1,`twisty`,3,`click`],[`viewBox`,`0 0 24 24`],[`d`,`m9 6 6 6-6 6`],[`d`,`M12 5v14M5 12l7 7 7-7`],[`d`,`M21 8 12 3 3 8v8l9 5 9-5z`],[1,`detail-head`],[1,`badge`],[`id`,`di-detail-title`,1,`mono`],[`aria-label`,`Classes on this element`,1,`classes`],[1,`block`],[1,`hint`],[1,`path`],[3,`current`],[1,`providers`],[1,`empty-line`],[3,`is-component`],[1,`step`,`null`],[`type`,`button`,1,`step`],[1,`hint-inline`],[`type`,`button`,1,`step`,3,`click`],[1,`step-count`],[1,`deps`],[1,`dep`,3,`hit`],[1,`dep`],[1,`dep-main`],[1,`token`,`mono`],[1,`flag`],[1,`dep-meta`],[`type`,`button`,1,`from`],[1,`from`,`absent`],[1,`from`,`missing`],[`type`,`button`,1,`from`,3,`click`],[1,`provider`,3,`hit`],[1,`provider`],[1,`flag`,`kind-flag`],[`aria-hidden`,`true`,1,`spinner`],[`type`,`search`,`placeholder`,`Filter by token or file…`,`aria-label`,`Filter by token or file`,`autocomplete`,`off`,`spellcheck`,`false`,3,`input`,`keydown.escape`,`value`],[`aria-live`,`polite`,1,`total`],[1,`source-providers`],[1,`provider-group`],[1,`section-count`],[`role`,`list`,1,`provider-list`],[1,`provider-card`],[1,`provider-header`],[1,`token`],[1,`provided-in`],[1,`provider-meta`],[1,`as`]],template:function(e,t){e&1&&P(0,KP,30,17)(1,qP,4,0,`div`,0)(2,JP,5,0,`div`,1)(3,tF,18,4),e&2&&F(t.roots().length>0?0:t.loaded()?t.sourceProviders().length===0?2:3:1)},styles:[`[_nghost-%COMP%] {
  --%NS%directive: #7cb4ff;
  display: block;
  color: var(--%NS%text);
  font-size: 13px;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme=dark])   [_nghost-%COMP%] {
    --%NS%directive: #1d4ed8;
  }
}
:root[data-theme=light]   [_nghost-%COMP%] {
  --%NS%directive: #1d4ed8;
}

.mono[_ngcontent-%COMP%] {
  font-family: var(--%NS%font-mono);
}

.intro[_ngcontent-%COMP%] {
  max-width: 720px;
  margin: 0 0 12px;
  color: var(--%NS%text-2);
  line-height: 1.5;
}

.toolbar[_ngcontent-%COMP%] {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
  margin: 0 0 12px;
  padding: 8px;
  background: color-mix(in srgb, var(--%NS%surface) 85%, transparent);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
}

.segmented[_ngcontent-%COMP%] {
  display: inline-flex;
  flex: none;
  padding: 3px;
  gap: 2px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%bg);
}

.segmented[_ngcontent-%COMP%]   button[_ngcontent-%COMP%] {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  padding: 0 10px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--%NS%text-2);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 150ms var(--%NS%ease), color 150ms var(--%NS%ease);
}

.segmented[_ngcontent-%COMP%]   button[_ngcontent-%COMP%]:hover {
  color: var(--%NS%text);
}

.segmented[_ngcontent-%COMP%]   button.active[_ngcontent-%COMP%] {
  background: var(--%NS%surface-3);
  color: var(--%NS%text-strong);
}

.segmented[_ngcontent-%COMP%]   button[_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: -2px;
}

.pill[_ngcontent-%COMP%] {
  display: inline-flex;
  align-items: center;
  min-width: 18px;
  height: 16px;
  padding: 0 5px;
  justify-content: center;
  border-radius: 99px;
  background: var(--%NS%surface-3);
  color: var(--%NS%text-2);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0;
  font-variant-numeric: tabular-nums;
}

.segmented[_ngcontent-%COMP%]   .active[_ngcontent-%COMP%]   .pill[_ngcontent-%COMP%] {
  background: var(--%NS%accent-soft);
  color: var(--%NS%accent);
}

.search[_ngcontent-%COMP%] {
  position: relative;
  flex: 1 1 220px;
  min-width: 0;
}

.search-icon[_ngcontent-%COMP%] {
  position: absolute;
  top: 50%;
  left: 12px;
  width: 14px;
  height: 14px;
  transform: translateY(-50%);
  fill: none;
  stroke: var(--%NS%text-3);
  stroke-width: 2.2;
  stroke-linecap: round;
  pointer-events: none;
}

.search[_ngcontent-%COMP%]:focus-within   .search-icon[_ngcontent-%COMP%] {
  stroke: var(--%NS%accent);
}

input[type=search][_ngcontent-%COMP%] {
  width: 100%;
  height: 34px;
  padding: 0 12px 0 34px;
  background: var(--%NS%bg);
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  color: var(--%NS%text);
  font-size: 13px;
  transition: border-color 150ms var(--%NS%ease), box-shadow 150ms var(--%NS%ease);
}

input[type=search][_ngcontent-%COMP%]::placeholder {
  color: var(--%NS%text-3);
}

input[type=search][_ngcontent-%COMP%]:focus-visible {
  outline: none;
  border-color: var(--%NS%accent);
  box-shadow: 0 0 0 3px var(--%NS%accent-soft);
}

.checkbox[_ngcontent-%COMP%] {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 34px;
  color: var(--%NS%text-2);
  white-space: nowrap;
  cursor: pointer;
}

.checkbox[_ngcontent-%COMP%]:hover {
  color: var(--%NS%text);
}

.checkbox[_ngcontent-%COMP%]   input[_ngcontent-%COMP%] {
  width: 15px;
  height: 15px;
  margin: 0;
  accent-color: var(--%NS%accent);
  cursor: pointer;
}

.checkbox[_ngcontent-%COMP%]   input[_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: 2px;
}

.total[_ngcontent-%COMP%] {
  flex: none;
  color: var(--%NS%text-2);
  font-size: 12px;
  white-space: nowrap;
}

.where[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin: 0 0 12px;
  padding: 8px 10px;
  border: 1px solid var(--%NS%accent-line);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%accent-soft);
  animation: enter 0.2s var(--%NS%ease) both;
}

.where.muted[_ngcontent-%COMP%] {
  border-color: var(--%NS%border);
  background: var(--%NS%surface);
  color: var(--%NS%text-2);
}

.where-label[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-right: 4px;
  color: var(--%NS%accent);
}

.chip[_ngcontent-%COMP%], 
.from[_ngcontent-%COMP%], 
.step[_ngcontent-%COMP%] {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
  max-width: 100%;
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: 99px;
  background: var(--%NS%surface);
  color: var(--%NS%text);
  font-size: 12px;
  cursor: pointer;
  transition: border-color 150ms var(--%NS%ease), background-color 150ms var(--%NS%ease);
}

.chip[_ngcontent-%COMP%]:hover, 
.from[_ngcontent-%COMP%]:hover, 
.step[_ngcontent-%COMP%]:hover {
  border-color: var(--%NS%accent-line);
  background: var(--%NS%surface-2);
}

.chip[_ngcontent-%COMP%]:focus-visible, 
.from[_ngcontent-%COMP%]:focus-visible, 
.step[_ngcontent-%COMP%]:focus-visible, 
.link[_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: 2px;
}

.chip-tokens[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.link[_ngcontent-%COMP%] {
  padding: 0;
  border: 0;
  background: none;
  color: var(--%NS%accent);
  font-size: 13px;
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 2px;
}

.dot[_ngcontent-%COMP%] {
  flex: none;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.layout[_ngcontent-%COMP%] {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}

@media (min-width: 880px) {
  .layout[_ngcontent-%COMP%] {
    grid-template-columns: minmax(0, 1fr) minmax(340px, 44%);
  }
  .detail[_ngcontent-%COMP%] {
    position: sticky;
    top: 64px;
    max-height: calc(100vh - 150px);
    overflow: auto;
  }
}
.tree[_ngcontent-%COMP%] {
  min-width: 0;
  padding: 6px;
  background: var(--%NS%surface);
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  animation: enter 0.35s var(--%NS%ease) both;
}

.row[_ngcontent-%COMP%] {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  min-height: 32px;
  padding: 0 8px 0 calc(4px + var(--%NS%depth, 0) * 18px);
  border-radius: var(--%NS%radius-sm);
  cursor: pointer;
  transition: background-color 120ms var(--%NS%ease);
}

.row[_ngcontent-%COMP%]::before {
  content: "";
  position: absolute;
  top: 0;
  bottom: 0;
  left: 14px;
  width: calc(var(--%NS%depth, 0) * 18px);
  background: repeating-linear-gradient(to right, var(--%NS%border) 0 1px, transparent 1px 18px);
  pointer-events: none;
}

.row[_ngcontent-%COMP%]:hover {
  background: var(--%NS%surface-2);
}

.row[_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: -2px;
}

.row.selected[_ngcontent-%COMP%] {
  background: var(--%NS%accent-soft);
  box-shadow: inset 2px 0 0 var(--%NS%accent);
}

.twisty[_ngcontent-%COMP%], 
.twisty-space[_ngcontent-%COMP%] {
  flex: none;
  width: 20px;
  height: 20px;
}

.twisty[_ngcontent-%COMP%] {
  display: grid;
  place-items: center;
  padding: 0;
  border: 0;
  border-radius: 4px;
  background: none;
  color: var(--%NS%text-3);
  cursor: pointer;
}

.twisty[_ngcontent-%COMP%]:hover {
  color: var(--%NS%text);
  background: var(--%NS%surface-3);
}

.twisty[_ngcontent-%COMP%]   svg[_ngcontent-%COMP%] {
  width: 14px;
  height: 14px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
  transition: transform 150ms var(--%NS%ease);
}

.twisty.open[_ngcontent-%COMP%]   svg[_ngcontent-%COMP%] {
  transform: rotate(90deg);
}

.kind[_ngcontent-%COMP%] {
  flex: none;
  display: grid;
  place-items: center;
  width: 18px;
  height: 18px;
  border-radius: 5px;
  background: color-mix(in srgb, var(--%NS%tone) 16%, transparent);
  color: var(--%NS%tone);
  font-size: 10px;
  font-weight: 700;
}

.name[_ngcontent-%COMP%] {
  min-width: 0;
  color: var(--%NS%text);
  font-size: 12px;
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row.selected[_ngcontent-%COMP%]   .name[_ngcontent-%COMP%] {
  color: var(--%NS%text-strong);
  font-weight: 600;
}

.sub[_ngcontent-%COMP%] {
  flex: 0 1 auto;
  min-width: 0;
  color: var(--%NS%text-3);
  font-size: 12px;
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta[_ngcontent-%COMP%] {
  display: inline-flex;
  flex: none;
  gap: 4px;
  margin-left: auto;
  padding-left: 8px;
}

.count[_ngcontent-%COMP%] {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  height: 20px;
  padding: 0 7px;
  border-radius: 99px;
  background: var(--%NS%surface-3);
  color: var(--%NS%text-2);
  font-size: 11px;
}

.count.provides[_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%ok) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%ok) 12%, transparent);
  color: var(--%NS%ok);
}

.count[_ngcontent-%COMP%]   svg[_ngcontent-%COMP%] {
  width: 11px;
  height: 11px;
  fill: none;
  stroke: currentColor;
  stroke-width: 2.2;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.detail[_ngcontent-%COMP%] {
  min-width: 0;
  background: var(--%NS%surface);
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  animation: enter 0.35s var(--%NS%ease) both;
}

.detail-head[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--%NS%border);
}

.detail-head[_ngcontent-%COMP%]   h2[_ngcontent-%COMP%] {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  color: var(--%NS%text-strong);
  font-size: 15px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.badge[_ngcontent-%COMP%] {
  padding: 2px 8px;
  border-radius: 99px;
  background: color-mix(in srgb, var(--%NS%tone) 14%, transparent);
  color: var(--%NS%tone);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.classes[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  width: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
}

.classes[_ngcontent-%COMP%]   li[_ngcontent-%COMP%] {
  padding: 1px 8px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: 6px;
  color: var(--%NS%text-2);
  font-family: var(--%NS%font-mono);
  font-size: 11px;
}

.classes[_ngcontent-%COMP%]   li.is-component[_ngcontent-%COMP%] {
  border-color: var(--%NS%accent-line);
  color: var(--%NS%accent);
}

.block[_ngcontent-%COMP%] {
  padding: 14px 16px;
  border-bottom: 1px solid var(--%NS%border);
}

.block[_ngcontent-%COMP%]:last-child {
  border-bottom: 0;
}

h3[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 8px;
}

.hint[_ngcontent-%COMP%] {
  margin: -4px 0 10px;
  color: var(--%NS%text-3);
  font-size: 12px;
}

.path[_ngcontent-%COMP%] {
  position: relative;
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0 0 0 18px;
  list-style: none;
}

.path[_ngcontent-%COMP%]::before {
  content: "";
  position: absolute;
  top: 13px;
  bottom: 13px;
  left: 5px;
  width: 1px;
  background: var(--%NS%border-strong);
}

.path[_ngcontent-%COMP%]   li[_ngcontent-%COMP%] {
  position: relative;
  min-width: 0;
}

.path[_ngcontent-%COMP%]   li[_ngcontent-%COMP%]::before {
  content: "";
  position: absolute;
  top: 12px;
  left: -16px;
  width: 9px;
  height: 1px;
  background: var(--%NS%border-strong);
}

.path[_ngcontent-%COMP%]   li.current[_ngcontent-%COMP%]   .step[_ngcontent-%COMP%] {
  border-color: var(--%NS%accent);
  background: var(--%NS%accent-soft);
}

.step.null[_ngcontent-%COMP%] {
  cursor: default;
  color: var(--%NS%text-2);
}

.step.null[_ngcontent-%COMP%]:hover {
  border-color: var(--%NS%border-strong);
  background: var(--%NS%surface);
}

.hint-inline[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
}

.step-count[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-size: 11px;
}

.deps[_ngcontent-%COMP%], 
.providers[_ngcontent-%COMP%] {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.dep[_ngcontent-%COMP%], 
.provider[_ngcontent-%COMP%] {
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%bg);
}

.dep.hit[_ngcontent-%COMP%], 
.provider.hit[_ngcontent-%COMP%] {
  border-color: var(--%NS%accent-line);
  box-shadow: 0 0 0 3px var(--%NS%accent-soft);
}

.dep-main[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.token[_ngcontent-%COMP%] {
  min-width: 0;
  color: var(--%NS%text-strong);
  font-size: 12px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.flag[_ngcontent-%COMP%] {
  padding: 0 6px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: 5px;
  color: var(--%NS%text-2);
  font-family: var(--%NS%font-mono);
  font-size: 10px;
  line-height: 16px;
}

.kind-flag[_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%accent) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%accent) 12%, transparent);
  color: var(--%NS%accent);
}

.dep-meta[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
  margin-top: 6px;
  color: var(--%NS%text-3);
  font-size: 12px;
  overflow-wrap: anywhere;
}

.from[_ngcontent-%COMP%] {
  height: 22px;
  padding: 0 8px;
  color: var(--%NS%text-2);
}

.from[_ngcontent-%COMP%]   .mono[_ngcontent-%COMP%] {
  color: var(--%NS%text);
}

.from.absent[_ngcontent-%COMP%] {
  cursor: default;
  background: none;
}

.from.missing[_ngcontent-%COMP%] {
  cursor: default;
  border-color: color-mix(in srgb, var(--%NS%warn) 40%, transparent);
  background: none;
  color: var(--%NS%warn);
}

.empty-line[_ngcontent-%COMP%] {
  margin: 0;
  color: var(--%NS%text-2);
}

.state[_ngcontent-%COMP%] {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px 16px;
  text-align: center;
  background: var(--%NS%surface);
  border: 1px dashed var(--%NS%border-strong);
  border-radius: var(--%NS%radius);
  animation: enter 0.35s var(--%NS%ease) both;
}

.state.compact[_ngcontent-%COMP%] {
  padding: 24px 12px;
  border: 0;
}

.state-title[_ngcontent-%COMP%] {
  margin: 0;
  color: var(--%NS%text-strong);
  font-size: 14px;
  font-weight: 600;
}

.state-hint[_ngcontent-%COMP%] {
  max-width: 440px;
  margin: 0;
  color: var(--%NS%text-2);
  line-height: 1.5;
}

.spinner[_ngcontent-%COMP%] {
  width: 20px;
  height: 20px;
  border: 2px solid var(--%NS%border-strong);
  border-top-color: var(--%NS%accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .spinner[_ngcontent-%COMP%] {
    animation: none;
  }
}
button[_ngcontent-%COMP%] {
  font: inherit;
}

.state[_ngcontent-%COMP%]   button[_ngcontent-%COMP%], 
.provider-group[_ngcontent-%COMP%]   button[_ngcontent-%COMP%] {
  height: 34px;
  padding: 0 14px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%surface-2);
  color: var(--%NS%text);
  cursor: pointer;
}

.state-title[_ngcontent-%COMP%]    + .state-hint[_ngcontent-%COMP%]    + button[_ngcontent-%COMP%] {
  margin-top: 8px;
}

.notice[_ngcontent-%COMP%] {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0 0 16px;
  padding: 12px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%surface);
  color: var(--%NS%text-2);
  font-size: 13px;
  line-height: 1.5;
}

.notice[_ngcontent-%COMP%]   strong[_ngcontent-%COMP%] {
  color: var(--%NS%text);
  font-weight: 600;
}

.notice[_ngcontent-%COMP%]   svg[_ngcontent-%COMP%] {
  flex: none;
  width: 16px;
  height: 16px;
  margin-top: 2px;
  fill: none;
  stroke: var(--%NS%accent);
  stroke-width: 2;
  stroke-linecap: round;
}

.source-providers[_ngcontent-%COMP%] {
  display: flex;
  flex-direction: column;
  gap: 24px;
  animation: enter 0.35s var(--%NS%ease) both;
}

.provider-group[_ngcontent-%COMP%]   h2[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 8px;
}

.section-count[_ngcontent-%COMP%] {
  padding: 0 6px;
  border-radius: 99px;
  background: var(--%NS%surface-3);
  color: var(--%NS%text-2);
  font-size: 10px;
  letter-spacing: 0;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
}

.provider-list[_ngcontent-%COMP%] {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.provider-card[_ngcontent-%COMP%] {
  min-width: 0;
  background: var(--%NS%surface);
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius-sm);
  padding: 8px 12px;
  transition: background-color 150ms var(--%NS%ease), border-color 150ms var(--%NS%ease);
}

.provider-card[_ngcontent-%COMP%]:hover {
  background: var(--%NS%surface-2);
  border-color: var(--%NS%border-strong);
}

.provider-header[_ngcontent-%COMP%] {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 4px 8px;
}

.provider-header[_ngcontent-%COMP%]   .token[_ngcontent-%COMP%] {
  font-size: 13px;
  font-weight: 600;
}

.provided-in[_ngcontent-%COMP%] {
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 99px;
  border-color: color-mix(in srgb, var(--%NS%ok) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%ok) 12%, transparent);
  color: var(--%NS%ok);
  border-width: 1px;
  border-style: solid;
}

.provider-meta[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 0 8px;
  margin-top: 4px;
  font-family: var(--%NS%font-mono);
  font-size: 11px;
  color: var(--%NS%text-3);
}

.provider-meta[_ngcontent-%COMP%]   .path[_ngcontent-%COMP%] {
  min-width: 0;
  overflow-wrap: anywhere;
}

.provider-meta[_ngcontent-%COMP%]   .as[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
}`]})},cF=`@type`,lF=new Set([`undefined`,`number`,`bigint`,`symbol`,`function`,`Date`,`RegExp`,`Error`,`Element`,`Map`,`Set`]);function uF(e){return!!e&&typeof e==`object`&&!Array.isArray(e)&&cF in e&&lF.has(e[cF])}function dF(e){return/^[A-Za-z_$][\w$]*$/.test(e)?e:JSON.stringify(e)}function fF(e,t=``){if(e===null)return`null`;if(typeof e==`string`)return JSON.stringify(e);if(typeof e!=`object`)return String(e);let n=t+`  `;if(Array.isArray(e))return e.length?`[\n${e.map(e=>n+fF(e,n)).join(`,
`)}\n${t}]`:`[]`;if(uF(e)){let r=e;switch(r[cF]){case`undefined`:return`undefined`;case`Date`:return`Date(${r.value})`;case`bigint`:return`${r.value}n`;case`symbol`:return`Symbol(${r.value})`;case`function`:return`ƒ ${r.name}()`;case`Error`:return`${r.name??`Error`}: ${r.message}`;case`Element`:return`<${r.value}>`;case`Map`:{let e=r.entries??[];if(!e.length)return`Map(${r.size}) {}`;let i=e.map(([e,t])=>`${n}${fF(e,n)} => ${fF(t,n)}`);return`Map(${r.size}) {\n${i.join(`,
`)}\n${t}}`}case`Set`:{let e=r.values??[];return e.length?`Set(${r.size}) {\n${e.map(e=>n+fF(e,n)).join(`,
`)}\n${t}}`:`Set(${r.size}) {}`}default:return String(r.value??r[cF])}}let r=Object.entries(e);return r.length?`{\n${r.map(([e,t])=>`${n}${dF(e)}: ${fF(t,n)}`).join(`,
`)}\n${t}}`:`{}`}function pF(e,t=120){let n=fF(e).replace(/\s*\n\s*/g,` `);return n.length>t?`${n.slice(0,t-1)}…`:n}var mF=[`eventDetailHeading`],hF=[`cancelButton`],gF=[`restoreButton`],_F=[`stateTree`],vF=[`latestButton`],yF=e=>({selected:e,headingLevel:5,idPrefix:`ngrx-change`}),bF=e=>({selected:e,headingLevel:3,idPrefix:`ngrx-event`}),xF=(e,t)=>t.id,SF=(e,t)=>t.seq,CF=(e,t)=>t.key,wF=(e,t)=>t.name,TF=(e,t)=>t.idsKey,EF=(e,t)=>t.path,DF=(e,t)=>t.kind,OF=(e,t)=>t.name+t.file+t.line;function kF(e,t){if(e&1){let e=W();z(0,`span`,23),J(1,`Page`),B(),z(2,`app-select`,24),G(`valueChange`,function(t){return O(e),k(K().selectPage(t))}),B()}if(e&2){let e=K();M(2),R(`options`,e.pageOptions())(`value`,e.page()?.pageId??null)}}function AF(e,t){if(e&1&&(z(0,`span`,13),J(1),B()),e&2){let e=K();M(),Y(e.liveStores().length)}}function jF(e,t){if(e&1){let e=W();z(0,`div`,14)(1,`p`,25),J(2,`Could not load the live store state.`),B(),z(3,`p`,26),J(4,`Check that the dev server with Pangular Inspector is still running.`),B(),z(5,`button`,27),G(`click`,function(){return O(e),k(K().retry())}),J(6,`Retry`),B()()}}function MF(e,t){e&1&&(z(0,`div`,15)(1,`p`,25),J(2,`No page is reporting NgRx state yet.`),B(),z(3,`p`,26),J(4,` Open the app in a browser. Stores show up here as soon as the page creates them. `),B()())}function NF(e,t){e&1&&(z(0,`p`,25),J(1,`No signal store instance on this page yet.`),B(),z(2,`p`,26),J(3,` A `),z(4,`code`),J(5,`signalStore`),B(),J(6,` is created the first time something injects it. Navigate to a page that uses the store and it appears here. `),B())}function PF(e,t){e&1&&(z(0,`p`,25),J(1,`The @ngrx/store Store was not found on this page.`),B(),z(2,`p`,26),J(3,` Check that `),z(4,`code`),J(5,`provideStore()`),B(),J(6,` or `),z(7,`code`),J(8,`StoreModule.forRoot()`),B(),J(9,` is part of the providers of the running app. `),B())}function FF(e,t){e&1&&(z(0,`p`,25),J(1,`This page has no NgRx store.`),B(),z(2,`p`,26),J(3,` Stores from `),z(4,`code`),J(5,`@ngrx/signals`),B(),J(6,` (`),z(7,`code`),J(8,`signalStore`),B(),J(9,`, `),z(10,`code`),J(11,`signalState`),B(),J(12,`) and `),z(13,`code`),J(14,`@ngrx/store`),B(),J(15,` are listed here once the app creates them. `),B())}function IF(e,t){if(e&1&&(z(0,`div`,15),P(1,NF,7,0)(2,PF,10,0)(3,FF,16,0),B()),e&2){let e=K();M(),F(e.usesSignals()?1:e.usesClassic()?2:3)}}function LF(e,t){if(e&1){let e=W();z(0,`li`)(1,`button`,31),G(`click`,function(){let t=O(e).$implicit;return k(K(2).selectStore(t.id))}),z(2,`span`,32),V(3,`span`,33),z(4,`span`,34),J(5),B()(),z(6,`span`,35),J(7),B()()()}if(e&2){let e=t.$implicit,n=K(2);M(),q(`selected`,e.id===n.store()?.id),N(`aria-pressed`,e.id===n.store()?.id),M(2),C_(`background`,n.kindColor(e.kind)),M(2),Y(e.label),M(2),X_(` `,n.kindLabel(e.kind),` · `,e.scope,` · `,n.changeCount(e.id),` `,n.changeCount(e.id)===1?`change`:`changes`,` `)}}function RF(e,t){e&1&&(z(0,`li`,29),J(1,`No stores match this filter.`),B())}function zF(e,t){if(e&1&&(z(0,`span`,39),J(1),B()),e&2){let e=t;R(`title`,e),M(),Y(e)}}function BF(e,t){if(e&1&&(z(0,`span`,38),J(1),B()),e&2){let e=K();M(),Y(e.classic.devtools?`Store DevTools on`:`Store DevTools off`)}}function VF(e,t){if(e&1&&(z(0,`code`),J(1),B(),J(2)),e&2){let e=t.$implicit,n=t.$index,r=t.$count;M(),Y(e),M(),X(``,n===r-1?``:`, `,` `)}}function HF(e,t){if(e&1&&(z(0,`p`,40),J(1,` Referenced by `),I(2,VF,3,2,null,null,wg),B()),e&2){let e=K();M(2),L(e.signal.references)}}function UF(e,t){if(e&1&&(z(0,`p`,54),J(1),B()),e&2){let e=K(4);M(),Y(e.restoreOff)}}function WF(e,t){if(e&1){let e=W();z(0,`div`,41)(1,`p`)(2,`strong`),J(3,`Viewing a past state.`),B(),J(4,` New actions are logged but do not change the state until you go back to the latest state. `),B(),z(5,`button`,53,2),G(`click`,function(){return O(e),k(K(3).backToLatest())}),J(7,` Back to latest `),B(),P(8,UF,2,1,`p`,54),B()}if(e&2){let e=K(3);M(5),R(`disabled`,e.busy()||!e.canRestore()),N(`aria-describedby`,e.canRestore()?null:`store-latest-off`),M(3),F(e.canRestore()?-1:8)}}function GF(e,t){if(e&1&&(z(0,`dt`),J(1),B(),z(2,`dd`)(3,`code`,62),J(4),B()()),e&2){let e=t.$implicit;M(),Y(e.key),M(2),R(`title`,e.full),M(),Y(e.value)}}function KF(e,t){if(e&1&&(z(0,`dl`,57),I(1,GF,5,3,null,null,CF),B()),e&2){let e=K(4);M(),L(e.computedEntries())}}function qF(e,t){e&1&&(z(0,`p`,58),J(1,`No computed signals.`),B())}function JF(e,t){e&1&&(z(0,`span`,64),J(1,`signalMethod`),B())}function YF(e,t){e&1&&(z(0,`span`,64),J(1,`rxMethod`),B())}function XF(e,t){if(e&1&&(z(0,`li`,63),J(1),P(2,JF,2,0,`span`,64)(3,YF,2,0,`span`,64),z(4,`span`,65),J(5),B()()),e&2){let e=t.$implicit,n=K(5);M(),X(` `,e.name,` `),M(),F(e.signalMethod?2:e.rx?3:-1),M(3),Y_(``,e.calls,` `,e.calls===1?`call`:`calls`,``,n.methodDuration(e))}}function ZF(e,t){if(e&1&&(z(0,`ul`,60),I(1,XF,6,5,`li`,63,wF),B()),e&2){let e=K();M(),L(e.methods)}}function QF(e,t){e&1&&(z(0,`p`,58),J(1,`No methods.`),B())}function $F(e,t){if(e&1&&(z(0,`li`,63),J(1),B()),e&2){let e=t.$implicit;M(),Y(e)}}function eI(e,t){if(e&1&&(z(0,`li`,72),J(1),B()),e&2){let e=K().$implicit;R(`title`,K(5).entityOverflowTitle(e.ids,e.count)),M(),X(` +`,e.count-30,` more `)}}function tI(e,t){if(e&1&&(z(0,`code`,62),J(1),B()),e&2){let e=K(2).$implicit,t=K(5);R(`title`,t.prettyText(e.selected)),M(),Y(t.shortText(e.selected))}}function nI(e,t){e&1&&(z(0,`span`,58),J(1,`None selected`),B())}function rI(e,t){if(e&1&&(z(0,`dl`,57)(1,`dt`),J(2,`Selected`),B(),z(3,`dd`),P(4,tI,2,2,`code`,62)(5,nI,2,0,`span`,58),B()()),e&2){let e=K().$implicit;M(4),F(e.selected===void 0?5:4)}}function iI(e,t){if(e&1&&(z(0,`div`,68)(1,`div`,69)(2,`span`,63),J(3),B(),z(4,`span`,70),J(5),B()(),z(6,`ul`,71),I(7,$F,2,1,`li`,63,wg),P(9,eI,2,2,`li`,72),B(),P(10,rI,6,1,`dl`,57),B()),e&2){let e=t.$implicit,n=K(5);M(3),Y(e.collection??`entities`),M(2),Z(``,e.count,` `,e.count===1?`entity`:`entities`),M(),N(`aria-label`,(e.collection??`entities`)+` ids`),M(),L(n.entityIds(e.ids)),M(2),F(e.count>30?9:-1),M(),F(e.selectedId===void 0?-1:10)}}function aI(e,t){if(e&1&&(z(0,`section`,61)(1,`h4`,66),J(2,`Entities`),B(),z(3,`div`,67),I(4,iI,11,6,`div`,68,TF),B()()),e&2){let e=K();M(4),L(e.entities)}}function oI(e,t){if(e&1&&(z(0,`section`,55)(1,`h4`,56),J(2,`Computed`),B(),P(3,KF,3,0,`dl`,57)(4,qF,2,0,`p`,58),z(5,`h4`,59),J(6,`Methods`),B(),P(7,ZF,3,0,`ul`,60)(8,QF,2,0,`p`,58),B(),P(9,aI,6,0,`section`,61)),e&2){let e=t,n=K(3);M(3),F(n.computedEntries().length?3:4),M(4),F(e.methods.length?7:8),M(2),F(e.entities?.length?9:-1)}}function sI(e,t){if(e&1&&(z(0,`span`,77),J(1),B()),e&2){let e=t;R(`title`,`Caused by `+K(4).kindLabel(`event`)+`: `+e.type),M(),Y(e.type)}}function cI(e,t){if(e&1&&(z(0,`span`,64),J(1),B()),e&2){let e=K().$implicit;M(),Y(e.origin)}}function lI(e,t){if(e&1&&J(0),e&2){let e=K().$implicit;X(` · `,K(3).formatDuration(e.durationMs),` `)}}function uI(e,t){if(e&1){let e=W();z(0,`li`)(1,`button`,73),G(`click`,function(){let t=O(e).$implicit;return k(K(3).selectChange(t.seq))}),z(2,`span`,74),J(3),B(),z(4,`span`,75)(5,`span`,76),J(6),B(),P(7,sI,2,2,`span`,77),B(),z(8,`span`,78),P(9,cI,2,1,`span`,64),J(10),P(11,lI,1,1),B()()()}if(e&2){let e,n=t.$implicit,r=K(3);M(),q(`selected`,n.seq===r.selectedChangeSeq()),N(`aria-pressed`,n.seq===r.selectedChangeSeq())(`aria-controls`,n.seq===r.selectedChangeSeq()?`ngrx-change-detail`:null),M(2),X(`#`,n.seq),M(2),R(`title`,n.type),M(),Y(n.type),M(),F((e=n.causedByEvent)?7:-1,e),M(2),F(n.origin?9:-1),M(),Z(` `,n.diff.length===0?`no change`:n.diff.length+(n.diff.length===1?` change`:` changes`),` · `,r.formatTime(n.timestamp),` `),M(),F(n.durationMs===void 0?-1:11)}}function dI(e,t){e&1&&J(0,` No entries match this filter. `)}function fI(e,t){e&1&&J(0,` No actions dispatched since the page connected. `)}function pI(e,t){e&1&&J(0,` No state changes yet. Method calls and patchState writes that change the state are recorded here. `)}function mI(e,t){if(e&1&&(z(0,`li`,29),P(1,dI,1,0)(2,fI,1,0)(3,pI,1,0),B()),e&2){let e=K(),t=K(2);M(),F(t.filter()?1:e.classic?2:3)}}function hI(e,t){if(e&1&&(z(0,`div`,51),zg(1,79),B()),e&2){K(3);let e=n_(19);M(),R(`ngTemplateOutlet`,e)(`ngTemplateOutletContext`,sv(2,yF,t))}}function gI(e,t){if(e&1&&V(0,`option`,84),e&2){let e=t.$implicit;R(`value`,e)}}function _I(e,t){if(e&1&&(z(0,`p`,90),J(1),B()),e&2){let e=K(4);M(),Y(e.restoreOff)}}function vI(e,t){if(e&1){let e=W();z(0,`section`,52)(1,`h4`,80),J(2,`Dispatch an action`),B(),z(3,`form`,81),G(`submit`,function(t){return O(e),k(K(3).dispatchAction(t))}),z(4,`label`)(5,`span`),J(6,`Type`),B(),z(7,`input`,82),G(`input`,function(t){return O(e),k(K(3).dispatchType.set(t.target.value))}),B()(),z(8,`datalist`,83),I(9,gI,1,1,`option`,84,wg),B(),z(11,`label`)(12,`span`),J(13,`Payload `),z(14,`span`,85),J(15,`(JSON object, optional)`),B()(),z(16,`textarea`,86),G(`input`,function(t){return O(e),k(K(3).dispatchPayload.set(t.target.value))}),B()(),z(17,`p`,87),J(18),B(),z(19,`div`,88)(20,`button`,89),J(21,` Dispatch `),B()(),P(22,_I,2,1,`p`,90),B()()}if(e&2){let e=K(3);M(7),R(`value`,e.dispatchType()),M(2),L(e.actionTypes()),M(7),R(`value`,e.dispatchPayload()),N(`aria-invalid`,e.payloadError()?`true`:null),M(2),Y(e.payloadError()),M(2),R(`disabled`,e.busy()||!e.canRestore()||!e.dispatchRequest()),N(`aria-describedby`,e.canRestore()?null:`store-dispatch-off`),M(2),F(e.canRestore()?-1:22)}}function yI(e,t){if(e&1&&(z(0,`div`,30)(1,`div`,36)(2,`h3`),J(3),B(),z(4,`div`,37)(5,`span`,38),J(6),B(),z(7,`span`,38),J(8),B(),P(9,zF,2,2,`span`,39),P(10,BF,2,1,`span`,38),B(),P(11,HF,4,0,`p`,40),B(),P(12,WF,9,3,`div`,41),z(13,`div`,42)(14,`section`,43)(15,`h4`,44),J(16,`State`),B(),z(17,`pre`,45,1),J(19),B()(),P(20,oI,10,3),B(),z(21,`section`,46)(22,`h4`,47),J(23),z(24,`span`,13),J(25),B()(),V(26,`app-limit-note`,48),z(27,`div`,49)(28,`ul`,50),I(29,uI,12,12,`li`,null,SF,!1,mI,4,1,`li`,29),B(),P(32,hI,2,4,`div`,51),B()(),P(33,vI,23,7,`section`,52),B()),e&2){let e,n,r,i=t,a=K(2);M(3),Y(i.label),M(3),Y(a.kindLabel(i.kind)),M(2),X(`scope: `,i.scope),M(),F((e=i.signal?.declaredIn)?9:-1,e),M(),F(i.classic?10:-1),M(),F(i.signal?.references?.length?11:-1),M(),F(i.classic?.paused?12:-1),M(7),Y(a.stateText()),M(),F((n=i.signal)?20:-1,n),M(3),X(` `,i.classic?`Action log`:`Change log`,` `),M(2),Y(a.storeLog().length),M(),R(`dropped`,a.page()?.dropped??0)(`max`,a.maxLog()),M(2),N(`aria-label`,i.classic?`Actions`:`Changes`),M(),L(a.storeLog()),M(3),F((r=a.changeEntry())?32:-1,r),M(),F(i.classic?33:-1)}}function bI(e,t){if(e&1&&(z(0,`div`,16)(1,`ul`,28),I(2,LF,8,10,`li`,null,xF,!1,RF,2,0,`li`,29),B(),P(5,yI,34,17,`div`,30),B()),e&2){let e,t=K();M(2),L(t.filteredStores()),M(3),F((e=t.store())?5:-1,e)}}function xI(e,t){if(e&1&&(z(0,`code`,97),J(1),B()),e&2){let e=K().$implicit,t=K(2);R(`title`,t.prettyText(e.payload)),M(),Y(t.shortText(e.payload))}}function SI(e,t){if(e&1){let e=W();z(0,`li`)(1,`button`,95),G(`click`,function(){let t=O(e).$implicit;return k(K(2).selectEvent(t.seq))}),V(2,`span`,33),z(3,`span`,96),J(4),B(),P(5,xI,2,2,`code`,97),z(6,`span`,98),J(7),B()()()}if(e&2){let e=t.$implicit,n=K(2);M(),q(`selected`,e.seq===n.selectedEventSeq()),N(`aria-pressed`,e.seq===n.selectedEventSeq())(`aria-controls`,e.seq===n.selectedEventSeq()?`ngrx-event-detail`:null),M(),C_(`background`,n.kindColor(`event`)),M(),R(`title`,e.eventType??e.type),M(),Y(e.eventType??e.type),M(),F(e.payload===void 0?-1:5),M(2),Y(n.formatTime(e.timestamp))}}function CI(e,t){e&1&&(z(0,`li`,29),J(1,`No events match this filter.`),B())}function wI(e,t){if(e&1&&(z(0,`div`,94,3),zg(2,79),B()),e&2){K(2);let e=n_(19);M(2),R(`ngTemplateOutlet`,e)(`ngTemplateOutletContext`,sv(2,bF,t))}}function TI(e,t){if(e&1&&(z(0,`section`,18)(1,`div`,11)(2,`h2`,91),J(3,`Events`),B(),z(4,`span`,13),J(5),B()(),z(6,`p`,92),J(7,` Events dispatched through @ngrx/signals/events, across every store on this page. `),B(),z(8,`ul`,93),I(9,SI,8,10,`li`,null,SF,!1,CI,2,0,`li`,29),B(),P(12,wI,3,4,`div`,94),B()),e&2){let e,t=K();M(5),Y(t.pageEvents().length),M(4),L(t.pageEvents()),M(3),F((e=t.eventEntry())?12:-1,e)}}function EI(e,t){if(e&1&&(z(0,`dt`),J(1,`Origin`),B(),z(2,`dd`),J(3),B()),e&2){let e=K().selected,t=K();M(3),Y(t.originText(e.origin))}}function DI(e,t){if(e&1&&(z(0,`dt`),J(1,`Duration`),B(),z(2,`dd`),J(3),B()),e&2){let e=K().selected,t=K();M(3),Y(t.formatDuration(e.durationMs))}}function OI(e,t){if(e&1&&(z(0,`dt`),J(1,`Action`),B(),z(2,`dd`)(3,`pre`,103),J(4),B()()),e&2){let e=K().selected,t=K();M(4),Y(t.prettyText(e.action))}}function kI(e,t){if(e&1&&(z(0,`dt`),J(1,`Arguments`),B(),z(2,`dd`)(3,`pre`,103),J(4),B()()),e&2){let e=K().selected,t=K();M(4),Y(t.prettyText(e.args))}}function AI(e,t){if(e&1&&(z(0,`dt`),J(1,`Payload`),B(),z(2,`dd`)(3,`pre`,103),J(4),B()()),e&2){let e=K().selected,t=K();M(4),Y(t.prettyText(e.payload))}}function jI(e,t){if(e&1&&(z(0,`pre`,103),J(1),B()),e&2){let e=K(),t=K(2);M(),Y(t.prettyText(e.payload))}}function MI(e,t){if(e&1&&(z(0,`dt`),J(1,`Caused by event`),B(),z(2,`dd`)(3,`code`,104),J(4),B(),P(5,jI,2,1,`pre`,103),B()),e&2){let e=t;M(4),Y(e.type),M(),F(e.payload===void 0?-1:5)}}function NI(e,t){if(e&1&&(z(0,`code`,111),J(1),B()),e&2){let e=K().$implicit,t=K(4);M(),Y(t.shortText(e.before))}}function PI(e,t){e&1&&(z(0,`span`,113),J(1,`→`),B(),z(2,`span`,114),J(3,`became`),B())}function FI(e,t){if(e&1&&(z(0,`code`,112),J(1),B()),e&2){let e=K().$implicit,t=K(4);M(),Y(t.shortText(e.after))}}function II(e,t){if(e&1&&(z(0,`li`)(1,`span`,108),J(2),B(),z(3,`code`,109),J(4),B(),z(5,`span`,110),P(6,NI,2,1,`code`,111),P(7,PI,4,0),P(8,FI,2,1,`code`,112),B()()),e&2){let e=t.$implicit,n=K(4);w_(`diff-row `+e.op),M(2),Y(n.opLabel(e.op)),M(2),Y(e.path),M(2),F(e.op===`add`?-1:6),M(),F(e.op===`change`?7:-1),M(),F(e.op===`remove`?-1:8)}}function LI(e,t){if(e&1&&(z(0,`ul`,106),I(1,II,9,7,`li`,107,EF),B()),e&2){let e=K(2).selected;M(),L(e.diff)}}function RI(e,t){e&1&&(z(0,`p`,58),J(1,`The state did not change.`),B())}function zI(e,t){if(e&1&&(z(0,`div`,105),J(1,`State diff`),B(),P(2,LI,3,0,`ul`,106)(3,RI,2,0,`p`,58)),e&2){let e=K(),t=e.selected,n=e.headingLevel;N(`aria-level`,n+1),M(2),F(t.diff.length?2:3)}}function BI(e,t){if(e&1&&J(0),e&2){let e=K(2).selected;X(` Store DevTools jumps the app state to the state right after action #`,e.seq,`. Until you go back to the latest state, new actions are logged but do not change the state. `)}}function VI(e,t){if(e&1&&J(0),e&2){let e=K(3).selected;Z(` This sets every state key of `,t.label,` back to its value right after change #`,e.seq,`. Components that read the store update at once, and a new "Restore" entry is added to the log. `)}}function HI(e,t){if(e&1&&J(0),e&2){let e=K(3).selected;X(` This sets every state key of the store back to its value right after change #`,e.seq,`. Components that read the store update at once, and a new "Restore" entry is added to the log. `)}}function UI(e,t){if(e&1&&P(0,VI,1,2)(1,HI,1,1),e&2){let e;F((e=K(3).store())?0:1,e)}}function WI(e,t){if(e&1){let e=W();z(0,`div`,115),G(`keydown.escape`,function(t){return O(e),k(K(2).cancelRestore(t))}),z(1,`p`,116),P(2,BI,1,1)(3,UI,2,1),B(),z(4,`div`,88)(5,`button`,53),G(`click`,function(){O(e);let t=K().selected;return k(K().restore(t.seq,t.source===`store`))}),J(6,` Restore `),B(),z(7,`button`,27,4),G(`click`,function(){return O(e),k(K(2).cancelRestore())}),J(9,` Cancel `),B()()()}if(e&2){let e=K(),t=e.selected,n=e.idPrefix,r=K();N(`aria-labelledby`,n+`-confirm-text`),M(),R(`id`,n+`-confirm-text`),M(),F(t.source===`store`?2:3),M(3),R(`disabled`,r.busy())}}function GI(e,t){if(e&1){let e=W();z(0,`button`,121,5),G(`click`,function(){O(e);let t=K(2).selected;return k(K().askRestore(t.seq))}),J(2,` Restore this state `),B()}if(e&2){let e=K(2).idPrefix,t=K();R(`disabled`,!t.canRestore()),N(`aria-describedby`,t.canRestore()?null:e+`-writes-off`)}}function KI(e,t){if(e&1){let e=W();z(0,`button`,122),G(`click`,function(){O(e);let t=K(2).selected;return k(K().dispatchAgain(t.seq))}),J(1,` Dispatch again `),B()}if(e&2){let e=K(2).idPrefix,t=K();R(`disabled`,t.busy()||!t.canRestore()),N(`aria-describedby`,t.canRestore()?null:e+`-writes-off`)}}function qI(e,t){if(e&1&&(z(0,`p`,120),J(1),B()),e&2){let e=K(2).idPrefix,t=K();R(`id`,e+`-writes-off`),M(),Y(t.restoreOff)}}function JI(e,t){if(e&1&&(z(0,`div`,117),P(1,GI,3,2,`button`,118),P(2,KI,2,2,`button`,119),B(),P(3,qI,2,2,`p`,120)),e&2){let e=K().selected,t=K();M(),F(e.restorable?1:-1),M(),F(t.canAgain(e)?2:-1),M(),F(t.canRestore()?-1:3)}}function YI(e,t){e&1&&(J(0,` Store DevTools no longer holds this action, so this state cannot be restored. It was dropped past `),z(1,`code`),J(2,`maxAge`),B(),J(3,`, or the Store DevTools history was committed, reset or imported. `))}function XI(e,t){e&1&&(J(0,` Store DevTools never recorded this action, so this state cannot be restored. An `),z(1,`code`),J(2,`actionsBlocklist`),B(),J(3,`, `),z(4,`code`),J(5,`actionsSafelist`),B(),J(6,` or `),z(7,`code`),J(8,`predicate`),B(),J(9,` option filtered it out, or recording was paused. `))}function ZI(e,t){e&1&&(J(0,` Time travel for @ngrx/store needs `),z(1,`code`),J(2,`provideStoreDevtools()`),B(),J(3,`. Without it, entries cannot be restored. `))}function QI(e,t){if(e&1&&(z(0,`p`,102),P(1,YI,4,0)(2,XI,10,0)(3,ZI,4,0),B()),e&2){let e=K().selected;M(),F(e.unrestorable===`dropped`?1:e.unrestorable===`not-recorded`?2:3)}}function $I(e,t){if(e&1&&(z(0,`section`,99)(1,`div`,100),J(2),B(),z(3,`dl`,57)(4,`dt`),J(5,`Time`),B(),z(6,`dd`),J(7),B(),P(8,EI,4,1),P(9,DI,4,1),P(10,OI,5,1),P(11,kI,5,1),P(12,AI,5,1),P(13,MI,6,2),B(),P(14,zI,4,2),P(15,WI,10,4,`div`,101),P(16,JI,4,3),P(17,QI,4,1,`p`,102),B()),e&2){let e,n=t.selected,r=t.headingLevel,i=t.idPrefix,a=K();N(`aria-labelledby`,i+`-entry-heading`),M(),R(`id`,i+`-entry-heading`),N(`aria-level`,r),M(),Z(` #`,n.seq,` `,n.type,` `),M(5),Y(a.formatTime(n.timestamp)),M(),F(n.origin?8:-1),M(),F(n.durationMs===void 0?-1:9),M(),F(n.action===void 0?-1:10),M(),F(n.args?.length?11:-1),M(),F(n.source===`event`&&n.payload!==void 0?12:-1),M(),F((e=n.causedByEvent)?13:-1,e),M(),F(n.source===`event`?-1:14),M(),F(n.restorable&&a.confirmSeq()===n.seq?15:-1),M(),F(a.confirmSeq()!==n.seq&&(n.restorable||a.canAgain(n))?16:-1),M(),F(!n.restorable&&n.source===`store`?17:-1)}}function eL(e,t){if(e&1&&(z(0,`span`,13),J(1),B()),e&2){let e=K();M(),Y(e.sourceEntries().length)}}function tL(e,t){e&1&&(z(0,`div`,21),V(1,`span`,123),z(2,`p`,25),J(3,`Scanning source for NgRx declarations…`),B()())}function nL(e,t){e&1&&(z(0,`div`,22)(1,`p`,25),J(2,`No NgRx declarations found in source.`),B(),z(3,`p`,26),J(4,` The scan looks for `),z(5,`code`),J(6,`signalStore`),B(),J(7,`, `),z(8,`code`),J(9,`signalState`),B(),J(10,`, `),z(11,`code`),J(12,`signalMethod`),B(),J(13,`, `),z(14,`code`),J(15,`createAction`),B(),J(16,`, `),z(17,`code`),J(18,`createReducer`),B(),J(19,`, `),z(20,`code`),J(21,`createEffect`),B(),J(22,`, `),z(23,`code`),J(24,`createSelector`),B(),J(25,` and `),z(26,`code`),J(27,`createFeature`),B(),J(28,`. `),B()())}function rL(e,t){if(e&1){let e=W();z(0,`button`,125),G(`click`,function(){let t=O(e).$implicit,n=K(2);return k(n.kind.set(n.kind()===t.kind?null:t.kind))}),V(1,`span`,33),z(2,`span`,130),J(3),B(),z(4,`span`,126),J(5),B()()}if(e&2){let e=t.$implicit,n=K(2);q(`active`,n.kind()===e.kind),N(`aria-pressed`,n.kind()===e.kind),M(),C_(`background`,n.kindColor(e.kind)),M(2),Y(n.kindLabel(e.kind)),M(2),Y(e.count)}}function iL(e,t){if(e&1&&(z(0,`p`,135),J(1),B()),e&2){let e=K().$implicit;M(),Y(e.detail)}}function aL(e,t){if(e&1&&(z(0,`li`,129)(1,`div`,131),V(2,`span`,33),z(3,`span`,132),J(4),B(),z(5,`span`,38),J(6),B()(),z(7,`div`,133)(8,`span`,134),J(9),B()(),P(10,iL,2,1,`p`,135),B()),e&2){let e=t.$implicit,n=K(2);M(2),C_(`background`,n.kindColor(e.kind)),M(2),Y(e.name),M(2),Y(n.kindLabel(e.kind)),M(2),R(`title`,e.file+`:`+e.line),M(),Z(``,e.file,`:`,e.line),M(),F(e.detail?10:-1)}}function oL(e,t){if(e&1){let e=W();z(0,`li`)(1,`div`,21)(2,`p`,25),J(3,`No declarations match.`),B(),z(4,`button`,27),G(`click`,function(){return O(e),k(K(2).clearFilters())}),J(5,`Clear filters`),B()()()}}function sL(e,t){if(e&1){let e=W();z(0,`div`,124)(1,`button`,125),G(`click`,function(){return O(e),k(K().kind.set(null))}),J(2,` All `),z(3,`span`,126),J(4),B()(),I(5,rL,6,7,`button`,127,DF),B(),z(7,`ul`,128),I(8,aL,11,8,`li`,129,OF,!1,oL,6,0,`li`),B()}if(e&2){let e=K();M(),q(`active`,!e.kind()),N(`aria-pressed`,!e.kind()),M(3),Y(e.sourceEntries().length),M(),L(e.groupedEntries()),M(3),L(e.filteredEntries())}}var cL={action:`#f59e0b`,reducer:`#a78bfa`,effect:`#fb923c`,selector:`#60a5fa`,feature:`#34d399`,"store-setup":`#94a3b8`,"signal-store":`#e879f9`,"signal-state":`#22d3ee`,"signal-method":`#fb7185`,store:`#a78bfa`,event:`var(--warn)`},lL={"signal-store":`signalStore`,"signal-state":`signalState`,"signal-method":`signalMethod`,"store-setup":`store setup`,store:`@ngrx/store`,event:`event`},uL={dispatch:`store.dispatch(action)`,effect:`NgRx effect (Store.next)`,reactive:`store.dispatch(() => action)`};function dL(e){if(!e.trim())return{};let t;try{t=JSON.parse(e)}catch{return{error:`The payload is not valid JSON.`}}return!t||typeof t!=`object`||Array.isArray(t)?{error:`The payload must be a JSON object, like {"id": 7}.`}:Object.prototype.hasOwnProperty.call(t,`type`)?{error:`The payload cannot have a "type" key. Put the action type in the Type field.`}:{payload:t}}var fL=new Set([`action`,`reducer`,`effect`,`selector`,`feature`,`store-setup`]),pL=class e{rpc=$(null);canRestore=Q(()=>cE(this.rpc(),`ngrx`));restoreOff=GT(`ngrx`);filter=j(``);kind=j(null);sourceEntries=j([]);sourceLoaded=j(!1);pages=j([]);failed=j(!1);selectedPageId=j(null);hostPageId=$T();maxLog=Q(()=>sE(this.rpc()).limits.changeLog);selectedStoreId=j(null);selectedChangeSeq=j(null);selectedEventSeq=j(null);focusEventSeq=j(null);confirmSeq=j(null);eventDetailHeading=Rv(`eventDetailHeading`);busy=j(!1);focusLatest=j(!1);focusConfirm=j(null);cancelButton=Rv(`cancelButton`);restoreButton=Rv(`restoreButton`);stateTree=Rv(`stateTree`);latestButton=Rv(`latestButton`);message=j(``);destroyRef=E(Cs);unsubscribe=null;page=Q(()=>{let e=this.pages();return e.find(e=>e.pageId===this.selectedPageId())??e.find(e=>e.pageId===this.hostPageId)??e[0]??null});pageOptions=Q(()=>this.pages().map(e=>({value:e.pageId,label:e.title||e.url,hint:e.url})));liveStores=Q(()=>{let e=this.page();if(!e)return[];let t=e.stores.map(e=>({id:e.id,label:e.name??e.references[0]??e.className,kind:e.kind,scope:e.scope,signal:e}));return e.classic&&t.push({id:`store`,label:`Store`,kind:`store`,scope:e.classic.scope,classic:e.classic}),t});filteredStores=Q(()=>{let e=this.filter().trim().toLowerCase();return e?this.liveStores().filter(t=>t.label.toLowerCase().includes(e)||t.kind.includes(e)||(t.signal?.stateKeys??[]).some(t=>t.toLowerCase().includes(e))||(this.page()?.log??[]).some(n=>n.storeId===t.id&&n.type.toLowerCase().includes(e))):this.liveStores()});store=Q(()=>{let e=this.liveStores();return e.find(e=>e.id===this.selectedStoreId())??e[0]??null});stateText=Q(()=>{let e=this.store();return e?fF(e.signal?e.signal.state:e.classic?.state):``});computedEntries=Q(()=>Object.entries(this.store()?.signal?.computed??{}).map(([e,t])=>({key:e,value:pF(t,160),full:fF(t)})));storeLog=Q(()=>{let e=this.store()?.id,t=this.filter().trim().toLowerCase();return(this.page()?.log??[]).filter(n=>n.storeId===e&&(!t||n.type.toLowerCase().includes(t)||this.storeMatches(t))).reverse()});hasEvents=Q(()=>(this.page()?.log??[]).some(e=>e.source===`event`));pageEvents=Q(()=>{let e=this.filter().trim().toLowerCase();return(this.page()?.log??[]).filter(t=>t.source===`event`&&(!e||t.type.toLowerCase().includes(e))).slice().reverse()});changeEntry=Q(()=>{let e=this.selectedChangeSeq();return e===null?null:this.storeLog().find(t=>t.seq===e)??null});eventEntry=Q(()=>{let e=this.selectedEventSeq();return e===null?null:this.pageEvents().find(t=>t.seq===e)??null});dispatchType=j(``);dispatchPayload=j(``);actionTypes=Q(()=>{let e=new Set;for(let t of this.sourceEntries())for(let n of t.types??[])e.add(n);for(let t of this.page()?.log??[])t.source===`store`&&t.action!==void 0&&e.add(t.type);return[...e].sort().slice(0,200)});payloadError=Q(()=>dL(this.dispatchPayload()).error??``);dispatchRequest=Q(()=>{let e=this.dispatchType().trim(),{payload:t,error:n}=dL(this.dispatchPayload());return!e||n?null:{type:`dispatch`,action:e,...t?{payload:t}:{}}});usesSignals=Q(()=>this.sourceEntries().some(e=>e.kind===`signal-store`||e.kind===`signal-state`));usesClassic=Q(()=>this.sourceEntries().some(e=>fL.has(e.kind)));filteredEntries=Q(()=>{let e=this.filter().trim().toLowerCase(),t=this.kind();return this.sourceEntries().filter(n=>(!t||n.kind===t)&&(!e||n.name.toLowerCase().includes(e)||n.kind.includes(e)||(n.detail??``).toLowerCase().includes(e)))});groupedEntries=Q(()=>{let e=new Map;for(let t of this.sourceEntries())e.set(t.kind,(e.get(t.kind)??0)+1);return[...e.entries()].map(([e,t])=>({kind:e,count:t}))});constructor(){uc(()=>{let e=this.rpc();e&&this.load(e)}),ey(()=>{let e=this.latestButton();e&&this.focusLatest()&&!this.busy()&&(this.focusLatest.set(!1),e.nativeElement.focus())}),uc(()=>{let e=this.focusConfirm(),t=e===`cancel`?this.cancelButton():this.restoreButton();e&&t&&(this.focusConfirm.set(null),t.nativeElement.focus())}),ey(()=>{let e=this.focusEventSeq(),t=this.eventDetailHeading();e!==null&&t&&(this.focusEventSeq.set(null),t.nativeElement.focus())}),this.destroyRef.onDestroy(()=>this.unsubscribe?.())}storeMatches(e){let t=this.store();return!!t&&t.label.toLowerCase().includes(e)}async load(e){this.failed.set(!1),rE(e,`get-ngrx-store`).then(e=>this.sourceEntries.set(Array.isArray(e)?e:[])).catch(()=>this.sourceEntries.set([])).finally(()=>this.sourceLoaded.set(!0));try{let t=await e.scope(`pangular`).rpc.sharedState(`ngrx-store`);if(this.destroyRef.destroyed)return;let n=e=>{let t=e;this.pages.set(Array.isArray(t?.pages)?t.pages:[])};n(t.value()),this.unsubscribe?.(),this.unsubscribe=t.on(`updated`,n)}catch{this.failed.set(!0)}}retry(){let e=this.rpc();e&&this.load(e)}selectPage(e){this.selectedPageId.set(e),this.selectedStoreId.set(null),this.selectedChangeSeq.set(null),this.selectedEventSeq.set(null),this.confirmSeq.set(null),this.message.set(``)}selectStore(e){this.selectedStoreId.set(e),this.selectedChangeSeq.set(null),this.confirmSeq.set(null),this.message.set(``)}selectChange(e){this.selectedChangeSeq.set(this.selectedChangeSeq()===e?null:e),this.confirmSeq.set(null),this.message.set(``)}askRestore(e){this.confirmSeq.set(e),this.focusConfirm.set(`cancel`)}cancelRestore(e){e?.preventDefault(),this.confirmSeq.set(null),this.focusConfirm.set(`restore`)}async restore(e,t){let n=this.page();if(!n)return;this.busy.set(!0),this.focusLatest.set(!1);let r=!1;try{let i=await rE(this.rpc(),`request-ngrx-action`,{pageId:n.pageId,request:{type:`restore`,seq:e}});this.message.set(i?.error??i?.message??`Restored.`),r=t&&!i?.error&&!!i?.paused}catch{this.message.set(`Could not reach the page to restore the state.`)}finally{this.busy.set(!1),this.confirmSeq.set(null),this.focusLatest.set(r),r||this.stateTree()?.nativeElement.focus()}}selectEvent(e){let t=this.selectedEventSeq()===e?null:e;this.selectedEventSeq.set(t),t!==null&&this.focusEventSeq.set(t)}async backToLatest(){let e=this.page();if(e){this.busy.set(!0);try{let t=await rE(this.rpc(),`request-ngrx-action`,{pageId:e.pageId,request:{type:`latest`}});this.focusLatest.set(!1),this.stateTree()?.nativeElement.focus(),this.message.set(t?.error??t?.message??`Back on the latest state.`)}catch{this.message.set(`Could not reach the page to go back to the latest state.`)}finally{this.busy.set(!1)}}}canAgain(e){return e.source===`store`&&e.action!==void 0}async dispatchAction(e){e.preventDefault();let t=this.dispatchRequest();t&&await this.send(t,`Could not reach the page to dispatch the action.`)}dispatchAgain(e){return this.send({type:`dispatch-again`,seq:e},`Could not reach the page to dispatch the action again.`)}async send(e,t){let n=this.page();if(n&&!this.busy()){this.busy.set(!0);try{let t=await rE(this.rpc(),`request-ngrx-action`,{pageId:n.pageId,request:e});this.message.set(t?.error??t?.message??`Dispatched.`),t?.entry&&(this.selectedStoreId.set(`store`),this.selectedChangeSeq.set(t.entry.seq))}catch{this.message.set(t)}finally{this.busy.set(!1)}}}clearFilters(){this.filter.set(``),this.kind.set(null)}changeCount(e){return(this.page()?.log??[]).filter(t=>t.storeId===e).length}entityIds(e){return e.slice(0,30)}entityOverflowTitle(e,t){let n=e.slice(30).join(`, `);return t>e.length?`${n} (first ${e.length} of ${t} shown)`:n}kindColor(e){return cL[e]??`var(--text-3)`}kindLabel(e){return lL[e]??e}originText(e){return uL[e]??e}opLabel(e){return e===`add`?`added`:e===`remove`?`removed`:`changed`}prettyText(e){return fF(e)}shortText(e){return pF(e)}formatTime=SD;formatDuration(e){return e<=0?`<1ms`:`${Math.round(e)}ms`}methodDuration(e){let t=[];return e.avgDurationMs!==void 0&&t.push(`avg ${this.formatDuration(e.avgDurationMs)}`),e.lastDurationMs!==void 0&&t.push(`last ${this.formatDuration(e.lastDurationMs)}`),t.length?` · ${t.join(` · `)}`:``}static ɵfac=function(t){return new(t||e)};static ɵcmp=Bh({type:e,selectors:[[`app-store-inspector`]],viewQuery:function(e,t){e&1&&e_(t.eventDetailHeading,mF,5)(t.cancelButton,hF,5)(t.restoreButton,gF,5)(t.stateTree,_F,5)(t.latestButton,vF,5),e&2&&t_(5)},inputs:{rpc:[1,`rpc`]},decls:28,vars:11,consts:[[`entryDetailTpl`,``],[`stateTree`,``],[`latestButton`,``],[`eventDetailHeading`,``],[`cancelButton`,``],[`restoreButton`,``],[1,`toolbar`],[`type`,`search`,`placeholder`,`Filter stores, changes and declarations…`,`aria-label`,`Filter stores, changes and source declarations`,3,`input`,`value`],[1,`status`],[`aria-hidden`,`true`,1,`live-dot`],[`aria-labelledby`,`ngrx-live-heading`,1,`block`],[1,`section-head`],[`id`,`ngrx-live-heading`],[1,`pill`],[`role`,`alert`,1,`empty`],[1,`empty`],[1,`live-layout`],[`role`,`status`,1,`message`],[`aria-labelledby`,`ngrx-events-heading`,1,`block`],[`aria-labelledby`,`ngrx-source-heading`,1,`block`],[`id`,`ngrx-source-heading`],[`role`,`status`,1,`empty`,`compact`],[1,`empty`,`compact`],[`id`,`ngrx-page-label`,1,`visually-hidden`],[`labelledBy`,`ngrx-page-label`,1,`page-select`,3,`valueChange`,`options`,`value`],[1,`empty-title`],[1,`hint`],[`type`,`button`,1,`btn`,3,`click`],[`aria-label`,`Stores on this page`,1,`store-list`],[1,`muted`,`pad`],[1,`store-detail`],[`type`,`button`,1,`store-item`,3,`click`],[1,`store-top`],[`aria-hidden`,`true`,1,`dot`],[1,`store-name`],[1,`store-meta`],[1,`detail-head`],[1,`chips`],[1,`chip`],[1,`chip`,`mono`,3,`title`],[1,`refs`],[1,`paused`],[1,`facts`],[`aria-labelledby`,`ngrx-state-heading`,1,`fact`],[`id`,`ngrx-state-heading`],[`tabindex`,`0`,`aria-labelledby`,`ngrx-state-heading`,1,`tree`],[`aria-labelledby`,`ngrx-log-heading`,1,`log`],[`id`,`ngrx-log-heading`],[`what`,`changes on this page`,`limit`,`changeLog`,3,`dropped`,`max`],[1,`log-layout`],[1,`log-list`],[`id`,`ngrx-change-detail`],[`aria-labelledby`,`ngrx-dispatch-heading`,1,`dispatch`],[`type`,`button`,1,`btn`,`primary`,3,`click`,`disabled`],[`id`,`store-latest-off`,1,`hint`,`small`],[`aria-labelledby`,`ngrx-computed-heading`,1,`fact`],[`id`,`ngrx-computed-heading`],[1,`kv`],[1,`muted`],[`id`,`ngrx-methods-heading`,1,`spaced`],[`aria-labelledby`,`ngrx-methods-heading`,1,`methods`],[`aria-labelledby`,`ngrx-entities-heading`,1,`fact`],[3,`title`],[1,`chip`,`mono`],[1,`tag`],[1,`calls`],[`id`,`ngrx-entities-heading`],[1,`entities`],[1,`entity-group`],[1,`entity-head`],[1,`entity-count`],[1,`chips`,`entity-ids`],[1,`chip`,`more`,3,`title`],[`type`,`button`,1,`log-item`,3,`click`],[1,`seq`],[1,`log-type-row`],[1,`log-type`,3,`title`],[1,`tag`,3,`title`],[1,`log-meta`],[3,`ngTemplateOutlet`,`ngTemplateOutletContext`],[`id`,`ngrx-dispatch-heading`],[1,`dispatch-form`,3,`submit`],[`required`,``,`spellcheck`,`false`,`autocomplete`,`off`,`list`,`ngrx-action-types`,`placeholder`,`e.g. [Cart] Add Item`,3,`input`,`value`],[`id`,`ngrx-action-types`],[3,`value`],[1,`optional`],[`rows`,`3`,`spellcheck`,`false`,`placeholder`,`e.g. {"id": 7}`,`aria-describedby`,`ngrx-payload-error`,3,`input`,`value`],[`id`,`ngrx-payload-error`,1,`field-error`],[1,`actions`],[`type`,`submit`,1,`btn`,`primary`,3,`disabled`],[`id`,`store-dispatch-off`,1,`hint`,`small`],[`id`,`ngrx-events-heading`],[1,`intro`],[`aria-label`,`Dispatched events`,1,`events-list`],[`id`,`ngrx-event-detail`,`tabindex`,`-1`,1,`event-detail-focus`],[`type`,`button`,1,`event-item`,3,`click`],[1,`event-type`,`mono`,3,`title`],[1,`event-payload`,3,`title`],[1,`event-time`],[1,`entry`],[`role`,`heading`,1,`entry-heading`,3,`id`],[`role`,`group`,1,`confirm`],[1,`hint`,`small`],[1,`code`],[1,`mono`],[`role`,`heading`,1,`sub`],[1,`diff`],[3,`class`],[1,`op`],[1,`path`],[1,`values`],[1,`before`],[1,`after`],[`aria-hidden`,`true`,1,`arrow`],[1,`visually-hidden`],[`role`,`group`,1,`confirm`,3,`keydown.escape`],[3,`id`],[1,`entry-actions`],[`type`,`button`,1,`btn`,`restore`,3,`disabled`],[`type`,`button`,1,`btn`,3,`disabled`],[1,`hint`,`small`,3,`id`],[`type`,`button`,1,`btn`,`restore`,3,`click`,`disabled`],[`type`,`button`,1,`btn`,3,`click`,`disabled`],[`aria-hidden`,`true`,1,`spinner`],[`role`,`group`,`aria-label`,`Filter declarations by kind`,1,`kinds`],[`type`,`button`,1,`kind-chip`,3,`click`],[1,`count`],[`type`,`button`,1,`kind-chip`,3,`active`],[1,`nodes`],[1,`node-card`],[1,`chip-text`],[1,`node-header`],[1,`node-label`],[1,`node-meta`],[1,`file`,3,`title`],[1,`detail`]],template:function(e,t){e&1&&(z(0,`div`,6)(1,`input`,7),G(`input`,function(e){return t.filter.set(e.target.value)}),B(),P(2,kF,3,2),z(3,`span`,8),V(4,`span`,9),J(5),B()(),z(6,`section`,10)(7,`div`,11)(8,`h2`,12),J(9,`Live stores`),B(),P(10,AF,2,1,`span`,13),B(),P(11,jF,7,0,`div`,14)(12,MF,5,0,`div`,15)(13,IF,4,1,`div`,15)(14,bI,6,2,`div`,16),z(15,`p`,17),J(16),B()(),P(17,TI,13,3,`section`,18),tg(18,$I,18,16,`ng-template`,null,0,gv),z(20,`section`,19)(21,`div`,11)(22,`h2`,20),J(23,`Source declarations`),B(),P(24,eL,2,1,`span`,13),B(),P(25,tL,4,0,`div`,21)(26,nL,29,0,`div`,22)(27,sL,11,5),B()),e&2&&(M(),R(`value`,t.filter()),M(),F(t.pages().length>1?2:-1),M(),q(`on`,!!t.page()),M(2),X(` `,t.page()?`Live`:`No page connected`,` `),M(5),F(t.liveStores().length?10:-1),M(),F(t.failed()?11:t.page()?t.liveStores().length?14:13:12),M(5),Y(t.message()),M(),F(t.hasEvents()?17:-1),M(7),F(t.sourceEntries().length?24:-1),M(),F(t.sourceLoaded()?t.sourceEntries().length===0?26:27:25))},dependencies:[TD,mD,$y],styles:[`[_nghost-%COMP%] {
  display: grid;
  gap: 24px;
  min-width: 0;
  color: var(--%NS%text);
  font-size: 13px;
}

.intro[_ngcontent-%COMP%] {
  max-width: 720px;
  margin: 0;
  color: var(--%NS%text-2);
  line-height: 1.5;
}

.toolbar[_ngcontent-%COMP%] {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
  padding: 10px 12px;
  background: color-mix(in srgb, var(--%NS%surface) 85%, transparent);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
}

input[_ngcontent-%COMP%] {
  flex: 1 1 220px;
  min-width: 0;
  height: 34px;
  padding: 0 12px;
  background: var(--%NS%bg);
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  color: var(--%NS%text);
  font: inherit;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s var(--%NS%ease), box-shadow 0.15s var(--%NS%ease);
}

input[_ngcontent-%COMP%]::placeholder {
  color: var(--%NS%text-3);
}

input[_ngcontent-%COMP%]:focus-visible {
  outline: none;
  border-color: var(--%NS%accent);
  box-shadow: 0 0 0 3px var(--%NS%accent-soft);
}

.page-select[_ngcontent-%COMP%] {
  flex: 0 1 220px;
  min-width: 0;
}

.status[_ngcontent-%COMP%] {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 6px;
  color: var(--%NS%text-2);
  font-size: 12px;
  font-weight: 500;
}

.live-dot[_ngcontent-%COMP%] {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--%NS%text-3);
}

.status.on[_ngcontent-%COMP%]   .live-dot[_ngcontent-%COMP%] {
  background: var(--%NS%ok);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--%NS%ok) 20%, transparent);
  animation: _ngcontent-%COMP%_pulse 2s infinite;
}

@keyframes _ngcontent-%COMP%_pulse {
  50% {
    opacity: 0.4;
  }
}
.block[_ngcontent-%COMP%] {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.section-head[_ngcontent-%COMP%] {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 24px;
}

h2[_ngcontent-%COMP%], 
h4[_ngcontent-%COMP%], 
.sub[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
}

h4[_ngcontent-%COMP%] {
  margin-bottom: 10px;
}

.spaced[_ngcontent-%COMP%] {
  margin-top: 16px;
}

.sub[_ngcontent-%COMP%] {
  margin: 14px 0 8px;
}

.pill[_ngcontent-%COMP%] {
  min-width: 20px;
  padding: 0 7px;
  border-radius: 99px;
  background: var(--%NS%surface-2);
  border: 1px solid var(--%NS%border);
  color: var(--%NS%text-2);
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0;
  line-height: 18px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.empty[_ngcontent-%COMP%] {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  text-align: center;
  padding: 36px 24px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  animation: enter 0.35s var(--%NS%ease) both;
}

.empty.compact[_ngcontent-%COMP%] {
  padding: 24px 16px;
  border-style: dashed;
  background: transparent;
}

.empty-title[_ngcontent-%COMP%] {
  margin: 0;
  color: var(--%NS%text-strong);
  font-size: 14px;
  font-weight: 600;
}

.hint[_ngcontent-%COMP%] {
  max-width: 520px;
  margin: 0;
  color: var(--%NS%text-2);
  line-height: 1.55;
  overflow-wrap: anywhere;
}

.hint.small[_ngcontent-%COMP%] {
  margin-top: 12px;
  font-size: 12px;
}

code[_ngcontent-%COMP%] {
  font-family: var(--%NS%font-mono);
  font-size: 12px;
}

.hint[_ngcontent-%COMP%]   code[_ngcontent-%COMP%], 
.refs[_ngcontent-%COMP%]   code[_ngcontent-%COMP%] {
  padding: 1px 5px;
  color: var(--%NS%text);
  background: var(--%NS%surface-3);
  border: 1px solid var(--%NS%border);
  border-radius: 5px;
}

.muted[_ngcontent-%COMP%] {
  margin: 0;
  color: var(--%NS%text-2);
}

.pad[_ngcontent-%COMP%] {
  padding: 20px 12px;
  text-align: center;
  line-height: 1.5;
}

.btn[_ngcontent-%COMP%] {
  height: 32px;
  padding: 0 14px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%surface-2);
  color: var(--%NS%text);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s var(--%NS%ease), border-color 0.15s var(--%NS%ease);
}

.btn[_ngcontent-%COMP%]:hover {
  background: var(--%NS%surface-3);
}

.btn[_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: 2px;
}

.btn[_ngcontent-%COMP%]:disabled {
  opacity: 0.6;
  cursor: default;
}

.btn.primary[_ngcontent-%COMP%], 
.btn.restore[_ngcontent-%COMP%] {
  border-color: var(--%NS%accent-line);
  background: var(--%NS%accent-soft);
  color: var(--%NS%text-strong);
}

.btn.restore[_ngcontent-%COMP%] {
  margin-top: 14px;
}

.live-layout[_ngcontent-%COMP%] {
  display: grid;
  grid-template-columns: minmax(180px, 240px) minmax(0, 1fr);
  min-width: 0;
  background: var(--%NS%surface);
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  box-shadow: var(--%NS%shadow);
  overflow: hidden;
  animation: enter 0.35s var(--%NS%ease) both;
}

ul[_ngcontent-%COMP%] {
  list-style: none;
  margin: 0;
  padding: 0;
}

.store-list[_ngcontent-%COMP%] {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px;
  border-right: 1px solid var(--%NS%border);
  background: var(--%NS%surface-2);
}

.store-item[_ngcontent-%COMP%], 
.log-item[_ngcontent-%COMP%] {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 3px;
  width: 100%;
  padding: 8px 10px;
  border: none;
  border-radius: var(--%NS%radius-sm);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s var(--%NS%ease);
}

.store-item[_ngcontent-%COMP%]:hover, 
.log-item[_ngcontent-%COMP%]:hover, 
.event-item[_ngcontent-%COMP%]:hover {
  background: var(--%NS%surface-3);
}

.store-item[_ngcontent-%COMP%]:focus-visible, 
.log-item[_ngcontent-%COMP%]:focus-visible, 
.event-item[_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: -2px;
}

.store-item.selected[_ngcontent-%COMP%], 
.log-item.selected[_ngcontent-%COMP%], 
.event-item.selected[_ngcontent-%COMP%] {
  background: var(--%NS%accent-soft);
  box-shadow: inset 2px 0 0 var(--%NS%accent);
}

.store-top[_ngcontent-%COMP%] {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  max-width: 100%;
}

.store-name[_ngcontent-%COMP%] {
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--%NS%font-mono);
  font-weight: 600;
  color: var(--%NS%text-strong);
}

.store-meta[_ngcontent-%COMP%], 
.log-meta[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
}

.dot[_ngcontent-%COMP%] {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.store-detail[_ngcontent-%COMP%] {
  display: grid;
  gap: 16px;
  min-width: 0;
  padding: 16px;
}

.detail-head[_ngcontent-%COMP%]   h3[_ngcontent-%COMP%] {
  margin: 0 0 8px;
  color: var(--%NS%accent);
  font-family: var(--%NS%font-mono);
  font-size: 15px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.chips[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.chip[_ngcontent-%COMP%] {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  padding: 1px 8px;
  border: 1px solid var(--%NS%border);
  border-radius: 99px;
  background: var(--%NS%surface-2);
  color: var(--%NS%text-2);
  font-size: 11.5px;
  line-height: 18px;
  overflow-wrap: anywhere;
}

.chip.mono[_ngcontent-%COMP%] {
  font-family: var(--%NS%font-mono);
}

.refs[_ngcontent-%COMP%] {
  margin: 10px 0 0;
  color: var(--%NS%text-2);
  line-height: 1.8;
}

.facts[_ngcontent-%COMP%] {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 16px;
  min-width: 0;
}

.fact[_ngcontent-%COMP%] {
  min-width: 0;
}

pre[_ngcontent-%COMP%] {
  margin: 0;
  font-family: var(--%NS%font-mono);
  font-size: 12px;
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  color: var(--%NS%text);
}

.tree[_ngcontent-%COMP%], 
.code[_ngcontent-%COMP%] {
  max-height: 360px;
  overflow: auto;
  padding: 10px 12px;
  background: var(--%NS%surface-2);
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius-sm);
}

.code[_ngcontent-%COMP%] {
  max-height: 220px;
}

.tree[_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: 2px;
}

.kv[_ngcontent-%COMP%] {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 6px 14px;
  margin: 0;
}

.kv[_ngcontent-%COMP%]   dt[_ngcontent-%COMP%] {
  font-family: var(--%NS%font-mono);
  font-size: 12px;
  color: var(--%NS%text-2);
}

.kv[_ngcontent-%COMP%]   dd[_ngcontent-%COMP%] {
  min-width: 0;
  margin: 0;
  overflow-wrap: anywhere;
}

.methods[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.methods[_ngcontent-%COMP%]   li[_ngcontent-%COMP%] {
  flex-wrap: wrap;
  row-gap: 2px;
}

.tag[_ngcontent-%COMP%] {
  padding: 0 5px;
  border-radius: 4px;
  background: var(--%NS%accent-soft);
  color: var(--%NS%text-strong);
  font-size: 10.5px;
}

.calls[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-family: var(--%NS%font-sans, inherit);
  font-size: 11px;
}

.entities[_ngcontent-%COMP%] {
  display: grid;
  gap: 14px;
}

.entity-group[_ngcontent-%COMP%] {
  display: grid;
  gap: 8px;
}

.entity-head[_ngcontent-%COMP%] {
  display: flex;
  align-items: center;
  gap: 8px;
}

.entity-count[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
}

.entity-ids[_ngcontent-%COMP%] {
  margin: 0;
}

.chip.more[_ngcontent-%COMP%] {
  border-style: dashed;
  color: var(--%NS%text-3);
}

.events-list[_ngcontent-%COMP%] {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 260px;
  overflow: auto;
  padding: 6px;
  background: var(--%NS%surface);
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  animation: enter 0.35s var(--%NS%ease) both;
}

.event-item[_ngcontent-%COMP%] {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px 10px;
  width: 100%;
  min-width: 0;
  padding: 7px 10px;
  border: none;
  border-radius: var(--%NS%radius-sm);
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 0.15s var(--%NS%ease);
}

.event-type[_ngcontent-%COMP%] {
  flex: none;
  font-weight: 600;
  color: var(--%NS%text-strong);
  font-size: 12.5px;
}

.event-payload[_ngcontent-%COMP%] {
  flex: 1 1 160px;
  min-width: 0;
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--%NS%text-2);
}

.event-time[_ngcontent-%COMP%] {
  flex: none;
  margin-left: auto;
  color: var(--%NS%text-3);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
}

.log[_ngcontent-%COMP%] {
  min-width: 0;
  padding-top: 16px;
  border-top: 1px solid var(--%NS%border);
}

.log-layout[_ngcontent-%COMP%] {
  display: grid;
  grid-template-columns: minmax(200px, 300px) minmax(0, 1fr);
  gap: 16px;
  min-width: 0;
}

.log-list[_ngcontent-%COMP%] {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 420px;
  overflow: auto;
  padding: 2px;
}

.log-item[_ngcontent-%COMP%] {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  column-gap: 8px;
  row-gap: 2px;
}

.seq[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-size: 11.5px;
  font-variant-numeric: tabular-nums;
}

.log-type-row[_ngcontent-%COMP%] {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.log-type[_ngcontent-%COMP%] {
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
  min-width: 0;
  font-family: var(--%NS%font-mono);
  font-size: 12.5px;
  color: var(--%NS%text);
}

.log-meta[_ngcontent-%COMP%] {
  grid-column: 2;
}

.entry[_ngcontent-%COMP%] {
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--%NS%accent-line);
  border-radius: var(--%NS%radius-sm);
  animation: enter 0.25s var(--%NS%ease) both;
}

.entry[_ngcontent-%COMP%]   .entry-heading[_ngcontent-%COMP%] {
  margin: 0 0 12px;
  font-family: var(--%NS%font-mono);
  font-size: 13px;
  font-weight: 600;
  color: var(--%NS%text-strong);
  overflow-wrap: anywhere;
}

.diff[_ngcontent-%COMP%] {
  display: grid;
  gap: 4px;
}

.diff-row[_ngcontent-%COMP%] {
  display: grid;
  grid-template-columns: auto minmax(0, max-content) minmax(0, 1fr);
  gap: 8px;
  align-items: baseline;
  padding: 5px 8px;
  border-radius: 6px;
  background: var(--%NS%surface-2);
}

.op[_ngcontent-%COMP%] {
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--%NS%text-2);
}

.diff-row.add[_ngcontent-%COMP%]   .op[_ngcontent-%COMP%] {
  color: var(--%NS%ok);
}

.diff-row.remove[_ngcontent-%COMP%]   .op[_ngcontent-%COMP%] {
  color: var(--%NS%danger);
}

.path[_ngcontent-%COMP%] {
  color: var(--%NS%text-strong);
  overflow-wrap: anywhere;
}

.values[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;
  min-width: 0;
  overflow-wrap: anywhere;
}

.before[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
  text-decoration: line-through;
}

.after[_ngcontent-%COMP%] {
  color: var(--%NS%text);
}

.arrow[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
}

.confirm[_ngcontent-%COMP%] {
  margin-top: 14px;
  padding: 12px;
  border: 1px solid var(--%NS%accent-line);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%accent-soft);
}

.confirm[_ngcontent-%COMP%]   p[_ngcontent-%COMP%] {
  margin: 0 0 10px;
  line-height: 1.5;
}

.actions[_ngcontent-%COMP%], 
.entry-actions[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.entry-actions[_ngcontent-%COMP%] {
  margin-top: 14px;
}

.entry-actions[_ngcontent-%COMP%]   .btn.restore[_ngcontent-%COMP%] {
  margin-top: 0;
}

.dispatch[_ngcontent-%COMP%] {
  min-width: 0;
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid var(--%NS%border);
}

.dispatch-form[_ngcontent-%COMP%] {
  display: grid;
  gap: 10px;
  max-width: 560px;
}

.dispatch-form[_ngcontent-%COMP%]   label[_ngcontent-%COMP%] {
  display: grid;
  gap: 6px;
  color: var(--%NS%text-2);
  font-size: 12px;
  font-weight: 500;
}

.optional[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-weight: 400;
}

.dispatch-form[_ngcontent-%COMP%]   input[_ngcontent-%COMP%] {
  width: 100%;
  font-family: var(--%NS%font-mono);
  font-size: 12.5px;
}

textarea[_ngcontent-%COMP%] {
  width: 100%;
  min-width: 0;
  padding: 8px 10px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%bg);
  color: var(--%NS%text);
  font-family: var(--%NS%font-mono);
  font-size: 12px;
  resize: vertical;
  transition: border-color 0.15s var(--%NS%ease), box-shadow 0.15s var(--%NS%ease);
}

textarea[_ngcontent-%COMP%]::placeholder {
  color: var(--%NS%text-3);
}

textarea[_ngcontent-%COMP%]:focus-visible {
  outline: none;
  border-color: var(--%NS%accent);
  box-shadow: 0 0 0 3px var(--%NS%accent-soft);
}

textarea[aria-invalid=true][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%danger) 60%, transparent);
}

.field-error[_ngcontent-%COMP%] {
  margin: -4px 0 0;
  color: var(--%NS%danger);
  font-size: 12px;
}

.field-error[_ngcontent-%COMP%]:empty {
  display: none;
}

.paused[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 14px;
  margin-bottom: 14px;
  padding: 10px 12px;
  border: 1px solid color-mix(in srgb, var(--%NS%warn) 40%, transparent);
  border-radius: var(--%NS%radius-sm);
  background: color-mix(in srgb, var(--%NS%warn) 10%, transparent);
}

.paused[_ngcontent-%COMP%]   p[_ngcontent-%COMP%] {
  flex: 1 1 240px;
  margin: 0;
  line-height: 1.5;
}

.paused[_ngcontent-%COMP%]   .hint.small[_ngcontent-%COMP%] {
  flex-basis: 100%;
  margin-top: 0;
}

.message[_ngcontent-%COMP%]:empty {
  display: none;
}

.message[_ngcontent-%COMP%] {
  margin: 0;
  color: var(--%NS%text-2);
}

.kinds[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.kind-chip[_ngcontent-%COMP%] {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 100%;
  height: 28px;
  padding: 0 10px;
  border: 1px solid var(--%NS%border);
  border-radius: 99px;
  background: var(--%NS%surface-2);
  color: var(--%NS%text-2);
  font: inherit;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 0.15s var(--%NS%ease), border-color 0.15s var(--%NS%ease), color 0.15s var(--%NS%ease);
}

.kind-chip[_ngcontent-%COMP%]:hover {
  border-color: var(--%NS%border-strong);
  background: var(--%NS%surface-3);
  color: var(--%NS%text);
}

.kind-chip.active[_ngcontent-%COMP%] {
  border-color: var(--%NS%accent-line);
  background: var(--%NS%accent-soft);
  color: var(--%NS%text-strong);
}

.kind-chip[_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: 2px;
}

.chip-text[_ngcontent-%COMP%] {
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.kind-chip[_ngcontent-%COMP%]   .count[_ngcontent-%COMP%] {
  flex: none;
  min-width: 18px;
  padding: 0 5px;
  border-radius: 99px;
  background: var(--%NS%surface-3);
  color: var(--%NS%text-2);
  font-size: 11px;
  line-height: 16px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.nodes[_ngcontent-%COMP%] {
  display: flex;
  flex-direction: column;
  gap: 8px;
  animation: enter 0.35s var(--%NS%ease) both;
}

.node-card[_ngcontent-%COMP%] {
  min-width: 0;
  padding: 12px 16px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  border-radius: var(--%NS%radius-sm);
}

.node-header[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  min-width: 0;
}

.node-label[_ngcontent-%COMP%] {
  min-width: 0;
  font-family: var(--%NS%font-mono);
  font-weight: 500;
  color: var(--%NS%text-strong);
  overflow-wrap: anywhere;
}

.node-meta[_ngcontent-%COMP%] {
  margin-top: 6px;
  color: var(--%NS%text-3);
  font-size: 12px;
}

.file[_ngcontent-%COMP%] {
  font-family: var(--%NS%font-mono);
  font-size: 11.5px;
  overflow-wrap: anywhere;
}

.detail[_ngcontent-%COMP%] {
  margin: 6px 0 0;
  color: var(--%NS%text-2);
  font-size: 12px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.spinner[_ngcontent-%COMP%] {
  width: 18px;
  height: 18px;
  border: 2px solid var(--%NS%border-strong);
  border-top-color: var(--%NS%accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .spinner[_ngcontent-%COMP%], 
   .status.on[_ngcontent-%COMP%]   .live-dot[_ngcontent-%COMP%] {
    animation: none;
  }
}
@media (max-width: 760px) {
  .live-layout[_ngcontent-%COMP%], 
   .log-layout[_ngcontent-%COMP%] {
    grid-template-columns: minmax(0, 1fr);
  }
  .store-list[_ngcontent-%COMP%] {
    border-right: none;
    border-bottom: 1px solid var(--%NS%border);
  }
}
@media (max-width: 480px) {
  .toolbar[_ngcontent-%COMP%] {
    padding: 8px;
  }
  .toolbar[_ngcontent-%COMP%]   input[_ngcontent-%COMP%], 
   .page-select[_ngcontent-%COMP%] {
    flex-basis: 100%;
  }
  .store-detail[_ngcontent-%COMP%] {
    padding: 12px;
  }
  .kv[_ngcontent-%COMP%] {
    grid-template-columns: minmax(0, 1fr);
  }
}`]})};function mL(e){return e.split(`@`)[1]??``}var hL={signal:`Signal Forms`,reactive:`Reactive`,template:`Template-driven`},gL={own:`validator`,directive:`template attribute`,tree:`cross-field rule`,async:`async`,parse:`parse`,submission:`server`,schema:`schema`,manual:`setErrors`},_L=iE,vL={key:`name looks secret`,"input-type":`password input`,autocomplete:`autocomplete is a secret kind`,marker:`marked as mask`,parent:`inside a secret group`,config:`listed in mask`};function yL(e){return vL[e]??e}var bL=`https://pangular-inspector.dev/security/#opt-fields-in-or-out`;async function xL(e,t){return await _L(e,`request-form-action`,t)??{ok:!1,error:`The devtools server did not answer.`}}function SL(e){return`${e.ok?e.message??`Done.`:e.error??`Failed.`}${e.skipped?.length?` Skipped: ${e.skipped.map(e=>`${e.path} (${e.reason})`).join(`, `)}.`:``}${e.status?` Status: ${e.status}.`:``}`}var CL=/"(?:[^"\\\n]|\\.)*"|`([^`\n]*)`|\*\*/g;function wL(e){return(e??``).replace(/^_Labels, paths.*_\n\n/,``).replace(CL,(e,t)=>t??(e===`**`?``:e))}var TL=[`heading`];function EL(e,t){if(e&1){let e=W();H(0,`div`,6)(1,`p`,9),J(2,`Could not explain this field. The devtools server did not answer.`),U(),H(3,`button`,11),Qg(`click`,function(){return O(e),k(K().retry())}),J(4,`Try again`),U()()}}function DL(e,t){if(e&1&&(H(0,`pre`,7),J(1),U()),e&2){let e=K();N(`aria-busy`,e.text()===null?`true`:null),M(),Y(e.text()??`Loading…`)}}function OL(e,t){if(e&1){let e=W();H(0,`div`,8)(1,`label`,15),J(2),U(),H(3,`input`,16),Qg(`input`,function(t){return O(e),k(K().draft.set(t.target.value))})(`keydown.enter`,function(){return O(e),k(K().setValue())}),U(),H(4,`button`,17),Qg(`click`,function(){return O(e),k(K().setValue())}),J(5,` Set `),U()()}if(e&2){let e=K();M(2),X(`New value for `,e.node().path),M(),Vg(`value`,e.draft()),M(),Vg(`disabled`,!e.canWrite()),N(`aria-describedby`,e.canWrite()?null:`field-writes-off`)}}function kL(e,t){if(e&1&&(H(0,`p`,9),J(1),H(2,`a`,18),J(3,`How to unmask it`),U()()),e&2){let e=K();M(),X(` No Set editor: this field is redacted (`,e.redactLabel(e.node().redacted),`). `),M(),Vg(`href`,e.unmaskDocsUrl,ku)}}function AL(e,t){if(e&1&&(H(0,`p`,13),J(1),U()),e&2){let e=K();M(),Y(e.writesOff)}}var jL=class e{form=$.required();node=$.required();version=$(0);rpc=$(null);closed=Ov();canWrite=Q(()=>cE(this.rpc(),`forms`));writesOff=GT(`forms`);redactLabel=yL;unmaskDocsUrl=bL;target=Q(()=>`${this.form().id}|${this.node().path}`);text=Tv({source:this.target,computation:()=>null});failed=Tv({source:this.target,computation:()=>!1});attempt=j(0);heading=Rv.required(`heading`);host=E(Ml);draft=Tv({source:this.target,computation:()=>``});message=Tv({source:this.target,computation:()=>``});constructor(){uc(()=>{let e=this.form().id,t=this.node().path;this.version(),this.attempt();let n=this.rpc();Cv(()=>this.load(n,e,t))}),ey(()=>{this.target();let e=Cv(this.heading).nativeElement;this.host.nativeElement.scrollIntoView?.({block:`nearest`}),e.focus({preventScroll:!0})})}async load(e,t,n){if(!e)return;let r=await _L(e,`forms-explain`,{kind:`field`,form:t,path:n});if(this.form().id===t&&this.node().path===n){if(r===null){this.failed.set(!0);return}this.failed.set(!1),this.text.set(wL(r))}}retry(){this.failed.set(!1),this.attempt.update(e=>e+1)}async act(e){let t=this.form().id,n=this.node().path,r=await xL(this.rpc(),{action:e,formId:t,path:n});this.form().id===t&&this.node().path===n&&this.message.set(r.expression?`${SL(r)} ${r.expression}`:SL(r))}async setValue(){let e=this.form().id,t=this.node().path,n=await xL(this.rpc(),{action:`set-value`,formId:e,path:t,value:this.draft(),coerce:!0,mode:`user`});this.form().id===e&&this.node().path===t&&this.message.set(SL(n))}static ɵfac=function(t){return new(t||e)};static ɵcmp=Bh({type:e,selectors:[[`app-forms-field-detail`]],viewQuery:function(e,t){e&1&&e_(t.heading,TL,5),e&2&&t_()},hostAttrs:[`role`,`region`,`aria-labelledby`,`forms-field-heading`],inputs:{form:[1,`form`],node:[1,`node`],version:[1,`version`],rpc:[1,`rpc`]},outputs:{closed:`closed`},decls:26,vars:11,consts:[[`heading`,``],[1,`head`],[1,`section-label`],[`id`,`forms-field-heading`,`tabindex`,`-1`],[1,`tag`],[`type`,`button`,1,`small`,`close`,3,`click`],[`role`,`alert`,1,`failed`],[1,`explain`],[1,`editor`],[1,`muted`],[`role`,`group`,`aria-label`,`Field actions`,1,`row`],[`type`,`button`,1,`small`,3,`click`],[`type`,`button`,1,`small`,3,`click`,`disabled`],[`id`,`field-writes-off`,1,`muted`],[`role`,`status`,1,`status`],[`for`,`field-value`,1,`sr-only`],[`id`,`field-value`,`type`,`text`,`placeholder`,`New value, read as the current value's type`,`autocomplete`,`off`,`spellcheck`,`false`,1,`field-input`,3,`input`,`keydown.enter`,`value`],[`type`,`button`,1,`small`,`primary`,3,`click`,`disabled`],[`target`,`_blank`,`rel`,`noopener noreferrer`,3,`href`]],template:function(e,t){e&1&&(H(0,`div`,1)(1,`span`,2),J(2,`Field`),U(),H(3,`h3`,3,0),J(5),U(),H(6,`span`,4),J(7),U(),H(8,`button`,5),Qg(`click`,function(){return t.closed.emit()}),J(9,` Close `),U()(),P(10,EL,5,0,`div`,6)(11,DL,2,2,`pre`,7),P(12,OL,6,4,`div`,8)(13,kL,4,2,`p`,9),H(14,`div`,10)(15,`button`,11),Qg(`click`,function(){return t.act(`focus`)}),J(16,`Focus`),U(),H(17,`button`,12),Qg(`click`,function(){return t.act(`mark-touched`)}),J(18,` Touch `),U(),H(19,`button`,12),Qg(`click`,function(){return t.act(`revalidate`)}),J(20,` Revalidate `),U(),H(21,`button`,11),Qg(`click`,function(){return t.act(`store-as-global`)}),J(22,`Store as global`),U()(),P(23,AL,2,1,`p`,13),H(24,`p`,14),J(25),U()),e&2&&(M(5),Y(t.node().path||`(form)`),M(2),Y(t.node().type),M(),N(`aria-label`,`Close details for `+(t.node().path||`the form`)),M(2),F(t.failed()?10:11),M(2),F(t.node().type===`control`&&!t.node().redacted?12:t.node().type===`control`?13:-1),M(5),Vg(`disabled`,!t.canWrite()),N(`aria-describedby`,t.canWrite()?null:`field-writes-off`),M(2),Vg(`disabled`,!t.canWrite()),N(`aria-describedby`,t.canWrite()?null:`field-writes-off`),M(4),F(t.canWrite()?-1:23),M(2),Y(t.message()))},styles:[`.muted[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
}

code[_ngcontent-%COMP%] {
  font-family: var(--%NS%font-mono);
  font-size: 12.5px;
}

.small[_ngcontent-%COMP%] {
  display: inline-block;
  max-width: 100%;
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%surface-2);
  color: var(--%NS%text);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 32px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  transition: background-color 150ms var(--%NS%ease), border-color 150ms var(--%NS%ease), color 150ms var(--%NS%ease), box-shadow 150ms var(--%NS%ease);
}

.small[_ngcontent-%COMP%]:hover {
  background: var(--%NS%surface-3);
  border-color: color-mix(in srgb, var(--%NS%text-3) 55%, var(--%NS%border-strong));
}

.small[_ngcontent-%COMP%]:active {
  background: var(--%NS%border-strong);
}

.small[_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: 2px;
}

.small[_ngcontent-%COMP%]:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.small.primary[_ngcontent-%COMP%] {
  background: var(--%NS%accent);
  border-color: var(--%NS%accent);
  color: var(--%NS%accent-ink);
  font-weight: 600;
}

.small.primary[_ngcontent-%COMP%]:hover {
  background: var(--%NS%accent-hover);
  border-color: var(--%NS%accent-hover);
}

.small.danger[_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%danger) 40%, transparent);
  color: var(--%NS%danger);
}

.small.danger[_ngcontent-%COMP%]:hover {
  background: color-mix(in srgb, var(--%NS%danger) 12%, transparent);
  border-color: color-mix(in srgb, var(--%NS%danger) 55%, transparent);
}

.small.armed[_ngcontent-%COMP%] {
  box-shadow: 0 0 0 3px var(--%NS%accent-soft);
}

.small.danger.armed[_ngcontent-%COMP%] {
  background: var(--%NS%danger);
  border-color: var(--%NS%danger);
  color: #1f0707;
  font-weight: 600;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--%NS%danger) 18%, transparent);
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme=dark])   [_nghost-%COMP%]   .small.danger.armed[_ngcontent-%COMP%] {
    color: #fff;
  }
}
:root[data-theme=light]   [_nghost-%COMP%]   .small.danger.armed[_ngcontent-%COMP%] {
  color: #fff;
}

.field-input[_ngcontent-%COMP%] {
  min-width: 0;
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%bg);
  color: var(--%NS%text);
  font-family: var(--%NS%font-mono);
  font-size: 13px;
  transition: border-color 150ms var(--%NS%ease), box-shadow 150ms var(--%NS%ease);
}

.field-input[_ngcontent-%COMP%]::placeholder {
  color: var(--%NS%text-3);
  font-family: var(--%NS%font-sans);
}

.field-input[_ngcontent-%COMP%]:hover {
  border-color: color-mix(in srgb, var(--%NS%text-3) 55%, var(--%NS%border-strong));
}

.field-input[_ngcontent-%COMP%]:focus, 
.field-input[_ngcontent-%COMP%]:focus-visible {
  outline: none;
  border-color: var(--%NS%accent);
  box-shadow: 0 0 0 3px var(--%NS%accent-soft);
}

.explain[_ngcontent-%COMP%] {
  margin: 0;
  padding: 12px 16px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%bg);
  color: var(--%NS%text);
  font-family: var(--%NS%font-mono);
  font-size: 12.5px;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  tab-size: 2;
}

.explain[aria-busy=true][_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
}

.section-label[_ngcontent-%COMP%] {
  margin: 0;
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.tag[_ngcontent-%COMP%] {
  display: inline-block;
  margin: 0;
  padding: 1px 8px;
  border: 1px solid var(--%NS%border);
  border-radius: 99px;
  background: var(--%NS%surface-2);
  color: var(--%NS%text-2);
  font-size: 11px;
  font-weight: 500;
  line-height: 18px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.tag[data-tone=ok][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%ok) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%ok) 12%, var(--%NS%surface));
  color: var(--%NS%ok);
}

.tag[data-tone=warn][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%warn) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%warn) 12%, var(--%NS%surface));
  color: var(--%NS%warn);
}

.tag[data-tone=bad][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%danger) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%danger) 12%, var(--%NS%surface));
  color: var(--%NS%danger);
}

.status[_ngcontent-%COMP%] {
  margin: 0;
  color: var(--%NS%text-2);
  font-size: 12.5px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.empty-state[_ngcontent-%COMP%] {
  display: grid;
  justify-items: center;
  gap: 6px;
  margin: 0;
  padding: 40px 24px;
  border: 1px dashed var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  color: var(--%NS%text-2);
  font-size: 13px;
  line-height: 1.5;
  text-align: center;
}

.empty-state[_ngcontent-%COMP%]   p[_ngcontent-%COMP%] {
  max-width: 52ch;
  margin: 0;
}

.empty-state[_ngcontent-%COMP%]   .empty-title[_ngcontent-%COMP%] {
  color: var(--%NS%text-strong);
  font-size: 14px;
  font-weight: 600;
}

.spinner[_ngcontent-%COMP%] {
  width: 16px;
  height: 16px;
  border: 2px solid var(--%NS%border-strong);
  border-top-color: var(--%NS%accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

[_nghost-%COMP%] {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
  padding: 16px;
  background: var(--%NS%surface-2);
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius-sm);
  animation: enter 0.35s var(--%NS%ease) both;
}

.head[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  align-items: center;
  min-width: 0;
}

.head[_ngcontent-%COMP%]   .section-label[_ngcontent-%COMP%] {
  flex-basis: 100%;
}

h3[_ngcontent-%COMP%] {
  flex: 1 1 0;
  min-width: 0;
  margin: 0;
  color: var(--%NS%text-strong);
  font-family: var(--%NS%font-mono);
  font-size: 14px;
  font-weight: 600;
  line-height: 1.4;
  overflow-wrap: anywhere;
  border-radius: 4px;
}

h3[_ngcontent-%COMP%]:focus {
  outline: none;
}

a[_ngcontent-%COMP%] {
  color: var(--%NS%accent);
  border-radius: 2px;
}

a[_ngcontent-%COMP%]:focus-visible, 
h3[_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: 2px;
}

.close[_ngcontent-%COMP%] {
  margin-left: auto;
}

.failed[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
}

.failed[_ngcontent-%COMP%]   p[_ngcontent-%COMP%] {
  margin: 0;
  font-size: 12.5px;
}

.editor[_ngcontent-%COMP%] {
  display: flex;
  gap: 8px;
  align-items: center;
}

.editor[_ngcontent-%COMP%]   .field-input[_ngcontent-%COMP%] {
  flex: 1 1 auto;
}

.row[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.status[_ngcontent-%COMP%] {
  margin-top: -4px;
}

.status[_ngcontent-%COMP%]:empty {
  height: 0;
  margin: -12px 0 0;
}`]})};function ML(e,t){if(e&1){let e=W();H(0,`div`,0)(1,`p`,4),J(2,`Could not explain this form`),U(),H(3,`p`),J(4,`The devtools server did not answer. Check that the app is running, then try again.`),U(),H(5,`button`,2),Qg(`click`,function(){return O(e),k(K().retry())}),J(6,`Try again`),U()()}}function NL(e,t){if(e&1&&(H(0,`section`,5)(1,`h3`,6),J(2,`Submit`),U(),H(3,`pre`,7),J(4),U()(),H(5,`section`,8)(6,`h3`,9),J(7,`Payload`),U(),H(8,`pre`,7),J(9),U()()),e&2){let e=K();M(3),N(`aria-busy`,e.submit()===null?`true`:null),M(),Y(e.submit()??`Loading…`),M(4),N(`aria-busy`,e.payload()===null?`true`:null),M(),Y(e.payload()??`Loading…`)}}function PL(e,t){if(e&1){let e=W();H(0,`div`,0)(1,`p`,3),J(2,`Could not check this form`),U(),H(3,`p`),J(4,`The devtools server did not answer. Check that the app is running, then try again.`),U(),H(5,`button`,4),Qg(`click`,function(){return O(e),k(K().retry())}),J(6,`Try again`),U()()}}function FL(e,t){e&1&&(H(0,`div`,1),Fg(1,`span`,5),H(2,`p`),J(3,`Checking the form for problems…`),U()())}function IL(e,t){e&1&&(H(0,`div`,2)(1,`span`,6),A(),H(2,`svg`,7),Fg(3,`path`,8),U()(),ps(),H(4,`p`,3),J(5,`No problems found`),U(),H(6,`p`),J(7,`For generic accessibility checks, run axe on the page.`),U()())}function LL(e,t){if(e&1&&(H(0,`span`,15),J(1,`at `),H(2,`code`),J(3),U()()),e&2){let e=K().$implicit;M(3),Y(e.path)}}function RL(e,t){if(e&1&&(H(0,`li`)(1,`div`,12)(2,`span`,13),J(3),U(),H(4,`code`,14),J(5),U(),P(6,LL,4,1,`span`,15),U(),H(7,`p`,16),J(8),U(),H(9,`p`,17)(10,`span`,18),J(11,`Fix`),U(),J(12),U()()),e&2){let e=t.$implicit;N(`data-severity`,e.severity),M(2),N(`data-tone`,e.severity===`info`?``:e.severity===`error`?`bad`:`warn`),M(),Y(e.severity),M(2),Y(e.rule),M(),F(e.path?6:-1),M(2),Y(e.message),M(4),X(` `,e.fix)}}function zL(e,t){if(e&1&&(H(0,`p`,9)(1,`span`,10),J(2),U(),J(3),U(),H(4,`ul`,11),I(5,RL,13,7,`li`,null,Cg),U()),e&2){let e=K();M(2),Y(e.findings().length),M(),X(` `,e.findings().length===1?`finding`:`findings`,` `),M(2),L(e.findings())}}var BL=class e{formId=$.required();version=$(0);rpc=$(null);submit=Tv({source:this.formId,computation:()=>null});payload=Tv({source:this.formId,computation:()=>null});failed=Tv({source:this.formId,computation:()=>!1});message=j(``);attempt=j(0);constructor(){uc(()=>{let e=this.formId();this.version(),this.attempt();let t=this.rpc();t&&Cv(async()=>{let[n,r]=await Promise.all([_L(t,`forms-explain`,{kind:`submit`,form:e}),_L(t,`forms-explain`,{kind:`payload`,form:e})]);if(this.formId()===e){if(n===null||r===null){this.failed.set(!0);return}this.failed.set(!1),this.submit.set(wL(n)),this.payload.set(wL(r))}})})}retry(){this.failed.set(!1),this.attempt.update(e=>e+1)}async copyFixture(){let e=(await _L(this.rpc(),`forms-explain`,{kind:`fixture`,form:this.formId()})??``).match(/```ts\n([\s\S]*)```\s*$/)?.[1];if(!e){this.message.set(`No test fixture is available for this form.`);return}try{await navigator.clipboard.writeText(e),this.message.set(`Copied.`)}catch{this.message.set(`Clipboard is not available here.`)}}static ɵfac=function(t){return new(t||e)};static ɵcmp=Bh({type:e,selectors:[[`app-forms-submit`]],inputs:{formId:[1,`formId`],version:[1,`version`],rpc:[1,`rpc`]},decls:7,vars:2,consts:[[`role`,`alert`,1,`empty-state`],[1,`fixture`],[`type`,`button`,1,`small`,3,`click`],[`role`,`status`,1,`status`],[1,`empty-title`],[`aria-labelledby`,`forms-submit-title`,1,`block`],[`id`,`forms-submit-title`,1,`section-label`],[1,`explain`],[`aria-labelledby`,`forms-payload-title`,1,`block`],[`id`,`forms-payload-title`,1,`section-label`]],template:function(e,t){e&1&&(P(0,ML,7,0,`div`,0)(1,NL,10,4),H(2,`div`,1)(3,`button`,2),Qg(`click`,function(){return t.copyFixture()}),J(4,`Copy test fixture`),U(),H(5,`span`,3),J(6),U()()),e&2&&(F(+!t.failed()),M(6),Y(t.message()))},styles:[`.muted[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
}

code[_ngcontent-%COMP%] {
  font-family: var(--%NS%font-mono);
  font-size: 12.5px;
}

.small[_ngcontent-%COMP%] {
  display: inline-block;
  max-width: 100%;
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%surface-2);
  color: var(--%NS%text);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 32px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  transition: background-color 150ms var(--%NS%ease), border-color 150ms var(--%NS%ease), color 150ms var(--%NS%ease), box-shadow 150ms var(--%NS%ease);
}

.small[_ngcontent-%COMP%]:hover {
  background: var(--%NS%surface-3);
  border-color: color-mix(in srgb, var(--%NS%text-3) 55%, var(--%NS%border-strong));
}

.small[_ngcontent-%COMP%]:active {
  background: var(--%NS%border-strong);
}

.small[_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: 2px;
}

.small[_ngcontent-%COMP%]:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.small.primary[_ngcontent-%COMP%] {
  background: var(--%NS%accent);
  border-color: var(--%NS%accent);
  color: var(--%NS%accent-ink);
  font-weight: 600;
}

.small.primary[_ngcontent-%COMP%]:hover {
  background: var(--%NS%accent-hover);
  border-color: var(--%NS%accent-hover);
}

.small.danger[_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%danger) 40%, transparent);
  color: var(--%NS%danger);
}

.small.danger[_ngcontent-%COMP%]:hover {
  background: color-mix(in srgb, var(--%NS%danger) 12%, transparent);
  border-color: color-mix(in srgb, var(--%NS%danger) 55%, transparent);
}

.small.armed[_ngcontent-%COMP%] {
  box-shadow: 0 0 0 3px var(--%NS%accent-soft);
}

.small.danger.armed[_ngcontent-%COMP%] {
  background: var(--%NS%danger);
  border-color: var(--%NS%danger);
  color: #1f0707;
  font-weight: 600;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--%NS%danger) 18%, transparent);
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme=dark])   [_nghost-%COMP%]   .small.danger.armed[_ngcontent-%COMP%] {
    color: #fff;
  }
}
:root[data-theme=light]   [_nghost-%COMP%]   .small.danger.armed[_ngcontent-%COMP%] {
  color: #fff;
}

.field-input[_ngcontent-%COMP%] {
  min-width: 0;
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%bg);
  color: var(--%NS%text);
  font-family: var(--%NS%font-mono);
  font-size: 13px;
  transition: border-color 150ms var(--%NS%ease), box-shadow 150ms var(--%NS%ease);
}

.field-input[_ngcontent-%COMP%]::placeholder {
  color: var(--%NS%text-3);
  font-family: var(--%NS%font-sans);
}

.field-input[_ngcontent-%COMP%]:hover {
  border-color: color-mix(in srgb, var(--%NS%text-3) 55%, var(--%NS%border-strong));
}

.field-input[_ngcontent-%COMP%]:focus, 
.field-input[_ngcontent-%COMP%]:focus-visible {
  outline: none;
  border-color: var(--%NS%accent);
  box-shadow: 0 0 0 3px var(--%NS%accent-soft);
}

.explain[_ngcontent-%COMP%] {
  margin: 0;
  padding: 12px 16px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%bg);
  color: var(--%NS%text);
  font-family: var(--%NS%font-mono);
  font-size: 12.5px;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  tab-size: 2;
}

.explain[aria-busy=true][_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
}

.section-label[_ngcontent-%COMP%] {
  margin: 0;
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.tag[_ngcontent-%COMP%] {
  display: inline-block;
  margin: 0;
  padding: 1px 8px;
  border: 1px solid var(--%NS%border);
  border-radius: 99px;
  background: var(--%NS%surface-2);
  color: var(--%NS%text-2);
  font-size: 11px;
  font-weight: 500;
  line-height: 18px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.tag[data-tone=ok][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%ok) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%ok) 12%, var(--%NS%surface));
  color: var(--%NS%ok);
}

.tag[data-tone=warn][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%warn) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%warn) 12%, var(--%NS%surface));
  color: var(--%NS%warn);
}

.tag[data-tone=bad][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%danger) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%danger) 12%, var(--%NS%surface));
  color: var(--%NS%danger);
}

.status[_ngcontent-%COMP%] {
  margin: 0;
  color: var(--%NS%text-2);
  font-size: 12.5px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.empty-state[_ngcontent-%COMP%] {
  display: grid;
  justify-items: center;
  gap: 6px;
  margin: 0;
  padding: 40px 24px;
  border: 1px dashed var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  color: var(--%NS%text-2);
  font-size: 13px;
  line-height: 1.5;
  text-align: center;
}

.empty-state[_ngcontent-%COMP%]   p[_ngcontent-%COMP%] {
  max-width: 52ch;
  margin: 0;
}

.empty-state[_ngcontent-%COMP%]   .empty-title[_ngcontent-%COMP%] {
  color: var(--%NS%text-strong);
  font-size: 14px;
  font-weight: 600;
}

.spinner[_ngcontent-%COMP%] {
  width: 16px;
  height: 16px;
  border: 2px solid var(--%NS%border-strong);
  border-top-color: var(--%NS%accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

[_nghost-%COMP%] {
  display: grid;
  gap: 16px;
  min-width: 0;
  animation: enter 0.35s var(--%NS%ease) both;
}

.block[_ngcontent-%COMP%] {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.explain[_ngcontent-%COMP%] {
  max-height: 420px;
  overflow: auto;
}

.fixture[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
}`]})},VL=class e{formId=$.required();version=$(0);rpc=$(null);findings=Tv({source:this.formId,computation:()=>null});failed=Tv({source:this.formId,computation:()=>!1});attempt=j(0);constructor(){uc(()=>{let e=this.formId();this.version(),this.attempt();let t=this.rpc();t&&Cv(async()=>{let n=await _L(t,`forms-lint`,{form:e});this.formId()===e&&(this.failed.set(n===null),n&&this.findings.set(n))})})}retry(){this.failed.set(!1),this.attempt.update(e=>e+1)}static ɵfac=function(t){return new(t||e)};static ɵcmp=Bh({type:e,selectors:[[`app-forms-lint`]],inputs:{formId:[1,`formId`],version:[1,`version`],rpc:[1,`rpc`]},decls:4,vars:1,consts:[[`role`,`alert`,1,`empty-state`],[`role`,`status`,1,`empty-state`],[1,`empty-state`],[1,`empty-title`],[`type`,`button`,1,`small`,3,`click`],[`aria-hidden`,`true`,1,`spinner`],[`aria-hidden`,`true`,1,`ok-icon`],[`width`,`16`,`height`,`16`,`viewBox`,`0 0 24 24`,`fill`,`none`,`stroke`,`currentColor`,`stroke-width`,`2.5`,`stroke-linecap`,`round`,`stroke-linejoin`,`round`],[`d`,`M20 6 9 17l-5-5`],[1,`summary`],[1,`tabular`],[1,`findings`],[1,`meta`],[1,`tag`,`severity`],[1,`rule`],[1,`muted`,`path`],[1,`message`],[1,`fix`],[1,`fix-label`]],template:function(e,t){e&1&&P(0,PL,7,0,`div`,0)(1,FL,4,0,`div`,1)(2,IL,8,0,`div`,2)(3,zL,7,2),e&2&&F(t.failed()?0:t.findings()===null?1:t.findings().length?3:2)},styles:[`.muted[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
}

code[_ngcontent-%COMP%] {
  font-family: var(--%NS%font-mono);
  font-size: 12.5px;
}

.small[_ngcontent-%COMP%] {
  display: inline-block;
  max-width: 100%;
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%surface-2);
  color: var(--%NS%text);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 32px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  transition: background-color 150ms var(--%NS%ease), border-color 150ms var(--%NS%ease), color 150ms var(--%NS%ease), box-shadow 150ms var(--%NS%ease);
}

.small[_ngcontent-%COMP%]:hover {
  background: var(--%NS%surface-3);
  border-color: color-mix(in srgb, var(--%NS%text-3) 55%, var(--%NS%border-strong));
}

.small[_ngcontent-%COMP%]:active {
  background: var(--%NS%border-strong);
}

.small[_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: 2px;
}

.small[_ngcontent-%COMP%]:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.small.primary[_ngcontent-%COMP%] {
  background: var(--%NS%accent);
  border-color: var(--%NS%accent);
  color: var(--%NS%accent-ink);
  font-weight: 600;
}

.small.primary[_ngcontent-%COMP%]:hover {
  background: var(--%NS%accent-hover);
  border-color: var(--%NS%accent-hover);
}

.small.danger[_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%danger) 40%, transparent);
  color: var(--%NS%danger);
}

.small.danger[_ngcontent-%COMP%]:hover {
  background: color-mix(in srgb, var(--%NS%danger) 12%, transparent);
  border-color: color-mix(in srgb, var(--%NS%danger) 55%, transparent);
}

.small.armed[_ngcontent-%COMP%] {
  box-shadow: 0 0 0 3px var(--%NS%accent-soft);
}

.small.danger.armed[_ngcontent-%COMP%] {
  background: var(--%NS%danger);
  border-color: var(--%NS%danger);
  color: #1f0707;
  font-weight: 600;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--%NS%danger) 18%, transparent);
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme=dark])   [_nghost-%COMP%]   .small.danger.armed[_ngcontent-%COMP%] {
    color: #fff;
  }
}
:root[data-theme=light]   [_nghost-%COMP%]   .small.danger.armed[_ngcontent-%COMP%] {
  color: #fff;
}

.field-input[_ngcontent-%COMP%] {
  min-width: 0;
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%bg);
  color: var(--%NS%text);
  font-family: var(--%NS%font-mono);
  font-size: 13px;
  transition: border-color 150ms var(--%NS%ease), box-shadow 150ms var(--%NS%ease);
}

.field-input[_ngcontent-%COMP%]::placeholder {
  color: var(--%NS%text-3);
  font-family: var(--%NS%font-sans);
}

.field-input[_ngcontent-%COMP%]:hover {
  border-color: color-mix(in srgb, var(--%NS%text-3) 55%, var(--%NS%border-strong));
}

.field-input[_ngcontent-%COMP%]:focus, 
.field-input[_ngcontent-%COMP%]:focus-visible {
  outline: none;
  border-color: var(--%NS%accent);
  box-shadow: 0 0 0 3px var(--%NS%accent-soft);
}

.explain[_ngcontent-%COMP%] {
  margin: 0;
  padding: 12px 16px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%bg);
  color: var(--%NS%text);
  font-family: var(--%NS%font-mono);
  font-size: 12.5px;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  tab-size: 2;
}

.explain[aria-busy=true][_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
}

.section-label[_ngcontent-%COMP%] {
  margin: 0;
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.tag[_ngcontent-%COMP%] {
  display: inline-block;
  margin: 0;
  padding: 1px 8px;
  border: 1px solid var(--%NS%border);
  border-radius: 99px;
  background: var(--%NS%surface-2);
  color: var(--%NS%text-2);
  font-size: 11px;
  font-weight: 500;
  line-height: 18px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.tag[data-tone=ok][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%ok) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%ok) 12%, var(--%NS%surface));
  color: var(--%NS%ok);
}

.tag[data-tone=warn][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%warn) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%warn) 12%, var(--%NS%surface));
  color: var(--%NS%warn);
}

.tag[data-tone=bad][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%danger) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%danger) 12%, var(--%NS%surface));
  color: var(--%NS%danger);
}

.status[_ngcontent-%COMP%] {
  margin: 0;
  color: var(--%NS%text-2);
  font-size: 12.5px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.empty-state[_ngcontent-%COMP%] {
  display: grid;
  justify-items: center;
  gap: 6px;
  margin: 0;
  padding: 40px 24px;
  border: 1px dashed var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  color: var(--%NS%text-2);
  font-size: 13px;
  line-height: 1.5;
  text-align: center;
}

.empty-state[_ngcontent-%COMP%]   p[_ngcontent-%COMP%] {
  max-width: 52ch;
  margin: 0;
}

.empty-state[_ngcontent-%COMP%]   .empty-title[_ngcontent-%COMP%] {
  color: var(--%NS%text-strong);
  font-size: 14px;
  font-weight: 600;
}

.spinner[_ngcontent-%COMP%] {
  width: 16px;
  height: 16px;
  border: 2px solid var(--%NS%border-strong);
  border-top-color: var(--%NS%accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

[_nghost-%COMP%] {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.ok-icon[_ngcontent-%COMP%] {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  margin-bottom: 4px;
  border-radius: 50%;
  background: color-mix(in srgb, var(--%NS%ok) 12%, transparent);
  color: var(--%NS%ok);
}

.summary[_ngcontent-%COMP%] {
  margin: 0;
  color: var(--%NS%text-2);
  font-size: 12.5px;
}

.tabular[_ngcontent-%COMP%] {
  color: var(--%NS%text-strong);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.findings[_ngcontent-%COMP%] {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--%NS%text);
  font-size: 13px;
  animation: enter 0.35s var(--%NS%ease) both;
}

.findings[_ngcontent-%COMP%]   li[_ngcontent-%COMP%] {
  display: grid;
  gap: 6px;
  min-width: 0;
  padding: 12px 16px;
  background: var(--%NS%surface-2);
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius-sm);
  box-shadow: inset 3px 0 0 var(--%NS%border-strong);
  transition: border-color 150ms var(--%NS%ease);
}

.findings[_ngcontent-%COMP%]   li[data-severity=error][_ngcontent-%COMP%] {
  box-shadow: inset 3px 0 0 var(--%NS%danger);
}

.findings[_ngcontent-%COMP%]   li[data-severity=warning][_ngcontent-%COMP%] {
  box-shadow: inset 3px 0 0 var(--%NS%warn);
}

.findings[_ngcontent-%COMP%]   li[_ngcontent-%COMP%]:hover {
  border-color: var(--%NS%border-strong);
}

.meta[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  align-items: center;
  min-width: 0;
}

.severity[_ngcontent-%COMP%] {
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.rule[_ngcontent-%COMP%] {
  color: var(--%NS%text-strong);
  font-weight: 600;
  overflow-wrap: anywhere;
}

.path[_ngcontent-%COMP%] {
  font-size: 12.5px;
  overflow-wrap: anywhere;
}

.path[_ngcontent-%COMP%]   code[_ngcontent-%COMP%] {
  color: #fde68a;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme=dark])   [_nghost-%COMP%]   .path[_ngcontent-%COMP%]   code[_ngcontent-%COMP%] {
    color: var(--%NS%accent);
  }
}
:root[data-theme=light]   [_nghost-%COMP%]   .path[_ngcontent-%COMP%]   code[_ngcontent-%COMP%] {
  color: var(--%NS%accent);
}

.message[_ngcontent-%COMP%], 
.fix[_ngcontent-%COMP%] {
  margin: 0;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.fix[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
  font-size: 12.5px;
}

.fix-label[_ngcontent-%COMP%] {
  margin-right: 4px;
  color: var(--%NS%accent);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}`]})},HL=()=>[],UL=(e,t)=>t.formId+`#`+t.seq;function WL(e,t){e&1&&Fg(0,`span`,5)}function GL(e,t){if(e&1){let e=W();H(0,`label`)(1,`input`,11),Qg(`change`,function(){let t=O(e).$implicit;return k(K().filter.set(t))}),U(),J(2),U()}if(e&2){let e=t.$implicit,n=K();M(),Vg(`value`,e)(`checked`,e===n.filter()),M(),X(` `,e,` `)}}function KL(e,t){if(e&1&&(H(0,`span`,16),J(1),U()),e&2){let e=K().$implicit;N(`data-tone`,e.outcome===`ran`?``:`bad`),M(),Y(e.outcome)}}function qL(e,t){if(e&1&&(H(0,`span`,16),J(1),U()),e&2){let e=K().$implicit;M(),X(`×`,e.count)}}function JL(e,t){if(e&1&&(H(0,`span`,16),J(1),U()),e&2){let e=K().$implicit;M(),Y(e.origin)}}function YL(e,t){if(e&1&&(H(0,`span`,16),J(1),U()),e&2){let e=K().$implicit;N(`data-tone`,e.ms>1e3?`warn`:``),M(),X(`pending `,e.ms,`ms`)}}function XL(e,t){if(e&1&&(H(0,`span`,16),J(1),U()),e&2){let e=K().$implicit;N(`data-tone`,e.renders>20?`warn`:``),M(),Z(``,e.renders,` renders: `,(e.rendered??ov(3,HL)).join(`, `))}}function ZL(e,t){if(e&1&&(H(0,`span`,19),J(1),U(),H(2,`span`,20),J(3,`→`),U(),H(4,`span`,8),J(5,`changed to`),U()),e&2){let e=K(2).$implicit;M(),Y(e.prev)}}function QL(e,t){if(e&1&&(H(0,`div`,17),P(1,ZL,6,1),J(2),U()),e&2){let e=K().$implicit;M(),F(e.prev===void 0?-1:1),M(),X(` `,e.detail,` `)}}function $L(e,t){if(e&1&&(H(0,`span`,18),J(1),U()),e&2){let e=K().$implicit;M(),X(`from `,e.caller)}}function eR(e,t){if(e&1&&(H(0,`li`)(1,`time`),J(2),U(),H(3,`div`,12)(4,`div`,13)(5,`code`,14),J(6),U(),H(7,`span`,15),J(8),U(),P(9,KL,2,2,`span`,16),P(10,qL,2,1,`span`,16),P(11,JL,2,1,`span`,16),P(12,YL,2,2,`span`,16),P(13,XL,2,4,`span`,16),U(),P(14,QL,3,2,`div`,17),P(15,$L,2,1,`span`,18),U()()),e&2){let e=t.$implicit,n=K(2);N(`data-type`,e.type),M(),N(`datetime`,n.iso(e.timestamp)),M(),Y(n.time(e.timestamp)),M(4),Y(e.path||`(form)`),M(2),Y(e.type),M(),F(e.outcome?9:-1),M(),F(e.count&&e.count>1?10:-1),M(),F(e.origin?11:-1),M(),F(e.ms===void 0?-1:12),M(),F(e.renders?13:-1),M(),F(e.prev!==void 0||e.detail?14:-1),M(),F(e.caller?15:-1)}}function tR(e,t){if(e&1&&(H(0,`ol`,9),I(1,eR,16,12,`li`,null,UL),U()),e&2){let e=K();M(),L(e.shown())}}function nR(e,t){if(e&1&&(H(0,`div`,10)(1,`p`,21),J(2),U(),H(3,`p`),J(4,`Pick another source above, or interact with the form to record more.`),U()()),e&2){let e=K();M(2),X(`No changes from `,e.filter())}}function rR(e,t){e&1&&(H(0,`div`,10)(1,`p`,21),J(2,`No changes yet`),U(),H(3,`p`),J(4,`Type into the form to see them here.`),U()())}var iR=[`all`,`user`,`code`,`agent`,`devtools`],aR=class e{events=$.required();recording=$(!1);record=Ov();toggle(e){let t=e.target;t.checked=this.recording(),this.record.emit(!this.recording())}origins=iR;filter=j(`all`);shown=Q(()=>{let e=this.filter();return this.events().filter(t=>e===`all`||t.origin===e).slice(-100).reverse()});iso(e){return new Date(e).toISOString()}time=SD;static ɵfac=function(t){return new(t||e)};static ɵcmp=Bh({type:e,selectors:[[`app-forms-timeline`]],inputs:{events:[1,`events`],recording:[1,`recording`]},outputs:{record:`record`},decls:17,vars:5,consts:[[1,`toolbar`],[1,`record`],[`type`,`checkbox`,3,`change`,`checked`],[1,`record-text`],[1,`record-title`],[`aria-hidden`,`true`,1,`rec-dot`],[1,`record-hint`],[1,`chips`],[1,`sr-only`],[1,`events`],[1,`empty-state`],[`type`,`radio`,`name`,`timeline-origin`,3,`change`,`value`,`checked`],[1,`body`],[1,`line`],[1,`path`],[1,`event-type`],[1,`tag`],[1,`detail`],[1,`caller`],[1,`prev`],[`aria-hidden`,`true`,1,`arrow`],[1,`empty-title`]],template:function(e,t){e&1&&(H(0,`div`,0)(1,`label`,1)(2,`input`,2),Qg(`change`,function(e){return t.toggle(e)}),U(),H(3,`span`,3)(4,`span`,4),P(5,WL,1,0,`span`,5),J(6,` Record details `),U(),H(7,`span`,6),J(8,`Record calling code, validator changes and renders per keystroke`),U()()(),H(9,`fieldset`,7)(10,`legend`,8),J(11,`Show changes from`),U(),I(12,GL,3,3,`label`,null,wg),U()(),P(14,tR,3,0,`ol`,9)(15,nR,5,1,`div`,10)(16,rR,5,0,`div`,10)),e&2&&(M(),q(`on`,t.recording()),M(),Vg(`checked`,t.recording()),M(3),F(t.recording()?5:-1),M(7),L(t.origins),M(2),F(t.shown().length?14:t.events().length?15:16))},styles:[`.muted[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
}

code[_ngcontent-%COMP%] {
  font-family: var(--%NS%font-mono);
  font-size: 12.5px;
}

.small[_ngcontent-%COMP%] {
  display: inline-block;
  max-width: 100%;
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%surface-2);
  color: var(--%NS%text);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 32px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  transition: background-color 150ms var(--%NS%ease), border-color 150ms var(--%NS%ease), color 150ms var(--%NS%ease), box-shadow 150ms var(--%NS%ease);
}

.small[_ngcontent-%COMP%]:hover {
  background: var(--%NS%surface-3);
  border-color: color-mix(in srgb, var(--%NS%text-3) 55%, var(--%NS%border-strong));
}

.small[_ngcontent-%COMP%]:active {
  background: var(--%NS%border-strong);
}

.small[_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: 2px;
}

.small[_ngcontent-%COMP%]:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.small.primary[_ngcontent-%COMP%] {
  background: var(--%NS%accent);
  border-color: var(--%NS%accent);
  color: var(--%NS%accent-ink);
  font-weight: 600;
}

.small.primary[_ngcontent-%COMP%]:hover {
  background: var(--%NS%accent-hover);
  border-color: var(--%NS%accent-hover);
}

.small.danger[_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%danger) 40%, transparent);
  color: var(--%NS%danger);
}

.small.danger[_ngcontent-%COMP%]:hover {
  background: color-mix(in srgb, var(--%NS%danger) 12%, transparent);
  border-color: color-mix(in srgb, var(--%NS%danger) 55%, transparent);
}

.small.armed[_ngcontent-%COMP%] {
  box-shadow: 0 0 0 3px var(--%NS%accent-soft);
}

.small.danger.armed[_ngcontent-%COMP%] {
  background: var(--%NS%danger);
  border-color: var(--%NS%danger);
  color: #1f0707;
  font-weight: 600;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--%NS%danger) 18%, transparent);
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme=dark])   [_nghost-%COMP%]   .small.danger.armed[_ngcontent-%COMP%] {
    color: #fff;
  }
}
:root[data-theme=light]   [_nghost-%COMP%]   .small.danger.armed[_ngcontent-%COMP%] {
  color: #fff;
}

.field-input[_ngcontent-%COMP%] {
  min-width: 0;
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%bg);
  color: var(--%NS%text);
  font-family: var(--%NS%font-mono);
  font-size: 13px;
  transition: border-color 150ms var(--%NS%ease), box-shadow 150ms var(--%NS%ease);
}

.field-input[_ngcontent-%COMP%]::placeholder {
  color: var(--%NS%text-3);
  font-family: var(--%NS%font-sans);
}

.field-input[_ngcontent-%COMP%]:hover {
  border-color: color-mix(in srgb, var(--%NS%text-3) 55%, var(--%NS%border-strong));
}

.field-input[_ngcontent-%COMP%]:focus, 
.field-input[_ngcontent-%COMP%]:focus-visible {
  outline: none;
  border-color: var(--%NS%accent);
  box-shadow: 0 0 0 3px var(--%NS%accent-soft);
}

.explain[_ngcontent-%COMP%] {
  margin: 0;
  padding: 12px 16px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%bg);
  color: var(--%NS%text);
  font-family: var(--%NS%font-mono);
  font-size: 12.5px;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  tab-size: 2;
}

.explain[aria-busy=true][_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
}

.section-label[_ngcontent-%COMP%] {
  margin: 0;
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.tag[_ngcontent-%COMP%] {
  display: inline-block;
  margin: 0;
  padding: 1px 8px;
  border: 1px solid var(--%NS%border);
  border-radius: 99px;
  background: var(--%NS%surface-2);
  color: var(--%NS%text-2);
  font-size: 11px;
  font-weight: 500;
  line-height: 18px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.tag[data-tone=ok][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%ok) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%ok) 12%, var(--%NS%surface));
  color: var(--%NS%ok);
}

.tag[data-tone=warn][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%warn) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%warn) 12%, var(--%NS%surface));
  color: var(--%NS%warn);
}

.tag[data-tone=bad][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%danger) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%danger) 12%, var(--%NS%surface));
  color: var(--%NS%danger);
}

.status[_ngcontent-%COMP%] {
  margin: 0;
  color: var(--%NS%text-2);
  font-size: 12.5px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.empty-state[_ngcontent-%COMP%] {
  display: grid;
  justify-items: center;
  gap: 6px;
  margin: 0;
  padding: 40px 24px;
  border: 1px dashed var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  color: var(--%NS%text-2);
  font-size: 13px;
  line-height: 1.5;
  text-align: center;
}

.empty-state[_ngcontent-%COMP%]   p[_ngcontent-%COMP%] {
  max-width: 52ch;
  margin: 0;
}

.empty-state[_ngcontent-%COMP%]   .empty-title[_ngcontent-%COMP%] {
  color: var(--%NS%text-strong);
  font-size: 14px;
  font-weight: 600;
}

.spinner[_ngcontent-%COMP%] {
  width: 16px;
  height: 16px;
  border: 2px solid var(--%NS%border-strong);
  border-top-color: var(--%NS%accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

[_nghost-%COMP%] {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.toolbar[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
}

.record[_ngcontent-%COMP%] {
  display: inline-flex;
  flex: 1 1 260px;
  gap: 10px;
  align-items: flex-start;
  min-width: 0;
  padding: 8px 12px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%surface-2);
  cursor: pointer;
  transition: border-color 150ms var(--%NS%ease), background-color 150ms var(--%NS%ease);
}

.record[_ngcontent-%COMP%]:hover {
  border-color: var(--%NS%border-strong);
}

.record.on[_ngcontent-%COMP%] {
  border-color: var(--%NS%accent-line);
  background: var(--%NS%accent-soft);
}

.record[_ngcontent-%COMP%]:has(input:focus-visible) {
  outline: 2px solid var(--%NS%accent);
  outline-offset: 2px;
}

.record[_ngcontent-%COMP%]   input[_ngcontent-%COMP%] {
  flex: none;
  width: 16px;
  height: 16px;
  margin: 2px 0 0;
  accent-color: var(--%NS%accent);
  cursor: pointer;
}

.record[_ngcontent-%COMP%]   input[_ngcontent-%COMP%]:focus-visible {
  outline: none;
}

.record-text[_ngcontent-%COMP%] {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.record-title[_ngcontent-%COMP%] {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  color: var(--%NS%text-strong);
  font-size: 13px;
  font-weight: 500;
}

.record-hint[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
  font-size: 12px;
  line-height: 1.4;
}

.rec-dot[_ngcontent-%COMP%] {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--%NS%danger);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--%NS%danger) 20%, transparent);
  animation: _ngcontent-%COMP%_rec-pulse 1.6s ease-in-out infinite;
}

@keyframes _ngcontent-%COMP%_rec-pulse {
  50% {
    opacity: 0.45;
  }
}
.chips[_ngcontent-%COMP%] {
  display: inline-flex;
  flex: none;
  gap: 2px;
  min-width: 0;
  height: 34px;
  margin: 0;
  padding: 2px;
  background: var(--%NS%bg);
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius-sm);
}

.chips[_ngcontent-%COMP%]   label[_ngcontent-%COMP%] {
  position: relative;
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  border-radius: 7px;
  color: var(--%NS%text-2);
  font-size: 12.5px;
  font-weight: 500;
  text-transform: capitalize;
  cursor: pointer;
  user-select: none;
  transition: background-color 150ms var(--%NS%ease), color 150ms var(--%NS%ease), box-shadow 150ms var(--%NS%ease);
}

.chips[_ngcontent-%COMP%]   label[_ngcontent-%COMP%]:hover {
  color: var(--%NS%text);
  background: var(--%NS%surface-2);
}

.chips[_ngcontent-%COMP%]   input[_ngcontent-%COMP%] {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.chips[_ngcontent-%COMP%]   label[_ngcontent-%COMP%]:has(input:checked) {
  background: var(--%NS%surface-3);
  color: var(--%NS%text-strong);
  box-shadow: inset 0 0 0 1px var(--%NS%border-strong);
}

.chips[_ngcontent-%COMP%]   label[_ngcontent-%COMP%]:has(input:focus-visible) {
  outline: 2px solid var(--%NS%accent);
  outline-offset: 2px;
}

.events[_ngcontent-%COMP%] {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 4px;
  list-style: none;
  background: var(--%NS%surface-2);
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius-sm);
  font-size: 13px;
  animation: enter 0.35s var(--%NS%ease) both;
}

.events[_ngcontent-%COMP%]   li[_ngcontent-%COMP%] {
  display: grid;
  grid-template-columns: 11ch minmax(0, 1fr);
  gap: 12px;
  align-items: baseline;
  padding: 8px 12px;
  border-radius: 6px;
  color: var(--%NS%text);
  transition: background-color 150ms var(--%NS%ease);
}

.events[_ngcontent-%COMP%]   li[_ngcontent-%COMP%]:hover {
  background: var(--%NS%surface-3);
}

.events[_ngcontent-%COMP%]   li[data-type=submit][_ngcontent-%COMP%] {
  background: var(--%NS%accent-soft);
  box-shadow: inset 2px 0 0 var(--%NS%accent);
  color: var(--%NS%text-strong);
}

.events[_ngcontent-%COMP%]   li[data-type=submit][_ngcontent-%COMP%]   time[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
}

time[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-family: var(--%NS%font-mono);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.body[_ngcontent-%COMP%] {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.line[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 8px;
  align-items: center;
  min-width: 0;
}

.path[_ngcontent-%COMP%] {
  color: #fde68a;
  overflow-wrap: anywhere;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme=dark])   [_nghost-%COMP%]   .path[_ngcontent-%COMP%] {
    color: var(--%NS%accent);
  }
}
:root[data-theme=light]   [_nghost-%COMP%]   .path[_ngcontent-%COMP%] {
  color: var(--%NS%accent);
}

.event-type[_ngcontent-%COMP%] {
  color: var(--%NS%text-strong);
  font-size: 12px;
  font-weight: 600;
}

.tag[_ngcontent-%COMP%] {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.detail[_ngcontent-%COMP%] {
  color: var(--%NS%text);
  font-family: var(--%NS%font-mono);
  font-size: 12.5px;
  overflow-wrap: anywhere;
}

.prev[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
  text-decoration: line-through;
  text-decoration-color: color-mix(in srgb, var(--%NS%text-2) 50%, transparent);
}

.arrow[_ngcontent-%COMP%] {
  margin: 0 6px;
  color: var(--%NS%text-3);
}

.caller[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-family: var(--%NS%font-mono);
  font-size: 12px;
  overflow-wrap: anywhere;
}

@media (max-width: 480px) {
  .events[_ngcontent-%COMP%]   li[_ngcontent-%COMP%] {
    grid-template-columns: minmax(0, 1fr);
    gap: 4px;
  }
  .chips[_ngcontent-%COMP%] {
    width: 100%;
  }
  .chips[_ngcontent-%COMP%]   label[_ngcontent-%COMP%] {
    flex: 1;
    justify-content: center;
    padding: 0 8px;
  }
}`]})},oR=(e,t)=>t.path;function sR(e,t){e&1&&(H(0,`span`,6),J(1,`duplicate name`),U())}function cR(e,t){if(e&1&&(H(0,`p`,7),J(1),U()),e&2){let e=K();M(),Y(e.description)}}function lR(e,t){if(e&1&&(H(0,`p`,8),J(1),U()),e&2){let e=K();M(),Y(e.error)}}function uR(e,t){if(e&1&&(H(0,`li`)(1,`code`),J(2),U(),J(3),U()),e&2){let e=t.$implicit;M(2),Y(e.path),M(),X(` is `,e.reason,` `)}}function dR(e,t){if(e&1&&(H(0,`div`,9)(1,`p`,10),J(2,`Angular could not infer an input schema. These fields block it:`),U(),H(3,`ul`),I(4,uR,4,2,`li`,null,oR),U()()),e&2){let e=K();M(4),L(e.blocking)}}function fR(e,t){e&1&&(H(0,`span`,12),J(1,`required`),U())}function pR(e,t){if(e&1&&(H(0,`li`)(1,`code`),J(2),U(),P(3,fR,2,0,`span`,12),U()),e&2){let e=t.$implicit,n=K(3);M(2),Y(e),M(),F(n.isRequired(e)?3:-1)}}function mR(e,t){if(e&1&&(H(0,`div`,9)(1,`p`,10),J(2,`Inputs`),U(),H(3,`ul`,11),I(4,pR,4,2,`li`,null,wg),U()()),e&2){let e=K();M(4),L(e.inputs)}}function hR(e,t){if(e&1&&(H(0,`li`)(1,`code`),J(2),U(),J(3),U()),e&2){let e=t.$implicit;M(2),Y(e.path),M(),X(` is now `,e.now?`required`:`optional`,` `)}}function gR(e,t){if(e&1&&(H(0,`div`,9)(1,`p`,10),J(2,` Required changed since registration. Angular reads it once, so agents still see the old schema: `),U(),H(3,`ul`),I(4,hR,4,2,`li`,null,oR),U()()),e&2){let e=K();M(4),L(e.requiredChanged)}}function _R(e,t){if(e&1&&(H(0,`span`,10),J(1),U()),e&2){let e=K().$implicit;M(),X(``,e.ms,` ms`)}}function vR(e,t){if(e&1&&(H(0,`span`,10),J(1),U()),e&2){let e=K().$implicit;M(),X(`fields `,e.fields.join(`, `))}}function yR(e,t){if(e&1&&(H(0,`pre`,13),J(1),U()),e&2){let e=K().$implicit;M(),Y(e.detail)}}function bR(e,t){if(e&1&&(H(0,`li`)(1,`time`),J(2),dv(3,`date`),U(),H(4,`span`,5),J(5),U(),P(6,_R,2,1,`span`,10),P(7,vR,2,1,`span`,10),P(8,yR,2,1,`pre`,13),U()),e&2){let e=t.$implicit,n=K(3);M(),N(`datetime`,n.iso(e.at)),M(),Y(mv(3,7,e.at,`HH:mm:ss`)),M(2),N(`data-state`,e.outcome),M(),Y(n.outcome(e.outcome)),M(),F(e.ms===void 0?-1:6),M(),F(e.fields?.length?7:-1),M(),F(e.detail?8:-1)}}function xR(e,t){if(e&1&&(H(0,`ul`),I(1,bR,9,10,`li`,null,Cg),U()),e&2){let e=K();M(),L(e.calls)}}function SR(e,t){e&1&&(H(0,`p`,10),J(1,` Calls are not recorded for a tool registered before the inspector attached. `),U())}function CR(e,t){e&1&&(H(0,`p`,10),J(1,`No agent has called this tool since the inspector attached.`),U())}function wR(e,t){if(e&1&&(H(0,`section`,0)(1,`div`,2)(2,`h3`,3),J(3,`WebMCP tool`),U(),H(4,`code`,4),J(5),U(),H(6,`span`,5),J(7),U(),P(8,sR,2,0,`span`,6),U(),P(9,cR,2,1,`p`,7),P(10,lR,2,1,`p`,8),P(11,dR,6,0,`div`,9),P(12,mR,6,0,`div`,9),P(13,gR,6,0,`div`,9),H(14,`div`,9)(15,`p`,10),J(16,`Recent calls`),U(),P(17,xR,3,0,`ul`)(18,SR,2,0,`p`,10)(19,CR,2,0,`p`,10),U()()),e&2){let e=t,n=K();M(5),Y(e.name),M(),N(`data-state`,e.status),M(),Y(n.statusText()),M(),F(e.duplicate?8:-1),M(),F(e.description?9:-1),M(),F(e.status===`failed`&&e.error&&e.error!==`schema`?10:-1),M(),F(e.blocking?.length?11:-1),M(),F(e.inputs?.length?12:-1),M(),F(e.requiredChanged?.length?13:-1),M(4),F(e.calls?.length?17:e.seen===`list`?18:19)}}function TR(e,t){e&1&&(H(0,`p`,1),J(1,` This app uses `),H(2,`code`),J(3,`provideExperimentalWebMcpForms()`),U(),J(4,`, but the browser has no `),H(5,`code`),J(6,`modelContext`),U(),J(7,`, so Angular registers no WebMCP tool for this form. `),U())}var ER={running:`running`,submitted:`submitted`,failed:`submit failed`,done:`done`,threw:`threw`},DR=class e{tool=$();page=$();signalForm=$(!1);statusText=Q(()=>{let e=this.tool();return e?e.status===`failed`?`not registered`:e.status===`registering`?`registering`:e.seen===`list`?`registered before the inspector attached`:`registered`:``});noModelContext=Q(()=>{let e=this.page();return this.signalForm()&&!!e&&!e.modelContext&&!!e.provided});isRequired(e){let t=e.slice(0,e.lastIndexOf(`:`));return this.tool()?.required?.includes(t)??!1}outcome(e){return ER[e]??e}iso(e){return new Date(e).toISOString()}static ɵfac=function(t){return new(t||e)};static ɵcmp=Bh({type:e,selectors:[[`app-forms-webmcp`]],inputs:{tool:[1,`tool`],page:[1,`page`],signalForm:[1,`signalForm`]},decls:2,vars:1,consts:[[`aria-labelledby`,`forms-webmcp-title`,1,`webmcp`],[1,`note`],[1,`head`],[`id`,`forms-webmcp-title`,1,`section-label`],[1,`name`],[1,`state`],[`data-state`,`failed`,1,`state`],[1,`description`],[1,`problem`],[1,`group`],[1,`muted`],[1,`inputs`],[1,`tag`],[1,`detail`]],template:function(e,t){if(e&1&&P(0,wR,20,10,`section`,0)(1,TR,8,0,`p`,1),e&2){let e;F((e=t.tool())?0:t.noModelContext()?1:-1,e)}},dependencies:[ib],styles:[`[_nghost-%COMP%] {
  display: contents;
}

.webmcp[_ngcontent-%COMP%] {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 8px 12px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%surface-2);
  font-size: 13px;
  color: var(--%NS%text);
}

.head[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 10px;
  align-items: center;
}

.section-label[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin: 0;
}

code[_ngcontent-%COMP%] {
  font-family: var(--%NS%font-mono);
  font-size: 12.5px;
  overflow-wrap: anywhere;
}

.name[_ngcontent-%COMP%] {
  font-weight: 600;
}

.state[_ngcontent-%COMP%] {
  padding: 0 8px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: 999px;
  color: var(--%NS%text-2);
  font-size: 12px;
  line-height: 20px;
}

.state[data-state=failed][_ngcontent-%COMP%], 
.state[data-state=threw][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%danger) 45%, transparent);
  color: var(--%NS%danger);
}

.state[data-state=registered][_ngcontent-%COMP%], 
.state[data-state=submitted][_ngcontent-%COMP%] {
  border-color: var(--%NS%accent-line);
  color: var(--%NS%text);
}

.description[_ngcontent-%COMP%], 
.problem[_ngcontent-%COMP%], 
.note[_ngcontent-%COMP%] {
  margin: 0;
  overflow-wrap: anywhere;
}

.problem[_ngcontent-%COMP%] {
  color: var(--%NS%danger);
}

.note[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
  font-size: 13px;
}

.muted[_ngcontent-%COMP%] {
  margin: 0;
  color: var(--%NS%text-2);
}

.group[_ngcontent-%COMP%] {
  display: grid;
  gap: 4px;
  min-width: 0;
}

ul[_ngcontent-%COMP%] {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0 0 0 16px;
  overflow-wrap: anywhere;
}

li[_ngcontent-%COMP%] {
  min-width: 0;
}

li[_ngcontent-%COMP%]    > *[_ngcontent-%COMP%]    + *[_ngcontent-%COMP%] {
  margin-left: 6px;
}

.tag[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
  font-size: 11px;
}

.detail[_ngcontent-%COMP%] {
  margin: 4px 0 0;
  padding: 6px 8px;
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%bg);
  font-family: var(--%NS%font-mono);
  font-size: 12px;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}`]})},OR=()=>[],kR=(e,t)=>t.id,AR=(e,t)=>t.node.path;function jR(e,t){e&1&&(z(0,`div`,0),V(1,`span`,4),z(2,`p`),J(3,`Connecting to the devtools server…`),B()())}function MR(e,t){if(e&1){let e=W();z(0,`div`,1)(1,`p`,5),J(2,`Could not load forms`),B(),z(3,`p`,6),J(4,` The devtools server did not answer. Check that the app is running, then try again. `),B(),z(5,`button`,7),G(`click`,function(){return O(e),k(K().retry())}),J(6,`Try again`),B()()}}function NR(e,t){e&1&&(z(0,`div`,0),V(1,`span`,4),z(2,`p`),J(3,`Loading forms…`),B()())}function PR(e,t){e&1&&(z(0,`div`,2)(1,`p`,5),J(2,`No forms on the page yet`),B(),z(3,`p`,6),J(4,` Open a page that renders a form. Signal Forms, reactive and template-driven forms all show up here, in development builds. `),B()())}function FR(e,t){if(e&1){let e=W();z(0,`div`,2)(1,`p`,5),J(2,`No forms on this page`),B(),z(3,`p`,6),J(4),B(),z(5,`button`,7),G(`click`,function(){return O(e),k(K().allPages.set(!0))}),J(6,` Show forms from all pages `),B()()}if(e&2){let e=K();M(4),Z(` Other connected tabs report `,e.forms().length,` `,e.forms().length===1?`form`:`forms`,`. `)}}function IR(e,t){if(e&1){let e=W();z(0,`label`,11)(1,`input`,15),G(`change`,function(t){return O(e),k(K(2).allPages.set(t.target.checked))}),B(),J(2,` All pages `),B()}if(e&2){let e=K(2);M(),R(`checked`,e.allPages())}}function LR(e,t){e&1&&(z(0,`span`,22),J(1),z(2,`span`,21),J(3,` errors`),B()()),e&2&&(M(),Y(t))}function RR(e,t){if(e&1){let e=W();z(0,`li`)(1,`button`,16),G(`click`,function(){let t=O(e).$implicit;return k(K(2).selectForm(t.id))}),V(2,`span`,17),z(3,`span`,18),J(4),B(),z(5,`span`,19),J(6),z(7,`span`,20),J(8),B(),z(9,`span`,21),J(10),B()(),P(11,LR,4,1,`span`,22),B()()}if(e&2){let e,n=t.$implicit,r=K(2);M(),q(`active`,n.id===r.selected()?.id),N(`aria-current`,n.id===r.selected()?.id?`true`:null),M(),N(`data-status`,n.root.status),M(),N(`title`,n.label),M(),Y(n.label),M(2),X(``,r.kindLabel(n.kind),` · `),M(2),Y(n.id),M(2),X(`, `,n.root.status),M(),F((e=r.counts().get(n.id)?.errors)?11:-1,e)}}function zR(e,t){if(e&1){let e=W();z(0,`section`,13)(1,`h2`,23),J(2),B(),z(3,`p`,24),J(4,` This form is no longer on the page. It comes back here if the page renders it again. `),B(),z(5,`button`,7),G(`click`,function(){O(e);let t=K(2);return k(t.selectForm(t.visible()[0].id))}),J(6),B()()}if(e&2){let e=K(2);M(2),Y(t),M(4),X(` Show `,e.visible()[0].label,` `)}}function BR(e,t){if(e&1&&(z(0,`span`),J(1),B()),e&2){let e=K();M(),Y(e.submitted?`submitted`:`not submitted`)}}function VR(e,t){e&1&&(z(0,`span`),J(1,`submitting`),B())}function HR(e,t){if(e&1&&(z(0,`li`)(1,`code`),J(2),B(),J(3),z(4,`code`,46),J(5),B()()),e&2){let e=t.$implicit;M(2),Y(e.path||`(form)`),M(),X(` `,e.message,` `),M(2),Y(e.kind)}}function UR(e,t){if(e&1&&(z(0,`details`,30)(1,`summary`),J(2),B(),z(3,`ul`),I(4,HR,6,3,`li`,null,Cg),B()()),e&2){let e=K();M(2),X(`Error summary (`,e.errorSummary.length,`)`),M(2),L(e.errorSummary)}}function WR(e,t){if(e&1){let e=W();z(0,`button`,34),G(`click`,function(){return O(e),k(K(3).confirmAct(`restore`))}),J(1),B()}if(e&2){let e=K(3);q(`armed`,e.armed()===`restore`),R(`disabled`,!e.canWrite()),N(`aria-describedby`,e.canWrite()?null:`forms-writes-off`)(`title`,`Restore `+e.snapshot()),M(),X(` `,e.armed()===`restore`?`Confirm restore`:`Restore `+e.snapshot(),` `)}}function GR(e,t){if(e&1&&(z(0,`p`,40),J(1),B()),e&2){let e=K(3);M(),Y(e.writesOff)}}function KR(e,t){if(e&1){let e=W();z(0,`button`,47),G(`click`,function(){let t=O(e).$implicit;return k(K(3).tab_.set(t.id))}),J(1),B()}if(e&2){let e=t.$implicit,n=K(3);R(`id`,`forms-tab-`+e.id),N(`aria-selected`,e.id===n.tab_())(`aria-controls`,`forms-panel-`+e.id)(`tabindex`,e.id===n.tab_()?0:-1),M(),X(` `,e.label,` `)}}function qR(e,t){if(e&1){let e=W();z(0,`label`)(1,`input`,15),G(`change`,function(){let t=O(e).$implicit;return k(K(4).toggleChip(t.id))}),B(),J(2),B()}if(e&2){let e=t.$implicit,n=K(4);M(),R(`checked`,n.active().has(e.id)),M(),X(` `,e.label,` `)}}function JR(e,t){if(e&1&&(z(0,`div`,6),J(1,` typed `),z(2,`code`),J(3),dv(4,`json`),B(),J(5,`, not in the model yet `),B()),e&2){let e=K(2).$implicit;M(3),Y(pv(4,1,e.node.uncommitted))}}function YR(e,t){if(e&1&&(z(0,`div`,6),J(1,` resets to `),z(2,`code`),J(3),dv(4,`json`),B()()),e&2){let e=K(2).$implicit;M(3),Y(pv(4,1,e.node.defaultValue))}}function XR(e,t){if(e&1&&(z(0,`code`),J(1),dv(2,`json`),B(),P(3,JR,6,3,`div`,6),P(4,YR,5,3,`div`,6)),e&2){let e=K().$implicit;M(),Y(pv(2,3,e.node.value)),M(2),F(e.node.uncommitted===void 0?-1:3),M(),F(e.node.defaultValue===void 0?-1:4)}}function ZR(e,t){e&1&&(z(0,`span`,6),J(1,`not created yet`),B())}function QR(e,t){if(e&1&&(z(0,`span`,28),J(1),B()),e&2){let e=K().$implicit;N(`data-status`,e.node.status),M(),Y(e.node.status)}}function $R(e,t){e&1&&(z(0,`span`),J(1,`touched`),B())}function ez(e,t){if(e&1&&(z(0,`span`),J(1),B()),e&2){let e=K().$implicit;M(),Y(e.node.changed===!1?`dirty, unchanged`:`dirty`)}}function tz(e,t){if(e&1&&(z(0,`span`),J(1),B()),e&2){let e=K().$implicit;M(),X(`not validated (`,e.node.skipped,`)`)}}function nz(e,t){if(e&1&&(z(0,`span`,62),J(1),B()),e&2){let e=K().$implicit;M(),X(`stale: `,e.node.stale.join(`, `))}}function rz(e,t){e&1&&(z(0,`span`,62),J(1,`view out of sync`),B())}function iz(e,t){if(e&1&&(z(0,`span`),J(1),B()),e&2){let e=K().$implicit,t=K(4);M(),X(`redacted: `,t.redactLabel(e.node.redacted))}}function az(e,t){e&1&&(z(0,`span`),J(1,`required`),B())}function oz(e,t){e&1&&(z(0,`span`),J(1,`readonly`),B())}function sz(e,t){e&1&&(z(0,`span`),J(1,`hidden`),B())}function cz(e,t){if(e&1&&(z(0,`span`),J(1),B()),e&2){let e=K().$implicit;M(),X(`updates on `,e.node.updateOn)}}function lz(e,t){e&1&&(z(0,`span`),J(1,`debouncing`),B())}function uz(e,t){e&1&&(z(0,`span`),J(1,`validators`),B())}function dz(e,t){e&1&&(z(0,`span`),J(1,`async validator`),B())}function fz(e,t){if(e&1&&(z(0,`span`),J(1),B()),e&2){let e=t.$implicit;M(),Y(e)}}function pz(e,t){if(e&1&&(z(0,`span`),J(1),B()),e&2){let e=K().$implicit;M(),Y(e.node.accessor)}}function mz(e,t){if(e&1&&(z(0,`span`),J(1),B()),e&2){let e=K().$implicit;M(),X(`name `,e.node.name)}}function hz(e,t){if(e&1&&(z(0,`span`),J(1),dv(2,`json`),B()),e&2){let e=t.$implicit;M(),X(`metadata `,pv(2,1,e))}}function gz(e,t){if(e&1&&(z(0,`span`),J(1),B()),e&2){let e=t.$implicit;M(),X(`disabled: `,e)}}function _z(e,t){if(e&1&&(z(0,`span`,65),J(1),B()),e&2){let e=K().$implicit;M(),X(`at `,e.params.path)}}function vz(e,t){if(e&1&&(z(0,`span`,65),J(1),B()),e&2){let e=K().$implicit,t=K(5);M(),Y(t.sourceText(e))}}function yz(e,t){if(e&1&&(z(0,`div`),J(1),z(2,`code`,46),J(3),B(),P(4,_z,2,1,`span`,65),P(5,vz,2,1,`span`,65),B()),e&2){let e=t.$implicit,n=K().$implicit,r=K(4);M(),X(` `,r.errorText(n.node,e),` `),M(2),Y(e.kind),M(),F(e.kind===`standardSchema`&&e.params?.path?4:-1),M(),F(e.source?5:-1)}}function bz(e,t){e&1&&(z(0,`div`,64),J(1,`not shown to the user`),B())}function xz(e,t){if(e&1&&(z(0,`tr`)(1,`td`,66),J(2),B()()),e&2){let e=K().$implicit;M(),C_(`padding-left`,28+e.depth*16,`px`),M(),Z(` `,e.node.truncated,` more fields under `,e.node.path||`the form`,` not shown `)}}function Sz(e,t){if(e&1){let e=W();z(0,`tr`,55),G(`mouseenter`,function(){let t=O(e).$implicit,n=K(2);return k(K(2).highlight(n.id,t.node.path))})(`mouseleave`,function(){return O(e),k(K(4).highlight(null,``))}),z(1,`th`,56)(2,`button`,57),G(`focus`,function(){let t=O(e).$implicit,n=K(2);return k(K(2).highlight(n.id,t.node.path))})(`blur`,function(){return O(e),k(K(4).highlight(null,``))})(`click`,function(){let t=O(e).$implicit;return k(K(4).toggleField(t.node.path))}),J(3),B(),z(4,`span`,58),J(5),B()(),z(6,`td`,59),P(7,XR,5,5),B(),z(8,`td`,60),P(9,ZR,2,0,`span`,6)(10,QR,2,2,`span`,28),B(),z(11,`td`,61),P(12,$R,2,0,`span`),P(13,ez,2,1,`span`),P(14,tz,2,1,`span`),P(15,nz,2,1,`span`,62),P(16,rz,2,0,`span`,62),P(17,iz,2,1,`span`),P(18,az,2,0,`span`),P(19,oz,2,0,`span`),P(20,sz,2,0,`span`),P(21,cz,2,1,`span`),P(22,lz,2,0,`span`),P(23,uz,2,0,`span`),P(24,dz,2,0,`span`),I(25,fz,2,1,`span`,null,wg),P(27,pz,2,1,`span`),P(28,mz,2,1,`span`),I(29,hz,3,3,`span`,null,Cg),I(31,gz,2,1,`span`,null,Cg),B(),z(33,`td`,63),I(34,yz,6,4,`div`,null,Cg),P(36,bz,2,0,`div`,64),B()(),P(37,xz,3,4,`tr`)}if(e&2){let e=t.$implicit,n=K(4);q(`invalid`,e.node.errors.length),M(),C_(`padding-left`,12+e.depth*16,`px`),M(),N(`aria-label`,`Show details for `+(e.node.path||`the form`))(`aria-pressed`,e.node.path===n.fieldPath())(`title`,e.node.path||`(form)`),M(),X(` `,e.node.key||`(form)`,` `),M(2),Y(e.node.type),M(2),F(e.node.type===`control`?7:-1),M(2),F(e.node.materialized===!1?9:10),M(3),F(e.node.touched?12:-1),M(),F(e.node.dirty?13:-1),M(),F(e.node.skipped?14:-1),M(),F(e.node.stale?.length?15:-1),M(),F(e.node.dom?.drift===void 0?-1:16),M(),F(e.node.redacted?17:-1),M(),F(e.node.required?18:-1),M(),F(e.node.readonly?19:-1),M(),F(e.node.hidden?20:-1),M(),F(e.node.updateOn?21:-1),M(),F(e.node.debouncing?22:-1),M(),F(e.node.validators?.sync?23:-1),M(),F(e.node.validators?.async?24:-1),M(),L(n.constraintList(e.node)),M(2),F(e.node.accessor?27:-1),M(),F(e.node.name?28:-1),M(),L(e.node.metadata??ov(28,OR)),M(2),L(e.node.disabledReasons??ov(29,OR)),M(3),L(e.node.errors),M(2),F(e.node.errors.length&&e.node.dom?.errorShown===!1?36:-1),M(),F(e.node.truncated?37:-1)}}function Cz(e,t){e&1&&J(0),e&2&&X(` No field path matches "`,K(5).filter(),`". `)}function wz(e,t){e&1&&J(0,` No field matches the selected filters. `)}function Tz(e,t){if(e&1&&(z(0,`tr`)(1,`td`,67),P(2,Cz,1,1)(3,wz,1,0),B()()),e&2){let e=K(4);M(2),F(e.filter()?2:3)}}function Ez(e,t){if(e&1){let e=W();z(0,`app-forms-field-detail`,68),G(`closed`,function(){return O(e),k(K(4).closeField())}),B()}if(e&2){let e=K(2),n=K(2);R(`form`,e)(`node`,t)(`version`,n.version())(`rpc`,n.rpc())}}function Dz(e,t){if(e&1){let e=W();z(0,`div`,48)(1,`input`,49),G(`input`,function(t){return O(e),k(K(3).onFilter(t))}),B(),z(2,`fieldset`,50)(3,`legend`,21),J(4,`Show only fields that are`),B(),I(5,qR,3,2,`label`,null,kR),B()(),z(7,`div`,51)(8,`table`,52)(9,`thead`)(10,`tr`)(11,`th`,53),J(12,`Field`),B(),z(13,`th`,53),J(14,`Value`),B(),z(15,`th`,53),J(16,`Status`),B(),z(17,`th`,53),J(18,`State`),B(),z(19,`th`,53),J(20,`Errors`),B()()(),z(21,`tbody`),I(22,Sz,38,30,null,null,AR,!1,Tz,4,1,`tr`),B()()(),P(25,Ez,1,4,`app-forms-field-detail`,54)}if(e&2){let e,t=K(3);M(),R(`value`,t.filter()),M(4),L(t.chips),M(17),L(t.rows()),M(3),F((e=t.selectedNode())?25:-1,e)}}function Oz(e,t){if(e&1){let e=W();V(0,`app-limit-note`,69),z(1,`app-forms-timeline`,70),G(`record`,function(t){return O(e),k(K(3).setRecording(t))}),B()}if(e&2){let e=K(3);R(`dropped`,e.droppedEvents())(`max`,e.maxEvents()),M(),R(`events`,e.selectedEvents())(`recording`,e.recording())}}function kz(e,t){if(e&1&&V(0,`app-forms-submit`,45),e&2){let e=K(),t=K(2);R(`formId`,e.id)(`version`,t.version())(`rpc`,t.rpc())}}function Az(e,t){if(e&1&&V(0,`app-forms-lint`,45),e&2){let e=K(),t=K(2);R(`formId`,e.id)(`version`,t.version())(`rpc`,t.rpc())}}function jz(e,t){if(e&1){let e=W();z(0,`section`,14)(1,`div`,25)(2,`h2`,23),J(3),B(),z(4,`p`,26),J(5),z(6,`code`),J(7),B()()(),z(8,`div`,27)(9,`span`,28),J(10),B(),z(11,`span`),J(12),B(),z(13,`span`),J(14),B(),P(15,BR,2,1,`span`),P(16,VR,2,0,`span`),z(17,`span`,29)(18,`b`),J(19),B(),J(20,` fields · `),z(21,`b`),J(22),B(),J(23,` errors`),B()(),P(24,UR,6,1,`details`,30),V(25,`app-forms-webmcp`,31),z(26,`div`,32)(27,`div`,33)(28,`button`,34),G(`click`,function(){return O(e),k(K(2).act(`touch-all`))}),J(29,` Touch all `),B(),z(30,`button`,34),G(`click`,function(){return O(e),k(K(2).act(`revalidate`))}),J(31,` Revalidate `),B(),z(32,`button`,7),G(`click`,function(){return O(e),k(K(2).act(`focus-first-invalid`))}),J(33,` Focus first invalid `),B(),z(34,`button`,7),G(`click`,function(){O(e);let t=K(2);return k(t.picking()?t.cancelPick():t.pick())}),J(35),B(),V(36,`span`,35),z(37,`button`,7),G(`click`,function(){return O(e),k(K(2).act(`snapshot`))}),J(38,`Snapshot`),B(),P(39,WR,2,6,`button`,36),V(40,`span`,37),z(41,`button`,38),G(`click`,function(){return O(e),k(K(2).confirmAct(`reset`))}),J(42),B(),z(43,`button`,39),G(`click`,function(){return O(e),k(K(2).confirmAct(`submit`))}),J(44),B()(),P(45,GR,2,1,`p`,40),z(46,`p`,41),J(47),B()(),z(48,`div`,42),G(`keydown`,function(t){return O(e),k(K(2).onKey(t))}),I(49,KR,2,5,`button`,43,kR),B(),z(51,`div`,44),P(52,Dz,26,3)(53,Oz,2,4)(54,kz,1,3,`app-forms-submit`,45)(55,Az,1,3,`app-forms-lint`,45),B()()}if(e&2){let e,n=t,r=K(2);M(3),Y(n.label),M(2),X(` `,r.kindLabel(n.kind),` · `),M(2),Y(n.id),M(2),N(`data-status`,n.root.status),M(),Y(n.root.status),M(2),Y(n.root.dirty?`dirty`:`pristine`),M(2),Y(n.root.touched?`touched`:`untouched`),M(),F(n.submitted===void 0?-1:15),M(),F(n.root.submitting?16:-1),M(3),Y(r.counts().get(n.id)?.fields),M(2),q(`has-errors`,r.counts().get(n.id)?.errors),M(),Y(r.counts().get(n.id)?.errors),M(2),F(n.errorSummary?.length?24:-1),M(),R(`tool`,n.webMcp)(`page`,r.webMcpPage(n.id))(`signalForm`,n.kind===`signal`),M(3),R(`disabled`,!r.canWrite()),N(`aria-describedby`,r.canWrite()?null:`forms-writes-off`),M(2),R(`disabled`,!r.canWrite()),N(`aria-describedby`,r.canWrite()?null:`forms-writes-off`),M(4),q(`on`,r.picking()),N(`aria-pressed`,!!r.picking()),M(),X(` `,r.picking()?`Cancel picking`:`Pick field on page`,` `),M(4),F(r.snapshot()?39:-1),M(2),q(`armed`,r.armed()===`reset`),R(`disabled`,!r.canWrite()),N(`aria-describedby`,r.canWrite()?null:`forms-writes-off`),M(),X(` `,r.armed()===`reset`?`Confirm reset`:`Reset`,` `),M(),q(`armed`,r.armed()===`submit`),R(`disabled`,!r.canWrite()),N(`aria-describedby`,r.canWrite()?null:`forms-writes-off`),M(),X(` `,r.armed()===`submit`?`Confirm submit`:`Submit`,` `),M(),F(r.canWrite()?-1:45),M(2),Y(r.message()),M(2),L(r.tabs),M(2),R(`id`,`forms-panel-`+r.tab_()),N(`aria-labelledby`,`forms-tab-`+r.tab_()),M(),F((e=r.tab_())===`fields`?52:e===`timeline`?53:e===`submit`?54:e===`lint`?55:-1)}}function Mz(e,t){if(e&1&&(z(0,`div`,3)(1,`div`,8)(2,`h2`,9),J(3,` Forms `),z(4,`span`,10),J(5),B()(),P(6,IR,3,1,`label`,11),z(7,`ul`,12),I(8,RR,12,10,`li`,null,kR),B()(),P(10,zR,7,2,`section`,13)(11,jz,56,41,`section`,14),B()),e&2){let e,t=K();M(5),Y(t.visible().length),M(),F(t.hostPageId&&(t.allPages()||t.otherPages())?6:-1),M(2),L(t.visible()),M(2),F((e=t.missing())?10:(e=t.selected())?11:-1,e)}}var Nz=[{id:`fields`,label:`Fields`},{id:`timeline`,label:`Timeline`},{id:`submit`,label:`Submit`},{id:`lint`,label:`Lint`}],Pz=[{id:`invalid`,label:`Invalid`},{id:`dirty`,label:`Dirty`},{id:`touched`,label:`Touched`},{id:`disabled`,label:`Disabled`},{id:`hidden-error`,label:`Error not shown`}];function Fz(e,t){switch(t){case`invalid`:return e.errors.length>0;case`dirty`:return e.dirty&&e.type===`control`;case`touched`:return e.touched&&e.type===`control`;case`disabled`:return e.status===`DISABLED`;case`hidden-error`:return e.dom?.errorShown===!1}}function Iz(e){return e.errors.length+(e.children??[]).reduce((e,t)=>e+Iz(t),0)}function Lz(e){return e.children?e.children.reduce((e,t)=>e+Lz(t),0):+(e.type===`control`&&e.materialized!==!1)}var Rz=class e{rpc=$(null);focus=$(null);canWrite=Q(()=>cE(this.rpc(),`forms`));redactLabel=yL;writesOff=GT(`forms`);focusHandled=Ov();forms=j([]);webMcp=j([]);events=j([]);loading=j(!0);failed=j(!1);selectedId=j(null);selectedLabel=j(null);hostPageId=$T();allPages=j(!1);visible=Q(()=>{let e=this.forms(),t=this.hostPageId;return t&&!this.allPages()?e.filter(e=>mL(e.id)===t):e});otherPages=Q(()=>this.forms().some(e=>mL(e.id)!==this.hostPageId));instrumented=j([]);recording=Q(()=>{let e=this.selected()?.id??``;return this.instrumented().some(t=>e.endsWith(`@${t}`))});filter=j(``);tabs=Nz;chips=Pz;tab_=j(`fields`);active=j(new Set);fieldPath=j(null);version=j(0);message=j(``);armed=j(null);snapshot=j(null);webMcpPage(e){let t=mL(e);return this.webMcp().find(e=>e.pageId===t)}picking=j(null);pickSeq=0;unsubscribe=null;destroyRef=E(Cs);host=E(Ml);counts=Q(()=>new Map(this.visible().map(e=>[e.id,{fields:Lz(e.root),errors:Iz(e.root)}])));selected=Q(()=>{let e=this.visible(),t=this.selectedId();if(t===null)return e[0]??null;let n=this.selectedLabel(),r=mL(t);return e.find(e=>e.id===t)??e.find(e=>e.label===n&&mL(e.id)===r)??null});missing=Q(()=>this.selectedId()!==null&&!this.selected()&&this.visible().length?this.selectedLabel()??this.selectedId():null);rows=Q(()=>{let e=this.selected();if(!e)return[];let t=this.filter().toLowerCase(),n=Array.from(this.active()),r=[],i=(e,a)=>{let o=r.length,s=(!t||e.path.toLowerCase().includes(t))&&n.every(t=>Fz(e,t));for(let t of e.children??[])s=i(t,a+1)||s;return s&&r.splice(o,0,{node:e,depth:a}),s};return i(e.root,0),r});selectedNode=Q(()=>{let e=this.fieldPath(),t=this.selected();if(e===null||!t)return null;let n=t=>t.path===e?t:(t.children??[]).map(n).find(Boolean)??null;return n(t.root)});dropped=j({});droppedEvents=Q(()=>{let e=this.selected()?.id;return e?this.dropped()[mL(e)]??0:0});maxEvents=Q(()=>sE(this.rpc()).limits.formTimeline);selectedEvents=Q(()=>{let e=this.selected()?.id;return this.events().filter(t=>t.formId===e).slice(-200)});constructor(){uc(()=>{let e=this.rpc();e&&this.load(e)}),uc(()=>{let e=this.focus();e&&Cv(()=>{this.selectForm(e.id),this.focusHandled.emit()})}),this.destroyRef.onDestroy(()=>{this.unsubscribe?.(),this.highlight(null,``)})}async load(e){this.loading.set(!0),this.failed.set(!1);try{let t=await e.scope(`pangular`).rpc.sharedState(`forms`);if(this.destroyRef.destroyed)return;let n=e=>{let t=e;this.forms.set(t?.forms??[]),this.events.set(t?.events??[]),this.instrumented.set(t?.instrumented??[]),this.dropped.set(t?.dropped??{}),this.webMcp.set(t?.webMcp??[]),this.version.update(e=>e+1)};n(t.value()),this.unsubscribe?.(),this.unsubscribe=t.on(`updated`,n)}catch{this.failed.set(!0)}finally{this.loading.set(!1)}}retry(){let e=this.rpc();e&&this.load(e)}async pick(){let e=this.selected();if(!e)return;let t=++this.pickSeq;this.picking.set(e.id),this.message.set(`Click a field in the app. Press Escape or Cancel picking to stop.`);let n=await xL(this.rpc(),{action:`pick`,formId:e.id});if(t!==this.pickSeq)return;this.picking.set(null);let r=n;if(!n.ok||!r.formId){this.message.set(SL(n));return}this.selectForm(r.formId),this.tab_.set(`fields`),this.fieldPath.set(r.path??``),this.message.set(`Picked ${r.path||`(form)`}.`)}cancelPick(){let e=this.picking();e&&xL(this.rpc(),{action:`cancel-pick`,formId:e})}async setRecording(e){let t=this.selected();if(!t)return;let n=await xL(this.rpc(),{action:`instrument`,formId:t.id,value:e});this.message.set(SL(n))}selectForm(e){this.hostPageId&&mL(e)&&mL(e)!==this.hostPageId&&this.allPages.set(!0),this.selectedId.set(e),this.selectedLabel.set(this.forms().find(t=>t.id===e)?.label??null),this.filter.set(``),this.fieldPath.set(null),this.snapshot.set(null),this.armed.set(null)}toggleField(e){this.fieldPath.update(t=>t===e?null:e)}closeField(){let e=this.host.nativeElement,t=e.querySelector(`button.field[aria-pressed="true"]`)??e.querySelector(`.table-scroll`);this.fieldPath.set(null),t?.focus()}toggleChip(e){this.active.update(t=>{let n=new Set(t);return n.has(e)?n.delete(e):n.add(e),n})}async act(e,t={}){let n=this.selected();if(!n)return;this.armed.set(null);let r=await xL(this.rpc(),{action:e,formId:n.id,...t});r.snapshot&&this.snapshot.set(r.snapshot),this.message.set(SL(r))}confirmAct(e){if(this.armed()!==e){this.armed.set(e),this.message.set(`Press "Confirm ${e}" to ${e} the form in the app.`);return}this.act(e,{confirm:!0,snapshot:this.snapshot()??void 0})}onKey(e){let t=this.tabs.map(e=>e.id),n=t.indexOf(this.tab_()),r=n;if(e.key===`ArrowRight`)r=(n+1)%t.length;else if(e.key===`ArrowLeft`)r=(n-1+t.length)%t.length;else if(e.key===`Home`)r=0;else if(e.key===`End`)r=t.length-1;else return;e.preventDefault(),this.tab_.set(t[r]);let i=e.currentTarget;queueMicrotask(()=>i.querySelector(`#forms-tab-${t[r]}`)?.focus())}sourceText(e){let t=gL[e.source??``]??e.source??``;return e.from===void 0?t:`${t} on ${e.from||`the form`}`}onFilter(e){this.filter.set(e.target.value)}highlight(e,t){let n=this.rpc();n&&n.scope(`pangular`).rpc.callEvent(`request-form-highlight`,e?{formId:e,path:t}:null)}kindLabel(e){return hL[e]}constraintList(e){return Object.entries(e.constraints??{}).map(([e,t])=>`${e} ${t}`)}errorText(e,t){return/^[a-z]/.test(t.message)?`${e.key||`The form`} ${t.message}`:t.message}static ɵfac=function(t){return new(t||e)};static ɵcmp=Bh({type:e,selectors:[[`app-forms-inspector`]],hostBindings:function(e,t){e&1&&G(`keydown.escape`,function(){return t.cancelPick()})},inputs:{rpc:[1,`rpc`],focus:[1,`focus`]},outputs:{focusHandled:`focusHandled`},decls:6,vars:1,consts:[[`role`,`status`,1,`empty`],[`role`,`alert`,1,`empty`],[1,`empty`],[1,`layout`],[`aria-hidden`,`true`,1,`spinner`],[1,`empty-title`],[1,`muted`],[`type`,`button`,1,`small`,3,`click`],[1,`sidebar`],[`id`,`forms-list-heading`,1,`list-heading`],[1,`list-count`],[1,`page-toggle`],[`aria-labelledby`,`forms-list-heading`,1,`form-list`],[`aria-labelledby`,`forms-detail-title`,1,`detail`,`gone`],[`aria-labelledby`,`forms-detail-title`,1,`detail`],[`type`,`checkbox`,3,`change`,`checked`],[`type`,`button`,1,`form-item`,3,`click`],[`aria-hidden`,`true`,1,`dot`],[1,`label`],[1,`kind`],[1,`id`],[1,`sr-only`],[1,`count`],[`id`,`forms-detail-title`],[`role`,`status`,1,`muted`],[1,`detail-head`],[1,`detail-meta`],[1,`summary`],[1,`badge`],[1,`totals`],[1,`error-summary`],[3,`tool`,`page`,`signalForm`],[1,`action-bar`],[`role`,`group`,`aria-label`,`Form actions`,1,`actions`],[`type`,`button`,1,`small`,3,`click`,`disabled`],[`aria-hidden`,`true`,1,`divider`],[`type`,`button`,1,`small`,3,`armed`,`disabled`],[`aria-hidden`,`true`,1,`spacer`],[`type`,`button`,1,`small`,`danger`,3,`click`,`disabled`],[`type`,`button`,1,`small`,`primary`,3,`click`,`disabled`],[`id`,`forms-writes-off`,1,`muted`],[`role`,`status`,1,`status`],[`role`,`tablist`,`aria-label`,`Form views`,1,`tabs`,3,`keydown`],[`type`,`button`,`role`,`tab`,3,`id`],[`role`,`tabpanel`,1,`panel`,3,`id`],[3,`formId`,`version`,`rpc`],[1,`kind-tag`],[`type`,`button`,`role`,`tab`,3,`click`,`id`],[1,`filters`],[`type`,`search`,`placeholder`,`Filter fields by path`,`aria-label`,`Filter fields by path`,`autocomplete`,`off`,`spellcheck`,`false`,1,`filter`,3,`input`,`value`],[1,`chips`],[`role`,`region`,`aria-label`,`Fields`,`tabindex`,`0`,1,`table-scroll`],[1,`fields`],[`scope`,`col`],[3,`form`,`node`,`version`,`rpc`],[3,`mouseenter`,`mouseleave`],[`scope`,`row`,1,`name`],[`type`,`button`,1,`field`,3,`focus`,`blur`,`click`],[1,`type`],[1,`value`],[1,`status-cell`],[1,`flags`],[1,`warn`],[1,`errors`],[1,`unseen`],[1,`source`],[`colspan`,`5`,1,`muted`,`truncated`],[`colspan`,`5`,1,`no-match`],[3,`closed`,`form`,`node`,`version`,`rpc`],[`what`,`form events on this page`,`limit`,`formTimeline`,3,`dropped`,`max`],[3,`record`,`events`,`recording`]],template:function(e,t){e&1&&P(0,jR,4,0,`div`,0)(1,MR,7,0,`div`,1)(2,NR,4,0,`div`,0)(3,PR,5,0,`div`,2)(4,FR,7,2,`div`,2)(5,Mz,12,3,`div`,3),e&2&&F(t.rpc()?t.failed()?1:t.loading()?2:t.forms().length?t.visible().length?5:4:3:0)},dependencies:[jL,aR,BL,VL,DR,TD,ab],styles:[`.muted[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
}

code[_ngcontent-%COMP%] {
  font-family: var(--%NS%font-mono);
  font-size: 12.5px;
}

.small[_ngcontent-%COMP%] {
  display: inline-block;
  max-width: 100%;
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%surface-2);
  color: var(--%NS%text);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 32px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  cursor: pointer;
  transition: background-color 150ms var(--%NS%ease), border-color 150ms var(--%NS%ease), color 150ms var(--%NS%ease), box-shadow 150ms var(--%NS%ease);
}

.small[_ngcontent-%COMP%]:hover {
  background: var(--%NS%surface-3);
  border-color: color-mix(in srgb, var(--%NS%text-3) 55%, var(--%NS%border-strong));
}

.small[_ngcontent-%COMP%]:active {
  background: var(--%NS%border-strong);
}

.small[_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: 2px;
}

.small[_ngcontent-%COMP%]:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.small.primary[_ngcontent-%COMP%] {
  background: var(--%NS%accent);
  border-color: var(--%NS%accent);
  color: var(--%NS%accent-ink);
  font-weight: 600;
}

.small.primary[_ngcontent-%COMP%]:hover {
  background: var(--%NS%accent-hover);
  border-color: var(--%NS%accent-hover);
}

.small.danger[_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%danger) 40%, transparent);
  color: var(--%NS%danger);
}

.small.danger[_ngcontent-%COMP%]:hover {
  background: color-mix(in srgb, var(--%NS%danger) 12%, transparent);
  border-color: color-mix(in srgb, var(--%NS%danger) 55%, transparent);
}

.small.armed[_ngcontent-%COMP%] {
  box-shadow: 0 0 0 3px var(--%NS%accent-soft);
}

.small.danger.armed[_ngcontent-%COMP%] {
  background: var(--%NS%danger);
  border-color: var(--%NS%danger);
  color: #1f0707;
  font-weight: 600;
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--%NS%danger) 18%, transparent);
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme=dark])   [_nghost-%COMP%]   .small.danger.armed[_ngcontent-%COMP%] {
    color: #fff;
  }
}
:root[data-theme=light]   [_nghost-%COMP%]   .small.danger.armed[_ngcontent-%COMP%] {
  color: #fff;
}

.field-input[_ngcontent-%COMP%] {
  min-width: 0;
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%bg);
  color: var(--%NS%text);
  font-family: var(--%NS%font-mono);
  font-size: 13px;
  transition: border-color 150ms var(--%NS%ease), box-shadow 150ms var(--%NS%ease);
}

.field-input[_ngcontent-%COMP%]::placeholder {
  color: var(--%NS%text-3);
  font-family: var(--%NS%font-sans);
}

.field-input[_ngcontent-%COMP%]:hover {
  border-color: color-mix(in srgb, var(--%NS%text-3) 55%, var(--%NS%border-strong));
}

.field-input[_ngcontent-%COMP%]:focus, 
.field-input[_ngcontent-%COMP%]:focus-visible {
  outline: none;
  border-color: var(--%NS%accent);
  box-shadow: 0 0 0 3px var(--%NS%accent-soft);
}

.explain[_ngcontent-%COMP%] {
  margin: 0;
  padding: 12px 16px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%bg);
  color: var(--%NS%text);
  font-family: var(--%NS%font-mono);
  font-size: 12.5px;
  line-height: 1.6;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
  tab-size: 2;
}

.explain[aria-busy=true][_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
}

.section-label[_ngcontent-%COMP%] {
  margin: 0;
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.tag[_ngcontent-%COMP%] {
  display: inline-block;
  margin: 0;
  padding: 1px 8px;
  border: 1px solid var(--%NS%border);
  border-radius: 99px;
  background: var(--%NS%surface-2);
  color: var(--%NS%text-2);
  font-size: 11px;
  font-weight: 500;
  line-height: 18px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.tag[data-tone=ok][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%ok) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%ok) 12%, var(--%NS%surface));
  color: var(--%NS%ok);
}

.tag[data-tone=warn][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%warn) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%warn) 12%, var(--%NS%surface));
  color: var(--%NS%warn);
}

.tag[data-tone=bad][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%danger) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%danger) 12%, var(--%NS%surface));
  color: var(--%NS%danger);
}

.status[_ngcontent-%COMP%] {
  margin: 0;
  color: var(--%NS%text-2);
  font-size: 12.5px;
  line-height: 1.5;
  overflow-wrap: anywhere;
}

.empty-state[_ngcontent-%COMP%] {
  display: grid;
  justify-items: center;
  gap: 6px;
  margin: 0;
  padding: 40px 24px;
  border: 1px dashed var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  color: var(--%NS%text-2);
  font-size: 13px;
  line-height: 1.5;
  text-align: center;
}

.empty-state[_ngcontent-%COMP%]   p[_ngcontent-%COMP%] {
  max-width: 52ch;
  margin: 0;
}

.empty-state[_ngcontent-%COMP%]   .empty-title[_ngcontent-%COMP%] {
  color: var(--%NS%text-strong);
  font-size: 14px;
  font-weight: 600;
}

.spinner[_ngcontent-%COMP%] {
  width: 16px;
  height: 16px;
  border: 2px solid var(--%NS%border-strong);
  border-top-color: var(--%NS%accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

[_nghost-%COMP%] {
  display: block;
}

.layout[_ngcontent-%COMP%] {
  display: grid;
  grid-template-columns: minmax(200px, 260px) minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.sidebar[_ngcontent-%COMP%] {
  min-width: 0;
  padding: 8px;
  background: var(--%NS%surface);
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  animation: enter 0.35s var(--%NS%ease) both;
}

.list-heading[_ngcontent-%COMP%] {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 4px 8px 8px;
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.list-count[_ngcontent-%COMP%] {
  padding: 0 6px;
  border-radius: 99px;
  background: var(--%NS%surface-3);
  color: var(--%NS%text-2);
  font-size: 11px;
  letter-spacing: 0;
  line-height: 18px;
  font-variant-numeric: tabular-nums;
}

.form-list[_ngcontent-%COMP%] {
  display: grid;
  gap: 2px;
  align-content: start;
  margin: 0;
  padding: 0;
  list-style: none;
}

.form-item[_ngcontent-%COMP%] {
  width: 100%;
  display: grid;
  grid-template-columns: 8px minmax(0, 1fr) auto;
  grid-template-areas: "dot label count" ". kind kind";
  gap: 2px 10px;
  align-items: center;
  padding: 8px 10px;
  border: 0;
  border-radius: var(--%NS%radius-sm);
  background: transparent;
  color: var(--%NS%text);
  font: inherit;
  text-align: left;
  cursor: pointer;
  transition: background-color 150ms var(--%NS%ease), color 150ms var(--%NS%ease), box-shadow 150ms var(--%NS%ease);
}

.form-item[_ngcontent-%COMP%]:hover {
  background: var(--%NS%surface-2);
}

.form-item[_ngcontent-%COMP%]:active {
  background: var(--%NS%surface-3);
}

.form-item.active[_ngcontent-%COMP%] {
  background: var(--%NS%accent-soft);
  box-shadow: inset 2px 0 0 var(--%NS%accent);
  color: var(--%NS%text-strong);
}

.form-item[_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: 2px;
}

.form-item[_ngcontent-%COMP%]   .dot[_ngcontent-%COMP%] {
  grid-area: dot;
}

.form-item[_ngcontent-%COMP%]   .label[_ngcontent-%COMP%] {
  grid-area: label;
  min-width: 0;
  overflow: hidden;
  font-size: 13px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.form-item[_ngcontent-%COMP%]   .kind[_ngcontent-%COMP%] {
  grid-area: kind;
  min-width: 0;
  overflow: hidden;
  color: var(--%NS%text-3);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.form-item[_ngcontent-%COMP%]   .id[_ngcontent-%COMP%] {
  font-family: var(--%NS%font-mono);
  font-size: 11.5px;
}

.form-item.active[_ngcontent-%COMP%]   .kind[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
}

.form-item[_ngcontent-%COMP%]   .count[_ngcontent-%COMP%] {
  grid-area: count;
  min-width: 20px;
  padding: 0 7px;
  border: 1px solid color-mix(in srgb, var(--%NS%danger) 30%, transparent);
  border-radius: 99px;
  background: color-mix(in srgb, var(--%NS%danger) 12%, transparent);
  color: var(--%NS%danger);
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

.dot[_ngcontent-%COMP%] {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--%NS%ok);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--%NS%ok) 15%, transparent);
}

.dot[data-status=INVALID][_ngcontent-%COMP%] {
  background: var(--%NS%danger);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--%NS%danger) 15%, transparent);
}

.dot[data-status=PENDING][_ngcontent-%COMP%] {
  background: var(--%NS%warn);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--%NS%warn) 15%, transparent);
}

.dot[data-status=DISABLED][_ngcontent-%COMP%] {
  background: var(--%NS%text-3);
  box-shadow: none;
}

.detail[_ngcontent-%COMP%] {
  display: grid;
  gap: 16px;
  min-width: 0;
  padding: 16px;
  background: var(--%NS%surface);
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  box-shadow: var(--%NS%shadow);
  animation: enter 0.35s var(--%NS%ease) both;
}

.detail-head[_ngcontent-%COMP%] {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.detail-head[_ngcontent-%COMP%]   h2[_ngcontent-%COMP%] {
  margin: 0;
  color: var(--%NS%text-strong);
  font-size: 16px;
  font-weight: 600;
  line-height: 1.3;
  overflow-wrap: anywhere;
}

.detail-meta[_ngcontent-%COMP%] {
  margin: 0;
  color: var(--%NS%text-3);
  font-size: 12px;
  overflow-wrap: anywhere;
}

.detail-meta[_ngcontent-%COMP%]   code[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
  font-size: 11.5px;
}

.gone[_ngcontent-%COMP%] {
  justify-items: start;
}

.gone[_ngcontent-%COMP%]   h2[_ngcontent-%COMP%] {
  margin: 0;
  color: var(--%NS%text-strong);
  font-size: 16px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.gone[_ngcontent-%COMP%]   p[_ngcontent-%COMP%] {
  margin: 0;
}

.page-toggle[_ngcontent-%COMP%] {
  display: flex;
  gap: 8px;
  align-items: center;
  min-height: 32px;
  margin: 0 8px 8px;
  color: var(--%NS%text-2);
  font-size: 13px;
  cursor: pointer;
}

.page-toggle[_ngcontent-%COMP%]   input[_ngcontent-%COMP%] {
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--%NS%accent);
}

.page-toggle[_ngcontent-%COMP%]   input[_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: 2px;
}

.error-summary[_ngcontent-%COMP%] {
  min-width: 0;
  padding: 8px 12px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%surface-2);
  font-size: 13px;
}

.error-summary[_ngcontent-%COMP%]   summary[_ngcontent-%COMP%] {
  color: var(--%NS%text);
  font-weight: 500;
  cursor: pointer;
}

.error-summary[_ngcontent-%COMP%]   summary[_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: 2px;
}

.error-summary[_ngcontent-%COMP%]   ul[_ngcontent-%COMP%] {
  display: grid;
  gap: 4px;
  margin: 8px 0 0;
  padding: 0 0 0 16px;
  color: var(--%NS%text);
  overflow-wrap: anywhere;
}

.error-summary[_ngcontent-%COMP%]   .kind-tag[_ngcontent-%COMP%] {
  margin-left: 6px;
  color: var(--%NS%text-2);
  font-size: 11px;
}

.summary[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
  color: var(--%NS%text-2);
  font-size: 12px;
}

.summary[_ngcontent-%COMP%]    > span[_ngcontent-%COMP%]:not(.badge):not(.totals) {
  padding: 0 10px;
  border: 1px solid var(--%NS%border);
  border-radius: 99px;
  background: var(--%NS%surface-2);
  color: var(--%NS%text);
  line-height: 22px;
}

.totals[_ngcontent-%COMP%] {
  margin-left: auto;
  color: var(--%NS%text-3);
  font-variant-numeric: tabular-nums;
}

.totals[_ngcontent-%COMP%]   b[_ngcontent-%COMP%] {
  color: var(--%NS%text);
  font-weight: 600;
}

.totals[_ngcontent-%COMP%]   b.has-errors[_ngcontent-%COMP%] {
  color: var(--%NS%danger);
}

.badge[_ngcontent-%COMP%] {
  display: inline-block;
  padding: 0 8px;
  border: 1px solid color-mix(in srgb, var(--%NS%ok) 30%, transparent);
  border-radius: 99px;
  background: color-mix(in srgb, var(--%NS%ok) 12%, transparent);
  color: var(--%NS%ok);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  line-height: 20px;
  white-space: nowrap;
}

.summary[_ngcontent-%COMP%]    > .badge[_ngcontent-%COMP%] {
  line-height: 22px;
}

.badge[data-status=INVALID][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%danger) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%danger) 12%, transparent);
  color: var(--%NS%danger);
}

.badge[data-status=PENDING][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%warn) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%warn) 12%, transparent);
  color: var(--%NS%warn);
}

.badge[data-status=DISABLED][_ngcontent-%COMP%] {
  border-color: var(--%NS%border-strong);
  background: var(--%NS%surface-2);
  color: var(--%NS%text-2);
}

.action-bar[_ngcontent-%COMP%] {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--%NS%border);
}

.actions[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.divider[_ngcontent-%COMP%] {
  width: 1px;
  height: 20px;
  background: var(--%NS%border-strong);
}

.spacer[_ngcontent-%COMP%] {
  flex: 1 1 0;
}

.actions[_ngcontent-%COMP%]   .small[_ngcontent-%COMP%]:not(.primary):not(.danger) {
  max-width: 240px;
}

.small.on[_ngcontent-%COMP%] {
  background: var(--%NS%accent-soft);
  border-color: var(--%NS%accent-line);
  color: var(--%NS%text-strong);
}

.status[_ngcontent-%COMP%]:empty {
  height: 0;
  margin-top: -8px;
}

.tabs[_ngcontent-%COMP%] {
  display: inline-flex;
  justify-self: start;
  gap: 2px;
  max-width: 100%;
  height: 34px;
  padding: 2px;
  overflow-x: auto;
  background: var(--%NS%bg);
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius-sm);
}

.tabs[_ngcontent-%COMP%]   [role=tab][_ngcontent-%COMP%] {
  flex: none;
  height: 28px;
  padding: 0 14px;
  border: 0;
  border-radius: 7px;
  background: transparent;
  color: var(--%NS%text-2);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 150ms var(--%NS%ease), color 150ms var(--%NS%ease), box-shadow 150ms var(--%NS%ease);
}

.tabs[_ngcontent-%COMP%]   [role=tab][_ngcontent-%COMP%]:hover {
  color: var(--%NS%text);
  background: var(--%NS%surface-2);
}

.tabs[_ngcontent-%COMP%]   [role=tab][aria-selected=true][_ngcontent-%COMP%] {
  background: var(--%NS%surface-3);
  color: var(--%NS%text-strong);
  box-shadow: inset 0 0 0 1px var(--%NS%border-strong);
}

.tabs[_ngcontent-%COMP%]   [role=tab][_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: -2px;
}

.panel[_ngcontent-%COMP%] {
  display: grid;
  gap: 12px;
  min-width: 0;
  animation: enter 0.35s var(--%NS%ease) both;
}

.filters[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
}

.chips[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
}

.chips[_ngcontent-%COMP%]   label[_ngcontent-%COMP%] {
  position: relative;
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  border: 1px solid var(--%NS%border);
  border-radius: 99px;
  background: var(--%NS%surface-2);
  color: var(--%NS%text-2);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  user-select: none;
  transition: background-color 150ms var(--%NS%ease), border-color 150ms var(--%NS%ease), color 150ms var(--%NS%ease);
}

.chips[_ngcontent-%COMP%]   label[_ngcontent-%COMP%]:hover {
  color: var(--%NS%text);
  border-color: var(--%NS%border-strong);
}

.chips[_ngcontent-%COMP%]   input[_ngcontent-%COMP%] {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.chips[_ngcontent-%COMP%]   label[_ngcontent-%COMP%]:has(input:checked) {
  border-color: var(--%NS%accent-line);
  background: var(--%NS%accent-soft);
  color: var(--%NS%accent);
}

.chips[_ngcontent-%COMP%]   label[_ngcontent-%COMP%]:has(input:focus-visible) {
  outline: 2px solid var(--%NS%accent);
  outline-offset: 2px;
}

.filter[_ngcontent-%COMP%] {
  flex: 1 1 220px;
  min-width: 0;
  height: 34px;
  padding: 0 12px 0 34px;
  background-color: var(--%NS%bg);
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%238e8e99' stroke-width='2.2' stroke-linecap='round' stroke-linejoin='round'%3E%3Ccircle cx='11' cy='11' r='7'/%3E%3Cpath d='m20 20-3.5-3.5'/%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: 12px center;
  background-size: 14px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  color: var(--%NS%text);
  font: inherit;
  font-size: 13px;
  transition: border-color 150ms var(--%NS%ease), box-shadow 150ms var(--%NS%ease);
}

.filter[_ngcontent-%COMP%]::placeholder {
  color: var(--%NS%text-3);
}

.filter[_ngcontent-%COMP%]:hover {
  border-color: color-mix(in srgb, var(--%NS%text-3) 55%, var(--%NS%border-strong));
}

.filter[_ngcontent-%COMP%]:focus, 
.filter[_ngcontent-%COMP%]:focus-visible {
  outline: none;
  border-color: var(--%NS%accent);
  box-shadow: 0 0 0 3px var(--%NS%accent-soft);
}

.table-scroll[_ngcontent-%COMP%] {
  overflow-x: auto;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius-sm);
}

.table-scroll[_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: 2px;
}

.fields[_ngcontent-%COMP%] {
  width: 100%;
  min-width: 680px;
  border-collapse: collapse;
  font-size: 13px;
}

.fields[_ngcontent-%COMP%]   th[_ngcontent-%COMP%], 
.fields[_ngcontent-%COMP%]   td[_ngcontent-%COMP%] {
  padding: 8px 12px;
  border-bottom: 1px solid var(--%NS%border);
  text-align: left;
  vertical-align: top;
  line-height: 20px;
}

.fields[_ngcontent-%COMP%]   tbody[_ngcontent-%COMP%]   tr[_ngcontent-%COMP%]:last-child    > *[_ngcontent-%COMP%] {
  border-bottom: 0;
}

.fields[_ngcontent-%COMP%]   thead[_ngcontent-%COMP%]   th[_ngcontent-%COMP%] {
  background: var(--%NS%surface-2);
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.06em;
  line-height: 16px;
  text-transform: uppercase;
  white-space: nowrap;
}

.fields[_ngcontent-%COMP%]   tbody[_ngcontent-%COMP%]   th[_ngcontent-%COMP%] {
  color: var(--%NS%text);
  font-weight: 500;
  white-space: nowrap;
}

.fields[_ngcontent-%COMP%]   tbody[_ngcontent-%COMP%]   tr[_ngcontent-%COMP%] {
  transition: background-color 150ms var(--%NS%ease);
}

.fields[_ngcontent-%COMP%]   tbody[_ngcontent-%COMP%]   tr[_ngcontent-%COMP%]:hover {
  background: var(--%NS%surface-2);
}

.fields[_ngcontent-%COMP%]   tbody[_ngcontent-%COMP%]   tr.invalid[_ngcontent-%COMP%]    > th[_ngcontent-%COMP%] {
  box-shadow: inset 2px 0 0 color-mix(in srgb, var(--%NS%danger) 60%, transparent);
}

.fields[_ngcontent-%COMP%]   tbody[_ngcontent-%COMP%]   tr[_ngcontent-%COMP%]:has(.field[aria-pressed=true]) {
  background: var(--%NS%accent-soft);
}

.fields[_ngcontent-%COMP%]   tbody[_ngcontent-%COMP%]   tr[_ngcontent-%COMP%]:has(.field[aria-pressed=true])    > th[_ngcontent-%COMP%] {
  box-shadow: inset 2px 0 0 var(--%NS%accent);
  color: var(--%NS%text-strong);
}

.name[_ngcontent-%COMP%] {
  max-width: 280px;
}

.field[_ngcontent-%COMP%] {
  display: inline-block;
  max-width: 200px;
  padding: 0;
  overflow: hidden;
  border: none;
  border-radius: 4px;
  background: none;
  color: inherit;
  font-family: var(--%NS%font-mono);
  font-size: 12.5px;
  font-weight: 500;
  line-height: 20px;
  text-align: left;
  text-overflow: ellipsis;
  vertical-align: top;
  white-space: nowrap;
  cursor: pointer;
  transition: color 150ms var(--%NS%ease);
}

.field[_ngcontent-%COMP%]:hover {
  color: var(--%NS%accent-hover);
  text-decoration: underline;
  text-underline-offset: 3px;
}

.field[aria-pressed=true][_ngcontent-%COMP%] {
  color: var(--%NS%accent);
}

.field[_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: 2px;
}

.type[_ngcontent-%COMP%] {
  margin-left: 8px;
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 400;
  vertical-align: top;
}

.value[_ngcontent-%COMP%] {
  min-width: 140px;
  max-width: 320px;
}

.value[_ngcontent-%COMP%]   code[_ngcontent-%COMP%], 
.errors[_ngcontent-%COMP%]   code[_ngcontent-%COMP%] {
  color: #fde68a;
  overflow-wrap: anywhere;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme=dark])   [_nghost-%COMP%]   .value[_ngcontent-%COMP%]   code[_ngcontent-%COMP%], 
   :root:not([data-theme=dark])   [_nghost-%COMP%]   .errors[_ngcontent-%COMP%]   code[_ngcontent-%COMP%] {
    color: var(--%NS%accent);
  }
}
:root[data-theme=light]   [_nghost-%COMP%]   .value[_ngcontent-%COMP%]   code[_ngcontent-%COMP%], 
:root[data-theme=light]   [_nghost-%COMP%]   .errors[_ngcontent-%COMP%]   code[_ngcontent-%COMP%] {
  color: var(--%NS%accent);
}

.value[_ngcontent-%COMP%]   .muted[_ngcontent-%COMP%] {
  margin-top: 2px;
  font-size: 12px;
}

.status-cell[_ngcontent-%COMP%] {
  white-space: nowrap;
}

.flags[_ngcontent-%COMP%] {
  min-width: 160px;
}

.flags[_ngcontent-%COMP%]   span[_ngcontent-%COMP%] {
  display: inline-block;
  margin: 0 4px 4px 0;
  padding: 0 8px;
  border: 1px solid var(--%NS%border);
  border-radius: 99px;
  background: var(--%NS%surface-2);
  color: var(--%NS%text-2);
  font-size: 11px;
  line-height: 18px;
  white-space: nowrap;
}

.flags[_ngcontent-%COMP%]   span.warn[_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%warn) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%warn) 12%, transparent);
  color: var(--%NS%warn);
}

.errors[_ngcontent-%COMP%] {
  min-width: 180px;
}

.errors[_ngcontent-%COMP%]   div[_ngcontent-%COMP%] {
  color: var(--%NS%danger);
  overflow-wrap: anywhere;
}

.errors[_ngcontent-%COMP%]   div[_ngcontent-%COMP%]    + div[_ngcontent-%COMP%] {
  margin-top: 4px;
}

.errors[_ngcontent-%COMP%]   .kind-tag[_ngcontent-%COMP%] {
  margin-left: 6px;
  color: var(--%NS%text-3);
  font-size: 11px;
}

.source[_ngcontent-%COMP%] {
  margin-left: 6px;
  color: var(--%NS%text-2);
  font-size: 11px;
}

.errors[_ngcontent-%COMP%]   .unseen[_ngcontent-%COMP%] {
  color: var(--%NS%warn);
  font-size: 11px;
}

.truncated[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-size: 12px;
  font-style: italic;
}

.fields[_ngcontent-%COMP%]   .no-match[_ngcontent-%COMP%] {
  padding: 24px 12px;
  color: var(--%NS%text-2);
  text-align: center;
}

.empty[_ngcontent-%COMP%] {
  display: grid;
  justify-items: center;
  gap: 8px;
  margin: 0;
  padding: 48px 24px;
  background: var(--%NS%surface);
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  color: var(--%NS%text-2);
  font-size: 13px;
  line-height: 1.5;
  text-align: center;
  animation: enter 0.35s var(--%NS%ease) both;
}

.empty[_ngcontent-%COMP%]   p[_ngcontent-%COMP%] {
  max-width: 52ch;
  margin: 0;
}

.empty[_ngcontent-%COMP%]   .small[_ngcontent-%COMP%] {
  margin-top: 8px;
}

.empty-title[_ngcontent-%COMP%] {
  color: var(--%NS%text-strong);
  font-size: 15px;
  font-weight: 600;
}

@media (max-width: 720px) {
  .layout[_ngcontent-%COMP%] {
    grid-template-columns: minmax(0, 1fr);
  }
  .form-list[_ngcontent-%COMP%] {
    max-height: 240px;
    overflow-y: auto;
  }
}
@media (max-width: 480px) {
  .detail[_ngcontent-%COMP%] {
    padding: 12px;
  }
  .totals[_ngcontent-%COMP%] {
    flex-basis: 100%;
    margin-left: 0;
  }
  .spacer[_ngcontent-%COMP%], 
   .divider[_ngcontent-%COMP%] {
    display: none;
  }
}`]})},zz=(e,t)=>t.file+t.name,Bz=(e,t)=>t.file+`:`+t.line,Vz=(e,t)=>t.name;function Hz(e,t){e&1&&(z(0,`p`,13),A(),z(1,`svg`,26),V(2,`circle`,27)(3,`path`,28),B(),ps(),z(4,`span`),J(5),B()()),e&2&&(M(5),Y(t))}function Uz(e,t){if(e&1&&(z(0,`p`,13),A(),z(1,`svg`,26),V(2,`circle`,27)(3,`path`,28),B(),ps(),z(4,`span`)(5,`strong`),J(6),B(),J(7,` Pipe prototypes are patched in the inspected page to count calls and keep the last input and output. Stop recording when you are done. `),B()()),e&2){let e=K();M(6),X(`Recording on `,e.instrumentedPages().length,` page(s).`)}}function Wz(e,t){e&1&&(z(0,`div`,14),V(1,`span`,29),z(2,`p`,30),J(3,`Scanning pipes…`),B()())}function Gz(e,t){if(e&1){let e=W();z(0,`div`,15)(1,`p`,30),J(2,`Couldn't load pipes`),B(),z(3,`p`,31),J(4,`The devtools server did not answer. Check that it is running.`),B(),z(5,`button`,32),G(`click`,function(){return O(e),k(K().refresh())}),J(6,`Try again`),B()()}}function Kz(e,t){e&1&&(z(0,`div`,16)(1,`p`,30),J(2,`No pipes found`),B(),z(3,`p`,31),J(4,` No @Pipe classes were found in the source, and no template uses a built-in pipe yet. `),B()())}function qz(e,t){e&1&&(z(0,`span`,43),J(1,`stale?`),B())}function Jz(e,t){if(e&1&&(z(0,`span`,44),J(1),B()),e&2){K();let e=iv(0);M(),X(``,e.instanceCount,` live`)}}function Yz(e,t){e&1&&(z(0,`span`,45),J(1,`built-in`),B())}function Xz(e,t){e&1&&(z(0,`span`,45),J(1,`NgModule`),B())}function Zz(e,t){if(e&1&&(z(0,`span`,47),J(1),B()),e&2){let e=K().$implicit;M(),X(`+`,(e.usageCount??1)-1,` more`)}}function Qz(e,t){if(e&1){let e=W();nv(0),z(1,`li`)(2,`button`,38),G(`click`,function(){let t=O(e).$implicit;return k(K(3).select(t))})(`mouseenter`,function(){O(e);let t=iv(0);return k(K(3).highlightPipe(t))})(`mouseleave`,function(){return O(e),k(K(3).highlight(null))})(`focus`,function(){O(e);let t=iv(0);return k(K(3).highlightPipe(t))})(`blur`,function(){return O(e),k(K(3).highlight(null))}),z(3,`span`,39)(4,`span`,40),J(5),B(),z(6,`span`,41),J(7),B()(),z(8,`span`,42),P(9,qz,2,0,`span`,43),P(10,Jz,2,1,`span`,44),P(11,Yz,2,0,`span`,45),P(12,Xz,2,0,`span`,45),z(13,`span`,45),J(14),B()(),z(15,`span`,46),J(16),P(17,Zz,2,1,`span`,47),B()()()}if(e&2){let e=t.$implicit,n=K(3),r=rv(n.liveFor(e.name));M(2),q(`selected`,n.isSelected(e)),N(`aria-current`,n.isSelected(e)||null),M(3),Y(e.name),M(2),Y(e.className),M(2),F(r?.stale?9:-1),M(),F(r?10:-1),M(),F(e.builtin?11:-1),M(),F(e.isStandalone?-1:12),M(),q(`impure`,!e.isPure),M(),Y(e.isPure?`pure`:`impure`),M(2),Z(` `,e.file,`:`,e.line,` `),M(),F(e.builtin&&(e.usageCount??0)>1?17:-1)}}function $z(e,t){if(e&1){let e=W();z(0,`ul`,37),G(`keydown`,function(t){return O(e),k(K(2).onListKey(t))}),I(1,Qz,18,16,`li`,null,zz),B()}if(e&2){let e=K(2);M(),L(e.filtered())}}function eB(e,t){e&1&&J(0),e&2&&X(` Nothing matches “`,K(3).filter().trim(),`” in this view. `)}function tB(e,t){e&1&&J(0,` None of the pipes fit this filter. `)}function nB(e,t){if(e&1){let e=W();z(0,`div`,35)(1,`p`,30),J(2,`No pipes match`),B(),z(3,`p`,31),P(4,eB,1,1)(5,tB,1,0),B(),z(6,`button`,32),G(`click`,function(){return O(e),k(K(2).clearFilters())}),J(7,`Clear filters`),B()()}if(e&2){let e=K(2);M(4),F(e.filter().trim()?4:5)}}function rB(e,t){e&1&&(z(0,`span`,45),J(1,`built-in`),B())}function iB(e,t){if(e&1&&(z(0,`dt`),J(1,`File`),B(),z(2,`dd`,51),J(3),B()),e&2){let e=K();M(3),Z(``,e.file,`:`,e.line)}}function aB(e,t){if(e&1&&(z(0,`li`,51),J(1),B()),e&2){let e=t.$implicit;M(),Z(``,e.file,`:`,e.line)}}function oB(e,t){if(e&1&&(z(0,`div`,50)(1,`h3`),J(2,` Used in templates `),z(3,`span`,21),J(4),B()(),z(5,`ul`,53),I(6,aB,2,2,`li`,51,Bz),B()()),e&2){let e=K();M(4),Y(e.usageCount),M(2),L(e.usages)}}function sB(e,t){e&1&&(z(0,`p`,54)(1,`span`,43),J(2,`experimental`),B(),J(3,` This pure pipe got an argument whose contents changed while its reference stayed the same, so it may be showing a stale value. `),B())}function cB(e,t){if(e&1){let e=W();z(0,`button`,59),G(`click`,function(){let t=O(e);return k(K(5).highlight(t,!0))})(`mouseenter`,function(){let t=O(e);return k(K(5).highlight(t))})(`mouseleave`,function(){return O(e),k(K(5).highlight(null))})(`focus`,function(){let t=O(e);return k(K(5).highlight(t))})(`blur`,function(){return O(e),k(K(5).highlight(null))}),z(1,`span`,51),J(2),B(),z(3,`span`,60),J(4),B()()}if(e&2){let e=K().$implicit;N(`aria-label`,`Highlight `+e.name+` on the page`),M(2),Y(e.name),M(2),Y(e.count)}}function lB(e,t){if(e&1&&(z(0,`span`,58)(1,`span`,51),J(2),B(),z(3,`span`,60),J(4),B()()),e&2){let e=K().$implicit;M(2),Y(e.name),M(2),Y(e.count)}}function uB(e,t){if(e&1&&(z(0,`li`),P(1,cB,5,3,`button`,57)(2,lB,5,2,`span`,58),B()),e&2){let e,n=t.$implicit;M(),F((e=n.targets?.[0])?1:2,e)}}function dB(e,t){if(e&1&&(z(0,`li`,61),J(1),z(2,`span`,62),J(3),B()()),e&2){let e=t.$implicit,n=K(6);M(),Z(` `,n.describe(e.lastArgs),` → `,n.describe(e.lastResult),` `),M(2),X(``,e.callCount,`×`)}}function fB(e,t){if(e&1&&(z(0,`dt`),J(1,`Per instance`),B(),z(2,`dd`)(3,`ul`,53),I(4,dB,4,3,`li`,61,Cg),B()()),e&2){let e=K();M(4),L(e.instances)}}function pB(e,t){if(e&1&&(z(0,`dt`),J(1,`Last caller`),B(),z(2,`dd`,61),J(3),B()),e&2){let e=K();M(3),Y(e.lastCaller)}}function mB(e,t){if(e&1&&(z(0,`dt`),J(1,`Calls`),B(),z(2,`dd`),J(3),B(),z(4,`dt`),J(5,`Last input`),B(),z(6,`dd`,61),J(7),B(),z(8,`dt`),J(9,`Last output`),B(),z(10,`dd`,61),J(11),B(),P(12,fB,6,0),P(13,pB,4,1)),e&2){let e=t,n=K(4);M(3),Y(e.callCount),M(4),Y(n.describe(e.lastArgs)),M(4),Y(n.describe(e.lastResult)),M(),F(e.instances?.length?12:-1),M(),F(e.lastCaller?13:-1)}}function hB(e,t){e&1&&(z(0,`dt`),J(1,`Calls`),B(),z(2,`dd`,63),J(3,`None recorded yet.`),B())}function gB(e,t){e&1&&(z(0,`p`,56),J(1,`Turn on “Record calls” to see call counts and values.`),B())}function _B(e,t){if(e&1&&(P(0,sB,4,0,`p`,54),z(1,`dl`)(2,`dt`),J(3,`Instances`),B(),z(4,`dd`),J(5),B(),z(6,`dt`),J(7,`Used by`),B(),z(8,`dd`)(9,`ul`,55),I(10,uB,3,1,`li`,null,Vz),B()(),P(12,mB,14,5)(13,hB,4,0),B(),P(14,gB,2,0,`p`,56)),e&2){let e,n=t,r=K(3);F(n.stale?0:-1),M(5),Y(n.instanceCount),M(5),L(n.components),M(2),F((e=n.call)?12:r.instrumenting()?13:-1,e),M(2),F(!n.call&&!r.instrumenting()?14:-1)}}function vB(e,t){e&1&&(z(0,`p`,52),J(1,` Not in use on the connected page. Open a view that uses it, or connect the app. `),B())}function yB(e,t){if(e&1&&(z(0,`header`,48)(1,`h2`,49),J(2),B(),z(3,`span`,45),J(4),B(),P(5,rB,2,0,`span`,45),B(),z(6,`div`,50)(7,`h3`),J(8,`Declaration`),B(),z(9,`dl`)(10,`dt`),J(11,`Class`),B(),z(12,`dd`,51),J(13),B(),z(14,`dt`),J(15,`Source`),B(),z(16,`dd`),J(17),B(),P(18,iB,4,2),z(19,`dt`),J(20,`Standalone`),B(),z(21,`dd`),J(22),B(),z(23,`dt`),J(24,`Pure`),B(),z(25,`dd`),J(26),B()()(),P(27,oB,8,1,`div`,50),z(28,`div`,50)(29,`h3`),J(30,`Live on the page`),B(),P(31,_B,15,4)(32,vB,2,0,`p`,52),B()),e&2){let e,n=t,r=K(2);M(2),Y(n.name),M(),q(`impure`,!n.isPure),M(),Y(n.isPure?`pure`:`impure`),M(),F(n.builtin?5:-1),M(8),Y(n.className),M(4),Y(n.builtin?`@angular/common`:`This project`),M(),F(n.builtin?-1:18),M(4),Y(n.isStandalone?`Yes`:`No, declared in an NgModule`),M(4),X(` `,n.isPure?`Yes, reruns only when an input changes`:`No, reruns on every check`,` `),M(),F(n.builtin&&n.usages?.length?27:-1),M(4),F((e=r.liveFor(n.name))?31:32,e)}}function bB(e,t){e&1&&(z(0,`h2`,64),J(1,`Pipe details`),B(),z(2,`div`,65)(3,`p`,30),J(4,`Pick a pipe`),B(),z(5,`p`,31),J(6,` See where it is declared, which components use it and what it last returned. `),B()())}function xB(e,t){if(e&1&&(z(0,`div`,17)(1,`div`,33),P(2,$z,3,0,`ul`,34)(3,nB,8,1,`div`,35),B(),z(4,`section`,36),P(5,yB,33,12)(6,bB,7,0),B()()),e&2){let e,t=K();M(2),F(t.filtered().length?2:3),M(3),F((e=t.selected())?5:6,e)}}function SB(e,t){if(e&1){let e=W();z(0,`button`,73),G(`click`,function(){let t=O(e);return k(K(3).highlight(t))})(`focus`,function(){let t=O(e);return k(K(3).highlight(t))})(`blur`,function(){return O(e),k(K(3).highlight(null))}),J(1),B()}if(e&2){let e=K().$implicit;N(`aria-label`,`Highlight `+e.component+` on the page`),M(),X(` `,e.component,` `)}}function CB(e,t){if(e&1&&(z(0,`span`,71),J(1),B()),e&2){let e=K().$implicit;M(),Y(e.component)}}function wB(e,t){e&1&&(z(0,`span`,45),J(1,`no source`),B())}function TB(e,t){e&1&&(z(0,`span`,43),J(1,`duplicate subscription`),B())}function EB(e,t){e&1&&(z(0,`span`,43),J(1,`resubscribing`),B())}function DB(e,t){if(e&1){let e=W();z(0,`li`,69),G(`mouseenter`,function(){let t=O(e).$implicit;return k(K(2).highlight(t.target))})(`mouseleave`,function(){return O(e),k(K(2).highlight(null))}),P(1,SB,2,2,`button`,70)(2,CB,2,1,`span`,71),P(3,wB,2,0,`span`,45),P(4,TB,2,0,`span`,43),P(5,EB,2,0,`span`,43),z(6,`span`,72),J(7),B()()}if(e&2){let e,n=t.$implicit;M(),F((e=n.target)?1:2,e),M(2),F(n.hasSource?-1:3),M(),F(n.duplicate?4:-1),M(),F(n.resubscribing?5:-1),M(2),Y(n.latestValue??`no value yet`)}}function OB(e,t){if(e&1&&(z(0,`section`,18)(1,`h2`,66),J(2,` Async subscriptions `),z(3,`span`,21),J(4),B()(),z(5,`p`,56),J(6,` Each `),z(7,`span`,51),J(8,`| async`),B(),J(9,` subscribes on its own. Two on the same source mean the work runs twice. A source that changes on every check, like `),z(10,`span`,51),J(11,`getData() | async`),B(),J(12,`, resubscribes each time. `),B(),z(13,`ul`,67),I(14,DB,8,5,`li`,68,Cg),B()()),e&2){let e=K();M(4),Y(e.async().length),M(10),L(e.async())}}function kB(e,t){e&1&&(z(0,`span`,21),J(1),B()),e&2&&(M(),Y(t.length))}function AB(e,t){e&1&&(z(0,`p`,22),J(1,`Couldn't run the lint check. Try Refresh.`),B())}function jB(e,t){e&1&&(z(0,`p`,23),J(1,`Checking…`),B())}function MB(e,t){e&1&&(z(0,`p`,24),J(1,`No problems found.`),B())}function NB(e,t){if(e&1&&(z(0,`li`,74)(1,`div`,75)(2,`span`,76),J(3),B(),z(4,`code`,77),J(5),B(),z(6,`span`,78),J(7),B()(),z(8,`p`,79),J(9),B(),z(10,`p`,80)(11,`span`,81),J(12,`Fix`),B(),J(13),B()()),e&2){let e=t.$implicit;M(2),N(`data-tone`,e.severity),M(),Y(e.severity),M(2),Y(e.rule),M(2),Y_(``,e.pipe,` · `,e.file,`:`,e.line),M(2),Y(e.message),M(4),X(` `,e.fix)}}function PB(e,t){if(e&1&&(z(0,`ul`,25),I(1,NB,14,8,`li`,74,Cg),B()),e&2){let e=K();M(),L(e.lint())}}var FB=5e3,IB=[{value:`all`,label:`All pipes`},{value:`custom`,label:`Custom`},{value:`builtin`,label:`Built-in`},{value:`impure`,label:`Impure`},{value:`live`,label:`On the page`}],LB=class e{destroyRef=E(Cs);host=E(Ml);rpc=$(null);kindOptions=IB;pipes=j([]);filter=j(``);kind=j(`all`);loading=j(!1);loadFailed=j(!1);selected=j(null);live=j([]);async=j([]);lint=j(null);lintFailed=j(!1);instrumentedPages=j([]);instrumenting=Q(()=>this.instrumentedPages().length>0);pendingRecord=j(null);recordMessage=j(null);recordLabel=Q(()=>{let e=this.pendingRecord();return e===null?this.instrumenting()?`Stop recording`:`Record calls`:e?`Starting…`:`Stopping…`});pendingTimer;liveByName=Q(()=>new Map(this.live().map(e=>[e.name,e])));filtered=Q(()=>{let e=this.filter().trim().toLowerCase(),t=this.kind()??`all`,n=this.liveByName();return this.pipes().filter(r=>t===`custom`&&r.builtin||t===`builtin`&&!r.builtin||t===`impure`&&r.isPure||t===`live`&&!n.has(r.name)?!1:!e||r.name.toLowerCase().includes(e)||r.className.toLowerCase().includes(e)||r.file.toLowerCase().includes(e))});unsubscribe;constructor(){uc(()=>{let e=this.rpc();e&&(this.refresh(),this.loadLive(e))}),this.destroyRef.onDestroy(()=>{this.unsubscribe?.(),clearTimeout(this.pendingTimer),this.highlight(null)})}async refresh(){let e=this.rpc();if(e){this.loading.set(!0),this.loadFailed.set(!1);try{let t=await e.scope(`pangular`).rpc.call(`get-pipes`);this.pipes.set(t);let n=this.selected();if(n){let e=t.find(e=>e.name===n.name&&e.file===n.file);this.selected.set(e??null)}}catch{this.loadFailed.set(!0)}finally{this.loading.set(!1)}this.loadLint(e)}}async loadLint(e){this.lintFailed.set(!1);try{let t=await e.scope(`pangular`).rpc.call(`pipe-lint`);this.lint.set(t)}catch{this.lintFailed.set(!0)}}async loadLive(e){try{let t=await e.scope(`pangular`).rpc.sharedState(`pipe-usage`);if(this.destroyRef.destroyed)return;let n=e=>{let t=e;this.live.set(t?.pipes??[]),this.async.set(t?.async??[]);let n=t?.instrumented??[];this.instrumentedPages.set(n),this.pendingRecord()===n.length>0&&this.settleRecord(null)};n(t.value()),this.unsubscribe?.(),this.unsubscribe=t.on(`updated`,n)}catch{}}async toggleInstrument(){let e=this.rpc();if(!e||this.pendingRecord()!==null)return;let t=!this.instrumenting();this.recordMessage.set(null),this.pendingRecord.set(t);let n;try{n=await e.scope(`pangular`).rpc.call(`request-instrument-pipes`,t)}catch{this.settleRecord(`Couldn't reach the devtools server. Try again.`);return}if(this.pendingRecord()===t){if(n?.pages===0){this.settleRecord(`No page is connected. Open your app in the browser with the devtools running, then record again.`);return}clearTimeout(this.pendingTimer),this.pendingTimer=setTimeout(()=>{this.pendingRecord()===t&&this.settleRecord(t?`No page confirmed recording. Reload the app and try again.`:`No page confirmed it stopped recording. Reload the app to stop it.`)},FB)}}settleRecord(e){clearTimeout(this.pendingTimer),this.pendingRecord.set(null),e!==null&&this.recordMessage.set(e)}liveFor(e){return this.liveByName().get(e)}describe(e){if(Array.isArray(e))return e.map(e=>this.describe(e)).join(`, `);if(typeof e==`string`)return e.length>80?`${e.slice(0,80)}…`:e;try{let t=JSON.stringify(e);return t&&t.length>120?`${t.slice(0,120)}…`:t??String(e)}catch{return String(e)}}isSelected(e){let t=this.selected();return t!==null&&t.name===e.name&&t.file===e.file}select(e){this.selected.set(this.isSelected(e)?null:e)}clearFilters(){this.filter.set(``),this.kind.set(`all`)}highlightPipe(e){this.highlight(e?.components.find(e=>e.targets?.length)?.targets?.[0])}highlight(e,t=!1){let n=this.rpc();n&&n.scope(`pangular`).rpc.call(`request-page-highlight`,e?{...e,...t?{reveal:t}:{}}:null).catch(()=>{})}onListKey(e){if(![`ArrowDown`,`ArrowUp`,`Home`,`End`].includes(e.key))return;let t=Array.from(this.host.nativeElement.querySelectorAll(`[data-pipe-row]`));if(!t.length)return;let n=t.indexOf(document.activeElement),r=n;r=e.key===`ArrowDown`?Math.min(n+1,t.length-1):e.key===`ArrowUp`?Math.max(n-1,0):e.key===`Home`?0:t.length-1,e.preventDefault(),t[r]?.focus()}static ɵfac=function(t){return new(t||e)};static ɵcmp=Bh({type:e,selectors:[[`app-pipes-inspector`]],inputs:{rpc:[1,`rpc`]},decls:32,vars:18,consts:[[1,`intro`],[1,`toolbar`],[1,`search`],[`viewBox`,`0 0 24 24`,`aria-hidden`,`true`,1,`search-icon`],[`cx`,`11`,`cy`,`11`,`r`,`7`],[`d`,`m20 20-3.5-3.5`],[`type`,`search`,`placeholder`,`Find a pipe, class or file…`,`aria-label`,`Find a pipe, class or file`,`autocomplete`,`off`,`spellcheck`,`false`,3,`input`,`keydown.escape`,`value`],[`ariaLabel`,`Show pipes`,3,`valueChange`,`options`,`value`],[`aria-live`,`polite`,1,`total`],[1,`actions`],[`type`,`button`,3,`click`,`disabled`],[`type`,`button`,1,`record`,3,`click`],[`aria-hidden`,`true`,1,`rec-dot`],[`role`,`status`,1,`notice`],[`role`,`status`,1,`state`],[`role`,`alert`,1,`state`],[1,`state`],[1,`layout`],[`aria-labelledby`,`async-title`,1,`section`],[`aria-labelledby`,`lint-title`,1,`section`],[`id`,`lint-title`],[1,`pill`],[`role`,`alert`,1,`empty-line`],[`role`,`status`,1,`empty-line`],[1,`empty-line`,`ok`],[1,`findings`],[`viewBox`,`0 0 24 24`,`aria-hidden`,`true`],[`cx`,`12`,`cy`,`12`,`r`,`9`],[`d`,`M12 11v5M12 8h.01`],[`aria-hidden`,`true`,1,`spinner`],[1,`state-title`],[1,`state-hint`],[`type`,`button`,3,`click`],[1,`list-wrap`],[`aria-label`,`Pipes`,1,`pipe-list`],[`role`,`status`,1,`state`,`compact`],[`id`,`pipe-detail`,`aria-labelledby`,`pipe-detail-title`,1,`detail`],[`aria-label`,`Pipes`,1,`pipe-list`,3,`keydown`],[`type`,`button`,`data-pipe-row`,``,`aria-controls`,`pipe-detail`,1,`row`,3,`click`,`mouseenter`,`mouseleave`,`focus`,`blur`],[1,`row-main`],[1,`name`,`mono`],[1,`sub`,`mono`],[1,`row-meta`],[1,`chip`,`warn`],[1,`chip`,`live`],[1,`chip`],[1,`row-file`,`mono`],[1,`more`],[1,`detail-head`],[`id`,`pipe-detail-title`,1,`mono`],[1,`block`],[1,`mono`],[1,`empty-line`],[1,`sites`],[`role`,`note`,1,`warning`],[1,`chips`],[1,`hint`],[`type`,`button`,1,`component`],[1,`component`],[`type`,`button`,1,`component`,3,`click`,`mouseenter`,`mouseleave`,`focus`,`blur`],[1,`count`],[1,`mono`,`value`],[1,`calls`],[1,`muted`],[`id`,`pipe-detail-title`,1,`visually-hidden`],[1,`state`,`compact`],[`id`,`async-title`],[1,`async-list`],[1,`async-row`],[1,`async-row`,3,`mouseenter`,`mouseleave`],[`type`,`button`,1,`component-name`,`mono`],[1,`mono`,`component-name`],[1,`mono`,`value`,`latest`],[`type`,`button`,1,`component-name`,`mono`,3,`click`,`focus`,`blur`],[1,`finding`],[1,`finding-head`],[1,`severity`],[1,`mono`,`rule`],[1,`where`,`mono`],[1,`finding-message`],[1,`finding-fix`],[1,`fix-label`]],template:function(e,t){if(e&1&&(z(0,`p`,0),J(1,` Pipes declared in your source and the built-in pipes your templates use. Live data shows which components use each pipe on the page; turn on recording to capture calls and the last input and output. `),B(),z(2,`div`,1)(3,`div`,2),A(),z(4,`svg`,3),V(5,`circle`,4)(6,`path`,5),B(),ps(),z(7,`input`,6),G(`input`,function(e){return t.filter.set(e.target.value)})(`keydown.escape`,function(){return t.filter.set(``)}),B()(),z(8,`app-select`,7),ev(`valueChange`,function(e){return $_(t.kind,e)||(t.kind=e),e}),B(),z(9,`span`,8),J(10),B(),z(11,`div`,9)(12,`button`,10),G(`click`,function(){return t.refresh()}),J(13,`Refresh`),B(),z(14,`button`,11),G(`click`,function(){return t.toggleInstrument()}),V(15,`span`,12),J(16),B()()(),P(17,Hz,6,1,`p`,13),P(18,Uz,8,1,`p`,13),P(19,Wz,4,0,`div`,14)(20,Gz,7,0,`div`,15)(21,Kz,5,0,`div`,16)(22,xB,7,2,`div`,17),P(23,OB,16,1,`section`,18),z(24,`section`,19)(25,`h2`,20),J(26,` Lint `),P(27,kB,2,1,`span`,21),B(),P(28,AB,2,0,`p`,22)(29,jB,2,0,`p`,23)(30,MB,2,0,`p`,24)(31,PB,3,0,`ul`,25),B()),e&2){let e,n;M(7),R(`value`,t.filter()),M(),R(`options`,t.kindOptions),Q_(`value`,t.kind),M(2),Z(``,t.filtered().length,` of `,t.pipes().length),M(2),R(`disabled`,t.loading()),M(2),q(`on`,t.instrumenting()),N(`aria-pressed`,t.instrumenting())(`aria-busy`,t.pendingRecord()!==null)(`aria-disabled`,t.pendingRecord()!==null),M(2),X(` `,t.recordLabel(),` `),M(),F((e=t.recordMessage())?17:-1,e),M(),F(t.instrumenting()?18:-1),M(),F(t.loading()&&t.pipes().length===0?19:t.loadFailed()&&t.pipes().length===0?20:t.pipes().length===0?21:22),M(4),F(t.async().length>0?23:-1),M(4),F((n=t.lint())?27:-1,n),M(),F(t.lintFailed()?28:t.lint()===null?29:t.lint().length?31:30)}},dependencies:[mD],styles:[`[_nghost-%COMP%] {
  display: block;
  color: var(--%NS%text);
  font-size: 13px;
}

.mono[_ngcontent-%COMP%] {
  font-family: var(--%NS%font-mono);
}

.intro[_ngcontent-%COMP%] {
  max-width: 720px;
  margin: 0 0 12px;
  color: var(--%NS%text-2);
  line-height: 1.5;
}

.toolbar[_ngcontent-%COMP%] {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  align-items: center;
  margin: 0 0 12px;
  padding: 8px;
  background: color-mix(in srgb, var(--%NS%surface) 85%, transparent);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
}

.search[_ngcontent-%COMP%] {
  position: relative;
  flex: 1 1 220px;
  min-width: 0;
}

.search-icon[_ngcontent-%COMP%] {
  position: absolute;
  top: 50%;
  left: 12px;
  width: 14px;
  height: 14px;
  transform: translateY(-50%);
  fill: none;
  stroke: var(--%NS%text-3);
  stroke-width: 2.2;
  stroke-linecap: round;
  pointer-events: none;
}

.search[_ngcontent-%COMP%]:focus-within   .search-icon[_ngcontent-%COMP%] {
  stroke: var(--%NS%accent);
}

input[type=search][_ngcontent-%COMP%] {
  width: 100%;
  height: var(--%NS%control-h);
  padding: 0 12px 0 34px;
  background: var(--%NS%bg);
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  color: var(--%NS%text);
  font-size: 13px;
  transition: border-color 150ms var(--%NS%ease), box-shadow 150ms var(--%NS%ease);
}

input[type=search][_ngcontent-%COMP%]::placeholder {
  color: var(--%NS%text-3);
}

input[type=search][_ngcontent-%COMP%]:focus-visible {
  outline: none;
  border-color: var(--%NS%accent);
  box-shadow: 0 0 0 3px var(--%NS%accent-soft);
}

.toolbar[_ngcontent-%COMP%]   app-select[_ngcontent-%COMP%] {
  width: 150px;
}

.total[_ngcontent-%COMP%] {
  flex: none;
  color: var(--%NS%text-2);
  font-size: 12px;
  white-space: nowrap;
  font-variant-numeric: tabular-nums;
}

.actions[_ngcontent-%COMP%] {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

button[_ngcontent-%COMP%] {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: var(--%NS%control-h);
  padding: 0 14px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%surface-2);
  color: var(--%NS%text);
  font: inherit;
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 150ms var(--%NS%ease), border-color 150ms var(--%NS%ease);
}

button[_ngcontent-%COMP%]:hover:not(:disabled) {
  border-color: var(--%NS%accent-line);
  background: var(--%NS%surface-3);
}

button[_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: 2px;
}

button[_ngcontent-%COMP%]:disabled {
  cursor: default;
  opacity: 0.6;
}

.record[aria-busy=true][_ngcontent-%COMP%] {
  cursor: progress;
}

.rec-dot[_ngcontent-%COMP%] {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--%NS%text-3);
}

.record.on[_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%accent) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%accent) 12%, transparent);
  color: var(--%NS%accent);
}

.record.on[_ngcontent-%COMP%]   .rec-dot[_ngcontent-%COMP%] {
  background: var(--%NS%accent);
  box-shadow: 0 0 0 3px var(--%NS%accent-soft);
}

.notice[_ngcontent-%COMP%] {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0 0 12px;
  padding: 10px 12px;
  border: 1px solid var(--%NS%accent-line);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%accent-soft);
  color: var(--%NS%text-2);
  line-height: 1.5;
  animation: enter 0.2s var(--%NS%ease) both;
}

.notice[_ngcontent-%COMP%]   strong[_ngcontent-%COMP%] {
  color: var(--%NS%text-strong);
  font-weight: 600;
}

.notice[_ngcontent-%COMP%]   svg[_ngcontent-%COMP%] {
  flex: none;
  width: 16px;
  height: 16px;
  margin-top: 2px;
  fill: none;
  stroke: var(--%NS%accent);
  stroke-width: 2;
  stroke-linecap: round;
}

.layout[_ngcontent-%COMP%] {
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: 12px;
  align-items: start;
}

@media (min-width: 880px) {
  .layout[_ngcontent-%COMP%] {
    grid-template-columns: minmax(0, 1fr) minmax(340px, 44%);
  }
  .detail[_ngcontent-%COMP%] {
    position: sticky;
    top: 64px;
    max-height: calc(100vh - 150px);
    overflow: auto;
  }
}
.list-wrap[_ngcontent-%COMP%] {
  min-width: 0;
}

.pipe-list[_ngcontent-%COMP%] {
  display: grid;
  gap: 2px;
  margin: 0;
  padding: 6px;
  list-style: none;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  animation: enter 0.35s var(--%NS%ease) both;
}

.row[_ngcontent-%COMP%] {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 2px 12px;
  width: 100%;
  height: auto;
  padding: 8px 10px;
  border: 0;
  border-radius: var(--%NS%radius-sm);
  background: none;
  text-align: left;
  font-weight: 400;
  white-space: normal;
}

.row[_ngcontent-%COMP%]:hover:not(:disabled) {
  border-color: transparent;
  background: var(--%NS%surface-2);
}

.row[_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: -2px;
}

.row.selected[_ngcontent-%COMP%] {
  background: var(--%NS%accent-soft);
  box-shadow: inset 2px 0 0 var(--%NS%accent);
}

.row-main[_ngcontent-%COMP%] {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
}

.name[_ngcontent-%COMP%] {
  flex: none;
  color: var(--%NS%text-strong);
  font-size: 13px;
  font-weight: 600;
}

.sub[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-size: 12px;
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.row-meta[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 4px;
}

.row-file[_ngcontent-%COMP%] {
  grid-column: 1/-1;
  color: var(--%NS%text-3);
  font-size: 11px;
  overflow-wrap: anywhere;
}

.more[_ngcontent-%COMP%] {
  margin-left: 6px;
  color: var(--%NS%text-2);
}

.chip[_ngcontent-%COMP%] {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 7px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: 99px;
  color: var(--%NS%text-2);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
}

.chip.impure[_ngcontent-%COMP%], 
.chip.warn[_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%warn) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%warn) 12%, transparent);
  color: var(--%NS%warn);
}

.chip.live[_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%ok) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%ok) 12%, transparent);
  color: var(--%NS%ok);
}

.pill[_ngcontent-%COMP%] {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 16px;
  padding: 0 5px;
  border-radius: 99px;
  background: var(--%NS%surface-3);
  color: var(--%NS%text-2);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0;
  font-variant-numeric: tabular-nums;
}

.detail[_ngcontent-%COMP%] {
  min-width: 0;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  animation: enter 0.35s var(--%NS%ease) both;
}

.detail-head[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 10px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--%NS%border);
}

.detail-head[_ngcontent-%COMP%]   h2[_ngcontent-%COMP%] {
  flex: 1 1 auto;
  min-width: 0;
  margin: 0;
  color: var(--%NS%text-strong);
  font-size: 15px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

.block[_ngcontent-%COMP%] {
  padding: 14px 16px;
  border-bottom: 1px solid var(--%NS%border);
}

.block[_ngcontent-%COMP%]:last-child {
  border-bottom: 0;
}

h3[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 0 10px;
}

dl[_ngcontent-%COMP%] {
  display: grid;
  grid-template-columns: max-content minmax(0, 1fr);
  gap: 6px 14px;
  margin: 0;
}

dt[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
}

dd[_ngcontent-%COMP%] {
  min-width: 0;
  margin: 0;
  color: var(--%NS%text);
}

.value[_ngcontent-%COMP%] {
  font-size: 12px;
  overflow-wrap: anywhere;
}

.muted[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
}

.sites[_ngcontent-%COMP%] {
  display: grid;
  gap: 4px;
  margin: 0;
  padding: 0;
  list-style: none;
  color: var(--%NS%text-2);
  font-size: 12px;
  overflow-wrap: anywhere;
}

.calls[_ngcontent-%COMP%] {
  margin-left: 6px;
  color: var(--%NS%text-3);
}

.chips[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.component[_ngcontent-%COMP%] {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 4px 0 10px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: 99px;
  background: var(--%NS%bg);
  font-size: 12px;
  transition: border-color 150ms var(--%NS%ease), background-color 150ms var(--%NS%ease);
}

button.component[_ngcontent-%COMP%] {
  height: 24px;
  padding: 0 4px 0 10px;
  border-radius: 99px;
  background: var(--%NS%bg);
  font-size: 12px;
  font-weight: 400;
}

.count[_ngcontent-%COMP%] {
  padding: 0 6px;
  border-radius: 99px;
  background: var(--%NS%surface-3);
  color: var(--%NS%text-2);
  font-size: 10px;
  line-height: 16px;
  font-variant-numeric: tabular-nums;
}

.warning[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px;
  margin: 0 0 12px;
  padding: 8px 10px;
  border: 1px solid color-mix(in srgb, var(--%NS%warn) 30%, transparent);
  border-radius: var(--%NS%radius-sm);
  background: color-mix(in srgb, var(--%NS%warn) 8%, transparent);
  color: var(--%NS%text);
  line-height: 1.5;
}

.hint[_ngcontent-%COMP%] {
  margin: 8px 0 0;
  color: var(--%NS%text-3);
  font-size: 12px;
}

.empty-line[_ngcontent-%COMP%] {
  margin: 0;
  color: var(--%NS%text-2);
  line-height: 1.5;
}

.empty-line.ok[_ngcontent-%COMP%] {
  color: var(--%NS%ok);
}

.section[_ngcontent-%COMP%] {
  margin-top: 20px;
  animation: enter 0.35s var(--%NS%ease) both;
}

.section[_ngcontent-%COMP%]   h2[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 8px;
}

.section[_ngcontent-%COMP%]    > .hint[_ngcontent-%COMP%] {
  margin: -2px 0 10px;
}

.async-list[_ngcontent-%COMP%], 
.findings[_ngcontent-%COMP%] {
  display: grid;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.async-row[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
  min-width: 0;
  padding: 8px 12px;
  border-radius: var(--%NS%radius-sm);
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  transition: background-color 150ms var(--%NS%ease), border-color 150ms var(--%NS%ease);
}

.async-row[_ngcontent-%COMP%]:hover {
  border-color: var(--%NS%border-strong);
  background: var(--%NS%surface-2);
}

.component-name[_ngcontent-%COMP%] {
  color: var(--%NS%text-strong);
  font-weight: 600;
}

button.component-name[_ngcontent-%COMP%] {
  height: 24px;
  padding: 0 8px;
  margin-left: -8px;
  border-color: transparent;
  background: none;
  font-size: 13px;
}

.latest[_ngcontent-%COMP%] {
  flex: 1 1 100%;
  color: var(--%NS%text-2);
}

.finding[_ngcontent-%COMP%] {
  padding: 10px 12px;
  border-radius: var(--%NS%radius-sm);
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
}

.finding-head[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 8px;
}

.severity[_ngcontent-%COMP%] {
  padding: 0 7px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: 99px;
  color: var(--%NS%text-2);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  line-height: 16px;
  text-transform: uppercase;
}

.severity[data-tone=warning][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%warn) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%warn) 12%, transparent);
  color: var(--%NS%warn);
}

.severity[data-tone=error][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%danger) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%danger) 12%, transparent);
  color: var(--%NS%danger);
}

.rule[_ngcontent-%COMP%] {
  color: var(--%NS%accent);
  font-size: 12px;
}

.where[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-size: 11px;
  overflow-wrap: anywhere;
}

.finding-message[_ngcontent-%COMP%] {
  margin: 6px 0 0;
  color: var(--%NS%text);
  line-height: 1.5;
}

.finding-fix[_ngcontent-%COMP%] {
  margin: 4px 0 0;
  color: var(--%NS%text-2);
  line-height: 1.5;
}

.fix-label[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-right: 4px;
}

.state[_ngcontent-%COMP%] {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 40px 16px;
  text-align: center;
  background: var(--%NS%surface);
  border: 1px dashed var(--%NS%border-strong);
  border-radius: var(--%NS%radius);
  animation: enter 0.35s var(--%NS%ease) both;
}

.state.compact[_ngcontent-%COMP%] {
  padding: 28px 16px;
  border: 0;
  background: none;
}

.list-wrap[_ngcontent-%COMP%]   .state.compact[_ngcontent-%COMP%] {
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
}

.state-title[_ngcontent-%COMP%] {
  margin: 0;
  color: var(--%NS%text-strong);
  font-size: 14px;
  font-weight: 600;
}

.state-hint[_ngcontent-%COMP%] {
  max-width: 440px;
  margin: 0;
  color: var(--%NS%text-2);
  line-height: 1.5;
}

.state[_ngcontent-%COMP%]   button[_ngcontent-%COMP%] {
  margin-top: 8px;
}

.spinner[_ngcontent-%COMP%] {
  width: 20px;
  height: 20px;
  border: 2px solid var(--%NS%border-strong);
  border-top-color: var(--%NS%accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .spinner[_ngcontent-%COMP%] {
    animation: none;
  }
}`]})},RB=()=>[],zB=()=>[`/`],BB=(e,t)=>t.id,VB=(e,t)=>t.route.id,HB=(e,t)=>t[0],UB=(e,t)=>t.file+t.method,WB=(e,t)=>t.path,GB=(e,t)=>t.mode,KB=(e,t)=>t.file,qB=(e,t)=>t.rule;function JB(e,t){if(e&1){let e=W();z(0,`div`,0)(1,`h2`,3),J(2,`Could not read the project.`),B(),z(3,`p`,4),J(4,` Check that the dev server with Pangular Inspector is still running, then retry. `),B(),z(5,`button`,5),G(`click`,function(){return O(e),k(K().retry())}),J(6,`Retry`),B()()}}function YB(e,t){e&1&&(z(0,`div`,1),V(1,`span`,6),z(2,`span`),J(3,`Reading the project…`),B()())}function XB(e,t){e&1&&(z(0,`div`,2)(1,`h2`,3),J(2,`This app is not an Analog app.`),B(),z(3,`p`,4),J(4,` Add `),z(5,`code`),J(6,`pangular()`),B(),J(7,` from `),z(8,`code`),J(9,`@pangular-inspector/devtools/vite`),B(),J(10,` next to `),z(11,`code`),J(12,`analog()`),B(),J(13,` in vite.config.ts and run the Analog dev server. `),B()())}function ZB(e,t){if(e&1&&(z(0,`div`,11)(1,`span`,9),J(2,`Open in the browser`),B(),z(3,`span`,15),J(4),B()()),e&2){let e=t;M(3),R(`title`,e.url),M(),Y(e.url)}}function QB(e,t){if(e&1){let e=W();z(0,`button`,16),G(`click`,function(){let t=O(e).$implicit;return k(K(2).view.set(t.id))}),J(1),z(2,`span`,17),J(3),B()()}if(e&2){let e=t.$implicit,n=K(2);R(`id`,`analog-tab-`+e.id),N(`aria-selected`,e.id===n.view())(`aria-controls`,`analog-panel-`+e.id)(`tabindex`,e.id===n.view()?0:-1),M(),X(` `,e.label,` `),M(),N(`data-tone`,e.tone),M(),Y(e.count)}}function $B(e,t){e&1&&(z(0,`div`,26),J(1),B()),e&2&&(M(),Y(t))}function eV(e,t){if(e&1&&(z(0,`li`)(1,`span`,31),J(2),B(),z(3,`span`,34),J(4),B()()),e&2){let e=t.$implicit,n=K(5);M(2),Y(n.short(e.file)??e.fullPath),M(),N(`data-kind`,e.kind),M(),Y(e.kind)}}function tV(e,t){if(e&1&&(z(0,`span`,35),J(1),B()),e&2){let e=t.$implicit;M(),Z(``,e[0],` = `,e[1])}}function nV(e,t){if(e&1&&(z(0,`div`,33),I(1,tV,2,2,`span`,35,HB),B()),e&2){let e=K(2),t=K(3);M(),L(t.paramList(e.match.params))}}function rV(e,t){if(e&1&&(z(0,`strong`,31),J(1),B(),J(2,` renders `),z(3,`ol`,32),I(4,eV,5,3,`li`,null,BB),B(),P(6,nV,3,0,`div`,33)),e&2){let e=K(),t=K(3);M(),Y(e.url),M(3),L(e.match.chain),M(2),F(t.paramList(e.match.params).length?6:-1)}}function iV(e,t){if(e&1&&(z(0,`li`)(1,`span`,31),J(2),B(),z(3,`span`,4),J(4),B()()),e&2){let e=t.$implicit,n=K(6);M(2),Y(n.short(e.file)??e.path),M(2),Y(e.reason)}}function aV(e,t){if(e&1&&(z(0,`ul`,36),I(1,iV,5,2,`li`,null,Cg),B()),e&2){let e=K(2);M(),L(e.match.rejected.slice(0,5))}}function oV(e,t){if(e&1&&(z(0,`strong`,31),J(1),B(),J(2,` matches no file route. Angular throws NG04002 "Cannot match any routes". `),P(3,aV,3,0,`ul`,36)),e&2){let e=K();M(),Y(e.url),M(2),F(e.match.rejected.length?3:-1)}}function sV(e,t){if(e&1&&(z(0,`div`,27),P(1,rV,7,2)(2,oV,4,2),B()),e&2){let e=t;N(`data-tone`,e.match.matched?`good`:`bad`),M(),F(e.match.matched?1:2)}}function cV(e,t){e&1&&(z(0,`span`,38),J(1,`└`),B())}function lV(e,t){e&1&&(z(0,`span`,40),J(1,`open`),B())}function uV(e,t){if(e&1&&(z(0,`span`,41)(1,`span`,45),J(2),B(),J(3),B()),e&2){let e=K().$implicit,t=K(3);M(2),Y(t.dir(e.route.file)),M(),Y(t.base(e.route.file))}}function dV(e,t){e&1&&(z(0,`span`,4),J(1,`folder only`),B())}function fV(e,t){if(e&1&&(z(0,`span`,43),J(1),B()),e&2){let e=t.$implicit;M(),X(``,e,`()`)}}function pV(e,t){if(e&1&&(z(0,`span`,44),J(1),B()),e&2){let e=K().$implicit;M(),X(`"`,e.route.title,`"`)}}function mV(e,t){if(e&1&&(z(0,`span`,35),J(1),B()),e&2){let e=K().$implicit;M(),Y(e)}}function hV(e,t){if(e&1&&P(0,mV,2,1,`span`,35),e&2){let e=t.$implicit;F(e===`title`?-1:0)}}function gV(e,t){if(e&1&&(z(0,`tr`)(1,`td`)(2,`div`,37),P(3,cV,2,0,`span`,38),z(4,`span`,39),J(5),B(),z(6,`span`,34),J(7),B(),P(8,lV,2,0,`span`,40),B()(),z(9,`td`),P(10,uV,4,2,`span`,41)(11,dV,2,0,`span`,4),B(),z(12,`td`)(13,`div`,42),I(14,fV,2,1,`span`,43,wg),B()(),z(16,`td`),P(17,pV,2,1,`span`,44),I(18,hV,1,1,null,null,wg),B()()),e&2){let e=t.$implicit,n=K(3);q(`open`,n.isOpen(e.route))(`dim`,e.route.kind===`group`||e.route.kind===`implicit`),M(2),C_(`padding-left`,e.depth*16,`px`),M(),F(e.depth?3:-1),M(2),Y(e.route.fullPath),M(),N(`data-kind`,e.route.kind),M(),Y(n.kindText(e.route)),M(),F(n.isOpen(e.route)?8:-1),M(2),F(e.route.file?10:11),M(4),L(n.serverExports(e.route)),M(3),F(e.route.title?17:-1),M(),L(e.route.routeMeta??ov(13,RB))}}function _V(e,t){e&1&&J(0,` No route matches the filter. Try part of a path or a file name. `)}function vV(e,t){e&1&&J(0,` No file routes yet. Add a .page.ts file under src/app/pages. `)}function yV(e,t){if(e&1&&(z(0,`tr`)(1,`td`,46),P(2,_V,1,0)(3,vV,1,0),B()()),e&2){let e=K(3);M(2),F(e.filter().trim()?2:3)}}function bV(e,t){if(e&1){let e=W();z(0,`div`,18)(1,`form`,19),G(`submit`,function(t){O(e);let n=K(2);return t.preventDefault(),k(n.explain())}),z(2,`label`,20),J(3,`Test a URL`),B(),z(4,`input`,21),G(`input`,function(t){return O(e),k(K(2).testUrl.set(t.target.value))}),B(),z(5,`button`,22),J(6),B()(),z(7,`label`,23),J(8,`Filter routes`),B(),z(9,`input`,24),G(`input`,function(t){return O(e),k(K(2).filter.set(t.target.value))}),B()(),z(10,`div`,25),P(11,$B,2,1,`div`,26)(12,sV,3,2,`div`,27),B(),z(13,`div`,28)(14,`table`)(15,`thead`)(16,`tr`)(17,`th`,29),J(18,`Route`),B(),z(19,`th`,29),J(20,`File`),B(),z(21,`th`,29),J(22,`Data`),B(),z(23,`th`,29),J(24,`Route meta`),B()()(),z(25,`tbody`),I(26,gV,20,14,`tr`,30,VB,!1,yV,4,1,`tr`),B()()()}if(e&2){let e,t=K(2);M(4),R(`value`,t.testUrl()),M(),R(`disabled`,t.explaining()),M(),X(` `,t.explaining()?`Explaining…`:`Explain`,` `),M(3),R(`value`,t.filter()),M(2),F((e=t.explainError())?11:(e=t.explained())?12:-1,e),M(15),L(t.routeRows())}}function xV(e,t){if(e&1&&(z(0,`span`,31),J(1),B(),J(2)),e&2){let e=t.$implicit,n=t.$index,r=t.$count;M(),Y(e),M(),X(``,n===r-1?``:`, `,` `)}}function SV(e,t){if(e&1&&(z(0,`div`,47)(1,`strong`),J(2,`load() ran twice`),B(),J(3,` for `),I(4,xV,3,2,null,null,wg),J(6,` : once while server rendering, again in the browser. TransferState did not serve the server result. `),B()),e&2){let e=K(3);M(4),L(e.duplicates())}}function CV(e,t){if(e&1&&(z(0,`span`,31),J(1),B(),J(2)),e&2){let e=t.$implicit,n=t.$index,r=t.$count;M(),Y(e),M(),X(``,n===r-1?``:`, `,` `)}}function wV(e,t){if(e&1&&(z(0,`div`,47)(1,`strong`),J(2,`Server function read ran twice`),B(),J(3,`: `),I(4,CV,3,2,null,null,wg),J(6,` ran while server rendering, then again in the browser. The browser did not use the TransferState seed. `),B()),e&2){let e=K(3);M(4),L(e.refetchedFns())}}function TV(e,t){if(e&1){let e=W();z(0,`label`)(1,`input`,65),G(`change`,function(){let t=O(e).$implicit;return k(K(3).kind.set(t))}),B(),J(2),z(3,`span`,4),J(4),B()()}if(e&2){let e=t.$implicit,n=K(3);q(`on`,n.kind()===e),M(),R(`checked`,n.kind()===e),M(),X(` `,n.kindLabel(e),` `),M(2),Y(n.kindCount(e))}}function EV(e,t){if(e&1&&(z(0,`strong`,70),J(1),B(),z(2,`span`,73),J(3),B()),e&2){let e=t,n=K(5);M(),Y(e.name),M(2),Y(n.short(e.file))}}function DV(e,t){if(e&1&&(z(0,`span`,70),J(1),B()),e&2){let e=K().$implicit;M(),Y(e.url)}}function OV(e,t){e&1&&(z(0,`span`,34),J(1,`ran during server rendering`),B())}function kV(e,t){if(e&1&&J(0),e&2){let e=K(2).$implicit;X(` to `,e.location,` `)}}function AV(e,t){if(e&1&&(z(0,`span`,34),J(1),P(2,kV,1,1),B()),e&2){let e=K().$implicit,t=K(4);N(`data-tone`,t.outcomeTone(e.outcome)),M(),X(``,t.outcomeLabel(e.outcome),` `),M(),F(e.location?2:-1)}}function jV(e,t){if(e&1&&(z(0,`span`,34),J(1),B()),e&2){let e=K().$implicit;N(`data-mode`,e.render===`ssr`?`ssr`:`client`),M(),Y(e.render===`ssr`?`server rendered`:`client only`)}}function MV(e,t){if(e&1&&(z(0,`details`)(1,`summary`),J(2,`Response`),B(),z(3,`pre`,74),J(4),B()()),e&2){let e=K().$implicit,t=K(4);M(4),Y(t.pretty(e.preview))}}function NV(e,t){e&1&&(z(0,`span`,4),J(1,`in process`),B())}function PV(e,t){if(e&1&&J(0),e&2){let e=K().$implicit;X(` `,e.ms,` ms `)}}function FV(e,t){if(e&1&&(z(0,`tr`)(1,`td`,67),J(2),B(),z(3,`td`)(4,`span`,34),J(5),B()(),z(6,`td`,68)(7,`div`,42)(8,`span`,69),J(9),B(),P(10,EV,4,2)(11,DV,2,1,`span`,70),P(12,OV,2,0,`span`,34),P(13,AV,3,3,`span`,34),P(14,jV,2,2,`span`,34),B(),P(15,MV,5,1,`details`),B(),z(16,`td`)(17,`span`,71),J(18),B()(),z(19,`td`,72),P(20,NV,2,0,`span`,4)(21,PV,1,1),B(),z(22,`td`,4),J(23),B()()),e&2){let e,n=t.$implicit,r=K(4);M(2),Y(r.time(n.at)),M(2),N(`data-call`,n.kind),M(),Y(r.kindLabel(n.kind)),M(3),N(`data-method`,n.method),M(),Y(n.method),M(),F((e=r.fnOf(n))?10:11,e),M(2),F(n.seeded?12:-1),M(),F(n.outcome?13:-1),M(),F(n.render?14:-1),M(),F(n.preview?15:-1),M(2),N(`data-status`,r.statusClass(n.status)),M(),Y(n.status),M(2),F(n.seeded?20:21),M(3),Y(n.from)}}function IV(e,t){if(e&1&&(z(0,`div`,53)(1,`table`)(2,`thead`)(3,`tr`)(4,`th`,29),J(5,`At`),B(),z(6,`th`,29),J(7,`Kind`),B(),z(8,`th`,29),J(9,`Request`),B(),z(10,`th`,29),J(11,`Status`),B(),z(12,`th`,66),J(13,`Duration`),B(),z(14,`th`,29),J(15,`From`),B()()(),z(16,`tbody`),I(17,FV,24,14,`tr`,null,BB),B()()()),e&2){let e=K(3);M(17),L(e.calls())}}function LV(e,t){e&1&&J(0,` No calls of this kind yet. `)}function RV(e,t){e&1&&J(0,` No calls yet. `)}function zV(e,t){if(e&1&&(z(0,`div`,54)(1,`p`,75),P(2,LV,1,0)(3,RV,1,0),B(),z(4,`p`,4),J(5,` Navigate in the app to see page renders, load() fetches, form actions, server functions and API calls. `),B()()),e&2){let e=K(3);M(2),F(e.allCalls().length?2:3)}}function BV(e,t){if(e&1){let e=W();z(0,`tr`)(1,`td`)(2,`span`,69),J(3),B()(),z(4,`td`,31),J(5),B(),z(6,`td`)(7,`span`,41)(8,`span`,45),J(9),B(),J(10),B()(),z(11,`td`,76)(12,`button`,77),G(`click`,function(){let t=O(e).$implicit;return k(K(3).tryApi(t))}),J(13,` Try `),B()()()}if(e&2){let e=t.$implicit,n=K(3);M(2),N(`data-method`,e.method),M(),Y(e.method),M(2),Y(e.path),M(4),Y(n.dir(e.file)),M(),Y(n.base(e.file)),M(2),N(`aria-label`,`Try `+e.method+` `+e.path)}}function VV(e,t){e&1&&(z(0,`tr`)(1,`td`,46),J(2,` No API routes. Add a handler under src/server/routes to test it here. `),B()())}function HV(e,t){if(e&1&&(z(0,`tr`)(1,`td`)(2,`span`,69),J(3),B()(),z(4,`td`,31),J(5),B(),z(6,`td`)(7,`span`,41)(8,`span`,45),J(9),B(),J(10),B()(),z(11,`td`,79),J(12),B()()),e&2){let e=t.$implicit,n=K(4);M(2),N(`data-method`,e.method),M(),Y(e.method),M(2),Y(e.name),M(4),Y(n.dir(e.file)),M(),Y(n.base(e.file)),M(2),Y(n.fnCalls(e.id))}}function UV(e,t){if(e&1&&(z(0,`h2`),J(1,`Server functions`),B(),z(2,`div`,78)(3,`table`)(4,`thead`)(5,`tr`)(6,`th`,29),J(7,`Method`),B(),z(8,`th`,29),J(9,`Name`),B(),z(10,`th`,29),J(11,`File`),B(),z(12,`th`,66),J(13,`Calls`),B()()(),z(14,`tbody`),I(15,HV,13,6,`tr`,null,BB),B()()()),e&2){let e=K(3);M(15),L(e.serverFns())}}function WV(e,t){if(e&1&&(z(0,`p`,61),J(1),B()),e&2){let e=K(3);M(),Y(e.callsOff)}}function GV(e,t){if(e&1&&(z(0,`p`,62),J(1),B()),e&2){let e=K(3);M(),X(` Tick "This request can change data on the dev server" below to send a `,e.method(),` request. `)}}function KV(e,t){if(e&1){let e=W();z(0,`label`,80),J(1,`JSON body`),B(),z(2,`textarea`,81),G(`input`,function(t){return O(e),k(K(3).apiBody.set(t.target.value))}),B(),z(3,`label`,82)(4,`input`,83),G(`change`,function(){O(e);let t=K(3);return k(t.confirmSend.set(!t.confirmSend()))}),B(),J(5,` This request can change data on the dev server`),B()}if(e&2){let e=K(3);M(2),R(`value`,e.apiBody()),M(2),R(`checked`,e.confirmSend())}}function qV(e,t){if(e&1&&(z(0,`p`,63),J(1),B()),e&2){let e=K(3);M(),Z(`Sending `,e.method(),` `,e.apiPath().trim(),`…`)}}function JV(e,t){if(e&1&&(z(0,`div`,57)(1,`span`,84),J(2,`Refused`),B(),z(3,`span`),J(4),B()()),e&2){let e=K();M(4),Y(e.error)}}function YV(e,t){if(e&1&&(z(0,`div`,57)(1,`span`,71),J(2),B(),z(3,`span`,4),J(4),B()(),z(5,`pre`,74),J(6),B()),e&2){let e=K(),t=K(3);M(),N(`data-status`,t.statusClass(e.status??0)),M(),Y(e.status),M(2),Z(``,e.ms,` ms · `,e.type||`no content type`),M(2),Y(t.pretty(e.body??``))}}function XV(e,t){e&1&&(z(0,`div`,64),P(1,JV,5,1,`div`,57)(2,YV,7,5),B()),e&2&&(M(),F(t.error?1:2))}function ZV(e,t){if(e&1){let e=W();P(0,SV,7,0,`div`,47),P(1,wV,7,0,`div`,47),z(2,`div`,48)(3,`fieldset`,49)(4,`legend`,50),J(5,`Show calls of kind`),B(),I(6,TV,5,5,`label`,51,wg),B(),z(8,`button`,52),G(`click`,function(){return O(e),k(K(2).clearCalls())}),J(9,` Clear calls `),B()(),P(10,IV,19,0,`div`,53)(11,zV,6,1,`div`,54),z(12,`h2`),J(13,`API routes`),B(),z(14,`div`,55)(15,`table`)(16,`thead`)(17,`tr`)(18,`th`,29),J(19,`Method`),B(),z(20,`th`,29),J(21,`Path`),B(),z(22,`th`,29),J(23,`File`),B(),z(24,`th`,29)(25,`span`,50),J(26,`Actions`),B()()()(),z(27,`tbody`),I(28,BV,14,6,`tr`,null,UB,!1,VV,3,0,`tr`),B()()(),P(31,UV,17,0),z(32,`form`,56),G(`submit`,function(t){O(e);let n=K(2);return t.preventDefault(),k(n.send())}),z(33,`h2`),J(34,`Request playground`),B(),z(35,`div`,57)(36,`app-select`,58),G(`valueChange`,function(t){return O(e),k(K(2).method.set(t??`GET`))}),B(),z(37,`label`,59),J(38,`Path`),B(),z(39,`input`,60),G(`input`,function(t){return O(e),k(K(2).apiPath.set(t.target.value))}),B(),z(40,`button`,22),J(41),B()(),P(42,WV,2,1,`p`,61)(43,GV,2,1,`p`,62),P(44,KV,6,2),P(45,qV,2,2,`p`,63)(46,XV,3,1,`div`,64),B()}if(e&2){let e,t=K(2);F(t.duplicates().length?0:-1),M(),F(t.refetchedFns().length?1:-1),M(5),L(t.kinds),M(2),R(`disabled`,!t.allCalls().length),M(2),F(t.calls().length?10:11),M(18),L(t.project().api),M(3),F(t.serverFns().length?31:-1),M(5),R(`options`,t.methodOptions)(`value`,t.method()),M(3),R(`value`,t.apiPath()),M(),R(`disabled`,!t.canSend()),N(`aria-describedby`,t.sendHintId()),M(),X(` `,t.sending()?`Sending…`:`Send`,` `),M(),F(t.canCall()?t.needsConfirm()?43:-1:42),M(2),F(t.method()===`GET`?-1:44),M(),F(t.sending()?45:(e=t.response())?46:-1,e)}}function QV(e,t){if(e&1&&(z(0,`span`,34),J(1),B()),e&2){let e=t.$implicit;N(`data-mode`,e.mode),M(),Z(``,e.label,` · `,e.count)}}function $V(e,t){if(e&1&&(z(0,`div`,33),I(1,QV,2,3,`span`,34,GB),B()),e&2){let e=K(3);M(),L(e.modeCounts())}}function eH(e,t){e&1&&(z(0,`span`,89),J(1,`differs from config`),B())}function tH(e,t){if(e&1&&(z(0,`div`,42)(1,`span`,71),J(2),B(),z(3,`span`,88),J(4),B(),P(5,eH,2,0,`span`,89),B()),e&2){let e=t,n=K().$implicit,r=K(3);M(),N(`data-status`,r.statusClass(e.status)),M(),Y(e.status),M(2),Z(``,e.render===`client`?`client only`:`server rendered`,` · `,e.ms,` ms`),M(),F(r.mismatch(n)?5:-1)}}function nH(e,t){e&1&&(z(0,`span`,87),J(1,`not requested yet`),B())}function rH(e,t){if(e&1&&(z(0,`span`,41)(1,`span`,45),J(2),B(),J(3),B()),e&2){let e=K().$implicit,t=K(3);M(2),Y(t.dir(e.file)),M(),Y(t.base(e.file))}}function iH(e,t){if(e&1&&(z(0,`tr`)(1,`td`,39),J(2),B(),z(3,`td`)(4,`div`,42)(5,`span`,34),J(6),B(),z(7,`span`,87),J(8),B()()(),z(9,`td`),P(10,tH,6,5,`div`,42)(11,nH,2,0,`span`,87),B(),z(12,`td`),P(13,rH,4,2,`span`,41),B()()),e&2){let e,n=t.$implicit,r=K(3);M(2),Y(n.path),M(3),N(`data-mode`,n.mode),M(),Y(r.modeLabel(n.mode)),M(2),Y(n.reason),M(2),F((e=n.last)?10:11,e),M(3),F(n.file?13:-1)}}function aH(e,t){e&1&&(z(0,`tr`)(1,`td`,46),J(2,` No page routes to render yet. Add a .page.ts file under src/app/pages. `),B()())}function oH(e,t){e&1&&(z(0,`p`,4),J(1,` prerender.routes is a function, so the list is known only at build time. `),B())}function sH(e,t){if(e&1&&(z(0,`span`,35),J(1),B()),e&2){let e=t.$implicit;M(),Y(e)}}function cH(e,t){e&1&&(z(0,`span`,87),J(1,`default, nothing configured`),B())}function lH(e,t){if(e&1&&(z(0,`span`,35),J(1),B()),e&2){let e=t.$implicit;M(),Y(e)}}function uH(e,t){if(e&1&&(z(0,`dt`),J(1,`From routeRules`),B(),z(2,`dd`),I(3,lH,2,1,`span`,35,wg),B()),e&2){let e=K(2);M(3),L(e.fromRules)}}function dH(e,t){if(e&1&&(z(0,`span`,92),J(1),B()),e&2){let e=t.$implicit;M(),Y(e)}}function fH(e,t){if(e&1&&(z(0,`dt`),J(1,`Static, not listed`),B(),z(2,`dd`),I(3,dH,2,1,`span`,92,wg),B()),e&2){let e=K(2);M(3),L(e.staticMissing)}}function pH(e,t){if(e&1&&(z(0,`span`,35),J(1),B()),e&2){let e=t.$implicit;M(),Y(e)}}function mH(e,t){if(e&1&&(z(0,`dt`),J(1,`Need explicit entries`),B(),z(2,`dd`),I(3,pH,2,1,`span`,35,wg),B()),e&2){let e=K(2);M(3),L(e.dynamic)}}function hH(e,t){if(e&1&&(z(0,`span`,93),J(1),B()),e&2){let e=t.$implicit;M(),Y(e)}}function gH(e,t){if(e&1&&(J(0,` · missing `),I(1,hH,2,1,`span`,93,wg)),e&2){let e=K(3);M(),L(e.notBuilt)}}function _H(e,t){if(e&1&&(J(0),P(1,gH,3,0)),e&2){let e=K(2);X(` `,e.built.length,` page(s) in dist/analog/public `),M(),F(e.notBuilt.length?1:-1)}}function vH(e,t){e&1&&(z(0,`span`,87),J(1,`no build yet`),B())}function yH(e,t){if(e&1&&(z(0,`dl`,90)(1,`dt`),J(2,`Listed`),B(),z(3,`dd`),I(4,sH,2,1,`span`,35,wg),P(6,cH,2,0,`span`,87),B(),P(7,uH,5,0),P(8,fH,5,0),P(9,mH,5,0),z(10,`dt`),J(11,`Build output`),B(),z(12,`dd`,91),P(13,_H,2,2)(14,vH,2,0,`span`,87),B()()),e&2){let e=K();M(4),L(e.listed??ov(5,zB)),M(2),F(e.listed?-1:6),M(),F(e.fromRules?.length?7:-1),M(),F(e.staticMissing.length?8:-1),M(),F(e.dynamic.length?9:-1),M(4),F(e.built.length?13:14)}}function bH(e,t){e&1&&(z(0,`div`,86)(1,`h2`),J(2,`Prerender plan`),B(),P(3,oH,2,0,`p`,4)(4,yH,15,6,`dl`,90),B()),e&2&&(M(3),F(t.dynamicConfig?3:4))}function xH(e,t){if(e&1&&(P(0,$V,3,0,`div`,33),z(1,`div`,85)(2,`table`)(3,`thead`)(4,`tr`)(5,`th`,29),J(6,`Route`),B(),z(7,`th`,29),J(8,`Configured`),B(),z(9,`th`,29),J(10,`Last request`),B(),z(11,`th`,29),J(12,`File`),B()()(),z(13,`tbody`),I(14,iH,14,6,`tr`,null,WB,!1,aH,3,0,`tr`),B()()(),P(17,bH,5,1,`div`,86)),e&2){let e,t=K(2);F(t.modeCounts().length?0:-1),M(14),L(t.renderRows()),M(3),F((e=t.plan())?17:-1,e)}}function SH(e,t){if(e&1&&(z(0,`div`)(1,`span`,96),J(2),B()()),e&2){let e=K().$implicit;M(2),Y(e.error)}}function CH(e,t){if(e&1&&(z(0,`div`)(1,`span`,89),J(2),B()()),e&2){let e=K(5);M(2),X(`takes over `,e.base(t))}}function wH(e,t){if(e&1&&(z(0,`tr`)(1,`td`)(2,`strong`),J(3),B(),P(4,SH,3,1,`div`),P(5,CH,3,1,`div`),B(),z(6,`td`,39),J(7),B(),z(8,`td`,31),J(9),B(),z(10,`td`,95),J(11),B(),z(12,`td`)(13,`span`,41)(14,`span`,45),J(15),B(),J(16),B()()()),e&2){let e,n=t.$implicit,r=K(4);M(3),Y(n.attributes.title||`(no title)`),M(),F(n.error?4:-1),M(),F((e=r.shadowed(n.file))?5:-1,e),M(2),Y(r.contentUrl(n.file)??``),M(2),Y(n.slug),M(2),Y(n.attributes.date||``),M(4),Y(r.dir(n.file)),M(),Y(r.base(n.file))}}function TH(e,t){if(e&1&&(z(0,`div`,94)(1,`table`)(2,`thead`)(3,`tr`)(4,`th`,29),J(5,`Title`),B(),z(6,`th`,29),J(7,`URL`),B(),z(8,`th`,29),J(9,`Slug`),B(),z(10,`th`,29),J(11,`Date`),B(),z(12,`th`,29),J(13,`File`),B()()(),z(14,`tbody`),I(15,wH,17,8,`tr`,null,KB),B()()()),e&2){let e=K(3);M(15),L(e.project().content)}}function EH(e,t){e&1&&(z(0,`div`,54)(1,`p`,75),J(2,`No markdown files under src/content.`),B(),z(3,`p`,4),J(4,` Add a .md file there to see its title, slug, date and the URL it serves. `),B()())}function DH(e,t){e&1&&P(0,TH,17,0,`div`,94)(1,EH,5,0,`div`,54),e&2&&F(+!K(2).project().content.length)}function OH(e,t){if(e&1&&(z(0,`span`,17),J(1),B()),e&2){let e=K().$implicit;M(),Y(e.items.length)}}function kH(e,t){if(e&1&&(z(0,`span`,41)(1,`span`,45),J(2),B(),J(3),B()),e&2){let e=K().$implicit,t=K(5);M(2),Y(t.dir(e.file)),M(),Y(t.base(e.file))}}function AH(e,t){if(e&1&&(z(0,`span`,39),J(1),B()),e&2){let e=K().$implicit;M(),Y(e.path)}}function jH(e,t){if(e&1&&(z(0,`p`,104),J(1),B()),e&2){let e=K().$implicit;M(),Y(e.message)}}function MH(e,t){if(e&1&&(z(0,`li`),P(1,kH,4,2,`span`,41),P(2,AH,2,1,`span`,39),P(3,jH,2,1,`p`,104),B()),e&2){let e=t.$implicit;M(),F(e.file?1:-1),M(),F(e.path&&e.path!==e.file?2:-1),M(),F(e.message?3:-1)}}function NH(e,t){if(e&1&&(z(0,`li`)(1,`div`,99)(2,`span`,34),J(3),B(),z(4,`strong`,100),J(5),B(),P(6,OH,2,1,`span`,17),B(),z(7,`p`),J(8),B(),z(9,`ul`,101),I(10,MH,4,3,`li`,null,Cg),B(),z(12,`div`,102)(13,`strong`),J(14,`How to fix`),B(),J(15),B(),z(16,`span`,103),J(17),B()()),e&2){let e=t.$implicit,n=K(4);N(`data-tone`,n.tone(e.severity)),M(2),N(`data-tone`,n.tone(e.severity)),M(),Y(e.severity),M(2),Y(e.title),M(),F(e.items.length>1?6:-1),M(2),Y(e.summary),M(2),L(e.items),M(5),X(` `,e.fix),M(2),Y(e.rule)}}function PH(e,t){if(e&1&&(z(0,`p`,4),J(1),B(),z(2,`ul`,98),I(3,NH,18,8,`li`,null,qB),B()),e&2){let e=K(3);M(),Z(` `,e.findings().length,` issue(s) in `,e.lintCards().length,` group(s). Each card says what is wrong, where, and how to fix it. `),M(2),L(e.lintCards())}}function FH(e,t){e&1&&(z(0,`div`,97)(1,`strong`),J(2,`No Analog problems found.`),B(),J(3,` Routes, server files, prerender config and content all check out. `),B())}function IH(e,t){e&1&&P(0,PH,5,2)(1,FH,4,0,`div`,97),e&2&&F(+!K(2).findings().length)}function LH(e,t){if(e&1){let e=W();z(0,`section`,7)(1,`div`,8)(2,`span`,9),J(3,`Analog`),B(),z(4,`span`,10),J(5),B()(),z(6,`div`,8)(7,`span`,9),J(8,`Pages`),B(),z(9,`span`,10),J(10),B()(),z(11,`div`,8)(12,`span`,9),J(13,`API routes`),B(),z(14,`span`,10),J(15),B()(),z(16,`div`,8)(17,`span`,9),J(18,`Server calls`),B(),z(19,`span`,10),J(20),B()(),z(21,`div`,8)(22,`span`,9),J(23,`Issues`),B(),z(24,`span`,10),J(25),B()(),P(26,ZB,5,2,`div`,11),B(),z(27,`div`,12),G(`keydown`,function(t){return O(e),k(K().onKey(t))}),I(28,QB,4,7,`button`,13,BB),B(),z(30,`div`,14),P(31,bV,29,6)(32,ZV,47,15)(33,xH,18,3)(34,DH,2,1)(35,IH,2,1),B()}if(e&2){let e,t,n=K();M(5),Y(n.project().version||`unknown`),M(5),Y(n.pageCount()),M(5),Y(n.project().api.length),M(5),Y(n.allCalls().length),M(),N(`data-tone`,n.findings().length?`warn`:`good`),M(4),Y(n.findings().length),M(),F((e=n.page())?26:-1,e),M(2),L(n.views()),M(2),R(`id`,`analog-panel-`+n.view()),N(`aria-labelledby`,`analog-tab-`+n.view()),M(),F((t=n.view())===`routes`?31:t===`server`?32:t===`render`?33:t===`content`?34:t===`lint`?35:-1)}}var RH={"scan-error":{title:`A folder could not be read`,summary:`Its files are missing from routes, API routes and lint results.`},"duplicate-url":{title:`Two files serve the same URL`,summary:`Only one of them is reachable; the other never renders.`},"sibling-params":{title:`Two dynamic pages in one folder`,summary:`Both are [param] pages at the same level, so the first one always wins.`},"missing-default-export":{title:`Page has no default export`,summary:`Analog needs the component as the default export, so the page renders nothing.`},"redirect-with-component":{title:`Redirect page also exports a component`,summary:`The redirect runs first, so the component never shows.`},"redirect-path-match":{title:`Redirect matches too much`,summary:`An empty-path redirect without pathMatch "full" catches every URL below it.`},"layout-without-outlet":{title:`Layout has no router-outlet`,summary:`The layout has child pages, but without <router-outlet> they never render.`},"server-without-load":{title:`.server.ts without load or action`,summary:`The server file exports no load, action or server function, so Analog calls nothing.`},"orphan-server-file":{title:`.server.ts without a page`,summary:`No page file sits next to it, so its load never runs.`},"api-method-suffix":{title:`Unknown method suffix on an API file`,summary:`The suffix is not an HTTP method, so it becomes part of the URL.`},"duplicate-api-route":{title:`Two handlers for one API route`,summary:`Two files answer the same method and path.`},"api-outside-prefix":{title:`Server route outside the API prefix`,summary:`During vite dev only routes under the prefix reach Nitro.`},"prerender-unknown-route":{title:`Prerender entry matches no page`,summary:`prerender.routes lists a path that no page file serves.`},"prerender-missing-root":{title:`Home page is not prerendered`,summary:`static is on, but prerender.routes leaves out /.`},"content-frontmatter":{title:`Broken frontmatter`,summary:`The markdown frontmatter cannot be read.`},"duplicate-slug":{title:`Two posts share a slug`,summary:`injectContent picks one of them at random.`},"content-shadows-page":{title:`Markdown file takes over a page`,summary:`Files under src/content are routes too, so these URLs render the markdown file instead of the [param] page.`},"load-fetched-twice":{title:`load() runs twice`,summary:`These pages fetched their data while rendering on the server and again in the browser.`},"fn-fetched-twice":{title:`Server function read runs twice`,summary:`These reads ran while rendering on the server and again in the browser right after hydration.`},"restart-needed":{title:`New pages need a restart`,summary:`These page files exist, but the running router does not know them yet.`},"hydration-error":{title:`Hydration error`,summary:`The browser DOM did not match the server HTML.`},"api-not-found":{title:`API call failed with 404 or 405`,summary:`A request hit a path or method that no server route handles.`}},zH=new Set([`missing-default-export`,`redirect-with-component`,`redirect-path-match`,`layout-without-outlet`,`server-without-load`,`orphan-server-file`,`load-fetched-twice`,`restart-needed`,`prerender-missing-root`]),BH={ssr:`SSR`,ssg:`Prerendered`,client:`Client only`,cached:`Cached`,redirect:`Redirect`},VH={all:`All`,page:`Pages`,load:`load()`,action:`Actions`,fn:`Server fn`,api:`API`},HH={success:`succeeded`,redirect:`redirected`,invalid:`validation errors`,error:`failed`},UH={success:`good`,redirect:`info`,invalid:`warn`,error:`bad`};function WH(e,t=0,n=[]){for(let r of e)n.push({route:r,depth:t}),WH(r.children,t+1,n);return n}var GH=class e{rpc=$(null);canCall=Q(()=>cE(this.rpc(),`analog`));callsOff=GT(`analog`);kinds=[`all`,`page`,`load`,`action`,`fn`,`api`];methods=[`GET`,`POST`,`PUT`,`PATCH`,`DELETE`];methodOptions=this.methods.map(e=>({value:e,label:e}));view=j(`routes`);project=j(null);loadFailed=j(!1);state=j({});findings=j([]);renderRows=j([]);plan=j(null);filter=j(``);testUrl=j(``);explained=j(null);explainError=j(``);explaining=j(!1);kind=j(`all`);method=j(`GET`);apiPath=j(``);apiBody=j(``);confirmSend=j(!1);response=j(null);sending=j(!1);needsConfirm=Q(()=>this.method()!==`GET`&&!this.confirmSend());canSend=Q(()=>this.canCall()&&!this.sending()&&!this.needsConfirm());sendHintId=Q(()=>this.canCall()?this.needsConfirm()?`analog-confirm-hint`:null:`analog-calls-off`);unsubscribe=null;refreshTimer;refreshRun=0;destroyRef=E(Cs);hostPageId=$T();page=Q(()=>{let e=this.state().pages??[];return(this.hostPageId?e.find(e=>e.pageId===this.hostPageId):e[0])??null});openFiles=Q(()=>new Set((this.page()?.chain??[]).map(e=>e.file)));allCalls=Q(()=>this.state().calls??[]);calls=Q(()=>{let e=this.kind();return this.allCalls().filter(t=>e===`all`||t.kind===e).slice(-150).reverse()});allRoutes=Q(()=>WH(this.project()?.routes??[]));pageCount=Q(()=>this.allRoutes().filter(e=>e.route.file&&e.route.kind!==`layout`).length);routeRows=Q(()=>{let e=this.filter().trim().toLowerCase();return e?this.allRoutes().filter(t=>t.route.fullPath.toLowerCase().includes(e)||!!t.route.file?.toLowerCase().includes(e)):this.allRoutes()});serverFns=Q(()=>this.project()?.serverFns??[]);fnById=Q(()=>new Map(this.serverFns().map(e=>[e.id,e])));refetchedFns=Q(()=>Array.from(new Set((this.state().refetches??[]).map(e=>this.fnById().get(e.id)?.name??e.id))));duplicates=Q(()=>Array.from(new Set((this.state().duplicates??[]).map(e=>e.route))));modeCounts=Q(()=>[`ssr`,`ssg`,`cached`,`client`,`redirect`].map(e=>({mode:e,label:BH[e],count:this.renderRows().filter(t=>t.mode===e).length})).filter(e=>e.count));lintCards=Q(()=>{let e={error:0,warning:1,info:2},t=new Map;for(let e of this.findings()){let n=t.get(e.rule);if(!n){let r=RH[e.rule];n={rule:e.rule,severity:e.severity,title:r?.title??e.rule,summary:r?.summary??e.message,fix:e.fix,items:[]},t.set(e.rule,n)}let r=zH.has(e.rule)||e.message===n.summary?void 0:e.message;n.items.some(t=>t.file===e.file&&t.path===e.path&&t.message===r)||n.items.push({file:e.file,path:e.path,message:r})}return Array.from(t.values()).sort((t,n)=>e[t.severity]-e[n.severity])});views=Q(()=>{let e=this.findings().length;return[{id:`routes`,label:`Routes`,count:this.pageCount(),tone:``},{id:`server`,label:`Server`,count:this.allCalls().length,tone:``},{id:`render`,label:`Render`,count:this.renderRows().length,tone:``},{id:`content`,label:`Content`,count:this.project()?.content.length??0,tone:``},{id:`lint`,label:`Lint`,count:e,tone:e?`warn`:``}]});constructor(){uc(()=>{let e=this.rpc();e&&Cv(()=>void this.load(e))}),uc(()=>{let e=this.view();this.state(),Cv(()=>this.scheduleRefresh(e))}),this.destroyRef.onDestroy(()=>{this.unsubscribe?.(),clearTimeout(this.refreshTimer)})}async load(e){let t=await iE(e,`analog-project`);if(!this.destroyRef.destroyed){this.project.set(t),this.loadFailed.set(t===null);try{let t=await e.scope(`pangular`).rpc.sharedState(`analog`);if(this.destroyRef.destroyed)return;let n=e=>this.state.set(e??{});n(t.value()),this.unsubscribe?.(),this.unsubscribe=t.on(`updated`,n)}catch{this.state.set({})}this.destroyRef.destroyed||await this.refresh(this.view())}}retry(){let e=this.rpc();e&&(this.loadFailed.set(!1),this.load(e))}scheduleRefresh(e){clearTimeout(this.refreshTimer),this.refreshTimer=setTimeout(()=>void this.refresh(e),300)}async refresh(e){let t=this.rpc();if(!t)return;let n=++this.refreshRun,[r,i]=await Promise.all([iE(t,`analog-lint`),iE(t,`analog-render`)]);if(n===this.refreshRun&&(this.findings.set(r??[]),this.renderRows.set(i?.rows??[]),this.plan.set(i?.plan??null),e===`routes`||e===`content`||this.project()===null)){let e=await iE(t,`analog-project`);e&&n===this.refreshRun&&(this.project.set(e),this.loadFailed.set(!1))}}isOpen(e){return!!e.file&&this.openFiles().has(e.file)}kindText(e){return e.catchAll?e.catchAll===`optional`?`optional catch-all`:`catch-all`:e.kind===`implicit`?`folder`:e.kind}serverExports(e){return(e.serverExports??[]).filter(e=>e===`load`||e===`action`)}short(e){return e?.replace(/^\/src\/app\//,``).replace(/^\//,``)}dir(e){let t=this.short(e)??e;return t.includes(`/`)?t.slice(0,t.lastIndexOf(`/`)+1):``}base(e){return e.slice(e.lastIndexOf(`/`)+1)}paramList(e){return Object.entries(e)}kindLabel(e){return VH[e]}kindCount(e){return e===`all`?this.allCalls().length:this.allCalls().filter(t=>t.kind===e).length}modeLabel(e){return BH[e]}mismatch(e){return!e.last?.render||e.mode===`redirect`?!1:e.mode===`client`?e.last.render!==`client`:e.last.render===`client`}fnOf(e){return e.kind===`fn`&&e.route?this.fnById().get(e.route):void 0}fnCalls(e){return this.allCalls().filter(t=>t.kind===`fn`&&t.route===e).length}outcomeLabel(e){return HH[e]}outcomeTone(e){return UH[e]}statusClass(e){return e>=500||e===0?`bad`:e>=400?`warn`:`good`}tone(e){return e===`error`?`bad`:e===`warning`?`warn`:`info`}shadowed(e){return this.findings().find(t=>t.rule===`content-shadows-page`&&t.file===e)?.message.match(/(\/\S+\.page\.ts)/)?.[1]}contentUrl(e){return this.allRoutes().find(t=>t.route.file===e)?.route.fullPath}pretty(e){try{return JSON.stringify(JSON.parse(e),null,2)}catch{return e}}time=SD;tryApi(e){this.method.set(e.method===`ANY`?`GET`:e.method),this.apiPath.set(e.path.replace(/:(\w+)/g,`1`).replace(`**`,`x`)),this.response.set(null),queueMicrotask(()=>document.getElementById(`api-path`)?.focus())}async clearCalls(){await iE(this.rpc(),`analog-clear-calls`)}async explain(){let e=this.testUrl().trim();if(!e){this.explained.set(null),this.explainError.set(`Type a URL to explain, for example /products/42.`);return}this.explaining.set(!0),this.explainError.set(``);try{let t=await rE(this.rpc(),`analog-explain-url`,e);if(!t)throw Error(`The devtools server did not answer`);this.explained.set({url:e,match:t})}catch(t){let n=String(t?.message||`The devtools server did not answer`);this.explained.set(null),this.explainError.set(`Could not explain ${e}. ${n.replace(/\.?$/,`.`)}`)}finally{this.explaining.set(!1)}}async send(){let e=this.apiPath().trim();if(!e||this.sending()||this.needsConfirm())return;let t;if(this.method()!==`GET`&&this.apiBody().trim())try{t=JSON.parse(this.apiBody())}catch{this.response.set({error:`The body is not valid JSON.`});return}this.response.set(null),this.sending.set(!0);try{let n=await iE(this.rpc(),`analog-call-api`,{method:this.method(),path:e,body:t,confirm:this.confirmSend()});this.response.set(n??{error:`No answer from the devtools server.`})}finally{this.sending.set(!1)}}onKey(e){let t=this.views().map(e=>e.id),n=t.indexOf(this.view()),r=n;if(e.key===`ArrowRight`)r=(n+1)%t.length;else if(e.key===`ArrowLeft`)r=(n-1+t.length)%t.length;else if(e.key===`Home`)r=0;else if(e.key===`End`)r=t.length-1;else return;e.preventDefault(),this.view.set(t[r]);let i=e.currentTarget;queueMicrotask(()=>i.querySelector(`#analog-tab-${t[r]}`)?.focus())}static ɵfac=function(t){return new(t||e)};static ɵcmp=Bh({type:e,selectors:[[`app-analog-inspector`]],inputs:{rpc:[1,`rpc`]},decls:4,vars:1,consts:[[`role`,`alert`,1,`empty`],[`role`,`status`,1,`loading`],[1,`empty`],[1,`empty-title`],[1,`muted`],[`type`,`button`,1,`btn`,3,`click`],[`aria-hidden`,`true`,1,`spinner`],[`aria-label`,`Analog summary`,1,`summary`],[1,`stat`],[1,`label`],[1,`value`],[1,`stat`,`wide`],[`role`,`tablist`,`aria-label`,`Analog views`,1,`tabs`,3,`keydown`],[`type`,`button`,`role`,`tab`,3,`id`],[`role`,`tabpanel`,1,`panel`,3,`id`],[1,`value`,`mono`,3,`title`],[`type`,`button`,`role`,`tab`,3,`click`,`id`],[1,`count`],[1,`toolbar`],[1,`inline`,`explain`,3,`submit`],[`for`,`analog-url`],[`id`,`analog-url`,`type`,`text`,`placeholder`,`/products/42`,1,`field`,`grow`,`mono`,3,`input`,`value`],[`type`,`submit`,1,`btn`,`primary`,3,`disabled`],[`for`,`route-filter`,1,`sr-only`],[`id`,`route-filter`,`type`,`search`,`placeholder`,`Filter by path or file`,1,`field`,`filter`,3,`input`,`value`],[`role`,`status`,1,`explain-result`],[`data-tone`,`bad`,1,`callout`],[1,`callout`],[`role`,`region`,`aria-label`,`File routes`,`tabindex`,`0`,1,`table-wrap`],[`scope`,`col`],[3,`open`,`dim`],[1,`mono`],[1,`chain`],[1,`chips`],[1,`pill`],[1,`chip`,`mono`],[1,`plain`],[1,`route`],[`aria-hidden`,`true`,1,`guide`],[1,`mono`,`path`],[1,`pill`,`live`],[1,`file`],[1,`meta`],[`data-kind`,`load`,1,`pill`],[1,`chip`],[1,`dir`],[`colspan`,`4`,1,`empty-row`],[`data-tone`,`warn`,`role`,`note`,1,`callout`],[1,`calls-bar`],[1,`segmented`],[1,`sr-only`],[3,`on`],[`type`,`button`,1,`btn`,`ghost`,3,`click`,`disabled`],[`role`,`region`,`aria-label`,`Server calls`,`tabindex`,`0`,1,`table-wrap`],[1,`empty-box`],[`role`,`region`,`aria-label`,`API routes`,`tabindex`,`0`,1,`table-wrap`],[1,`card`,`playground`,3,`submit`],[1,`row`],[`ariaLabel`,`Method`,1,`method-select`,3,`valueChange`,`options`,`value`],[`for`,`api-path`,1,`sr-only`],[`id`,`api-path`,`type`,`text`,`placeholder`,`/api/v1/products`,1,`field`,`grow`,`mono`,3,`input`,`value`],[`id`,`analog-calls-off`,1,`muted`],[`id`,`analog-confirm-hint`,1,`muted`],[`role`,`status`,1,`muted`],[`role`,`status`,1,`response`],[`type`,`radio`,`name`,`analog-kind`,1,`sr-only`,3,`change`,`checked`],[`scope`,`col`,1,`num`],[1,`muted`,`nowrap`],[1,`request`],[1,`method`],[1,`mono`,`url`],[1,`status`],[1,`num`,`nowrap`],[1,`mono`,`muted`],[1,`code`],[1,`empty-lead`],[1,`actions`],[`type`,`button`,1,`btn`,`ghost`,3,`click`],[`role`,`region`,`aria-label`,`Server functions`,`tabindex`,`0`,1,`table-wrap`],[1,`num`,`tnum`],[`for`,`api-body`],[`id`,`api-body`,`rows`,`3`,`placeholder`,`{"name": "Ada"}`,1,`field`,`mono`,3,`input`,`value`],[1,`check`],[`type`,`checkbox`,3,`change`,`checked`],[`data-status`,`bad`,1,`status`],[`role`,`region`,`aria-label`,`Render modes`,`tabindex`,`0`,1,`table-wrap`],[1,`card`],[1,`muted`,`small`],[1,`muted`,`small`,`tnum`],[`data-tone`,`warn`,1,`pill`],[1,`facts`],[1,`tnum`],[`data-tone`,`warn`,1,`chip`,`mono`],[`data-tone`,`bad`,1,`chip`,`mono`],[`role`,`region`,`aria-label`,`Content files`,`tabindex`,`0`,1,`table-wrap`],[1,`muted`,`nowrap`,`tnum`],[`data-tone`,`bad`,1,`pill`],[`data-tone`,`good`,`role`,`status`,1,`callout`],[1,`findings`],[1,`finding-head`],[1,`finding-title`],[1,`where`],[1,`fix`],[1,`rule`,`mono`],[1,`detail`]],template:function(e,t){e&1&&P(0,JB,7,0,`div`,0)(1,YB,4,0,`div`,1)(2,XB,14,0,`div`,2)(3,LH,36,10),e&2&&F(t.project()===null&&t.loadFailed()?0:t.project()===null?1:t.project().analog?3:2)},dependencies:[mD],styles:[`@charset "UTF-8";
[_nghost-%COMP%] {
  --%NS%good: var(--%NS%ok);
  --%NS%bad: var(--%NS%danger);
  --%NS%info: #60a5fa;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme=dark])   [_nghost-%COMP%] {
    --%NS%info: #1d4ed8;
  }
}
:root[data-theme=light]   [_nghost-%COMP%] {
  --%NS%info: #1d4ed8;
}

[_nghost-%COMP%] {
  --%NS%mono: var(--%NS%font-mono);
  display: grid;
  gap: 16px;
  min-width: 0;
  color: var(--%NS%text);
  font-size: 13px;
}

.loading[_ngcontent-%COMP%] {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 16px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  color: var(--%NS%text-2);
}

.spinner[_ngcontent-%COMP%] {
  width: 16px;
  height: 16px;
  flex: none;
  border: 2px solid var(--%NS%border-strong);
  border-top-color: var(--%NS%accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .spinner[_ngcontent-%COMP%] {
    animation: none;
    border-color: var(--%NS%accent-line);
  }
}
.tnum[_ngcontent-%COMP%] {
  font-variant-numeric: tabular-nums;
}

.meta[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 8px;
  align-items: center;
  min-width: 0;
}

.empty-row[_ngcontent-%COMP%] {
  padding: 24px 16px;
  color: var(--%NS%text-2);
  text-align: center;
}

tbody[_ngcontent-%COMP%]   tr[_ngcontent-%COMP%]:hover   td.empty-row[_ngcontent-%COMP%] {
  background: transparent;
}

.empty-box[_ngcontent-%COMP%] {
  display: grid;
  gap: 4px;
  padding: 24px 16px;
  border: 1px dashed var(--%NS%border-strong);
  border-radius: var(--%NS%radius);
  text-align: center;
}

.empty-box[_ngcontent-%COMP%]   p[_ngcontent-%COMP%] {
  margin: 0;
  line-height: 1.55;
}

.empty-lead[_ngcontent-%COMP%] {
  color: var(--%NS%text-strong);
  font-weight: 600;
}

.mono[_ngcontent-%COMP%] {
  font-family: var(--%NS%mono);
  font-size: 12.5px;
}

.muted[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
}

.small[_ngcontent-%COMP%] {
  font-size: 12px;
}

.nowrap[_ngcontent-%COMP%] {
  white-space: nowrap;
}

code[_ngcontent-%COMP%] {
  padding: 1px 6px;
  border: 1px solid var(--%NS%border);
  border-radius: 6px;
  background: var(--%NS%surface-2);
  color: var(--%NS%text-strong);
  font-family: var(--%NS%mono);
  font-size: 12.5px;
}

.summary[_ngcontent-%COMP%] {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
  gap: 12px;
  animation: enter 0.35s var(--%NS%ease) both;
}

.stat[_ngcontent-%COMP%] {
  display: grid;
  gap: 6px;
  align-content: start;
  padding: 12px 16px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  box-shadow: var(--%NS%shadow);
  transition: border-color 180ms var(--%NS%ease), background-color 180ms var(--%NS%ease);
}

.stat[_ngcontent-%COMP%]:hover {
  border-color: var(--%NS%border-strong);
}

.stat.wide[_ngcontent-%COMP%] {
  grid-column: span 2;
  min-width: 0;
}

@media (max-width: 340px) {
  .stat.wide[_ngcontent-%COMP%] {
    grid-column: 1/-1;
  }
}
.stat[_ngcontent-%COMP%]   .label[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.stat[_ngcontent-%COMP%]   .value[_ngcontent-%COMP%] {
  color: var(--%NS%text-strong);
  font-size: 20px;
  font-weight: 600;
  letter-spacing: -0.01em;
  font-variant-numeric: tabular-nums;
  overflow-wrap: anywhere;
}

.stat[_ngcontent-%COMP%]   .value.mono[_ngcontent-%COMP%] {
  overflow: hidden;
  color: var(--%NS%text);
  font-size: 13px;
  font-weight: 500;
  line-height: 24px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.stat[data-tone=warn][_ngcontent-%COMP%]   .value[_ngcontent-%COMP%] {
  color: var(--%NS%warn);
}

.stat[data-tone=good][_ngcontent-%COMP%]   .value[_ngcontent-%COMP%] {
  color: var(--%NS%ok);
}

.tabs[_ngcontent-%COMP%] {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 2px;
  justify-self: start;
  max-width: 100%;
  padding: 3px;
  border: 1px solid var(--%NS%border);
  border-radius: 10px;
  background: var(--%NS%bg);
}

[role=tab][_ngcontent-%COMP%] {
  display: inline-flex;
  gap: 8px;
  align-items: center;
  min-height: 28px;
  padding: 4px 12px;
  border: none;
  border-radius: 7px;
  background: transparent;
  color: var(--%NS%text-2);
  font: inherit;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 180ms var(--%NS%ease), color 180ms var(--%NS%ease), box-shadow 180ms var(--%NS%ease);
}

[role=tab][_ngcontent-%COMP%]:hover {
  color: var(--%NS%text);
}

[role=tab][aria-selected=true][_ngcontent-%COMP%] {
  background: var(--%NS%surface-3);
  color: var(--%NS%text-strong);
  box-shadow: inset 0 0 0 1px var(--%NS%border-strong);
}

.count[_ngcontent-%COMP%] {
  min-width: 20px;
  padding: 0 6px;
  border-radius: 99px;
  background: var(--%NS%surface-3);
  color: var(--%NS%text-2);
  font-size: 11px;
  font-weight: 600;
  line-height: 18px;
  text-align: center;
  font-variant-numeric: tabular-nums;
}

[role=tab][aria-selected=true][_ngcontent-%COMP%]   .count[_ngcontent-%COMP%] {
  background: var(--%NS%border-strong);
  color: var(--%NS%text);
}

.count[data-tone=warn][_ngcontent-%COMP%], 
[role=tab][aria-selected=true][_ngcontent-%COMP%]   .count[data-tone=warn][_ngcontent-%COMP%] {
  background: color-mix(in srgb, var(--%NS%warn) 12%, transparent);
  color: var(--%NS%warn);
}

.panel[_ngcontent-%COMP%] {
  display: grid;
  gap: 16px;
  min-width: 0;
  animation: enter 0.35s var(--%NS%ease) both;
}

.toolbar[_ngcontent-%COMP%] {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  padding: 12px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: color-mix(in srgb, var(--%NS%surface) 85%, transparent);
  backdrop-filter: blur(10px);
}

.explain[_ngcontent-%COMP%] {
  flex: 1 1 320px;
  min-width: 0;
}

.filter[_ngcontent-%COMP%] {
  flex: 0 1 240px;
  min-width: 0;
}

@media (max-width: 560px) {
  .filter[_ngcontent-%COMP%] {
    flex: 1 1 100%;
  }
}
.inline[_ngcontent-%COMP%], 
.row[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.inline[_ngcontent-%COMP%]    > label[_ngcontent-%COMP%], 
.playground[_ngcontent-%COMP%]    > label[_ngcontent-%COMP%]:not(.check) {
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.field[_ngcontent-%COMP%] {
  box-sizing: border-box;
  height: 34px;
  padding: 0 12px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  background-color: var(--%NS%bg);
  color: var(--%NS%text);
  font: inherit;
  font-size: 13px;
  transition: border-color 180ms var(--%NS%ease), box-shadow 180ms var(--%NS%ease);
}

.field.mono[_ngcontent-%COMP%] {
  font-family: var(--%NS%mono);
  font-size: 13px;
}

.field[_ngcontent-%COMP%]::placeholder {
  color: var(--%NS%text-3);
}

.field[_ngcontent-%COMP%]:focus, 
.field[_ngcontent-%COMP%]:focus-visible {
  border-color: var(--%NS%accent);
  box-shadow: 0 0 0 3px var(--%NS%accent-soft);
  outline: none;
}

.method-select[_ngcontent-%COMP%] {
  width: 112px;
  font-family: var(--%NS%mono);
}

textarea.field[_ngcontent-%COMP%] {
  height: auto;
  padding: 8px 12px;
}

.grow[_ngcontent-%COMP%] {
  flex: 1 1 180px;
  min-width: 0;
}

.btn[_ngcontent-%COMP%] {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  height: 34px;
  padding: 0 14px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%surface-2);
  color: var(--%NS%text);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: background-color 160ms var(--%NS%ease), border-color 160ms var(--%NS%ease), color 160ms var(--%NS%ease);
}

.btn[_ngcontent-%COMP%]:hover {
  background: var(--%NS%surface-3);
  border-color: var(--%NS%border-strong);
}

.btn[_ngcontent-%COMP%]:active {
  transform: translateY(1px);
}

.btn.primary[_ngcontent-%COMP%] {
  border-color: var(--%NS%accent);
  background: var(--%NS%accent);
  color: var(--%NS%accent-ink);
  font-weight: 600;
}

.btn.primary[_ngcontent-%COMP%]:hover {
  border-color: var(--%NS%accent-hover);
  background: var(--%NS%accent-hover);
}

.btn.ghost[_ngcontent-%COMP%] {
  height: 28px;
  padding: 0 12px;
  font-size: 12px;
}

.btn.ghost[_ngcontent-%COMP%]:hover {
  border-color: var(--%NS%accent-line);
  color: var(--%NS%text-strong);
}

td.actions[_ngcontent-%COMP%] {
  width: 1%;
  text-align: right;
  vertical-align: middle;
}

.btn[_ngcontent-%COMP%]:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

[role=tab][_ngcontent-%COMP%]:focus-visible, 
.btn[_ngcontent-%COMP%]:focus-visible, 
.table-wrap[_ngcontent-%COMP%]:focus-visible, 
summary[_ngcontent-%COMP%]:focus-visible, 
.segmented[_ngcontent-%COMP%]   label[_ngcontent-%COMP%]:focus-within {
  outline: 2px solid var(--%NS%accent);
  outline-offset: 2px;
}

.callout[_ngcontent-%COMP%] {
  padding: 12px 16px;
  border: 1px solid color-mix(in srgb, var(--%NS%info) 30%, transparent);
  border-radius: var(--%NS%radius);
  background: color-mix(in srgb, var(--%NS%info) 8%, var(--%NS%surface));
  line-height: 1.6;
  animation: enter 0.35s var(--%NS%ease) both;
}

.callout[data-tone=good][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%ok) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%ok) 12%, transparent);
}

.callout[data-tone=warn][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%warn) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%warn) 12%, transparent);
}

.callout[data-tone=bad][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%danger) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%danger) 12%, transparent);
}

.callout[_ngcontent-%COMP%]   strong[_ngcontent-%COMP%] {
  color: var(--%NS%text-strong);
}

.callout[_ngcontent-%COMP%]   strong.mono[_ngcontent-%COMP%] {
  overflow-wrap: anywhere;
}

.chain[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.chain[_ngcontent-%COMP%]   li[_ngcontent-%COMP%] {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  min-width: 0;
  overflow-wrap: anywhere;
}

.chain[_ngcontent-%COMP%]   li[_ngcontent-%COMP%]:not(:last-child)::after {
  content: "›";
  margin-left: 2px;
  color: var(--%NS%text-3);
}

.callout[_ngcontent-%COMP%]   .chips[_ngcontent-%COMP%] {
  margin-top: 8px;
}

.plain[_ngcontent-%COMP%] {
  margin: 8px 0 0;
  padding-left: 18px;
}

.plain[_ngcontent-%COMP%]   li[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.table-wrap[_ngcontent-%COMP%] {
  overflow-x: auto;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  box-shadow: var(--%NS%shadow);
  animation: enter 0.35s var(--%NS%ease) both;
}

table[_ngcontent-%COMP%] {
  width: 100%;
  min-width: 560px;
  border-collapse: collapse;
}

th[_ngcontent-%COMP%], 
td[_ngcontent-%COMP%] {
  padding: 10px 12px;
  border-bottom: 1px solid var(--%NS%border);
  text-align: left;
  vertical-align: top;
}

tbody[_ngcontent-%COMP%]   tr[_ngcontent-%COMP%]:last-child   td[_ngcontent-%COMP%] {
  border-bottom: none;
}

th[_ngcontent-%COMP%] {
  position: sticky;
  top: 0;
  background: var(--%NS%surface);
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  white-space: nowrap;
}

.num[_ngcontent-%COMP%] {
  text-align: right;
  font-variant-numeric: tabular-nums;
}

td.nowrap[_ngcontent-%COMP%] {
  font-variant-numeric: tabular-nums;
}

tbody[_ngcontent-%COMP%]   td[_ngcontent-%COMP%] {
  transition: background-color 160ms var(--%NS%ease);
}

tbody[_ngcontent-%COMP%]   tr[_ngcontent-%COMP%]:hover   td[_ngcontent-%COMP%] {
  background: var(--%NS%surface-2);
}

tr.open[_ngcontent-%COMP%]   td[_ngcontent-%COMP%] {
  background: var(--%NS%accent-soft);
  color: var(--%NS%text-strong);
}

tr.open[_ngcontent-%COMP%]:hover   td[_ngcontent-%COMP%] {
  background: color-mix(in srgb, var(--%NS%accent) 16%, transparent);
}

tr.open[_ngcontent-%COMP%]   td[_ngcontent-%COMP%]:first-child {
  box-shadow: inset 2px 0 0 var(--%NS%accent);
}

tr.dim[_ngcontent-%COMP%]   .path[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
}

.route[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.guide[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-family: var(--%NS%mono);
}

.path[_ngcontent-%COMP%] {
  color: var(--%NS%text-strong);
  overflow-wrap: anywhere;
}

.file[_ngcontent-%COMP%] {
  font-family: var(--%NS%mono);
  font-size: 12.5px;
  color: var(--%NS%text);
  overflow-wrap: anywhere;
}

.dir[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
}

.pill[_ngcontent-%COMP%], 
.chip[_ngcontent-%COMP%], 
.status[_ngcontent-%COMP%], 
.method[_ngcontent-%COMP%] {
  display: inline-block;
  padding: 1px 8px;
  border-radius: 99px;
  font-size: 11px;
  font-weight: 500;
  line-height: 18px;
  white-space: nowrap;
}

.pill[_ngcontent-%COMP%] {
  border: 1px solid var(--%NS%border-strong);
  background: var(--%NS%surface-2);
  color: var(--%NS%text-2);
}

.chip[_ngcontent-%COMP%] {
  margin: 0 4px 4px 0;
  padding: 3px 10px;
  border: 1px solid var(--%NS%border);
  background: var(--%NS%surface-2);
  color: var(--%NS%text);
  font-size: 12px;
  line-height: 16px;
}

.chip.mono[_ngcontent-%COMP%] {
  font-size: 12px;
}

.chips[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chips[_ngcontent-%COMP%]   .pill[_ngcontent-%COMP%] {
  padding: 3px 10px;
  font-size: 12px;
}

.pill.live[_ngcontent-%COMP%] {
  border-color: var(--%NS%accent-line);
  background: color-mix(in srgb, var(--%NS%accent) 12%, var(--%NS%surface));
  color: var(--%NS%accent);
}

.pill[data-kind=layout][_ngcontent-%COMP%] {
  border-color: #94a3b8;
  color: #e2e8f0;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme=dark])   [_nghost-%COMP%]   .pill[data-kind=layout][_ngcontent-%COMP%] {
    border-color: #64748b;
    color: #475569;
  }
}
:root[data-theme=light]   [_nghost-%COMP%]   .pill[data-kind=layout][_ngcontent-%COMP%] {
  border-color: #64748b;
  color: #475569;
}

.pill[data-kind=markdown][_ngcontent-%COMP%] {
  border-color: #0ea5e9;
  color: #bae6fd;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme=dark])   [_nghost-%COMP%]   .pill[data-kind=markdown][_ngcontent-%COMP%] {
    border-color: #0284c7;
    color: #0369a1;
  }
}
:root[data-theme=light]   [_nghost-%COMP%]   .pill[data-kind=markdown][_ngcontent-%COMP%] {
  border-color: #0284c7;
  color: #0369a1;
}

.pill[data-kind=load][_ngcontent-%COMP%] {
  border-color: #2dd4bf;
  color: #99f6e4;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme=dark])   [_nghost-%COMP%]   .pill[data-kind=load][_ngcontent-%COMP%] {
    border-color: #0d9488;
    color: #0f766e;
  }
}
:root[data-theme=light]   [_nghost-%COMP%]   .pill[data-kind=load][_ngcontent-%COMP%] {
  border-color: #0d9488;
  color: #0f766e;
}

.pill[data-mode=ssr][_ngcontent-%COMP%] {
  border-color: #3b82f6;
  color: #bfdbfe;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme=dark])   [_nghost-%COMP%]   .pill[data-mode=ssr][_ngcontent-%COMP%] {
    border-color: #2563eb;
    color: #1d4ed8;
  }
}
:root[data-theme=light]   [_nghost-%COMP%]   .pill[data-mode=ssr][_ngcontent-%COMP%] {
  border-color: #2563eb;
  color: #1d4ed8;
}

.pill[data-mode=ssg][_ngcontent-%COMP%] {
  border-color: #22c55e;
  color: #bbf7d0;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme=dark])   [_nghost-%COMP%]   .pill[data-mode=ssg][_ngcontent-%COMP%] {
    border-color: #16a34a;
    color: #166534;
  }
}
:root[data-theme=light]   [_nghost-%COMP%]   .pill[data-mode=ssg][_ngcontent-%COMP%] {
  border-color: #16a34a;
  color: #166534;
}

.pill[data-mode=client][_ngcontent-%COMP%] {
  border-color: #eab308;
  color: #fef08a;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme=dark])   [_nghost-%COMP%]   .pill[data-mode=client][_ngcontent-%COMP%] {
    border-color: #92400e;
    color: #713f12;
  }
}
:root[data-theme=light]   [_nghost-%COMP%]   .pill[data-mode=client][_ngcontent-%COMP%] {
  border-color: #92400e;
  color: #713f12;
}

.pill[data-mode=cached][_ngcontent-%COMP%] {
  border-color: #a855f7;
  color: #e9d5ff;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme=dark])   [_nghost-%COMP%]   .pill[data-mode=cached][_ngcontent-%COMP%] {
    border-color: #9333ea;
    color: #7e22ce;
  }
}
:root[data-theme=light]   [_nghost-%COMP%]   .pill[data-mode=cached][_ngcontent-%COMP%] {
  border-color: #9333ea;
  color: #7e22ce;
}

.pill[data-mode=redirect][_ngcontent-%COMP%] {
  border-color: #94a3b8;
  color: #e2e8f0;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme=dark])   [_nghost-%COMP%]   .pill[data-mode=redirect][_ngcontent-%COMP%] {
    border-color: #64748b;
    color: #475569;
  }
}
:root[data-theme=light]   [_nghost-%COMP%]   .pill[data-mode=redirect][_ngcontent-%COMP%] {
  border-color: #64748b;
  color: #475569;
}

.pill[data-call=page][_ngcontent-%COMP%] {
  border-color: #3b82f6;
  color: #bfdbfe;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme=dark])   [_nghost-%COMP%]   .pill[data-call=page][_ngcontent-%COMP%] {
    border-color: #2563eb;
    color: #1d4ed8;
  }
}
:root[data-theme=light]   [_nghost-%COMP%]   .pill[data-call=page][_ngcontent-%COMP%] {
  border-color: #2563eb;
  color: #1d4ed8;
}

.pill[data-call=load][_ngcontent-%COMP%] {
  border-color: #2dd4bf;
  color: #99f6e4;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme=dark])   [_nghost-%COMP%]   .pill[data-call=load][_ngcontent-%COMP%] {
    border-color: #0d9488;
    color: #0f766e;
  }
}
:root[data-theme=light]   [_nghost-%COMP%]   .pill[data-call=load][_ngcontent-%COMP%] {
  border-color: #0d9488;
  color: #0f766e;
}

.pill[data-call=fn][_ngcontent-%COMP%] {
  border-color: #14b8a6;
  color: #99f6e4;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme=dark])   [_nghost-%COMP%]   .pill[data-call=fn][_ngcontent-%COMP%] {
    border-color: #0d9488;
    color: #0f766e;
  }
}
:root[data-theme=light]   [_nghost-%COMP%]   .pill[data-call=fn][_ngcontent-%COMP%] {
  border-color: #0d9488;
  color: #0f766e;
}

.pill[data-call=api][_ngcontent-%COMP%] {
  border-color: #f97316;
  color: #fed7aa;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme=dark])   [_nghost-%COMP%]   .pill[data-call=api][_ngcontent-%COMP%] {
    border-color: #c2410c;
    color: #9a3412;
  }
}
:root[data-theme=light]   [_nghost-%COMP%]   .pill[data-call=api][_ngcontent-%COMP%] {
  border-color: #c2410c;
  color: #9a3412;
}

.pill[data-call=action][_ngcontent-%COMP%] {
  border-color: #ec4899;
  color: #fbcfe8;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme=dark])   [_nghost-%COMP%]   .pill[data-call=action][_ngcontent-%COMP%] {
    border-color: #db2777;
    color: #9d174d;
  }
}
:root[data-theme=light]   [_nghost-%COMP%]   .pill[data-call=action][_ngcontent-%COMP%] {
  border-color: #db2777;
  color: #9d174d;
}

[data-tone=good].pill[_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%ok) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%ok) 12%, transparent);
  color: var(--%NS%ok);
}

[data-tone=warn].pill[_ngcontent-%COMP%], 
[data-tone=warn].chip[_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%warn) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%warn) 12%, transparent);
  color: var(--%NS%warn);
}

[data-tone=bad].pill[_ngcontent-%COMP%], 
[data-tone=bad].chip[_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%danger) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%danger) 12%, transparent);
  color: var(--%NS%danger);
}

[data-tone=info].pill[_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%info) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%info) 12%, transparent);
  color: #bfdbfe;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme=dark])   [_nghost-%COMP%]   [data-tone=info].pill[_ngcontent-%COMP%] {
    color: var(--%NS%info);
  }
}
:root[data-theme=light]   [_nghost-%COMP%]   [data-tone=info].pill[_ngcontent-%COMP%] {
  color: var(--%NS%info);
}

.status[_ngcontent-%COMP%] {
  border: 1px solid var(--%NS%border-strong);
  font-family: var(--%NS%mono);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.status[data-status=good][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%ok) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%ok) 12%, transparent);
  color: var(--%NS%ok);
}

.status[data-status=warn][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%warn) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%warn) 12%, transparent);
  color: var(--%NS%warn);
}

.status[data-status=bad][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%danger) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%danger) 12%, transparent);
  color: var(--%NS%danger);
}

.method[_ngcontent-%COMP%] {
  min-width: 52px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: 6px;
  background: var(--%NS%surface-2);
  color: var(--%NS%text);
  font-family: var(--%NS%mono);
  font-weight: 600;
  text-align: center;
}

.method[data-method=GET][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, #7dd3fc 30%, transparent);
  background: color-mix(in srgb, #7dd3fc 12%, transparent);
  color: #7dd3fc;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme=dark])   [_nghost-%COMP%]   .method[data-method=GET][_ngcontent-%COMP%] {
    border-color: color-mix(in srgb, #0369a1 30%, transparent);
    background: color-mix(in srgb, #0369a1 8%, transparent);
    color: #0369a1;
  }
}
:root[data-theme=light]   [_nghost-%COMP%]   .method[data-method=GET][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, #0369a1 30%, transparent);
  background: color-mix(in srgb, #0369a1 8%, transparent);
  color: #0369a1;
}

.method[data-method=POST][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%ok) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%ok) 12%, transparent);
  color: #86efac;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme=dark])   [_nghost-%COMP%]   .method[data-method=POST][_ngcontent-%COMP%] {
    color: var(--%NS%ok);
  }
}
:root[data-theme=light]   [_nghost-%COMP%]   .method[data-method=POST][_ngcontent-%COMP%] {
  color: var(--%NS%ok);
}

.method[data-method=PUT][_ngcontent-%COMP%], 
.method[data-method=PATCH][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%warn) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%warn) 12%, transparent);
  color: #fde68a;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme=dark])   [_nghost-%COMP%]   .method[data-method=PUT][_ngcontent-%COMP%], 
   :root:not([data-theme=dark])   [_nghost-%COMP%]   .method[data-method=PATCH][_ngcontent-%COMP%] {
    color: var(--%NS%warn);
  }
}
:root[data-theme=light]   [_nghost-%COMP%]   .method[data-method=PUT][_ngcontent-%COMP%], 
:root[data-theme=light]   [_nghost-%COMP%]   .method[data-method=PATCH][_ngcontent-%COMP%] {
  color: var(--%NS%warn);
}

.method[data-method=DELETE][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%danger) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%danger) 12%, transparent);
  color: #fecaca;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme=dark])   [_nghost-%COMP%]   .method[data-method=DELETE][_ngcontent-%COMP%] {
    color: var(--%NS%danger);
  }
}
:root[data-theme=light]   [_nghost-%COMP%]   .method[data-method=DELETE][_ngcontent-%COMP%] {
  color: var(--%NS%danger);
}

.request[_ngcontent-%COMP%] {
  min-width: 260px;
}

.request[_ngcontent-%COMP%]   .url[_ngcontent-%COMP%] {
  color: var(--%NS%text-strong);
  overflow-wrap: anywhere;
}

details[_ngcontent-%COMP%] {
  margin-top: 8px;
}

summary[_ngcontent-%COMP%] {
  width: fit-content;
  border-radius: 6px;
  color: var(--%NS%text-2);
  font-size: 12px;
  cursor: pointer;
  transition: color 160ms var(--%NS%ease);
}

summary[_ngcontent-%COMP%]:hover {
  color: var(--%NS%text);
}

.code[_ngcontent-%COMP%] {
  margin: 8px 0 0;
  padding: 10px 12px;
  max-height: 220px;
  overflow: auto;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%bg);
  color: var(--%NS%text);
  font-family: var(--%NS%mono);
  font-size: 12.5px;
  line-height: 1.55;
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

.calls-bar[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.segmented[_ngcontent-%COMP%] {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 2px;
  justify-self: start;
  margin: 0;
  padding: 3px;
  border: 1px solid var(--%NS%border);
  border-radius: 10px;
  background: var(--%NS%bg);
}

.segmented[_ngcontent-%COMP%]   label[_ngcontent-%COMP%] {
  display: inline-flex;
  gap: 6px;
  align-items: center;
  padding: 5px 12px;
  border-radius: 7px;
  background: transparent;
  color: var(--%NS%text-2);
  font-weight: 500;
  cursor: pointer;
  transition: background-color 180ms var(--%NS%ease), color 180ms var(--%NS%ease), box-shadow 180ms var(--%NS%ease);
}

.segmented[_ngcontent-%COMP%]   label[_ngcontent-%COMP%]:hover {
  color: var(--%NS%text);
}

.segmented[_ngcontent-%COMP%]   label[_ngcontent-%COMP%]   .muted[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.segmented[_ngcontent-%COMP%]   label.on[_ngcontent-%COMP%] {
  background: var(--%NS%surface-3);
  color: var(--%NS%text-strong);
  box-shadow: inset 0 0 0 1px var(--%NS%border-strong);
}

.segmented[_ngcontent-%COMP%]   label.on[_ngcontent-%COMP%]   .muted[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
}

h2[_ngcontent-%COMP%] {
  display: flex;
  gap: 8px;
  align-items: center;
  margin: 8px 0 0;
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.card[_ngcontent-%COMP%] {
  display: grid;
  gap: 12px;
  padding: 16px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  box-shadow: var(--%NS%shadow);
  animation: enter 0.35s var(--%NS%ease) both;
}

.card[_ngcontent-%COMP%]   h2[_ngcontent-%COMP%] {
  margin: 0;
}

.check[_ngcontent-%COMP%] {
  display: flex;
  gap: 8px;
  align-items: center;
  color: var(--%NS%text-2);
  cursor: pointer;
}

.check[_ngcontent-%COMP%]   input[_ngcontent-%COMP%] {
  width: 15px;
  height: 15px;
  margin: 0;
  accent-color: var(--%NS%accent);
}

.check[_ngcontent-%COMP%]   input[_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: 2px;
}

.response[_ngcontent-%COMP%] {
  display: grid;
  gap: 8px;
  padding: 12px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%surface-2);
}

.response[_ngcontent-%COMP%]   .code[_ngcontent-%COMP%] {
  margin: 0;
}

.facts[_ngcontent-%COMP%] {
  display: grid;
  grid-template-columns: max-content 1fr;
  gap: 10px 16px;
  margin: 0;
}

.facts[_ngcontent-%COMP%]   dt[_ngcontent-%COMP%] {
  padding-top: 3px;
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.facts[_ngcontent-%COMP%]   dd[_ngcontent-%COMP%] {
  margin: 0;
}

.findings[_ngcontent-%COMP%] {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
  animation: enter 0.35s var(--%NS%ease) both;
}

.findings[_ngcontent-%COMP%]    > li[_ngcontent-%COMP%] {
  position: relative;
  padding: 16px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  box-shadow: inset 3px 0 0 var(--%NS%info), var(--%NS%shadow);
  transition: border-color 180ms var(--%NS%ease);
}

.findings[_ngcontent-%COMP%]    > li[_ngcontent-%COMP%]:hover {
  border-color: var(--%NS%border-strong);
}

.findings[_ngcontent-%COMP%]    > li[data-tone=bad][_ngcontent-%COMP%] {
  box-shadow: inset 3px 0 0 var(--%NS%danger), var(--%NS%shadow);
}

.findings[_ngcontent-%COMP%]    > li[data-tone=warn][_ngcontent-%COMP%] {
  box-shadow: inset 3px 0 0 var(--%NS%warn), var(--%NS%shadow);
}

.findings[_ngcontent-%COMP%]   p[_ngcontent-%COMP%] {
  margin: 8px 0 0;
  line-height: 1.55;
}

.findings[_ngcontent-%COMP%]    > li[_ngcontent-%COMP%]    > p[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
}

.finding-head[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.finding-title[_ngcontent-%COMP%] {
  color: var(--%NS%text-strong);
  font-size: 14px;
  font-weight: 600;
}

.where[_ngcontent-%COMP%] {
  display: grid;
  gap: 6px;
  margin: 12px 0 0;
  padding: 10px 12px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%surface-2);
  list-style: none;
}

.where[_ngcontent-%COMP%]   li[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
}

.where[_ngcontent-%COMP%]   .detail[_ngcontent-%COMP%] {
  flex-basis: 100%;
  margin: 0;
  color: var(--%NS%text-2);
  overflow-wrap: anywhere;
}

.fix[_ngcontent-%COMP%] {
  margin-top: 12px;
  color: var(--%NS%text);
  line-height: 1.55;
}

.fix[_ngcontent-%COMP%]   strong[_ngcontent-%COMP%] {
  display: block;
  margin-bottom: 4px;
  color: var(--%NS%ok);
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.rule[_ngcontent-%COMP%] {
  display: block;
  margin-top: 12px;
  color: var(--%NS%text-3);
  font-size: 12px;
}

.empty[_ngcontent-%COMP%] {
  display: grid;
  gap: 8px;
  justify-items: center;
  padding: 40px 24px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  text-align: center;
  animation: enter 0.35s var(--%NS%ease) both;
}

.empty[_ngcontent-%COMP%]   p[_ngcontent-%COMP%] {
  margin: 0;
  max-width: 520px;
  line-height: 1.6;
}

.empty-title[_ngcontent-%COMP%] {
  margin: 0;
  color: var(--%NS%text-strong);
  font-size: 15px;
  font-weight: 600;
}`]})},KH=(e,t)=>t.id,qH=(e,t)=>t.side+t.id,JH=(e,t)=>t.key;function YH(e,t){e&1&&(z(0,`div`,0),V(1,`span`,44),z(2,`span`),J(3,`Loading…`),B()())}function XH(e,t){e&1&&(z(0,`div`,1)(1,`strong`),J(2,`Could not reach the devtools server.`),B(),z(3,`span`),J(4,`Check that the app's dev server is running with the devtools plugin, then reopen this panel.`),B()())}function ZH(e,t){e&1&&(z(0,`span`,49),J(1,`transfer cache`),B())}function QH(e,t){if(e&1&&(z(0,`span`,49),J(1),B()),e&2){let e=K().$implicit;M(),X(`delayed `,e.delayMs,` ms`)}}function $H(e,t){e&1&&(z(0,`span`,58),J(1,`mocked`),B())}function eU(e,t){e&1&&(z(0,`span`,59),J(1,`faulted`),B())}function tU(e,t){if(e&1&&(z(0,`span`,60),J(1,`rule `),z(2,`code`),J(3),B()()),e&2){let e=t;R(`title`,`Matched rule: `+e),M(3),Y(e)}}function nU(e,t){if(e&1){let e=W();z(0,`tr`,48),G(`click`,function(){let t=O(e).$implicit;return k(K(2).openCall(t.id))}),z(1,`td`)(2,`span`,49),J(3),B()(),z(4,`td`,50),J(5),B(),z(6,`td`,51)(7,`button`,52),J(8),B()(),z(9,`td`,53),J(10),B(),z(11,`td`,54),V(12,`span`,55),J(13),B(),z(14,`td`,56),J(15),B(),z(16,`td`)(17,`div`,57),P(18,ZH,2,0,`span`,49),P(19,QH,2,1,`span`,49),P(20,$H,2,0,`span`,58),P(21,eU,2,0,`span`,59),P(22,tU,4,2,`span`,60),B()()()}if(e&2){let e,n=t.$implicit,r=K(2);q(`selected`,r.selectedCall()?.id===n.id),M(2),q(`server`,n.side===`server`),M(),Y(n.side===`server`?`SSR`:`Client`),M(2),Y(n.method),M(2),R(`title`,n.url),N(`data-call-id`,n.id)(`aria-pressed`,r.selectedCall()?.id===n.id)(`aria-controls`,r.selectedCall()?`call-preview`:null),M(),X(` `,n.url,` `),M(),R(`title`,n.pageUrl??``),M(),X(` `,n.pageUrl??``,` `),M(),q(`ok`,r.callTone(n)===`ok`)(`redirect`,r.callTone(n)===`redirect`)(`bad`,r.callTone(n)===`bad`),M(2),X(``,r.statusLabel(n),` `),M(2),X(``,n.durationMs,` ms`),M(3),F(n.cacheHit?18:-1),M(),F(n.delayMs?19:-1),M(),F(n.mocked?20:-1),M(),F(n.faulted?21:-1),M(),F((e=r.rulePatternOf(n))?22:-1,e)}}function rU(e,t){if(e&1&&(z(0,`div`,12)(1,`table`)(2,`thead`)(3,`tr`)(4,`th`,45),J(5,`Side`),B(),z(6,`th`,45),J(7,`Method`),B(),z(8,`th`,45),J(9,`URL`),B(),z(10,`th`,45),J(11,`Page`),B(),z(12,`th`,45),J(13,`Status`),B(),z(14,`th`,46),J(15,`Time`),B(),z(16,`th`,45),J(17,`Notes`),B()()(),z(18,`tbody`),I(19,nU,23,26,`tr`,47,qH),B()()()),e&2){let e=K();M(19),L(e.timeline())}}function iU(e,t){e&1&&(z(0,`div`,13)(1,`p`),J(2,`No requests yet.`),B(),z(3,`p`,32),J(4,` Add `),z(5,`code`),J(6,`withPangular()`),B(),J(7,` to `),z(8,`code`),J(9,`provideHttpClient`),B(),J(10,`, then load a page of the app. `),B()())}function aU(e,t){e&1&&(z(0,`p`,67),J(1,` Matched rule `),z(2,`code`),J(3),B()()),e&2&&(M(3),Y(t))}function oU(e,t){if(e&1){let e=W();z(0,`div`,61),G(`keydown.escape`,function(){return O(e),k(K().closePreview())}),z(1,`div`,62)(2,`h3`,63),J(3,`Response preview`),B(),z(4,`button`,64),G(`click`,function(){return O(e),k(K().closePreview())}),J(5,`Close`),B()(),z(6,`p`,65)(7,`span`,50),J(8),B(),z(9,`span`,54),J(10),B(),z(11,`span`,66),J(12),B()(),P(13,aU,4,1,`p`,67),z(14,`pre`),J(15),B()()}if(e&2){let e,n=t,r=K();M(8),Y(n.method),M(),q(`ok`,r.callTone(n)===`ok`)(`redirect`,r.callTone(n)===`redirect`)(`bad`,r.callTone(n)===`bad`),M(),Y(r.statusLabel(n)),M(),R(`title`,n.url),M(),Y(n.url),M(),F((e=r.rulePatternOf(n))?13:-1,e),M(),q(`error`,!!n.error&&!n.cancelled),M(),Y(n.error??n.preview??`(no body)`)}}function sU(e,t){if(e&1&&(z(0,`p`,17),J(1),B()),e&2){let e=K();M(),Y(e.writesOff)}}function cU(e,t){e&1&&(z(0,`p`,32),J(1,` SSR mocks are not transferred to the client: the browser requests the URL again and gets the real response unless the rule also applies on the client. `),B())}function lU(e,t){e&1&&(z(0,`span`),J(1,`passthrough`),B())}function uU(e,t){if(e&1&&(z(0,`span`,54),J(1),B()),e&2){let e=K().$implicit,t=K();q(`ok`,t.statusTone(e.status)===`ok`)(`redirect`,t.statusTone(e.status)===`redirect`)(`bad`,t.statusTone(e.status)===`bad`),M(),Y(e.status)}}function dU(e,t){if(e&1&&(z(0,`span`),J(1),B()),e&2){let e=K().$implicit;M(),X(``,e.delayMs,` ms`)}}function fU(e,t){e&1&&(z(0,`span`),J(1,`mock body`),B())}function pU(e,t){e&1&&(z(0,`p`,75),J(1,` The SSR mock is not written to TransferState, so the browser requests this URL again. `),B())}function mU(e,t){if(e&1){let e=W();z(0,`li`)(1,`label`,68)(2,`input`,69),G(`change`,function(){let t=O(e).$implicit;return k(K().toggleRule(t.id))}),B(),z(3,`code`,70)(4,`span`,71),J(5),B(),J(6),B()(),z(7,`button`,72),G(`click`,function(){let t=O(e).$implicit;return k(K().removeRule(t.id))}),J(8,` Remove `),B(),z(9,`span`,73)(10,`span`),J(11),B(),P(12,lU,2,0,`span`)(13,uU,2,7,`span`,74),P(14,dU,2,1,`span`),P(15,fU,2,0,`span`),B(),P(16,pU,2,0,`p`,75),B()}if(e&2){let e=t.$implicit,n=K();q(`off`,!e.enabled),M(2),R(`checked`,e.enabled)(`disabled`,!n.canWrite()),N(`aria-describedby`,n.canWrite()?null:`http-writes-off`)(`aria-label`,`Enable rule for `+e.pattern),M(),R(`title`,e.pattern),M(2),Y(e.method||`ANY`),M(),X(` `,e.pattern),M(),R(`disabled`,!n.canWrite()),N(`aria-describedby`,n.canWrite()?null:`http-writes-off`)(`aria-label`,`Remove rule for `+e.pattern),M(4),Y(n.targetLabel(e.target)),M(),F(e.status===void 0?12:13),M(2),F(e.delayMs?14:-1),M(),F(e.body?15:-1),M(),F(n.mocksOnServer(e)?16:-1)}}function hU(e,t){e&1&&(z(0,`li`,39),J(1,`No rules. SSR rules apply on the next page load.`),B())}function gU(e,t){if(e&1&&(z(0,`div`)(1,`dt`),J(2,`DOM nodes hydrated`),B(),z(3,`dd`),J(4),B()(),z(5,`div`)(6,`dt`),J(7,`DOM nodes skipped`),B(),z(8,`dd`),J(9),B()(),z(10,`div`)(11,`dt`),J(12,`Mismatched components`),B(),z(13,`dd`),J(14),B()()),e&2){let e=t;M(4),Y(e.hydrated),M(5),Y(e.skipped),M(4),q(`bad`,e.mismatched>0),M(),Y(e.mismatched)}}function _U(e,t){if(e&1&&(z(0,`span`,78)(1,`span`,79),J(2,`Expected`),B(),z(3,`code`),J(4),B()()),e&2){let e=K().$implicit;M(4),Y(e.expected)}}function vU(e,t){if(e&1&&(z(0,`span`,78)(1,`span`,79),J(2,`Actual`),B(),z(3,`code`),J(4),B()()),e&2){let e=K().$implicit;M(4),Y(e.actual)}}function yU(e,t){if(e&1&&(z(0,`li`)(1,`code`),J(2),B(),P(3,_U,5,1,`span`,78),P(4,vU,5,1,`span`,78),B()),e&2){let e=t.$implicit;M(2),Y(`<`+e.component+`>`),M(),F(e.expected?3:-1),M(),F(e.actual?4:-1)}}function bU(e,t){if(e&1&&(z(0,`h3`),J(1),B(),z(2,`ul`,77),I(3,yU,5,3,`li`,null,Cg),B()),e&2){let e=K();M(),X(`Mismatches (`,e.mismatches.length,`)`),M(2),L(e.mismatches)}}function xU(e,t){if(e&1&&(z(0,`li`)(1,`code`),J(2),B()()),e&2){let e=t.$implicit;M(2),Y(e)}}function SU(e,t){if(e&1&&(z(0,`h3`),J(1,`ngSkipHydration hosts`),B(),z(2,`ul`,80),I(3,xU,3,1,`li`,null,Cg),B()),e&2){let e=K();M(3),L(e.skipHydrationHosts)}}function CU(e,t){e&1&&(z(0,`h3`),J(1,`Warnings`),B(),z(2,`p`,32),J(3,` Not captured: add `),z(4,`code`),J(5,`providePangularHttp()`),B(),J(6,` to the app providers. `),B())}function wU(e,t){if(e&1&&(z(0,`pre`,81),J(1),B()),e&2){let e=t.$implicit;M(),Y(e)}}function TU(e,t){e&1&&(z(0,`p`,82),J(1,`No hydration warnings.`),B())}function EU(e,t){if(e&1&&(z(0,`h3`),J(1),B(),I(2,wU,2,1,`pre`,81,Cg,!1,TU,2,0,`p`,82)),e&2){let e=K();M(),X(`Warnings (`,e.warnings.length,`)`),M(),L(e.warnings)}}function DU(e,t){if(e&1&&(z(0,`dl`,76)(1,`div`)(2,`dt`),J(3,`Enabled`),B(),z(4,`dd`)(5,`span`,49),J(6),B()()(),z(7,`div`)(8,`dt`),J(9,`Hydrated components`),B(),z(10,`dd`),J(11),B()(),z(12,`div`)(13,`dt`),J(14,`Hydrated nodes`),B(),z(15,`dd`),J(16),B()(),z(17,`div`)(18,`dt`),J(19,`Skipped components`),B(),z(20,`dd`),J(21),B()(),z(22,`div`)(23,`dt`),J(24,`Incremental defer blocks`),B(),z(25,`dd`),J(26),B()(),P(27,gU,15,5),B(),P(28,bU,5,1),P(29,SU,5,0),P(30,CU,7,0)(31,EU,5,2)),e&2){let e,n=t;M(5),q(`on`,n.enabled)(`off-tag`,!n.enabled),M(),Y(n.enabled?`yes`:`no (client render only)`),M(5),Y(n.hydratedComponents??`n/a`),M(5),Y(n.hydratedNodes??`n/a`),M(5),Y(n.componentsSkippedHydration??`n/a`),M(5),Y(n.deferBlocksWithIncrementalHydration??`n/a`),M(),F((e=n.nodes)?27:-1,e),M(),F(n.mismatches?.length?28:-1),M(),F(n.skipHydrationHosts.length?29:-1),M(),F(n.warningsCaptured===!1?30:31)}}function OU(e,t){e&1&&(z(0,`div`,13)(1,`p`),J(2,`No hydration data for this page.`),B(),z(3,`p`,32),J(4,`Open a server rendered page of the app to see its stats.`),B()())}function kU(e,t){e&1&&(z(0,`div`,13)(1,`p`),J(2,`No TransferState script: this page was not server rendered.`),B()())}function AU(e,t){if(e&1&&(z(0,`p`,84),J(1),B()),e&2){let e=K(2);M(),Y(e.error)}}function jU(e,t){e&1&&(z(0,`span`,49),J(1),B()),e&2&&(M(),Y(t))}function MU(e,t){if(e&1&&(z(0,`span`,49),J(1),B(),z(2,`span`,87),J(3),B()),e&2){let e=t,n=K().$implicit,r=K(3);q(`server`,r.statusTone(e.status)===`ok`)(`fault`,r.statusTone(e.status)===`bad`),M(),X(`HTTP `,e.status),M(2),Y(e.url??n.key)}}function NU(e,t){if(e&1&&(z(0,`span`,87),J(1),B()),e&2){let e=K().$implicit;M(),Y(e.key)}}function PU(e,t){if(e&1&&(z(0,`details`)(1,`summary`),V(2,`span`,86),P(3,jU,2,1,`span`,49),P(4,MU,4,6)(5,NU,2,1,`span`,87),z(6,`span`,88),J(7),B()(),z(8,`pre`),J(9),dv(10,`json`),B()()),e&2){let e,n,r=t.$implicit,i=K(3);M(3),F((e=i.payloadLabel(r))?3:-1,e),M(),F((n=r.http)?4:5,n),M(3),X(``,r.size,` B`),M(2),Y(pv(10,4,r.value))}}function FU(e,t){if(e&1&&(z(0,`p`,83),J(1),B(),P(2,AU,2,1,`p`,84),z(3,`div`,85),I(4,PU,11,6,`details`,null,JH),B()),e&2){let e=K();M(),Y_(` `,e.entries.length,` entr`,e.entries.length===1?`y`:`ies`,`, `,e.size,` bytes `),M(),F(e.error?2:-1),M(2),L(e.entries)}}function IU(e,t){e&1&&P(0,kU,3,0,`div`,13)(1,FU,6,4),e&2&&F(+!!t.found)}function LU(e,t){e&1&&(z(0,`div`,13)(1,`p`),J(2,`Open a page of the app to see its payload.`),B()())}var RU={pattern:``,method:``,target:`both`,status:``,delayMs:``,body:``},zU=50,BU=500,VU=1e5,HU=[{value:``,label:`None`},...NT.map(([e,t])=>({value:String(e),label:`${e} ${t}`}))],UU=class e{rpc=$(null);canWrite=Q(()=>cE(this.rpc(),`http`));writesOff=GT(`http`);loading=j(!1);failed=j(!1);serverCalls=j([]);pages=j([]);payloads=j({});serverDropped=j(0);rules=j([]);hostPageId=$T();selectedPageId=Tv({source:()=>this.pages(),computation:(e,t)=>t?.value&&e.some(e=>e.pageId===t.value)?t.value:e.find(e=>e.pageId===this.hostPageId)?.pageId??e[0]?.pageId??null});selectedCallId=j(null);draft=j({...RU});message=j(``);bodyPlaceholder=`{ "error": "Service unavailable" }`;statusOptions=HU;unsubscribe=[];destroyRef=E(Cs);injector=E(xs);host=E(Ml);selected=Q(()=>this.pages().find(e=>e.pageId===this.selectedPageId())??null);selectedPayload=Q(()=>{let e=this.selectedPageId();return e?this.payloads()[e]??null:null});maxCalls=Q(()=>sE(this.rpc()).limits.httpCalls);droppedCalls=Q(()=>(this.selected()?.dropped??0)+this.serverDropped());pageServerCalls=Q(()=>{let e=this.selected()?.initialUrl;return e?this.serverCalls().filter(t=>!t.pageUrl||t.pageUrl===e):this.serverCalls()});timeline=Q(()=>[...this.pageServerCalls(),...this.selected()?.calls??[]].sort((e,t)=>t.at-e.at));selectedCall=Q(()=>this.timeline().find(e=>e.id===this.selectedCallId())??null);draftMocksOnServer=Q(()=>{let e=this.draftRule();return!!e&&this.mocksOnServer(e)});draftRule=Q(()=>{let e=this.draft(),t=e.pattern.trim();if(!t||t.length>BU||this.bodyError()||this.rules().length>=zU)return null;let n=e.body.trim(),r=Math.min(Math.max(Math.round(Number(e.delayMs))||0,0),1e4),i=e.status.trim()?Number(e.status):n?200:void 0;return i!==void 0&&!PT(i)||i===void 0&&!r?null:{pattern:t,enabled:!0,target:e.target,...e.method?{method:e.method}:{},...i===void 0?{}:{status:i},...r?{delayMs:r}:{},...n?{body:n}:{}}});draftHint=Q(()=>{let e=this.draft();return this.rules().length>=zU?`You can add up to ${zU} rules. Remove one to add another.`:e.pattern.trim()?e.pattern.trim().length>BU?`The URL pattern is limited to ${BU} characters.`:this.bodyError()?``:e.status.trim()&&!PT(Number(e.status))?`Pick a status from the list.`:this.draftRule()?!e.status.trim()&&e.body.trim()?`With no status, the mock body returns 200.`:``:`Set a status, a delay or a mock body.`:`Enter a URL pattern to add a rule.`});bodyError=Q(()=>{let e=this.draft().body.trim();if(!e)return``;if(e.length>VU)return`The mock body is limited to ${VU} characters.`;try{return JSON.parse(e),``}catch{return`The mock body must be valid JSON.`}});constructor(){uc(()=>{let e=this.rpc();e&&this.load(e)}),this.destroyRef.onDestroy(()=>this.stopListening())}async load(e){this.loading.set(!0),this.failed.set(!1);try{let t=e.scope(`pangular`).rpc,[n,r]=await Promise.all([t.sharedState(`http`),t.sharedState(`http-payloads`)]);if(this.destroyRef.destroyed)return;let i=e=>{let t=e;this.serverCalls.set(t?.serverCalls??[]),this.serverDropped.set(t?.serverDropped??0),this.pages.set(t?.pages??[]),this.rules.set(t?.rules??[])},a=e=>this.payloads.set(e?.pages??{});i(n.value()),a(r.value()),this.stopListening(),this.unsubscribe=[n.on(`updated`,i),r.on(`updated`,a)]}catch{this.failed.set(!0)}finally{this.loading.set(!1)}}statusLabel(e){return e.cancelled?`cancelled`:e.status?String(e.status):`ERR`}callTone(e){return e.cancelled?`neutral`:this.statusTone(e.status)}rulePatternOf(e){return e.rulePattern?e.rulePattern:e.ruleId?this.rules().find(t=>t.id===e.ruleId)?.pattern??null:null}openCall(e){this.selectedCallId.set(e),Id(()=>this.host.nativeElement.querySelector(`#preview-heading`)?.focus(),{injector:this.injector})}closePreview(){let e=this.selectedCallId();this.selectedCallId.set(null),e&&[...this.host.nativeElement.querySelectorAll(`button[data-call-id]`)].find(t=>t.dataset.callId===e)?.focus()}stopListening(){for(let e of this.unsubscribe.splice(0))e()}statusTone(e){return e===void 0?`neutral`:e===0||e>=400?`bad`:e>=300?`redirect`:e>=200?`ok`:`neutral`}mocksOnServer(e){return e.target!==`client`&&e.status!==void 0&&e.status<400}payloadLabel(e){return e.source===`hydration`?`hydration annotations`:e.fn?`Analog server function ${e.fn.name??e.fn.id}`:e.source===`analog`?`Analog`:null}targetLabel(e){return e===`both`?`SSR + client`:e===`server`?`SSR only`:`Client only`}pageOptions=Q(()=>this.pages().map(e=>({value:e.pageId,label:e.title||e.url})));methodOptions=[{value:``,label:`Any`},...[`GET`,`POST`,`PUT`,`PATCH`,`DELETE`].map(e=>({value:e,label:e}))];targetOptions=[{value:`both`,label:`SSR + client`},{value:`server`,label:`SSR only`},{value:`client`,label:`Client only`}];selectPage(e){e&&this.selectedPageId.set(e),this.selectedCallId.set(null)}setDraft(e,t){this.draft.update(n=>({...n,[e]:t}))}patch(e,t){let n=t.target.value;this.draft.update(t=>({...t,[e]:n}))}async addRule(e){e.preventDefault();let t=this.draftRule();if(!t)return;let n={id:`r${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`,...t};await this.saveRules([...this.rules(),n],`Rule added.`,n)&&(this.draft.set({...RU}),this.host.nativeElement.querySelector(`#rule-pattern`)?.focus())}toggleRule(e){let t=this.rules().find(t=>t.id===e);t&&this.saveRules(this.rules().map(t=>t.id===e?{...t,enabled:!t.enabled}:t),`Rule updated.`,t)}removeRule(e){let t=this.rules().find(t=>t.id===e);t&&this.saveRules(this.rules().filter(t=>t.id!==e),`Rule removed.`,t)}async clearCalls(){try{await rE(this.rpc(),`clear-http-calls`),this.selectedCallId.set(null),this.message.set(`Timeline cleared.`)}catch{this.message.set(`Could not clear the timeline.`)}}async saveRules(e,t,n){try{let r=await rE(this.rpc(),`set-http-rules`,e);return this.rules.set(Array.isArray(r)?r:e),this.message.set(n.target===`client`?t:`${t} Reload the page to apply it to SSR.`),!0}catch{return this.message.set(`Could not save the rules.`),!1}}static ɵfac=function(t){return new(t||e)};static ɵcmp=Bh({type:e,selectors:[[`app-network-inspector`]],inputs:{rpc:[1,`rpc`]},decls:77,vars:32,consts:[[`role`,`status`,1,`state`],[`role`,`alert`,1,`state`,`error`],[1,`toolbar`],[1,`page-picker`],[`id`,`page-picker-label`],[`labelledBy`,`page-picker-label`,`emptyText`,`No connected page`,`placeholder`,`No connected page`,3,`valueChange`,`options`,`value`],[`type`,`button`,3,`click`,`disabled`],[`role`,`status`,1,`message`],[1,`grid`],[`aria-labelledby`,`timeline-heading`,1,`panel`,`wide`],[`id`,`timeline-heading`],[`what`,`HTTP calls`,`limit`,`httpCalls`,3,`dropped`,`max`],[1,`table-wrap`],[1,`empty`],[`id`,`call-preview`,`role`,`region`,`aria-labelledby`,`preview-heading`,1,`preview`],[`aria-labelledby`,`rules-heading`,1,`panel`],[`id`,`rules-heading`],[`id`,`http-writes-off`,1,`muted`,`small`],[1,`rule-form`,3,`submit`],[1,`hint`],[`id`,`rule-pattern`,`required`,``,`spellcheck`,`false`,`autocomplete`,`off`,`placeholder`,`e.g. /api/products`,3,`input`,`value`],[1,`row`],[1,`field-group`],[`id`,`rule-method-label`],[`labelledBy`,`rule-method-label`,3,`valueChange`,`options`,`value`],[`id`,`rule-target-label`],[`labelledBy`,`rule-target-label`,3,`valueChange`,`options`,`value`],[`id`,`rule-status-label`],[`labelledBy`,`rule-status-label`,3,`valueChange`,`options`,`value`],[`type`,`number`,`inputmode`,`numeric`,`min`,`0`,`max`,`10000`,`placeholder`,`0`,3,`input`,`value`],[`rows`,`3`,`spellcheck`,`false`,`aria-describedby`,`body-error`,3,`input`,`placeholder`,`value`],[`id`,`body-error`,1,`field-error`],[1,`muted`,`small`],[`id`,`rule-hint`,1,`muted`,`small`],[1,`form-actions`],[`type`,`submit`,3,`disabled`],[1,`rules-heading`],[1,`rules`],[3,`off`],[1,`empty-rule`],[`aria-labelledby`,`hydration-heading`,1,`panel`],[`id`,`hydration-heading`],[`aria-labelledby`,`payload-heading`,1,`panel`,`wide`],[`id`,`payload-heading`],[`aria-hidden`,`true`,1,`spinner`],[`scope`,`col`],[`scope`,`col`,1,`num`],[3,`selected`],[3,`click`],[1,`tag`],[1,`method`],[1,`url`],[`type`,`button`,1,`link`,3,`title`],[1,`page-url`,3,`title`],[1,`status`],[`aria-hidden`,`true`,1,`dot`],[1,`num`],[1,`notes`],[1,`tag`,`mock`],[1,`tag`,`fault`],[1,`tag`,`rule-ref`,3,`title`],[`id`,`call-preview`,`role`,`region`,`aria-labelledby`,`preview-heading`,1,`preview`,3,`keydown.escape`],[1,`preview-head`],[`id`,`preview-heading`,`tabindex`,`-1`],[`type`,`button`,1,`ghost`,3,`click`],[1,`preview-meta`],[1,`preview-url`,3,`title`],[1,`preview-rule`],[1,`inline`],[`type`,`checkbox`,3,`change`,`checked`,`disabled`],[1,`rule-pattern`,3,`title`],[1,`rule-method`],[`type`,`button`,1,`link`,`remove`,3,`click`,`disabled`],[1,`rule-meta`],[1,`status`,3,`ok`,`redirect`,`bad`],[1,`rule-note`],[1,`stats`],[1,`plain`,`mismatches`],[1,`mismatch-row`],[1,`mismatch-label`],[1,`plain`],[1,`warn`],[1,`muted`,`small`,`ok-note`],[1,`muted`,`small`,`summary-line`],[`role`,`alert`,1,`bad`],[1,`entries`],[`aria-hidden`,`true`,1,`chevron`],[1,`entry-key`],[1,`entry-size`]],template:function(e,t){if(e&1&&(P(0,YH,4,0,`div`,0)(1,XH,5,0,`div`,1),z(2,`div`,2)(3,`div`,3)(4,`span`,4),J(5,`Page`),B(),z(6,`app-select`,5),G(`valueChange`,function(e){return t.selectPage(e)}),B()(),z(7,`button`,6),G(`click`,function(){return t.clearCalls()}),J(8,` Clear timeline `),B(),z(9,`p`,7),J(10),B()(),z(11,`div`,8)(12,`section`,9)(13,`h2`,10),J(14),B(),V(15,`app-limit-note`,11),P(16,rU,21,0,`div`,12)(17,iU,11,0,`div`,13),P(18,oU,16,14,`div`,14),B(),z(19,`section`,15)(20,`h2`,16),J(21,`Fault injection`),B(),P(22,sU,2,1,`p`,17),z(23,`form`,18),G(`submit`,function(e){return t.addRule(e)}),z(24,`label`)(25,`span`),J(26,`URL pattern `),z(27,`span`,19),J(28,`(substring or * glob)`),B()(),z(29,`input`,20),G(`input`,function(e){return t.patch(`pattern`,e)}),B()(),z(30,`div`,21)(31,`div`,22)(32,`span`,23),J(33,`Method`),B(),z(34,`app-select`,24),G(`valueChange`,function(e){return t.setDraft(`method`,e??``)}),B()(),z(35,`div`,22)(36,`span`,25),J(37,`Apply on`),B(),z(38,`app-select`,26),G(`valueChange`,function(e){return t.setDraft(`target`,e??`both`)}),B()()(),z(39,`div`,21)(40,`div`,22)(41,`span`,27),J(42,`Status`),B(),z(43,`app-select`,28),G(`valueChange`,function(e){return t.setDraft(`status`,e??``)}),B()(),z(44,`label`),J(45,` Delay (ms) `),z(46,`input`,29),G(`input`,function(e){return t.patch(`delayMs`,e)}),B()()(),z(47,`label`)(48,`span`),J(49,`Mock JSON body `),z(50,`span`,19),J(51,`(optional)`),B()(),z(52,`textarea`,30),G(`input`,function(e){return t.patch(`body`,e)}),B()(),z(53,`p`,31),J(54),B(),P(55,cU,2,0,`p`,32),z(56,`p`,33),J(57),B(),z(58,`div`,34)(59,`button`,35),J(60,` Add rule `),B()()(),z(61,`h3`,36),J(62),B(),z(63,`ul`,37),I(64,mU,17,17,`li`,38,KH,!1,hU,2,0,`li`,39),B()(),z(67,`section`,40)(68,`h2`,41),J(69,`Hydration`),B(),P(70,DU,32,13)(71,OU,5,0,`div`,13),B(),z(72,`section`,42)(73,`h2`,43),J(74,`TransferState payload`),B(),P(75,IU,2,1)(76,LU,3,0,`div`,13),B()()),e&2){let e,n,r;F(t.loading()?0:t.failed()?1:-1),M(6),R(`options`,t.pageOptions())(`value`,t.selected()?.pageId??null),M(),R(`disabled`,!t.canWrite()),N(`aria-describedby`,t.canWrite()?null:`http-writes-off`),M(3),Y(t.message()),M(4),X(`HTTP timeline (`,t.timeline().length,`)`),M(),R(`dropped`,t.droppedCalls())(`max`,t.maxCalls()),M(),F(t.timeline().length?16:17),M(2),F((e=t.selectedCall())?18:-1,e),M(4),F(t.canWrite()?-1:22),M(7),R(`value`,t.draft().pattern),M(5),R(`options`,t.methodOptions)(`value`,t.draft().method),M(4),R(`options`,t.targetOptions)(`value`,t.draft().target),M(5),R(`options`,t.statusOptions)(`value`,t.draft().status),M(3),R(`value`,t.draft().delayMs),M(6),R(`placeholder`,t.bodyPlaceholder)(`value`,t.draft().body),N(`aria-invalid`,t.bodyError()?`true`:null),M(2),Y(t.bodyError()),M(),F(t.draftMocksOnServer()?55:-1),M(2),Y(t.draftHint()),M(2),R(`disabled`,!t.canWrite()||!t.draftRule()),N(`aria-describedby`,t.canWrite()?`rule-hint`:`http-writes-off`),M(3),X(`Rules (`,t.rules().length,`)`),M(2),L(t.rules()),M(6),F((n=t.selected()?.hydration)?70:71,n),M(5),F((r=t.selectedPayload())?75:76,r)}},dependencies:[TD,mD,ab],styles:[`@charset "UTF-8";
[_nghost-%COMP%] {
  display: block;
  color: var(--%NS%text);
  font-size: 13px;
}

.state[_ngcontent-%COMP%] {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0 0 16px;
  padding: 10px 12px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%surface);
  color: var(--%NS%text-2);
}

.state.error[_ngcontent-%COMP%] {
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  border-color: color-mix(in srgb, var(--%NS%danger) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%danger) 12%, transparent);
  color: var(--%NS%danger);
}

.state.error[_ngcontent-%COMP%]   strong[_ngcontent-%COMP%] {
  font-weight: 600;
}

.state.error[_ngcontent-%COMP%]   span[_ngcontent-%COMP%] {
  color: var(--%NS%text);
}

.spinner[_ngcontent-%COMP%] {
  width: 14px;
  height: 14px;
  border: 2px solid var(--%NS%border-strong);
  border-top-color: var(--%NS%accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

.toolbar[_ngcontent-%COMP%] {
  position: sticky;
  top: 0;
  z-index: 2;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin: 0 0 16px;
  padding: 8px 12px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: color-mix(in srgb, var(--%NS%surface) 85%, transparent);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
}

.toolbar[_ngcontent-%COMP%]   .page-picker[_ngcontent-%COMP%] {
  display: flex;
  flex: 0 1 auto;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.page-picker[_ngcontent-%COMP%]    > span[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.toolbar[_ngcontent-%COMP%]   app-select[_ngcontent-%COMP%] {
  width: 280px;
  max-width: 420px;
}

.field-group[_ngcontent-%COMP%] {
  display: grid;
  gap: 6px;
  min-width: 0;
  color: var(--%NS%text-2);
  font-size: 12px;
  font-weight: 500;
}

.field-group[_ngcontent-%COMP%]   app-select[_ngcontent-%COMP%] {
  width: 100%;
}

.message[_ngcontent-%COMP%] {
  flex: 1 1 200px;
  min-width: 0;
  margin: 0;
  color: var(--%NS%text-2);
  font-size: 12px;
  text-align: right;
}

.message[_ngcontent-%COMP%]:empty {
  display: none;
}

.grid[_ngcontent-%COMP%] {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.panel[_ngcontent-%COMP%] {
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  animation: enter 0.35s var(--%NS%ease) both;
  min-width: 0;
  padding: 16px;
}

.wide[_ngcontent-%COMP%] {
  grid-column: 1/-1;
}

h2[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin: 0 0 16px;
}

h3[_ngcontent-%COMP%] {
  margin: 16px 0 8px;
  color: var(--%NS%text-strong);
  font-size: 12px;
  font-weight: 600;
}

p[_ngcontent-%COMP%] {
  margin: 0;
}

label[_ngcontent-%COMP%] {
  display: grid;
  gap: 6px;
  color: var(--%NS%text-2);
  font-size: 12px;
  font-weight: 500;
}

label.inline[_ngcontent-%COMP%] {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
  color: var(--%NS%text);
  cursor: pointer;
}

.hint[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-weight: 400;
}

input[_ngcontent-%COMP%], 
select[_ngcontent-%COMP%], 
textarea[_ngcontent-%COMP%], 
button[_ngcontent-%COMP%] {
  font: inherit;
  color: var(--%NS%text);
}

input[_ngcontent-%COMP%]:not([type=checkbox]), 
select[_ngcontent-%COMP%], 
textarea[_ngcontent-%COMP%] {
  width: 100%;
  min-width: 0;
  padding: 0 10px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  background-color: var(--%NS%bg);
  transition: border-color 0.2s var(--%NS%ease), box-shadow 0.2s var(--%NS%ease);
}

input[_ngcontent-%COMP%]:not([type=checkbox]), 
select[_ngcontent-%COMP%] {
  height: 34px;
}

select[_ngcontent-%COMP%] {
  padding-right: 36px;
}

textarea[_ngcontent-%COMP%] {
  padding: 8px 10px;
  font-family: var(--%NS%font-mono);
  font-size: 12px;
}

input[_ngcontent-%COMP%]::placeholder, 
textarea[_ngcontent-%COMP%]::placeholder {
  color: var(--%NS%text-3);
}

input[_ngcontent-%COMP%]:not([type=checkbox]):hover, 
select[_ngcontent-%COMP%]:hover, 
textarea[_ngcontent-%COMP%]:hover {
  border-color: color-mix(in srgb, var(--%NS%border-strong) 60%, var(--%NS%text-3));
}

input[_ngcontent-%COMP%]:not([type=checkbox]):focus-visible, 
select[_ngcontent-%COMP%]:focus-visible, 
textarea[_ngcontent-%COMP%]:focus-visible {
  outline: none;
  border-color: var(--%NS%accent);
  box-shadow: 0 0 0 3px var(--%NS%accent-soft);
}

textarea[aria-invalid=true][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%danger) 60%, transparent);
}

input[type=checkbox][_ngcontent-%COMP%] {
  flex: none;
  width: 16px;
  height: 16px;
  margin: 0;
  accent-color: var(--%NS%accent);
  cursor: pointer;
}

button[_ngcontent-%COMP%] {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  height: 34px;
  padding: 0 14px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%surface-2);
  font-weight: 500;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 0.2s var(--%NS%ease), border-color 0.2s var(--%NS%ease), color 0.2s var(--%NS%ease), transform 0.1s var(--%NS%ease);
}

button[_ngcontent-%COMP%]:hover:not(:disabled) {
  border-color: var(--%NS%accent-line);
  background: var(--%NS%surface-3);
}

button[_ngcontent-%COMP%]:active:not(:disabled) {
  transform: translateY(1px);
}

button[type=submit][_ngcontent-%COMP%] {
  border-color: var(--%NS%accent);
  background: var(--%NS%accent);
  color: var(--%NS%accent-ink);
  font-weight: 600;
}

button[type=submit][_ngcontent-%COMP%]:hover:not(:disabled) {
  border-color: var(--%NS%accent-hover);
  background: var(--%NS%accent-hover);
}

button[_ngcontent-%COMP%]:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

button.ghost[_ngcontent-%COMP%] {
  height: 28px;
  padding: 0 10px;
  border-color: transparent;
  background: none;
  color: var(--%NS%text-2);
  font-size: 12px;
}

button.ghost[_ngcontent-%COMP%]:hover:not(:disabled) {
  border-color: var(--%NS%border-strong);
  background: var(--%NS%surface-2);
  color: var(--%NS%text);
}

button.link[_ngcontent-%COMP%] {
  display: inline;
  height: auto;
  padding: 0;
  border: none;
  border-radius: 4px;
  background: none;
  color: var(--%NS%text);
  text-align: left;
}

button.link[_ngcontent-%COMP%]:hover:not(:disabled) {
  border: none;
  background: none;
  color: var(--%NS%accent);
}

button.link[_ngcontent-%COMP%]:active:not(:disabled) {
  transform: none;
}

[_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: 2px;
}

.muted[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
}

.small[_ngcontent-%COMP%] {
  font-size: 12px;
}

.bad[_ngcontent-%COMP%] {
  color: var(--%NS%danger);
}

.empty[_ngcontent-%COMP%] {
  display: grid;
  gap: 4px;
  padding: 24px 16px;
  border: 1px dashed var(--%NS%border-strong);
  border-radius: var(--%NS%radius-sm);
  color: var(--%NS%text);
  text-align: center;
  line-height: 1.5;
}

.table-wrap[_ngcontent-%COMP%] {
  max-height: min(420px, 60vh);
  overflow: auto;
  margin: 0 -16px;
  padding: 0 16px;
}

.table-wrap[_ngcontent-%COMP%]   [_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: -2px;
}

thead[_ngcontent-%COMP%]   th[_ngcontent-%COMP%] {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--%NS%surface);
}

table[_ngcontent-%COMP%] {
  width: 100%;
  min-width: 560px;
  border-collapse: collapse;
  font-variant-numeric: tabular-nums;
}

th[_ngcontent-%COMP%], 
td[_ngcontent-%COMP%] {
  height: 36px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--%NS%border);
  text-align: left;
  vertical-align: middle;
  white-space: nowrap;
}

th[_ngcontent-%COMP%]:first-child, 
td[_ngcontent-%COMP%]:first-child {
  padding-left: 8px;
}

th[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  height: 32px;
  border-bottom-color: var(--%NS%border-strong);
}

.num[_ngcontent-%COMP%] {
  text-align: right;
}

td.num[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
}

tbody[_ngcontent-%COMP%]   tr[_ngcontent-%COMP%] {
  cursor: pointer;
}

tbody[_ngcontent-%COMP%]   td[_ngcontent-%COMP%] {
  transition: background-color 0.15s var(--%NS%ease);
}

tbody[_ngcontent-%COMP%]   tr[_ngcontent-%COMP%]:hover   td[_ngcontent-%COMP%] {
  background: var(--%NS%surface-2);
}

tr.selected[_ngcontent-%COMP%]   td[_ngcontent-%COMP%], 
tr.selected[_ngcontent-%COMP%]:hover   td[_ngcontent-%COMP%] {
  background: var(--%NS%accent-soft);
}

tr.selected[_ngcontent-%COMP%]   td[_ngcontent-%COMP%]:first-child {
  box-shadow: inset 2px 0 0 var(--%NS%accent);
}

.method[_ngcontent-%COMP%] {
  font-family: var(--%NS%font-mono);
  font-size: 12px;
  font-weight: 600;
  color: var(--%NS%text-strong);
}

td.url[_ngcontent-%COMP%] {
  width: 100%;
  max-width: 0;
  font-family: var(--%NS%font-mono);
  font-size: 12px;
}

td.url[_ngcontent-%COMP%]   button.link[_ngcontent-%COMP%] {
  display: block;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

tr.selected[_ngcontent-%COMP%]   td.url[_ngcontent-%COMP%]   button.link[_ngcontent-%COMP%] {
  color: var(--%NS%text-strong);
}

td.page-url[_ngcontent-%COMP%] {
  max-width: 160px;
  overflow: hidden;
  color: var(--%NS%text-2);
  font-family: var(--%NS%font-mono);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rule-note[_ngcontent-%COMP%] {
  grid-column: 1/-1;
  margin: 0;
  padding-left: 24px;
  color: var(--%NS%text-2);
  font-size: 12px;
}

.mismatches[_ngcontent-%COMP%]   li[_ngcontent-%COMP%] {
  display: grid;
  gap: 4px;
  padding: 8px 12px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%surface-2);
}

.mismatch-row[_ngcontent-%COMP%] {
  display: flex;
  gap: 8px;
  min-width: 0;
  font-size: 12px;
}

.mismatch-row[_ngcontent-%COMP%]   code[_ngcontent-%COMP%] {
  min-width: 0;
  overflow-wrap: anywhere;
}

.mismatch-label[_ngcontent-%COMP%] {
  flex: none;
  width: 64px;
  color: var(--%NS%text-2);
}

.status[_ngcontent-%COMP%] {
  font-family: var(--%NS%font-mono);
  font-size: 12px;
  font-weight: 600;
  color: var(--%NS%text-2);
}

.status.ok[_ngcontent-%COMP%] {
  color: var(--%NS%ok);
}

.status.bad[_ngcontent-%COMP%] {
  color: var(--%NS%danger);
}

.dot[_ngcontent-%COMP%] {
  display: inline-block;
  width: 6px;
  height: 6px;
  margin-right: 6px;
  border-radius: 50%;
  background: currentColor;
  vertical-align: middle;
}

.notes[_ngcontent-%COMP%] {
  display: flex;
  gap: 4px;
}

.tag[_ngcontent-%COMP%] {
  display: inline-flex;
  align-items: center;
  height: 20px;
  padding: 0 8px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: 99px;
  background: var(--%NS%surface-3);
  color: var(--%NS%text-2);
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.tag.server[_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%accent) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%accent) 12%, transparent);
  color: var(--%NS%accent);
}

.tag.fault[_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%danger) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%danger) 12%, transparent);
  color: var(--%NS%danger);
}

.tag.mock[_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%accent) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%accent) 12%, transparent);
  color: var(--%NS%accent);
}

.tag.rule-ref[_ngcontent-%COMP%] {
  gap: 4px;
  max-width: 220px;
}

.tag.rule-ref[_ngcontent-%COMP%]   code[_ngcontent-%COMP%] {
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-family: var(--%NS%font-mono);
}

.tag.on[_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%ok) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%ok) 12%, transparent);
  color: var(--%NS%ok);
}

.tag.off-tag[_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%warn) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%warn) 12%, transparent);
  color: var(--%NS%warn);
}

pre[_ngcontent-%COMP%] {
  margin: 0;
  padding: 10px 12px;
  max-height: 240px;
  overflow: auto;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%bg);
  color: var(--%NS%text-2);
  font: 12px/1.5 var(--%NS%font-mono);
  white-space: pre-wrap;
  overflow-wrap: anywhere;
}

pre[_ngcontent-%COMP%]    + pre[_ngcontent-%COMP%] {
  margin-top: 8px;
}

pre.warn[_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%warn) 30%, transparent);
  color: var(--%NS%warn);
}

pre.error[_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%danger) 30%, transparent);
  color: var(--%NS%danger);
}

.preview[_ngcontent-%COMP%] {
  animation: enter 0.2s var(--%NS%ease) both;
  margin-top: 16px;
}

.preview-head[_ngcontent-%COMP%] {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 4px;
}

.preview-head[_ngcontent-%COMP%]   h3[_ngcontent-%COMP%] {
  margin: 0;
}

.preview-meta[_ngcontent-%COMP%] {
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  margin-bottom: 8px;
}

.preview-rule[_ngcontent-%COMP%] {
  margin-bottom: 8px;
  color: var(--%NS%text-2);
  font-size: 12px;
}

.preview-url[_ngcontent-%COMP%] {
  min-width: 0;
  overflow: hidden;
  color: var(--%NS%text-2);
  font-family: var(--%NS%font-mono);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rule-form[_ngcontent-%COMP%] {
  display: grid;
  gap: 12px;
}

.row[_ngcontent-%COMP%] {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

@media (max-width: 420px) {
  .row[_ngcontent-%COMP%] {
    grid-template-columns: minmax(0, 1fr);
  }
}
.field-error[_ngcontent-%COMP%] {
  margin-top: -4px;
  color: var(--%NS%danger);
  font-size: 12px;
}

.field-error[_ngcontent-%COMP%]:empty {
  display: none;
}

.form-actions[_ngcontent-%COMP%] {
  display: flex;
}

.rules-heading[_ngcontent-%COMP%] {
  margin-top: 24px;
}

.rules[_ngcontent-%COMP%], 
.plain[_ngcontent-%COMP%] {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rules[_ngcontent-%COMP%]   li[_ngcontent-%COMP%] {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 4px 12px;
  padding: 8px 12px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%surface-2);
  transition: border-color 0.2s var(--%NS%ease), opacity 0.2s var(--%NS%ease);
}

.rules[_ngcontent-%COMP%]   li[_ngcontent-%COMP%]:hover {
  border-color: var(--%NS%border-strong);
}

.rules[_ngcontent-%COMP%]   li.off[_ngcontent-%COMP%]   .rule-pattern[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
  text-decoration: line-through;
}

.rules[_ngcontent-%COMP%]   li.off[_ngcontent-%COMP%]   .rule-method[_ngcontent-%COMP%], 
.rules[_ngcontent-%COMP%]   li.off[_ngcontent-%COMP%]   .rule-meta[_ngcontent-%COMP%], 
.rules[_ngcontent-%COMP%]   li.off[_ngcontent-%COMP%]   .rule-meta[_ngcontent-%COMP%]   .status[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
}

.rules[_ngcontent-%COMP%]   li.empty-rule[_ngcontent-%COMP%] {
  display: block;
  padding: 16px 12px;
  border-style: dashed;
  border-color: var(--%NS%border-strong);
  background: none;
  color: var(--%NS%text-2);
  text-align: center;
}

.rule-pattern[_ngcontent-%COMP%] {
  min-width: 0;
  overflow: hidden;
  color: var(--%NS%text-strong);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rule-method[_ngcontent-%COMP%] {
  color: var(--%NS%accent);
  font-weight: 600;
}

.rule-meta[_ngcontent-%COMP%] {
  display: flex;
  flex-wrap: wrap;
  grid-column: 1/-1;
  gap: 4px 8px;
  padding-left: 24px;
  color: var(--%NS%text-2);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

.rule-meta[_ngcontent-%COMP%]    > span[_ngcontent-%COMP%]    + span[_ngcontent-%COMP%]::before {
  content: "·";
  margin-right: 8px;
  color: var(--%NS%text-3);
}

.rule-meta[_ngcontent-%COMP%]   .status[_ngcontent-%COMP%] {
  font-size: 11px;
}

.rules[_ngcontent-%COMP%]   button.remove[_ngcontent-%COMP%] {
  padding: 2px 4px;
  color: var(--%NS%text-2);
  font-size: 12px;
}

.rules[_ngcontent-%COMP%]   button.remove[_ngcontent-%COMP%]:hover:not(:disabled) {
  color: var(--%NS%danger);
}

.plain[_ngcontent-%COMP%]   li[_ngcontent-%COMP%] {
  overflow-wrap: anywhere;
}

code[_ngcontent-%COMP%] {
  font-family: var(--%NS%font-mono);
  font-size: 12px;
}

.stats[_ngcontent-%COMP%] {
  display: grid;
  margin: 0;
}

.stats[_ngcontent-%COMP%]    > div[_ngcontent-%COMP%] {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  min-height: 36px;
  padding: 6px 0;
  border-bottom: 1px solid var(--%NS%border);
}

.stats[_ngcontent-%COMP%]    > div[_ngcontent-%COMP%]:last-child {
  border-bottom: none;
}

dt[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
}

dd[_ngcontent-%COMP%] {
  margin: 0;
  color: var(--%NS%text-strong);
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  text-align: right;
}

.ok-note[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
}

.summary-line[_ngcontent-%COMP%] {
  margin-bottom: 8px;
  font-variant-numeric: tabular-nums;
}

.entries[_ngcontent-%COMP%] {
  border-top: 1px solid var(--%NS%border);
}

details[_ngcontent-%COMP%] {
  border-bottom: 1px solid var(--%NS%border);
}

details[_ngcontent-%COMP%]   pre[_ngcontent-%COMP%] {
  margin: 0 0 12px;
}

summary[_ngcontent-%COMP%] {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 36px;
  padding: 6px 4px;
  border-radius: 4px;
  list-style: none;
  cursor: pointer;
  transition: background-color 0.15s var(--%NS%ease);
}

summary[_ngcontent-%COMP%]::-webkit-details-marker {
  display: none;
}

summary[_ngcontent-%COMP%]:hover {
  background: var(--%NS%surface-2);
}

.chevron[_ngcontent-%COMP%] {
  flex: none;
  width: 6px;
  height: 6px;
  margin: 0 4px;
  border-right: 1.5px solid var(--%NS%text-3);
  border-bottom: 1.5px solid var(--%NS%text-3);
  transform: rotate(-45deg);
  transition: transform 0.15s var(--%NS%ease);
}

details[open][_ngcontent-%COMP%]   .chevron[_ngcontent-%COMP%] {
  transform: rotate(45deg);
}

.entry-key[_ngcontent-%COMP%] {
  flex: 1 1 auto;
  min-width: 0;
  overflow: hidden;
  font-family: var(--%NS%font-mono);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

summary[_ngcontent-%COMP%]:hover   .entry-key[_ngcontent-%COMP%] {
  color: var(--%NS%accent);
}

.entry-size[_ngcontent-%COMP%] {
  flex: none;
  color: var(--%NS%text-2);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
}

@media (max-width: 760px) {
  .grid[_ngcontent-%COMP%] {
    grid-template-columns: minmax(0, 1fr);
  }
  .toolbar[_ngcontent-%COMP%]   .page-picker[_ngcontent-%COMP%] {
    flex: 1 1 100%;
  }
  .toolbar[_ngcontent-%COMP%]   app-select[_ngcontent-%COMP%] {
    flex: 1 1 auto;
    width: auto;
    max-width: none;
  }
  .message[_ngcontent-%COMP%] {
    text-align: left;
  }
}`]})};function WU(e,t){e&1&&(A(),H(0,`svg`,9),Fg(1,`path`,21),U())}function GU(e,t){e&1&&(A(),H(0,`svg`,10)(1,`defs`)(2,`linearGradient`,22),Fg(3,`stop`,23)(4,`stop`,24),U()(),Fg(5,`path`,25),H(6,`g`,26),Fg(7,`path`,27)(8,`path`,28)(9,`path`,29)(10,`path`,30),U()())}function KU(e,t){e&1&&(A(),H(0,`svg`,11),Fg(1,`path`,31)(2,`path`,32)(3,`path`,33)(4,`path`,34),U())}function qU(e,t){e&1&&(A(),H(0,`svg`,9),Fg(1,`path`,35)(2,`path`,36)(3,`path`,37)(4,`path`,38)(5,`path`,39)(6,`path`,40),U())}function JU(e,t){if(e&1&&(H(0,`a`,16),Fg(1,`img`,41),H(2,`span`,42)(3,`span`,43),J(4,`Being built by`),U(),H(5,`strong`),J(6),U(),H(7,`span`,44),J(8),U()(),H(9,`span`,45),J(10,`→`),U(),H(11,`span`,46),J(12,`(opens in a new tab)`),U()()),e&2){let e=t,n=K();Vg(`href`,`https://github.com/pangular-inspector/devtools/pull/`+n.info().pr,ku),M(),Vg(`src`,`https://github.com/`+e.login+`.png?size=96`,ku),M(5),Y(e.name),M(2),Z(`@`,e.login,` · PR #`,n.info().pr)}}function YU(e,t){if(e&1&&(H(0,`a`,17)(1,`span`,42)(2,`strong`),J(3),U()(),H(4,`span`,45),J(5,`→`),U(),H(6,`span`,46),J(7,`(opens in a new tab)`),U()()),e&2){let e=t;Vg(`href`,e.href,ku),M(3),Y(e.label)}}function XU(e,t){if(e&1&&(H(0,`li`),J(1),U()),e&2){let e=t.$implicit,n=t.$index;C_(`animation-delay`,200+n*120,`ms`),M(),Y(e)}}var ZU=class e{info=$.required();plansTitle=Q(()=>{let e=this.info();return e.plansTitle??(e.link?`In an ${e.name} app`:`On the roadmap`)});static ɵfac=function(t){return new(t||e)};static ɵcmp=Bh({type:e,selectors:[[`app-coming-soon`]],hostVars:2,hostBindings:function(e,t){e&2&&C_(`--%NS%brand`,t.info().color)},inputs:{info:[1,`info`]},decls:30,vars:7,consts:[[`aria-labelledby`,`soon-title`,1,`soon`],[`aria-hidden`,`true`,1,`stage`],[1,`ring`,`r1`],[1,`ring`,`r2`],[1,`orbit`,`o1`],[1,`dot`],[1,`orbit`,`o2`],[1,`orbit`,`o3`],[1,`logo`],[`viewBox`,`0 0 256 256`,`width`,`96`,`height`,`96`],[`viewBox`,`0 0 32 32`,`width`,`88`,`height`,`88`],[`viewBox`,`0 0 256 182`,`width`,`104`,`height`,`74`],[1,`badge`],[`aria-hidden`,`true`,1,`spark`],[`id`,`soon-title`],[1,`summary`],[`target`,`_blank`,`rel`,`noopener noreferrer`,1,`author`,3,`href`],[`target`,`_blank`,`rel`,`noopener noreferrer`,1,`author`,`cta`,3,`href`],[1,`plans-title`],[1,`plans`],[3,`animation-delay`],[`fill`,`#3c5afd`,`d`,`M237.248 18.752q18.061 18.06 18.748 45.247V192c-.457 18.12-6.707 33.207-18.748 45.247c-12.04 12.04-27.127 18.291-45.251 18.752H63.999q-27.187-.69-45.247-18.752C6.712 225.208.46 210.121 0 192.001V64q.69-27.187 18.752-45.247Q36.812.692 63.999 0h127.998c18.124.46 33.211 6.711 45.251 18.752m-17.655 103q-6.033-6.003-6.28-15.066V64q-.192-9.063-6.221-15.091c-4.02-4.023-9.054-6.093-15.095-6.22h-21.312v106.626L85.315 42.687H63.999c-6.042.128-11.072 2.198-15.091 6.221c-4.023 4.02-6.093 9.05-6.22 15.09v42.688q-.249 9.063-6.281 15.066q-6.03 5.996-15.091 6.246q9.062.255 15.09 6.25c4.024 4.002 6.115 9.024 6.281 15.066V192c.128 6.037 2.198 11.072 6.221 15.091q6.03 6.03 15.09 6.22h21.317V106.687l85.37 106.627h21.312c6.041-.128 11.076-2.202 15.095-6.221s6.093-9.054 6.22-15.09v-42.688q.249-9.063 6.281-15.066q6.03-5.995 15.091-6.25q-9.062-.25-15.09-6.246`],[`id`,`an-hero-grad`,`x1`,`0`,`y1`,`0`,`x2`,`1`,`y2`,`1`],[`offset`,`0`,`stop-color`,`#f0224f`],[`offset`,`1`,`stop-color`,`#c4002d`],[`d`,`M16 0C27.2 0 32 4.8 32 16S27.2 32 16 32 0 27.2 0 16 4.8 0 16 0Z`,`fill`,`url(#an-hero-grad)`],[`transform`,`translate(6.4 6.4) scale(0.8)`,`fill`,`#fff`],[`d`,`M14.8486 0L23.138 16.8551L23.9996 3.99892L14.8486 0Z`],[`d`,`M16.9875 17.7114H7.01272L5.73926 20.627L12.0001 24L18.261 20.627L16.9875 17.7114Z`],[`d`,`M8.72168 13.9298H15.2812L11.9997 6.39575L8.72168 13.9298Z`],[`d`,`M9.15103 0L0 3.99892L0.861556 16.8551L9.15103 0Z`],[`fill`,`#c30f2e`,`d`,`M152.228.001L48.455 181.046H256L152.228 0z`],[`fill`,`#dd0330`,`d`,`M88.314 26.967L0 181.52h176.628L88.315 26.967z`],[`fill`,`#fff`,`d`,`M18.167 135.294h220.236v-2.419H18.167z`],[`fill`,`#fff`,`d`,`M204.38 170.667c-.861 0-1.67-.358-2.348-1.034c-4.045-4.063-4.221-20.586-4.026-45.33c.11-13.521.257-32.043-1.9-33.504c-2.104.873-2.315 16.172-2.451 26.301c-.162 11.785-.327 23.98-2.242 30.189c-.57 1.84-1.306 3.525-2.786 3.39c-2.086-.185-2.76-3.48-4.317-16.478c-.647-5.4-1.317-10.98-2.101-13.14a11 11 0 0 0-.269-.66c-.835 1.889-1.8 7.079-2.47 10.682c-.927 4.976-1.803 9.676-2.9 11.726c-.847 1.575-2.19 3.63-4.067 3.231c-2.558-.537-3.323-5.693-3.552-8.719c0-25.455-3.33-28.417-3.997-28.753l-.107.081l-.162-.036c-2.377 1.038-2.506 9.294-2.627 17.276c-.096 5.856-.198 12.492-1.053 18.701c-1.108 8.05-2.448 9.603-4.115 9.507c-3.838-.262-3.95-13.482-3.95-14.987c0-.472.012-1.028.027-1.642c.074-3.076.205-8.8-1.687-10.604c-.25-.239-.603-.515-.879-.437c-1.347.339-2.745 4.714-3.209 6.153c-.147.457-.265.833-.364 1.09c-.078.214-.177.515-.294.88c-1.02 3.095-2.18 6.183-4.16 6.944c-.732.284-1.498.222-2.216-.183c-.953-.541-1.73-1.646-2.455-3.482c-.397-1.016-.735-2.046-1.082-3.081c-.419-1.263-.85-2.569-1.384-3.808c-.419-.965-1.464-1.4-2.796-1.164c-2.768.494-3.232 3.29-3.622 7.5c-.07.733-.137 1.452-.228 2.128c-.011.198-.501 6.38-.814 8.344c-.865 5.39-2.002 7.512-3.89 7.358c-4.66-.398-6.798-20.836-6.684-29.47c.088-6.592-1.104-9-1.818-9.382c-.074-.034-.189-.096-.46.095c-.843.571-1.594 2.348-1.363 4.215c2.566 20.32.674 43.592-3.96 48.833c-1.46 1.649-3.448 1.627-4.832.236c-4.049-4.064-4.218-20.586-4.026-45.33c.11-13.521.254-32.043-1.9-33.504c-2.105.873-2.311 16.172-2.45 26.301c-.163 11.785-.329 23.98-2.246 30.189c-.57 1.84-1.307 3.525-2.782 3.39c-2.091-.186-2.761-3.48-4.321-16.478c-.649-5.4-1.319-10.98-2.101-13.14c-.1-.273-.189-.49-.27-.66c-.832 1.889-1.796 7.079-2.466 10.682c-.927 4.976-1.803 9.676-2.904 11.726c-.846 1.575-2.19 3.63-4.063 3.231c-2.558-.537-3.324-5.693-3.552-8.719c-.003-25.455-3.33-28.417-3.997-28.753l-.106.081l-.166-.036c-2.374 1.038-2.503 9.293-2.629 17.276c-.091 5.856-.194 12.492-1.048 18.701c-1.107 8.05-2.437 9.618-4.111 9.507c-3.846-.262-3.958-13.482-3.958-14.987c0-.472.016-1.028.03-1.642c.074-3.076.207-8.8-1.685-10.604c-.25-.239-.603-.515-.88-.438c-1.347.34-2.75 4.715-3.206 6.155a47 47 0 0 1-.364 1.09q-.16.432-.298.875c-1.02 3.096-2.18 6.187-4.155 6.95c-.736.282-1.506.22-2.22-.185c-.953-.541-1.734-1.646-2.454-3.482c-.398-1.016-.74-2.046-1.083-3.081c-.42-1.263-.854-2.569-1.387-3.808c-.416-.965-1.465-1.4-2.797-1.164c-3.188.567-3.943 4.52-4.55 9.238l-.106.839l-2.411-.32l.114-.824c.527-4.137 1.328-10.39 6.53-11.31c2.446-.435 4.585.581 5.446 2.583c.578 1.34 1.031 2.695 1.466 4.008c.324.99.654 1.98 1.037 2.959c.674 1.708 1.197 2.15 1.392 2.257c1.218-.38 2.462-4.167 2.873-5.414c.13-.402.24-.732.328-.968c.085-.233.195-.571.328-.98c1.097-3.43 2.474-7.144 4.918-7.762c.747-.191 1.903-.166 3.157 1.035c2.665 2.544 2.525 8.48 2.433 12.41c-.014.59-.028 1.126-.028 1.583c0 6.272.93 10.655 1.64 12.16c.367-.77.998-2.63 1.598-7.007c.831-6.066.938-12.624 1.027-18.41c.161-10.24.275-17.663 3.982-19.408c.552-.339 1.469-.522 2.436-.033c3.586 1.803 5.326 11.885 5.326 30.817c.225 2.926 1.013 6.006 1.66 6.448c.004-.066.53-.39 1.394-2.01c.925-1.718 1.845-6.665 2.655-11.026c1.792-9.614 2.606-12.989 4.726-13.166c1.615-.158 2.362 1.896 2.676 2.76c.883 2.422 1.537 7.888 2.23 13.678c.54 4.49 1.31 10.902 2.094 13.497c.084-.228.18-.5.283-.836c1.815-5.878 1.98-17.887 2.14-29.507c.22-16.14.503-26.139 3.448-28.226a2.44 2.44 0 0 1 2.233-.316c3.448 1.144 3.714 11.254 3.519 35.8c-.14 17.799-.313 39.952 3.323 43.603c.317.32.542.32.622.32c.17 0 .413-.161.67-.452c3.681-4.162 6.01-26.022 3.372-46.927c-.328-2.602.677-5.337 2.392-6.514c.946-.652 2.036-.736 2.978-.232c2.145 1.14 3.187 5.024 3.102 11.546c-.15 11.387 2.584 24.714 4.37 26.842c.282-.471.842-1.763 1.379-5.145c.301-1.87.799-8.153.806-8.216c.09-.71.155-1.398.217-2.097c.369-3.924.82-8.804 5.613-9.654c2.444-.435 4.583.577 5.448 2.583c.577 1.34 1.027 2.695 1.46 4.008c.332.99.664 1.98 1.046 2.959c.67 1.708 1.197 2.15 1.387 2.257c1.218-.38 2.467-4.167 2.875-5.41c.132-.402.243-.737.328-.973c.088-.228.195-.57.324-.979c1.1-3.43 2.477-7.144 4.924-7.762c.74-.191 1.9-.166 3.154 1.035c2.665 2.543 2.526 8.48 2.437 12.41q-.029.792-.033 1.583c0 6.272.931 10.655 1.641 12.16c.365-.77.994-2.63 1.601-7.007c.832-6.066.931-12.624 1.027-18.41c.159-10.24.273-17.663 3.98-19.408c.55-.339 1.467-.522 2.44-.033c3.58 1.803 5.325 11.884 5.325 30.817c.224 2.926 1.012 6.006 1.656 6.448c.008-.066.526-.39 1.399-2.01c.923-1.718 1.84-6.665 2.653-11.026c1.786-9.614 2.602-12.989 4.722-13.166c1.62-.158 2.367 1.896 2.68 2.76c.88 2.422 1.535 7.888 2.233 13.678c.534 4.49 1.304 10.902 2.092 13.497c.08-.228.176-.5.28-.836c1.813-5.878 1.976-17.887 2.138-29.507c.216-16.14.504-26.139 3.448-28.226a2.45 2.45 0 0 1 2.234-.316c3.452 1.144 3.718 11.254 3.52 35.8c-.141 17.799-.314 39.952 3.319 43.603c.324.32.544.32.63.32c.165 0 .408-.161.662-.452c3.687-4.162 6.014-26.022 3.375-46.927c-.342-2.723.43-5.47 1.84-6.526c.71-.537 1.575-.647 2.37-.313c2.054.877 3.445 4.63 4.255 11.484c.339 2.87.641 5.974.931 9.036c.641 6.683 1.509 15.69 2.684 17.67c.36-.46 1.096-1.704 2.19-5.038l2.307.753c-1.696 5.157-3.026 7.1-4.755 6.902c-2.69-.299-3.468-5.734-4.84-20.055c-.29-3.048-.59-6.132-.928-8.989c-1.03-8.74-2.782-9.532-2.801-9.54c-.342.174-1.137 1.992-.842 4.31c2.558 20.32.673 43.597-3.964 48.834c-.747.842-1.587 1.27-2.485 1.27`],[`fill`,`#53b9ff`,`d`,`M39.863 54.115L.311 93.716l60.995 61.179L0 216.385l39.428 39.619l61.43-61.507l61.097 61.068l39.552-39.602z`],[`fill`,`#119eff`,`d`,`m140.517 154.896l-39.658 39.601l61.097 61.069l39.552-39.602z`],[`fill-opacity`,`.2`,`d`,`m140.517 154.896l-39.658 39.601l15.267 15.182z`],[`fill`,`#53b9ff`,`d`,`M194.57 100.985L256 39.478L216.431 0l-61.412 61.384L93.917.311L54.365 39.913L216.01 201.761l39.552-39.602z`],[`fill`,`#119eff`,`d`,`m115.36 100.987l39.659-39.602L93.917.313L54.365 39.914z`],[`fill-opacity`,`.2`,`d`,`m115.359 100.985l39.659-39.601l-15.271-15.186z`],[`width`,`40`,`height`,`40`,`alt`,``,3,`src`],[1,`who`],[1,`by`],[1,`login`],[`aria-hidden`,`true`,1,`go`],[1,`sr-only`]],template:function(e,t){if(e&1&&(H(0,`section`,0)(1,`div`,1),Fg(2,`span`,2)(3,`span`,3),H(4,`span`,4),Fg(5,`span`,5),U(),H(6,`span`,6),Fg(7,`span`,5),U(),H(8,`span`,7),Fg(9,`span`,5),U(),H(10,`div`,8),P(11,WU,2,0,`:svg:svg`,9)(12,GU,11,0,`:svg:svg`,10)(13,KU,5,0,`:svg:svg`,11)(14,qU,7,0,`:svg:svg`,9),U()(),H(15,`p`,12)(16,`span`,13),J(17,`✦`),U(),J(18),U(),H(19,`h2`,14),J(20),U(),H(21,`p`,15),J(22),U(),P(23,JU,13,5,`a`,16),P(24,YU,8,2,`a`,17),H(25,`h3`,18),J(26),U(),H(27,`ul`,19),I(28,XU,2,3,`li`,20,wg),U()()),e&2){let e,n,r;M(11),F((e=t.info().id)===`nativescript`?11:e===`angular-native`?12:e===`analog`?13:e===`capacitor`?14:-1),M(7),X(` `,t.info().badge),M(2),Y(t.info().heading),M(2),Y(t.info().summary),M(),F((n=t.info().author)?23:-1,n),M(),F((r=t.info().link)?24:-1,r),M(2),X(` `,t.plansTitle(),` `),M(2),L(t.info().plans)}},styles:[`[_nghost-%COMP%] {
  display: block;
  min-height: 100%;
  background: radial-gradient(60% 50% at 50% 18%, color-mix(in srgb, var(--%NS%brand) 22%, transparent), transparent 70%);
}

.soon[_ngcontent-%COMP%] {
  display: flex;
  flex-direction: column;
  align-items: center;
  max-width: 560px;
  margin: 0 auto;
  padding: 24px 0 40px;
  color: var(--%NS%text-2);
  text-align: center;
}

.stage[_ngcontent-%COMP%] {
  position: relative;
  display: grid;
  place-items: center;
  width: 180px;
  height: 180px;
  margin: 0 auto 16px;
}

.logo[_ngcontent-%COMP%] {
  position: relative;
  z-index: 2;
  display: grid;
  place-items: center;
  width: 116px;
  height: 116px;
  border-radius: 32px;
  background: var(--%NS%surface-2);
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--%NS%brand) 45%, transparent), 0 20px 60px -10px color-mix(in srgb, var(--%NS%brand) 70%, transparent);
  animation: _ngcontent-%COMP%_float 4s ease-in-out infinite;
}

.ring[_ngcontent-%COMP%] {
  position: absolute;
  inset: 30px;
  border-radius: 50%;
  border: 1px solid color-mix(in srgb, var(--%NS%brand) 60%, transparent);
  animation: _ngcontent-%COMP%_pulse 3s ease-out infinite;
}

.r2[_ngcontent-%COMP%] {
  animation-delay: 1.5s;
}

.orbit[_ngcontent-%COMP%] {
  position: absolute;
  inset: 0;
  animation: spin 9s linear infinite;
}

.o2[_ngcontent-%COMP%] {
  inset: 18px;
  animation-duration: 6s;
  animation-direction: reverse;
}

.o3[_ngcontent-%COMP%] {
  inset: 40px;
  animation-duration: 12s;
}

.dot[_ngcontent-%COMP%] {
  position: absolute;
  top: -4px;
  left: 50%;
  width: 8px;
  height: 8px;
  margin-left: -4px;
  border-radius: 50%;
  background: var(--%NS%brand);
  box-shadow: 0 0 12px var(--%NS%brand);
}

.o2[_ngcontent-%COMP%]   .dot[_ngcontent-%COMP%] {
  width: 6px;
  height: 6px;
  background: var(--%NS%accent);
  box-shadow: 0 0 10px var(--%NS%accent);
}

.o3[_ngcontent-%COMP%]   .dot[_ngcontent-%COMP%] {
  width: 4px;
  height: 4px;
  background: var(--%NS%text-strong);
}

.badge[_ngcontent-%COMP%] {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  margin: 0 0 12px;
  padding: 0 12px;
  overflow: hidden;
  border: 1px solid color-mix(in srgb, var(--%NS%brand) 55%, transparent);
  border-radius: 99px;
  background: color-mix(in srgb, var(--%NS%brand) 14%, var(--%NS%surface));
  color: var(--%NS%text-strong);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
}

.badge[_ngcontent-%COMP%]::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(100deg, transparent 20%, rgba(255, 255, 255, 0.2) 50%, transparent 80%);
  transform: translateX(-100%);
  animation: _ngcontent-%COMP%_shimmer 2.8s ease-in-out infinite;
}

.spark[_ngcontent-%COMP%] {
  color: var(--%NS%accent);
  animation: _ngcontent-%COMP%_twinkle 1.6s ease-in-out infinite;
}

h2[_ngcontent-%COMP%] {
  margin: 0;
  color: var(--%NS%text-strong);
  font-size: 28px;
  line-height: 1.2;
  letter-spacing: -0.02em;
  text-wrap: balance;
  overflow-wrap: anywhere;
}

.summary[_ngcontent-%COMP%] {
  max-width: 480px;
  margin: 12px 0 24px;
  font-size: 14px;
  line-height: 1.6;
  text-wrap: pretty;
}

.author[_ngcontent-%COMP%] {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  max-width: 100%;
  min-height: 44px;
  padding: 8px 16px 8px 8px;
  border: 1px solid var(--%NS%border-strong);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  color: var(--%NS%text);
  text-align: left;
  text-decoration: none;
  transition: border-color 0.2s var(--%NS%ease), background-color 0.2s var(--%NS%ease), transform 0.2s var(--%NS%ease);
}

.author[_ngcontent-%COMP%]:hover {
  border-color: color-mix(in srgb, var(--%NS%brand) 70%, transparent);
  background: var(--%NS%surface-2);
  transform: translateY(-2px);
}

.author[_ngcontent-%COMP%]:active {
  transform: none;
}

.author[_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: 2px;
}

.cta[_ngcontent-%COMP%] {
  padding: 8px 16px;
}

.author[_ngcontent-%COMP%]   img[_ngcontent-%COMP%] {
  flex: none;
  border-radius: 50%;
  background: var(--%NS%surface-3);
}

.who[_ngcontent-%COMP%] {
  display: grid;
  min-width: 0;
  line-height: 1.35;
}

.who[_ngcontent-%COMP%]   strong[_ngcontent-%COMP%] {
  overflow: hidden;
  color: var(--%NS%text-strong);
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.by[_ngcontent-%COMP%], 
.login[_ngcontent-%COMP%] {
  overflow: hidden;
  color: var(--%NS%text-2);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.go[_ngcontent-%COMP%] {
  flex: none;
  margin-left: 4px;
  color: var(--%NS%brand);
  font-size: 16px;
  transition: transform 0.2s var(--%NS%ease), color 0.2s var(--%NS%ease);
}

.author[_ngcontent-%COMP%]:hover   .go[_ngcontent-%COMP%], 
.author[_ngcontent-%COMP%]:focus-visible   .go[_ngcontent-%COMP%] {
  transform: translateX(3px);
}

.plans-title[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  width: 100%;
  max-width: 440px;
  margin: 32px 0 12px;
  text-align: left;
}

.plans[_ngcontent-%COMP%] {
  display: grid;
  gap: 8px;
  width: 100%;
  max-width: 440px;
  margin: 0 auto;
  padding: 0;
  list-style: none;
  text-align: left;
}

.plans[_ngcontent-%COMP%]   li[_ngcontent-%COMP%] {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 12px 16px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius-sm);
  background: var(--%NS%surface);
  color: var(--%NS%text);
  font-size: 13px;
  line-height: 20px;
  overflow-wrap: anywhere;
  opacity: 0;
  animation: _ngcontent-%COMP%_rise 0.5s var(--%NS%ease) forwards;
}

.plans[_ngcontent-%COMP%]   li[_ngcontent-%COMP%]::before {
  content: "";
  flex: none;
  width: 8px;
  height: 8px;
  margin-top: 6px;
  border-radius: 50%;
  background: var(--%NS%brand);
  box-shadow: 0 0 0 3px color-mix(in srgb, var(--%NS%brand) 20%, transparent);
}

@media (max-height: 640px) {
  .soon[_ngcontent-%COMP%] {
    padding-top: 12px;
  }
  .stage[_ngcontent-%COMP%] {
    width: 120px;
    height: 120px;
    margin-bottom: 8px;
  }
  .logo[_ngcontent-%COMP%] {
    width: 80px;
    height: 80px;
    border-radius: 22px;
  }
  .logo[_ngcontent-%COMP%]   svg[_ngcontent-%COMP%] {
    width: 60px;
    height: auto;
  }
  .o3[_ngcontent-%COMP%] {
    display: none;
  }
  h2[_ngcontent-%COMP%] {
    font-size: 22px;
  }
}
@media (max-width: 420px) {
  h2[_ngcontent-%COMP%] {
    font-size: 22px;
  }
  .author[_ngcontent-%COMP%] {
    align-self: stretch;
  }
  .who[_ngcontent-%COMP%] {
    flex: 1;
  }
}
@keyframes _ngcontent-%COMP%_float {
  50% {
    transform: translateY(-10px) rotate(-2deg);
  }
}
@keyframes _ngcontent-%COMP%_pulse {
  from {
    transform: scale(0.8);
    opacity: 0.9;
  }
  to {
    transform: scale(1.6);
    opacity: 0;
  }
}
@keyframes _ngcontent-%COMP%_shimmer {
  60%, 100% {
    transform: translateX(100%);
  }
}
@keyframes _ngcontent-%COMP%_twinkle {
  50% {
    opacity: 0.35;
    transform: scale(0.8);
  }
}
@keyframes _ngcontent-%COMP%_rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .logo[_ngcontent-%COMP%], 
   .ring[_ngcontent-%COMP%], 
   .orbit[_ngcontent-%COMP%], 
   .badge[_ngcontent-%COMP%]::after, 
   .spark[_ngcontent-%COMP%] {
    animation: none;
  }
  .ring[_ngcontent-%COMP%] {
    opacity: 0.3;
  }
  .plans[_ngcontent-%COMP%]   li[_ngcontent-%COMP%] {
    opacity: 1;
    animation: none;
  }
  .author[_ngcontent-%COMP%]:hover, 
   .author[_ngcontent-%COMP%]:hover   .go[_ngcontent-%COMP%] {
    transform: none;
  }
}`]})};function QU(e){return`
  .devframes-dock-entry button {
    transition: opacity 0.2s, filter 0.2s, background-color 0.2s, transform 0.3s;
  }
  .devframes-dock-entry button:not(.scale-120) {
    opacity: 0.45;
    filter: saturate(0);
  }
  .devframes-dock-entry button:not(.scale-120):hover,
  .devframes-dock-entry button:not(.scale-120):focus-visible {
    opacity: 1;
    filter: none;
  }
  .devframes-dock-entry button:focus-visible {
    outline: 2px solid ${e===`light`?`#92400e`:`#f5a524`};
    outline-offset: 2px;
  }
  .devframes-dock-entry button.scale-120 {
    transform: none;
    background: ${e===`light`?`rgba(146, 64, 14, 0.12)`:`rgba(245, 165, 36, 0.16)`};
    box-shadow: inset 0 0 0 1px ${e===`light`?`rgba(146, 64, 14, 0.50)`:`rgba(245, 165, 36, 0.60)`};
  }
  iframe {
    background: ${e===`light`?`#ffffff`:`#0b0b0e`};
    color-scheme: ${e};
  }
  @media (prefers-reduced-motion: reduce) {
    .devframes-dock-entry button {
      transition: none;
    }
  }
`}var $U=new Map;function eW(e,t=`dark`,n=50){let r=e?.querySelector(`devframes-dock-standalone`)?.shadowRoot;if(r){if(e){let t=$U.get(e);t!==void 0&&(clearTimeout(t),$U.delete(e))}let n=r.querySelector(`style[data-pangular]`);n||(n=e.createElement(`style`),n.dataset.pangular=``,r.append(n)),n.textContent=QU(t);return}if(n>0&&e){let r=$U.get(e);r!==void 0&&clearTimeout(r);let i=setTimeout(()=>{$U.delete(e),eW(e,t,n-1)},100);$U.set(e,i)}}var tW=class e{current=j(`dark`);constructor(){let e=E(Cs),t=iW(),n=document.documentElement.dataset.theme,r=n===`light`||n===`dark`;if(n===`light`||n===`dark`)this.current.set(n);else if(t)r=!0,this.apply(rW(t));else{let t=nW();if(t){this.current.set(t.matches?`light`:`dark`);let n=e=>{r||this.current.set(e.matches?`light`:`dark`)};t.addEventListener(`change`,n),e.onDestroy(()=>t.removeEventListener(`change`,n))}}let i;try{i=new BroadcastChannel(`pangular:theme`)}catch{}uc(()=>{let e=this.current();try{i?.postMessage(e)}catch{}try{let t=window;for(;t!==t.parent;)t=t.parent,t.postMessage({type:`pangular:theme-change`,theme:e},`*`)}catch{}});let a=e=>{if(e.source!==window.parent)return;let t=e.data;t?.type===`pangular:theme-change`&&(r=!0,this.apply(t.theme===`dark`?`dark`:`light`))};window.addEventListener(`message`,a);let o;t&&(o=new MutationObserver(()=>this.apply(rW(t))),o.observe(t,{attributes:!0,attributeFilter:[`class`]})),e.onDestroy(()=>{window.removeEventListener(`message`,a),o?.disconnect(),i?.close()})}apply(e){this.current.set(e),document.documentElement.dataset.theme=e}static ɵfac=function(t){return new(t||e)};static ɵprov=kl({token:e,factory:e.ɵfac})};function nW(){try{return window.matchMedia?.(`(prefers-color-scheme: light)`)??null}catch{return null}}function rW(e){return e.classList.contains(`dark`)?`dark`:`light`}function iW(){try{return window.frameElement?.closest(`.devframes-color-root`)??null}catch{return null}}var aW=`__DEVFRAME_HUB_CLIENT_CONTEXT__`,oW=`pangular:`;function sW(){try{return window.parent===window?void 0:window.parent[aW]}catch{return}}function cW(e,t,n=50){let r=sW();if(!r){if(n<=0||window.parent===window)return()=>{};let r=()=>{},i=setTimeout(()=>r=cW(e,t,n-1),100);return()=>{clearTimeout(i),r()}}let i=e.map(e=>r.docks.getStateById(oW+e)?.events.on(`entry:activated`,()=>t(e))??(()=>{})),a=r.docks.selectedId,o=e.find(e=>oW+e===a);return o&&t(o),()=>i.forEach(e=>e())}async function lW(e){let t=sW();if(!t)return!1;try{return await t.docks.switchEntry(oW+e)}catch{return!1}}var uW=`pangular-tab`;function dW(e,t,n){let r=new URLSearchParams(e.replace(/^#/,``)).get(`tab`)||t;return n.find(e=>e===r)}function fW(e){try{return sessionStorage.getItem(`${uW}:${e}`)}catch{return null}}function pW(e,t){try{sessionStorage.setItem(`${uW}:${e}`,t)}catch{}}function mW(e,t){try{return new URL(e,t.href).origin===t.origin}catch{return!1}}function hW(e,t){if(t.protocol!==`chrome-extension:`)return!1;try{let{protocol:t}=new URL(e);return t===`http:`||t===`https:`}catch{return!1}}function gW(e=location){let t=new URLSearchParams(e.search).get(`baseURL`);if(t&&(mW(t,e)||hW(t,e)))return t;if(!(e.pathname.includes(`__pangular`)||e.pathname.includes(`__devframes/`)))return[`/__pangular/`,`./`]}var _W=[`nav`],vW=[`main`],yW=e=>[e],bW=(e,t)=>t.id;function xW(e,t){e&1&&(A(),z(0,`svg`,4),V(1,`path`,20),B())}function SW(e,t){e&1&&(A(),z(0,`svg`,4),V(1,`path`,21)(2,`path`,22)(3,`path`,23)(4,`path`,24)(5,`path`,25)(6,`path`,26),B())}function CW(e,t){e&1&&(A(),z(0,`svg`,5)(1,`defs`)(2,`linearGradient`,27),V(3,`stop`,28)(4,`stop`,29),B()(),V(5,`path`,30),z(6,`g`,31),V(7,`path`,32)(8,`path`,33)(9,`path`,34)(10,`path`,35),B()())}function wW(e,t){e&1&&(A(),z(0,`svg`,6),V(1,`path`,36)(2,`path`,37)(3,`path`,38)(4,`path`,39),B())}function TW(e,t){e&1&&(A(),z(0,`svg`,7),V(1,`path`,40),B())}function EW(e,t){e&1&&(A(),z(0,`svg`,8)(1,`defs`)(2,`linearGradient`,41),V(3,`stop`,42)(4,`stop`,43)(5,`stop`,44)(6,`stop`,45)(7,`stop`,46)(8,`stop`,47),B()(),V(9,`path`,48),B())}function DW(e,t){e&1&&(A(),z(0,`svg`,9),V(1,`rect`,49),z(2,`g`,50)(3,`defs`)(4,`mask`,51),V(5,`rect`,52),z(6,`g`,53),V(7,`path`,54)(8,`path`,55),B()(),z(9,`clipPath`,56),V(10,`rect`,57),B()(),z(11,`g`,58),V(12,`ellipse`,59),B(),z(13,`g`,60),V(14,`path`,61)(15,`path`,62),B(),z(16,`g`,58),V(17,`ellipse`,63)(18,`ellipse`,64),z(19,`g`,65),V(20,`line`,66)(21,`circle`,67)(22,`line`,68)(23,`circle`,69),B()()()())}function OW(e,t){if(e&1){let e=W();z(0,`button`,71),G(`click`,function(){let t=O(e).$implicit;return k(K(2).switchTab(t.id))}),V(1,`app-tab-icon`,72),z(2,`span`),J(3),B()()}if(e&2){let e=t.$implicit,n=K(2);q(`active`,n.tab()===e.id),N(`aria-current`,n.tab()===e.id?`page`:null),M(),R(`name`,e.id),M(2),Y(e.label)}}function kW(e,t){e&1&&I(0,OW,4,5,`button`,70,bW),e&2&&L(K().tabs())}function AW(e,t){e&1&&(z(0,`p`,16),J(1,` Can't reach the devtools server. Check that the dev server is running, then reload. `),B())}function jW(e,t){e&1&&V(0,`app-coming-soon`,17),e&2&&R(`info`,t)}function MW(e,t){e&1&&(z(0,`p`,18),J(1,`Looking for an Angular Native app…`),B())}function NW(e,t){e&1&&(z(0,`p`,19),J(1,` This inspector is turned off in the devtools config (`),z(2,`code`),J(3,`inspectors`),B(),J(4,`). `),B())}function PW(e,t){if(e&1){let e=W();z(0,`app-dashboard`,75),G(`navigate`,function(t){return O(e),k(K(3).switchTab(t))}),B()}e&2&&R(`rpc`,K(3).rpc())}function FW(e,t){if(e&1){let e=W();z(0,`app-component-tree`,76),G(`focusHandled`,function(){return O(e),k(K(3).componentFocus.set(null))})(`showForm`,function(t){return O(e),k(K(3).showForm(t))}),B()}if(e&2){let e=K(3);R(`rpc`,e.rpc())(`focus`,e.componentFocus())}}function IW(e,t){e&1&&V(0,`app-route-inspector`,73),e&2&&R(`rpc`,K(3).rpc())}function LW(e,t){e&1&&V(0,`app-signal-inspector`,73),e&2&&R(`rpc`,K(3).rpc())}function RW(e,t){e&1&&V(0,`app-di-inspector`,73),e&2&&R(`rpc`,K(3).rpc())}function zW(e,t){e&1&&V(0,`app-store-inspector`,73),e&2&&R(`rpc`,K(3).rpc())}function BW(e,t){e&1&&V(0,`app-network-inspector`,73),e&2&&R(`rpc`,K(3).rpc())}function VW(e,t){if(e&1){let e=W();z(0,`app-forms-inspector`,77),G(`focusHandled`,function(){return O(e),k(K(3).formFocus.set(null))}),B()}if(e&2){let e=K(3);R(`rpc`,e.rpc())(`focus`,e.formFocus())}}function HW(e,t){e&1&&V(0,`app-pipes-inspector`,73),e&2&&R(`rpc`,K(3).rpc())}function UW(e,t){e&1&&V(0,`app-analog-inspector`,73),e&2&&R(`rpc`,K(3).rpc())}function WW(e,t){if(e&1&&P(0,PW,1,1,`app-dashboard`,73)(1,FW,1,2,`app-component-tree`,74)(2,IW,1,1,`app-route-inspector`,73)(3,LW,1,1,`app-signal-inspector`,73)(4,RW,1,1,`app-di-inspector`,73)(5,zW,1,1,`app-store-inspector`,73)(6,BW,1,1,`app-network-inspector`,73)(7,VW,1,2,`app-forms-inspector`,74)(8,HW,1,1,`app-pipes-inspector`,73)(9,UW,1,1,`app-analog-inspector`,73),e&2){let e;F((e=K(2).tab())===`dashboard`?0:e===`components`?1:e===`routes`?2:e===`signals`?3:e===`injectors`?4:e===`store`?5:e===`network`?6:e===`forms`?7:e===`pipes`?8:e===`analog`?9:-1)}}function GW(e,t){e&1&&I(0,WW,10,1,null,null,wg),e&2&&L(sv(0,yW,K().scopeKey()))}var KW=[`angular`,`ngrx`,`analog`,`angular-native`,`nativescript`,`capacitor`],qW={angular:`Angular`,ngrx:`NgRx Store`,analog:`Analog`,"angular-native":`Angular Native`,nativescript:`NativeScript`,capacitor:`Capacitor`},JW={ngrx:`#d770e8`,analog:`#ff5470`,"angular-native":`#ff4d6d`,nativescript:`#8196ff`,capacitor:`#53b9ff`},YW={ngrx:`#a21caf`,analog:`#be123c`,"angular-native":`#be123c`,nativescript:`#3448c5`,capacitor:`#0369a1`},XW={ngrx:`store`,analog:`analog`},ZW={store:`ngrx`,analog:`analog`},QW={"angular-native":[`components`,`signals`,`injectors`,`store`,`pipes`]},$W={capacitor:{id:`capacitor`,name:`Capacitor`,badge:`Coming Soon`,heading:`Capacitor Support`,summary:`Connect Ionic and Capacitor apps running in a device WebView back to these tools.`,color:`#119eff`,plans:[`Manual overlay start for apps that load from capacitor:// or a device`,`Connection settings passed in, no cross-origin probing`,`Setup guides for the Android emulator and iOS simulator`],pr:21,author:{name:`Erkam Yaman`,login:`erkamyaman`}}},eG={id:`nativescript`,name:`NativeScript`,badge:`Available`,heading:`Inspect NativeScript apps`,summary:`A NativeScript Angular app reports from the simulator or device to this server, and its components, signals, injectors and NgRx stores show up in the Angular dock.`,color:`#3c5afd`,plansTitle:`Set up an app`,plans:[`Install @pangular-inspector/devtools and @valor/nativescript-websockets`,`Call initNativeScriptOverlay() in main.ts, before the app bootstraps`,`Run npx pangular dev --no-auth in the app, then open the Angular dock`],link:{label:`NativeScript setup guide`,href:`https://pangular-inspector.dev/guides/nativescript/`}},tG={id:`analog`,name:`Analog`,badge:`Not in this app`,heading:`This app doesn’t use Analog`,summary:`In an Analog app this dock shows your file routes, server load() and API calls, render modes and route lint.`,color:`#dd0330`,plans:[`Which page, layout and .server.ts files render a URL`,`Every load(), server function and API call with timing`,`SSR, prerendered or client only, per page`],link:{label:`Get started with Analog`,href:`https://analogjs.org/docs/getting-started`}},nG={id:`angular-native`,name:`Angular Native`,badge:`Not connected`,heading:`No Angular Native app is connected`,summary:`Start the overlay in your Angular Native app and run this server with --no-auth. The tabs fill as soon as the app reports.`,color:`#e11d48`,plans:[`The component tree, with the view outlined on the device`,`Signals and injectors of the running app`,`Live @ngrx/signals and @ngrx/store state`],link:{label:`Set up Angular Native`,href:`https://pangular-inspector.dev/guides/angular-native/`}};function rG(){let e=new URLSearchParams(location.search).get(`view`);return KW.find(t=>t===e)??null}Ub(class e{analog=j(!1);allTabs=[{id:`dashboard`,label:`Dashboard`},{id:`analog`,label:`Analog`},{id:`components`,label:`Components`},{id:`routes`,label:`Routes`},{id:`signals`,label:`Signals`},{id:`injectors`,label:`Injectors`},{id:`store`,label:`Store`},{id:`forms`,label:`Forms`},{id:`pipes`,label:`Pipes`},{id:`network`,label:`SSR & HTTP`}];view=j(rG());viewAccent=Q(()=>{let e=this.view(),t=this.themeService.current()===`light`?YW:JW;return(e&&t[e])??null});title=Q(()=>{let e=this.view();return e?qW[e]:`Pangular Inspector`});mainLabel=Q(()=>this.availableTabs().find(e=>e.id===this.tab())?.label??this.title());analogKnown=j(!1);nativePageId=j(null);nativeKnown=j(!1);scopeKey=Q(()=>this.view()===`angular-native`?this.nativePageId()??``:``);comingSoon=Q(()=>{let e=this.view();return e===`analog`?this.analogKnown()&&!this.analog()?tG:void 0:e===`nativescript`?eG:e===`angular-native`?this.nativeKnown()&&!this.nativePageId()?nG:void 0:e?$W[e]:void 0});config=Q(()=>sE(this.rpc()));tabEnabled=uE;availableTabs=Q(()=>{if(this.comingSoon())return[];let e=this.view(),t=e?XW[e]:void 0,n=this.allTabs.filter(e=>uE(e.id,this.config()));if(t)return n.filter(e=>e.id===t);let r=e?QW[e]:void 0;return r?n.filter(e=>r.includes(e.id)):n.filter(t=>(t.id!==`analog`||this.analog())&&!(e===`angular`&&ZW[t.id]))});tabs=Q(()=>{let e=this.availableTabs();if(this.rpc())return e;let t=this.tab();return e.filter(e=>e.id===`dashboard`||e.id===t)});tab=Tv(()=>{let e=this.view();return e&&(XW[e]??QW[e]?.[0])||`dashboard`});rpc=j(null);connected=j(!1);connectionFailed=j(!1);hiddenPages=j([]);pageId=$T();backgroundNote=Q(()=>{let e=this.hiddenPages();return this.pageId?e.includes(this.pageId)?`Tab in background, showing the last data.`:``:e.length?e.length===1?`A tab is in the background, showing its last data.`:`${e.length} tabs are in the background, showing their last data.`:``});stopVisibility=()=>{};stopNative=()=>{};stopFollowing=()=>{};stopHighlights=()=>{};nav=Rv(`nav`);main=Rv(`main`);injector=E(xs);themeService=E(tW);navObserver;navFade=j({start:!1,end:!1});constructor(){Id(()=>{let e=this.nav()?.nativeElement;e&&typeof ResizeObserver<`u`&&(this.navObserver=new ResizeObserver(()=>this.measureNav()),this.navObserver.observe(e))}),ey(()=>{this.tab(),this.tabs(),Cv(()=>{this.revealActiveTab(),this.measureNav()})}),uc(()=>{let e=this.themeService.current();Cv(()=>{try{window.parent!==window&&eW(window.parent.document,e)}catch{}})})}measureNav(){let e=this.nav()?.nativeElement;if(!e)return;let t=e.scrollWidth-e.clientWidth,n=e.scrollLeft>1,r=t>1&&e.scrollLeft<t-1,i=this.navFade();(i.start!==n||i.end!==r)&&this.navFade.set({start:n,end:r})}revealActiveTab(){let e=this.nav()?.nativeElement,t=e?.querySelector(`button.active`);if(!e||!t||e.scrollWidth<=e.clientWidth)return;let n=t.offsetLeft-24,r=t.offsetLeft+t.offsetWidth+24-e.clientWidth;e.scrollLeft>n?e.scrollLeft=Math.max(0,n):e.scrollLeft<r&&(e.scrollLeft=r)}ngOnInit(){this.view()&&(this.stopFollowing=cW(KW,e=>this.showView(e)));let e=dW(location.hash,fW(this.tabScope()),this.availableTabs().map(e=>e.id));e?this.tab.set(e):!this.view()&&dW(location.hash,fW(this.tabScope()),[`analog`])===`analog`&&(this.restoreAnalog=!0),this.stopHighlights=oE(()=>this.rpc());let t=gW();kT(t?{baseURL:t}:{}).then(e=>{this.rpc.set(e),this.connected.set(!0),this.watchVisibility(e),this.watchAngularNative(e),e.scope(`pangular`).rpc.call(`analog-project`).then(e=>{let t=!!e?.analog;this.analog.set(t),this.analogKnown.set(!0),t&&this.restoreAnalog&&uE(`analog`,this.config())&&this.tab.set(`analog`),this.restoreAnalog=!1,!t&&this.tab()===`analog`&&!this.view()&&this.tab.set(`dashboard`)},()=>{this.analogKnown.set(!0),this.restoreAnalog=!1,this.tab()===`analog`&&!this.view()&&this.tab.set(`dashboard`)}),e.events.on(`connection:status`,e=>{this.connected.set(e===`connected`)})},()=>{this.connectionFailed.set(!0),this.analogKnown.set(!0),this.nativeKnown.set(!0)})}ngOnDestroy(){this.stopNative(),this.stopFollowing(),this.stopVisibility(),this.stopHighlights(),this.navObserver?.disconnect()}showView(e){if(e===this.view())return;QT(e===`angular-native`?this.nativePageId():null),this.view.set(e);let t=new URL(location.href);t.searchParams.set(`view`,e),t.hash=``,history.replaceState(history.state,``,t)}formFocus=j(null);componentFocus=Tv({source:this.tab,computation:()=>null});showForm(e){this.formFocus.set({id:e}),this.switchTab(`forms`)}inspectFromPanel({source:e,origin:t,data:n}){if(e!==window.parent||t!==location.origin)return;let r=n;r?.type===`pangular:inspect-component`&&typeof r.id==`string`&&this.tab()===`components`&&this.config().inspectors.components&&this.componentFocus.set({id:r.id})}switchTab(e){let t=ZW[e];if(this.view()===`angular`&&t){this.activateDock(t,e);return}this.setTab(e),history.replaceState(history.state,``,`#tab=${e}`)}restoreAnalog=!1;setTab(e){this.restoreAnalog=!1,this.keepFocus(),this.tab.set(e),pW(this.tabScope(),e)}tabScope(){return this.view()??`panel`}async watchAngularNative(e){try{let t=await e.scope(`pangular`).rpc.sharedState(`component-tree`),n=e=>{let t=e?.pages,n=iD(t,this.nativePageId());this.view()===`angular-native`&&QT(n),this.nativePageId.set(n),this.nativeKnown.set(!0)};n(t.value()),this.stopNative(),this.stopNative=t.on(`updated`,n)}catch{this.nativeKnown.set(!0)}}async watchVisibility(e){try{let t=await e.scope(`pangular`).rpc.sharedState(`page-visibility`),n=e=>{let t=e?.hidden;this.hiddenPages.set(Array.isArray(t)?t.filter(e=>typeof e==`string`):[])};n(t.value()),this.stopVisibility(),this.stopVisibility=t.on(`updated`,n)}catch{}}keepFocus(){let e=document.activeElement,t=this.main()?.nativeElement;(!e||e===document.body||t?.contains(e))&&Id(()=>{let e=document.activeElement;e&&e!==document.body||(this.nav()?.nativeElement.querySelector(`button.active`)??this.main()?.nativeElement)?.focus()},{injector:this.injector})}async activateDock(e,t){if(await lW(e))return;if(window.parent===window){this.keepFocus(),this.showView(e);return}let n=this.rpc();if(!n?.call){this.setTab(t);return}try{await n.call(`hub:docks:activate`,{dockId:`pangular:${e}`}),this.keepFocus(),this.showView(e)}catch{this.setTab(t)}}static ɵfac=function(t){return new(t||e)};static ɵcmp=Bh({type:e,selectors:[[`app-root`]],viewQuery:function(e,t){e&1&&e_(t.nav,_W,5)(t.main,vW,5),e&2&&t_(2)},hostVars:2,hostBindings:function(e,t){e&1&&G(`message`,function(e){return t.inspectFromPanel(e)},ju),e&2&&C_(`--%NS%accent`,t.viewAccent())},decls:28,vars:21,consts:[[`nav`,``],[`main`,``],[1,`brand`],[1,`mark`],[`width`,`22`,`height`,`22`,`viewBox`,`0 0 256 256`,`aria-hidden`,`true`],[`width`,`22`,`height`,`22`,`viewBox`,`0 0 32 32`,`aria-hidden`,`true`],[`width`,`24`,`height`,`17`,`viewBox`,`0 0 256 182`,`aria-hidden`,`true`],[`width`,`22`,`height`,`22`,`viewBox`,`0 0 24 24`,`fill`,`currentColor`,`aria-hidden`,`true`],[`width`,`20`,`height`,`22`,`viewBox`,`0 0 223 236`,`aria-hidden`,`true`],[`width`,`30`,`height`,`30`,`viewBox`,`0 0 500 500`,`aria-hidden`,`true`],[1,`title`],[`aria-label`,`Inspectors`,3,`scroll`],[`role`,`status`,1,`status`],[`aria-hidden`,`true`,1,`dot`],[`tabindex`,`-1`],[`role`,`status`,1,`background-note`],[`role`,`alert`,1,`connection-error`],[3,`info`],[`role`,`status`,1,`turned-off`],[1,`turned-off`],[`fill`,`#3c5afd`,`d`,`M237.248 18.752q18.061 18.06 18.748 45.247V192c-.457 18.12-6.707 33.207-18.748 45.247c-12.04 12.04-27.127 18.291-45.251 18.752H63.999q-27.187-.69-45.247-18.752C6.712 225.208.46 210.121 0 192.001V64q.69-27.187 18.752-45.247Q36.812.692 63.999 0h127.998c18.124.46 33.211 6.711 45.251 18.752m-17.655 103q-6.033-6.003-6.28-15.066V64q-.192-9.063-6.221-15.091c-4.02-4.023-9.054-6.093-15.095-6.22h-21.312v106.626L85.315 42.687H63.999c-6.042.128-11.072 2.198-15.091 6.221c-4.023 4.02-6.093 9.05-6.22 15.09v42.688q-.249 9.063-6.281 15.066q-6.03 5.996-15.091 6.246q9.062.255 15.09 6.25c4.024 4.002 6.115 9.024 6.281 15.066V192c.128 6.037 2.198 11.072 6.221 15.091q6.03 6.03 15.09 6.22h21.317V106.687l85.37 106.627h21.312c6.041-.128 11.076-2.202 15.095-6.221s6.093-9.054 6.22-15.09v-42.688q.249-9.063 6.281-15.066q6.03-5.995 15.091-6.25q-9.062-.25-15.09-6.246`],[`fill`,`#53b9ff`,`d`,`M39.863 54.115L.311 93.716l60.995 61.179L0 216.385l39.428 39.619l61.43-61.507l61.097 61.068l39.552-39.602z`],[`fill`,`#119eff`,`d`,`m140.517 154.896l-39.658 39.601l61.097 61.069l39.552-39.602z`],[`fill-opacity`,`.2`,`d`,`m140.517 154.896l-39.658 39.601l15.267 15.182z`],[`fill`,`#53b9ff`,`d`,`M194.57 100.985L256 39.478L216.431 0l-61.412 61.384L93.917.311L54.365 39.913L216.01 201.761l39.552-39.602z`],[`fill`,`#119eff`,`d`,`m115.36 100.987l39.659-39.602L93.917.313L54.365 39.914z`],[`fill-opacity`,`.2`,`d`,`m115.359 100.985l39.659-39.601l-15.271-15.186z`],[`id`,`an-mark-grad`,`x1`,`0`,`y1`,`0`,`x2`,`1`,`y2`,`1`],[`offset`,`0`,`stop-color`,`#f0224f`],[`offset`,`1`,`stop-color`,`#c4002d`],[`d`,`M16 0C27.2 0 32 4.8 32 16S27.2 32 16 32 0 27.2 0 16 4.8 0 16 0Z`,`fill`,`url(#an-mark-grad)`],[`transform`,`translate(6.4 6.4) scale(0.8)`,`fill`,`#fff`],[`d`,`M14.8486 0L23.138 16.8551L23.9996 3.99892L14.8486 0Z`],[`d`,`M16.9875 17.7114H7.01272L5.73926 20.627L12.0001 24L18.261 20.627L16.9875 17.7114Z`],[`d`,`M8.72168 13.9298H15.2812L11.9997 6.39575L8.72168 13.9298Z`],[`d`,`M9.15103 0L0 3.99892L0.861556 16.8551L9.15103 0Z`],[`fill`,`#c30f2e`,`d`,`M152.228.001L48.455 181.046H256L152.228 0z`],[`fill`,`#dd0330`,`d`,`M88.314 26.967L0 181.52h176.628L88.315 26.967z`],[`fill`,`#fff`,`d`,`M18.167 135.294h220.236v-2.419H18.167z`],[`fill`,`#fff`,`d`,`M204.38 170.667c-.861 0-1.67-.358-2.348-1.034c-4.045-4.063-4.221-20.586-4.026-45.33c.11-13.521.257-32.043-1.9-33.504c-2.104.873-2.315 16.172-2.451 26.301c-.162 11.785-.327 23.98-2.242 30.189c-.57 1.84-1.306 3.525-2.786 3.39c-2.086-.185-2.76-3.48-4.317-16.478c-.647-5.4-1.317-10.98-2.101-13.14a11 11 0 0 0-.269-.66c-.835 1.889-1.8 7.079-2.47 10.682c-.927 4.976-1.803 9.676-2.9 11.726c-.847 1.575-2.19 3.63-4.067 3.231c-2.558-.537-3.323-5.693-3.552-8.719c0-25.455-3.33-28.417-3.997-28.753l-.107.081l-.162-.036c-2.377 1.038-2.506 9.294-2.627 17.276c-.096 5.856-.198 12.492-1.053 18.701c-1.108 8.05-2.448 9.603-4.115 9.507c-3.838-.262-3.95-13.482-3.95-14.987c0-.472.012-1.028.027-1.642c.074-3.076.205-8.8-1.687-10.604c-.25-.239-.603-.515-.879-.437c-1.347.339-2.745 4.714-3.209 6.153c-.147.457-.265.833-.364 1.09c-.078.214-.177.515-.294.88c-1.02 3.095-2.18 6.183-4.16 6.944c-.732.284-1.498.222-2.216-.183c-.953-.541-1.73-1.646-2.455-3.482c-.397-1.016-.735-2.046-1.082-3.081c-.419-1.263-.85-2.569-1.384-3.808c-.419-.965-1.464-1.4-2.796-1.164c-2.768.494-3.232 3.29-3.622 7.5c-.07.733-.137 1.452-.228 2.128c-.011.198-.501 6.38-.814 8.344c-.865 5.39-2.002 7.512-3.89 7.358c-4.66-.398-6.798-20.836-6.684-29.47c.088-6.592-1.104-9-1.818-9.382c-.074-.034-.189-.096-.46.095c-.843.571-1.594 2.348-1.363 4.215c2.566 20.32.674 43.592-3.96 48.833c-1.46 1.649-3.448 1.627-4.832.236c-4.049-4.064-4.218-20.586-4.026-45.33c.11-13.521.254-32.043-1.9-33.504c-2.105.873-2.311 16.172-2.45 26.301c-.163 11.785-.329 23.98-2.246 30.189c-.57 1.84-1.307 3.525-2.782 3.39c-2.091-.186-2.761-3.48-4.321-16.478c-.649-5.4-1.319-10.98-2.101-13.14c-.1-.273-.189-.49-.27-.66c-.832 1.889-1.796 7.079-2.466 10.682c-.927 4.976-1.803 9.676-2.904 11.726c-.846 1.575-2.19 3.63-4.063 3.231c-2.558-.537-3.324-5.693-3.552-8.719c-.003-25.455-3.33-28.417-3.997-28.753l-.106.081l-.166-.036c-2.374 1.038-2.503 9.293-2.629 17.276c-.091 5.856-.194 12.492-1.048 18.701c-1.107 8.05-2.437 9.618-4.111 9.507c-3.846-.262-3.958-13.482-3.958-14.987c0-.472.016-1.028.03-1.642c.074-3.076.207-8.8-1.685-10.604c-.25-.239-.603-.515-.88-.438c-1.347.34-2.75 4.715-3.206 6.155a47 47 0 0 1-.364 1.09q-.16.432-.298.875c-1.02 3.096-2.18 6.187-4.155 6.95c-.736.282-1.506.22-2.22-.185c-.953-.541-1.734-1.646-2.454-3.482c-.398-1.016-.74-2.046-1.083-3.081c-.42-1.263-.854-2.569-1.387-3.808c-.416-.965-1.465-1.4-2.797-1.164c-3.188.567-3.943 4.52-4.55 9.238l-.106.839l-2.411-.32l.114-.824c.527-4.137 1.328-10.39 6.53-11.31c2.446-.435 4.585.581 5.446 2.583c.578 1.34 1.031 2.695 1.466 4.008c.324.99.654 1.98 1.037 2.959c.674 1.708 1.197 2.15 1.392 2.257c1.218-.38 2.462-4.167 2.873-5.414c.13-.402.24-.732.328-.968c.085-.233.195-.571.328-.98c1.097-3.43 2.474-7.144 4.918-7.762c.747-.191 1.903-.166 3.157 1.035c2.665 2.544 2.525 8.48 2.433 12.41c-.014.59-.028 1.126-.028 1.583c0 6.272.93 10.655 1.64 12.16c.367-.77.998-2.63 1.598-7.007c.831-6.066.938-12.624 1.027-18.41c.161-10.24.275-17.663 3.982-19.408c.552-.339 1.469-.522 2.436-.033c3.586 1.803 5.326 11.885 5.326 30.817c.225 2.926 1.013 6.006 1.66 6.448c.004-.066.53-.39 1.394-2.01c.925-1.718 1.845-6.665 2.655-11.026c1.792-9.614 2.606-12.989 4.726-13.166c1.615-.158 2.362 1.896 2.676 2.76c.883 2.422 1.537 7.888 2.23 13.678c.54 4.49 1.31 10.902 2.094 13.497c.084-.228.18-.5.283-.836c1.815-5.878 1.98-17.887 2.14-29.507c.22-16.14.503-26.139 3.448-28.226a2.44 2.44 0 0 1 2.233-.316c3.448 1.144 3.714 11.254 3.519 35.8c-.14 17.799-.313 39.952 3.323 43.603c.317.32.542.32.622.32c.17 0 .413-.161.67-.452c3.681-4.162 6.01-26.022 3.372-46.927c-.328-2.602.677-5.337 2.392-6.514c.946-.652 2.036-.736 2.978-.232c2.145 1.14 3.187 5.024 3.102 11.546c-.15 11.387 2.584 24.714 4.37 26.842c.282-.471.842-1.763 1.379-5.145c.301-1.87.799-8.153.806-8.216c.09-.71.155-1.398.217-2.097c.369-3.924.82-8.804 5.613-9.654c2.444-.435 4.583.577 5.448 2.583c.577 1.34 1.027 2.695 1.46 4.008c.332.99.664 1.98 1.046 2.959c.67 1.708 1.197 2.15 1.387 2.257c1.218-.38 2.467-4.167 2.875-5.41c.132-.402.243-.737.328-.973c.088-.228.195-.57.324-.979c1.1-3.43 2.477-7.144 4.924-7.762c.74-.191 1.9-.166 3.154 1.035c2.665 2.543 2.526 8.48 2.437 12.41q-.029.792-.033 1.583c0 6.272.931 10.655 1.641 12.16c.365-.77.994-2.63 1.601-7.007c.832-6.066.931-12.624 1.027-18.41c.159-10.24.273-17.663 3.98-19.408c.55-.339 1.467-.522 2.44-.033c3.58 1.803 5.325 11.884 5.325 30.817c.224 2.926 1.012 6.006 1.656 6.448c.008-.066.526-.39 1.399-2.01c.923-1.718 1.84-6.665 2.653-11.026c1.786-9.614 2.602-12.989 4.722-13.166c1.62-.158 2.367 1.896 2.68 2.76c.88 2.422 1.535 7.888 2.233 13.678c.534 4.49 1.304 10.902 2.092 13.497c.08-.228.176-.5.28-.836c1.813-5.878 1.976-17.887 2.138-29.507c.216-16.14.504-26.139 3.448-28.226a2.45 2.45 0 0 1 2.234-.316c3.452 1.144 3.718 11.254 3.52 35.8c-.141 17.799-.314 39.952 3.319 43.603c.324.32.544.32.63.32c.165 0 .408-.161.662-.452c3.687-4.162 6.014-26.022 3.375-46.927c-.342-2.723.43-5.47 1.84-6.526c.71-.537 1.575-.647 2.37-.313c2.054.877 3.445 4.63 4.255 11.484c.339 2.87.641 5.974.931 9.036c.641 6.683 1.509 15.69 2.684 17.67c.36-.46 1.096-1.704 2.19-5.038l2.307.753c-1.696 5.157-3.026 7.1-4.755 6.902c-2.69-.299-3.468-5.734-4.84-20.055c-.29-3.048-.59-6.132-.928-8.989c-1.03-8.74-2.782-9.532-2.801-9.54c-.342.174-1.137 1.992-.842 4.31c2.558 20.32.673 43.597-3.964 48.834c-.747.842-1.587 1.27-2.485 1.27`],[`d`,`M12.024.017V0L12 .008L11.976 0v.017L.812 3.892l1.605 14.875l9.559 5.207V24l.024-.013l.024.013v-.026l9.559-5.207l1.605-14.875zm6.868 14.244q-1.64 3.948-6.031 4.166c-2.829 0-4.661-1.7-4.66-1.7q-1.745-1.359-2.398-3.417c-.695-.76-.702-.841-.774-1.145c-.072-.303.045-.388.249-.685q.204-.298.098-.85q-.26-.36-.3-1.128q0-.37.496-.783q.495-.413.607-.632q.083-.119.065-1.031q-.006-.897.995-.975c1-.08 1.565-.832 1.879-1.174c.21-.228.52-.339.91-.341c.551-.026 1.052.185 1.484.62c1.075-.055 2.176.235 3.292.863q2.379 1.414 2.596 3.055q-.257 2.158-5.788-.113q-2.895.819-2.846 3.552q0 2.508 2.422 3.643c-.787-.772-1.122-1.422-1.01-1.959q2.456 2.906 5.588 2.173c-.92.032-1.65-.264-2.198-.893q2.116-.05 3.998-1.972c-.724.576-1.482.794-2.284.657q3.26-2.563 2.307-5.98l-.002-.006a3.02 3.02 0 0 1 .788 2.03q.023 1.175-.795 2.477q.613-.478 1.413-2.047c.23 2.117-.625 3.724-2.574 4.825q.934-.085 2.473-1.23m-5.567-6.63a.319.319 0 1 1 .638 0a.319.319 0 0 1-.638 0`],[`id`,`ng-grad`,`x1`,`49`,`x2`,`226`,`y1`,`214`,`y2`,`130`,`gradientUnits`,`userSpaceOnUse`],[`stop-color`,`#E40035`],[`offset`,`.24`,`stop-color`,`#F60A48`],[`offset`,`.352`,`stop-color`,`#F20755`],[`offset`,`.494`,`stop-color`,`#DC087D`],[`offset`,`.745`,`stop-color`,`#9717E7`],[`offset`,`1`,`stop-color`,`#6C00F5`],[`fill`,`url(#ng-grad)`,`d`,`m222.077 39.192-8.019 125.923L137.387 0l84.69 39.192Zm-53.105 162.825-57.933 33.056-57.934-33.056 11.783-28.556h92.301l11.783 28.556ZM111.039 62.675l30.357 73.803H80.681l30.358-73.803ZM7.937 165.115 0 39.192 84.69 0 7.937 165.115Z`],[`width`,`500`,`height`,`500`,`rx`,`112`,`fill`,`#1c1a17`],[`transform`,`translate(250 252) scale(1.38) translate(-120 -129)`],[`id`,`pi-mark-mask`],[`x`,`-60`,`y`,`-60`,`width`,`360`,`height`,`380`,`fill`,`#fff`],[`fill`,`none`,`stroke`,`#000`,`stroke-width`,`30`,`stroke-linejoin`,`miter`],[`d`,`M88 66 V196`],[`d`,`M88 66 H143 L170 98 L143 130 H88 Z`],[`id`,`pi-mark-clip`],[`x`,`-40`,`y`,`129`,`width`,`320`,`height`,`200`],[`transform`,`rotate(-10 120 129)`],[`cx`,`120`,`cy`,`129`,`rx`,`128`,`ry`,`34`,`fill`,`none`,`stroke`,`#78350f`,`stroke-width`,`10`],[`mask`,`url(#pi-mark-mask)`],[`fill`,`#fbbf24`,`d`,`M120 5 L2 46 L22 198 L120 253 Z`],[`fill`,`#f59e0b`,`d`,`M120 5 L238 46 L218 198 L120 253 Z`],[`clip-path`,`url(#pi-mark-clip)`,`cx`,`120`,`cy`,`129`,`rx`,`128`,`ry`,`34`,`fill`,`none`,`stroke`,`#1c1a17`,`stroke-width`,`22`],[`clip-path`,`url(#pi-mark-clip)`,`cx`,`120`,`cy`,`129`,`rx`,`128`,`ry`,`34`,`fill`,`none`,`stroke`,`#fde68a`,`stroke-width`,`10`],[`transform`,`translate(230.9 146.0) rotate(10) scale(1.5) translate(-4 -4)`],[`x1`,`9`,`y1`,`9`,`x2`,`21`,`y2`,`21`,`stroke`,`#1c1a17`,`stroke-width`,`14`,`stroke-linecap`,`round`],[`r`,`16`,`fill`,`#1c1a17`],[`x1`,`9`,`y1`,`9`,`x2`,`21`,`y2`,`21`,`stroke`,`#fde68a`,`stroke-width`,`7`,`stroke-linecap`,`round`],[`r`,`12`,`fill`,`#1c1a17`,`stroke`,`#fde68a`,`stroke-width`,`5`],[`type`,`button`,3,`active`],[`type`,`button`,3,`click`],[3,`name`],[3,`rpc`],[3,`rpc`,`focus`],[3,`navigate`,`rpc`],[3,`focusHandled`,`showForm`,`rpc`,`focus`],[3,`focusHandled`,`rpc`,`focus`]],template:function(e,t){if(e&1&&(z(0,`header`)(1,`h1`,2)(2,`span`,3),P(3,xW,2,0,`:svg:svg`,4)(4,SW,7,0,`:svg:svg`,4)(5,CW,11,0,`:svg:svg`,5)(6,wW,5,0,`:svg:svg`,6)(7,TW,2,0,`:svg:svg`,7)(8,EW,10,0,`:svg:svg`,8)(9,DW,24,0,`:svg:svg`,9),B(),z(10,`span`,10),J(11),B()(),z(12,`nav`,11,0),G(`scroll`,function(){return t.measureNav()}),P(14,kW,2,0),B(),z(15,`span`,12)(16,`span`,13),V(17,`span`),B(),J(18),B()(),z(19,`main`,14,1)(21,`p`,15),J(22),B(),P(23,AW,2,0,`p`,16)(24,jW,1,1,`app-coming-soon`,17)(25,MW,2,0,`p`,18)(26,NW,5,0,`p`,19)(27,GW,2,2),B()),e&2){let e;M(2),q(`ng-mark`,t.view()===`angular`)(`pi-mark`,!t.view()),M(),F(t.view()===`nativescript`?3:t.view()===`capacitor`?4:t.view()===`angular-native`?5:t.view()===`analog`?6:t.view()===`ngrx`?7:t.view()===`angular`?8:9),M(7),q(`ng-text`,t.view()===`angular`),M(),Y(t.title()),M(),q(`fade-start`,t.navFade().start)(`fade-end`,t.navFade().end),M(2),F(t.availableTabs().length>1?14:-1),M(),q(`connected`,t.connected())(`failed`,t.connectionFailed()),M(3),X(` `,t.connected()?`Live`:t.connectionFailed()?`Disconnected`:`Connecting…`,` `),M(),N(`aria-label`,t.mainLabel()),M(3),Y(t.backgroundNote()),M(),F(t.connectionFailed()?23:(e=t.comingSoon())?24:t.view()===`angular-native`&&!t.nativePageId()?25:t.tabEnabled(t.tab(),t.config())?27:26,e)}},dependencies:[XE,fk,zM,ZN,sF,pL,Rz,LB,GH,UU,ZU,xE],styles:[`[_nghost-%COMP%] {
  --%NS%accent-soft: color-mix(in srgb, var(--%NS%accent) 12%, transparent);
  --%NS%accent-line: color-mix(in srgb, var(--%NS%accent) 45%, transparent);
  display: flex;
  flex-direction: column;
  height: 100vh;
  height: 100dvh;
  min-width: 0;
  background: radial-gradient(900px 300px at 10% -10%, color-mix(in srgb, var(--%NS%accent) 7%, transparent), transparent 70%), var(--%NS%bg);
}

header[_ngcontent-%COMP%] {
  position: sticky;
  top: 0;
  z-index: 10;
  display: flex;
  flex-wrap: nowrap;
  flex-shrink: 0;
  align-items: center;
  gap: 8px 16px;
  height: 45px;
  padding: 0 16px;
  background: color-mix(in srgb, var(--%NS%surface) 82%, transparent);
  backdrop-filter: blur(12px) saturate(1.3);
  border-bottom: 1px solid var(--%NS%border);
}

.brand[_ngcontent-%COMP%] {
  display: flex;
  flex-shrink: 0;
  align-items: center;
  gap: 10px;
  min-width: 0;
  margin: 0;
  color: var(--%NS%accent);
  font-size: 15px;
  font-weight: 650;
  line-height: 1.2;
  letter-spacing: -0.01em;
  white-space: nowrap;
}

.title[_ngcontent-%COMP%] {
  overflow: hidden;
  text-overflow: ellipsis;
}

.mark[_ngcontent-%COMP%] {
  display: grid;
  flex-shrink: 0;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--%NS%accent) 8%, transparent);
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--%NS%accent) 28%, transparent);
}

.mark.pi-mark[_ngcontent-%COMP%] {
  background: none;
  box-shadow: none;
}

.mark.ng-mark[_ngcontent-%COMP%] {
  background: linear-gradient(135deg, color-mix(in srgb, #f60a48 12%, transparent), color-mix(in srgb, #9717e7 12%, transparent));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, #dc087d 34%, transparent);
}

.ng-text[_ngcontent-%COMP%] {
  background: linear-gradient(90deg, #ff4d75 0%, #f23d9a 45%, #c06bf5 80%, #a98bff 100%);
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
}
@media (prefers-color-scheme: light) {
  :root:not([data-theme=dark])   [_nghost-%COMP%]   .ng-text[_ngcontent-%COMP%] {
    background-image: linear-gradient(90deg, #be123c 0%, #a21caf 50%, #6d28d9 100%);
  }
}
:root[data-theme=light]   [_nghost-%COMP%]   .ng-text[_ngcontent-%COMP%] {
  background-image: linear-gradient(90deg, #be123c 0%, #a21caf 50%, #6d28d9 100%);
}

nav[_ngcontent-%COMP%] {
  position: relative;
  display: flex;
  flex: 0 1 auto;
  flex-wrap: nowrap;
  gap: 2px;
  min-width: 0;
  height: 34px;
  padding: 2px;
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-x: contain;
  scroll-padding-inline: 24px;
  scrollbar-width: none;
  border: 1px solid var(--%NS%border);
  border-radius: 10px;
  background: var(--%NS%bg);
}

nav[_ngcontent-%COMP%]::-webkit-scrollbar {
  display: none;
}

nav.fade-start[_ngcontent-%COMP%] {
  mask-image: linear-gradient(90deg, transparent, #000 28px);
}

nav.fade-end[_ngcontent-%COMP%] {
  mask-image: linear-gradient(90deg, #000 calc(100% - 28px), transparent);
}

nav.fade-start.fade-end[_ngcontent-%COMP%] {
  mask-image: linear-gradient(90deg, transparent, #000 28px, #000 calc(100% - 28px), transparent);
}

nav[_ngcontent-%COMP%]:empty {
  display: none;
}

nav[_ngcontent-%COMP%]   button[_ngcontent-%COMP%] {
  position: relative;
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  height: 28px;
  padding: 0 10px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--%NS%text-2);
  font: inherit;
  font-size: 13px;
  font-weight: 500;
  line-height: 1;
  white-space: nowrap;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: background-color 0.16s var(--%NS%ease), color 0.16s var(--%NS%ease), box-shadow 0.16s var(--%NS%ease), transform 0.12s var(--%NS%ease);
}

nav[_ngcontent-%COMP%]   button[_ngcontent-%COMP%]   app-tab-icon[_ngcontent-%COMP%] {
  color: var(--%NS%text-3);
  transition: color 0.16s var(--%NS%ease);
}

nav[_ngcontent-%COMP%]   button[_ngcontent-%COMP%]:hover {
  background: var(--%NS%surface-2);
  color: var(--%NS%text);
}

nav[_ngcontent-%COMP%]   button[_ngcontent-%COMP%]:hover   app-tab-icon[_ngcontent-%COMP%] {
  color: var(--%NS%text-2);
}

nav[_ngcontent-%COMP%]   button[_ngcontent-%COMP%]:active {
  transform: scale(0.97);
}

nav[_ngcontent-%COMP%]   button.active[_ngcontent-%COMP%] {
  background: var(--%NS%surface-3);
  color: var(--%NS%text-strong);
  box-shadow: inset 0 0 0 1px var(--%NS%border-strong), 0 4px 14px -8px rgba(0, 0, 0, 0.9);
}

nav[_ngcontent-%COMP%]   button.active[_ngcontent-%COMP%]   app-tab-icon[_ngcontent-%COMP%] {
  color: var(--%NS%accent);
}

nav[_ngcontent-%COMP%]   button[_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: -2px;
}

.status[_ngcontent-%COMP%] {
  display: inline-flex;
  flex-shrink: 0;
  align-items: center;
  gap: 6px;
  height: 24px;
  margin-left: auto;
  padding: 0 10px 0 6px;
  border: 1px solid var(--%NS%border);
  border-radius: 999px;
  background: var(--%NS%surface);
  color: var(--%NS%text-2);
  font-size: 11px;
  font-weight: 600;
  line-height: 1;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  white-space: nowrap;
  transition: color 0.2s var(--%NS%ease), border-color 0.2s var(--%NS%ease), background-color 0.2s var(--%NS%ease);
}

.dot[_ngcontent-%COMP%] {
  position: relative;
  display: grid;
  place-items: center;
  width: 12px;
  height: 12px;
}

.dot[_ngcontent-%COMP%]   span[_ngcontent-%COMP%] {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--%NS%warn);
  animation: _ngcontent-%COMP%_blink 1.2s ease-in-out infinite;
}

.dot[_ngcontent-%COMP%]::before {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: var(--%NS%warn);
  opacity: 0;
}

.status.connected[_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%ok) 28%, transparent);
  background: color-mix(in srgb, var(--%NS%ok) 8%, transparent);
  color: var(--%NS%text);
}

.status.connected[_ngcontent-%COMP%]   .dot[_ngcontent-%COMP%]   span[_ngcontent-%COMP%] {
  background: var(--%NS%ok);
  box-shadow: 0 0 6px var(--%NS%ok);
  animation: none;
}

.status.failed[_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%danger) 36%, transparent);
  color: var(--%NS%text);
}

.status.failed[_ngcontent-%COMP%]   .dot[_ngcontent-%COMP%]   span[_ngcontent-%COMP%] {
  background: var(--%NS%danger);
  animation: none;
}

.status.connected[_ngcontent-%COMP%]   .dot[_ngcontent-%COMP%]::before {
  background: var(--%NS%ok);
  animation: _ngcontent-%COMP%_ping 2s var(--%NS%ease) infinite;
}

@keyframes _ngcontent-%COMP%_blink {
  50% {
    opacity: 0.3;
  }
}
@keyframes _ngcontent-%COMP%_ping {
  0% {
    transform: scale(0.5);
    opacity: 0.55;
  }
  80%, 100% {
    transform: scale(1.6);
    opacity: 0;
  }
}
main[_ngcontent-%COMP%] {
  flex: 1;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  padding: 20px;
}

main[_ngcontent-%COMP%]:focus {
  outline: none;
}

main[_ngcontent-%COMP%]    > *[_ngcontent-%COMP%] {
  animation: enter 0.28s var(--%NS%ease) both;
}

.background-note[_ngcontent-%COMP%] {
  margin: 0 0 12px;
  color: var(--%NS%text-2);
  font-size: 12px;
}
.background-note[_ngcontent-%COMP%]:empty {
  display: none;
}

.turned-off[_ngcontent-%COMP%] {
  max-width: 60ch;
  margin: 0;
  padding: 12px 14px;
  border: 1px solid var(--%NS%border);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  color: var(--%NS%text);
}

.connection-error[_ngcontent-%COMP%] {
  max-width: 60ch;
  margin: 0;
  padding: 12px 14px;
  border: 1px solid color-mix(in srgb, var(--%NS%danger) 36%, transparent);
  border-radius: var(--%NS%radius);
  background: var(--%NS%surface);
  color: var(--%NS%text);
}

@media (max-width: 720px) {
  header[_ngcontent-%COMP%] {
    flex-wrap: wrap;
    height: auto;
    padding: 8px 16px;
  }
  nav[_ngcontent-%COMP%] {
    order: 3;
    flex: 1 1 100%;
  }
}
@media (max-width: 560px) {
  header[_ngcontent-%COMP%] {
    padding-inline: 12px;
  }
  main[_ngcontent-%COMP%] {
    padding: 16px 12px;
  }
}
@media (max-width: 400px) {
  .brand[_ngcontent-%COMP%] {
    flex-shrink: 1;
    gap: 8px;
  }
}`]})}).catch(console.error);export{Kx as t};