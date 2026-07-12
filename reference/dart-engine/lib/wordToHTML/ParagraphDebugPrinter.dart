part of 'Paragraph.dart';

/// Writes a focused diagnostic dump for one [Paragraph].
///
/// This keeps debug-only file IO and archive inspection outside the rendering
/// class. It intentionally reads the paragraph's already-parsed fields instead
/// of reparsing XML, so the dump describes the state the renderer actually uses.
class ParagraphDebugPrinter {
  const ParagraphDebugPrinter._();

  static Future<void> write(Paragraph paragraph) async {
    final buffer = StringBuffer()
      ..writeln("=== Paragraph XML Debug ===")
      ..writeln("Section Type: ${paragraph.sectionType}")
      ..writeln("Is Header: ${paragraph.isHeaderParagraph}")
      ..writeln("");

    _writeParagraphXml(paragraph, buffer);
    _writeFonts(paragraph, buffer);
    _writeRuns(paragraph, buffer);
    _writeImageRuns(paragraph, buffer);
    _writeFootnoteArchiveXml(paragraph, buffer);

    await _writeToDisk(buffer);
  }

  static void _writeParagraphXml(Paragraph paragraph, StringBuffer buffer) {
    if (paragraph.xmlString.isNotEmpty) {
      buffer.writeln(paragraph.xmlString);
    } else if (paragraph.pXml != null) {
      buffer.writeln(paragraph.pXml!.toXmlString(pretty: true));
    } else {
      buffer.writeln("No XML found for this paragraph.");
    }
  }

  static void _writeFonts(Paragraph paragraph, StringBuffer buffer) {
    buffer
      ..writeln("")
      ..writeln("--- FONTS USED ---");

    var runIndex = 1;
    for (final run in paragraph.textRunTs) {
      var preview = run.text ?? "";
      if (preview.length > 20) preview = "${preview.substring(0, 20)}...";
      preview = preview.replaceAll("\n", "\\n");

      if (preview.trim().isEmpty) continue;

      buffer.writeln(
        "Run $runIndex (\"$preview\"): Ar: ${run.rpr?.font} | En: ${run.rpr?.enFont}",
      );
      runIndex++;
    }
  }

  static void _writeRuns(Paragraph paragraph, StringBuffer buffer) {
    buffer
      ..writeln("")
      ..writeln("--- ALL RUNS (${paragraph.runs.length} total) ---");

    var idx = 0;
    for (final run in paragraph.runs) {
      idx++;
      final image = run.image;
      final imgInfo = image == null
          ? "NO IMAGE"
          : "rId=${image.rId}, wrapMode=${image.wrapMode}, relFromV=${image.relativeFromV}, mem=${image.imageMemory != null ? '${image.imageMemory!.length}b' : 'null'}";
      var textPreview = run.text ?? "";
      if (textPreview.length > 15) {
        textPreview = "${textPreview.substring(0, 15)}...";
      }
      buffer.writeln("Run $idx: text=\"$textPreview\" | $imgInfo");
    }
  }

  static void _writeImageRuns(Paragraph paragraph, StringBuffer buffer) {
    buffer
      ..writeln("")
      ..writeln(
        "--- imageRunTs (${paragraph.imageRunTs.length}) | textRunTs (${paragraph.textRunTs.length}) ---",
      );

    for (final run in paragraph.imageRunTs) {
      final image = run.image;
      if (image == null) continue;

      buffer
        ..writeln("Image rId: ${image.rId}")
        ..writeln("  Width: ${image.width}, Height: ${image.height}")
        ..writeln("  Has imageMemory: ${image.imageMemory != null}");

      final imageMemory = image.imageMemory;
      if (imageMemory == null) continue;

      buffer.writeln("  imageMemory length: ${imageMemory.length} bytes");
      if (imageMemory.length > 4) {
        buffer.writeln("  First 4 bytes: ${imageMemory.take(4).toList()}");
      }
    }
  }

  static void _writeFootnoteArchiveXml(
    Paragraph paragraph,
    StringBuffer buffer,
  ) {
    if (paragraph.sectionType != 'footnote') return;

    buffer
      ..writeln("")
      ..writeln("=== FOOTNOTE RAW XML FROM ARCHIVE ===");

    try {
      final archive = paragraph.parent.parent.archive;
      if (archive == null) {
        buffer.writeln("Archive not available (book loaded from cache?)");
        return;
      }

      final footnotesFile = archive.toMap()['word/footnotes.xml'];
      if (footnotesFile == null) {
        buffer.writeln("footnotes.xml not found in archive");
        return;
      }

      debugDumpFootnotesXml(footnotesFile);
      buffer.writeln("Full footnotes.xml dumped to footnotes_debug.xml");
    } catch (e) {
      buffer.writeln("Error dumping footnote XML: $e");
    }
  }

  static Future<void> _writeToDisk(StringBuffer buffer) async {
    try {
      final file = File(
        'd:/ImportantProjects/golden_shamela/paragraph_debug.xml',
      );
      await file.writeAsString(buffer.toString());
      print("DEBUG: Paragraph XML saved to ${file.path}");
    } catch (e) {
      print("DEBUG: Error saving paragraph XML: $e");
      print(buffer.toString());
    }
  }
}
