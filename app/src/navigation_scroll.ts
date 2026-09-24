const KEY='khezanaRouteScroll'
type Snapshot={hash:string;x:number;y:number}
let displayedHash:string|undefined
let displayedReader=false
let installed=false
export function routeScrollTarget(hash:string,previous:string|undefined,state:unknown):{x:number;y:number}|undefined {
 if(hash===previous)return undefined
 const row=state as Partial<Snapshot>|null
 return row?.hash===hash&&Number.isFinite(row.x)&&Number.isFinite(row.y)?{x:Number(row.x),y:Number(row.y)}:{x:0,y:0}
}
/** History entry-local scroll; reader continues to restore its own saved page. */
export function prepareRouteScroll(hash:string,reader=false):()=>void {
 if(!installed){
  installed=true;history.scrollRestoration='manual'
  window.addEventListener('scroll',()=>{
   // The reader saves its own exact page. Reading scroll coordinates here
   // after virtual pages move forces a large synchronous layout on each move.
   if(displayedReader||displayedHash!==routeLocation.hash)return
   history.replaceState({...history.state,[KEY]:{hash:displayedHash,x:window.scrollX,y:window.scrollY}},'')
  },{passive:true})
 }
 const target=routeScrollTarget(hash,displayedHash,history.state?.[KEY])
 return ()=>{
  if(routeLocation.hash!==hash)return
  displayedHash=hash
  displayedReader=reader
  if(!reader&&target)window.scrollTo({left:target.x,top:target.y,behavior:'instant'})
  history.replaceState({...history.state,[KEY]:{hash,x:reader?0:window.scrollX,y:reader?0:window.scrollY}},'')
 }
}
import {routeLocation} from "./path_location"
