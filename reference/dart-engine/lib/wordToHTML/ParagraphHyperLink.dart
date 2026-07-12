import 'package:golden_shamela/wordToHTML/Paragraph.dart';
import 'package:golden_shamela/wordToHTML/HyperLinkRun.dart';

const SDT_ROW_HTML = "sdtr";

extension Paragraphhyperlink on ParagraphMembers {
  void checkHyperLink() {
    final hyperlinkElement = pXml?.getElement("w:hyperlink");
    if (hyperlinkElement == null) return;

    // Extract anchor for TOC navigation (e.g., "_Toc123456")
    hyperlinkAnchor = hyperlinkElement.getAttribute("w:anchor");

    // Extract Relationship ID (r:id) to find external URL
    String? rId = hyperlinkElement.getAttribute("r:id");
    String? url;

    // Extract tooltip text (w:tooltip attribute)
    String? tooltip = hyperlinkElement.getAttribute("w:tooltip");

    // Look up URL in document relationships
    if (rId != null) {
      // Use customRelIdList for headers/footers (they have their own .rels file)
      // Fall back to main document relationships if customRelIdList is not set
      final rels = customRelIdList ?? parent.parent.relIdList;
      if (rels.containsKey(rId)) {
        url = rels[rId]?.Target;
      }
    }

    hyperlinkElement.childElements.forEach((e) {
      if (e.name.local == "r") {
        HyperLinkRun run = HyperLinkRun(this, prPr: prPr, pPr: pPr).fromXml(e);
        run.url = url; // Assign the extracted URL
        run.tooltip = tooltip; // Assign the tooltip
        run.parent = this;
        runs.add(run);
      } else {
        // print("hyperLinkChild new: ${e.localName}");
      }
    });
  }

  bool isSdtRow() {
    return pXml?.getAttribute("isSdtRow") == "True";
  }
}
