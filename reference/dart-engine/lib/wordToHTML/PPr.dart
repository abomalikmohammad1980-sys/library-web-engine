import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:golden_shamela/Utils/XmlElementClone.dart';
import 'package:golden_shamela/wordToHTML/DocumentStyles.dart';
import 'package:golden_shamela/wordToHTML/MyInt.dart';
import 'package:golden_shamela/wordToHTML/Paragraph.dart';
import 'package:golden_shamela/wordToHTML/RPr.dart';
import 'package:golden_shamela/Models/WordDocument.dart';
import 'package:golden_shamela/wordToHTML/NumberingMarkerNumeralResolver.dart';
import 'package:golden_shamela/wordToHTML/abstractNum.dart';
import 'package:golden_shamela/wordToHTML/runT.dart';
import 'package:golden_shamela/wordToHTML/TabStop.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:xml/xml.dart';

import '../Utils/DiplayWordNumber.dart';

part 'PPr.g.dart';

double twipsToPx = 0.0667;

@JsonSerializable(explicitToJson: true, constructor: 'empty')
class PPr {
  @JsonKey(ignore: true)
  XmlElement? xmlpPr;
  @JsonKey(ignore: true)
  XmlElement? xmlprPr;
  String? textAlign;
  bool? rtl;
  bool? bidi; // Paragraph direction (BiDi)
  double? paddingLeft;
  // Controls whether to force the strut height (ignoring font metrics) or respect natural metrics
  bool forceStrutHeight = true;
  double? paddingRight;
  double? firstLineIndent;
  String? pStyle;
  int? numId;
  int? paragraphNumber;
  int? ilvl; // padding level if has numbering
  @JsonKey(ignore: true)
  List<String> doneElements = ["numPr", "pStyle", "rPr", "ind", "jc", "tabs"];
  String? numberingH;

  /// Flag to skip incrementing the numbering counter
  /// Used when re-parsing paragraphs (e.g., in table cells during re-render)
  @JsonKey(ignore: true)
  bool skipNumberingCounter = false;

  /// Tab stops for this paragraph (used for TOC dot leaders)
  List<TabStop> tabStops = [];

  /// TOC level (1-9) extracted from pStyle like TOC1, TOC2, etc.
  int? tocLevel;

  @JsonKey(ignore: true)
  Paragraph parent;
  @JsonKey(ignore: true)
  late WordDocument wordDocument = parent.parent.parent;

  PPr(this.parent);

  PPr.empty() : parent = Paragraph.empty();

  factory PPr.fromJson(Map<String, dynamic> json) => _$PPrFromJson(json);
  Map<String, dynamic> toJson() => _$PPrToJson(this);

  static PPr fromMap(Map<String, dynamic> json, Paragraph parent) {
    final pPr = _$PPrFromJson(json);
    pPr.parent = parent;
    pPr.wordDocument = parent.parent.parent;
    // Re-parse TOC level from pStyle when loading from cache
    pPr.parseTocLevel();
    return pPr;
  }

  double? spacingBefore;
  double? spacingAfter;
  @JsonKey(ignore: true)
  bool spacingAfterExplicit = false;
  double? lineHeight;
  String? lineHeightSource;
  double? lineMultiple;

  PPr fromXml(XmlElement? xmlpPr0, {bool skipNumberingCounter = false}) {
    this.skipNumberingCounter = skipNumberingCounter;
    xmlpPr0?.childElements.forEach((xmlElement) {
      if (!doneElements.contains(xmlElement.name.local)) {
        // print("PPr:" + xmlElement.name.local);
        // print(xmlElement.toXmlString());
      }
    });
    this.xmlpPr = xmlpPr0;

    // Initialize styleRunProperties with default document properties
    // This ensures that if there is no pStyle, we still have the defaults
    this.styleRunProperties = wordDocument.defaultRPr?.rPr;

    getPStyle();
    if (wordDocument.defaultPPr != null) {
      this.xmlpPr = mergePPr(
        this.xmlpPr,
        wordDocument.defaultPPr!.xmlpPr,
        wordDocument.defaultRPr!.rPr,
      );
    }

    this.xmlprPr = xmlpPr?.getElement("w:rPr");
    this.rtl = RPr(getEmptyRun()).fromXml(xmlprPr).rtl;

    // Parse paragraph bidi property
    String? bidiVal = xmlpPr?.getElement("w:bidi")?.getAttribute("w:val");
    // <w:bidi/> or <w:bidi w:val="1"/> means RTL. <w:bidi w:val="0"/> means LTR.
    // If element exists with no val, it defaults to true (1).
    if (xmlpPr?.getElement("w:bidi") != null) {
      if (bidiVal == "0" || bidiVal == "false") {
        this.bidi = false;
      } else {
        this.bidi = true;
      }
    }

    if (textAlign == null) textAlign = getTextAlign();

    checkNumbering();
    getPadding();
    getSpacing(); // Parse spacing
    fixTextAlign();
    parseTabStops();
    parseTocLevel();
    return this;
  }

