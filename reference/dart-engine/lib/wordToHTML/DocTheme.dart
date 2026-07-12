import 'package:archive/archive.dart';
import 'package:xml/xml.dart';

import '../Utils/ArchiveToXml.dart';
import '../Utils/WordUtils.dart';
import '../Models/WordDocument.dart';

void addTheme1(ArchiveFile? archiveFile, WordDocument wordDocument) {
  if (archiveFile == null) return;
  WordUtils wordUtils = WordUtils(wordDocument);
  XmlDocument document = ArchiveToXml(archiveFile);
  // print(document.toXmlString(pretty: true));
  XmlElement? fontScheme = wordUtils.getFontScheme(document);
  wordDocument.majorFont = wordUtils.getMajorFont(fontScheme);
  wordDocument.minorFont = wordUtils.getMinorFont(fontScheme);
  wordDocument.majorFontCS = wordUtils.getMajorFontCS(fontScheme);
  wordDocument.minorFontCS = wordUtils.getMinorFontCS(fontScheme);
  wordDocument.autoDarkColor = wordUtils.getAutoDarkColor(document) ?? "000000";
  wordDocument.autoLightColor =
      wordUtils.getAutoLightColor(document) ?? "FFFFFF";

  // استخراج خريطة ألوان التيمة الكاملة من a:clrScheme
  XmlElement? clrScheme = document
      .getElement("a:theme")
      ?.getElement("a:themeElements")
      ?.getElement("a:clrScheme");
  if (clrScheme != null) {
    wordDocument.themeColors = _extractThemeColors(clrScheme);
  }
}

/// استخراج لون من عنصر تيمة (يدعم a:srgbClr و a:sysClr)
String? _extractColorFromElement(XmlElement element) {
  final srgb = element.getElement("a:srgbClr");
  if (srgb != null) return srgb.getAttribute("val");

  final sys = element.getElement("a:sysClr");
  if (sys != null) return sys.getAttribute("lastClr");

  return null;
}

/// بناء خريطة ألوان التيمة الكاملة من a:clrScheme
/// الأسماء تطابق قيم w:themeColor في Word XML
Map<String, String> _extractThemeColors(XmlElement clrScheme) {
  const mapping = {
    "a:dk1": "dark1",
    "a:lt1": "light1",
    "a:dk2": "dark2",
    "a:lt2": "light2",
    "a:accent1": "accent1",
    "a:accent2": "accent2",
    "a:accent3": "accent3",
    "a:accent4": "accent4",
    "a:accent5": "accent5",
    "a:accent6": "accent6",
    "a:hlink": "hyperlink",
    "a:folHlink": "followedHyperlink",
  };

  Map<String, String> colors = {};
  for (var entry in mapping.entries) {
    XmlElement? elem = clrScheme.getElement(entry.key);
    if (elem != null) {
      String? color = _extractColorFromElement(elem);
      if (color != null) colors[entry.value] = color;
    }
  }
  return colors;
}
