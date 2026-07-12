import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';
import 'package:golden_shamela/Utils/ImageParser.dart';
import 'package:golden_shamela/Utils/TxtUtils.dart';
import 'package:golden_shamela/WordToWidget/ImageToWidget.dart';
import 'package:golden_shamela/wordToHTML/FieldResultHyperlinkDisplayOverride.dart';
import 'package:golden_shamela/wordToHTML/HyperLinkRun.dart';
import 'package:golden_shamela/wordToHTML/BidiTextNormalizer.dart';
import 'package:golden_shamela/wordToHTML/GlyphEncodedDigitFonts.dart';
import 'package:golden_shamela/wordToHTML/PPr.dart';
import 'package:golden_shamela/wordToHTML/Paragraph.dart';
import 'package:golden_shamela/wordToHTML/RPr.dart';
import 'package:golden_shamela/wordToHTML/TabStop.dart';
import 'package:golden_shamela/wordToHTML/WordSymbolResolver.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:xml/xml.dart';
import 'package:golden_shamela/wordToHTML/DocRelations.dart';
import 'package:golden_shamela/core/app_state.dart';
import 'package:golden_shamela/UI/Settings/app_color_settings.dart';
import 'package:flutter/gestures.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:golden_shamela/Helpers/TextProcessor.dart'; // Add TextProcessor

part 'runT.g.dart';

const BLANK = "*#&&#*";

@JsonSerializable(explicitToJson: true, constructor: 'empty')
class runT {
  RPr? prPr;
  PPr? pPr;
  String? text;
  RPr? rpr;
  bool hasBrBefore = false;
  bool hasBrAfter = false;
  @JsonKey(ignore: true)
  XmlElement? xmlRun;
  String? footNoteId;
  String? fnDisplayNum;
  ImageData? image;
  String? toc;

  /// Whether this run contains a w:tab element (for TOC entry/page number separation)
  /// This is serialized to cache since xmlRun is ignored
  bool hasTab = false;
  bool hasPositionalTab = false;
  String? positionalTabAlignment;
  String? positionalTabRelativeTo;
  bool hasExplicitRunDirection = false;

  @JsonKey(ignore: true)
  Paragraph parent;

  @JsonKey(ignore: true)
  Map<String, RelId>? customRelIdList;

  runT(
    this.parent, {
    required this.prPr,
    required this.pPr,
    this.customRelIdList,
  });

  runT.empty() : parent = Paragraph.empty();

  factory runT.fromJson(Map<String, dynamic> json) => _$runTFromJson(json);
  Map<String, dynamic> toJson() => _$runTToJson(this);

  static runT fromMap(Map<String, dynamic> json, Paragraph parent) {
    final runT = _$runTFromJson(json);
    runT.parent = parent;

    if (json['rpr'] != null) {
      runT.rpr = RPr.fromMap(json['rpr'] as Map<String, dynamic>, runT);
    }
    if (json['image'] != null) {
      runT.image = ImageData.fromMap(
        json['image'] as Map<String, dynamic>,
        runT,
      );
    }

    // التحقق من الرموز عند التحميل من الكاش أيضاً
    // (xmlRun سيكون null، لكن rpr?.font يجب أن يكون محفوظاً)
    runT.checkSymbol();

    return runT;
  }

  bool isFootnoteRef = false;

