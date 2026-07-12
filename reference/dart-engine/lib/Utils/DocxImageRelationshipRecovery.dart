import 'package:golden_shamela/Models/WordDocument.dart';
import 'package:golden_shamela/core/app_state.dart';
import 'package:golden_shamela/wordToHTML/DocRelations.dart'
    show WORD_DOCUMENT_RELS, RelId, parseRelationships;
import 'package:xml/xml.dart' as xml;

import 'ArchiveToXml.dart';

final Map<int, Map<String, String>> _mainDocumentEmbedRecoveryCache = {};

Map<String, String> getMainDocumentEmbedRecoveryMap(WordDocument wordDocument) {
  final cacheKey = identityHashCode(wordDocument);
  final cached = _mainDocumentEmbedRecoveryCache[cacheKey];
  if (cached != null) {
    return cached;
  }

  final archiveMap =
      wordDocument.archive?.toMap() ?? AppState().docArchive.toMap();
  final documentFile = archiveMap['word/document.xml'];
  final relsFile = archiveMap[WORD_DOCUMENT_RELS];
  if (documentFile == null || relsFile == null) {
    return _mainDocumentEmbedRecoveryCache[cacheKey] = const {};
  }

  try {
    final documentXml = ArchiveToXml(documentFile);
    final rels = wordDocument.relIdList.isNotEmpty
        ? wordDocument.relIdList
        : parseRelationships(relsFile);

    final embedIds = _collectEmbeddedImageRelIds(documentXml);
    final imageRelIds = _collectImageRelationshipIds(rels);
    if (embedIds.isEmpty || embedIds.length != imageRelIds.length) {
      return _mainDocumentEmbedRecoveryCache[cacheKey] = const {};
    }

    final deltas = <int>[];
    bool hasBrokenEmbed = false;
    for (int i = 0; i < embedIds.length; i++) {
      final embedNum = _extractRidNumber(embedIds[i]);
      final relNum = _extractRidNumber(imageRelIds[i]);
      if (embedNum == null || relNum == null) {
        return _mainDocumentEmbedRecoveryCache[cacheKey] = const {};
      }

      deltas.add(relNum - embedNum);
      final currentTarget = rels[embedIds[i]]?.Target;
      if (!_isLikelyImageTarget(currentTarget)) {
        hasBrokenEmbed = true;
      }
    }

    if (!hasBrokenEmbed) {
      return _mainDocumentEmbedRecoveryCache[cacheKey] = const {};
    }

    final firstDelta = deltas.first;
    final hasConstantOffset = deltas.every((delta) => delta == firstDelta);
    if (!hasConstantOffset || firstDelta == 0) {
      return _mainDocumentEmbedRecoveryCache[cacheKey] = const {};
    }

    final recovery = <String, String>{};
    for (int i = 0; i < embedIds.length; i++) {
      recovery[embedIds[i]] = imageRelIds[i];
    }

    return _mainDocumentEmbedRecoveryCache[cacheKey] = recovery;
  } catch (_) {
    return _mainDocumentEmbedRecoveryCache[cacheKey] = const {};
  }
}

List<String> _collectEmbeddedImageRelIds(xml.XmlDocument documentXml) {
  final embedIds = <String>[];
  final seenEmbeds = <String>{};

  for (final blip in documentXml.findAllElements('a:blip')) {
    final embedId = blip.getAttribute('r:embed')?.trim();
    if (embedId == null || embedId.isEmpty || !seenEmbeds.add(embedId)) {
      continue;
    }
    embedIds.add(embedId);
  }

  return embedIds;
}

List<String> _collectImageRelationshipIds(Map<String, RelId> rels) {
  final imageRelIds = rels.values
      .where((rel) => _isLikelyImageTarget(rel.Target))
      .map((rel) => rel.Id)
      .toList();

  imageRelIds.sort((a, b) => (_extractRidNumber(a) ?? -1).compareTo(
        _extractRidNumber(b) ?? -1,
      ));
  return imageRelIds;
}

bool _isLikelyImageTarget(String? target) {
  if (target == null || target.isEmpty) return false;
  final normalized = target.toLowerCase();
  if (normalized.startsWith('media/')) return true;
  return normalized.endsWith('.png') ||
      normalized.endsWith('.jpg') ||
      normalized.endsWith('.jpeg') ||
      normalized.endsWith('.gif') ||
      normalized.endsWith('.bmp') ||
      normalized.endsWith('.webp') ||
      normalized.endsWith('.tif') ||
      normalized.endsWith('.tiff') ||
      normalized.endsWith('.wmf') ||
      normalized.endsWith('.emf');
}

int? _extractRidNumber(String rid) {
  final match = RegExp(r'^rId(\d+)$').firstMatch(rid.trim());
  if (match == null) {
    return null;
  }
  return int.tryParse(match.group(1)!);
}