  // Factor 1.40 is empirically chosen for Traditional Arabic to match Word's "Single" spacing.
  static const double kArabicLineSpacingFactor = 1.40;

  void getSpacing() {
    XmlElement? spacing = xmlpPr?.getElement("w:spacing");
    lineHeightSource = null;
    lineMultiple = null;

    // If spacing is still absent after style/default inheritance has been
    // applied, OOXML says each attribute falls back to its own defined
    // default. We should not inject a synthetic 10pt paragraph gap here,
    // because that is a template/style convention, not a WordprocessingML
    // default.
    if (spacing == null) {
      lineHeightSource = 'default';
      lineMultiple = 1.0;
      lineHeight =
          kArabicLineSpacingFactor; // Word 2007+ default for Arabic text (includes safety margin)
      forceStrutHeight = false;
      spacingBefore = 0;
      spacingAfter = 0;
      spacingAfterExplicit = false;

      return;
    }

    // Before / After spacing in twips (twentieths of a point)
    // 1 point = 20 twips, so twipsToPx converts correctly
    String? before = spacing.getAttribute("w:before");
    String? after = spacing.getAttribute("w:after");

    // Check for auto-spacing overrides
    bool beforeAuto = spacing.getAttribute("w:beforeAutospacing") == "1";
    bool afterAuto = spacing.getAttribute("w:afterAutospacing") == "1";

    // Spacing correction for Arabic layout consistency
    const double verticalScaleCorrection = kArabicLineSpacingFactor;

    if (beforeAuto) {
      // Word uses approximately 10pt (7.5px) for auto-spacing
      spacingBefore =
          10.0 * twipsToPx * 20 * verticalScaleCorrection; // ~17.3px
    } else if (before != null) {
      spacingBefore = double.tryParse(before);
      if (spacingBefore != null) {
        spacingBefore = spacingBefore! * twipsToPx * verticalScaleCorrection;
      }
    }

    if (afterAuto) {
      // Word uses approximately 10pt (7.5px) for auto-spacing
      spacingAfter = 10.0 * twipsToPx * 20 * verticalScaleCorrection; // ~17.3px
      spacingAfterExplicit = true;
    } else if (after != null) {
      spacingAfter = double.tryParse(after);
      if (spacingAfter != null) {
        spacingAfter = spacingAfter! * twipsToPx * verticalScaleCorrection;
      }
      spacingAfterExplicit = true;
    }

    // Line spacing - interpretation depends on w:lineRule
    String? line = spacing.getAttribute("w:line");
    String? lineRule = spacing.getAttribute("w:lineRule");

    if (line != null) {
      double lineVal = double.tryParse(line) ?? 240;

      if (lineRule == "auto" || lineRule == null) {
        // "auto": w:line is in 240ths of a line
        // 240 = Single (1.0), 360 = 1.5, 480 = Double (2.0)
        lineHeightSource = 'auto';
        lineMultiple = lineVal / 240.0;

        // RESEARCH IMPLEMENTATION:
        // Recent investigation confirms Word applies proprietary "Safety Margins" (extra leading)
        // for Arabic scripts (like Traditional Arabic) to prevent clipping of deep diacritics.
        // Flutter's Skia engine uses raw font metrics, resulting in simpler/tighter rendering.
        // We MUST apply a correction factor to match Word's "Safety Margin".
        const double arabicSafetyMargin = kArabicLineSpacingFactor;

        lineHeight = (lineVal / 240.0) * arabicSafetyMargin;
        // OOXML "auto" is content-driven line spacing, not an exact locked box.
        // Let taller glyph metrics expand the line box as needed, like Word.
        forceStrutHeight = false;
      } else if (lineRule == "exact" || lineRule == "atLeast") {
        lineHeightSource = lineRule;
        lineMultiple = null;
        // "exact"/"atLeast": w:line is in twips (twentieths of a point)
        double points = lineVal / 20.0; // twips to points

        // Get actual font size from paragraph run properties (prPr)
        // Default to 12pt if not specified (Word's default body font size)
        double fontSize = 12.0;
        String? fontSizeStr = xmlprPr
            ?.getElement("w:sz")
            ?.getAttribute("w:val");
        if (fontSizeStr != null) {
          // w:sz is in half-points
          fontSize = (double.tryParse(fontSizeStr) ?? 24.0) / 2.0;
        }

        // Ensure minimum font size for calculation
        if (fontSize < 8) fontSize = 12.0;

        if (lineRule == "atLeast" && points < fontSize) {
          // Fallback for atLeast small values - use Safety Margin
          lineHeight = kArabicLineSpacingFactor;
          forceStrutHeight = false;
        } else {
          // Calculate the multiplier based on actual font size
          double calculatedHeight = points / fontSize;

          // Ensure reasonable bounds
          if (calculatedHeight < 1.0) {
            lineHeight = 1.0;
          } else if (calculatedHeight > 3.0) {
            lineHeight = 3.0;
          } else {
            lineHeight = calculatedHeight;
          }
          forceStrutHeight = lineRule == "exact";
        }
      }
    } else {
      // Default fallback - use Safety Margin
      lineHeightSource = 'default';
      lineMultiple = 1.0;
      lineHeight = kArabicLineSpacingFactor;
      forceStrutHeight = false;
    }
  }

