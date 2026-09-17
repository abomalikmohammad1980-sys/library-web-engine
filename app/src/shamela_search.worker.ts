/// <reference lib="webworker" />
import { createSearchWorkerHandler, type SearchWorkerRequest } from '../../packages/search/src/index'
const handle=createSearchWorkerHandler()
self.addEventListener('message',(event:MessageEvent<SearchWorkerRequest>)=>self.postMessage(handle(event.data)))
