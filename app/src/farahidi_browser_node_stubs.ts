/**
 * حزمة الخليل تشترك بين Node والمتصفح. في المتصفح نحقن الجداول المضغوطة
 * مسبقًا عبر provideRawText، ولذلك لا ينبغي أن يصل التنفيذ إلى هذه الدوال.
 */
export function readFileSync(): never { throw new Error('alkhalil_browser_data_not_preloaded') }
export function fileURLToPath(value: URL | string): string { return String(value) }
export function gunzipSync(): never { throw new Error('alkhalil_browser_data_not_preloaded') }
