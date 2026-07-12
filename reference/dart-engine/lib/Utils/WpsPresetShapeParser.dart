import 'package:golden_shamela/Models/VmlShapeData.dart';
import 'package:golden_shamela/Utils/WpsShapeStyleResolver.dart';
import 'package:xml/xml.dart' as xml;

/// يحول subset محافظ من wps:wsp + a:prstGeom إلى VmlShapeData قابلة للرسم.
/// هذا مخصص للأشكال DrawingML preset التي لا تحمل blip image data.
class WpsPresetShapeParser {
  static VmlShapeData? tryParse(xml.XmlElement wspElement) {
    final spPr = wspElement.findAllElements('wps:spPr').firstOrNull;
    if (spPr == null) return null;

    final prstGeom = spPr.findAllElements('a:prstGeom').firstOrNull;
    final prst = prstGeom?.getAttribute('prst')?.trim();
    if (prst == null || prst.isEmpty) return null;

    final shapeType = _mapPresetShapeType(prst);
    if (shapeType == null) return null;

    final shape = VmlShapeData(shapeType: shapeType);
    final style = WpsShapeStyleResolver.resolve(wspElement);
    if (style.fillColor != null) {
      shape.fillColor = style.fillColor;
    }
    if (style.isFilled == false) {
      shape.isFilled = false;
    }
    if (style.strokeColor != null) {
      shape.strokeColor = style.strokeColor;
    }
    if (style.isStroked == false) {
      shape.isStroked = false;
    }
    if (style.strokeWidth != null && style.strokeWidth! > 0) {
      shape.strokeWidth = style.strokeWidth!;
    }

    return shape;
  }

  static String? _mapPresetShapeType(String prst) {
    switch (prst) {
      case 'rect':
        return 'rect';
      case 'roundRect':
        return 'roundrect';
      case 'diamond':
        return 'diamond';
      case 'bracketPair':
        return 'bracketPair';
      case 'ellipse':
        return 'oval';
      // Line/connector shapes used in headers/footers for decorative rules
      case 'straightConnector1':
        return 'line';
    }
    return null;
  }
}
