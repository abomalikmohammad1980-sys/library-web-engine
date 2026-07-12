// import 'package:flutter_html/flutter_html.dart';
import 'dart:io';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:golden_shamela/Utils/ImageParser.dart';
import 'package:golden_shamela/WordToWidget/DrawingAnchorPositionResolver.dart';
import 'package:golden_shamela/wordToHTML/FootNote.dart';
import 'package:golden_shamela/Models/WordDocument.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:xml/xml.dart';

import '../WordToWidget/ImageToWidget.dart';
import '../wordToHTML/Paragraph.dart';
import '../wordToHTML/SectPr.dart';

part 'WordPage.g.dart';

@JsonSerializable(explicitToJson: true, constructor: 'empty')
class WordPage {
  List<Paragraph> ps = [];
  List<FootNote> fns = [];
  String pageNum = "";

  /// The 1-based page index (used for bookmark tracking)
  int pageIndex = 0;
  @JsonKey(ignore: true)
  WordDocument parent;

  WordPage(this.parent);

  WordPage.empty() : parent = WordDocument.empty();

  factory WordPage.fromJson(Map<String, dynamic> json) =>
      _$WordPageFromJson(json);
  Map<String, dynamic> toJson() => _$WordPageToJson(this);

  static WordPage fromMap(Map<String, dynamic> json, WordDocument parent) {
    final wordPage = _$WordPageFromJson(json);
    wordPage.parent = parent;
    wordPage.ps = (json['ps'] as List<dynamic>)
        .map((e) => Paragraph.fromMap(e as Map<String, dynamic>, wordPage))
        .toList();

    // إعادة بناء الحواشي بشكل صحيح مع ربط الـ parent
    if (json['fns'] != null) {
      wordPage.fns = (json['fns'] as List<dynamic>)
          .map((e) => FootNote.fromMap(e as Map<String, dynamic>, wordPage))
          .toList();
    }
    return wordPage;
  }

  /// النص المعروض فعلاً لكل فقرة مرئية — يطابق ما يضعه Flutter في الحافظة تماماً
  List<String> getVisibleRenderedTexts() {
    final result = <String>[];
    for (final p in ps) {
      if (_isParagraphVisuallyRelevant(p)) {
        result.add(p.renderedPlainText);
      }
    }
    for (final fn in fns) {
      for (final p in fn.paragraphs) {
        result.add(p.renderedPlainText);
      }
    }
    return result;
  }

  /// الفقرات المرئية ككائنات Paragraph — لاستخدامها في بناء HTML للنسخ مع التنسيق
  List<Paragraph> getVisibleParagraphs() {
    final result = <Paragraph>[];
    for (final p in ps) {
      if (_isParagraphVisuallyRelevant(p)) {
        result.add(p);
      }
    }
    for (final fn in fns) {
      for (final p in fn.paragraphs) {
        result.add(p);
      }
    }
    return result;
  }

  /// نص الصفحة (المتن + الحواشي) مع فواصل واضحة بينهما
  /// نضيف سطرين فارغين بين المتن والحواشي، وسطرين في النهاية حتى يكون هناك
  /// فراغ عند دمج صفحات متعددة.
  String text() {
    final String body = ps.map((p) => p.text).join("\n");

    final String footnotesText = fns
        .expand((fn) => fn.paragraphs)
        .map((p) => p.text)
        .where((t) => t.isNotEmpty)
        .join("\n");

    if (footnotesText.isEmpty) {
      // أعد المتن مع سطرين فارغين في النهاية لترك فاصل بين الصفحات عند النسخ
      return "$body\n\n";
    }

    // متن
    // سطرين فراغ + الحواشي + سطرين فراغ كفاصل بين الصفحات
    return "$body\n\n$footnotesText\n\n";
  }

  addParagraph(XmlElement element) {
    Paragraph p = Paragraph(this).fromXml(element);
    ps.add(p);
    // wordDocument.fontsList.addAll(p.fontsMap);
  }

