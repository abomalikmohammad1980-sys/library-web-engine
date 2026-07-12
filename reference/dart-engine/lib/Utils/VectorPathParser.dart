/// VectorPathParser - تحويل مسارات OpenXML (a:path) إلى Flutter Path
///
/// هذا الملف مسؤول عن:
/// 1. تحليل عناصر a:path من XML
/// 2. تحويل أوامر الرسم (moveTo, lineTo, cubicBezTo, close) إلى Flutter Path
/// 3. تطبيق التحويلات (scaling) من نظام إحداثيات OpenXML إلى pixels
///
/// مثال على XML المدعوم:
/// ```xml
/// <a:path w="14767" h="1087">
///   <a:moveTo><a:pt x="100" y="200"/></a:moveTo>
///   <a:lnTo><a:pt x="300" y="200"/></a:lnTo>
///   <a:cubicBezTo>
///     <a:pt x="400" y="100"/>
///     <a:pt x="500" y="300"/>
///     <a:pt x="600" y="200"/>
///   </a:cubicBezTo>
///   <a:close/>
/// </a:path>
/// ```

import 'dart:ui';
import 'package:xml/xml.dart';

/// نتيجة تحليل مسار Vector
class VectorPathResult {
  /// المسار المحول إلى Flutter Path
  final Path path;

  /// عرض نظام الإحداثيات الأصلي (من a:path w="...")
  final double originalWidth;

  /// ارتفاع نظام الإحداثيات الأصلي (من a:path h="...")
  final double originalHeight;

  VectorPathResult({
    required this.path,
    required this.originalWidth,
    required this.originalHeight,
  });
}

/// محلل مسارات Vector من OpenXML
class VectorPathParser {
  /// تحليل عنصر a:custGeom واستخراج المسارات
  ///
  /// [custGeomElement] - عنصر <a:custGeom> من XML
  /// [targetWidth] - العرض المستهدف بالـ pixels (من wp:extent)
  /// [targetHeight] - الارتفاع المستهدف بالـ pixels
  ///
  /// يُرجع قائمة من VectorPathResult (قد يكون هناك أكثر من path)
  static List<VectorPathResult> parseCustomGeometry(
    XmlElement custGeomElement, {
    double? targetWidth,
    double? targetHeight,
  }) {
    List<VectorPathResult> results = [];

    // البحث عن a:pathLst
    final pathLst =
        custGeomElement.findAllElements('pathLst').firstOrNull ??
        custGeomElement.findAllElements('a:pathLst').firstOrNull;

    if (pathLst == null) return results;

    // تحليل كل a:path
    for (var pathElement in pathLst.childElements) {
      if (pathElement.name.local != 'path') continue;

      final result = _parseSinglePath(
        pathElement,
        targetWidth: targetWidth,
        targetHeight: targetHeight,
      );

      if (result != null) {
        results.add(result);
      }
    }

    return results;
  }

  /// تحليل عنصر a:path واحد
  static VectorPathResult? _parseSinglePath(
    XmlElement pathElement, {
    double? targetWidth,
    double? targetHeight,
  }) {
    // استخراج أبعاد نظام الإحداثيات الأصلي
    final originalWidth =
        double.tryParse(pathElement.getAttribute('w') ?? '') ?? 21600;
    final originalHeight =
        double.tryParse(pathElement.getAttribute('h') ?? '') ?? 21600;

    // حساب معاملات التحويل (scaling factors)
    final scaleX = targetWidth != null ? targetWidth / originalWidth : 1.0;
    final scaleY = targetHeight != null ? targetHeight / originalHeight : 1.0;

    // إنشاء Flutter Path
    final path = Path();

    // معالجة أوامر الرسم
    for (var command in pathElement.childElements) {
      switch (command.name.local) {
        case 'moveTo':
          _handleMoveTo(command, path, scaleX, scaleY);
          break;
        case 'lnTo':
          _handleLineTo(command, path, scaleX, scaleY);
          break;
        case 'cubicBezTo':
          _handleCubicBezTo(command, path, scaleX, scaleY);
          break;
        case 'quadBezTo':
          _handleQuadBezTo(command, path, scaleX, scaleY);
          break;
        case 'arcTo':
          _handleArcTo(command, path, scaleX, scaleY);
          break;
        case 'close':
          path.close();
          break;
      }
    }

    return VectorPathResult(
      path: path,
      originalWidth: originalWidth,
      originalHeight: originalHeight,
    );
  }

