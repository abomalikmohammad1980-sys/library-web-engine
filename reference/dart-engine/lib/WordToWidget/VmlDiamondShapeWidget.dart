import 'package:flutter/material.dart';
import 'package:golden_shamela/Models/VmlFillStyle.dart';
import 'package:golden_shamela/Models/VmlShadowStyle.dart';

class VmlDiamondShapeWidget extends StatelessWidget {
  final double width;
  final double height;
  final Color? fillColor;
  final VmlFillStyle? fillStyle;
  final Color? strokeColor;
  final double strokeWidth;
  final VmlShadowStyle? shadowStyle;
  final Widget child;

  const VmlDiamondShapeWidget({
    super.key,
    required this.width,
    required this.height,
    required this.fillColor,
    required this.fillStyle,
    required this.strokeColor,
    required this.strokeWidth,
    required this.shadowStyle,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: width > 0 ? width : null,
      height: height > 0 ? height : null,
      child: CustomPaint(
        painter: _VmlDiamondPainter(
          fillColor: fillColor,
          fillStyle: fillStyle,
          strokeColor: strokeColor,
          strokeWidth: strokeWidth,
          shadowStyle: shadowStyle,
        ),
        child: Center(child: child),
      ),
    );
  }
}

class _VmlDiamondPainter extends CustomPainter {
  final Color? fillColor;
  final VmlFillStyle? fillStyle;
  final Color? strokeColor;
  final double strokeWidth;
  final VmlShadowStyle? shadowStyle;

  _VmlDiamondPainter({
    required this.fillColor,
    required this.fillStyle,
    required this.strokeColor,
    required this.strokeWidth,
    required this.shadowStyle,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final path = _buildDiamondPath(size);

    final shadow = shadowStyle;
    if (shadow != null && shadow.enabled && shadow.color != null) {
      canvas.drawPath(
        path.shift(Offset(shadow.offsetX, shadow.offsetY)),
        Paint()
          ..color = shadow.color!.withOpacity(shadow.opacity.clamp(0.0, 1.0))
          ..style = PaintingStyle.fill,
      );
    }

    if (fillColor != null) {
      canvas.drawPath(
        path,
        Paint()
          ..color = fillColor!
          ..style = PaintingStyle.fill,
      );
    }

    final shader = _buildShader(size);
    if (shader != null) {
      canvas.drawPath(
        path,
        Paint()
          ..shader = shader
          ..style = PaintingStyle.fill,
      );
    }

    if (strokeColor != null && strokeWidth > 0) {
      canvas.drawPath(
        path,
        Paint()
          ..color = strokeColor!
          ..strokeWidth = strokeWidth
          ..style = PaintingStyle.stroke,
      );
    }
  }

  Path _buildDiamondPath(Size size) {
    return Path()
      ..moveTo(size.width / 2, 0)
      ..lineTo(0, size.height / 2)
      ..lineTo(size.width / 2, size.height)
      ..lineTo(size.width, size.height / 2)
      ..close();
  }

  Shader? _buildShader(Size size) {
    final style = fillStyle;
    if (style == null || !style.isGradientRadial) {
      return null;
    }

    final colors = <Color>[];
    final stops = <double>[];
    for (final stop in style.gradientStops) {
      colors.add(stop.color);
      stops.add(stop.position.clamp(0.0, 1.0));
    }

    if (colors.isEmpty) {
      final primary = style.primaryColor ?? fillColor;
      final secondary = style.secondaryColor;
      if (primary == null || secondary == null) return null;
      colors.addAll([primary, secondary]);
      stops.addAll([0.0, 1.0]);
    }

    return RadialGradient(
      center: Alignment(
        (style.focusX.clamp(0.0, 1.0) * 2) - 1,
        (style.focusY.clamp(0.0, 1.0) * 2) - 1,
      ),
      radius: 0.85,
      colors: colors,
      stops: stops,
    ).createShader(Offset.zero & size);
  }

  @override
  bool shouldRepaint(covariant _VmlDiamondPainter oldDelegate) {
    return fillColor != oldDelegate.fillColor ||
        fillStyle != oldDelegate.fillStyle ||
        strokeColor != oldDelegate.strokeColor ||
        strokeWidth != oldDelegate.strokeWidth ||
        shadowStyle != oldDelegate.shadowStyle;
  }
}
