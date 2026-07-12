import 'package:archive/archive.dart';
import 'package:golden_shamela/Models/WordDocument.dart';
import 'package:golden_shamela/Utils/ArchiveToXml.dart';
import 'package:golden_shamela/core/app_state.dart';
import 'package:xml/xml.dart';

/// Parses and resolves Word STYLEREF fields for header/footer rendering.
///
/// Microsoft documents that a STYLEREF in a printed header/footer is
/// page-layout dependent: Word searches the current page first, then falls back
/// to content before the page, then content after it. We cannot trust the
/// cached `fldChar separate` text stored in header XML.
///
/// We keep this resolver narrowly focused on that validated header/footer
/// behavior so the rest of paragraph rendering stays unchanged.
class StyleRefResolver {
  static final Expando<_StyleRefCache> _cacheByDocument =
      Expando<_StyleRefCache>('styleRefCache');

  static StyleRefFieldSpec? parseFieldInstruction(String instruction) {
    final normalized = instruction.replaceAll(RegExp(r'\s+'), ' ').trim();
    if (!normalized.toUpperCase().contains('STYLEREF')) return null;

    final quotedMatch = RegExp(
      r'STYLEREF\s+"([^"]+)"',
      caseSensitive: false,
    ).firstMatch(normalized);
    final bareMatch = RegExp(
      r'STYLEREF\s+([^\s\\]+)',
      caseSensitive: false,
    ).firstMatch(normalized);

    final styleIdentifier = quotedMatch?.group(1) ?? bareMatch?.group(1);
    if (styleIdentifier == null || styleIdentifier.trim().isEmpty) {
      return null;
    }

    return StyleRefFieldSpec(
      styleIdentifier: styleIdentifier.trim(),
      useLast: RegExp(r'\\l(\s|$)', caseSensitive: false).hasMatch(normalized),
    );
  }

  static String? resolveElectronicHeaderFooter({
    required WordDocument wordDocument,
    required int pageIndex,
    required StyleRefFieldSpec spec,
  }) {
    final cache = _cacheByDocument[wordDocument] ??= _StyleRefCache.build(
      wordDocument,
    );
    final currentSectionIndex = _sectionIndexForPage(wordDocument, pageIndex);
    if (currentSectionIndex == null) return null;

    final candidates = cache.lookup(spec.styleIdentifier);
    if (candidates.isEmpty) return null;

    final inCurrentPage = candidates
        .where((candidate) => candidate.pageIndex == pageIndex)
        .toList();
    if (inCurrentPage.isNotEmpty) {
      return spec.useLast ? inCurrentPage.last.text : inCurrentPage.first.text;
    }

    // Printed header/footer STYLEREF falls back from the top of the current
    // page toward the document start before searching after the page. This is
    // why early pages can show the first later heading, while later pages keep
    // the last previous heading until another heading appears.
    final beforeCurrentPage = candidates
        .where(
          (candidate) =>
              candidate.sectionIndex == currentSectionIndex &&
              candidate.pageIndex < pageIndex,
        )
        .toList();
    if (beforeCurrentPage.isNotEmpty) {
      return beforeCurrentPage.last.text;
    }

    final afterCurrentPage = candidates
        .where(
          (candidate) =>
              candidate.sectionIndex >= currentSectionIndex &&
              candidate.pageIndex > pageIndex,
        )
        .toList();
    if (afterCurrentPage.isNotEmpty) {
      return afterCurrentPage.first.text;
    }

    return null;
  }

  static int? _sectionIndexForPage(WordDocument wordDocument, int pageIndex) {
    for (int i = 0; i < wordDocument.sectPrList.length; i++) {
      final sect = wordDocument.sectPrList[i];
      if (pageIndex >= sect.firstRange && pageIndex <= sect.lastRange) {
        return i;
      }
    }
    return null;
  }
}

class StyleRefFieldSpec {
  final String styleIdentifier;
  final bool useLast;

  const StyleRefFieldSpec({
    required this.styleIdentifier,
    required this.useLast,
  });
}

class _StyleRefCache {
  final Map<String, List<_StyleRefCandidate>> candidatesByKey;

  const _StyleRefCache(this.candidatesByKey);

  List<_StyleRefCandidate> lookup(String styleIdentifier) {
    for (final key in _lookupKeysForStyleIdentifier(styleIdentifier)) {
      final candidates = candidatesByKey[key];
      if (candidates != null && candidates.isNotEmpty) {
        return candidates;
      }
    }
    return const [];
  }

  static _StyleRefCache build(WordDocument wordDocument) {
    final archiveMap =
        wordDocument.archive?.toMap() ?? AppState().docArchive.toMap();
    final documentFile = archiveMap['word/document.xml'];
    if (documentFile == null) return const _StyleRefCache({});

    final stylesById = _loadStyleMetadata(wordDocument);
    final candidatesByKey = <String, List<_StyleRefCandidate>>{};

    final documentXml = ArchiveToXml(documentFile);
    final body = documentXml.rootElement.getElement('w:body');
    if (body == null) return const _StyleRefCache({});

    int currentPage = 1;
    for (final paragraph in body.childElements.where((e) => e.name.local == 'p')) {
      final paragraphPages = _extractParagraphPages(paragraph);
      if (paragraphPages.isNotEmpty) {
        currentPage = paragraphPages.last;
      }

      final pageIndex = currentPage > 0 ? currentPage - 1 : 0;
      final sectionIndex = StyleRefResolver._sectionIndexForPage(
        wordDocument,
        pageIndex,
      );
      if (sectionIndex == null) continue;

      final paragraphText = _extractVisibleText(paragraph);
      final pStyleId = paragraph
          .getElement('w:pPr')
          ?.getElement('w:pStyle')
          ?.getAttribute('w:val');
      if (pStyleId != null && paragraphText.isNotEmpty) {
        final style = stylesById[pStyleId];
        if (style?.type == 'paragraph') {
          _addCandidate(
            candidatesByKey,
            _StyleRefCandidate(
              sectionIndex: sectionIndex,
              pageIndex: pageIndex,
              text: paragraphText,
            ),
            pStyleId,
            style?.name,
          );
        }
      }

      final characterRuns = _extractCharacterStyleRuns(paragraph);
      for (final run in characterRuns) {
        final style = stylesById[run.styleId];
        if (style?.type != 'character' || run.text.isEmpty) continue;
        _addCandidate(
          candidatesByKey,
          _StyleRefCandidate(
            sectionIndex: sectionIndex,
            pageIndex: pageIndex,
            text: run.text,
          ),
          run.styleId,
          style?.name,
        );
      }
    }

    return _StyleRefCache(candidatesByKey);
  }

