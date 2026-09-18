import descriptor from '../app/src/heading_dictionary_release.generated.json'
import {serveHeadingPartition} from './heading-static-partition.mjs'
export const onRequest=context=>serveHeadingPartition(context.request,context.env.ASSETS,descriptor)