  fromXml(XmlElement? xmlRun) {
    this.xmlRun = xmlRun;
    // Check for tab element (used for TOC entry/page number separation)
    hasTab = xmlRun?.getElement("w:tab") != null;
    final positionalTab = xmlRun?.getElement("w:ptab");
    hasPositionalTab = positionalTab != null;
    positionalTabAlignment = positionalTab?.getAttribute("w:alignment");
    positionalTabRelativeTo = positionalTab?.getAttribute("w:relativeTo");
    getText();

    checkBr();
    checkFnId();
    checkBookMark();

    // Check for footnoteRef
    isFootnoteRef = xmlRun?.getElement("w:footnoteRef") != null;

    XmlElement? xmlrPr = xmlRun?.getElement("w:rPr");
    if (xmlrPr != null) {
      rpr = RPr(this).fromXml(xmlrPr);
      rpr?.parent = this;
      hasExplicitRunDirection =
          xmlrPr.getElement("w:rtl") != null ||
          xmlrPr.getElement("w:ltr") != null;
    }
    // التحقق من الرموز (w:sym) بعد استخراج النص وتعيين rpr
    checkSymbol();
    checkParaRpr();
    checkToc();

    bool isImg = isImageRun(xmlRun);
    if (isImg) {
      try {
        image = parseImageData(this, customRelIdList: customRelIdList);
        // if (image != null) {
        //   print("DEBUG: Image parsed successfully. ID: ${image?.rId}, TextBox: ${image?.textBoxText}");
        // } else {
        //   print("DEBUG: Image parsing returned null");
        // }
      } catch (e) {
        // Error parsing image data - silently ignore
        print("DEBUG_IMG_ERROR: Exception parsing image/VML in runT.fromXml: $e");
      }
    }
    return this;
  }

  isRelativeFromVParagraph() {
    if (image == null) return false;

    // Inline images (wrapMode is null) should NEVER be treated as relative/positioned.
    // They must flow with the text.
    if (image?.wrapMode == null) return false;

    // Reverted: Allow text boxes to be relative/positioned if the XML says so.
    // This allows them to overlap images correctly.
    // if (image!.textBoxText != null && image!.textBoxText!.isNotEmpty) return false;

    return image?.relativeFromV == "paragraph" ||
        image?.relativeFromV == "line";
  }

  InlineSpan toWidgetWithImg({bool preserveLineBreaks = true}) {
    // Fix: Check image property instead of xmlRun since xmlRun is not saved in cache
    if (image != null) {
      Widget w = getImageWidget(image!);
      // Reverted the newline insertion.
      // We treat the text box as an inline widget. It should flow naturally after the preceding element.
      return WidgetSpan(child: w);
    } else
      return toWidget(preserveLineBreaks: preserveLineBreaks);
  }

