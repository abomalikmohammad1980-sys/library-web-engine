import 'dart:io';
import 'package:archive/archive.dart';
import 'package:flutter/cupertino.dart';
import 'package:golden_shamela/Utils/ArchiveToXml.dart';
import 'package:golden_shamela/wordToHTML/DocRelations.dart';
import 'package:golden_shamela/wordToHTML/MyInt.dart';
import 'package:golden_shamela/wordToHTML/PPr.dart';
import 'package:golden_shamela/wordToHTML/Paragraph.dart';
import 'package:golden_shamela/wordToHTML/FooterFrameLayout.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:xml/xml.dart';

import '../Utils/ImageParser.dart';
import '../Utils/json_converters.dart';
import '../main.dart';
import '../core/app_state.dart';
import 'DocFooter.dart';
import '../Models/WordDocument.dart';
import '../Models/WordPage.dart';

import '../Utils/PageNumberHelper.dart';

part 'SectPr.g.dart';

@JsonSerializable(explicitToJson: true, constructor: 'emptyJson')
class SectPr {
  double? width; // Page width in twips (1/20th of a point)
  double? height; // Page height in twips
  double topMargin = 8;
  double bottomMargin = 8;
  double leftMargin = 8;
  double rightMargin = 8;
  double? headerMargin; // المسافة من حافة الصفحة إلى الهيدر
  double? footerMargin; // المسافة من حافة الصفحة إلى الفوتر
  int firstRange = 0;
  int lastRange = 0;
  @JsonKey(ignore: true)
  WordDocument parent;
  @XmlElementConverter()
  XmlElement? footerFirst;
  @XmlElementConverter()
  XmlElement? footerEven;
  @XmlElementConverter()
  XmlElement? footerOdd;
  @XmlElementConverter()
  XmlElement? footerDefault;

  String? footerFirstPath;
  String? footerEvenPath;
  String? footerOddPath;
  String? footerDefaultPath;

  String? pgNumFmt;
  int? pgNumStart;
  String? pgNumChapSep;

  @XmlElementConverter()
  XmlElement? headerFirst;
  @XmlElementConverter()
  XmlElement? headerEven;
  @XmlElementConverter()
  XmlElement? headerOdd;
  @XmlElementConverter()
  XmlElement? headerDefault;

  String? headerFirstPath;
  String? headerEvenPath;
  String? headerOddPath;
  String? headerDefaultPath;

  @XmlElementConverter()
  XmlElement? sectPrElement;

  SectPr({
    this.width,
    this.height,
    required this.topMargin,
    required this.bottomMargin,
    required this.leftMargin,
    required this.rightMargin,
    this.headerMargin,
    this.footerMargin,
    required this.parent,
    this.sectPrElement,
    this.pgNumFmt,
    this.pgNumStart,
    this.pgNumChapSep,
    this.footerFirstPath,
    this.footerEvenPath,
    this.footerOddPath,
    this.footerDefaultPath,
    this.headerFirstPath,
    this.headerEvenPath,
    this.headerOddPath,
    this.headerDefaultPath,
  }) {
    // getHeaders(); // No longer needed - we use paths now
  }

  SectPr.empty(this.parent) {
    getHeaders();
    // getFooters();
  }

  SectPr.emptyJson()
    : parent = WordDocument.empty(); // Constructor for JSON deserialization

  factory SectPr.fromJson(Map<String, dynamic> json) => _$SectPrFromJson(json);
  Map<String, dynamic> toJson() => _$SectPrToJson(this);

  static SectPr fromMap(Map<String, dynamic> json, WordDocument parent) {
    final sectPr = _$SectPrFromJson(json);
    sectPr.parent = parent;
    return sectPr;
  }

  @override
  String toString() {
    return 'Page Size: ${width}x$height twips\n'
        'Margins - Top: $topMargin, Bottom: $bottomMargin, '
        'Left: $leftMargin, Right: $rightMargin, '
        'Header: $headerMargin, Footer: $footerMargin';
  }

  double? get docGridLinePitchPx {
    final linePitchTwips = double.tryParse(
      sectPrElement?.getElement('w:docGrid')?.getAttribute('w:linePitch') ?? '',
    );
    return linePitchTwips?.twipsToDp();
  }

