/** Bound automatic retries; manual requests remain available at all times. */
export function catalogRetryDelay(attempt:number):number|undefined {
 return [3000,15000,60000][attempt]
}
