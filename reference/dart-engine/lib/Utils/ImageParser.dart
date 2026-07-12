import 'dart:typed_data';
import 'dart:ui';

import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:golden_shamela/Models/VmlShapeData.dart';
import 'package:golden_shamela/Utils/VmlShapeTypeResolver.dart';
import 'package:golden_shamela/Utils/VmlColorResolver.dart';
import 'package:golden_shamela/Utils/VmlEffectsParser.dart';
import 'package:golden_shamela/Utils/VmlShapeDataParser.dart';
import 'package:golden_shamela/main.dart';
import 'package:golden_shamela/wordToHTML/DocRelations.dart';
import 'package:golden_shamela/wordToHTML/MyInt.dart';
import 'package:golden_shamela/wordToHTML/runT.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:xml/xml.dart' as xml;
import 'package:xml/xml.dart';
import 'package:golden_shamela/wordToHTML/RPr.dart';

import '../wordToHTML/ExtractWordImages.dart';
import 'DocxImageRelationshipRecovery.dart';
import 'WpsBodyPropertiesParser.dart';
import 'WpsPresetShapeParser.dart';
import 'WpsShapeStyleResolver.dart';
import 'json_converters.dart';
import 'VectorPathParser.dart';

part 'ImageParser.g.dart';

ImageData _imageData = ImageData();
late XmlElement _drawingElement;

ImageData? parseImageData(runT run, {Map<String, RelId>? customRelIdList}) {
  xml.XmlElement document = run.xmlRun!;
  // docImages
  _imageData = ImageData();
  _imageData.customRelIdList = customRelIdList;
  _imageData.parent = run;
  var drawingElement = document.findAllElements('w:drawing').firstOrNull;

  // Check for VML (w:pict) if drawing is not found
  bool isVml = false;
  if (drawingElement == null) {
    drawingElement = document.findAllElements('w:pict').firstOrNull;
    if (drawingElement != null) {
      isVml = true;
    }
  }

  if (drawingElement == null) return null;
  _drawingElement = drawingElement;

  // --- NEW: Check for Group (wpg:wgp) ---
  var groupElement = drawingElement.findAllElements('wpg:wgp').firstOrNull;
  if (groupElement != null) {
    _imageData.isGroup = true;
    _imageData.rId = "GROUP"; // Placeholder

    // Find all pictures inside the group
    var pictures = groupElement.findAllElements('pic:pic');
    for (var pic in pictures) {
      // Create a child ImageData for each picture
      ImageData childImage = ImageData();
      childImage.parent = run;
      childImage.customRelIdList = customRelIdList;

      // 1. Extract rId from blipFill
      var blip = pic.findAllElements('a:blip').firstOrNull;
      if (blip != null) {
        childImage.rId = blip.getAttribute('r:embed') ?? "";
      }
      var childBlipFill = pic.findAllElements('pic:blipFill').firstOrNull;
      if (childBlipFill != null) {
        _applySourceRect(childImage, childBlipFill);
      }

      // 2. Load Image Memory
      // IMPORTANT: Only load if customRelIdList is provided.
      // Groups appear in headers/footers which require customRelIdList.
      // If null, skip loading - it will be loaded correctly on subsequent call with customRelIdList.
      if (childImage.rId.isNotEmpty && customRelIdList != null) {
        childImage.setImageMemory(run, customRelIdList: customRelIdList);
      } else if (childImage.rId.isNotEmpty && customRelIdList == null) {
        // Will load later
      }

      // 3. Parse Dimensions & Transforms (from pic:spPr -> a:xfrm)
      var spPr = pic.findAllElements('pic:spPr').firstOrNull;
      if (spPr != null) {
        var xfrm = spPr.findAllElements('a:xfrm').firstOrNull;
        if (xfrm != null) {
          // Offsets (relative to group)
          var off = xfrm.findAllElements('a:off').firstOrNull;
          if (off != null) {
            String x = off.getAttribute('x') ?? "0";
            String y = off.getAttribute('y') ?? "0";
            // Convert EMU to Pixels? Or treat as relative pixels if already converted?
            // Usually internal units are EMUs. 1 inch = 914400 EMUs. 1 inch = 96 px.
            // 1 px = 9525 EMUs.
            childImage.posX = (int.tryParse(x) ?? 0) / 9525.0;
            childImage.posY = (int.tryParse(y) ?? 0) / 9525.0;
          }

          // Extents (Size)
          var ext = xfrm.findAllElements('a:ext').firstOrNull;
          if (ext != null) {
            String cx = ext.getAttribute('cx') ?? "0";
            String cy = ext.getAttribute('cy') ?? "0";
            childImage.width = (int.tryParse(cx) ?? 0) / 9525.0;
            childImage.height = (int.tryParse(cy) ?? 0) / 9525.0;
          }

          // Rotation
          String rot = xfrm.getAttribute('rot') ?? "0";
          childImage.rotation = (int.tryParse(rot) ?? 0) / 60000.0;

          // Flips
          childImage.flipH = xfrm.getAttribute('flipH') == '1';
          childImage.flipV = xfrm.getAttribute('flipV') == '1';
        }
      }

      _imageData.groupImages.add(childImage);
    }

    // Also set group dimensions if needed (from wpg:grpSpPr)
    var grpSpPr = groupElement.findAllElements('wpg:grpSpPr').firstOrNull;
    if (grpSpPr != null) {
      var xfrm = grpSpPr.findAllElements('a:xfrm').firstOrNull;
      if (xfrm != null) {
        var ext = xfrm.findAllElements('a:ext').firstOrNull;
        if (ext != null) {
          String cx = ext.getAttribute('cx') ?? "0";
          String cy = ext.getAttribute('cy') ?? "0";
          _imageData.width = (int.tryParse(cx) ?? 0) / 9525.0;
          _imageData.height = (int.tryParse(cy) ?? 0) / 9525.0;
        }
        // Group position
        var off = xfrm.findAllElements('a:off').firstOrNull;
        if (off != null) {
          String x = off.getAttribute('x') ?? "0";
          String y = off.getAttribute('y') ?? "0";
          _imageData.posX = (int.tryParse(x) ?? 0) / 9525.0;
          _imageData.posY = (int.tryParse(y) ?? 0) / 9525.0;
        }
      }
    }

    // Process standard positioning for the group container itself
    checkFromPage();
    checkRelativeFromV();
    setOffsets(); // Will use wp:anchor info for the group
    // Actually, setDemenisions checks wp:extent which is correct for the container
    setDemenisions();
    setRelativeHeight(); // Sets behindDoc and relativeHeight from wp:anchor
    checkWrapMode();

    return _imageData;
  }

  // --- Check for DrawingML Wordprocessing Shapes (wps:wsp) ---
  var wspElement = drawingElement.findAllElements('wps:wsp').firstOrNull;
  if (wspElement != null) {
    final presetShapeData = WpsPresetShapeParser.tryParse(wspElement);
    if (presetShapeData != null) {
      _imageData.vmlShapeData = presetShapeData;
      _imageData.vmlShapeData!.textBoxInsetPx =
          WpsBodyPropertiesParser.tryParseInsetPx(wspElement);
      _imageData.vmlShapeData!.textNoAutofit =
          WpsBodyPropertiesParser.hasNoAutoFit(wspElement);
      parseTextBox();

      setDemenisions();
      checkFromPage();
      checkRelativeFromV();
      setOffsets();
      setRelativeHeight();
      checkWrapMode();

      return _imageData;
    }

    var custGeom = wspElement.findAllElements('a:custGeom').firstOrNull;
    if (custGeom != null) {
      // هذا شكل Vector مخصص - نحاول تحليله
      _imageData.isVectorShape = true;
      _imageData.rId = "VECTOR"; // Placeholder

      // استخراج الأبعاد من wp:extent
      setDemenisions();

      // استخراج الموقع
      checkFromPage();
      checkRelativeFromV();
      setOffsets();
      setRelativeHeight(); // Sets behindDoc and relativeHeight from wp:anchor
      checkWrapMode();

      // تحليل المسار
      _parseVectorPath(custGeom, wspElement);

      // استخراج لون التعبئة والحدود
      _parseVectorColors(wspElement);

      return _imageData;
    }
  }

  if (isVml) {
    _imageData.isVml = true;
    _parseVmlData();
    // VML groups own their children; do not lift a child's txbxContent onto
    // the group container itself, or the picture sibling disappears.
    if (!_imageData.isGroup) {
      parseTextBox();
    }
    // NOTE: Do NOT call checkFromPage(), checkRelativeFromV(), setOffsets(), checkWrapMode()
    // for VML elements! These functions look for wp:anchor/wp:positionH/wp:positionV
    // which only exist in OOXML (w:drawing). VML positioning is already handled
    // by _parseVmlData() from the style attributes (margin-left, margin-top, etc.)
    // and wrapMode is set inside _parseVmlData based on position:absolute and w10:wrap.
    setRelativeHeight();
    checkHyperlink();
    return _imageData;
  }

  // محاولة العثور على الصورة
  try {
    setRId();
  } catch (e) {
    // إذا لم نجد r:embed، قد يكون Text Box
    _imageData.rId = "";
  }

  if (_imageData.rId.isEmpty) {
    // Try to parse as Text Box
    parseTextBox();
  } else {
    _imageData.setImageMemory(run, customRelIdList: customRelIdList);
  }

  checkFromPage();
  checkRelativeFromV();
  // print("fromPage ${_imageData.fromPage}");
  setDemenisions();
  setOffsets();
  setRelativeHeight();
  checkWrapMode();
  checkHyperlink(); // Check for a:hlinkClick on the image
  checkBlipFill(); // Check for stretch/tile
  return _imageData;
}

