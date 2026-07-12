part of 'Paragraph.dart';

/// Extracted from Paragraph.dart to keep the core class small while
/// preserving the same library-private access and rendering behavior.
mixin ParagraphTocRendering on ParagraphMembers {
  Widget _buildTOCWidget() {
    // Split runs at the LAST tab (the leader tab before page number).
    // Earlier tabs are internal (e.g. between "1-" and text).
    // Important: in WordprocessingML the page number may live in the SAME run
    // as the last w:tab (`<w:tab/><w:t>107</w:t>`), so we must preserve that
    // run's text instead of dropping the whole run as "tab only".
    List<runT> entryRuns = [];
    List<runT> pageNumRuns = [];
    int lastTabIndex = -1;
    for (int i = textRunTs.length - 1; i >= 0; i--) {
      if (textRunTs[i].hasTab) {
        lastTabIndex = i;
        break;
      }
    }

    for (int i = 0; i < textRunTs.length; i++) {
      if (i == lastTabIndex) {
        final tabRun = textRunTs[i];
        if ((tabRun.text?.trim().isNotEmpty ?? false)) {
          pageNumRuns.add(tabRun);
        }
        continue;
      }
      if (lastTabIndex != -1 && i > lastTabIndex) {
        pageNumRuns.add(textRunTs[i]);
      } else {
        entryRuns.add(textRunTs[i]);
      }
    }

    // For TOC entries rendered as a single-line Row, the effective leading-edge
    // indent is the sum of paragraph indent (w:left) and firstLine indent
    // (w:firstLine), because the entire entry text represents the "first line."
    // Common TOC pattern: negative w:left + large w:firstLine = positive indent.
    // Clamp to non-negative: Flutter Padding does not allow negative values.
    double indent = (pPr?.paddingRight ?? 0) + (pPr?.firstLineIndent ?? 0);
    if (indent < 0) indent = 0;

    // Get leader type from tab stops
    String leaderType = "dot";
    TabStop? rightTab = pPr?.getRightTabStop();
    if (rightTab != null && rightTab.hasLeader) {
      leaderType = rightTab.leader ?? "dot";
    }

    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: () => _handleTOCTap(),
        hoverColor: Colors.blue.withOpacity(0.1),
        splashColor: Colors.blue.withOpacity(0.2),
        child: Padding(
          padding: EdgeInsets.only(
            right: 8 + indent,
            left: 8,
            top: 2,
            bottom: 2,
          ),
          child: Directionality(
            textDirection: TextDirection.rtl,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.baseline,
              textBaseline: TextBaseline.alphabetic,
              children: [
                // 1. Entry text (takes natural width, no flex competition)
                Flexible(
                  flex: 0,
                  child: RichText(
                    textDirection: TextDirection.rtl,
                    text: TextSpan(
                      style: prPr?.getTextStyle(),
                      children: entryRuns.map((r) => r.toWidget()).toList(),
                    ),
                  ),
                ),

                // 2. Dot leaders (expands to fill available space)
                Expanded(
                  child: _buildLeaderWidget(
                    leaderType,
                    fontFamily: parent.parent.minorFont,
                    fontSize: _getTocMainFontSize(entryRuns),
                  ),
                ),

                // 3. Page number (fixed, at the end)
                if (pageNumRuns.isNotEmpty)
                  RichText(
                    textDirection: TextDirection.ltr, // Numbers are LTR
                    text: TextSpan(
                      style: prPr?.getTextStyle(),
                      children: pageNumRuns
                          .map(
                            (r) => r.hasTab
                                ? _buildTOCPageNumberSpan(r)
                                : r.toWidget(),
                          )
                          .toList(),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  InlineSpan _buildTOCPageNumberSpan(runT run) {
    final text = run.checkDiacritics();
    return TextSpan(text: text, style: run.getEffectiveTextStyle());
  }

  /// Get the main font from TOC entry runs (first run that has a font defined)
  String? _getTocMainFont(List<runT> entryRuns) {
    for (runT run in entryRuns) {
      if (run.rpr?.font != null && run.rpr!.font!.isNotEmpty) {
        return run.rpr!.font;
      }
    }
    return null;
  }

  /// Get the main font size from TOC entry runs (first run that has a font size defined)
  double? _getTocMainFontSize(List<runT> entryRuns) {
    for (runT run in entryRuns) {
      if (run.rpr?.fontSize != null) {
        return run.rpr!.fontSize;
      }
    }
    return null;
  }

  /// Build a leader widget (dots, underscores, etc.) for TOC
  Widget _buildLeaderWidget(
    String leaderType, {
    String? fontFamily,
    double? fontSize,
  }) {
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
      default:
        leaderChar = ".";
    }

    // Use font from runs, fallback to jreg
    final effectiveFont = fontFamily ?? "jreg";
    final effectiveSize = fontSize ?? 14.0;

    return LayoutBuilder(
      builder: (context, constraints) {
        // Calculate char width based on font size
        double charWidth = leaderChar == "."
            ? (effectiveSize * 0.3)
            : (effectiveSize * 0.5);
        int charCount = (constraints.maxWidth / charWidth).floor();
        if (charCount < 3) charCount = 3;

        return Padding(
          padding: EdgeInsets.symmetric(horizontal: 4),
          child: Text(
            leaderChar * charCount,
            textDirection: TextDirection.ltr,
            overflow: TextOverflow.clip,
            maxLines: 1,
            style: TextStyle(
              fontFamily: effectiveFont,
              fontSize: effectiveSize,
              letterSpacing: 1.0,
              color: Colors.black54,
            ),
          ),
        );
      },
    );
  }

  /// Handle tap on TOC entry - navigate to target page
  void _handleTOCTap() {
    ParagraphTocNavigator.handleTap(this as Paragraph);
  }

}
