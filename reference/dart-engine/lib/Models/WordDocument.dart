import 'dart:typed_data';
import 'package:flutter/foundation.dart';
import 'dart:ui'; // For FontWeight
import 'package:golden_shamela/Services/KnownSystemFontsRegistry.dart';
import 'package:archive/archive.dart';

import 'dart:io';
import 'dart:convert';

import 'package:golden_shamela/Models/BookPart.dart';
import 'package:golden_shamela/Models/IndexItem.dart';

import 'package:golden_shamela/wordToHTML/PPr.dart';
import 'package:golden_shamela/wordToHTML/RPr.dart';
import 'package:golden_shamela/Models/WordPage.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:xml/xml.dart';

import '../Utils/json_converters.dart';
import '../wordToHTML/DocRelations.dart';
import '../wordToHTML/FootNote.dart';
import '../wordToHTML/Num.dart';
import '../wordToHTML/SectPr.dart';
import '../wordToHTML/abstractNum.dart';

part 'WordDocument.g.dart';

@JsonSerializable(explicitToJson: true)
class WordDocument {
  String title = "BOOK";
  @JsonKey(ignore: true)
  List<WordPage> _loadedPages = []; // Cache for loaded pages

  @JsonKey(ignore: true)
  ValueNotifier<bool> isLoading = ValueNotifier(false);
  @JsonKey(ignore: true)
  ValueNotifier<double?> loadingProgress = ValueNotifier(null);
  @JsonKey(ignore: true)
  ValueNotifier<String?> loadingMessage = ValueNotifier(null);

  @JsonKey(ignore: true)
  Archive? archive; // The source archive for this document

  @JsonKey(ignore: true)
  List<String> pageFilePaths = []; // Paths to page JSON files
  @JsonKey(ignore: true)
  String? pagesDirectory; // Directory where page JSONs are stored
  @JsonKey(ignore: true)
  String? sourcePath;
  @JsonKey(ignore: true)
  String openSource = 'other';
  @JsonKey(ignore: true)
  List<BookPart> parts = [];
  @JsonKey(ignore: true)
  Map<int, WordDocument> partDocuments = {};

  RPr? defaultRPr;
  PPr? defaultPPr;
  String? majorFont, minorFont;
  String? majorFontCS, minorFontCS;
  String autoDarkColor = "000000";
  String autoLightColor = "FFFFFF";
  Map<String, String> themeColors = {};
  Map<int, AbstractNum> abstractNumMap = {};
  @JsonKey(fromJson: _intKeyMapFromJsonNum, toJson: _intKeyMapToJsonNum)
  Map<int, Num> numsMap = {};
  @JsonKey(ignore: true)
  List<String> fontsList = [];
  @JsonKey(ignore: true)
  Map<int, int> paragraphNumMap = {};
  SectPr? sectpr;
  List<SectPr> sectPrList = [];
  int currentPage = 0;
  @JsonKey(ignore: true)
  List<String> pageContents = [];
  Map<String, FootNote> docFootNotes = {};
  Map<String, int> bookMarksMap = {};
  Map<String, RelId> relIdList = {};
  @JsonKey(fromJson: _docImagesFromJson, toJson: _docImagesToJson)
  Map<String, Uint8List> docImages = {};
  @JsonKey(fromJson: _documentStylesFromJson, toJson: _documentStylesToJson)
  Map<String, XmlElement> documentStyles = {};
  bool? evenAndOddHeaders; // Different headers for even and odd pages
  bool adjustLineHeightInTable = false;
  bool withDiacritics = true;
  bool useArabicNumerals = true;
  List<IndexItem> index = [];
  String? selectedIndexItem;

  Map<String, String> extractedFontPaths = {};

  /// Cached default paragraph style ID (w:type="paragraph" w:default="1")
  /// Lazily computed from documentStyles
  @JsonKey(ignore: true)
  String? _defaultParagraphStyleId;
  @JsonKey(ignore: true)
  bool _defaultParagraphStyleIdSearched = false;

  /// Returns the styleId of the default paragraph style (typically "Normal").
  /// In Word, paragraphs without an explicit w:pStyle inherit from this style.
  String? get defaultParagraphStyleId {
    if (!_defaultParagraphStyleIdSearched) {
      _defaultParagraphStyleIdSearched = true;
      for (var entry in documentStyles.entries) {
        if (entry.value.getAttribute('w:type') == 'paragraph' &&
            entry.value.getAttribute('w:default') == '1') {
          _defaultParagraphStyleId = entry.key;
          break;
        }
      }
    }
    return _defaultParagraphStyleId;
  }

