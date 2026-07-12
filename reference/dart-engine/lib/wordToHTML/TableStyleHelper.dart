import 'package:flutter/material.dart';
import 'package:golden_shamela/Models/WordDocument.dart';
import 'package:golden_shamela/wordToHTML/DocumentStyles.dart';
import 'package:golden_shamela/wordToHTML/RPr.dart';
import 'package:xml/xml.dart';

/// Parses w:tblLook from w:tblPr to determine which conditional
/// formatting features from the table style are enabled.
class TableLook {
  final bool firstRow;
  final bool lastRow;
  final bool firstColumn;
  final bool lastColumn;
  final bool noHBand;
  final bool noVBand;

  const TableLook({
    this.firstRow = false,
    this.lastRow = false,
    this.firstColumn = false,
    this.lastColumn = false,
    this.noHBand = false,
    this.noVBand = false,
  });

  factory TableLook.fromXml(XmlElement? tblLook) {
    if (tblLook == null) return const TableLook();

    // tblLook can use named attributes (OOXML 2012+) or w:val bitmask (legacy)
    String? val = tblLook.getAttribute('w:val');

    if (tblLook.getAttribute('w:firstRow') != null) {
      // Named attributes style
      return TableLook(
        firstRow: _boolAttr(tblLook, 'w:firstRow'),
        lastRow: _boolAttr(tblLook, 'w:lastRow'),
        firstColumn: _boolAttr(tblLook, 'w:firstColumn'),
        lastColumn: _boolAttr(tblLook, 'w:lastColumn'),
        noHBand: _boolAttr(tblLook, 'w:noHBand'),
        noVBand: _boolAttr(tblLook, 'w:noVBand'),
      );
    } else if (val != null && val.length >= 4) {
      // Legacy bitmask: val is a hex string like "04A0"
      int bitmask = int.tryParse(val, radix: 16) ?? 0;
      return TableLook(
        firstRow: (bitmask & 0x0020) != 0,
        lastRow: (bitmask & 0x0040) != 0,
        firstColumn: (bitmask & 0x0080) != 0,
        lastColumn: (bitmask & 0x0100) != 0,
        noHBand: (bitmask & 0x0200) != 0,
        noVBand: (bitmask & 0x0400) != 0,
      );
    }

    return const TableLook();
  }

  static bool _boolAttr(XmlElement el, String attr) {
    String? v = el.getAttribute(attr);
    return v == '1' || v == 'true';
  }
}

/// Resolves the effective rPr (XmlElement) from a table style for a
/// given cell position, respecting tblLook and the conditional
/// formatting priority defined in the ECMA-376 spec §17.7.6.
///
/// Priority (highest to lowest):
///   Intersection (e.g. firstRowFirstCol) > Row condition > Column condition > Band > Whole table
XmlElement? getTableStyleRPr({
  required XmlElement tblXml,
  required WordDocument wordDocument,
  required int rowIndex,
  required int colIndex,
  required int totalRows,
  required int totalCols,
}) {
  String? styleId = tblXml
      .getElement('w:tblPr')
      ?.getElement('w:tblStyle')
      ?.getAttribute('w:val');
  if (styleId == null) return null;

  XmlElement? style = getDocumentStyle(styleId, wordDocument);
  if (style == null) return null;

  TableLook look = TableLook.fromXml(
    tblXml.getElement('w:tblPr')?.getElement('w:tblLook'),
  );

  // Build list of matching condition types in priority order (highest first)
  // Per spec: intersection > row > col > band > whole table
  List<String> conditions = [];

  // Intersection conditions (highest priority)
  if (look.firstRow && rowIndex == 0 && look.firstColumn && colIndex == 0) {
    conditions.add('firstRowFirstCol');
  }
  if (look.firstRow &&
      rowIndex == 0 &&
      look.lastColumn &&
      colIndex == totalCols - 1) {
    conditions.add('firstRowLastCol');
  }
  if (look.lastRow &&
      rowIndex == totalRows - 1 &&
      look.firstColumn &&
      colIndex == 0) {
    conditions.add('lastRowFirstCol');
  }
  if (look.lastRow &&
      rowIndex == totalRows - 1 &&
      look.lastColumn &&
      colIndex == totalCols - 1) {
    conditions.add('lastRowLastCol');
  }

  // Row conditions
  if (look.firstRow && rowIndex == 0) conditions.add('firstRow');
  if (look.lastRow && rowIndex == totalRows - 1) conditions.add('lastRow');

  // Column conditions
  if (look.firstColumn && colIndex == 0) conditions.add('firstCol');
  if (look.lastColumn && colIndex == totalCols - 1) conditions.add('lastCol');

  // Band conditions
  if (!look.noHBand) {
    int bandSize = _getRowBandSize(style);
    int effectiveRow = rowIndex;
    // Skip header row from band calculation if firstRow is enabled
    if (look.firstRow) effectiveRow = rowIndex - 1;
    if (effectiveRow >= 0) {
      if ((effectiveRow ~/ bandSize) % 2 == 0) {
        conditions.add('band1Horz');
      } else {
        conditions.add('band2Horz');
      }
    }
  }
  if (!look.noVBand) {
    int bandSize = _getColBandSize(style);
    int effectiveCol = colIndex;
    if (look.firstColumn) effectiveCol = colIndex - 1;
    if (effectiveCol >= 0) {
      if ((effectiveCol ~/ bandSize) % 2 == 0) {
        conditions.add('band1Vert');
      } else {
        conditions.add('band2Vert');
      }
    }
  }

  // Merge: start from whole-table rPr, then layer conditions (lowest to highest)
  // Whole table rPr is the base
  XmlElement? result = style.getElement('w:rPr');

  // Apply conditions in REVERSE order (lowest priority first, so higher overwrites)
  for (int i = conditions.length - 1; i >= 0; i--) {
    XmlElement? condRPr = _getConditionRPr(style, conditions[i]);
    if (condRPr != null) {
      result = mergeRPr(condRPr, result);
    }
  }

  return result;
}

