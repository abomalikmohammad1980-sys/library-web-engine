import {pageContent} from '../components'
import {pageJump} from '../page_jump'
import {h} from '../ui'
import {loadPublicQuotes,publicQuoteHref,withdrawPublicQuote} from '../public_quotes'
import {currentAccountClaims} from '../account_authority'
import {captureRouteResourceScope} from '../resource_lifecycle'
import {stateView} from '../state_view'
export function quotesScreen():HTMLElement{
 const root=pageContent(h('h1',null,'الاقتباسات')),list=h('div',{class:'public-quotes'}),nav=h('nav',{class:'public-quotes__pagination','aria-label':'صفحات الاقتباسات'}),scope=captureRouteResourceScope();let generation=0,mine=false
 root.append(h('p',null,'فوائد اختار أصحابها مشاركتها مع الجميع، مع موضعها في الكتاب.'),list,nav)
 const load=async(page=0)=>{const run=++generation;list.setAttribute('aria-busy','true');try{const result=await loadPublicQuotes(page,20,mine);if(scope.disposed||run!==generation)return
  list.replaceChildren(...(result.quotes.length?result.quotes.map(q=>{const card=h('article',{class:'public-quote'},h('h2',{dataset:{noTranslate:''}},q.displayName),h('blockquote',{dataset:{noTranslate:''}},q.text),h('a',{href:publicQuoteHref(q)},h('span',{dataset:{noTranslate:''}},q.bookTitle),' — ',h('span',null,`موضع ${q.pageIndex+1}`)));if(mine){const remove=h('button',{class:'btn btn--secondary'},'إلغاء المشاركة العامة'),status=h('p',{role:'status'});remove.onclick=async()=>{remove.disabled=true;try{await withdrawPublicQuote(q.id);if(!scope.disposed)void load(page)}catch(error){status.textContent=error instanceof Error?error.message:'تعذّر إلغاء المشاركة.';remove.disabled=false}};card.append(remove,status)}return card}):[h('p',null,'لم تُشارك اقتباسات عامة بعد.')]))
  const previous=h('button',{class:'btn btn--secondary',disabled:page===0},'السابق'),next=h('button',{class:'btn btn--secondary',disabled:!result.hasMore},'التالي');previous.onclick=()=>void load(page-1);next.onclick=()=>void load(page+1);const jump=pageJump('الاقتباسات',index=>{void load(index)});jump.update(page,undefined);nav.replaceChildren(previous,jump.element,next)
 }catch{if(!scope.disposed&&run===generation)list.replaceChildren(stateView({kind:'error',title:'تعذّر تحميل الاقتباسات',actionLabel:'إعادة المحاولة',onAction:()=>void load(page)}))}finally{if(run===generation)list.removeAttribute('aria-busy')}}
 if(currentAccountClaims()){const toggle=h('button',{class:'btn btn--secondary'},'اقتباساتي المنشورة');toggle.onclick=()=>{mine=!mine;toggle.textContent=mine?'كل الاقتباسات':'اقتباساتي المنشورة';void load()};root.insertBefore(toggle,list)}
 void load();return root
}
