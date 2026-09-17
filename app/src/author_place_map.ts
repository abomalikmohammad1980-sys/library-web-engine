import {buildSatelliteMapWidget,type SatelliteProviderConfiguration} from './satellite_map_widget';
import {configuredSatelliteProvider} from './satellite_site_config';
import {AUTHOR_PLACE_ADDITIONS} from './author_place_registry_additions';
let noteSequence=0;
function reviewedCity(label:string,contemporaryName:string,latitude:number,longitude:number,sourceTitle:string,sourceUrl:string,note='نقطة استدلال للمدينة من المرجع الجغرافي؛ ليست موضع مسكن المؤلف أو قبره، ولا حدود المدينة القديمة.'){
 return Object.freeze({label,contemporaryName,latitude,longitude,zoom:12,note,sources:Object.freeze([{title:sourceTitle,url:sourceUrl}])});
}
/** Curated, sourced coordinates only. Unknown labels never trigger geocoding. */
export const AUTHOR_PLACE_MAPS = Object.freeze({
 ...AUTHOR_PLACE_ADDITIONS,
 'al-madain-iq': Object.freeze({
  label:'المدائن، العراق', contemporaryName:'قرب سلمان باك، العراق',
  latitude:33.093582, longitude:44.580717, zoom:13,
  note:'نقطة تقريبية في نطاق المدائن التاريخية (قطيسفون)، وليست حدود المدينة القديمة. دقة المرجع نحو كيلومترين.',
  sources:Object.freeze([
   {title:'Digital Atlas of the Roman Empire — Ctesiphon',url:'https://imperium.ahlfeldt.se/places/21868.html'},
   {title:'Syriaca.org — سلمان باك',url:'https://syriaca.org/place/522'},
  ]),
 }),
 // Independently reviewed against the cited gazetteer records on 2026-09-10.
 // Exact labels only. Gazetteer alternate names are NOT automatic aliases.
 'madinah-sa':reviewedCity('المدينة المنورة، الحجاز','المدينة المنورة، السعودية',24.468579,39.618468,'UNGEGN — Al Madīnah / PNCGN','https://ungegn.un.org/dashboard/cities/details?id=3390','نقطة استدلال للمدينة المنورة المعاصرة؛ ليست موضع المسجد النبوي أو قبر أو مسكن المؤلف، ولا تحدد حدود الحرم أو المدينة القديمة.'),
 'kufa-iq':reviewedCity('الكوفة، العراق','الكوفة المعاصرة، العراق',32.024915,44.396422,'NGA GEOnet — Kūfa','https://geonames.nga.mil/geon-ags/rest/services/RESEARCH/GIS_OUTPUT/MapServer/0/773930/htmlPopup?f=html','نقطة استدلال للكوفة المعاصرة؛ ليست موضع مسكن المؤلف أو مسجد الكوفة، ولا تحدد حدود الكوفة التاريخية.'),
 'baghdad-iq':reviewedCity('بغداد، العراق','بغداد، العراق',33.325,44.422,'The Syriac Gazetteer — Baghdad','https://www.syriaca.org/place/41'),
 'damascus-sy':reviewedCity('دمشق، سوريا','دمشق، سوريا',33.513,36.292,'The Syriac Gazetteer — Damascus','https://syriaca.org/place/66'),
 'cairo-eg':reviewedCity('القاهرة، مصر','القاهرة، مصر',30+3/60+6/3600,31+15/60+41/3600,'Princeton Geniza Project — Cairo','https://geniza.princeton.edu/en/places/cairo/'),
 'makkah-sa':reviewedCity('مكة المكرمة، الحجاز','مكة المكرمة، السعودية',21+25/60+26/3600,39+49/60+1/3600,'Princeton Geniza Project — Mecca','https://geniza.princeton.edu/en/places/mecca/'),
 'aleppo-sy':reviewedCity('حلب، سوريا','حلب، سوريا',36+13/60,37+10/60,'Princeton Geniza Project — Aleppo','https://geniza.princeton.edu/en/places/aleppo/'),
 'basra-iq':reviewedCity('البصرة، العراق','البصرة المعاصرة، العراق',30+30/60+54/3600,47+48/60+36/3600,'Princeton Geniza Project — Baṣra','https://geniza.princeton.edu/en/places/basra/','نقطة استدلال للبصرة المعاصرة؛ لا تمثل موضع البصرة الإسلامية الأولى أو مسكن المؤلف، وليست حدود المدينة القديمة.'),
 'isfahan-ir':reviewedCity('أصبهان، إيران','أصفهان، إيران',32.65139,51.679191,'The Syriac Gazetteer — Ispahan','https://syriaca.org/place/830'),
 'mosul-iq':reviewedCity('الموصل، العراق','الموصل، العراق',36+20/60+24/3600,43+7/60+48/3600,'Princeton Geniza Project — Mosul','https://geniza.princeton.edu/en/places/mosul/'),
 'alexandria-eg':reviewedCity('الإسكندرية، مصر','الإسكندرية، مصر',31+12/60+16/3600,29+52/60+48/3600,'Princeton Geniza Project — Alexandria','https://geniza.princeton.edu/en/places/alexandria/'),
 'jerusalem-ps':reviewedCity('القدس، فلسطين','القدس، فلسطين',31+46/60+36/3600,35+14/60+3/3600,'Princeton Geniza Project — Jerusalem','https://geniza.princeton.edu/en/places/jerusalem/'),
});
export type AuthorPlaceMapId = keyof typeof AUTHOR_PLACE_MAPS;
export function resolveAuthorPlaceMap(label:string):AuthorPlaceMapId|undefined {
 const exact=label.trim();
 if(['المدائن، العراق','المدائن, العراق','المدائن'].includes(exact))return 'al-madain-iq';
 return (Object.keys(AUTHOR_PLACE_MAPS) as AuthorPlaceMapId[]).find(id=>AUTHOR_PLACE_MAPS[id].label===exact);
}
export function authorPlaceSatelliteUrl(id:AuthorPlaceMapId):string {
 const p=AUTHOR_PLACE_MAPS[id];const url=new URL('https://www.google.com/maps/@');url.search=new URLSearchParams({api:'1',map_action:'map',center:`${p.latitude},${p.longitude}`,zoom:String(p.zoom),basemap:'satellite'}).toString();return url.href;
}
export function authorPlaceStreetEmbedUrl(id:AuthorPlaceMapId):string {
 const p=AUTHOR_PLACE_MAPS[id],url=new URL('https://www.openstreetmap.org/export/embed.html');
 const span=.045;
 url.search=new URLSearchParams({bbox:[Math.max(-180,p.longitude-span),Math.max(-85,p.latitude-span),Math.min(180,p.longitude+span),Math.min(85,p.latitude+span)].join(','),layer:'mapnik',marker:`${p.latitude},${p.longitude}`}).toString();return url.href;
}
export function authorPlaceEmbedUrl(id:AuthorPlaceMapId,key:string):string {
 if(!/^[A-Za-z0-9_-]{16,200}$/.test(key))throw Error('place_map_embed_key');
 const p=AUTHOR_PLACE_MAPS[id],url=new URL('https://www.google.com/maps/embed/v1/view');url.search=new URLSearchParams({key,center:`${p.latitude},${p.longitude}`,zoom:String(p.zoom),maptype:'satellite',language:'ar'}).toString();return url.href;
}
/** Prefer configured satellite imagery, otherwise lazily embed the street map.
 * Keep provider attribution visible in every map mode. */
