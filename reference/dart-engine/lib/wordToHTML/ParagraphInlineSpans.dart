part of 'Paragraph.dart';

/// Extracted from Paragraph.dart to keep the core class small while
/// preserving the same library-private access and rendering behavior.
mixin ParagraphInlineSpans on ParagraphMembers {
  bool _shouldKeepHeaderFooterSingleLine();

  void printParagraphXml() async {
    await ParagraphDebugPrinter.write(this as Paragraph);
  }

  void fixPDirection() {
    // in some times runs have rtl and ppr and prpr does not, so this fix rtl
    if (pPr?.rtl != null) return;
    for (runT r in runs) {
      if (r.rpr?.rtl != null) {
        pPr?.rtl = r.rpr?.rtl;
        break;
      }
    }
  }

  /// Extract bookmarks from paragraph level XML
  /// w:bookmarkStart is a sibling of w:r, not a child, so we need to search at paragraph level
  void _extractBookmarks() {
    if (pXml == null) return;

    // Find all bookmarkStart elements at paragraph level
    for (XmlElement element in pXml!.childElements) {
      if (element.name.local == "bookmarkStart") {
        String? bookmarkName = element.getAttribute("w:name");
        if (bookmarkName != null && bookmarkName.isNotEmpty) {
          // Skip internal Word bookmarks (start with underscore but not Toc)
          if (bookmarkName.startsWith("_") && !bookmarkName.contains("Toc")) {
            continue;
          }
          // print("DEBUG: Found bookmark at paragraph level: $bookmarkName (page ${parent.pageIndex})");
          parent.parent.addBookMark(bookmarkName, pageIndex: parent.pageIndex);
        }
      }
    }
  }

  getPageNum() {
    // Only try to get from instrText if pageNum wasn't already set
    // (e.g., from {{PG:X}} marker injected by pageRender.py)
    if (pageNum.isNotEmpty) return;

    pageNum =
        pXml
            ?.findAllElements("w:instrText")
            .where((e) => e.text.toString().trim().isNotEmpty)
            .firstOrNull
            ?.text ??
        "";
  }

  void getPAlign() {
    TextAlign? alignFromPPr = pPr?.getTextAlignW();
    textAlign = alignFromPPr ?? TextAlign.start;
  }

  void getPTextDirection() {
    textDirection =
        pPr?.getTextDirectionW() ??
        prPr?.getTextDirection() ??
        TextDirection.rtl;
  }

  List<InlineSpan> getAllPSpans() {
    final preserveLineBreaks = !_shouldLetTableKashidaSoftWrap();
    List<InlineSpan> spans = [
      ...(pPr?.getNumberingSpans() ?? const [TextSpan(text: "")]),

      ...runs
          .map((e) => e.toWidgetWithImg(preserveLineBreaks: preserveLineBreaks))
          .toList(),
    ];
    spans = fixRtlWidgetSpan(spans);
    return spans;
  }

  List<InlineSpan> getPSpans() {
    // If no runs and no numbering, it might be an empty paragraph (new line)
    // We should add a generic run to ensure it takes up space (line height)
    if (textRunTs.isEmpty && (pPr?.numId == null)) {
      return [TextSpan(text: "\u00A0")]; // Non-breaking space
    }

    final preserveLineBreaks = !_shouldLetTableKashidaSoftWrap();
    List<InlineSpan> spans = [
      // w:firstLine — indent ONLY the first line (not all lines like container padding would)
      // Use TextSpan instead of WidgetSpan(SizedBox) so the indent remains
      // selectable. WidgetSpan with a non-selectable child breaks SelectableRegion.
      if (pPr?.firstLineIndent != null && pPr!.firstLineIndent! > 0)
        _firstLineIndentSpan(pPr!.firstLineIndent!, _effectiveIndentStyle()),
      ...(pPr?.getNumberingSpans() ?? const [TextSpan(text: "")]),
      ...textRunTs
          .map((e) => e.toWidgetWithImg(preserveLineBreaks: preserveLineBreaks))
          .toList(),
    ];
    spans = fixRtlWidgetSpan(spans);
    return spans;
  }

  bool _shouldLetTableKashidaSoftWrap() {
    // Word's ST_Jc Kashida modes justify Arabic text by stretching kashida.
    // Flutter only gives us inter-word justify here, and hard w:br lines are
    // treated as final lines, so table-cell kashida paragraphs need the same
    // older table behavior: allow soft wrapping so TextAlign.justify can act.
    final jc = pPr?.textAlign;
    return isTableCellParagraph &&
        jc != null &&
        jc.endsWith('Kashida') &&
        textRunTs.any((run) => run.hasBrBefore || run.hasBrAfter);
  }

  /// Returns the exact plain text that Flutter's clipboard would contain for
  /// this paragraph. Walks the rendered InlineSpan tree from getPSpans() and
  /// collects TextSpan.text values only (WidgetSpans produce \uFFFC which the
  /// caller strips, so we skip them here).
  String get renderedPlainText {
    if (_cachedRenderedPlainText != null) return _cachedRenderedPlainText!;
    // Fallback: compute from spans (may differ from actual render)
    final spans = getPSpans();
    final buffer = StringBuffer();
    _collectSpanText(spans, buffer);
    return buffer.toString();
  }

  /// Returns the effective TextStyle for the first-line indent span,
  /// derived from the paragraph's run properties so the space glyph
  /// matches the actual font used in rendering.
  TextStyle _effectiveIndentStyle() {
    if (prPr != null) return prPr!.getTextStyle();
    if (textRunTs.isNotEmpty) return textRunTs.first.getEffectiveTextStyle();
    return const TextStyle();
  }

  /// Creates a selectable TextSpan for first-line indent instead of
  /// WidgetSpan(SizedBox) which breaks SelectableRegion flow.
  TextSpan _firstLineIndentSpan(double indentPx, TextStyle baseStyle) {
    // Measure a single space with the actual font to compute letterSpacing
    final painter = TextPainter(
      text: TextSpan(text: ' ', style: baseStyle),
      textDirection: TextDirection.rtl,
      maxLines: 1,
    )..layout();
    final spaceAdvance = painter.width;
    final extraSpacing = indentPx - spaceAdvance;
    if (extraSpacing > 0) {
      return TextSpan(
        text: ' ',
        style: baseStyle.copyWith(letterSpacing: extraSpacing),
      );
    }
    return TextSpan(text: ' ', style: baseStyle);
  }

  void _collectSpanText(List<InlineSpan> spans, StringBuffer buffer) {
    for (final span in spans) {
      if (span is TextSpan) {
        if (span.text != null) buffer.write(span.text);
        if (span.children != null) {
          _collectSpanText(span.children!.cast<InlineSpan>(), buffer);
        }
      }
      // WidgetSpan → \uFFFC in clipboard → skip
    }
  }

  EdgeInsets _getPPaddings({
    double? spacingBeforeOverride,
    double? spacingAfterOverride,
  }) {
    // Sanitize padding to prevent negative values which crash Flutter's Padding widget
    // Word allows negative indentation (hanging), but Flutter Padding does not.
    double left = pPr?.paddingLeft ?? 0;
    double right = pPr?.paddingRight ?? 0;
    double top = spacingBeforeOverride ?? (pPr?.spacingBefore ?? 0);
    // Footnote paragraphs inherit from "Footnote Text" style which has w:after="0".
    // PPr defaults to ~18.7px when no w:spacing element exists (body-text default).
    // For footnotes, only apply spacingAfter when it was explicitly set in the XML.
    double bottom =
        spacingAfterOverride ??
        ((sectionType == 'footnote' && pPr?.spacingAfterExplicit != true)
            ? 0
            : (pPr?.spacingAfter ?? 0));

    return EdgeInsets.only(
      left: left < 0 ? 0 : left,
      right: right < 0 ? 0 : right,
      top: top < 0 ? 0 : top,
      bottom: bottom < 0 ? 0 : bottom,
    );
  }

  EdgeInsets getPPaddingsForLayout({
    double? spacingBeforeOverride,
    double? spacingAfterOverride,
  }) {
    return _getPPaddings(
      spacingBeforeOverride: spacingBeforeOverride,
      spacingAfterOverride: spacingAfterOverride,
    );
  }

  double estimateFooterStoryBlockHeight() {
    final paddings = getPPaddingsForLayout();
    final explicitBreaks = textRunTs.fold<int>(0, (count, run) {
      var next = count;
      if (run.hasBrBefore) next++;
      if (run.hasBrAfter) next++;
      return next;
    });
    final lineCount = explicitBreaks + 1;
    return paddings.top +
        paddings.bottom +
        (_measureFooterLineBoxHeight() * lineCount);
  }

  double _measureFooterLineBoxHeight() {
    final textLineHeight = _measureParagraphTextLineHeight();
    final inlineObjectHeight = _measureInlineLineObjectHeight();
    return inlineObjectHeight > textLineHeight
        ? inlineObjectHeight
        : textLineHeight;
  }

  double _measureParagraphTextLineHeight() {
    final wordDocument = parent.parent;
    final strutConfig = ParagraphStrutResolver.resolve(
      pPr: pPr,
      prPr: prPr,
      textRuns: textRunTs,
      isTableCellParagraph: isTableCellParagraph || this is ParagraphTable,
      adjustLineHeightInTable: wordDocument.adjustLineHeightInTable,
      sectPr: wordDocument.getSectPrForPage(parent.pageIndex),
    );

    final painter = TextPainter(
      text: TextSpan(
        style: strutConfig.paragraphTextStyle,
        text: _paragraphMeasurementSampleText(),
      ),
      textDirection: textDirection,
      strutStyle: StrutStyle(
        forceStrutHeight: strutConfig.forceStrutHeight,
        height: strutConfig.lineHeight,
        fontSize: strutConfig.strutFontSize,
        leading: strutConfig.strutLeading,
        fontFamily: strutConfig.strutBaseStyle.fontFamily,
        fontFamilyFallback: strutConfig.strutBaseStyle.fontFamilyFallback,
      ),
      maxLines: 1,
    )..layout();

    final metrics = painter.computeLineMetrics();
    if (metrics.isEmpty) {
      return 0;
    }

    return metrics.first.height;
  }

  double _measureInlineLineObjectHeight() {
    double maxHeight = 0;

    for (final run in textRunTs) {
      final image = run.image;
      if (image == null || image.wrapMode != null) {
        continue;
      }

      if (image.height > maxHeight) {
        maxHeight = image.height;
      }
    }

    return maxHeight;
  }

  String _paragraphMeasurementSampleText() {
    for (final run in textRunTs) {
      if (run.rpr?.vanish == true) {
        continue;
      }

      final text = (run.text ?? '').trim();
      if (text.isNotEmpty) {
        return String.fromCharCode(text.runes.first);
      }
    }

    return '\u00A0';
  }

  _getImageRunsW() {
    // العودة للطريقة الأصلية - استخدام getImageWidget
    return Stack(
      fit: StackFit.loose,
      children: [
        ...imageRunTs.map((runImage) => getImageWidget(runImage.image!)),
      ],
    );
  }

  _getTRunsW(List<InlineSpan> spans) {
    final wordDocument = parent.parent;
    final effectivePreventWrap =
        preventWrap || _shouldKeepHeaderFooterSingleLine();
    final strutConfig = ParagraphStrutResolver.resolve(
      pPr: pPr,
      prPr: prPr,
      textRuns: textRunTs,
      isTableCellParagraph: isTableCellParagraph || this is ParagraphTable,
      adjustLineHeightInTable: wordDocument.adjustLineHeightInTable,
      sectPr: wordDocument.getSectPrForPage(parent.pageIndex),
    );
    final richText = Text.rich(
      TextSpan(style: strutConfig.paragraphTextStyle, children: spans),
      textAlign: textAlign,
      textDirection: textDirection,
      softWrap: shrinkTextLayerWidth ? false : !effectivePreventWrap,
      overflow: effectivePreventWrap ? TextOverflow.visible : TextOverflow.clip,
      strutStyle: StrutStyle(
        forceStrutHeight: strutConfig.forceStrutHeight,
        height: strutConfig.lineHeight,
        fontSize: strutConfig.strutFontSize,
        leading: strutConfig.strutLeading,
        fontFamily: strutConfig.strutBaseStyle.fontFamily,
        fontFamilyFallback: strutConfig.strutBaseStyle.fontFamilyFallback,
      ),
    );

    if (shrinkTextLayerWidth) {
      return richText;
    }

    return SizedBox(width: double.infinity, child: richText);
  }

  /// محاولة بسيطة لاستخراج صورة (PNG/JPG) مضمنة داخل ملف EMF
  /// يبحث عن توقيع PNG أو JPEG ويعيد البيانات من تلك النقطة
  Uint8List? _extractImageFromEmf(Uint8List emfData) {
    // البحث عن توقيع PNG: 89 50 4E 47
    for (int i = 0; i < emfData.length - 8; i++) {
      if (emfData[i] == 0x89 &&
          emfData[i + 1] == 0x50 &&
          emfData[i + 2] == 0x4E &&
          emfData[i + 3] == 0x47) {
        print("✅ Found PNG inside EMF at offset $i");
        return emfData.sublist(
          i,
        ); // قد يحتوي على بيانات زائدة في النهاية، لكن Image.memory عادة يتجاهلها
      }
    }

    // البحث عن توقيع JPEG: FF D8 FF
    for (int i = 0; i < emfData.length - 3; i++) {
      if (emfData[i] == 0xFF &&
          emfData[i + 1] == 0xD8 &&
          emfData[i + 2] == 0xFF) {
        print("✅ Found JPEG inside EMF at offset $i");
        return emfData.sublist(i);
      }
    }

    return null;
  }
}
