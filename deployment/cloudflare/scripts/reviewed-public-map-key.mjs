import ts from 'typescript';
import {satelliteCspSources} from './satellite-build-config.mjs';
/** Return only the literal spans that are provably public MapTiler configuration.
 * This never evaluates code or returns/logs the key itself. */
export function reviewedPublicMapKeySpans(path,text,html){
 if(!/^assets\/library-[A-Za-z0-9_-]+\.js$/.test(path)||!html)return [];
 try{
  if(!satelliteCspSources(html).img)return [];
  const tag=html.match(/<meta\b[^>]*\bname=["']khizana-satellite-config["'][^>]*>/i)?.[0];
  const marker=JSON.parse(decodeURIComponent(/\bcontent="([^"]*)"/.exec(tag)?.[1]||''));
  const file=ts.createSourceFile(path,text,ts.ScriptTarget.Latest,true,ts.ScriptKind.JS),spans=[];
  if(file.parseDiagnostics.length)return [];
  const truth=node=>node.kind===ts.SyntaxKind.TrueKeyword||(ts.isPrefixUnaryExpression(node)&&node.operator===ts.SyntaxKind.ExclamationToken&&ts.isNumericLiteral(node.operand)&&node.operand.text==='0');
  function visit(node){
   if(ts.isObjectLiteralExpression(node)&&node.properties.length===5){
    const fields=new Map();let valid=true;
    for(const property of node.properties){if(!ts.isPropertyAssignment(property)||!property.name||(!ts.isIdentifier(property.name)&&!ts.isStringLiteral(property.name))){valid=false;break}const name=property.name.text;if(fields.has(name)){valid=false;break}fields.set(name,property.initializer)}
    const provider=fields.get('provider'),key=fields.get('publicApiKey'),origins=fields.get('allowedOrigins');
    if(valid&&provider&&ts.isStringLiteral(provider)&&provider.text==='maptiler-satellite-free'&&key&&ts.isStringLiteral(key)&&/^[A-Za-z0-9_-]{20,128}$/.test(key.text)&&fields.get('enabled')&&truth(fields.get('enabled'))&&fields.get('domainRestrictionsConfirmed')&&truth(fields.get('domainRestrictionsConfirmed'))&&origins&&ts.isArrayLiteralExpression(origins)&&origins.elements.every(ts.isStringLiteral)&&JSON.stringify(origins.elements.map(e=>e.text))===JSON.stringify(marker.allowedOrigins))spans.push({start:key.getStart(file),end:key.end});
   }
   ts.forEachChild(node,visit);
  }
  visit(file);return spans;
 }catch{return []}
}
