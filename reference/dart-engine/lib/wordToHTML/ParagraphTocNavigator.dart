part of 'Paragraph.dart';

/// Resolves and dispatches TOC bookmark navigation for a paragraph.
///
/// `Paragraph` still owns TOC rendering, but the tap behavior is a separate
/// concern: it reads the hyperlink anchor, normalizes Word's optional leading
/// underscore, then asks the document bookmark map for the target page.
class ParagraphTocNavigator {
  const ParagraphTocNavigator._();

  static void handleTap(Paragraph paragraph) {
    final anchor = _resolveAnchor(paragraph);
    if (anchor == null) {
      // No `w:hyperlink/@w:anchor` means this TOC row is visual-only.
      return;
    }

    final bookmarkName = _normalizeBookmarkName(anchor);
    final targetPage =
        paragraph.parent.parent.bookMarksMap[bookmarkName] ??
        paragraph.parent.parent.bookMarksMap["_$bookmarkName"];

    if (targetPage == null) return;

    final onTocNavigate = AppState().onTocNavigate;
    if (onTocNavigate != null) {
      onTocNavigate(targetPage);
    }
  }

  static String? _resolveAnchor(Paragraph paragraph) {
    final cachedAnchor = paragraph.hyperlinkAnchor;
    if (cachedAnchor != null) return cachedAnchor;

    final hyperlink = paragraph.pXml?.getElement("w:hyperlink");
    return hyperlink?.getAttribute("w:anchor");
  }

  static String _normalizeBookmarkName(String anchor) {
    // Word often stores TOC anchors as `_Toc...` while the bookmark map may use
    // either form, so lookup tries the normalized and original-prefixed names.
    return anchor.startsWith("_") ? anchor.substring(1) : anchor;
  }
}
