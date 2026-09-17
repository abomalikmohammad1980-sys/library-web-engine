import { h } from './ui'
export function decorativeImage(className:string,src:string):HTMLImageElement{const image=h('img',{class:className,src,alt:'','aria-hidden':'true',decoding:'async'}) as HTMLImageElement;image.addEventListener('error',()=>{image.hidden=true;image.removeAttribute('src')},{once:true});return image}
