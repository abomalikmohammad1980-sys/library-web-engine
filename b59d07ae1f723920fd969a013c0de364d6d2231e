/** Separate owned coverage wording from the literal current-catalog titles. */
export function unavailableBooksUiDescription(ids:readonly string[]|undefined,books:readonly {id:string;title:string}[]):DocumentFragment{
 const fragment=document.createDocumentFragment(),count=new Set(ids??[]).size
 fragment.append(`لم تكتمل فهرسة ${count} كتاب بعد. النتائج المعروضة مؤقتة إلى حين اكتمال الفهرسة.`)
 return fragment
}
