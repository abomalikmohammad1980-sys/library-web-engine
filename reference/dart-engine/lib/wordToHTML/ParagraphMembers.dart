part of 'Paragraph.dart';

/// Structural contract shared by Paragraph mixins.
///
/// Dart mixins cannot safely use `on Paragraph` while `Paragraph` itself is
/// composed from those mixins. This contract lists the mutable paragraph state
/// the extracted responsibilities need, and the real fields in [Paragraph]
/// satisfy it without changing runtime behavior.
mixin ParagraphMembers {
  PPr? get pPr;
  set pPr(PPr? value);
  RPr? get prPr;
  set prPr(RPr? value);
  String? get customPageNumber;
  set customPageNumber(String? value);
  String? get _cachedRenderedPlainText;
  set _cachedRenderedPlainText(String? value);
  List<runT> get runs;
  set runs(List<runT> value);
  String get text;
  set text(String value);
  XmlElement? get pXml;
  set pXml(XmlElement? value);
  String get xmlString;
  set xmlString(String value);
  String get pageNum;
  set pageNum(String value);
  List<runT> get imageRunTs;
  set imageRunTs(List<runT> value);
  List<runT> get textRunTs;
  set textRunTs(List<runT> value);
  TextAlign get textAlign;
  set textAlign(TextAlign value);
  WordPage get parent;
  set parent(WordPage value);
  TextDirection get textDirection;
  set textDirection(TextDirection value);
  String get sectionType;
  set sectionType(String value);
  String? get hyperlinkAnchor;
  set hyperlinkAnchor(String? value);
  bool get suppressHyperlinkStyleInheritance;
  set suppressHyperlinkStyleInheritance(bool value);
  Map<String, RelId>? get customRelIdList;
  set customRelIdList(Map<String, RelId>? value);
  bool get isHeaderParagraph;
  set isHeaderParagraph(bool value);
  bool get isFooterParagraph;
  set isFooterParagraph(bool value);
  bool get resolveHeaderFooterFields;
  set resolveHeaderFooterFields(bool value);
  double get footerStoryYOffset;
  set footerStoryYOffset(double value);
  bool get preventWrap;
  set preventWrap(bool value);
  bool get shrinkTextLayerWidth;
  set shrinkTextLayerWidth(bool value);
  bool get applyHeaderTextInsets;
  set applyHeaderTextInsets(bool value);
  bool get disableUrlAutoDetection;
  set disableUrlAutoDetection(bool value);
  bool get isTableCellParagraph;
  set isTableCellParagraph(bool value);
  Color? get textBoxFillColor;
  set textBoxFillColor(Color? value);
}