void checkBlipFill() {
  // البحث عن pic:blipFill ثم a:stretch
  // المسار: pic:pic -> pic:blipFill -> a:stretch
  // نستخدم descendants للبحث العميق لأن الهيكلية قد تختلف قليلاً
  try {
    var blipFill = _drawingElement.descendants
        .whereType<xml.XmlElement>()
        .firstWhere(
          (e) => e.name.local == 'blipFill',
          orElse: () => xml.XmlElement(xml.XmlName('null')),
        );

    if (blipFill.name.local != 'null') {
      _applySourceRect(_imageData, blipFill);

      var stretch = blipFill.descendants
          .whereType<xml.XmlElement>()
          .where((e) => e.name.local == 'stretch')
          .firstOrNull;

      if (stretch != null) {
        // إذا وجدنا stretch، نتأكد من وجود fillRect داخله
        var fillRect = stretch.descendants
            .whereType<xml.XmlElement>()
            .where((e) => e.name.local == 'fillRect')
            .firstOrNull;

        // مجرد وجود stretch يكفي عادة، ولكن fillRect يؤكد ذلك
        if (fillRect != null || stretch.children.isEmpty) {
          // stretch فارغ أحياناً يعني الافتراضي؟ لا، عادة يحوي fillRect
          // لكن لنتساهل، وجود stretch بحد ذاته إشارة قوية
          _imageData.isStretched = true;
        }
      }
    }
  } catch (e) {
    // ignore
  }
}

void _applySourceRect(ImageData imageData, xml.XmlElement blipFill) {
  final srcRect = blipFill.descendants
      .whereType<xml.XmlElement>()
      .where((e) => e.name.local == 'srcRect')
      .firstOrNull;
  if (srcRect == null) return;

  imageData.cropLeft = _parseSourceRectPercent(srcRect.getAttribute('l'));
  imageData.cropTop = _parseSourceRectPercent(srcRect.getAttribute('t'));
  imageData.cropRight = _parseSourceRectPercent(srcRect.getAttribute('r'));
  imageData.cropBottom = _parseSourceRectPercent(srcRect.getAttribute('b'));
}

double _parseSourceRectPercent(String? value) {
  final rawValue = double.tryParse(value ?? '');
  if (rawValue == null) return 0;
  return (rawValue / 100000.0).clamp(0.0, 1.0).toDouble();
}

checkWrapMode() {
  var anchor = _drawingElement.getElement("wp:anchor");
  if (anchor == null) return;

  if (anchor.getElement("wp:wrapNone") != null)
    _imageData.wrapMode = "None";
  else if (anchor.getElement("wp:wrapSquare") != null)
    _imageData.wrapMode = "Square";
  else if (anchor.getElement("wp:wrapTight") != null)
    _imageData.wrapMode = "Tight";
  else if (anchor.getElement("wp:wrapThrough") != null)
    _imageData.wrapMode = "Through";
  else if (anchor.getElement("wp:wrapTopAndBottom") != null)
    _imageData.wrapMode = "TopAndBottom";
}

/// Check for hyperlink on the image (a:hlinkClick)
void checkHyperlink() {
  // Look for a:hlinkClick in the drawing properties
  // It can be in wp:docPr (non-visual properties) or inside the picture
  var docPr = _drawingElement.findAllElements('wp:docPr').firstOrNull;
  var hlinkClick = docPr?.findAllElements('a:hlinkClick').firstOrNull;

  // Also check inside pic:nvPicPr -> pic:cNvPr
  if (hlinkClick == null) {
    var cNvPr = _drawingElement.findAllElements('pic:cNvPr').firstOrNull;
    hlinkClick = cNvPr?.findAllElements('a:hlinkClick').firstOrNull;
  }

  // Also look in the anchor/inline non-visual properties
  if (hlinkClick == null) {
    hlinkClick = _drawingElement.findAllElements('a:hlinkClick').firstOrNull;
  }

  if (hlinkClick != null) {
    String? rId = hlinkClick.getAttribute('r:id');
    if (rId != null && rId.isNotEmpty) {
      var wordDocument = _imageData.parent?.parent?.parent?.parent;
      if (wordDocument != null) {
        var relId = wordDocument.relIdList[rId];
        if (relId != null) {
          _imageData.hyperlinkUrl = relId.Target;
        }
      }

      // Also check custom relationships (for headers/footers)
      if (_imageData.hyperlinkUrl == null &&
          _imageData.customRelIdList != null) {
        var relId = _imageData.customRelIdList![rId];
        if (relId != null) {
          _imageData.hyperlinkUrl = relId.Target;
        }
      }
    }
  }
}

