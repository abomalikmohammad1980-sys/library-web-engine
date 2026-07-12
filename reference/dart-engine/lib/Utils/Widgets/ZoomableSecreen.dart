import 'package:flutter/cupertino.dart';
import 'package:flutter/material.dart';

class CustomInteractiveViewer extends StatefulWidget {
  final Widget child;
  final double? contentWidth;
  final double? contentHeight;

  const CustomInteractiveViewer({
    required this.child,
    this.contentWidth,
    this.contentHeight,
    super.key,
  });

  @override
  State<CustomInteractiveViewer> createState() =>
      _CustomInteractiveViewerState();
}

class _CustomInteractiveViewerState extends State<CustomInteractiveViewer> {
  final TransformationController _controller = TransformationController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _fitToScreen();
    });
  }

  void _fitToScreen() {
    final size = MediaQuery.of(context).size;
    final screenHeight = size.height;
    final screenWidth = size.width;

    // استخدام الأبعاد الممررة أو الافتراضية
    final double pageHeight = widget.contentHeight ?? 1122.0;
    final double pageWidth = widget.contentWidth ?? 794.0;

    // الزوم الابتدائي 1x (100%)
    const double scale = 1.0;

    // حساب الإزاحة لتوسيط الصفحة أفقياً وعمودياً
    final double dx = (screenWidth - (pageWidth * scale)) / 2;
    final double dy = (screenHeight - (pageHeight * scale)) / 2;

    if (dx.isFinite &&
        dy.isFinite &&
        pageWidth.isFinite &&
        scale.isFinite &&
        pageHeight.isFinite) {
      _controller.value = Matrix4.identity()
        ..translate(dx, dy > 0 ? dy : 0.0)
        ..scale(scale);
    }
  }

  @override
  Widget build(BuildContext context) {
    return InteractiveViewer(
      transformationController: _controller,
      constrained: false,
      panEnabled: true,
      scaleEnabled: true,
      minScale: 0.1,
      maxScale: 6.0,
      // margin يسمح بالسحب خارج الحدود. 200 كما طلب المستخدم
      boundaryMargin: const EdgeInsets.all(200.0),
      // alignment: Alignment.center, // REMOVED: Causes jerkiness and rigid control
      child: widget.child,
    );
  }
}
