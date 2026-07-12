// كلاس AbstractNum لتمثيل تعريف الترقيم في مستند Word
import 'package:json_annotation/json_annotation.dart';
import 'package:xml/xml.dart';

import '../Models/WordDocument.dart';
import 'RPr.dart';

part 'abstractNum.g.dart';

@JsonSerializable(explicitToJson: true)
class AbstractNum {
  final int abstractNumId; // معرف الترقيم
   Map<int, Level>
      levelsMap; // قائمة من الكائنات Level التي تمثل مستويات القائمة

  // مُنشئ الكلاس الذي يأخذ المعرف وقائمة المستويات
  AbstractNum({required this.abstractNumId, required this.levelsMap});

  AbstractNum.empty() : abstractNumId = 0, levelsMap = {};

  factory AbstractNum.fromJson(Map<String, dynamic> json) => _$AbstractNumFromJson(json);
  Map<String, dynamic> toJson() => _$AbstractNumToJson(this);

  static AbstractNum fromMap(Map<String, dynamic> json) {
    final abstractNum = _$AbstractNumFromJson(json);
    abstractNum.levelsMap = (json['levelsMap'] as Map<String, dynamic>).map(
            (k, e) => MapEntry(int.parse(k), Level.fromMap(e as Map<String, dynamic>)));
    return abstractNum;
  }

  // ميثود لتحويل عنصر XML إلى كائن Dart من نوع AbstractNum
  factory AbstractNum.fromXml(XmlElement xml, {WordDocument? wordDocument}) {
    // استخراج معرف الترقيم من السمة w:abstractNumId
    final abstractNumId = int.parse(xml.getAttribute('w:abstractNumId') ?? '0');
    // استخراج مستويات القائمة من عناصر w:lvl

    Map<int, Level> levelsMap = {};
    xml.findElements('w:lvl').forEach((lvlXml) {
      Level level = Level.fromXml(lvlXml, wordDocument: wordDocument);
      levelsMap[level.ilvl] = level;
    });
    // إنشاء كائن AbstractNum باستخدام المعرف وقائمة المستويات
    return AbstractNum(
      abstractNumId: abstractNumId,
      levelsMap: levelsMap,
    );
  }
}

// كلاس Level لتمثيل مستوى فردي في قائمة الترقيم
@JsonSerializable(explicitToJson: true)
class Level {
  final int
      ilvl; // مستوى القائمة (0 يمثل المستوى الأول، 1 يمثل المستوى الثاني، إلخ)
  final int startVal; // قيمة البداية للترقيم في هذا المستوى
  final String numFmt; // تنسيق الترقيم (مثل: decimal، roman، إلخ)
  final String lvlText; // النص المرتبط بالتنقيط (مثل: %1، %2، إلخ)
  final String lvlJc; // المحاذاة الأفقية للنص في المستوى
  final String? suff; // ما بين رمز الترقيم ونص الفقرة: tab/space/nothing
  final int indentLeft; // المسافة البادئة اليسرى للمستوى
  final int indentHanging; // المسافة المعلقة للمستوى
  final String? fontFamily; // خط الرمز المخصص للترقيم
  final String? color; // لون رقم الترقيم
  final String? highlightColor; // خلفية رقم الترقيم

  // مُنشئ الكلاس الذي يأخذ جميع الخصائص كمدخلات
  Level({
    required this.ilvl,
    required this.startVal,
    required this.numFmt,
    required this.lvlText,
    required this.lvlJc,
    required this.suff,
    required this.indentLeft,
    required this.indentHanging,
    this.fontFamily,
    this.color,
    this.highlightColor,
  });

  Level.empty()
      : ilvl = 0,
        startVal = 0,
        numFmt = '',
        lvlText = '',
        lvlJc = '',
        suff = 'tab',
        indentLeft = 0,
        indentHanging = 0,
        fontFamily = null,
        color = null,
        highlightColor = null;

  // Override fromJson/toJson لمعالجة fontFamily يدوياً
  factory Level.fromJson(Map<String, dynamic> json) {
    return Level(
      ilvl: (json['ilvl'] as num).toInt(),
      startVal: (json['startVal'] as num).toInt(),
      numFmt: json['numFmt'] as String,
      lvlText: json['lvlText'] as String,
      lvlJc: json['lvlJc'] as String,
      suff: json['suff'] as String? ?? 'tab',
      indentLeft: (json['indentLeft'] as num).toInt(),
      indentHanging: (json['indentHanging'] as num).toInt(),
      fontFamily: json['fontFamily'] as String?,
      color: json['color'] as String?,
      highlightColor: json['highlightColor'] as String?,
    );
  }
  
  Map<String, dynamic> toJson() {
    final json = <String, dynamic>{
      'ilvl': ilvl,
      'startVal': startVal,
      'numFmt': numFmt,
      'lvlText': lvlText,
      'lvlJc': lvlJc,
      'suff': suff,
      'indentLeft': indentLeft,
      'indentHanging': indentHanging,
    };
    if (fontFamily != null) json['fontFamily'] = fontFamily;
    if (color != null) json['color'] = color;
    if (highlightColor != null) json['highlightColor'] = highlightColor;
    return json;
  }