  /// ECMA-376 §20.4.2.3: Floating images with wrapping modes reserve space
  /// in the text flow. Paragraphs anchoring these images are often empty and
  /// skipped by _isParagraphVisuallyRelevant, so the Column has no knowledge
  /// of the space they occupy. This method computes the vertical clearance
  /// needed at the top of the content Column so that visible content starts
  /// below the bottom of these images.
  ///
  /// [effectiveTopMargin] is the actual top padding applied to the content
  /// area (includes header height, frame padding, etc.).
  double computeFlowClearance(double effectiveTopMargin) {
    final sectPr = parent.getSectPrForPage(pageIndex);
    final topMargin = sectPr.topMargin;
    final contentHeight =
        (sectPr.height ?? 842) - topMargin - sectPr.bottomMargin;

    // Use getPageImageData() which is the same source that successfully
    // renders images in the foreground/background layers. This avoids
    // issues with image data not being available in ps[].runs after
    // JSON cache deserialization.
    final pageImages = getPageImageData();

    double maxImageBottom = 0;

    for (final img in pageImages) {
      if (img.behindDoc) continue;
      if (img.wrapMode == null || img.wrapMode == 'None') continue;

      final imgTopFromPageTop = DrawingAnchorPositionResolver.resolveTop(
        image: img,
        sectPr: sectPr,
      );
      final imgBottomFromPageTop = imgTopFromPageTop + img.height;

      // Image bottom relative to where the content Column actually starts
      double imgBottomInColumn = imgBottomFromPageTop - effectiveTopMargin;

      // Only top-zone images: avoid bottom-of-page images inflating clearance
      if (imgBottomInColumn > contentHeight * 0.5) continue;
      if (imgBottomInColumn <= 0) continue;

      if (imgBottomInColumn > maxImageBottom) {
        maxImageBottom = imgBottomInColumn;
      }
    }

    return maxImageBottom;
  }

  Widget toWidget({
    double topFlowClearance = 0,
    GlobalKey? Function(int paragraphIndex)? paragraphKeyBuilder,
  }) {
    final children = <Widget>[];

    if (topFlowClearance > 0) {
      children.add(SizedBox(height: topFlowClearance));
    }

    final previousPage = parent.getLoadedPageIfAvailable(pageIndex - 1);
    final nextPage = parent.getLoadedPageIfAvailable(pageIndex + 1);
    Paragraph? previousVisibleParagraph;

    int index = 0;
    while (index < ps.length) {
      final paragraph = ps[index];
      final borderSpec = paragraph.getParagraphBorderSpec();
      final isVisibleParagraph = _isParagraphVisuallyRelevant(paragraph);

      if (!isVisibleParagraph) {
        index++;
        continue;
      }

      // Save the current index before border groups may advance it,
      // so each widget gets a unique GlobalKey.
      final keyIndex = index;

      Widget paragraphWidget;

      if (borderSpec == null) {
        final nextVisibleParagraph = _nextVisibleParagraph(index + 1);
        paragraphWidget = paragraph.toWidget(
          spacingBeforeOverride: _collapsedSpacingBefore(
            previousVisibleParagraph,
            paragraph,
          ),
          spacingAfterOverride: nextVisibleParagraph == null
              ? (paragraph.pPr?.spacingAfter ?? 0)
              : 0,
        );
        previousVisibleParagraph = paragraph;
      } else {
        int logicalEnd = index;
        while (logicalEnd + 1 < ps.length) {
          final nextParagraph = ps[logicalEnd + 1];
          final nextSpec = nextParagraph.getParagraphBorderSpec();
          if (nextSpec == null || nextSpec.signature != borderSpec.signature) {
            break;
          }
          logicalEnd++;
        }

        final groupedParagraphs = ps
            .sublist(index, logicalEnd + 1)
            .where(_isParagraphVisuallyRelevant)
            .toList();

        if (groupedParagraphs.isEmpty) {
          index = logicalEnd + 1;
          continue;
        }

        final previousBorderedSpec = _lastVisibleBorderSpec(previousPage);
        final nextBorderedSpec = _firstVisibleBorderSpec(nextPage);
        final continuesFromPrevious =
            index == 0 &&
            previousBorderedSpec?.signature == borderSpec.signature;
        final continuesToNext =
            logicalEnd == ps.length - 1 &&
            nextBorderedSpec?.signature == borderSpec.signature;

        final nextVisibleParagraph = _nextVisibleParagraph(logicalEnd + 1);

        paragraphWidget = _ParagraphBorderGroupWidget(
          paragraphs: groupedParagraphs,
          spec: borderSpec,
          previousParagraph: previousVisibleParagraph,
          nextParagraph: nextVisibleParagraph,
          paintTop: !continuesFromPrevious,
          paintBottom: !continuesToNext,
        );
        previousVisibleParagraph = groupedParagraphs.last;
        index = logicalEnd + 1;
      }

      // Apply paragraph key if supplied (used for search-result scrolling)
      // Use keyIndex (saved before border groups mutate `index`) to avoid
      // duplicate keys when a bordered group advances index to logicalEnd+1.
      final key = paragraphKeyBuilder?.call(keyIndex);
      if (key != null) {
        children.add(KeyedSubtree(key: key, child: paragraphWidget));
      } else {
        children.add(paragraphWidget);
      }

      if (borderSpec == null) index++;
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: children,
    );
  }