  String? getTextAlign() {
    String? s = xmlpPr?.getElement("w:jc")?.getAttribute("w:val");
    return s;
  }

  String toHTML() {
    String alignH = getAlignH();
    // print("style:2 $alignH");
    String rtlH = getRtlH();
    String paddingH = getPaddingH();
    numberingH = getNumberingH();
    String html = ''' style="$alignH$rtlH$paddingH "''';

    return html;
  }

  TextAlign? getTextAlignW() {
    if (textAlign == null) return null;

    if (textAlign == "both" && rtl != false)
      return TextAlign.justify;
    else if (textAlign!.contains("Kashida") && rtl != false) {
      return TextAlign.justify;
    }
    switch (textAlign) {
      case "left":
        return TextAlign.left;
      case "right":
        return TextAlign.right;
      case "center":
        return TextAlign.center;
      case "justify":
        return TextAlign.justify;
      case "start":
        return TextAlign.start;
      case "end":
        return TextAlign.end;
      default:
        return null;
    }
  }

  bool get isRtl => rtl == true || bidi == true;

  String getAlignH() {
    // print("style:2"+(textAlign??""));

    if (textAlign == null)
      return "";
    else if (textAlign == "both" && isRtl)
      return '''text-align: justify;
    text-justify: inter-word; direction: rtl;''';
    else if (textAlign!.contains("Kashida") && isRtl) {
      return '''text-align: justify;
    text-justify: inter-word; direction: rtl;''';
    }
    String alignH = textAlign != null ? "text-align: $textAlign;" : "";
    return alignH;
  }

  String getRtlH() {
    return isRtl ? "direction: rtl;" : "";
  }

  TextDirection? getTextDirectionW() {
    return isRtl ? TextDirection.rtl : null;
  }

  void fixTextAlign() {
    if (isRtl && textAlign == null)
      textAlign = "right";
    // OOXML jc is defined relative to the page, but Word's bidi paragraph
    // behavior evaluates left/right against the paragraph reading order in
    // practice. We mirror explicit left/right here to match Word rendering.
    else if (isRtl && textAlign == "left")
      textAlign = "right";
    else if (isRtl && textAlign == "right")
      textAlign = "left";
  }

  double? _parseTwipsAttr(XmlElement? element, List<String> names) {
    for (final name in names) {
      final value = element?.getAttribute(name);
      if (value != null && value.isNotEmpty) {
        return double.tryParse(value);
      }
    }
    return null;
  }

