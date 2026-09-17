import {h} from './ui'
import './styles/quran_gharib.css'
/** Vocabulary retains the prose font; only its weight changes. */
export function quranGharibEntry(word:string,meaning:string):HTMLElement{
 return h('p',{class:'quran-gharib-entry',dataset:{noTranslate:''}},h('strong',{class:'quran-resource-target-word',style:'font:inherit;font-weight:700'},word),document.createTextNode(`: ${meaning}`))
}
