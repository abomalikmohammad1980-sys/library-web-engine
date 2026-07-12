import 'package:archive/archive.dart';
import 'package:golden_shamela/Utils/XmlElementClone.dart';
import 'package:golden_shamela/Models/WordDocument.dart';
import 'package:xml/xml.dart';

import '../Utils/ArchiveToXml.dart';

const WORD_STYLES = "word/styles.xml";

Map<String, XmlElement> addStyles(ArchiveFile? archiveFile) {
  Map<String, XmlElement> documentStyles = {};

  if (archiveFile == null) return {};
  // تحويل ArchiveFile إلى XmlDocument
  XmlDocument document = ArchiveToXml(archiveFile);

  // استعراض جميع العناصر داخل المستند
  document.childElements.forEach((element) {
    // افترض أن هناك منطق لمعالجة الأنماط هنا
    if (element.name.local == 'styles') {
      // استعراض الأنماط داخل عنصر 'styles'
      element.findAllElements('w:style').forEach((style) {
        final styleId = style.getAttribute('w:styleId');

        if (styleId != null) documentStyles[styleId] = style;
        // من الممكن القيام بمزيد من المعالجة أو الإضافة حسب الحاجة
      });
    }
  });
  return documentStyles;
}

XmlElement? getRPrFRromStyle(String styleId, WordDocument? wordDocument) {
  return getDocumentStyle(styleId, wordDocument)?.getElement("w:rPr");
}

XmlElement? getPPrFRromStyle(String styleId, WordDocument? wordDocument) {
  return getDocumentStyle(styleId, wordDocument)?.getElement("w:pPr");
}

/// Get table borders from a table style definition
/// Returns the tblBorders element from tblPr in the style
XmlElement? getTableStyleBorders(String? styleId, WordDocument? wordDocument) {
  if (styleId == null || wordDocument == null) return null;

  XmlElement? style = getDocumentStyle(styleId, wordDocument);
  if (style == null) return null;

  // Table styles have tblPr which contains tblBorders
  var tblPr = style.getElement("w:tblPr");
  if (tblPr != null) {
    return tblPr.getElement("w:tblBorders");
  }

  return null;
}

/// Get hyperlink style (rPr) from styles.xml
/// Word typically defines a "Hyperlink" style with color and underline
/// Returns the rPr element from the Hyperlink style, or null if not found
XmlElement? getHyperlinkStyleRPr(WordDocument? wordDocument) {
  if (wordDocument == null) return null;

  // Try common hyperlink style names
  const hyperlinkStyleNames = [
    'Hyperlink',
    'hyperlink',
    'Internet Link',
    'FollowedHyperlink',
  ];

  for (String styleName in hyperlinkStyleNames) {
    XmlElement? style = getDocumentStyle(styleName, wordDocument);
    if (style != null) {
      return style.getElement("w:rPr");
    }
  }

  return null;
}

XmlElement? getDocumentStyle(String styleId, WordDocument? wordDocument) {
  XmlElement? xmlElement = wordDocument?.documentStyles[styleId];
  String? basedOnStyle = xmlElement
      ?.getElement("w:basedOn")
      ?.getAttribute("w:val");

  if (basedOnStyle != null) {
    // Recursively get the basedOn style
    XmlElement? basedOn = getDocumentStyle(basedOnStyle, wordDocument);

    // Merge the basedOn style with the current style
    xmlElement = mergeStyles(basedOn, xmlElement);
  }

  // if (styleId == "1") {
  //   print("Merged documentStyle: ${xmlElement?.toXmlString(pretty: true)}");
  // }

  return xmlElement;
}

XmlElement? mergeStyles(XmlElement? baseStyle, XmlElement? currentStyle) {
  if (baseStyle == null) return currentStyle?.clone();
  if (currentStyle == null) return baseStyle.clone();

  // Merge attributes
  // Merge attributes

  List<XmlAttribute> mergedAttributes = [...currentStyle.attributes];

  Map<String, XmlAttribute> currentAttrMap = {};
  mergedAttributes.forEach((attr) {
    currentAttrMap[attr.name.local] = attr;
  });
  baseStyle.attributes.forEach((attr) {
    if (currentAttrMap[attr.name.local] == null) mergedAttributes.add(attr);
  });
  // Merge pPr and rPr separately
  final basePPr = baseStyle.getElement('w:pPr');
  final currentPPr = currentStyle.getElement('w:pPr');
  final mergedPPr = mergeProperties(basePPr?.clone(), currentPPr?.clone());

  final baseRPr = baseStyle.getElement('w:rPr');
  final currentRPr = currentStyle.getElement('w:rPr');
  final mergedRPr = mergeProperties(baseRPr?.clone(), currentRPr?.clone());

  // Combine other children (non-pPr and non-rPr)
  final mergedChildren = <XmlElement>[];
  Map<String, XmlElement> baseChildren = Map.fromIterable(
    baseStyle.children.whereType<XmlElement>().where(
      (e) => e.name.local != 'pPr' && e.name.local != 'rPr',
    ),
    key: (e) => (e as XmlElement).name.local,
  );
  Map<String, XmlElement> currentChildren = Map.fromIterable(
    currentStyle.children.whereType<XmlElement>().where(
      (e) => e.name.local != 'pPr' && e.name.local != 'rPr',
    ),
    key: (e) => (e as XmlElement).name.local,
  );

  currentChildren.forEach((key, child) {
    baseChildren[key] = child.clone();
  });

  mergedChildren.addAll(baseChildren.values.map((e) => e.clone()));

  // Add merged pPr and rPr if they exist
  if (mergedPPr != null) mergedChildren.add(mergedPPr);
  if (mergedRPr != null) mergedChildren.add(mergedRPr);

  return XmlElement(
    XmlName('style'),
    mergedAttributes.toList().clone(),
    mergedChildren,
  );
}

XmlElement? mergeProperties(XmlElement? baseProps, XmlElement? currentProps) {
  if (baseProps == null) return currentProps?.clone();
  if (currentProps == null) return baseProps.clone();

  // Merge attributes
  List<XmlAttribute> mergedAttributes = [...currentProps.attributes];

  Map<String, XmlAttribute> currentAttrMap = {};
  mergedAttributes.forEach((attr) {
    currentAttrMap[attr.name.local] = attr;
  });
  baseProps.attributes.forEach((attr) {
    if (currentAttrMap[attr.name.local] == null) mergedAttributes.add(attr);
  });
  // Merge child elements (giving priority to currentProps)
  final mergedChildren = <XmlElement>[];
  Map<String, XmlElement> baseChildren = Map.fromIterable(
    baseProps.children.whereType<XmlElement>(),
    key: (e) => (e as XmlElement).name.local,
  );
  Map<String, XmlElement> currentChildren = Map.fromIterable(
    currentProps.children.whereType<XmlElement>(),
    key: (e) => (e as XmlElement).name.local,
  );

  currentChildren.forEach((key, child) {
    baseChildren[key] = child.clone();
  });

  mergedChildren.addAll(baseChildren.values.map((e) => e.clone()));

  // Return merged properties element
  return XmlElement(
    XmlName.fromString(baseProps.name.toXmlString()),
    mergedAttributes.toList(),
    mergedChildren,
  );
}
