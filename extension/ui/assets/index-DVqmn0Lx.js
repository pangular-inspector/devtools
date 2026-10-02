(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=Object.defineProperty,t=Object.getOwnPropertySymbols,n=Object.prototype.hasOwnProperty,r=Object.prototype.propertyIsEnumerable,i=(t,n,r)=>n in t?e(t,n,{enumerable:!0,configurable:!0,writable:!0,value:r}):t[n]=r,a=(e,a)=>{for(var o in a||={})n.call(a,o)&&i(e,o,a[o]);if(t)for(var o of t(a))r.call(a,o)&&i(e,o,a[o]);return e},o=(e,t,n)=>(i(e,typeof t==`symbol`?t:t+``,n),n),s=globalThis;function c(e){let t=s.__Zone_symbol_prefix;return(typeof t==`string`?t:`__zone_symbol__`)+e}function l(){let e=s.performance;function t(t){e&&e.mark&&e.mark(t)}function n(t,n){e&&e.measure&&e.measure(t,n)}t(`Zone`);let r=class e{constructor(e,t){o(this,`_parent`),o(this,`_name`),o(this,`_properties`),o(this,`_zoneDelegate`),this._parent=e,this._name=t?t.name||`unnamed`:`<root>`,this._properties=t&&t.properties||{},this._zoneDelegate=new l(this,this._parent&&this._parent._zoneDelegate,t)}static assertZonePatched(){if(s.Promise!==fe.ZoneAwarePromise)throw Error("Zone.js has detected that ZoneAwarePromise `(window|global).Promise` has been overwritten.\nMost likely cause is that a Promise polyfill has been loaded after Zone.js (Polyfilling Promise api is not necessary when zone.js is loaded. If you must load one, do so before loading zone.js.)")}static get root(){let t=e.current;for(;t.parent;)t=t.parent;return t}static get current(){return me.zone}static get currentTask(){return he}static __load_patch(r,i,a=!1){if(Object.hasOwn(fe,r)){let e=s[c(`forceDuplicateZoneCheck`)]===!0;if(!a&&e)throw Error(`Already loaded patch: `+r)}else if(!s[`__Zone_disable_`+r]){let a=`Zone:`+r;t(a),fe[r]=i(s,e,pe),n(a,a)}}get parent(){return this._parent}get name(){return this._name}get(e){let t=this.getZoneWith(e);if(t)return t._properties[e]}getZoneWith(e){let t=this;for(;t;){if(Object.hasOwn(t._properties,e))return t;t=t._parent}return null}fork(e){if(!e)throw Error(`ZoneSpec required!`);return this._zoneDelegate.fork(this,e)}wrap(e,t){if(typeof e!=`function`)throw Error(`Expecting function got: `+e);let n=this._zoneDelegate.intercept(this,e,t),r=this;return function(){return r.runGuarded(n,this,arguments,t)}}run(e,t,n,r){me={parent:me,zone:this};try{return this._zoneDelegate.invoke(this,e,t,n,r)}finally{me=me.parent}}runGuarded(e,t=null,n,r){me={parent:me,zone:this};try{try{return this._zoneDelegate.invoke(this,e,t,n,r)}catch(e){if(this._zoneDelegate.handleError(this,e))throw e}}finally{me=me.parent}}runTask(e,t,n){if(e.zone!=this)throw Error(`A task can only be run in the zone of creation! (Creation: `+(e.zone||ne).name+`; Execution: `+this.name+`)`);let r=e,{type:i,data:{isPeriodic:a=!1,isRefreshable:o=!1}={}}=e;if(e.state===re&&(i===de||i===ue))return;let s=e.state!=oe;s&&r._transitionTo(oe,ae);let c=he;he=r,me={parent:me,zone:this};try{i==ue&&e.data&&!a&&!o&&(e.cancelFn=void 0);try{return this._zoneDelegate.invokeTask(this,r,t,n)}catch(e){if(this._zoneDelegate.handleError(this,e))throw e}}finally{let t=e.state;if(t!==re&&t!==ce){if(i==de||a||o&&t===ie)s&&r._transitionTo(ae,oe,ie);else{let e=r._zoneDelegates;this._updateTaskCount(r,-1),s&&r._transitionTo(re,oe,re),o&&(r._zoneDelegates=e)}}me=me.parent,he=c}}scheduleTask(e){if(e.zone&&e.zone!==this){let t=this;for(;t;){if(t===e.zone)throw Error(`can not reschedule task to ${this.name} which is descendants of the original zone ${e.zone.name}`);t=t.parent}}e._transitionTo(ie,re);let t=[];e._zoneDelegates=t,e._zone=this;try{e=this._zoneDelegate.scheduleTask(this,e)}catch(t){throw e._transitionTo(ce,ie,re),this._zoneDelegate.handleError(this,t),t}return e._zoneDelegates===t&&this._updateTaskCount(e,1),e.state==ie&&e._transitionTo(ae,ie),e}scheduleMicroTask(e,t,n,r){return this.scheduleTask(new u(le,e,t,n,r,void 0))}scheduleMacroTask(e,t,n,r,i){return this.scheduleTask(new u(ue,e,t,n,r,i))}scheduleEventTask(e,t,n,r,i){return this.scheduleTask(new u(de,e,t,n,r,i))}cancelTask(e){if(e.zone!=this)throw Error(`A task can only be cancelled in the zone of creation! (Creation: `+(e.zone||ne).name+`; Execution: `+this.name+`)`);if(e.state===ae||e.state===oe){e._transitionTo(se,ae,oe);try{this._zoneDelegate.cancelTask(this,e)}catch(t){throw e._transitionTo(ce,se),this._zoneDelegate.handleError(this,t),t}return this._updateTaskCount(e,-1),e._transitionTo(re,se),e.runCount=-1,e}}_updateTaskCount(e,t){let n=e._zoneDelegates;t==-1&&(e._zoneDelegates=null);for(let r=0;r<n.length;r++)n[r]._updateTaskCount(e.type,t)}};o(r,`__symbol__`,c);let i=r,a={name:``,onHasTask:(e,t,n,r)=>e.hasTask(n,r),onScheduleTask:(e,t,n,r)=>e.scheduleTask(n,r),onInvokeTask:(e,t,n,r,i,a)=>e.invokeTask(n,r,i,a),onCancelTask:(e,t,n,r)=>e.cancelTask(n,r)};class l{constructor(e,t,n){o(this,`_zone`),o(this,`_taskCounts`,{microTask:0,macroTask:0,eventTask:0}),o(this,`_forkDlgt`),o(this,`_forkZS`),o(this,`_forkCurrZone`),o(this,`_interceptDlgt`),o(this,`_interceptZS`),o(this,`_interceptCurrZone`),o(this,`_invokeDlgt`),o(this,`_invokeZS`),o(this,`_invokeCurrZone`),o(this,`_handleErrorDlgt`),o(this,`_handleErrorZS`),o(this,`_handleErrorCurrZone`),o(this,`_scheduleTaskDlgt`),o(this,`_scheduleTaskZS`),o(this,`_scheduleTaskCurrZone`),o(this,`_invokeTaskDlgt`),o(this,`_invokeTaskZS`),o(this,`_invokeTaskCurrZone`),o(this,`_cancelTaskDlgt`),o(this,`_cancelTaskZS`),o(this,`_cancelTaskCurrZone`),o(this,`_hasTaskDlgt`),o(this,`_hasTaskDlgtOwner`),o(this,`_hasTaskZS`),o(this,`_hasTaskCurrZone`),this._zone=e,this._forkZS=n&&(n&&n.onFork?n:t._forkZS),this._forkDlgt=n&&(n.onFork?t:t._forkDlgt),this._forkCurrZone=n&&(n.onFork?this._zone:t._forkCurrZone),this._interceptZS=n&&(n.onIntercept?n:t._interceptZS),this._interceptDlgt=n&&(n.onIntercept?t:t._interceptDlgt),this._interceptCurrZone=n&&(n.onIntercept?this._zone:t._interceptCurrZone),this._invokeZS=n&&(n.onInvoke?n:t._invokeZS),this._invokeDlgt=n&&(n.onInvoke?t:t._invokeDlgt),this._invokeCurrZone=n&&(n.onInvoke?this._zone:t._invokeCurrZone),this._handleErrorZS=n&&(n.onHandleError?n:t._handleErrorZS),this._handleErrorDlgt=n&&(n.onHandleError?t:t._handleErrorDlgt),this._handleErrorCurrZone=n&&(n.onHandleError?this._zone:t._handleErrorCurrZone),this._scheduleTaskZS=n&&(n.onScheduleTask?n:t._scheduleTaskZS),this._scheduleTaskDlgt=n&&(n.onScheduleTask?t:t._scheduleTaskDlgt),this._scheduleTaskCurrZone=n&&(n.onScheduleTask?this._zone:t._scheduleTaskCurrZone),this._invokeTaskZS=n&&(n.onInvokeTask?n:t._invokeTaskZS),this._invokeTaskDlgt=n&&(n.onInvokeTask?t:t._invokeTaskDlgt),this._invokeTaskCurrZone=n&&(n.onInvokeTask?this._zone:t._invokeTaskCurrZone),this._cancelTaskZS=n&&(n.onCancelTask?n:t._cancelTaskZS),this._cancelTaskDlgt=n&&(n.onCancelTask?t:t._cancelTaskDlgt),this._cancelTaskCurrZone=n&&(n.onCancelTask?this._zone:t._cancelTaskCurrZone),this._hasTaskZS=null,this._hasTaskDlgt=null,this._hasTaskDlgtOwner=null,this._hasTaskCurrZone=null;let r=n&&n.onHasTask,i=t&&t._hasTaskZS;(r||i)&&(this._hasTaskZS=r?n:a,this._hasTaskDlgt=t,this._hasTaskDlgtOwner=this,this._hasTaskCurrZone=this._zone,n.onScheduleTask||(this._scheduleTaskZS=a,this._scheduleTaskDlgt=t,this._scheduleTaskCurrZone=this._zone),n.onInvokeTask||(this._invokeTaskZS=a,this._invokeTaskDlgt=t,this._invokeTaskCurrZone=this._zone),n.onCancelTask||(this._cancelTaskZS=a,this._cancelTaskDlgt=t,this._cancelTaskCurrZone=this._zone))}get zone(){return this._zone}fork(e,t){return this._forkZS?this._forkZS.onFork(this._forkDlgt,this.zone,e,t):new i(e,t)}intercept(e,t,n){return this._interceptZS?this._interceptZS.onIntercept(this._interceptDlgt,this._interceptCurrZone,e,t,n):t}invoke(e,t,n,r,i){return this._invokeZS?this._invokeZS.onInvoke(this._invokeDlgt,this._invokeCurrZone,e,t,n,r,i):t.apply(n,r)}handleError(e,t){return!this._handleErrorZS||this._handleErrorZS.onHandleError(this._handleErrorDlgt,this._handleErrorCurrZone,e,t)}scheduleTask(e,t){let n=t;if(this._scheduleTaskZS)this._hasTaskZS&&n._zoneDelegates.push(this._hasTaskDlgtOwner),n=this._scheduleTaskZS.onScheduleTask(this._scheduleTaskDlgt,this._scheduleTaskCurrZone,e,t),n||=t;else if(t.scheduleFn)t.scheduleFn(t);else if(t.type==le)v(t);else throw Error(`Task is missing scheduleFn.`);return n}invokeTask(e,t,n,r){return this._invokeTaskZS?this._invokeTaskZS.onInvokeTask(this._invokeTaskDlgt,this._invokeTaskCurrZone,e,t,n,r):t.callback.apply(n,r)}cancelTask(e,t){let n;if(this._cancelTaskZS)n=this._cancelTaskZS.onCancelTask(this._cancelTaskDlgt,this._cancelTaskCurrZone,e,t);else{if(!t.cancelFn)throw Error(`Task is not cancelable`);n=t.cancelFn(t)}return n}hasTask(e,t){try{this._hasTaskZS&&this._hasTaskZS.onHasTask(this._hasTaskDlgt,this._hasTaskCurrZone,e,t)}catch(t){this.handleError(e,t)}}_updateTaskCount(e,t){let n=this._taskCounts,r=n[e],i=n[e]=r+t;if(i<0)throw Error(`More tasks executed then were scheduled.`);if(r==0||i==0){let t={microTask:n.microTask>0,macroTask:n.macroTask>0,eventTask:n.eventTask>0,change:e};this.hasTask(this._zone,t)}}}class u{constructor(e,t,n,r,i,a){if(o(this,`type`),o(this,`source`),o(this,`invoke`),o(this,`callback`),o(this,`data`),o(this,`scheduleFn`),o(this,`cancelFn`),o(this,`_zone`,null),o(this,`runCount`,0),o(this,`_zoneDelegates`,null),o(this,`_state`,`notScheduled`),this.type=e,this.source=t,this.data=r,this.scheduleFn=i,this.cancelFn=a,!n)throw Error(`callback is not defined`);this.callback=n;let c=this;this.invoke=e===de&&r&&r.useG?u.invokeTask:function(){return u.invokeTask.call(s,c,this,arguments)}}static invokeTask(e,t,n){e||=this,ge++;try{return e.runCount++,e.zone.runTask(e,t,n)}finally{try{ge===1&&!s[m]&&te()}finally{ge--}}}get zone(){return this._zone}get state(){return this._state}cancelScheduleRequest(){this._transitionTo(re,ie)}_transitionTo(e,t,n){if(this._state===t||this._state===n)this._state=e,e==re&&(this._zoneDelegates=null);else throw Error(`${this.type} '${this.source}': can not transition to '${e}', expecting state '${t}'${n?` or '`+n+`'`:``}, was '${this._state}'.`)}toString(){return this.data&&this.data.handleId!==void 0?this.data.handleId.toString():Object.prototype.toString.call(this)}toJSON(){return{type:this.type,state:this.state,source:this.source,zone:this.zone.name,runCount:this.runCount}}}let d=c(`setTimeout`),f=c(`Promise`),p=c(`then`),m=c(`enable_native_microtask_draining`),h=[],g=!1,_;function ee(e){!_&&s[f]&&(_=s[f].resolve(0)),_?(_[p]??_.then).call(_,e):s[d](e,0)}function v(e){let t=s[m],n=t&&h.length===0&&!g,r=!t&&ge===0&&h.length===0;(n||r)&&ee(te),e&&h.push(e)}function te(){if(!g){g=!0;try{for(;h.length;){let e=h;h=[];for(let t of e)try{t.zone.runTask(t,null,null)}catch(e){pe.onUnhandledError(e)}}}finally{if(s[m])g=!1,pe.microtaskDrainDone();else try{pe.microtaskDrainDone()}finally{g=!1}}}}let ne={name:`NO ZONE`},re=`notScheduled`,ie=`scheduling`,ae=`scheduled`,oe=`running`,se=`canceling`,ce=`unknown`,le=`microTask`,ue=`macroTask`,de=`eventTask`,fe=Object.create(null),pe={symbol:c,currentZoneFrame:()=>me,onUnhandledError:_e,microtaskDrainDone:_e,scheduleMicroTask:v,showUncaughtError:()=>!i[c(`ignoreConsoleErrorUncaughtError`)],patchEventTarget:()=>[],patchOnProperties:_e,patchMethod:()=>_e,bindArguments:()=>[],patchThen:()=>_e,patchMacroTask:()=>_e,patchEventPrototype:()=>_e,getGlobalObjects:()=>void 0,ObjectDefineProperty:()=>_e,ObjectGetOwnPropertyDescriptor:()=>void 0,ObjectCreate:()=>void 0,ArraySlice:()=>[],patchClass:()=>_e,wrapWithCurrentZone:()=>_e,filterProperties:()=>[],attachOriginToPatched:()=>_e,_redefineProperty:()=>_e,patchCallbacks:()=>_e,nativeScheduleMicroTask:ee},me={parent:null,zone:new i(null,null)},he=null,ge=0;function _e(){}return n(`Zone`,`Zone`),i}function u(){let e=globalThis,t=e[c(`forceDuplicateZoneCheck`)]===!0;if(e.Zone&&(t||typeof e.Zone.__symbol__!=`function`))throw Error(`Zone already loaded.`);return e.Zone??=l(),e.Zone}var d=Object.getOwnPropertyDescriptor,f=Object.defineProperty,p=Object.getPrototypeOf,m=Object.create,h=Array.prototype.slice,g=`addEventListener`,_=`removeEventListener`,ee=c(g),v=c(_),te=`true`,ne=`false`,re=c(``);function ie(e,t){return Zone.current.wrap(e,t)}function ae(e,t,n,r,i){return Zone.current.scheduleMacroTask(e,t,n,r,i)}var oe=c,se=typeof window<`u`,ce=se?window:void 0,le=se&&ce||globalThis,ue=`removeAttribute`;function de(e,t){for(let n=e.length-1;n>=0;n--)typeof e[n]==`function`&&(e[n]=ie(e[n],t+`_`+n));return e}function fe(e,t){let n=e.constructor.name;for(let r=0;r<t.length;r++){let i=t[r],a=e[i];if(a){if(!pe(d(e,i)))continue;e[i]=(e=>{let t=function(){return e.apply(this,de(arguments,n+`.`+i))};return De(t,e),t})(a)}}}function pe(e){return e?e.writable===!1?!1:typeof e.get!=`function`||e.set!==void 0:!0}var me=typeof WorkerGlobalScope<`u`&&self instanceof WorkerGlobalScope,he=!(`nw`in le)&&le.process!==void 0&&le.process.toString()===`[object process]`,ge=!he&&!me&&!!(se&&ce.HTMLElement),_e=le.process!==void 0&&le.process.toString()===`[object process]`&&!me&&!!(se&&ce.HTMLElement),ve=Object.create(null),ye=oe(`enable_beforeunload`),be=function(e){if(e||=le.event,!e)return;let t=ve[e.type];t||=ve[e.type]=oe(`ON_PROPERTY`+e.type);let n=this||e.target||le,r=n[t],i;if(ge&&n===ce&&e.type===`error`){let t=e;i=r&&r.call(this,t.message,t.filename,t.lineno,t.colno,t.error),i===!0&&e.preventDefault()}else i=r&&r.apply(this,arguments),e.type===`beforeunload`&&le[ye]&&typeof i==`string`?e.returnValue=i:i!=null&&!i&&e.preventDefault();return i};function xe(e,t,n){let r=d(e,t);if(!r&&n&&d(n,t)&&(r={enumerable:!0,configurable:!0}),!r||!r.configurable)return;let i=oe(`on`+t+`patched`);if(Object.hasOwn(e,i)&&e[i])return;delete r.writable,delete r.value;let a=r.get,o=r.set,s=t.slice(2),c=ve[s];c||=ve[s]=oe(`ON_PROPERTY`+s),r.set=function(t){let n=this;!n&&e===le&&(n=le),n&&(typeof n[c]==`function`&&n.removeEventListener(s,be),o?.call(n,null),n[c]=t,typeof t==`function`&&n.addEventListener(s,be,!1))},r.get=function(){let n=this;if(!n&&e===le&&(n=le),!n)return null;let i=n[c];if(i)return i;if(a){let e=a.call(this);if(e)return r.set.call(this,e),typeof n[ue]==`function`&&n.removeAttribute(t),e}return null},f(e,t,r),e[i]=!0}function Se(e,t,n){if(t)for(let r=0;r<t.length;r++)xe(e,`on`+t[r],n);else{let t=[];for(let n in e)n.slice(0,2)==`on`&&t.push(n);for(let r=0;r<t.length;r++)xe(e,t[r],n)}}var Ce=oe(`originalInstance`);function we(e){let t=le[e];if(!t)return;le[oe(e)]=t,le[e]=function(){let n=de(arguments,e);switch(n.length){case 0:this[Ce]=new t;break;case 1:this[Ce]=new t(n[0]);break;case 2:this[Ce]=new t(n[0],n[1]);break;case 3:this[Ce]=new t(n[0],n[1],n[2]);break;case 4:this[Ce]=new t(n[0],n[1],n[2],n[3]);break;default:throw Error(`Arg list too long.`)}},De(le[e],t);let n=new t(function(){}),r;for(r in n)(e!==`XMLHttpRequest`||r!==`responseBlob`)&&(function(t){typeof n[t]==`function`?le[e].prototype[t]=function(){return this[Ce][t].apply(this[Ce],arguments)}:f(le[e].prototype,t,{set:function(n){typeof n==`function`?(this[Ce][t]=ie(n,e+`.`+t),De(this[Ce][t],n)):this[Ce][t]=n},get:function(){return this[Ce][t]}})})(r);for(r in t)r!==`prototype`&&Object.hasOwn(t,r)&&(le[e][r]=t[r])}function Te(e,t,n){let r=e;for(;r&&!Object.hasOwn(r,t);)r=p(r);!r&&e[t]&&(r=e);let i=oe(t),a=null;if(r&&(!(a=r[i])||!Object.hasOwn(r,i))&&(a=r[i]=r[t],pe(r&&d(r,t)))){let e=n(a,i,t);r[t]=function(){return e(this,arguments)},De(r[t],a)}return a}function Ee(e,t,n){let r=null;function i(e){let t=e.data;return t.args[t.cbIdx]=function(){e.invoke.apply(this,arguments)},r.apply(t.target,t.args),e}r=Te(e,t,e=>function(t,r){let a=n(t,r);return a.cbIdx>=0&&typeof r[a.cbIdx]==`function`?ae(a.name,r[a.cbIdx],a,i):e.apply(t,r)})}function De(e,t){e[oe(`OriginalDelegate`)]=t}function Oe(e){return typeof e==`function`}function ke(e){return typeof e==`number`}var Ae={useG:!0},je=Object.create(null),Me={},Ne=RegExp(`^`+re+`(\\w+)(true|false)$`),Pe=oe(`propagationStopped`),Fe=[`capture`,`once`,`passive`,`signal`];function Ie(e,t){let n=(t?t(e):e)+ne,r=(t?t(e):e)+te,i=re+n,a=re+r;je[e]={[ne]:i,[te]:a}}function Le(e,t,n,r){let i=r&&r.add||g,o=r&&r.rm||_,s=r&&r.listeners||`eventListeners`,c=r&&r.rmAll||`removeAllListeners`,l=oe(i),u=`.`+i+`:`,d=function(e,t,n){if(e.isRemoved)return;let r=e.callback;typeof r==`object`&&r.handleEvent&&(e.callback=e=>r.handleEvent(e),e.originalDelegate=r);let i;try{e.invoke(e,t,[n])}catch(e){i=e}let a=e.options;if(a&&typeof a==`object`&&a.once){let r=e.originalDelegate?e.originalDelegate:e.callback;t[o].call(t,n.type,r,a)}return i};function f(n,r,i){if(r||=e.event,!r)return;let a=n||r.target||e,o=a[je[r.type][i?te:ne]];if(o){let e=[];if(o.length===1){let t=d(o[0],a,r);t&&e.push(t)}else{let t=o.slice();for(let n=0;n<t.length&&!(r&&r[Pe]===!0);n++){let i=d(t[n],a,r);i&&e.push(i)}}if(e.length===1)throw e[0];for(let n=0;n<e.length;n++){let r=e[n];t.nativeScheduleMicroTask(()=>{throw r})}}}let m=function(e){return f(this,e,!1)},h=function(e){return f(this,e,!0)};function ee(t,n){if(!t)return!1;let r=!0;n&&n.useG!==void 0&&(r=n.useG);let d=n&&n.vh,f=!0;n&&n.chkDup!==void 0&&(f=n.chkDup);let g=!1;n&&n.rt!==void 0&&(g=n.rt);let _=t;for(;_&&!Object.hasOwn(_,i);)_=p(_);if(!_&&t[i]&&(_=t),!_||_[l])return!1;let ee=n&&n.eventNameToString,v={},ie=_[l]=_[i],ae=_[oe(o)]=_[o],se=_[oe(s)]=_[s],ce=_[oe(c)]=_[c],le;n&&n.prepend&&(le=_[oe(n.prepend)]=_[n.prepend]);function ue(e,t){return t?typeof e==`boolean`?{capture:e,passive:!0}:e?(typeof e==`object`&&e.passive!==!1&&(e.passive=!0),e):{passive:!0}:e}let de=function(e){if(!v.isExisting)return ie.call(v.target,v.eventName,v.capture?h:m,v.options)},fe=function(e){if(!e.isRemoved){let t=je[e.eventName],n;t&&(n=t[e.capture?te:ne]);let r=n&&e.target[n];if(r){for(let t=0;t<r.length;t++)if(r[t]===e){r.splice(t,1),e.isRemoved=!0,e.removeAbortListener&&=(e.removeAbortListener(),null),r.length===0&&(e.allRemoved=!0,e.target[n]=null);break}}}if(e.allRemoved)return ae.call(e.target,e.eventName,e.capture?h:m,e.options)},pe=function(e){return ie.call(v.target,v.eventName,e.invoke,v.options)},me=function(e){return le.call(v.target,v.eventName,e.invoke,v.options)},ge=function(e){return ae.call(e.target,e.eventName,e.invoke,e.options)},_e=r?de:pe,ve=r?fe:ge,ye=n?.diff||function(e,t){let n=typeof t;return n===`function`&&e.callback===t||n===`object`&&e.originalDelegate===t},be=Zone[oe(`UNPATCHED_EVENTS`)],xe=e[oe(`PASSIVE_EVENTS`)];function Se(e){if(typeof e!=`object`||!e)return e;let t=a({},e);for(let n of Fe)!Object.hasOwn(t,n)&&n in e&&(t[n]=e[n]);return t}let Ce=function(t,i,a,o,s=!1,c=!1){return function(){let l=this||e,u=arguments[0];n&&n.transferEventName&&(u=n.transferEventName(u));let p=arguments[1];if(!p||he&&u===`uncaughtException`)return t.apply(this,arguments);let m=!1;if(typeof p!=`function`){if(!p.handleEvent)return t.apply(this,arguments);m=!0}if(d&&!d(t,p,l,arguments))return;let h=!!xe&&xe.indexOf(u)!==-1,g=ue(Se(arguments[2]),h),_=g?.signal;if(_?.aborted)return;if(be){for(let e=0;e<be.length;e++)if(u===be[e])return h?t.call(l,u,p,g):t.apply(this,arguments)}let re=g?typeof g==`boolean`||g.capture:!1,ie=g&&typeof g==`object`?g.once:!1,ae=Zone.current,oe=je[u];oe||=(Ie(u,ee),je[u]);let se=oe[re?te:ne],ce=l[se],le=!1;if(ce){if(le=!0,f){for(let e=0;e<ce.length;e++)if(ye(ce[e],p))return}}else ce=l[se]=[];let de,fe=l.constructor.name,pe=Me[fe];pe&&(de=pe[u]),de||=fe+i+(ee?ee(u):u),v.options=g,ie&&(v.options.once=!1),v.target=l,v.capture=re,v.eventName=u,v.isExisting=le;let me=r?Ae:void 0;me&&(me.taskData=v),_&&(v.options.signal=void 0);let ge=ae.scheduleEventTask(de,p,me,a,o);if(_){v.options.signal=_;let e=()=>ge.zone.cancelTask(ge);t.call(_,`abort`,e,{once:!0}),ge.removeAbortListener=()=>_.removeEventListener(`abort`,e)}if(v.target=null,me&&(me.taskData=null),ie&&(v.options.once=!0),typeof ge.options!=`boolean`&&(ge.options=g),ge.target=l,ge.capture=re,ge.eventName=u,m&&(ge.originalDelegate=p),c?ce.unshift(ge):ce.push(ge),s)return l}};return _[i]=Ce(ie,u,_e,ve,g),le&&(_.prependListener=Ce(le,`.prependListener:`,me,ve,g,!0)),_[o]=function(){let t=this||e,r=arguments[0];n&&n.transferEventName&&(r=n.transferEventName(r));let i=arguments[2],a=i?typeof i==`boolean`||i.capture:!1,o=arguments[1];if(!o)return ae.apply(this,arguments);if(d&&!d(ae,o,t,arguments))return;let s=je[r],c;s&&(c=s[a?te:ne]);let l=c&&t[c];if(l)for(let e=0;e<l.length;e++){let n=l[e];if(ye(n,o)){if(l.splice(e,1),n.isRemoved=!0,l.length===0&&(n.allRemoved=!0,t[c]=null,!a&&typeof r==`string`)){let e=re+`ON_PROPERTY`+r;t[e]=null}return n.zone.cancelTask(n),g?t:void 0}}return ae.apply(this,arguments)},_[s]=function(){let t=this||e,r=arguments[0];n&&n.transferEventName&&(r=n.transferEventName(r));let i=[],a=Re(t,ee?ee(r):r);for(let e=0;e<a.length;e++){let t=a[e],n=t.originalDelegate?t.originalDelegate:t.callback;i.push(n)}return i},_[c]=function(){let t=this||e,r=arguments[0];if(r){n&&n.transferEventName&&(r=n.transferEventName(r));let e=je[r];if(e){let n=e[ne],i=e[te],a=t[n],s=t[i];if(a){let e=a.slice();for(let t=0;t<e.length;t++){let n=e[t],i=n.originalDelegate?n.originalDelegate:n.callback;this[o].call(this,r,i,n.options)}}if(s){let e=s.slice();for(let t=0;t<e.length;t++){let n=e[t],i=n.originalDelegate?n.originalDelegate:n.callback;this[o].call(this,r,i,n.options)}}}}else{let e=Object.keys(t);for(let t=0;t<e.length;t++){let n=e[t],r=Ne.exec(n),i=r&&r[1];i&&i!==`removeListener`&&this[c].call(this,i)}this[c].call(this,`removeListener`)}if(g)return this},De(_[i],ie),De(_[o],ae),ce&&De(_[c],ce),se&&De(_[s],se),!0}let v=[];for(let e=0;e<n.length;e++)v[e]=ee(n[e],r);return v}function Re(e,t){if(!t){let n=[];for(let r in e){let i=Ne.exec(r),a=i&&i[1];if(a&&(!t||a===t)){let t=e[r];if(t)for(let e=0;e<t.length;e++)n.push(t[e])}}return n}let n=je[t];n||=(Ie(t),je[t]);let r=e[n[ne]],i=e[n[te]];return r?i?r.concat(i):r.slice():i?i.slice():[]}function ze(e,t){let n=e.Event;n&&n.prototype&&t.patchMethod(n.prototype,`stopImmediatePropagation`,e=>function(t,n){t[Pe]=!0,e&&e.apply(t,n)})}function Be(e,t){t.patchMethod(e,`queueMicrotask`,e=>function(e,t){Zone.current.scheduleMicroTask(`queueMicrotask`,t[0])})}var Ve=oe(`zoneTask`);function He(e,t,n,r){let i=null,a=null;t+=r,n+=r;let o={};function s(t){let n=t.data;n.args[0]=function(){return t.invoke.apply(this,arguments)};let r=i.apply(e,n.args);return ke(r)?n.handleId=r:(n.handle=r,n.isRefreshable=Oe(r?.refresh)),t}function c(t){let{handle:n,handleId:r}=t.data;return a.call(e,n??r)}i=Te(e,t,n=>function(i,a){if(Oe(a[0])){let e={isRefreshable:!1,isPeriodic:r===`Interval`,delay:r===`Timeout`||r===`Interval`?a[1]||0:void 0,args:a},n=a[0];a[0]=function(){try{return n.apply(this,arguments)}finally{let{handle:t,handleId:n,isPeriodic:r,isRefreshable:i}=e;!r&&!i&&(n?delete o[n]:t&&(t[Ve]=null))}};let i=ae(t,a[0],e,s,c);if(!i)return i;let{handleId:l,handle:u,isRefreshable:d,isPeriodic:f}=i.data;if(l)o[l]=i;else if(u&&(u[Ve]=i,d&&!f)){let e=u.refresh;u.refresh=function(){let{zone:t,state:n}=i;return n===`notScheduled`?(i._state=`scheduled`,t._updateTaskCount(i,1)):n===`running`&&(i._state=`scheduling`),e.call(this)}}return u??l??i}return n.apply(e,a)}),a=Te(e,n,t=>function(n,r){let i=r[0],a;ke(i)?(a=o[i],delete o[i]):(a=i?.[Ve],a?i[Ve]=null:a=i),a?.type?a.cancelFn&&a.zone.cancelTask(a):t.apply(e,r)})}function Ue(e,t){let{isBrowser:n,isMix:r}=t.getGlobalObjects();(n||r)&&e.customElements&&`customElements`in e&&t.patchCallbacks(t,e.customElements,`customElements`,`define`,[`connectedCallback`,`disconnectedCallback`,`adoptedCallback`,`attributeChangedCallback`,`formAssociatedCallback`,`formDisabledCallback`,`formResetCallback`,`formStateRestoreCallback`])}function We(e,t){if(Zone[t.symbol(`patchEventTarget`)])return;let{eventNames:n,zoneSymbolEventNames:r,TRUE_STR:i,FALSE_STR:a,ZONE_SYMBOL_PREFIX:o}=t.getGlobalObjects();for(let e=0;e<n.length;e++){let t=n[e],s=t+a,c=t+i,l=o+s,u=o+c;r[t]={},r[t][a]=l,r[t][i]=u}let s=e.EventTarget;if(s&&s.prototype)return t.patchEventTarget(e,t,[s&&s.prototype]),!0}function Ge(e,t){t.patchEventPrototype(e,t)}function Ke(e,t,n){if(!n||n.length===0)return t;let r=n.filter(t=>t.target===e);if(r.length===0)return t;let i=r[0].ignoreProperties;return t.filter(e=>i.indexOf(e)===-1)}function qe(e,t,n,r){e&&Se(e,Ke(e,t,n),r)}function Je(e){return Object.getOwnPropertyNames(e).filter(e=>e.startsWith(`on`)&&e.length>2).map(e=>e.substring(2))}function Ye(e,t){if(he&&!_e||Zone[e.symbol(`patchEvents`)])return;let n=t.__Zone_ignore_on_properties,r=[];if(ge){let e=window;r=r.concat([`Document`,`SVGElement`,`Element`,`HTMLElement`,`HTMLBodyElement`,`HTMLMediaElement`,`HTMLFrameSetElement`,`HTMLFrameElement`,`HTMLIFrameElement`,`HTMLMarqueeElement`,`Worker`]),qe(e,Je(e),n,p(e))}r=r.concat([`XMLHttpRequest`,`XMLHttpRequestEventTarget`,`IDBIndex`,`IDBRequest`,`IDBOpenDBRequest`,`IDBDatabase`,`IDBTransaction`,`IDBCursor`,`WebSocket`]);for(let e=0;e<r.length;e++){let i=t[r[e]];i!=null&&i.prototype&&qe(i.prototype,Je(i.prototype),n)}}function Xe(e){e.__load_patch(`timers`,e=>{let t=`clear`;He(e,`set`,t,`Timeout`),He(e,`set`,t,`Interval`),He(e,`set`,t,`Immediate`)}),e.__load_patch(`requestAnimationFrame`,e=>{He(e,`request`,`cancel`,`AnimationFrame`),He(e,`mozRequest`,`mozCancel`,`AnimationFrame`),He(e,`webkitRequest`,`webkitCancel`,`AnimationFrame`)}),e.__load_patch(`blocking`,(e,t)=>{let n=[`alert`,`prompt`,`confirm`];for(let r=0;r<n.length;r++){let i=n[r];Te(e,i,(n,r,i)=>function(r,a){return t.current.run(n,e,a,i)})}}),e.__load_patch(`EventTarget`,(e,t,n)=>{Ge(e,n),We(e,n);let r=e.XMLHttpRequestEventTarget;r&&r.prototype&&n.patchEventTarget(e,n,[r.prototype])}),e.__load_patch(`MutationObserver`,(e,t,n)=>{we(`MutationObserver`),we(`WebKitMutationObserver`)}),e.__load_patch(`IntersectionObserver`,(e,t,n)=>{we(`IntersectionObserver`)}),e.__load_patch(`FileReader`,(e,t,n)=>{we(`FileReader`)}),e.__load_patch(`on_property`,(e,t,n)=>{Ye(n,e)}),e.__load_patch(`customElements`,(e,t,n)=>{Ue(e,n)}),e.__load_patch(`XHR`,(e,t)=>{c(e);let n=oe(`xhrTask`),r=oe(`xhrSync`),i=oe(`xhrListener`),a=oe(`xhrScheduled`),o=oe(`xhrURL`),s=oe(`xhrErrorBeforeScheduled`);function c(e){let c=e.XMLHttpRequest;if(!c)return;let l=c.prototype;function u(e){return e[n]}let d=l[ee],f=l[v];if(!d){let t=e.XMLHttpRequestEventTarget;if(t){let e=t.prototype;d=e[ee],f=e[v]}}let p=`readystatechange`,m=`scheduled`;function h(e){let r=e.data,o=r.target;o[a]=!1,o[s]=!1;let c=o[i];d||(d=o[ee],f=o[v]),c&&f.call(o,p,c);let l=o[i]=()=>{if(o.readyState===o.DONE){if(!r.aborted&&o[a]&&e.state===m){let n=o[t.__symbol__(`loadfalse`)];if(o.status!==0&&n&&n.length>0){let i=e.invoke;e.invoke=function(){let n=o[t.__symbol__(`loadfalse`)];for(let t=0;t<n.length;t++)n[t]===e&&n.splice(t,1);!r.aborted&&e.state===m&&i.call(e)},n.push(e)}else e.invoke()}else!r.aborted&&o[a]===!1&&(o[s]=!0)}};return d.call(o,p,l),o[n]||(o[n]=e),ie.apply(o,r.args),o[a]=!0,e}function g(){}function _(e){let t=e.data;return t.aborted=!0,se.apply(t.target,t.args)}let te=Te(l,`open`,()=>function(e,t){return e[r]=t[2]==0,e[o]=t[1],te.apply(e,t)}),ne=oe(`fetchTaskAborting`),re=oe(`fetchTaskScheduling`),ie=Te(l,`send`,()=>function(e,n){if(t.current[re]===!0||e[r])return ie.apply(e,n);{let t={target:e,url:e[o],isPeriodic:!1,args:n,aborted:!1},r=ae(`XMLHttpRequest.send`,g,t,h,_);e&&e[s]===!0&&!t.aborted&&r.state===m&&r.invoke()}}),se=Te(l,`abort`,()=>function(e,n){let r=u(e);if(r&&typeof r.type==`string`){if(r.cancelFn==null||r.data&&r.data.aborted)return;r.zone.cancelTask(r)}else if(t.current[ne]===!0)return se.apply(e,n)})}}),e.__load_patch(`geolocation`,e=>{e.navigator&&e.navigator.geolocation&&fe(e.navigator.geolocation,[`getCurrentPosition`,`watchPosition`])}),e.__load_patch(`PromiseRejectionEvent`,(e,t)=>{function n(t){return function(n){Re(e,t).forEach(r=>{let i=e.PromiseRejectionEvent;if(i){let e=new i(t,{promise:n.promise,reason:n.rejection});r.invoke(e)}})}}e.PromiseRejectionEvent&&(t[oe(`unhandledPromiseRejectionHandler`)]=n(`unhandledrejection`),t[oe(`rejectionHandledHandler`)]=n(`rejectionhandled`))}),e.__load_patch(`queueMicrotask`,(e,t,n)=>{Be(e,n)})}function Ze(e){e.__load_patch(`ZoneAwarePromise`,(e,t,n)=>{let r=Object.getOwnPropertyDescriptor,i=Object.defineProperty;function a(e){return e&&e.toString===Object.prototype.toString?(e.constructor&&e.constructor.name||``)+`: `+JSON.stringify(e):e?e.toString():Object.prototype.toString.call(e)}let o=n.symbol,s=[],c=e[o(`DISABLE_WRAPPING_UNCAUGHT_PROMISE_REJECTION`)]!==!1,l=o(`Promise`),u=o(`then`);n.onUnhandledError=e=>{if(n.showUncaughtError()){let t=e&&e.rejection;t&&e.zone&&e.task?console.error(`Unhandled Promise rejection:`,t instanceof Error?t.message:t,`; Zone:`,e.zone.name,`; Task:`,e.task&&e.task.source,`; Value:`,t,t instanceof Error?t.stack:void 0):console.error(e)}},n.microtaskDrainDone=()=>{for(;s.length;){let e=s.shift();try{e.zone.runGuarded(()=>{throw e.throwOriginal?e.rejection:e})}catch(e){f(e)}}};let d=o(`unhandledPromiseRejectionHandler`);function f(e){n.onUnhandledError(e);try{let n=t[d];typeof n==`function`&&n.call(this,e)}catch{}}function p(e){return e&&typeof e.then==`function`}function m(e){return e}function h(e){return de.reject(e)}let g=o(`state`),_=o(`value`),ee=o(`finally`),v=o(`parentPromiseValue`),te=o(`parentPromiseState`);function ne(e,t){return n=>{try{ae(e,t,n)}catch(t){ae(e,!1,t)}}}let re=function(){let e=!1;return function(t){return function(){e||(e=!0,t.apply(null,arguments))}}},ie=o(`currentTaskTrace`);function ae(e,r,o){let l=re();if(e===o)throw TypeError(`Promise resolved with itself`);if(e[g]===null){let u=null;try{(typeof o==`object`||typeof o==`function`)&&(u=o&&o.then)}catch(t){return l(()=>{ae(e,!1,t)})(),e}if(r!==!1&&o instanceof de&&Object.hasOwn(o,g)&&Object.hasOwn(o,_)&&o[g]!==null)se(o),ae(e,o[g],o[_]);else if(r!==!1&&typeof u==`function`)try{u.call(o,l(ne(e,r)),l(ne(e,!1)))}catch(t){l(()=>{ae(e,!1,t)})()}else{e[g]=r;let l=e[_];if(e[_]=o,e[ee]===ee&&r===!0&&(e[g]=e[te],e[_]=e[v]),r===!1&&o instanceof Error){let e=t.currentTask&&t.currentTask.data&&t.currentTask.data.__creationTrace__;e&&i(o,ie,{configurable:!0,enumerable:!1,writable:!0,value:e})}for(let t=0;t<l.length;)ce(e,l[t++],l[t++],l[t++],l[t++]);if(l.length==0&&r==0){e[g]=0;let r=o;try{throw Error(`Uncaught (in promise): `+a(o)+(o&&o.stack?`
`+o.stack:``))}catch(e){r=e}c&&(r.throwOriginal=!0),r.rejection=o,r.promise=e,r.zone=t.current,r.task=t.currentTask,s.push(r),n.scheduleMicroTask()}}}return e}let oe=o(`rejectionHandledHandler`);function se(e){if(e[g]===0){try{let n=t[oe];n&&typeof n==`function`&&n.call(this,{rejection:e[_],promise:e})}catch{}e[g]=!1;for(let t=0;t<s.length;t++)e===s[t].promise&&s.splice(t,1)}}function ce(e,t,n,r,i){se(e);let a=e[g],o=a?typeof r==`function`?r:m:typeof i==`function`?i:h;t.scheduleMicroTask(`Promise.then`,()=>{try{let r=e[_],i=!!n&&ee===n[ee];i&&(n[v]=r,n[te]=a),ae(n,!0,t.run(o,void 0,i&&o!==h&&o!==m?[]:[r]))}catch(e){ae(n,!1,e)}},n)}let le=function(){},ue=e.AggregateError;class de{static toString(){return`function ZoneAwarePromise() { [native code] }`}static resolve(e){return e instanceof de?e:ae(new this(null),!0,e)}static reject(e){return ae(new this(null),!1,e)}static withResolvers(){let e={};return e.promise=new de((t,n)=>{e.resolve=t,e.reject=n}),e}static any(e){if(!e||typeof e[Symbol.iterator]!=`function`)return Promise.reject(new ue([],`All promises were rejected`));let t=[],n=0;try{for(let r of e)n++,t.push(de.resolve(r))}catch{return Promise.reject(new ue([],`All promises were rejected`))}if(n===0)return Promise.reject(new ue([],`All promises were rejected`));let r=!1,i=[];return new de((e,a)=>{for(let o=0;o<t.length;o++)t[o].then(t=>{r||(r=!0,e(t))},e=>{i.push(e),n--,n===0&&(r=!0,a(new ue(i,`All promises were rejected`)))})})}static race(e){let t,n,r=new this((e,r)=>{t=e,n=r});function i(e){t(e)}function a(e){n(e)}for(let t of e)p(t)||(t=this.resolve(t)),t.then(i,a);return r}static all(e){return de.allWithCallback(e)}static allSettled(e){return(this&&this.prototype instanceof de?this:de).allWithCallback(e,{thenCallback:e=>({status:`fulfilled`,value:e}),errorCallback:e=>({status:`rejected`,reason:e})})}static allWithCallback(e,t){let n,r,i=new this((e,t)=>{n=e,r=t}),a=2,o=0,s=[];for(let i of e){p(i)||(i=this.resolve(i));let e=o;try{i.then(r=>{s[e]=t?t.thenCallback(r):r,a--,a===0&&n(s)},i=>{t?(s[e]=t.errorCallback(i),a--,a===0&&n(s)):r(i)})}catch(e){r(e)}a++,o++}return a-=2,a===0&&n(s),i}constructor(e){let t=this;if(!(t instanceof de))throw Error(`Must be an instanceof Promise.`);t[g]=null,t[_]=[];try{let n=re();e&&e(n(ne(t,!0)),n(ne(t,!1)))}catch(e){ae(t,!1,e)}}get[Symbol.toStringTag](){return`Promise`}get[Symbol.species](){return de}then(e,n){let r=this.constructor?.[Symbol.species];(!r||typeof r!=`function`)&&(r=this.constructor||de);let i=new r(le),a=t.current;return this[g]==null?this[_].push(a,i,e,n):ce(this,a,i,e,n),i}catch(e){return this.then(null,e)}finally(e){let n=this.constructor?.[Symbol.species];(!n||typeof n!=`function`)&&(n=de);let r=new n(le);r[ee]=ee;let i=t.current;return this[g]==null?this[_].push(i,r,e,e):ce(this,i,r,e,e),r}}de.resolve=de.resolve,de.reject=de.reject,de.race=de.race,de.all=de.all;let fe=e[l]=e.Promise;e.Promise=de;let pe=o(`thenPatched`);function me(e){let t=e.prototype,n=r(t,`then`);if(n&&(n.writable===!1||!n.configurable))return;let i=t.then;t[u]=i,e.prototype.then=function(e,t){return new de((e,t)=>{i.call(this,e,t)}).then(e,t)},e[pe]=!0}n.patchThen=me;function he(e){return function(t,n){let r=e.apply(t,n);if(r instanceof de)return r;let i=r.constructor;return i[pe]||me(i),r}}if(fe){me(fe);let t=fe.try;t&&typeof t==`function`&&(de.try=t),Te(e,`fetch`,e=>he(e))}return Promise[t.__symbol__(`uncaughtPromiseErrors`)]=s,de})}function Qe(e){e.__load_patch(`toString`,e=>{let t=Function.prototype.toString,n=oe(`OriginalDelegate`),r=oe(`Promise`),i=oe(`Error`),a=function(){if(typeof this==`function`){let a=this[n];if(a)return typeof a==`function`?t.call(a):Object.prototype.toString.call(a);if(this===Promise){let n=e[r];if(n)return t.call(n)}if(this===Error){let n=e[i];if(n)return t.call(n)}}return t.call(this)};a[n]=t,Function.prototype.toString=a;let o=Object.prototype.toString;Object.prototype.toString=function(){return typeof Promise==`function`&&this instanceof Promise?`[object Promise]`:o.call(this)}})}function $e(e,t,n,r,i){let a=Zone.__symbol__(r);if(t[a])return;let o=t[a]=t[r];t[r]=function(a,s,c){return s&&s.prototype&&i.forEach(function(t){let i=`${n}.${r}::`+t,a=s.prototype;try{if(Object.hasOwn(a,t)){let n=e.ObjectGetOwnPropertyDescriptor(a,t);n&&n.value?(n.value=e.wrapWithCurrentZone(n.value,i),e._redefineProperty(s.prototype,t,n)):a[t]&&(a[t]=e.wrapWithCurrentZone(a[t],i))}else a[t]&&(a[t]=e.wrapWithCurrentZone(a[t],i))}catch{}}),o.call(t,a,s,c)},e.attachOriginToPatched(t[r],o)}function et(e){e.__load_patch(`util`,(e,t,n)=>{let r=Je(e);n.patchOnProperties=Se,n.patchMethod=Te,n.bindArguments=de,n.patchMacroTask=Ee;let i=t.__symbol__(`BLACK_LISTED_EVENTS`),a=t.__symbol__(`UNPATCHED_EVENTS`);e[a]&&(e[i]=e[a]),e[i]&&(t[i]=t[a]=e[i]),n.patchEventPrototype=ze,n.patchEventTarget=Le,n.ObjectDefineProperty=f,n.ObjectGetOwnPropertyDescriptor=d,n.ObjectCreate=m,n.ArraySlice=h,n.patchClass=we,n.wrapWithCurrentZone=ie,n.filterProperties=Ke,n.attachOriginToPatched=De,n._redefineProperty=Object.defineProperty,n.patchCallbacks=$e,n.getGlobalObjects=()=>({globalSources:Me,zoneSymbolEventNames:je,eventNames:r,isBrowser:ge,isMix:_e,isNode:he,TRUE_STR:te,FALSE_STR:ne,ZONE_SYMBOL_PREFIX:re,ADD_EVENT_LISTENER_STR:g,REMOVE_EVENT_LISTENER_STR:_})})}function tt(e){Ze(e),Qe(e),et(e)}var nt=u();tt(nt),Xe(nt);var rt=(function(e){return e[e.NONE=0]=`NONE`,e[e.HTML=1]=`HTML`,e[e.STYLE=2]=`STYLE`,e[e.SCRIPT=3]=`SCRIPT`,e[e.URL=4]=`URL`,e[e.RESOURCE_URL=5]=`RESOURCE_URL`,e[e.ATTRIBUTE_NO_BINDING=6]=`ATTRIBUTE_NO_BINDING`,e})(rt||{}),it=(function(e){return e[e.None=0]=`None`,e[e.Const=1]=`Const`,e})(it||{}),at=class{modifiers;constructor(e=it.None){this.modifiers=e}hasModifier(e){return(this.modifiers&e)!==0}},ot=(function(e){return e[e.Dynamic=0]=`Dynamic`,e[e.Bool=1]=`Bool`,e[e.String=2]=`String`,e[e.Int=3]=`Int`,e[e.Number=4]=`Number`,e[e.Function=5]=`Function`,e[e.Inferred=6]=`Inferred`,e[e.None=7]=`None`,e})(ot||{}),st=class extends at{name;constructor(e,t){super(t),this.name=e}visitType(e,t){return e.visitBuiltinType(this,t)}};ot.Dynamic;var ct=new st(ot.Inferred);ot.Bool,ot.Int,ot.Number,ot.String,ot.Function,ot.None;var y=(function(e){return e[e.Equals=0]=`Equals`,e[e.NotEquals=1]=`NotEquals`,e[e.Assign=2]=`Assign`,e[e.Identical=3]=`Identical`,e[e.NotIdentical=4]=`NotIdentical`,e[e.Minus=5]=`Minus`,e[e.Plus=6]=`Plus`,e[e.Divide=7]=`Divide`,e[e.Multiply=8]=`Multiply`,e[e.Modulo=9]=`Modulo`,e[e.And=10]=`And`,e[e.Or=11]=`Or`,e[e.BitwiseOr=12]=`BitwiseOr`,e[e.BitwiseAnd=13]=`BitwiseAnd`,e[e.Lower=14]=`Lower`,e[e.LowerEquals=15]=`LowerEquals`,e[e.Bigger=16]=`Bigger`,e[e.BiggerEquals=17]=`BiggerEquals`,e[e.NullishCoalesce=18]=`NullishCoalesce`,e[e.Exponentiation=19]=`Exponentiation`,e[e.In=20]=`In`,e[e.InstanceOf=21]=`InstanceOf`,e[e.AdditionAssignment=22]=`AdditionAssignment`,e[e.SubtractionAssignment=23]=`SubtractionAssignment`,e[e.MultiplicationAssignment=24]=`MultiplicationAssignment`,e[e.DivisionAssignment=25]=`DivisionAssignment`,e[e.RemainderAssignment=26]=`RemainderAssignment`,e[e.ExponentiationAssignment=27]=`ExponentiationAssignment`,e[e.AndAssignment=28]=`AndAssignment`,e[e.OrAssignment=29]=`OrAssignment`,e[e.NullishCoalesceAssignment=30]=`NullishCoalesceAssignment`,e})(y||{});function lt(e,t){return e==null||t==null?e==t:e.isEquivalent(t)}function ut(e,t,n){let r=e.length;if(r!==t.length)return!1;for(let i=0;i<r;i++)if(!n(e[i],t[i]))return!1;return!0}function dt(e,t){return ut(e,t,(e,t)=>e.isEquivalent(t))}var ft=class{leadingComments;type;sourceSpan;constructor(e,t,n){this.leadingComments=n,this.type=e||null,this.sourceSpan=t||null}prop(e,t){return new St(this,e,null,t)}key(e,t,n){return new Ct(this,e,t,n)}callFn(e,t,n,r){return new ht(this,e,null,t,n,r)}instantiate(e,t,n,r){return new gt(this,e,t,n)}conditional(e,t=null,n,r){return new bt(this,e,t,null,n)}equals(e,t){return new xt(y.Equals,this,e,null,t)}notEquals(e,t){return new xt(y.NotEquals,this,e,null,t)}identical(e,t){return new xt(y.Identical,this,e,null,t)}notIdentical(e,t){return new xt(y.NotIdentical,this,e,null,t)}minus(e,t){return new xt(y.Minus,this,e,null,t)}plus(e,t){return new xt(y.Plus,this,e,null,t)}divide(e,t){return new xt(y.Divide,this,e,null,t)}multiply(e,t){return new xt(y.Multiply,this,e,null,t)}modulo(e,t){return new xt(y.Modulo,this,e,null,t)}power(e,t){return new xt(y.Exponentiation,this,e,null,t)}and(e,t){return new xt(y.And,this,e,null,t)}bitwiseOr(e,t){return new xt(y.BitwiseOr,this,e,null,t)}bitwiseAnd(e,t){return new xt(y.BitwiseAnd,this,e,null,t)}or(e,t){return new xt(y.Or,this,e,null,t)}lower(e,t){return new xt(y.Lower,this,e,null,t)}lowerEquals(e,t){return new xt(y.LowerEquals,this,e,null,t)}bigger(e,t){return new xt(y.Bigger,this,e,null,t)}biggerEquals(e,t){return new xt(y.BiggerEquals,this,e,null,t)}isBlank(e){return this.equals(Ot,e)}nullishCoalesce(e,t){return new xt(y.NullishCoalesce,this,e,null,t)}toStmt(e){return new jt(this,null,e)}},pt=class e extends ft{name;constructor(e,t,n,r){super(t,n,r),this.name=e}isEquivalent(t){return t instanceof e&&this.name===t.name}isConstant(){return!1}visitExpression(e,t){return e.visitReadVarExpr(this,t)}clone(){return new e(this.name,this.type,this.sourceSpan)}set(e){return new xt(y.Assign,this,e,null,this.sourceSpan)}},mt=class e extends ft{expr;constructor(e,t,n,r){super(t,n,r),this.expr=e}visitExpression(e,t){return e.visitTypeofExpr(this,t)}isEquivalent(t){return t instanceof e&&t.expr.isEquivalent(this.expr)}isConstant(){return this.expr.isConstant()}clone(){return new e(this.expr.clone())}},ht=class e extends ft{fn;args;pure;isOptional;constructor(e,t,n,r,i=!1,a,o=!1){super(n,r,a),this.fn=e,this.args=t,this.pure=i,this.isOptional=o}get receiver(){return this.fn}isEquivalent(t){return t instanceof e&&this.fn.isEquivalent(t.fn)&&dt(this.args,t.args)&&this.pure===t.pure}isConstant(){return!1}visitExpression(e,t){return e.visitInvokeFunctionExpr(this,t)}clone(){return new e(this.fn.clone(),this.args.map(e=>e.clone()),this.type,this.sourceSpan,this.pure,[],this.isOptional)}},gt=class e extends ft{classExpr;args;constructor(e,t,n,r,i){super(n,r,i),this.classExpr=e,this.args=t}isEquivalent(t){return t instanceof e&&this.classExpr.isEquivalent(t.classExpr)&&dt(this.args,t.args)}isConstant(){return!1}visitExpression(e,t){return e.visitInstantiateExpr(this,t)}clone(){return new e(this.classExpr.clone(),this.args.map(e=>e.clone()),this.type,this.sourceSpan)}},_t=class e extends ft{body;flags;constructor(e,t,n,r){super(null,n,r),this.body=e,this.flags=t}isEquivalent(t){return t instanceof e&&this.body===t.body&&this.flags===t.flags}isConstant(){return!0}visitExpression(e,t){return e.visitRegularExpressionLiteral(this,t)}clone(){return new e(this.body,this.flags,this.sourceSpan)}},vt=class e extends ft{value;constructor(e,t,n,r){super(t,n,r),this.value=e}isEquivalent(t){return t instanceof e&&this.value===t.value}isConstant(){return!0}visitExpression(e,t){return e.visitLiteralExpr(this,t)}clone(){return new e(this.value,this.type,this.sourceSpan)}},yt=class e extends ft{value;typeParams;constructor(e,t,n=null,r,i){super(t,r,i),this.value=e,this.typeParams=n}isEquivalent(t){return t instanceof e&&this.value.name===t.value.name&&this.value.moduleName===t.value.moduleName}isConstant(){return!1}visitExpression(e,t){return e.visitExternalExpr(this,t)}clone(){return new e(this.value,this.type,this.typeParams,this.sourceSpan)}},bt=class e extends ft{condition;falseCase;trueCase;constructor(e,t,n=null,r,i,a){super(r||t.type,i,a),this.condition=e,this.falseCase=n,this.trueCase=t}isEquivalent(t){return t instanceof e&&this.condition.isEquivalent(t.condition)&&this.trueCase.isEquivalent(t.trueCase)&&lt(this.falseCase,t.falseCase)}isConstant(){return!1}visitExpression(e,t){return e.visitConditionalExpr(this,t)}clone(){return new e(this.condition.clone(),this.trueCase.clone(),this.falseCase?.clone(),this.type,this.sourceSpan)}},xt=class e extends ft{operator;rhs;lhs;constructor(e,t,n,r,i,a){super(r||t.type,i,a),this.operator=e,this.rhs=n,this.lhs=t}isEquivalent(t){return t instanceof e&&this.operator===t.operator&&this.lhs.isEquivalent(t.lhs)&&this.rhs.isEquivalent(t.rhs)}isConstant(){return!1}visitExpression(e,t){return e.visitBinaryOperatorExpr(this,t)}clone(){return new e(this.operator,this.lhs.clone(),this.rhs.clone(),this.type,this.sourceSpan)}isAssignment(){let e=this.operator;return e===y.Assign||e===y.AdditionAssignment||e===y.SubtractionAssignment||e===y.MultiplicationAssignment||e===y.DivisionAssignment||e===y.RemainderAssignment||e===y.ExponentiationAssignment||e===y.AndAssignment||e===y.OrAssignment||e===y.NullishCoalesceAssignment}},St=class e extends ft{receiver;name;isOptional;constructor(e,t,n,r,i,a=!1){super(n,r,i),this.receiver=e,this.name=t,this.isOptional=a}get index(){return this.name}isEquivalent(t){return t instanceof e&&this.receiver.isEquivalent(t.receiver)&&this.name===t.name&&this.isOptional===t.isOptional}isConstant(){return!1}visitExpression(e,t){return e.visitReadPropExpr(this,t)}set(e){return new xt(y.Assign,this.receiver.prop(this.name),e,null,this.sourceSpan)}clone(){return new e(this.receiver.clone(),this.name,this.type,this.sourceSpan,[],this.isOptional)}},Ct=class e extends ft{receiver;index;isOptional;constructor(e,t,n,r,i,a=!1){super(n,r,i),this.receiver=e,this.index=t,this.isOptional=a}isEquivalent(t){return t instanceof e&&this.receiver.isEquivalent(t.receiver)&&this.index.isEquivalent(t.index)&&this.isOptional===t.isOptional}isConstant(){return!1}visitExpression(e,t){return e.visitReadKeyExpr(this,t)}set(e){return new xt(y.Assign,this.receiver.key(this.index),e,null,this.sourceSpan)}clone(){return new e(this.receiver.clone(),this.index.clone(),this.type,this.sourceSpan,[],this.isOptional)}},wt=class e extends ft{entries;constructor(e,t,n,r){super(t,n,r),this.entries=e}isConstant(){return this.entries.every(e=>e.isConstant())}isEquivalent(t){return t instanceof e&&dt(this.entries,t.entries)}visitExpression(e,t){return e.visitLiteralArrayExpr(this,t)}clone(){return new e(this.entries.map(e=>e.clone()),this.type,this.sourceSpan)}},Tt=class e{expression;constructor(e){this.expression=e}isEquivalent(t){return t instanceof e&&this.expression.isEquivalent(t.expression)}clone(){return new e(this.expression.clone())}isConstant(){return this.expression.isConstant()}},Et=class e extends ft{entries;valueType=null;constructor(e,t,n,r){super(t,n,r),this.entries=e,t&&(this.valueType=t.valueType)}isEquivalent(t){return t instanceof e&&dt(this.entries,t.entries)}isConstant(){return this.entries.every(e=>e.isConstant())}visitExpression(e,t){return e.visitLiteralMapExpr(this,t)}clone(){let t=this.entries.map(e=>e.clone());return new e(t,this.type,this.sourceSpan)}},Dt=class e extends ft{expression;constructor(e,t,n){super(null,t,n),this.expression=e}isEquivalent(t){return t instanceof e&&this.expression.isEquivalent(t.expression)}isConstant(){return this.expression.isConstant()}visitExpression(e,t){return e.visitSpreadElementExpr(this,t)}clone(){return new e(this.expression.clone(),this.sourceSpan)}},Ot=new vt(null,ct,null),kt=(function(e){return e[e.None=0]=`None`,e[e.Final=1]=`Final`,e[e.Private=2]=`Private`,e[e.Exported=4]=`Exported`,e[e.Static=8]=`Static`,e})(kt||{}),At=class{modifiers;sourceSpan;leadingComments;constructor(e=kt.None,t=null,n){this.modifiers=e,this.sourceSpan=t,this.leadingComments=n}hasModifier(e){return(this.modifiers&e)!==0}addLeadingComment(e){this.leadingComments=this.leadingComments??[],this.leadingComments.push(e)}},jt=class e extends At{expr;constructor(e,t,n){super(kt.None,t,n),this.expr=e}isEquivalent(t){return t instanceof e&&this.expr.isEquivalent(t.expr)}visitStatement(e,t){return e.visitExpressionStmt(this,t)}};(class e{static INSTANCE=new e;keyOf(e){if(e instanceof vt&&typeof e.value==`string`)return`"${e.value}"`;if(e instanceof vt)return String(e.value);if(e instanceof _t)return`/${e.body}/${e.flags??``}`;if(e instanceof wt){let t=[];for(let n of e.entries)t.push(this.keyOf(n));return`[${t.join(`,`)}]`}if(e instanceof Et){let t=[];for(let n of e.entries)if(n instanceof Tt)t.push(`...`+this.keyOf(n.expression));else{let e=n.key;n.quoted&&(e=`"${e}"`),t.push(e+`:`+this.keyOf(n.value))}return`{${t.join(`,`)}}`}if(e instanceof yt)return`import("${e.value.moduleName}", ${e.value.name})`;if(e instanceof pt)return`read(${e.name})`;if(e instanceof mt)return`typeof(${this.keyOf(e.expr)})`;if(e instanceof Dt)return`...${this.keyOf(e.expression)}`;throw Error(`${this.constructor.name} does not handle expressions of type ${e.constructor.name}`)}});var b=`@angular/core`,x=(()=>{class e{static core={name:null,moduleName:b};static namespaceHTML={name:`ɵɵnamespaceHTML`,moduleName:b};static namespaceMathML={name:`ɵɵnamespaceMathML`,moduleName:b};static namespaceSVG={name:`ɵɵnamespaceSVG`,moduleName:b};static element={name:`ɵɵelement`,moduleName:b};static elementStart={name:`ɵɵelementStart`,moduleName:b};static elementEnd={name:`ɵɵelementEnd`,moduleName:b};static foreignComponent={name:`ɵɵforeignComponent`,moduleName:b};static foreignContent={name:`ɵɵforeignContent`,moduleName:b};static foreignContentFn={name:`ɵɵforeignContentFn`,moduleName:b};static domElement={name:`ɵɵdomElement`,moduleName:b};static domElementStart={name:`ɵɵdomElementStart`,moduleName:b};static domElementEnd={name:`ɵɵdomElementEnd`,moduleName:b};static domElementContainer={name:`ɵɵdomElementContainer`,moduleName:b};static domElementContainerStart={name:`ɵɵdomElementContainerStart`,moduleName:b};static domElementContainerEnd={name:`ɵɵdomElementContainerEnd`,moduleName:b};static domTemplate={name:`ɵɵdomTemplate`,moduleName:b};static domListener={name:`ɵɵdomListener`,moduleName:b};static advance={name:`ɵɵadvance`,moduleName:b};static syntheticHostProperty={name:`ɵɵsyntheticHostProperty`,moduleName:b};static syntheticHostListener={name:`ɵɵsyntheticHostListener`,moduleName:b};static attribute={name:`ɵɵattribute`,moduleName:b};static classProp={name:`ɵɵclassProp`,moduleName:b};static elementContainerStart={name:`ɵɵelementContainerStart`,moduleName:b};static elementContainerEnd={name:`ɵɵelementContainerEnd`,moduleName:b};static elementContainer={name:`ɵɵelementContainer`,moduleName:b};static styleMap={name:`ɵɵstyleMap`,moduleName:b};static classMap={name:`ɵɵclassMap`,moduleName:b};static styleProp={name:`ɵɵstyleProp`,moduleName:b};static interpolate={name:`ɵɵinterpolate`,moduleName:b};static interpolate1={name:`ɵɵinterpolate1`,moduleName:b};static interpolate2={name:`ɵɵinterpolate2`,moduleName:b};static interpolate3={name:`ɵɵinterpolate3`,moduleName:b};static interpolate4={name:`ɵɵinterpolate4`,moduleName:b};static interpolate5={name:`ɵɵinterpolate5`,moduleName:b};static interpolate6={name:`ɵɵinterpolate6`,moduleName:b};static interpolate7={name:`ɵɵinterpolate7`,moduleName:b};static interpolate8={name:`ɵɵinterpolate8`,moduleName:b};static interpolateV={name:`ɵɵinterpolateV`,moduleName:b};static nextContext={name:`ɵɵnextContext`,moduleName:b};static resetView={name:`ɵɵresetView`,moduleName:b};static templateCreate={name:`ɵɵtemplate`,moduleName:b};static defer={name:`ɵɵdefer`,moduleName:b};static deferWhen={name:`ɵɵdeferWhen`,moduleName:b};static deferOnIdle={name:`ɵɵdeferOnIdle`,moduleName:b};static deferOnImmediate={name:`ɵɵdeferOnImmediate`,moduleName:b};static deferOnTimer={name:`ɵɵdeferOnTimer`,moduleName:b};static deferOnHover={name:`ɵɵdeferOnHover`,moduleName:b};static deferOnInteraction={name:`ɵɵdeferOnInteraction`,moduleName:b};static deferOnViewport={name:`ɵɵdeferOnViewport`,moduleName:b};static deferPrefetchWhen={name:`ɵɵdeferPrefetchWhen`,moduleName:b};static deferPrefetchOnIdle={name:`ɵɵdeferPrefetchOnIdle`,moduleName:b};static deferPrefetchOnImmediate={name:`ɵɵdeferPrefetchOnImmediate`,moduleName:b};static deferPrefetchOnTimer={name:`ɵɵdeferPrefetchOnTimer`,moduleName:b};static deferPrefetchOnHover={name:`ɵɵdeferPrefetchOnHover`,moduleName:b};static deferPrefetchOnInteraction={name:`ɵɵdeferPrefetchOnInteraction`,moduleName:b};static deferPrefetchOnViewport={name:`ɵɵdeferPrefetchOnViewport`,moduleName:b};static deferHydrateWhen={name:`ɵɵdeferHydrateWhen`,moduleName:b};static deferHydrateNever={name:`ɵɵdeferHydrateNever`,moduleName:b};static deferHydrateOnIdle={name:`ɵɵdeferHydrateOnIdle`,moduleName:b};static deferHydrateOnImmediate={name:`ɵɵdeferHydrateOnImmediate`,moduleName:b};static deferHydrateOnTimer={name:`ɵɵdeferHydrateOnTimer`,moduleName:b};static deferHydrateOnHover={name:`ɵɵdeferHydrateOnHover`,moduleName:b};static deferHydrateOnInteraction={name:`ɵɵdeferHydrateOnInteraction`,moduleName:b};static deferHydrateOnViewport={name:`ɵɵdeferHydrateOnViewport`,moduleName:b};static deferEnableTimerScheduling={name:`ɵɵdeferEnableTimerScheduling`,moduleName:b};static enableIncrementalHydrationRuntime={name:`ɵɵenableIncrementalHydrationRuntime`,moduleName:b};static conditionalCreate={name:`ɵɵconditionalCreate`,moduleName:b};static conditionalBranchCreate={name:`ɵɵconditionalBranchCreate`,moduleName:b};static conditional={name:`ɵɵconditional`,moduleName:b};static repeater={name:`ɵɵrepeater`,moduleName:b};static repeaterCreate={name:`ɵɵrepeaterCreate`,moduleName:b};static repeaterTrackByIndex={name:`ɵɵrepeaterTrackByIndex`,moduleName:b};static repeaterTrackByIdentity={name:`ɵɵrepeaterTrackByIdentity`,moduleName:b};static componentInstance={name:`ɵɵcomponentInstance`,moduleName:b};static text={name:`ɵɵtext`,moduleName:b};static enableBindings={name:`ɵɵenableBindings`,moduleName:b};static disableBindings={name:`ɵɵdisableBindings`,moduleName:b};static getCurrentView={name:`ɵɵgetCurrentView`,moduleName:b};static textInterpolate={name:`ɵɵtextInterpolate`,moduleName:b};static textInterpolate1={name:`ɵɵtextInterpolate1`,moduleName:b};static textInterpolate2={name:`ɵɵtextInterpolate2`,moduleName:b};static textInterpolate3={name:`ɵɵtextInterpolate3`,moduleName:b};static textInterpolate4={name:`ɵɵtextInterpolate4`,moduleName:b};static textInterpolate5={name:`ɵɵtextInterpolate5`,moduleName:b};static textInterpolate6={name:`ɵɵtextInterpolate6`,moduleName:b};static textInterpolate7={name:`ɵɵtextInterpolate7`,moduleName:b};static textInterpolate8={name:`ɵɵtextInterpolate8`,moduleName:b};static textInterpolateV={name:`ɵɵtextInterpolateV`,moduleName:b};static restoreView={name:`ɵɵrestoreView`,moduleName:b};static pureFunction0={name:`ɵɵpureFunction0`,moduleName:b};static pureFunction1={name:`ɵɵpureFunction1`,moduleName:b};static pureFunction2={name:`ɵɵpureFunction2`,moduleName:b};static pureFunction3={name:`ɵɵpureFunction3`,moduleName:b};static pureFunction4={name:`ɵɵpureFunction4`,moduleName:b};static pureFunction5={name:`ɵɵpureFunction5`,moduleName:b};static pureFunction6={name:`ɵɵpureFunction6`,moduleName:b};static pureFunction7={name:`ɵɵpureFunction7`,moduleName:b};static pureFunction8={name:`ɵɵpureFunction8`,moduleName:b};static pureFunctionV={name:`ɵɵpureFunctionV`,moduleName:b};static pipeBind1={name:`ɵɵpipeBind1`,moduleName:b};static pipeBind2={name:`ɵɵpipeBind2`,moduleName:b};static pipeBind3={name:`ɵɵpipeBind3`,moduleName:b};static pipeBind4={name:`ɵɵpipeBind4`,moduleName:b};static pipeBindV={name:`ɵɵpipeBindV`,moduleName:b};static domProperty={name:`ɵɵdomProperty`,moduleName:b};static ariaProperty={name:`ɵɵariaProperty`,moduleName:b};static property={name:`ɵɵproperty`,moduleName:b};static control={name:`ɵɵcontrol`,moduleName:b};static controlCreate={name:`ɵɵcontrolCreate`,moduleName:b};static animationEnterListener={name:`ɵɵanimateEnterListener`,moduleName:b};static animationLeaveListener={name:`ɵɵanimateLeaveListener`,moduleName:b};static animationEnter={name:`ɵɵanimateEnter`,moduleName:b};static animationLeave={name:`ɵɵanimateLeave`,moduleName:b};static i18n={name:`ɵɵi18n`,moduleName:b};static i18nAttributes={name:`ɵɵi18nAttributes`,moduleName:b};static i18nExp={name:`ɵɵi18nExp`,moduleName:b};static i18nStart={name:`ɵɵi18nStart`,moduleName:b};static i18nEnd={name:`ɵɵi18nEnd`,moduleName:b};static i18nApply={name:`ɵɵi18nApply`,moduleName:b};static i18nPostprocess={name:`ɵɵi18nPostprocess`,moduleName:b};static pipe={name:`ɵɵpipe`,moduleName:b};static projection={name:`ɵɵprojection`,moduleName:b};static projectionDef={name:`ɵɵprojectionDef`,moduleName:b};static reference={name:`ɵɵreference`,moduleName:b};static inject={name:`ɵɵinject`,moduleName:b};static injectAttribute={name:`ɵɵinjectAttribute`,moduleName:b};static directiveInject={name:`ɵɵdirectiveInject`,moduleName:b};static invalidFactory={name:`ɵɵinvalidFactory`,moduleName:b};static invalidFactoryDep={name:`ɵɵinvalidFactoryDep`,moduleName:b};static templateRefExtractor={name:`ɵɵtemplateRefExtractor`,moduleName:b};static forwardRef={name:`forwardRef`,moduleName:b};static resolveForwardRef={name:`resolveForwardRef`,moduleName:b};static replaceMetadata={name:`ɵɵreplaceMetadata`,moduleName:b};static getReplaceMetadataURL={name:`ɵɵgetReplaceMetadataURL`,moduleName:b};static ɵɵdefineInjectable={name:`ɵɵdefineInjectable`,moduleName:b};static declareInjectable={name:`ɵɵngDeclareInjectable`,moduleName:b};static InjectableDeclaration={name:`ɵɵInjectableDeclaration`,moduleName:b};static defineService={name:`ɵɵdefineService`,moduleName:b};static declareService={name:`ɵɵngDeclareService`,moduleName:b};static resolveWindow={name:`ɵɵresolveWindow`,moduleName:b};static resolveDocument={name:`ɵɵresolveDocument`,moduleName:b};static resolveBody={name:`ɵɵresolveBody`,moduleName:b};static getComponentDepsFactory={name:`ɵɵgetComponentDepsFactory`,moduleName:b};static defineComponent={name:`ɵɵdefineComponent`,moduleName:b};static declareComponent={name:`ɵɵngDeclareComponent`,moduleName:b};static setComponentScope={name:`ɵɵsetComponentScope`,moduleName:b};static ChangeDetectionStrategy={name:`ChangeDetectionStrategy`,moduleName:b};static ViewEncapsulation={name:`ViewEncapsulation`,moduleName:b};static ComponentDeclaration={name:`ɵɵComponentDeclaration`,moduleName:b};static FactoryDeclaration={name:`ɵɵFactoryDeclaration`,moduleName:b};static declareFactory={name:`ɵɵngDeclareFactory`,moduleName:b};static FactoryTarget={name:`ɵɵFactoryTarget`,moduleName:b};static defineDirective={name:`ɵɵdefineDirective`,moduleName:b};static declareDirective={name:`ɵɵngDeclareDirective`,moduleName:b};static DirectiveDeclaration={name:`ɵɵDirectiveDeclaration`,moduleName:b};static InjectorDef={name:`ɵɵInjectorDef`,moduleName:b};static InjectorDeclaration={name:`ɵɵInjectorDeclaration`,moduleName:b};static defineInjector={name:`ɵɵdefineInjector`,moduleName:b};static declareInjector={name:`ɵɵngDeclareInjector`,moduleName:b};static NgModuleDeclaration={name:`ɵɵNgModuleDeclaration`,moduleName:b};static ModuleWithProviders={name:`ModuleWithProviders`,moduleName:b};static defineNgModule={name:`ɵɵdefineNgModule`,moduleName:b};static declareNgModule={name:`ɵɵngDeclareNgModule`,moduleName:b};static setNgModuleScope={name:`ɵɵsetNgModuleScope`,moduleName:b};static registerNgModuleType={name:`ɵɵregisterNgModuleType`,moduleName:b};static PipeDeclaration={name:`ɵɵPipeDeclaration`,moduleName:b};static definePipe={name:`ɵɵdefinePipe`,moduleName:b};static declarePipe={name:`ɵɵngDeclarePipe`,moduleName:b};static declareClassMetadata={name:`ɵɵngDeclareClassMetadata`,moduleName:b};static declareClassMetadataAsync={name:`ɵɵngDeclareClassMetadataAsync`,moduleName:b};static setClassMetadata={name:`ɵsetClassMetadata`,moduleName:b};static setClassMetadataAsync={name:`ɵsetClassMetadataAsync`,moduleName:b};static setClassDebugInfo={name:`ɵsetClassDebugInfo`,moduleName:b};static queryRefresh={name:`ɵɵqueryRefresh`,moduleName:b};static viewQuery={name:`ɵɵviewQuery`,moduleName:b};static loadQuery={name:`ɵɵloadQuery`,moduleName:b};static contentQuery={name:`ɵɵcontentQuery`,moduleName:b};static viewQuerySignal={name:`ɵɵviewQuerySignal`,moduleName:b};static contentQuerySignal={name:`ɵɵcontentQuerySignal`,moduleName:b};static queryAdvance={name:`ɵɵqueryAdvance`,moduleName:b};static twoWayProperty={name:`ɵɵtwoWayProperty`,moduleName:b};static twoWayBindingSet={name:`ɵɵtwoWayBindingSet`,moduleName:b};static twoWayListener={name:`ɵɵtwoWayListener`,moduleName:b};static declareLet={name:`ɵɵdeclareLet`,moduleName:b};static storeLet={name:`ɵɵstoreLet`,moduleName:b};static readContextLet={name:`ɵɵreadContextLet`,moduleName:b};static arrowFunction={name:`ɵɵarrowFunction`,moduleName:b};static attachSourceLocations={name:`ɵɵattachSourceLocations`,moduleName:b};static NgOnChangesFeature={name:`ɵɵNgOnChangesFeature`,moduleName:b};static ControlFeature={name:`ɵɵControlFeature`,moduleName:b};static InheritDefinitionFeature={name:`ɵɵInheritDefinitionFeature`,moduleName:b};static ProvidersFeature={name:`ɵɵProvidersFeature`,moduleName:b};static HostDirectivesFeature={name:`ɵɵHostDirectivesFeature`,moduleName:b};static ExternalStylesFeature={name:`ɵɵExternalStylesFeature`,moduleName:b};static listener={name:`ɵɵlistener`,moduleName:b};static getInheritedFactory={name:`ɵɵgetInheritedFactory`,moduleName:b};static sanitizeHtml={name:`ɵɵsanitizeHtml`,moduleName:b};static sanitizeStyle={name:`ɵɵsanitizeStyle`,moduleName:b};static validateAttribute={name:`ɵɵvalidateAttribute`,moduleName:b};static sanitizeResourceUrl={name:`ɵɵsanitizeResourceUrl`,moduleName:b};static sanitizeScript={name:`ɵɵsanitizeScript`,moduleName:b};static sanitizeUrl={name:`ɵɵsanitizeUrl`,moduleName:b};static sanitizeUrlOrResourceUrl={name:`ɵɵsanitizeUrlOrResourceUrl`,moduleName:b};static trustConstantHtml={name:`ɵɵtrustConstantHtml`,moduleName:b};static trustConstantResourceUrl={name:`ɵɵtrustConstantResourceUrl`,moduleName:b};static inputDecorator={name:`Input`,moduleName:b};static outputDecorator={name:`Output`,moduleName:b};static viewChildDecorator={name:`ViewChild`,moduleName:b};static viewChildrenDecorator={name:`ViewChildren`,moduleName:b};static contentChildDecorator={name:`ContentChild`,moduleName:b};static contentChildrenDecorator={name:`ContentChildren`,moduleName:b};static InputSignalBrandWriteType={name:`ɵINPUT_SIGNAL_BRAND_WRITE_TYPE`,moduleName:b};static UnwrapDirectiveSignalInputs={name:`ɵUnwrapDirectiveSignalInputs`,moduleName:b};static unwrapWritableSignal={name:`ɵunwrapWritableSignal`,moduleName:b};static assertType={name:`ɵassertType`,moduleName:b}}return e})();y.And,y.Bigger,y.BiggerEquals,y.BitwiseOr,y.BitwiseAnd,y.Divide,y.Assign,y.Equals,y.Identical,y.Lower,y.LowerEquals,y.Minus,y.Modulo,y.Exponentiation,y.Multiply,y.NotEquals,y.NotIdentical,y.NullishCoalesce,y.Or,y.Plus,y.In,y.InstanceOf,y.AdditionAssignment,y.SubtractionAssignment,y.MultiplicationAssignment,y.DivisionAssignment,y.RemainderAssignment,y.ExponentiationAssignment,y.AndAssignment,y.OrAssignment,y.NullishCoalesceAssignment;var Mt=class{span;sourceSpan;constructor(e,t){this.span=e,this.sourceSpan=t}toString(){return`AST`}},Nt=class extends Mt{receiver;args;argumentSpan;constructor(e,t,n,r,i){super(e,t),this.receiver=n,this.args=r,this.argumentSpan=i}visit(e,t=null){return e.visitCall(this,t)}},Pt=(function(e){return e[e.Property=0]=`Property`,e[e.Attribute=1]=`Attribute`,e[e.Class=2]=`Class`,e[e.Style=3]=`Style`,e[e.LegacyAnimation=4]=`LegacyAnimation`,e[e.TwoWay=5]=`TwoWay`,e[e.Animation=6]=`Animation`,e})(Pt||{}),Ft=`(:(where|is)\\()?`,It=`-shadowcsshost`,Lt=`-shadowcsscontext`,Rt=`[^)(]*`,zt=String.raw`(?:\(${Rt}\)|${Rt})+?`,Bt=String.raw`(?:\(${zt}\)|${Rt})+?`,Vt=String.raw`(?:\((${Bt})\))`;String.raw`(:nth-[-\w]+)`+Vt,It+Vt+``,`${Ft}`,Lt+Vt+``;var S=(function(e){return e[e.ListEnd=0]=`ListEnd`,e[e.Statement=1]=`Statement`,e[e.Variable=2]=`Variable`,e[e.ElementStart=3]=`ElementStart`,e[e.Element=4]=`Element`,e[e.ForeignComponent=5]=`ForeignComponent`,e[e.Template=6]=`Template`,e[e.ElementEnd=7]=`ElementEnd`,e[e.ContainerStart=8]=`ContainerStart`,e[e.Container=9]=`Container`,e[e.ContainerEnd=10]=`ContainerEnd`,e[e.DisableBindings=11]=`DisableBindings`,e[e.ConditionalCreate=12]=`ConditionalCreate`,e[e.ConditionalBranchCreate=13]=`ConditionalBranchCreate`,e[e.Conditional=14]=`Conditional`,e[e.EnableBindings=15]=`EnableBindings`,e[e.Text=16]=`Text`,e[e.Listener=17]=`Listener`,e[e.InterpolateText=18]=`InterpolateText`,e[e.Binding=19]=`Binding`,e[e.Property=20]=`Property`,e[e.StyleProp=21]=`StyleProp`,e[e.ClassProp=22]=`ClassProp`,e[e.StyleMap=23]=`StyleMap`,e[e.ClassMap=24]=`ClassMap`,e[e.Advance=25]=`Advance`,e[e.Pipe=26]=`Pipe`,e[e.Attribute=27]=`Attribute`,e[e.ExtractedAttribute=28]=`ExtractedAttribute`,e[e.Defer=29]=`Defer`,e[e.DeferOn=30]=`DeferOn`,e[e.DeferWhen=31]=`DeferWhen`,e[e.I18nMessage=32]=`I18nMessage`,e[e.DomProperty=33]=`DomProperty`,e[e.Namespace=34]=`Namespace`,e[e.ProjectionDef=35]=`ProjectionDef`,e[e.EnableIncrementalHydrationRuntime=36]=`EnableIncrementalHydrationRuntime`,e[e.Projection=37]=`Projection`,e[e.Content=38]=`Content`,e[e.RepeaterCreate=39]=`RepeaterCreate`,e[e.Repeater=40]=`Repeater`,e[e.TwoWayProperty=41]=`TwoWayProperty`,e[e.TwoWayListener=42]=`TwoWayListener`,e[e.DeclareLet=43]=`DeclareLet`,e[e.StoreLet=44]=`StoreLet`,e[e.I18nStart=45]=`I18nStart`,e[e.I18n=46]=`I18n`,e[e.I18nEnd=47]=`I18nEnd`,e[e.I18nExpression=48]=`I18nExpression`,e[e.I18nApply=49]=`I18nApply`,e[e.IcuStart=50]=`IcuStart`,e[e.IcuEnd=51]=`IcuEnd`,e[e.IcuPlaceholder=52]=`IcuPlaceholder`,e[e.I18nContext=53]=`I18nContext`,e[e.I18nAttributes=54]=`I18nAttributes`,e[e.SourceLocation=55]=`SourceLocation`,e[e.Animation=56]=`Animation`,e[e.AnimationString=57]=`AnimationString`,e[e.AnimationBinding=58]=`AnimationBinding`,e[e.AnimationListener=59]=`AnimationListener`,e[e.Control=60]=`Control`,e[e.ControlCreate=61]=`ControlCreate`,e})(S||{}),Ht=(function(e){return e[e.LexicalRead=0]=`LexicalRead`,e[e.Context=1]=`Context`,e[e.TrackContext=2]=`TrackContext`,e[e.ReadVariable=3]=`ReadVariable`,e[e.NextContext=4]=`NextContext`,e[e.Reference=5]=`Reference`,e[e.StoreLet=6]=`StoreLet`,e[e.ContextLetReference=7]=`ContextLetReference`,e[e.GetCurrentView=8]=`GetCurrentView`,e[e.RestoreView=9]=`RestoreView`,e[e.ResetView=10]=`ResetView`,e[e.PureFunctionExpr=11]=`PureFunctionExpr`,e[e.PureFunctionParameterExpr=12]=`PureFunctionParameterExpr`,e[e.PipeBinding=13]=`PipeBinding`,e[e.PipeBindingVariadic=14]=`PipeBindingVariadic`,e[e.SafePropertyRead=15]=`SafePropertyRead`,e[e.SafeKeyedRead=16]=`SafeKeyedRead`,e[e.SafeNavigationMigration=17]=`SafeNavigationMigration`,e[e.SafeTernaryExpr=18]=`SafeTernaryExpr`,e[e.EmptyExpr=19]=`EmptyExpr`,e[e.AssignTemporaryExpr=20]=`AssignTemporaryExpr`,e[e.ReadTemporaryExpr=21]=`ReadTemporaryExpr`,e[e.SlotLiteralExpr=22]=`SlotLiteralExpr`,e[e.ConditionalCase=23]=`ConditionalCase`,e[e.ConstCollected=24]=`ConstCollected`,e[e.TwoWayBindingSet=25]=`TwoWayBindingSet`,e[e.ForeignContent=26]=`ForeignContent`,e[e.ArrowFunction=27]=`ArrowFunction`,e})(Ht||{}),Ut=(function(e){return e[e.None=0]=`None`,e[e.AlwaysInline=1]=`AlwaysInline`,e})(Ut||{}),Wt=(function(e){return e[e.Context=0]=`Context`,e[e.Identifier=1]=`Identifier`,e[e.SavedView=2]=`SavedView`,e[e.Alias=3]=`Alias`,e})(Wt||{}),Gt=(function(e){return e[e.Attribute=0]=`Attribute`,e[e.ClassName=1]=`ClassName`,e[e.StyleProperty=2]=`StyleProperty`,e[e.Property=3]=`Property`,e[e.Template=4]=`Template`,e[e.I18n=5]=`I18n`,e[e.LegacyAnimation=6]=`LegacyAnimation`,e[e.TwoWayProperty=7]=`TwoWayProperty`,e[e.Animation=8]=`Animation`,e})(Gt||{}),Kt=(function(e){return e[e.Creation=0]=`Creation`,e[e.Postproccessing=1]=`Postproccessing`,e})(Kt||{}),qt=(function(e){return e[e.I18nText=0]=`I18nText`,e[e.I18nAttribute=1]=`I18nAttribute`,e})(qt||{}),Jt=(function(e){return e[e.None=0]=`None`,e[e.ElementTag=1]=`ElementTag`,e[e.TemplateTag=2]=`TemplateTag`,e[e.OpenTag=4]=`OpenTag`,e[e.CloseTag=8]=`CloseTag`,e[e.ExpressionIndex=16]=`ExpressionIndex`,e})(Jt||{}),Yt=(function(e){return e[e.HTML=0]=`HTML`,e[e.SVG=1]=`SVG`,e[e.Math=2]=`Math`,e})(Yt||{}),Xt=(function(e){return e[e.Idle=0]=`Idle`,e[e.Immediate=1]=`Immediate`,e[e.Timer=2]=`Timer`,e[e.Hover=3]=`Hover`,e[e.Interaction=4]=`Interaction`,e[e.Viewport=5]=`Viewport`,e[e.Never=6]=`Never`,e})(Xt||{}),Zt=(function(e){return e[e.RootI18n=0]=`RootI18n`,e[e.Icu=1]=`Icu`,e[e.Attr=2]=`Attr`,e})(Zt||{}),Qt=(function(e){return e[e.NgTemplate=0]=`NgTemplate`,e[e.Structural=1]=`Structural`,e[e.Block=2]=`Block`,e})(Qt||{}),$t=(function(e){return e[e.None=0]=`None`,e[e.InChildOperation=1]=`InChildOperation`,e[e.InArrowFunctionOperation=2]=`InArrowFunctionOperation`,e[e.InSafeNavigationMigration=4]=`InSafeNavigationMigration`,e})($t||{});S.Element,S.ElementStart,S.Container,S.ContainerStart,S.Template,S.RepeaterCreate,S.ConditionalCreate,S.ConditionalBranchCreate;var C=(function(e){return e[e.Tmpl=0]=`Tmpl`,e[e.Host=1]=`Host`,e[e.Both=2]=`Both`,e})(C||{}),en=(function(e){return e[e.Full=0]=`Full`,e[e.DomOnly=1]=`DomOnly`,e})(en||{});x.ariaProperty,x.ariaProperty,x.attribute,x.attribute,x.classProp,x.classProp,x.element,x.element,x.elementContainer,x.elementContainer,x.elementContainerEnd,x.elementContainerEnd,x.elementContainerStart,x.elementContainerStart,x.elementEnd,x.elementEnd,x.elementStart,x.elementStart,x.domProperty,x.domProperty,x.i18nExp,x.i18nExp,x.listener,x.listener,x.listener,x.listener,x.property,x.property,x.styleProp,x.styleProp,x.syntheticHostListener,x.syntheticHostListener,x.syntheticHostProperty,x.syntheticHostProperty,x.templateCreate,x.templateCreate,x.twoWayProperty,x.twoWayProperty,x.twoWayListener,x.twoWayListener,x.declareLet,x.declareLet,x.conditionalCreate,x.conditionalBranchCreate,x.conditionalBranchCreate,x.conditionalBranchCreate,x.domElement,x.domElement,x.domElementStart,x.domElementStart,x.domElementEnd,x.domElementEnd,x.domElementContainer,x.domElementContainer,x.domElementContainerStart,x.domElementContainerStart,x.domElementContainerEnd,x.domElementContainerEnd,x.domListener,x.domListener,x.domTemplate,x.domTemplate,x.animationEnter,x.animationEnter,x.animationLeave,x.animationLeave,x.animationEnterListener,x.animationEnterListener,x.animationLeaveListener,x.animationLeaveListener,y.And,y.Bigger,y.BiggerEquals,y.BitwiseOr,y.BitwiseAnd,y.Divide,y.Assign,y.Equals,y.Identical,y.Lower,y.LowerEquals,y.Minus,y.Modulo,y.Exponentiation,y.Multiply,y.NotEquals,y.NotIdentical,y.NullishCoalesce,y.Or,y.Plus,y.In,y.InstanceOf,y.AdditionAssignment,y.SubtractionAssignment,y.MultiplicationAssignment,y.DivisionAssignment,y.RemainderAssignment,y.ExponentiationAssignment,y.AndAssignment,y.OrAssignment,y.NullishCoalesceAssignment,S.Property,S.Property,S.Property,S.Attribute,S.Attribute,S.Property,S.TwoWayProperty,S.Container,S.ContainerStart,S.ContainerEnd,S.Element,S.ElementStart,S.ElementEnd,S.Template,S.ElementEnd,S.ElementStart,S.Element,S.ContainerEnd,S.ContainerStart,S.Container,S.I18nEnd,S.I18nStart,S.I18n,S.Pipe;var tn=` \f
\r	\v ᠎ - \u2028\u2029  　﻿`;`${tn}`,`${tn}`;var nn=(function(e){return e[e.Character=0]=`Character`,e[e.Identifier=1]=`Identifier`,e[e.PrivateIdentifier=2]=`PrivateIdentifier`,e[e.Keyword=3]=`Keyword`,e[e.String=4]=`String`,e[e.Operator=5]=`Operator`,e[e.Number=6]=`Number`,e[e.RegExpBody=7]=`RegExpBody`,e[e.RegExpFlags=8]=`RegExpFlags`,e[e.Error=9]=`Error`,e})(nn||{}),rn=(function(e){return e[e.Plain=0]=`Plain`,e[e.TemplateLiteralPart=1]=`TemplateLiteralPart`,e[e.TemplateLiteralEnd=2]=`TemplateLiteralEnd`,e})(rn||{});nn.Character,S.StyleMap,S.ClassMap,S.StyleProp,S.ClassProp,S.Attribute,S.Property,S.Attribute,S.Control,S.DomProperty,S.DomProperty,S.Attribute,S.StyleMap,S.ClassMap,S.StyleProp,S.ClassProp,S.Listener,S.TwoWayListener,S.AnimationListener,S.StyleMap,S.ClassMap,S.StyleProp,S.ClassProp,S.Property,S.TwoWayProperty,S.DomProperty,S.Attribute,S.Animation,S.Control,Xt.Idle,x.deferOnIdle,x.deferPrefetchOnIdle,x.deferHydrateOnIdle,Xt.Immediate,x.deferOnImmediate,x.deferPrefetchOnImmediate,x.deferHydrateOnImmediate,Xt.Timer,x.deferOnTimer,x.deferPrefetchOnTimer,x.deferHydrateOnTimer,Xt.Hover,x.deferOnHover,x.deferPrefetchOnHover,x.deferHydrateOnHover,Xt.Interaction,x.deferOnInteraction,x.deferPrefetchOnInteraction,x.deferHydrateOnInteraction,Xt.Viewport,x.deferOnViewport,x.deferPrefetchOnViewport,x.deferHydrateOnViewport,Xt.Never,x.deferHydrateNever,x.deferHydrateNever,x.deferHydrateNever,x.pipeBind1,x.pipeBind2,x.pipeBind3,x.pipeBind4,x.textInterpolate,x.textInterpolate1,x.textInterpolate2,x.textInterpolate3,x.textInterpolate4,x.textInterpolate5,x.textInterpolate6,x.textInterpolate7,x.textInterpolate8,x.textInterpolateV,x.interpolate,x.interpolate1,x.interpolate2,x.interpolate3,x.interpolate4,x.interpolate5,x.interpolate6,x.interpolate7,x.interpolate8,x.interpolateV,x.pureFunction0,x.pureFunction1,x.pureFunction2,x.pureFunction3,x.pureFunction4,x.pureFunction5,x.pureFunction6,x.pureFunction7,x.pureFunction8,x.pureFunctionV,x.resolveWindow,x.resolveDocument,x.resolveBody,rt.HTML,x.sanitizeHtml,rt.RESOURCE_URL,x.sanitizeResourceUrl,rt.SCRIPT,x.sanitizeScript,rt.STYLE,x.sanitizeStyle,rt.URL,x.sanitizeUrl,rt.ATTRIBUTE_NO_BINDING,x.validateAttribute,rt.HTML,x.trustConstantHtml,rt.RESOURCE_URL,x.trustConstantResourceUrl;var an=(function(e){return e[e.None=0]=`None`,e[e.ViewContextRead=1]=`ViewContextRead`,e[e.ViewContextWrite=2]=`ViewContextWrite`,e[e.SideEffectful=4]=`SideEffectful`,e})(an||{});C.Tmpl,C.Tmpl,C.Both,C.Host,C.Tmpl,C.Tmpl,C.Tmpl,C.Both,C.Both,C.Both,C.Tmpl,C.Both,C.Both,C.Tmpl,C.Both,C.Tmpl,C.Both,C.Both,C.Tmpl,C.Tmpl,C.Tmpl,C.Tmpl,C.Tmpl,C.Both,C.Both,C.Tmpl,C.Tmpl,C.Tmpl,C.Tmpl,C.Both,C.Both,C.Both,C.Tmpl,C.Tmpl,C.Both,C.Tmpl,C.Tmpl,C.Tmpl,C.Both,C.Both,C.Tmpl,C.Both,C.Both,C.Both,C.Both,C.Both,C.Tmpl,C.Tmpl,C.Tmpl,C.Tmpl,C.Tmpl,C.Tmpl,C.Tmpl,C.Tmpl,C.Tmpl,C.Tmpl,C.Tmpl,C.Tmpl,C.Both,C.Tmpl,C.Both,C.Tmpl,C.Both,C.Tmpl,C.Tmpl,C.Tmpl,C.Tmpl,C.Tmpl,C.Tmpl,C.Both,C.Both,C.Both,Pt.Property,Gt.Property,Pt.TwoWay,Gt.TwoWayProperty,Pt.Attribute,Gt.Attribute,Pt.Class,Gt.ClassName,Pt.Style,Gt.StyleProperty,Pt.LegacyAnimation,Gt.LegacyAnimation,Pt.Animation,Gt.Animation;var on=`%COMP%`;`${on}`,`${on}`,class e{static SINGLETON=new e;static veWillInferAnyFor(t){let n=e.SINGLETON;return t instanceof Nt?t.visit(n):t.receiver.visit(n)}visitUnary(e){return e.expr.visit(this)}visitBinary(e){return e.left.visit(this)||e.right.visit(this)}visitChain(){return!1}visitConditional(e){return e.condition.visit(this)||e.trueExp.visit(this)||e.falseExp.visit(this)}visitCall(){return!0}visitSafeCall(){return!1}visitImplicitReceiver(){return!1}visitThisReceiver(){return!1}visitInterpolation(e){return e.expressions.some(e=>e.visit(this))}visitKeyedRead(){return!1}visitLiteralArray(){return!0}visitLiteralMap(){return!0}visitLiteralPrimitive(){return!1}visitPipe(){return!0}visitPrefixNot(e){return e.expression.visit(this)}visitTypeofExpression(e){return e.expression.visit(this)}visitVoidExpression(e){return e.expression.visit(this)}visitNonNullAssert(e){return e.expression.visit(this)}visitPropertyRead(){return!1}visitSafePropertyRead(){return!1}visitSafeKeyedRead(){return!1}visitTemplateLiteral(){return!1}visitTemplateLiteralElement(){return!1}visitTaggedTemplateLiteral(){return!1}visitParenthesizedExpression(e){return e.expression.visit(this)}visitRegularExpressionLiteral(){return!1}visitSpreadElement(e){return e.expression.visit(this)}visitArrowFunction(e,t){return!1}};var sn=null,cn=!1,ln=1,un=null,dn=Symbol(`SIGNAL`);function w(e){let t=sn;return sn=e,t}function fn(){return sn}var pn={version:0,lastCleanEpoch:0,dirty:!1,producers:void 0,producersTail:void 0,consumers:void 0,consumersTail:void 0,recomputing:!1,consumerAllowSignalWrites:!1,consumerIsAlwaysLive:!1,kind:`unknown`,producerMustRecompute:()=>!1,producerRecomputeValue:()=>{},consumerMarkedDirty:()=>{},consumerOnSignalRead:()=>{}};function mn(e){if(cn)throw Error(``);if(sn===null)return;sn.consumerOnSignalRead(e);let t=sn.producersTail;if(t!==void 0&&t.producer===e)return;let n,r=sn.recomputing;if(r&&(n=t===void 0?sn.producers:t.nextProducer,n!==void 0&&n.producer===e)){sn.producersTail=n,n.lastReadVersion=e.version,n.knownValidAtEpoch=ln;return}let i=e.consumersTail;if(i!==void 0&&i.consumer===sn&&(!r||i.knownValidAtEpoch===ln))return;let a=kn(sn),o={producer:e,consumer:sn,nextProducer:n,prevConsumer:void 0,knownValidAtEpoch:ln,lastReadVersion:e.version,nextConsumer:void 0};sn.producersTail=o,t===void 0?sn.producers=o:t.nextProducer=o,a&&Dn(e,o)}function hn(){ln++}function gn(e){if((!kn(e)||e.dirty)&&(e.dirty||e.lastCleanEpoch!==ln)){if(!e.producerMustRecompute(e)&&!Tn(e)){bn(e);return}e.producerRecomputeValue(e),bn(e)}}function _n(e){if(e.consumers===void 0)return;let t=cn;cn=!0;try{for(let t=e.consumers;t!==void 0;t=t.nextConsumer){let e=t.consumer;e.dirty||yn(e)}}finally{cn=t}}function vn(){return sn?.consumerAllowSignalWrites!==!1}function yn(e){e.dirty=!0,_n(e),e.consumerMarkedDirty?.(e)}function bn(e){e.dirty=!1,e.lastCleanEpoch=ln}function xn(e){return e&&Sn(e),w(e)}function Sn(e){if(e.producersTail?.knownValidAtEpoch===ln){let t=e.producers;for(;t!==void 0;)t.knownValidAtEpoch=null,t=t.nextProducer}e.producersTail=void 0,e.recomputing=!0}function Cn(e,t){w(t),e&&wn(e)}function wn(e){e.recomputing=!1;let t=e.producersTail,n=t===void 0?e.producers:t.nextProducer;if(n!==void 0){if(kn(e))do n=On(n);while(n!==void 0);t===void 0?e.producers=void 0:t.nextProducer=void 0}}function Tn(e){for(let t=e.producers;t!==void 0;t=t.nextProducer){let e=t.producer,n=t.lastReadVersion;if(n!==e.version||(gn(e),n!==e.version))return!0}return!1}function En(e){if(kn(e)){let t=e.producers;for(;t!==void 0;)t=On(t)}e.producers=void 0,e.producersTail=void 0,e.consumers=void 0,e.consumersTail=void 0}function Dn(e,t){let n=e.consumersTail,r=kn(e);if(n===void 0?(t.nextConsumer=void 0,e.consumers=t):(t.nextConsumer=n.nextConsumer,n.nextConsumer=t),t.prevConsumer=n,e.consumersTail=t,!r)for(let t=e.producers;t!==void 0;t=t.nextProducer)Dn(t.producer,t)}function On(e){let t=e.producer,n=e.nextProducer,r=e.nextConsumer,i=e.prevConsumer;if(e.nextConsumer=void 0,e.prevConsumer=void 0,r===void 0?t.consumersTail=i:r.prevConsumer=i,i!==void 0)i.nextConsumer=r;else if(t.consumers=r,!kn(t)){let e=t.producers;for(;e!==void 0;)e=On(e)}return n}function kn(e){return e.consumerIsAlwaysLive||e.consumers!==void 0}function An(e){un?.(e)}function jn(e,t){return Object.is(e,t)}function Mn(e,t){let n=Object.create(In);n.computation=e,t!==void 0&&(n.equal=t);let r=()=>{if(gn(n),mn(n),n.value===Fn)throw n.error;return n.value};return r[dn]=n,An(n),r}var Nn=Symbol(`UNSET`),Pn=Symbol(`COMPUTING`),Fn=Symbol(`ERRORED`),In={...pn,value:Nn,dirty:!0,error:null,equal:jn,kind:`computed`,producerMustRecompute(e){return e.value===Nn||e.value===Pn},producerRecomputeValue(e){if(e.value===Pn)throw Error(``);let t=e.value;e.value=Pn;let n=xn(e),r,i=!1;try{r=e.computation(),w(null),i=t!==Nn&&t!==Fn&&r!==Fn&&e.equal(t,r)}catch(t){r=Fn,e.error=t}finally{Cn(e,n)}if(i){e.value=t;return}e.value=r,e.version++}};function Ln(){throw Error()}var Rn=Ln;function zn(e){Rn(e)}function Bn(e){Rn=e}var Vn=null;function Hn(e,t){let n=Object.create(Kn);n.value=e,t!==void 0&&(n.equal=t);let r=()=>Un(n);return r[dn]=n,An(n),[r,e=>Wn(n,e),e=>Gn(n,e)]}function Un(e){return mn(e),e.value}function Wn(e,t){vn()||zn(e),e.equal(e.value,t)||(e.value=t,qn(e))}function Gn(e,t){vn()||zn(e),Wn(e,t(e.value))}var Kn={...pn,equal:jn,value:void 0,kind:`signal`};function qn(e){e.version++,hn(),_n(e),Vn?.(e)}var Jn={...pn,consumerIsAlwaysLive:!0,consumerAllowSignalWrites:!0,dirty:!0,kind:`effect`};function Yn(e){if(e.dirty=!1,e.version>0&&!Tn(e))return;e.version++;let t=xn(e);try{e.cleanup(),e.fn()}finally{Cn(e,t)}}var Xn=void 0;function Zn(){return Xn}function Qn(e){let t=Xn;return Xn=e,t}var $n=Symbol(`NotFound`);function er(e){return e===$n||e?.name===`ɵNotFound`}function tr(e,t,n){let r=Object.create(ir);r.source=e,r.computation=t,n!=null&&(r.equal=n);let i=()=>{if(gn(r),mn(r),r.value===Fn)throw r.error;return r.value};return i[dn]=r,An(r),i}function nr(e,t){gn(e),Wn(e,t),bn(e)}function rr(e,t){if(gn(e),e.value===Fn)throw e.error;Gn(e,t),bn(e)}var ir={...pn,value:Nn,dirty:!0,error:null,equal:jn,kind:`linkedSignal`,producerMustRecompute(e){return e.value===Nn||e.value===Pn},producerRecomputeValue(e){if(e.value===Pn)throw Error(``);let t=e.value;e.value=Pn;let n=xn(e),r,i=!1;try{let n=e.source(),a=t!==Nn&&t!==Fn,o=a?{source:e.sourceValue,value:t}:void 0;r=e.computation(n,o),e.sourceValue=n,w(null),i=a&&r!==Fn&&e.equal(t,r)}catch(t){r=Fn,e.error=t}finally{Cn(e,n)}if(i){e.value=t;return}e.value=r,e.version++}};function ar(e){let t=w(null);try{return e()}finally{w(t)}}var or=function(e,t){return or=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(e,t){e.__proto__=t}||function(e,t){for(var n in t)Object.prototype.hasOwnProperty.call(t,n)&&(e[n]=t[n])},or(e,t)};function sr(e,t){if(typeof t!=`function`&&t!==null)throw TypeError(`Class extends value `+String(t)+` is not a constructor or null`);or(e,t);function n(){this.constructor=e}e.prototype=t===null?Object.create(t):(n.prototype=t.prototype,new n)}function cr(e){var t=typeof Symbol==`function`&&Symbol.iterator,n=t&&e[t],r=0;if(n)return n.call(e);if(e&&typeof e.length==`number`)return{next:function(){return e&&r>=e.length&&(e=void 0),{value:e&&e[r++],done:!e}}};throw TypeError(t?`Object is not iterable.`:`Symbol.iterator is not defined.`)}function lr(e,t){var n=typeof Symbol==`function`&&e[Symbol.iterator];if(!n)return e;var r=n.call(e),i,a=[],o;try{for(;(t===void 0||t-->0)&&!(i=r.next()).done;)a.push(i.value)}catch(e){o={error:e}}finally{try{i&&!i.done&&(n=r.return)&&n.call(r)}finally{if(o)throw o.error}}return a}function ur(e,t,n){if(n||arguments.length===2)for(var r=0,i=t.length,a;r<i;r++)(a||!(r in t))&&(a||=Array.prototype.slice.call(t,0,r),a[r]=t[r]);return e.concat(a||Array.prototype.slice.call(t))}function dr(e){return typeof e==`function`}function fr(e){var t=e(function(e){Error.call(e),e.stack=Error().stack});return t.prototype=Object.create(Error.prototype),t.prototype.constructor=t,t}var pr=fr(function(e){return function(t){e(this),this.message=t?t.length+` errors occurred during unsubscription:
`+t.map(function(e,t){return t+1+`) `+e.toString()}).join(`
  `):``,this.name=`UnsubscriptionError`,this.errors=t}});function mr(e,t){if(e){var n=e.indexOf(t);0<=n&&e.splice(n,1)}}var hr=function(){function e(e){this.initialTeardown=e,this.closed=!1,this._parentage=null,this._finalizers=null}return e.prototype.unsubscribe=function(){var e,t,n,r,i;if(!this.closed){this.closed=!0;var a=this._parentage;if(a){if(this._parentage=null,Array.isArray(a))try{for(var o=cr(a),s=o.next();!s.done;s=o.next())s.value.remove(this)}catch(t){e={error:t}}finally{try{s&&!s.done&&(t=o.return)&&t.call(o)}finally{if(e)throw e.error}}else a.remove(this)}var c=this.initialTeardown;if(dr(c))try{c()}catch(e){i=e instanceof pr?e.errors:[e]}var l=this._finalizers;if(l){this._finalizers=null;try{for(var u=cr(l),d=u.next();!d.done;d=u.next()){var f=d.value;try{vr(f)}catch(e){i??=[],e instanceof pr?i=ur(ur([],lr(i)),lr(e.errors)):i.push(e)}}}catch(e){n={error:e}}finally{try{d&&!d.done&&(r=u.return)&&r.call(u)}finally{if(n)throw n.error}}}if(i)throw new pr(i)}},e.prototype.add=function(t){if(t&&t!==this){if(this.closed)vr(t);else{if(t instanceof e){if(t.closed||t._hasParent(this))return;t._addParent(this)}(this._finalizers=this._finalizers??[]).push(t)}}},e.prototype._hasParent=function(e){var t=this._parentage;return t===e||Array.isArray(t)&&t.includes(e)},e.prototype._addParent=function(e){var t=this._parentage;this._parentage=Array.isArray(t)?(t.push(e),t):t?[t,e]:e},e.prototype._removeParent=function(e){var t=this._parentage;t===e?this._parentage=null:Array.isArray(t)&&mr(t,e)},e.prototype.remove=function(t){var n=this._finalizers;n&&mr(n,t),t instanceof e&&t._removeParent(this)},e.EMPTY=(function(){var t=new e;return t.closed=!0,t})(),e}(),gr=hr.EMPTY;function _r(e){return e instanceof hr||e&&`closed`in e&&dr(e.remove)&&dr(e.add)&&dr(e.unsubscribe)}function vr(e){dr(e)?e():e.unsubscribe()}var yr={onUnhandledError:null,onStoppedNotification:null,Promise:void 0,useDeprecatedSynchronousErrorHandling:!1,useDeprecatedNextContext:!1},br={setTimeout:function(e,t){var n=[...arguments].slice(2),r=br.delegate;return r?.setTimeout?r.setTimeout.apply(r,ur([e,t],lr(n))):setTimeout.apply(void 0,ur([e,t],lr(n)))},clearTimeout:function(e){return(br.delegate?.clearTimeout||clearTimeout)(e)},delegate:void 0};function xr(e){br.setTimeout(function(){var t=yr.onUnhandledError;if(t)t(e);else throw e})}function Sr(){}var Cr=(function(){return Er(`C`,void 0,void 0)})();function wr(e){return Er(`E`,void 0,e)}function Tr(e){return Er(`N`,e,void 0)}function Er(e,t,n){return{kind:e,value:t,error:n}}var Dr=null;function Or(e){if(yr.useDeprecatedSynchronousErrorHandling){var t=!Dr;if(t&&(Dr={errorThrown:!1,error:null}),e(),t){var n=Dr,r=n.errorThrown,i=n.error;if(Dr=null,r)throw i}}else e()}function kr(e){yr.useDeprecatedSynchronousErrorHandling&&Dr&&(Dr.errorThrown=!0,Dr.error=e)}var Ar=function(e){sr(t,e);function t(t){var n=e.call(this)||this;return n.isStopped=!1,t?(n.destination=t,_r(t)&&t.add(n)):n.destination=Rr,n}return t.create=function(e,t,n){return new Pr(e,t,n)},t.prototype.next=function(e){this.isStopped?Lr(Tr(e),this):this._next(e)},t.prototype.error=function(e){this.isStopped?Lr(wr(e),this):(this.isStopped=!0,this._error(e))},t.prototype.complete=function(){this.isStopped?Lr(Cr,this):(this.isStopped=!0,this._complete())},t.prototype.unsubscribe=function(){this.closed||(this.isStopped=!0,e.prototype.unsubscribe.call(this),this.destination=null)},t.prototype._next=function(e){this.destination.next(e)},t.prototype._error=function(e){try{this.destination.error(e)}finally{this.unsubscribe()}},t.prototype._complete=function(){try{this.destination.complete()}finally{this.unsubscribe()}},t}(hr),jr=Function.prototype.bind;function Mr(e,t){return jr.call(e,t)}var Nr=function(){function e(e){this.partialObserver=e}return e.prototype.next=function(e){var t=this.partialObserver;if(t.next)try{t.next(e)}catch(e){Fr(e)}},e.prototype.error=function(e){var t=this.partialObserver;if(t.error)try{t.error(e)}catch(e){Fr(e)}else Fr(e)},e.prototype.complete=function(){var e=this.partialObserver;if(e.complete)try{e.complete()}catch(e){Fr(e)}},e}(),Pr=function(e){sr(t,e);function t(t,n,r){var i=e.call(this)||this,a;if(dr(t)||!t)a={next:t??void 0,error:n??void 0,complete:r??void 0};else{var o;i&&yr.useDeprecatedNextContext?(o=Object.create(t),o.unsubscribe=function(){return i.unsubscribe()},a={next:t.next&&Mr(t.next,o),error:t.error&&Mr(t.error,o),complete:t.complete&&Mr(t.complete,o)}):a=t}return i.destination=new Nr(a),i}return t}(Ar);function Fr(e){yr.useDeprecatedSynchronousErrorHandling?kr(e):xr(e)}function Ir(e){throw e}function Lr(e,t){var n=yr.onStoppedNotification;n&&br.setTimeout(function(){return n(e,t)})}var Rr={closed:!0,next:Sr,error:Ir,complete:Sr},zr=(function(){return typeof Symbol==`function`&&Symbol.observable||`@@observable`})();function Br(e){return e}function Vr(e){return e.length===0?Br:e.length===1?e[0]:function(t){return e.reduce(function(e,t){return t(e)},t)}}var Hr=function(){function e(e){e&&(this._subscribe=e)}return e.prototype.lift=function(t){var n=new e;return n.source=this,n.operator=t,n},e.prototype.subscribe=function(e,t,n){var r=this,i=Gr(e)?e:new Pr(e,t,n);return Or(function(){var e=r,t=e.operator,n=e.source;i.add(t?t.call(i,n):n?r._subscribe(i):r._trySubscribe(i))}),i},e.prototype._trySubscribe=function(e){try{return this._subscribe(e)}catch(t){e.error(t)}},e.prototype.forEach=function(e,t){var n=this;return t=Ur(t),new t(function(t,r){var i=new Pr({next:function(t){try{e(t)}catch(e){r(e),i.unsubscribe()}},error:r,complete:t});n.subscribe(i)})},e.prototype._subscribe=function(e){return this.source?.subscribe(e)},e.prototype[zr]=function(){return this},e.prototype.pipe=function(){return Vr([...arguments])(this)},e.prototype.toPromise=function(e){var t=this;return e=Ur(e),new e(function(e,n){var r;t.subscribe(function(e){return r=e},function(e){return n(e)},function(){return e(r)})})},e.create=function(t){return new e(t)},e}();function Ur(e){return e??yr.Promise??Promise}function Wr(e){return e&&dr(e.next)&&dr(e.error)&&dr(e.complete)}function Gr(e){return e&&e instanceof Ar||Wr(e)&&_r(e)}function Kr(e){return dr(e?.lift)}function qr(e){return function(t){if(Kr(t))return t.lift(function(t){try{return e(t,this)}catch(e){this.error(e)}});throw TypeError(`Unable to lift unknown Observable type`)}}function Jr(e,t,n,r,i){return new Yr(e,t,n,r,i)}var Yr=function(e){sr(t,e);function t(t,n,r,i,a,o){var s=e.call(this,t)||this;return s.onFinalize=a,s.shouldUnsubscribe=o,s._next=n?function(e){try{n(e)}catch(e){t.error(e)}}:e.prototype._next,s._error=i?function(e){try{i(e)}catch(e){t.error(e)}finally{this.unsubscribe()}}:e.prototype._error,s._complete=r?function(){try{r()}catch(e){t.error(e)}finally{this.unsubscribe()}}:e.prototype._complete,s}return t.prototype.unsubscribe=function(){var t;if(!this.shouldUnsubscribe||this.shouldUnsubscribe()){var n=this.closed;e.prototype.unsubscribe.call(this),!n&&((t=this.onFinalize)==null||t.call(this))}},t}(Ar),Xr=fr(function(e){return function(){e(this),this.name=`ObjectUnsubscribedError`,this.message=`object unsubscribed`}}),Zr=function(e){sr(t,e);function t(){var t=e.call(this)||this;return t.closed=!1,t.currentObservers=null,t.observers=[],t.isStopped=!1,t.hasError=!1,t.thrownError=null,t}return t.prototype.lift=function(e){var t=new Qr(this,this);return t.operator=e,t},t.prototype._throwIfClosed=function(){if(this.closed)throw new Xr},t.prototype.next=function(e){var t=this;Or(function(){var n,r;if(t._throwIfClosed(),!t.isStopped){t.currentObservers||=Array.from(t.observers);try{for(var i=cr(t.currentObservers),a=i.next();!a.done;a=i.next())a.value.next(e)}catch(e){n={error:e}}finally{try{a&&!a.done&&(r=i.return)&&r.call(i)}finally{if(n)throw n.error}}}})},t.prototype.error=function(e){var t=this;Or(function(){if(t._throwIfClosed(),!t.isStopped){t.hasError=t.isStopped=!0,t.thrownError=e;for(var n=t.observers;n.length;)n.shift().error(e)}})},t.prototype.complete=function(){var e=this;Or(function(){if(e._throwIfClosed(),!e.isStopped){e.isStopped=!0;for(var t=e.observers;t.length;)t.shift().complete()}})},t.prototype.unsubscribe=function(){this.isStopped=this.closed=!0,this.observers=this.currentObservers=null},Object.defineProperty(t.prototype,"observed",{get:function(){return this.observers?.length>0},enumerable:!1,configurable:!0}),t.prototype._trySubscribe=function(t){return this._throwIfClosed(),e.prototype._trySubscribe.call(this,t)},t.prototype._subscribe=function(e){return this._throwIfClosed(),this._checkFinalizedStatuses(e),this._innerSubscribe(e)},t.prototype._innerSubscribe=function(e){var t=this,n=this,r=n.hasError,i=n.isStopped,a=n.observers;return r||i?gr:(this.currentObservers=null,a.push(e),new hr(function(){t.currentObservers=null,mr(a,e)}))},t.prototype._checkFinalizedStatuses=function(e){var t=this,n=t.hasError,r=t.thrownError,i=t.isStopped;n?e.error(r):i&&e.complete()},t.prototype.asObservable=function(){var e=new Hr;return e.source=this,e},t.create=function(e,t){return new Qr(e,t)},t}(Hr),Qr=function(e){sr(t,e);function t(t,n){var r=e.call(this)||this;return r.destination=t,r.source=n,r}return t.prototype.next=function(e){var t,n;(n=(t=this.destination)?.next)==null||n.call(t,e)},t.prototype.error=function(e){var t,n;(n=(t=this.destination)?.error)==null||n.call(t,e)},t.prototype.complete=function(){var e,t;(t=(e=this.destination)?.complete)==null||t.call(e)},t.prototype._subscribe=function(e){return this.source?.subscribe(e)??gr},t}(Zr),$r=function(e){sr(t,e);function t(t){var n=e.call(this)||this;return n._value=t,n}return Object.defineProperty(t.prototype,"value",{get:function(){return this.getValue()},enumerable:!1,configurable:!0}),t.prototype._subscribe=function(t){var n=e.prototype._subscribe.call(this,t);return!n.closed&&t.next(this._value),n},t.prototype.getValue=function(){var e=this,t=e.hasError,n=e.thrownError,r=e._value;if(t)throw n;return this._throwIfClosed(),r},t.prototype.next=function(t){e.prototype.next.call(this,this._value=t)},t}(Zr);function ei(e,t){return qr(function(n,r){var i=0;n.subscribe(Jr(r,function(n){r.next(e.call(t,n,i++))}))})}var ti=`https://angular.dev/best-practices/security#preventing-cross-site-scripting-xss`,T=class extends Error{code;constructor(e,t){super(ri(e,t)),this.code=e}};function ni(e){return`NG0${Math.abs(e)}`}function ri(e,t){return`${ni(e)}${t?`: `+t:``}`}function ii(e){for(let t in e)if(e[t]===ii)return t;throw Error(``)}function ai(e){if(typeof e==`string`)return e;if(Array.isArray(e))return`[${e.map(ai).join(`, `)}]`;if(e==null)return``+e;let t=e.overriddenName||e.name;if(t)return`${t}`;let n=e.toString();if(n==null)return``+n;let r=n.indexOf(`
`);return r>=0?n.slice(0,r):n}function oi(e,t){return e?t?`${e} ${t}`:e:t||``}var si=ii({__forward_ref__:ii});function ci(e){return e.__forward_ref__=ci,e}function li(e){return ui(e)?e():e}function ui(e){return typeof e==`function`&&Object.hasOwn(e,si)&&e.__forward_ref__===ci}function di(e){return{token:e.token,providedIn:e.providedIn||null,factory:e.factory,value:void 0}}function fi(e){return pi(e,gi)}function pi(e,t){return Object.hasOwn(e,t)&&e[t]||null}function mi(e){return(e?.[gi]??null)||null}function hi(e){return e&&Object.hasOwn(e,_i)?e[_i]:null}var gi=ii({ɵprov:ii}),_i=ii({ɵinj:ii}),vi=class{_desc;ngMetadataName=`InjectionToken`;ɵprov;constructor(e,t){this._desc=e,this.ɵprov=void 0,typeof t==`number`?this.__NG_ELEMENT_ID__=t:t!==void 0&&(this.ɵprov=di({token:this,providedIn:t.providedIn||`root`,factory:t.factory}))}get multi(){return this}toString(){return`InjectionToken ${this._desc}`}};function yi(e){return e&&!!e.ɵproviders}var bi=ii({ɵcmp:ii}),xi=ii({ɵdir:ii}),Si=ii({ɵpipe:ii}),Ci=ii({ɵfac:ii}),wi=ii({__NG_ELEMENT_ID__:ii}),Ti=ii({__NG_ENV_ID__:ii});function Ei(e){return ki(e,`@Component`),e[bi]||null}function Di(e){return ki(e,`@Directive`),e[xi]||null}function Oi(e){return ki(e,`@Pipe`),e[Si]||null}function ki(e,t){if(e==null)throw new T(-919,!1)}function Ai(e){return typeof e==`string`?e:e==null?``:String(e)}var ji=ii({ngErrorCode:ii}),Mi=ii({ngErrorMessage:ii}),Ni=ii({ngTokenPath:ii});function Pi(e,t){return Ii(``,-200,t)}function Fi(e,t){throw new T(-201,!1)}function Ii(e,t,n){let r=new T(t,e);return r[ji]=t,r[Mi]=e,n&&(r[Ni]=n),r}function Li(e){return e[ji]}var Ri;function zi(){return Ri}function Bi(e){let t=Ri;return Ri=e,t}function Vi(e,t,n){let r=fi(e);if(r&&r.providedIn==`root`)return r.value===void 0?r.value=r.factory():r.value;if(n&8)return null;if(t!==void 0)return t;Fi(e,``)}var Hi=globalThis,Ui={},Wi=`__NG_DI_FLAG__`,Gi=class{injector;constructor(e){this.injector=e}retrieve(e,t){let n=Ji(t)||0;try{return this.injector.get(e,n&8?null:Ui,n)}catch(e){if(er(e))return e;throw e}}};function Ki(e,t=0){let n=Zn();if(n===void 0)throw new T(-203,!1);if(n===null)return Vi(e,void 0,t);{let r=Yi(t),i=n.retrieve(e,r);if(er(i)){if(r.optional)return null;throw i}return i}}function qi(e,t=0){return(zi()||Ki)(li(e),t)}function E(e,t){return qi(e,Ji(t))}function Ji(e){return e===void 0||typeof e==`number`?e:0|(e.optional&&8)|(e.host&&1)|(e.self&&2)|(e.skipSelf&&4)}function Yi(e){return{optional:!!(e&8),host:!!(e&1),self:!!(e&2),skipSelf:!!(e&4)}}function Xi(e){let t=[];for(let n=0;n<e.length;n++){let r=li(e[n]);if(Array.isArray(r)){if(r.length===0)throw new T(900,!1);let e,n=0;for(let t=0;t<r.length;t++){let i=r[t],a=Zi(i);typeof a==`number`?a===-1?e=i.token:n|=a:e=i}t.push(qi(e,n))}else t.push(qi(r))}return t}function Zi(e){return e[Wi]}function Qi(e,t){return Object.hasOwn(e,Ci)?e[Ci]:null}function $i(e,t,n){if(e.length!==t.length)return!1;for(let r=0;r<e.length;r++){let i=e[r],a=t[r];if(n&&(i=n(i),a=n(a)),a!==i)return!1}return!0}function ea(e){return e.flat(1/0)}function ta(e,t){e.forEach(e=>Array.isArray(e)?ta(e,t):t(e))}function na(e,t,n){t>=e.length?e.push(n):e.splice(t,0,n)}function ra(e,t){return t>=e.length-1?e.pop():e.splice(t,1)[0]}function ia(e,t,n,r){let i=e.length;if(i==t)e.push(n,r);else if(i===1)e.push(r,e[0]),e[0]=n;else{for(i--,e.push(e[i-1],e[i]);i>t;){let t=i-2;e[i]=e[t],i--}e[t]=n,e[t+1]=r}}function aa(e,t,n){let r=sa(e,t);return r>=0?e[r|1]=n:(r=~r,ia(e,r,t,n)),r}function oa(e,t){let n=sa(e,t);if(n>=0)return e[n|1]}function sa(e,t){return ca(e,t,1)}function ca(e,t,n){let r=0,i=e.length>>n;for(;i!==r;){let a=r+(i-r>>1),o=e[a<<n];if(t===o)return a<<n;o>t?i=a:r=a+1}return~(i<<n)}var la={},ua=[],da=new vi(``),fa=new vi(``,-1),pa=new vi(``),ma=class{get(e,t=Ui){if(t===Ui){let e=Ii(``,-201);throw e.name=`ɵNotFound`,e}return t}};function ha(...e){return{ɵproviders:ga(!0,e),ɵfromNgModule:!0}}function ga(e,...t){let n=[],r=new Set,i,a=e=>{n.push(e)};return ta(t,e=>{let t=e;va(t,a,[],r)&&(i||=[],i.push(t))}),i!==void 0&&_a(i,a),n}function _a(e,t){for(let n=0;n<e.length;n++){let{ngModule:r,providers:i}=e[n];ya(i,e=>{t(e,r)})}}function va(e,t,n,r){if(e=li(e),!e)return!1;let i=null,a=hi(e),o=!a&&Ei(e);if(!a&&!o){let t=e.ngModule;if(a=hi(t),a)i=t;else return!1}else if(o&&!o.standalone)return!1;else i=e;let s=r.has(i);if(o){if(s)return!1;if(r.add(i),o.dependencies){let e=typeof o.dependencies==`function`?o.dependencies():o.dependencies;for(let i of e)va(i,t,n,r)}}else if(a){if(a.imports!=null&&!s){r.add(i);let e;try{ta(a.imports,i=>{va(i,t,n,r)&&(e||=[],e.push(i))})}finally{}e!==void 0&&_a(e,t)}if(!s){let e=Qi(i)||(()=>new i);t({provide:i,useFactory:e,deps:ua},i),t({provide:pa,useValue:i,multi:!0},i),t({provide:da,useValue:()=>qi(i),multi:!0},i)}let o=a.providers;if(o!=null&&!s){let n=e;ya(o,e=>{t(e,n)})}}else return!1;return i!==e&&e.providers!==void 0}function ya(e,t){for(let n of e)yi(n)&&(n=n.ɵproviders),Array.isArray(n)?ya(n,t):t(n)}var ba=ii({provide:String,useValue:ii});function xa(e){return typeof e==`object`&&!!e&&ba in e}function Sa(e){return!!(e&&e.useExisting)}function Ca(e){return!!(e&&e.useFactory)}function wa(e){return typeof e==`function`}var Ta=new vi(``),Ea={},Da={},Oa=void 0;function ka(){return Oa===void 0&&(Oa=new ma),Oa}var Aa=class{},ja=class extends Aa{parent;source;scopes;records=new Map;_ngOnDestroyHooks=new Set;_onDestroyHooks=[];get destroyed(){return this._destroyed}_destroyed=!1;injectorDefTypes;constructor(e,t,n,r){super(),this.parent=t,this.source=n,this.scopes=r,Va(e,e=>this.processProvider(e)),this.records.set(fa,La(void 0,this)),r.has(`environment`)&&this.records.set(Aa,La(void 0,this));let i=this.records.get(Ta);i!=null&&typeof i.value==`string`&&this.scopes.add(i.value),this.injectorDefTypes=new Set(this.get(pa,ua,{self:!0}))}retrieve(e,t){let n=Ji(t)||0;try{return this.get(e,Ui,n)}catch(e){if(er(e))return e;throw e}}destroy(){Ia(this),this._destroyed=!0;let e=w(null);try{for(let e of this._ngOnDestroyHooks)e.ngOnDestroy();let e=this._onDestroyHooks;this._onDestroyHooks=[];for(let t of e)t()}finally{this.records.clear(),this._ngOnDestroyHooks.clear(),this.injectorDefTypes.clear(),w(e)}}onDestroy(e){return Ia(this),this._onDestroyHooks.push(e),()=>this.removeOnDestroy(e)}runInContext(e){Ia(this);let t=Qn(this),n=Bi(void 0);try{return e()}finally{Qn(t),Bi(n)}}get(e,t=Ui,n){if(Ia(this),Object.hasOwn(e,Ti))return e[Ti](this);let r=Ji(n),i=Qn(this),a=Bi(void 0);try{if(!(r&4)){let t=this.records.get(e);if(t===void 0){let n=Ba(e)&&fi(e);t=n&&this.injectableDefInScope(n)?La(Ma(e),Ea):null,this.records.set(e,t)}if(t!=null)return this.hydrate(e,t,r)}let n=r&2?ka():this.parent;return t=r&8&&t===Ui?null:t,n.get(e,t)}catch(e){let t=Li(e);throw t===-200||t===-201?new T(t,null):e}finally{Bi(a),Qn(i)}}resolveInjectorInitializers(){let e=w(null),t=Qn(this),n=Bi(void 0);try{let e=this.get(da,ua,{self:!0});for(let t of e)t()}finally{Qn(t),Bi(n),w(e)}}toString(){return`R3Injector[...]`}processProvider(e){e=li(e);let t=wa(e)?e:li(e&&e.provide),n=Pa(e);if(!wa(e)&&e.multi===!0){let n=this.records.get(t);n||(n=La(void 0,Ea,!0),n.factory=()=>Xi(n.multi),this.records.set(t,n)),t=e,n.multi.push(e)}this.records.set(t,n)}hydrate(e,t,n){let r=w(null);try{if(t.value===Da)throw Pi(``);return t.value===Ea&&(t.value=Da,t.value=t.factory(void 0,n)),typeof t.value==`object`&&t.value&&za(t.value)&&this._ngOnDestroyHooks.add(t.value),t.value}finally{w(r)}}injectableDefInScope(e){if(!e.providedIn)return!1;let t=li(e.providedIn);return typeof t==`string`?t===`any`||this.scopes.has(t):this.injectorDefTypes.has(t)}removeOnDestroy(e){let t=this._onDestroyHooks.indexOf(e);t!==-1&&this._onDestroyHooks.splice(t,1)}};function Ma(e){let t=fi(e),n=t===null?Qi(e):t.factory;if(n!==null)return n;if(e instanceof vi)throw new T(-204,!1);if(e instanceof Function)return Na(e);throw new T(-204,!1)}function Na(e){if(e.length>0)throw new T(-204,!1);let t=mi(e);return t===null?()=>new e:()=>t.factory(e)}function Pa(e){return xa(e)?La(void 0,e.useValue):La(Fa(e),Ea)}function Fa(e,t,n){let r;if(wa(e)){let t=li(e);return Qi(t)||Ma(t)}if(xa(e))r=()=>li(e.useValue);else if(Ca(e))r=()=>e.useFactory(...Xi(e.deps||[]));else if(Sa(e))r=(t,n)=>qi(li(e.useExisting),n!==void 0&&n&8?8:void 0);else{let t=li(e&&(e.useClass||e.provide));if(Ra(e))r=()=>new t(...Xi(e.deps));else return Qi(t)||Ma(t)}return r}function Ia(e){if(e.destroyed)throw new T(-205,!1)}function La(e,t,n=!1){return{factory:e,value:t,multi:n?[]:void 0}}function Ra(e){return!!e.deps}function za(e){return typeof e==`object`&&!!e&&typeof e.ngOnDestroy==`function`}function Ba(e){return typeof e==`function`||typeof e==`object`&&e.ngMetadataName===`InjectionToken`}function Va(e,t){for(let n of e)Array.isArray(n)?Va(n,t):n&&yi(n)?Va(n.ɵproviders,t):t(n)}function Ha(e,t){let n;e instanceof ja?(Ia(e),n=e):n=new Gi(e);let r=Qn(n),i=Bi(void 0);try{return t()}finally{Qn(r),Bi(i)}}function Ua(){return zi()!==void 0||Zn()!=null}var Wa=1;function Ga(e){return Array.isArray(e)&&typeof e[Wa]==`object`}function Ka(e){return Array.isArray(e)&&e[Wa]===!0}function qa(e){return!!(e.flags&4)}function Ja(e){return e.componentOffset>-1}function Ya(e){return(e.flags&1)==1}function Xa(e){return!!e.template}function Za(e){return!!(e[2]&512)}function Qa(e){return(e[2]&256)==256}var $a=(function(e){return e[e.NONE=0]=`NONE`,e[e.HTML=1]=`HTML`,e[e.STYLE=2]=`STYLE`,e[e.SCRIPT=3]=`SCRIPT`,e[e.URL=4]=`URL`,e[e.RESOURCE_URL=5]=`RESOURCE_URL`,e[e.ATTRIBUTE_NO_BINDING=6]=`ATTRIBUTE_NO_BINDING`,e})($a||{}),eo=`math`;function to(e){for(;Array.isArray(e);)e=e[0];return e}function no(e,t){return to(t[e])}function ro(e,t){return to(t[e.index])}function io(e,t){return e.data[t]}function ao(e,t){return e[t]}function oo(e,t,n,r){n>=e.data.length&&(e.data[n]=null,e.blueprint[n]=null),t[n]=r}function so(e,t){let n=t[e];return Ga(n)?n:n[0]}function co(e){return(e[2]&128)==128}function lo(e){return Ka(e[3])}function uo(e,t){return t==null?null:e[t]}function fo(e){e[17]=0}function po(e){e[2]&1024||(e[2]|=1024,co(e)&&_o(e))}function mo(e,t){for(;e>0;)t=t[14],e--;return t}function ho(e){return!!(e[2]&9216||e[24]?.dirty)}function go(e){e[10].changeDetectionScheduler?.notify(8),e[2]&64&&(e[2]|=1024),ho(e)&&_o(e)}function _o(e){e[10].changeDetectionScheduler?.notify(0);let t=bo(e);for(;t!==null&&!(t[2]&8192||(t[2]|=8192,!co(t)));)t=bo(t)}function vo(e,t){if(Qa(e))throw new T(911,!1);e[21]===null&&(e[21]=[]),e[21].push(t)}function yo(e,t){if(e[21]===null)return;let n=e[21].indexOf(t);n!==-1&&e[21].splice(n,1)}function bo(e){let t=e[3];return Ka(t)?t[3]:t}function xo(e){return e[7]??=[]}function So(e){return e.cleanup??=[]}function Co(e,t,n,r){let i=xo(t);i.push(n),e.firstCreatePass&&So(e).push(r,i.length-1)}var wo={lFrame:as(null),bindingsEnabled:!0,skipHydrationRootTNode:null},To=!1;function Eo(){return wo.lFrame.elementDepthCount}function Do(){wo.lFrame.elementDepthCount++}function Oo(){wo.lFrame.elementDepthCount--}function ko(){return wo.bindingsEnabled}function Ao(){return wo.skipHydrationRootTNode!==null}function jo(e){return wo.skipHydrationRootTNode===e}function Mo(){wo.skipHydrationRootTNode=null}function D(){return wo.lFrame.lView}function No(){return wo.lFrame.tView}function O(e){return wo.lFrame.contextLView=e,e[8]}function k(e){return wo.lFrame.contextLView=null,e}function Po(){let e=Fo();for(;e!==null&&e.type===64;)e=e.parent;return e}function Fo(){return wo.lFrame.currentTNode}function Io(){let e=wo.lFrame,t=e.currentTNode;return e.isParent?t:t.parent}function Lo(e,t){let n=wo.lFrame;n.currentTNode=e,n.isParent=t}function Ro(){return wo.lFrame.isParent}function zo(){wo.lFrame.isParent=!1}function Bo(){return wo.lFrame.contextLView}function Vo(){return To}function Ho(e){let t=To;return To=e,t}function Uo(){let e=wo.lFrame,t=e.bindingRootIndex;return t===-1&&(t=e.bindingRootIndex=e.tView.bindingStartIndex),t}function Wo(){return wo.lFrame.bindingIndex}function Go(e){return wo.lFrame.bindingIndex=e}function Ko(){return wo.lFrame.bindingIndex++}function qo(e){let t=wo.lFrame,n=t.bindingIndex;return t.bindingIndex+=e,n}function Jo(){return wo.lFrame.inI18n}function Yo(e,t){let n=wo.lFrame;n.bindingIndex=n.bindingRootIndex=e,Zo(t)}function Xo(){return wo.lFrame.currentDirectiveIndex}function Zo(e){wo.lFrame.currentDirectiveIndex=e}function Qo(e){let t=wo.lFrame.currentDirectiveIndex;return t===-1?null:e[t]}function $o(){return wo.lFrame.currentQueryIndex}function es(e){wo.lFrame.currentQueryIndex=e}function ts(e){let t=e[1];return t.type===2?t.declTNode:t.type===1?e[5]:null}function ns(e,t,n){if(n&4){let r=t,i=e;for(;r=r.parent,r===null&&!(n&1)&&(r=ts(i),!(r===null||(i=i[14],r.type&10))););if(r===null)return!1;t=r,e=i}let r=wo.lFrame=is();return r.currentTNode=t,r.lView=e,!0}function rs(e){let t=is(),n=e[1];wo.lFrame=t,t.currentTNode=n.firstChild,t.lView=e,t.tView=n,t.contextLView=e,t.bindingIndex=n.bindingStartIndex,t.inI18n=!1}function is(){let e=wo.lFrame,t=e===null?null:e.child;return t===null?as(e):t}function as(e){let t={currentTNode:null,isParent:!0,lView:null,tView:null,selectedIndex:-1,contextLView:null,elementDepthCount:0,currentNamespace:null,currentDirectiveIndex:-1,bindingRootIndex:-1,bindingIndex:-1,currentQueryIndex:0,parent:e,child:null,inI18n:!1};return e!==null&&(e.child=t),t}function os(){let e=wo.lFrame;return wo.lFrame=e.parent,e.currentTNode=null,e.lView=null,e}var ss=os;function cs(){let e=os();e.isParent=!0,e.tView=null,e.selectedIndex=-1,e.contextLView=null,e.elementDepthCount=0,e.currentDirectiveIndex=-1,e.currentNamespace=null,e.bindingRootIndex=-1,e.bindingIndex=-1,e.currentQueryIndex=0}function ls(e){return(wo.lFrame.contextLView=mo(e,wo.lFrame.contextLView))[8]}function us(){return wo.lFrame.selectedIndex}function ds(e){wo.lFrame.selectedIndex=e}function fs(){let e=wo.lFrame;return io(e.tView,e.selectedIndex)}function ps(){wo.lFrame.currentNamespace=`svg`}function ms(){hs()}function hs(){wo.lFrame.currentNamespace=null}function gs(){return wo.lFrame.currentNamespace}var _s=!0;function vs(){return _s}function ys(e){_s=e}function bs(e,t=null,n=null,r){let i=xs(e,t,n,r);return i.resolveInjectorInitializers(),i}function xs(e,t=null,n=null,r,i=new Set){return new ja([n||ua,ha(e)],t||ka(),null,i)}var Ss=class e{static THROW_IF_NOT_FOUND=Ui;static NULL=new ma;static create(e,t){if(Array.isArray(e))return bs({name:``},t,e,``);{let t=e.name??``;return bs({name:t},e.parent,e.providers,t)}}static ɵprov=di({token:e,providedIn:`any`,factory:()=>qi(fa)});static __NG_ELEMENT_ID__=-1},Cs=new vi(``),ws=class{static __NG_ELEMENT_ID__=Es;static __NG_ENV_ID__=e=>e},Ts=class extends ws{_lView;constructor(e){super(),this._lView=e}get destroyed(){return Qa(this._lView)}onDestroy(e){let t=this._lView;return vo(t,e),()=>yo(t,e)}};function Es(){return new Ts(D())}var Ds=new vi(``),Os=(()=>{class e{taskId=0;pendingTasks=new Set;destroyed=!1;pendingTask=new $r(!1);debugTaskTracker=E(Ds,{optional:!0});get hasPendingTasks(){return!this.destroyed&&this.pendingTask.value}get hasPendingTasksObservable(){return this.destroyed?new Hr(e=>{e.next(!1),e.complete()}):this.pendingTask}add(){!this.hasPendingTasks&&!this.destroyed&&this.pendingTask.next(!0);let e=this.taskId++;return this.pendingTasks.add(e),this.debugTaskTracker?.add(e),e}has(e){return this.pendingTasks.has(e)}remove(e){this.pendingTasks.delete(e),this.debugTaskTracker?.remove(e),this.pendingTasks.size===0&&this.hasPendingTasks&&this.pendingTask.next(!1)}ngOnDestroy(){this.pendingTasks.clear(),this.hasPendingTasks&&this.pendingTask.next(!1),this.destroyed=!0,this.pendingTask.unsubscribe()}static ɵprov=di({token:e,providedIn:`root`,factory:()=>new e})}return e})(),ks=class extends Zr{__isAsync;destroyRef=void 0;pendingTasks=void 0;constructor(e=!1){super(),this.__isAsync=e,Ua()&&(this.destroyRef=E(ws,{optional:!0})??void 0,this.pendingTasks=E(Os,{optional:!0})??void 0)}emit(e){let t=w(null);try{super.next(e)}finally{w(t)}}subscribe(e,t,n){let r=e,i=t||(()=>null),a=n;if(e&&typeof e==`object`){let t=e;r=t.next?.bind(t),i=t.error?.bind(t),a=t.complete?.bind(t)}this.__isAsync&&(i=this.wrapInTimeout(i),r&&=this.wrapInTimeout(r),a&&=this.wrapInTimeout(a));let o=super.subscribe({next:r,error:i,complete:a});return e instanceof hr&&e.add(o),o}wrapInTimeout(e){return t=>{let n=this.pendingTasks?.add();setTimeout(()=>{try{e(t)}finally{n!==void 0&&this.pendingTasks?.remove(n)}})}}};function As(...e){}function js(e){let t,n;function r(){e=As;try{n!==void 0&&typeof cancelAnimationFrame==`function`&&cancelAnimationFrame(n),t!==void 0&&clearTimeout(t)}catch{}}return t=setTimeout(()=>{e(),r()}),typeof requestAnimationFrame==`function`&&(n=requestAnimationFrame(()=>{e(),r()})),()=>r()}function Ms(e){return queueMicrotask(()=>e()),()=>{e=As}}var Ns=`isAngularZone`,Ps=`isAngularZone_ID`,Fs=0,Is=class e{hasPendingMacrotasks=!1;hasPendingMicrotasks=!1;isStable=!0;onUnstable=new ks(!1);onMicrotaskEmpty=new ks(!1);onStable=new ks(!1);onError=new ks(!1);constructor(e){let{enableLongStackTrace:t=!1,shouldCoalesceEventChangeDetection:n=!1,shouldCoalesceRunChangeDetection:r=!1,scheduleInRootZone:i=!1}=e;if(typeof Zone>`u`)throw new T(908,!1);Zone.assertZonePatched();let a=this;a._nesting=0,a._outer=a._inner=Zone.current,Zone.TaskTrackingZoneSpec&&(a._inner=a._inner.fork(new Zone.TaskTrackingZoneSpec)),t&&Zone.longStackTraceZoneSpec&&(a._inner=a._inner.fork(Zone.longStackTraceZoneSpec)),a.shouldCoalesceEventChangeDetection=!r&&n,a.shouldCoalesceRunChangeDetection=r,a.callbackScheduled=!1,a.scheduleInRootZone=i,Bs(a)}static isInAngularZone(){return typeof Zone<`u`&&Zone.current.get(Ns)===!0}static assertInAngularZone(){if(!e.isInAngularZone())throw new T(909,!1)}static assertNotInAngularZone(){if(e.isInAngularZone())throw new T(909,!1)}run(e,t,n){return this._inner.run(e,t,n)}runTask(e,t,n,r){let i=this._inner,a=i.scheduleEventTask(`NgZoneEvent: `+r,e,Ls,As,As);try{return i.runTask(a,t,n)}finally{i.cancelTask(a)}}runGuarded(e,t,n){return this._inner.runGuarded(e,t,n)}runOutsideAngular(e){return this._outer.run(e)}},Ls={};function Rs(e){if(e._nesting==0&&!e.hasPendingMicrotasks&&!e.isStable)try{e._nesting++,e.onMicrotaskEmpty.emit(null)}finally{if(e._nesting--,!e.hasPendingMicrotasks)try{e.runOutsideAngular(()=>e.onStable.emit(null))}finally{e.isStable=!0}}}function zs(e){if(e.isCheckStableRunning||e.callbackScheduled)return;e.callbackScheduled=!0;function t(){js(()=>{e.callbackScheduled=!1,Vs(e),e.isCheckStableRunning=!0,Rs(e),e.isCheckStableRunning=!1})}e.scheduleInRootZone?Zone.root.run(()=>{t()}):e._outer.run(()=>{t()}),Vs(e)}function Bs(e){let t=()=>{zs(e)},n=Fs++;e._inner=e._inner.fork({name:`angular`,properties:{[Ns]:!0,[Ps]:n,[Ps+n]:!0},onInvokeTask:(n,r,i,a,o,s)=>{if(Gs(s))return n.invokeTask(i,a,o,s);try{return Hs(e),n.invokeTask(i,a,o,s)}finally{(e.shouldCoalesceEventChangeDetection&&a.type===`eventTask`||e.shouldCoalesceRunChangeDetection)&&t(),Us(e)}},onInvoke:(n,r,i,a,o,s,c)=>{try{return Hs(e),n.invoke(i,a,o,s,c)}finally{e.shouldCoalesceRunChangeDetection&&!e.callbackScheduled&&!Ks(s)&&t(),Us(e)}},onHasTask:(t,n,r,i)=>{t.hasTask(r,i),n===r&&(i.change==`microTask`?(e._hasPendingMicrotasks=i.microTask,Vs(e),Rs(e)):i.change==`macroTask`&&(e.hasPendingMacrotasks=i.macroTask))},onHandleError:(t,n,r,i)=>(t.handleError(r,i),e.runOutsideAngular(()=>e.onError.emit(i)),!1)})}function Vs(e){e.hasPendingMicrotasks=!!(e._hasPendingMicrotasks||(e.shouldCoalesceEventChangeDetection||e.shouldCoalesceRunChangeDetection)&&e.callbackScheduled===!0)}function Hs(e){e._nesting++,e.isStable&&(e.isStable=!1,e.onUnstable.emit(null))}function Us(e){e._nesting--,Rs(e)}var Ws=class{hasPendingMicrotasks=!1;hasPendingMacrotasks=!1;isStable=!0;onUnstable=new ks;onMicrotaskEmpty=new ks;onStable=new ks;onError=new ks;run(e,t,n){return e.apply(t,n)}runGuarded(e,t,n){return e.apply(t,n)}runOutsideAngular(e){return e()}runTask(e,t,n,r){return e.apply(t,n)}};function Gs(e){return qs(e,`__ignore_ng_zone__`)}function Ks(e){return qs(e,`__scheduler_tick__`)}function qs(e,t){return!Array.isArray(e)||e.length!==1?!1:e[0]?.data?.[t]===!0}var Js=class{_console=console;handleError(e){this._console.error(`ERROR`,e)}},Ys=new vi(``,{factory:()=>{let e=E(Is),t=E(Aa),n;return r=>{e.runOutsideAngular(()=>{t.destroyed&&!n?setTimeout(()=>{throw r}):(n??=t.get(Js),n.handleError(r))})}}}),Xs={provide:da,useValue:()=>{E(Js,{optional:!0})},multi:!0};function A(e,t){let[n,r,i]=Hn(e,t?.equal),a=n;return a[dn],a.set=r,a.update=i,a.asReadonly=Zs.bind(a),a}function Zs(){let e=this[dn];if(e.readonlyFn===void 0){let t=()=>this();t[dn]=e,e.readonlyFn=t}return e.readonlyFn}var Qs=new vi(``,{factory:()=>$s}),$s=`ng`,ec=new vi(``),tc=new vi(``,{providedIn:`platform`,factory:()=>`unknown`}),nc=new vi(``,{factory:()=>E(Cs).body?.querySelector(`[ngCspNonce]`)?.getAttribute(`ngCspNonce`)||null}),rc=(()=>{class e{view;node;constructor(e,t){this.view=e,this.node=t}static __NG_ELEMENT_ID__=ic}return e})();function ic(){return new rc(D(),Po())}var ac=class{},oc=new vi(``,{factory:()=>!0}),sc=new vi(``),cc=(()=>{class e{static ɵprov=di({token:e,providedIn:`root`,factory:()=>new lc})}return e})(),lc=class{dirtyEffectCount=0;queues=new Map;add(e){this.enqueue(e),this.schedule(e)}schedule(e){e.dirty&&this.dirtyEffectCount++}remove(e){let t=e.zone,n=this.queues.get(t);n.has(e)&&(n.delete(e),e.dirty&&this.dirtyEffectCount--)}enqueue(e){let t=e.zone;this.queues.has(t)||this.queues.set(t,new Set);let n=this.queues.get(t);n.has(e)||n.add(e)}flush(){for(;this.dirtyEffectCount>0;){let e=!1;for(let[t,n]of this.queues)e||=t===null?this.flushQueue(n):t.run(()=>this.flushQueue(n));e||(this.dirtyEffectCount=0)}}flushQueue(e){let t=!1;for(let n of e)n.dirty&&(this.dirtyEffectCount--,t=!0,n.run());return t}},uc=class{[dn];constructor(e){this[dn]=e}destroy(){this[dn].destroy()}};function dc(e,t){let n=t?.injector??E(Ss),r=t?.manualCleanup===!0?null:n.get(ws),i,a=n.get(rc,null,{optional:!0}),o=n.get(ac);return a===null?i=gc(e,n.get(cc),o):(i=hc(a.view,o,e),r instanceof Ts&&r._lView===a.view&&(r=null)),i.injector=n,r!==null&&(i.onDestroyFns=[r.onDestroy(()=>i.destroy())]),new uc(i)}var fc={...Jn,cleanupFns:void 0,zone:null,onDestroyFns:null,run(){let e=Ho(!1);try{Yn(this)}finally{Ho(e)}},cleanup(){if(!this.cleanupFns?.length)return;let e=w(null);try{for(;this.cleanupFns.length;)this.cleanupFns.pop()()}finally{this.cleanupFns=[],w(e)}}},pc={...fc,consumerMarkedDirty(){this.scheduler.schedule(this),this.notifier.notify(12)},destroy(){if(En(this),this.onDestroyFns!==null)for(let e of this.onDestroyFns)e();this.cleanup(),this.scheduler.remove(this)}},mc={...fc,consumerMarkedDirty(){this.view[2]|=8192,_o(this.view),this.notifier.notify(13)},destroy(){if(En(this),this.onDestroyFns!==null)for(let e of this.onDestroyFns)e();this.cleanup(),this.view[23]?.delete(this)}};function hc(e,t,n){let r=Object.create(mc);return r.view=e,r.zone=typeof Zone<`u`?Zone.current:null,r.notifier=t,r.fn=_c(r,n),e[23]??=new Set,e[23].add(r),r.consumerMarkedDirty(r),r}function gc(e,t,n){let r=Object.create(pc);return r.fn=_c(r,e),r.scheduler=t,r.notifier=n,r.zone=typeof Zone<`u`?Zone.current:null,r.scheduler.add(r),r.notifier.notify(12),r}function _c(e,t){return()=>{t(t=>(e.cleanupFns??=[]).push(t))}}function vc(e){return typeof e==`function`&&e[dn]!==void 0}function yc(e){return vc(e)&&typeof e.set==`function`}var bc=Symbol(`InputSignalNode#UNSET`),xc={...Kn,transformFn:void 0,applyValueToInputSignal(e,t){Wn(e,t)}};function Sc(e){return{toString:e}.toString()}var Cc=(function(e){return e[e.TemplateCreateStart=0]=`TemplateCreateStart`,e[e.TemplateCreateEnd=1]=`TemplateCreateEnd`,e[e.TemplateUpdateStart=2]=`TemplateUpdateStart`,e[e.TemplateUpdateEnd=3]=`TemplateUpdateEnd`,e[e.LifecycleHookStart=4]=`LifecycleHookStart`,e[e.LifecycleHookEnd=5]=`LifecycleHookEnd`,e[e.OutputStart=6]=`OutputStart`,e[e.OutputEnd=7]=`OutputEnd`,e[e.BootstrapApplicationStart=8]=`BootstrapApplicationStart`,e[e.BootstrapApplicationEnd=9]=`BootstrapApplicationEnd`,e[e.BootstrapComponentStart=10]=`BootstrapComponentStart`,e[e.BootstrapComponentEnd=11]=`BootstrapComponentEnd`,e[e.ChangeDetectionStart=12]=`ChangeDetectionStart`,e[e.ChangeDetectionEnd=13]=`ChangeDetectionEnd`,e[e.ChangeDetectionSyncStart=14]=`ChangeDetectionSyncStart`,e[e.ChangeDetectionSyncEnd=15]=`ChangeDetectionSyncEnd`,e[e.AfterRenderHooksStart=16]=`AfterRenderHooksStart`,e[e.AfterRenderHooksEnd=17]=`AfterRenderHooksEnd`,e[e.ComponentStart=18]=`ComponentStart`,e[e.ComponentEnd=19]=`ComponentEnd`,e[e.DeferBlockStateStart=20]=`DeferBlockStateStart`,e[e.DeferBlockStateEnd=21]=`DeferBlockStateEnd`,e[e.DynamicComponentStart=22]=`DynamicComponentStart`,e[e.DynamicComponentEnd=23]=`DynamicComponentEnd`,e[e.HostBindingsUpdateStart=24]=`HostBindingsUpdateStart`,e[e.HostBindingsUpdateEnd=25]=`HostBindingsUpdateEnd`,e})(Cc||{}),wc=class{previousValue;currentValue;firstChange;constructor(e,t,n){this.previousValue=e,this.currentValue=t,this.firstChange=n}isFirstChange(){return this.firstChange}};function Tc(e,t,n,r){t===null?e[n]=r:t.applyValueToInputSignal(t,r)}var Ec=null,Dc=(()=>{Ec=kc;let e=()=>kc;return e.ngInherit=!0,e})();function Oc(){return Ec}function kc(e){return e.type.prototype.ngOnChanges&&(e.setInput=jc),Ac}function Ac(){let e=Nc(this),t=e?.current;if(t){let n=e.previous;if(n===la)e.previous=t;else for(let e in t)n[e]=t[e];e.current=null,this.ngOnChanges(t)}}function jc(e,t,n,r,i){let a=this.declaredInputs[r],o=Nc(e)||Pc(e,{previous:la,current:null}),s=o.current||={},c=o.previous,l=c[a];s[a]=new wc(l&&l.currentValue,n,c===la),Tc(e,t,i,n)}var Mc=`__ngSimpleChanges__`;function Nc(e){return Object.hasOwn(e,Mc)&&e[Mc]||null}function Pc(e,t){return e[Mc]=t}var Fc=[],Ic=function(e,t=null,n){for(let r=0;r<Fc.length;r++){let i=Fc[r];i(e,t,n)}};function Lc(e,t,n){let{ngOnChanges:r,ngOnInit:i,ngDoCheck:a}=t.type.prototype;if(r){let r=Oc()(t);(n.preOrderHooks??=[]).push(e,r),(n.preOrderCheckHooks??=[]).push(e,r)}i&&(n.preOrderHooks??=[]).push(0-e,i),a&&((n.preOrderHooks??=[]).push(e,a),(n.preOrderCheckHooks??=[]).push(e,a))}function Rc(e,t){for(let n=t.directiveStart,r=t.directiveEnd;n<r;n++){let{ngAfterContentInit:t,ngAfterContentChecked:r,ngAfterViewInit:i,ngAfterViewChecked:a,ngOnDestroy:o}=e.data[n].type.prototype;t&&(e.contentHooks??=[]).push(-n,t),r&&((e.contentHooks??=[]).push(n,r),(e.contentCheckHooks??=[]).push(n,r)),i&&(e.viewHooks??=[]).push(-n,i),a&&((e.viewHooks??=[]).push(n,a),(e.viewCheckHooks??=[]).push(n,a)),o!=null&&(e.destroyHooks??=[]).push(n,o)}}function zc(e,t,n){Hc(e,t,3,n)}function Bc(e,t,n,r){(e[2]&3)===n&&Hc(e,t,n,r)}function Vc(e,t){let n=e[2];(n&3)===t&&(n&=16383,n+=1,e[2]=n)}function Hc(e,t,n,r){let i=r===void 0?0:e[17]&65535,a=r??-1,o=t.length-1,s=0;for(let c=i;c<o;c++)if(typeof t[c+1]==`number`){if(s=t[c],r!=null&&s>=r)break}else t[c]<0&&(e[17]+=65536),(s<a||a==-1)&&(Wc(e,n,t,c),e[17]=(e[17]&4294901760)+c+2),c++}function Uc(e,t){Ic(Cc.LifecycleHookStart,e,t);let n=w(null);try{t.call(e)}finally{w(n),Ic(Cc.LifecycleHookEnd,e,t)}}function Wc(e,t,n,r){let i=n[r]<0,a=n[r+1],o=e[i?-n[r]:n[r]];i?e[2]>>14<e[17]>>16&&(e[2]&3)===t&&(e[2]+=16384,Uc(o,a)):Uc(o,a)}var Gc=-1,Kc=class{factory;name;injectImpl;resolving=!1;canSeeViewProviders;multi;componentProviders;index;providerFactory;constructor(e,t,n,r){this.factory=e,this.name=r,this.canSeeViewProviders=t,this.injectImpl=n}};function qc(e){return!!(e.flags&8)}function Jc(e){return!!(e.flags&16)}function Yc(e,t,n){let r=0;for(;r<n.length;){let i=n[r];if(typeof i==`number`){if(i!==0)break;r++;let a=n[r++],o=n[r++],s=n[r++];e.setAttribute(t,o,s,a)}else{let a=i,o=n[++r];Zc(a)?e.setProperty(t,a,o):e.setAttribute(t,a,o),r++}}return r}function Xc(e){return e===3||e===4||e===6}function Zc(e){return e.charCodeAt(0)===64}function Qc(e,t){if(t!==null&&t.length!==0){if(e===null||e.length===0)e=t.slice();else{let n=-1;for(let r=0;r<t.length;r++){let i=t[r];typeof i==`number`?n=i:n===0||(n===-1||n===2?$c(e,n,i,null,t[++r]):$c(e,n,i,null,null))}}}return e}function $c(e,t,n,r,i){let a=0,o=e.length;if(t===-1)o=-1;else for(;a<e.length;){let n=e[a++];if(typeof n==`number`){if(n===t){o=-1;break}if(n>t){o=a-1;break}}}for(;a<e.length;){let t=e[a];if(typeof t==`number`)break;if(t===n){i!==null&&(e[a+1]=i);return}a++,i!==null&&a++}o!==-1&&(e.splice(o,0,t),a=o+1),e.splice(a++,0,n),i!==null&&e.splice(a++,0,i)}function el(e){return e!==Gc}function tl(e){return e&32767}function nl(e){return e>>16}function rl(e,t){let n=nl(e),r=t;for(;n>0;)r=r[14],n--;return r}var il=!0;function al(e){let t=il;return il=e,t}var ol=255,sl=5,cl=0,ll={};function ul(e,t,n){let r;typeof n==`string`?r=n.charCodeAt(0)||0:Object.hasOwn(n,wi)&&(r=n[wi]),r??=n[wi]=cl++;let i=r&ol,a=1<<i;t.data[e+(i>>sl)]|=a}function dl(e,t){let n=pl(e,t);if(n!==-1)return n;let r=t[1];r.firstCreatePass&&(e.injectorIndex=t.length,fl(r.data,e),fl(t,null),fl(r.blueprint,null));let i=ml(e,t),a=e.injectorIndex;if(el(i)){let e=tl(i),n=rl(i,t),r=n[1].data;for(let i=0;i<8;i++)t[a+i]=n[e+i]|r[e+i]}return t[a+8]=i,a}function fl(e,t){e.push(0,0,0,0,0,0,0,0,t)}function pl(e,t){return e.injectorIndex===-1||e.parent&&e.parent.injectorIndex===e.injectorIndex||t[e.injectorIndex+8]===null?-1:e.injectorIndex}function ml(e,t){if(e.parent&&e.parent.injectorIndex!==-1)return e.parent.injectorIndex;let n=0,r=null,i=t;for(;i!==null;){if(r=kl(i),r===null)return Gc;if(n++,i=i[14],r.injectorIndex!==-1)return r.injectorIndex|n<<16}return Gc}function hl(e,t,n){ul(e,t,n)}function gl(e,t,n){if(n&8||e!==void 0)return e;Fi(t,`NodeInjector`)}function _l(e,t,n,r){if(n&8&&r===void 0&&(r=null),!(n&3)){let i=e[9],a=Bi(void 0);try{return i?i.get(t,r,n&8):Vi(t,r,n&8)}finally{Bi(a)}}return gl(r,t,n)}function vl(e,t,n,r=0,i){if(e!==null){if(t[2]&2048&&!(r&2)){let i=Ol(e,t,n,r,ll);if(i!==ll)return i}let i=yl(e,t,n,r,ll);if(i!==ll)return i}return _l(t,n,r,i)}function yl(e,t,n,r,i){let a=Cl(n);if(typeof a==`function`){if(!ns(t,e,r))return r&1?gl(i,n,r):_l(t,n,r,i);try{let e;if(e=a(r),e==null&&!(r&8))Fi(n);else return e}finally{ss()}}else if(typeof a==`number`){let i=null,o=pl(e,t),s=Gc,c=r&1?t[15][5]:null;for((o===-1||r&4)&&(s=o===-1?ml(e,t):t[o+8],s===Gc||!Tl(r,!1)?o=-1:(i=t[1],o=tl(s),t=rl(s,t)));o!==-1;){let e=t[1];if(wl(a,o,e.data)){let e=bl(o,t,n,i,r,c);if(e!==ll)return e}s=t[o+8],s!==Gc&&Tl(r,t[1].data[o+8]===c)&&wl(a,o,t)?(i=e,o=tl(s),t=rl(s,t)):o=-1}}return i}function bl(e,t,n,r,i,a){let o=t[1],s=o.data[e+8],c=xl(s,o,n,r==null?Ja(s)&&il:r!=o&&!!(s.type&3),i&1&&a===s);return c===null?ll:Sl(t,o,c,s,i)}function xl(e,t,n,r,i){let a=e.providerIndexes,o=t.data,s=a&1048575,c=e.directiveStart,l=e.directiveEnd,u=a>>20,d=r?s:s+u,f=i?s+u:l;for(let e=d;e<f;e++){let t=o[e];if(e<c&&n===t||e>=c&&t.type===n)return e}if(i){let e=o[c];if(e&&Xa(e)&&e.type===n)return c}return null}function Sl(e,t,n,r,i){let a=e[n],o=t.data;if(a instanceof Kc){let s=a;if(s.resolving)throw Pi(``);let c=al(s.canSeeViewProviders);s.resolving=!0,o[n].type||o[n];let l=s.injectImpl?Bi(s.injectImpl):null;ns(e,r,0);try{a=e[n]=s.factory(void 0,i,o,e,r),t.firstCreatePass&&n>=r.directiveStart&&Lc(n,o[n],t)}finally{l!==null&&Bi(l),al(c),s.resolving=!1,ss()}}return a}function Cl(e){if(typeof e==`string`)return e.charCodeAt(0)||0;let t=Object.hasOwn(e,wi)?e[wi]:void 0;return typeof t==`number`?t>=0?t&ol:Dl:t}function wl(e,t,n){let r=1<<e;return!!(n[t+(e>>sl)]&r)}function Tl(e,t){return!(e&2)&&!(e&1&&t)}var El=class{_tNode;_lView;constructor(e,t){this._tNode=e,this._lView=t}get(e,t,n){return vl(this._tNode,this._lView,e,Ji(n),t)}};function Dl(){return new El(Po(),D())}function Ol(e,t,n,r,i){let a=e,o=t;for(;a!==null&&o!==null&&o[2]&2048&&!Za(o);){let e=yl(a,o,n,r|2,ll);if(e!==ll)return e;r&=-5;let t=a.parent;if(!t){let e=o[20];if(e){let t=e.get(n,ll,r);if(t!==ll)return t}t=kl(o),o=o[14]}a=t}return i}function kl(e){let t=e[1],n=t.type;return n===2?t.declTNode:n===1?e[5]:null}function Al(e){return{token:e.token,providedIn:e.autoProvided===!1?null:`root`,factory:e.factory,value:void 0}}function jl(){return Ml(Po(),D())}function Ml(e,t){return new Nl(ro(e,t))}var Nl=(()=>{class e{nativeElement;constructor(e){this.nativeElement=e}static __NG_ELEMENT_ID__=jl}return e})();function Pl(e){return e instanceof Nl?e.nativeElement:e}function Fl(){return this._results[Symbol.iterator]()}var Il=class{_emitDistinctChangesOnly;dirty=!0;_onDirty=void 0;_results=[];_changesDetected=!1;_changes=void 0;length=0;first=void 0;last=void 0;get changes(){return this._changes??=new Zr}constructor(e=!1){this._emitDistinctChangesOnly=e}get(e){return this._results[e]}map(e){return this._results.map(e)}filter(e){return this._results.filter(e)}find(e){return this._results.find(e)}reduce(e,t){return this._results.reduce(e,t)}forEach(e){this._results.forEach(e)}some(e){return this._results.some(e)}toArray(){return this._results.slice()}toString(){return this._results.toString()}reset(e,t){this.dirty=!1;let n=ea(e);(this._changesDetected=!$i(this._results,n,t))&&(this._results=n,this.length=n.length,this.last=n[this.length-1],this.first=n[0])}notifyOnChanges(){this._changes!==void 0&&(this._changesDetected||!this._emitDistinctChangesOnly)&&this._changes.next(this)}onDirty(e){this._onDirty=e}setDirty(){this.dirty=!0,this._onDirty?.()}destroy(){this._changes!==void 0&&(this._changes.complete(),this._changes.unsubscribe())}[Symbol.iterator]=Fl};function Ll(e){return(e.flags&128)==128}var Rl=(function(e){return e[e.OnPush=0]=`OnPush`,e[e.Eager=1]=`Eager`,e[e.Default=1]=`Default`,e})(Rl||{}),zl=new Map,Bl=0;function Vl(){return Bl++}function Hl(e){zl.set(e[19],e)}function Ul(e){zl.delete(e[19])}var Wl=`__ngContext__`;function Gl(e,t){Ga(t)?(e[Wl]=t[19],Hl(t)):e[Wl]=t}function Kl(e){return Jl(e[12])}function ql(e){return Jl(e[4])}function Jl(e){for(;e!==null&&!Ka(e);)e=e[4];return e}var Yl=void 0;function Xl(e){Yl=e}function Zl(){if(Yl!==void 0)return Yl;if(typeof document<`u`)return document;throw new T(210,!1)}var Ql=!1,$l=new vi(``,{factory:()=>Ql}),eu=new WeakMap;function tu(e,t){if(typeof e!=`object`||!e)return;let n=eu.get(e);n||(n=new WeakSet,eu.set(e,n)),n.add(t)}function nu(e){return(e.flags&32)==32}var ru=()=>null;function iu(e,t,n=!1){return ru(e,t,n)}function au(e,t){let n=e.contentQueries;if(n!==null){let r=w(null);try{for(let r=0;r<n.length;r+=2){let i=n[r],a=n[r+1];if(a!==-1){let n=e.data[a];es(i),n.contentQueries(2,t[a],a)}}}finally{w(r)}}}function ou(e,t,n){es(0);let r=w(null);try{t(e,n)}finally{w(r)}}function su(e,t,n){if(qa(t)){let r=w(null);try{let r=t.directiveStart,i=t.directiveEnd;for(let t=r;t<i;t++){let r=e.data[t];if(r.contentQueries){let e=n[t];r.contentQueries(1,e,t)}}}finally{w(r)}}}var cu=(function(e){return e[e.Emulated=0]=`Emulated`,e[e.None=2]=`None`,e[e.ShadowDom=3]=`ShadowDom`,e[e.ExperimentalIsolatedShadowDom=4]=`ExperimentalIsolatedShadowDom`,e})(cu||{}),lu=class{changingThisBreaksApplicationSecurity;constructor(e){this.changingThisBreaksApplicationSecurity=e}toString(){return`SafeValue must use [property]=binding: ${this.changingThisBreaksApplicationSecurity} (see ${ti})`}};function uu(e){return e instanceof lu?e.changingThisBreaksApplicationSecurity:e}function du(e,t){let n=fu(e);if(n!=null&&n!==t){if(n===`ResourceURL`&&t===`URL`)return!0;throw Error(`Required a safe ${t}, got a ${n} (see ${ti})`)}return n===t}function fu(e){return e instanceof lu&&e.getTypeName()||null}var pu=/^(?!javascript:)(?:[a-z0-9+.-]+:|[^&:\/?#]*(?:[\/?#]|$))/i;function mu(e){return e=String(e),e.match(pu)?e:`unsafe:`+e}var hu=/^>|^->|<!--|-->|--!>|<!-$/g,gu=/(<|>)/g,_u=`​$1​`;function vu(e){return e.replace(hu,e=>e.replace(gu,_u))}function yu(e,t){return e.createText(t)}function bu(e,t,n){e.setValue(t,n)}function xu(e,t){return e.createComment(vu(t))}function Su(e,t,n){return e.createElement(t,n)}function Cu(e,t,n,r,i){e.insertBefore(t,n,r,i)}function wu(e,t,n){e.appendChild(t,n)}function Tu(e,t,n,r,i){r===null?wu(e,t,n):Cu(e,t,n,r,i)}function Eu(e,t,n,r){e.removeChild(null,t,n,r)}function Du(e,t,n){e.setAttribute(t,`style`,n)}function Ou(e,t,n){n===``?e.removeAttribute(t,`class`):e.setAttribute(t,`class`,n)}function ku(e,t,n){let{mergedAttrs:r,classes:i,styles:a}=n;r!==null&&Yc(e,t,r),i!==null&&Ou(e,t,i),a!==null&&Du(e,t,a)}function Au(e){let t=ju();return t?t.sanitize($a.URL,e)||``:du(e,`URL`)?uu(e):mu(Ai(e))}function ju(){let e=D();return e&&e[10].sanitizer}function Mu(e){return e.ownerDocument.defaultView}function Nu(e){return e.ownerDocument}function Pu(e,t,n){let r=e.length;for(;;){let i=e.indexOf(t,n);if(i===-1)return i;if(i===0||e.charCodeAt(i-1)<=32){let n=t.length;if(i+n===r||e.charCodeAt(i+n)<=32)return i}n=i+1}}var Fu=`ng-template`;function Iu(e,t,n,r){let i=0;if(r){for(;i<t.length&&typeof t[i]==`string`;i+=2)if(t[i]===`class`&&Pu(t[i+1].toLowerCase(),n,0)!==-1)return!0}else if(Lu(e))return!1;if(i=t.indexOf(1,i),i>-1){let e;for(;++i<t.length&&typeof(e=t[i])==`string`;)if(e.toLowerCase()===n)return!0}return!1}function Lu(e){return e.type===4&&e.value!==Fu}function Ru(e,t,n){return t===(e.type===4&&!n?Fu:e.value)}function zu(e,t,n){let r=4,i=e.attrs,a=i===null?0:Uu(i),o=!1;for(let s=0;s<t.length;s++){let c=t[s];if(typeof c==`number`){if(!o&&!Bu(r)&&!Bu(c))return!1;if(o&&Bu(c))continue;o=!1,r=c|r&1;continue}if(!o){if(r&4){if(r=2|r&1,c!==``&&!Ru(e,c,n)||c===``&&t.length===1){if(Bu(r))return!1;o=!0}}else if(r&8){if(i===null||!Iu(e,i,c,n)){if(Bu(r))return!1;o=!0}}else{let l=t[++s],u=Vu(c,i,Lu(e),n);if(u===-1){if(Bu(r))return!1;o=!0;continue}if(l!==``){let e;if(e=u>a?``:i[u+1].toLowerCase(),r&2&&l!==e){if(Bu(r))return!1;o=!0}}}}}return Bu(r)||o}function Bu(e){return!(e&1)}function Vu(e,t,n,r){if(t===null)return-1;let i=0;if(r||!n){let n=!1;for(;i<t.length;){let r=t[i];if(r===e)return i;if(r===3||r===6)n=!0;else if(r===1||r===2){let e=t[++i];for(;typeof e==`string`;)e=t[++i];continue}else if(r===4)break;else if(r===0){i+=4;continue}i+=n?1:2}return-1}return Wu(t,e)}function Hu(e,t,n=!1){for(let r=0;r<t.length;r++)if(zu(e,t[r],n))return!0;return!1}function Uu(e){for(let t=0;t<e.length;t++){let n=e[t];if(Xc(n))return t}return e.length}function Wu(e,t){let n=e.indexOf(4);if(n>-1)for(n++;n<e.length;){let r=e[n];if(typeof r==`number`)return-1;if(r===t)return n;n++}return-1}function Gu(e,t){return e?`:not(`+t.trim()+`)`:t}function Ku(e){let t=e[0],n=1,r=2,i=``,a=!1;for(;n<e.length;){let o=e[n];if(typeof o==`string`){if(r&2){let t=e[++n];i+=`[`+o+(t.length>0?`="`+t+`"`:``)+`]`}else r&8?i+=`.`+o:r&4&&(i+=` `+o)}else i!==``&&!Bu(o)&&(t+=Gu(a,i),i=``),r=o,a||=!Bu(r);n++}return i!==``&&(t+=Gu(a,i)),t}function qu(e){return e.map(Ku).join(`,`)}function Ju(e){let t=[],n=[],r=1,i=2;for(;r<e.length;){let a=e[r];if(typeof a==`string`)i===2?a!==``&&t.push(a,e[++r]):i===8&&n.push(a);else{if(!Bu(i))break;i=a}r++}return n.length&&t.push(1,...n),t}var Yu={},Xu=(function(e){return e[e.Important=1]=`Important`,e[e.DashCase=2]=`DashCase`,e})(Xu||{}),Zu;function Qu(e,t){return Zu(e,t)}var $u=new vi(``,{factory:()=>!1});function ed(e){if(!e)return 0;let t=e.toLowerCase().indexOf(`ms`)>-1?1:1e3;return parseFloat(e)*t}function td(e,t){return e.getPropertyValue(t).split(`,`).map(e=>e.trim())}function nd(e){let t=td(e,`transition-property`),n=td(e,`transition-duration`),r=td(e,`transition-delay`),i={propertyName:``,duration:0,animationName:void 0};for(let e=0;e<t.length;e++){let a=ed(r[e])+ed(n[e]);a>i.duration&&(i.propertyName=t[e],i.duration=a)}return i}function rd(e){let t=td(e,`animation-name`),n=td(e,`animation-delay`),r=td(e,`animation-duration`),i=td(e,`animation-iteration-count`),a={animationName:``,propertyName:void 0,duration:0};for(let e=0;e<t.length;e++){let o=ed(n[e])+ed(r[e]),s=i[e];o>a.duration&&s!==`infinite`&&(a.animationName=t[e],a.duration=o)}return a}function id(e,t){return e!==void 0&&e.duration>t.duration}function ad(e){return(e.animationName!=null||e.propertyName!=null)&&e.duration>0}function od(e){let t=e.effect?.getTiming();if(t===void 0)return;let n=typeof t.duration==`number`?t.duration:0,r=(t.delay??0)+n,i=e.playbackRate;return i!==void 0&&i!==0&&i!==1&&(r/=Math.abs(i)),r}function sd(e,t){let n=getComputedStyle(e),r=rd(n),i=nd(n),a=r.duration>i.duration?r:i;id(t.get(e),a)||ad(a)&&t.set(e,a)}function cd(e,t,n){if(!n)return;let r=e.getAnimations();return r.length===0?sd(e,t):ld(e,t,r)}function ld(e,t,n){let r={animationName:void 0,propertyName:void 0,duration:0};for(let e of n){if(e.effect?.getTiming()?.iterations===1/0)continue;let t=od(e)??0,n,i;e.animationName?i=e.animationName:n=e.transitionProperty,t>=r.duration&&(r={animationName:i,propertyName:n,duration:t})}id(t.get(e),r)||ad(r)&&t.set(e,r)}var ud=new Set,dd=!1,fd=1,pd=typeof document<`u`&&typeof document?.documentElement?.getAnimations==`function`;function md(e){return e[9].get($u,dd)}function hd(e,t,n){let r=_d.get(e);if(r){for(let e of t)r.classList.push(e);for(let e of n)r.cleanupFns.push(e)}else _d.set(e,{classList:t,cleanupFns:n})}function gd(e){let t=_d.get(e);if(t){for(let e of t.cleanupFns)e();_d.delete(e)}vd.delete(e)}var _d=new WeakMap,vd=new WeakMap,yd=new WeakMap;function bd(e){return e?e[14]??e:null}var xd=new WeakSet;function Sd(e,t,n){let r=yd.get(e);if(!r||r.length===0)return;let i=t.parentNode,a=t.previousSibling,o=bd(n);for(let e=r.length-1;e>=0;e--){let{el:n,declarationView:s}=r[e],c=n.parentNode;n===t?(r.splice(e,1),xd.add(n),n.dispatchEvent(new CustomEvent(`animationend`,{detail:{cancel:!0}}))):(a&&n===a||c&&i&&c!==i&&(o===null||s===null||o===s))&&(r.splice(e,1),n.dispatchEvent(new CustomEvent(`animationend`,{detail:{cancel:!0}})),n.parentNode?.removeChild(n))}}function Cd(e,t,n){let r=bd(n),i=yd.get(e);i?i.some(e=>e.el===t)||i.push({el:t,declarationView:r}):yd.set(e,[{el:t,declarationView:r}])}function wd(e){let t=e[26]??={};return t.enter??=new Map}function Td(e){let t=typeof e==`function`?e():e,n=Array.isArray(t)?t:null;return typeof t==`string`&&(n=t.trim().split(/\s+/).filter(e=>e)),n}function Ed(e){return e.composedPath?e.composedPath()[0]:e.target}function Dd(e,t){let n=vd.get(t);if(n===void 0)return!0;if(t!==Ed(e))return!1;let r=e.animation;if(r){let e=od(r);if(e!==void 0&&e+fd<n.duration)return!1}return n.animationName===void 0?n.propertyName===void 0?!1:n.propertyName===`all`||e.propertyName===n.propertyName:e.animationName===n.animationName}function Od(e,t,n){let r=e.get(t.index)??{animateFns:[]};r.animateFns.push(n),e.set(t.index,r)}var kd=(function(e){return e[e.CHANGE_DETECTION=0]=`CHANGE_DETECTION`,e[e.AFTER_NEXT_RENDER=1]=`AFTER_NEXT_RENDER`,e})(kd||{}),Ad=new vi(``),jd=new Set;function Md(e){jd.has(e)||(jd.add(e),performance?.mark?.(`mark_feature_usage`,{detail:{feature:e}}))}var Nd=(()=>{class e{impl=null;execute(){this.impl?.execute()}static ɵprov=di({token:e,providedIn:`root`,factory:()=>new e})}return e})(),Pd=[0,1,2,3],Fd=(()=>{class e{ngZone=E(Is);scheduler=E(ac);errorHandler=E(Js,{optional:!0});sequences=new Set;deferredRegistrations=new Set;executing=!1;constructor(){E(Ad,{optional:!0})}execute(){let e=this.sequences.size>0;e&&Ic(Cc.AfterRenderHooksStart),this.executing=!0;for(let e of Pd)for(let t of this.sequences)if(!t.erroredOrDestroyed&&t.hooks[e])try{t.pipelinedValue=this.ngZone.runOutsideAngular(()=>this.maybeTrace(()=>{let n=t.hooks[e];return n(t.pipelinedValue)},t.snapshot))}catch(e){t.erroredOrDestroyed=!0,this.errorHandler?.handleError(e)}this.executing=!1;for(let e of this.sequences)e.afterRun(),e.once&&(this.sequences.delete(e),e.destroy());for(let e of this.deferredRegistrations)this.sequences.add(e);this.deferredRegistrations.size>0&&this.scheduler.notify(7),this.deferredRegistrations.clear(),e&&Ic(Cc.AfterRenderHooksEnd)}register(e){let{view:t}=e;t===void 0?this.executing?this.deferredRegistrations.add(e):this.addSequence(e):((t[25]??=[]).push(e),_o(t),t[2]|=8192)}addSequence(e){this.sequences.add(e),this.scheduler.notify(7)}unregister(e){this.executing&&this.sequences.has(e)?(e.erroredOrDestroyed=!0,e.pipelinedValue=void 0,e.once=!0):(this.sequences.delete(e),this.deferredRegistrations.delete(e))}maybeTrace(e,t){return t?t.run(kd.AFTER_NEXT_RENDER,e):e()}static ɵprov=di({token:e,providedIn:`root`,factory:()=>new e})}return e})(),Id=class{impl;hooks;view;once;snapshot;erroredOrDestroyed=!1;pipelinedValue=void 0;unregisterOnDestroy;constructor(e,t,n,r,i,a=null){this.impl=e,this.hooks=t,this.view=n,this.once=r,this.snapshot=a,this.unregisterOnDestroy=i?.onDestroy(()=>this.destroy())}afterRun(){this.erroredOrDestroyed=!1,this.pipelinedValue=void 0,this.snapshot?.dispose(),this.snapshot=null}destroy(){this.impl.unregister(this),this.unregisterOnDestroy?.();let e=this.view?.[25];e&&(this.view[25]=e.filter(e=>e!==this))}};function Ld(e,t){let n=t?.injector??E(Ss);return Md(`NgAfterNextRender`),zd(e,n,t,!0)}function Rd(e){return e instanceof Function?[void 0,void 0,e,void 0]:[e.earlyRead,e.write,e.mixedReadWrite,e.read]}function zd(e,t,n,r){let i=t.get(Nd);i.impl??=t.get(Fd);let a=t.get(Ad,null,{optional:!0}),o=n?.manualCleanup===!0?null:t.get(ws),s=t.get(rc,null,{optional:!0}),c=new Id(i.impl,Rd(e),s?.view,r,o,a?.snapshot(null));return i.impl.register(c),c}var Bd=new vi(``,{factory:()=>{let e=E(Aa),t=new Set;return e.onDestroy(()=>t.clear()),{queue:t,isScheduled:!1,scheduler:null,injector:e}}});function Vd(e,t,n){let r=e.get(Bd);if(Array.isArray(t))for(let e of t)r.queue.add(e),n?.detachedLeaveAnimationFns?.push(e);else r.queue.add(t),n?.detachedLeaveAnimationFns?.push(t);r.scheduler&&r.scheduler(e)}function Hd(e,t){let n=e.get(Bd);if(Array.isArray(t))for(let e of t)n.queue.delete(e);else n.queue.delete(t)}function Ud(e,t){let n=e.get(Bd);if(t.detachedLeaveAnimationFns){for(let e of t.detachedLeaveAnimationFns)n.queue.delete(e);t.detachedLeaveAnimationFns=void 0}}function Wd(e){let t=e.get(Bd);t.isScheduled||=(Ld(()=>{t.isScheduled=!1;for(let e of t.queue)e();t.queue.clear()},{injector:t.injector}),!0)}function Gd(e){let t=e.get(Bd);t.scheduler=Wd,t.scheduler(e)}function Kd(e,t){for(let[n,r]of t)Vd(e,r.animateFns)}function qd(e,t,n,r){let i=e?.[26]?.enter;t!==null&&i&&i.has(n.index)&&Kd(r,i)}function Jd(e,t,n,r){try{n.get(fa)}catch{return r(!1)}let i=e?.[26];i?.enter?.has(t.index)&&Hd(n,i.enter.get(t.index).animateFns);let a=Yd(e,t,i);if(a.size===0){let n=!1;if(e){let r=[];Zd(e,t,r),n=r.length>0}if(!n)return r(!1)}e&&ud.add(e[19]),Vd(n,()=>Xd(e,t,i||void 0,a,r),i||void 0)}function Yd(e,t,n){let r=new Map,i=n?.leave;if(i&&i.has(t.index)&&r.set(t.index,i.get(t.index)),e&&i)for(let[n,a]of i){if(r.has(n))continue;let i=e[1].data[n].parent;for(;i;){if(i===t){r.set(n,a);break}i=i.parent}}return r}function Xd(e,t,n,r,i){let a=[];if(n&&n.leave)for(let[e]of r){if(!n.leave.has(e))continue;let t=n.leave.get(e);for(let e of t.animateFns){let{promise:t}=e();a.push(t)}n.detachedLeaveAnimationFns=void 0}if(e&&Zd(e,t,a),a.length>0){let t=n||e?.[26];if(t){let n=t.running;n&&a.push(n),t.running=Promise.allSettled(a),$d(e,t.running,i)}else Promise.allSettled(a).then(()=>{e&&ud.delete(e[19]),i(!0)})}else e&&ud.delete(e[19]),i(!1)}function Zd(e,t,n){if(t.type&12){let r=e[t.index];if(Ka(r))for(let e=10;e<r.length;e++){let t=r[e];t[1].type===2&&Qd(t,n)}}let r=t.child;for(;r;)Zd(e,r,n),r=r.next}function Qd(e,t){let n=e[26];if(n&&n.leave)for(let e of n.leave.values())for(let n of e.animateFns){let{promise:e}=n();t.push(e)}let r=e[1].firstChild;for(;r;)Zd(e,r,t),r=r.next}function $d(e,t,n){t.then(()=>{e[26]?.running===t&&(e[26].running=void 0,ud.delete(e[19])),n(!0)})}function ef(e,t,n,r,i,a,o,s){if(i!=null){let c,l=!1;Ka(i)?c=i:Ga(i)&&(l=!0,i=i[0]);let u=to(i);e===0&&r!==null?(qd(s,r,a,n),o==null?wu(t,r,u):Cu(t,r,u,o||null,!0)):e===1&&r!==null?(qd(s,r,a,n),Cu(t,r,u,o||null,!0),Sd(a,u,s)):e===2?(s?.[26]?.leave?.has(a.index)&&Cd(a,u,s),xd.delete(u),Jd(s,a,n,e=>{if(xd.has(u)){xd.delete(u);return}Eu(t,u,l,e)})):e===3&&(xd.delete(u),Jd(s,a,n,()=>{t.destroyNode(u)})),c!=null&&wf(t,e,n,c,a,r,o)}}function tf(e,t){rf(e,t),t[0]=null,t[5]=null}function nf(e,t,n,r,i,a){r[0]=i,r[5]=t,xf(e,r,n,1,i,a)}function rf(e,t){t[10].changeDetectionScheduler?.notify(9),xf(e,t,t[11],2,null,null)}function af(e){let t=e[12];if(!t)return cf(e[1],e);for(;t;){let n=null;if(Ga(t))n=t[12];else{let e=t[10];e&&(n=e)}if(!n){for(;t&&!t[4]&&t!==e;)Ga(t)&&cf(t[1],t),t=t[3];t===null&&(t=e),Ga(t)&&cf(t[1],t),n=t&&t[4]}t=n}}function of(e,t){let n=e[9],r=n.indexOf(t);n.splice(r,1)}function sf(e,t){if(Qa(t))return;let n=t[11];n.destroyNode&&xf(e,t,n,3,null,null),af(t)}function cf(e,t){if(Qa(t))return;let n=w(null);try{t[2]&=-129,t[2]|=256,t[24]&&En(t[24]),uf(e,t),lf(e,t),t[1].type===1&&t[11].destroy();let n=t[16];if(n!==null&&Ka(t[3])){n!==t[3]&&of(n,t);let r=t[18];r!==null&&r.detachView(e)}Ul(t)}finally{w(n)}}function lf(e,t){let n=e.cleanup,r=t[7];if(n!==null)for(let e=0;e<n.length-1;e+=2)if(typeof n[e]==`string`){let t=n[e+3];t>=0?r[t]():r[-t].unsubscribe(),e+=2}else{let t=r[n[e+1]];n[e].call(t)}r!==null&&(t[7]=null);let i=t[21];if(i!==null){t[21]=null;for(let e=0;e<i.length;e++){let t=i[e];t()}}let a=t[23];if(a!==null){t[23]=null;for(let e of a)e.destroy()}}function uf(e,t){let n;if(e!=null&&(n=e.destroyHooks)!=null)for(let e=0;e<n.length;e+=2){let r=t[n[e]];if(!(r instanceof Kc)){let t=n[e+1];if(Array.isArray(t))for(let e=0;e<t.length;e+=2){let n=r[t[e]],i=t[e+1];Ic(Cc.LifecycleHookStart,n,i);try{i.call(n)}finally{Ic(Cc.LifecycleHookEnd,n,i)}}else{Ic(Cc.LifecycleHookStart,r,t);try{t.call(r)}finally{Ic(Cc.LifecycleHookEnd,r,t)}}}}}function df(e,t,n){if(t===null)throw new T(510,!1);return ff(e,t.parent,n)}function ff(e,t,n){let r=t;for(;r!==null&&r.type&168;)t=r,r=t.parent;if(r===null)return n[0];if(Ja(r)){let{encapsulation:t}=e.data[r.directiveStart+r.componentOffset];if(t===cu.None||t===cu.Emulated)return null}return ro(r,n)}function pf(e,t,n){return hf(e,t,n)}function mf(e,t,n){return e.type&40?ro(e,n):null}var hf=mf;function gf(e,t,n,r){let i=df(e,r,t),a=t[11],o=pf(r.parent||t[5],r,t);if(i!=null){if(Array.isArray(n))for(let e=0;e<n.length;e++)Tu(a,i,n[e],o,!1);else Tu(a,i,n,o,!1)}}function _f(e,t){if(t!==null){let n=t.type;if(n&3)return ro(t,e);if(n&4)return yf(-1,e[t.index]);if(n&8){let n=t.child;if(n!==null)return _f(e,n);{let n=e[t.index];return Ka(n)?yf(-1,n):to(n)}}if(n&128)return _f(e,t.next);if(n&32)return Qu(t,e)()||to(e[t.index]);{let n=vf(e,t);return n===null?_f(e,t.next):Array.isArray(n)?n[0]:_f(bo(e[15]),n)}}return null}function vf(e,t){if(t!==null){let n=e[15][5],r=t.projection;return n.projection[r]}return null}function yf(e,t){let n=10+e+1;if(n<t.length){let e=t[n],r=e[1].firstChild;if(r!==null)return _f(e,r)}return t[7]}function bf(e,t,n,r,i,a,o){for(;n!=null;){let s=r[9];if(n.type===128){n=n.next;continue}let c=r[n.index],l=n.type;if(o&&t===0&&(c&&Gl(to(c),r),n.flags|=2),!nu(n)){if(l&8)bf(e,t,n.child,r,i,a,!1),ef(t,e,s,i,c,n,a,r);else if(l&32){let o=Qu(n,r),l;for(;l=o();)ef(t,e,s,i,l,n,a,r);ef(t,e,s,i,c,n,a,r)}else l&16?Cf(e,t,r,n,i,a):ef(t,e,s,i,c,n,a,r)}n=o?n.projectionNext:n.next}}function xf(e,t,n,r,i,a){e.type===3?Sf(n,r,t,i,a):bf(n,r,e.firstChild,t,i,a,!1)}function Sf(e,t,n,r,i){let a=n[1].firstChild,o=a.next,s=to(n[a.index]),c=to(n[o.index]),l=o.index+1,u=n[l];if(t===1||t===0)r!==null&&(u&&u.hasChildNodes()?Cu(e,r,u,i,!0):(Cu(e,r,s,i,!0),Cu(e,r,c,i,!0)));else if(t===2){if(u||(u=document.createDocumentFragment(),n[l]=u),s&&s.parentNode===u)return;let e=s;for(;e!==null;){let t=e.nextSibling;if(u.appendChild(e),e===c)break;e=t}}}function Cf(e,t,n,r,i,a){let o=n[15],s=o[5].projection[r.projection];if(Array.isArray(s))for(let o=0;o<s.length;o++){let c=s[o];ef(t,e,n[9],i,c,r,a,n)}else{let n=s,c=o[3];Ll(r)&&(n.flags|=128),bf(e,t,n,c,i,a,!0)}}function wf(e,t,n,r,i,a,o){let s=r[7];if(s!==to(r)&&ef(t,e,n,a,s,i,o),!(r[2]&4))for(let n=10;n<r.length;n++){let i=r[n];xf(i[1],i,e,t,a,s)}}function Tf(e,t,n,r,i){if(t)i?e.addClass(n,r):e.removeClass(n,r);else{let t=r.indexOf(`-`)===-1?void 0:Xu.DashCase;i==null?e.removeStyle(n,r,t):(typeof i==`string`&&i.endsWith(`!important`)&&(i=i.slice(0,-10),t|=Xu.Important),e.setStyle(n,r,i,t))}}function Ef(e,t,n,r,i,a,o,s,c,l,u){let d=27+r,f=d+i,p=Df(d,f),m=typeof l==`function`?l():l;return p[1]={type:e,blueprint:p,template:n,queries:null,viewQuery:s,declTNode:t,data:p.slice().fill(null,d),bindingStartIndex:d,expandoStartIndex:f,hostBindingOpCodes:null,firstCreatePass:!0,firstUpdatePass:!0,staticViewQueries:!1,staticContentQueries:!1,preOrderHooks:null,preOrderCheckHooks:null,contentHooks:null,contentCheckHooks:null,viewHooks:null,viewCheckHooks:null,destroyHooks:null,cleanup:null,contentQueries:null,components:null,directiveRegistry:typeof a==`function`?a():a,pipeRegistry:typeof o==`function`?o():o,firstChild:null,schemas:c,consts:m,incompleteFirstPass:!1,ssrId:u}}function Df(e,t){let n=[];for(let r=0;r<t;r++)n.push(r<e?null:Yu);return n}function Of(e){let t=e.tView;return t===null||t.incompleteFirstPass?e.tView=Ef(1,null,e.template,e.decls,e.vars,e.directiveDefs,e.pipeDefs,e.viewQuery,e.schemas,e.consts,e.id):t}function kf(e,t,n,r,i,a,o,s,c,l,u){let d=t.blueprint.slice();return d[0]=i,d[2]=r|1228,(l!==null||e&&e[2]&2048)&&(d[2]|=2048),fo(d),d[3]=d[14]=e,d[8]=n,d[10]=o||e&&e[10],d[11]=s||e&&e[11],d[9]=c||e&&e[9]||null,d[5]=a,d[19]=Vl(),d[6]=u,d[20]=l,d[15]=t.type==2?e[15]:d,d}function Af(e,t,n){let r=ro(t,e),i=Of(n),a=e[10].rendererFactory,o=Nf(e,kf(e,i,null,jf(n),r,t,null,a.createRenderer(r,n),null,null,null));return e[t.index]=o}function jf(e){let t=16;return e.signals?t=4096:e.onPush&&(t=64),t}function Mf(e,t,n,r){if(n===0)return-1;let i=t.length;for(let i=0;i<n;i++)t.push(r),e.blueprint.push(r),e.data.push(null);return i}function Nf(e,t){return e[12]?e[13][4]=t:e[12]=t,e[13]=t,t}function j(e=1){Pf(No(),D(),us()+e,!1)}function Pf(e,t,n,r){if(!r){if((t[2]&3)==3){let r=e.preOrderCheckHooks;r!==null&&zc(t,r,n)}else{let r=e.preOrderHooks;r!==null&&Bc(t,r,0,n)}}ds(n)}var Ff=(function(e){return e[e.None=0]=`None`,e[e.SignalBased=1]=`SignalBased`,e[e.HasDecoratorInputTransform=2]=`HasDecoratorInputTransform`,e})(Ff||{});function If(e,t,n,r){let i=w(null);try{let[i,a,o]=e.inputs[n],s=null;(a&Ff.SignalBased)!==0&&(s=t[i][dn]),s!==null&&s.transformFn!==void 0?r=s.transformFn(r):o!==null&&(r=o.call(t,r)),e.setInput===null?Tc(t,s,i,r):e.setInput(t,s,r,n,i)}finally{w(i)}}function Lf(e,t,n,r,i){let a=us(),o=r&2;try{ds(-1),o&&t.length>27&&Pf(e,t,27,!1),Ic(o?Cc.TemplateUpdateStart:Cc.TemplateCreateStart,i,n),n(r,i)}finally{ds(a),Ic(o?Cc.TemplateUpdateEnd:Cc.TemplateCreateEnd,i,n)}}function Rf(e,t,n){Gf(e,t,n),(n.flags&64)==64&&Kf(e,t,n)}function zf(e,t,n=ro){let r=t.localNames;if(r!==null){let i=t.index+1;for(let a=0;a<r.length;a+=2){let o=r[a+1],s=o===-1?n(t,e):e[o];e[i++]=s}}}function Bf(e,t,n,r){let i=r.get($l,Ql)||n===cu.ShadowDom||n===cu.ExperimentalIsolatedShadowDom;return e.selectRootElement(t,i)}function Vf(e){return e===`class`?`className`:e===`for`?`htmlFor`:e===`formaction`?`formAction`:e===`innerHtml`?`innerHTML`:e===`readonly`?`readOnly`:e===`tabindex`?`tabIndex`:e}function Hf(e,t,n,r,i,a){let o=t[1];if(tp(e,o,t,n,r)){Ja(e)&&Wf(t,e.index);return}e.type&3&&(n=Vf(n)),Uf(e,t,n,r,i,a)}function Uf(e,t,n,r,i,a){if(e.type&3){let o=ro(e,t);r=a==null?r:a(r,e.value||``,n),i.setProperty(o,n,r)}else e.type&12}function Wf(e,t){let n=so(t,e);n[2]&16||(n[2]|=64)}function Gf(e,t,n){let r=n.directiveStart,i=n.directiveEnd;Ja(n)&&Af(t,n,e.data[r+n.componentOffset]),e.firstCreatePass||dl(n,t);let a=n.initialInputs;for(let o=r;o<i;o++){let i=e.data[o],s=Sl(t,e,o,n);if(Gl(s,t),a!==null&&Zf(t,o-r,s,i,n,a),Xa(i)){let r=so(n.index,t);r[8]=Sl(t,e,o,n)}}}function Kf(e,t,n){let r=n.directiveStart,i=n.directiveEnd,a=n.index,o=Xo();try{ds(a);for(let n=r;n<i;n++){let r=e.data[n],i=t[n];Zo(n),(r.hostBindings!==null||r.hostVars!==0||r.hostAttrs!==null)&&qf(r,i)}}finally{ds(-1),Zo(o)}}function qf(e,t){e.hostBindings!==null&&e.hostBindings(1,t)}function Jf(e,t){let n=e.directiveRegistry,r=null;if(n)for(let e=0;e<n.length;e++){let i=n[e];Hu(t,i.selectors,!1)&&(r??=[],Xa(i)?r.unshift(i):r.push(i))}return r}function Yf(e,t,n,r,i,a){let o=ro(e,t);Xf(t[11],o,a,e.value,n,r,i)}function Xf(e,t,n,r,i,a,o){if(a==null)o?.(a,r||``,i),e.removeAttribute(t,i,n);else{let s=o==null?Ai(a):o(a,r||``,i);e.setAttribute(t,i,s,n)}}function Zf(e,t,n,r,i,a){let o=a[t];if(o!==null)for(let e=0;e<o.length;e+=2){let t=o[e],i=o[e+1];If(r,n,t,i)}}function Qf(e,t,n,r,i){let a=27+n,o=t[1],s=i(o,t,e,r,n);t[a]=s,Lo(e,!0);let c=e.type===2;return c?(ku(t[11],s,e),(Eo()===0||Ya(e))&&Gl(s,t),Do()):Gl(s,t),vs()&&(!c||!nu(e))&&gf(o,t,s,e),e}function $f(e){let t=e;return Ro()?zo():(t=t.parent,Lo(t,!1)),t}function ep(e,t){let n=e[9];if(!n)return;let r;try{r=n.get(Ys,null)}catch{r=null}r?.(t)}function tp(e,t,n,r,i){let a=e.inputs?.[r],o=e.hostDirectiveInputs?.[r],s=!1;if(o)for(let e=0;e<o.length;e+=2){let r=o[e],a=o[e+1],c=t.data[r];If(c,n[r],a,i),s=!0}if(a)for(let e of a){let a=n[e],o=t.data[e];If(o,a,r,i),s=!0}return s}function np(e,t){let n=so(t,e),r=n[1];rp(r,n);let i=n[0];i!==null&&n[6]===null&&(n[6]=iu(i,n[9])),Ic(Cc.ComponentStart);try{ip(r,n,n[8])}finally{Ic(Cc.ComponentEnd,n[8])}}function rp(e,t){for(let n=t.length;n<e.blueprint.length;n++)t.push(e.blueprint[n])}function ip(e,t,n){rs(t);try{let r=e.viewQuery;r!==null&&ou(1,r,n);let i=e.template;i!==null&&Lf(e,t,i,1,n),e.firstCreatePass&&=!1,t[18]?.finishViewCreation(e),e.staticContentQueries&&au(e,t),e.staticViewQueries&&ou(2,e.viewQuery,n);let a=e.components;a!==null&&ap(t,a)}catch(t){throw e.firstCreatePass&&=(e.incompleteFirstPass=!0,!1),t}finally{t[2]&=-5,cs()}}function ap(e,t){for(let n=0;n<t.length;n++)np(e,t[n])}function op(e,t,n,r){let i=w(null);try{let i=t.tView,a=kf(e,i,n,e[2]&4096?4096:16,null,t,null,null,r?.injector??null,r?.embeddedViewInjector??null,r?.dehydratedView??null);a[16]=e[t.index];let o=e[18];return o!==null&&(a[18]=o.createEmbeddedView(i)),ip(i,a,n),a}finally{w(i)}}function sp(e,t){return!t||t.firstChild===null||Ll(e)}function cp(e,t,n,r,i=!1){if(e.type===3){let n=e.firstChild,i=n.next,a=to(t[n.index]),o=to(t[i.index]),s=a;for(;s!==null&&(r.push(s),s!==o);)s=s.nextSibling;return r}for(;n!==null;){if(n.type===128){n=i?n.projectionNext:n.next;continue}let a=t[n.index];if(a!==null){if(Ka(a)){let e=a[7];e!==a[0]&&r.push(to(a)),a[2]&4||lp(a,r),r.push(e)}else r.push(to(a))}let o=n.type;if(o&8)cp(e,t,n.child,r);else if(o&32){let e=Qu(n,t),i;for(;i=e();)r.push(i)}else if(o&16){let e=vf(t,n);if(Array.isArray(e))r.push(...e);else{let n=bo(t[15]);cp(n[1],n,e,r,!0)}}n=i?n.projectionNext:n.next}return r}function lp(e,t){for(let n=10;n<e.length;n++){let r=e[n],i=r[1].firstChild;i!==null&&cp(r[1],r,i,t)}}function up(e){if(e[25]!==null){for(let t of e[25])t.impl.addSequence(t);e[25].length=0}}var dp=[];function fp(e){return e[24]??pp(e)}function pp(e){let t=dp.pop()??Object.create(hp);return t.lView=e,t}function mp(e){e.lView[24]!==e&&(e.lView=null,dp.push(e))}var hp={...pn,consumerIsAlwaysLive:!0,kind:`template`,consumerMarkedDirty:e=>{_o(e.lView)},consumerOnSignalRead(){this.lView[24]=this}};function gp(e){let t=e[24]??Object.create(_p);return t.lView=e,t}var _p={...pn,consumerIsAlwaysLive:!0,kind:`template`,consumerMarkedDirty:e=>{let t=bo(e.lView);for(;t&&!vp(t[1]);)t=bo(t);t&&po(t)},consumerOnSignalRead(){this.lView[24]=this}};function vp(e){return e.type!==2}function yp(e){if(e[23]===null)return;let t=!0;for(;t;){let n=!1;for(let t of e[23])if(t.dirty&&(n=!0,t.zone===null||Zone.current===t.zone?t.run():t.zone.run(()=>t.run()),e[23]===null))return;t=n&&!!(e[2]&8192)}}var bp=100;function xp(e,t=0){let n=e[10].rendererFactory;n.begin?.();try{Sp(e,t)}finally{n.end?.()}}function Sp(e,t){let n=Vo();try{Ho(!0),Op(e,t);let n=0;for(;ho(e);){if(n===bp)throw new T(103,!1);n++,Op(e,1)}}finally{Ho(n)}}function Cp(e,t,n,r){if(Qa(t))return;let i=t[2];rs(t);let a=!0,o=null,s=null;vp(e)?(s=fp(t),o=xn(s)):fn()===null?(a=!1,s=gp(t),o=xn(s)):t[24]&&=(En(t[24]),null);try{fo(t),Go(e.bindingStartIndex),n!==null&&Lf(e,t,n,2,r);let a=(i&3)==3;if(a){let n=e.preOrderCheckHooks;n!==null&&zc(t,n,null)}else{let n=e.preOrderHooks;n!==null&&Bc(t,n,0,null),Vc(t,0)}if(Tp(t),yp(t),wp(t,0),e.contentQueries!==null&&au(e,t),a){let n=e.contentCheckHooks;n!==null&&zc(t,n)}else{let n=e.contentHooks;n!==null&&Bc(t,n,1),Vc(t,1)}Ap(e,t);let o=e.components;o!==null&&kp(t,o,0);let s=e.viewQuery;if(s!==null&&ou(2,s,r),a){let n=e.viewCheckHooks;n!==null&&zc(t,n)}else{let n=e.viewHooks;n!==null&&Bc(t,n,2),Vc(t,2)}if(e.firstUpdatePass===!0&&(e.firstUpdatePass=!1),t[22]){for(let e of t[22])e();t[22]=null}up(t),t[2]&=-73}catch(e){throw _o(t),e}finally{s!==null&&(Cn(s,o),a&&mp(s)),cs()}}function wp(e,t){for(let n=Kl(e);n!==null;n=ql(n))for(let e=10;e<n.length;e++){let r=n[e];Dp(r,t)}}function Tp(e){for(let t=Kl(e);t!==null;t=ql(t)){if(!(t[2]&2))continue;let e=t[9];for(let t=0;t<e.length;t++){let n=e[t];po(n)}}}function Ep(e,t,n){Ic(Cc.ComponentStart);let r=so(t,e);try{Dp(r,n)}finally{Ic(Cc.ComponentEnd,r[8])}}function Dp(e,t){co(e)&&Op(e,t)}function Op(e,t){let n=e[1],r=e[2],i=e[24],a=!!(t===0&&r&16);if(a||=!!(r&64&&t===0),a||=!!(r&1024),a||=!!(i?.dirty&&Tn(i)),a||=!1,i&&(i.dirty=!1),e[2]&=-9217,a)Cp(n,e,n.template,e[8]);else if(r&8192){let t=w(null);try{yp(e),wp(e,1);let t=n.components;t!==null&&kp(e,t,1),up(e)}finally{w(t)}}}function kp(e,t,n){for(let r=0;r<t.length;r++)Ep(e,t[r],n)}function Ap(e,t){let n=e.hostBindingOpCodes;if(n!==null)try{for(let e=0;e<n.length;e++){let r=n[e];if(r<0)ds(~r);else{let i=r,a=n[++e],o=n[++e];Yo(a,i);let s=t[i];Ic(Cc.HostBindingsUpdateStart,s);try{o(2,s)}finally{Ic(Cc.HostBindingsUpdateEnd,s)}}}}finally{ds(-1)}}function jp(e,t){let n=Vo()?64:1088;for(e[10].changeDetectionScheduler?.notify(t);e;){e[2]|=n;let t=bo(e);if(Za(e)&&!t)return e;e=t}return null}function Mp(e,t,n,r){return[e,!0,0,t,null,r,null,n,null,null]}function Np(e,t){let n=10+t;if(n<e.length)return e[n]}function Pp(e,t,n,r=!0){let i=t[1];if(Lp(i,t,e,n),r){let r=yf(n,e),a=t[11],o=a.parentNode(e[7]);o!==null&&nf(i,e[5],a,t,o,r)}let a=t[6];a!==null&&a.firstChild!==null&&(a.firstChild=null)}function Fp(e,t){let n=Ip(e,t);return n!==void 0&&sf(n[1],n),n}function Ip(e,t){if(e.length<=10)return;let n=10+t,r=e[n];if(r){let i=r[16];i!==null&&i!==e&&of(i,r),t>0&&(e[n-1][4]=r[4]);let a=ra(e,10+t);tf(r[1],r);let o=a[18];o!==null&&o.detachView(a[1]),r[3]=null,r[4]=null,r[2]&=-129}return r}function Lp(e,t,n,r){let i=10+r,a=n.length;r>0&&(n[i-1][4]=t),r<a-10?(t[4]=n[i],na(n,10+r,t)):(n.push(t),t[4]=null),t[3]=n;let o=t[16];o!==null&&n!==o&&Rp(o,t);let s=t[18];s!==null&&s.insertView(e),go(t),t[2]|=128}function Rp(e,t){let n=e[9],r=t[3];if(Ga(r))e[2]|=2;else{let n=r[3][15];t[15]!==n&&(e[2]|=2)}n===null?e[9]=[t]:n.push(t)}var zp=class{_lView;_cdRefInjectingView;_appRef=null;_attachedToViewContainer=!1;exhaustive;get rootNodes(){let e=this._lView,t=e[1];return cp(t,e,t.firstChild,[])}constructor(e,t){this._lView=e,this._cdRefInjectingView=t}get context(){return this._lView[8]}set context(e){this._lView[8]=e}get destroyed(){return Qa(this._lView)}destroy(){if(this._appRef)this._appRef.detachView(this);else if(this._attachedToViewContainer){let e=this._lView[3];if(Ka(e)){let t=e[8],n=t?t.indexOf(this):-1;n>-1&&(Ip(e,n),ra(t,n))}this._attachedToViewContainer=!1}sf(this._lView[1],this._lView)}onDestroy(e){vo(this._lView,e)}markForCheck(){jp(this._cdRefInjectingView||this._lView,4)}detach(){this._lView[2]&=-129}reattach(){go(this._lView),this._lView[2]|=128}detectChanges(){this._lView[2]|=1024,xp(this._lView)}checkNoChanges(){}attachToViewContainerRef(){if(this._appRef)throw new T(902,!1);this._attachedToViewContainer=!0}detachFromAppRef(){this._appRef=null;let e=Za(this._lView),t=this._lView[16];t!==null&&!e&&of(t,this._lView),rf(this._lView[1],this._lView)}attachToAppRef(e){if(this._attachedToViewContainer)throw new T(902,!1);this._appRef=e;let t=Za(this._lView),n=this._lView[16];n!==null&&!t&&Rp(n,this._lView),go(this._lView)}},Bp=(()=>{class e{_declarationLView;_declarationTContainer;elementRef;static __NG_ELEMENT_ID__=Vp;constructor(e,t,n){this._declarationLView=e,this._declarationTContainer=t,this.elementRef=n}get ssrId(){return this._declarationTContainer.tView?.ssrId||null}createEmbeddedView(e,t){return this.createEmbeddedViewImpl(e,t)}createEmbeddedViewImpl(e,t,n){return new zp(op(this._declarationLView,this._declarationTContainer,e,{embeddedViewInjector:t,dehydratedView:n}))}}return e})();function Vp(){return Hp(Po(),D())}function Hp(e,t){return e.type&4?new Bp(t,e,Ml(e,t)):null}function Up(e,t,n,r,i){let a=e.data[t];if(a===null)a=Wp(e,t,n,r,i),Jo()&&(a.flags|=32);else if(a.type&64){a.type=n,a.value=r,a.attrs=i;let e=Io();a.injectorIndex=e===null?-1:e.injectorIndex}return Lo(a,!0),a}function Wp(e,t,n,r,i){let a=Fo(),o=Ro(),s=o?a:a&&a.parent,c=e.data[t]=Kp(e,s,n,t,r,i);return Gp(e,c,a,o),c}function Gp(e,t,n,r){e.firstChild===null&&(e.firstChild=t),n!==null&&(r?n.child==null&&t.parent!==null&&(n.child=t):n.next===null&&(n.next=t,t.prev=n))}function Kp(e,t,n,r,i,a){let o=t?t.injectorIndex:-1,s=0;return Ao()&&(s|=128),{type:n,index:r,insertBeforeIndex:null,injectorIndex:o,directiveStart:-1,directiveEnd:-1,directiveStylingLast:-1,componentOffset:-1,controlDirectiveIndex:-1,customControlIndex:-1,propertyBindings:null,flags:s,providerIndexes:0,value:i,namespace:gs(),attrs:a,mergedAttrs:null,localNames:null,initialInputs:null,inputs:null,hostDirectiveInputs:null,outputs:null,hostDirectiveOutputs:null,directiveToIndex:null,tView:null,next:null,prev:null,projectionNext:null,child:null,parent:t,projection:null,styles:null,stylesWithoutHost:null,residualStyles:void 0,classes:null,classesWithoutHost:null,residualClasses:void 0,classBindings:0,styleBindings:0}}function qp(e){let t=e[6]??[],n=e[3][11],r=[];for(let e of t)e.data.di===void 0?Jp(e,n):r.push(e);e[6]=r}function Jp(e,t){let n=0,r=e.firstChild;if(r){let i=e.data.r;for(;n<i;){let e=r.nextSibling;Eu(t,r,!1),r=e,n++}}}var Yp=()=>null,Xp=()=>null;function Zp(e,t){return Yp(e,t)}function Qp(e,t,n){return Xp(e,t,n)}var $p=class{},em=class{},tm=(()=>{class e{static ɵprov=di({token:e,providedIn:`root`,factory:()=>null})}return e})();function nm(e){return e.debugInfo?.className||e.type.name||null}var rm={},im=class{injector;parentInjector;constructor(e,t){this.injector=e,this.parentInjector=t}get(e,t,n){let r=this.injector.get(e,rm,n);return r!==rm||t===rm?r:this.parentInjector.get(e,t,n)}};function am(e,t,n){return e[t]=n}function om(e,t){return e[t]}function sm(e,t,n){if(n===Yu)return!1;let r=e[t];return!Object.is(r,n)&&(e[t]=n,!0)}function cm(e,t,n,r){let i=sm(e,t,n);return sm(e,t+1,r)||i}function lm(e,t,n,r,i){let a=cm(e,t,n,r);return sm(e,t+2,i)||a}function um(e,t,n,r,i,a){let o=cm(e,t,n,r);return cm(e,t+2,i,a)||o}function dm(e,t,n){return function r(i){let a=r.__ngNativeEl__;a!==void 0&&tu(i,a),jp(Ja(e)?so(e.index,t):t,5);let o=t[8],s=fm(t,o,n,i),c=r.__ngNextListenerFn__;for(;c;)s=fm(t,o,c,i)&&s,c=c.__ngNextListenerFn__;return s}}function fm(e,t,n,r){let i=w(null);try{return Ic(Cc.OutputStart,t,n),n(r)!==!1}catch(t){return ep(e,t),!1}finally{Ic(Cc.OutputEnd,t,n),w(i)}}function pm(e,t,n,r,i,a,o,s){let c=Ya(e),l=!1,u=null;if(!r&&c&&(u=hm(t,n,a,e.index)),u!==null){let e=u.__ngLastListenerFn__||u;e.__ngNextListenerFn__=o,u.__ngLastListenerFn__=o,l=!0}else{let o=ro(e,n),c=r?r(o):o;r||(s.__ngNativeEl__=o);let l=i.listen(c,a,s);mm(a)||gm(r?t=>r(to(t[e.index])):e.index,t,n,a,s,l,!1)}return l}function mm(e){return e.startsWith(`animation`)||e.startsWith(`transition`)}function hm(e,t,n,r){let i=e.cleanup;if(i!=null)for(let e=0;e<i.length-1;e+=2){let a=i[e];if(a===n&&i[e+1]===r){let n=t[7],r=i[e+2];return n&&n.length>r?n[r]:null}typeof a==`string`&&(e+=2)}return null}function gm(e,t,n,r,i,a,o){let s=t.firstCreatePass?So(t):null,c=xo(n),l=c.length;c.push(i,a),s&&s.push(r,e,l,(l+1)*(o?-1:1))}function _m(e,t,n,r,i,a){let o=t[n],s=t[1],c=o[s.data[n].outputs[r]].subscribe(a);gm(e.index,s,t,i,a,c,!0)}var vm=Symbol(`BINDING`),ym=new vi(``);function bm(e,t,n){let r=n?e.styles:null,i=n?e.classes:null,a=0;if(t!==null)for(let e=0;e<t.length;e++){let n=t[e];if(typeof n==`number`)a=n;else if(a==1)i=oi(i,n);else if(a==2){let i=n,a=t[++e];r=oi(r,i+`: `+a+`;`)}}n?e.styles=r:e.stylesWithoutHost=r,n?e.classes=i:e.classesWithoutHost=i}function xm(e,t=0){let n=D();return n===null?qi(e,t):vl(Po(),n,li(e),t)}function Sm(e,t,n,r,i){let a=r===null?null:{"":-1},o=i(e,n);if(o!==null){let r=o,i=null,s=null;for(let e of o)if(e.resolveHostDirectives!==null){[r,i,s]=e.resolveHostDirectives(o);break}Tm(e,t,n,r,a,i,s)}a!==null&&r!==null&&Cm(n,r,a)}function Cm(e,t,n){let r=e.localNames=[];for(let e=0;e<t.length;e+=2){let i=n[t[e+1]];if(i==null)throw new T(-301,!1);r.push(t[e],i)}}function wm(e,t,n){t.componentOffset=n,(e.components??=[]).push(t.index)}function Tm(e,t,n,r,i,a,o){let s=r.length,c=null;for(let i=0;i<s;i++){let a=r[i];c===null&&Xa(a)&&(c=a,wm(e,n,i)),hl(dl(n,t),e,a.type)}Fm(n,e.data.length,s),c?.viewProvidersResolver&&c.viewProvidersResolver(c);for(let e=0;e<s;e++){let t=r[e];t.providersResolver&&t.providersResolver(t)}let l=!1,u=!1,d=Mf(e,t,s,null);s>0&&(n.directiveToIndex=new Map);for(let c=0;c<s;c++){let s=r[c];if(n.mergedAttrs=Qc(n.mergedAttrs,s.hostAttrs),jm(e,n,t,d,s),Pm(d,s,i),o!==null&&o.has(s)){let[e,t]=o.get(s);n.directiveToIndex.set(s.type,[d,e+n.directiveStart,t+n.directiveStart])}else(a===null||!a.has(s))&&n.directiveToIndex.set(s.type,d);s.contentQueries!==null&&(n.flags|=4),(s.hostBindings!==null||s.hostAttrs!==null||s.hostVars!==0)&&(n.flags|=64);let f=s.type.prototype;!l&&(f.ngOnChanges||f.ngOnInit||f.ngDoCheck)&&((e.preOrderHooks??=[]).push(n.index),l=!0),!u&&(f.ngOnChanges||f.ngDoCheck)&&((e.preOrderCheckHooks??=[]).push(n.index),u=!0),d++}Em(e,n,a)}function Em(e,t,n){for(let r=t.directiveStart;r<t.directiveEnd;r++){let i=e.data[r];if(n===null||!n.has(i))Dm(0,t,i,r),Dm(1,t,i,r),Am(t,r,!1);else{let e=n.get(i);Om(0,t,e,r),Om(1,t,e,r),Am(t,r,!0)}}}function Dm(e,t,n,r){let i=e===0?n.inputs:n.outputs;for(let n in i)if(Object.hasOwn(i,n)){let i;i=e===0?t.inputs??={}:t.outputs??={},i[n]??=[],i[n].push(r),km(t,n)}}function Om(e,t,n,r){let i=e===0?n.inputs:n.outputs;for(let n in i)if(Object.hasOwn(i,n)){let a=i[n],o;o=e===0?t.hostDirectiveInputs??={}:t.hostDirectiveOutputs??={},o[a]??=[],o[a].push(r,n),km(t,a)}}function km(e,t){t===`class`?e.flags|=8:t===`style`&&(e.flags|=16)}function Am(e,t,n){let{attrs:r,inputs:i,hostDirectiveInputs:a}=e;if(r===null||!n&&i===null||n&&a===null||Lu(e)){e.initialInputs??=[],e.initialInputs.push(null);return}let o=null,s=0;for(;s<r.length;){let e=r[s];if(e===0){s+=4;continue}if(e===5){s+=2;continue}if(typeof e==`number`)break;if(!n&&Object.hasOwn(i,e)){let n=i[e];for(let i of n)if(i===t){o??=[],o.push(e,r[s+1]);break}}else if(n&&Object.hasOwn(a,e)){let n=a[e];for(let e=0;e<n.length;e+=2)if(n[e]===t){o??=[],o.push(n[e+1],r[s+1]);break}}s+=2}e.initialInputs??=[],e.initialInputs.push(o)}function jm(e,t,n,r,i){e.data[r]=i;let a=new Kc(i.factory||=Qi(i.type,!0),Xa(i),xm,null);e.blueprint[r]=a,n[r]=a,Mm(e,t,r,Mf(e,n,i.hostVars,Yu),i)}function Mm(e,t,n,r,i){let a=i.hostBindings;if(a){let i=e.hostBindingOpCodes;i===null&&(i=e.hostBindingOpCodes=[]);let o=~t.index;Nm(i)!=o&&i.push(o),i.push(n,r,a)}}function Nm(e){let t=e.length;for(;t>0;){let n=e[--t];if(typeof n==`number`&&n<0)return n}return 0}function Pm(e,t,n){if(n){if(t.exportAs)for(let r=0;r<t.exportAs.length;r++)n[t.exportAs[r]]=e;Xa(t)&&(n[``]=e)}}function Fm(e,t,n){e.flags|=1,e.directiveStart=t,e.directiveEnd=t+n,e.providerIndexes=t}function Im(e,t,n,r,i,a,o,s){let c=t[1],l=c.consts,u=Up(c,e,n,r,uo(l,o));return a&&Sm(c,t,u,uo(l,s),i),u.mergedAttrs=Qc(u.mergedAttrs,u.attrs),u.attrs!==null&&bm(u,u.attrs,!1),u.mergedAttrs!==null&&bm(u,u.mergedAttrs,!0),c.queries!==null&&c.queries.elementStart(c,u),u}function Lm(e,t){Rc(e,t),qa(t)&&e.queries.elementEnd(t)}function Rm(e,t,n,r,i,a){let o=t.consts,s=Up(t,e,n,r,uo(o,i));if(s.mergedAttrs=Qc(s.mergedAttrs,s.attrs),a!=null){let e=uo(o,a);s.localNames=[];for(let t=0;t<e.length;t+=2)s.localNames.push(e[t],-1)}return s.attrs!==null&&bm(s,s.attrs,!1),s.mergedAttrs!==null&&bm(s,s.mergedAttrs,!0),t.queries!==null&&t.queries.elementStart(t,s),s}var zm=typeof ShadowRoot<`u`,Bm=typeof Document<`u`;function Vm(e){return Object.keys(e).map(t=>{let[n,r,i]=e[t],a={propName:n,templateName:t,isSignal:(r&Ff.SignalBased)!==0};return i&&(a.transform=i),a})}function Hm(e){return Object.keys(e).map(t=>({propName:e[t],templateName:t}))}function Um(e,t,n){let r=t instanceof Aa?t:t?.injector;return r&&e.getStandaloneInjector!==null&&(r=e.getStandaloneInjector(r)||r),r?new im(n,r):n}function Wm(e){let t=e.get(em,null);if(t===null)throw new T(407,!1);return{rendererFactory:t,sanitizer:e.get(tm,null),changeDetectionScheduler:e.get(ac,null),ngReflect:!1,tracingService:e.get(Ad,null,{optional:!0})}}function Gm(e,t,n){let r=qm(e);return Su(t,r,r===`svg`?`svg`:r===`math`?eo:n)}function Km(e){if((e&&`localName`in e&&typeof e.localName==`string`?e.localName:e?.tagName)?.toLowerCase()===`script`)throw new T(905,!1)}function qm(e){return(e.selectors[0][0]||`div`).toLowerCase()}var Jm=class{componentDef;ngModule;selector;componentType;ngContentSelectors;isBoundToModule;cachedInputs=null;cachedOutputs=null;get inputs(){return this.cachedInputs??=Vm(this.componentDef.inputs),this.cachedInputs}get outputs(){return this.cachedOutputs??=Hm(this.componentDef.outputs),this.cachedOutputs}constructor(e,t){this.componentDef=e,this.ngModule=t,this.componentType=e.type,this.selector=qu(e.selectors),this.ngContentSelectors=e.ngContentSelectors??[],this.isBoundToModule=!!t}create(e,t,n,r,i,a,o){Ic(Cc.DynamicComponentStart);let s=w(null);try{let s=this.componentDef,c=Um(s,r||this.ngModule,e),l=Wm(c),u=l.tracingService;return u&&u.componentCreate?u.componentCreate(nm(s),()=>this.createComponentRef(l,c,t,n,i,a,o)):this.createComponentRef(l,c,t,n,i,a,o)}finally{w(s)}}createComponentRef(e,t,n,r,i,a,o){let s=this.componentDef,c=Ym(r,s,a,i),l=e.rendererFactory.createRenderer(null,s),u=r?Bf(l,r,s.encapsulation,t):Gm(s,l,o??null);Km(u);let d=t.get(ym,null),f=Xm(u,()=>t.get(Cs,null)??Zl());d&&d.addHost(f);let p=a?.some(Qm)||i?.some(e=>typeof e!=`function`&&e.bindings.some(Qm)),m=kf(null,c,null,512|jf(s),null,null,e,l,t,null,iu(u,t,!0));d&&zm&&f instanceof ShadowRoot&&vo(m,()=>{d.removeHost(f)}),m[27]=u,rs(m);let h=null;try{let e=Im(27,m,2,`#host`,()=>c.directiveRegistry,!0,0);ku(l,u,e),Gl(u,m),Rf(c,m,e),su(c,e,m),Lm(c,e),n!==void 0&&eh(e,this.ngContentSelectors,n),h=so(e.index,m),m[8]=h[8],ip(c,m,null)}catch(e){throw h!==null&&Ul(h),Ul(m),e}finally{Ic(Cc.DynamicComponentEnd),cs()}return new $m(this.componentType,m,!!p)}};function Ym(e,t,n,r){let i=e?[`ng-version`,`22.1.7`]:Ju(t.selectors[0]),a=null,o=null,s=0;if(n)for(let e of n)s+=e[vm].requiredVars,e.create&&(e.targetIdx=0,(a??=[]).push(e)),e.update&&(e.targetIdx=0,(o??=[]).push(e));if(r)for(let e=0;e<r.length;e++){let t=r[e];if(typeof t!=`function`)for(let n of t.bindings){s+=n[vm].requiredVars;let t=e+1;n.create&&(n.targetIdx=t,(a??=[]).push(n)),n.update&&(n.targetIdx=t,(o??=[]).push(n))}}let c=[t];if(r)for(let e of r){let t=Di(typeof e==`function`?e:e.type);c.push(t)}return Ef(0,null,Zm(a,o),1,s,c,null,null,null,[i],null)}function Xm(e,t){let n=e.getRootNode?.();return Bm&&n instanceof Document?n.head:n&&zm&&n instanceof ShadowRoot?n:t().head}function Zm(e,t){return!e&&!t?null:n=>{if(n&1&&e)for(let t of e)t.create();if(n&2&&t)for(let e of t)e.update()}}function Qm(e){let t=e[vm].kind;return t===`input`||t===`twoWay`}var $m=class extends $p{_rootLView;_hasInputBindings;instance;hostView;changeDetectorRef;componentType;location;previousInputValues=null;_tNode;constructor(e,t,n){super(),this._rootLView=t,this._hasInputBindings=n,this._tNode=io(t[1],27),this.location=Ml(this._tNode,t),this.instance=so(this._tNode.index,t)[8],this.hostView=this.changeDetectorRef=new zp(t,void 0),this.componentType=e}setInput(e,t){this._hasInputBindings;let n=this._tNode;if(this.previousInputValues??=new Map,this.previousInputValues.has(e)&&Object.is(this.previousInputValues.get(e),t))return;let r=this._rootLView;tp(n,r[1],r,e,t),this.previousInputValues.set(e,t),jp(so(n.index,r),1)}get injector(){return new El(this._tNode,this._rootLView)}destroy(){this.hostView.destroy()}onDestroy(e){this.hostView.onDestroy(e)}};function eh(e,t,n){let r=e.projection=[];for(let e=0;e<t.length;e++){let t=n[e];r.push(t!=null&&t.length?Array.from(t):null)}}var th=(()=>{class e{static __NG_ELEMENT_ID__=nh}return e})();function nh(){return oh(Po(),D())}var rh=class e extends th{_lContainer;_hostTNode;_hostLView;constructor(e,t,n){super(),this._lContainer=e,this._hostTNode=t,this._hostLView=n}get element(){return Ml(this._hostTNode,this._hostLView)}get injector(){return new El(this._hostTNode,this._hostLView)}get parentInjector(){let e=ml(this._hostTNode,this._hostLView);if(el(e)){let t=rl(e,this._hostLView),n=tl(e),r=t[1].data[n+8];return new El(r,t)}return new El(null,this._hostLView)}clear(){for(;this.length>0;)this.remove(this.length-1)}get(e){let t=ih(this._lContainer);return t!==null&&t[e]||null}get length(){return this._lContainer.length-10}createEmbeddedView(e,t,n){let r,i;typeof n==`number`?r=n:n!=null&&(r=n.index,i=n.injector);let a=Zp(this._lContainer,e.ssrId),o=e.createEmbeddedViewImpl(t||{},i,a);return this.insertImpl(o,r,sp(this._hostTNode,a)),o}createComponent(e,t,n,r,i,a,o){let s,c=t||{};s=c.index,n=c.injector,r=c.projectableNodes,i=c.environmentInjector||c.ngModuleRef,a=c.directives,o=c.bindings;let l=new Jm(Ei(e)),u=n||this.parentInjector;if(!i&&l.ngModule==null){let e=this.parentInjector.get(Aa,null);e&&(i=e)}let d=Ei(l.componentType??{}),f=Zp(this._lContainer,d?.id??null),p=f?.firstChild??null,m=l.create(u,r,p,i,a,o,this._getHostElementNamespace());return this.insertImpl(m.hostView,s,sp(this._hostTNode,f)),m}_getHostElementNamespace(){if(this._hostTNode.type&2){let e=this._hostTNode.parent??this._hostLView[5];return e!==null&&e.type&2&&typeof e.value==`string`&&e.value.toLowerCase()===`foreignobject`?null:e?.namespace??null}return this._hostTNode.namespace}insert(e,t){return this.insertImpl(e,t,!0)}insertImpl(t,n,r){let i=t._lView;if(lo(i)){let n=this.indexOf(t);if(n!==-1)this.detach(n);else{let n=i[3],r=new e(n,n[5],n[3]);r.detach(r.indexOf(t))}}let a=this._adjustIndex(n),o=this._lContainer;return Pp(o,i,a,r),t.attachToViewContainerRef(),na(ah(o),a,t),t}move(e,t){return this.insert(e,t)}indexOf(e){let t=ih(this._lContainer);return t===null?-1:t.indexOf(e)}remove(e){let t=this._adjustIndex(e,-1),n=Ip(this._lContainer,t);n&&(ra(ah(this._lContainer),t),sf(n[1],n))}detach(e){let t=this._adjustIndex(e,-1),n=Ip(this._lContainer,t);return n&&ra(ah(this._lContainer),t)!=null?new zp(n):null}_adjustIndex(e,t=0){return e??this.length+t}};function ih(e){return e[8]}function ah(e){return e[8]||=[]}function oh(e,t){let n,r=t[e.index];return Ka(r)?n=r:(n=Mp(r,t,null,e),t[e.index]=n,Nf(t,n)),ch(n,t,e,r),new rh(n,e,t)}function sh(e,t){let n=e[11],r=n.createComment(``),i=ro(t,e);return Cu(n,n.parentNode(i),r,n.nextSibling(i),!1),r}var ch=dh,lh=()=>!1;function uh(e,t,n){return lh(e,t,n)}function dh(e,t,n,r){if(e[7])return;let i;i=n.type&8?to(r):sh(t,n),e[7]=i}var fh=class e{queryList;matches=null;constructor(e){this.queryList=e}clone(){return new e(this.queryList)}setDirty(){this.queryList.setDirty()}},ph=class e{queries;constructor(e=[]){this.queries=e}createEmbeddedView(t){let n=t.queries;if(n!==null){let r=t.contentQueries===null?n.length:t.contentQueries[0],i=[];for(let e=0;e<r;e++){let t=n.getByIndex(e),r=this.queries[t.indexInDeclarationView];i.push(r.clone())}return new e(i)}return null}insertView(e){this.dirtyQueriesWithMatches(e)}detachView(e){this.dirtyQueriesWithMatches(e)}finishViewCreation(e){this.dirtyQueriesWithMatches(e)}dirtyQueriesWithMatches(e){for(let t=0;t<this.queries.length;t++)Oh(e,t).matches!==null&&this.queries[t].setDirty()}},mh=class{flags;read;predicate;constructor(e,t,n=null){this.flags=t,this.read=n,this.predicate=typeof e==`string`?Eh(e):e}},hh=class e{queries;constructor(e=[]){this.queries=e}elementStart(e,t){for(let n=0;n<this.queries.length;n++)this.queries[n].elementStart(e,t)}elementEnd(e){for(let t=0;t<this.queries.length;t++)this.queries[t].elementEnd(e)}embeddedTView(t){let n=null;for(let e=0;e<this.length;e++){let r=n===null?0:n.length,i=this.getByIndex(e).embeddedTView(t,r);i&&(i.indexInDeclarationView=e,n===null?n=[i]:n.push(i))}return n===null?null:new e(n)}template(e,t){for(let n=0;n<this.queries.length;n++)this.queries[n].template(e,t)}getByIndex(e){return this.queries[e]}get length(){return this.queries.length}track(e){this.queries.push(e)}},gh=class e{metadata;matches=null;indexInDeclarationView=-1;crossesNgTemplate=!1;_declarationNodeIndex;_appliesToNextNode=!0;constructor(e,t=-1){this.metadata=e,this._declarationNodeIndex=t}elementStart(e,t){this.isApplyingToNode(t)&&this.matchTNode(e,t)}elementEnd(e){this._declarationNodeIndex===e.index&&(this._appliesToNextNode=!1)}template(e,t){this.elementStart(e,t)}embeddedTView(t,n){return this.isApplyingToNode(t)?(this.crossesNgTemplate=!0,this.addMatch(-t.index,n),new e(this.metadata)):null}isApplyingToNode(e){if(this._appliesToNextNode&&(this.metadata.flags&1)!=1){let t=this._declarationNodeIndex,n=e.parent;for(;n!==null&&n.type&8&&n.index!==t;)n=n.parent;return t===(n===null?-1:n.index)}return this._appliesToNextNode}matchTNode(e,t){let n=this.metadata.predicate;if(Array.isArray(n))for(let r=0;r<n.length;r++){let i=n[r];this.matchTNodeWithReadOption(e,t,_h(t,i)),this.matchTNodeWithReadOption(e,t,xl(t,e,i,!1,!1))}else n===Bp?t.type&4&&this.matchTNodeWithReadOption(e,t,-1):this.matchTNodeWithReadOption(e,t,xl(t,e,n,!1,!1))}matchTNodeWithReadOption(e,t,n){if(n!==null){let r=this.metadata.read;if(r!==null){if(r===Nl||r===th||r===Bp&&t.type&4)this.addMatch(t.index,-2);else{let n=xl(t,e,r,!1,!1);n!==null&&this.addMatch(t.index,n)}}else this.addMatch(t.index,n)}}addMatch(e,t){this.matches===null?this.matches=[e,t]:this.matches.push(e,t)}};function _h(e,t){let n=e.localNames;if(n!==null){for(let e=0;e<n.length;e+=2)if(n[e]===t)return n[e+1]}return null}function vh(e,t){return e.type&11?Ml(e,t):e.type&4?Hp(e,t):null}function yh(e,t,n,r){return n===-1?vh(t,e):n===-2?bh(e,t,r):Sl(e,e[1],n,t)}function bh(e,t,n){if(n===Nl)return Ml(t,e);if(n===Bp)return Hp(t,e);if(n===th)return oh(t,e)}function xh(e,t,n,r){let i=t[18].queries[r];if(i.matches===null){let r=e.data,a=n.matches,o=[];for(let e=0;a!==null&&e<a.length;e+=2){let i=a[e];if(i<0)o.push(null);else{let s=r[i];o.push(yh(t,s,a[e+1],n.metadata.read))}}i.matches=o}return i.matches}function Sh(e,t,n,r){let i=e.queries.getByIndex(n),a=i.matches;if(a!==null){let o=xh(e,t,i,n);for(let e=0;e<a.length;e+=2){let n=a[e];if(n>0)r.push(o[e/2]);else{let i=a[e+1],o=t[-n];for(let e=10;e<o.length;e++){let t=o[e];t[16]===t[3]&&Sh(t[1],t,i,r)}if(o[9]!==null){let e=o[9];for(let t=0;t<e.length;t++){let n=e[t];Sh(n[1],n,i,r)}}}}}return r}function Ch(e,t){return e[18].queries[t].queryList}function wh(e,t,n){let r=new Il((n&4)==4);return Co(e,t,r,r.destroy),(t[18]??=new ph).queries.push(new fh(r))-1}function Th(e,t,n){let r=No();return r.firstCreatePass&&(Dh(r,new mh(e,t,n),-1),(t&2)==2&&(r.staticViewQueries=!0)),wh(r,D(),t)}function Eh(e){return e.split(`,`).map(e=>e.trim())}function Dh(e,t,n){e.queries===null&&(e.queries=new hh),e.queries.track(new gh(t,n))}function Oh(e,t){return e.queries.getByIndex(t)}function kh(e,t){let n=e[1],r=Oh(n,t);return r.crossesNgTemplate?Sh(n,e,t,[]):xh(n,e,r,t)}function Ah(e,t,n){let r,i=Mn(()=>{r._dirtyCounter();let n=Ph(r,e);if(t&&n===void 0)throw new T(-951,!1);return n});return r=i[dn],r._dirtyCounter=A(0),r._flatValue=void 0,i}function jh(e){return Ah(!0,!1,e)}function Mh(e){return Ah(!0,!0,e)}function Nh(e,t){let n=e[dn];n._lView=D(),n._queryIndex=t,n._queryList=Ch(n._lView,t),n._queryList.onDirty(()=>n._dirtyCounter.update(e=>e+1))}function Ph(e,t){let n=e._lView,r=e._queryIndex;if(n===void 0||r===void 0||n[2]&4)return t?void 0:ua;let i=Ch(n,r),a=kh(n,r);return i.reset(a,Pl),t?i.first:i._changesDetected||e._flatValue===void 0?e._flatValue=i.toArray():e._flatValue}function Fh(e){return!!e&&typeof e.then==`function`}function Ih(e){return!!e&&typeof e.subscribe==`function`}var Lh=class{},Rh=class extends Lh{injector;instance=null;constructor(e){super();let t=new ja([...e.providers,{provide:Lh,useValue:this}],e.parent||ka(),e.debugName,new Set([`environment`]));this.injector=t,e.runEnvironmentInitializers&&t.resolveInjectorInitializers()}destroy(){this.injector.destroy()}onDestroy(e){this.injector.onDestroy(e)}};function zh(e,t,n=null){return new Rh({providers:e,parent:t,debugName:n,runEnvironmentInitializers:!0}).injector}var Bh=(()=>{class e{_injector;cachedInjectors=new Map;constructor(e){this._injector=e}getOrCreateStandaloneInjector(e){if(!e.standalone)return null;if(!this.cachedInjectors.has(e)){let t=ga(!1,e.type),n=t.length>0?zh([t],this._injector,``):null;this.cachedInjectors.set(e,n)}return this.cachedInjectors.get(e)}ngOnDestroy(){try{for(let e of this.cachedInjectors.values())e!==null&&e.destroy()}finally{this.cachedInjectors.clear()}}static ɵprov=di({token:e,providedIn:`environment`,factory:()=>new e(qi(Aa))})}return e})();function Vh(e){return Sc(()=>{let t=qh(e),n={...t,decls:e.decls,vars:e.vars,template:e.template,consts:e.consts||null,ngContentSelectors:e.ngContentSelectors,onPush:e.changeDetection!==Rl.Eager,directiveDefs:null,pipeDefs:null,dependencies:t.standalone&&e.dependencies||null,getStandaloneInjector:t.standalone?e=>e.get(Bh).getOrCreateStandaloneInjector(n):null,getExternalStyles:null,signals:e.signals??!1,data:e.data||{},encapsulation:e.encapsulation||cu.Emulated,styles:e.styles||ua,_:null,schemas:e.schemas||null,tView:null,id:``};t.standalone&&Md(`NgStandalone`),Jh(n);let r=e.dependencies;return n.directiveDefs=Yh(r,Hh),n.pipeDefs=Yh(r,Oi),n.id=Xh(n),n})}function Hh(e){return Ei(e)||Di(e)}function Uh(e,t){if(e==null)return la;let n={};for(let r in e)if(Object.hasOwn(e,r)){let i=e[r],a,o,s,c;Array.isArray(i)?(s=i[0],a=i[1],o=i[2]??a,c=i[3]||null):(a=i,o=i,s=Ff.None,c=null),n[a]=[r,s,c],t[a]=o}return n}function Wh(e){if(e==null)return la;let t={};for(let n in e)Object.hasOwn(e,n)&&(t[e[n]]=n);return t}function Gh(e){return Sc(()=>{let t=qh(e);return Jh(t),t})}function Kh(e){return{type:e.type,name:e.name,factory:null,pure:e.pure!==!1,standalone:e.standalone??!0,onDestroy:e.type.prototype.ngOnDestroy||null}}function qh(e){let t={};return{type:e.type,providersResolver:null,viewProvidersResolver:null,factory:null,hostBindings:e.hostBindings||null,hostVars:e.hostVars||0,hostAttrs:e.hostAttrs||null,contentQueries:e.contentQueries||null,declaredInputs:t,inputConfig:e.inputs||la,exportAs:e.exportAs||null,standalone:e.standalone??!0,signals:e.signals===!0,selectors:e.selectors||ua,viewQuery:e.viewQuery||null,features:e.features||null,setInput:null,resolveHostDirectives:null,hostDirectives:null,controlDef:null,signalFormsInputPresence:null,inputs:Uh(e.inputs,t),outputs:Wh(e.outputs),debugInfo:null}}function Jh(e){e.features?.forEach(t=>t(e))}function Yh(e,t){return e?()=>{let n=typeof e==`function`?e():e,r=[];for(let e of n){let n=t(e);n!==null&&r.push(n)}return r}:null}function Xh(e){let t=0,n=typeof e.consts==`function`?``:e.consts,r=[e.selectors,e.ngContentSelectors,e.hostVars,e.hostAttrs,n,e.vars,e.decls,e.encapsulation,e.standalone,e.signals,e.exportAs,JSON.stringify(e.inputs),JSON.stringify(e.outputs),Object.getOwnPropertyNames(e.type.prototype),!!e.contentQueries,!!e.viewQuery];for(let e of r.join(`|`))t=Math.imul(31,t)+e.charCodeAt(0)<<0;return t+=2147483648,`c`+t}var Zh=new vi(``),Qh=(()=>{class e{resolve;reject;initialized=!1;done=!1;donePromise=new Promise((e,t)=>{this.resolve=e,this.reject=t});appInits=E(Zh,{optional:!0})??[];injector=E(Ss);constructor(){}runInitializers(){if(this.initialized)return;let e=[];for(let t of this.appInits){let n=Ha(this.injector,t);if(Fh(n))e.push(n);else if(Ih(n)){let t=new Promise((e,t)=>{n.subscribe({complete:e,error:t})});e.push(t)}}let t=()=>{this.done=!0,this.resolve()};Promise.all(e).then(()=>{t()}).catch(e=>{this.reject(e)}),e.length===0&&t(),this.initialized=!0}static ɵfac=function(t){return new(t||e)};static ɵprov=Al({token:e,factory:e.ɵfac})}return e})();function $h(e,t,n,r,i,a,o,s){if(n.firstCreatePass){e.mergedAttrs=Qc(e.mergedAttrs,e.attrs);let t=e.tView=Ef(2,e,i,a,o,n.directiveRegistry,n.pipeRegistry,null,n.schemas,n.consts,null);n.queries!==null&&(n.queries.template(n,e),t.queries=n.queries.embeddedTView(e))}s&&(e.flags|=s),Lo(e,!1);let c=rg(n,t,e,r);vs()&&gf(n,t,c,e),Gl(c,t);let l=Mp(c,t,c,e);t[r+27]=l,Nf(t,l),uh(l,e,t)}function eg(e,t,n,r,i,a,o,s,c,l,u){let d=n+27,f;return t.firstCreatePass?(f=Up(t,d,4,o||null,s||null),ko()&&Sm(t,e,f,uo(t.consts,l),Jf),Rc(t,f)):f=t.data[d],$h(f,e,t,n,r,i,a,c),Ya(f)&&Rf(t,e,f),l!=null&&zf(e,f,u),f}function tg(e,t,n,r,i,a,o,s,c,l,u){let d=n+27,f;if(t.firstCreatePass){if(f=Up(t,d,4,o||null,s||null),l!=null){let e=uo(t.consts,l);f.localNames=[];for(let t=0;t<e.length;t+=2)f.localNames.push(e[t],-1)}}else f=t.data[d];return $h(f,e,t,n,r,i,a,c),l!=null&&zf(e,f,u),f}function ng(e,t,n,r,i,a,o,s){let c=D(),l=No();return eg(c,l,e,t,n,r,i,uo(l.consts,a),void 0,o,s),ng}var rg=ig;function ig(e,t,n,r){return ys(!0),t[11].createComment(``)}var ag=new vi(``),og=new vi(``);function sg(){Bn(()=>{throw new T(600,``)})}var cg=10,lg=(()=>{class e{_runningTick=!1;_destroyed=!1;_destroyListeners=[];_views=[];internalErrorHandler=E(Ys);afterRenderManager=E(Nd);zonelessEnabled=E(oc);rootEffectScheduler=E(cc);dirtyFlags=0;tracingSnapshot=null;allTestViews=new Set;autoDetectTestViews=new Set;includeAllTestViews=!1;afterTick=new Zr;get allViews(){return[...(this.includeAllTestViews?this.allTestViews:this.autoDetectTestViews).keys(),...this._views]}get destroyed(){return this._destroyed}componentTypes=[];components=[];internalPendingTask=E(Os);get isStable(){return this.internalPendingTask.hasPendingTasksObservable.pipe(ei(e=>!e))}constructor(){E(Ad,{optional:!0})}whenStable(){let e;return new Promise(t=>{e=this.isStable.subscribe({next:e=>{e&&t()}})}).finally(()=>{e.unsubscribe()})}_injector=E(Aa);_rendererFactory=null;get injector(){return this._injector}bootstrap(e,t){return this.bootstrapImpl(e,t)}bootstrapImpl(e,t,n=Ss.NULL){return this._injector.get(Is).run(()=>{if(Ic(Cc.BootstrapComponentStart),!this._injector.get(Qh).done)throw new T(405,``);let r=Ei(e),i=this._injector.get(Lh),a=new Jm(r,i);this.componentTypes.push(e);let{hostElement:o,directives:s,bindings:c}=ug(t),l=o||a.selector,u=a.create(n,[],l,i.injector,s,c),d=u.location.nativeElement,f=u.injector.get(ag,null);return f?.registerApplication(d),u.onDestroy(()=>{this.detachView(u.hostView),dg(this.components,u),f?.unregisterApplication(d)}),this._loadComponent(u),Ic(Cc.BootstrapComponentEnd,u),u})}tick(){this.zonelessEnabled||(this.dirtyFlags|=1),this._tick()}_tick(){Ic(Cc.ChangeDetectionStart),this.tracingSnapshot===null?this.tickImpl():this.tracingSnapshot.run(kd.CHANGE_DETECTION,this.tickImpl)}tickImpl=()=>{if(this._runningTick)throw Ic(Cc.ChangeDetectionEnd),new T(101,!1);let e=w(null);try{this._runningTick=!0,this.synchronize()}finally{this._runningTick=!1,this.tracingSnapshot?.dispose(),this.tracingSnapshot=null,w(e),this.afterTick.next(),Ic(Cc.ChangeDetectionEnd)}};synchronize(){this._rendererFactory===null&&!this._injector.destroyed&&(this._rendererFactory=this._injector.get(em,null,{optional:!0}));let e=0;for(;this.dirtyFlags!==0&&e++<cg;){Ic(Cc.ChangeDetectionSyncStart);try{this.synchronizeOnce()}finally{Ic(Cc.ChangeDetectionSyncEnd)}}}synchronizeOnce(){this.dirtyFlags&16&&(this.dirtyFlags&=-17,this.rootEffectScheduler.flush());let e=!1;if(this.dirtyFlags&7){let t=!!(this.dirtyFlags&1);this.dirtyFlags&=-8,this.dirtyFlags|=8;for(let{_lView:n}of this.allViews)(t||ho(n))&&(xp(n,t&&!this.zonelessEnabled?0:1),e=!0);if(this.dirtyFlags&=-5,this.syncDirtyFlagsWithViews(),this.dirtyFlags&23)return}e||(this._rendererFactory?.begin?.(),this._rendererFactory?.end?.()),this.dirtyFlags&8&&(this.dirtyFlags&=-9,this.afterRenderManager.execute()),this.syncDirtyFlagsWithViews()}syncDirtyFlagsWithViews(){if(this.allViews.some(({_lView:e})=>ho(e))){this.dirtyFlags|=2;return}this.dirtyFlags&=-8}attachView(e){let t=e;this._views.push(t),t.attachToAppRef(this)}detachView(e){let t=e;dg(this._views,t),t.detachFromAppRef()}_loadComponent(e){this.attachView(e.hostView);try{this.tick()}catch(e){this.internalErrorHandler(e)}this.components.push(e),this._injector.get(og,[]).forEach(t=>t(e))}ngOnDestroy(){if(!this._destroyed)try{this._destroyListeners.forEach(e=>e()),this._views.slice().forEach(e=>e.destroy())}finally{this._destroyed=!0,this._views=[],this._destroyListeners=[]}}onDestroy(e){return this._destroyListeners.push(e),()=>dg(this._destroyListeners,e)}destroy(){if(this._destroyed)throw new T(406,!1);let e=this._injector;e.destroy&&!e.destroyed&&e.destroy()}get viewCount(){return this._views.length}static ɵfac=function(t){return new(t||e)};static ɵprov=Al({token:e,factory:e.ɵfac})}return e})();function ug(e){return e===void 0||typeof e==`string`||e instanceof Element?{hostElement:e}:e}function dg(e,t){let n=e.indexOf(t);n>-1&&e.splice(n,1)}function M(e,t,n,r){let i=D();return sm(i,Ko(),t)&&(No(),Yf(fs(),i,e,t,n,r)),M}function fg(e){if(Md(`NgAnimateEnter`),!pd)return fg;let t=D();if(md(t))return fg;let n=Po(),r=t[9].get(Is);return Od(wd(t),n,()=>pg(t,n,e,r)),Gd(t[9]),Kd(t[9],wd(t)),fg}function pg(e,t,n,r){let i=ro(t,e),a=e[11],o=Td(n),s=[],c=!1,l=e=>{if(Ed(e)!==i)return;let t=e instanceof AnimationEvent?`animationend`:`transitionend`;r.runOutsideAngular(()=>{a.listen(i,t,u)})},u=e=>{Ed(e)===i&&(Dd(e,i)&&(c=!0),mg(e,i,a))};if(o&&o.length>0){r.runOutsideAngular(()=>{s.push(a.listen(i,`animationstart`,l)),s.push(a.listen(i,`transitionstart`,l))}),hd(i,o,s);for(let e of o)a.addClass(i,e);r.runOutsideAngular(()=>{requestAnimationFrame(()=>{if(!c&&(cd(i,vd,pd),!vd.has(i))){for(let e of o)a.removeClass(i,e);gd(i)}})})}}function mg(e,t,n){let r=_d.get(t);if(Ed(e)===t&&r&&Dd(e,t)){e.stopPropagation();for(let e of r.classList)n.removeClass(t,e);gd(t)}}var hg=class{destroy(e){}updateValue(e,t){}swap(e,t){let n=Math.min(e,t),r=Math.max(e,t),i=this.detach(r);if(r-n>1){let e=this.detach(n);this.attach(n,i),this.attach(r,e)}else this.attach(n,i)}move(e,t){this.attach(t,this.detach(e))}};function gg(e,t,n,r,i){return e===n&&Object.is(t,r)?1:Object.is(i(e,t),i(n,r))?-1:0}function _g(e,t,n,r){let i,a,o=0,s=e.length-1;if(Array.isArray(t)){w(r);let c=t.length-1;for(w(null);o<=s&&o<=c;){let r=e.at(o),l=t[o],u=gg(o,r,o,l,n);if(u!==0){u<0&&e.updateValue(o,l),o++;continue}let d=e.at(s),f=t[c],p=gg(s,d,c,f,n);if(p!==0){p<0&&e.updateValue(s,f),s--,c--;continue}let m=n(o,r),h=n(s,d),g=n(o,l);if(Object.is(g,h)){let t=n(c,f);Object.is(t,m)?(e.swap(o,s),e.updateValue(s,f),c--,s--):e.move(s,o),e.updateValue(o,l),o++;continue}if(i??=new xg,a??=bg(e,o,s,n),vg(e,i,o,g))e.updateValue(o,l),o++,s++;else if(a.has(g))i.set(m,e.detach(o)),s--;else{let n=e.create(o,t[o]);e.attach(o,n),o++,s++}}for(;o<=c;)yg(e,i,n,o,t[o]),o++}else if(t!=null){w(r);let c=t[Symbol.iterator]();w(null);let l=c.next();for(;!l.done&&o<=s;){let t=e.at(o),r=l.value,u=gg(o,t,o,r,n);if(u!==0)u<0&&e.updateValue(o,r),o++,l=c.next();else{i??=new xg,a??=bg(e,o,s,n);let u=n(o,r);if(vg(e,i,o,u))e.updateValue(o,r),o++,s++,l=c.next();else if(!a.has(u))e.attach(o,e.create(o,r)),o++,s++,l=c.next();else{let r=n(o,t);i.set(r,e.detach(o)),s--}}}for(;!l.done;)yg(e,i,n,e.length,l.value),l=c.next()}for(;o<=s;)e.destroy(e.detach(s--));i?.forEach(t=>{e.destroy(t)})}function vg(e,t,n,r){return t!==void 0&&t.has(r)?(e.attach(n,t.get(r)),t.delete(r),!0):!1}function yg(e,t,n,r,i){if(vg(e,t,r,n(r,i)))e.updateValue(r,i);else{let t=e.create(r,i);e.attach(r,t)}}function bg(e,t,n,r){let i=new Set;for(let a=t;a<=n;a++)i.add(r(a,e.at(a)));return i}var xg=class{kvMap=new Map;_vMap=void 0;has(e){return this.kvMap.has(e)}delete(e){if(!this.has(e))return!1;let t=this.kvMap.get(e);return this._vMap!==void 0&&this._vMap.has(t)?(this.kvMap.set(e,this._vMap.get(t)),this._vMap.delete(t)):this.kvMap.delete(e),!0}get(e){return this.kvMap.get(e)}set(e,t){if(this.kvMap.has(e)){let n=this.kvMap.get(e);this._vMap===void 0&&(this._vMap=new Map);let r=this._vMap;for(;r.has(n);)n=r.get(n);r.set(n,t)}else this.kvMap.set(e,t)}forEach(e){for(let[t,n]of this.kvMap)if(e(n,t),this._vMap!==void 0){let r=this._vMap;for(;r.has(n);)n=r.get(n),e(n,t)}}};function N(e,t,n,r,i,a,o,s){Md(`NgControlFlow`);let c=D(),l=No();return tg(c,l,e,t,n,r,i,uo(l.consts,a),256,o,s),Sg}function Sg(e,t,n,r,i,a,o,s){Md(`NgControlFlow`);let c=D(),l=No();return tg(c,l,e,t,n,r,i,uo(l.consts,a),512,o,s),Sg}function P(e,t){Md(`NgControlFlow`);let n=D(),r=Ko(),i=n[r]===Yu?-1:n[r],a=i===-1?void 0:Og(n,27+i);if(sm(n,r,e)){let r=w(null);try{if(a!==void 0&&Fp(a,0),e!==-1){let r=27+e,i=Og(n,r),a=Ng(n[1],r),o=Qp(i,a,n);Pp(i,op(n,a,t,{dehydratedView:o}),0,sp(a,o))}}finally{w(r)}}else if(a!==void 0){let e=Np(a,0);e!==void 0&&(e[8]=t)}}var Cg=class{lContainer;$implicit;$index;constructor(e,t,n){this.lContainer=e,this.$implicit=t,this.$index=n}get $count(){return this.lContainer.length-10}};function wg(e){return e}function Tg(e,t){return t}var Eg=class{hasEmptyBlock;trackByFn;liveCollection;constructor(e,t,n){this.hasEmptyBlock=e,this.trackByFn=t,this.liveCollection=n}};function F(e,t,n,r,i,a,o,s,c,l,u,d,f){Md(`NgControlFlow`);let p=D(),m=No(),h=c!==void 0,g=D(),_=new Eg(h,s?o.bind(g[15][8]):o);g[27+e]=_,tg(p,m,e+1,t,n,r,i,uo(m.consts,a),256),h&&tg(p,m,e+2,c,l,u,d,uo(m.consts,f),512)}var Dg=class extends hg{lContainer;hostLView;templateTNode;operationsCounter=void 0;needsIndexUpdate=!1;constructor(e,t,n){super(),this.lContainer=e,this.hostLView=t,this.templateTNode=n}get length(){return this.lContainer.length-10}at(e){return this.getLView(e)[8].$implicit}attach(e,t){let n=t[6];this.needsIndexUpdate||=e!==this.length,Pp(this.lContainer,t,e,sp(this.templateTNode,n)),kg(this.lContainer,e)}detach(e){return this.needsIndexUpdate||=e!==this.length-1,Ag(this.lContainer,e),jg(this.lContainer,e)}create(e,t){let n=Zp(this.lContainer,this.templateTNode.tView.ssrId);return op(this.hostLView,this.templateTNode,new Cg(this.lContainer,t,e),{dehydratedView:n})}destroy(e){sf(e[1],e)}updateValue(e,t){this.getLView(e)[8].$implicit=t}reset(){this.needsIndexUpdate=!1}updateIndexes(){if(this.needsIndexUpdate)for(let e=0;e<this.length;e++)this.getLView(e)[8].$index=e}getLView(e){return Mg(this.lContainer,e)}};function I(e){let t=w(null),n=us();try{let r=D(),i=r[1],a=r[n],o=n+1,s=Og(r,o);a.liveCollection===void 0?a.liveCollection=new Dg(s,r,Ng(i,o)):a.liveCollection.reset();let c=a.liveCollection;if(_g(c,e,a.trackByFn,t),c.updateIndexes(),a.hasEmptyBlock){let e=Ko(),t=c.length===0;if(sm(r,e,t)){let e=n+2,a=Og(r,e);if(t){let t=Ng(i,e),n=Qp(a,t,r);Pp(a,op(r,t,void 0,{dehydratedView:n}),0,sp(t,n))}else i.firstUpdatePass&&qp(a),Fp(a,0)}}}finally{w(t)}}function Og(e,t){return e[t]}function kg(e,t){if(e.length<=10)return;let n=e[10+t],r=n?n[26]:void 0;if(n&&r&&r.detachedLeaveAnimationFns&&r.detachedLeaveAnimationFns.length>0){let e=n[9];Ud(e,r),ud.delete(n[19]),r.detachedLeaveAnimationFns=void 0}}function Ag(e,t){if(e.length<=10)return;let n=e[10+t],r=n?n[26]:void 0;r&&r.leave&&r.leave.size>0&&(r.detachedLeaveAnimationFns=[])}function jg(e,t){return Ip(e,t)}function Mg(e,t){return Np(e,t)}function Ng(e,t){return io(e,t)}function L(e,t,n){let r=D();return sm(r,Ko(),t)&&(No(),Hf(fs(),r,e,t,r[11],n)),L}function Pg(e,t,n,r,i){tp(t,e,n,i?`class`:`style`,r)}function R(e,t,n,r){let i=D(),a=i[1],o=e+27,s=a.firstCreatePass?Im(o,i,2,t,Jf,ko(),n,r):a.data[o];if(Ja(s)){let n=i[10].tracingService;if(n&&n.componentCreate){let o=a.data[s.directiveStart+s.componentOffset];return n.componentCreate(nm(o),()=>(Fg(e,t,i,s,r),R))}}return Fg(e,t,i,s,r),R}function Fg(e,t,n,r,i){if(Qf(r,n,e,t,Ig),Ya(r)){let e=n[1];Rf(e,n,r),su(e,r,n)}i!=null&&zf(n,r)}function z(){let e=No(),t=$f(Po());return e.firstCreatePass&&Lm(e,t),jo(t)&&Mo(),Oo(),t.classesWithoutHost!=null&&qc(t)&&Pg(e,t,D(),t.classesWithoutHost,!0),t.stylesWithoutHost!=null&&Jc(t)&&Pg(e,t,D(),t.stylesWithoutHost,!1),z}function B(e,t,n,r){return R(e,t,n,r),z(),B}function V(e,t,n,r){let i=D(),a=i[1],o=e+27,s=a.firstCreatePass?Rm(o,a,2,t,n,r):a.data[o];return Qf(s,i,e,t,Ig),r!=null&&zf(i,s),V}function H(){return jo($f(Po()))&&Mo(),Oo(),H}function U(e,t,n,r){return V(e,t,n,r),H(),U}var Ig=(e,t,n,r,i)=>(ys(!0),Su(t[11],r,gs()));function Lg(e,t,n){let r=D(),i=r[1],a=e+27,o=i.firstCreatePass?Im(a,r,8,`ng-container`,Jf,ko(),t,n):i.data[a];if(Qf(o,r,e,`ng-container`,Bg),Ya(o)){let e=r[1];Rf(e,r,o),su(e,o,r)}return n!=null&&zf(r,o),Lg}function Rg(){let e=No(),t=$f(Po());return e.firstCreatePass&&Lm(e,t),Rg}function zg(e,t,n){return Lg(e,t,n),Rg(),zg}var Bg=(e,t,n,r,i)=>(ys(!0),xu(t[11],``));function W(){return D()}function Vg(e,t,n){let r=D();return sm(r,Ko(),t)&&(No(),Uf(fs(),r,e,t,r[11],n)),Vg}var Hg=void 0;function Ug(e){let t=Math.floor(Math.abs(e)),n=e.toString().replace(/^[^.]*\.?/,``).length;return t===1&&n===0?1:5}var Wg=[`en`,[[`a`,`p`],[`AM`,`PM`]],[[`AM`,`PM`]],[[`S`,`M`,`T`,`W`,`T`,`F`,`S`],[`Sun`,`Mon`,`Tue`,`Wed`,`Thu`,`Fri`,`Sat`],[`Sunday`,`Monday`,`Tuesday`,`Wednesday`,`Thursday`,`Friday`,`Saturday`],[`Su`,`Mo`,`Tu`,`We`,`Th`,`Fr`,`Sa`]],Hg,[[`J`,`F`,`M`,`A`,`M`,`J`,`J`,`A`,`S`,`O`,`N`,`D`],[`Jan`,`Feb`,`Mar`,`Apr`,`May`,`Jun`,`Jul`,`Aug`,`Sep`,`Oct`,`Nov`,`Dec`],[`January`,`February`,`March`,`April`,`May`,`June`,`July`,`August`,`September`,`October`,`November`,`December`]],Hg,[[`B`,`A`],[`BC`,`AD`],[`Before Christ`,`Anno Domini`]],0,[6,0],[`M/d/yy`,`MMM d, y`,`MMMM d, y`,`EEEE, MMMM d, y`],[`h:mm a`,`h:mm:ss a`,`h:mm:ss a z`,`h:mm:ss a zzzz`],[`{1}, {0}`,Hg,Hg,Hg],[`.`,`,`,`;`,`%`,`+`,`-`,`E`,`×`,`‰`,`∞`,`NaN`,`:`],[`#,##0.###`,`#,##0%`,`¤#,##0.00`,`#E0`],`USD`,`$`,`US Dollar`,{},`ltr`,Ug],Gg=Object.create(null);function Kg(e){let t=Yg(e),n=qg(t);if(n)return n;let r=t.split(`-`)[0];if(n=qg(r),n)return n;if(r===`en`)return Wg;throw new T(701,!1)}function qg(e){if(!(e in Gg)){let t=Hi.ng&&Hi.ng.common&&Hi.ng.common.locales&&Hi.ng.common.locales[e];return t!==void 0&&(Gg[e]=t),t}return Gg[e]}var Jg={LocaleId:0,DayPeriodsFormat:1,DayPeriodsStandalone:2,DaysFormat:3,DaysStandalone:4,MonthsFormat:5,MonthsStandalone:6,Eras:7,FirstDayOfWeek:8,WeekendRange:9,DateFormat:10,TimeFormat:11,DateTimeFormat:12,NumberSymbols:13,NumberFormats:14,CurrencyCode:15,CurrencySymbol:16,CurrencyName:17,Currencies:18,Directionality:19,PluralCase:20,ExtraData:21};function Yg(e){return e.toLowerCase().replace(/_/g,`-`)}var Xg=`en-US`;function Zg(e){typeof e==`string`&&e.toLowerCase().replace(/_/g,`-`)}function G(e,t,n){let r=D(),i=No(),a=Po();return $g(i,r,r[11],a,e,t,n),G}function Qg(e,t,n){let r=D(),i=No(),a=Po();return(a.type&3||n)&&pm(a,i,r,n,r[11],e,t,dm(a,r,t)),Qg}function $g(e,t,n,r,i,a,o){let s=!0,c=null;if((r.type&3||o)&&(c??=dm(r,t,a),pm(r,e,t,o,n,i,a,c)&&(s=!1)),s){let e=r.outputs?.[i],n=r.hostDirectiveOutputs?.[i];if(n&&n.length)for(let e=0;e<n.length;e+=2){let o=n[e],s=n[e+1];c??=dm(r,t,a),_m(r,t,o,s,i,c)}if(e&&e.length)for(let n of e)c??=dm(r,t,a),_m(r,t,n,i,i,c)}}function K(e=1){return ls(e)}function e_(e,t,n,r){return Nh(e,Th(t,n,r)),e_}function t_(e=1){es($o()+e)}function n_(e){return ao(Bo(),27+e)}function r_(e,t){return e<<17|t<<2}function i_(e){return e>>17&32767}function a_(e){return(e&2)==2}function o_(e,t){return e&131071|t<<17}function s_(e){return e|2}function c_(e){return(e&131068)>>2}function l_(e,t){return e&-131069|t<<2}function u_(e){return(e&1)==1}function d_(e){return e|1}function f_(e,t,n,r,i,a){let o=a?t.classBindings:t.styleBindings,s=i_(o),c=c_(o);e[r]=n;let l=!1,u;if(Array.isArray(n)){let e=n;u=e[1],(u===null||sa(e,u)>0)&&(l=!0)}else u=n;if(i){if(c!==0){let t=i_(e[s+1]);e[r+1]=r_(t,s),t!==0&&(e[t+1]=l_(e[t+1],r)),e[s+1]=o_(e[s+1],r)}else e[r+1]=r_(s,0),s!==0&&(e[s+1]=l_(e[s+1],r)),s=r}else e[r+1]=r_(c,0),s===0?s=r:e[c+1]=l_(e[c+1],r),c=r;l&&(e[r+1]=s_(e[r+1])),m_(e,u,r,!0),m_(e,u,r,!1),p_(t,u,e,r,a),o=r_(s,c),a?t.classBindings=o:t.styleBindings=o}function p_(e,t,n,r,i){let a=i?e.residualClasses:e.residualStyles;a!=null&&typeof t==`string`&&sa(a,t)>=0&&(n[r+1]=d_(n[r+1]))}function m_(e,t,n,r){let i=e[n+1],a=t===null,o=r?i_(i):c_(i),s=!1;for(;o!==0&&(s===!1||a);){let n=e[o],i=e[o+1];h_(n,t)&&(s=!0,e[o+1]=r?d_(i):s_(i)),o=r?i_(i):c_(i)}s&&(e[n+1]=r?s_(i):d_(i))}function h_(e,t){return e===null||t==null||(Array.isArray(e)?e[1]:e)===t?!0:Array.isArray(e)&&typeof t==`string`?sa(e,t)>=0:!1}var g_={textEnd:0,key:0,keyEnd:0,value:0,valueEnd:0};function __(e){return e.substring(g_.key,g_.keyEnd)}function v_(e){return b_(e),y_(e,x_(e,0,g_.textEnd))}function y_(e,t){let n=g_.textEnd;return n===t?-1:(t=g_.keyEnd=S_(e,g_.key=t,n),x_(e,t,n))}function b_(e){g_.key=0,g_.keyEnd=0,g_.value=0,g_.valueEnd=0,g_.textEnd=e.length}function x_(e,t,n){for(;t<n&&e.charCodeAt(t)<=32;)t++;return t}function S_(e,t,n){for(;t<n&&e.charCodeAt(t)>32;)t++;return t}function C_(e,t,n){return E_(e,t,n,!1),C_}function q(e,t){return E_(e,t,null,!0),q}function w_(e){D_(L_,T_,e,!0)}function T_(e,t){for(let n=v_(t);n>=0;n=y_(t,n))aa(e,__(t),!0)}function E_(e,t,n,r){let i=D(),a=No(),o=qo(2);if(a.firstUpdatePass&&k_(a,e,o,r),t!==Yu&&sm(i,o,t)){let s=a.data[us()];z_(a,s,i,i[11],e,i[o+1]=H_(t,n),r,o)}}function D_(e,t,n,r){let i=No(),a=qo(2);i.firstUpdatePass&&k_(i,null,a,r);let o=D();if(n!==Yu&&sm(o,a,n)){let s=i.data[us()];if(U_(s,r)&&!O_(i,a)){let e=r?s.classesWithoutHost:s.stylesWithoutHost;e!==null&&(n=oi(e,n||``)),Pg(i,s,o,n,r)}else R_(i,s,o,o[11],o[a+1],o[a+1]=I_(e,t,n),r,a)}}function O_(e,t){return t>=e.expandoStartIndex}function k_(e,t,n,r){let i=e.data;if(i[n+1]===null){let a=i[us()],o=O_(e,n);U_(a,r)&&t===null&&!o&&(t=!1),t=A_(i,a,t,r),f_(i,a,t,n,o,r)}}function A_(e,t,n,r){let i=Qo(e),a=r?t.residualClasses:t.residualStyles;if(i===null)(r?t.classBindings:t.styleBindings)===0&&(n=P_(null,e,t,n,r),n=F_(n,t.attrs,r),a=null);else{let o=t.directiveStylingLast;if(o===-1||e[o]!==i){if(n=P_(i,e,t,n,r),a===null){let n=j_(e,t,r);n!==void 0&&Array.isArray(n)&&(n=P_(null,e,t,n[1],r),n=F_(n,t.attrs,r),M_(e,t,r,n))}else a=N_(e,t,r)}}return a!==void 0&&(r?t.residualClasses=a:t.residualStyles=a),n}function j_(e,t,n){let r=n?t.classBindings:t.styleBindings;if(c_(r)!==0)return e[i_(r)]}function M_(e,t,n,r){let i=n?t.classBindings:t.styleBindings;e[i_(i)]=r}function N_(e,t,n){let r,i=t.directiveEnd;for(let a=1+t.directiveStylingLast;a<i;a++){let t=e[a].hostAttrs;r=F_(r,t,n)}return F_(r,t.attrs,n)}function P_(e,t,n,r,i){let a=null,o=n.directiveEnd,s=n.directiveStylingLast;for(s===-1?s=n.directiveStart:s++;s<o&&(a=t[s],r=F_(r,a.hostAttrs,i),a!==e);)s++;return e!==null&&(n.directiveStylingLast=s),r}function F_(e,t,n){let r=n?1:2,i=-1;if(t!==null)for(let a=0;a<t.length;a++){let o=t[a];typeof o==`number`?i=o:i===r&&(Array.isArray(e)||(e=e===void 0?[]:[``,e]),aa(e,o,n?!0:t[++a]))}return e===void 0?null:e}function I_(e,t,n){if(n==null||n===``)return ua;let r=[],i=uu(n);if(Array.isArray(i))for(let t=0;t<i.length;t++)e(r,i[t],!0);else if(i instanceof Set)for(let t of i)e(r,t,!0);else if(typeof i==`object`)for(let t in i)Object.hasOwn(i,t)&&e(r,t,i[t]);else typeof i==`string`&&t(r,i);return r}function L_(e,t,n){let r=String(t);r!==``&&!r.includes(` `)&&aa(e,r,n)}function R_(e,t,n,r,i,a,o,s){i===Yu&&(i=ua);let c=0,l=0,u=0<i.length?i[0]:null,d=0<a.length?a[0]:null;for(;u!==null||d!==null;){let f=c<i.length?i[c+1]:void 0,p=l<a.length?a[l+1]:void 0,m=null,h;u===d?(c+=2,l+=2,f!==p&&(m=d,h=p)):d===null||u!==null&&u<d?(c+=2,m=u):(l+=2,m=d,h=p),m!==null&&z_(e,t,n,r,m,h,o,s),u=c<i.length?i[c]:null,d=l<a.length?a[l]:null}}function z_(e,t,n,r,i,a,o,s){if(!(t.type&3))return;let c=e.data,l=c[s+1];V_(u_(l)?B_(c,t,n,i,c_(l),o):void 0)||(V_(a)||a_(l)&&(a=B_(c,null,n,i,s,o)),Tf(r,o,no(us(),n),i,a))}function B_(e,t,n,r,i,a){let o=t===null,s;for(;i>0;){let t=e[i],a=Array.isArray(t),c=a?t[1]:t,l=c===null,u=n[i+1];u===Yu&&(u=l?ua:void 0);let d=l?oa(u,r):c===r?u:void 0;if(a&&!V_(d)&&(d=oa(t,r)),V_(d)&&(s=d,o))return s;let f=e[i+1];i=o?i_(f):c_(f)}if(t!==null){let e=a?t.residualClasses:t.residualStyles;e!=null&&(s=oa(e,r))}return s}function V_(e){return e!==void 0}function H_(e,t){return e==null||e===``||(typeof t==`string`?e=uu(e)+t:typeof e==`object`&&(e=ai(uu(e)))),e}function U_(e,t){return!!(e.flags&(t?8:16))}function J(e,t=``){let n=D(),r=No(),i=e+27,a=r.firstCreatePass?Up(r,i,1,t,null):r.data[i],o=W_(r,n,a,t);n[i]=o,vs()&&gf(r,n,o,a),Lo(a,!1)}var W_=(e,t,n,r)=>(ys(!0),yu(t[11],r));function G_(e,t,n,r=``){return sm(e,Ko(),n)?t+Ai(n)+r:Yu}function K_(e,t,n,r,i,a=``){let o=cm(e,Wo(),n,i);return qo(2),o?t+Ai(n)+r+Ai(i)+a:Yu}function q_(e,t,n,r,i,a,o,s=``){let c=lm(e,Wo(),n,i,o);return qo(3),c?t+Ai(n)+r+Ai(i)+a+Ai(o)+s:Yu}function J_(e,t,n,r,i,a,o,s,c,l=``){let u=um(e,Wo(),n,i,o,c);return qo(4),u?t+Ai(n)+r+Ai(i)+a+Ai(o)+s+Ai(c)+l:Yu}function Y(e){return X(``,e),Y}function X(e,t,n){let r=D(),i=G_(r,e,t,n);return i!==Yu&&Z_(r,us(),i),X}function Z(e,t,n,r,i){let a=D(),o=K_(a,e,t,n,r,i);return o!==Yu&&Z_(a,us(),o),Z}function Y_(e,t,n,r,i,a,o){let s=D(),c=q_(s,e,t,n,r,i,a,o);return c!==Yu&&Z_(s,us(),c),Y_}function X_(e,t,n,r,i,a,o,s,c){let l=D(),u=J_(l,e,t,n,r,i,a,o,s,c);return u!==Yu&&Z_(l,us(),u),X_}function Z_(e,t,n){let r=no(t,e);bu(e[11],r,n)}function Q_(e,t,n){yc(t)&&(t=t());let r=D();return sm(r,Ko(),t)&&(No(),Hf(fs(),r,e,t,r[11],n)),Q_}function $_(e,t){let n=yc(e);return n&&e.set(t),n}function ev(e,t){let n=D(),r=No(),i=Po();return $g(r,n,n[11],i,e,t),ev}var tv={};function nv(e){Md(`NgLet`);let t=No(),n=D(),r=e+27;return Lo(Up(t,r,128,null,null),!1),oo(t,n,r,tv),nv}function rv(e){return oo(No(),D(),us(),e),e}function iv(e){let t=ao(Bo(),27+e);if(t===tv)throw new T(314,!1);return t}function av(e,t,n=``){return G_(D(),e,t,n)}function ov(e,t){let n=Uo()+e,r=D();return r[n]===Yu?am(r,n,t()):om(r,n)}function sv(e,t,n){return lv(D(),Uo(),e,t,n)}function cv(e,t){let n=e[t];return n===Yu?void 0:n}function lv(e,t,n,r,i,a){let o=t+n;return sm(e,o,i)?am(e,o+1,a?r.call(a,i):r(i)):cv(e,o+1)}function uv(e,t,n,r,i,a,o){let s=t+n;return cm(e,s,i,a)?am(e,s+2,o?r.call(o,i,a):r(i,a)):cv(e,s+2)}function dv(e,t){let n=No(),r,i=e+27;n.firstCreatePass?(r=fv(t,n.pipeRegistry),n.data[i]=r,r.onDestroy&&(n.destroyHooks??=[]).push(i,r.onDestroy)):r=n.data[i];let a=r.factory||(r.factory=Qi(r.type,!0)),o=Bi(xm);try{let e=al(!1),t=a();return al(e),oo(n,D(),i,t),t}finally{Bi(o)}}function fv(e,t){if(t)for(let n=t.length-1;n>=0;n--){let r=t[n];if(e===r.name)return r}}function pv(e,t,n){let r=e+27,i=D(),a=ao(i,r);return hv(i,r)?lv(i,Uo(),t,a.transform,n,a):a.transform(n)}function mv(e,t,n,r){let i=e+27,a=D(),o=ao(a,i);return hv(a,i)?uv(a,Uo(),t,o.transform,n,r,o):o.transform(n,r)}function hv(e,t){return e[1].data[t].pure}function gv(e,t){return Hp(e,t)}var _v=(()=>{class e{applicationErrorHandler=E(Ys);appRef=E(lg);taskService=E(Os);ngZone=E(Is);zonelessEnabled=E(oc);tracing=E(Ad,{optional:!0});zoneIsDefined=typeof Zone<`u`&&!!Zone.root.run;schedulerTickApplyArgs=[{data:{__scheduler_tick__:!0}}];subscriptions=new hr;angularZoneId=this.zoneIsDefined?this.ngZone._inner?.get(Ps):null;scheduleInRootZone=!this.zonelessEnabled&&this.zoneIsDefined&&(E(sc,{optional:!0})??!1);cancelScheduledCallback=null;useMicrotaskScheduler=!1;runningTick=!1;pendingRenderTaskId=null;constructor(){this.subscriptions.add(this.appRef.afterTick.subscribe(()=>{let e=this.taskService.add();if(!this.runningTick&&(this.cleanup(),!this.zonelessEnabled||this.appRef.includeAllTestViews)){this.taskService.remove(e);return}this.switchToMicrotaskScheduler(),this.taskService.remove(e)})),this.subscriptions.add(this.ngZone.onUnstable.subscribe(()=>{this.runningTick||this.cleanup()}))}switchToMicrotaskScheduler(){this.ngZone.runOutsideAngular(()=>{let e=this.taskService.add();this.useMicrotaskScheduler=!0,queueMicrotask(()=>{this.useMicrotaskScheduler=!1,this.taskService.remove(e)})})}notify(e){if(!this.zonelessEnabled&&e===5)return;switch(e){case 0:case 2:this.appRef.dirtyFlags|=2;break;case 3:case 4:case 5:case 1:this.appRef.dirtyFlags|=4;break;case 6:this.appRef.dirtyFlags|=2;break;case 12:this.appRef.dirtyFlags|=16;break;case 13:this.appRef.dirtyFlags|=2;break;case 11:break;default:this.appRef.dirtyFlags|=8}if(this.appRef.tracingSnapshot=this.tracing?.snapshot(this.appRef.tracingSnapshot)??null,!this.shouldScheduleTick())return;let t=this.useMicrotaskScheduler?Ms:js;this.pendingRenderTaskId=this.taskService.add(),this.cancelScheduledCallback=this.scheduleInRootZone?Zone.root.run(()=>t(()=>this.tick())):this.ngZone.runOutsideAngular(()=>t(()=>this.tick()))}shouldScheduleTick(){return!(this.appRef.destroyed||this.pendingRenderTaskId!==null||this.runningTick||this.appRef._runningTick||!this.zonelessEnabled&&this.zoneIsDefined&&Zone.current.get(`isAngularZone_ID`+this.angularZoneId))}tick(){if(this.runningTick||this.appRef.destroyed)return;if(this.appRef.dirtyFlags===0){this.cleanup();return}!this.zonelessEnabled&&this.appRef.dirtyFlags&7&&(this.appRef.dirtyFlags|=1);let e=this.taskService.add();try{this.ngZone.run(()=>{this.runningTick=!0,this.appRef._tick()},void 0,this.schedulerTickApplyArgs)}catch(e){this.applicationErrorHandler(e)}finally{this.taskService.remove(e),this.cleanup()}}ngOnDestroy(){this.subscriptions.unsubscribe(),this.cleanup()}cleanup(){if(this.runningTick=!1,this.cancelScheduledCallback?.(),this.cancelScheduledCallback=null,this.pendingRenderTaskId!==null){let e=this.pendingRenderTaskId;this.pendingRenderTaskId=null,this.taskService.remove(e)}}static ɵfac=function(t){return new(t||e)};static ɵprov=Al({token:e,factory:e.ɵfac})}return e})();function vv(){return[{provide:ac,useExisting:_v},{provide:Is,useClass:Ws},{provide:oc,useValue:!0}]}function yv(){return typeof $localize<`u`&&$localize.locale||`en-US`}var bv=new vi(``,{factory:()=>E(bv,{optional:!0,skipSelf:!0})||yv()}),xv=class{destroyed=!1;listeners=null;errorHandler=E(Js,{optional:!0});isEmitting=!1;hasNullListeners=!1;destroyRef=E(ws);constructor(){this.destroyRef.onDestroy(()=>{this.destroyed=!0,this.listeners=null})}subscribe(e){if(this.destroyed)throw new T(953,!1);return(this.listeners??=[]).push(e),{unsubscribe:()=>{let t=this.listeners?this.listeners.indexOf(e):-1;t>-1&&(this.isEmitting?(this.hasNullListeners=!0,this.listeners[t]=null):this.listeners.splice(t,1))}}}emit(e){if(this.destroyed){console.warn(ri(953,!1));return}if(this.listeners===null)return;this.isEmitting=!0;let t=w(null);try{for(let t of this.listeners)try{t!==null&&t(e)}catch(e){this.errorHandler?.handleError(e)}}finally{this.hasNullListeners&&(this.hasNullListeners=!1,this.listeners&&Sv(this.listeners)),w(t),this.isEmitting=!1}}};function Sv(e){let t=e.length-1;for(;t>-1;)e[t]===null&&e.splice(t,1),t--}function Q(e,t){return Mn(e,t?.equal)}function Cv(e){return ar(e)}(class e extends Error{_brand;constructor(e){super(e)}static IDLE=new e(`IDLE`);static LOADING=new e(`LOADING`)});var wv=e=>e;function Tv(e,t){return typeof e==`function`?Ev(tr(e,wv,t?.equal),t?.debugName,t?.set):Ev(tr(e.source,e.computation,e.equal),e.debugName,e.set)}function Ev(e,t,n){let r=e[dn],i=e;if(n!==void 0){let t=e=>nr(r,e);i.set=e=>n(e,t),i.update=r=>n(r(Cv(e)),t)}else i.set=e=>nr(r,e),i.update=e=>rr(r,e);return i.asReadonly=Zs.bind(e),i}function Dv(e,t){let n=Object.create(xc);n.value=e,n.transformFn=t?.transform;function r(){if(mn(n),n.value===bc)throw new T(-950,null);return n.value}return r[dn]=n,r}function Ov(e){return new xv}function kv(e,t){return Dv(e,t)}function Av(e){return Dv(bc,e)}var $=(kv.required=Av,kv);function jv(e,t){let n=Object.create(xc),r=new xv;n.value=e;function i(){return mn(n),Mv(n.value),n.value}return i[dn]=n,i.asReadonly=Zs.bind(i),i.set=e=>{n.equal(n.value,e)||(Wn(n,e),r.emit(e))},i.update=e=>{Mv(n.value),i.set(e(n.value))},i.subscribe=r.subscribe.bind(r),i.destroyRef=r.destroyRef,i}function Mv(e){if(e===bc)throw new T(952,!1)}function Nv(e,t){return jv(e,t)}function Pv(e){return jv(bc,e)}var Fv=(Nv.required=Pv,Nv);function Iv(e,t){return jh(t)}function Lv(e,t){return Mh(t)}var Rv=(Iv.required=Lv,Iv),zv=new vi(``),Bv=new vi(``);function Vv(e){return!e.moduleRef}function Hv(e){let t=Vv(e)?e.r3Injector:e.moduleRef.injector,n=t.get(Is);return n.run(()=>{Vv(e)?e.r3Injector.resolveInjectorInitializers():e.moduleRef.resolveInjectorInitializers();let r=t.get(Ys),i;if(n.runOutsideAngular(()=>{i=n.onError.subscribe({next:r})}),Vv(e)){let n=()=>t.destroy(),r=e.platformInjector.get(zv);r.add(n),t.onDestroy(()=>{i.unsubscribe(),r.delete(n)})}else{let t=()=>e.moduleRef.destroy(),n=e.platformInjector.get(zv);n.add(t),e.moduleRef.onDestroy(()=>{dg(e.allPlatformModules,e.moduleRef),i.unsubscribe(),n.delete(t)})}return Wv(r,n,()=>{let n=t.get(Os),r=n.add(),i=t.get(Qh);return i.runInitializers(),i.donePromise.then(()=>{if(Zg(t.get(bv,Xg)||`en-US`),!t.get(Bv,!0))return Vv(e)?t.get(lg):(e.allPlatformModules.push(e.moduleRef),e.moduleRef);if(Vv(e)){let n=t.get(lg);return e.rootComponent!==void 0&&n.bootstrap(e.rootComponent),n}return Uv?.(e.moduleRef,e.allPlatformModules),e.moduleRef}).finally(()=>void n.remove(r))})})}var Uv;function Wv(e,t,n){try{let r=n();return Fh(r)?r.catch(n=>{throw t.runOutsideAngular(()=>e(n)),n}):r}catch(n){throw t.runOutsideAngular(()=>e(n)),n}}var Gv=null;function Kv(e=[],t){return Ss.create({name:t,providers:[{provide:Ta,useValue:`platform`},{provide:zv,useValue:new Set([()=>Gv=null])},...e]})}function qv(e=[]){if(Gv)return Gv;let t=Kv(e);return Gv=t,sg(),Jv(t),t}function Jv(e){let t=e.get(ec,null);Ha(e,()=>{t?.forEach(e=>e())})}function Yv(e){let{rootComponent:t,appProviders:n,platformProviders:r,platformRef:i}=e;Ic(Cc.BootstrapApplicationStart);try{let e=i?.injector??qv(r);return Hv({r3Injector:new Rh({providers:[vv(),Xs,...n||[]],parent:e,debugName:``,runEnvironmentInitializers:!1}).injector,platformInjector:e,rootComponent:t})}catch(e){return Promise.reject(e)}finally{Ic(Cc.BootstrapApplicationEnd)}}var Xv=Symbol(`NOT_SET`),Zv=new Set,Qv={...Kn,kind:`afterRenderEffectPhase`,consumerIsAlwaysLive:!0,consumerAllowSignalWrites:!0,value:Xv,cleanup:null,consumerMarkedDirty(){if(this.sequence.impl.executing){if(this.sequence.lastPhase===null||this.sequence.lastPhase<this.phase)return;this.sequence.erroredOrDestroyed=!0}this.sequence.scheduler.notify(7)},phaseFn(e){if(this.sequence.lastPhase=this.phase,!this.dirty||(this.dirty=!1,this.value!==Xv&&!Tn(this)))return this.signal;try{for(let e of this.cleanup??Zv)e()}finally{this.cleanup?.clear()}let t=[];e!==void 0&&t.push(e),t.push(this.registerCleanupFn);let n=xn(this),r;try{r=this.userFn.apply(null,t)}finally{Cn(this,n)}return(this.value===Xv||!this.equal(this.value,r))&&(this.value=r,this.version++),this.signal}},$v=class extends Id{scheduler;lastPhase=null;nodes=[void 0,void 0,void 0,void 0];onDestroyFns=null;constructor(e,t,n,r,i,a=null){super(e,[void 0,void 0,void 0,void 0],n,!1,i.get(ws),a),this.scheduler=r;for(let e of Pd){let n=t[e];if(n===void 0)continue;let r=Object.create(Qv);r.sequence=this,r.phase=e,r.userFn=n,r.dirty=!0,r.signal=()=>(mn(r),r.value),r.signal[dn]=r,r.registerCleanupFn=e=>(r.cleanup??=new Set).add(e),this.nodes[e]=r,this.hooks[e]=e=>r.phaseFn(e)}}afterRun(){super.afterRun(),this.lastPhase=null}destroy(){if(this.onDestroyFns!==null)for(let e of this.onDestroyFns)e();super.destroy();for(let e of this.nodes)if(e)try{for(let t of e.cleanup??Zv)t()}finally{En(e)}}};function ey(e,t){let n=t?.injector??E(Ss),r=n.get(ac),i=n.get(Nd),a=n.get(Ad,null,{optional:!0});i.impl??=n.get(Fd);let o=e;typeof o==`function`&&(o={mixedReadWrite:e});let s=n.get(rc,null,{optional:!0}),c=new $v(i.impl,[o.earlyRead,o.write,o.mixedReadWrite,o.read],s?.view,r,n,a?.snapshot(null));return i.impl.register(c),c}var ty=null;function ny(){return ty}function ry(e){ty??=e}var iy=class{},ay=(function(e){return e[e.Format=0]=`Format`,e[e.Standalone=1]=`Standalone`,e})(ay||{}),oy=(function(e){return e[e.Narrow=0]=`Narrow`,e[e.Abbreviated=1]=`Abbreviated`,e[e.Wide=2]=`Wide`,e[e.Short=3]=`Short`,e})(oy||{}),sy=(function(e){return e[e.Short=0]=`Short`,e[e.Medium=1]=`Medium`,e[e.Long=2]=`Long`,e[e.Full=3]=`Full`,e})(sy||{}),cy={Decimal:0,Group:1,List:2,PercentSign:3,PlusSign:4,MinusSign:5,Exponential:6,SuperscriptingExponent:7,PerMille:8,Infinity:9,NaN:10,TimeSeparator:11,CurrencyDecimal:12,CurrencyGroup:13};function ly(e){return Kg(e)[Jg.LocaleId]}function uy(e,t,n){let r=Kg(e);return xy(xy([r[Jg.DayPeriodsFormat],r[Jg.DayPeriodsStandalone]],t),n)}function dy(e,t,n){let r=Kg(e);return xy(xy([r[Jg.DaysFormat],r[Jg.DaysStandalone]],t),n)}function fy(e,t,n){let r=Kg(e);return xy(xy([r[Jg.MonthsFormat],r[Jg.MonthsStandalone]],t),n)}function py(e,t){let n=Kg(e)[Jg.Eras];return xy(n,t)}function my(e,t){return xy(Kg(e)[Jg.DateFormat],t)}function hy(e,t){return xy(Kg(e)[Jg.TimeFormat],t)}function gy(e,t){let n=Kg(e)[Jg.DateTimeFormat];return xy(n,t)}function _y(e,t){let n=Kg(e),r=n[Jg.NumberSymbols][t];if(r===void 0){if(t===cy.CurrencyDecimal)return n[Jg.NumberSymbols][cy.Decimal];if(t===cy.CurrencyGroup)return n[Jg.NumberSymbols][cy.Group]}return r}function vy(e){if(!e[Jg.ExtraData])throw new T(2303,!1)}function yy(e){let t=Kg(e);return vy(t),(t[Jg.ExtraData][2]||[]).map(e=>typeof e==`string`?Sy(e):[Sy(e[0]),Sy(e[1])])}function by(e,t,n){let r=Kg(e);return vy(r),xy(xy([r[Jg.ExtraData][0],r[Jg.ExtraData][1]],t)||[],n)||[]}function xy(e,t){for(let n=t;n>-1;n--)if(e[n]!==void 0)return e[n];throw new T(2304,!1)}function Sy(e){let[t,n]=e.split(`:`);return{hours:+t,minutes:+n}}var Cy=/^(\d{4,})-?(\d\d)-?(\d\d)(?:T(\d\d)(?::?(\d\d)(?::?(\d\d)(?:\.(\d+))?)?)?(Z|([+-])(\d\d):?(\d\d))?)?$/,wy=Object.create(null),Ty=/((?:[^BEGHLMOSWYZabcdhmswyz']+)|(?:'(?:[^']|'')*')|(?:G{1,5}|y{1,4}|Y{1,4}|M{1,5}|L{1,5}|w{1,2}|W{1}|d{1,2}|E{1,6}|c{1,6}|a{1,5}|b{1,5}|B{1,5}|h{1,2}|H{1,2}|m{1,2}|s{1,2}|S{1,3}|z{1,4}|Z{1,5}|O{1,4}))([\s\S]*)/,Ey=256;function Dy(e,t,n,r){let i=Xy(e);Oy(t),t=Ay(n,t)||t;let a=[],o;for(;t;)if(o=Ty.exec(t),o){a=a.concat(o.slice(1));let e=a.pop();if(!e)break;t=e}else{a.push(t);break}let s=i.getTimezoneOffset();r&&(s=qy(r,s),i=Yy(i,r));let c=``;return a.forEach(e=>{let t=Ky(e);c+=t?t(i,n,s):e===`''`?`'`:e.replace(/(^'|'$)/g,``).replace(/''/g,`'`)}),c}function Oy(e){if(e.length>Ey)throw new T(2300,!1)}function ky(e,t,n){let r=new Date(0);return r.setFullYear(e,t,n),r.setHours(0,0,0),r}function Ay(e,t){let n=ly(e);if(wy[n]??=Object.create(null),wy[n][t])return wy[n][t];let r=``;switch(t){case`shortDate`:r=my(e,sy.Short);break;case`mediumDate`:r=my(e,sy.Medium);break;case`longDate`:r=my(e,sy.Long);break;case`fullDate`:r=my(e,sy.Full);break;case`shortTime`:r=hy(e,sy.Short);break;case`mediumTime`:r=hy(e,sy.Medium);break;case`longTime`:r=hy(e,sy.Long);break;case`fullTime`:r=hy(e,sy.Full);break;case`short`:let t=Ay(e,`shortTime`),n=Ay(e,`shortDate`);r=jy(gy(e,sy.Short),[t,n]);break;case`medium`:let i=Ay(e,`mediumTime`),a=Ay(e,`mediumDate`);r=jy(gy(e,sy.Medium),[i,a]);break;case`long`:let o=Ay(e,`longTime`),s=Ay(e,`longDate`);r=jy(gy(e,sy.Long),[o,s]);break;case`full`:let c=Ay(e,`fullTime`),l=Ay(e,`fullDate`);r=jy(gy(e,sy.Full),[c,l])}return r&&(wy[n][t]=r),r}function jy(e,t){return t&&(e=e.replace(/\{([^}]+)}/g,function(e,n){return Object.hasOwn(t,n)?t[n]:e})),e}function My(e,t,n=`-`,r,i){let a=``;(e<0||i&&e<=0)&&(i?e=-e+1:(e=-e,a=n));let o=String(e);for(;o.length<t;)o=`0`+o;return r&&(o=o.slice(o.length-t)),a+o}function Ny(e,t){return My(e,3).substring(0,t)}function Py(e,t,n=0,r=!1,i=!1){return function(a,o){let s=Fy(e,a);if((n>0||s>-n)&&(s+=n),e===3)s===0&&n===-12&&(s=12);else if(e===6)return Ny(s,t);let c=_y(o,cy.MinusSign);return My(s,t,c,r,i)}}function Fy(e,t){switch(e){case 0:return t.getFullYear();case 1:return t.getMonth();case 2:return t.getDate();case 3:return t.getHours();case 4:return t.getMinutes();case 5:return t.getSeconds();case 6:return t.getMilliseconds();case 7:return t.getDay();default:throw new T(2301,!1)}}function Iy(e,t,n=ay.Format,r=!1){return function(i,a){return Ly(i,a,e,t,n,r)}}function Ly(e,t,n,r,i,a){switch(n){case 2:return fy(t,i,r)[e.getMonth()];case 1:return dy(t,i,r)[e.getDay()];case 0:let n=e.getHours(),o=e.getMinutes();if(a){let e=yy(t),a=by(t,i,r),s=e.findIndex(e=>{if(Array.isArray(e)){let[t,r]=e,i=n>=t.hours&&o>=t.minutes,a=n<r.hours||n===r.hours&&o<r.minutes;if(t.hours<r.hours){if(i&&a)return!0}else if(i||a)return!0}else if(e.hours===n&&e.minutes===o)return!0;return!1});if(s!==-1)return a[s]}return uy(t,i,r)[n<12?0:1];case 3:return py(t,r)[e.getFullYear()<=0?0:1];default:throw new T(2302,!1)}}function Ry(e){return function(t,n,r){let i=-1*r,a=_y(n,cy.MinusSign),o=i>0?Math.floor(i/60):Math.ceil(i/60);switch(e){case 0:return(i>=0?`+`:``)+My(o,2,a)+My(Math.abs(i%60),2,a);case 1:return`GMT`+(i>=0?`+`:``)+My(o,1,a);case 2:return`GMT`+(i>=0?`+`:``)+My(o,2,a)+`:`+My(Math.abs(i%60),2,a);case 3:return r===0?`Z`:(i>=0?`+`:``)+My(o,2,a)+`:`+My(Math.abs(i%60),2,a);default:throw new T(2310,!1)}}}var zy=0,By=4;function Vy(e){let t=ky(e,zy,1).getDay();return ky(e,0,1+(t<=By?By:11)-t)}function Hy(e){let t=e.getDay(),n=t===0?-3:By-t;return ky(e.getFullYear(),e.getMonth(),e.getDate()+n)}function Uy(e,t=!1){return function(n,r){let i;if(t){let e=new Date(n.getFullYear(),n.getMonth(),1).getDay()-1,t=n.getDate();i=1+Math.floor((t+e)/7)}else{let e=Hy(n),t=Vy(e.getFullYear()),r=e.getTime()-t.getTime();i=1+Math.round(r/6048e5)}return My(i,e,_y(r,cy.MinusSign))}}function Wy(e,t=!1){return function(n,r){return My(Hy(n).getFullYear(),e,_y(r,cy.MinusSign),t)}}var Gy=Object.create(null);function Ky(e){if(Gy[e])return Gy[e];let t;switch(e){case`G`:case`GG`:case`GGG`:t=Iy(3,oy.Abbreviated);break;case`GGGG`:t=Iy(3,oy.Wide);break;case`GGGGG`:t=Iy(3,oy.Narrow);break;case`y`:t=Py(0,1,0,!1,!0);break;case`yy`:t=Py(0,2,0,!0,!0);break;case`yyy`:t=Py(0,3,0,!1,!0);break;case`yyyy`:t=Py(0,4,0,!1,!0);break;case`Y`:t=Wy(1);break;case`YY`:t=Wy(2,!0);break;case`YYY`:t=Wy(3);break;case`YYYY`:t=Wy(4);break;case`M`:case`L`:t=Py(1,1,1);break;case`MM`:case`LL`:t=Py(1,2,1);break;case`MMM`:t=Iy(2,oy.Abbreviated);break;case`MMMM`:t=Iy(2,oy.Wide);break;case`MMMMM`:t=Iy(2,oy.Narrow);break;case`LLL`:t=Iy(2,oy.Abbreviated,ay.Standalone);break;case`LLLL`:t=Iy(2,oy.Wide,ay.Standalone);break;case`LLLLL`:t=Iy(2,oy.Narrow,ay.Standalone);break;case`w`:t=Uy(1);break;case`ww`:t=Uy(2);break;case`W`:t=Uy(1,!0);break;case`d`:t=Py(2,1);break;case`dd`:t=Py(2,2);break;case`c`:case`cc`:t=Py(7,1);break;case`ccc`:t=Iy(1,oy.Abbreviated,ay.Standalone);break;case`cccc`:t=Iy(1,oy.Wide,ay.Standalone);break;case`ccccc`:t=Iy(1,oy.Narrow,ay.Standalone);break;case`cccccc`:t=Iy(1,oy.Short,ay.Standalone);break;case`E`:case`EE`:case`EEE`:t=Iy(1,oy.Abbreviated);break;case`EEEE`:t=Iy(1,oy.Wide);break;case`EEEEE`:t=Iy(1,oy.Narrow);break;case`EEEEEE`:t=Iy(1,oy.Short);break;case`a`:case`aa`:case`aaa`:t=Iy(0,oy.Abbreviated);break;case`aaaa`:t=Iy(0,oy.Wide);break;case`aaaaa`:t=Iy(0,oy.Narrow);break;case`b`:case`bb`:case`bbb`:t=Iy(0,oy.Abbreviated,ay.Standalone,!0);break;case`bbbb`:t=Iy(0,oy.Wide,ay.Standalone,!0);break;case`bbbbb`:t=Iy(0,oy.Narrow,ay.Standalone,!0);break;case`B`:case`BB`:case`BBB`:t=Iy(0,oy.Abbreviated,ay.Format,!0);break;case`BBBB`:t=Iy(0,oy.Wide,ay.Format,!0);break;case`BBBBB`:t=Iy(0,oy.Narrow,ay.Format,!0);break;case`h`:t=Py(3,1,-12);break;case`hh`:t=Py(3,2,-12);break;case`H`:t=Py(3,1);break;case`HH`:t=Py(3,2);break;case`m`:t=Py(4,1);break;case`mm`:t=Py(4,2);break;case`s`:t=Py(5,1);break;case`ss`:t=Py(5,2);break;case`S`:t=Py(6,1);break;case`SS`:t=Py(6,2);break;case`SSS`:t=Py(6,3);break;case`Z`:case`ZZ`:case`ZZZ`:t=Ry(0);break;case`ZZZZZ`:t=Ry(3);break;case`O`:case`OO`:case`OOO`:case`z`:case`zz`:case`zzz`:t=Ry(1);break;case`OOOO`:case`ZZZZ`:case`zzzz`:t=Ry(2);break;default:return null}return Gy[e]=t,t}function qy(e,t){e=e.replace(/:/g,``);let n=Date.parse(`Jan 01, 1970 00:00:00 `+e)/6e4;return isNaN(n)?t:n}function Jy(e,t){return e=new Date(e.getTime()),e.setMinutes(e.getMinutes()+t),e}function Yy(e,t,n){let r=e.getTimezoneOffset();return Jy(e,-1*(qy(t,r)-r))}function Xy(e){if(Qy(e))return e;if(typeof e==`number`&&!isNaN(e))return new Date(e);if(typeof e==`string`){if(e=e.trim(),/^(\d{4}(-\d{1,2}(-\d{1,2})?)?)$/.test(e)){let[t,n=1,r=1]=e.split(`-`).map(e=>+e);return ky(t,n-1,r)}let t=parseFloat(e);if(!isNaN(e-t))return new Date(t);let n;if(n=e.match(Cy))return Zy(n)}let t=new Date(e);if(!Qy(t))throw new T(2311,!1);return t}function Zy(e){let t=new Date(0),n=0,r=0,i=e[8]?t.setUTCFullYear:t.setFullYear,a=e[8]?t.setUTCHours:t.setHours;e[9]&&(n=Number(e[9]+e[10]),r=Number(e[9]+e[11])),i.call(t,Number(e[1]),Number(e[2])-1,Number(e[3]));let o=Number(e[4]||0)-n,s=Number(e[5]||0)-r,c=Number(e[6]||0),l=Math.floor(parseFloat(`0.`+(e[7]||0))*1e3);return a.call(t,o,s,c,l),t}function Qy(e){return e instanceof Date&&!isNaN(e.valueOf())}var $y=(()=>{class e{_viewContainerRef;_viewRef=null;ngTemplateOutletContext=null;ngTemplateOutlet=null;ngTemplateOutletInjector=null;injector=E(Ss);constructor(e){this._viewContainerRef=e}ngOnChanges(e){if(this._shouldRecreateView(e)){let e=this._viewContainerRef;if(this._viewRef&&e.remove(e.indexOf(this._viewRef)),!this.ngTemplateOutlet){this._viewRef=null;return}let t=this._createContextForwardProxy();this._viewRef=e.createEmbeddedView(this.ngTemplateOutlet,t,{injector:this._getInjector()})}}_getInjector(){return this.ngTemplateOutletInjector===`outlet`?this.injector:this.ngTemplateOutletInjector??void 0}_shouldRecreateView(e){return!!e.ngTemplateOutlet||!!e.ngTemplateOutletInjector}_createContextForwardProxy(){return new Proxy({},{set:(e,t,n)=>this.ngTemplateOutletContext?Reflect.set(this.ngTemplateOutletContext,t,n):!1,get:(e,t,n)=>{if(this.ngTemplateOutletContext)return Reflect.get(this.ngTemplateOutletContext,t,n)}})}static ɵfac=function(t){return new(t||e)(xm(th))};static ɵdir=Gh({type:e,selectors:[[``,`ngTemplateOutlet`,``]],inputs:{ngTemplateOutletContext:`ngTemplateOutletContext`,ngTemplateOutlet:`ngTemplateOutlet`,ngTemplateOutletInjector:`ngTemplateOutletInjector`},features:[Dc]})}return e})();function eb(e,t){return new T(2100,!1)}var tb=`mediumDate`,nb=new vi(``),rb=new vi(``),ib=(()=>{class e{locale;defaultTimezone;defaultOptions;constructor(e,t,n){this.locale=e,this.defaultTimezone=t,this.defaultOptions=n}transform(t,n,r,i){if(t==null||t===``||t!==t)return null;try{let e=n??this.defaultOptions?.dateFormat??tb,a=r??this.defaultOptions?.timezone??this.defaultTimezone??void 0;return Dy(t,e,i||this.locale,a)}catch(t){throw eb(e,t.message)}}static ɵfac=function(t){return new(t||e)(xm(bv,16),xm(nb,24),xm(rb,24))};static ɵpipe=Kh({name:`date`,type:e,pure:!0})}return e})(),ab=(()=>{class e{transform(e){return JSON.stringify(e,null,2)}static ɵfac=function(t){return new(t||e)};static ɵpipe=Kh({name:`json`,type:e,pure:!1})}return e})();function ob(e,t){t=encodeURIComponent(t);for(let n of e.split(`;`)){let e=n.indexOf(`=`),[r,i]=e==-1?[n,``]:[n.slice(0,e),n.slice(e+1)];if(r.trim()!==t)continue;let a=i;try{a=decodeURIComponent(i)}catch{}return a.length>1&&a[0]===`"`&&a[a.length-1]===`"`&&(a=a.slice(1,-1)),a}return null}var sb=`browser`,cb=class{_doc;constructor(e){this._doc=e}manager},lb=(()=>{class e extends cb{constructor(e){super(e)}supports(e){return!0}addEventListener(e,t,n,r){return e.addEventListener(t,n,r),()=>this.removeEventListener(e,t,n,r)}removeEventListener(e,t,n,r){return e.removeEventListener(t,n,r)}static ɵfac=function(t){return new(t||e)(qi(Cs))};static ɵprov=di({token:e,factory:e.ɵfac})}return e})(),ub=new vi(``),db=(()=>{class e{_zone;_plugins;_eventNameToPlugin=new Map;constructor(e,t){this._zone=t,e.forEach(e=>{e.manager=this});let n=e.filter(e=>!(e instanceof lb));this._plugins=n.slice().reverse();let r=e.find(e=>e instanceof lb);r&&this._plugins.push(r)}addEventListener(e,t,n,r){return this._findPluginFor(t).addEventListener(e,t,n,r)}getZone(){return this._zone}_findPluginFor(e){let t=this._eventNameToPlugin.get(e);if(t)return t;if(t=this._plugins.find(t=>t.supports(e)),!t)throw new T(-5101,!1);return this._eventNameToPlugin.set(e,t),t}static ɵfac=function(t){return new(t||e)(qi(ub),qi(Is))};static ɵprov=di({token:e,factory:e.ɵfac})}return e})(),fb=`ng-app-id`;function pb(e){for(let t of e)t.remove()}function mb(e,t){let n=t.createElement(`style`);return n.textContent=e,n}function hb(e,t,n,r){let i=e.head?.querySelectorAll(`style[${fb}="${t}"],link[${fb}="${t}"]`);if(!i||i.length===0)return!1;for(let e of i)e.removeAttribute(fb),e instanceof HTMLLinkElement?r.set(e.href.slice(e.href.lastIndexOf(`/`)+1),{usage:0,elements:[e]}):e.textContent&&n.set(e.textContent,{usage:0,elements:[e]});return!0}function gb(e,t){let n=t.createElement(`link`);return n.setAttribute(`rel`,`stylesheet`),n.setAttribute(`href`,e),n}var _b=(()=>{class e{doc;appId;nonce;inline=new Map;external=new Map;hosts=new Set;constructor(e,t,n,r={}){this.doc=e,this.appId=t,this.nonce=n,hb(e,t,this.inline,this.external)&&this.hosts.add(e.head)}addStyles(e,t){for(let t of e)this.addUsage(t,this.inline,mb);t?.forEach(e=>this.addUsage(e,this.external,gb))}removeStyles(e,t){for(let t of e)this.removeUsage(t,this.inline);t?.forEach(e=>this.removeUsage(e,this.external))}addUsage(e,t,n){let r=t.get(e);r?r.usage++:t.set(e,{usage:1,elements:[...this.hosts].map(t=>this.addElement(t,n(e,this.doc)))})}removeUsage(e,t){let n=t.get(e);n&&(n.usage--,n.usage<=0&&(pb(n.elements),t.delete(e)))}ngOnDestroy(){for(let[,{elements:e}]of[...this.inline,...this.external])pb(e);this.hosts.clear()}addHost(e){if(!this.hosts.has(e)){this.hosts.add(e);for(let[t,{elements:n}]of this.inline)n.push(this.addElement(e,mb(t,this.doc)));for(let[t,{elements:n}]of this.external)n.push(this.addElement(e,gb(t,this.doc)))}}removeHost(e){this.hosts.delete(e);for(let t of[...this.inline.values(),...this.external.values()]){let n=[];for(let r of t.elements)r.parentNode===e?r.remove():n.push(r);t.elements=n}}addElement(e,t){return this.nonce&&t.setAttribute(`nonce`,this.nonce),e.appendChild(t)}static ɵfac=function(t){return new(t||e)(qi(Cs),qi(Qs),qi(nc,8),qi(tc))};static ɵprov=di({token:e,factory:e.ɵfac})}return e})(),vb={svg:`http://www.w3.org/2000/svg`,xhtml:`http://www.w3.org/1999/xhtml`,xlink:`http://www.w3.org/1999/xlink`,xml:`http://www.w3.org/XML/1998/namespace`,xmlns:`http://www.w3.org/2000/xmlns/`,math:`http://www.w3.org/1998/Math/MathML`},yb=/%COMP%/g,bb=`%COMP%`,xb=`_nghost-${bb}`,Sb=`_ngcontent-${bb}`,Cb=!0,wb=new vi(``,{factory:()=>Cb}),Tb=new vi(``);function Eb(e){return Sb.replace(yb,e)}function Db(e){return xb.replace(yb,e)}function Ob(e,t){return t.map(t=>t.replace(yb,e))}var kb=(()=>{class e{eventManager;sharedStylesHost;appId;removeStylesOnCompDestroy;doc;ngZone;nonce;tracingService;rendererByCompId=new Map;defaultRenderer;cssVarNamespace;constructor(e,t,n,r,i,a,o=null,s=null,c=null){this.eventManager=e,this.sharedStylesHost=t,this.appId=n,this.removeStylesOnCompDestroy=r,this.doc=i,this.ngZone=a,this.nonce=o,this.tracingService=s,this.cssVarNamespace=c??``,this.defaultRenderer=new Ab(e,i,a,this.tracingService,this.cssVarNamespace)}createRenderer(e,t){if(!e||!t)return this.defaultRenderer;let n=this.getOrCreateRenderer(e,t);return n instanceof Pb?n.applyToHost(e):n instanceof Nb&&n.applyStyles(),n}getOrCreateRenderer(e,t){let n=this.rendererByCompId,r=n.get(t.id);if(!r){let i=this.doc,a=this.ngZone,o=this.eventManager,s=this.sharedStylesHost,c=this.removeStylesOnCompDestroy,l=this.tracingService;switch(t.encapsulation){case cu.Emulated:r=new Pb(o,s,t,this.appId,c,i,a,l,this.cssVarNamespace);break;case cu.ShadowDom:return new Mb(o,e,t,i,a,this.nonce,l,this.cssVarNamespace,s);case cu.ExperimentalIsolatedShadowDom:return new Mb(o,e,t,i,a,this.nonce,l,this.cssVarNamespace);default:r=new Nb(o,s,t,c,i,a,l,this.cssVarNamespace)}n.set(t.id,r)}return r}ngOnDestroy(){this.rendererByCompId.clear()}componentReplaced(e){this.rendererByCompId.delete(e)}static ɵfac=function(t){return new(t||e)(qi(db),qi(ym),qi(Qs),qi(wb),qi(Cs),qi(Is),qi(nc),qi(Ad,8),qi(Tb,8))};static ɵprov=di({token:e,factory:e.ɵfac})}return e})(),Ab=class{eventManager;doc;ngZone;tracingService;cssVarNamespace;data=Object.create(null);throwOnSyntheticProps=!0;constructor(e,t,n,r,i=``){this.eventManager=e,this.doc=t,this.ngZone=n,this.tracingService=r,this.cssVarNamespace=i}destroy(){}destroyNode=null;createElement(e,t){return t?this.doc.createElementNS(vb[t]||t,e):this.doc.createElement(e)}createComment(e){return this.doc.createComment(e)}createText(e){return this.doc.createTextNode(e)}appendChild(e,t){(jb(e)?e.content:e).appendChild(t)}insertBefore(e,t,n){if(e){let r=jb(e)?e.content:e;if(n!=null&&n.parentNode!==r)throw new T(-5106,!1);r.insertBefore(t,n)}}removeChild(e,t){t.remove()}selectRootElement(e,t){let n=typeof e==`string`?this.doc.querySelector(e):e;if(!n)throw new T(-5104,!1);return t||(n.textContent=``),n}parentNode(e){return e.parentNode}nextSibling(e){return e.nextSibling}setAttribute(e,t,n,r){if(r){t=r+`:`+t;let i=vb[r];i?e.setAttributeNS(i,t,n):e.setAttribute(t,n)}else e.setAttribute(t,n)}removeAttribute(e,t,n){if(n){let r=vb[n];r?e.removeAttributeNS(r,t):e.removeAttribute(`${n}:${t}`)}else e.removeAttribute(t)}addClass(e,t){e.classList.add(t)}removeClass(e,t){e.classList.remove(t)}setStyle(e,t,n,r){let i=t.startsWith(`--`);i&&(t=t.replace(`%NS%`,this.cssVarNamespace)),i||r&(Xu.DashCase|Xu.Important)?e.style.setProperty(t,n,r&Xu.Important?`important`:``):e.style[t]=n}removeStyle(e,t,n){let r=t.startsWith(`--`);r&&(t=t.replace(`%NS%`,this.cssVarNamespace)),r||n&Xu.DashCase?e.style.removeProperty(t):e.style[t]=``}setProperty(e,t,n){e!=null&&(e[t]=n)}setValue(e,t){e.nodeValue=t}listen(e,t,n,r){if(typeof e==`string`&&(e=ny().getGlobalEventTarget(this.doc,e),!e))throw new T(-5102,!1);let i=this.decoratePreventDefault(n);return this.tracingService?.wrapEventListener&&(i=this.tracingService.wrapEventListener(e,t,i)),this.eventManager.addEventListener(e,t,i,r)}decoratePreventDefault(e){return t=>{if(t===`__ngUnwrap__`)return e;e(t)===!1&&t.preventDefault()}}};function jb(e){return e.tagName===`TEMPLATE`&&e.content!==void 0}var Mb=class extends Ab{hostEl;sharedStylesHost;shadowRoot;constructor(e,t,n,r,i,a,o,s,c){super(e,r,i,o,s),this.hostEl=t,this.sharedStylesHost=c,this.shadowRoot=t.attachShadow({mode:`open`}),this.sharedStylesHost&&this.sharedStylesHost.addHost(this.shadowRoot);let l=n.styles;l=Ob(n.id,l).map(e=>e.replace(/%NS%/g,s));for(let e of l){let t=document.createElement(`style`);a&&t.setAttribute(`nonce`,a),t.textContent=e,this.shadowRoot.appendChild(t)}let u=n.getExternalStyles?.();if(u)for(let e of u){let t=gb(e,r);a&&t.setAttribute(`nonce`,a),this.shadowRoot.appendChild(t)}}nodeOrShadowRoot(e){return e===this.hostEl?this.shadowRoot:e}appendChild(e,t){return super.appendChild(this.nodeOrShadowRoot(e),t)}insertBefore(e,t,n){return super.insertBefore(this.nodeOrShadowRoot(e),t,n)}removeChild(e,t){return super.removeChild(null,t)}parentNode(e){return this.nodeOrShadowRoot(super.parentNode(this.nodeOrShadowRoot(e)))}destroy(){this.sharedStylesHost&&this.sharedStylesHost.removeHost(this.shadowRoot)}},Nb=class extends Ab{sharedStylesHost;removeStylesOnCompDestroy;styles;styleUrls;constructor(e,t,n,r,i,a,o,s,c){super(e,i,a,o,s),this.sharedStylesHost=t,this.removeStylesOnCompDestroy=r;let l=n.styles,u=c?Ob(c,l):l;this.styles=u.map(e=>e.replace(/%NS%/g,s)),this.styleUrls=n.getExternalStyles?.(c)}applyStyles(){this.sharedStylesHost.addStyles(this.styles,this.styleUrls)}destroy(){this.removeStylesOnCompDestroy&&ud.size===0&&this.sharedStylesHost.removeStyles(this.styles,this.styleUrls)}},Pb=class extends Nb{contentAttr;hostAttr;constructor(e,t,n,r,i,a,o,s,c){let l=r+`-`+n.id;super(e,t,n,i,a,o,s,c,l),this.contentAttr=Eb(l),this.hostAttr=Db(l)}applyToHost(e){this.applyStyles(),this.setAttribute(e,this.hostAttr,``)}createElement(e,t){let n=super.createElement(e,t);return super.setAttribute(n,this.contentAttr,``),n}},Fb=class e extends iy{supportsDOMEvents=!0;static makeCurrent(){ry(new e)}onAndCancel(e,t,n,r){return e.addEventListener(t,n,r),()=>{e.removeEventListener(t,n,r)}}dispatchEvent(e,t){e.dispatchEvent(t)}remove(e){e.remove()}createElement(e,t){return t||=this.getDefaultDocument(),t.createElement(e)}createHtmlDocument(){return document.implementation.createHTMLDocument(`fakeTitle`)}getDefaultDocument(){return document}isElementNode(e){return e.nodeType===Node.ELEMENT_NODE}isShadowRoot(e){return e instanceof DocumentFragment}getGlobalEventTarget(e,t){return t===`window`?window:t===`document`?e:t===`body`?e.body:null}getBaseHref(e){let t=Lb();return t==null?null:Rb(t)}resetBaseElement(){Ib=null}getUserAgent(){return window.navigator.userAgent}getCookie(e){return ob(document.cookie,e)}},Ib=null;function Lb(){return Ib||=document.head.querySelector(`base`),Ib?Ib.getAttribute(`href`):null}function Rb(e){return new URL(e,document.baseURI).pathname}var zb=[`alt`,`control`,`meta`,`shift`],Bb={"\b":`Backspace`,"	":`Tab`,"":`Delete`,"\x1B":`Escape`,Del:`Delete`,Esc:`Escape`,Left:`ArrowLeft`,Right:`ArrowRight`,Up:`ArrowUp`,Down:`ArrowDown`,Menu:`ContextMenu`,Scroll:`ScrollLock`,Win:`OS`},Vb={alt:e=>e.altKey,control:e=>e.ctrlKey,meta:e=>e.metaKey,shift:e=>e.shiftKey},Hb=(()=>{class e extends cb{constructor(e){super(e)}supports(t){return e.parseEventName(t)!=null}addEventListener(t,n,r,i){let a=e.parseEventName(n),o=e.eventCallback(a.fullKey,r,this.manager.getZone());return this.manager.getZone().runOutsideAngular(()=>ny().onAndCancel(t,a.domEventName,o,i))}static parseEventName(t){let n=t.toLowerCase().split(`.`),r=n.shift();if(n.length===0||r!==`keydown`&&r!==`keyup`)return null;let i=e._normalizeKey(n.pop()),a=``,o=n.indexOf(`code`);if(o>-1&&(n.splice(o,1),a=`code.`),zb.forEach(e=>{let t=n.indexOf(e);t>-1&&(n.splice(t,1),a+=e+`.`)}),a+=i,n.length!=0||i.length===0)return null;let s={};return s.domEventName=r,s.fullKey=a,s}static matchEventFullKeyCode(e,t){let n=Bb[e.key]||e.key,r=``;return t.indexOf(`code.`)>-1&&(n=e.code,r=`code.`),n==null||!n?!1:(n=n.toLowerCase(),n===` `?n=`space`:n===`.`&&(n=`dot`),zb.forEach(t=>{if(t!==n){let n=Vb[t];n(e)&&(r+=t+`.`)}}),r+=n,r===t)}static eventCallback(t,n,r){return i=>{e.matchEventFullKeyCode(i,t)&&r.runGuarded(()=>n(i))}}static _normalizeKey(e){return e===`esc`?`escape`:e}static ɵfac=function(t){return new(t||e)(qi(Cs))};static ɵprov=di({token:e,factory:e.ɵfac})}return e})();async function Ub(e,t,n){return Yv({rootComponent:e,...Wb(t,n)})}function Wb(e,t){return{platformRef:t?.platformRef,appProviders:[...Yb,...e?.providers??[]],platformProviders:Jb}}function Gb(){Fb.makeCurrent()}function Kb(){return new Js}function qb(){return Xl(document),document}var Jb=[{provide:tc,useValue:sb},{provide:ec,useValue:Gb,multi:!0},{provide:Cs,useFactory:qb}],Yb=[{provide:Ta,useValue:`root`},{provide:Js,useFactory:Kb},{provide:ub,useClass:lb,multi:!0},{provide:ub,useClass:Hb,multi:!0},kb,{provide:ym,useClass:_b},{provide:_b,useExisting:ym},db,{provide:em,useExisting:kb},[]];function Xb(e,t){let n=`\x1B[${e}m`,r=`\x1B[${t}m`;return((e,...t)=>{if(Array.isArray(e)&&`raw`in e){let i=e,a=``;for(let e=0;e<i.length;e++)a+=i[e],e<t.length&&(a+=String(t[e]));return`${n}${a}${r}`}return`${n}${String(e)}${r}`})}var Zb={blue:Xb(34,39),cyan:Xb(36,39),gray:Xb(90,39),green:Xb(32,39),red:Xb(31,39),yellow:Xb(33,39),bold:Xb(1,22),dim:Xb(2,22),reset:Xb(0,0),underline:Xb(4,24)};function Qb(e,...t){return typeof e==`function`?e(...t):e}var $b=Error.captureStackTrace,ex=class e extends Error{name;code;docs;fix;sources;data;get why(){return this.message}constructor(t,n=e){super(t.why,{cause:t.cause}),this.code=this.name=t.code,this.fix=t.fix,this.docs=t.docs,this.sources=t.sources,this.data=t.data,$b?.(this,n)}toJSON(){return{name:this.name,why:this.why,fix:this.fix,docs:this.docs,sources:this.sources,cause:this.cause,data:this.data,stack:this.stack}}};function tx(e,t){return typeof e==`string`?`${e}/${t.toLowerCase()}`:e?.(t)}function nx(e){let t=e.reporters??[],n={},{docsBase:r}=e;for(let i of Object.keys(e.codes)){let a=e.codes[i],o=a.docs===!1?void 0:a.docs||tx(r,i),s=(e={},n={})=>{let r=new ex({code:i,why:Qb(a.why,e),fix:Qb(a.fix,e),docs:o,cause:e.cause,sources:e.sources,data:Qb(a.data,e)},s);for(let e of t)e(r,n);return r};n[i]=s}return n}function rx(e){return t=>{let n=`${e.bold(e.red(`[${t.name}]`))} ${t.message}`,r=[];return t.fix&&r.push(`${e.dim(`fix:`)} ${t.fix}`),t.sources?.length&&r.push(`${e.dim(`sources:`)} ${t.sources.join(`, `)}`),t.docs&&r.push(`${e.dim(`see:`)} ${e.cyan(t.docs)}`),r.length===0?n:[n,...r.map((t,n)=>`${e.dim(n<r.length-1?`├▶`:`╰▶`)} ${t}`)].join(`
`)}}var ix={bus:{agentManifestChanged:`agent:manifest:changed`,agentToolRegistered:`agent:tool:registered`,agentToolUnregistered:`agent:tool:unregistered`,agentResourceRegistered:`agent:resource:registered`,agentResourceUnregistered:`agent:resource:unregistered`},client:{isTrustedUpdated:`rpc:is-trusted:updated`,error:`rpc:error`,connectionStatus:`connection:status`,connectionError:`connection:error`},broadcast:{authRevoked:`devframe:auth:revoked`,clientStateUpdated:`devframe:rpc:client-state:updated`,clientStatePatch:`devframe:rpc:client-state:patch`,streamingChunk:`devframe:streaming:chunk`,streamingEnd:`devframe:streaming:end`,streamingUploadCancel:`devframe:streaming:upload-cancel`},inPageChannel:{panelStateUpdated:`devframe:in-page:panel-state:updated`,panelStatePatch:`devframe:in-page:panel-state:patch`},postMessage:{remoteAssetsError:`devframe:remote-assets-error`,inPageChannel:`devframe:in-page-channel`}},ax=rx(Zb);function ox(e,{method:t=`warn`}={}){console[t](ax(e))}function sx(e){return nx({...e,reporters:[ox,...e.reporters??[]]})}function cx(){let e,t;return{promise:new Promise((n,r)=>{e=n,t=r}),resolve:e,reject:t}}var lx=Math.random.bind(Math),ux=`useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict`;function dx(e=21){let t=``,n=e;for(;n--;)t+=ux[lx()*64|0];return t}var fx=6e4,px=e=>e,mx=px,{clearTimeout:hx,setTimeout:gx}=globalThis;function _x(e,t){let{post:n,on:r,off:i=()=>{},eventNames:a=[],serialize:o=px,deserialize:s=mx,resolver:c,bind:l=`rpc`,timeout:u=fx,proxify:d=!0}=t,f=!1,p=new Map,m,h;async function g(e,r,i,a){if(f)throw Error(`[birpc] rpc is closed, cannot call "${e}"`);let s={m:e,a:r,t:`q`};a&&(s.o=!0);let c=async e=>n(o(e));if(i){await c(s);return}if(m)try{await m}finally{m=void 0}let{promise:l,resolve:d,reject:g}=cx(),_=dx();s.i=_;let ee;async function v(n=s){return u>=0&&(ee=gx(()=>{try{if(t.onTimeoutError?.call(h,e,r)!==!0)throw Error(`[birpc] timeout on calling "${e}"`)}catch(e){g(e)}p.delete(_)},u),typeof ee==`object`&&(ee=ee.unref?.())),p.set(_,{resolve:d,reject:g,timeoutId:ee,method:e}),await c(n),l}try{t.onRequest?await t.onRequest.call(h,s,v,d):await v()}catch(e){if(t.onGeneralError?.call(h,e)!==!0)throw e;return}finally{hx(ee),p.delete(_)}return l}let _={$call:(e,...t)=>g(e,t,!1),$callOptional:(e,...t)=>g(e,t,!1,!0),$callEvent:(e,...t)=>g(e,t,!0),$callRaw:e=>g(e.method,e.args,e.event,e.optional),$rejectPendingCalls:v,get $closed(){return f},get $meta(){return t.meta},$close:ee,$functions:e};h=d?new Proxy({},{get(t,n){if(Object.hasOwn(_,n))return _[n];if(n===`then`&&!a.includes(`then`)&&!(`then`in e))return;let r=(...e)=>g(n,e,!0);if(a.includes(n))return r.asEvent=r,r;let i=(...e)=>g(n,e,!1);return i.asEvent=r,i}}):_;function ee(e){f=!0,p.forEach(({reject:t,method:n})=>{let r=Error(`[birpc] rpc is closed, cannot call "${n}"`);if(e)return e.cause??=r,t(e);t(r)}),p.clear(),i(te)}function v(e){let t=Array.from(p.values()).map(({method:t,reject:n})=>e?e({method:t,reject:n}):n(Error(`[birpc]: rejected pending call "${t}".`)));return p.clear(),t}async function te(r,...i){let a;try{a=s(r)}catch(e){if(t.onGeneralError?.call(h,e)!==!0)throw e;return}if(a.t===`q`){let{m:r,a:s,o:u}=a,d,f,p=await(c?c.call(h,r,e[r]):e[r]);if(u&&(p||=()=>void 0),!p)f=Error(`[birpc] function "${r}" not found`);else try{d=await p.apply(l===`rpc`?h:e,s)}catch(e){f=e}if(a.i){if(f&&t.onFunctionError&&t.onFunctionError.call(h,f,r,s)===!0)return;if(!f)try{await n(o({t:`s`,i:a.i,r:d}),...i);return}catch(e){if(f=e,t.onGeneralError?.call(h,e,r,s)!==!0)throw e}try{await n(o({t:`s`,i:a.i,e:f}),...i)}catch(e){if(t.onGeneralError?.call(h,e,r,s)!==!0)throw e}}}else{let{i:e,r:t,e:n}=a,r=p.get(e);r&&(hx(r.timeoutId),n?r.reject(n):r.resolve(t)),p.delete(e)}}return m=r(te),h}function vx(e,t){return t.safety?t.safety:e===`static`||e===`query`||e==null?`read`:`action`}var yx=Object.freeze({type:`object`,additionalProperties:!0});function bx(e){let t=e[`~standard`];if(t.jsonSchema)try{return t.jsonSchema.input({target:`draft-2020-12`})}catch{return yx}return yx}function xx(e){if(!e||e.length===0)return{type:`object`,properties:{}};let t={},n=[];for(let r=0;r<e.length;r++){let i=`arg${r}`;t[i]=bx(e[r]),n.push(i)}return{type:`object`,properties:t,required:n,additionalProperties:!1}}function Sx(e,t){if(Array.isArray(e))return e;if(e==null)return[];if(typeof e!=`object`)return;let n=e;if(t!=null)return Array.from({length:t},(e,t)=>n[`arg${t}`]);if(`arg0`in n){let e=[];for(;`arg${e.length}`in n;)e.push(n[`arg${e.length}`]);return e}return Object.keys(n).length===0?[]:void 0}function Cx(e,t){return Sx(e,t)??[e]}function wx(e){return typeof e==`string`?`'${e}'`:new Ox().serialize(e)}var Tx=` _-,;:!?.'"()[]{}@*/\\&#%\`^+<=>|~$0123456789abcdefghijklmnopqrstuvwxyz`,Ex=(function(){let e=new Uint8Array(128);for(let t=0;t<69;t++)e[Tx.charCodeAt(t)]=t+1;for(let t=65;t<=90;t++)e[t]=e[t+32];return e})();function Dx(e,t){if(e===t)return 0;let n=Math.min(e.length,t.length),r=0;for(let i=0;i<n;i++){let n=e.charCodeAt(i),a=t.charCodeAt(i);if(n===a)continue;let o=n<128&&Ex[n]?Ex[n]:n+128,s=a<128&&Ex[a]?Ex[a]:a+128;if(o!==s)return o<s?-1:1;r===0&&(r=n>a?-1:1)}return e.length===t.length?r:e.length<t.length?-1:1}var Ox=(function(){class e{#e=new Map;compare(e,t){let n=typeof e,r=typeof t;return n===`string`&&r===`string`?Dx(e,t):n===`number`&&r===`number`?e-t:Dx(this.serialize(e,!0),this.serialize(t,!0))}serialize(e,t){if(e===null)return`null`;switch(typeof e){case`string`:return t?e:`'${e}'`;case`bigint`:return`${e}n`;case`object`:return this.$object(e);case`function`:return this.$function(e)}return String(e)}serializeObject(e){let t=Object.prototype.toString.call(e);if(t!==`[object Object]`)return this.serializeBuiltInType(t.length<10?`unknown:${t}`:t.slice(8,-1),e);let n=e.constructor,r=n===Object||n===void 0?``:n.name;if(r!==``&&globalThis[r]===n)return this.serializeBuiltInType(r,e);if(`toJSON`in e&&typeof e.toJSON==`function`){let t=e.toJSON();return r+(typeof t==`object`&&t?this.$object(t):`(${this.serialize(t)})`)}let i=Object.keys(e).sort(Dx),a=`${r}{`;for(let t=0;t<i.length;t++){let n=i[t];a+=`${n}:${this.serialize(e[n])}`,t<i.length-1&&(a+=`,`)}return a+`}`}serializeBuiltInType(e,t){let n=this[`$`+e];if(n)return n.call(this,t);if(typeof t.entries==`function`)return this.serializeObjectEntries(e,t.entries());throw Error(`Cannot serialize ${e}`)}serializeObjectEntries(e,t){let n=Array.from(t).sort((e,t)=>this.compare(e[0],t[0])),r=`${e}{`;for(let e=0;e<n.length;e++){let[t,i]=n[e];r+=`${this.serialize(t,!0)}:${this.serialize(i)}`,e<n.length-1&&(r+=`,`)}return r+`}`}$object(e){let t=this.#e.get(e);return t===void 0&&(this.#e.set(e,`#${this.#e.size}`),t=this.serializeObject(e),this.#e.set(e,t)),t}$function(e){let t=Function.prototype.toString.call(e);return t.slice(-15)===`[native code] }`?`${e.name||``}()[native]`:`${e.name}(${e.length})${t.replace(/\s*\n\s*/g,``)}`}$Array(e){let t=`[`;for(let n=0;n<e.length;n++)t+=this.serialize(e[n]),n<e.length-1&&(t+=`,`);return t+`]`}$Date(e){try{return`Date(${e.toISOString()})`}catch{return`Date(null)`}}$ArrayBuffer(e){return`ArrayBuffer[${new Uint8Array(e).join(`,`)}]`}$Set(e){return`Set${this.$Array(Array.from(e).sort((e,t)=>this.compare(e,t)))}`}$Map(e){return this.serializeObjectEntries(`Map`,e.entries())}}for(let t of[`Error`,`RegExp`,`URL`])e.prototype[`$`+t]=function(e){return`${t}(${e})`};for(let t of[`Int8Array`,`Uint8Array`,`Uint8ClampedArray`,`Int16Array`,`Uint16Array`,`Int32Array`,`Uint32Array`,`Float32Array`,`Float64Array`])e.prototype[`$`+t]=function(e){return`${t}[${e.join(`,`)}]`};for(let t of[`BigInt64Array`,`BigUint64Array`])e.prototype[`$`+t]=function(e){return`${t}[${e.join(`n,`)}${e.length>0?`n`:``}]`};return e})(),kx=[1779033703,-1150833019,1013904242,-1521486534,1359893119,-1694144372,528734635,1541459225],Ax=[1116352408,1899447441,-1245643825,-373957723,961987163,1508970993,-1841331548,-1424204075,-670586216,310598401,607225278,1426881987,1925078388,-2132889090,-1680079193,-1046744716,-459576895,-272742522,264347078,604807628,770255983,1249150122,1555081692,1996064986,-1740746414,-1473132947,-1341970488,-1084653625,-958395405,-710438585,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,-2117940946,-1838011259,-1564481375,-1474664885,-1035236496,-949202525,-778901479,-694614492,-200395387,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,-2067236844,-1933114872,-1866530822,-1538233109,-1090935817,-965641998],jx=`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_`,Mx=[],Nx=class{_data=new Px;_hash=new Px([...kx]);_nDataBytes=0;_minBufferSize=0;finalize(e){e&&this._append(e);let t=this._nDataBytes*8,n=this._data.sigBytes*8;return this._data.words[n>>>5]|=128<<24-n%32,this._data.words[(n+64>>>9<<4)+14]=Math.floor(t/4294967296),this._data.words[(n+64>>>9<<4)+15]=t,this._data.sigBytes=this._data.words.length*4,this._process(),this._hash}_doProcessBlock(e,t){let n=this._hash.words,r=n[0],i=n[1],a=n[2],o=n[3],s=n[4],c=n[5],l=n[6],u=n[7];for(let n=0;n<64;n++){if(n<16)Mx[n]=e[t+n]|0;else{let e=Mx[n-15],t=(e<<25|e>>>7)^(e<<14|e>>>18)^e>>>3,r=Mx[n-2],i=(r<<15|r>>>17)^(r<<13|r>>>19)^r>>>10;Mx[n]=t+Mx[n-7]+i+Mx[n-16]}let d=s&c^~s&l,f=r&i^r&a^i&a,p=(r<<30|r>>>2)^(r<<19|r>>>13)^(r<<10|r>>>22),m=(s<<26|s>>>6)^(s<<21|s>>>11)^(s<<7|s>>>25),h=u+m+d+Ax[n]+Mx[n],g=p+f;u=l,l=c,c=s,s=o+h|0,o=a,a=i,i=r,r=h+g|0}n[0]=n[0]+r|0,n[1]=n[1]+i|0,n[2]=n[2]+a|0,n[3]=n[3]+o|0,n[4]=n[4]+s|0,n[5]=n[5]+c|0,n[6]=n[6]+l|0,n[7]=n[7]+u|0}_append(e){typeof e==`string`&&(e=Px.fromUtf8(e)),this._data.concat(e),this._nDataBytes+=e.sigBytes}_process(e){let t,n=this._data.sigBytes/64;n=e?Math.ceil(n):Math.max((n|0)-this._minBufferSize,0);let r=n*16,i=Math.min(r*4,this._data.sigBytes);if(r){for(let e=0;e<r;e+=16)this._doProcessBlock(this._data.words,e);t=this._data.words.splice(0,r),this._data.sigBytes-=i}return new Px(t,i)}},Px=class e{words;sigBytes;constructor(e,t){e=this.words=e||[],this.sigBytes=t===void 0?e.length*4:t}static fromUtf8(t){let n=unescape(encodeURIComponent(t)),r=n.length,i=[];for(let e=0;e<r;e++)i[e>>>2]|=(n.charCodeAt(e)&255)<<24-e%4*8;return new e(i,r)}toBase64(){let e=[];for(let t=0;t<this.sigBytes;t+=3){let n=this.words[t>>>2]>>>24-t%4*8&255,r=this.words[t+1>>>2]>>>24-(t+1)%4*8&255,i=this.words[t+2>>>2]>>>24-(t+2)%4*8&255,a=n<<16|r<<8|i;for(let n=0;n<4&&t*8+n*6<this.sigBytes*8;n++)e.push(jx.charAt(a>>>6*(3-n)&63))}return e.join(``)}concat(e){if(this.words[this.sigBytes>>>2]&=4294967295<<32-this.sigBytes%4*8,this.words.length=Math.ceil(this.sigBytes/4),this.sigBytes%4)for(let t=0;t<e.sigBytes;t++){let n=e.words[t>>>2]>>>24-t%4*8&255;this.words[this.sigBytes+t>>>2]|=n<<24-(this.sigBytes+t)%4*8}else for(let t=0;t<e.sigBytes;t+=4)this.words[this.sigBytes+t>>>2]=e.words[t>>>2];this.sigBytes+=e.sigBytes}};function Fx(e){return new Nx().finalize(e).toBase64()}function Ix(e){return Fx(wx(e))}function Lx(e){return Ix(e)}function Rx(){let e={};function t(t,...n){let r=e[t]||[];for(let e=0,t=r.length;e<t;e++){let t=r[e];t&&t(...n)}}function n(n,...r){t(n,...r),delete e[n]}function r(t,n){return(e[t]||=[]).push(n),()=>{e[t]=e[t]?.filter(e=>n!==e)}}function i(e,t){let n=r(e,((...e)=>(n(),t(...e))));return n}return{_listeners:e,emit:t,emitOnce:n,on:r,once:i}}var zx=/^[\w+.-]{2,}:\/\//;function Bx(e){return e.endsWith(`/`)?e:`${e}/`}function Vx(e){return(e.endsWith(`/`)?e.slice(0,-1):e)||`/`}function Hx(e,...t){let n=e;for(let e of t)e&&e!==`/`&&(n=n?Bx(n)+e.replace(/^\.?\//,``):e);return n}function Ux(e,t){if(!t||t===`/`||zx.test(e))return e;let n=Vx(t);return e.startsWith(n)?e:Hx(n,e)}function Wx(e,t){let n=e.match(zx);return t+(n?e.slice(n[0].length):e)}var Gx=`useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict`;function Kx(e=21){let t=``,n=e;for(;n--;)t+=Gx[Math.random()*64|0];return t}var qx=Symbol.for(`immer-nothing`),Jx=Symbol.for(`immer-draftable`),Yx=Symbol.for(`immer-state`),Xx=[function(e){return`The plugin for '${e}' has not been loaded into Immer. To enable the plugin, import and call \`enable${e}()\` when initializing your application.`},function(e){return`produce can only be called on things that are draftable: plain objects, arrays, Map, Set or classes that are marked with '[immerable]: true'. Got '${e}'`},`This object has been frozen and should not be mutated`,function(e){return`Cannot use a proxy that has been revoked. Did you pass an object from inside an immer function to an async process? `+e},`An immer producer returned a new value *and* modified its draft. Either return a new value *or* modify the draft.`,`Immer forbids circular references`,"The first or second argument to `produce` must be a function","The third argument to `produce` must be a function or undefined","First argument to `createDraft` must be a plain object, an array, or an immerable object","First argument to `finishDraft` must be a draft returned by `createDraft`",function(e){return`'current' expects a draft, got: ${e}`},`Object.defineProperty() cannot be used on an Immer draft`,`Object.setPrototypeOf() cannot be used on an Immer draft`,`Immer only supports deleting array indices`,`Immer only supports setting array indices and the 'length' property`,function(e){return`'original' expects a draft, got: ${e}`}];function Zx(e,...t){{let n=Xx[e],r=xS(n)?n.apply(null,t):n;throw Error(`[Immer] ${r}`)}}var Qx=Object,$x=Qx.getPrototypeOf,eS=`constructor`,tS=`prototype`,nS=`configurable`,rS=`enumerable`,iS=`writable`,aS=`value`,oS=e=>!!e&&!!e[Yx];function sS(e){return e?uS(e)||_S(e)||!!e[Jx]||!!e[eS]?.[Jx]||vS(e)||yS(e):!1}var cS=Qx[tS][eS].toString(),lS=new WeakMap;function uS(e){if(!e||!bS(e))return!1;let t=$x(e);if(t===null||t===Qx[tS])return!0;let n=Qx.hasOwnProperty.call(t,eS)&&t[eS];if(n===Object)return!0;if(!xS(n))return!1;let r=lS.get(n);return r===void 0&&(r=Function.toString.call(n),lS.set(n,r)),r===cS}function dS(e,t,n=!0){fS(e)===0?(n?Reflect.ownKeys(e):Qx.keys(e)).forEach(n=>{t(n,e[n],e)}):e.forEach((n,r)=>t(r,n,e))}function fS(e){let t=e[Yx];return t?t.type_:_S(e)?1:vS(e)?2:yS(e)?3:0}var pS=(e,t,n=fS(e))=>n===2?e.has(t):Qx[tS].hasOwnProperty.call(e,t),mS=(e,t,n=fS(e))=>n===2?e.get(t):e[t],hS=(e,t,n,r=fS(e))=>{r===2?e.set(t,n):r===3?e.add(n):e[t]=n};function gS(e,t){return e===t?e!==0||1/e==1/t:e!==e&&t!==t}var _S=Array.isArray,vS=e=>e instanceof Map,yS=e=>e instanceof Set,bS=e=>typeof e==`object`,xS=e=>typeof e==`function`,SS=e=>typeof e==`boolean`;function CS(e){let t=+e;return Number.isInteger(t)&&String(t)===e}var wS=e=>bS(e)?e?.[Yx]:null,TS=e=>e.copy_||e.base_,ES=e=>e.modified_?e.copy_:e.base_;function DS(e,t){if(vS(e))return new Map(e);if(yS(e))return new Set(e);if(_S(e))return Array[tS].slice.call(e);let n=uS(e);if(t===!0||t===`class_only`&&!n){let t=Qx.getOwnPropertyDescriptors(e);delete t[Yx];let n=Reflect.ownKeys(t);for(let r=0;r<n.length;r++){let i=n[r],a=t[i];a[iS]===!1&&(a[iS]=!0,a[nS]=!0),(a.get||a.set)&&(t[i]={[nS]:!0,[iS]:!0,[rS]:a[rS],[aS]:e[i]})}return Qx.create($x(e),t)}{let t=$x(e);if(t!==null&&n)return{...e};let r=Qx.create(t);return Qx.assign(r,e)}}function OS(e,t=!1){return jS(e)||oS(e)||!sS(e)?e:(fS(e)>1&&Qx.defineProperties(e,{set:AS,add:AS,clear:AS,delete:AS}),Qx.freeze(e),t&&dS(e,(e,t)=>{OS(t,!0)},!1),e)}function kS(){Zx(2)}var AS={[aS]:kS};function jS(e){return e===null||!bS(e)||Qx.isFrozen(e)}var MS=`MapSet`,NS=`Patches`,PS=`ArrayMethods`,FS={};function IS(e){let t=FS[e];return t||Zx(0,e),t}var LS=e=>!!FS[e];function RS(e,t){FS[e]||(FS[e]=t)}var zS,BS=()=>zS,VS=(e,t)=>({drafts_:[],parent_:e,immer_:t,canAutoFreeze_:!0,unfinalizedDrafts_:0,handledSet_:new Set,processedForPatches_:new Set,mapSetPlugin_:LS(MS)?IS(MS):void 0,arrayMethodsPlugin_:LS(PS)?IS(PS):void 0});function HS(e,t){t&&(e.patchPlugin_=IS(NS),e.patches_=[],e.inversePatches_=[],e.patchListener_=t)}function US(e){WS(e),e.drafts_.forEach(KS),e.drafts_=null}function WS(e){e===zS&&(zS=e.parent_)}var GS=e=>zS=VS(zS,e);function KS(e){let t=e[Yx];t.type_===0||t.type_===1?t.revoke_():t.revoked_=!0}function qS(e,t){t.unfinalizedDrafts_=t.drafts_.length;let n=t.drafts_[0];if(e!==void 0&&e!==n){n[Yx].modified_&&(US(t),Zx(4)),sS(e)&&(e=JS(t,e));let{patchPlugin_:r}=t;r&&r.generateReplacementPatches_(n[Yx].base_,e,t)}else e=JS(t,n);return YS(t,e,!0),US(t),t.patches_&&t.patchListener_(t.patches_,t.inversePatches_),e===qx?void 0:e}function JS(e,t){if(jS(t))return t;let n=t[Yx];if(!n)return rC(t,e.handledSet_,e);if(!ZS(n,e))return t;if(!n.modified_)return n.base_;if(!n.finalized_){let{callbacks_:t}=n;if(t)for(;t.length>0;)t.pop()(e);tC(n,e)}return n.copy_}function YS(e,t,n=!1){!e.parent_&&e.immer_.autoFreeze_&&e.canAutoFreeze_&&OS(t,n)}function XS(e){e.finalized_=!0,e.scope_.unfinalizedDrafts_--}var ZS=(e,t)=>e.scope_===t,QS=[];function $S(e,t,n,r){let i=TS(e),a=e.type_;if(r!==void 0&&mS(i,r,a)===t){hS(i,r,n,a);return}if(!e.draftLocations_){let t=e.draftLocations_=new Map;dS(i,(e,n)=>{if(oS(n)){let r=t.get(n)||[];r.push(e),t.set(n,r)}})}let o=e.draftLocations_.get(t)??QS;for(let e of o)hS(i,e,n,a)}function eC(e,t,n){e.callbacks_.push(function(r){let i=t;if(!i||!ZS(i,r))return;r.mapSetPlugin_?.fixSetContents(i);let a=ES(i);$S(e,i.draft_??i,a,n),tC(i,r)})}function tC(e,t){if(e.modified_&&!e.finalized_&&(e.type_===3||e.type_===1&&e.allIndicesReassigned_||(e.assigned_?.size??0)>0)){let{patchPlugin_:n}=t;if(n){let r=n.getPath(e);r&&n.generatePatches_(e,r,t)}XS(e)}}function nC(e,t,n){let{scope_:r}=e;if(oS(n)){let i=n[Yx];ZS(i,r)&&i.callbacks_.push(function(){fC(e),$S(e,n,ES(i),t)})}else sS(n)&&e.callbacks_.push(function(){let i=TS(e);e.type_===3?i.has(n)&&rC(n,r.handledSet_,r):mS(i,t,e.type_)===n&&r.drafts_.length>1&&(e.assigned_.get(t)??!1)===!0&&e.copy_&&rC(mS(e.copy_,t,e.type_),r.handledSet_,r)})}function rC(e,t,n){return!n.immer_.autoFreeze_&&n.unfinalizedDrafts_<1||oS(e)||t.has(e)||!sS(e)||jS(e)?e:(t.add(e),dS(e,(r,i)=>{if(oS(i)){let t=i[Yx];ZS(t,n)&&(hS(e,r,ES(t),e.type_),XS(t))}else sS(i)&&rC(i,t,n)}),e)}function iC(e,t){let n=_S(e),r={type_:+!!n,scope_:t?t.scope_:BS(),modified_:!1,finalized_:!1,assigned_:void 0,parent_:t,base_:e,draft_:null,copy_:null,revoke_:null,isManual_:!1,callbacks_:void 0},i=r,a=aC;n&&(i=[r],a=oC);let{revoke:o,proxy:s}=Proxy.revocable(i,a);return r.draft_=s,r.revoke_=o,[s,r]}var aC={get(e,t){if(t===Yx)return e;let n=e.scope_.arrayMethodsPlugin_,r=e.type_===1&&typeof t==`string`;if(r&&n?.isArrayOperationMethod(t))return n.createMethodInterceptor(e,t);let i=TS(e);if(!pS(i,t,e.type_))return lC(e,i,t);let a=i[t];if(e.finalized_||!sS(a)||r&&e.operationMethod&&n?.isMutatingArrayMethod(e.operationMethod)&&CS(t))return a;if(a===sC(e.base_,t)||cC(e,t,a)){fC(e);let n=e.type_===1?+t:t,r=mC(e.scope_,a,e,n);return e.copy_[n]=r}return a},has(e,t){return t in TS(e)},ownKeys(e){return Reflect.ownKeys(TS(e))},set(e,t,n){let r=uC(TS(e),t);if(r?.set)return r.set.call(e.draft_,n),!0;if(!e.modified_){let r=sC(TS(e),t),i=r?.[Yx];if(i&&i.base_===n)return e.copy_[t]=n,e.assigned_.set(t,!1),!0;if(gS(n,r)&&(n!==void 0||pS(e.base_,t,e.type_)))return!0;fC(e),dC(e)}return e.copy_[t]===n&&(n!==void 0||pS(e.copy_,t,e.type_))||Number.isNaN(n)&&Number.isNaN(e.copy_[t])?!0:(e.copy_[t]=n,e.assigned_.set(t,!0),nC(e,t,n),!0)},deleteProperty(e,t){return fC(e),sC(e.base_,t)!==void 0||t in e.base_?(e.assigned_.set(t,!1),dC(e)):e.assigned_.delete(t),e.copy_&&delete e.copy_[t],!0},getOwnPropertyDescriptor(e,t){let n=TS(e),r=Reflect.getOwnPropertyDescriptor(n,t);return r&&{[iS]:!0,[nS]:e.type_!==1||t!==`length`,[rS]:r[rS],[aS]:n[t]}},defineProperty(){Zx(11)},getPrototypeOf(e){return $x(e.base_)},setPrototypeOf(){Zx(12)}},oC={};for(let e in aC){let t=aC[e];oC[e]=function(){let e=arguments;return e[0]=e[0][0],t.apply(this,e)}}oC.deleteProperty=function(e,t){return isNaN(parseInt(t))&&Zx(13),oC.set.call(this,e,t,void 0)},oC.set=function(e,t,n){return t!==`length`&&isNaN(parseInt(t))&&Zx(14),aC.set.call(this,e[0],t,n,e[0])};function sC(e,t){let n=e[Yx];return(n?TS(n):e)[t]}function cC(e,t,n){return e.type_!==1||!e.allIndicesReassigned_||e.assigned_?.get(t)||!sS(n)||n[Yx]?!1:e.baseRefs_.has(n)}function lC(e,t,n){let r=uC(t,n);return r?aS in r?r[aS]:r.get?.call(e.draft_):void 0}function uC(e,t){if(!(t in e))return;let n=$x(e);for(;n;){let e=Object.getOwnPropertyDescriptor(n,t);if(e)return e;n=$x(n)}}function dC(e){e.modified_||(e.modified_=!0,e.parent_&&dC(e.parent_))}function fC(e){e.copy_||=(e.assigned_=new Map,DS(e.base_,e.scope_.immer_.useStrictShallowCopy_))}var pC=class{constructor(e){this.autoFreeze_=!0,this.useStrictShallowCopy_=!1,this.useStrictIteration_=!1,this.produce=(e,t,n)=>{if(xS(e)&&!xS(t)){let n=t;t=e;let r=this;return function(e=n,...i){return r.produce(e,e=>t.call(this,e,...i))}}xS(t)||Zx(6),n!==void 0&&!xS(n)&&Zx(7);let r;if(sS(e)){let i=GS(this),a=mC(i,e,void 0),o=!0;try{r=t(a),o=!1}finally{o?US(i):WS(i)}return HS(i,n),qS(r,i)}if(!e||!bS(e)){if(r=t(e),r===void 0&&(r=e),r===qx&&(r=void 0),this.autoFreeze_&&OS(r,!0),n){let t=[],i=[];IS(NS).generateReplacementPatches_(e,r,{patches_:t,inversePatches_:i}),n(t,i)}return r}Zx(1,e)},this.produceWithPatches=(e,t)=>{if(xS(e))return(t,...n)=>this.produceWithPatches(t,t=>e(t,...n));let n,r;return[this.produce(e,t,(e,t)=>{n=e,r=t}),n,r]},SS(e?.autoFreeze)&&this.setAutoFreeze(e.autoFreeze),SS(e?.useStrictShallowCopy)&&this.setUseStrictShallowCopy(e.useStrictShallowCopy),SS(e?.useStrictIteration)&&this.setUseStrictIteration(e.useStrictIteration)}createDraft(e){sS(e)||Zx(8),oS(e)&&(e=hC(e));let t=GS(this),n=mC(t,e,void 0);return n[Yx].isManual_=!0,WS(t),n}finishDraft(e,t){let n=e&&e[Yx];(!n||!n.isManual_)&&Zx(9);let{scope_:r}=n;return HS(r,t),qS(void 0,r)}setAutoFreeze(e){this.autoFreeze_=e}setUseStrictShallowCopy(e){this.useStrictShallowCopy_=e}setUseStrictIteration(e){this.useStrictIteration_=e}shouldUseStrictIteration(){return this.useStrictIteration_}applyPatches(e,t){let n;for(n=t.length-1;n>=0;n--){let r=t[n];if(r.path.length===0&&r.op===`replace`){e=r.value;break}}n>-1&&(t=t.slice(n+1));let r=IS(NS).applyPatches_;return oS(e)?r(e,t):this.produce(e,e=>r(e,t))}};function mC(e,t,n,r){let[i,a]=vS(t)?IS(MS).proxyMap_(t,n):yS(t)?IS(MS).proxySet_(t,n):iC(t,n);return(n?.scope_??BS()).drafts_.push(i),a.callbacks_=n?.callbacks_??[],a.key_=r,n&&r!==void 0?eC(n,a,r):a.callbacks_.push(function(e){e.mapSetPlugin_?.fixSetContents(a);let{patchPlugin_:t}=e;a.modified_&&t&&t.generatePatches_(a,[],e)}),i}function hC(e){return oS(e)||Zx(10,e),gC(e)}function gC(e){if(!sS(e)||jS(e))return e;let t=e[Yx],n,r=!0;if(t){if(!t.modified_)return t.base_;t.finalized_=!0,n=DS(e,t.scope_.immer_.useStrictShallowCopy_),r=t.scope_.immer_.shouldUseStrictIteration()}else n=DS(e,!0);return dS(n,(e,t)=>{hS(n,e,gC(t))},r),t&&(t.finalized_=!1),n}function _C(){Xx.push(`Sets cannot have "replace" patches.`,function(e){return`Unsupported patch operation: `+e},function(e){return`Cannot apply patch, path doesn't resolve: `+e},`Patching reserved attributes like __proto__, prototype and constructor is not allowed`);function e(n,r=[]){if(n.key_!==void 0){let e=n.parent_.copy_??n.parent_.base_,t=wS(mS(e,n.key_)),i=mS(e,n.key_);if(i===void 0||i!==n.draft_&&i!==n.base_&&i!==n.copy_||t!=null&&t.base_!==n.base_)return null;let a=n.parent_.type_===3,o;if(a){let e=n.parent_;o=Array.from(e.drafts_.keys()).indexOf(n.key_)}else o=n.key_;if(!(a&&e.size>o||pS(e,o)))return null;r.push(o)}if(n.parent_)return e(n.parent_,r);r.reverse();try{t(n.copy_,r)}catch{return null}return r}function t(e,t){let n=e;for(let e=0;e<t.length-1;e++){let r=t[e];if(n=mS(n,r),!bS(n)||n===null)throw Error(`Cannot resolve path at '${t.join(`/`)}'`)}return n}let n=`replace`,r=`remove`;function i(e,t,n){if(e.scope_.processedForPatches_.has(e))return;e.scope_.processedForPatches_.add(e);let{patches_:r,inversePatches_:i}=n;switch(e.type_){case 0:case 2:return o(e,t,r,i);case 1:return a(e,t,r,i);case 3:return s(e,t,r,i)}}function a(e,t,i,a){let{base_:o,assigned_:s}=e,c=e.copy_;c.length<o.length&&([o,c]=[c,o],[i,a]=[a,i]);let l=e.allIndicesReassigned_===!0;for(let e=0;e<o.length;e++){let r=c[e],u=o[e];if((l||s?.get(e.toString()))&&r!==u){let o=r?.[Yx];if(o&&o.modified_)continue;let s=t.concat([e]);i.push({op:n,path:s,value:d(r)}),a.push({op:n,path:s,value:d(u)})}}for(let e=o.length;e<c.length;e++){let n=t.concat([e]);i.push({op:`add`,path:n,value:d(c[e])})}for(let e=c.length-1;o.length<=e;--e){let n=t.concat([e]);a.push({op:r,path:n})}}function o(e,t,i,a){let{base_:o,copy_:s,type_:c}=e;dS(e.assigned_,(e,l)=>{let u=mS(o,e,c),f=mS(s,e,c),p=l?pS(o,e)?n:`add`:r;if(u===f&&p===n)return;let m=t.concat(e);i.push(p===r?{op:p,path:m}:{op:p,path:m,value:d(f)}),a.push(p===`add`?{op:r,path:m}:p===r?{op:`add`,path:m,value:d(u)}:{op:n,path:m,value:d(u)})})}function s(e,t,n,i){let{base_:a,copy_:o}=e,s=0;a.forEach(e=>{if(!o.has(e)){let a=t.concat([s]);n.push({op:r,path:a,value:e}),i.unshift({op:`add`,path:a,value:e})}s++}),s=0,o.forEach(e=>{if(!a.has(e)){let a=t.concat([s]);n.push({op:`add`,path:a,value:e}),i.unshift({op:r,path:a,value:e})}s++})}function c(e,t,r){let{patches_:i,inversePatches_:a}=r;i.push({op:n,path:[],value:t===qx?void 0:t}),a.push({op:n,path:[],value:e})}function l(e,t){return t.forEach(t=>{let{path:i,op:a}=t,o=e;for(let e=0;e<i.length-1;e++){let t=fS(o),n=i[e];typeof n!=`string`&&typeof n!=`number`&&(n=``+n),(t===0||t===1)&&(n===`__proto__`||n===eS)&&Zx(19),xS(o)&&n===tS&&Zx(19),o=mS(o,n),(o===null||!bS(o))&&Zx(18,i.join(`/`))}let s=fS(o),c=u(t.value),l=i[i.length-1];switch(a){case n:switch(s){case 2:return o.set(l,c);case 3:Zx(16);default:return o[l]=c}case`add`:switch(s){case 1:return l===`-`?o.push(c):o.splice(l,0,c);case 2:return o.set(l,c);case 3:return o.add(c);default:return o[l]=c}case r:switch(s){case 1:return o.splice(l,1);case 2:return o.delete(l);case 3:return o.delete(t.value);default:return delete o[l]}default:Zx(17,a)}}),e}function u(e){if(!sS(e))return e;if(_S(e))return e.map(u);if(vS(e))return new Map(Array.from(e.entries()).map(([e,t])=>[e,u(t)]));if(yS(e))return new Set(Array.from(e).map(u));let t=Object.create($x(e));for(let n in e)t[n]=u(e[n]);return pS(e,Jx)&&(t[Jx]=e[Jx]),t}function d(e){return oS(e)?u(e):e}RS(NS,{applyPatches_:l,generatePatches_:i,generateReplacementPatches_:c,getPath:e})}globalThis.Iterator?.from;var vC=new pC,yC=vC.produce,bC=vC.produceWithPatches.bind(vC),xC=vC.applyPatches.bind(vC),SC=1e3;function CC(e,t){if(e.add(t),e.size>SC){let t=e.values().next().value;t!==void 0&&e.delete(t)}}function wC(e){let{enablePatches:t=!1}=e;t&&_C();let n=Rx(),r=e.initialValue,i=new Set;return{on:n.on,value:()=>r,patch:(e,t=Kx())=>{i.has(t)||(_C(),r=xC(r,e),CC(i,t),n.emit(`updated`,r,void 0,t))},mutate:(e,a=Kx())=>{if(!i.has(a)){if(CC(i,a),t){let[t,i]=bC(r,e);if(t===r)return;r=t,n.emit(`updated`,r,i,a)}else{let t=yC(r,e);if(t===r)return;r=t,n.emit(`updated`,r,void 0,a)}}},syncIds:i}}var TC=typeof self==`object`?self:globalThis,EC=new Set([`Error`,`EvalError`,`RangeError`,`ReferenceError`,`SyntaxError`,`TypeError`,`URIError`,`AggregateError`]),DC=new Set([`Boolean`,`Number`,`String`,`Int8Array`,`Uint8Array`,`Uint8ClampedArray`,`Int16Array`,`Uint16Array`,`Int32Array`,`Uint32Array`,`Float16Array`,`Float32Array`,`Float64Array`,`BigInt64Array`,`BigUint64Array`]);function OC(e,t){let n=(t,n)=>(e.set(n,t),t),r=i=>{if(e.has(i))return e.get(i);let[a,o]=t[i];switch(a){case 0:case-1:return n(o,i);case 1:{let e=n([],i);for(let t of o)e.push(r(t));return e}case 2:{let e=n({},i);for(let[t,n]of o)e[r(t)]=r(n);return e}case 3:return n(new Date(o),i);case 4:{let{source:e,flags:t}=o;return n(new RegExp(e,t),i)}case 5:{let e=n(new Map,i);for(let[t,n]of o)e.set(r(t),r(n));return e}case 6:{let e=n(new Set,i);for(let t of o)e.add(r(t));return e}case 7:{let{name:e,message:t}=o,r=EC.has(e)?TC[e]:void 0;return n(new(r??TC.Error)(t),i)}case 8:return n(BigInt(o),i);case`BigInt`:return n(Object(BigInt(o)),i);case`ArrayBuffer`:return n(new Uint8Array(o).buffer,o);case`DataView`:{let{buffer:e}=new Uint8Array(o);return n(new DataView(e),o)}}if(typeof a==`string`&&DC.has(a))return n(new TC[a](o),i);throw TypeError(`unable to deserialize unsafe or unknown type: ${String(a)}`)};return r}function kC(e){return OC(new Map,e)(0)}var AC=``,{toString:jC}={},{keys:MC}=Object;function NC(e){let t=typeof e;if(t!==`object`||!e)return[0,t];let n=jC.call(e).slice(8,-1);switch(n){case`Array`:return[1,AC];case`Object`:return[2,AC];case`Date`:return[3,AC];case`RegExp`:return[4,AC];case`Map`:return[5,AC];case`Set`:return[6,AC];case`DataView`:return[1,n]}return n.includes(`Array`)?[1,n]:n.includes(`Error`)?[7,n]:[2,n]}function PC([e,t]){return e===0&&(t===`function`||t===`symbol`)}function FC(e,t,n,r){let i=(e,t)=>{let i=r.push(e)-1;return n.set(t,i),i},a=r=>{if(n.has(r))return n.get(r);let[o,s]=NC(r);switch(o){case 0:{let t=r;switch(s){case`bigint`:o=8,t=r.toString();break;case`function`:case`symbol`:if(e)throw TypeError(`unable to serialize ${s}`);t=null;break;case`undefined`:return i([-1],r)}return i([o,t],r)}case 1:{if(s){let e=r;return s===`DataView`?e=new Uint8Array(r.buffer):s===`ArrayBuffer`&&(e=new Uint8Array(r)),i([s,[...e]],r)}let e=[],t=i([o,e],r);for(let t of r)e.push(a(t));return t}case 2:{if(s)switch(s){case`BigInt`:return i([s,r.toString()],r);case`Boolean`:case`Number`:case`String`:return i([s,r.valueOf()],r)}if(t&&`toJSON`in r)return a(r.toJSON());let n=[],c=i([o,n],r);for(let t of MC(r))(e||!PC(NC(r[t])))&&n.push([a(t),a(r[t])]);return c}case 3:return i([o,r.toISOString()],r);case 4:{let{source:e,flags:t}=r;return i([o,{source:e,flags:t}],r)}case 5:{let t=[],n=i([o,t],r);for(let[n,i]of r)(e||!(PC(NC(n))||PC(NC(i))))&&t.push([a(n),a(i)]);return n}case 6:{let t=[],n=i([o,t],r);for(let n of r)(e||!PC(NC(n)))&&t.push(a(n));return n}}let{message:c}=r;return i([o,{name:s,message:c}],r)};return a}function IC(e,t={}){let n=[];return FC(!(t.json||t.lossy),!!t.json,new Map,n)(e),n}var{parse:LC,stringify:RC}=JSON,zC={json:!0,lossy:!0};function BC(e){return kC(LC(e))}function VC(e){return RC(IC(e,zC))}function HC(e){return kC(e)}function UC(e){return VC(e)}function WC(e){return BC(e)}var GC=256,KC=class extends Error{name=`StreamClosedError`};function qC(e={}){let t=e.id??Kx(),n=Math.max(0,e.replayWindow??0),r=Rx(),i=new AbortController,a=[],o=!1,s=0;function c(e){if(o)throw new KC(`Cannot write to a closed stream "${t}"`);s+=1,n>0&&(a.push({seq:s,chunk:e}),a.length>n&&(a.length-n===1?a.shift():a.splice(0,a.length-n))),r.emit(`chunk`,s,e)}function l(e){if(o)return;o=!0;let t=YC(e);i.abort(e),r.emit(`end`,t)}function u(){o||(o=!0,i.signal.aborted||i.abort(`stream closed`),r.emit(`end`,void 0))}function d(e){o||i.signal.aborted||i.abort(e??`aborted`)}let f=new WritableStream({write(e){c(e)},close(){u()},abort(e){l(e)}});return{id:t,signal:i.signal,get closed(){return o},get lastSeq(){return s},write:c,error:l,close:u,abort:d,writable:f,events:r,buffer:a}}function JC(e={}){let t=e.id??Kx(),n=Math.max(1,e.highWaterMark??GC),r=[],i=0,a=!1,o=!1,s,c,l,u;function d(){if(c){if(r.length>0){let e=r.shift(),t=c;c=void 0,t.resolve({value:e,done:!1});return}if(a){let e=c;if(c=void 0,s){let t=Error(s.message);t.name=s.name,e.reject(t)}else e.resolve({value:void 0,done:!0})}}}function f(){if(l){for(;r.length>0;){let e=r.shift();try{l.enqueue(e)}catch{break}}if(a&&l){try{if(s){let e=Error(s.message);e.name=s.name,l.error(e)}else l.close()}catch{}l=void 0}}}function p(t,s){if(!(a||o)&&!(t<=i)){if(i=t,r.push(s),r.length>n){let t=r.length-n;r.splice(0,t),e.onOverflow?.(t)}d(),u&&f()}}function m(e){a||(a=!0,s=e,d(),u&&f())}function h(){o||a||(o=!0,e.onCancel?.(),m(void 0))}function g(){return u||(u=new ReadableStream({start(e){l=e,f()},cancel(){h()}}),u)}return{id:t,get cancelled(){return o},get done(){return a},get lastSeenSeq(){return i},get readable(){return g()},cancel:h,_push:p,_end:m,[Symbol.asyncIterator](){return{next(){if(r.length>0)return Promise.resolve({value:r.shift(),done:!1});if(a){if(s){let e=Error(s.message);return e.name=s.name,Promise.reject(e)}return Promise.resolve({value:void 0,done:!0})}return new Promise((e,t)=>{c={resolve:e,reject:t}})},return(){return h(),Promise.resolve({value:void 0,done:!0})}}}}}function YC(e){if(e instanceof Error)return{name:e.name||`Error`,message:e.message};if(typeof e==`string`)return{name:`Error`,message:e};try{return{name:`Error`,message:JSON.stringify(e)}}catch{return{name:`Error`,message:String(e)}}}var XC=128;function ZC(e){return e.replace(/[^\w-]+/g,`_`).slice(0,XC)}var QC=`modulepreload`,$C=function(e,t){return new URL(e,t).href},ew={},tw=function(e,t,n){let r=Promise.resolve();if(t&&t.length>0){let e=document.getElementsByTagName(`link`),i=document.querySelector(`meta[property=csp-nonce]`),a=i?.nonce||i?.getAttribute(`nonce`);function o(e){return Promise.all(e.map(e=>Promise.resolve(e).then(e=>({status:`fulfilled`,value:e}),e=>({status:`rejected`,reason:e}))))}function s(e){return import.meta.resolve?import.meta.resolve(e):new URL(e,import.meta.url).href}r=o(t.map(t=>{if(t=$C(t,n),t=s(t),t in ew)return;ew[t]=!0;let r=t.endsWith(`.css`);for(let n=e.length-1;n>=0;n--){let i=e[n];if(i.href===t&&(!r||i.rel===`stylesheet`))return}let i=document.createElement(`link`);if(i.rel=r?`stylesheet`:QC,r||(i.as=`script`),i.crossOrigin=``,i.href=t,a&&i.setAttribute(`nonce`,a),document.head.appendChild(i),r)return new Promise((e,n)=>{i.addEventListener(`load`,e),i.addEventListener(`error`,()=>n(Error(`Unable to preload CSS for ${t}`)))})}).filter(e=>e!==void 0))}function i(e){let t=new Event(`vite:preloadError`,{cancelable:!0});if(t.payload=e,window.dispatchEvent(t),!t.defaultPrevented)throw e}return r.then(t=>{for(let e of t||[])e.status===`rejected`&&i(e.reason);return e().catch(i)})},nw=`__connection.json`,rw=`__DEVFRAME_CONNECTION__`,iw=`x-birpc-session`,aw=`__rpc-dump/index.json`,ow=`devframe:services`,sw=`devframe_otp`,cw=`devframe_auth_token`;ix.postMessage.remoteAssetsError;var lw=class{cacheMap=new Map;options;keySerializer;constructor(e){this.options=e,this.keySerializer=e.keySerializer||(e=>Lx(e))}updateOptions(e){this.options={...this.options,...e}}cached(e,t){let n=this.cacheMap.get(e);if(n)return n.get(this.keySerializer(t))}has(e,t){return this.cacheMap.get(e)?.has(this.keySerializer(t))??!1}apply(e,t){let n=this.cacheMap.get(e.m)||new Map;n.set(this.keySerializer(e.a),t),this.cacheMap.set(e.m,n)}validate(e){return this.options.functions.includes(e)}clear(e){e?this.cacheMap.delete(e):this.cacheMap.clear()}},uw=sx({docsBase:`https://devfra.me/errors`,codes:{DF0019:{why:e=>`RPC function "${e.name}" has \`agent\` set but \`jsonSerializable\` is \`false\`; MCP requires JSON-serializable data.`,fix:"Remove `jsonSerializable: false`, or remove `agent` to keep it RPC-only."},DF0020:{why:e=>`RPC function "${e.name}" declares \`jsonSerializable: true\` but the value at "${e.path}" is a ${e.type}.`,fix:"Either drop `jsonSerializable: true` (falls back to structured-clone) or change the value to a JSON-safe shape."},DF0021:{why:e=>`RPC function "${e.name}" is already registered`,fix:"Use the `force` parameter to overwrite an existing registration."},DF0022:{why:e=>`RPC function "${e.name}" is not registered. Use register() to add new functions.`},DF0023:{why:e=>`RPC function "${e.name}" is not registered`},DF0024:{why:e=>`Either handler or setup function must be provided for RPC function "${e.name}"`},DF0025:{why:e=>`Function "${e.name}" not found in dump store`},DF0026:{why:e=>`No dump match for "${e.name}" with args: ${e.args}`},DF0027:{why:e=>`Function "${e.name}" with type "${e.type}" cannot have dump configuration. Only "static" and "query" types support dumps.`},DF0028:{why:e=>`Function "${e.name}" with type "${e.type}" cannot use \`snapshot: true\`. Only "query" functions support this sugar; "static" functions have equivalent default behavior already.`,fix:"Remove `snapshot: true`, or change the function type to `query`."},DF0043:{why:e=>`RPC function "${e.name}" received an invalid argument at position ${e.index}: ${e.issues}`,fix:"Pass a value that satisfies the `args` schema declared for this function."},DF0044:{why:e=>`RPC function "${e.name}" returned a value that failed its \`returns\` schema: ${e.issues}`,fix:"Make the handler return a value that satisfies the `returns` schema, or relax the schema."}}});function dw(e){if(e.agent&&e.jsonSerializable===!1)throw uw.DF0019({name:e.name});e.agent&&!e.jsonSerializable&&(e.jsonSerializable=!0)}async function fw(e,t){let n=e[`~standard`].validate(t);return n instanceof Promise?await n:n}function pw(e){return e.map(e=>{let t=e.path?.map(e=>typeof e==`object`?e.key:e).join(`.`);return t?`${t}: ${e.message}`:e.message}).join(`; `)}async function mw(e,t,n){let r=n.slice();if(!t||t.length===0)return r;for(let r=0;r<t.length;r++){let i=t[r];if(!i)continue;let a=await fw(i,n[r]);if(a.issues)throw uw.DF0043({name:e,index:r,issues:pw(a.issues)})}return r}async function hw(e,t,n){if(!t)return n;let r=await fw(t,n);if(r.issues)throw uw.DF0044({name:e,issues:pw(r.issues)});return n}async function gw(e,t){if(!e.setup)return{};if(typeof t==`object`&&t){e.__cache??=new WeakMap;let n=e.__cache,r=n.get(t);return r||(r=Promise.resolve(e.setup(t)),r.catch(()=>{n.get(t)===r&&n.delete(t)}),n.set(t,r)),await r}if(!e.__promise){let n=Promise.resolve(e.setup(t));n.catch(()=>{e.__promise===n&&(e.__promise=void 0)}),e.__promise=n}return await e.__promise}async function _w(e,t){let n=e.handler;if(!n){let r=await gw(e,t);if(!r.handler)throw uw.DF0024({name:e.name});n=r.handler}let r=e.args,i=e.returns;if(!r&&!i)return n;let a=n;return async(...t)=>{let n=await mw(e.name,r,t),o=await a(...n);return await hw(e.name,i,o)}}var vw=class{context;definitions=new Map;functions;_onChanged=[];constructor(e){this.context=e;let t=this.definitions,n=this;this.functions=new Proxy({},{get(e,r){let i=t.get(r);if(i)return _w(i,n.context)},has(e,n){return t.has(n)},getOwnPropertyDescriptor(e,n){return{value:t.get(n)?.handler,configurable:!0,enumerable:!0}},ownKeys(){return Array.from(t.keys())}})}register(e,t=!1){if(this.definitions.has(e.name)&&!t)throw uw.DF0021({name:e.name});dw(e),this.definitions.set(e.name,e),this._onChanged.forEach(t=>t(e.name))}update(e,t=!1){if(!this.definitions.has(e.name)&&!t)throw uw.DF0022({name:e.name});dw(e),this.definitions.set(e.name,e),this._onChanged.forEach(t=>t(e.name))}onChanged(e){return this._onChanged.push(e),()=>{let t=this._onChanged.indexOf(e);t!==-1&&this._onChanged.splice(t,1)}}async getHandler(e){return await _w(this.definitions.get(e),this.context)}getSchema(e){let t=this.definitions.get(e);if(!t)throw uw.DF0023({name:String(e)});return{args:t.args,returns:t.returns}}has(e){return this.definitions.has(e)}get(e){return this.definitions.get(e)}list(){return Array.from(this.definitions.keys())}};function yw(e,t=``){return JSON.stringify(e,function(e,n){let r=this,i=r==null?n:r[e];if(i===void 0){if(Array.isArray(r))throw xw(t,`undefined`,r,e);return n}return i!==null&&bw(i,r,e,t),n})}function bw(e,t,n,r){if(typeof e==`bigint`)throw xw(r,`BigInt`,t,n);if(typeof e!=`object`)return;if(e instanceof Map)throw xw(r,`Map`,t,n);if(e instanceof Set)throw xw(r,`Set`,t,n);if(e instanceof Date)throw xw(r,`Date`,t,n);if(Array.isArray(e))return;let i=Object.getPrototypeOf(e);if(i!==null&&i!==Object.prototype)throw xw(r,e.constructor?.name??`class instance`,t,n)}function xw(e,t,n,r){let i=Sw(n,r);return uw.DF0020({name:e||`<anonymous>`,type:t,path:i})}function Sw(e,t){return Array.isArray(e)?`[${t}]`:t===``?`<root>`:t}var Cw=`__DEVFRAME_CONNECTION_META__`,ww=`__DEVFRAME_CONNECTION_AUTH_TOKEN__`;function Tw(e){let t=[()=>window?.[e],()=>globalThis?.[e],()=>parent.window?.[e]];for(let e of t)try{let t=e();if(t)return t}catch{}}function Ew(){return Tw(rw)}function Dw(){return Tw(Cw)}function Ow(e){if(e)return e;try{let e=localStorage.getItem(ww);if(e)return e}catch{}return Tw(ww)}function kw(e){globalThis[rw]=e,globalThis[Cw]={...e.connectionMeta,baseUrl:e.metaBaseUrl},e.authToken&&Aw(e.authToken)}function Aw(e){try{localStorage.setItem(ww,e)}catch{}globalThis[ww]=e;let t=Ew();t&&(globalThis[rw]={...t,authToken:e})}function jw(e){let t=Ux(nw,e);try{return new URL(t,globalThis.location?.href).href}catch{return t}}function Mw(e,t){return t&&t!==e.authToken?{...e,authToken:t}:e}function Nw(){let e=Ew();if(e)return Mw(e,Ow()??e.authToken??e.connectionMeta.authToken);let t=Dw();if(t)return{connectionMeta:t,metaBaseUrl:t.baseUrl??jw(`./`),authToken:Ow(t.authToken)}}async function Pw(e={}){if(e.connection){let t=Mw(e.connection,Ow(e.authToken??e.connection.authToken??e.connection.connectionMeta.authToken));return kw(t),t}let t=Array.isArray(e.baseURL)?e.baseURL:[e.baseURL??`./`];if(e.connectionMeta){let n={connectionMeta:e.connectionMeta,metaBaseUrl:jw(t[0]??`./`),authToken:Ow(e.authToken??e.connectionMeta.authToken)};return kw(n),n}let n=Nw();if(n){let t=Mw(n,Ow(e.authToken??n.authToken??n.connectionMeta.authToken));return kw(t),t}let r=[];for(let n of t){let t=Ux(nw,n),i=jw(n);try{let n=await fetch(t);if(!n.ok)throw Error(`Failed to fetch connection meta from ${i}: ${n.status}`);let r=await n.json(),a=n.url||i,o={connectionMeta:r,metaBaseUrl:r.baseUrl?new URL(r.baseUrl,a).href:a,authToken:Ow(e.authToken??r.authToken)};return kw(o),o}catch(e){r.push(e)}}throw Error(`Failed to get connection meta from ${t.join(`, `)}`,{cause:r})}var Fw=class extends Error{name=`DevframeConnectionError`;kind;constructor(e,t,n){super(t,n),this.kind=e}};function Iw(e=sw){try{let t=globalThis.location?.hash?.replace(/^#/,``)??``;return new URLSearchParams(t).get(e)||void 0}catch{return}}function Lw(e){try{let t=new URL(globalThis.location.href),n=new URLSearchParams(t.hash.replace(/^#/,``));if(!n.has(e))return;n.delete(e),t.hash=n.toString(),globalThis.history?.replaceState(globalThis.history.state,``,t.href)}catch{}}function Rw(e=sw){let t=Iw(e);return t&&Lw(e),t}async function zw(e,t={}){let n=Rw(t.param??`devframe_otp`);return n?e.isTrusted?!0:e.requestTrustWithCode(n):!1}function Bw(e){let t={},n=new WeakMap,r,i=()=>(r??=e.sharedState.get(ow,{initialValue:{}}).then(e=>(t=e.value(),e.on(`updated`,e=>{t=e}),e)),r);return i(),{state:i,has:e=>e in t,keys:()=>Object.keys(t),get:r=>{let i=t[r];if(!i)return;let a=n.get(i);return a||(a={...i,rpc:e.scope(i.scope).rpc},n.set(i,a)),a}}}function Vw(e){let t=new Map,n=new Map,r=new Map,i=new Set,a=e.connectionMeta.backend===`static`;function o(e,t){let n=r.get(e);return n&&typeof n==`object`&&!Array.isArray(n)&&typeof t==`object`&&!Array.isArray(t)?{...n,...t}:t}e.client.register({name:ix.broadcast.clientStateUpdated,type:`event`,handler:(e,n,r)=>{let i=t.get(e);i&&!i.syncIds.has(r)&&i.mutate(()=>o(e,n),r)}}),e.client.register({name:ix.broadcast.clientStatePatch,type:`event`,handler:(e,n,r)=>{let i=t.get(e);i&&!i.syncIds.has(r)&&i.patch(n,r)}});function s(t,n){let r=[];return r.push(n.on(`updated`,(n,r,i)=>{a||(r?e.callEvent(`devframe:rpc:server-state:patch`,t,r,i):e.callEvent(`devframe:rpc:server-state:set`,t,n,i))})),()=>{for(let e of r)e()}}return{keys:()=>Array.from(t.keys()),onKeyAdded(e){return i.add(e),()=>{i.delete(e)}},delete(e){let i=n.get(e);n.delete(e);let a=t.delete(e);return r.delete(e),i?.(),a},get:async(c,l)=>{if(l?.initialValue!==void 0&&r.set(c,l.initialValue),t.has(c))return t.get(c);let u=wC({initialValue:l?.initialValue,enablePatches:!1});async function d(){if(a||e.callEvent(`devframe:rpc:server-state:subscribe`,c),l?.initialValue!==void 0){t.set(c,u);for(let e of i)e(c);return e.call(`devframe:rpc:server-state:get`,c).then(e=>{e!==void 0&&u.mutate(()=>o(c,e))}).catch(e=>{console.error(`Error getting server state`,e)}),n.set(c,s(c,u)),u}{let r=await e.call(`devframe:rpc:server-state:get`,c);u.mutate(()=>o(c,r)),t.set(c,u);for(let e of i)e(c);return n.set(c,s(c,u)),u}}return new Promise(t=>{if(e.isTrusted)d().then(t);else{t(u);let n=!1;e.events.on(ix.client.isTrustedUpdated,e=>{e&&!n&&(n=!0,d())})}})}}}var Hw=new Map;function Uw(e=Hw){let t=new Map;return{serialize:n=>{let r;return n.t===`q`?r=n.m:(r=t.get(n.i),t.delete(n.i)),!(n.t===`s`&&`e`in n)&&r&&e.get(r)?.jsonSerializable===!0?yw(n,r??``):`s:${UC(n)}`},deserialize:e=>{let n=e.startsWith(`s:`)?WC(e.slice(2)):JSON.parse(e);return n.t===`q`&&n.i&&n.m&&t.set(n.i,n.m),n}}}function Ww(){}function Gw(e){let t=e.search(/\n\n|\r\n\r\n/);if(!(t<0))return{frame:e.slice(0,t),rest:e.slice(t+(e[t]===`\r`?4:2))}}function Kw(e){let t=`message`,n=[];for(let r of e.split(/\r?\n/))r.startsWith(`:`)||(r.startsWith(`event:`)?t=r.slice(6).trimStart():r.startsWith(`data:`)&&n.push(r.slice(5).replace(/^ /,``)));return{event:t,data:n}}function qw(e){let{onConnected:t=Ww,onError:n=Ww,onDisconnected:r=Ww,definitions:i,fetch:a=globalThis.fetch.bind(globalThis)}=e,o=e.url;e.authToken&&(o=`${o}${o.includes(`?`)?`&`:`?`}${cw}=${encodeURIComponent(e.authToken)}`);let s=Uw(i),c=new AbortController,l=!1,u,d,f,p,m=new Promise((e,t)=>{f=e,p=t});m.catch(()=>{});function h(e){l||(l=!0,p(e),n(e),r())}function g(){l||(l=!0,p(Error(`Devframe SSE stream closed`)),r())}function _(e,n){if(e===`session`){f(n),t();return}u?.(n)}async function ee(e){let t=e.getReader();d=t;let n=new TextDecoder,r=``;for(;;){let{done:e,value:i}=await t.read();if(e)break;for(r+=n.decode(i,{stream:!0});;){let e=Gw(r);if(!e)break;r=e.rest;let{event:t,data:n}=Kw(e.frame);n.length>0&&_(t,n.join(`
`))}}g()}return(async()=>{try{let e=await a(o,{headers:{accept:`text/event-stream`},signal:c.signal});if(!e.ok||!e.body)throw Error(`Devframe SSE stream request failed: ${e.status}`);await ee(e.body)}catch(e){if(c.signal.aborted){g();return}h(e instanceof Error?e:Error(String(e)))}})(),{close:()=>{l=!0,c.abort(),d?.cancel().catch(()=>{})},on:e=>{u=e},post:async e=>{let t;try{t=await m}catch{return}if(l){n(Error(`Devframe SSE channel is closed; message dropped`));return}try{let n=await a(o,{method:`POST`,headers:{"content-type":`text/plain; charset=utf-8`,[iw]:t},body:e});if(n.status===200){let e=await n.text();e&&u?.(e);return}if(!n.ok)throw Error(`Devframe SSE POST failed: ${n.status}`)}catch(e){n(e instanceof Error?e:Error(String(e)))}},serialize:s.serialize,deserialize:s.deserialize}}function Jw(e,t){let{channel:n,rpcOptions:r={}}=t;return _x(e,{...n,timeout:-1,...r,proxify:!1})}function Yw(e){let{transport:t,authToken:n,connectionMeta:r,events:i,clientRpc:a,rpcOptions:o={},callTimeout:s=0}=e,c=!1,l=`connecting`,u=null,d=Promise.withResolvers();function f(e,t=null){if(t?u=t:e===`connected`&&(u=null),e===l)return;let n=l;l=e,i.emit(ix.client.connectionStatus,e,n)}let p=new Set;function m(e){for(let t of[...p])t.reject(e)}function h(){return l===`disconnected`||l===`error`?new Fw(`connection`,`[devframe] Not connected to the devframe server`,{cause:u??void 0}):l===`unauthorized`?new Fw(`auth`,`[devframe] Not authorized by the devframe server`,{cause:u??void 0}):null}function g(e,t){return new Promise((n,r)=>{let a=!1,o,c={reject(e){a||(l(),i.emit(ix.client.error,e,t),r(e))}};function l(){a=!0,p.delete(c),o&&clearTimeout(o)}p.add(c),s>0&&(o=setTimeout(()=>{c.reject(new Fw(`timeout`,`[devframe] RPC call "${t}" timed out after ${s}ms`))},s)),e.then(e=>{a||(l(),n(e))},e=>{if(a)return;l();let n=e instanceof Error?e:Error(String(e));i.emit(ix.client.error,n,t),r(n)})})}let _=new Map;for(let e of r.jsonSerializableMethods??[])_.set(e,{jsonSerializable:!0});let ee=e.createChannel({definitions:_,onError(e){f(`error`,e),i.emit(ix.client.connectionError,e),m(new Fw(`connection`,`[devframe] Connection to the devframe server failed`,{cause:e}))},onDisconnected(){l!==`error`&&f(`disconnected`),m(new Fw(`connection`,`[devframe] Disconnected from the devframe server`,{cause:u??void 0}))}}),v=Jw(a.functions,{channel:ee,rpcOptions:o});a.register({name:ix.broadcast.authRevoked,type:`event`,handler:()=>{c=!1;let e=new Fw(`auth`,`[devframe] The devframe server revoked this client's trust`);f(`unauthorized`,e),i.emit(ix.client.connectionError,e),m(e),i.emit(ix.client.isTrustedUpdated,!1)}});let te=n;async function ne(e){te=e;let t=await v.$call(`anonymous:devframe:auth`,{authToken:e,ua:navigator.userAgent,origin:location.origin});if(c=t.isTrusted,c)d.resolve(!0),f(`connected`);else{let e=new Fw(`auth`,`[devframe] The devframe server refused this client's credentials`);f(`unauthorized`,e),i.emit(ix.client.connectionError,e)}return i.emit(ix.client.isTrustedUpdated,c),t.isTrusted}async function re(e){let t=(await v.$call(`anonymous:devframe:auth:exchange`,{code:e,ua:navigator.userAgent,origin:location.origin}))?.authToken??null;return t&&(te=t,c=!0,d.resolve(!0),f(`connected`),i.emit(ix.client.isTrustedUpdated,!0)),t}async function ie(e={}){await v.$call(`anonymous:devframe:auth:request-code`,{ua:navigator.userAgent,origin:location.origin,...e.reissue?{reissue:!0}:{}})}async function ae(){return c?!0:ne(te??``)}async function oe(e=6e4){if(c&&d.resolve(!0),e<=0)return d.promise;let t;try{return await Promise.race([d.promise,new Promise((n,r)=>{t=setTimeout(()=>{r(Error(`[devframe] Timeout waiting for rpc to be trusted`))},e)})]),c}finally{clearTimeout(t)}}return{transport:t,get isTrusted(){return c},get status(){return l},get connectionError(){return u},requestTrust:ae,requestTrustWithToken:ne,requestTrustWithCode:re,requestAuthCode:ie,ensureTrusted:oe,call:(...e)=>{let t=String(e[0]),n=h();return n?(i.emit(ix.client.error,n,t),Promise.reject(n)):g(v.$call(...e),t)},callEvent:(...e)=>{let t=h();if(t){i.emit(ix.client.error,t,String(e[0]));return}return v.$callEvent(...e)},callOptional:(...e)=>{let t=String(e[0]),n=h();return n?(i.emit(ix.client.error,n,t),Promise.reject(n)):g(v.$callOptional(...e),t)},close:()=>{ee.close()}}}function Xw(e,t,n){let r=(()=>{try{return new URL(t,n.href)}catch{return new URL(n.href)}})();if(e&&typeof e==`object`){if(e.host!=null||e.port!=null){let t=e.host??`${r.hostname}:${e.port}`;return new URL(e.path??`/`,`${r.protocol}//${t}`).href}return new URL(e.path??``,r).href}let i=e??``;return/^https?:\/\//i.test(i)?i:new URL(i,r).href}function Zw(e){let{authToken:t,connectionMeta:n,metaBaseUrl:r,events:i,clientRpc:a,rpcOptions:o={},sseOptions:s={},callTimeout:c=0}=e,l=Xw(n.sse,r??`./`,location);return Yw({transport:`sse`,authToken:t,connectionMeta:n,events:i,clientRpc:a,rpcOptions:o,callTimeout:c,createChannel:e=>qw({url:l,authToken:t,definitions:e.definitions,...s,onConnected(){s.onConnected?.()},onError(t){e.onError(t),s.onError?.(t)},onDisconnected(){e.onDisconnected(),s.onDisconnected?.()}})})}function Qw(e){let{name:t,message:n,cause:r,...i}=e,a=r instanceof Error?r:$w(r)?Qw(r):r,o=a===void 0?Error(n):Error(n,{cause:a});return o.name=t,Object.assign(o,i),o}function $w(e){return typeof e==`object`&&!!e&&typeof e.message==`string`&&typeof e.name==`string`}function eT(e){return typeof e==`object`&&!!e&&e.type===`static`&&typeof e.path==`string`}function tT(e){return typeof e==`object`&&!!e&&e.type===`query`&&typeof e.records==`object`&&e.records!==null}function nT(e){return typeof e==`object`&&!!e&&(`output`in e||`error`in e)}function rT(e){if(e.error)throw Qw(e.error);return e.output}function iT(e){return e.some(e=>e!=null)}function aT(e){return typeof e==`object`&&e&&`serialization`in e&&`data`in e?e.data:e}function oT(e,t){let n=new Map,r=new Map;function i(e,t){return t===`structured-clone`&&Array.isArray(e)?HC(e):e}function a(e,t){return i(aT(e),t)}async function o(e){n.has(e.path)||n.set(e.path,t(e.path).then(t=>a(t,e.serialization)));let r=await n.get(e.path);return nT(r)?rT(r):r}async function s(e,n){return r.has(e)||r.set(e,t(e).then(e=>a(e,n))),await r.get(e)}async function c(t,n){if(!(t in e))throw Error(`[devframe-rpc] Function "${t}" not found in dump store`);let r=e[t];if(eT(r)){if(iT(n))throw Error(`[devframe-rpc] No dump match for "${t}" with args: ${JSON.stringify(n)}`);return await o(r)}if(tT(r)){let e=Lx(n),i=r.records[e];if(i)return rT(await s(i,r.serialization));if(r.fallback)return rT(await s(r.fallback,r.serialization));throw Error(`[devframe-rpc] No dump match for "${t}" with args: ${JSON.stringify(n)}`)}if(!iT(n))return r;throw Error(`[devframe-rpc] No dump match for "${t}" with args: ${JSON.stringify(n)}`)}return{call:async(e,t)=>await c(e,t),callOptional:async(t,n)=>{if(t in e)return await c(t,n)},callEvent:async(e,t)=>{}}}async function sT(e){let t=oT(await e.fetchJsonFromBases(aw),e.fetchJsonFromBases);return{transport:`static`,isTrusted:!0,status:`connected`,connectionError:null,requestTrust:async()=>!0,requestTrustWithToken:async()=>!0,requestTrustWithCode:async()=>null,requestAuthCode:async()=>{},ensureTrusted:async()=>!0,call:(...e)=>t.call(e[0],e.slice(1)),callEvent:(...e)=>t.callEvent(e[0],e.slice(1)),callOptional:(...e)=>t.callOptional(e[0],e.slice(1)),close:()=>{}}}var cT=``;function lT(e,t){return`${e}${cT}${t}`}function uT(e){let t=new Map,n=new Map;e.client.register({name:ix.broadcast.streamingChunk,type:`event`,handler(e,n,r,i){t.get(lT(e,n))?._push(r,i)}}),e.client.register({name:ix.broadcast.streamingEnd,type:`event`,handler(e,n,r){let i=lT(e,n),a=t.get(i);a&&(a._end(r),t.delete(i))}}),e.client.register({name:ix.broadcast.streamingUploadCancel,type:`event`,handler(e,t){let r=lT(e,t),i=n.get(r);i&&(i.abort(`server cancelled upload`),n.delete(r))}}),e.events.on(ix.client.isTrustedUpdated,n=>{if(n)for(let[n,r]of t){if(r.cancelled||r.done)continue;let t=n.indexOf(cT);if(t<0)continue;let i=n.slice(0,t),a=n.slice(t+1);e.callEvent(`devframe:streaming:subscribe`,i,a,{afterSeq:r.lastSeenSeq})}});function r(n,r,i={}){let a=lT(n,r),o=t.get(a);if(o)return o;let s=JC({id:r,highWaterMark:i.highWaterMark,onOverflow(e){console.warn(`[devframe] DF0029: Stream "${n}#${r}" dropped ${e} chunk(s) after exceeding the client high-water mark.`)},onCancel(){e.callEvent(`devframe:streaming:cancel`,n,r),t.delete(a)}});if(t.set(a,s),e.isTrusted)e.callEvent(`devframe:streaming:subscribe`,n,r,{afterSeq:0});else{let i=e.events.on(ix.client.isTrustedUpdated,o=>{o&&(i(),t.has(a)&&!s.cancelled&&!s.done&&e.callEvent(`devframe:streaming:subscribe`,n,r,{afterSeq:s.lastSeenSeq}))})}return s}function i(t,r){let i=lT(t,r),a=n.get(i);if(a)return a;let o=qC({id:r});return o.events.on(`chunk`,(n,i)=>{e.callEvent(`devframe:streaming:upload-chunk`,t,r,n,i)}),o.events.on(`end`,a=>{e.callEvent(`devframe:streaming:upload-end`,t,r,a),n.delete(i)}),n.set(i,o),o}return{subscribe:r,upload:i}}function dT(){}var fT=new Map;function pT(e){let t=e.url;e.authToken&&(t=`${t}?${cw}=${encodeURIComponent(e.authToken)}`);let n=new WebSocket(t),{onConnected:r=dT,onError:i=dT,onDisconnected:a=dT,definitions:o=fT}=e;n.addEventListener(`open`,e=>{r(e)}),n.addEventListener(`error`,e=>{let t=e instanceof Error?e:Error(e.type);i(t)}),n.addEventListener(`close`,e=>{a(e)});let s=Uw(o);return{close:()=>{n.close()},on:e=>{n.addEventListener(`message`,t=>{e(t.data)})},post:e=>{if(n.readyState===WebSocket.OPEN){n.send(e);return}if(n.readyState===WebSocket.CONNECTING){let t=()=>{i(),n.readyState===WebSocket.OPEN&&n.send(e)},r=()=>i();function i(){n.removeEventListener(`open`,t),n.removeEventListener(`close`,r)}n.addEventListener(`open`,t),n.addEventListener(`close`,r);return}i(Error(`Devframe WebSocket is not open; message dropped`))},serialize:s.serialize,deserialize:s.deserialize}}function mT(e,t,n){let r=(()=>{try{return new URL(t,n.href)}catch{return new URL(n.href)}})(),i=r.protocol===`https:`?`wss:`:`ws:`;if(e&&typeof e==`object`){if(e.host!=null||e.port!=null){let t=e.host??`${r.hostname}:${e.port}`,n=new URL(e.path??`/`,`${i}//${t}`);return n.protocol=i,n.href}let t=new URL(e.path??``,r);return t.protocol=i,t.href}if(typeof e==`number`)return`${i}//${r.hostname}:${e}`;let a=e??``;if(/^wss?:\/\//i.test(a))return a;if(/^https?:\/\//i.test(a))return Wx(a,/^https/i.test(a)?`wss://`:`ws://`);let o=new URL(a,r);return o.protocol=i,o.href}function hT(e){let{authToken:t,connectionMeta:n,metaBaseUrl:r,events:i,clientRpc:a,rpcOptions:o={},wsOptions:s={},callTimeout:c=0}=e,l=mT(n.websocket,r??`./`,location);return Yw({transport:`websocket`,authToken:t,connectionMeta:n,events:i,clientRpc:a,rpcOptions:o,callTimeout:c,createChannel:e=>pT({url:l,authToken:t,definitions:e.definitions,...s,onConnected(e){s.onConnected?.(e)},onError(t){e.onError(t),s.onError?.(t)},onDisconnected(t){e.onDisconnected(),s.onDisconnected?.(t)}})})}function gT(e){return e.includes(`:`)}function _T(e,t){return gT(t)?t:`${e}:${t}`}function vT(e){return{async get(t){return(await e()).value()[t]},async set(t,n){(await e()).mutate(e=>{e[t]=n})},async delete(t){(await e()).mutate(e=>{delete e[t]})},async all(){return(await e()).value()},async onChange(t){return(await e()).on(`updated`,e=>t(e))}}}function yT(e,t,n){let r=`devframe:settings:${n}:${t}`,i;function a(){return i||=e.sharedState.get(r,{initialValue:{}}),i}return vT(a)}function bT(e,t){return{global:yT(e,t,`global`),project:yT(e,t,`project`)}}function xT(e,t){return{namespace:t,base:e,rpc:{namespace:t,register(n){if(gT(n.name))throw Error(`[devframe] Scoped client RPC registration for namespace "${t}" received an already-namespaced function name "${n.name}". Pass a bare name without a ":" separator.`);e.client.register({...n,name:`${t}:${n.name}`})},call:((n,...r)=>e.call(_T(t,n),...r)),callEvent:((n,...r)=>e.callEvent(_T(t,n),...r)),callOptional:((n,...r)=>e.callOptional(_T(t,n),...r)),sharedState:((n,r)=>e.sharedState.get(_T(t,n),r)),streaming:{subscribe:(n,r,i)=>e.streaming.subscribe(_T(t,n),r,i),upload:(n,r)=>e.streaming.upload(_T(t,n),r)}},settings:bT(e,t),scope:e.scope}}function ST(){if(typeof document<`u`){let e=document.modelContext;if(e)return e}if(typeof navigator<`u`){let e=navigator.modelContext;if(e)return e}}function CT(e,t={}){let n=t.modelContext??ST();if(!n)return()=>{};let r=n,i=new Map,a=new Map;function o(t,n){let o=ZC(t.name),s=a.get(o);if(s&&s!==t.name){console.warn(`[devframe] WebMCP tool name "${o}" (from "${t.name}") collides with "${s}"; keeping the first registration.`);return}let c=new AbortController,l=vx(t.type,n),u=r.registerTool({name:o,description:n.description,inputSchema:xx(t.args),annotations:{title:n.title??t.name,readOnlyHint:l===`read`,destructiveHint:l===`destructive`},execute:n=>wT(t,e.context,n)},{signal:c.signal});u&&`then`in u&&u.then(()=>{},()=>{}),a.set(o,t.name),i.set(t.name,()=>{c.abort(),u&&`unregister`in u&&typeof u.unregister==`function`&&u.unregister(),a.delete(o)})}function s(t){let n=t?[t]:[...e.definitions.keys()];for(let t of n){i.get(t)?.(),i.delete(t);let n=e.definitions.get(t),r=n?.agent;n&&r&&o(n,r)}}s();let c=e.onChanged(e=>s(e));return()=>{c();for(let e of i.values())e();i.clear()}}async function wT(e,t,n){try{let r=Cx(n,e.args?.length);return{content:[{type:`text`,text:TT(await(await _w(e,t))(...r))}]}}catch(e){return{isError:!0,content:[{type:`text`,text:ET(e)}]}}}function TT(e){return e===void 0?`undefined`:typeof e==`string`?e:JSON.stringify(e,null,2)}function ET(e){if(!(e instanceof Error))return String(e);let t=e.cause instanceof Error?` (cause: ${e.cause.message})`:``;return`${e.name}: ${e.message}${t}`}function DT(e,t){if(t.backend===`static`)return`static`;let n=t.websocket!==void 0,r=t.sse!==void 0;if(e===`websocket`){if(!n)throw Error(`[devframe] transport: 'websocket' was requested, but this server does not advertise a WebSocket endpoint`);return`websocket`}if(e===`sse`){if(!r)throw Error(`[devframe] transport: 'sse' was requested, but this server does not advertise an SSE endpoint`);return`sse`}if(t.backend===`sse`&&r)return`sse`;if(n)return`websocket`;if(r)return`sse`;throw Error(`[devframe] This server advertises no RPC transport (backend "none"), so there is nothing to connect to. Enable the WebSocket or SSE endpoint on the server, or use its static/MCP surfaces instead.`)}async function OT(e={}){let{baseURL:t=`./`,rpcOptions:n={},cacheOptions:r=!1}=e,i=Rx(),a=Array.isArray(t)?t:[t],o=await Pw(e),{connectionMeta:s,metaBaseUrl:c,authToken:l}=o,u=a[0]??`./`;try{u=new URL(`.`,c).href}catch{}let d=new lw({functions:[],...typeof e.cacheOptions==`object`?e.cacheOptions:{}}),f={rpc:void 0},p=new vw(f),m=e.webmcp===!1?void 0:CT(p),h,g=!1;async function _(e){let t=[u,...a.filter(e=>e!==u)].filter(e=>e!=null),n=[];for(let r of t)try{return await fetch(Ux(e,r)).then(t=>{if(!t.ok)throw Error(`Failed to fetch ${e} from ${r}: ${t.status}`);return t.json()})}catch(e){n.push(e)}throw Error(`Failed to load ${e} from ${t.join(`, `)}`,{cause:n})}let ee={authToken:l,connectionMeta:s,metaBaseUrl:c,events:i,clientRpc:p,callTimeout:e.callTimeout,rpcOptions:{...n,async onRequest(e,t,i){if(await n.onRequest?.call(this,e,t,i),r&&d?.validate(e.m)){if(d.has(e.m,e.a))return i(d.cached(e.m,e.a));let n=await t(e);d.apply(e,n)}else await t(e)}}},v=DT(e.transport??`auto`,s),te=v===`static`?await sT({fetchJsonFromBases:_}):v===`sse`?Zw({...ee,sseOptions:e.sseOptions}):hT({...ee,wsOptions:e.wsOptions}),ne;try{ne=new BroadcastChannel(`devframe-auth`)}catch{}let re,ie=!1;function ae(e){return((...t)=>ie||!re?e(...t):re.then(()=>e(...t)))}function oe(){g=!0;try{h?.(),m?.()}finally{try{ne?.close()}finally{te.close?.()}}}let se={events:i,get isTrusted(){return te.isTrusted},get status(){return te.status},get connectionError(){return te.connectionError},get transport(){return te.transport??v},get connection(){return o},connectionMeta:s,ensureTrusted:te.ensureTrusted,requestTrust:te.requestTrust,requestTrustWithToken:async e=>(Aw(e),o={...o,authToken:e},te.requestTrustWithToken(e)),requestTrustWithCode:async e=>{let t=await te.requestTrustWithCode(e);if(!t)return!1;Aw(t),o={...o,authToken:t};try{ne?.postMessage({type:`auth-update`,authToken:t})}catch{}return!0},requestAuthCode:e=>te.requestAuthCode(e),call:ae(te.call),callEvent:ae(te.callEvent),callOptional:ae(te.callOptional),client:p,sharedState:void 0,services:void 0,streaming:void 0,cacheManager:d,scope:void 0,close:oe};se.sharedState=Vw(se),se.streaming=uT(se),se.services=Bw(se);let ce=new Map;se.scope=(e=>{if(!e)return se;let t=ce.get(e);return t||(t=xT(se,e),ce.set(e,t)),t}),f.rpc=se;function le(){try{return typeof window<`u`&&window.self===window.top}catch{return!1}}async function ue(){if(e.simpleAuth!==!1&&le()&&typeof globalThis.prompt==`function`)for(await se.requestAuthCode().catch(()=>{});!se.isTrusted;){let e=globalThis.prompt(`devframe: enter the authentication code shown in your terminal`);if(e==null)return;let t=e.trim();if(t&&await se.requestTrustWithCode(t))return}}async function de(){let t=await te.requestTrust(),n=e.otpParam??`devframe_otp`,r=n?await zw(se,{param:n}):!1;t||r||se.isTrusted||await ue()}return re=de().then(()=>{ie=!0},()=>{ie=!0}),s.mcp&&tw(async()=>{let{setupBrowserAgentRpcBridge:e}=await import(`./browser-agent-rpc-BXhoSh1z-D4TTAWew.js`);return{setupBrowserAgentRpcBridge:e}},[],import.meta.url).then(({setupBrowserAgentRpcBridge:e})=>{g||(h=e(se))}).catch(()=>{}),ne&&(ne.onmessage=e=>{e.data?.type===`auth-update`&&e.data.authToken&&se.requestTrustWithToken(e.data.authToken)}),se}var kT=OT,AT=[`components`,`injectors`,`signals`,`ngrx`,`forms`,`router`,`pipes`,`http`,`analog`],jT=[`forms`,`router`,`ngrx`,`http`,`analog`],MT={refreshMs:{default:3e3,min:500,max:8e3},navigations:{default:50,min:5,max:500},formTimeline:{default:200,min:10,max:2e3},httpCalls:{default:200,min:10,max:2e3},changeLog:{default:200,min:10,max:2e3},cdCycles:{default:200,min:10,max:2e3}},NT=`ng-devtools`;function PT(e){return e&&typeof e==`object`&&!Array.isArray(e)?e:{}}function FT(e,t){return typeof e==`boolean`?e:t}var IT=100,LT=100;function RT(e){if(!Array.isArray(e))return[];let t=e.filter(e=>typeof e==`string`).map(e=>e.trim()).filter(e=>e&&e.length<=LT);return[...new Set(t)].slice(0,IT)}function zT(e,t){let{default:n,min:r,max:i}=MT[t];return typeof e!=`number`||!Number.isFinite(e)?n:Math.min(i,Math.max(r,Math.round(e)))}function BT(e,t){return Object.fromEntries(e.map(e=>[e,t(e)]))}function VT(e){let t=PT(e),n=PT(t.agent),r=PT(t.inspectors),i=PT(n.tools),a=PT(t.actions),o=FT(t.actions,!0),s=PT(t.redaction),c=PT(t.limits),l=BT(AT,e=>FT(r[e],!0));return{inspectors:l,agent:{readOnly:FT(n.readOnly,!1),tools:BT(AT,e=>l[e]&&FT(i[e],!0))},actions:BT(jT,e=>l[e]&&FT(a[e],o)),redaction:{secretNames:RT(s.secretNames),unmask:RT(s.unmask)},limits:Object.fromEntries(Object.keys(MT).map(e=>[e,zT(c[e],e)]))}}function HT(e){let t=e?.configs;return VT(t?.[NT])}function UT(e){return`${{forms:`Writing to forms`,router:`Navigating`,ngrx:`Restoring NgRx state and dispatching actions`,http:`Changing HTTP mock rules and clearing HTTP calls`,analog:`Calling API routes`}[e]} is turned off in the devtools config (actions.${e}).`}var WT={components:`Components`,injectors:`Injectors`,signals:`Signals`,ngrx:`NgRx`,forms:`Forms`,router:`Router`,pipes:`Pipes`,http:`HTTP`,analog:`Analog`},GT={forms:`Form writes`,router:`Navigation`,ngrx:`NgRx restore and dispatch`,http:`HTTP mocking`,analog:`Analog API calls`},KT={refreshMs:e=>`poll every ${e} ms`,navigations:e=>`${e} navigations`,formTimeline:e=>`${e} form events`,httpCalls:e=>`${e} HTTP calls`,changeLog:e=>`${e} NgRx changes`,cdCycles:e=>`${e} change detection cycles`};function qT(e){let t=[],n=(e,n)=>{n.length&&t.push({label:e,value:n.join(`, `)})},r=AT.filter(t=>e.inspectors[t]);return n(`Inspectors off`,AT.filter(t=>!e.inspectors[t]).map(e=>WT[e])),n(`Agent`,e.agent.readOnly?[`Read-only`]:[]),n(`Hidden from the agent`,r.filter(t=>!e.agent.tools[t]).map(e=>WT[e])),n(`Blocked actions`,jT.filter(t=>e.inspectors[t]&&!e.actions[t]).map(e=>GT[e])),n(`Extra secret names`,e.redaction.secretNames),n(`Unmasked names`,e.redaction.unmask),n(`Limits`,Object.keys(MT).filter(t=>e.limits[t]!==MT[t].default).map(t=>KT[t](e.limits[t]))),t}var JT=`ng-devtools-page-id`,YT=null;function XT(e){YT=e}function ZT(){if(YT)return YT;try{return new URLSearchParams(location.search).get(`pageId`)||(window.top===window?null:sessionStorage.getItem(JT)||null)}catch{return null}}function QT(e,t){if(t.chosen&&e[t.chosen])return t.chosen;if(t.host)return t.host;if(t.previous&&e[t.previous])return t.previous;let n=null;for(let t of Object.values(e))(!n||t.reportedAt>n.reportedAt)&&(n=t);return n?.pageId??null}function $T(e,t){return e?t?e.pages?.[t]??null:e:null}function eE(e,t){return e?t?e.pages?.[t]??null:e.graph??null:null}function tE(e,t,n){return e?e.scope(`ng-devtools`).rpc.call(t,...n===void 0?[]:[n]):Promise.resolve(null)}function nE(e,t,n){return tE(e,t,n).then(e=>e,()=>null)}function rE(e){return e?.connectionMeta.backend===`static`}function iE(e){let t=()=>{let t=e()?.scope(`ng-devtools`).rpc;t&&(t.callEvent(`request-page-highlight`,null),t.callEvent(`request-form-highlight`,null))};return addEventListener(`pagehide`,t),()=>{removeEventListener(`pagehide`,t),t()}}function aE(e){return HT(e?.connectionMeta)}function oE(e,t){return aE(e).actions[t]}var sE={components:`components`,routes:`router`,signals:`signals`,injectors:`injectors`,store:`ngrx`,forms:`forms`,pipes:`pipes`,network:`http`,analog:`analog`};function cE(e,t){let n=sE[e];return!n||t.inspectors[n]}function lE(e,t){e&1&&(ps(),U(0,`rect`,3)(1,`rect`,4)(2,`rect`,5)(3,`rect`,6))}function uE(e,t){e&1&&(ps(),U(0,`path`,7)(1,`path`,8)(2,`path`,9))}function dE(e,t){e&1&&(ps(),U(0,`circle`,10)(1,`path`,11)(2,`circle`,12))}function fE(e,t){e&1&&(ps(),U(0,`path`,1))}function pE(e,t){e&1&&(ps(),U(0,`path`,13)(1,`path`,14)(2,`path`,15)(3,`path`,16))}function mE(e,t){e&1&&(ps(),U(0,`ellipse`,17)(1,`path`,18)(2,`path`,19))}function hE(e,t){e&1&&(ps(),U(0,`rect`,20)(1,`path`,21)(2,`path`,22)(3,`path`,23))}function gE(e,t){e&1&&(ps(),U(0,`circle`,24)(1,`path`,25)(2,`path`,26))}function _E(e,t){e&1&&(ps(),U(0,`path`,27)(1,`path`,28)(2,`path`,29)(3,`path`,30)(4,`circle`,31))}function vE(e,t){e&1&&(ps(),U(0,`path`,2))}var yE=class e{name=$.required();static ɵfac=function(t){return new(t||e)};static ɵcmp=Vh({type:e,selectors:[[`app-tab-icon`]],inputs:{name:[1,`name`]},decls:11,vars:1,consts:[[`viewBox`,`0 0 24 24`,`width`,`16`,`height`,`16`,`fill`,`none`,`stroke`,`currentColor`,`stroke-width`,`1.8`,`stroke-linecap`,`round`,`stroke-linejoin`,`round`,`aria-hidden`,`true`],[`d`,`M22 12h-4l-3 9L9 3l-3 9H2`],[`d`,`m8 3 4 8 5-5 5 15H2L8 3z`],[`x`,`3`,`y`,`3`,`width`,`7`,`height`,`9`,`rx`,`1.5`],[`x`,`14`,`y`,`3`,`width`,`7`,`height`,`5`,`rx`,`1.5`],[`x`,`14`,`y`,`12`,`width`,`7`,`height`,`9`,`rx`,`1.5`],[`x`,`3`,`y`,`16`,`width`,`7`,`height`,`5`,`rx`,`1.5`],[`d`,`M12 2 3 7l9 5 9-5-9-5Z`],[`d`,`m3 12 9 5 9-5`],[`d`,`m3 17 9 5 9-5`],[`cx`,`6`,`cy`,`19`,`r`,`3`],[`d`,`M9 19h8.5a3.5 3.5 0 0 0 0-7h-11a3.5 3.5 0 0 1 0-7H15`],[`cx`,`18`,`cy`,`5`,`r`,`3`],[`d`,`M12 22v-5`],[`d`,`M9 8V2`],[`d`,`M15 8V2`],[`d`,`M18 8v5a4 4 0 0 1-4 4h-4a4 4 0 0 1-4-4V8Z`],[`cx`,`12`,`cy`,`5`,`rx`,`9`,`ry`,`3`],[`d`,`M3 5v14a9 3 0 0 0 18 0V5`],[`d`,`M3 12a9 3 0 0 0 18 0`],[`x`,`3`,`y`,`4`,`width`,`18`,`height`,`16`,`rx`,`2`],[`d`,`M7 9h10`],[`d`,`M7 13h6`],[`d`,`M7 17h8`],[`cx`,`12`,`cy`,`12`,`r`,`9`],[`d`,`M3 12h18`],[`d`,`M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18Z`],[`d`,`M4 7h10`],[`d`,`M4 17h6`],[`d`,`m14 13 4 4-4 4`],[`d`,`M10 17h8`],[`cx`,`18`,`cy`,`7`,`r`,`3`]],template:function(e,t){if(e&1&&(ps(),V(0,`svg`,0),N(1,lE,4,0)(2,uE,3,0)(3,dE,3,0)(4,fE,1,0,`:svg:path`,1)(5,pE,4,0)(6,mE,3,0)(7,hE,4,0)(8,gE,3,0)(9,_E,5,0)(10,vE,1,0,`:svg:path`,2),H()),e&2){let e;j(),P((e=t.name())===`dashboard`?1:e===`components`?2:e===`routes`?3:e===`signals`?4:e===`injectors`?5:e===`store`?6:e===`forms`?7:e===`network`?8:e===`pipes`?9:e===`analog`?10:-1)}},styles:[`[_nghost-%COMP%] {
  display: inline-flex;
  flex-shrink: 0;
}`]})},bE=(e,t)=>t.tab,xE=(e,t)=>t.label;function SE(e,t){e&1&&J(0),e&2&&X(` `,K().meta()?.projectName,` `)}function CE(e,t){e&1&&J(0,` Project details unavailable `)}function wE(e,t){e&1&&J(0,` Loading… `)}function TE(e,t){e&1&&(J(0,` Run `),R(1,`code`),J(2,`ng-devtools build`),z(),J(3,` again to rebuild the report. `))}function EE(e,t){e&1&&J(0,` Check that the dev server is running, then reload the panel. `)}function DE(e,t){if(e&1&&(R(0,`p`,4),N(1,TE,4,0)(2,EE,1,0),z()),e&2){let e=K();j(),P(e.staticReport()?1:2)}}function OE(e,t){e&1&&(R(0,`li`,6)(1,`span`),J(2,`Analog`),z(),J(3),z()),e&2&&(j(3),Y(t))}function kE(e,t){e&1&&(R(0,`li`)(1,`span`),J(2,`Change detection`),z(),J(3),z()),e&2&&(j(3),Y(t))}function AE(e,t){if(e&1&&(R(0,`span`,17),J(1),z(),R(2,`span`,18),J(3),z()),e&2){let e=K().$implicit,t=K();j(),Y(t.cards()[e.tab]?.value),j(2),Y(t.cards()[e.tab]?.sub)}}function jE(e,t){e&1&&(R(0,`span`,19),J(1,`–`),z(),R(2,`span`,18),J(3,`Count unavailable`),z())}function ME(e,t){e&1&&(B(0,`span`,20),R(1,`span`,18),J(2,`Counting…`),z())}function NE(e,t){if(e&1){let e=W();R(0,`button`,11),G(`click`,function(){let t=O(e).$implicit;return k(K().navigate.emit(t.tab))}),R(1,`span`,12)(2,`span`,13),B(3,`app-tab-icon`,14),z(),R(4,`span`,15),J(5,`→`),z()(),R(6,`span`,16),J(7),z(),N(8,AE,4,2)(9,jE,4,0)(10,ME,3,0),z()}if(e&2){let e,n=t.$implicit,r=t.$index,i=K().stateOf(n.tab);C_(`animation-delay`,60*r,`ms`),M(`aria-busy`,i===`loading`),j(3),L(`name`,n.tab),j(4),Y(n.label),j(),P((e=i)===`ready`?8:e===`error`?9:10)}}function PE(e,t){e&1&&(R(0,`p`),J(1,`Loading…`),z())}function FE(e,t){if(e&1&&(R(0,`div`)(1,`dt`),J(2),z(),R(3,`dd`),J(4),z()()),e&2){let e=t.$implicit;j(2),Y(e.label),j(2),Y(e.value)}}function IE(e,t){if(e&1&&(R(0,`dl`),F(1,FE,5,2,`div`,null,xE),z()),e&2){let e=K();j(),I(e.configItems())}}function LE(e,t){e&1&&(R(0,`p`),J(1,`Defaults`),z())}var RE=[{tab:`components`,label:`Components`},{tab:`routes`,label:`Routes`},{tab:`signals`,label:`Signals`},{tab:`injectors`,label:`Injectors`},{tab:`store`,label:`NgRx declarations`},{tab:`pipes`,label:`Pipes`}],zE={zoneless:`Zoneless`,zone:`zone.js`,"zone-unused":`Zoneless, zone.js loaded`};function BE(e){return e&&Object.hasOwn(zE,e)?zE[e]:null}var VE=new Set([`signal`,`computed`,`linkedSignal`,`effect`]),HE={action:[`action`,`actions`],reducer:[`reducer`,`reducers`],effect:[`effect`,`effects`],selector:[`selector`,`selectors`],feature:[`feature`,`features`],"store-setup":[`setup call`,`setup calls`],"signal-store":[`signal store`,`signal stores`],"signal-state":[`signal state`,`signal states`],"signal-method":[`signal method`,`signal methods`]};function UE(e,t,n){return`${e} ${e===1?t:n}`}function WE(e,t){for(let n of e??[])t(n),WE(n.children,t)}function GE(e){if(!e.some(e=>e.kind))return{value:e.length,sub:`discovered in source`};let t=e.filter(e=>e.kind===`directive`).length;return{value:e.length-t,sub:`components · ${UE(t,`directive`,`directives`)}`}}function KE(e){if(!e.some(e=>e.kind))return{value:e.length,sub:`route entries in source`};let t=e.filter(e=>e.kind===`redirect`).length;return{value:new Set(e.filter(e=>e.kind===`page`).map(e=>e.fullPath??e.path??``)).size,sub:`navigable paths · ${UE(t,`redirect`,`redirects`)}`}}function qE(e){let t=new Map;for(let n of e)n.kind&&t.set(n.kind,(t.get(n.kind)??0)+1);if(!t.size)return{value:e.length,sub:`declarations in source`};let n=[...t].sort((e,t)=>t[1]-e[1]).map(([e,t])=>{let[n,r]=HE[e]??[e,e];return UE(t,n,r)});return{value:e.length,sub:n.join(` · `)}}var JE=class e{rpc=$(null);navigate=Ov();staticReport=Q(()=>rE(this.rpc()));meta=A(null);config=Q(()=>aE(this.rpc()));stats=Q(()=>this.rpc()?RE.filter(e=>cE(e.tab,this.config())):[]);configItems=Q(()=>qT(this.config()));metaState=A(`loading`);states=A({});rows=A({});injectorTree=A(null);signalGraph=A(null);pageId=ZT();destroyRef=E(ws);stopLive=[];zone=Q(()=>BE($T(this.injectorTree(),this.pageId)?.zone));liveInjectors=Q(()=>{let e=$T(this.injectorTree(),this.pageId);if(!e?.roots?.length)return null;let t=0,n=0,r=e=>{t++,n+=e.providers?.length??0};return WE(e.roots,r),WE(e.environment,r),{injectors:t,providers:n}});liveSignals=Q(()=>{let e=eE(this.signalGraph(),this.pageId);return e?.nodes?.length?e.nodes.filter(e=>VE.has(e.kind??``)).length:null});cards=Q(()=>{let e=this.rows(),t={};if(e.components&&(t.components=GE(e.components)),e.routes&&(t.routes=KE(e.routes)),e.store&&(t.store=qE(e.store)),e.pipes){let n=e.pipes.filter(e=>e.builtin).length;t.pipes={value:e.pipes.length-n,sub:n?`custom pipes · ${n} built-in in use`:`custom pipes in source`}}let n=this.liveSignals();n===null?e.signals&&(t.signals={value:e.signals.length,sub:`signal declarations in source`}):t.signals={value:n,sub:e.signals?`live on the page · ${e.signals.length} declared in source`:`live on the page`};let r=this.liveInjectors();return r?t.injectors={value:r.injectors,sub:`live injectors · ${UE(r.providers,`provider`,`providers`)}`}:e.injectors&&(t.injectors={value:e.injectors.filter(e=>e.type!==`injection`).length,sub:`provider declarations in source`}),t});constructor(){dc(()=>{let e=this.rpc();if(!e)return;let t=e.scope(`ng-devtools`);this.metaState.set(`loading`),this.states.set({}),this.rows.set({}),t.rpc.call(`build-meta`).then(e=>{this.meta.set(e),this.metaState.set(`ready`)}).catch(()=>this.metaState.set(`error`));let n=aE(e),r=e=>cE(e,n);r(`components`)&&this.load(t.rpc.call(`get-components`),`components`),r(`routes`)&&this.load(t.rpc.call(`get-routes`),`routes`),r(`signals`)&&this.load(t.rpc.call(`get-signals`),`signals`),r(`injectors`)&&this.load(t.rpc.call(`get-providers`),`injectors`),r(`store`)&&this.load(t.rpc.call(`get-ngrx-store`),`store`),r(`pipes`)&&this.load(t.rpc.call(`get-pipes`),`pipes`),this.watchLive(e,n)}),this.destroyRef.onDestroy(()=>this.unwatch())}stateOf(e){return(e===`signals`?this.liveSignals():e===`injectors`?this.liveInjectors():null)===null?this.states()[e]??`loading`:`ready`}load(e,t){let n=e=>this.states.update(n=>({...n,[t]:e}));e.then(e=>{this.rows.update(n=>({...n,[t]:Array.isArray(e)?e:[]})),n(`ready`)}).catch(()=>n(`error`))}async watchLive(e,t){this.unwatch();let n=e.scope(`ng-devtools`).rpc,r=async(t,r)=>{try{let i=await n.sharedState(t);if(this.destroyRef.destroyed||this.rpc()!==e)return;r(i.value()),this.stopLive.push(i.on(`updated`,e=>r(e)))}catch{r(null)}};await Promise.all([t.inspectors.injectors&&r(`injector-tree`,e=>this.injectorTree.set(e)),t.inspectors.signals&&r(`signal-graph`,e=>this.signalGraph.set(e))])}unwatch(){for(let e of this.stopLive.splice(0))e()}static ɵfac=function(t){return new(t||e)};static ɵcmp=Vh({type:e,selectors:[[`app-dashboard`]],inputs:{rpc:[1,`rpc`]},outputs:{navigate:`navigate`},decls:33,vars:14,consts:[[`aria-labelledby`,`project-title`,1,`project`],[1,`project-head`],[1,`eyebrow`],[`id`,`project-title`],[1,`hint`],[1,`chips`],[1,`analog`],[1,`grid`],[`type`,`button`,1,`stat`,3,`animation-delay`],[`aria-labelledby`,`config-title`,1,`config`],[`id`,`config-title`],[`type`,`button`,1,`stat`,3,`click`],[1,`top`],[1,`icon`],[3,`name`],[`aria-hidden`,`true`,1,`go`],[1,`label`],[1,`big`],[1,`sub`],[1,`big`,`muted`],[`aria-hidden`,`true`,1,`big`,`skeleton`]],template:function(e,t){if(e&1&&(R(0,`section`,0)(1,`div`,1)(2,`p`,2),J(3,`Project`),z(),R(4,`h2`,3),N(5,SE,1,1)(6,CE,1,0)(7,wE,1,0),z(),N(8,DE,3,1,`p`,4),z(),R(9,`ul`,5)(10,`li`)(11,`span`),J(12,`Angular`),z(),J(13),z(),R(14,`li`)(15,`span`),J(16,`TypeScript`),z(),J(17),z(),R(18,`li`)(19,`span`),J(20,`SSR`),z(),J(21),z(),N(22,OE,4,1,`li`,6),N(23,kE,4,1,`li`),z()(),R(24,`div`,7),F(25,NE,11,6,`button`,8,bE),z(),R(27,`section`,9)(28,`h2`,10),J(29,`Configuration`),z(),N(30,PE,2,0,`p`)(31,IE,3,0,`dl`)(32,LE,2,0,`p`),z()),e&2){let e,n,r;M(`aria-busy`,t.metaState()===`loading`),j(4),q(`muted`,t.metaState()!==`ready`),j(),P((e=t.metaState())===`ready`?5:e===`error`?6:7),j(3),P(t.metaState()===`error`?8:-1),j(),q(`pending`,t.metaState()===`loading`),j(4),Y(t.meta()?.angularVersion??`…`),j(4),Y(t.meta()?.typescript??`…`),j(4),Y(t.meta()?t.meta()?.ssr?`On`:`Off`:`…`),j(),P((n=t.meta()?.analog)?22:-1,n),j(),P((r=t.zone())?23:-1,r),j(2),I(t.stats()),j(2),M(`aria-busy`,!t.rpc()),j(3),P(t.rpc()?t.configItems().length?31:32:30)}},dependencies:[yE],styles:[`[_nghost-%COMP%] {
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
}`]})};function YE(e){return e?.platform===`angular-native`}function XE(e,t){let n=Object.values(e??{}).filter(YE);if(t&&n.some(e=>e.pageId===t))return t;let r=null;for(let e of n)(!r||e.reportedAt>r.reportedAt)&&(r=e);return r?.pageId??null}var ZE=[`trigger`],QE=[`list`],$E=(e,t)=>t.value;function eD(e,t){if(e&1&&(V(0,`span`,4),J(1),H()),e&2){let e=K();j(),Y(e.current().hint)}}function tD(e,t){if(e&1&&(V(0,`span`,15),J(1),H()),e&2){let e=K().$implicit;j(),Y(e.hint)}}function nD(e,t){if(e&1){let e=W();V(0,`li`,11),Qg(`pointerenter`,function(){let t=O(e).$index;return k(K(2).active.set(t))})(`pointerdown`,function(e){return e.preventDefault()})(`click`,function(){let t=O(e).$index;return k(K(2).choose(t))}),ps(),V(1,`svg`,12),U(2,`path`,13),H(),ms(),V(3,`span`,14),J(4),H(),N(5,tD,2,1,`span`,15),H()}if(e&2){let e=t.$implicit,n=t.$index,r=K(2);q(`active`,n===r.active())(`selected`,e.value===r.value()),M(`id`,r.uid+`-opt-`+n)(`aria-selected`,e.value===r.value())(`aria-disabled`,e.disabled||null),j(4),Y(e.label),j(),P(e.hint?5:-1)}}function rD(e,t){if(e&1&&(V(0,`li`,10),J(1),H()),e&2){let e=K(2);j(),Y(e.emptyText())}}function iD(e,t){if(e&1&&(V(0,`ul`,8,1),fg(`list-in`),F(2,nD,6,9,`li`,9,$E,!1,rD,2,1,`li`,10),H()),e&2){let e=K();q(`up`,e.dropUp()),M(`id`,e.uid+`-list`)(`aria-labelledby`,e.labelledBy()||e.uid+`-trigger`),j(2),I(e.options())}}var aD=0,oD=class e{options=$.required();value=Fv(null);placeholder=$(`Select…`);ariaLabel=$(``);labelledBy=$(``);disabled=$(!1);emptyText=$(`Nothing to choose`);uid=`app-select-${++aD}`;open=A(!1);active=A(-1);dropUp=A(!1);current=Q(()=>this.options().find(e=>e.value===this.value())??null);host=E(Nl);injector=E(Ss);trigger=Rv.required(`trigger`);list=Rv(`list`);typed=``;typedAt=0;toggle(){this.open()?this.close():this.show()}choose(e){let t=this.options()[e];t&&!t.disabled&&(this.value.set(t.value),this.close(),this.trigger().nativeElement.focus())}onKey(e){let t=this.options(),n=this.open();switch(e.key){case`ArrowDown`:case`ArrowUp`:if(e.preventDefault(),!n){this.show();return}this.move(e.key===`ArrowDown`?1:-1);return;case`Home`:case`End`:if(!n)return;e.preventDefault(),this.setActive(e.key===`Home`?this.firstEnabled(0,1):this.firstEnabled(t.length-1,-1));return;case`Enter`:case` `:e.preventDefault(),n&&this.active()>=0?this.choose(this.active()):this.show();return;case`Escape`:if(!n)return;e.preventDefault(),e.stopPropagation(),this.close();return;case`Tab`:n&&this.close();return;default:e.key.length===1&&!e.metaKey&&!e.ctrlKey&&!e.altKey&&this.typeAhead(e.key)}}onBlur(e){let t=e.relatedTarget;t&&this.host.nativeElement.contains(t)||this.close()}onOutside(e){this.open()&&!this.host.nativeElement.contains(e.target)&&this.close()}show(){if(this.disabled())return;let e=this.host.nativeElement.getBoundingClientRect(),t=window.innerHeight-e.bottom;this.dropUp.set(t<220&&e.top>t);let n=this.options().findIndex(e=>e.value===this.value());this.open.set(!0),this.setActive(n>=0?n:this.firstEnabled(0,1))}close(){this.open.set(!1),this.active.set(-1)}move(e){let t=this.firstEnabled(this.active()+e,e);t>=0&&this.setActive(t)}firstEnabled(e,t){let n=this.options();for(let r=e;r>=0&&r<n.length;r+=t)if(!n[r].disabled)return r;return-1}setActive(e){this.active.set(e),!(e<0)&&Ld(()=>{(this.list()?.nativeElement.querySelector(`#${this.uid}-opt-${e}`))?.scrollIntoView({block:`nearest`})},{injector:this.injector})}typeAhead(e){let t=performance.now();this.typed=t-this.typedAt>600?e.toLowerCase():this.typed+e.toLowerCase(),this.typedAt=t;let n=this.options().findIndex(e=>!e.disabled&&e.label.toLowerCase().startsWith(this.typed));n<0||(this.open()?this.setActive(n):this.value.set(this.options()[n].value))}static ɵfac=function(t){return new(t||e)};static ɵcmp=Vh({type:e,selectors:[[`app-select`]],viewQuery:function(e,t){e&1&&e_(t.trigger,ZE,5)(t.list,QE,5),e&2&&t_(2)},hostAttrs:[1,`app-select`],hostVars:2,hostBindings:function(e,t){e&1&&G(`pointerdown`,function(e){return t.onOutside(e)},Nu),e&2&&q(`open`,t.open())},inputs:{options:[1,`options`],value:[1,`value`],placeholder:[1,`placeholder`],ariaLabel:[1,`ariaLabel`],labelledBy:[1,`labelledBy`],disabled:[1,`disabled`],emptyText:[1,`emptyText`]},outputs:{value:`valueChange`},decls:8,vars:12,consts:[[`trigger`,``],[`list`,``],[`type`,`button`,`role`,`combobox`,`aria-haspopup`,`listbox`,1,`trigger`,3,`click`,`keydown`,`blur`,`disabled`],[1,`value`],[1,`value-hint`],[`viewBox`,`0 0 24 24`,`aria-hidden`,`true`,1,`chevron`],[`d`,`m6 9 6 6 6-6`],[`role`,`listbox`,`tabindex`,`-1`,1,`list`,3,`up`],[`role`,`listbox`,`tabindex`,`-1`,1,`list`],[`role`,`option`,3,`active`,`selected`],[`role`,`option`,`aria-disabled`,`true`,1,`empty`],[`role`,`option`,3,`pointerenter`,`pointerdown`,`click`],[`viewBox`,`0 0 24 24`,`aria-hidden`,`true`,1,`check`],[`d`,`m5 12 5 5 9-10`],[1,`label`],[1,`hint`]],template:function(e,t){e&1&&(V(0,`button`,2,0),Qg(`click`,function(){return t.toggle()})(`keydown`,function(e){return t.onKey(e)})(`blur`,function(e){return t.onBlur(e)}),V(2,`span`,3),J(3),H(),N(4,eD,2,1,`span`,4),ps(),V(5,`svg`,5),U(6,`path`,6),H()(),N(7,iD,5,5,`ul`,7)),e&2&&(Vg(`disabled`,t.disabled()),M(`id`,t.uid+`-trigger`)(`aria-controls`,t.uid+`-list`)(`aria-expanded`,t.open())(`aria-label`,t.ariaLabel()||null)(`aria-labelledby`,t.labelledBy()||null)(`aria-activedescendant`,t.open()&&t.active()>=0?t.uid+`-opt-`+t.active():null),j(2),q(`placeholder`,!t.current()),j(),X(` `,t.current()?.label??t.placeholder(),` `),j(),P(t.current()?.hint?4:-1),j(3),P(t.open()?7:-1))},styles:[`[_nghost-%COMP%] {
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
}`]})};function sD(e,t){let n=t.trim().toLowerCase();if(!n)return{nodes:e,matches:0};let r=0,i=e=>e.name.toLowerCase().includes(n)||e.tag.toLowerCase().includes(n)||!!e.directives?.some(e=>e.toLowerCase().includes(n)),a=e=>e.flatMap(e=>{let t=i(e);t&&r++;let n=a(e.children);return t||n.length?[{...e,children:n}]:[]});return{nodes:a(e),matches:r}}function cD(e,t,n,r=!1){let i=r?`${e}+`:`${e}`;return n?`${t} of ${i}`:`${i} ${e===1&&!r?`instance`:`instances`}`}function lD(e,t,n,r=!1){return n.trim()?t?`${t} of ${r?`${e}+`:`${e}`} ${e===1&&!r?`instance`:`instances`} match.`:`No components match.`:``}function uD(e){let t=e?.components,n=e?.depth;return t&&n?`Showing the first ${t} component instances, and none nested more than ${n} elements deep. Others are not listed or searchable.`:t?`Showing the first ${t} component instances. Others are not listed or searchable.`:n?`Components nested more than ${n} elements deep are not listed or searchable.`:`The page has more components than the tree shows.`}function dD(e,t){let n=t?.detail?.id??null,r=t?.pageId??null;if(r!==e.pageId)return{pageId:r,selectedId:n,detailId:n,destroyed:null};let i=e.selectedId;return n&&n!==e.detailId&&n!==i&&(i=n),i&&t&&!t.truncated&&!fD(t.roots,i)?{pageId:r,selectedId:null,detailId:n,destroyed:i}:{pageId:r,selectedId:i,detailId:n,destroyed:null}}function fD(e,t){return e.some(e=>e.id===t||fD(e.children,t))}function pD(e,t,n){let r=e.indexOf(n);if(r<0)return null;for(let n=r+1;n<e.length;n++)if(t.has(e[n]))return e[n];for(let n=r-1;n>=0;n--)if(t.has(e[n]))return e[n];return null}function mD(e){return new Date(e).toLocaleTimeString()}function hD(e,t){if(e&1&&(V(0,`p`,0),J(1),V(2,`code`),J(3),H(),J(4,` to keep more. `),V(5,`a`,1),J(6,`About limits`),H()()),e&2){let e=K();j(),X_(` Showing the latest `,e.max(),` `,e.what(),`. `,e.dropped(),` older `,e.dropped()===1?`entry was`:`entries were`,` dropped. Raise `),j(2),X(`limits.`,e.limit()),j(2),Vg(`href`,e.docsUrl,Au)}}var gD=`https://github.com/santoshyadavdev/angular-devtools/blob/main/apps/docs/src/content/getting-started/configuration.md#limits`,_D=class e{dropped=$(0);max=$.required();what=$.required();limit=$.required();docsUrl=gD;static ɵfac=function(t){return new(t||e)};static ɵcmp=Vh({type:e,selectors:[[`app-limit-note`]],inputs:{dropped:[1,`dropped`],max:[1,`max`],what:[1,`what`],limit:[1,`limit`]},decls:1,vars:1,consts:[[1,`note`],[`target`,`_blank`,`rel`,`noopener noreferrer`,3,`href`]],template:function(e,t){e&1&&N(0,hD,7,6,`p`,0),e&2&&P(t.dropped()>0?0:-1)},styles:[`[_nghost-%COMP%] {
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
}`]})},vD=(e,t)=>t.name,yD=(e,t)=>t.id;function bD(e,t){if(e&1){let e=W();R(0,`button`,12),G(`click`,function(){return O(e),k(K().clear())}),J(1,`Clear`),z()}}function xD(e,t){e&1&&(R(0,`p`,8),J(1,`This page can't record change detection. It needs Angular 20 or later.`),z())}function SD(e,t){if(e&1&&(R(0,`tr`)(1,`td`,16),J(2),z(),R(3,`td`,17),J(4),z(),R(5,`td`,17),J(6),z(),R(7,`td`,17),J(8),z()()),e&2){let e=t.$implicit,n=K(2);j(2),Y(e.name),j(2),Y(e.checks),j(2),Y(n.ms(e.ms)),j(2),Y(n.ms(e.maxMs))}}function CD(e,t){if(e&1&&(R(0,`span`,19),J(1,`after `),R(2,`span`,16),J(3),z()()),e&2){let e=K().$implicit;j(3),Y(e.trigger)}}function wD(e,t){if(e&1&&(R(0,`span`,20),J(1,` slowest `),R(2,`span`,16),J(3),z(),J(4),z()),e&2){let e=t,n=K(3);j(3),Y(e.name),j(),X(` `,n.ms(e.ms),` `)}}function TD(e,t){if(e&1&&(R(0,`li`)(1,`span`,18),J(2),z(),R(3,`span`,16),J(4),z(),R(5,`span`),J(6),z(),N(7,CD,4,1,`span`,19),N(8,wD,5,2,`span`,20),z()),e&2){let e,n=t.$implicit,r=K(2);j(2),Y(r.clock(n.at)),j(2),Y(r.ms(n.ms)),j(2),X_(` `,n.checks,` `,n.checks===1?`check`:`checks`,`, `,n.passes,` `,n.passes===1?`pass`:`passes`,` `),j(),P(n.trigger?7:-1),j(),P((e=n.components[0])?8:-1,e)}}function ED(e,t){if(e&1&&(R(0,`div`,10)(1,`div`)(2,`h3`),J(3,`Slowest components`),z(),R(4,`table`)(5,`thead`)(6,`tr`)(7,`th`,13),J(8,`Component`),z(),R(9,`th`,14),J(10,`Checks`),z(),R(11,`th`,14),J(12,`Self time`),z(),R(13,`th`,14),J(14,`Slowest`),z()()(),R(15,`tbody`),F(16,SD,9,4,`tr`,null,vD),z()()(),R(18,`div`)(19,`h3`),J(20,`Latest cycles`),z(),R(21,`ol`,15),F(22,TD,9,8,`li`,null,yD),z()()()),e&2){let e=K();j(16),I(e.slowest()),j(6),I(e.latest())}}function DD(e,t){e&1&&(R(0,`p`,11),J(1,`Use the app. Cycles show up here as Angular runs change detection.`),z())}var OD=10,kD=class e{page=$(null);pageId=$(null);rpc=$(null);message=A(``);recording=Q(()=>this.page()?.recording===!0);cycles=Q(()=>this.page()?.cycles??[]);maxCycles=Q(()=>aE(this.rpc()).limits.cdCycles);slowest=Q(()=>[...this.page()?.components??[]].sort((e,t)=>t.ms-e.ms).slice(0,OD));latest=Q(()=>this.cycles().slice(-30).reverse());status=Q(()=>{if(this.message())return this.message();let e=this.cycles().length;return this.recording()?`Recording. ${e} ${e===1?`cycle`:`cycles`} so far.`:e?`${e} ${e===1?`cycle`:`cycles`} recorded.`:``});ms(e){return`${e<10?e.toFixed(2):Math.round(e)} ms`}clock(e){return mD(e)}async toggle(){await this.send({on:!this.recording()},this.recording()?``:`Starting…`)}async clear(){await this.send({clear:!0},``)}async send(e,t){this.message.set(t);try{await tE(this.rpc(),`request-change-detection-record`,{pageId:this.pageId(),...e}),this.message.set(``)}catch{this.message.set(`Could not reach the page.`)}}static ɵfac=function(t){return new(t||e)};static ɵcmp=Vh({type:e,selectors:[[`app-cd-recording`]],inputs:{page:[1,`page`],pageId:[1,`pageId`],rpc:[1,`rpc`]},decls:16,vars:10,consts:[[`aria-labelledby`,`cd-heading`,1,`cd`],[1,`cd-head`],[`id`,`cd-heading`],[`type`,`button`,3,`click`,`disabled`],[`aria-hidden`,`true`,1,`dot`],[`type`,`button`],[`role`,`status`,1,`status`],[1,`hint`],[1,`note`],[`what`,`cycles`,`limit`,`cdCycles`,3,`dropped`,`max`],[1,`cd-grid`],[1,`empty`],[`type`,`button`,3,`click`],[`scope`,`col`],[`scope`,`col`,1,`num`],[`aria-label`,`Latest change detection cycles, newest first`,1,`cycles`],[1,`mono`],[1,`num`],[1,`when`],[1,`trigger`],[1,`top`]],template:function(e,t){e&1&&(R(0,`section`,0)(1,`div`,1)(2,`h2`,2),J(3,`Change detection`),z(),R(4,`button`,3),G(`click`,function(){return t.toggle()}),B(5,`span`,4),J(6),z(),N(7,bD,2,0,`button`,5),R(8,`p`,6),J(9),z()(),R(10,`p`,7),J(11,` Records each change detection cycle with Angular's profiler: how long it took, how many components it checked and the output that ran before it. Tree rows show how often each instance was checked. Times come from a development build. `),z(),N(12,xD,2,0,`p`,8),B(13,`app-limit-note`,9),N(14,ED,24,0,`div`,10)(15,DD,2,0,`p`,11),z()),e&2&&(j(4),q(`on`,t.recording()),L(`disabled`,!t.pageId()),j(2),X(` `,t.recording()?`Stop recording`:`Record`,` `),j(),P(t.cycles().length?7:-1),j(2),Y(t.status()),j(3),P(t.page()?.supported===!1?12:-1),j(),L(`dropped`,t.page()?.dropped??0)(`max`,t.maxCycles()),j(),P(t.slowest().length?14:t.recording()?15:-1))},dependencies:[_D],styles:[`[_nghost-%COMP%] {
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
}`]})},AD=()=>[],jD=(e,t)=>t.node.id,MD=(e,t)=>t.outlet+t.route,ND=(e,t)=>t.formId,PD=(e,t)=>t.name+e,FD=(e,t)=>t.name,ID=(e,t)=>t.token+e,LD=(e,t)=>t.id;function RD(e,t){return this.sourceKey(t)}function zD(e,t){if(e&1){let e=W();R(0,`span`,21),J(1,`Page`),z(),R(2,`app-select`,22),G(`valueChange`,function(t){return O(e),k(K(2).selectPage(t))}),z()}if(e&2){let e=K(2);j(2),L(`options`,e.pageOptions())(`value`,e.page()?.pageId??null)}}function BD(e,t){if(e&1){let e=W();R(0,`button`,23),G(`click`,function(){O(e);let t=K(2);return k(t.picking()?t.cancelPick():t.pick())}),ps(),R(1,`svg`,24),B(2,`path`,25),z(),J(3),z()}if(e&2){let e=K(2);q(`on`,e.picking()),j(3),X(` `,e.picking()?`Cancel pick`:`Pick component on page`,` `)}}function VD(e,t){if(e&1&&(R(0,`p`,10),J(1),z()),e&2){let e=K(2);j(),Y(e.pickMessage())}}function HD(e,t){if(e&1&&(R(0,`p`,11),J(1),z()),e&2){let e=K(2);j(),Y(e.truncationText())}}function UD(e,t){e&1&&(R(0,`p`,27),J(1,`The filter only searches the components the tree lists.`),z())}function WD(e,t){if(e&1){let e=W();R(0,`div`,14)(1,`p`,26),J(2),z(),N(3,UD,2,0,`p`,27),R(4,`button`,28),G(`click`,function(){return O(e),k(K(2).setFilter(``))}),J(5,`Clear filter`),z()()}if(e&2){let e=K(2);j(2),X(`No components match “`,e.filter().trim(),`”`),j(),P(e.page().truncated?3:-1)}}function GD(e,t){if(e&1){let e=W();R(0,`span`,37),G(`click`,function(t){O(e);let n=K().$implicit;return k(K(2).toggle(n.node.id,t))}),ps(),R(1,`svg`,38),B(2,`path`,39),z()()}if(e&2){let e=K().$implicit;q(`open`,e.expanded)}}function KD(e,t){e&1&&B(0,`span`,31)}function qD(e,t){if(e&1&&(R(0,`span`,34),J(1),z()),e&2){let e=t.$implicit;j(),Y(e.route||`/`)}}function JD(e,t){if(e&1&&(R(0,`span`,35),J(1),R(2,`span`,13),J(3),z()()),e&2){let e=t;j(),X(` `,e),j(2),X(` `,e===1?`check`:`checks`,` while recording`)}}function YD(e,t){if(e&1&&(R(0,`span`,36),J(1),R(2,`span`,13),J(3),z()()),e&2){let e=K().$implicit;M(`title`,e.node.directives.join(`, `)),j(),X(` +`,e.node.directives.length,` `),j(2),X(` `,e.node.directives.length===1?`directive`:`directives`,` `)}}function XD(e,t){if(e&1){let e=W();R(0,`div`,29),G(`click`,function(){let t=O(e).$implicit;return k(K(2).select(t.node.id))})(`focus`,function(){let t=O(e).$implicit,n=K(2);return n.focusId.set(t.node.id),k(n.highlight(t.node.id))})(`blur`,function(){return O(e),k(K(2).highlight(null))})(`mouseenter`,function(){let t=O(e).$implicit;return k(K(2).highlight(t.node.id))})(`mouseleave`,function(){return O(e),k(K(2).highlight(null))}),N(1,GD,3,2,`span`,30)(2,KD,1,0,`span`,31),R(3,`span`,32),J(4),z(),R(5,`span`,33),J(6),z(),F(7,qD,2,1,`span`,34,MD),N(9,JD,4,2,`span`,35),N(10,YD,4,3,`span`,36),z()}if(e&2){let e,n=t.$implicit,r=K(2);C_(`--%NS%depth`,n.depth),q(`selected`,r.selectedId()===n.node.id),M(`aria-level`,n.depth+1)(`aria-expanded`,n.hasChildren?n.expanded:null)(`aria-selected`,r.selectedId()===n.node.id)(`tabindex`,r.rovingId()===n.node.id?0:-1)(`data-id`,n.node.id),j(),P(n.hasChildren?1:2),j(3),Y(n.node.name),j(2),X(`<`,n.node.tag,`>`),j(),I(r.routedById().get(n.node.id)??ov(14,AD)),j(2),P((e=r.cdHosts()[n.node.id])?9:-1,e),j(),P(n.node.directives?.length?10:-1)}}function ZD(e,t){if(e&1){let e=W();R(0,`button`,48),G(`click`,function(){let t=O(e).$implicit;return k(K(5).showForm.emit(t.formId))}),J(1),z()}if(e&2){let e=t.$implicit;j(),X(` Show `,e.label,` in Forms `)}}function QD(e,t){if(e&1&&(R(0,`div`,46),F(1,ZD,2,1,`button`,47,ND),z()),e&2){let e=K(),t=K(3);j(),I(t.formsIn(e.file))}}function $D(e,t){if(e&1&&(R(0,`p`,45),J(1),z(),N(2,QD,3,0,`div`,46)),e&2){let e=t,n=K(3);j(),Z(``,e.file,`:`,e.line),j(),P(n.formsIn(e.file).length?2:-1)}}function eO(e,t){if(e&1&&(R(0,`dt`),J(1,`Routed`),z(),R(2,`dd`,50),J(3),z()),e&2){let e=t.$implicit;j(3),Z(``,e.route||`/`,` in outlet `,e.outlet)}}function tO(e,t){if(e&1&&(R(0,`span`,59),J(1),z()),e&2){let e=K().$implicit;j(),X(`(`,e.prop,`)`)}}function nO(e,t){if(e&1&&(R(0,`li`,57)(1,`span`,58),J(2),N(3,tO,2,1,`span`,59),z(),R(4,`pre`),J(5),dv(6,`json`),z()()),e&2){let e=t.$implicit;j(2),X(` `,e.name,` `),j(),P(e.prop===e.name?-1:3),j(2),Y(pv(6,3,e.value))}}function rO(e,t){if(e&1&&(R(0,`ul`,53),F(1,nO,7,5,`li`,57,FD),z()),e&2){let e=K();j(),I(e.inputs)}}function iO(e,t){e&1&&(R(0,`p`,54),J(1,`No inputs.`),z())}function aO(e,t){if(e&1&&(R(0,`li`,61)(1,`span`,50),J(2),z(),R(3,`span`,62),J(4),z()()),e&2){let e=t.$implicit;q(`on`,e.listened),j(2),Y(e.name),j(2),Y(e.listened?`listened`:`no listener`)}}function oO(e,t){if(e&1&&(R(0,`ul`,55),F(1,aO,5,4,`li`,60,FD),z()),e&2){let e=K();j(),I(e.outputs)}}function sO(e,t){e&1&&(R(0,`p`,54),J(1,`No outputs.`),z())}function cO(e,t){if(e&1&&(R(0,`span`,63),J(1),z()),e&2){let e=K().$implicit;j(),Y(e.kind)}}function lO(e,t){if(e&1&&(R(0,`li`,57)(1,`span`,58),J(2),N(3,cO,2,1,`span`,63),z(),R(4,`pre`),J(5),dv(6,`json`),z()()),e&2){let e=t.$implicit;j(2),X(` `,e.name,` `),j(),P(e.kind?3:-1),j(2),Y(pv(6,3,e.value))}}function uO(e,t){if(e&1&&(R(0,`ul`,53),F(1,lO,7,5,`li`,57,FD),z()),e&2){let e=K();j(),I(e.properties)}}function dO(e,t){e&1&&(R(0,`p`,54),J(1,`No other properties.`),z())}function fO(e,t){if(e&1&&(R(0,`li`,64),J(1),z()),e&2){let e=t.$implicit;j(),Y(e)}}function pO(e,t){if(e&1&&(R(0,`div`,51)(1,`h3`),J(2,` DOM listeners `),R(3,`span`,52),J(4),z()(),R(5,`ul`,55),F(6,fO,2,1,`li`,64,Tg),z()()),e&2){let e=K();j(4),Y(e.listeners.length),j(2),I(e.listeners)}}function mO(e,t){if(e&1&&(R(0,`li`,57)(1,`span`,58),J(2),z(),R(3,`pre`),J(4),dv(5,`json`),z()()),e&2){let e=t.$implicit;j(2),Y(e.name),j(2),Y(pv(5,2,e.value))}}function hO(e,t){if(e&1&&(R(0,`ul`,53),F(1,mO,6,4,`li`,57,FD),z()),e&2){let e=K().$implicit;j(),I(e.inputs)}}function gO(e,t){if(e&1&&(R(0,`li`,61)(1,`span`,50),J(2),z(),R(3,`span`,62),J(4),z()()),e&2){let e=t.$implicit;q(`on`,e.listened),j(2),Y(e.name),j(2),Y(e.listened?`listened`:`no listener`)}}function _O(e,t){if(e&1&&(R(0,`ul`,55),F(1,gO,5,4,`li`,60,FD),z()),e&2){let e=K().$implicit;j(),I(e.outputs)}}function vO(e,t){e&1&&(R(0,`p`,54),J(1,`No inputs or outputs.`),z())}function yO(e,t){if(e&1&&(R(0,`div`,51)(1,`h3`)(2,`span`,50),J(3),z(),R(4,`span`,63),J(5,`directive on host`),z()(),N(6,hO,3,0,`ul`,53),N(7,_O,3,0,`ul`,55),N(8,vO,2,0,`p`,54),z()),e&2){let e=t.$implicit;j(3),Y(e.name),j(3),P(e.inputs.length?6:-1),j(),P(e.outputs.length?7:-1),j(),P(!e.inputs.length&&!e.outputs.length?8:-1)}}function bO(e,t){if(e&1&&(R(0,`span`,63),J(1),z()),e&2){let e=t.$implicit;j(),Y(e)}}function xO(e,t){if(e&1&&(R(0,`span`,67),J(1,`from `),R(2,`span`,50),J(3),z()()),e&2){let e=K().$implicit;j(3),Y(e.providedByName??`an injector`)}}function SO(e,t){e&1&&(R(0,`span`,68),J(1,`not provided`),z())}function CO(e,t){if(e&1&&(R(0,`li`,65)(1,`span`,66),J(2),z(),F(3,bO,2,1,`span`,63,Tg),N(5,xO,4,1,`span`,67)(6,SO,2,0,`span`,68),z()),e&2){let e=t.$implicit;j(2),Y(e.token),j(),I(e.flags),j(2),P(e.providedBy?5:6)}}function wO(e,t){if(e&1&&(R(0,`ul`,56),F(1,CO,7,2,`li`,65,ID),z()),e&2){let e=K();j(),I(e.dependencies)}}function TO(e,t){e&1&&(R(0,`p`,54),J(1,`Nothing is injected through the constructor or inject().`),z())}function EO(e,t){if(e&1&&(R(0,`dl`,49)(1,`dt`),J(2,`Change detection`),z(),R(3,`dd`),J(4),z(),R(5,`dt`),J(6,`Encapsulation`),z(),R(7,`dd`),J(8),z(),R(9,`dt`),J(10,`Host path`),z(),R(11,`dd`,50),J(12),z(),F(13,eO,4,2,null,null,MD),z(),R(15,`div`,51)(16,`h3`),J(17,` Inputs `),R(18,`span`,52),J(19),z()(),N(20,rO,3,0,`ul`,53)(21,iO,2,0,`p`,54),z(),R(22,`div`,51)(23,`h3`),J(24,` Outputs `),R(25,`span`,52),J(26),z()(),N(27,oO,3,0,`ul`,55)(28,sO,2,0,`p`,54),z(),R(29,`div`,51)(30,`h3`),J(31,` Properties `),R(32,`span`,52),J(33),z()(),N(34,uO,3,0,`ul`,53)(35,dO,2,0,`p`,54),z(),N(36,pO,8,1,`div`,51),F(37,yO,9,4,`div`,51,PD),R(39,`div`,51)(40,`h3`),J(41,` Injected `),R(42,`span`,52),J(43),z()(),N(44,wO,3,0,`ul`,56)(45,TO,2,0,`p`,54),z()),e&2){let e=t,n=K(),r=K(2);j(4),Y(e.changeDetection??`Unknown`),j(4),Y(e.encapsulation??`Unknown`),j(4),Y(e.path),j(),I(r.routedById().get(n.id)??ov(12,AD)),j(6),Y(e.inputs.length),j(),P(e.inputs.length?20:21),j(6),Y(e.outputs.length),j(),P(e.outputs.length?27:28),j(6),Y(e.properties?.length??0),j(),P(e.properties?.length?34:35),j(2),P(e.listeners.length?36:-1),j(),I(e.directives),j(6),Y(e.dependencies.length),j(),P(e.dependencies.length?44:45)}}function DO(e,t){e&1&&(R(0,`div`,44),B(1,`span`,69),R(2,`p`,27),J(3,`Reading live values from the page…`),z()())}function OO(e,t){if(e&1&&(R(0,`section`,17)(1,`header`,40)(2,`span`,41),J(3,`component`),z(),R(4,`h2`,42),J(5),z(),R(6,`span`,43),J(7),z(),N(8,$D,3,3),z(),N(9,EO,46,13)(10,DO,4,0,`div`,44),z()),e&2){let e,n,r=t,i=K(2);j(5),Y(r.name),j(2),X(`<`,r.tag,`>`),j(),P((e=i.sourceFor(r))?8:-1,e),j(),P((n=i.detail())?9:10,n)}}function kO(e,t){e&1&&(R(0,`p`,26),J(1,`The selected component was destroyed`),z(),R(2,`p`,27)(3,`span`,50),J(4),z(),J(5,` is no longer on the page. Select another component to see its live values. `),z()),e&2&&(j(4),Y(t))}function AO(e,t){e&1&&(R(0,`p`,27),J(1,` Select a component to see its live inputs, properties, outputs, change detection and injected services. `),z())}function jO(e,t){if(e&1&&(R(0,`div`,18),N(1,kO,6,1)(2,AO,2,0,`p`,27),z()),e&2){let e,t=K(2);j(),P((e=t.destroyed())?1:2,e)}}function MO(e,t){e&1&&(R(0,`span`,63),J(1,`hydrate never`),z())}function NO(e,t){if(e&1&&(R(0,`span`,63),J(1),z()),e&2){let e=K().$implicit;j(),Y(e.hydration)}}function PO(e,t){if(e&1){let e=W();R(0,`li`)(1,`button`,72),G(`click`,function(){let t=O(e).$implicit;return k(K(3).showOwner(t))})(`focus`,function(){let t=O(e).$implicit;return k(K(3).highlightBlock(t))})(`blur`,function(){return O(e),k(K(3).highlight(null))})(`mouseenter`,function(){let t=O(e).$implicit;return k(K(3).highlightBlock(t))})(`mouseleave`,function(){return O(e),k(K(3).highlight(null))}),R(2,`span`,32),J(3),z(),R(4,`span`,73),J(5),z(),N(6,MO,2,0,`span`,63)(7,NO,2,1,`span`,63),R(8,`span`,74),J(9),z()()()}if(e&2){let e=t.$implicit;j(),L(`disabled`,!e.owner),j(2),Y(e.owner?.name??`Unknown component`),j(),w_(`state-`+e.state),j(),Y(e.state),j(),P(e.hydrateNever?6:e.hydration===`not-configured`?-1:7),j(3),Y(e.triggers.join(`, `)||`no triggers`)}}function FO(e,t){if(e&1&&(R(0,`section`,19)(1,`h2`,70),J(2,` Defer blocks `),R(3,`span`,52),J(4),z()(),R(5,`ul`,71),F(6,PO,10,7,`li`,null,LD),z()()),e&2){let e=K(2);j(4),Y(e.deferBlocks().length),j(2),I(e.deferBlocks())}}function IO(e,t){if(e&1&&B(0,`app-cd-recording`,20),e&2){let e=K(2);L(`page`,e.cdPage())(`pageId`,e.page().pageId)(`rpc`,e.rpc())}}function LO(e,t){if(e&1){let e=W();R(0,`p`,0),J(1,` Every component instance on the page, in the order Angular rendered them. Hover a row to highlight its host in the page, and select it to read its live inputs, properties, outputs and injected services. `),z(),R(2,`div`,1)(3,`div`,2),ps(),R(4,`svg`,3),B(5,`circle`,4)(6,`path`,5),z(),ms(),R(7,`input`,6),G(`input`,function(t){return O(e),k(K().setFilter(t.target.value))})(`keydown.escape`,function(){return O(e),k(K().setFilter(``))}),z()(),N(8,zD,3,2),R(9,`span`,7),J(10),z(),N(11,BD,4,3,`button`,8),z(),R(12,`p`,9),J(13),z(),N(14,VD,2,1,`p`,10),N(15,HD,2,1,`p`,11),R(16,`div`,12)(17,`div`)(18,`h2`,13),J(19,`Component tree`),z(),N(20,WD,6,2,`div`,14),R(21,`div`,15),G(`keydown`,function(t){return O(e),k(K().onTreeKey(t))}),F(22,XD,11,15,`div`,16,jD),z()(),N(24,OO,11,4,`section`,17)(25,jO,3,1,`div`,18),z(),N(26,FO,8,1,`section`,19),N(27,IO,1,3,`app-cd-recording`,20)}if(e&2){let e,t=K();j(7),L(`value`,t.filter()),j(),P(t.pageOptions().length>1?8:-1),j(2),Y(t.countLabel()),j(),P(t.native()?-1:11),j(2),Y(t.announcement()),j(),P(t.pickMessage()?14:-1),j(),P(t.page().truncated?15:-1),j(5),P(t.rows().length?-1:20),j(),L(`hidden`,!t.rows().length),j(),I(t.rows()),j(2),P((e=t.selectedNode())?24:25,e),j(2),P(t.deferBlocks().length?26:-1),j(),P(!t.staticReport()&&!t.native()?27:-1)}}function RO(e,t){e&1&&(R(0,`p`,11),J(1,` The page reported no component instances. The live tree needs a development build with Angular's debug API. Showing what the source declares instead. `),z())}function zO(e,t){e&1&&(R(0,`p`,75),J(1,` No page is connected, so this lists what the source declares. Open the app in a browser with the devtools connected to see each rendered instance. `),z())}function BO(e,t){if(e&1&&J(0),e&2){let e=K(3);Z(` `,e.filteredSource().length,` of `,e.source().length,` `)}}function VO(e,t){if(e&1&&J(0),e&2){let e=K(3);X_(` `,e.sourceCounts().components,` `,e.sourceCounts().components===1?`component`:`components`,` · `,e.sourceCounts().directives,` `,e.sourceCounts().directives===1?`directive`:`directives`,` `)}}function HO(e,t){if(e&1&&(R(0,`span`,77),N(1,BO,1,2)(2,VO,1,4),z()),e&2){let e=K(2);j(),P(e.filter().trim()?1:2)}}function UO(e,t){e&1&&(R(0,`div`,81),B(1,`span`,69),R(2,`p`,26),J(3,`Scanning components…`),z()())}function WO(e,t){e&1&&(J(0,` Run `),R(1,`code`),J(2,`ng-devtools build`),z(),J(3,` again to rebuild the report. `))}function GO(e,t){e&1&&J(0,` Check that the dev server is running, then try again. `)}function KO(e,t){if(e&1){let e=W();R(0,`div`,82)(1,`p`,26),J(2,`Could not load components`),z(),R(3,`p`,27),N(4,WO,4,0)(5,GO,1,0),z(),R(6,`button`,28),G(`click`,function(){return O(e),k(K(2).refresh())}),J(7,`Retry`),z()()}if(e&2){let e=K(2);j(4),P(e.staticReport()?4:5)}}function qO(e,t){e&1&&(R(0,`div`,73)(1,`p`,26),J(2,`No components found`),z(),R(3,`p`,27),J(4,`No @Component or @Directive was found in the source.`),z()())}function JO(e,t){if(e&1){let e=W();R(0,`div`,73)(1,`p`,26),J(2),z(),R(3,`button`,28),G(`click`,function(){return O(e),k(K(2).filter.set(``))}),J(4,`Clear filter`),z()()}if(e&2){let e=K(2);j(2),X(`No components match “`,e.filter().trim(),`”`)}}function YO(e,t){if(e&1&&J(0),e&2){let e=K().$implicit;X(` `,K(3).bareName(e.className),` · `)}}function XO(e,t){if(e&1&&(R(0,`dt`),J(1,`Change detection`),z(),R(2,`dd`),J(3),z()),e&2){let e=K(2).$implicit;j(3),Y(e.changeDetection??`Unknown`)}}function ZO(e,t){if(e&1){let e=W();R(0,`button`,48),G(`click`,function(){let t=O(e).$implicit;return k(K(5).showForm.emit(t.formId))}),J(1),z()}if(e&2){let e=t.$implicit;j(),X(` Show `,e.label,` in Forms `)}}function QO(e,t){if(e&1&&(R(0,`div`,92)(1,`dl`,49)(2,`dt`),J(3,`Class`),z(),R(4,`dd`,50),J(5),z(),R(6,`dt`),J(7,`File`),z(),R(8,`dd`,50),J(9),z(),R(10,`dt`),J(11,`Standalone`),z(),R(12,`dd`),J(13),z(),N(14,XO,4,1),R(15,`dt`),J(16,`Inputs`),z(),R(17,`dd`,50),J(18),z(),R(19,`dt`),J(20,`Outputs`),z(),R(21,`dd`,50),J(22),z()(),F(23,ZO,2,1,`button`,47,ND),z()),e&2){let e=K(),t=e.$implicit,n=e.$index,r=K(3);L(`id`,`ct-source-`+n),j(5),Y(r.bareName(t.className)),j(4),Z(``,t.file,`:`,t.line),j(4),Y(t.isStandalone?`Yes`:`No`),j(),P(t.kind===`component`?14:-1),j(4),Y(t.inputs.join(`, `)||`None`),j(4),Y(t.outputs.join(`, `)||`None`),j(),I(r.formsIn(t.file))}}function $O(e,t){if(e&1){let e=W();R(0,`li`,85)(1,`button`,86),G(`click`,function(){let t=O(e).$implicit,n=K(3);return k(n.openKey.set(n.openKey()===n.sourceKey(t)?null:n.sourceKey(t)))}),R(2,`span`,87),J(3),z(),R(4,`span`,88)(5,`span`,89),J(6),z(),R(7,`span`,90),N(8,YO,1,1),J(9),z()(),ps(),R(10,`svg`,91),B(11,`path`,39),z()(),N(12,QO,25,8,`div`,92),z()}if(e&2){let e=t.$implicit,n=t.$index,r=K(3);q(`expanded`,r.openKey()===r.sourceKey(e)),j(),M(`aria-expanded`,r.openKey()===r.sourceKey(e))(`aria-controls`,r.openKey()===r.sourceKey(e)?`ct-source-`+n:null),j(),q(`directive`,e.kind===`directive`),j(),Y(e.kind),j(3),Y(r.sourceLabel(e)),j(2),P(e.selector?8:-1),j(),Z(` `,e.file,`:`,e.line,` `),j(3),P(r.openKey()===r.sourceKey(e)?12:-1)}}function ek(e,t){if(e&1&&(R(0,`ul`,83),F(1,$O,13,12,`li`,84,RD,!0),z()),e&2){let e=K(2);j(),I(e.filteredSource())}}function tk(e,t){if(e&1){let e=W();N(0,RO,2,0,`p`,11)(1,zO,2,0,`p`,75),R(2,`div`,1)(3,`div`,2),ps(),R(4,`svg`,3),B(5,`circle`,4)(6,`path`,5),z(),ms(),R(7,`input`,76),G(`input`,function(t){return O(e),k(K().filter.set(t.target.value))})(`keydown.escape`,function(){return O(e),k(K().filter.set(``))}),z()(),N(8,HO,3,1,`span`,77),R(9,`button`,78),G(`click`,function(){return O(e),k(K().refresh())}),ps(),R(10,`svg`,24),B(11,`path`,79)(12,`path`,80),z(),J(13,` Refresh `),z()(),N(14,UO,4,0,`div`,81)(15,KO,8,1,`div`,82)(16,qO,5,0,`div`,73)(17,JO,5,1,`div`,73)(18,ek,3,0,`ul`,83)}if(e&2){let e=K();P(+!e.page()),j(7),L(`value`,e.filter()),j(),P(e.source().length?8:-1),j(),q(`spinning`,e.loading()),M(`aria-busy`,e.loading()),j(5),P(e.loading()&&!e.source().length?14:e.error()&&!e.source().length?15:e.source().length?e.filteredSource().length?18:17:16)}}function nk(e){return e.replace(/^_(?=[A-Z])/,``)}var rk=class e{rpc=$(null);staticReport=Q(()=>rE(this.rpc()));focus=$(null);showForm=Ov();focusHandled=Ov();filter=A(``);loading=A(!1);error=A(!1);source=A([]);formOwners=A([]);pages=A({});chosenPageId=A(null);selectedId=A(null);destroyed=A(null);announcement=A(``);picking=A(!1);pickMessage=A(``);pickPageId=null;pickSeq=0;focusId=A(null);collapsed=A(new Set);openKey=A(null);outlets=A([]);pageId=ZT();destroyRef=E(ws);injector=E(Ss);host=E(Nl);cleanups=[];selection={pageId:null,detailId:null};shownPageId=Tv({source:()=>({pages:this.pages(),chosen:this.chosenPageId()}),computation:({pages:e,chosen:t},n)=>QT(e,{chosen:t,host:this.pageId,previous:n?.value??null})});page=Q(()=>{let e=this.shownPageId();return e?this.pages()[e]??null:null});pageOptions=Q(()=>Object.values(this.pages()).map(e=>({value:e.pageId,label:e.title||e.url||`Page ${e.pageId}`,hint:e.url})));live=Q(()=>(this.page()?.roots.length??0)>0);native=Q(()=>YE(this.page()));cdPages=A({});cdPage=Q(()=>{let e=this.page()?.pageId;return e?this.cdPages()[e]??null:null});cdHosts=Q(()=>this.cdPage()?.hosts??{});index=Q(()=>{let e=new Map,t=new Map,n=(r,i)=>{for(let a of r)e.set(a.id,a),i&&t.set(a.id,i),n(a.children,a.id)};return n(this.page()?.roots??[],null),{map:e,parents:t}});query=Q(()=>this.filter().trim().toLowerCase());filtered=Q(()=>sD(this.page()?.roots??[],this.query()));deferBlocks=Q(()=>this.page()?.deferBlocks??[]);countLabel=Q(()=>cD(this.page()?.count??0,this.filtered().matches,!!this.query(),!!this.page()?.truncated));truncationText=Q(()=>uD(this.page()?.truncatedBy));rows=Q(()=>{let e=[],t=this.collapsed(),n=!!this.query(),r=(i,a)=>{for(let o of i){let i=n||!t.has(o.id);e.push({node:o,depth:a,hasChildren:o.children.length>0,expanded:i}),i&&r(o.children,a+1)}};return r(this.filtered().nodes,0),e});selectedNode=Q(()=>{let e=this.selectedId();return e?this.index().map.get(e)??null:null});detail=Q(()=>{let e=this.page()?.detail;return e&&e.id===this.selectedId()?e:null});rovingId=Q(()=>{let e=this.rows(),t=new Set(e.map(e=>e.node.id)),n=this.focusId();if(n&&t.has(n))return n;let r=this.selectedId();return r&&t.has(r)?r:e[0]?.node.id??null});routedById=Q(()=>{let e=new Map,t=n=>{for(let r of n){if(r.activated&&r.devtoolsId){let t=e.get(r.devtoolsId)??[];t.push({route:r.route??``,outlet:r.outlet}),e.set(r.devtoolsId,t)}r.children&&t(r.children)}};return t(this.outlets()),e});sourceByClass=Q(()=>{let e=new Map;for(let t of this.source()){let n=nk(t.className);e.set(n,[...e.get(n)??[],t])}return e});filteredSource=Q(()=>{let e=this.query(),t=this.source();return e?t.filter(t=>t.selector.toLowerCase().includes(e)||t.className.toLowerCase().includes(e)||t.file.toLowerCase().includes(e)):t});sourceCounts=Q(()=>{let e=this.source().filter(e=>e.kind===`component`).length;return{components:e,directives:this.source().length-e}});constructor(){dc(()=>{let e=this.page()?.pageId??null;Cv(()=>{this.picking()&&e!==this.pickPageId&&this.dropPick()})}),dc(()=>{let e=this.rpc();e&&(this.refresh(),this.watch(e))}),dc(()=>{let e=this.focus();e&&this.live()&&Cv(()=>{this.index().map.has(e.id)&&this.reveal(e.id),this.focusHandled.emit()})}),this.destroyRef.onDestroy(()=>{this.highlight(null);for(let e of this.cleanups.splice(0))e()})}async watch(e){for(let e of this.cleanups.splice(0))e();let t=e.scope(`ng-devtools`);try{let e=await t.rpc.sharedState(`component-tree`);if(this.destroyRef.destroyed)return;let n=e=>{let t=e?.pages;this.applyPages(t&&typeof t==`object`?t:{})};n(e.value()),this.cleanups.push(e.on(`updated`,n))}catch{this.applyPages({})}try{let e=await t.rpc.sharedState(`change-detection`);if(this.destroyRef.destroyed)return;let n=e=>{let t=e?.pages;this.cdPages.set(t&&typeof t==`object`?t:{})};n(e.value()),this.cleanups.push(e.on(`updated`,n))}catch{this.cdPages.set({})}try{let e=await t.rpc.sharedState(`router`);if(this.destroyRef.destroyed)return;let n=e=>{let t=e?.pages??[],n=this.pageId?t.find(e=>e.pageId===this.pageId):t.find(e=>e.snapshot)??t[0];this.outlets.set(n?.outlets??[])};n(e.value()),this.cleanups.push(e.on(`updated`,n))}catch{this.outlets.set([])}}async refresh(){let e=this.rpc();if(!e)return;this.loading.set(!0);let t=e.scope(`ng-devtools`);try{this.source.set(await t.rpc.call(`get-components`)),this.error.set(!1)}catch{this.error.set(!0)}finally{this.loading.set(!1)}let n=await t.rpc.call(`forms-owners`).catch(()=>[]);this.formOwners.set(n??[])}formsIn(e){return this.formOwners().filter(t=>t.file===e)}sourceFor(e){let t=(this.sourceByClass().get(nk(e.name))??[]).filter(e=>e.kind===`component`);return t.find(t=>t.selector===e.tag)??t[0]??null}sourceKey(e){return`${e.file}#${e.className}`}sourceLabel(e){return e.selector?e.kind===`component`&&/^[a-z][\w-]*$/i.test(e.selector)?`<${e.selector}>`:e.selector:nk(e.className)}bareName(e){return nk(e)}applyPages(e){let t=document.activeElement,n=t instanceof HTMLElement&&this.host.nativeElement.contains(t)?t.closest(`.row`)?.dataset.id??null:null,r=n?this.rows().map(e=>e.node.id):[],i=this.index().map;if(this.pages.set(e),this.syncSelection(i),!n)return;let a=new Set(this.rows().map(e=>e.node.id));if(a.has(n))return;let o=pD(r,a,n);o&&(this.focusId.set(o),Ld(()=>this.rowElement(o)?.focus(),{injector:this.injector}))}syncSelection(e=this.index().map){let t=this.page(),n=dD({...this.selection,selectedId:this.selectedId()},t?{pageId:t.pageId,roots:t.roots,detail:t.detail,truncated:t.truncated}:null),r=n.destroyed?e.get(n.destroyed)?.name:void 0;this.selection={pageId:n.pageId,detailId:n.detailId},n.selectedId!==this.selectedId()&&this.selectedId.set(n.selectedId),n.selectedId&&this.destroyed.set(null),n.destroyed&&(this.destroyed.set(r??`The component`),this.announcement.set(`The selected component was destroyed.`),this.sendSelection(null))}selectPage(e){e&&(this.chosenPageId.set(e),this.destroyed.set(null),this.syncSelection())}setFilter(e){this.filter.set(e);let{matches:t}=this.filtered();this.announcement.set(lD(this.page()?.count??0,t,e,!!this.page()?.truncated))}async pick(){let e=this.rpc();if(!e||this.picking())return;let t=++this.pickSeq;this.pickPageId=this.page()?.pageId??null,this.picking.set(!0),this.say(`Click a component in the app. Press Escape to cancel.`);let n=await e.scope(`ng-devtools`).rpc.call(`request-component-pick`,{pageId:this.pickPageId??void 0}).catch(()=>({ok:!1,error:`Could not reach the devtools server.`}));if(t===this.pickSeq){if(this.picking.set(!1),!n?.ok||!n.id){this.say(n?.error??`No component was picked.`);return}n.pageId&&n.pageId!==this.page()?.pageId&&this.selectPage(n.pageId),this.say(`Picked ${n.name??`a component`}.`),this.destroyed.set(null),this.index().map.has(n.id)?this.reveal(n.id):this.selectedId.set(n.id)}}cancelPick(){let e=this.rpc();e&&this.picking()&&e.scope(`ng-devtools`).rpc.call(`cancel-component-pick`,{pageId:this.pickPageId??void 0}).catch(()=>{})}dropPick(){this.cancelPick(),this.pickSeq++,this.picking.set(!1),this.say(`Picking stopped because the page changed.`)}say(e){this.pickMessage.set(e),this.announcement.set(e)}sendSelection(e){let t=this.rpc();t&&t.scope(`ng-devtools`).rpc.call(`select-component`,{pageId:this.page()?.pageId,id:e}).catch(()=>{})}rowElement(e){return this.host.nativeElement.querySelector(`.row[data-id="${CSS.escape(e)}"]`)}select(e){let t=this.selectedId()===e?null:e;this.selectedId.set(t),this.destroyed.set(null),this.focusId.set(e),this.sendSelection(t)}reveal(e){let{parents:t}=this.index();this.collapsed.update(n=>{let r=new Set(n);for(let n=t.get(e);n;n=t.get(n))r.delete(n);return r}),this.rows().some(t=>t.node.id===e)||this.setFilter(``),this.selectedId()!==e&&this.select(e),Ld(()=>document.querySelector(`.row[data-id="${CSS.escape(e)}"]`)?.scrollIntoView({block:`nearest`}),{injector:this.injector})}toggle(e,t){t?.stopPropagation(),!this.query()&&this.collapsed.update(t=>{let n=new Set(t);return n.has(e)?n.delete(e):n.add(e),n})}highlight(e){let t=this.rpc();if(!t)return;let n=e?{pageId:this.page()?.pageId,id:e}:null;t.scope(`ng-devtools`).rpc.call(`request-page-highlight`,n).catch(()=>{})}highlightBlock(e){this.highlight(e.rootIds[0]??e.owner?.id??null)}showOwner(e){e.owner&&this.index().map.has(e.owner.id)&&this.reveal(e.owner.id)}onTreeKey(e){let t=this.rows();if(!t.length)return;let n=t.findIndex(e=>e.node.id===this.rovingId()),r=Math.max(n,0),i=t[r],a=-1;switch(e.key){case`ArrowDown`:a=Math.min(r+1,t.length-1);break;case`ArrowUp`:a=Math.max(r-1,0);break;case`Home`:a=0;break;case`End`:a=t.length-1;break;case`ArrowRight`:i.hasChildren&&!i.expanded?this.toggle(i.node.id):i.hasChildren&&(a=r+1);break;case`ArrowLeft`:if(i.hasChildren&&i.expanded&&!this.query())this.toggle(i.node.id);else{let e=this.index().parents.get(i.node.id);a=t.findIndex(t=>t.node.id===e)}break;case`Enter`:case` `:this.select(i.node.id);break;default:return}if(e.preventDefault(),a>=0){let e=t[a].node.id;this.focusId.set(e),queueMicrotask(()=>{let t=document.querySelector(`.row[data-id="${CSS.escape(e)}"]`);t?.focus(),t?.scrollIntoView({block:`nearest`})})}}static ɵfac=function(t){return new(t||e)};static ɵcmp=Vh({type:e,selectors:[[`app-component-tree`]],hostBindings:function(e,t){e&1&&G(`keydown.escape`,function(){return t.cancelPick()})},inputs:{rpc:[1,`rpc`],focus:[1,`focus`]},outputs:{showForm:`showForm`,focusHandled:`focusHandled`},decls:2,vars:1,consts:[[1,`intro`],[1,`toolbar`],[1,`search`],[`viewBox`,`0 0 24 24`,`aria-hidden`,`true`,1,`search-icon`],[`cx`,`11`,`cy`,`11`,`r`,`7`],[`d`,`m20 20-3.5-3.5`],[`type`,`search`,`placeholder`,`Filter by class, tag or directive…`,`aria-label`,`Filter components by class, tag or directive`,`autocomplete`,`off`,`spellcheck`,`false`,3,`input`,`keydown.escape`,`value`],[1,`count`],[`type`,`button`,1,`pick`,3,`on`],[`role`,`status`,1,`sr-only`],[1,`pick-message`],[`role`,`status`,1,`notice`],[1,`layout`],[1,`sr-only`],[1,`state`,`compact`,`tree`],[`role`,`tree`,`aria-label`,`Component instances`,1,`tree`,3,`keydown`,`hidden`],[`role`,`treeitem`,1,`row`,3,`selected`,`--%NS%depth`],[`aria-labelledby`,`ct-detail-title`,1,`detail`],[1,`detail`,`placeholder`],[`aria-labelledby`,`ct-defer-title`,1,`defer`],[3,`page`,`pageId`,`rpc`],[`id`,`ct-page-label`,1,`sr-only`],[`labelledBy`,`ct-page-label`,1,`page-select`,3,`valueChange`,`options`,`value`],[`type`,`button`,1,`pick`,3,`click`],[`viewBox`,`0 0 24 24`,`aria-hidden`,`true`],[`d`,`M4 4l6.5 16 2.3-6.7L19.5 11z`],[1,`state-title`],[1,`state-hint`],[`type`,`button`,3,`click`],[`role`,`treeitem`,1,`row`,3,`click`,`focus`,`blur`,`mouseenter`,`mouseleave`],[`aria-hidden`,`true`,1,`twisty`,3,`open`],[`aria-hidden`,`true`,1,`twisty-space`],[1,`name`,`mono`],[1,`tag`,`mono`],[1,`routed`],[1,`checks`],[1,`dirs`],[`aria-hidden`,`true`,1,`twisty`,3,`click`],[`viewBox`,`0 0 24 24`],[`d`,`m9 6 6 6-6 6`],[1,`detail-head`],[1,`badge`],[`id`,`ct-detail-title`,1,`mono`],[1,`mono`,`muted`],[`role`,`status`,1,`state`,`compact`],[1,`where`,`mono`],[1,`actions`],[`type`,`button`,1,`show-form`],[`type`,`button`,1,`show-form`,3,`click`],[1,`facts`],[1,`mono`],[1,`block`],[1,`pill`],[1,`props`],[1,`empty-line`],[1,`chips`],[1,`deps`],[1,`prop`],[1,`prop-name`,`mono`],[1,`muted`],[1,`chip`,3,`on`],[1,`chip`],[1,`chip-note`],[1,`flag`],[1,`chip`,`mono`],[1,`dep`],[1,`token`,`mono`],[1,`from`],[1,`from`,`missing`],[`aria-hidden`,`true`,1,`spinner`],[`id`,`ct-defer-title`,1,`defer-title`],[1,`defer-list`],[`type`,`button`,1,`defer-row`,3,`click`,`focus`,`blur`,`mouseenter`,`mouseleave`,`disabled`],[1,`state`],[1,`triggers`,`mono`],[1,`notice`],[`type`,`search`,`placeholder`,`Filter by selector, class or file…`,`aria-label`,`Filter components by selector, class or file`,`autocomplete`,`off`,`spellcheck`,`false`,3,`input`,`keydown.escape`,`value`],[`aria-live`,`polite`,1,`count`],[`type`,`button`,1,`refresh`,3,`click`],[`d`,`M20 12a8 8 0 1 1-2.34-5.66`],[`d`,`M20 4v5h-5`],[`role`,`status`,1,`state`],[`role`,`alert`,1,`state`],[`role`,`list`,1,`source-list`],[1,`source-item`,3,`expanded`],[1,`source-item`],[`type`,`button`,1,`source-toggle`,3,`click`],[1,`kind-flag`],[1,`row-main`],[1,`selector`,`mono`],[1,`file`,`mono`],[`viewBox`,`0 0 24 24`,`aria-hidden`,`true`,1,`chevron`],[1,`inline-detail`,3,`id`]],template:function(e,t){e&1&&N(0,LO,28,12)(1,tk,19,7),e&2&&P(+!t.live())},dependencies:[oD,kD,ab],styles:[`[_nghost-%COMP%] {
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

.state[_ngcontent-%COMP%] {
  padding: 0 8px;
  border-radius: 99px;
  background: var(--%NS%surface-3);
  color: var(--%NS%text-2);
  font-size: 11px;
  line-height: 18px;
}

.state-complete[_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%ok) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%ok) 12%, transparent);
  color: var(--%NS%ok);
}

.state-error[_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%danger) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%danger) 12%, transparent);
  color: var(--%NS%danger);
}

.state-loading[_ngcontent-%COMP%], 
.state-placeholder[_ngcontent-%COMP%] {
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
}`]})};function ik(e){return e.line?`${e.file}:${e.line}`:e.file}function ak(e,t){let n=t.filter(t=>t.fullPath===e.fullPath&&t.redirectTo!==void 0==(e.redirectTo!==void 0));return n.find(t=>!!e.component&&t.component===e.component)??n.find(t=>!t.component||!e.component)}var ok=nE;function sk(e){return e.startsWith(`/`)&&!e.startsWith(`//`)&&!/^\/*[a-z][a-z0-9+.-]*:/i.test(e)&&!e.includes(`[redacted]`)&&e.length<=2e3}async function ck(e,t,n){return await ok(e,`request-router-action`,{pageId:t,request:n})??{error:`Could not reach the page.`}}function lk(e){return e===`succeeded`?`good`:e===`redirected`||e===`pending`||e===`skipped`?`warn`:e===`cancelled`||e===`failed`?`bad`:``}var uk=()=>[],dk=(e,t)=>t[0],fk=(e,t)=>t.input;function pk(e,t){if(e&1&&(V(0,`p`,3),J(1,` The browser shows `),V(2,`code`),J(3),H(),J(4,`, not the router URL (skipLocationChange, browserUrl, a failed navigation or code that changed history). `),H()),e&2){let e=K();j(3),Y(e.browserUrl)}}function mk(e,t){if(e&1&&(V(0,`p`,12),J(1),H()),e&2){let e=K(3);j(),Y(e.navigationOff)}}function hk(e,t){if(e&1){let e=W();V(0,`div`,8),U(1,`span`,9),V(2,`span`,10),J(3,`Navigating to `),V(4,`code`),J(5),H(),J(6),H(),V(7,`button`,11),Qg(`click`,function(){return O(e),k(K(2).abort())}),J(8,` Abort `),H()(),N(9,mk,2,1,`p`,12)}if(e&2){let e=t,n=K(2);j(5),Y(e.url),j(),X(` (#`,e.id,`)`),j(),Vg(`disabled`,!n.navigationAllowed()),M(`aria-describedby`,n.navigationAllowed()?null:`route-current-writes-off`),j(2),P(n.navigationAllowed()?-1:9)}}function gk(e,t){if(e&1&&(V(0,`p`,4),J(1),H()),e&2){let e=K(2);j(),Y(e.message())}}function _k(e,t){if(e&1&&(V(0,`dt`),J(1,`Document title`),H(),V(2,`dd`),J(3),H()),e&2){let e=K();j(3),Y(e.title)}}function vk(e,t){if(e&1&&(V(0,`dt`),J(1,`Query params`),H(),V(2,`dd`)(3,`code`),J(4),dv(5,`json`),H()()),e&2){let e=K();j(4),Y(pv(5,1,e.queryParams))}}function yk(e,t){if(e&1&&(V(0,`dt`),J(1,`Fragment`),H(),V(2,`dd`)(3,`code`),J(4),H()()),e&2){let e=K();j(4),Y(e.fragment)}}function bk(e,t){if(e&1&&(V(0,`span`,14),J(1),H()),e&2){let e=K().$implicit;j(),Y(e.route.outlet)}}function xk(e,t){e&1&&(V(0,`span`,14),J(1,`lazy`),H())}function Sk(e,t){if(e&1&&(V(0,`div`,15),J(1),H()),e&2){let e=K().$implicit;j(),Z(` title `,e.route.title,``,e.route.ownTitle===!1?` (inherited)`:``,` `)}}function Ck(e,t){if(e&1&&(V(0,`code`,16),J(1),H()),e&2){let e=K().$implicit;j(),Y(e.route.component)}}function wk(e,t){e&1&&(V(0,`span`,19),J(1,`–`),H(),V(2,`span`,20),J(3,`none`),H())}function Tk(e,t){e&1&&(V(0,`span`,14),J(1,`inherited`),H())}function Ek(e,t){if(e&1&&(V(0,`div`,17)(1,`code`),J(2),dv(3,`json`),H(),N(4,Tk,2,0,`span`,14),H()),e&2){let e=t.$implicit,n=K().$implicit;j(2),Z(``,e[0],`: `,pv(3,3,e[1])),j(2),P(n.route.paramSources?.[e[0]]===`inherited`?4:-1)}}function Dk(e,t){e&1&&(V(0,`span`,19),J(1,`–`),H(),V(2,`span`,20),J(3,`none`),H())}function Ok(e,t){e&1&&(V(0,`span`,14),J(1),H()),e&2&&(j(),Y(t))}function kk(e,t){if(e&1&&(V(0,`div`,18)(1,`code`),J(2),dv(3,`json`),H(),N(4,Ok,2,1,`span`,14),H()),e&2){let e,n=t.$implicit,r=K().$implicit;j(2),Z(``,n[0],`: `,pv(3,3,n[1])),j(2),P((e=r.route.dataSources?.[n[0]])?4:-1,e)}}function Ak(e,t){e&1&&(V(0,`span`,19),J(1,`–`),H(),V(2,`span`,20),J(3,`none`),H())}function jk(e,t){if(e&1&&(V(0,`span`,14),J(1),H()),e&2){let e=t.$implicit;j(),Y(e)}}function Mk(e,t){if(e&1&&(V(0,`span`,14),J(1),H()),e&2){let e=t.$implicit;j(),X(`resolve `,e)}}function Nk(e,t){e&1&&(V(0,`span`,19),J(1,`–`),H(),V(2,`span`,20),J(3,`none`),H())}function Pk(e,t){if(e&1&&(V(0,`tr`)(1,`td`,13),J(2),N(3,bk,2,1,`span`,14),N(4,xk,2,0,`span`,14),N(5,Sk,2,2,`div`,15),H(),V(6,`td`),N(7,Ck,2,1,`code`,16)(8,wk,4,0),H(),V(9,`td`),F(10,Ek,5,5,`div`,17,dk,!1,Dk,4,0),H(),V(13,`td`),F(14,kk,5,5,`div`,18,dk,!1,Ak,4,0),H(),V(17,`td`),F(18,jk,2,1,`span`,14,Tg),F(20,Mk,2,1,`span`,14,Tg),N(22,Nk,4,0),H()()),e&2){let e=t.$implicit,n=K(2);j(),C_(`padding-left`,14+e.depth*16,`px`),j(),X(` `,e.depth===0&&!e.route.path?`(root)`:`/`+e.route.path,` `),j(),P(e.route.outlet===`primary`?-1:3),j(),P(e.route.lazy?4:-1),j(),P(e.route.title?5:-1),j(2),P(e.route.component?7:8),j(3),I(n.entries(e.route.params)),j(4),I(n.entries(e.route.data)),j(4),I(n.guardList(e.route)),j(2),I(e.route.resolvers??ov(10,uk)),j(2),P(!n.guardList(e.route).length&&!e.route.resolvers?.length?22:-1)}}function Fk(e,t){if(e&1&&(V(0,`code`),J(1),H(),J(2,` for `),V(3,`code`),J(4),H()),e&2){let e=K().$implicit;j(),Y(e.outlet.component??`?`),j(3),Y(e.outlet.route??`?`)}}function Ik(e,t){e&1&&(V(0,`span`,23),J(1,`not activated`),H())}function Lk(e,t){e&1&&(V(0,`span`,14),J(1,`detached by reuse strategy`),H())}function Rk(e,t){if(e&1&&(V(0,`span`,14),J(1),H()),e&2){let e=t.$implicit;j(),Z(`input `,e.input,` ← `,e.source)}}function zk(e,t){if(e&1&&(V(0,`span`,24),J(1,`routerOutletData `),V(2,`code`),J(3),H()()),e&2){let e=K().$implicit;j(3),Y(e.outlet.data)}}function Bk(e,t){if(e&1&&(V(0,`li`)(1,`span`,14),J(2),H(),N(3,Fk,5,2)(4,Ik,2,0,`span`,23),N(5,Lk,2,0,`span`,14),F(6,Rk,2,2,`span`,14,fk),N(8,zk,4,1,`span`,24),H()),e&2){let e=t.$implicit,n=K(3);C_(`padding-left`,10+e.depth*16,`px`),j(2),Y(e.outlet.outlet),j(),P(e.outlet.activated?3:4),j(2),P(e.outlet.detached?5:-1),j(),I(n.boundInputs(e.outlet)),j(2),P(e.outlet.data===void 0?-1:8)}}function Vk(e,t){if(e&1&&(V(0,`h3`),J(1,`Outlets`),H(),V(2,`ul`,21),F(3,Bk,9,6,`li`,22,wg),H()),e&2){let e=K(2);j(3),I(e.outletRows())}}function Hk(e,t){if(e&1&&(V(0,`p`,1)(1,`span`,2),J(2,`URL`),H(),V(3,`code`),J(4),H()(),N(5,pk,5,1,`p`,3),N(6,hk,10,5),N(7,gk,2,1,`p`,4),V(8,`dl`,5),N(9,_k,4,1),N(10,vk,6,3),N(11,yk,5,1),H(),V(12,`h3`),J(13,`Active routes`),H(),V(14,`div`,6)(15,`table`)(16,`thead`)(17,`tr`)(18,`th`,7),J(19,`Route`),H(),V(20,`th`,7),J(21,`Component`),H(),V(22,`th`,7),J(23,`Params`),H(),V(24,`th`,7),J(25,`Data`),H(),V(26,`th`,7),J(27,`Guards and resolvers`),H()()(),V(28,`tbody`),F(29,Pk,23,11,`tr`,null,wg),H()()(),N(31,Vk,5,0)),e&2){let e,n=t,r=K();j(4),Y(n.url),j(),P(n.urlDrift&&n.browserUrl?5:-1),j(),P((e=n.pending)?6:-1,e),j(),P(r.message()?7:-1),j(2),P(n.title?9:-1),j(),P(r.hasKeys(n.queryParams)?10:-1),j(),P(n.fragment?11:-1),j(18),I(r.rows()),j(2),P(r.outletRows().length?31:-1)}}function Uk(e,t){e&1&&(V(0,`div`,0)(1,`p`,25),J(2,`This page reports no Router.`),H(),V(3,`p`,23),J(4,` Add `),V(5,`code`),J(6,`provideRouter()`),H(),J(7,` to the app config and navigate once to see the active routes here. `),H()())}var Wk=class e{page=$.required();rpc=$(null);navigationAllowed=Q(()=>oE(this.rpc(),`router`));navigationOff=UT(`router`);message=A(``);rows=Q(()=>{let e=[],t=(n,r)=>{e.push({route:n,depth:r});for(let e of n.children)t(e,r+1)},n=this.page().snapshot?.root;return n&&t(n,0),e});outletRows=Q(()=>{let e=[],t=(n,r)=>{for(let i of n)e.push({outlet:i,depth:r}),i.children&&t(i.children,r+1)};return t(this.page().outlets??[],0),e});hasKeys(e){return Object.keys(e).length>0}entries(e){return Object.entries(e)}guardList(e){return Object.entries(e.guards??{}).flatMap(([e,t])=>t.map(t=>`${e} ${t}`))}boundInputs(e){return(e.inputs??[]).filter(e=>e.source!==`unset`)}async abort(){let e=await ck(this.rpc(),this.page().pageId,{action:`abort`});this.message.set(e.error?String(e.error):`Aborted navigation #${e.aborted}.`)}static ɵfac=function(t){return new(t||e)};static ɵcmp=Vh({type:e,selectors:[[`app-route-current`]],inputs:{page:[1,`page`],rpc:[1,`rpc`]},decls:2,vars:1,consts:[[1,`empty`],[1,`url`],[1,`url-label`],[`role`,`note`,1,`note`],[`role`,`status`,1,`muted`],[1,`facts`],[`role`,`region`,`aria-label`,`Active routes`,`tabindex`,`0`,1,`table-scroll`],[`scope`,`col`],[`role`,`status`,1,`pending`],[`aria-hidden`,`true`,1,`pulse`],[1,`pending-text`],[`type`,`button`,1,`small`,3,`click`,`disabled`],[`id`,`route-current-writes-off`,1,`muted`],[1,`path`],[1,`tag`],[1,`sub`],[1,`component`],[1,`entry`],[1,`entry`,`data`],[`aria-hidden`,`true`,1,`nil`],[1,`visually-hidden`],[1,`outlets`],[3,`padding-left`],[1,`muted`],[1,`outlet-data`],[1,`empty-title`]],template:function(e,t){if(e&1&&N(0,Hk,32,8)(1,Uk,8,0,`div`,0),e&2){let e;P((e=t.page().snapshot)?0:1,e)}},dependencies:[ab],styles:[`.muted[_ngcontent-%COMP%] {
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
}`]})};function Gk(e,t){if(e&1&&(V(0,`span`,8),J(1),H()),e&2){let e=K(2);j(),X(``,e.counts().error,` error(s)`)}}function Kk(e,t){if(e&1&&(V(0,`span`,9),J(1),H()),e&2){let e=K(2);j(),X(``,e.counts().warning,` warning(s)`)}}function qk(e,t){if(e&1&&(V(0,`span`,10),J(1),H()),e&2){let e=K(2);j(),X(``,e.counts().info,` info`)}}function Jk(e,t){if(e&1&&(V(0,`span`,3),N(1,Gk,2,1,`span`,8),N(2,Kk,2,1,`span`,9),N(3,qk,2,1,`span`,10),H()),e&2){let e=K();j(),P(e.counts().error?1:-1),j(),P(e.counts().warning?2:-1),j(),P(e.counts().info?3:-1)}}function Yk(e,t){if(e&1){let e=W();V(0,`div`,4)(1,`p`,11),J(2,`The route checks could not run.`),H(),V(3,`p`,2),J(4,`The DevTools server did not answer. Check that it is still running.`),H(),V(5,`button`,1),Qg(`click`,function(){return O(e),k(K().run())}),J(6,`Retry`),H()()}}function Xk(e,t){e&1&&(V(0,`p`,5),J(1,`Checking…`),H())}function Zk(e,t){e&1&&J(0,` This page runs in events-only mode: it has no debug utils (a production build or an unusual setup), so it cannot report its route config. `)}function Qk(e,t){e&1&&J(0,` The page has not reported its route config yet. It appears after the app finishes bootstrapping. `)}function $k(e,t){e&1&&J(0,` No page with a router is connected. `)}function eA(e,t){if(e&1&&(V(0,`div`,6)(1,`p`,11),J(2,`No checks ran.`),H(),V(3,`p`,2),N(4,Zk,1,0)(5,Qk,1,0)(6,$k,1,0),H()()),e&2){let e;j(4),P((e=t)===`events-only`?4:e===`no-config`?5:6)}}function tA(e,t){if(e&1&&(V(0,`li`)(1,`div`,12)(2,`span`,10),J(3),H(),V(4,`code`,13),J(5),H(),V(6,`code`,14),J(7),H()(),V(8,`p`,15),J(9),H(),V(10,`p`,16)(11,`span`,17),J(12,`Fix`),H(),V(13,`span`,18),J(14),V(15,`span`,2),J(16),H()()()()),e&2){let e=t.$implicit,n=K(2);M(`data-severity`,e.severity),j(2),M(`data-tone`,n.severityTone(e.severity)),j(),Y(e.severity),j(2),Y(e.rule),j(2),Y(e.route),j(2),Y(e.message),j(5),X(``,e.fix,` `),j(2),X(`(Angular `,e.angular===`throws`?`throws`:e.angular===`warns`?`warns`:`does not warn`,`)`)}}function nA(e,t){if(e&1&&(V(0,`ul`,7),F(1,tA,17,8,`li`,null,wg),H()),e&2){let e=K();M(`aria-busy`,e.checking()),j(),I(e.findings())}}function rA(e,t){e&1&&(V(0,`div`,6)(1,`span`,19),ps(),V(2,`svg`,20),U(3,`path`,21),H()(),ms(),V(4,`p`,11),J(5,`No route config problems found.`),H(),V(6,`p`,2),J(7,`The check runs again after each navigation or config change.`),H()())}var iA=class e{page=$.required();rpc=$(null);result=A(null);failed=A(!1);checking=A(!1);findings=Q(()=>{let e=this.result();return e?.checked?e.findings:[]});notChecked=Q(()=>{let e=this.result();return e&&!e.checked?e.reason:null});counts=Q(()=>{let e={error:0,warning:0,info:0};for(let t of this.findings())e[t.severity]++;return e});key=Q(()=>{let e=this.page(),t=e.navigations[e.navigations.length-1];return`${e.pageId}:${e.generation}:${t?.id}:${t?.outcome}`});seq=0;checkedPage=null;constructor(){dc(()=>{this.key(),Cv(()=>void this.run())})}severityTone(e){return e===`error`?`bad`:e===`warning`?`warn`:``}async run(){let e=++this.seq,t=this.page().pageId;t!==this.checkedPage&&this.result.set(null),this.checking.set(!0);let n=await ok(this.rpc(),`router-lint`,t);e===this.seq&&(this.checking.set(!1),this.failed.set(!n),n&&(this.result.set(n),this.checkedPage=t))}static ɵfac=function(t){return new(t||e)};static ɵcmp=Vh({type:e,selectors:[[`app-route-lint`]],inputs:{page:[1,`page`],rpc:[1,`rpc`]},decls:11,vars:4,consts:[[1,`toolbar`],[`type`,`button`,1,`small`,3,`click`],[1,`muted`],[1,`summary`],[`role`,`alert`,1,`empty`],[`role`,`status`,1,`muted`,`empty`],[1,`empty`],[1,`findings`],[`data-tone`,`bad`,1,`badge`],[`data-tone`,`warn`,1,`badge`],[1,`badge`],[1,`empty-title`],[1,`head`],[1,`rule`],[1,`route`],[1,`message`],[1,`fix`],[1,`fix-label`],[1,`fix-text`],[`aria-hidden`,`true`,1,`ok-mark`],[`width`,`16`,`height`,`16`,`viewBox`,`0 0 24 24`,`fill`,`none`,`stroke`,`currentColor`,`stroke-width`,`2.5`,`stroke-linecap`,`round`,`stroke-linejoin`,`round`],[`d`,`M20 6 9 17l-5-5`]],template:function(e,t){if(e&1&&(V(0,`div`,0)(1,`button`,1),Qg(`click`,function(){return t.run()}),J(2),H(),V(3,`span`,2),J(4,`Checks the live config, links and recent navigations. Lazy routes that have not loaded are skipped.`),H(),N(5,Jk,4,3,`span`,3),H(),N(6,Yk,7,0,`div`,4)(7,Xk,2,0,`p`,5)(8,eA,7,1,`div`,6)(9,nA,3,1,`ul`,7)(10,rA,8,0,`div`,6)),e&2){let e;j(),M(`aria-busy`,t.checking()),j(),X(` `,t.checking()?`Checking…`:`Check again`,` `),j(3),P(t.result()?.checked&&t.findings().length?5:-1),j(),P(t.failed()?6:t.result()?(e=t.notChecked())?8:t.findings().length?9:10:7,e)}},styles:[`.muted[_ngcontent-%COMP%] {
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
}`]})},aA=(e,t)=>t.name,oA=(e,t)=>t[0];function sA(e,t){e&1&&(V(0,`p`,1),J(1,` Events-only mode: this build has no debug utils (production build or unusual setup), so the route config, lint and actions are limited. `),H())}function cA(e,t){if(e&1&&(V(0,`dt`),J(1,`Angular`),H(),V(2,`dd`),J(3),H()),e&2){let e=K();j(3),Y(e.angularVersion)}}function lA(e,t){if(e&1&&(V(0,`dt`),J(1,`Base href`),H(),V(2,`dd`)(3,`code`),J(4),H()()),e&2){let e=K();j(4),Y(e.baseHref)}}function uA(e,t){if(e&1&&(V(0,`dt`),J(1,`Hydration`),H(),V(2,`dd`),J(3),H()),e&2){let e=K();j(3),X(``,e.hydrated,` component(s) hydrated from server HTML`)}}function dA(e,t){if(e&1&&(V(0,`tr`)(1,`td`,5)(2,`code`),J(3),H()(),V(4,`td`)(5,`code`),J(6),H()(),V(7,`td`,6)(8,`span`,7),J(9),H()()()),e&2){let e=t.$implicit;j(3),Y(e.name),j(3),Y(e.value),j(2),M(`data-tone`,e.set?`warn`:``),j(),Y(e.set?`set`:`default`)}}function fA(e,t){if(e&1&&(V(0,`li`)(1,`span`,7),J(2),H()()),e&2){let e=t.$implicit;j(),M(`data-tone`,e[1]===`off`?``:`good`),j(),Z(``,e[0],`: `,e[1])}}function pA(e,t){if(e&1&&(V(0,`h3`),J(1,`Features`),H(),V(2,`ul`,8),F(3,fA,3,3,`li`,null,oA),H()),e&2){let e=K(),t=K();j(3),I(t.entries(e.features))}}function mA(e,t){if(e&1&&(V(0,`dt`),J(1),H(),V(2,`dd`)(3,`code`),J(4),H()()),e&2){let e=t.$implicit;j(),Y(e[0]),j(3),Y(e[1])}}function hA(e,t){if(e&1&&(V(0,`h3`),J(1,`Strategies`),H(),V(2,`dl`,2),F(3,mA,5,2,null,null,oA),H()),e&2){let e=K(),t=K();j(3),I(t.entries(e.strategies))}}function gA(e,t){if(e&1&&(N(0,sA,2,0,`p`,1),V(1,`dl`,2)(2,`dt`),J(3,`Set up with`),H(),V(4,`dd`),J(5),H(),N(6,cA,4,1),N(7,lA,5,1),N(8,uA,4,1),H(),V(9,`h3`),J(10,`Options`),H(),V(11,`div`,3)(12,`table`)(13,`thead`)(14,`tr`)(15,`th`,4),J(16,`Option`),H(),V(17,`th`,4),J(18,`Value`),H(),V(19,`th`,4),J(20,`Source`),H()()(),V(21,`tbody`),F(22,dA,10,4,`tr`,null,aA),H()()(),N(24,pA,5,0),N(25,hA,5,0)),e&2){let e=t,n=K();P(e.mode===`events-only`?0:-1),j(5),Z(` `,e.setupKind,``,e.routers>1?`, `+e.routers+` routers on the page`:``,` `),j(),P(e.angularVersion?6:-1),j(),P(e.baseHref?7:-1),j(),P(e.hydrated?8:-1),j(14),I(e.options),j(2),P(n.entries(e.features).length?24:-1),j(),P(n.entries(e.strategies).length?25:-1)}}function _A(e,t){e&1&&(V(0,`div`,0)(1,`p`,9),J(2,`The page has not reported its router setup yet.`),H(),V(3,`p`,10),J(4,` It appears after the app finishes bootstrapping. Reload the app if it stays empty. `),H()())}var vA=class e{page=$.required();entries(e){return Object.entries(e)}static ɵfac=function(t){return new(t||e)};static ɵcmp=Vh({type:e,selectors:[[`app-route-setup`]],inputs:{page:[1,`page`]},decls:2,vars:1,consts:[[1,`empty`],[`role`,`note`,1,`note`],[1,`facts`],[`role`,`region`,`aria-label`,`Router options`,`tabindex`,`0`,1,`table-scroll`],[`scope`,`col`],[1,`name`],[1,`source`],[1,`badge`],[1,`chips`],[1,`empty-title`],[1,`muted`]],template:function(e,t){if(e&1&&N(0,gA,26,8)(1,_A,5,0,`div`,0),e&2){let e;P((e=t.page().setup)?0:1,e)}},styles:[`.muted[_ngcontent-%COMP%] {
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
}`]})},yA=(e,t)=>t.id,bA=(e,t)=>t.phase;function xA(e,t){if(e&1&&(R(0,`p`,6),J(1),z()),e&2){let e=K();j(),Y(e.message())}}function SA(e,t){if(e&1&&(R(0,`p`,7),J(1),z()),e&2){let e=K();j(),Y(e.navigationOff)}}function CA(e,t){e&1&&(R(0,`span`,16),J(1,`→`),z(),R(2,`span`,17),J(3,`then`),z())}function wA(e,t){if(e&1&&(N(0,CA,4,0),R(1,`code`),J(2),z()),e&2){let e=t.$implicit,n=t.$index;P(n===0?-1:0),j(2),Y(e)}}function TA(e,t){if(e&1&&(R(0,`li`)(1,`code`),J(2),z(),R(3,`span`,16),J(4,` → `),z(),R(5,`span`,17),J(6,` to `),z(),R(7,`code`),J(8),z(),J(9),z()),e&2){let e=t.$implicit,n=K(3);j(2),Y(e.from),j(6),Y(e.to),j(),X(`: `,n.hopCause(e),` `)}}function EA(e,t){if(e&1&&(R(0,`div`,11)(1,`p`,12)(2,`span`,13),J(3),z(),F(4,wA,3,2,null,null,wg),z(),R(6,`ol`,14),F(7,TA,10,3,`li`,null,wg),z(),R(9,`p`,15),J(10),z()()),e&2){let e=t.$implicit,n=K(2);j(3),Y(n.loopTitle(e)),j(),I(e.cycle),j(3),I(e.hops),j(3),Y(n.loopMeta(e))}}function DA(e,t){if(e&1&&(R(0,`section`,9)(1,`h3`,10),J(2),z(),F(3,EA,11,2,`div`,11,wg),z()),e&2){let e=K();j(2),X(` `,e.loops().length===1?`Loop detected`:e.loops().length+` loops detected`,` `),j(),I(e.loops())}}function OA(e,t){if(e&1&&(R(0,`span`),B(1,`i`),J(2),z()),e&2){let e=t.$implicit,n=K(2);j(),C_(`background`,n.color(e)),j(),Y(e)}}function kA(e,t){if(e&1&&(R(0,`time`),J(1),z()),e&2){let e=K().$implicit,t=K(2);j(),Y(t.time(e.startedAt))}}function AA(e,t){if(e&1&&(R(0,`span`,16),J(1,`→`),z(),R(2,`span`,17),J(3,`redirected to`),z(),R(4,`code`,25),J(5),z()),e&2){let e=K().$implicit;j(5),Y(e.finalUrl)}}function jA(e,t){if(e&1&&(R(0,`span`,28),J(1),z()),e&2){let e=K().$implicit;j(),Y(e.endedAt===void 0&&e.outcome!==`pending`?`before DevTools connected`:`started before DevTools connected`)}}function MA(e,t){if(e&1&&(R(0,`span`,29),J(1),z()),e&2){let e=K().$implicit;j(),X(``,e.phases?.total,`ms`)}}function NA(e,t){if(e&1&&(R(0,`span`,29),J(1),z()),e&2){let e=K().$implicit;j(),X(``,e.endedAt-e.startedAt,`ms`)}}function PA(e,t){e&1&&(R(0,`span`,30),J(1,`probe`),z())}function FA(e,t){if(e&1&&(R(0,`span`,13),J(1,`loop`),R(2,`span`,17),J(3),z()()),e&2){let e=t,n=K(3);j(3),Z(`: part of `,n.loopTitle(e),` `,e.cycle.join(` then `))}}function IA(e,t){if(e&1&&B(0,`span`),e&2){let e=t.$implicit,n=K(4);C_(`width`,e.width,`%`)(`background`,n.color(e.phase)),M(`title`,e.phase+` `+e.ms+`ms`)}}function LA(e,t){if(e&1&&(R(0,`div`,31),F(1,IA,1,5,`span`,37,bA),z()),e&2){let e=K().$implicit,t=K(2);M(`aria-label`,t.barLabel(e)),j(),I(t.bars(e))}}function RA(e,t){if(e&1&&(R(0,`dt`),J(1,`From`),z(),R(2,`dd`)(3,`code`),J(4),z()()),e&2){let e=K().$implicit;j(4),Y(e.from)}}function zA(e,t){if(e&1&&(R(0,`dt`),J(1,`Started by`),z(),R(2,`dd`),J(3),z()),e&2){let e=K().$implicit;j(3),Z(``,e.caller,` (`,e.trigger,`)`)}}function BA(e,t){if(e&1&&(R(0,`dt`),J(1,`Extras`),z(),R(2,`dd`),J(3),z()),e&2){let e=K().$implicit;j(3),Y(e.extras?.join(`, `))}}function VA(e,t){if(e&1&&(R(0,`dt`),J(1,`Redirect of`),z(),R(2,`dd`),J(3),z()),e&2){let e=K().$implicit;j(3),X(`#`,e.redirectedFrom)}}function HA(e,t){if(e&1&&(R(0,`div`),J(1,` This navigation: `),R(2,`code`),J(3),z(),J(4,` to `),R(5,`code`),J(6),z(),J(7),z()),e&2){let e=t.$implicit,n=K(4);j(3),Y(e.from),j(3),Y(e.to),j(),X(`, `,n.hopCause(e),` `)}}function UA(e,t){if(e&1&&(R(0,`dt`),J(1,`Loop`),z(),R(2,`dd`,38),J(3),F(4,HA,8,3,`div`,null,wg),z()),e&2){let e=t,n=K().$implicit,r=K(2);j(3),X(` `,e.cycle.join(` → `),` `),j(),I(r.hopsOf(e,n))}}function WA(e,t){if(e&1&&(R(0,`dt`),J(1,`Redirects to`),z(),R(2,`dd`)(3,`code`),J(4),z(),J(5),z()),e&2){let e=K().$implicit;j(4),Y(e.redirectTo),j(),X(` (`,e.redirectKind,`) `)}}function GA(e,t){if(e&1&&(R(0,`dt`),J(1,`Guards`),z(),R(2,`dd`),J(3),z()),e&2){let e=K().$implicit,t=K(2);j(3),Z(``,e.guards.names.join(`, `)||`none`,`: `,t.guardResult(e))}}function KA(e,t){if(e&1&&(R(0,`div`)(1,`code`),J(2),z(),J(3),R(4,`code`),J(5),z(),J(6,`: `),R(7,`strong`),J(8),z(),J(9),z()),e&2){let e=t.$implicit,n=K(4);j(2),Y(e.guard),j(),X(` `,e.kind,` on `),j(2),Y(e.route),j(2),q(`bad`,n.isBad(e.result)),j(),Y(e.result),j(),X(` (`,e.ms,`ms) `)}}function qA(e,t){if(e&1&&(R(0,`dt`),J(1,`Runs`),z(),R(2,`dd`),F(3,KA,10,7,`div`,null,wg),z()),e&2){let e=K().$implicit;j(3),I(e.runs)}}function JA(e,t){if(e&1&&J(0),e&2){let e=K(2).$implicit;X(` leaving `,e.checked.deactivate.join(`, `),`; `)}}function YA(e,t){if(e&1&&(R(0,`dt`),J(1,`Checked`),z(),R(2,`dd`),N(3,JA,1,1),J(4),z()),e&2){let e=K().$implicit;j(3),P(e.checked.deactivate.length?3:-1),j(),X(` entering `,e.checked.activate.join(`, `)||`nothing new`,` `)}}function XA(e,t){if(e&1&&(R(0,`dt`),J(1,`Resolvers`),z(),R(2,`dd`),J(3),z()),e&2){let e=K().$implicit;j(3),Y(e.resolvers?.names?.join(`, `))}}function ZA(e,t){if(e&1&&(R(0,`dt`),J(1,`Lazy loaded`),z(),R(2,`dd`),J(3),z()),e&2){let e=K().$implicit;j(3),Y(e.lazyLoaded?.join(`, `))}}function QA(e,t){if(e&1&&(R(0,`dt`),J(1,`Reused`),z(),R(2,`dd`),J(3),z()),e&2){let e=K().$implicit;j(3),X(` `,e.reused?.join(`, `),` (component kept, only inputs and params change) `)}}function $A(e,t){if(e&1&&(R(0,`dt`),J(1,`HTTP`),z(),R(2,`dd`),J(3),z()),e&2){let e=K().$implicit;j(3),Z(``,e.requests.count,` request(s): `,e.requests.urls.join(`, `))}}function ej(e,t){if(e&1&&(R(0,`dt`),J(1,`Scroll`),z(),R(2,`dd`),J(3),z()),e&2){let e=K().$implicit;j(3),Y(e.scroll)}}function tj(e,t){if(e&1&&(R(0,`dt`),J(1,`Title after`),z(),R(2,`dd`),J(3),z()),e&2){let e=K().$implicit;j(3),Y(e.title)}}function nj(e,t){if(e&1&&(R(0,`dt`),J(1,`Warnings`),z(),R(2,`dd`),J(3),z()),e&2){let e=K().$implicit;j(3),Y(e.warnings?.join(` · `))}}function rj(e,t){if(e&1&&(R(0,`dt`),J(1,`Reason`),z(),R(2,`dd`,38),J(3),z()),e&2){let e=K().$implicit,t=K(2);j(3),Y(t.reasonText(e))}}function ij(e,t){if(e&1&&(R(0,`dt`),J(1,`Error`),z(),R(2,`dd`,38),J(3),z()),e&2){let e=K().$implicit;j(3),Y(e.errorCode)}}function aj(e,t){if(e&1&&(R(0,`dt`),J(1,`Error handler`),z(),R(2,`dd`),J(3),z()),e&2){let e=K().$implicit;j(3),Y(e.errorHandler)}}function oj(e,t){if(e&1&&(R(0,`dt`),J(1,`Earlier`),z(),R(2,`dd`),J(3),z()),e&2){let e=K().$implicit;j(3),X(``,e.earlier,` navigation(s) before DevTools connected`)}}function sj(e,t){if(e&1&&(R(0,`p`,36),J(1,` Replay is off: the URL is redacted or not relative. `),z()),e&2){let e=K().$implicit;L(`id`,av(`replay-note-`,e.id))}}function cj(e,t){if(e&1){let e=W();R(0,`li`)(1,`div`,23),N(2,kA,2,1,`time`),R(3,`span`,24),J(4),z(),R(5,`code`,25),J(6),z(),N(7,AA,6,1),R(8,`span`,26)(9,`span`,27),J(10),z(),N(11,jA,2,1,`span`,28)(12,MA,2,1,`span`,29)(13,NA,2,1,`span`,29),N(14,PA,2,0,`span`,30),N(15,FA,4,2,`span`,13),z()(),N(16,LA,3,1,`div`,31),R(17,`dl`,32),N(18,RA,5,1),N(19,zA,4,2),N(20,BA,4,1),N(21,VA,4,1),N(22,UA,6,1),N(23,WA,6,2),N(24,GA,4,2),N(25,qA,5,0),N(26,YA,5,2),N(27,XA,4,1),N(28,ZA,4,1),N(29,QA,4,1),N(30,$A,4,2),N(31,ej,4,1),N(32,tj,4,1),N(33,nj,4,1),N(34,rj,4,1),N(35,ij,4,1),N(36,aj,4,1),N(37,oj,4,1),z(),R(38,`div`,33)(39,`button`,34),G(`click`,function(){let t=O(e).$implicit;return k(K(2).replay(t))}),J(40,` Replay `),z(),R(41,`button`,35),G(`click`,function(){let t=O(e).$implicit;return k(K(2).copy(t))}),J(42,` Copy repro `),z(),N(43,sj,2,2,`p`,36),z()()}if(e&2){let e,n,r=t.$implicit,i=K(2);q(`in-loop`,!!i.loopOf(r)),j(2),P(r.beforeConnect?-1:2),j(2),X(`#`,r.id),j(2),Y(r.url),j(),P(r.finalUrl&&r.finalUrl!==r.url?7:-1),j(2),M(`data-tone`,i.tone(r.outcome)),j(),Y(r.outcome),j(),P(r.beforeConnect?11:r.phases?.total===void 0?r.endedAt===void 0?-1:13:12),j(3),P(r.probe?14:-1),j(),P((e=i.loopOf(r))?15:-1,e),j(),P(i.bars(r).length?16:-1),j(2),P(r.from?18:-1),j(),P(r.caller?19:-1),j(),P(r.extras?.length?20:-1),j(),P(r.redirectedFrom===void 0?-1:21),j(),P((n=i.loopOf(r))?22:-1,n),j(),P(r.redirectTo?23:-1),j(),P(r.guards&&(r.guards.names.length||r.guards.passed===!1)?24:-1),j(),P(r.runs?.length?25:-1),j(),P(r.checked&&(r.checked.activate.length||r.checked.deactivate.length)?26:-1),j(),P(r.resolvers?.names?.length?27:-1),j(),P(r.lazyLoaded?.length?28:-1),j(),P(r.reused?.length?29:-1),j(),P(r.requests?30:-1),j(),P(r.scroll?31:-1),j(),P(r.title?32:-1),j(),P(r.warnings?.length?33:-1),j(),P(r.reason||r.code?34:-1),j(),P(r.errorCode?35:-1),j(),P(r.errorHandler?36:-1),j(),P(r.earlier?37:-1),j(2),L(`disabled`,!i.navigationAllowed()||!i.replayable(r)),M(`aria-describedby`,i.replayNote(r))(`aria-label`,`Replay navigation `+r.id),j(2),M(`aria-label`,`Copy repro for navigation `+r.id),j(2),P(i.replayable(r)?-1:43)}}function lj(e,t){if(e&1&&(R(0,`div`,18)(1,`span`,19),J(2),z(),R(3,`div`,20),F(4,OA,3,3,`span`,null,Tg),z()(),R(6,`ol`,21),F(7,cj,44,37,`li`,22,yA),z()),e&2){let e=K();j(2),Z(``,e.items().length,` of `,e.page().navigations.length,` navigation(s)`),j(2),I(e.phases),j(3),I(e.items())}}function uj(e,t){if(e&1){let e=W();R(0,`div`,39)(1,`p`,40),J(2,`No navigations match the current filters.`),z(),R(3,`p`,28),J(4),z(),R(5,`button`,35),G(`click`,function(){O(e);let t=K(2),n=n_(2);return t.clearFilters(),k(n.focus())}),J(6,` Clear filters `),z()()}if(e&2){let e=K(2);j(4),X(` `,e.page().navigations.length,` navigation(s) are hidden. Clear the filters to see them. `)}}function dj(e,t){e&1&&(R(0,`div`,39)(1,`p`,40),J(2,`No navigations since DevTools connected.`),z(),R(3,`p`,28),J(4,`Earlier ones are not visible. Click a link in the app to record one.`),z()())}function fj(e,t){e&1&&N(0,uj,7,1,`div`,39)(1,dj,5,0,`div`,39),e&2&&P(+!K().page().navigations.length)}var pj=[`recognize`,`guards`,`resolve`,`activate`],mj={recognize:`#60a5fa`,guards:`#f59e0b`,resolve:`#2dd4bf`,activate:`#34d399`},hj=class e{page=$.required();rpc=$(null);maxNavigations=Q(()=>aE(this.rpc()).limits.navigations);navigationAllowed=Q(()=>oE(this.rpc(),`router`));navigationOff=UT(`router`);phases=pj;filter=A(``);onlyProblems=A(!1);message=A(``);loops=Q(()=>this.page().loops??[]);loopById=Q(()=>{let e=new Map;for(let t of this.loops())for(let n of t.ids)e.set(n,t);return e});items=Q(()=>{let e=this.filter().toLowerCase();return[...this.page().navigations].reverse().filter(t=>(!e||t.url.toLowerCase().includes(e)||!!t.finalUrl?.toLowerCase().includes(e))&&(!this.onlyProblems()||![`succeeded`,`pending`].includes(t.outcome)||this.loopById().has(t.id)))});loopOf(e){return this.loopById().get(e.id)}loopTitle(e){return e.kind===`burst`?`navigation loop`:`redirect loop`}hopsOf(e,t){return e.hops.filter(e=>e.id===t.id)}hopCause(e){return e.via===`navigate`?`#${e.id} started by ${e.by??`code`}`:`${e.via===`redirectTo`?`config`:`${e.via} redirect`}${e.by?` ${e.by}`:e.via===`redirectTo`?` redirectTo`:``} in #${e.id}`}loopMeta(e){let t=e.ids.length>1?`Navigations #${e.ids[0]} to #${e.ids[e.ids.length-1]}`:`Navigation #${e.ids[0]}`,n=e.bounces>1?`, came back ${e.bounces} times`:``,r=e.guards.length?` Guards involved: ${e.guards.join(`, `)}.`:``;return`${t}${n}; ${e.end}.${r}`}reasonText(e){return[e.code,e.reason].filter(Boolean).join(`: `)}clearFilters(){this.filter.set(``),this.onlyProblems.set(!1)}tone(e){return lk(e)}color(e){return mj[e]}bars(e){let t=e.phases?.total;return t?pj.filter(t=>(e.phases?.[t]??0)>0).map(n=>({phase:n,ms:e.phases[n],width:Math.max(1,e.phases[n]/t*100)})):[]}barLabel(e){return`Phases: ${this.bars(e).map(e=>`${e.phase} ${e.ms}ms`).join(`, `)}`}guardResult(e){let t=e.guards?.passed;return t===!0?`passed`:t===!1?e.outcome===`redirected`?`redirected`:`blocked`:e.outcome===`pending`?`running`:`did not finish, navigation ${e.outcome}`}isBad(e){return e===`false`||/^(UrlTree|RedirectCommand|threw)/.test(e)}time=mD;async toggleInstrument(e){let t=e.target,n=t.checked,r=await ck(this.rpc(),this.page().pageId,{action:`instrument`,on:n});if(r.error){t.checked=!!this.page().instrumented,this.message.set(String(r.error));return}this.message.set(n?`Recording each guard and resolver.`:`Stopped recording guards and resolvers.`)}replayable(e){return sk(e.url)}replayNote(e){return this.navigationAllowed()?this.replayable(e)?null:`replay-note-${e.id}`:`route-timeline-writes-off`}async replay(e){this.message.set(`Replaying #${e.id}…`);let t=await ck(this.rpc(),this.page().pageId,{action:`replay`,id:e.id});if(t.error){this.message.set(String(t.error));return}let n=t.replay;this.message.set(`Replay of #${e.id}: ${n?.outcome??`unknown`}${t.same?` (same as before)`:` (different from before)`}.`)}async copy(e){let t=await ok(this.rpc(),`router-export`,{pageId:this.page().pageId,id:e.id});if(!t){this.message.set(`Could not build the repro.`);return}try{await navigator.clipboard.writeText(t),this.message.set(`Copied a markdown repro of #${e.id}.`)}catch{this.message.set(`The clipboard is not available here.`)}}exportJson(){let e=new Blob([JSON.stringify(this.page().navigations,null,2)],{type:`application/json`}),t=URL.createObjectURL(e),n=document.createElement(`a`);n.href=t,n.download=`navigations-${this.page().pageId}.json`,n.click(),URL.revokeObjectURL(t)}static ɵfac=function(t){return new(t||e)};static ɵcmp=Vh({type:e,selectors:[[`app-route-timeline`]],inputs:{page:[1,`page`],rpc:[1,`rpc`]},decls:17,vars:9,consts:[[`filterInput`,``],[1,`toolbar`],[`type`,`text`,`aria-label`,`Filter navigations by URL`,`placeholder`,`Filter by URL`,1,`field`,3,`input`,`value`],[1,`check`],[`type`,`checkbox`,3,`change`,`checked`],[`type`,`button`,1,`small`,`export`,3,`click`],[`role`,`status`,1,`message`],[`id`,`route-timeline-writes-off`,1,`message`],[`what`,`navigations`,`limit`,`navigations`,3,`dropped`,`max`],[`aria-labelledby`,`loops-heading`,1,`loops`],[`id`,`loops-heading`],[1,`loop`],[1,`chain`],[`data-tone`,`bad`,1,`badge`],[1,`hops`],[1,`muted`,`loop-meta`],[`aria-hidden`,`true`,1,`arrow`],[1,`visually-hidden`],[1,`meta-row`],[1,`muted`,`count`],[`aria-hidden`,`true`,1,`legend`],[1,`navs`],[3,`in-loop`],[1,`head`],[1,`id`],[1,`url`],[1,`meta`],[1,`badge`],[1,`muted`],[1,`muted`,`ms`],[1,`tag`],[`role`,`img`,1,`bar`],[1,`details`],[1,`actions`],[`type`,`button`,1,`small`,3,`click`,`disabled`],[`type`,`button`,1,`small`,3,`click`],[1,`muted`,`replay-note`,3,`id`],[3,`width`,`background`],[1,`reason`],[1,`empty`],[1,`empty-title`]],template:function(e,t){e&1&&(R(0,`div`,1)(1,`input`,2,0),G(`input`,function(e){return t.filter.set(e.target.value)}),z(),R(3,`label`,3)(4,`input`,4),G(`change`,function(e){return t.onlyProblems.set(e.target.checked)}),z(),J(5,` Only problems `),z(),R(6,`label`,3)(7,`input`,4),G(`change`,function(e){return t.toggleInstrument(e)}),z(),J(8,` Record each guard and resolver `),z(),R(9,`button`,5),G(`click`,function(){return t.exportJson()}),J(10,`Export JSON`),z()(),N(11,xA,2,1,`p`,6),N(12,SA,2,1,`p`,7),B(13,`app-limit-note`,8),N(14,DA,5,1,`section`,9),N(15,lj,9,2)(16,fj,2,1)),e&2&&(j(),L(`value`,t.filter()),j(3),L(`checked`,t.onlyProblems()),j(3),L(`checked`,t.page().instrumented),j(4),P(t.message()?11:-1),j(),P(t.navigationAllowed()?-1:12),j(),L(`dropped`,t.page().dropped??0)(`max`,t.maxNavigations()),j(),P(t.loops().length?14:-1),j(),P(t.items().length?15:16))},dependencies:[_D],styles:[`.muted[_ngcontent-%COMP%] {
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
}`]})},gj=()=>[],_j=(e,t)=>t.node.id;function vj(e,t){if(e&1&&(J(0,` with `),V(1,`code`),J(2),dv(3,`json`),H()),e&2){let e=K(2);j(2),Y(pv(3,1,e.params))}}function yj(e,t){if(e&1&&(V(0,`span`,16),J(1,`match`),H(),J(2,` Matches `),V(3,`code`,17),J(4),H(),N(5,vj,4,3)),e&2){let e=K(),t=K();j(4),Y(t.chainText(e)),j(),P(t.hasKeys(e.params)?5:-1)}}function bj(e,t){if(e&1&&(J(0,` Nearest: `),V(1,`code`),J(2),H()),e&2){let e=K(2);j(2),Y(e.nearest.join(`, `))}}function xj(e,t){if(e&1&&(V(0,`span`,18),J(1,`no match`),H(),J(2,` Matches no route (NG04002). `),N(3,bj,3,1)),e&2){let e=K();j(3),P(e.nearest.length?3:-1)}}function Sj(e,t){if(e&1&&(V(0,`div`,15),J(1),H()),e&2){let e=t.$implicit;j(),Y(e)}}function Cj(e,t){if(e&1&&(V(0,`div`,7),N(1,yj,6,2)(2,xj,4,1),F(3,Sj,2,1,`div`,15,Tg),H()),e&2){let e=t;M(`data-matched`,e.matched),j(),P(e.matched?1:2),j(2),I(e.notes)}}function wj(e,t){if(e&1&&(V(0,`p`,8),J(1),H()),e&2){let e=K();j(),Y(e.message())}}function Tj(e,t){if(e&1&&(V(0,`p`,9),J(1),H()),e&2){let e=K();j(),Y(e.navigationOff)}}function Ej(e,t){e&1&&J(0),e&2&&X(` `,t,` route(s) left out: the page lists at most 200 routes per level and 1000 in total. `)}function Dj(e,t){if(e&1&&(V(0,`p`,12),J(1),N(2,Ej,1,1),H()),e&2){let e,t=K();j(),Z(` Generation `,t.page().generation,` · `,t.rows().length,` route(s). Lazy routes show their children once loaded. `),j(),P((e=t.page().configTruncated)?2:-1,e)}}function Oj(e,t){if(e&1&&(V(0,`div`,13)(1,`p`,19),J(2),H(),V(3,`p`,15),J(4),H()()),e&2){let e=K();j(2),X(` `,e.page().setup?.mode===`events-only`?`This build has no debug utils, so the live config cannot be read.`:`The page has not reported its route config yet.`,` `),j(2),X(` `,e.page().setup?.mode===`events-only`?`Run the app with the development build to inspect the live config.`:`It appears once the router initializes. Navigate in the app if it stays empty.`,` `)}}function kj(e,t){if(e&1){let e=W();V(0,`div`,13)(1,`p`,19),J(2,`No routes match the filter.`),H(),V(3,`p`,15),J(4,`Try a shorter path or a component name.`),H(),V(5,`button`,20),Qg(`click`,function(){O(e);let t=K(),n=n_(13);return t.filter.set(``),k(n.focus())}),J(6,` Clear filter `),H()()}}function Aj(e,t){e&1&&(V(0,`span`,24),J(1,`active`),H())}function jj(e,t){if(e&1&&(V(0,`span`,24),J(1),H()),e&2){let e=K().$implicit;j(),X(`lazy `,e.node.lazy)}}function Mj(e,t){if(e&1&&(V(0,`span`,24),J(1),H()),e&2){let e=K().$implicit;j(),X(`outlet `,e.node.outlet)}}function Nj(e,t){if(e&1&&(V(0,`span`,25)(1,`span`,22),J(2,`declared in `),H(),J(3),H()),e&2){let e=K().$implicit;j(3),Y(e.source)}}function Pj(e,t){if(e&1&&(V(0,`span`,26),J(1,`redirect `),V(2,`span`,31),J(3,`→`),H(),V(4,`code`),J(5),H()()),e&2){let e=K().$implicit;j(5),Y(e.node.redirectTo)}}function Fj(e,t){if(e&1&&J(0),e&2){let e=K().$implicit;X(` `,e.node.component??(e.node.lazy===`unloaded`?`lazy, not loaded yet`:e.node.kind),` `)}}function Ij(e,t){if(e&1&&(V(0,`span`,24),J(1),H()),e&2){let e=t.$implicit;j(),Y(e)}}function Lj(e,t){if(e&1&&(V(0,`span`,24),J(1),H()),e&2){let e=t.$implicit;j(),X(`resolve `,e)}}function Rj(e,t){e&1&&(V(0,`span`,32),J(1,`–`),H(),V(2,`span`,22),J(3,`none`),H())}function zj(e,t){if(e&1&&J(0),e&2){let e=K().$implicit;X(` `,e.node.title,` `)}}function Bj(e,t){e&1&&(V(0,`span`,32),J(1,`–`),H(),V(2,`span`,22),J(3,`none`),H())}function Vj(e,t){if(e&1){let e=W();V(0,`input`,34),Qg(`input`,function(t){let n=O(e).$implicit,r=K(2).$implicit;return k(K(2).setParam(r.node.id,n,t.target.value))}),H()}if(e&2){let e=t.$implicit,n=K(2).$implicit,r=K(2);Vg(`placeholder`,e),M(`aria-label`,e+` for `+n.node.fullPath)(`aria-invalid`,r.isInvalid(n.node,e)?`true`:null)(`aria-describedby`,r.isInvalid(n.node,e)?`route-tree-row-result`:null)}}function Hj(e,t){if(e&1){let e=W();F(0,Vj,1,4,`input`,33,Tg),V(2,`button`,6),Qg(`click`,function(){O(e);let t=K().$implicit,n=n_(1);return k(K(2).navigate(t.node,n))}),J(3,` Go `),H()}if(e&2){let e=K().$implicit,t=K(2);I(t.params(e.node)),j(2),Vg(`disabled`,!t.navigationAllowed()),M(`aria-describedby`,t.navigationAllowed()?null:`route-tree-writes-off`)(`aria-label`,`Navigate to `+e.node.fullPath)}}function Uj(e,t){if(e&1){let e=W();V(0,`button`,20),Qg(`click`,function(){O(e);let t=K().$implicit;return k(K(2).resolveLazy(t.node))}),J(1,` Read lazy `),H()}if(e&2){let e=K().$implicit;M(`aria-label`,`Read lazy routes of `+e.node.fullPath)}}function Wj(e,t){if(e&1&&(V(0,`tr`,30)(1,`td`,35)(2,`p`,36),J(3),H()()()),e&2){let e=K(3);j(3),Y(e.rowResult()?.text)}}function Gj(e,t){if(e&1&&(V(0,`tr`,null,1)(2,`td`,23),J(3),N(4,Aj,2,0,`span`,24),N(5,jj,2,1,`span`,24),N(6,Mj,2,1,`span`,24),N(7,Nj,4,1,`span`,25),H(),V(8,`td`),N(9,Pj,6,1,`span`,26)(10,Fj,1,1),H(),V(11,`td`),F(12,Ij,2,1,`span`,24,Tg),F(14,Lj,2,1,`span`,24,Tg),N(16,Rj,4,0),H(),V(17,`td`),N(18,zj,1,1)(19,Bj,4,0),H(),V(20,`td`,27)(21,`div`,28),N(22,Hj,4,3),N(23,Uj,2,1,`button`,29),H()()(),N(24,Wj,4,1,`tr`,30)),e&2){let e=t.$implicit,n=K(2);q(`active`,n.isActive(e.node)),j(2),C_(`padding-left`,14+e.depth*16,`px`),j(),X(` `,e.node.fullPath,` `),j(),P(n.isActive(e.node)?4:-1),j(),P(e.node.lazy?5:-1),j(),P(e.node.outlet?6:-1),j(),P(e.source?7:-1),j(2),P(e.node.redirectTo===void 0?10:9),j(3),I(n.guardList(e.node)),j(2),I(e.node.resolvers??ov(15,gj)),j(2),P(!n.guardList(e.node).length&&!e.node.resolvers?.length?16:-1),j(2),P(e.node.title?18:19),j(4),P(n.canNavigate(e.node)?22:-1),j(),P(e.node.kind===`lazy`&&e.node.lazy===`unloaded`?23:-1),j(),P(n.rowResult()?.id===e.node.id?24:-1)}}function Kj(e,t){if(e&1&&(V(0,`div`,14)(1,`table`)(2,`thead`)(3,`tr`)(4,`th`,21),J(5,`Path`),H(),V(6,`th`,21),J(7,`Target`),H(),V(8,`th`,21),J(9,`Guards and resolvers`),H(),V(10,`th`,21),J(11,`Title`),H(),V(12,`th`,21)(13,`span`,22),J(14,`Actions`),H()()()(),V(15,`tbody`),F(16,Gj,25,16,null,null,_j),H()()()),e&2){let e=K();j(16),I(e.rows())}}var qj=class e{page=$.required();rpc=$(null);navigationAllowed=Q(()=>oE(this.rpc(),`router`));navigationOff=UT(`router`);sources=$([]);filter=A(``);testUrl=A(``);match=A(null);message=A(``);rowResult=A(null);paramValues=A({});checkedRow=A(null);active=Q(()=>new Set(this.page().activeIds??[]));rows=Q(()=>{let e=this.filter().toLowerCase(),t=this.sources(),n=[],r=(i,a)=>{for(let o of i){let i=ak(o,t),s=i&&ik(i);(!e||o.fullPath.toLowerCase().includes(e)||o.component?.toLowerCase().includes(e)||s?.toLowerCase().includes(e))&&n.push({node:o,depth:a,source:s}),o.children&&r(o.children,a+1)}};return r(this.page().config??[],0),n});hasKeys(e){return Object.keys(e).length>0}isActive(e){return this.active().has(e.id)}guardList(e){return Object.entries(e.guards??{}).flatMap(([e,t])=>t.map(t=>`${e} ${t}`))}params(e){return(e.fullPath.match(/:([A-Za-z0-9_]+)/g)??[]).map(e=>e.slice(1))}canNavigate(e){return e.redirectTo===void 0&&!e.outlet&&!e.fullPath.includes(`**`)&&(!!e.component||e.kind===`component`||e.kind===`lazy`)}setParam(e,t,n){this.paramValues.update(r=>({...r,[e]:{...r[e],[t]:n}}))}missingParams(e){let t=this.paramValues()[e.id]??{};return this.params(e).filter(e=>!t[e])}isInvalid(e,t){return this.checkedRow()===e.id&&!this.paramValues()[e.id]?.[t]}chainText(e){return e.chain.map(e=>e.fullPath).join(` → `)}async predict(){let e=this.testUrl().trim();e&&this.match.set(await ok(this.rpc(),`router-match`,{pageId:this.page().pageId,url:e}))}async probe(){let e=this.testUrl().trim();if(!e)return;this.message.set(`Running the real matcher in the app…`);let t=await ck(this.rpc(),this.page().pageId,{action:`probe`,url:e});if(t.error){this.message.set(String(t.error));return}this.message.set(t.matched?`The app recognized ${e} and its canMatch guards passed. The probe stopped before canActivate guards and resolvers, so those did not run. See the probe entry in Navigations.`:typeof t.redirectedTo==`string`?`A canMatch guard or the navigation error handler redirected ${e} to ${t.redirectedTo}. The probe stopped that navigation before it rendered anything.`:`The app could not recognize ${e}: ${String(t.reason??``)}`)}async navigate(e,t){let n=this.missingParams(e);if(n.length){this.checkedRow.set(e.id),this.rowResult.set({id:e.id,text:`Fill in ${n.map(e=>`:${e}`).join(`, `)} to navigate.`}),Array.from(t?.querySelectorAll(`input.param`)??[]).find(e=>!e.value)?.focus();return}this.checkedRow.set(null),this.rowResult.set({id:e.id,text:`Navigating to ${e.fullPath}…`});let r=await ck(this.rpc(),this.page().pageId,{action:`navigate`,pattern:e.fullPath,params:this.paramValues()[e.id]??{}});this.rowResult.set({id:e.id,text:r.error?String(r.error):`Navigation #${r.id}: ${r.outcome}${r.finalUrl?` at ${r.finalUrl}`:``}.`})}async resolveLazy(e){let t=await ck(this.rpc(),this.page().pageId,{action:`resolve-lazy`,id:e.id});if(t.error){this.rowResult.set({id:e.id,text:String(t.error)});return}let n=t.routes??[];this.rowResult.set({id:e.id,text:`${e.fullPath} declares ${n.length} route(s): ${n.map(e=>`/${e.path}`).join(`, `)}. The router loads them for real on the first navigation that needs them.`})}static ɵfac=function(t){return new(t||e)};static ɵcmp=Vh({type:e,selectors:[[`app-route-tree`]],inputs:{page:[1,`page`],rpc:[1,`rpc`],sources:[1,`sources`]},decls:18,vars:9,consts:[[`filterInput`,``],[`rowEl`,``],[1,`test`,3,`submit`],[`for`,`test-url`],[`id`,`test-url`,`type`,`text`,`placeholder`,`/users/42`,1,`field`,3,`input`,`value`],[`type`,`submit`,1,`small`,`primary`],[`type`,`button`,1,`small`,3,`click`,`disabled`],[`role`,`status`,1,`result`],[`role`,`status`,1,`message`],[`id`,`route-tree-writes-off`,1,`message`],[1,`filter-row`],[`type`,`text`,`aria-label`,`Filter routes`,`placeholder`,`Filter by path, component or file`,1,`field`,`filter`,3,`input`,`value`],[1,`muted`,`summary`],[1,`empty`],[`role`,`region`,`aria-label`,`Live route config`,`tabindex`,`0`,1,`table-scroll`],[1,`muted`],[`data-tone`,`good`,1,`badge`],[1,`chain`],[`data-tone`,`bad`,1,`badge`],[1,`empty-title`],[`type`,`button`,1,`small`,3,`click`],[`scope`,`col`],[1,`visually-hidden`],[1,`path`],[1,`tag`],[1,`src`],[1,`redirect`],[1,`actions`],[1,`actions-inner`],[`type`,`button`,1,`small`],[1,`row-result`],[`aria-hidden`,`true`],[`aria-hidden`,`true`,1,`nil`],[`type`,`text`,1,`field`,`param`,3,`placeholder`],[`type`,`text`,1,`field`,`param`,3,`input`,`placeholder`],[`colspan`,`5`],[`id`,`route-tree-row-result`,`role`,`status`]],template:function(e,t){if(e&1){let e=W();V(0,`form`,2),Qg(`submit`,function(n){return O(e),n.preventDefault(),k(t.predict())}),V(1,`label`,3),J(2,`Test a URL`),H(),V(3,`input`,4),Qg(`input`,function(e){return t.testUrl.set(e.target.value)}),H(),V(4,`button`,5),J(5,`Predict`),H(),V(6,`button`,6),Qg(`click`,function(){return t.probe()}),J(7,` Probe in app `),H()(),N(8,Cj,5,2,`div`,7),N(9,wj,2,1,`p`,8),N(10,Tj,2,1,`p`,9),V(11,`div`,10)(12,`input`,11,0),Qg(`input`,function(e){return t.filter.set(e.target.value)}),H(),N(14,Dj,3,3,`p`,12),H(),N(15,Oj,5,2,`div`,13)(16,kj,7,0,`div`,13)(17,Kj,18,0,`div`,14)}if(e&2){let e;j(3),Vg(`value`,t.testUrl()),j(3),Vg(`disabled`,!t.navigationAllowed()),M(`aria-describedby`,t.navigationAllowed()?null:`route-tree-writes-off`),j(2),P((e=t.match())?8:-1,e),j(),P(t.message()?9:-1),j(),P(t.navigationAllowed()?-1:10),j(2),Vg(`value`,t.filter()),j(2),P(t.page().config?14:-1),j(),P(t.page().config?t.rows().length?17:16:15)}},dependencies:[ab],styles:[`.muted[_ngcontent-%COMP%] {
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
}`]})},Jj=(e,t)=>t.id;function Yj(e,t){if(e&1){let e=W();R(0,`div`,4)(1,`span`,5),J(2,`Page`),z(),R(3,`app-select`,6),G(`valueChange`,function(t){return O(e),k(K(2).pageId.set(t))}),z()()}if(e&2){let e=K(),t=K();j(3),L(`options`,t.pageOptions())(`value`,e.pageId)}}function Xj(e,t){e&1&&N(0,Yj,4,2,`div`,4),e&2&&P(K().pages().length>1?0:-1)}function Zj(e,t){if(e&1){let e=W();R(0,`div`,1)(1,`p`,7),J(2,`Could not load the live router state.`),z(),R(3,`p`,8),J(4,` Check that the dev server with ng-devtools is still running, then retry. `),z(),R(5,`button`,9),G(`click`,function(){return O(e),k(K().retry())}),J(6,`Retry`),z()()}}function Qj(e,t){e&1&&(R(0,`p`,2),J(1,`Loading the live router state…`),z())}function $j(e,t){if(e&1&&(R(0,`span`,17),J(1),z(),R(2,`span`,18),J(3),z()),e&2){let e=K(3);j(),Y(e.problems()),j(2),X(`, `,e.problems(),` problem navigations`)}}function eM(e,t){if(e&1){let e=W();R(0,`button`,16),G(`click`,function(){let t=O(e).$implicit;return k(K(2).selected.set(t.id))}),J(1),N(2,$j,4,2),z()}if(e&2){let e=t.$implicit,n=K(2);L(`id`,`router-tab-`+e.id),M(`aria-selected`,e.id===n.selected())(`aria-controls`,`router-panel-`+e.id)(`tabindex`,e.id===n.selected()?0:-1),j(),X(` `,e.label,` `),j(),P(e.id===`navigations`&&n.problems()>0?2:-1)}}function tM(e,t){if(e&1&&B(0,`app-route-current`,13),e&2){let e=K(),t=K();L(`page`,e)(`rpc`,t.rpc())}}function nM(e,t){if(e&1&&B(0,`app-route-timeline`,13),e&2){let e=K(),t=K();L(`page`,e)(`rpc`,t.rpc())}}function rM(e,t){if(e&1&&B(0,`app-route-tree`,14),e&2){let e=K(),t=K();L(`page`,e)(`rpc`,t.rpc())(`sources`,t.sources())}}function iM(e,t){e&1&&B(0,`app-route-setup`,15),e&2&&L(`page`,K())}function aM(e,t){if(e&1&&B(0,`app-route-lint`,13),e&2){let e=K(),t=K();L(`page`,e)(`rpc`,t.rpc())}}function oM(e,t){if(e&1){let e=W();R(0,`div`,10),G(`keydown`,function(t){return O(e),k(K().onKey(t))}),F(1,eM,3,6,`button`,11,Jj),z(),R(3,`div`,12),N(4,tM,1,2,`app-route-current`,13)(5,nM,1,2,`app-route-timeline`,13)(6,rM,1,3,`app-route-tree`,14)(7,iM,1,1,`app-route-setup`,15)(8,aM,1,2,`app-route-lint`,13),z()}if(e&2){let e,t=K();j(),I(t.tabs),j(2),L(`id`,`router-panel-`+t.selected()),M(`aria-labelledby`,`router-tab-`+t.selected()),j(),P((e=t.selected())===`current`?4:e===`navigations`?5:e===`routes`?6:e===`setup`?7:e===`lint`?8:-1)}}function sM(e,t){e&1&&(R(0,`div`,3)(1,`p`,7),J(2,`No page is reporting router state yet.`),z(),R(3,`p`,8),J(4,` Open the app in a browser. This view updates as soon as a page connects. `),z()())}var cM=[{id:`current`,label:`Current`},{id:`navigations`,label:`Navigations`},{id:`routes`,label:`Routes`},{id:`setup`,label:`Setup`},{id:`lint`,label:`Lint`}],lM=class e{rpc=$(null);sources=$([]);tabs=cM;selected=A(`current`);pages=A([]);hostPageId=ZT();loading=A(!0);failed=A(!1);pageId=Tv({source:this.pages,computation:(e,t)=>t?.value&&e.some(e=>e.pageId===t.value)?t.value:e.find(e=>e.pageId===this.hostPageId&&e.snapshot)?.pageId??e.find(e=>e.snapshot)?.pageId??e[0]?.pageId??null});unsubscribe=null;destroyRef=E(ws);page=Q(()=>{let e=this.pages();return e.find(e=>e.pageId===this.pageId())??e[0]??null});problems=Q(()=>(this.page()?.navigations??[]).filter(e=>!e.probe&&[`failed`,`cancelled`,`redirected`].includes(e.outcome)).length);constructor(){dc(()=>{let e=this.rpc();e&&this.load(e)}),this.destroyRef.onDestroy(()=>this.unsubscribe?.())}async load(e){this.loading.set(!0),this.failed.set(!1);try{let t=await e.scope(`ng-devtools`).rpc.sharedState(`router`);if(this.destroyRef.destroyed)return;let n=e=>{this.pages.set(e?.pages??[])};n(t.value()),this.unsubscribe?.(),this.unsubscribe=t.on(`updated`,n)}catch{this.failed.set(!0)}finally{this.loading.set(!1)}}retry(){let e=this.rpc();e&&this.load(e)}pageOptions=Q(()=>this.pages().map(e=>({value:e.pageId,label:e.snapshot?.url??e.pageId,hint:e.pageId})));onKey(e){let t=this.tabs.map(e=>e.id),n=t.indexOf(this.selected()),r=n;if(e.key===`ArrowRight`)r=(n+1)%t.length;else if(e.key===`ArrowLeft`)r=(n-1+t.length)%t.length;else if(e.key===`Home`)r=0;else if(e.key===`End`)r=t.length-1;else return;e.preventDefault(),this.selected.set(t[r]);let i=e.currentTarget;queueMicrotask(()=>i.querySelector(`#router-tab-${t[r]}`)?.focus())}static ɵfac=function(t){return new(t||e)};static ɵcmp=Vh({type:e,selectors:[[`app-live-route`]],inputs:{rpc:[1,`rpc`],sources:[1,`sources`]},decls:8,vars:2,consts:[[1,`section-head`],[`role`,`alert`,1,`empty`],[`role`,`status`,1,`muted`,`empty`],[1,`empty`],[1,`page-pick`],[`id`,`live-route-page-label`,1,`page-label`],[`labelledBy`,`live-route-page-label`,3,`valueChange`,`options`,`value`],[1,`empty-title`],[1,`muted`],[`type`,`button`,1,`retry`,3,`click`],[`role`,`tablist`,`aria-label`,`Router views`,1,`tabs`,3,`keydown`],[`type`,`button`,`role`,`tab`,3,`id`],[`role`,`tabpanel`,1,`panel`,3,`id`],[3,`page`,`rpc`],[3,`page`,`rpc`,`sources`],[3,`page`],[`type`,`button`,`role`,`tab`,3,`click`,`id`],[`aria-hidden`,`true`,1,`count`],[1,`visually-hidden`]],template:function(e,t){if(e&1&&(R(0,`div`,0)(1,`h2`),J(2,`Live router`),z(),N(3,Xj,1,1),z(),N(4,Zj,7,0,`div`,1)(5,Qj,2,0,`p`,2)(6,oM,9,3)(7,sM,5,0,`div`,3)),e&2){let e,n;j(3),P((e=t.page())?3:-1,e),j(),P(t.failed()?4:t.loading()?5:(n=t.page())?6:7,n)}},dependencies:[Wk,iA,vA,hj,qj,oD],styles:[`[_nghost-%COMP%] {
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
}`]})};function uM(e,t){e&1&&J(0,` The Routes tab above shows what the router uses. `)}function dM(e,t){if(e&1){let e=W();R(0,`button`,13),G(`click`,function(){O(e);let t=K();return k(t.expanded.set(!t.expanded()))}),J(1),z()}if(e&2){let e=K();M(`aria-expanded`,e.expanded()),j(),X(` `,e.expanded()?`Hide table`:`Show table`,` `)}}function fM(e,t){e&1&&(J(0,` Run `),R(1,`code`),J(2,`ng-devtools build`),z(),J(3,` again to rebuild the report. `))}function pM(e,t){e&1&&J(0,` Check that the dev server is running, then refresh. `)}function mM(e,t){if(e&1&&(R(0,`div`,11)(1,`p`,14),J(2,`Could not scan the route files.`),z(),R(3,`p`,15),N(4,fM,4,0)(5,pM,1,0),z()()),e&2){let e=K();j(4),P(e.staticReport()?4:5)}}function hM(e,t){e&1&&(R(0,`p`,12),J(1,`Scanning routes…`),z())}function gM(e,t){if(e&1){let e=W();R(0,`div`,16)(1,`p`,14),J(2,`No routes match the filter.`),z(),R(3,`p`,15),J(4,`Search by path, component, guard, title or file name.`),z(),R(5,`button`,10),G(`click`,function(){O(e);let t=K(2),n=n_(12);return t.filter.set(``),k(n.focus())}),J(6,` Clear filter `),z()()}}function _M(e,t){e&1&&(R(0,`div`,16)(1,`p`,14),J(2,`No routes found.`),z(),R(3,`p`,15),J(4,` Routes are read from `),R(5,`code`),J(6,`*.routes.ts`),z(),J(7,` and `),R(8,`code`),J(9,`*routing.module.ts`),z(),J(10,` files, the files they lazy load, plus Analog pages. Add one and refresh. `),z()())}function vM(e,t){e&1&&N(0,gM,7,0,`div`,16)(1,_M,11,0,`div`,16),e&2&&P(+!K().routes().length)}function yM(e,t){if(e&1&&(R(0,`span`,21),J(1),z()),e&2){let e=K().$implicit;j(),Y(e.kind)}}function bM(e,t){if(e&1&&(R(0,`span`,22)(1,`span`,25),J(2,`→`),z(),R(3,`span`,26),J(4,`redirects to`),z(),J(5),z()),e&2){let e=K().$implicit;j(5),X(` `,e.redirectTo)}}function xM(e,t){if(e&1&&(R(0,`code`,23),J(1),z()),e&2){let e=K().$implicit;j(),Y(e.component)}}function SM(e,t){e&1&&(R(0,`span`,27),J(1,`–`),z(),R(2,`span`,26),J(3,`none`),z())}function CM(e,t){if(e&1&&(R(0,`span`,21),J(1),z()),e&2){let e=t.$implicit;j(),Y(e)}}function wM(e,t){e&1&&(R(0,`span`,27),J(1,`–`),z(),R(2,`span`,26),J(3,`none`),z())}function TM(e,t){if(e&1&&J(0),e&2){let e=K().$implicit;X(` `,e.title,` `)}}function EM(e,t){e&1&&(R(0,`span`,27),J(1,`–`),z(),R(2,`span`,26),J(3,`none`),z())}function DM(e,t){if(e&1&&(R(0,`tr`)(1,`td`,20),J(2),N(3,yM,2,1,`span`,21),z(),R(4,`td`),N(5,bM,6,1,`span`,22)(6,xM,2,1,`code`,23)(7,SM,4,0),z(),R(8,`td`),F(9,CM,2,1,`span`,21,wg,!1,wM,4,0),z(),R(12,`td`),N(13,TM,1,1)(14,EM,4,0),z(),R(15,`td`,24),J(16),z()()),e&2){let e=t.$implicit,n=K(2);j(2),X(` `,e.fullPath,` `),j(),P(e.kind===`page`?-1:3),j(2),P(e.redirectTo===void 0?e.component?6:7:5),j(4),I(n.checks(e)),j(4),P(e.title?13:14),j(3),Y(n.location(e))}}function OM(e,t){if(e&1&&(R(0,`p`,17),J(1),z(),R(2,`div`,18)(3,`table`)(4,`thead`)(5,`tr`)(6,`th`,19),J(7,`Path`),z(),R(8,`th`,19),J(9,`Component / Target`),z(),R(10,`th`,19),J(11,`Guards and resolvers`),z(),R(12,`th`,19),J(13,`Title`),z(),R(14,`th`,19),J(15,`Declared in`),z()()(),R(16,`tbody`),F(17,DM,17,6,`tr`,null,wg),z()()()),e&2){let e=K();j(),Y_(` `,e.filtered().length,` of `,e.routes().length,` route entries, `,e.navigable(),` navigable `),j(16),I(e.filtered())}}var kM=class e{rpc=$(null);staticReport=Q(()=>rE(this.rpc()));routes=A([]);filter=A(``);loading=A(!1);error=A(!1);live=Rv(lM);liveHasConfig=Q(()=>!!this.live()?.page()?.config);expanded=Tv(()=>!this.liveHasConfig());navigable=Q(()=>this.filtered().filter(e=>e.kind===`page`).length);filtered=Q(()=>{let e=this.filter().toLowerCase().trim(),t=this.routes();return e?t.filter(t=>t.fullPath.toLowerCase().includes(e)||t.component&&t.component.toLowerCase().includes(e)||t.redirectTo&&t.redirectTo.toLowerCase().includes(e)||t.title&&t.title.toLowerCase().includes(e)||this.checks(t).some(t=>t.toLowerCase().includes(e))||t.file.toLowerCase().includes(e)):t});constructor(){dc(()=>{this.rpc()&&this.refresh()})}checks(e){return[...Object.entries(e.guards??{}).flatMap(([e,t])=>t.map(t=>`${e} ${t}`)),...(e.resolvers??[]).map(e=>`resolve ${e}`)]}location(e){return ik(e)}onFilterInput(e){let t=e.target;this.filter.set(t?.value??``)}async refresh(){let e=this.rpc();if(e){this.loading.set(!0),this.error.set(!1);try{let t=await e.scope(`ng-devtools`).rpc.call(`get-routes`);this.routes.set(t)}catch{this.error.set(!0)}finally{this.loading.set(!1)}}}static ɵfac=function(t){return new(t||e)};static ɵcmp=Vh({type:e,selectors:[[`app-route-inspector`]],viewQuery:function(e,t){e&1&&e_(t.live,lM,5),e&2&&t_()},inputs:{rpc:[1,`rpc`]},decls:19,vars:9,consts:[[`filterInput`,``],[3,`rpc`,`sources`],[`aria-labelledby`,`config-heading`,1,`config`],[1,`section-head`],[`id`,`config-heading`],[1,`muted`,`hint`],[`type`,`button`,`aria-controls`,`config-body`,1,`small`,`toggle`],[`id`,`config-body`,1,`config-body`,3,`hidden`],[1,`toolbar`],[`type`,`text`,`aria-label`,`Filter source routes`,`placeholder`,`Filter routes…`,1,`field`,3,`input`,`value`],[`type`,`button`,1,`small`,3,`click`],[`role`,`alert`,1,`empty`],[`role`,`status`,1,`muted`,`empty`],[`type`,`button`,`aria-controls`,`config-body`,1,`small`,`toggle`,3,`click`],[1,`empty-title`],[1,`muted`],[1,`empty`],[1,`muted`,`count`],[`role`,`region`,`aria-label`,`Source route config table`,`tabindex`,`0`,1,`table-scroll`],[`scope`,`col`],[1,`path`],[1,`tag`],[1,`redirect`],[1,`component`],[1,`file`],[`aria-hidden`,`true`],[1,`visually-hidden`],[`aria-hidden`,`true`,1,`nil`]],template:function(e,t){e&1&&(B(0,`app-live-route`,1),R(1,`section`,2)(2,`div`,3)(3,`h2`,4),J(4,`Source route config`),z(),R(5,`span`,5),J(6,` Read from your source files. `),N(7,uM,1,0),z(),N(8,dM,2,2,`button`,6),z(),R(9,`div`,7)(10,`div`,8)(11,`input`,9,0),G(`input`,function(e){return t.onFilterInput(e)}),z(),R(13,`button`,10),G(`click`,function(){return t.refresh()}),J(14),z()(),N(15,mM,6,1,`div`,11)(16,hM,2,0,`p`,12)(17,vM,2,1)(18,OM,19,3),z()()),e&2&&(L(`rpc`,t.rpc())(`sources`,t.routes()),j(7),P(t.liveHasConfig()?7:-1),j(),P(t.liveHasConfig()?8:-1),j(),L(`hidden`,!t.expanded()),j(2),L(`value`,t.filter()),j(2),M(`aria-busy`,t.loading()),j(),X(` `,t.loading()?`Scanning…`:`Refresh`,` `),j(),P(t.error()?15:t.loading()&&t.routes().length===0?16:t.filtered().length===0?17:18))},dependencies:[lM],styles:[`.muted[_ngcontent-%COMP%] {
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
}`]})},AM=e=>({id:e,label:`Status history`}),jM=e=>({id:e,label:`Value history`}),MM=(e,t)=>t.kind,NM=(e,t)=>t.name+t.file+t.line,PM=(e,t)=>t.epoch,FM=(e,t)=>t.id;function IM(e,t){if(e&1){let e=W();R(0,`div`,3)(1,`span`,11),J(2,`Graph of`),z(),R(3,`app-select`,12),G(`valueChange`,function(t){return O(e),k(K().pickComponent(t))}),z()()}if(e&2){let e=K();j(3),L(`options`,e.componentOptions())(`value`,e.pickerValue())}}function LM(e,t){if(e&1&&(R(0,`span`,15),J(1),z()),e&2){let e=K(2);j(),Y(e.sourceNote(e.graph().source))}}function RM(e,t){if(e&1&&(R(0,`p`,4)(1,`span`,13),J(2),z(),R(3,`span`,14),J(4),z(),N(5,LM,2,1,`span`,15),z()),e&2){let e=t,n=K();j(2),Y(e.name),j(2),Y(e.path),j(),P(n.graph().source?5:-1)}}function zM(e,t){if(e&1&&(R(0,`p`,4)(1,`span`,13),J(2),z(),R(3,`span`,15),J(4,`environment injector`),z()()),e&2){let e=K();j(2),Y(e.injectorLabel(t))}}function BM(e,t){e&1&&(R(0,`p`,5),J(1,` The picked component or injector is gone or has no signal graph, so this shows another one. `),z())}function VM(e,t){e&1&&J(0,` The effects registered on this injector and the signals they read. A signal that no effect reads is not part of the graph. Pick a kind to filter. `)}function HM(e,t){e&1&&J(0,` The live signal graph of one component. Only signals that its template or an effect has read appear here; a signal nothing has read yet is not part of the graph. Pick a kind to filter. `)}function UM(e,t){e&1&&J(0,` Every signal, computed and effect found in your source. Pick a kind to filter. `)}function WM(e,t){e&1&&(R(0,`p`,5),J(1,` The live signal graph needs Angular 20.1 or later. This list comes from a source scan. `),z())}function GM(e,t){e&1&&(R(0,`p`,5),J(1,` The signal write hook did not load. Value history shows sampled values only, with no exact set entries. `),z())}function KM(e,t){if(e&1&&(R(0,`p`,5),J(1),z()),e&2){let e=K();j(),Z(` Showing `,e.graph().nodes.length,` of `,t,` signals. The rest and their edges are left out. `)}}function qM(e,t){if(e&1){let e=W();R(0,`button`,16),G(`click`,function(){let t=O(e).$implicit,n=K(2);return k(n.kind.set(n.kind()===t.kind?null:t.kind))}),B(1,`span`,19),R(2,`span`,20),J(3),z(),R(4,`span`,17),J(5),z()()}if(e&2){let e=t.$implicit,n=K(2);q(`active`,n.kind()===e.kind),M(`aria-pressed`,n.kind()===e.kind),j(),C_(`background`,n.kindColor(e.kind)),j(2),Y(e.kind),j(2),Y(e.count)}}function JM(e,t){if(e&1){let e=W();R(0,`div`,7)(1,`button`,16),G(`click`,function(){return O(e),k(K().kind.set(null))}),J(2,` All `),R(3,`span`,17),J(4),z()(),F(5,qM,6,7,`button`,18,MM),z()}if(e&2){let e=K();j(),q(`active`,!e.kind()),M(`aria-pressed`,!e.kind()),j(3),Y(e.kindTotal()),j(),I(e.kindCounts())}}function YM(e,t){e&1&&(R(0,`div`,8),B(1,`span`,21),R(2,`p`,22),J(3,`Scanning source for signals…`),z()())}function XM(e,t){e&1&&(R(0,`div`,9)(1,`p`,22),J(2,`No signals found.`),z(),R(3,`p`,23),J(4,` No `),R(5,`code`),J(6,`signal()`),z(),J(7,`, `),R(8,`code`),J(9,`computed()`),z(),J(10,` or `),R(11,`code`),J(12,`effect()`),z(),J(13,` calls were found in your source. To see the live graph, run Angular 20.1 or later with the overlay connected and select a component. `),z()())}function ZM(e,t){if(e&1&&(R(0,`span`,33),J(1,`·`),z(),R(2,`span`),J(3),z()),e&2){let e=K().$implicit;j(3),X(`in <`,e.component,`>`)}}function QM(e,t){if(e&1&&(R(0,`div`,26)(1,`div`,28)(2,`span`,29),J(3),z(),R(4,`span`,30),J(5),z()(),R(6,`div`,31)(7,`span`,32),J(8),z(),N(9,ZM,4,1),z()()),e&2){let e=t.$implicit,n=K(2);j(2),C_(`background`,n.kindColor(e.kind)),j(),Y(e.kind),j(2),Y(e.name),j(2),L(`title`,e.file+`:`+e.line),j(),Z(``,e.file,`:`,e.line),j(),P(e.component?9:-1)}}function $M(e,t){if(e&1){let e=W();R(0,`div`,27)(1,`p`,22),J(2,`No signals match.`),z(),R(3,`p`,23),J(4,`Try a different name or kind.`),z(),R(5,`button`,34),G(`click`,function(){return O(e),k(K(2).clearFilters())}),J(6,`Clear filters`),z()()}}function eN(e,t){if(e&1&&(R(0,`p`,24),J(1,`Signals from source scan (static analysis):`),z(),R(2,`div`,25),F(3,QM,10,8,`div`,26,NM,!1,$M,7,0,`div`,27),z()),e&2){let e=K();j(3),I(e.filteredSourceSignals())}}function tN(e,t){if(e&1&&(R(0,`span`,40),J(1),z()),e&2){let e=K().$implicit;j(),X(``,e.missed,` earlier not captured`)}}function nN(e,t){if(e&1&&(R(0,`li`)(1,`span`,38)(2,`time`),J(3),dv(4,`date`),z(),R(5,`span`,39),J(6),z(),R(7,`span`),J(8),z(),N(9,tN,2,1,`span`,40),z(),R(10,`pre`),J(11),dv(12,`json`),z()()),e&2){let e=t.$implicit,n=K(3);j(3),Y(mv(4,7,e.at,`HH:mm:ss.SSS`)),j(2),w_(`source-`+e.source),j(),Y(n.sourceLabel(e.source)),j(2),X(`epoch `,e.epoch),j(),P(e.missed?9:-1),j(2),Y(pv(12,10,e.value))}}function rN(e,t){if(e&1&&(R(0,`h4`,35),J(1),z(),R(2,`p`,36),J(3),z(),R(4,`ol`,37),F(5,nN,13,12,`li`,null,PM),z()),e&2){let e=K(),t=e.id,n=e.label,r=K();L(`id`,`history-heading-`+t),j(),Y(n),j(2),Y(r.historySummary(t)),j(),M(`aria-labelledby`,`history-heading-`+t),j(),I(r.selectedHistory())}}function iN(e,t){e&1&&N(0,rN,7,4),e&2&&P(K().selectedHistory().length?0:-1)}function aN(e,t){if(e&1&&(R(0,`span`,49),J(1),z()),e&2){let e=K().$implicit;w_(`tone-`+K(2).statusTone(e.status)),j(),Y(e.status)}}function oN(e,t){if(e&1&&(R(0,`span`,45),J(1),z()),e&2){let e=t;j(),Z(``,e,` `,e===1?`change`:`changes`)}}function sN(e,t){if(e&1&&(R(0,`span`,47),J(1),dv(2,`json`),z()),e&2){let e=K().$implicit;j(),Y(pv(2,1,e.error))}}function cN(e,t){if(e&1&&(R(0,`span`,47),J(1),dv(2,`json`),z()),e&2){let e=K().$implicit;j(),Y(pv(2,1,e.value))}}function lN(e,t){e&1&&(R(0,`p`,23),J(1,` This resource has no name. Pass `),R(2,`code`),J(3,`debugName`),z(),J(4,` to `),R(5,`code`),J(6,`resource()`),z(),J(7,` or `),R(8,`code`),J(9,`httpResource()`),z(),J(10,` to name it here. `),z())}function uN(e,t){if(e&1&&(R(0,`dt`),J(1,`Loading`),z(),R(2,`dd`),J(3),z()),e&2){let e=K(2).$implicit;j(3),Y(e.isLoading?`yes`:`no`)}}function dN(e,t){if(e&1&&(R(0,`dt`),J(1,`HTTP status`),z(),R(2,`dd`),J(3),z()),e&2){let e=K(2).$implicit;j(3),Y(e.statusCode)}}function fN(e,t){if(e&1&&(R(0,`dt`),J(1,`Params`),z(),R(2,`dd`)(3,`pre`,53),J(4),dv(5,`json`),z()()),e&2){let e=K(2).$implicit;j(3),M(`aria-label`,`Params of `+e.name),j(),Y(pv(5,2,e.params))}}function pN(e,t){if(e&1&&(R(0,`dt`),J(1,`Value`),z(),R(2,`dd`)(3,`pre`,53),J(4),dv(5,`json`),z()()),e&2){let e=K(2).$implicit;j(3),M(`aria-label`,`Value of `+e.name),j(),Y(pv(5,2,e.value))}}function mN(e,t){if(e&1&&(R(0,`dt`),J(1,`Error`),z(),R(2,`dd`)(3,`pre`,53),J(4),dv(5,`json`),z()()),e&2){let e=K(2).$implicit;j(3),M(`aria-label`,`Error of `+e.name),j(),Y(pv(5,2,e.error))}}function hN(e,t){if(e&1&&(R(0,`li`)(1,`span`,54),J(2),z(),R(3,`span`,55),J(4),z()()),e&2){let e=t.$implicit,n=K(5);j(),C_(`background`,n.kindColor(e.kind)),j(),Y(e.kind),j(2),Y(e.label??e.id)}}function gN(e,t){if(e&1&&(R(0,`ul`,35),F(1,hN,5,4,`li`,null,FM),z()),e&2){let e=K(2).$implicit,t=K(2);L(`id`,`resource-internals-`+e.id),j(),I(t.internalsOf(e))}}function _N(e,t){if(e&1){let e=W();R(0,`div`,48)(1,`h3`,50),J(2),z(),N(3,lN,11,0,`p`,23),R(4,`dl`)(5,`dt`),J(6,`Status`),z(),R(7,`dd`),J(8),z(),N(9,uN,4,1),N(10,dN,4,1),N(11,fN,6,4),N(12,pN,6,4),N(13,mN,6,4),z(),zg(14,51),R(15,`button`,52),G(`click`,function(){O(e);let t=K(3);return k(t.showInternals.set(!t.showInternals()))}),J(16),z(),N(17,gN,3,1,`ul`,35),z()}if(e&2){let e=K().$implicit,t=K(2),n=n_(18);L(`id`,`signal-detail-`+e.id),j(2),Y(e.name),j(),P(e.named?-1:3),j(5),Y(e.status??`unknown`),j(),P(e.isLoading===void 0?-1:9),j(),P(e.statusCode===void 0?-1:10),j(),P(e.params===void 0?-1:11),j(),P(e.value===void 0?-1:12),j(),P(e.error===void 0?-1:13),j(),L(`ngTemplateOutlet`,n)(`ngTemplateOutletContext`,sv(16,AM,e.id)),j(),M(`aria-expanded`,t.showInternals())(`aria-controls`,`resource-internals-`+e.id),j(),Z(` `,t.showInternals()?`Hide`:`Show`,` internal signals (`,e.nodeIds.length,`) `),j(),P(t.showInternals()?17:-1)}}function vN(e,t){if(e&1){let e=W();R(0,`li`)(1,`button`,43),G(`click`,function(){let t=O(e).$implicit;return k(K(2).select(t.id))}),R(2,`span`,28)(3,`span`,29),J(4,`resource`),z(),R(5,`span`,30),J(6),z(),N(7,aN,2,3,`span`,44),N(8,oN,2,2,`span`,45),B(9,`span`,46),z(),N(10,sN,3,3,`span`,47)(11,cN,3,3,`span`,47),z(),N(12,_N,18,18,`div`,48),z()}if(e&2){let e,n=t.$implicit,r=K(2);j(),q(`selected`,r.selectedId()===n.id),M(`aria-expanded`,r.selectedId()===n.id)(`aria-controls`,`signal-detail-`+n.id)(`data-card`,n.id),j(2),C_(`background`,r.kindColor(`resource`)),j(3),Y(n.name),j(),P(n.status?7:-1),j(),P((e=n.changes)?8:-1,e),j(2),P(n.error===void 0?n.value===void 0?-1:11:10),j(2),P(r.selectedId()===n.id?12:-1)}}function yN(e,t){if(e&1&&(R(0,`h2`,41),J(1,`Resources`),z(),R(2,`ul`,42),F(3,vN,13,12,`li`,null,FM),z()),e&2){let e=K();j(3),I(e.filteredResources())}}function bN(e,t){if(e&1&&(R(0,`span`,45),J(1),z()),e&2){let e=t;j(),Z(``,e,` `,e===1?`change`:`changes`)}}function xN(e,t){if(e&1&&(R(0,`span`,47),J(1),dv(2,`json`),z()),e&2){let e=K().$implicit;j(),Y(pv(2,1,e.value))}}function SN(e,t){if(e&1&&(R(0,`span`,33),J(1,`·`),z(),R(2,`span`),J(3),z()),e&2){let e=K().$implicit,t=K(2);j(3),X(`Deps: `,t.getDependencies(e).length)}}function CN(e,t){if(e&1&&(R(0,`span`,33),J(1,`·`),z(),R(2,`span`),J(3),z()),e&2){let e=K().$implicit,t=K(2);j(3),X(`Consumers: `,t.getConsumers(e).length)}}function wN(e,t){if(e&1&&(R(0,`dt`),J(1,`Value`),z(),R(2,`dd`)(3,`pre`,53),J(4),dv(5,`json`),z()()),e&2){let e=K(4);j(3),M(`aria-label`,`Value of `+(e.selectedNode().label??`signal`)),j(),Y(pv(5,2,e.selectedNode().value))}}function TN(e,t){if(e&1){let e=W();R(0,`li`)(1,`button`,58),G(`click`,function(){let t=O(e).$implicit;return k(K(5).jumpTo(t))}),R(2,`span`,54),J(3),z(),R(4,`span`,55),J(5),z()()()}if(e&2){let e=t.$implicit,n=K(5);j(),M(`aria-label`,`Go to `+e.kind+` `+(e.label??e.id)),j(),C_(`background`,n.kindColor(e.kind)),j(),Y(e.kind),j(2),Y(e.label??e.id)}}function EN(e,t){if(e&1&&(R(0,`h4`),J(1,`Dependencies (producers)`),z(),R(2,`ul`),F(3,TN,6,5,`li`,null,FM),z()),e&2){let e=K(4);j(3),I(e.getDependencies(e.selectedNode()))}}function DN(e,t){if(e&1){let e=W();R(0,`li`)(1,`button`,58),G(`click`,function(){let t=O(e).$implicit;return k(K(5).jumpTo(t))}),R(2,`span`,54),J(3),z(),R(4,`span`,55),J(5),z()()()}if(e&2){let e=t.$implicit,n=K(5);j(),M(`aria-label`,`Go to `+e.kind+` `+(e.label??e.id)),j(),C_(`background`,n.kindColor(e.kind)),j(),Y(e.kind),j(2),Y(e.label??e.id)}}function ON(e,t){if(e&1&&(R(0,`h4`),J(1,`Consumers`),z(),R(2,`ul`),F(3,DN,6,5,`li`,null,FM),z()),e&2){let e=K(4);j(3),I(e.getConsumers(e.selectedNode()))}}function kN(e,t){if(e&1&&(R(0,`div`,48)(1,`h3`,50),J(2),z(),R(3,`dl`)(4,`dt`),J(5,`Kind`),z(),R(6,`dd`),J(7),z(),R(8,`dt`),J(9,`Epoch`),z(),R(10,`dd`),J(11),z(),N(12,wN,6,4),z(),N(13,EN,5,0),N(14,ON,5,0),zg(15,51),z()),e&2){let e=K().$implicit,t=K(2),n=n_(18);L(`id`,`signal-detail-`+e.id),j(2),Y(t.selectedNode().label??t.selectedNode().id),j(5),Y(t.selectedNode().kind),j(4),Y(t.selectedNode().epoch),j(),P(t.selectedNode().value===void 0?-1:12),j(),P(t.getDependencies(t.selectedNode()).length?13:-1),j(),P(t.getConsumers(t.selectedNode()).length?14:-1),j(),L(`ngTemplateOutlet`,n)(`ngTemplateOutletContext`,sv(9,jM,e.id))}}function AN(e,t){if(e&1){let e=W();R(0,`li`)(1,`button`,43),G(`click`,function(){let t=O(e).$implicit;return k(K(2).select(t.id))}),R(2,`span`,28)(3,`span`,29),J(4),z(),R(5,`span`,30),J(6),z(),N(7,bN,2,2,`span`,45),B(8,`span`,46),z(),N(9,xN,3,3,`span`,47),R(10,`span`,31)(11,`span`),J(12),z(),N(13,SN,4,1),N(14,CN,4,1),z()(),N(15,kN,16,11,`div`,48),z()}if(e&2){let e,n=t.$implicit,r=K(2);j(),q(`selected`,r.selectedId()===n.id),M(`aria-expanded`,r.selectedId()===n.id)(`aria-controls`,`signal-detail-`+n.id)(`data-card`,n.id),j(2),C_(`background`,r.kindColor(n.kind)),j(),Y(n.kind),j(2),Y(n.label??`(unnamed)`),j(),P((e=r.changeCount(n.id))?7:-1,e),j(2),P(n.value===void 0?-1:9),j(3),X(`Epoch: `,n.epoch),j(),P(r.getDependencies(n).length?13:-1),j(),P(r.getConsumers(n).length?14:-1),j(),P(r.selectedId()===n.id&&r.selectedNode()?15:-1)}}function jN(e,t){if(e&1){let e=W();R(0,`button`,34),G(`click`,function(){return O(e),k(K(3).clearFilters())}),J(1,`Clear filters`),z()}}function MN(e,t){if(e&1&&(R(0,`li`,57)(1,`p`,22),J(2),z(),R(3,`p`,23),J(4),z(),N(5,jN,2,0,`button`,59),z()),e&2){let e=K(2);j(2),X(` `,e.visibleNodes().length?`No signals match.`:`No signals in this graph.`,` `),j(2),X(` `,e.visibleNodes().length?`Try a different name or kind.`:`Select a component that reads signals, or interact with the page to create some.`,` `),j(),P(e.visibleNodes().length?5:-1)}}function NN(e,t){if(e&1&&(R(0,`h2`,41),J(1,`Signals`),z(),R(2,`ul`,56),F(3,AN,16,15,`li`,null,FM,!1,MN,6,3,`li`,57),z()),e&2){let e=K();j(3),I(e.filteredNodes())}}var PN=`follow`,FN=`env:`,IN=50,LN={selected:`picked`,routed:`rendered by the router`,root:`first component with signals`},RN={write:`set`,sample:`sampled`,initial:`initial`},zN={resolved:`ok`,local:`ok`,loading:`warn`,reloading:`warn`,error:`danger`},BN={signal:`#facc15`,computed:`#60a5fa`,linkedSignal:`#34d399`,effect:`#fb923c`,template:`#94a3b8`,afterRenderEffectPhase:`#f472b6`,childSignalProp:`#fef08a`,"input (signal)":`#f59e0b`,"input.required (signal)":`#f59e0b`,"output (signal)":`#ec4899`,"model (signal)":`#14b8a6`,"model.required (signal)":`#14b8a6`,"viewChild (signal)":`#a3e635`,"viewChild.required (signal)":`#a3e635`,"viewChildren (signal)":`#a3e635`,"contentChild (signal)":`#fda4af`,"contentChild.required (signal)":`#fda4af`,"contentChildren (signal)":`#fda4af`,resource:`#06b6d4`,unknown:`var(--text-2)`},VN=class e{rpc=$(null);destroyRef=E(ws);host=E(Nl);injector=E(Ss);pageId=ZT();cleanups=[];treePages=A({});picked=A(null);graph=A(null);unsupported=A(!1);showInternals=A(!1);sourceSignals=A([]);sourceLoaded=A(!1);filter=A(``);kind=A(null);resources=Q(()=>this.graph()?.resources??[]);internalIds=Q(()=>new Set(this.resources().flatMap(e=>e.nodeIds)));visibleNodes=Q(()=>{let e=this.internalIds();return(this.graph()?.nodes??[]).filter(t=>!e.has(t.id))});kindCounts=Q(()=>{let e=this.graph()?[...this.visibleNodes().map(e=>e.kind),...this.resources().map(()=>`resource`)]:this.sourceSignals().map(e=>e.kind),t=new Map;for(let n of e)t.set(n,(t.get(n)??0)+1);return[...t].map(([e,t])=>({kind:e,count:t}))});kindTotal=Q(()=>this.kindCounts().reduce((e,t)=>e+t.count,0));selectedId=A(null);selectedNode=Q(()=>this.graph()?.nodes.find(e=>e.id===this.selectedId())??null);jumpedPast=A(null);jumpNote=Q(()=>{let e=this.jumpedPast();return!e||this.filter()||this.kind()||this.selectedId()!==e.id?``:`Cleared the filters to show ${e.label}.`});selectedHistory=Q(()=>{let e=this.selectedId();return e?[...this.graph()?.history?.[e]??[]].reverse():[]});kindLegend=Object.entries(BN).map(([e,t])=>({kind:e,color:t}));filteredResources=Q(()=>{let e=this.filter().toLowerCase(),t=this.kind();return t&&t!==`resource`?[]:this.resources().filter(t=>!e||t.name.toLowerCase().includes(e)||`resource`.includes(e))});filteredNodes=Q(()=>{let e=this.filter().toLowerCase(),t=this.kind();return this.visibleNodes().filter(n=>(!t||n.kind===t)&&(!e||(n.label??``).toLowerCase().includes(e)||n.kind.toLowerCase().includes(e))).sort((e,t)=>e.id.localeCompare(t.id,void 0,{numeric:!0}))});filteredSourceSignals=Q(()=>{let e=this.filter().toLowerCase(),t=this.kind();return this.sourceSignals().filter(n=>(!t||n.kind===t)&&(!e||n.name.toLowerCase().includes(e)||n.kind.toLowerCase().includes(e)||n.file.toLowerCase().includes(e)))});targetPageId=Q(()=>this.pageId??this.graph()?.pageId??this.latestTreePage()?.pageId??null);latestTreePage=Q(()=>{let e=null;for(let[t,n]of Object.entries(this.treePages())){let r=n.reportedAt??0;(!e||r>e.reportedAt)&&(e={pageId:t,reportedAt:r})}return e});componentOptions=Q(()=>{let e=this.targetPageId(),t=(e?this.treePages()[e]?.roots:void 0)??[],n=[],r=e=>{for(let t of e)n.push(t),r(t.children)};r(t);let i=this.graph()?.environments??[];if(!n.length&&!i.length)return[];let a=new Map;for(let e of n)a.set(e.name,(a.get(e.name)??0)+1);let o=new Map,s=[{value:PN,label:`Follow the routed component`,hint:`automatic`},...i.map(e=>({value:FN+e.id,label:this.injectorLabel(e),hint:`injector`}))];for(let e of n){let t=(o.get(e.name)??0)+1;o.set(e.name,t),s.push({value:e.id,label:(a.get(e.name)??0)>1?`${e.name} #${t}`:e.name,hint:`<${e.tag}>`})}return s});pickerValue=Q(()=>{let e=this.picked();return e&&this.componentOptions().some(t=>t.value===e)?e:PN});constructor(){dc(()=>{let e=this.rpc();e&&(this.loadSignalGraph(e),this.loadSourceSignals(e))}),this.destroyRef.onDestroy(()=>{for(let e of this.cleanups.splice(0))e()})}async loadSignalGraph(e){for(let e of this.cleanups.splice(0))e();let t=e.scope(`ng-devtools`);try{let e=await t.rpc.sharedState(`signal-graph`);if(this.destroyRef.destroyed)return;let n=e=>{let t=e,n=(this.pageId?t?.pages?.[this.pageId]:t?.graph)??null;this.unsupported.set(!!n?.unsupported);let r=n?.unsupported?null:n,i=e=>e?.component?.id??e?.injector?.id;i(r)!==i(this.graph())&&this.selectedId.set(null),this.graph.set(r)};n(e.value()),this.cleanups.push(e.on(`updated`,n))}catch{this.graph.set(null)}try{let e=await t.rpc.sharedState(`component-tree`);if(this.destroyRef.destroyed)return;let n=e=>{let t=e?.pages;this.treePages.set(t&&typeof t==`object`?t:{})};n(e.value()),this.cleanups.push(e.on(`updated`,n))}catch{this.treePages.set({})}}pickComponent(e){let t=e&&e!==PN?e:null;this.picked.set(t);let n=this.rpc();if(!n)return;let r=this.targetPageId()??void 0,i=t?.startsWith(FN)?{pageId:r,env:t.slice(4)}:{pageId:r,id:t};n.scope(`ng-devtools`).rpc.call(`select-signal-target`,i).catch(()=>{})}injectorLabel(e){return e.name===`Root`?`Root services`:e.name}sourceNote(e){return LN[e]}async loadSourceSignals(e){let t=e.scope(`ng-devtools`);try{let e=await t.rpc.call(`get-signals`);this.sourceSignals.set(e)}catch{}finally{this.sourceLoaded.set(!0)}}clearFilters(){this.filter.set(``),this.kind.set(null)}select(e){this.selectedId.set(this.selectedId()===e?null:e),this.showInternals.set(!1)}jumpTo(e){let t=this.resources().find(t=>t.nodeIds.includes(e.id)),n=t?.id??e.id,r=t?!this.filteredResources().some(e=>e.id===n):!this.filteredNodes().some(e=>e.id===n);r&&this.clearFilters(),this.jumpedPast.set(r?{id:n,label:t?.name??e.label??e.id}:null),this.selectedId.set(n),this.showInternals.set(!!t),Ld(()=>{let e=[...this.host.nativeElement.querySelectorAll(`.node-card[data-card]`)].find(e=>e.dataset.card===n);e?.scrollIntoView?.({block:`nearest`}),e?.focus({preventScroll:!0})},{injector:this.injector})}changeCount(e){let t=this.graph(),n=t?.nodes.find(t=>t.id===e)?.changes??t?.resources?.find(t=>t.id===e)?.changes;return n===void 0?(t?.history?.[e]??[]).reduce((e,t)=>e+(t.source===`initial`?0:1+(t.missed??0)),0):n}historySummary(e){let t=this.changeCount(e),n=this.graph()?.history?.[e]?.length??0;return t?`${`${t} ${t===1?`change`:`changes`} recorded`}${n>=IN&&t>=n?`, showing the last ${n}`:``}, newest first.`:`No changes recorded yet. The entry below is the value seen first.`}statusTone(e){return zN[e]??`neutral`}internalsOf(e){let t=new Set(e.nodeIds);return(this.graph()?.nodes??[]).filter(e=>t.has(e.id))}sourceLabel(e){return RN[e]}kindColor(e){return BN[e]??BN.unknown}getDependencies(e){let t=this.graph();if(!t)return[];let n=t.nodes.findIndex(t=>t.id===e.id);return t.edges.filter(e=>e.consumer===n).map(e=>t.nodes[e.producer]).filter(Boolean)}getConsumers(e){let t=this.graph();if(!t)return[];let n=t.nodes.findIndex(t=>t.id===e.id);return t.edges.filter(e=>e.producer===n).map(e=>t.nodes[e.consumer]).filter(Boolean)}static ɵfac=function(t){return new(t||e)};static ɵcmp=Vh({type:e,selectors:[[`app-signal-inspector`]],inputs:{rpc:[1,`rpc`]},decls:23,vars:15,consts:[[`historyTpl`,``],[1,`toolbar`],[`type`,`text`,`placeholder`,`Filter by name or kind…`,`aria-label`,`Filter signals by name or kind`,3,`input`,`value`],[1,`picker`],[1,`showing`],[`role`,`status`,1,`fallback`],[1,`intro`],[`role`,`group`,`aria-label`,`Filter by kind`,1,`kinds`],[`role`,`status`,1,`empty`],[1,`empty`],[`role`,`status`,1,`jump-note`],[`id`,`signals-component-label`,1,`label-key`],[`labelledBy`,`signals-component-label`,3,`valueChange`,`options`,`value`],[1,`showing-name`],[1,`mono`],[1,`source-note`],[`type`,`button`,1,`kind-chip`,3,`click`],[1,`count`],[`type`,`button`,1,`kind-chip`,3,`active`],[`aria-hidden`,`true`,1,`dot`],[1,`chip-text`],[`aria-hidden`,`true`,1,`spinner`],[1,`empty-title`],[1,`hint`],[1,`source-label`],[1,`nodes`],[1,`node-card`],[`role`,`status`,1,`empty`,`compact`],[1,`node-header`],[1,`kind-badge`],[1,`node-label`],[1,`node-meta`],[1,`file`,3,`title`],[`aria-hidden`,`true`,1,`sep`],[`type`,`button`,1,`reset`,3,`click`],[3,`id`],[1,`history-summary`],[`tabindex`,`0`,1,`history`,`scroll-box`],[1,`history-meta`],[1,`source-tag`],[1,`missed`],[1,`list-heading`],[`role`,`list`,1,`nodes`,`resources`],[`type`,`button`,1,`node-card`,3,`click`],[1,`status-tag`,3,`class`],[1,`changed-badge`],[`aria-hidden`,`true`,1,`chevron`],[1,`node-value`],[1,`detail-panel`,3,`id`],[1,`status-tag`],[1,`detail-title`],[3,`ngTemplateOutlet`,`ngTemplateOutletContext`],[`type`,`button`,1,`reset`,`internals-toggle`,3,`click`],[`role`,`region`,`tabindex`,`0`,1,`scroll-box`],[1,`kind-badge`,`sm`],[1,`rel-label`],[`role`,`list`,1,`nodes`],[1,`empty`,`compact`],[`type`,`button`,1,`rel-link`,3,`click`],[`type`,`button`,1,`reset`]],template:function(e,t){if(e&1&&(R(0,`div`,1)(1,`input`,2),G(`input`,function(e){return t.filter.set(e.target.value)}),z(),N(2,IM,4,2,`div`,3),z(),N(3,RM,6,3,`p`,4)(4,zM,5,1,`p`,4),N(5,BM,2,0,`p`,5),R(6,`p`,6),N(7,VM,1,0)(8,HM,1,0)(9,UM,1,0),z(),N(10,WM,2,0,`p`,5),N(11,GM,2,0,`p`,5),N(12,KM,2,2,`p`,5),N(13,JM,7,4,`div`,7),N(14,YM,4,0,`div`,8),N(15,XM,14,0,`div`,9),N(16,eN,6,1),ng(17,iN,1,1,`ng-template`,null,0,gv),R(19,`p`,10),J(20),z(),N(21,yN,5,0),N(22,NN,6,1)),e&2){let e,n;j(),L(`value`,t.filter()),j(),P(t.componentOptions().length?2:-1),j(),P((e=t.graph()?.component)?3:(e=t.graph()?.injector)?4:-1,e),j(2),P(t.graph()&&t.picked()&&t.graph().source!==`selected`?5:-1),j(2),P(t.graph()?.injector?7:t.graph()?8:9),j(3),P(t.unsupported()?10:-1),j(),P(t.graph()?.writeHook===!1?11:-1),j(),P((n=t.graph()?.nodeCount)?12:-1,n),j(),P(t.kindCounts().length?13:-1),j(),P(!t.graph()&&!t.sourceLoaded()?14:-1),j(),P(!t.graph()&&t.sourceLoaded()&&t.sourceSignals().length===0?15:-1),j(),P(!t.graph()&&t.sourceSignals().length>0?16:-1),j(4),Y(t.jumpNote()),j(),P(t.graph()&&t.filteredResources().length?21:-1),j(),P(t.graph()&&(t.visibleNodes().length||!t.filteredResources().length)?22:-1)}},dependencies:[$y,oD,ib,ab],styles:[`[_nghost-%COMP%] {
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
  color: var(--%NS%bg);
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
}`]})},HN=(e,t)=>t.node.injector.id,UN=(e,t)=>t.id,WN=(e,t)=>t.from+t.token+e,GN=(e,t)=>t.token+e,KN=(e,t)=>t.type,qN=(e,t)=>t.token+t.file+t.line;function JN(e,t){if(e&1){let e=W();V(0,`label`,12)(1,`input`,13),Qg(`change`,function(){O(e);let t=K(2);return k(t.componentsOnly.set(!t.componentsOnly()))}),H(),J(2,` Components only `),H()}if(e&2){let e=K(2);j(),Vg(`checked`,e.componentsOnly())}}function YN(e,t){e&1&&(V(0,`p`,14),ps(),V(1,`svg`,21),U(2,`circle`,22)(3,`path`,23),H(),ms(),V(4,`span`)(5,`strong`),J(6,`This page has more than 2000 element injectors.`),H(),J(7,` Only the first 2000 are shown, so a lookup path or a provider can point to one that is not listed. `),H()())}function XN(e,t){if(e&1){let e=W();V(0,`button`,26),Qg(`click`,function(){let t=O(e).$implicit;return k(K(3).reveal(t.id))}),U(1,`span`,27),V(2,`span`,28),J(3),H(),V(4,`span`,29),J(5),H()()}if(e&2){let e=t.$implicit,n=K(3);j(),C_(`background`,n.tone(e.kind)),j(2),Y(e.label),j(2),Y(e.tokens)}}function ZN(e,t){if(e&1&&(V(0,`div`,15)(1,`span`,24),J(2,`Provided by`),H(),F(3,XN,6,4,`button`,25,UN),H()),e&2){let e=K(2);j(3),I(e.providedBy())}}function QN(e,t){if(e&1){let e=W();V(0,`div`,16),J(1),V(2,`button`,30),Qg(`click`,function(){return O(e),k(K(2).query.set(``))}),J(3,`Clear search`),H()()}if(e&2){let e=K(2);j(),X(` Nothing here matches “`,e.query().trim(),`”. `)}}function $N(e,t){e&1&&J(0,` None of them provide anything themselves. `)}function eP(e,t){e&1&&J(0,` Turn off “Components only” to see directives. `)}function tP(e,t){e&1&&J(0,` Try a different search. `)}function nP(e,t){if(e&1&&(V(0,`div`,1)(1,`p`,31),J(2,`No injectors to show`),H(),V(3,`p`,32),N(4,$N,1,0)(5,eP,1,0)(6,tP,1,0),H()()),e&2){let e=K(2);j(4),P(e.onlyProviding()?4:e.componentsOnly()&&e.view()===`element`?5:6)}}function rP(e,t){if(e&1){let e=W();V(0,`span`,43),Qg(`click`,function(t){O(e);let n=K().$implicit;return k(K(2).toggle(n.node.injector.id,t))}),ps(),V(1,`svg`,44),U(2,`path`,45),H()()}if(e&2){let e=K().$implicit;q(`open`,e.expanded)}}function iP(e,t){e&1&&U(0,`span`,35)}function aP(e,t){if(e&1&&(V(0,`span`,39),J(1),H()),e&2){let e=K().$implicit;j(),Y(e.node.injector.component)}}function oP(e,t){if(e&1&&(V(0,`span`,39),J(1),H()),e&2){let e=K().$implicit;j(),Y(e.node.injector.directives.join(`, `))}}function sP(e,t){if(e&1&&(V(0,`span`,41),ps(),V(1,`svg`,21),U(2,`path`,46),H(),ms(),V(3,`span`,37),J(4,`injects`),H(),J(5),H()),e&2){let e=K().$implicit;M(`title`,e.node.dependencies.length+` injected`),j(5),X(` `,e.node.dependencies.length,` `)}}function cP(e,t){if(e&1&&(V(0,`span`,42),ps(),V(1,`svg`,21),U(2,`path`,47),H(),ms(),V(3,`span`,37),J(4,`provides`),H(),J(5),H()),e&2){let e=K().$implicit;M(`title`,e.node.injector.providerCount+` provided`),j(5),X(` `,e.node.injector.providerCount,` `)}}function lP(e,t){if(e&1){let e=W();V(0,`div`,33),Qg(`click`,function(){let t=O(e).$implicit;return k(K(2).select(t.node.injector.id))})(`focus`,function(){let t=O(e).$implicit,n=K(2);return n.focusId.set(t.node.injector.id),k(n.highlight(t.node))})(`blur`,function(){return O(e),k(K(2).highlight(null))})(`mouseenter`,function(){let t=O(e).$implicit;return k(K(2).highlight(t.node))})(`mouseleave`,function(){return O(e),k(K(2).highlight(null))}),N(1,rP,3,2,`span`,34)(2,iP,1,0,`span`,35),V(3,`span`,36),J(4),H(),V(5,`span`,37),J(6),H(),V(7,`span`,38),J(8),H(),N(9,aP,2,1,`span`,39)(10,oP,2,1,`span`,39),V(11,`span`,40),N(12,sP,6,2,`span`,41),N(13,cP,6,2,`span`,42),H()()}if(e&2){let e=t.$implicit,n=K(2);C_(`--%NS%depth`,e.depth),q(`selected`,n.selected()?.injector?.id===e.node.injector.id),M(`aria-level`,e.depth+1)(`aria-expanded`,e.hasChildren?e.expanded:null)(`aria-selected`,n.selected()?.injector?.id===e.node.injector.id)(`tabindex`,n.rovingId()===e.node.injector.id?0:-1)(`data-id`,e.node.injector.id),j(),P(e.hasChildren?1:2),j(2),C_(`--%NS%tone`,n.tone(n.kind(e.node))),M(`title`,n.kind(e.node)),j(),Y(n.kind(e.node)[0].toUpperCase()),j(2),Y(n.kind(e.node)),j(2),Y(n.label(e.node)),j(),P(e.node.injector.component?9:e.node.injector.directives?.length?10:-1),j(3),P((e.node.dependencies?.length??0)>0?12:-1),j(),P(e.node.injector.providerCount>0?13:-1)}}function uP(e,t){if(e&1&&(V(0,`li`),J(1),H()),e&2){let e=t.$implicit;q(`is-component`,e===K(2).injector.component),j(),Y(e)}}function dP(e,t){if(e&1&&(V(0,`ul`,51),F(1,uP,2,3,`li`,58,Tg),H()),e&2){let e=K();j(),I(e.injector.directives)}}function fP(e,t){if(e&1&&(V(0,`span`,59),U(1,`span`,27),J(2,` Null injector `),V(3,`span`,61),J(4,`throws NullInjectorError`),H()()),e&2){let e=K(4);j(),C_(`background`,e.tone(`null`))}}function pP(e,t){if(e&1&&(V(0,`span`,63),J(1),V(2,`span`,37),J(3),H()()),e&2){let e=K(2).$implicit;j(),X(` `,e.providers,` `),j(2),Y(e.providers===1?`provider`:`providers`)}}function mP(e,t){if(e&1){let e=W();V(0,`button`,62),Qg(`click`,function(){O(e);let t=K().$implicit;return k(K(3).reveal(t.id))}),U(1,`span`,27),V(2,`span`,28),J(3),H(),N(4,pP,4,2,`span`,63),H()}if(e&2){let e=K().$implicit,t=K(3);j(),C_(`background`,t.tone(e.kind)),j(2),Y(e.label),j(),P(e.providers?4:-1)}}function hP(e,t){if(e&1&&(V(0,`li`),N(1,fP,5,2,`span`,59)(2,mP,5,4,`button`,60),H()),e&2){let e=t.$implicit,n=t.$index,r=K(3);q(`current`,n===0),j(),P(e.id===r.nullId?1:2)}}function gP(e,t){e&1&&(V(0,`p`,53),J(1,`Only services this injector has already created are listed.`),H())}function _P(e,t){if(e&1&&(V(0,`span`,69),J(1),H()),e&2){let e=t.$implicit;j(),Y(e)}}function vP(e,t){if(e&1&&(V(0,`span`),J(1),H()),e&2){let e=K().$implicit;j(),X(`for `,e.from)}}function yP(e,t){if(e&1){let e=W();V(0,`button`,74),Qg(`click`,function(){let t=O(e);return k(K(6).reveal(t))}),U(1,`span`,27),J(2,` from `),V(3,`span`,28),J(4),H()()}if(e&2){let e=t,n=K(6);j(),C_(`background`,n.tone(n.kindById(e))),j(3),Y(n.labelById(e))}}function bP(e,t){e&1&&(V(0,`span`,72),J(1,`optional, not provided`),H())}function xP(e,t){e&1&&(V(0,`span`,73),J(1,`not provided anywhere`),H())}function SP(e,t){if(e&1&&(V(0,`li`,66)(1,`div`,67)(2,`span`,68),J(3),H(),F(4,_P,2,1,`span`,69,Tg),H(),V(6,`div`,70),N(7,vP,2,1,`span`),N(8,yP,5,3,`button`,71)(9,bP,2,0,`span`,72)(10,xP,2,0,`span`,73),H()()),e&2){let e,n=t.$implicit,r=K(3);q(`hit`,K(2).matches(n.token)),j(3),Y(n.token),j(),I(n.flags),j(3),P(r.injector.type!==`element`||r.injector.directives&&r.injector.directives.length>1?7:-1),j(),P((e=n.providedBy)?8:n.flags.includes(`optional`)?9:10,e)}}function CP(e,t){if(e&1&&(V(0,`ul`,64),F(1,SP,11,5,`li`,65,WN),H()),e&2){let e=K(2);j(),I(e.dependencies)}}function wP(e,t){e&1&&(V(0,`p`,57),J(1,`Nothing is injected through the constructor or inject().`),H())}function TP(e,t){e&1&&(V(0,`p`,57),J(1,`No service created here has injected anything yet.`),H())}function EP(e,t){if(e&1&&(V(0,`div`,52)(1,`h3`),J(2),V(3,`span`,6),J(4),H()(),N(5,gP,2,0,`p`,53),N(6,CP,3,0,`ul`,64)(7,wP,2,0,`p`,57)(8,TP,2,0,`p`,57),H()),e&2){let e=K();j(2),X(` `,e.injector.type===`element`?`Injected here`:`Injected by its services`,` `),j(2),Y(e.dependencies?.length??0),j(),P(e.injector.type===`element`?-1:5),j(),P(e.dependencies?.length?6:e.injector.type===`element`?7:8)}}function DP(e,t){e&1&&(V(0,`span`,69),J(1,`viewProviders`),H())}function OP(e,t){e&1&&(V(0,`span`,69),J(1,`multi`),H())}function kP(e,t){if(e&1&&(V(0,`div`,70),J(1),H()),e&2){let e=K().$implicit;j(),X(`via `,e.importPath.join(` › `))}}function AP(e,t){if(e&1&&(V(0,`li`,76)(1,`div`,67)(2,`span`,68),J(3),H(),V(4,`span`,77),J(5),H(),N(6,DP,2,0,`span`,69),N(7,OP,2,0,`span`,69),H(),N(8,kP,2,1,`div`,70),H()),e&2){let e=t.$implicit,n=K(4);q(`hit`,n.matches(e.token)),j(3),Y(e.token),j(2),Y(e.type===`unknown`?`provider`:`use`+n.capital(e.type)),j(),P(e.isViewProvider?6:-1),j(),P(e.multi?7:-1),j(),P(e.importPath?.length?8:-1)}}function jP(e,t){if(e&1&&(V(0,`ul`,56),F(1,AP,9,7,`li`,75,GN),H()),e&2){let e=K();j(),I(e.providers)}}function MP(e,t){e&1&&J(0,` No providers or viewProviders on this element. `)}function NP(e,t){e&1&&J(0,` This injector has no providers of its own. `)}function PP(e,t){if(e&1&&(V(0,`p`,57),N(1,MP,1,0)(2,NP,1,0),H()),e&2){let e=K();j(),P(e.injector.type===`element`?1:2)}}function FP(e,t){if(e&1&&(V(0,`section`,20)(1,`header`,48)(2,`span`,49),J(3),H(),V(4,`h2`,50),J(5),H(),N(6,dP,3,0,`ul`,51),H(),V(7,`div`,52)(8,`h3`),J(9,`Lookup path`),H(),V(10,`p`,53),J(11,`Angular asks these injectors in order until one has the token.`),H(),V(12,`ol`,54),F(13,hP,3,3,`li`,55,UN),H()(),N(15,EP,9,4,`div`,52),V(16,`div`,52)(17,`h3`),J(18,` Provides `),V(19,`span`,6),J(20),H()(),N(21,jP,3,0,`ul`,56)(22,PP,3,1,`p`,57),H()()),e&2){let e=t,n=K(2);j(2),C_(`--%NS%tone`,n.tone(n.kind(e))),j(),Y(n.kind(e)),j(2),Y(n.label(e)),j(),P(e.injector.directives?.length?6:-1),j(7),I(n.path()),j(2),P(e.injector.type===`element`||e.dependencies?15:-1),j(5),Y(e.providers.length),j(),P(e.providers.length?21:22)}}function IP(e,t){if(e&1){let e=W();V(0,`p`,2),J(1,` Every component and directive gets an injector. When it asks for a token, Angular walks up this tree, then through the environment injectors, until something provides it. `),H(),V(2,`div`,3)(3,`div`,4)(4,`button`,5),Qg(`click`,function(){return O(e),k(K().setView(`element`))}),J(5,` Elements `),V(6,`span`,6),J(7),H()(),V(8,`button`,5),Qg(`click`,function(){return O(e),k(K().setView(`environment`))}),J(9,` Environment `),V(10,`span`,6),J(11),H()()(),V(12,`div`,7),ps(),V(13,`svg`,8),U(14,`circle`,9)(15,`path`,10),H(),ms(),V(16,`input`,11),Qg(`input`,function(t){return O(e),k(K().query.set(t.target.value))})(`keydown.escape`,function(){return O(e),k(K().query.set(``))}),H()(),N(17,JN,3,1,`label`,12),V(18,`label`,12)(19,`input`,13),Qg(`change`,function(){O(e);let t=K();return k(t.onlyProviding.set(!t.onlyProviding()))}),H(),J(20,` With providers `),H()(),N(21,YN,8,0,`p`,14),N(22,ZN,5,0,`div`,15)(23,QN,4,1,`div`,16),V(24,`div`,17),N(25,nP,7,1,`div`,1),V(26,`div`,18),Qg(`keydown`,function(t){return O(e),k(K().onTreeKey(t))}),F(27,lP,14,19,`div`,19,HN),H(),N(29,FP,23,8,`section`,20),H()}if(e&2){let e,t=K();j(4),q(`active`,t.view()===`element`),M(`aria-pressed`,t.view()===`element`),j(3),Y(t.elementCount()),j(),q(`active`,t.view()===`environment`),M(`aria-pressed`,t.view()===`environment`),j(3),Y(t.environmentCount()),j(5),Vg(`value`,t.query()),j(),P(t.view()===`element`?17:-1),j(2),Vg(`checked`,t.onlyProviding()),j(2),P(t.truncated()?21:-1),j(),P(t.providedBy().length?22:t.query().trim()&&!t.rows().length?23:-1),j(3),P(t.rows().length?-1:25),j(),Vg(`hidden`,!t.rows().length),M(`aria-label`,t.view()===`element`?`Element injectors`:`Environment injectors`),j(),I(t.rows()),j(2),P((e=t.selected())?29:-1,e)}}function LP(e,t){e&1&&(V(0,`div`,0),U(1,`span`,78),V(2,`p`,31),J(3,`Loading dependency injection data…`),H()())}function RP(e,t){e&1&&(V(0,`div`,1)(1,`p`,31),J(2,`No DI data found`),H(),V(3,`p`,32),J(4,` Open the app in a browser with the devtools connected to see its live injectors. No providers, injectables or inject() calls were found in the source either. `),H()())}function zP(e,t){if(e&1){let e=W();V(0,`div`,1)(1,`p`,31),J(2),H(),V(3,`p`,32),J(4,`Try part of a token name or a file path.`),H(),V(5,`button`,5),Qg(`click`,function(){return O(e),k(K(2).query.set(``))}),J(6,`Clear filter`),H()()}if(e&2){let e=K(2);j(2),X(`No providers match “`,e.query(),`”`)}}function BP(e,t){if(e&1&&(V(0,`span`,88),J(1),H()),e&2){let e=K().$implicit;j(),X(`providedIn: `,e.providedIn)}}function VP(e,t){if(e&1&&(V(0,`span`,90),J(1),H()),e&2){let e=K().$implicit;j(),X(`as `,e.source)}}function HP(e,t){if(e&1&&(V(0,`li`,85)(1,`div`,86)(2,`span`,87),J(3),H(),N(4,BP,2,1,`span`,88),H(),V(5,`div`,89)(6,`span`,54),J(7),H(),N(8,VP,2,1,`span`,90),H()()),e&2){let e=t.$implicit;j(3),Y(e.token),j(),P(e.providedIn?4:-1),j(3),Z(``,e.file,`:`,e.line),j(),P(e.source!==`class`&&e.source!==`providers array`?8:-1)}}function UP(e,t){if(e&1&&(V(0,`section`,82)(1,`h2`),J(2),V(3,`span`,83),J(4),H()(),V(5,`ul`,84),F(6,HP,9,5,`li`,85,qN),H()()),e&2){let e=t.$implicit;j(2),X(` `,e.label,` `),j(2),Y(e.items.length),j(2),I(e.items)}}function WP(e,t){if(e&1&&(V(0,`div`,81),F(1,UP,8,2,`section`,82,KN),H()),e&2){let e=K(2);j(),I(e.groupedProviders())}}function GP(e,t){if(e&1){let e=W();V(0,`div`,3)(1,`div`,7),ps(),V(2,`svg`,8),U(3,`circle`,9)(4,`path`,10),H(),ms(),V(5,`input`,79),Qg(`input`,function(t){return O(e),k(K().query.set(t.target.value))})(`keydown.escape`,function(){return O(e),k(K().query.set(``))}),H()(),V(6,`span`,80),J(7),H()(),V(8,`p`,14),ps(),V(9,`svg`,21),U(10,`circle`,22)(11,`path`,23),H(),ms(),V(12,`span`)(13,`strong`),J(14,`DI from source scan (static analysis).`),H(),J(15,` Connect the overlay on Angular 20 or later to see the live injector tree. `),H()(),N(16,zP,7,1,`div`,1)(17,WP,3,0,`div`,81)}if(e&2){let e=K();j(5),Vg(`value`,e.query()),j(2),Z(` `,e.sourceMatchCount(),` of `,e.sourceProviders().length,` `),j(9),P(e.groupedProviders().length===0?16:17)}}var KP=`inj-null`,qP={component:`var(--accent)`,directive:`#7cb4ff`,environment:`var(--ok)`,null:`var(--text-3)`};function JP(e){return e.injector.type===`element`?e.injector.component?`component`:`directive`:`environment`}function YP(e){return e.injector.type===`element`?`<${e.injector.name}>`:e.injector.name}function XP(e){return Array.isArray(e)}var ZP=class e{rpc=$(null);nullId=KP;roots=A([]);environment=A([]);sourceProviders=A([]);loaded=A(!1);truncated=A(!1);view=A(`element`);query=A(``);onlyProviding=A(!1);componentsOnly=A(!0);collapsed=A(new Set);selectedId=A(null);focusId=A(null);index=Q(()=>{let e=new Map,t=new Map,n=(r,i)=>{for(let a of r)e.set(a.injector.id,a),i&&t.set(a.injector.id,i),n(a.children,a.injector.id)};return n(this.roots(),null),n(this.environment(),null),{map:e,parents:t}});elementCount=Q(()=>this.count(this.roots()));environmentCount=Q(()=>this.count(this.environment()));visible=Q(()=>{let e=this.view()===`element`?this.roots():this.environment();this.view()===`element`&&this.componentsOnly()&&(e=this.prune(e,e=>!!e.injector.component)),this.onlyProviding()&&(e=this.prune(e,e=>e.providers.length>0));let t=this.normalizedQuery();return t&&(e=this.prune(e,e=>this.nodeMatches(e,t))),e});rows=Q(()=>{let e=[],t=this.collapsed(),n=!!this.normalizedQuery(),r=(i,a)=>{for(let o of i){let i=n||!t.has(o.injector.id);e.push({node:o,depth:a,hasChildren:o.children.length>0,expanded:i}),i&&r(o.children,a+1)}};return r(this.visible(),0),e});selected=Q(()=>{let e=this.selectedId();return(e?this.index().map.get(e):void 0)??this.rows()[0]?.node??null});rovingId=Q(()=>{let e=this.rows(),t=this.focusId()??this.selected()?.injector.id;return t&&e.some(e=>e.node.injector.id===t)?t:e[0]?.node.injector.id??null});path=Q(()=>{let e=this.selected();if(!e)return[];let{map:t,parents:n}=this.index(),r=e.injector.path??[];if(!r.length){r=[e.injector.id];let t=n.get(e.injector.id);for(;t;)r.push(t),t=n.get(t);r.push(KP)}return r.map(e=>{let n=t.get(e);return{id:e,label:n?YP(n):e===KP?`Null injector`:`Not listed`,kind:n?JP(n):`null`,providers:n?.providers.length??0}})});providedBy=Q(()=>{let e=this.normalizedQuery();if(!e)return[];let t=[];for(let n of this.index().map.values()){let r=n.providers.filter(t=>t.token.toLowerCase().includes(e));r.length&&t.push({id:n.injector.id,label:YP(n),kind:JP(n),tokens:r.map(e=>e.token).join(`, `)})}return t.slice(0,12)});groupedProviders=Q(()=>{let e=this.normalizedQuery(),t=e?this.sourceProviders().filter(t=>t.token.toLowerCase().includes(e)||t.file.toLowerCase().includes(e)):this.sourceProviders(),n=[{type:`root-provider`,label:`Root Providers (provide*)`,items:[]},{type:`injectable`,label:`Injectable Services`,items:[]},{type:`injection`,label:`inject() Calls`,items:[]},{type:`provider`,label:`Component Providers`,items:[]}];for(let e of t)n.find(t=>t.type===e.type)?.items.push(e);return n.filter(e=>e.items.length>0)});sourceMatchCount=Q(()=>this.groupedProviders().reduce((e,t)=>e+t.items.length,0));normalizedQuery=Q(()=>this.query().trim().toLowerCase());destroyRef=E(ws);stopTree=null;constructor(){dc(()=>{let e=this.rpc();e&&(this.loadInjectorTree(e),this.loadSourceProviders(e))}),this.destroyRef.onDestroy(()=>{this.stopTree?.(),this.highlight(null)})}label(e){return YP(e)}kind(e){return JP(e)}tone(e){return qP[e]??qP.null}kindById(e){let t=this.index().map.get(e);return t?JP(t):`null`}labelById(e){let t=this.index().map.get(e);return t?YP(t):e===KP?`Null injector`:`not listed`}capital(e){return e.charAt(0).toUpperCase()+e.slice(1)}matches(e){let t=this.normalizedQuery();return!!t&&e.toLowerCase().includes(t)}setView(e){this.view()!==e&&(this.view.set(e),this.selectedId.set(null),this.focusId.set(null))}select(e){this.selectedId.set(e),this.focusId.set(e)}toggle(e,t){t?.stopPropagation(),!this.normalizedQuery()&&this.collapsed.update(t=>{let n=new Set(t);return n.has(e)?n.delete(e):n.add(e),n})}reveal(e){let t=this.index().map.get(e);if(!t)return;this.setView(t.injector.type===`element`?`element`:`environment`);let{parents:n}=this.index();this.collapsed.update(t=>{let r=new Set(t),i=n.get(e);for(;i;)r.delete(i),i=n.get(i);return r}),this.onlyProviding()&&t.providers.length===0&&this.onlyProviding.set(!1),t.injector.type===`element`&&!t.injector.component&&this.componentsOnly.set(!1),this.select(e),queueMicrotask(()=>this.focusRow(e,!1))}highlight(e){let t=this.rpc();if(!t)return;let n=e?.injector.type===`element`?e.injector.selector??null:null;t.scope(`ng-devtools`).rpc.call(`request-page-highlight`,n).catch(()=>{})}onTreeKey(e){let t=this.rows();if(!t.length)return;let n=this.rovingId(),r=t.findIndex(e=>e.node.injector.id===n),i=Math.max(r,0),a=t[i],o=-1;switch(e.key){case`ArrowDown`:o=Math.min(i+1,t.length-1);break;case`ArrowUp`:o=Math.max(i-1,0);break;case`Home`:o=0;break;case`End`:o=t.length-1;break;case`ArrowRight`:a.hasChildren&&!a.expanded?this.toggle(a.node.injector.id):a.hasChildren&&(o=i+1);break;case`ArrowLeft`:if(a.hasChildren&&a.expanded&&!this.normalizedQuery())this.toggle(a.node.injector.id);else{let e=this.index().parents.get(a.node.injector.id);o=t.findIndex(t=>t.node.injector.id===e)}break;case`Enter`:case` `:this.select(a.node.injector.id);break;default:return}if(e.preventDefault(),o>=0){let e=t[o].node.injector.id;this.focusId.set(e),this.selectedId.set(e),queueMicrotask(()=>this.focusRow(e,!0))}}focusRow(e,t){let n=document.querySelector(`.row[data-id="${CSS.escape(e)}"]`);n&&(t&&n.focus(),n.scrollIntoView({block:`nearest`}))}async loadInjectorTree(e){this.stopTree?.(),this.stopTree=null;let t=e.scope(`ng-devtools`),n;try{n=await t.rpc.sharedState(`injector-tree`)}catch{return}if(this.destroyRef.destroyed)return;let r=ZT(),i=e=>{let t=e,n=(r?t?.pages?.[r]:void 0)??t;XP(n?.roots)&&this.roots.set(n.roots),XP(n?.environment)&&this.environment.set(n.environment),this.truncated.set(n?.truncated===!0)};i(n.value()),this.stopTree=n.on(`updated`,i)}async loadSourceProviders(e){let t=e.scope(`ng-devtools`);try{this.sourceProviders.set(await t.rpc.call(`get-providers`))}catch{this.sourceProviders.set([])}finally{this.loaded.set(!0)}}count(e){return e.reduce((e,t)=>e+1+this.count(t.children),0)}nodeMatches(e,t){let n=e.injector;return n.name.toLowerCase().includes(t)||!!n.component?.toLowerCase().includes(t)||!!n.directives?.some(e=>e.toLowerCase().includes(t))||e.providers.some(e=>e.token.toLowerCase().includes(t))||!!e.dependencies?.some(e=>e.token.toLowerCase().includes(t))}prune(e,t){let n=[];for(let r of e){let e=this.prune(r.children,t);(t(r)||e.length)&&n.push({...r,children:e})}return n}static ɵfac=function(t){return new(t||e)};static ɵcmp=Vh({type:e,selectors:[[`app-di-inspector`]],inputs:{rpc:[1,`rpc`]},decls:4,vars:1,consts:[[`role`,`status`,1,`state`],[1,`state`],[1,`intro`],[1,`toolbar`],[`role`,`group`,`aria-label`,`Injector tree`,1,`segmented`],[`type`,`button`,3,`click`],[1,`pill`],[1,`search`],[`viewBox`,`0 0 24 24`,`aria-hidden`,`true`,1,`search-icon`],[`cx`,`11`,`cy`,`11`,`r`,`7`],[`d`,`m20 20-3.5-3.5`],[`type`,`search`,`placeholder`,`Find a token, component or injector…`,`aria-label`,`Find a token, component or injector`,`autocomplete`,`off`,`spellcheck`,`false`,3,`input`,`keydown.escape`,`value`],[1,`checkbox`],[`type`,`checkbox`,3,`change`,`checked`],[1,`notice`],[`role`,`status`,1,`where`],[`role`,`status`,1,`where`,`muted`],[1,`layout`],[`role`,`tree`,1,`tree`,3,`keydown`,`hidden`],[`role`,`treeitem`,1,`row`,3,`selected`,`--%NS%depth`],[`aria-labelledby`,`di-detail-title`,1,`detail`],[`viewBox`,`0 0 24 24`,`aria-hidden`,`true`],[`cx`,`12`,`cy`,`12`,`r`,`9`],[`d`,`M12 11v5M12 8h.01`],[1,`where-label`],[`type`,`button`,1,`chip`],[`type`,`button`,1,`chip`,3,`click`],[`aria-hidden`,`true`,1,`dot`],[1,`mono`],[1,`chip-tokens`],[`type`,`button`,1,`link`,3,`click`],[1,`state-title`],[1,`state-hint`],[`role`,`treeitem`,1,`row`,3,`click`,`focus`,`blur`,`mouseenter`,`mouseleave`],[`aria-hidden`,`true`,1,`twisty`,3,`open`],[`aria-hidden`,`true`,1,`twisty-space`],[`aria-hidden`,`true`,1,`kind`],[1,`sr-only`],[1,`name`,`mono`],[1,`sub`],[1,`meta`],[1,`count`],[1,`count`,`provides`],[`aria-hidden`,`true`,1,`twisty`,3,`click`],[`viewBox`,`0 0 24 24`],[`d`,`m9 6 6 6-6 6`],[`d`,`M12 5v14M5 12l7 7 7-7`],[`d`,`M21 8 12 3 3 8v8l9 5 9-5z`],[1,`detail-head`],[1,`badge`],[`id`,`di-detail-title`,1,`mono`],[`aria-label`,`Classes on this element`,1,`classes`],[1,`block`],[1,`hint`],[1,`path`],[3,`current`],[1,`providers`],[1,`empty-line`],[3,`is-component`],[1,`step`,`null`],[`type`,`button`,1,`step`],[1,`hint-inline`],[`type`,`button`,1,`step`,3,`click`],[1,`step-count`],[1,`deps`],[1,`dep`,3,`hit`],[1,`dep`],[1,`dep-main`],[1,`token`,`mono`],[1,`flag`],[1,`dep-meta`],[`type`,`button`,1,`from`],[1,`from`,`absent`],[1,`from`,`missing`],[`type`,`button`,1,`from`,3,`click`],[1,`provider`,3,`hit`],[1,`provider`],[1,`flag`,`kind-flag`],[`aria-hidden`,`true`,1,`spinner`],[`type`,`search`,`placeholder`,`Filter by token or file…`,`aria-label`,`Filter by token or file`,`autocomplete`,`off`,`spellcheck`,`false`,3,`input`,`keydown.escape`,`value`],[`aria-live`,`polite`,1,`total`],[1,`source-providers`],[1,`provider-group`],[1,`section-count`],[`role`,`list`,1,`provider-list`],[1,`provider-card`],[1,`provider-header`],[1,`token`],[1,`provided-in`],[1,`provider-meta`],[1,`as`]],template:function(e,t){e&1&&N(0,IP,30,17)(1,LP,4,0,`div`,0)(2,RP,5,0,`div`,1)(3,GP,18,4),e&2&&P(t.roots().length>0?0:t.loaded()?t.sourceProviders().length===0?2:3:1)},styles:[`[_nghost-%COMP%] {
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
}`]})},QP=`@type`;function $P(e){return!!e&&typeof e==`object`&&!Array.isArray(e)&&QP in e}function eF(e){return/^[A-Za-z_$][\w$]*$/.test(e)?e:JSON.stringify(e)}function tF(e,t=``){if(e===null)return`null`;if(typeof e==`string`)return JSON.stringify(e);if(typeof e!=`object`)return String(e);let n=t+`  `;if(Array.isArray(e))return e.length?`[\n${e.map(e=>n+tF(e,n)).join(`,
`)}\n${t}]`:`[]`;if($P(e)){let r=e;switch(r[QP]){case`undefined`:return`undefined`;case`Date`:return`Date(${r.value})`;case`bigint`:return`${r.value}n`;case`symbol`:return`Symbol(${r.value})`;case`function`:return`ƒ ${r.name}()`;case`Error`:return`${r.name??`Error`}: ${r.message}`;case`Element`:return`<${r.value}>`;case`Map`:{let e=r.entries??[];if(!e.length)return`Map(${r.size}) {}`;let i=e.map(([e,t])=>`${n}${tF(e,n)} => ${tF(t,n)}`);return`Map(${r.size}) {\n${i.join(`,
`)}\n${t}}`}case`Set`:{let e=r.values??[];return e.length?`Set(${r.size}) {\n${e.map(e=>n+tF(e,n)).join(`,
`)}\n${t}}`:`Set(${r.size}) {}`}default:return String(r.value??r[QP])}}let r=Object.entries(e);return r.length?`{\n${r.map(([e,t])=>`${n}${eF(e)}: ${tF(t,n)}`).join(`,
`)}\n${t}}`:`{}`}function nF(e,t=120){let n=tF(e).replace(/\s*\n\s*/g,` `);return n.length>t?`${n.slice(0,t-1)}…`:n}var rF=[`cancelButton`],iF=[`restoreButton`],aF=[`stateTree`],oF=[`latestButton`],sF=(e,t)=>t.id,cF=(e,t)=>t.seq,lF=(e,t)=>t.key,uF=(e,t)=>t.name,dF=(e,t)=>t.path,fF=(e,t)=>t.kind,pF=(e,t)=>t.name+t.file+t.line;function mF(e,t){if(e&1){let e=W();R(0,`span`,20),J(1,`Page`),z(),R(2,`app-select`,21),G(`valueChange`,function(t){return O(e),k(K().selectPage(t))}),z()}if(e&2){let e=K();j(2),L(`options`,e.pageOptions())(`value`,e.page()?.pageId??null)}}function hF(e,t){if(e&1&&(R(0,`span`,11),J(1),z()),e&2){let e=K();j(),Y(e.liveStores().length)}}function gF(e,t){if(e&1){let e=W();R(0,`div`,12)(1,`p`,22),J(2,`Could not load the live store state.`),z(),R(3,`p`,23),J(4,`Check that the dev server with ng-devtools is still running.`),z(),R(5,`button`,24),G(`click`,function(){return O(e),k(K().retry())}),J(6,`Retry`),z()()}}function _F(e,t){e&1&&(R(0,`div`,13)(1,`p`,22),J(2,`No page is reporting NgRx state yet.`),z(),R(3,`p`,23),J(4,` Open the app in a browser. Stores show up here as soon as the page creates them. `),z()())}function vF(e,t){e&1&&(R(0,`p`,22),J(1,`No signal store instance on this page yet.`),z(),R(2,`p`,23),J(3,` A `),R(4,`code`),J(5,`signalStore`),z(),J(6,` is created the first time something injects it. Navigate to a page that uses the store and it appears here. `),z())}function yF(e,t){e&1&&(R(0,`p`,22),J(1,`The @ngrx/store Store was not found on this page.`),z(),R(2,`p`,23),J(3,` Check that `),R(4,`code`),J(5,`provideStore()`),z(),J(6,` or `),R(7,`code`),J(8,`StoreModule.forRoot()`),z(),J(9,` is part of the providers of the running app. `),z())}function bF(e,t){e&1&&(R(0,`p`,22),J(1,`This page has no NgRx store.`),z(),R(2,`p`,23),J(3,` Stores from `),R(4,`code`),J(5,`@ngrx/signals`),z(),J(6,` (`),R(7,`code`),J(8,`signalStore`),z(),J(9,`, `),R(10,`code`),J(11,`signalState`),z(),J(12,`) and `),R(13,`code`),J(14,`@ngrx/store`),z(),J(15,` are listed here once the app creates them. `),z())}function xF(e,t){if(e&1&&(R(0,`div`,13),N(1,vF,7,0)(2,yF,10,0)(3,bF,16,0),z()),e&2){let e=K();j(),P(e.usesSignals()?1:e.usesClassic()?2:3)}}function SF(e,t){if(e&1){let e=W();R(0,`li`)(1,`button`,28),G(`click`,function(){let t=O(e).$implicit;return k(K(2).selectStore(t.id))}),R(2,`span`,29),B(3,`span`,30),R(4,`span`,31),J(5),z()(),R(6,`span`,32),J(7),z()()()}if(e&2){let e=t.$implicit,n=K(2);j(),q(`selected`,e.id===n.store()?.id),M(`aria-pressed`,e.id===n.store()?.id),j(2),C_(`background`,n.kindColor(e.kind)),j(2),Y(e.label),j(2),X_(` `,n.kindLabel(e.kind),` · `,e.scope,` · `,n.changeCount(e.id),` `,n.changeCount(e.id)===1?`change`:`changes`,` `)}}function CF(e,t){e&1&&(R(0,`li`,26),J(1,`No stores match this filter.`),z())}function wF(e,t){if(e&1&&(R(0,`span`,36),J(1),z()),e&2){let e=t;L(`title`,e),j(),Y(e)}}function TF(e,t){if(e&1&&(R(0,`span`,35),J(1),z()),e&2){let e=K();j(),Y(e.classic.devtools?`Store DevTools on`:`Store DevTools off`)}}function EF(e,t){if(e&1&&(R(0,`code`),J(1),z(),J(2)),e&2){let e=t.$implicit,n=t.$index,r=t.$count;j(),Y(e),j(),X(``,n===r-1?``:`, `,` `)}}function DF(e,t){if(e&1&&(R(0,`p`,37),J(1,` Referenced by `),F(2,EF,3,2,null,null,Tg),z()),e&2){let e=K();j(2),I(e.signal.references)}}function OF(e,t){if(e&1&&(R(0,`p`,52),J(1),z()),e&2){let e=K(4);j(),Y(e.restoreOff)}}function kF(e,t){if(e&1){let e=W();R(0,`div`,38)(1,`p`)(2,`strong`),J(3,`Viewing a past state.`),z(),J(4,` New actions are logged but do not change the state until you go back to the latest state. `),z(),R(5,`button`,51,1),G(`click`,function(){return O(e),k(K(3).backToLatest())}),J(7,` Back to latest `),z(),N(8,OF,2,1,`p`,52),z()}if(e&2){let e=K(3);j(5),L(`disabled`,e.busy()||!e.canRestore()),M(`aria-describedby`,e.canRestore()?null:`store-latest-off`),j(3),P(e.canRestore()?-1:8)}}function AF(e,t){if(e&1&&(R(0,`dt`),J(1),z(),R(2,`dd`)(3,`code`,58),J(4),z()()),e&2){let e=t.$implicit;j(),Y(e.key),j(2),L(`title`,e.full),j(),Y(e.value)}}function jF(e,t){if(e&1&&(R(0,`dl`,54),F(1,AF,5,3,null,null,lF),z()),e&2){let e=K(4);j(),I(e.computedEntries())}}function MF(e,t){e&1&&(R(0,`p`,55),J(1,`No computed signals.`),z())}function NF(e,t){e&1&&(R(0,`span`,60),J(1,`rxMethod`),z())}function PF(e,t){if(e&1&&(R(0,`li`,59),J(1),N(2,NF,2,0,`span`,60),R(3,`span`,61),J(4),z()()),e&2){let e=t.$implicit;j(),X(` `,e.name,` `),j(),P(e.rx?2:-1),j(2),Z(``,e.calls,` `,e.calls===1?`call`:`calls`)}}function FF(e,t){if(e&1&&(R(0,`ul`,57),F(1,PF,5,4,`li`,59,uF),z()),e&2){let e=K();j(),I(e.methods)}}function IF(e,t){e&1&&(R(0,`p`,55),J(1,`No methods.`),z())}function LF(e,t){if(e&1&&(R(0,`section`,43)(1,`h4`,53),J(2,`Computed`),z(),N(3,jF,3,0,`dl`,54)(4,MF,2,0,`p`,55),R(5,`h4`,56),J(6,`Methods`),z(),N(7,FF,3,0,`ul`,57)(8,IF,2,0,`p`,55),z()),e&2){let e=K(3);j(3),P(e.computedEntries().length?3:4),j(4),P(t.methods.length?7:8)}}function RF(e,t){if(e&1&&(R(0,`span`,60),J(1),z()),e&2){let e=K().$implicit;j(),Y(e.origin)}}function zF(e,t){if(e&1){let e=W();R(0,`li`)(1,`button`,62),G(`click`,function(){let t=O(e).$implicit;return k(K(3).selectEntry(t.seq))}),R(2,`span`,63),J(3),z(),R(4,`span`,64),J(5),z(),R(6,`span`,65),N(7,RF,2,1,`span`,60),J(8),z()()()}if(e&2){let e=t.$implicit,n=K(3);j(),q(`selected`,e.seq===n.selectedSeq()),M(`aria-pressed`,e.seq===n.selectedSeq()),j(2),X(`#`,e.seq),j(),L(`title`,e.type),j(),Y(e.type),j(2),P(e.origin?7:-1),j(),Z(` `,e.diff.length===0?`no change`:e.diff.length+(e.diff.length===1?` change`:` changes`),` · `,n.formatTime(e.timestamp))}}function BF(e,t){e&1&&J(0,` No entries match this filter. `)}function VF(e,t){e&1&&J(0,` No actions dispatched since the page connected. `)}function HF(e,t){e&1&&J(0,` No state changes yet. Method calls and patchState writes that change the state are recorded here. `)}function UF(e,t){if(e&1&&(R(0,`li`,26),N(1,BF,1,0)(2,VF,1,0)(3,HF,1,0),z()),e&2){let e=K(),t=K(2);j(),P(t.filter()?1:e.classic?2:3)}}function WF(e,t){if(e&1&&(R(0,`dt`),J(1,`Origin`),z(),R(2,`dd`),J(3),z()),e&2){let e=K(),t=K(3);j(3),Y(t.originText(e.origin))}}function GF(e,t){if(e&1&&(R(0,`dt`),J(1,`Action`),z(),R(2,`dd`)(3,`pre`,71),J(4),z()()),e&2){let e=K(),t=K(3);j(4),Y(t.prettyText(e.action))}}function KF(e,t){if(e&1&&(R(0,`dt`),J(1,`Arguments`),z(),R(2,`dd`)(3,`pre`,71),J(4),z()()),e&2){let e=K(),t=K(3);j(4),Y(t.prettyText(e.args))}}function qF(e,t){if(e&1&&(R(0,`code`,76),J(1),z()),e&2){let e=K().$implicit,t=K(5);j(),Y(t.shortText(e.before))}}function JF(e,t){e&1&&(R(0,`span`,78),J(1,`→`),z(),R(2,`span`,79),J(3,`became`),z())}function YF(e,t){if(e&1&&(R(0,`code`,77),J(1),z()),e&2){let e=K().$implicit,t=K(5);j(),Y(t.shortText(e.after))}}function XF(e,t){if(e&1&&(R(0,`li`)(1,`span`,73),J(2),z(),R(3,`code`,74),J(4),z(),R(5,`span`,75),N(6,qF,2,1,`code`,76),N(7,JF,4,0),N(8,YF,2,1,`code`,77),z()()),e&2){let e=t.$implicit,n=K(5);w_(`diff-row `+e.op),j(2),Y(n.opLabel(e.op)),j(2),Y(e.path),j(2),P(e.op===`add`?-1:6),j(),P(e.op===`change`?7:-1),j(),P(e.op===`remove`?-1:8)}}function ZF(e,t){if(e&1&&(R(0,`ul`,68),F(1,XF,9,7,`li`,72,dF),z()),e&2){let e=K();j(),I(e.diff)}}function QF(e,t){e&1&&(R(0,`p`,55),J(1,`The state did not change.`),z())}function $F(e,t){e&1&&J(0),e&2&&X(` Store DevTools jumps the app state to the state right after action #`,K(2).seq,`. Until you go back to the latest state, new actions are logged but do not change the state. `)}function eI(e,t){if(e&1&&J(0),e&2){let e=K(2);Z(` This sets every state key of `,K().label,` back to its value right after change #`,e.seq,`. Components that read the store update at once, and a new "Restore" entry is added to the log. `)}}function tI(e,t){if(e&1){let e=W();R(0,`div`,80),G(`keydown.escape`,function(t){return O(e),k(K(4).cancelRestore(t))}),R(1,`p`,81),N(2,$F,1,1)(3,eI,1,2),z(),R(4,`div`,82)(5,`button`,51),G(`click`,function(){O(e);let t=K();return k(K(3).restore(t.seq,t.source===`store`))}),J(6,` Restore `),z(),R(7,`button`,24,2),G(`click`,function(){return O(e),k(K(4).cancelRestore())}),J(9,` Cancel `),z()()()}if(e&2){let e=K(),t=K(3);j(2),P(e.source===`store`?2:3),j(3),L(`disabled`,t.busy())}}function nI(e,t){if(e&1){let e=W();R(0,`button`,87,3),G(`click`,function(){O(e);let t=K(2);return k(K(3).askRestore(t.seq))}),J(2,` Restore this state `),z()}if(e&2){let e=K(5);L(`disabled`,!e.canRestore()),M(`aria-describedby`,e.canRestore()?null:`store-writes-off`)}}function rI(e,t){if(e&1){let e=W();R(0,`button`,88),G(`click`,function(){O(e);let t=K(2);return k(K(3).dispatchAgain(t.seq))}),J(1,` Dispatch again `),z()}if(e&2){let e=K(5);L(`disabled`,e.busy()||!e.canRestore()),M(`aria-describedby`,e.canRestore()?null:`store-writes-off`)}}function iI(e,t){if(e&1&&(R(0,`p`,86),J(1),z()),e&2){let e=K(5);j(),Y(e.restoreOff)}}function aI(e,t){if(e&1&&(R(0,`div`,83),N(1,nI,3,2,`button`,84),N(2,rI,2,2,`button`,85),z(),N(3,iI,2,1,`p`,86)),e&2){let e=K(),t=K(3);j(),P(e.restorable?1:-1),j(),P(t.canAgain(e)?2:-1),j(),P(t.canRestore()?-1:3)}}function oI(e,t){e&1&&(J(0,` Store DevTools no longer holds this action, so this state cannot be restored. It was dropped past `),R(1,`code`),J(2,`maxAge`),z(),J(3,`, or the Store DevTools history was committed, reset or imported. `))}function sI(e,t){e&1&&(J(0,` Store DevTools never recorded this action, so this state cannot be restored. An `),R(1,`code`),J(2,`actionsBlocklist`),z(),J(3,`, `),R(4,`code`),J(5,`actionsSafelist`),z(),J(6,` or `),R(7,`code`),J(8,`predicate`),z(),J(9,` option filtered it out, or recording was paused. `))}function cI(e,t){e&1&&(J(0,` Time travel for @ngrx/store needs `),R(1,`code`),J(2,`provideStoreDevtools()`),z(),J(3,`. Without it, entries cannot be restored. `))}function lI(e,t){if(e&1&&(R(0,`p`,70),N(1,oI,4,0)(2,sI,10,0)(3,cI,4,0),z()),e&2){let e=K();j(),P(e.unrestorable===`dropped`?1:e.unrestorable===`not-recorded`?2:3)}}function uI(e,t){if(e&1&&(R(0,`section`,49)(1,`h5`,66),J(2),z(),R(3,`dl`,54)(4,`dt`),J(5,`Time`),z(),R(6,`dd`),J(7),z(),N(8,WF,4,1),N(9,GF,5,1),N(10,KF,5,1),z(),R(11,`h6`,67),J(12,`State diff`),z(),N(13,ZF,3,0,`ul`,68)(14,QF,2,0,`p`,55),N(15,tI,10,2,`div`,69),N(16,aI,4,3),N(17,lI,4,1,`p`,70),z()),e&2){let e=t,n=K(3);j(2),Z(`#`,e.seq,` `,e.type),j(5),Y(n.formatTime(e.timestamp)),j(),P(e.origin?8:-1),j(),P(e.action===void 0?-1:9),j(),P(e.args?.length?10:-1),j(3),P(e.diff.length?13:14),j(2),P(e.restorable&&n.confirmSeq()===e.seq?15:-1),j(),P(n.confirmSeq()!==e.seq&&(e.restorable||n.canAgain(e))?16:-1),j(),P(!e.restorable&&e.source===`store`?17:-1)}}function dI(e,t){if(e&1&&B(0,`option`,93),e&2){let e=t.$implicit;L(`value`,e)}}function fI(e,t){if(e&1&&(R(0,`p`,98),J(1),z()),e&2){let e=K(4);j(),Y(e.restoreOff)}}function pI(e,t){if(e&1){let e=W();R(0,`section`,50)(1,`h4`,89),J(2,`Dispatch an action`),z(),R(3,`form`,90),G(`submit`,function(t){return O(e),k(K(3).dispatchAction(t))}),R(4,`label`)(5,`span`),J(6,`Type`),z(),R(7,`input`,91),G(`input`,function(t){return O(e),k(K(3).dispatchType.set(t.target.value))}),z()(),R(8,`datalist`,92),F(9,dI,1,1,`option`,93,Tg),z(),R(11,`label`)(12,`span`),J(13,`Payload `),R(14,`span`,94),J(15,`(JSON object, optional)`),z()(),R(16,`textarea`,95),G(`input`,function(t){return O(e),k(K(3).dispatchPayload.set(t.target.value))}),z()(),R(17,`p`,96),J(18),z(),R(19,`div`,82)(20,`button`,97),J(21,` Dispatch `),z()(),N(22,fI,2,1,`p`,98),z()()}if(e&2){let e=K(3);j(7),L(`value`,e.dispatchType()),j(2),I(e.actionTypes()),j(7),L(`value`,e.dispatchPayload()),M(`aria-invalid`,e.payloadError()?`true`:null),j(2),Y(e.payloadError()),j(2),L(`disabled`,e.busy()||!e.canRestore()||!e.dispatchRequest()),M(`aria-describedby`,e.canRestore()?null:`store-dispatch-off`),j(2),P(e.canRestore()?-1:22)}}function mI(e,t){if(e&1&&(R(0,`div`,27)(1,`div`,33)(2,`h3`),J(3),z(),R(4,`div`,34)(5,`span`,35),J(6),z(),R(7,`span`,35),J(8),z(),N(9,wF,2,2,`span`,36),N(10,TF,2,1,`span`,35),z(),N(11,DF,4,0,`p`,37),z(),N(12,kF,9,3,`div`,38),R(13,`div`,39)(14,`section`,40)(15,`h4`,41),J(16,`State`),z(),R(17,`pre`,42,0),J(19),z()(),N(20,LF,9,2,`section`,43),z(),R(21,`section`,44)(22,`h4`,45),J(23),R(24,`span`,11),J(25),z()(),B(26,`app-limit-note`,46),R(27,`div`,47)(28,`ul`,48),F(29,zF,9,9,`li`,null,cF,!1,UF,4,1,`li`,26),z(),N(32,uI,18,10,`section`,49),z()(),N(33,pI,23,7,`section`,50),z()),e&2){let e,n,r,i=t,a=K(2);j(3),Y(i.label),j(3),Y(a.kindLabel(i.kind)),j(2),X(`scope: `,i.scope),j(),P((e=i.signal?.declaredIn)?9:-1,e),j(),P(i.classic?10:-1),j(),P(i.signal?.references?.length?11:-1),j(),P(i.classic?.paused?12:-1),j(7),Y(a.stateText()),j(),P((n=i.signal)?20:-1,n),j(3),X(` `,i.classic?`Action log`:`Change log`,` `),j(2),Y(a.storeLog().length),j(),L(`dropped`,a.page()?.dropped??0)(`max`,a.maxLog()),j(2),M(`aria-label`,i.classic?`Actions`:`Changes`),j(),I(a.storeLog()),j(3),P((r=a.entry())?32:-1,r),j(),P(i.classic?33:-1)}}function hI(e,t){if(e&1&&(R(0,`div`,14)(1,`ul`,25),F(2,SF,8,10,`li`,null,sF,!1,CF,2,0,`li`,26),z(),N(5,mI,34,17,`div`,27),z()),e&2){let e,t=K();j(2),I(t.filteredStores()),j(3),P((e=t.store())?5:-1,e)}}function gI(e,t){if(e&1&&(R(0,`span`,11),J(1),z()),e&2){let e=K();j(),Y(e.sourceEntries().length)}}function _I(e,t){e&1&&(R(0,`div`,18),B(1,`span`,99),R(2,`p`,22),J(3,`Scanning source for NgRx declarations…`),z()())}function vI(e,t){e&1&&(R(0,`div`,19)(1,`p`,22),J(2,`No NgRx declarations found in source.`),z(),R(3,`p`,23),J(4,` The scan looks for `),R(5,`code`),J(6,`signalStore`),z(),J(7,`, `),R(8,`code`),J(9,`signalState`),z(),J(10,`, `),R(11,`code`),J(12,`signalMethod`),z(),J(13,`, `),R(14,`code`),J(15,`createAction`),z(),J(16,`, `),R(17,`code`),J(18,`createReducer`),z(),J(19,`, `),R(20,`code`),J(21,`createEffect`),z(),J(22,`, `),R(23,`code`),J(24,`createSelector`),z(),J(25,` and `),R(26,`code`),J(27,`createFeature`),z(),J(28,`. `),z()())}function yI(e,t){if(e&1){let e=W();R(0,`button`,101),G(`click`,function(){let t=O(e).$implicit,n=K(2);return k(n.kind.set(n.kind()===t.kind?null:t.kind))}),B(1,`span`,30),R(2,`span`,106),J(3),z(),R(4,`span`,102),J(5),z()()}if(e&2){let e=t.$implicit,n=K(2);q(`active`,n.kind()===e.kind),M(`aria-pressed`,n.kind()===e.kind),j(),C_(`background`,n.kindColor(e.kind)),j(2),Y(n.kindLabel(e.kind)),j(2),Y(e.count)}}function bI(e,t){if(e&1&&(R(0,`p`,111),J(1),z()),e&2){let e=K().$implicit;j(),Y(e.detail)}}function xI(e,t){if(e&1&&(R(0,`li`,105)(1,`div`,107),B(2,`span`,30),R(3,`span`,108),J(4),z(),R(5,`span`,35),J(6),z()(),R(7,`div`,109)(8,`span`,110),J(9),z()(),N(10,bI,2,1,`p`,111),z()),e&2){let e=t.$implicit,n=K(2);j(2),C_(`background`,n.kindColor(e.kind)),j(2),Y(e.name),j(2),Y(n.kindLabel(e.kind)),j(2),L(`title`,e.file+`:`+e.line),j(),Z(``,e.file,`:`,e.line),j(),P(e.detail?10:-1)}}function SI(e,t){if(e&1){let e=W();R(0,`li`,18)(1,`p`,22),J(2,`No declarations match.`),z(),R(3,`button`,24),G(`click`,function(){return O(e),k(K(2).clearFilters())}),J(4,`Clear filters`),z()()}}function CI(e,t){if(e&1){let e=W();R(0,`div`,100)(1,`button`,101),G(`click`,function(){return O(e),k(K().kind.set(null))}),J(2,` All `),R(3,`span`,102),J(4),z()(),F(5,yI,6,7,`button`,103,fF),z(),R(7,`ul`,104),F(8,xI,11,8,`li`,105,pF,!1,SI,5,0,`li`,18),z()}if(e&2){let e=K();j(),q(`active`,!e.kind()),M(`aria-pressed`,!e.kind()),j(3),Y(e.sourceEntries().length),j(),I(e.groupedEntries()),j(3),I(e.filteredEntries())}}var wI={action:`#f59e0b`,reducer:`#a78bfa`,effect:`#fb923c`,selector:`#60a5fa`,feature:`#34d399`,"store-setup":`#94a3b8`,"signal-store":`#e879f9`,"signal-state":`#22d3ee`,"signal-method":`#fb7185`,store:`#a78bfa`},TI={"signal-store":`signalStore`,"signal-state":`signalState`,"signal-method":`signalMethod`,"store-setup":`store setup`,store:`@ngrx/store`},EI={dispatch:`store.dispatch(action)`,effect:`NgRx effect (Store.next)`,reactive:`store.dispatch(() => action)`};function DI(e){if(!e.trim())return{};let t;try{t=JSON.parse(e)}catch{return{error:`The payload is not valid JSON.`}}return!t||typeof t!=`object`||Array.isArray(t)?{error:`The payload must be a JSON object, like {"id": 7}.`}:Object.prototype.hasOwnProperty.call(t,`type`)?{error:`The payload cannot have a "type" key. Put the action type in the Type field.`}:{payload:t}}var OI=new Set([`action`,`reducer`,`effect`,`selector`,`feature`,`store-setup`]),kI=class e{rpc=$(null);canRestore=Q(()=>oE(this.rpc(),`ngrx`));restoreOff=UT(`ngrx`);filter=A(``);kind=A(null);sourceEntries=A([]);sourceLoaded=A(!1);pages=A([]);failed=A(!1);selectedPageId=A(null);hostPageId=ZT();maxLog=Q(()=>aE(this.rpc()).limits.changeLog);selectedStoreId=A(null);selectedSeq=A(null);confirmSeq=A(null);busy=A(!1);focusLatest=A(!1);focusConfirm=A(null);cancelButton=Rv(`cancelButton`);restoreButton=Rv(`restoreButton`);stateTree=Rv(`stateTree`);latestButton=Rv(`latestButton`);message=A(``);destroyRef=E(ws);unsubscribe=null;page=Q(()=>{let e=this.pages();return e.find(e=>e.pageId===this.selectedPageId())??e.find(e=>e.pageId===this.hostPageId)??e[0]??null});pageOptions=Q(()=>this.pages().map(e=>({value:e.pageId,label:e.title||e.url,hint:e.url})));liveStores=Q(()=>{let e=this.page();if(!e)return[];let t=e.stores.map(e=>({id:e.id,label:e.name??e.references[0]??e.className,kind:e.kind,scope:e.scope,signal:e}));return e.classic&&t.push({id:`store`,label:`Store`,kind:`store`,scope:e.classic.scope,classic:e.classic}),t});filteredStores=Q(()=>{let e=this.filter().trim().toLowerCase();return e?this.liveStores().filter(t=>t.label.toLowerCase().includes(e)||t.kind.includes(e)||(t.signal?.stateKeys??[]).some(t=>t.toLowerCase().includes(e))||(this.page()?.log??[]).some(n=>n.storeId===t.id&&n.type.toLowerCase().includes(e))):this.liveStores()});store=Q(()=>{let e=this.liveStores();return e.find(e=>e.id===this.selectedStoreId())??e[0]??null});stateText=Q(()=>{let e=this.store();return e?tF(e.signal?e.signal.state:e.classic?.state):``});computedEntries=Q(()=>Object.entries(this.store()?.signal?.computed??{}).map(([e,t])=>({key:e,value:nF(t,160),full:tF(t)})));storeLog=Q(()=>{let e=this.store()?.id,t=this.filter().trim().toLowerCase();return(this.page()?.log??[]).filter(n=>n.storeId===e&&(!t||n.type.toLowerCase().includes(t)||this.storeMatches(t))).reverse()});entry=Q(()=>this.storeLog().find(e=>e.seq===this.selectedSeq())??null);dispatchType=A(``);dispatchPayload=A(``);actionTypes=Q(()=>{let e=new Set;for(let t of this.sourceEntries())for(let n of t.types??[])e.add(n);for(let t of this.page()?.log??[])t.source===`store`&&t.action!==void 0&&e.add(t.type);return[...e].sort().slice(0,200)});payloadError=Q(()=>DI(this.dispatchPayload()).error??``);dispatchRequest=Q(()=>{let e=this.dispatchType().trim(),{payload:t,error:n}=DI(this.dispatchPayload());return!e||n?null:{type:`dispatch`,action:e,...t?{payload:t}:{}}});usesSignals=Q(()=>this.sourceEntries().some(e=>e.kind===`signal-store`||e.kind===`signal-state`));usesClassic=Q(()=>this.sourceEntries().some(e=>OI.has(e.kind)));filteredEntries=Q(()=>{let e=this.filter().trim().toLowerCase(),t=this.kind();return this.sourceEntries().filter(n=>(!t||n.kind===t)&&(!e||n.name.toLowerCase().includes(e)||n.kind.includes(e)||(n.detail??``).toLowerCase().includes(e)))});groupedEntries=Q(()=>{let e=new Map;for(let t of this.sourceEntries())e.set(t.kind,(e.get(t.kind)??0)+1);return[...e.entries()].map(([e,t])=>({kind:e,count:t}))});constructor(){dc(()=>{let e=this.rpc();e&&this.load(e)}),ey(()=>{let e=this.latestButton();e&&this.focusLatest()&&!this.busy()&&(this.focusLatest.set(!1),e.nativeElement.focus())}),dc(()=>{let e=this.focusConfirm(),t=e===`cancel`?this.cancelButton():this.restoreButton();e&&t&&(this.focusConfirm.set(null),t.nativeElement.focus())}),this.destroyRef.onDestroy(()=>this.unsubscribe?.())}storeMatches(e){let t=this.store();return!!t&&t.label.toLowerCase().includes(e)}async load(e){this.failed.set(!1),tE(e,`get-ngrx-store`).then(e=>this.sourceEntries.set(Array.isArray(e)?e:[])).catch(()=>this.sourceEntries.set([])).finally(()=>this.sourceLoaded.set(!0));try{let t=await e.scope(`ng-devtools`).rpc.sharedState(`ngrx-store`);if(this.destroyRef.destroyed)return;let n=e=>{let t=e;this.pages.set(Array.isArray(t?.pages)?t.pages:[])};n(t.value()),this.unsubscribe?.(),this.unsubscribe=t.on(`updated`,n)}catch{this.failed.set(!0)}}retry(){let e=this.rpc();e&&this.load(e)}selectPage(e){this.selectedPageId.set(e),this.selectedStoreId.set(null),this.selectedSeq.set(null),this.confirmSeq.set(null),this.message.set(``)}selectStore(e){this.selectedStoreId.set(e),this.selectedSeq.set(null),this.confirmSeq.set(null),this.message.set(``)}selectEntry(e){this.selectedSeq.set(this.selectedSeq()===e?null:e),this.confirmSeq.set(null),this.message.set(``)}askRestore(e){this.confirmSeq.set(e),this.focusConfirm.set(`cancel`)}cancelRestore(e){e?.preventDefault(),this.confirmSeq.set(null),this.focusConfirm.set(`restore`)}async restore(e,t){let n=this.page();if(!n)return;this.busy.set(!0),this.focusLatest.set(!1);let r=!1;try{let i=await tE(this.rpc(),`request-ngrx-action`,{pageId:n.pageId,request:{type:`restore`,seq:e}});this.message.set(i?.error??i?.message??`Restored.`),r=t&&!i?.error&&!!i?.paused}catch{this.message.set(`Could not reach the page to restore the state.`)}finally{this.busy.set(!1),this.confirmSeq.set(null),this.focusLatest.set(r),r||this.stateTree()?.nativeElement.focus()}}async backToLatest(){let e=this.page();if(e){this.busy.set(!0);try{let t=await tE(this.rpc(),`request-ngrx-action`,{pageId:e.pageId,request:{type:`latest`}});this.focusLatest.set(!1),this.stateTree()?.nativeElement.focus(),this.message.set(t?.error??t?.message??`Back on the latest state.`)}catch{this.message.set(`Could not reach the page to go back to the latest state.`)}finally{this.busy.set(!1)}}}canAgain(e){return e.source===`store`&&e.action!==void 0}async dispatchAction(e){e.preventDefault();let t=this.dispatchRequest();t&&await this.send(t,`Could not reach the page to dispatch the action.`)}dispatchAgain(e){return this.send({type:`dispatch-again`,seq:e},`Could not reach the page to dispatch the action again.`)}async send(e,t){let n=this.page();if(n&&!this.busy()){this.busy.set(!0);try{let t=await tE(this.rpc(),`request-ngrx-action`,{pageId:n.pageId,request:e});this.message.set(t?.error??t?.message??`Dispatched.`),t?.entry&&(this.selectedStoreId.set(`store`),this.selectedSeq.set(t.entry.seq))}catch{this.message.set(t)}finally{this.busy.set(!1)}}}clearFilters(){this.filter.set(``),this.kind.set(null)}changeCount(e){return(this.page()?.log??[]).filter(t=>t.storeId===e).length}kindColor(e){return wI[e]??`var(--text-3)`}kindLabel(e){return TI[e]??e}originText(e){return EI[e]??e}opLabel(e){return e===`add`?`added`:e===`remove`?`removed`:`changed`}prettyText(e){return tF(e)}shortText(e){return nF(e)}formatTime=mD;static ɵfac=function(t){return new(t||e)};static ɵcmp=Vh({type:e,selectors:[[`app-store-inspector`]],viewQuery:function(e,t){e&1&&e_(t.cancelButton,rF,5)(t.restoreButton,iF,5)(t.stateTree,aF,5)(t.latestButton,oF,5),e&2&&t_(4)},inputs:{rpc:[1,`rpc`]},decls:25,vars:10,consts:[[`stateTree`,``],[`latestButton`,``],[`cancelButton`,``],[`restoreButton`,``],[1,`toolbar`],[`type`,`search`,`placeholder`,`Filter stores, changes and declarations…`,`aria-label`,`Filter stores, changes and source declarations`,3,`input`,`value`],[1,`status`],[`aria-hidden`,`true`,1,`live-dot`],[`aria-labelledby`,`ngrx-live-heading`,1,`block`],[1,`section-head`],[`id`,`ngrx-live-heading`],[1,`pill`],[`role`,`alert`,1,`empty`],[1,`empty`],[1,`live-layout`],[`role`,`status`,1,`message`],[`aria-labelledby`,`ngrx-source-heading`,1,`block`],[`id`,`ngrx-source-heading`],[`role`,`status`,1,`empty`,`compact`],[1,`empty`,`compact`],[`id`,`ngrx-page-label`,1,`visually-hidden`],[`labelledBy`,`ngrx-page-label`,1,`page-select`,3,`valueChange`,`options`,`value`],[1,`empty-title`],[1,`hint`],[`type`,`button`,1,`btn`,3,`click`],[`aria-label`,`Stores on this page`,1,`store-list`],[1,`muted`,`pad`],[1,`store-detail`],[`type`,`button`,1,`store-item`,3,`click`],[1,`store-top`],[`aria-hidden`,`true`,1,`dot`],[1,`store-name`],[1,`store-meta`],[1,`detail-head`],[1,`chips`],[1,`chip`],[1,`chip`,`mono`,3,`title`],[1,`refs`],[1,`paused`],[1,`facts`],[`aria-labelledby`,`ngrx-state-heading`,1,`fact`],[`id`,`ngrx-state-heading`],[`tabindex`,`0`,`aria-labelledby`,`ngrx-state-heading`,1,`tree`],[`aria-labelledby`,`ngrx-computed-heading`,1,`fact`],[`aria-labelledby`,`ngrx-log-heading`,1,`log`],[`id`,`ngrx-log-heading`],[`what`,`changes on this page`,`limit`,`changeLog`,3,`dropped`,`max`],[1,`log-layout`],[1,`log-list`],[`aria-labelledby`,`ngrx-entry-heading`,1,`entry`],[`aria-labelledby`,`ngrx-dispatch-heading`,1,`dispatch`],[`type`,`button`,1,`btn`,`primary`,3,`click`,`disabled`],[`id`,`store-latest-off`,1,`hint`,`small`],[`id`,`ngrx-computed-heading`],[1,`kv`],[1,`muted`],[`id`,`ngrx-methods-heading`,1,`spaced`],[`aria-labelledby`,`ngrx-methods-heading`,1,`methods`],[3,`title`],[1,`chip`,`mono`],[1,`tag`],[1,`calls`],[`type`,`button`,1,`log-item`,3,`click`],[1,`seq`],[1,`log-type`,3,`title`],[1,`log-meta`],[`id`,`ngrx-entry-heading`],[1,`sub`],[1,`diff`],[`role`,`group`,`aria-labelledby`,`ngrx-confirm-text`,1,`confirm`],[1,`hint`,`small`],[1,`code`],[3,`class`],[1,`op`],[1,`path`],[1,`values`],[1,`before`],[1,`after`],[`aria-hidden`,`true`,1,`arrow`],[1,`visually-hidden`],[`role`,`group`,`aria-labelledby`,`ngrx-confirm-text`,1,`confirm`,3,`keydown.escape`],[`id`,`ngrx-confirm-text`],[1,`actions`],[1,`entry-actions`],[`type`,`button`,1,`btn`,`restore`,3,`disabled`],[`type`,`button`,1,`btn`,3,`disabled`],[`id`,`store-writes-off`,1,`hint`,`small`],[`type`,`button`,1,`btn`,`restore`,3,`click`,`disabled`],[`type`,`button`,1,`btn`,3,`click`,`disabled`],[`id`,`ngrx-dispatch-heading`],[1,`dispatch-form`,3,`submit`],[`required`,``,`spellcheck`,`false`,`autocomplete`,`off`,`list`,`ngrx-action-types`,`placeholder`,`e.g. [Cart] Add Item`,3,`input`,`value`],[`id`,`ngrx-action-types`],[3,`value`],[1,`optional`],[`rows`,`3`,`spellcheck`,`false`,`placeholder`,`e.g. {"id": 7}`,`aria-describedby`,`ngrx-payload-error`,3,`input`,`value`],[`id`,`ngrx-payload-error`,1,`field-error`],[`type`,`submit`,1,`btn`,`primary`,3,`disabled`],[`id`,`store-dispatch-off`,1,`hint`,`small`],[`aria-hidden`,`true`,1,`spinner`],[`role`,`group`,`aria-label`,`Filter declarations by kind`,1,`kinds`],[`type`,`button`,1,`kind-chip`,3,`click`],[1,`count`],[`type`,`button`,1,`kind-chip`,3,`active`],[1,`nodes`],[1,`node-card`],[1,`chip-text`],[1,`node-header`],[1,`node-label`],[1,`node-meta`],[1,`file`,3,`title`],[1,`detail`]],template:function(e,t){e&1&&(R(0,`div`,4)(1,`input`,5),G(`input`,function(e){return t.filter.set(e.target.value)}),z(),N(2,mF,3,2),R(3,`span`,6),B(4,`span`,7),J(5),z()(),R(6,`section`,8)(7,`div`,9)(8,`h2`,10),J(9,`Live stores`),z(),N(10,hF,2,1,`span`,11),z(),N(11,gF,7,0,`div`,12)(12,_F,5,0,`div`,13)(13,xF,4,1,`div`,13)(14,hI,6,2,`div`,14),R(15,`p`,15),J(16),z()(),R(17,`section`,16)(18,`div`,9)(19,`h2`,17),J(20,`Source declarations`),z(),N(21,gI,2,1,`span`,11),z(),N(22,_I,4,0,`div`,18)(23,vI,29,0,`div`,19)(24,CI,11,5),z()),e&2&&(j(),L(`value`,t.filter()),j(),P(t.pages().length>1?2:-1),j(),q(`on`,!!t.page()),j(2),X(` `,t.page()?`Live`:`No page connected`,` `),j(5),P(t.liveStores().length?10:-1),j(),P(t.failed()?11:t.page()?t.liveStores().length?14:13:12),j(5),Y(t.message()),j(5),P(t.sourceEntries().length?21:-1),j(),P(t.sourceLoaded()?t.sourceEntries().length===0?23:24:22))},dependencies:[_D,oD],styles:[`[_nghost-%COMP%] {
  display: grid;
  gap: 24px;
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
.log-item[_ngcontent-%COMP%]:hover {
  background: var(--%NS%surface-3);
}

.store-item[_ngcontent-%COMP%]:focus-visible, 
.log-item[_ngcontent-%COMP%]:focus-visible {
  outline: 2px solid var(--%NS%accent);
  outline-offset: -2px;
}

.store-item.selected[_ngcontent-%COMP%], 
.log-item.selected[_ngcontent-%COMP%] {
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

.log-type[_ngcontent-%COMP%] {
  overflow: hidden;
  min-width: 0;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 100%;
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

.entry[_ngcontent-%COMP%]   h5[_ngcontent-%COMP%] {
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
}`]})};function AI(e){return e.split(`@`)[1]??``}var jI={signal:`Signal Forms`,reactive:`Reactive`,template:`Template-driven`},MI={own:`validator`,directive:`template attribute`,tree:`cross-field rule`,async:`async`,parse:`parse`,submission:`server`,schema:`schema`,manual:`setErrors`},NI=nE,PI={key:`name looks secret`,"input-type":`password input`,autocomplete:`autocomplete is a secret kind`,marker:`marked as mask`,parent:`inside a secret group`,config:`listed in mask`};function FI(e){return PI[e]??e}var II=`https://github.com/santoshyadavdev/angular-devtools/blob/main/apps/docs/src/content/security.md#opt-fields-in-or-out`;async function LI(e,t){return await NI(e,`request-form-action`,t)??{ok:!1,error:`The devtools server did not answer.`}}function RI(e){return`${e.ok?e.message??`Done.`:e.error??`Failed.`}${e.skipped?.length?` Skipped: ${e.skipped.map(e=>`${e.path} (${e.reason})`).join(`, `)}.`:``}${e.status?` Status: ${e.status}.`:``}`}function zI(e){return(e??``).replace(/^_Labels, paths.*_\n\n/,``).replace(/`/g,``).replace(/\*\*/g,``)}var BI=[`heading`];function VI(e,t){if(e&1){let e=W();V(0,`div`,6)(1,`p`,9),J(2,`Could not explain this field. The devtools server did not answer.`),H(),V(3,`button`,11),Qg(`click`,function(){return O(e),k(K().retry())}),J(4,`Try again`),H()()}}function HI(e,t){if(e&1&&(V(0,`pre`,7),J(1),H()),e&2){let e=K();M(`aria-busy`,e.text()===null?`true`:null),j(),Y(e.text()??`Loading…`)}}function UI(e,t){if(e&1){let e=W();V(0,`div`,8)(1,`label`,15),J(2),H(),V(3,`input`,16),Qg(`input`,function(t){return O(e),k(K().draft.set(t.target.value))})(`keydown.enter`,function(){return O(e),k(K().setValue())}),H(),V(4,`button`,17),Qg(`click`,function(){return O(e),k(K().setValue())}),J(5,` Set `),H()()}if(e&2){let e=K();j(2),X(`New value for `,e.node().path),j(),Vg(`value`,e.draft()),j(),Vg(`disabled`,!e.canWrite()),M(`aria-describedby`,e.canWrite()?null:`field-writes-off`)}}function WI(e,t){if(e&1&&(V(0,`p`,9),J(1),V(2,`a`,18),J(3,`How to unmask it`),H()()),e&2){let e=K();j(),X(` No Set editor: this field is redacted (`,e.redactLabel(e.node().redacted),`). `),j(),Vg(`href`,e.unmaskDocsUrl,Au)}}function GI(e,t){if(e&1&&(V(0,`p`,13),J(1),H()),e&2){let e=K();j(),Y(e.writesOff)}}var KI=class e{form=$.required();node=$.required();version=$(0);rpc=$(null);closed=Ov();canWrite=Q(()=>oE(this.rpc(),`forms`));writesOff=UT(`forms`);redactLabel=FI;unmaskDocsUrl=II;target=Q(()=>`${this.form().id}|${this.node().path}`);text=Tv({source:this.target,computation:()=>null});failed=Tv({source:this.target,computation:()=>!1});attempt=A(0);heading=Rv.required(`heading`);host=E(Nl);draft=Tv({source:this.target,computation:()=>``});message=Tv({source:this.target,computation:()=>``});constructor(){dc(()=>{let e=this.form().id,t=this.node().path;this.version(),this.attempt();let n=this.rpc();Cv(()=>this.load(n,e,t))}),ey(()=>{this.target();let e=Cv(this.heading).nativeElement;this.host.nativeElement.scrollIntoView?.({block:`nearest`}),e.focus({preventScroll:!0})})}async load(e,t,n){if(!e)return;let r=await NI(e,`forms-explain`,{kind:`field`,form:t,path:n});if(this.form().id===t&&this.node().path===n){if(r===null){this.failed.set(!0);return}this.failed.set(!1),this.text.set(zI(r))}}retry(){this.failed.set(!1),this.attempt.update(e=>e+1)}async act(e){let t=await LI(this.rpc(),{action:e,formId:this.form().id,path:this.node().path});this.message.set(t.expression?`${RI(t)} ${t.expression}`:RI(t))}async setValue(){let e=await LI(this.rpc(),{action:`set-value`,formId:this.form().id,path:this.node().path,value:this.draft(),coerce:!0,mode:`user`});this.message.set(RI(e))}static ɵfac=function(t){return new(t||e)};static ɵcmp=Vh({type:e,selectors:[[`app-forms-field-detail`]],viewQuery:function(e,t){e&1&&e_(t.heading,BI,5),e&2&&t_()},hostAttrs:[`role`,`region`,`aria-labelledby`,`forms-field-heading`],inputs:{form:[1,`form`],node:[1,`node`],version:[1,`version`],rpc:[1,`rpc`]},outputs:{closed:`closed`},decls:26,vars:11,consts:[[`heading`,``],[1,`head`],[1,`section-label`],[`id`,`forms-field-heading`,`tabindex`,`-1`],[1,`tag`],[`type`,`button`,1,`small`,`close`,3,`click`],[`role`,`alert`,1,`failed`],[1,`explain`],[1,`editor`],[1,`muted`],[`role`,`group`,`aria-label`,`Field actions`,1,`row`],[`type`,`button`,1,`small`,3,`click`],[`type`,`button`,1,`small`,3,`click`,`disabled`],[`id`,`field-writes-off`,1,`muted`],[`role`,`status`,1,`status`],[`for`,`field-value`,1,`sr-only`],[`id`,`field-value`,`type`,`text`,`placeholder`,`New value, read as the current value's type`,`autocomplete`,`off`,`spellcheck`,`false`,1,`field-input`,3,`input`,`keydown.enter`,`value`],[`type`,`button`,1,`small`,`primary`,3,`click`,`disabled`],[`target`,`_blank`,`rel`,`noopener noreferrer`,3,`href`]],template:function(e,t){e&1&&(V(0,`div`,1)(1,`span`,2),J(2,`Field`),H(),V(3,`h3`,3,0),J(5),H(),V(6,`span`,4),J(7),H(),V(8,`button`,5),Qg(`click`,function(){return t.closed.emit()}),J(9,` Close `),H()(),N(10,VI,5,0,`div`,6)(11,HI,2,2,`pre`,7),N(12,UI,6,4,`div`,8)(13,WI,4,2,`p`,9),V(14,`div`,10)(15,`button`,11),Qg(`click`,function(){return t.act(`focus`)}),J(16,`Focus`),H(),V(17,`button`,12),Qg(`click`,function(){return t.act(`mark-touched`)}),J(18,` Touch `),H(),V(19,`button`,12),Qg(`click`,function(){return t.act(`revalidate`)}),J(20,` Revalidate `),H(),V(21,`button`,11),Qg(`click`,function(){return t.act(`store-as-global`)}),J(22,`Store as global`),H()(),N(23,GI,2,1,`p`,13),V(24,`p`,14),J(25),H()),e&2&&(j(5),Y(t.node().path||`(form)`),j(2),Y(t.node().type),j(),M(`aria-label`,`Close details for `+(t.node().path||`the form`)),j(2),P(t.failed()?10:11),j(2),P(t.node().type===`control`&&!t.node().redacted?12:t.node().type===`control`?13:-1),j(5),Vg(`disabled`,!t.canWrite()),M(`aria-describedby`,t.canWrite()?null:`field-writes-off`),j(2),Vg(`disabled`,!t.canWrite()),M(`aria-describedby`,t.canWrite()?null:`field-writes-off`),j(4),P(t.canWrite()?-1:23),j(2),Y(t.message()))},styles:[`.muted[_ngcontent-%COMP%] {
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
  background: color-mix(in srgb, var(--%NS%ok) 12%, transparent);
  color: var(--%NS%ok);
}

.tag[data-tone=warn][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%warn) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%warn) 12%, transparent);
  color: var(--%NS%warn);
}

.tag[data-tone=bad][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%danger) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%danger) 12%, transparent);
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
}`]})};function qI(e,t){if(e&1){let e=W();V(0,`div`,0)(1,`p`,4),J(2,`Could not explain this form`),H(),V(3,`p`),J(4,`The devtools server did not answer. Check that the app is running, then try again.`),H(),V(5,`button`,2),Qg(`click`,function(){return O(e),k(K().retry())}),J(6,`Try again`),H()()}}function JI(e,t){if(e&1&&(V(0,`section`,5)(1,`h3`,6),J(2,`Submit`),H(),V(3,`pre`,7),J(4),H()(),V(5,`section`,8)(6,`h3`,9),J(7,`Payload`),H(),V(8,`pre`,7),J(9),H()()),e&2){let e=K();j(3),M(`aria-busy`,e.submit()===null?`true`:null),j(),Y(e.submit()??`Loading…`),j(4),M(`aria-busy`,e.payload()===null?`true`:null),j(),Y(e.payload()??`Loading…`)}}function YI(e,t){if(e&1){let e=W();V(0,`div`,0)(1,`p`,3),J(2,`Could not check this form`),H(),V(3,`p`),J(4,`The devtools server did not answer. Check that the app is running, then try again.`),H(),V(5,`button`,4),Qg(`click`,function(){return O(e),k(K().retry())}),J(6,`Try again`),H()()}}function XI(e,t){e&1&&(V(0,`div`,1),U(1,`span`,5),V(2,`p`),J(3,`Checking the form for problems…`),H()())}function ZI(e,t){e&1&&(V(0,`div`,2)(1,`span`,6),ps(),V(2,`svg`,7),U(3,`path`,8),H()(),ms(),V(4,`p`,3),J(5,`No problems found`),H(),V(6,`p`),J(7,`For generic accessibility checks, run axe on the page.`),H()())}function QI(e,t){if(e&1&&(V(0,`span`,15),J(1,`at `),V(2,`code`),J(3),H()()),e&2){let e=K().$implicit;j(3),Y(e.path)}}function $I(e,t){if(e&1&&(V(0,`li`)(1,`div`,12)(2,`span`,13),J(3),H(),V(4,`code`,14),J(5),H(),N(6,QI,4,1,`span`,15),H(),V(7,`p`,16),J(8),H(),V(9,`p`,17)(10,`span`,18),J(11,`Fix`),H(),J(12),H()()),e&2){let e=t.$implicit;M(`data-severity`,e.severity),j(2),M(`data-tone`,e.severity===`info`?``:e.severity===`error`?`bad`:`warn`),j(),Y(e.severity),j(2),Y(e.rule),j(),P(e.path?6:-1),j(2),Y(e.message),j(4),X(` `,e.fix)}}function eL(e,t){if(e&1&&(V(0,`p`,9)(1,`span`,10),J(2),H(),J(3),H(),V(4,`ul`,11),F(5,$I,13,7,`li`,null,wg),H()),e&2){let e=K();j(2),Y(e.findings().length),j(),X(` `,e.findings().length===1?`finding`:`findings`,` `),j(2),I(e.findings())}}var tL=class e{formId=$.required();version=$(0);rpc=$(null);submit=Tv({source:this.formId,computation:()=>null});payload=Tv({source:this.formId,computation:()=>null});failed=Tv({source:this.formId,computation:()=>!1});message=A(``);attempt=A(0);constructor(){dc(()=>{let e=this.formId();this.version(),this.attempt();let t=this.rpc();t&&Cv(async()=>{let[n,r]=await Promise.all([NI(t,`forms-explain`,{kind:`submit`,form:e}),NI(t,`forms-explain`,{kind:`payload`,form:e})]);if(this.formId()===e){if(n===null||r===null){this.failed.set(!0);return}this.failed.set(!1),this.submit.set(zI(n)),this.payload.set(zI(r))}})})}retry(){this.failed.set(!1),this.attempt.update(e=>e+1)}async copyFixture(){let e=(await NI(this.rpc(),`forms-explain`,{kind:`fixture`,form:this.formId()})??``).match(/```ts\n([\s\S]*?)```/)?.[1];if(!e){this.message.set(`No test fixture is available for this form.`);return}try{await navigator.clipboard.writeText(e),this.message.set(`Copied.`)}catch{this.message.set(`Clipboard is not available here.`)}}static ɵfac=function(t){return new(t||e)};static ɵcmp=Vh({type:e,selectors:[[`app-forms-submit`]],inputs:{formId:[1,`formId`],version:[1,`version`],rpc:[1,`rpc`]},decls:7,vars:2,consts:[[`role`,`alert`,1,`empty-state`],[1,`fixture`],[`type`,`button`,1,`small`,3,`click`],[`role`,`status`,1,`status`],[1,`empty-title`],[`aria-labelledby`,`forms-submit-title`,1,`block`],[`id`,`forms-submit-title`,1,`section-label`],[1,`explain`],[`aria-labelledby`,`forms-payload-title`,1,`block`],[`id`,`forms-payload-title`,1,`section-label`]],template:function(e,t){e&1&&(N(0,qI,7,0,`div`,0)(1,JI,10,4),V(2,`div`,1)(3,`button`,2),Qg(`click`,function(){return t.copyFixture()}),J(4,`Copy test fixture`),H(),V(5,`span`,3),J(6),H()()),e&2&&(P(+!t.failed()),j(6),Y(t.message()))},styles:[`.muted[_ngcontent-%COMP%] {
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
  background: color-mix(in srgb, var(--%NS%ok) 12%, transparent);
  color: var(--%NS%ok);
}

.tag[data-tone=warn][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%warn) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%warn) 12%, transparent);
  color: var(--%NS%warn);
}

.tag[data-tone=bad][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%danger) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%danger) 12%, transparent);
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
}`]})},nL=class e{formId=$.required();version=$(0);rpc=$(null);findings=Tv({source:this.formId,computation:()=>null});failed=Tv({source:this.formId,computation:()=>!1});attempt=A(0);constructor(){dc(()=>{let e=this.formId();this.version(),this.attempt();let t=this.rpc();t&&Cv(async()=>{let n=await NI(t,`forms-lint`,{form:e});this.formId()===e&&(this.failed.set(n===null),n&&this.findings.set(n))})})}retry(){this.failed.set(!1),this.attempt.update(e=>e+1)}static ɵfac=function(t){return new(t||e)};static ɵcmp=Vh({type:e,selectors:[[`app-forms-lint`]],inputs:{formId:[1,`formId`],version:[1,`version`],rpc:[1,`rpc`]},decls:4,vars:1,consts:[[`role`,`alert`,1,`empty-state`],[`role`,`status`,1,`empty-state`],[1,`empty-state`],[1,`empty-title`],[`type`,`button`,1,`small`,3,`click`],[`aria-hidden`,`true`,1,`spinner`],[`aria-hidden`,`true`,1,`ok-icon`],[`width`,`16`,`height`,`16`,`viewBox`,`0 0 24 24`,`fill`,`none`,`stroke`,`currentColor`,`stroke-width`,`2.5`,`stroke-linecap`,`round`,`stroke-linejoin`,`round`],[`d`,`M20 6 9 17l-5-5`],[1,`summary`],[1,`tabular`],[1,`findings`],[1,`meta`],[1,`tag`,`severity`],[1,`rule`],[1,`muted`,`path`],[1,`message`],[1,`fix`],[1,`fix-label`]],template:function(e,t){e&1&&N(0,YI,7,0,`div`,0)(1,XI,4,0,`div`,1)(2,ZI,8,0,`div`,2)(3,eL,7,2),e&2&&P(t.failed()?0:t.findings()===null?1:t.findings().length?3:2)},styles:[`.muted[_ngcontent-%COMP%] {
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
  background: color-mix(in srgb, var(--%NS%ok) 12%, transparent);
  color: var(--%NS%ok);
}

.tag[data-tone=warn][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%warn) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%warn) 12%, transparent);
  color: var(--%NS%warn);
}

.tag[data-tone=bad][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%danger) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%danger) 12%, transparent);
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
}`]})},rL=()=>[],iL=(e,t)=>t.formId+`#`+t.seq;function aL(e,t){e&1&&U(0,`span`,5)}function oL(e,t){if(e&1){let e=W();V(0,`label`)(1,`input`,11),Qg(`change`,function(){let t=O(e).$implicit;return k(K().filter.set(t))}),H(),J(2),H()}if(e&2){let e=t.$implicit,n=K();j(),Vg(`value`,e)(`checked`,e===n.filter()),j(),X(` `,e,` `)}}function sL(e,t){if(e&1&&(V(0,`span`,16),J(1),H()),e&2){let e=K().$implicit;M(`data-tone`,e.outcome===`ran`?``:`bad`),j(),Y(e.outcome)}}function cL(e,t){if(e&1&&(V(0,`span`,16),J(1),H()),e&2){let e=K().$implicit;j(),X(`×`,e.count)}}function lL(e,t){if(e&1&&(V(0,`span`,16),J(1),H()),e&2){let e=K().$implicit;j(),Y(e.origin)}}function uL(e,t){if(e&1&&(V(0,`span`,16),J(1),H()),e&2){let e=K().$implicit;M(`data-tone`,e.ms>1e3?`warn`:``),j(),X(`pending `,e.ms,`ms`)}}function dL(e,t){if(e&1&&(V(0,`span`,16),J(1),H()),e&2){let e=K().$implicit;M(`data-tone`,e.renders>20?`warn`:``),j(),Z(``,e.renders,` renders: `,(e.rendered??ov(3,rL)).join(`, `))}}function fL(e,t){if(e&1&&(V(0,`span`,19),J(1),H(),V(2,`span`,20),J(3,`→`),H(),V(4,`span`,8),J(5,`changed to`),H()),e&2){let e=K(2).$implicit;j(),Y(e.prev)}}function pL(e,t){if(e&1&&(V(0,`div`,17),N(1,fL,6,1),J(2),H()),e&2){let e=K().$implicit;j(),P(e.prev===void 0?-1:1),j(),X(` `,e.detail,` `)}}function mL(e,t){if(e&1&&(V(0,`span`,18),J(1),H()),e&2){let e=K().$implicit;j(),X(`from `,e.caller)}}function hL(e,t){if(e&1&&(V(0,`li`)(1,`time`),J(2),H(),V(3,`div`,12)(4,`div`,13)(5,`code`,14),J(6),H(),V(7,`span`,15),J(8),H(),N(9,sL,2,2,`span`,16),N(10,cL,2,1,`span`,16),N(11,lL,2,1,`span`,16),N(12,uL,2,2,`span`,16),N(13,dL,2,4,`span`,16),H(),N(14,pL,3,2,`div`,17),N(15,mL,2,1,`span`,18),H()()),e&2){let e=t.$implicit,n=K(2);M(`data-type`,e.type),j(),M(`datetime`,n.iso(e.timestamp)),j(),Y(n.time(e.timestamp)),j(4),Y(e.path||`(form)`),j(2),Y(e.type),j(),P(e.outcome?9:-1),j(),P(e.count&&e.count>1?10:-1),j(),P(e.origin?11:-1),j(),P(e.ms===void 0?-1:12),j(),P(e.renders?13:-1),j(),P(e.prev!==void 0||e.detail?14:-1),j(),P(e.caller?15:-1)}}function gL(e,t){if(e&1&&(V(0,`ol`,9),F(1,hL,16,12,`li`,null,iL),H()),e&2){let e=K();j(),I(e.shown())}}function _L(e,t){if(e&1&&(V(0,`div`,10)(1,`p`,21),J(2),H(),V(3,`p`),J(4,`Pick another source above, or interact with the form to record more.`),H()()),e&2){let e=K();j(2),X(`No changes from `,e.filter())}}function vL(e,t){e&1&&(V(0,`div`,10)(1,`p`,21),J(2,`No changes yet`),H(),V(3,`p`),J(4,`Type into the form to see them here.`),H()())}var yL=[`all`,`user`,`code`,`devtools`],bL=class e{events=$.required();recording=$(!1);record=Ov();origins=yL;filter=A(`all`);shown=Q(()=>{let e=this.filter();return this.events().filter(t=>e===`all`||t.origin===e).slice(-100).reverse()});iso(e){return new Date(e).toISOString()}time=mD;static ɵfac=function(t){return new(t||e)};static ɵcmp=Vh({type:e,selectors:[[`app-forms-timeline`]],inputs:{events:[1,`events`],recording:[1,`recording`]},outputs:{record:`record`},decls:17,vars:5,consts:[[1,`toolbar`],[1,`record`],[`type`,`checkbox`,3,`change`,`checked`],[1,`record-text`],[1,`record-title`],[`aria-hidden`,`true`,1,`rec-dot`],[1,`record-hint`],[1,`chips`],[1,`sr-only`],[1,`events`],[1,`empty-state`],[`type`,`radio`,`name`,`timeline-origin`,3,`change`,`value`,`checked`],[1,`body`],[1,`line`],[1,`path`],[1,`event-type`],[1,`tag`],[1,`detail`],[1,`caller`],[1,`prev`],[`aria-hidden`,`true`,1,`arrow`],[1,`empty-title`]],template:function(e,t){e&1&&(V(0,`div`,0)(1,`label`,1)(2,`input`,2),Qg(`change`,function(){return t.record.emit(!t.recording())}),H(),V(3,`span`,3)(4,`span`,4),N(5,aL,1,0,`span`,5),J(6,` Record details `),H(),V(7,`span`,6),J(8,`Record calling code, validator changes and renders per keystroke`),H()()(),V(9,`fieldset`,7)(10,`legend`,8),J(11,`Show changes from`),H(),F(12,oL,3,3,`label`,null,Tg),H()(),N(14,gL,3,0,`ol`,9)(15,_L,5,1,`div`,10)(16,vL,5,0,`div`,10)),e&2&&(j(),q(`on`,t.recording()),j(),Vg(`checked`,t.recording()),j(3),P(t.recording()?5:-1),j(7),I(t.origins),j(2),P(t.shown().length?14:t.events().length?15:16))},styles:[`.muted[_ngcontent-%COMP%] {
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
  background: color-mix(in srgb, var(--%NS%ok) 12%, transparent);
  color: var(--%NS%ok);
}

.tag[data-tone=warn][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%warn) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%warn) 12%, transparent);
  color: var(--%NS%warn);
}

.tag[data-tone=bad][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%danger) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%danger) 12%, transparent);
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
}`]})},xL=()=>[],SL=(e,t)=>t.id,CL=(e,t)=>t.node.path;function wL(e,t){e&1&&(R(0,`div`,0),B(1,`span`,4),R(2,`p`),J(3,`Connecting to the devtools server…`),z()())}function TL(e,t){if(e&1){let e=W();R(0,`div`,1)(1,`p`,5),J(2,`Could not load forms`),z(),R(3,`p`,6),J(4,` The devtools server did not answer. Check that the app is running, then try again. `),z(),R(5,`button`,7),G(`click`,function(){return O(e),k(K().retry())}),J(6,`Try again`),z()()}}function EL(e,t){e&1&&(R(0,`div`,0),B(1,`span`,4),R(2,`p`),J(3,`Loading forms…`),z()())}function DL(e,t){e&1&&(R(0,`div`,2)(1,`p`,5),J(2,`No forms on the page yet`),z(),R(3,`p`,6),J(4,` Open a page that renders a form. Signal Forms, reactive and template-driven forms all show up here, in development builds. `),z()())}function OL(e,t){if(e&1){let e=W();R(0,`div`,2)(1,`p`,5),J(2,`No forms on this page`),z(),R(3,`p`,6),J(4),z(),R(5,`button`,7),G(`click`,function(){return O(e),k(K().allPages.set(!0))}),J(6,` Show forms from all pages `),z()()}if(e&2){let e=K();j(4),Z(` Other connected tabs report `,e.forms().length,` `,e.forms().length===1?`form`:`forms`,`. `)}}function kL(e,t){if(e&1){let e=W();R(0,`label`,11)(1,`input`,15),G(`change`,function(t){return O(e),k(K(2).allPages.set(t.target.checked))}),z(),J(2,` All pages `),z()}if(e&2){let e=K(2);j(),L(`checked`,e.allPages())}}function AL(e,t){e&1&&(R(0,`span`,22),J(1),R(2,`span`,21),J(3,` errors`),z()()),e&2&&(j(),Y(t))}function jL(e,t){if(e&1){let e=W();R(0,`li`)(1,`button`,16),G(`click`,function(){let t=O(e).$implicit;return k(K(2).selectForm(t.id))}),B(2,`span`,17),R(3,`span`,18),J(4),z(),R(5,`span`,19),J(6),R(7,`span`,20),J(8),z(),R(9,`span`,21),J(10),z()(),N(11,AL,4,1,`span`,22),z()()}if(e&2){let e,n=t.$implicit,r=K(2);j(),q(`active`,n.id===r.selected()?.id),M(`aria-current`,n.id===r.selected()?.id?`true`:null),j(),M(`data-status`,n.root.status),j(),M(`title`,n.label),j(),Y(n.label),j(2),X(``,r.kindLabel(n.kind),` · `),j(2),Y(n.id),j(2),X(`, `,n.root.status),j(),P((e=r.counts().get(n.id)?.errors)?11:-1,e)}}function ML(e,t){if(e&1){let e=W();R(0,`section`,13)(1,`h2`,23),J(2),z(),R(3,`p`,24),J(4,` This form is no longer on the page. It comes back here if the page renders it again. `),z(),R(5,`button`,7),G(`click`,function(){O(e);let t=K(2);return k(t.selectForm(t.visible()[0].id))}),J(6),z()()}if(e&2){let e=K(2);j(2),Y(t),j(4),X(` Show `,e.visible()[0].label,` `)}}function NL(e,t){if(e&1&&(R(0,`span`),J(1),z()),e&2){let e=K();j(),Y(e.submitted?`submitted`:`not submitted`)}}function PL(e,t){e&1&&(R(0,`span`),J(1,`submitting`),z())}function FL(e,t){if(e&1&&(R(0,`li`)(1,`code`),J(2),z(),J(3),R(4,`code`,45),J(5),z()()),e&2){let e=t.$implicit;j(2),Y(e.path||`(form)`),j(),X(` `,e.message,` `),j(2),Y(e.kind)}}function IL(e,t){if(e&1&&(R(0,`details`,30)(1,`summary`),J(2),z(),R(3,`ul`),F(4,FL,6,3,`li`,null,wg),z()()),e&2){let e=K();j(2),X(`Error summary (`,e.errorSummary.length,`)`),j(2),I(e.errorSummary)}}function LL(e,t){if(e&1){let e=W();R(0,`button`,33),G(`click`,function(){return O(e),k(K(3).confirmAct(`restore`))}),J(1),z()}if(e&2){let e=K(3);q(`armed`,e.armed()===`restore`),L(`disabled`,!e.canWrite()),M(`aria-describedby`,e.canWrite()?null:`forms-writes-off`)(`title`,`Restore `+e.snapshot()),j(),X(` `,e.armed()===`restore`?`Confirm restore`:`Restore `+e.snapshot(),` `)}}function RL(e,t){if(e&1&&(R(0,`p`,39),J(1),z()),e&2){let e=K(3);j(),Y(e.writesOff)}}function zL(e,t){if(e&1){let e=W();R(0,`button`,46),G(`click`,function(){let t=O(e).$implicit;return k(K(3).tab_.set(t.id))}),J(1),z()}if(e&2){let e=t.$implicit,n=K(3);L(`id`,`forms-tab-`+e.id),M(`aria-selected`,e.id===n.tab_())(`aria-controls`,`forms-panel-`+e.id)(`tabindex`,e.id===n.tab_()?0:-1),j(),X(` `,e.label,` `)}}function BL(e,t){if(e&1){let e=W();R(0,`label`)(1,`input`,15),G(`change`,function(){let t=O(e).$implicit;return k(K(4).toggleChip(t.id))}),z(),J(2),z()}if(e&2){let e=t.$implicit,n=K(4);j(),L(`checked`,n.active().has(e.id)),j(),X(` `,e.label,` `)}}function VL(e,t){if(e&1&&(R(0,`div`,6),J(1,` typed `),R(2,`code`),J(3),dv(4,`json`),z(),J(5,`, not in the model yet `),z()),e&2){let e=K(2).$implicit;j(3),Y(pv(4,1,e.node.uncommitted))}}function HL(e,t){if(e&1&&(R(0,`div`,6),J(1,` resets to `),R(2,`code`),J(3),dv(4,`json`),z()()),e&2){let e=K(2).$implicit;j(3),Y(pv(4,1,e.node.defaultValue))}}function UL(e,t){if(e&1&&(R(0,`code`),J(1),dv(2,`json`),z(),N(3,VL,6,3,`div`,6),N(4,HL,5,3,`div`,6)),e&2){let e=K().$implicit;j(),Y(pv(2,3,e.node.value)),j(2),P(e.node.uncommitted===void 0?-1:3),j(),P(e.node.defaultValue===void 0?-1:4)}}function WL(e,t){e&1&&(R(0,`span`,6),J(1,`not created yet`),z())}function GL(e,t){if(e&1&&(R(0,`span`,28),J(1),z()),e&2){let e=K().$implicit;M(`data-status`,e.node.status),j(),Y(e.node.status)}}function KL(e,t){e&1&&(R(0,`span`),J(1,`touched`),z())}function qL(e,t){if(e&1&&(R(0,`span`),J(1),z()),e&2){let e=K().$implicit;j(),Y(e.node.changed===!1?`dirty, unchanged`:`dirty`)}}function JL(e,t){if(e&1&&(R(0,`span`),J(1),z()),e&2){let e=K().$implicit;j(),X(`not validated (`,e.node.skipped,`)`)}}function YL(e,t){if(e&1&&(R(0,`span`,61),J(1),z()),e&2){let e=K().$implicit;j(),X(`stale: `,e.node.stale.join(`, `))}}function XL(e,t){e&1&&(R(0,`span`,61),J(1,`view out of sync`),z())}function ZL(e,t){if(e&1&&(R(0,`span`),J(1),z()),e&2){let e=K().$implicit,t=K(4);j(),X(`redacted: `,t.redactLabel(e.node.redacted))}}function QL(e,t){e&1&&(R(0,`span`),J(1,`required`),z())}function $L(e,t){e&1&&(R(0,`span`),J(1,`readonly`),z())}function eR(e,t){e&1&&(R(0,`span`),J(1,`hidden`),z())}function tR(e,t){if(e&1&&(R(0,`span`),J(1),z()),e&2){let e=K().$implicit;j(),X(`updates on `,e.node.updateOn)}}function nR(e,t){e&1&&(R(0,`span`),J(1,`debouncing`),z())}function rR(e,t){e&1&&(R(0,`span`),J(1,`validators`),z())}function iR(e,t){e&1&&(R(0,`span`),J(1,`async validator`),z())}function aR(e,t){if(e&1&&(R(0,`span`),J(1),z()),e&2){let e=t.$implicit;j(),Y(e)}}function oR(e,t){if(e&1&&(R(0,`span`),J(1),z()),e&2){let e=K().$implicit;j(),Y(e.node.accessor)}}function sR(e,t){if(e&1&&(R(0,`span`),J(1),z()),e&2){let e=K().$implicit;j(),X(`name `,e.node.name)}}function cR(e,t){if(e&1&&(R(0,`span`),J(1),dv(2,`json`),z()),e&2){let e=t.$implicit;j(),X(`metadata `,pv(2,1,e))}}function lR(e,t){if(e&1&&(R(0,`span`),J(1),z()),e&2){let e=t.$implicit;j(),X(`disabled: `,e)}}function uR(e,t){if(e&1&&(R(0,`span`,64),J(1),z()),e&2){let e=K().$implicit;j(),X(`at `,e.params.path)}}function dR(e,t){if(e&1&&(R(0,`span`,64),J(1),z()),e&2){let e=K().$implicit,t=K(5);j(),Y(t.sourceText(e))}}function fR(e,t){if(e&1&&(R(0,`div`),J(1),R(2,`code`,45),J(3),z(),N(4,uR,2,1,`span`,64),N(5,dR,2,1,`span`,64),z()),e&2){let e=t.$implicit,n=K().$implicit,r=K(4);j(),X(` `,r.errorText(n.node,e),` `),j(2),Y(e.kind),j(),P(e.kind===`standardSchema`&&e.params?.path?4:-1),j(),P(e.source?5:-1)}}function pR(e,t){e&1&&(R(0,`div`,63),J(1,`not shown to the user`),z())}function mR(e,t){if(e&1&&(R(0,`tr`)(1,`td`,65),J(2),z()()),e&2){let e=K().$implicit;j(),C_(`padding-left`,28+e.depth*16,`px`),j(),Z(` `,e.node.truncated,` more fields under `,e.node.path||`the form`,` not shown `)}}function hR(e,t){if(e&1){let e=W();R(0,`tr`,54),G(`mouseenter`,function(){let t=O(e).$implicit,n=K(2);return k(K(2).highlight(n.id,t.node.path))})(`mouseleave`,function(){return O(e),k(K(4).highlight(null,``))}),R(1,`th`,55)(2,`button`,56),G(`focus`,function(){let t=O(e).$implicit,n=K(2);return k(K(2).highlight(n.id,t.node.path))})(`blur`,function(){return O(e),k(K(4).highlight(null,``))})(`click`,function(){let t=O(e).$implicit;return k(K(4).toggleField(t.node.path))}),J(3),z(),R(4,`span`,57),J(5),z()(),R(6,`td`,58),N(7,UL,5,5),z(),R(8,`td`,59),N(9,WL,2,0,`span`,6)(10,GL,2,2,`span`,28),z(),R(11,`td`,60),N(12,KL,2,0,`span`),N(13,qL,2,1,`span`),N(14,JL,2,1,`span`),N(15,YL,2,1,`span`,61),N(16,XL,2,0,`span`,61),N(17,ZL,2,1,`span`),N(18,QL,2,0,`span`),N(19,$L,2,0,`span`),N(20,eR,2,0,`span`),N(21,tR,2,1,`span`),N(22,nR,2,0,`span`),N(23,rR,2,0,`span`),N(24,iR,2,0,`span`),F(25,aR,2,1,`span`,null,Tg),N(27,oR,2,1,`span`),N(28,sR,2,1,`span`),F(29,cR,3,3,`span`,null,wg),F(31,lR,2,1,`span`,null,wg),z(),R(33,`td`,62),F(34,fR,6,4,`div`,null,wg),N(36,pR,2,0,`div`,63),z()(),N(37,mR,3,4,`tr`)}if(e&2){let e=t.$implicit,n=K(4);q(`invalid`,e.node.errors.length),j(),C_(`padding-left`,12+e.depth*16,`px`),j(),M(`aria-label`,`Show details for `+(e.node.path||`the form`))(`aria-pressed`,e.node.path===n.fieldPath())(`title`,e.node.path||`(form)`),j(),X(` `,e.node.key||`(form)`,` `),j(2),Y(e.node.type),j(2),P(e.node.type===`control`?7:-1),j(2),P(e.node.materialized===!1?9:10),j(3),P(e.node.touched?12:-1),j(),P(e.node.dirty?13:-1),j(),P(e.node.skipped?14:-1),j(),P(e.node.stale?.length?15:-1),j(),P(e.node.dom?.drift===void 0?-1:16),j(),P(e.node.redacted?17:-1),j(),P(e.node.required?18:-1),j(),P(e.node.readonly?19:-1),j(),P(e.node.hidden?20:-1),j(),P(e.node.updateOn?21:-1),j(),P(e.node.debouncing?22:-1),j(),P(e.node.validators?.sync?23:-1),j(),P(e.node.validators?.async?24:-1),j(),I(n.constraintList(e.node)),j(2),P(e.node.accessor?27:-1),j(),P(e.node.name?28:-1),j(),I(e.node.metadata??ov(28,xL)),j(2),I(e.node.disabledReasons??ov(29,xL)),j(3),I(e.node.errors),j(2),P(e.node.errors.length&&e.node.dom?.errorShown===!1?36:-1),j(),P(e.node.truncated?37:-1)}}function gR(e,t){e&1&&J(0),e&2&&X(` No field path matches "`,K(5).filter(),`". `)}function _R(e,t){e&1&&J(0,` No field matches the selected filters. `)}function vR(e,t){if(e&1&&(R(0,`tr`)(1,`td`,66),N(2,gR,1,1)(3,_R,1,0),z()()),e&2){let e=K(4);j(2),P(e.filter()?2:3)}}function yR(e,t){if(e&1){let e=W();R(0,`app-forms-field-detail`,67),G(`closed`,function(){return O(e),k(K(4).closeField())}),z()}if(e&2){let e=K(2),n=K(2);L(`form`,e)(`node`,t)(`version`,n.version())(`rpc`,n.rpc())}}function bR(e,t){if(e&1){let e=W();R(0,`div`,47)(1,`input`,48),G(`input`,function(t){return O(e),k(K(3).onFilter(t))}),z(),R(2,`fieldset`,49)(3,`legend`,21),J(4,`Show only fields that are`),z(),F(5,BL,3,2,`label`,null,SL),z()(),R(7,`div`,50)(8,`table`,51)(9,`thead`)(10,`tr`)(11,`th`,52),J(12,`Field`),z(),R(13,`th`,52),J(14,`Value`),z(),R(15,`th`,52),J(16,`Status`),z(),R(17,`th`,52),J(18,`State`),z(),R(19,`th`,52),J(20,`Errors`),z()()(),R(21,`tbody`),F(22,hR,38,30,null,null,CL,!1,vR,4,1,`tr`),z()()(),N(25,yR,1,4,`app-forms-field-detail`,53)}if(e&2){let e,t=K(3);j(),L(`value`,t.filter()),j(4),I(t.chips),j(17),I(t.rows()),j(3),P((e=t.selectedNode())?25:-1,e)}}function xR(e,t){if(e&1){let e=W();B(0,`app-limit-note`,68),R(1,`app-forms-timeline`,69),G(`record`,function(t){return O(e),k(K(3).setRecording(t))}),z()}if(e&2){let e=K(3);L(`dropped`,e.droppedEvents())(`max`,e.maxEvents()),j(),L(`events`,e.selectedEvents())(`recording`,e.recording())}}function SR(e,t){if(e&1&&B(0,`app-forms-submit`,44),e&2){let e=K(),t=K(2);L(`formId`,e.id)(`version`,t.version())(`rpc`,t.rpc())}}function CR(e,t){if(e&1&&B(0,`app-forms-lint`,44),e&2){let e=K(),t=K(2);L(`formId`,e.id)(`version`,t.version())(`rpc`,t.rpc())}}function wR(e,t){if(e&1){let e=W();R(0,`section`,14)(1,`div`,25)(2,`h2`,23),J(3),z(),R(4,`p`,26),J(5),R(6,`code`),J(7),z()()(),R(8,`div`,27)(9,`span`,28),J(10),z(),R(11,`span`),J(12),z(),R(13,`span`),J(14),z(),N(15,NL,2,1,`span`),N(16,PL,2,0,`span`),R(17,`span`,29)(18,`b`),J(19),z(),J(20,` fields · `),R(21,`b`),J(22),z(),J(23,` errors`),z()(),N(24,IL,6,1,`details`,30),R(25,`div`,31)(26,`div`,32)(27,`button`,33),G(`click`,function(){return O(e),k(K(2).act(`touch-all`))}),J(28,` Touch all `),z(),R(29,`button`,33),G(`click`,function(){return O(e),k(K(2).act(`revalidate`))}),J(30,` Revalidate `),z(),R(31,`button`,7),G(`click`,function(){return O(e),k(K(2).act(`focus-first-invalid`))}),J(32,` Focus first invalid `),z(),R(33,`button`,7),G(`click`,function(){O(e);let t=K(2);return k(t.picking()?t.cancelPick():t.pick())}),J(34),z(),B(35,`span`,34),R(36,`button`,7),G(`click`,function(){return O(e),k(K(2).act(`snapshot`))}),J(37,`Snapshot`),z(),N(38,LL,2,6,`button`,35),B(39,`span`,36),R(40,`button`,37),G(`click`,function(){return O(e),k(K(2).confirmAct(`reset`))}),J(41),z(),R(42,`button`,38),G(`click`,function(){return O(e),k(K(2).confirmAct(`submit`))}),J(43),z()(),N(44,RL,2,1,`p`,39),R(45,`p`,40),J(46),z()(),R(47,`div`,41),G(`keydown`,function(t){return O(e),k(K(2).onKey(t))}),F(48,zL,2,5,`button`,42,SL),z(),R(50,`div`,43),N(51,bR,26,3)(52,xR,2,4)(53,SR,1,3,`app-forms-submit`,44)(54,CR,1,3,`app-forms-lint`,44),z()()}if(e&2){let e,n=t,r=K(2);j(3),Y(n.label),j(2),X(` `,r.kindLabel(n.kind),` · `),j(2),Y(n.id),j(2),M(`data-status`,n.root.status),j(),Y(n.root.status),j(2),Y(n.root.dirty?`dirty`:`pristine`),j(2),Y(n.root.touched?`touched`:`untouched`),j(),P(n.submitted===void 0?-1:15),j(),P(n.root.submitting?16:-1),j(3),Y(r.counts().get(n.id)?.fields),j(2),q(`has-errors`,r.counts().get(n.id)?.errors),j(),Y(r.counts().get(n.id)?.errors),j(2),P(n.errorSummary?.length?24:-1),j(3),L(`disabled`,!r.canWrite()),M(`aria-describedby`,r.canWrite()?null:`forms-writes-off`),j(2),L(`disabled`,!r.canWrite()),M(`aria-describedby`,r.canWrite()?null:`forms-writes-off`),j(4),q(`on`,r.picking()),M(`aria-pressed`,!!r.picking()),j(),X(` `,r.picking()?`Cancel picking`:`Pick field on page`,` `),j(4),P(r.snapshot()?38:-1),j(2),q(`armed`,r.armed()===`reset`),L(`disabled`,!r.canWrite()),M(`aria-describedby`,r.canWrite()?null:`forms-writes-off`),j(),X(` `,r.armed()===`reset`?`Confirm reset`:`Reset`,` `),j(),q(`armed`,r.armed()===`submit`),L(`disabled`,!r.canWrite()),M(`aria-describedby`,r.canWrite()?null:`forms-writes-off`),j(),X(` `,r.armed()===`submit`?`Confirm submit`:`Submit`,` `),j(),P(r.canWrite()?-1:44),j(2),Y(r.message()),j(2),I(r.tabs),j(2),L(`id`,`forms-panel-`+r.tab_()),M(`aria-labelledby`,`forms-tab-`+r.tab_()),j(),P((e=r.tab_())===`fields`?51:e===`timeline`?52:e===`submit`?53:e===`lint`?54:-1)}}function TR(e,t){if(e&1&&(R(0,`div`,3)(1,`div`,8)(2,`h2`,9),J(3,` Forms `),R(4,`span`,10),J(5),z()(),N(6,kL,3,1,`label`,11),R(7,`ul`,12),F(8,jL,12,10,`li`,null,SL),z()(),N(10,ML,7,2,`section`,13)(11,wR,55,38,`section`,14),z()),e&2){let e,t=K();j(5),Y(t.visible().length),j(),P(t.hostPageId&&(t.allPages()||t.otherPages())?6:-1),j(2),I(t.visible()),j(2),P((e=t.missing())?10:(e=t.selected())?11:-1,e)}}var ER=[{id:`fields`,label:`Fields`},{id:`timeline`,label:`Timeline`},{id:`submit`,label:`Submit`},{id:`lint`,label:`Lint`}],DR=[{id:`invalid`,label:`Invalid`},{id:`dirty`,label:`Dirty`},{id:`touched`,label:`Touched`},{id:`disabled`,label:`Disabled`},{id:`hidden-error`,label:`Error not shown`}];function OR(e,t){switch(t){case`invalid`:return e.errors.length>0;case`dirty`:return e.dirty&&e.type===`control`;case`touched`:return e.touched&&e.type===`control`;case`disabled`:return e.status===`DISABLED`;case`hidden-error`:return e.dom?.errorShown===!1}}function kR(e){return e.errors.length+(e.children??[]).reduce((e,t)=>e+kR(t),0)}function AR(e){return e.children?e.children.reduce((e,t)=>e+AR(t),0):+(e.type===`control`&&e.materialized!==!1)}var jR=class e{rpc=$(null);focus=$(null);canWrite=Q(()=>oE(this.rpc(),`forms`));redactLabel=FI;writesOff=UT(`forms`);focusHandled=Ov();forms=A([]);events=A([]);loading=A(!0);failed=A(!1);selectedId=A(null);selectedLabel=A(null);hostPageId=ZT();allPages=A(!1);visible=Q(()=>{let e=this.forms(),t=this.hostPageId;return t&&!this.allPages()?e.filter(e=>AI(e.id)===t):e});otherPages=Q(()=>this.forms().some(e=>AI(e.id)!==this.hostPageId));instrumented=A([]);recording=Q(()=>{let e=this.selected()?.id??``;return this.instrumented().some(t=>e.endsWith(`@${t}`))});filter=A(``);tabs=ER;chips=DR;tab_=A(`fields`);active=A(new Set);fieldPath=A(null);version=A(0);message=A(``);armed=A(null);snapshot=A(null);picking=A(null);pickSeq=0;unsubscribe=null;destroyRef=E(ws);host=E(Nl);counts=Q(()=>new Map(this.visible().map(e=>[e.id,{fields:AR(e.root),errors:kR(e.root)}])));selected=Q(()=>{let e=this.visible(),t=this.selectedId();if(t===null)return e[0]??null;let n=this.selectedLabel(),r=AI(t);return e.find(e=>e.id===t)??e.find(e=>e.label===n&&AI(e.id)===r)??e.find(e=>e.label===n)??null});missing=Q(()=>this.selectedId()!==null&&!this.selected()&&this.visible().length?this.selectedLabel()??this.selectedId():null);rows=Q(()=>{let e=this.selected();if(!e)return[];let t=this.filter().toLowerCase(),n=Array.from(this.active()),r=[],i=(e,a)=>{let o=r.length,s=(!t||e.path.toLowerCase().includes(t))&&n.every(t=>OR(e,t));for(let t of e.children??[])s=i(t,a+1)||s;return s&&r.splice(o,0,{node:e,depth:a}),s};return i(e.root,0),r});selectedNode=Q(()=>{let e=this.fieldPath(),t=this.selected();if(e===null||!t)return null;let n=t=>t.path===e?t:(t.children??[]).map(n).find(Boolean)??null;return n(t.root)});dropped=A({});droppedEvents=Q(()=>{let e=this.selected()?.id;return e?this.dropped()[AI(e)]??0:0});maxEvents=Q(()=>aE(this.rpc()).limits.formTimeline);selectedEvents=Q(()=>{let e=this.selected()?.id;return this.events().filter(t=>t.formId===e).slice(-200)});constructor(){dc(()=>{let e=this.rpc();e&&this.load(e)}),dc(()=>{let e=this.focus();e&&Cv(()=>{this.selectForm(e.id),this.focusHandled.emit()})}),this.destroyRef.onDestroy(()=>{this.unsubscribe?.(),this.highlight(null,``)})}async load(e){this.loading.set(!0),this.failed.set(!1);try{let t=await e.scope(`ng-devtools`).rpc.sharedState(`forms`);if(this.destroyRef.destroyed)return;let n=e=>{let t=e;this.forms.set(t?.forms??[]),this.events.set(t?.events??[]),this.instrumented.set(t?.instrumented??[]),this.dropped.set(t?.dropped??{}),this.version.update(e=>e+1)};n(t.value()),this.unsubscribe?.(),this.unsubscribe=t.on(`updated`,n)}catch{this.failed.set(!0)}finally{this.loading.set(!1)}}retry(){let e=this.rpc();e&&this.load(e)}async pick(){let e=this.selected();if(!e)return;let t=++this.pickSeq;this.picking.set(e.id),this.message.set(`Click a field in the app. Press Escape or Cancel picking to stop.`);let n=await LI(this.rpc(),{action:`pick`,formId:e.id});if(t!==this.pickSeq)return;this.picking.set(null);let r=n;if(!n.ok||!r.formId){this.message.set(RI(n));return}this.selectForm(r.formId),this.tab_.set(`fields`),this.fieldPath.set(r.path??``),this.message.set(`Picked ${r.path||`(form)`}.`)}cancelPick(){let e=this.picking();e&&LI(this.rpc(),{action:`cancel-pick`,formId:e})}async setRecording(e){let t=this.selected();if(!t)return;let n=await LI(this.rpc(),{action:`instrument`,formId:t.id,value:e});this.message.set(RI(n))}selectForm(e){this.hostPageId&&AI(e)&&AI(e)!==this.hostPageId&&this.allPages.set(!0),this.selectedId.set(e),this.selectedLabel.set(this.forms().find(t=>t.id===e)?.label??null),this.filter.set(``),this.fieldPath.set(null),this.snapshot.set(null),this.armed.set(null)}toggleField(e){this.fieldPath.update(t=>t===e?null:e)}closeField(){let e=this.host.nativeElement,t=e.querySelector(`button.field[aria-pressed="true"]`)??e.querySelector(`.table-scroll`);this.fieldPath.set(null),t?.focus()}toggleChip(e){this.active.update(t=>{let n=new Set(t);return n.has(e)?n.delete(e):n.add(e),n})}async act(e,t={}){let n=this.selected();if(!n)return;this.armed.set(null);let r=await LI(this.rpc(),{action:e,formId:n.id,...t});r.snapshot&&this.snapshot.set(r.snapshot),this.message.set(RI(r))}confirmAct(e){if(this.armed()!==e){this.armed.set(e),this.message.set(`Press "Confirm ${e}" to ${e} the form in the app.`);return}this.act(e,{confirm:!0,snapshot:this.snapshot()??void 0})}onKey(e){let t=this.tabs.map(e=>e.id),n=t.indexOf(this.tab_()),r=n;if(e.key===`ArrowRight`)r=(n+1)%t.length;else if(e.key===`ArrowLeft`)r=(n-1+t.length)%t.length;else if(e.key===`Home`)r=0;else if(e.key===`End`)r=t.length-1;else return;e.preventDefault(),this.tab_.set(t[r]);let i=e.currentTarget;queueMicrotask(()=>i.querySelector(`#forms-tab-${t[r]}`)?.focus())}sourceText(e){let t=MI[e.source??``]??e.source??``;return e.from===void 0?t:`${t} on ${e.from||`the form`}`}onFilter(e){this.filter.set(e.target.value)}highlight(e,t){let n=this.rpc();n&&n.scope(`ng-devtools`).rpc.callEvent(`request-form-highlight`,e?{formId:e,path:t}:null)}kindLabel(e){return jI[e]}constraintList(e){return Object.entries(e.constraints??{}).map(([e,t])=>`${e} ${t}`)}errorText(e,t){return/^[a-z]/.test(t.message)?`${e.key||`The form`} ${t.message}`:t.message}static ɵfac=function(t){return new(t||e)};static ɵcmp=Vh({type:e,selectors:[[`app-forms-inspector`]],hostBindings:function(e,t){e&1&&G(`keydown.escape`,function(){return t.cancelPick()})},inputs:{rpc:[1,`rpc`],focus:[1,`focus`]},outputs:{focusHandled:`focusHandled`},decls:6,vars:1,consts:[[`role`,`status`,1,`empty`],[`role`,`alert`,1,`empty`],[1,`empty`],[1,`layout`],[`aria-hidden`,`true`,1,`spinner`],[1,`empty-title`],[1,`muted`],[`type`,`button`,1,`small`,3,`click`],[1,`sidebar`],[`id`,`forms-list-heading`,1,`list-heading`],[1,`list-count`],[1,`page-toggle`],[`aria-labelledby`,`forms-list-heading`,1,`form-list`],[`aria-labelledby`,`forms-detail-title`,1,`detail`,`gone`],[`aria-labelledby`,`forms-detail-title`,1,`detail`],[`type`,`checkbox`,3,`change`,`checked`],[`type`,`button`,1,`form-item`,3,`click`],[`aria-hidden`,`true`,1,`dot`],[1,`label`],[1,`kind`],[1,`id`],[1,`sr-only`],[1,`count`],[`id`,`forms-detail-title`],[`role`,`status`,1,`muted`],[1,`detail-head`],[1,`detail-meta`],[1,`summary`],[1,`badge`],[1,`totals`],[1,`error-summary`],[1,`action-bar`],[`role`,`group`,`aria-label`,`Form actions`,1,`actions`],[`type`,`button`,1,`small`,3,`click`,`disabled`],[`aria-hidden`,`true`,1,`divider`],[`type`,`button`,1,`small`,3,`armed`,`disabled`],[`aria-hidden`,`true`,1,`spacer`],[`type`,`button`,1,`small`,`danger`,3,`click`,`disabled`],[`type`,`button`,1,`small`,`primary`,3,`click`,`disabled`],[`id`,`forms-writes-off`,1,`muted`],[`role`,`status`,1,`status`],[`role`,`tablist`,`aria-label`,`Form views`,1,`tabs`,3,`keydown`],[`type`,`button`,`role`,`tab`,3,`id`],[`role`,`tabpanel`,1,`panel`,3,`id`],[3,`formId`,`version`,`rpc`],[1,`kind-tag`],[`type`,`button`,`role`,`tab`,3,`click`,`id`],[1,`filters`],[`type`,`search`,`placeholder`,`Filter fields by path`,`aria-label`,`Filter fields by path`,`autocomplete`,`off`,`spellcheck`,`false`,1,`filter`,3,`input`,`value`],[1,`chips`],[`role`,`region`,`aria-label`,`Fields`,`tabindex`,`0`,1,`table-scroll`],[1,`fields`],[`scope`,`col`],[3,`form`,`node`,`version`,`rpc`],[3,`mouseenter`,`mouseleave`],[`scope`,`row`,1,`name`],[`type`,`button`,1,`field`,3,`focus`,`blur`,`click`],[1,`type`],[1,`value`],[1,`status-cell`],[1,`flags`],[1,`warn`],[1,`errors`],[1,`unseen`],[1,`source`],[`colspan`,`5`,1,`muted`,`truncated`],[`colspan`,`5`,1,`no-match`],[3,`closed`,`form`,`node`,`version`,`rpc`],[`what`,`form events on this page`,`limit`,`formTimeline`,3,`dropped`,`max`],[3,`record`,`events`,`recording`]],template:function(e,t){e&1&&N(0,wL,4,0,`div`,0)(1,TL,7,0,`div`,1)(2,EL,4,0,`div`,0)(3,DL,5,0,`div`,2)(4,OL,7,2,`div`,2)(5,TR,12,3,`div`,3),e&2&&P(t.rpc()?t.failed()?1:t.loading()?2:t.forms().length?t.visible().length?5:4:3:0)},dependencies:[KI,bL,tL,nL,_D,ab],styles:[`.muted[_ngcontent-%COMP%] {
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
  background: color-mix(in srgb, var(--%NS%ok) 12%, transparent);
  color: var(--%NS%ok);
}

.tag[data-tone=warn][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%warn) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%warn) 12%, transparent);
  color: var(--%NS%warn);
}

.tag[data-tone=bad][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%danger) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%danger) 12%, transparent);
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
}`]})},MR=(e,t)=>t.file+t.name,NR=(e,t)=>t.file+`:`+t.line,PR=(e,t)=>t.name;function FR(e,t){e&1&&(R(0,`p`,13),ps(),R(1,`svg`,26),B(2,`circle`,27)(3,`path`,28),z(),ms(),R(4,`span`),J(5),z()()),e&2&&(j(5),Y(t))}function IR(e,t){if(e&1&&(R(0,`p`,13),ps(),R(1,`svg`,26),B(2,`circle`,27)(3,`path`,28),z(),ms(),R(4,`span`)(5,`strong`),J(6),z(),J(7,` Pipe prototypes are patched in the inspected page to count calls and keep the last input and output. Stop recording when you are done. `),z()()),e&2){let e=K();j(6),X(`Recording on `,e.instrumentedPages().length,` page(s).`)}}function LR(e,t){e&1&&(R(0,`div`,14),B(1,`span`,29),R(2,`p`,30),J(3,`Scanning pipes…`),z()())}function RR(e,t){if(e&1){let e=W();R(0,`div`,15)(1,`p`,30),J(2,`Couldn't load pipes`),z(),R(3,`p`,31),J(4,`The devtools server did not answer. Check that it is running.`),z(),R(5,`button`,32),G(`click`,function(){return O(e),k(K().refresh())}),J(6,`Try again`),z()()}}function zR(e,t){e&1&&(R(0,`div`,16)(1,`p`,30),J(2,`No pipes found`),z(),R(3,`p`,31),J(4,` No @Pipe classes were found in the source, and no template uses a built-in pipe yet. `),z()())}function BR(e,t){e&1&&(R(0,`span`,43),J(1,`stale?`),z())}function VR(e,t){if(e&1&&(R(0,`span`,44),J(1),z()),e&2){K();let e=iv(0);j(),X(``,e.instanceCount,` live`)}}function HR(e,t){e&1&&(R(0,`span`,45),J(1,`built-in`),z())}function UR(e,t){e&1&&(R(0,`span`,45),J(1,`NgModule`),z())}function WR(e,t){if(e&1&&(R(0,`span`,47),J(1),z()),e&2){let e=K().$implicit;j(),X(`+`,(e.usageCount??1)-1,` more`)}}function GR(e,t){if(e&1){let e=W();nv(0),R(1,`li`)(2,`button`,38),G(`click`,function(){let t=O(e).$implicit;return k(K(3).select(t))})(`mouseenter`,function(){O(e);let t=iv(0);return k(K(3).highlightPipe(t))})(`mouseleave`,function(){return O(e),k(K(3).highlight(null))})(`focus`,function(){O(e);let t=iv(0);return k(K(3).highlightPipe(t))})(`blur`,function(){return O(e),k(K(3).highlight(null))}),R(3,`span`,39)(4,`span`,40),J(5),z(),R(6,`span`,41),J(7),z()(),R(8,`span`,42),N(9,BR,2,0,`span`,43),N(10,VR,2,1,`span`,44),N(11,HR,2,0,`span`,45),N(12,UR,2,0,`span`,45),R(13,`span`,45),J(14),z()(),R(15,`span`,46),J(16),N(17,WR,2,1,`span`,47),z()()()}if(e&2){let e=t.$implicit,n=K(3),r=rv(n.liveFor(e.name));j(2),q(`selected`,n.isSelected(e)),M(`aria-current`,n.isSelected(e)||null),j(3),Y(e.name),j(2),Y(e.className),j(2),P(r?.stale?9:-1),j(),P(r?10:-1),j(),P(e.builtin?11:-1),j(),P(e.isStandalone?-1:12),j(),q(`impure`,!e.isPure),j(),Y(e.isPure?`pure`:`impure`),j(2),Z(` `,e.file,`:`,e.line,` `),j(),P(e.builtin&&(e.usageCount??0)>1?17:-1)}}function KR(e,t){if(e&1){let e=W();R(0,`ul`,37),G(`keydown`,function(t){return O(e),k(K(2).onListKey(t))}),F(1,GR,18,16,`li`,null,MR),z()}if(e&2){let e=K(2);j(),I(e.filtered())}}function qR(e,t){e&1&&J(0),e&2&&X(` Nothing matches “`,K(3).filter().trim(),`” in this view. `)}function JR(e,t){e&1&&J(0,` None of the pipes fit this filter. `)}function YR(e,t){if(e&1){let e=W();R(0,`div`,35)(1,`p`,30),J(2,`No pipes match`),z(),R(3,`p`,31),N(4,qR,1,1)(5,JR,1,0),z(),R(6,`button`,32),G(`click`,function(){return O(e),k(K(2).clearFilters())}),J(7,`Clear filters`),z()()}if(e&2){let e=K(2);j(4),P(e.filter().trim()?4:5)}}function XR(e,t){e&1&&(R(0,`span`,45),J(1,`built-in`),z())}function ZR(e,t){if(e&1&&(R(0,`dt`),J(1,`File`),z(),R(2,`dd`,51),J(3),z()),e&2){let e=K();j(3),Z(``,e.file,`:`,e.line)}}function QR(e,t){if(e&1&&(R(0,`li`,51),J(1),z()),e&2){let e=t.$implicit;j(),Z(``,e.file,`:`,e.line)}}function $R(e,t){if(e&1&&(R(0,`div`,50)(1,`h3`),J(2,` Used in templates `),R(3,`span`,21),J(4),z()(),R(5,`ul`,53),F(6,QR,2,2,`li`,51,NR),z()()),e&2){let e=K();j(4),Y(e.usageCount),j(2),I(e.usages)}}function ez(e,t){e&1&&(R(0,`p`,54)(1,`span`,43),J(2,`experimental`),z(),J(3,` This pure pipe got an argument whose contents changed while its reference stayed the same, so it may be showing a stale value. `),z())}function tz(e,t){if(e&1){let e=W();R(0,`button`,59),G(`click`,function(){let t=O(e);return k(K(5).highlight(t,!0))})(`mouseenter`,function(){let t=O(e);return k(K(5).highlight(t))})(`mouseleave`,function(){return O(e),k(K(5).highlight(null))})(`focus`,function(){let t=O(e);return k(K(5).highlight(t))})(`blur`,function(){return O(e),k(K(5).highlight(null))}),R(1,`span`,51),J(2),z(),R(3,`span`,60),J(4),z()()}if(e&2){let e=K().$implicit;M(`aria-label`,`Highlight `+e.name+` on the page`),j(2),Y(e.name),j(2),Y(e.count)}}function nz(e,t){if(e&1&&(R(0,`span`,58)(1,`span`,51),J(2),z(),R(3,`span`,60),J(4),z()()),e&2){let e=K().$implicit;j(2),Y(e.name),j(2),Y(e.count)}}function rz(e,t){if(e&1&&(R(0,`li`),N(1,tz,5,3,`button`,57)(2,nz,5,2,`span`,58),z()),e&2){let e,n=t.$implicit;j(),P((e=n.targets?.[0])?1:2,e)}}function iz(e,t){if(e&1&&(R(0,`li`,61),J(1),R(2,`span`,62),J(3),z()()),e&2){let e=t.$implicit,n=K(6);j(),Z(` `,n.describe(e.lastArgs),` → `,n.describe(e.lastResult),` `),j(2),X(``,e.callCount,`×`)}}function az(e,t){if(e&1&&(R(0,`dt`),J(1,`Per instance`),z(),R(2,`dd`)(3,`ul`,53),F(4,iz,4,3,`li`,61,wg),z()()),e&2){let e=K();j(4),I(e.instances)}}function oz(e,t){if(e&1&&(R(0,`dt`),J(1,`Last caller`),z(),R(2,`dd`,61),J(3),z()),e&2){let e=K();j(3),Y(e.lastCaller)}}function sz(e,t){if(e&1&&(R(0,`dt`),J(1,`Calls`),z(),R(2,`dd`),J(3),z(),R(4,`dt`),J(5,`Last input`),z(),R(6,`dd`,61),J(7),z(),R(8,`dt`),J(9,`Last output`),z(),R(10,`dd`,61),J(11),z(),N(12,az,6,0),N(13,oz,4,1)),e&2){let e=t,n=K(4);j(3),Y(e.callCount),j(4),Y(n.describe(e.lastArgs)),j(4),Y(n.describe(e.lastResult)),j(),P(e.instances?.length?12:-1),j(),P(e.lastCaller?13:-1)}}function cz(e,t){e&1&&(R(0,`dt`),J(1,`Calls`),z(),R(2,`dd`,63),J(3,`None recorded yet.`),z())}function lz(e,t){e&1&&(R(0,`p`,56),J(1,`Turn on “Record calls” to see call counts and values.`),z())}function uz(e,t){if(e&1&&(N(0,ez,4,0,`p`,54),R(1,`dl`)(2,`dt`),J(3,`Instances`),z(),R(4,`dd`),J(5),z(),R(6,`dt`),J(7,`Used by`),z(),R(8,`dd`)(9,`ul`,55),F(10,rz,3,1,`li`,null,PR),z()(),N(12,sz,14,5)(13,cz,4,0),z(),N(14,lz,2,0,`p`,56)),e&2){let e,n=t,r=K(3);P(n.stale?0:-1),j(5),Y(n.instanceCount),j(5),I(n.components),j(2),P((e=n.call)?12:r.instrumenting()?13:-1,e),j(2),P(!n.call&&!r.instrumenting()?14:-1)}}function dz(e,t){e&1&&(R(0,`p`,52),J(1,` Not in use on the connected page. Open a view that uses it, or connect the app. `),z())}function fz(e,t){if(e&1&&(R(0,`header`,48)(1,`h2`,49),J(2),z(),R(3,`span`,45),J(4),z(),N(5,XR,2,0,`span`,45),z(),R(6,`div`,50)(7,`h3`),J(8,`Declaration`),z(),R(9,`dl`)(10,`dt`),J(11,`Class`),z(),R(12,`dd`,51),J(13),z(),R(14,`dt`),J(15,`Source`),z(),R(16,`dd`),J(17),z(),N(18,ZR,4,2),R(19,`dt`),J(20,`Standalone`),z(),R(21,`dd`),J(22),z(),R(23,`dt`),J(24,`Pure`),z(),R(25,`dd`),J(26),z()()(),N(27,$R,8,1,`div`,50),R(28,`div`,50)(29,`h3`),J(30,`Live on the page`),z(),N(31,uz,15,4)(32,dz,2,0,`p`,52),z()),e&2){let e,n=t,r=K(2);j(2),Y(n.name),j(),q(`impure`,!n.isPure),j(),Y(n.isPure?`pure`:`impure`),j(),P(n.builtin?5:-1),j(8),Y(n.className),j(4),Y(n.builtin?`@angular/common`:`This project`),j(),P(n.builtin?-1:18),j(4),Y(n.isStandalone?`Yes`:`No, declared in an NgModule`),j(4),X(` `,n.isPure?`Yes, reruns only when an input changes`:`No, reruns on every check`,` `),j(),P(n.builtin&&n.usages?.length?27:-1),j(4),P((e=r.liveFor(n.name))?31:32,e)}}function pz(e,t){e&1&&(R(0,`h2`,64),J(1,`Pipe details`),z(),R(2,`div`,65)(3,`p`,30),J(4,`Pick a pipe`),z(),R(5,`p`,31),J(6,` See where it is declared, which components use it and what it last returned. `),z()())}function mz(e,t){if(e&1&&(R(0,`div`,17)(1,`div`,33),N(2,KR,3,0,`ul`,34)(3,YR,8,1,`div`,35),z(),R(4,`section`,36),N(5,fz,33,12)(6,pz,7,0),z()()),e&2){let e,t=K();j(2),P(t.filtered().length?2:3),j(3),P((e=t.selected())?5:6,e)}}function hz(e,t){if(e&1){let e=W();R(0,`button`,73),G(`click`,function(){let t=O(e);return k(K(3).highlight(t))})(`focus`,function(){let t=O(e);return k(K(3).highlight(t))})(`blur`,function(){return O(e),k(K(3).highlight(null))}),J(1),z()}if(e&2){let e=K().$implicit;M(`aria-label`,`Highlight `+e.component+` on the page`),j(),X(` `,e.component,` `)}}function gz(e,t){if(e&1&&(R(0,`span`,71),J(1),z()),e&2){let e=K().$implicit;j(),Y(e.component)}}function _z(e,t){e&1&&(R(0,`span`,45),J(1,`no source`),z())}function vz(e,t){e&1&&(R(0,`span`,43),J(1,`duplicate subscription`),z())}function yz(e,t){e&1&&(R(0,`span`,43),J(1,`resubscribing`),z())}function bz(e,t){if(e&1){let e=W();R(0,`li`,69),G(`mouseenter`,function(){let t=O(e).$implicit;return k(K(2).highlight(t.target))})(`mouseleave`,function(){return O(e),k(K(2).highlight(null))}),N(1,hz,2,2,`button`,70)(2,gz,2,1,`span`,71),N(3,_z,2,0,`span`,45),N(4,vz,2,0,`span`,43),N(5,yz,2,0,`span`,43),R(6,`span`,72),J(7),z()()}if(e&2){let e,n=t.$implicit;j(),P((e=n.target)?1:2,e),j(2),P(n.hasSource?-1:3),j(),P(n.duplicate?4:-1),j(),P(n.resubscribing?5:-1),j(2),Y(n.latestValue??`no value yet`)}}function xz(e,t){if(e&1&&(R(0,`section`,18)(1,`h2`,66),J(2,` Async subscriptions `),R(3,`span`,21),J(4),z()(),R(5,`p`,56),J(6,` Each `),R(7,`span`,51),J(8,`| async`),z(),J(9,` subscribes on its own. Two on the same source mean the work runs twice. A source that changes on every check, like `),R(10,`span`,51),J(11,`getData() | async`),z(),J(12,`, resubscribes each time. `),z(),R(13,`ul`,67),F(14,bz,8,5,`li`,68,wg),z()()),e&2){let e=K();j(4),Y(e.async().length),j(10),I(e.async())}}function Sz(e,t){e&1&&(R(0,`span`,21),J(1),z()),e&2&&(j(),Y(t.length))}function Cz(e,t){e&1&&(R(0,`p`,22),J(1,`Couldn't run the lint check. Try Refresh.`),z())}function wz(e,t){e&1&&(R(0,`p`,23),J(1,`Checking…`),z())}function Tz(e,t){e&1&&(R(0,`p`,24),J(1,`No problems found.`),z())}function Ez(e,t){if(e&1&&(R(0,`li`,74)(1,`div`,75)(2,`span`,76),J(3),z(),R(4,`code`,77),J(5),z(),R(6,`span`,78),J(7),z()(),R(8,`p`,79),J(9),z(),R(10,`p`,80)(11,`span`,81),J(12,`Fix`),z(),J(13),z()()),e&2){let e=t.$implicit;j(2),M(`data-tone`,e.severity),j(),Y(e.severity),j(2),Y(e.rule),j(2),Y_(``,e.pipe,` · `,e.file,`:`,e.line),j(2),Y(e.message),j(4),X(` `,e.fix)}}function Dz(e,t){if(e&1&&(R(0,`ul`,25),F(1,Ez,14,8,`li`,74,wg),z()),e&2){let e=K();j(),I(e.lint())}}var Oz=5e3,kz=[{value:`all`,label:`All pipes`},{value:`custom`,label:`Custom`},{value:`builtin`,label:`Built-in`},{value:`impure`,label:`Impure`},{value:`live`,label:`On the page`}],Az=class e{destroyRef=E(ws);host=E(Nl);rpc=$(null);kindOptions=kz;pipes=A([]);filter=A(``);kind=A(`all`);loading=A(!1);loadFailed=A(!1);selected=A(null);live=A([]);async=A([]);lint=A(null);lintFailed=A(!1);instrumentedPages=A([]);instrumenting=Q(()=>this.instrumentedPages().length>0);pendingRecord=A(null);recordMessage=A(null);recordLabel=Q(()=>{let e=this.pendingRecord();return e===null?this.instrumenting()?`Stop recording`:`Record calls`:e?`Starting…`:`Stopping…`});pendingTimer;liveByName=Q(()=>new Map(this.live().map(e=>[e.name,e])));filtered=Q(()=>{let e=this.filter().trim().toLowerCase(),t=this.kind()??`all`,n=this.liveByName();return this.pipes().filter(r=>t===`custom`&&r.builtin||t===`builtin`&&!r.builtin||t===`impure`&&r.isPure||t===`live`&&!n.has(r.name)?!1:!e||r.name.toLowerCase().includes(e)||r.className.toLowerCase().includes(e)||r.file.toLowerCase().includes(e))});unsubscribe;constructor(){dc(()=>{let e=this.rpc();e&&(this.refresh(),this.loadLive(e))}),this.destroyRef.onDestroy(()=>{this.unsubscribe?.(),clearTimeout(this.pendingTimer),this.highlight(null)})}async refresh(){let e=this.rpc();if(e){this.loading.set(!0),this.loadFailed.set(!1);try{let t=await e.scope(`ng-devtools`).rpc.call(`get-pipes`);this.pipes.set(t);let n=this.selected();if(n){let e=t.find(e=>e.name===n.name&&e.file===n.file);this.selected.set(e??null)}}catch{this.loadFailed.set(!0)}finally{this.loading.set(!1)}this.loadLint(e)}}async loadLint(e){this.lintFailed.set(!1);try{let t=await e.scope(`ng-devtools`).rpc.call(`pipe-lint`);this.lint.set(t)}catch{this.lintFailed.set(!0)}}async loadLive(e){try{let t=await e.scope(`ng-devtools`).rpc.sharedState(`pipe-usage`);if(this.destroyRef.destroyed)return;let n=e=>{let t=e;this.live.set(t?.pipes??[]),this.async.set(t?.async??[]);let n=t?.instrumented??[];this.instrumentedPages.set(n),this.pendingRecord()===n.length>0&&this.settleRecord(null)};n(t.value()),this.unsubscribe?.(),this.unsubscribe=t.on(`updated`,n)}catch{}}async toggleInstrument(){let e=this.rpc();if(!e||this.pendingRecord()!==null)return;let t=!this.instrumenting();this.recordMessage.set(null),this.pendingRecord.set(t);let n;try{n=await e.scope(`ng-devtools`).rpc.call(`request-instrument-pipes`,t)}catch{this.settleRecord(`Couldn't reach the devtools server. Try again.`);return}if(this.pendingRecord()===t){if(n?.pages===0){this.settleRecord(`No page is connected. Open your app in the browser with the devtools running, then record again.`);return}clearTimeout(this.pendingTimer),this.pendingTimer=setTimeout(()=>{this.pendingRecord()===t&&this.settleRecord(t?`No page confirmed recording. Reload the app and try again.`:`No page confirmed it stopped recording. Reload the app to stop it.`)},Oz)}}settleRecord(e){clearTimeout(this.pendingTimer),this.pendingRecord.set(null),e!==null&&this.recordMessage.set(e)}liveFor(e){return this.liveByName().get(e)}describe(e){if(Array.isArray(e))return e.map(e=>this.describe(e)).join(`, `);if(typeof e==`string`)return e.length>80?`${e.slice(0,80)}…`:e;try{let t=JSON.stringify(e);return t&&t.length>120?`${t.slice(0,120)}…`:t??String(e)}catch{return String(e)}}isSelected(e){let t=this.selected();return t!==null&&t.name===e.name&&t.file===e.file}select(e){this.selected.set(this.isSelected(e)?null:e)}clearFilters(){this.filter.set(``),this.kind.set(`all`)}highlightPipe(e){this.highlight(e?.components.find(e=>e.targets?.length)?.targets?.[0])}highlight(e,t=!1){let n=this.rpc();n&&n.scope(`ng-devtools`).rpc.call(`request-page-highlight`,e?{...e,...t?{reveal:t}:{}}:null).catch(()=>{})}onListKey(e){if(![`ArrowDown`,`ArrowUp`,`Home`,`End`].includes(e.key))return;let t=Array.from(this.host.nativeElement.querySelectorAll(`[data-pipe-row]`));if(!t.length)return;let n=t.indexOf(document.activeElement),r=n;r=e.key===`ArrowDown`?Math.min(n+1,t.length-1):e.key===`ArrowUp`?Math.max(n-1,0):e.key===`Home`?0:t.length-1,e.preventDefault(),t[r]?.focus()}static ɵfac=function(t){return new(t||e)};static ɵcmp=Vh({type:e,selectors:[[`app-pipes-inspector`]],inputs:{rpc:[1,`rpc`]},decls:32,vars:18,consts:[[1,`intro`],[1,`toolbar`],[1,`search`],[`viewBox`,`0 0 24 24`,`aria-hidden`,`true`,1,`search-icon`],[`cx`,`11`,`cy`,`11`,`r`,`7`],[`d`,`m20 20-3.5-3.5`],[`type`,`search`,`placeholder`,`Find a pipe, class or file…`,`aria-label`,`Find a pipe, class or file`,`autocomplete`,`off`,`spellcheck`,`false`,3,`input`,`keydown.escape`,`value`],[`ariaLabel`,`Show pipes`,3,`valueChange`,`options`,`value`],[`aria-live`,`polite`,1,`total`],[1,`actions`],[`type`,`button`,3,`click`,`disabled`],[`type`,`button`,1,`record`,3,`click`],[`aria-hidden`,`true`,1,`rec-dot`],[`role`,`status`,1,`notice`],[`role`,`status`,1,`state`],[`role`,`alert`,1,`state`],[1,`state`],[1,`layout`],[`aria-labelledby`,`async-title`,1,`section`],[`aria-labelledby`,`lint-title`,1,`section`],[`id`,`lint-title`],[1,`pill`],[`role`,`alert`,1,`empty-line`],[`role`,`status`,1,`empty-line`],[1,`empty-line`,`ok`],[1,`findings`],[`viewBox`,`0 0 24 24`,`aria-hidden`,`true`],[`cx`,`12`,`cy`,`12`,`r`,`9`],[`d`,`M12 11v5M12 8h.01`],[`aria-hidden`,`true`,1,`spinner`],[1,`state-title`],[1,`state-hint`],[`type`,`button`,3,`click`],[1,`list-wrap`],[`aria-label`,`Pipes`,1,`pipe-list`],[`role`,`status`,1,`state`,`compact`],[`id`,`pipe-detail`,`aria-labelledby`,`pipe-detail-title`,1,`detail`],[`aria-label`,`Pipes`,1,`pipe-list`,3,`keydown`],[`type`,`button`,`data-pipe-row`,``,`aria-controls`,`pipe-detail`,1,`row`,3,`click`,`mouseenter`,`mouseleave`,`focus`,`blur`],[1,`row-main`],[1,`name`,`mono`],[1,`sub`,`mono`],[1,`row-meta`],[1,`chip`,`warn`],[1,`chip`,`live`],[1,`chip`],[1,`row-file`,`mono`],[1,`more`],[1,`detail-head`],[`id`,`pipe-detail-title`,1,`mono`],[1,`block`],[1,`mono`],[1,`empty-line`],[1,`sites`],[`role`,`note`,1,`warning`],[1,`chips`],[1,`hint`],[`type`,`button`,1,`component`],[1,`component`],[`type`,`button`,1,`component`,3,`click`,`mouseenter`,`mouseleave`,`focus`,`blur`],[1,`count`],[1,`mono`,`value`],[1,`calls`],[1,`muted`],[`id`,`pipe-detail-title`,1,`visually-hidden`],[1,`state`,`compact`],[`id`,`async-title`],[1,`async-list`],[1,`async-row`],[1,`async-row`,3,`mouseenter`,`mouseleave`],[`type`,`button`,1,`component-name`,`mono`],[1,`mono`,`component-name`],[1,`mono`,`value`,`latest`],[`type`,`button`,1,`component-name`,`mono`,3,`click`,`focus`,`blur`],[1,`finding`],[1,`finding-head`],[1,`severity`],[1,`mono`,`rule`],[1,`where`,`mono`],[1,`finding-message`],[1,`finding-fix`],[1,`fix-label`]],template:function(e,t){if(e&1&&(R(0,`p`,0),J(1,` Pipes declared in your source and the built-in pipes your templates use. Live data shows which components use each pipe on the page; turn on recording to capture calls and the last input and output. `),z(),R(2,`div`,1)(3,`div`,2),ps(),R(4,`svg`,3),B(5,`circle`,4)(6,`path`,5),z(),ms(),R(7,`input`,6),G(`input`,function(e){return t.filter.set(e.target.value)})(`keydown.escape`,function(){return t.filter.set(``)}),z()(),R(8,`app-select`,7),ev(`valueChange`,function(e){return $_(t.kind,e)||(t.kind=e),e}),z(),R(9,`span`,8),J(10),z(),R(11,`div`,9)(12,`button`,10),G(`click`,function(){return t.refresh()}),J(13,`Refresh`),z(),R(14,`button`,11),G(`click`,function(){return t.toggleInstrument()}),B(15,`span`,12),J(16),z()()(),N(17,FR,6,1,`p`,13),N(18,IR,8,1,`p`,13),N(19,LR,4,0,`div`,14)(20,RR,7,0,`div`,15)(21,zR,5,0,`div`,16)(22,mz,7,2,`div`,17),N(23,xz,16,1,`section`,18),R(24,`section`,19)(25,`h2`,20),J(26,` Lint `),N(27,Sz,2,1,`span`,21),z(),N(28,Cz,2,0,`p`,22)(29,wz,2,0,`p`,23)(30,Tz,2,0,`p`,24)(31,Dz,3,0,`ul`,25),z()),e&2){let e,n;j(7),L(`value`,t.filter()),j(),L(`options`,t.kindOptions),Q_(`value`,t.kind),j(2),Z(``,t.filtered().length,` of `,t.pipes().length),j(2),L(`disabled`,t.loading()),j(2),q(`on`,t.instrumenting()),M(`aria-pressed`,t.instrumenting())(`aria-busy`,t.pendingRecord()!==null)(`aria-disabled`,t.pendingRecord()!==null),j(2),X(` `,t.recordLabel(),` `),j(),P((e=t.recordMessage())?17:-1,e),j(),P(t.instrumenting()?18:-1),j(),P(t.loading()&&t.pipes().length===0?19:t.loadFailed()&&t.pipes().length===0?20:t.pipes().length===0?21:22),j(4),P(t.async().length>0?23:-1),j(4),P((n=t.lint())?27:-1,n),j(),P(t.lintFailed()?28:t.lint()===null?29:t.lint().length?31:30)}},dependencies:[oD],styles:[`[_nghost-%COMP%] {
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
}`]})},jz=()=>[],Mz=()=>[`/`],Nz=(e,t)=>t.id,Pz=(e,t)=>t.route.id,Fz=(e,t)=>t[0],Iz=(e,t)=>t.file+t.method,Lz=(e,t)=>t.path,Rz=(e,t)=>t.mode,zz=(e,t)=>t.file,Bz=(e,t)=>t.rule;function Vz(e,t){e&1&&(R(0,`div`,0),B(1,`span`,2),R(2,`span`),J(3,`Reading the project…`),z()())}function Hz(e,t){e&1&&(R(0,`div`,1)(1,`h2`,3),J(2,`This app is not an Analog app.`),z(),R(3,`p`,4),J(4,` Add `),R(5,`code`),J(6,`ngDevtools()`),z(),J(7,` from `),R(8,`code`),J(9,`@santoshyadavdev/ng-devtools/vite`),z(),J(10,` next to `),R(11,`code`),J(12,`analog()`),z(),J(13,` in vite.config.ts and run the Analog dev server. `),z()())}function Uz(e,t){if(e&1&&(R(0,`div`,9)(1,`span`,7),J(2,`Open in the browser`),z(),R(3,`span`,13),J(4),z()()),e&2){let e=t;j(3),L(`title`,e.url),j(),Y(e.url)}}function Wz(e,t){if(e&1){let e=W();R(0,`button`,14),G(`click`,function(){let t=O(e).$implicit;return k(K(2).view.set(t.id))}),J(1),R(2,`span`,15),J(3),z()()}if(e&2){let e=t.$implicit,n=K(2);L(`id`,`analog-tab-`+e.id),M(`aria-selected`,e.id===n.view())(`aria-controls`,`analog-panel-`+e.id)(`tabindex`,e.id===n.view()?0:-1),j(),X(` `,e.label,` `),j(),M(`data-tone`,e.tone),j(),Y(e.count)}}function Gz(e,t){e&1&&(R(0,`div`,24),J(1),z()),e&2&&(j(),Y(t))}function Kz(e,t){if(e&1&&(R(0,`li`)(1,`span`,29),J(2),z(),R(3,`span`,32),J(4),z()()),e&2){let e=t.$implicit,n=K(5);j(2),Y(n.short(e.file)??e.fullPath),j(),M(`data-kind`,e.kind),j(),Y(e.kind)}}function qz(e,t){if(e&1&&(R(0,`span`,33),J(1),z()),e&2){let e=t.$implicit;j(),Z(``,e[0],` = `,e[1])}}function Jz(e,t){if(e&1&&(R(0,`div`,31),F(1,qz,2,2,`span`,33,Fz),z()),e&2){let e=K(2),t=K(3);j(),I(t.paramList(e.match.params))}}function Yz(e,t){if(e&1&&(R(0,`strong`,29),J(1),z(),J(2,` renders `),R(3,`ol`,30),F(4,Kz,5,3,`li`,null,Nz),z(),N(6,Jz,3,0,`div`,31)),e&2){let e=K(),t=K(3);j(),Y(e.url),j(3),I(e.match.chain),j(2),P(t.paramList(e.match.params).length?6:-1)}}function Xz(e,t){if(e&1&&(R(0,`li`)(1,`span`,29),J(2),z(),R(3,`span`,4),J(4),z()()),e&2){let e=t.$implicit,n=K(6);j(2),Y(n.short(e.file)??e.path),j(2),Y(e.reason)}}function Zz(e,t){if(e&1&&(R(0,`ul`,34),F(1,Xz,5,2,`li`,null,wg),z()),e&2){let e=K(2);j(),I(e.match.rejected.slice(0,5))}}function Qz(e,t){if(e&1&&(R(0,`strong`,29),J(1),z(),J(2,` matches no file route. Angular throws NG04002 "Cannot match any routes". `),N(3,Zz,3,0,`ul`,34)),e&2){let e=K();j(),Y(e.url),j(2),P(e.match.rejected.length?3:-1)}}function $z(e,t){if(e&1&&(R(0,`div`,25),N(1,Yz,7,2)(2,Qz,4,2),z()),e&2){let e=t;M(`data-tone`,e.match.matched?`good`:`bad`),j(),P(e.match.matched?1:2)}}function eB(e,t){e&1&&(R(0,`span`,36),J(1,`└`),z())}function tB(e,t){e&1&&(R(0,`span`,38),J(1,`open`),z())}function nB(e,t){if(e&1&&(R(0,`span`,39)(1,`span`,43),J(2),z(),J(3),z()),e&2){let e=K().$implicit,t=K(3);j(2),Y(t.dir(e.route.file)),j(),Y(t.base(e.route.file))}}function rB(e,t){e&1&&(R(0,`span`,4),J(1,`folder only`),z())}function iB(e,t){if(e&1&&(R(0,`span`,41),J(1),z()),e&2){let e=t.$implicit;j(),X(``,e,`()`)}}function aB(e,t){if(e&1&&(R(0,`span`,42),J(1),z()),e&2){let e=K().$implicit;j(),X(`"`,e.route.title,`"`)}}function oB(e,t){if(e&1&&(R(0,`span`,33),J(1),z()),e&2){let e=K().$implicit;j(),Y(e)}}function sB(e,t){if(e&1&&N(0,oB,2,1,`span`,33),e&2){let e=t.$implicit;P(e===`title`?-1:0)}}function cB(e,t){if(e&1&&(R(0,`tr`)(1,`td`)(2,`div`,35),N(3,eB,2,0,`span`,36),R(4,`span`,37),J(5),z(),R(6,`span`,32),J(7),z(),N(8,tB,2,0,`span`,38),z()(),R(9,`td`),N(10,nB,4,2,`span`,39)(11,rB,2,0,`span`,4),z(),R(12,`td`)(13,`div`,40),F(14,iB,2,1,`span`,41,Tg),z()(),R(16,`td`),N(17,aB,2,1,`span`,42),F(18,sB,1,1,null,null,Tg),z()()),e&2){let e=t.$implicit,n=K(3);q(`open`,n.isOpen(e.route))(`dim`,e.route.kind===`group`||e.route.kind===`implicit`),j(2),C_(`padding-left`,e.depth*16,`px`),j(),P(e.depth?3:-1),j(2),Y(e.route.fullPath),j(),M(`data-kind`,e.route.kind),j(),Y(n.kindText(e.route)),j(),P(n.isOpen(e.route)?8:-1),j(2),P(e.route.file?10:11),j(4),I(n.serverExports(e.route)),j(3),P(e.route.title?17:-1),j(),I(e.route.routeMeta??ov(13,jz))}}function lB(e,t){e&1&&J(0,` No route matches the filter. Try part of a path or a file name. `)}function uB(e,t){e&1&&J(0,` No file routes yet. Add a .page.ts file under src/app/pages. `)}function dB(e,t){if(e&1&&(R(0,`tr`)(1,`td`,44),N(2,lB,1,0)(3,uB,1,0),z()()),e&2){let e=K(3);j(2),P(e.filter().trim()?2:3)}}function fB(e,t){if(e&1){let e=W();R(0,`div`,16)(1,`form`,17),G(`submit`,function(t){O(e);let n=K(2);return t.preventDefault(),k(n.explain())}),R(2,`label`,18),J(3,`Test a URL`),z(),R(4,`input`,19),G(`input`,function(t){return O(e),k(K(2).testUrl.set(t.target.value))}),z(),R(5,`button`,20),J(6),z()(),R(7,`label`,21),J(8,`Filter routes`),z(),R(9,`input`,22),G(`input`,function(t){return O(e),k(K(2).filter.set(t.target.value))}),z()(),R(10,`div`,23),N(11,Gz,2,1,`div`,24)(12,$z,3,2,`div`,25),z(),R(13,`div`,26)(14,`table`)(15,`thead`)(16,`tr`)(17,`th`,27),J(18,`Route`),z(),R(19,`th`,27),J(20,`File`),z(),R(21,`th`,27),J(22,`Data`),z(),R(23,`th`,27),J(24,`Route meta`),z()()(),R(25,`tbody`),F(26,cB,20,14,`tr`,28,Pz,!1,dB,4,1,`tr`),z()()()}if(e&2){let e,t=K(2);j(4),L(`value`,t.testUrl()),j(),L(`disabled`,t.explaining()),j(),X(` `,t.explaining()?`Explaining…`:`Explain`,` `),j(3),L(`value`,t.filter()),j(2),P((e=t.explainError())?11:(e=t.explained())?12:-1,e),j(15),I(t.routeRows())}}function pB(e,t){if(e&1&&(R(0,`span`,29),J(1),z(),J(2)),e&2){let e=t.$implicit,n=t.$index,r=t.$count;j(),Y(e),j(),X(``,n===r-1?``:`, `,` `)}}function mB(e,t){if(e&1&&(R(0,`div`,45)(1,`strong`),J(2,`load() ran twice`),z(),J(3,` for `),F(4,pB,3,2,null,null,Tg),J(6,` : once while server rendering, again in the browser. TransferState did not serve the server result. `),z()),e&2){let e=K(3);j(4),I(e.duplicates())}}function hB(e,t){if(e&1&&(R(0,`span`,29),J(1),z(),J(2)),e&2){let e=t.$implicit,n=t.$index,r=t.$count;j(),Y(e),j(),X(``,n===r-1?``:`, `,` `)}}function gB(e,t){if(e&1&&(R(0,`div`,45)(1,`strong`),J(2,`Server function read ran twice`),z(),J(3,`: `),F(4,hB,3,2,null,null,Tg),J(6,` ran while server rendering, then again in the browser. The browser did not use the TransferState seed. `),z()),e&2){let e=K(3);j(4),I(e.refetchedFns())}}function _B(e,t){if(e&1){let e=W();R(0,`label`)(1,`input`,63),G(`change`,function(){let t=O(e).$implicit;return k(K(3).kind.set(t))}),z(),J(2),R(3,`span`,4),J(4),z()()}if(e&2){let e=t.$implicit,n=K(3);q(`on`,n.kind()===e),j(),L(`checked`,n.kind()===e),j(),X(` `,n.kindLabel(e),` `),j(2),Y(n.kindCount(e))}}function vB(e,t){if(e&1&&(R(0,`strong`,68),J(1),z(),R(2,`span`,71),J(3),z()),e&2){let e=t,n=K(5);j(),Y(e.name),j(2),Y(n.short(e.file))}}function yB(e,t){if(e&1&&(R(0,`span`,68),J(1),z()),e&2){let e=K().$implicit;j(),Y(e.url)}}function bB(e,t){e&1&&(R(0,`span`,32),J(1,`ran during server rendering`),z())}function xB(e,t){if(e&1&&J(0),e&2){let e=K(2).$implicit;X(` to `,e.location,` `)}}function SB(e,t){if(e&1&&(R(0,`span`,32),J(1),N(2,xB,1,1),z()),e&2){let e=K().$implicit,t=K(4);M(`data-tone`,t.outcomeTone(e.outcome)),j(),X(``,t.outcomeLabel(e.outcome),` `),j(),P(e.location?2:-1)}}function CB(e,t){if(e&1&&(R(0,`span`,32),J(1),z()),e&2){let e=K().$implicit;M(`data-mode`,e.render===`ssr`?`ssr`:`client`),j(),Y(e.render===`ssr`?`server rendered`:`client only`)}}function wB(e,t){if(e&1&&(R(0,`details`)(1,`summary`),J(2,`Response`),z(),R(3,`pre`,72),J(4),z()()),e&2){let e=K().$implicit,t=K(4);j(4),Y(t.pretty(e.preview))}}function TB(e,t){e&1&&(R(0,`span`,4),J(1,`in process`),z())}function EB(e,t){if(e&1&&J(0),e&2){let e=K().$implicit;X(` `,e.ms,` ms `)}}function DB(e,t){if(e&1&&(R(0,`tr`)(1,`td`,65),J(2),z(),R(3,`td`)(4,`span`,32),J(5),z()(),R(6,`td`,66)(7,`div`,40)(8,`span`,67),J(9),z(),N(10,vB,4,2)(11,yB,2,1,`span`,68),N(12,bB,2,0,`span`,32),N(13,SB,3,3,`span`,32),N(14,CB,2,2,`span`,32),z(),N(15,wB,5,1,`details`),z(),R(16,`td`)(17,`span`,69),J(18),z()(),R(19,`td`,70),N(20,TB,2,0,`span`,4)(21,EB,1,1),z(),R(22,`td`,4),J(23),z()()),e&2){let e,n=t.$implicit,r=K(4);j(2),Y(r.time(n.at)),j(2),M(`data-call`,n.kind),j(),Y(r.kindLabel(n.kind)),j(3),M(`data-method`,n.method),j(),Y(n.method),j(),P((e=r.fnOf(n))?10:11,e),j(2),P(n.seeded?12:-1),j(),P(n.outcome?13:-1),j(),P(n.render?14:-1),j(),P(n.preview?15:-1),j(2),M(`data-status`,r.statusClass(n.status)),j(),Y(n.status),j(2),P(n.seeded?20:21),j(3),Y(n.from)}}function OB(e,t){if(e&1&&(R(0,`div`,51)(1,`table`)(2,`thead`)(3,`tr`)(4,`th`,27),J(5,`At`),z(),R(6,`th`,27),J(7,`Kind`),z(),R(8,`th`,27),J(9,`Request`),z(),R(10,`th`,27),J(11,`Status`),z(),R(12,`th`,64),J(13,`Duration`),z(),R(14,`th`,27),J(15,`From`),z()()(),R(16,`tbody`),F(17,DB,24,14,`tr`,null,Nz),z()()()),e&2){let e=K(3);j(17),I(e.calls())}}function kB(e,t){e&1&&J(0,` No calls of this kind yet. `)}function AB(e,t){e&1&&J(0,` No calls yet. `)}function jB(e,t){if(e&1&&(R(0,`div`,52)(1,`p`,73),N(2,kB,1,0)(3,AB,1,0),z(),R(4,`p`,4),J(5,` Navigate in the app to see page renders, load() fetches, form actions, server functions and API calls. `),z()()),e&2){let e=K(3);j(2),P(e.allCalls().length?2:3)}}function MB(e,t){if(e&1){let e=W();R(0,`tr`)(1,`td`)(2,`span`,67),J(3),z()(),R(4,`td`,29),J(5),z(),R(6,`td`)(7,`span`,39)(8,`span`,43),J(9),z(),J(10),z()(),R(11,`td`,74)(12,`button`,75),G(`click`,function(){let t=O(e).$implicit;return k(K(3).tryApi(t))}),J(13,` Try `),z()()()}if(e&2){let e=t.$implicit,n=K(3);j(2),M(`data-method`,e.method),j(),Y(e.method),j(2),Y(e.path),j(4),Y(n.dir(e.file)),j(),Y(n.base(e.file)),j(2),M(`aria-label`,`Try `+e.method+` `+e.path)}}function NB(e,t){e&1&&(R(0,`tr`)(1,`td`,44),J(2,` No API routes. Add a handler under src/server/routes to test it here. `),z()())}function PB(e,t){if(e&1&&(R(0,`tr`)(1,`td`)(2,`span`,67),J(3),z()(),R(4,`td`,29),J(5),z(),R(6,`td`)(7,`span`,39)(8,`span`,43),J(9),z(),J(10),z()(),R(11,`td`,77),J(12),z()()),e&2){let e=t.$implicit,n=K(4);j(2),M(`data-method`,e.method),j(),Y(e.method),j(2),Y(e.name),j(4),Y(n.dir(e.file)),j(),Y(n.base(e.file)),j(2),Y(n.fnCalls(e.id))}}function FB(e,t){if(e&1&&(R(0,`h2`),J(1,`Server functions`),z(),R(2,`div`,76)(3,`table`)(4,`thead`)(5,`tr`)(6,`th`,27),J(7,`Method`),z(),R(8,`th`,27),J(9,`Name`),z(),R(10,`th`,27),J(11,`File`),z(),R(12,`th`,64),J(13,`Calls`),z()()(),R(14,`tbody`),F(15,PB,13,6,`tr`,null,Nz),z()()()),e&2){let e=K(3);j(15),I(e.serverFns())}}function IB(e,t){if(e&1&&(R(0,`p`,59),J(1),z()),e&2){let e=K(3);j(),Y(e.callsOff)}}function LB(e,t){if(e&1&&(R(0,`p`,60),J(1),z()),e&2){let e=K(3);j(),X(` Tick "This request can change data on the dev server" below to send a `,e.method(),` request. `)}}function RB(e,t){if(e&1){let e=W();R(0,`label`,78),J(1,`JSON body`),z(),R(2,`textarea`,79),G(`input`,function(t){return O(e),k(K(3).apiBody.set(t.target.value))}),z(),R(3,`label`,80)(4,`input`,81),G(`change`,function(){O(e);let t=K(3);return k(t.confirmSend.set(!t.confirmSend()))}),z(),J(5,` This request can change data on the dev server`),z()}if(e&2){let e=K(3);j(2),L(`value`,e.apiBody()),j(2),L(`checked`,e.confirmSend())}}function zB(e,t){if(e&1&&(R(0,`p`,61),J(1),z()),e&2){let e=K(3);j(),Z(`Sending `,e.method(),` `,e.apiPath().trim(),`…`)}}function BB(e,t){if(e&1&&(R(0,`div`,55)(1,`span`,82),J(2,`Refused`),z(),R(3,`span`),J(4),z()()),e&2){let e=K();j(4),Y(e.error)}}function VB(e,t){if(e&1&&(R(0,`div`,55)(1,`span`,69),J(2),z(),R(3,`span`,4),J(4),z()(),R(5,`pre`,72),J(6),z()),e&2){let e=K(),t=K(3);j(),M(`data-status`,t.statusClass(e.status??0)),j(),Y(e.status),j(2),Z(``,e.ms,` ms · `,e.type||`no content type`),j(2),Y(t.pretty(e.body??``))}}function HB(e,t){e&1&&(R(0,`div`,62),N(1,BB,5,1,`div`,55)(2,VB,7,5),z()),e&2&&(j(),P(t.error?1:2))}function UB(e,t){if(e&1){let e=W();N(0,mB,7,0,`div`,45),N(1,gB,7,0,`div`,45),R(2,`div`,46)(3,`fieldset`,47)(4,`legend`,48),J(5,`Show calls of kind`),z(),F(6,_B,5,5,`label`,49,Tg),z(),R(8,`button`,50),G(`click`,function(){return O(e),k(K(2).clearCalls())}),J(9,` Clear calls `),z()(),N(10,OB,19,0,`div`,51)(11,jB,6,1,`div`,52),R(12,`h2`),J(13,`API routes`),z(),R(14,`div`,53)(15,`table`)(16,`thead`)(17,`tr`)(18,`th`,27),J(19,`Method`),z(),R(20,`th`,27),J(21,`Path`),z(),R(22,`th`,27),J(23,`File`),z(),R(24,`th`,27)(25,`span`,48),J(26,`Actions`),z()()()(),R(27,`tbody`),F(28,MB,14,6,`tr`,null,Iz,!1,NB,3,0,`tr`),z()()(),N(31,FB,17,0),R(32,`form`,54),G(`submit`,function(t){O(e);let n=K(2);return t.preventDefault(),k(n.send())}),R(33,`h2`),J(34,`Request playground`),z(),R(35,`div`,55)(36,`app-select`,56),G(`valueChange`,function(t){return O(e),k(K(2).method.set(t??`GET`))}),z(),R(37,`label`,57),J(38,`Path`),z(),R(39,`input`,58),G(`input`,function(t){return O(e),k(K(2).apiPath.set(t.target.value))}),z(),R(40,`button`,20),J(41),z()(),N(42,IB,2,1,`p`,59)(43,LB,2,1,`p`,60),N(44,RB,6,2),N(45,zB,2,2,`p`,61)(46,HB,3,1,`div`,62),z()}if(e&2){let e,t=K(2);P(t.duplicates().length?0:-1),j(),P(t.refetchedFns().length?1:-1),j(5),I(t.kinds),j(2),L(`disabled`,!t.allCalls().length),j(2),P(t.calls().length?10:11),j(18),I(t.project().api),j(3),P(t.serverFns().length?31:-1),j(5),L(`options`,t.methodOptions)(`value`,t.method()),j(3),L(`value`,t.apiPath()),j(),L(`disabled`,!t.canSend()),M(`aria-describedby`,t.sendHintId()),j(),X(` `,t.sending()?`Sending…`:`Send`,` `),j(),P(t.canCall()?t.needsConfirm()?43:-1:42),j(2),P(t.method()===`GET`?-1:44),j(),P(t.sending()?45:(e=t.response())?46:-1,e)}}function WB(e,t){if(e&1&&(R(0,`span`,32),J(1),z()),e&2){let e=t.$implicit;M(`data-mode`,e.mode),j(),Z(``,e.label,` · `,e.count)}}function GB(e,t){if(e&1&&(R(0,`div`,31),F(1,WB,2,3,`span`,32,Rz),z()),e&2){let e=K(3);j(),I(e.modeCounts())}}function KB(e,t){e&1&&(R(0,`span`,87),J(1,`differs from config`),z())}function qB(e,t){if(e&1&&(R(0,`div`,40)(1,`span`,69),J(2),z(),R(3,`span`,86),J(4),z(),N(5,KB,2,0,`span`,87),z()),e&2){let e=t,n=K().$implicit,r=K(3);j(),M(`data-status`,r.statusClass(e.status)),j(),Y(e.status),j(2),Z(``,e.render===`client`?`client only`:`server rendered`,` · `,e.ms,` ms`),j(),P(r.mismatch(n)?5:-1)}}function JB(e,t){e&1&&(R(0,`span`,85),J(1,`not requested yet`),z())}function YB(e,t){if(e&1&&(R(0,`span`,39)(1,`span`,43),J(2),z(),J(3),z()),e&2){let e=K().$implicit,t=K(3);j(2),Y(t.dir(e.file)),j(),Y(t.base(e.file))}}function XB(e,t){if(e&1&&(R(0,`tr`)(1,`td`,37),J(2),z(),R(3,`td`)(4,`div`,40)(5,`span`,32),J(6),z(),R(7,`span`,85),J(8),z()()(),R(9,`td`),N(10,qB,6,5,`div`,40)(11,JB,2,0,`span`,85),z(),R(12,`td`),N(13,YB,4,2,`span`,39),z()()),e&2){let e,n=t.$implicit,r=K(3);j(2),Y(n.path),j(3),M(`data-mode`,n.mode),j(),Y(r.modeLabel(n.mode)),j(2),Y(n.reason),j(2),P((e=n.last)?10:11,e),j(3),P(n.file?13:-1)}}function ZB(e,t){e&1&&(R(0,`tr`)(1,`td`,44),J(2,` No page routes to render yet. Add a .page.ts file under src/app/pages. `),z()())}function QB(e,t){e&1&&(R(0,`p`,4),J(1,` prerender.routes is a function, so the list is known only at build time. `),z())}function $B(e,t){if(e&1&&(R(0,`span`,33),J(1),z()),e&2){let e=t.$implicit;j(),Y(e)}}function eV(e,t){e&1&&(R(0,`span`,85),J(1,`default, nothing configured`),z())}function tV(e,t){if(e&1&&(R(0,`span`,33),J(1),z()),e&2){let e=t.$implicit;j(),Y(e)}}function nV(e,t){if(e&1&&(R(0,`dt`),J(1,`From routeRules`),z(),R(2,`dd`),F(3,tV,2,1,`span`,33,Tg),z()),e&2){let e=K(2);j(3),I(e.fromRules)}}function rV(e,t){if(e&1&&(R(0,`span`,90),J(1),z()),e&2){let e=t.$implicit;j(),Y(e)}}function iV(e,t){if(e&1&&(R(0,`dt`),J(1,`Static, not listed`),z(),R(2,`dd`),F(3,rV,2,1,`span`,90,Tg),z()),e&2){let e=K(2);j(3),I(e.staticMissing)}}function aV(e,t){if(e&1&&(R(0,`span`,33),J(1),z()),e&2){let e=t.$implicit;j(),Y(e)}}function oV(e,t){if(e&1&&(R(0,`dt`),J(1,`Need explicit entries`),z(),R(2,`dd`),F(3,aV,2,1,`span`,33,Tg),z()),e&2){let e=K(2);j(3),I(e.dynamic)}}function sV(e,t){if(e&1&&(R(0,`span`,91),J(1),z()),e&2){let e=t.$implicit;j(),Y(e)}}function cV(e,t){if(e&1&&(J(0,` · missing `),F(1,sV,2,1,`span`,91,Tg)),e&2){let e=K(3);j(),I(e.notBuilt)}}function lV(e,t){if(e&1&&(J(0),N(1,cV,3,0)),e&2){let e=K(2);X(` `,e.built.length,` page(s) in dist/analog/public `),j(),P(e.notBuilt.length?1:-1)}}function uV(e,t){e&1&&(R(0,`span`,85),J(1,`no build yet`),z())}function dV(e,t){if(e&1&&(R(0,`dl`,88)(1,`dt`),J(2,`Listed`),z(),R(3,`dd`),F(4,$B,2,1,`span`,33,Tg),N(6,eV,2,0,`span`,85),z(),N(7,nV,5,0),N(8,iV,5,0),N(9,oV,5,0),R(10,`dt`),J(11,`Build output`),z(),R(12,`dd`,89),N(13,lV,2,2)(14,uV,2,0,`span`,85),z()()),e&2){let e=K();j(4),I(e.listed??ov(5,Mz)),j(2),P(e.listed?-1:6),j(),P(e.fromRules?.length?7:-1),j(),P(e.staticMissing.length?8:-1),j(),P(e.dynamic.length?9:-1),j(4),P(e.built.length?13:14)}}function fV(e,t){e&1&&(R(0,`div`,84)(1,`h2`),J(2,`Prerender plan`),z(),N(3,QB,2,0,`p`,4)(4,dV,15,6,`dl`,88),z()),e&2&&(j(3),P(t.dynamicConfig?3:4))}function pV(e,t){if(e&1&&(N(0,GB,3,0,`div`,31),R(1,`div`,83)(2,`table`)(3,`thead`)(4,`tr`)(5,`th`,27),J(6,`Route`),z(),R(7,`th`,27),J(8,`Configured`),z(),R(9,`th`,27),J(10,`Last request`),z(),R(11,`th`,27),J(12,`File`),z()()(),R(13,`tbody`),F(14,XB,14,6,`tr`,null,Lz,!1,ZB,3,0,`tr`),z()()(),N(17,fV,5,1,`div`,84)),e&2){let e,t=K(2);P(t.modeCounts().length?0:-1),j(14),I(t.renderRows()),j(3),P((e=t.plan())?17:-1,e)}}function mV(e,t){if(e&1&&(R(0,`div`)(1,`span`,94),J(2),z()()),e&2){let e=K().$implicit;j(2),Y(e.error)}}function hV(e,t){if(e&1&&(R(0,`div`)(1,`span`,87),J(2),z()()),e&2){let e=K(5);j(2),X(`takes over `,e.base(t))}}function gV(e,t){if(e&1&&(R(0,`tr`)(1,`td`)(2,`strong`),J(3),z(),N(4,mV,3,1,`div`),N(5,hV,3,1,`div`),z(),R(6,`td`,37),J(7),z(),R(8,`td`,29),J(9),z(),R(10,`td`,93),J(11),z(),R(12,`td`)(13,`span`,39)(14,`span`,43),J(15),z(),J(16),z()()()),e&2){let e,n=t.$implicit,r=K(4);j(3),Y(n.attributes.title||`(no title)`),j(),P(n.error?4:-1),j(),P((e=r.shadowed(n.file))?5:-1,e),j(2),Y(r.contentUrl(n.file)??``),j(2),Y(n.slug),j(2),Y(n.attributes.date||``),j(4),Y(r.dir(n.file)),j(),Y(r.base(n.file))}}function _V(e,t){if(e&1&&(R(0,`div`,92)(1,`table`)(2,`thead`)(3,`tr`)(4,`th`,27),J(5,`Title`),z(),R(6,`th`,27),J(7,`URL`),z(),R(8,`th`,27),J(9,`Slug`),z(),R(10,`th`,27),J(11,`Date`),z(),R(12,`th`,27),J(13,`File`),z()()(),R(14,`tbody`),F(15,gV,17,8,`tr`,null,zz),z()()()),e&2){let e=K(3);j(15),I(e.project().content)}}function vV(e,t){e&1&&(R(0,`div`,52)(1,`p`,73),J(2,`No markdown files under src/content.`),z(),R(3,`p`,4),J(4,` Add a .md file there to see its title, slug, date and the URL it serves. `),z()())}function yV(e,t){e&1&&N(0,_V,17,0,`div`,92)(1,vV,5,0,`div`,52),e&2&&P(+!K(2).project().content.length)}function bV(e,t){if(e&1&&(R(0,`span`,15),J(1),z()),e&2){let e=K().$implicit;j(),Y(e.items.length)}}function xV(e,t){if(e&1&&(R(0,`span`,39)(1,`span`,43),J(2),z(),J(3),z()),e&2){let e=K().$implicit,t=K(5);j(2),Y(t.dir(e.file)),j(),Y(t.base(e.file))}}function SV(e,t){if(e&1&&(R(0,`span`,37),J(1),z()),e&2){let e=K().$implicit;j(),Y(e.path)}}function CV(e,t){if(e&1&&(R(0,`p`,102),J(1),z()),e&2){let e=K().$implicit;j(),Y(e.message)}}function wV(e,t){if(e&1&&(R(0,`li`),N(1,xV,4,2,`span`,39),N(2,SV,2,1,`span`,37),N(3,CV,2,1,`p`,102),z()),e&2){let e=t.$implicit;j(),P(e.file?1:-1),j(),P(e.path&&e.path!==e.file?2:-1),j(),P(e.message?3:-1)}}function TV(e,t){if(e&1&&(R(0,`li`)(1,`div`,97)(2,`span`,32),J(3),z(),R(4,`strong`,98),J(5),z(),N(6,bV,2,1,`span`,15),z(),R(7,`p`),J(8),z(),R(9,`ul`,99),F(10,wV,4,3,`li`,null,wg),z(),R(12,`div`,100)(13,`strong`),J(14,`How to fix`),z(),J(15),z(),R(16,`span`,101),J(17),z()()),e&2){let e=t.$implicit,n=K(4);M(`data-tone`,n.tone(e.severity)),j(2),M(`data-tone`,n.tone(e.severity)),j(),Y(e.severity),j(2),Y(e.title),j(),P(e.items.length>1?6:-1),j(2),Y(e.summary),j(2),I(e.items),j(5),X(` `,e.fix),j(2),Y(e.rule)}}function EV(e,t){if(e&1&&(R(0,`p`,4),J(1),z(),R(2,`ul`,96),F(3,TV,18,8,`li`,null,Bz),z()),e&2){let e=K(3);j(),Z(` `,e.findings().length,` issue(s) in `,e.lintCards().length,` group(s). Each card says what is wrong, where, and how to fix it. `),j(2),I(e.lintCards())}}function DV(e,t){e&1&&(R(0,`div`,95)(1,`strong`),J(2,`No Analog problems found.`),z(),J(3,` Routes, server files, prerender config and content all check out. `),z())}function OV(e,t){e&1&&N(0,EV,5,2)(1,DV,4,0,`div`,95),e&2&&P(+!K(2).findings().length)}function kV(e,t){if(e&1){let e=W();R(0,`section`,5)(1,`div`,6)(2,`span`,7),J(3,`Analog`),z(),R(4,`span`,8),J(5),z()(),R(6,`div`,6)(7,`span`,7),J(8,`Pages`),z(),R(9,`span`,8),J(10),z()(),R(11,`div`,6)(12,`span`,7),J(13,`API routes`),z(),R(14,`span`,8),J(15),z()(),R(16,`div`,6)(17,`span`,7),J(18,`Server calls`),z(),R(19,`span`,8),J(20),z()(),R(21,`div`,6)(22,`span`,7),J(23,`Issues`),z(),R(24,`span`,8),J(25),z()(),N(26,Uz,5,2,`div`,9),z(),R(27,`div`,10),G(`keydown`,function(t){return O(e),k(K().onKey(t))}),F(28,Wz,4,7,`button`,11,Nz),z(),R(30,`div`,12),N(31,fB,29,6)(32,UB,47,15)(33,pV,18,3)(34,yV,2,1)(35,OV,2,1),z()}if(e&2){let e,t,n=K();j(5),Y(n.project().version||`unknown`),j(5),Y(n.pageCount()),j(5),Y(n.project().api.length),j(5),Y(n.allCalls().length),j(),M(`data-tone`,n.findings().length?`warn`:`good`),j(4),Y(n.findings().length),j(),P((e=n.page())?26:-1,e),j(2),I(n.views()),j(2),L(`id`,`analog-panel-`+n.view()),M(`aria-labelledby`,`analog-tab-`+n.view()),j(),P((t=n.view())===`routes`?31:t===`server`?32:t===`render`?33:t===`content`?34:t===`lint`?35:-1)}}var AV={"scan-error":{title:`A folder could not be read`,summary:`Its files are missing from routes, API routes and lint results.`},"duplicate-url":{title:`Two files serve the same URL`,summary:`Only one of them is reachable; the other never renders.`},"sibling-params":{title:`Two dynamic pages in one folder`,summary:`Both are [param] pages at the same level, so the first one always wins.`},"missing-default-export":{title:`Page has no default export`,summary:`Analog needs the component as the default export, so the page renders nothing.`},"redirect-with-component":{title:`Redirect page also exports a component`,summary:`The redirect runs first, so the component never shows.`},"redirect-path-match":{title:`Redirect matches too much`,summary:`An empty-path redirect without pathMatch "full" catches every URL below it.`},"layout-without-outlet":{title:`Layout has no router-outlet`,summary:`The layout has child pages, but without <router-outlet> they never render.`},"server-without-load":{title:`.server.ts without load or action`,summary:`The server file exports no load, action or server function, so Analog calls nothing.`},"orphan-server-file":{title:`.server.ts without a page`,summary:`No page file sits next to it, so its load never runs.`},"api-method-suffix":{title:`Unknown method suffix on an API file`,summary:`The suffix is not an HTTP method, so it becomes part of the URL.`},"duplicate-api-route":{title:`Two handlers for one API route`,summary:`Two files answer the same method and path.`},"api-outside-prefix":{title:`Server route outside the API prefix`,summary:`During vite dev only routes under the prefix reach Nitro.`},"prerender-unknown-route":{title:`Prerender entry matches no page`,summary:`prerender.routes lists a path that no page file serves.`},"prerender-missing-root":{title:`Home page is not prerendered`,summary:`static is on, but prerender.routes leaves out /.`},"content-frontmatter":{title:`Broken frontmatter`,summary:`The markdown frontmatter cannot be read.`},"duplicate-slug":{title:`Two posts share a slug`,summary:`injectContent picks one of them at random.`},"content-shadows-page":{title:`Markdown file takes over a page`,summary:`Files under src/content are routes too, so these URLs render the markdown file instead of the [param] page.`},"load-fetched-twice":{title:`load() runs twice`,summary:`These pages fetched their data while rendering on the server and again in the browser.`},"fn-fetched-twice":{title:`Server function read runs twice`,summary:`These reads ran while rendering on the server and again in the browser right after hydration.`},"restart-needed":{title:`New pages need a restart`,summary:`These page files exist, but the running router does not know them yet.`},"hydration-error":{title:`Hydration error`,summary:`The browser DOM did not match the server HTML.`},"api-not-found":{title:`API call failed with 404 or 405`,summary:`A request hit a path or method that no server route handles.`}},jV=new Set([`missing-default-export`,`redirect-with-component`,`redirect-path-match`,`layout-without-outlet`,`server-without-load`,`orphan-server-file`,`load-fetched-twice`,`restart-needed`,`prerender-missing-root`]),MV={ssr:`SSR`,ssg:`Prerendered`,client:`Client only`,cached:`Cached`,redirect:`Redirect`},NV={all:`All`,page:`Pages`,load:`load()`,action:`Actions`,fn:`Server fn`,api:`API`},PV={success:`succeeded`,redirect:`redirected`,invalid:`validation errors`,error:`failed`},FV={success:`good`,redirect:`info`,invalid:`warn`,error:`bad`};function IV(e,t=0,n=[]){for(let r of e)n.push({route:r,depth:t}),IV(r.children,t+1,n);return n}var LV=class e{rpc=$(null);canCall=Q(()=>oE(this.rpc(),`analog`));callsOff=UT(`analog`);kinds=[`all`,`page`,`load`,`action`,`fn`,`api`];methods=[`GET`,`POST`,`PUT`,`PATCH`,`DELETE`];methodOptions=this.methods.map(e=>({value:e,label:e}));view=A(`routes`);project=A(null);state=A({});findings=A([]);renderRows=A([]);plan=A(null);filter=A(``);testUrl=A(``);explained=A(null);explainError=A(``);explaining=A(!1);kind=A(`all`);method=A(`GET`);apiPath=A(``);apiBody=A(``);confirmSend=A(!1);response=A(null);sending=A(!1);needsConfirm=Q(()=>this.method()!==`GET`&&!this.confirmSend());canSend=Q(()=>this.canCall()&&!this.sending()&&!this.needsConfirm());sendHintId=Q(()=>this.canCall()?this.needsConfirm()?`analog-confirm-hint`:null:`analog-calls-off`);unsubscribe=null;refreshTimer;refreshRun=0;destroyRef=E(ws);page=Q(()=>this.state().pages?.[0]??null);openFiles=Q(()=>new Set((this.page()?.chain??[]).map(e=>e.file)));allCalls=Q(()=>this.state().calls??[]);calls=Q(()=>{let e=this.kind();return this.allCalls().filter(t=>e===`all`||t.kind===e).slice(-150).reverse()});allRoutes=Q(()=>IV(this.project()?.routes??[]));pageCount=Q(()=>this.allRoutes().filter(e=>e.route.file&&e.route.kind!==`layout`).length);routeRows=Q(()=>{let e=this.filter().trim().toLowerCase();return e?this.allRoutes().filter(t=>t.route.fullPath.toLowerCase().includes(e)||!!t.route.file?.toLowerCase().includes(e)):this.allRoutes()});serverFns=Q(()=>this.project()?.serverFns??[]);fnById=Q(()=>new Map(this.serverFns().map(e=>[e.id,e])));refetchedFns=Q(()=>Array.from(new Set((this.state().refetches??[]).map(e=>this.fnById().get(e.id)?.name??e.id))));duplicates=Q(()=>Array.from(new Set((this.state().duplicates??[]).map(e=>e.route))));modeCounts=Q(()=>[`ssr`,`ssg`,`cached`,`client`,`redirect`].map(e=>({mode:e,label:MV[e],count:this.renderRows().filter(t=>t.mode===e).length})).filter(e=>e.count));lintCards=Q(()=>{let e={error:0,warning:1,info:2},t=new Map;for(let e of this.findings()){let n=t.get(e.rule);if(!n){let r=AV[e.rule];n={rule:e.rule,severity:e.severity,title:r?.title??e.rule,summary:r?.summary??e.message,fix:e.fix,items:[]},t.set(e.rule,n)}let r=jV.has(e.rule)||e.message===n.summary?void 0:e.message;n.items.some(t=>t.file===e.file&&t.path===e.path&&t.message===r)||n.items.push({file:e.file,path:e.path,message:r})}return Array.from(t.values()).sort((t,n)=>e[t.severity]-e[n.severity])});views=Q(()=>{let e=this.findings().length;return[{id:`routes`,label:`Routes`,count:this.pageCount(),tone:``},{id:`server`,label:`Server`,count:this.allCalls().length,tone:``},{id:`render`,label:`Render`,count:this.renderRows().length,tone:``},{id:`content`,label:`Content`,count:this.project()?.content.length??0,tone:``},{id:`lint`,label:`Lint`,count:e,tone:e?`warn`:``}]});constructor(){dc(()=>{let e=this.rpc();e&&Cv(()=>void this.load(e))}),dc(()=>{let e=this.view();this.state(),Cv(()=>this.scheduleRefresh(e))}),this.destroyRef.onDestroy(()=>{this.unsubscribe?.(),clearTimeout(this.refreshTimer)})}async load(e){let t=await nE(e,`analog-project`);if(!this.destroyRef.destroyed){this.project.set(t);try{let t=await e.scope(`ng-devtools`).rpc.sharedState(`analog`);if(this.destroyRef.destroyed)return;let n=e=>this.state.set(e??{});n(t.value()),this.unsubscribe?.(),this.unsubscribe=t.on(`updated`,n)}catch{this.state.set({})}this.destroyRef.destroyed||await this.refresh(this.view())}}scheduleRefresh(e){clearTimeout(this.refreshTimer),this.refreshTimer=setTimeout(()=>void this.refresh(e),300)}async refresh(e){let t=this.rpc();if(!t)return;let n=++this.refreshRun,[r,i]=await Promise.all([nE(t,`analog-lint`),nE(t,`analog-render`)]);if(n===this.refreshRun&&(this.findings.set(r??[]),this.renderRows.set(i?.rows??[]),this.plan.set(i?.plan??null),e===`routes`||e===`content`)){let e=await nE(t,`analog-project`);e&&n===this.refreshRun&&this.project.set(e)}}isOpen(e){return!!e.file&&this.openFiles().has(e.file)}kindText(e){return e.catchAll?e.catchAll===`optional`?`optional catch-all`:`catch-all`:e.kind===`implicit`?`folder`:e.kind}serverExports(e){return(e.serverExports??[]).filter(e=>e===`load`||e===`action`)}short(e){return e?.replace(/^\/src\/app\//,``).replace(/^\//,``)}dir(e){let t=this.short(e)??e;return t.includes(`/`)?t.slice(0,t.lastIndexOf(`/`)+1):``}base(e){return e.slice(e.lastIndexOf(`/`)+1)}paramList(e){return Object.entries(e)}kindLabel(e){return NV[e]}kindCount(e){return e===`all`?this.allCalls().length:this.allCalls().filter(t=>t.kind===e).length}modeLabel(e){return MV[e]}mismatch(e){return!e.last?.render||e.mode===`redirect`?!1:e.mode===`client`?e.last.render!==`client`:e.last.render===`client`}fnOf(e){return e.kind===`fn`&&e.route?this.fnById().get(e.route):void 0}fnCalls(e){return this.allCalls().filter(t=>t.kind===`fn`&&t.route===e).length}outcomeLabel(e){return PV[e]}outcomeTone(e){return FV[e]}statusClass(e){return e>=500||e===0?`bad`:e>=400?`warn`:`good`}tone(e){return e===`error`?`bad`:e===`warning`?`warn`:`info`}shadowed(e){return this.findings().find(t=>t.rule===`content-shadows-page`&&t.file===e)?.message.match(/(\/\S+\.page\.ts)/)?.[1]}contentUrl(e){return this.allRoutes().find(t=>t.route.file===e)?.route.fullPath}pretty(e){try{return JSON.stringify(JSON.parse(e),null,2)}catch{return e}}time=mD;tryApi(e){this.method.set(e.method===`ANY`?`GET`:e.method),this.apiPath.set(e.path.replace(/:(\w+)/g,`1`).replace(`**`,`x`)),this.response.set(null),queueMicrotask(()=>document.getElementById(`api-path`)?.focus())}async clearCalls(){await nE(this.rpc(),`analog-clear-calls`)}async explain(){let e=this.testUrl().trim();if(!e){this.explained.set(null),this.explainError.set(`Type a URL to explain, for example /products/42.`);return}this.explaining.set(!0),this.explainError.set(``);try{let t=await tE(this.rpc(),`analog-explain-url`,e);if(!t)throw Error(`The devtools server did not answer`);this.explained.set({url:e,match:t})}catch(t){let n=String(t?.message||`The devtools server did not answer`);this.explained.set(null),this.explainError.set(`Could not explain ${e}. ${n.replace(/\.?$/,`.`)}`)}finally{this.explaining.set(!1)}}async send(){let e=this.apiPath().trim();if(!e||this.sending()||this.needsConfirm())return;let t;if(this.method()!==`GET`&&this.apiBody().trim())try{t=JSON.parse(this.apiBody())}catch{this.response.set({error:`The body is not valid JSON.`});return}this.response.set(null),this.sending.set(!0);try{let n=await nE(this.rpc(),`analog-call-api`,{method:this.method(),path:e,body:t,confirm:this.confirmSend()});this.response.set(n??{error:`No answer from the devtools server.`})}finally{this.sending.set(!1)}}onKey(e){let t=this.views().map(e=>e.id),n=t.indexOf(this.view()),r=n;if(e.key===`ArrowRight`)r=(n+1)%t.length;else if(e.key===`ArrowLeft`)r=(n-1+t.length)%t.length;else if(e.key===`Home`)r=0;else if(e.key===`End`)r=t.length-1;else return;e.preventDefault(),this.view.set(t[r]);let i=e.currentTarget;queueMicrotask(()=>i.querySelector(`#analog-tab-${t[r]}`)?.focus())}static ɵfac=function(t){return new(t||e)};static ɵcmp=Vh({type:e,selectors:[[`app-analog-inspector`]],inputs:{rpc:[1,`rpc`]},decls:3,vars:1,consts:[[`role`,`status`,1,`loading`],[1,`empty`],[`aria-hidden`,`true`,1,`spinner`],[1,`empty-title`],[1,`muted`],[`aria-label`,`Analog summary`,1,`summary`],[1,`stat`],[1,`label`],[1,`value`],[1,`stat`,`wide`],[`role`,`tablist`,`aria-label`,`Analog views`,1,`tabs`,3,`keydown`],[`type`,`button`,`role`,`tab`,3,`id`],[`role`,`tabpanel`,1,`panel`,3,`id`],[1,`value`,`mono`,3,`title`],[`type`,`button`,`role`,`tab`,3,`click`,`id`],[1,`count`],[1,`toolbar`],[1,`inline`,`explain`,3,`submit`],[`for`,`analog-url`],[`id`,`analog-url`,`type`,`text`,`placeholder`,`/products/42`,1,`field`,`grow`,`mono`,3,`input`,`value`],[`type`,`submit`,1,`btn`,`primary`,3,`disabled`],[`for`,`route-filter`,1,`sr-only`],[`id`,`route-filter`,`type`,`search`,`placeholder`,`Filter by path or file`,1,`field`,`filter`,3,`input`,`value`],[`role`,`status`,1,`explain-result`],[`data-tone`,`bad`,1,`callout`],[1,`callout`],[`role`,`region`,`aria-label`,`File routes`,`tabindex`,`0`,1,`table-wrap`],[`scope`,`col`],[3,`open`,`dim`],[1,`mono`],[1,`chain`],[1,`chips`],[1,`pill`],[1,`chip`,`mono`],[1,`plain`],[1,`route`],[`aria-hidden`,`true`,1,`guide`],[1,`mono`,`path`],[1,`pill`,`live`],[1,`file`],[1,`meta`],[`data-kind`,`load`,1,`pill`],[1,`chip`],[1,`dir`],[`colspan`,`4`,1,`empty-row`],[`data-tone`,`warn`,`role`,`note`,1,`callout`],[1,`calls-bar`],[1,`segmented`],[1,`sr-only`],[3,`on`],[`type`,`button`,1,`btn`,`ghost`,3,`click`,`disabled`],[`role`,`region`,`aria-label`,`Server calls`,`tabindex`,`0`,1,`table-wrap`],[1,`empty-box`],[`role`,`region`,`aria-label`,`API routes`,`tabindex`,`0`,1,`table-wrap`],[1,`card`,`playground`,3,`submit`],[1,`row`],[`ariaLabel`,`Method`,1,`method-select`,3,`valueChange`,`options`,`value`],[`for`,`api-path`,1,`sr-only`],[`id`,`api-path`,`type`,`text`,`placeholder`,`/api/v1/products`,1,`field`,`grow`,`mono`,3,`input`,`value`],[`id`,`analog-calls-off`,1,`muted`],[`id`,`analog-confirm-hint`,1,`muted`],[`role`,`status`,1,`muted`],[`role`,`status`,1,`response`],[`type`,`radio`,`name`,`analog-kind`,1,`sr-only`,3,`change`,`checked`],[`scope`,`col`,1,`num`],[1,`muted`,`nowrap`],[1,`request`],[1,`method`],[1,`mono`,`url`],[1,`status`],[1,`num`,`nowrap`],[1,`mono`,`muted`],[1,`code`],[1,`empty-lead`],[1,`actions`],[`type`,`button`,1,`btn`,`ghost`,3,`click`],[`role`,`region`,`aria-label`,`Server functions`,`tabindex`,`0`,1,`table-wrap`],[1,`num`,`tnum`],[`for`,`api-body`],[`id`,`api-body`,`rows`,`3`,`placeholder`,`{"name": "Ada"}`,1,`field`,`mono`,3,`input`,`value`],[1,`check`],[`type`,`checkbox`,3,`change`,`checked`],[`data-status`,`bad`,1,`status`],[`role`,`region`,`aria-label`,`Render modes`,`tabindex`,`0`,1,`table-wrap`],[1,`card`],[1,`muted`,`small`],[1,`muted`,`small`,`tnum`],[`data-tone`,`warn`,1,`pill`],[1,`facts`],[1,`tnum`],[`data-tone`,`warn`,1,`chip`,`mono`],[`data-tone`,`bad`,1,`chip`,`mono`],[`role`,`region`,`aria-label`,`Content files`,`tabindex`,`0`,1,`table-wrap`],[1,`muted`,`nowrap`,`tnum`],[`data-tone`,`bad`,1,`pill`],[`data-tone`,`good`,`role`,`status`,1,`callout`],[1,`findings`],[1,`finding-head`],[1,`finding-title`],[1,`where`],[1,`fix`],[1,`rule`,`mono`],[1,`detail`]],template:function(e,t){e&1&&N(0,Vz,4,0,`div`,0)(1,Hz,14,0,`div`,1)(2,kV,36,10),e&2&&P(t.project()===null?0:t.project().analog?2:1)},dependencies:[oD],styles:[`@charset "UTF-8";
[_nghost-%COMP%] {
  --%NS%good: var(--%NS%ok);
  --%NS%bad: var(--%NS%danger);
  --%NS%info: #60a5fa;
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
  background: var(--%NS%accent-soft);
  color: var(--%NS%accent);
}

.pill[data-kind=layout][_ngcontent-%COMP%] {
  border-color: #94a3b8;
  color: #e2e8f0;
}

.pill[data-kind=markdown][_ngcontent-%COMP%] {
  border-color: #0ea5e9;
  color: #bae6fd;
}

.pill[data-kind=load][_ngcontent-%COMP%] {
  border-color: #2dd4bf;
  color: #99f6e4;
}

.pill[data-mode=ssr][_ngcontent-%COMP%] {
  border-color: #3b82f6;
  color: #bfdbfe;
}

.pill[data-mode=ssg][_ngcontent-%COMP%] {
  border-color: #22c55e;
  color: #bbf7d0;
}

.pill[data-mode=client][_ngcontent-%COMP%] {
  border-color: #eab308;
  color: #fef08a;
}

.pill[data-mode=cached][_ngcontent-%COMP%] {
  border-color: #a855f7;
  color: #e9d5ff;
}

.pill[data-mode=redirect][_ngcontent-%COMP%] {
  border-color: #94a3b8;
  color: #e2e8f0;
}

.pill[data-call=page][_ngcontent-%COMP%] {
  border-color: #3b82f6;
  color: #bfdbfe;
}

.pill[data-call=load][_ngcontent-%COMP%] {
  border-color: #2dd4bf;
  color: #99f6e4;
}

.pill[data-call=fn][_ngcontent-%COMP%] {
  border-color: #14b8a6;
  color: #99f6e4;
}

.pill[data-call=api][_ngcontent-%COMP%] {
  border-color: #f97316;
  color: #fed7aa;
}

.pill[data-call=action][_ngcontent-%COMP%] {
  border-color: #ec4899;
  color: #fbcfe8;
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

.method[data-method=POST][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%ok) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%ok) 12%, transparent);
  color: #86efac;
}

.method[data-method=PUT][_ngcontent-%COMP%], 
.method[data-method=PATCH][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%warn) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%warn) 12%, transparent);
  color: #fde68a;
}

.method[data-method=DELETE][_ngcontent-%COMP%] {
  border-color: color-mix(in srgb, var(--%NS%danger) 30%, transparent);
  background: color-mix(in srgb, var(--%NS%danger) 12%, transparent);
  color: #fecaca;
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
}`]})},RV=(e,t)=>t.id,zV=(e,t)=>t.side+t.id,BV=(e,t)=>t.key;function VV(e,t){e&1&&(R(0,`div`,0),B(1,`span`,43),R(2,`span`),J(3,`Loading…`),z()())}function HV(e,t){e&1&&(R(0,`div`,1)(1,`strong`),J(2,`Could not reach the devtools server.`),z(),R(3,`span`),J(4,`Check that the app's dev server is running with the devtools plugin, then reopen this panel.`),z()())}function UV(e,t){e&1&&(R(0,`span`,48),J(1,`transfer cache`),z())}function WV(e,t){if(e&1&&(R(0,`span`,48),J(1),z()),e&2){let e=K().$implicit;j(),X(`delayed `,e.delayMs,` ms`)}}function GV(e,t){e&1&&(R(0,`span`,57),J(1,`mocked`),z())}function KV(e,t){e&1&&(R(0,`span`,58),J(1,`faulted`),z())}function qV(e,t){if(e&1&&(R(0,`span`,59),J(1,`rule `),R(2,`code`),J(3),z()()),e&2){let e=t;L(`title`,`Matched rule: `+e),j(3),Y(e)}}function JV(e,t){if(e&1){let e=W();R(0,`tr`,47),G(`click`,function(){let t=O(e).$implicit;return k(K(2).openCall(t.id))}),R(1,`td`)(2,`span`,48),J(3),z()(),R(4,`td`,49),J(5),z(),R(6,`td`,50)(7,`button`,51),J(8),z()(),R(9,`td`,52),J(10),z(),R(11,`td`,53),B(12,`span`,54),J(13),z(),R(14,`td`,55),J(15),z(),R(16,`td`)(17,`div`,56),N(18,UV,2,0,`span`,48),N(19,WV,2,1,`span`,48),N(20,GV,2,0,`span`,57),N(21,KV,2,0,`span`,58),N(22,qV,4,2,`span`,59),z()()()}if(e&2){let e,n=t.$implicit,r=K(2);q(`selected`,r.selectedCall()?.id===n.id),j(2),q(`server`,n.side===`server`),j(),Y(n.side===`server`?`SSR`:`Client`),j(2),Y(n.method),j(2),L(`title`,n.url),M(`data-call-id`,n.id)(`aria-pressed`,r.selectedCall()?.id===n.id)(`aria-controls`,r.selectedCall()?`call-preview`:null),j(),X(` `,n.url,` `),j(),L(`title`,n.pageUrl??``),j(),X(` `,n.pageUrl??``,` `),j(),q(`ok`,r.callTone(n)===`ok`)(`redirect`,r.callTone(n)===`redirect`)(`bad`,r.callTone(n)===`bad`),j(2),X(``,r.statusLabel(n),` `),j(2),X(``,n.durationMs,` ms`),j(3),P(n.cacheHit?18:-1),j(),P(n.delayMs?19:-1),j(),P(n.mocked?20:-1),j(),P(n.faulted?21:-1),j(),P((e=r.rulePatternOf(n))?22:-1,e)}}function YV(e,t){if(e&1&&(R(0,`div`,12)(1,`table`)(2,`thead`)(3,`tr`)(4,`th`,44),J(5,`Side`),z(),R(6,`th`,44),J(7,`Method`),z(),R(8,`th`,44),J(9,`URL`),z(),R(10,`th`,44),J(11,`Page`),z(),R(12,`th`,44),J(13,`Status`),z(),R(14,`th`,45),J(15,`Time`),z(),R(16,`th`,44),J(17,`Notes`),z()()(),R(18,`tbody`),F(19,JV,23,26,`tr`,46,zV),z()()()),e&2){let e=K();j(19),I(e.timeline())}}function XV(e,t){e&1&&(R(0,`div`,13)(1,`p`),J(2,`No requests yet.`),z(),R(3,`p`,31),J(4,` Add `),R(5,`code`),J(6,`withNgDevtools()`),z(),J(7,` to `),R(8,`code`),J(9,`provideHttpClient`),z(),J(10,`, then load a page of the app. `),z()())}function ZV(e,t){e&1&&(R(0,`p`,66),J(1,` Matched rule `),R(2,`code`),J(3),z()()),e&2&&(j(3),Y(t))}function QV(e,t){if(e&1){let e=W();R(0,`div`,60),G(`keydown.escape`,function(){return O(e),k(K().closePreview())}),R(1,`div`,61)(2,`h3`,62),J(3,`Response preview`),z(),R(4,`button`,63),G(`click`,function(){return O(e),k(K().closePreview())}),J(5,`Close`),z()(),R(6,`p`,64)(7,`span`,49),J(8),z(),R(9,`span`,53),J(10),z(),R(11,`span`,65),J(12),z()(),N(13,ZV,4,1,`p`,66),R(14,`pre`),J(15),z()()}if(e&2){let e,n=t,r=K();j(8),Y(n.method),j(),q(`ok`,r.callTone(n)===`ok`)(`redirect`,r.callTone(n)===`redirect`)(`bad`,r.callTone(n)===`bad`),j(),Y(r.statusLabel(n)),j(),L(`title`,n.url),j(),Y(n.url),j(),P((e=r.rulePatternOf(n))?13:-1,e),j(),q(`error`,!!n.error&&!n.cancelled),j(),Y(n.error??n.preview??`(no body)`)}}function $V(e,t){if(e&1&&(R(0,`p`,17),J(1),z()),e&2){let e=K();j(),Y(e.writesOff)}}function eH(e,t){e&1&&(R(0,`p`,31),J(1,` SSR mocks are not transferred to the client: the browser requests the URL again and gets the real response unless the rule also applies on the client. `),z())}function tH(e,t){e&1&&(R(0,`span`),J(1,`passthrough`),z())}function nH(e,t){if(e&1&&(R(0,`span`,53),J(1),z()),e&2){let e=K().$implicit,t=K();q(`ok`,t.statusTone(e.status)===`ok`)(`redirect`,t.statusTone(e.status)===`redirect`)(`bad`,t.statusTone(e.status)===`bad`),j(),Y(e.status)}}function rH(e,t){if(e&1&&(R(0,`span`),J(1),z()),e&2){let e=K().$implicit;j(),X(``,e.delayMs,` ms`)}}function iH(e,t){e&1&&(R(0,`span`),J(1,`mock body`),z())}function aH(e,t){e&1&&(R(0,`p`,74),J(1,` The SSR mock is not written to TransferState, so the browser requests this URL again. `),z())}function oH(e,t){if(e&1){let e=W();R(0,`li`)(1,`label`,67)(2,`input`,68),G(`change`,function(){let t=O(e).$implicit;return k(K().toggleRule(t.id))}),z(),R(3,`code`,69)(4,`span`,70),J(5),z(),J(6),z()(),R(7,`button`,71),G(`click`,function(){let t=O(e).$implicit;return k(K().removeRule(t.id))}),J(8,` Remove `),z(),R(9,`span`,72)(10,`span`),J(11),z(),N(12,tH,2,0,`span`)(13,nH,2,7,`span`,73),N(14,rH,2,1,`span`),N(15,iH,2,0,`span`),z(),N(16,aH,2,0,`p`,74),z()}if(e&2){let e=t.$implicit,n=K();q(`off`,!e.enabled),j(2),L(`checked`,e.enabled)(`disabled`,!n.canWrite()),M(`aria-describedby`,n.canWrite()?null:`http-writes-off`)(`aria-label`,`Enable rule for `+e.pattern),j(),L(`title`,e.pattern),j(2),Y(e.method||`ANY`),j(),X(` `,e.pattern),j(),L(`disabled`,!n.canWrite()),M(`aria-describedby`,n.canWrite()?null:`http-writes-off`)(`aria-label`,`Remove rule for `+e.pattern),j(4),Y(n.targetLabel(e.target)),j(),P(e.status===void 0?12:13),j(2),P(e.delayMs?14:-1),j(),P(e.body?15:-1),j(),P(n.mocksOnServer(e)?16:-1)}}function sH(e,t){e&1&&(R(0,`li`,38),J(1,`No rules. SSR rules apply on the next page load.`),z())}function cH(e,t){if(e&1&&(R(0,`div`)(1,`dt`),J(2,`DOM nodes hydrated`),z(),R(3,`dd`),J(4),z()(),R(5,`div`)(6,`dt`),J(7,`DOM nodes skipped`),z(),R(8,`dd`),J(9),z()(),R(10,`div`)(11,`dt`),J(12,`Mismatched components`),z(),R(13,`dd`),J(14),z()()),e&2){let e=t;j(4),Y(e.hydrated),j(5),Y(e.skipped),j(4),q(`bad`,e.mismatched>0),j(),Y(e.mismatched)}}function lH(e,t){if(e&1&&(R(0,`span`,77)(1,`span`,78),J(2,`Expected`),z(),R(3,`code`),J(4),z()()),e&2){let e=K().$implicit;j(4),Y(e.expected)}}function uH(e,t){if(e&1&&(R(0,`span`,77)(1,`span`,78),J(2,`Actual`),z(),R(3,`code`),J(4),z()()),e&2){let e=K().$implicit;j(4),Y(e.actual)}}function dH(e,t){if(e&1&&(R(0,`li`)(1,`code`),J(2),z(),N(3,lH,5,1,`span`,77),N(4,uH,5,1,`span`,77),z()),e&2){let e=t.$implicit;j(2),Y(`<`+e.component+`>`),j(),P(e.expected?3:-1),j(),P(e.actual?4:-1)}}function fH(e,t){if(e&1&&(R(0,`h3`),J(1),z(),R(2,`ul`,76),F(3,dH,5,3,`li`,null,wg),z()),e&2){let e=K();j(),X(`Mismatches (`,e.mismatches.length,`)`),j(2),I(e.mismatches)}}function pH(e,t){if(e&1&&(R(0,`li`)(1,`code`),J(2),z()()),e&2){let e=t.$implicit;j(2),Y(e)}}function mH(e,t){if(e&1&&(R(0,`h3`),J(1,`ngSkipHydration hosts`),z(),R(2,`ul`,79),F(3,pH,3,1,`li`,null,wg),z()),e&2){let e=K();j(3),I(e.skipHydrationHosts)}}function hH(e,t){e&1&&(R(0,`h3`),J(1,`Warnings`),z(),R(2,`p`,31),J(3,` Not captured: add `),R(4,`code`),J(5,`provideNgDevtoolsHttp()`),z(),J(6,` to the app providers. `),z())}function gH(e,t){if(e&1&&(R(0,`pre`,80),J(1),z()),e&2){let e=t.$implicit;j(),Y(e)}}function _H(e,t){e&1&&(R(0,`p`,81),J(1,`No hydration warnings.`),z())}function vH(e,t){if(e&1&&(R(0,`h3`),J(1),z(),F(2,gH,2,1,`pre`,80,wg,!1,_H,2,0,`p`,81)),e&2){let e=K();j(),X(`Warnings (`,e.warnings.length,`)`),j(),I(e.warnings)}}function yH(e,t){if(e&1&&(R(0,`dl`,75)(1,`div`)(2,`dt`),J(3,`Enabled`),z(),R(4,`dd`)(5,`span`,48),J(6),z()()(),R(7,`div`)(8,`dt`),J(9,`Hydrated components`),z(),R(10,`dd`),J(11),z()(),R(12,`div`)(13,`dt`),J(14,`Hydrated nodes`),z(),R(15,`dd`),J(16),z()(),R(17,`div`)(18,`dt`),J(19,`Skipped components`),z(),R(20,`dd`),J(21),z()(),R(22,`div`)(23,`dt`),J(24,`Incremental defer blocks`),z(),R(25,`dd`),J(26),z()(),N(27,cH,15,5),z(),N(28,fH,5,1),N(29,mH,5,0),N(30,hH,7,0)(31,vH,5,2)),e&2){let e,n=t;j(5),q(`on`,n.enabled)(`off-tag`,!n.enabled),j(),Y(n.enabled?`yes`:`no (client render only)`),j(5),Y(n.hydratedComponents??`n/a`),j(5),Y(n.hydratedNodes??`n/a`),j(5),Y(n.componentsSkippedHydration??`n/a`),j(5),Y(n.deferBlocksWithIncrementalHydration??`n/a`),j(),P((e=n.nodes)?27:-1,e),j(),P(n.mismatches?.length?28:-1),j(),P(n.skipHydrationHosts.length?29:-1),j(),P(n.warningsCaptured===!1?30:31)}}function bH(e,t){e&1&&(R(0,`div`,13)(1,`p`),J(2,`No hydration data for this page.`),z(),R(3,`p`,31),J(4,`Open a server rendered page of the app to see its stats.`),z()())}function xH(e,t){e&1&&(R(0,`div`,13)(1,`p`),J(2,`No TransferState script: this page was not server rendered.`),z()())}function SH(e,t){if(e&1&&(R(0,`p`,83),J(1),z()),e&2){let e=K(2);j(),Y(e.error)}}function CH(e,t){e&1&&(R(0,`span`,48),J(1),z()),e&2&&(j(),Y(t))}function wH(e,t){if(e&1&&(R(0,`span`,48),J(1),z(),R(2,`span`,86),J(3),z()),e&2){let e=t,n=K().$implicit,r=K(3);q(`server`,r.statusTone(e.status)===`ok`)(`fault`,r.statusTone(e.status)===`bad`),j(),X(`HTTP `,e.status),j(2),Y(e.url??n.key)}}function TH(e,t){if(e&1&&(R(0,`span`,86),J(1),z()),e&2){let e=K().$implicit;j(),Y(e.key)}}function EH(e,t){if(e&1&&(R(0,`details`)(1,`summary`),B(2,`span`,85),N(3,CH,2,1,`span`,48),N(4,wH,4,6)(5,TH,2,1,`span`,86),R(6,`span`,87),J(7),z()(),R(8,`pre`),J(9),dv(10,`json`),z()()),e&2){let e,n,r=t.$implicit,i=K(3);j(3),P((e=i.payloadLabel(r))?3:-1,e),j(),P((n=r.http)?4:5,n),j(3),X(``,r.size,` B`),j(2),Y(pv(10,4,r.value))}}function DH(e,t){if(e&1&&(R(0,`p`,82),J(1),z(),N(2,SH,2,1,`p`,83),R(3,`div`,84),F(4,EH,11,6,`details`,null,BV),z()),e&2){let e=K();j(),Y_(` `,e.entries.length,` entr`,e.entries.length===1?`y`:`ies`,`, `,e.size,` bytes `),j(),P(e.error?2:-1),j(2),I(e.entries)}}function OH(e,t){e&1&&N(0,xH,3,0,`div`,13)(1,DH,6,4),e&2&&P(+!!t.found)}function kH(e,t){e&1&&(R(0,`div`,13)(1,`p`),J(2,`Open a page of the app to see its payload.`),z()())}var AH={pattern:``,method:``,target:`both`,status:``,delayMs:``,body:``},jH=50,MH=class e{rpc=$(null);canWrite=Q(()=>oE(this.rpc(),`http`));writesOff=UT(`http`);loading=A(!1);failed=A(!1);serverCalls=A([]);pages=A([]);payloads=A({});serverDropped=A(0);rules=A([]);hostPageId=ZT();selectedPageId=Tv({source:()=>this.pages(),computation:(e,t)=>t?.value&&e.some(e=>e.pageId===t.value)?t.value:e.find(e=>e.pageId===this.hostPageId)?.pageId??e[0]?.pageId??null});selectedCallId=A(null);draft=A({...AH});message=A(``);bodyPlaceholder=`{ "error": "Service unavailable" }`;unsubscribe=[];destroyRef=E(ws);injector=E(Ss);host=E(Nl);selected=Q(()=>this.pages().find(e=>e.pageId===this.selectedPageId())??null);selectedPayload=Q(()=>{let e=this.selectedPageId();return e?this.payloads()[e]??null:null});maxCalls=Q(()=>aE(this.rpc()).limits.httpCalls);droppedCalls=Q(()=>(this.selected()?.dropped??0)+this.serverDropped());pageServerCalls=Q(()=>{let e=this.selected()?.initialUrl;return e?this.serverCalls().filter(t=>!t.pageUrl||t.pageUrl===e):this.serverCalls()});timeline=Q(()=>[...this.pageServerCalls(),...this.selected()?.calls??[]].sort((e,t)=>t.at-e.at));selectedCall=Q(()=>this.timeline().find(e=>e.id===this.selectedCallId())??null);draftMocksOnServer=Q(()=>{let e=this.draftRule();return!!e&&this.mocksOnServer(e)});statusError=Q(()=>{let e=this.draft().status.trim();if(!e)return``;let t=Number(e);return Number.isInteger(t)&&t>=100&&t<=599?``:`Set a status from 100 to 599.`});draftRule=Q(()=>{let e=this.draft(),t=e.pattern.trim();if(!t||this.bodyError()||this.statusError()||this.rules().length>=jH)return null;let n=e.body.trim(),r=Math.min(Math.max(Math.round(Number(e.delayMs))||0,0),1e4),i=e.status.trim()?Number(e.status):n?200:void 0;return i===void 0&&!r?null:{pattern:t,enabled:!0,target:e.target,...e.method?{method:e.method}:{},...i===void 0?{}:{status:i},...r?{delayMs:r}:{},...n?{body:n}:{}}});draftHint=Q(()=>{let e=this.draft();return this.rules().length>=jH?`You can add up to ${jH} rules. Remove one to add another.`:e.pattern.trim()?this.statusError()?this.statusError():this.bodyError()?``:this.draftRule()?!e.status.trim()&&e.body.trim()?`With no status, the mock body returns 200.`:``:`Set a status, a delay or a mock body.`:`Enter a URL pattern to add a rule.`});bodyError=Q(()=>{let e=this.draft().body.trim();if(!e)return``;try{return JSON.parse(e),``}catch{return`The mock body must be valid JSON.`}});constructor(){dc(()=>{let e=this.rpc();e&&this.load(e)}),this.destroyRef.onDestroy(()=>this.stopListening())}async load(e){this.loading.set(!0),this.failed.set(!1);try{let t=e.scope(`ng-devtools`).rpc,[n,r]=await Promise.all([t.sharedState(`http`),t.sharedState(`http-payloads`)]);if(this.destroyRef.destroyed)return;let i=e=>{let t=e;this.serverCalls.set(t?.serverCalls??[]),this.serverDropped.set(t?.serverDropped??0),this.pages.set(t?.pages??[]),this.rules.set(t?.rules??[])},a=e=>this.payloads.set(e?.pages??{});i(n.value()),a(r.value()),this.stopListening(),this.unsubscribe=[n.on(`updated`,i),r.on(`updated`,a)]}catch{this.failed.set(!0)}finally{this.loading.set(!1)}}statusLabel(e){return e.cancelled?`cancelled`:e.status?String(e.status):`ERR`}callTone(e){return e.cancelled?`neutral`:this.statusTone(e.status)}rulePatternOf(e){return e.rulePattern?e.rulePattern:e.ruleId?this.rules().find(t=>t.id===e.ruleId)?.pattern??null:null}openCall(e){this.selectedCallId.set(e),Ld(()=>this.host.nativeElement.querySelector(`#preview-heading`)?.focus(),{injector:this.injector})}closePreview(){let e=this.selectedCallId();this.selectedCallId.set(null),e&&[...this.host.nativeElement.querySelectorAll(`button[data-call-id]`)].find(t=>t.dataset.callId===e)?.focus()}stopListening(){for(let e of this.unsubscribe.splice(0))e()}statusTone(e){return e===void 0?`neutral`:e===0||e>=400?`bad`:e>=300?`redirect`:e>=200?`ok`:`neutral`}mocksOnServer(e){return e.target!==`client`&&e.status!==void 0&&e.status<400}payloadLabel(e){return e.source===`hydration`?`hydration annotations`:e.fn?`Analog server function ${e.fn.name??e.fn.id}`:e.source===`analog`?`Analog`:null}targetLabel(e){return e===`both`?`SSR + client`:e===`server`?`SSR only`:`Client only`}pageOptions=Q(()=>this.pages().map(e=>({value:e.pageId,label:e.title||e.url})));methodOptions=[{value:``,label:`Any`},...[`GET`,`POST`,`PUT`,`PATCH`,`DELETE`].map(e=>({value:e,label:e}))];targetOptions=[{value:`both`,label:`SSR + client`},{value:`server`,label:`SSR only`},{value:`client`,label:`Client only`}];selectPage(e){e&&this.selectedPageId.set(e),this.selectedCallId.set(null)}setDraft(e,t){this.draft.update(n=>({...n,[e]:t}))}patch(e,t){let n=t.target.value;this.draft.update(t=>({...t,[e]:n}))}async addRule(e){e.preventDefault();let t=this.draftRule();if(!t)return;let n={id:`r${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`,...t};await this.saveRules([...this.rules(),n],`Rule added.`,n)&&(this.draft.set({...AH}),this.host.nativeElement.querySelector(`#rule-pattern`)?.focus())}toggleRule(e){let t=this.rules().find(t=>t.id===e);t&&this.saveRules(this.rules().map(t=>t.id===e?{...t,enabled:!t.enabled}:t),`Rule updated.`,t)}removeRule(e){let t=this.rules().find(t=>t.id===e);t&&this.saveRules(this.rules().filter(t=>t.id!==e),`Rule removed.`,t)}async clearCalls(){try{await tE(this.rpc(),`clear-http-calls`),this.selectedCallId.set(null),this.message.set(`Timeline cleared.`)}catch{this.message.set(`Could not clear the timeline.`)}}async saveRules(e,t,n){try{let r=await tE(this.rpc(),`set-http-rules`,e);return this.rules.set(Array.isArray(r)?r:e),this.message.set(n.target===`client`?t:`${t} Reload the page to apply it to SSR.`),!0}catch{return this.message.set(`Could not save the rules.`),!1}}static ɵfac=function(t){return new(t||e)};static ɵcmp=Vh({type:e,selectors:[[`app-network-inspector`]],inputs:{rpc:[1,`rpc`]},decls:76,vars:32,consts:[[`role`,`status`,1,`state`],[`role`,`alert`,1,`state`,`error`],[1,`toolbar`],[1,`page-picker`],[`id`,`page-picker-label`],[`labelledBy`,`page-picker-label`,`emptyText`,`No connected page`,`placeholder`,`No connected page`,3,`valueChange`,`options`,`value`],[`type`,`button`,3,`click`,`disabled`],[`role`,`status`,1,`message`],[1,`grid`],[`aria-labelledby`,`timeline-heading`,1,`panel`,`wide`],[`id`,`timeline-heading`],[`what`,`HTTP calls`,`limit`,`httpCalls`,3,`dropped`,`max`],[1,`table-wrap`],[1,`empty`],[`id`,`call-preview`,`role`,`region`,`aria-labelledby`,`preview-heading`,1,`preview`],[`aria-labelledby`,`rules-heading`,1,`panel`],[`id`,`rules-heading`],[`id`,`http-writes-off`,1,`muted`,`small`],[1,`rule-form`,3,`submit`],[1,`hint`],[`id`,`rule-pattern`,`required`,``,`spellcheck`,`false`,`autocomplete`,`off`,`placeholder`,`e.g. /api/products`,3,`input`,`value`],[1,`row`],[1,`field-group`],[`id`,`rule-method-label`],[`labelledBy`,`rule-method-label`,3,`valueChange`,`options`,`value`],[`id`,`rule-target-label`],[`labelledBy`,`rule-target-label`,3,`valueChange`,`options`,`value`],[`type`,`number`,`inputmode`,`numeric`,`min`,`100`,`max`,`599`,`placeholder`,`e.g. 500`,`aria-describedby`,`rule-hint`,3,`input`,`value`],[`type`,`number`,`inputmode`,`numeric`,`min`,`0`,`max`,`10000`,`placeholder`,`0`,3,`input`,`value`],[`rows`,`3`,`spellcheck`,`false`,`aria-describedby`,`body-error`,3,`input`,`placeholder`,`value`],[`id`,`body-error`,1,`field-error`],[1,`muted`,`small`],[`id`,`rule-hint`,1,`muted`,`small`],[1,`form-actions`],[`type`,`submit`,3,`disabled`],[1,`rules-heading`],[1,`rules`],[3,`off`],[1,`empty-rule`],[`aria-labelledby`,`hydration-heading`,1,`panel`],[`id`,`hydration-heading`],[`aria-labelledby`,`payload-heading`,1,`panel`,`wide`],[`id`,`payload-heading`],[`aria-hidden`,`true`,1,`spinner`],[`scope`,`col`],[`scope`,`col`,1,`num`],[3,`selected`],[3,`click`],[1,`tag`],[1,`method`],[1,`url`],[`type`,`button`,1,`link`,3,`title`],[1,`page-url`,3,`title`],[1,`status`],[`aria-hidden`,`true`,1,`dot`],[1,`num`],[1,`notes`],[1,`tag`,`mock`],[1,`tag`,`fault`],[1,`tag`,`rule-ref`,3,`title`],[`id`,`call-preview`,`role`,`region`,`aria-labelledby`,`preview-heading`,1,`preview`,3,`keydown.escape`],[1,`preview-head`],[`id`,`preview-heading`,`tabindex`,`-1`],[`type`,`button`,1,`ghost`,3,`click`],[1,`preview-meta`],[1,`preview-url`,3,`title`],[1,`preview-rule`],[1,`inline`],[`type`,`checkbox`,3,`change`,`checked`,`disabled`],[1,`rule-pattern`,3,`title`],[1,`rule-method`],[`type`,`button`,1,`link`,`remove`,3,`click`,`disabled`],[1,`rule-meta`],[1,`status`,3,`ok`,`redirect`,`bad`],[1,`rule-note`],[1,`stats`],[1,`plain`,`mismatches`],[1,`mismatch-row`],[1,`mismatch-label`],[1,`plain`],[1,`warn`],[1,`muted`,`small`,`ok-note`],[1,`muted`,`small`,`summary-line`],[`role`,`alert`,1,`bad`],[1,`entries`],[`aria-hidden`,`true`,1,`chevron`],[1,`entry-key`],[1,`entry-size`]],template:function(e,t){if(e&1&&(N(0,VV,4,0,`div`,0)(1,HV,5,0,`div`,1),R(2,`div`,2)(3,`div`,3)(4,`span`,4),J(5,`Page`),z(),R(6,`app-select`,5),G(`valueChange`,function(e){return t.selectPage(e)}),z()(),R(7,`button`,6),G(`click`,function(){return t.clearCalls()}),J(8,` Clear timeline `),z(),R(9,`p`,7),J(10),z()(),R(11,`div`,8)(12,`section`,9)(13,`h2`,10),J(14),z(),B(15,`app-limit-note`,11),N(16,YV,21,0,`div`,12)(17,XV,11,0,`div`,13),N(18,QV,16,14,`div`,14),z(),R(19,`section`,15)(20,`h2`,16),J(21,`Fault injection`),z(),N(22,$V,2,1,`p`,17),R(23,`form`,18),G(`submit`,function(e){return t.addRule(e)}),R(24,`label`)(25,`span`),J(26,`URL pattern `),R(27,`span`,19),J(28,`(substring or * glob)`),z()(),R(29,`input`,20),G(`input`,function(e){return t.patch(`pattern`,e)}),z()(),R(30,`div`,21)(31,`div`,22)(32,`span`,23),J(33,`Method`),z(),R(34,`app-select`,24),G(`valueChange`,function(e){return t.setDraft(`method`,e??``)}),z()(),R(35,`div`,22)(36,`span`,25),J(37,`Apply on`),z(),R(38,`app-select`,26),G(`valueChange`,function(e){return t.setDraft(`target`,e??`both`)}),z()()(),R(39,`div`,21)(40,`label`),J(41,` Status `),R(42,`input`,27),G(`input`,function(e){return t.patch(`status`,e)}),z()(),R(43,`label`),J(44,` Delay (ms) `),R(45,`input`,28),G(`input`,function(e){return t.patch(`delayMs`,e)}),z()()(),R(46,`label`)(47,`span`),J(48,`Mock JSON body `),R(49,`span`,19),J(50,`(optional)`),z()(),R(51,`textarea`,29),G(`input`,function(e){return t.patch(`body`,e)}),z()(),R(52,`p`,30),J(53),z(),N(54,eH,2,0,`p`,31),R(55,`p`,32),J(56),z(),R(57,`div`,33)(58,`button`,34),J(59,` Add rule `),z()()(),R(60,`h3`,35),J(61),z(),R(62,`ul`,36),F(63,oH,17,17,`li`,37,RV,!1,sH,2,0,`li`,38),z()(),R(66,`section`,39)(67,`h2`,40),J(68,`Hydration`),z(),N(69,yH,32,13)(70,bH,5,0,`div`,13),z(),R(71,`section`,41)(72,`h2`,42),J(73,`TransferState payload`),z(),N(74,OH,2,1)(75,kH,3,0,`div`,13),z()()),e&2){let e,n,r;P(t.loading()?0:t.failed()?1:-1),j(6),L(`options`,t.pageOptions())(`value`,t.selected()?.pageId??null),j(),L(`disabled`,!t.canWrite()),M(`aria-describedby`,t.canWrite()?null:`http-writes-off`),j(3),Y(t.message()),j(4),X(`HTTP timeline (`,t.timeline().length,`)`),j(),L(`dropped`,t.droppedCalls())(`max`,t.maxCalls()),j(),P(t.timeline().length?16:17),j(2),P((e=t.selectedCall())?18:-1,e),j(4),P(t.canWrite()?-1:22),j(7),L(`value`,t.draft().pattern),j(5),L(`options`,t.methodOptions)(`value`,t.draft().method),j(4),L(`options`,t.targetOptions)(`value`,t.draft().target),j(4),L(`value`,t.draft().status),M(`aria-invalid`,t.statusError()?`true`:null),j(3),L(`value`,t.draft().delayMs),j(6),L(`placeholder`,t.bodyPlaceholder)(`value`,t.draft().body),M(`aria-invalid`,t.bodyError()?`true`:null),j(2),Y(t.bodyError()),j(),P(t.draftMocksOnServer()?54:-1),j(2),Y(t.draftHint()),j(2),L(`disabled`,!t.canWrite()||!t.draftRule()),M(`aria-describedby`,t.canWrite()?`rule-hint`:`http-writes-off`),j(3),X(`Rules (`,t.rules().length,`)`),j(2),I(t.rules()),j(6),P((n=t.selected()?.hydration)?69:70,n),j(5),P((r=t.selectedPayload())?74:75,r)}},dependencies:[_D,oD,ab],styles:[`@charset "UTF-8";
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
}`]})};function NH(e,t){e&1&&(ps(),V(0,`svg`,9),U(1,`path`,21),H())}function PH(e,t){e&1&&(ps(),V(0,`svg`,10)(1,`defs`)(2,`linearGradient`,22),U(3,`stop`,23)(4,`stop`,24),H()(),U(5,`path`,25),V(6,`g`,26),U(7,`path`,27)(8,`path`,28)(9,`path`,29)(10,`path`,30),H()())}function FH(e,t){e&1&&(ps(),V(0,`svg`,11),U(1,`path`,31)(2,`path`,32)(3,`path`,33)(4,`path`,34),H())}function IH(e,t){e&1&&(ps(),V(0,`svg`,9),U(1,`path`,35)(2,`path`,36)(3,`path`,37)(4,`path`,38)(5,`path`,39)(6,`path`,40),H())}function LH(e,t){if(e&1&&(V(0,`a`,16),U(1,`img`,41),V(2,`span`,42)(3,`span`,43),J(4,`Being built by`),H(),V(5,`strong`),J(6),H(),V(7,`span`,44),J(8),H()(),V(9,`span`,45),J(10,`→`),H(),V(11,`span`,46),J(12,`(opens in a new tab)`),H()()),e&2){let e=t,n=K();Vg(`href`,`https://github.com/santoshyadavdev/angular-devtools/pull/`+n.info().pr,Au),j(),Vg(`src`,`https://github.com/`+e.login+`.png?size=96`,Au),j(5),Y(e.name),j(2),Z(`@`,e.login,` · PR #`,n.info().pr)}}function RH(e,t){if(e&1&&(V(0,`a`,17)(1,`span`,42)(2,`strong`),J(3),H()(),V(4,`span`,45),J(5,`→`),H(),V(6,`span`,46),J(7,`(opens in a new tab)`),H()()),e&2){let e=t;Vg(`href`,e.href,Au),j(3),Y(e.label)}}function zH(e,t){if(e&1&&(V(0,`li`),J(1),H()),e&2){let e=t.$implicit,n=t.$index;C_(`animation-delay`,200+n*120,`ms`),j(),Y(e)}}var BH=class e{info=$.required();static ɵfac=function(t){return new(t||e)};static ɵcmp=Vh({type:e,selectors:[[`app-coming-soon`]],hostVars:2,hostBindings:function(e,t){e&2&&C_(`--%NS%brand`,t.info().color)},inputs:{info:[1,`info`]},decls:30,vars:7,consts:[[`aria-labelledby`,`soon-title`,1,`soon`],[`aria-hidden`,`true`,1,`stage`],[1,`ring`,`r1`],[1,`ring`,`r2`],[1,`orbit`,`o1`],[1,`dot`],[1,`orbit`,`o2`],[1,`orbit`,`o3`],[1,`logo`],[`viewBox`,`0 0 256 256`,`width`,`96`,`height`,`96`],[`viewBox`,`0 0 32 32`,`width`,`88`,`height`,`88`],[`viewBox`,`0 0 256 182`,`width`,`104`,`height`,`74`],[1,`badge`],[`aria-hidden`,`true`,1,`spark`],[`id`,`soon-title`],[1,`summary`],[`target`,`_blank`,`rel`,`noopener noreferrer`,1,`author`,3,`href`],[`target`,`_blank`,`rel`,`noopener noreferrer`,1,`author`,`cta`,3,`href`],[1,`plans-title`],[1,`plans`],[3,`animation-delay`],[`fill`,`#3c5afd`,`d`,`M237.248 18.752q18.061 18.06 18.748 45.247V192c-.457 18.12-6.707 33.207-18.748 45.247c-12.04 12.04-27.127 18.291-45.251 18.752H63.999q-27.187-.69-45.247-18.752C6.712 225.208.46 210.121 0 192.001V64q.69-27.187 18.752-45.247Q36.812.692 63.999 0h127.998c18.124.46 33.211 6.711 45.251 18.752m-17.655 103q-6.033-6.003-6.28-15.066V64q-.192-9.063-6.221-15.091c-4.02-4.023-9.054-6.093-15.095-6.22h-21.312v106.626L85.315 42.687H63.999c-6.042.128-11.072 2.198-15.091 6.221c-4.023 4.02-6.093 9.05-6.22 15.09v42.688q-.249 9.063-6.281 15.066q-6.03 5.996-15.091 6.246q9.062.255 15.09 6.25c4.024 4.002 6.115 9.024 6.281 15.066V192c.128 6.037 2.198 11.072 6.221 15.091q6.03 6.03 15.09 6.22h21.317V106.687l85.37 106.627h21.312c6.041-.128 11.076-2.202 15.095-6.221s6.093-9.054 6.22-15.09v-42.688q.249-9.063 6.281-15.066q6.03-5.995 15.091-6.25q-9.062-.25-15.09-6.246`],[`id`,`an-hero-grad`,`x1`,`0`,`y1`,`0`,`x2`,`1`,`y2`,`1`],[`offset`,`0`,`stop-color`,`#f0224f`],[`offset`,`1`,`stop-color`,`#c4002d`],[`d`,`M16 0C27.2 0 32 4.8 32 16S27.2 32 16 32 0 27.2 0 16 4.8 0 16 0Z`,`fill`,`url(#an-hero-grad)`],[`transform`,`translate(6.4 6.4) scale(0.8)`,`fill`,`#fff`],[`d`,`M14.8486 0L23.138 16.8551L23.9996 3.99892L14.8486 0Z`],[`d`,`M16.9875 17.7114H7.01272L5.73926 20.627L12.0001 24L18.261 20.627L16.9875 17.7114Z`],[`d`,`M8.72168 13.9298H15.2812L11.9997 6.39575L8.72168 13.9298Z`],[`d`,`M9.15103 0L0 3.99892L0.861556 16.8551L9.15103 0Z`],[`fill`,`#c30f2e`,`d`,`M152.228.001L48.455 181.046H256L152.228 0z`],[`fill`,`#dd0330`,`d`,`M88.314 26.967L0 181.52h176.628L88.315 26.967z`],[`fill`,`#fff`,`d`,`M18.167 135.294h220.236v-2.419H18.167z`],[`fill`,`#fff`,`d`,`M204.38 170.667c-.861 0-1.67-.358-2.348-1.034c-4.045-4.063-4.221-20.586-4.026-45.33c.11-13.521.257-32.043-1.9-33.504c-2.104.873-2.315 16.172-2.451 26.301c-.162 11.785-.327 23.98-2.242 30.189c-.57 1.84-1.306 3.525-2.786 3.39c-2.086-.185-2.76-3.48-4.317-16.478c-.647-5.4-1.317-10.98-2.101-13.14a11 11 0 0 0-.269-.66c-.835 1.889-1.8 7.079-2.47 10.682c-.927 4.976-1.803 9.676-2.9 11.726c-.847 1.575-2.19 3.63-4.067 3.231c-2.558-.537-3.323-5.693-3.552-8.719c0-25.455-3.33-28.417-3.997-28.753l-.107.081l-.162-.036c-2.377 1.038-2.506 9.294-2.627 17.276c-.096 5.856-.198 12.492-1.053 18.701c-1.108 8.05-2.448 9.603-4.115 9.507c-3.838-.262-3.95-13.482-3.95-14.987c0-.472.012-1.028.027-1.642c.074-3.076.205-8.8-1.687-10.604c-.25-.239-.603-.515-.879-.437c-1.347.339-2.745 4.714-3.209 6.153c-.147.457-.265.833-.364 1.09c-.078.214-.177.515-.294.88c-1.02 3.095-2.18 6.183-4.16 6.944c-.732.284-1.498.222-2.216-.183c-.953-.541-1.73-1.646-2.455-3.482c-.397-1.016-.735-2.046-1.082-3.081c-.419-1.263-.85-2.569-1.384-3.808c-.419-.965-1.464-1.4-2.796-1.164c-2.768.494-3.232 3.29-3.622 7.5c-.07.733-.137 1.452-.228 2.128c-.011.198-.501 6.38-.814 8.344c-.865 5.39-2.002 7.512-3.89 7.358c-4.66-.398-6.798-20.836-6.684-29.47c.088-6.592-1.104-9-1.818-9.382c-.074-.034-.189-.096-.46.095c-.843.571-1.594 2.348-1.363 4.215c2.566 20.32.674 43.592-3.96 48.833c-1.46 1.649-3.448 1.627-4.832.236c-4.049-4.064-4.218-20.586-4.026-45.33c.11-13.521.254-32.043-1.9-33.504c-2.105.873-2.311 16.172-2.45 26.301c-.163 11.785-.329 23.98-2.246 30.189c-.57 1.84-1.307 3.525-2.782 3.39c-2.091-.186-2.761-3.48-4.321-16.478c-.649-5.4-1.319-10.98-2.101-13.14c-.1-.273-.189-.49-.27-.66c-.832 1.889-1.796 7.079-2.466 10.682c-.927 4.976-1.803 9.676-2.904 11.726c-.846 1.575-2.19 3.63-4.063 3.231c-2.558-.537-3.324-5.693-3.552-8.719c-.003-25.455-3.33-28.417-3.997-28.753l-.106.081l-.166-.036c-2.374 1.038-2.503 9.293-2.629 17.276c-.091 5.856-.194 12.492-1.048 18.701c-1.107 8.05-2.437 9.618-4.111 9.507c-3.846-.262-3.958-13.482-3.958-14.987c0-.472.016-1.028.03-1.642c.074-3.076.207-8.8-1.685-10.604c-.25-.239-.603-.515-.88-.438c-1.347.34-2.75 4.715-3.206 6.155a47 47 0 0 1-.364 1.09q-.16.432-.298.875c-1.02 3.096-2.18 6.187-4.155 6.95c-.736.282-1.506.22-2.22-.185c-.953-.541-1.734-1.646-2.454-3.482c-.398-1.016-.74-2.046-1.083-3.081c-.42-1.263-.854-2.569-1.387-3.808c-.416-.965-1.465-1.4-2.797-1.164c-3.188.567-3.943 4.52-4.55 9.238l-.106.839l-2.411-.32l.114-.824c.527-4.137 1.328-10.39 6.53-11.31c2.446-.435 4.585.581 5.446 2.583c.578 1.34 1.031 2.695 1.466 4.008c.324.99.654 1.98 1.037 2.959c.674 1.708 1.197 2.15 1.392 2.257c1.218-.38 2.462-4.167 2.873-5.414c.13-.402.24-.732.328-.968c.085-.233.195-.571.328-.98c1.097-3.43 2.474-7.144 4.918-7.762c.747-.191 1.903-.166 3.157 1.035c2.665 2.544 2.525 8.48 2.433 12.41c-.014.59-.028 1.126-.028 1.583c0 6.272.93 10.655 1.64 12.16c.367-.77.998-2.63 1.598-7.007c.831-6.066.938-12.624 1.027-18.41c.161-10.24.275-17.663 3.982-19.408c.552-.339 1.469-.522 2.436-.033c3.586 1.803 5.326 11.885 5.326 30.817c.225 2.926 1.013 6.006 1.66 6.448c.004-.066.53-.39 1.394-2.01c.925-1.718 1.845-6.665 2.655-11.026c1.792-9.614 2.606-12.989 4.726-13.166c1.615-.158 2.362 1.896 2.676 2.76c.883 2.422 1.537 7.888 2.23 13.678c.54 4.49 1.31 10.902 2.094 13.497c.084-.228.18-.5.283-.836c1.815-5.878 1.98-17.887 2.14-29.507c.22-16.14.503-26.139 3.448-28.226a2.44 2.44 0 0 1 2.233-.316c3.448 1.144 3.714 11.254 3.519 35.8c-.14 17.799-.313 39.952 3.323 43.603c.317.32.542.32.622.32c.17 0 .413-.161.67-.452c3.681-4.162 6.01-26.022 3.372-46.927c-.328-2.602.677-5.337 2.392-6.514c.946-.652 2.036-.736 2.978-.232c2.145 1.14 3.187 5.024 3.102 11.546c-.15 11.387 2.584 24.714 4.37 26.842c.282-.471.842-1.763 1.379-5.145c.301-1.87.799-8.153.806-8.216c.09-.71.155-1.398.217-2.097c.369-3.924.82-8.804 5.613-9.654c2.444-.435 4.583.577 5.448 2.583c.577 1.34 1.027 2.695 1.46 4.008c.332.99.664 1.98 1.046 2.959c.67 1.708 1.197 2.15 1.387 2.257c1.218-.38 2.467-4.167 2.875-5.41c.132-.402.243-.737.328-.973c.088-.228.195-.57.324-.979c1.1-3.43 2.477-7.144 4.924-7.762c.74-.191 1.9-.166 3.154 1.035c2.665 2.543 2.526 8.48 2.437 12.41q-.029.792-.033 1.583c0 6.272.931 10.655 1.641 12.16c.365-.77.994-2.63 1.601-7.007c.832-6.066.931-12.624 1.027-18.41c.159-10.24.273-17.663 3.98-19.408c.55-.339 1.467-.522 2.44-.033c3.58 1.803 5.325 11.884 5.325 30.817c.224 2.926 1.012 6.006 1.656 6.448c.008-.066.526-.39 1.399-2.01c.923-1.718 1.84-6.665 2.653-11.026c1.786-9.614 2.602-12.989 4.722-13.166c1.62-.158 2.367 1.896 2.68 2.76c.88 2.422 1.535 7.888 2.233 13.678c.534 4.49 1.304 10.902 2.092 13.497c.08-.228.176-.5.28-.836c1.813-5.878 1.976-17.887 2.138-29.507c.216-16.14.504-26.139 3.448-28.226a2.45 2.45 0 0 1 2.234-.316c3.452 1.144 3.718 11.254 3.52 35.8c-.141 17.799-.314 39.952 3.319 43.603c.324.32.544.32.63.32c.165 0 .408-.161.662-.452c3.687-4.162 6.014-26.022 3.375-46.927c-.342-2.723.43-5.47 1.84-6.526c.71-.537 1.575-.647 2.37-.313c2.054.877 3.445 4.63 4.255 11.484c.339 2.87.641 5.974.931 9.036c.641 6.683 1.509 15.69 2.684 17.67c.36-.46 1.096-1.704 2.19-5.038l2.307.753c-1.696 5.157-3.026 7.1-4.755 6.902c-2.69-.299-3.468-5.734-4.84-20.055c-.29-3.048-.59-6.132-.928-8.989c-1.03-8.74-2.782-9.532-2.801-9.54c-.342.174-1.137 1.992-.842 4.31c2.558 20.32.673 43.597-3.964 48.834c-.747.842-1.587 1.27-2.485 1.27`],[`fill`,`#53b9ff`,`d`,`M39.863 54.115L.311 93.716l60.995 61.179L0 216.385l39.428 39.619l61.43-61.507l61.097 61.068l39.552-39.602z`],[`fill`,`#119eff`,`d`,`m140.517 154.896l-39.658 39.601l61.097 61.069l39.552-39.602z`],[`fill-opacity`,`.2`,`d`,`m140.517 154.896l-39.658 39.601l15.267 15.182z`],[`fill`,`#53b9ff`,`d`,`M194.57 100.985L256 39.478L216.431 0l-61.412 61.384L93.917.311L54.365 39.913L216.01 201.761l39.552-39.602z`],[`fill`,`#119eff`,`d`,`m115.36 100.987l39.659-39.602L93.917.313L54.365 39.914z`],[`fill-opacity`,`.2`,`d`,`m115.359 100.985l39.659-39.601l-15.271-15.186z`],[`width`,`40`,`height`,`40`,`alt`,``,3,`src`],[1,`who`],[1,`by`],[1,`login`],[`aria-hidden`,`true`,1,`go`],[1,`sr-only`]],template:function(e,t){if(e&1&&(V(0,`section`,0)(1,`div`,1),U(2,`span`,2)(3,`span`,3),V(4,`span`,4),U(5,`span`,5),H(),V(6,`span`,6),U(7,`span`,5),H(),V(8,`span`,7),U(9,`span`,5),H(),V(10,`div`,8),N(11,NH,2,0,`:svg:svg`,9)(12,PH,11,0,`:svg:svg`,10)(13,FH,5,0,`:svg:svg`,11)(14,IH,7,0,`:svg:svg`,9),H()(),V(15,`p`,12)(16,`span`,13),J(17,`✦`),H(),J(18),H(),V(19,`h2`,14),J(20),H(),V(21,`p`,15),J(22),H(),N(23,LH,13,5,`a`,16),N(24,RH,8,2,`a`,17),V(25,`h3`,18),J(26),H(),V(27,`ul`,19),F(28,zH,2,3,`li`,20,Tg),H()()),e&2){let e,n,r;j(11),P((e=t.info().id)===`nativescript`?11:e===`angular-native`?12:e===`analog`?13:e===`capacitor`?14:-1),j(7),X(` `,t.info().badge),j(2),Y(t.info().heading),j(2),Y(t.info().summary),j(),P((n=t.info().author)?23:-1,n),j(),P((r=t.info().link)?24:-1,r),j(2),X(` `,t.info().link?`In an `+t.info().name+` app`:`On the roadmap`,` `),j(2),I(t.info().plans)}},styles:[`[_nghost-%COMP%] {
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
}`]})},VH=`
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
    outline: 2px solid #f5a524;
    outline-offset: 2px;
  }
  .devframes-dock-entry button.scale-120 {
    transform: none;
    background: rgba(245, 165, 36, 0.16);
    box-shadow: inset 0 0 0 1px rgba(245, 165, 36, 0.6);
  }
  iframe {
    background: #0b0b0e;
    color-scheme: dark;
  }
  @media (prefers-reduced-motion: reduce) {
    .devframes-dock-entry button {
      transition: none;
    }
  }
`;function HH(e,t=50){let n=e?.querySelector(`devframes-dock-standalone`)?.shadowRoot;if(n){if(n.querySelector(`style[data-ng-devtools]`))return;let t=e.createElement(`style`);t.dataset.ngDevtools=``,t.textContent=VH,n.append(t);return}t>0&&setTimeout(()=>HH(e,t-1),100)}var UH=`__DEVFRAME_HUB_CLIENT_CONTEXT__`,WH=`ng-devtools:`;function GH(){try{return window.parent===window?void 0:window.parent[UH]}catch{return}}function KH(e,t,n=50){let r=GH();if(!r){if(n<=0||window.parent===window)return()=>{};let r=()=>{},i=setTimeout(()=>r=KH(e,t,n-1),100);return()=>{clearTimeout(i),r()}}let i=e.map(e=>r.docks.getStateById(WH+e)?.events.on(`entry:activated`,()=>t(e))??(()=>{})),a=r.docks.selectedId,o=e.find(e=>WH+e===a);return o&&t(o),()=>i.forEach(e=>e())}async function qH(e){let t=GH();if(!t)return!1;try{return await t.docks.switchEntry(WH+e)}catch{return!1}}var JH=`ng-devtools-tab`;function YH(e,t,n){let r=new URLSearchParams(e.replace(/^#/,``)).get(`tab`)||t;return n.find(e=>e===r)}function XH(e){try{return sessionStorage.getItem(`${JH}:${e}`)}catch{return null}}function ZH(e,t){try{sessionStorage.setItem(`${JH}:${e}`,t)}catch{}}function QH(e,t){try{return new URL(e,t.href).origin===t.origin}catch{return!1}}function $H(e,t){if(t.protocol!==`chrome-extension:`)return!1;try{let{protocol:t}=new URL(e);return t===`http:`||t===`https:`}catch{return!1}}function eU(e=location){let t=new URLSearchParams(e.search).get(`baseURL`);if(t&&(QH(t,e)||$H(t,e)))return t;if(!(e.pathname.includes(`__ng-devtools`)||e.pathname.includes(`__devframes/`)))return[`/__ng-devtools/`,`./`]}var tU=[`nav`],nU=[`main`],rU=e=>[e],iU=(e,t)=>t.id;function aU(e,t){e&1&&(ps(),R(0,`svg`,4),B(1,`path`,20),z())}function oU(e,t){e&1&&(ps(),R(0,`svg`,4),B(1,`path`,21)(2,`path`,22)(3,`path`,23)(4,`path`,24)(5,`path`,25)(6,`path`,26),z())}function sU(e,t){e&1&&(ps(),R(0,`svg`,5)(1,`defs`)(2,`linearGradient`,27),B(3,`stop`,28)(4,`stop`,29),z()(),B(5,`path`,30),R(6,`g`,31),B(7,`path`,32)(8,`path`,33)(9,`path`,34)(10,`path`,35),z()())}function cU(e,t){e&1&&(ps(),R(0,`svg`,6),B(1,`path`,36)(2,`path`,37)(3,`path`,38)(4,`path`,39),z())}function lU(e,t){e&1&&(ps(),R(0,`svg`,7),B(1,`path`,40),z())}function uU(e,t){e&1&&(ps(),R(0,`svg`,8)(1,`defs`)(2,`linearGradient`,41),B(3,`stop`,42)(4,`stop`,43)(5,`stop`,44)(6,`stop`,45)(7,`stop`,46)(8,`stop`,47),z()(),B(9,`path`,48),z())}function dU(e,t){e&1&&(ps(),R(0,`svg`,9),B(1,`path`,49),z())}function fU(e,t){if(e&1){let e=W();R(0,`button`,51),G(`click`,function(){let t=O(e).$implicit;return k(K(2).switchTab(t.id))}),B(1,`app-tab-icon`,52),R(2,`span`),J(3),z()()}if(e&2){let e=t.$implicit,n=K(2);q(`active`,n.tab()===e.id),M(`aria-current`,n.tab()===e.id?`page`:null),j(),L(`name`,e.id),j(2),Y(e.label)}}function pU(e,t){e&1&&F(0,fU,4,5,`button`,50,iU),e&2&&I(K().tabs())}function mU(e,t){e&1&&(R(0,`p`,16),J(1,` Can't reach the devtools server. Check that the dev server is running, then reload. `),z())}function hU(e,t){e&1&&B(0,`app-coming-soon`,17),e&2&&L(`info`,t)}function gU(e,t){e&1&&(R(0,`p`,18),J(1,`Looking for an Angular Native app…`),z())}function _U(e,t){e&1&&(R(0,`p`,19),J(1,` This inspector is turned off in the devtools config (`),R(2,`code`),J(3,`inspectors`),z(),J(4,`). `),z())}function vU(e,t){if(e&1){let e=W();R(0,`app-dashboard`,55),G(`navigate`,function(t){return O(e),k(K(3).switchTab(t))}),z()}e&2&&L(`rpc`,K(3).rpc())}function yU(e,t){if(e&1){let e=W();R(0,`app-component-tree`,56),G(`focusHandled`,function(){return O(e),k(K(3).componentFocus.set(null))})(`showForm`,function(t){return O(e),k(K(3).showForm(t))}),z()}if(e&2){let e=K(3);L(`rpc`,e.rpc())(`focus`,e.componentFocus())}}function bU(e,t){e&1&&B(0,`app-route-inspector`,53),e&2&&L(`rpc`,K(3).rpc())}function xU(e,t){e&1&&B(0,`app-signal-inspector`,53),e&2&&L(`rpc`,K(3).rpc())}function SU(e,t){e&1&&B(0,`app-di-inspector`,53),e&2&&L(`rpc`,K(3).rpc())}function CU(e,t){e&1&&B(0,`app-store-inspector`,53),e&2&&L(`rpc`,K(3).rpc())}function wU(e,t){e&1&&B(0,`app-network-inspector`,53),e&2&&L(`rpc`,K(3).rpc())}function TU(e,t){if(e&1){let e=W();R(0,`app-forms-inspector`,57),G(`focusHandled`,function(){return O(e),k(K(3).formFocus.set(null))}),z()}if(e&2){let e=K(3);L(`rpc`,e.rpc())(`focus`,e.formFocus())}}function EU(e,t){e&1&&B(0,`app-pipes-inspector`,53),e&2&&L(`rpc`,K(3).rpc())}function DU(e,t){e&1&&B(0,`app-analog-inspector`,53),e&2&&L(`rpc`,K(3).rpc())}function OU(e,t){if(e&1&&N(0,vU,1,1,`app-dashboard`,53)(1,yU,1,2,`app-component-tree`,54)(2,bU,1,1,`app-route-inspector`,53)(3,xU,1,1,`app-signal-inspector`,53)(4,SU,1,1,`app-di-inspector`,53)(5,CU,1,1,`app-store-inspector`,53)(6,wU,1,1,`app-network-inspector`,53)(7,TU,1,2,`app-forms-inspector`,54)(8,EU,1,1,`app-pipes-inspector`,53)(9,DU,1,1,`app-analog-inspector`,53),e&2){let e;P((e=K(2).tab())===`dashboard`?0:e===`components`?1:e===`routes`?2:e===`signals`?3:e===`injectors`?4:e===`store`?5:e===`network`?6:e===`forms`?7:e===`pipes`?8:e===`analog`?9:-1)}}function kU(e,t){e&1&&F(0,OU,10,1,null,null,Tg),e&2&&I(sv(0,rU,K().scopeKey()))}var AU=[`angular`,`ngrx`,`analog`,`angular-native`,`nativescript`,`capacitor`],jU={angular:`Angular`,ngrx:`NgRx Store`,analog:`Analog`,"angular-native":`Angular Native`,nativescript:`NativeScript`,capacitor:`Capacitor`},MU={ngrx:`#d770e8`,analog:`#ff5470`,"angular-native":`#ff4d6d`,nativescript:`#8196ff`,capacitor:`#53b9ff`},NU={ngrx:`store`,analog:`analog`},PU={store:`ngrx`,analog:`analog`},FU={"angular-native":[`components`,`signals`,`injectors`,`store`,`pipes`]},IU={nativescript:{id:`nativescript`,name:`NativeScript`,badge:`Coming Soon`,heading:`NativeScript Support`,summary:`Inspect NativeScript Angular apps running natively on iOS and Android, with the same tools.`,color:`#3c5afd`,plans:[`Native overlay that reports the component tree from the device`,`Standalone devtools server your phone or simulator connects to`,`Example NativeScript app to try it end to end`],pr:16,author:{name:`Nathan Walker`,login:`NathanWalker`}},capacitor:{id:`capacitor`,name:`Capacitor`,badge:`Coming Soon`,heading:`Capacitor Support`,summary:`Connect Ionic and Capacitor apps running in a device WebView back to these tools.`,color:`#119eff`,plans:[`Manual overlay start for apps that load from capacitor:// or a device`,`Connection settings passed in, no cross-origin probing`,`Setup guides for the Android emulator and iOS simulator`],pr:21,author:{name:`Erkam Yaman`,login:`erkamyaman`}}},LU={id:`analog`,name:`Analog`,badge:`Not in this app`,heading:`This app doesn’t use Analog`,summary:`In an Analog app this dock shows your file routes, server load() and API calls, render modes and route lint.`,color:`#dd0330`,plans:[`Which page, layout and .server.ts files render a URL`,`Every load(), server function and API call with timing`,`SSR, prerendered or client only, per page`],link:{label:`Get started with Analog`,href:`https://analogjs.org/docs/getting-started`}},RU={id:`angular-native`,name:`Angular Native`,badge:`Not connected`,heading:`No Angular Native app is connected`,summary:`Start the overlay in your Angular Native app and run this server with --no-auth. The tabs fill as soon as the app reports.`,color:`#e11d48`,plans:[`The component tree, with the view outlined on the device`,`Signals and injectors of the running app`,`Live @ngrx/signals and @ngrx/store state`],link:{label:`Set up Angular Native`,href:`https://github.com/santoshyadavdev/angular-devtools/blob/main/apps/docs/src/content/getting-started/angular-native.md`}};function zU(){let e=new URLSearchParams(location.search).get(`view`);return AU.find(t=>t===e)??null}Ub(class e{analog=A(!1);allTabs=[{id:`dashboard`,label:`Dashboard`},{id:`analog`,label:`Analog`},{id:`components`,label:`Components`},{id:`routes`,label:`Routes`},{id:`signals`,label:`Signals`},{id:`injectors`,label:`Injectors`},{id:`store`,label:`Store`},{id:`forms`,label:`Forms`},{id:`pipes`,label:`Pipes`},{id:`network`,label:`SSR & HTTP`}];view=A(zU());viewAccent=Q(()=>{let e=this.view();return(e&&MU[e])??null});title=Q(()=>{let e=this.view();return e?jU[e]:`Angular DevTools`});analogKnown=A(!1);nativePageId=A(null);nativeKnown=A(!1);scopeKey=Q(()=>this.view()===`angular-native`?this.nativePageId()??``:``);comingSoon=Q(()=>{let e=this.view();return e===`analog`?this.analogKnown()&&!this.analog()?LU:void 0:e===`angular-native`?this.nativeKnown()&&!this.nativePageId()?RU:void 0:e?IU[e]:void 0});config=Q(()=>aE(this.rpc()));tabEnabled=cE;availableTabs=Q(()=>{if(this.comingSoon())return[];let e=this.view(),t=e?NU[e]:void 0,n=this.allTabs.filter(e=>cE(e.id,this.config()));if(t)return n.filter(e=>e.id===t);let r=e?FU[e]:void 0;return r?n.filter(e=>r.includes(e.id)):n.filter(t=>(t.id!==`analog`||this.analog())&&!(e===`angular`&&PU[t.id]))});tabs=Q(()=>{let e=this.availableTabs();if(this.rpc())return e;let t=this.tab();return e.filter(e=>e.id===`dashboard`||e.id===t)});tab=Tv(()=>{let e=this.view();return e&&(NU[e]??FU[e]?.[0])||`dashboard`});rpc=A(null);connected=A(!1);connectionFailed=A(!1);hiddenPages=A([]);pageId=ZT();backgroundNote=Q(()=>{let e=this.hiddenPages();return this.pageId?e.includes(this.pageId)?`Tab in background, showing the last data.`:``:e.length?e.length===1?`A tab is in the background, showing its last data.`:`${e.length} tabs are in the background, showing their last data.`:``});stopVisibility=()=>{};stopNative=()=>{};stopFollowing=()=>{};stopHighlights=()=>{};nav=Rv(`nav`);main=Rv(`main`);injector=E(Ss);navObserver;navFade=A({start:!1,end:!1});constructor(){Ld(()=>{let e=this.nav()?.nativeElement;e&&typeof ResizeObserver<`u`&&(this.navObserver=new ResizeObserver(()=>this.measureNav()),this.navObserver.observe(e))}),ey(()=>{this.tab(),this.tabs(),Cv(()=>{this.revealActiveTab(),this.measureNav()})})}measureNav(){let e=this.nav()?.nativeElement;if(!e)return;let t=e.scrollWidth-e.clientWidth,n=e.scrollLeft>1,r=t>1&&e.scrollLeft<t-1,i=this.navFade();(i.start!==n||i.end!==r)&&this.navFade.set({start:n,end:r})}revealActiveTab(){let e=this.nav()?.nativeElement,t=e?.querySelector(`button.active`);if(!e||!t||e.scrollWidth<=e.clientWidth)return;let n=t.offsetLeft-24,r=t.offsetLeft+t.offsetWidth+24-e.clientWidth;e.scrollLeft>n?e.scrollLeft=Math.max(0,n):e.scrollLeft<r&&(e.scrollLeft=r)}ngOnInit(){this.view()&&(this.stopFollowing=KH(AU,e=>this.showView(e)));try{window.parent!==window&&HH(window.parent.document)}catch{}let e=YH(location.hash,XH(this.tabScope()),this.availableTabs().map(e=>e.id));e&&this.tab.set(e),this.stopHighlights=iE(()=>this.rpc());let t=eU();kT(t?{baseURL:t}:{}).then(e=>{this.rpc.set(e),this.connected.set(!0),this.watchVisibility(e),this.watchAngularNative(e),e.scope(`ng-devtools`).rpc.call(`analog-project`).then(e=>{let t=!!e?.analog;this.analog.set(t),this.analogKnown.set(!0),!t&&this.tab()===`analog`&&!this.view()&&this.tab.set(`dashboard`)},()=>{this.analogKnown.set(!0),this.tab()===`analog`&&!this.view()&&this.tab.set(`dashboard`)}),e.events.on(`connection:status`,e=>{this.connected.set(e===`connected`)})},()=>{this.connectionFailed.set(!0),this.analogKnown.set(!0),this.nativeKnown.set(!0)})}ngOnDestroy(){this.stopNative(),this.stopFollowing(),this.stopVisibility(),this.stopHighlights(),this.navObserver?.disconnect()}showView(e){if(e===this.view())return;XT(e===`angular-native`?this.nativePageId():null),this.view.set(e);let t=new URL(location.href);t.searchParams.set(`view`,e),t.hash=``,history.replaceState(history.state,``,t)}formFocus=A(null);componentFocus=Tv({source:this.tab,computation:()=>null});showForm(e){this.formFocus.set({id:e}),this.switchTab(`forms`)}inspectFromPanel({source:e,origin:t,data:n}){if(e!==window.parent||t!==location.origin)return;let r=n;r?.type===`ng-devtools:inspect-component`&&typeof r.id==`string`&&this.tab()===`components`&&this.config().inspectors.components&&this.componentFocus.set({id:r.id})}switchTab(e){let t=PU[e];if(this.view()===`angular`&&t){this.activateDock(t,e);return}this.setTab(e),history.replaceState(history.state,``,`#tab=${e}`)}setTab(e){this.keepFocus(),this.tab.set(e),ZH(this.tabScope(),e)}tabScope(){return this.view()??`panel`}async watchAngularNative(e){try{let t=await e.scope(`ng-devtools`).rpc.sharedState(`component-tree`),n=e=>{let t=e?.pages,n=XE(t,this.nativePageId());this.view()===`angular-native`&&XT(n),this.nativePageId.set(n),this.nativeKnown.set(!0)};n(t.value()),this.stopNative(),this.stopNative=t.on(`updated`,n)}catch{this.nativeKnown.set(!0)}}async watchVisibility(e){try{let t=await e.scope(`ng-devtools`).rpc.sharedState(`page-visibility`),n=e=>{let t=e?.hidden;this.hiddenPages.set(Array.isArray(t)?t.filter(e=>typeof e==`string`):[])};n(t.value()),this.stopVisibility(),this.stopVisibility=t.on(`updated`,n)}catch{}}keepFocus(){let e=document.activeElement,t=this.main()?.nativeElement;(!e||e===document.body||t?.contains(e))&&Ld(()=>{let e=document.activeElement;e&&e!==document.body||(this.nav()?.nativeElement.querySelector(`button.active`)??this.main()?.nativeElement)?.focus()},{injector:this.injector})}async activateDock(e,t){if(await qH(e))return;if(window.parent===window){this.keepFocus(),this.showView(e);return}let n=this.rpc();if(!n?.call){this.setTab(t);return}try{await n.call(`hub:docks:activate`,{dockId:`ng-devtools:${e}`}),this.keepFocus(),this.showView(e)}catch{this.setTab(t)}}static ɵfac=function(t){return new(t||e)};static ɵcmp=Vh({type:e,selectors:[[`app-root`]],viewQuery:function(e,t){e&1&&e_(t.nav,tU,5)(t.main,nU,5),e&2&&t_(2)},hostVars:2,hostBindings:function(e,t){e&1&&G(`message`,function(e){return t.inspectFromPanel(e)},Mu),e&2&&C_(`--%NS%accent`,t.viewAccent())},decls:28,vars:18,consts:[[`nav`,``],[`main`,``],[1,`brand`],[1,`mark`],[`width`,`22`,`height`,`22`,`viewBox`,`0 0 256 256`,`aria-hidden`,`true`],[`width`,`22`,`height`,`22`,`viewBox`,`0 0 32 32`,`aria-hidden`,`true`],[`width`,`24`,`height`,`17`,`viewBox`,`0 0 256 182`,`aria-hidden`,`true`],[`width`,`22`,`height`,`22`,`viewBox`,`0 0 24 24`,`fill`,`currentColor`,`aria-hidden`,`true`],[`width`,`20`,`height`,`22`,`viewBox`,`0 0 223 236`,`aria-hidden`,`true`],[`width`,`20`,`height`,`22`,`viewBox`,`0 0 223 236`,`fill`,`currentColor`,`aria-hidden`,`true`],[1,`title`],[`aria-label`,`Inspectors`,3,`scroll`],[`role`,`status`,1,`status`],[`aria-hidden`,`true`,1,`dot`],[`tabindex`,`-1`],[`role`,`status`,1,`background-note`],[`role`,`alert`,1,`connection-error`],[3,`info`],[`role`,`status`,1,`turned-off`],[1,`turned-off`],[`fill`,`#3c5afd`,`d`,`M237.248 18.752q18.061 18.06 18.748 45.247V192c-.457 18.12-6.707 33.207-18.748 45.247c-12.04 12.04-27.127 18.291-45.251 18.752H63.999q-27.187-.69-45.247-18.752C6.712 225.208.46 210.121 0 192.001V64q.69-27.187 18.752-45.247Q36.812.692 63.999 0h127.998c18.124.46 33.211 6.711 45.251 18.752m-17.655 103q-6.033-6.003-6.28-15.066V64q-.192-9.063-6.221-15.091c-4.02-4.023-9.054-6.093-15.095-6.22h-21.312v106.626L85.315 42.687H63.999c-6.042.128-11.072 2.198-15.091 6.221c-4.023 4.02-6.093 9.05-6.22 15.09v42.688q-.249 9.063-6.281 15.066q-6.03 5.996-15.091 6.246q9.062.255 15.09 6.25c4.024 4.002 6.115 9.024 6.281 15.066V192c.128 6.037 2.198 11.072 6.221 15.091q6.03 6.03 15.09 6.22h21.317V106.687l85.37 106.627h21.312c6.041-.128 11.076-2.202 15.095-6.221s6.093-9.054 6.22-15.09v-42.688q.249-9.063 6.281-15.066q6.03-5.995 15.091-6.25q-9.062-.25-15.09-6.246`],[`fill`,`#53b9ff`,`d`,`M39.863 54.115L.311 93.716l60.995 61.179L0 216.385l39.428 39.619l61.43-61.507l61.097 61.068l39.552-39.602z`],[`fill`,`#119eff`,`d`,`m140.517 154.896l-39.658 39.601l61.097 61.069l39.552-39.602z`],[`fill-opacity`,`.2`,`d`,`m140.517 154.896l-39.658 39.601l15.267 15.182z`],[`fill`,`#53b9ff`,`d`,`M194.57 100.985L256 39.478L216.431 0l-61.412 61.384L93.917.311L54.365 39.913L216.01 201.761l39.552-39.602z`],[`fill`,`#119eff`,`d`,`m115.36 100.987l39.659-39.602L93.917.313L54.365 39.914z`],[`fill-opacity`,`.2`,`d`,`m115.359 100.985l39.659-39.601l-15.271-15.186z`],[`id`,`an-mark-grad`,`x1`,`0`,`y1`,`0`,`x2`,`1`,`y2`,`1`],[`offset`,`0`,`stop-color`,`#f0224f`],[`offset`,`1`,`stop-color`,`#c4002d`],[`d`,`M16 0C27.2 0 32 4.8 32 16S27.2 32 16 32 0 27.2 0 16 4.8 0 16 0Z`,`fill`,`url(#an-mark-grad)`],[`transform`,`translate(6.4 6.4) scale(0.8)`,`fill`,`#fff`],[`d`,`M14.8486 0L23.138 16.8551L23.9996 3.99892L14.8486 0Z`],[`d`,`M16.9875 17.7114H7.01272L5.73926 20.627L12.0001 24L18.261 20.627L16.9875 17.7114Z`],[`d`,`M8.72168 13.9298H15.2812L11.9997 6.39575L8.72168 13.9298Z`],[`d`,`M9.15103 0L0 3.99892L0.861556 16.8551L9.15103 0Z`],[`fill`,`#c30f2e`,`d`,`M152.228.001L48.455 181.046H256L152.228 0z`],[`fill`,`#dd0330`,`d`,`M88.314 26.967L0 181.52h176.628L88.315 26.967z`],[`fill`,`#fff`,`d`,`M18.167 135.294h220.236v-2.419H18.167z`],[`fill`,`#fff`,`d`,`M204.38 170.667c-.861 0-1.67-.358-2.348-1.034c-4.045-4.063-4.221-20.586-4.026-45.33c.11-13.521.257-32.043-1.9-33.504c-2.104.873-2.315 16.172-2.451 26.301c-.162 11.785-.327 23.98-2.242 30.189c-.57 1.84-1.306 3.525-2.786 3.39c-2.086-.185-2.76-3.48-4.317-16.478c-.647-5.4-1.317-10.98-2.101-13.14a11 11 0 0 0-.269-.66c-.835 1.889-1.8 7.079-2.47 10.682c-.927 4.976-1.803 9.676-2.9 11.726c-.847 1.575-2.19 3.63-4.067 3.231c-2.558-.537-3.323-5.693-3.552-8.719c0-25.455-3.33-28.417-3.997-28.753l-.107.081l-.162-.036c-2.377 1.038-2.506 9.294-2.627 17.276c-.096 5.856-.198 12.492-1.053 18.701c-1.108 8.05-2.448 9.603-4.115 9.507c-3.838-.262-3.95-13.482-3.95-14.987c0-.472.012-1.028.027-1.642c.074-3.076.205-8.8-1.687-10.604c-.25-.239-.603-.515-.879-.437c-1.347.339-2.745 4.714-3.209 6.153c-.147.457-.265.833-.364 1.09c-.078.214-.177.515-.294.88c-1.02 3.095-2.18 6.183-4.16 6.944c-.732.284-1.498.222-2.216-.183c-.953-.541-1.73-1.646-2.455-3.482c-.397-1.016-.735-2.046-1.082-3.081c-.419-1.263-.85-2.569-1.384-3.808c-.419-.965-1.464-1.4-2.796-1.164c-2.768.494-3.232 3.29-3.622 7.5c-.07.733-.137 1.452-.228 2.128c-.011.198-.501 6.38-.814 8.344c-.865 5.39-2.002 7.512-3.89 7.358c-4.66-.398-6.798-20.836-6.684-29.47c.088-6.592-1.104-9-1.818-9.382c-.074-.034-.189-.096-.46.095c-.843.571-1.594 2.348-1.363 4.215c2.566 20.32.674 43.592-3.96 48.833c-1.46 1.649-3.448 1.627-4.832.236c-4.049-4.064-4.218-20.586-4.026-45.33c.11-13.521.254-32.043-1.9-33.504c-2.105.873-2.311 16.172-2.45 26.301c-.163 11.785-.329 23.98-2.246 30.189c-.57 1.84-1.307 3.525-2.782 3.39c-2.091-.186-2.761-3.48-4.321-16.478c-.649-5.4-1.319-10.98-2.101-13.14c-.1-.273-.189-.49-.27-.66c-.832 1.889-1.796 7.079-2.466 10.682c-.927 4.976-1.803 9.676-2.904 11.726c-.846 1.575-2.19 3.63-4.063 3.231c-2.558-.537-3.324-5.693-3.552-8.719c-.003-25.455-3.33-28.417-3.997-28.753l-.106.081l-.166-.036c-2.374 1.038-2.503 9.293-2.629 17.276c-.091 5.856-.194 12.492-1.048 18.701c-1.107 8.05-2.437 9.618-4.111 9.507c-3.846-.262-3.958-13.482-3.958-14.987c0-.472.016-1.028.03-1.642c.074-3.076.207-8.8-1.685-10.604c-.25-.239-.603-.515-.88-.438c-1.347.34-2.75 4.715-3.206 6.155a47 47 0 0 1-.364 1.09q-.16.432-.298.875c-1.02 3.096-2.18 6.187-4.155 6.95c-.736.282-1.506.22-2.22-.185c-.953-.541-1.734-1.646-2.454-3.482c-.398-1.016-.74-2.046-1.083-3.081c-.42-1.263-.854-2.569-1.387-3.808c-.416-.965-1.465-1.4-2.797-1.164c-3.188.567-3.943 4.52-4.55 9.238l-.106.839l-2.411-.32l.114-.824c.527-4.137 1.328-10.39 6.53-11.31c2.446-.435 4.585.581 5.446 2.583c.578 1.34 1.031 2.695 1.466 4.008c.324.99.654 1.98 1.037 2.959c.674 1.708 1.197 2.15 1.392 2.257c1.218-.38 2.462-4.167 2.873-5.414c.13-.402.24-.732.328-.968c.085-.233.195-.571.328-.98c1.097-3.43 2.474-7.144 4.918-7.762c.747-.191 1.903-.166 3.157 1.035c2.665 2.544 2.525 8.48 2.433 12.41c-.014.59-.028 1.126-.028 1.583c0 6.272.93 10.655 1.64 12.16c.367-.77.998-2.63 1.598-7.007c.831-6.066.938-12.624 1.027-18.41c.161-10.24.275-17.663 3.982-19.408c.552-.339 1.469-.522 2.436-.033c3.586 1.803 5.326 11.885 5.326 30.817c.225 2.926 1.013 6.006 1.66 6.448c.004-.066.53-.39 1.394-2.01c.925-1.718 1.845-6.665 2.655-11.026c1.792-9.614 2.606-12.989 4.726-13.166c1.615-.158 2.362 1.896 2.676 2.76c.883 2.422 1.537 7.888 2.23 13.678c.54 4.49 1.31 10.902 2.094 13.497c.084-.228.18-.5.283-.836c1.815-5.878 1.98-17.887 2.14-29.507c.22-16.14.503-26.139 3.448-28.226a2.44 2.44 0 0 1 2.233-.316c3.448 1.144 3.714 11.254 3.519 35.8c-.14 17.799-.313 39.952 3.323 43.603c.317.32.542.32.622.32c.17 0 .413-.161.67-.452c3.681-4.162 6.01-26.022 3.372-46.927c-.328-2.602.677-5.337 2.392-6.514c.946-.652 2.036-.736 2.978-.232c2.145 1.14 3.187 5.024 3.102 11.546c-.15 11.387 2.584 24.714 4.37 26.842c.282-.471.842-1.763 1.379-5.145c.301-1.87.799-8.153.806-8.216c.09-.71.155-1.398.217-2.097c.369-3.924.82-8.804 5.613-9.654c2.444-.435 4.583.577 5.448 2.583c.577 1.34 1.027 2.695 1.46 4.008c.332.99.664 1.98 1.046 2.959c.67 1.708 1.197 2.15 1.387 2.257c1.218-.38 2.467-4.167 2.875-5.41c.132-.402.243-.737.328-.973c.088-.228.195-.57.324-.979c1.1-3.43 2.477-7.144 4.924-7.762c.74-.191 1.9-.166 3.154 1.035c2.665 2.543 2.526 8.48 2.437 12.41q-.029.792-.033 1.583c0 6.272.931 10.655 1.641 12.16c.365-.77.994-2.63 1.601-7.007c.832-6.066.931-12.624 1.027-18.41c.159-10.24.273-17.663 3.98-19.408c.55-.339 1.467-.522 2.44-.033c3.58 1.803 5.325 11.884 5.325 30.817c.224 2.926 1.012 6.006 1.656 6.448c.008-.066.526-.39 1.399-2.01c.923-1.718 1.84-6.665 2.653-11.026c1.786-9.614 2.602-12.989 4.722-13.166c1.62-.158 2.367 1.896 2.68 2.76c.88 2.422 1.535 7.888 2.233 13.678c.534 4.49 1.304 10.902 2.092 13.497c.08-.228.176-.5.28-.836c1.813-5.878 1.976-17.887 2.138-29.507c.216-16.14.504-26.139 3.448-28.226a2.45 2.45 0 0 1 2.234-.316c3.452 1.144 3.718 11.254 3.52 35.8c-.141 17.799-.314 39.952 3.319 43.603c.324.32.544.32.63.32c.165 0 .408-.161.662-.452c3.687-4.162 6.014-26.022 3.375-46.927c-.342-2.723.43-5.47 1.84-6.526c.71-.537 1.575-.647 2.37-.313c2.054.877 3.445 4.63 4.255 11.484c.339 2.87.641 5.974.931 9.036c.641 6.683 1.509 15.69 2.684 17.67c.36-.46 1.096-1.704 2.19-5.038l2.307.753c-1.696 5.157-3.026 7.1-4.755 6.902c-2.69-.299-3.468-5.734-4.84-20.055c-.29-3.048-.59-6.132-.928-8.989c-1.03-8.74-2.782-9.532-2.801-9.54c-.342.174-1.137 1.992-.842 4.31c2.558 20.32.673 43.597-3.964 48.834c-.747.842-1.587 1.27-2.485 1.27`],[`d`,`M12.024.017V0L12 .008L11.976 0v.017L.812 3.892l1.605 14.875l9.559 5.207V24l.024-.013l.024.013v-.026l9.559-5.207l1.605-14.875zm6.868 14.244q-1.64 3.948-6.031 4.166c-2.829 0-4.661-1.7-4.66-1.7q-1.745-1.359-2.398-3.417c-.695-.76-.702-.841-.774-1.145c-.072-.303.045-.388.249-.685q.204-.298.098-.85q-.26-.36-.3-1.128q0-.37.496-.783q.495-.413.607-.632q.083-.119.065-1.031q-.006-.897.995-.975c1-.08 1.565-.832 1.879-1.174c.21-.228.52-.339.91-.341c.551-.026 1.052.185 1.484.62c1.075-.055 2.176.235 3.292.863q2.379 1.414 2.596 3.055q-.257 2.158-5.788-.113q-2.895.819-2.846 3.552q0 2.508 2.422 3.643c-.787-.772-1.122-1.422-1.01-1.959q2.456 2.906 5.588 2.173c-.92.032-1.65-.264-2.198-.893q2.116-.05 3.998-1.972c-.724.576-1.482.794-2.284.657q3.26-2.563 2.307-5.98l-.002-.006a3.02 3.02 0 0 1 .788 2.03q.023 1.175-.795 2.477q.613-.478 1.413-2.047c.23 2.117-.625 3.724-2.574 4.825q.934-.085 2.473-1.23m-5.567-6.63a.319.319 0 1 1 .638 0a.319.319 0 0 1-.638 0`],[`id`,`ng-grad`,`x1`,`49`,`x2`,`226`,`y1`,`214`,`y2`,`130`,`gradientUnits`,`userSpaceOnUse`],[`stop-color`,`#E40035`],[`offset`,`.24`,`stop-color`,`#F60A48`],[`offset`,`.352`,`stop-color`,`#F20755`],[`offset`,`.494`,`stop-color`,`#DC087D`],[`offset`,`.745`,`stop-color`,`#9717E7`],[`offset`,`1`,`stop-color`,`#6C00F5`],[`fill`,`url(#ng-grad)`,`d`,`m222.077 39.192-8.019 125.923L137.387 0l84.69 39.192Zm-53.105 162.825-57.933 33.056-57.934-33.056 11.783-28.556h92.301l11.783 28.556ZM111.039 62.675l30.357 73.803H80.681l30.358-73.803ZM7.937 165.115 0 39.192 84.69 0 7.937 165.115Z`],[`d`,`m222.077 39.192-8.019 125.923L137.387 0l84.69 39.192Zm-53.105 162.825-57.933 33.056-57.934-33.056 11.783-28.556h92.301l11.783 28.556ZM111.039 62.675l30.357 73.803H80.681l30.358-73.803ZM7.937 165.115 0 39.192 84.69 0 7.937 165.115Z`],[`type`,`button`,3,`active`],[`type`,`button`,3,`click`],[3,`name`],[3,`rpc`],[3,`rpc`,`focus`],[3,`navigate`,`rpc`],[3,`focusHandled`,`showForm`,`rpc`,`focus`],[3,`focusHandled`,`rpc`,`focus`]],template:function(e,t){if(e&1&&(R(0,`header`)(1,`h1`,2)(2,`span`,3),N(3,aU,2,0,`:svg:svg`,4)(4,oU,7,0,`:svg:svg`,4)(5,sU,11,0,`:svg:svg`,5)(6,cU,5,0,`:svg:svg`,6)(7,lU,2,0,`:svg:svg`,7)(8,uU,10,0,`:svg:svg`,8)(9,dU,2,0,`:svg:svg`,9),z(),R(10,`span`,10),J(11),z()(),R(12,`nav`,11,0),G(`scroll`,function(){return t.measureNav()}),N(14,pU,2,0),z(),R(15,`span`,12)(16,`span`,13),B(17,`span`),z(),J(18),z()(),R(19,`main`,14,1)(21,`p`,15),J(22),z(),N(23,mU,2,0,`p`,16)(24,hU,1,1,`app-coming-soon`,17)(25,gU,2,0,`p`,18)(26,_U,5,0,`p`,19)(27,kU,2,2),z()),e&2){let e;j(2),q(`ng-mark`,t.view()===`angular`),j(),P(t.view()===`nativescript`?3:t.view()===`capacitor`?4:t.view()===`angular-native`?5:t.view()===`analog`?6:t.view()===`ngrx`?7:t.view()===`angular`?8:9),j(7),q(`ng-text`,t.view()===`angular`),j(),Y(t.title()),j(),q(`fade-start`,t.navFade().start)(`fade-end`,t.navFade().end),j(2),P(t.availableTabs().length>1?14:-1),j(),q(`connected`,t.connected())(`failed`,t.connectionFailed()),j(3),X(` `,t.connected()?`Live`:t.connectionFailed()?`Disconnected`:`Connecting…`,` `),j(4),Y(t.backgroundNote()),j(),P(t.connectionFailed()?23:(e=t.comingSoon())?24:t.view()===`angular-native`&&!t.nativePageId()?25:t.tabEnabled(t.tab(),t.config())?27:26,e)}},dependencies:[JE,rk,kM,VN,ZP,kI,jR,Az,LV,MH,BH,yE],styles:[`[_nghost-%COMP%] {
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