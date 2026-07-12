import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:golden_shamela/Models/WordPage.dart';
import 'package:golden_shamela/Styles/AppResourses.dart';
import 'package:golden_shamela/Styles/TextSyles.dart';
import 'package:url_launcher/url_launcher.dart';

// This is the layout delegate that positions the menu.
class _ContextMenuLayoutDelegate extends SingleChildLayoutDelegate {
  _ContextMenuLayoutDelegate({required this.anchor});

  final Offset anchor;

  @override
  BoxConstraints getConstraintsForChild(BoxConstraints constraints) {
    return constraints.loosen();
  }

  @override
  Offset getPositionForChild(Size size, Size childSize) {
    // size is the size of the overlay.
    // childSize is the size of the menu.
    // anchor is the position of the right-click.

    double x = anchor.dx;
    double y = anchor.dy;

    // Avoid overflowing the right edge.
    if (x + childSize.width > size.width) {
      x = size.width - childSize.width;
    }
    // Avoid overflowing the left edge.
    if (x < 0) {
      x = 0;
    }
    // Avoid overflowing the bottom edge.
    if (y + childSize.height > size.height) {
      y = y - childSize.height;
    }

    return Offset(x, y);
  }

  @override
  bool shouldRelayout(_ContextMenuLayoutDelegate oldDelegate) {
    return anchor != oldDelegate.anchor;
  }
}

class CustomTextSelectionControls extends MaterialTextSelectionControls {
  CustomTextSelectionControls({
    required this.bookTitle,
    required this.pageNumber,
    required this.wordPage,
  });

  final String bookTitle;
  final int pageNumber;
  final WordPage wordPage;

  void _handleCopyReference(TextSelectionDelegate delegate) {
    final String selectedText = delegate.textEditingValue.selection.textInside(
      delegate.textEditingValue.text,
    );
    if (selectedText.isNotEmpty) {
      final String textToCopy =
          '«$selectedText» [$bookTitle (ص $pageNumber)]';
      Clipboard.setData(ClipboardData(text: textToCopy));
      delegate.hideToolbar();
    }
  }

  void _handleCopyPage(TextSelectionDelegate delegate) {
    final String pageText = wordPage.text();
    Clipboard.setData(ClipboardData(text: pageText));
    delegate.hideToolbar();
  }

  // _handlePrintXml removed per user request

  void _handleGoogleSearch(TextSelectionDelegate delegate) async {
    final String selectedText = delegate.textEditingValue.selection.textInside(
      delegate.textEditingValue.text,
    );
    if (selectedText.isNotEmpty) {
      final Uri googleUrl = Uri.parse(
        'https://www.google.com/search?q=${Uri.encodeComponent(selectedText)}',
      );
      if (await canLaunchUrl(googleUrl)) {
        await launchUrl(googleUrl);
      } else {
        debugPrint('Could not launch $googleUrl');
      }
      delegate.hideToolbar();
    }
  }

  Widget _buildMenuItem({
    required String label,
    required VoidCallback? onPressed,
  }) {
    return InkWell(
      onTap: onPressed,
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8.0, horizontal: 16.0),
        child: Text(
          label,
          style: normalStyle(
            color: onPressed != null ? Colors.white : Colors.grey,
          ),
        ),
      ),
    );
  }

  @override
  Widget buildToolbar(
    BuildContext context,
    Rect globalEditableRegion,
    double textLineHeight,
    Offset selectionMidpoint,
    List<TextSelectionPoint> endpoints,
    TextSelectionDelegate delegate,
    ValueListenable<ClipboardStatus>? clipboardStatus,
    Offset? lastSecondaryTapDownPosition,
  ) {
    final bool isCopyEnabled = canCopy(delegate);
    final bool isSelectAllEnabled = canSelectAll(delegate);

    final List<Widget> menuItems = <Widget>[
      _buildMenuItem(
        label: 'نسخ',
        onPressed: isCopyEnabled ? () => handleCopy(delegate) : null,
      ),
      _buildMenuItem(
        label: 'نسخ مع المرجع',
        onPressed: isCopyEnabled ? () => _handleCopyReference(delegate) : null,
      ),
      _buildMenuItem(
        label: 'نسخ الصفحة',
        onPressed: () => _handleCopyPage(delegate),
      ),

      _buildMenuItem(
        label: 'بحث',
        onPressed: () {
          // debugPrint("Search action triggered");
          delegate.hideToolbar();
        },
      ),
      _buildMenuItem(
        label: 'بحث في جوجل',
        onPressed: isCopyEnabled ? () => _handleGoogleSearch(delegate) : null,
      ),
      _buildMenuItem(
        label: 'تحديد الفقرة',
        onPressed: isSelectAllEnabled ? () => handleSelectAll(delegate) : null,
      ),
    ];

    // If there's no specific tap position, fallback to the default toolbar.
    if (lastSecondaryTapDownPosition == null) {
      return TextSelectionToolbar(
        anchorAbove: endpoints.first.point,
        anchorBelow: endpoints.last.point,
        children: menuItems,
      );
    }

    return CustomSingleChildLayout(
      delegate: _ContextMenuLayoutDelegate(
        anchor: lastSecondaryTapDownPosition,
      ),
      child: Material(
        color: Colors.transparent,
        child: Container(
          decoration: BoxDecoration(
            color: primaryColor,
            borderRadius: BorderRadius.circular(8.0),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.2),
                blurRadius: 4.0,
                offset: const Offset(2, 2),
              ),
            ],
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: menuItems,
          ),
        ),
      ),
    );
  }
}
