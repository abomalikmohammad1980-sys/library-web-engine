// Literal release boundary: callers cannot select repository, workflow or origin.
import {createActionsExtractor} from './worker.js'
export default {fetch:createActionsExtractor({workflow:'public-book-ingestion-production.yml'})}
