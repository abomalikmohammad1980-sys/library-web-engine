/// <reference lib="webworker" />
import {extractFromDocx} from '@engine/ooxml-model'
self.addEventListener('message',(event:MessageEvent<Uint8Array>)=>{
 try{const paragraphs=extractFromDocx(event.data).paragraphs.filter(p=>!p.excluded&&Boolean(p.text)).map(p=>({index:p.index,text:p.text}));self.postMessage({paragraphs})}
 catch{self.postMessage({error:'local_docx_parse_failed'})}
})
