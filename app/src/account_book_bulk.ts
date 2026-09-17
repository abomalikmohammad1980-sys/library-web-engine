import type {AccountBookSubmission} from './account_service'
import type {BookMetadataUpdate} from './engine/library_store'

/** The account API requires the full metadata and current review revision. */
export function accountBulkMetadata(book:AccountBookSubmission,values:BookMetadataUpdate){
  return {
    title:book.title,
    author:values.author?.trim()||book.author,
    category:values.category===null?'غير مصنف':values.category?.trim()||book.category||'غير مصنف',
    reviewVersion:book.reviewVersion??0,
  }
}