  WordDocument() : _loadedPages = [], pageFilePaths = [];

  void setLoadedPages(List<WordPage> pages) {
    _loadedPages = pages;
    // Also update pageFilePaths to reflect the loaded pages
    pageFilePaths = List.generate(pages.length, (index) => '$index.json');
  }

  WordPage? getLoadedPageIfAvailable(int index) {
    if (hasParts) {
      final document = documentForPage(index);
      if (document == this) return null;
      return document.getLoadedPageIfAvailable(localPageIndexForPage(index));
    }

    if (index < 0 || index >= _loadedPages.length) return null;
    final page = _loadedPages[index];
    if (page.ps.isEmpty) return null;
    return page;
  }

  void initLoadedPages() {
    _loadedPages = List.filled(
      pageFilePaths.length,
      WordPage.empty(),
      growable: true,
    );
  }

  WordDocument.empty()
    : _loadedPages = [],
      pageFilePaths = [],
      pagesDirectory = null;

  bool get hasParts => parts.length > 1;

  BookPart? partForPage(int pageIndex) {
    if (!hasParts) return null;
    if (parts.isEmpty) return null;
    if (pageIndex < parts.first.pageOffset) return parts.first;
    for (final part in parts) {
      final start = part.pageOffset;
      final end = start + part.pageCount;
      if (pageIndex >= start && pageIndex < end) return part;
    }
    return parts.last;
  }

  BookPart? partByNumber(int partNumber) {
    for (final part in parts) {
      if (part.partNumber == partNumber) return part;
    }
    return null;
  }

  int localPageIndexForPage(int pageIndex) {
    final part = partForPage(pageIndex);
    if (part == null) return pageIndex;
    if (part.pageCount < 1) return 0;
    return (pageIndex - part.pageOffset).clamp(0, part.pageCount - 1).toInt();
  }

  int displayPageNumberForPage(int pageIndex) =>
      localPageIndexForPage(pageIndex) + 1;

  int firstPageOfPart(int partNumber) {
    return partByNumber(partNumber)?.pageOffset ?? 0;
  }

  WordDocument documentForPage(int pageIndex) {
    final part = partForPage(pageIndex);
    if (part == null) return this;
    return partDocuments[part.partNumber] ?? this;
  }

  factory WordDocument.fromJson(Map<String, dynamic> json) =>
      _$WordDocumentFromJson(json);
  Map<String, dynamic> toJson() => _$WordDocumentToJson(this);

  Map<String, dynamic> toMetadataJson() {
    final json = _$WordDocumentToJson(this);
    // Ensure pages are not included in metadata, as they are now lazy-loaded
    json.remove('pages');
    json['fontsList'] = fontsList;
    json['extractedFontPaths'] = extractedFontPaths;
    return json;
  }

  static WordDocument fromCacheJson(Map<String, dynamic> json) {
    final wordDocument = _$WordDocumentFromJson(json);

    if (json['sectpr'] != null) {
      wordDocument.sectpr = SectPr.fromMap(
        json['sectpr'] as Map<String, dynamic>,
        wordDocument,
      );
    }
    wordDocument.sectPrList = (json['sectPrList'] as List<dynamic>)
        .map((e) => SectPr.fromMap(e as Map<String, dynamic>, wordDocument))
        .toList();

    // wordDocument.docFootNotes = (json['docFootNotes'] as Map<String, dynamic>).map(
    //         (k, e) => MapEntry(k, FootNote.fromMap(e as Map<String, dynamic>, wordDocument.pages[0]))); // Assuming footnotes are tied to the first page for now

    wordDocument.index = (json['index'] as List<dynamic>)
        .map((e) => IndexItem.fromMap(e as Map<String, dynamic>))
        .toList();

    wordDocument.relIdList = (json['relIdList'] as Map<String, dynamic>).map(
      (k, e) => MapEntry(k, RelId.fromMap(e as Map<String, dynamic>)),
    );

    wordDocument.abstractNumMap =
        (json['abstractNumMap'] as Map<String, dynamic>).map(
          (k, e) => MapEntry(
            int.parse(k),
            AbstractNum.fromMap(e as Map<String, dynamic>),
          ),
        );

    wordDocument.numsMap = (json['numsMap'] as Map<String, dynamic>).map(
      (k, e) => MapEntry(int.parse(k), Num.fromMap(e as Map<String, dynamic>)),
    );

    if (json['extractedFontPaths'] != null) {
      wordDocument.extractedFontPaths = Map<String, String>.from(
        json['extractedFontPaths'] as Map,
      );
    }

    if (json['fontsList'] != null) {
      wordDocument.fontsList = (json['fontsList'] as List<dynamic>)
          .map((e) => e.toString())
          .toList();
    }

    return wordDocument;
  }

