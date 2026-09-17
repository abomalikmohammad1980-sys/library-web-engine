/** Only explicit, validated source references establish a shared commentary range. */
export function sourceReferenceRange(value:unknown,surah:number,ayah:number):{from:number;to:number}|undefined {
 const pack=value as {schemaVersion?:number;sourceEntries?:unknown;totalAyahs?:number}
 if(pack.schemaVersion!==2||pack.sourceEntries===undefined)return
 if(!Array.isArray(pack.sourceEntries))throw Error('source_reference_entries')
 const entries=new Map<number,{kind:string;target?:{surah:number;ayah:number}}>()
 for(const raw of pack.sourceEntries){
  if(!raw||!Number.isInteger(raw.ayah)||raw.ayah<1||raw.ayah>Number(pack.totalAyahs)||entries.has(raw.ayah)||!['commentary','reference','absent'].includes(raw.kind))throw Error('source_reference_identity')
  if(raw.kind==='reference'&&(!raw.target||raw.target.surah!==surah||!Number.isInteger(raw.target.ayah)||raw.target.ayah<1||raw.target.ayah>Number(pack.totalAyahs)))throw Error('source_reference_target')
  entries.set(raw.ayah,raw)
 }
 const resolve=(key:number)=>{const seen=new Set<number>();for(;;){if(seen.has(key))throw Error('source_reference_cycle');seen.add(key);const row=entries.get(key);if(!row)throw Error('source_reference_missing');if(row.kind!=='reference')return row.kind==='commentary'?key:undefined;key=row.target!.ayah}}
 if(!entries.has(ayah))return
 const target=resolve(ayah);if(target===undefined)return
 const group=[...entries.keys()].filter(key=>resolve(key)===target).sort((a,b)=>a-b)
 if(group.length<2)return
 // Do not describe a discontinuous group as a continuous range.
 if(group.some((v,i)=>i>0&&v!==group[i-1]!+1))return
 return {from:group[0]!,to:group.at(-1)!}
}
