/** Explicit calendar-labelled lifespan in the opening biography, never event years. */
export function explicitBiographyDates(biography:string):{birthHijri?:number;birthGregorian?:number;deathHijri?:number;deathGregorian?:number}{
 const text=biography.slice(0,400).replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776))
 const paired=/\(\s*(\d{1,4})\s*هـ\s*[-–]\s*(\d{1,4})\s*م\s*=\s*(\d{1,4})\s*هـ\s*[-–]\s*(\d{1,4})\s*م\s*\)/u.exec(text)
 const ranges=/\(\s*(\d{1,4})\s*[-–]\s*(\d{1,4})\s*هـ\s*=\s*(\d{1,4})\s*[-–]\s*(\d{1,4})\s*م\s*\)/u.exec(text)
 const death=/\(\s*ت\s*(\d{1,4})\s*هـ(?:\s*=\s*(\d{1,4})\s*م)?\s*\)/u.exec(text)
 const values=paired?[+paired[1]!,+paired[2]!,+paired[3]!,+paired[4]!]:ranges?[+ranges[1]!,+ranges[3]!,+ranges[2]!,+ranges[4]!]:death?[0,0,+death[1]!,Number(death[2]??0)]:undefined
 if(!values)return{}
 const [bh,bg,dh,dg]=values as [number,number,number,number]
 if(dh<=0||dh>1600||bh>dh||dg&&bg>dg)return{}
 return{...(bh?{birthHijri:bh}:{}),...(bg?{birthGregorian:bg}:{}),deathHijri:dh,...(dg?{deathGregorian:dg}:{})}
}