void parseTextBox() {
  // التحقق أولاً من وجود حقل PAGE داخل TextBox
  // البحث عن w:fldSimple أو w:instrText التي تحتوي على PAGE
  var fldSimpleElements = _drawingElement.findAllElements('w:fldSimple');
  for (var fldSimple in fldSimpleElements) {
    String? instr = fldSimple.getAttribute('w:instr');
    if (instr != null && instr.toUpperCase().contains('PAGE')) {
      _imageData.containsPageField = true;
      // debugPrint("🔢 TextBox contains PAGE field (fldSimple)");
      break;
    }
  }

  // التحقق من w:instrText داخل الحقول المعقدة
  if (!_imageData.containsPageField) {
    var instrTextElements = _drawingElement.findAllElements('w:instrText');
    for (var instrText in instrTextElements) {
      if (instrText.text.toUpperCase().contains('PAGE')) {
        _imageData.containsPageField = true;
        // debugPrint("🔢 TextBox contains PAGE field (instrText)");
        break;
      }
    }
  }

  // محاولة استخراج النص من Text Box
  // نبحث أولاً داخل mc:Choice فقط لتجنب تكرار النص من mc:Fallback
  xml.XmlElement? searchRoot = _drawingElement
      .findAllElements('mc:Choice')
      .firstOrNull;
  // إذا لم يوجد mc:Choice، نستخدم العنصر الكامل
  searchRoot ??= _drawingElement;

  // حفظ عنصر w:txbxContent
  var txbxContent = searchRoot.findAllElements('w:txbxContent').firstOrNull;
  if (txbxContent != null) {
    if (_imageData.vmlShapeData == null) {
      // Create empty VmlShapeData only if it doesn't exist yet
      // For VML shapes (v:roundrect, v:line, etc.), vmlShapeData is already created in _parseVmlData
      // so we should NOT override it here
      _imageData.vmlShapeData = VmlShapeData(shapeType: 'textbox');
    }
    // Set textBoxElement regardless of whether VmlShapeData was just created or already existed
    _imageData.vmlShapeData!.textBoxElement = txbxContent;
  }

  var textElements = searchRoot.findAllElements('w:t');
  if (textElements.isNotEmpty) {
    StringBuffer buffer = StringBuffer();
    for (var t in textElements) {
      buffer.write(t.text);
      buffer.write(" "); // مسافة بين النصوص
    }
    _imageData.textBoxText = buffer.toString().trim();

    // محاولة البحث عن خصائص التنسيق داخل w:txbxContent
    // نبحث عن الفقرة الأولى التي تحتوي على نص
    var textRun = searchRoot
        .findAllElements('w:r')
        .firstWhere(
          (r) => r.findAllElements('w:t').isNotEmpty,
          orElse: () => searchRoot!.findAllElements('w:r').first,
        );

    // نحاول اختيار أفضل run يملك معلومات خطوط واضحة
    var rPrElement = textRun.findAllElements('w:rPr').firstOrNull;

    if (rPrElement != null) {
      // استخراج الخط (Font Family)
      var fontsElement = rPrElement.findAllElements('w:rFonts').firstOrNull;
      if (fontsElement != null) {
        // نفضّل hAnsi/ascii (غالباً الخط المستخدم في الوورد) ثم cs
        String? hAnsi = fontsElement.getAttribute('w:hAnsi');
        String? ascii = fontsElement.getAttribute('w:ascii');
        String? cs = fontsElement.getAttribute('w:cs');

        _imageData.fontFamily = hAnsi;
        if (_imageData.fontFamily == null || _imageData.fontFamily!.isEmpty) {
          _imageData.fontFamily = ascii;
        }
        if (_imageData.fontFamily == null || _imageData.fontFamily!.isEmpty) {
          _imageData.fontFamily = cs;
        }
      }

      // استخراج اللون
      var colorAttr = rPrElement
          .findAllElements('w:color')
          .firstOrNull
          ?.getAttribute('w:val');
      if (colorAttr != null) {
        _imageData.textColor = colorAttr;
      }

      // استخراج الحجم
      // نحاول w:szCs أولاً (للنصوص العربية/المعقدة) ثم w:sz
      var szCsAttr = rPrElement
          .findAllElements('w:szCs')
          .firstOrNull
          ?.getAttribute('w:val');
      var szAttr = rPrElement
          .findAllElements('w:sz')
          .firstOrNull
          ?.getAttribute('w:val');

      var sizeToUse = szCsAttr ?? szAttr;

      if (sizeToUse != null) {
        try {
          // الحجم في Word يكون بوحدات نصف نقطة (half-points)
          // غالباً ما تحتاج Flutter إلى تكبير الخط قليلاً ليطابق الوورد
          // سنستخدم عامل ضرب 1.0 مبدئياً، أو يمكن زيادته إذا لزم الأمر
          _imageData.textSize = double.parse(sizeToUse) / 2;
        } catch (e) {
          // ignore
        }
      }
    }
  }
}

