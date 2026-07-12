part of 'Paragraph.dart';

/// Small layout predicates shared by paragraph rendering and text-span layout.
/// Keeping them isolated avoids dependency cycles between the larger mixins.
mixin ParagraphLayoutFlags on ParagraphMembers {
  bool _hasExplicitLineBreaks() {
    return textRunTs.any((run) => run.hasBrBefore || run.hasBrAfter);
  }

  bool _hasFramePr() {
    return pPr?.xmlpPr?.getElement("w:framePr") != null;
  }

  bool _shouldKeepHeaderFooterSingleLine() {
    if (!isHeaderParagraph) return false;
    if (_hasFramePr()) return false;
    if (_hasExplicitLineBreaks()) return false;
    return true;
  }

}
