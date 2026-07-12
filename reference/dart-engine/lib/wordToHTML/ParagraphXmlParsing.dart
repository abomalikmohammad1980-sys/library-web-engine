part of 'Paragraph.dart';

/// Extracted from Paragraph.dart to keep the core class small while
/// preserving the same library-private access and rendering behavior.
mixin ParagraphXmlParsing on ParagraphMembers {
  void _setSectionType();
  void _processSdtContent(
    XmlElement sdtContent,
    bool isPageNumberSdt,
    RPr? prPr,
    PPr? pPr,
  );
  void fixPDirection();
  void getPAlign();
  void getPTextDirection();
  void getPageNum();
  void _extractBookmarks();
  dynamic getPRunsByType();

  Paragraph fromXml(
    XmlElement paragraphXml, {
    bool skipNumberingCounter = false,
  }) {
    pXml = paragraphXml;
    // حفظ XML للجداول فقط (مطلوب لـ ParagraphTable عند التحميل من الكاش)
    // الفقرات العادية لا تحتاج XML محفوظ - يتم بناؤها من runs
    // حفظ XML لجميع الفقرات لأغراض التصحيح (Debugging)
    // كان سابقاً: if (tbl) ... else xmlString = "";
    xmlString = paragraphXml.toXmlString(pretty: false);
    if (xmlString.isNotEmpty) {
      // Only print occasionally to avoid spam, or print specific markers
      if (xmlString.contains("PG:")) {
        debugPrint(
          "DEBUG: Parsed Paragraph with Marker. XML len: ${xmlString.length}",
        );
      }
    } else {
      debugPrint("DEBUG: Parsed Paragraph produced EMPTY XML!");
    }

    // debugPrint("DEBUG: Parsed Paragraph from XML. String length: ${xmlString.length}");
    XmlElement? xmlpPr = paragraphXml.getElement("w:pPr");
    if (xmlpPr != null)
      pPr = PPr(
        this as Paragraph,
      ).fromXml(xmlpPr, skipNumberingCounter: skipNumberingCounter);

    _setSectionType();

    XmlElement? xmlprPr = pPr?.styleRunProperties;
    text = paragraphXml.text.replaceAll(
      RegExp(r'\{\{PG:\d+\}\}'),
      '',
    ); // Re-add text assignment

    if (xmlprPr != null) {
      prPr = RPr(pPr!.getEmptyRun()).fromXml(xmlprPr);
    }

    // Fallback to defaultRPr if font is missing
    if (prPr != null && prPr!.font == null) {
      prPr!.font = pPr?.wordDocument.defaultRPr?.font;
    }

    runs = [];

    bool inFieldCode = false;
    bool pendingPageNum = false;
    bool pageNumReplaced =
        false; // Track if we already replaced the page number

    // Track HYPERLINK field codes
    bool inHyperlinkField = false;
    String? hyperlinkFieldUrl;
    final fieldInstructions = <String>[];

    void addFieldInstruction(String? instruction) {
      if (instruction == null || instruction.trim().isEmpty) return;
      fieldInstructions.add(instruction);
    }

    paragraphXml.childElements.forEach((element) {
      if (element.name.local == "r") {
        // Check for field characters to track state
        bool hasBegin = false;
        bool hasSeparate = false;
        bool hasEnd = false;

        for (var child in element.childElements) {
          if (child.name.local == "fldChar") {
            var type = child.getAttribute("w:fldCharType");
            if (type == "begin") hasBegin = true;
            if (type == "separate") hasSeparate = true;
            if (type == "end") hasEnd = true;
          }
        }

        if (hasBegin) inFieldCode = true;
        if (hasSeparate) inFieldCode = false;
        if (hasEnd) {
          inFieldCode = false;
        }

        for (var instrEl in element.findAllElements("w:instrText")) {
          addFieldInstruction(instrEl.text);
        }

        // Check for PAGE instruction
        if (inFieldCode || hasBegin) {
          if (element.findAllElements("w:instrText").any((e) {
            return e.text.toUpperCase().contains("PAGE");
          })) {
            pendingPageNum = true;
            pageNumReplaced = false; // Reset when starting a new PAGE field
          }
        }

        // Check for HYPERLINK instruction in field code
        if (inFieldCode || hasBegin) {
          for (var instrEl in element.findAllElements("w:instrText")) {
            String instrText = instrEl.text;
            if (instrText.toUpperCase().contains("HYPERLINK")) {
              // Extract URL from: HYPERLINK "url" or HYPERLINK "url" \l "bookmark"
              final urlRegex = RegExp(
                r'HYPERLINK.*?"([^"]+)"',
                caseSensitive: false,
              );
              final match = urlRegex.firstMatch(instrText);
              if (match != null) {
                hyperlinkFieldUrl = match.group(1);
                inHyperlinkField = true;
              }
            }
          }
        }

        // Create the run
        runT runt0;

        // If we're in a hyperlink field (after separate, before end), create HyperLinkRun
        if (inHyperlinkField &&
            !inFieldCode &&
            !hasBegin &&
            !hasSeparate &&
            !hasEnd) {
          runt0 = HyperLinkRun(this as Paragraph, prPr: prPr, pPr: pPr).fromXml(element);

          // Check if this is an internal bookmark (e.g. _Toc...) or external URL
          if (hyperlinkFieldUrl != null && hyperlinkFieldUrl!.startsWith("_")) {
            hyperlinkAnchor = hyperlinkFieldUrl;
            (runt0 as HyperLinkRun).url = null; // Don't style as link
          } else {
            (runt0 as HyperLinkRun).url = hyperlinkFieldUrl;
          }
        } else {
          runt0 = runT(
            this as Paragraph,
            prPr: prPr,
            pPr: pPr,
            customRelIdList: customRelIdList,
          ).fromXml(element);
        }

        if (inFieldCode && !hasSeparate && !hasEnd && !hasBegin) {
          runt0.text = "";
        }

        // --- NEW: Parse {{PG:X}} Page Number Marker ---
        // This marker is injected by the Python script (hidden text with double braces)
        if (runt0.text != null && runt0.text!.contains("{{PG:")) {
          final RegExp pgRegex = RegExp(r"\{\{PG:(\d+)\}\}");
          final match = pgRegex.firstMatch(runt0.text!);
          if (match != null) {
            String? pageStr = match.group(1);
            if (pageStr != null) {
              pageNum = pageStr; // Set the paragraph's page number
              // print(
              //   "DEBUG PARA: Found marker {{PG:$pageNum}} - text preview: ${text.substring(0, text.length > 30 ? 30 : text.length)}...",
              // );
              // Remove the marker from the text so it doesn't show up
              runt0.text = runt0.text!.replaceAll(match.group(0)!, "");
            }
          }
        }
        // ---------------------------------------------

        if (element.findAllElements("w:instrText").isNotEmpty) {
          runt0.text = "";
        }

        if (runt0.text != null &&
            runt0.text!.toUpperCase().contains("PAGEREF")) {
          runt0.text = "";
        }

        // Replace PAGE field result - ONLY ONCE
        // We replace if we are tracking a PAGE field (pendingPageNum)
        // AND we haven't already replaced (pageNumReplaced is false)
        // AND we are not in the instruction part (inFieldCode is false)
        // AND we are not starting a new field (hasBegin)
        if (pendingPageNum &&
            !pageNumReplaced &&
            !inFieldCode &&
            !hasBegin &&
            customPageNumber != null) {
          runt0.text = customPageNumber!;
          pageNumReplaced = true;
        } else if (pendingPageNum && pageNumReplaced && !hasEnd) {
          // Skip additional runs inside PAGE field after we've already replaced
          runt0.text = "";
        }

        if (hasEnd) {
          pendingPageNum = false;
          pageNumReplaced = false; // Reset for next field
          // Reset hyperlink field tracking
          inHyperlinkField = false;
          hyperlinkFieldUrl = null;
        }

        runt0.parent = this as Paragraph;
        pPr?.parent = this as Paragraph;
        prPr?.parent = runt0;
        runs.add(runt0);
      } else if (element.name.local == "fldSimple") {
        String? instr = element.getAttribute("w:instr");
        addFieldInstruction(instr);

        // Check for HYPERLINK in fldSimple
        if (instr != null && instr.toUpperCase().contains("HYPERLINK")) {
          // Extract URL from: HYPERLINK "url"
          final urlRegex = RegExp(
            r'HYPERLINK\s+"([^"]+)"',
            caseSensitive: false,
          );
          final match = urlRegex.firstMatch(instr);
          String? url = match?.group(1);

          // Process children as HyperLinkRun
          element.childElements.forEach((child) {
            if (child.name.local == "r") {
              HyperLinkRun run = HyperLinkRun(
                this as Paragraph,
                prPr: prPr,
                pPr: pPr,
              ).fromXml(child);

              if (url != null && url.startsWith("_")) {
                hyperlinkAnchor = url;
                run.url = null;
              } else {
                run.url = url;
              }
              run.parent = this as Paragraph;
              runs.add(run);
            }
          });
        } else if (instr != null &&
            instr.contains("PAGE") &&
            customPageNumber != null) {
          runT runt0 = runT(
            this as Paragraph,
            prPr: prPr,
            pPr: pPr,
            customRelIdList: customRelIdList,
          );
          // Try to get formatting from the first run inside fldSimple if available
          var firstRun = element.findElements("w:r").firstOrNull;
          if (firstRun != null) {
            runt0 = runT(
              this as Paragraph,
              prPr: prPr,
              pPr: pPr,
              customRelIdList: customRelIdList,
            ).fromXml(firstRun);
          }
          runt0.text = customPageNumber!;
          runs.add(runt0);
        } else {
          // Process children normally
          element.childElements.forEach((child) {
            if (child.name.local == "r") {
              runT runt0 = runT(
                this as Paragraph,
                prPr: prPr,
                pPr: pPr,
                customRelIdList: customRelIdList,
              ).fromXml(child);
              runs.add(runt0);
            }
          });
        }
      }
      // Handle w:sdt (Structured Document Tag) - commonly used for page numbers in footers
      else if (element.name.local == "sdt") {
        // Check if this sdt contains a page number (docPartGallery with "Page Numbers")
        var sdtPr = element.getElement("w:sdtPr");
        var docPartObj = sdtPr?.getElement("w:docPartObj");
        var gallery = docPartObj?.getElement("w:docPartGallery");
        String? galleryVal = gallery?.getAttribute("w:val");
        bool isPageNumberSdt =
            galleryVal != null && galleryVal.contains("Page Numbers");

        // Get content from sdtContent
        var sdtContent = element.getElement("w:sdtContent");
        if (sdtContent != null) {
          // Process all runs inside sdtContent
          _processSdtContent(sdtContent, isPageNumberSdt, prPr, pPr);
        }
      }
      // Handle w:hyperlink - External links
      else if (element.name.local == "hyperlink") {
        // Extract Relationship ID (r:id) to find external URL
        String? rId = element.getAttribute("r:id");
        String? url;

        // Extract tooltip text (w:tooltip attribute)
        String? tooltip = element.getAttribute("w:tooltip");

        // Look up URL in document relationships
        // Use customRelIdList for headers/footers, fall back to main document
        if (rId != null) {
          final rels = customRelIdList ?? parent.parent.relIdList;
          if (rels.containsKey(rId)) {
            url = rels[rId]?.Target;
          }
        }

        // Also extract anchor for TOC navigation
        String? anchor = element.getAttribute("w:anchor");
        if (anchor != null) {
          hyperlinkAnchor = anchor;
        }

        // Process child runs as HyperLinkRun
        element.childElements.forEach((child) {
          if (child.name.local == "r") {
            HyperLinkRun run = HyperLinkRun(
              this as Paragraph,
              prPr: prPr,
              pPr: pPr,
            ).fromXml(child);

            if (url != null && url.startsWith("_")) {
              hyperlinkAnchor = url;
              run.url = null;
            } else {
              run.url = url;
            }
            run.parent = this as Paragraph;
            runs.add(run);
          }
        });
      }
    });
    _applyStyleRefHeaderFooterOverride(paragraphXml, fieldInstructions);
    text = runs
        .map((run) => run.text ?? '')
        .where((part) => part.isNotEmpty)
        .join();
    suppressHyperlinkStyleInheritance =
        HyperlinkDisplayContextResolver.detectFromFieldInstructions(
          hyperlinkAnchor: hyperlinkAnchor,
          fieldInstructions: fieldInstructions,
        );
    fixPDirection();
    getPAlign();
    getPTextDirection();
    getPageNum();
    // Note: checkHyperLink() was removed because hyperlinks are already processed
    // in the main loop above (element.name.local == "hyperlink").
    // Calling it here would cause duplicate hyperlink runs.
    _extractBookmarks(); // Extract bookmarks from paragraph level
    getPRunsByType();
    return this as Paragraph;
  }

  void _applyStyleRefHeaderFooterOverride(
    XmlElement paragraphXml,
    List<String> fieldInstructions,
  ) {
    if (!isHeaderParagraph && !isFooterParagraph && !resolveHeaderFooterFields) {
      return;
    }
    if (runs.isEmpty || fieldInstructions.isEmpty) return;

    final spec = StyleRefResolver.parseFieldInstruction(
      fieldInstructions.join(' '),
    );
    if (spec == null) return;

    final resolvedText = StyleRefResolver.resolveElectronicHeaderFooter(
      wordDocument: parent.parent,
      pageIndex: parent.pageIndex,
      spec: spec,
    );
    if (resolvedText == null || resolvedText.trim().isEmpty) return;

    final resultRunIndices = <int>[];
    int runIndex = -1;
    bool inField = false;
    bool inResult = false;
    StringBuffer currentInstruction = StringBuffer();
    StyleRefFieldSpec? currentSpec;

    for (final element in paragraphXml.childElements) {
      if (element.name.local != 'r') continue;
      runIndex++;
      if (runIndex >= runs.length) break;

      bool hasBegin = false;
      bool hasSeparate = false;
      bool hasEnd = false;

      for (final child in element.childElements) {
        if (child.name.local != 'fldChar') continue;
        final type = child.getAttribute('w:fldCharType');
        if (type == 'begin') hasBegin = true;
        if (type == 'separate') hasSeparate = true;
        if (type == 'end') hasEnd = true;
      }

      if (hasBegin) {
        inField = true;
        inResult = false;
        currentInstruction = StringBuffer();
        currentSpec = null;
        resultRunIndices.clear();
      }

      if (inField && !inResult) {
        for (final instr in element.findAllElements('w:instrText')) {
          currentInstruction.write(instr.text);
        }
      }

      if (hasSeparate) {
        inResult = true;
        currentSpec = StyleRefResolver.parseFieldInstruction(
          currentInstruction.toString(),
        );
        continue;
      }

      if (inResult &&
          currentSpec != null &&
          element.findAllElements('w:instrText').isEmpty &&
          !hasBegin &&
          !hasEnd) {
        final runText = runs[runIndex].text ?? '';
        if (runText.isNotEmpty) {
          resultRunIndices.add(runIndex);
        }
      }

      if (hasEnd) {
        if (currentSpec != null &&
            currentSpec.styleIdentifier == spec.styleIdentifier &&
            resultRunIndices.isNotEmpty) {
          runs[resultRunIndices.first].text = resolvedText;
          for (final index in resultRunIndices.skip(1)) {
            runs[index].text = '';
          }
          return;
        }
        inField = false;
        inResult = false;
        currentSpec = null;
        resultRunIndices.clear();
      }
    }
  }
}