/// Resolves the effective pPr (XmlElement) from a table style for a
/// given cell position, respecting tblLook. Same priority as rPr.
XmlElement? getTableStylePPr({
  required XmlElement tblXml,
  required WordDocument wordDocument,
  required int rowIndex,
  required int colIndex,
  required int totalRows,
  required int totalCols,
}) {
  String? styleId = tblXml
      .getElement('w:tblPr')
      ?.getElement('w:tblStyle')
      ?.getAttribute('w:val');
  if (styleId == null) return null;

  XmlElement? style = getDocumentStyle(styleId, wordDocument);
  if (style == null) return null;

  TableLook look = TableLook.fromXml(
    tblXml.getElement('w:tblPr')?.getElement('w:tblLook'),
  );

  List<String> conditions = _getConditions(
    look,
    rowIndex,
    colIndex,
    totalRows,
    totalCols,
    style,
  );

  XmlElement? result = style.getElement('w:pPr');

  for (int i = conditions.length - 1; i >= 0; i--) {
    XmlElement? condPPr = _getConditionPPr(style, conditions[i]);
    if (condPPr != null) {
      result = mergeProperties(condPPr, result);
    }
  }

  return result;
}

/// Resolves the effective tcPr (XmlElement) from a table style for a
/// given cell position, respecting tblLook. Same priority as rPr.
XmlElement? getTableStyleTcPr({
  required XmlElement tblXml,
  required WordDocument wordDocument,
  required int rowIndex,
  required int colIndex,
  required int totalRows,
  required int totalCols,
}) {
  String? styleId = tblXml
      .getElement('w:tblPr')
      ?.getElement('w:tblStyle')
      ?.getAttribute('w:val');
  if (styleId == null) return null;

  XmlElement? style = getDocumentStyle(styleId, wordDocument);
  if (style == null) return null;

  TableLook look = TableLook.fromXml(
    tblXml.getElement('w:tblPr')?.getElement('w:tblLook'),
  );

  List<String> conditions = _getConditions(
    look,
    rowIndex,
    colIndex,
    totalRows,
    totalCols,
    style,
  );

  // Whole table tcPr is the base
  XmlElement? result = style.getElement('w:tcPr');

  for (int i = conditions.length - 1; i >= 0; i--) {
    XmlElement? condTcPr = _getConditionTcPr(style, conditions[i]);
    if (condTcPr != null) {
      result = mergeProperties(condTcPr, result);
    }
  }

  return result;
}

