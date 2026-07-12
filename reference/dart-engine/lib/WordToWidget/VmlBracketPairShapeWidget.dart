import 'package:flutter/material.dart';
import 'package:golden_shamela/Models/VmlFillStyle.dart';
import 'package:golden_shamela/Models/VmlShadowStyle.dart';

class VmlBracketPairShapeWidget extends StatelessWidget {
  final double width;
  final double height;
  final Color? fillColor;
  final VmlFillStyle? fillStyle;
  final Color? strokeColor;
  final double strokeWidth;
  final VmlShadowStyle? shadowStyle;
  final Widget child;

  const VmlBracketPairShapeWidget({
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
        painter: _VmlBracketPairPainter(
          fillColor: fillColor,
          fillStyle: fillStyle,
          strokeColor: strokeColor,
          strokeWidth: strokeWidth,
          shadowStyle: shadowStyle,
        ),
        child: child,
      ),
    );
  }
}

class _VmlBracketPairPainter extends CustomPainter {
  final Color? fillColor;
  final VmlFillStyle? fillStyle;
  final Color? strokeColor;
  final double strokeWidth;
  final VmlShadowStyle? shadowStyle;

  _VmlBracketPairPainter({
    required this.fillColor,
    required this.fillStyle,
    required this.strokeColor,
    required this.strokeWidth,
    required this.shadowStyle,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final path = _buildBracketPairPath(size);
    final textBoxRect = _buildTextBoxRect(size);

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
      canvas.drawRect(
        textBoxRect,
        Paint()
          ..color = fillColor!
          ..style = PaintingStyle.fill,
      );
    }

    final shader = _buildShader(size);
    if (shader != null) {
      canvas.drawRect(
        textBoxRect,
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
          ..strokeCap = StrokeCap.round
          ..strokeJoin = StrokeJoin.round
          ..style = PaintingStyle.stroke,
      );
    }
  }

  Path _buildBracketPairPath(Size size) {
    final horizontalInset = size.width * 0.18;
    final curveInset = size.width * 0.07;
    final top = strokeWidth / 2;
    final bottom = size.height - strokeWidth / 2;
    final leftOuter = strokeWidth / 2;
    final leftInner = horizontalInset;
    final rightOuter = size.width - strokeWidth / 2;
    final rightInner = size.width - horizontalInset;
    final middleY = size.height / 2;

    return Path()
      ..moveTo(leftInner, top)
      ..cubicTo(leftOuter + curveInset, top, leftOuter, middleY * 0.45, leftOuter, middleY)
      ..cubicTo(leftOuter, size.height - middleY * 0.45, leftOuter + curveInset, bottom, leftInner, bottom)
      ..moveTo(rightInner, top)
      ..cubicTo(rightOuter - curveInset, top, rightOuter, middleY * 0.45, rightOuter, middleY)
      ..cubicTo(rightOuter, size.height - middleY * 0.45, rightOuter - curveInset, bottom, rightInner, bottom);
  }

  Rect _buildTextBoxRect(Size size) {
    final left = (size.width * 0.18).clamp(0.0, size.width / 2);
    final right = size.width - left;
    return Rect.fromLTRB(left, 0, right, size.height);
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
  bool shouldRepaint(covariant _VmlBracketPairPainter oldDelegate) {
    return fillColor != oldDelegate.fillColor ||
        fillStyle != oldDelegate.fillStyle ||
        strokeColor != oldDelegate.strokeColor ||
        strokeWidth != oldDelegate.strokeWidth ||
        shadowStyle != oldDelegate.shadowStyle;
  }
}