  String? getPadding() {
    XmlElement? indElement = xmlpPr?.getElement("w:ind");
    // Per OOXML spec: w:start/w:end (logical, direction-aware) take precedence
    // over w:left/w:right. Both represent leading/trailing edge of text flow.
    // For RTL: leading edge = physical right; trailing edge = physical left.
    // For LTR: leading edge = physical left; trailing edge = physical right.
    String? rightTwips = rtl != false
        ? (indElement?.getAttribute("w:start") ??
            indElement?.getAttribute("w:left"))
        : (indElement?.getAttribute("w:end") ??
            indElement?.getAttribute("w:right"));
    String? leftTwips = rtl != false
        ? (indElement?.getAttribute("w:end") ??
            indElement?.getAttribute("w:right"))
        : (indElement?.getAttribute("w:start") ??
            indElement?.getAttribute("w:left"));
    if (paddingLeft == null)
      paddingLeft = leftTwips != null
          ? double.parse(leftTwips) * twipsToPx
          : null;
    if (paddingRight == null)
      paddingRight = rightTwips != null
          ? double.parse(rightTwips) * twipsToPx
          : null;

    // تطبيق firstLine كمسافة بادئة للسطر الأول فقط (وليس كل الفقرة)
    // يتم تطبيقها كـ WidgetSpan في Paragraph.getPSpans()
    String? firstLine = xmlpPr
        ?.getElement("w:ind")
        ?.getAttribute("w:firstLine");
    if (firstLine != null) {
      firstLineIndent = double.parse(firstLine) * twipsToPx;
    }

    Level? level = getNumberingLevel();
    if (level != null) {
      final explicitLeadingIndentTwips = rtl != false
          ? _parseTwipsAttr(indElement, ["w:start", "w:left"])
          : _parseTwipsAttr(indElement, ["w:start", "w:left"]);
      final explicitHangingTwips = _parseTwipsAttr(indElement, ["w:hanging"]);

      // For numbered paragraphs, Word hangs the marker inside the hanging area,
      // while the paragraph text starts at (indent - hanging).
      // Paragraph pPr overrides numbering lvl/pPr per OOXML §17.9.22.
      final effectiveLeadingIndentTwips =
          explicitLeadingIndentTwips ?? level.indentLeft.toDouble();
      final effectiveHangingTwips =
          explicitHangingTwips ?? level.indentHanging.toDouble();
      final textLeadingPaddingPx =
          (effectiveLeadingIndentTwips - effectiveHangingTwips) * twipsToPx;

      if (rtl != false) {
        paddingRight = textLeadingPaddingPx > 0 ? textLeadingPaddingPx : 0;
      } else {
        paddingLeft = textLeadingPaddingPx > 0 ? textLeadingPaddingPx : 0;
      }
    }
  }

  String getPaddingH() {
    String paddingH =
        (paddingRight != null ? "padding-right: $paddingRight px;" : "") +
        (paddingLeft != null ? "padding-left: $paddingLeft px;" : "");
    return paddingH;
  }

  @JsonKey(ignore: true)
  XmlElement? styleRunProperties; // Defines text style excluding paragraph mark specific formatting

  getPStyle() {
    pStyle = xmlpPr?.getElement("w:pStyle")?.getAttribute("w:val");
    WordDocument? wordDocument = parent.parent.parent;

    // In Word, paragraphs without an explicit w:pStyle inherit from the
    // default paragraph style (w:type="paragraph" w:default="1", typically "Normal").
    // This is critical for correct font size inheritance.
    pStyle ??= wordDocument.defaultParagraphStyleId;

    if (pStyle == null) return;
    XmlElement? style = getDocumentStyle(pStyle!, wordDocument);
    if (style == null) return;
    XmlElement? pStyleXml = style.getElement("w:pPr");
    XmlElement? rStyleXml = style.getElement("w:rPr");

    // Calculate effective text style (Style + Default) separate from Direct Formatting
    // This ensures text runs inherit from the Style chain, not the Pilcrow formatting (e.g. Green paragraph mark)
    styleRunProperties = mergeRPr(rStyleXml, wordDocument.defaultRPr?.rPr);

    // Legacy merge for xmlpPr (Paragraph Props + Pilcrow Props)
    // We still merge rStyleXml here so pPr knows about style defaults for the pilcrow too
    rStyleXml = mergeRPr(rStyleXml, wordDocument.defaultRPr?.rPr);

    xmlpPr = mergePPr(xmlpPr, pStyleXml, rStyleXml);
  }

