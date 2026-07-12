import 'package:flutter/material.dart';

class DoubleScrollView extends StatefulWidget {
  final Widget child;
  const DoubleScrollView({super.key, required this.child});

  @override
  State<DoubleScrollView> createState() => _DoubleScrollViewState();
}

class _DoubleScrollViewState extends State<DoubleScrollView> {
  final ScrollController _verticalController = ScrollController();
  final ScrollController _horizontalController = ScrollController();

  @override
  Widget build(BuildContext context) {
    return Scrollbar(
      controller: _horizontalController,
      thumbVisibility: true,
      trackVisibility: true,
      thickness: 16,
      interactive: true,
      notificationPredicate: (notif) => notif.metrics.axis == Axis.horizontal,
      child: Scrollbar(
        controller: _verticalController,
        thumbVisibility: true,
        trackVisibility: true,
        thickness: 16,
        interactive: true,
        notificationPredicate: (notif) => notif.metrics.axis == Axis.vertical,
        child: SingleChildScrollView(
          controller: _horizontalController,
          scrollDirection: Axis.horizontal,
          child: SingleChildScrollView(
            controller: _verticalController,
            scrollDirection: Axis.vertical,
            child: widget.child,
          ),
        ),
      ),
    );
  }
}
