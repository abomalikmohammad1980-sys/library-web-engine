import {it,expect} from 'vitest'
import {readFileSync} from 'node:fs'
import {loadBookFromBuffer} from './engine/bridge'
import {alignWordParagraphIndices,normalizeWordPageText,matchesWordPageParagraph,requireWordPageGroups,auditWordPageMap} from './engine/dom_render'
import type {WordPageMap} from './engine/library_store'
it.skipIf(!process.env.WORD_IMPORT_DIAGNOSTIC_SOURCE)('user-selected exact Word retains authoritative page mapping',()=>{
 const model=loadBookFromBuffer(new Uint8Array(readFileSync(process.env.WORD_IMPORT_DIAGNOSTIC_SOURCE!))).model
 const map=JSON.parse(readFileSync(process.env.WORD_IMPORT_DIAGNOSTIC_MAP!,'utf8')) as WordPageMap
 const aligned=alignWordParagraphIndices(model,map)
 if(!aligned){
  const m=model.paragraphs.filter(p=>normalizeWordPageText(p.text)),w=map.paragraphs!.filter(p=>normalizeWordPageText(p.text))
  console.log(JSON.stringify({modelCount:model.paragraphs.length,mapCount:map.paragraphs!.length,modelNonempty:m.length,mapNonempty:w.length,differences:m.flatMap((p,i)=>{
   if(w[i]&&matchesWordPageParagraph(w[i]!.text,p))return []
   const a=normalizeWordPageText(p.text),b=normalizeWordPageText(w[i]?.text??'');let at=0;while(at<Math.min(a.length,b.length)&&a[at]===b[at])at++
   return [{index:i,modelIndex:p.index,wordIndex:w[i]?.paragraphIndex,modelLength:a.length,wordLength:b.length,offset:at,codepoints:[a.codePointAt(at),b.codePointAt(at)],runKinds:p.runs.map(r=>({field:!!r.field,hidden:r.hidden,note:!!r.noteRef,sourceDiff:r.sourceText!==undefined&&r.sourceText!==r.text})),excluded:p.excluded}]
  }).slice(0,8)}))
 }
 expect(aligned).not.toBeNull();expect(requireWordPageGroups(model,map)).toHaveLength(map.totalPages)
 expect(auditWordPageMap(model,map).mismatches).toEqual([])
})
