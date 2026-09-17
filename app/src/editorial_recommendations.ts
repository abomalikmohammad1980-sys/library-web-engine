export interface EditorialRecommendation {bookId:string;start:string;end:string}
export function parseEditorialRecommendations(data:unknown):{revision:number;entries:EditorialRecommendation[]}{
 if(!data||typeof data!=='object')throw Error('تعذّر قراءة الترشيحات المحفوظة؛ لم تُغيّر أي بيانات.')
 const value=data as {revision?:unknown;entries?:unknown};let entries:unknown;
 try{entries=typeof value.entries==='string'?JSON.parse(value.entries):value.entries}catch{throw Error('تعذّر قراءة الترشيحات المحفوظة؛ لم تُغيّر أي بيانات.')}
 if(!Number.isSafeInteger(value.revision)||Number(value.revision)<0||!Array.isArray(entries)||entries.length>200)throw Error('تعذّر قراءة الترشيحات المحفوظة؛ لم تُغيّر أي بيانات.')
 const ids=new Set<string>();
 for(const e of entries){
  if(!e||typeof e.bookId!=='string'||!/^[A-Za-z0-9:_-]{1,200}$/.test(e.bookId)||ids.has(e.bookId))throw Error('تعذّر قراءة الترشيحات المحفوظة؛ لم تُغيّر أي بيانات.')
  ids.add(e.bookId);
  for(const key of ['start','end'])if(typeof e[key]!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(e[key])||!Number.isFinite(Date.parse(e[key]))||new Date(e[key]).toISOString().slice(0,10)!==e[key])throw Error('تعذّر قراءة الترشيحات المحفوظة؛ لم تُغيّر أي بيانات.')
  if(e.end<e.start)throw Error('تعذّر قراءة الترشيحات المحفوظة؛ لم تُغيّر أي بيانات.')
 }
 return {revision:Number(value.revision),entries:entries.map(({bookId,start,end})=>({bookId,start,end}))}
}
export async function loadEditorialRecommendations(fetcher:typeof fetch=fetch):Promise<{revision:number;entries:EditorialRecommendation[]}>{
 for(let attempt=0;attempt<2;attempt++){
  let response:Response;
  try{response=await fetcher('/api/library/recommendations',{cache:'no-store',credentials:'same-origin',signal:AbortSignal.timeout(10000)})}
  catch{if(attempt===0)continue;throw Error('تعذّر الاتصال لتحميل الترشيحات؛ أعد المحاولة.')}
  if(!response.ok){if(attempt===0&&[408,429,500,502,503,504].includes(response.status))continue;throw Error('تعذّر تحميل ترشيحات الإدارة؛ أعد المحاولة.')}
  try{return parseEditorialRecommendations(await response.json())}catch{throw Error('تعذّر قراءة الترشيحات المحفوظة؛ لم تُغيّر أي بيانات.')}
 }
 throw Error('تعذّر تحميل ترشيحات الإدارة؛ أعد المحاولة.')
}
export function activeEditorialIds(entries:EditorialRecommendation[],now=new Date()):string[]{
 const today=now.toISOString().slice(0,10)
 const ids=entries.filter(e=>e.start<=today&&e.end>=today).map(e=>e.bookId)
 if(!ids.length)return []
 const offset=Math.floor(now.getTime()/86400000)%ids.length
 return [...ids.slice(offset),...ids.slice(0,offset)]
}
