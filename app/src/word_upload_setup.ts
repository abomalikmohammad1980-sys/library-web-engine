import {h} from './ui'
import {connectWord,hasConnectedWordSession} from './word_connected_client'
/** No file bytes are read while waiting for the local helper. */
export function ensureWordUploadSetup(host:HTMLElement,signal:AbortSignal):Promise<boolean>{
 if(signal.aborted)return Promise.resolve(false)
 if(hasConnectedWordSession())return Promise.resolve(true)
 return new Promise(resolve=>{
  const card=h('section',{class:'word-upload-setup','aria-label':'إعداد مساعد Word'})
  const status=h('span',{role:'status','aria-live':'polite'},'جاهز للاتصال')
  const timer=h('output',{class:'word-upload-setup__timer',role:'timer','aria-label':'الوقت المنقضي للاتصال',dir:'ltr',dataset:{noTranslate:''}},'00:00')
  const code=h('input',{class:'word-upload-setup__code',type:'text',maxlength:128,style:'-webkit-text-security:disc',dataset:{noTranslate:''},'aria-label':'رمز اتصال مساعد Word',placeholder:'رمز الاتصال من المساعد',dir:'ltr'}) as HTMLInputElement
  code.spellcheck=false;code.autocomplete='off';code.setAttribute('autocapitalize','off');code.setAttribute('data-lpignore','true');code.setAttribute('data-1p-ignore','')
  const retry=h('button',{type:'button',class:'btn btn--primary'},'اتصال') as HTMLButtonElement
  const cancel=h('button',{type:'button',class:'btn btn--secondary'},'إلغاء')
  const connection=new AbortController()
  let finished=false,interval:ReturnType<typeof setInterval>|undefined
  const stopTimer=()=>{if(interval!==undefined)clearInterval(interval);interval=undefined}
  const finish=(value:boolean)=>{if(finished)return;finished=true;stopTimer();connection.abort();signal.removeEventListener('abort',abort);card.remove();window.dispatchEvent(new Event('alkhizana:import-activity'));resolve(value)}
  const abort=()=>finish(false)
  card.append(
   h('p',{class:'word-upload-setup__intro'},'ثبت مساعد الخزانة لربط متصفحك ببرنامج الوورد لمعالجة النسخة محليا دون أي تعديل على مستنداتك'),
   h('a',{class:'btn btn--secondary word-upload-setup__download',href:'/downloads/Khizana-Word-Companion.exe'},'تنزيل مساعد الخزانة — Windows'),
   h('p',{class:'word-upload-setup__steps'},'شغّل مساعد الخزانة، وانسخ الرمز هنا، ثم اسمح بالاتصال المحلي.'),
   h('div',{class:'word-upload-setup__controls'},code,retry,cancel),
   h('div',{class:'word-upload-setup__status'},timer,status))
  host.replaceChildren(card);window.dispatchEvent(new Event('alkhizana:import-activity'))
  cancel.addEventListener('click',()=>finish(false))
  retry.addEventListener('click',async()=>{
   if(signal.aborted||finished||retry.disabled)return
   retry.disabled=true;status.textContent='جارٍ الاتصال…'
   const started=Date.now();timer.textContent='00:00'
   interval=setInterval(()=>{const seconds=Math.floor((Date.now()-started)/1000);timer.textContent=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`},1000)
   try{await connectWord(code.value,connection.signal);if(!signal.aborted)finish(true)}
   catch(error){if(!finished)status.textContent=error instanceof Error?error.message:'تعذّر الاتصال بالمساعد.'}
   finally{stopTimer();retry.disabled=false}
  })
  signal.addEventListener('abort',abort,{once:true});if(signal.aborted)abort()
 })
}
