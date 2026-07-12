import 'dart:io';
import 'dart:typed_data';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import 'package:golden_shamela/Utils/ImageParser.dart';
import 'package:golden_shamela/wordToHTML/HeaderFooterDotLeader.dart';
import 'package:golden_shamela/wordToHTML/FooterFloatingPositionResolver.dart';
import 'package:golden_shamela/wordToHTML/HyperLinkRun.dart';
import 'package:golden_shamela/wordToHTML/ParagraphStrutResolver.dart';
import 'package:golden_shamela/wordToHTML/PageFieldDisplayNumeralResolver.dart';
import 'package:golden_shamela/wordToHTML/PositionalTabLayout.dart';
import 'package:golden_shamela/wordToHTML/RtlWidgetSpanFixer.dart';
import 'package:golden_shamela/wordToHTML/StyleRefResolver.dart';
import 'package:golden_shamela/Models/WordPage.dart';
import 'package:golden_shamela/wordToHTML/HyperlinkDisplayContextResolver.dart';
import 'package:golden_shamela/wordToHTML/runT.dart';
import 'package:golden_shamela/wordToHTML/RPr.dart';
import 'package:golden_shamela/wordToHTML/TabStop.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:xml/xml.dart';
import 'package:golden_shamela/wordToHTML/DocRelations.dart';

import 'package:golden_shamela/Utils/json_converters.dart';
import 'package:golden_shamela/wordToHTML/ParagraphTable.dart';

import '../WordToWidget/ImageToWidget.dart';
import '../core/app_state.dart';
import '../Utils/ArchiveToXml.dart';
import 'DocFootNotes.dart';
import 'PPr.dart';

part 'Paragraph.g.dart';
part 'ParagraphMembers.dart';
part 'ParagraphBorderSpec.dart';
part 'ParagraphDebugPrinter.dart';
part 'ParagraphTocNavigator.dart';
part 'ParagraphXmlParsing.dart';
part 'ParagraphXmlParsingHelpers.dart';
part 'ParagraphLayoutFlags.dart';
part 'ParagraphRendering.dart';
part 'ParagraphDecoration.dart';
part 'ParagraphTocRendering.dart';
part 'ParagraphFloatingImages.dart';
part 'ParagraphInlineSpans.dart';

