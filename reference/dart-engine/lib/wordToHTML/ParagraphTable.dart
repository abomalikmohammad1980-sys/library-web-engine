import 'package:flutter/cupertino.dart';

import 'package:golden_shamela/wordToHTML/Paragraph.dart';

import 'package:golden_shamela/wordToHTML/DocumentStyles.dart';

import 'package:golden_shamela/wordToHTML/TableStyleHelper.dart';
import 'package:golden_shamela/wordToHTML/TableCellContentResolver.dart';



import 'package:flutter/material.dart';

import 'package:flutter/rendering.dart';

import 'package:golden_shamela/Models/WordDocument.dart';

import 'package:golden_shamela/Models/WordPage.dart';

import 'package:golden_shamela/wordToHTML/SectPr.dart';

import 'package:xml/xml.dart';



import 'RPr.dart';



class ParagraphTable extends Paragraph {

  ParagraphTable(super.parent);

  bool trimTrailingStructuralEmptyCellParagraphs = false;



  @override

  Widget toWidget({
    bool suppressParagraphBorder = false,
    double? spacingBeforeOverride,
    double? spacingAfterOverride,
  }) {

    // Ensure pXml is available. If loaded from cache, it might need parsing from xmlString

    if (pXml == null && xmlString.isNotEmpty) {

      try {

        pXml = XmlDocument.parse(xmlString).rootElement;

      } catch (e) {

        print("Error parsing table XML: $e");

      }

    }



    final widget = pXml != null
        ? WordTableWidget(
            pXml!,
            super.parent,
            disableUrlAutoDetection: disableUrlAutoDetection,
            trimTrailingStructuralEmptyCellParagraphs:
                trimTrailingStructuralEmptyCellParagraphs,
            textBoxFillColor: textBoxFillColor,
          )
        : SizedBox.shrink();

    return Padding(
      padding: getPPaddingsForLayout(
        spacingBeforeOverride: spacingBeforeOverride,
        spacingAfterOverride: spacingAfterOverride,
      ),
      child: widget,
    );

  }

}



class WordTableWidget extends StatelessWidget {

  XmlElement tblXml;

  WordPage parent;
  final bool disableUrlAutoDetection;
  final bool trimTrailingStructuralEmptyCellParagraphs;
  final Color? textBoxFillColor;



  WordTableWidget(
    this.tblXml,
    this.parent, {
    this.disableUrlAutoDetection = true,
    this.trimTrailingStructuralEmptyCellParagraphs = false,
    this.textBoxFillColor,
  });



  @override

