(function(){let e=document.createElement(`link`).relList;if(e&&e.supports&&e.supports(`modulepreload`))return;for(let e of document.querySelectorAll(`link[rel="modulepreload"]`))n(e);new MutationObserver(e=>{for(let t of e)if(t.type===`childList`)for(let e of t.addedNodes)e.tagName===`LINK`&&e.rel===`modulepreload`&&n(e)}).observe(document,{childList:!0,subtree:!0});function t(e){let t={};return e.integrity&&(t.integrity=e.integrity),e.referrerPolicy&&(t.referrerPolicy=e.referrerPolicy),t.credentials=e.crossOrigin===`use-credentials`?`include`:e.crossOrigin===`anonymous`?`omit`:`same-origin`,t}function n(e){if(e.ep)return;e.ep=!0;let n=t(e);fetch(e.href,n)}})();var e=Object.defineProperty,t=Object.getOwnPropertySymbols,n=Object.prototype.hasOwnProperty,r=Object.prototype.propertyIsEnumerable,i=(t,n,r)=>n in t?e(t,n,{enumerable:!0,configurable:!0,writable:!0,value:r}):t[n]=r,a=(e,a)=>{for(var o in a||={})n.call(a,o)&&i(e,o,a[o]);if(t)for(var o of t(a))r.call(a,o)&&i(e,o,a[o]);return e},o=(e,t,n)=>(i(e,typeof t==`symbol`?t:t+``,n),n),s=globalThis;function c(e){let t=s.__Zone_symbol_prefix;return(typeof t==`string`?t:`__zone_symbol__`)+e}function l(){let e=s.performance;function t(t){e&&e.mark&&e.mark(t)}function n(t,n){e&&e.measure&&e.measure(t,n)}t(`Zone`);let r=class e{constructor(e,t){o(this,`_parent`),o(this,`_name`),o(this,`_properties`),o(this,`_zoneDelegate`),this._parent=e,this._name=t?t.name||`unnamed`:`<root>`,this._properties=t&&t.properties||{},this._zoneDelegate=new l(this,this._parent&&this._parent._zoneDelegate,t)}static assertZonePatched(){if(s.Promise!==ce.ZoneAwarePromise)throw Error("Zone.js has detected that ZoneAwarePromise `(window|global).Promise` has been overwritten.\nMost likely cause is that a Promise polyfill has been loaded after Zone.js (Polyfilling Promise api is not necessary when zone.js is loaded. If you must load one, do so before loading zone.js.)")}static get root(){let t=e.current;for(;t.parent;)t=t.parent;return t}static get current(){return ue.zone}static get currentTask(){return de}static __load_patch(r,i,a=!1){if(Object.hasOwn(ce,r)){let e=s[c(`forceDuplicateZoneCheck`)]===!0;if(!a&&e)throw Error(`Already loaded patch: `+r)}else if(!s[`__Zone_disable_`+r]){let a=`Zone:`+r;t(a),ce[r]=i(s,e,le),n(a,a)}}get parent(){return this._parent}get name(){return this._name}get(e){let t=this.getZoneWith(e);if(t)return t._properties[e]}getZoneWith(e){let t=this;for(;t;){if(Object.hasOwn(t._properties,e))return t;t=t._parent}return null}fork(e){if(!e)throw Error(`ZoneSpec required!`);return this._zoneDelegate.fork(this,e)}wrap(e,t){if(typeof e!=`function`)throw Error(`Expecting function got: `+e);let n=this._zoneDelegate.intercept(this,e,t),r=this;return function(){return r.runGuarded(n,this,arguments,t)}}run(e,t,n,r){ue={parent:ue,zone:this};try{return this._zoneDelegate.invoke(this,e,t,n,r)}finally{ue=ue.parent}}runGuarded(e,t=null,n,r){ue={parent:ue,zone:this};try{try{return this._zoneDelegate.invoke(this,e,t,n,r)}catch(e){if(this._zoneDelegate.handleError(this,e))throw e}}finally{ue=ue.parent}}runTask(e,t,n){if(e.zone!=this)throw Error(`A task can only be run in the zone of creation! (Creation: `+(e.zone||ee).name+`; Execution: `+this.name+`)`);let r=e,{type:i,data:{isPeriodic:a=!1,isRefreshable:o=!1}={}}=e;if(e.state===te&&(i===S||i===se))return;let s=e.state!=x;s&&r._transitionTo(x,re);let c=de;de=r,ue={parent:ue,zone:this};try{i==se&&e.data&&!a&&!o&&(e.cancelFn=void 0);try{return this._zoneDelegate.invokeTask(this,r,t,n)}catch(e){if(this._zoneDelegate.handleError(this,e))throw e}}finally{let t=e.state;if(t!==te&&t!==ae){if(i==S||a||o&&t===ne)s&&r._transitionTo(re,x,ne);else{let e=r._zoneDelegates;this._updateTaskCount(r,-1),s&&r._transitionTo(te,x,te),o&&(r._zoneDelegates=e)}}ue=ue.parent,de=c}}scheduleTask(e){if(e.zone&&e.zone!==this){let t=this;for(;t;){if(t===e.zone)throw Error(`can not reschedule task to ${this.name} which is descendants of the original zone ${e.zone.name}`);t=t.parent}}e._transitionTo(ne,te);let t=[];e._zoneDelegates=t,e._zone=this;try{e=this._zoneDelegate.scheduleTask(this,e)}catch(t){throw e._transitionTo(ae,ne,te),this._zoneDelegate.handleError(this,t),t}return e._zoneDelegates===t&&this._updateTaskCount(e,1),e.state==ne&&e._transitionTo(re,ne),e}scheduleMicroTask(e,t,n,r){return this.scheduleTask(new u(oe,e,t,n,r,void 0))}scheduleMacroTask(e,t,n,r,i){return this.scheduleTask(new u(se,e,t,n,r,i))}scheduleEventTask(e,t,n,r,i){return this.scheduleTask(new u(S,e,t,n,r,i))}cancelTask(e){if(e.zone!=this)throw Error(`A task can only be cancelled in the zone of creation! (Creation: `+(e.zone||ee).name+`; Execution: `+this.name+`)`);if(e.state===re||e.state===x){e._transitionTo(ie,re,x);try{this._zoneDelegate.cancelTask(this,e)}catch(t){throw e._transitionTo(ae,ie),this._zoneDelegate.handleError(this,t),t}return this._updateTaskCount(e,-1),e._transitionTo(te,ie),e.runCount=-1,e}}_updateTaskCount(e,t){let n=e._zoneDelegates;t==-1&&(e._zoneDelegates=null);for(let r=0;r<n.length;r++)n[r]._updateTaskCount(e.type,t)}};o(r,`__symbol__`,c);let i=r,a={name:``,onHasTask:(e,t,n,r)=>e.hasTask(n,r),onScheduleTask:(e,t,n,r)=>e.scheduleTask(n,r),onInvokeTask:(e,t,n,r,i,a)=>e.invokeTask(n,r,i,a),onCancelTask:(e,t,n,r)=>e.cancelTask(n,r)};class l{constructor(e,t,n){o(this,`_zone`),o(this,`_taskCounts`,{microTask:0,macroTask:0,eventTask:0}),o(this,`_forkDlgt`),o(this,`_forkZS`),o(this,`_forkCurrZone`),o(this,`_interceptDlgt`),o(this,`_interceptZS`),o(this,`_interceptCurrZone`),o(this,`_invokeDlgt`),o(this,`_invokeZS`),o(this,`_invokeCurrZone`),o(this,`_handleErrorDlgt`),o(this,`_handleErrorZS`),o(this,`_handleErrorCurrZone`),o(this,`_scheduleTaskDlgt`),o(this,`_scheduleTaskZS`),o(this,`_scheduleTaskCurrZone`),o(this,`_invokeTaskDlgt`),o(this,`_invokeTaskZS`),o(this,`_invokeTaskCurrZone`),o(this,`_cancelTaskDlgt`),o(this,`_cancelTaskZS`),o(this,`_cancelTaskCurrZone`),o(this,`_hasTaskDlgt`),o(this,`_hasTaskDlgtOwner`),o(this,`_hasTaskZS`),o(this,`_hasTaskCurrZone`),this._zone=e,this._forkZS=n&&(n&&n.onFork?n:t._forkZS),this._forkDlgt=n&&(n.onFork?t:t._forkDlgt),this._forkCurrZone=n&&(n.onFork?this._zone:t._forkCurrZone),this._interceptZS=n&&(n.onIntercept?n:t._interceptZS),this._interceptDlgt=n&&(n.onIntercept?t:t._interceptDlgt),this._interceptCurrZone=n&&(n.onIntercept?this._zone:t._interceptCurrZone),this._invokeZS=n&&(n.onInvoke?n:t._invokeZS),this._invokeDlgt=n&&(n.onInvoke?t:t._invokeDlgt),this._invokeCurrZone=n&&(n.onInvoke?this._zone:t._invokeCurrZone),this._handleErrorZS=n&&(n.onHandleError?n:t._handleErrorZS),this._handleErrorDlgt=n&&(n.onHandleError?t:t._handleErrorDlgt),this._handleErrorCurrZone=n&&(n.onHandleError?this._zone:t._handleErrorCurrZone),this._scheduleTaskZS=n&&(n.onScheduleTask?n:t._scheduleTaskZS),this._scheduleTaskDlgt=n&&(n.onScheduleTask?t:t._scheduleTaskDlgt),this._scheduleTaskCurrZone=n&&(n.onScheduleTask?this._zone:t._scheduleTaskCurrZone),this._invokeTaskZS=n&&(n.onInvokeTask?n:t._invokeTaskZS),this._invokeTaskDlgt=n&&(n.onInvokeTask?t:t._invokeTaskDlgt),this._invokeTaskCurrZone=n&&(n.onInvokeTask?this._zone:t._invokeTaskCurrZone),this._cancelTaskZS=n&&(n.onCancelTask?n:t._cancelTaskZS),this._cancelTaskDlgt=n&&(n.onCancelTask?t:t._cancelTaskDlgt),this._cancelTaskCurrZone=n&&(n.onCancelTask?this._zone:t._cancelTaskCurrZone),this._hasTaskZS=null,this._hasTaskDlgt=null,this._hasTaskDlgtOwner=null,this._hasTaskCurrZone=null;let r=n&&n.onHasTask,i=t&&t._hasTaskZS;(r||i)&&(this._hasTaskZS=r?n:a,this._hasTaskDlgt=t,this._hasTaskDlgtOwner=this,this._hasTaskCurrZone=this._zone,n.onScheduleTask||(this._scheduleTaskZS=a,this._scheduleTaskDlgt=t,this._scheduleTaskCurrZone=this._zone),n.onInvokeTask||(this._invokeTaskZS=a,this._invokeTaskDlgt=t,this._invokeTaskCurrZone=this._zone),n.onCancelTask||(this._cancelTaskZS=a,this._cancelTaskDlgt=t,this._cancelTaskCurrZone=this._zone))}get zone(){return this._zone}fork(e,t){return this._forkZS?this._forkZS.onFork(this._forkDlgt,this.zone,e,t):new i(e,t)}intercept(e,t,n){return this._interceptZS?this._interceptZS.onIntercept(this._interceptDlgt,this._interceptCurrZone,e,t,n):t}invoke(e,t,n,r,i){return this._invokeZS?this._invokeZS.onInvoke(this._invokeDlgt,this._invokeCurrZone,e,t,n,r,i):t.apply(n,r)}handleError(e,t){return!this._handleErrorZS||this._handleErrorZS.onHandleError(this._handleErrorDlgt,this._handleErrorCurrZone,e,t)}scheduleTask(e,t){let n=t;if(this._scheduleTaskZS)this._hasTaskZS&&n._zoneDelegates.push(this._hasTaskDlgtOwner),n=this._scheduleTaskZS.onScheduleTask(this._scheduleTaskDlgt,this._scheduleTaskCurrZone,e,t),n||=t;else if(t.scheduleFn)t.scheduleFn(t);else if(t.type==oe)y(t);else throw Error(`Task is missing scheduleFn.`);return n}invokeTask(e,t,n,r){return this._invokeTaskZS?this._invokeTaskZS.onInvokeTask(this._invokeTaskDlgt,this._invokeTaskCurrZone,e,t,n,r):t.callback.apply(n,r)}cancelTask(e,t){let n;if(this._cancelTaskZS)n=this._cancelTaskZS.onCancelTask(this._cancelTaskDlgt,this._cancelTaskCurrZone,e,t);else{if(!t.cancelFn)throw Error(`Task is not cancelable`);n=t.cancelFn(t)}return n}hasTask(e,t){try{this._hasTaskZS&&this._hasTaskZS.onHasTask(this._hasTaskDlgt,this._hasTaskCurrZone,e,t)}catch(t){this.handleError(e,t)}}_updateTaskCount(e,t){let n=this._taskCounts,r=n[e],i=n[e]=r+t;if(i<0)throw Error(`More tasks executed then were scheduled.`);if(r==0||i==0){let t={microTask:n.microTask>0,macroTask:n.macroTask>0,eventTask:n.eventTask>0,change:e};this.hasTask(this._zone,t)}}}class u{constructor(e,t,n,r,i,a){if(o(this,`type`),o(this,`source`),o(this,`invoke`),o(this,`callback`),o(this,`data`),o(this,`scheduleFn`),o(this,`cancelFn`),o(this,`_zone`,null),o(this,`runCount`,0),o(this,`_zoneDelegates`,null),o(this,`_state`,`notScheduled`),this.type=e,this.source=t,this.data=r,this.scheduleFn=i,this.cancelFn=a,!n)throw Error(`callback is not defined`);this.callback=n;let c=this;this.invoke=e===S&&r&&r.useG?u.invokeTask:function(){return u.invokeTask.call(s,c,this,arguments)}}static invokeTask(e,t,n){e||=this,fe++;try{return e.runCount++,e.zone.runTask(e,t,n)}finally{try{fe===1&&!s[m]&&b()}finally{fe--}}}get zone(){return this._zone}get state(){return this._state}cancelScheduleRequest(){this._transitionTo(te,ne)}_transitionTo(e,t,n){if(this._state===t||this._state===n)this._state=e,e==te&&(this._zoneDelegates=null);else throw Error(`${this.type} '${this.source}': can not transition to '${e}', expecting state '${t}'${n?` or '`+n+`'`:``}, was '${this._state}'.`)}toString(){return this.data&&this.data.handleId!==void 0?this.data.handleId.toString():Object.prototype.toString.call(this)}toJSON(){return{type:this.type,state:this.state,source:this.source,zone:this.zone.name,runCount:this.runCount}}}let d=c(`setTimeout`),f=c(`Promise`),p=c(`then`),m=c(`enable_native_microtask_draining`),h=[],g=!1,_;function v(e){!_&&s[f]&&(_=s[f].resolve(0)),_?(_[p]??_.then).call(_,e):s[d](e,0)}function y(e){let t=s[m],n=t&&h.length===0&&!g,r=!t&&fe===0&&h.length===0;(n||r)&&v(b),e&&h.push(e)}function b(){if(!g){g=!0;try{for(;h.length;){let e=h;h=[];for(let t of e)try{t.zone.runTask(t,null,null)}catch(e){le.onUnhandledError(e)}}}finally{if(s[m])g=!1,le.microtaskDrainDone();else try{le.microtaskDrainDone()}finally{g=!1}}}}let ee={name:`NO ZONE`},te=`notScheduled`,ne=`scheduling`,re=`scheduled`,x=`running`,ie=`canceling`,ae=`unknown`,oe=`microTask`,se=`macroTask`,S=`eventTask`,ce=Object.create(null),le={symbol:c,currentZoneFrame:()=>ue,onUnhandledError:pe,microtaskDrainDone:pe,scheduleMicroTask:y,showUncaughtError:()=>!i[c(`ignoreConsoleErrorUncaughtError`)],patchEventTarget:()=>[],patchOnProperties:pe,patchMethod:()=>pe,bindArguments:()=>[],patchThen:()=>pe,patchMacroTask:()=>pe,patchEventPrototype:()=>pe,getGlobalObjects:()=>void 0,ObjectDefineProperty:()=>pe,ObjectGetOwnPropertyDescriptor:()=>void 0,ObjectCreate:()=>void 0,ArraySlice:()=>[],patchClass:()=>pe,wrapWithCurrentZone:()=>pe,filterProperties:()=>[],attachOriginToPatched:()=>pe,_redefineProperty:()=>pe,patchCallbacks:()=>pe,nativeScheduleMicroTask:v},ue={parent:null,zone:new i(null,null)},de=null,fe=0;function pe(){}return n(`Zone`,`Zone`),i}function u(){let e=globalThis,t=e[c(`forceDuplicateZoneCheck`)]===!0;if(e.Zone&&(t||typeof e.Zone.__symbol__!=`function`))throw Error(`Zone already loaded.`);return e.Zone??=l(),e.Zone}var d=Object.getOwnPropertyDescriptor,f=Object.defineProperty,p=Object.getPrototypeOf,m=Object.create,h=Array.prototype.slice,g=`addEventListener`,_=`removeEventListener`,v=c(g),y=c(_),b=`true`,ee=`false`,te=c(``);function ne(e,t){return Zone.current.wrap(e,t)}function re(e,t,n,r,i){return Zone.current.scheduleMacroTask(e,t,n,r,i)}var x=c,ie=typeof window<`u`,ae=ie?window:void 0,oe=ie&&ae||globalThis,se=`removeAttribute`;function S(e,t){for(let n=e.length-1;n>=0;n--)typeof e[n]==`function`&&(e[n]=ne(e[n],t+`_`+n));return e}function ce(e,t){let n=e.constructor.name;for(let r=0;r<t.length;r++){let i=t[r],a=e[i];if(a){if(!le(d(e,i)))continue;e[i]=(e=>{let t=function(){return e.apply(this,S(arguments,n+`.`+i))};return Ce(t,e),t})(a)}}}function le(e){return e?e.writable===!1?!1:typeof e.get!=`function`||e.set!==void 0:!0}var ue=typeof WorkerGlobalScope<`u`&&self instanceof WorkerGlobalScope,de=!(`nw`in oe)&&oe.process!==void 0&&oe.process.toString()===`[object process]`,fe=!de&&!ue&&!!(ie&&ae.HTMLElement),pe=oe.process!==void 0&&oe.process.toString()===`[object process]`&&!ue&&!!(ie&&ae.HTMLElement),me=Object.create(null),he=x(`enable_beforeunload`),ge=function(e){if(e||=oe.event,!e)return;let t=me[e.type];t||=me[e.type]=x(`ON_PROPERTY`+e.type);let n=this||e.target||oe,r=n[t],i;if(fe&&n===ae&&e.type===`error`){let t=e;i=r&&r.call(this,t.message,t.filename,t.lineno,t.colno,t.error),i===!0&&e.preventDefault()}else i=r&&r.apply(this,arguments),e.type===`beforeunload`&&oe[he]&&typeof i==`string`?e.returnValue=i:i!=null&&!i&&e.preventDefault();return i};function _e(e,t,n){let r=d(e,t);if(!r&&n&&d(n,t)&&(r={enumerable:!0,configurable:!0}),!r||!r.configurable)return;let i=x(`on`+t+`patched`);if(Object.hasOwn(e,i)&&e[i])return;delete r.writable,delete r.value;let a=r.get,o=r.set,s=t.slice(2),c=me[s];c||=me[s]=x(`ON_PROPERTY`+s),r.set=function(t){let n=this;!n&&e===oe&&(n=oe),n&&(typeof n[c]==`function`&&n.removeEventListener(s,ge),o?.call(n,null),n[c]=t,typeof t==`function`&&n.addEventListener(s,ge,!1))},r.get=function(){let n=this;if(!n&&e===oe&&(n=oe),!n)return null;let i=n[c];if(i)return i;if(a){let e=a.call(this);if(e)return r.set.call(this,e),typeof n[se]==`function`&&n.removeAttribute(t),e}return null},f(e,t,r),e[i]=!0}function ve(e,t,n){if(t)for(let r=0;r<t.length;r++)_e(e,`on`+t[r],n);else{let t=[];for(let n in e)n.slice(0,2)==`on`&&t.push(n);for(let r=0;r<t.length;r++)_e(e,t[r],n)}}var ye=x(`originalInstance`);function be(e){let t=oe[e];if(!t)return;oe[x(e)]=t,oe[e]=function(){let n=S(arguments,e);switch(n.length){case 0:this[ye]=new t;break;case 1:this[ye]=new t(n[0]);break;case 2:this[ye]=new t(n[0],n[1]);break;case 3:this[ye]=new t(n[0],n[1],n[2]);break;case 4:this[ye]=new t(n[0],n[1],n[2],n[3]);break;default:throw Error(`Arg list too long.`)}},Ce(oe[e],t);let n=new t(function(){}),r;for(r in n)(e!==`XMLHttpRequest`||r!==`responseBlob`)&&(function(t){typeof n[t]==`function`?oe[e].prototype[t]=function(){return this[ye][t].apply(this[ye],arguments)}:f(oe[e].prototype,t,{set:function(n){typeof n==`function`?(this[ye][t]=ne(n,e+`.`+t),Ce(this[ye][t],n)):this[ye][t]=n},get:function(){return this[ye][t]}})})(r);for(r in t)r!==`prototype`&&Object.hasOwn(t,r)&&(oe[e][r]=t[r])}function xe(e,t,n){let r=e;for(;r&&!Object.hasOwn(r,t);)r=p(r);!r&&e[t]&&(r=e);let i=x(t),a=null;if(r&&(!(a=r[i])||!Object.hasOwn(r,i))&&(a=r[i]=r[t],le(r&&d(r,t)))){let e=n(a,i,t);r[t]=function(){return e(this,arguments)},Ce(r[t],a)}return a}function Se(e,t,n){let r=null;function i(e){let t=e.data;return t.args[t.cbIdx]=function(){e.invoke.apply(this,arguments)},r.apply(t.target,t.args),e}r=xe(e,t,e=>function(t,r){let a=n(t,r);return a.cbIdx>=0&&typeof r[a.cbIdx]==`function`?re(a.name,r[a.cbIdx],a,i):e.apply(t,r)})}function Ce(e,t){e[x(`OriginalDelegate`)]=t}function we(e){return typeof e==`function`}function Te(e){return typeof e==`number`}var Ee={useG:!0},De=Object.create(null),Oe={},ke=RegExp(`^`+te+`(\\w+)(true|false)$`),Ae=x(`propagationStopped`),je=[`capture`,`once`,`passive`,`signal`];function Me(e,t){let n=(t?t(e):e)+ee,r=(t?t(e):e)+b,i=te+n,a=te+r;De[e]={[ee]:i,[b]:a}}function Ne(e,t,n,r){let i=r&&r.add||g,o=r&&r.rm||_,s=r&&r.listeners||`eventListeners`,c=r&&r.rmAll||`removeAllListeners`,l=x(i),u=`.`+i+`:`,d=function(e,t,n){if(e.isRemoved)return;let r=e.callback;typeof r==`object`&&r.handleEvent&&(e.callback=e=>r.handleEvent(e),e.originalDelegate=r);let i;try{e.invoke(e,t,[n])}catch(e){i=e}let a=e.options;if(a&&typeof a==`object`&&a.once){let r=e.originalDelegate?e.originalDelegate:e.callback;t[o].call(t,n.type,r,a)}return i};function f(n,r,i){if(r||=e.event,!r)return;let a=n||r.target||e,o=a[De[r.type][i?b:ee]];if(o){let e=[];if(o.length===1){let t=d(o[0],a,r);t&&e.push(t)}else{let t=o.slice();for(let n=0;n<t.length&&!(r&&r[Ae]===!0);n++){let i=d(t[n],a,r);i&&e.push(i)}}if(e.length===1)throw e[0];for(let n=0;n<e.length;n++){let r=e[n];t.nativeScheduleMicroTask(()=>{throw r})}}}let m=function(e){return f(this,e,!1)},h=function(e){return f(this,e,!0)};function v(t,n){if(!t)return!1;let r=!0;n&&n.useG!==void 0&&(r=n.useG);let d=n&&n.vh,f=!0;n&&n.chkDup!==void 0&&(f=n.chkDup);let g=!1;n&&n.rt!==void 0&&(g=n.rt);let _=t;for(;_&&!Object.hasOwn(_,i);)_=p(_);if(!_&&t[i]&&(_=t),!_||_[l])return!1;let v=n&&n.eventNameToString,y={},ne=_[l]=_[i],re=_[x(o)]=_[o],ie=_[x(s)]=_[s],ae=_[x(c)]=_[c],oe;n&&n.prepend&&(oe=_[x(n.prepend)]=_[n.prepend]);function se(e,t){return t?typeof e==`boolean`?{capture:e,passive:!0}:e?(typeof e==`object`&&e.passive!==!1&&(e.passive=!0),e):{passive:!0}:e}let S=function(e){if(!y.isExisting)return ne.call(y.target,y.eventName,y.capture?h:m,y.options)},ce=function(e){if(!e.isRemoved){let t=De[e.eventName],n;t&&(n=t[e.capture?b:ee]);let r=n&&e.target[n];if(r){for(let t=0;t<r.length;t++)if(r[t]===e){r.splice(t,1),e.isRemoved=!0,e.removeAbortListener&&=(e.removeAbortListener(),null),r.length===0&&(e.allRemoved=!0,e.target[n]=null);break}}}if(e.allRemoved)return re.call(e.target,e.eventName,e.capture?h:m,e.options)},le=function(e){return ne.call(y.target,y.eventName,e.invoke,y.options)},ue=function(e){return oe.call(y.target,y.eventName,e.invoke,y.options)},fe=function(e){return re.call(e.target,e.eventName,e.invoke,e.options)},pe=r?S:le,me=r?ce:fe,he=n?.diff||function(e,t){let n=typeof t;return n===`function`&&e.callback===t||n===`object`&&e.originalDelegate===t},ge=Zone[x(`UNPATCHED_EVENTS`)],_e=e[x(`PASSIVE_EVENTS`)];function ve(e){if(typeof e!=`object`||!e)return e;let t=a({},e);for(let n of je)!Object.hasOwn(t,n)&&n in e&&(t[n]=e[n]);return t}let ye=function(t,i,a,o,s=!1,c=!1){return function(){let l=this||e,u=arguments[0];n&&n.transferEventName&&(u=n.transferEventName(u));let p=arguments[1];if(!p||de&&u===`uncaughtException`)return t.apply(this,arguments);let m=!1;if(typeof p!=`function`){if(!p.handleEvent)return t.apply(this,arguments);m=!0}if(d&&!d(t,p,l,arguments))return;let h=!!_e&&_e.indexOf(u)!==-1,g=se(ve(arguments[2]),h),_=g?.signal;if(_?.aborted)return;if(ge){for(let e=0;e<ge.length;e++)if(u===ge[e])return h?t.call(l,u,p,g):t.apply(this,arguments)}let te=g?typeof g==`boolean`||g.capture:!1,ne=g&&typeof g==`object`?g.once:!1,re=Zone.current,x=De[u];x||=(Me(u,v),De[u]);let ie=x[te?b:ee],ae=l[ie],oe=!1;if(ae){if(oe=!0,f){for(let e=0;e<ae.length;e++)if(he(ae[e],p))return}}else ae=l[ie]=[];let S,ce=l.constructor.name,le=Oe[ce];le&&(S=le[u]),S||=ce+i+(v?v(u):u),y.options=g,ne&&(y.options.once=!1),y.target=l,y.capture=te,y.eventName=u,y.isExisting=oe;let ue=r?Ee:void 0;ue&&(ue.taskData=y),_&&(y.options.signal=void 0);let fe=re.scheduleEventTask(S,p,ue,a,o);if(_){y.options.signal=_;let e=()=>fe.zone.cancelTask(fe);t.call(_,`abort`,e,{once:!0}),fe.removeAbortListener=()=>_.removeEventListener(`abort`,e)}if(y.target=null,ue&&(ue.taskData=null),ne&&(y.options.once=!0),typeof fe.options!=`boolean`&&(fe.options=g),fe.target=l,fe.capture=te,fe.eventName=u,m&&(fe.originalDelegate=p),c?ae.unshift(fe):ae.push(fe),s)return l}};return _[i]=ye(ne,u,pe,me,g),oe&&(_.prependListener=ye(oe,`.prependListener:`,ue,me,g,!0)),_[o]=function(){let t=this||e,r=arguments[0];n&&n.transferEventName&&(r=n.transferEventName(r));let i=arguments[2],a=i?typeof i==`boolean`||i.capture:!1,o=arguments[1];if(!o)return re.apply(this,arguments);if(d&&!d(re,o,t,arguments))return;let s=De[r],c;s&&(c=s[a?b:ee]);let l=c&&t[c];if(l)for(let e=0;e<l.length;e++){let n=l[e];if(he(n,o)){if(l.splice(e,1),n.isRemoved=!0,l.length===0&&(n.allRemoved=!0,t[c]=null,!a&&typeof r==`string`)){let e=te+`ON_PROPERTY`+r;t[e]=null}return n.zone.cancelTask(n),g?t:void 0}}return re.apply(this,arguments)},_[s]=function(){let t=this||e,r=arguments[0];n&&n.transferEventName&&(r=n.transferEventName(r));let i=[],a=Pe(t,v?v(r):r);for(let e=0;e<a.length;e++){let t=a[e],n=t.originalDelegate?t.originalDelegate:t.callback;i.push(n)}return i},_[c]=function(){let t=this||e,r=arguments[0];if(r){n&&n.transferEventName&&(r=n.transferEventName(r));let e=De[r];if(e){let n=e[ee],i=e[b],a=t[n],s=t[i];if(a){let e=a.slice();for(let t=0;t<e.length;t++){let n=e[t],i=n.originalDelegate?n.originalDelegate:n.callback;this[o].call(this,r,i,n.options)}}if(s){let e=s.slice();for(let t=0;t<e.length;t++){let n=e[t],i=n.originalDelegate?n.originalDelegate:n.callback;this[o].call(this,r,i,n.options)}}}}else{let e=Object.keys(t);for(let t=0;t<e.length;t++){let n=e[t],r=ke.exec(n),i=r&&r[1];i&&i!==`removeListener`&&this[c].call(this,i)}this[c].call(this,`removeListener`)}if(g)return this},Ce(_[i],ne),Ce(_[o],re),ae&&Ce(_[c],ae),ie&&Ce(_[s],ie),!0}let y=[];for(let e=0;e<n.length;e++)y[e]=v(n[e],r);return y}function Pe(e,t){if(!t){let n=[];for(let r in e){let i=ke.exec(r),a=i&&i[1];if(a&&(!t||a===t)){let t=e[r];if(t)for(let e=0;e<t.length;e++)n.push(t[e])}}return n}let n=De[t];n||=(Me(t),De[t]);let r=e[n[ee]],i=e[n[b]];return r?i?r.concat(i):r.slice():i?i.slice():[]}function Fe(e,t){let n=e.Event;n&&n.prototype&&t.patchMethod(n.prototype,`stopImmediatePropagation`,e=>function(t,n){t[Ae]=!0,e&&e.apply(t,n)})}function Ie(e,t){t.patchMethod(e,`queueMicrotask`,e=>function(e,t){Zone.current.scheduleMicroTask(`queueMicrotask`,t[0])})}var Le=x(`zoneTask`);function Re(e,t,n,r){let i=null,a=null;t+=r,n+=r;let o={};function s(t){let n=t.data;n.args[0]=function(){return t.invoke.apply(this,arguments)};let r=i.apply(e,n.args);return Te(r)?n.handleId=r:(n.handle=r,n.isRefreshable=we(r?.refresh)),t}function c(t){let{handle:n,handleId:r}=t.data;return a.call(e,n??r)}i=xe(e,t,n=>function(i,a){if(we(a[0])){let e={isRefreshable:!1,isPeriodic:r===`Interval`,delay:r===`Timeout`||r===`Interval`?a[1]||0:void 0,args:a},n=a[0];a[0]=function(){try{return n.apply(this,arguments)}finally{let{handle:t,handleId:n,isPeriodic:r,isRefreshable:i}=e;!r&&!i&&(n?delete o[n]:t&&(t[Le]=null))}};let i=re(t,a[0],e,s,c);if(!i)return i;let{handleId:l,handle:u,isRefreshable:d,isPeriodic:f}=i.data;if(l)o[l]=i;else if(u&&(u[Le]=i,d&&!f)){let e=u.refresh;u.refresh=function(){let{zone:t,state:n}=i;return n===`notScheduled`?(i._state=`scheduled`,t._updateTaskCount(i,1)):n===`running`&&(i._state=`scheduling`),e.call(this)}}return u??l??i}return n.apply(e,a)}),a=xe(e,n,t=>function(n,r){let i=r[0],a;Te(i)?(a=o[i],delete o[i]):(a=i?.[Le],a?i[Le]=null:a=i),a?.type?a.cancelFn&&a.zone.cancelTask(a):t.apply(e,r)})}function ze(e,t){let{isBrowser:n,isMix:r}=t.getGlobalObjects();(n||r)&&e.customElements&&`customElements`in e&&t.patchCallbacks(t,e.customElements,`customElements`,`define`,[`connectedCallback`,`disconnectedCallback`,`adoptedCallback`,`attributeChangedCallback`,`formAssociatedCallback`,`formDisabledCallback`,`formResetCallback`,`formStateRestoreCallback`])}function Be(e,t){if(Zone[t.symbol(`patchEventTarget`)])return;let{eventNames:n,zoneSymbolEventNames:r,TRUE_STR:i,FALSE_STR:a,ZONE_SYMBOL_PREFIX:o}=t.getGlobalObjects();for(let e=0;e<n.length;e++){let t=n[e],s=t+a,c=t+i,l=o+s,u=o+c;r[t]={},r[t][a]=l,r[t][i]=u}let s=e.EventTarget;if(s&&s.prototype)return t.patchEventTarget(e,t,[s&&s.prototype]),!0}function Ve(e,t){t.patchEventPrototype(e,t)}function He(e,t,n){if(!n||n.length===0)return t;let r=n.filter(t=>t.target===e);if(r.length===0)return t;let i=r[0].ignoreProperties;return t.filter(e=>i.indexOf(e)===-1)}function Ue(e,t,n,r){e&&ve(e,He(e,t,n),r)}function We(e){return Object.getOwnPropertyNames(e).filter(e=>e.startsWith(`on`)&&e.length>2).map(e=>e.substring(2))}function Ge(e,t){if(de&&!pe||Zone[e.symbol(`patchEvents`)])return;let n=t.__Zone_ignore_on_properties,r=[];if(fe){let e=window;r=r.concat([`Document`,`SVGElement`,`Element`,`HTMLElement`,`HTMLBodyElement`,`HTMLMediaElement`,`HTMLFrameSetElement`,`HTMLFrameElement`,`HTMLIFrameElement`,`HTMLMarqueeElement`,`Worker`]),Ue(e,We(e),n,p(e))}r=r.concat([`XMLHttpRequest`,`XMLHttpRequestEventTarget`,`IDBIndex`,`IDBRequest`,`IDBOpenDBRequest`,`IDBDatabase`,`IDBTransaction`,`IDBCursor`,`WebSocket`]);for(let e=0;e<r.length;e++){let i=t[r[e]];i!=null&&i.prototype&&Ue(i.prototype,We(i.prototype),n)}}function Ke(e){e.__load_patch(`timers`,e=>{let t=`clear`;Re(e,`set`,t,`Timeout`),Re(e,`set`,t,`Interval`),Re(e,`set`,t,`Immediate`)}),e.__load_patch(`requestAnimationFrame`,e=>{Re(e,`request`,`cancel`,`AnimationFrame`),Re(e,`mozRequest`,`mozCancel`,`AnimationFrame`),Re(e,`webkitRequest`,`webkitCancel`,`AnimationFrame`)}),e.__load_patch(`blocking`,(e,t)=>{let n=[`alert`,`prompt`,`confirm`];for(let r=0;r<n.length;r++){let i=n[r];xe(e,i,(n,r,i)=>function(r,a){return t.current.run(n,e,a,i)})}}),e.__load_patch(`EventTarget`,(e,t,n)=>{Ve(e,n),Be(e,n);let r=e.XMLHttpRequestEventTarget;r&&r.prototype&&n.patchEventTarget(e,n,[r.prototype])}),e.__load_patch(`MutationObserver`,(e,t,n)=>{be(`MutationObserver`),be(`WebKitMutationObserver`)}),e.__load_patch(`IntersectionObserver`,(e,t,n)=>{be(`IntersectionObserver`)}),e.__load_patch(`FileReader`,(e,t,n)=>{be(`FileReader`)}),e.__load_patch(`on_property`,(e,t,n)=>{Ge(n,e)}),e.__load_patch(`customElements`,(e,t,n)=>{ze(e,n)}),e.__load_patch(`XHR`,(e,t)=>{c(e);let n=x(`xhrTask`),r=x(`xhrSync`),i=x(`xhrListener`),a=x(`xhrScheduled`),o=x(`xhrURL`),s=x(`xhrErrorBeforeScheduled`);function c(e){let c=e.XMLHttpRequest;if(!c)return;let l=c.prototype;function u(e){return e[n]}let d=l[v],f=l[y];if(!d){let t=e.XMLHttpRequestEventTarget;if(t){let e=t.prototype;d=e[v],f=e[y]}}let p=`readystatechange`,m=`scheduled`;function h(e){let r=e.data,o=r.target;o[a]=!1,o[s]=!1;let c=o[i];d||(d=o[v],f=o[y]),c&&f.call(o,p,c);let l=o[i]=()=>{if(o.readyState===o.DONE){if(!r.aborted&&o[a]&&e.state===m){let n=o[t.__symbol__(`loadfalse`)];if(o.status!==0&&n&&n.length>0){let i=e.invoke;e.invoke=function(){let n=o[t.__symbol__(`loadfalse`)];for(let t=0;t<n.length;t++)n[t]===e&&n.splice(t,1);!r.aborted&&e.state===m&&i.call(e)},n.push(e)}else e.invoke()}else!r.aborted&&o[a]===!1&&(o[s]=!0)}};return d.call(o,p,l),o[n]||(o[n]=e),ne.apply(o,r.args),o[a]=!0,e}function g(){}function _(e){let t=e.data;return t.aborted=!0,ie.apply(t.target,t.args)}let b=xe(l,`open`,()=>function(e,t){return e[r]=t[2]==0,e[o]=t[1],b.apply(e,t)}),ee=x(`fetchTaskAborting`),te=x(`fetchTaskScheduling`),ne=xe(l,`send`,()=>function(e,n){if(t.current[te]===!0||e[r])return ne.apply(e,n);{let t={target:e,url:e[o],isPeriodic:!1,args:n,aborted:!1},r=re(`XMLHttpRequest.send`,g,t,h,_);e&&e[s]===!0&&!t.aborted&&r.state===m&&r.invoke()}}),ie=xe(l,`abort`,()=>function(e,n){let r=u(e);if(r&&typeof r.type==`string`){if(r.cancelFn==null||r.data&&r.data.aborted)return;r.zone.cancelTask(r)}else if(t.current[ee]===!0)return ie.apply(e,n)})}}),e.__load_patch(`geolocation`,e=>{e.navigator&&e.navigator.geolocation&&ce(e.navigator.geolocation,[`getCurrentPosition`,`watchPosition`])}),e.__load_patch(`PromiseRejectionEvent`,(e,t)=>{function n(t){return function(n){Pe(e,t).forEach(r=>{let i=e.PromiseRejectionEvent;if(i){let e=new i(t,{promise:n.promise,reason:n.rejection});r.invoke(e)}})}}e.PromiseRejectionEvent&&(t[x(`unhandledPromiseRejectionHandler`)]=n(`unhandledrejection`),t[x(`rejectionHandledHandler`)]=n(`rejectionhandled`))}),e.__load_patch(`queueMicrotask`,(e,t,n)=>{Ie(e,n)})}function qe(e){e.__load_patch(`ZoneAwarePromise`,(e,t,n)=>{let r=Object.getOwnPropertyDescriptor,i=Object.defineProperty;function a(e){return e&&e.toString===Object.prototype.toString?(e.constructor&&e.constructor.name||``)+`: `+JSON.stringify(e):e?e.toString():Object.prototype.toString.call(e)}let o=n.symbol,s=[],c=e[o(`DISABLE_WRAPPING_UNCAUGHT_PROMISE_REJECTION`)]!==!1,l=o(`Promise`),u=o(`then`);n.onUnhandledError=e=>{if(n.showUncaughtError()){let t=e&&e.rejection;t&&e.zone&&e.task?console.error(`Unhandled Promise rejection:`,t instanceof Error?t.message:t,`; Zone:`,e.zone.name,`; Task:`,e.task&&e.task.source,`; Value:`,t,t instanceof Error?t.stack:void 0):console.error(e)}},n.microtaskDrainDone=()=>{for(;s.length;){let e=s.shift();try{e.zone.runGuarded(()=>{throw e.throwOriginal?e.rejection:e})}catch(e){f(e)}}};let d=o(`unhandledPromiseRejectionHandler`);function f(e){n.onUnhandledError(e);try{let n=t[d];typeof n==`function`&&n.call(this,e)}catch{}}function p(e){return e&&typeof e.then==`function`}function m(e){return e}function h(e){return S.reject(e)}let g=o(`state`),_=o(`value`),v=o(`finally`),y=o(`parentPromiseValue`),b=o(`parentPromiseState`);function ee(e,t){return n=>{try{re(e,t,n)}catch(t){re(e,!1,t)}}}let te=function(){let e=!1;return function(t){return function(){e||(e=!0,t.apply(null,arguments))}}},ne=o(`currentTaskTrace`);function re(e,r,o){let l=te();if(e===o)throw TypeError(`Promise resolved with itself`);if(e[g]===null){let u=null;try{(typeof o==`object`||typeof o==`function`)&&(u=o&&o.then)}catch(t){return l(()=>{re(e,!1,t)})(),e}if(r!==!1&&o instanceof S&&Object.hasOwn(o,g)&&Object.hasOwn(o,_)&&o[g]!==null)ie(o),re(e,o[g],o[_]);else if(r!==!1&&typeof u==`function`)try{u.call(o,l(ee(e,r)),l(ee(e,!1)))}catch(t){l(()=>{re(e,!1,t)})()}else{e[g]=r;let l=e[_];if(e[_]=o,e[v]===v&&r===!0&&(e[g]=e[b],e[_]=e[y]),r===!1&&o instanceof Error){let e=t.currentTask&&t.currentTask.data&&t.currentTask.data.__creationTrace__;e&&i(o,ne,{configurable:!0,enumerable:!1,writable:!0,value:e})}for(let t=0;t<l.length;)ae(e,l[t++],l[t++],l[t++],l[t++]);if(l.length==0&&r==0){e[g]=0;let r=o;try{throw Error(`Uncaught (in promise): `+a(o)+(o&&o.stack?`
`+o.stack:``))}catch(e){r=e}c&&(r.throwOriginal=!0),r.rejection=o,r.promise=e,r.zone=t.current,r.task=t.currentTask,s.push(r),n.scheduleMicroTask()}}}return e}let x=o(`rejectionHandledHandler`);function ie(e){if(e[g]===0){try{let n=t[x];n&&typeof n==`function`&&n.call(this,{rejection:e[_],promise:e})}catch{}e[g]=!1;for(let t=0;t<s.length;t++)e===s[t].promise&&s.splice(t,1)}}function ae(e,t,n,r,i){ie(e);let a=e[g],o=a?typeof r==`function`?r:m:typeof i==`function`?i:h;t.scheduleMicroTask(`Promise.then`,()=>{try{let r=e[_],i=!!n&&v===n[v];i&&(n[y]=r,n[b]=a),re(n,!0,t.run(o,void 0,i&&o!==h&&o!==m?[]:[r]))}catch(e){re(n,!1,e)}},n)}let oe=function(){},se=e.AggregateError;class S{static toString(){return`function ZoneAwarePromise() { [native code] }`}static resolve(e){return e instanceof S?e:re(new this(null),!0,e)}static reject(e){return re(new this(null),!1,e)}static withResolvers(){let e={};return e.promise=new S((t,n)=>{e.resolve=t,e.reject=n}),e}static any(e){if(!e||typeof e[Symbol.iterator]!=`function`)return Promise.reject(new se([],`All promises were rejected`));let t=[],n=0;try{for(let r of e)n++,t.push(S.resolve(r))}catch{return Promise.reject(new se([],`All promises were rejected`))}if(n===0)return Promise.reject(new se([],`All promises were rejected`));let r=!1,i=[];return new S((e,a)=>{for(let o=0;o<t.length;o++)t[o].then(t=>{r||(r=!0,e(t))},e=>{i.push(e),n--,n===0&&(r=!0,a(new se(i,`All promises were rejected`)))})})}static race(e){let t,n,r=new this((e,r)=>{t=e,n=r});function i(e){t(e)}function a(e){n(e)}for(let t of e)p(t)||(t=this.resolve(t)),t.then(i,a);return r}static all(e){return S.allWithCallback(e)}static allSettled(e){return(this&&this.prototype instanceof S?this:S).allWithCallback(e,{thenCallback:e=>({status:`fulfilled`,value:e}),errorCallback:e=>({status:`rejected`,reason:e})})}static allWithCallback(e,t){let n,r,i=new this((e,t)=>{n=e,r=t}),a=2,o=0,s=[];for(let i of e){p(i)||(i=this.resolve(i));let e=o;try{i.then(r=>{s[e]=t?t.thenCallback(r):r,a--,a===0&&n(s)},i=>{t?(s[e]=t.errorCallback(i),a--,a===0&&n(s)):r(i)})}catch(e){r(e)}a++,o++}return a-=2,a===0&&n(s),i}constructor(e){let t=this;if(!(t instanceof S))throw Error(`Must be an instanceof Promise.`);t[g]=null,t[_]=[];try{let n=te();e&&e(n(ee(t,!0)),n(ee(t,!1)))}catch(e){re(t,!1,e)}}get[Symbol.toStringTag](){return`Promise`}get[Symbol.species](){return S}then(e,n){let r=this.constructor?.[Symbol.species];(!r||typeof r!=`function`)&&(r=this.constructor||S);let i=new r(oe),a=t.current;return this[g]==null?this[_].push(a,i,e,n):ae(this,a,i,e,n),i}catch(e){return this.then(null,e)}finally(e){let n=this.constructor?.[Symbol.species];(!n||typeof n!=`function`)&&(n=S);let r=new n(oe);r[v]=v;let i=t.current;return this[g]==null?this[_].push(i,r,e,e):ae(this,i,r,e,e),r}}S.resolve=S.resolve,S.reject=S.reject,S.race=S.race,S.all=S.all;let ce=e[l]=e.Promise;e.Promise=S;let le=o(`thenPatched`);function ue(e){let t=e.prototype,n=r(t,`then`);if(n&&(n.writable===!1||!n.configurable))return;let i=t.then;t[u]=i,e.prototype.then=function(e,t){return new S((e,t)=>{i.call(this,e,t)}).then(e,t)},e[le]=!0}n.patchThen=ue;function de(e){return function(t,n){let r=e.apply(t,n);if(r instanceof S)return r;let i=r.constructor;return i[le]||ue(i),r}}if(ce){ue(ce);let t=ce.try;t&&typeof t==`function`&&(S.try=t),xe(e,`fetch`,e=>de(e))}return Promise[t.__symbol__(`uncaughtPromiseErrors`)]=s,S})}function Je(e){e.__load_patch(`toString`,e=>{let t=Function.prototype.toString,n=x(`OriginalDelegate`),r=x(`Promise`),i=x(`Error`),a=function(){if(typeof this==`function`){let a=this[n];if(a)return typeof a==`function`?t.call(a):Object.prototype.toString.call(a);if(this===Promise){let n=e[r];if(n)return t.call(n)}if(this===Error){let n=e[i];if(n)return t.call(n)}}return t.call(this)};a[n]=t,Function.prototype.toString=a;let o=Object.prototype.toString;Object.prototype.toString=function(){return typeof Promise==`function`&&this instanceof Promise?`[object Promise]`:o.call(this)}})}function Ye(e,t,n,r,i){let a=Zone.__symbol__(r);if(t[a])return;let o=t[a]=t[r];t[r]=function(a,s,c){return s&&s.prototype&&i.forEach(function(t){let i=`${n}.${r}::`+t,a=s.prototype;try{if(Object.hasOwn(a,t)){let n=e.ObjectGetOwnPropertyDescriptor(a,t);n&&n.value?(n.value=e.wrapWithCurrentZone(n.value,i),e._redefineProperty(s.prototype,t,n)):a[t]&&(a[t]=e.wrapWithCurrentZone(a[t],i))}else a[t]&&(a[t]=e.wrapWithCurrentZone(a[t],i))}catch{}}),o.call(t,a,s,c)},e.attachOriginToPatched(t[r],o)}function Xe(e){e.__load_patch(`util`,(e,t,n)=>{let r=We(e);n.patchOnProperties=ve,n.patchMethod=xe,n.bindArguments=S,n.patchMacroTask=Se;let i=t.__symbol__(`BLACK_LISTED_EVENTS`),a=t.__symbol__(`UNPATCHED_EVENTS`);e[a]&&(e[i]=e[a]),e[i]&&(t[i]=t[a]=e[i]),n.patchEventPrototype=Fe,n.patchEventTarget=Ne,n.ObjectDefineProperty=f,n.ObjectGetOwnPropertyDescriptor=d,n.ObjectCreate=m,n.ArraySlice=h,n.patchClass=be,n.wrapWithCurrentZone=ne,n.filterProperties=He,n.attachOriginToPatched=Ce,n._redefineProperty=Object.defineProperty,n.patchCallbacks=Ye,n.getGlobalObjects=()=>({globalSources:Oe,zoneSymbolEventNames:De,eventNames:r,isBrowser:fe,isMix:pe,isNode:de,TRUE_STR:b,FALSE_STR:ee,ZONE_SYMBOL_PREFIX:te,ADD_EVENT_LISTENER_STR:g,REMOVE_EVENT_LISTENER_STR:_})})}function Ze(e){qe(e),Je(e),Xe(e)}var Qe=u();Ze(Qe),Ke(Qe);var $e=(function(e){return e[e.NONE=0]=`NONE`,e[e.HTML=1]=`HTML`,e[e.STYLE=2]=`STYLE`,e[e.SCRIPT=3]=`SCRIPT`,e[e.URL=4]=`URL`,e[e.RESOURCE_URL=5]=`RESOURCE_URL`,e[e.ATTRIBUTE_NO_BINDING=6]=`ATTRIBUTE_NO_BINDING`,e})($e||{}),et=(function(e){return e[e.None=0]=`None`,e[e.Const=1]=`Const`,e})(et||{}),tt=class{modifiers;constructor(e=et.None){this.modifiers=e}hasModifier(e){return(this.modifiers&e)!==0}},nt=(function(e){return e[e.Dynamic=0]=`Dynamic`,e[e.Bool=1]=`Bool`,e[e.String=2]=`String`,e[e.Int=3]=`Int`,e[e.Number=4]=`Number`,e[e.Function=5]=`Function`,e[e.Inferred=6]=`Inferred`,e[e.None=7]=`None`,e})(nt||{}),rt=class extends tt{name;constructor(e,t){super(t),this.name=e}visitType(e,t){return e.visitBuiltinType(this,t)}};nt.Dynamic;var it=new rt(nt.Inferred);nt.Bool,nt.Int,nt.Number,nt.String,nt.Function,nt.None;var C=(function(e){return e[e.Equals=0]=`Equals`,e[e.NotEquals=1]=`NotEquals`,e[e.Assign=2]=`Assign`,e[e.Identical=3]=`Identical`,e[e.NotIdentical=4]=`NotIdentical`,e[e.Minus=5]=`Minus`,e[e.Plus=6]=`Plus`,e[e.Divide=7]=`Divide`,e[e.Multiply=8]=`Multiply`,e[e.Modulo=9]=`Modulo`,e[e.And=10]=`And`,e[e.Or=11]=`Or`,e[e.BitwiseOr=12]=`BitwiseOr`,e[e.BitwiseAnd=13]=`BitwiseAnd`,e[e.Lower=14]=`Lower`,e[e.LowerEquals=15]=`LowerEquals`,e[e.Bigger=16]=`Bigger`,e[e.BiggerEquals=17]=`BiggerEquals`,e[e.NullishCoalesce=18]=`NullishCoalesce`,e[e.Exponentiation=19]=`Exponentiation`,e[e.In=20]=`In`,e[e.InstanceOf=21]=`InstanceOf`,e[e.AdditionAssignment=22]=`AdditionAssignment`,e[e.SubtractionAssignment=23]=`SubtractionAssignment`,e[e.MultiplicationAssignment=24]=`MultiplicationAssignment`,e[e.DivisionAssignment=25]=`DivisionAssignment`,e[e.RemainderAssignment=26]=`RemainderAssignment`,e[e.ExponentiationAssignment=27]=`ExponentiationAssignment`,e[e.AndAssignment=28]=`AndAssignment`,e[e.OrAssignment=29]=`OrAssignment`,e[e.NullishCoalesceAssignment=30]=`NullishCoalesceAssignment`,e})(C||{});function at(e,t){return e==null||t==null?e==t:e.isEquivalent(t)}function ot(e,t,n){let r=e.length;if(r!==t.length)return!1;for(let i=0;i<r;i++)if(!n(e[i],t[i]))return!1;return!0}function st(e,t){return ot(e,t,(e,t)=>e.isEquivalent(t))}var ct=class{leadingComments;type;sourceSpan;constructor(e,t,n){this.leadingComments=n,this.type=e||null,this.sourceSpan=t||null}prop(e,t){return new vt(this,e,null,t)}key(e,t,n){return new yt(this,e,t,n)}callFn(e,t,n,r){return new dt(this,e,null,t,n,r)}instantiate(e,t,n,r){return new ft(this,e,t,n)}conditional(e,t=null,n,r){return new gt(this,e,t,null,n)}equals(e,t){return new _t(C.Equals,this,e,null,t)}notEquals(e,t){return new _t(C.NotEquals,this,e,null,t)}identical(e,t){return new _t(C.Identical,this,e,null,t)}notIdentical(e,t){return new _t(C.NotIdentical,this,e,null,t)}minus(e,t){return new _t(C.Minus,this,e,null,t)}plus(e,t){return new _t(C.Plus,this,e,null,t)}divide(e,t){return new _t(C.Divide,this,e,null,t)}multiply(e,t){return new _t(C.Multiply,this,e,null,t)}modulo(e,t){return new _t(C.Modulo,this,e,null,t)}power(e,t){return new _t(C.Exponentiation,this,e,null,t)}and(e,t){return new _t(C.And,this,e,null,t)}bitwiseOr(e,t){return new _t(C.BitwiseOr,this,e,null,t)}bitwiseAnd(e,t){return new _t(C.BitwiseAnd,this,e,null,t)}or(e,t){return new _t(C.Or,this,e,null,t)}lower(e,t){return new _t(C.Lower,this,e,null,t)}lowerEquals(e,t){return new _t(C.LowerEquals,this,e,null,t)}bigger(e,t){return new _t(C.Bigger,this,e,null,t)}biggerEquals(e,t){return new _t(C.BiggerEquals,this,e,null,t)}isBlank(e){return this.equals(wt,e)}nullishCoalesce(e,t){return new _t(C.NullishCoalesce,this,e,null,t)}toStmt(e){return new Dt(this,null,e)}},lt=class e extends ct{name;constructor(e,t,n,r){super(t,n,r),this.name=e}isEquivalent(t){return t instanceof e&&this.name===t.name}isConstant(){return!1}visitExpression(e,t){return e.visitReadVarExpr(this,t)}clone(){return new e(this.name,this.type,this.sourceSpan)}set(e){return new _t(C.Assign,this,e,null,this.sourceSpan)}},ut=class e extends ct{expr;constructor(e,t,n,r){super(t,n,r),this.expr=e}visitExpression(e,t){return e.visitTypeofExpr(this,t)}isEquivalent(t){return t instanceof e&&t.expr.isEquivalent(this.expr)}isConstant(){return this.expr.isConstant()}clone(){return new e(this.expr.clone())}},dt=class e extends ct{fn;args;pure;isOptional;constructor(e,t,n,r,i=!1,a,o=!1){super(n,r,a),this.fn=e,this.args=t,this.pure=i,this.isOptional=o}get receiver(){return this.fn}isEquivalent(t){return t instanceof e&&this.fn.isEquivalent(t.fn)&&st(this.args,t.args)&&this.pure===t.pure}isConstant(){return!1}visitExpression(e,t){return e.visitInvokeFunctionExpr(this,t)}clone(){return new e(this.fn.clone(),this.args.map(e=>e.clone()),this.type,this.sourceSpan,this.pure,[],this.isOptional)}},ft=class e extends ct{classExpr;args;constructor(e,t,n,r,i){super(n,r,i),this.classExpr=e,this.args=t}isEquivalent(t){return t instanceof e&&this.classExpr.isEquivalent(t.classExpr)&&st(this.args,t.args)}isConstant(){return!1}visitExpression(e,t){return e.visitInstantiateExpr(this,t)}clone(){return new e(this.classExpr.clone(),this.args.map(e=>e.clone()),this.type,this.sourceSpan)}},pt=class e extends ct{body;flags;constructor(e,t,n,r){super(null,n,r),this.body=e,this.flags=t}isEquivalent(t){return t instanceof e&&this.body===t.body&&this.flags===t.flags}isConstant(){return!0}visitExpression(e,t){return e.visitRegularExpressionLiteral(this,t)}clone(){return new e(this.body,this.flags,this.sourceSpan)}},mt=class e extends ct{value;constructor(e,t,n,r){super(t,n,r),this.value=e}isEquivalent(t){return t instanceof e&&this.value===t.value}isConstant(){return!0}visitExpression(e,t){return e.visitLiteralExpr(this,t)}clone(){return new e(this.value,this.type,this.sourceSpan)}},ht=class e extends ct{value;typeParams;constructor(e,t,n=null,r,i){super(t,r,i),this.value=e,this.typeParams=n}isEquivalent(t){return t instanceof e&&this.value.name===t.value.name&&this.value.moduleName===t.value.moduleName}isConstant(){return!1}visitExpression(e,t){return e.visitExternalExpr(this,t)}clone(){return new e(this.value,this.type,this.typeParams,this.sourceSpan)}},gt=class e extends ct{condition;falseCase;trueCase;constructor(e,t,n=null,r,i,a){super(r||t.type,i,a),this.condition=e,this.falseCase=n,this.trueCase=t}isEquivalent(t){return t instanceof e&&this.condition.isEquivalent(t.condition)&&this.trueCase.isEquivalent(t.trueCase)&&at(this.falseCase,t.falseCase)}isConstant(){return!1}visitExpression(e,t){return e.visitConditionalExpr(this,t)}clone(){return new e(this.condition.clone(),this.trueCase.clone(),this.falseCase?.clone(),this.type,this.sourceSpan)}},_t=class e extends ct{operator;rhs;lhs;constructor(e,t,n,r,i,a){super(r||t.type,i,a),this.operator=e,this.rhs=n,this.lhs=t}isEquivalent(t){return t instanceof e&&this.operator===t.operator&&this.lhs.isEquivalent(t.lhs)&&this.rhs.isEquivalent(t.rhs)}isConstant(){return!1}visitExpression(e,t){return e.visitBinaryOperatorExpr(this,t)}clone(){return new e(this.operator,this.lhs.clone(),this.rhs.clone(),this.type,this.sourceSpan)}isAssignment(){let e=this.operator;return e===C.Assign||e===C.AdditionAssignment||e===C.SubtractionAssignment||e===C.MultiplicationAssignment||e===C.DivisionAssignment||e===C.RemainderAssignment||e===C.ExponentiationAssignment||e===C.AndAssignment||e===C.OrAssignment||e===C.NullishCoalesceAssignment}},vt=class e extends ct{receiver;name;isOptional;constructor(e,t,n,r,i,a=!1){super(n,r,i),this.receiver=e,this.name=t,this.isOptional=a}get index(){return this.name}isEquivalent(t){return t instanceof e&&this.receiver.isEquivalent(t.receiver)&&this.name===t.name&&this.isOptional===t.isOptional}isConstant(){return!1}visitExpression(e,t){return e.visitReadPropExpr(this,t)}set(e){return new _t(C.Assign,this.receiver.prop(this.name),e,null,this.sourceSpan)}clone(){return new e(this.receiver.clone(),this.name,this.type,this.sourceSpan,[],this.isOptional)}},yt=class e extends ct{receiver;index;isOptional;constructor(e,t,n,r,i,a=!1){super(n,r,i),this.receiver=e,this.index=t,this.isOptional=a}isEquivalent(t){return t instanceof e&&this.receiver.isEquivalent(t.receiver)&&this.index.isEquivalent(t.index)&&this.isOptional===t.isOptional}isConstant(){return!1}visitExpression(e,t){return e.visitReadKeyExpr(this,t)}set(e){return new _t(C.Assign,this.receiver.key(this.index),e,null,this.sourceSpan)}clone(){return new e(this.receiver.clone(),this.index.clone(),this.type,this.sourceSpan,[],this.isOptional)}},bt=class e extends ct{entries;constructor(e,t,n,r){super(t,n,r),this.entries=e}isConstant(){return this.entries.every(e=>e.isConstant())}isEquivalent(t){return t instanceof e&&st(this.entries,t.entries)}visitExpression(e,t){return e.visitLiteralArrayExpr(this,t)}clone(){return new e(this.entries.map(e=>e.clone()),this.type,this.sourceSpan)}},xt=class e{expression;constructor(e){this.expression=e}isEquivalent(t){return t instanceof e&&this.expression.isEquivalent(t.expression)}clone(){return new e(this.expression.clone())}isConstant(){return this.expression.isConstant()}},St=class e extends ct{entries;valueType=null;constructor(e,t,n,r){super(t,n,r),this.entries=e,t&&(this.valueType=t.valueType)}isEquivalent(t){return t instanceof e&&st(this.entries,t.entries)}isConstant(){return this.entries.every(e=>e.isConstant())}visitExpression(e,t){return e.visitLiteralMapExpr(this,t)}clone(){let t=this.entries.map(e=>e.clone());return new e(t,this.type,this.sourceSpan)}},Ct=class e extends ct{expression;constructor(e,t,n){super(null,t,n),this.expression=e}isEquivalent(t){return t instanceof e&&this.expression.isEquivalent(t.expression)}isConstant(){return this.expression.isConstant()}visitExpression(e,t){return e.visitSpreadElementExpr(this,t)}clone(){return new e(this.expression.clone(),this.sourceSpan)}},wt=new mt(null,it,null),Tt=(function(e){return e[e.None=0]=`None`,e[e.Final=1]=`Final`,e[e.Private=2]=`Private`,e[e.Exported=4]=`Exported`,e[e.Static=8]=`Static`,e})(Tt||{}),Et=class{modifiers;sourceSpan;leadingComments;constructor(e=Tt.None,t=null,n){this.modifiers=e,this.sourceSpan=t,this.leadingComments=n}hasModifier(e){return(this.modifiers&e)!==0}addLeadingComment(e){this.leadingComments=this.leadingComments??[],this.leadingComments.push(e)}},Dt=class e extends Et{expr;constructor(e,t,n){super(Tt.None,t,n),this.expr=e}isEquivalent(t){return t instanceof e&&this.expr.isEquivalent(t.expr)}visitStatement(e,t){return e.visitExpressionStmt(this,t)}};(class e{static INSTANCE=new e;keyOf(e){if(e instanceof mt&&typeof e.value==`string`)return`"${e.value}"`;if(e instanceof mt)return String(e.value);if(e instanceof pt)return`/${e.body}/${e.flags??``}`;if(e instanceof bt){let t=[];for(let n of e.entries)t.push(this.keyOf(n));return`[${t.join(`,`)}]`}if(e instanceof St){let t=[];for(let n of e.entries)if(n instanceof xt)t.push(`...`+this.keyOf(n.expression));else{let e=n.key;n.quoted&&(e=`"${e}"`),t.push(e+`:`+this.keyOf(n.value))}return`{${t.join(`,`)}}`}if(e instanceof ht)return`import("${e.value.moduleName}", ${e.value.name})`;if(e instanceof lt)return`read(${e.name})`;if(e instanceof ut)return`typeof(${this.keyOf(e.expr)})`;if(e instanceof Ct)return`...${this.keyOf(e.expression)}`;throw Error(`${this.constructor.name} does not handle expressions of type ${e.constructor.name}`)}});var w=`@angular/core`,T=(()=>{class e{static core={name:null,moduleName:w};static namespaceHTML={name:`ɵɵnamespaceHTML`,moduleName:w};static namespaceMathML={name:`ɵɵnamespaceMathML`,moduleName:w};static namespaceSVG={name:`ɵɵnamespaceSVG`,moduleName:w};static element={name:`ɵɵelement`,moduleName:w};static elementStart={name:`ɵɵelementStart`,moduleName:w};static elementEnd={name:`ɵɵelementEnd`,moduleName:w};static foreignComponent={name:`ɵɵforeignComponent`,moduleName:w};static foreignContent={name:`ɵɵforeignContent`,moduleName:w};static foreignContentFn={name:`ɵɵforeignContentFn`,moduleName:w};static domElement={name:`ɵɵdomElement`,moduleName:w};static domElementStart={name:`ɵɵdomElementStart`,moduleName:w};static domElementEnd={name:`ɵɵdomElementEnd`,moduleName:w};static domElementContainer={name:`ɵɵdomElementContainer`,moduleName:w};static domElementContainerStart={name:`ɵɵdomElementContainerStart`,moduleName:w};static domElementContainerEnd={name:`ɵɵdomElementContainerEnd`,moduleName:w};static domTemplate={name:`ɵɵdomTemplate`,moduleName:w};static domListener={name:`ɵɵdomListener`,moduleName:w};static advance={name:`ɵɵadvance`,moduleName:w};static syntheticHostProperty={name:`ɵɵsyntheticHostProperty`,moduleName:w};static syntheticHostListener={name:`ɵɵsyntheticHostListener`,moduleName:w};static attribute={name:`ɵɵattribute`,moduleName:w};static classProp={name:`ɵɵclassProp`,moduleName:w};static elementContainerStart={name:`ɵɵelementContainerStart`,moduleName:w};static elementContainerEnd={name:`ɵɵelementContainerEnd`,moduleName:w};static elementContainer={name:`ɵɵelementContainer`,moduleName:w};static styleMap={name:`ɵɵstyleMap`,moduleName:w};static classMap={name:`ɵɵclassMap`,moduleName:w};static styleProp={name:`ɵɵstyleProp`,moduleName:w};static interpolate={name:`ɵɵinterpolate`,moduleName:w};static interpolate1={name:`ɵɵinterpolate1`,moduleName:w};static interpolate2={name:`ɵɵinterpolate2`,moduleName:w};static interpolate3={name:`ɵɵinterpolate3`,moduleName:w};static interpolate4={name:`ɵɵinterpolate4`,moduleName:w};static interpolate5={name:`ɵɵinterpolate5`,moduleName:w};static interpolate6={name:`ɵɵinterpolate6`,moduleName:w};static interpolate7={name:`ɵɵinterpolate7`,moduleName:w};static interpolate8={name:`ɵɵinterpolate8`,moduleName:w};static interpolateV={name:`ɵɵinterpolateV`,moduleName:w};static nextContext={name:`ɵɵnextContext`,moduleName:w};static resetView={name:`ɵɵresetView`,moduleName:w};static templateCreate={name:`ɵɵtemplate`,moduleName:w};static defer={name:`ɵɵdefer`,moduleName:w};static deferWhen={name:`ɵɵdeferWhen`,moduleName:w};static deferOnIdle={name:`ɵɵdeferOnIdle`,moduleName:w};static deferOnImmediate={name:`ɵɵdeferOnImmediate`,moduleName:w};static deferOnTimer={name:`ɵɵdeferOnTimer`,moduleName:w};static deferOnHover={name:`ɵɵdeferOnHover`,moduleName:w};static deferOnInteraction={name:`ɵɵdeferOnInteraction`,moduleName:w};static deferOnViewport={name:`ɵɵdeferOnViewport`,moduleName:w};static deferPrefetchWhen={name:`ɵɵdeferPrefetchWhen`,moduleName:w};static deferPrefetchOnIdle={name:`ɵɵdeferPrefetchOnIdle`,moduleName:w};static deferPrefetchOnImmediate={name:`ɵɵdeferPrefetchOnImmediate`,moduleName:w};static deferPrefetchOnTimer={name:`ɵɵdeferPrefetchOnTimer`,moduleName:w};static deferPrefetchOnHover={name:`ɵɵdeferPrefetchOnHover`,moduleName:w};static deferPrefetchOnInteraction={name:`ɵɵdeferPrefetchOnInteraction`,moduleName:w};static deferPrefetchOnViewport={name:`ɵɵdeferPrefetchOnViewport`,moduleName:w};static deferHydrateWhen={name:`ɵɵdeferHydrateWhen`,moduleName:w};static deferHydrateNever={name:`ɵɵdeferHydrateNever`,moduleName:w};static deferHydrateOnIdle={name:`ɵɵdeferHydrateOnIdle`,moduleName:w};static deferHydrateOnImmediate={name:`ɵɵdeferHydrateOnImmediate`,moduleName:w};static deferHydrateOnTimer={name:`ɵɵdeferHydrateOnTimer`,moduleName:w};static deferHydrateOnHover={name:`ɵɵdeferHydrateOnHover`,moduleName:w};static deferHydrateOnInteraction={name:`ɵɵdeferHydrateOnInteraction`,moduleName:w};static deferHydrateOnViewport={name:`ɵɵdeferHydrateOnViewport`,moduleName:w};static deferEnableTimerScheduling={name:`ɵɵdeferEnableTimerScheduling`,moduleName:w};static enableIncrementalHydrationRuntime={name:`ɵɵenableIncrementalHydrationRuntime`,moduleName:w};static conditionalCreate={name:`ɵɵconditionalCreate`,moduleName:w};static conditionalBranchCreate={name:`ɵɵconditionalBranchCreate`,moduleName:w};static conditional={name:`ɵɵconditional`,moduleName:w};static repeater={name:`ɵɵrepeater`,moduleName:w};static repeaterCreate={name:`ɵɵrepeaterCreate`,moduleName:w};static repeaterTrackByIndex={name:`ɵɵrepeaterTrackByIndex`,moduleName:w};static repeaterTrackByIdentity={name:`ɵɵrepeaterTrackByIdentity`,moduleName:w};static componentInstance={name:`ɵɵcomponentInstance`,moduleName:w};static text={name:`ɵɵtext`,moduleName:w};static enableBindings={name:`ɵɵenableBindings`,moduleName:w};static disableBindings={name:`ɵɵdisableBindings`,moduleName:w};static getCurrentView={name:`ɵɵgetCurrentView`,moduleName:w};static textInterpolate={name:`ɵɵtextInterpolate`,moduleName:w};static textInterpolate1={name:`ɵɵtextInterpolate1`,moduleName:w};static textInterpolate2={name:`ɵɵtextInterpolate2`,moduleName:w};static textInterpolate3={name:`ɵɵtextInterpolate3`,moduleName:w};static textInterpolate4={name:`ɵɵtextInterpolate4`,moduleName:w};static textInterpolate5={name:`ɵɵtextInterpolate5`,moduleName:w};static textInterpolate6={name:`ɵɵtextInterpolate6`,moduleName:w};static textInterpolate7={name:`ɵɵtextInterpolate7`,moduleName:w};static textInterpolate8={name:`ɵɵtextInterpolate8`,moduleName:w};static textInterpolateV={name:`ɵɵtextInterpolateV`,moduleName:w};static restoreView={name:`ɵɵrestoreView`,moduleName:w};static pureFunction0={name:`ɵɵpureFunction0`,moduleName:w};static pureFunction1={name:`ɵɵpureFunction1`,moduleName:w};static pureFunction2={name:`ɵɵpureFunction2`,moduleName:w};static pureFunction3={name:`ɵɵpureFunction3`,moduleName:w};static pureFunction4={name:`ɵɵpureFunction4`,moduleName:w};static pureFunction5={name:`ɵɵpureFunction5`,moduleName:w};static pureFunction6={name:`ɵɵpureFunction6`,moduleName:w};static pureFunction7={name:`ɵɵpureFunction7`,moduleName:w};static pureFunction8={name:`ɵɵpureFunction8`,moduleName:w};static pureFunctionV={name:`ɵɵpureFunctionV`,moduleName:w};static pipeBind1={name:`ɵɵpipeBind1`,moduleName:w};static pipeBind2={name:`ɵɵpipeBind2`,moduleName:w};static pipeBind3={name:`ɵɵpipeBind3`,moduleName:w};static pipeBind4={name:`ɵɵpipeBind4`,moduleName:w};static pipeBindV={name:`ɵɵpipeBindV`,moduleName:w};static domProperty={name:`ɵɵdomProperty`,moduleName:w};static ariaProperty={name:`ɵɵariaProperty`,moduleName:w};static property={name:`ɵɵproperty`,moduleName:w};static control={name:`ɵɵcontrol`,moduleName:w};static controlCreate={name:`ɵɵcontrolCreate`,moduleName:w};static animationEnterListener={name:`ɵɵanimateEnterListener`,moduleName:w};static animationLeaveListener={name:`ɵɵanimateLeaveListener`,moduleName:w};static animationEnter={name:`ɵɵanimateEnter`,moduleName:w};static animationLeave={name:`ɵɵanimateLeave`,moduleName:w};static i18n={name:`ɵɵi18n`,moduleName:w};static i18nAttributes={name:`ɵɵi18nAttributes`,moduleName:w};static i18nExp={name:`ɵɵi18nExp`,moduleName:w};static i18nStart={name:`ɵɵi18nStart`,moduleName:w};static i18nEnd={name:`ɵɵi18nEnd`,moduleName:w};static i18nApply={name:`ɵɵi18nApply`,moduleName:w};static i18nPostprocess={name:`ɵɵi18nPostprocess`,moduleName:w};static pipe={name:`ɵɵpipe`,moduleName:w};static projection={name:`ɵɵprojection`,moduleName:w};static projectionDef={name:`ɵɵprojectionDef`,moduleName:w};static reference={name:`ɵɵreference`,moduleName:w};static inject={name:`ɵɵinject`,moduleName:w};static injectAttribute={name:`ɵɵinjectAttribute`,moduleName:w};static directiveInject={name:`ɵɵdirectiveInject`,moduleName:w};static invalidFactory={name:`ɵɵinvalidFactory`,moduleName:w};static invalidFactoryDep={name:`ɵɵinvalidFactoryDep`,moduleName:w};static templateRefExtractor={name:`ɵɵtemplateRefExtractor`,moduleName:w};static forwardRef={name:`forwardRef`,moduleName:w};static resolveForwardRef={name:`resolveForwardRef`,moduleName:w};static replaceMetadata={name:`ɵɵreplaceMetadata`,moduleName:w};static getReplaceMetadataURL={name:`ɵɵgetReplaceMetadataURL`,moduleName:w};static ɵɵdefineInjectable={name:`ɵɵdefineInjectable`,moduleName:w};static declareInjectable={name:`ɵɵngDeclareInjectable`,moduleName:w};static InjectableDeclaration={name:`ɵɵInjectableDeclaration`,moduleName:w};static defineService={name:`ɵɵdefineService`,moduleName:w};static declareService={name:`ɵɵngDeclareService`,moduleName:w};static resolveWindow={name:`ɵɵresolveWindow`,moduleName:w};static resolveDocument={name:`ɵɵresolveDocument`,moduleName:w};static resolveBody={name:`ɵɵresolveBody`,moduleName:w};static getComponentDepsFactory={name:`ɵɵgetComponentDepsFactory`,moduleName:w};static defineComponent={name:`ɵɵdefineComponent`,moduleName:w};static declareComponent={name:`ɵɵngDeclareComponent`,moduleName:w};static setComponentScope={name:`ɵɵsetComponentScope`,moduleName:w};static ChangeDetectionStrategy={name:`ChangeDetectionStrategy`,moduleName:w};static ViewEncapsulation={name:`ViewEncapsulation`,moduleName:w};static ComponentDeclaration={name:`ɵɵComponentDeclaration`,moduleName:w};static FactoryDeclaration={name:`ɵɵFactoryDeclaration`,moduleName:w};static declareFactory={name:`ɵɵngDeclareFactory`,moduleName:w};static FactoryTarget={name:`ɵɵFactoryTarget`,moduleName:w};static defineDirective={name:`ɵɵdefineDirective`,moduleName:w};static declareDirective={name:`ɵɵngDeclareDirective`,moduleName:w};static DirectiveDeclaration={name:`ɵɵDirectiveDeclaration`,moduleName:w};static InjectorDef={name:`ɵɵInjectorDef`,moduleName:w};static InjectorDeclaration={name:`ɵɵInjectorDeclaration`,moduleName:w};static defineInjector={name:`ɵɵdefineInjector`,moduleName:w};static declareInjector={name:`ɵɵngDeclareInjector`,moduleName:w};static NgModuleDeclaration={name:`ɵɵNgModuleDeclaration`,moduleName:w};static ModuleWithProviders={name:`ModuleWithProviders`,moduleName:w};static defineNgModule={name:`ɵɵdefineNgModule`,moduleName:w};static declareNgModule={name:`ɵɵngDeclareNgModule`,moduleName:w};static setNgModuleScope={name:`ɵɵsetNgModuleScope`,moduleName:w};static registerNgModuleType={name:`ɵɵregisterNgModuleType`,moduleName:w};static PipeDeclaration={name:`ɵɵPipeDeclaration`,moduleName:w};static definePipe={name:`ɵɵdefinePipe`,moduleName:w};static declarePipe={name:`ɵɵngDeclarePipe`,moduleName:w};static declareClassMetadata={name:`ɵɵngDeclareClassMetadata`,moduleName:w};static declareClassMetadataAsync={name:`ɵɵngDeclareClassMetadataAsync`,moduleName:w};static setClassMetadata={name:`ɵsetClassMetadata`,moduleName:w};static setClassMetadataAsync={name:`ɵsetClassMetadataAsync`,moduleName:w};static setClassDebugInfo={name:`ɵsetClassDebugInfo`,moduleName:w};static queryRefresh={name:`ɵɵqueryRefresh`,moduleName:w};static viewQuery={name:`ɵɵviewQuery`,moduleName:w};static loadQuery={name:`ɵɵloadQuery`,moduleName:w};static contentQuery={name:`ɵɵcontentQuery`,moduleName:w};static viewQuerySignal={name:`ɵɵviewQuerySignal`,moduleName:w};static contentQuerySignal={name:`ɵɵcontentQuerySignal`,moduleName:w};static queryAdvance={name:`ɵɵqueryAdvance`,moduleName:w};static twoWayProperty={name:`ɵɵtwoWayProperty`,moduleName:w};static twoWayBindingSet={name:`ɵɵtwoWayBindingSet`,moduleName:w};static twoWayListener={name:`ɵɵtwoWayListener`,moduleName:w};static declareLet={name:`ɵɵdeclareLet`,moduleName:w};static storeLet={name:`ɵɵstoreLet`,moduleName:w};static readContextLet={name:`ɵɵreadContextLet`,moduleName:w};static arrowFunction={name:`ɵɵarrowFunction`,moduleName:w};static attachSourceLocations={name:`ɵɵattachSourceLocations`,moduleName:w};static NgOnChangesFeature={name:`ɵɵNgOnChangesFeature`,moduleName:w};static ControlFeature={name:`ɵɵControlFeature`,moduleName:w};static InheritDefinitionFeature={name:`ɵɵInheritDefinitionFeature`,moduleName:w};static ProvidersFeature={name:`ɵɵProvidersFeature`,moduleName:w};static HostDirectivesFeature={name:`ɵɵHostDirectivesFeature`,moduleName:w};static ExternalStylesFeature={name:`ɵɵExternalStylesFeature`,moduleName:w};static listener={name:`ɵɵlistener`,moduleName:w};static getInheritedFactory={name:`ɵɵgetInheritedFactory`,moduleName:w};static sanitizeHtml={name:`ɵɵsanitizeHtml`,moduleName:w};static sanitizeStyle={name:`ɵɵsanitizeStyle`,moduleName:w};static validateAttribute={name:`ɵɵvalidateAttribute`,moduleName:w};static sanitizeResourceUrl={name:`ɵɵsanitizeResourceUrl`,moduleName:w};static sanitizeScript={name:`ɵɵsanitizeScript`,moduleName:w};static sanitizeUrl={name:`ɵɵsanitizeUrl`,moduleName:w};static sanitizeUrlOrResourceUrl={name:`ɵɵsanitizeUrlOrResourceUrl`,moduleName:w};static trustConstantHtml={name:`ɵɵtrustConstantHtml`,moduleName:w};static trustConstantResourceUrl={name:`ɵɵtrustConstantResourceUrl`,moduleName:w};static inputDecorator={name:`Input`,moduleName:w};static outputDecorator={name:`Output`,moduleName:w};static viewChildDecorator={name:`ViewChild`,moduleName:w};static viewChildrenDecorator={name:`ViewChildren`,moduleName:w};static contentChildDecorator={name:`ContentChild`,moduleName:w};static contentChildrenDecorator={name:`ContentChildren`,moduleName:w};static InputSignalBrandWriteType={name:`ɵINPUT_SIGNAL_BRAND_WRITE_TYPE`,moduleName:w};static UnwrapDirectiveSignalInputs={name:`ɵUnwrapDirectiveSignalInputs`,moduleName:w};static unwrapWritableSignal={name:`ɵunwrapWritableSignal`,moduleName:w};static assertType={name:`ɵassertType`,moduleName:w}}return e})();C.And,C.Bigger,C.BiggerEquals,C.BitwiseOr,C.BitwiseAnd,C.Divide,C.Assign,C.Equals,C.Identical,C.Lower,C.LowerEquals,C.Minus,C.Modulo,C.Exponentiation,C.Multiply,C.NotEquals,C.NotIdentical,C.NullishCoalesce,C.Or,C.Plus,C.In,C.InstanceOf,C.AdditionAssignment,C.SubtractionAssignment,C.MultiplicationAssignment,C.DivisionAssignment,C.RemainderAssignment,C.ExponentiationAssignment,C.AndAssignment,C.OrAssignment,C.NullishCoalesceAssignment;var Ot=class{span;sourceSpan;constructor(e,t){this.span=e,this.sourceSpan=t}toString(){return`AST`}},kt=class extends Ot{receiver;args;argumentSpan;constructor(e,t,n,r,i){super(e,t),this.receiver=n,this.args=r,this.argumentSpan=i}visit(e,t=null){return e.visitCall(this,t)}},At=(function(e){return e[e.Property=0]=`Property`,e[e.Attribute=1]=`Attribute`,e[e.Class=2]=`Class`,e[e.Style=3]=`Style`,e[e.LegacyAnimation=4]=`LegacyAnimation`,e[e.TwoWay=5]=`TwoWay`,e[e.Animation=6]=`Animation`,e})(At||{}),jt=`(:(where|is)\\()?`,Mt=`-shadowcsshost`,Nt=`-shadowcsscontext`,Pt=`[^)(]*`,Ft=String.raw`(?:\(${Pt}\)|${Pt})+?`,It=String.raw`(?:\(${Ft}\)|${Pt})+?`,Lt=String.raw`(?:\((${It})\))`;String.raw`(:nth-[-\w]+)`+Lt,Mt+Lt+``,`${jt}`,Nt+Lt+``;var E=(function(e){return e[e.ListEnd=0]=`ListEnd`,e[e.Statement=1]=`Statement`,e[e.Variable=2]=`Variable`,e[e.ElementStart=3]=`ElementStart`,e[e.Element=4]=`Element`,e[e.ForeignComponent=5]=`ForeignComponent`,e[e.Template=6]=`Template`,e[e.ElementEnd=7]=`ElementEnd`,e[e.ContainerStart=8]=`ContainerStart`,e[e.Container=9]=`Container`,e[e.ContainerEnd=10]=`ContainerEnd`,e[e.DisableBindings=11]=`DisableBindings`,e[e.ConditionalCreate=12]=`ConditionalCreate`,e[e.ConditionalBranchCreate=13]=`ConditionalBranchCreate`,e[e.Conditional=14]=`Conditional`,e[e.EnableBindings=15]=`EnableBindings`,e[e.Text=16]=`Text`,e[e.Listener=17]=`Listener`,e[e.InterpolateText=18]=`InterpolateText`,e[e.Binding=19]=`Binding`,e[e.Property=20]=`Property`,e[e.StyleProp=21]=`StyleProp`,e[e.ClassProp=22]=`ClassProp`,e[e.StyleMap=23]=`StyleMap`,e[e.ClassMap=24]=`ClassMap`,e[e.Advance=25]=`Advance`,e[e.Pipe=26]=`Pipe`,e[e.Attribute=27]=`Attribute`,e[e.ExtractedAttribute=28]=`ExtractedAttribute`,e[e.Defer=29]=`Defer`,e[e.DeferOn=30]=`DeferOn`,e[e.DeferWhen=31]=`DeferWhen`,e[e.I18nMessage=32]=`I18nMessage`,e[e.DomProperty=33]=`DomProperty`,e[e.Namespace=34]=`Namespace`,e[e.ProjectionDef=35]=`ProjectionDef`,e[e.EnableIncrementalHydrationRuntime=36]=`EnableIncrementalHydrationRuntime`,e[e.Projection=37]=`Projection`,e[e.Content=38]=`Content`,e[e.RepeaterCreate=39]=`RepeaterCreate`,e[e.Repeater=40]=`Repeater`,e[e.TwoWayProperty=41]=`TwoWayProperty`,e[e.TwoWayListener=42]=`TwoWayListener`,e[e.DeclareLet=43]=`DeclareLet`,e[e.StoreLet=44]=`StoreLet`,e[e.I18nStart=45]=`I18nStart`,e[e.I18n=46]=`I18n`,e[e.I18nEnd=47]=`I18nEnd`,e[e.I18nExpression=48]=`I18nExpression`,e[e.I18nApply=49]=`I18nApply`,e[e.IcuStart=50]=`IcuStart`,e[e.IcuEnd=51]=`IcuEnd`,e[e.IcuPlaceholder=52]=`IcuPlaceholder`,e[e.I18nContext=53]=`I18nContext`,e[e.I18nAttributes=54]=`I18nAttributes`,e[e.SourceLocation=55]=`SourceLocation`,e[e.Animation=56]=`Animation`,e[e.AnimationString=57]=`AnimationString`,e[e.AnimationBinding=58]=`AnimationBinding`,e[e.AnimationListener=59]=`AnimationListener`,e[e.Control=60]=`Control`,e[e.ControlCreate=61]=`ControlCreate`,e})(E||{}),Rt=(function(e){return e[e.LexicalRead=0]=`LexicalRead`,e[e.Context=1]=`Context`,e[e.TrackContext=2]=`TrackContext`,e[e.ReadVariable=3]=`ReadVariable`,e[e.NextContext=4]=`NextContext`,e[e.Reference=5]=`Reference`,e[e.StoreLet=6]=`StoreLet`,e[e.ContextLetReference=7]=`ContextLetReference`,e[e.GetCurrentView=8]=`GetCurrentView`,e[e.RestoreView=9]=`RestoreView`,e[e.ResetView=10]=`ResetView`,e[e.PureFunctionExpr=11]=`PureFunctionExpr`,e[e.PureFunctionParameterExpr=12]=`PureFunctionParameterExpr`,e[e.PipeBinding=13]=`PipeBinding`,e[e.PipeBindingVariadic=14]=`PipeBindingVariadic`,e[e.SafePropertyRead=15]=`SafePropertyRead`,e[e.SafeKeyedRead=16]=`SafeKeyedRead`,e[e.SafeNavigationMigration=17]=`SafeNavigationMigration`,e[e.SafeTernaryExpr=18]=`SafeTernaryExpr`,e[e.EmptyExpr=19]=`EmptyExpr`,e[e.AssignTemporaryExpr=20]=`AssignTemporaryExpr`,e[e.ReadTemporaryExpr=21]=`ReadTemporaryExpr`,e[e.SlotLiteralExpr=22]=`SlotLiteralExpr`,e[e.ConditionalCase=23]=`ConditionalCase`,e[e.ConstCollected=24]=`ConstCollected`,e[e.TwoWayBindingSet=25]=`TwoWayBindingSet`,e[e.ForeignContent=26]=`ForeignContent`,e[e.ArrowFunction=27]=`ArrowFunction`,e})(Rt||{}),zt=(function(e){return e[e.None=0]=`None`,e[e.AlwaysInline=1]=`AlwaysInline`,e})(zt||{}),Bt=(function(e){return e[e.Context=0]=`Context`,e[e.Identifier=1]=`Identifier`,e[e.SavedView=2]=`SavedView`,e[e.Alias=3]=`Alias`,e})(Bt||{}),Vt=(function(e){return e[e.Attribute=0]=`Attribute`,e[e.ClassName=1]=`ClassName`,e[e.StyleProperty=2]=`StyleProperty`,e[e.Property=3]=`Property`,e[e.Template=4]=`Template`,e[e.I18n=5]=`I18n`,e[e.LegacyAnimation=6]=`LegacyAnimation`,e[e.TwoWayProperty=7]=`TwoWayProperty`,e[e.Animation=8]=`Animation`,e})(Vt||{}),Ht=(function(e){return e[e.Creation=0]=`Creation`,e[e.Postproccessing=1]=`Postproccessing`,e})(Ht||{}),Ut=(function(e){return e[e.I18nText=0]=`I18nText`,e[e.I18nAttribute=1]=`I18nAttribute`,e})(Ut||{}),Wt=(function(e){return e[e.None=0]=`None`,e[e.ElementTag=1]=`ElementTag`,e[e.TemplateTag=2]=`TemplateTag`,e[e.OpenTag=4]=`OpenTag`,e[e.CloseTag=8]=`CloseTag`,e[e.ExpressionIndex=16]=`ExpressionIndex`,e})(Wt||{}),Gt=(function(e){return e[e.HTML=0]=`HTML`,e[e.SVG=1]=`SVG`,e[e.Math=2]=`Math`,e})(Gt||{}),Kt=(function(e){return e[e.Idle=0]=`Idle`,e[e.Immediate=1]=`Immediate`,e[e.Timer=2]=`Timer`,e[e.Hover=3]=`Hover`,e[e.Interaction=4]=`Interaction`,e[e.Viewport=5]=`Viewport`,e[e.Never=6]=`Never`,e})(Kt||{}),qt=(function(e){return e[e.RootI18n=0]=`RootI18n`,e[e.Icu=1]=`Icu`,e[e.Attr=2]=`Attr`,e})(qt||{}),Jt=(function(e){return e[e.NgTemplate=0]=`NgTemplate`,e[e.Structural=1]=`Structural`,e[e.Block=2]=`Block`,e})(Jt||{}),Yt=(function(e){return e[e.None=0]=`None`,e[e.InChildOperation=1]=`InChildOperation`,e[e.InArrowFunctionOperation=2]=`InArrowFunctionOperation`,e[e.InSafeNavigationMigration=4]=`InSafeNavigationMigration`,e})(Yt||{});E.Element,E.ElementStart,E.Container,E.ContainerStart,E.Template,E.RepeaterCreate,E.ConditionalCreate,E.ConditionalBranchCreate;var D=(function(e){return e[e.Tmpl=0]=`Tmpl`,e[e.Host=1]=`Host`,e[e.Both=2]=`Both`,e})(D||{}),Xt=(function(e){return e[e.Full=0]=`Full`,e[e.DomOnly=1]=`DomOnly`,e})(Xt||{});T.ariaProperty,T.ariaProperty,T.attribute,T.attribute,T.classProp,T.classProp,T.element,T.element,T.elementContainer,T.elementContainer,T.elementContainerEnd,T.elementContainerEnd,T.elementContainerStart,T.elementContainerStart,T.elementEnd,T.elementEnd,T.elementStart,T.elementStart,T.domProperty,T.domProperty,T.i18nExp,T.i18nExp,T.listener,T.listener,T.listener,T.listener,T.property,T.property,T.styleProp,T.styleProp,T.syntheticHostListener,T.syntheticHostListener,T.syntheticHostProperty,T.syntheticHostProperty,T.templateCreate,T.templateCreate,T.twoWayProperty,T.twoWayProperty,T.twoWayListener,T.twoWayListener,T.declareLet,T.declareLet,T.conditionalCreate,T.conditionalBranchCreate,T.conditionalBranchCreate,T.conditionalBranchCreate,T.domElement,T.domElement,T.domElementStart,T.domElementStart,T.domElementEnd,T.domElementEnd,T.domElementContainer,T.domElementContainer,T.domElementContainerStart,T.domElementContainerStart,T.domElementContainerEnd,T.domElementContainerEnd,T.domListener,T.domListener,T.domTemplate,T.domTemplate,T.animationEnter,T.animationEnter,T.animationLeave,T.animationLeave,T.animationEnterListener,T.animationEnterListener,T.animationLeaveListener,T.animationLeaveListener,C.And,C.Bigger,C.BiggerEquals,C.BitwiseOr,C.BitwiseAnd,C.Divide,C.Assign,C.Equals,C.Identical,C.Lower,C.LowerEquals,C.Minus,C.Modulo,C.Exponentiation,C.Multiply,C.NotEquals,C.NotIdentical,C.NullishCoalesce,C.Or,C.Plus,C.In,C.InstanceOf,C.AdditionAssignment,C.SubtractionAssignment,C.MultiplicationAssignment,C.DivisionAssignment,C.RemainderAssignment,C.ExponentiationAssignment,C.AndAssignment,C.OrAssignment,C.NullishCoalesceAssignment,E.Property,E.Property,E.Property,E.Attribute,E.Attribute,E.Property,E.TwoWayProperty,E.Container,E.ContainerStart,E.ContainerEnd,E.Element,E.ElementStart,E.ElementEnd,E.Template,E.ElementEnd,E.ElementStart,E.Element,E.ContainerEnd,E.ContainerStart,E.Container,E.I18nEnd,E.I18nStart,E.I18n,E.Pipe;var Zt=` \f
\r	\v ᠎ - \u2028\u2029  　﻿`;`${Zt}`,`${Zt}`;var Qt=(function(e){return e[e.Character=0]=`Character`,e[e.Identifier=1]=`Identifier`,e[e.PrivateIdentifier=2]=`PrivateIdentifier`,e[e.Keyword=3]=`Keyword`,e[e.String=4]=`String`,e[e.Operator=5]=`Operator`,e[e.Number=6]=`Number`,e[e.RegExpBody=7]=`RegExpBody`,e[e.RegExpFlags=8]=`RegExpFlags`,e[e.Error=9]=`Error`,e})(Qt||{}),$t=(function(e){return e[e.Plain=0]=`Plain`,e[e.TemplateLiteralPart=1]=`TemplateLiteralPart`,e[e.TemplateLiteralEnd=2]=`TemplateLiteralEnd`,e})($t||{});Qt.Character,E.StyleMap,E.ClassMap,E.StyleProp,E.ClassProp,E.Attribute,E.Property,E.Attribute,E.Control,E.DomProperty,E.DomProperty,E.Attribute,E.StyleMap,E.ClassMap,E.StyleProp,E.ClassProp,E.Listener,E.TwoWayListener,E.AnimationListener,E.StyleMap,E.ClassMap,E.StyleProp,E.ClassProp,E.Property,E.TwoWayProperty,E.DomProperty,E.Attribute,E.Animation,E.Control,Kt.Idle,T.deferOnIdle,T.deferPrefetchOnIdle,T.deferHydrateOnIdle,Kt.Immediate,T.deferOnImmediate,T.deferPrefetchOnImmediate,T.deferHydrateOnImmediate,Kt.Timer,T.deferOnTimer,T.deferPrefetchOnTimer,T.deferHydrateOnTimer,Kt.Hover,T.deferOnHover,T.deferPrefetchOnHover,T.deferHydrateOnHover,Kt.Interaction,T.deferOnInteraction,T.deferPrefetchOnInteraction,T.deferHydrateOnInteraction,Kt.Viewport,T.deferOnViewport,T.deferPrefetchOnViewport,T.deferHydrateOnViewport,Kt.Never,T.deferHydrateNever,T.deferHydrateNever,T.deferHydrateNever,T.pipeBind1,T.pipeBind2,T.pipeBind3,T.pipeBind4,T.textInterpolate,T.textInterpolate1,T.textInterpolate2,T.textInterpolate3,T.textInterpolate4,T.textInterpolate5,T.textInterpolate6,T.textInterpolate7,T.textInterpolate8,T.textInterpolateV,T.interpolate,T.interpolate1,T.interpolate2,T.interpolate3,T.interpolate4,T.interpolate5,T.interpolate6,T.interpolate7,T.interpolate8,T.interpolateV,T.pureFunction0,T.pureFunction1,T.pureFunction2,T.pureFunction3,T.pureFunction4,T.pureFunction5,T.pureFunction6,T.pureFunction7,T.pureFunction8,T.pureFunctionV,T.resolveWindow,T.resolveDocument,T.resolveBody,$e.HTML,T.sanitizeHtml,$e.RESOURCE_URL,T.sanitizeResourceUrl,$e.SCRIPT,T.sanitizeScript,$e.STYLE,T.sanitizeStyle,$e.URL,T.sanitizeUrl,$e.ATTRIBUTE_NO_BINDING,T.validateAttribute,$e.HTML,T.trustConstantHtml,$e.RESOURCE_URL,T.trustConstantResourceUrl;var en=(function(e){return e[e.None=0]=`None`,e[e.ViewContextRead=1]=`ViewContextRead`,e[e.ViewContextWrite=2]=`ViewContextWrite`,e[e.SideEffectful=4]=`SideEffectful`,e})(en||{});D.Tmpl,D.Tmpl,D.Both,D.Host,D.Tmpl,D.Tmpl,D.Tmpl,D.Both,D.Both,D.Both,D.Tmpl,D.Both,D.Both,D.Tmpl,D.Both,D.Tmpl,D.Both,D.Both,D.Tmpl,D.Tmpl,D.Tmpl,D.Tmpl,D.Tmpl,D.Both,D.Both,D.Tmpl,D.Tmpl,D.Tmpl,D.Tmpl,D.Both,D.Both,D.Both,D.Tmpl,D.Tmpl,D.Both,D.Tmpl,D.Tmpl,D.Tmpl,D.Both,D.Both,D.Tmpl,D.Both,D.Both,D.Both,D.Both,D.Both,D.Tmpl,D.Tmpl,D.Tmpl,D.Tmpl,D.Tmpl,D.Tmpl,D.Tmpl,D.Tmpl,D.Tmpl,D.Tmpl,D.Tmpl,D.Tmpl,D.Both,D.Tmpl,D.Both,D.Tmpl,D.Both,D.Tmpl,D.Tmpl,D.Tmpl,D.Tmpl,D.Tmpl,D.Tmpl,D.Both,D.Both,D.Both,At.Property,Vt.Property,At.TwoWay,Vt.TwoWayProperty,At.Attribute,Vt.Attribute,At.Class,Vt.ClassName,At.Style,Vt.StyleProperty,At.LegacyAnimation,Vt.LegacyAnimation,At.Animation,Vt.Animation;var tn=`%COMP%`;`${tn}`,`${tn}`,class e{static SINGLETON=new e;static veWillInferAnyFor(t){let n=e.SINGLETON;return t instanceof kt?t.visit(n):t.receiver.visit(n)}visitUnary(e){return e.expr.visit(this)}visitBinary(e){return e.left.visit(this)||e.right.visit(this)}visitChain(){return!1}visitConditional(e){return e.condition.visit(this)||e.trueExp.visit(this)||e.falseExp.visit(this)}visitCall(){return!0}visitSafeCall(){return!1}visitImplicitReceiver(){return!1}visitThisReceiver(){return!1}visitInterpolation(e){return e.expressions.some(e=>e.visit(this))}visitKeyedRead(){return!1}visitLiteralArray(){return!0}visitLiteralMap(){return!0}visitLiteralPrimitive(){return!1}visitPipe(){return!0}visitPrefixNot(e){return e.expression.visit(this)}visitTypeofExpression(e){return e.expression.visit(this)}visitVoidExpression(e){return e.expression.visit(this)}visitNonNullAssert(e){return e.expression.visit(this)}visitPropertyRead(){return!1}visitSafePropertyRead(){return!1}visitSafeKeyedRead(){return!1}visitTemplateLiteral(){return!1}visitTemplateLiteralElement(){return!1}visitTaggedTemplateLiteral(){return!1}visitParenthesizedExpression(e){return e.expression.visit(this)}visitRegularExpressionLiteral(){return!1}visitSpreadElement(e){return e.expression.visit(this)}visitArrowFunction(e,t){return!1}};var nn=null,rn=!1,an=1,on=null,sn=Symbol(`SIGNAL`);function O(e){let t=nn;return nn=e,t}function cn(){return nn}var ln={version:0,lastCleanEpoch:0,dirty:!1,producers:void 0,producersTail:void 0,consumers:void 0,consumersTail:void 0,recomputing:!1,consumerAllowSignalWrites:!1,consumerIsAlwaysLive:!1,kind:`unknown`,producerMustRecompute:()=>!1,producerRecomputeValue:()=>{},consumerMarkedDirty:()=>{},consumerOnSignalRead:()=>{}};function un(e){if(rn)throw Error(``);if(nn===null)return;nn.consumerOnSignalRead(e);let t=nn.producersTail;if(t!==void 0&&t.producer===e)return;let n,r=nn.recomputing;if(r&&(n=t===void 0?nn.producers:t.nextProducer,n!==void 0&&n.producer===e)){nn.producersTail=n,n.lastReadVersion=e.version,n.knownValidAtEpoch=an;return}let i=e.consumersTail;if(i!==void 0&&i.consumer===nn&&(!r||i.knownValidAtEpoch===an))return;let a=Tn(nn),o={producer:e,consumer:nn,nextProducer:n,prevConsumer:void 0,knownValidAtEpoch:an,lastReadVersion:e.version,nextConsumer:void 0};nn.producersTail=o,t===void 0?nn.producers=o:t.nextProducer=o,a&&Cn(e,o)}function dn(){an++}function fn(e){if((!Tn(e)||e.dirty)&&(e.dirty||e.lastCleanEpoch!==an)){if(!e.producerMustRecompute(e)&&!xn(e)){gn(e);return}e.producerRecomputeValue(e),gn(e)}}function pn(e){if(e.consumers===void 0)return;let t=rn;rn=!0;try{for(let t=e.consumers;t!==void 0;t=t.nextConsumer){let e=t.consumer;e.dirty||hn(e)}}finally{rn=t}}function mn(){return nn?.consumerAllowSignalWrites!==!1}function hn(e){e.dirty=!0,pn(e),e.consumerMarkedDirty?.(e)}function gn(e){e.dirty=!1,e.lastCleanEpoch=an}function _n(e){return e&&vn(e),O(e)}function vn(e){if(e.producersTail?.knownValidAtEpoch===an){let t=e.producers;for(;t!==void 0;)t.knownValidAtEpoch=null,t=t.nextProducer}e.producersTail=void 0,e.recomputing=!0}function yn(e,t){O(t),e&&bn(e)}function bn(e){e.recomputing=!1;let t=e.producersTail,n=t===void 0?e.producers:t.nextProducer;if(n!==void 0){if(Tn(e))do n=wn(n);while(n!==void 0);t===void 0?e.producers=void 0:t.nextProducer=void 0}}function xn(e){for(let t=e.producers;t!==void 0;t=t.nextProducer){let e=t.producer,n=t.lastReadVersion;if(n!==e.version||(fn(e),n!==e.version))return!0}return!1}function Sn(e){if(Tn(e)){let t=e.producers;for(;t!==void 0;)t=wn(t)}e.producers=void 0,e.producersTail=void 0,e.consumers=void 0,e.consumersTail=void 0}function Cn(e,t){let n=e.consumersTail,r=Tn(e);if(n===void 0?(t.nextConsumer=void 0,e.consumers=t):(t.nextConsumer=n.nextConsumer,n.nextConsumer=t),t.prevConsumer=n,e.consumersTail=t,!r)for(let t=e.producers;t!==void 0;t=t.nextProducer)Cn(t.producer,t)}function wn(e){let t=e.producer,n=e.nextProducer,r=e.nextConsumer,i=e.prevConsumer;if(e.nextConsumer=void 0,e.prevConsumer=void 0,r===void 0?t.consumersTail=i:r.prevConsumer=i,i!==void 0)i.nextConsumer=r;else if(t.consumers=r,!Tn(t)){let e=t.producers;for(;e!==void 0;)e=wn(e)}return n}function Tn(e){return e.consumerIsAlwaysLive||e.consumers!==void 0}function En(e){on?.(e)}function Dn(e,t){return Object.is(e,t)}function On(e,t){let n=Object.create(Mn);n.computation=e,t!==void 0&&(n.equal=t);let r=()=>{if(fn(n),un(n),n.value===jn)throw n.error;return n.value};return r[sn]=n,En(n),r}var kn=Symbol(`UNSET`),An=Symbol(`COMPUTING`),jn=Symbol(`ERRORED`),Mn={...ln,value:kn,dirty:!0,error:null,equal:Dn,kind:`computed`,producerMustRecompute(e){return e.value===kn||e.value===An},producerRecomputeValue(e){if(e.value===An)throw Error(``);let t=e.value;e.value=An;let n=_n(e),r,i=!1;try{r=e.computation(),O(null),i=t!==kn&&t!==jn&&r!==jn&&e.equal(t,r)}catch(t){r=jn,e.error=t}finally{yn(e,n)}if(i){e.value=t;return}e.value=r,e.version++}};function Nn(){throw Error()}var Pn=Nn;function Fn(e){Pn(e)}function In(e){Pn=e}var Ln=null;function Rn(e,t){let n=Object.create(Hn);n.value=e,t!==void 0&&(n.equal=t);let r=()=>zn(n);return r[sn]=n,En(n),[r,e=>Bn(n,e),e=>Vn(n,e)]}function zn(e){return un(e),e.value}function Bn(e,t){mn()||Fn(e),e.equal(e.value,t)||(e.value=t,Un(e))}function Vn(e,t){mn()||Fn(e),Bn(e,t(e.value))}var Hn={...ln,equal:Dn,value:void 0,kind:`signal`};function Un(e){e.version++,dn(),pn(e),Ln?.(e)}var Wn={...ln,consumerIsAlwaysLive:!0,consumerAllowSignalWrites:!0,dirty:!0,kind:`effect`};function Gn(e){if(e.dirty=!1,e.version>0&&!xn(e))return;e.version++;let t=_n(e);try{e.cleanup(),e.fn()}finally{yn(e,t)}}var Kn=void 0;function qn(){return Kn}function Jn(e){let t=Kn;return Kn=e,t}var Yn=Symbol(`NotFound`);function Xn(e){return e===Yn||e?.name===`ɵNotFound`}function Zn(e,t,n){let r=Object.create(er);r.source=e,r.computation=t,n!=null&&(r.equal=n);let i=()=>{if(fn(r),un(r),r.value===jn)throw r.error;return r.value};return i[sn]=r,En(r),i}function Qn(e,t){fn(e),Bn(e,t),gn(e)}function $n(e,t){if(fn(e),e.value===jn)throw e.error;Vn(e,t),gn(e)}var er={...ln,value:kn,dirty:!0,error:null,equal:Dn,kind:`linkedSignal`,producerMustRecompute(e){return e.value===kn||e.value===An},producerRecomputeValue(e){if(e.value===An)throw Error(``);let t=e.value;e.value=An;let n=_n(e),r,i=!1;try{let n=e.source(),a=t!==kn&&t!==jn,o=a?{source:e.sourceValue,value:t}:void 0;r=e.computation(n,o),e.sourceValue=n,O(null),i=a&&r!==jn&&e.equal(t,r)}catch(t){r=jn,e.error=t}finally{yn(e,n)}if(i){e.value=t;return}e.value=r,e.version++}};function tr(e){let t=O(null);try{return e()}finally{O(t)}}var nr=function(e,t){return nr=Object.setPrototypeOf||{__proto__:[]}instanceof Array&&function(e,t){e.__proto__=t}||function(e,t){for(var n in t)Object.prototype.hasOwnProperty.call(t,n)&&(e[n]=t[n])},nr(e,t)};function rr(e,t){if(typeof t!=`function`&&t!==null)throw TypeError(`Class extends value `+String(t)+` is not a constructor or null`);nr(e,t);function n(){this.constructor=e}e.prototype=t===null?Object.create(t):(n.prototype=t.prototype,new n)}function ir(e){var t=typeof Symbol==`function`&&Symbol.iterator,n=t&&e[t],r=0;if(n)return n.call(e);if(e&&typeof e.length==`number`)return{next:function(){return e&&r>=e.length&&(e=void 0),{value:e&&e[r++],done:!e}}};throw TypeError(t?`Object is not iterable.`:`Symbol.iterator is not defined.`)}function ar(e,t){var n=typeof Symbol==`function`&&e[Symbol.iterator];if(!n)return e;var r=n.call(e),i,a=[],o;try{for(;(t===void 0||t-->0)&&!(i=r.next()).done;)a.push(i.value)}catch(e){o={error:e}}finally{try{i&&!i.done&&(n=r.return)&&n.call(r)}finally{if(o)throw o.error}}return a}function or(e,t,n){if(n||arguments.length===2)for(var r=0,i=t.length,a;r<i;r++)(a||!(r in t))&&(a||=Array.prototype.slice.call(t,0,r),a[r]=t[r]);return e.concat(a||Array.prototype.slice.call(t))}function sr(e){return typeof e==`function`}function cr(e){var t=e(function(e){Error.call(e),e.stack=Error().stack});return t.prototype=Object.create(Error.prototype),t.prototype.constructor=t,t}var lr=cr(function(e){return function(t){e(this),this.message=t?t.length+` errors occurred during unsubscription:
`+t.map(function(e,t){return t+1+`) `+e.toString()}).join(`
  `):``,this.name=`UnsubscriptionError`,this.errors=t}});function ur(e,t){if(e){var n=e.indexOf(t);0<=n&&e.splice(n,1)}}var dr=function(){function e(e){this.initialTeardown=e,this.closed=!1,this._parentage=null,this._finalizers=null}return e.prototype.unsubscribe=function(){var e,t,n,r,i;if(!this.closed){this.closed=!0;var a=this._parentage;if(a){if(this._parentage=null,Array.isArray(a))try{for(var o=ir(a),s=o.next();!s.done;s=o.next())s.value.remove(this)}catch(t){e={error:t}}finally{try{s&&!s.done&&(t=o.return)&&t.call(o)}finally{if(e)throw e.error}}else a.remove(this)}var c=this.initialTeardown;if(sr(c))try{c()}catch(e){i=e instanceof lr?e.errors:[e]}var l=this._finalizers;if(l){this._finalizers=null;try{for(var u=ir(l),d=u.next();!d.done;d=u.next()){var f=d.value;try{mr(f)}catch(e){i??=[],e instanceof lr?i=or(or([],ar(i)),ar(e.errors)):i.push(e)}}}catch(e){n={error:e}}finally{try{d&&!d.done&&(r=u.return)&&r.call(u)}finally{if(n)throw n.error}}}if(i)throw new lr(i)}},e.prototype.add=function(t){if(t&&t!==this){if(this.closed)mr(t);else{if(t instanceof e){if(t.closed||t._hasParent(this))return;t._addParent(this)}(this._finalizers=this._finalizers??[]).push(t)}}},e.prototype._hasParent=function(e){var t=this._parentage;return t===e||Array.isArray(t)&&t.includes(e)},e.prototype._addParent=function(e){var t=this._parentage;this._parentage=Array.isArray(t)?(t.push(e),t):t?[t,e]:e},e.prototype._removeParent=function(e){var t=this._parentage;t===e?this._parentage=null:Array.isArray(t)&&ur(t,e)},e.prototype.remove=function(t){var n=this._finalizers;n&&ur(n,t),t instanceof e&&t._removeParent(this)},e.EMPTY=(function(){var t=new e;return t.closed=!0,t})(),e}(),fr=dr.EMPTY;function pr(e){return e instanceof dr||e&&`closed`in e&&sr(e.remove)&&sr(e.add)&&sr(e.unsubscribe)}function mr(e){sr(e)?e():e.unsubscribe()}var hr={onUnhandledError:null,onStoppedNotification:null,Promise:void 0,useDeprecatedSynchronousErrorHandling:!1,useDeprecatedNextContext:!1},gr={setTimeout:function(e,t){var n=[...arguments].slice(2),r=gr.delegate;return r?.setTimeout?r.setTimeout.apply(r,or([e,t],ar(n))):setTimeout.apply(void 0,or([e,t],ar(n)))},clearTimeout:function(e){return(gr.delegate?.clearTimeout||clearTimeout)(e)},delegate:void 0};function _r(e){gr.setTimeout(function(){var t=hr.onUnhandledError;if(t)t(e);else throw e})}function vr(){}var yr=(function(){return Sr(`C`,void 0,void 0)})();function br(e){return Sr(`E`,void 0,e)}function xr(e){return Sr(`N`,e,void 0)}function Sr(e,t,n){return{kind:e,value:t,error:n}}var Cr=null;function wr(e){if(hr.useDeprecatedSynchronousErrorHandling){var t=!Cr;if(t&&(Cr={errorThrown:!1,error:null}),e(),t){var n=Cr,r=n.errorThrown,i=n.error;if(Cr=null,r)throw i}}else e()}function Tr(e){hr.useDeprecatedSynchronousErrorHandling&&Cr&&(Cr.errorThrown=!0,Cr.error=e)}var Er=function(e){rr(t,e);function t(t){var n=e.call(this)||this;return n.isStopped=!1,t?(n.destination=t,pr(t)&&t.add(n)):n.destination=Pr,n}return t.create=function(e,t,n){return new Ar(e,t,n)},t.prototype.next=function(e){this.isStopped?Nr(xr(e),this):this._next(e)},t.prototype.error=function(e){this.isStopped?Nr(br(e),this):(this.isStopped=!0,this._error(e))},t.prototype.complete=function(){this.isStopped?Nr(yr,this):(this.isStopped=!0,this._complete())},t.prototype.unsubscribe=function(){this.closed||(this.isStopped=!0,e.prototype.unsubscribe.call(this),this.destination=null)},t.prototype._next=function(e){this.destination.next(e)},t.prototype._error=function(e){try{this.destination.error(e)}finally{this.unsubscribe()}},t.prototype._complete=function(){try{this.destination.complete()}finally{this.unsubscribe()}},t}(dr),Dr=Function.prototype.bind;function Or(e,t){return Dr.call(e,t)}var kr=function(){function e(e){this.partialObserver=e}return e.prototype.next=function(e){var t=this.partialObserver;if(t.next)try{t.next(e)}catch(e){jr(e)}},e.prototype.error=function(e){var t=this.partialObserver;if(t.error)try{t.error(e)}catch(e){jr(e)}else jr(e)},e.prototype.complete=function(){var e=this.partialObserver;if(e.complete)try{e.complete()}catch(e){jr(e)}},e}(),Ar=function(e){rr(t,e);function t(t,n,r){var i=e.call(this)||this,a;if(sr(t)||!t)a={next:t??void 0,error:n??void 0,complete:r??void 0};else{var o;i&&hr.useDeprecatedNextContext?(o=Object.create(t),o.unsubscribe=function(){return i.unsubscribe()},a={next:t.next&&Or(t.next,o),error:t.error&&Or(t.error,o),complete:t.complete&&Or(t.complete,o)}):a=t}return i.destination=new kr(a),i}return t}(Er);function jr(e){hr.useDeprecatedSynchronousErrorHandling?Tr(e):_r(e)}function Mr(e){throw e}function Nr(e,t){var n=hr.onStoppedNotification;n&&gr.setTimeout(function(){return n(e,t)})}var Pr={closed:!0,next:vr,error:Mr,complete:vr},Fr=(function(){return typeof Symbol==`function`&&Symbol.observable||`@@observable`})();function Ir(e){return e}function Lr(e){return e.length===0?Ir:e.length===1?e[0]:function(t){return e.reduce(function(e,t){return t(e)},t)}}var Rr=function(){function e(e){e&&(this._subscribe=e)}return e.prototype.lift=function(t){var n=new e;return n.source=this,n.operator=t,n},e.prototype.subscribe=function(e,t,n){var r=this,i=Vr(e)?e:new Ar(e,t,n);return wr(function(){var e=r,t=e.operator,n=e.source;i.add(t?t.call(i,n):n?r._subscribe(i):r._trySubscribe(i))}),i},e.prototype._trySubscribe=function(e){try{return this._subscribe(e)}catch(t){e.error(t)}},e.prototype.forEach=function(e,t){var n=this;return t=zr(t),new t(function(t,r){var i=new Ar({next:function(t){try{e(t)}catch(e){r(e),i.unsubscribe()}},error:r,complete:t});n.subscribe(i)})},e.prototype._subscribe=function(e){return this.source?.subscribe(e)},e.prototype[Fr]=function(){return this},e.prototype.pipe=function(){return Lr([...arguments])(this)},e.prototype.toPromise=function(e){var t=this;return e=zr(e),new e(function(e,n){var r;t.subscribe(function(e){return r=e},function(e){return n(e)},function(){return e(r)})})},e.create=function(t){return new e(t)},e}();function zr(e){return e??hr.Promise??Promise}function Br(e){return e&&sr(e.next)&&sr(e.error)&&sr(e.complete)}function Vr(e){return e&&e instanceof Er||Br(e)&&pr(e)}function Hr(e){return sr(e?.lift)}function Ur(e){return function(t){if(Hr(t))return t.lift(function(t){try{return e(t,this)}catch(e){this.error(e)}});throw TypeError(`Unable to lift unknown Observable type`)}}function Wr(e,t,n,r,i){return new Gr(e,t,n,r,i)}var Gr=function(e){rr(t,e);function t(t,n,r,i,a,o){var s=e.call(this,t)||this;return s.onFinalize=a,s.shouldUnsubscribe=o,s._next=n?function(e){try{n(e)}catch(e){t.error(e)}}:e.prototype._next,s._error=i?function(e){try{i(e)}catch(e){t.error(e)}finally{this.unsubscribe()}}:e.prototype._error,s._complete=r?function(){try{r()}catch(e){t.error(e)}finally{this.unsubscribe()}}:e.prototype._complete,s}return t.prototype.unsubscribe=function(){var t;if(!this.shouldUnsubscribe||this.shouldUnsubscribe()){var n=this.closed;e.prototype.unsubscribe.call(this),!n&&((t=this.onFinalize)==null||t.call(this))}},t}(Er),Kr=cr(function(e){return function(){e(this),this.name=`ObjectUnsubscribedError`,this.message=`object unsubscribed`}}),qr=function(e){rr(t,e);function t(){var t=e.call(this)||this;return t.closed=!1,t.currentObservers=null,t.observers=[],t.isStopped=!1,t.hasError=!1,t.thrownError=null,t}return t.prototype.lift=function(e){var t=new Jr(this,this);return t.operator=e,t},t.prototype._throwIfClosed=function(){if(this.closed)throw new Kr},t.prototype.next=function(e){var t=this;wr(function(){var n,r;if(t._throwIfClosed(),!t.isStopped){t.currentObservers||=Array.from(t.observers);try{for(var i=ir(t.currentObservers),a=i.next();!a.done;a=i.next())a.value.next(e)}catch(e){n={error:e}}finally{try{a&&!a.done&&(r=i.return)&&r.call(i)}finally{if(n)throw n.error}}}})},t.prototype.error=function(e){var t=this;wr(function(){if(t._throwIfClosed(),!t.isStopped){t.hasError=t.isStopped=!0,t.thrownError=e;for(var n=t.observers;n.length;)n.shift().error(e)}})},t.prototype.complete=function(){var e=this;wr(function(){if(e._throwIfClosed(),!e.isStopped){e.isStopped=!0;for(var t=e.observers;t.length;)t.shift().complete()}})},t.prototype.unsubscribe=function(){this.isStopped=this.closed=!0,this.observers=this.currentObservers=null},Object.defineProperty(t.prototype,"observed",{get:function(){return this.observers?.length>0},enumerable:!1,configurable:!0}),t.prototype._trySubscribe=function(t){return this._throwIfClosed(),e.prototype._trySubscribe.call(this,t)},t.prototype._subscribe=function(e){return this._throwIfClosed(),this._checkFinalizedStatuses(e),this._innerSubscribe(e)},t.prototype._innerSubscribe=function(e){var t=this,n=this,r=n.hasError,i=n.isStopped,a=n.observers;return r||i?fr:(this.currentObservers=null,a.push(e),new dr(function(){t.currentObservers=null,ur(a,e)}))},t.prototype._checkFinalizedStatuses=function(e){var t=this,n=t.hasError,r=t.thrownError,i=t.isStopped;n?e.error(r):i&&e.complete()},t.prototype.asObservable=function(){var e=new Rr;return e.source=this,e},t.create=function(e,t){return new Jr(e,t)},t}(Rr),Jr=function(e){rr(t,e);function t(t,n){var r=e.call(this)||this;return r.destination=t,r.source=n,r}return t.prototype.next=function(e){var t,n;(n=(t=this.destination)?.next)==null||n.call(t,e)},t.prototype.error=function(e){var t,n;(n=(t=this.destination)?.error)==null||n.call(t,e)},t.prototype.complete=function(){var e,t;(t=(e=this.destination)?.complete)==null||t.call(e)},t.prototype._subscribe=function(e){return this.source?.subscribe(e)??fr},t}(qr),Yr=function(e){rr(t,e);function t(t){var n=e.call(this)||this;return n._value=t,n}return Object.defineProperty(t.prototype,"value",{get:function(){return this.getValue()},enumerable:!1,configurable:!0}),t.prototype._subscribe=function(t){var n=e.prototype._subscribe.call(this,t);return!n.closed&&t.next(this._value),n},t.prototype.getValue=function(){var e=this,t=e.hasError,n=e.thrownError,r=e._value;if(t)throw n;return this._throwIfClosed(),r},t.prototype.next=function(t){e.prototype.next.call(this,this._value=t)},t}(qr);function Xr(e,t){return Ur(function(n,r){var i=0;n.subscribe(Wr(r,function(n){r.next(e.call(t,n,i++))}))})}var Zr=`https://angular.dev/best-practices/security#preventing-cross-site-scripting-xss`,k=class extends Error{code;constructor(e,t){super($r(e,t)),this.code=e}};function Qr(e){return`NG0${Math.abs(e)}`}function $r(e,t){return`${Qr(e)}${t?`: `+t:``}`}function ei(e){for(let t in e)if(e[t]===ei)return t;throw Error(``)}function ti(e){if(typeof e==`string`)return e;if(Array.isArray(e))return`[${e.map(ti).join(`, `)}]`;if(e==null)return``+e;let t=e.overriddenName||e.name;if(t)return`${t}`;let n=e.toString();if(n==null)return``+n;let r=n.indexOf(`
`);return r>=0?n.slice(0,r):n}function ni(e,t){return e?t?`${e} ${t}`:e:t||``}var ri=ei({__forward_ref__:ei});function ii(e){return e.__forward_ref__=ii,e}function ai(e){return oi(e)?e():e}function oi(e){return typeof e==`function`&&Object.hasOwn(e,ri)&&e.__forward_ref__===ii}function si(e){return{token:e.token,providedIn:e.providedIn||null,factory:e.factory,value:void 0}}function ci(e){return li(e,fi)}function li(e,t){return Object.hasOwn(e,t)&&e[t]||null}function ui(e){return(e?.[fi]??null)||null}function di(e){return e&&Object.hasOwn(e,pi)?e[pi]:null}var fi=ei({ɵprov:ei}),pi=ei({ɵinj:ei}),mi=class{_desc;ngMetadataName=`InjectionToken`;ɵprov;constructor(e,t){this._desc=e,this.ɵprov=void 0,typeof t==`number`?this.__NG_ELEMENT_ID__=t:t!==void 0&&(this.ɵprov=si({token:this,providedIn:t.providedIn||`root`,factory:t.factory}))}get multi(){return this}toString(){return`InjectionToken ${this._desc}`}};function hi(e){return e&&!!e.ɵproviders}var gi=ei({ɵcmp:ei}),_i=ei({ɵdir:ei}),vi=ei({ɵpipe:ei}),yi=ei({ɵfac:ei}),bi=ei({__NG_ELEMENT_ID__:ei}),xi=ei({__NG_ENV_ID__:ei});function Si(e){return Ti(e,`@Component`),e[gi]||null}function Ci(e){return Ti(e,`@Directive`),e[_i]||null}function wi(e){return Ti(e,`@Pipe`),e[vi]||null}function Ti(e,t){if(e==null)throw new k(-919,!1)}function Ei(e){return typeof e==`string`?e:e==null?``:String(e)}var Di=ei({ngErrorCode:ei}),Oi=ei({ngErrorMessage:ei}),ki=ei({ngTokenPath:ei});function Ai(e,t){return Mi(``,-200,t)}function ji(e,t){throw new k(-201,!1)}function Mi(e,t,n){let r=new k(t,e);return r[Di]=t,r[Oi]=e,n&&(r[ki]=n),r}function Ni(e){return e[Di]}var Pi;function Fi(){return Pi}function Ii(e){let t=Pi;return Pi=e,t}function Li(e,t,n){let r=ci(e);if(r&&r.providedIn==`root`)return r.value===void 0?r.value=r.factory():r.value;if(n&8)return null;if(t!==void 0)return t;ji(e,``)}var Ri=globalThis,zi={},Bi=`__NG_DI_FLAG__`,Vi=class{injector;constructor(e){this.injector=e}retrieve(e,t){let n=Wi(t)||0;try{return this.injector.get(e,n&8?null:zi,n)}catch(e){if(Xn(e))return e;throw e}}};function Hi(e,t=0){let n=qn();if(n===void 0)throw new k(-203,!1);if(n===null)return Li(e,void 0,t);{let r=Gi(t),i=n.retrieve(e,r);if(Xn(i)){if(r.optional)return null;throw i}return i}}function Ui(e,t=0){return(Fi()||Hi)(ai(e),t)}function A(e,t){return Ui(e,Wi(t))}function Wi(e){return e===void 0||typeof e==`number`?e:0|(e.optional&&8)|(e.host&&1)|(e.self&&2)|(e.skipSelf&&4)}function Gi(e){return{optional:!!(e&8),host:!!(e&1),self:!!(e&2),skipSelf:!!(e&4)}}function Ki(e){let t=[];for(let n=0;n<e.length;n++){let r=ai(e[n]);if(Array.isArray(r)){if(r.length===0)throw new k(900,!1);let e,n=0;for(let t=0;t<r.length;t++){let i=r[t],a=qi(i);typeof a==`number`?a===-1?e=i.token:n|=a:e=i}t.push(Ui(e,n))}else t.push(Ui(r))}return t}function qi(e){return e[Bi]}function Ji(e,t){return Object.hasOwn(e,yi)?e[yi]:null}function Yi(e,t){e.forEach(e=>Array.isArray(e)?Yi(e,t):t(e))}function Xi(e,t,n){t>=e.length?e.push(n):e.splice(t,0,n)}function Zi(e,t){return t>=e.length-1?e.pop():e.splice(t,1)[0]}function Qi(e,t,n,r){let i=e.length;if(i==t)e.push(n,r);else if(i===1)e.push(r,e[0]),e[0]=n;else{for(i--,e.push(e[i-1],e[i]);i>t;){let t=i-2;e[i]=e[t],i--}e[t]=n,e[t+1]=r}}function $i(e,t,n){let r=ta(e,t);return r>=0?e[r|1]=n:(r=~r,Qi(e,r,t,n)),r}function ea(e,t){let n=ta(e,t);if(n>=0)return e[n|1]}function ta(e,t){return na(e,t,1)}function na(e,t,n){let r=0,i=e.length>>n;for(;i!==r;){let a=r+(i-r>>1),o=e[a<<n];if(t===o)return a<<n;o>t?i=a:r=a+1}return~(i<<n)}var ra={},ia=[],aa=new mi(``),oa=new mi(``,-1),sa=new mi(``),ca=class{get(e,t=zi){if(t===zi){let e=Mi(``,-201);throw e.name=`ɵNotFound`,e}return t}};function la(...e){return{ɵproviders:ua(!0,e),ɵfromNgModule:!0}}function ua(e,...t){let n=[],r=new Set,i,a=e=>{n.push(e)};return Yi(t,e=>{let t=e;fa(t,a,[],r)&&(i||=[],i.push(t))}),i!==void 0&&da(i,a),n}function da(e,t){for(let n=0;n<e.length;n++){let{ngModule:r,providers:i}=e[n];pa(i,e=>{t(e,r)})}}function fa(e,t,n,r){if(e=ai(e),!e)return!1;let i=null,a=di(e),o=!a&&Si(e);if(!a&&!o){let t=e.ngModule;if(a=di(t),a)i=t;else return!1}else if(o&&!o.standalone)return!1;else i=e;let s=r.has(i);if(o){if(s)return!1;if(r.add(i),o.dependencies){let e=typeof o.dependencies==`function`?o.dependencies():o.dependencies;for(let i of e)fa(i,t,n,r)}}else if(a){if(a.imports!=null&&!s){r.add(i);let e;try{Yi(a.imports,i=>{fa(i,t,n,r)&&(e||=[],e.push(i))})}finally{}e!==void 0&&da(e,t)}if(!s){let e=Ji(i)||(()=>new i);t({provide:i,useFactory:e,deps:ia},i),t({provide:sa,useValue:i,multi:!0},i),t({provide:aa,useValue:()=>Ui(i),multi:!0},i)}let o=a.providers;if(o!=null&&!s){let n=e;pa(o,e=>{t(e,n)})}}else return!1;return i!==e&&e.providers!==void 0}function pa(e,t){for(let n of e)hi(n)&&(n=n.ɵproviders),Array.isArray(n)?pa(n,t):t(n)}var ma=ei({provide:String,useValue:ei});function ha(e){return typeof e==`object`&&!!e&&ma in e}function ga(e){return!!(e&&e.useExisting)}function _a(e){return!!(e&&e.useFactory)}function va(e){return typeof e==`function`}var ya=new mi(``),ba={},xa={},Sa=void 0;function Ca(){return Sa===void 0&&(Sa=new ca),Sa}var wa=class{},Ta=class extends wa{parent;source;scopes;records=new Map;_ngOnDestroyHooks=new Set;_onDestroyHooks=[];get destroyed(){return this._destroyed}_destroyed=!1;injectorDefTypes;constructor(e,t,n,r){super(),this.parent=t,this.source=n,this.scopes=r,Fa(e,e=>this.processProvider(e)),this.records.set(oa,ja(void 0,this)),r.has(`environment`)&&this.records.set(wa,ja(void 0,this));let i=this.records.get(ya);i!=null&&typeof i.value==`string`&&this.scopes.add(i.value),this.injectorDefTypes=new Set(this.get(sa,ia,{self:!0}))}retrieve(e,t){let n=Wi(t)||0;try{return this.get(e,zi,n)}catch(e){if(Xn(e))return e;throw e}}destroy(){Aa(this),this._destroyed=!0;let e=O(null);try{for(let e of this._ngOnDestroyHooks)e.ngOnDestroy();let e=this._onDestroyHooks;this._onDestroyHooks=[];for(let t of e)t()}finally{this.records.clear(),this._ngOnDestroyHooks.clear(),this.injectorDefTypes.clear(),O(e)}}onDestroy(e){return Aa(this),this._onDestroyHooks.push(e),()=>this.removeOnDestroy(e)}runInContext(e){Aa(this);let t=Jn(this),n=Ii(void 0);try{return e()}finally{Jn(t),Ii(n)}}get(e,t=zi,n){if(Aa(this),Object.hasOwn(e,xi))return e[xi](this);let r=Wi(n),i=Jn(this),a=Ii(void 0);try{if(!(r&4)){let t=this.records.get(e);if(t===void 0){let n=Pa(e)&&ci(e);t=n&&this.injectableDefInScope(n)?ja(Ea(e),ba):null,this.records.set(e,t)}if(t!=null)return this.hydrate(e,t,r)}let n=r&2?Ca():this.parent;return t=r&8&&t===zi?null:t,n.get(e,t)}catch(e){let t=Ni(e);throw t===-200||t===-201?new k(t,null):e}finally{Ii(a),Jn(i)}}resolveInjectorInitializers(){let e=O(null),t=Jn(this),n=Ii(void 0);try{let e=this.get(aa,ia,{self:!0});for(let t of e)t()}finally{Jn(t),Ii(n),O(e)}}toString(){return`R3Injector[...]`}processProvider(e){e=ai(e);let t=va(e)?e:ai(e&&e.provide),n=Oa(e);if(!va(e)&&e.multi===!0){let n=this.records.get(t);n||(n=ja(void 0,ba,!0),n.factory=()=>Ki(n.multi),this.records.set(t,n)),t=e,n.multi.push(e)}this.records.set(t,n)}hydrate(e,t,n){let r=O(null);try{if(t.value===xa)throw Ai(``);return t.value===ba&&(t.value=xa,t.value=t.factory(void 0,n)),typeof t.value==`object`&&t.value&&Na(t.value)&&this._ngOnDestroyHooks.add(t.value),t.value}finally{O(r)}}injectableDefInScope(e){if(!e.providedIn)return!1;let t=ai(e.providedIn);return typeof t==`string`?t===`any`||this.scopes.has(t):this.injectorDefTypes.has(t)}removeOnDestroy(e){let t=this._onDestroyHooks.indexOf(e);t!==-1&&this._onDestroyHooks.splice(t,1)}};function Ea(e){let t=ci(e),n=t===null?Ji(e):t.factory;if(n!==null)return n;if(e instanceof mi)throw new k(-204,!1);if(e instanceof Function)return Da(e);throw new k(-204,!1)}function Da(e){if(e.length>0)throw new k(-204,!1);let t=ui(e);return t===null?()=>new e:()=>t.factory(e)}function Oa(e){return ha(e)?ja(void 0,e.useValue):ja(ka(e),ba)}function ka(e,t,n){let r;if(va(e)){let t=ai(e);return Ji(t)||Ea(t)}if(ha(e))r=()=>ai(e.useValue);else if(_a(e))r=()=>e.useFactory(...Ki(e.deps||[]));else if(ga(e))r=(t,n)=>Ui(ai(e.useExisting),n!==void 0&&n&8?8:void 0);else{let t=ai(e&&(e.useClass||e.provide));if(Ma(e))r=()=>new t(...Ki(e.deps));else return Ji(t)||Ea(t)}return r}function Aa(e){if(e.destroyed)throw new k(-205,!1)}function ja(e,t,n=!1){return{factory:e,value:t,multi:n?[]:void 0}}function Ma(e){return!!e.deps}function Na(e){return typeof e==`object`&&!!e&&typeof e.ngOnDestroy==`function`}function Pa(e){return typeof e==`function`||typeof e==`object`&&e.ngMetadataName===`InjectionToken`}function Fa(e,t){for(let n of e)Array.isArray(n)?Fa(n,t):n&&hi(n)?Fa(n.ɵproviders,t):t(n)}function Ia(e,t){let n;e instanceof Ta?(Aa(e),n=e):n=new Vi(e);let r=Jn(n),i=Ii(void 0);try{return t()}finally{Jn(r),Ii(i)}}function La(){return Fi()!==void 0||qn()!=null}var Ra=1;function za(e){return Array.isArray(e)&&typeof e[Ra]==`object`}function Ba(e){return Array.isArray(e)&&e[Ra]===!0}function Va(e){return!!(e.flags&4)}function Ha(e){return e.componentOffset>-1}function Ua(e){return(e.flags&1)==1}function Wa(e){return!!e.template}function Ga(e){return!!(e[2]&512)}function Ka(e){return(e[2]&256)==256}var qa=`math`;function Ja(e){for(;Array.isArray(e);)e=e[0];return e}function Ya(e,t){return Ja(t[e])}function Xa(e,t){return Ja(t[e.index])}function Za(e,t){return e.data[t]}function Qa(e,t){return e[t]}function $a(e,t,n,r){n>=e.data.length&&(e.data[n]=null,e.blueprint[n]=null),t[n]=r}function eo(e,t){let n=t[e];return za(n)?n:n[0]}function to(e){return(e[2]&128)==128}function no(e,t){return t==null?null:e[t]}function ro(e){e[17]=0}function io(e){e[2]&1024||(e[2]|=1024,to(e)&&co(e))}function ao(e,t){for(;e>0;)t=t[14],e--;return t}function oo(e){return!!(e[2]&9216||e[24]?.dirty)}function so(e){e[10].changeDetectionScheduler?.notify(8),e[2]&64&&(e[2]|=1024),oo(e)&&co(e)}function co(e){e[10].changeDetectionScheduler?.notify(0);let t=fo(e);for(;t!==null&&!(t[2]&8192||(t[2]|=8192,!to(t)));)t=fo(t)}function lo(e,t){if(Ka(e))throw new k(911,!1);e[21]===null&&(e[21]=[]),e[21].push(t)}function uo(e,t){if(e[21]===null)return;let n=e[21].indexOf(t);n!==-1&&e[21].splice(n,1)}function fo(e){let t=e[3];return Ba(t)?t[3]:t}function po(e){return e[7]??=[]}function mo(e){return e.cleanup??=[]}var j={lFrame:qo(null),bindingsEnabled:!0,skipHydrationRootTNode:null},ho=!1;function go(){return j.lFrame.elementDepthCount}function _o(){j.lFrame.elementDepthCount++}function vo(){j.lFrame.elementDepthCount--}function yo(){return j.bindingsEnabled}function bo(){return j.skipHydrationRootTNode!==null}function xo(e){return j.skipHydrationRootTNode===e}function So(){j.skipHydrationRootTNode=null}function M(){return j.lFrame.lView}function Co(){return j.lFrame.tView}function N(e){return j.lFrame.contextLView=e,e[8]}function P(e){return j.lFrame.contextLView=null,e}function wo(){let e=To();for(;e!==null&&e.type===64;)e=e.parent;return e}function To(){return j.lFrame.currentTNode}function Eo(){let e=j.lFrame,t=e.currentTNode;return e.isParent?t:t.parent}function Do(e,t){let n=j.lFrame;n.currentTNode=e,n.isParent=t}function Oo(){return j.lFrame.isParent}function ko(){j.lFrame.isParent=!1}function Ao(){return ho}function jo(e){let t=ho;return ho=e,t}function Mo(){let e=j.lFrame,t=e.bindingRootIndex;return t===-1&&(t=e.bindingRootIndex=e.tView.bindingStartIndex),t}function No(){return j.lFrame.bindingIndex}function Po(e){return j.lFrame.bindingIndex=e}function Fo(){return j.lFrame.bindingIndex++}function Io(e){let t=j.lFrame,n=t.bindingIndex;return t.bindingIndex+=e,n}function Lo(){return j.lFrame.inI18n}function Ro(e,t){let n=j.lFrame;n.bindingIndex=n.bindingRootIndex=e,Bo(t)}function zo(){return j.lFrame.currentDirectiveIndex}function Bo(e){j.lFrame.currentDirectiveIndex=e}function Vo(e){let t=j.lFrame.currentDirectiveIndex;return t===-1?null:e[t]}function Ho(e){j.lFrame.currentQueryIndex=e}function Uo(e){let t=e[1];return t.type===2?t.declTNode:t.type===1?e[5]:null}function Wo(e,t,n){if(n&4){let r=t,i=e;for(;r=r.parent,r===null&&!(n&1)&&(r=Uo(i),!(r===null||(i=i[14],r.type&10))););if(r===null)return!1;t=r,e=i}let r=j.lFrame=Ko();return r.currentTNode=t,r.lView=e,!0}function Go(e){let t=Ko(),n=e[1];j.lFrame=t,t.currentTNode=n.firstChild,t.lView=e,t.tView=n,t.contextLView=e,t.bindingIndex=n.bindingStartIndex,t.inI18n=!1}function Ko(){let e=j.lFrame,t=e===null?null:e.child;return t===null?qo(e):t}function qo(e){let t={currentTNode:null,isParent:!0,lView:null,tView:null,selectedIndex:-1,contextLView:null,elementDepthCount:0,currentNamespace:null,currentDirectiveIndex:-1,bindingRootIndex:-1,bindingIndex:-1,currentQueryIndex:0,parent:e,child:null,inI18n:!1};return e!==null&&(e.child=t),t}function Jo(){let e=j.lFrame;return j.lFrame=e.parent,e.currentTNode=null,e.lView=null,e}var Yo=Jo;function Xo(){let e=Jo();e.isParent=!0,e.tView=null,e.selectedIndex=-1,e.contextLView=null,e.elementDepthCount=0,e.currentDirectiveIndex=-1,e.currentNamespace=null,e.bindingRootIndex=-1,e.bindingIndex=-1,e.currentQueryIndex=0}function Zo(e){return(j.lFrame.contextLView=ao(e,j.lFrame.contextLView))[8]}function Qo(){return j.lFrame.selectedIndex}function $o(e){j.lFrame.selectedIndex=e}function es(){let e=j.lFrame;return Za(e.tView,e.selectedIndex)}function ts(){j.lFrame.currentNamespace=`svg`}function ns(){rs()}function rs(){j.lFrame.currentNamespace=null}function is(){return j.lFrame.currentNamespace}var as=!0;function os(){return as}function ss(e){as=e}function cs(e,t=null,n=null,r){let i=ls(e,t,n,r);return i.resolveInjectorInitializers(),i}function ls(e,t=null,n=null,r,i=new Set){return new Ta([n||ia,la(e)],t||Ca(),null,i)}var us=class e{static THROW_IF_NOT_FOUND=zi;static NULL=new ca;static create(e,t){if(Array.isArray(e))return cs({name:``},t,e,``);{let t=e.name??``;return cs({name:t},e.parent,e.providers,t)}}static ɵprov=si({token:e,providedIn:`any`,factory:()=>Ui(oa)});static __NG_ELEMENT_ID__=-1},ds=new mi(``),fs=class{static __NG_ELEMENT_ID__=ms;static __NG_ENV_ID__=e=>e},ps=class extends fs{_lView;constructor(e){super(),this._lView=e}get destroyed(){return Ka(this._lView)}onDestroy(e){let t=this._lView;return lo(t,e),()=>uo(t,e)}};function ms(){return new ps(M())}var hs=new mi(``),gs=(()=>{class e{taskId=0;pendingTasks=new Set;destroyed=!1;pendingTask=new Yr(!1);debugTaskTracker=A(hs,{optional:!0});get hasPendingTasks(){return!this.destroyed&&this.pendingTask.value}get hasPendingTasksObservable(){return this.destroyed?new Rr(e=>{e.next(!1),e.complete()}):this.pendingTask}add(){!this.hasPendingTasks&&!this.destroyed&&this.pendingTask.next(!0);let e=this.taskId++;return this.pendingTasks.add(e),this.debugTaskTracker?.add(e),e}has(e){return this.pendingTasks.has(e)}remove(e){this.pendingTasks.delete(e),this.debugTaskTracker?.remove(e),this.pendingTasks.size===0&&this.hasPendingTasks&&this.pendingTask.next(!1)}ngOnDestroy(){this.pendingTasks.clear(),this.hasPendingTasks&&this.pendingTask.next(!1),this.destroyed=!0,this.pendingTask.unsubscribe()}static ɵprov=si({token:e,providedIn:`root`,factory:()=>new e})}return e})(),_s=class extends qr{__isAsync;destroyRef=void 0;pendingTasks=void 0;constructor(e=!1){super(),this.__isAsync=e,La()&&(this.destroyRef=A(fs,{optional:!0})??void 0,this.pendingTasks=A(gs,{optional:!0})??void 0)}emit(e){let t=O(null);try{super.next(e)}finally{O(t)}}subscribe(e,t,n){let r=e,i=t||(()=>null),a=n;if(e&&typeof e==`object`){let t=e;r=t.next?.bind(t),i=t.error?.bind(t),a=t.complete?.bind(t)}this.__isAsync&&(i=this.wrapInTimeout(i),r&&=this.wrapInTimeout(r),a&&=this.wrapInTimeout(a));let o=super.subscribe({next:r,error:i,complete:a});return e instanceof dr&&e.add(o),o}wrapInTimeout(e){return t=>{let n=this.pendingTasks?.add();setTimeout(()=>{try{e(t)}finally{n!==void 0&&this.pendingTasks?.remove(n)}})}}};function vs(...e){}function ys(e){let t,n;function r(){e=vs;try{n!==void 0&&typeof cancelAnimationFrame==`function`&&cancelAnimationFrame(n),t!==void 0&&clearTimeout(t)}catch{}}return t=setTimeout(()=>{e(),r()}),typeof requestAnimationFrame==`function`&&(n=requestAnimationFrame(()=>{e(),r()})),()=>r()}function bs(e){return queueMicrotask(()=>e()),()=>{e=vs}}var xs=`isAngularZone`,Ss=`isAngularZone_ID`,Cs=0,ws=class e{hasPendingMacrotasks=!1;hasPendingMicrotasks=!1;isStable=!0;onUnstable=new _s(!1);onMicrotaskEmpty=new _s(!1);onStable=new _s(!1);onError=new _s(!1);constructor(e){let{enableLongStackTrace:t=!1,shouldCoalesceEventChangeDetection:n=!1,shouldCoalesceRunChangeDetection:r=!1,scheduleInRootZone:i=!1}=e;if(typeof Zone>`u`)throw new k(908,!1);Zone.assertZonePatched();let a=this;a._nesting=0,a._outer=a._inner=Zone.current,Zone.TaskTrackingZoneSpec&&(a._inner=a._inner.fork(new Zone.TaskTrackingZoneSpec)),t&&Zone.longStackTraceZoneSpec&&(a._inner=a._inner.fork(Zone.longStackTraceZoneSpec)),a.shouldCoalesceEventChangeDetection=!r&&n,a.shouldCoalesceRunChangeDetection=r,a.callbackScheduled=!1,a.scheduleInRootZone=i,Os(a)}static isInAngularZone(){return typeof Zone<`u`&&Zone.current.get(xs)===!0}static assertInAngularZone(){if(!e.isInAngularZone())throw new k(909,!1)}static assertNotInAngularZone(){if(e.isInAngularZone())throw new k(909,!1)}run(e,t,n){return this._inner.run(e,t,n)}runTask(e,t,n,r){let i=this._inner,a=i.scheduleEventTask(`NgZoneEvent: `+r,e,Ts,vs,vs);try{return i.runTask(a,t,n)}finally{i.cancelTask(a)}}runGuarded(e,t,n){return this._inner.runGuarded(e,t,n)}runOutsideAngular(e){return this._outer.run(e)}},Ts={};function Es(e){if(e._nesting==0&&!e.hasPendingMicrotasks&&!e.isStable)try{e._nesting++,e.onMicrotaskEmpty.emit(null)}finally{if(e._nesting--,!e.hasPendingMicrotasks)try{e.runOutsideAngular(()=>e.onStable.emit(null))}finally{e.isStable=!0}}}function Ds(e){if(e.isCheckStableRunning||e.callbackScheduled)return;e.callbackScheduled=!0;function t(){ys(()=>{e.callbackScheduled=!1,ks(e),e.isCheckStableRunning=!0,Es(e),e.isCheckStableRunning=!1})}e.scheduleInRootZone?Zone.root.run(()=>{t()}):e._outer.run(()=>{t()}),ks(e)}function Os(e){let t=()=>{Ds(e)},n=Cs++;e._inner=e._inner.fork({name:`angular`,properties:{[xs]:!0,[Ss]:n,[Ss+n]:!0},onInvokeTask:(n,r,i,a,o,s)=>{if(Ns(s))return n.invokeTask(i,a,o,s);try{return As(e),n.invokeTask(i,a,o,s)}finally{(e.shouldCoalesceEventChangeDetection&&a.type===`eventTask`||e.shouldCoalesceRunChangeDetection)&&t(),js(e)}},onInvoke:(n,r,i,a,o,s,c)=>{try{return As(e),n.invoke(i,a,o,s,c)}finally{e.shouldCoalesceRunChangeDetection&&!e.callbackScheduled&&!Ps(s)&&t(),js(e)}},onHasTask:(t,n,r,i)=>{t.hasTask(r,i),n===r&&(i.change==`microTask`?(e._hasPendingMicrotasks=i.microTask,ks(e),Es(e)):i.change==`macroTask`&&(e.hasPendingMacrotasks=i.macroTask))},onHandleError:(t,n,r,i)=>(t.handleError(r,i),e.runOutsideAngular(()=>e.onError.emit(i)),!1)})}function ks(e){e.hasPendingMicrotasks=!!(e._hasPendingMicrotasks||(e.shouldCoalesceEventChangeDetection||e.shouldCoalesceRunChangeDetection)&&e.callbackScheduled===!0)}function As(e){e._nesting++,e.isStable&&(e.isStable=!1,e.onUnstable.emit(null))}function js(e){e._nesting--,Es(e)}var Ms=class{hasPendingMicrotasks=!1;hasPendingMacrotasks=!1;isStable=!0;onUnstable=new _s;onMicrotaskEmpty=new _s;onStable=new _s;onError=new _s;run(e,t,n){return e.apply(t,n)}runGuarded(e,t,n){return e.apply(t,n)}runOutsideAngular(e){return e()}runTask(e,t,n,r){return e.apply(t,n)}};function Ns(e){return Fs(e,`__ignore_ng_zone__`)}function Ps(e){return Fs(e,`__scheduler_tick__`)}function Fs(e,t){return!Array.isArray(e)||e.length!==1?!1:e[0]?.data?.[t]===!0}var Is=class{_console=console;handleError(e){this._console.error(`ERROR`,e)}},Ls=new mi(``,{factory:()=>{let e=A(ws),t=A(wa),n;return r=>{e.runOutsideAngular(()=>{t.destroyed&&!n?setTimeout(()=>{throw r}):(n??=t.get(Is),n.handleError(r))})}}}),Rs={provide:aa,useValue:()=>{A(Is,{optional:!0})},multi:!0};function F(e,t){let[n,r,i]=Rn(e,t?.equal),a=n;return a[sn],a.set=r,a.update=i,a.asReadonly=zs.bind(a),a}function zs(){let e=this[sn];if(e.readonlyFn===void 0){let t=()=>this();t[sn]=e,e.readonlyFn=t}return e.readonlyFn}var Bs=new mi(``,{factory:()=>Vs}),Vs=`ng`,Hs=new mi(``),Us=new mi(``,{providedIn:`platform`,factory:()=>`unknown`}),Ws=new mi(``,{factory:()=>A(ds).body?.querySelector(`[ngCspNonce]`)?.getAttribute(`ngCspNonce`)||null}),Gs=(()=>{class e{view;node;constructor(e,t){this.view=e,this.node=t}static __NG_ELEMENT_ID__=Ks}return e})();function Ks(){return new Gs(M(),wo())}var qs=class{},Js=new mi(``,{factory:()=>!0}),Ys=new mi(``),Xs=(()=>{class e{static ɵprov=si({token:e,providedIn:`root`,factory:()=>new Zs})}return e})(),Zs=class{dirtyEffectCount=0;queues=new Map;add(e){this.enqueue(e),this.schedule(e)}schedule(e){e.dirty&&this.dirtyEffectCount++}remove(e){let t=e.zone,n=this.queues.get(t);n.has(e)&&(n.delete(e),e.dirty&&this.dirtyEffectCount--)}enqueue(e){let t=e.zone;this.queues.has(t)||this.queues.set(t,new Set);let n=this.queues.get(t);n.has(e)||n.add(e)}flush(){for(;this.dirtyEffectCount>0;){let e=!1;for(let[t,n]of this.queues)e||=t===null?this.flushQueue(n):t.run(()=>this.flushQueue(n));e||(this.dirtyEffectCount=0)}}flushQueue(e){let t=!1;for(let n of e)n.dirty&&(this.dirtyEffectCount--,t=!0,n.run());return t}},Qs=class{[sn];constructor(e){this[sn]=e}destroy(){this[sn].destroy()}};function $s(e,t){let n=t?.injector??A(us),r=t?.manualCleanup===!0?null:n.get(fs),i,a=n.get(Gs,null,{optional:!0}),o=n.get(qs);return a===null?i=ic(e,n.get(Xs),o):(i=rc(a.view,o,e),r instanceof ps&&r._lView===a.view&&(r=null)),i.injector=n,r!==null&&(i.onDestroyFns=[r.onDestroy(()=>i.destroy())]),new Qs(i)}var ec={...Wn,cleanupFns:void 0,zone:null,onDestroyFns:null,run(){let e=jo(!1);try{Gn(this)}finally{jo(e)}},cleanup(){if(!this.cleanupFns?.length)return;let e=O(null);try{for(;this.cleanupFns.length;)this.cleanupFns.pop()()}finally{this.cleanupFns=[],O(e)}}},tc={...ec,consumerMarkedDirty(){this.scheduler.schedule(this),this.notifier.notify(12)},destroy(){if(Sn(this),this.onDestroyFns!==null)for(let e of this.onDestroyFns)e();this.cleanup(),this.scheduler.remove(this)}},nc={...ec,consumerMarkedDirty(){this.view[2]|=8192,co(this.view),this.notifier.notify(13)},destroy(){if(Sn(this),this.onDestroyFns!==null)for(let e of this.onDestroyFns)e();this.cleanup(),this.view[23]?.delete(this)}};function rc(e,t,n){let r=Object.create(nc);return r.view=e,r.zone=typeof Zone<`u`?Zone.current:null,r.notifier=t,r.fn=ac(r,n),e[23]??=new Set,e[23].add(r),r.consumerMarkedDirty(r),r}function ic(e,t,n){let r=Object.create(tc);return r.fn=ac(r,e),r.scheduler=t,r.notifier=n,r.zone=typeof Zone<`u`?Zone.current:null,r.scheduler.add(r),r.notifier.notify(12),r}function ac(e,t){return()=>{t(t=>(e.cleanupFns??=[]).push(t))}}var oc=(()=>{class e{internalPendingTasks=A(gs);scheduler=A(qs);errorHandler=A(Ls);add(){let e=this.internalPendingTasks.add();return()=>{this.internalPendingTasks.has(e)&&(this.scheduler.notify(11),this.internalPendingTasks.remove(e))}}run(e){let t=this.add();try{e().catch(this.errorHandler).finally(t)}catch(e){this.errorHandler(e),t()}}static ɵprov=si({token:e,providedIn:`root`,factory:()=>new e})}return e})(),sc=Symbol(`InputSignalNode#UNSET`),cc={...Hn,transformFn:void 0,applyValueToInputSignal(e,t){Bn(e,t)}};function lc(e){return{toString:e}.toString()}var uc=(function(e){return e[e.TemplateCreateStart=0]=`TemplateCreateStart`,e[e.TemplateCreateEnd=1]=`TemplateCreateEnd`,e[e.TemplateUpdateStart=2]=`TemplateUpdateStart`,e[e.TemplateUpdateEnd=3]=`TemplateUpdateEnd`,e[e.LifecycleHookStart=4]=`LifecycleHookStart`,e[e.LifecycleHookEnd=5]=`LifecycleHookEnd`,e[e.OutputStart=6]=`OutputStart`,e[e.OutputEnd=7]=`OutputEnd`,e[e.BootstrapApplicationStart=8]=`BootstrapApplicationStart`,e[e.BootstrapApplicationEnd=9]=`BootstrapApplicationEnd`,e[e.BootstrapComponentStart=10]=`BootstrapComponentStart`,e[e.BootstrapComponentEnd=11]=`BootstrapComponentEnd`,e[e.ChangeDetectionStart=12]=`ChangeDetectionStart`,e[e.ChangeDetectionEnd=13]=`ChangeDetectionEnd`,e[e.ChangeDetectionSyncStart=14]=`ChangeDetectionSyncStart`,e[e.ChangeDetectionSyncEnd=15]=`ChangeDetectionSyncEnd`,e[e.AfterRenderHooksStart=16]=`AfterRenderHooksStart`,e[e.AfterRenderHooksEnd=17]=`AfterRenderHooksEnd`,e[e.ComponentStart=18]=`ComponentStart`,e[e.ComponentEnd=19]=`ComponentEnd`,e[e.DeferBlockStateStart=20]=`DeferBlockStateStart`,e[e.DeferBlockStateEnd=21]=`DeferBlockStateEnd`,e[e.DynamicComponentStart=22]=`DynamicComponentStart`,e[e.DynamicComponentEnd=23]=`DynamicComponentEnd`,e[e.HostBindingsUpdateStart=24]=`HostBindingsUpdateStart`,e[e.HostBindingsUpdateEnd=25]=`HostBindingsUpdateEnd`,e})(uc||{});function dc(e,t,n,r){t===null?e[n]=r:t.applyValueToInputSignal(t,r)}var fc=null;function pc(){return fc}var mc=[],hc=function(e,t=null,n){for(let r=0;r<mc.length;r++){let i=mc[r];i(e,t,n)}};function gc(e,t,n){let{ngOnChanges:r,ngOnInit:i,ngDoCheck:a}=t.type.prototype;if(r){let r=pc()(t);(n.preOrderHooks??=[]).push(e,r),(n.preOrderCheckHooks??=[]).push(e,r)}i&&(n.preOrderHooks??=[]).push(0-e,i),a&&((n.preOrderHooks??=[]).push(e,a),(n.preOrderCheckHooks??=[]).push(e,a))}function _c(e,t){for(let n=t.directiveStart,r=t.directiveEnd;n<r;n++){let{ngAfterContentInit:t,ngAfterContentChecked:r,ngAfterViewInit:i,ngAfterViewChecked:a,ngOnDestroy:o}=e.data[n].type.prototype;t&&(e.contentHooks??=[]).push(-n,t),r&&((e.contentHooks??=[]).push(n,r),(e.contentCheckHooks??=[]).push(n,r)),i&&(e.viewHooks??=[]).push(-n,i),a&&((e.viewHooks??=[]).push(n,a),(e.viewCheckHooks??=[]).push(n,a)),o!=null&&(e.destroyHooks??=[]).push(n,o)}}function vc(e,t,n){xc(e,t,3,n)}function yc(e,t,n,r){(e[2]&3)===n&&xc(e,t,n,r)}function bc(e,t){let n=e[2];(n&3)===t&&(n&=16383,n+=1,e[2]=n)}function xc(e,t,n,r){let i=r===void 0?0:e[17]&65535,a=r??-1,o=t.length-1,s=0;for(let c=i;c<o;c++)if(typeof t[c+1]==`number`){if(s=t[c],r!=null&&s>=r)break}else t[c]<0&&(e[17]+=65536),(s<a||a==-1)&&(Cc(e,n,t,c),e[17]=(e[17]&4294901760)+c+2),c++}function Sc(e,t){hc(uc.LifecycleHookStart,e,t);let n=O(null);try{t.call(e)}finally{O(n),hc(uc.LifecycleHookEnd,e,t)}}function Cc(e,t,n,r){let i=n[r]<0,a=n[r+1],o=e[i?-n[r]:n[r]];i?e[2]>>14<e[17]>>16&&(e[2]&3)===t&&(e[2]+=16384,Sc(o,a)):Sc(o,a)}var wc=-1,Tc=class{factory;name;injectImpl;resolving=!1;canSeeViewProviders;multi;componentProviders;index;providerFactory;constructor(e,t,n,r){this.factory=e,this.name=r,this.canSeeViewProviders=t,this.injectImpl=n}};function Ec(e){return!!(e.flags&8)}function Dc(e){return!!(e.flags&16)}function Oc(e,t,n){let r=0;for(;r<n.length;){let i=n[r];if(typeof i==`number`){if(i!==0)break;r++;let a=n[r++],o=n[r++],s=n[r++];e.setAttribute(t,o,s,a)}else{let a=i,o=n[++r];Ac(a)?e.setProperty(t,a,o):e.setAttribute(t,a,o),r++}}return r}function kc(e){return e===3||e===4||e===6}function Ac(e){return e.charCodeAt(0)===64}function jc(e,t){if(t!==null&&t.length!==0){if(e===null||e.length===0)e=t.slice();else{let n=-1;for(let r=0;r<t.length;r++){let i=t[r];typeof i==`number`?n=i:n===0||(n===-1||n===2?Mc(e,n,i,null,t[++r]):Mc(e,n,i,null,null))}}}return e}function Mc(e,t,n,r,i){let a=0,o=e.length;if(t===-1)o=-1;else for(;a<e.length;){let n=e[a++];if(typeof n==`number`){if(n===t){o=-1;break}if(n>t){o=a-1;break}}}for(;a<e.length;){let t=e[a];if(typeof t==`number`)break;if(t===n){i!==null&&(e[a+1]=i);return}a++,i!==null&&a++}o!==-1&&(e.splice(o,0,t),a=o+1),e.splice(a++,0,n),i!==null&&e.splice(a++,0,i)}function Nc(e){return e!==wc}function Pc(e){return e&32767}function Fc(e){return e>>16}function Ic(e,t){let n=Fc(e),r=t;for(;n>0;)r=r[14],n--;return r}var Lc=!0;function Rc(e){let t=Lc;return Lc=e,t}var zc=255,Bc=5,Vc=0,Hc={};function Uc(e,t,n){let r;typeof n==`string`?r=n.charCodeAt(0)||0:Object.hasOwn(n,bi)&&(r=n[bi]),r??=n[bi]=Vc++;let i=r&zc,a=1<<i;t.data[e+(i>>Bc)]|=a}function Wc(e,t){let n=Kc(e,t);if(n!==-1)return n;let r=t[1];r.firstCreatePass&&(e.injectorIndex=t.length,Gc(r.data,e),Gc(t,null),Gc(r.blueprint,null));let i=qc(e,t),a=e.injectorIndex;if(Nc(i)){let e=Pc(i),n=Ic(i,t),r=n[1].data;for(let i=0;i<8;i++)t[a+i]=n[e+i]|r[e+i]}return t[a+8]=i,a}function Gc(e,t){e.push(0,0,0,0,0,0,0,0,t)}function Kc(e,t){return e.injectorIndex===-1||e.parent&&e.parent.injectorIndex===e.injectorIndex||t[e.injectorIndex+8]===null?-1:e.injectorIndex}function qc(e,t){if(e.parent&&e.parent.injectorIndex!==-1)return e.parent.injectorIndex;let n=0,r=null,i=t;for(;i!==null;){if(r=cl(i),r===null)return wc;if(n++,i=i[14],r.injectorIndex!==-1)return r.injectorIndex|n<<16}return wc}function Jc(e,t,n){Uc(e,t,n)}function Yc(e,t,n){if(n&8||e!==void 0)return e;ji(t,`NodeInjector`)}function Xc(e,t,n,r){if(n&8&&r===void 0&&(r=null),!(n&3)){let i=e[9],a=Ii(void 0);try{return i?i.get(t,r,n&8):Li(t,r,n&8)}finally{Ii(a)}}return Yc(r,t,n)}function Zc(e,t,n,r=0,i){if(e!==null){if(t[2]&2048&&!(r&2)){let i=sl(e,t,n,r,Hc);if(i!==Hc)return i}let i=Qc(e,t,n,r,Hc);if(i!==Hc)return i}return Xc(t,n,r,i)}function Qc(e,t,n,r,i){let a=nl(n);if(typeof a==`function`){if(!Wo(t,e,r))return r&1?Yc(i,n,r):Xc(t,n,r,i);try{let e;if(e=a(r),e==null&&!(r&8))ji(n);else return e}finally{Yo()}}else if(typeof a==`number`){let i=null,o=Kc(e,t),s=wc,c=r&1?t[15][5]:null;for((o===-1||r&4)&&(s=o===-1?qc(e,t):t[o+8],s===wc||!il(r,!1)?o=-1:(i=t[1],o=Pc(s),t=Ic(s,t)));o!==-1;){let e=t[1];if(rl(a,o,e.data)){let e=$c(o,t,n,i,r,c);if(e!==Hc)return e}s=t[o+8],s!==wc&&il(r,t[1].data[o+8]===c)&&rl(a,o,t)?(i=e,o=Pc(s),t=Ic(s,t)):o=-1}}return i}function $c(e,t,n,r,i,a){let o=t[1],s=o.data[e+8],c=el(s,o,n,r==null?Ha(s)&&Lc:r!=o&&!!(s.type&3),i&1&&a===s);return c===null?Hc:tl(t,o,c,s,i)}function el(e,t,n,r,i){let a=e.providerIndexes,o=t.data,s=a&1048575,c=e.directiveStart,l=e.directiveEnd,u=a>>20,d=r?s:s+u,f=i?s+u:l;for(let e=d;e<f;e++){let t=o[e];if(e<c&&n===t||e>=c&&t.type===n)return e}if(i){let e=o[c];if(e&&Wa(e)&&e.type===n)return c}return null}function tl(e,t,n,r,i){let a=e[n],o=t.data;if(a instanceof Tc){let s=a;if(s.resolving)throw Ai(``);let c=Rc(s.canSeeViewProviders);s.resolving=!0,o[n].type||o[n];let l=s.injectImpl?Ii(s.injectImpl):null;Wo(e,r,0);try{a=e[n]=s.factory(void 0,i,o,e,r),t.firstCreatePass&&n>=r.directiveStart&&gc(n,o[n],t)}finally{l!==null&&Ii(l),Rc(c),s.resolving=!1,Yo()}}return a}function nl(e){if(typeof e==`string`)return e.charCodeAt(0)||0;let t=Object.hasOwn(e,bi)?e[bi]:void 0;return typeof t==`number`?t>=0?t&zc:ol:t}function rl(e,t,n){let r=1<<e;return!!(n[t+(e>>Bc)]&r)}function il(e,t){return!(e&2)&&!(e&1&&t)}var al=class{_tNode;_lView;constructor(e,t){this._tNode=e,this._lView=t}get(e,t,n){return Zc(this._tNode,this._lView,e,Wi(n),t)}};function ol(){return new al(wo(),M())}function sl(e,t,n,r,i){let a=e,o=t;for(;a!==null&&o!==null&&o[2]&2048&&!Ga(o);){let e=Qc(a,o,n,r|2,Hc);if(e!==Hc)return e;r&=-5;let t=a.parent;if(!t){let e=o[20];if(e){let t=e.get(n,Hc,r);if(t!==Hc)return t}t=cl(o),o=o[14]}a=t}return i}function cl(e){let t=e[1],n=t.type;return n===2?t.declTNode:n===1?e[5]:null}var ll=()=>(typeof requestIdleCallback<`u`?requestIdleCallback:e=>setTimeout(e)).bind(globalThis),ul=()=>(typeof requestIdleCallback<`u`?cancelIdleCallback:clearTimeout).bind(globalThis),dl=new mi(``,{factory:()=>new fl}),fl=class{requestIdleCallback=ll();cancelIdleCallback=ul();requestOnIdle(e,t){return this.requestIdleCallback(e,t)}cancelOnIdle(e){return this.cancelIdleCallback(e)}};function pl(e){return{token:e.token,providedIn:e.autoProvided===!1?null:`root`,factory:e.factory,value:void 0}}function ml(){return hl(wo(),M())}function hl(e,t){return new gl(Xa(e,t))}var gl=(()=>{class e{nativeElement;constructor(e){this.nativeElement=e}static __NG_ELEMENT_ID__=ml}return e})();function _l(e){return(e.flags&128)==128}var vl=(function(e){return e[e.OnPush=0]=`OnPush`,e[e.Eager=1]=`Eager`,e[e.Default=1]=`Default`,e})(vl||{}),yl=new Map,bl=0;function xl(){return bl++}function Sl(e){yl.set(e[19],e)}function Cl(e){yl.delete(e[19])}var wl=`__ngContext__`;function Tl(e,t){za(t)?(e[wl]=t[19],Sl(t)):e[wl]=t}function El(e){return Ol(e[12])}function Dl(e){return Ol(e[4])}function Ol(e){for(;e!==null&&!Ba(e);)e=e[4];return e}var kl=void 0;function Al(e){kl=e}function jl(){if(kl!==void 0)return kl;if(typeof document<`u`)return document;throw new k(210,!1)}var Ml=!1,Nl=new mi(``,{factory:()=>Ml}),Pl=new mi(``),Fl=new WeakMap;function Il(e,t){if(typeof e!=`object`||!e)return;let n=Fl.get(e);n||(n=new WeakSet,Fl.set(e,n)),n.add(t)}var Ll=new mi(``);function Rl(e){return(e.flags&32)==32}var zl=()=>null;function Bl(e,t,n=!1){return zl(e,t,n)}function Vl(e){return e.get(Pl,!1,{optional:!0})}function Hl(e,t){let n=e.contentQueries;if(n!==null){let r=O(null);try{for(let r=0;r<n.length;r+=2){let i=n[r],a=n[r+1];if(a!==-1){let n=e.data[a];Ho(i),n.contentQueries(2,t[a],a)}}}finally{O(r)}}}function Ul(e,t,n){Ho(0);let r=O(null);try{t(e,n)}finally{O(r)}}function Wl(e,t,n){if(Va(t)){let r=O(null);try{let r=t.directiveStart,i=t.directiveEnd;for(let t=r;t<i;t++){let r=e.data[t];if(r.contentQueries){let e=n[t];r.contentQueries(1,e,t)}}}finally{O(r)}}}var Gl=(function(e){return e[e.Emulated=0]=`Emulated`,e[e.None=2]=`None`,e[e.ShadowDom=3]=`ShadowDom`,e[e.ExperimentalIsolatedShadowDom=4]=`ExperimentalIsolatedShadowDom`,e})(Gl||{}),Kl=class{changingThisBreaksApplicationSecurity;constructor(e){this.changingThisBreaksApplicationSecurity=e}toString(){return`SafeValue must use [property]=binding: ${this.changingThisBreaksApplicationSecurity} (see ${Zr})`}};function ql(e){return e instanceof Kl?e.changingThisBreaksApplicationSecurity:e}var Jl=/^>|^->|<!--|-->|--!>|<!-$/g,Yl=/(<|>)/g,Xl=`​$1​`;function Zl(e){return e.replace(Jl,e=>e.replace(Yl,Xl))}function Ql(e,t){return e.createText(t)}function $l(e,t,n){e.setValue(t,n)}function eu(e,t){return e.createComment(Zl(t))}function tu(e,t,n){return e.createElement(t,n)}function nu(e,t,n,r,i){e.insertBefore(t,n,r,i)}function ru(e,t,n){e.appendChild(t,n)}function iu(e,t,n,r,i){r===null?ru(e,t,n):nu(e,t,n,r,i)}function au(e,t,n,r){e.removeChild(null,t,n,r)}function ou(e,t,n){e.setAttribute(t,`style`,n)}function su(e,t,n){n===``?e.removeAttribute(t,`class`):e.setAttribute(t,`class`,n)}function cu(e,t,n){let{mergedAttrs:r,classes:i,styles:a}=n;r!==null&&Oc(e,t,r),i!==null&&su(e,t,i),a!==null&&ou(e,t,a)}function lu(e,t,n){let r=e.length;for(;;){let i=e.indexOf(t,n);if(i===-1)return i;if(i===0||e.charCodeAt(i-1)<=32){let n=t.length;if(i+n===r||e.charCodeAt(i+n)<=32)return i}n=i+1}}var uu=`ng-template`;function du(e,t,n,r){let i=0;if(r){for(;i<t.length&&typeof t[i]==`string`;i+=2)if(t[i]===`class`&&lu(t[i+1].toLowerCase(),n,0)!==-1)return!0}else if(fu(e))return!1;if(i=t.indexOf(1,i),i>-1){let e;for(;++i<t.length&&typeof(e=t[i])==`string`;)if(e.toLowerCase()===n)return!0}return!1}function fu(e){return e.type===4&&e.value!==uu}function pu(e,t,n){return t===(e.type===4&&!n?uu:e.value)}function mu(e,t,n){let r=4,i=e.attrs,a=i===null?0:vu(i),o=!1;for(let s=0;s<t.length;s++){let c=t[s];if(typeof c==`number`){if(!o&&!hu(r)&&!hu(c))return!1;if(o&&hu(c))continue;o=!1,r=c|r&1;continue}if(!o){if(r&4){if(r=2|r&1,c!==``&&!pu(e,c,n)||c===``&&t.length===1){if(hu(r))return!1;o=!0}}else if(r&8){if(i===null||!du(e,i,c,n)){if(hu(r))return!1;o=!0}}else{let l=t[++s],u=gu(c,i,fu(e),n);if(u===-1){if(hu(r))return!1;o=!0;continue}if(l!==``){let e;if(e=u>a?``:i[u+1].toLowerCase(),r&2&&l!==e){if(hu(r))return!1;o=!0}}}}}return hu(r)||o}function hu(e){return!(e&1)}function gu(e,t,n,r){if(t===null)return-1;let i=0;if(r||!n){let n=!1;for(;i<t.length;){let r=t[i];if(r===e)return i;if(r===3||r===6)n=!0;else if(r===1||r===2){let e=t[++i];for(;typeof e==`string`;)e=t[++i];continue}else if(r===4)break;else if(r===0){i+=4;continue}i+=n?1:2}return-1}return yu(t,e)}function _u(e,t,n=!1){for(let r=0;r<t.length;r++)if(mu(e,t[r],n))return!0;return!1}function vu(e){for(let t=0;t<e.length;t++){let n=e[t];if(kc(n))return t}return e.length}function yu(e,t){let n=e.indexOf(4);if(n>-1)for(n++;n<e.length;){let r=e[n];if(typeof r==`number`)return-1;if(r===t)return n;n++}return-1}function bu(e,t){return e?`:not(`+t.trim()+`)`:t}function xu(e){let t=e[0],n=1,r=2,i=``,a=!1;for(;n<e.length;){let o=e[n];if(typeof o==`string`){if(r&2){let t=e[++n];i+=`[`+o+(t.length>0?`="`+t+`"`:``)+`]`}else r&8?i+=`.`+o:r&4&&(i+=` `+o)}else i!==``&&!hu(o)&&(t+=bu(a,i),i=``),r=o,a||=!hu(r);n++}return i!==``&&(t+=bu(a,i)),t}function Su(e){return e.map(xu).join(`,`)}function Cu(e){let t=[],n=[],r=1,i=2;for(;r<e.length;){let a=e[r];if(typeof a==`string`)i===2?a!==``&&t.push(a,e[++r]):i===8&&n.push(a);else{if(!hu(i))break;i=a}r++}return n.length&&t.push(1,...n),t}var wu={},Tu=(function(e){return e[e.Important=1]=`Important`,e[e.DashCase=2]=`DashCase`,e})(Tu||{}),Eu;function Du(e,t){return Eu(e,t)}var Ou=new Set;typeof document<`u`&&document?.documentElement?.getAnimations;var ku=new WeakMap;function Au(e){return e?e[14]??e:null}var ju=new WeakSet;function Mu(e,t,n){let r=ku.get(e);if(!r||r.length===0)return;let i=t.parentNode,a=t.previousSibling,o=Au(n);for(let e=r.length-1;e>=0;e--){let{el:n,declarationView:s}=r[e],c=n.parentNode;n===t?(r.splice(e,1),ju.add(n),n.dispatchEvent(new CustomEvent(`animationend`,{detail:{cancel:!0}}))):(a&&n===a||c&&i&&c!==i&&(o===null||s===null||o===s))&&(r.splice(e,1),n.dispatchEvent(new CustomEvent(`animationend`,{detail:{cancel:!0}})),n.parentNode?.removeChild(n))}}function Nu(e,t,n){let r=Au(n),i=ku.get(e);i?i.some(e=>e.el===t)||i.push({el:t,declarationView:r}):ku.set(e,[{el:t,declarationView:r}])}var Pu=(function(e){return e[e.CHANGE_DETECTION=0]=`CHANGE_DETECTION`,e[e.AFTER_NEXT_RENDER=1]=`AFTER_NEXT_RENDER`,e})(Pu||{}),Fu=new mi(``),Iu=new Set;function Lu(e){Iu.has(e)||(Iu.add(e),performance?.mark?.(`mark_feature_usage`,{detail:{feature:e}}))}var Ru=(()=>{class e{impl=null;execute(){this.impl?.execute()}static ɵprov=si({token:e,providedIn:`root`,factory:()=>new e})}return e})(),zu=new mi(``,{factory:()=>{let e=A(wa),t=new Set;return e.onDestroy(()=>t.clear()),{queue:t,isScheduled:!1,scheduler:null,injector:e}}});function Bu(e,t,n){let r=e.get(zu);if(Array.isArray(t))for(let e of t)r.queue.add(e),n?.detachedLeaveAnimationFns?.push(e);else r.queue.add(t),n?.detachedLeaveAnimationFns?.push(t);r.scheduler&&r.scheduler(e)}function Vu(e,t){let n=e.get(zu);if(Array.isArray(t))for(let e of t)n.queue.delete(e);else n.queue.delete(t)}function Hu(e,t){let n=e.get(zu);if(t.detachedLeaveAnimationFns){for(let e of t.detachedLeaveAnimationFns)n.queue.delete(e);t.detachedLeaveAnimationFns=void 0}}function Uu(e,t){for(let[n,r]of t)Bu(e,r.animateFns)}function Wu(e,t,n,r){let i=e?.[26]?.enter;t!==null&&i&&i.has(n.index)&&Uu(r,i)}function Gu(e,t,n,r){try{n.get(oa)}catch{return r(!1)}let i=e?.[26];i?.enter?.has(t.index)&&Vu(n,i.enter.get(t.index).animateFns);let a=Ku(e,t,i);if(a.size===0){let n=!1;if(e){let r=[];Ju(e,t,r),n=r.length>0}if(!n)return r(!1)}e&&Ou.add(e[19]),Bu(n,()=>qu(e,t,i||void 0,a,r),i||void 0)}function Ku(e,t,n){let r=new Map,i=n?.leave;if(i&&i.has(t.index)&&r.set(t.index,i.get(t.index)),e&&i)for(let[n,a]of i){if(r.has(n))continue;let i=e[1].data[n].parent;for(;i;){if(i===t){r.set(n,a);break}i=i.parent}}return r}function qu(e,t,n,r,i){let a=[];if(n&&n.leave)for(let[e]of r){if(!n.leave.has(e))continue;let t=n.leave.get(e);for(let e of t.animateFns){let{promise:t}=e();a.push(t)}n.detachedLeaveAnimationFns=void 0}if(e&&Ju(e,t,a),a.length>0){let t=n||e?.[26];if(t){let n=t.running;n&&a.push(n),t.running=Promise.allSettled(a),Xu(e,t.running,i)}else Promise.allSettled(a).then(()=>{e&&Ou.delete(e[19]),i(!0)})}else e&&Ou.delete(e[19]),i(!1)}function Ju(e,t,n){if(t.type&12){let r=e[t.index];if(Ba(r))for(let e=10;e<r.length;e++){let t=r[e];t[1].type===2&&Yu(t,n)}}let r=t.child;for(;r;)Ju(e,r,n),r=r.next}function Yu(e,t){let n=e[26];if(n&&n.leave)for(let e of n.leave.values())for(let n of e.animateFns){let{promise:e}=n();t.push(e)}let r=e[1].firstChild;for(;r;)Ju(e,r,t),r=r.next}function Xu(e,t,n){t.then(()=>{e[26]?.running===t&&(e[26].running=void 0,Ou.delete(e[19])),n(!0)})}function Zu(e,t,n,r,i,a,o,s){if(i!=null){let c,l=!1;Ba(i)?c=i:za(i)&&(l=!0,i=i[0]);let u=Ja(i);e===0&&r!==null?(Wu(s,r,a,n),o==null?ru(t,r,u):nu(t,r,u,o||null,!0)):e===1&&r!==null?(Wu(s,r,a,n),nu(t,r,u,o||null,!0),Mu(a,u,s)):e===2?(s?.[26]?.leave?.has(a.index)&&Nu(a,u,s),ju.delete(u),Gu(s,a,n,e=>{if(ju.has(u)){ju.delete(u);return}au(t,u,l,e)})):e===3&&(ju.delete(u),Gu(s,a,n,()=>{t.destroyNode(u)})),c!=null&&bd(t,e,n,c,a,r,o)}}function Qu(e,t){ed(e,t),t[0]=null,t[5]=null}function $u(e,t,n,r,i,a){r[0]=i,r[5]=t,_d(e,r,n,1,i,a)}function ed(e,t){t[10].changeDetectionScheduler?.notify(9),_d(e,t,t[11],2,null,null)}function td(e){let t=e[12];if(!t)return id(e[1],e);for(;t;){let n=null;if(za(t))n=t[12];else{let e=t[10];e&&(n=e)}if(!n){for(;t&&!t[4]&&t!==e;)za(t)&&id(t[1],t),t=t[3];t===null&&(t=e),za(t)&&id(t[1],t),n=t&&t[4]}t=n}}function nd(e,t){let n=e[9],r=n.indexOf(t);n.splice(r,1)}function rd(e,t){if(Ka(t))return;let n=t[11];n.destroyNode&&_d(e,t,n,3,null,null),td(t)}function id(e,t){if(Ka(t))return;let n=O(null);try{t[2]&=-129,t[2]|=256,t[24]&&Sn(t[24]),od(e,t),ad(e,t),t[1].type===1&&t[11].destroy();let n=t[16];if(n!==null&&Ba(t[3])){n!==t[3]&&nd(n,t);let r=t[18];r!==null&&r.detachView(e)}Cl(t)}finally{O(n)}}function ad(e,t){let n=e.cleanup,r=t[7];if(n!==null)for(let e=0;e<n.length-1;e+=2)if(typeof n[e]==`string`){let t=n[e+3];t>=0?r[t]():r[-t].unsubscribe(),e+=2}else{let t=r[n[e+1]];n[e].call(t)}r!==null&&(t[7]=null);let i=t[21];if(i!==null){t[21]=null;for(let e=0;e<i.length;e++){let t=i[e];t()}}let a=t[23];if(a!==null){t[23]=null;for(let e of a)e.destroy()}}function od(e,t){let n;if(e!=null&&(n=e.destroyHooks)!=null)for(let e=0;e<n.length;e+=2){let r=t[n[e]];if(!(r instanceof Tc)){let t=n[e+1];if(Array.isArray(t))for(let e=0;e<t.length;e+=2){let n=r[t[e]],i=t[e+1];hc(uc.LifecycleHookStart,n,i);try{i.call(n)}finally{hc(uc.LifecycleHookEnd,n,i)}}else{hc(uc.LifecycleHookStart,r,t);try{t.call(r)}finally{hc(uc.LifecycleHookEnd,r,t)}}}}}function sd(e,t,n){if(t===null)throw new k(510,!1);return cd(e,t.parent,n)}function cd(e,t,n){let r=t;for(;r!==null&&r.type&168;)t=r,r=t.parent;if(r===null)return n[0];if(Ha(r)){let{encapsulation:t}=e.data[r.directiveStart+r.componentOffset];if(t===Gl.None||t===Gl.Emulated)return null}return Xa(r,n)}function ld(e,t,n){return dd(e,t,n)}function ud(e,t,n){return e.type&40?Xa(e,n):null}var dd=ud;function fd(e,t,n,r){let i=sd(e,r,t),a=t[11],o=ld(r.parent||t[5],r,t);if(i!=null){if(Array.isArray(n))for(let e=0;e<n.length;e++)iu(a,i,n[e],o,!1);else iu(a,i,n,o,!1)}}function pd(e,t){if(t!==null){let n=t.type;if(n&3)return Xa(t,e);if(n&4)return hd(-1,e[t.index]);if(n&8){let n=t.child;if(n!==null)return pd(e,n);{let n=e[t.index];return Ba(n)?hd(-1,n):Ja(n)}}if(n&128)return pd(e,t.next);if(n&32)return Du(t,e)()||Ja(e[t.index]);{let n=md(e,t);return n===null?pd(e,t.next):Array.isArray(n)?n[0]:pd(fo(e[15]),n)}}return null}function md(e,t){if(t!==null){let n=e[15][5],r=t.projection;return n.projection[r]}return null}function hd(e,t){let n=10+e+1;if(n<t.length){let e=t[n],r=e[1].firstChild;if(r!==null)return pd(e,r)}return t[7]}function gd(e,t,n,r,i,a,o){for(;n!=null;){let s=r[9];if(n.type===128){n=n.next;continue}let c=r[n.index],l=n.type;if(o&&t===0&&(c&&Tl(Ja(c),r),n.flags|=2),!Rl(n)){if(l&8)gd(e,t,n.child,r,i,a,!1),Zu(t,e,s,i,c,n,a,r);else if(l&32){let o=Du(n,r),l;for(;l=o();)Zu(t,e,s,i,l,n,a,r);Zu(t,e,s,i,c,n,a,r)}else l&16?yd(e,t,r,n,i,a):Zu(t,e,s,i,c,n,a,r)}n=o?n.projectionNext:n.next}}function _d(e,t,n,r,i,a){e.type===3?vd(n,r,t,i,a):gd(n,r,e.firstChild,t,i,a,!1)}function vd(e,t,n,r,i){let a=n[1].firstChild,o=a.next,s=Ja(n[a.index]),c=Ja(n[o.index]),l=o.index+1,u=n[l];if(t===1||t===0)r!==null&&(u&&u.hasChildNodes()?nu(e,r,u,i,!0):(nu(e,r,s,i,!0),nu(e,r,c,i,!0)));else if(t===2){if(u||(u=document.createDocumentFragment(),n[l]=u),s&&s.parentNode===u)return;let e=s;for(;e!==null;){let t=e.nextSibling;if(u.appendChild(e),e===c)break;e=t}}}function yd(e,t,n,r,i,a){let o=n[15],s=o[5].projection[r.projection];if(Array.isArray(s))for(let o=0;o<s.length;o++){let c=s[o];Zu(t,e,n[9],i,c,r,a,n)}else{let n=s,c=o[3];_l(r)&&(n.flags|=128),gd(e,t,n,c,i,a,!0)}}function bd(e,t,n,r,i,a,o){let s=r[7];if(s!==Ja(r)&&Zu(t,e,n,a,s,i,o),!(r[2]&4))for(let n=10;n<r.length;n++){let i=r[n];_d(i[1],i,e,t,a,s)}}function xd(e,t,n,r,i){if(t)i?e.addClass(n,r):e.removeClass(n,r);else{let t=r.indexOf(`-`)===-1?void 0:Tu.DashCase;i==null?e.removeStyle(n,r,t):(typeof i==`string`&&i.endsWith(`!important`)&&(i=i.slice(0,-10),t|=Tu.Important),e.setStyle(n,r,i,t))}}function Sd(e,t,n,r,i,a,o,s,c,l,u){let d=27+r,f=d+i,p=Cd(d,f),m=typeof l==`function`?l():l;return p[1]={type:e,blueprint:p,template:n,queries:null,viewQuery:s,declTNode:t,data:p.slice().fill(null,d),bindingStartIndex:d,expandoStartIndex:f,hostBindingOpCodes:null,firstCreatePass:!0,firstUpdatePass:!0,staticViewQueries:!1,staticContentQueries:!1,preOrderHooks:null,preOrderCheckHooks:null,contentHooks:null,contentCheckHooks:null,viewHooks:null,viewCheckHooks:null,destroyHooks:null,cleanup:null,contentQueries:null,components:null,directiveRegistry:typeof a==`function`?a():a,pipeRegistry:typeof o==`function`?o():o,firstChild:null,schemas:c,consts:m,incompleteFirstPass:!1,ssrId:u}}function Cd(e,t){let n=[];for(let r=0;r<t;r++)n.push(r<e?null:wu);return n}function wd(e){let t=e.tView;return t===null||t.incompleteFirstPass?e.tView=Sd(1,null,e.template,e.decls,e.vars,e.directiveDefs,e.pipeDefs,e.viewQuery,e.schemas,e.consts,e.id):t}function Td(e,t,n,r,i,a,o,s,c,l,u){let d=t.blueprint.slice();return d[0]=i,d[2]=r|1228,(l!==null||e&&e[2]&2048)&&(d[2]|=2048),ro(d),d[3]=d[14]=e,d[8]=n,d[10]=o||e&&e[10],d[11]=s||e&&e[11],d[9]=c||e&&e[9]||null,d[5]=a,d[19]=xl(),d[6]=u,d[20]=l,d[15]=t.type==2?e[15]:d,d}function Ed(e,t,n){let r=Xa(t,e),i=wd(n),a=e[10].rendererFactory,o=kd(e,Td(e,i,null,Dd(n),r,t,null,a.createRenderer(r,n),null,null,null));return e[t.index]=o}function Dd(e){let t=16;return e.signals?t=4096:e.onPush&&(t=64),t}function Od(e,t,n,r){if(n===0)return-1;let i=t.length;for(let i=0;i<n;i++)t.push(r),e.blueprint.push(r),e.data.push(null);return i}function kd(e,t){return e[12]?e[13][4]=t:e[12]=t,e[13]=t,t}function I(e=1){Ad(Co(),M(),Qo()+e,!1)}function Ad(e,t,n,r){if(!r){if((t[2]&3)==3){let r=e.preOrderCheckHooks;r!==null&&vc(t,r,n)}else{let r=e.preOrderHooks;r!==null&&yc(t,r,0,n)}}$o(n)}var jd=(function(e){return e[e.None=0]=`None`,e[e.SignalBased=1]=`SignalBased`,e[e.HasDecoratorInputTransform=2]=`HasDecoratorInputTransform`,e})(jd||{});function Md(e,t,n,r){let i=O(null);try{let[i,a,o]=e.inputs[n],s=null;(a&jd.SignalBased)!==0&&(s=t[i][sn]),s!==null&&s.transformFn!==void 0?r=s.transformFn(r):o!==null&&(r=o.call(t,r)),e.setInput===null?dc(t,s,i,r):e.setInput(t,s,r,n,i)}finally{O(i)}}function Nd(e,t,n,r,i){let a=Qo(),o=r&2;try{$o(-1),o&&t.length>27&&Ad(e,t,27,!1),hc(o?uc.TemplateUpdateStart:uc.TemplateCreateStart,i,n),n(r,i)}finally{$o(a),hc(o?uc.TemplateUpdateEnd:uc.TemplateCreateEnd,i,n)}}function Pd(e,t,n){Vd(e,t,n),(n.flags&64)==64&&Hd(e,t,n)}function Fd(e,t,n=Xa){let r=t.localNames;if(r!==null){let i=t.index+1;for(let a=0;a<r.length;a+=2){let o=r[a+1],s=o===-1?n(t,e):e[o];e[i++]=s}}}function Id(e,t,n,r){let i=r.get(Nl,Ml)||n===Gl.ShadowDom||n===Gl.ExperimentalIsolatedShadowDom;return e.selectRootElement(t,i)}function Ld(e){return e===`class`?`className`:e===`for`?`htmlFor`:e===`formaction`?`formAction`:e===`innerHtml`?`innerHTML`:e===`readonly`?`readOnly`:e===`tabindex`?`tabIndex`:e}function Rd(e,t,n,r,i,a){let o=t[1];if(Zd(e,o,t,n,r)){Ha(e)&&Bd(t,e.index);return}e.type&3&&(n=Ld(n)),zd(e,t,n,r,i,a)}function zd(e,t,n,r,i,a){if(e.type&3){let o=Xa(e,t);r=a==null?r:a(r,e.value||``,n),i.setProperty(o,n,r)}else e.type&12}function Bd(e,t){let n=eo(t,e);n[2]&16||(n[2]|=64)}function Vd(e,t,n){let r=n.directiveStart,i=n.directiveEnd;Ha(n)&&Ed(t,n,e.data[r+n.componentOffset]),e.firstCreatePass||Wc(n,t);let a=n.initialInputs;for(let o=r;o<i;o++){let i=e.data[o],s=tl(t,e,o,n);if(Tl(s,t),a!==null&&qd(t,o-r,s,i,n,a),Wa(i)){let r=eo(n.index,t);r[8]=tl(t,e,o,n)}}}function Hd(e,t,n){let r=n.directiveStart,i=n.directiveEnd,a=n.index,o=zo();try{$o(a);for(let n=r;n<i;n++){let r=e.data[n],i=t[n];Bo(n),(r.hostBindings!==null||r.hostVars!==0||r.hostAttrs!==null)&&Ud(r,i)}}finally{$o(-1),Bo(o)}}function Ud(e,t){e.hostBindings!==null&&e.hostBindings(1,t)}function Wd(e,t){let n=e.directiveRegistry,r=null;if(n)for(let e=0;e<n.length;e++){let i=n[e];_u(t,i.selectors,!1)&&(r??=[],Wa(i)?r.unshift(i):r.push(i))}return r}function Gd(e,t,n,r,i,a){let o=Xa(e,t);Kd(t[11],o,a,e.value,n,r,i)}function Kd(e,t,n,r,i,a,o){if(a==null)o?.(a,r||``,i),e.removeAttribute(t,i,n);else{let s=o==null?Ei(a):o(a,r||``,i);e.setAttribute(t,i,s,n)}}function qd(e,t,n,r,i,a){let o=a[t];if(o!==null)for(let e=0;e<o.length;e+=2){let t=o[e],i=o[e+1];Md(r,n,t,i)}}function Jd(e,t,n,r,i){let a=27+n,o=t[1],s=i(o,t,e,r,n);t[a]=s,Do(e,!0);let c=e.type===2;return c?(cu(t[11],s,e),(go()===0||Ua(e))&&Tl(s,t),_o()):Tl(s,t),os()&&(!c||!Rl(e))&&fd(o,t,s,e),e}function Yd(e){let t=e;return Oo()?ko():(t=t.parent,Do(t,!1)),t}function Xd(e,t){let n=e[9];if(!n)return;let r;try{r=n.get(Ls,null)}catch{r=null}r?.(t)}function Zd(e,t,n,r,i){let a=e.inputs?.[r],o=e.hostDirectiveInputs?.[r],s=!1;if(o)for(let e=0;e<o.length;e+=2){let r=o[e],a=o[e+1],c=t.data[r];Md(c,n[r],a,i),s=!0}if(a)for(let e of a){let a=n[e],o=t.data[e];Md(o,a,r,i),s=!0}return s}function Qd(e,t){let n=eo(t,e),r=n[1];$d(r,n);let i=n[0];i!==null&&n[6]===null&&(n[6]=Bl(i,n[9])),hc(uc.ComponentStart);try{ef(r,n,n[8])}finally{hc(uc.ComponentEnd,n[8])}}function $d(e,t){for(let n=t.length;n<e.blueprint.length;n++)t.push(e.blueprint[n])}function ef(e,t,n){Go(t);try{let r=e.viewQuery;r!==null&&Ul(1,r,n);let i=e.template;i!==null&&Nd(e,t,i,1,n),e.firstCreatePass&&=!1,t[18]?.finishViewCreation(e),e.staticContentQueries&&Hl(e,t),e.staticViewQueries&&Ul(2,e.viewQuery,n);let a=e.components;a!==null&&tf(t,a)}catch(t){throw e.firstCreatePass&&=(e.incompleteFirstPass=!0,!1),t}finally{t[2]&=-5,Xo()}}function tf(e,t){for(let n=0;n<t.length;n++)Qd(e,t[n])}function nf(e,t,n,r){let i=O(null);try{let i=t.tView,a=Td(e,i,n,e[2]&4096?4096:16,null,t,null,null,r?.injector??null,r?.embeddedViewInjector??null,r?.dehydratedView??null);a[16]=e[t.index];let o=e[18];return o!==null&&(a[18]=o.createEmbeddedView(i)),ef(i,a,n),a}finally{O(i)}}function rf(e,t){return!t||t.firstChild===null||_l(e)}function af(e,t,n,r,i=!1){if(e.type===3){let n=e.firstChild,i=n.next,a=Ja(t[n.index]),o=Ja(t[i.index]),s=a;for(;s!==null&&(r.push(s),s!==o);)s=s.nextSibling;return r}for(;n!==null;){if(n.type===128){n=i?n.projectionNext:n.next;continue}let a=t[n.index];if(a!==null){if(Ba(a)){let e=a[7];e!==a[0]&&r.push(Ja(a)),a[2]&4||of(a,r),r.push(e)}else r.push(Ja(a))}let o=n.type;if(o&8)af(e,t,n.child,r);else if(o&32){let e=Du(n,t),i;for(;i=e();)r.push(i)}else if(o&16){let e=md(t,n);if(Array.isArray(e))r.push(...e);else{let n=fo(t[15]);af(n[1],n,e,r,!0)}}n=i?n.projectionNext:n.next}return r}function of(e,t){for(let n=10;n<e.length;n++){let r=e[n],i=r[1].firstChild;i!==null&&af(r[1],r,i,t)}}function sf(e){if(e[25]!==null){for(let t of e[25])t.impl.addSequence(t);e[25].length=0}}var cf=[];function lf(e){return e[24]??uf(e)}function uf(e){let t=cf.pop()??Object.create(ff);return t.lView=e,t}function df(e){e.lView[24]!==e&&(e.lView=null,cf.push(e))}var ff={...ln,consumerIsAlwaysLive:!0,kind:`template`,consumerMarkedDirty:e=>{co(e.lView)},consumerOnSignalRead(){this.lView[24]=this}};function pf(e){let t=e[24]??Object.create(mf);return t.lView=e,t}var mf={...ln,consumerIsAlwaysLive:!0,kind:`template`,consumerMarkedDirty:e=>{let t=fo(e.lView);for(;t&&!hf(t[1]);)t=fo(t);t&&io(t)},consumerOnSignalRead(){this.lView[24]=this}};function hf(e){return e.type!==2}function gf(e){if(e[23]===null)return;let t=!0;for(;t;){let n=!1;for(let t of e[23])if(t.dirty&&(n=!0,t.zone===null||Zone.current===t.zone?t.run():t.zone.run(()=>t.run()),e[23]===null))return;t=n&&!!(e[2]&8192)}}var _f=100;function vf(e,t=0){let n=e[10].rendererFactory;n.begin?.();try{yf(e,t)}finally{n.end?.()}}function yf(e,t){let n=Ao();try{jo(!0),Tf(e,t);let n=0;for(;oo(e);){if(n===_f)throw new k(103,!1);n++,Tf(e,1)}}finally{jo(n)}}function bf(e,t,n,r){if(Ka(t))return;let i=t[2];Go(t);let a=!0,o=null,s=null;hf(e)?(s=lf(t),o=_n(s)):cn()===null?(a=!1,s=pf(t),o=_n(s)):t[24]&&=(Sn(t[24]),null);try{ro(t),Po(e.bindingStartIndex),n!==null&&Nd(e,t,n,2,r);let a=(i&3)==3;if(a){let n=e.preOrderCheckHooks;n!==null&&vc(t,n,null)}else{let n=e.preOrderHooks;n!==null&&yc(t,n,0,null),bc(t,0)}if(Sf(t),gf(t),xf(t,0),e.contentQueries!==null&&Hl(e,t),a){let n=e.contentCheckHooks;n!==null&&vc(t,n)}else{let n=e.contentHooks;n!==null&&yc(t,n,1),bc(t,1)}Df(e,t);let o=e.components;o!==null&&Ef(t,o,0);let s=e.viewQuery;if(s!==null&&Ul(2,s,r),a){let n=e.viewCheckHooks;n!==null&&vc(t,n)}else{let n=e.viewHooks;n!==null&&yc(t,n,2),bc(t,2)}if(e.firstUpdatePass===!0&&(e.firstUpdatePass=!1),t[22]){for(let e of t[22])e();t[22]=null}sf(t),t[2]&=-73}catch(e){throw co(t),e}finally{s!==null&&(yn(s,o),a&&df(s)),Xo()}}function xf(e,t){for(let n=El(e);n!==null;n=Dl(n))for(let e=10;e<n.length;e++){let r=n[e];wf(r,t)}}function Sf(e){for(let t=El(e);t!==null;t=Dl(t)){if(!(t[2]&2))continue;let e=t[9];for(let t=0;t<e.length;t++){let n=e[t];io(n)}}}function Cf(e,t,n){hc(uc.ComponentStart);let r=eo(t,e);try{wf(r,n)}finally{hc(uc.ComponentEnd,r[8])}}function wf(e,t){to(e)&&Tf(e,t)}function Tf(e,t){let n=e[1],r=e[2],i=e[24],a=!!(t===0&&r&16);if(a||=!!(r&64&&t===0),a||=!!(r&1024),a||=!!(i?.dirty&&xn(i)),a||=!1,i&&(i.dirty=!1),e[2]&=-9217,a)bf(n,e,n.template,e[8]);else if(r&8192){let t=O(null);try{gf(e),xf(e,1);let t=n.components;t!==null&&Ef(e,t,1),sf(e)}finally{O(t)}}}function Ef(e,t,n){for(let r=0;r<t.length;r++)Cf(e,t[r],n)}function Df(e,t){let n=e.hostBindingOpCodes;if(n!==null)try{for(let e=0;e<n.length;e++){let r=n[e];if(r<0)$o(~r);else{let i=r,a=n[++e],o=n[++e];Ro(a,i);let s=t[i];hc(uc.HostBindingsUpdateStart,s);try{o(2,s)}finally{hc(uc.HostBindingsUpdateEnd,s)}}}}finally{$o(-1)}}function Of(e,t){let n=Ao()?64:1088;for(e[10].changeDetectionScheduler?.notify(t);e;){e[2]|=n;let t=fo(e);if(Ga(e)&&!t)return e;e=t}return null}function kf(e,t,n,r){return[e,!0,0,t,null,r,null,n,null,null]}function Af(e,t){let n=10+t;if(n<e.length)return e[n]}function jf(e,t,n,r=!0){let i=t[1];if(Pf(i,t,e,n),r){let r=hd(n,e),a=t[11],o=a.parentNode(e[7]);o!==null&&$u(i,e[5],a,t,o,r)}let a=t[6];a!==null&&a.firstChild!==null&&(a.firstChild=null)}function Mf(e,t){let n=Nf(e,t);return n!==void 0&&rd(n[1],n),n}function Nf(e,t){if(e.length<=10)return;let n=10+t,r=e[n];if(r){let i=r[16];i!==null&&i!==e&&nd(i,r),t>0&&(e[n-1][4]=r[4]);let a=Zi(e,10+t);Qu(r[1],r);let o=a[18];o!==null&&o.detachView(a[1]),r[3]=null,r[4]=null,r[2]&=-129}return r}function Pf(e,t,n,r){let i=10+r,a=n.length;r>0&&(n[i-1][4]=t),r<a-10?(t[4]=n[i],Xi(n,10+r,t)):(n.push(t),t[4]=null),t[3]=n;let o=t[16];o!==null&&n!==o&&Ff(o,t);let s=t[18];s!==null&&s.insertView(e),so(t),t[2]|=128}function Ff(e,t){let n=e[9],r=t[3];if(za(r))e[2]|=2;else{let n=r[3][15];t[15]!==n&&(e[2]|=2)}n===null?e[9]=[t]:n.push(t)}var If=class{_lView;_cdRefInjectingView;_appRef=null;_attachedToViewContainer=!1;exhaustive;get rootNodes(){let e=this._lView,t=e[1];return af(t,e,t.firstChild,[])}constructor(e,t){this._lView=e,this._cdRefInjectingView=t}get context(){return this._lView[8]}set context(e){this._lView[8]=e}get destroyed(){return Ka(this._lView)}destroy(){if(this._appRef)this._appRef.detachView(this);else if(this._attachedToViewContainer){let e=this._lView[3];if(Ba(e)){let t=e[8],n=t?t.indexOf(this):-1;n>-1&&(Nf(e,n),Zi(t,n))}this._attachedToViewContainer=!1}rd(this._lView[1],this._lView)}onDestroy(e){lo(this._lView,e)}markForCheck(){Of(this._cdRefInjectingView||this._lView,4)}detach(){this._lView[2]&=-129}reattach(){so(this._lView),this._lView[2]|=128}detectChanges(){this._lView[2]|=1024,vf(this._lView)}checkNoChanges(){}attachToViewContainerRef(){if(this._appRef)throw new k(902,!1);this._attachedToViewContainer=!0}detachFromAppRef(){this._appRef=null;let e=Ga(this._lView),t=this._lView[16];t!==null&&!e&&nd(t,this._lView),ed(this._lView[1],this._lView)}attachToAppRef(e){if(this._attachedToViewContainer)throw new k(902,!1);this._appRef=e;let t=Ga(this._lView),n=this._lView[16];n!==null&&!t&&Ff(n,this._lView),so(this._lView)}};function Lf(e,t,n,r,i){let a=e.data[t];if(a===null)a=Rf(e,t,n,r,i),Lo()&&(a.flags|=32);else if(a.type&64){a.type=n,a.value=r,a.attrs=i;let e=Eo();a.injectorIndex=e===null?-1:e.injectorIndex}return Do(a,!0),a}function Rf(e,t,n,r,i){let a=To(),o=Oo(),s=o?a:a&&a.parent,c=e.data[t]=Bf(e,s,n,t,r,i);return zf(e,c,a,o),c}function zf(e,t,n,r){e.firstChild===null&&(e.firstChild=t),n!==null&&(r?n.child==null&&t.parent!==null&&(n.child=t):n.next===null&&(n.next=t,t.prev=n))}function Bf(e,t,n,r,i,a){let o=t?t.injectorIndex:-1,s=0;return bo()&&(s|=128),{type:n,index:r,insertBeforeIndex:null,injectorIndex:o,directiveStart:-1,directiveEnd:-1,directiveStylingLast:-1,componentOffset:-1,controlDirectiveIndex:-1,customControlIndex:-1,propertyBindings:null,flags:s,providerIndexes:0,value:i,namespace:is(),attrs:a,mergedAttrs:null,localNames:null,initialInputs:null,inputs:null,hostDirectiveInputs:null,outputs:null,hostDirectiveOutputs:null,directiveToIndex:null,tView:null,next:null,prev:null,projectionNext:null,child:null,parent:t,projection:null,styles:null,stylesWithoutHost:null,residualStyles:void 0,classes:null,classesWithoutHost:null,residualClasses:void 0,classBindings:0,styleBindings:0}}function Vf(e){let t=e[6]??[],n=e[3][11],r=[];for(let e of t)e.data.di===void 0?Hf(e,n):r.push(e);e[6]=r}function Hf(e,t){let n=0,r=e.firstChild;if(r){let i=e.data.r;for(;n<i;){let e=r.nextSibling;au(t,r,!1),r=e,n++}}}var Uf=()=>null,Wf=()=>null;function Gf(e,t){return Uf(e,t)}function Kf(e,t,n){return Wf(e,t,n)}var qf=class{},Jf=class{},Yf=(()=>{class e{static ɵprov=si({token:e,providedIn:`root`,factory:()=>null})}return e})();function Xf(e){return e.debugInfo?.className||e.type.name||null}var Zf={},Qf=class{injector;parentInjector;constructor(e,t){this.injector=e,this.parentInjector=t}get(e,t,n){let r=this.injector.get(e,Zf,n);return r!==Zf||t===Zf?r:this.parentInjector.get(e,t,n)}};function $f(e,t,n){return e[t]=n}function ep(e,t){return e[t]}function tp(e,t,n){if(n===wu)return!1;let r=e[t];return!Object.is(r,n)&&(e[t]=n,!0)}function np(e,t,n,r){let i=tp(e,t,n);return tp(e,t+1,r)||i}function rp(e,t,n,r,i){let a=np(e,t,n,r);return tp(e,t+2,i)||a}function ip(e,t,n){return function r(i){let a=r.__ngNativeEl__;a!==void 0&&Il(i,a),Of(Ha(e)?eo(e.index,t):t,5);let o=t[8],s=ap(t,o,n,i),c=r.__ngNextListenerFn__;for(;c;)s=ap(t,o,c,i)&&s,c=c.__ngNextListenerFn__;return s}}function ap(e,t,n,r){let i=O(null);try{return hc(uc.OutputStart,t,n),n(r)!==!1}catch(t){return Xd(e,t),!1}finally{hc(uc.OutputEnd,t,n),O(i)}}function op(e,t,n,r,i,a,o,s){let c=Ua(e),l=!1,u=null;if(!r&&c&&(u=cp(t,n,a,e.index)),u!==null){let e=u.__ngLastListenerFn__||u;e.__ngNextListenerFn__=o,u.__ngLastListenerFn__=o,l=!0}else{let o=Xa(e,n),c=r?r(o):o;r||(s.__ngNativeEl__=o);let l=i.listen(c,a,s);sp(a)||lp(r?t=>r(Ja(t[e.index])):e.index,t,n,a,s,l,!1)}return l}function sp(e){return e.startsWith(`animation`)||e.startsWith(`transition`)}function cp(e,t,n,r){let i=e.cleanup;if(i!=null)for(let e=0;e<i.length-1;e+=2){let a=i[e];if(a===n&&i[e+1]===r){let n=t[7],r=i[e+2];return n&&n.length>r?n[r]:null}typeof a==`string`&&(e+=2)}return null}function lp(e,t,n,r,i,a,o){let s=t.firstCreatePass?mo(t):null,c=po(n),l=c.length;c.push(i,a),s&&s.push(r,e,l,(l+1)*(o?-1:1))}function up(e,t,n,r,i,a){let o=t[n],s=t[1],c=o[s.data[n].outputs[r]].subscribe(a);lp(e.index,s,t,i,a,c,!0)}var dp=Symbol(`BINDING`),fp=new mi(``);function pp(e,t,n){let r=n?e.styles:null,i=n?e.classes:null,a=0;if(t!==null)for(let e=0;e<t.length;e++){let n=t[e];if(typeof n==`number`)a=n;else if(a==1)i=ni(i,n);else if(a==2){let i=n,a=t[++e];r=ni(r,i+`: `+a+`;`)}}n?e.styles=r:e.stylesWithoutHost=r,n?e.classes=i:e.classesWithoutHost=i}function mp(e,t=0){let n=M();return n===null?Ui(e,t):Zc(wo(),n,ai(e),t)}function hp(e,t,n,r,i){let a=r===null?null:{"":-1},o=i(e,n);if(o!==null){let r=o,i=null,s=null;for(let e of o)if(e.resolveHostDirectives!==null){[r,i,s]=e.resolveHostDirectives(o);break}vp(e,t,n,r,a,i,s)}a!==null&&r!==null&&gp(n,r,a)}function gp(e,t,n){let r=e.localNames=[];for(let e=0;e<t.length;e+=2){let i=n[t[e+1]];if(i==null)throw new k(-301,!1);r.push(t[e],i)}}function _p(e,t,n){t.componentOffset=n,(e.components??=[]).push(t.index)}function vp(e,t,n,r,i,a,o){let s=r.length,c=null;for(let i=0;i<s;i++){let a=r[i];c===null&&Wa(a)&&(c=a,_p(e,n,i)),Jc(Wc(n,t),e,a.type)}Op(n,e.data.length,s),c?.viewProvidersResolver&&c.viewProvidersResolver(c);for(let e=0;e<s;e++){let t=r[e];t.providersResolver&&t.providersResolver(t)}let l=!1,u=!1,d=Od(e,t,s,null);s>0&&(n.directiveToIndex=new Map);for(let c=0;c<s;c++){let s=r[c];if(n.mergedAttrs=jc(n.mergedAttrs,s.hostAttrs),wp(e,n,t,d,s),Dp(d,s,i),o!==null&&o.has(s)){let[e,t]=o.get(s);n.directiveToIndex.set(s.type,[d,e+n.directiveStart,t+n.directiveStart])}else(a===null||!a.has(s))&&n.directiveToIndex.set(s.type,d);s.contentQueries!==null&&(n.flags|=4),(s.hostBindings!==null||s.hostAttrs!==null||s.hostVars!==0)&&(n.flags|=64);let f=s.type.prototype;!l&&(f.ngOnChanges||f.ngOnInit||f.ngDoCheck)&&((e.preOrderHooks??=[]).push(n.index),l=!0),!u&&(f.ngOnChanges||f.ngDoCheck)&&((e.preOrderCheckHooks??=[]).push(n.index),u=!0),d++}yp(e,n,a)}function yp(e,t,n){for(let r=t.directiveStart;r<t.directiveEnd;r++){let i=e.data[r];if(n===null||!n.has(i))bp(0,t,i,r),bp(1,t,i,r),Cp(t,r,!1);else{let e=n.get(i);xp(0,t,e,r),xp(1,t,e,r),Cp(t,r,!0)}}}function bp(e,t,n,r){let i=e===0?n.inputs:n.outputs;for(let n in i)if(Object.hasOwn(i,n)){let i;i=e===0?t.inputs??={}:t.outputs??={},i[n]??=[],i[n].push(r),Sp(t,n)}}function xp(e,t,n,r){let i=e===0?n.inputs:n.outputs;for(let n in i)if(Object.hasOwn(i,n)){let a=i[n],o;o=e===0?t.hostDirectiveInputs??={}:t.hostDirectiveOutputs??={},o[a]??=[],o[a].push(r,n),Sp(t,a)}}function Sp(e,t){t===`class`?e.flags|=8:t===`style`&&(e.flags|=16)}function Cp(e,t,n){let{attrs:r,inputs:i,hostDirectiveInputs:a}=e;if(r===null||!n&&i===null||n&&a===null||fu(e)){e.initialInputs??=[],e.initialInputs.push(null);return}let o=null,s=0;for(;s<r.length;){let e=r[s];if(e===0){s+=4;continue}if(e===5){s+=2;continue}if(typeof e==`number`)break;if(!n&&Object.hasOwn(i,e)){let n=i[e];for(let i of n)if(i===t){o??=[],o.push(e,r[s+1]);break}}else if(n&&Object.hasOwn(a,e)){let n=a[e];for(let e=0;e<n.length;e+=2)if(n[e]===t){o??=[],o.push(n[e+1],r[s+1]);break}}s+=2}e.initialInputs??=[],e.initialInputs.push(o)}function wp(e,t,n,r,i){e.data[r]=i;let a=new Tc(i.factory||=Ji(i.type,!0),Wa(i),mp,null);e.blueprint[r]=a,n[r]=a,Tp(e,t,r,Od(e,n,i.hostVars,wu),i)}function Tp(e,t,n,r,i){let a=i.hostBindings;if(a){let i=e.hostBindingOpCodes;i===null&&(i=e.hostBindingOpCodes=[]);let o=~t.index;Ep(i)!=o&&i.push(o),i.push(n,r,a)}}function Ep(e){let t=e.length;for(;t>0;){let n=e[--t];if(typeof n==`number`&&n<0)return n}return 0}function Dp(e,t,n){if(n){if(t.exportAs)for(let r=0;r<t.exportAs.length;r++)n[t.exportAs[r]]=e;Wa(t)&&(n[``]=e)}}function Op(e,t,n){e.flags|=1,e.directiveStart=t,e.directiveEnd=t+n,e.providerIndexes=t}function kp(e,t,n,r,i,a,o,s){let c=t[1],l=c.consts,u=Lf(c,e,n,r,no(l,o));return a&&hp(c,t,u,no(l,s),i),u.mergedAttrs=jc(u.mergedAttrs,u.attrs),u.attrs!==null&&pp(u,u.attrs,!1),u.mergedAttrs!==null&&pp(u,u.mergedAttrs,!0),c.queries!==null&&c.queries.elementStart(c,u),u}function Ap(e,t){_c(e,t),Va(t)&&e.queries.elementEnd(t)}function jp(e,t,n,r,i,a){let o=t.consts,s=Lf(t,e,n,r,no(o,i));if(s.mergedAttrs=jc(s.mergedAttrs,s.attrs),a!=null){let e=no(o,a);s.localNames=[];for(let t=0;t<e.length;t+=2)s.localNames.push(e[t],-1)}return s.attrs!==null&&pp(s,s.attrs,!1),s.mergedAttrs!==null&&pp(s,s.mergedAttrs,!0),t.queries!==null&&t.queries.elementStart(t,s),s}var Mp=typeof ShadowRoot<`u`,Np=typeof Document<`u`;function Pp(e){return Object.keys(e).map(t=>{let[n,r,i]=e[t],a={propName:n,templateName:t,isSignal:(r&jd.SignalBased)!==0};return i&&(a.transform=i),a})}function Fp(e){return Object.keys(e).map(t=>({propName:e[t],templateName:t}))}function Ip(e,t,n){let r=t instanceof wa?t:t?.injector;return r&&e.getStandaloneInjector!==null&&(r=e.getStandaloneInjector(r)||r),r?new Qf(n,r):n}function Lp(e){let t=e.get(Jf,null);if(t===null)throw new k(407,!1);return{rendererFactory:t,sanitizer:e.get(Yf,null),changeDetectionScheduler:e.get(qs,null),ngReflect:!1,tracingService:e.get(Fu,null,{optional:!0})}}function Rp(e,t,n){let r=Bp(e);return tu(t,r,r===`svg`?`svg`:r===`math`?qa:n)}function zp(e){if((e&&`localName`in e&&typeof e.localName==`string`?e.localName:e?.tagName)?.toLowerCase()===`script`)throw new k(905,!1)}function Bp(e){return(e.selectors[0][0]||`div`).toLowerCase()}var Vp=class{componentDef;ngModule;selector;componentType;ngContentSelectors;isBoundToModule;cachedInputs=null;cachedOutputs=null;get inputs(){return this.cachedInputs??=Pp(this.componentDef.inputs),this.cachedInputs}get outputs(){return this.cachedOutputs??=Fp(this.componentDef.outputs),this.cachedOutputs}constructor(e,t){this.componentDef=e,this.ngModule=t,this.componentType=e.type,this.selector=Su(e.selectors),this.ngContentSelectors=e.ngContentSelectors??[],this.isBoundToModule=!!t}create(e,t,n,r,i,a,o){hc(uc.DynamicComponentStart);let s=O(null);try{let s=this.componentDef,c=Ip(s,r||this.ngModule,e),l=Lp(c),u=l.tracingService;return u&&u.componentCreate?u.componentCreate(Xf(s),()=>this.createComponentRef(l,c,t,n,i,a,o)):this.createComponentRef(l,c,t,n,i,a,o)}finally{O(s)}}createComponentRef(e,t,n,r,i,a,o){let s=this.componentDef,c=Hp(r,s,a,i),l=e.rendererFactory.createRenderer(null,s),u=r?Id(l,r,s.encapsulation,t):Rp(s,l,o??null);zp(u);let d=t.get(fp,null),f=Up(u,()=>t.get(ds,null)??jl());d&&d.addHost(f);let p=a?.some(Gp)||i?.some(e=>typeof e!=`function`&&e.bindings.some(Gp)),m=Td(null,c,null,512|Dd(s),null,null,e,l,t,null,Bl(u,t,!0));d&&Mp&&f instanceof ShadowRoot&&lo(m,()=>{d.removeHost(f)}),m[27]=u,Go(m);let h=null;try{let e=kp(27,m,2,`#host`,()=>c.directiveRegistry,!0,0);cu(l,u,e),Tl(u,m),Pd(c,m,e),Wl(c,e,m),Ap(c,e),n!==void 0&&qp(e,this.ngContentSelectors,n),h=eo(e.index,m),m[8]=h[8],ef(c,m,null)}catch(e){throw h!==null&&Cl(h),Cl(m),e}finally{hc(uc.DynamicComponentEnd),Xo()}return new Kp(this.componentType,m,!!p)}};function Hp(e,t,n,r){let i=e?[`ng-version`,`22.1.7`]:Cu(t.selectors[0]),a=null,o=null,s=0;if(n)for(let e of n)s+=e[dp].requiredVars,e.create&&(e.targetIdx=0,(a??=[]).push(e)),e.update&&(e.targetIdx=0,(o??=[]).push(e));if(r)for(let e=0;e<r.length;e++){let t=r[e];if(typeof t!=`function`)for(let n of t.bindings){s+=n[dp].requiredVars;let t=e+1;n.create&&(n.targetIdx=t,(a??=[]).push(n)),n.update&&(n.targetIdx=t,(o??=[]).push(n))}}let c=[t];if(r)for(let e of r){let t=Ci(typeof e==`function`?e:e.type);c.push(t)}return Sd(0,null,Wp(a,o),1,s,c,null,null,null,[i],null)}function Up(e,t){let n=e.getRootNode?.();return Np&&n instanceof Document?n.head:n&&Mp&&n instanceof ShadowRoot?n:t().head}function Wp(e,t){return!e&&!t?null:n=>{if(n&1&&e)for(let t of e)t.create();if(n&2&&t)for(let e of t)e.update()}}function Gp(e){let t=e[dp].kind;return t===`input`||t===`twoWay`}var Kp=class extends qf{_rootLView;_hasInputBindings;instance;hostView;changeDetectorRef;componentType;location;previousInputValues=null;_tNode;constructor(e,t,n){super(),this._rootLView=t,this._hasInputBindings=n,this._tNode=Za(t[1],27),this.location=hl(this._tNode,t),this.instance=eo(this._tNode.index,t)[8],this.hostView=this.changeDetectorRef=new If(t,void 0),this.componentType=e}setInput(e,t){this._hasInputBindings;let n=this._tNode;if(this.previousInputValues??=new Map,this.previousInputValues.has(e)&&Object.is(this.previousInputValues.get(e),t))return;let r=this._rootLView;Zd(n,r[1],r,e,t),this.previousInputValues.set(e,t),Of(eo(n.index,r),1)}get injector(){return new al(this._tNode,this._rootLView)}destroy(){this.hostView.destroy()}onDestroy(e){this.hostView.onDestroy(e)}};function qp(e,t,n){let r=e.projection=[];for(let e=0;e<t.length;e++){let t=n[e];r.push(t!=null&&t.length?Array.from(t):null)}}var Jp=()=>!1;function Yp(e,t,n){return Jp(e,t,n)}function Xp(e){return!!e&&typeof e.then==`function`}function Zp(e){return!!e&&typeof e.subscribe==`function`}var Qp=class{},$p=class extends Qp{injector;instance=null;constructor(e){super();let t=new Ta([...e.providers,{provide:Qp,useValue:this}],e.parent||Ca(),e.debugName,new Set([`environment`]));this.injector=t,e.runEnvironmentInitializers&&t.resolveInjectorInitializers()}destroy(){this.injector.destroy()}onDestroy(e){this.injector.onDestroy(e)}};function em(e,t,n=null){return new $p({providers:e,parent:t,debugName:n,runEnvironmentInitializers:!0}).injector}var tm=(()=>{class e{_injector;cachedInjectors=new Map;constructor(e){this._injector=e}getOrCreateStandaloneInjector(e){if(!e.standalone)return null;if(!this.cachedInjectors.has(e)){let t=ua(!1,e.type),n=t.length>0?em([t],this._injector,``):null;this.cachedInjectors.set(e,n)}return this.cachedInjectors.get(e)}ngOnDestroy(){try{for(let e of this.cachedInjectors.values())e!==null&&e.destroy()}finally{this.cachedInjectors.clear()}}static ɵprov=si({token:e,providedIn:`environment`,factory:()=>new e(Ui(wa))})}return e})();function nm(e){return lc(()=>{let t=sm(e),n={...t,decls:e.decls,vars:e.vars,template:e.template,consts:e.consts||null,ngContentSelectors:e.ngContentSelectors,onPush:e.changeDetection!==vl.Eager,directiveDefs:null,pipeDefs:null,dependencies:t.standalone&&e.dependencies||null,getStandaloneInjector:t.standalone?e=>e.get(tm).getOrCreateStandaloneInjector(n):null,getExternalStyles:null,signals:e.signals??!1,data:e.data||{},encapsulation:e.encapsulation||Gl.Emulated,styles:e.styles||ia,_:null,schemas:e.schemas||null,tView:null,id:``};t.standalone&&Lu(`NgStandalone`),cm(n);let r=e.dependencies;return n.directiveDefs=lm(r,rm),n.pipeDefs=lm(r,wi),n.id=um(n),n})}function rm(e){return Si(e)||Ci(e)}function im(e,t){if(e==null)return ra;let n={};for(let r in e)if(Object.hasOwn(e,r)){let i=e[r],a,o,s,c;Array.isArray(i)?(s=i[0],a=i[1],o=i[2]??a,c=i[3]||null):(a=i,o=i,s=jd.None,c=null),n[a]=[r,s,c],t[a]=o}return n}function am(e){if(e==null)return ra;let t={};for(let n in e)Object.hasOwn(e,n)&&(t[e[n]]=n);return t}function om(e){return{type:e.type,name:e.name,factory:null,pure:e.pure!==!1,standalone:e.standalone??!0,onDestroy:e.type.prototype.ngOnDestroy||null}}function sm(e){let t={};return{type:e.type,providersResolver:null,viewProvidersResolver:null,factory:null,hostBindings:e.hostBindings||null,hostVars:e.hostVars||0,hostAttrs:e.hostAttrs||null,contentQueries:e.contentQueries||null,declaredInputs:t,inputConfig:e.inputs||ra,exportAs:e.exportAs||null,standalone:e.standalone??!0,signals:e.signals===!0,selectors:e.selectors||ia,viewQuery:e.viewQuery||null,features:e.features||null,setInput:null,resolveHostDirectives:null,hostDirectives:null,controlDef:null,signalFormsInputPresence:null,inputs:im(e.inputs,t),outputs:am(e.outputs),debugInfo:null}}function cm(e){e.features?.forEach(t=>t(e))}function lm(e,t){return e?()=>{let n=typeof e==`function`?e():e,r=[];for(let e of n){let n=t(e);n!==null&&r.push(n)}return r}:null}function um(e){let t=0,n=typeof e.consts==`function`?``:e.consts,r=[e.selectors,e.ngContentSelectors,e.hostVars,e.hostAttrs,n,e.vars,e.decls,e.encapsulation,e.standalone,e.signals,e.exportAs,JSON.stringify(e.inputs),JSON.stringify(e.outputs),Object.getOwnPropertyNames(e.type.prototype),!!e.contentQueries,!!e.viewQuery];for(let e of r.join(`|`))t=Math.imul(31,t)+e.charCodeAt(0)<<0;return t+=2147483648,`c`+t}var dm=new mi(``),fm=(()=>{class e{resolve;reject;initialized=!1;done=!1;donePromise=new Promise((e,t)=>{this.resolve=e,this.reject=t});appInits=A(dm,{optional:!0})??[];injector=A(us);constructor(){}runInitializers(){if(this.initialized)return;let e=[];for(let t of this.appInits){let n=Ia(this.injector,t);if(Xp(n))e.push(n);else if(Zp(n)){let t=new Promise((e,t)=>{n.subscribe({complete:e,error:t})});e.push(t)}}let t=()=>{this.done=!0,this.resolve()};Promise.all(e).then(()=>{t()}).catch(e=>{this.reject(e)}),e.length===0&&t(),this.initialized=!0}static ɵfac=function(t){return new(t||e)};static ɵprov=pl({token:e,factory:e.ɵfac})}return e})();function pm(e,t,n,r,i,a,o,s){if(n.firstCreatePass){e.mergedAttrs=jc(e.mergedAttrs,e.attrs);let t=e.tView=Sd(2,e,i,a,o,n.directiveRegistry,n.pipeRegistry,null,n.schemas,n.consts,null);n.queries!==null&&(n.queries.template(n,e),t.queries=n.queries.embeddedTView(e))}s&&(e.flags|=s),Do(e,!1);let c=gm(n,t,e,r);os()&&fd(n,t,c,e),Tl(c,t);let l=kf(c,t,c,e);t[r+27]=l,kd(t,l),Yp(l,e,t)}function mm(e,t,n,r,i,a,o,s,c,l,u){let d=n+27,f;if(t.firstCreatePass){if(f=Lf(t,d,4,o||null,s||null),l!=null){let e=no(t.consts,l);f.localNames=[];for(let t=0;t<e.length;t+=2)f.localNames.push(e[t],-1)}}else f=t.data[d];return pm(f,e,t,n,r,i,a,c),l!=null&&Fd(e,f,u),f}function hm(e,t,n,r,i,a,o,s){let c=M(),l=Co();return mm(c,l,e,t,n,r,i,no(l.consts,a),void 0,o,s),hm}var gm=_m;function _m(e,t,n,r){return ss(!0),t[11].createComment(``)}var vm=(function(e){return e[e.NOT_STARTED=0]=`NOT_STARTED`,e[e.IN_PROGRESS=1]=`IN_PROGRESS`,e[e.COMPLETE=2]=`COMPLETE`,e[e.FAILED=3]=`FAILED`,e})(vm||{}),ym=0,bm=1,xm=(function(e){return e[e.Placeholder=0]=`Placeholder`,e[e.Loading=1]=`Loading`,e[e.Complete=2]=`Complete`,e[e.Error=3]=`Error`,e})(xm||{}),Sm=(function(e){return e[e.Initial=-1]=`Initial`,e})(Sm||{}),Cm=0,wm=4,Tm=5,Em=6,Dm=7,Om=8,km=9,Am=(function(e){return e[e.Manual=0]=`Manual`,e[e.Playthrough=1]=`Playthrough`,e})(Am||{});function jm(e,t,n){let r=Pm(e);t[r]===null&&(t[r]=[]),t[r].push(n)}function Mm(e,t){let n=Pm(e),r=t[n];if(r!==null){for(let e of r)e();t[n]=null}}function Nm(e){Mm(1,e),Mm(0,e),Mm(2,e)}function Pm(e){let t=wm;return e===1?t=Tm:e===2&&(t=km),t}function Fm(e){return e+1}function Im(e,t){return e[1],e[Fm(t.index)]}function Lm(e,t,n){e[1];let r=Fm(t);e[r]=n}function Rm(e,t){let n=Fm(t.index);return e.data[n]}function zm(e,t,n){let r=Fm(t);e.data[r]=n}function Bm(e,t,n){let r=t[1],i=Rm(r,n);switch(e){case xm.Complete:return i.primaryTmplIndex;case xm.Loading:return i.loadingTmplIndex;case xm.Error:return i.errorTmplIndex;case xm.Placeholder:return i.placeholderTmplIndex;default:return null}}function Vm(e,t){return t===xm.Placeholder?e.placeholderBlockConfig?.[ym]??null:t===xm.Loading?e.loadingBlockConfig?.[ym]??null:null}function Hm(e){return e.loadingBlockConfig?.[bm]??null}function Um(e,t){if(!e||e.length===0)return t;let n=new Set(e);for(let e of t)n.add(e);return e.length===n.size?e:Array.from(n)}function Wm(e,t){return Za(e,t.primaryTmplIndex+27)}var Gm=(()=>{class e{cachedInjectors=new Map;getOrCreateInjector(e,t,n,r){if(!this.cachedInjectors.has(e)){let i=n.length>0?em(n,t,r):null;this.cachedInjectors.set(e,i)}return this.cachedInjectors.get(e)}ngOnDestroy(){try{for(let e of this.cachedInjectors.values())e!==null&&e.destroy()}finally{this.cachedInjectors.clear()}}static ɵprov=si({token:e,providedIn:`environment`,factory:()=>new e})}return e})(),Km=new mi(``);function qm(e,t,n){return e.get(Gm).getOrCreateInjector(t,e,n,``)}function Jm(e,t,n){if(e instanceof Qf){let r=e.injector,i=e.parentInjector;return new Qf(r,qm(i,t,n))}let r=e.get(wa);return r===e?qm(e,t,n):new Qf(e,qm(r,t,n))}function Ym(e,t,n,r=!1){let i=n[3],a=i[1];if(Ka(i))return;let o=Im(i,t),s=o[1],c=o[Dm];if(!(c!==null&&e<c)&&Qm(s,e)&&Qm(o[Cm]??-1,e)){let s=Rm(a,t),c=!r&&(Hm(s)!==null||Vm(s,xm.Loading)!==null||Vm(s,xm.Placeholder))?th:Zm;try{c(e,o,n,t,i)}catch(e){Xd(i,e)}}}function Xm(e,t){let n=e[6]?.findIndex(e=>e.data.s===t[1])??-1;return{dehydratedView:n>-1?e[6][n]:null,dehydratedViewIx:n}}function Zm(e,t,n,r,i){hc(uc.DeferBlockStateStart);let a=Bm(e,i,r);if(a!==null){t[1]=e;let o=i[1],s=Za(o,a+27);Mf(n,0);let c;if(e===xm.Complete){let e=Rm(o,r),t=e.providers;t&&t.length>0&&(c=Jm(i[9],e,t))}let{dehydratedView:l,dehydratedViewIx:u}=Xm(n,t),d=nf(i,s,null,{injector:c,dehydratedView:l});if(jf(n,d,0,rf(s,l)),io(d),u>-1&&n[6]?.splice(u,1),(e===xm.Complete||e===xm.Error)&&Array.isArray(t[Om])){for(let e of t[Om])e();t[Om]=null}}hc(uc.DeferBlockStateEnd)}function Qm(e,t){return e<t}function $m(e,t){let n=e[t.index];Ym(xm.Placeholder,t,n)}function eh(e,t,n){e.loadingPromise.then(()=>{e.loadingState===vm.COMPLETE?Ym(xm.Complete,t,n):e.loadingState===vm.FAILED&&Ym(xm.Error,t,n)})}var th=null;function nh(e,t){return t[9].get(Km,null,{optional:!0})?.behavior!==Am.Manual}var rh=new mi(``),ih=new mi(``);function ah(){In(()=>{throw new k(600,``)})}var oh=10,sh=(()=>{class e{_runningTick=!1;_destroyed=!1;_destroyListeners=[];_views=[];internalErrorHandler=A(Ls);afterRenderManager=A(Ru);zonelessEnabled=A(Js);rootEffectScheduler=A(Xs);dirtyFlags=0;tracingSnapshot=null;allTestViews=new Set;autoDetectTestViews=new Set;includeAllTestViews=!1;afterTick=new qr;get allViews(){return[...(this.includeAllTestViews?this.allTestViews:this.autoDetectTestViews).keys(),...this._views]}get destroyed(){return this._destroyed}componentTypes=[];components=[];internalPendingTask=A(gs);get isStable(){return this.internalPendingTask.hasPendingTasksObservable.pipe(Xr(e=>!e))}constructor(){A(Fu,{optional:!0})}whenStable(){let e;return new Promise(t=>{e=this.isStable.subscribe({next:e=>{e&&t()}})}).finally(()=>{e.unsubscribe()})}_injector=A(wa);_rendererFactory=null;get injector(){return this._injector}bootstrap(e,t){return this.bootstrapImpl(e,t)}bootstrapImpl(e,t,n=us.NULL){return this._injector.get(ws).run(()=>{if(hc(uc.BootstrapComponentStart),!this._injector.get(fm).done)throw new k(405,``);let r=Si(e),i=this._injector.get(Qp),a=new Vp(r,i);this.componentTypes.push(e);let{hostElement:o,directives:s,bindings:c}=ch(t),l=o||a.selector,u=a.create(n,[],l,i.injector,s,c),d=u.location.nativeElement,f=u.injector.get(rh,null);return f?.registerApplication(d),u.onDestroy(()=>{this.detachView(u.hostView),lh(this.components,u),f?.unregisterApplication(d)}),this._loadComponent(u),hc(uc.BootstrapComponentEnd,u),u})}tick(){this.zonelessEnabled||(this.dirtyFlags|=1),this._tick()}_tick(){hc(uc.ChangeDetectionStart),this.tracingSnapshot===null?this.tickImpl():this.tracingSnapshot.run(Pu.CHANGE_DETECTION,this.tickImpl)}tickImpl=()=>{if(this._runningTick)throw hc(uc.ChangeDetectionEnd),new k(101,!1);let e=O(null);try{this._runningTick=!0,this.synchronize()}finally{this._runningTick=!1,this.tracingSnapshot?.dispose(),this.tracingSnapshot=null,O(e),this.afterTick.next(),hc(uc.ChangeDetectionEnd)}};synchronize(){this._rendererFactory===null&&!this._injector.destroyed&&(this._rendererFactory=this._injector.get(Jf,null,{optional:!0}));let e=0;for(;this.dirtyFlags!==0&&e++<oh;){hc(uc.ChangeDetectionSyncStart);try{this.synchronizeOnce()}finally{hc(uc.ChangeDetectionSyncEnd)}}}synchronizeOnce(){this.dirtyFlags&16&&(this.dirtyFlags&=-17,this.rootEffectScheduler.flush());let e=!1;if(this.dirtyFlags&7){let t=!!(this.dirtyFlags&1);this.dirtyFlags&=-8,this.dirtyFlags|=8;for(let{_lView:n}of this.allViews)(t||oo(n))&&(vf(n,t&&!this.zonelessEnabled?0:1),e=!0);if(this.dirtyFlags&=-5,this.syncDirtyFlagsWithViews(),this.dirtyFlags&23)return}e||(this._rendererFactory?.begin?.(),this._rendererFactory?.end?.()),this.dirtyFlags&8&&(this.dirtyFlags&=-9,this.afterRenderManager.execute()),this.syncDirtyFlagsWithViews()}syncDirtyFlagsWithViews(){if(this.allViews.some(({_lView:e})=>oo(e))){this.dirtyFlags|=2;return}this.dirtyFlags&=-8}attachView(e){let t=e;this._views.push(t),t.attachToAppRef(this)}detachView(e){let t=e;lh(this._views,t),t.detachFromAppRef()}_loadComponent(e){this.attachView(e.hostView);try{this.tick()}catch(e){this.internalErrorHandler(e)}this.components.push(e),this._injector.get(ih,[]).forEach(t=>t(e))}ngOnDestroy(){if(!this._destroyed)try{this._destroyListeners.forEach(e=>e()),this._views.slice().forEach(e=>e.destroy())}finally{this._destroyed=!0,this._views=[],this._destroyListeners=[]}}onDestroy(e){return this._destroyListeners.push(e),()=>lh(this._destroyListeners,e)}destroy(){if(this._destroyed)throw new k(406,!1);let e=this._injector;e.destroy&&!e.destroyed&&e.destroy()}get viewCount(){return this._views.length}static ɵfac=function(t){return new(t||e)};static ɵprov=pl({token:e,factory:e.ɵfac})}return e})();function ch(e){return e===void 0||typeof e==`string`||e instanceof Element?{hostElement:e}:e}function lh(e,t){let n=e.indexOf(t);n>-1&&e.splice(n,1)}function uh(e,t,n){let r=t.get(fh);return r.add(e,n),()=>r.remove(e)}function dh(e){return(t,n)=>uh(t,n,e)}var fh=(()=>{class e{buckets=new Map;callbackBucket=new Map;applicationRef=A(sh);ngZone=A(ws);idleService=A(dl);add(e,t){let n=ph(t);this.callbackBucket.set(e,n);let r=this.buckets.get(n);r??(r={idleId:null,queue:new Set},this.buckets.set(n,r)),r.queue.add(e),this.scheduleBucket(r,t)}remove(e){let t=this.callbackBucket.get(e);if(t===void 0)return;this.callbackBucket.delete(e);let n=this.buckets.get(t);n&&(n.queue.delete(e),n.queue.size===0&&(this.cancelBucket(n),this.buckets.delete(t)))}scheduleBucket(e,t){if(e.idleId!==null)return;let n=ph(t),r=r=>{for(let t of e.queue)if(t(),this.applicationRef._tick(),e.queue.delete(t),this.callbackBucket.delete(t),r&&r.timeRemaining()===0&&!r.didTimeout)break;e.idleId=null,e.queue.size>0?this.scheduleBucket(e,t):this.buckets.delete(n)};e.idleId=this.idleService.requestOnIdle(e=>this.ngZone.run(()=>r(e)),t)}cancelBucket(e){e.idleId!==null&&(this.idleService.cancelOnIdle(e.idleId),e.idleId=null)}ngOnDestroy(){for(let e of this.buckets.values())this.cancelBucket(e);this.buckets.clear(),this.callbackBucket.clear()}static ɵprov=si({token:e,providedIn:`root`,factory:()=>new e})}return e})();function ph(e){return!e||e.timeout==null?``:`${e.timeout}`}function mh(e){let t=M(),n=wo();if($m(t,n),!nh(0,t))return;let r=t[9];jm(0,Im(t,n),e(()=>gh(0,t,n),r))}function hh(e,t,n){let r=t[9],i=t[1];if(e.loadingState!==vm.NOT_STARTED)return e.loadingPromise??Promise.resolve();let a=Im(t,n),o=Wm(i,e);e.loadingState=vm.IN_PROGRESS,Mm(1,a);let s=e.dependencyResolverFn,c=r.get(oc).add();return s?(e.loadingPromise=Promise.allSettled(s()).then(n=>{let r=!1,i=[],a=[];for(let e=0;e<n.length;e++){let t=n[e];if(t.status===`fulfilled`){let e=t.value,n=Si(e)||Ci(e);if(n)i.push(n);else{let t=wi(e);t&&a.push(t)}}else{r=!0,t.reason instanceof Error?t.reason:Error(String(t.reason));break}}if(r)e.loadingState=vm.FAILED,e.errorTmplIndex===null&&Xd(t,new k(-750,``));else{e.loadingState=vm.COMPLETE;let t=o.tView;i.length>0&&(t.directiveRegistry=Um(t.directiveRegistry,i),e.providers=ua(!1,...i.map(e=>e.type))),a.length>0&&(t.pipeRegistry=Um(t.pipeRegistry,a))}}),e.loadingPromise.finally(()=>{e.loadingPromise=null,c()})):(e.loadingPromise=Promise.resolve().then(()=>{e.loadingPromise=null,e.loadingState=vm.COMPLETE,c()}),e.loadingPromise)}function gh(e,t,n){let r=t[1],i=t[n.index];if(!nh(e,t))return;let a=Im(t,n),o=Rm(r,n);switch(Nm(a),o.loadingState){case vm.NOT_STARTED:Ym(xm.Loading,n,i),hh(o,t,n),o.loadingState===vm.IN_PROGRESS&&eh(o,n,i);break;case vm.IN_PROGRESS:Ym(xm.Loading,n,i),eh(o,n,i);break;case vm.COMPLETE:Ym(xm.Complete,n,i);break;case vm.FAILED:Ym(xm.Error,n,i)}}function _h(e,t,n){return e===0?yh(t,n):e!==2||!yh(t,n)}function vh(e){return e!=null&&(e&1)==1}function yh(e,t){let n=e[9],r=Rm(e[1],t),i=Vl(n),a=vh(r.flags),o=Im(e,t)[Em]!==null;return!(a&&o&&i)}function bh(e,t,n,r,i,a,o,s,c,l){let u=M(),d=Co(),f=e+27,p=mm(u,d,e,null,0,0),m=u[9],h=Vl(m);if(d.firstCreatePass){Lu(`NgDefer`);let e={primaryTmplIndex:t,loadingTmplIndex:r??null,placeholderTmplIndex:i??null,errorTmplIndex:a??null,placeholderBlockConfig:null,loadingBlockConfig:null,dependencyResolverFn:n??null,loadingState:vm.NOT_STARTED,loadingPromise:null,providers:null,hydrateTriggers:null,debug:null,flags:l??0};c?.(d,e,s,o),zm(d,f,e)}let g=u[f];Yp(g,p,u);let _=null,v=null;if(g[6]?.length>0){let e=g[6][0].data;v=e.di??null,_=e.s}let y=[null,Sm.Initial,null,null,null,null,v,_,null,null];Lm(u,f,y);let b=null;v!==null&&h&&(b=m.get(Ll),b.add(v,{lView:u,tNode:p,lContainer:g}));let ee=()=>{Nm(y),v!==null&&b?.cleanup([v])};jm(0,y,()=>uo(u,ee)),lo(u,ee)}function xh(e){_h(0,M(),wo())&&mh(dh({timeout:e}))}function L(e,t,n,r){let i=M();return tp(i,Fo(),t)&&(Co(),Gd(es(),i,e,t,n,r)),L}var Sh=class{destroy(e){}updateValue(e,t){}swap(e,t){let n=Math.min(e,t),r=Math.max(e,t),i=this.detach(r);if(r-n>1){let e=this.detach(n);this.attach(n,i),this.attach(r,e)}else this.attach(n,i)}move(e,t){this.attach(t,this.detach(e))}};function Ch(e,t,n,r,i){return e===n&&Object.is(t,r)?1:Object.is(i(e,t),i(n,r))?-1:0}function wh(e,t,n,r){let i,a,o=0,s=e.length-1;if(Array.isArray(t)){O(r);let c=t.length-1;for(O(null);o<=s&&o<=c;){let r=e.at(o),l=t[o],u=Ch(o,r,o,l,n);if(u!==0){u<0&&e.updateValue(o,l),o++;continue}let d=e.at(s),f=t[c],p=Ch(s,d,c,f,n);if(p!==0){p<0&&e.updateValue(s,f),s--,c--;continue}let m=n(o,r),h=n(s,d),g=n(o,l);if(Object.is(g,h)){let t=n(c,f);Object.is(t,m)?(e.swap(o,s),e.updateValue(s,f),c--,s--):e.move(s,o),e.updateValue(o,l),o++;continue}if(i??=new Oh,a??=Dh(e,o,s,n),Th(e,i,o,g))e.updateValue(o,l),o++,s++;else if(a.has(g))i.set(m,e.detach(o)),s--;else{let n=e.create(o,t[o]);e.attach(o,n),o++,s++}}for(;o<=c;)Eh(e,i,n,o,t[o]),o++}else if(t!=null){O(r);let c=t[Symbol.iterator]();O(null);let l=c.next();for(;!l.done&&o<=s;){let t=e.at(o),r=l.value,u=Ch(o,t,o,r,n);if(u!==0)u<0&&e.updateValue(o,r),o++,l=c.next();else{i??=new Oh,a??=Dh(e,o,s,n);let u=n(o,r);if(Th(e,i,o,u))e.updateValue(o,r),o++,s++,l=c.next();else if(!a.has(u))e.attach(o,e.create(o,r)),o++,s++,l=c.next();else{let r=n(o,t);i.set(r,e.detach(o)),s--}}}for(;!l.done;)Eh(e,i,n,e.length,l.value),l=c.next()}for(;o<=s;)e.destroy(e.detach(s--));i?.forEach(t=>{e.destroy(t)})}function Th(e,t,n,r){return t!==void 0&&t.has(r)?(e.attach(n,t.get(r)),t.delete(r),!0):!1}function Eh(e,t,n,r,i){if(Th(e,t,r,n(r,i)))e.updateValue(r,i);else{let t=e.create(r,i);e.attach(r,t)}}function Dh(e,t,n,r){let i=new Set;for(let a=t;a<=n;a++)i.add(r(a,e.at(a)));return i}var Oh=class{kvMap=new Map;_vMap=void 0;has(e){return this.kvMap.has(e)}delete(e){if(!this.has(e))return!1;let t=this.kvMap.get(e);return this._vMap!==void 0&&this._vMap.has(t)?(this.kvMap.set(e,this._vMap.get(t)),this._vMap.delete(t)):this.kvMap.delete(e),!0}get(e){return this.kvMap.get(e)}set(e,t){if(this.kvMap.has(e)){let n=this.kvMap.get(e);this._vMap===void 0&&(this._vMap=new Map);let r=this._vMap;for(;r.has(n);)n=r.get(n);r.set(n,t)}else this.kvMap.set(e,t)}forEach(e){for(let[t,n]of this.kvMap)if(e(n,t),this._vMap!==void 0){let r=this._vMap;for(;r.has(n);)n=r.get(n),e(n,t)}}};function R(e,t,n,r,i,a,o,s){Lu(`NgControlFlow`);let c=M(),l=Co();return mm(c,l,e,t,n,r,i,no(l.consts,a),256,o,s),kh}function kh(e,t,n,r,i,a,o,s){Lu(`NgControlFlow`);let c=M(),l=Co();return mm(c,l,e,t,n,r,i,no(l.consts,a),512,o,s),kh}function z(e,t){Lu(`NgControlFlow`);let n=M(),r=Fo(),i=n[r]===wu?-1:n[r],a=i===-1?void 0:Fh(n,27+i);if(tp(n,r,e)){let r=O(null);try{if(a!==void 0&&Mf(a,0),e!==-1){let r=27+e,i=Fh(n,r),a=Bh(n[1],r),o=Kf(i,a,n);jf(i,nf(n,a,t,{dehydratedView:o}),0,rf(a,o))}}finally{O(r)}}else if(a!==void 0){let e=Af(a,0);e!==void 0&&(e[8]=t)}}var Ah=class{lContainer;$implicit;$index;constructor(e,t,n){this.lContainer=e,this.$implicit=t,this.$index=n}get $count(){return this.lContainer.length-10}};function jh(e){return e}function Mh(e,t){return t}var Nh=class{hasEmptyBlock;trackByFn;liveCollection;constructor(e,t,n){this.hasEmptyBlock=e,this.trackByFn=t,this.liveCollection=n}};function B(e,t,n,r,i,a,o,s,c,l,u,d,f){Lu(`NgControlFlow`);let p=M(),m=Co(),h=c!==void 0,g=M(),_=new Nh(h,s?o.bind(g[15][8]):o);g[27+e]=_,mm(p,m,e+1,t,n,r,i,no(m.consts,a),256),h&&mm(p,m,e+2,c,l,u,d,no(m.consts,f),512)}var Ph=class extends Sh{lContainer;hostLView;templateTNode;operationsCounter=void 0;needsIndexUpdate=!1;constructor(e,t,n){super(),this.lContainer=e,this.hostLView=t,this.templateTNode=n}get length(){return this.lContainer.length-10}at(e){return this.getLView(e)[8].$implicit}attach(e,t){let n=t[6];this.needsIndexUpdate||=e!==this.length,jf(this.lContainer,t,e,rf(this.templateTNode,n)),Ih(this.lContainer,e)}detach(e){return this.needsIndexUpdate||=e!==this.length-1,Lh(this.lContainer,e),Rh(this.lContainer,e)}create(e,t){let n=Gf(this.lContainer,this.templateTNode.tView.ssrId);return nf(this.hostLView,this.templateTNode,new Ah(this.lContainer,t,e),{dehydratedView:n})}destroy(e){rd(e[1],e)}updateValue(e,t){this.getLView(e)[8].$implicit=t}reset(){this.needsIndexUpdate=!1}updateIndexes(){if(this.needsIndexUpdate)for(let e=0;e<this.length;e++)this.getLView(e)[8].$index=e}getLView(e){return zh(this.lContainer,e)}};function V(e){let t=O(null),n=Qo();try{let r=M(),i=r[1],a=r[n],o=n+1,s=Fh(r,o);a.liveCollection===void 0?a.liveCollection=new Ph(s,r,Bh(i,o)):a.liveCollection.reset();let c=a.liveCollection;if(wh(c,e,a.trackByFn,t),c.updateIndexes(),a.hasEmptyBlock){let e=Fo(),t=c.length===0;if(tp(r,e,t)){let e=n+2,a=Fh(r,e);if(t){let t=Bh(i,e),n=Kf(a,t,r);jf(a,nf(r,t,void 0,{dehydratedView:n}),0,rf(t,n))}else i.firstUpdatePass&&Vf(a),Mf(a,0)}}}finally{O(t)}}function Fh(e,t){return e[t]}function Ih(e,t){if(e.length<=10)return;let n=e[10+t],r=n?n[26]:void 0;if(n&&r&&r.detachedLeaveAnimationFns&&r.detachedLeaveAnimationFns.length>0){let e=n[9];Hu(e,r),Ou.delete(n[19]),r.detachedLeaveAnimationFns=void 0}}function Lh(e,t){if(e.length<=10)return;let n=e[10+t],r=n?n[26]:void 0;r&&r.leave&&r.leave.size>0&&(r.detachedLeaveAnimationFns=[])}function Rh(e,t){return Nf(e,t)}function zh(e,t){return Af(e,t)}function Bh(e,t){return Za(e,t)}function Vh(e,t,n){let r=M();return tp(r,Fo(),t)&&(Co(),Rd(es(),r,e,t,r[11],n)),Vh}function Hh(e,t,n,r,i){Zd(t,e,n,i?`class`:`style`,r)}function H(e,t,n,r){let i=M(),a=i[1],o=e+27,s=a.firstCreatePass?kp(o,i,2,t,Wd,yo(),n,r):a.data[o];if(Ha(s)){let n=i[10].tracingService;if(n&&n.componentCreate){let o=a.data[s.directiveStart+s.componentOffset];return n.componentCreate(Xf(o),()=>(Uh(e,t,i,s,r),H))}}return Uh(e,t,i,s,r),H}function Uh(e,t,n,r,i){if(Jd(r,n,e,t,Kh),Ua(r)){let e=n[1];Pd(e,n,r),Wl(e,r,n)}i!=null&&Fd(n,r)}function U(){let e=Co(),t=Yd(wo());return e.firstCreatePass&&Ap(e,t),xo(t)&&So(),vo(),t.classesWithoutHost!=null&&Ec(t)&&Hh(e,t,M(),t.classesWithoutHost,!0),t.stylesWithoutHost!=null&&Dc(t)&&Hh(e,t,M(),t.stylesWithoutHost,!1),U}function Wh(e,t,n,r){return H(e,t,n,r),U(),Wh}function W(e,t,n,r){let i=M(),a=i[1],o=e+27,s=a.firstCreatePass?jp(o,a,2,t,n,r):a.data[o];return Jd(s,i,e,t,Kh),r!=null&&Fd(i,s),W}function G(){return xo(Yd(wo()))&&So(),vo(),G}function Gh(e,t,n,r){return W(e,t,n,r),G(),Gh}var Kh=(e,t,n,r,i)=>(ss(!0),tu(t[11],r,is()));function qh(){let e=Co(),t=Yd(wo());return e.firstCreatePass&&Ap(e,t),qh}function Jh(e,t,n){let r=M(),i=r[1],a=e+27,o=i.firstCreatePass?jp(a,i,8,`ng-container`,t,n):i.data[a];return Jd(o,r,e,`ng-container`,Zh),n!=null&&Fd(r,o),Jh}function Yh(){return Yd(wo()),qh}function Xh(e,t,n){return Jh(e,t,n),Yh(),Xh}var Zh=(e,t,n,r,i)=>(ss(!0),eu(t[11],``));function K(){return M()}function q(e,t,n){let r=M();return tp(r,Fo(),t)&&(Co(),zd(es(),r,e,t,r[11],n)),q}var Qh=void 0;function $h(e){let t=Math.floor(Math.abs(e)),n=e.toString().replace(/^[^.]*\.?/,``).length;return t===1&&n===0?1:5}var eg=[`en`,[[`a`,`p`],[`AM`,`PM`]],[[`AM`,`PM`]],[[`S`,`M`,`T`,`W`,`T`,`F`,`S`],[`Sun`,`Mon`,`Tue`,`Wed`,`Thu`,`Fri`,`Sat`],[`Sunday`,`Monday`,`Tuesday`,`Wednesday`,`Thursday`,`Friday`,`Saturday`],[`Su`,`Mo`,`Tu`,`We`,`Th`,`Fr`,`Sa`]],Qh,[[`J`,`F`,`M`,`A`,`M`,`J`,`J`,`A`,`S`,`O`,`N`,`D`],[`Jan`,`Feb`,`Mar`,`Apr`,`May`,`Jun`,`Jul`,`Aug`,`Sep`,`Oct`,`Nov`,`Dec`],[`January`,`February`,`March`,`April`,`May`,`June`,`July`,`August`,`September`,`October`,`November`,`December`]],Qh,[[`B`,`A`],[`BC`,`AD`],[`Before Christ`,`Anno Domini`]],0,[6,0],[`M/d/yy`,`MMM d, y`,`MMMM d, y`,`EEEE, MMMM d, y`],[`h:mm a`,`h:mm:ss a`,`h:mm:ss a z`,`h:mm:ss a zzzz`],[`{1}, {0}`,Qh,Qh,Qh],[`.`,`,`,`;`,`%`,`+`,`-`,`E`,`×`,`‰`,`∞`,`NaN`,`:`],[`#,##0.###`,`#,##0%`,`¤#,##0.00`,`#E0`],`USD`,`$`,`US Dollar`,{},`ltr`,$h],tg=Object.create(null);function ng(e){let t=ag(e),n=rg(t);if(n)return n;let r=t.split(`-`)[0];if(n=rg(r),n)return n;if(r===`en`)return eg;throw new k(701,!1)}function rg(e){if(!(e in tg)){let t=Ri.ng&&Ri.ng.common&&Ri.ng.common.locales&&Ri.ng.common.locales[e];return t!==void 0&&(tg[e]=t),t}return tg[e]}var ig={LocaleId:0,DayPeriodsFormat:1,DayPeriodsStandalone:2,DaysFormat:3,DaysStandalone:4,MonthsFormat:5,MonthsStandalone:6,Eras:7,FirstDayOfWeek:8,WeekendRange:9,DateFormat:10,TimeFormat:11,DateTimeFormat:12,NumberSymbols:13,NumberFormats:14,CurrencyCode:15,CurrencySymbol:16,CurrencyName:17,Currencies:18,Directionality:19,PluralCase:20,ExtraData:21};function ag(e){return e.toLowerCase().replace(/_/g,`-`)}var og=`en-US`;function sg(e){typeof e==`string`&&e.toLowerCase().replace(/_/g,`-`)}function cg(e,t,n){let r=M(),i=Co(),a=wo();return lg(i,r,r[11],a,e,t,n),cg}function J(e,t,n){let r=M(),i=Co(),a=wo();return(a.type&3||n)&&op(a,i,r,n,r[11],e,t,ip(a,r,t)),J}function lg(e,t,n,r,i,a,o){let s=!0,c=null;if((r.type&3||o)&&(c??=ip(r,t,a),op(r,e,t,o,n,i,a,c)&&(s=!1)),s){let e=r.outputs?.[i],n=r.hostDirectiveOutputs?.[i];if(n&&n.length)for(let e=0;e<n.length;e+=2){let o=n[e],s=n[e+1];c??=ip(r,t,a),up(r,t,o,s,i,c)}if(e&&e.length)for(let n of e)c??=ip(r,t,a),up(r,t,n,i,i,c)}}function Y(e=1){return Zo(e)}function ug(e,t){return e<<17|t<<2}function dg(e){return e>>17&32767}function fg(e){return(e&2)==2}function pg(e,t){return e&131071|t<<17}function mg(e){return e|2}function hg(e){return(e&131068)>>2}function gg(e,t){return e&-131069|t<<2}function _g(e){return(e&1)==1}function vg(e){return e|1}function yg(e,t,n,r,i,a){let o=a?t.classBindings:t.styleBindings,s=dg(o),c=hg(o);e[r]=n;let l=!1,u;if(Array.isArray(n)){let e=n;u=e[1],(u===null||ta(e,u)>0)&&(l=!0)}else u=n;if(i){if(c!==0){let t=dg(e[s+1]);e[r+1]=ug(t,s),t!==0&&(e[t+1]=gg(e[t+1],r)),e[s+1]=pg(e[s+1],r)}else e[r+1]=ug(s,0),s!==0&&(e[s+1]=gg(e[s+1],r)),s=r}else e[r+1]=ug(c,0),s===0?s=r:e[c+1]=gg(e[c+1],r),c=r;l&&(e[r+1]=mg(e[r+1])),xg(e,u,r,!0),xg(e,u,r,!1),bg(t,u,e,r,a),o=ug(s,c),a?t.classBindings=o:t.styleBindings=o}function bg(e,t,n,r,i){let a=i?e.residualClasses:e.residualStyles;a!=null&&typeof t==`string`&&ta(a,t)>=0&&(n[r+1]=vg(n[r+1]))}function xg(e,t,n,r){let i=e[n+1],a=t===null,o=r?dg(i):hg(i),s=!1;for(;o!==0&&(s===!1||a);){let n=e[o],i=e[o+1];Sg(n,t)&&(s=!0,e[o+1]=r?vg(i):mg(i)),o=r?dg(i):hg(i)}s&&(e[n+1]=r?mg(i):vg(i))}function Sg(e,t){return e===null||t==null||(Array.isArray(e)?e[1]:e)===t?!0:Array.isArray(e)&&typeof t==`string`?ta(e,t)>=0:!1}var Cg={textEnd:0,key:0,keyEnd:0,value:0,valueEnd:0};function wg(e){return e.substring(Cg.key,Cg.keyEnd)}function Tg(e){return Dg(e),Eg(e,Og(e,0,Cg.textEnd))}function Eg(e,t){let n=Cg.textEnd;return n===t?-1:(t=Cg.keyEnd=kg(e,Cg.key=t,n),Og(e,t,n))}function Dg(e){Cg.key=0,Cg.keyEnd=0,Cg.value=0,Cg.valueEnd=0,Cg.textEnd=e.length}function Og(e,t,n){for(;t<n&&e.charCodeAt(t)<=32;)t++;return t}function kg(e,t,n){for(;t<n&&e.charCodeAt(t)>32;)t++;return t}function Ag(e,t,n){return Pg(e,t,n,!1),Ag}function jg(e,t){return Pg(e,t,null,!0),jg}function Mg(e){Fg(Gg,Ng,e,!0)}function Ng(e,t){for(let n=Tg(t);n>=0;n=Eg(t,n))$i(e,wg(t),!0)}function Pg(e,t,n,r){let i=M(),a=Co(),o=Io(2);if(a.firstUpdatePass&&Lg(a,e,o,r),t!==wu&&tp(i,o,t)){let s=a.data[Qo()];qg(a,s,i,i[11],e,i[o+1]=Xg(t,n),r,o)}}function Fg(e,t,n,r){let i=Co(),a=Io(2);i.firstUpdatePass&&Lg(i,null,a,r);let o=M();if(n!==wu&&tp(o,a,n)){let s=i.data[Qo()];if(Zg(s,r)&&!Ig(i,a)){let e=r?s.classesWithoutHost:s.stylesWithoutHost;e!==null&&(n=ni(e,n||``)),Hh(i,s,o,n,r)}else Kg(i,s,o,o[11],o[a+1],o[a+1]=Wg(e,t,n),r,a)}}function Ig(e,t){return t>=e.expandoStartIndex}function Lg(e,t,n,r){let i=e.data;if(i[n+1]===null){let a=i[Qo()],o=Ig(e,n);Zg(a,r)&&t===null&&!o&&(t=!1),t=Rg(i,a,t,r),yg(i,a,t,n,o,r)}}function Rg(e,t,n,r){let i=Vo(e),a=r?t.residualClasses:t.residualStyles;if(i===null)(r?t.classBindings:t.styleBindings)===0&&(n=Hg(null,e,t,n,r),n=Ug(n,t.attrs,r),a=null);else{let o=t.directiveStylingLast;if(o===-1||e[o]!==i){if(n=Hg(i,e,t,n,r),a===null){let n=zg(e,t,r);n!==void 0&&Array.isArray(n)&&(n=Hg(null,e,t,n[1],r),n=Ug(n,t.attrs,r),Bg(e,t,r,n))}else a=Vg(e,t,r)}}return a!==void 0&&(r?t.residualClasses=a:t.residualStyles=a),n}function zg(e,t,n){let r=n?t.classBindings:t.styleBindings;if(hg(r)!==0)return e[dg(r)]}function Bg(e,t,n,r){let i=n?t.classBindings:t.styleBindings;e[dg(i)]=r}function Vg(e,t,n){let r,i=t.directiveEnd;for(let a=1+t.directiveStylingLast;a<i;a++){let t=e[a].hostAttrs;r=Ug(r,t,n)}return Ug(r,t.attrs,n)}function Hg(e,t,n,r,i){let a=null,o=n.directiveEnd,s=n.directiveStylingLast;for(s===-1?s=n.directiveStart:s++;s<o&&(a=t[s],r=Ug(r,a.hostAttrs,i),a!==e);)s++;return e!==null&&(n.directiveStylingLast=s),r}function Ug(e,t,n){let r=n?1:2,i=-1;if(t!==null)for(let a=0;a<t.length;a++){let o=t[a];typeof o==`number`?i=o:i===r&&(Array.isArray(e)||(e=e===void 0?[]:[``,e]),$i(e,o,n?!0:t[++a]))}return e===void 0?null:e}function Wg(e,t,n){if(n==null||n===``)return ia;let r=[],i=ql(n);if(Array.isArray(i))for(let t=0;t<i.length;t++)e(r,i[t],!0);else if(i instanceof Set)for(let t of i)e(r,t,!0);else if(typeof i==`object`)for(let t in i)Object.hasOwn(i,t)&&e(r,t,i[t]);else typeof i==`string`&&t(r,i);return r}function Gg(e,t,n){let r=String(t);r!==``&&!r.includes(` `)&&$i(e,r,n)}function Kg(e,t,n,r,i,a,o,s){i===wu&&(i=ia);let c=0,l=0,u=0<i.length?i[0]:null,d=0<a.length?a[0]:null;for(;u!==null||d!==null;){let f=c<i.length?i[c+1]:void 0,p=l<a.length?a[l+1]:void 0,m=null,h;u===d?(c+=2,l+=2,f!==p&&(m=d,h=p)):d===null||u!==null&&u<d?(c+=2,m=u):(l+=2,m=d,h=p),m!==null&&qg(e,t,n,r,m,h,o,s),u=c<i.length?i[c]:null,d=l<a.length?a[l]:null}}function qg(e,t,n,r,i,a,o,s){if(!(t.type&3))return;let c=e.data,l=c[s+1];Yg(_g(l)?Jg(c,t,n,i,hg(l),o):void 0)||(Yg(a)||fg(l)&&(a=Jg(c,null,n,i,s,o)),xd(r,o,Ya(Qo(),n),i,a))}function Jg(e,t,n,r,i,a){let o=t===null,s;for(;i>0;){let t=e[i],a=Array.isArray(t),c=a?t[1]:t,l=c===null,u=n[i+1];u===wu&&(u=l?ia:void 0);let d=l?ea(u,r):c===r?u:void 0;if(a&&!Yg(d)&&(d=ea(t,r)),Yg(d)&&(s=d,o))return s;let f=e[i+1];i=o?dg(f):hg(f)}if(t!==null){let e=a?t.residualClasses:t.residualStyles;e!=null&&(s=ea(e,r))}return s}function Yg(e){return e!==void 0}function Xg(e,t){return e==null||e===``||(typeof t==`string`?e=ql(e)+t:typeof e==`object`&&(e=ti(ql(e)))),e}function Zg(e,t){return!!(e.flags&(t?8:16))}function X(e,t=``){let n=M(),r=Co(),i=e+27,a=r.firstCreatePass?Lf(r,i,1,t,null):r.data[i],o=Qg(r,n,a,t);n[i]=o,os()&&fd(r,n,o,a),Do(a,!1)}var Qg=(e,t,n,r)=>(ss(!0),Ql(t[11],r));function $g(e,t,n,r=``){return tp(e,Fo(),n)?t+Ei(n)+r:wu}function e_(e,t,n,r,i,a=``){let o=np(e,No(),n,i);return Io(2),o?t+Ei(n)+r+Ei(i)+a:wu}function t_(e,t,n,r,i,a,o,s=``){let c=rp(e,No(),n,i,o);return Io(3),c?t+Ei(n)+r+Ei(i)+a+Ei(o)+s:wu}function Z(e){return Q(``,e),Z}function Q(e,t,n){let r=M(),i=$g(r,e,t,n);return i!==wu&&i_(r,Qo(),i),Q}function n_(e,t,n,r,i){let a=M(),o=e_(a,e,t,n,r,i);return o!==wu&&i_(a,Qo(),o),n_}function r_(e,t,n,r,i,a,o){let s=M(),c=t_(s,e,t,n,r,i,a,o);return c!==wu&&i_(s,Qo(),c),r_}function i_(e,t,n){let r=Ya(t,e);$l(e[11],r,n)}function a_(e,t){let n=Mo()+e,r=M();return r[n]===wu?$f(r,n,t()):ep(r,n)}function o_(e,t,n,r){return l_(M(),Mo(),e,t,n,r)}function s_(e,t){let n=e[t];return n===wu?void 0:n}function c_(e,t,n,r,i,a){let o=t+n;return tp(e,o,i)?$f(e,o+1,a?r.call(a,i):r(i)):s_(e,o+1)}function l_(e,t,n,r,i,a,o){let s=t+n;return np(e,s,i,a)?$f(e,s+2,o?r.call(o,i,a):r(i,a)):s_(e,s+2)}function u_(e,t){let n=Co(),r,i=e+27;n.firstCreatePass?(r=d_(t,n.pipeRegistry),n.data[i]=r,r.onDestroy&&(n.destroyHooks??=[]).push(i,r.onDestroy)):r=n.data[i];let a=r.factory||(r.factory=Ji(r.type,!0)),o=Ii(mp);try{let e=Rc(!1),t=a();return Rc(e),$a(n,M(),i,t),t}finally{Ii(o)}}function d_(e,t){if(t)for(let n=t.length-1;n>=0;n--){let r=t[n];if(e===r.name)return r}}function f_(e,t,n){let r=e+27,i=M(),a=Qa(i,r);return m_(i,r)?c_(i,Mo(),t,a.transform,n,a):a.transform(n)}function p_(e,t,n,r){let i=e+27,a=M(),o=Qa(a,i);return m_(a,i)?l_(a,Mo(),t,o.transform,n,r,o):o.transform(n,r)}function m_(e,t){return e[1].data[t].pure}var h_=(()=>{class e{applicationErrorHandler=A(Ls);appRef=A(sh);taskService=A(gs);ngZone=A(ws);zonelessEnabled=A(Js);tracing=A(Fu,{optional:!0});zoneIsDefined=typeof Zone<`u`&&!!Zone.root.run;schedulerTickApplyArgs=[{data:{__scheduler_tick__:!0}}];subscriptions=new dr;angularZoneId=this.zoneIsDefined?this.ngZone._inner?.get(Ss):null;scheduleInRootZone=!this.zonelessEnabled&&this.zoneIsDefined&&(A(Ys,{optional:!0})??!1);cancelScheduledCallback=null;useMicrotaskScheduler=!1;runningTick=!1;pendingRenderTaskId=null;constructor(){this.subscriptions.add(this.appRef.afterTick.subscribe(()=>{let e=this.taskService.add();if(!this.runningTick&&(this.cleanup(),!this.zonelessEnabled||this.appRef.includeAllTestViews)){this.taskService.remove(e);return}this.switchToMicrotaskScheduler(),this.taskService.remove(e)})),this.subscriptions.add(this.ngZone.onUnstable.subscribe(()=>{this.runningTick||this.cleanup()}))}switchToMicrotaskScheduler(){this.ngZone.runOutsideAngular(()=>{let e=this.taskService.add();this.useMicrotaskScheduler=!0,queueMicrotask(()=>{this.useMicrotaskScheduler=!1,this.taskService.remove(e)})})}notify(e){if(!this.zonelessEnabled&&e===5)return;switch(e){case 0:case 2:this.appRef.dirtyFlags|=2;break;case 3:case 4:case 5:case 1:this.appRef.dirtyFlags|=4;break;case 6:this.appRef.dirtyFlags|=2;break;case 12:this.appRef.dirtyFlags|=16;break;case 13:this.appRef.dirtyFlags|=2;break;case 11:break;default:this.appRef.dirtyFlags|=8}if(this.appRef.tracingSnapshot=this.tracing?.snapshot(this.appRef.tracingSnapshot)??null,!this.shouldScheduleTick())return;let t=this.useMicrotaskScheduler?bs:ys;this.pendingRenderTaskId=this.taskService.add(),this.cancelScheduledCallback=this.scheduleInRootZone?Zone.root.run(()=>t(()=>this.tick())):this.ngZone.runOutsideAngular(()=>t(()=>this.tick()))}shouldScheduleTick(){return!(this.appRef.destroyed||this.pendingRenderTaskId!==null||this.runningTick||this.appRef._runningTick||!this.zonelessEnabled&&this.zoneIsDefined&&Zone.current.get(`isAngularZone_ID`+this.angularZoneId))}tick(){if(this.runningTick||this.appRef.destroyed)return;if(this.appRef.dirtyFlags===0){this.cleanup();return}!this.zonelessEnabled&&this.appRef.dirtyFlags&7&&(this.appRef.dirtyFlags|=1);let e=this.taskService.add();try{this.ngZone.run(()=>{this.runningTick=!0,this.appRef._tick()},void 0,this.schedulerTickApplyArgs)}catch(e){this.applicationErrorHandler(e)}finally{this.taskService.remove(e),this.cleanup()}}ngOnDestroy(){this.subscriptions.unsubscribe(),this.cleanup()}cleanup(){if(this.runningTick=!1,this.cancelScheduledCallback?.(),this.cancelScheduledCallback=null,this.pendingRenderTaskId!==null){let e=this.pendingRenderTaskId;this.pendingRenderTaskId=null,this.taskService.remove(e)}}static ɵfac=function(t){return new(t||e)};static ɵprov=pl({token:e,factory:e.ɵfac})}return e})();function g_(){return[{provide:qs,useExisting:h_},{provide:ws,useClass:Ms},{provide:Js,useValue:!0}]}function __(){return typeof $localize<`u`&&$localize.locale||`en-US`}var v_=new mi(``,{factory:()=>A(v_,{optional:!0,skipSelf:!0})||__()}),y_=class{destroyed=!1;listeners=null;errorHandler=A(Is,{optional:!0});isEmitting=!1;hasNullListeners=!1;destroyRef=A(fs);constructor(){this.destroyRef.onDestroy(()=>{this.destroyed=!0,this.listeners=null})}subscribe(e){if(this.destroyed)throw new k(953,!1);return(this.listeners??=[]).push(e),{unsubscribe:()=>{let t=this.listeners?this.listeners.indexOf(e):-1;t>-1&&(this.isEmitting?(this.hasNullListeners=!0,this.listeners[t]=null):this.listeners.splice(t,1))}}}emit(e){if(this.destroyed){console.warn($r(953,!1));return}if(this.listeners===null)return;this.isEmitting=!0;let t=O(null);try{for(let t of this.listeners)try{t!==null&&t(e)}catch(e){this.errorHandler?.handleError(e)}}finally{this.hasNullListeners&&(this.hasNullListeners=!1,this.listeners&&b_(this.listeners)),O(t),this.isEmitting=!1}}};function b_(e){let t=e.length-1;for(;t>-1;)e[t]===null&&e.splice(t,1),t--}function $(e,t){return On(e,t?.equal)}function x_(e){return tr(e)}(class e extends Error{_brand;constructor(e){super(e)}static IDLE=new e(`IDLE`);static LOADING=new e(`LOADING`)});var S_=e=>e;function C_(e,t){return typeof e==`function`?w_(Zn(e,S_,t?.equal),t?.debugName,t?.set):w_(Zn(e.source,e.computation,e.equal),e.debugName,e.set)}function w_(e,t,n){let r=e[sn],i=e;if(n!==void 0){let t=e=>Qn(r,e);i.set=e=>n(e,t),i.update=r=>n(r(x_(e)),t)}else i.set=e=>Qn(r,e),i.update=e=>$n(r,e);return i.asReadonly=zs.bind(e),i}function T_(e,t){let n=Object.create(cc);n.value=e,n.transformFn=t?.transform;function r(){if(un(n),n.value===sc)throw new k(-950,null);return n.value}return r[sn]=n,r}function E_(e){return new y_}function D_(e,t){return T_(e,t)}function O_(e){return T_(sc,e)}var k_=(D_.required=O_,D_),A_=new mi(``),j_=new mi(``);function M_(e){return!e.moduleRef}function N_(e){let t=M_(e)?e.r3Injector:e.moduleRef.injector,n=t.get(ws);return n.run(()=>{M_(e)?e.r3Injector.resolveInjectorInitializers():e.moduleRef.resolveInjectorInitializers();let r=t.get(Ls),i;if(n.runOutsideAngular(()=>{i=n.onError.subscribe({next:r})}),M_(e)){let n=()=>t.destroy(),r=e.platformInjector.get(A_);r.add(n),t.onDestroy(()=>{i.unsubscribe(),r.delete(n)})}else{let t=()=>e.moduleRef.destroy(),n=e.platformInjector.get(A_);n.add(t),e.moduleRef.onDestroy(()=>{lh(e.allPlatformModules,e.moduleRef),i.unsubscribe(),n.delete(t)})}return F_(r,n,()=>{let n=t.get(gs),r=n.add(),i=t.get(fm);return i.runInitializers(),i.donePromise.then(()=>{if(sg(t.get(v_,og)||`en-US`),!t.get(j_,!0))return M_(e)?t.get(sh):(e.allPlatformModules.push(e.moduleRef),e.moduleRef);if(M_(e)){let n=t.get(sh);return e.rootComponent!==void 0&&n.bootstrap(e.rootComponent),n}return P_?.(e.moduleRef,e.allPlatformModules),e.moduleRef}).finally(()=>void n.remove(r))})})}var P_;function F_(e,t,n){try{let r=n();return Xp(r)?r.catch(n=>{throw t.runOutsideAngular(()=>e(n)),n}):r}catch(n){throw t.runOutsideAngular(()=>e(n)),n}}var I_=null;function L_(e=[],t){return us.create({name:t,providers:[{provide:ya,useValue:`platform`},{provide:A_,useValue:new Set([()=>I_=null])},...e]})}function R_(e=[]){if(I_)return I_;let t=L_(e);return I_=t,ah(),z_(t),t}function z_(e){let t=e.get(Hs,null);Ia(e,()=>{t?.forEach(e=>e())})}function B_(e){let{rootComponent:t,appProviders:n,platformProviders:r,platformRef:i}=e;hc(uc.BootstrapApplicationStart);try{let e=i?.injector??R_(r);return N_({r3Injector:new $p({providers:[g_(),Rs,...n||[]],parent:e,debugName:``,runEnvironmentInitializers:!1}).injector,platformInjector:e,rootComponent:t})}catch(e){return Promise.reject(e)}finally{hc(uc.BootstrapApplicationEnd)}}var V_=null;function H_(){return V_}function U_(e){V_??=e}var W_=class{},G_=(function(e){return e[e.Format=0]=`Format`,e[e.Standalone=1]=`Standalone`,e})(G_||{}),K_=(function(e){return e[e.Narrow=0]=`Narrow`,e[e.Abbreviated=1]=`Abbreviated`,e[e.Wide=2]=`Wide`,e[e.Short=3]=`Short`,e})(K_||{}),q_=(function(e){return e[e.Short=0]=`Short`,e[e.Medium=1]=`Medium`,e[e.Long=2]=`Long`,e[e.Full=3]=`Full`,e})(q_||{}),J_={Decimal:0,Group:1,List:2,PercentSign:3,PlusSign:4,MinusSign:5,Exponential:6,SuperscriptingExponent:7,PerMille:8,Infinity:9,NaN:10,TimeSeparator:11,CurrencyDecimal:12,CurrencyGroup:13};function Y_(e){return ng(e)[ig.LocaleId]}function X_(e,t,n){let r=ng(e);return sv(sv([r[ig.DayPeriodsFormat],r[ig.DayPeriodsStandalone]],t),n)}function Z_(e,t,n){let r=ng(e);return sv(sv([r[ig.DaysFormat],r[ig.DaysStandalone]],t),n)}function Q_(e,t,n){let r=ng(e);return sv(sv([r[ig.MonthsFormat],r[ig.MonthsStandalone]],t),n)}function $_(e,t){let n=ng(e)[ig.Eras];return sv(n,t)}function ev(e,t){return sv(ng(e)[ig.DateFormat],t)}function tv(e,t){return sv(ng(e)[ig.TimeFormat],t)}function nv(e,t){let n=ng(e)[ig.DateTimeFormat];return sv(n,t)}function rv(e,t){let n=ng(e),r=n[ig.NumberSymbols][t];if(r===void 0){if(t===J_.CurrencyDecimal)return n[ig.NumberSymbols][J_.Decimal];if(t===J_.CurrencyGroup)return n[ig.NumberSymbols][J_.Group]}return r}function iv(e){if(!e[ig.ExtraData])throw new k(2303,!1)}function av(e){let t=ng(e);return iv(t),(t[ig.ExtraData][2]||[]).map(e=>typeof e==`string`?cv(e):[cv(e[0]),cv(e[1])])}function ov(e,t,n){let r=ng(e);return iv(r),sv(sv([r[ig.ExtraData][0],r[ig.ExtraData][1]],t)||[],n)||[]}function sv(e,t){for(let n=t;n>-1;n--)if(e[n]!==void 0)return e[n];throw new k(2304,!1)}function cv(e){let[t,n]=e.split(`:`);return{hours:+t,minutes:+n}}var lv=/^(\d{4,})-?(\d\d)-?(\d\d)(?:T(\d\d)(?::?(\d\d)(?::?(\d\d)(?:\.(\d+))?)?)?(Z|([+-])(\d\d):?(\d\d))?)?$/,uv=Object.create(null),dv=/((?:[^BEGHLMOSWYZabcdhmswyz']+)|(?:'(?:[^']|'')*')|(?:G{1,5}|y{1,4}|Y{1,4}|M{1,5}|L{1,5}|w{1,2}|W{1}|d{1,2}|E{1,6}|c{1,6}|a{1,5}|b{1,5}|B{1,5}|h{1,2}|H{1,2}|m{1,2}|s{1,2}|S{1,3}|z{1,4}|Z{1,5}|O{1,4}))([\s\S]*)/,fv=256;function pv(e,t,n,r){let i=Iv(e);mv(t),t=gv(n,t)||t;let a=[],o;for(;t;)if(o=dv.exec(t),o){a=a.concat(o.slice(1));let e=a.pop();if(!e)break;t=e}else{a.push(t);break}let s=i.getTimezoneOffset();r&&(s=Nv(r,s),i=Fv(i,r));let c=``;return a.forEach(e=>{let t=Mv(e);c+=t?t(i,n,s):e===`''`?`'`:e.replace(/(^'|'$)/g,``).replace(/''/g,`'`)}),c}function mv(e){if(e.length>fv)throw new k(2300,!1)}function hv(e,t,n){let r=new Date(0);return r.setFullYear(e,t,n),r.setHours(0,0,0),r}function gv(e,t){let n=Y_(e);if(uv[n]??=Object.create(null),uv[n][t])return uv[n][t];let r=``;switch(t){case`shortDate`:r=ev(e,q_.Short);break;case`mediumDate`:r=ev(e,q_.Medium);break;case`longDate`:r=ev(e,q_.Long);break;case`fullDate`:r=ev(e,q_.Full);break;case`shortTime`:r=tv(e,q_.Short);break;case`mediumTime`:r=tv(e,q_.Medium);break;case`longTime`:r=tv(e,q_.Long);break;case`fullTime`:r=tv(e,q_.Full);break;case`short`:let t=gv(e,`shortTime`),n=gv(e,`shortDate`);r=_v(nv(e,q_.Short),[t,n]);break;case`medium`:let i=gv(e,`mediumTime`),a=gv(e,`mediumDate`);r=_v(nv(e,q_.Medium),[i,a]);break;case`long`:let o=gv(e,`longTime`),s=gv(e,`longDate`);r=_v(nv(e,q_.Long),[o,s]);break;case`full`:let c=gv(e,`fullTime`),l=gv(e,`fullDate`);r=_v(nv(e,q_.Full),[c,l])}return r&&(uv[n][t]=r),r}function _v(e,t){return t&&(e=e.replace(/\{([^}]+)}/g,function(e,n){return Object.hasOwn(t,n)?t[n]:e})),e}function vv(e,t,n=`-`,r,i){let a=``;(e<0||i&&e<=0)&&(i?e=-e+1:(e=-e,a=n));let o=String(e);for(;o.length<t;)o=`0`+o;return r&&(o=o.slice(o.length-t)),a+o}function yv(e,t){return vv(e,3).substring(0,t)}function bv(e,t,n=0,r=!1,i=!1){return function(a,o){let s=xv(e,a);if((n>0||s>-n)&&(s+=n),e===3)s===0&&n===-12&&(s=12);else if(e===6)return yv(s,t);let c=rv(o,J_.MinusSign);return vv(s,t,c,r,i)}}function xv(e,t){switch(e){case 0:return t.getFullYear();case 1:return t.getMonth();case 2:return t.getDate();case 3:return t.getHours();case 4:return t.getMinutes();case 5:return t.getSeconds();case 6:return t.getMilliseconds();case 7:return t.getDay();default:throw new k(2301,!1)}}function Sv(e,t,n=G_.Format,r=!1){return function(i,a){return Cv(i,a,e,t,n,r)}}function Cv(e,t,n,r,i,a){switch(n){case 2:return Q_(t,i,r)[e.getMonth()];case 1:return Z_(t,i,r)[e.getDay()];case 0:let n=e.getHours(),o=e.getMinutes();if(a){let e=av(t),a=ov(t,i,r),s=e.findIndex(e=>{if(Array.isArray(e)){let[t,r]=e,i=n>=t.hours&&o>=t.minutes,a=n<r.hours||n===r.hours&&o<r.minutes;if(t.hours<r.hours){if(i&&a)return!0}else if(i||a)return!0}else if(e.hours===n&&e.minutes===o)return!0;return!1});if(s!==-1)return a[s]}return X_(t,i,r)[n<12?0:1];case 3:return $_(t,r)[e.getFullYear()<=0?0:1];default:throw new k(2302,!1)}}function wv(e){return function(t,n,r){let i=-1*r,a=rv(n,J_.MinusSign),o=i>0?Math.floor(i/60):Math.ceil(i/60);switch(e){case 0:return(i>=0?`+`:``)+vv(o,2,a)+vv(Math.abs(i%60),2,a);case 1:return`GMT`+(i>=0?`+`:``)+vv(o,1,a);case 2:return`GMT`+(i>=0?`+`:``)+vv(o,2,a)+`:`+vv(Math.abs(i%60),2,a);case 3:return r===0?`Z`:(i>=0?`+`:``)+vv(o,2,a)+`:`+vv(Math.abs(i%60),2,a);default:throw new k(2310,!1)}}}var Tv=0,Ev=4;function Dv(e){let t=hv(e,Tv,1).getDay();return hv(e,0,1+(t<=Ev?Ev:11)-t)}function Ov(e){let t=e.getDay(),n=t===0?-3:Ev-t;return hv(e.getFullYear(),e.getMonth(),e.getDate()+n)}function kv(e,t=!1){return function(n,r){let i;if(t){let e=new Date(n.getFullYear(),n.getMonth(),1).getDay()-1,t=n.getDate();i=1+Math.floor((t+e)/7)}else{let e=Ov(n),t=Dv(e.getFullYear()),r=e.getTime()-t.getTime();i=1+Math.round(r/6048e5)}return vv(i,e,rv(r,J_.MinusSign))}}function Av(e,t=!1){return function(n,r){return vv(Ov(n).getFullYear(),e,rv(r,J_.MinusSign),t)}}var jv=Object.create(null);function Mv(e){if(jv[e])return jv[e];let t;switch(e){case`G`:case`GG`:case`GGG`:t=Sv(3,K_.Abbreviated);break;case`GGGG`:t=Sv(3,K_.Wide);break;case`GGGGG`:t=Sv(3,K_.Narrow);break;case`y`:t=bv(0,1,0,!1,!0);break;case`yy`:t=bv(0,2,0,!0,!0);break;case`yyy`:t=bv(0,3,0,!1,!0);break;case`yyyy`:t=bv(0,4,0,!1,!0);break;case`Y`:t=Av(1);break;case`YY`:t=Av(2,!0);break;case`YYY`:t=Av(3);break;case`YYYY`:t=Av(4);break;case`M`:case`L`:t=bv(1,1,1);break;case`MM`:case`LL`:t=bv(1,2,1);break;case`MMM`:t=Sv(2,K_.Abbreviated);break;case`MMMM`:t=Sv(2,K_.Wide);break;case`MMMMM`:t=Sv(2,K_.Narrow);break;case`LLL`:t=Sv(2,K_.Abbreviated,G_.Standalone);break;case`LLLL`:t=Sv(2,K_.Wide,G_.Standalone);break;case`LLLLL`:t=Sv(2,K_.Narrow,G_.Standalone);break;case`w`:t=kv(1);break;case`ww`:t=kv(2);break;case`W`:t=kv(1,!0);break;case`d`:t=bv(2,1);break;case`dd`:t=bv(2,2);break;case`c`:case`cc`:t=bv(7,1);break;case`ccc`:t=Sv(1,K_.Abbreviated,G_.Standalone);break;case`cccc`:t=Sv(1,K_.Wide,G_.Standalone);break;case`ccccc`:t=Sv(1,K_.Narrow,G_.Standalone);break;case`cccccc`:t=Sv(1,K_.Short,G_.Standalone);break;case`E`:case`EE`:case`EEE`:t=Sv(1,K_.Abbreviated);break;case`EEEE`:t=Sv(1,K_.Wide);break;case`EEEEE`:t=Sv(1,K_.Narrow);break;case`EEEEEE`:t=Sv(1,K_.Short);break;case`a`:case`aa`:case`aaa`:t=Sv(0,K_.Abbreviated);break;case`aaaa`:t=Sv(0,K_.Wide);break;case`aaaaa`:t=Sv(0,K_.Narrow);break;case`b`:case`bb`:case`bbb`:t=Sv(0,K_.Abbreviated,G_.Standalone,!0);break;case`bbbb`:t=Sv(0,K_.Wide,G_.Standalone,!0);break;case`bbbbb`:t=Sv(0,K_.Narrow,G_.Standalone,!0);break;case`B`:case`BB`:case`BBB`:t=Sv(0,K_.Abbreviated,G_.Format,!0);break;case`BBBB`:t=Sv(0,K_.Wide,G_.Format,!0);break;case`BBBBB`:t=Sv(0,K_.Narrow,G_.Format,!0);break;case`h`:t=bv(3,1,-12);break;case`hh`:t=bv(3,2,-12);break;case`H`:t=bv(3,1);break;case`HH`:t=bv(3,2);break;case`m`:t=bv(4,1);break;case`mm`:t=bv(4,2);break;case`s`:t=bv(5,1);break;case`ss`:t=bv(5,2);break;case`S`:t=bv(6,1);break;case`SS`:t=bv(6,2);break;case`SSS`:t=bv(6,3);break;case`Z`:case`ZZ`:case`ZZZ`:t=wv(0);break;case`ZZZZZ`:t=wv(3);break;case`O`:case`OO`:case`OOO`:case`z`:case`zz`:case`zzz`:t=wv(1);break;case`OOOO`:case`ZZZZ`:case`zzzz`:t=wv(2);break;default:return null}return jv[e]=t,t}function Nv(e,t){e=e.replace(/:/g,``);let n=Date.parse(`Jan 01, 1970 00:00:00 `+e)/6e4;return isNaN(n)?t:n}function Pv(e,t){return e=new Date(e.getTime()),e.setMinutes(e.getMinutes()+t),e}function Fv(e,t,n){let r=e.getTimezoneOffset();return Pv(e,-1*(Nv(t,r)-r))}function Iv(e){if(Rv(e))return e;if(typeof e==`number`&&!isNaN(e))return new Date(e);if(typeof e==`string`){if(e=e.trim(),/^(\d{4}(-\d{1,2}(-\d{1,2})?)?)$/.test(e)){let[t,n=1,r=1]=e.split(`-`).map(e=>+e);return hv(t,n-1,r)}let t=parseFloat(e);if(!isNaN(e-t))return new Date(t);let n;if(n=e.match(lv))return Lv(n)}let t=new Date(e);if(!Rv(t))throw new k(2311,!1);return t}function Lv(e){let t=new Date(0),n=0,r=0,i=e[8]?t.setUTCFullYear:t.setFullYear,a=e[8]?t.setUTCHours:t.setHours;e[9]&&(n=Number(e[9]+e[10]),r=Number(e[9]+e[11])),i.call(t,Number(e[1]),Number(e[2])-1,Number(e[3]));let o=Number(e[4]||0)-n,s=Number(e[5]||0)-r,c=Number(e[6]||0),l=Math.floor(parseFloat(`0.`+(e[7]||0))*1e3);return a.call(t,o,s,c,l),t}function Rv(e){return e instanceof Date&&!isNaN(e.valueOf())}function zv(e,t){return new k(2100,!1)}var Bv=`mediumDate`,Vv=new mi(``),Hv=new mi(``),Uv=(()=>{class e{locale;defaultTimezone;defaultOptions;constructor(e,t,n){this.locale=e,this.defaultTimezone=t,this.defaultOptions=n}transform(t,n,r,i){if(t==null||t===``||t!==t)return null;try{let e=n??this.defaultOptions?.dateFormat??Bv,a=r??this.defaultOptions?.timezone??this.defaultTimezone??void 0;return pv(t,e,i||this.locale,a)}catch(t){throw zv(e,t.message)}}static ɵfac=function(t){return new(t||e)(mp(v_,16),mp(Vv,24),mp(Hv,24))};static ɵpipe=om({name:`date`,type:e,pure:!0})}return e})(),Wv=(()=>{class e{transform(e){return JSON.stringify(e,null,2)}static ɵfac=function(t){return new(t||e)};static ɵpipe=om({name:`json`,type:e,pure:!1})}return e})();function Gv(e,t){t=encodeURIComponent(t);for(let n of e.split(`;`)){let e=n.indexOf(`=`),[r,i]=e==-1?[n,``]:[n.slice(0,e),n.slice(e+1)];if(r.trim()!==t)continue;let a=i;try{a=decodeURIComponent(i)}catch{}return a.length>1&&a[0]===`"`&&a[a.length-1]===`"`&&(a=a.slice(1,-1)),a}return null}var Kv=`browser`,qv=class{_doc;constructor(e){this._doc=e}manager},Jv=(()=>{class e extends qv{constructor(e){super(e)}supports(e){return!0}addEventListener(e,t,n,r){return e.addEventListener(t,n,r),()=>this.removeEventListener(e,t,n,r)}removeEventListener(e,t,n,r){return e.removeEventListener(t,n,r)}static ɵfac=function(t){return new(t||e)(Ui(ds))};static ɵprov=si({token:e,factory:e.ɵfac})}return e})(),Yv=new mi(``),Xv=(()=>{class e{_zone;_plugins;_eventNameToPlugin=new Map;constructor(e,t){this._zone=t,e.forEach(e=>{e.manager=this});let n=e.filter(e=>!(e instanceof Jv));this._plugins=n.slice().reverse();let r=e.find(e=>e instanceof Jv);r&&this._plugins.push(r)}addEventListener(e,t,n,r){return this._findPluginFor(t).addEventListener(e,t,n,r)}getZone(){return this._zone}_findPluginFor(e){let t=this._eventNameToPlugin.get(e);if(t)return t;if(t=this._plugins.find(t=>t.supports(e)),!t)throw new k(-5101,!1);return this._eventNameToPlugin.set(e,t),t}static ɵfac=function(t){return new(t||e)(Ui(Yv),Ui(ws))};static ɵprov=si({token:e,factory:e.ɵfac})}return e})(),Zv=`ng-app-id`;function Qv(e){for(let t of e)t.remove()}function $v(e,t){let n=t.createElement(`style`);return n.textContent=e,n}function ey(e,t,n,r){let i=e.head?.querySelectorAll(`style[${Zv}="${t}"],link[${Zv}="${t}"]`);if(!i||i.length===0)return!1;for(let e of i)e.removeAttribute(Zv),e instanceof HTMLLinkElement?r.set(e.href.slice(e.href.lastIndexOf(`/`)+1),{usage:0,elements:[e]}):e.textContent&&n.set(e.textContent,{usage:0,elements:[e]});return!0}function ty(e,t){let n=t.createElement(`link`);return n.setAttribute(`rel`,`stylesheet`),n.setAttribute(`href`,e),n}var ny=(()=>{class e{doc;appId;nonce;inline=new Map;external=new Map;hosts=new Set;constructor(e,t,n,r={}){this.doc=e,this.appId=t,this.nonce=n,ey(e,t,this.inline,this.external)&&this.hosts.add(e.head)}addStyles(e,t){for(let t of e)this.addUsage(t,this.inline,$v);t?.forEach(e=>this.addUsage(e,this.external,ty))}removeStyles(e,t){for(let t of e)this.removeUsage(t,this.inline);t?.forEach(e=>this.removeUsage(e,this.external))}addUsage(e,t,n){let r=t.get(e);r?r.usage++:t.set(e,{usage:1,elements:[...this.hosts].map(t=>this.addElement(t,n(e,this.doc)))})}removeUsage(e,t){let n=t.get(e);n&&(n.usage--,n.usage<=0&&(Qv(n.elements),t.delete(e)))}ngOnDestroy(){for(let[,{elements:e}]of[...this.inline,...this.external])Qv(e);this.hosts.clear()}addHost(e){if(!this.hosts.has(e)){this.hosts.add(e);for(let[t,{elements:n}]of this.inline)n.push(this.addElement(e,$v(t,this.doc)));for(let[t,{elements:n}]of this.external)n.push(this.addElement(e,ty(t,this.doc)))}}removeHost(e){this.hosts.delete(e);for(let t of[...this.inline.values(),...this.external.values()]){let n=[];for(let r of t.elements)r.parentNode===e?r.remove():n.push(r);t.elements=n}}addElement(e,t){return this.nonce&&t.setAttribute(`nonce`,this.nonce),e.appendChild(t)}static ɵfac=function(t){return new(t||e)(Ui(ds),Ui(Bs),Ui(Ws,8),Ui(Us))};static ɵprov=si({token:e,factory:e.ɵfac})}return e})(),ry={svg:`http://www.w3.org/2000/svg`,xhtml:`http://www.w3.org/1999/xhtml`,xlink:`http://www.w3.org/1999/xlink`,xml:`http://www.w3.org/XML/1998/namespace`,xmlns:`http://www.w3.org/2000/xmlns/`,math:`http://www.w3.org/1998/Math/MathML`},iy=/%COMP%/g,ay=`%COMP%`,oy=`_nghost-${ay}`,sy=`_ngcontent-${ay}`,cy=!0,ly=new mi(``,{factory:()=>cy}),uy=new mi(``);function dy(e){return sy.replace(iy,e)}function fy(e){return oy.replace(iy,e)}function py(e,t){return t.map(t=>t.replace(iy,e))}var my=(()=>{class e{eventManager;sharedStylesHost;appId;removeStylesOnCompDestroy;doc;ngZone;nonce;tracingService;rendererByCompId=new Map;defaultRenderer;cssVarNamespace;constructor(e,t,n,r,i,a,o=null,s=null,c=null){this.eventManager=e,this.sharedStylesHost=t,this.appId=n,this.removeStylesOnCompDestroy=r,this.doc=i,this.ngZone=a,this.nonce=o,this.tracingService=s,this.cssVarNamespace=c??``,this.defaultRenderer=new hy(e,i,a,this.tracingService,this.cssVarNamespace)}createRenderer(e,t){if(!e||!t)return this.defaultRenderer;let n=this.getOrCreateRenderer(e,t);return n instanceof yy?n.applyToHost(e):n instanceof vy&&n.applyStyles(),n}getOrCreateRenderer(e,t){let n=this.rendererByCompId,r=n.get(t.id);if(!r){let i=this.doc,a=this.ngZone,o=this.eventManager,s=this.sharedStylesHost,c=this.removeStylesOnCompDestroy,l=this.tracingService;switch(t.encapsulation){case Gl.Emulated:r=new yy(o,s,t,this.appId,c,i,a,l,this.cssVarNamespace);break;case Gl.ShadowDom:return new _y(o,e,t,i,a,this.nonce,l,this.cssVarNamespace,s);case Gl.ExperimentalIsolatedShadowDom:return new _y(o,e,t,i,a,this.nonce,l,this.cssVarNamespace);default:r=new vy(o,s,t,c,i,a,l,this.cssVarNamespace)}n.set(t.id,r)}return r}ngOnDestroy(){this.rendererByCompId.clear()}componentReplaced(e){this.rendererByCompId.delete(e)}static ɵfac=function(t){return new(t||e)(Ui(Xv),Ui(fp),Ui(Bs),Ui(ly),Ui(ds),Ui(ws),Ui(Ws),Ui(Fu,8),Ui(uy,8))};static ɵprov=si({token:e,factory:e.ɵfac})}return e})(),hy=class{eventManager;doc;ngZone;tracingService;cssVarNamespace;data=Object.create(null);throwOnSyntheticProps=!0;constructor(e,t,n,r,i=``){this.eventManager=e,this.doc=t,this.ngZone=n,this.tracingService=r,this.cssVarNamespace=i}destroy(){}destroyNode=null;createElement(e,t){return t?this.doc.createElementNS(ry[t]||t,e):this.doc.createElement(e)}createComment(e){return this.doc.createComment(e)}createText(e){return this.doc.createTextNode(e)}appendChild(e,t){(gy(e)?e.content:e).appendChild(t)}insertBefore(e,t,n){if(e){let r=gy(e)?e.content:e;if(n!=null&&n.parentNode!==r)throw new k(-5106,!1);r.insertBefore(t,n)}}removeChild(e,t){t.remove()}selectRootElement(e,t){let n=typeof e==`string`?this.doc.querySelector(e):e;if(!n)throw new k(-5104,!1);return t||(n.textContent=``),n}parentNode(e){return e.parentNode}nextSibling(e){return e.nextSibling}setAttribute(e,t,n,r){if(r){t=r+`:`+t;let i=ry[r];i?e.setAttributeNS(i,t,n):e.setAttribute(t,n)}else e.setAttribute(t,n)}removeAttribute(e,t,n){if(n){let r=ry[n];r?e.removeAttributeNS(r,t):e.removeAttribute(`${n}:${t}`)}else e.removeAttribute(t)}addClass(e,t){e.classList.add(t)}removeClass(e,t){e.classList.remove(t)}setStyle(e,t,n,r){let i=t.startsWith(`--`);i&&(t=t.replace(`%NS%`,this.cssVarNamespace)),i||r&(Tu.DashCase|Tu.Important)?e.style.setProperty(t,n,r&Tu.Important?`important`:``):e.style[t]=n}removeStyle(e,t,n){let r=t.startsWith(`--`);r&&(t=t.replace(`%NS%`,this.cssVarNamespace)),r||n&Tu.DashCase?e.style.removeProperty(t):e.style[t]=``}setProperty(e,t,n){e!=null&&(e[t]=n)}setValue(e,t){e.nodeValue=t}listen(e,t,n,r){if(typeof e==`string`&&(e=H_().getGlobalEventTarget(this.doc,e),!e))throw new k(-5102,!1);let i=this.decoratePreventDefault(n);return this.tracingService?.wrapEventListener&&(i=this.tracingService.wrapEventListener(e,t,i)),this.eventManager.addEventListener(e,t,i,r)}decoratePreventDefault(e){return t=>{if(t===`__ngUnwrap__`)return e;e(t)===!1&&t.preventDefault()}}};function gy(e){return e.tagName===`TEMPLATE`&&e.content!==void 0}var _y=class extends hy{hostEl;sharedStylesHost;shadowRoot;constructor(e,t,n,r,i,a,o,s,c){super(e,r,i,o,s),this.hostEl=t,this.sharedStylesHost=c,this.shadowRoot=t.attachShadow({mode:`open`}),this.sharedStylesHost&&this.sharedStylesHost.addHost(this.shadowRoot);let l=n.styles;l=py(n.id,l).map(e=>e.replace(/%NS%/g,s));for(let e of l){let t=document.createElement(`style`);a&&t.setAttribute(`nonce`,a),t.textContent=e,this.shadowRoot.appendChild(t)}let u=n.getExternalStyles?.();if(u)for(let e of u){let t=ty(e,r);a&&t.setAttribute(`nonce`,a),this.shadowRoot.appendChild(t)}}nodeOrShadowRoot(e){return e===this.hostEl?this.shadowRoot:e}appendChild(e,t){return super.appendChild(this.nodeOrShadowRoot(e),t)}insertBefore(e,t,n){return super.insertBefore(this.nodeOrShadowRoot(e),t,n)}removeChild(e,t){return super.removeChild(null,t)}parentNode(e){return this.nodeOrShadowRoot(super.parentNode(this.nodeOrShadowRoot(e)))}destroy(){this.sharedStylesHost&&this.sharedStylesHost.removeHost(this.shadowRoot)}},vy=class extends hy{sharedStylesHost;removeStylesOnCompDestroy;styles;styleUrls;constructor(e,t,n,r,i,a,o,s,c){super(e,i,a,o,s),this.sharedStylesHost=t,this.removeStylesOnCompDestroy=r;let l=n.styles,u=c?py(c,l):l;this.styles=u.map(e=>e.replace(/%NS%/g,s)),this.styleUrls=n.getExternalStyles?.(c)}applyStyles(){this.sharedStylesHost.addStyles(this.styles,this.styleUrls)}destroy(){this.removeStylesOnCompDestroy&&Ou.size===0&&this.sharedStylesHost.removeStyles(this.styles,this.styleUrls)}},yy=class extends vy{contentAttr;hostAttr;constructor(e,t,n,r,i,a,o,s,c){let l=r+`-`+n.id;super(e,t,n,i,a,o,s,c,l),this.contentAttr=dy(l),this.hostAttr=fy(l)}applyToHost(e){this.applyStyles(),this.setAttribute(e,this.hostAttr,``)}createElement(e,t){let n=super.createElement(e,t);return super.setAttribute(n,this.contentAttr,``),n}},by=class e extends W_{supportsDOMEvents=!0;static makeCurrent(){U_(new e)}onAndCancel(e,t,n,r){return e.addEventListener(t,n,r),()=>{e.removeEventListener(t,n,r)}}dispatchEvent(e,t){e.dispatchEvent(t)}remove(e){e.remove()}createElement(e,t){return t||=this.getDefaultDocument(),t.createElement(e)}createHtmlDocument(){return document.implementation.createHTMLDocument(`fakeTitle`)}getDefaultDocument(){return document}isElementNode(e){return e.nodeType===Node.ELEMENT_NODE}isShadowRoot(e){return e instanceof DocumentFragment}getGlobalEventTarget(e,t){return t===`window`?window:t===`document`?e:t===`body`?e.body:null}getBaseHref(e){let t=Sy();return t==null?null:Cy(t)}resetBaseElement(){xy=null}getUserAgent(){return window.navigator.userAgent}getCookie(e){return Gv(document.cookie,e)}},xy=null;function Sy(){return xy||=document.head.querySelector(`base`),xy?xy.getAttribute(`href`):null}function Cy(e){return new URL(e,document.baseURI).pathname}var wy=[`alt`,`control`,`meta`,`shift`],Ty={"\b":`Backspace`,"	":`Tab`,"":`Delete`,"\x1B":`Escape`,Del:`Delete`,Esc:`Escape`,Left:`ArrowLeft`,Right:`ArrowRight`,Up:`ArrowUp`,Down:`ArrowDown`,Menu:`ContextMenu`,Scroll:`ScrollLock`,Win:`OS`},Ey={alt:e=>e.altKey,control:e=>e.ctrlKey,meta:e=>e.metaKey,shift:e=>e.shiftKey},Dy=(()=>{class e extends qv{constructor(e){super(e)}supports(t){return e.parseEventName(t)!=null}addEventListener(t,n,r,i){let a=e.parseEventName(n),o=e.eventCallback(a.fullKey,r,this.manager.getZone());return this.manager.getZone().runOutsideAngular(()=>H_().onAndCancel(t,a.domEventName,o,i))}static parseEventName(t){let n=t.toLowerCase().split(`.`),r=n.shift();if(n.length===0||r!==`keydown`&&r!==`keyup`)return null;let i=e._normalizeKey(n.pop()),a=``,o=n.indexOf(`code`);if(o>-1&&(n.splice(o,1),a=`code.`),wy.forEach(e=>{let t=n.indexOf(e);t>-1&&(n.splice(t,1),a+=e+`.`)}),a+=i,n.length!=0||i.length===0)return null;let s={};return s.domEventName=r,s.fullKey=a,s}static matchEventFullKeyCode(e,t){let n=Ty[e.key]||e.key,r=``;return t.indexOf(`code.`)>-1&&(n=e.code,r=`code.`),n==null||!n?!1:(n=n.toLowerCase(),n===` `?n=`space`:n===`.`&&(n=`dot`),wy.forEach(t=>{if(t!==n){let n=Ey[t];n(e)&&(r+=t+`.`)}}),r+=n,r===t)}static eventCallback(t,n,r){return i=>{e.matchEventFullKeyCode(i,t)&&r.runGuarded(()=>n(i))}}static _normalizeKey(e){return e===`esc`?`escape`:e}static ɵfac=function(t){return new(t||e)(Ui(ds))};static ɵprov=si({token:e,factory:e.ɵfac})}return e})();async function Oy(e,t,n){return B_({rootComponent:e,...ky(t,n)})}function ky(e,t){return{platformRef:t?.platformRef,appProviders:[...Py,...e?.providers??[]],platformProviders:Ny}}function Ay(){by.makeCurrent()}function jy(){return new Is}function My(){return Al(document),document}var Ny=[{provide:Us,useValue:Kv},{provide:Hs,useValue:Ay,multi:!0},{provide:ds,useFactory:My}],Py=[{provide:ya,useValue:`root`},{provide:Is,useFactory:jy},{provide:Yv,useClass:Jv,multi:!0},{provide:Yv,useClass:Dy,multi:!0},my,{provide:fp,useClass:ny},{provide:ny,useExisting:fp},Xv,{provide:Jf,useExisting:my},[]];function Fy(e,t){let n=`\x1B[${e}m`,r=`\x1B[${t}m`;return((e,...t)=>{if(Array.isArray(e)&&`raw`in e){let i=e,a=``;for(let e=0;e<i.length;e++)a+=i[e],e<t.length&&(a+=String(t[e]));return`${n}${a}${r}`}return`${n}${String(e)}${r}`})}var Iy={blue:Fy(34,39),cyan:Fy(36,39),gray:Fy(90,39),green:Fy(32,39),red:Fy(31,39),yellow:Fy(33,39),bold:Fy(1,22),dim:Fy(2,22),reset:Fy(0,0),underline:Fy(4,24)};function Ly(e,...t){return typeof e==`function`?e(...t):e}var Ry=Error.captureStackTrace,zy=class e extends Error{name;code;docs;fix;sources;data;get why(){return this.message}constructor(t,n=e){super(t.why,{cause:t.cause}),this.code=this.name=t.code,this.fix=t.fix,this.docs=t.docs,this.sources=t.sources,this.data=t.data,Ry?.(this,n)}toJSON(){return{name:this.name,why:this.why,fix:this.fix,docs:this.docs,sources:this.sources,cause:this.cause,data:this.data,stack:this.stack}}};function By(e,t){return typeof e==`string`?`${e}/${t.toLowerCase()}`:e?.(t)}function Vy(e){let t=e.reporters??[],n={},{docsBase:r}=e;for(let i of Object.keys(e.codes)){let a=e.codes[i],o=a.docs===!1?void 0:a.docs||By(r,i),s=(e={},n={})=>{let r=new zy({code:i,why:Ly(a.why,e),fix:Ly(a.fix,e),docs:o,cause:e.cause,sources:e.sources,data:Ly(a.data,e)},s);for(let e of t)e(r,n);return r};n[i]=s}return n}function Hy(e){return t=>{let n=`${e.bold(e.red(`[${t.name}]`))} ${t.message}`,r=[];return t.fix&&r.push(`${e.dim(`fix:`)} ${t.fix}`),t.sources?.length&&r.push(`${e.dim(`sources:`)} ${t.sources.join(`, `)}`),t.docs&&r.push(`${e.dim(`see:`)} ${e.cyan(t.docs)}`),r.length===0?n:[n,...r.map((t,n)=>`${e.dim(n<r.length-1?`├▶`:`╰▶`)} ${t}`)].join(`
`)}}var Uy={bus:{agentManifestChanged:`agent:manifest:changed`,agentToolRegistered:`agent:tool:registered`,agentToolUnregistered:`agent:tool:unregistered`,agentResourceRegistered:`agent:resource:registered`,agentResourceUnregistered:`agent:resource:unregistered`},client:{isTrustedUpdated:`rpc:is-trusted:updated`,error:`rpc:error`,connectionStatus:`connection:status`,connectionError:`connection:error`},broadcast:{authRevoked:`devframe:auth:revoked`,clientStateUpdated:`devframe:rpc:client-state:updated`,clientStatePatch:`devframe:rpc:client-state:patch`,streamingChunk:`devframe:streaming:chunk`,streamingEnd:`devframe:streaming:end`,streamingUploadCancel:`devframe:streaming:upload-cancel`},inPageChannel:{panelStateUpdated:`devframe:in-page:panel-state:updated`,panelStatePatch:`devframe:in-page:panel-state:patch`},postMessage:{remoteAssetsError:`devframe:remote-assets-error`,inPageChannel:`devframe:in-page-channel`}},Wy=Hy(Iy);function Gy(e,{method:t=`warn`}={}){console[t](Wy(e))}function Ky(e){return Vy({...e,reporters:[Gy,...e.reporters??[]]})}function qy(){let e,t;return{promise:new Promise((n,r)=>{e=n,t=r}),resolve:e,reject:t}}var Jy=Math.random.bind(Math),Yy=`useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict`;function Xy(e=21){let t=``,n=e;for(;n--;)t+=Yy[Jy()*64|0];return t}var Zy=6e4,Qy=e=>e,$y=Qy,{clearTimeout:eb,setTimeout:tb}=globalThis;function nb(e,t){let{post:n,on:r,off:i=()=>{},eventNames:a=[],serialize:o=Qy,deserialize:s=$y,resolver:c,bind:l=`rpc`,timeout:u=Zy,proxify:d=!0}=t,f=!1,p=new Map,m,h;async function g(e,r,i,a){if(f)throw Error(`[birpc] rpc is closed, cannot call "${e}"`);let s={m:e,a:r,t:`q`};a&&(s.o=!0);let c=async e=>n(o(e));if(i){await c(s);return}if(m)try{await m}finally{m=void 0}let{promise:l,resolve:d,reject:g}=qy(),_=Xy();s.i=_;let v;async function y(n=s){return u>=0&&(v=tb(()=>{try{if(t.onTimeoutError?.call(h,e,r)!==!0)throw Error(`[birpc] timeout on calling "${e}"`)}catch(e){g(e)}p.delete(_)},u),typeof v==`object`&&(v=v.unref?.())),p.set(_,{resolve:d,reject:g,timeoutId:v,method:e}),await c(n),l}try{t.onRequest?await t.onRequest.call(h,s,y,d):await y()}catch(e){if(t.onGeneralError?.call(h,e)!==!0)throw e;return}finally{eb(v),p.delete(_)}return l}let _={$call:(e,...t)=>g(e,t,!1),$callOptional:(e,...t)=>g(e,t,!1,!0),$callEvent:(e,...t)=>g(e,t,!0),$callRaw:e=>g(e.method,e.args,e.event,e.optional),$rejectPendingCalls:y,get $closed(){return f},get $meta(){return t.meta},$close:v,$functions:e};h=d?new Proxy({},{get(t,n){if(Object.hasOwn(_,n))return _[n];if(n===`then`&&!a.includes(`then`)&&!(`then`in e))return;let r=(...e)=>g(n,e,!0);if(a.includes(n))return r.asEvent=r,r;let i=(...e)=>g(n,e,!1);return i.asEvent=r,i}}):_;function v(e){f=!0,p.forEach(({reject:t,method:n})=>{let r=Error(`[birpc] rpc is closed, cannot call "${n}"`);if(e)return e.cause??=r,t(e);t(r)}),p.clear(),i(b)}function y(e){let t=Array.from(p.values()).map(({method:t,reject:n})=>e?e({method:t,reject:n}):n(Error(`[birpc]: rejected pending call "${t}".`)));return p.clear(),t}async function b(r,...i){let a;try{a=s(r)}catch(e){if(t.onGeneralError?.call(h,e)!==!0)throw e;return}if(a.t===`q`){let{m:r,a:s,o:u}=a,d,f,p=await(c?c.call(h,r,e[r]):e[r]);if(u&&(p||=()=>void 0),!p)f=Error(`[birpc] function "${r}" not found`);else try{d=await p.apply(l===`rpc`?h:e,s)}catch(e){f=e}if(a.i){if(f&&t.onFunctionError&&t.onFunctionError.call(h,f,r,s)===!0)return;if(!f)try{await n(o({t:`s`,i:a.i,r:d}),...i);return}catch(e){if(f=e,t.onGeneralError?.call(h,e,r,s)!==!0)throw e}try{await n(o({t:`s`,i:a.i,e:f}),...i)}catch(e){if(t.onGeneralError?.call(h,e,r,s)!==!0)throw e}}}else{let{i:e,r:t,e:n}=a,r=p.get(e);r&&(eb(r.timeoutId),n?r.reject(n):r.resolve(t)),p.delete(e)}}return m=r(b),h}function rb(e,t){return t.safety?t.safety:e===`static`||e===`query`||e==null?`read`:`action`}var ib=Object.freeze({type:`object`,additionalProperties:!0});function ab(e){let t=e[`~standard`];if(t.jsonSchema)try{return t.jsonSchema.input({target:`draft-2020-12`})}catch{return ib}return ib}function ob(e){if(!e||e.length===0)return{type:`object`,properties:{}};let t={},n=[];for(let r=0;r<e.length;r++){let i=`arg${r}`;t[i]=ab(e[r]),n.push(i)}return{type:`object`,properties:t,required:n,additionalProperties:!1}}function sb(e,t){if(Array.isArray(e))return e;if(e==null)return[];if(typeof e!=`object`)return;let n=e;if(t!=null)return Array.from({length:t},(e,t)=>n[`arg${t}`]);if(`arg0`in n){let e=[];for(;`arg${e.length}`in n;)e.push(n[`arg${e.length}`]);return e}return Object.keys(n).length===0?[]:void 0}function cb(e,t){return sb(e,t)??[e]}function lb(e){return typeof e==`string`?`'${e}'`:new pb().serialize(e)}var ub=` _-,;:!?.'"()[]{}@*/\\&#%\`^+<=>|~$0123456789abcdefghijklmnopqrstuvwxyz`,db=(function(){let e=new Uint8Array(128);for(let t=0;t<69;t++)e[ub.charCodeAt(t)]=t+1;for(let t=65;t<=90;t++)e[t]=e[t+32];return e})();function fb(e,t){if(e===t)return 0;let n=Math.min(e.length,t.length),r=0;for(let i=0;i<n;i++){let n=e.charCodeAt(i),a=t.charCodeAt(i);if(n===a)continue;let o=n<128&&db[n]?db[n]:n+128,s=a<128&&db[a]?db[a]:a+128;if(o!==s)return o<s?-1:1;r===0&&(r=n>a?-1:1)}return e.length===t.length?r:e.length<t.length?-1:1}var pb=(function(){class e{#e=new Map;compare(e,t){let n=typeof e,r=typeof t;return n===`string`&&r===`string`?fb(e,t):n===`number`&&r===`number`?e-t:fb(this.serialize(e,!0),this.serialize(t,!0))}serialize(e,t){if(e===null)return`null`;switch(typeof e){case`string`:return t?e:`'${e}'`;case`bigint`:return`${e}n`;case`object`:return this.$object(e);case`function`:return this.$function(e)}return String(e)}serializeObject(e){let t=Object.prototype.toString.call(e);if(t!==`[object Object]`)return this.serializeBuiltInType(t.length<10?`unknown:${t}`:t.slice(8,-1),e);let n=e.constructor,r=n===Object||n===void 0?``:n.name;if(r!==``&&globalThis[r]===n)return this.serializeBuiltInType(r,e);if(`toJSON`in e&&typeof e.toJSON==`function`){let t=e.toJSON();return r+(typeof t==`object`&&t?this.$object(t):`(${this.serialize(t)})`)}let i=Object.keys(e).sort(fb),a=`${r}{`;for(let t=0;t<i.length;t++){let n=i[t];a+=`${n}:${this.serialize(e[n])}`,t<i.length-1&&(a+=`,`)}return a+`}`}serializeBuiltInType(e,t){let n=this[`$`+e];if(n)return n.call(this,t);if(typeof t.entries==`function`)return this.serializeObjectEntries(e,t.entries());throw Error(`Cannot serialize ${e}`)}serializeObjectEntries(e,t){let n=Array.from(t).sort((e,t)=>this.compare(e[0],t[0])),r=`${e}{`;for(let e=0;e<n.length;e++){let[t,i]=n[e];r+=`${this.serialize(t,!0)}:${this.serialize(i)}`,e<n.length-1&&(r+=`,`)}return r+`}`}$object(e){let t=this.#e.get(e);return t===void 0&&(this.#e.set(e,`#${this.#e.size}`),t=this.serializeObject(e),this.#e.set(e,t)),t}$function(e){let t=Function.prototype.toString.call(e);return t.slice(-15)===`[native code] }`?`${e.name||``}()[native]`:`${e.name}(${e.length})${t.replace(/\s*\n\s*/g,``)}`}$Array(e){let t=`[`;for(let n=0;n<e.length;n++)t+=this.serialize(e[n]),n<e.length-1&&(t+=`,`);return t+`]`}$Date(e){try{return`Date(${e.toISOString()})`}catch{return`Date(null)`}}$ArrayBuffer(e){return`ArrayBuffer[${new Uint8Array(e).join(`,`)}]`}$Set(e){return`Set${this.$Array(Array.from(e).sort((e,t)=>this.compare(e,t)))}`}$Map(e){return this.serializeObjectEntries(`Map`,e.entries())}}for(let t of[`Error`,`RegExp`,`URL`])e.prototype[`$`+t]=function(e){return`${t}(${e})`};for(let t of[`Int8Array`,`Uint8Array`,`Uint8ClampedArray`,`Int16Array`,`Uint16Array`,`Int32Array`,`Uint32Array`,`Float32Array`,`Float64Array`])e.prototype[`$`+t]=function(e){return`${t}[${e.join(`,`)}]`};for(let t of[`BigInt64Array`,`BigUint64Array`])e.prototype[`$`+t]=function(e){return`${t}[${e.join(`n,`)}${e.length>0?`n`:``}]`};return e})(),mb=[1779033703,-1150833019,1013904242,-1521486534,1359893119,-1694144372,528734635,1541459225],hb=[1116352408,1899447441,-1245643825,-373957723,961987163,1508970993,-1841331548,-1424204075,-670586216,310598401,607225278,1426881987,1925078388,-2132889090,-1680079193,-1046744716,-459576895,-272742522,264347078,604807628,770255983,1249150122,1555081692,1996064986,-1740746414,-1473132947,-1341970488,-1084653625,-958395405,-710438585,113926993,338241895,666307205,773529912,1294757372,1396182291,1695183700,1986661051,-2117940946,-1838011259,-1564481375,-1474664885,-1035236496,-949202525,-778901479,-694614492,-200395387,275423344,430227734,506948616,659060556,883997877,958139571,1322822218,1537002063,1747873779,1955562222,2024104815,-2067236844,-1933114872,-1866530822,-1538233109,-1090935817,-965641998],gb=`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_`,_b=[],vb=class{_data=new yb;_hash=new yb([...mb]);_nDataBytes=0;_minBufferSize=0;finalize(e){e&&this._append(e);let t=this._nDataBytes*8,n=this._data.sigBytes*8;return this._data.words[n>>>5]|=128<<24-n%32,this._data.words[(n+64>>>9<<4)+14]=Math.floor(t/4294967296),this._data.words[(n+64>>>9<<4)+15]=t,this._data.sigBytes=this._data.words.length*4,this._process(),this._hash}_doProcessBlock(e,t){let n=this._hash.words,r=n[0],i=n[1],a=n[2],o=n[3],s=n[4],c=n[5],l=n[6],u=n[7];for(let n=0;n<64;n++){if(n<16)_b[n]=e[t+n]|0;else{let e=_b[n-15],t=(e<<25|e>>>7)^(e<<14|e>>>18)^e>>>3,r=_b[n-2],i=(r<<15|r>>>17)^(r<<13|r>>>19)^r>>>10;_b[n]=t+_b[n-7]+i+_b[n-16]}let d=s&c^~s&l,f=r&i^r&a^i&a,p=(r<<30|r>>>2)^(r<<19|r>>>13)^(r<<10|r>>>22),m=(s<<26|s>>>6)^(s<<21|s>>>11)^(s<<7|s>>>25),h=u+m+d+hb[n]+_b[n],g=p+f;u=l,l=c,c=s,s=o+h|0,o=a,a=i,i=r,r=h+g|0}n[0]=n[0]+r|0,n[1]=n[1]+i|0,n[2]=n[2]+a|0,n[3]=n[3]+o|0,n[4]=n[4]+s|0,n[5]=n[5]+c|0,n[6]=n[6]+l|0,n[7]=n[7]+u|0}_append(e){typeof e==`string`&&(e=yb.fromUtf8(e)),this._data.concat(e),this._nDataBytes+=e.sigBytes}_process(e){let t,n=this._data.sigBytes/64;n=e?Math.ceil(n):Math.max((n|0)-this._minBufferSize,0);let r=n*16,i=Math.min(r*4,this._data.sigBytes);if(r){for(let e=0;e<r;e+=16)this._doProcessBlock(this._data.words,e);t=this._data.words.splice(0,r),this._data.sigBytes-=i}return new yb(t,i)}},yb=class e{words;sigBytes;constructor(e,t){e=this.words=e||[],this.sigBytes=t===void 0?e.length*4:t}static fromUtf8(t){let n=unescape(encodeURIComponent(t)),r=n.length,i=[];for(let e=0;e<r;e++)i[e>>>2]|=(n.charCodeAt(e)&255)<<24-e%4*8;return new e(i,r)}toBase64(){let e=[];for(let t=0;t<this.sigBytes;t+=3){let n=this.words[t>>>2]>>>24-t%4*8&255,r=this.words[t+1>>>2]>>>24-(t+1)%4*8&255,i=this.words[t+2>>>2]>>>24-(t+2)%4*8&255,a=n<<16|r<<8|i;for(let n=0;n<4&&t*8+n*6<this.sigBytes*8;n++)e.push(gb.charAt(a>>>6*(3-n)&63))}return e.join(``)}concat(e){if(this.words[this.sigBytes>>>2]&=4294967295<<32-this.sigBytes%4*8,this.words.length=Math.ceil(this.sigBytes/4),this.sigBytes%4)for(let t=0;t<e.sigBytes;t++){let n=e.words[t>>>2]>>>24-t%4*8&255;this.words[this.sigBytes+t>>>2]|=n<<24-(this.sigBytes+t)%4*8}else for(let t=0;t<e.sigBytes;t+=4)this.words[this.sigBytes+t>>>2]=e.words[t>>>2];this.sigBytes+=e.sigBytes}};function bb(e){return new vb().finalize(e).toBase64()}function xb(e){return bb(lb(e))}function Sb(e){return xb(e)}function Cb(){let e={};function t(t,...n){let r=e[t]||[];for(let e=0,t=r.length;e<t;e++){let t=r[e];t&&t(...n)}}function n(n,...r){t(n,...r),delete e[n]}function r(t,n){return(e[t]||=[]).push(n),()=>{e[t]=e[t]?.filter(e=>n!==e)}}function i(e,t){let n=r(e,((...e)=>(n(),t(...e))));return n}return{_listeners:e,emit:t,emitOnce:n,on:r,once:i}}var wb=/^[\w+.-]{2,}:\/\//;function Tb(e){return e.endsWith(`/`)?e:`${e}/`}function Eb(e){return(e.endsWith(`/`)?e.slice(0,-1):e)||`/`}function Db(e,...t){let n=e;for(let e of t)e&&e!==`/`&&(n=n?Tb(n)+e.replace(/^\.?\//,``):e);return n}function Ob(e,t){if(!t||t===`/`||wb.test(e))return e;let n=Eb(t);return e.startsWith(n)?e:Db(n,e)}function kb(e,t){let n=e.match(wb);return t+(n?e.slice(n[0].length):e)}var Ab=`useandom-26T198340PX75pxJACKVERYMINDBUSHWOLF_GQZbfghjklqvwyzrict`;function jb(e=21){let t=``,n=e;for(;n--;)t+=Ab[Math.random()*64|0];return t}var Mb=Symbol.for(`immer-nothing`),Nb=Symbol.for(`immer-draftable`),Pb=Symbol.for(`immer-state`),Fb=[function(e){return`The plugin for '${e}' has not been loaded into Immer. To enable the plugin, import and call \`enable${e}()\` when initializing your application.`},function(e){return`produce can only be called on things that are draftable: plain objects, arrays, Map, Set or classes that are marked with '[immerable]: true'. Got '${e}'`},`This object has been frozen and should not be mutated`,function(e){return`Cannot use a proxy that has been revoked. Did you pass an object from inside an immer function to an async process? `+e},`An immer producer returned a new value *and* modified its draft. Either return a new value *or* modify the draft.`,`Immer forbids circular references`,"The first or second argument to `produce` must be a function","The third argument to `produce` must be a function or undefined","First argument to `createDraft` must be a plain object, an array, or an immerable object","First argument to `finishDraft` must be a draft returned by `createDraft`",function(e){return`'current' expects a draft, got: ${e}`},`Object.defineProperty() cannot be used on an Immer draft`,`Object.setPrototypeOf() cannot be used on an Immer draft`,`Immer only supports deleting array indices`,`Immer only supports setting array indices and the 'length' property`,function(e){return`'original' expects a draft, got: ${e}`}];function Ib(e,...t){{let n=Fb[e],r=ox(n)?n.apply(null,t):n;throw Error(`[Immer] ${r}`)}}var Lb=Object,Rb=Lb.getPrototypeOf,zb=`constructor`,Bb=`prototype`,Vb=`configurable`,Hb=`enumerable`,Ub=`writable`,Wb=`value`,Gb=e=>!!e&&!!e[Pb];function Kb(e){return e?Yb(e)||nx(e)||!!e[Nb]||!!e[zb]?.[Nb]||rx(e)||ix(e):!1}var qb=Lb[Bb][zb].toString(),Jb=new WeakMap;function Yb(e){if(!e||!ax(e))return!1;let t=Rb(e);if(t===null||t===Lb[Bb])return!0;let n=Lb.hasOwnProperty.call(t,zb)&&t[zb];if(n===Object)return!0;if(!ox(n))return!1;let r=Jb.get(n);return r===void 0&&(r=Function.toString.call(n),Jb.set(n,r)),r===qb}function Xb(e,t,n=!0){Zb(e)===0?(n?Reflect.ownKeys(e):Lb.keys(e)).forEach(n=>{t(n,e[n],e)}):e.forEach((n,r)=>t(r,n,e))}function Zb(e){let t=e[Pb];return t?t.type_:nx(e)?1:rx(e)?2:ix(e)?3:0}var Qb=(e,t,n=Zb(e))=>n===2?e.has(t):Lb[Bb].hasOwnProperty.call(e,t),$b=(e,t,n=Zb(e))=>n===2?e.get(t):e[t],ex=(e,t,n,r=Zb(e))=>{r===2?e.set(t,n):r===3?e.add(n):e[t]=n};function tx(e,t){return e===t?e!==0||1/e==1/t:e!==e&&t!==t}var nx=Array.isArray,rx=e=>e instanceof Map,ix=e=>e instanceof Set,ax=e=>typeof e==`object`,ox=e=>typeof e==`function`,sx=e=>typeof e==`boolean`;function cx(e){let t=+e;return Number.isInteger(t)&&String(t)===e}var lx=e=>ax(e)?e?.[Pb]:null,ux=e=>e.copy_||e.base_,dx=e=>e.modified_?e.copy_:e.base_;function fx(e,t){if(rx(e))return new Map(e);if(ix(e))return new Set(e);if(nx(e))return Array[Bb].slice.call(e);let n=Yb(e);if(t===!0||t===`class_only`&&!n){let t=Lb.getOwnPropertyDescriptors(e);delete t[Pb];let n=Reflect.ownKeys(t);for(let r=0;r<n.length;r++){let i=n[r],a=t[i];a[Ub]===!1&&(a[Ub]=!0,a[Vb]=!0),(a.get||a.set)&&(t[i]={[Vb]:!0,[Ub]:!0,[Hb]:a[Hb],[Wb]:e[i]})}return Lb.create(Rb(e),t)}{let t=Rb(e);if(t!==null&&n)return{...e};let r=Lb.create(t);return Lb.assign(r,e)}}function px(e,t=!1){return gx(e)||Gb(e)||!Kb(e)?e:(Zb(e)>1&&Lb.defineProperties(e,{set:hx,add:hx,clear:hx,delete:hx}),Lb.freeze(e),t&&Xb(e,(e,t)=>{px(t,!0)},!1),e)}function mx(){Ib(2)}var hx={[Wb]:mx};function gx(e){return e===null||!ax(e)||Lb.isFrozen(e)}var _x=`MapSet`,vx=`Patches`,yx=`ArrayMethods`,bx={};function xx(e){let t=bx[e];return t||Ib(0,e),t}var Sx=e=>!!bx[e];function Cx(e,t){bx[e]||(bx[e]=t)}var wx,Tx=()=>wx,Ex=(e,t)=>({drafts_:[],parent_:e,immer_:t,canAutoFreeze_:!0,unfinalizedDrafts_:0,handledSet_:new Set,processedForPatches_:new Set,mapSetPlugin_:Sx(_x)?xx(_x):void 0,arrayMethodsPlugin_:Sx(yx)?xx(yx):void 0});function Dx(e,t){t&&(e.patchPlugin_=xx(vx),e.patches_=[],e.inversePatches_=[],e.patchListener_=t)}function Ox(e){kx(e),e.drafts_.forEach(jx),e.drafts_=null}function kx(e){e===wx&&(wx=e.parent_)}var Ax=e=>wx=Ex(wx,e);function jx(e){let t=e[Pb];t.type_===0||t.type_===1?t.revoke_():t.revoked_=!0}function Mx(e,t){t.unfinalizedDrafts_=t.drafts_.length;let n=t.drafts_[0];if(e!==void 0&&e!==n){n[Pb].modified_&&(Ox(t),Ib(4)),Kb(e)&&(e=Nx(t,e));let{patchPlugin_:r}=t;r&&r.generateReplacementPatches_(n[Pb].base_,e,t)}else e=Nx(t,n);return Px(t,e,!0),Ox(t),t.patches_&&t.patchListener_(t.patches_,t.inversePatches_),e===Mb?void 0:e}function Nx(e,t){if(gx(t))return t;let n=t[Pb];if(!n)return Hx(t,e.handledSet_,e);if(!Ix(n,e))return t;if(!n.modified_)return n.base_;if(!n.finalized_){let{callbacks_:t}=n;if(t)for(;t.length>0;)t.pop()(e);Bx(n,e)}return n.copy_}function Px(e,t,n=!1){!e.parent_&&e.immer_.autoFreeze_&&e.canAutoFreeze_&&px(t,n)}function Fx(e){e.finalized_=!0,e.scope_.unfinalizedDrafts_--}var Ix=(e,t)=>e.scope_===t,Lx=[];function Rx(e,t,n,r){let i=ux(e),a=e.type_;if(r!==void 0&&$b(i,r,a)===t){ex(i,r,n,a);return}if(!e.draftLocations_){let t=e.draftLocations_=new Map;Xb(i,(e,n)=>{if(Gb(n)){let r=t.get(n)||[];r.push(e),t.set(n,r)}})}let o=e.draftLocations_.get(t)??Lx;for(let e of o)ex(i,e,n,a)}function zx(e,t,n){e.callbacks_.push(function(r){let i=t;if(!i||!Ix(i,r))return;r.mapSetPlugin_?.fixSetContents(i);let a=dx(i);Rx(e,i.draft_??i,a,n),Bx(i,r)})}function Bx(e,t){if(e.modified_&&!e.finalized_&&(e.type_===3||e.type_===1&&e.allIndicesReassigned_||(e.assigned_?.size??0)>0)){let{patchPlugin_:n}=t;if(n){let r=n.getPath(e);r&&n.generatePatches_(e,r,t)}Fx(e)}}function Vx(e,t,n){let{scope_:r}=e;if(Gb(n)){let i=n[Pb];Ix(i,r)&&i.callbacks_.push(function(){Zx(e),Rx(e,n,dx(i),t)})}else Kb(n)&&e.callbacks_.push(function(){let i=ux(e);e.type_===3?i.has(n)&&Hx(n,r.handledSet_,r):$b(i,t,e.type_)===n&&r.drafts_.length>1&&(e.assigned_.get(t)??!1)===!0&&e.copy_&&Hx($b(e.copy_,t,e.type_),r.handledSet_,r)})}function Hx(e,t,n){return!n.immer_.autoFreeze_&&n.unfinalizedDrafts_<1||Gb(e)||t.has(e)||!Kb(e)||gx(e)?e:(t.add(e),Xb(e,(r,i)=>{if(Gb(i)){let t=i[Pb];Ix(t,n)&&(ex(e,r,dx(t),e.type_),Fx(t))}else Kb(i)&&Hx(i,t,n)}),e)}function Ux(e,t){let n=nx(e),r={type_:+!!n,scope_:t?t.scope_:Tx(),modified_:!1,finalized_:!1,assigned_:void 0,parent_:t,base_:e,draft_:null,copy_:null,revoke_:null,isManual_:!1,callbacks_:void 0},i=r,a=Wx;n&&(i=[r],a=Gx);let{revoke:o,proxy:s}=Proxy.revocable(i,a);return r.draft_=s,r.revoke_=o,[s,r]}var Wx={get(e,t){if(t===Pb)return e;let n=e.scope_.arrayMethodsPlugin_,r=e.type_===1&&typeof t==`string`;if(r&&n?.isArrayOperationMethod(t))return n.createMethodInterceptor(e,t);let i=ux(e);if(!Qb(i,t,e.type_))return Jx(e,i,t);let a=i[t];if(e.finalized_||!Kb(a)||r&&e.operationMethod&&n?.isMutatingArrayMethod(e.operationMethod)&&cx(t))return a;if(a===Kx(e.base_,t)||qx(e,t,a)){Zx(e);let n=e.type_===1?+t:t,r=$x(e.scope_,a,e,n);return e.copy_[n]=r}return a},has(e,t){return t in ux(e)},ownKeys(e){return Reflect.ownKeys(ux(e))},set(e,t,n){let r=Yx(ux(e),t);if(r?.set)return r.set.call(e.draft_,n),!0;if(!e.modified_){let r=Kx(ux(e),t),i=r?.[Pb];if(i&&i.base_===n)return e.copy_[t]=n,e.assigned_.set(t,!1),!0;if(tx(n,r)&&(n!==void 0||Qb(e.base_,t,e.type_)))return!0;Zx(e),Xx(e)}return e.copy_[t]===n&&(n!==void 0||Qb(e.copy_,t,e.type_))||Number.isNaN(n)&&Number.isNaN(e.copy_[t])?!0:(e.copy_[t]=n,e.assigned_.set(t,!0),Vx(e,t,n),!0)},deleteProperty(e,t){return Zx(e),Kx(e.base_,t)!==void 0||t in e.base_?(e.assigned_.set(t,!1),Xx(e)):e.assigned_.delete(t),e.copy_&&delete e.copy_[t],!0},getOwnPropertyDescriptor(e,t){let n=ux(e),r=Reflect.getOwnPropertyDescriptor(n,t);return r&&{[Ub]:!0,[Vb]:e.type_!==1||t!==`length`,[Hb]:r[Hb],[Wb]:n[t]}},defineProperty(){Ib(11)},getPrototypeOf(e){return Rb(e.base_)},setPrototypeOf(){Ib(12)}},Gx={};for(let e in Wx){let t=Wx[e];Gx[e]=function(){let e=arguments;return e[0]=e[0][0],t.apply(this,e)}}Gx.deleteProperty=function(e,t){return isNaN(parseInt(t))&&Ib(13),Gx.set.call(this,e,t,void 0)},Gx.set=function(e,t,n){return t!==`length`&&isNaN(parseInt(t))&&Ib(14),Wx.set.call(this,e[0],t,n,e[0])};function Kx(e,t){let n=e[Pb];return(n?ux(n):e)[t]}function qx(e,t,n){return e.type_!==1||!e.allIndicesReassigned_||e.assigned_?.get(t)||!Kb(n)||n[Pb]?!1:e.baseRefs_.has(n)}function Jx(e,t,n){let r=Yx(t,n);return r?Wb in r?r[Wb]:r.get?.call(e.draft_):void 0}function Yx(e,t){if(!(t in e))return;let n=Rb(e);for(;n;){let e=Object.getOwnPropertyDescriptor(n,t);if(e)return e;n=Rb(n)}}function Xx(e){e.modified_||(e.modified_=!0,e.parent_&&Xx(e.parent_))}function Zx(e){e.copy_||=(e.assigned_=new Map,fx(e.base_,e.scope_.immer_.useStrictShallowCopy_))}var Qx=class{constructor(e){this.autoFreeze_=!0,this.useStrictShallowCopy_=!1,this.useStrictIteration_=!1,this.produce=(e,t,n)=>{if(ox(e)&&!ox(t)){let n=t;t=e;let r=this;return function(e=n,...i){return r.produce(e,e=>t.call(this,e,...i))}}ox(t)||Ib(6),n!==void 0&&!ox(n)&&Ib(7);let r;if(Kb(e)){let i=Ax(this),a=$x(i,e,void 0),o=!0;try{r=t(a),o=!1}finally{o?Ox(i):kx(i)}return Dx(i,n),Mx(r,i)}if(!e||!ax(e)){if(r=t(e),r===void 0&&(r=e),r===Mb&&(r=void 0),this.autoFreeze_&&px(r,!0),n){let t=[],i=[];xx(vx).generateReplacementPatches_(e,r,{patches_:t,inversePatches_:i}),n(t,i)}return r}Ib(1,e)},this.produceWithPatches=(e,t)=>{if(ox(e))return(t,...n)=>this.produceWithPatches(t,t=>e(t,...n));let n,r;return[this.produce(e,t,(e,t)=>{n=e,r=t}),n,r]},sx(e?.autoFreeze)&&this.setAutoFreeze(e.autoFreeze),sx(e?.useStrictShallowCopy)&&this.setUseStrictShallowCopy(e.useStrictShallowCopy),sx(e?.useStrictIteration)&&this.setUseStrictIteration(e.useStrictIteration)}createDraft(e){Kb(e)||Ib(8),Gb(e)&&(e=eS(e));let t=Ax(this),n=$x(t,e,void 0);return n[Pb].isManual_=!0,kx(t),n}finishDraft(e,t){let n=e&&e[Pb];(!n||!n.isManual_)&&Ib(9);let{scope_:r}=n;return Dx(r,t),Mx(void 0,r)}setAutoFreeze(e){this.autoFreeze_=e}setUseStrictShallowCopy(e){this.useStrictShallowCopy_=e}setUseStrictIteration(e){this.useStrictIteration_=e}shouldUseStrictIteration(){return this.useStrictIteration_}applyPatches(e,t){let n;for(n=t.length-1;n>=0;n--){let r=t[n];if(r.path.length===0&&r.op===`replace`){e=r.value;break}}n>-1&&(t=t.slice(n+1));let r=xx(vx).applyPatches_;return Gb(e)?r(e,t):this.produce(e,e=>r(e,t))}};function $x(e,t,n,r){let[i,a]=rx(t)?xx(_x).proxyMap_(t,n):ix(t)?xx(_x).proxySet_(t,n):Ux(t,n);return(n?.scope_??Tx()).drafts_.push(i),a.callbacks_=n?.callbacks_??[],a.key_=r,n&&r!==void 0?zx(n,a,r):a.callbacks_.push(function(e){e.mapSetPlugin_?.fixSetContents(a);let{patchPlugin_:t}=e;a.modified_&&t&&t.generatePatches_(a,[],e)}),i}function eS(e){return Gb(e)||Ib(10,e),tS(e)}function tS(e){if(!Kb(e)||gx(e))return e;let t=e[Pb],n,r=!0;if(t){if(!t.modified_)return t.base_;t.finalized_=!0,n=fx(e,t.scope_.immer_.useStrictShallowCopy_),r=t.scope_.immer_.shouldUseStrictIteration()}else n=fx(e,!0);return Xb(n,(e,t)=>{ex(n,e,tS(t))},r),t&&(t.finalized_=!1),n}function nS(){Fb.push(`Sets cannot have "replace" patches.`,function(e){return`Unsupported patch operation: `+e},function(e){return`Cannot apply patch, path doesn't resolve: `+e},`Patching reserved attributes like __proto__, prototype and constructor is not allowed`);function e(n,r=[]){if(n.key_!==void 0){let e=n.parent_.copy_??n.parent_.base_,t=lx($b(e,n.key_)),i=$b(e,n.key_);if(i===void 0||i!==n.draft_&&i!==n.base_&&i!==n.copy_||t!=null&&t.base_!==n.base_)return null;let a=n.parent_.type_===3,o;if(a){let e=n.parent_;o=Array.from(e.drafts_.keys()).indexOf(n.key_)}else o=n.key_;if(!(a&&e.size>o||Qb(e,o)))return null;r.push(o)}if(n.parent_)return e(n.parent_,r);r.reverse();try{t(n.copy_,r)}catch{return null}return r}function t(e,t){let n=e;for(let e=0;e<t.length-1;e++){let r=t[e];if(n=$b(n,r),!ax(n)||n===null)throw Error(`Cannot resolve path at '${t.join(`/`)}'`)}return n}let n=`replace`,r=`remove`;function i(e,t,n){if(e.scope_.processedForPatches_.has(e))return;e.scope_.processedForPatches_.add(e);let{patches_:r,inversePatches_:i}=n;switch(e.type_){case 0:case 2:return o(e,t,r,i);case 1:return a(e,t,r,i);case 3:return s(e,t,r,i)}}function a(e,t,i,a){let{base_:o,assigned_:s}=e,c=e.copy_;c.length<o.length&&([o,c]=[c,o],[i,a]=[a,i]);let l=e.allIndicesReassigned_===!0;for(let e=0;e<o.length;e++){let r=c[e],u=o[e];if((l||s?.get(e.toString()))&&r!==u){let o=r?.[Pb];if(o&&o.modified_)continue;let s=t.concat([e]);i.push({op:n,path:s,value:d(r)}),a.push({op:n,path:s,value:d(u)})}}for(let e=o.length;e<c.length;e++){let n=t.concat([e]);i.push({op:`add`,path:n,value:d(c[e])})}for(let e=c.length-1;o.length<=e;--e){let n=t.concat([e]);a.push({op:r,path:n})}}function o(e,t,i,a){let{base_:o,copy_:s,type_:c}=e;Xb(e.assigned_,(e,l)=>{let u=$b(o,e,c),f=$b(s,e,c),p=l?Qb(o,e)?n:`add`:r;if(u===f&&p===n)return;let m=t.concat(e);i.push(p===r?{op:p,path:m}:{op:p,path:m,value:d(f)}),a.push(p===`add`?{op:r,path:m}:p===r?{op:`add`,path:m,value:d(u)}:{op:n,path:m,value:d(u)})})}function s(e,t,n,i){let{base_:a,copy_:o}=e,s=0;a.forEach(e=>{if(!o.has(e)){let a=t.concat([s]);n.push({op:r,path:a,value:e}),i.unshift({op:`add`,path:a,value:e})}s++}),s=0,o.forEach(e=>{if(!a.has(e)){let a=t.concat([s]);n.push({op:`add`,path:a,value:e}),i.unshift({op:r,path:a,value:e})}s++})}function c(e,t,r){let{patches_:i,inversePatches_:a}=r;i.push({op:n,path:[],value:t===Mb?void 0:t}),a.push({op:n,path:[],value:e})}function l(e,t){return t.forEach(t=>{let{path:i,op:a}=t,o=e;for(let e=0;e<i.length-1;e++){let t=Zb(o),n=i[e];typeof n!=`string`&&typeof n!=`number`&&(n=``+n),(t===0||t===1)&&(n===`__proto__`||n===zb)&&Ib(19),ox(o)&&n===Bb&&Ib(19),o=$b(o,n),(o===null||!ax(o))&&Ib(18,i.join(`/`))}let s=Zb(o),c=u(t.value),l=i[i.length-1];switch(a){case n:switch(s){case 2:return o.set(l,c);case 3:Ib(16);default:return o[l]=c}case`add`:switch(s){case 1:return l===`-`?o.push(c):o.splice(l,0,c);case 2:return o.set(l,c);case 3:return o.add(c);default:return o[l]=c}case r:switch(s){case 1:return o.splice(l,1);case 2:return o.delete(l);case 3:return o.delete(t.value);default:return delete o[l]}default:Ib(17,a)}}),e}function u(e){if(!Kb(e))return e;if(nx(e))return e.map(u);if(rx(e))return new Map(Array.from(e.entries()).map(([e,t])=>[e,u(t)]));if(ix(e))return new Set(Array.from(e).map(u));let t=Object.create(Rb(e));for(let n in e)t[n]=u(e[n]);return Qb(e,Nb)&&(t[Nb]=e[Nb]),t}function d(e){return Gb(e)?u(e):e}Cx(vx,{applyPatches_:l,generatePatches_:i,generateReplacementPatches_:c,getPath:e})}globalThis.Iterator?.from;var rS=new Qx,iS=rS.produce,aS=rS.produceWithPatches.bind(rS),oS=rS.applyPatches.bind(rS),sS=1e3;function cS(e,t){if(e.add(t),e.size>sS){let t=e.values().next().value;t!==void 0&&e.delete(t)}}function lS(e){let{enablePatches:t=!1}=e;t&&nS();let n=Cb(),r=e.initialValue,i=new Set;return{on:n.on,value:()=>r,patch:(e,t=jb())=>{i.has(t)||(nS(),r=oS(r,e),cS(i,t),n.emit(`updated`,r,void 0,t))},mutate:(e,a=jb())=>{if(!i.has(a)){if(cS(i,a),t){let[t,i]=aS(r,e);if(t===r)return;r=t,n.emit(`updated`,r,i,a)}else{let t=iS(r,e);if(t===r)return;r=t,n.emit(`updated`,r,void 0,a)}}},syncIds:i}}var uS=typeof self==`object`?self:globalThis,dS=new Set([`Error`,`EvalError`,`RangeError`,`ReferenceError`,`SyntaxError`,`TypeError`,`URIError`,`AggregateError`]),fS=new Set([`Boolean`,`Number`,`String`,`Int8Array`,`Uint8Array`,`Uint8ClampedArray`,`Int16Array`,`Uint16Array`,`Int32Array`,`Uint32Array`,`Float16Array`,`Float32Array`,`Float64Array`,`BigInt64Array`,`BigUint64Array`]);function pS(e,t){let n=(t,n)=>(e.set(n,t),t),r=i=>{if(e.has(i))return e.get(i);let[a,o]=t[i];switch(a){case 0:case-1:return n(o,i);case 1:{let e=n([],i);for(let t of o)e.push(r(t));return e}case 2:{let e=n({},i);for(let[t,n]of o)e[r(t)]=r(n);return e}case 3:return n(new Date(o),i);case 4:{let{source:e,flags:t}=o;return n(new RegExp(e,t),i)}case 5:{let e=n(new Map,i);for(let[t,n]of o)e.set(r(t),r(n));return e}case 6:{let e=n(new Set,i);for(let t of o)e.add(r(t));return e}case 7:{let{name:e,message:t}=o,r=dS.has(e)?uS[e]:void 0;return n(new(r??uS.Error)(t),i)}case 8:return n(BigInt(o),i);case`BigInt`:return n(Object(BigInt(o)),i);case`ArrayBuffer`:return n(new Uint8Array(o).buffer,o);case`DataView`:{let{buffer:e}=new Uint8Array(o);return n(new DataView(e),o)}}if(typeof a==`string`&&fS.has(a))return n(new uS[a](o),i);throw TypeError(`unable to deserialize unsafe or unknown type: ${String(a)}`)};return r}function mS(e){return pS(new Map,e)(0)}var hS=``,{toString:gS}={},{keys:_S}=Object;function vS(e){let t=typeof e;if(t!==`object`||!e)return[0,t];let n=gS.call(e).slice(8,-1);switch(n){case`Array`:return[1,hS];case`Object`:return[2,hS];case`Date`:return[3,hS];case`RegExp`:return[4,hS];case`Map`:return[5,hS];case`Set`:return[6,hS];case`DataView`:return[1,n]}return n.includes(`Array`)?[1,n]:n.includes(`Error`)?[7,n]:[2,n]}function yS([e,t]){return e===0&&(t===`function`||t===`symbol`)}function bS(e,t,n,r){let i=(e,t)=>{let i=r.push(e)-1;return n.set(t,i),i},a=r=>{if(n.has(r))return n.get(r);let[o,s]=vS(r);switch(o){case 0:{let t=r;switch(s){case`bigint`:o=8,t=r.toString();break;case`function`:case`symbol`:if(e)throw TypeError(`unable to serialize ${s}`);t=null;break;case`undefined`:return i([-1],r)}return i([o,t],r)}case 1:{if(s){let e=r;return s===`DataView`?e=new Uint8Array(r.buffer):s===`ArrayBuffer`&&(e=new Uint8Array(r)),i([s,[...e]],r)}let e=[],t=i([o,e],r);for(let t of r)e.push(a(t));return t}case 2:{if(s)switch(s){case`BigInt`:return i([s,r.toString()],r);case`Boolean`:case`Number`:case`String`:return i([s,r.valueOf()],r)}if(t&&`toJSON`in r)return a(r.toJSON());let n=[],c=i([o,n],r);for(let t of _S(r))(e||!yS(vS(r[t])))&&n.push([a(t),a(r[t])]);return c}case 3:return i([o,r.toISOString()],r);case 4:{let{source:e,flags:t}=r;return i([o,{source:e,flags:t}],r)}case 5:{let t=[],n=i([o,t],r);for(let[n,i]of r)(e||!(yS(vS(n))||yS(vS(i))))&&t.push([a(n),a(i)]);return n}case 6:{let t=[],n=i([o,t],r);for(let n of r)(e||!yS(vS(n)))&&t.push(a(n));return n}}let{message:c}=r;return i([o,{name:s,message:c}],r)};return a}function xS(e,t={}){let n=[];return bS(!(t.json||t.lossy),!!t.json,new Map,n)(e),n}var{parse:SS,stringify:CS}=JSON,wS={json:!0,lossy:!0};function TS(e){return mS(SS(e))}function ES(e){return CS(xS(e,wS))}function DS(e){return mS(e)}function OS(e){return ES(e)}function kS(e){return TS(e)}var AS=256,jS=class extends Error{name=`StreamClosedError`};function MS(e={}){let t=e.id??jb(),n=Math.max(0,e.replayWindow??0),r=Cb(),i=new AbortController,a=[],o=!1,s=0;function c(e){if(o)throw new jS(`Cannot write to a closed stream "${t}"`);s+=1,n>0&&(a.push({seq:s,chunk:e}),a.length>n&&(a.length-n===1?a.shift():a.splice(0,a.length-n))),r.emit(`chunk`,s,e)}function l(e){if(o)return;o=!0;let t=PS(e);i.abort(e),r.emit(`end`,t)}function u(){o||(o=!0,i.signal.aborted||i.abort(`stream closed`),r.emit(`end`,void 0))}function d(e){o||i.signal.aborted||i.abort(e??`aborted`)}let f=new WritableStream({write(e){c(e)},close(){u()},abort(e){l(e)}});return{id:t,signal:i.signal,get closed(){return o},get lastSeq(){return s},write:c,error:l,close:u,abort:d,writable:f,events:r,buffer:a}}function NS(e={}){let t=e.id??jb(),n=Math.max(1,e.highWaterMark??AS),r=[],i=0,a=!1,o=!1,s,c,l,u;function d(){if(c){if(r.length>0){let e=r.shift(),t=c;c=void 0,t.resolve({value:e,done:!1});return}if(a){let e=c;if(c=void 0,s){let t=Error(s.message);t.name=s.name,e.reject(t)}else e.resolve({value:void 0,done:!0})}}}function f(){if(l){for(;r.length>0;){let e=r.shift();try{l.enqueue(e)}catch{break}}if(a&&l){try{if(s){let e=Error(s.message);e.name=s.name,l.error(e)}else l.close()}catch{}l=void 0}}}function p(t,s){if(!(a||o)&&!(t<=i)){if(i=t,r.push(s),r.length>n){let t=r.length-n;r.splice(0,t),e.onOverflow?.(t)}d(),u&&f()}}function m(e){a||(a=!0,s=e,d(),u&&f())}function h(){o||a||(o=!0,e.onCancel?.(),m(void 0))}function g(){return u||(u=new ReadableStream({start(e){l=e,f()},cancel(){h()}}),u)}return{id:t,get cancelled(){return o},get done(){return a},get lastSeenSeq(){return i},get readable(){return g()},cancel:h,_push:p,_end:m,[Symbol.asyncIterator](){return{next(){if(r.length>0)return Promise.resolve({value:r.shift(),done:!1});if(a){if(s){let e=Error(s.message);return e.name=s.name,Promise.reject(e)}return Promise.resolve({value:void 0,done:!0})}return new Promise((e,t)=>{c={resolve:e,reject:t}})},return(){return h(),Promise.resolve({value:void 0,done:!0})}}}}}function PS(e){if(e instanceof Error)return{name:e.name||`Error`,message:e.message};if(typeof e==`string`)return{name:`Error`,message:e};try{return{name:`Error`,message:JSON.stringify(e)}}catch{return{name:`Error`,message:String(e)}}}var FS=128;function IS(e){return e.replace(/[^\w-]+/g,`_`).slice(0,FS)}var LS=`modulepreload`,RS=function(e,t){return new URL(e,t).href},zS={},BS=function(e,t,n){let r=Promise.resolve();if(t&&t.length>0){let e=document.getElementsByTagName(`link`),i=document.querySelector(`meta[property=csp-nonce]`),a=i?.nonce||i?.getAttribute(`nonce`);function o(e){return Promise.all(e.map(e=>Promise.resolve(e).then(e=>({status:`fulfilled`,value:e}),e=>({status:`rejected`,reason:e}))))}function s(e){return import.meta.resolve?import.meta.resolve(e):new URL(e,import.meta.url).href}r=o(t.map(t=>{if(t=RS(t,n),t=s(t),t in zS)return;zS[t]=!0;let r=t.endsWith(`.css`);for(let n=e.length-1;n>=0;n--){let i=e[n];if(i.href===t&&(!r||i.rel===`stylesheet`))return}let i=document.createElement(`link`);if(i.rel=r?`stylesheet`:LS,r||(i.as=`script`),i.crossOrigin=``,i.href=t,a&&i.setAttribute(`nonce`,a),document.head.appendChild(i),r)return new Promise((e,n)=>{i.addEventListener(`load`,e),i.addEventListener(`error`,()=>n(Error(`Unable to preload CSS for ${t}`)))})}).filter(e=>e!==void 0))}function i(e){let t=new Event(`vite:preloadError`,{cancelable:!0});if(t.payload=e,window.dispatchEvent(t),!t.defaultPrevented)throw e}return r.then(t=>{for(let e of t||[])e.status===`rejected`&&i(e.reason);return e().catch(i)})},VS=`__connection.json`,HS=`__DEVFRAME_CONNECTION__`,US=`x-birpc-session`,WS=`__rpc-dump/index.json`,GS=`devframe:services`,KS=`devframe_otp`,qS=`devframe_auth_token`;Uy.postMessage.remoteAssetsError;var JS=class{cacheMap=new Map;options;keySerializer;constructor(e){this.options=e,this.keySerializer=e.keySerializer||(e=>Sb(e))}updateOptions(e){this.options={...this.options,...e}}cached(e,t){let n=this.cacheMap.get(e);if(n)return n.get(this.keySerializer(t))}has(e,t){return this.cacheMap.get(e)?.has(this.keySerializer(t))??!1}apply(e,t){let n=this.cacheMap.get(e.m)||new Map;n.set(this.keySerializer(e.a),t),this.cacheMap.set(e.m,n)}validate(e){return this.options.functions.includes(e)}clear(e){e?this.cacheMap.delete(e):this.cacheMap.clear()}},YS=Ky({docsBase:`https://devfra.me/errors`,codes:{DF0019:{why:e=>`RPC function "${e.name}" has \`agent\` set but \`jsonSerializable\` is \`false\`; MCP requires JSON-serializable data.`,fix:"Remove `jsonSerializable: false`, or remove `agent` to keep it RPC-only."},DF0020:{why:e=>`RPC function "${e.name}" declares \`jsonSerializable: true\` but the value at "${e.path}" is a ${e.type}.`,fix:"Either drop `jsonSerializable: true` (falls back to structured-clone) or change the value to a JSON-safe shape."},DF0021:{why:e=>`RPC function "${e.name}" is already registered`,fix:"Use the `force` parameter to overwrite an existing registration."},DF0022:{why:e=>`RPC function "${e.name}" is not registered. Use register() to add new functions.`},DF0023:{why:e=>`RPC function "${e.name}" is not registered`},DF0024:{why:e=>`Either handler or setup function must be provided for RPC function "${e.name}"`},DF0025:{why:e=>`Function "${e.name}" not found in dump store`},DF0026:{why:e=>`No dump match for "${e.name}" with args: ${e.args}`},DF0027:{why:e=>`Function "${e.name}" with type "${e.type}" cannot have dump configuration. Only "static" and "query" types support dumps.`},DF0028:{why:e=>`Function "${e.name}" with type "${e.type}" cannot use \`snapshot: true\`. Only "query" functions support this sugar; "static" functions have equivalent default behavior already.`,fix:"Remove `snapshot: true`, or change the function type to `query`."},DF0043:{why:e=>`RPC function "${e.name}" received an invalid argument at position ${e.index}: ${e.issues}`,fix:"Pass a value that satisfies the `args` schema declared for this function."},DF0044:{why:e=>`RPC function "${e.name}" returned a value that failed its \`returns\` schema: ${e.issues}`,fix:"Make the handler return a value that satisfies the `returns` schema, or relax the schema."}}});function XS(e){if(e.agent&&e.jsonSerializable===!1)throw YS.DF0019({name:e.name});e.agent&&!e.jsonSerializable&&(e.jsonSerializable=!0)}async function ZS(e,t){let n=e[`~standard`].validate(t);return n instanceof Promise?await n:n}function QS(e){return e.map(e=>{let t=e.path?.map(e=>typeof e==`object`?e.key:e).join(`.`);return t?`${t}: ${e.message}`:e.message}).join(`; `)}async function $S(e,t,n){let r=n.slice();if(!t||t.length===0)return r;for(let r=0;r<t.length;r++){let i=t[r];if(!i)continue;let a=await ZS(i,n[r]);if(a.issues)throw YS.DF0043({name:e,index:r,issues:QS(a.issues)})}return r}async function eC(e,t,n){if(!t)return n;let r=await ZS(t,n);if(r.issues)throw YS.DF0044({name:e,issues:QS(r.issues)});return n}async function tC(e,t){if(!e.setup)return{};if(typeof t==`object`&&t){e.__cache??=new WeakMap;let n=e.__cache,r=n.get(t);return r||(r=Promise.resolve(e.setup(t)),r.catch(()=>{n.get(t)===r&&n.delete(t)}),n.set(t,r)),await r}if(!e.__promise){let n=Promise.resolve(e.setup(t));n.catch(()=>{e.__promise===n&&(e.__promise=void 0)}),e.__promise=n}return await e.__promise}async function nC(e,t){let n=e.handler;if(!n){let r=await tC(e,t);if(!r.handler)throw YS.DF0024({name:e.name});n=r.handler}let r=e.args,i=e.returns;if(!r&&!i)return n;let a=n;return async(...t)=>{let n=await $S(e.name,r,t),o=await a(...n);return await eC(e.name,i,o)}}var rC=class{context;definitions=new Map;functions;_onChanged=[];constructor(e){this.context=e;let t=this.definitions,n=this;this.functions=new Proxy({},{get(e,r){let i=t.get(r);if(i)return nC(i,n.context)},has(e,n){return t.has(n)},getOwnPropertyDescriptor(e,n){return{value:t.get(n)?.handler,configurable:!0,enumerable:!0}},ownKeys(){return Array.from(t.keys())}})}register(e,t=!1){if(this.definitions.has(e.name)&&!t)throw YS.DF0021({name:e.name});XS(e),this.definitions.set(e.name,e),this._onChanged.forEach(t=>t(e.name))}update(e,t=!1){if(!this.definitions.has(e.name)&&!t)throw YS.DF0022({name:e.name});XS(e),this.definitions.set(e.name,e),this._onChanged.forEach(t=>t(e.name))}onChanged(e){return this._onChanged.push(e),()=>{let t=this._onChanged.indexOf(e);t!==-1&&this._onChanged.splice(t,1)}}async getHandler(e){return await nC(this.definitions.get(e),this.context)}getSchema(e){let t=this.definitions.get(e);if(!t)throw YS.DF0023({name:String(e)});return{args:t.args,returns:t.returns}}has(e){return this.definitions.has(e)}get(e){return this.definitions.get(e)}list(){return Array.from(this.definitions.keys())}};function iC(e,t=``){return JSON.stringify(e,function(e,n){let r=this,i=r==null?n:r[e];if(i===void 0){if(Array.isArray(r))throw oC(t,`undefined`,r,e);return n}return i!==null&&aC(i,r,e,t),n})}function aC(e,t,n,r){if(typeof e==`bigint`)throw oC(r,`BigInt`,t,n);if(typeof e!=`object`)return;if(e instanceof Map)throw oC(r,`Map`,t,n);if(e instanceof Set)throw oC(r,`Set`,t,n);if(e instanceof Date)throw oC(r,`Date`,t,n);if(Array.isArray(e))return;let i=Object.getPrototypeOf(e);if(i!==null&&i!==Object.prototype)throw oC(r,e.constructor?.name??`class instance`,t,n)}function oC(e,t,n,r){let i=sC(n,r);return YS.DF0020({name:e||`<anonymous>`,type:t,path:i})}function sC(e,t){return Array.isArray(e)?`[${t}]`:t===``?`<root>`:t}var cC=`__DEVFRAME_CONNECTION_META__`,lC=`__DEVFRAME_CONNECTION_AUTH_TOKEN__`;function uC(e){let t=[()=>window?.[e],()=>globalThis?.[e],()=>parent.window?.[e]];for(let e of t)try{let t=e();if(t)return t}catch{}}function dC(){return uC(HS)}function fC(){return uC(cC)}function pC(e){if(e)return e;try{let e=localStorage.getItem(lC);if(e)return e}catch{}return uC(lC)}function mC(e){globalThis[HS]=e,globalThis[cC]={...e.connectionMeta,baseUrl:e.metaBaseUrl},e.authToken&&hC(e.authToken)}function hC(e){try{localStorage.setItem(lC,e)}catch{}globalThis[lC]=e;let t=dC();t&&(globalThis[HS]={...t,authToken:e})}function gC(e){let t=Ob(VS,e);try{return new URL(t,globalThis.location?.href).href}catch{return t}}function _C(e,t){return t&&t!==e.authToken?{...e,authToken:t}:e}function vC(){let e=dC();if(e)return _C(e,pC()??e.authToken??e.connectionMeta.authToken);let t=fC();if(t)return{connectionMeta:t,metaBaseUrl:t.baseUrl??gC(`./`),authToken:pC(t.authToken)}}async function yC(e={}){if(e.connection){let t=_C(e.connection,pC(e.authToken??e.connection.authToken??e.connection.connectionMeta.authToken));return mC(t),t}let t=Array.isArray(e.baseURL)?e.baseURL:[e.baseURL??`./`];if(e.connectionMeta){let n={connectionMeta:e.connectionMeta,metaBaseUrl:gC(t[0]??`./`),authToken:pC(e.authToken??e.connectionMeta.authToken)};return mC(n),n}let n=vC();if(n){let t=_C(n,pC(e.authToken??n.authToken??n.connectionMeta.authToken));return mC(t),t}let r=[];for(let n of t){let t=Ob(VS,n),i=gC(n);try{let n=await fetch(t);if(!n.ok)throw Error(`Failed to fetch connection meta from ${i}: ${n.status}`);let r=await n.json(),a=n.url||i,o={connectionMeta:r,metaBaseUrl:r.baseUrl?new URL(r.baseUrl,a).href:a,authToken:pC(e.authToken??r.authToken)};return mC(o),o}catch(e){r.push(e)}}throw Error(`Failed to get connection meta from ${t.join(`, `)}`,{cause:r})}var bC=class extends Error{name=`DevframeConnectionError`;kind;constructor(e,t,n){super(t,n),this.kind=e}};function xC(e=KS){try{let t=globalThis.location?.hash?.replace(/^#/,``)??``;return new URLSearchParams(t).get(e)||void 0}catch{return}}function SC(e){try{let t=new URL(globalThis.location.href),n=new URLSearchParams(t.hash.replace(/^#/,``));if(!n.has(e))return;n.delete(e),t.hash=n.toString(),globalThis.history?.replaceState(globalThis.history.state,``,t.href)}catch{}}function CC(e=KS){let t=xC(e);return t&&SC(e),t}async function wC(e,t={}){let n=CC(t.param??`devframe_otp`);return n?e.isTrusted?!0:e.requestTrustWithCode(n):!1}function TC(e){let t={},n=new WeakMap,r,i=()=>(r??=e.sharedState.get(GS,{initialValue:{}}).then(e=>(t=e.value(),e.on(`updated`,e=>{t=e}),e)),r);return i(),{state:i,has:e=>e in t,keys:()=>Object.keys(t),get:r=>{let i=t[r];if(!i)return;let a=n.get(i);return a||(a={...i,rpc:e.scope(i.scope).rpc},n.set(i,a)),a}}}function EC(e){let t=new Map,n=new Map,r=new Map,i=new Set,a=e.connectionMeta.backend===`static`;function o(e,t){let n=r.get(e);return n&&typeof n==`object`&&!Array.isArray(n)&&typeof t==`object`&&!Array.isArray(t)?{...n,...t}:t}e.client.register({name:Uy.broadcast.clientStateUpdated,type:`event`,handler:(e,n,r)=>{let i=t.get(e);i&&!i.syncIds.has(r)&&i.mutate(()=>o(e,n),r)}}),e.client.register({name:Uy.broadcast.clientStatePatch,type:`event`,handler:(e,n,r)=>{let i=t.get(e);i&&!i.syncIds.has(r)&&i.patch(n,r)}});function s(t,n){let r=[];return r.push(n.on(`updated`,(n,r,i)=>{a||(r?e.callEvent(`devframe:rpc:server-state:patch`,t,r,i):e.callEvent(`devframe:rpc:server-state:set`,t,n,i))})),()=>{for(let e of r)e()}}return{keys:()=>Array.from(t.keys()),onKeyAdded(e){return i.add(e),()=>{i.delete(e)}},delete(e){let i=n.get(e);n.delete(e);let a=t.delete(e);return r.delete(e),i?.(),a},get:async(c,l)=>{if(l?.initialValue!==void 0&&r.set(c,l.initialValue),t.has(c))return t.get(c);let u=lS({initialValue:l?.initialValue,enablePatches:!1});async function d(){if(a||e.callEvent(`devframe:rpc:server-state:subscribe`,c),l?.initialValue!==void 0){t.set(c,u);for(let e of i)e(c);return e.call(`devframe:rpc:server-state:get`,c).then(e=>{e!==void 0&&u.mutate(()=>o(c,e))}).catch(e=>{console.error(`Error getting server state`,e)}),n.set(c,s(c,u)),u}{let r=await e.call(`devframe:rpc:server-state:get`,c);u.mutate(()=>o(c,r)),t.set(c,u);for(let e of i)e(c);return n.set(c,s(c,u)),u}}return new Promise(t=>{if(e.isTrusted)d().then(t);else{t(u);let n=!1;e.events.on(Uy.client.isTrustedUpdated,e=>{e&&!n&&(n=!0,d())})}})}}}var DC=new Map;function OC(e=DC){let t=new Map;return{serialize:n=>{let r;return n.t===`q`?r=n.m:(r=t.get(n.i),t.delete(n.i)),!(n.t===`s`&&`e`in n)&&r&&e.get(r)?.jsonSerializable===!0?iC(n,r??``):`s:${OS(n)}`},deserialize:e=>{let n=e.startsWith(`s:`)?kS(e.slice(2)):JSON.parse(e);return n.t===`q`&&n.i&&n.m&&t.set(n.i,n.m),n}}}function kC(){}function AC(e){let t=e.search(/\n\n|\r\n\r\n/);if(!(t<0))return{frame:e.slice(0,t),rest:e.slice(t+(e[t]===`\r`?4:2))}}function jC(e){let t=`message`,n=[];for(let r of e.split(/\r?\n/))r.startsWith(`:`)||(r.startsWith(`event:`)?t=r.slice(6).trimStart():r.startsWith(`data:`)&&n.push(r.slice(5).replace(/^ /,``)));return{event:t,data:n}}function MC(e){let{onConnected:t=kC,onError:n=kC,onDisconnected:r=kC,definitions:i,fetch:a=globalThis.fetch.bind(globalThis)}=e,o=e.url;e.authToken&&(o=`${o}${o.includes(`?`)?`&`:`?`}${qS}=${encodeURIComponent(e.authToken)}`);let s=OC(i),c=new AbortController,l=!1,u,d,f,p,m=new Promise((e,t)=>{f=e,p=t});m.catch(()=>{});function h(e){l||(l=!0,p(e),n(e),r())}function g(){l||(l=!0,p(Error(`Devframe SSE stream closed`)),r())}function _(e,n){if(e===`session`){f(n),t();return}u?.(n)}async function v(e){let t=e.getReader();d=t;let n=new TextDecoder,r=``;for(;;){let{done:e,value:i}=await t.read();if(e)break;for(r+=n.decode(i,{stream:!0});;){let e=AC(r);if(!e)break;r=e.rest;let{event:t,data:n}=jC(e.frame);n.length>0&&_(t,n.join(`
`))}}g()}return(async()=>{try{let e=await a(o,{headers:{accept:`text/event-stream`},signal:c.signal});if(!e.ok||!e.body)throw Error(`Devframe SSE stream request failed: ${e.status}`);await v(e.body)}catch(e){if(c.signal.aborted){g();return}h(e instanceof Error?e:Error(String(e)))}})(),{close:()=>{l=!0,c.abort(),d?.cancel().catch(()=>{})},on:e=>{u=e},post:async e=>{let t;try{t=await m}catch{return}if(l){n(Error(`Devframe SSE channel is closed; message dropped`));return}try{let n=await a(o,{method:`POST`,headers:{"content-type":`text/plain; charset=utf-8`,[US]:t},body:e});if(n.status===200){let e=await n.text();e&&u?.(e);return}if(!n.ok)throw Error(`Devframe SSE POST failed: ${n.status}`)}catch(e){n(e instanceof Error?e:Error(String(e)))}},serialize:s.serialize,deserialize:s.deserialize}}function NC(e,t){let{channel:n,rpcOptions:r={}}=t;return nb(e,{...n,timeout:-1,...r,proxify:!1})}function PC(e){let{transport:t,authToken:n,connectionMeta:r,events:i,clientRpc:a,rpcOptions:o={},callTimeout:s=0}=e,c=!1,l=`connecting`,u=null,d=Promise.withResolvers();function f(e,t=null){if(t?u=t:e===`connected`&&(u=null),e===l)return;let n=l;l=e,i.emit(Uy.client.connectionStatus,e,n)}let p=new Set;function m(e){for(let t of[...p])t.reject(e)}function h(){return l===`disconnected`||l===`error`?new bC(`connection`,`[devframe] Not connected to the devframe server`,{cause:u??void 0}):l===`unauthorized`?new bC(`auth`,`[devframe] Not authorized by the devframe server`,{cause:u??void 0}):null}function g(e,t){return new Promise((n,r)=>{let a=!1,o,c={reject(e){a||(l(),i.emit(Uy.client.error,e,t),r(e))}};function l(){a=!0,p.delete(c),o&&clearTimeout(o)}p.add(c),s>0&&(o=setTimeout(()=>{c.reject(new bC(`timeout`,`[devframe] RPC call "${t}" timed out after ${s}ms`))},s)),e.then(e=>{a||(l(),n(e))},e=>{if(a)return;l();let n=e instanceof Error?e:Error(String(e));i.emit(Uy.client.error,n,t),r(n)})})}let _=new Map;for(let e of r.jsonSerializableMethods??[])_.set(e,{jsonSerializable:!0});let v=e.createChannel({definitions:_,onError(e){f(`error`,e),i.emit(Uy.client.connectionError,e),m(new bC(`connection`,`[devframe] Connection to the devframe server failed`,{cause:e}))},onDisconnected(){l!==`error`&&f(`disconnected`),m(new bC(`connection`,`[devframe] Disconnected from the devframe server`,{cause:u??void 0}))}}),y=NC(a.functions,{channel:v,rpcOptions:o});a.register({name:Uy.broadcast.authRevoked,type:`event`,handler:()=>{c=!1;let e=new bC(`auth`,`[devframe] The devframe server revoked this client's trust`);f(`unauthorized`,e),i.emit(Uy.client.connectionError,e),m(e),i.emit(Uy.client.isTrustedUpdated,!1)}});let b=n;async function ee(e){b=e;let t=await y.$call(`anonymous:devframe:auth`,{authToken:e,ua:navigator.userAgent,origin:location.origin});if(c=t.isTrusted,c)d.resolve(!0),f(`connected`);else{let e=new bC(`auth`,`[devframe] The devframe server refused this client's credentials`);f(`unauthorized`,e),i.emit(Uy.client.connectionError,e)}return i.emit(Uy.client.isTrustedUpdated,c),t.isTrusted}async function te(e){let t=(await y.$call(`anonymous:devframe:auth:exchange`,{code:e,ua:navigator.userAgent,origin:location.origin}))?.authToken??null;return t&&(b=t,c=!0,d.resolve(!0),f(`connected`),i.emit(Uy.client.isTrustedUpdated,!0)),t}async function ne(e={}){await y.$call(`anonymous:devframe:auth:request-code`,{ua:navigator.userAgent,origin:location.origin,...e.reissue?{reissue:!0}:{}})}async function re(){return c?!0:ee(b??``)}async function x(e=6e4){if(c&&d.resolve(!0),e<=0)return d.promise;let t;try{return await Promise.race([d.promise,new Promise((n,r)=>{t=setTimeout(()=>{r(Error(`[devframe] Timeout waiting for rpc to be trusted`))},e)})]),c}finally{clearTimeout(t)}}return{transport:t,get isTrusted(){return c},get status(){return l},get connectionError(){return u},requestTrust:re,requestTrustWithToken:ee,requestTrustWithCode:te,requestAuthCode:ne,ensureTrusted:x,call:(...e)=>{let t=String(e[0]),n=h();return n?(i.emit(Uy.client.error,n,t),Promise.reject(n)):g(y.$call(...e),t)},callEvent:(...e)=>{let t=h();if(t){i.emit(Uy.client.error,t,String(e[0]));return}return y.$callEvent(...e)},callOptional:(...e)=>{let t=String(e[0]),n=h();return n?(i.emit(Uy.client.error,n,t),Promise.reject(n)):g(y.$callOptional(...e),t)},close:()=>{v.close()}}}function FC(e,t,n){let r=(()=>{try{return new URL(t,n.href)}catch{return new URL(n.href)}})();if(e&&typeof e==`object`){if(e.host!=null||e.port!=null){let t=e.host??`${r.hostname}:${e.port}`;return new URL(e.path??`/`,`${r.protocol}//${t}`).href}return new URL(e.path??``,r).href}let i=e??``;return/^https?:\/\//i.test(i)?i:new URL(i,r).href}function IC(e){let{authToken:t,connectionMeta:n,metaBaseUrl:r,events:i,clientRpc:a,rpcOptions:o={},sseOptions:s={},callTimeout:c=0}=e,l=FC(n.sse,r??`./`,location);return PC({transport:`sse`,authToken:t,connectionMeta:n,events:i,clientRpc:a,rpcOptions:o,callTimeout:c,createChannel:e=>MC({url:l,authToken:t,definitions:e.definitions,...s,onConnected(){s.onConnected?.()},onError(t){e.onError(t),s.onError?.(t)},onDisconnected(){e.onDisconnected(),s.onDisconnected?.()}})})}function LC(e){let{name:t,message:n,cause:r,...i}=e,a=r instanceof Error?r:RC(r)?LC(r):r,o=a===void 0?Error(n):Error(n,{cause:a});return o.name=t,Object.assign(o,i),o}function RC(e){return typeof e==`object`&&!!e&&typeof e.message==`string`&&typeof e.name==`string`}function zC(e){return typeof e==`object`&&!!e&&e.type===`static`&&typeof e.path==`string`}function BC(e){return typeof e==`object`&&!!e&&e.type===`query`&&typeof e.records==`object`&&e.records!==null}function VC(e){return typeof e==`object`&&!!e&&(`output`in e||`error`in e)}function HC(e){if(e.error)throw LC(e.error);return e.output}function UC(e){return e.some(e=>e!=null)}function WC(e){return typeof e==`object`&&e&&`serialization`in e&&`data`in e?e.data:e}function GC(e,t){let n=new Map,r=new Map;function i(e,t){return t===`structured-clone`&&Array.isArray(e)?DS(e):e}function a(e,t){return i(WC(e),t)}async function o(e){n.has(e.path)||n.set(e.path,t(e.path).then(t=>a(t,e.serialization)));let r=await n.get(e.path);return VC(r)?HC(r):r}async function s(e,n){return r.has(e)||r.set(e,t(e).then(e=>a(e,n))),await r.get(e)}async function c(t,n){if(!(t in e))throw Error(`[devframe-rpc] Function "${t}" not found in dump store`);let r=e[t];if(zC(r)){if(UC(n))throw Error(`[devframe-rpc] No dump match for "${t}" with args: ${JSON.stringify(n)}`);return await o(r)}if(BC(r)){let e=Sb(n),i=r.records[e];if(i)return HC(await s(i,r.serialization));if(r.fallback)return HC(await s(r.fallback,r.serialization));throw Error(`[devframe-rpc] No dump match for "${t}" with args: ${JSON.stringify(n)}`)}if(!UC(n))return r;throw Error(`[devframe-rpc] No dump match for "${t}" with args: ${JSON.stringify(n)}`)}return{call:async(e,t)=>await c(e,t),callOptional:async(t,n)=>{if(t in e)return await c(t,n)},callEvent:async(e,t)=>{}}}async function KC(e){let t=GC(await e.fetchJsonFromBases(WS),e.fetchJsonFromBases);return{transport:`static`,isTrusted:!0,status:`connected`,connectionError:null,requestTrust:async()=>!0,requestTrustWithToken:async()=>!0,requestTrustWithCode:async()=>null,requestAuthCode:async()=>{},ensureTrusted:async()=>!0,call:(...e)=>t.call(e[0],e.slice(1)),callEvent:(...e)=>t.callEvent(e[0],e.slice(1)),callOptional:(...e)=>t.callOptional(e[0],e.slice(1)),close:()=>{}}}var qC=``;function JC(e,t){return`${e}${qC}${t}`}function YC(e){let t=new Map,n=new Map;e.client.register({name:Uy.broadcast.streamingChunk,type:`event`,handler(e,n,r,i){t.get(JC(e,n))?._push(r,i)}}),e.client.register({name:Uy.broadcast.streamingEnd,type:`event`,handler(e,n,r){let i=JC(e,n),a=t.get(i);a&&(a._end(r),t.delete(i))}}),e.client.register({name:Uy.broadcast.streamingUploadCancel,type:`event`,handler(e,t){let r=JC(e,t),i=n.get(r);i&&(i.abort(`server cancelled upload`),n.delete(r))}}),e.events.on(Uy.client.isTrustedUpdated,n=>{if(n)for(let[n,r]of t){if(r.cancelled||r.done)continue;let t=n.indexOf(qC);if(t<0)continue;let i=n.slice(0,t),a=n.slice(t+1);e.callEvent(`devframe:streaming:subscribe`,i,a,{afterSeq:r.lastSeenSeq})}});function r(n,r,i={}){let a=JC(n,r),o=t.get(a);if(o)return o;let s=NS({id:r,highWaterMark:i.highWaterMark,onOverflow(e){console.warn(`[devframe] DF0029: Stream "${n}#${r}" dropped ${e} chunk(s) after exceeding the client high-water mark.`)},onCancel(){e.callEvent(`devframe:streaming:cancel`,n,r),t.delete(a)}});if(t.set(a,s),e.isTrusted)e.callEvent(`devframe:streaming:subscribe`,n,r,{afterSeq:0});else{let i=e.events.on(Uy.client.isTrustedUpdated,o=>{o&&(i(),t.has(a)&&!s.cancelled&&!s.done&&e.callEvent(`devframe:streaming:subscribe`,n,r,{afterSeq:s.lastSeenSeq}))})}return s}function i(t,r){let i=JC(t,r),a=n.get(i);if(a)return a;let o=MS({id:r});return o.events.on(`chunk`,(n,i)=>{e.callEvent(`devframe:streaming:upload-chunk`,t,r,n,i)}),o.events.on(`end`,a=>{e.callEvent(`devframe:streaming:upload-end`,t,r,a),n.delete(i)}),n.set(i,o),o}return{subscribe:r,upload:i}}function XC(){}var ZC=new Map;function QC(e){let t=e.url;e.authToken&&(t=`${t}?${qS}=${encodeURIComponent(e.authToken)}`);let n=new WebSocket(t),{onConnected:r=XC,onError:i=XC,onDisconnected:a=XC,definitions:o=ZC}=e;n.addEventListener(`open`,e=>{r(e)}),n.addEventListener(`error`,e=>{let t=e instanceof Error?e:Error(e.type);i(t)}),n.addEventListener(`close`,e=>{a(e)});let s=OC(o);return{close:()=>{n.close()},on:e=>{n.addEventListener(`message`,t=>{e(t.data)})},post:e=>{if(n.readyState===WebSocket.OPEN){n.send(e);return}if(n.readyState===WebSocket.CONNECTING){let t=()=>{i(),n.readyState===WebSocket.OPEN&&n.send(e)},r=()=>i();function i(){n.removeEventListener(`open`,t),n.removeEventListener(`close`,r)}n.addEventListener(`open`,t),n.addEventListener(`close`,r);return}i(Error(`Devframe WebSocket is not open; message dropped`))},serialize:s.serialize,deserialize:s.deserialize}}function $C(e,t,n){let r=(()=>{try{return new URL(t,n.href)}catch{return new URL(n.href)}})(),i=r.protocol===`https:`?`wss:`:`ws:`;if(e&&typeof e==`object`){if(e.host!=null||e.port!=null){let t=e.host??`${r.hostname}:${e.port}`,n=new URL(e.path??`/`,`${i}//${t}`);return n.protocol=i,n.href}let t=new URL(e.path??``,r);return t.protocol=i,t.href}if(typeof e==`number`)return`${i}//${r.hostname}:${e}`;let a=e??``;if(/^wss?:\/\//i.test(a))return a;if(/^https?:\/\//i.test(a))return kb(a,/^https/i.test(a)?`wss://`:`ws://`);let o=new URL(a,r);return o.protocol=i,o.href}function ew(e){let{authToken:t,connectionMeta:n,metaBaseUrl:r,events:i,clientRpc:a,rpcOptions:o={},wsOptions:s={},callTimeout:c=0}=e,l=$C(n.websocket,r??`./`,location);return PC({transport:`websocket`,authToken:t,connectionMeta:n,events:i,clientRpc:a,rpcOptions:o,callTimeout:c,createChannel:e=>QC({url:l,authToken:t,definitions:e.definitions,...s,onConnected(e){s.onConnected?.(e)},onError(t){e.onError(t),s.onError?.(t)},onDisconnected(t){e.onDisconnected(),s.onDisconnected?.(t)}})})}function tw(e){return e.includes(`:`)}function nw(e,t){return tw(t)?t:`${e}:${t}`}function rw(e){return{async get(t){return(await e()).value()[t]},async set(t,n){(await e()).mutate(e=>{e[t]=n})},async delete(t){(await e()).mutate(e=>{delete e[t]})},async all(){return(await e()).value()},async onChange(t){return(await e()).on(`updated`,e=>t(e))}}}function iw(e,t,n){let r=`devframe:settings:${n}:${t}`,i;function a(){return i||=e.sharedState.get(r,{initialValue:{}}),i}return rw(a)}function aw(e,t){return{global:iw(e,t,`global`),project:iw(e,t,`project`)}}function ow(e,t){return{namespace:t,base:e,rpc:{namespace:t,register(n){if(tw(n.name))throw Error(`[devframe] Scoped client RPC registration for namespace "${t}" received an already-namespaced function name "${n.name}". Pass a bare name without a ":" separator.`);e.client.register({...n,name:`${t}:${n.name}`})},call:((n,...r)=>e.call(nw(t,n),...r)),callEvent:((n,...r)=>e.callEvent(nw(t,n),...r)),callOptional:((n,...r)=>e.callOptional(nw(t,n),...r)),sharedState:((n,r)=>e.sharedState.get(nw(t,n),r)),streaming:{subscribe:(n,r,i)=>e.streaming.subscribe(nw(t,n),r,i),upload:(n,r)=>e.streaming.upload(nw(t,n),r)}},settings:aw(e,t),scope:e.scope}}function sw(){if(typeof document<`u`){let e=document.modelContext;if(e)return e}if(typeof navigator<`u`){let e=navigator.modelContext;if(e)return e}}function cw(e,t={}){let n=t.modelContext??sw();if(!n)return()=>{};let r=n,i=new Map,a=new Map;function o(t,n){let o=IS(t.name),s=a.get(o);if(s&&s!==t.name){console.warn(`[devframe] WebMCP tool name "${o}" (from "${t.name}") collides with "${s}"; keeping the first registration.`);return}let c=new AbortController,l=rb(t.type,n),u=r.registerTool({name:o,description:n.description,inputSchema:ob(t.args),annotations:{title:n.title??t.name,readOnlyHint:l===`read`,destructiveHint:l===`destructive`},execute:n=>lw(t,e.context,n)},{signal:c.signal});u&&`then`in u&&u.then(()=>{},()=>{}),a.set(o,t.name),i.set(t.name,()=>{c.abort(),u&&`unregister`in u&&typeof u.unregister==`function`&&u.unregister(),a.delete(o)})}function s(t){let n=t?[t]:[...e.definitions.keys()];for(let t of n){i.get(t)?.(),i.delete(t);let n=e.definitions.get(t),r=n?.agent;n&&r&&o(n,r)}}s();let c=e.onChanged(e=>s(e));return()=>{c();for(let e of i.values())e();i.clear()}}async function lw(e,t,n){try{let r=cb(n,e.args?.length);return{content:[{type:`text`,text:uw(await(await nC(e,t))(...r))}]}}catch(e){return{isError:!0,content:[{type:`text`,text:dw(e)}]}}}function uw(e){return e===void 0?`undefined`:typeof e==`string`?e:JSON.stringify(e,null,2)}function dw(e){if(!(e instanceof Error))return String(e);let t=e.cause instanceof Error?` (cause: ${e.cause.message})`:``;return`${e.name}: ${e.message}${t}`}function fw(e,t){if(t.backend===`static`)return`static`;let n=t.websocket!==void 0,r=t.sse!==void 0;if(e===`websocket`){if(!n)throw Error(`[devframe] transport: 'websocket' was requested, but this server does not advertise a WebSocket endpoint`);return`websocket`}if(e===`sse`){if(!r)throw Error(`[devframe] transport: 'sse' was requested, but this server does not advertise an SSE endpoint`);return`sse`}if(t.backend===`sse`&&r)return`sse`;if(n)return`websocket`;if(r)return`sse`;throw Error(`[devframe] This server advertises no RPC transport (backend "none"), so there is nothing to connect to. Enable the WebSocket or SSE endpoint on the server, or use its static/MCP surfaces instead.`)}async function pw(e={}){let{baseURL:t=`./`,rpcOptions:n={},cacheOptions:r=!1}=e,i=Cb(),a=Array.isArray(t)?t:[t],o=await yC(e),{connectionMeta:s,metaBaseUrl:c,authToken:l}=o,u=a[0]??`./`;try{u=new URL(`.`,c).href}catch{}let d=new JS({functions:[],...typeof e.cacheOptions==`object`?e.cacheOptions:{}}),f={rpc:void 0},p=new rC(f),m=e.webmcp===!1?void 0:cw(p),h,g=!1;async function _(e){let t=[u,...a.filter(e=>e!==u)].filter(e=>e!=null),n=[];for(let r of t)try{return await fetch(Ob(e,r)).then(t=>{if(!t.ok)throw Error(`Failed to fetch ${e} from ${r}: ${t.status}`);return t.json()})}catch(e){n.push(e)}throw Error(`Failed to load ${e} from ${t.join(`, `)}`,{cause:n})}let v={authToken:l,connectionMeta:s,metaBaseUrl:c,events:i,clientRpc:p,callTimeout:e.callTimeout,rpcOptions:{...n,async onRequest(e,t,i){if(await n.onRequest?.call(this,e,t,i),r&&d?.validate(e.m)){if(d.has(e.m,e.a))return i(d.cached(e.m,e.a));let n=await t(e);d.apply(e,n)}else await t(e)}}},y=fw(e.transport??`auto`,s),b=y===`static`?await KC({fetchJsonFromBases:_}):y===`sse`?IC({...v,sseOptions:e.sseOptions}):ew({...v,wsOptions:e.wsOptions}),ee;try{ee=new BroadcastChannel(`devframe-auth`)}catch{}let te,ne=!1;function re(e){return((...t)=>ne||!te?e(...t):te.then(()=>e(...t)))}function x(){g=!0;try{h?.(),m?.()}finally{try{ee?.close()}finally{b.close?.()}}}let ie={events:i,get isTrusted(){return b.isTrusted},get status(){return b.status},get connectionError(){return b.connectionError},get transport(){return b.transport??y},get connection(){return o},connectionMeta:s,ensureTrusted:b.ensureTrusted,requestTrust:b.requestTrust,requestTrustWithToken:async e=>(hC(e),o={...o,authToken:e},b.requestTrustWithToken(e)),requestTrustWithCode:async e=>{let t=await b.requestTrustWithCode(e);if(!t)return!1;hC(t),o={...o,authToken:t};try{ee?.postMessage({type:`auth-update`,authToken:t})}catch{}return!0},requestAuthCode:e=>b.requestAuthCode(e),call:re(b.call),callEvent:re(b.callEvent),callOptional:re(b.callOptional),client:p,sharedState:void 0,services:void 0,streaming:void 0,cacheManager:d,scope:void 0,close:x};ie.sharedState=EC(ie),ie.streaming=YC(ie),ie.services=TC(ie);let ae=new Map;ie.scope=(e=>{if(!e)return ie;let t=ae.get(e);return t||(t=ow(ie,e),ae.set(e,t)),t}),f.rpc=ie;function oe(){try{return typeof window<`u`&&window.self===window.top}catch{return!1}}async function se(){if(e.simpleAuth!==!1&&oe()&&typeof globalThis.prompt==`function`)for(await ie.requestAuthCode().catch(()=>{});!ie.isTrusted;){let e=globalThis.prompt(`devframe: enter the authentication code shown in your terminal`);if(e==null)return;let t=e.trim();if(t&&await ie.requestTrustWithCode(t))return}}async function S(){let t=await b.requestTrust(),n=e.otpParam??`devframe_otp`,r=n?await wC(ie,{param:n}):!1;t||r||ie.isTrusted||await se()}return te=S().then(()=>{ne=!0},()=>{ne=!0}),s.mcp&&BS(async()=>{let{setupBrowserAgentRpcBridge:e}=await import(`./browser-agent-rpc-BXhoSh1z-44OHts1W.js`);return{setupBrowserAgentRpcBridge:e}},[],import.meta.url).then(({setupBrowserAgentRpcBridge:e})=>{g||(h=e(ie))}).catch(()=>{}),ee&&(ee.onmessage=e=>{e.data?.type===`auth-update`&&e.data.authToken&&ie.requestTrustWithToken(e.data.authToken)}),ie}var mw=pw;function hw(e,t){e&1&&(W(0,`dt`),X(1,`Analog`),G(),W(2,`dd`),X(3),G()),e&2&&(I(3),Z(t))}var gw=class e{rpc=k_(null);navigate=E_();meta=F(null);componentCount=F(0);routeCount=F(0);signalCount=F(0);providerCount=F(0);storeCount=F(0);constructor(){$s(()=>{let e=this.rpc();if(!e)return;let t=e.scope(`ng-devtools`);t.rpc.call(`build-meta`).then(e=>this.meta.set(e)).catch(()=>{}),t.rpc.call(`get-components`).then(e=>this.componentCount.set(e.length)).catch(()=>{}),t.rpc.call(`get-routes`).then(e=>this.routeCount.set(e.length)).catch(()=>{}),t.rpc.call(`get-signals`).then(e=>this.signalCount.set(e.length)).catch(()=>{}),t.rpc.call(`get-providers`).then(e=>this.providerCount.set(e.length)).catch(()=>{}),t.rpc.call(`get-ngrx-store`).then(e=>this.storeCount.set(e.length)).catch(()=>{})})}static ɵfac=function(t){return new(t||e)};static ɵcmp=nm({type:e,selectors:[[`app-dashboard`]],inputs:{rpc:[1,`rpc`]},outputs:{navigate:`navigate`},decls:57,vars:10,consts:[[1,`grid`],[1,`card`],[1,`card`,`clickable`,3,`click`],[1,`big`],[1,`sub`]],template:function(e,t){if(e&1&&(W(0,`div`,0)(1,`div`,1)(2,`h2`),X(3,`Project`),G(),W(4,`dl`)(5,`dt`),X(6,`Name`),G(),W(7,`dd`),X(8),G(),W(9,`dt`),X(10,`Angular`),G(),W(11,`dd`),X(12),G(),W(13,`dt`),X(14,`TypeScript`),G(),W(15,`dd`),X(16),G(),W(17,`dt`),X(18,`SSR`),G(),W(19,`dd`),X(20),G(),R(21,hw,4,1),G()(),W(22,`div`,2),J(`click`,function(){return t.navigate.emit(`components`)}),W(23,`h2`),X(24,`Components`),G(),W(25,`p`,3),X(26),G(),W(27,`p`,4),X(28,`discovered in source`),G()(),W(29,`div`,2),J(`click`,function(){return t.navigate.emit(`routes`)}),W(30,`h2`),X(31,`Routes`),G(),W(32,`p`,3),X(33),G(),W(34,`p`,4),X(35,`registered paths`),G()(),W(36,`div`,2),J(`click`,function(){return t.navigate.emit(`signals`)}),W(37,`h2`),X(38,`Signals`),G(),W(39,`p`,3),X(40),G(),W(41,`p`,4),X(42,`reactive primitives`),G()(),W(43,`div`,2),J(`click`,function(){return t.navigate.emit(`injectors`)}),W(44,`h2`),X(45,`Injectors`),G(),W(46,`p`,3),X(47),G(),W(48,`p`,4),X(49,`DI providers`),G()(),W(50,`div`,2),J(`click`,function(){return t.navigate.emit(`store`)}),W(51,`h2`),X(52,`NgRx Store`),G(),W(53,`p`,3),X(54),G(),W(55,`p`,4),X(56,`store entries`),G()()()),e&2){let e;I(8),Z(t.meta()?.projectName??`…`),I(4),Z(t.meta()?.angularVersion??`…`),I(4),Z(t.meta()?.typescript??`…`),I(4),Z(t.meta()?.ssr?`Yes`:`No`),I(),z((e=t.meta()?.analog)?21:-1,e),I(5),Z(t.componentCount()),I(7),Z(t.routeCount()),I(7),Z(t.signalCount()),I(7),Z(t.providerCount()),I(7),Z(t.storeCount())}},styles:[`.grid[_ngcontent-%COMP%] {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
      gap: 16px;
    }
    .card[_ngcontent-%COMP%] {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 10px;
      padding: 20px;
    }
    .card.clickable[_ngcontent-%COMP%] {
      cursor: pointer;
      transition: border-color 0.15s;
    }
    .card.clickable[_ngcontent-%COMP%]:hover {
      border-color: var(--%NS%accent);
    }
    h2[_ngcontent-%COMP%] {
      font-size: 13px;
      text-transform: uppercase;
      color: #71717a;
      margin-bottom: 12px;
      letter-spacing: 0.05em;
    }
    dl[_ngcontent-%COMP%] {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 6px 12px;
      font-size: 14px;
    }
    dt[_ngcontent-%COMP%] {
      color: #a1a1aa;
    }
    dd[_ngcontent-%COMP%] {
      color: #e4e4e7;
      font-weight: 500;
    }
    .big[_ngcontent-%COMP%] {
      font-size: 36px;
      font-weight: 700;
      color: var(--%NS%accent);
    }
    .sub[_ngcontent-%COMP%] {
      font-size: 13px;
      color: #71717a;
      margin-top: 4px;
    }`]})},_w=()=>[],vw=(e,t)=>t.selector,yw=(e,t)=>t.outlet+t.route,bw=(e,t)=>t.formId,xw=(e,t)=>t.token+t.line;function Sw(e,t){e&1&&(W(0,`p`,3),X(1,`Scanning components…`),G())}function Cw(e,t){e&1&&(W(0,`p`,3),X(1,`No components found.`),G())}function ww(e,t){if(e&1&&(W(0,`span`,10),X(1),G()),e&2){let e=t.$implicit;I(),n_(`routed `,e.route,` · outlet `,e.outlet)}}function Tw(e,t){if(e&1){let e=K();W(0,`button`,14),J(`click`,function(){let t=N(e).$implicit;return P(Y(4).showForm.emit(t.formId))}),X(1),G()}if(e&2){let e=t.$implicit;I(),Q(` Show `,e.label,` in Forms `)}}function Ew(e,t){if(e&1&&(W(0,`li`,16),X(1),G()),e&2){let e=t.$implicit;I(),Z(e)}}function Dw(e,t){if(e&1&&(W(0,`h4`),X(1,`Inputs`),G(),W(2,`ul`,15),B(3,Ew,2,1,`li`,16,Mh),G()),e&2){let e=Y(2).$implicit;I(3),V(e.inputs)}}function Ow(e,t){if(e&1&&(W(0,`li`,17),X(1),G()),e&2){let e=t.$implicit;I(),Z(e)}}function kw(e,t){if(e&1&&(W(0,`h4`),X(1,`Outputs`),G(),W(2,`ul`,15),B(3,Ow,2,1,`li`,17,Mh),G()),e&2){let e=Y(2).$implicit;I(3),V(e.outputs)}}function Aw(e,t){if(e&1&&(W(0,`span`,22),X(1),G()),e&2){let e=Y().$implicit;I(),Q(`→ `,e.source)}}function jw(e,t){if(e&1&&(W(0,`li`,19)(1,`span`,20),X(2),G(),W(3,`span`,21),X(4),G(),R(5,Aw,2,1,`span`,22),G()),e&2){let e=t.$implicit;I(2),Z(e.token),I(2),Z(e.type),I(),z(e.source&&e.source!==`class`&&e.source!==`providers array`?5:-1)}}function Mw(e,t){if(e&1&&(W(0,`h4`),X(1,`Injected Providers`),G(),W(2,`ul`,18),B(3,jw,6,3,`li`,19,xw),G()),e&2){let e=Y(4);I(3),V(e.selectedProviders())}}function Nw(e,t){e&1&&(W(0,`p`,13),X(1,`No injected providers detected.`),G())}function Pw(e,t){if(e&1&&(W(0,`div`,11)(1,`dl`)(2,`dt`),X(3,`File`),G(),W(4,`dd`),X(5),G(),W(6,`dt`),X(7,`Standalone`),G(),W(8,`dd`),X(9),G()(),B(10,Tw,2,1,`button`,12,bw),R(12,Dw,5,0),R(13,kw,5,0),R(14,Mw,5,0)(15,Nw,2,0,`p`,13),G()),e&2){let e=Y().$implicit,t=Y(2);I(5),Z(e.file),I(4),Z(e.isStandalone?`Yes`:`No`),I(),V(t.formsIn(e.file)),I(2),z(e.inputs.length?12:-1),I(),z(e.outputs.length?13:-1),I(),z(t.selectedProviders().length?14:15)}}function Fw(e,t){if(e&1){let e=K();W(0,`li`,6)(1,`button`,7),J(`click`,function(){let t=N(e).$implicit;return P(Y(2).select(t))}),W(2,`div`,8),X(3),G(),W(4,`div`,9),X(5),G(),B(6,ww,2,2,`span`,10,yw),G(),R(8,Pw,16,5,`div`,11),G()}if(e&2){let e=t.$implicit,n=Y(2);jg(`expanded`,n.isSelected(e)),I(),L(`aria-expanded`,n.isSelected(e)),I(2),Q(`<`,e.selector,`>`),I(2),Z(e.file),I(),V(n.routedBy().get(e.selector)??a_(6,_w)),I(2),z(n.isSelected(e)?8:-1)}}function Iw(e,t){if(e&1&&(W(0,`ul`,4),B(1,Fw,9,7,`li`,5,vw),G()),e&2){let e=Y();I(),V(e.filtered())}}var Lw=class e{rpc=k_(null);showForm=E_();formOwners=F([]);components=F([]);allProviders=F([]);filter=F(``);loading=F(!1);selected=F(null);selectedProviders=F([]);filtered=F([]);outlets=F([]);unsubscribeRouter=null;destroyRef=A(fs);routedBy=$(()=>{let e=new Map,t=n=>{for(let r of n)r.activated&&r.element&&r.route&&e.set(r.element,[...e.get(r.element)??[],{route:r.route,outlet:r.outlet}]),r.children&&t(r.children)};return t(this.outlets()),e});constructor(){$s(()=>{let e=this.filter().toLowerCase(),t=this.components();this.filtered.set(e?t.filter(t=>t.selector.includes(e)||t.file.includes(e)):t)}),$s(()=>{let e=this.rpc();e&&(this.refresh(),this.watchRouter(e))}),this.destroyRef.onDestroy(()=>this.unsubscribeRouter?.())}async watchRouter(e){try{let t=await e.scope(`ng-devtools`).rpc.sharedState(`router`);if(this.destroyRef.destroyed)return;let n=e=>{let t=e?.pages??[],n=t.find(e=>e.snapshot)??t[0];this.outlets.set(n?.outlets??[])};n(t.value()),this.unsubscribeRouter?.(),this.unsubscribeRouter=t.on(`updated`,n)}catch{this.outlets.set([])}}async refresh(){let e=this.rpc();if(e){this.loading.set(!0);try{let t=e.scope(`ng-devtools`),[n,r]=await Promise.all([t.rpc.call(`get-components`),t.rpc.call(`get-providers`)]);this.components.set(n);let i=await t.rpc.call(`forms-owners`).catch(()=>[]);this.formOwners.set(i??[]),this.allProviders.set(r);let a=this.selected();if(a){let e=n.find(e=>e.selector===a.selector);e?(this.selected.set(e),this.selectedProviders.set(r.filter(t=>t.file===e.file))):(this.selected.set(null),this.selectedProviders.set([]))}}finally{this.loading.set(!1)}}}formsIn(e){return this.formOwners().filter(t=>t.file===e)}isSelected(e){return this.selected()?.selector===e.selector}select(e){if(this.isSelected(e)){this.selected.set(null),this.selectedProviders.set([]);let e=this.rpc();e&&e.scope(`ng-devtools`).rpc.callEvent(`select-component`,null);return}this.selected.set(e),this.selectedProviders.set(this.allProviders().filter(t=>t.file===e.file));let t=this.rpc();t&&t.scope(`ng-devtools`).rpc.callEvent(`select-component`,e.selector)}static ɵfac=function(t){return new(t||e)};static ɵcmp=nm({type:e,selectors:[[`app-component-tree`]],inputs:{rpc:[1,`rpc`]},outputs:{showForm:`showForm`},decls:7,vars:2,consts:[[1,`toolbar`],[`type`,`text`,`placeholder`,`Filter components…`,3,`input`,`value`],[3,`click`],[1,`muted`],[`role`,`list`,1,`component-list`],[1,`component-item`,3,`expanded`],[1,`component-item`],[1,`component-toggle`,3,`click`],[1,`selector`],[1,`file`],[1,`routed`],[1,`inline-detail`],[`type`,`button`,1,`show-form`],[1,`no-providers`],[`type`,`button`,1,`show-form`,3,`click`],[`role`,`list`,1,`prop-list`],[1,`prop-chip`,`input-chip`],[1,`prop-chip`,`output-chip`],[`role`,`list`,1,`provider-list`],[1,`provider-item`],[1,`provider-token`],[1,`provider-type`],[1,`provider-source`]],template:function(e,t){e&1&&(W(0,`div`,0)(1,`input`,1),J(`input`,function(e){return t.filter.set(e.target.value)}),G(),W(2,`button`,2),J(`click`,function(){return t.refresh()}),X(3,`Refresh`),G()(),R(4,Sw,2,0,`p`,3)(5,Cw,2,0,`p`,3)(6,Iw,3,0,`ul`,4)),e&2&&(I(),q(`value`,t.filter()),I(3),z(t.loading()?4:t.filtered().length===0?5:6))},styles:[`.toolbar[_ngcontent-%COMP%] {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }
    input[_ngcontent-%COMP%] {
      flex: 1;
      padding: 8px 12px;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 6px;
      color: #e4e4e7;
      font-size: 14px;
      outline: none;
    }
    input[_ngcontent-%COMP%]:focus {
      border-color: var(--%NS%accent);
    }
    button[_ngcontent-%COMP%] {
      padding: 8px 16px;
      background: #3f3f46;
      border: none;
      border-radius: 6px;
      color: #e4e4e7;
      cursor: pointer;
      font-size: 13px;
    }
    button[_ngcontent-%COMP%]:hover {
      background: #52525b;
    }
    .muted[_ngcontent-%COMP%] {
      color: #71717a;
      font-size: 14px;
    }
    .component-list[_ngcontent-%COMP%] {
      list-style: none;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .component-item[_ngcontent-%COMP%] {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 8px;
      padding: 0;
      transition: border-color 0.15s;
    }
    .component-item[_ngcontent-%COMP%]:has(.component-toggle:hover) {
      border-color: var(--%NS%accent);
    }
    .component-item.expanded[_ngcontent-%COMP%] {
      border-color: var(--%NS%accent);
    }
    .component-toggle[_ngcontent-%COMP%] {
      display: block;
      width: 100%;
      padding: 12px 16px;
      background: none;
      border: none;
      color: inherit;
      text-align: left;
      cursor: pointer;
      font: inherit;
    }
    .selector[_ngcontent-%COMP%] {
      font-family: monospace;
      font-size: 15px;
      color: var(--%NS%accent);
      font-weight: 600;
    }
    .file[_ngcontent-%COMP%] {
      font-size: 12px;
      color: #71717a;
      margin-top: 2px;
    }
    .io[_ngcontent-%COMP%] {
      font-size: 13px;
      color: #a1a1aa;
      margin-top: 4px;
    }
    .io[_ngcontent-%COMP%]   .label[_ngcontent-%COMP%] {
      color: #71717a;
    }
    .show-form[_ngcontent-%COMP%] {
      margin: 0 8px 8px 0;
    }
    .inline-detail[_ngcontent-%COMP%] {
      padding: 0 16px 12px;
      border-top: 1px solid #27272a;
      margin-top: 0;
      padding-top: 12px;
    }
    .prop-list[_ngcontent-%COMP%] {
      list-style: none;
      padding: 0;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-bottom: 12px;
    }
    .prop-chip[_ngcontent-%COMP%] {
      font-family: monospace;
      font-size: 12px;
      padding: 3px 8px;
      border-radius: 4px;
    }
    .input-chip[_ngcontent-%COMP%] {
      background: #1e3a5f;
      color: #93c5fd;
    }
    .output-chip[_ngcontent-%COMP%] {
      background: #3b1d1d;
      color: #fca5a5;
    }
    dl[_ngcontent-%COMP%] {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 4px 12px;
      font-size: 13px;
      margin-bottom: 16px;
    }
    dt[_ngcontent-%COMP%] {
      color: #71717a;
    }
    dd[_ngcontent-%COMP%] {
      color: #e4e4e7;
    }
    h4[_ngcontent-%COMP%] {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #71717a;
      margin-bottom: 8px;
    }
    .provider-list[_ngcontent-%COMP%] {
      list-style: none;
      padding: 0;
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .provider-item[_ngcontent-%COMP%] {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 10px;
      background: #09090b;
      border: 1px solid #27272a;
      border-radius: 6px;
      font-size: 13px;
    }
    .provider-token[_ngcontent-%COMP%] {
      font-family: monospace;
      color: #e4e4e7;
      font-weight: 600;
    }
    .provider-type[_ngcontent-%COMP%] {
      font-size: 11px;
      padding: 1px 6px;
      border-radius: 4px;
      background: #3f3f46;
      color: #a1a1aa;
    }
    .routed[_ngcontent-%COMP%] {
      display: inline-block;
      margin-top: 4px;
      padding: 1px 6px;
      border: 1px solid #52525b;
      border-radius: 4px;
      color: #d4d4d8;
      font-size: 11px;
      font-family: monospace;
    }
    .provider-source[_ngcontent-%COMP%] {
      font-size: 12px;
      color: #a1a1aa;
    }
    .no-providers[_ngcontent-%COMP%] {
      font-size: 13px;
      color: #52525b;
    }`]})};function Rw(e,t,n){return e?e.scope(`ng-devtools`).rpc.call(t,...n===void 0?[]:[n]).then(e=>e,()=>null):Promise.resolve(null)}function zw(e,t,n){return Rw(e,`request-router-action`,{pageId:t,request:n})}function Bw(e){return e===`succeeded`?`good`:e===`redirected`||e===`pending`||e===`skipped`?`warn`:e===`cancelled`||e===`failed`?`bad`:``}var Vw=()=>[],Hw=(e,t)=>t[0],Uw=(e,t)=>t.input;function Ww(e,t){if(e&1&&(W(0,`p`,2),X(1,` The browser shows `),W(2,`code`),X(3),G(),X(4,`, not the router URL (skipLocationChange, browserUrl, a failed navigation or code that changed history). `),G()),e&2){let e=Y();I(3),Z(e.browserUrl)}}function Gw(e,t){if(e&1){let e=K();W(0,`div`,3),X(1,` Navigating to `),W(2,`code`),X(3),G(),X(4),W(5,`button`,8),J(`click`,function(){return N(e),P(Y(2).abort())}),X(6,`Abort`),G()()}if(e&2){let e=t;I(3),Z(e.url),I(),Q(` (#`,e.id,`) `)}}function Kw(e,t){if(e&1&&(W(0,`p`,4),X(1),G()),e&2){let e=Y(2);I(),Z(e.message())}}function qw(e,t){if(e&1&&(W(0,`dt`),X(1,`Document title`),G(),W(2,`dd`),X(3),G()),e&2){let e=Y();I(3),Z(e.title)}}function Jw(e,t){if(e&1&&(W(0,`dt`),X(1,`Query params`),G(),W(2,`dd`)(3,`code`),X(4),u_(5,`json`),G()()),e&2){let e=Y();I(4),Z(f_(5,1,e.queryParams))}}function Yw(e,t){if(e&1&&(W(0,`dt`),X(1,`Fragment`),G(),W(2,`dd`)(3,`code`),X(4),G()()),e&2){let e=Y();I(4),Z(e.fragment)}}function Xw(e,t){if(e&1&&(W(0,`span`,10),X(1),G()),e&2){let e=Y().$implicit;I(),Z(e.route.outlet)}}function Zw(e,t){e&1&&(W(0,`span`,10),X(1,`lazy`),G())}function Qw(e,t){if(e&1&&(W(0,`div`,11),X(1),G()),e&2){let e=Y().$implicit;I(),n_(` title `,e.route.title,``,e.route.ownTitle===!1?` (inherited)`:``,` `)}}function $w(e,t){e&1&&(W(0,`span`,10),X(1,`inherited`),G())}function eT(e,t){if(e&1&&(W(0,`div`)(1,`code`),X(2),u_(3,`json`),G(),R(4,$w,2,0,`span`,10),G()),e&2){let e=t.$implicit,n=Y().$implicit;I(2),n_(``,e[0],`: `,f_(3,3,e[1])),I(2),z(n.route.paramSources?.[e[0]]===`inherited`?4:-1)}}function tT(e,t){e&1&&X(0,` — `)}function nT(e,t){e&1&&(W(0,`span`,10),X(1),G()),e&2&&(I(),Z(t))}function rT(e,t){if(e&1&&(W(0,`div`,12)(1,`code`),X(2),u_(3,`json`),G(),R(4,nT,2,1,`span`,10),G()),e&2){let e,n=t.$implicit,r=Y().$implicit;I(2),n_(``,n[0],`: `,f_(3,3,n[1])),I(2),z((e=r.route.dataSources?.[n[0]])?4:-1,e)}}function iT(e,t){e&1&&X(0,` — `)}function aT(e,t){if(e&1&&(W(0,`span`,10),X(1),G()),e&2){let e=t.$implicit;I(),Z(e)}}function oT(e,t){if(e&1&&(W(0,`span`,10),X(1),G()),e&2){let e=t.$implicit;I(),Q(`resolve `,e)}}function sT(e,t){e&1&&X(0,` — `)}function cT(e,t){if(e&1&&(W(0,`tr`)(1,`td`,9),X(2),R(3,Xw,2,1,`span`,10),R(4,Zw,2,0,`span`,10),R(5,Qw,2,2,`div`,11),G(),W(6,`td`),X(7),G(),W(8,`td`),B(9,eT,5,5,`div`,null,Hw,!1,tT,1,0),G(),W(12,`td`),B(13,rT,5,5,`div`,12,Hw,!1,iT,1,0),G(),W(16,`td`),B(17,aT,2,1,`span`,10,Mh),B(19,oT,2,1,`span`,10,Mh),R(21,sT,1,0),G()()),e&2){let e=t.$implicit,n=Y(2);I(),Ag(`padding-left`,12+e.depth*16,`px`),I(),Q(` `,e.depth===0&&!e.route.path?`(root)`:`/`+e.route.path,` `),I(),z(e.route.outlet===`primary`?-1:3),I(),z(e.route.lazy?4:-1),I(),z(e.route.title?5:-1),I(2),Z(e.route.component??`—`),I(2),V(n.entries(e.route.params)),I(4),V(n.entries(e.route.data)),I(4),V(n.guardList(e.route)),I(2),V(e.route.resolvers??a_(10,Vw)),I(2),z(!n.guardList(e.route).length&&!e.route.resolvers?21:-1)}}function lT(e,t){if(e&1&&(W(0,`code`),X(1),G(),X(2,` for `),W(3,`code`),X(4),G()),e&2){let e=Y().$implicit;I(),Z(e.outlet.component??`?`),I(3),Z(e.outlet.route??`?`)}}function uT(e,t){e&1&&(W(0,`span`,0),X(1,`not activated`),G())}function dT(e,t){e&1&&(W(0,`span`,10),X(1,`detached by reuse strategy`),G())}function fT(e,t){if(e&1&&(W(0,`span`,10),X(1),G()),e&2){let e=t.$implicit;I(),n_(`input `,e.input,` ← `,e.source)}}function pT(e,t){if(e&1&&(W(0,`li`)(1,`span`,10),X(2),G(),R(3,lT,5,2)(4,uT,2,0,`span`,0),R(5,dT,2,0,`span`,10),B(6,fT,2,2,`span`,10,Uw),G()),e&2){let e=t.$implicit,n=Y(3);Ag(`padding-left`,e.depth*16,`px`),I(2),Z(e.outlet.outlet),I(),z(e.outlet.activated?3:4),I(2),z(e.outlet.detached?5:-1),I(),V(n.boundInputs(e.outlet))}}function mT(e,t){if(e&1&&(W(0,`h3`),X(1,`Outlets`),G(),W(2,`ul`,13),B(3,pT,8,5,`li`,14,jh),G()),e&2){let e=Y(2);I(3),V(e.outletRows())}}function hT(e,t){if(e&1&&(W(0,`p`,1)(1,`code`),X(2),G()(),R(3,Ww,5,1,`p`,2),R(4,Gw,7,2,`div`,3),R(5,Kw,2,1,`p`,4),W(6,`dl`,5),R(7,qw,4,1),R(8,Jw,6,3),R(9,Yw,5,1),G(),W(10,`h3`),X(11,`Active routes`),G(),W(12,`div`,6)(13,`table`)(14,`thead`)(15,`tr`)(16,`th`,7),X(17,`Route`),G(),W(18,`th`,7),X(19,`Component`),G(),W(20,`th`,7),X(21,`Params`),G(),W(22,`th`,7),X(23,`Data`),G(),W(24,`th`,7),X(25,`Guards and resolvers`),G()()(),W(26,`tbody`),B(27,cT,22,11,`tr`,null,jh),G()()(),R(29,mT,5,0)),e&2){let e,n=t,r=Y();I(2),Z(n.url),I(),z(n.urlDrift&&n.browserUrl?3:-1),I(),z((e=n.pending)?4:-1,e),I(),z(r.message()?5:-1),I(2),z(n.title?7:-1),I(),z(r.hasKeys(n.queryParams)?8:-1),I(),z(n.fragment?9:-1),I(18),V(r.rows()),I(2),z(r.outletRows().length?29:-1)}}function gT(e,t){e&1&&(W(0,`p`,0),X(1,`This page reports no Router.`),G())}var _T=class e{page=k_.required();rpc=k_(null);message=F(``);rows=$(()=>{let e=[],t=(n,r)=>{e.push({route:n,depth:r});for(let e of n.children)t(e,r+1)},n=this.page().snapshot?.root;return n&&t(n,0),e});outletRows=$(()=>{let e=[],t=(n,r)=>{for(let i of n)e.push({outlet:i,depth:r}),i.children&&t(i.children,r+1)};return t(this.page().outlets??[],0),e});hasKeys(e){return Object.keys(e).length>0}entries(e){return Object.entries(e)}guardList(e){return Object.entries(e.guards??{}).flatMap(([e,t])=>t.map(t=>`${e} ${t}`))}boundInputs(e){return(e.inputs??[]).filter(e=>e.source!==`unset`)}async abort(){let e=await zw(this.rpc(),this.page().pageId,{action:`abort`});this.message.set(e?.error?String(e.error):`Aborted navigation #${e?.aborted}`)}static ɵfac=function(t){return new(t||e)};static ɵcmp=nm({type:e,selectors:[[`app-route-current`]],inputs:{page:[1,`page`],rpc:[1,`rpc`]},decls:2,vars:1,consts:[[1,`muted`],[1,`url`],[`role`,`note`,1,`note`],[`role`,`status`,1,`pending`],[`role`,`status`,1,`muted`],[1,`facts`],[`role`,`region`,`aria-label`,`Active routes`,`tabindex`,`0`,1,`table-scroll`],[`scope`,`col`],[`type`,`button`,1,`small`,3,`click`],[1,`path`],[1,`tag`],[1,`sub`],[1,`data`],[1,`outlets`],[3,`padding-left`]],template:function(e,t){if(e&1&&R(0,hT,30,8)(1,gT,2,0,`p`,0),e&2){let e;z((e=t.page().snapshot)?0:1,e)}},dependencies:[Wv],styles:[`.muted[_ngcontent-%COMP%] {
    color: #a1a1aa;
    font-size: 13px;
  }
  code[_ngcontent-%COMP%] {
    font-family: monospace;
    color: #d4d4d8;
    overflow-wrap: anywhere;
  }
  .tag[_ngcontent-%COMP%] {
    display: inline-block;
    margin: 0 4px 4px 0;
    padding: 1px 6px;
    border: 1px solid #52525b;
    border-radius: 4px;
    color: #d4d4d8;
    font-size: 11px;
    font-family: monospace;
  }
  .badge[_ngcontent-%COMP%] {
    padding: 1px 6px;
    border-radius: 4px;
    background: #3f3f46;
    color: #e4e4e7;
    font-size: 11px;
    font-weight: 600;
  }
  .badge[data-tone='good'][_ngcontent-%COMP%] {
    background: #14532d;
    color: #bbf7d0;
  }
  .badge[data-tone='warn'][_ngcontent-%COMP%] {
    background: #713f12;
    color: #fef08a;
  }
  .badge[data-tone='bad'][_ngcontent-%COMP%] {
    background: #7f1d1d;
    color: #fecaca;
  }
  button.small[_ngcontent-%COMP%] {
    padding: 3px 10px;
    background: #3f3f46;
    border: none;
    border-radius: 6px;
    color: #e4e4e7;
    cursor: pointer;
    font-size: 12px;
  }
  button.small[_ngcontent-%COMP%]:hover {
    background: #52525b;
  }
  button.small[_ngcontent-%COMP%]:focus-visible, 
   input[_ngcontent-%COMP%]:focus-visible, 
   select[_ngcontent-%COMP%]:focus-visible, 
   .table-scroll[_ngcontent-%COMP%]:focus-visible {
    outline: 2px solid var(--%NS%accent);
    outline-offset: 2px;
  }
  input.field[_ngcontent-%COMP%] {
    padding: 6px 10px;
    background: #18181b;
    border: 1px solid #52525b;
    border-radius: 6px;
    color: #e4e4e7;
    font-size: 13px;
  }
  .table-scroll[_ngcontent-%COMP%] {
    overflow-x: auto;
  }
  table[_ngcontent-%COMP%] {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  th[_ngcontent-%COMP%] {
    text-align: left;
    padding: 6px 12px;
    color: #a1a1aa;
    font-size: 12px;
    border-bottom: 1px solid #27272a;
  }
  td[_ngcontent-%COMP%] {
    padding: 8px 12px;
    border-bottom: 1px solid #1e1e22;
    vertical-align: top;
  }
  h3[_ngcontent-%COMP%] {
    margin: 0 0 8px;
    font-size: 14px;
    color: #e4e4e7;
  }
  .visually-hidden[_ngcontent-%COMP%] {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

    [_nghost-%COMP%] {
      display: grid;
      gap: 12px;
    }
    .url[_ngcontent-%COMP%]   code[_ngcontent-%COMP%] {
      font-size: 14px;
      color: var(--%NS%accent);
    }
    .note[_ngcontent-%COMP%] {
      margin: 0;
      padding: 8px 10px;
      border-left: 3px solid #fef08a;
      background: #27272a;
      color: #e4e4e7;
      font-size: 13px;
    }
    .pending[_ngcontent-%COMP%] {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      font-size: 13px;
      color: #fef08a;
    }
    .facts[_ngcontent-%COMP%] {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 4px 12px;
      margin: 0;
      font-size: 13px;
    }
    dt[_ngcontent-%COMP%] {
      color: #a1a1aa;
    }
    dd[_ngcontent-%COMP%] {
      margin: 0;
      color: #e4e4e7;
    }
    .path[_ngcontent-%COMP%] {
      font-family: monospace;
      color: var(--%NS%accent);
      white-space: nowrap;
    }
    .sub[_ngcontent-%COMP%] {
      font-family: inherit;
      color: #a1a1aa;
      font-size: 12px;
      white-space: normal;
    }
    .data[_ngcontent-%COMP%] {
      max-width: 360px;
    }
    .outlets[_ngcontent-%COMP%] {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 6px;
      font-size: 13px;
      color: #e4e4e7;
    }`]})};function vT(e,t){e&1&&(W(0,`p`,2),X(1,`Checking…`),G())}function yT(e,t){if(e&1&&(W(0,`li`)(1,`div`,4)(2,`span`,5),X(3),G(),W(4,`code`),X(5),G(),W(6,`code`,6),X(7),G()(),W(8,`p`),X(9),G(),W(10,`p`,7),X(11),W(12,`span`,2),X(13),G()()()),e&2){let e=t.$implicit;I(2),L(`data-tone`,e.severity===`error`?`bad`:e.severity===`warning`?`warn`:``),I(),Z(e.severity),I(2),Z(e.rule),I(2),Z(e.route),I(2),Z(e.message),I(2),Q(` Fix: `,e.fix,` `),I(2),Q(`(Angular `,e.angular===`throws`?`throws`:e.angular===`warns`?`warns`:`does not warn`,`)`)}}function bT(e,t){if(e&1&&(W(0,`ul`,3),B(1,yT,14,7,`li`,null,jh),G()),e&2){let e=Y();I(),V(e.findings())}}function xT(e,t){e&1&&(W(0,`p`,2),X(1,`No route config problems found.`),G())}var ST=class e{page=k_.required();rpc=k_(null);findings=F([]);loading=F(!1);key=$(()=>`${this.page().pageId}:${this.page().generation}:${this.page().navigations.length}`);constructor(){$s(()=>{this.key(),x_(()=>void this.run())})}async run(){this.loading.set(!0),this.findings.set(await Rw(this.rpc(),`router-lint`,this.page().pageId)??[]),this.loading.set(!1)}static ɵfac=function(t){return new(t||e)};static ɵcmp=nm({type:e,selectors:[[`app-route-lint`]],inputs:{page:[1,`page`],rpc:[1,`rpc`]},decls:8,vars:1,consts:[[1,`toolbar`],[`type`,`button`,1,`small`,3,`click`],[1,`muted`],[1,`findings`],[1,`head`],[1,`badge`],[1,`route`],[1,`fix`]],template:function(e,t){e&1&&(W(0,`div`,0)(1,`button`,1),J(`click`,function(){return t.run()}),X(2,`Check again`),G(),W(3,`span`,2),X(4,`Checks the live config, links and recent navigations. Lazy routes that have not loaded are skipped.`),G()(),R(5,vT,2,0,`p`,2)(6,bT,3,0,`ul`,3)(7,xT,2,0,`p`,2)),e&2&&(I(5),z(t.loading()?5:t.findings().length?6:7))},styles:[`.muted[_ngcontent-%COMP%] {
    color: #a1a1aa;
    font-size: 13px;
  }
  code[_ngcontent-%COMP%] {
    font-family: monospace;
    color: #d4d4d8;
    overflow-wrap: anywhere;
  }
  .tag[_ngcontent-%COMP%] {
    display: inline-block;
    margin: 0 4px 4px 0;
    padding: 1px 6px;
    border: 1px solid #52525b;
    border-radius: 4px;
    color: #d4d4d8;
    font-size: 11px;
    font-family: monospace;
  }
  .badge[_ngcontent-%COMP%] {
    padding: 1px 6px;
    border-radius: 4px;
    background: #3f3f46;
    color: #e4e4e7;
    font-size: 11px;
    font-weight: 600;
  }
  .badge[data-tone='good'][_ngcontent-%COMP%] {
    background: #14532d;
    color: #bbf7d0;
  }
  .badge[data-tone='warn'][_ngcontent-%COMP%] {
    background: #713f12;
    color: #fef08a;
  }
  .badge[data-tone='bad'][_ngcontent-%COMP%] {
    background: #7f1d1d;
    color: #fecaca;
  }
  button.small[_ngcontent-%COMP%] {
    padding: 3px 10px;
    background: #3f3f46;
    border: none;
    border-radius: 6px;
    color: #e4e4e7;
    cursor: pointer;
    font-size: 12px;
  }
  button.small[_ngcontent-%COMP%]:hover {
    background: #52525b;
  }
  button.small[_ngcontent-%COMP%]:focus-visible, 
   input[_ngcontent-%COMP%]:focus-visible, 
   select[_ngcontent-%COMP%]:focus-visible, 
   .table-scroll[_ngcontent-%COMP%]:focus-visible {
    outline: 2px solid var(--%NS%accent);
    outline-offset: 2px;
  }
  input.field[_ngcontent-%COMP%] {
    padding: 6px 10px;
    background: #18181b;
    border: 1px solid #52525b;
    border-radius: 6px;
    color: #e4e4e7;
    font-size: 13px;
  }
  .table-scroll[_ngcontent-%COMP%] {
    overflow-x: auto;
  }
  table[_ngcontent-%COMP%] {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  th[_ngcontent-%COMP%] {
    text-align: left;
    padding: 6px 12px;
    color: #a1a1aa;
    font-size: 12px;
    border-bottom: 1px solid #27272a;
  }
  td[_ngcontent-%COMP%] {
    padding: 8px 12px;
    border-bottom: 1px solid #1e1e22;
    vertical-align: top;
  }
  h3[_ngcontent-%COMP%] {
    margin: 0 0 8px;
    font-size: 14px;
    color: #e4e4e7;
  }
  .visually-hidden[_ngcontent-%COMP%] {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

    [_nghost-%COMP%] {
      display: grid;
      gap: 10px;
    }
    .toolbar[_ngcontent-%COMP%] {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }
    .findings[_ngcontent-%COMP%] {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 8px;
    }
    .findings[_ngcontent-%COMP%]   li[_ngcontent-%COMP%] {
      padding: 10px;
      border: 1px solid #27272a;
      border-radius: 6px;
      font-size: 13px;
      color: #e4e4e7;
    }
    .head[_ngcontent-%COMP%] {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .route[_ngcontent-%COMP%] {
      color: var(--%NS%accent);
    }
    p[_ngcontent-%COMP%] {
      margin: 6px 0 0;
    }
    .fix[_ngcontent-%COMP%] {
      color: #d4d4d8;
    }`]})},CT=(e,t)=>t.name,wT=(e,t)=>t[0];function TT(e,t){e&1&&(W(0,`p`,1),X(1,` Events-only mode: this build has no debug utils (production build or unusual setup), so the route config, lint and actions are limited. `),G())}function ET(e,t){if(e&1&&(W(0,`dt`),X(1,`Angular`),G(),W(2,`dd`),X(3),G()),e&2){let e=Y();I(3),Z(e.angularVersion)}}function DT(e,t){if(e&1&&(W(0,`dt`),X(1,`Base href`),G(),W(2,`dd`)(3,`code`),X(4),G()()),e&2){let e=Y();I(4),Z(e.baseHref)}}function OT(e,t){if(e&1&&(W(0,`dt`),X(1,`Hydration`),G(),W(2,`dd`),X(3),G()),e&2){let e=Y();I(3),Q(``,e.hydrated,` component(s) hydrated from server HTML`)}}function kT(e,t){if(e&1&&(W(0,`tr`)(1,`td`)(2,`code`),X(3),G()(),W(4,`td`)(5,`code`),X(6),G()(),W(7,`td`)(8,`span`,6),X(9),G()()()),e&2){let e=t.$implicit;I(3),Z(e.name),I(3),Z(e.value),I(2),L(`data-tone`,e.set?`warn`:``),I(),Z(e.set?`set`:`default`)}}function AT(e,t){if(e&1&&(W(0,`li`)(1,`span`,6),X(2),G()()),e&2){let e=t.$implicit;I(),L(`data-tone`,e[1]===`off`?``:`good`),I(),n_(``,e[0],`: `,e[1])}}function jT(e,t){if(e&1&&(W(0,`dt`),X(1),G(),W(2,`dd`)(3,`code`),X(4),G()()),e&2){let e=t.$implicit;I(),Z(e[0]),I(3),Z(e[1])}}function MT(e,t){if(e&1&&(R(0,TT,2,0,`p`,1),W(1,`dl`,2)(2,`dt`),X(3,`Set up with`),G(),W(4,`dd`),X(5),G(),R(6,ET,4,1),R(7,DT,5,1),R(8,OT,4,1),G(),W(9,`h3`),X(10,`Options`),G(),W(11,`div`,3)(12,`table`)(13,`thead`)(14,`tr`)(15,`th`,4),X(16,`Option`),G(),W(17,`th`,4),X(18,`Value`),G(),W(19,`th`,4),X(20,`Source`),G()()(),W(21,`tbody`),B(22,kT,10,4,`tr`,null,CT),G()()(),W(24,`h3`),X(25,`Features`),G(),W(26,`ul`,5),B(27,AT,3,3,`li`,null,wT),G(),W(29,`h3`),X(30,`Strategies`),G(),W(31,`dl`,2),B(32,jT,5,2,null,null,wT),G()),e&2){let e=t,n=Y();z(e.mode===`events-only`?0:-1),I(5),n_(` `,e.setupKind,``,e.routers>1?`, `+e.routers+` routers on the page`:``,` `),I(),z(e.angularVersion?6:-1),I(),z(e.baseHref?7:-1),I(),z(e.hydrated?8:-1),I(14),V(e.options),I(5),V(n.entries(e.features)),I(5),V(n.entries(e.strategies))}}function NT(e,t){e&1&&(W(0,`p`,0),X(1,`The page has not reported its router setup yet.`),G())}var PT=class e{page=k_.required();entries(e){return Object.entries(e)}static ɵfac=function(t){return new(t||e)};static ɵcmp=nm({type:e,selectors:[[`app-route-setup`]],inputs:{page:[1,`page`]},decls:2,vars:1,consts:[[1,`muted`],[`role`,`note`,1,`note`],[1,`facts`],[`role`,`region`,`aria-label`,`Router options`,`tabindex`,`0`,1,`table-scroll`],[`scope`,`col`],[1,`chips`],[1,`badge`]],template:function(e,t){if(e&1&&R(0,MT,34,6)(1,NT,2,0,`p`,0),e&2){let e;z((e=t.page().setup)?0:1,e)}},styles:[`.muted[_ngcontent-%COMP%] {
    color: #a1a1aa;
    font-size: 13px;
  }
  code[_ngcontent-%COMP%] {
    font-family: monospace;
    color: #d4d4d8;
    overflow-wrap: anywhere;
  }
  .tag[_ngcontent-%COMP%] {
    display: inline-block;
    margin: 0 4px 4px 0;
    padding: 1px 6px;
    border: 1px solid #52525b;
    border-radius: 4px;
    color: #d4d4d8;
    font-size: 11px;
    font-family: monospace;
  }
  .badge[_ngcontent-%COMP%] {
    padding: 1px 6px;
    border-radius: 4px;
    background: #3f3f46;
    color: #e4e4e7;
    font-size: 11px;
    font-weight: 600;
  }
  .badge[data-tone='good'][_ngcontent-%COMP%] {
    background: #14532d;
    color: #bbf7d0;
  }
  .badge[data-tone='warn'][_ngcontent-%COMP%] {
    background: #713f12;
    color: #fef08a;
  }
  .badge[data-tone='bad'][_ngcontent-%COMP%] {
    background: #7f1d1d;
    color: #fecaca;
  }
  button.small[_ngcontent-%COMP%] {
    padding: 3px 10px;
    background: #3f3f46;
    border: none;
    border-radius: 6px;
    color: #e4e4e7;
    cursor: pointer;
    font-size: 12px;
  }
  button.small[_ngcontent-%COMP%]:hover {
    background: #52525b;
  }
  button.small[_ngcontent-%COMP%]:focus-visible, 
   input[_ngcontent-%COMP%]:focus-visible, 
   select[_ngcontent-%COMP%]:focus-visible, 
   .table-scroll[_ngcontent-%COMP%]:focus-visible {
    outline: 2px solid var(--%NS%accent);
    outline-offset: 2px;
  }
  input.field[_ngcontent-%COMP%] {
    padding: 6px 10px;
    background: #18181b;
    border: 1px solid #52525b;
    border-radius: 6px;
    color: #e4e4e7;
    font-size: 13px;
  }
  .table-scroll[_ngcontent-%COMP%] {
    overflow-x: auto;
  }
  table[_ngcontent-%COMP%] {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  th[_ngcontent-%COMP%] {
    text-align: left;
    padding: 6px 12px;
    color: #a1a1aa;
    font-size: 12px;
    border-bottom: 1px solid #27272a;
  }
  td[_ngcontent-%COMP%] {
    padding: 8px 12px;
    border-bottom: 1px solid #1e1e22;
    vertical-align: top;
  }
  h3[_ngcontent-%COMP%] {
    margin: 0 0 8px;
    font-size: 14px;
    color: #e4e4e7;
  }
  .visually-hidden[_ngcontent-%COMP%] {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

    [_nghost-%COMP%] {
      display: grid;
      gap: 12px;
    }
    .note[_ngcontent-%COMP%] {
      margin: 0;
      padding: 8px 10px;
      border-left: 3px solid #fef08a;
      background: #27272a;
      color: #e4e4e7;
      font-size: 13px;
    }
    .facts[_ngcontent-%COMP%] {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 4px 12px;
      margin: 0;
      font-size: 13px;
    }
    dt[_ngcontent-%COMP%] {
      color: #a1a1aa;
    }
    dd[_ngcontent-%COMP%] {
      margin: 0;
      color: #e4e4e7;
    }
    .chips[_ngcontent-%COMP%] {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 0;
      padding: 0;
      list-style: none;
    }`]})},FT=(e,t)=>[e,t],IT=(e,t)=>t.id,LT=(e,t)=>t.phase;function RT(e,t){if(e&1&&(W(0,`p`,5),X(1),G()),e&2){let e=Y();I(),Z(e.message())}}function zT(e,t){if(e&1&&(W(0,`span`),Gh(1,`i`),X(2),G()),e&2){let e=t.$implicit,n=Y();I(),Ag(`background`,n.color(e)),I(),Z(e)}}function BT(e,t){if(e&1&&(W(0,`time`),X(1),G()),e&2){let e=Y().$implicit,t=Y(2);I(),Z(t.time(e.startedAt))}}function VT(e,t){if(e&1&&(W(0,`span`,15),X(1,`→`),G(),W(2,`span`,16),X(3,`redirected to`),G(),W(4,`code`),X(5),G()),e&2){let e=Y().$implicit;I(5),Z(e.finalUrl)}}function HT(e,t){if(e&1&&(W(0,`span`,8),X(1),G()),e&2){let e=Y().$implicit;I(),Z(e.endedAt===void 0&&e.outcome!==`pending`?`before DevTools connected`:`started before DevTools connected`)}}function UT(e,t){if(e&1&&(W(0,`span`,8),X(1),G()),e&2){let e=Y().$implicit;I(),Q(``,e.phases?.total,`ms`)}}function WT(e,t){if(e&1&&(W(0,`span`,8),X(1),G()),e&2){let e=Y().$implicit;I(),Q(``,e.endedAt-e.startedAt,`ms`)}}function GT(e,t){e&1&&(W(0,`span`,11),X(1,`probe`),G())}function KT(e,t){if(e&1&&Gh(0,`span`),e&2){let e=t.$implicit,n=Y(4);Ag(`width`,e.width,`%`)(`background`,n.color(e.phase)),L(`title`,e.phase+` `+e.ms+`ms`)}}function qT(e,t){if(e&1&&(W(0,`div`,12),B(1,KT,1,5,`span`,17,LT),G()),e&2){let e=Y().$implicit,t=Y(2);L(`aria-label`,t.barLabel(e)),I(),V(t.bars(e))}}function JT(e,t){if(e&1&&(W(0,`dt`),X(1,`From`),G(),W(2,`dd`)(3,`code`),X(4),G()()),e&2){let e=Y().$implicit;I(4),Z(e.from)}}function YT(e,t){if(e&1&&(W(0,`dt`),X(1,`Started by`),G(),W(2,`dd`),X(3),G()),e&2){let e=Y().$implicit;I(3),n_(``,e.caller,` (`,e.trigger,`)`)}}function XT(e,t){if(e&1&&(W(0,`dt`),X(1,`Extras`),G(),W(2,`dd`),X(3),G()),e&2){let e=Y().$implicit;I(3),Z(e.extras?.join(`, `))}}function ZT(e,t){if(e&1&&(W(0,`dt`),X(1,`Redirect of`),G(),W(2,`dd`),X(3),G()),e&2){let e=Y().$implicit;I(3),Q(`#`,e.redirectedFrom)}}function QT(e,t){if(e&1&&(W(0,`dt`),X(1,`Redirects to`),G(),W(2,`dd`)(3,`code`),X(4),G(),X(5),G()),e&2){let e=Y().$implicit;I(4),Z(e.redirectTo),I(),Q(` (`,e.redirectKind,`) `)}}function $T(e,t){if(e&1&&(W(0,`dt`),X(1,`Guards`),G(),W(2,`dd`),X(3),G()),e&2){let e=Y().$implicit,t=Y(2);I(3),n_(``,e.guards.names.join(`, `)||`none`,`: `,t.guardResult(e))}}function eE(e,t){if(e&1&&(W(0,`div`)(1,`code`),X(2),G(),X(3),W(4,`code`),X(5),G(),X(6,`: `),W(7,`strong`),X(8),G(),X(9),G()),e&2){let e=t.$implicit,n=Y(4);I(2),Z(e.guard),I(),Q(` `,e.kind,` on `),I(2),Z(e.route),I(2),jg(`bad`,n.isBad(e.result)),I(),Z(e.result),I(),Q(` (`,e.ms,`ms) `)}}function tE(e,t){if(e&1&&(W(0,`dt`),X(1,`Runs`),G(),W(2,`dd`),B(3,eE,10,7,`div`,null,jh),G()),e&2){let e=Y().$implicit;I(3),V(e.runs)}}function nE(e,t){if(e&1&&X(0),e&2){let e=Y(2).$implicit;Q(` leaving `,e.checked.deactivate.join(`, `),`; `)}}function rE(e,t){if(e&1&&(W(0,`dt`),X(1,`Checked`),G(),W(2,`dd`),R(3,nE,1,1),X(4),G()),e&2){let e=Y().$implicit;I(3),z(e.checked.deactivate.length?3:-1),I(),Q(` entering `,e.checked.activate.join(`, `)||`nothing new`,` `)}}function iE(e,t){if(e&1&&(W(0,`dt`),X(1,`Resolvers`),G(),W(2,`dd`),X(3),G()),e&2){let e=Y().$implicit;I(3),Z(e.resolvers?.names?.join(`, `))}}function aE(e,t){if(e&1&&(W(0,`dt`),X(1,`Lazy loaded`),G(),W(2,`dd`),X(3),G()),e&2){let e=Y().$implicit;I(3),Z(e.lazyLoaded?.join(`, `))}}function oE(e,t){if(e&1&&(W(0,`dt`),X(1,`Reused`),G(),W(2,`dd`),X(3),G()),e&2){let e=Y().$implicit;I(3),Q(` `,e.reused?.join(`, `),` (component kept, only inputs and params change) `)}}function sE(e,t){if(e&1&&(W(0,`dt`),X(1,`HTTP`),G(),W(2,`dd`),X(3),G()),e&2){let e=Y().$implicit;I(3),n_(``,e.requests.count,` request(s): `,e.requests.urls.join(`, `))}}function cE(e,t){if(e&1&&(W(0,`dt`),X(1,`Scroll`),G(),W(2,`dd`),X(3),G()),e&2){let e=Y().$implicit;I(3),Z(e.scroll)}}function lE(e,t){if(e&1&&(W(0,`dt`),X(1,`Title after`),G(),W(2,`dd`),X(3),G()),e&2){let e=Y().$implicit;I(3),Z(e.title)}}function uE(e,t){if(e&1&&(W(0,`dt`),X(1,`Warnings`),G(),W(2,`dd`),X(3),G()),e&2){let e=Y().$implicit;I(3),Z(e.warnings?.join(` · `))}}function dE(e,t){if(e&1&&(W(0,`dt`),X(1,`Reason`),G(),W(2,`dd`,18),X(3),G()),e&2){let e=Y().$implicit,t=Y(2);I(3),Z(o_(1,FT,e.code,e.reason).filter(t.Boolean).join(`: `))}}function fE(e,t){if(e&1&&(W(0,`dt`),X(1,`Error`),G(),W(2,`dd`,18),X(3),G()),e&2){let e=Y().$implicit;I(3),Z(e.errorCode)}}function pE(e,t){if(e&1&&(W(0,`dt`),X(1,`Error handler`),G(),W(2,`dd`),X(3),G()),e&2){let e=Y().$implicit;I(3),Z(e.errorHandler)}}function mE(e,t){if(e&1&&(W(0,`dt`),X(1,`Earlier`),G(),W(2,`dd`),X(3),G()),e&2){let e=Y().$implicit;I(3),Q(``,e.earlier,` navigation(s) before DevTools connected`)}}function hE(e,t){if(e&1){let e=K();W(0,`li`)(1,`div`,9),R(2,BT,2,1,`time`),W(3,`span`,8),X(4),G(),W(5,`code`),X(6),G(),R(7,VT,6,1),W(8,`span`,10),X(9),G(),R(10,HT,2,1,`span`,8)(11,UT,2,1,`span`,8)(12,WT,2,1,`span`,8),R(13,GT,2,0,`span`,11),G(),R(14,qT,3,1,`div`,12),W(15,`dl`,13),R(16,JT,5,1),R(17,YT,4,2),R(18,XT,4,1),R(19,ZT,4,1),R(20,QT,6,2),R(21,$T,4,2),R(22,tE,5,0),R(23,rE,5,2),R(24,iE,4,1),R(25,aE,4,1),R(26,oE,4,1),R(27,sE,4,2),R(28,cE,4,1),R(29,lE,4,1),R(30,uE,4,1),R(31,dE,4,4),R(32,fE,4,1),R(33,pE,4,1),R(34,mE,4,1),G(),W(35,`div`,14)(36,`button`,4),J(`click`,function(){let t=N(e).$implicit;return P(Y(2).replay(t))}),X(37,` Replay `),G(),W(38,`button`,4),J(`click`,function(){let t=N(e).$implicit;return P(Y(2).copy(t))}),X(39,` Copy repro `),G()()()}if(e&2){let e=t.$implicit,n=Y(2);I(2),z(e.beforeConnect?-1:2),I(2),Q(`#`,e.id),I(2),Z(e.url),I(),z(e.finalUrl&&e.finalUrl!==e.url?7:-1),I(),L(`data-tone`,n.tone(e.outcome)),I(),Z(e.outcome),I(),z(e.beforeConnect?10:e.phases?.total===void 0?e.endedAt===void 0?-1:12:11),I(3),z(e.probe?13:-1),I(),z(n.bars(e).length?14:-1),I(2),z(e.from?16:-1),I(),z(e.caller?17:-1),I(),z(e.extras?.length?18:-1),I(),z(e.redirectedFrom===void 0?-1:19),I(),z(e.redirectTo?20:-1),I(),z(e.guards&&(e.guards.names.length||e.guards.passed===!1)?21:-1),I(),z(e.runs?.length?22:-1),I(),z(e.checked&&(e.checked.activate.length||e.checked.deactivate.length)?23:-1),I(),z(e.resolvers?.names?.length?24:-1),I(),z(e.lazyLoaded?.length?25:-1),I(),z(e.reused?.length?26:-1),I(),z(e.requests?27:-1),I(),z(e.scroll?28:-1),I(),z(e.title?29:-1),I(),z(e.warnings?.length?30:-1),I(),z(e.reason||e.code?31:-1),I(),z(e.errorCode?32:-1),I(),z(e.errorHandler?33:-1),I(),z(e.earlier?34:-1),I(2),L(`aria-label`,`Replay navigation `+e.id),I(2),L(`aria-label`,`Copy repro for navigation `+e.id)}}function gE(e,t){if(e&1&&(W(0,`ol`,7),B(1,hE,40,30,`li`,null,IT),G()),e&2){let e=Y();I(),V(e.items())}}function _E(e,t){e&1&&(W(0,`p`,8),X(1,` No navigations since DevTools connected; earlier ones are not visible. Click a link in the app. `),G())}var vE=[`recognize`,`guards`,`resolve`,`activate`],yE={recognize:`#60a5fa`,guards:`#f59e0b`,resolve:`#a78bfa`,activate:`#34d399`},bE=class e{page=k_.required();rpc=k_(null);phases=vE;filter=F(``);onlyProblems=F(!1);message=F(``);items=$(()=>{let e=this.filter().toLowerCase();return[...this.page().navigations].reverse().filter(t=>(!e||t.url.toLowerCase().includes(e)||!!t.finalUrl?.toLowerCase().includes(e))&&(!this.onlyProblems()||![`succeeded`,`pending`].includes(t.outcome)))});tone(e){return Bw(e)}color(e){return yE[e]}bars(e){let t=e.phases?.total;return t?vE.filter(t=>(e.phases?.[t]??0)>0).map(n=>({phase:n,ms:e.phases[n],width:Math.max(1,e.phases[n]/t*100)})):[]}barLabel(e){return`Phases: ${this.bars(e).map(e=>`${e.phase} ${e.ms}ms`).join(`, `)}`}guardResult(e){let t=e.guards?.passed;return t===!0?`passed`:t===!1?e.outcome===`redirected`?`redirected`:`blocked`:e.outcome===`pending`?`running`:`did not finish, navigation ${e.outcome}`}isBad(e){return e===`false`||/^(UrlTree|RedirectCommand|threw)/.test(e)}time(e){return new Date(e).toLocaleTimeString()}async toggleInstrument(e){let t=e.target.checked,n=await zw(this.rpc(),this.page().pageId,{action:`instrument`,on:t});this.message.set(n?.error?String(n.error):t?`Recording each guard and resolver.`:`Stopped recording guards and resolvers.`)}async replay(e){this.message.set(`Replaying #${e.id}…`);let t=await zw(this.rpc(),this.page().pageId,{action:`replay`,id:e.id});if(!t||t.error){this.message.set(String(t?.error??`Replay failed.`));return}let n=t.replay;this.message.set(`Replay of #${e.id}: ${n?.outcome??`unknown`}${t.same?` (same as before)`:` (different from before)`}.`)}async copy(e){let t=await Rw(this.rpc(),`router-export`,{pageId:this.page().pageId,id:e.id});if(!t){this.message.set(`Could not build the repro.`);return}try{await navigator.clipboard.writeText(t),this.message.set(`Copied a markdown repro of #${e.id}.`)}catch{this.message.set(`The clipboard is not available here.`)}}exportJson(){let e=new Blob([JSON.stringify(this.page().navigations,null,2)],{type:`application/json`}),t=URL.createObjectURL(e),n=document.createElement(`a`);n.href=t,n.download=`navigations-${this.page().pageId}.json`,n.click(),URL.revokeObjectURL(t)}static ɵfac=function(t){return new(t||e)};static ɵcmp=nm({type:e,selectors:[[`app-route-timeline`]],inputs:{page:[1,`page`],rpc:[1,`rpc`]},decls:16,vars:5,consts:[[1,`toolbar`],[1,`check`],[`type`,`checkbox`,3,`change`,`checked`],[`type`,`text`,`aria-label`,`Filter navigations by URL`,`placeholder`,`Filter by URL`,1,`field`,3,`input`,`value`],[`type`,`button`,1,`small`,3,`click`],[`role`,`status`,1,`muted`],[`aria-hidden`,`true`,1,`legend`],[1,`navs`],[1,`muted`],[1,`head`],[1,`badge`],[1,`tag`],[`role`,`img`,1,`bar`],[1,`details`],[1,`actions`],[`aria-hidden`,`true`],[1,`visually-hidden`],[3,`width`,`background`],[1,`reason`]],template:function(e,t){e&1&&(W(0,`div`,0)(1,`label`,1)(2,`input`,2),J(`change`,function(e){return t.toggleInstrument(e)}),G(),X(3,` Record each guard and resolver `),G(),W(4,`input`,3),J(`input`,function(e){return t.filter.set(e.target.value)}),G(),W(5,`label`,1)(6,`input`,2),J(`change`,function(e){return t.onlyProblems.set(e.target.checked)}),G(),X(7,` Only problems `),G(),W(8,`button`,4),J(`click`,function(){return t.exportJson()}),X(9,`Export JSON`),G()(),R(10,RT,2,1,`p`,5),W(11,`div`,6),B(12,zT,3,3,`span`,null,Mh),G(),R(14,gE,3,0,`ol`,7)(15,_E,2,0,`p`,8)),e&2&&(I(2),q(`checked`,t.page().instrumented),I(2),q(`value`,t.filter()),I(2),q(`checked`,t.onlyProblems()),I(4),z(t.message()?10:-1),I(2),V(t.phases),I(2),z(t.items().length?14:15))},styles:[`.muted[_ngcontent-%COMP%] {
    color: #a1a1aa;
    font-size: 13px;
  }
  code[_ngcontent-%COMP%] {
    font-family: monospace;
    color: #d4d4d8;
    overflow-wrap: anywhere;
  }
  .tag[_ngcontent-%COMP%] {
    display: inline-block;
    margin: 0 4px 4px 0;
    padding: 1px 6px;
    border: 1px solid #52525b;
    border-radius: 4px;
    color: #d4d4d8;
    font-size: 11px;
    font-family: monospace;
  }
  .badge[_ngcontent-%COMP%] {
    padding: 1px 6px;
    border-radius: 4px;
    background: #3f3f46;
    color: #e4e4e7;
    font-size: 11px;
    font-weight: 600;
  }
  .badge[data-tone='good'][_ngcontent-%COMP%] {
    background: #14532d;
    color: #bbf7d0;
  }
  .badge[data-tone='warn'][_ngcontent-%COMP%] {
    background: #713f12;
    color: #fef08a;
  }
  .badge[data-tone='bad'][_ngcontent-%COMP%] {
    background: #7f1d1d;
    color: #fecaca;
  }
  button.small[_ngcontent-%COMP%] {
    padding: 3px 10px;
    background: #3f3f46;
    border: none;
    border-radius: 6px;
    color: #e4e4e7;
    cursor: pointer;
    font-size: 12px;
  }
  button.small[_ngcontent-%COMP%]:hover {
    background: #52525b;
  }
  button.small[_ngcontent-%COMP%]:focus-visible, 
   input[_ngcontent-%COMP%]:focus-visible, 
   select[_ngcontent-%COMP%]:focus-visible, 
   .table-scroll[_ngcontent-%COMP%]:focus-visible {
    outline: 2px solid var(--%NS%accent);
    outline-offset: 2px;
  }
  input.field[_ngcontent-%COMP%] {
    padding: 6px 10px;
    background: #18181b;
    border: 1px solid #52525b;
    border-radius: 6px;
    color: #e4e4e7;
    font-size: 13px;
  }
  .table-scroll[_ngcontent-%COMP%] {
    overflow-x: auto;
  }
  table[_ngcontent-%COMP%] {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  th[_ngcontent-%COMP%] {
    text-align: left;
    padding: 6px 12px;
    color: #a1a1aa;
    font-size: 12px;
    border-bottom: 1px solid #27272a;
  }
  td[_ngcontent-%COMP%] {
    padding: 8px 12px;
    border-bottom: 1px solid #1e1e22;
    vertical-align: top;
  }
  h3[_ngcontent-%COMP%] {
    margin: 0 0 8px;
    font-size: 14px;
    color: #e4e4e7;
  }
  .visually-hidden[_ngcontent-%COMP%] {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

    [_nghost-%COMP%] {
      display: grid;
      gap: 10px;
    }
    .toolbar[_ngcontent-%COMP%] {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 14px;
      align-items: center;
      font-size: 13px;
      color: #e4e4e7;
    }
    .check[_ngcontent-%COMP%] {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .legend[_ngcontent-%COMP%] {
      display: flex;
      gap: 12px;
      font-size: 12px;
      color: #a1a1aa;
    }
    .legend[_ngcontent-%COMP%]   i[_ngcontent-%COMP%] {
      display: inline-block;
      width: 10px;
      height: 10px;
      margin-right: 4px;
      border-radius: 2px;
    }
    .navs[_ngcontent-%COMP%] {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 8px;
    }
    .navs[_ngcontent-%COMP%]    > li[_ngcontent-%COMP%] {
      padding: 10px;
      border: 1px solid #27272a;
      border-radius: 6px;
      font-size: 13px;
    }
    .head[_ngcontent-%COMP%] {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    time[_ngcontent-%COMP%] {
      color: #a1a1aa;
      font-size: 12px;
    }
    .bar[_ngcontent-%COMP%] {
      display: flex;
      height: 6px;
      margin: 8px 0 4px;
      border-radius: 3px;
      overflow: hidden;
      background: #27272a;
    }
    .bar[_ngcontent-%COMP%]   span[_ngcontent-%COMP%] {
      display: block;
      min-width: 2px;
    }
    .details[_ngcontent-%COMP%] {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 3px 12px;
      margin: 6px 0 0;
      font-size: 12px;
    }
    dt[_ngcontent-%COMP%] {
      color: #a1a1aa;
    }
    dd[_ngcontent-%COMP%] {
      margin: 0;
      color: #e4e4e7;
      overflow-wrap: anywhere;
    }
    .reason[_ngcontent-%COMP%], 
   .bad[_ngcontent-%COMP%] {
      color: #fecaca;
    }
    .actions[_ngcontent-%COMP%] {
      display: flex;
      gap: 8px;
      margin-top: 8px;
    }`]})},xE=()=>[],SE=(e,t)=>t.node.id;function CE(e,t){if(e&1&&(X(0,` with `),W(1,`code`),X(2),u_(3,`json`),G()),e&2){let e=Y(2);I(2),Z(f_(3,1,e.params))}}function wE(e,t){if(e&1&&(X(0),R(1,CE,4,3)),e&2){let e=Y(),t=Y();Q(` Matches `,t.chainText(e),` `),I(),z(t.hasKeys(e.params)?1:-1)}}function TE(e,t){e&1&&X(0),e&2&&Q(` Nearest: `,Y(2).nearest.join(`, `),` `)}function EE(e,t){if(e&1&&(X(0,` Matches no route (NG04002). `),R(1,TE,1,1)),e&2){let e=Y();I(),z(e.nearest.length?1:-1)}}function DE(e,t){if(e&1&&(W(0,`div`,8),X(1),G()),e&2){let e=t.$implicit;I(),Z(e)}}function OE(e,t){if(e&1&&(W(0,`div`,5),R(1,wE,2,2)(2,EE,2,1),B(3,DE,2,1,`div`,8,Mh),G()),e&2){let e=t;I(),z(e.matched?1:2),I(2),V(e.notes)}}function kE(e,t){if(e&1&&(W(0,`p`,6),X(1),G()),e&2){let e=Y();I(),Z(e.message())}}function AE(e,t){if(e&1&&(W(0,`p`,8),X(1),G()),e&2){let e=Y();I(),Q(` `,e.page().setup?.mode===`events-only`?`This build has no debug utils, so the live config cannot be read.`:`The page has not reported its route config yet.`,` `)}}function jE(e,t){e&1&&(W(0,`span`,14),X(1,`active`),G())}function ME(e,t){if(e&1&&(W(0,`span`,14),X(1),G()),e&2){let e=Y().$implicit;I(),Q(`lazy `,e.node.lazy)}}function NE(e,t){if(e&1&&(W(0,`span`,14),X(1),G()),e&2){let e=Y().$implicit;I(),Q(`outlet `,e.node.outlet)}}function PE(e,t){if(e&1&&(X(0,` redirect → `),W(1,`code`),X(2),G()),e&2){let e=Y().$implicit;I(2),Z(e.node.redirectTo)}}function FE(e,t){if(e&1&&X(0),e&2){let e=Y().$implicit;Q(` `,e.node.component??(e.node.lazy===`unloaded`?`lazy, not loaded yet`:e.node.kind),` `)}}function IE(e,t){if(e&1&&(W(0,`span`,14),X(1),G()),e&2){let e=t.$implicit;I(),Z(e)}}function LE(e,t){if(e&1&&(W(0,`span`,14),X(1),G()),e&2){let e=t.$implicit;I(),Q(`resolve `,e)}}function RE(e,t){if(e&1){let e=K();W(0,`input`,18),J(`input`,function(t){let n=N(e).$implicit,r=Y(2).$implicit;return P(Y(2).setParam(r.node.id,n,t.target.value))}),G()}if(e&2){let e=t.$implicit,n=Y(2).$implicit;q(`placeholder`,e),L(`aria-label`,e+` for `+n.node.fullPath)}}function zE(e,t){if(e&1){let e=K();B(0,RE,1,2,`input`,17,Mh),W(2,`button`,4),J(`click`,function(){N(e);let t=Y().$implicit;return P(Y(2).navigate(t.node))}),X(3,` Go `),G()}if(e&2){let e=Y().$implicit;V(Y(2).params(e.node)),I(2),L(`aria-label`,`Navigate to `+e.node.fullPath)}}function BE(e,t){if(e&1){let e=K();W(0,`button`,4),J(`click`,function(){N(e);let t=Y().$implicit;return P(Y(2).resolveLazy(t.node))}),X(1,` Read lazy `),G()}if(e&2){let e=Y().$implicit;L(`aria-label`,`Read lazy routes of `+e.node.fullPath)}}function VE(e,t){if(e&1&&(W(0,`tr`)(1,`td`,13),X(2),R(3,jE,2,0,`span`,14),R(4,ME,2,1,`span`,14),R(5,NE,2,1,`span`,14),G(),W(6,`td`),R(7,PE,3,1)(8,FE,1,1),G(),W(9,`td`),B(10,IE,2,1,`span`,14,Mh),B(12,LE,2,1,`span`,14,Mh),G(),W(14,`td`),X(15),G(),W(16,`td`,15),R(17,zE,4,1),R(18,BE,2,1,`button`,16),G()()),e&2){let e=t.$implicit,n=Y(2);jg(`active`,n.isActive(e.node)),I(),Ag(`padding-left`,12+e.depth*16,`px`),I(),Q(` `,e.node.fullPath,` `),I(),z(n.isActive(e.node)?3:-1),I(),z(e.node.lazy?4:-1),I(),z(e.node.outlet?5:-1),I(2),z(e.node.redirectTo===void 0?8:7),I(3),V(n.guardList(e.node)),I(2),V(e.node.resolvers??a_(12,xE)),I(3),Z(e.node.title??``),I(2),z(n.canNavigate(e.node)?17:-1),I(),z(e.node.kind===`lazy`&&e.node.lazy===`unloaded`?18:-1)}}function HE(e,t){if(e&1&&(W(0,`p`,8),X(1),G(),W(2,`div`,9)(3,`table`)(4,`thead`)(5,`tr`)(6,`th`,10),X(7,`Path`),G(),W(8,`th`,10),X(9,`Target`),G(),W(10,`th`,10),X(11,`Guards and resolvers`),G(),W(12,`th`,10),X(13,`Title`),G(),W(14,`th`,10)(15,`span`,11),X(16,`Actions`),G()()()(),W(17,`tbody`),B(18,VE,19,13,`tr`,12,SE),G()()()),e&2){let e=Y();I(),n_(` Generation `,e.page().generation,` · `,e.rows().length,` route(s). Lazy routes show their children once loaded. `),I(17),V(e.rows())}}var UE=class e{page=k_.required();rpc=k_(null);filter=F(``);testUrl=F(``);match=F(null);message=F(``);paramValues=new Map;active=$(()=>new Set(this.page().activeIds??[]));rows=$(()=>{let e=this.filter().toLowerCase(),t=[],n=(r,i)=>{for(let a of r)(!e||a.fullPath.toLowerCase().includes(e)||a.component?.toLowerCase().includes(e))&&t.push({node:a,depth:i}),a.children&&n(a.children,i+1)};return n(this.page().config??[],0),t});hasKeys(e){return Object.keys(e).length>0}isActive(e){return this.active().has(e.id)}guardList(e){return Object.entries(e.guards??{}).flatMap(([e,t])=>t.map(t=>`${e} ${t}`))}params(e){return(e.fullPath.match(/:([A-Za-z0-9_]+)/g)??[]).map(e=>e.slice(1))}canNavigate(e){return e.redirectTo===void 0&&!e.outlet&&!e.fullPath.includes(`**`)&&(!!e.component||e.kind===`component`||e.kind===`lazy`)}setParam(e,t,n){this.paramValues.set(e,{...this.paramValues.get(e),[t]:n})}chainText(e){return e.chain.map(e=>e.fullPath).join(` → `)}async predict(){let e=this.testUrl().trim();e&&this.match.set(await Rw(this.rpc(),`router-match`,{pageId:this.page().pageId,url:e}))}async probe(){let e=this.testUrl().trim();if(!e)return;this.message.set(`Running the real matcher in the app…`);let t=await zw(this.rpc(),this.page().pageId,{action:`probe`,url:e});if(!t||t.error){this.message.set(String(t?.error??`Probe failed.`));return}this.message.set(t.matched?`The app matched ${e} (see the probe entry in Navigations).`:`The app did not match ${e}: ${String(t.reason??``)}`)}async navigate(e){let t=this.paramValues.get(e.id)??{};this.message.set(`Navigating to ${e.fullPath}…`);let n=await zw(this.rpc(),this.page().pageId,{action:`navigate`,pattern:e.fullPath,params:t});this.message.set(!n||n.error?String(n?.error??`Navigation failed.`):`Navigation #${n.id}: ${n.outcome}${n.finalUrl?` at ${n.finalUrl}`:``}.`)}async resolveLazy(e){let t=await zw(this.rpc(),this.page().pageId,{action:`resolve-lazy`,id:e.id});if(!t||t.error){this.message.set(String(t?.error??`Could not read the lazy routes.`));return}let n=t.routes??[];this.message.set(`${e.fullPath} declares ${n.length} route(s): ${n.map(e=>`/${e.path}`).join(`, `)}. The router loads them for real on the first navigation that needs them.`)}static ɵfac=function(t){return new(t||e)};static ɵcmp=nm({type:e,selectors:[[`app-route-tree`]],inputs:{page:[1,`page`],rpc:[1,`rpc`]},decls:13,vars:5,consts:[[1,`test`,3,`submit`],[`for`,`test-url`],[`id`,`test-url`,`type`,`text`,`placeholder`,`/users/42`,1,`field`,3,`input`,`value`],[`type`,`submit`,1,`small`],[`type`,`button`,1,`small`,3,`click`],[`role`,`status`,1,`result`],[`role`,`status`,1,`muted`],[`type`,`text`,`aria-label`,`Filter routes`,`placeholder`,`Filter by path or component`,1,`field`,`filter`,3,`input`,`value`],[1,`muted`],[`role`,`region`,`aria-label`,`Live route config`,`tabindex`,`0`,1,`table-scroll`],[`scope`,`col`],[1,`visually-hidden`],[3,`active`],[1,`path`],[1,`tag`],[1,`actions`],[`type`,`button`,1,`small`],[`type`,`text`,1,`field`,`param`,3,`placeholder`],[`type`,`text`,1,`field`,`param`,3,`input`,`placeholder`]],template:function(e,t){if(e&1&&(W(0,`form`,0),J(`submit`,function(e){return e.preventDefault(),t.predict()}),W(1,`label`,1),X(2,`Test a URL`),G(),W(3,`input`,2),J(`input`,function(e){return t.testUrl.set(e.target.value)}),G(),W(4,`button`,3),X(5,`Predict`),G(),W(6,`button`,4),J(`click`,function(){return t.probe()}),X(7,`Probe in app`),G()(),R(8,OE,5,1,`div`,5),R(9,kE,2,1,`p`,6),W(10,`input`,7),J(`input`,function(e){return t.filter.set(e.target.value)}),G(),R(11,AE,2,1,`p`,8)(12,HE,20,2)),e&2){let e;I(3),q(`value`,t.testUrl()),I(5),z((e=t.match())?8:-1,e),I(),z(t.message()?9:-1),I(),q(`value`,t.filter()),I(),z(t.page().config?12:11)}},dependencies:[Wv],styles:[`.muted[_ngcontent-%COMP%] {
    color: #a1a1aa;
    font-size: 13px;
  }
  code[_ngcontent-%COMP%] {
    font-family: monospace;
    color: #d4d4d8;
    overflow-wrap: anywhere;
  }
  .tag[_ngcontent-%COMP%] {
    display: inline-block;
    margin: 0 4px 4px 0;
    padding: 1px 6px;
    border: 1px solid #52525b;
    border-radius: 4px;
    color: #d4d4d8;
    font-size: 11px;
    font-family: monospace;
  }
  .badge[_ngcontent-%COMP%] {
    padding: 1px 6px;
    border-radius: 4px;
    background: #3f3f46;
    color: #e4e4e7;
    font-size: 11px;
    font-weight: 600;
  }
  .badge[data-tone='good'][_ngcontent-%COMP%] {
    background: #14532d;
    color: #bbf7d0;
  }
  .badge[data-tone='warn'][_ngcontent-%COMP%] {
    background: #713f12;
    color: #fef08a;
  }
  .badge[data-tone='bad'][_ngcontent-%COMP%] {
    background: #7f1d1d;
    color: #fecaca;
  }
  button.small[_ngcontent-%COMP%] {
    padding: 3px 10px;
    background: #3f3f46;
    border: none;
    border-radius: 6px;
    color: #e4e4e7;
    cursor: pointer;
    font-size: 12px;
  }
  button.small[_ngcontent-%COMP%]:hover {
    background: #52525b;
  }
  button.small[_ngcontent-%COMP%]:focus-visible, 
   input[_ngcontent-%COMP%]:focus-visible, 
   select[_ngcontent-%COMP%]:focus-visible, 
   .table-scroll[_ngcontent-%COMP%]:focus-visible {
    outline: 2px solid var(--%NS%accent);
    outline-offset: 2px;
  }
  input.field[_ngcontent-%COMP%] {
    padding: 6px 10px;
    background: #18181b;
    border: 1px solid #52525b;
    border-radius: 6px;
    color: #e4e4e7;
    font-size: 13px;
  }
  .table-scroll[_ngcontent-%COMP%] {
    overflow-x: auto;
  }
  table[_ngcontent-%COMP%] {
    width: 100%;
    border-collapse: collapse;
    font-size: 13px;
  }
  th[_ngcontent-%COMP%] {
    text-align: left;
    padding: 6px 12px;
    color: #a1a1aa;
    font-size: 12px;
    border-bottom: 1px solid #27272a;
  }
  td[_ngcontent-%COMP%] {
    padding: 8px 12px;
    border-bottom: 1px solid #1e1e22;
    vertical-align: top;
  }
  h3[_ngcontent-%COMP%] {
    margin: 0 0 8px;
    font-size: 14px;
    color: #e4e4e7;
  }
  .visually-hidden[_ngcontent-%COMP%] {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }

    [_nghost-%COMP%] {
      display: grid;
      gap: 10px;
    }
    .test[_ngcontent-%COMP%] {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      font-size: 13px;
      color: #e4e4e7;
    }
    .result[_ngcontent-%COMP%] {
      padding: 8px 10px;
      border: 1px solid #27272a;
      border-radius: 6px;
      font-size: 13px;
      color: #e4e4e7;
    }
    .filter[_ngcontent-%COMP%] {
      max-width: 320px;
    }
    .path[_ngcontent-%COMP%] {
      font-family: monospace;
      color: var(--%NS%accent);
      white-space: nowrap;
    }
    tr.active[_ngcontent-%COMP%]   td[_ngcontent-%COMP%] {
      background: #1c1917;
    }
    .actions[_ngcontent-%COMP%] {
      white-space: nowrap;
    }
    .param[_ngcontent-%COMP%] {
      width: 80px;
      margin-right: 4px;
    }`]})},WE=(e,t)=>t.id,GE=(e,t)=>t.pageId;function KE(e,t){e&1&&(H(0,`p`,0),X(1,`Could not load the live router state.`),U())}function qE(e,t){e&1&&(H(0,`p`,0),X(1,`Loading the live router state…`),U())}function JE(e,t){if(e&1&&(H(0,`option`,8),X(1),U()),e&2){let e=t.$implicit,n=Y(2);Vh(`value`,e.pageId)(`selected`,e.pageId===n.pageId),I(),n_(` `,e.snapshot?.url??e.pageId,` (`,e.pageId,`) `)}}function YE(e,t){if(e&1){let e=K();H(0,`label`,1),X(1,` Page `),H(2,`select`,7),cg(`change`,function(t){return N(e),P(Y(2).pickPage(t))}),B(3,JE,2,4,`option`,8,GE),U()()}if(e&2){let e=Y(2);I(3),V(e.pages())}}function XE(e,t){if(e&1&&(H(0,`span`,10),X(1),U()),e&2){let e=Y(3);L(`aria-label`,e.problems()+` problem navigations`),I(),Z(e.problems())}}function ZE(e,t){if(e&1){let e=K();H(0,`button`,9),cg(`click`,function(){let t=N(e).$implicit;return P(Y(2).selected.set(t.id))}),X(1),R(2,XE,2,2,`span`,10),U()}if(e&2){let e=t.$implicit,n=Y(2);Vh(`id`,`router-tab-`+e.id),L(`aria-selected`,e.id===n.selected())(`aria-controls`,`router-panel-`+e.id)(`tabindex`,e.id===n.selected()?0:-1),I(),Q(` `,e.label,` `),I(),z(e.id===`navigations`&&n.problems()>0?2:-1)}}function QE(e,t){if(e&1&&Wh(0,`app-route-current`,5),e&2){let e=Y(),t=Y();Vh(`page`,e)(`rpc`,t.rpc())}}function $E(e,t){if(e&1&&Wh(0,`app-route-timeline`,5),e&2){let e=Y(),t=Y();Vh(`page`,e)(`rpc`,t.rpc())}}function eD(e,t){if(e&1&&Wh(0,`app-route-tree`,5),e&2){let e=Y(),t=Y();Vh(`page`,e)(`rpc`,t.rpc())}}function tD(e,t){e&1&&Wh(0,`app-route-setup`,6),e&2&&Vh(`page`,Y())}function nD(e,t){if(e&1&&Wh(0,`app-route-lint`,5),e&2){let e=Y(),t=Y();Vh(`page`,e)(`rpc`,t.rpc())}}function rD(e,t){if(e&1){let e=K();R(0,YE,5,0,`label`,1),H(1,`div`,2),cg(`keydown`,function(t){return N(e),P(Y().onKey(t))}),B(2,ZE,3,6,`button`,3,WE),U(),H(4,`div`,4),R(5,QE,1,2,`app-route-current`,5)(6,$E,1,2,`app-route-timeline`,5)(7,eD,1,2,`app-route-tree`,5)(8,tD,1,1,`app-route-setup`,6)(9,nD,1,2,`app-route-lint`,5),U()}if(e&2){let e,t=Y();z(t.pages().length>1?0:-1),I(2),V(t.tabs),I(2),Vh(`id`,`router-panel-`+t.selected()),L(`aria-labelledby`,`router-tab-`+t.selected()),I(),z((e=t.selected())===`current`?5:e===`navigations`?6:e===`routes`?7:e===`setup`?8:e===`lint`?9:-1)}}function iD(e,t){e&1&&(H(0,`p`,0),X(1,`No page is reporting router state yet. Open the app in a browser.`),U())}var aD=[{id:`current`,label:`Current`},{id:`navigations`,label:`Navigations`},{id:`routes`,label:`Routes`},{id:`setup`,label:`Setup`},{id:`lint`,label:`Lint`}],oD=class e{rpc=k_(null);tabs=aD;selected=F(`current`);pages=F([]);loading=F(!0);failed=F(!1);pageId=C_({source:this.pages,computation:(e,t)=>t?.value&&e.some(e=>e.pageId===t.value)?t.value:e.find(e=>e.snapshot)?.pageId??e[0]?.pageId??null});unsubscribe=null;destroyRef=A(fs);page=$(()=>{let e=this.pages();return e.find(e=>e.pageId===this.pageId())??e[0]??null});problems=$(()=>(this.page()?.navigations??[]).filter(e=>!e.probe&&[`failed`,`cancelled`,`redirected`].includes(e.outcome)).length);constructor(){$s(()=>{let e=this.rpc();e&&this.load(e)}),this.destroyRef.onDestroy(()=>this.unsubscribe?.())}async load(e){this.loading.set(!0),this.failed.set(!1);try{let t=await e.scope(`ng-devtools`).rpc.sharedState(`router`);if(this.destroyRef.destroyed)return;let n=e=>{this.pages.set(e?.pages??[])};n(t.value()),this.unsubscribe?.(),this.unsubscribe=t.on(`updated`,n)}catch{this.failed.set(!0)}finally{this.loading.set(!1)}}pickPage(e){this.pageId.set(e.target.value)}onKey(e){let t=this.tabs.map(e=>e.id),n=t.indexOf(this.selected()),r=n;if(e.key===`ArrowRight`)r=(n+1)%t.length;else if(e.key===`ArrowLeft`)r=(n-1+t.length)%t.length;else if(e.key===`Home`)r=0;else if(e.key===`End`)r=t.length-1;else return;e.preventDefault(),this.selected.set(t[r]);let i=e.currentTarget;queueMicrotask(()=>i.querySelector(`#router-tab-${t[r]}`)?.focus())}static ɵfac=function(t){return new(t||e)};static ɵcmp=nm({type:e,selectors:[[`app-live-route`]],inputs:{rpc:[1,`rpc`]},decls:4,vars:1,consts:[[1,`muted`],[1,`page-pick`],[`role`,`tablist`,`aria-label`,`Router views`,1,`tabs`,3,`keydown`],[`type`,`button`,`role`,`tab`,3,`id`],[`role`,`tabpanel`,1,`panel`,3,`id`],[3,`page`,`rpc`],[3,`page`],[3,`change`],[3,`value`,`selected`],[`type`,`button`,`role`,`tab`,3,`click`,`id`],[1,`count`]],template:function(e,t){if(e&1&&R(0,KE,2,0,`p`,0)(1,qE,2,0,`p`,0)(2,rD,10,4)(3,iD,2,0,`p`,0),e&2){let e;z(t.failed()?0:t.loading()?1:(e=t.page())?2:3,e)}},dependencies:[_T,ST,PT,bE,UE],styles:[`[_nghost-%COMP%] {
      display: grid;
      gap: 12px;
      margin-bottom: 28px;
    }
    .muted[_ngcontent-%COMP%] {
      color: #a1a1aa;
      font-size: 13px;
    }
    .page-pick[_ngcontent-%COMP%] {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      font-size: 13px;
      color: #d4d4d8;
    }
    select[_ngcontent-%COMP%] {
      max-width: 100%;
      min-width: 0;
      padding: 4px 8px;
      background: #18181b;
      border: 1px solid #52525b;
      border-radius: 6px;
      color: #e4e4e7;
    }
    .tabs[_ngcontent-%COMP%] {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      border-bottom: 1px solid #27272a;
    }
    [role='tab'][_ngcontent-%COMP%] {
      padding: 6px 12px;
      background: none;
      border: none;
      border-bottom: 2px solid transparent;
      color: #a1a1aa;
      cursor: pointer;
      font-size: 13px;
    }
    [role='tab'][aria-selected='true'][_ngcontent-%COMP%] {
      color: #e4e4e7;
      border-bottom-color: var(--%NS%accent);
    }
    [role='tab'][_ngcontent-%COMP%]:focus-visible, 
   select[_ngcontent-%COMP%]:focus-visible {
      outline: 2px solid var(--%NS%accent);
      outline-offset: 2px;
    }
    .count[_ngcontent-%COMP%] {
      margin-left: 4px;
      padding: 0 5px;
      border-radius: 8px;
      background: #7f1d1d;
      color: #fecaca;
      font-size: 11px;
    }`]})};function sD(e,t){e&1&&(H(0,`p`,5),X(1,`Scanning routes…`),U())}function cD(e,t){e&1&&(H(0,`p`,5),X(1,`No routes found.`),U())}function lD(e,t){if(e&1&&(H(0,`span`,9),X(1),U()),e&2){let e=Y().$implicit;I(),Q(`➜ `,e.redirectTo)}}function uD(e,t){if(e&1&&X(0),e&2){let e=Y().$implicit;Q(` `,e.component??`—`,` `)}}function dD(e,t){if(e&1&&(H(0,`tr`)(1,`td`,8),X(2),U(),H(3,`td`),R(4,lD,2,1,`span`,9)(5,uD,1,1),U(),H(6,`td`),X(7),U(),H(8,`td`,10),X(9),U(),H(10,`td`),X(11),U()()),e&2){let e=t.$implicit;I(2),Q(`/`,e.path),I(2),z(e.redirectTo===void 0?5:4),I(3),Z(e.title??`—`),I(2),Z(e.file),I(2),Z(e.hasChildren?`Yes`:`—`)}}function fD(e,t){if(e&1&&(H(0,`table`,6)(1,`thead`)(2,`tr`)(3,`th`,7),X(4,`Path`),U(),H(5,`th`,7),X(6,`Component / Target`),U(),H(7,`th`,7),X(8,`Title`),U(),H(9,`th`,7),X(10,`File`),U(),H(11,`th`,7),X(12,`Children`),U()()(),H(13,`tbody`),B(14,dD,12,5,`tr`,null,jh),U()()),e&2){let e=Y();I(14),V(e.filtered())}}var pD=class e{rpc=k_(null);routes=F([]);filter=F(``);loading=F(!1);filtered=$(()=>{let e=this.filter().toLowerCase().trim(),t=this.routes();return e?t.filter(t=>t.path.toLowerCase().includes(e)||t.component&&t.component.toLowerCase().includes(e)||t.redirectTo&&t.redirectTo.toLowerCase().includes(e)||t.title&&t.title.toLowerCase().includes(e)||t.file.toLowerCase().includes(e)):t});constructor(){$s(()=>{this.rpc()&&this.refresh()})}onFilterInput(e){let t=e.target;this.filter.set(t?.value??``)}async refresh(){let e=this.rpc();if(e){this.loading.set(!0);try{let t=await e.scope(`ng-devtools`).rpc.call(`get-routes`);this.routes.set(t)}finally{this.loading.set(!1)}}}static ɵfac=function(t){return new(t||e)};static ɵcmp=nm({type:e,selectors:[[`app-route-inspector`]],inputs:{rpc:[1,`rpc`]},decls:10,vars:3,consts:[[3,`rpc`],[1,`config-heading`],[1,`toolbar`],[`type`,`text`,`aria-label`,`Filter routes`,`placeholder`,`Filter routes…`,3,`input`,`value`],[`type`,`button`,3,`click`],[1,`muted`],[`role`,`table`],[`scope`,`col`],[1,`path`],[1,`redirect`],[1,`file`]],template:function(e,t){e&1&&(Wh(0,`app-live-route`,0),H(1,`h2`,1),X(2,`Route config`),U(),H(3,`div`,2)(4,`input`,3),cg(`input`,function(e){return t.onFilterInput(e)}),U(),H(5,`button`,4),cg(`click`,function(){return t.refresh()}),X(6,`Refresh`),U()(),R(7,sD,2,0,`p`,5)(8,cD,2,0,`p`,5)(9,fD,16,0,`table`,6)),e&2&&(Vh(`rpc`,t.rpc()),I(4),Vh(`value`,t.filter()),I(3),z(t.loading()?7:t.filtered().length===0?8:9))},dependencies:[oD],styles:[`.config-heading[_ngcontent-%COMP%] {
      margin: 0 0 8px;
      font-size: 15px;
      color: #e4e4e7;
    }
    .toolbar[_ngcontent-%COMP%] {
      display: flex;
      gap: 8px;
      margin-bottom: 16px;
    }
    input[_ngcontent-%COMP%] {
      flex: 1;
      padding: 8px 12px;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 6px;
      color: #e4e4e7;
      font-size: 14px;
      outline: none;
    }
    input[_ngcontent-%COMP%]:focus {
      border-color: var(--%NS%accent);
    }
    button[_ngcontent-%COMP%] {
      padding: 8px 16px;
      background: #3f3f46;
      border: none;
      border-radius: 6px;
      color: #e4e4e7;
      cursor: pointer;
      font-size: 13px;
    }
    button[_ngcontent-%COMP%]:hover {
      background: #52525b;
    }
    .muted[_ngcontent-%COMP%] {
      color: #a1a1aa;
      font-size: 14px;
    }
    table[_ngcontent-%COMP%] {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    thead[_ngcontent-%COMP%] {
      position: sticky;
      top: 0;
    }
    th[_ngcontent-%COMP%] {
      text-align: left;
      padding: 8px 12px;
      background: #18181b;
      color: #a1a1aa;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid #27272a;
    }
    td[_ngcontent-%COMP%] {
      padding: 10px 12px;
      border-bottom: 1px solid #1e1e22;
    }
    tr[_ngcontent-%COMP%]:hover   td[_ngcontent-%COMP%] {
      background: #18181b;
    }
    .path[_ngcontent-%COMP%] {
      font-family: monospace;
      color: var(--%NS%accent);
      font-weight: 500;
    }
    .redirect[_ngcontent-%COMP%] {
      font-family: monospace;
      color: #38bdf8;
    }
    .file[_ngcontent-%COMP%] {
      font-size: 12px;
      color: #a1a1aa;
    }`]})},mD=(e,t)=>t.name+t.file+t.line,hD=(e,t)=>t.kind,gD=(e,t)=>t.id,_D=(e,t)=>t.epoch;function vD(e,t){e&1&&(W(0,`div`,3)(1,`p`,4),X(2,`No signals found.`),G(),W(3,`p`,5),X(4,` No signal(), computed(), effect() calls found in source. Runtime graph requires Angular 19+ with the overlay connected. `),G()())}function yD(e,t){if(e&1&&X(0),e&2){let e=Y().$implicit;Q(` · in <`,e.component,`> `)}}function bD(e,t){if(e&1&&(W(0,`div`,8)(1,`div`,9)(2,`span`,10),X(3),G(),W(4,`span`,11),X(5),G()(),W(6,`div`,12),X(7),R(8,yD,1,1),G()()),e&2){let e=t.$implicit,n=Y(2);I(2),Ag(`background`,n.kindColor(e.kind)),I(),Z(e.kind),I(2),Z(e.name),I(2),n_(` `,e.file,`:`,e.line,` `),I(),z(e.component?8:-1)}}function xD(e,t){if(e&1&&(W(0,`p`,6),X(1,`Signals from source scan (static analysis):`),G(),W(2,`div`,7),B(3,bD,9,7,`div`,8,mD),G()),e&2){let e=Y();I(3),V(e.filteredSourceSignals())}}function SD(e,t){if(e&1&&(W(0,`span`,14),Gh(1,`span`,16),X(2),G()),e&2){let e=t.$implicit;I(),Ag(`background`,e.color),I(),Q(` `,e.kind,` `)}}function CD(e,t){e&1&&(W(0,`span`,18),X(1,`watching`),G())}function wD(e,t){if(e&1&&(W(0,`span`,19),X(1),G()),e&2){let e=t;I(),n_(``,e,` `,e===1?`change`:`changes`)}}function TD(e,t){if(e&1&&(W(0,`span`,20),X(1),u_(2,`json`),G()),e&2){let e=Y().$implicit;I(),Z(f_(2,1,e.value))}}function ED(e,t){if(e&1&&X(0),e&2){let e=Y().$implicit;Q(` · Deps: `,Y(2).getDependencies(e).length,` `)}}function DD(e,t){if(e&1&&X(0),e&2){let e=Y().$implicit;Q(` · Consumers: `,Y(2).getConsumers(e).length,` `)}}function OD(e,t){if(e&1&&(W(0,`dt`),X(1,`Value`),G(),W(2,`dd`)(3,`pre`),X(4),u_(5,`json`),G()()),e&2){let e=Y(4);I(4),Z(f_(5,1,e.selectedNode().value))}}function kD(e,t){if(e&1&&(W(0,`li`)(1,`span`,22),X(2),G(),X(3),G()),e&2){let e=t.$implicit,n=Y(5);I(),Ag(`background`,n.kindColor(e.kind)),I(),Z(e.kind),I(),Q(` `,e.label??e.id,` `)}}function AD(e,t){if(e&1&&(W(0,`h4`),X(1,`Dependencies (producers)`),G(),W(2,`ul`),B(3,kD,4,4,`li`,null,gD),G()),e&2){let e=Y(4);I(3),V(e.getDependencies(e.selectedNode()))}}function jD(e,t){if(e&1&&(W(0,`li`)(1,`span`,22),X(2),G(),X(3),G()),e&2){let e=t.$implicit,n=Y(5);I(),Ag(`background`,n.kindColor(e.kind)),I(),Z(e.kind),I(),Q(` `,e.label??e.id,` `)}}function MD(e,t){if(e&1&&(W(0,`h4`),X(1,`Consumers`),G(),W(2,`ul`),B(3,jD,4,4,`li`,null,gD),G()),e&2){let e=Y(4);I(3),V(e.getConsumers(e.selectedNode()))}}function ND(e,t){if(e&1&&(W(0,`span`,28),X(1),G()),e&2){let e=Y().$implicit;I(),Q(``,e.missed,` earlier not captured`)}}function PD(e,t){if(e&1&&(W(0,`li`)(1,`span`,26)(2,`time`),X(3),u_(4,`date`),G(),W(5,`span`,27),X(6),G(),W(7,`span`),X(8),G(),R(9,ND,2,1,`span`,28),G(),W(10,`pre`),X(11),u_(12,`json`),G()()),e&2){let e=t.$implicit,n=Y(5);I(3),Z(p_(4,7,e.at,`HH:mm:ss.SSS`)),I(2),Mg(`source-`+e.source),I(),Z(n.sourceLabel(e.source)),I(2),Q(`epoch `,e.epoch),I(),z(e.missed?9:-1),I(2),Z(f_(12,10,e.value))}}function FD(e,t){if(e&1&&(W(0,`h4`,23),X(1,`Value history`),G(),W(2,`p`,24),X(3),G(),W(4,`ol`,25),B(5,PD,13,12,`li`,null,_D),G()),e&2){let e=Y(4);I(3),Q(` `,e.changeCount(e.selectedNode().id),` changes recorded, newest first. `),I(2),V(e.selectedHistory())}}function ID(e,t){if(e&1&&(W(0,`div`,21)(1,`h3`),X(2),G(),W(3,`dl`)(4,`dt`),X(5,`Kind`),G(),W(6,`dd`),X(7),G(),W(8,`dt`),X(9,`Epoch`),G(),W(10,`dd`),X(11),G(),R(12,OD,6,3),G(),R(13,AD,5,0),R(14,MD,5,0),R(15,FD,7,1),G()),e&2){let e=Y().$implicit,t=Y(2);q(`id`,`signal-detail-`+e.id),I(2),Z(t.selectedNode().label??t.selectedNode().id),I(5),Z(t.selectedNode().kind),I(4),Z(t.selectedNode().epoch),I(),z(t.selectedNode().value===void 0?-1:12),I(),z(t.getDependencies(t.selectedNode()).length?13:-1),I(),z(t.getConsumers(t.selectedNode()).length?14:-1),I(),z(t.selectedHistory().length?15:-1)}}function LD(e,t){if(e&1){let e=K();W(0,`li`)(1,`button`,17),J(`click`,function(){let t=N(e).$implicit;return P(Y(2).selectNode(t))}),W(2,`span`,9)(3,`span`,10),X(4),G(),W(5,`span`,11),X(6),G(),R(7,CD,2,0,`span`,18),R(8,wD,2,2,`span`,19),G(),R(9,TD,3,3,`span`,20),W(10,`span`,12),X(11),R(12,ED,1,1),R(13,DD,1,1),G()(),R(14,ID,16,8,`div`,21),G()}if(e&2){let e,n=t.$implicit,r=Y(2);I(),jg(`selected`,r.selectedId()===n.id),L(`aria-expanded`,r.selectedId()===n.id)(`aria-controls`,`signal-detail-`+n.id),I(2),Ag(`background`,r.kindColor(n.kind)),I(),Z(n.kind),I(2),Z(n.label??`(unnamed)`),I(),z(n.watched?7:-1),I(),z((e=r.changeCount(n.id))?8:-1,e),I(),z(n.value===void 0?-1:9),I(2),Q(` Epoch: `,n.epoch,` `),I(),z(r.getDependencies(n).length?12:-1),I(),z(r.getConsumers(n).length?13:-1),I(),z(r.selectedId()===n.id&&r.selectedNode()?14:-1)}}function RD(e,t){if(e&1&&(W(0,`div`,13),B(1,SD,3,3,`span`,14,hD),G(),W(3,`ul`,15),B(4,LD,15,15,`li`,null,gD),G()),e&2){let e=Y();I(),V(e.kindLegend),I(3),V(e.filteredNodes())}}var zD={write:`set`,sample:`sampled`,initial:`initial`},BD={signal:`#a78bfa`,computed:`#60a5fa`,linkedSignal:`#34d399`,effect:`#fb923c`,template:`#94a3b8`,afterRenderEffectPhase:`#f472b6`,childSignalProp:`#c084fc`,"input (signal)":`#f59e0b`,"input.required (signal)":`#f59e0b`,"output (signal)":`#ec4899`,"model (signal)":`#14b8a6`,"model.required (signal)":`#14b8a6`,"viewChild (signal)":`#8b5cf6`,"viewChild.required (signal)":`#8b5cf6`,"viewChildren (signal)":`#8b5cf6`,"contentChild (signal)":`#6366f1`,"contentChild.required (signal)":`#6366f1`,"contentChildren (signal)":`#6366f1`,resource:`#06b6d4`,unknown:`#71717a`},VD=class e{rpc=k_(null);graph=F(null);sourceSignals=F([]);filter=F(``);selectedId=F(null);selectedNode=$(()=>this.graph()?.nodes.find(e=>e.id===this.selectedId())??null);selectedHistory=$(()=>{let e=this.selectedId();return e?[...this.graph()?.history?.[e]??[]].reverse():[]});kindLegend=Object.entries(BD).map(([e,t])=>({kind:e,color:t}));filteredNodes=$(()=>{let e=this.graph();if(!e)return[];let t=this.filter().toLowerCase();return(t?e.nodes.filter(e=>(e.label??``).toLowerCase().includes(t)||e.kind.includes(t)):[...e.nodes]).sort((e,t)=>e.id.localeCompare(t.id,void 0,{numeric:!0}))});filteredSourceSignals=$(()=>{let e=this.filter().toLowerCase(),t=this.sourceSignals();return e?t.filter(t=>t.name.toLowerCase().includes(e)||t.kind.includes(e)||t.file.includes(e)):t});constructor(){$s(()=>{let e=this.rpc();e&&(this.loadSignalGraph(e),this.loadSourceSignals(e))})}async loadSignalGraph(e){let t=await e.scope(`ng-devtools`).rpc.sharedState(`signal-graph`),n=new URLSearchParams(location.search).get(`pageId`),r=e=>n&&e?.pages?.[n]||e?.graph,i=r(t.value());i&&this.graph.set(i),t.on(`updated`,e=>{let t=r(e);t&&this.graph.set(t)})}async loadSourceSignals(e){let t=e.scope(`ng-devtools`);try{let e=await t.rpc.call(`get-signals`);this.sourceSignals.set(e)}catch{}}selectNode(e){this.selectedId.set(this.selectedId()===e.id?null:e.id)}changeCount(e){return(this.graph()?.history?.[e]??[]).reduce((e,t)=>e+(t.source===`initial`?0:1+(t.missed??0)),0)}sourceLabel(e){return zD[e]}kindColor(e){return BD[e]??BD.unknown}getDependencies(e){let t=this.graph();if(!t)return[];let n=t.nodes.findIndex(t=>t.id===e.id);return t.edges.filter(e=>e.consumer===n).map(e=>t.nodes[e.producer]).filter(Boolean)}getConsumers(e){let t=this.graph();if(!t)return[];let n=t.nodes.findIndex(t=>t.id===e.id);return t.edges.filter(e=>e.producer===n).map(e=>t.nodes[e.consumer]).filter(Boolean)}static ɵfac=function(t){return new(t||e)};static ɵcmp=nm({type:e,selectors:[[`app-signal-inspector`]],inputs:{rpc:[1,`rpc`]},decls:7,vars:5,consts:[[1,`toolbar`],[`type`,`text`,`placeholder`,`Filter by name or kind…`,3,`input`,`value`],[1,`label`],[1,`empty`],[1,`muted`],[1,`hint`],[1,`source-label`],[1,`nodes`],[1,`node-card`],[1,`node-header`],[1,`kind-badge`],[1,`node-label`],[1,`node-meta`],[1,`legend`],[1,`legend-item`],[`role`,`list`,1,`nodes`],[1,`dot`],[`type`,`button`,1,`node-card`,3,`click`],[1,`watched-badge`],[1,`changed-badge`],[1,`node-value`],[1,`detail-panel`,3,`id`],[1,`kind-badge`,`sm`],[`id`,`value-history-heading`],[`aria-live`,`polite`,1,`history-summary`],[`aria-labelledby`,`value-history-heading`,1,`history`],[1,`history-meta`],[1,`source-tag`],[1,`missed`]],template:function(e,t){e&1&&(W(0,`div`,0)(1,`input`,1),J(`input`,function(e){return t.filter.set(e.target.value)}),G(),W(2,`span`,2),X(3),G()(),R(4,vD,5,0,`div`,3),R(5,xD,5,0),R(6,RD,6,0)),e&2&&(I(),q(`value`,t.filter()),I(2),Q(`Component: `,t.graph()?.componentSelector??`—`),I(),z(!t.graph()&&t.sourceSignals().length===0?4:-1),I(),z(!t.graph()&&t.sourceSignals().length>0?5:-1),I(),z(t.graph()?6:-1))},dependencies:[Uv,Wv],styles:[`.toolbar[_ngcontent-%COMP%] {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-bottom: 16px;
    }
    input[_ngcontent-%COMP%] {
      flex: 1;
      padding: 8px 12px;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 6px;
      color: #e4e4e7;
      font-size: 14px;
      outline: none;
    }
    input[_ngcontent-%COMP%]:focus {
      border-color: var(--%NS%accent);
    }
    .label[_ngcontent-%COMP%] {
      font-size: 13px;
      color: #71717a;
      white-space: nowrap;
    }
    .empty[_ngcontent-%COMP%] {
      text-align: center;
      padding: 48px 16px;
    }
    .muted[_ngcontent-%COMP%] {
      color: #71717a;
      font-size: 14px;
    }
    .hint[_ngcontent-%COMP%] {
      color: #52525b;
      font-size: 12px;
      margin-top: 8px;
    }
    .source-label[_ngcontent-%COMP%] {
      font-size: 13px;
      color: #71717a;
      margin-bottom: 12px;
    }
    .legend[_ngcontent-%COMP%] {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }
    .legend-item[_ngcontent-%COMP%] {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #a1a1aa;
    }
    .dot[_ngcontent-%COMP%] {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .nodes[_ngcontent-%COMP%] {
      display: flex;
      flex-direction: column;
      gap: 8px;
      list-style: none;
      padding: 0;
      margin: 0;
    }
    .node-card[_ngcontent-%COMP%] {
      display: block;
      width: 100%;
      text-align: left;
      font: inherit;
      color: inherit;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 8px;
      padding: 12px 16px;
      cursor: pointer;
      transition: border-color 0.15s;
    }
    .node-card[_ngcontent-%COMP%]:hover {
      border-color: #3f3f46;
    }
    .node-card[_ngcontent-%COMP%]:focus-visible {
      outline: 2px solid var(--%NS%accent);
      outline-offset: 2px;
    }
    .node-value[_ngcontent-%COMP%], 
   .node-meta[_ngcontent-%COMP%] {
      display: block;
    }
    .changed-badge[_ngcontent-%COMP%] {
      font-size: 10px;
      padding: 1px 6px;
      border-radius: 4px;
      background: #422006;
      color: #fbbf24;
    }
    .history-summary[_ngcontent-%COMP%] {
      font-size: 12px;
      color: #a1a1aa;
      margin: 0 0 6px;
    }
    .history[_ngcontent-%COMP%] {
      list-style: none;
      padding: 0;
      margin: 0;
      max-height: 320px;
      overflow: auto;
    }
    .history[_ngcontent-%COMP%]   li[_ngcontent-%COMP%] {
      display: block;
      padding: 6px 0;
      border-top: 1px solid #27272a;
    }
    .history-meta[_ngcontent-%COMP%] {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      font-size: 11px;
      color: #a1a1aa;
      margin-bottom: 2px;
    }
    .source-tag[_ngcontent-%COMP%] {
      padding: 0 5px;
      border-radius: 3px;
      background: #27272a;
      color: #e4e4e7;
    }
    .source-write[_ngcontent-%COMP%] {
      background: #1e3a8a;
      color: #dbeafe;
    }
    .missed[_ngcontent-%COMP%] {
      color: #fbbf24;
    }
    .node-card.selected[_ngcontent-%COMP%] {
      border-color: var(--%NS%accent);
    }
    .node-header[_ngcontent-%COMP%] {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .kind-badge[_ngcontent-%COMP%] {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 4px;
      color: #fff;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .kind-badge.sm[_ngcontent-%COMP%] {
      font-size: 10px;
      padding: 1px 5px;
    }
    .node-label[_ngcontent-%COMP%] {
      font-family: monospace;
      font-size: 14px;
      color: #e4e4e7;
    }
    .watched-badge[_ngcontent-%COMP%] {
      font-size: 10px;
      padding: 1px 6px;
      border-radius: 4px;
      background: #14532d;
      color: #4ade80;
    }
    .node-value[_ngcontent-%COMP%] {
      font-family: monospace;
      font-size: 12px;
      color: #a1a1aa;
      margin-top: 4px;
      max-height: 40px;
      overflow: hidden;
    }
    .node-meta[_ngcontent-%COMP%] {
      font-size: 11px;
      color: #52525b;
      margin-top: 4px;
    }
    .detail-panel[_ngcontent-%COMP%] {
      margin-top: 16px;
      padding: 16px;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 8px;
    }
    .detail-panel[_ngcontent-%COMP%]   h3[_ngcontent-%COMP%] {
      font-family: monospace;
      color: var(--%NS%accent);
      margin-bottom: 12px;
    }
    .detail-panel[_ngcontent-%COMP%]   h4[_ngcontent-%COMP%] {
      font-size: 12px;
      color: #71717a;
      margin: 12px 0 4px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    dl[_ngcontent-%COMP%] {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 4px 12px;
      font-size: 13px;
    }
    dt[_ngcontent-%COMP%] {
      color: #71717a;
    }
    dd[_ngcontent-%COMP%] {
      color: #e4e4e7;
    }
    pre[_ngcontent-%COMP%] {
      font-size: 12px;
      white-space: pre-wrap;
      margin: 0;
    }
    ul[_ngcontent-%COMP%] {
      list-style: none;
      padding: 0;
      font-size: 13px;
    }
    li[_ngcontent-%COMP%] {
      padding: 2px 0;
      color: #a1a1aa;
      display: flex;
      align-items: center;
      gap: 6px;
    }`]})},HD=(e,t)=>t.type,UD=(e,t)=>t.token+t.file+t.line,WD=(e,t)=>t.injector.id,GD=(e,t)=>t.node.injector.id,KD=(e,t)=>t.token;function qD(e,t){e&1&&(W(0,`div`,4)(1,`p`,5),X(2,`No DI data found.`),G(),W(3,`p`,6),X(4,` No providers, injectables, or inject() calls found. Runtime tree requires Angular 17+ with the overlay connected. `),G()())}function JD(e,t){if(e&1&&(W(0,`span`,14),X(1),G()),e&2){let e=Y().$implicit;I(),Q(`providedIn: `,e.providedIn)}}function YD(e,t){if(e&1&&X(0),e&2){let e=Y().$implicit;Q(` · as `,e.source,` `)}}function XD(e,t){if(e&1&&(W(0,`div`,11)(1,`div`,12)(2,`span`,13),X(3),G(),R(4,JD,2,1,`span`,14),G(),W(5,`div`,15),X(6),R(7,YD,1,1),G()()),e&2){let e=t.$implicit;I(3),Z(e.token),I(),z(e.providedIn?4:-1),I(2),n_(` `,e.file,`:`,e.line,` `),I(),z(e.source!==`class`&&e.source!==`providers array`?7:-1)}}function ZD(e,t){if(e&1&&(W(0,`div`,9)(1,`h3`),X(2),G(),W(3,`div`,10),B(4,XD,8,5,`div`,11,UD),G()()),e&2){let e=t.$implicit;I(2),n_(``,e.label,` (`,e.items.length,`)`),I(2),V(e.items)}}function QD(e,t){if(e&1&&(W(0,`p`,7),X(1,`DI from source scan (static analysis):`),G(),W(2,`div`,8),B(3,ZD,6,2,`div`,9,HD),G()),e&2){let e=Y();I(3),V(e.groupedProviders())}}function $D(e,t){e&1&&Xh(0)}function eO(e,t){if(e&1&&(W(0,`span`,24),X(1),G()),e&2){let e=Y().$implicit;I(),Q(``,e.node.injector.providerCount,` providers`)}}function tO(e,t){if(e&1){let e=K();W(0,`div`,21),J(`click`,function(){let t=N(e).$implicit;return P(Y(4).select(t.node))}),W(1,`span`,22),X(2),G(),W(3,`span`,23),X(4),G(),R(5,eO,2,1,`span`,24),G()}if(e&2){let e=t.$implicit,n=Y(4);Ag(`padding-left`,e.depth*24+12,`px`),jg(`selected`,n.selectedId()===e.node.injector.id),I(),Ag(`background`,n.typeColor(e.node.injector.type)),I(),Q(` `,e.node.injector.type,` `),I(2),Z(e.node.injector.name),I(),z(e.node.injector.providerCount>0?5:-1)}}function nO(e,t){if(e&1&&(W(0,`div`,19),B(1,tO,6,9,`div`,20,GD),G()),e&2){let e=Y().$implicit,t=Y(2);I(),V(t.flattenTree(e))}}function rO(e,t){e&1&&(hm(0,$D,1,0,`ng-container`,18)(1,nO,3,0),bh(2,1),xh()),e&2&&q(`ngTemplateOutlet`,void 0)}function iO(e,t){e&1&&(W(0,`p`,5),X(1,`No providers configured on this injector.`),G())}function aO(e,t){if(e&1&&(W(0,`tr`)(1,`td`,13),X(2),G(),W(3,`td`),X(4),G(),W(5,`td`),X(6),G()()),e&2){let e=t.$implicit;I(2),Z(e.token),I(2),Z(e.type),I(2),Z(e.isViewProvider?`Yes`:`—`)}}function oO(e,t){if(e&1&&(W(0,`table`,26)(1,`thead`)(2,`tr`)(3,`th`),X(4,`Token`),G(),W(5,`th`),X(6,`Type`),G(),W(7,`th`),X(8,`View`),G()()(),W(9,`tbody`),B(10,aO,7,3,`tr`,null,KD),G()()),e&2){let e=Y(3);I(10),V(e.selectedInjector().providers)}}function sO(e,t){if(e&1&&(W(0,`aside`,17)(1,`div`,25)(2,`span`,22),X(3),G(),W(4,`h3`),X(5),G()(),R(6,iO,2,0,`p`,5)(7,oO,12,0,`table`,26),G()),e&2){let e=Y(2);I(2),Ag(`background`,e.typeColor(e.selectedInjector().injector.type)),I(),Q(` `,e.selectedInjector().injector.type,` `),I(2),Z(e.selectedInjector().injector.name),I(),z(e.selectedInjector().providers.length===0?6:7)}}function cO(e,t){if(e&1&&(W(0,`div`,16),B(1,rO,4,1,null,null,WD),G(),R(3,sO,8,5,`aside`,17)),e&2){let e=Y();I(),V(e.filteredRoots()),I(2),z(e.selectedInjector()?3:-1)}}var lO={element:`#60a5fa`,environment:`#34d399`,null:`#71717a`},uO=class e{rpc=k_(null);roots=F([]);sourceProviders=F([]);filter=F(``);hideEmpty=F(!1);selectedId=F(null);selectedInjector=$(()=>{let e=this.selectedId();return e?this.findNode(this.roots(),e):null});filteredRoots=$(()=>{let e=this.roots();this.hideEmpty()&&(e=this.filterEmpty(e));let t=this.filter().toLowerCase();return t&&(e=this.filterByQuery(e,t)),e});groupedProviders=$(()=>{let e=this.sourceProviders(),t=this.filter().toLowerCase(),n=t?e.filter(e=>e.token.toLowerCase().includes(t)||e.file.includes(t)):e,r=[{type:`root-provider`,label:`Root Providers (provide*)`,items:[]},{type:`injectable`,label:`Injectable Services`,items:[]},{type:`injection`,label:`inject() Calls`,items:[]},{type:`provider`,label:`Component Providers`,items:[]}];for(let e of n){let t=r.find(t=>t.type===e.type);t&&t.items.push(e)}return r.filter(e=>e.items.length>0)});constructor(){$s(()=>{let e=this.rpc();e&&(this.loadInjectorTree(e),this.loadSourceProviders(e))})}async loadInjectorTree(e){let t=await e.scope(`ng-devtools`).rpc.sharedState(`injector-tree`),n=t.value();n?.roots?.length&&this.roots.set(n.roots),t.on(`updated`,e=>{e?.roots&&this.roots.set(e.roots)})}async loadSourceProviders(e){let t=e.scope(`ng-devtools`);try{let e=await t.rpc.call(`get-providers`);this.sourceProviders.set(e)}catch{}}select(e){this.selectedId.set(this.selectedId()===e.injector.id?null:e.injector.id)}typeColor(e){return lO[e]??lO.null}flattenTree(e){let t=[],n=(e,r)=>{t.push({node:e,depth:r});for(let t of e.children)n(t,r+1)};return n(e,0),t}findNode(e,t){for(let n of e){if(n.injector.id===t)return n;let e=this.findNode(n.children,t);if(e)return e}return null}filterEmpty(e){return e.map(e=>({...e,children:this.filterEmpty(e.children)})).filter(e=>e.injector.providerCount>0||e.children.length>0)}filterByQuery(e,t){return e.map(e=>({...e,children:this.filterByQuery(e.children,t)})).filter(e=>e.injector.name.toLowerCase().includes(t)||e.providers.some(e=>e.token.toLowerCase().includes(t))||e.children.length>0)}static ɵfac=function(t){return new(t||e)};static ɵcmp=nm({type:e,selectors:[[`app-di-inspector`]],inputs:{rpc:[1,`rpc`]},decls:8,vars:5,consts:[[1,`toolbar`],[`type`,`text`,`placeholder`,`Filter by injector name or token…`,3,`input`,`value`],[1,`checkbox`],[`type`,`checkbox`,3,`change`,`checked`],[1,`empty`],[1,`muted`],[1,`hint`],[1,`source-label`],[1,`source-providers`],[1,`provider-group`],[1,`provider-list`],[1,`provider-card`],[1,`provider-header`],[1,`token`],[1,`provided-in`],[1,`provider-meta`],[1,`tree-container`],[1,`detail-panel`],[4,`ngTemplateOutlet`],[1,`injector-tree`],[1,`injector-row`,3,`selected`,`paddingLeft`],[1,`injector-row`,3,`click`],[1,`type-badge`],[1,`name`],[1,`provider-count`],[1,`detail-header`],[`role`,`table`]],template:function(e,t){e&1&&(W(0,`div`,0)(1,`input`,1),J(`input`,function(e){return t.filter.set(e.target.value)}),G(),W(2,`label`,2)(3,`input`,3),J(`change`,function(){return t.hideEmpty.set(!t.hideEmpty())}),G(),X(4,` Hide empty injectors `),G()(),R(5,qD,5,0,`div`,4),R(6,QD,5,0),R(7,cO,4,1)),e&2&&(I(),q(`value`,t.filter()),I(2),q(`checked`,t.hideEmpty()),I(2),z(t.roots().length===0&&t.sourceProviders().length===0?5:-1),I(),z(t.roots().length===0&&t.sourceProviders().length>0?6:-1),I(),z(t.roots().length>0?7:-1))},styles:[`.toolbar[_ngcontent-%COMP%] {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-bottom: 16px;
    }
    input[type='text'][_ngcontent-%COMP%] {
      flex: 1;
      padding: 8px 12px;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 6px;
      color: #e4e4e7;
      font-size: 14px;
      outline: none;
    }
    input[type='text'][_ngcontent-%COMP%]:focus {
      border-color: var(--%NS%accent);
    }
    .checkbox[_ngcontent-%COMP%] {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 13px;
      color: #a1a1aa;
      white-space: nowrap;
      cursor: pointer;
    }
    .empty[_ngcontent-%COMP%] {
      text-align: center;
      padding: 48px 16px;
    }
    .muted[_ngcontent-%COMP%] {
      color: #71717a;
      font-size: 14px;
    }
    .hint[_ngcontent-%COMP%] {
      color: #52525b;
      font-size: 12px;
      margin-top: 8px;
    }
    .tree-container[_ngcontent-%COMP%] {
      display: flex;
      flex-direction: column;
    }
    .injector-row[_ngcontent-%COMP%] {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      cursor: pointer;
      border-bottom: 1px solid #1e1e22;
      transition: background 0.1s;
    }
    .injector-row[_ngcontent-%COMP%]:hover {
      background: #18181b;
    }
    .injector-row.selected[_ngcontent-%COMP%] {
      background: color-mix(in srgb, var(--%NS%accent) 22%, transparent);
      border-color: var(--%NS%accent);
    }
    .type-badge[_ngcontent-%COMP%] {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 4px;
      color: #fff;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .name[_ngcontent-%COMP%] {
      font-family: monospace;
      font-size: 13px;
      color: #e4e4e7;
    }
    .provider-count[_ngcontent-%COMP%] {
      font-size: 11px;
      color: #71717a;
      margin-left: auto;
    }
    .detail-panel[_ngcontent-%COMP%] {
      margin-top: 16px;
      padding: 16px;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 8px;
    }
    .detail-header[_ngcontent-%COMP%] {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }
    .detail-header[_ngcontent-%COMP%]   h3[_ngcontent-%COMP%] {
      font-family: monospace;
      color: #e4e4e7;
      margin: 0;
    }
    table[_ngcontent-%COMP%] {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th[_ngcontent-%COMP%] {
      text-align: left;
      padding: 6px 10px;
      background: #0f0f11;
      color: #71717a;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      border-bottom: 1px solid #27272a;
    }
    td[_ngcontent-%COMP%] {
      padding: 8px 10px;
      border-bottom: 1px solid #1e1e22;
    }
    .token[_ngcontent-%COMP%] {
      font-family: monospace;
      color: var(--%NS%accent);
    }
    .source-label[_ngcontent-%COMP%] {
      font-size: 13px;
      color: #71717a;
      margin-bottom: 12px;
    }
    .source-providers[_ngcontent-%COMP%] {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .provider-group[_ngcontent-%COMP%]   h3[_ngcontent-%COMP%] {
      font-size: 13px;
      color: #71717a;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 8px;
    }
    .provider-list[_ngcontent-%COMP%] {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .provider-card[_ngcontent-%COMP%] {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 8px;
      padding: 10px 14px;
    }
    .provider-header[_ngcontent-%COMP%] {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .provider-header[_ngcontent-%COMP%]   .token[_ngcontent-%COMP%] {
      font-size: 14px;
      font-weight: 500;
    }
    .provided-in[_ngcontent-%COMP%] {
      font-size: 11px;
      padding: 1px 6px;
      border-radius: 4px;
      background: #14532d;
      color: #4ade80;
    }
    .provider-meta[_ngcontent-%COMP%] {
      font-size: 11px;
      color: #52525b;
      margin-top: 4px;
    }`]})},dO=(e,t)=>t.kind,fO=(e,t)=>t.name+t.file+t.line;function pO(e,t){e&1&&Gh(0,`span`,4)}function mO(e,t){e&1&&(W(0,`div`,5)(1,`p`,6),X(2,`No NgRx store patterns found.`),G(),W(3,`p`,7),X(4,` No createAction, createReducer, createEffect, createSelector, or createFeature calls found in source. Make sure your app uses @ngrx/store. `),G()())}function hO(e,t){if(e&1&&(W(0,`span`,9),Gh(1,`span`,14),X(2),G()),e&2){let e=t.$implicit;I(),Ag(`background`,e.color),I(),Q(` `,e.kind,` `)}}function gO(e,t){if(e&1&&(W(0,`span`,15),X(1),G()),e&2){let e=t.$implicit;Ag(`border-color`,Y(3).kindColor(e.kind)),I(),r_(` `,e.count,` `,e.kind,``,e.count===1?``:`s`,` `)}}function _O(e,t){if(e&1&&X(0),e&2){let e=Y().$implicit;Q(` · `,e.detail,` `)}}function vO(e,t){if(e&1&&(W(0,`div`,13)(1,`div`,16)(2,`span`,17),X(3),G(),W(4,`span`,18),X(5),G()(),W(6,`div`,19),X(7),R(8,_O,1,1),G()()),e&2){let e=t.$implicit,n=Y(3);I(2),Ag(`background`,n.kindColor(e.kind)),I(),Q(` `,e.kind,` `),I(2),Z(e.name),I(2),n_(` `,e.file,`:`,e.line,` `),I(),z(e.detail?8:-1)}}function yO(e,t){if(e&1&&(W(0,`div`,8),B(1,hO,3,3,`span`,9,dO),G(),W(3,`div`,10),B(4,gO,2,5,`span`,11,dO),G(),W(6,`div`,12),B(7,vO,9,7,`div`,13,fO),G()),e&2){let e=Y(2);I(),V(e.kindLegend),I(3),V(e.groupedEntries()),I(3),V(e.filteredEntries())}}function bO(e,t){e&1&&R(0,mO,5,0,`div`,5)(1,yO,9,0),e&2&&z(Y().sourceEntries().length===0?0:1)}function xO(e,t){e&1&&(W(0,`div`,5)(1,`p`,6),X(2,`No NgRx store connection detected.`),G(),W(3,`p`,7),X(4,` Runtime inspection requires @ngrx/store-devtools to be configured in your app. The store devtools use the Redux DevTools protocol to expose state. `),G()())}function SO(e,t){if(e&1){let e=K();W(0,`div`,28),J(`click`,function(){let t=N(e).$implicit;return P(Y(3).selectedAction.set(t))}),W(1,`div`,29),X(2),G(),W(3,`div`,30),X(4),G()()}if(e&2){let e=t.$implicit,n=Y(3);jg(`selected`,n.selectedAction()===e),I(2),Z(e.type),I(2),Z(n.formatTime(e.timestamp))}}function CO(e,t){e&1&&(W(0,`p`,6),X(1,`No actions dispatched yet.`),G())}function wO(e,t){if(e&1&&(W(0,`dt`),X(1,`Payload`),G(),W(2,`dd`)(3,`pre`),X(4),u_(5,`json`),G()()),e&2){let e=Y(4);I(4),Z(f_(5,1,e.selectedAction().payload))}}function TO(e,t){if(e&1&&(W(0,`aside`,27)(1,`h3`),X(2),G(),W(3,`dl`)(4,`dt`),X(5,`Type`),G(),W(6,`dd`),X(7),G(),W(8,`dt`),X(9,`Time`),G(),W(10,`dd`),X(11),G(),R(12,wO,6,3),G()()),e&2){let e=Y(3);I(2),Z(e.selectedAction().type),I(5),Z(e.selectedAction().type),I(4),Z(e.formatTime(e.selectedAction().timestamp)),I(),z(e.selectedAction().payload===void 0?-1:12)}}function EO(e,t){if(e&1&&(W(0,`div`,20)(1,`section`,21)(2,`h3`),X(3,`Current State`),G(),W(4,`pre`,22),X(5),u_(6,`json`),G()(),W(7,`section`,23)(8,`h3`),X(9,` Recent Actions `),W(10,`span`,24),X(11),G()(),W(12,`div`,25),B(13,SO,5,4,`div`,26,jh,!1,CO,2,0,`p`,6),G()()(),R(16,TO,13,4,`aside`,27)),e&2){let e=Y(2);I(5),Z(f_(6,4,e.runtimeState()?.state)),I(6),Z(e.filteredActions().length),I(2),V(e.filteredActions()),I(3),z(e.selectedAction()?16:-1)}}function DO(e,t){e&1&&R(0,xO,5,0,`div`,5)(1,EO,17,6),e&2&&z(+!!Y().runtimeState()?.connected)}var OO={action:`#f59e0b`,reducer:`#a78bfa`,effect:`#fb923c`,selector:`#60a5fa`,feature:`#34d399`,"store-setup":`#94a3b8`,"signal-store":`#e879f9`,"signal-state":`#22d3ee`,"signal-method":`#fb7185`},kO=class e{rpc=k_(null);filter=F(``);mode=F(`source`);sourceEntries=F([]);runtimeState=F(null);selectedAction=F(null);kindLegend=Object.entries(OO).map(([e,t])=>({kind:e,color:t}));filteredEntries=$(()=>{let e=this.filter().toLowerCase();return this.sourceEntries().filter(t=>t.name.toLowerCase().includes(e)||t.kind.toLowerCase().includes(e))});groupedEntries=$(()=>{let e=this.sourceEntries(),t=new Map;for(let n of e)t.set(n.kind,(t.get(n.kind)??0)+1);return[...t.entries()].map(([e,t])=>({kind:e,count:t}))});filteredActions=$(()=>{let e=this.filter().toLowerCase(),t=[...this.runtimeState()?.actions??[]].reverse();return e?t.filter(t=>t.type.toLowerCase().includes(e)):t});constructor(){$s(()=>{let e=this.rpc();if(!e)return;let t=e.scope(`ng-devtools`);t.rpc.call(`get-ngrx-store`).then(e=>{this.sourceEntries.set(e),e.length===0&&this.mode.set(`runtime`)}).catch(()=>this.sourceEntries.set([])),t.rpc.sharedState(`ngrx-store`).then(e=>{e?.subscribe&&e.subscribe(e=>this.runtimeState.set(e))})})}kindColor(e){return OO[e]??`#71717a`}formatTime(e){return new Date(e).toLocaleTimeString()}static ɵfac=function(t){return new(t||e)};static ɵcmp=nm({type:e,selectors:[[`app-store-inspector`]],inputs:{rpc:[1,`rpc`]},decls:10,vars:8,consts:[[1,`toolbar`],[`type`,`text`,`placeholder`,`Filter by name or kind…`,3,`input`,`value`],[1,`toggle-group`],[3,`click`],[1,`live-dot`],[1,`empty`],[1,`muted`],[1,`hint`],[1,`legend`],[1,`legend-item`],[1,`summary`],[1,`summary-badge`,3,`border-color`],[1,`nodes`],[1,`node-card`],[1,`dot`],[1,`summary-badge`],[1,`node-header`],[1,`kind-badge`],[1,`node-label`],[1,`node-meta`],[1,`runtime-layout`],[1,`state-panel`],[1,`state-tree`],[1,`actions-panel`],[1,`action-count`],[1,`action-list`],[1,`action-card`,3,`selected`],[1,`detail-panel`],[1,`action-card`,3,`click`],[1,`action-type`],[1,`action-time`]],template:function(e,t){e&1&&(W(0,`div`,0)(1,`input`,1),J(`input`,function(e){return t.filter.set(e.target.value)}),G(),W(2,`div`,2)(3,`button`,3),J(`click`,function(){return t.mode.set(`source`)}),X(4,`Source`),G(),W(5,`button`,3),J(`click`,function(){return t.mode.set(`runtime`)}),X(6,` Runtime `),R(7,pO,1,0,`span`,4),G()()(),R(8,bO,2,1),R(9,DO,2,1)),e&2&&(I(),q(`value`,t.filter()),I(2),jg(`active`,t.mode()===`source`),I(2),jg(`active`,t.mode()===`runtime`),I(2),z(t.runtimeState()?.connected?7:-1),I(),z(t.mode()===`source`?8:-1),I(),z(t.mode()===`runtime`?9:-1))},dependencies:[Wv],styles:[`.toolbar[_ngcontent-%COMP%] {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-bottom: 16px;
    }
    input[_ngcontent-%COMP%] {
      flex: 1;
      padding: 8px 12px;
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 6px;
      color: #e4e4e7;
      font-size: 14px;
      outline: none;
    }
    input[_ngcontent-%COMP%]:focus {
      border-color: var(--%NS%accent);
    }
    .toggle-group[_ngcontent-%COMP%] {
      display: flex;
      border: 1px solid #27272a;
      border-radius: 6px;
      overflow: hidden;
    }
    .toggle-group[_ngcontent-%COMP%]   button[_ngcontent-%COMP%] {
      padding: 6px 14px;
      border: none;
      background: transparent;
      color: #a1a1aa;
      cursor: pointer;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .toggle-group[_ngcontent-%COMP%]   button.active[_ngcontent-%COMP%] {
      background: #3f3f46;
      color: #fff;
    }
    .live-dot[_ngcontent-%COMP%] {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #4ade80;
      animation: _ngcontent-%COMP%_pulse 2s infinite;
    }
    @keyframes _ngcontent-%COMP%_pulse {
      0%,
      100% {
        opacity: 1;
      }
      50% {
        opacity: 0.4;
      }
    }
    .empty[_ngcontent-%COMP%] {
      text-align: center;
      padding: 48px 16px;
    }
    .muted[_ngcontent-%COMP%] {
      color: #71717a;
      font-size: 14px;
    }
    .hint[_ngcontent-%COMP%] {
      color: #52525b;
      font-size: 12px;
      margin-top: 8px;
    }
    .legend[_ngcontent-%COMP%] {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 12px;
    }
    .legend-item[_ngcontent-%COMP%] {
      display: flex;
      align-items: center;
      gap: 4px;
      font-size: 12px;
      color: #a1a1aa;
    }
    .dot[_ngcontent-%COMP%] {
      width: 8px;
      height: 8px;
      border-radius: 50%;
    }
    .summary[_ngcontent-%COMP%] {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }
    .summary-badge[_ngcontent-%COMP%] {
      font-size: 12px;
      padding: 3px 10px;
      border-radius: 99px;
      border: 1px solid;
      color: #e4e4e7;
    }
    .nodes[_ngcontent-%COMP%] {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .node-card[_ngcontent-%COMP%] {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 8px;
      padding: 12px 16px;
      transition: border-color 0.15s;
    }
    .node-card[_ngcontent-%COMP%]:hover {
      border-color: #3f3f46;
    }
    .node-header[_ngcontent-%COMP%] {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .kind-badge[_ngcontent-%COMP%] {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 4px;
      color: #fff;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .node-label[_ngcontent-%COMP%] {
      font-family: monospace;
      font-size: 14px;
      color: #e4e4e7;
    }
    .node-meta[_ngcontent-%COMP%] {
      font-size: 12px;
      color: #71717a;
      margin-top: 4px;
    }
    .runtime-layout[_ngcontent-%COMP%] {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    .state-panel[_ngcontent-%COMP%], 
   .actions-panel[_ngcontent-%COMP%] {
      background: #18181b;
      border: 1px solid #27272a;
      border-radius: 10px;
      padding: 16px;
    }
    h3[_ngcontent-%COMP%] {
      font-size: 13px;
      text-transform: uppercase;
      color: #71717a;
      margin-bottom: 12px;
      letter-spacing: 0.05em;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .action-count[_ngcontent-%COMP%] {
      font-size: 11px;
      padding: 1px 6px;
      border-radius: 99px;
      background: #3f3f46;
      color: #a1a1aa;
    }
    .state-tree[_ngcontent-%COMP%] {
      font-family: monospace;
      font-size: 12px;
      color: #a1a1aa;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 500px;
      overflow: auto;
    }
    .action-list[_ngcontent-%COMP%] {
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-height: 500px;
      overflow: auto;
    }
    .action-card[_ngcontent-%COMP%] {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: #09090b;
      border: 1px solid #27272a;
      border-radius: 6px;
      cursor: pointer;
      transition: border-color 0.15s;
    }
    .action-card[_ngcontent-%COMP%]:hover {
      border-color: #3f3f46;
    }
    .action-card.selected[_ngcontent-%COMP%] {
      border-color: var(--%NS%accent);
    }
    .action-type[_ngcontent-%COMP%] {
      font-family: monospace;
      font-size: 13px;
      color: #e4e4e7;
    }
    .action-time[_ngcontent-%COMP%] {
      font-size: 11px;
      color: #71717a;
    }
    .detail-panel[_ngcontent-%COMP%] {
      margin-top: 16px;
      background: #18181b;
      border: 1px solid var(--%NS%accent);
      border-radius: 10px;
      padding: 16px;
    }
    dl[_ngcontent-%COMP%] {
      display: grid;
      grid-template-columns: auto 1fr;
      gap: 6px 12px;
      font-size: 14px;
    }
    dt[_ngcontent-%COMP%] {
      color: #a1a1aa;
    }
    dd[_ngcontent-%COMP%] {
      color: #e4e4e7;
    }
    pre[_ngcontent-%COMP%] {
      font-family: monospace;
      font-size: 12px;
      white-space: pre-wrap;
      word-break: break-all;
    }`]})},AO={signal:`Signal Forms`,reactive:`Reactive`,template:`Template-driven`},jO={own:`validator`,directive:`template attribute`,tree:`cross-field rule`,async:`async`,parse:`parse`,submission:`server`,schema:`schema`,manual:`setErrors`};function MO(e,t,n){return e?e.scope(`ng-devtools`).rpc.call(t,...n===void 0?[]:[n]).then(e=>e,()=>null):Promise.resolve(null)}async function NO(e,t){return await MO(e,`request-form-action`,t)??{ok:!1,error:`The devtools server did not answer.`}}function PO(e){return`${e.ok?e.message??`Done.`:e.error??`Failed.`}${e.skipped?.length?` Skipped: ${e.skipped.map(e=>`${e.path} (${e.reason})`).join(`, `)}.`:``}${e.status?` Status: ${e.status}.`:``}`}function FO(e){return(e??``).replace(/^_Labels, paths.*_\n\n/,``).replace(/`/g,``).replace(/\*\*/g,``)}function IO(e,t){if(e&1){let e=K();W(0,`label`,4),X(1),G(),W(2,`input`,5),J(`input`,function(t){return N(e),P(Y().draft.set(t.target.value))})(`keydown.enter`,function(){return N(e),P(Y().setValue())}),G(),W(3,`button`,2),J(`click`,function(){return N(e),P(Y().setValue())}),X(4,`Set`),G()}if(e&2){let e=Y();I(),Q(`New value for `,e.node().path),I(),q(`value`,e.draft())}}var LO=class e{form=k_.required();node=k_.required();version=k_(0);rpc=k_(null);text=F(``);target=$(()=>`${this.form().id}|${this.node().path}`);draft=C_({source:this.target,computation:()=>``});message=C_({source:this.target,computation:()=>``});constructor(){$s(()=>{let e=this.form().id,t=this.node().path;this.version();let n=this.rpc();x_(()=>this.load(n,e,t))})}async load(e,t,n){let r=await MO(e,`forms-explain`,{kind:`field`,form:t,path:n});this.form().id===t&&this.node().path===n&&this.text.set(FO(r))}async act(e){let t=await NO(this.rpc(),{action:e,formId:this.form().id,path:this.node().path});this.message.set(t.expression?`${PO(t)} ${t.expression}`:PO(t))}async setValue(){let e=this.draft(),t=e;try{t=JSON.parse(e)}catch{t=e}let n=await NO(this.rpc(),{action:`set-value`,formId:this.form().id,path:this.node().path,value:t,mode:`user`});this.message.set(PO(n))}static ɵfac=function(t){return new(t||e)};static ɵcmp=nm({type:e,selectors:[[`app-forms-field-detail`]],inputs:{form:[1,`form`],node:[1,`node`],version:[1,`version`],rpc:[1,`rpc`]},decls:16,vars:4,consts:[[1,`explain`],[1,`row`],[`type`,`button`,1,`small`,3,`click`],[`role`,`status`,1,`status`],[`for`,`field-value`,1,`sr-only`],[`id`,`field-value`,`type`,`text`,`placeholder`,`New value (JSON or text)`,1,`field-input`,3,`input`,`keydown.enter`,`value`]],template:function(e,t){e&1&&(W(0,`h3`),X(1),G(),W(2,`pre`,0),X(3),G(),W(4,`div`,1),R(5,IO,5,2),W(6,`button`,2),J(`click`,function(){return t.act(`focus`)}),X(7,`Focus`),G(),W(8,`button`,2),J(`click`,function(){return t.act(`mark-touched`)}),X(9,`Touch`),G(),W(10,`button`,2),J(`click`,function(){return t.act(`revalidate`)}),X(11,`Revalidate`),G(),W(12,`button`,2),J(`click`,function(){return t.act(`store-as-global`)}),X(13,`Store as global`),G()(),W(14,`p`,3),X(15),G()),e&2&&(I(),Z(t.node().path||`(form)`),I(2),Z(t.text()||`Loading…`),I(2),z(t.node().type===`control`&&!t.node().redacted?5:-1),I(10),Z(t.message()))},styles:[`.muted[_ngcontent-%COMP%] {
    color: #a1a1aa;
  }
  .small[_ngcontent-%COMP%] {
    padding: 4px 10px;
    border: 1px solid #52525b;
    border-radius: 6px;
    background: #18181b;
    color: #e4e4e7;
    font-size: 12px;
    cursor: pointer;
  }
  .small[_ngcontent-%COMP%]:hover {
    border-color: var(--%NS%accent);
  }
  .small[_ngcontent-%COMP%]:focus-visible, 
   .field-input[_ngcontent-%COMP%]:focus-visible {
    outline: 2px solid var(--%NS%accent);
    outline-offset: 2px;
  }
  .field-input[_ngcontent-%COMP%] {
    padding: 4px 8px;
    background: #18181b;
    border: 1px solid #52525b;
    border-radius: 6px;
    color: #e4e4e7;
    font-size: 13px;
  }
  .explain[_ngcontent-%COMP%] {
    margin: 0;
    padding: 10px;
    border: 1px solid #27272a;
    border-radius: 6px;
    color: #e4e4e7;
    font-size: 12px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-family: ui-monospace, monospace;
  }
  .tag[_ngcontent-%COMP%] {
    display: inline-block;
    margin: 0 4px 2px 0;
    padding: 0 5px;
    border: 1px solid #3f3f46;
    border-radius: 4px;
    color: #d4d4d8;
    font-size: 11px;
  }
  .tag[data-tone='warn'][_ngcontent-%COMP%] {
    border-color: #a16207;
    color: #fef08a;
  }
  .tag[data-tone='bad'][_ngcontent-%COMP%] {
    border-color: #b91c1c;
    color: #fecaca;
  }
  .status[_ngcontent-%COMP%] {
    min-height: 1.2em;
    margin: 0;
    color: #d4d4d8;
    font-size: 13px;
  }

    [_nghost-%COMP%] {
      display: grid;
      gap: 8px;
      padding: 10px;
      border: 1px solid #3f3f46;
      border-radius: 8px;
    }
    h3[_ngcontent-%COMP%] {
      margin: 0;
      color: #e4e4e7;
      font-size: 14px;
      font-family: ui-monospace, monospace;
    }
    .row[_ngcontent-%COMP%] {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }
    .sr-only[_ngcontent-%COMP%] {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }`]})};function RO(e,t){e&1&&(W(0,`p`,0),X(1,`Checking…`),G())}function zO(e,t){e&1&&(W(0,`p`,0),X(1,`No problems found. For generic accessibility, run axe on the page.`),G())}function BO(e,t){if(e&1&&(W(0,`span`,0),X(1),G()),e&2){let e=Y().$implicit;I(),Q(`at `,e.path)}}function VO(e,t){if(e&1&&(W(0,`li`)(1,`span`,2),X(2),G(),W(3,`code`),X(4),G(),R(5,BO,2,1,`span`,0),W(6,`div`),X(7),G(),W(8,`div`,0),X(9),G()()),e&2){let e=t.$implicit;I(),L(`data-tone`,e.severity===`info`?``:e.severity===`error`?`bad`:`warn`),I(),Z(e.severity),I(2),Z(e.rule),I(),z(e.path?5:-1),I(2),Z(e.message),I(2),Q(`Fix: `,e.fix)}}function HO(e,t){if(e&1&&(W(0,`ul`,1),B(1,VO,10,6,`li`,null,jh),G()),e&2){let e=Y();I(),V(e.findings())}}var UO=class e{formId=k_.required();version=k_(0);rpc=k_(null);submit=F(``);payload=F(``);message=F(``);constructor(){$s(()=>{let e=this.formId();this.version();let t=this.rpc();x_(async()=>{let[n,r]=await Promise.all([MO(t,`forms-explain`,{kind:`submit`,form:e}),MO(t,`forms-explain`,{kind:`payload`,form:e})]);this.formId()===e&&(this.submit.set(FO(n)),this.payload.set(FO(r)))})})}async copyFixture(){let e=(await MO(this.rpc(),`forms-explain`,{kind:`fixture`,form:this.formId()})??``).match(/```ts\n([\s\S]*?)```/)?.[1];if(!e){this.message.set(`No test fixture is available for this form.`);return}try{await navigator.clipboard.writeText(e),this.message.set(`Copied.`)}catch{this.message.set(`Clipboard is not available here.`)}}static ɵfac=function(t){return new(t||e)};static ɵcmp=nm({type:e,selectors:[[`app-forms-submit`]],inputs:{formId:[1,`formId`],version:[1,`version`],rpc:[1,`rpc`]},decls:13,vars:3,consts:[[1,`explain`],[`type`,`button`,1,`small`,3,`click`],[`role`,`status`,1,`status`]],template:function(e,t){e&1&&(W(0,`h3`),X(1,`Submit`),G(),W(2,`pre`,0),X(3),G(),W(4,`h3`),X(5,`Payload`),G(),W(6,`pre`,0),X(7),G(),W(8,`div`)(9,`button`,1),J(`click`,function(){return t.copyFixture()}),X(10,`Copy test fixture`),G(),W(11,`span`,2),X(12),G()()),e&2&&(I(3),Z(t.submit()||`Loading…`),I(4),Z(t.payload()||`Loading…`),I(5),Z(t.message()))},styles:[`.muted[_ngcontent-%COMP%] {
    color: #a1a1aa;
  }
  .small[_ngcontent-%COMP%] {
    padding: 4px 10px;
    border: 1px solid #52525b;
    border-radius: 6px;
    background: #18181b;
    color: #e4e4e7;
    font-size: 12px;
    cursor: pointer;
  }
  .small[_ngcontent-%COMP%]:hover {
    border-color: var(--%NS%accent);
  }
  .small[_ngcontent-%COMP%]:focus-visible, 
   .field-input[_ngcontent-%COMP%]:focus-visible {
    outline: 2px solid var(--%NS%accent);
    outline-offset: 2px;
  }
  .field-input[_ngcontent-%COMP%] {
    padding: 4px 8px;
    background: #18181b;
    border: 1px solid #52525b;
    border-radius: 6px;
    color: #e4e4e7;
    font-size: 13px;
  }
  .explain[_ngcontent-%COMP%] {
    margin: 0;
    padding: 10px;
    border: 1px solid #27272a;
    border-radius: 6px;
    color: #e4e4e7;
    font-size: 12px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-family: ui-monospace, monospace;
  }
  .tag[_ngcontent-%COMP%] {
    display: inline-block;
    margin: 0 4px 2px 0;
    padding: 0 5px;
    border: 1px solid #3f3f46;
    border-radius: 4px;
    color: #d4d4d8;
    font-size: 11px;
  }
  .tag[data-tone='warn'][_ngcontent-%COMP%] {
    border-color: #a16207;
    color: #fef08a;
  }
  .tag[data-tone='bad'][_ngcontent-%COMP%] {
    border-color: #b91c1c;
    color: #fecaca;
  }
  .status[_ngcontent-%COMP%] {
    min-height: 1.2em;
    margin: 0;
    color: #d4d4d8;
    font-size: 13px;
  }

    [_nghost-%COMP%] {
      display: grid;
      gap: 8px;
    }
    h3[_ngcontent-%COMP%] {
      margin: 4px 0 0;
      color: #d4d4d8;
      font-size: 13px;
    }
    .status[_ngcontent-%COMP%] {
      margin-left: 8px;
    }`]})},WO=class e{formId=k_.required();version=k_(0);rpc=k_(null);findings=F(null);constructor(){$s(()=>{let e=this.formId();this.version();let t=this.rpc();x_(async()=>{let n=await MO(t,`forms-lint`,{form:e});this.formId()===e&&this.findings.set(n??[])})})}static ɵfac=function(t){return new(t||e)};static ɵcmp=nm({type:e,selectors:[[`app-forms-lint`]],inputs:{formId:[1,`formId`],version:[1,`version`],rpc:[1,`rpc`]},decls:3,vars:1,consts:[[1,`muted`],[1,`findings`],[1,`tag`]],template:function(e,t){e&1&&R(0,RO,2,0,`p`,0)(1,zO,2,0,`p`,0)(2,HO,3,0,`ul`,1),e&2&&z(t.findings()===null?0:t.findings().length?2:1)},styles:[`.muted[_ngcontent-%COMP%] {
    color: #a1a1aa;
  }
  .small[_ngcontent-%COMP%] {
    padding: 4px 10px;
    border: 1px solid #52525b;
    border-radius: 6px;
    background: #18181b;
    color: #e4e4e7;
    font-size: 12px;
    cursor: pointer;
  }
  .small[_ngcontent-%COMP%]:hover {
    border-color: var(--%NS%accent);
  }
  .small[_ngcontent-%COMP%]:focus-visible, 
   .field-input[_ngcontent-%COMP%]:focus-visible {
    outline: 2px solid var(--%NS%accent);
    outline-offset: 2px;
  }
  .field-input[_ngcontent-%COMP%] {
    padding: 4px 8px;
    background: #18181b;
    border: 1px solid #52525b;
    border-radius: 6px;
    color: #e4e4e7;
    font-size: 13px;
  }
  .explain[_ngcontent-%COMP%] {
    margin: 0;
    padding: 10px;
    border: 1px solid #27272a;
    border-radius: 6px;
    color: #e4e4e7;
    font-size: 12px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-family: ui-monospace, monospace;
  }
  .tag[_ngcontent-%COMP%] {
    display: inline-block;
    margin: 0 4px 2px 0;
    padding: 0 5px;
    border: 1px solid #3f3f46;
    border-radius: 4px;
    color: #d4d4d8;
    font-size: 11px;
  }
  .tag[data-tone='warn'][_ngcontent-%COMP%] {
    border-color: #a16207;
    color: #fef08a;
  }
  .tag[data-tone='bad'][_ngcontent-%COMP%] {
    border-color: #b91c1c;
    color: #fecaca;
  }
  .status[_ngcontent-%COMP%] {
    min-height: 1.2em;
    margin: 0;
    color: #d4d4d8;
    font-size: 13px;
  }

    .findings[_ngcontent-%COMP%] {
      display: grid;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
      font-size: 13px;
      color: #e4e4e7;
    }
    .findings[_ngcontent-%COMP%]   li[_ngcontent-%COMP%] {
      padding: 8px;
      border: 1px solid #27272a;
      border-radius: 6px;
    }
    code[_ngcontent-%COMP%] {
      color: #c4b5fd;
    }`]})},GO=()=>[],KO=(e,t)=>t.formId+`#`+t.seq;function qO(e,t){if(e&1){let e=K();W(0,`label`)(1,`input`,6),J(`change`,function(){let t=N(e).$implicit;return P(Y().filter.set(t))}),G(),X(2),G()}if(e&2){let e=t.$implicit,n=Y();I(),q(`value`,e)(`checked`,e===n.filter()),I(),Q(` `,e,` `)}}function JO(e,t){if(e&1&&(W(0,`span`,8),X(1),G()),e&2){let e=Y().$implicit;L(`data-tone`,e.outcome===`ran`?``:`bad`),I(),Z(e.outcome)}}function YO(e,t){if(e&1&&(W(0,`span`,5),X(1),G(),X(2,` → `)),e&2){let e=Y().$implicit;I(),Z(e.prev)}}function XO(e,t){if(e&1&&(W(0,`span`,8),X(1),G()),e&2){let e=Y().$implicit;I(),Q(`×`,e.count)}}function ZO(e,t){if(e&1&&(W(0,`span`,8),X(1),G()),e&2){let e=Y().$implicit;I(),Z(e.origin)}}function QO(e,t){if(e&1&&(W(0,`span`,8),X(1),G()),e&2){let e=Y().$implicit;L(`data-tone`,e.ms>1e3?`warn`:``),I(),Q(`pending `,e.ms,`ms`)}}function $O(e,t){if(e&1&&(W(0,`span`,8),X(1),G()),e&2){let e=Y().$implicit;L(`data-tone`,e.renders>20?`warn`:``),I(),n_(``,e.renders,` renders: `,(e.rendered??a_(3,GO)).join(`, `))}}function ek(e,t){if(e&1&&(W(0,`span`,10),X(1),G()),e&2){let e=Y().$implicit;I(),Q(`from `,e.caller)}}function tk(e,t){if(e&1&&(W(0,`li`)(1,`time`),X(2),G(),W(3,`code`),X(4),G(),W(5,`span`,7),X(6),G(),R(7,JO,2,2,`span`,8),W(8,`span`,9),R(9,YO,3,1),X(10),G(),R(11,XO,2,1,`span`,8),R(12,ZO,2,1,`span`,8),R(13,QO,2,2,`span`,8),R(14,$O,2,4,`span`,8),R(15,ek,2,1,`span`,10),G()),e&2){let e=t.$implicit,n=Y(2);L(`data-type`,e.type),I(2),Z(n.time(e.timestamp)),I(2),Z(e.path||`(form)`),I(2),Z(e.type),I(),z(e.outcome?7:-1),I(2),z(e.prev===void 0?-1:9),I(),Q(` `,e.detail,` `),I(),z(e.count&&e.count>1?11:-1),I(),z(e.origin?12:-1),I(),z(e.ms===void 0?-1:13),I(),z(e.renders?14:-1),I(),z(e.caller?15:-1)}}function nk(e,t){if(e&1&&(W(0,`ol`,4),B(1,tk,16,12,`li`,null,KO),G()),e&2){let e=Y();I(),V(e.shown())}}function rk(e,t){e&1&&(W(0,`p`,5),X(1,`No changes yet. Type into the form to see them here.`),G())}var ik=[`all`,`user`,`code`,`devtools`],ak=class e{events=k_.required();recording=k_(!1);record=E_();origins=ik;filter=F(`all`);shown=$(()=>{let e=this.filter();return this.events().filter(t=>e===`all`||t.origin===e).slice(-100).reverse()});time(e){return new Date(e).toLocaleTimeString()}static ɵfac=function(t){return new(t||e)};static ɵcmp=nm({type:e,selectors:[[`app-forms-timeline`]],inputs:{events:[1,`events`],recording:[1,`recording`]},outputs:{record:`record`},decls:10,vars:2,consts:[[1,`record`],[`type`,`checkbox`,3,`change`,`checked`],[1,`chips`],[1,`sr-only`],[1,`events`],[1,`muted`],[`type`,`radio`,`name`,`timeline-origin`,3,`change`,`value`,`checked`],[1,`event-type`],[1,`tag`],[1,`detail`],[1,`caller`]],template:function(e,t){e&1&&(W(0,`label`,0)(1,`input`,1),J(`change`,function(){return t.record.emit(!t.recording())}),G(),X(2,` Record calling code, validator changes and renders per keystroke `),G(),W(3,`fieldset`,2)(4,`legend`,3),X(5,`Show changes from`),G(),B(6,qO,3,3,`label`,null,Mh),G(),R(8,nk,3,0,`ol`,4)(9,rk,2,0,`p`,5)),e&2&&(I(),q(`checked`,t.recording()),I(5),V(t.origins),I(2),z(t.shown().length?8:9))},styles:[`.muted[_ngcontent-%COMP%] {
    color: #a1a1aa;
  }
  .small[_ngcontent-%COMP%] {
    padding: 4px 10px;
    border: 1px solid #52525b;
    border-radius: 6px;
    background: #18181b;
    color: #e4e4e7;
    font-size: 12px;
    cursor: pointer;
  }
  .small[_ngcontent-%COMP%]:hover {
    border-color: var(--%NS%accent);
  }
  .small[_ngcontent-%COMP%]:focus-visible, 
   .field-input[_ngcontent-%COMP%]:focus-visible {
    outline: 2px solid var(--%NS%accent);
    outline-offset: 2px;
  }
  .field-input[_ngcontent-%COMP%] {
    padding: 4px 8px;
    background: #18181b;
    border: 1px solid #52525b;
    border-radius: 6px;
    color: #e4e4e7;
    font-size: 13px;
  }
  .explain[_ngcontent-%COMP%] {
    margin: 0;
    padding: 10px;
    border: 1px solid #27272a;
    border-radius: 6px;
    color: #e4e4e7;
    font-size: 12px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-family: ui-monospace, monospace;
  }
  .tag[_ngcontent-%COMP%] {
    display: inline-block;
    margin: 0 4px 2px 0;
    padding: 0 5px;
    border: 1px solid #3f3f46;
    border-radius: 4px;
    color: #d4d4d8;
    font-size: 11px;
  }
  .tag[data-tone='warn'][_ngcontent-%COMP%] {
    border-color: #a16207;
    color: #fef08a;
  }
  .tag[data-tone='bad'][_ngcontent-%COMP%] {
    border-color: #b91c1c;
    color: #fecaca;
  }
  .status[_ngcontent-%COMP%] {
    min-height: 1.2em;
    margin: 0;
    color: #d4d4d8;
    font-size: 13px;
  }

    [_nghost-%COMP%] {
      display: grid;
      gap: 8px;
    }
    .chips[_ngcontent-%COMP%] {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin: 0;
      padding: 0;
      border: 0;
      color: #d4d4d8;
      font-size: 13px;
    }
    .sr-only[_ngcontent-%COMP%] {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    .events[_ngcontent-%COMP%] {
      display: grid;
      gap: 4px;
      margin: 0;
      padding: 0;
      list-style: none;
      font-size: 13px;
    }
    .events[_ngcontent-%COMP%]   li[_ngcontent-%COMP%] {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: baseline;
      color: #d4d4d8;
    }
    .events[_ngcontent-%COMP%]   li[data-type='submit'][_ngcontent-%COMP%] {
      border-left: 3px solid var(--%NS%accent);
      padding-left: 6px;
    }
    time[_ngcontent-%COMP%] {
      color: #a1a1aa;
      font-variant-numeric: tabular-nums;
    }
    code[_ngcontent-%COMP%] {
      color: #c4b5fd;
    }
    .event-type[_ngcontent-%COMP%] {
      color: #93c5fd;
    }
    .detail[_ngcontent-%COMP%] {
      overflow-wrap: anywhere;
    }
    .record[_ngcontent-%COMP%] {
      color: #d4d4d8;
      font-size: 13px;
    }
    .caller[_ngcontent-%COMP%] {
      flex-basis: 100%;
      padding-left: 16px;
      color: #a1a1aa;
      font-family: ui-monospace, monospace;
      font-size: 12px;
      overflow-wrap: anywhere;
    }`]})},ok=()=>[],sk=(e,t)=>t.id,ck=(e,t)=>t.node.path;function lk(e,t){e&1&&(H(0,`p`,0),X(1,`Connecting…`),U())}function uk(e,t){e&1&&(H(0,`p`,0),X(1,`Could not load forms from the devtools server. Reload to try again.`),U())}function dk(e,t){e&1&&(H(0,`p`,0),X(1,`Loading forms…`),U())}function fk(e,t){e&1&&(H(0,`div`,0)(1,`p`),X(2,`No forms on the page yet.`),U(),H(3,`p`,2),X(4,` Open a page that renders a form. Signal Forms, reactive and template-driven forms all show up here, in development builds. `),U()())}function pk(e,t){e&1&&(H(0,`span`,10),X(1),H(2,`span`,9),X(3,` errors`),U()()),e&2&&(I(),Z(t))}function mk(e,t){if(e&1){let e=K();H(0,`li`)(1,`button`,5),cg(`click`,function(){let t=N(e).$implicit;return P(Y(2).selectForm(t.id))}),Wh(2,`span`,6),H(3,`span`,7),X(4),U(),H(5,`span`,8),X(6),H(7,`span`,9),X(8),U()(),R(9,pk,4,1,`span`,10),U()()}if(e&2){let e,n=t.$implicit,r=Y(2);I(),jg(`active`,n.id===r.selected()?.id),L(`aria-current`,n.id===r.selected()?.id?`true`:null),I(),L(`data-status`,n.root.status),I(2),Z(n.label),I(2),n_(``,r.kindLabel(n.kind),` · `,n.id,` `),I(2),Q(`, `,n.root.status),I(),z((e=r.counts().get(n.id)?.errors)?9:-1,e)}}function hk(e,t){if(e&1&&(H(0,`span`),X(1),U()),e&2){let e=Y();I(),Z(e.submitted?`submitted`:`not submitted`)}}function gk(e,t){e&1&&(H(0,`span`),X(1,`submitting`),U())}function _k(e,t){if(e&1){let e=K();H(0,`button`,14),cg(`click`,function(){return N(e),P(Y(3).confirmAct(`restore`))}),X(1),U()}if(e&2){let e=Y(3);I(),Q(` `,e.armed()===`restore`?`Confirm restore`:`Restore `+e.snapshot(),` `)}}function vk(e,t){if(e&1){let e=K();H(0,`button`,22),cg(`click`,function(){let t=N(e).$implicit;return P(Y(3).tab_.set(t.id))}),X(1),U()}if(e&2){let e=t.$implicit,n=Y(3);Vh(`id`,`forms-tab-`+e.id),L(`aria-selected`,e.id===n.tab_())(`aria-controls`,`forms-panel-`+e.id)(`tabindex`,e.id===n.tab_()?0:-1),I(),Q(` `,e.label,` `)}}function yk(e,t){if(e&1){let e=K();H(0,`label`)(1,`input`,29),cg(`change`,function(){let t=N(e).$implicit;return P(Y(4).toggleChip(t.id))}),U(),X(2),U()}if(e&2){let e=t.$implicit,n=Y(4);I(),Vh(`checked`,n.active().has(e.id)),I(),Q(` `,e.label,` `)}}function bk(e,t){if(e&1&&(H(0,`div`,2),X(1,` typed `),H(2,`code`),X(3),u_(4,`json`),U(),X(5,`, not in the model yet `),U()),e&2){let e=Y(2).$implicit;I(3),Z(f_(4,1,e.node.uncommitted))}}function xk(e,t){if(e&1&&(H(0,`div`,2),X(1,` resets to `),H(2,`code`),X(3),u_(4,`json`),U()()),e&2){let e=Y(2).$implicit;I(3),Z(f_(4,1,e.node.defaultValue))}}function Sk(e,t){if(e&1&&(H(0,`code`),X(1),u_(2,`json`),U(),R(3,bk,6,3,`div`,2),R(4,xk,5,3,`div`,2)),e&2){let e=Y().$implicit;I(),Z(f_(2,3,e.node.value)),I(2),z(e.node.uncommitted===void 0?-1:3),I(),z(e.node.defaultValue===void 0?-1:4)}}function Ck(e,t){e&1&&(H(0,`span`,2),X(1,`not created yet`),U())}function wk(e,t){if(e&1&&(H(0,`span`,12),X(1),U()),e&2){let e=Y().$implicit;L(`data-status`,e.node.status),I(),Z(e.node.status)}}function Tk(e,t){e&1&&(H(0,`span`),X(1,`touched`),U())}function Ek(e,t){if(e&1&&(H(0,`span`),X(1),U()),e&2){let e=Y().$implicit;I(),Z(e.node.changed===!1?`dirty, unchanged`:`dirty`)}}function Dk(e,t){if(e&1&&(H(0,`span`),X(1),U()),e&2){let e=Y().$implicit;I(),Q(`not validated (`,e.node.skipped,`)`)}}function Ok(e,t){if(e&1&&(H(0,`span`,36),X(1),U()),e&2){let e=Y().$implicit;I(),Q(`stale: `,e.node.stale.join(`, `))}}function kk(e,t){e&1&&(H(0,`span`,36),X(1,`view out of sync`),U())}function Ak(e,t){if(e&1&&(H(0,`span`),X(1),U()),e&2){let e=Y().$implicit;I(),Q(`redacted (`,e.node.redacted,`)`)}}function jk(e,t){e&1&&(H(0,`span`),X(1,`required`),U())}function Mk(e,t){e&1&&(H(0,`span`),X(1,`readonly`),U())}function Nk(e,t){e&1&&(H(0,`span`),X(1,`hidden`),U())}function Pk(e,t){if(e&1&&(H(0,`span`),X(1),U()),e&2){let e=Y().$implicit;I(),Q(`updates on `,e.node.updateOn)}}function Fk(e,t){e&1&&(H(0,`span`),X(1,`debouncing`),U())}function Ik(e,t){e&1&&(H(0,`span`),X(1,`validators`),U())}function Lk(e,t){e&1&&(H(0,`span`),X(1,`async validator`),U())}function Rk(e,t){if(e&1&&(H(0,`span`),X(1),U()),e&2){let e=t.$implicit;I(),Z(e)}}function zk(e,t){if(e&1&&(H(0,`span`),X(1),U()),e&2){let e=Y().$implicit;I(),Z(e.node.accessor)}}function Bk(e,t){if(e&1&&(H(0,`span`),X(1),U()),e&2){let e=t.$implicit;I(),Q(`disabled: `,e)}}function Vk(e,t){if(e&1&&(H(0,`span`,40),X(1),U()),e&2){let e=Y().$implicit,t=Y(5);I(),Z(t.sourceText(e))}}function Hk(e,t){if(e&1&&(H(0,`div`),X(1),H(2,`code`,39),X(3),U(),R(4,Vk,2,1,`span`,40),U()),e&2){let e=t.$implicit,n=Y().$implicit,r=Y(4);I(),Q(` `,r.errorText(n.node,e),` `),I(2),Z(e.kind),I(),z(e.source?4:-1)}}function Uk(e,t){e&1&&(H(0,`div`,38),X(1,`not shown to the user`),U())}function Wk(e,t){if(e&1&&(H(0,`tr`)(1,`td`,41),X(2),U()()),e&2){let e=Y().$implicit;I(),Ag(`padding-left`,24+e.depth*16,`px`),I(),n_(` `,e.node.truncated,` more fields under `,e.node.path||`the form`,` not shown `)}}function Gk(e,t){if(e&1){let e=K();H(0,`tr`,30),cg(`mouseenter`,function(){let t=N(e).$implicit,n=Y(2);return P(Y(2).highlight(n.id,t.node.path))})(`mouseleave`,function(){return N(e),P(Y(4).highlight(null,``))}),H(1,`th`,31)(2,`button`,32),cg(`focus`,function(){let t=N(e).$implicit,n=Y(2);return P(Y(2).highlight(n.id,t.node.path))})(`blur`,function(){return N(e),P(Y(4).highlight(null,``))})(`click`,function(){let t=N(e).$implicit;return P(Y(4).fieldPath.set(t.node.path))}),X(3),U(),H(4,`span`,33),X(5),U()(),H(6,`td`,34),R(7,Sk,5,5),U(),H(8,`td`),R(9,Ck,2,0,`span`,2)(10,wk,2,2,`span`,12),U(),H(11,`td`,35),R(12,Tk,2,0,`span`),R(13,Ek,2,1,`span`),R(14,Dk,2,1,`span`),R(15,Ok,2,1,`span`,36),R(16,kk,2,0,`span`,36),R(17,Ak,2,1,`span`),R(18,jk,2,0,`span`),R(19,Mk,2,0,`span`),R(20,Nk,2,0,`span`),R(21,Pk,2,1,`span`),R(22,Fk,2,0,`span`),R(23,Ik,2,0,`span`),R(24,Lk,2,0,`span`),B(25,Rk,2,1,`span`,null,Mh),R(27,zk,2,1,`span`),B(28,Bk,2,1,`span`,null,jh),U(),H(30,`td`,37),B(31,Hk,5,3,`div`,null,jh),R(33,Uk,2,0,`div`,38),U()(),R(34,Wk,3,4,`tr`)}if(e&2){let e=t.$implicit,n=Y(4);jg(`invalid`,e.node.errors.length),I(),Ag(`padding-left`,8+e.depth*16,`px`),I(),L(`aria-label`,`Highlight `+(e.node.path||`the form`)+` on the page`)(`aria-pressed`,e.node.path===n.fieldPath()),I(),Q(` `,e.node.key||`(form)`,` `),I(2),Z(e.node.type),I(2),z(e.node.type===`control`?7:-1),I(2),z(e.node.materialized===!1?9:10),I(3),z(e.node.touched?12:-1),I(),z(e.node.dirty?13:-1),I(),z(e.node.skipped?14:-1),I(),z(e.node.stale?.length?15:-1),I(),z(e.node.dom?.drift===void 0?-1:16),I(),z(e.node.redacted?17:-1),I(),z(e.node.required?18:-1),I(),z(e.node.readonly?19:-1),I(),z(e.node.hidden?20:-1),I(),z(e.node.updateOn?21:-1),I(),z(e.node.debouncing?22:-1),I(),z(e.node.validators?.sync?23:-1),I(),z(e.node.validators?.async?24:-1),I(),V(n.constraintList(e.node)),I(2),z(e.node.accessor?27:-1),I(),V(e.node.disabledReasons??a_(26,ok)),I(3),V(e.node.errors),I(2),z(e.node.errors.length&&e.node.dom?.errorShown===!1?33:-1),I(),z(e.node.truncated?34:-1)}}function Kk(e,t){e&1&&X(0),e&2&&Q(` No field path matches "`,Y(5).filter(),`". `)}function qk(e,t){e&1&&X(0,` No field matches the selected filters. `)}function Jk(e,t){if(e&1&&(H(0,`tr`)(1,`td`,41),R(2,Kk,1,1)(3,qk,1,0),U()()),e&2){let e=Y(4);I(2),z(e.filter()?2:3)}}function Yk(e,t){if(e&1&&Wh(0,`app-forms-field-detail`,28),e&2){let e=Y(2),n=Y(2);Vh(`form`,e)(`node`,t)(`version`,n.version())(`rpc`,n.rpc())}}function Xk(e,t){if(e&1){let e=K();H(0,`fieldset`,23)(1,`legend`,9),X(2,`Show only fields that are`),U(),B(3,yk,3,2,`label`,null,sk),U(),H(5,`input`,24),cg(`input`,function(t){return N(e),P(Y(3).onFilter(t))}),U(),H(6,`div`,25)(7,`table`,26)(8,`thead`)(9,`tr`)(10,`th`,27),X(11,`Field`),U(),H(12,`th`,27),X(13,`Value`),U(),H(14,`th`,27),X(15,`Status`),U(),H(16,`th`,27),X(17,`State`),U(),H(18,`th`,27),X(19,`Errors`),U()()(),H(20,`tbody`),B(21,Gk,35,27,null,null,ck,!1,Jk,4,1,`tr`),U()()(),R(24,Yk,1,4,`app-forms-field-detail`,28)}if(e&2){let e,t=Y(3);I(3),V(t.chips),I(2),Vh(`value`,t.filter()),I(16),V(t.rows()),I(3),z((e=t.selectedNode())?24:-1,e)}}function Zk(e,t){if(e&1){let e=K();H(0,`app-forms-timeline`,42),cg(`record`,function(t){return N(e),P(Y(3).setRecording(t))}),U()}if(e&2){let e=Y(3);Vh(`events`,e.selectedEvents())(`recording`,e.recording())}}function Qk(e,t){if(e&1&&Wh(0,`app-forms-submit`,21),e&2){let e=Y(),t=Y(2);Vh(`formId`,e.id)(`version`,t.version())(`rpc`,t.rpc())}}function $k(e,t){if(e&1&&Wh(0,`app-forms-lint`,21),e&2){let e=Y(),t=Y(2);Vh(`formId`,e.id)(`version`,t.version())(`rpc`,t.rpc())}}function eA(e,t){if(e&1){let e=K();H(0,`section`,4)(1,`div`,11)(2,`span`,12),X(3),U(),H(4,`span`),X(5),U(),H(6,`span`),X(7),U(),R(8,hk,2,1,`span`),R(9,gk,2,0,`span`),H(10,`span`,2),X(11),U()(),H(12,`div`,13)(13,`button`,14),cg(`click`,function(){return N(e),P(Y(2).act(`touch-all`))}),X(14,`Touch all`),U(),H(15,`button`,14),cg(`click`,function(){return N(e),P(Y(2).act(`revalidate`))}),X(16,`Revalidate`),U(),H(17,`button`,14),cg(`click`,function(){return N(e),P(Y(2).act(`focus-first-invalid`))}),X(18,` Focus first invalid `),U(),H(19,`button`,14),cg(`click`,function(){return N(e),P(Y(2).pick())}),X(20,`Pick field on page`),U(),H(21,`button`,14),cg(`click`,function(){return N(e),P(Y(2).act(`snapshot`))}),X(22,`Snapshot`),U(),R(23,_k,2,1,`button`,15),H(24,`button`,14),cg(`click`,function(){return N(e),P(Y(2).confirmAct(`reset`))}),X(25),U(),H(26,`button`,14),cg(`click`,function(){return N(e),P(Y(2).confirmAct(`submit`))}),X(27),U()(),H(28,`p`,16),X(29),U(),H(30,`div`,17),cg(`keydown`,function(t){return N(e),P(Y(2).onKey(t))}),B(31,vk,2,5,`button`,18,sk),U(),H(33,`div`,19),R(34,Xk,25,3)(35,Zk,1,2,`app-forms-timeline`,20)(36,Qk,1,3,`app-forms-submit`,21)(37,$k,1,3,`app-forms-lint`,21),U()()}if(e&2){let e,n=t,r=Y(2);L(`aria-label`,n.label),I(2),L(`data-status`,n.root.status),I(),Z(n.root.status),I(2),Z(n.root.dirty?`dirty`:`pristine`),I(2),Z(n.root.touched?`touched`:`untouched`),I(),z(n.submitted===void 0?-1:8),I(),z(n.root.submitting?9:-1),I(2),n_(``,r.counts().get(n.id)?.fields,` fields, `,r.counts().get(n.id)?.errors,` errors`),I(12),z(r.snapshot()?23:-1),I(2),Q(` `,r.armed()===`reset`?`Confirm reset`:`Reset`,` `),I(2),Q(` `,r.armed()===`submit`?`Confirm submit`:`Submit`,` `),I(2),Z(r.message()),I(2),V(r.tabs),I(2),Vh(`id`,`forms-panel-`+r.tab_()),L(`aria-labelledby`,`forms-tab-`+r.tab_()),I(),z((e=r.tab_())===`fields`?34:e===`timeline`?35:e===`submit`?36:e===`lint`?37:-1)}}function tA(e,t){if(e&1&&(H(0,`div`,1)(1,`ul`,3),B(2,mk,10,9,`li`,null,sk),U(),R(4,eA,38,16,`section`,4),U()),e&2){let e,t=Y();I(2),V(t.forms()),I(2),z((e=t.selected())?4:-1,e)}}var nA=[{id:`fields`,label:`Fields`},{id:`timeline`,label:`Timeline`},{id:`submit`,label:`Submit`},{id:`lint`,label:`Lint`}],rA=[{id:`invalid`,label:`Invalid`},{id:`dirty`,label:`Dirty`},{id:`touched`,label:`Touched`},{id:`disabled`,label:`Disabled`},{id:`hidden-error`,label:`Error not shown`}];function iA(e,t){switch(t){case`invalid`:return e.errors.length>0;case`dirty`:return e.dirty&&e.type===`control`;case`touched`:return e.touched&&e.type===`control`;case`disabled`:return e.status===`DISABLED`;case`hidden-error`:return e.dom?.errorShown===!1}}function aA(e){return e.errors.length+(e.children??[]).reduce((e,t)=>e+aA(t),0)}function oA(e){return 1+(e.children??[]).reduce((e,t)=>e+oA(t),0)}var sA=class e{rpc=k_(null);focus=k_(null);focusHandled=E_();forms=F([]);events=F([]);loading=F(!0);failed=F(!1);selectedId=F(null);instrumented=F([]);recording=$(()=>{let e=this.selected()?.id??``;return this.instrumented().some(t=>e.endsWith(`@${t}`))});filter=F(``);tabs=nA;chips=rA;tab_=F(`fields`);active=F(new Set);fieldPath=F(null);version=F(0);message=F(``);armed=F(null);snapshot=F(null);unsubscribe=null;destroyRef=A(fs);counts=$(()=>new Map(this.forms().map(e=>[e.id,{fields:oA(e.root),errors:aA(e.root)}])));selected=$(()=>{let e=this.forms();return e.find(e=>e.id===this.selectedId())??e[0]??null});rows=$(()=>{let e=this.selected();if(!e)return[];let t=this.filter().toLowerCase(),n=Array.from(this.active()),r=[],i=(e,a)=>{let o=r.length,s=(!t||e.path.toLowerCase().includes(t))&&n.every(t=>iA(e,t));for(let t of e.children??[])s=i(t,a+1)||s;return s&&r.splice(o,0,{node:e,depth:a}),s};return i(e.root,0),r});selectedNode=$(()=>{let e=this.fieldPath(),t=this.selected();if(e===null||!t)return null;let n=t=>t.path===e?t:(t.children??[]).map(n).find(Boolean)??null;return n(t.root)});selectedEvents=$(()=>{let e=this.selected()?.id;return this.events().filter(t=>t.formId===e).slice(-200)});constructor(){$s(()=>{let e=this.rpc();e&&this.load(e)}),$s(()=>{let e=this.focus();e&&x_(()=>{this.selectForm(e.id),this.focusHandled.emit()})}),this.destroyRef.onDestroy(()=>{this.unsubscribe?.(),this.highlight(null,``)})}async load(e){this.loading.set(!0),this.failed.set(!1);try{let t=await e.scope(`ng-devtools`).rpc.sharedState(`forms`);if(this.destroyRef.destroyed)return;let n=e=>{let t=e;this.forms.set(t?.forms??[]),this.events.set(t?.events??[]),this.instrumented.set(t?.instrumented??[]),this.version.update(e=>e+1)};n(t.value()),this.unsubscribe?.(),this.unsubscribe=t.on(`updated`,n)}catch{this.failed.set(!0)}finally{this.loading.set(!1)}}async pick(){let e=this.selected();if(!e)return;this.message.set(`Click a field in the app (Esc cancels).`);let t=await NO(this.rpc(),{action:`pick`,formId:e.id}),n=t;if(!t.ok||!n.formId){this.message.set(PO(t));return}this.selectForm(n.formId),this.tab_.set(`fields`),this.fieldPath.set(n.path??``),this.message.set(`Picked ${n.path||`(form)`}.`)}async setRecording(e){let t=this.selected();if(!t)return;let n=await NO(this.rpc(),{action:`instrument`,formId:t.id,value:e});this.message.set(PO(n))}selectForm(e){this.selectedId.set(e),this.filter.set(``),this.fieldPath.set(null),this.snapshot.set(null),this.armed.set(null)}toggleChip(e){this.active.update(t=>{let n=new Set(t);return n.has(e)?n.delete(e):n.add(e),n})}async act(e,t={}){let n=this.selected();if(!n)return;this.armed.set(null);let r=await NO(this.rpc(),{action:e,formId:n.id,...t});r.snapshot&&this.snapshot.set(r.snapshot),this.message.set(PO(r))}confirmAct(e){if(this.armed()!==e){this.armed.set(e),this.message.set(`Press "Confirm ${e}" to ${e} the form in the app.`);return}this.act(e,{confirm:!0,snapshot:this.snapshot()??void 0})}onKey(e){let t=this.tabs.map(e=>e.id),n=t.indexOf(this.tab_()),r=n;if(e.key===`ArrowRight`)r=(n+1)%t.length;else if(e.key===`ArrowLeft`)r=(n-1+t.length)%t.length;else if(e.key===`Home`)r=0;else if(e.key===`End`)r=t.length-1;else return;e.preventDefault(),this.tab_.set(t[r]);let i=e.currentTarget;queueMicrotask(()=>i.querySelector(`#forms-tab-${t[r]}`)?.focus())}sourceText(e){let t=jO[e.source??``]??e.source??``;return e.from===void 0?t:`${t} on ${e.from||`the form`}`}onFilter(e){this.filter.set(e.target.value)}highlight(e,t){let n=this.rpc();n&&n.scope(`ng-devtools`).rpc.callEvent(`request-form-highlight`,e?{formId:e,path:t}:null)}kindLabel(e){return AO[e]}constraintList(e){return Object.entries(e.constraints??{}).map(([e,t])=>`${e} ${t}`)}errorText(e,t){return/^[a-z]/.test(t.message)?`${e.key||`The form`} ${t.message}`:t.message}static ɵfac=function(t){return new(t||e)};static ɵcmp=nm({type:e,selectors:[[`app-forms-inspector`]],inputs:{rpc:[1,`rpc`],focus:[1,`focus`]},outputs:{focusHandled:`focusHandled`},decls:5,vars:1,consts:[[1,`empty`],[1,`layout`],[1,`muted`],[`aria-label`,`Forms on the page`,1,`form-list`],[1,`detail`],[`type`,`button`,1,`form-item`,3,`click`],[`aria-hidden`,`true`,1,`dot`],[1,`label`],[1,`kind`],[1,`sr-only`],[1,`count`],[1,`summary`],[1,`badge`],[`role`,`group`,`aria-label`,`Form actions`,1,`actions`],[`type`,`button`,1,`small`,3,`click`],[`type`,`button`,1,`small`],[`role`,`status`,1,`status`],[`role`,`tablist`,`aria-label`,`Form views`,1,`tabs`,3,`keydown`],[`type`,`button`,`role`,`tab`,3,`id`],[`role`,`tabpanel`,1,`panel`,3,`id`],[3,`events`,`recording`],[3,`formId`,`version`,`rpc`],[`type`,`button`,`role`,`tab`,3,`click`,`id`],[1,`chips`],[`type`,`search`,`placeholder`,`Filter fields by path`,`aria-label`,`Filter fields by path`,1,`filter`,3,`input`,`value`],[`role`,`region`,`aria-label`,`Fields`,`tabindex`,`0`,1,`table-scroll`],[1,`fields`],[`scope`,`col`],[3,`form`,`node`,`version`,`rpc`],[`type`,`checkbox`,3,`change`,`checked`],[3,`mouseenter`,`mouseleave`],[`scope`,`row`],[`type`,`button`,1,`field`,3,`focus`,`blur`,`click`],[1,`type`],[1,`value`],[1,`flags`],[1,`warn`],[1,`errors`],[1,`unseen`],[1,`kind-tag`],[1,`source`],[`colspan`,`5`,1,`muted`],[3,`record`,`events`,`recording`]],template:function(e,t){e&1&&R(0,lk,2,0,`p`,0)(1,uk,2,0,`p`,0)(2,dk,2,0,`p`,0)(3,fk,5,0,`div`,0)(4,tA,5,1,`div`,1),e&2&&z(t.rpc()?t.failed()?1:t.loading()?2:t.forms().length?4:3:0)},dependencies:[LO,ak,UO,WO,Wv],styles:[`.muted[_ngcontent-%COMP%] {
    color: #a1a1aa;
  }
  .small[_ngcontent-%COMP%] {
    padding: 4px 10px;
    border: 1px solid #52525b;
    border-radius: 6px;
    background: #18181b;
    color: #e4e4e7;
    font-size: 12px;
    cursor: pointer;
  }
  .small[_ngcontent-%COMP%]:hover {
    border-color: var(--%NS%accent);
  }
  .small[_ngcontent-%COMP%]:focus-visible, 
   .field-input[_ngcontent-%COMP%]:focus-visible {
    outline: 2px solid var(--%NS%accent);
    outline-offset: 2px;
  }
  .field-input[_ngcontent-%COMP%] {
    padding: 4px 8px;
    background: #18181b;
    border: 1px solid #52525b;
    border-radius: 6px;
    color: #e4e4e7;
    font-size: 13px;
  }
  .explain[_ngcontent-%COMP%] {
    margin: 0;
    padding: 10px;
    border: 1px solid #27272a;
    border-radius: 6px;
    color: #e4e4e7;
    font-size: 12px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-family: ui-monospace, monospace;
  }
  .tag[_ngcontent-%COMP%] {
    display: inline-block;
    margin: 0 4px 2px 0;
    padding: 0 5px;
    border: 1px solid #3f3f46;
    border-radius: 4px;
    color: #d4d4d8;
    font-size: 11px;
  }
  .tag[data-tone='warn'][_ngcontent-%COMP%] {
    border-color: #a16207;
    color: #fef08a;
  }
  .tag[data-tone='bad'][_ngcontent-%COMP%] {
    border-color: #b91c1c;
    color: #fecaca;
  }
  .status[_ngcontent-%COMP%] {
    min-height: 1.2em;
    margin: 0;
    color: #d4d4d8;
    font-size: 13px;
  }

    .actions[_ngcontent-%COMP%] {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .tabs[_ngcontent-%COMP%] {
      display: flex;
      gap: 4px;
      border-bottom: 1px solid #27272a;
    }
    .tabs[_ngcontent-%COMP%]   [role='tab'][_ngcontent-%COMP%] {
      padding: 6px 12px;
      border: none;
      border-bottom: 2px solid transparent;
      background: none;
      color: #d4d4d8;
      font: inherit;
      font-size: 13px;
      cursor: pointer;
    }
    .tabs[_ngcontent-%COMP%]   [role='tab'][aria-selected='true'][_ngcontent-%COMP%] {
      border-bottom-color: var(--%NS%accent);
      color: #fafafa;
    }
    .tabs[_ngcontent-%COMP%]   [role='tab'][_ngcontent-%COMP%]:focus-visible {
      outline: 2px solid var(--%NS%accent);
      outline-offset: 2px;
    }
    .panel[_ngcontent-%COMP%] {
      display: grid;
      gap: 12px;
    }
    .chips[_ngcontent-%COMP%] {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      margin: 0;
      padding: 0;
      border: 0;
      color: #d4d4d8;
      font-size: 13px;
    }
    .field[aria-pressed='true'][_ngcontent-%COMP%] {
      color: var(--%NS%accent);
      text-decoration: underline;
    }
    .flags[_ngcontent-%COMP%]   span.warn[_ngcontent-%COMP%] {
      border-color: #a16207;
      color: #fef08a;
    }
    .source[_ngcontent-%COMP%] {
      margin-left: 6px;
      color: #a1a1aa;
      font-size: 11px;
    }
    .unseen[_ngcontent-%COMP%] {
      color: #fde68a !important;
      font-size: 11px;
    }
    .layout[_ngcontent-%COMP%] {
      display: grid;
      grid-template-columns: minmax(200px, 260px) minmax(0, 1fr);
      gap: 16px;
    }
    @media (max-width: 720px) {
      .layout[_ngcontent-%COMP%] {
        grid-template-columns: 1fr;
      }
    }
    .form-list[_ngcontent-%COMP%] {
      display: grid;
      gap: 4px;
      align-content: start;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .form-item[_ngcontent-%COMP%] {
      width: 100%;
      display: grid;
      grid-template-columns: auto 1fr auto;
      grid-template-areas: 'dot label count' '. kind kind';
      gap: 2px 8px;
      align-items: center;
      padding: 8px 10px;
      border: 1px solid #27272a;
      border-radius: 6px;
      background: transparent;
      color: #e4e4e7;
      text-align: left;
      cursor: pointer;
    }
    .form-item.active[_ngcontent-%COMP%] {
      border-color: var(--%NS%accent);
      background: #18181b;
    }
    .form-item[_ngcontent-%COMP%]   .dot[_ngcontent-%COMP%] {
      grid-area: dot;
    }
    .form-item[_ngcontent-%COMP%]   .label[_ngcontent-%COMP%] {
      grid-area: label;
      overflow-wrap: anywhere;
      font-size: 13px;
    }
    .form-item[_ngcontent-%COMP%]   .kind[_ngcontent-%COMP%] {
      grid-area: kind;
      color: #a1a1aa;
      font-size: 12px;
    }
    .form-item[_ngcontent-%COMP%]   .count[_ngcontent-%COMP%] {
      grid-area: count;
      padding: 0 6px;
      border-radius: 999px;
      background: #7f1d1d;
      color: #fecaca;
      font-size: 12px;
    }
    .dot[_ngcontent-%COMP%] {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #22c55e;
    }
    .dot[data-status='INVALID'][_ngcontent-%COMP%] {
      background: #ef4444;
    }
    .dot[data-status='PENDING'][_ngcontent-%COMP%] {
      background: #eab308;
    }
    .dot[data-status='DISABLED'][_ngcontent-%COMP%] {
      background: #71717a;
    }
    .detail[_ngcontent-%COMP%] {
      display: grid;
      gap: 12px;
      min-width: 0;
    }
    .summary[_ngcontent-%COMP%] {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 14px;
      align-items: center;
      color: #d4d4d8;
      font-size: 13px;
    }
    .badge[_ngcontent-%COMP%] {
      padding: 1px 6px;
      border-radius: 4px;
      background: #14532d;
      color: #bbf7d0;
      font-size: 11px;
      font-weight: 600;
    }
    .badge[data-status='INVALID'][_ngcontent-%COMP%] {
      background: #7f1d1d;
      color: #fecaca;
    }
    .badge[data-status='PENDING'][_ngcontent-%COMP%] {
      background: #713f12;
      color: #fef08a;
    }
    .badge[data-status='DISABLED'][_ngcontent-%COMP%] {
      background: #3f3f46;
      color: #e4e4e7;
    }
    .filter[_ngcontent-%COMP%] {
      padding: 8px 12px;
      background: #18181b;
      border: 1px solid #52525b;
      border-radius: 6px;
      color: #e4e4e7;
      font-size: 14px;
    }
    .filter[_ngcontent-%COMP%]:focus-visible, 
   .form-item[_ngcontent-%COMP%]:focus-visible {
      outline: 2px solid var(--%NS%accent);
      outline-offset: 2px;
    }
    .table-scroll[_ngcontent-%COMP%] {
      overflow-x: auto;
    }
    .table-scroll[_ngcontent-%COMP%]:focus-visible, 
   .field[_ngcontent-%COMP%]:focus-visible {
      outline: 2px solid var(--%NS%accent);
      outline-offset: 2px;
    }
    .field[_ngcontent-%COMP%] {
      padding: 0;
      border: none;
      background: none;
      color: inherit;
      font: inherit;
      cursor: pointer;
    }
    .sr-only[_ngcontent-%COMP%] {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }
    .fields[_ngcontent-%COMP%] {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    .fields[_ngcontent-%COMP%]   th[_ngcontent-%COMP%], 
   .fields[_ngcontent-%COMP%]   td[_ngcontent-%COMP%] {
      padding: 6px 8px;
      border-bottom: 1px solid #27272a;
      text-align: left;
      vertical-align: top;
    }
    .fields[_ngcontent-%COMP%]   thead[_ngcontent-%COMP%]   th[_ngcontent-%COMP%] {
      color: #a1a1aa;
      font-weight: 500;
    }
    .fields[_ngcontent-%COMP%]   tbody[_ngcontent-%COMP%]   th[_ngcontent-%COMP%] {
      color: #e4e4e7;
      font-weight: 500;
      white-space: nowrap;
    }
    .fields[_ngcontent-%COMP%]   tbody[_ngcontent-%COMP%]   tr[_ngcontent-%COMP%]:hover {
      background: #18181b;
    }
    .type[_ngcontent-%COMP%] {
      margin-left: 6px;
      color: #a1a1aa;
      font-size: 11px;
      font-weight: 400;
    }
    .value[_ngcontent-%COMP%]   code[_ngcontent-%COMP%], 
   .errors[_ngcontent-%COMP%]   code[_ngcontent-%COMP%] {
      color: #c4b5fd;
      overflow-wrap: anywhere;
    }
    .flags[_ngcontent-%COMP%]   span[_ngcontent-%COMP%] {
      display: inline-block;
      margin: 0 4px 2px 0;
      padding: 0 5px;
      border: 1px solid #3f3f46;
      border-radius: 4px;
      color: #d4d4d8;
      font-size: 11px;
    }
    .errors[_ngcontent-%COMP%]   div[_ngcontent-%COMP%] {
      color: #fca5a5;
    }
    .kind-tag[_ngcontent-%COMP%] {
      margin-left: 6px;
      color: #a1a1aa;
      font-size: 11px;
    }
    .muted[_ngcontent-%COMP%] {
      color: #a1a1aa;
    }
    .empty[_ngcontent-%COMP%] {
      padding: 32px;
      text-align: center;
      color: #d4d4d8;
    }`]})},cA=()=>[],lA=()=>[`/`],uA=(e,t)=>t.id,dA=(e,t)=>t.route.id,fA=(e,t)=>t[0],pA=(e,t)=>t.file+t.method,mA=(e,t)=>t.mode,hA=(e,t)=>t.path,gA=(e,t)=>t.file,_A=(e,t)=>t.rule;function vA(e,t){e&1&&(W(0,`p`,0),X(1,`Reading the project…`),G())}function yA(e,t){e&1&&(W(0,`div`,1)(1,`p`),X(2,`This app is not an Analog app.`),G(),W(3,`p`,2),X(4,` Add `),W(5,`code`),X(6,`ngDevtools()`),G(),X(7,` from `),W(8,`code`),X(9,`@santoshyadavdev/ng-devtools/vite`),G(),X(10,` next to `),W(11,`code`),X(12,`analog()`),G(),X(13,` in vite.config.ts and run the Analog dev server. `),G()())}function bA(e,t){e&1&&(W(0,`div`,7)(1,`span`,5),X(2,`Open in the browser`),G(),W(3,`span`,11),X(4),G()()),e&2&&(I(4),Z(t.url))}function xA(e,t){if(e&1){let e=K();W(0,`button`,12),J(`click`,function(){let t=N(e).$implicit;return P(Y(2).view.set(t.id))}),X(1),W(2,`span`,13),X(3),G()()}if(e&2){let e=t.$implicit,n=Y(2);q(`id`,`analog-tab-`+e.id),L(`aria-selected`,e.id===n.view())(`aria-controls`,`analog-panel-`+e.id)(`tabindex`,e.id===n.view()?0:-1),I(),Q(` `,e.label,` `),I(),L(`data-tone`,e.tone),I(),Z(e.count)}}function SA(e,t){if(e&1&&(W(0,`li`)(1,`span`,27),X(2),G(),W(3,`span`,28),X(4),G()()),e&2){let e=t.$implicit,n=Y(5);I(2),Z(n.short(e.file)??e.fullPath),I(),L(`data-kind`,e.kind),I(),Z(e.kind)}}function CA(e,t){if(e&1&&(W(0,`span`,29),X(1),G()),e&2){let e=t.$implicit;I(),n_(``,e[0],` = `,e[1])}}function wA(e,t){if(e&1&&(W(0,`div`,26),B(1,CA,2,2,`span`,29,fA),G()),e&2){let e=Y(2),t=Y(3);I(),V(t.paramList(e.params))}}function TA(e,t){if(e&1&&(W(0,`strong`),X(1),G(),X(2,` renders `),W(3,`ol`,25),B(4,SA,5,3,`li`,null,uA),G(),R(6,wA,3,0,`div`,26)),e&2){let e=Y(),t=Y(3);I(),Z(t.testUrl()),I(3),V(e.chain),I(2),z(t.paramList(e.params).length?6:-1)}}function EA(e,t){if(e&1&&(W(0,`li`)(1,`span`,27),X(2),G(),W(3,`span`,2),X(4),G()()),e&2){let e=t.$implicit,n=Y(6);I(2),Z(n.short(e.file)??e.path),I(2),Z(e.reason)}}function DA(e,t){if(e&1&&(W(0,`ul`,30),B(1,EA,5,2,`li`,null,jh),G()),e&2){let e=Y(2);I(),V(e.rejected.slice(0,5))}}function OA(e,t){if(e&1&&(W(0,`strong`),X(1),G(),X(2,` matches no file route. Angular throws NG04002 "Cannot match any routes". `),R(3,DA,3,0,`ul`,30)),e&2){let e=Y(),t=Y(3);I(),Z(t.testUrl()),I(2),z(e.rejected.length?3:-1)}}function kA(e,t){if(e&1&&(W(0,`div`,21),R(1,TA,7,2)(2,OA,4,2),G()),e&2){let e=t;L(`data-tone`,e.matched?`good`:`bad`),I(),z(e.matched?1:2)}}function AA(e,t){e&1&&(W(0,`span`,32),X(1,`└`),G())}function jA(e,t){e&1&&(W(0,`span`,34),X(1,`open`),G())}function MA(e,t){if(e&1&&(W(0,`span`,35)(1,`span`,38),X(2),G(),X(3),G()),e&2){let e=Y().$implicit,t=Y(3);I(2),Z(t.dir(e.route.file)),I(),Z(t.base(e.route.file))}}function NA(e,t){e&1&&(W(0,`span`,2),X(1,`folder only`),G())}function PA(e,t){if(e&1&&(W(0,`span`,36),X(1),G()),e&2){let e=t.$implicit;I(),Q(``,e,`()`)}}function FA(e,t){if(e&1&&(W(0,`span`,37),X(1),G()),e&2){let e=Y().$implicit;I(),Q(`"`,e.route.title,`"`)}}function IA(e,t){if(e&1&&(W(0,`span`,29),X(1),G()),e&2){let e=Y().$implicit;I(),Z(e)}}function LA(e,t){if(e&1&&R(0,IA,2,1,`span`,29),e&2){let e=t.$implicit;z(e===`title`?-1:0)}}function RA(e,t){if(e&1&&(W(0,`tr`)(1,`td`)(2,`div`,31),R(3,AA,2,0,`span`,32),W(4,`span`,33),X(5),G(),W(6,`span`,28),X(7),G(),R(8,jA,2,0,`span`,34),G()(),W(9,`td`),R(10,MA,4,2,`span`,35)(11,NA,2,0,`span`,2),G(),W(12,`td`),B(13,PA,2,1,`span`,36,Mh),G(),W(15,`td`),R(16,FA,2,1,`span`,37),B(17,LA,1,1,null,null,Mh),G()()),e&2){let e=t.$implicit,n=Y(3);jg(`open`,n.isOpen(e.route))(`dim`,e.route.kind===`group`||e.route.kind===`implicit`),I(2),Ag(`padding-left`,e.depth*18,`px`),I(),z(e.depth?3:-1),I(2),Z(e.route.fullPath),I(),L(`data-kind`,e.route.kind),I(),Z(n.kindText(e.route)),I(),z(n.isOpen(e.route)?8:-1),I(2),z(e.route.file?10:11),I(3),V(n.serverExports(e.route)),I(3),z(e.route.title?16:-1),I(),V(e.route.routeMeta??a_(13,cA))}}function zA(e,t){e&1&&(W(0,`tr`)(1,`td`,39),X(2,`No route matches the filter.`),G()())}function BA(e,t){if(e&1){let e=K();W(0,`div`,14)(1,`form`,15),J(`submit`,function(t){N(e);let n=Y(2);return t.preventDefault(),P(n.explain())}),W(2,`label`,16),X(3,`Test a URL`),G(),W(4,`input`,17),J(`input`,function(t){return N(e),P(Y(2).testUrl.set(t.target.value))}),G(),W(5,`button`,18),X(6,`Explain`),G()(),W(7,`label`,19),X(8,`Filter routes`),G(),W(9,`input`,20),J(`input`,function(t){return N(e),P(Y(2).filter.set(t.target.value))}),G()(),R(10,kA,3,2,`div`,21),W(11,`div`,22)(12,`table`)(13,`thead`)(14,`tr`)(15,`th`,23),X(16,`Route`),G(),W(17,`th`,23),X(18,`File`),G(),W(19,`th`,23),X(20,`Data`),G(),W(21,`th`,23),X(22,`Route meta`),G()()(),W(23,`tbody`),B(24,RA,19,14,`tr`,24,dA,!1,zA,3,0,`tr`),G()()()}if(e&2){let e,t=Y(2);I(4),q(`value`,t.testUrl()),I(5),q(`value`,t.filter()),I(),z((e=t.match())?10:-1,e),I(14),V(t.routeRows())}}function VA(e,t){if(e&1&&(W(0,`span`,27),X(1),G(),X(2)),e&2){let e=t.$implicit,n=t.$index,r=t.$count;I(),Z(e),I(),Q(``,n===r-1?``:`, `,` `)}}function HA(e,t){if(e&1&&(W(0,`div`,40)(1,`strong`),X(2,`load() ran twice`),G(),X(3,` for `),B(4,VA,3,2,null,null,Mh),X(6,` : once while server rendering, again in the browser. TransferState did not serve the server result. `),G()),e&2){let e=Y(3);I(4),V(e.duplicates())}}function UA(e,t){if(e&1){let e=K();W(0,`label`)(1,`input`,54),J(`change`,function(){let t=N(e).$implicit;return P(Y(3).kind.set(t))}),G(),X(2),W(3,`span`,2),X(4),G()()}if(e&2){let e=t.$implicit,n=Y(3);jg(`on`,n.kind()===e),I(),q(`checked`,n.kind()===e),I(),Q(` `,n.kindLabel(e),` `),I(2),Z(n.kindCount(e))}}function WA(e,t){if(e&1&&(W(0,`span`,28),X(1),G()),e&2){let e=Y().$implicit;L(`data-mode`,e.render===`ssr`?`ssr`:`client`),I(),Z(e.render===`ssr`?`server rendered`:`client only`)}}function GA(e,t){if(e&1&&(W(0,`details`)(1,`summary`),X(2,`Response`),G(),W(3,`pre`,61),X(4),G()()),e&2){let e=Y().$implicit,t=Y(4);I(4),Z(t.pretty(e.preview))}}function KA(e,t){if(e&1&&(W(0,`tr`)(1,`td`,56),X(2),G(),W(3,`td`)(4,`span`,28),X(5),G()(),W(6,`td`,57)(7,`span`,58),X(8),G(),W(9,`span`,27),X(10),G(),R(11,WA,2,2,`span`,28),R(12,GA,5,1,`details`),G(),W(13,`td`)(14,`span`,59),X(15),G()(),W(16,`td`,60),X(17),G(),W(18,`td`,2),X(19),G()()),e&2){let e=t.$implicit,n=Y(4);I(2),Z(n.time(e.at)),I(2),L(`data-call`,e.kind),I(),Z(n.kindLabel(e.kind)),I(2),L(`data-method`,e.method),I(),Z(e.method),I(2),Z(e.url),I(),z(e.render?11:-1),I(),z(e.preview?12:-1),I(2),L(`data-status`,n.statusClass(e.status)),I(),Z(e.status),I(2),Q(``,e.ms,` ms`),I(2),Z(e.from)}}function qA(e,t){if(e&1&&(W(0,`div`,44)(1,`table`)(2,`thead`)(3,`tr`)(4,`th`,23),X(5,`Time`),G(),W(6,`th`,23),X(7,`Kind`),G(),W(8,`th`,23),X(9,`Request`),G(),W(10,`th`,23),X(11,`Status`),G(),W(12,`th`,55),X(13,`Time`),G(),W(14,`th`,23),X(15,`From`),G()()(),W(16,`tbody`),B(17,KA,20,12,`tr`,null,uA),G()()()),e&2){let e=Y(3);I(17),V(e.calls())}}function JA(e,t){e&1&&(W(0,`p`,2),X(1,` No calls yet. Navigate in the app to see page renders, load() fetches and API calls. `),G())}function YA(e,t){if(e&1){let e=K();W(0,`tr`)(1,`td`)(2,`span`,58),X(3),G()(),W(4,`td`,27),X(5),G(),W(6,`td`)(7,`span`,35)(8,`span`,38),X(9),G(),X(10),G()(),W(11,`td`)(12,`button`,62),J(`click`,function(){let t=N(e).$implicit;return P(Y(3).tryApi(t))}),X(13,` Try `),G()()()}if(e&2){let e=t.$implicit,n=Y(3);I(2),L(`data-method`,e.method),I(),Z(e.method),I(2),Z(e.path),I(4),Z(n.dir(e.file)),I(),Z(n.base(e.file)),I(2),L(`aria-label`,`Try `+e.method+` `+e.path)}}function XA(e,t){if(e&1&&(W(0,`option`,50),X(1),G()),e&2){let e=t.$implicit;q(`value`,e),I(),Z(e)}}function ZA(e,t){if(e&1){let e=K();W(0,`label`,63),X(1,`JSON body`),G(),W(2,`textarea`,64),J(`input`,function(t){return N(e),P(Y(3).apiBody.set(t.target.value))}),G(),W(3,`label`,65)(4,`input`,66),J(`change`,function(){N(e);let t=Y(3);return P(t.confirmSend.set(!t.confirmSend()))}),G(),X(5,` This request can change data on the dev server`),G()}if(e&2){let e=Y(3);I(2),q(`value`,e.apiBody()),I(2),q(`checked`,e.confirmSend())}}function QA(e,t){if(e&1&&(W(0,`span`,67),X(1,`Refused`),G(),W(2,`span`),X(3),G()),e&2){let e=Y();I(3),Z(e.error)}}function $A(e,t){if(e&1&&(W(0,`div`,47)(1,`span`,59),X(2),G(),W(3,`span`,2),X(4),G()(),W(5,`pre`,61),X(6),G()),e&2){let e=Y(),t=Y(3);I(),L(`data-status`,t.statusClass(e.status??0)),I(),Z(e.status),I(2),n_(``,e.ms,` ms · `,e.type||`no content type`),I(2),Z(t.pretty(e.body??``))}}function ej(e,t){e&1&&(W(0,`div`,53),R(1,QA,4,1)(2,$A,7,5),G()),e&2&&(I(),z(t.error?1:2))}function tj(e,t){if(e&1){let e=K();R(0,HA,7,0,`div`,40),W(1,`fieldset`,41)(2,`legend`,42),X(3,`Show calls of kind`),G(),B(4,UA,5,5,`label`,43,Mh),G(),R(6,qA,19,0,`div`,44)(7,JA,2,0,`p`,2),W(8,`h3`),X(9,`API routes`),G(),W(10,`div`,45)(11,`table`)(12,`thead`)(13,`tr`)(14,`th`,23),X(15,`Method`),G(),W(16,`th`,23),X(17,`Path`),G(),W(18,`th`,23),X(19,`File`),G(),W(20,`th`,23)(21,`span`,42),X(22,`Actions`),G()()()(),W(23,`tbody`),B(24,YA,14,6,`tr`,null,pA),G()()(),W(26,`form`,46),J(`submit`,function(t){N(e);let n=Y(2);return t.preventDefault(),P(n.send())}),W(27,`h3`),X(28,`Request playground`),G(),W(29,`div`,47)(30,`label`,48),X(31,`Method`),G(),W(32,`select`,49),J(`change`,function(t){return N(e),P(Y(2).method.set(t.target.value))}),B(33,XA,2,2,`option`,50,Mh),G(),W(35,`label`,51),X(36,`Path`),G(),W(37,`input`,52),J(`input`,function(t){return N(e),P(Y(2).apiPath.set(t.target.value))}),G(),W(38,`button`,18),X(39,`Send`),G()(),R(40,ZA,6,2),R(41,ej,3,1,`div`,53),G()}if(e&2){let e,t=Y(2);z(t.duplicates().length?0:-1),I(4),V(t.kinds),I(2),z(t.calls().length?6:7),I(18),V(t.project().api),I(8),q(`value`,t.method()),I(),V(t.methods),I(4),q(`value`,t.apiPath()),I(3),z(t.method()===`GET`?-1:40),I(),z((e=t.response())?41:-1,e)}}function nj(e,t){if(e&1&&(W(0,`span`,28),X(1),G()),e&2){let e=t.$implicit;L(`data-mode`,e.mode),I(),n_(``,e.label,` · `,e.count)}}function rj(e,t){e&1&&(W(0,`span`,71),X(1,`differs from config`),G())}function ij(e,t){if(e&1&&(W(0,`span`,59),X(1),G(),W(2,`span`,70),X(3),G(),R(4,rj,2,0,`span`,71)),e&2){let e=t,n=Y().$implicit,r=Y(3);L(`data-status`,r.statusClass(e.status)),I(),Z(e.status),I(2),n_(``,e.render===`client`?`client only`:`server rendered`,` · `,e.ms,` ms`),I(),z(r.mismatch(n)?4:-1)}}function aj(e,t){e&1&&(W(0,`span`,70),X(1,`not requested yet`),G())}function oj(e,t){if(e&1&&(W(0,`span`,35)(1,`span`,38),X(2),G(),X(3),G()),e&2){let e=Y().$implicit,t=Y(3);I(2),Z(t.dir(e.file)),I(),Z(t.base(e.file))}}function sj(e,t){if(e&1&&(W(0,`tr`)(1,`td`,33),X(2),G(),W(3,`td`)(4,`span`,28),X(5),G(),W(6,`span`,70),X(7),G()(),W(8,`td`),R(9,ij,5,5)(10,aj,2,0,`span`,70),G(),W(11,`td`),R(12,oj,4,2,`span`,35),G()()),e&2){let e,n=t.$implicit,r=Y(3);I(2),Z(n.path),I(2),L(`data-mode`,n.mode),I(),Z(r.modeLabel(n.mode)),I(2),Z(n.reason),I(2),z((e=n.last)?9:10,e),I(3),z(n.file?12:-1)}}function cj(e,t){e&1&&(W(0,`p`,2),X(1,` prerender.routes is a function, so the list is known only at build time. `),G())}function lj(e,t){if(e&1&&(W(0,`span`,29),X(1),G()),e&2){let e=t.$implicit;I(),Z(e)}}function uj(e,t){e&1&&(W(0,`span`,70),X(1,`default, nothing configured`),G())}function dj(e,t){if(e&1&&(W(0,`span`,73),X(1),G()),e&2){let e=t.$implicit;I(),Z(e)}}function fj(e,t){if(e&1&&(W(0,`dt`),X(1,`Static, not listed`),G(),W(2,`dd`),B(3,dj,2,1,`span`,73,Mh),G()),e&2){let e=Y(2);I(3),V(e.staticMissing)}}function pj(e,t){if(e&1&&(W(0,`span`,29),X(1),G()),e&2){let e=t.$implicit;I(),Z(e)}}function mj(e,t){if(e&1&&(W(0,`dt`),X(1,`Need explicit entries`),G(),W(2,`dd`),B(3,pj,2,1,`span`,29,Mh),G()),e&2){let e=Y(2);I(3),V(e.dynamic)}}function hj(e,t){if(e&1&&(W(0,`span`,74),X(1),G()),e&2){let e=t.$implicit;I(),Z(e)}}function gj(e,t){if(e&1&&(X(0,` · missing `),B(1,hj,2,1,`span`,74,Mh)),e&2){let e=Y(3);I(),V(e.notBuilt)}}function _j(e,t){if(e&1&&(X(0),R(1,gj,3,0)),e&2){let e=Y(2);Q(` `,e.built.length,` page(s) in dist/analog/public `),I(),z(e.notBuilt.length?1:-1)}}function vj(e,t){e&1&&(W(0,`span`,70),X(1,`no build yet`),G())}function yj(e,t){if(e&1&&(W(0,`dl`,72)(1,`dt`),X(2,`Listed`),G(),W(3,`dd`),B(4,lj,2,1,`span`,29,Mh),R(6,uj,2,0,`span`,70),G(),R(7,fj,5,0),R(8,mj,5,0),W(9,`dt`),X(10,`Build output`),G(),W(11,`dd`),R(12,_j,2,2)(13,vj,2,0,`span`,70),G()()),e&2){let e=Y();I(4),V(e.listed??a_(4,lA)),I(2),z(e.listed?-1:6),I(),z(e.staticMissing.length?7:-1),I(),z(e.dynamic.length?8:-1),I(4),z(e.built.length?12:13)}}function bj(e,t){e&1&&(W(0,`div`,69)(1,`h3`),X(2,`Prerender plan`),G(),R(3,cj,2,0,`p`,2)(4,yj,14,5,`dl`,72),G()),e&2&&(I(3),z(t.dynamicConfig?3:4))}function xj(e,t){if(e&1&&(W(0,`div`,26),B(1,nj,2,3,`span`,28,mA),G(),W(3,`div`,68)(4,`table`)(5,`thead`)(6,`tr`)(7,`th`,23),X(8,`Route`),G(),W(9,`th`,23),X(10,`Configured`),G(),W(11,`th`,23),X(12,`Last request`),G(),W(13,`th`,23),X(14,`File`),G()()(),W(15,`tbody`),B(16,sj,13,6,`tr`,null,hA),G()()(),R(18,bj,5,1,`div`,69)),e&2){let e,t=Y(2);I(),V(t.modeCounts()),I(15),V(t.renderRows()),I(2),z((e=t.plan())?18:-1,e)}}function Sj(e,t){if(e&1&&(W(0,`div`)(1,`span`,76),X(2),G()()),e&2){let e=Y().$implicit;I(2),Z(e.error)}}function Cj(e,t){if(e&1&&(W(0,`div`)(1,`span`,71),X(2),G()()),e&2){let e=Y(5);I(2),Q(`takes over `,e.base(t))}}function wj(e,t){if(e&1&&(W(0,`tr`)(1,`td`)(2,`strong`),X(3),G(),R(4,Sj,3,1,`div`),R(5,Cj,3,1,`div`),G(),W(6,`td`,33),X(7),G(),W(8,`td`,27),X(9),G(),W(10,`td`,56),X(11),G(),W(12,`td`)(13,`span`,35)(14,`span`,38),X(15),G(),X(16),G()()()),e&2){let e,n=t.$implicit,r=Y(4);I(3),Z(n.attributes.title||`(no title)`),I(),z(n.error?4:-1),I(),z((e=r.shadowed(n.file))?5:-1,e),I(2),Z(r.contentUrl(n.file)??``),I(2),Z(n.slug),I(2),Z(n.attributes.date||``),I(4),Z(r.dir(n.file)),I(),Z(r.base(n.file))}}function Tj(e,t){if(e&1&&(W(0,`div`,75)(1,`table`)(2,`thead`)(3,`tr`)(4,`th`,23),X(5,`Title`),G(),W(6,`th`,23),X(7,`URL`),G(),W(8,`th`,23),X(9,`Slug`),G(),W(10,`th`,23),X(11,`Date`),G(),W(12,`th`,23),X(13,`File`),G()()(),W(14,`tbody`),B(15,wj,17,8,`tr`,null,gA),G()()()),e&2){let e=Y(3);I(15),V(e.project().content)}}function Ej(e,t){e&1&&(W(0,`p`,2),X(1,`No markdown files under src/content.`),G())}function Dj(e,t){e&1&&R(0,Tj,17,0,`div`,75)(1,Ej,2,0,`p`,2),e&2&&z(+!Y(2).project().content.length)}function Oj(e,t){if(e&1&&(W(0,`span`,13),X(1),G()),e&2){let e=Y().$implicit;I(),Z(e.items.length)}}function kj(e,t){if(e&1&&(W(0,`span`,35)(1,`span`,38),X(2),G(),X(3),G()),e&2){let e=Y().$implicit,t=Y(5);I(2),Z(t.dir(e.file)),I(),Z(t.base(e.file))}}function Aj(e,t){if(e&1&&(W(0,`span`,33),X(1),G()),e&2){let e=Y().$implicit;I(),Z(e.path)}}function jj(e,t){if(e&1&&(W(0,`li`),R(1,kj,4,2,`span`,35),R(2,Aj,2,1,`span`,33),G()),e&2){let e=t.$implicit;I(),z(e.file?1:-1),I(),z(e.path&&e.path!==e.file?2:-1)}}function Mj(e,t){if(e&1&&(W(0,`li`)(1,`div`,79)(2,`span`,28),X(3),G(),W(4,`strong`,80),X(5),G(),R(6,Oj,2,1,`span`,13),G(),W(7,`p`),X(8),G(),W(9,`ul`,81),B(10,jj,3,2,`li`,null,jh),G(),W(12,`div`,82)(13,`strong`),X(14,`How to fix`),G(),X(15),G(),W(16,`span`,83),X(17),G()()),e&2){let e=t.$implicit,n=Y(4);L(`data-tone`,n.tone(e.severity)),I(2),L(`data-tone`,n.tone(e.severity)),I(),Z(e.severity),I(2),Z(e.title),I(),z(e.items.length>1?6:-1),I(2),Z(e.summary),I(2),V(e.items),I(5),Q(` `,e.fix),I(2),Z(e.rule)}}function Nj(e,t){if(e&1&&(W(0,`p`,2),X(1),G(),W(2,`ul`,78),B(3,Mj,18,8,`li`,null,_A),G()),e&2){let e=Y(3);I(),n_(` `,e.findings().length,` issue(s) in `,e.lintCards().length,` group(s). Each card says what is wrong, where, and how to fix it. `),I(2),V(e.lintCards())}}function Pj(e,t){e&1&&(W(0,`div`,77),X(1,`No Analog problems found.`),G())}function Fj(e,t){e&1&&R(0,Nj,5,2)(1,Pj,2,0,`div`,77),e&2&&z(+!Y(2).findings().length)}function Ij(e,t){if(e&1){let e=K();W(0,`section`,3)(1,`div`,4)(2,`span`,5),X(3,`Analog`),G(),W(4,`span`,6),X(5),G()(),W(6,`div`,4)(7,`span`,5),X(8,`Pages`),G(),W(9,`span`,6),X(10),G()(),W(11,`div`,4)(12,`span`,5),X(13,`API routes`),G(),W(14,`span`,6),X(15),G()(),W(16,`div`,4)(17,`span`,5),X(18,`Server calls`),G(),W(19,`span`,6),X(20),G()(),W(21,`div`,4)(22,`span`,5),X(23,`Issues`),G(),W(24,`span`,6),X(25),G()(),R(26,bA,5,1,`div`,7),G(),W(27,`div`,8),J(`keydown`,function(t){return N(e),P(Y().onKey(t))}),B(28,xA,4,7,`button`,9,uA),G(),W(30,`div`,10),R(31,BA,27,4)(32,tj,42,6)(33,xj,19,1)(34,Dj,2,1)(35,Fj,2,1),G()}if(e&2){let e,t,n=Y();I(5),Z(n.project().version),I(5),Z(n.pageCount()),I(5),Z(n.project().api.length),I(5),Z(n.allCalls().length),I(),L(`data-tone`,n.findings().length?`warn`:`good`),I(4),Z(n.findings().length),I(),z((e=n.page())?26:-1,e),I(2),V(n.views()),I(2),q(`id`,`analog-panel-`+n.view()),L(`aria-labelledby`,`analog-tab-`+n.view()),I(),z((t=n.view())===`routes`?31:t===`server`?32:t===`render`?33:t===`content`?34:t===`lint`?35:-1)}}var Lj={"scan-error":{title:`A folder could not be read`,summary:`Its files are missing from routes, API routes and lint results.`},"duplicate-url":{title:`Two files serve the same URL`,summary:`Only one of them is reachable; the other never renders.`},"sibling-params":{title:`Two dynamic pages in one folder`,summary:`Both are [param] pages at the same level, so the first one always wins.`},"missing-default-export":{title:`Page has no default export`,summary:`Analog needs the component as the default export, so the page renders nothing.`},"redirect-with-component":{title:`Redirect page also exports a component`,summary:`The redirect runs first, so the component never shows.`},"redirect-path-match":{title:`Redirect matches too much`,summary:`An empty-path redirect without pathMatch "full" catches every URL below it.`},"layout-without-outlet":{title:`Layout has no router-outlet`,summary:`The layout has child pages, but without <router-outlet> they never render.`},"server-without-load":{title:`.server.ts without load or action`,summary:`The server file exports nothing Analog calls.`},"orphan-server-file":{title:`.server.ts without a page`,summary:`No page file sits next to it, so its load never runs.`},"api-method-suffix":{title:`Unknown method suffix on an API file`,summary:`The suffix is not an HTTP method, so it becomes part of the URL.`},"duplicate-api-route":{title:`Two handlers for one API route`,summary:`Two files answer the same method and path.`},"api-outside-prefix":{title:`Server route outside the API prefix`,summary:`During vite dev only routes under the prefix reach Nitro.`},"prerender-unknown-route":{title:`Prerender entry matches no page`,summary:`prerender.routes lists a path that no page file serves.`},"prerender-missing-root":{title:`Home page is not prerendered`,summary:`static is on, but prerender.routes leaves out /.`},"content-frontmatter":{title:`Broken frontmatter`,summary:`The markdown frontmatter cannot be read.`},"duplicate-slug":{title:`Two posts share a slug`,summary:`injectContent picks one of them at random.`},"content-shadows-page":{title:`Markdown file takes over a page`,summary:`Files under src/content are routes too, so these URLs render the markdown file instead of the [param] page.`},"load-fetched-twice":{title:`load() runs twice`,summary:`These pages fetched their data while rendering on the server and again in the browser.`},"restart-needed":{title:`New pages need a restart`,summary:`These page files exist, but the running router does not know them yet.`},"hydration-error":{title:`Hydration error`,summary:`The browser DOM did not match the server HTML.`},"api-not-found":{title:`API call failed with 404 or 405`,summary:`A request hit a path or method that no server route handles.`}},Rj={ssr:`SSR`,ssg:`Prerendered`,client:`Client only`},zj={all:`All`,page:`Pages`,load:`load()`,fn:`Server fn`,api:`API`};function Bj(e,t,n){return e?e.scope(`ng-devtools`).rpc.call(t,...n===void 0?[]:[n]).then(e=>e,()=>null):Promise.resolve(null)}function Vj(e,t=0,n=[]){for(let r of e)n.push({route:r,depth:t}),Vj(r.children,t+1,n);return n}var Hj=class e{rpc=k_(null);kinds=[`all`,`page`,`load`,`fn`,`api`];methods=[`GET`,`POST`,`PUT`,`PATCH`,`DELETE`];view=F(`routes`);project=F(null);state=F({});findings=F([]);renderRows=F([]);plan=F(null);filter=F(``);testUrl=F(``);match=F(null);kind=F(`all`);method=F(`GET`);apiPath=F(``);apiBody=F(``);confirmSend=F(!1);response=F(null);unsubscribe=null;refreshTimer;refreshRun=0;destroyRef=A(fs);page=$(()=>this.state().pages?.[0]??null);openFiles=$(()=>new Set((this.page()?.chain??[]).map(e=>e.file)));allCalls=$(()=>this.state().calls??[]);calls=$(()=>{let e=this.kind();return this.allCalls().filter(t=>e===`all`||t.kind===e).slice(-150).reverse()});allRoutes=$(()=>Vj(this.project()?.routes??[]));pageCount=$(()=>this.allRoutes().filter(e=>e.route.file&&e.route.kind!==`layout`).length);routeRows=$(()=>{let e=this.filter().trim().toLowerCase();return e?this.allRoutes().filter(t=>t.route.fullPath.toLowerCase().includes(e)||!!t.route.file?.toLowerCase().includes(e)):this.allRoutes()});duplicates=$(()=>{let e=new Map,t=new Set;for(let n of this.allCalls()){if(n.kind!==`load`)continue;let r=n.url.replace(/^.*\/_analog\/pages/,``).replace(/\/index$/,``)||`/`;n.from===`ssr`?e.set(r,n.at):n.from===`browser`&&(e.get(r)??-1/0)>n.at-15e3&&t.add(r)}return Array.from(t)});modeCounts=$(()=>[`ssr`,`ssg`,`client`].map(e=>({mode:e,label:Rj[e],count:this.renderRows().filter(t=>t.mode===e).length})).filter(e=>e.count));lintCards=$(()=>{let e={error:0,warning:1,info:2},t=new Map;for(let e of this.findings()){let n=t.get(e.rule);if(!n){let r=Lj[e.rule];n={rule:e.rule,severity:e.severity,title:r?.title??e.rule,summary:r?.summary??e.message,fix:e.fix,items:[]},t.set(e.rule,n)}n.items.push({file:e.file,path:e.path})}return Array.from(t.values()).sort((t,n)=>e[t.severity]-e[n.severity])});views=$(()=>{let e=this.findings().length;return[{id:`routes`,label:`Routes`,count:this.pageCount(),tone:``},{id:`server`,label:`Server`,count:this.allCalls().length,tone:``},{id:`render`,label:`Render`,count:this.renderRows().length,tone:``},{id:`content`,label:`Content`,count:this.project()?.content.length??0,tone:``},{id:`lint`,label:`Lint`,count:e,tone:e?`warn`:``}]});constructor(){$s(()=>{let e=this.rpc();e&&x_(()=>void this.load(e))}),$s(()=>{let e=this.view();this.state(),x_(()=>this.scheduleRefresh(e))}),this.destroyRef.onDestroy(()=>{this.unsubscribe?.(),clearTimeout(this.refreshTimer)})}async load(e){this.project.set(await Bj(e,`analog-project`));try{let t=await e.scope(`ng-devtools`).rpc.sharedState(`analog`),n=e=>this.state.set(e??{});n(t.value()),this.unsubscribe?.(),this.unsubscribe=t.on(`updated`,n)}catch{this.state.set({})}await this.refresh(this.view())}scheduleRefresh(e){clearTimeout(this.refreshTimer),this.refreshTimer=setTimeout(()=>void this.refresh(e),300)}async refresh(e){let t=this.rpc();if(!t)return;let n=++this.refreshRun,[r,i]=await Promise.all([Bj(t,`analog-lint`),Bj(t,`analog-render`)]);if(n===this.refreshRun&&(this.findings.set(r??[]),this.renderRows.set(i?.rows??[]),this.plan.set(i?.plan??null),e===`routes`||e===`content`)){let e=await Bj(t,`analog-project`);e&&n===this.refreshRun&&this.project.set(e)}}isOpen(e){return!!e.file&&this.openFiles().has(e.file)}kindText(e){return e.catchAll?e.catchAll===`optional`?`optional catch-all`:`catch-all`:e.kind===`implicit`?`folder`:e.kind}serverExports(e){return(e.serverExports??[]).filter(e=>e===`load`||e===`action`)}short(e){return e?.replace(/^\/src\/app\//,``).replace(/^\//,``)}dir(e){let t=this.short(e)??e;return t.includes(`/`)?t.slice(0,t.lastIndexOf(`/`)+1):``}base(e){return e.slice(e.lastIndexOf(`/`)+1)}paramList(e){return Object.entries(e)}kindLabel(e){return zj[e]}kindCount(e){return e===`all`?this.allCalls().length:this.allCalls().filter(t=>t.kind===e).length}modeLabel(e){return Rj[e]}mismatch(e){return e.last?.render?e.mode===`client`?e.last.render!==`client`:e.last.render===`client`:!1}statusClass(e){return e>=500||e===0?`bad`:e>=400?`warn`:`good`}tone(e){return e===`error`?`bad`:e===`warning`?`warn`:`info`}shadowed(e){return this.findings().find(t=>t.rule===`content-shadows-page`&&t.file===e)?.message.match(/(\/\S+\.page\.ts)/)?.[1]}contentUrl(e){return this.allRoutes().find(t=>t.route.file===e)?.route.fullPath}pretty(e){try{return JSON.stringify(JSON.parse(e),null,2)}catch{return e}}time(e){return new Date(e).toLocaleTimeString()}tryApi(e){this.method.set(e.method===`ANY`?`GET`:e.method),this.apiPath.set(e.path.replace(/:(\w+)/g,`1`).replace(`**`,`x`)),this.response.set(null),queueMicrotask(()=>document.getElementById(`api-path`)?.focus())}async explain(){let e=this.testUrl().trim();e&&this.match.set(await Bj(this.rpc(),`analog-explain-url`,e))}async send(){let e=this.apiPath().trim();if(!e)return;let t;if(this.method()!==`GET`&&this.apiBody().trim())try{t=JSON.parse(this.apiBody())}catch{this.response.set({error:`The body is not valid JSON.`});return}let n=await Bj(this.rpc(),`analog-call-api`,{method:this.method(),path:e,body:t,confirm:this.confirmSend()});this.response.set(n??{error:`No answer from the devtools server.`})}onKey(e){let t=this.views().map(e=>e.id),n=t.indexOf(this.view()),r=n;if(e.key===`ArrowRight`)r=(n+1)%t.length;else if(e.key===`ArrowLeft`)r=(n-1+t.length)%t.length;else if(e.key===`Home`)r=0;else if(e.key===`End`)r=t.length-1;else return;e.preventDefault(),this.view.set(t[r]);let i=e.currentTarget;queueMicrotask(()=>i.querySelector(`#analog-tab-${t[r]}`)?.focus())}static ɵfac=function(t){return new(t||e)};static ɵcmp=nm({type:e,selectors:[[`app-analog-inspector`]],inputs:{rpc:[1,`rpc`]},decls:3,vars:1,consts:[[1,`muted`,`pad`],[1,`empty`],[1,`muted`],[`aria-label`,`Analog summary`,1,`summary`],[1,`stat`],[1,`label`],[1,`value`],[1,`stat`,`wide`],[`role`,`tablist`,`aria-label`,`Analog views`,1,`tabs`,3,`keydown`],[`type`,`button`,`role`,`tab`,3,`id`],[`role`,`tabpanel`,1,`panel`,3,`id`],[1,`value`,`mono`],[`type`,`button`,`role`,`tab`,3,`click`,`id`],[1,`count`],[1,`toolbar`],[1,`inline`,3,`submit`],[`for`,`analog-url`],[`id`,`analog-url`,`type`,`text`,`placeholder`,`/products/42`,1,`field`,3,`input`,`value`],[`type`,`submit`,1,`btn`],[`for`,`route-filter`,1,`sr-only`],[`id`,`route-filter`,`type`,`search`,`placeholder`,`Filter by path or file`,1,`field`,3,`input`,`value`],[`role`,`status`,1,`callout`],[`role`,`region`,`aria-label`,`File routes`,`tabindex`,`0`,1,`table-wrap`],[`scope`,`col`],[3,`open`,`dim`],[1,`chain`],[1,`chips`],[1,`mono`],[1,`pill`],[1,`chip`,`mono`],[1,`plain`],[1,`route`],[`aria-hidden`,`true`,1,`guide`],[1,`mono`,`path`],[1,`pill`,`live`],[1,`file`],[`data-kind`,`load`,1,`pill`],[1,`chip`],[1,`dir`],[`colspan`,`4`,1,`muted`],[`data-tone`,`warn`,`role`,`note`,1,`callout`],[1,`segmented`],[1,`sr-only`],[3,`on`],[`role`,`region`,`aria-label`,`Server calls`,`tabindex`,`0`,1,`table-wrap`],[`role`,`region`,`aria-label`,`API routes`,`tabindex`,`0`,1,`table-wrap`],[1,`card`,`playground`,3,`submit`],[1,`row`],[`for`,`api-method`,1,`sr-only`],[`id`,`api-method`,1,`field`,3,`change`,`value`],[3,`value`],[`for`,`api-path`,1,`sr-only`],[`id`,`api-path`,`type`,`text`,`placeholder`,`/api/v1/products`,1,`field`,`grow`,`mono`,3,`input`,`value`],[`role`,`status`,1,`response`],[`type`,`radio`,`name`,`analog-kind`,1,`sr-only`,3,`change`,`checked`],[`scope`,`col`,1,`num`],[1,`muted`,`nowrap`],[1,`request`],[1,`method`],[1,`status`],[1,`num`,`nowrap`],[1,`code`],[`type`,`button`,1,`btn`,`ghost`,3,`click`],[`for`,`api-body`],[`id`,`api-body`,`rows`,`3`,`placeholder`,`{"name": "Ada"}`,1,`field`,`mono`,3,`input`,`value`],[1,`check`],[`type`,`checkbox`,3,`change`,`checked`],[`data-status`,`bad`,1,`status`],[`role`,`region`,`aria-label`,`Render modes`,`tabindex`,`0`,1,`table-wrap`],[1,`card`],[1,`muted`,`small`],[`data-tone`,`warn`,1,`pill`],[1,`facts`],[`data-tone`,`warn`,1,`chip`,`mono`],[`data-tone`,`bad`,1,`chip`,`mono`],[`role`,`region`,`aria-label`,`Content files`,`tabindex`,`0`,1,`table-wrap`],[`data-tone`,`bad`,1,`pill`],[`data-tone`,`good`,1,`callout`],[1,`findings`],[1,`finding-head`],[1,`finding-title`],[1,`where`],[1,`fix`],[1,`rule`,`mono`]],template:function(e,t){e&1&&R(0,vA,2,0,`p`,0)(1,yA,14,0,`div`,1)(2,Ij,36,10),e&2&&z(t.project()===null?0:t.project().analog?2:1)},styles:[`[_nghost-%COMP%] {
      --%NS%good: #4ade80;
      --%NS%warn: #facc15;
      --%NS%bad: #f87171;
      --%NS%info: #60a5fa;
      --%NS%line: #27272a;
      --%NS%soft: #18181b;
      display: grid;
      gap: 14px;
      color: #e4e4e7;
      font-size: 13px;
    }
    .pad[_ngcontent-%COMP%] {
      padding: 16px;
    }
    .mono[_ngcontent-%COMP%] {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
    }
    .muted[_ngcontent-%COMP%] {
      color: #a1a1aa;
    }
    .small[_ngcontent-%COMP%] {
      font-size: 12px;
    }
    .pill[_ngcontent-%COMP%]    + .small[_ngcontent-%COMP%], 
   .status[_ngcontent-%COMP%]    + .small[_ngcontent-%COMP%] {
      margin-left: 8px;
    }
    .nowrap[_ngcontent-%COMP%] {
      white-space: nowrap;
    }
    .summary[_ngcontent-%COMP%] {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 10px;
    }
    .stat[_ngcontent-%COMP%] {
      display: grid;
      gap: 2px;
      padding: 10px 12px;
      border: 1px solid var(--%NS%line);
      border-radius: 10px;
      background: var(--%NS%soft);
    }
    .stat.wide[_ngcontent-%COMP%] {
      grid-column: span 2;
    }
    .stat[_ngcontent-%COMP%]   .label[_ngcontent-%COMP%] {
      color: #a1a1aa;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .stat[_ngcontent-%COMP%]   .value[_ngcontent-%COMP%] {
      font-size: 18px;
      font-weight: 600;
      overflow-wrap: anywhere;
    }
    .stat[_ngcontent-%COMP%]   .value.mono[_ngcontent-%COMP%] {
      font-size: 14px;
    }
    .stat[data-tone='warn'][_ngcontent-%COMP%]   .value[_ngcontent-%COMP%] {
      color: var(--%NS%warn);
    }
    .stat[data-tone='good'][_ngcontent-%COMP%]   .value[_ngcontent-%COMP%] {
      color: var(--%NS%good);
    }
    .tabs[_ngcontent-%COMP%] {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      border-bottom: 1px solid var(--%NS%line);
    }
    [role='tab'][_ngcontent-%COMP%] {
      display: inline-flex;
      gap: 6px;
      align-items: center;
      padding: 8px 12px;
      border: none;
      border-bottom: 2px solid transparent;
      background: none;
      color: #d4d4d8;
      font: inherit;
      cursor: pointer;
    }
    [role='tab'][aria-selected='true'][_ngcontent-%COMP%] {
      border-bottom-color: var(--%NS%accent);
      color: #fafafa;
    }
    .count[_ngcontent-%COMP%] {
      min-width: 18px;
      padding: 0 6px;
      border-radius: 999px;
      background: #27272a;
      color: #d4d4d8;
      font-size: 11px;
      text-align: center;
    }
    .count[data-tone='warn'][_ngcontent-%COMP%] {
      background: #422006;
      color: var(--%NS%warn);
    }
    .panel[_ngcontent-%COMP%] {
      display: grid;
      gap: 12px;
      min-width: 0;
    }
    .toolbar[_ngcontent-%COMP%] {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      justify-content: space-between;
    }
    .inline[_ngcontent-%COMP%], 
   .row[_ngcontent-%COMP%] {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .field[_ngcontent-%COMP%] {
      padding: 6px 10px;
      border: 1px solid #3f3f46;
      border-radius: 8px;
      background: var(--%NS%soft);
      color: #e4e4e7;
      font: inherit;
    }
    textarea.field[_ngcontent-%COMP%] {
      width: 100%;
      box-sizing: border-box;
      resize: vertical;
    }
    .grow[_ngcontent-%COMP%] {
      flex: 1;
      min-width: 180px;
    }
    .btn[_ngcontent-%COMP%] {
      padding: 6px 12px;
      border: 1px solid #52525b;
      border-radius: 8px;
      background: #27272a;
      color: #fafafa;
      font: inherit;
      cursor: pointer;
    }
    .btn[_ngcontent-%COMP%]:hover {
      border-color: var(--%NS%accent);
    }
    .btn.ghost[_ngcontent-%COMP%] {
      padding: 2px 10px;
      background: transparent;
    }
    [role='tab'][_ngcontent-%COMP%]:focus-visible, 
   .btn[_ngcontent-%COMP%]:focus-visible, 
   .field[_ngcontent-%COMP%]:focus-visible, 
   .table-wrap[_ngcontent-%COMP%]:focus-visible, 
   summary[_ngcontent-%COMP%]:focus-visible, 
   .segmented[_ngcontent-%COMP%]   label[_ngcontent-%COMP%]:focus-within {
      outline: 2px solid var(--%NS%accent);
      outline-offset: 2px;
    }
    .callout[_ngcontent-%COMP%] {
      padding: 10px 12px;
      border: 1px solid var(--%NS%line);
      border-left: 3px solid var(--%NS%info);
      border-radius: 8px;
      background: var(--%NS%soft);
      line-height: 1.6;
    }
    .callout[data-tone='good'][_ngcontent-%COMP%] {
      border-left-color: var(--%NS%good);
    }
    .callout[data-tone='warn'][_ngcontent-%COMP%] {
      border-left-color: var(--%NS%warn);
    }
    .callout[data-tone='bad'][_ngcontent-%COMP%] {
      border-left-color: var(--%NS%bad);
    }
    .chain[_ngcontent-%COMP%] {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin: 6px 0 0;
      padding: 0;
      list-style: none;
    }
    .chain[_ngcontent-%COMP%]   li[_ngcontent-%COMP%]:not(:last-child)::after {
      content: '›';
      margin-left: 6px;
      color: #71717a;
    }
    .plain[_ngcontent-%COMP%] {
      margin: 6px 0 0;
      padding-left: 18px;
    }
    .table-wrap[_ngcontent-%COMP%] {
      overflow-x: auto;
      border: 1px solid var(--%NS%line);
      border-radius: 10px;
    }
    table[_ngcontent-%COMP%] {
      width: 100%;
      border-collapse: collapse;
    }
    th[_ngcontent-%COMP%], 
   td[_ngcontent-%COMP%] {
      padding: 8px 10px;
      border-bottom: 1px solid var(--%NS%line);
      text-align: left;
      vertical-align: top;
    }
    tbody[_ngcontent-%COMP%]   tr[_ngcontent-%COMP%]:last-child   td[_ngcontent-%COMP%] {
      border-bottom: none;
    }
    th[_ngcontent-%COMP%] {
      background: var(--%NS%soft);
      color: #a1a1aa;
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .num[_ngcontent-%COMP%] {
      text-align: right;
    }
    tbody[_ngcontent-%COMP%]   tr[_ngcontent-%COMP%]:hover   td[_ngcontent-%COMP%] {
      background: #141417;
    }
    tr.open[_ngcontent-%COMP%]   td[_ngcontent-%COMP%] {
      background: #1c1917;
    }
    tr.open[_ngcontent-%COMP%]   td[_ngcontent-%COMP%]:first-child {
      box-shadow: inset 3px 0 0 var(--%NS%accent);
    }
    tr.dim[_ngcontent-%COMP%]   .path[_ngcontent-%COMP%] {
      color: #a1a1aa;
    }
    .route[_ngcontent-%COMP%] {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      align-items: center;
    }
    .guide[_ngcontent-%COMP%] {
      color: #52525b;
    }
    .path[_ngcontent-%COMP%] {
      color: #f0abfc;
    }
    .file[_ngcontent-%COMP%] {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      color: #e4e4e7;
      overflow-wrap: anywhere;
    }
    .dir[_ngcontent-%COMP%] {
      color: #a1a1aa;
    }
    .pill[_ngcontent-%COMP%], 
   .chip[_ngcontent-%COMP%], 
   .status[_ngcontent-%COMP%], 
   .method[_ngcontent-%COMP%] {
      display: inline-block;
      padding: 1px 8px;
      border-radius: 999px;
      font-size: 11px;
      line-height: 18px;
      white-space: nowrap;
    }
    .pill[_ngcontent-%COMP%], 
   .chip[_ngcontent-%COMP%] {
      border: 1px solid #3f3f46;
      color: #d4d4d8;
    }
    .chip[_ngcontent-%COMP%] {
      border-radius: 6px;
      margin: 0 4px 4px 0;
    }
    .chips[_ngcontent-%COMP%] {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .pill.live[_ngcontent-%COMP%] {
      border-color: var(--%NS%accent);
      color: #fda4af;
    }
    .pill[data-kind='layout'][_ngcontent-%COMP%] {
      border-color: #6366f1;
      color: #c7d2fe;
    }
    .pill[data-kind='markdown'][_ngcontent-%COMP%] {
      border-color: #0ea5e9;
      color: #bae6fd;
    }
    .pill[data-kind='load'][_ngcontent-%COMP%] {
      border-color: #a855f7;
      color: #e9d5ff;
    }
    .pill[data-mode='ssr'][_ngcontent-%COMP%] {
      border-color: #3b82f6;
      color: #bfdbfe;
    }
    .pill[data-mode='ssg'][_ngcontent-%COMP%] {
      border-color: #22c55e;
      color: #bbf7d0;
    }
    .pill[data-mode='client'][_ngcontent-%COMP%] {
      border-color: #eab308;
      color: #fef08a;
    }
    .pill[data-call='page'][_ngcontent-%COMP%] {
      border-color: #3b82f6;
      color: #bfdbfe;
    }
    .pill[data-call='load'][_ngcontent-%COMP%] {
      border-color: #a855f7;
      color: #e9d5ff;
    }
    .pill[data-call='fn'][_ngcontent-%COMP%] {
      border-color: #14b8a6;
      color: #99f6e4;
    }
    .pill[data-call='api'][_ngcontent-%COMP%] {
      border-color: #f97316;
      color: #fed7aa;
    }
    [data-tone='warn'].pill[_ngcontent-%COMP%], 
   [data-tone='warn'].chip[_ngcontent-%COMP%] {
      border-color: #a16207;
      color: #fef08a;
    }
    [data-tone='bad'].pill[_ngcontent-%COMP%], 
   [data-tone='bad'].chip[_ngcontent-%COMP%] {
      border-color: #b91c1c;
      color: #fecaca;
    }
    [data-tone='info'].pill[_ngcontent-%COMP%] {
      border-color: #1d4ed8;
      color: #bfdbfe;
    }
    .status[_ngcontent-%COMP%] {
      font-weight: 600;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .status[data-status='good'][_ngcontent-%COMP%] {
      background: #052e16;
      color: #86efac;
    }
    .status[data-status='warn'][_ngcontent-%COMP%] {
      background: #422006;
      color: #fde68a;
    }
    .status[data-status='bad'][_ngcontent-%COMP%] {
      background: #450a0a;
      color: #fecaca;
    }
    .method[_ngcontent-%COMP%] {
      min-width: 44px;
      margin-right: 6px;
      background: #27272a;
      color: #e4e4e7;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-weight: 600;
      text-align: center;
    }
    .method[data-method='GET'][_ngcontent-%COMP%] {
      background: #082f49;
      color: #7dd3fc;
    }
    .method[data-method='POST'][_ngcontent-%COMP%] {
      background: #052e16;
      color: #86efac;
    }
    .method[data-method='PUT'][_ngcontent-%COMP%], 
   .method[data-method='PATCH'][_ngcontent-%COMP%] {
      background: #422006;
      color: #fde68a;
    }
    .method[data-method='DELETE'][_ngcontent-%COMP%] {
      background: #450a0a;
      color: #fecaca;
    }
    .request[_ngcontent-%COMP%] {
      min-width: 260px;
    }
    .request[_ngcontent-%COMP%]   .pill[_ngcontent-%COMP%] {
      margin-left: 6px;
    }
    details[_ngcontent-%COMP%] {
      margin-top: 6px;
    }
    summary[_ngcontent-%COMP%] {
      cursor: pointer;
      color: #a1a1aa;
      font-size: 12px;
    }
    .code[_ngcontent-%COMP%] {
      margin: 6px 0 0;
      padding: 8px 10px;
      max-height: 220px;
      overflow: auto;
      border-radius: 8px;
      background: #09090b;
      color: #e4e4e7;
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 12px;
      white-space: pre-wrap;
      overflow-wrap: anywhere;
    }
    .segmented[_ngcontent-%COMP%] {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 2px;
      margin: 0;
      padding: 3px;
      border: 1px solid var(--%NS%line);
      border-radius: 10px;
      background: var(--%NS%soft);
      justify-self: start;
    }
    .segmented[_ngcontent-%COMP%]   label[_ngcontent-%COMP%] {
      padding: 4px 10px;
      border-radius: 7px;
      cursor: pointer;
    }
    .segmented[_ngcontent-%COMP%]   label.on[_ngcontent-%COMP%] {
      background: #3f3f46;
      color: #fafafa;
    }
    .segmented[_ngcontent-%COMP%]   label.on[_ngcontent-%COMP%]   .muted[_ngcontent-%COMP%] {
      color: #d4d4d8;
    }
    h3[_ngcontent-%COMP%] {
      display: flex;
      gap: 8px;
      align-items: center;
      margin: 6px 0 0;
      color: #e4e4e7;
      font-size: 13px;
    }
    .card[_ngcontent-%COMP%] {
      display: grid;
      gap: 8px;
      padding: 12px;
      border: 1px solid var(--%NS%line);
      border-radius: 10px;
      background: var(--%NS%soft);
    }
    .card[_ngcontent-%COMP%]   h3[_ngcontent-%COMP%] {
      margin: 0;
    }
    .check[_ngcontent-%COMP%] {
      display: flex;
      gap: 6px;
      align-items: center;
    }
    .response[_ngcontent-%COMP%] {
      display: grid;
      gap: 6px;
    }
    .facts[_ngcontent-%COMP%] {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 6px 14px;
      margin: 0;
    }
    .facts[_ngcontent-%COMP%]   dt[_ngcontent-%COMP%] {
      color: #a1a1aa;
    }
    .facts[_ngcontent-%COMP%]   dd[_ngcontent-%COMP%] {
      margin: 0;
    }
    .findings[_ngcontent-%COMP%] {
      display: grid;
      gap: 8px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .findings[_ngcontent-%COMP%]   li[_ngcontent-%COMP%] {
      padding: 10px 12px;
      border: 1px solid var(--%NS%line);
      border-left: 3px solid var(--%NS%info);
      border-radius: 8px;
      background: var(--%NS%soft);
    }
    .findings[_ngcontent-%COMP%]   li[data-tone='bad'][_ngcontent-%COMP%] {
      border-left-color: var(--%NS%bad);
    }
    .findings[_ngcontent-%COMP%]   li[data-tone='warn'][_ngcontent-%COMP%] {
      border-left-color: var(--%NS%warn);
    }
    .findings[_ngcontent-%COMP%]   p[_ngcontent-%COMP%] {
      margin: 6px 0 0;
      line-height: 1.5;
    }
    .finding-head[_ngcontent-%COMP%] {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .finding-title[_ngcontent-%COMP%] {
      font-size: 14px;
      color: #fafafa;
    }
    .where[_ngcontent-%COMP%] {
      display: grid;
      gap: 4px;
      margin: 8px 0 0;
      padding: 8px 10px;
      border-radius: 8px;
      background: #0f0f11;
      list-style: none;
    }
    .where[_ngcontent-%COMP%]   li[_ngcontent-%COMP%] {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
    }
    .fix[_ngcontent-%COMP%] {
      margin-top: 8px;
      color: #e4e4e7;
      line-height: 1.5;
    }
    .fix[_ngcontent-%COMP%]   strong[_ngcontent-%COMP%] {
      display: block;
      margin-bottom: 2px;
      color: var(--%NS%good);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    .rule[_ngcontent-%COMP%] {
      display: block;
      margin-top: 8px;
      color: #a1a1aa;
    }
    .findings[_ngcontent-%COMP%]    > li[_ngcontent-%COMP%]    > p[_ngcontent-%COMP%] {
      color: #d4d4d8;
    }
    .empty[_ngcontent-%COMP%] {
      padding: 32px;
      text-align: center;
    }
    .sr-only[_ngcontent-%COMP%] {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }`]})},Uj=(e,t)=>t.pageId,Wj=(e,t)=>t.id,Gj=(e,t)=>t.side+t.id,Kj=(e,t)=>t.key;function qj(e,t){e&1&&(W(0,`p`,0),X(1,`Loading…`),G())}function Jj(e,t){e&1&&(W(0,`p`,1),X(1,`Could not reach the devtools server.`),G())}function Yj(e,t){if(e&1&&(W(0,`option`,4),X(1),G()),e&2){let e=t.$implicit;q(`value`,e.pageId),I(),Z(e.title||e.url)}}function Xj(e,t){e&1&&(W(0,`option`,5),X(1,`No connected page`),G())}function Zj(e,t){e&1&&(W(0,`span`,33),X(1,`transfer cache`),G())}function Qj(e,t){e&1&&(W(0,`span`,37),X(1,`faulted`),G())}function $j(e,t){if(e&1){let e=K();W(0,`tr`,32),J(`click`,function(){let t=N(e).$implicit;return P(Y(2).selectedCallId.set(t.id))}),W(1,`td`)(2,`span`,33),X(3),G()(),W(4,`td`),X(5),G(),W(6,`td`,34)(7,`button`,35),J(`click`,function(){let t=N(e).$implicit;return P(Y(2).selectedCallId.set(t.id))}),X(8),G()(),W(9,`td`),X(10),G(),W(11,`td`),X(12),G(),W(13,`td`,36),R(14,Zj,2,0,`span`,33),R(15,Qj,2,0,`span`,37),G()()}if(e&2){let e=t.$implicit;jg(`selected`,Y(2).selectedCall()?.id===e.id),I(2),jg(`server`,e.side===`server`),I(),Z(e.side===`server`?`SSR`:`Client`),I(2),Z(e.method),I(3),Q(` `,e.url,` `),I(),jg(`bad`,e.status===0||e.status>=400),I(),Q(` `,e.status||`ERR`,` `),I(2),Q(``,e.durationMs,` ms`),I(2),z(e.cacheHit?14:-1),I(),z(e.faulted?15:-1)}}function eM(e,t){if(e&1&&(W(0,`div`,11)(1,`table`)(2,`thead`)(3,`tr`)(4,`th`,30),X(5,`Side`),G(),W(6,`th`,30),X(7,`Method`),G(),W(8,`th`,30),X(9,`URL`),G(),W(10,`th`,30),X(11,`Status`),G(),W(12,`th`,30),X(13,`Time`),G(),W(14,`th`,30),X(15,`Notes`),G()()(),W(16,`tbody`),B(17,$j,16,13,`tr`,31,Gj),G()()()),e&2){let e=Y();I(17),V(e.timeline())}}function tM(e,t){e&1&&(W(0,`p`,0),X(1,` No requests yet. Add `),W(2,`code`),X(3,`withNgDevtools()`),G(),X(4,` to `),W(5,`code`),X(6,`provideHttpClient`),G(),X(7,`. `),G())}function nM(e,t){if(e&1&&(W(0,`h4`),X(1,`Response preview`),G(),W(2,`pre`),X(3),G()),e&2){let e=t;I(3),Z(e.error??e.preview??`(no body)`)}}function rM(e,t){if(e&1&&X(0),e&2){let e=Y().$implicit;Q(` · `,e.delayMs,` ms `)}}function iM(e,t){e&1&&X(0,` · mock body `)}function aM(e,t){if(e&1){let e=K();W(0,`li`)(1,`label`,38)(2,`input`,39),J(`change`,function(){let t=N(e).$implicit;return P(Y().toggleRule(t.id))}),G(),W(3,`code`),X(4),G()(),W(5,`span`,40),X(6),R(7,rM,1,1),R(8,iM,1,0),G(),W(9,`button`,35),J(`click`,function(){let t=N(e).$implicit;return P(Y().removeRule(t.id))}),X(10,` Remove `),G()()}if(e&2){let e=t.$implicit;I(2),q(`checked`,e.enabled),L(`aria-label`,`Enable rule for `+e.pattern),I(2),n_(``,e.method||`ANY`,` `,e.pattern),I(2),n_(` `,e.target,` · `,e.status??200,` `),I(),z(e.delayMs?7:-1),I(),z(e.body?8:-1),I(),L(`aria-label`,`Remove rule for `+e.pattern)}}function oM(e,t){e&1&&(W(0,`li`,0),X(1,`No rules. SSR rules apply on the next page load.`),G())}function sM(e,t){if(e&1&&(W(0,`li`)(1,`code`),X(2),G()()),e&2){let e=t.$implicit;I(2),Z(e)}}function cM(e,t){if(e&1&&(W(0,`h4`),X(1,`ngSkipHydration hosts`),G(),W(2,`ul`,42),B(3,sM,3,1,`li`,null,jh),G()),e&2){let e=Y();I(3),V(e.skipHydrationHosts)}}function lM(e,t){if(e&1&&(W(0,`pre`,41),X(1),G()),e&2){let e=t.$implicit;I(),Z(e)}}function uM(e,t){e&1&&(W(0,`p`,40),X(1,`No hydration warnings.`),G())}function dM(e,t){if(e&1&&(W(0,`dl`)(1,`dt`),X(2,`Enabled`),G(),W(3,`dd`),X(4),G(),W(5,`dt`),X(6,`Hydrated components`),G(),W(7,`dd`),X(8),G(),W(9,`dt`),X(10,`Hydrated nodes`),G(),W(11,`dd`),X(12),G(),W(13,`dt`),X(14,`Skipped components`),G(),W(15,`dd`),X(16),G(),W(17,`dt`),X(18,`Incremental defer blocks`),G(),W(19,`dd`),X(20),G()(),R(21,cM,5,0),W(22,`h4`),X(23),G(),B(24,lM,2,1,`pre`,41,jh,!1,uM,2,0,`p`,40)),e&2){let e=t;I(4),Z(e.enabled?`yes`:`no (client render only)`),I(4),Z(e.hydratedComponents??`n/a`),I(4),Z(e.hydratedNodes??`n/a`),I(4),Z(e.componentsSkippedHydration??`n/a`),I(4),Z(e.deferBlocksWithIncrementalHydration??`n/a`),I(),z(e.skipHydrationHosts.length?21:-1),I(2),Q(`Warnings (`,e.warnings.length,`)`),I(),V(e.warnings)}}function fM(e,t){e&1&&(W(0,`p`,0),X(1,`No hydration data for this page.`),G())}function pM(e,t){e&1&&(W(0,`p`,0),X(1,`No TransferState script: this page was not server rendered.`),G())}function mM(e,t){if(e&1&&(W(0,`p`,43),X(1),G()),e&2){let e=Y(2);I(),Z(e.error)}}function hM(e,t){if(e&1&&(W(0,`span`,44),X(1),G(),X(2)),e&2){let e=t,n=Y().$implicit;I(),Q(`HTTP `,e.status),I(),Q(` `,e.url??n.key,` `)}}function gM(e,t){if(e&1&&X(0),e&2){let e=Y().$implicit;Q(` `,e.key,` `)}}function _M(e,t){if(e&1&&(W(0,`details`)(1,`summary`),R(2,hM,3,2)(3,gM,1,1),W(4,`span`,40),X(5),G()(),W(6,`pre`),X(7),u_(8,`json`),G()()),e&2){let e,n=t.$implicit;I(2),z((e=n.http)?2:3,e),I(3),Q(``,n.size,` B`),I(2),Z(f_(8,3,n.value))}}function vM(e,t){if(e&1&&(W(0,`p`,40),X(1),G(),R(2,mM,2,1,`p`,43),B(3,_M,9,5,`details`,null,Kj)),e&2){let e=Y();I(),r_(` `,e.entries.length,` entr`,e.entries.length===1?`y`:`ies`,`, `,e.size,` bytes `),I(),z(e.error?2:-1),I(),V(e.entries)}}function yM(e,t){e&1&&R(0,pM,2,0,`p`,0)(1,vM,5,4),e&2&&z(+!!t.found)}function bM(e,t){e&1&&(W(0,`p`,0),X(1,`Open a page of the app to see its payload.`),G())}var xM={pattern:`/api/products`,method:``,target:`both`,status:`500`,delayMs:``,body:``};function SM(e,t,n){return e?e.scope(`ng-devtools`).rpc.call(t,...n===void 0?[]:[n]):Promise.resolve(null)}var CM=class e{rpc=k_(null);loading=F(!1);failed=F(!1);serverCalls=F([]);pages=F([]);rules=F([]);selectedPageId=F(null);selectedCallId=F(null);draft=F({...xM});message=F(``);unsubscribe=null;destroyRef=A(fs);selected=$(()=>{let e=this.pages();return e.find(e=>e.pageId===this.selectedPageId())??e[0]??null});timeline=$(()=>[...this.serverCalls(),...this.selected()?.calls??[]].sort((e,t)=>t.at-e.at));selectedCall=$(()=>this.timeline().find(e=>e.id===this.selectedCallId())??null);bodyError=$(()=>{let e=this.draft().body.trim();if(!e)return``;try{return JSON.parse(e),``}catch{return`The mock body must be valid JSON.`}});constructor(){$s(()=>{let e=this.rpc();e&&this.load(e)}),this.destroyRef.onDestroy(()=>this.unsubscribe?.())}async load(e){this.loading.set(!0),this.failed.set(!1);try{let t=await e.scope(`ng-devtools`).rpc.sharedState(`http`);if(this.destroyRef.destroyed)return;let n=e=>{let t=e;this.serverCalls.set(t?.serverCalls??[]),this.pages.set(t?.pages??[]),this.rules.set(t?.rules??[])};n(t.value()),this.unsubscribe?.(),this.unsubscribe=t.on(`updated`,n)}catch{this.failed.set(!0)}finally{this.loading.set(!1)}}selectPage(e){this.selectedPageId.set(e.target.value||null),this.selectedCallId.set(null)}patch(e,t){let n=t.target.value;this.draft.update(t=>({...t,[e]:n}))}addRule(e){e.preventDefault();let t=this.draft();if(!t.pattern.trim()||this.bodyError())return;let n=Number(t.status),r=Number(t.delayMs),i={id:`r${Date.now().toString(36)}${Math.random().toString(36).slice(2,6)}`,pattern:t.pattern.trim(),enabled:!0,target:t.target,...t.method?{method:t.method}:{},...t.status&&Number.isFinite(n)?{status:n}:{},...t.delayMs&&Number.isFinite(r)?{delayMs:r}:{},...t.body.trim()?{body:t.body.trim()}:{}};this.saveRules([...this.rules(),i],`Rule added.`)}toggleRule(e){this.saveRules(this.rules().map(t=>t.id===e?{...t,enabled:!t.enabled}:t),`Rule updated.`)}removeRule(e){this.saveRules(this.rules().filter(t=>t.id!==e),`Rule removed.`)}async clearCalls(){try{await SM(this.rpc(),`clear-http-calls`),this.selectedCallId.set(null),this.message.set(`Timeline cleared.`)}catch{this.message.set(`Could not clear the timeline.`)}}async saveRules(e,t){try{await SM(this.rpc(),`set-http-rules`,e),this.rules.set(e),this.message.set(`${t} Reload the page to apply SSR rules.`)}catch{this.message.set(`Could not save the rules.`)}}static ɵfac=function(t){return new(t||e)};static ɵcmp=nm({type:e,selectors:[[`app-network-inspector`]],inputs:{rpc:[1,`rpc`]},decls:80,vars:19,consts:[[1,`muted`],[`role`,`alert`,1,`muted`],[1,`toolbar`],[3,`change`,`value`],[3,`value`],[`value`,``],[`type`,`button`,3,`click`],[`role`,`status`,1,`message`],[1,`grid`],[`aria-labelledby`,`timeline-heading`,1,`panel`,`wide`],[`id`,`timeline-heading`],[1,`table-wrap`],[`aria-labelledby`,`rules-heading`,1,`panel`],[`id`,`rules-heading`],[1,`rule-form`,3,`submit`],[`required`,``,`placeholder`,`/api/products`,3,`input`,`value`],[1,`row`],[`value`,`both`],[`value`,`server`],[`value`,`client`],[`type`,`number`,`min`,`100`,`max`,`599`,3,`input`,`value`],[`type`,`number`,`min`,`0`,`max`,`10000`,3,`input`,`value`],[`rows`,`3`,`aria-describedby`,`body-error`,3,`input`,`value`],[`id`,`body-error`,1,`bad`,`small`],[`type`,`submit`,3,`disabled`],[1,`rules`],[`aria-labelledby`,`hydration-heading`,1,`panel`],[`id`,`hydration-heading`],[`aria-labelledby`,`payload-heading`,1,`panel`,`wide`],[`id`,`payload-heading`],[`scope`,`col`],[3,`selected`],[3,`click`],[1,`tag`],[1,`url`],[`type`,`button`,1,`link`,3,`click`],[1,`notes`],[1,`tag`,`fault`],[1,`inline`],[`type`,`checkbox`,3,`change`,`checked`],[1,`muted`,`small`],[1,`warn`],[1,`plain`],[`role`,`alert`,1,`bad`],[1,`tag`,`server`]],template:function(e,t){if(e&1&&(R(0,qj,2,0,`p`,0)(1,Jj,2,0,`p`,1),W(2,`div`,2)(3,`label`),X(4,` Page `),W(5,`select`,3),J(`change`,function(e){return t.selectPage(e)}),B(6,Yj,2,2,`option`,4,Uj,!1,Xj,2,0,`option`,5),G()(),W(9,`button`,6),J(`click`,function(){return t.clearCalls()}),X(10,`Clear timeline`),G(),W(11,`p`,7),X(12),G()(),W(13,`div`,8)(14,`section`,9)(15,`h3`,10),X(16),G(),R(17,eM,19,0,`div`,11)(18,tM,8,0,`p`,0),R(19,nM,4,1),G(),W(20,`section`,12)(21,`h3`,13),X(22,`Fault injection`),G(),W(23,`form`,14),J(`submit`,function(e){return t.addRule(e)}),W(24,`label`),X(25,` URL pattern (substring or * glob) `),W(26,`input`,15),J(`input`,function(e){return t.patch(`pattern`,e)}),G()(),W(27,`div`,16)(28,`label`),X(29,` Method `),W(30,`select`,3),J(`change`,function(e){return t.patch(`method`,e)}),W(31,`option`,5),X(32,`Any`),G(),W(33,`option`),X(34,`GET`),G(),W(35,`option`),X(36,`POST`),G(),W(37,`option`),X(38,`PUT`),G(),W(39,`option`),X(40,`PATCH`),G(),W(41,`option`),X(42,`DELETE`),G()()(),W(43,`label`),X(44,` Apply on `),W(45,`select`,3),J(`change`,function(e){return t.patch(`target`,e)}),W(46,`option`,17),X(47,`SSR + client`),G(),W(48,`option`,18),X(49,`SSR only`),G(),W(50,`option`,19),X(51,`Client only`),G()()()(),W(52,`div`,16)(53,`label`),X(54,` Status `),W(55,`input`,20),J(`input`,function(e){return t.patch(`status`,e)}),G()(),W(56,`label`),X(57,` Delay (ms) `),W(58,`input`,21),J(`input`,function(e){return t.patch(`delayMs`,e)}),G()()(),W(59,`label`),X(60,` Mock JSON body (optional) `),W(61,`textarea`,22),J(`input`,function(e){return t.patch(`body`,e)}),G()(),W(62,`p`,23),X(63),G(),W(64,`button`,24),X(65,` Add rule `),G()(),W(66,`ul`,25),B(67,aM,11,9,`li`,null,Wj,!1,oM,2,0,`li`,0),G()(),W(70,`section`,26)(71,`h3`,27),X(72,`Hydration`),G(),R(73,dM,27,8)(74,fM,2,0,`p`,0),G(),W(75,`section`,28)(76,`h3`,29),X(77,`TransferState payload`),G(),R(78,yM,2,1)(79,bM,2,0,`p`,0),G()()),e&2){let e,n,r;z(t.loading()?0:t.failed()?1:-1),I(5),q(`value`,t.selected()?.pageId??``),I(),V(t.pages()),I(6),Z(t.message()),I(4),Q(`HTTP timeline (`,t.timeline().length,`)`),I(),z(t.timeline().length?17:18),I(2),z((e=t.selectedCall())?19:-1,e),I(7),q(`value`,t.draft().pattern),I(4),q(`value`,t.draft().method),I(15),q(`value`,t.draft().target),I(10),q(`value`,t.draft().status),I(3),q(`value`,t.draft().delayMs),I(3),q(`value`,t.draft().body),L(`aria-invalid`,t.bodyError()?`true`:null),I(2),Z(t.bodyError()),I(),q(`disabled`,!t.draft().pattern.trim()||!!t.bodyError()),I(3),V(t.rules()),I(6),z((n=t.selected()?.hydration)?73:74,n),I(5),z((r=t.selected()?.payload)?78:79,r)}},dependencies:[Wv],styles:[`[_nghost-%COMP%] {
      display: block;
      color: #e4e4e7;
      font-size: 13px;
    }
    .toolbar[_ngcontent-%COMP%] {
      display: flex;
      flex-wrap: wrap;
      align-items: end;
      gap: 12px;
      margin-bottom: 16px;
    }
    .grid[_ngcontent-%COMP%] {
      display: grid;
      gap: 16px;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    }
    .panel[_ngcontent-%COMP%] {
      padding: 14px;
      border: 1px solid #27272a;
      border-radius: 10px;
      background: #18181b;
      min-width: 0;
    }
    .wide[_ngcontent-%COMP%] {
      grid-column: 1 / -1;
    }
    h3[_ngcontent-%COMP%] {
      margin: 0 0 12px;
      font-size: 13px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #d4d4d8;
    }
    h4[_ngcontent-%COMP%] {
      margin: 12px 0 6px;
      font-size: 12px;
      color: #d4d4d8;
    }
    label[_ngcontent-%COMP%] {
      display: grid;
      gap: 4px;
      color: #a1a1aa;
      font-size: 12px;
    }
    label.inline[_ngcontent-%COMP%] {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #e4e4e7;
    }
    input[_ngcontent-%COMP%], 
   select[_ngcontent-%COMP%], 
   textarea[_ngcontent-%COMP%], 
   button[_ngcontent-%COMP%] {
      font: inherit;
      color: #e4e4e7;
    }
    input[_ngcontent-%COMP%]:not([type='checkbox']), 
   select[_ngcontent-%COMP%], 
   textarea[_ngcontent-%COMP%] {
      padding: 6px 8px;
      border: 1px solid #3f3f46;
      border-radius: 6px;
      background: #09090b;
    }
    button[_ngcontent-%COMP%] {
      padding: 6px 12px;
      border: 1px solid #3f3f46;
      border-radius: 6px;
      background: #27272a;
      cursor: pointer;
    }
    button[_ngcontent-%COMP%]:hover:not(:disabled) {
      background: #3f3f46;
    }
    button[_ngcontent-%COMP%]:disabled {
      opacity: 0.6;
      cursor: not-allowed;
    }
    button.link[_ngcontent-%COMP%] {
      padding: 0;
      border: none;
      background: none;
      color: #93c5fd;
      text-align: left;
      word-break: break-all;
    }
    [_ngcontent-%COMP%]:focus-visible {
      outline: 2px solid #93c5fd;
      outline-offset: 2px;
    }
    .message[_ngcontent-%COMP%] {
      margin: 0;
      color: #a1a1aa;
    }
    .muted[_ngcontent-%COMP%] {
      color: #a1a1aa;
    }
    .small[_ngcontent-%COMP%] {
      font-size: 12px;
    }
    .bad[_ngcontent-%COMP%] {
      color: #fca5a5;
    }
    .table-wrap[_ngcontent-%COMP%] {
      overflow-x: auto;
    }
    table[_ngcontent-%COMP%] {
      width: 100%;
      border-collapse: collapse;
    }
    th[_ngcontent-%COMP%], 
   td[_ngcontent-%COMP%] {
      padding: 6px 8px;
      border-bottom: 1px solid #27272a;
      text-align: left;
      vertical-align: top;
    }
    th[_ngcontent-%COMP%] {
      color: #a1a1aa;
      font-weight: 500;
    }
    tr.selected[_ngcontent-%COMP%]   td[_ngcontent-%COMP%] {
      background: #27272a;
    }
    td.url[_ngcontent-%COMP%] {
      max-width: 420px;
    }
    .notes[_ngcontent-%COMP%] {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .tag[_ngcontent-%COMP%] {
      display: inline-block;
      padding: 1px 6px;
      border-radius: 99px;
      background: #3f3f46;
      font-size: 11px;
      white-space: nowrap;
    }
    .tag.server[_ngcontent-%COMP%] {
      background: #1e3a8a;
      color: #dbeafe;
    }
    .tag.fault[_ngcontent-%COMP%] {
      background: #7f1d1d;
      color: #fee2e2;
    }
    pre[_ngcontent-%COMP%] {
      margin: 4px 0 0;
      padding: 8px;
      max-height: 240px;
      overflow: auto;
      border-radius: 6px;
      background: #09090b;
      color: #a1a1aa;
      font:
        12px ui-monospace,
        monospace;
      white-space: pre-wrap;
      word-break: break-all;
    }
    pre.warn[_ngcontent-%COMP%] {
      color: #fde68a;
    }
    .rule-form[_ngcontent-%COMP%] {
      display: grid;
      gap: 8px;
    }
    .row[_ngcontent-%COMP%] {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
    }
    .rules[_ngcontent-%COMP%], 
   .plain[_ngcontent-%COMP%] {
      display: grid;
      gap: 8px;
      margin: 12px 0 0;
      padding: 0;
      list-style: none;
    }
    .rules[_ngcontent-%COMP%]   li[_ngcontent-%COMP%] {
      display: grid;
      gap: 2px;
      padding: 8px;
      border: 1px solid #27272a;
      border-radius: 6px;
    }
    dl[_ngcontent-%COMP%] {
      display: grid;
      grid-template-columns: max-content 1fr;
      gap: 4px 12px;
      margin: 0;
    }
    dt[_ngcontent-%COMP%] {
      color: #a1a1aa;
    }
    dd[_ngcontent-%COMP%] {
      margin: 0;
    }
    details[_ngcontent-%COMP%] {
      border-bottom: 1px solid #27272a;
      padding: 6px 0;
    }
    summary[_ngcontent-%COMP%] {
      cursor: pointer;
      word-break: break-all;
    }`]})},wM=(e,t)=>t.id;function TM(e,t){if(e&1){let e=K();H(0,`button`,14),cg(`click`,function(){let t=N(e).$implicit;return P(Y().switchTab(t.id))}),X(1),U()}if(e&2){let e=t.$implicit;jg(`active`,Y().tab()===e.id),I(),Z(e.label)}}function EM(e,t){if(e&1){let e=K();H(0,`app-dashboard`,15),cg(`navigate`,function(t){return N(e),P(Y().switchTab(t))}),U()}e&2&&Vh(`rpc`,Y().rpc())}function DM(e,t){if(e&1){let e=K();H(0,`app-component-tree`,16),cg(`showForm`,function(t){return N(e),P(Y().showForm(t))}),U()}e&2&&Vh(`rpc`,Y().rpc())}function OM(e,t){e&1&&Wh(0,`app-route-inspector`,12),e&2&&Vh(`rpc`,Y().rpc())}function kM(e,t){e&1&&Wh(0,`app-signal-inspector`,12),e&2&&Vh(`rpc`,Y().rpc())}function AM(e,t){e&1&&Wh(0,`app-di-inspector`,12),e&2&&Vh(`rpc`,Y().rpc())}function jM(e,t){e&1&&Wh(0,`app-store-inspector`,12),e&2&&Vh(`rpc`,Y().rpc())}function MM(e,t){e&1&&Wh(0,`app-network-inspector`,12),e&2&&Vh(`rpc`,Y().rpc())}function NM(e,t){if(e&1){let e=K();H(0,`app-forms-inspector`,17),cg(`focusHandled`,function(){return N(e),P(Y().formFocus.set(null))}),U()}if(e&2){let e=Y();Vh(`rpc`,e.rpc())(`focus`,e.formFocus())}}function PM(e,t){e&1&&Wh(0,`app-analog-inspector`,12),e&2&&Vh(`rpc`,Y().rpc())}var FM=class e{analog=F(!1);allTabs=[{id:`dashboard`,label:`Dashboard`},{id:`analog`,label:`Analog`},{id:`components`,label:`Components`},{id:`routes`,label:`Routes`},{id:`signals`,label:`Signals`},{id:`injectors`,label:`Injectors`},{id:`store`,label:`Store`},{id:`forms`,label:`Forms`},{id:`network`,label:`SSR & HTTP`}];tabs=$(()=>this.allTabs.filter(e=>e.id!==`analog`||this.analog()));tab=F(`dashboard`);rpc=F(null);connected=F(!1);ngOnInit(){let e=new URLSearchParams(location.hash.replace(/^#/,``)).get(`tab`);e&&this.allTabs.some(t=>t.id===e)&&this.tab.set(e);let t=LM();mw(t?{baseURL:t}:{}).then(e=>{this.rpc.set(e),this.connected.set(!0),e.scope(`ng-devtools`).rpc.call(`analog-project`).then(e=>{let t=!!e?.analog;this.analog.set(t),!t&&this.tab()===`analog`&&this.tab.set(`dashboard`)},()=>{this.tab()===`analog`&&this.tab.set(`dashboard`)}),e.events.on(`connection:status`,e=>{this.connected.set(e===`connected`)})})}ngOnDestroy(){}formFocus=F(null);showForm(e){this.formFocus.set({id:e}),this.switchTab(`forms`)}switchTab(e){this.tab.set(e),history.replaceState(history.state,``,`#tab=${e}`)}static ɵfac=function(t){return new(t||e)};static ɵcmp=nm({type:e,selectors:[[`app-root`]],decls:29,vars:4,consts:[[1,`brand`],[`width`,`20`,`height`,`22`,`viewBox`,`0 0 223 236`,`fill`,`url(#ng-logo)`,`aria-hidden`,`true`],[`id`,`ng-logo`,`x1`,`49`,`x2`,`226`,`y1`,`214`,`y2`,`130`,`gradientUnits`,`userSpaceOnUse`],[`stop-color`,`#E40035`],[`offset`,`.24`,`stop-color`,`#F60A48`],[`offset`,`.352`,`stop-color`,`#F20755`],[`offset`,`.494`,`stop-color`,`#DC087D`],[`offset`,`.745`,`stop-color`,`#9717E7`],[`offset`,`1`,`stop-color`,`#6C00F5`],[`d`,`m222.077 39.192-8.019 125.923L137.387 0l84.69 39.192Zm-53.105 162.825-57.933 33.056-57.934-33.056 11.783-28.556h92.301l11.783 28.556ZM111.039 62.675l30.357 73.803H80.681l30.358-73.803ZM7.937 165.115 0 39.192 84.69 0 7.937 165.115Z`],[3,`active`],[1,`status`],[3,`rpc`],[3,`rpc`,`focus`],[3,`click`],[3,`navigate`,`rpc`],[3,`showForm`,`rpc`],[3,`focusHandled`,`rpc`,`focus`]],template:function(e,t){if(e&1&&(H(0,`header`)(1,`h1`,0),ts(),H(2,`svg`,1)(3,`defs`)(4,`linearGradient`,2),Wh(5,`stop`,3)(6,`stop`,4)(7,`stop`,5)(8,`stop`,6)(9,`stop`,7)(10,`stop`,8),U()(),Wh(11,`path`,9),U(),ns(),H(12,`span`),X(13,`Angular DevTools`),U()(),H(14,`nav`),B(15,TM,2,3,`button`,10,wM),U(),H(17,`span`,11),X(18),U()(),H(19,`main`),R(20,EM,1,1,`app-dashboard`,12)(21,DM,1,1,`app-component-tree`,12)(22,OM,1,1,`app-route-inspector`,12)(23,kM,1,1,`app-signal-inspector`,12)(24,AM,1,1,`app-di-inspector`,12)(25,jM,1,1,`app-store-inspector`,12)(26,MM,1,1,`app-network-inspector`,12)(27,NM,1,2,`app-forms-inspector`,13)(28,PM,1,1,`app-analog-inspector`,12),U()),e&2){let e;I(15),V(t.tabs()),I(2),jg(`connected`,t.connected()),I(),Q(` `,t.connected()?`Connected`:`Connecting…`,` `),I(2),z((e=t.tab())===`dashboard`?20:e===`components`?21:e===`routes`?22:e===`signals`?23:e===`injectors`?24:e===`store`?25:e===`network`?26:e===`forms`?27:e===`analog`?28:-1)}},dependencies:[gw,Lw,pD,VD,uO,kO,sA,Hj,CM],styles:[`[_nghost-%COMP%] {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    header[_ngcontent-%COMP%] {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 16px;
      padding: 8px 16px;
      background: #18181b;
      border-bottom: 1px solid #27272a;
    }
    .brand[_ngcontent-%COMP%] {
      margin: 0;
      font-size: inherit;
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      color: var(--%NS%accent);
    }
    .brand[_ngcontent-%COMP%]   span[_ngcontent-%COMP%] {
      color: var(--%NS%accent);
      white-space: nowrap;
    }
    nav[_ngcontent-%COMP%] {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      flex: 1;
      min-width: 0;
    }
    @media (max-width: 640px) {
      nav[_ngcontent-%COMP%] {
        order: 3;
        flex-basis: 100%;
      }
    }
    nav[_ngcontent-%COMP%]   button[_ngcontent-%COMP%] {
      padding: 6px 14px;
      border: none;
      border-radius: 6px;
      background: transparent;
      color: #a1a1aa;
      cursor: pointer;
      font-size: 13px;
      transition: all 0.15s;
    }
    nav[_ngcontent-%COMP%]   button[_ngcontent-%COMP%]:hover {
      background: #27272a;
      color: #e4e4e7;
    }
    nav[_ngcontent-%COMP%]   button.active[_ngcontent-%COMP%] {
      background: #3f3f46;
      color: #fff;
    }
    .status[_ngcontent-%COMP%] {
      margin-left: auto;
      font-size: 12px;
      padding: 3px 10px;
      border-radius: 99px;
      background: #44403c;
      color: #a8a29e;
    }
    .status.connected[_ngcontent-%COMP%] {
      background: #14532d;
      color: #4ade80;
    }
    main[_ngcontent-%COMP%] {
      flex: 1;
      overflow: auto;
      padding: 16px;
    }`]})};function IM(e){try{return new URL(e,location.href).origin===location.origin}catch{return!1}}function LM(){let e=new URLSearchParams(location.search).get(`baseURL`);if(e&&IM(e))return e;if(!location.pathname.includes(`__ng-devtools`))return`/__ng-devtools/`}Oy(FM).catch(console.error);export{jb as t};