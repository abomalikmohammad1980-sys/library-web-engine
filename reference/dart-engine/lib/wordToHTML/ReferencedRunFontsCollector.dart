import 'package:archive/archive.dart';
import 'package:golden_shamela/Utils/ArchiveToXml.dart';
import 'package:xml/xml.dart';

const _fontBearingWordParts = <String>{
  'word/document.xml',
  'word/styles.xml',
  'word/footnotes.xml',
  'word/endnotes.xml',
};

Set<String> collectReferencedRunFonts(Map<String, ArchiveFile> archiveMap) {
  final fonts = <String>{};

  for (final entry in archiveMap.entries) {
    final path = entry.key;
    if (!_shouldInspectPart(path)) continue;

    final archiveFile = entry.value;
    try {
      final document = ArchiveToXml(archiveFile);
      for (final rFonts in document.findAllElements('w:rFonts')) {
        _addFontAttribute(fonts, rFonts, 'w:ascii');
        _addFontAttribute(fonts, rFonts, 'w:hAnsi');
        _addFontAttribute(fonts, rFonts, 'w:cs');
        _addFontAttribute(fonts, rFonts, 'w:eastAsia');
      }
      for (final sym in document.findAllElements('w:sym')) {
        _addElementAttribute(fonts, sym, 'w:font');
      }
    } catch (_) {
      // Ignore malformed/non-critical parts and keep parsing the rest.
    }
  }

  return fonts;
}

bool _shouldInspectPart(String path) {
  if (_fontBearingWordParts.contains(path)) return true;
  return path.startsWith('word/header') || path.startsWith('word/footer');
}

void _addFontAttribute(Set<String> fonts, XmlElement rFonts, String attribute) {
  final value = rFonts.getAttribute(attribute)?.trim();
  if (value == null || value.isEmpty) return;
  fonts.add(value);
}

void _addElementAttribute(Set<String> fonts, XmlElement element, String attribute) {
  final value = element.getAttribute(attribute)?.trim();
  if (value == null || value.isEmpty) return;
  fonts.add(value);
}