  bool get hasLineGrid => (docGridLinePitchPx ?? 0) > 0;

  static SectPr fromDocument(XmlDocument documentXml, WordDocument parent) {
    final sectPrElement = documentXml.findAllElements('w:sectPr').firstOrNull;
    return sectPrElement != null
        ? fromElement(sectPrElement, parent)
        : SectPr.empty(parent);
  }

  static SectPr fromElement(XmlElement sectPrElement, WordDocument parent0) {
    double? width;
    double? height;
    double? topMargin;
    double? bottomMargin;
    double? leftMargin;
    double? rightMargin;
    double? headerMargin;
    double? footerMargin;
    // Parse page size <w:pgSz>
    final pgSzElement = sectPrElement.findElements('w:pgSz').firstOrNull;
    if (pgSzElement != null) {
      width = double.tryParse(pgSzElement.getAttribute('w:w') ?? '');
      height = double.tryParse(pgSzElement.getAttribute('w:h') ?? '');
    }

    // Parse margins <w:pgMar>
    final pgMarElement = sectPrElement.findElements('w:pgMar').firstOrNull;
    if (pgMarElement != null) {
      topMargin = double.tryParse(pgMarElement.getAttribute('w:top') ?? '');
      bottomMargin = double.tryParse(
        pgMarElement.getAttribute('w:bottom') ?? '',
      );
      leftMargin = double.tryParse(pgMarElement.getAttribute('w:left') ?? '');
      rightMargin = double.tryParse(pgMarElement.getAttribute('w:right') ?? '');
      headerMargin = double.tryParse(
        pgMarElement.getAttribute('w:header') ?? '',
      );
      footerMargin = double.tryParse(
        pgMarElement.getAttribute('w:footer') ?? '',
      );
    }

    // Parse page numbering <w:pgNumType>
    String? pgNumFmt;
    int? pgNumStart;
    String? pgNumChapSep;
    final pgNumTypeElement = sectPrElement
        .findElements('w:pgNumType')
        .firstOrNull;
    if (pgNumTypeElement != null) {
      pgNumFmt = pgNumTypeElement.getAttribute('w:fmt');
      pgNumStart = int.tryParse(pgNumTypeElement.getAttribute('w:start') ?? '');
      pgNumChapSep = pgNumTypeElement.getAttribute('w:chapSep');
    }

    // Extract footer paths
    String? footerFirstPath = _getFooterPathByType(
      sectPrElement,
      parent0,
      "first",
    );
    String? footerEvenPath = _getFooterPathByType(
      sectPrElement,
      parent0,
      "even",
    );
    String? footerOddPath = _getFooterPathByType(sectPrElement, parent0, "odd");
    String? footerDefaultPath = _getFooterPathByType(
      sectPrElement,
      parent0,
      "default",
    );

    // Extract header paths
    String? headerFirstPath = _getHeaderPathByType(
      sectPrElement,
      parent0,
      "first",
    );
    String? headerEvenPath = _getHeaderPathByType(
      sectPrElement,
      parent0,
      "even",
    );
    String? headerOddPath = _getHeaderPathByType(sectPrElement, parent0, "odd");
    String? headerDefaultPath = _getHeaderPathByType(
      sectPrElement,
      parent0,
      "default",
    );

    // Inherit from previous section if not defined (Word behavior)
    SectPr? prevSectPr = parent0.sectPrList.lastOrNull;
    if (prevSectPr != null) {
      // Inherit footer paths
      footerFirstPath ??= prevSectPr.footerFirstPath;
      footerEvenPath ??= prevSectPr.footerEvenPath;
      footerOddPath ??= prevSectPr.footerOddPath;
      footerDefaultPath ??= prevSectPr.footerDefaultPath;

      // Inherit header paths
      headerFirstPath ??= prevSectPr.headerFirstPath;
      headerEvenPath ??= prevSectPr.headerEvenPath;
      headerOddPath ??= prevSectPr.headerOddPath;
      headerDefaultPath ??= prevSectPr.headerDefaultPath;
    }

    SectPr sectPr = SectPr(
      width: width?.twipsToDp(),
      height: height?.twipsToDp(),
      topMargin: topMargin?.twipsToDp(),
      bottomMargin: bottomMargin?.twipsToDp(),
      leftMargin: leftMargin?.twipsToDp(),
      rightMargin: rightMargin?.twipsToDp(),
      headerMargin: headerMargin?.twipsToDp(),
      footerMargin: footerMargin?.twipsToDp(),
      parent: parent0,
      sectPrElement: sectPrElement,
      pgNumFmt: pgNumFmt,
      pgNumStart: pgNumStart,
      pgNumChapSep: pgNumChapSep,
      footerFirstPath: footerFirstPath,
      footerEvenPath: footerEvenPath,
      footerOddPath: footerOddPath,
      footerDefaultPath: footerDefaultPath,
      headerFirstPath: headerFirstPath,
      headerEvenPath: headerEvenPath,
      headerOddPath: headerOddPath,
      headerDefaultPath: headerDefaultPath,
    );
    return sectPr;
  }

