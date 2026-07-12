import 'package:flutter/material.dart';

class VmlShadowStyle {
  final bool enabled;
  final int? colorInt;
  final double opacity;
  final double offsetX;
  final double offsetY;

  const VmlShadowStyle({
    required this.enabled,
    this.colorInt,
    this.opacity = 1.0,
    this.offsetX = 0,
    this.offsetY = 0,
  });

  Color? get color => colorInt != null ? Color(colorInt!) : null;

  factory VmlShadowStyle.fromJson(Map<String, dynamic> json) {
    return VmlShadowStyle(
      enabled: json['enabled'] as bool? ?? false,
      colorInt: json['colorInt'] as int?,
      opacity: (json['opacity'] as num?)?.toDouble() ?? 1.0,
      offsetX: (json['offsetX'] as num?)?.toDouble() ?? 0,
      offsetY: (json['offsetY'] as num?)?.toDouble() ?? 0,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'enabled': enabled,
      'colorInt': colorInt,
      'opacity': opacity,
      'offsetX': offsetX,
      'offsetY': offsetY,
    };
  }
}
