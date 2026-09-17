import{mapTilerSatelliteProvider,type SatelliteProviderConfiguration}from'./satellite_map_widget';
declare const __SATELLITE_SITE_CONFIG__:unknown;
/** Vite replaces this value, so an unconfigured visit makes no config request. */
export function configuredSatelliteProvider(currentOrigin:string=globalThis.location?.origin??''):SatelliteProviderConfiguration|undefined{
 return satelliteProviderForSite(typeof __SATELLITE_SITE_CONFIG__==='undefined'?null:__SATELLITE_SITE_CONFIG__,currentOrigin);
}
/** Public build/site configuration, never an account secret or a demo-key fallback. */
export interface SatelliteSiteConfiguration{provider:'maptiler-satellite-free';enabled:boolean;publicApiKey:string;domainRestrictionsConfirmed:boolean;allowedOrigins:readonly string[]}
export function satelliteProviderForSite(raw:unknown,currentOrigin:string):SatelliteProviderConfiguration|undefined{
 if(!raw||typeof raw!=='object')return undefined;
 const config=raw as Partial<SatelliteSiteConfiguration>;
 if(config.provider!=='maptiler-satellite-free'||config.enabled!==true||config.domainRestrictionsConfirmed!==true||typeof config.publicApiKey!=='string'||!Array.isArray(config.allowedOrigins)||!config.allowedOrigins.length||config.allowedOrigins.length>8)return undefined;
 const origins:string[]=[];
 for(const value of config.allowedOrigins){if(typeof value!=='string'||value.includes('*'))return undefined;try{const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.origin!==value)return undefined;origins.push(u.origin)}catch{return undefined}}
 if(!origins.includes(currentOrigin))return undefined;
 return mapTilerSatelliteProvider({publicApiKey:config.publicApiKey,domainRestrictionsConfirmed:true});
}