  Widget build(BuildContext context) {
    final mediaWidth = MediaQuery.of(context).size.width;
    final sectPr = parent.parent.getSectPrForPage(parent.pageIndex);
    final fallbackBodyWidth =
        (sectPr.width ?? mediaWidth) - sectPr.leftMargin - sectPr.rightMargin;
    final availableWidth = fallbackBodyWidth > 0 ? fallbackBodyWidth : mediaWidth;
    final bool bidi = isTableBidiVisual(tblXml);
    final double tableIndentPx = getTableIndentPx(tblXml);
    final double usableWidth = tableIndentPx >= availableWidth
        ? availableWidth
        : (availableWidth - tableIndentPx);

    // 1. Get Grid Column Widths
    List<double> gridColWidths = _getGridColWidths();

    // 2. Calculate Total Table Width in Twips
    double totalGridTwips = 0;
    if (gridColWidths.isNotEmpty) {
      totalGridTwips = gridColWidths.fold(0, (sum, w) => sum + w);
    } else {
      // Fallback: Check first row if grid is missing
      var firstRow = tblXml.findAllElements('w:tr').firstOrNull;
      if (firstRow != null) {
        for (var cell in firstRow.findAllElements('w:tc')) {
          var w = cell
              .getElement('w:tcPr')
              ?.getElement('w:tcW')
              ?.getAttribute('w:w');
          totalGridTwips += double.tryParse(w ?? '0') ?? 0;
        }
      }
    }

    if (totalGridTwips == 0) totalGridTwips = 1;

    // 3. Convert Twips to Pixels
    double naturalWidthPx = totalGridTwips * 0.0667;

    // 4. Determine Scale Factor and Final Width
    double scaleFactor;
    double finalTableWidth;
    double? targetWidthPx;

    var tblPr = tblXml.getElement('w:tblPr');
    var tblW = tblPr?.getElement('w:tblW');
    if (tblW != null) {
      String type = tblW.getAttribute('w:type') ?? 'auto';
      double val = double.tryParse(tblW.getAttribute('w:w') ?? '0') ?? 0;

      if (val > 0) {
        if (type == 'pct') {
          targetWidthPx = usableWidth * (val / 5000.0);
        } else if (type == 'dxa') {
          targetWidthPx = val * 0.0667;
        }
      }
    }

    if (targetWidthPx != null && targetWidthPx > 0) {
      finalTableWidth = targetWidthPx > usableWidth
          ? usableWidth
          : targetWidthPx;
      scaleFactor = totalGridTwips > 1
          ? finalTableWidth / totalGridTwips
          : 0.0667;
    } else {
      if (naturalWidthPx <= usableWidth) {
        scaleFactor = 0.0667;
        finalTableWidth = naturalWidthPx;
      } else {
        finalTableWidth = usableWidth;
        scaleFactor = usableWidth / totalGridTwips;
      }
    }

    List<Widget> rowWidgets = getRowsWList(scaleFactor, gridColWidths, bidi);
    Alignment tableAlign = getTableAlignment(tblXml);

    return SizedBox(
      width: availableWidth,
      child: Align(
        alignment: tableAlign,
        child: Padding(
          padding: bidi
              ? EdgeInsets.only(right: tableIndentPx)
              : EdgeInsets.only(left: tableIndentPx),
          child: SizedBox(
            width: finalTableWidth,
            child: Column(mainAxisSize: MainAxisSize.min, children: rowWidgets),
          ),
        ),
      ),
    );
  }



  List<double> _getGridColWidths() {

    var gridCols = tblXml

        .findAllElements('w:tblGrid')

        .firstOrNull

        ?.findAllElements('w:gridCol');

    if (gridCols != null && gridCols.isNotEmpty) {

      return gridCols

          .map((c) => double.tryParse(c.getAttribute('w:w') ?? '0') ?? 0)

          .toList();

    }

    return [];

  }



  int _getGridSpan(XmlElement cell) {

    var gridSpan = cell.getElement('w:tcPr')?.getElement('w:gridSpan');

    return int.tryParse(gridSpan?.getAttribute('w:val') ?? '1') ?? 1;

  }



  /// Gets row height info: (heightTwips, hRule)

  /// hRule: 'exact', 'atLeast', or 'auto'

  (double?, String) _getRowHeightInfo(XmlElement row) {

    var trPr = row.getElement('w:trPr');

    if (trPr == null) return (null, 'auto');



    var trHeight = trPr.getElement('w:trHeight');

    if (trHeight == null) return (null, 'auto');



    String? heightVal = trHeight.getAttribute('w:val');

    // OOXML: if w:hRule is omitted, the row height behaves as auto.
    String hRule = trHeight.getAttribute('w:hRule') ?? 'auto';



    if (heightVal == null) return (null, 'auto');



    return (double.tryParse(heightVal), hRule);

  }



