import {h} from '../ui'
import {pageContent} from '../components'
import {stateView} from '../state_view'
import {captureRouteResourceScope} from '../resource_lifecycle'

/** Project only reviewed server public-list links, never the user's local library. */
export function publicCategoryHref(value:string,origin:string):string|undefined{
 try{const url=new URL(value,origin);if(url.origin!==origin||url.hash)return undefined
  if(!/^\/(?:categories(?:\/[^/]+)?|books\/(?:\d+|public\/[A-Za-z0-9_-]+)|authors\/\d{6,12})$/.test(url.pathname))return undefined
  if([...url.searchParams.keys()].some(key=>key!=='page')||url.searchParams.getAll('page').length>1)return undefined
  if(url.searchParams.has('page')&&!/^[1-9]\d{0,5}$/.test(url.searchParams.get('page')!))return undefined
  return url.pathname+url.search
 }catch{return undefined}
}
export function categoriesScreen(category?:string):HTMLElement{
 const root=pageContent(),heading=h('h1',{class:'page-title'},category??'أقسام المكتبة'),content=h('section',{'aria-live':'polite'})
 root.append(heading,content)
 const path='/categories'+(category?'/'+encodeURIComponent(category):''),query=new URLSearchParams(location.search),page=query.get('page')
 const url=path+(page?'?page='+encodeURIComponent(page):'')
 const scope=captureRouteResourceScope();let generation=0,active:AbortController|undefined
 scope.add(()=>active?.abort())
 const load=async()=>{
  if(scope.disposed)return
  active?.abort();const controller=new AbortController();active=controller;const current=++generation
  const valid=()=>!scope.disposed&&!controller.signal.aborted&&current===generation
  const timeout=globalThis.setTimeout(()=>controller.abort(),15000)
  content.replaceChildren(stateView({kind:'loading',title:'جارٍ تحميل الأقسام'}))
  try{
   const response=await fetch(url,{headers:{Accept:'text/html'},credentials:'omit',cache:'no-store',signal:controller.signal})
   if(!response.ok)throw Error('category_unavailable')
   const reader=response.body!.getReader(),chunks:Uint8Array[]=[];let size=0
   try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>512000)throw Error('category_html_too_large');chunks.push(value)}}finally{await reader.cancel().catch(()=>{})}
   const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
   const doc=new DOMParser().parseFromString(new TextDecoder().decode(bytes),'text/html'),main=doc.querySelector('main.seo-page')
   if(!main||doc.querySelector('meta[name="robots"]')?.getAttribute('content')?.includes('noindex'))throw Error('category_not_public')
   const list=h('ul',{class:'link-list'}),nav=h('nav',{'aria-label':'صفحات القسم',class:'pager'})
   for(const anchor of main.querySelectorAll<HTMLAnchorElement>('li a, nav a[rel="prev"], nav a[rel="next"]')){
    const href=publicCategoryHref(anchor.getAttribute('href')??'',location.origin);if(!href)continue
    const link=h('a',{href},anchor.textContent??'')
    if(anchor.rel==='prev'||anchor.rel==='next'){link.setAttribute('rel',anchor.rel);nav.append(link)}else list.append(h('li',null,link))
   }
   if(!valid())return
   if(category)root.dataset.seoCategory=category
   content.replaceChildren(list,nav)
  }catch{if(!scope.disposed&&current===generation)content.replaceChildren(stateView({kind:'error',title:'تعذّر تحميل القسم',description:'القسم غير موجود أو تعذّر الاتصال. لا تُعرض كتب خاصة بدلًا من القائمة العامة.',actionLabel:'إعادة المحاولة',onAction:()=>void load()}))}
  finally{globalThis.clearTimeout(timeout)}
 }
 void load();return root
}
