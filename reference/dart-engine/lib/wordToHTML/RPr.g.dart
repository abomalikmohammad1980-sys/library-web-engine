// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'RPr.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

RPr _$RPrFromJson(Map<String, dynamic> json) => RPr.empty()
  ..color = json['color'] as String?
  ..uColor = json['uColor'] as String?
  ..highlightColor = json['highlightColor'] as String?
  ..fontSize = (json['fontSize'] as num?)?.toDouble()
  ..b = json['b'] as bool?
  ..i = json['i'] as bool?
  ..u = json['u'] as bool?
  ..rtl = json['rtl'] as bool?
  ..strike = json['strike'] as bool?
  ..vanish = json['vanish'] as bool?
  ..font = json['font'] as String?
  ..enFont = json['enFont'] as String?
  ..uniqueFont = json['uniqueFont'] as String?
  ..vertAlign = json['vertAlign'] as String?
  ..rStyle = json['rStyle'] as String?;

Map<String, dynamic> _$RPrToJson(RPr instance) => <String, dynamic>{
  'color': instance.color,
  'uColor': instance.uColor,
  'highlightColor': instance.highlightColor,
  'fontSize': instance.fontSize,
  'b': instance.b,
  'i': instance.i,
  'u': instance.u,
  'rtl': instance.rtl,
  'strike': instance.strike,
  'vanish': instance.vanish,
  'font': instance.font,
  'enFont': instance.enFont,
  'uniqueFont': instance.uniqueFont,
  'vertAlign': instance.vertAlign,
  'rStyle': instance.rStyle,
};