  Paragraph? _nextVisibleParagraph(int startIndex) {
    for (int i = startIndex; i < ps.length; i++) {
      final paragraph = ps[i];
      if (_isParagraphVisuallyRelevant(paragraph)) {
        return paragraph;
      }
    }
    return null;
  }

  List<ImageData> getPageImageData() {
    SectPr sectPr = parent.getSectPrForPage(pageIndex);
    return getParagraphImages(ps, sectPr);
  }

  Widget getPageIamgesWiLi() {
    List<ImageData> list = getPageImageData();
    return imageToWidgetList(list);
  }

  /// الصور الخلفية (behindDoc=true) - تُعرض خلف الهيدر والمحتوى
  Widget getBackgroundImages() {
    List<ImageData> list = getPageImageData();
    List<ImageData> backgroundImages = list
        .where((img) => img.behindDoc)
        .toList();
    return imageToWidgetList(backgroundImages);
  }

  /// الصور الأمامية (behindDoc=false) - تُعرض أمام الهيدر والمحتوى
  Widget getForegroundImages() {
    List<ImageData> list = getPageImageData();
    List<ImageData> foregroundImages = list
        .where((img) => !img.behindDoc)
        .toList();
    // ترتيب حسب relativeHeight
    foregroundImages.sort(
      (a, b) => a.relativeHeight.compareTo(b.relativeHeight),
    );
    return imageToWidgetList(foregroundImages);
  }

  // String htmlFooter() {
  //   String pageNumHtml = getPageNumH();
  //   if (fns.isEmpty) return pageNumHtml;
  //   String html = "";
  //   fns.forEach((fn) {
  //     html = html + fn.p.toHTML();
  //   });
  //   html += pageNumHtml;
  //
  //   return html;
  // }