  void getHeaders() {
    if (sectPrElement == null) return;
    headerFirst = getSectPrHeader(sectPrElement!, parent, type: "first");
    headerDefault = getSectPrHeader(sectPrElement!, parent, type: "default");
    headerEven = getSectPrHeader(sectPrElement!, parent, type: "even");
    headerOdd = getSectPrHeader(sectPrElement!, parent, type: "odd");
  }

  void getFooters() {
    // Deprecated: Footers are now handled via paths in fromElement
  }

  static String? _getFooterPathByType(
    XmlElement sectPrElement,
    WordDocument parent,
    String type,
  ) {
    Map<String, XmlElement> footersMap = {};
    // Use childElements to avoid deep recursive search if not needed,
    // but usually footerReference is a direct child of sectPr.
    // Use local name to avoid namespace prefix issues.
    for (var child in sectPrElement.childElements) {
      if (child.name.local == "footerReference") {
        var footerType = child.getAttribute("w:type");
        if (footerType != null) {
          footersMap[footerType] = child;
        }
      }
    }

    if (footersMap[type] == null) {
      return null;
    }

    String? rId = footersMap[type]?.getAttribute("r:id");

    if (rId == null || parent.relIdList[rId] == null) {
      return null;
    }

    String target = parent.relIdList[rId]!.Target!;

    if (target.startsWith("/") || target.startsWith("\\")) {
      target = target.substring(1);
    }

    String footerPath;
    if (target.startsWith("word/")) {
      footerPath = target;
    } else {
      footerPath = "word/$target";
    }

    return footerPath;
  }

  static String? _getHeaderPathByType(
    XmlElement sectPrElement,
    WordDocument parent,
    String type,
  ) {
    Map<String, XmlElement> headersMap = {};
    var headerRefs = sectPrElement.findAllElements("w:headerReference");

    headerRefs.forEach((headerReference) {
      var headerType = headerReference.getAttribute("w:type");
      if (headerType != null) {
        headersMap[headerType] = headerReference;
      }
    });

    if (headersMap[type] == null) {
      return null;
    }

    String? rId = headersMap[type]?.getAttribute("r:id");

    if (rId == null || parent.relIdList[rId] == null) {
      return null;
    }

    String target = parent.relIdList[rId]!.Target!;

    if (target.startsWith("/") || target.startsWith("\\")) {
      target = target.substring(1);
    }

    String headerPath;
    if (target.startsWith("word/")) {
      headerPath = target;
    } else {
      headerPath = "word/$target";
    }

    return headerPath;
  }

  XmlElement? _loadHeaderFromPath(String? path) {
    if (path == null) {
      return null;
    }

    var archiveMap = parent.archive?.toMap() ?? AppState().docArchive.toMap();

    ArchiveFile? archiveFile = archiveMap[path];
    if (archiveFile == null) {
      return null;
    }
    if (!archiveFile.name.endsWith(".xml")) {
      return null;
    }

    try {
      XmlDocument document = ArchiveToXml(archiveFile);
      var header = document.getElement("w:hdr");
      return header;
    } catch (e) {
      return null;
    }
  }