void _parseVmlData() {
  var group = _drawingElement.descendants
      .whereType<xml.XmlElement>()
      .firstWhere(
        (e) => e.name.local == 'group',
        orElse: () => xml.XmlElement(xml.XmlName('null')),
      );

  if (group.name.local != 'null') {
    String? groupStyle = group.getAttribute('style');
    Map<String, String> groupStyleMap = {};
    if (groupStyle != null) {
      groupStyleMap = _parseVmlStyleMap(groupStyle);
      _parseVmlStyle(groupStyle);
    }

    final coordSizeParts = (group.getAttribute('coordsize') ?? '1,1').split(
      ',',
    );

    final double coordSizeX =
        double.tryParse(coordSizeParts.firstOrNull ?? '1') ?? 1;
    final double coordSizeY =
        double.tryParse(coordSizeParts.length > 1 ? coordSizeParts[1] : '1') ??
        1;
    final coordOriginParts = (group.getAttribute('coordorigin') ?? '0,0').split(
      ',',
    );
    final double coordOriginX =
        double.tryParse(coordOriginParts.firstOrNull ?? '0') ?? 0;
    final double coordOriginY =
        double.tryParse(
          coordOriginParts.length > 1 ? coordOriginParts[1] : '0',
        ) ??
        0;

    _imageData.isGroup = true;
    _imageData.isVml = true;
    _imageData.groupImages = [];
    _imageData.posX = _parseUnit(groupStyleMap['margin-left'] ?? '0');
    _imageData.posY = _parseUnit(groupStyleMap['margin-top'] ?? '0');
    final groupHasAbsolutePositioning =
        groupStyle?.toLowerCase().contains('position:absolute') == true;
    // A v:group without position:absolute behaves as an inline/line object.
    // Its child shapes can still use absolute coordinates inside coordsize.
    _imageData.isInlineVmlGroup = !groupHasAbsolutePositioning;
    if (groupHasAbsolutePositioning) {
      _parseVmlWrap(group);
    }
    _parseVmlZIndex(groupStyleMap['z-index']);

    for (final shape in group.childElements.where(
      (e) => e.name.local == 'shape',
    )) {
      final childImage = ImageData();
      childImage.parent = _imageData.parent;
      childImage.customRelIdList = _imageData.customRelIdList;

      final styleMap = _parseVmlStyleMap(shape.getAttribute('style') ?? '');
      final double leftRaw = _extractVmlStyleNumber(styleMap['left']);
      final double topRaw = _extractVmlStyleNumber(styleMap['top']);
      final double widthRaw = _extractVmlStyleNumber(styleMap['width']);
      final double heightRaw = _extractVmlStyleNumber(styleMap['height']);

      childImage.posX =
          ((leftRaw - coordOriginX) * _imageData.width) /
          (coordSizeX == 0 ? 1 : coordSizeX);
      childImage.posY =
          ((topRaw - coordOriginY) * _imageData.height) /
          (coordSizeY == 0 ? 1 : coordSizeY);
      childImage.width =
          (widthRaw * _imageData.width) / (coordSizeX == 0 ? 1 : coordSizeX);
      childImage.height =
          (heightRaw * _imageData.height) / (coordSizeY == 0 ? 1 : coordSizeY);
      childImage.relativeFromH = _imageData.relativeFromH;
      childImage.relativeFromV = _imageData.relativeFromV;
      childImage.wrapMode = _imageData.wrapMode;
      childImage.behindDoc = _imageData.behindDoc;
      childImage.relativeHeight = _imageData.relativeHeight;
      childImage.isVml = true;
      childImage.vmlShapeData = VmlShapeDataParser.buildForShape(
        shape: shape,
        parseUnit: _parseUnit,
        wordDocument: _imageData.parent?.parent.parent.parent,
      );

      final lockElement = shape.childElements.firstWhere(
        (e) => e.name.local == 'lock',
        orElse: () => xml.XmlElement(xml.XmlName('null')),
      );
      if (lockElement.name.local != 'null') {
        final aspectRatio = lockElement
            .getAttribute('aspectratio')
            ?.toLowerCase();
        if (aspectRatio == 'f' || aspectRatio == 'false') {
          childImage.isStretched = true;
        }
      }

      var imageData = shape.descendants.whereType<xml.XmlElement>().firstWhere(
        (e) => e.name.local == 'imagedata',
        orElse: () => xml.XmlElement(xml.XmlName('null')),
      );

      if (imageData.name.local != 'null') {
        String? rId = imageData.getAttribute('r:id');
        if (rId != null) {
          childImage.rId = rId;
          childImage.setImageMemory(
            _imageData.parent!,
            customRelIdList: _imageData.customRelIdList,
          );
        }
      }

      final txbxContentElement = shape.descendants
          .whereType<xml.XmlElement>()
          .firstWhere(
            (e) => e.name.local == 'txbxContent',
            orElse: () => xml.XmlElement(xml.XmlName('null')),
          );
      if (txbxContentElement.name.local != 'null') {
        childImage.vmlShapeData!.textBoxElement = txbxContentElement;
      }

      final textboxElement = shape.descendants
          .whereType<xml.XmlElement>()
          .firstWhere(
            (e) => e.name.local == 'textbox',
            orElse: () => xml.XmlElement(xml.XmlName('null')),
          );
      if (textboxElement.name.local != 'null') {
        childImage.vmlShapeData!.textBoxInset =
            textboxElement.getAttribute('inset');
      }

      _imageData.groupImages.add(childImage);
    }

    return;
  }

  // 1. Find v:shape or other VML shapes
  final vmlShapeNames = {
    'shape',
    'rect',
    'roundrect',
    'oval',
    'line',
    'polyline',
    'curve',
    'arc',
    'image',
  };

  var shape = _drawingElement.descendants
      .whereType<xml.XmlElement>()
      .firstWhere(
        (e) => vmlShapeNames.contains(e.name.local),
        orElse: () => xml.XmlElement(xml.XmlName('null')),
      );

  if (shape.name.local == 'null') {
    return;
  }

  // 2. Extract Dimensions from style attribute
  // style="...width:261.35pt;height:42.3pt..."
  String? style = shape.getAttribute('style');
  final shapeTypeElement =
      VmlShapeDataParser.resolveReferencedShapeTypeElement(shape);
  final wrapElement = shape.childElements.firstWhere(
    (e) => e.name.local == 'wrap',
    orElse: () => xml.XmlElement(xml.XmlName('null')),
  );
  if (style != null) {
    final styleMap = _parseVmlStyleMap(style);
    _parseVmlStyle(style);
    _applyVmlHorizontalPositioningFromStyleMap(styleMap);
    _applyVmlVerticalPositioningFromStyleMap(styleMap);

    // Extract VmlShapeData
    _imageData.vmlShapeData = VmlShapeData(
      shapeType: VmlShapeTypeResolver.resolve(shape),
      arcSize:
          double.tryParse(
            shape.getAttribute('arcsize')?.replaceAll('f', '') ?? '0.2',
          ) ??
          0.2,
    );

    // Quick handle of arcSize: if "f" format (e.g. 10923f), it means 10923/65536
    String arcAttr = shape.getAttribute('arcsize') ?? '';
    if (arcAttr.endsWith('f')) {
      double f =
          double.tryParse(arcAttr.substring(0, arcAttr.length - 1)) ?? 13107.0;
      _imageData.vmlShapeData!.arcSize = f / 65536.0;
    } else if (arcAttr.endsWith('%')) {
      double p =
          double.tryParse(arcAttr.substring(0, arcAttr.length - 1)) ?? 20.0;
      _imageData.vmlShapeData!.arcSize = p / 100.0;
    }

    // Stroke Color and Weight
    String strokeColorStr = shape.getAttribute('strokecolor') ?? '';
    final strokeColor = parseVmlColorValue(
      strokeColorStr,
      wordDocument: _imageData.parent?.parent.parent.parent,
    );
    if (strokeColor != null) {
      _imageData.vmlShapeData!.strokeColor = strokeColor;
    }
    String strokeWeightStr = shape.getAttribute('strokeweight') ?? '1.0';
    _imageData.vmlShapeData!.strokeWidth = _parseUnit(strokeWeightStr);
    final strokeElement = shape.childElements.firstWhere(
      (e) => e.name.local == 'stroke',
      orElse: () => xml.XmlElement(xml.XmlName('null')),
    );
    if (strokeElement.name.local != 'null') {
      _imageData.vmlShapeData!.strokeDashStyle =
          strokeElement.getAttribute('dashstyle');
      _imageData.vmlShapeData!.strokeEndCap =
          strokeElement.getAttribute('endcap');
    }

    String fillcolorAttr = shape.getAttribute('fillcolor') ?? '';
    final fillColor = parseVmlColorValue(
      fillcolorAttr,
      wordDocument: _imageData.parent?.parent.parent.parent,
    );
    if (fillColor != null) {
      _imageData.vmlShapeData!.fillColor = fillColor;
    }
    _imageData.vmlShapeData!.fillStyle = VmlEffectsParser.parseFill(
      shape,
      fallbackColor: fillColor,
    );
    _imageData.vmlShapeData!.shadowStyle = VmlEffectsParser.parseShadow(shape);
    // VML allows visual defaults such as filled/stroked to live on the
    // referenced v:shapetype. If v:shape omits them, Word still inherits those
    // defaults; treating the omission as "true" invents borders/fills that are
    // not present in the XML-rendered document.
    final filledAttr =
        shape.getAttribute('filled')?.trim().toLowerCase() ??
        shapeTypeElement?.getAttribute('filled')?.trim().toLowerCase();
    if (filledAttr == 'f' || filledAttr == 'false') {
      _imageData.vmlShapeData!.isFilled = false;
    }
    final strokedAttr =
        shape.getAttribute('stroked')?.trim().toLowerCase() ??
        shapeTypeElement?.getAttribute('stroked')?.trim().toLowerCase();
    if (strokedAttr == 'f' || strokedAttr == 'false') {
      _imageData.vmlShapeData!.isStroked = false;
    }

    if (styleMap.containsKey('left') && styleMap.containsKey('margin-left')) {
      _imageData.posX =
          _parseUnit(styleMap['left']!) + _parseUnit(styleMap['margin-left']!);
    } else if (styleMap.containsKey('left')) {
      _imageData.posX = _parseUnit(styleMap['left']!);
    } else if (styleMap.containsKey('margin-left')) {
      _imageData.posX = _parseUnit(styleMap['margin-left']!);
    }

    if (styleMap.containsKey('top') && styleMap.containsKey('margin-top')) {
      _imageData.posY =
          _parseUnit(styleMap['top']!) + _parseUnit(styleMap['margin-top']!);
    } else if (styleMap.containsKey('top')) {
      _imageData.posY = _parseUnit(styleMap['top']!);
    } else if (styleMap.containsKey('margin-top')) {
      _imageData.posY = _parseUnit(styleMap['margin-top']!);
    }

    _parseVmlZIndex(styleMap['z-index']);

    // Extract w:txbxContent for rich text rendering
    var txbxContentElement = shape.descendants
        .whereType<xml.XmlElement>()
        .firstWhere(
          (e) => e.name.local == 'txbxContent',
          orElse: () => xml.XmlElement(xml.XmlName('null')),
        );
    if (txbxContentElement.name.local != 'null') {
      _imageData.vmlShapeData!.textBoxElement = txbxContentElement;
    }

    final textboxElement = shape.descendants
        .whereType<xml.XmlElement>()
        .firstWhere(
          (e) => e.name.local == 'textbox',
          orElse: () => xml.XmlElement(xml.XmlName('null')),
        );
    if (textboxElement.name.local != 'null') {
      _imageData.vmlShapeData!.textBoxInset = textboxElement.getAttribute('inset');
    }

  }

  // Handle v:line dimensions and position from 'from'/'to' attributes
  if (shape.name.local == 'line') {
    String from = shape.getAttribute('from') ?? '0,0';
    String to = shape.getAttribute('to') ?? '100,0';
    List<String> fromParts = from.split(',');
    List<String> toParts = to.split(',');
    if (fromParts.length == 2 && toParts.length == 2) {
      double fromX = _parseUnit(fromParts[0]);
      double fromY = _parseUnit(fromParts[1]);
      double toX = _parseUnit(toParts[0]);
      double toY = _parseUnit(toParts[1]);
      _imageData.width = (toX - fromX).abs();
      _imageData.height = (toY - fromY).abs();
      if (_imageData.width == 0) _imageData.width = 1.0;
      if (_imageData.height == 0) _imageData.height = 1.0;
      // v:line position comes from 'from' coords when no margin-left/top in style
      if (_imageData.posX <= 0) _imageData.posX = fromX;
      if (_imageData.posY <= 0) _imageData.posY = fromY;
    }
  }

  final hasAbsolutePositioning =
      style?.toLowerCase().contains('position:absolute') == true;
  if (hasAbsolutePositioning) {
    if (!_hasExplicitVmlVerticalReference(style)) {
      _imageData.relativeFromV = 'paragraph';
    }

    if (wrapElement.name.local != 'null') {
      _parseVmlWrap(shape);
    } else {
      _imageData.relativeFromH = 'column';
      _imageData.relativeFromV = 'paragraph';
      _imageData.wrapMode = 'None';
    }
  }

  final lockElement = shape.childElements.firstWhere(
    (e) => e.name.local == 'lock',
    orElse: () => xml.XmlElement(xml.XmlName('null')),
  );
  if (lockElement.name.local != 'null') {
    final aspectRatio = lockElement.getAttribute('aspectratio')?.toLowerCase();
    if (aspectRatio == 'f' || aspectRatio == 'false') {
      _imageData.isStretched = true;
    }
  }

  // 3. Extract r:id from v:imagedata
  var imageData = shape.descendants.whereType<xml.XmlElement>().firstWhere(
    (e) => e.name.local == 'imagedata',
    orElse: () => xml.XmlElement(xml.XmlName('null')),
  );

  if (imageData.name.local != 'null') {
    String? rId = imageData.getAttribute('r:id');
    if (rId != null) {
      _imageData.rId = rId;

      _imageData.setImageMemory(
        _imageData.parent!,
        customRelIdList: _imageData.customRelIdList,
      );
    }
  }
}

