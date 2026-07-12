// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'IndexItem.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

IndexItem _$IndexItemFromJson(Map<String, dynamic> json) => IndexItem(
  title: json['title'] as String,
  page: (json['page'] as num).toInt(),
  type: json['type'] as String,
  id: json['id'] as String? ?? "",
);

Map<String, dynamic> _$IndexItemToJson(IndexItem instance) => <String, dynamic>{
  'title': instance.title,
  'page': instance.page,
  'type': instance.type,
  'id': instance.id,
};
