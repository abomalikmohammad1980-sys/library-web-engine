import 'package:flutter/material.dart';
import 'package:golden_shamela/Models/VmlShapeData.dart';
import 'package:golden_shamela/Utils/ImageParser.dart';

/// Resolves the effective fill for VML rendering without inventing a white
/// background for picture-carrying shapes that do not declare one in XML.
class VmlShapeFillResolver {
  const VmlShapeFillResolver._();

  static Color? resolveFillColor({
    required VmlShapeData vml,
    required ImageData imageData,
  }) {
    if (!vml.isFilled) {
      return null;
    }

    if (vml.fillColor != null) {
      return vml.fillColor;
    }

    final hasRasterImage =
        imageData.imageMemory != null && imageData.imageMemory!.isNotEmpty;
    final hasTextBox = vml.textBoxElement != null;

    // A VML picture host with no explicit fillcolor should stay transparent.
    // Word does not synthesize a white rectangle behind transparent PNG content
    // in this case.
    if (hasRasterImage && !hasTextBox) {
      return null;
    }

    return Colors.white;
  }
}
