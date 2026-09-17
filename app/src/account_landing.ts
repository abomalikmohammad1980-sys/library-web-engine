import {currentAccountClaims} from './account_authority'
export const WELCOME_SEEN_KEY='alkhizana:welcome-seen:v1'
let enteredInMemory=false
export function markGuestEntered():void{enteredInMemory=true;try{localStorage.setItem(WELCOME_SEEN_KEY,'1')}catch{/* Session-only navigation remains available. */}}
/** A guest's welcome preference is not the signed-in account state. */
export function accountLandingRoute(explicitWelcome=false):'home'|'welcome'{
 if(currentAccountClaims())return 'home'
 if(explicitWelcome)return 'welcome'
 if(enteredInMemory)return 'home'
 try{return localStorage.getItem(WELCOME_SEEN_KEY)?'home':'welcome'}catch{return 'welcome'}
}