export function authorPlaceMapWidget(id:AuthorPlaceMapId,options:{embedApiKey?:string;satelliteProvider?:SatelliteProviderConfiguration}={}):HTMLElement {
 const p=AUTHOR_PLACE_MAPS[id],root=document.createElement('aside');root.className='author-place-map';root.dir='rtl';root.setAttribute('aria-label',`موقع ${p.label}`);
 const title=document.createElement('strong');title.textContent=p.contemporaryName;
 const heading=document.createElement('div');heading.className='author-place-map__heading';
 const help=document.createElement('button');help.type='button';help.textContent='?';help.className='author-place-map__help';help.setAttribute('aria-label','ملاحظة عن دقة الموقع');help.setAttribute('aria-expanded','false');
 const note=document.createElement('p');note.textContent=p.note;note.className='author-place-map__note';note.id=`map-note-${++noteSequence}`;note.hidden=true;note.setAttribute('role','tooltip');help.setAttribute('aria-describedby',note.id);help.setAttribute('aria-controls',note.id);
 let pinned=false;const show=(visible:boolean)=>{note.hidden=!visible;help.setAttribute('aria-expanded',String(visible))};
 help.addEventListener('click',()=>{pinned=!pinned;show(pinned)});heading.addEventListener('mouseenter',()=>show(true));heading.addEventListener('mouseleave',()=>{if(!pinned&&document.activeElement!==help)show(false)});help.addEventListener('focus',()=>show(true));help.addEventListener('blur',()=>{pinned=false;show(false)});help.addEventListener('keydown',event=>{if(event.key==='Escape'){pinned=false;show(false)}});
 heading.append(title,help,note);
 const link=document.createElement('a');link.textContent='عرض الموقع بالقمر الصناعي في Google Maps';link.href=authorPlaceSatelliteUrl(id);link.target='_blank';link.rel='noopener noreferrer';
 const source=document.createElement('details'),summary=document.createElement('summary');summary.textContent='مصادر تحديد الموقع';source.append(summary);
 for(const item of p.sources){const a=document.createElement('a');a.textContent=item.title;a.href=item.url;a.target='_blank';a.rel='noopener noreferrer';source.append(a,document.createElement('br'));}
 root.append(heading,source);
 const satelliteProvider=options.satelliteProvider??configuredSatelliteProvider();
 if(satelliteProvider){root.append(buildSatelliteMapWidget({latitude:p.latitude,longitude:p.longitude,label:p.label,zoom:p.zoom,provider:satelliteProvider}));}
 else if(options.embedApiKey){const embedUrl=authorPlaceEmbedUrl(id,options.embedApiKey);const button=document.createElement('button');button.type='button';button.textContent='تحميل خريطة Google هنا';button.style.minHeight='44px';
  const disclosure=document.createElement('small');disclosure.textContent='عند الضغط سيتصل المتصفح بخدمة Google لعرض الخريطة.';
  button.addEventListener('click',()=>{if(!root.isConnected||root.querySelector('iframe'))return;const frame=document.createElement('iframe');frame.title=`صورة قمر صناعي — ${p.label}`;frame.width='280';frame.height='220';frame.style.cssText='border:0;max-width:100%;min-width:200px;min-height:200px';frame.referrerPolicy='strict-origin-when-cross-origin';frame.allowFullscreen=true;frame.src=embedUrl;root.append(frame);button.remove();},{once:true});root.append(button,disclosure);
 }else{const frame=document.createElement('iframe');frame.title=`خريطة الموقع — ${p.label}`;frame.src=authorPlaceStreetEmbedUrl(id);frame.loading='lazy';frame.width='280';frame.height='220';frame.style.cssText='border:0;width:100%;min-height:220px';frame.referrerPolicy='strict-origin-when-cross-origin';root.append(frame);}
 // The satellite widget supplies its own bottom fallback link. Without that
 // widget retain exactly one external link below the fallback/embed controls.
 if(!satelliteProvider)root.append(link);
 return root;
}
