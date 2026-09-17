/** A selected author's established date cannot be overridden by import/batch controls. */
export function importAuthorDeath(fields:{death:Pick<HTMLInputElement,'value'|'readOnly'|'disabled'>;contemporary:Pick<HTMLInputElement,'checked'|'disabled'>}){
 const {death,contemporary}=fields;let fixed:number|undefined,deceased=false
 const sync=()=>{if(fixed!==undefined)death.value=String(fixed);if(deceased)contemporary.checked=false;death.readOnly=fixed!==undefined;contemporary.disabled=deceased;death.disabled=contemporary.checked;if(contemporary.checked)death.value=''}
 return {sync,select(author:{deathYearHijri?:number|null;deathYearGregorian?:number|null;contemporary?:boolean}){fixed=typeof author.deathYearHijri==='number'&&Number.isFinite(author.deathYearHijri)?author.deathYearHijri:undefined;deceased=fixed!==undefined||typeof author.deathYearGregorian==='number'&&Number.isFinite(author.deathYearGregorian);death.value=fixed===undefined?'':String(fixed);contemporary.checked=!deceased&&Boolean(author.contemporary);sync()},clear(){fixed=undefined;deceased=false;death.value='';contemporary.checked=false;sync()}}
}