  /// معالجة أمر moveTo
  static void _handleMoveTo(
    XmlElement command,
    Path path,
    double scaleX,
    double scaleY,
  ) {
    final pt = _getFirstPoint(command);
    if (pt != null) {
      path.moveTo(pt.$1 * scaleX, pt.$2 * scaleY);
    }
  }

  /// معالجة أمر lnTo (خط مستقيم)
  static void _handleLineTo(
    XmlElement command,
    Path path,
    double scaleX,
    double scaleY,
  ) {
    final pt = _getFirstPoint(command);
    if (pt != null) {
      path.lineTo(pt.$1 * scaleX, pt.$2 * scaleY);
    }
  }

  /// معالجة أمر cubicBezTo (منحنى بيزيه مكعب)
  /// يحتاج 3 نقاط: نقطتي تحكم + نقطة النهاية
  static void _handleCubicBezTo(
    XmlElement command,
    Path path,
    double scaleX,
    double scaleY,
  ) {
    final points = _getAllPoints(command);
    if (points.length >= 3) {
      path.cubicTo(
        points[0].$1 * scaleX,
        points[0].$2 * scaleY,
        points[1].$1 * scaleX,
        points[1].$2 * scaleY,
        points[2].$1 * scaleX,
        points[2].$2 * scaleY,
      );
    }
  }

  /// معالجة أمر quadBezTo (منحنى بيزيه تربيعي)
  /// يحتاج نقطتين: نقطة تحكم + نقطة النهاية
  static void _handleQuadBezTo(
    XmlElement command,
    Path path,
    double scaleX,
    double scaleY,
  ) {
    final points = _getAllPoints(command);
    if (points.length >= 2) {
      path.quadraticBezierTo(
        points[0].$1 * scaleX,
        points[0].$2 * scaleY,
        points[1].$1 * scaleX,
        points[1].$2 * scaleY,
      );
    }
  }

  /// معالجة أمر arcTo (قوس)
  /// هذا تقريبي - OpenXML arcTo معقد ويحتاج تحويل خاص
  static void _handleArcTo(
    XmlElement command,
    Path path,
    double scaleX,
    double scaleY,
  ) {
    // arcTo في OpenXML يستخدم نظام مختلف (wR, hR, stAng, swAng)
    // هذا placeholder - التنفيذ الكامل معقد
    // حالياً نتجاهله أو نحوله إلى خط مستقيم كـ fallback

    final wR = double.tryParse(command.getAttribute('wR') ?? '') ?? 0;
    final hR = double.tryParse(command.getAttribute('hR') ?? '') ?? 0;

    // Fallback: لا نفعل شيئاً إذا كان القوس صغيراً
    if (wR < 1 && hR < 1) return;

    // TODO: تنفيذ تحويل arcTo الكامل إذا لزم الأمر
  }

  /// استخراج أول نقطة من عنصر الأمر
  static (double, double)? _getFirstPoint(XmlElement command) {
    final pt =
        command.findAllElements('pt').firstOrNull ??
        command.findAllElements('a:pt').firstOrNull;

    if (pt == null) return null;

    final x = double.tryParse(pt.getAttribute('x') ?? '') ?? 0;
    final y = double.tryParse(pt.getAttribute('y') ?? '') ?? 0;

    return (x, y);
  }

  /// استخراج جميع النقاط من عنصر الأمر
  static List<(double, double)> _getAllPoints(XmlElement command) {
    List<(double, double)> points = [];

    for (var pt in command.childElements) {
      if (pt.name.local == 'pt') {
        final x = double.tryParse(pt.getAttribute('x') ?? '') ?? 0;
        final y = double.tryParse(pt.getAttribute('y') ?? '') ?? 0;
        points.add((x, y));
      }
    }

    return points;
  }
}
