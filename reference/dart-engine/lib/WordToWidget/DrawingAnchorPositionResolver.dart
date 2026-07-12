import 'package:golden_shamela/Utils/ImageParser.dart';
import 'package:golden_shamela/wordToHTML/SectPr.dart';

/// Resolves page coordinates for floating DrawingML anchors (`wp:anchor`).
///
/// Keep this XML-driven: callers pass parsed `relativeFrom`, `posOffset`,
/// dimensions, and section margins. Do not add per-book visual nudges here.
class DrawingAnchorPositionResolver {
  static double resolveTop({
    required ImageData image,
    required SectPr sectPr,
  }) {
    final pageHeight = sectPr.height ?? 842;
    final topMargin = sectPr.topMargin;
    final bottomMargin = sectPr.bottomMargin;
    final marginAreaHeight = pageHeight - topMargin - bottomMargin;

    final usesVAlign =
        image.posY == 0 &&
        (image.alingV == 'center' || image.alingV == 'bottom');

    if (usesVAlign && image.alingV == 'center') {
      if (image.relativeFromV == 'page') {
        return (pageHeight - image.height) / 2;
      }
      return topMargin + (marginAreaHeight - image.height) / 2;
    }

    if (usesVAlign && image.alingV == 'bottom') {
      if (image.relativeFromV == 'page') {
        return pageHeight - image.height;
      }
      return pageHeight - bottomMargin - image.height;
    }

    final rawTop = _resolveOffsetTop(
      image: image,
      topMargin: topMargin,
    );

    // Word keeps margin-relative floating pictures that are taller than the
    // printable margin rectangle but still fit on the physical page inside the
    // page bounds. This prevents a cover-like `wrapSquare` picture from being
    // clipped at the top when its `posOffset` is negative relative to `margin`.
    if (_isOversizedMarginRelativePagePicture(
      image: image,
      pageHeight: pageHeight,
      marginAreaHeight: marginAreaHeight,
      rawTop: rawTop,
    )) {
      return (pageHeight - image.height) / 2;
    }

    return rawTop;
  }

  static double _resolveOffsetTop({
    required ImageData image,
    required double topMargin,
  }) {
    if (image.relativeFromV == 'page' || image.relativeFromV == 'topMargin') {
      return image.posY;
    }

    // `margin`, `paragraph`, and line-like fallbacks are currently rendered in
    // the page-level stack, so their margin base is the top page margin.
    return image.posY + topMargin;
  }

  static bool _isOversizedMarginRelativePagePicture({
    required ImageData image,
    required double pageHeight,
    required double marginAreaHeight,
    required double rawTop,
  }) {
    if (image.relativeFromV != 'margin') return false;
    if (image.wrapMode == null || image.wrapMode == 'None') return false;
    if (image.height <= marginAreaHeight) return false;
    if (image.height > pageHeight) return false;
    return rawTop < 0;
  }
}
