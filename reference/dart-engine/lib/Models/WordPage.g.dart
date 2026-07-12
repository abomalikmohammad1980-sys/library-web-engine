// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'WordPage.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

WordPage _$WordPageFromJson(Map<String, dynamic> json) => WordPage.empty()
  ..ps = (json['ps'] as List<dynamic>)
      .map((e) => Paragraph.fromJson(e as Map<String, dynamic>))
      .toList()
  ..fns = (json['fns'] as List<dynamic>)
      .map((e) => FootNote.fromJson(e as Map<String, dynamic>))
      .toList()
  ..pageNum = json['pageNum'] as String
  ..pageIndex = (json['pageIndex'] as num).toInt();

Map<String, dynamic> _$WordPageToJson(WordPage instance) => <String, dynamic>{
  'ps': instance.ps.map((e) => e.toJson()).toList(),
  'fns': instance.fns.map((e) => e.toJson()).toList(),
  'pageNum': instance.pageNum,
  'pageIndex': instance.pageIndex,
};
