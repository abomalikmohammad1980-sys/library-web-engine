import 'dart:async';
import 'package:flutter/gestures.dart';
import 'package:flutter/material.dart';

/// A widget that enables auto-scrolling when the user drags near the edges
/// of a scrollable area during text selection.
///
/// After each scroll tick, it re-dispatches the last pointer move event so that
/// [SelectionArea] re-evaluates the selection endpoint at the new content
/// position, effectively extending or shrinking the selection while scrolling.
class SelectionAutoScroller extends StatefulWidget {
  final ScrollController scrollController;
  final Widget child;

  /// How close to the edge (in logical pixels) the pointer must be to trigger scrolling.
  final double edgeThreshold;

  /// Maximum scroll speed in logical pixels per tick.
  final double maxScrollSpeed;

  const SelectionAutoScroller({
    super.key,
    required this.scrollController,
    required this.child,
    this.edgeThreshold = 80.0,
    this.maxScrollSpeed = 15.0,
  });

  @override
  State<SelectionAutoScroller> createState() => _SelectionAutoScrollerState();
}

class _SelectionAutoScrollerState extends State<SelectionAutoScroller> {
  Timer? _scrollTimer;
  double _scrollDelta = 0.0;
  bool _pointerDown = false;
  PointerMoveEvent? _lastMoveEvent;
  bool _isResending = false;
  bool _pendingResend = false;
  int _syntheticTimestamp = 0;

  @override
  void dispose() {
    _stopAutoScroll();
    super.dispose();
  }

  void _startAutoScroll() {
    _scrollTimer?.cancel();
    _scrollTimer = Timer.periodic(
      const Duration(milliseconds: 16), // ~60fps
      (_) => _performScroll(),
    );
  }

  void _stopAutoScroll() {
    _scrollTimer?.cancel();
    _scrollTimer = null;
    _scrollDelta = 0.0;
    _pendingResend = false;
  }

  void _performScroll() {
    if (!widget.scrollController.hasClients || _scrollDelta == 0.0) return;
    if (_pendingResend) return; // wait for previous resend to complete

    final pos = widget.scrollController.position;
    final newOffset =
        (pos.pixels + _scrollDelta).clamp(pos.minScrollExtent, pos.maxScrollExtent);

    if (newOffset != pos.pixels) {
      widget.scrollController.jumpTo(newOffset);
      // Wait for the frame to rebuild layout so Selectable children have
      // correct geometries before we re-dispatch the pointer event.
      _pendingResend = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _pendingResend = false;
        if (_pointerDown) _resendLastPointerEvent();
      });
    }
  }

  /// Re-dispatch the last pointer move event through the gesture system.
  /// Since the content has scrolled, the same screen position now maps to
  /// different content, causing SelectionArea to extend/shrink the selection.
  void _resendLastPointerEvent() {
    final event = _lastMoveEvent;
    if (event == null) return;

    _isResending = true;
    _syntheticTimestamp += 16;
    GestureBinding.instance.handlePointerEvent(
      PointerMoveEvent(
        pointer: event.pointer,
        position: event.position,
        delta: Offset.zero,
        buttons: event.buttons,
        kind: event.kind,
        device: event.device,
        timeStamp: event.timeStamp + Duration(milliseconds: _syntheticTimestamp),
      ),
    );
    _isResending = false;
  }

  void _onPointerDown(PointerDownEvent event) {
    _pointerDown = true;
  }

  void _onPointerUp(PointerUpEvent event) {
    _pointerDown = false;
    _lastMoveEvent = null;
    _syntheticTimestamp = 0;
    _stopAutoScroll();
  }

  void _onPointerCancel(PointerCancelEvent event) {
    _pointerDown = false;
    _lastMoveEvent = null;
    _stopAutoScroll();
  }

  void _onPointerMove(PointerMoveEvent event) {
    if (_isResending || !_pointerDown) return;

    _lastMoveEvent = event;

    final RenderBox? box = context.findRenderObject() as RenderBox?;
    if (box == null) return;

    final localPosition = box.globalToLocal(event.position);
    final height = box.size.height;
    final threshold = widget.edgeThreshold;
    final maxSpeed = widget.maxScrollSpeed;

    if (localPosition.dy < threshold) {
      // Near top edge → scroll up
      final proximity = 1.0 - (localPosition.dy / threshold).clamp(0.0, 1.0);
      _scrollDelta = -maxSpeed * proximity;
      if (_scrollTimer == null) _startAutoScroll();
    } else if (localPosition.dy > height - threshold) {
      // Near bottom edge → scroll down
      final proximity =
          1.0 - ((height - localPosition.dy) / threshold).clamp(0.0, 1.0);
      _scrollDelta = maxSpeed * proximity;
      if (_scrollTimer == null) _startAutoScroll();
    } else {
      _stopAutoScroll();
    }
  }

  @override
  Widget build(BuildContext context) {
    return Listener(
      onPointerDown: _onPointerDown,
      onPointerUp: _onPointerUp,
      onPointerCancel: _onPointerCancel,
      onPointerMove: _onPointerMove,
      child: widget.child,
    );
  }
}