  InlineSpan toWidget({bool preserveLineBreaks = true}) {
    // Skip hidden/vanish text (like injected {{PG:X}} markers)
    if (rpr?.vanish == true) {
      return TextSpan(text: "");
    }

    // Fix: Check image property instead of xmlRun since xmlRun is not saved in cache
    if (image != null) {
      // Debugging: why is this treated as text run if it's an image?
      // print("DEBUG: toWidget called for Image Run. This should not happen if it's in imageRunTs.");
      return TextSpan(text: "");
    }

    InlineSpan? tabSpan = getTabSpan();
    // fixFnr() removed - parentheses are now fixed in addFnToPage
    checkSymbol();

    double vAlign = rpr?.getVertAlignNum() ?? 0;
    final effectiveRtl = _hasEffectiveRtl;
    String fixedText = checkDiacritics();
    fixedText = BidiTextNormalizer.normalizeForDisplay(
      fixedText,
      effectiveRtl: effectiveRtl,
      hasExplicitRunDirection: hasExplicitRunDirection,
    );

    // Get effective text style (falls back to prPr if rpr is null)
    TextStyle effectiveStyle = getEffectiveTextStyle();

    List<InlineSpan> contentSpans = [];

    List<String> highlightTerms = AppState().searchHighlightTerms;

    // Check for URLs in the text (simple check first for optimization)
    bool customUrlCheck =
        !parent.disableUrlAutoDetection &&
        (fixedText.contains("http") || fixedText.contains("www"));
    if (customUrlCheck) {
      contentSpans = _buildContentSpansWithIds(
        fixedText,
        effectiveStyle,
        highlightTerms,
      );
    } else {
      // Standard highlighting logic (refactored or inline)
      if (highlightTerms.isNotEmpty && fixedText.isNotEmpty) {
        String pattern = highlightTerms.map((t) => TextProcessor.buildSmartArabicPattern(t)).where((p) => p.isNotEmpty).join('|');
        if (pattern.isEmpty) pattern = r'(?!x)x'; // impossible match if all empty
        RegExp regex = RegExp(pattern);
        int lastMatchEnd = 0;
        bool hasMatch = false;
        for (final match in regex.allMatches(fixedText)) {
          hasMatch = true;
          if (match.start > lastMatchEnd) {
            contentSpans.add(
              TextSpan(
                text: fixedText.substring(lastMatchEnd, match.start),
                style: effectiveStyle,
              ),
            );
          }
          contentSpans.add(
            TextSpan(
              text: fixedText.substring(match.start, match.end),
              style: (rpr?.getTextStyle() ?? effectiveStyle).copyWith(
                color: AppUiColors.color(AppColorRole.searchWords),
                backgroundColor: AppUiColors.color(AppColorRole.searchHighlight),
              ),
            ),
          );
          lastMatchEnd = match.end;
        }
        if (hasMatch) {
          if (lastMatchEnd < fixedText.length) {
            contentSpans.add(
              TextSpan(
                text: fixedText.substring(lastMatchEnd),
                style: effectiveStyle,
              ),
            );
          }
        } else {
          contentSpans.add(TextSpan(text: fixedText, style: effectiveStyle));
        }
      } else {
        contentSpans.add(TextSpan(text: fixedText, style: effectiveStyle));
      }
    }

    if (footNoteId != null && vAlign != 0) {
      // Footnote reference marks must use TextSpan to get correct BiDi position
      // in RTL SelectableText. WidgetSpan (U+FFFC placeholder) always drifts to
      // the visual start of an RTL paragraph, regardless of its logical position.
      // Vertical elevation is achieved via Shadow(blurRadius:0) — the actual
      // glyph is transparent and a crisp shadow renders at the vAlign offset.
      final Color textColor = effectiveStyle.color ?? Colors.black;
      final TextStyle shadowStyle = effectiveStyle.copyWith(
        color: Colors.transparent,
        shadows: [
          Shadow(color: textColor, offset: Offset(0, vAlign), blurRadius: 0),
        ],
      );
      return TextSpan(text: fixedText, style: shadowStyle);
    }

    if (vAlign != 0) {
      if (effectiveRtl) {
        return TextSpan(
          children: [
            if (hasBrBefore)
              TextSpan(
                text: preserveLineBreaks ? "\n" : " ",
                style: effectiveStyle,
              ),
            ..._applyVisualBaselineShiftToSpans(contentSpans, vAlign),
            if (hasBrAfter)
              TextSpan(
                text: preserveLineBreaks ? "\n" : " ",
                style: effectiveStyle,
              ),
          ],
        );
      }

      return WidgetSpan(
        alignment: PlaceholderAlignment.baseline,
        baseline: TextBaseline.alphabetic,
        child: Transform.translate(
          offset: Offset(0.0, vAlign),
          child: Text.rich(
            TextSpan(children: contentSpans),
            textAlign: TextAlign.end,
            textDirection: TextDirection.ltr,
            style: rpr?.getTextStyle(), // Base style for the paragraph/run
          ),
        ),
      );
    } else if (tabSpan != null) {
      // Use TextSpan children instead of WidgetSpan(Row) so the tab
      // content remains selectable within SelectableRegion.
      return TextSpan(
        children: [
          if (hasBrBefore)
            TextSpan(
              text: preserveLineBreaks ? "\n" : " ",
              style: effectiveStyle,
            ),
          ...contentSpans,
          if (hasBrAfter)
            TextSpan(
              text: preserveLineBreaks ? "\n" : " ",
              style: effectiveStyle,
            ),
          tabSpan,
        ],
      );
    } else {
      // Reconstruct full span sequence with breaks
      return TextSpan(
        children: [
          if (hasBrBefore)
            TextSpan(
              text: preserveLineBreaks ? "\n" : " ",
              style: effectiveStyle,
            ),
          ...contentSpans,
          if (hasBrAfter)
            TextSpan(
              text: preserveLineBreaks ? "\n" : " ",
              style: effectiveStyle,
            ),
        ],
      );
    }
  }

