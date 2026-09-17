import { pageContent } from '../components'
import { compareEditionTexts, editionDifferences, groupBookEditions, type EditionBook } from '../edition_groups'
import { withExtractedEditionMetadata } from '../edition_metadata'
import { listBooks } from '../engine/library_store'
import { mountStateView, stateView } from '../state_view'
import { silentSkeleton } from '../silent_skeleton'
import { arabicNum, h } from '../ui'
import { publicPageHero } from '../public_page_hero'
import { bookOrdinal } from '../book_ordering'
import { authorLink, categoryLink, effectiveBookCategory } from '../taxonomy_links'
import {uiTemplateText,uiTemplateAttribute} from '../ui_template_binding'

export function editionsScreen():HTMLElement{const root=pageContent(publicPageHero({eyebrow:'تحقيق وطبعات',title:'مركز الطبعات',titleId:'editions-title',description:'مقارنة موثقة بين طبعتين حقيقيتين للعمل نفسه؛ لا تُحسب النسخة المكررة طبعةً أخرى.',className:'editions-hero'})),host=h('section',{class:'edition-groups','aria-busy':'true'},silentSkeleton('cards'));root.appendChild(host);void hydrate(host);return root}

function option(book:EditionBook,index:number){return h('option',{value:String(index),dataset:{noTranslate:''}},String(book.edition??book.publisher??book.investigator??book.publicationYearHijri??book.title))}
function editionLink(book:EditionBook,label:string){return h('a',{href:`#/reader/${book.id}`},label)}
function comparison(group:{books:EditionBook[]}){
  const left=h('select',{'aria-label':'اختر الطبعة الأولى'},...group.books.map(option)) as HTMLSelectElement
  const right=h('select',{'aria-label':'اختر الطبعة الثانية'},...group.books.map(option)) as HTMLSelectElement
  right.value='1'
  const output=h('div',{class:'edition-comparison','aria-live':'polite'})
  const render=()=>{
    const a=group.books[Number(left.value)]!,b=group.books[Number(right.value)]!
    if(a.id===b.id){output.replaceChildren(stateView({kind:'empty',icon:'book',title:'اختر طبعتين مختلفتين'}));return}
    const rows=editionDifferences(a,b).filter(row=>['publisher','investigator','edition','year','volumes','pages'].includes(row.key))
    const table=h('div',{class:'edition-table',role:'table','aria-label':'الفروق بين الطبعتين'},h('div',{class:'edition-table__row edition-table__head',role:'row'},h('strong',{role:'columnheader'},'البيان'),h('strong',{role:'columnheader'},editionLink(a,'الطبعة الأولى')),h('strong',{role:'columnheader'},editionLink(b,'الطبعة الثانية'))),...rows.map(row=>h('div',{class:`edition-table__row${row.different?' edition-table__row--different':''}`,role:'row'},h('strong',{role:'rowheader'},row.label),h('span',{role:'cell',...(row.missing?.[0]?{}:{dataset:{noTranslate:''}})},row.values[0]),h('span',{role:'cell',...(row.missing?.[1]?{}:{dataset:{noTranslate:''}})},row.values[1]))))
    const text=compareEditionTexts(a,b)
    const children:HTMLElement[]=[table]
    if(text.available)children.push(h('section',{class:'edition-text-compare'},h('h3',null,'المقارنة النصية'),h('div',{class:'edition-text-compare__columns'},h('article',null,h('h4',null,'الطبعة الأولى'),h('p',text.identical?null:{dataset:{noTranslate:''}},text.left!.snippet),h('small',null,uiTemplateText('8b1846fe746f006d',{p1:text.left!.offset}))),h('article',null,h('h4',null,'الطبعة الثانية'),h('p',text.identical?null:{dataset:{noTranslate:''}},text.right!.snippet),h('small',null,uiTemplateText('8b1846fe746f006d',{p1:text.right!.offset}))))))
    output.replaceChildren(...children)
  }
  left.onchange=render;right.onchange=render;render()
  return h('section',{class:'edition-compare-panel'},h('div',{class:'edition-compare-controls'},h('label',null,'الطبعة الأولى',left),h('label',null,'الطبعة الثانية',right)),output)
}

async function hydrate(host:HTMLElement):Promise<void>{try{const groups=groupBookEditions((await listBooks()).map(book=>withExtractedEditionMetadata(book)));host.className='edition-groups';host.removeAttribute('role');host.removeAttribute('aria-busy');host.replaceChildren();if(!groups.length){host.appendChild(stateView({kind:'empty',icon:'book',title:'لا توجد طبعات متعددة موثقة بعد',description:'يلزم تطابق العمل والمؤلف، ووجود دليل طبعة مختلف لكل نسخة.'}));return}for(const [index,group] of groups.entries()){const book=group.books[0]!,ordinal=bookOrdinal(index);const card=h('article',{class:'edition-group'},h('div',{class:'section-header'},h('span',{class:'book-card__ordinal','aria-hidden':'true'},arabicNum(ordinal.number)),h('div',null,h('h2',null,h('a',{href:`#/reader/${book.id}`,dataset:{noTranslate:''}},group.workTitle)),h('p',{class:'edition-group__links'},authorLink(group.author,undefined,book.authorId),document.createTextNode(' · '),categoryLink(effectiveBookCategory(book)),' ',uiTemplateText('a2e110d0bcb17367',{p1:group.books.length})))),comparison(group));uiTemplateAttribute(card,'aria-label','afecb05314ef7e20',{p1:ordinal.number,p2:group.workTitle});host.appendChild(card)}}catch{host.removeAttribute('aria-busy');mountStateView(host,{kind:'error',title:'تعذّر جمع الطبعات',description:'بيانات الكتب لم تتغير.',actionLabel:'إعادة المحاولة',onAction:()=>void hydrate(host)})}}
