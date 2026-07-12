// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'WordDocument.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

WordDocument _$WordDocumentFromJson(Map<String, dynamic> json) => WordDocument()
  ..title = json['title'] as String
  ..defaultRPr = json['defaultRPr'] == null
      ? null
      : RPr.fromJson(json['defaultRPr'] as Map<String, dynamic>)
  ..defaultPPr = json['defaultPPr'] == null
      ? null
      : PPr.fromJson(json['defaultPPr'] as Map<String, dynamic>)
  ..majorFont = json['majorFont'] as String?
  ..minorFont = json['minorFont'] as String?
  ..majorFontCS = json['majorFontCS'] as String?
  ..minorFontCS = json['minorFontCS'] as String?
  ..autoDarkColor = json['autoDarkColor'] as String
  ..autoLightColor = json['autoLightColor'] as String
  ..themeColors = Map<String, String>.from(json['themeColors'] as Map)
  ..abstractNumMap = (json['abstractNumMap'] as Map<String, dynamic>).map(
    (k, e) =>
        MapEntry(int.parse(k), AbstractNum.fromJson(e as Map<String, dynamic>)),
  )
  ..numsMap = WordDocument._intKeyMapFromJsonNum(
    json['numsMap'] as Map<String, dynamic>,
  )
  ..sectpr = json['sectpr'] == null
      ? null
      : SectPr.fromJson(json['sectpr'] as Map<String, dynamic>)
  ..sectPrList = (json['sectPrList'] as List<dynamic>)
      .map((e) => SectPr.fromJson(e as Map<String, dynamic>))
      .toList()
  ..currentPage = (json['currentPage'] as num).toInt()
  ..docFootNotes = (json['docFootNotes'] as Map<String, dynamic>).map(
    (k, e) => MapEntry(k, FootNote.fromJson(e as Map<String, dynamic>)),
  )
  ..bookMarksMap = Map<String, int>.from(json['bookMarksMap'] as Map)
  ..relIdList = (json['relIdList'] as Map<String, dynamic>).map(
    (k, e) => MapEntry(k, RelId.fromJson(e as Map<String, dynamic>)),
  )
  ..docImages = WordDocument._docImagesFromJson(
    json['docImages'] as Map<String, dynamic>,
  )
  ..documentStyles = WordDocument._documentStylesFromJson(
    json['documentStyles'] as Map<String, dynamic>,
  )
  ..evenAndOddHeaders = json['evenAndOddHeaders'] as bool?
  ..adjustLineHeightInTable =
      json['adjustLineHeightInTable'] as bool? ?? false
  ..withDiacritics = json['withDiacritics'] as bool? ?? true
  ..useArabicNumerals = json['useArabicNumerals'] as bool? ?? true
  ..index = (json['index'] as List<dynamic>)
      .map((e) => IndexItem.fromJson(e as Map<String, dynamic>))
      .toList()
  ..selectedIndexItem = json['selectedIndexItem'] as String?;

Map<String, dynamic> _$WordDocumentToJson(
  WordDocument instance,
) => <String, dynamic>{
  'title': instance.title,
  'defaultRPr': instance.defaultRPr?.toJson(),
  'defaultPPr': instance.defaultPPr?.toJson(),
  'majorFont': instance.majorFont,
  'minorFont': instance.minorFont,
  'majorFontCS': instance.majorFontCS,
  'minorFontCS': instance.minorFontCS,
  'autoDarkColor': instance.autoDarkColor,
  'autoLightColor': instance.autoLightColor,
  'themeColors': instance.themeColors,
  'abstractNumMap': instance.abstractNumMap.map(
    (k, e) => MapEntry(k.toString(), e.toJson()),
  ),
  'numsMap': WordDocument._intKeyMapToJsonNum(instance.numsMap),
  'sectpr': instance.sectpr?.toJson(),
  'sectPrList': instance.sectPrList.map((e) => e.toJson()).toList(),
  'currentPage': instance.currentPage,
  'docFootNotes': instance.docFootNotes.map((k, e) => MapEntry(k, e.toJson())),
  'bookMarksMap': instance.bookMarksMap,
  'relIdList': instance.relIdList.map((k, e) => MapEntry(k, e.toJson())),
  'docImages': WordDocument._docImagesToJson(instance.docImages),
  'documentStyles': WordDocument._documentStylesToJson(instance.documentStyles),
  'evenAndOddHeaders': instance.evenAndOddHeaders,
  'adjustLineHeightInTable': instance.adjustLineHeightInTable,
  'withDiacritics': instance.withDiacritics,
  'useArabicNumerals': instance.useArabicNumerals,
  'index': instance.index.map((e) => e.toJson()).toList(),
  'selectedIndexItem': instance.selectedIndexItem,
};
