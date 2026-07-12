/// VectorShapeWidget - عرض أشكال Vector باستخدام CustomPainter
///
/// هذا الملف مسؤول عن:
/// 1. عرض Flutter Path objects كـ widgets
/// 2. دعم التعبئة والحدود بألوان مختلفة
/// 3. التكامل مع نظام الصور الحالي
///
/// الاستخدام:
/// ```dart
/// VectorShapeWidget(
///   path: myPath,
///   width: 200,
///   height: 50,
///   fillColor: Colors.black,
///   strokeColor: Colors.grey,
///   strokeWidth: 1.0,
/// )
/// ```

import 'package:flutter/material.dart';

/// Widget لعرض Vector Shape
class VectorShapeWidget extends StatelessWidget {
  /// المسار المراد رسمه
  final Path path;

  /// عرض الـ Widget
  final double width;

  /// ارتفاع الـ Widget
  final double height;

  /// لون التعبئة (اختياري)
  final Color? fillColor;

  /// لون الحدود (اختياري)
  final Color? strokeColor;

  /// سمك الحدود
  final double strokeWidth;

  const VectorShapeWidget({
    super.key,
    required this.path,
    required this.width,
    required this.height,
    this.fillColor,
    this.strokeColor,
    this.strokeWidth = 1.0,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width,
      height: height,
      child: CustomPaint(
        size: Size(width, height),
        painter: _VectorShapePainter(
          path: path,
          fillColor: fillColor,
          strokeColor: strokeColor,
          strokeWidth: strokeWidth,
        ),
      ),
    );
  }
}

/// CustomPainter لرسم المسار
class _VectorShapePainter extends CustomPainter {
  final Path path;
  final Color? fillColor;
  final Color? strokeColor;
  final double strokeWidth;

  _VectorShapePainter({
    required this.path,
    this.fillColor,
    this.strokeColor,
    this.strokeWidth = 1.0,
  });

  @override
  void paint(Canvas canvas, Size size) {
    // رسم التعبئة أولاً (إذا وجدت)
    if (fillColor != null) {
      final fillPaint = Paint()
        ..color = fillColor!
        ..style = PaintingStyle.fill;
      canvas.drawPath(path, fillPaint);
    }

    // رسم الحدود فوق التعبئة (إذا وجدت)
    if (strokeColor != null) {
      final strokePaint = Paint()
        ..color = strokeColor!
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round;
      canvas.drawPath(path, strokePaint);
    }
  }

  @override
  bool shouldRepaint(covariant _VectorShapePainter oldDelegate) {
    // إعادة الرسم فقط إذا تغيرت الخصائص
    return oldDelegate.path != path ||
        oldDelegate.fillColor != fillColor ||
        oldDelegate.strokeColor != strokeColor ||
        oldDelegate.strokeWidth != strokeWidth;
  }
}

/// بيانات شكل Vector (للتخزين والتمرير)
class VectorShapeData {
  /// المسار المحول
  final Path path;

  /// العرض المستهدف
  final double width;

  /// الارتفاع المستهدف
  final double height;

  /// لون التعبئة (من a:solidFill)
  final Color? fillColor;

  /// لون الحدود (من a:ln)
  final Color? strokeColor;

  /// سمك الحدود
  final double strokeWidth;

  /// الموقع الأفقي
  final double posX;

  /// الموقع العمودي
  final double posY;

  VectorShapeData({
    required this.path,
    required this.width,
    required this.height,
    this.fillColor,
    this.strokeColor,
    this.strokeWidth = 1.0,
    this.posX = 0,
    this.posY = 0,
  });

  /// إنشاء Widget من البيانات
  Widget toWidget() {
    return VectorShapeWidget(
      path: path,
      width: width,
      height: height,
      fillColor: fillColor,
      strokeColor: strokeColor,
      strokeWidth: strokeWidth,
    );
  }
}