@JsonSerializable(explicitToJson: true, constructor: 'empty')
class Paragraph with
    ParagraphMembers,
    ParagraphXmlParsingHelpers,
    ParagraphLayoutFlags,
    ParagraphInlineSpans,
    ParagraphXmlParsing,
    ParagraphDecoration,
    ParagraphTocRendering,
    ParagraphFloatingImages,
    ParagraphRendering {
  PPr? pPr;
  RPr? prPr;

  @JsonKey(ignore: true)
  String? customPageNumber;
  @JsonKey(ignore: true)
  String? _cachedRenderedPlainText;
  List<runT> runs = [];
  String text = ""; // Reverted to field
  @JsonKey(ignore: true)
  XmlElement? pXml;
  String xmlString = ""; // Store XML as string for debugging
  String pageNum = "";
  List<runT> imageRunTs = [];
  List<runT> textRunTs = [];
  @TextAlignConverter()
  TextAlign textAlign = TextAlign.start;
  @JsonKey(ignore: true)
  WordPage parent;
  @TextDirectionConverter()
  TextDirection textDirection = TextDirection.rtl;
  String sectionType = 'main'; // Default to 'main'

  /// Hyperlink anchor for TOC navigation (e.g., "_Toc123456")
  /// Extracted from w:hyperlink during XML parsing for cache persistence
  String? hyperlinkAnchor;

  /// Word keeps field-result hyperlinks functional while formatting their
  /// visible text from the field context instead of the Hyperlink character
  /// style. This flag records that XML-driven display context.
  bool suppressHyperlinkStyleInheritance = false;

  @JsonKey(ignore: true)
  Map<String, RelId>? customRelIdList; // For parsing headers/footers with their own relationships

  /// Flag to indicate this paragraph is in a header (images should be semi-transparent)
  @JsonKey(ignore: true)
  bool isHeaderParagraph = false;

  @JsonKey(ignore: true)
  bool isFooterParagraph = false;

  /// Some paragraphs are parsed through nested containers such as
  /// `v:textbox`, so marking them as header/footer would also trigger
  /// header-specific layout rules. This narrower flag is only for dynamic
  /// header/footer field resolution such as STYLEREF.
  @JsonKey(ignore: true)
  bool resolveHeaderFooterFields = false;

  @JsonKey(ignore: true)
  double footerStoryYOffset = 0;

  /// Flag to prevent text wrapping (used for single words in tables to avoid forced breaks)
  @JsonKey(ignore: true)
  bool preventWrap = false;

  /// Text frames in header/footer should size to content, not consume full line width.
  @JsonKey(ignore: true)
  bool shrinkTextLayerWidth = false;

  /// Header/footer paragraphs normally inset text inside page margins.
  /// Some layout containers already constrain the paragraph to the text area,
  /// in which case reapplying those insets would double the margins.
  @JsonKey(ignore: true)
  bool applyHeaderTextInsets = true;

  /// Auto-linkifying plain URL text is not part of WordprocessingML rendering.
  /// Keep it opt-in for contexts that explicitly want it.
  @JsonKey(ignore: true)
  bool disableUrlAutoDetection = true;

  /// Table-cell paragraphs follow Word's table-specific grid rules.
  @JsonKey(ignore: true)
  bool isTableCellParagraph = false;

  /// Word may resolve auto text color inside VML text boxes against the
  /// surrounding shape fill, even when the runs have no explicit w:color.
  @JsonKey(ignore: true)
  Color? textBoxFillColor;

  Paragraph(this.parent);

  Paragraph.empty() : parent = WordPage.empty();

  factory Paragraph.fromJson(Map<String, dynamic> json) =>
      _$ParagraphFromJson(json);
  Map<String, dynamic> toJson() => _$ParagraphToJson(this);

  static Paragraph fromMap(Map<String, dynamic> json, WordPage parent) {
    final paragraph = _$ParagraphFromJson(json);
    paragraph.parent = parent;

    if (json['pPr'] != null) {
      paragraph.pPr = PPr.fromMap(
        json['pPr'] as Map<String, dynamic>,
        paragraph,
      );
    }
    if (json['prPr'] != null) {
      // prPr's parent is runT, which is not available here. It will be set when runT is deserialized.
      paragraph.prPr = RPr.fromMap(json['prPr'] as Map<String, dynamic>, null);
    }
    paragraph.runs = (json['runs'] as List<dynamic>)
        .map((e) => runT.fromMap(e as Map<String, dynamic>, paragraph))
        .toList();

    // إعادة بناء textRunTs و imageRunTs من runs المرتبطة بشكل صحيح
    // _$ParagraphFromJson تحمّل textRunTs/imageRunTs من JSON لكن بدون روابط parent صحيحة
    // نعيد بناءها من runs التي لديها روابط parent سليمة
    paragraph.getPRunsByType();

    paragraph.sectionType = json['sectionType'] as String? ?? 'main';
    paragraph.text =
        json['text'] as String? ?? ''; // Re-add text deserialization
    paragraph.suppressHyperlinkStyleInheritance =
        json['suppressHyperlinkStyleInheritance'] as bool? ?? false;
    if (!paragraph.suppressHyperlinkStyleInheritance &&
        paragraph.hyperlinkAnchor != null &&
        paragraph.xmlString.isNotEmpty) {
      paragraph.suppressHyperlinkStyleInheritance =
          HyperlinkDisplayContextResolver.detectFromXmlString(
            hyperlinkAnchor: paragraph.hyperlinkAnchor,
            xmlString: paragraph.xmlString,
          );
    }

    // إعادة حساب المحاذاة من pPr عند التحميل من الكاش
    paragraph.getPAlign();
    paragraph.getPTextDirection();

    // Check if this paragraph is actually a table based on XML content
    if (paragraph.xmlString.trim().startsWith('<w:tbl')) {
      ParagraphTable tableParagraph = ParagraphTable(parent);

      // Copy properties manually since we can't easily cast
      tableParagraph.pPr = paragraph.pPr;
      tableParagraph.prPr = paragraph.prPr;
      tableParagraph.runs = paragraph.runs;
      tableParagraph.text = paragraph.text;
      tableParagraph.xmlString = paragraph.xmlString;
      tableParagraph.pageNum = paragraph.pageNum;
      tableParagraph.imageRunTs = paragraph.imageRunTs;
      tableParagraph.textRunTs = paragraph.textRunTs;
      tableParagraph.textAlign = paragraph.textAlign;
      tableParagraph.textDirection = paragraph.textDirection;
      tableParagraph.sectionType = paragraph.sectionType;

      // Re-establish parent links for runs
      for (var run in tableParagraph.runs) {
        run.parent = tableParagraph;
      }

      // Parse XML to populate pXml (crucial for table rendering)
      try {
        if (tableParagraph.xmlString.isNotEmpty) {
          tableParagraph.pXml = XmlDocument.parse(
            tableParagraph.xmlString,
          ).rootElement;
        }
      } catch (e) {
        print("Error re-parsing table XML from cache: $e");
      }

      return tableParagraph;
    }

    return paragraph;
  }

}