void _parseVmlStyle(String style) {
  final styleMap = _parseVmlStyleMap(style);
  if (styleMap.containsKey('width')) {
    _imageData.width = _parseUnit(styleMap['width']!);
  }
  if (styleMap.containsKey('height')) {
    _imageData.height = _parseUnit(styleMap['height']!);
  }
}

Map<String, String> _parseVmlStyleMap(String style) {
  final Map<String, String> styleMap = {};
  for (final part in style.split(';')) {
    final kv = part.split(':');
    if (kv.length == 2) {
      styleMap[kv[0].trim().toLowerCase()] = kv[1].trim().toLowerCase();
    }
  }
  return styleMap;
}

void _applyVmlHorizontalPositioningFromStyleMap(Map<String, String> styleMap) {
  final horizontalAlign = _normalizeVmlHorizontalAlign(
    styleMap['mso-position-horizontal'],
  );
  if (horizontalAlign != null) {
    _imageData.alignH = horizontalAlign;
  }

  final relative = styleMap['mso-position-horizontal-relative']
      ?.trim()
      .toLowerCase();
  if (relative == 'page') {
    _imageData.relativeFromH = 'page';
  } else if (relative == 'margin') {
    _imageData.relativeFromH = 'margin';
  } else if (relative == 'text') {
    _imageData.relativeFromH = 'column';
  } else if (horizontalAlign != null) {
    // In VML, style-based horizontal positioning commonly describes page-level placement
    // even when the relative attribute is omitted.
    _imageData.relativeFromH = 'page';
  }
}

String? _normalizeVmlHorizontalAlign(String? value) {
  switch (value?.trim().toLowerCase()) {
    case 'left':
      return 'left';
    case 'center':
      return 'center';
    case 'right':
      return 'right';
    default:
      return null;
  }
}

String? _normalizeVmlVerticalAlign(String? value) {
  switch (value?.trim().toLowerCase()) {
    case 'top':
      return 'top';
    case 'center':
      return 'center';
    case 'bottom':
      return 'bottom';
    default:
      return null;
  }
}

bool _hasExplicitVmlHorizontalReference(String? style) {
  if (style == null) return false;
  return style.toLowerCase().contains('mso-position-horizontal');
}

bool _hasExplicitVmlVerticalReference(String? style) {
  if (style == null) return false;
  return style.toLowerCase().contains('mso-position-vertical');
}

double _extractVmlStyleNumber(String? value) {
  if (value == null || value.isEmpty) return 0;
  final normalized = value.trim().toLowerCase();
  if (normalized.endsWith('pt') || normalized.endsWith('px')) {
    return _parseUnit(normalized);
  }
  return double.tryParse(normalized) ?? 0;
}

void _parseVmlWrap(xml.XmlElement container) {
  final wrap = container.childElements.firstWhere(
    (e) => e.name.local == 'wrap',
    orElse: () => xml.XmlElement(xml.XmlName('null')),
  );

  if (wrap.name.local == 'null') {
    _imageData.wrapMode = 'None';
    return;
  }

  final wrapType = wrap.getAttribute('type')?.toLowerCase();
  final anchorY = wrap.getAttribute('anchory')?.trim().toLowerCase();
  final anchorX = wrap.getAttribute('anchorx')?.trim().toLowerCase();

  if (_shouldUseWrapAnchorXForBodyTextBox(container)) {
    if (anchorX == 'page') {
      _imageData.relativeFromH = 'page';
    } else if (anchorX == 'margin') {
      _imageData.relativeFromH = 'margin';
    } else if (anchorX == 'text') {
      _imageData.relativeFromH = 'column';
    }
  }

  if (anchorY == 'page') {
    _imageData.relativeFromV = 'page';
  } else if (anchorY == 'margin') {
    _imageData.relativeFromV = 'margin';
  } else if (anchorY == 'text') {
    _imageData.relativeFromV = 'paragraph';
  } else if (anchorY == 'line') {
    _imageData.relativeFromV = 'line';
  }

  if (wrapType == 'square') {
    _imageData.wrapMode = 'Square';
  } else if (wrapType == 'tight') {
    _imageData.wrapMode = 'Tight';
  } else if (wrapType == 'through') {
    _imageData.wrapMode = 'Through';
  } else if (wrapType == 'topandbottom') {
    _imageData.wrapMode = 'TopAndBottom';
  } else {
    _imageData.wrapMode = 'None';
  }
}

bool _shouldUseWrapAnchorXForBodyTextBox(xml.XmlElement container) {
  final paragraph = _imageData.parent?.parent;
  final isHeaderOrFooter = paragraph?.isHeaderParagraph == true;
  if (isHeaderOrFooter) {
    return false;
  }

  if (_imageData.vmlShapeData?.textBoxElement == null) {
    return false;
  }

  if (_imageData.posX != 0) {
    return false;
  }

  final style = container.getAttribute('style');
  if (_hasExplicitVmlHorizontalReference(style)) {
    return false;
  }

  return true;
}

void _applyVmlVerticalPositioningFromStyleMap(Map<String, String> styleMap) {
  final verticalAlign = _normalizeVmlVerticalAlign(
    styleMap['mso-position-vertical'],
  );

  if (verticalAlign != null) {
    _imageData.alingV = verticalAlign;
  }

  final relative = styleMap['mso-position-vertical-relative']
      ?.trim()
      .toLowerCase();
  if (relative == 'page') {
    _imageData.relativeFromV = 'page';
  } else if (relative == 'margin') {
    _imageData.relativeFromV = 'margin';
  } else if (relative == 'text') {
    _imageData.relativeFromV = 'paragraph';
  } else if (relative == 'line') {
    _imageData.relativeFromV = 'line';
  }
}

