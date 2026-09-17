import type {CentralHeadingSearchClient} from './central_heading_search'
/** Explicit release gate. coveredBookIds are PUBLIC IDs; client rows and filters use SOURCE IDs. Private IDs must never be offset. */
export interface CentralHeadingProvider {client:Pick<CentralHeadingSearchClient,'search'>;coveredBookIds:ReadonlySet<string>;releaseId:string}
let provider:CentralHeadingProvider|undefined
export function configureCentralHeadingSearch(value:CentralHeadingProvider|undefined):void {provider=value}
export function centralHeadingProvider():CentralHeadingProvider|undefined{return provider}
export function searchResultIdentity(row:{resultKey?:string;bookId:string;paraIndex:number;field:string;pageIndex?:number;matchText:string}):string {
 return row.resultKey??(row.field==='body'?`${row.bookId}:${row.paraIndex}`:JSON.stringify([row.bookId,row.field,row.pageIndex??row.paraIndex,row.matchText]))
}
