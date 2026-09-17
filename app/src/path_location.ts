/** Normalize public identities without changing the reader's query state. */
export function canonicalizePath(value:string):string{
 const [path,query]=value.split(/\?(.*)/s)
 let clean=path||'/'
 const oldPerson=/^\/(?:people|author)\/(\d{1,6})\/?$/.exec(clean)
 if(oldPerson)clean='/authors/'+oldPerson[1]!.padStart(6,'0')
 const oldShamela=/^\/books\/shamela-(\d{1,12})\/?$/.exec(clean)
 if(oldShamela)clean='/books/'+oldShamela[1]
 const oldReader=/^\/reader\/(\d{9})\/?$/.exec(clean)
 if(oldReader&&Number(oldReader[1])>410000000&&Number(oldReader[1])<411000000)clean='/books/'+String(Number(oldReader[1])-410000000)
 const legacyAuthor=/^\/authors\/(?:local(?::|%3a))?shamela-author-(\d{1,6})\/?$/i.exec(clean)
 if(legacyAuthor&&Number(legacyAuthor[1])>0)clean='/authors/'+legacyAuthor[1]!.padStart(6,'0')
 const author=/^\/authors\/(\d{1,6})\/?$/.exec(clean)
 if(author)clean='/authors/'+author[1]!.padStart(6,'0')
 const book=/^\/books\/(\d+)\/?$/.exec(clean)
 if(book){const id=Number(book[1]);clean='/books/'+String(id>410000000&&id<411000000?id-410000000:id)}
 return clean+(query?'?'+query:'')
}
/** Preserve the query in navigation; canonical tags independently omit it. */
export function legacyHashToPath(hash:string):string{
 const raw=hash.replace(/^#/,'');if(!raw.startsWith('/')||raw.startsWith('//'))return '/'
 const [path,query]=raw.split(/\?(.*)/s),parts=path!.split('/'),kind=parts[1],id=parts[2]
 let clean=path||'/'
 const publication=/^central-submission(?::|%3[aA])([A-Za-z0-9_-]{1,200})$/.exec(id??'')
 if((kind==='reader'||kind==='book')&&publication)return '/books/public/'+publication[1]+(query?'?'+query:'')
 if((kind==='people'||kind==='author'&&/^\d{1,6}$/.test(id??''))&&id)clean='/authors/'+id
 if((kind==='reader'||kind==='book')&&id){
  const source=/^shamela-(\d+)$/.exec(id)?.[1]??(/^\d+$/.test(id)&&Number(id)>410000000&&Number(id)<411000000?String(Number(id)-410000000):id)
  const publicSlug=kind==='book'&&/^\d+-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(source)
  clean='/books/'+(/^\d+$/.test(source)||publicSlug?source:'local/'+source)
 }
 return canonicalizePath(clean+(query?'?'+query:''))
}
export function locationRouteHash(value:Pick<Location,'pathname'|'search'|'hash'>):string{
 if(value.hash.startsWith('#/'))return value.hash
 let path=canonicalizePath(value.pathname)
 const publication=/^\/books\/public\/([A-Za-z0-9_-]{1,200})$/.exec(path)
 if(publication)return '#/reader/'+encodeURIComponent('central-submission:'+publication[1])+value.search
 const local=/^\/books\/local\/(.+)$/.exec(path)
 if(local)return '#/reader/'+local[1]+value.search
 const person=/^\/authors\/([^/]+)\/?$/.exec(path),book=/^\/books\/([^/]+)\/?$/.exec(path)
 if(person)path='/people/'+person[1]
 if(book){const id=book[1]!;path=/^\d+-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id)?'/book/'+id:'/reader/'+(/^\d+$/.test(id)&&Number(id)<1000000?String(410000000+Number(id)):id)}
 return '#'+path+value.search
}
export function canonicalLocationPath(value:Pick<Location,'pathname'|'search'|'hash'>):string{
 return value.hash.startsWith('#/')?legacyHashToPath(value.hash):canonicalizePath(value.pathname+value.search)
}
export const routeLocation={
 get hash(){return locationRouteHash(location)},
 set hash(value:string){navigatePath(legacyHashToPath(value))},
}
export function navigatePath(path:string,replace=false):void{
 const url=new URL(path,location.origin)
 if(url.origin!==location.origin)throw Error('route_origin_invalid')
 const next=canonicalizePath(url.pathname+url.search)+url.hash
 if(next===location.pathname+location.search+location.hash)return
 history[replace?'replaceState':'pushState'](replace?history.state:null,'',next)
 window.dispatchEvent(new PopStateEvent('popstate',{state:history.state}))
}
export function installPathNavigation():void{
 const normalize=()=>{
  const canonical=canonicalLocationPath(location)
  if(location.hash.startsWith('#/')||(!location.hash&&canonical!==location.pathname+location.search))history.replaceState(history.state,'',canonical)
 }
 normalize()
 // Only external/old hash links enter this compatibility listener. Application
 // navigation and browser Back/Forward use popstate, never synthetic hashchange.
 window.addEventListener('hashchange',()=>{
  if(!location.hash.startsWith('#/'))return
  normalize();window.dispatchEvent(new PopStateEvent('popstate',{state:history.state}))
 })
 window.addEventListener('popstate',normalize)
 document.addEventListener('click',event=>{
  if(event.defaultPrevented||event.button!==0||event.ctrlKey||event.metaKey||event.shiftKey||event.altKey)return
  const anchor=(event.target instanceof Element?event.target.closest('a'):null)
  if(!anchor||anchor.target||anchor.hasAttribute('download'))return
  const raw=anchor.getAttribute('href')??'',url=new URL(raw,document.baseURI)
  if(url.origin!==location.origin)return
  const path=url.hash.startsWith('#/')?legacyHashToPath(url.hash):url.pathname+url.search
  if(!url.hash.startsWith('#/')&&(url.hash||/\.[a-z0-9]+$/i.test(url.pathname)||/^\/(api|assets|data|library|downloads)\//.test(url.pathname)))return
  event.preventDefault();navigatePath(path)
 })
}
