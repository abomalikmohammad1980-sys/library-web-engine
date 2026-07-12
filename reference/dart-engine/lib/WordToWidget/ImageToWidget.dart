import 'package:flutter/material.dart';
import 'package:flutter/cupertino.dart';
import 'package:golden_shamela/Utils/ImageParser.dart';
import 'package:golden_shamela/wordToHTML/PageFieldDisplayNumeralResolver.dart';
import 'package:golden_shamela/wordToHTML/SectPr.dart';
import 'package:url_launcher/url_launcher.dart';
import 'VectorShapeWidget.dart';
import 'GroupImageWidget.dart';
import 'DrawingAnchorPositionResolver.dart';
import 'CroppedImageWidget.dart';
import 'package:golden_shamela/WordToWidget/VmlRendererWidget.dart';

SectPr? _resolveImageSectPr(ImageData imageData) {
  final run = imageData.parent;
  if (run == null) return null;

  final paragraph = run.parent;
  final wordPage = paragraph.parent;
  final wordDocument = wordPage.parent;

  return wordDocument.getSectPrForPage(wordPage.pageIndex);
}

Widget getImageWidget(ImageData? imageData, {bool innerOnly = false}) {
  if (imageData == null) return Container(child: Text("Empty Pic"));
  ImageData image = imageData;

  // NEW: Handle Vector Shapes (wps:wsp with a:custGeom)
  // هذا لعرض الأشكال المخصصة مثل الخط الزخرفي في الهيدر
  if (image.isVectorShape && image.vectorPath != null) {
    return VectorShapeWidget(
      path: image.vectorPath!,
      width: image.width > 0 ? image.width : 100,
      height: image.height > 0 ? image.height : 100,
      fillColor: image.vectorFillColor,
      strokeColor: image.vectorStrokeColor,
      strokeWidth: image.vectorStrokeWidth,
    );
  }

  if (image.isGroup) {
    return GroupImageWidget(imageData: image);
  }

  // VML shapes are rendered by the dedicated VML widget. The classification
  // of the shape itself must be corrected at parse time, not by special-casing
  // individual VML pictures here.
  if (image.vmlShapeData != null) {
    return VmlRendererWidget(
      imageData: image,
      wordPage: image.parent!.parent!.parent,
    );
  }

  // Handle Text Box Content (non-VML fall-back)
  if (image.textBoxText != null && image.textBoxText!.isNotEmpty) {
    Color textColor = Colors.black;
    if (image.textColor != null) {
      try {
        String hex = image.textColor!;
        if (hex.length == 6) {
          hex = "FF" + hex;
        }
        textColor = Color(int.parse(hex, radix: 16));
      } catch (e) {
        print("Error parsing color: ${image.textColor}");
      }
    }

    double fontSize = (image.textSize ?? 20.0);
    String? fontFamily = image.fontFamily;
    String displayText = image.textBoxText!;
    final customPageNumber = image.parent?.parent.customPageNumber;
    final useArabicNumerals =
        image.parent?.parent.parent.parent.useArabicNumerals ?? true;

    if (image.containsPageField && customPageNumber != null) {
      displayText = resolvePageFieldDisplayNumerals(
        pageNumber: customPageNumber,
        useArabicNumerals: useArabicNumerals,
        fontFamily: fontFamily,
      );
    }

    // Return a simple container with the text.
    // We do NOT apply absolute positioning offsets (left/top) here because
    // if this is being rendered as an InlineSpan, the offsets will mess up the flow
    // or be ignored. The caller handles positioning if needed.
    return Container(
      width: image.width > 0 ? image.width : null,
      height: image.height > 0 ? image.height : null,
      child: Center(
        child: Text(
          displayText,
          textAlign: TextAlign.center,
          style: TextStyle(
            color: textColor,
            fontSize: fontSize,
            fontWeight: FontWeight.bold,
            fontFamily: fontFamily,
          ),
        ),
      ),
    );
  }

  // الحصول على أبعاد الصفحة والهوامش
  final sectPr = _resolveImageSectPr(image);
  double pageWidth = sectPr?.width ?? 595;
  double leftMargin = sectPr?.leftMargin ?? 0;
  double rightMargin = sectPr?.rightMargin ?? 0;
  double topMargin = sectPr?.topMargin ?? 0;

  // حساب منطقة الهامش (margin area)
  double marginAreaWidth = pageWidth - leftMargin - rightMargin;

  double posX = 0;
  double posY = 0;

  // التحقق من وجود align حقيقي أو posOffset
  // إذا كان posX != 0 أو posY != 0، فهذا يعني استخدام posOffset
  bool usesHAlign =
      image.posX == 0 && (image.alignH == "center" || image.alignH == "right");
  // Check for RTL context
  // Standard OpenXML Logic:
  // If paragraph is bidi (RTL), relativeFrom="margin" implies origin is Right Margin.
  // Positive offset moves Left (into page). Negative offset moves Right (out of page).
  bool isRtl = false;
  if (image.parent?.parent?.pPr?.bidi == true) {
    isRtl = true;
  } else if (image.parent?.parent?.pPr?.rtl == true) {
    // Fallback to run property if par property missing
    isRtl = true;
  }

  // Use TopRight alignment implies "Right" property logic for posX if RTL
  AlignmentGeometry? alignment;

  // حساب الموضع الأفقي
  if (usesHAlign && image.alignH == "center") {
    if (image.relativeFromH == "page") {
      posX = (pageWidth - image.width) / 2;
    } else {
      posX = leftMargin + (marginAreaWidth - image.width) / 2;
    }
  } else if (usesHAlign && image.alignH == "right") {
    if (image.relativeFromH == "page") {
      posX = pageWidth - image.width;
    } else {
      posX = pageWidth - rightMargin - image.width;
    }
  } else {
    if (image.isVml) {
      if (image.relativeFromH == "page") {
        posX = image.posX;
      } else {
        posX = image.posX + leftMargin;
      }
      alignment = Alignment.topLeft;
    } else
    // posOffset Logic with Hybrid RTL/Strict
    // User Observation: Frame (Negative Offset) works with Right Anchor. Content (Positive Offset) needs Left Anchor.
    if (isRtl) {
      // Check sign of the parsed offset
      // Note: image.posX is already parsed from XML (EMU->Px).
      // In Word XML, 'posOffset' is the signed value.

      bool isNegative = image.posX < 0;

      if (isNegative) {
        // Case 1: Negative Offset -> Anchor TopRight (RTL Spec/Margin behavior)
        alignment = Alignment.topRight;
        double anchorOffset = 0; // Default for 'page'
        if (image.relativeFromH == "margin" ||
            image.relativeFromH == "column") {
          anchorOffset = rightMargin;
        }
        // Logic: Anchor at RightMargin. posX is negative (e.g. -47).
        // Formula: -(RightMargin + posX). -(86 + -47) = -39.
        // -39 relative to Edge (TopRight) is 39px Left of Edge.
        posX = -(anchorOffset + image.posX);
      } else {
        // Case 2: Positive Offset -> Anchor TopLeft (LTR Legacy behavior)
        // Even in RTL paragraphs, Word seems to treat positive absolute positions from the Left
        // (or Start of Line in a way that maps to Left in this document).
        alignment = Alignment.topLeft;
        if (image.relativeFromH == "page") {
          posX = image.posX;
        } else {
          posX = image.posX + leftMargin;
        }
      }
    } else {
      // Standard LTR Logic
      if (image.relativeFromH == "page") {
        posX = image.posX;
      } else {
        posX = image.posX + leftMargin;
      }
      alignment = Alignment.topLeft;
    }
  }

  if (sectPr != null) {
    posY = DrawingAnchorPositionResolver.resolveTop(
      image: image,
      sectPr: sectPr,
    );
  } else {
    posY = image.relativeFromV == "page" || image.relativeFromV == "topMargin"
        ? image.posY
        : image.posY + topMargin;
  }

  // Determine Final Alignment
  if (alignment == null) {
    alignment = Alignment.topLeft;
  }

  // Update transX/Y for the Transform widget
  double transX = posX;
  double transY = posY;

  // Create the interactive image widget (or use group content)
  Widget content;
  Widget innerContent;

  if (image.vmlShapeData != null && !image.isGroup) {
    innerContent = VmlRendererWidget(
      imageData: image,
      wordPage: image.parent!.parent!.parent,
    );
  } else if (image.isGroup) {
    innerContent = GroupImageWidget(imageData: image);
  } else {
    if (image.imageMemory == null || image.imageMemory!.isEmpty) {
      // If it's a VML shape without image data and without text box, just hide it
      if (image.isVml && image.rId.isEmpty && (image.textBoxText == null || image.textBoxText!.isEmpty) && image.vectorPath == null) {
        return const SizedBox.shrink();
      }
      print(
        "🚫 IMAGE NO DATA - rId: ${image.rId}, docImages: ${image.parent?.parent?.parent?.parent?.docImages.keys.length ?? 0} images",
      );
      return SizedBox(
        width: image.width > 0 ? image.width : 50,
        height: image.height > 0 ? image.height : 50,
        child: Center(child: Text("No Data", style: TextStyle(fontSize: 10, color: Colors.grey))),
      );
    }

    // التحقق من صحة البيانات (Magic Bytes)
    bool isValid = false;
    if (image.imageMemory!.length > 4) {
      // PNG: 89 50 4E 47
      if (image.imageMemory![0] == 0x89 &&
          image.imageMemory![1] == 0x50 &&
          image.imageMemory![2] == 0x4E &&
          image.imageMemory![3] == 0x47) {
        isValid = true;
        // print("✅ Valid PNG detected for ${image.rId}");
      }
      // JPEG: FF D8 FF
      else if (image.imageMemory![0] == 0xFF &&
          image.imageMemory![1] == 0xD8 &&
          image.imageMemory![2] == 0xFF) {
        isValid = true;
        // print("✅ Valid JPEG detected for ${image.rId}");
      }
      // GIF: 47 49 46 38
      else if (image.imageMemory![0] == 0x47 &&
          image.imageMemory![1] == 0x49 &&
          image.imageMemory![2] == 0x46 &&
          image.imageMemory![3] == 0x38) {
        isValid = true;
      }
      // WebP: 52 49 46 46 ... 57 45 42 50 (RIFF ... WEBP)
      else if (image.imageMemory![0] == 0x52 &&
          image.imageMemory![1] == 0x49 &&
          image.imageMemory![2] == 0x46 &&
          image.imageMemory![3] == 0x46) {
        isValid = true;
      }
      // EMF: 01 00 00 00
      else if (image.imageMemory![0] == 0x01 &&
          image.imageMemory![1] == 0x00 &&
          image.imageMemory![2] == 0x00 &&
          image.imageMemory![3] == 0x00) {
        print(
          "⚠️ EMF Image detected (rId: ${image.rId}) - Not supported natively by Flutter",
        );
        return Container(
          width: image.width,
          height: image.height,
          decoration: BoxDecoration(
            border: Border.all(color: Colors.blue),
            color: Colors.blue.withOpacity(0.1),
          ),
          child: Center(
            child: Text(
              "EMF Image\n(Not Supported)",
              textAlign: TextAlign.center,
              style: TextStyle(fontSize: 10, color: Colors.blue),
            ),
          ),
        );
      }
    }

    if (!isValid) {
      print(
        "⚠️ Invalid Image Format for rId: ${image.rId} (First 4 bytes: ${image.imageMemory!.take(4).toList()})",
      );
      return Container(
        width: image.width,
        height: image.height,
        color: Colors.orange.withOpacity(0.2),
        child: Center(
          child: Text(
            "Invalid Format",
            style: TextStyle(fontSize: 10, color: Colors.orange),
          ),
        ),
      );
    }

    // Build the image widget
    // Apply rotation if present
    // Detect if rotation is orthogonal (multiple of 90 degrees) to use RotatedBox for correct layout
    double rawWidth = image.width;
    double rawHeight = image.height;
    int quarterTurns = 0;
    bool useRotatedBox = false;

    if (image.rotation != 0) {
      double r = image.rotation;
      while (r < 0) r += 360;
      while (r >= 360) r -= 360;

      if ((r - 90).abs() < 1.0) {
        quarterTurns = 1;
        useRotatedBox = true;
      } else if ((r - 180).abs() < 1.0) {
        quarterTurns = 2;
        useRotatedBox = true;
      } else if ((r - 270).abs() < 1.0) {
        quarterTurns = 3;
        useRotatedBox = true;
      }
    }

    // If using RotatedBox for 90/270 degrees, we must UNSWAP the dimensions for the inner Image widget.
    // The ImageParser swapped them to represent the bounding box, but the inner Image rendering
    // needs the original aspect ratio dimensions.
    if (useRotatedBox && (quarterTurns == 1 || quarterTurns == 3)) {
      rawWidth = image.height;
      rawHeight = image.width;
    }

    Widget imageWidget = buildWordImageMemoryWidget(image, rawWidth, rawHeight);

    if (useRotatedBox) {
      imageWidget = RotatedBox(quarterTurns: quarterTurns, child: imageWidget);
    } else if (image.rotation != 0) {
      imageWidget = Transform.rotate(
        angle: image.rotation * (3.14159265359 / 180), // Convert to radians
        child: imageWidget,
      );
    }

    // Apply Flips
    if (image.flipH || image.flipV) {
      imageWidget = Transform(
        alignment: Alignment.center,
        transform: Matrix4.identity()
          ..scale(image.flipH ? -1.0 : 1.0, image.flipV ? -1.0 : 1.0),
        child: imageWidget,
      );
    }

    innerContent = imageWidget;
  }

  // Create the interactive image widget (GestureDetector wrapper)
  if (innerOnly) {
    return Container(
      width: image.width > 0 ? image.width : null,
      height: image.wrapMode == null ? null : (image.height > 0 ? image.height : null),
      child: innerContent,
    );
  }

  content = GestureDetector(
    onTap: () async {
      // Check if image has a hyperlink
      if (image.hyperlinkUrl != null && image.hyperlinkUrl!.isNotEmpty) {
        try {
          final uri = Uri.parse(image.hyperlinkUrl!);
          if (await canLaunchUrl(uri)) {
            await launchUrl(uri);
          } else {
            print("Could not launch image hyperlink: ${image.hyperlinkUrl}");
          }
        } catch (e) {
          print("Error launching image hyperlink: $e");
        }
      }
    },
    child: MouseRegion(
      // Show pointer cursor if image has hyperlink
      cursor: image.hyperlinkUrl != null && image.hyperlinkUrl!.isNotEmpty
          ? SystemMouseCursors.click
          : SystemMouseCursors.basic,
      child: Container(
        width: image.width > 0 ? image.width : null,
        height: image.wrapMode == null ? null : (image.height > 0 ? image.height : null),
        child: innerContent,
      ),
    ),
  );

  // If wrapMode is null, it indicates an inline image (wp:inline).
  // We return the content directly so it flows with the text and respects Paragraph alignment (e.g. Center).
  if (image.wrapMode == null || innerOnly) {
    return content;
  }

  // Floating/Positioned image logic:
  // استخدام Transform.translate بدلاً من Padding للسماح بالقيم السالبة

  return Align(
    alignment: alignment,
    child: Transform.translate(
      offset: Offset(
        transX.isFinite ? transX : 0,
        transY.isFinite ? transY : 0,
      ), // نستخدم القيم الأصلية (بما في ذلك السالبة) مع حماية من اللانهائية
      child: OverflowBox(
        minWidth: 0,
        maxWidth: double.infinity,
        minHeight: 0,
        maxHeight: double.infinity,
        alignment: alignment,
        child: content,
      ),
    ),
  );
}

getImageALign(ImageData image) {
  // print("image ALign: ${image.alignH} - ${image.alingV}");
  if (image.alignH == "left") {
    if (image.alingV == "top")
      return Alignment.topLeft;
    else if (image.alingV == "center")
      return Alignment.centerLeft;
    else if (image.alingV == "bottom")
      return Alignment.bottomLeft;
  } else if (image.alignH == "center") {
    if (image.alingV == "top")
      return Alignment.topCenter;
    else if (image.alingV == "center")
      return Alignment.center;
    else if (image.alingV == "bottom")
      return Alignment.bottomCenter;
  } else if (image.alignH == "right") {
    if (image.alingV == "top")
      return Alignment.topRight;
    else if (image.alingV == "center")
      return Alignment.centerRight;
    else if (image.alingV == "bottom")
      return Alignment.bottomRight;
  } else if (image.relativeFromH == "column")
    return Alignment.center;
}
