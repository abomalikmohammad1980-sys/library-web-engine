import {h} from './ui'
import {parseReviewedTags} from './book_tags'
import './styles/book_tag_chips.css'
export const parseTagChips=(value:string):string[]=>parseReviewedTags(value.replace(/#/gu,'،'),[]).map(tag=>tag.name)
export function bookTagChips(initial=''):{element:HTMLElement;value:string}{
 let names=parseTagChips(initial)
 const list=h('div',{class:'book-tag-chips__list'}),input=h('input',{'aria-label':'الوسوم',type:'text',placeholder:'اكتب اسم الوسم ثم اضغط Enter'}) as HTMLInputElement
 const element=h('div',{class:'book-tag-chips'},list,input,h('small',null,'أضف كل وسم بضغط Enter أو بفاصلة. يمكن أن يتكوّن الوسم من عدة كلمات، ولا تحتاج إلى كتابة #.'))
 const render=()=>list.replaceChildren(...names.map((name,index)=>{const remove=h('button',{type:'button','aria-label':'حذف الوسم '+name},'×');remove.onclick=()=>{names.splice(index,1);render();input.focus()};return h('span',{class:'book-tag-chips__tag'},h('span',null,name),remove)}))
 const commit=()=>{if(!input.value.trim())return;names=parseTagChips([...names,input.value].join('، '));input.value='';render()}
 input.addEventListener('keydown',event=>{if(!event.isComposing&&['Enter',',','،','#'].includes(event.key)){event.preventDefault();commit()}})
 input.addEventListener('input',()=>{if(!/[,،#\n]/u.test(input.value))return;const pieces=input.value.split(/[,،#\n]/u),pending=pieces.pop()??'';names=parseTagChips([...names,...pieces].join('، '));input.value=pending;render()})
 input.addEventListener('blur',event=>{if((event.relatedTarget as Element|null)?.closest('.book-tag-chips__list'))return;commit()})
 render()
 return {element,get value(){return parseTagChips([...names,input.value].join('، ')).join('، ')},set value(value:string){names=parseTagChips(value);input.value='';render()}}
}
