import {expect,it} from 'vitest'
import {cachedNumberFormat} from './ui_number_format'
it('reuses equivalent formatters and preserves locale, digits and explicit options',()=>{
 for(const locale of ['ar','en','ru'])for(const options of [{useGrouping:false},{style:'percent' as const,maximumFractionDigits:2},{style:'currency' as const,currency:'USD'}]){
  const formatter=cachedNumberFormat(locale,options)
  expect(cachedNumberFormat(locale,Object.fromEntries(Object.entries(options).reverse()))).toBe(formatter)
  for(const value of [0,12.75,-2000,NaN,Infinity])expect(formatter.format(value)).toBe(new Intl.NumberFormat(locale,options).format(value))
 }
 expect(cachedNumberFormat('ar',{useGrouping:false})).not.toBe(cachedNumberFormat('en',{useGrouping:false}))
})
it('bounds formatter storage without losing formatting when entries are evicted',()=>{
 const first=cachedNumberFormat('en',{minimumIntegerDigits:1})
 for(let digits=1;digits<=20;digits++)for(const locale of ['ar','en','ru','fr'])cachedNumberFormat(locale,{minimumIntegerDigits:digits})
 expect(cachedNumberFormat('en',{minimumIntegerDigits:1})).not.toBe(first)
 expect(cachedNumberFormat('en',{minimumIntegerDigits:1}).format(12)).toBe('12')
})
