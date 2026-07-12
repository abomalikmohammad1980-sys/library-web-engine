import 'package:xml/xml.dart' as xml;

class VmlShapeTypeResolver {
  const VmlShapeTypeResolver._();

  static String resolve(xml.XmlElement shape) {
    final localName = shape.name.local.toLowerCase();
    if (localName != 'shape') {
      return localName;
    }

    final typeRef = shape.getAttribute('type')?.trim();
    if (typeRef == null || typeRef.isEmpty) {
      return localName;
    }

    final normalizedId = typeRef.startsWith('#') ? typeRef.substring(1) : typeRef;
    final pict = shape.parentElement;
    final shapeTypeElement = pict?.childElements.firstWhere(
      (e) => e.name.local.toLowerCase() == 'shapetype' && e.getAttribute('id') == normalizedId,
      orElse: () => xml.XmlElement(xml.XmlName('null')),
    );

    if (shapeTypeElement == null || shapeTypeElement.name.local == 'null') {
      return _fallbackShapeType(shape, localName);
    }

    // Word VML can serialize this as o:spt="75". In some documents the
    // namespace-qualified lookup misses it even though the attribute exists,
    // so we intentionally match by local name to keep classification tied to
    // the actual XML rather than later rendering heuristics.
    final officeShapeType =
        _getAttributeByLocalName(shapeTypeElement, 'spt')?.trim();

    switch (officeShapeType) {
      case '110':
        return 'diamond';
      case '202':
        return 'textbox';
      case '75':
        return 'picture';
      case '20': // straight connector
      case '32': // straight line
        return 'line';
      default:
        return _fallbackShapeType(shape, localName);
    }
  }

  static String? _getAttributeByLocalName(
    xml.XmlElement element,
    String localName,
  ) {
    for (final attribute in element.attributes) {
      if (attribute.name.local.toLowerCase() == localName.toLowerCase()) {
        return attribute.value;
      }
    }
    return null;
  }

  static String _fallbackShapeType(xml.XmlElement shape, String localName) {
    final hasImageData = shape.descendants.whereType<xml.XmlElement>().any(
      (element) => element.name.local.toLowerCase() == 'imagedata',
    );
    if (hasImageData) {
      return 'picture';
    }
    return localName;
  }
}
