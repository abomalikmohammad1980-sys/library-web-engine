import 'package:xml/xml.dart' as xml;

/// يحلل Insets الخاصة بـ `wps:bodyPr` ويحوّلها إلى logical pixels.
///
/// مرجع OOXML/DocumentFormat.OpenXml:
/// - `lIns` / `rIns` الافتراضي = 91440 EMU (0.1in)
/// - `tIns` / `bIns` الافتراضي = 45720 EMU (0.05in)
class WpsBodyPropertiesParser {
  const WpsBodyPropertiesParser._();

  static const int _defaultHorizontalInsetEmu = 91440;
  static const int _defaultVerticalInsetEmu = 45720;
  static const double _emuPerPixel = 9525.0;

  static List<double>? tryParseInsetPx(xml.XmlElement wspElement) {
    final bodyPr = wspElement.findAllElements('wps:bodyPr').firstOrNull;
    if (bodyPr == null) return null;

    return [
      _parseInset(bodyPr.getAttribute('lIns'), _defaultHorizontalInsetEmu),
      _parseInset(bodyPr.getAttribute('tIns'), _defaultVerticalInsetEmu),
      _parseInset(bodyPr.getAttribute('rIns'), _defaultHorizontalInsetEmu),
      _parseInset(bodyPr.getAttribute('bIns'), _defaultVerticalInsetEmu),
    ];
  }

  static bool hasNoAutoFit(xml.XmlElement wspElement) {
    final bodyPr = wspElement.findAllElements('wps:bodyPr').firstOrNull;
    if (bodyPr == null) return false;
    return bodyPr.findAllElements('a:noAutofit').isNotEmpty;
  }

  static double _parseInset(String? rawValue, int fallbackEmu) {
    final emu = int.tryParse(rawValue ?? '') ?? fallbackEmu;
    return emu / _emuPerPixel;
  }
}
