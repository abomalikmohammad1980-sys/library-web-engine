// كلاس Num لتمثيل عنصر الترقيم (w:num) في مستند Word
import 'package:json_annotation/json_annotation.dart';
import 'package:xml/xml.dart';

import 'abstractNum.dart';

part 'Num.g.dart';

@JsonSerializable(explicitToJson: true)
class Num {
  final int numId; // معرف الترقيم
  final int abstractNumId; // معرف الترقيم المجرد المرتبط
   List<Override>
      overrides; // قائمة من الكائنات Override لتمثيل المستويات المخصصة

  // مُنشئ الكلاس الذي يأخذ المعرف وقائمة الاستبدالات (overrides)
  Num({
    required this.numId,
    required this.abstractNumId,
    required this.overrides,
  });

  Num.empty() : numId = 0, abstractNumId = 0, overrides = [];

  factory Num.fromJson(Map<String, dynamic> json) => _$NumFromJson(json);
  Map<String, dynamic> toJson() => _$NumToJson(this);

  static Num fromMap(Map<String, dynamic> json) {
    final num = _$NumFromJson(json);
    num.overrides = (json['overrides'] as List<dynamic>)
        .map((e) => Override.fromMap(e as Map<String, dynamic>))
        .toList();
    return num;
  }

  // ميثود لتحويل عنصر XML إلى كائن Dart من نوع Num
  factory Num.fromXml(XmlElement xml) {

    // استخراج معرف الترقيم من السمة w:numId
    final numId = int.parse(xml.getAttribute('w:numId') ?? '0');

    // استخراج معرف الترقيم المجرد من عنصر w:abstractNumId
    final abstractNumId = int.parse(
      xml.getElement('w:abstractNumId')?.getAttribute('w:val') ?? '0',
    );
    // استخراج المستويات المخصصة من عناصر w:lvlOverride
    final overrides = xml.findElements('w:lvlOverride').map((overrideXml) {
      return Override.fromXml(overrideXml);
    }).toList();

    // إنشاء كائن Num باستخدام القيم المستخرجة
    return Num(
      numId: numId,
      abstractNumId: abstractNumId,
      overrides: overrides,
    );
  }
}

// كلاس Override لتمثيل مستوى مخصص (Override) في قائمة الترقيم
@JsonSerializable(explicitToJson: true)
class Override {
  final int ilvl; // مستوى القائمة المخصص
  int? startOverride; // قيمة البداية المخصصة (إن وجدت)
  Level? level; // الكائن Level لتمثيل تفاصيل المستوى

  // مُنشئ الكلاس الذي يأخذ جميع الخصائص كمدخلات
  Override({
    required this.ilvl,
    this.startOverride,
    this.level,
  });

  Override.empty() : ilvl = 0;

  factory Override.fromJson(Map<String, dynamic> json) => _$OverrideFromJson(json);
  Map<String, dynamic> toJson() => _$OverrideToJson(this);

  static Override fromMap(Map<String, dynamic> json) {
    final override = _$OverrideFromJson(json);
    if (json['level'] != null) {
      override.level = Level.fromMap(json['level'] as Map<String, dynamic>);
    }
    return override;
  }

  // ميثود لتحويل عنصر XML إلى كائن Dart من نوع Override
  factory Override.fromXml(XmlElement xml) {
    // استخراج قيمة مستوى القائمة من السمة w:ilvl
    final ilvl = int.parse(xml.getAttribute('w:ilvl') ?? '0');

    // استخراج قيمة البداية المخصصة من عنصر w:startOverride (إن وجد)
    int? startOverride;
    if (xml.findElements('w:startOverride').isNotEmpty) {
      startOverride = int.parse(
          xml.findElements('w:startOverride').first.getAttribute('w:val') ??
              '0');
    }

    // استخراج الكائن Level من عنصر w:lvl (إن وجد)
    Level? level;
    if (xml.findElements('w:lvl').isNotEmpty) {
      level = Level.fromXml(xml.findElements('w:lvl').first);
    }

    // إنشاء كائن Override باستخدام القيم المستخرجة
    return Override(
      ilvl: ilvl,
      startOverride: startOverride,
      level: level,
    );
  }
}
