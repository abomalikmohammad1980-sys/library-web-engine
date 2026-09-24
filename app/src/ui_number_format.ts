/** Bound repeated interface formatting without changing locale or options. */
const formats=new Map<string,Intl.NumberFormat>()
export function cachedNumberFormat(locale:string,options:Intl.NumberFormatOptions={}):Intl.NumberFormat{
 const key=JSON.stringify([locale,Object.entries(options).sort(([a],[b])=>a.localeCompare(b))])
 let value=formats.get(key)
 if(!value){value=new Intl.NumberFormat(locale,options);if(formats.size>=64)formats.delete(formats.keys().next().value!);formats.set(key,value)}
 return value
}
