// UI lengths use rem so the user's root scale affects all interface fonts.
// Document-page geometry is owned by the reader, never by the UI scale.
export function scalableUiFont(value){
 return value.replace(/(-?\d*\.?\d+)px\b/g,(_,n)=>`${Number(n)/16}rem`).replace(/(-?\d*\.?\d+)vw\b/g,(_,n)=>`calc(${n}vw * var(--interface-scale, 1))`)
}
export function interfaceFontScale(){return{postcssPlugin:'khizana-interface-font-scale',Declaration(decl){
 if(decl.prop!=='font-size'&&!decl.prop.startsWith('--step-'))return
 const selector=decl.parent?.selector??''
 if(/(^|[,\s])html(?:\b|\[)|\.page(?![-\w])|\.reading\b|\.reader__text|\.reader__pdf|\.reader__page|\.quran-page|\.sunnah-page/.test(selector))return
 if(!decl.source?.input?.file?.replaceAll('\\','/').includes('/src/styles/'))return
 if(/\bpx\b|\dpx\b/.test(decl.value))decl.value=scalableUiFont(decl.value)
}}}
