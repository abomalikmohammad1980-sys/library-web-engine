import {beforeEach,expect,it,vi} from 'vitest'
const mocks=vi.hoisted(()=>({books:vi.fn(),cloud:vi.fn(),scope:'a'}))
class Node {
 children:Node[]=[];textContent='';title='';attrs:Record<string,unknown>={}
 constructor(public tag:string,attrs:Record<string,unknown>|null,...children:unknown[]){this.attrs=attrs??{};this.append(...children)}
 append(...children:unknown[]){for(const child of children){if(child instanceof Node)this.children.push(child);else if(child!=null)this.textContent+=String(child)}}
 replaceChildren(...children:unknown[]){this.children=[];this.textContent='';this.append(...children)}
 setAttribute(key:string,value:string){this.attrs[key]=value}
 querySelectorAll(tag:string):Node[]{return this.children.flatMap(child=>[...(child.tag===tag?[child]:[]),...child.querySelectorAll(tag)])}
}
vi.mock('./ui',()=>({h:(tag:string,attrs:Record<string,unknown>|null,...children:unknown[])=>new Node(tag,attrs,...children)}))
vi.mock('./icons',()=>({icon:()=>new Node('svg',null)}))
vi.mock('./engine/library_store',()=>({listBooks:mocks.books,currentLibraryIdentityScope:()=>mocks.scope}))
vi.mock('./account_authority',()=>({currentAccountClaims:()=>undefined}))
vi.mock('./independent_pdf_edition',()=>({addIndependentPdfEdition:vi.fn()}))
vi.mock('./independent_pdf_cloud',()=>({loadCloudEditions:mocks.cloud,editionCloudId:()=>'',cloudEditionHref:()=>'/books/local/pdf',syncIndependentPdfEdition:vi.fn(),linkExistingCloudPdf:vi.fn()}))
vi.mock('./account_service',()=>({listAccountBooksPage:vi.fn()}))
vi.mock('./path_location',()=>({legacyHashToPath:(path:string)=>path.slice(1)}))
import {independentPdfPanel} from './independent_pdf_panel'
import type {StoredBook} from './engine/library_store'
beforeEach(()=>{mocks.scope='a';mocks.books.mockReset().mockResolvedValue([]);mocks.cloud.mockReset().mockResolvedValue(undefined)})
const settle=async()=>{for(let i=0;i<6;i++)await Promise.resolve()}
it('keeps an unavailable-cloud explanation behind a closed keyboard disclosure',async()=>{
 mocks.cloud.mockRejectedValue(Error('offline'))
 const root=independentPdfPanel({id:'a'} as StoredBook,false,true) as unknown as Node
 await settle()
 expect(root.tag).toBe('details');expect(root.attrs.open).toBeUndefined()
 expect(root.children[0]!.tag).toBe('summary')
 expect(root.children[0]!.attrs['aria-label']).toContain('تعذّر التحقق')
 expect(root.children[0]!.querySelectorAll('span')[0]!.textContent).toBe('!')
 expect(root.children[1]!.querySelectorAll('p').some(p=>p.textContent.includes('الطبعات المحلية محفوظة'))).toBe(true)
})
it('shows linked editions count without displaying the explanation by default',async()=>{
 mocks.books.mockResolvedValue([{id:'pdf',relatedWorkId:'a',title:'طبعة'}])
 const root=independentPdfPanel({id:'a'} as StoredBook,false,true) as unknown as Node
 await settle();expect(root.children[0]!.querySelectorAll('span')[0]!.textContent).toBe('1');expect(root.querySelectorAll('a')).toHaveLength(1)
})
it('discards a late result after identity changes',async()=>{
 let done!:(value:unknown[])=>void;mocks.books.mockImplementation(()=>new Promise(resolve=>{done=resolve}))
 const root=independentPdfPanel({id:'a'} as StoredBook,false,true) as unknown as Node
 mocks.scope='b';done([{id:'private-pdf',relatedWorkId:'a'}]);await settle()
 expect(root.querySelectorAll('a')).toHaveLength(0)
})