  List<Widget> getRowsWList(

    double scaleFactor,

    List<double> gridColWidths,

    bool bidi,

  ) {

    List<XmlElement> rows = tblXml.childElements

        .where((n) => n.name.local == 'tr')

        .toList();



    List<Widget> rowsW = [];

    int totalRows = rows.length;



    // Compute totalCols from the first row (for conditional formatting)

    int totalCols = 0;

    if (rows.isNotEmpty) {

      for (var cell in rows.first.childElements.where(

        (n) => n.name.local == 'tc',

      )) {

        totalCols += _getGridSpan(cell);

      }

    }

    if (totalCols == 0 && gridColWidths.isNotEmpty) {

      totalCols = gridColWidths.length;

    }



    for (int rowIndex = 0; rowIndex < rows.length; rowIndex++) {

      var row = rows[rowIndex];

      List<XmlElement> rowCells = row.childElements

          .where((n) => n.name.local == 'tc')

          .toList();

      List<Widget> cellsW = [];

      int gridColIndex = 0;



      for (int colIndex = 0; colIndex < rowCells.length; colIndex++) {

        var cell = rowCells[colIndex];

        int span = _getGridSpan(cell);



        // --- vMerge: skip continuation cells ---

        var vMerge = cell.getElement('w:tcPr')?.getElement('w:vMerge');

        if (vMerge != null) {

          String? val = vMerge.getAttribute('w:val');

          if (val != 'restart') {

            // This cell continues a vertical merge — skip rendering,

            // but still advance grid index and add an empty placeholder

            // so column widths remain aligned.

            double cellTwips = _getCellTwips(

              cell,

              gridColIndex,

              span,

              gridColWidths,

            );

            gridColIndex += span;

            cellsW.add(SizedBox(width: cellTwips * scaleFactor));

            continue;

          }

        }



        double cellTwips = _getCellTwips(

          cell,

          gridColIndex,

          span,

          gridColWidths,

        );

        gridColIndex += span;



        double cellWidthPx = cellTwips * scaleFactor;



        cellsW.add(

          getCellWidget(

            cell,

            cellWidthPx,

            rowIndex: rowIndex,

            colIndex: gridColIndex - span, // use grid-based col index

            totalRows: totalRows,

            totalCols: totalCols,

          ),

        );

      }



      // Get row height info

      var (rowHeightTwips, hRule) = _getRowHeightInfo(row);

      double? rowHeightPx = rowHeightTwips != null

          ? rowHeightTwips * 0.0667

          : null;



      Widget rowWidget = IntrinsicHeight(

        child: Row(

          mainAxisSize: MainAxisSize.min,

          textDirection: bidi ? TextDirection.rtl : TextDirection.ltr,

          crossAxisAlignment: CrossAxisAlignment.stretch,

          children: cellsW,

        ),

      );



      if (rowHeightPx != null && rowHeightPx > 0) {

        if (hRule == 'exact') {

          rowsW.add(SizedBox(height: rowHeightPx, child: rowWidget));

        } else if (hRule == 'atLeast') {

          rowsW.add(

            ConstrainedBox(

              constraints: BoxConstraints(minHeight: rowHeightPx),

              child: rowWidget,

            ),

          );

        } else {

          rowsW.add(rowWidget);

        }

      } else {

        rowsW.add(rowWidget);

      }

    }

    return rowsW;

  }



  /// Calculate cell width in twips from tcW or grid columns

  double _getCellTwips(

    XmlElement cell,

    int gridColIndex,

    int span,

    List<double> gridColWidths,

  ) {

    var tcW = cell.getElement('w:tcPr')?.getElement('w:tcW');

    double explicitW =

        double.tryParse(tcW?.getAttribute('w:w') ?? '0') ?? 0;

    String type = tcW?.getAttribute('w:type') ?? 'auto';



    if (explicitW > 0 && type != 'auto') {

      return explicitW;

    }



    if (gridColWidths.isNotEmpty) {

      double total = 0;

      for (int i = 0; i < span; i++) {

        if (gridColIndex + i < gridColWidths.length) {

          total += gridColWidths[gridColIndex + i];

        }

      }

      return total;

    }



    return explicitW;

  }



