// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'FootNote.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

FootNote _$FootNoteFromJson(Map<String, dynamic> json) => FootNote.empty()
  ..paragraphs = (json['paragraphs'] as List<dynamic>)
      .map((e) => Paragraph.fromJson(e as Map<String, dynamic>))
      .toList()
  ..id = json['id'] as String
  ..displayNumber = json['displayNumber'] as String?;

Map<String, dynamic> _$FootNoteToJson(FootNote instance) => <String, dynamic>{
  'paragraphs': instance.paragraphs.map((e) => e.toJson()).toList(),
  'id': instance.id,
  'displayNumber': instance.displayNumber,
};
