import 'package:xml/xml.dart';

class HyperlinkDisplayContextResolver {
  const HyperlinkDisplayContextResolver._();

  static bool detectFromFieldInstructions({
    required String? hyperlinkAnchor,
    required Iterable<String> fieldInstructions,
  }) {
    if (hyperlinkAnchor == null || hyperlinkAnchor.isEmpty) return false;

    for (final instruction in fieldInstructions) {
      if (instruction.trim().toUpperCase().contains('PAGEREF')) {
        return true;
      }
    }

    return false;
  }

  static bool detectFromXmlString({
    required String? hyperlinkAnchor,
    required String xmlString,
  }) {
    if (xmlString.isEmpty) return false;

    try {
      final paragraphXml = XmlDocument.parse(xmlString).rootElement;
      return detectFromXmlParagraph(
        hyperlinkAnchor: hyperlinkAnchor,
        paragraphXml: paragraphXml,
      );
    } catch (_) {
      return false;
    }
  }

  static bool detectFromXmlParagraph({
    required String? hyperlinkAnchor,
    required XmlElement paragraphXml,
  }) {
    final fieldInstructions = <String>[];

    for (final instrText in paragraphXml.findAllElements('w:instrText')) {
      fieldInstructions.add(instrText.text);
    }

    for (final fldSimple in paragraphXml.findAllElements('w:fldSimple')) {
      final instruction = fldSimple.getAttribute('w:instr');
      if (instruction != null && instruction.isNotEmpty) {
        fieldInstructions.add(instruction);
      }
    }

    return detectFromFieldInstructions(
      hyperlinkAnchor: hyperlinkAnchor,
      fieldInstructions: fieldInstructions,
    );
  }
}
