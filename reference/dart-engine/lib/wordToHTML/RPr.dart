import 'package:flutter/material.dart';
import 'package:flutter/painting.dart';
import 'package:golden_shamela/Utils/XmlElementClone.dart';
import 'package:golden_shamela/main.dart';
import 'package:golden_shamela/wordToHTML/DocumentStyles.dart';
import 'package:golden_shamela/wordToHTML/runT.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:xml/xml.dart';

import '../Models/WordDocument.dart';

part 'RPr.g.dart';

const Map<String, String> _wordColorMap = {
  "black": "000000",
  "blue": "0000FF",
  "cyan": "00FFFF",
  "green": "008000",
  "magenta": "FF00FF",
  "red": "FF0000",
  "yellow": "FFFF00",
  "white": "FFFFFF",
  "darkBlue": "00008B",
  "darkCyan": "008B8B",
  "darkGreen": "006400",
  "darkMagenta": "8B008B",
  "darkRed": "8B0000",
  "darkYellow": "808000",
  "darkGray": "A9A9A9",
  "lightGray": "D3D3D3",
};

String? _normalizeColor(String? color) {
  if (color == null) return null;
  // Check if it's a named color
  if (_wordColorMap.containsKey(color)) {
    return _wordColorMap[color];
  }
  // Otherwise, just sanitize it
  return color.replaceAll("#", "");
}

/// resolveThemeColor with tint/shade
String? resolveThemeColor(
  Map<String, String> themeColors,
  String? themeColorName,
  String? themeTint,
  String? themeShade,
) {
  if (themeColorName == null) return null;

  // Word XML uses alternative names for theme colors
  // e.g., "background1" in w:themeColor maps to "light1" in a:clrScheme
  const themeColorAliases = {
    'background1': 'light1',
    'text1': 'dark1',
    'background2': 'light2',
    'text2': 'dark2',
    'lt1': 'light1',
    'dk1': 'dark1',
    'lt2': 'light2',
    'dk2': 'dark2',
  };
  String resolvedName = themeColorAliases[themeColorName] ?? themeColorName;

  String? baseHex = themeColors[resolvedName];
  if (baseHex == null || baseHex.length < 6) return null;

  if (themeTint != null && themeTint.isNotEmpty) {
    int tint = int.tryParse(themeTint, radix: 16) ?? 255;
    baseHex = _applyTint(baseHex, tint);
  }

  if (themeShade != null && themeShade.isNotEmpty) {
    int shade = int.tryParse(themeShade, radix: 16) ?? 255;
    baseHex = _applyShade(baseHex, shade);
  }

  return baseHex;
}

String _applyTint(String hex, int tintValue) {
  int r = int.parse(hex.substring(0, 2), radix: 16);
  int g = int.parse(hex.substring(2, 4), radix: 16);
  int b = int.parse(hex.substring(4, 6), radix: 16);

  r = (r + (255 - r) * (255 - tintValue) / 255).round().clamp(0, 255);
  g = (g + (255 - g) * (255 - tintValue) / 255).round().clamp(0, 255);
  b = (b + (255 - b) * (255 - tintValue) / 255).round().clamp(0, 255);

  return r.toRadixString(16).padLeft(2, '0') +
      g.toRadixString(16).padLeft(2, '0') +
      b.toRadixString(16).padLeft(2, '0');
}

String _applyShade(String hex, int shadeValue) {
  int r = int.parse(hex.substring(0, 2), radix: 16);
  int g = int.parse(hex.substring(2, 4), radix: 16);
  int b = int.parse(hex.substring(4, 6), radix: 16);

  r = (r * shadeValue / 255).round().clamp(0, 255);
  g = (g * shadeValue / 255).round().clamp(0, 255);
  b = (b * shadeValue / 255).round().clamp(0, 255);

  return r.toRadixString(16).padLeft(2, '0') +
      g.toRadixString(16).padLeft(2, '0') +
      b.toRadixString(16).padLeft(2, '0');
}

@JsonSerializable(explicitToJson: true, constructor: 'empty')
class RPr {
  @JsonKey(ignore: true)
  XmlElement? rPr;
  String? color;
  String? uColor;
  String? highlightColor;
  double? fontSize;
  double? spacing;
  bool? b;
  bool? i;
  bool? u;
  bool? rtl;
  bool? strike;
  bool? vanish;
  String? font;
  String? enFont, uniqueFont;
  String? vertAlign;
  String? rStyle;
  @JsonKey(ignore: true)
  runT parent;
  @JsonKey(ignore: true)
  late WordDocument wordDocument = parent.parent.parent.parent;
  RPr(this.parent);