/// Shared conditions builder
List<String> _getConditions(
  TableLook look,
  int rowIndex,
  int colIndex,
  int totalRows,
  int totalCols,
  XmlElement style,
) {
  List<String> conditions = [];

  if (look.firstRow && rowIndex == 0 && look.firstColumn && colIndex == 0) {
    conditions.add('firstRowFirstCol');
  }
  if (look.firstRow &&
      rowIndex == 0 &&
      look.lastColumn &&
      colIndex == totalCols - 1) {
    conditions.add('firstRowLastCol');
  }
  if (look.lastRow &&
      rowIndex == totalRows - 1 &&
      look.firstColumn &&
      colIndex == 0) {
    conditions.add('lastRowFirstCol');
  }
  if (look.lastRow &&
      rowIndex == totalRows - 1 &&
      look.lastColumn &&
      colIndex == totalCols - 1) {
    conditions.add('lastRowLastCol');
  }

  if (look.firstRow && rowIndex == 0) conditions.add('firstRow');
  if (look.lastRow && rowIndex == totalRows - 1) conditions.add('lastRow');
  if (look.firstColumn && colIndex == 0) conditions.add('firstCol');
  if (look.lastColumn && colIndex == totalCols - 1) conditions.add('lastCol');

  if (!look.noHBand) {
    int bandSize = _getRowBandSize(style);
    int effectiveRow = rowIndex;
    if (look.firstRow) effectiveRow = rowIndex - 1;
    if (effectiveRow >= 0) {
      conditions.add(
        (effectiveRow ~/ bandSize) % 2 == 0 ? 'band1Horz' : 'band2Horz',
      );
    }
  }
  if (!look.noVBand) {
    int bandSize = _getColBandSize(style);
    int effectiveCol = colIndex;
    if (look.firstColumn) effectiveCol = colIndex - 1;
    if (effectiveCol >= 0) {
      conditions.add(
        (effectiveCol ~/ bandSize) % 2 == 0 ? 'band1Vert' : 'band2Vert',
      );
    }
  }

  return conditions;
}

/// Get rPr from a tblStylePr with matching type
XmlElement? _getConditionRPr(XmlElement style, String condType) {
  for (var tblStylePr in style.findAllElements('w:tblStylePr')) {
    if (tblStylePr.getAttribute('w:type') == condType) {
      return tblStylePr.getElement('w:rPr');
    }
  }
  return null;
}

/// Get pPr from a tblStylePr with matching type
XmlElement? _getConditionPPr(XmlElement style, String condType) {
  for (var tblStylePr in style.findAllElements('w:tblStylePr')) {
    if (tblStylePr.getAttribute('w:type') == condType) {
      return tblStylePr.getElement('w:pPr');
    }
  }
  return null;
}

/// Get tcPr from a tblStylePr with matching type
XmlElement? _getConditionTcPr(XmlElement style, String condType) {
  for (var tblStylePr in style.findAllElements('w:tblStylePr')) {
    if (tblStylePr.getAttribute('w:type') == condType) {
      return tblStylePr.getElement('w:tcPr');
    }
  }
  return null;
}

int _getRowBandSize(XmlElement style) {
  String? val = style
      .getElement('w:tblPr')
      ?.getElement('w:tblStyleRowBandSize')
      ?.getAttribute('w:val');
  return int.tryParse(val ?? '1') ?? 1;
}

int _getColBandSize(XmlElement style) {
  String? val = style
      .getElement('w:tblPr')
      ?.getElement('w:tblStyleColBandSize')
      ?.getAttribute('w:val');
  return int.tryParse(val ?? '1') ?? 1;
}

/// Parses cell margins from the table hierarchy.
/// Priority: 1) tcMar (cell-level) → 2) tblCellMar in tblPr (table-level) → 3) tblCellMar from table style
/// Values are in twips (twentieths of a point). Default per Word spec: top/bottom = 0, start/end = 108 twips.
EdgeInsets getTableCellMargins({
  required XmlElement cell,
  required XmlElement tblXml,
  required WordDocument wordDocument,
}) {
  // Priority 1: Cell-level margins (w:tcMar inside w:tcPr)
  XmlElement? tcMar = cell.getElement('w:tcPr')?.getElement('w:tcMar');

  // Priority 2: Table-level margins (w:tblCellMar inside w:tblPr)
  XmlElement? tblCellMar =
      tblXml.getElement('w:tblPr')?.getElement('w:tblCellMar');

  // Priority 3: Table style margins
  XmlElement? styleCellMar;
  String? styleId = tblXml
      .getElement('w:tblPr')
      ?.getElement('w:tblStyle')
      ?.getAttribute('w:val');
  if (styleId != null) {
    XmlElement? style = getDocumentStyle(styleId, wordDocument);
    styleCellMar = style?.getElement('w:tblPr')?.getElement('w:tblCellMar');
  }

  // Resolve each side with fallback chain
  double top = _getMarginSide(tcMar, 'top') ??
      _getMarginSide(tblCellMar, 'top') ??
      _getMarginSide(styleCellMar, 'top') ??
      0; // Word default: 0 twips

  double bottom = _getMarginSide(tcMar, 'bottom') ??
      _getMarginSide(tblCellMar, 'bottom') ??
      _getMarginSide(styleCellMar, 'bottom') ??
      0;

  double start = _getMarginSide(tcMar, 'start') ??
      _getMarginSide(tcMar, 'left') ??
      _getMarginSide(tblCellMar, 'start') ??
      _getMarginSide(tblCellMar, 'left') ??
      _getMarginSide(styleCellMar, 'start') ??
      _getMarginSide(styleCellMar, 'left') ??
      _twipsToPx(108); // Word default: 108 twips (0.075 inches)

  double end = _getMarginSide(tcMar, 'end') ??
      _getMarginSide(tcMar, 'right') ??
      _getMarginSide(tblCellMar, 'end') ??
      _getMarginSide(tblCellMar, 'right') ??
      _getMarginSide(styleCellMar, 'end') ??
      _getMarginSide(styleCellMar, 'right') ??
      _twipsToPx(108);

  return EdgeInsets.fromLTRB(start, top, end, bottom);
}

