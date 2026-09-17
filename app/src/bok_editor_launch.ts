import {h} from './ui'
import {currentAccountClaims,hasAccountPermission} from './account_authority'
import type {StoredBook} from './engine/library_store'
import {bokEditorialCapabilities} from './bok_publication_service'
/** Production visibility follows authenticated server capability, never DEV or local claims alone. */
export async function appendBokEditorLaunch(host:HTMLElement,book:StoredBook):Promise<void>{
 const identity=currentAccountClaims(),ticket=crypto.randomUUID();host.dataset.bokLaunchTicket=ticket
 const current=()=>Boolean(identity&&host.isConnected&&host.dataset.bokLaunchTicket===ticket&&currentAccountClaims()?.subject===identity.subject&&currentAccountClaims()?.sessionId===identity.sessionId&&hasAccountPermission(currentAccountClaims(),'book:edit-published-metadata'))
 if(book.sourceFormat!=='shamela-bok'||!current())return
 try{const features=await bokEditorialCapabilities(current);if(!current()||!features.editingEnabled)return
 const launch=h('button',{class:'btn btn--secondary',type:'button'},'تحرير نص BOK (مسودة)') as HTMLButtonElement
 launch.onclick=async()=>{if(!current())return;launch.disabled=true;try{const {bokTextEditor}=await import('./bok_text_editor');if(!current())return;host.append(bokTextEditor(book));launch.remove()}catch{if(current()){launch.disabled=false;launch.textContent='إعادة محاولة فتح محرر النص'}}};host.append(launch)
 }catch{/* Disabled/unavailable capability never exposes a nonworking editor. */}
}
