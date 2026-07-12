import 'package:golden_shamela/Models/VmlShapeData.dart';
import 'package:golden_shamela/Utils/VmlColorResolver.dart';
import 'package:golden_shamela/Utils/VmlEffectsParser.dart';
import 'package:golden_shamela/Utils/VmlShapeTypeResolver.dart';
import 'package:xml/xml.dart' as xml;

typedef VmlUnitParser = double Function(String value);

/// Builds the semantic render data for a single VML shape.
///
/// Keep this parser XML-driven: it reads shape type, inherited shapetype
/// defaults, stroke/fill, shadow, and arc settings from the VML elements.
/// Do not add screen-position heuristics here; group placement and page layout
/// belong to the caller that understands the surrounding paragraph/page.
class VmlShapeDataParser {
  const VmlShapeDataParser._();

  static VmlShapeData buildForShape({
    required xml.XmlElement shape,
    required VmlUnitParser parseUnit,
    dynamic wordDocument,
  }) {
    final shapeTypeElement = resolveReferencedShapeTypeElement(shape);
    final vmlShapeData = VmlShapeData(
      shapeType: VmlShapeTypeResolver.resolve(shape),
      arcSize:
          double.tryParse(
            shape.getAttribute('arcsize')?.replaceAll('f', '') ?? '0.2',
          ) ??
          0.2,
    );

    _applyArcSize(shape, vmlShapeData);
    _applyStroke(shape, vmlShapeData, parseUnit, wordDocument);
    _applyFillAndShadow(shape, vmlShapeData, wordDocument);
    _applyShapeTypeDefaults(shape, shapeTypeElement, vmlShapeData);

    return vmlShapeData;
  }

  static xml.XmlElement? resolveReferencedShapeTypeElement(
    xml.XmlElement shape,
  ) {
    final typeRef = shape.getAttribute('type')?.trim();
    if (typeRef == null || typeRef.isEmpty) return null;

    final normalizedId =
        typeRef.startsWith('#') ? typeRef.substring(1) : typeRef;
    final pict = shape.parentElement;
    final localShapeTypeElement = pict?.childElements.firstWhere(
      (e) =>
          e.name.local.toLowerCase() == 'shapetype' &&
          e.getAttribute('id') == normalizedId,
      orElse: () => xml.XmlElement(xml.XmlName('null')),
    );
    if (localShapeTypeElement != null &&
        localShapeTypeElement.name.local != 'null') {
      return localShapeTypeElement;
    }

    // Word may place a reusable v:shapetype earlier in the same story rather
    // than beside the v:shape that references it. Search the story root before
    // falling back to local-name based shape classification.
    final ancestorElements = shape.ancestors.whereType<xml.XmlElement>().toList();
    if (ancestorElements.isEmpty) return null;
    final storyRoot = ancestorElements.last;

    final shapeTypeElement = storyRoot.descendants
        .whereType<xml.XmlElement>()
        .firstWhere(
          (e) =>
              e.name.local.toLowerCase() == 'shapetype' &&
              e.getAttribute('id') == normalizedId,
          orElse: () => xml.XmlElement(xml.XmlName('null')),
        );

    if (shapeTypeElement.name.local == 'null') return null;
    return shapeTypeElement;
  }

  static void _applyArcSize(
    xml.XmlElement shape,
    VmlShapeData vmlShapeData,
  ) {
    final arcAttr = shape.getAttribute('arcsize') ?? '';
    if (arcAttr.endsWith('f')) {
      final f =
          double.tryParse(arcAttr.substring(0, arcAttr.length - 1)) ?? 13107.0;
      vmlShapeData.arcSize = f / 65536.0;
    } else if (arcAttr.endsWith('%')) {
      final p =
          double.tryParse(arcAttr.substring(0, arcAttr.length - 1)) ?? 20.0;
      vmlShapeData.arcSize = p / 100.0;
    }
  }

  static void _applyStroke(
    xml.XmlElement shape,
    VmlShapeData vmlShapeData,
    VmlUnitParser parseUnit,
    dynamic wordDocument,
  ) {
    final strokeColor = parseVmlColorValue(
      shape.getAttribute('strokecolor') ?? '',
      wordDocument: wordDocument,
    );
    if (strokeColor != null) {
      vmlShapeData.strokeColor = strokeColor;
    }
    vmlShapeData.strokeWidth =
        parseUnit(shape.getAttribute('strokeweight') ?? '1.0');

    final strokeElement = shape.childElements.firstWhere(
      (e) => e.name.local == 'stroke',
      orElse: () => xml.XmlElement(xml.XmlName('null')),
    );
    if (strokeElement.name.local != 'null') {
      vmlShapeData.strokeDashStyle = strokeElement.getAttribute('dashstyle');
      vmlShapeData.strokeEndCap = strokeElement.getAttribute('endcap');
    }
  }

  static void _applyFillAndShadow(
    xml.XmlElement shape,
    VmlShapeData vmlShapeData,
    dynamic wordDocument,
  ) {
    final fillColor = parseVmlColorValue(
      shape.getAttribute('fillcolor') ?? '',
      wordDocument: wordDocument,
    );
    if (fillColor != null) {
      vmlShapeData.fillColor = fillColor;
    }
    vmlShapeData.fillStyle = VmlEffectsParser.parseFill(
      shape,
      fallbackColor: fillColor,
    );
    vmlShapeData.shadowStyle = VmlEffectsParser.parseShadow(shape);
  }

  static void _applyShapeTypeDefaults(
    xml.XmlElement shape,
    xml.XmlElement? shapeTypeElement,
    VmlShapeData vmlShapeData,
  ) {
    final filledAttr =
        shape.getAttribute('filled')?.trim().toLowerCase() ??
        shapeTypeElement?.getAttribute('filled')?.trim().toLowerCase();
    if (filledAttr == 'f' || filledAttr == 'false') {
      vmlShapeData.isFilled = false;
    }

    final strokedAttr =
        shape.getAttribute('stroked')?.trim().toLowerCase() ??
        shapeTypeElement?.getAttribute('stroked')?.trim().toLowerCase();
    if (strokedAttr == 'f' || strokedAttr == 'false') {
      vmlShapeData.isStroked = false;
    }
  }
}
