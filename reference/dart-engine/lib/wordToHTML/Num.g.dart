// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'Num.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Num _$NumFromJson(Map<String, dynamic> json) => Num(
  numId: (json['numId'] as num).toInt(),
  abstractNumId: (json['abstractNumId'] as num).toInt(),
  overrides: (json['overrides'] as List<dynamic>)
      .map((e) => Override.fromJson(e as Map<String, dynamic>))
      .toList(),
);

Map<String, dynamic> _$NumToJson(Num instance) => <String, dynamic>{
  'numId': instance.numId,
  'abstractNumId': instance.abstractNumId,
  'overrides': instance.overrides.map((e) => e.toJson()).toList(),
};

Override _$OverrideFromJson(Map<String, dynamic> json) => Override(
  ilvl: (json['ilvl'] as num).toInt(),
  startOverride: (json['startOverride'] as num?)?.toInt(),
  level: json['level'] == null
      ? null
      : Level.fromJson(json['level'] as Map<String, dynamic>),
);

Map<String, dynamic> _$OverrideToJson(Override instance) => <String, dynamic>{
  'ilvl': instance.ilvl,
  'startOverride': instance.startOverride,
  'level': instance.level?.toJson(),
};
