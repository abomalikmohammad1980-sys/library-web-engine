import {captureAnnotationStores} from './annotation_identity_store'
import {captureRouteResourceScope,routeEventListener,type ResourceScope} from './resource_lifecycle'

const boundaries=new WeakMap<HTMLElement,ResourceScope>()

/** Bind rendered controls and their data to one identity, including detached controls. */
export function annotationEditorBoundary(host:HTMLElement,onIdentityChange?:()=>void,clear=()=>host.replaceChildren()){
  boundaries.get(host)?.dispose()
  const editor=captureAnnotationStores(),parent=captureRouteResourceScope(),cleanups:Array<()=>void>=[]
  const scope:ResourceScope={disposed:false,add(cleanup){if(this.disposed)cleanup();else cleanups.push(cleanup)},dispose(){if(this.disposed)return;Object.assign(this,{disposed:true});for(const cleanup of cleanups.splice(0))cleanup()}}
  boundaries.set(host,scope);parent.add(()=>scope.dispose())
  const isCurrent=()=>!scope.disposed&&editor.isCurrent()
  const guard=(event:Event)=>{if(!isCurrent()){event.preventDefault();event.stopImmediatePropagation()}}
  for(const type of ['click','submit','input','change','pointerup','keydown'])routeEventListener(host,type,guard,{capture:true},scope)
  routeEventListener(window,'alkhizana:account-changed',()=>{
    if(editor.isCurrent())return
    clear()
    onIdentityChange?.()
  },undefined,scope)
  return {...editor,isCurrent}
}