  void checkNumbering() {
    // البحث عن numId و ilvl مباشرة من xmlpPr
    String? numIdS = xmlpPr
        ?.getElement("w:numPr")
        ?.getElement("w:numId")
        ?.getAttribute("w:val");
    if (numIdS != null) {
      numId = int.tryParse(numIdS);
    }

    String? ilvlS = xmlpPr
        ?.getElement("w:numPr")
        ?.getElement("w:ilvl")
        ?.getAttribute("w:val");
    if (ilvlS != null) {
      ilvl = int.tryParse(ilvlS);
    }

    // إذا لم نجد numId/ilvl في xmlpPr مباشرة، نبحث في pStyle
    if (numId == null && pStyle != null) {
      WordDocument? wordDocument = parent.parent.parent;
      XmlElement? style = getDocumentStyle(pStyle!, wordDocument);
      if (style != null) {
        XmlElement? pStyleXml = style.getElement("w:pPr");
        numIdS = pStyleXml
            ?.getElement("w:numPr")
            ?.getElement("w:numId")
            ?.getAttribute("w:val");
        if (numIdS != null) {
          numId = int.tryParse(numIdS);
        }

        ilvlS = pStyleXml
            ?.getElement("w:numPr")
            ?.getElement("w:ilvl")
            ?.getAttribute("w:val");
        if (ilvlS != null) {
          ilvl = int.tryParse(ilvlS);
        }
      }
    }

    if (numId != null && ilvl != null) {
      Level? level = getNumberingLevel();
      if (level != null) {
        if (!skipNumberingCounter) {
          // Only increment counter during initial parsing, not during re-renders
          int startLvl = level.startVal;
          paragraphNumber =
              startLvl - 1 + wordDocument.addParagraphNum(numId!, ilvl!);
        }
        // When skipNumberingCounter is true (e.g., table cells),
        // paragraphNumber remains null and will be set by the caller (ParagraphTable)
        // with the correct row index
      }
    }
  }

  Level? getNumberingLevel() {
    if (numId == null || ilvl == null) return null;

    int abstractNumId = wordDocument.numsMap[numId]?.abstractNumId ?? -1;
    if (abstractNumId == -1) return null;

    if (!wordDocument.abstractNumMap.containsKey(abstractNumId)) return null;

    return wordDocument.abstractNumMap[abstractNumId]!.levelsMap[ilvl];
  }

  String getNumberingH() {
    Level? level = getNumberingLevel();
    if (level == null) return "";
    String displayNumber = getDisblayNumber(
      level,
      numId: numId,
      paragraphNumber: paragraphNumber!,
    );
    return ''' <span style="display: inline-block; margin-left: ${level.indentHanging.twpsToPx()}px;">$displayNumber</span>''';
  }

  WidgetSpan getNumberingW() {
    Level? level = getNumberingLevel();
    if (level == null) {
      return WidgetSpan(child: Text(""));
    }

    String displayNumber = getDisblayNumber(
      level,
      numId: numId,
      paragraphNumber: paragraphNumber!,
    );

    // بناء TextStyle مع الخط المخصص إذا كان موجوداً
    TextStyle? textStyle;
    if (level.fontFamily != null && level.fontFamily!.isNotEmpty) {
      textStyle = TextStyle(fontFamily: level.fontFamily);
    }

    Color? numberColor = _parseWordColor(level.color);
    Paint? backgroundPaint = _parseHighlight(level.highlightColor);

    // إذا لم يكن لـ Level لون صريح، نرث من خصائص الفقرة (pPr > rPr)
    if (numberColor == null && xmlprPr != null) {
      RPr paraRPr = RPr(getEmptyRun()).fromXml(xmlprPr);
      numberColor = _parseWordColor(paraRPr.color);
      backgroundPaint ??= _parseHighlight(paraRPr.highlightColor);
    }

    if (textStyle != null || numberColor != null || backgroundPaint != null) {
      textStyle = (textStyle ?? const TextStyle()).copyWith(
        color: numberColor,
        background: backgroundPaint,
      );
    }

    final indElement = xmlpPr?.getElement("w:ind");
    final effectiveHangingTwips =
        double.tryParse(indElement?.getAttribute("w:hanging") ?? "") ??
        level.indentHanging.toDouble();
    final markerWidth = effectiveHangingTwips * twipsToPx;

    Alignment markerAlignment;
    switch (level.lvlJc) {
      case "center":
        markerAlignment = Alignment.center;
        break;
      case "right":
      case "end":
        markerAlignment =
            isRtl ? Alignment.centerLeft : Alignment.centerRight;
        break;
      case "left":
      case "start":
      default:
        markerAlignment =
            isRtl ? Alignment.centerRight : Alignment.centerLeft;
        break;
    }

    return WidgetSpan(
      child: SizedBox(
        width: markerWidth > 0 ? markerWidth : null,
        child: Align(
          alignment: markerAlignment,
          child: Text(
            displayNumber,
            style: textStyle,
            textDirection: isRtl ? TextDirection.rtl : TextDirection.ltr,
          ),
        ),
      ),
    );
  }

