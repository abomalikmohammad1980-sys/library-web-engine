import 'package:flutter/material.dart';
import 'package:golden_shamela/Models/VmlShapeData.dart';
import 'package:golden_shamela/WordToWidget/VmlTextBoxInsetResolver.dart';

/// Resolver موحّد لـ text-box insets:
/// - يفضّل القيم المحللة من DrawingML (`wps:bodyPr`)
/// - ثم يعود إلى `v:textbox inset` الخاصة بـ VML
class ShapeTextBoxInsetResolver {
  const ShapeTextBoxInsetResolver._();

  static EdgeInsets resolve(VmlShapeData vml) {
    final insetPx = vml.textBoxInsetPx;
    if (insetPx != null && insetPx.length == 4) {
      return EdgeInsets.fromLTRB(
        insetPx[0],
        insetPx[1],
        insetPx[2],
        insetPx[3],
      );
    }

    return VmlTextBoxInsetResolver.resolve(vml.textBoxInset);
  }
}