  Widget getCellWidget(

    XmlElement rowCell,

    double cellWidthPx, {

    int rowIndex = 0,

    int colIndex = 0,

    int totalRows = 1,

    int totalCols = 1,

  }) {

    if (cellWidthPx <= 0) cellWidthPx = 10;



    WordDocument wordDocument = parent.parent;



    // --- Cell Decoration (Borders & Background) ---

    BoxDecoration? decoration = _getCellDecoration(

      rowCell,

      rowIndex: rowIndex,

      colIndex: colIndex,

      totalRows: totalRows,

      totalCols: totalCols,

    );



    // --- Cell Text Direction ---

    String? cellTextDirection = _getCellTextDirection(rowCell);

    bool isVerticalText =

        cellTextDirection != null &&

        (cellTextDirection == 'tbRl' ||

            cellTextDirection == 'tbRlV' ||

            cellTextDirection == 'btLr' ||

            cellTextDirection == 'tbLrV');



    // --- Cell Margins (per Word XML spec §17.4.42, §17.4.68) ---

    EdgeInsets cellMargins = getTableCellMargins(

      cell: rowCell,

      tblXml: tblXml,

      wordDocument: wordDocument,

    );



    // --- Resolve table style rPr for this cell position ---

    XmlElement? tableStyleRPr = getTableStyleRPr(

      tblXml: tblXml,

      wordDocument: wordDocument,

      rowIndex: rowIndex,

      colIndex: colIndex,

      totalRows: totalRows,

      totalCols: totalCols,

    );



    // --- Resolve table style pPr for this cell position ---

    XmlElement? tableStylePPr = getTableStylePPr(

      tblXml: tblXml,

      wordDocument: wordDocument,

      rowIndex: rowIndex,

      colIndex: colIndex,

      totalRows: totalRows,

      totalCols: totalCols,

    );



    final paragraphsXml = TableCellContentResolver.resolveParagraphs(
      rowCell,
      trimTrailingStructuralEmptyParagraph:
          trimTrailingStructuralEmptyCellParagraphs,
    );



    if (paragraphsXml.isEmpty)

      return Container(

        width: cellWidthPx,

        decoration: decoration,

        constraints: BoxConstraints(minHeight: 20),

      );



    List<Widget> pWidgets = [];

    for (var pXml in paragraphsXml) {

      Paragraph paragraph = Paragraph(

        parent,

      ).fromXml(pXml, skipNumberingCounter: true);
      paragraph.disableUrlAutoDetection = disableUrlAutoDetection;
      paragraph.isTableCellParagraph = true;
      paragraph.textBoxFillColor = textBoxFillColor;



      // For table cells with numbering, set paragraphNumber based on row index

      if (paragraph.pPr?.numId != null &&

          paragraph.pPr?.paragraphNumber == null) {

        paragraph.pPr!.paragraphNumber = rowIndex + 1;

      }



      // --- Apply table style rPr as fallback for runs without explicit formatting ---

      // Per Word spec: table style rPr sits between document defaults and paragraph style

      if (tableStyleRPr != null) {

        _applyTableStyleRPrToRuns(paragraph, tableStyleRPr);

      }



      // --- Apply table style pPr (alignment, spacing) as fallback ---

      if (tableStylePPr != null) {

        _applyTableStylePPrToParagraph(paragraph, pXml, tableStylePPr);

      }



      // Reset indentation for table cells — Word applies indentation relative to cell

      if (paragraph.pPr != null) {

        paragraph.pPr!.paddingLeft = 0;

        paragraph.pPr!.paddingRight = 0;



        // If paragraph has no explicit spacing AND no table style spacing,

        // use 0 (Word's default for table cells without explicit spacing)

        bool hasExplicitSpacing =

            pXml.getElement('w:pPr')?.getElement('w:spacing') != null;

        bool hasStyleSpacing =

            tableStylePPr?.getElement('w:spacing') != null;

        if (!hasExplicitSpacing && !hasStyleSpacing) {

          paragraph.pPr!.spacingBefore = 0;

          paragraph.pPr!.spacingAfter = 0;

        }

      }



      // Remove trailing breaks that cause double height in Flutter

      if (paragraph.runs.isNotEmpty) {

        for (int i = paragraph.runs.length - 1; i >= 0; i--) {

          var run = paragraph.runs[i];

          String txt = run.text ?? "";

          double size = run.rpr?.fontSize ?? 20.0;

          bool isTiny = size <= 4.0;



          if (txt.trim().isEmpty || isTiny) {

            run.hasBrAfter = false;

            run.hasBrBefore = false;

          } else {

            run.hasBrAfter = false;

            break;

          }

        }

      }



      pWidgets.add(paragraph.toWidget());

    }



    Widget cellContent = Column(

      mainAxisSize: MainAxisSize.min,

      crossAxisAlignment: CrossAxisAlignment.stretch,

      children: pWidgets,

    );



    // Apply rotation for vertical text direction

    if (isVerticalText) {

      int quarterTurns =

          (cellTextDirection == 'btLr' || cellTextDirection == 'tbLrV')

          ? 3

          : 1;

      cellContent = RotatedBox(quarterTurns: quarterTurns, child: cellContent);

    }



    // --- Cell Vertical Alignment (vAlign) ---

    Alignment verticalAlign = _getCellVerticalAlignment(rowCell);



    return Container(

      width: cellWidthPx,

      decoration: decoration,

      padding: cellMargins,

      child: Align(alignment: verticalAlign, child: cellContent),

    );

  }