  List<InlineSpan> getNumberingSpans() {
    Level? level = getNumberingLevel();
    if (level == null || paragraphNumber == null) {
      return const [TextSpan(text: "")];
    }

    RPr? paraRPr;
    if (xmlprPr != null) {
      paraRPr = RPr(getEmptyRun()).fromXml(xmlprPr);
    }

    String displayNumber = getDisblayNumber(
      level,
      numId: numId,
      paragraphNumber: paragraphNumber!,
    );

    displayNumber = resolveNumberingMarkerNumerals(
      displayNumber: displayNumber,
      useArabicNumerals: wordDocument.useArabicNumerals,
      fontCandidates: [
        level.fontFamily,
        paraRPr?.font,
        paraRPr?.enFont,
        paraRPr?.uniqueFont,
        parent.prPr?.font,
        parent.prPr?.enFont,
        parent.prPr?.uniqueFont,
      ],
    );

    TextStyle? numberingStyle;
    if (level.fontFamily != null && level.fontFamily!.isNotEmpty) {
      numberingStyle = TextStyle(fontFamily: level.fontFamily);
    }

    Color? numberColor = _parseWordColor(level.color);
    Paint? backgroundPaint = _parseHighlight(level.highlightColor);

    if (numberColor == null && paraRPr != null) {
      numberColor = _parseWordColor(paraRPr.color);
      backgroundPaint ??= _parseHighlight(paraRPr.highlightColor);
    }

    if (numberingStyle != null || numberColor != null || backgroundPaint != null) {
      numberingStyle = (numberingStyle ?? const TextStyle()).copyWith(
        color: numberColor,
        background: backgroundPaint,
      );
    }

    final baseStyle = parent.prPr?.getTextStyle();
    final effectiveMarkerStyle = (baseStyle ?? const TextStyle()).merge(numberingStyle);

    final indElement = xmlpPr?.getElement("w:ind");
    final effectiveHangingTwips =
        double.tryParse(indElement?.getAttribute("w:hanging") ?? "") ??
        level.indentHanging.toDouble();
    final hangingPx = effectiveHangingTwips * twipsToPx;

    final markerPainter = TextPainter(
      text: TextSpan(text: displayNumber, style: effectiveMarkerStyle),
      textDirection: isRtl ? TextDirection.rtl : TextDirection.ltr,
      maxLines: 1,
    )..layout();
    final markerWidth = markerPainter.width;

    final spans = <InlineSpan>[
      TextSpan(text: displayNumber, style: effectiveMarkerStyle),
    ];

    final effectiveSuff = level.suff ?? 'tab';

    switch (effectiveSuff) {
      case 'space':
        spans.add(const TextSpan(text: ' '));
        break;
      case 'nothing':
        break;
      case 'tab':
      default:
        final spacerWidth = hangingPx - markerWidth;
        if (spacerWidth > 0) {
          // Use TextSpan instead of WidgetSpan(SizedBox) so the spacer
          // remains selectable. WidgetSpan with a non-selectable child
          // (SizedBox) breaks SelectableRegion flow across paragraphs.
          final spacePainter = TextPainter(
            text: TextSpan(text: ' ', style: effectiveMarkerStyle),
            textDirection: isRtl ? TextDirection.rtl : TextDirection.ltr,
            maxLines: 1,
          )..layout();
          final spaceAdvance = spacePainter.width;
          final extraSpacing = spacerWidth - spaceAdvance;
          if (extraSpacing > 0) {
            spans.add(TextSpan(
              text: ' ',
              style: effectiveMarkerStyle.copyWith(letterSpacing: extraSpacing),
            ));
          } else {
            spans.add(const TextSpan(text: ' '));
          }
        }
        break;
    }

    return spans;
  }

