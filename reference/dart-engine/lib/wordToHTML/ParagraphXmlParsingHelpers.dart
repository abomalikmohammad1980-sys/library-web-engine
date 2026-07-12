part of 'Paragraph.dart';

/// XML parsing helper routines kept separate from the main fromXml flow.
/// They still live in the same library so private paragraph state remains intact.
mixin ParagraphXmlParsingHelpers on ParagraphMembers {
  /// Process content inside a w:sdt (Structured Document Tag)
  /// This handles page numbers and other structured content in footers
  void _processSdtContent(
    XmlElement sdtContent,
    bool isPageNumberSdt,
    RPr? prPr,
    PPr? pPr,
  ) {
    int fieldDepth = 0; // Track nested field depth
    bool currentFieldIsPage = false;
    bool currentFieldIsNumPages = false;
    bool currentFieldHasSeparate = false;
    bool pageNumReplaced =
        false; // Track if we already replaced the page number
    for (var child in sdtContent.childElements) {
      // Handle fldSimple inside SDT
      if (child.name.local == "fldSimple") {
        String? instr = child.getAttribute("w:instr");
        if (instr != null &&
            instr.contains("PAGE") &&
            customPageNumber != null) {
          runT runt0 = runT(
            this as Paragraph,
            prPr: prPr,
            pPr: pPr,
            customRelIdList: customRelIdList,
          );
          // Try to get formatting from the first run inside fldSimple
          var firstRun = child.findElements("w:r").firstOrNull;
          if (firstRun != null) {
            runt0 = runT(
              this as Paragraph,
              prPr: prPr,
              pPr: pPr,
              customRelIdList: customRelIdList,
            ).fromXml(firstRun);
          }
          runt0.text = customPageNumber!;
          runt0.parent = this as Paragraph;
          runs.add(runt0);
          continue;
        }
      }

      if (child.name.local == "r") {
        // Check for field characters
        bool hasBegin = false;
        bool hasSeparate = false;
        bool hasEnd = false;

        for (var el in child.childElements) {
          if (el.name.local == "fldChar") {
            var type = el.getAttribute("w:fldCharType");
            if (type == "begin") hasBegin = true;
            if (type == "separate") hasSeparate = true;
            if (type == "end") hasEnd = true;
          }
        }

        // Track field depth
        if (hasBegin) {
          fieldDepth++;
          // Reset field type flags for new field
          if (fieldDepth == 1) {
            currentFieldIsPage = false;
            currentFieldIsNumPages = false;
            currentFieldHasSeparate = false;
          }
        }

        // Check for field instructions when in a field
        if (fieldDepth > 0) {
          var instrTexts = child.findAllElements("w:instrText");
          for (var instr in instrTexts) {
            String instrText = instr.text.trim().toUpperCase();
            if (instrText.contains("NUMPAGES")) {
              currentFieldIsNumPages = true;
            } else if (instrText.contains("PAGE")) {
              currentFieldIsPage = true;
            }
          }
        }

        runT runt0 = runT(
          this as Paragraph,
          prPr: prPr,
          pPr: pPr,
          customRelIdList: customRelIdList,
        ).fromXml(child);

        // Clear instrText content
        if (child.findAllElements("w:instrText").isNotEmpty) {
          runt0.text = "";
        }

        // Skip field character runs (begin, separate, end)
        if (hasBegin || hasSeparate) {
          if (hasSeparate && fieldDepth > 0) {
            currentFieldHasSeparate = true;
          }
          continue;
        }

        if (hasEnd) {
          fieldDepth--;
          if (fieldDepth <= 0) {
            fieldDepth = 0;
            currentFieldIsPage = false;
            currentFieldIsNumPages = false;
            currentFieldHasSeparate = false;
          }
          continue;
        }

        // Skip NUMPAGES result (when inside NUMPAGES field)
        if (currentFieldIsNumPages && fieldDepth > 0 && currentFieldHasSeparate) {
          continue;
        }

        // Handle PAGE field content
        if (currentFieldIsPage && fieldDepth > 0 && currentFieldHasSeparate) {
          if (!pageNumReplaced && customPageNumber != null) {
            // First run inside PAGE field - replace with actual page number
            runt0.text = customPageNumber!;
            pageNumReplaced = true;
          } else {
            // Additional runs inside PAGE field - skip them (e.g., if cached value spans multiple runs)
            continue;
          }
        }

        if (runt0.text == null || runt0.text!.isEmpty) {
          continue;
        }
        runt0.parent = this as Paragraph;
        runs.add(runt0);
      }
    }
  }

  /// Determines the section type for search indexing purposes.
  ///
  /// **Database Architect Note**: This method accurately classifies paragraphs into:
  /// - `title`: Main headings, sub-headings (Heading1-9, Title, TOC, etc.)
  /// - `main`: Regular body text (default)
  /// - `footnote`: Set separately in DocFootNotes.dart
  ///
  /// Note: 'comment' type is NOT used as it's under development.
  void _setSectionType() {
    String? style = pPr?.pStyle?.toLowerCase();
    if (style == null) {
      sectionType = 'main';
      return;
    }

    // Check for common heading/title style patterns in Word documents
    // This covers English and Arabic document styles
    if (style.startsWith('heading') || // Heading1, Heading2, etc.
        style.startsWith('toc') || // Table of Contents entries
        style == 'title' || // Title style
        style == 'subtitle' || // Subtitle style
        style.contains('heading') || // Custom heading styles
        style.contains('عنوان') || // Arabic: "عنوان" = Title
        style.contains('رأس') || // Arabic: "رأس" = Head
        style.contains('فصل') || // Arabic: "فصل" = Chapter
        style.contains('باب') || // Arabic: "باب" = Section/Gate
        style.contains('مطلب') || // Arabic: "مطلب" = Requirement/Section
        style.contains('مبحث') || // Arabic: "مبحث" = Topic
        style.contains('فرع') || // Arabic: "فرع" = Branch/Sub-section
        style.contains('مسألة')) {
      // Arabic: "مسألة" = Issue/Question
      sectionType = 'title';
    } else {
      sectionType = 'main';
    }
  }

  getPRunsByType() {
    imageRunTs = [];
    textRunTs = [];
    runs.forEach((runt) {
      final image = runt.image;
      final isSpecialDebugRid =
          image != null && RegExp(r'^rId(1[3-9])$').hasMatch(image.rId);
      final isVmlShape = image != null && image.vmlShapeData != null;
      // 1. Floating Images (wrapMode != null)
      if (image != null && image.wrapMode != null) {
        // Header/footer paragraphs: keep ALL floating images here since they are
        // not handled by WordPage.dart (headers render independently).
        // Decorative elements (lines, shapes) intentionally span the full page width.
        if (isHeaderParagraph) {
          imageRunTs.add(runt);
        }
        // Page content paragraphs: If relative to paragraph/line OR IS GROUP, add to Paragraph Stack.
        // EXCEPTION: paragraph-relative images that EXCEED the content area
        // (full-page covers) go to page level for correct rendering beyond margins.
        else if ((runt.isRelativeFromVParagraph() &&
                !_exceedsContentArea(runt)) ||
            image.isGroup) {
          imageRunTs.add(runt);
        } else if (isVmlShape) {
          // VML shape with absolute positioning NOT in header and NOT paragraph-relative
          // is handled on the page level, not inside the paragraph text flow.
        }
        // If relative to page/margin, IGNORE here (handled by WordPage.dart)
        // This prevents them from polluting textRunTs and triggering inline logic.
      }
      // 2. Text and Inline Images (wrapMode == null)
      else {
        textRunTs.add(runt);
      }
    });
    return {"iRuns": imageRunTs, "tRuns": textRunTs};
  }

  /// Check if a run's image exceeds the content area (used to detect full-page covers)
  bool _exceedsContentArea(runT runt) {
    var sp = parent.parent.getSectPrForPage(parent.pageIndex);
    double contentW = (sp.width ?? 595) - sp.leftMargin - sp.rightMargin;
    double contentH = (sp.height ?? 842) - sp.topMargin - sp.bottomMargin;
    return runt.image!.width > contentW + 20 ||
        runt.image!.height > contentH + 20;
  }

}
