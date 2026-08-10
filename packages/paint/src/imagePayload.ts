import { rasterPayload } from "@engine/ooxml-dom";

/** يحول وسيط Word القديم إلى صيغة متصفح قبل إنشاء Blob؛ null = غير مدعوم بصدق. */
export function paintImagePayload(bytes: Uint8Array): { bytes: Uint8Array; mime: string } | null {
  return rasterPayload(bytes);
}
