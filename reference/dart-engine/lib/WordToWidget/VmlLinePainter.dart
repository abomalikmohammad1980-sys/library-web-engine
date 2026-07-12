import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:golden_shamela/WordToWidget/VmlDashPatternResolver.dart';

/// رسّام خطوط VML المخصص.
///
/// يرسم خطًا مستقيمًا (أفقيًا أو قطريًا) مع دعم:
/// - نمط الخط المتقطع (`dashstyle`) مثل `"1 1"` أو `"dash"`
/// - نوع نهاية الخط (`endcap`) مثل `round` أو `flat`
///
/// يُستخدم داخل `CustomPaint` في `VmlRendererWidget` عند
/// كون نوع الشكل `line`.
class VmlLinePainter extends CustomPainter {
  /// لون الخط
  final Color color;

  /// سمك الخط بالنقاط
  final double strokeWidth;

  /// نمط التقطيع الخام من VML (مثل `"1 1"` أو `"dash"`)
  final String? dashStyle;

  /// نوع نهاية الخط الخام من VML (مثل `"round"` أو `"flat"`)
  final String? endCap;

  VmlLinePainter({
    required this.color,
    required this.strokeWidth,
    this.dashStyle,
    this.endCap,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final effectiveCap = VmlStrokeCapResolver.resolve(endCap);
    final paint = Paint()
      ..color = color
      ..strokeWidth = strokeWidth
      ..strokeCap = effectiveCap
      ..style = PaintingStyle.stroke;

    final syntheticZeroHeightBox = size.height == 8.0;
    final lineY = syntheticZeroHeightBox ? strokeWidth / 2 : 0.0;

    final start = Offset(0, lineY);
    final end = Offset(
      size.width,
      syntheticZeroHeightBox ? lineY : size.height,
    );

    final dashPattern = VmlDashPatternResolver.resolve(
      dashStyle,
      strokeWidth,
      effectiveCap,
    );
    if (dashPattern == null) {
      canvas.drawLine(start, end, paint);
      return;
    }

    _drawDashedLine(canvas, paint, start, end, dashPattern);
  }

  /// رسم خط متقطع بتكرار نمط `[dash, gap, dash, gap, …]`
  void _drawDashedLine(
    Canvas canvas,
    Paint paint,
    Offset start,
    Offset end,
    List<double> pattern,
  ) {
    final dx = end.dx - start.dx;
    final dy = end.dy - start.dy;
    final distance = math.sqrt(dx * dx + dy * dy);
    if (distance == 0) return;

    final ux = dx / distance;
    final uy = dy / distance;
    double travelled = 0;
    int patternIndex = 0;
    bool draw = true;

    while (travelled < distance) {
      final segmentLength = pattern[patternIndex % pattern.length];
      final next = (travelled + segmentLength).clamp(0.0, distance).toDouble();
      if (draw) {
        final segmentStart = Offset(start.dx + ux * travelled, start.dy + uy * travelled);
        final segmentEnd = Offset(start.dx + ux * next, start.dy + uy * next);
        canvas.drawLine(segmentStart, segmentEnd, paint);
      }
      travelled = next;
      patternIndex++;
      draw = !draw;
    }
  }

  @override
  bool shouldRepaint(covariant VmlLinePainter oldDelegate) {
    return oldDelegate.color != color ||
        oldDelegate.strokeWidth != strokeWidth ||
        oldDelegate.dashStyle != dashStyle ||
        oldDelegate.endCap != endCap;
  }
}
