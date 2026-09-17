import {h} from '../ui'
import {pageContent} from '../components'
import {publicPageHero} from '../public_page_hero'
import {listDiscoveryBooks} from '../discovery_books'
import {getReadingActivity} from '../activity_store'
import {recommendUnreadBooks} from '../reading_recommendations'
import {dismissedRecommendationIds} from '../recommendation_preferences'
import {homeNewCard} from './home'
import {captureReadingIdentity} from '../reading_identity_scope'
import {activeEditorialIds,loadEditorialRecommendations} from '../editorial_recommendations'
export function recommendationsScreen():HTMLElement{
 const identity=captureReadingIdentity()
 const grid=h('div',{class:'home-new-grid'},'جارٍ إعداد المقترحات…')
 const page=pageContent(publicPageHero({eyebrow:'اكتشف قراءتك القادمة',title:'مقترح لك من خزانتك',description:'حتى 50 كتابًا من ترشيحات الإدارة وبحسب قراءاتك السابقة واهتماماتك.',titleId:'recommendations-title'}),grid)
 void Promise.all([listDiscoveryBooks(),loadEditorialRecommendations().catch(()=>({revision:0,entries:[]}))]).then(([books,editorial])=>{
  if(!identity.isCurrent())return
  const activity=getReadingActivity(),hidden=new Set(dismissedRecommendationIds())
  const featured=activeEditorialIds(editorial.entries).filter(id=>!hidden.has(id)).flatMap(id=>{const book=books.find(b=>b.id===id);return book?[{book,reason:'من ترشيحات الإدارة',score:0}]:[]}).slice(0,10)
  const selected=new Set(featured.map(item=>item.book.id))
  const items=[...featured,...recommendUnreadBooks(books.filter(book=>!hidden.has(book.id)&&!selected.has(book.id)),activity.openedBookIds,activity.openCounts,50)].slice(0,50)
  grid.replaceChildren(...items.map((item,index)=>homeNewCard(item.book,index)))
  if(!items.length)grid.append(h('p',null,'لا توجد مقترحات جديدة الآن.'))
 }).catch(()=>{grid.replaceChildren(h('p',null,'تعذّر إعداد المقترحات؛ أعد فتح الصفحة للمحاولة.'))})
 return page
}