  static Level fromMap(Map<String, dynamic> json) {
    return Level(
      ilvl: (json['ilvl'] as num).toInt(),
      startVal: (json['startVal'] as num).toInt(),
      numFmt: json['numFmt'] as String,
      lvlText: json['lvlText'] as String,
      lvlJc: json['lvlJc'] as String,
      suff: json['suff'] as String? ?? 'tab',
      indentLeft: (json['indentLeft'] as num).toInt(),
      indentHanging: (json['indentHanging'] as num).toInt(),
      fontFamily: json['fontFamily'] as String?,
      color: json['color'] as String?,
      highlightColor: json['highlightColor'] as String?,
    );
  }

  // ميثود لتحويل عنصر XML إلى كائن Dart من نوع Level
  factory Level.fromXml(XmlElement xml, {WordDocument? wordDocument}) {
    // استخراج قيمة مستوى القائمة من السمة w:ilvl
    final ilvl = int.parse(xml.getAttribute('w:ilvl') ?? '0');

    // استخراج قيمة بداية الترقيم من عنصر w:start
    final startVal = int.parse(
        xml.findElements('w:start').firstOrNull?.getAttribute('w:val') ?? '0');

    // استخراج تنسيق الترقيم من عنصر w:numFmt
    final numFmt =
        xml.findElements('w:numFmt').first.getAttribute('w:val') ?? '';

    // استخراج النص المرتبط بالتنقيط من عنصر w:lvlText
    final lvlText =
        xml.findElements('w:lvlText').first.getAttribute('w:val') ?? '';

    // استخراج المحاذاة الأفقية من عنصر w:lvlJc
    final lvlJc = xml.findElements('w:lvlJc').first.getAttribute('w:val') ?? '';

    // إذا غاب suff فالقيمة الافتراضية في OOXML هي tab
    final suff =
        xml.findElements('w:suff').firstOrNull?.getAttribute('w:val') ?? 'tab';

    // استخراج المسافة البادئة اليسرى من عنصر w:ind
    final indentLeft = int.parse(
        xml.getElement("w:pPr")?.getElement('w:ind')?.getAttribute('w:left') ??
            '0');
    // استخراج المسافة المعلقة من عنصر w:ind
    final indentHanging = int.parse(xml
            .getElement("w:pPr")
            ?.getElement('w:ind')
            ?.getAttribute('w:hanging') ??
        '0');
    
    // استخراج خصائص النص (الخط/الألوان) من w:rPr
    String? fontFamily;
    String? color;
    String? highlightColor;
    final rPr = xml.getElement("w:rPr");
    if (rPr != null) {
      final rFonts = rPr.getElement("w:rFonts");
      if (rFonts != null) {
        // نفضل w:hAnsi أو w:ascii على w:cs
        fontFamily = rFonts.getAttribute("w:hAnsi") ?? 
                     rFonts.getAttribute("w:ascii") ?? 
                     rFonts.getAttribute("w:cs");
      }

      // حل لون التيمة أولاً، ثم الـ fallback على w:val
      final colorElem = rPr.getElement("w:color");
      color = colorElem?.getAttribute("w:val");
      if (wordDocument != null && colorElem != null) {
        String? themeColorName = colorElem.getAttribute("w:themeColor");
        if (themeColorName != null) {
          String? resolved = resolveThemeColor(
            wordDocument.themeColors,
            themeColorName,
            colorElem.getAttribute("w:themeTint"),
            colorElem.getAttribute("w:themeShade"),
          );
          if (resolved != null) color = resolved;
        }
      }

      highlightColor = rPr.getElement("w:highlight")?.getAttribute("w:val");
      // حل لون التيمة للخلفية
      if (highlightColor == null) {
        final shdElem = rPr.getElement("w:shd");
        if (shdElem != null) {
          if (wordDocument != null) {
            String? themeFill = shdElem.getAttribute("w:themeFill");
            if (themeFill != null) {
              String? resolved = resolveThemeColor(
                wordDocument.themeColors,
                themeFill,
                shdElem.getAttribute("w:themeFillTint"),
                shdElem.getAttribute("w:themeFillShade"),
              );
              if (resolved != null) highlightColor = resolved;
            }
          }
          highlightColor ??= shdElem.getAttribute("w:fill");
        }
      }
    }
    
    // إنشاء كائن Level باستخدام القيم المستخرجة
    return Level(
      ilvl: ilvl,
      startVal: startVal,
      numFmt: numFmt,
      lvlText: lvlText,
      lvlJc: lvlJc,
      suff: suff,
      indentLeft: indentLeft,
      indentHanging: indentHanging,
      fontFamily: fontFamily,
      color: color,
      highlightColor: highlightColor,
    );
  }
}