  runT getEmptyRun() {
    runT emptyRun = parent.runs.isEmpty
        ? runT(parent, prPr: null, pPr: null)
        : parent.runs[0];
    return emptyRun;
  }

  /// Parse tab stops from w:tabs element
  /// Tab stops define custom positions and can have leader characters (dots, underscores, etc.)
  void parseTabStops() {
    tabStops = [];
    XmlElement? tabsElement = xmlpPr?.getElement("w:tabs");
    if (tabsElement == null) return;

    for (XmlElement tab in tabsElement.childElements) {
      if (tab.name.local != "tab") continue;

      TabStop tabStop = TabStop(
        type: tab.getAttribute("w:val"),
        position: double.tryParse(tab.getAttribute("w:pos") ?? "0"),
        leader: tab.getAttribute("w:leader"),
      );
      tabStops.add(tabStop);
    }
  }

  /// Parse TOC level from paragraph style (TOC1, TOC2, etc.)
  void parseTocLevel() {
    if (pStyle == null) {
      tocLevel = null;
      return;
    }

    String styleLower = pStyle!.toLowerCase();
    // Match patterns like "toc1", "toc2", "toc 1", "toc 2", etc.
    RegExp tocRegex = RegExp(r'^toc\s*(\d)$', caseSensitive: false);
    Match? match = tocRegex.firstMatch(styleLower);

    if (match != null) {
      tocLevel = int.tryParse(match.group(1) ?? "");
    } else {
      tocLevel = null;
    }
  }

  /// Check if this paragraph is a TOC (Table of Contents) entry
  bool isTOCStyle() {
    if (pStyle == null) return false;
    String styleLower = pStyle!.toLowerCase();
    return styleLower.startsWith("toc") ||
        styleLower == "tableofcontents" ||
        styleLower.contains("toc");
  }

  /// Get the right-aligned tab stop (typically used for page numbers in TOC)
  TabStop? getRightTabStop() {
    for (TabStop tab in tabStops) {
      if (tab.isRightAligned) return tab;
    }
    return null;
  }
}

XmlElement? mergePPr(
  XmlElement? xmlpPr,
  XmlElement? pStyleXml,
  XmlElement? rStyleXml,
) {
  if (pStyleXml == null) return xmlpPr;

  Map<String, XmlElement> currentElementsMap = {};
  xmlpPr?.childElements.forEach((e) {
    currentElementsMap[e.name.local] = e.clone();
  });
  XmlElement? mergedRpr = mergeRPr(xmlpPr?.getElement("w:rPr"), rStyleXml);

  if (mergedRpr != null) {
    currentElementsMap["rPr"] = mergedRpr.clone();
  }
  pStyleXml.childElements.forEach((e) {
    if (currentElementsMap[e.name.local] == null)
      currentElementsMap[e.name.local] = e.clone();
  });

  return XmlElement(
    XmlName.fromString(xmlpPr?.name.toXmlString() ?? "w:pPr"),
    xmlpPr?.attributes.toList().clone(),
    currentElementsMap.values,
  );
}

// ---------------- Numbering color helpers (top-level) ----------------

const Map<String, String> _numberingWordColorMap = {
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

String? _normalizeNumberingColor(String? color) {
  if (color == null) return null;
  if (_numberingWordColorMap.containsKey(color)) {
    return _numberingWordColorMap[color];
  }
  return color.replaceAll("#", "");
}

Color? _parseWordColor(String? wordColor) {
  final normalized = _normalizeNumberingColor(wordColor);
  if (normalized == null || normalized.isEmpty) return null;
  try {
    return Color(int.parse('0xFF$normalized'));
  } catch (_) {
    return null;
  }
}

Paint? _parseHighlight(String? highlight) {
  final normalized = _normalizeNumberingColor(highlight);
  if (normalized == null || normalized.isEmpty) return null;
  try {
    return Paint()..color = Color(int.parse('0xFF$normalized'));
  } catch (_) {
    return null;
  }
}
