import 'package:flutter/material.dart';

class VmlGradientStop {
  final double position;
  final int colorInt;

  const VmlGradientStop({
    required this.position,
    required this.colorInt,
  });

  Color get color => Color(colorInt);

  factory VmlGradientStop.fromJson(Map<String, dynamic> json) {
    return VmlGradientStop(
      position: (json['position'] as num?)?.toDouble() ?? 0,
      colorInt: json['colorInt'] as int? ?? 0xFFFFFFFF,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'position': position,
      'colorInt': colorInt,
    };
  }
}