void _parseVmlZIndex(String? zIndexValue) {
  if (zIndexValue == null || zIndexValue.trim().isEmpty) {
    return;
  }

  final normalized = zIndexValue.trim().replaceAll(RegExp(r'[^\d\-\.]'), '');
  final zIndex = double.tryParse(normalized) ?? 0;

  _imageData.behindDoc = zIndex < 0;
  _imageData.relativeHeight = zIndex;
  _imageData.vmlZIndex = zIndex;

}

double _parseUnit(String value) {
  double val = 0;
  if (value.endsWith('pt')) {
    val = double.tryParse(value.replaceAll('pt', '')) ?? 0;
    // points to pixels (approximate, context dependent but typically 1.33x)
    // Flutter logical pixels are usually approx 96dpi, points are 72dpi. 96/72 = 1.333
    val = val * 1.333;
  } else if (value.endsWith('px')) {
    val = double.tryParse(value.replaceAll('px', '')) ?? 0;
  } else if (value.endsWith('in')) {
    val = double.tryParse(value.replaceAll('in', '')) ?? 0;
    val = val * 96.0;
  } else {
    // Try parse raw number
    val = double.tryParse(value) ?? 0;
  }
  return val;
}

void setDemenisions() {
  setWidth();
  setHeight();
  setRotation();
  // fixMaxes();
}

void setRotation() {
  // Use descendants to find any element with 'rot' attribute to be safe
  // and avoid issues with findAllElements naming or specific parent filtering
  var elementWithRot = _drawingElement.descendants
      .whereType<xml.XmlElement>()
      .firstWhere(
        (e) => e.getAttribute('rot') != null,
        orElse: () => _drawingElement, // Fallback to avoid null, check later
      );

  String? rotAttr = elementWithRot.getAttribute('rot');

  // Debug print
  // print(
  //   "🔍 Rotation Search: Found rot='$rotAttr' in element '${elementWithRot.name.local}'",
  // );

  if (rotAttr != null) {
    try {
      // Rotation is in 60000ths of a degree
      double val = double.parse(rotAttr);
      _imageData.rotation = val / 60000;
      // print("   -> Parsed Rotation: ${_imageData.rotation} degrees");

      // Parse flipH and flipV
      String? flipHAttr = elementWithRot.getAttribute('flipH');
      String? flipVAttr = elementWithRot.getAttribute('flipV');
      if (flipHAttr == "1" || flipHAttr == "true") _imageData.flipH = true;
      if (flipVAttr == "1" || flipVAttr == "true") _imageData.flipV = true;

      double? xfrmWidth;
      double? xfrmHeight;
      String? xfrmCx = elementWithRot.getElement('a:ext')?.getAttribute('cx');
      String? xfrmCy = elementWithRot.getElement('a:ext')?.getAttribute('cy');
      if (xfrmCx != null) xfrmWidth = double.tryParse(xfrmCx);
      if (xfrmCy != null) xfrmHeight = double.tryParse(xfrmCy);

      // Parse effectExtent to check for compensation
      // wp:effectExtent l="1588" t="0" r="4762" b="4763"
      bool hasEffectCompensation = false;
      var effectExtent = _drawingElement.descendants
          .whereType<XmlElement>()
          .firstWhere(
            (e) => e.name.local == 'effectExtent',
            orElse: () => XmlElement(XmlName('null')),
          );
      if (effectExtent.name.local != 'null') {
        double r = double.tryParse(effectExtent.getAttribute('r') ?? '0') ?? 0;
        double b = double.tryParse(effectExtent.getAttribute('b') ?? '0') ?? 0;
        if (r > 0 || b > 0) hasEffectCompensation = true;
      }

      // Logic:
      // 1. Calculate Aspect Ratios
      // 2. If Rotation implies inversion (90, 270)
      // 3. AND wp:extent AR matches a:xfrm AR (Mismatch between layout and rotation)
      // -> SWAP (To enforce correct bounding box).

      // Special Handling for EXIF conflict:
      // If 'hasEffectCompensation' is true, it suggests the image might validly be "Rotated" in XML
      // but its content is ALREADY upright (EXIF).
      // In this case, we SWAP dimensions (for layout) but RESET rotation to 0 (for content).

      bool isRotated90or270 =
          (_imageData.rotation.abs() - 90).abs() < 1.0 ||
          (_imageData.rotation.abs() - 270).abs() < 1.0;

      if (isRotated90or270 && xfrmWidth != null && xfrmHeight != null) {
        double arExtent = _imageData.width / _imageData.height;
        double arXfrm = xfrmWidth / xfrmHeight;

        // Check if aspect ratios are similar (indicating extent is NOT rotated yet)
        bool arMatches =
            (arExtent - arXfrm).abs() < 0.1 ||
            (arExtent - arXfrm).abs() / arExtent < 0.1;

        if (arMatches) {
          // print("   -> 🔄 Aspect Ratio Mismatch detected. Swapping W/H.");
          double temp = _imageData.width;
          _imageData.width = _imageData.height;
          _imageData.height = temp;

          if (hasEffectCompensation) {
            // print("   -> 🛑 EffectExtent detected. Resetting rotation to 0 to avoid double-rotation.");
            _imageData.rotation = 0;
          }
        }
      }
    } catch (e) {
      print("Error parsing rotation: $e");
    }
  } else {
    // print("⚠️ No xfrm found/rot attribute for rId=${_imageData.rId}");
  }
}

// void fixMaxes() {
//   double maxH = (wordDocument.sectpr?.height ?? 1132);
//   // maxH = maxH*0.9;
//   double maxW = (wordDocument.sectpr?.width ?? 793);
//   // maxW = maxW*0.9;
//   if (_imageData.height > maxH) _imageData.height = maxH;
//   if (_imageData.width > maxW) _imageData.width = maxW;
// }

void setOffsets() {
  _imageData.posX = getPosOffset("H");
  _imageData.posY = getPosOffset("V");
  _imageData.alignH = setPosAlign("H") ?? "left";
  _imageData.alingV = setPosAlign("V") ?? "top";
}

setRelativeHeight() {
  // إذا wp:anchor غير موجود (مثل VML)، لا نغيّر relativeHeight/behindDoc
  var anchorElm = _drawingElement.getElement("wp:anchor");
  if (anchorElm == null) {
    return;
  }

  String s = anchorElm.getAttribute("relativeHeight") ?? "0";
  _imageData.relativeHeight = double.tryParse(s) ?? 0;

  // قراءة behindDoc: "1" أو "true" = خلف النص، "0" أو غير ذلك = أمام النص
  String? behindDocAttr = anchorElm.getAttribute("behindDoc");
  _imageData.behindDoc = (behindDocAttr == "1" || behindDocAttr == "true");

  // Debug: طباعة قيمة behindDoc
  // debugPrint(
  //   "🖼️ IMAGE behindDoc: attr='$behindDocAttr' -> behindDoc=${_imageData.behindDoc}, rId=${_imageData.rId}",
  // );
}

setWidth() {
  _imageData.width = getExtent(_drawingElement, "cx");
}

setHeight() {
  _imageData.height = getExtent(_drawingElement, "cy");
}

double getExtent(xml.XmlElement drawingElement, String extent) {
  // قد لا يكون هناك wp:extent إذا كان رسمًا مضمنًا (inline) وليس anchor
  // لكن في حالة TextBox عادة يكون anchor
  try {
    xml.XmlElement extentElement = drawingElement
        .findAllElements('wp:extent')
        .firstWhere(
          (element) =>
              element.getAttribute('cx') != null &&
              element.getAttribute('cy') != null,
        );

    double e = double.parse(extentElement.getAttribute(extent)!);
    e = e.emuToPx();
    return e;
  } catch (e) {
    return 100; // Default if not found
  }
}

