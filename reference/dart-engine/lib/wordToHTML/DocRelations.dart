import 'package:archive/archive.dart';
import 'package:golden_shamela/Models/WordDocument.dart';
import 'package:json_annotation/json_annotation.dart';
import 'package:xml/xml.dart';

import '../Utils/ArchiveToXml.dart';
import '../Utils/WordUtils.dart';
import '../main.dart';

part 'DocRelations.g.dart';

// const WORD_DOCUMENT_RELS = "word/_rels/document.xml.rels";
// Map<String, RelId> relIdList = {};
//
// void addDocRelations(Map<String, ArchiveFile> archiveMap) {
//   ArchiveFile? archiveFile = archiveMap[WORD_DOCUMENT_RELS];
//   if (archiveFile == null) return;
//   XmlDocument document = ArchiveToXml(archiveFile);
//   relIdList = {};
//   print(document.getElement("w:Relationships")?.childElements.first.name);
//   document.getElement("Relationships")?.childElements.forEach((element) {
//     RelId relId = RelId(element.getAttribute("Id")!,
//         element.getAttribute("Type")!, element.getAttribute("Target")!);
//     relIdList[relId.Id] = relId;
//   });
// }
const WORD_DOCUMENT_RELS = "word/_rels/document.xml.rels";
Map<String,RelId> _relIdList={};

Map<String,RelId> addDocRelations(Map<String, ArchiveFile> archiveMap) {
   _relIdList = {};

  // We strictly look for document.xml.rels to avoid ID conflicts 
  // (e.g. rId1 in document.xml vs rId1 in header1.xml)
  if (archiveMap.containsKey(WORD_DOCUMENT_RELS)) {
     _relIdList = parseRelationships(archiveMap[WORD_DOCUMENT_RELS]!);
  }
  
  return _relIdList;
}

Map<String, RelId> parseRelationships(ArchiveFile file) {
  Map<String, RelId> relations = {};
  try {
    XmlDocument document = ArchiveToXml(file);
    document.getElement("Relationships")?.childElements.forEach((element) {
      String? id = element.getAttribute("Id");
      String? type = element.getAttribute("Type");
      String? target = element.getAttribute("Target");

      if (id != null && type != null && target != null) {
        RelId relId = RelId(id, type, target);
        relations[relId.Id] = relId;
      }
    });
  } catch (e) {
    print("Error parsing relationships for ${file.name}: $e");
  }
  return relations;
}

String getImageFrmRel(String rId) {
  return _relIdList[rId]?.Target ?? "";
}

@JsonSerializable(explicitToJson: true)
class RelId {
  String Id, Type, Target;

  RelId(this.Id, this.Type, this.Target);

  RelId.empty() : Id = '', Type = '', Target = '';

  factory RelId.fromJson(Map<String, dynamic> json) => _$RelIdFromJson(json);
  Map<String, dynamic> toJson() => _$RelIdToJson(this);

  static RelId fromMap(Map<String, dynamic> json) {
    return _$RelIdFromJson(json);
  }
}
