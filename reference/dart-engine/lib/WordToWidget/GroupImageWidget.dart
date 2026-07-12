import 'package:flutter/material.dart';
import 'package:golden_shamela/Utils/ImageParser.dart';
import 'package:golden_shamela/WordToWidget/ImageToWidget.dart'; // To access getImageWidget recursively

class GroupImageWidget extends StatelessWidget {
  final ImageData imageData;

  const GroupImageWidget({Key? key, required this.imageData}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    if (imageData.groupImages.isEmpty) {
      return const SizedBox.shrink();
    }

    List<Widget> children = [];
    for (var childImg in imageData.groupImages) {
      // Position each child within the group using its posX/posY
      Widget childWidget = getImageWidget(childImg, innerOnly: true);

      if (childImg.posX != 0 || childImg.posY != 0) {
        childWidget = Positioned(
          left: childImg.posX,
          top: childImg.posY,
          child: childWidget,
        );
      }
      children.add(childWidget);
    }

    // Group container dimensions
    double groupWidth = imageData.width > 0 ? imageData.width : 500; // Fallback
    double groupHeight = imageData.height > 0 ? imageData.height : 300;

    return Container(
      width: groupWidth,
      height: groupHeight,
      // Using LTR directionality to ensure absolute positioning works consistently
      // with OpenXML coordinates, solving stacking issues in RTL app context.
      child: Directionality(
        textDirection: TextDirection.ltr,
        child: Stack(clipBehavior: Clip.none, children: children),
      ),
    );
  }
}
