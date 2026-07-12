part of 'Paragraph.dart';

/// Extracted from Paragraph.dart to keep the core class small while
/// preserving the same library-private access and rendering behavior.
mixin ParagraphDecoration on ParagraphMembers {
  void _ensureParagraphXmlForDecoration() {
    if (pPr?.xmlpPr != null) return;
    if (xmlString.isEmpty) return;

    try {
      pXml ??= XmlDocument.parse(xmlString).rootElement;
      pPr?.xmlpPr ??= pXml?.getElement("w:pPr");
      pPr?.xmlprPr ??= pPr?.xmlpPr?.getElement("w:rPr");
      // Re-apply style merging so that paragraph-style-inherited properties
      // such as w:pBdr and w:shd are present in xmlpPr.
      // This is necessary when the Paragraph was restored from JSON cache,
      // where getPStyle() was never called during construction.
      pPr?.getPStyle();
    } catch (_) {}
  }

  ParagraphBorderSpec? getParagraphBorderSpec() {
    try {
      _ensureParagraphXmlForDecoration();
      final pBdr = pPr?.xmlpPr?.getElement("w:pBdr");
      if (pBdr == null) return null;

      final top = _parseBorderSideSpec(pBdr.getElement("w:top"));
      final bottom = _parseBorderSideSpec(pBdr.getElement("w:bottom"));
      final left = _parseBorderSideSpec(pBdr.getElement("w:left"));
      final right = _parseBorderSideSpec(pBdr.getElement("w:right"));
      final between = _parseBorderSideSpec(pBdr.getElement("w:between"));

      if (top == null && bottom == null && left == null && right == null) {
        return null;
      }

      return ParagraphBorderSpec(
        signature: pBdr.toXmlString(),
        top: top,
        bottom: bottom,
        left: left,
        right: right,
        between: between,
      );
    } catch (_) {
      return null;
    }
  }

  /// Get paragraph decoration (borders from w:pBdr)
  BoxDecoration? _getParagraphDecoration(
    Color? backgroundColor, {
    bool includeBorder = true,
  }) {
    Border? border = includeBorder ? _getParagraphBorder() : null;
    if (backgroundColor == null && border == null) return null;

    return BoxDecoration(color: backgroundColor, border: border);
  }

  /// Parse paragraph borders from w:pBdr element
  Border? _getParagraphBorder() {
    try {
      _ensureParagraphXmlForDecoration();
      final pBdr = pPr?.xmlpPr?.getElement("w:pBdr");
      if (pBdr == null) return null;

      BorderSide? top, bottom, left, right;

      // Parse each border side
      final topEl = pBdr.getElement("w:top");
      final bottomEl = pBdr.getElement("w:bottom");
      final leftEl = pBdr.getElement("w:left");
      final rightEl = pBdr.getElement("w:right");

      if (topEl != null) top = _parseBorderSide(topEl);
      if (bottomEl != null) bottom = _parseBorderSide(bottomEl);
      if (leftEl != null) left = _parseBorderSide(leftEl);
      if (rightEl != null) right = _parseBorderSide(rightEl);

      if (top == null && bottom == null && left == null && right == null) {
        return null;
      }

      return Border(
        top: top ?? BorderSide.none,
        bottom: bottom ?? BorderSide.none,
        left: left ?? BorderSide.none,
        right: right ?? BorderSide.none,
      );
    } catch (_) {
      return null;
    }
  }

  /// Parse a single border side from XML element
  BorderSide? _parseBorderSide(XmlElement element) {
    final spec = _parseBorderSideSpec(element);
    if (spec == null) return null;
    return BorderSide(color: spec.color, width: spec.width);
  }

  ParagraphBorderSideSpec? _parseBorderSideSpec(XmlElement? element) {
    if (element == null) return null;

    String? val = element.getAttribute("w:val");
    if (val == null || val == "nil" || val == "none") return null;

    String? szStr = element.getAttribute("w:sz");
    double width = 1.0;
    if (szStr != null) {
      double sz = double.tryParse(szStr) ?? 8.0;
      width = sz / 8.0;
      if (width < 0.5) width = 0.5;
      if (width > 6) width = 6;
    }

    String? spaceStr = element.getAttribute("w:space");
    double space = 0;
    if (spaceStr != null) {
      space = double.tryParse(spaceStr) ?? 0;
    }

    Color color = Colors.black;
    String? colorStr = element.getAttribute("w:color");
    String? themeColor = element.getAttribute("w:themeColor");
    if (themeColor != null) {
      String? resolved = resolveThemeColor(
        pPr?.wordDocument.themeColors ?? {},
        themeColor,
        element.getAttribute("w:themeTint"),
        element.getAttribute("w:themeShade"),
      );
      colorStr = resolved ?? colorStr;
    }
    if (colorStr != null && colorStr != "auto") {
      try {
        String hex = colorStr;
        if (hex.length == 6) hex = "FF$hex";
        color = Color(int.parse(hex, radix: 16));
      } catch (_) {}
    }

    return ParagraphBorderSideSpec(
      style: val,
      width: width,
      space: space,
      color: color,
    );
  }

  /// Build a special widget for TOC (Table of Contents) entries
  /// Uses Row layout: [Entry Text] [Dot Leaders] [Page Number]
}
