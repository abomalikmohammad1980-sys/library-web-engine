export async function registerServiceWorkerUpdate(container:Pick<ServiceWorkerContainer,'register'>):Promise<boolean>{
  try{
    const registration=await container.register('/sw.js',{scope:'/',updateViaCache: 'none'})
    if(!registration||typeof registration.update!=='function')return false
    await registration.update()
    const requestActivation=()=>registration.waiting?.postMessage({type:'khizana:request-safe-activation'})
    requestActivation()
    const installing=registration.installing
    if(installing){const changed=()=>{if(['installed','activated','redundant'].includes(installing.state)){installing.removeEventListener('statechange',changed);requestActivation()}};installing.addEventListener('statechange',changed);changed()}
    return true
  }catch{return false}
}
