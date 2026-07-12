import 'package:archive/archive.dart';
import 'package:golden_shamela/Utils/ArchiveToXml.dart';
import 'package:xml/xml.dart';

class DocumentSettingsSnapshot {
  final bool? evenAndOddHeaders;
  final bool adjustLineHeightInTable;

  const DocumentSettingsSnapshot({
    this.evenAndOddHeaders,
    this.adjustLineHeightInTable = false,
  });
}

class DocumentSettingsParser {
  const DocumentSettingsParser._();

  static DocumentSettingsSnapshot parse(ArchiveFile? settingsFile) {
    if (settingsFile == null) {
      return const DocumentSettingsSnapshot();
    }

    try {
      final settingsDoc = ArchiveToXml(settingsFile);
      return fromElement(settingsDoc.getElement('w:settings'));
    } catch (e) {
      print('Error reading settings.xml: $e');
      return const DocumentSettingsSnapshot();
    }
  }

  static DocumentSettingsSnapshot fromElement(XmlElement? settingsElement) {
    if (settingsElement == null) {
      return const DocumentSettingsSnapshot();
    }

    final evenAndOddHeaders = _resolveOptionalOnOff(
      settingsElement.getElement('w:evenAndOddHeaders'),
    );
    final compatElement = settingsElement.getElement('w:compat');
    final adjustLineHeightInTable = _resolveOnOff(
      compatElement?.getElement('w:adjustLineHeightInTable'),
    );

    return DocumentSettingsSnapshot(
      evenAndOddHeaders: evenAndOddHeaders,
      adjustLineHeightInTable: adjustLineHeightInTable,
    );
  }

  static bool? _resolveOptionalOnOff(XmlElement? element) {
    if (element == null) {
      return null;
    }
    return _resolveOnOff(element);
  }

  static bool _resolveOnOff(XmlElement? element) {
    if (element == null) {
      return false;
    }

    final val = element.getAttribute('w:val')?.toLowerCase();
    if (val == null || val.isEmpty) {
      return true;
    }

    return val != '0' && val != 'false' && val != 'off';
  }
}