double? _getMarginSide(XmlElement? marginEl, String side) {
  if (marginEl == null) return null;
  XmlElement? sideEl = marginEl.getElement('w:$side');
  if (sideEl == null) return null;
  String? w = sideEl.getAttribute('w:w');
  if (w == null) return null;
  String type = sideEl.getAttribute('w:type') ?? 'dxa';
  if (type != 'dxa') return null; // Only twips supported for margins
  return _twipsToPx(double.tryParse(w) ?? 0);
}

double _twipsToPx(double twips) {
  return twips * 0.0667;
}

double getTableIndentPx(XmlElement tblXml) {
  final tblPr = tblXml.getElement('w:tblPr');
  if (tblPr == null) return 0;

  final tblInd = tblPr.getElement('w:tblInd');
  if (tblInd == null) return 0;

  final type = tblInd.getAttribute('w:type')?.toLowerCase() ?? 'dxa';
  if (type == 'pct' || type == 'auto' || type == 'nil') {
    return 0;
  }

  if (!_doesTableIndentApply(tblXml)) {
    return 0;
  }

  final widthTwips = double.tryParse(tblInd.getAttribute('w:w') ?? '0') ?? 0;
  if (widthTwips <= 0) return 0;

  return _twipsToPx(widthTwips);
}

bool _doesTableIndentApply(XmlElement tblXml) {
  final jc =
      tblXml.getElement('w:tblPr')?.getElement('w:jc')?.getAttribute('w:val');
  final bidi = isTableBidiVisual(tblXml);

  if (jc == null || jc == 'start') {
    return true;
  }

  if (!bidi) {
    return jc == 'left';
  }

  return jc == 'right';
}

/// Gets the table alignment from w:jc in w:tblPr.
/// Returns Alignment for use in Container.
/// For bidi tables (RTL), 'start' maps to right and 'end' maps to left.
Alignment getTableAlignment(XmlElement tblXml) {
  String? jc =
      tblXml.getElement('w:tblPr')?.getElement('w:jc')?.getAttribute('w:val');
  bool bidi = isTableBidiVisual(tblXml);

  switch (jc) {
    case 'center':
      return Alignment.center;
    case 'start':
      return bidi ? Alignment.centerRight : Alignment.centerLeft;
    case 'end':
      return bidi ? Alignment.centerLeft : Alignment.centerRight;
    case 'left':
      return Alignment.centerLeft;
    case 'right':
      return Alignment.centerRight;
    default:
      // No explicit jc: Word defaults to start alignment
      return bidi ? Alignment.centerRight : Alignment.centerLeft;
  }
}

/// Gets whether the table uses bidiVisual (RTL row direction).
/// If true, the first cell in the row is displayed on the right.
bool isTableBidiVisual(XmlElement tblXml) {
  // Namespace-agnostic lookup: XML may use 'w:tblPr' or just 'tblPr'
  // depending on how the XML was serialized/deserialized
  XmlElement? tblPr = tblXml.getElement('w:tblPr');
  tblPr ??= tblXml.childElements
      .where((e) => e.name.local == 'tblPr')
      .firstOrNull;

  if (tblPr == null) {
    return true; // Default to RTL for Arabic documents
  }

  XmlElement? bidi = tblPr.getElement('w:bidiVisual');
  bidi ??= tblPr.childElements
      .where((e) => e.name.local == 'bidiVisual')
      .firstOrNull;

  if (bidi == null) {
    return false;
  }

  String? val = bidi.getAttribute('w:val') ?? bidi.getAttribute('val');
  bool result = val != '0' && val != 'false';
  return result;
}