  static Map<String, Uint8List> _docImagesFromJson(Map<String, dynamic> json) {
    // print("_docImagesFromJson called with json keys: ${json.keys.toList()}");
    return json.map(
      (key, value) =>
          MapEntry(key, uint8ListFromJson(value as String?) ?? Uint8List(0)),
    );
  }

  static Map<String, String> _docImagesToJson(Map<String, Uint8List> object) {
    return object.map((key, value) => MapEntry(key, uint8ListToJson(value)!));
  }

  static Map<String, XmlElement> _documentStylesFromJson(
    Map<String, dynamic> json,
  ) {
    final converter = XmlElementConverter();
    return json.map(
      (key, value) => MapEntry(
        key,
        converter.fromJson(value as String?) ?? XmlElement(XmlName('empty')),
      ),
    );
  }

  static Map<String, String> _documentStylesToJson(
    Map<String, XmlElement> object,
  ) {
    final converter = XmlElementConverter();
    return object.map((key, value) => MapEntry(key, converter.toJson(value)!));
  }

  static Map<int, AbstractNum> _intKeyMapFromJsonAbstractNum(
    Map<String, dynamic> json,
  ) {
    return json.map(
      (key, value) => MapEntry(
        int.parse(key),
        AbstractNum.fromJson(value as Map<String, dynamic>),
      ),
    );
  }

  static Map<String, dynamic> _intKeyMapToJsonAbstractNum(
    Map<int, AbstractNum> object,
  ) {
    return object.map((key, value) => MapEntry(key.toString(), value.toJson()));
  }

  static Map<int, Num> _intKeyMapFromJsonNum(Map<String, dynamic> json) {
    return json.map(
      (key, value) =>
          MapEntry(int.parse(key), Num.fromJson(value as Map<String, dynamic>)),
    );
  }

  static Map<String, dynamic> _intKeyMapToJsonNum(Map<int, Num> object) {
    return object.map((key, value) => MapEntry(key.toString(), value.toJson()));
  }

  List<String> getFontsList() {
    return fontsList;
  }

  Future<WordPage> getPage(int index) async {
    if (hasParts) {
      final document = documentForPage(index);
      if (document == this) {
        throw RangeError.index(index, pageFilePaths, "Page index out of bounds");
      }
      return document.getPage(localPageIndexForPage(index));
    }

    if (index < 0 || index >= pageFilePaths.length) {
      throw RangeError.index(index, pageFilePaths, "Page index out of bounds");
    }

    // Check if page is a placeholder (ps is empty for placeholders)
    if (_loadedPages.length > index && _loadedPages[index].ps.isNotEmpty) {
      return _loadedPages[index];
    }

    // Load page from file
    if (pagesDirectory == null) {
      throw StateError("pagesDirectory is not set for lazy loading.");
    }
    final pageFile = File('${pagesDirectory!}/${pageFilePaths[index]}');

    String pageJsonString;
    if (pageFile.path.endsWith('.gz')) {
      // Read compressed file
      final compressedBytes = await pageFile.readAsBytes();
      final decodedBytes = GZipCodec().decode(compressedBytes);
      pageJsonString = utf8.decode(decodedBytes);
    } else {
      // Read uncompressed file
      pageJsonString = await pageFile.readAsString();
    }

    final pageJsonMap = jsonDecode(pageJsonString) as Map<String, dynamic>;
    final loadedPage = WordPage.fromMap(pageJsonMap, this);

    // Ensure _loadedPages has the correct length before assigning.
    if (_loadedPages.length != pageFilePaths.length) {
      _loadedPages = List.filled(
        pageFilePaths.length,
        WordPage.empty(),
        growable: true,
      );
    }

    _loadedPages[index] = loadedPage;

    return loadedPage;
  }

  static const int MAX_CACHED_PAGES = 50;

  void prefetchPages(int currentPage) {
    if (hasParts) {
      for (int i = currentPage - 2; i <= currentPage + 3; i++) {
        final part = partForPage(i);
        final document = documentForPage(i);
        if (part != null && part.pageCount > 0 && document != this) {
          final localPage =
              (i - part.pageOffset).clamp(0, part.pageCount - 1).toInt();
          document.prefetchPages(localPage);
        }
      }
      return;
    }

    if (_loadedPages.isEmpty) return;

    // Evict old pages to free memory
    _evictOldPages(currentPage);

    // Prefetch next and previous 3 pages
    for (int i = currentPage - 2; i <= currentPage + 3; i++) {
      if (i >= 0 && i < pageFilePaths.length) {
        if (_loadedPages[i].ps.isEmpty) {
          getPage(i);
        }
      }
    }
  }

