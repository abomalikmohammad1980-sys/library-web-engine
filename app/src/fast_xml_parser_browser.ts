// The installed fast-xml-parser v4 entry is CommonJS. With dependency
// discovery disabled Vite exposes its namespace, so bridge the named exports
// explicitly instead of blocking local startup on dependency pre-bundling.
import * as fastXmlParser from '../../node_modules/fast-xml-parser/src/fxp.js'

export const XMLParser = fastXmlParser.XMLParser
export const XMLBuilder = fastXmlParser.XMLBuilder
export const XMLValidator = fastXmlParser.XMLValidator