  /// Get effective TextStyle, falling back to paragraph properties when run properties are null
  TextStyle getEffectiveTextStyle() {
    TextStyle style;
    // If rpr exists, use it
    if (rpr != null) {
      style = rpr!.getTextStyle();
    }
    // If rpr is null but prPr exists, use prPr
    else if (prPr != null) {
      style = prPr!.getTextStyle();
    }
    // Final fallback
    else {
      style = TextStyle(color: Colors.black, fontSize: 14, fontFamily: "jreg");
    }

    if (prPr != null) {
      style = FieldResultHyperlinkDisplayOverride.apply(
        run: this,
        runStyle: style,
        paragraphStyle: prPr!.getTextStyle(),
      );
    }
  
    // Note: Line height is controlled by StrutStyle in Paragraph._getTRunsW()
    // Do NOT set height here to avoid doubling the line spacing effect
  
    return style;
  }

  void checkBr() {
    bool hasBr = xmlRun?.getElement("w:br") != null;
    if (hasBr) {
      int tP = 0;
      int brP = 0;
      List<XmlElement> elements = xmlRun!.childElements.toList();
      for (int i = 0; i < elements.length; i++) {
        if (elements[i].name.local == "t")
          tP = i;
        else if (elements[i].name.local == "br")
          brP = i;
      }
      hasBrBefore = brP < tP;
      hasBrAfter = brP > tP;
    }
  }

  void checkFnId() {
    footNoteId = xmlRun
        ?.getElement("w:footnoteReference")
        ?.getAttribute("w:id");
  }

  updateFnDisplayNumber() {
    if (footNoteId != null) {
      String calculated = (fnDisplayNum ?? footNoteId!);
      if (text != null && text!.trim().isNotEmpty) {
        String trimmed = text!.trim();

        // Regex for all digit types (ASCII 0-9 and Arabic-Indic ٠-٩)
        const allDigits = r'0-9\u0660-\u0669';

        // Check if the run only contains numbers or common markers like brackets
        bool isJustNumber = RegExp('^[()[\\]$allDigits\\s]+\$').hasMatch(trimmed);

        if (isJustNumber) {
          // Replace plain number with our calculated/formatted number
          text = calculated;
        } else {
          // Keep the custom symbol (like ❶), but remove any redundant digits
          // that might have been part of the run (to avoid "1 ❶" or "١ ❶")
          String symbolOnly =
              trimmed.replaceAll(RegExp('[$allDigits]'), '').trim();
          if (symbolOnly.isNotEmpty) {
            text = symbolOnly;
          } else {
            text = calculated;
          }
        }
      } else {
        text = calculated;
      }
    }
  }

  void fixFnr() {
    if (text == null || rpr?.vertAlign != "superscript" || rpr?.rtl != true)
      return;
    if (text!.contains("("))
      text = text!.replaceFirst("(", ")");
    else if (text!.contains(")"))
      text = text!.replaceFirst(")", "(");
  }

  void getText() {
    // If this run contains instruction text (field code), ignore it
    if (xmlRun?.getElement("w:instrText") != null) {
      text = "";
      return;
    }

    // أولاً: محاولة استخراج النص من w:t
    String? tText = xmlRun?.getElement("w:t")?.text;

    text = tText ?? "";

    // إذا لم يكن هناك نص في w:t، نبحث عن w:sym
    if ((text?.isEmpty ?? true) && xmlRun != null) {
      var symElement = xmlRun!.findElements("w:sym").firstOrNull;
      if (symElement != null) {
        final resolved = resolveWordSymbol(
          fontName: symElement.getAttribute("w:font"),
          charHex: symElement.getAttribute("w:char"),
        );
        text = resolved?.text ?? "?";
      }
    }
  }