  /// الحواشي (Footnotes) - تظهر داخل حدود الصفحة
  Widget footnotesW() {
    if (fns.isEmpty) return SizedBox.shrink();

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        ...fns.expand(
          (fn) => fn.paragraphs.map(
            (paragraph) => Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: 16.0,
                vertical: 2.0,
              ),
              child: paragraph.toWidget(),
            ),
          ),
        ),
      ],
    );
  }

  /// رقم الصفحة (Footer) - يظهر في الهامش السفلي
  Widget footerW() {
    SectPr sectPr = parent.getSectPrForPage(this.pageIndex);

    // Calculate page number using the document's current page index
    String pageNumStr = sectPr.calculatePageNumber(this.pageIndex);

    Widget footerContent = sectPr.getSectFooterWidget(this, pageNumStr);

    return footerContent;
  }

  // getPageNumW removed as it is no longer needed

  // sortImages(List<ImageData> list) {
  //   list.reversed;
  // }

  // String addImages(String html) {
  //   ps.forEach((p) {
  //     p.runs.forEach((r) {
  //       if (r.image != null) html = html + r.image!.toHtml();
  //     });
  //   });
  //   return html;
  // }

  //
  // String getSeperator() {
  //   return '''<hr style="border: none; border-top: 50px solid black; width: 100%; margin: auto;"> ''';
  // }

  /// طباعة XML الصفحة كاملاً مع إخفاء بيانات الصور الطويلة
  void printPageXml() {
    print(
      "╔══════════════════════════════════════════════════════════════════╗",
    );
    print(
      "║                     PAGE XML START                               ║",
    );
    print(
      "╚══════════════════════════════════════════════════════════════════╝",
    );

    StringBuffer pageBuffer = StringBuffer();
    pageBuffer.writeln(
      "╔══════════════════════════════════════════════════════════════════╗",
    );
    pageBuffer.writeln(
      "║                     PAGE XML START                               ║",
    );
    pageBuffer.writeln(
      "╚══════════════════════════════════════════════════════════════════╝",
    );

    for (int i = 0; i < ps.length; i++) {
      var p = ps[i];
      // استخدام xmlString المحفوظ، أو pXml إذا كان متاحاً
      String? xmlStr;
      if (p.xmlString.isNotEmpty) {
        xmlStr = p.xmlString;
      } else if (p.pXml != null) {
        xmlStr = p.pXml!.toXmlString(pretty: true);
      }

      if (xmlStr != null && xmlStr.isNotEmpty) {
        String logMsg = "\n--- Paragraph $i ---";
        print(logMsg);
        print(xmlStr);

        pageBuffer.writeln(logMsg);
        pageBuffer.writeln(xmlStr);
      }
    }

    print(
      "\n╔══════════════════════════════════════════════════════════════════╗",
    );
    print(
      "║                      PAGE XML END                                ║",
    );
    print(
      "╚══════════════════════════════════════════════════════════════════╝",
    );

    pageBuffer.writeln(
      "\n╔══════════════════════════════════════════════════════════════════╗",
    );
    pageBuffer.writeln(
      "║                      PAGE XML END                                ║",
    );
    pageBuffer.writeln(
      "╚══════════════════════════════════════════════════════════════════╝",
    );

    try {
      final file = File('test_page_xml.xml');
      file.writeAsStringSync(pageBuffer.toString());
      print("✅ XML saved to file: ${file.absolute.path}");
    } catch (e) {
      print("❌ Error saving XML to file: $e");
    }

    // Save header XML
    _saveHeaderXml();

    // Save footer XML
    _saveFooterXml();
  }

  /// حفظ XML الهيدر في ملف منفصل
  void _saveHeaderXml() {
    try {
      SectPr sectPr = parent.getSectPrForPage(this.pageIndex);
      XmlElement? header = sectPr.getRequestedHeader(this.pageIndex);

      if (header != null) {
        StringBuffer headerBuffer = StringBuffer();
        headerBuffer.writeln(
          "╔══════════════════════════════════════════════════════════════════╗",
        );
        headerBuffer.writeln(
          "║                     HEADER XML START                              ║",
        );
        headerBuffer.writeln(
          "╚══════════════════════════════════════════════════════════════════╝",
        );

        headerBuffer.writeln(header.toXmlString(pretty: true));

        headerBuffer.writeln(
          "╔══════════════════════════════════════════════════════════════════╗",
        );
        headerBuffer.writeln(
          "║                      HEADER XML END                              ║",
        );
        headerBuffer.writeln(
          "╚══════════════════════════════════════════════════════════════════╝",
        );

        final file = File('test_header_xml.xml');
        file.writeAsStringSync(headerBuffer.toString());
        print("✅ Header XML saved to file: ${file.absolute.path}");
      } else {
        print("ℹ️ No header found for page ${this.pageIndex}");
      }
    } catch (e) {
      print("❌ Error saving header XML to file: $e");
    }
  }

  /// حفظ XML الفوتر في ملف منفصل
  void _saveFooterXml() {
    try {
      SectPr sectPr = parent.getSectPrForPage(this.pageIndex);
      XmlElement? footer = sectPr.getRequestedFooter(this.pageIndex);

      if (footer != null) {
        StringBuffer footerBuffer = StringBuffer();
        footerBuffer.writeln(
          "╔══════════════════════════════════════════════════════════════════╗",
        );
        footerBuffer.writeln(
          "║                     FOOTER XML START                              ║",
        );
        footerBuffer.writeln(
          "╚══════════════════════════════════════════════════════════════════╝",
        );

        footerBuffer.writeln(footer.toXmlString(pretty: true));

        footerBuffer.writeln(
          "╔══════════════════════════════════════════════════════════════════╗",
        );
        footerBuffer.writeln(
          "║                      FOOTER XML END                              ║",
        );
        footerBuffer.writeln(
          "╚══════════════════════════════════════════════════════════════════╝",
        );

        final file = File('test_footer_xml.xml');
        file.writeAsStringSync(footerBuffer.toString());
        print("✅ Footer XML saved to file: ${file.absolute.path}");
      } else {
        print("ℹ️ No footer found for page ${this.pageIndex}");
      }
    } catch (e) {
      print("❌ Error saving footer XML to file: $e");
    }
  }
}

