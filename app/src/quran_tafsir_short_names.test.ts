import {describe,it,expect} from 'vitest'
import {SELECTABLE_TAFSIRS,tafsirDisplayName} from './quran_tafsir_registry'
describe('requested concise tafsir labels',()=>{
 for(const [slug,label] of Object.entries({kashshaf:'الكشاف - الزمخشري (ت 538 هـ)','muharrar-wajiz':'المحرر الوجيز - ابن عطية (ت 542 هـ)','fath-al-qadir':'فتح القدير - الشوكاني (ت 1250 هـ)','tahrir-tanwir':'التحرير والتنوير - ابن عاشور (ت 1393 هـ)'})){
  it(slug,()=>{const item=SELECTABLE_TAFSIRS.find(item=>'slug' in item&&item.slug===slug);expect(item).toBeDefined();expect(tafsirDisplayName(item!)).toBe(label)})
 }
})
