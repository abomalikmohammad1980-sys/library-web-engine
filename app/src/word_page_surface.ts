export interface WordPageSurfaceGeometry {
  wordHeight: number
  currentMinimum: number
  bodyBottom?: number
  borderBottom?: number
  paddingBottom: number
  borderBottomInset: number
  /** المسافة من أعلى التذييل المرئي إلى أسفل الورقة؛ تُحجز بعد آخر محتوى. */
  footerTopInset?: number
  footerGap?: number
  meaningfulElementBottoms: readonly number[]
  /** الصفحات العادية المرقمة يمكن أن تقصر عن ورقة Word إذا كان متنها قصيرًا. */
  allowShrink?: boolean
  minimumHeight?: number
}

export interface WordPageStoryGeometry {
  mainBottom: number
  footnotesBottom?: number
  footerTop?: number
  pageNumberTop?: number
  pageBottom: number
  safetyGap?: number
}

/** موجب فقط عندما يتقاطع آخر متن/حاشية مع حزام التذييل أو رقم الصفحة. */
export function wordPageStoryOverlap(geometry: WordPageStoryGeometry): number {
  const contentBottom = Math.max(geometry.mainBottom, geometry.footnotesBottom ?? -Infinity)
  const obstacleTop = Math.min(geometry.footerTop ?? Infinity, geometry.pageNumberTop ?? Infinity,
    geometry.pageBottom)
  return Math.max(0, contentBottom + Math.max(0, geometry.safetyGap ?? 8) - obstacleTop)
}

/** حساب خالص لا يعتمد DOM، ويمنع تصغير الورقة أو نموها من عنصر فارغ شاذ. */
export function calculateWordPageSurfaceHeight(geometry: WordPageSurfaceGeometry): number {
  const { wordHeight, bodyBottom, paddingBottom, borderBottomInset } = geometry
  // القياسات نسبية إلى أعلى الصفحة؛ لا نبني على min-height السابق، وإلا أضاف
  // ResizeObserver نفس overflow في كل دورة وصنع فراغًا بنيًا تراكميًا.
  const floor = geometry.allowShrink
    ? Math.max(0, geometry.minimumHeight ?? 0)
    : wordHeight
  let height = bodyBottom !== undefined && !geometry.allowShrink
    ? Math.max(floor, bodyBottom + paddingBottom + borderBottomInset)
    : floor
  for (const bottom of geometry.meaningfulElementBottoms) {
    if (Number.isFinite(bottom)) {
      height = Math.max(height, bottom + paddingBottom + borderBottomInset)
      if (geometry.footerTopInset !== undefined && Number.isFinite(geometry.footerTopInset))
        height = Math.max(height, bottom + Math.max(0, geometry.footerTopInset)
          + Math.max(0, geometry.footerGap ?? 8))
    }
  }
  return Math.ceil(Math.max(floor, height))
}
