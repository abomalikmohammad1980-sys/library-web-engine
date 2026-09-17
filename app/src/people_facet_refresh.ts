import {routeEventListener,type ResourceScope} from './resource_lifecycle'
/** Revalidate public membership when returning to a tab; coalesce but never drop
 * an edit notification received while a previous revalidation is in flight. */
export function watchPeopleFacetRefresh(scope:ResourceScope,refresh:()=>Promise<void>,onError:()=>void=()=>{},events:{window:EventTarget;document:EventTarget&{visibilityState?:string}}={window,document}):void{
 let running=false,pending=false,timer:ReturnType<typeof setTimeout>|undefined
 const run=()=>{timer=undefined;if(scope.disposed||running)return;running=true;void(async()=>{try{while(pending&&!scope.disposed){pending=false;try{await refresh()}catch{if(!scope.disposed)onError()}}}finally{running=false}})()}
 // focus and visible commonly arrive together; a short coalescing window avoids
 // issuing the same network request twice without polling in the background.
 const request=()=>{if(scope.disposed)return;pending=true;if(running||timer!==undefined)return;timer=setTimeout(run,40)}
 scope.add(()=>{if(timer!==undefined)clearTimeout(timer);pending=false})
 routeEventListener(events.window,'focus',request,undefined,scope)
 routeEventListener(events.window,'library-changed',request,undefined,scope)
 routeEventListener(events.document,'visibilitychange',()=>{if(events.document.visibilityState==='visible')request()},undefined,scope)
}
