import {renderBoundUiTemplate} from './ui_template_binding'

/** Public submission reader IDs wrap the server record ID; private IDs do not. */
export function centralBookRecordId(id:string):string{
 if(id.startsWith('account-book:'))throw Error('private_book_is_not_central');
 const match=/^central-submission:([A-Za-z0-9_-]{1,200})$/.exec(id);
 if(id.startsWith('central-submission:')&&!match)throw Error('invalid_central_book_id');
 return match?match[1]!:id;
}

export function centralBookHideConfirmation(title:string,language=typeof document==='undefined'?'ar':document.documentElement.lang||'ar'):string{
  return renderBoundUiTemplate('0473343b0c100781',{p1:title},language)
}

export function confirmCentralBookHide(title:string,ask:(message:string)=>boolean=message=>window.confirm(message)):boolean{
  return ask(centralBookHideConfirmation(title))
}