  checkSymbol() {
    // إذا كان xmlRun موجوداً، نبحث عن w:sym مباشرة
    if (xmlRun != null && hasSymbol()) {
      if (rpr == null) {
        rpr = RPr(this);
      }

      var symElement = xmlRun!.findElements("w:sym").firstOrNull;
      String? fontName = symElement?.getAttribute("w:font");
      String? charHex = symElement?.getAttribute("w:char");
      final resolved = resolveWordSymbol(fontName: fontName, charHex: charHex);

      if (resolved?.fontFamily != null && resolved!.fontFamily!.isNotEmpty) {
        rpr?.font = resolved.fontFamily;
      } else if (fontName != null && fontName.isNotEmpty) {
        rpr?.font = fontName;
      }

      text = resolved?.text ?? "?";
    } else {
      final resolvedFromCache = resolveCachedWordSymbol(
        fontName: rpr?.font,
        text: text,
      );
      if (resolvedFromCache != null) {
        if (resolvedFromCache.fontFamily != null &&
            resolvedFromCache.fontFamily!.isNotEmpty) {
          rpr?.font = resolvedFromCache.fontFamily;
        }
        text = resolvedFromCache.text;
        return;
      }

      // تحديد الخط المناسب حسب نوع النص
      if (rpr != null) {
        String? appropriateFont = changeFontByTxt(text);
        if (appropriateFont != null && appropriateFont.isNotEmpty) {
          rpr?.font = appropriateFont;
        }
      }
    }
  }

  bool hasSymbol() {
    return xmlRun?.findElements("w:sym").isNotEmpty ?? false;
  }

  InlineSpan? getTabSpan() {
    if (xmlRun?.getElement("w:tab") == null) return null;

    // Get tab stops from parent paragraph's pPr
    PPr? paragraphPPr = parent.pPr;

    // Get the first defined tab stop (most common case: single tab)
    // Word applies tabs in order, so we use the first one for now
    TabStop? tabStop;
    if (paragraphPPr != null && paragraphPPr.tabStops.isNotEmpty) {
      tabStop = paragraphPPr.tabStops.first;
    }

    // Calculate width from tab position (twips to pixels)
    // If no tab defined, use default Word tab (720 twips = 0.5 inch)
    double tabWidth = tabStop?.positionInPx ?? (720 * 0.0667);

    // Ensure minimum visible width
    if (tabWidth < 20) tabWidth = 20;

    // Get leader type if any
    String? leaderType = tabStop?.leader;
    bool hasLeader = tabStop?.hasLeader ?? false;

    if (hasLeader) {
      return _buildLeaderSpan(leaderType, tabWidth);
    } else {
      // No leader — use a space + letterSpacing to fill the tab width
      final effectiveStyle = getEffectiveTextStyle();
      final painter = TextPainter(
        text: TextSpan(text: ' ', style: effectiveStyle),
        textDirection: TextDirection.ltr,
        maxLines: 1,
      )..layout();
      final spaceAdvance = painter.width;
      final extraSpacing = tabWidth - spaceAdvance;
      if (extraSpacing > 0) {
        return TextSpan(text: ' ', style: effectiveStyle.copyWith(letterSpacing: extraSpacing));
      }
      return TextSpan(text: ' ', style: effectiveStyle);
    }
  }

  /// Builds a leader span (dots, underscores, etc.) as a selectable TextSpan
  /// instead of a non-selectable Widget.
  TextSpan _buildLeaderSpan(String? leaderType, double width) {
    String leaderChar;
    switch (leaderType) {
      case "dot":
        leaderChar = ".";
        break;
      case "underscore":
        leaderChar = "_";
        break;
      case "hyphen":
        leaderChar = "-";
        break;
      case "middleDot":
        leaderChar = "·";
        break;
      case "heavy":
        leaderChar = "●";
        break;
      default:
        leaderChar = ".";
    }

    // Calculate how many characters needed to fill the width
    // Approximate char width based on leader type
    double charWidth = leaderChar == "."
        ? 4.0
        : (leaderChar == "_" ? 8.0 : 6.0);
    int charCount = (width / charWidth).floor();
    if (charCount < 1) charCount = 1;

    return TextSpan(
      text: leaderChar * charCount,
      style: TextStyle(
        fontFamily: "jreg",
        color: Colors.black,
        letterSpacing: leaderChar == "_"
            ? 0
            : 1.0, // Underscores need no spacing
      ),
    );
  }

