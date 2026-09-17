// Vite exposes the CommonJS browser entry as a namespace when dependency
// discovery is disabled. MDBReader expects that namespace as a default value.
// @ts-expect-error browserify-aes does not publish TypeScript declarations.
import * as browserifyAes from '../../node_modules/browserify-aes/browser.js'

export default browserifyAes
