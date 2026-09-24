export interface StaticQuestionGroup { title:string; items:Array<{prompt:string;answer:string}> }

/** Extract literal question banks from an HTML file without evaluating its scripts. */
export function staticHtmlQuestionGroups(html:string):StaticQuestionGroup[]{
  if(html.length>20*1024*1024)return []
  const groups:StaticQuestionGroup[]=[]
  for(const script of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)){
    const source=script[1]??''
    if(source.length>2*1024*1024)continue
    for(const match of source.matchAll(/\bconst\s+[A-Za-z_$][\w$]*\s*=\s*\[/g)){
      const start=(match.index??0)+match[0].length-1
      const end=arrayEnd(source,start)
      if(end<0)continue
      const entries=[...source.slice(start+1,end).matchAll(/\b(name|q|w|a)\s*:\s*("(?:\\.|[^"\\])*")/g)]
      let group:StaticQuestionGroup|undefined,last:StaticQuestionGroup['items'][number]|undefined
      let questions=0
      for(const entry of entries){
        let value:string
        try{value=JSON.parse(entry[2]!) as string}catch{continue}
        if(typeof value!=='string'||value.length>5000)continue
        if(entry[1]==='name'){group={title:value,items:[]};groups.push(group);last=undefined}
        else if(entry[1]==='q'||entry[1]==='w'){
          group??={title:'أسئلة',items:[]}
          if(!groups.includes(group))groups.push(group)
          last={prompt:value,answer:''};group.items.push(last)
          if(++questions>10000)break
        }else if(entry[1]==='a'&&last){last.answer=value;last=undefined}
      }
    }
  }
  return groups.filter(group=>group.items.length)
}

function arrayEnd(source:string,start:number):number{
  let depth=0,quote='',escaped=false
  for(let i=start;i<source.length;i++){
    const char=source[i]!
    if(quote){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char===quote)quote='';continue}
    if(char==='"'||char==="'"||char==='`'){quote=char;continue}
    if(char==='/'&&source[i+1]==='/'){i=source.indexOf('\n',i+2);if(i<0)return -1;continue}
    if(char==='/'&&source[i+1]==='*'){i=source.indexOf('*/',i+2);if(i<0)return -1;i++;continue}
    if(char==='[')depth++
    else if(char===']'&&--depth===0)return i
  }
  return -1
}
