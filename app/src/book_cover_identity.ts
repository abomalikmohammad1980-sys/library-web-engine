/** Pure identities shared with the background book parser; no DOM imports. */
export function deterministicCoverHue(seed:string):number{
 let hash=2166136261
 for(const char of seed){hash^=char.codePointAt(0)??0;hash=Math.imul(hash,16777619)}
 return Math.abs(hash)%360
}
export function deterministicCoverTemplate(seed:string):number{return deterministicCoverHue(seed)%4}
