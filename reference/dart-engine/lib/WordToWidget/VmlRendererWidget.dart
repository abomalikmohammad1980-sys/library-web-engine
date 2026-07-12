import 'package:flutter/material.dart';
import 'package:golden_shamela/Models/WordPage.dart';
import 'package:golden_shamela/Models/VmlShapeData.dart';
import 'package:golden_shamela/Utils/ImageParser.dart';
import 'package:golden_shamela/WordToWidget/VmlDiamondShapeWidget.dart';
import 'package:golden_shamela/WordToWidget/VmlBracketPairShapeWidget.dart';
import 'package:golden_shamela/WordToWidget/RichTextBoxWidget.dart';
import 'package:golden_shamela/WordToWidget/ShapeTextBoxInsetResolver.dart';
import 'package:golden_shamela/WordToWidget/VmlShapeFillResolver.dart';
import 'package:golden_shamela/WordToWidget/VmlLinePainter.dart';

/// ودجت مسؤول عن تجميع ورسم أشكال VML المختلفة مع النص الغني بداخلها.
///
/// يدعم الأشكال التالية:
/// - `roundrect` / `rect`: مستطيل عادي أو بزوايا دائرية
/// - `diamond`: شكل معيّن (يُفوَّض إلى `VmlDiamondShapeWidget`)
/// - `line`: خط مستقيم (يُفوَّض الرسم إلى `VmlLinePainter`)
/// - أي شكل آخر: حاوية بسيطة مع خلفية وحدود
class VmlRendererWidget extends StatelessWidget {
  final ImageData imageData;
  final WordPage wordPage;