  Map<String, RelId>? _loadRelationshipsForPart(String partPath) {
    // Construct relationships path: word/header1.xml -> word/_rels/header1.xml.rels
    // Handle paths starting with "word/" or just filenames
    String relsPath;
    List<String> parts = partPath.split('/');
    String filename = parts.last;

    if (parts.length > 1) {
      // e.g. "word/header1.xml" -> "word/_rels/header1.xml.rels"
      String directory = parts.sublist(0, parts.length - 1).join('/');
      relsPath = "$directory/_rels/$filename.rels";
    } else {
      // e.g. "header1.xml" -> "_rels/header1.xml.rels"
      relsPath = "_rels/$filename.rels";
    }

    var archiveMap = parent.archive?.toMap() ?? AppState().docArchive.toMap();
    ArchiveFile? relsFile = archiveMap[relsPath];

    if (relsFile != null) {
      return parseRelationships(relsFile);
    }
    return null;
  }

  XmlElement? _loadFooterFromPath(String? path) {
    if (path == null) {
      return null;
    }

    var archiveMap = parent.archive?.toMap() ?? AppState().docArchive.toMap();

    ArchiveFile? archiveFile = archiveMap[path];
    if (archiveFile == null) {
      return null;
    }
    if (!archiveFile.name.endsWith(".xml")) {
      return null;
    }

    try {
      XmlDocument document = ArchiveToXml(archiveFile);
      var footer = document.getElement("w:ftr");

      return footer;
    } catch (e) {
      return null;
    }
  }

  Widget getSectHeaderWidget(WordPage wordPage, [String? pageNumStr]) {
    // Load relationship file for this header
    Map<String, RelId>? headerRelations;
    XmlElement? currentHeader = getRequestedHeader(wordPage.pageIndex);

    // Resolve the path again to get the relationships
    String? path;
    int pageInSection = wordPage.pageIndex - firstRange + 1;
    bool titlePg = sectPrElement?.findElements("w:titlePg").isNotEmpty ?? false;
    final useEvenHeader = _shouldUseEvenHeaderFooter(wordPage.pageIndex);

    int sectionIndex = parent.sectPrList.indexOf(this);

    if (pageInSection == 1 && titlePg) {
      if (headerFirstPath != null) {
        path = headerFirstPath;
      } else {
        path = _inheritHeaderFirst(sectionIndex);
      }
    } else if (useEvenHeader) {
      if (headerEvenPath != null) {
        path = headerEvenPath;
      } else {
        path = _inheritHeaderEven(sectionIndex);
      }
    } else {
      if (headerOddPath != null) {
        path = headerOddPath;
      } else if (headerDefaultPath != null) {
        path = headerDefaultPath;
      } else {
        path = _inheritHeaderOdd(sectionIndex);
      }
    }

    if (path != null) {
      headerRelations = _loadRelationshipsForPart(path);
    } else {
      // Fallback: This usually happens if inheritance found nothing or logic gap.
      // But getRequestedHeader logic usually resolves to something if header exists.
    }

    if (currentHeader == null) return Container();

    List<Widget> psWidgets = [];

    // Process all child elements, including w:sdt and w:p
    for (var element in currentHeader.childElements) {
      if (element.name.local == "p") {
        // Direct paragraph
        Paragraph p = Paragraph(wordPage);
        p.customRelIdList = headerRelations; // Pass relations
        p.isHeaderParagraph =
            true; // Mark as header paragraph for transparent images
        if (pageNumStr != null) {
          p.customPageNumber = pageNumStr;
        }
        p.fromXml(element);
        psWidgets.add(p.toWidget());
      } else if (element.name.local == "sdt") {
        // Structured Document Tag - extract paragraphs from sdtContent
        // Only replace PAGE once in the entire SDT
        var sdtContent = element.getElement("w:sdtContent");
        if (sdtContent != null) {
          bool pageNumReplacedInSdt = false;
          for (var child in sdtContent.childElements) {
            if (child.name.local == "p") {
              Paragraph p = Paragraph(wordPage);
              p.customRelIdList = headerRelations; // Pass relations
              p.isHeaderParagraph =
                  true; // Mark as header paragraph for transparent images
              // Only pass customPageNumber if we haven't replaced yet
              if (pageNumStr != null && !pageNumReplacedInSdt) {
                p.customPageNumber = pageNumStr;
              }
              p.fromXml(child);
              // Check if this paragraph actually used the page number
              if (p.runs.any((r) => r.text == pageNumStr)) {
                pageNumReplacedInSdt = true;
              }
              psWidgets.add(p.toWidget());
            }
          }
        }
      }
      // Skip other elements like bookmarkStart, bookmarkEnd
    }

    // وسّع العرض ليتوافق مع عرض الصفحة فتمركز VML يعمل صالحاً داخل الهيدر
    double width = parent.getSectPrForPage(wordPage.pageIndex).width ?? 595;
    return SizedBox(
      width: width,
      child: Column(mainAxisSize: MainAxisSize.min, children: psWidgets),
    );
  }

