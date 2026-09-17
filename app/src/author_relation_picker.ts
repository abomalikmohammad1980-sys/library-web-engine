import {h} from './ui'
import {loadShamelaAuthorIndex,type ShamelaAuthorIndexEntry} from './shamela_author_index'
import {normalizePeopleFacet,uniquePeopleHrefByName} from './author_people'

export function relationAuthorChoices(authors:readonly ShamelaAuthorIndexEntry[],query:string){
 const wanted=normalizePeopleFacet(query)
 if(wanted.length<2)return[]
 const counts=new Map<string,number>(),rows=authors.map(author=>({author,name:normalizePeopleFacet(author.name)}))
 for(const row of rows)counts.set(row.name,(counts.get(row.name)??0)+1)
 return rows.filter(row=>row.name.includes(wanted)&&counts.get(row.name)===1).slice(0,20).map(row=>row.author)
}
/** Uses canonical catalog names supported by the existing relation resolver. */
export function authorRelationPicker(target:HTMLTextAreaElement){
 const input=h('input',{type:'search',placeholder:'ابحث واختر مؤلفًا من المكتبة','aria-label':'اختيار مؤلف للعلاقة العلمية'}) as HTMLInputElement
 const results=h('div',{class:'author-relation-picker__results'}),status=h('p',{role:'status'}),root=h('div',{class:'author-relation-picker'},input,results,status)
 let authors:ShamelaAuthorIndexEntry[]|undefined,sequence=0
 input.onkeydown=event=>{if(event.key==='Enter')event.preventDefault()}
 input.oninput=async()=>{
  const ticket=++sequence;results.replaceChildren();status.textContent=''
  if(normalizePeopleFacet(input.value).length<2)return
  try{
   authors??=(await loadShamelaAuthorIndex()).authors
   if(ticket!==sequence||!root.isConnected)return
   const choices=relationAuthorChoices(authors,input.value)
   results.replaceChildren(...choices.map(author=>{
    const button=h('button',{type:'button',class:'btn btn--secondary',dataset:{noTranslate:''}},author.name)
    button.onclick=()=>{
     const names=target.value.split('\n').map(name=>name.trim()).filter(Boolean)
     if(!names.includes(author.name))names.push(author.name)
     target.value=names.join('\n');target.dispatchEvent(new Event('input',{bubbles:true}))
     input.value='';sequence++;results.replaceChildren()
     status.replaceChildren(h('span',null,'أُضيف: '),h('a',{href:uniquePeopleHrefByName(authors!,author.name)!,dataset:{noTranslate:''}},author.name))
    };return button
   }))
   if(!choices.length)status.textContent='لا يوجد اسم مطابق غير ملتبس؛ يمكنك إبقاء الاسم نصًا حتى تتوفر ترجمته.'
  }catch{if(ticket===sequence&&root.isConnected)status.textContent='تعذّر تحميل قائمة المؤلفين؛ لم تتغير الأسماء.'}
 }
 return root
}
