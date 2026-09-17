import {h} from './ui'
import {connectWord,hasConnectedWordSession} from './word_connected_client'

/** Keep selected files in memory while the user connects the local helper. */
export function ensureWordUploadSetup(host:HTMLElement,signal:AbortSignal):Promise<boolean>{
 if(hasConnectedWordSession())return Promise.resolve(true)
 return new Promise(resolve=>{
  const card=h('section',{class:'import-manual-pdf','aria-label':'إعداد مساعد Word'})
  const status=h('p',{role:'status','aria-live':'polite'})
  const code=h('input',{type:'password','aria-label':'رمز اتصال مساعد Word',placeholder:'رمز الاتصال من المساعد',dir:'ltr'}) as HTMLInputElement
  code.autocomplete='off';code.spellcheck=false
  const retry=h('button',{type:'button',class:'btn btn--primary'},'تحقق من الاتصال وتابع الرفع') as HTMLButtonElement
  const cancel=h('button',{type:'button',class:'btn btn--secondary'},'إلغاء')
  let finished=false
  const finish=(value:boolean)=>{if(finished)return;finished=true;signal.removeEventListener('abort',abort);card.remove();resolve(value)}
  const abort=()=>finish(false)
  card.append(h('h3',null,'يلزم مساعد الخزانة لمعالجة ملف Word'),
   h('p',null,'يتطلب Windows وMicrosoft Word المكتبي. يعالج المساعد نسخة من الملف دون تعديل الأصل أو إغلاق مستنداتك.'),
   h('a',{class:'btn btn--primary',href:'/downloads/khizana-word-companion-windows.zip'},'تنزيل مساعد Word — Windows'),
   h('ol',null,
    h('li',null,'فك الضغط وشغّل Start-Connected.cmd. اترك نافذته مفتوحة أو مصغّرة.'),
    h('li',null,'الصق رمز الاتصال هنا، ثم تابع. اسمح بالاتصال بالجهاز المحلي إن طلب المتصفح ذلك.')),
   h('p',null,'لم يبدأ الرفع؛ سيُعالج الملف المختار ثم تُعرض بياناته للمراجعة.'))
  card.append(code,retry)
  card.append(status,cancel);host.replaceChildren(card)
  cancel.addEventListener('click',()=>finish(false))
  retry.addEventListener('click',async()=>{
   if(signal.aborted||finished)return
   retry.disabled=true;status.textContent='جارٍ التحقق من اتصال Word…'
   try{await connectWord(code.value);if(!signal.aborted)finish(true)}
   catch(error){if(!finished)status.textContent=error instanceof Error?error.message:'تعذّر الاتصال بالمساعد.'}
   finally{retry.disabled=false}
  })
  signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort()
 })
}
