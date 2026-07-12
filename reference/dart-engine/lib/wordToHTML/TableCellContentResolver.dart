import 'package:xml/xml.dart';

class TableCellContentResolver {
  const TableCellContentResolver._();

  static List<XmlElement> resolveParagraphs(
    XmlElement cell, {
    bool trimTrailingStructuralEmptyParagraph = false,
  }) {
    final directParagraphs = cell.childElements
        .where((element) => element.name.local == 'p')
        .toList();

    final paragraphs = directParagraphs.isNotEmpty
        ? directParagraphs
        : cell.findAllElements('w:p').toList();

    if (!trimTrailingStructuralEmptyParagraph || paragraphs.length <= 1) {
      return paragraphs;
    }

    final trailingParagraph = paragraphs.last;
    if (!_isStructuralEmptyParagraph(trailingParagraph)) {
      return paragraphs;
    }

    return paragraphs.sublist(0, paragraphs.length - 1);
  }

  static bool _isStructuralEmptyParagraph(XmlElement paragraph) {
    if (paragraph.innerText.trim().isNotEmpty) {
      return false;
    }

    const visibleDescendants = {
      'drawing',
      'pict',
      'object',
      'tab',
      'br',
      'cr',
      'sym',
      'hyperlink',
      'fldSimple',
      'instrText',
    };

    final hasVisibleDescendant = paragraph.descendants
        .whereType<XmlElement>()
        .any((element) => visibleDescendants.contains(element.name.local));
    if (hasVisibleDescendant) {
      return false;
    }

    final pPr = paragraph.getElement('w:pPr');
    if (pPr == null) {
      return true;
    }

    if (pPr.getElement('w:pBdr') != null ||
        pPr.getElement('w:numPr') != null ||
        pPr.getElement('w:framePr') != null) {
      return false;
    }

    final spacing = pPr.getElement('w:spacing');
    if (spacing != null) {
      final spacingValues = [
        spacing.getAttribute('w:before'),
        spacing.getAttribute('w:after'),
        spacing.getAttribute('w:line'),
      ];
      if (spacingValues.any((value) => (double.tryParse(value ?? '0') ?? 0) != 0)) {
        return false;
      }
    }

    return true;
  }
}