  RPr.empty() : parent = runT.empty();

  factory RPr.fromJson(Map<String, dynamic> json) => _$RPrFromJson(json);
  Map<String, dynamic> toJson() => _$RPrToJson(this);

  static RPr fromMap(Map<String, dynamic> json, runT? parent) {
    final rPr = _$RPrFromJson(json);
    if (parent != null) {
      rPr.parent = parent;
      rPr.wordDocument = parent.parent.parent.parent;
    }
    return rPr;
  }

  @JsonKey(ignore: true)
  List<String> doneElements = [
    "b",
    "i",
    "u",
    "rtl",
    "color",
    "highlight",
    "shd",
    "sz",
    "szCs",
    "rFonts",
    "strike",
    "vertAlign",
    "bCs",
    "rStyle",
    "vanish",
  ];

  RPr fromXml(XmlElement? xmlrPr) {
    this.rPr = xmlrPr;

    rStyle = this.rPr?.getElement("w:rStyle")?.getAttribute("w:val");
    getRStyle();

    xmlrPr?.childElements.forEach((xmlElement) {
      if (!doneElements.contains(xmlElement.name.local)) {
        // print("rpr:"+xmlElement.name.local);
        // print("rpr:"+xmlElement.toXmlString(pretty: true));
      }
    });

    b = isBold();
    i = isItalic();
    u = isUnderLine();
    rtl = isRtl();
    color = getColor();
    uColor = getUColor();
    highlightColor = getHLColor();
    if (highlightColor == null) highlightColor = getShdColor();
    fontSize = getFontSize();
    spacing = getSpacing();
    getFonts();
      strike = hasStrike();
      vertAlign = getVerticalAlign();
      vanish = isVanish();

      return this;
    }

  TextStyle getTextStyle() {
    String? finalHlColor = _normalizeColor(highlightColor);
    Paint paint = Paint()
      ..color = Color(int.parse("0xFF${finalHlColor ?? "000000"}"));

    Paint? hlColor = highlightColor != null ? paint : null;
    String? finalColor = _normalizeColor(color);

    // Reduce font size for superscript/subscript (Word uses ~58% of normal size)
    double effectiveFontSize = fontSize ?? 14;

    if (vertAlign == "superscript" || vertAlign == "subscript") {
      effectiveFontSize = effectiveFontSize * 0.58;
    }

    // Check for bold in font name if not explicitly set by XML
    // Fix: Use the cleaner helper method from WordDocument instead of ad-hoc logic
    FontWeight? implicitWeight = font != null
        ? getImplicitFontWeight(font!)
        : null;

    // Priority:
    // 1. XML property (b=true/false)
    // 2. Implicit weight from name (if XML is not explicit)
    FontWeight? finalFontWeight;

    if (b == true) {
      finalFontWeight = FontWeight.bold;
    } else if (b == false) {
      finalFontWeight = FontWeight.normal;
    } else {
      // b is null (not set), fallback to implicit weight
      finalFontWeight = implicitWeight;
    }

    return TextStyle(
      fontWeight: finalFontWeight,
      fontStyle: i == true ? FontStyle.italic : FontStyle.normal,
      decoration: getTextDecoration(),
      color: finalColor != null
          ? Color(int.parse("0xFF$finalColor"))
          : Colors.black,
      background: hlColor, // لون خلفية النص
      fontSize: effectiveFontSize,
      fontFamily: font != null ? normalizeFontFamily(font!) : null,
      fontFamilyFallback: const ['Traditional Arabic'],
      letterSpacing: spacing ?? 0,
      // height is set by paragraph's w:spacing, not here
    );
  }

  double? getSpacing() {
    final spacingVal = rPr?.getElement("w:spacing")?.getAttribute("w:val");
    if (spacingVal == null) return null;

    final twips = double.tryParse(spacingVal);
    if (twips == null) return null;

    return twips * (96.0 / 1440.0);
  }

