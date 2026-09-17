import {captureRouteResourceScope,routeObserver,type ResourceScope} from './resource_lifecycle';
export interface SatelliteProviderConfiguration {
 /** Supplied only after operator review of licensing, authentication and attribution. */
 reviewed:true; imageryUrlTemplate:string; referenceUrlTemplate?:string; attributionText:string; branding?:'maptiler-free';
}
/** Public browser key; restrictions must be configured at MapTiler, not merely in this flag. */
export function mapTilerSatelliteProvider(config?:{publicApiKey?:string;domainRestrictionsConfirmed:boolean}):SatelliteProviderConfiguration|undefined{
 const key=config?.publicApiKey?.trim();if(!config?.domainRestrictionsConfirmed||!key||!/^[A-Za-z0-9_-]{16,128}$/.test(key))return undefined;
 // Dataset schema + authenticated TileJSON agree: satellite-v2 JPEG tiles.
 // satellite-v4 names a map style, not this raster dataset.
 return {reviewed:true,imageryUrlTemplate:`https://api.maptiler.com/tiles/satellite-v2/{z}/{x}/{y}.jpg?key=${encodeURIComponent(key)}`,attributionText:'© MapTiler © OpenStreetMap contributors',branding:'maptiler-free'};
}
interface LeafletMap {setView(center:[number,number],zoom:number):LeafletMap;remove():void}
interface LeafletLayer {addTo(map:LeafletMap):LeafletLayer;on(event:string,callback:()=>void):LeafletLayer}
export interface LeafletApi {version:string;map(element:HTMLElement,options:Record<string,unknown>):LeafletMap;tileLayer(url:string,options:Record<string,unknown>):LeafletLayer}
export const LEAFLET_ASSETS=Object.freeze({
 css:'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',cssIntegrity:'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=',
 js:'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',jsIntegrity:'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=',
});
let leafletFlight:Promise<LeafletApi>|undefined;
/** Called only by a visible widget. One shared load, pinned version and SRI. */
export function loadSatelliteLeaflet():Promise<LeafletApi>{
 if(leafletFlight)return leafletFlight;
 const link=document.createElement('link'),script=document.createElement('script');link.rel='stylesheet';link.href=LEAFLET_ASSETS.css;link.integrity=LEAFLET_ASSETS.cssIntegrity;link.crossOrigin='anonymous';script.src=LEAFLET_ASSETS.js;script.integrity=LEAFLET_ASSETS.jsIntegrity;script.crossOrigin='anonymous';script.async=true;
 leafletFlight=new Promise<LeafletApi>((resolve,reject)=>{let css=false,js=false,done=false;const timer=setTimeout(()=>finish(Error('satellite_library_timeout')),8000);const finish=(error?:Error)=>{if(done)return;if(!error&&(!css||!js))return;done=true;clearTimeout(timer);link.onload=link.onerror=script.onload=script.onerror=null;const L=(globalThis as typeof globalThis & {L?:LeafletApi}).L;if(error||L?.version!=='1.9.4'){link.remove();script.remove();reject(error??Error('satellite_library_version'));return}resolve(L)};link.onload=()=>{css=true;finish()};script.onload=()=>{js=true;finish()};link.onerror=script.onerror=()=>finish(Error('satellite_library_unavailable'));document.head.append(link,script)}).catch(e=>{leafletFlight=undefined;throw e});return leafletFlight;
}
export function validateSatelliteCoordinates(latitude:number,longitude:number):void{if(!Number.isFinite(latitude)||!Number.isFinite(longitude)||latitude < -85.05112878||latitude > 85.05112878||longitude < -180||longitude > 180)throw Error('satellite_coordinates')}
function providerCopy(value:SatelliteProviderConfiguration):SatelliteProviderConfiguration{
 if(value.reviewed!==true||typeof value.attributionText!=='string'||!value.attributionText.trim()||value.attributionText.length>1024)throw Error('satellite_provider');
 for(const template of [value.imageryUrlTemplate,...(value.referenceUrlTemplate===undefined?[]:[value.referenceUrlTemplate])]){if(!template||!['{z}','{x}','{y}'].every(t=>template.includes(t)))throw Error('satellite_provider');const u=new URL(template.replaceAll('{z}','0').replaceAll('{x}','0').replaceAll('{y}','0'));if(u.protocol!=='https:'||u.username||u.password||u.hash)throw Error('satellite_provider')}
 return {...value};
}
function mapZoom(value=12):number{return Number.isFinite(value)?Math.max(1,Math.min(12,Math.floor(value))):12}
export function satelliteFallbackUrl(latitude:number,longitude:number,zoom=12):string{validateSatelliteCoordinates(latitude,longitude);const u=new URL('https://www.google.com/maps/@');u.search=new URLSearchParams({api:'1',map_action:'map',center:`${latitude},${longitude}`,zoom:String(mapZoom(zoom)),basemap:'satellite'}).toString();return u.href}
export function buildSatelliteMapWidget(options:{latitude:number;longitude:number;label:string;zoom?:number;provider?:SatelliteProviderConfiguration;scope?:ResourceScope;loadLeaflet?:()=>Promise<LeafletApi>}):HTMLElement & {dispose():void}{
 validateSatelliteCoordinates(options.latitude,options.longitude);const {latitude,longitude,label}=options,zoom=mapZoom(options.zoom),provider=options.provider?providerCopy(options.provider):undefined,load=options.loadLeaflet??loadSatelliteLeaflet,scope=options.scope??captureRouteResourceScope();
 const root=document.createElement('section') as HTMLElement & {dispose():void};root.className='satellite-map-widget';root.dir='rtl';const canvas=document.createElement('div');canvas.className='satellite-map-widget__canvas';canvas.style.cssText='width:260px;height:180px;max-width:100%;position:relative';canvas.setAttribute('aria-label',`خريطة قمر صناعي: ${label}`);
 const status=document.createElement('small');status.setAttribute('role','status');status.textContent=provider?'تُحمّل المعاينة عند ظهورها.':'معاينة الصور غير مفعّلة حاليًا.';
 const fallback=document.createElement('a');fallback.href=satelliteFallbackUrl(latitude,longitude,zoom);fallback.textContent='فتح الموقع في Google Maps';fallback.target='_blank';fallback.rel='noopener noreferrer';fallback.style.cssText='display:block;min-height:44px';root.append(canvas,status,fallback);
 let disposed=false,started=false,map:LeafletMap|undefined,observer:IntersectionObserver|undefined;
 root.dispose=()=>{if(disposed)return;disposed=true;observer?.disconnect();map?.remove();map=undefined};scope.add(root.dispose);
 if(!provider||disposed)return root;
 const start=async()=>{if(started||disposed||!root.isConnected)return;started=true;observer?.disconnect();status.textContent='جارٍ تحميل المعاينة…';try{const L=await load();if(disposed||scope.disposed||!root.isConnected)return;
  canvas.tabIndex=0;
  map=L.map(canvas,{maxZoom:12,minZoom:1,zoomControl:true,scrollWheelZoom:false,keyboard:true,attributionControl:true}).setView([latitude,longitude],zoom);
  for(const button of canvas.querySelectorAll<HTMLElement>('.leaflet-control-zoom a')){button.style.width='44px';button.style.height='44px';button.style.lineHeight='44px';}
  const escaped=provider.attributionText.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
  const credit=provider.branding==='maptiler-free'?'<a href="https://www.maptiler.com/copyright/" target="_blank" rel="noopener noreferrer">© MapTiler</a> <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a>':escaped;
  L.tileLayer(provider.imageryUrlTemplate,{maxZoom:12,attribution:credit}).on('tileerror',()=>{if(!disposed)status.textContent='تعذّر تحميل بعض الصور؛ رابط الخريطة متاح.'}).addTo(map);
  if(provider.referenceUrlTemplate)L.tileLayer(provider.referenceUrlTemplate,{maxZoom:12}).on('tileerror',()=>{if(!disposed)status.textContent='تعذّر تحميل بعض التسميات؛ رابط الخريطة متاح.'}).addTo(map);
  if(provider.branding==='maptiler-free'){const logo=document.createElement('a');logo.href='https://www.maptiler.com/';logo.target='_blank';logo.rel='noopener noreferrer';logo.style.cssText='position:absolute;left:10px;bottom:40px;z-index:999';const img=document.createElement('img');img.src='https://api.maptiler.com/resources/logo.svg';img.alt='MapTiler logo';logo.append(img);canvas.append(logo);}
  // Keep provider attribution readable inside a narrow preview without clipping.
  const attribution=canvas.querySelector<HTMLElement>('.leaflet-control-attribution');if(attribution){attribution.style.maxWidth='240px';attribution.style.whiteSpace='normal';attribution.style.overflowWrap='anywhere';}
  status.textContent='';
 }catch{map?.remove();map=undefined;if(!disposed)status.textContent='تعذّر تحميل المعاينة؛ رابط الخريطة متاح.'}};
 if(typeof IntersectionObserver!=='undefined'){observer=routeObserver(new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting))void start()},{rootMargin:'0px',threshold:0.01}),scope);observer.observe(root)}
 else{status.textContent='اضغط لتحميل المعاينة.';const button=document.createElement('button');button.type='button';button.textContent='تحميل المعاينة';button.onclick=()=>{void start();button.remove()};root.append(button);scope.add(()=>{button.onclick=null})}
 return root;
}
