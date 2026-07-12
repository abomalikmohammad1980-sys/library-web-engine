import 'package:flutter/material.dart';
import 'package:golden_shamela/Models/VmlFillStyle.dart';
import 'package:golden_shamela/Models/VmlShadowStyle.dart';
import 'package:xml/xml.dart';

/// بيانات شكل VML مخصصة (كالخطوط والمستطيلات وعناصر TextBox)
class VmlShapeData {
  /// نوع الشكل (مثال: line, roundrect, oval, rect)
  final String shapeType;

  /// سمك خط الحدود (بـ points)
  double strokeWidth;

  /// لون خط الحدود (strokecolor) كقيمة رقمية أو نصية
  int? strokeColorInt;

  /// لون التعبئة (fillcolor) كقيمة رقمية أو نصية
  int? fillColorInt;

  /// هل يحتوي على تعبئة
  bool isFilled;

  /// هل يحتوي على خطوط حدود
  bool isStroked;

  /// قيمة Arc بالنسبة للمستطيل ذو الزوايا الدائرية (roundrect)
  double arcSize;

  /// الـ XML الخام الخاص بالنص (للحفظ والاسترجاع من JSON Cache)
  String? textBoxXmlString;

  /// قيمة inset الخام من v:textbox إن وجدت
  String? textBoxInset;

  /// Insets محسوبة مسبقًا بالـ logical pixels عندما تأتي من DrawingML
  /// مثل `wps:bodyPr lIns/tIns/rIns/bIns`.
  List<double>? textBoxInsetPx;

  /// DrawingML `a:noAutofit` داخل `wps:bodyPr`
  bool textNoAutofit;

  /// نمط VML للحدود/الخطوط مثل dashstyle="1 1"
  String? strokeDashStyle;

  /// نمط نهاية الخط من v:stroke@endcap (flat/square/round)
  String? strokeEndCap;

  VmlFillStyle? fillStyle;

  VmlShadowStyle? shadowStyle;

  VmlShapeData({
    required this.shapeType,
    this.strokeWidth = 1.0,
    this.strokeColorInt,
    this.fillColorInt,
    this.isFilled = true,
    this.isStroked = true,
    this.arcSize = 0.2,
    this.textBoxXmlString,
    this.textBoxInset,
    this.textBoxInsetPx,
    this.textNoAutofit = false,
    this.strokeDashStyle,
    this.strokeEndCap,
    this.fillStyle,
    this.shadowStyle,
  });

  // Getters for Colors
  Color? get strokeColor => strokeColorInt != null ? Color(strokeColorInt!) : null;
  Color? get fillColor => fillColorInt != null ? Color(fillColorInt!) : null;

  // Setter/Getter for XML Element (Transient, generated on the fly)
  XmlElement? get textBoxElement {
    if (textBoxXmlString == null || textBoxXmlString!.isEmpty) return null;
    try {
      return XmlDocument.parse(textBoxXmlString!).rootElement;
    } catch (e) {
      return null;
    }
  }

  set textBoxElement(XmlElement? element) {
    if (element == null) {
      textBoxXmlString = null;
    } else {
      textBoxXmlString = element.toXmlString();
    }
  }

  // Setters for colors from Color objects
  set strokeColor(Color? color) => strokeColorInt = color?.value;
  set fillColor(Color? color) => fillColorInt = color?.value;

  // JSON Serialization (Manual since it's simple and avoids build_runner)
  factory VmlShapeData.fromJson(Map<String, dynamic> json) {
    return VmlShapeData(
      shapeType: json['shapeType'] as String,
      strokeWidth: (json['strokeWidth'] as num?)?.toDouble() ?? 1.0,
      strokeColorInt: json['strokeColorInt'] as int?,
      fillColorInt: json['fillColorInt'] as int?,
      isFilled: json['isFilled'] as bool? ?? true,
      isStroked: json['isStroked'] as bool? ?? true,
      arcSize: (json['arcSize'] as num?)?.toDouble() ?? 0.2,
      textBoxXmlString: json['textBoxXmlString'] as String?,
      textBoxInset: json['textBoxInset'] as String?,
      textBoxInsetPx: (json['textBoxInsetPx'] as List<dynamic>?)
          ?.map((e) => (e as num).toDouble())
          .toList(),
      textNoAutofit: json['textNoAutofit'] as bool? ?? false,
      strokeDashStyle: json['strokeDashStyle'] as String?,
      strokeEndCap: json['strokeEndCap'] as String?,
      fillStyle: json['fillStyle'] is Map<String, dynamic>
          ? VmlFillStyle.fromJson(json['fillStyle'] as Map<String, dynamic>)
          : null,
      shadowStyle: json['shadowStyle'] is Map<String, dynamic>
          ? VmlShadowStyle.fromJson(json['shadowStyle'] as Map<String, dynamic>)
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'shapeType': shapeType,
      'strokeWidth': strokeWidth,
      'strokeColorInt': strokeColorInt,
      'fillColorInt': fillColorInt,
      'isFilled': isFilled,
      'isStroked': isStroked,
      'arcSize': arcSize,
      'textBoxXmlString': textBoxXmlString,
      'textBoxInset': textBoxInset,
      'textBoxInsetPx': textBoxInsetPx,
      'textNoAutofit': textNoAutofit,
      'strokeDashStyle': strokeDashStyle,
      'strokeEndCap': strokeEndCap,
      'fillStyle': fillStyle?.toJson(),
      'shadowStyle': shadowStyle?.toJson(),
    };
  }
}
