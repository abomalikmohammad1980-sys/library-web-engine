// Confine the public corpus binding to this read-only, release-pinned route.
// Do not replace preview LIBRARY_R2 globally: account uploads must stay isolated.
export function usePublicHeadingBucket(source){
 const marker='  const request=context.request'
 if(source.split(marker).length!==2||!source.includes("if(request.method!=='GET')return fail(405"))throw Error('unreviewed_heading_handler')
 return source.replace(marker,marker+'\n  if(context.env.PUBLIC_LIBRARY_R2)context={...context,env:{...context.env,LIBRARY_R2:context.env.PUBLIC_LIBRARY_R2}}')
}
