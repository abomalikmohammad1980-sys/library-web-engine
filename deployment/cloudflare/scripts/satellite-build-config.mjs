// Public browser key only. Never include input values in diagnostics or markers.
function validOrigins(values){
 return Array.isArray(values)&&values.length>0&&values.length<=8&&values.every(value=>{
  if(typeof value!=='string'||value.includes('*'))return false;
  try{const u=new URL(value);return u.protocol==='https:'&&!u.username&&!u.password&&u.origin===value}catch{return false}
 });
}
export function satelliteBuildConfiguration(env){
 if(env.VITE_MAPTILER_ENABLED!=='true')return null;
 let origins;try{origins=JSON.parse(env.VITE_MAPTILER_ALLOWED_ORIGINS||'null')}catch{throw Error('satellite_build_config_invalid')}
 if(env.VITE_MAPTILER_DOMAIN_RESTRICTIONS_CONFIRMED!=='true'||typeof env.VITE_MAPTILER_PUBLIC_KEY!=='string'||!(/^[A-Za-z0-9_-]{16,128}$/).test(env.VITE_MAPTILER_PUBLIC_KEY)||!validOrigins(origins))throw Error('satellite_build_config_invalid');
 return {provider:'maptiler-satellite-free',enabled:true,publicApiKey:env.VITE_MAPTILER_PUBLIC_KEY,domainRestrictionsConfirmed:true,allowedOrigins:[...origins]};
}
export function satelliteBuildMarker(config){
 if(!config)return '';
 return `<meta name="khizana-satellite-config" content="${encodeURIComponent(JSON.stringify({schema:1,provider:'maptiler-satellite-free',allowedOrigins:config.allowedOrigins}))}">`;
}
export function satelliteCspSources(html){
 const tags=html.match(/<meta\b[^>]*\bname=["']khizana-satellite-config["'][^>]*>/gi)||[];
 if(!tags.length)return {script:'',style:'',img:''};
 try{
  if(tags.length!==1)throw Error();
  const content=/\bcontent="([^"]*)"/.exec(tags[0])?.[1];
  if(!content||content.length>4096)throw Error();
  const marker=JSON.parse(decodeURIComponent(content));
  if(marker.schema!==1||marker.provider!=='maptiler-satellite-free'||!validOrigins(marker.allowedOrigins)||Object.keys(marker).sort().join(',')!=='allowedOrigins,provider,schema')throw Error();
  return {script:' https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',style:' https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',img:' https://api.maptiler.com/tiles/satellite-v2/ https://api.maptiler.com/resources/logo.svg'};
 }catch{throw Error('satellite_build_marker_invalid')}
}