  void checkParaRpr() {
    // Logic for Toggle Properties (Bold, Italic, Strike, Vanish)
    // Spec: If run property is present (true/false), it toggles or overrides the style property.
    // However, typically <w:b/> (true) means "Toggle my state relative to parent".
    // <w:b w:val="0"/> (false) explicitly turns it off.

    // Bold Logic
    bool styleB = prPr?.b ?? false;
    if (rpr?.b == true) {
      // Toggle logic: If style is Bold, and run says "Bold" (Toggle), result is Not Bold.
      // If style is Not Bold, and run says "Bold", result is Bold.
      rpr?.b = !styleB;
    } else if (rpr?.b == false) {
      // Explicitly OFF
      rpr?.b = false;
    } else {
      // Not specified in Run -> Inherit from Style
      rpr?.b = styleB;
    }

    // Italic Logic
    bool styleI = prPr?.i ?? false;
    if (rpr?.i == true) {
      rpr?.i = !styleI;
    } else if (rpr?.i == false) {
      rpr?.i = false;
    } else {
      rpr?.i = styleI;
    }

    // Inherit other properties (Overrides)
    rpr?.u ??= prPr?.u;
    rpr?.uColor ??= prPr?.uColor;
    rpr?.color ??= prPr?.color;
    rpr?.highlightColor ??= prPr?.highlightColor;
    rpr?.rtl ??= prPr?.rtl;
    rpr?.font ??= prPr?.font;

    // Size Logic: w:sz is often additive (or relative) in complex scenarios, but usually absolute in simple Word usage.
    // However, we treat it as override here unless we implement full complex logic.
    rpr?.fontSize ??= prPr?.fontSize;

    rpr?.vertAlign ??= prPr?.vertAlign;

    // Strike Logic (XOR)
    bool styleStrike = prPr?.strike ?? false;
    if (rpr?.strike == true) {
      rpr?.strike = !styleStrike;
    } else if (rpr?.strike == false) {
      rpr?.strike = false;
    } else {
      rpr?.strike = styleStrike;
    }

    // Vanish Logic (XOR)
    bool styleVanish = prPr?.vanish ?? false;
    if (rpr?.vanish == true) {
      rpr?.vanish = !styleVanish;
    } else if (rpr?.vanish == false) {
      rpr?.vanish = false;
    } else {
      rpr?.vanish = styleVanish;
    }

    // Auto-contrast: if text has no explicit color and the visual background
    // is known (paragraph shading or enclosing VML textbox fill), resolve
    // Word's auto color against that background.
    if (rpr?.color == null) {
      final wordDocument = parent.parent.parent;
      final backgroundColor =
          _getParagraphShadingColor() ?? parent.textBoxFillColor;
      if (backgroundColor != null) {
        rpr?.color = _isDarkColor(backgroundColor)
            ? wordDocument.autoLightColor
            : wordDocument.autoDarkColor;
      }
    }
  }

  /// Get paragraph shading color from w:pPr/w:shd (for auto-contrast)
  Color? _getParagraphShadingColor() {
    final shd = parent.pPr?.xmlpPr?.getElement("w:shd");
    if (shd == null) return null;

    // Try themeFill first
    String? themeFill = shd.getAttribute("w:themeFill");
    if (themeFill != null) {
      var wordDocument = parent.parent.parent;
      String? resolved = resolveThemeColor(
        wordDocument.themeColors,
        themeFill,
        shd.getAttribute("w:themeFillTint"),
        shd.getAttribute("w:themeFillShade"),
      );
      if (resolved != null && resolved.length == 6) {
        try {
          return Color(int.parse("FF$resolved", radix: 16));
        } catch (_) {}
      }
    }

    // Fallback: w:fill
    final fill = shd.getAttribute("w:fill");
    if (fill == null || fill.isEmpty || fill == "auto") return null;
    try {
      return Color(int.parse("FF$fill", radix: 16));
    } catch (_) {
      return null;
    }
  }