  String toHTML() {
    String bold = b == true ? '''font-weight: bold;''' : "";
    String italic = i == true ? '''font-style: italic; ''' : "";
    String underLine = u == true
        ? '''text-decoration: underline single #$uColor; '''
        : "";
    String colorH = color != null ? '''color: #$color; ''' : "";
    String hlColorH = highlightColor != null
        ? "background-color:$highlightColor;"
        : "";
    String isRtl = rtl == true ? "direction: rtl;" : "";
    String fontSizeH = getFontSizeH();
    String fontH = getFontH();
    String strikeH = getStrikeH();
    String html =
        '''$fontH style="$colorH$bold$italic$underLine$hlColorH$isRtl$fontSizeH$strikeH" ''';

    return html;
  }

  TextDirection? getTextDirection() {
    if (isRtl() == true)
      return TextDirection.rtl;
    else if (isRtl() == false)
      return TextDirection.ltr;
    else
      return null;
  }

  String? getColor() {
    String? color = rPr?.getElement("w:color")?.getAttribute("w:val");
    if (color == "auto") color = wordDocument?.autoDarkColor ?? "000000 ";
    return color;
  }

  bool? isBold() {
    var element = rPr?.getElement("w:b") ?? rPr?.getElement("w:bCs");
    if (element == null) return null;
    String? val = element.getAttribute("w:val");
    if (val == "0" || val == "false" || val == "off") return false;
    return true;
  }

  bool? isItalic() {
    var element = rPr?.getElement("w:i") ?? rPr?.getElement("w:iCs");
    if (element == null) return null;
    String? val = element.getAttribute("w:val");
    if (val == "0" || val == "false" || val == "off") return false;
    return true;
  }

  bool? isUnderLine() {
    final underlineElement = rPr?.getElement("w:u");
    if (underlineElement == null) return null;

    final value = underlineElement.getAttribute("w:val")?.toLowerCase();
    if (value == "none" || value == "0" || value == "false" || value == "off") {
      return false;
    }

    return true;
  }

  String? getUColor() {
    String? underLineColor = rPr?.getElement("w:u")?.getAttribute("w:color");
    return underLineColor ?? "000000";
  }

  String? getHLColor() {
    String? hlColor = rPr?.getElement("w:highlight")?.getAttribute("w:val");
    return hlColor;
  }

  bool? isRtl() {
    if (rPr?.getElement("w:rtl") != null)
      return true;
    else if (rPr?.getElement("w:ltr") != null)
      return false;
    else
      return null;
  }

  String? getShdColor() {
    XmlElement? shdElem = rPr?.getElement("w:shd");
    if (shdElem == null) return null;

    // Resolve theme fill first
    String? themeFill = shdElem.getAttribute("w:themeFill");
    if (themeFill != null) {
      String? resolved = resolveThemeColor(
        wordDocument.themeColors,
        themeFill,
        shdElem.getAttribute("w:themeFillTint"),
        shdElem.getAttribute("w:themeFillShade"),
      );
      if (resolved != null) return "#$resolved";
    }

    String? shd = shdElem.getAttribute("w:fill");
    if (shd == null) return null;
    return "#" + shd;
  }

  double? getFontSize() {
    // try to get szCs first for Arabic/Complex script
    String? sz = rPr?.getElement("w:szCs")?.getAttribute("w:val");
    // fallback to sz if szCs is missing
    sz ??= rPr?.getElement("w:sz")?.getAttribute("w:val");

    late double fSz;
    if (sz == null) return null;

    // w:sz is in half-points
    double points = double.parse(sz) / 2;

    // Convert points to logical pixels (approx 1.333 ratio at 96 DPI)
    // 1 point = 1/72 inch, 1 inch = 96 pixels -> 1 point = 96/72 = 1.333 pixels
    fSz = points * 1.333;

    // print("FONT DEBUG: sz/szCs=$sz, points=$points, pixelSize=$fSz");

    return fSz;
  }

  String getFontSizeH() {
    if (fontSize == null) fontSize = 14 + 14 * 0.1;
    return "font-size:$fontSize px;";
  }

  bool? hasStrike() {
    var element = rPr?.getElement("w:strike");
    if (element == null) return null;
    String? val = element.getAttribute("w:val");
    if (val == "0" || val == "false" || val == "off") return false;
    return true;
  }

  /// Check if text is hidden (w:vanish element)
  bool? isVanish() {
    var element = rPr?.getElement("w:vanish");
    if (element == null) return null;
    String? val = element.getAttribute("w:val");
    if (val == "0" || val == "false" || val == "off") return false;
    return true;
  }