  const VmlRendererWidget({
    Key? key,
    required this.imageData,
    required this.wordPage,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    if (imageData.vmlShapeData == null) {
      return const SizedBox.shrink();
    }

    final vml = imageData.vmlShapeData!;
    final overflowMaxHeight = _resolveOverflowMaxHeight(imageData, wordPage);
    Widget contentWidget = const SizedBox.shrink();

    // محتوى صورة إن وُجدت وليس هناك textbox
    if (imageData.imageMemory != null &&
        imageData.imageMemory!.isNotEmpty &&
        vml.textBoxElement == null) {
      final isPictureShape = vml.shapeType.toLowerCase() == 'picture';
      contentWidget = Image.memory(
        imageData.imageMemory!,
        width: imageData.width > 0 ? imageData.width : null,
        height: imageData.height > 0 ? imageData.height : null,
        // In Word VML, a picture shape (o:spt="75") paints the image into the
        // shape rectangle itself. Using contain here invents white bands when
        // the bitmap ratio differs from the VML shape ratio, which is not what
        // Word does for this picture-shape case.
        fit: isPictureShape
            ? BoxFit.fill
            : (imageData.isStretched ? BoxFit.fill : BoxFit.contain),
        gaplessPlayback: true,
      );
    }

    // محتوى نصي غني إن وُجد textbox
    if (vml.textBoxElement != null) {
      Widget textBoxContent = Padding(
        padding: ShapeTextBoxInsetResolver.resolve(vml),
        child: RichTextBoxWidget(
          textBoxElement: vml.textBoxElement!,
          wordPage: wordPage,
          customPageNumber: imageData.parent?.parent.customPageNumber,
          textBoxFillColor: vml.fillColor,
          resolveHeaderFooterFields:
              imageData.parent?.parent.isHeaderParagraph == true ||
              imageData.parent?.parent.isFooterParagraph == true ||
              imageData.parent?.parent.resolveHeaderFooterFields == true,
        ),
      );

      if (vml.textNoAutofit) {
        // DrawingML `a:noAutofit` means Word does not shrink text to stay
        // inside the fixed textbox rectangle. Let the content keep its
        // natural height instead of forcing a tight Flutter flex layout.
        textBoxContent = Align(
          alignment: Alignment.topCenter,
          child: OverflowBox(
            alignment: Alignment.topCenter,
            minWidth: 0,
            maxWidth: imageData.width > 0 ? imageData.width : double.infinity,
            minHeight: 0,
            maxHeight: overflowMaxHeight,
            child: textBoxContent,
          ),
        );
      }

      // Some VML text boxes are fixed-height containers whose Word rendering
      // may clip the last line slightly. We intentionally let txbxContent keep
      // its natural Flutter height here, limited to the VML text-box path only,
      // so we do not lose readable text because of small font metric differences.
      contentWidget = OverflowBox(
        alignment: Alignment.topCenter,
        minWidth: 0,
        maxWidth: imageData.width > 0 ? imageData.width : double.infinity,
        minHeight: 0,
        maxHeight: overflowMaxHeight,
        child: textBoxContent,
      );
    }

    // بناء الشكل المراد رسمه (خلفية وحدود)
    final fillDecoration = _buildShapeFillDecoration(vml, imageData);
    final borderDecoration = _buildShapeBorderDecoration(vml);
    Widget shapeWidget;
    switch (vml.shapeType.toLowerCase()) {
      case 'roundrect':
      case 'rect':
        BorderRadius? borderRadius;
        if (vml.shapeType.toLowerCase() == 'roundrect') {
          final double minDim = imageData.width < imageData.height
              ? imageData.width
              : imageData.height;
          borderRadius = BorderRadius.circular(minDim * vml.arcSize);
        }

        final shapeDecoration =
            fillDecoration?.copyWith(borderRadius: borderRadius) ??
            (borderDecoration != null
                ? BoxDecoration(borderRadius: borderRadius)
                : null);

        shapeWidget = Container(
          width: imageData.width > 0 ? imageData.width : null,
          height: imageData.height > 0 ? imageData.height : null,
          decoration: shapeDecoration,
          foregroundDecoration: borderDecoration?.copyWith(
            borderRadius: borderRadius,
          ),
          clipBehavior:
              (shapeDecoration != null)
              ? Clip.hardEdge
              : Clip.none,
          child: contentWidget,
        );
        break;

      case 'diamond':
        shapeWidget = VmlDiamondShapeWidget(
          width: imageData.width,
          height: imageData.height,
          fillColor: VmlShapeFillResolver.resolveFillColor(
            vml: vml,
            imageData: imageData,
          ),
          fillStyle: vml.fillStyle,
          strokeColor: vml.isStroked ? vml.strokeColor : null,
          strokeWidth: vml.strokeWidth,
          shadowStyle: vml.shadowStyle,
          child: contentWidget,
        );
        break;

      case 'bracketpair':
        shapeWidget = VmlBracketPairShapeWidget(
          width: imageData.width,
          height: imageData.height,
          fillColor: VmlShapeFillResolver.resolveFillColor(
            vml: vml,
            imageData: imageData,
          ),
          fillStyle: vml.fillStyle,
          strokeColor: vml.isStroked ? vml.strokeColor : null,
          strokeWidth: vml.strokeWidth,
          shadowStyle: vml.shadowStyle,
          child: contentWidget,
        );
        break;

      case 'line':
        shapeWidget = SizedBox(
          width: imageData.width,
          height: imageData.height < 2
              ? 8.0
              : imageData.height,
          child: CustomPaint(
            painter: VmlLinePainter(
              color: vml.strokeColor ?? Colors.black,
              strokeWidth: vml.strokeWidth,
              dashStyle: vml.strokeDashStyle,
              endCap: vml.strokeEndCap,
            ),
            child: contentWidget,
          ),
        );
        break;

      default:
        shapeWidget = Container(
          width: imageData.width > 0 ? imageData.width : null,
          height: imageData.height > 0 ? imageData.height : null,
          decoration: fillDecoration,
          foregroundDecoration: borderDecoration,
          child: contentWidget,
        );
    }

    return shapeWidget;
  }
}

double _resolveOverflowMaxHeight(ImageData imageData, WordPage wordPage) {
  final pageHeight =
      wordPage.parent.getSectPrForPage(wordPage.pageIndex).height ?? 0;
  if (pageHeight > 0 && pageHeight.isFinite) {
    // Word text boxes live on a finite page. Flutter cannot size an
    // OverflowBox to Infinity inside a positioned VML shape, so the page
    // height is the conservative structural cap for noAutofit overflow.
    return pageHeight;
  }

  final shapeHeight = imageData.height;
  if (shapeHeight > 0 && shapeHeight.isFinite) {
    return shapeHeight;
  }

  return 1000;
}

/// بناء زخرفة الخلفية للشكل
BoxDecoration? _buildShapeFillDecoration(VmlShapeData vml, ImageData imageData) {
  final color = VmlShapeFillResolver.resolveFillColor(
    vml: vml,
    imageData: imageData,
  );
  final boxShadow = _buildShapeBoxShadow(vml);
  if (color == null && boxShadow == null) return null;
  return BoxDecoration(color: color, boxShadow: boxShadow);
}

/// بناء زخرفة الحدود للشكل
BoxDecoration? _buildShapeBorderDecoration(VmlShapeData vml) {
  final strokeColor = vml.strokeColor ?? Colors.black;
  final border = vml.isStroked
      ? Border.all(color: strokeColor, width: vml.strokeWidth)
      : null;
  if (border == null) return null;
  return BoxDecoration(border: border);
}

List<BoxShadow>? _buildShapeBoxShadow(VmlShapeData vml) {
  final shadow = vml.shadowStyle;
  if (shadow == null || !shadow.enabled) return null;

  final shadowColor =
      (shadow.color ?? Colors.black).withOpacity(shadow.opacity.clamp(0.0, 1.0));

  return [
    BoxShadow(
      color: shadowColor,
      offset: Offset(shadow.offsetX, shadow.offsetY),
      blurRadius: 0,
      spreadRadius: 0,
    ),
  ];
}