  /// Apply table style rPr to all runs in a paragraph as a fallback layer.

  /// Only sets properties that are not already explicitly set on the run.

  void _applyTableStyleRPrToRuns(

    Paragraph paragraph,

    XmlElement tableStyleRPr,

  ) {

    // Parse the table style rPr once

    RPr styleRPr = RPr(paragraph.runs.isNotEmpty

            ? paragraph.runs.first

            : paragraph.pPr?.getEmptyRun() ?? paragraph.runs.first)

        .fromXml(tableStyleRPr);



    for (var run in paragraph.runs) {

      if (run.rpr == null) continue;

      // Only fill in properties that the run doesn't already have

      run.rpr!.b ??= styleRPr.b;

      run.rpr!.i ??= styleRPr.i;

      run.rpr!.fontSize ??= styleRPr.fontSize;

      run.rpr!.font ??= styleRPr.font;

      run.rpr!.enFont ??= styleRPr.enFont;

      run.rpr!.color ??= styleRPr.color;

      run.rpr!.strike ??= styleRPr.strike;

      run.rpr!.u ??= styleRPr.u;

    }



    // Also apply to paragraph's prPr (the paragraph-level default run props)

    if (paragraph.prPr != null) {

      paragraph.prPr!.b ??= styleRPr.b;

      paragraph.prPr!.i ??= styleRPr.i;

      paragraph.prPr!.fontSize ??= styleRPr.fontSize;

      paragraph.prPr!.font ??= styleRPr.font;

      paragraph.prPr!.enFont ??= styleRPr.enFont;

      paragraph.prPr!.color ??= styleRPr.color;

    }

  }



  /// Apply table style pPr to a paragraph as a fallback layer.

  /// Respects the paragraph's own explicit properties.

  void _applyTableStylePPrToParagraph(

    Paragraph paragraph,

    XmlElement pXml,

    XmlElement tableStylePPr,

  ) {

    if (paragraph.pPr == null) return;



    // Alignment: only apply if paragraph has no explicit jc

    if (pXml.getElement('w:pPr')?.getElement('w:jc') == null) {

      String? jcVal = tableStylePPr.getElement('w:jc')?.getAttribute('w:val');

      if (jcVal != null) {

        paragraph.textAlign = _parseTextAlign(jcVal);

      }

    }

  }



  TextAlign _parseTextAlign(String jcVal) {

    switch (jcVal) {

      case 'center':

        return TextAlign.center;

      case 'right':

      case 'end':

        return TextAlign.right;

      case 'left':

      case 'start':

        return TextAlign.left;

      case 'both':

      case 'distribute':

      case 'lowKashida':

      case 'mediumKashida':

      case 'highKashida':

      case 'thaiDistribute':

        return TextAlign.justify;

      default:

        return TextAlign.start;

    }

  }



  /// Get cell text direction from tcPr/textDirection

  String? _getCellTextDirection(XmlElement cell) {

    var tcPr = cell.getElement('w:tcPr');

    var textDir = tcPr?.getElement('w:textDirection');

    return textDir?.getAttribute('w:val');

  }



  /// Returns Alignment for use in Align widget

