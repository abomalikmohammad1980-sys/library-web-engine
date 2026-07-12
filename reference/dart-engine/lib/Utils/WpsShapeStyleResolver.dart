import 'package:flutter/material.dart';
import 'package:xml/xml.dart' as xml;

class WpsShapeStyleResolution {
  final Color? fillColor;
  final bool? isFilled;
  final Color? strokeColor;
  final bool? isStroked;
  final double? strokeWidth;

  const WpsShapeStyleResolution({
    this.fillColor,
    this.isFilled,
    this.strokeColor,
    this.isStroked,
    this.strokeWidth,
  });
}

class WpsShapeStyleResolver {
  static WpsShapeStyleResolution resolve(xml.XmlElement wspElement) {
    final spPr = wspElement.findElements('wps:spPr').firstOrNull;
    if (spPr == null) return const WpsShapeStyleResolution();

    final fallbackVmlShape = _findFallbackVmlShape(wspElement);

    Color? fillColor;
    bool? isFilled;
    Color? strokeColor;
    bool? isStroked;
    double? strokeWidth;

    final solidFill = _firstDirectChild(spPr, 'solidFill', 'a');
    final noFill = _firstDirectChild(spPr, 'noFill', 'a') != null;
    if (solidFill != null) {
      fillColor = _parseDrawingColor(solidFill);
      isFilled = true;
    } else if (noFill) {
      isFilled = false;
    } else if (_vmlFlagIsFalse(fallbackVmlShape, 'filled')) {
      isFilled = false;
    }

    final line = _firstDirectChild(spPr, 'ln', 'a');
    if (line != null) {
      final lineNoFill = _firstDirectChild(line, 'noFill', 'a') != null;
      if (lineNoFill) {
        isStroked = false;
      } else {
        final lineFill = _firstDirectChild(line, 'solidFill', 'a');
        if (lineFill != null) {
          strokeColor = _parseDrawingColor(lineFill);
          isStroked = true;
        }
        final widthAttr = line.getAttribute('w');
        if (widthAttr != null) {
          final widthEmu = double.tryParse(widthAttr) ?? 0;
          if (widthEmu > 0) {
            strokeWidth = widthEmu / 9525.0;
          }
        }
      }
    } else if (_vmlFlagIsFalse(fallbackVmlShape, 'stroked')) {
      isStroked = false;
    }

    return WpsShapeStyleResolution(
      fillColor: fillColor,
      isFilled: isFilled,
      strokeColor: strokeColor,
      isStroked: isStroked,
      strokeWidth: strokeWidth,
    );
  }

  static xml.XmlElement? _findFallbackVmlShape(xml.XmlElement wspElement) {
    // In WordprocessingML, DrawingML wordprocessing shapes are carried inside
    // mc:AlternateContent where the Choice contains `wsp` and the Fallback
    // contains the VML `pict` equivalent of the same shape. When the DrawingML
    // branch omits an explicit line/fill flag, the paired VML fallback is the
    // closest markup-backed source of the same shape semantics.
    final alternateContent = wspElement.ancestors.whereType<xml.XmlElement>()
        .firstWhere(
          (element) => element.name.local == 'AlternateContent',
          orElse: () => xml.XmlElement(xml.XmlName('null')),
        );
    if (alternateContent.name.local == 'null') return null;

    final fallback = alternateContent.childElements.firstWhere(
      (element) => element.name.local == 'Fallback',
      orElse: () => xml.XmlElement(xml.XmlName('null')),
    );
    if (fallback.name.local == 'null') return null;

    const vmlShapeNames = {
      'shape',
      'rect',
      'roundrect',
      'oval',
      'line',
      'polyline',
      'curve',
      'arc',
      'image',
    };

    final shape = fallback.descendants.whereType<xml.XmlElement>().firstWhere(
      (element) => vmlShapeNames.contains(element.name.local),
      orElse: () => xml.XmlElement(xml.XmlName('null')),
    );

    return shape.name.local == 'null' ? null : shape;
  }

  static bool _vmlFlagIsFalse(xml.XmlElement? vmlShape, String attribute) {
    final value = vmlShape?.getAttribute(attribute)?.trim().toLowerCase();
    return value == 'f' || value == 'false';
  }

  static xml.XmlElement? _firstDirectChild(
    xml.XmlElement parent,
    String localName,
    String? prefix,
  ) {
    for (final child in parent.childElements) {
      if (child.name.local == localName &&
          (prefix == null || child.name.prefix == prefix)) {
        return child;
      }
    }
    return null;
  }

  static Color? _parseDrawingColor(xml.XmlElement solidFill) {
    final srgbClr = solidFill.findElements('a:srgbClr').firstOrNull;
    if (srgbClr != null) {
      final val = srgbClr.getAttribute('val');
      if (val != null && val.length == 6) {
        try {
          return Color(int.parse('FF$val', radix: 16));
        } catch (_) {}
      }
    }

    final schemeClr = solidFill.findElements('a:schemeClr').firstOrNull;
    final schemeVal = schemeClr?.getAttribute('val');
    if (schemeVal == 'bg1' || schemeVal == 'lt1') {
      return Colors.white;
    }
    if (schemeVal == 'tx1' || schemeVal == 'dk1') {
      return Colors.black;
    }

    return null;
  }
}
