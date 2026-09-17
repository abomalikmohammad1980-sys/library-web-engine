/** First control is installation, not an update to an already controlled page. */
export function createServiceWorkerReloadGate(initialController:boolean){
 let controlled=initialController,pending=false,reloaded=false
 const online=(safe=true)=>{if(!pending||reloaded||!safe)return false;pending=false;reloaded=true;return true}
 return{online,controllerChanged(present:boolean,isOnline:boolean,safe=true){if(!present||reloaded)return false;if(!controlled){controlled=true;return false}pending=true;return isOnline?online(safe):false}}
}