setRId() {
  // نستخدم orElse لتجنب الخطأ إذا لم تكن هناك صورة
  xml.XmlElement? blipElement = _drawingElement
      .findAllElements('a:blip')
      .firstWhere(
        (element) => element.getAttribute('r:embed') != null,
        orElse: () => throw Exception("No blip found"),
      );
  _imageData.rId = blipElement.getAttribute('r:embed')!;
}

/// تحليل مسار Vector من a:custGeom باستخدام VectorPathParser
/// يستخدم VectorPathParser.dart للتحليل الفعلي
void _parseVectorPath(xml.XmlElement custGeom, xml.XmlElement wspElement) {
  // استخدام VectorPathParser للتحليل
  final results = VectorPathParser.parseCustomGeometry(
    custGeom,
    targetWidth: _imageData.width > 0 ? _imageData.width : null,
    targetHeight: _imageData.height > 0 ? _imageData.height : null,
  );

  // نأخذ أول مسار فقط (عادة يكون هناك مسار واحد)
  if (results.isNotEmpty) {
    _imageData.vectorPath = results.first.path;
  }
}

/// استخراج ألوان التعبئة والحدود من wps:wsp
void _parseVectorColors(xml.XmlElement wspElement) {
  final style = WpsShapeStyleResolver.resolve(wspElement);

  _imageData.vectorFillColor = style.fillColor;

  if (style.isStroked == false) {
    _imageData.vectorStrokeColor = null;
    return;
  }

  _imageData.vectorStrokeColor = style.strokeColor;
  if (style.strokeWidth != null) {
    _imageData.vectorStrokeWidth = style.strokeWidth!;
    if (_imageData.vectorStrokeWidth < 0.5) {
      _imageData.vectorStrokeWidth = 1.0;
    }
  }

  // فقط عند غياب أي تصريح بنيوي عن noFill/noLine أو fallback VML،
  // نُبقي fallback القديم ليتوافق مع الأشكال التي تعتمد على الافتراضات.
  if (_imageData.vectorFillColor == null &&
      _imageData.vectorStrokeColor == null &&
      style.isFilled == null &&
      style.isStroked == null) {
    _imageData.vectorStrokeColor = const Color(0xFF000000);
  }
}

/// تحليل لون من عنصر a:solidFill
Color? _parseDrawingColor(xml.XmlElement solidFill) {
  // البحث عن a:srgbClr (لون RGB مباشر)
  final srgbClr = solidFill.findAllElements('a:srgbClr').firstOrNull;
  if (srgbClr != null) {
    final val = srgbClr.getAttribute('val');
    if (val != null && val.length == 6) {
      try {
        return Color(int.parse('FF$val', radix: 16));
      } catch (e) {
        // تجاهل الخطأ
      }
    }
  }

  // البحث عن a:schemeClr (لون من الثيم)
  final schemeClr = solidFill.findAllElements('a:schemeClr').firstOrNull;
  if (schemeClr != null) {
    final val = schemeClr.getAttribute('val');
    if (val != null) {
      // تحويل أسماء scheme إلى أسماء theme المتوافقة مع resolveThemeColor
      const schemeToTheme = {
        'tx1': 'dark1',
        'tx2': 'dark2',
        'bg1': 'light1',
        'bg2': 'light2',
        'dk1': 'dark1',
        'dk2': 'dark2',
        'lt1': 'light1',
        'lt2': 'light2',
        'accent1': 'accent1',
        'accent2': 'accent2',
        'accent3': 'accent3',
        'accent4': 'accent4',
        'accent5': 'accent5',
        'accent6': 'accent6',
        'hlink': 'hyperlink',
        'folHlink': 'followedHyperlink',
      };

      String themeName = schemeToTheme[val] ?? val;

      // الحصول على themeColors من المستند الأب
      try {
        var wordDocument = _imageData.parent?.parent.parent.parent;
        if (wordDocument != null) {
          String? resolved = resolveThemeColor(
            wordDocument.themeColors,
            themeName,
            null, // tint (يمكن دعمه لاحقاً)
            null, // shade
          );
          if (resolved != null && resolved.length == 6) {
            return Color(int.parse('FF$resolved', radix: 16));
          }
        }
      } catch (_) {
        // fallback to hardcoded colors below
      }

      // fallback: ألوان ثابتة فقط في حال فشل الوصول للثيم
      switch (val) {
        case 'tx1':
        case 'dk1':
          return const Color(0xFF000000); // أسود
        case 'bg1':
        case 'lt1':
          return const Color(0xFFFFFFFF); // أبيض
        case 'accent1':
          return const Color(0xFF4472C4); // أزرق
        case 'accent2':
          return const Color(0xFFED7D31); // برتقالي
        default:
          return const Color(0xFF000000); // افتراضي أسود
      }
    }
  }

  return null;
}

checkFromPage() {
  _imageData.relativeFromH =
      _drawingElement
          .getElement("wp:anchor")
          ?.getElement("wp:positionH")
          ?.getAttribute("relativeFrom") ??
      "margin";
}

checkRelativeFromV() {
  _imageData.relativeFromV =
      _drawingElement
          .getElement("wp:anchor")
          ?.getElement("wp:positionV")
          ?.getAttribute("relativeFrom") ??
      "margin";
  // print("relativeFromV: ${_imageData.relativeFromV} ");
}

double getPosOffset(String orientation) {
  // البحث عن anchor أو inline أولاً
  var container =
      _drawingElement.findElements('wp:anchor').firstOrNull ??
      _drawingElement.findElements('wp:inline').firstOrNull;

  if (container == null) {
    // Fallback: search anywhere (old behavior, just in case)
    container = _drawingElement;
  }

  final posElement = container
      .findElements('wp:position' + orientation)
      .firstOrNull;

  if (posElement == null) return 0;

  double pos = double.parse(
    posElement.findElements('wp:posOffset').firstOrNull?.text ?? "0",
  );
  pos = pos.emuToPx();
  return pos;
}

String? setPosAlign(String orientation) {
  final posElement = _drawingElement
      ?.findAllElements('wp:position' + orientation)
      .firstOrNull;
  // print("posElement ${posElement?.getElement("wp:align")?.text}");
  return posElement?.getElement("wp:align")?.text;
}

@JsonSerializable(explicitToJson: true)
class ImageData {
  String rId = "";
  double width = -1; // بالبيكسل أو الوحدة المناسبة
  double height = -1;
  double posX = -1;
  String alignH = "left";
  String alingV = "top";
  double relativeHeight = 0;
  double vmlZIndex = 0;
  @JsonKey(defaultValue: 0)
  double rotation = 0; // زاوية الدوران بالدرجات
  @JsonKey(defaultValue: false)
  bool behindDoc = false; // false = أمام النص، true = خلف النص
  @JsonKey(defaultValue: false)
  bool flipH = false;
  @JsonKey(defaultValue: false)
  bool flipV = false;
  @JsonKey(ignore: true)
  runT? parent;
  double posY = -1;

  @JsonKey(ignore: true)
  VmlShapeData? vmlShapeData;
  //String image64 = "";
  String relativeFromH = "margin";
  String relativeFromV = "margin";
  String? wrapMode;
  @JsonKey(fromJson: uint8ListFromJson, toJson: uint8ListToJson)
  Uint8List? imageMemory;
  @JsonKey(ignore: true)
  dynamic image; // Changed from ui.Image? to dynamic to avoid import

  String? textBoxText; // النص المستخرج من Text Box
  String? textColor; // لون النص (Hex String)
  double? textSize; // حجم النص
  String? fontFamily; // نوع الخط