  void _evictOldPages(int currentPage) {
    if (_loadedPages.isEmpty) return;

    int loadedCount = 0;
    List<int> loadedIndexes = [];
    for (int i = 0; i < _loadedPages.length; i++) {
      if (_loadedPages[i].ps.isNotEmpty) {
        loadedCount++;
        loadedIndexes.add(i);
      }
    }

    if (loadedCount <= MAX_CACHED_PAGES) return;

    loadedIndexes.sort(
      (a, b) => (b - currentPage).abs().compareTo((a - currentPage).abs()),
    );

    while (loadedCount > MAX_CACHED_PAGES && loadedIndexes.isNotEmpty) {
      int indexToRemove = loadedIndexes.removeAt(0);
      _loadedPages[indexToRemove] = WordPage.empty();
      loadedCount--;
    }
  }

  // This method needs to be re-evaluated based on how UI consumes pages
  // For now, it will return a placeholder or throw an error.
  WordPage getCurrentPage() {
    throw UnimplementedError(
      "getCurrentPage is not implemented for lazy loading. Use getPage(currentPage) instead.",
    );
  }

  // This method needs to be re-evaluated based on how UI consumes pages
  // For now, it will return a placeholder or throw an error.
  WordPage getLastPage() {
    throw UnimplementedError(
      "getLastPage is not implemented for lazy loading. Use getPage(pageFilePaths.length - 1) instead.",
    );
  }

  // Map<String, Style> getFontsStyle() {
  //   List<String> fonts = getFontsList();
  //   loadFonts(fonts);
  //   Map<String, Style> styles = {};
  //   fonts.forEach((font) {
  //     // print(font.toString());
  //
  //     String fixedFont = getFixedFontName(font);
  //     if (!isProblemFont(font))
  //       styles["span.$fixedFont"] = Style(
  //         fontFamily: font,
  //       );
  //   });
  //   styles["p.style"] = Style(
  //     whiteSpace: WhiteSpace.pre,
  //   );
  //   // styles["img"] = Style(
  //   //   display: Display.inlineBlock,
  //   //   // margin: Margins(left: Margin(200)), // إضافة مسافة حول الصور
  //   //
  //   // );
  //   // styles["div"] = Style(
  //   //   margin: Margins(top: Margin(100))
  //   // );
  //   styles["img"] = Style(
  //     display: Display.inlineBlock,
  //   );
  //   styles["div.P2"] = Style(
  //     display: Display.inlineBlock,
  //   );
  //   // styles["span.(A)_Arslan_Wessam_B.ttf"]=Style(fontFamily: "arslanB");
  //   // print(styles.keys.map((s)=>s).join("-").to/String());
  //   return styles;
  // }

  int addParagraphNum(int numId, int ilvl) {
    int key = ilvl * 1000 + numId;
    if (paragraphNumMap[key] == null)
      paragraphNumMap[key] = 1;
    else
      paragraphNumMap[key] = paragraphNumMap[key]! + 1;

    return paragraphNumMap[key]!;
  }

  SectPr getPageSectPr() {
    return getSectPrForPage(currentPage);
  }

  SectPr getSectPrForPage(int pageIndex) {
    if (hasParts) {
      final document = documentForPage(pageIndex);
      if (document != this) {
        return document.getSectPrForPage(localPageIndexForPage(pageIndex));
      }
    }

    if (sectPrList.isEmpty) {
      return SectPr.empty(this);
    } else {
      SectPr sectPr = sectPrList[0];
      // debugPrint("🔍 FINDING SECTION for page $pageIndex:");
      for (int i = 0; i < sectPrList.length; i++) {
        var sect = sectPrList[i];
        bool matches =
            pageIndex >= sect.firstRange && pageIndex <= sect.lastRange;
        // debugPrint(
        //   "   Section $i: range=[${sect.firstRange}-${sect.lastRange}], headerFirst=${sect.headerFirstPath}, ${matches ? '✓ MATCH' : ''}",
        // );
        if (matches) {
          sectPr = sect;
        }
      }
      return sectPr;
    }
  }

