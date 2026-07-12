// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'Paragraph.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Paragraph _$ParagraphFromJson(Map<String, dynamic> json) => Paragraph.empty()
  ..pPr = json['pPr'] == null
      ? null
      : PPr.fromJson(json['pPr'] as Map<String, dynamic>)
  ..prPr = json['prPr'] == null
      ? null
      : RPr.fromJson(json['prPr'] as Map<String, dynamic>)
  ..runs = (json['runs'] as List<dynamic>)
      .map((e) => runT.fromJson(e as Map<String, dynamic>))
      .toList()
  ..text = json['text'] as String
  ..xmlString = json['xmlString'] as String
  ..pageNum = json['pageNum'] as String
  ..imageRunTs = (json['imageRunTs'] as List<dynamic>)
      .map((e) => runT.fromJson(e as Map<String, dynamic>))
      .toList()
  ..textRunTs = (json['textRunTs'] as List<dynamic>)
      .map((e) => runT.fromJson(e as Map<String, dynamic>))
      .toList()
  ..textAlign = $enumDecode(_$TextAlignEnumMap, json['textAlign'])
  ..textDirection = $enumDecode(_$TextDirectionEnumMap, json['textDirection'])
  ..sectionType = json['sectionType'] as String
  ..hyperlinkAnchor = json['hyperlinkAnchor'] as String?
  ..suppressHyperlinkStyleInheritance =
      json['suppressHyperlinkStyleInheritance'] as bool? ?? false;

Map<String, dynamic> _$ParagraphToJson(Paragraph instance) => <String, dynamic>{
  'pPr': instance.pPr?.toJson(),
  'prPr': instance.prPr?.toJson(),
  'runs': instance.runs.map((e) => e.toJson()).toList(),
  'text': instance.text,
  'xmlString': instance.xmlString,
  'pageNum': instance.pageNum,
  'imageRunTs': instance.imageRunTs.map((e) => e.toJson()).toList(),
  'textRunTs': instance.textRunTs.map((e) => e.toJson()).toList(),
  'textAlign': _$TextAlignEnumMap[instance.textAlign]!,
  'textDirection': _$TextDirectionEnumMap[instance.textDirection]!,
  'sectionType': instance.sectionType,
  'hyperlinkAnchor': instance.hyperlinkAnchor,
  'suppressHyperlinkStyleInheritance':
      instance.suppressHyperlinkStyleInheritance,
};

const _$TextAlignEnumMap = {
  TextAlign.left: 'left',
  TextAlign.right: 'right',
  TextAlign.center: 'center',
  TextAlign.justify: 'justify',
  TextAlign.start: 'start',
  TextAlign.end: 'end',
};

const _$TextDirectionEnumMap = {
  TextDirection.rtl: 'rtl',
  TextDirection.ltr: 'ltr',
};
