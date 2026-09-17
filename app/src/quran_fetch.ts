// Keep the deadline active through body consumption, not just response headers.
export async function fetchQuranResource<T>(url:string,read:(response:Response)=>Promise<T>,retry=false):Promise<T>{
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000)
 try{const response=await fetch(url,{credentials:'same-origin',cache:retry?'reload':'default',signal:controller.signal});if(!response.ok)throw Error(`quran-pack-http-${response.status}`);return await read(response)}
 finally{clearTimeout(timer)}
}
