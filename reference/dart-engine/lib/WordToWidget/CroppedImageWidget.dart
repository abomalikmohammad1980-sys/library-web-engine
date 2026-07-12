import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:golden_shamela/Utils/ImageParser.dart';

Widget buildWordImageMemoryWidget(
  ImageData image,
  double width,
  double height,
) {
  if (image.hasSourceCrop) {
    return CroppedImageWidget(
      imageBytes: image.imageMemory!,
      width: width,
      height: height,
      cropLeft: image.cropLeft,
      cropTop: image.cropTop,
      cropRight: image.cropRight,
      cropBottom: image.cropBottom,
    );
  }

  return Image.memory(
    image.imageMemory!,
    width: width,
    height: height,
    fit: image.isStretched ? BoxFit.fill : BoxFit.contain,
    errorBuilder: (context, error, stackTrace) {
      return Container(
        width: width,
        height: height,
        color: Colors.red.withOpacity(0.2),
        child: const Center(child: Icon(Icons.broken_image, color: Colors.red)),
      );
    },
  );
}

class CroppedImageWidget extends StatelessWidget {
  final Uint8List imageBytes;
  final double width;
  final double height;
  final double cropLeft;
  final double cropTop;
  final double cropRight;
  final double cropBottom;

  const CroppedImageWidget({
    Key? key,
    required this.imageBytes,
    required this.width,
    required this.height,
    required this.cropLeft,
    required this.cropTop,
    required this.cropRight,
    required this.cropBottom,
  }) : super(key: key);

  @override
  Widget build(BuildContext context) {
    final visibleWidth =
        (1.0 - cropLeft - cropRight).clamp(0.001, 1.0).toDouble();
    final visibleHeight =
        (1.0 - cropTop - cropBottom).clamp(0.001, 1.0).toDouble();
    final sourceWidth = width / visibleWidth;
    final sourceHeight = height / visibleHeight;

    return SizedBox(
      width: width,
      height: height,
      child: ClipRect(
        child: Stack(
          clipBehavior: Clip.hardEdge,
          children: [
            Positioned(
              left: -sourceWidth * cropLeft,
              top: -sourceHeight * cropTop,
              width: sourceWidth,
              height: sourceHeight,
              child: Image.memory(
                imageBytes,
                width: sourceWidth,
                height: sourceHeight,
                fit: BoxFit.fill,
                errorBuilder: (context, error, stackTrace) {
                  return Container(
                    width: width,
                    height: height,
                    color: Colors.red.withOpacity(0.2),
                    child: const Center(
                      child: Icon(Icons.broken_image, color: Colors.red),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
