import 'package:flutter/widgets.dart';
import 'package:golden_shamela/wordToHTML/Paragraph.dart';

class FooterFrameLayout {
  static List<Widget> build(List<Paragraph> paragraphs) {
    final widgets = <Widget>[];

    int i = 0;
    while (i < paragraphs.length) {
      final paragraph = paragraphs[i];

      if (_hasFramePr(paragraph)) {
        final framedParagraphs = <Paragraph>[paragraph];

        int j = i + 1;
        while (j < paragraphs.length && _sameFramePr(paragraphs[j - 1], paragraphs[j])) {
          framedParagraphs.add(paragraphs[j]);
          j++;
        }

        final hasAnchorParagraph = j < paragraphs.length && !_hasFramePr(paragraphs[j]);
        final isSharedFrame = framedParagraphs.length > 1;

        if (isSharedFrame) {
          // OOXML framePr: adjacent paragraphs with identical framePr belong to
          // one text frame, so they must be laid out as a single overlay.
          final frameWidget = _buildSharedFrameGroup(framedParagraphs);
          if (hasAnchorParagraph) {
            final anchorParagraph = paragraphs[j];
            widgets.add(
              Stack(
                clipBehavior: Clip.none,
                alignment: Alignment.topLeft,
                children: [
                  Opacity(
                    opacity: 0,
                    child: IgnorePointer(
                      child: anchorParagraph.toWidget(),
                    ),
                  ),
                  frameWidget,
                ],
              ),
            );
            i = j + 1;
            continue;
          }

          widgets.add(frameWidget);
          i = j;
          continue;
        }

        paragraph.shrinkTextLayerWidth = true;

        if (hasAnchorParagraph) {
          widgets.add(
            Stack(
              clipBehavior: Clip.none,
              alignment: Alignment.topLeft,
              children: [
                paragraphs[j].toWidget(),
                ...framedParagraphs.map((p) => p.toWidget()),
              ],
            ),
          );
          i = j + 1;
          continue;
        }

        widgets.addAll(framedParagraphs.map((p) => p.toWidget()));
        i = j;
        continue;
      }

      widgets.add(paragraph.toWidget());
      i++;
    }

    return widgets;
  }

  static Widget _buildSharedFrameGroup(List<Paragraph> framedParagraphs) {
    final firstParagraph = framedParagraphs.first;
    final sectPr = firstParagraph.parent.parent.getSectPrForPage(
      firstParagraph.parent.pageIndex,
    );

    for (final paragraph in framedParagraphs) {
      paragraph.shrinkTextLayerWidth = false;
      paragraph.applyHeaderTextInsets = false;
    }

    return Padding(
      // The frame is anchored to the text area (hAnchor="text"), so paragraph
      // decorations such as shading must be constrained to page margins here.
      padding: EdgeInsets.only(
        left: sectPr.leftMargin ?? 0,
        right: sectPr.rightMargin ?? 0,
      ),
      child: SizedBox(
        width: double.infinity,
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: framedParagraphs.map(_buildSharedFrameParagraph).toList(),
        ),
      ),
    );
  }

  static Widget _buildSharedFrameParagraph(Paragraph paragraph) {
    return paragraph.toWidget();
  }

  static bool _hasFramePr(Paragraph paragraph) {
    return paragraph.pPr?.xmlpPr?.getElement("w:framePr") != null;
  }

  static bool _sameFramePr(Paragraph a, Paragraph b) {
    final aFrame = a.pPr?.xmlpPr?.getElement("w:framePr");
    final bFrame = b.pPr?.xmlpPr?.getElement("w:framePr");
    if (aFrame == null || bFrame == null) return false;
    return aFrame.toXmlString(pretty: false) == bFrame.toXmlString(pretty: false);
  }
}