  Alignment _getCellVerticalAlignment(XmlElement cell) {

    var tcPr = cell.getElement('w:tcPr');

    var vAlign = tcPr?.getElement('w:vAlign')?.getAttribute('w:val');



    switch (vAlign) {

      case 'top':

        return Alignment.topCenter;

      case 'center':

        return Alignment.center;

      case 'bottom':

        return Alignment.bottomCenter;

      default:

        return Alignment.topCenter; // Default to top

    }

  }



  // --- Helper Methods for Cell Decoration ---



  /// Creates BoxDecoration with borders and background color from XML

  BoxDecoration? _getCellDecoration(

    XmlElement cell, {

    int rowIndex = 0,

    int colIndex = 0,

    int totalRows = 1,

    int totalCols = 1,

  }) {

    Color? bgColor = _getCellColor(

      cell,

      rowIndex: rowIndex,

      colIndex: colIndex,

      totalRows: totalRows,

      totalCols: totalCols,

    );

    Border? border = _getCellBorder(

      cell,

      rowIndex: rowIndex,

      colIndex: colIndex,

      totalRows: totalRows,

      totalCols: totalCols,

    );



    if (bgColor == null && border == null) return null;



    return BoxDecoration(color: bgColor, border: border);

  }



  /// Parses w:shd to get cell background color.

  /// Priority: 1) Direct cell shd → 2) Table style conditional tcPr (via tblLook-aware helper)

  Color? _getCellColor(

    XmlElement cell, {

    int rowIndex = 0,

    int colIndex = 0,

    int totalRows = 1,

    int totalCols = 1,

  }) {

    final themeColors = parent.parent.themeColors;



    // Priority 1: Direct cell shading

    var tcPr = cell.getElement('w:tcPr');

    var shd = tcPr?.getElement('w:shd');

    if (shd != null) {

      Color? direct = _parseShdColor(shd, themeColors);

      if (direct != null) return direct;

    }



    // Priority 2: Table style conditional tcPr shading (tblLook-aware)

    XmlElement? styleTcPr = getTableStyleTcPr(

      tblXml: tblXml,

      wordDocument: parent.parent,

      rowIndex: rowIndex,

      colIndex: colIndex,

      totalRows: totalRows,

      totalCols: totalCols,

    );

    if (styleTcPr != null) {

      var styleShd = styleTcPr.getElement('w:shd');

      if (styleShd != null) {

        return _parseShdColor(styleShd, themeColors);

      }

    }



    return null;

  }



  /// Parse a w:shd element into a Color, handling theme colors

  Color? _parseShdColor(XmlElement shd, Map<String, String> themeColors) {

    String? themeFill = shd.getAttribute('w:themeFill');

    if (themeFill != null) {

      String? resolved = resolveThemeColor(

        themeColors,

        themeFill,

        shd.getAttribute('w:themeFillTint'),

        shd.getAttribute('w:themeFillShade'),

      );

      if (resolved != null) return _parseHexColor(resolved);

    }



    String? fill = shd.getAttribute('w:fill');

    if (fill != null && fill != "auto" && fill.toLowerCase() != "ffffff") {

      return _parseHexColor(fill);

    }

    return null;

  }



  /// Parses hex color string

  Color? _parseHexColor(String hex) {

    if (hex == "auto" || hex.toLowerCase() == "none") return null;

    try {

      hex = hex.replaceAll("#", "");

      if (hex.length == 6) {

        return Color(int.parse("0xFF$hex"));

      }

    } catch (e) {

      // ignore

    }

    return null;

  }



  /// Parses cell borders from tcBorders, tblBorders, or table style

