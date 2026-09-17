import {h,arabicNum} from './ui'
import {captureRouteResourceScope} from './resource_lifecycle'
import './styles/home_library_statistics.css'
import {icon,type IconName} from './icons'
const metricIcons:IconName[]=['book','copy','list','person','compass','globe']
const metrics=[['books','الكتب'],['pages','الصفحات'],['headings','العناوين الفهرسية'],['authors','المؤلفون'],['places','الأماكن'],['languages','لغات الترجمة المتاحة']] as const
export function homeLibraryStatisticsSection():HTMLElement {
 const scope=captureRouteResourceScope(), values=metrics.map(()=>h('strong',null,'—'))
 const section=h('section',{class:'home-library-statistics','aria-label':'إحصاءات المكتبة'},h('header',{class:'home-library-statistics__heading'},h('p',{class:'page-eyebrow'},'اكتشف ما في الخزانة'),h('h2',null,'الخزانة في أرقام')),h('div',{class:'home-library-statistics__grid'},...metrics.map(([,label],i)=>h('div',{class:'home-library-statistics__card'},h('span',{class:'home-library-statistics__icon','aria-hidden':'true'},icon(metricIcons[i]!,22)),values[i],h('span',{class:'home-library-statistics__label'},label)))))
 let loading=false
 async function load(){loading=true;const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),2500);try {const response=await fetch('/data/home-library-statistics.json',{cache:'no-cache',signal:controller.signal});if(!response.ok)throw Error();const data=await response.json();if(data.contract!=='home-library-statistics/1')throw Error();if(scope.disposed)return;metrics.forEach(([key],i)=>{values[i]!.textContent=Number.isSafeInteger(data[key])&&data[key]>=0?arabicNum(data[key]):'غير متاح'})}catch{/* Keep the last successful snapshot until the next automatic refresh. */}finally{clearTimeout(timer);loading=false}}
 let lastAttempt=0
 const update=()=>{if(scope.disposed||document.hidden||loading||Date.now()-lastAttempt<60_000)return;lastAttempt=Date.now();void load()}
 const timer=setInterval(update,300_000)
 window.addEventListener('focus',update);document.addEventListener('visibilitychange',update)
 scope.add(()=>{clearInterval(timer);window.removeEventListener('focus',update);document.removeEventListener('visibilitychange',update)})
 lastAttempt=Date.now();void load();return section
}