  /// علامة تشير إلى أن TextBox يحتوي على حقل PAGE ويجب استبداله برقم الصفحة الفعلي
  @JsonKey(defaultValue: false)
  bool containsPageField = false;

  /// رابط على الصورة (a:hlinkClick)
  String? hyperlinkUrl;

  /// هل الصورة ممتدة (BoxFit.fill) بناءً على blipFill > stretch
  @JsonKey(defaultValue: false)
  bool isStretched = false;

  @JsonKey(defaultValue: 0)
  double cropLeft = 0;
  @JsonKey(defaultValue: 0)
  double cropTop = 0;
  @JsonKey(defaultValue: 0)
  double cropRight = 0;
  @JsonKey(defaultValue: 0)
  double cropBottom = 0;

  bool get hasSourceCrop =>
      cropLeft > 0 || cropTop > 0 || cropRight > 0 || cropBottom > 0;

  @JsonKey(ignore: true)
  Map<String, RelId>? customRelIdList;

  // Group Support
  @JsonKey(defaultValue: false)
  bool isGroup = false;
  @JsonKey(defaultValue: false)
  bool isVml = false;
  @JsonKey(defaultValue: false)
  bool isInlineVmlGroup = false;
  @JsonKey(ignore: true)
  List<ImageData> groupImages = [];

  // Vector Shape Support (for wps:wsp with a:custGeom)
  @JsonKey(defaultValue: false)
  bool isVectorShape = false;
  @JsonKey(ignore: true)
  Path? vectorPath;
  @JsonKey(ignore: true)
  Color? vectorFillColor;
  @JsonKey(ignore: true)
  Color? vectorStrokeColor;
  @JsonKey(ignore: true)
  double vectorStrokeWidth = 1.0;

  ImageData();

  static bool _isLikelyImageTarget(String? target) {
    if (target == null || target.isEmpty) return false;
    final normalized = target.toLowerCase();
    if (normalized.startsWith('media/')) return true;
    return normalized.endsWith('.png') ||
        normalized.endsWith('.jpg') ||
        normalized.endsWith('.jpeg') ||
        normalized.endsWith('.gif') ||
        normalized.endsWith('.bmp') ||
        normalized.endsWith('.webp') ||
        normalized.endsWith('.tif') ||
        normalized.endsWith('.tiff') ||
        normalized.endsWith('.wmf') ||
        normalized.endsWith('.emf');
  }

  factory ImageData.fromJson(Map<String, dynamic> json) =>
      _$ImageDataFromJson(json);

  Map<String, dynamic> toJson() {
    final map = _$ImageDataToJson(this);
    map['isVml'] = isVml;
    map['isInlineVmlGroup'] = isInlineVmlGroup;
    if (vmlShapeData != null) {
      map['vmlShapeData'] = vmlShapeData!.toJson();
    }
    if (groupImages.isNotEmpty) {
      map['groupImages'] = groupImages.map((image) => image.toJson()).toList();
    }
    return map;
  }

  static ImageData fromMap(Map<String, dynamic> json, runT parent) {
    final imageData = _$ImageDataFromJson(json);
    imageData.parent = parent;
    imageData.isVml = json['isVml'] as bool? ?? imageData.isVml;
    imageData.isInlineVmlGroup =
        json['isInlineVmlGroup'] as bool? ?? imageData.isInlineVmlGroup;

    if (json['vmlShapeData'] != null) {
      try {
        imageData.vmlShapeData = VmlShapeData.fromJson(
          json['vmlShapeData'] as Map<String, dynamic>,
        );
      } catch (e) {
        debugPrint("Error deserializing vmlShapeData: $e");
      }
    }

    if (json['groupImages'] is List) {
      imageData.groupImages = (json['groupImages'] as List)
          .whereType<Map<String, dynamic>>()
          .map((childJson) => ImageData.fromMap(childJson, parent))
          .toList();
    }

    // If imageMemory is empty but we have an rId, reload from docImages
    // This handles the case when loading from cache where imageMemory wasn't saved
    if ((imageData.imageMemory == null || imageData.imageMemory!.isEmpty) &&
        imageData.rId.isNotEmpty) {
      imageData.setImageMemory(parent);
    }

    return imageData;
  }

  setImageMemory(runT run, {Map<String, RelId>? customRelIdList}) {
    if (rId.isEmpty) return;

    // Get WordDocument from the parent chain
    var wordDocument = run.parent?.parent?.parent;
    if (wordDocument == null) return;

    Map<String, Uint8List>? docImages = wordDocument.docImages;
    if (docImages == null || docImages.isEmpty) return;

    // Strategy 1: Try direct lookup from relIdList first
    String? imgName;
    String resolvedRId = rId;

    if (customRelIdList == null) {
      final recoveryMap = getMainDocumentEmbedRecoveryMap(wordDocument);
      final recoveredRId = recoveryMap[rId];
      if (recoveredRId != null && recoveredRId.isNotEmpty) {
        resolvedRId = recoveredRId;
      }
    }

    // Check custom list first (for headers/footers)
    if (customRelIdList != null) {
      if (customRelIdList.containsKey(resolvedRId)) {
        imgName = customRelIdList[resolvedRId]?.Target;
        if (!_isLikelyImageTarget(imgName)) {
          imgName = null;
        }
        // print("DEBUG_IMAGE: Found rId=$resolvedRId in customRelIdList -> $imgName");
      } else {
        print(
          "DEBUG_IMAGE: ⚠️ rId=$resolvedRId NOT FOUND in customRelIdList. Keys: ${customRelIdList.keys.join(',')}",
        );
      }
    }

    // Fallback to document list
    if (imgName == null) {
      // print("DEBUG_IMAGE: Checking global relIdList for rId=$resolvedRId");
      final globalTarget = wordDocument.relIdList[resolvedRId]?.Target;
      if (_isLikelyImageTarget(globalTarget)) {
        imgName = globalTarget;
        print(
          "DEBUG_IMAGE: Found rId=$resolvedRId in GLOBAL relIdList -> $imgName (Fallback triggered!)",
        );
      }
    }

    if (imgName != null) {
      // Handle explicit media paths
      imageMemory = docImages[imgName];
      if (imageMemory != null && imageMemory!.isNotEmpty) return;

      // Handle incomplete paths (sometimes target is just "image1.png" but key is "media/image1.png")
      if (!imgName.startsWith('media/') && !imgName.contains('/')) {
        String potentialKey = "media/$imgName";
        imageMemory = docImages[potentialKey];
        if (imageMemory != null && imageMemory!.isNotEmpty) return;
      }
    }

    // Strategy 3: Fallback - try global function (for backward compatibility)
    if (imgName == null || imgName.isEmpty) {
      final fallbackTarget = getImageFrmRel(resolvedRId);
      if (_isLikelyImageTarget(fallbackTarget)) {
        imgName = fallbackTarget;
      }
    }

    if (imgName != null &&
        imgName.isNotEmpty &&
        docImages.containsKey(imgName)) {
      imageMemory = docImages[imgName];
      return;
    }

    // If nothing found, set empty
    imageMemory = Uint8List(0);
  }
}

bool isImageRun(xml.XmlElement? xmlRun) {
  // نستخدم findAllElements للبحث في كل الأبناء بما في ذلك mc:AlternateContent
  if (xmlRun == null) return false;
  return xmlRun.findAllElements('w:drawing').isNotEmpty ||
      xmlRun.findAllElements('w:pict').isNotEmpty;
}

// مثال على ميثود لتحويل rId إلى URL (تحتاج إلى تنفيذ هذا بناءً على حالتك)
String getImageUrlFromId(String rId) {
  // هنا يجب أن تكون لديك طريقة لتحويل rId إلى URL للصورة
  return "path/to/image_$rId.png"; // هذه مجرد قيمة افتراضية
}
