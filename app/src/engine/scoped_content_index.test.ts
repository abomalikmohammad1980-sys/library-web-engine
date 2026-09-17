import { expect, it } from 'vitest';
import { zipSync, strToU8 } from 'fflate';
import type { StoredBook } from './library_store';
import { scopedContentIndex } from './scoped_content_index';
const book=(value:Partial<StoredBook>)=>({id:'local',fileName:'book.bok',sourceFormat:'shamela-bok',data:new Uint8Array(),...value}) as StoredBook;
it('raw reader JSON preserves explicit body/foot and page anchors after identity/SHA checks',async()=>{
 const raw={contract:'shamela-sqlite-pack/book-1',workId:'shamela4_1:12',pages:[{sourceRowId:'5',sequence:0,body:'متن',foot:'حاشية'}]};const data=strToU8(JSON.stringify(raw));const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',data))].map(b=>b.toString(16).padStart(2,'0')).join('');
 const source=book({data,originalSha256:digest,sourceBookId:'12',bokPages:[{id:5,text:'متن\n_________\nحاشية',part:1,page:3}]});
 expect((await scopedContentIndex(source,'foot')).segments).toMatchObject([{text:'حاشية',anchorIndex:0}]);
 expect((await scopedContentIndex(source,'both')).segments.map(s=>s.text)).toEqual(['متن','حاشية']);
 expect((await scopedContentIndex({...source,sourceBookId:'13'},'foot')).complete).toBe(false);
});
it('legacy BOK and PDF never infer footnotes; both preserves existing unclassified text',async()=>{
 const source=book({bokPages:[{id:1,text:'متن\n___\nحاشية محتملة',part:1,page:1}]});
 expect((await scopedContentIndex(source,'both')).segments[0]?.text).toBe(source.bokPages![0]!.text);
 expect((await scopedContentIndex(source,'foot')).complete).toBe(false);
 expect((await scopedContentIndex(book({sourceFormat:'pdf',extractedText:'نص مستخرج'}),'body')).complete).toBe(false);
});
it('text document is body, not inferred notes',async()=>{
 const source=book({sourceFormat:'text',fileName:'a.txt',data:strToU8('نص\n___\nليس حاشية مهيكلة')});
 expect((await scopedContentIndex(source,'foot'))).toMatchObject({segments:[],complete:true});expect((await scopedContentIndex(source,'body')).segments).toHaveLength(1);
});
it('real DOCX parser retains complete structured footnote paragraphs',async()=>{
 const doc='<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>متن</w:t><w:footnoteReference w:id="7"/></w:r></w:p></w:body></w:document>';
 const notes='<w:footnotes xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:footnote w:id="7"><w:p><w:r><w:t>حاشية أولى</w:t></w:r></w:p><w:p><w:r><w:t>تكملة</w:t></w:r></w:p></w:footnote></w:footnotes>';
 const data=zipSync({'word/document.xml':strToU8(doc),'word/footnotes.xml':strToU8(notes)});
 const result=await scopedContentIndex(book({sourceFormat:'word',fileName:'a.docx',data}),'foot');
 const bodyResult=await scopedContentIndex(book({sourceFormat:'word',fileName:'a.docx',data}),'body');
 expect(result.complete).toBe(true);expect(result.segments.map(s=>s.text)).toEqual(['حاشية أولى','تكملة']);expect(result.segments.every(s=>s.anchorIndex===bodyResult.segments[0]?.anchorIndex)).toBe(true);expect(result.segments[0]?.anchorIndex).not.toBeNull();
});
