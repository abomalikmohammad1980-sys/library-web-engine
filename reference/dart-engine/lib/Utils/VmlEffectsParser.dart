import 'package:flutter/material.dart';
import 'package:golden_shamela/Models/VmlFillStyle.dart';
import 'package:golden_shamela/Models/VmlGradientStop.dart';
import 'package:golden_shamela/Models/VmlShadowStyle.dart';
import 'package:xml/xml.dart' as xml;

class VmlEffectsParser {
  const VmlEffectsParser._();

  static VmlFillStyle? parseFill(
    xml.XmlElement shape, {
    Color? fallbackColor,
  }) {
    final fillElement = shape.childElements.firstWhere(
      (e) => e.name.local.toLowerCase() == 'fill',
      orElse: () => xml.XmlElement(xml.XmlName('null')),
    );

    final fallbackColorInt = fallbackColor?.value;
    if (fillElement.name.local == 'null') {
      if (fallbackColorInt == null) return null;
      return VmlFillStyle(
        type: 'solid',
        primaryColorInt: fallbackColorInt,
      );
    }

    final type = fillElement.getAttribute('type')?.trim() ?? 'solid';
    final color2 = _parseColor(fillElement.getAttribute('color2'));
    final focusPosition = _parsePair(fillElement.getAttribute('focusposition'));
    final stops = _parseStops(fillElement.getAttribute('colors'));

    return VmlFillStyle(
      type: type,
      primaryColorInt: fallbackColorInt,
      secondaryColorInt: color2?.value,
      focusX: focusPosition.$1,
      focusY: focusPosition.$2,
      gradientStops: stops,
    );
  }

  static VmlShadowStyle? parseShadow(xml.XmlElement shape) {
    final shadowElement = shape.childElements.firstWhere(
      (e) => e.name.local.toLowerCase() == 'shadow',
      orElse: () => xml.XmlElement(xml.XmlName('null')),
    );

    if (shadowElement.name.local == 'null') return null;

    final enabled = !_isFalsey(shadowElement.getAttribute('on'));
    if (!enabled) {
      return const VmlShadowStyle(enabled: false);
    }

    final offset = _parseOffset(shadowElement.getAttribute('offset'));
    final offset2 = _parseOffset(shadowElement.getAttribute('offset2'));
    final color = _parseColor(shadowElement.getAttribute('color'));

    return VmlShadowStyle(
      enabled: true,
      colorInt: color?.value,
      opacity: _parseFraction(shadowElement.getAttribute('opacity')) ?? 1.0,
      offsetX: offset.$1 + offset2.$1,
      offsetY: offset.$2 + offset2.$2,
    );
  }

  static List<VmlGradientStop> _parseStops(String? raw) {
    if (raw == null || raw.trim().isEmpty) return const [];

    final result = <VmlGradientStop>[];
    for (final part in raw.split(';')) {
      final normalized = part.trim();
      if (normalized.isEmpty) continue;
      final match = RegExp(r'^([^\s]+)\s+(.+)$').firstMatch(normalized);
      if (match == null) continue;
      final position = _parseFraction(match.group(1)) ?? 0;
      final color = _parseColor(match.group(2));
      if (color == null) continue;
      result.add(VmlGradientStop(position: position, colorInt: color.value));
    }

    result.sort((a, b) => a.position.compareTo(b.position));
    return result;
  }

  static (double, double) _parsePair(String? raw) {
    if (raw == null || raw.trim().isEmpty) return (0.5, 0.5);
    final parts = raw.split(',').map((e) => e.trim()).toList();
    final x = _parseFraction(parts.isNotEmpty ? parts[0] : null) ?? 0.5;
    final y = _parseFraction(parts.length > 1 ? parts[1] : null) ?? 0.5;
    return (x, y);
  }

  static (double, double) _parseOffset(String? raw) {
    if (raw == null || raw.trim().isEmpty) return (0, 0);
    final parts = raw.split(',').map((e) => e.trim()).toList();
    final x = _parseUnit(parts.isNotEmpty ? parts[0] : null);
    final y = _parseUnit(parts.length > 1 ? parts[1] : null);
    return (x, y);
  }

  static double _parseUnit(String? raw) {
    if (raw == null || raw.isEmpty) return 0;
    final value = raw.trim().toLowerCase();
    if (value.endsWith('pt')) {
      return (double.tryParse(value.replaceAll('pt', '')) ?? 0) * 1.333;
    }
    if (value.endsWith('px')) {
      return double.tryParse(value.replaceAll('px', '')) ?? 0;
    }
    if (value.endsWith('in')) {
      return (double.tryParse(value.replaceAll('in', '')) ?? 0) * 96.0;
    }
    return double.tryParse(value) ?? 0;
  }

  static double? _parseFraction(String? raw) {
    if (raw == null || raw.trim().isEmpty) return null;
    final value = raw.trim().toLowerCase();
    if (value.endsWith('f')) {
      final parsed = double.tryParse(value.substring(0, value.length - 1));
      if (parsed == null) return null;
      return (parsed / 65536.0).clamp(0.0, 1.0);
    }
    return double.tryParse(value)?.clamp(0.0, 1.0);
  }

  static bool _isFalsey(String? raw) {
    final value = raw?.trim().toLowerCase();
    return value == 'f' || value == 'false' || value == '0';
  }

  static Color? _parseColor(String? rawValue) {
    if (rawValue == null) return null;
    final value = rawValue.trim().toLowerCase();
    if (value.isEmpty || value == 'none' || value == 'auto') return null;

    const named = {
      'aqua': 0xFF00FFFF,
      'black': 0xFF000000,
      'blue': 0xFF0000FF,
      'fuchsia': 0xFFFF00FF,
      'gray': 0xFF808080,
      'green': 0xFF008000,
      'lime': 0xFF00FF00,
      'maroon': 0xFF800000,
      'navy': 0xFF000080,
      'olive': 0xFF808000,
      'purple': 0xFF800080,
      'red': 0xFFFF0000,
      'silver': 0xFFC0C0C0,
      'teal': 0xFF008080,
      'white': 0xFFFFFFFF,
      'yellow': 0xFFFFFF00,
    };

    if (named.containsKey(value)) {
      return Color(named[value]!);
    }

    if (value.startsWith('#')) {
      final hex = value.substring(1);
      if (hex.length == 3) {
        final expanded = '${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}';
        return Color(int.parse('FF$expanded', radix: 16));
      }
      if (hex.length == 6) {
        return Color(int.parse('FF$hex', radix: 16));
      }
    }

    return null;
  }
}
