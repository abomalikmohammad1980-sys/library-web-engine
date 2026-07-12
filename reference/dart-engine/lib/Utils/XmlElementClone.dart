import 'package:xml/xml.dart';

const DUPLICATED = "Duplicated";

extension XmlElemenClone on XmlElement {
  clone({bool? setDublicated}) {
    XmlElement xmlElement =  _cloneElement(this);
    if(setDublicated==true)
    xmlElement.setAttribute(DUPLICATED, DUPLICATED);
    return xmlElement;
  }
}
extension XmlAttributeClone on List<XmlAttribute> {
  clone() {
    return _cloneAttributes(this);

  }
}

// Helper function to clone an XmlElement
XmlElement _cloneElement(XmlElement element) {
  return XmlElement(
    XmlName.fromString(element.name.toString()),
    _cloneAttributes(element.attributes), // Clone attributes safely
    element.children
        .map((child) => _cloneNode(child))
        .toList(), // Recursively clone children
  );
}

// Helper function to clone nodes
XmlNode _cloneNode(XmlNode node) {
  if (node is XmlElement) {
    // Recursively clone XmlElement
    return _cloneElement(node);
  } else if (node is XmlText) {
    // Clone XmlText
    return XmlText(node.text);
  } else if (node is XmlComment) {
    // Clone XmlComment
    return XmlComment(node.text);
  } else {
    // Handle other XmlNode types if needed
    return node;
  }
}

// Helper function to clone attributes
List<XmlAttribute> _cloneAttributes(List<XmlAttribute> attributes) {
  return attributes
      .map((attr) =>
          XmlAttribute(XmlName.fromString(attr.name.toString()), attr.value))
      .toList();
}