class _ParagraphBorderGroupWidget extends StatelessWidget {
  final List<Paragraph> paragraphs;
  final ParagraphBorderSpec spec;
  final Paragraph? previousParagraph;
  final Paragraph? nextParagraph;
  final bool paintTop;
  final bool paintBottom;

  const _ParagraphBorderGroupWidget({
    required this.paragraphs,
    required this.spec,
    this.previousParagraph,
    this.nextParagraph,
    this.paintTop = true,
    this.paintBottom = true,
  });

  @override
  Widget build(BuildContext context) {
    // w:pBdr's "space" attribute = gap between the border line and the text
    // (inner padding).  This is the ONLY spacing that belongs inside the box.
    final topSpace = _spaceToPx(spec.top?.space ?? 0);
    final bottomSpace = _spaceToPx(spec.bottom?.space ?? 0);
    final leftSpace = _spaceToPx(spec.left?.space ?? 0);
    final rightSpace = _spaceToPx(spec.right?.space ?? 0);

    // In Word, w:spacing before/after is the paragraph MARGIN and appears
    // OUTSIDE the border box, not inside it.  Apply it as an outer Padding
    // so the CustomPaint (= the border) covers only the content area.
    final outerTopSpacing = _collapsedSpacingBefore(
      previousParagraph,
      paragraphs.first,
    );
    // Only apply spacingAfter when this group is the last visible element;
    // otherwise the next element's spacingBefore handles the collapsed gap.
    final outerBottomSpacing = nextParagraph == null
        ? (paragraphs.last.pPr?.spacingAfter ?? 0.0)
        : 0.0;

    // Paragraph shading fills the entire area inside the border, including the
    // w:pBdr space gap (see §17.3.1.31 shd — background is behind the paragraph).
    Color? backgroundColor;
    for (final p in paragraphs) {
      backgroundColor = p.paragraphShadingColor;
      if (backgroundColor != null) break;
    }

    return Padding(
      padding: EdgeInsets.only(
        top: outerTopSpacing,
        bottom: outerBottomSpacing,
      ),
      child: CustomPaint(
        foregroundPainter: _ParagraphBorderGroupPainter(
          spec: spec,
          paintTop: paintTop,
          paintBottom: paintBottom,
        ),
        child: Container(
          color: backgroundColor,
          child: Padding(
            padding: EdgeInsets.only(
              top: paintTop ? topSpace : 0,
              bottom: paintBottom ? bottomSpace : 0,
              left: leftSpace,
              right: rightSpace,
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: List.generate(paragraphs.length, (index) {
                final paragraph = paragraphs[index];
                final previous = index == 0
                    ? previousParagraph
                    : paragraphs[index - 1];
                return paragraph.toWidget(
                  suppressParagraphBorder: true,
                  // First paragraph: outer spacing is in the wrapping Padding
                  spacingBeforeOverride: index == 0
                      ? 0
                      : _collapsedSpacingBefore(previous, paragraph),
                  // All paragraphs: outer bottom spacing is in wrapping Padding
                  spacingAfterOverride: 0,
                );
              }),
            ),
          ),
        ),
      ),
    );
  }
}

double _collapsedSpacingBefore(Paragraph? previous, Paragraph current) {
  final currentBefore = current.pPr?.spacingBefore ?? 0;
  if (previous == null) {
    return currentBefore;
  }

  final previousAfter = previous.pPr?.spacingAfter ?? 0;

  // Word collapses the gap between adjacent paragraphs by using the larger
  // of the two competing spacing values, rather than summing both.
  return math.max(previousAfter, currentBefore);
}

