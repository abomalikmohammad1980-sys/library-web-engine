import 'dart:convert';
import 'dart:typed_data';
import 'package:json_annotation/json_annotation.dart';
import 'package:flutter/material.dart';
import 'package:xml/xml.dart';

/// Top-level function to convert a Base64 encoded string to a [Uint8List].
Uint8List? uint8ListFromJson(String? json) {
  if (json == null) {
    return null;
  }
  if (json.isEmpty) {
    return Uint8List(0); // Return an empty Uint8List for empty strings
  }
  return base64Decode(json);
}

/// Top-level function to convert a [Uint8List] to a Base64 encoded string.
String? uint8ListToJson(Uint8List? object) {
  if (object == null) {
    return null;
  }
  return base64Encode(object);
}

/// A [JsonConverter] that converts a [TextAlign] enum to and from its string representation.
class TextAlignConverter implements JsonConverter<TextAlign?, String?> {
  const TextAlignConverter();

  @override
  TextAlign? fromJson(String? json) {
    if (json == null) {
      return null;
    }
    return TextAlign.values.firstWhere((e) => e.name == json);
  }

  @override
  String? toJson(TextAlign? object) {
    return object?.name;
  }
}

/// A [JsonConverter] that converts a [TextDirection] enum to and from its string representation.
class TextDirectionConverter implements JsonConverter<TextDirection?, String?> {
  const TextDirectionConverter();

  @override
  TextDirection? fromJson(String? json) {
    if (json == null) {
      return null;
    }
    return TextDirection.values.firstWhere((e) => e.name == json);
  }

  @override
    String? toJson(TextDirection? object) {
    return object?.name;
  }
}

/// A [JsonConverter] that converts an [XmlElement] to and from its XML string representation.
class XmlElementConverter implements JsonConverter<XmlElement?, String?> {
  const XmlElementConverter();

  @override
  XmlElement? fromJson(String? json) {
    if (json == null) {
      return null;
    }
    try {
      return XmlDocument.parse(json).rootElement;
    } catch (e) {
      // Handle parsing errors, e.g., log them or return null
      print('Error parsing XML string: $e');
      return null;
    }
  }

  @override
  String? toJson(XmlElement? object) {
    return object?.toXmlString();
  }
}