  Border? _getCellBorder(

    XmlElement cell, {

    int rowIndex = 0,

    int colIndex = 0,

    int totalRows = 1,

    int totalCols = 1,

  }) {

    var tcPr = cell.getElement('w:tcPr');

    var tcBorders = tcPr?.getElement('w:tcBorders');



    // Check table-level borders as fallback

    var tblPr = tblXml.getElement('w:tblPr');

    var tblBorders = tblPr?.getElement('w:tblBorders');



    // Priority 3: Get borders from table style (tblLook-aware conditional tcPr)

    XmlElement? styleBorders;

    XmlElement? styleTcPr = getTableStyleTcPr(

      tblXml: tblXml,

      wordDocument: parent.parent,

      rowIndex: rowIndex,

      colIndex: colIndex,

      totalRows: totalRows,

      totalCols: totalCols,

    );

    if (styleTcPr != null) {

      styleBorders = styleTcPr.getElement('w:tcBorders');

    }

    // Fallback to table-level style borders if no conditional borders

    if (styleBorders == null && tblBorders == null) {

      var tblStyleId = tblPr?.getElement('w:tblStyle')?.getAttribute('w:val');

      if (tblStyleId != null) {

        styleBorders = getTableStyleBorders(tblStyleId, parent.parent);

      }

    }



    BorderSide? getSide(String sideName) {

      XmlElement? borderEl;



      // Priority 1: Cell-level border

      if (tcBorders != null) {

        borderEl = tcBorders.getElement('w:$sideName');

      }



      // Priority 2: Table-level border (direct in document.xml)

      if (borderEl == null && tblBorders != null) {

        if (sideName == 'top') {

          borderEl = tblBorders.getElement('w:top');

        } else if (sideName == 'bottom') {

          borderEl = tblBorders.getElement('w:bottom');

          // OOXML §17.4.22: insideH applies only to interior horizontal edges,
          // not the outer top/bottom edges of the table. Render it once on the
          // lower edge of each non-last row to avoid creating a false top border
          // and to prevent double-thick lines between adjacent rows.
          if (borderEl == null && rowIndex < totalRows - 1) {

            borderEl = tblBorders.getElement('w:insideH');

          }

        } else {

          borderEl =

              tblBorders.getElement('w:insideV') ??

              tblBorders.getElement('w:$sideName');

        }

      }



      // Priority 3: Table style borders (from styles.xml)

      if (borderEl == null && styleBorders != null) {

        if (sideName == 'top') {

          borderEl = styleBorders.getElement('w:top');

        } else if (sideName == 'bottom') {

          borderEl = styleBorders.getElement('w:bottom');

          if (borderEl == null && rowIndex < totalRows - 1) {

            borderEl = styleBorders.getElement('w:insideH');

          }

        } else {

          borderEl =

              styleBorders.getElement('w:insideV') ??

              styleBorders.getElement('w:$sideName');

        }

      }



      if (borderEl == null) return null;



      String val = borderEl.getAttribute('w:val') ?? 'none';

      if (val == 'none' || val == 'nil') return null;



      // Parse color

      String? colorHex = borderEl.getAttribute('w:color');

      String? themeColor = borderEl.getAttribute('w:themeColor');

      Color color = Colors.black;

      if (themeColor != null) {

        String? resolved = resolveThemeColor(

          parent.parent.themeColors,

          themeColor,

          borderEl.getAttribute('w:themeTint'),

          borderEl.getAttribute('w:themeShade'),

        );

        color = _parseHexColor(resolved ?? "") ?? Colors.black;

      } else if (colorHex != null && colorHex != "auto") {

        color = _parseHexColor(colorHex) ?? Colors.black;

      }



      // Parse width (w:sz is in 1/8 points)

      String? sz = borderEl.getAttribute('w:sz');

      double width = 0.5; // Thin default

      if (sz != null) {

        double? eighthPts = double.tryParse(sz);

        if (eighthPts != null) {

          // 1/8 point -> pixels: (sz/8) * 1.33

          width = (eighthPts / 8.0) * 1.33;

          if (width < 0.5) width = 0.5;

          if (width > 3.0) width = 3.0; // Cap to prevent oversized borders

        }

      }



      return BorderSide(color: color, width: width);

    }



    BorderSide top = getSide('top') ?? BorderSide.none;

    BorderSide bottom = getSide('bottom') ?? BorderSide.none;

    BorderSide left = getSide('left') ?? BorderSide.none;

    BorderSide right = getSide('right') ?? BorderSide.none;



    // If all sides are none, return null (no border)

    if (top == BorderSide.none &&

        bottom == BorderSide.none &&

        left == BorderSide.none &&

        right == BorderSide.none) {

      return null;

    }



    return Border(top: top, bottom: bottom, left: left, right: right);

  }

}