class _ParagraphBorderGroupPainter extends CustomPainter {
  final ParagraphBorderSpec spec;
  final bool paintTop;
  final bool paintBottom;

  const _ParagraphBorderGroupPainter({
    required this.spec,
    this.paintTop = true,
    this.paintBottom = true,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final rect = Offset.zero & size;

    if (paintTop) {
      _paintHorizontal(canvas, rect, spec.top, rect.top);
    }
    if (paintBottom) {
      _paintHorizontal(canvas, rect, spec.bottom, rect.bottom, isBottom: true);
    }
    _paintVertical(canvas, rect, spec.left, rect.left);
    _paintVertical(canvas, rect, spec.right, rect.right, isRight: true);
  }

  void _paintHorizontal(
    Canvas canvas,
    Rect rect,
    ParagraphBorderSideSpec? side,
    double y, {
    bool isBottom = false,
  }) {
    if (side == null) return;

    final strokeWidth = side.width;
    final adjustedY = isBottom ? y - strokeWidth / 2 : y + strokeWidth / 2;

    if (side.style == 'double') {
      _drawDoubleHorizontal(canvas, rect, side, adjustedY);
      return;
    }

    _drawLine(
      canvas,
      Offset(rect.left, adjustedY),
      Offset(rect.right, adjustedY),
      side,
    );
  }

  void _paintVertical(
    Canvas canvas,
    Rect rect,
    ParagraphBorderSideSpec? side,
    double x, {
    bool isRight = false,
  }) {
    if (side == null) return;

    final strokeWidth = side.width;
    final adjustedX = isRight ? x - strokeWidth / 2 : x + strokeWidth / 2;

    if (side.style == 'double') {
      _drawDoubleVertical(canvas, rect, side, adjustedX);
      return;
    }

    _drawLine(
      canvas,
      Offset(adjustedX, rect.top),
      Offset(adjustedX, rect.bottom),
      side,
    );
  }

  void _drawDoubleHorizontal(
    Canvas canvas,
    Rect rect,
    ParagraphBorderSideSpec side,
    double centerY,
  ) {
    final lineWidth = (side.width / 3).clamp(0.5, side.width);
    final gap = lineWidth;
    final offset = (gap / 2) + (lineWidth / 2);

    _drawLineWithWidth(
      canvas,
      Offset(rect.left, centerY - offset),
      Offset(rect.right, centerY - offset),
      side,
      lineWidth,
    );
    _drawLineWithWidth(
      canvas,
      Offset(rect.left, centerY + offset),
      Offset(rect.right, centerY + offset),
      side,
      lineWidth,
    );
  }

  void _drawDoubleVertical(
    Canvas canvas,
    Rect rect,
    ParagraphBorderSideSpec side,
    double centerX,
  ) {
    final lineWidth = (side.width / 3).clamp(0.5, side.width);
    final gap = lineWidth;
    final offset = (gap / 2) + (lineWidth / 2);

    _drawLineWithWidth(
      canvas,
      Offset(centerX - offset, rect.top),
      Offset(centerX - offset, rect.bottom),
      side,
      lineWidth,
    );
    _drawLineWithWidth(
      canvas,
      Offset(centerX + offset, rect.top),
      Offset(centerX + offset, rect.bottom),
      side,
      lineWidth,
    );
  }

  void _drawLine(
    Canvas canvas,
    Offset start,
    Offset end,
    ParagraphBorderSideSpec side,
  ) {
    _drawLineWithWidth(canvas, start, end, side, side.width);
  }

  void _drawLineWithWidth(
    Canvas canvas,
    Offset start,
    Offset end,
    ParagraphBorderSideSpec side,
    double width,
  ) {
    final paint = Paint()
      ..color = side.color
      ..strokeWidth = width
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.butt;

    final dashPattern = _borderDashPattern(side.style, width);
    if (dashPattern != null) {
      _drawDashedLine(canvas, start, end, paint, dashPattern);
    } else {
      canvas.drawLine(start, end, paint);
    }
  }

  /// Returns the [dash, gap, …] segment lengths for a dashed OOXML border
  /// style, or null when the style should be drawn as a solid line.
  List<double>? _borderDashPattern(String style, double width) {
    final w = width.clamp(0.5, 6.0);
    switch (style) {
      // ── dotted ──────────────────────────────────────────────────────────
      case 'dotted':
      case 'dottedHeavy':
        return [w, w * 2];
      // ── dashed ──────────────────────────────────────────────────────────
      case 'dashed':
      case 'dashSmallGap':
      case 'dashedSmallGap':
      case 'dashLargeGap':
      case 'dashLarge':
        return [w * 3, w * 2];
      // ── dot‑dash (one dot, one dash) ─────────────────────────────────────
      case 'dotDash':
      case 'dashDot':
        return [w, w * 2, w * 3, w * 2];
      // ── dot‑dot‑dash (two dots, one dash) ───────────────────────────────
      case 'dotDotDash':
      case 'dashDotDot':
        return [w, w * 2, w, w * 2, w * 3, w * 2];
      // ── all other styles (single, double, inset, outset, thick …) ───────
      default:
        return null;
    }
  }

  /// Draws a dashed line from [start] to [end] using the given [pattern].
  /// [pattern] is a list of [dash, gap, dash, gap …] pixel lengths.
  void _drawDashedLine(
    Canvas canvas,
    Offset start,
    Offset end,
    Paint paint,
    List<double> pattern,
  ) {
    final dx = end.dx - start.dx;
    final dy = end.dy - start.dy;
    final totalLength = math.sqrt(dx * dx + dy * dy);
    if (totalLength == 0) return;

    final ux = dx / totalLength;
    final uy = dy / totalLength;

    double distance = 0;
    int index = 0;
    bool drawing = true;

    while (distance < totalLength) {
      final segLen = math.min(
        pattern[index % pattern.length],
        totalLength - distance,
      );
      if (drawing && segLen > 0) {
        final segStart = Offset(
          start.dx + ux * distance,
          start.dy + uy * distance,
        );
        final segEnd = Offset(
          start.dx + ux * (distance + segLen),
          start.dy + uy * (distance + segLen),
        );
        canvas.drawLine(segStart, segEnd, paint);
      }
      distance += pattern[index % pattern.length];
      index++;
      drawing = !drawing;
    }
  }

  @override
  bool shouldRepaint(covariant _ParagraphBorderGroupPainter oldDelegate) {
    return oldDelegate.spec.signature != spec.signature ||
        oldDelegate.paintTop != paintTop ||
        oldDelegate.paintBottom != paintBottom;
  }
}

double _spaceToPx(double points) {
  return points * 1.333;
}

ParagraphBorderSpec? _firstVisibleBorderSpec(WordPage? page) {
  if (page == null) return null;
  for (final paragraph in page.ps) {
    if (!_isParagraphVisuallyRelevant(paragraph)) continue;
    final spec = paragraph.getParagraphBorderSpec();
    if (spec != null) return spec;
  }
  return null;
}

ParagraphBorderSpec? _lastVisibleBorderSpec(WordPage? page) {
  if (page == null) return null;
  for (final paragraph in page.ps.reversed) {
    if (!_isParagraphVisuallyRelevant(paragraph)) continue;
    final spec = paragraph.getParagraphBorderSpec();
    if (spec != null) return spec;
  }
  return null;
}

bool _isParagraphVisuallyRelevant(Paragraph paragraph) {
  if (paragraph.imageRunTs.isNotEmpty) return true;

  final inlineImageRuns = paragraph.textRunTs
      .where((run) => run.image != null && run.image!.wrapMode == null)
      .toList();
  if (inlineImageRuns.isNotEmpty) {
    return true;
  }

  final normalizedText = paragraph.text
      .replaceAll(RegExp(r'\{\{PG:\d+\}\}'), '')
      .replaceAll('\u00A0', '')
      .trim();
  if (normalizedText.isNotEmpty) return true;

  for (final run in paragraph.runs) {
    if (run.rpr?.vanish == true) continue;
    final runText = (run.text ?? '')
        .replaceAll(RegExp(r'\{\{PG:\d+\}\}'), '')
        .trim();
    if (runText.isNotEmpty) return true;
  }

  // In Word, an empty paragraph mark still occupies vertical space and carries
  // paragraph formatting. We only drop paragraphs that are purely structural,
  // such as hidden page markers or page-break carrier paragraphs.
  return !_isPureStructuralParagraph(paragraph);
}

bool _isPureStructuralParagraph(Paragraph paragraph) {
  final xml = paragraph.pXml;
  if (xml == null) {
    return false;
  }

  final hasVisibleNonTextContent = xml.descendants.whereType<XmlElement>().any((
    element,
  ) {
    switch (element.name.local) {
      case 'drawing':
      case 'pict':
      case 'object':
      case 'tab':
      case 'sym':
        return true;
      default:
        return false;
    }
  });
  if (hasVisibleNonTextContent) {
    return false;
  }

  final hasPageBreakOnly = xml
      .findAllElements('w:br')
      .any((br) => br.getAttribute('w:type') == 'page');
  if (hasPageBreakOnly) {
    return true;
  }

  if (paragraph.runs.isEmpty) {
    return false;
  }

  return paragraph.runs.every((run) {
    if (run.image != null) {
      return false;
    }

    final runText = (run.text ?? '')
        .replaceAll(RegExp(r'\{\{PG:\d+\}\}'), '')
        .replaceAll('\u00A0', '')
        .trim();
    if (runText.isNotEmpty) {
      return false;
    }

    return run.rpr?.vanish == true;
  });
}

List<ImageData> getParagraphImages(List<Paragraph> paragraphs, SectPr sectPr) {
  // Content area = page area minus margins. Images exceeding this MUST be at page level.
  double contentW =
      (sectPr.width ?? 595) - sectPr.leftMargin - sectPr.rightMargin;
  double contentH =
      (sectPr.height ?? 842) - sectPr.topMargin - sectPr.bottomMargin;

  List<ImageData> list = [];
  paragraphs.forEach((p) {
    p.runs.forEach((r) {
      // FIX: Exclude inline images (wrapMode == null) from the page-level image stack.
      // Inline images are already rendered within the text flow (Paragraph.toWidget).
      // Including them here causes duplication (appearing at 0,0 or top-left).
      //
      // OOXML Spec: paragraph-relative images that EXCEED the content area
      // (e.g., full-page covers) must be at page level to extend beyond margins.
      // Small paragraph-relative images stay at paragraph level for correct positioning.
      bool isParaRelative = r.isRelativeFromVParagraph();
      bool exceedsContentArea =
          r.image != null &&
          (r.image!.width > contentW + 20 || r.image!.height > contentH + 20);

      if (r.image != null &&
          r.image!.wrapMode != null &&
          (!isParaRelative || exceedsContentArea)) {
        // تخطي مربعات النص هنا لأننا نعرضها داخل الفقرة نفسها
        list.add(r.image!);
      }
    });
  });
  // ترتيب الصور: في Stack العناصر الأخيرة تظهر فوق العناصر السابقة
  // 1. أولاً: الصور خلف النص (behindDoc=true) تأتي أولاً في القائمة (تظهر تحت)
  // 2. ثانياً: الصور أمام النص (behindDoc=false) تأتي في النهاية (تظهر فوق)
  // 3. داخل كل مجموعة: ترتيب تصاعدي حسب relativeHeight
  list.sort((a, b) {
    // الصور خلف النص تأتي أولاً
    if (a.behindDoc != b.behindDoc) {
      return a.behindDoc ? -1 : 1; // behindDoc=true يأتي أولاً (يظهر تحت)
    }
    // داخل نفس المجموعة، ترتيب حسب relativeHeight تصاعدياً
    return a.relativeHeight.compareTo(b.relativeHeight);
  });

  return list;
}

Widget imageToWidgetList(List<ImageData> list) {
  if (list.isEmpty) {
    return SizedBox.shrink();
  }

  List<Widget> imagesW = [];
  list.forEach((image) {
    imagesW.add(getImageWidget(image));
  });

  // Stack مع Align children يعمل بشكل صحيح
  // ترتيب الصور حسب behindDoc و relativeHeight يحدد أي صورة تظهر فوق الأخرى
  return Stack(children: [...imagesW]);
}
