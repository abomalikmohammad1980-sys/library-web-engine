import 'package:xml/xml.dart';

class PageAnchorPrefixAnalysis {
  final bool hasVisiblePreContent;
  final int leadingStructuralStart;

  const PageAnchorPrefixAnalysis({
    required this.hasVisiblePreContent,
    required this.leadingStructuralStart,
  });
}

class PageAnchorParagraphResolver {
  static List<int>? resolvePageNumbers(XmlElement paragraph) {
    if (!_isPurePageAnchorParagraph(paragraph)) {
      return null;
    }

    final pageNumbers = <int>[];

    for (final bookmark in paragraph.findElements("w:bookmarkStart")) {
      final name = bookmark.getAttribute("w:name");
      if (name == null || !name.startsWith("TheLibraryPage_")) {
        continue;
      }

      final page = int.tryParse(name.substring("TheLibraryPage_".length));
      if (page != null) {
        pageNumbers.add(page);
      }
    }

    return pageNumbers.isEmpty ? null : pageNumbers;
  }

  static PageAnchorPrefixAnalysis analyzeLeadingPrefix(
    List<XmlElement> children,
    int firstMarkerIdx,
  ) {
    bool hasVisiblePreContent = false;
    int leadingStructuralStart = firstMarkerIdx;

    for (int i = 0; i < firstMarkerIdx; i++) {
      final child = children[i];

      if (child.name.local == "pPr") {
        continue;
      }

      if (_isLeadingStructuralNode(child)) {
        if (leadingStructuralStart == firstMarkerIdx) {
          leadingStructuralStart = i;
        }
        continue;
      }

      hasVisiblePreContent = true;
      break;
    }

    return PageAnchorPrefixAnalysis(
      hasVisiblePreContent: hasVisiblePreContent,
      leadingStructuralStart: leadingStructuralStart,
    );
  }

  static bool _isPurePageAnchorParagraph(XmlElement paragraph) {
    bool sawPageBookmark = false;

    for (final child in paragraph.children) {
      if (child is! XmlElement) continue;

      if (child.name.local == "pPr") {
        continue;
      }

      if (_isLeadingStructuralNode(child)) {
        if (child.name.local == "bookmarkStart") {
          final name = child.getAttribute("w:name");
          if (name != null && name.startsWith("TheLibraryPage_")) {
            sawPageBookmark = true;
          }
        }
        continue;
      }

      if (child.name.local != "r") {
        return false;
      }

      final runText = child.findAllElements("w:t").map((t) => t.text).join("");
      final visibleText = runText
          .replaceAll(RegExp(r"\{\{PG:\d+\}\}"), "")
          .trim();
      if (visibleText.isNotEmpty) {
        return false;
      }

      final hasVisibleNonTextContent = child.descendants
          .whereType<XmlElement>()
          .any((element) {
            switch (element.name.local) {
              case 'drawing':
              case 'pict':
              case 'object':
              case 'tab':
              case 'sym':
              case 'footnoteReference':
              case 'endnoteReference':
                return true;
              default:
                return false;
            }
          });

      if (hasVisibleNonTextContent) {
        return false;
      }
    }

    return sawPageBookmark;
  }

  static bool _isLeadingStructuralNode(XmlElement element) {
    switch (element.name.local) {
      case 'bookmarkStart':
      case 'bookmarkEnd':
      case 'proofErr':
      case 'permStart':
      case 'permEnd':
      case 'commentRangeStart':
      case 'commentRangeEnd':
      case 'moveFromRangeStart':
      case 'moveFromRangeEnd':
      case 'moveToRangeStart':
      case 'moveToRangeEnd':
        return true;
      default:
        return false;
    }
  }
}
