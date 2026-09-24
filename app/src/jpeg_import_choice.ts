import {h} from './ui'
import './jpeg_import_choice.css'
import {jpegImportGroups,type JpegImportMode} from './jpeg_import_draft'

/** No file reads or persistence until the user confirms the reviewed order. */
export function jpegImportChoice(files:readonly File[],signal?:AbortSignal):{root:HTMLElement;result:Promise<File[][]|null>}{
  const ordered=[...files]
  const root=h('section',{class:'jpeg-import-choice',dir:'rtl','aria-label':'طريقة إضافة الصور'})
  const mode=h('select',{'aria-label':'طريقة إضافة الصور'},
    h('option',{value:'combined'},'صور مرتبة لكتاب واحد'),
    h('option',{value:'separate'},'كتاب مستقل لكل صورة')) as HTMLSelectElement
  const rows=h('ol',{class:'jpeg-import-choice__pages'})
  const error=h('p',{role:'alert'})
  const confirm=h('button',{type:'button',class:'btn btn--primary'},'متابعة بهذه الصور') as HTMLButtonElement
  const cancel=h('button',{type:'button',class:'btn btn--secondary'},'إلغاء') as HTMLButtonElement
  let settled=false
  let resolve!:(value:File[][]|null)=>void
  const result=new Promise<File[][]|null>(done=>{resolve=done})
  const finish=(value:File[][]|null)=>{
    if(settled)return
    settled=true
    signal?.removeEventListener('abort',abort)
    for(const control of root.querySelectorAll<HTMLButtonElement|HTMLSelectElement>('button,select'))control.disabled=true
    resolve(value)
  }
  const abort=()=>finish(null)
  const render=()=>{
    rows.replaceChildren(...ordered.map((file,index)=>{
      const row=h('li',{class:'jpeg-import-choice__page'})
      const up=h('button',{type:'button',title:'تقديم الصورة','aria-label':`تقديم الصورة ${index+1}`,disabled:index===0},'↑') as HTMLButtonElement
      const down=h('button',{type:'button',title:'تأخير الصورة','aria-label':`تأخير الصورة ${index+1}`,disabled:index===ordered.length-1},'↓') as HTMLButtonElement
      const move=(step:number)=>{
        if(settled)return
        const target=index+step
        ;[ordered[index],ordered[target]]=[ordered[target]!,ordered[index]!]
        error.textContent='';render()
        const moved=rows.children[target]
        const preferred=moved?.querySelector<HTMLButtonElement>(step<0?'button':'button:last-child')
        ;(preferred&&!preferred.disabled?preferred:moved?.querySelector<HTMLButtonElement>('button:not(:disabled)'))?.focus()
      }
      up.addEventListener('click',()=>move(-1));down.addEventListener('click',()=>move(1))
      row.append(h('span',{class:'jpeg-import-choice__name',dir:'auto'},file.name),h('span',{class:'jpeg-import-choice__order'},up,down))
      return row
    }))
  }
  confirm.addEventListener('click',()=>{
    if(settled)return
    try{finish(jpegImportGroups(ordered,mode.value as JpegImportMode))}
    catch(reason){error.textContent=reason instanceof Error?reason.message:String(reason)}
  })
  cancel.addEventListener('click',()=>finish(null))
  root.append(h('h3',null,'إضافة صور JPG'),mode,h('p',null,'رتّب الصور قبل المتابعة. تبقى ملفات الصور الأصلية محفوظة دون تغيير.'),rows,error,h('div',{class:'jpeg-import-choice__actions'},confirm,cancel))
  render()
  if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true})
  return {root,result}
}