  String getStrikeH() {
    return strike == true ? " text-decoration: line-through" : "";
  }

  String? getArFont() {
    XmlElement? rFonts = rPr?.getElement("w:rFonts");
    String? cs = rFonts?.getAttribute("w:cs");

    // إذا كان w:cs موجوداً وليس خطاً مشكلاً، نستخدمه
    if (cs != null && cs.isNotEmpty && !isProblemFont(cs)) {
      // debugPrint("DEBUG_FONT: getArFont found w:cs='$cs'");
      return cs;
    }

    // إذا كان w:cs مشكلاً أو غير موجود، نبحث عن w:hAnsi أو w:ascii
    String? hAnsi = rFonts?.getAttribute("w:hAnsi");
    if (hAnsi != null && hAnsi.isNotEmpty) return hAnsi;

    String? ascii = rFonts?.getAttribute("w:ascii");
    if (ascii != null && ascii.isNotEmpty) return ascii;

    // إذا كان هناك cstheme، نستخدم الخط المناسب من الـ theme
    String? cstheme = rFonts?.getAttribute("w:cstheme");
    if (cstheme != null) {
      // للنص العربي/Bidi، استخدم minorFont من الـ theme
      if (cstheme.contains("minor")) {
        return wordDocument.minorFont;
      } else if (cstheme.contains("major")) {
        return wordDocument.majorFont;
      }
    }

    // نرجع null ونترك الـ caller يقرر الـ fallback
    return null;
  }

  String getFontH() {
    if (font != null && isProblemFont(font!))
      font = wordDocument.defaultRPr?.font ?? "Traditional Arabic.ttf";

    String? fixedFont = font != null ? getFixedFontName(font!) : null;
    return font == null ? "" : '''class="$fixedFont";''';
  }

  String? getVerticalAlign() {
    return rPr?.getElement("w:vertAlign")?.getAttribute("w:val");
  }

  // String getVertAlignH1() {
  //   if (vertAlign == "superscript")
  //     return "<sup>";
  //   else if (vertAlign == "subscript")
  //     return "<sub>";
  //   else
  //     return "";
  // }

  double getVertAlignNum() {
    // Make offset proportional to font size (default 14pt)
    // Superscript typically rises by about 40% of font height
    double baseFontSize = fontSize ?? 14;
    double offset = baseFontSize * 0.4;

    if (vertAlign == "superscript")
      return -offset;
    else if (vertAlign == "subscript")
      return offset;
    else
      return 0;
  }

  String getVertAlignH2() {
    if (vertAlign == "superscript")
      return """</sup>""";
    else if (vertAlign == "subscript")
      return """</sub>""";
    else
      return "";
  }

  getRStyle() {
    if (rStyle == null) return;
    WordDocument? wordDocument = parent?.parent?.parent?.parent;
    XmlElement? rStyleXml = getRPrFRromStyle(rStyle!, wordDocument);
    if (rStyleXml == null) return;
    rPr = mergeRPr(rPr!, rStyleXml);
  }

  getTextDecoration() {
    return TextDecoration.combine([
      if (u == true) TextDecoration.underline, // إضافة إذا كانت u تساوي true
      if (strike == true) TextDecoration.lineThrough,
    ]);
  }

  // <w:rFonts w:ascii="romoz II" w:hAnsi="romoz II" w:cs="Barada Reqa"/>
  void getFonts() {
    font = getArFont();
    enFont = rPr?.getElement("w:rFonts")?.getAttribute("w:ascii");
    uniqueFont = rPr?.getElement("w:rFonts")?.getAttribute("w:hAnsi");
  }
}

XmlElement? mergeRPr(XmlElement? rPr, XmlElement? baseRPr) {
  if (baseRPr == null) return rPr;
  if (rPr == null) return baseRPr;

  List<XmlElement> mergedElements = [
    ...rPr.childElements.map(((e) => e.clone())) ?? [],
  ];
  Map<String, XmlElement> currentElementsMap = {};
  rPr.childElements.forEach((e) {
    currentElementsMap[e.name.local] = e;
  });
  baseRPr.childElements.forEach((e) {
    if (currentElementsMap[e.name.local] == null) mergedElements.add(e.clone());
  });

  XmlElement mergedRpr = XmlElement(
    XmlName.fromString(rPr.name.toXmlString()),
    rPr.attributes.toList().clone(),
    mergedElements,
  );

  return mergedRpr;
}
