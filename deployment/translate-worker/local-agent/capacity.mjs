import os from 'node:os'
export function configuredConcurrency(value=process.env.LOCAL_TRANSLATION_CONCURRENCY || '1') {
  const count=Number(value)
  if (![1,2,4].includes(count)) throw Error('invalid_local_concurrency')
  return count
}
// Only controls NEW leases; already-running jobs keep their renewal and finish.
// Does not unload model weights or guarantee responsiveness of other applications.
export function memoryCapacity(maximum,freeBytes=os.freemem()) {
  const mb=freeBytes/(1024*1024)
  if (mb<1200) return 0
  if (mb<1400) return Math.min(maximum,1)
  if (mb<1700) return Math.min(maximum,2)
  return maximum
}
