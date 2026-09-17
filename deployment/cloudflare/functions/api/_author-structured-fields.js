const dates=new Set(['birthHijri','birthGregorian','deathHijri','deathGregorian'])
const scalars=new Set(['birthPlace','deathPlace','fullName','lineage'])
const arrays=new Set(['knownAs','places','traits','categories','teachers','students','positions','works'])
const safeText=value=>typeof value==='string'&&!/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)
export function validateAuthorFields(value){
 if(!value||typeof value!=='object'||Array.isArray(value))return{field:'fields',reason:'invalid_type'}
 for(const [key,item]of Object.entries(value)){
  const field='fields.'+key
  if(dates.has(key)){if(item!==null&&(!Number.isSafeInteger(item)||item< -10000||item>3000))return{field,reason:'invalid_date'}}
  else if(scalars.has(key)){if(item!==null&&(!safeText(item)||item.length>500))return{field,reason:'invalid_text'}}
  else if(arrays.has(key)){const maxLength=key==='works'?500:300;if(!Array.isArray(item)||item.length>50||item.some(text=>!safeText(text)||!text.trim()||text.length>maxLength))return{field,reason:'invalid_list',maxLength}}
  else if(key==='contemporary'){if(typeof item!=='boolean')return{field,reason:'invalid_type'}}
  else return{field,reason:'unknown_field'}
 }
 if(value.contemporary&&(value.deathHijri!=null||value.deathGregorian!=null||value.deathPlace))return{field:'fields',reason:'date_order'}
 for(const calendar of ['Hijri','Gregorian']){const birth=value['birth'+calendar],death=value['death'+calendar];if(typeof birth==='number'&&typeof death==='number'&&death<birth)return{field:'fields.death'+calendar,reason:'date_order'}}
 if(new TextEncoder().encode(JSON.stringify(value)).length>32768)return{field:'fields',reason:'too_long',maxLength:32768,unit:'bytes'}
 return null
}
export function publicAuthorFields(row){const {fieldsJson,...rest}=row;const fields=JSON.parse(fieldsJson??'{}');if(validateAuthorFields(fields))throw Error('stored_author_fields_invalid');return{...rest,fields}}