  static Map<String, _StyleMetadata> _loadStyleMetadata(WordDocument document) {
    final result = <String, _StyleMetadata>{};
    for (final entry in document.documentStyles.entries) {
      result[entry.key] = _StyleMetadata(
        id: entry.key,
        type: entry.value.getAttribute('w:type') ?? '',
        name: entry.value.getElement('w:name')?.getAttribute('w:val'),
      );
    }
    return result;
  }

  static List<int> _extractParagraphPages(XmlElement paragraph) {
    final result = <int>[];
    for (final bookmark in paragraph.findElements('w:bookmarkStart')) {
      final name = bookmark.getAttribute('w:name') ?? '';
      if (!name.startsWith('ShamelaPage_')) continue;
      final page = int.tryParse(name.substring('ShamelaPage_'.length));
      if (page != null) result.add(page);
    }

    for (final textNode in paragraph.findAllElements('w:t')) {
      final matches = RegExp(r'\{\{PG:(\d+)\}\}').allMatches(textNode.text);
      for (final match in matches) {
        final page = int.tryParse(match.group(1) ?? '');
        if (page != null) result.add(page);
      }
    }

    return result;
  }

  static String _extractVisibleText(XmlElement paragraph) {
    final buffer = StringBuffer();
    for (final textNode in paragraph.findAllElements('w:t')) {
      buffer.write(textNode.text);
    }
    return buffer
        .toString()
        .replaceAll(RegExp(r'\{\{PG:\d+\}\}'), '')
        .trim();
  }

  static List<_CharacterStyleRun> _extractCharacterStyleRuns(
    XmlElement paragraph,
  ) {
    final result = <_CharacterStyleRun>[];
    String? currentStyleId;
    var buffer = StringBuffer();

    void flush() {
      final text = buffer.toString().trim();
      if (currentStyleId != null && text.isNotEmpty) {
        result.add(_CharacterStyleRun(styleId: currentStyleId!, text: text));
      }
      currentStyleId = null;
      buffer = StringBuffer();
    }

    for (final run in paragraph.childElements.where((e) => e.name.local == 'r')) {
      final runStyleId = run
          .getElement('w:rPr')
          ?.getElement('w:rStyle')
          ?.getAttribute('w:val');
      final runText = run.findAllElements('w:t').map((e) => e.text).join();

      if (runStyleId == null || runText.trim().isEmpty) {
        flush();
        continue;
      }

      if (currentStyleId != null && currentStyleId != runStyleId) {
        flush();
      }

      currentStyleId = runStyleId;
      buffer.write(runText);
    }

    flush();
    return result;
  }

  static void _addCandidate(
    Map<String, List<_StyleRefCandidate>> candidatesByKey,
    _StyleRefCandidate candidate,
    String styleId,
    String? styleName,
  ) {
    for (final key in {
      _normalizeKey(styleId),
      if (styleName != null && styleName.trim().isNotEmpty)
        _normalizeKey(styleName),
    }) {
      final list = candidatesByKey.putIfAbsent(key, () => <_StyleRefCandidate>[]);
      list.add(candidate);
    }
  }

  static String _normalizeKey(String value) {
    return value.replaceAll(RegExp(r'\s+'), ' ').trim().toLowerCase();
  }

  static List<String> _lookupKeysForStyleIdentifier(String value) {
    final normalized = _normalizeKey(value);
    final keys = <String>[normalized];

    // Word may serialize built-in styles with English internal names/ids while
    // field instructions keep the localized UI name. Arabic `عنوان 2` is the
    // localized form of built-in `heading 2`, whose styleId is often just `2`
    // in these documents. This maps the built-in heading family only; it does
    // not guess arbitrary localized custom style names.
    final arabicHeadingMatch = RegExp(r'^عنوان\s+(\d+)$').firstMatch(normalized);
    if (arabicHeadingMatch != null) {
      final level = arabicHeadingMatch.group(1)!;
      keys.add(_normalizeKey('heading $level'));
      keys.add(_normalizeKey(level));
    }

    return keys;
  }
}

class _StyleMetadata {
  final String id;
  final String type;
  final String? name;

  const _StyleMetadata({
    required this.id,
    required this.type,
    required this.name,
  });
}

class _StyleRefCandidate {
  final int sectionIndex;
  final int pageIndex;
  final String text;

  const _StyleRefCandidate({
    required this.sectionIndex,
    required this.pageIndex,
    required this.text,
  });
}

class _CharacterStyleRun {
  final String styleId;
  final String text;

  const _CharacterStyleRun({
    required this.styleId,
    required this.text,
  });
}
