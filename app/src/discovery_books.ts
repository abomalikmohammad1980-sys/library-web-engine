import {listBooks} from './engine/library_store'
import {createPublishedBooksCatalogClient} from './published_books_catalog_client'
import {publicHomeCards,type HomeCardDisplay} from './screens/home'
export async function listDiscoveryBooks():Promise<HomeCardDisplay[]>{
 const local=await listBooks(),client=createPublishedBooksCatalogClient()
 for(let page=0;page<1000;page++){
  const state=await client.next()
  if(state.error)throw Error('تعذّر تحميل أحدث المنشورات العامة')
  if(state.complete)return [...local,...publicHomeCards(state.books,new Set(local.map(b=>b.id)))]
 }
 throw Error('تعذّر إكمال قائمة المنشورات')
}
