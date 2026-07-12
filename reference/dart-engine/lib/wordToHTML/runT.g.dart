// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'runT.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

runT _$runTFromJson(Map<String, dynamic> json) => runT.empty()
  ..prPr = json['prPr'] == null
      ? null
      : RPr.fromJson(json['prPr'] as Map<String, dynamic>)
  ..pPr = json['pPr'] == null
      ? null
      : PPr.fromJson(json['pPr'] as Map<String, dynamic>)
  ..text = json['text'] as String?
  ..rpr = json['rpr'] == null
      ? null
      : RPr.fromJson(json['rpr'] as Map<String, dynamic>)
  ..hasBrBefore = json['hasBrBefore'] as bool
  ..hasBrAfter = json['hasBrAfter'] as bool
  ..footNoteId = json['footNoteId'] as String?
  ..fnDisplayNum = json['fnDisplayNum'] as String?
  ..image = json['image'] == null
      ? null
      : ImageData.fromJson(json['image'] as Map<String, dynamic>)
  ..toc = json['toc'] as String?
  ..hasTab = json['hasTab'] as bool
  ..hasPositionalTab = json['hasPositionalTab'] as bool? ?? false
  ..positionalTabAlignment = json['positionalTabAlignment'] as String?
  ..positionalTabRelativeTo = json['positionalTabRelativeTo'] as String?
  ..hasExplicitRunDirection = json['hasExplicitRunDirection'] as bool? ?? false
  ..isFootnoteRef = json['isFootnoteRef'] as bool;

Map<String, dynamic> _$runTToJson(runT instance) => <String, dynamic>{
  'prPr': instance.prPr?.toJson(),
  'pPr': instance.pPr?.toJson(),
  'text': instance.text,
  'rpr': instance.rpr?.toJson(),
  'hasBrBefore': instance.hasBrBefore,
  'hasBrAfter': instance.hasBrAfter,
  'footNoteId': instance.footNoteId,
  'fnDisplayNum': instance.fnDisplayNum,
  'image': instance.image?.toJson(),
  'toc': instance.toc,
  'hasTab': instance.hasTab,
  'hasPositionalTab': instance.hasPositionalTab,
  'positionalTabAlignment': instance.positionalTabAlignment,
  'positionalTabRelativeTo': instance.positionalTabRelativeTo,
  'hasExplicitRunDirection': instance.hasExplicitRunDirection,
  'isFootnoteRef': instance.isFootnoteRef,
};
