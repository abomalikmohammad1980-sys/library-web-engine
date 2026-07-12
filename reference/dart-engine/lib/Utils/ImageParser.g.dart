// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'ImageParser.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

ImageData _$ImageDataFromJson(Map<String, dynamic> json) => ImageData()
  ..rId = json['rId'] as String
  ..width = (json['width'] as num).toDouble()
  ..height = (json['height'] as num).toDouble()
  ..posX = (json['posX'] as num).toDouble()
  ..alignH = json['alignH'] as String
  ..alingV = json['alingV'] as String
  ..relativeHeight = (json['relativeHeight'] as num).toDouble()
  ..rotation = (json['rotation'] as num?)?.toDouble() ?? 0
  ..behindDoc = json['behindDoc'] as bool? ?? false
  ..flipH = json['flipH'] as bool? ?? false
  ..flipV = json['flipV'] as bool? ?? false
  ..posY = (json['posY'] as num).toDouble()
  ..relativeFromH = json['relativeFromH'] as String
  ..relativeFromV = json['relativeFromV'] as String
  ..wrapMode = json['wrapMode'] as String?
  ..imageMemory = uint8ListFromJson(json['imageMemory'] as String?)
  ..textBoxText = json['textBoxText'] as String?
  ..textColor = json['textColor'] as String?
  ..textSize = (json['textSize'] as num?)?.toDouble()
  ..fontFamily = json['fontFamily'] as String?
  ..containsPageField = json['containsPageField'] as bool? ?? false
  ..hyperlinkUrl = json['hyperlinkUrl'] as String?
  ..isStretched = json['isStretched'] as bool? ?? false
  ..cropLeft = (json['cropLeft'] as num?)?.toDouble() ?? 0
  ..cropTop = (json['cropTop'] as num?)?.toDouble() ?? 0
  ..cropRight = (json['cropRight'] as num?)?.toDouble() ?? 0
  ..cropBottom = (json['cropBottom'] as num?)?.toDouble() ?? 0
  ..isGroup = json['isGroup'] as bool? ?? false
  ..isVectorShape = json['isVectorShape'] as bool? ?? false;

Map<String, dynamic> _$ImageDataToJson(ImageData instance) => <String, dynamic>{
  'rId': instance.rId,
  'width': instance.width,
  'height': instance.height,
  'posX': instance.posX,
  'alignH': instance.alignH,
  'alingV': instance.alingV,
  'relativeHeight': instance.relativeHeight,
  'rotation': instance.rotation,
  'behindDoc': instance.behindDoc,
  'flipH': instance.flipH,
  'flipV': instance.flipV,
  'posY': instance.posY,
  'relativeFromH': instance.relativeFromH,
  'relativeFromV': instance.relativeFromV,
  'wrapMode': instance.wrapMode,
  'imageMemory': uint8ListToJson(instance.imageMemory),
  'textBoxText': instance.textBoxText,
  'textColor': instance.textColor,
  'textSize': instance.textSize,
  'fontFamily': instance.fontFamily,
  'containsPageField': instance.containsPageField,
  'hyperlinkUrl': instance.hyperlinkUrl,
  'isStretched': instance.isStretched,
  'cropLeft': instance.cropLeft,
  'cropTop': instance.cropTop,
  'cropRight': instance.cropRight,
  'cropBottom': instance.cropBottom,
  'isGroup': instance.isGroup,
  'isVectorShape': instance.isVectorShape,
};