  /// Check if a color is "dark" (luminance < 0.5)
  bool _isDarkColor(Color color) {
    return color.computeLuminance() < 0.4;
  }

  String? changeFontByTxt(String? text) {
    if (text == null) return null;

    if (isArabic(text)) {
      return rpr?.font; // خط عربي
    } else if (text.contains(RegExp(r'[a-zA-Z]'))) {
      return rpr?.enFont; // خط إنجليزي
    } else {
      // FIX: في حالة النص العربي (RTL)، نستخدم الخط العربي (cs) للرموز أيضاً
      // بدلاً من uniqueFont (hAnsi) الذي قد يحتوي على glyphs غير متوقعة (مثل صدق الله العظيم بدلاً من النقطة)
      if (_hasEffectiveRtl) {
        return rpr?.font;
      }
      return rpr?.uniqueFont; // إذا كان النص غير محدد، نختار خط افتراضي
    }
  }

  // دالة لتحديد ما إذا كان النص عربيًا
  // يشمل: Arabic (U+0600-U+06FF), Arabic Supplement (U+0750-U+077F),
  // Arabic Extended-A (U+08A0-U+08FF), Arabic Presentation Forms-A (U+FB50-U+FDFF),
  // Arabic Presentation Forms-B (U+FE70-U+FEFF)
  bool isArabic(String text) {
    final arabicRegex = RegExp(
        r'[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]');
    return arabicRegex.hasMatch(text);
  }

  String checkDiacritics() {
    final doc = parent.parent.parent;
    String result = doc.withDiacritics ? (text ?? "") : removeDiacritics(text ?? "");
    if (doc.useArabicNumerals &&
        _hasEffectiveRtl &&
        !_shouldPreserveWesternDigitsForGlyphFont()) {
      result = toArabicNumbers(result);
    }
    return result;
  }

  bool _shouldPreserveWesternDigitsForGlyphFont() {
    final fontCandidates = [
      rpr?.font,
      rpr?.enFont,
      rpr?.uniqueFont,
      prPr?.font,
      prPr?.enFont,
      prPr?.uniqueFont,
    ];

    for (final fontFamily in fontCandidates) {
      if (shouldPreserveWesternDigitsForFontFamily(fontFamily)) {
        return true;
      }
    }

    return false;
  }

  bool get _hasEffectiveRtl {
    if (rpr?.rtl != null) {
      return rpr!.rtl!;
    }
    return parent.textDirection == TextDirection.rtl;
  }

  /// Build spans checking for URLs first, then search highlights
  List<InlineSpan> _buildContentSpansWithIds(
    String text,
    TextStyle style,
    List<String> highlightTerms,
  ) {
    List<InlineSpan> spans = [];
    // Regex for URLs (http/https or www)
    final urlRegex = RegExp(r'(https?:\/\/[^\s]+|www\.[^\s]+)');
    final matches = urlRegex.allMatches(text);

    int lastMatchEnd = 0;

    for (final match in matches) {
      // Process text before the URL (apply highlighting)
      if (match.start > lastMatchEnd) {
        String preText = text.substring(lastMatchEnd, match.start);
        spans.addAll(_buildHighlightSpans(preText, style, highlightTerms));
      }

      // Process the URL itself (make clickable)
      String urlText = text.substring(match.start, match.end);
      spans.add(_buildLinkSpan(urlText, style));

      lastMatchEnd = match.end;
    }

    // Process remaining text
    if (lastMatchEnd < text.length) {
      String postText = text.substring(lastMatchEnd);
      spans.addAll(_buildHighlightSpans(postText, style, highlightTerms));
    }

    return spans;
  }

