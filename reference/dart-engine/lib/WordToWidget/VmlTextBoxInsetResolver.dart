import 'package:flutter/material.dart';

/// يحوّل قيمة VML `inset` من `<v:textbox inset="…">` إلى `EdgeInsets`.
///
/// ترتيب VML: left, top, right, bottom (مثل CSS).
/// القيم المفقودة تسقط على الافتراضي: `0.1in, 0.05in, 0.1in, 0.05in`.
///
/// الوحدات المدعومة: `pt`, `px`, `in`, `cm`, `mm`.
class VmlTextBoxInsetResolver {
  const VmlTextBoxInsetResolver._();

  /// القيم الافتراضية حسب مواصفة VML
  static const _defaults = ['0.1in', '0.05in', '0.1in', '0.05in'];

  /// يحوّل سلسلة inset الخام إلى EdgeInsets
  static EdgeInsets resolve(String? rawInset) {
    if (rawInset == null || rawInset.trim().isEmpty) {
      return EdgeInsets.fromLTRB(
        _parseUnit(_defaults[0]),
        _parseUnit(_defaults[1]),
        _parseUnit(_defaults[2]),
        _parseUnit(_defaults[3]),
      );
    }

    final commaSeparated = rawInset.contains(',');
    final parts = commaSeparated
        ? rawInset.split(',').map((e) => e.trim()).toList()
        : rawInset
              .split(RegExp(r'\s+'))
              .map((e) => e.trim())
              .where((e) => e.isNotEmpty)
              .toList();

    String valueAt(int index) {
      if (index >= parts.length) return _defaults[index];
      final value = parts[index];
      return value.isEmpty ? _defaults[index] : value;
    }

    return EdgeInsets.fromLTRB(
      _parseUnit(valueAt(0)),
      _parseUnit(valueAt(1)),
      _parseUnit(valueAt(2)),
      _parseUnit(valueAt(3)),
    );
  }

  /// تحويل وحدة VML إلى بكسلات منطقية (96 DPI)
  static double _parseUnit(String value) {
    final normalized = value.trim().toLowerCase();
    if (normalized.isEmpty) return 0;
    if (normalized.endsWith('pt')) {
      return (double.tryParse(normalized.replaceAll('pt', '')) ?? 0) * 1.333;
    }
    if (normalized.endsWith('px')) {
      return double.tryParse(normalized.replaceAll('px', '')) ?? 0;
    }
    if (normalized.endsWith('in')) {
      return (double.tryParse(normalized.replaceAll('in', '')) ?? 0) * 96.0;
    }
    if (normalized.endsWith('cm')) {
      return (double.tryParse(normalized.replaceAll('cm', '')) ?? 0) *
          (96.0 / 2.54);
    }
    if (normalized.endsWith('mm')) {
      return (double.tryParse(normalized.replaceAll('mm', '')) ?? 0) *
          (96.0 / 25.4);
    }
    return double.tryParse(normalized) ?? 0;
  }
}