  addSectPr(XmlElement element, {int? currentPageNum}) {
    SectPr sectpr = getSectPrFrmXml(element, this);

    // استخدام رقم الصفحة الحالية (0-indexed) كـ firstRange
    // الصفحة التي تحتوي على sectPr هي نهاية القسم، لذا firstRange = رقم الصفحة
    if (currentPageNum != null) {
      // currentPageNum هو 1-indexed، نحوله إلى 0-indexed
      sectpr.firstRange = currentPageNum - 1;
      sectpr.lastRange = currentPageNum - 1; // مؤقتاً، سيتم تحديثه لاحقاً
    } else {
      // Fallback للتوافق مع الكود القديم
      SectPr? lastSectPr = sectPrList.lastOrNull;
      sectpr.firstRange = lastSectPr != null ? lastSectPr.lastRange + 1 : 0;
      sectpr.lastRange = pageFilePaths.length;
    }

    sectpr.parent = this;
    sectPrList.add(sectpr);

    // debugPrint("📋 SECTION ADDED: index=${sectPrList.length - 1}, firstRange=${sectpr.firstRange}, page=$currentPageNum");
  }

  addBookMark(String bookMarkToc, {int? pageIndex}) {
    // pageIndex comes from internal 0-based index (e.g. from Paragraph.parent.pageIndex)
    // So we use it directly. If not provided, we fallback to the last page index.
    int page = pageIndex ?? (pageFilePaths.length - 1);
    if (page < 0) page = 0;
    bookMarksMap[bookMarkToc] = page;
  }
}

String getFixedFontName(String font) {
  String fixed = font
      .replaceAll(" ", "_")
      .replaceAll(")", "")
      .replaceAll("(", "")
      .replaceAll("-", "_")
      .toLowerCase();

  return fixed;
}

List<String> problemFontsList = [
  "Tholoth Rounded",
  "AL-Qairwan",
  "Hesham Gornata", // حروف مقطعة
  "Shurooq 03",
  "Monotype Koufi",
];

bool isProblemFont(String font) {
  return problemFontsList.contains(font);
}

/// Normalizes font family name by removing style suffixes.
/// Word often uses PostScript names (e.g. "Al-Jazeera-Arabic-Bold")
/// Flutter/Windows expects Family Name (e.g. "Al-Jazeera-Arabic") + fontWeight/Style
String normalizeFontFamily(String font) {
  // Some Windows-installed Arabic fonts are requested from Word using
  // face-specific family names (for example "...-Bold"). If we strip the
  // suffix we break the match between the dynamically loaded family name and
  // the family used by TextStyle, causing Flutter to fall back to another font.
  if (canResolveSystemFontFamily(font)) {
    return font.trim();
  }

  // Remove style suffixes only when they appear at the END of the family name.
  // Some Word fonts legitimately contain words like "Bold" inside the family
  // name itself (for example: "mohammad bold art 1"), and stripping them
  // blindly breaks the family lookup and forces Flutter to fallback.
  final suffixes = [
    RegExp(r'[- ]+Bold$', caseSensitive: false),
    RegExp(r'[- ]+Italic$', caseSensitive: false),
    RegExp(r'[- ]+Regular$', caseSensitive: false),
    RegExp(r'[- ]+Medium$', caseSensitive: false),
    RegExp(r'[- ]+Light$', caseSensitive: false),
    RegExp(r'[- ]+Semibold$', caseSensitive: false),
    RegExp(r'[- ]+ExtraBold$', caseSensitive: false),
    RegExp(r'[- ]+Black$', caseSensitive: false),
  ];

  String normalized = font;
  for (var regex in suffixes) {
    normalized = normalized.replaceAll(regex, '');
  }

  // 2. Trim potentially left over spaces
  return normalized.trim();
}

/// Detects if the font name implies a specific font weight (Bold/Black).
/// This is necessary when the XML <w:b/> tag is invalid or missing, but the font name specifies weight.
FontWeight? getImplicitFontWeight(String fontName) {
  final lowerFont = fontName.toLowerCase();

  // Check for Black/ExtraBold first as they are heavier
  if (lowerFont.contains("black") || lowerFont.contains("extrabold")) {
    return FontWeight.w900;
  }

  // Check for Bold
  // Ensure it's not "SemiBold" treated as Bold if we want precision,
  // but usually FontWeight.bold (w700) covers standard Bold.
  if (lowerFont.contains("bold")) {
    return FontWeight.bold;
  }

  if (lowerFont.contains("semibold")) {
    return FontWeight.w600;
  }

  if (lowerFont.contains("medium")) {
    return FontWeight.w500;
  }

  if (lowerFont.contains("light")) {
    return FontWeight.w300;
  }

  return null;
}
