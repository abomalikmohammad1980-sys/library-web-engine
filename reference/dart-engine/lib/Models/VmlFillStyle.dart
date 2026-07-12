import 'package:flutter/material.dart';
import 'package:golden_shamela/Models/VmlGradientStop.dart';

class VmlFillStyle {
  final String type;
  final int? primaryColorInt;
  final int? secondaryColorInt;
  final double focusX;
  final double focusY;
  final List<VmlGradientStop> gradientStops;

  const VmlFillStyle({
    required this.type,
    this.primaryColorInt,
    this.secondaryColorInt,
    this.focusX = 0.5,
    this.focusY = 0.5,
    this.gradientStops = const [],
  });

  Color? get primaryColor => primaryColorInt != null ? Color(primaryColorInt!) : null;
  Color? get secondaryColor => secondaryColorInt != null ? Color(secondaryColorInt!) : null;

  bool get isGradientRadial => type.toLowerCase() == 'gradientradial';

  factory VmlFillStyle.fromJson(Map<String, dynamic> json) {
    final rawStops = json['gradientStops'] as List<dynamic>? ?? const [];
    return VmlFillStyle(
      type: json['type'] as String? ?? 'solid',
      primaryColorInt: json['primaryColorInt'] as int?,
      secondaryColorInt: json['secondaryColorInt'] as int?,
      focusX: (json['focusX'] as num?)?.toDouble() ?? 0.5,
      focusY: (json['focusY'] as num?)?.toDouble() ?? 0.5,
      gradientStops: rawStops
          .whereType<Map<String, dynamic>>()
          .map(VmlGradientStop.fromJson)
          .toList(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'type': type,
      'primaryColorInt': primaryColorInt,
      'secondaryColorInt': secondaryColorInt,
      'focusX': focusX,
      'focusY': focusY,
      'gradientStops': gradientStops.map((e) => e.toJson()).toList(),
    };
  }
}
