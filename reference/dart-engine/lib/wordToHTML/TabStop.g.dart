// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'TabStop.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

TabStop _$TabStopFromJson(Map<String, dynamic> json) => TabStop(
  type: json['type'] as String?,
  position: (json['position'] as num?)?.toDouble(),
  leader: json['leader'] as String?,
);

Map<String, dynamic> _$TabStopToJson(TabStop instance) => <String, dynamic>{
  'type': instance.type,
  'position': instance.position,
  'leader': instance.leader,
};
