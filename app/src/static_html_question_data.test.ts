import {it,expect} from 'vitest'
import {staticHtmlQuestionGroups} from './static_html_question_data'
it('reads literal Arabic questions in order without executing their script',()=>{
  const html='<script>const BANK=[{key:"one",name:"التهجئة",qs:[{w:"قَالَ",a:"مدّ"},{w:"رَبِّ",a:"شدّة"}]},{name:"القواعد",qs:[{q:"ما القلقلة؟",a:"اضطراب الحرف"}]}];throw Error("must not run")</script>'
  expect(staticHtmlQuestionGroups(html)).toEqual([{title:'التهجئة',items:[{prompt:'قَالَ',answer:'مدّ'},{prompt:'رَبِّ',answer:'شدّة'}]},{title:'القواعد',items:[{prompt:'ما القلقلة؟',answer:'اضطراب الحرف'}]}])
})
it('ignores scripts with computed data or unbalanced arrays',()=>{
  expect(staticHtmlQuestionGroups('<script>const BANK=makeQuestions();const BAD=[{name:"x",q:"y"}</script>')).toEqual([])
})