  Widget getSectFooterWidget(WordPage wordPage, String pageNumStr) {
    Map<String, RelId>? footerRelations;
    XmlElement? currentFooter = getRequestedFooter(wordPage.pageIndex);

    String? path;
    int pageInSection = wordPage.pageIndex - firstRange + 1;
    bool titlePg = sectPrElement?.findElements("w:titlePg").isNotEmpty ?? false;
    final useEvenFooter = _shouldUseEvenHeaderFooter(wordPage.pageIndex);
    int currentSectionIndex = parent.sectPrList.indexOf(this);

    if (pageInSection == 1 && titlePg) {
      path =
          footerFirstPath ??
          _inheritFooterFirst(currentSectionIndex);
    } else if (useEvenFooter) {
      path =
          footerEvenPath ??
          _inheritFooterEven(currentSectionIndex) ??
          footerOddPath ??
          footerDefaultPath ??
          _inheritFooterOdd(currentSectionIndex);
    } else {
      path =
          footerOddPath ??
          footerDefaultPath ??
          _inheritFooterOdd(currentSectionIndex);
    }

    if (path != null) {
      footerRelations = _loadRelationshipsForPart(path);
    }

    if (currentFooter == null) {
      return Container();
    }

    List<Paragraph> footerParagraphs = [];

    // Process all child elements, including w:sdt and w:p
    for (var element in currentFooter.childElements) {
      if (element.name.local == "p") {
        Paragraph p = Paragraph(wordPage);
        p.customRelIdList = footerRelations;
        p.customPageNumber = pageNumStr;
        p.isHeaderParagraph = true; // Set to true to apply same zero-default spacing in PPr.dart
        p.isFooterParagraph = true;
        p.fromXml(element);
        footerParagraphs.add(p);
      } else if (element.name.local == "sdt") {
        var sdtContent = element.getElement("w:sdtContent");
        if (sdtContent != null) {
          bool pageNumReplacedInSdt = false;
          for (var child in sdtContent.childElements) {
            if (child.name.local == "p") {
              Paragraph p = Paragraph(wordPage);
              p.customRelIdList = footerRelations;
              if (!pageNumReplacedInSdt) {
                p.customPageNumber = pageNumStr;
              }
              p.isHeaderParagraph = true; // Set to true to apply same zero-default spacing in PPr.dart
              p.isFooterParagraph = true;
              p.fromXml(child);
              if (p.runs.any((r) => r.text == pageNumStr)) {
                pageNumReplacedInSdt = true;
              }
              footerParagraphs.add(p);
            }
          }
        }
      }
    }

    final footerStoryYOffset = _estimateFooterStoryYOffset(footerParagraphs);
    for (final paragraph in footerParagraphs) {
      paragraph.footerStoryYOffset = footerStoryYOffset;
    }

    double width = parent.getSectPrForPage(wordPage.pageIndex).width ?? 595;
    return SizedBox(
      width: width,
      child: Transform.translate(
        offset: Offset(0, footerStoryYOffset),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: FooterFrameLayout.build(footerParagraphs),
        ),
      ),
    );
  }

  double _estimateFooterStoryYOffset(List<Paragraph> footerParagraphs) {
    if (footerParagraphs.isEmpty) {
      return 0;
    }

    if (footerParagraphs.any(
      (p) => p.pPr?.xmlpPr?.getElement("w:framePr") != null,
    )) {
      return 0;
    }

    final footerDistance = footerMargin ?? bottomMargin;
    final estimatedStoryHeight = footerParagraphs.fold<double>(
      0,
      (sum, paragraph) => sum + paragraph.estimateFooterStoryBlockHeight(),
    );

    return bottomMargin - footerDistance - estimatedStoryHeight;
  }

  /// حساب ارتفاع الهيدر بناءً على الصور الموجودة فيه
  double getHeaderHeight(WordPage wordPage) {
    XmlElement? currentHeader = getRequestedHeader(wordPage.pageIndex);
    if (currentHeader == null) return 0;

    double maxHeight = 0;

    // إضافة headerMargin كبداية (المسافة من أعلى الصفحة إلى بداية الهيدر)
    double startY = headerMargin ?? 0;

    // تحليل فقرات الهيدر
    for (var element in currentHeader.childElements) {
      Paragraph p = Paragraph(wordPage).fromXml(element);

      // فحص الصور
      for (var run in p.runs) {
        if (run.image != null) {
          var img = run.image!;

          // الأهم: تجاهل الصور العائمة التي تكون خلف النص (مثل إطارات البيان والتبيين)
          // لأنها خلفيات ولا يجب أن تدفع النص الرئيسي للأسفل
          if (img.behindDoc) continue;
          
          // تجاهل الصور/الإطارات الطويلة جداً التي تغطي معظم الصفحة
          if (img.height > (this.height ?? 842) * 0.5) continue;

          double imageBottom;
          if (img.relativeFromV == "page") {
            imageBottom = img.posY + img.height;
          } else {
            // إذا كان نسبياً للفقرة أو الهامش، نضيف startY تقديراً
            imageBottom = startY + img.posY + img.height;
          }

          if (imageBottom > maxHeight) {
            maxHeight = imageBottom;
          }
        }
      }
    }

    return maxHeight;
  }

  XmlElement? getRequestedHeader(int docPageIndex) {
    bool titlePg = sectPrElement?.findElements("w:titlePg").isNotEmpty ?? false;
    final useEvenHeader = _shouldUseEvenHeaderFooter(docPageIndex);

    String? path;

    // Convert 0-based docPageIndex to 1-based page number within section
    // docPageIndex is 0-indexed globally, firstRange is 0-indexed
    int pageInSection = docPageIndex - firstRange + 1; // 1-based within section

    // Debug: طباعة تفاصيل القسم
    int sectionIndex = parent.sectPrList.indexOf(this);
    // Rule 1: First page of section with titlePg enabled
    if (pageInSection == 1 && titlePg) {
      // وفقاً للمرجع: إذا titlePg مفعلة ولا يوجد headerFirst:
      // - ورث من القسم السابق
      // - أو أنشئ هيدر فارغ (return null)
      if (headerFirstPath != null) {
        path = headerFirstPath;
      } else {
        // حاول الوراثة من القسم السابق
        path = _inheritHeaderFirst(sectionIndex);
      }
    }
    // Rule 2: Even/odd page headers (only if evenAndOddHeaders is enabled)
    else if (useEvenHeader) {
      // وفقاً للمرجع: إذا لا يوجد headerEven:
      // - ورث من القسم السابق
      // - أو أنشئ هيدر فارغ
      if (headerEvenPath != null) {
        path = headerEvenPath;
      } else {
        path = _inheritHeaderEven(sectionIndex);
      }
    }
    // Rule 3: All other cases use odd/default header
    else {
      // وفقاً للمرجع: إذا لا يوجد headerOdd:
      // - ورث من القسم السابق
      // - أو أنشئ هيدر فارغ
      // default يُستخدم كـ fallback لـ odd فقط (type="default" = type="odd" في Word)
      if (headerOddPath != null) {
        path = headerOddPath;
      } else if (headerDefaultPath != null) {
        path = headerDefaultPath;
      } else {
        path = _inheritHeaderOdd(sectionIndex);
      }
    }

    if (path != null) {
      XmlElement? result = _loadHeaderFromPath(path);
      if (result == null) {}
      return result;
    }
    return null;
  }

  /// وراثة headerFirst من القسم السابق
  String? _inheritHeaderFirst(int currentSectionIndex) {
    for (int i = currentSectionIndex - 1; i >= 0; i--) {
      var prevSect = parent.sectPrList[i];
      if (prevSect.headerFirstPath != null) {
        return prevSect.headerFirstPath;
      }
    }
    // لم نجد هيدر في أي قسم سابق → هيدر فارغ
    return null;
  }

  /// وراثة headerEven من القسم السابق
  String? _inheritHeaderEven(int currentSectionIndex) {
    for (int i = currentSectionIndex - 1; i >= 0; i--) {
      var prevSect = parent.sectPrList[i];
      if (prevSect.headerEvenPath != null) {
        return prevSect.headerEvenPath;
      }
    }
    return null;
  }

  /// وراثة headerOdd من القسم السابق
  String? _inheritHeaderOdd(int currentSectionIndex) {
    for (int i = currentSectionIndex - 1; i >= 0; i--) {
      var prevSect = parent.sectPrList[i];
      if (prevSect.headerOddPath != null) {
        return prevSect.headerOddPath;
      }
      // default يُعتبر fallback لـ odd
      if (prevSect.headerDefaultPath != null) {
        return prevSect.headerDefaultPath;
      }
    }
    return null;
  }

  /// وراثة footerFirst من القسم السابق
  String? _inheritFooterFirst(int currentSectionIndex) {
    for (int i = currentSectionIndex - 1; i >= 0; i--) {
      var prevSect = parent.sectPrList[i];
      if (prevSect.footerFirstPath != null) {
        return prevSect.footerFirstPath;
      }
    }
    return null;
  }

  /// وراثة footerEven من القسم السابق
  String? _inheritFooterEven(int currentSectionIndex) {
    for (int i = currentSectionIndex - 1; i >= 0; i--) {
      var prevSect = parent.sectPrList[i];
      if (prevSect.footerEvenPath != null) {
        return prevSect.footerEvenPath;
      }
    }
    return null;
  }

  /// وراثة footerOdd/Default من القسم السابق
  /// حسب ECMA-376: إذا لم يوجد odd footer، يُورث من القسم السابق
  String? _inheritFooterOdd(int currentSectionIndex) {
    for (int i = currentSectionIndex - 1; i >= 0; i--) {
      var prevSect = parent.sectPrList[i];
      if (prevSect.footerOddPath != null) {
        return prevSect.footerOddPath;
      }
      // default يُعتبر fallback لـ odd
      if (prevSect.footerDefaultPath != null) {
        return prevSect.footerDefaultPath;
      }
    }
    return null;
  }

  XmlElement? getRequestedFooter(int docPageIndex) {
    bool titlePg = sectPrElement?.findElements("w:titlePg").isNotEmpty ?? false;
    final useEvenFooter = _shouldUseEvenHeaderFooter(docPageIndex);
    int currentSectionIndex = parent.sectPrList.indexOf(this);

    String? path;

    // Convert 0-based docPageIndex to 1-based page number within section
    int pageInSection = docPageIndex - firstRange + 1;

    // Rule 1: First page of section with titlePg enabled
    if (pageInSection == 1 && titlePg) {
      path =
          footerFirstPath ??
          _inheritFooterFirst(currentSectionIndex);
    }
    // Rule 2: Even/odd page footers (only if evenAndOddHeaders is enabled)
    else if (useEvenFooter) {
      path =
          footerEvenPath ??
          _inheritFooterEven(currentSectionIndex) ??
          footerOddPath ??
          footerDefaultPath ??
          _inheritFooterOdd(currentSectionIndex);
    }
    // Rule 3: All other cases use odd/default footer (with inheritance)
    else {
      path =
          footerOddPath ??
          footerDefaultPath ??
          _inheritFooterOdd(currentSectionIndex);
    }

    if (path != null) {
      XmlElement? result = _loadFooterFromPath(path);
      return result;
    }
    return null;
  }

  /// للتمييز بين الهيدر المعقد (زخارف VML/صور عائمة) الذي يحتاج إزاحة headerMargin
  /// والهيدر النصي (مثل كتاب البيان) الذي يستخدم إطارات نصية أو يبني موضعه بنفسه.
  bool hasVmlFrameInHeader(int docPageIndex) {
    XmlElement? currentHeader = getRequestedHeader(docPageIndex);
    if (currentHeader == null) return false;

    // كتاب البيان يحتوي على <w:framePr> مما يعني أنه إطار نصي يعتمد على موقعه الذاتي
    bool hasFramePr = currentHeader.descendants.whereType<XmlElement>().any((e) => e.name.local == "framePr");
    if (hasFramePr) return false;

    // كتب مثل ex7 تحتوي على زخارف بداخل <w:pict> أو <w:drawing>
    bool hasPictOrDrawing = currentHeader.descendants.whereType<XmlElement>().any((e) => e.name.local == "pict" || e.name.local == "drawing");
    
    return hasPictOrDrawing;
  }

  /// للفوترات الزخرفية المبنية من VML/صور عائمة على حواف الصفحة.
  /// هذه الحالات ليست page borders عادية من sectPr، بل قصة header/footer
  /// مستقلة يجب ألا نعاملها كحدود قابلة للتمديد مع ارتفاع الحاوية.
  bool hasVmlFrameInFooter(int docPageIndex) {
    XmlElement? currentFooter = getRequestedFooter(docPageIndex);
    if (currentFooter == null) return false;

    bool hasFramePr = currentFooter.descendants
        .whereType<XmlElement>()
        .any((e) => e.name.local == "framePr");
    if (hasFramePr) return false;

    bool hasPictOrDrawing = currentFooter.descendants
        .whereType<XmlElement>()
        .any((e) => e.name.local == "pict" || e.name.local == "drawing");

    return hasPictOrDrawing;
  }

  String calculatePageNumber(int pageIndex) {
    int start;

    if (pgNumStart != null) {
      // إذا حُدد رقم البداية، استخدمه
      start = pgNumStart!;
    } else {
      // إذا لم يُحدد، استمر من القسم السابق
      // ابحث عن القسم السابق
      int myIndex = parent.sectPrList.indexOf(this);
      if (myIndex > 0) {
        SectPr prevSectPr = parent.sectPrList[myIndex - 1];
        // رقم بداية هذا القسم = رقم نهاية القسم السابق + 1
        // نحسب آخر رقم صفحة في القسم السابق

        // إذا القسم السابق أيضاً يستمر من سابقه، نحتاج لحساب تراكمي
        // لتبسيط، نحسب آخر رقم صفحة في القسم السابق
        int prevLastPageNum = prevSectPr._calculateLastPageNumber();
        start = prevLastPageNum + 1;
      } else {
        // هذا هو القسم الأول، ابدأ من 1
        start = 1;
      }
    }

    int relativeIndex = pageIndex - firstRange;
    int value = start + relativeIndex;
    return PageNumberHelper.formatPageNumber(value, pgNumFmt);
  }

  /// حساب آخر رقم صفحة في هذا القسم (للاستخدام الداخلي)
  int _calculateLastPageNumber() {
    int start;

    if (pgNumStart != null) {
      start = pgNumStart!;
    } else {
      // ابحث عن القسم السابق
      int myIndex = parent.sectPrList.indexOf(this);
      if (myIndex > 0) {
        SectPr prevSectPr = parent.sectPrList[myIndex - 1];
        int prevLastPageNum = prevSectPr._calculateLastPageNumber();
        start = prevLastPageNum + 1;
      } else {
        start = 1;
      }
    }

    int pagesInSection = lastRange - firstRange;
    return start + pagesInSection;
  }

  int _calculatePageNumberValueForParity(int pageIndex) {
    int start;

    if (pgNumStart != null) {
      start = pgNumStart!;
    } else {
      int myIndex = parent.sectPrList.indexOf(this);
      if (myIndex > 0) {
        SectPr prevSectPr = parent.sectPrList[myIndex - 1];
        int prevLastPageNum = prevSectPr._calculateLastPageNumber();
        start = prevLastPageNum + 1;
      } else {
        start = 1;
      }
    }

    int relativeIndex = pageIndex - firstRange;
    return start + relativeIndex;
  }

  bool _shouldUseEvenHeaderFooter(int pageIndex) {
    if (!(parent.evenAndOddHeaders ?? false)) {
      return false;
    }

    final pageNumberValue = _calculatePageNumberValueForParity(pageIndex);
    return pageNumberValue.isEven;
  }
}

isSectPr(XmlElement element) {
  return element.name.local == "sectPr" ||
      element.getElement("w:pPr")?.getElement("w:sectPr") != null;
}

SectPr getSectPrFrmXml(XmlElement element, WordDocument parent) {
  if (element.name.local == "sectPr") {
    return SectPr.fromElement(element, parent);
  } else {
    XmlElement sectEl = element.getElement("w:pPr")!.getElement("w:sectPr")!;
    return SectPr.fromElement(sectEl, parent);
  }
}
