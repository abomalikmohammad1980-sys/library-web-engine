part of 'Paragraph.dart';

/// Extracted from Paragraph.dart to keep the core class small while
/// preserving the same library-private access and rendering behavior.
mixin ParagraphRendering on ParagraphMembers {
  EdgeInsets _getPPaddings({
    double? spacingBeforeOverride,
    double? spacingAfterOverride,
  });
  BoxDecoration? _getParagraphDecoration(
    Color? backgroundColor, {
    bool includeBorder,
  });
  Color? _getParagraphShadingColor();
  List<Widget> _getPositionedImages(bool behindDoc);
  dynamic _getTRunsW(List<InlineSpan> spans);
  void _collectSpanText(List<InlineSpan> spans, StringBuffer buffer);
  List<InlineSpan> getPSpans();
  void printParagraphXml();
  Widget _buildTOCWidget();
  bool _hasFramePr();
  bool _hasExplicitLineBreaks();
  bool _shouldKeepHeaderFooterSingleLine();

  /// Check if this paragraph should use the special TOC rendering (Row + Expanded)
  /// This is true if:
  /// 1. It is an explicit TOC style
  /// 2. It contains a Right-aligned tab with a leader (which acts as a spring)
  /// We avoid this for Left/Center tabs to prevent them from stretching disproportionately.
  bool shouldRenderAsTOC() {
    if (pPr?.isTOCStyle() == true) return true;

    // Check for Right-aligned leader tabs defined in pPr
    // AND usage of a tab character in the runs
    bool hasRightLeaderDef =
        pPr?.tabStops.any((t) => t.isRightAligned && t.hasLeader) ?? false;
    bool hasTabUsage = textRunTs.any((r) => r.hasTab);

    return hasRightLeaderDef && hasTabUsage;
  }

  Widget toWidget({
    bool suppressParagraphBorder = false,
    double? spacingBeforeOverride,
    double? spacingAfterOverride,
  }) {
    // Fallback for header/footer paragraphs that encode a leader as literal
    // dots in text runs instead of a Word tab stop leader.
    final headerFooterDotLeaderParts = HeaderFooterDotLeaderResolver.tryExtract(
      isHeaderParagraph: isHeaderParagraph,
      hasFramePr: _hasFramePr(),
      hasExplicitLineBreaks: _hasExplicitLineBreaks(),
      textRuns: textRunTs,
    );
    if (headerFooterDotLeaderParts != null) {
      return _buildHeaderFooterDotLeaderLine(
        parts: headerFooterDotLeaderParts,
        suppressParagraphBorder: suppressParagraphBorder,
        spacingBeforeOverride: spacingBeforeOverride,
        spacingAfterOverride: spacingAfterOverride,
      );
    }

    // Check if this is a TOC entry OR uses right-aligned leader tabs - use special rendering
    // This ensures proportional tabs and leaders (tastir) appear correctly without stretching left tabs
    if (shouldRenderAsTOC()) {
      return Padding(
        padding: _getPPaddings(
          spacingBeforeOverride: spacingBeforeOverride,
          spacingAfterOverride: spacingAfterOverride,
        ),
        child: _buildTOCWidget(),
      );
    }

    // Check for centered paragraph with tabs (like headers: "أعمال [TAB] ❀ [TAB] الرافعي")
    // These need Row layout to distribute content evenly
    if (_hasPositionalTabs()) {
      return _buildPositionalTabsWidget(
        suppressParagraphBorder: suppressParagraphBorder,
        spacingBeforeOverride: spacingBeforeOverride,
        spacingAfterOverride: spacingAfterOverride,
      );
    }

    if (_isCenteredWithTabs()) {
      return _buildCenteredTabsWidget(
        suppressParagraphBorder: suppressParagraphBorder,
        spacingBeforeOverride: spacingBeforeOverride,
        spacingAfterOverride: spacingAfterOverride,
      );
    }

    final singleInlineImageRun = _getSingleVisibleInlineImageRun();
    if (singleInlineImageRun != null) {
      Color? backgroundColor = _getParagraphShadingColor();
      BoxDecoration? decoration = _getParagraphDecoration(
        backgroundColor,
        includeBorder: !suppressParagraphBorder,
      );
      final image = singleInlineImageRun.image!;
      final double indent = pPr?.firstLineIndent ?? 0;
      final bool isRtlParagraph = textDirection == TextDirection.rtl;
      final bool isInlineVmlGroup = image.isGroup && image.isInlineVmlGroup;
      final bool isSpecialDebugRid = RegExp(
        r'^rId(1[3-9])$',
      ).hasMatch(image.rId);

      if (isSpecialDebugRid) {
        print(
          'VML_DEBUG_PARAGRAPH: special-inline-only path rId=${image.rId} indent=$indent textDirection=$textDirection paddings=${_getPPaddings()} imageW=${image.width} imageH=${image.height}',
        );
      }

      return Padding(
        padding: _getPPaddings(
          spacingBeforeOverride: spacingBeforeOverride,
          spacingAfterOverride: spacingAfterOverride,
        ),
        child: Container(
          decoration: decoration,
          child: Padding(
            padding: EdgeInsetsDirectional.only(
              start: isInlineVmlGroup ? 0 : (indent > 0 ? indent : 0),
            ),
            child: Align(
              alignment: isInlineVmlGroup
                  ? Alignment.center
                  : textAlign == TextAlign.center
                  ? Alignment.center
                  : textAlign == TextAlign.left
                  ? Alignment.centerLeft
                  : textAlign == TextAlign.right
                  ? Alignment.centerRight
                  : (isRtlParagraph
                        ? Alignment.centerRight
                        : Alignment.centerLeft),
              child: getImageWidget(image),
            ),
          ),
        ),
      );
    }

    List<InlineSpan> spans = getPSpans();

    // Cache the plain text from these spans for clipboard matching
    final buf = StringBuffer();
    _collectSpanText(spans, buf);
    _cachedRenderedPlainText = buf.toString();

    // لون تظليل الفقرة (إن وجد في w:pPr/w:shd)
    Color? backgroundColor = _getParagraphShadingColor();

    // الحدود (إن وجدت في w:pPr/w:pBdr)
    BoxDecoration? decoration = _getParagraphDecoration(
      backgroundColor,
      includeBorder: !suppressParagraphBorder,
    );

    // تقسيم الصور إلى مجموعتين: خلف النص وأمام النص
    List<Widget> behindImages = _getPositionedImages(true);
    List<Widget> frontImages = _getPositionedImages(false);

    final sectPr = parent.parent.getSectPrForPage(parent.pageIndex);
    final EdgeInsets headerTextInsets =
        isHeaderParagraph && applyHeaderTextInsets
        ? EdgeInsets.only(
            left: sectPr.leftMargin ?? 0,
            right: sectPr.rightMargin ?? 0,
          )
        : EdgeInsets.zero;

    return Padding(
      padding: _getPPaddings(
        spacingBeforeOverride: spacingBeforeOverride,
        spacingAfterOverride: spacingAfterOverride,
      ),
      child: Container(
        decoration: decoration,
        // نستخدم Stack مع direction LTR لضمان أن left يعمل بشكل صحيح
        child: Stack(
          fit: StackFit.loose,
          clipBehavior: Clip.none,
          textDirection: TextDirection.ltr,
          children: [
            // 1. الصور الخلفية (behindDoc=true)
            // Positioned must be a DIRECT child of Stack for correct positioning.
            // IgnorePointer is already inside each Positioned (in _getPositionedImages).
            ...behindImages,

            // 2. النص (يحدد ارتفاع الفقرة)
            Padding(
              padding: headerTextInsets,
              child: Directionality(
                textDirection: textDirection, // RTL usually
                child: _getTRunsW(spans),
              ),
            ),

            // 3. الصور الأمامية (behindDoc=false)
            ...frontImages,
          ],
        ),
      ),
    );
  }

  /// Check if this is a centered paragraph with tab characters
  bool _isCenteredWithTabs() {
    if (textAlign != TextAlign.center) return false;
    return textRunTs.any((r) => r.hasTab);
  }

  bool _hasPositionalTabs() {
    return textRunTs.any((r) => r.hasPositionalTab);
  }

  Widget _buildHeaderFooterDotLeaderLine({
    required HeaderFooterDotLeaderParts parts,
    bool suppressParagraphBorder = false,
    double? spacingBeforeOverride,
    double? spacingAfterOverride,
  }) {
    final sectPr = parent.parent.getSectPrForPage(parent.pageIndex);
    final EdgeInsets headerTextInsets = applyHeaderTextInsets
        ? EdgeInsets.only(
            left: sectPr.leftMargin ?? 0,
            right: sectPr.rightMargin ?? 0,
          )
        : EdgeInsets.zero;

    final BoxDecoration? decoration = _getParagraphDecoration(
      _getParagraphShadingColor(),
      includeBorder: !suppressParagraphBorder,
    );

    return Padding(
      padding: _getPPaddings(
        spacingBeforeOverride: spacingBeforeOverride,
        spacingAfterOverride: spacingAfterOverride,
      ),
      child: SizedBox(
        width: double.infinity,
        child: Container(
          decoration: decoration,
          child: Padding(
            padding: headerTextInsets,
            child: HeaderFooterDotLeaderLine(
              parts: parts,
              paragraphStyle: prPr?.getTextStyle(),
            ),
          ),
        ),
      ),
    );
  }

  runT? _getSingleVisibleInlineImageRun() {
    final inlineImageRuns = textRunTs
        .where((r) => r.image != null && r.image!.wrapMode == null)
        .toList();
    final specialInlineRuns = inlineImageRuns
        .where((r) => RegExp(r'^rId(1[3-9])$').hasMatch(r.image!.rId))
        .toList();
    if (inlineImageRuns.length != 1) {
      if (specialInlineRuns.isNotEmpty) {
        print(
          'VML_DEBUG_PARAGRAPH: inlineImageRuns=${inlineImageRuns.length} visibleTextCheck=skipped rIds=${specialInlineRuns.map((e) => e.image!.rId).join(',')}',
        );
      }
      return null;
    }

    final visibleTextRuns = textRunTs.where((r) {
      if (r.image != null) {
        return false;
      }
      if (r.rpr?.vanish == true) {
        return false;
      }
      final text = r.text ?? '';
      return text.trim().isNotEmpty;
    }).toList();

    final image = inlineImageRuns.first.image!;
    final bool isSpecialDebugRid = RegExp(r'^rId(1[3-9])$').hasMatch(image.rId);
    if (isSpecialDebugRid) {
      final visibleTexts = visibleTextRuns
          .map((r) => (r.text ?? '').replaceAll('\n', ' '))
          .where((t) => t.trim().isNotEmpty)
          .toList();
      print(
        'VML_DEBUG_PARAGRAPH: candidate rId=${image.rId} inlineImageRuns=${inlineImageRuns.length} visibleTexts=${visibleTexts.join(' | ')} textRunTs=${textRunTs.length} runs=${runs.length}',
      );
    }

    if (visibleTextRuns.isNotEmpty) {
      return null;
    }

    final hasStructuralInlineCompanion = textRunTs.any((r) {
      if (r.image != null) {
        return false;
      }
      return r.hasTab || r.hasPositionalTab || r.hasBrBefore || r.hasBrAfter;
    });

    // An inline drawing followed by a tab/break is not a standalone
    // image-only paragraph. Keep the normal inline-run pipeline so Word's
    // line-level structure (for example image + tab in footer/header stories)
    // remains intact.
    if (hasStructuralInlineCompanion) {
      return null;
    }

    return inlineImageRuns.first;
  }

  /// Build widget for centered paragraphs with tabs (e.g., headers)
  /// Layout: [Spacer] [Text1] [Spacer] [Symbol] [Spacer] [Text2] [Spacer]
  Widget _buildCenteredTabsWidget({
    bool suppressParagraphBorder = false,
    double? spacingBeforeOverride,
    double? spacingAfterOverride,
  }) {
    // Split runs by tab characters
    List<List<runT>> segments = [];
    List<runT> currentSegment = [];

    for (runT run in textRunTs) {
      if (run.hasTab) {
        if (currentSegment.isNotEmpty) {
          segments.add(currentSegment);
          currentSegment = [];
        }
      } else {
        currentSegment.add(run);
      }
    }
    if (currentSegment.isNotEmpty) {
      segments.add(currentSegment);
    }

    // Build Row with spacers between segments
    List<Widget> children = [];
    for (int i = 0; i < segments.length; i++) {
      if (i > 0) {
        // Add spacer between segments (acts as tab)
        children.add(Spacer());
      }

      // Build segment content
      children.add(
        RichText(
          textDirection: TextDirection.rtl,
          text: TextSpan(
            children: segments[i].map((r) => r.toWidget()).toList(),
          ),
        ),
      );
    }

    // الحدود
    BoxDecoration? decoration = _getParagraphDecoration(
      _getParagraphShadingColor(),
      includeBorder: !suppressParagraphBorder,
    );

    return GestureDetector(
      onLongPress: () => printParagraphXml(),
      child: Padding(
        padding: _getPPaddings(
          spacingBeforeOverride: spacingBeforeOverride,
          spacingAfterOverride: spacingAfterOverride,
        ),
        child: Container(
          decoration: decoration,
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: children,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildPositionalTabsWidget({
    bool suppressParagraphBorder = false,
    double? spacingBeforeOverride,
    double? spacingAfterOverride,
  }) {
    final segments = <PositionalTabSegment>[];
    final currentSegment = <runT>[];
    final firstPositionalTab = textRunTs.cast<runT?>().firstWhere(
      (run) => run?.hasPositionalTab == true,
      orElse: () => null,
    );
    final defaultAlignment =
        PositionalTabLayoutResolver.resolveDefaultAlignment(
          paragraphTextAlign: textAlign,
          paragraphDirection: textDirection,
          firstPositionalTabAlignment:
              firstPositionalTab?.positionalTabAlignment,
        );
    String currentAlignment = defaultAlignment;

    void flushCurrentSegment() {
      if (currentSegment.isEmpty) return;
      segments.add(
        PositionalTabSegment(
          spans: currentSegment.map((r) => r.toWidget()).toList(),
          alignment: currentAlignment,
        ),
      );
      currentSegment.clear();
    }

    for (final run in textRunTs) {
      if (run.hasPositionalTab) {
        flushCurrentSegment();
        currentAlignment = PositionalTabLayoutResolver.normalizeAlignment(
          run.positionalTabAlignment,
          fallbackAlignment: defaultAlignment,
        );
        continue;
      }
      currentSegment.add(run);
    }
    flushCurrentSegment();

    final sectPr = parent.parent.getSectPrForPage(parent.pageIndex);
    final EdgeInsets headerTextInsets =
        isHeaderParagraph && applyHeaderTextInsets
        ? EdgeInsets.only(
            left: sectPr.leftMargin ?? 0,
            right: sectPr.rightMargin ?? 0,
          )
        : EdgeInsets.zero;

    final BoxDecoration? decoration = _getParagraphDecoration(
      _getParagraphShadingColor(),
      includeBorder: !suppressParagraphBorder,
    );

    return GestureDetector(
      onLongPress: () => printParagraphXml(),
      child: Padding(
        padding: _getPPaddings(
          spacingBeforeOverride: spacingBeforeOverride,
          spacingAfterOverride: spacingAfterOverride,
        ),
        child: SizedBox(
          width: double.infinity,
          child: Container(
            decoration: decoration,
            child: Padding(
              padding: headerTextInsets,
              child: PositionalTabLayout(
                segments: segments,
                textDirection: textDirection,
              ),
            ),
          ),
        ),
      ),
    );
  }

}
