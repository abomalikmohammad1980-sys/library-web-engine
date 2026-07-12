import 'package:flutter/material.dart';

/// يحوّل قيمة VML `dashstyle` إلى نمط أرقام `[dash, gap, …]`
/// يمكن لـ CustomPainter استخدامه لرسم خطوط متقطعة.
///
/// يدعم:
/// - الأنماط الرقمية مثل `"1 1"` أو `"4 2 1 2"`
/// - الأنماط المسماة: `dash`, `shortdash`, `dot`, `shortdot`, `dashdot`
///
/// عند وجود `StrokeCap.round` أو `StrokeCap.square` يعوّض النمط
/// لأن الغطاء يمد كل قطعة بـ `strokeWidth/2` من كل جهة.
class VmlDashPatternResolver {
  const VmlDashPatternResolver._();

  /// يحوّل سلسلة VML dashstyle إلى قائمة أطوال `[dash, gap, dash, gap, …]`
  /// أو `null` إذا لم يكن هناك نمط (خط متصل).
  static List<double>? resolve(
    String? dashStyle,
    double strokeWidth,
    StrokeCap cap,
  ) {
    final normalized = dashStyle?.trim().toLowerCase();
    if (normalized == null || normalized.isEmpty) return null;

    // محاولة تحليل أنماط رقمية مثل "1 1" أو "4 2 1 2"
    final numericParts = normalized
        .split(RegExp(r'\s+'))
        .map((e) => double.tryParse(e))
        .whereType<double>()
        .toList();

    if (numericParts.length >= 2) {
      return _resolveNumericPattern(numericParts, strokeWidth, cap);
    }

    // أنماط مسماة
    return _resolveNamedPattern(normalized, strokeWidth, cap);
  }

  /// معالجة الأنماط الرقمية
  static List<double> _resolveNumericPattern(
    List<double> parts,
    double strokeWidth,
    StrokeCap cap,
  ) {
    final unit = strokeWidth <= 0 ? 1.0 : strokeWidth;

    // نمط ثنائي بسيط: dash gap
    if (parts.length == 2) {
      final dashLen = parts[0] * unit;
      final gapLen = parts[1] * unit;
      return _compensateForCap([dashLen, gapLen], strokeWidth, cap);
    }

    // أنماط أطول: نطبّق الوحدة ثم نعوّض للغطاء
    final pattern = parts.map((p) => p * unit).toList();
    return _compensateForCap(pattern, strokeWidth, cap);
  }

  /// أنماط VML المسماة حسب المواصفة
  static List<double>? _resolveNamedPattern(
    String name,
    double strokeWidth,
    StrokeCap cap,
  ) {
    List<double> pattern;
    switch (name) {
      case 'dash':
      case 'shortdash':
        pattern = [strokeWidth * 3, strokeWidth * 2];
        break;
      case 'dot':
      case 'shortdot':
        pattern = [strokeWidth, strokeWidth * 1.5];
        break;
      case 'dashdot':
        pattern = [strokeWidth * 3, strokeWidth * 1.5, strokeWidth, strokeWidth * 1.5];
        break;
      default:
        return null;
    }
    return _compensateForCap(pattern, strokeWidth, cap);
  }

  /// عندما يكون الغطاء round أو square يمد كل قطعة مرسومة
  /// بـ `strokeWidth/2` من كل جهة، فيجب تقصير القطعة
  /// وتوسيع الفراغ ليعود المظهر البصري مطابقًا لقصد VML.
  static List<double> _compensateForCap(
    List<double> pattern,
    double strokeWidth,
    StrokeCap cap,
  ) {
    if (cap != StrokeCap.round && cap != StrokeCap.square) {
      return pattern;
    }
    final extension = strokeWidth / 2;
    return List.generate(pattern.length, (i) {
      final v = pattern[i];
      // العناصر الزوجية = قطع مرسومة (تُقصّر)، الفردية = فراغات (تُوسّع)
      if (i.isEven) {
        return (v - extension * 2).clamp(strokeWidth * 0.5, double.infinity);
      } else {
        return v + extension * 2;
      }
    });
  }
}

/// يحوّل قيمة VML `endcap` إلى Flutter `StrokeCap`.
///
/// الافتراضي في VML هو `flat` (= `StrokeCap.butt`)، لا `round`.
class VmlStrokeCapResolver {
  const VmlStrokeCapResolver._();

  static StrokeCap resolve(String? endCap) {
    switch (endCap?.trim().toLowerCase()) {
      case 'flat':
        return StrokeCap.butt;
      case 'square':
        return StrokeCap.square;
      case 'round':
        return StrokeCap.round;
      default:
        // VML default is flat (butt)
        return StrokeCap.butt;
    }
  }
}