  /// Helper to build search highlight spans for non-link text
  List<InlineSpan> _buildHighlightSpans(
    String text,
    TextStyle style,
    List<String> highlightTerms,
  ) {
    if (highlightTerms.isEmpty || text.isEmpty) {
      return [TextSpan(text: text, style: style)];
    }

    List<InlineSpan> spans = [];
    String pattern = highlightTerms.map((t) => TextProcessor.buildSmartArabicPattern(t)).where((p) => p.isNotEmpty).join('|');
    if (pattern.isEmpty) pattern = r'(?!x)x'; // impossible match
    RegExp regex = RegExp(pattern);

    int lastMatchEnd = 0;
    bool hasMatch = false;

    for (final match in regex.allMatches(text)) {
      hasMatch = true;
      if (match.start > lastMatchEnd) {
        spans.add(
          TextSpan(
            text: text.substring(lastMatchEnd, match.start),
            style: style,
          ),
        );
      }
      spans.add(
        TextSpan(
          text: text.substring(match.start, match.end),
          style: (rpr?.getTextStyle() ?? style).copyWith(
            color: AppUiColors.color(AppColorRole.searchWords),
            backgroundColor: AppUiColors.color(AppColorRole.searchHighlight),
          ),
        ),
      );
      lastMatchEnd = match.end;
    }

    if (lastMatchEnd < text.length) {
      spans.add(TextSpan(text: text.substring(lastMatchEnd), style: style));
    }

    if (!hasMatch) {
      return [TextSpan(text: text, style: style)];
    }
    return spans;
  }

  List<InlineSpan> _applyVisualBaselineShiftToSpans(
    List<InlineSpan> spans,
    double offsetY,
  ) {
    return spans.map((span) {
      if (span is! TextSpan) {
        return span;
      }

      return _applyVisualBaselineShiftToTextSpan(span, offsetY);
    }).toList();
  }

  TextSpan _applyVisualBaselineShiftToTextSpan(TextSpan span, double offsetY) {
    final baseStyle = span.style ?? const TextStyle();
    final textColor = baseStyle.color ?? Colors.black;
    final shiftedStyle = baseStyle.copyWith(
      color: Colors.transparent,
      shadows: [
        ...?baseStyle.shadows,
        Shadow(color: textColor, offset: Offset(0, offsetY), blurRadius: 0),
      ],
    );

    return TextSpan(
      text: span.text,
      children: span.children == null
          ? null
          : _applyVisualBaselineShiftToSpans(span.children!, offsetY),
      style: shiftedStyle,
      recognizer: span.recognizer,
      mouseCursor: span.mouseCursor,
      onEnter: span.onEnter,
      onExit: span.onExit,
      semanticsLabel: span.semanticsLabel,
      locale: span.locale,
      spellOut: span.spellOut,
    );
  }

  /// Helper to build a clickable link span
  InlineSpan _buildLinkSpan(String urlText, TextStyle baseStyle) {
    String url = urlText;
    // Only add https:// for web URLs, not for mailto:, tel:, or other schemes
    if (!url.startsWith("http") &&
        !url.startsWith("mailto:") &&
        !url.startsWith("tel:") &&
        !url.startsWith("ftp:") &&
        !url.startsWith("file:")) {
      url = "https://$urlText";
    }

    return TextSpan(
      text: urlText,
      style: baseStyle.copyWith(
        color: Colors.blue,
        decoration: TextDecoration.underline,
        decorationColor: Colors.blue,
      ),
      recognizer: TapGestureRecognizer()
        ..onTap = () async {
          try {
            final uri = Uri.parse(url);
            if (await canLaunchUrl(uri)) {
              await launchUrl(uri);
            } else {
              print("Could not launch detected URL: $url");
            }
          } catch (e) {
            print("Error launching detected URL: $e");
          }
        },
    );
  }
}
