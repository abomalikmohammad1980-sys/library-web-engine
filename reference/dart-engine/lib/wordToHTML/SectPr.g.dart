// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'SectPr.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

SectPr _$SectPrFromJson(Map<String, dynamic> json) => SectPr.emptyJson()
  ..width = (json['width'] as num?)?.toDouble()
  ..height = (json['height'] as num?)?.toDouble()
  ..topMargin = (json['topMargin'] as num).toDouble()
  ..bottomMargin = (json['bottomMargin'] as num).toDouble()
  ..leftMargin = (json['leftMargin'] as num).toDouble()
  ..rightMargin = (json['rightMargin'] as num).toDouble()
  ..headerMargin = (json['headerMargin'] as num?)?.toDouble()
  ..footerMargin = (json['footerMargin'] as num?)?.toDouble()
  ..firstRange = (json['firstRange'] as num).toInt()
  ..lastRange = (json['lastRange'] as num).toInt()
  ..footerFirst = const XmlElementConverter().fromJson(
    json['footerFirst'] as String?,
  )
  ..footerEven = const XmlElementConverter().fromJson(
    json['footerEven'] as String?,
  )
  ..footerOdd = const XmlElementConverter().fromJson(
    json['footerOdd'] as String?,
  )
  ..footerDefault = const XmlElementConverter().fromJson(
    json['footerDefault'] as String?,
  )
  ..footerFirstPath = json['footerFirstPath'] as String?
  ..footerEvenPath = json['footerEvenPath'] as String?
  ..footerOddPath = json['footerOddPath'] as String?
  ..footerDefaultPath = json['footerDefaultPath'] as String?
  ..pgNumFmt = json['pgNumFmt'] as String?
  ..pgNumStart = (json['pgNumStart'] as num?)?.toInt()
  ..pgNumChapSep = json['pgNumChapSep'] as String?
  ..headerFirst = const XmlElementConverter().fromJson(
    json['headerFirst'] as String?,
  )
  ..headerEven = const XmlElementConverter().fromJson(
    json['headerEven'] as String?,
  )
  ..headerOdd = const XmlElementConverter().fromJson(
    json['headerOdd'] as String?,
  )
  ..headerDefault = const XmlElementConverter().fromJson(
    json['headerDefault'] as String?,
  )
  ..headerFirstPath = json['headerFirstPath'] as String?
  ..headerEvenPath = json['headerEvenPath'] as String?
  ..headerOddPath = json['headerOddPath'] as String?
  ..headerDefaultPath = json['headerDefaultPath'] as String?
  ..sectPrElement = const XmlElementConverter().fromJson(
    json['sectPrElement'] as String?,
  );

Map<String, dynamic> _$SectPrToJson(SectPr instance) => <String, dynamic>{
  'width': instance.width,
  'height': instance.height,
  'topMargin': instance.topMargin,
  'bottomMargin': instance.bottomMargin,
  'leftMargin': instance.leftMargin,
  'rightMargin': instance.rightMargin,
  'headerMargin': instance.headerMargin,
  'footerMargin': instance.footerMargin,
  'firstRange': instance.firstRange,
  'lastRange': instance.lastRange,
  'footerFirst': const XmlElementConverter().toJson(instance.footerFirst),
  'footerEven': const XmlElementConverter().toJson(instance.footerEven),
  'footerOdd': const XmlElementConverter().toJson(instance.footerOdd),
  'footerDefault': const XmlElementConverter().toJson(instance.footerDefault),
  'footerFirstPath': instance.footerFirstPath,
  'footerEvenPath': instance.footerEvenPath,
  'footerOddPath': instance.footerOddPath,
  'footerDefaultPath': instance.footerDefaultPath,
  'pgNumFmt': instance.pgNumFmt,
  'pgNumStart': instance.pgNumStart,
  'pgNumChapSep': instance.pgNumChapSep,
  'headerFirst': const XmlElementConverter().toJson(instance.headerFirst),
  'headerEven': const XmlElementConverter().toJson(instance.headerEven),
  'headerOdd': const XmlElementConverter().toJson(instance.headerOdd),
  'headerDefault': const XmlElementConverter().toJson(instance.headerDefault),
  'headerFirstPath': instance.headerFirstPath,
  'headerEvenPath': instance.headerEvenPath,
  'headerOddPath': instance.headerOddPath,
  'headerDefaultPath': instance.headerDefaultPath,
  'sectPrElement': const XmlElementConverter().toJson(instance.sectPrElement),
};
