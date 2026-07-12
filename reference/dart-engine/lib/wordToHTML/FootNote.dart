import 'package:golden_shamela/wordToHTML/Paragraph.dart';
import 'package:golden_shamela/wordToHTML/runT.dart';
import 'package:json_annotation/json_annotation.dart';

import '../Models/WordPage.dart';

part 'FootNote.g.dart';

@JsonSerializable(explicitToJson: true, constructor: 'empty')
class FootNote {
  List<Paragraph> paragraphs;
  String id;
  String? displayNumber;

  /// خريطة تقسيم الحواشي عبر الصفحات: {رقم الصفحة: فهرس أول فقرة في تلك الصفحة}
  /// تُملأ من bookmarks المحقونة بواسطة pageRender.py (TheLibraryFN_{index}_P{page})
  @JsonKey(includeFromJson: false, includeToJson: false)
  Map<int, int> pageBreaks = {};

  FootNote(this.paragraphs, this.id);

  FootNote.empty() : paragraphs = [], id = '';

  /// للتوافق العكسي — يُرجع أول فقرة
  @JsonKey(includeFromJson: false, includeToJson: false)
  Paragraph get p =>
      paragraphs.isNotEmpty ? paragraphs.first : Paragraph.empty();

  /// نص جميع فقرات الحاشية
  String get text => paragraphs.map((p) => p.text).join('\n');

  factory FootNote.fromJson(Map<String, dynamic> json) =>
      _$FootNoteFromJson(json);
  Map<String, dynamic> toJson() => _$FootNoteToJson(this);

  static FootNote fromMap(Map<String, dynamic> json, WordPage parent) {
    final footNote = FootNote.empty();
    footNote.id = json['id'] as String;
    footNote.displayNumber = json['displayNumber'] as String?;

    // التوافق العكسي: الكاش القديم يحتوي على 'p' (فقرة واحدة)
    if (json.containsKey('paragraphs')) {
      footNote.paragraphs = (json['paragraphs'] as List<dynamic>)
          .map((e) => Paragraph.fromMap(e as Map<String, dynamic>, parent))
          .toList();
    } else if (json.containsKey('p')) {
      footNote.paragraphs = [
        Paragraph.fromMap(json['p'] as Map<String, dynamic>, parent),
      ];
    }

    return footNote;
  }

  updateDisplayNumber(String dn) {
    displayNumber = dn;
    if (p.runs.isEmpty) {
      // print("Warning: Footnote with ID ${id} has no runs in its paragraph.");
      return;
    }

    bool found = false;
    // 1. Try to find explicit w:footnoteRef
    for (runT r in p.runs) {
      if (r.isFootnoteRef) {
        r.fnDisplayNum = dn;
        r.footNoteId = id;
        r.updateFnDisplayNumber();
        found = true;
        break;
      }
    }

    // 2. Fallback: find run with FootnoteReference style AND no text
    if (!found) {
      for (runT r in p.runs) {
        if (r.rpr?.rPr?.getElement("w:rStyle")?.getAttribute("w:val") ==
            "FootnoteReference") {
          // Check if it has no text (likely the placeholder)
          if (r.xmlRun?.getAttribute("w:t") == null &&
              (r.text == null || r.text!.isEmpty)) {
            r.fnDisplayNum = dn;
            r.footNoteId = id;
            r.updateFnDisplayNumber();
            found = true;
            break;
          }
        }
      }
    }

    // Capture the style ID used by the footnote reference
    String? fnrStyle;
    for (runT r in p.runs) {
      if (r.isFootnoteRef || r.footNoteId == id) {
        fnrStyle = r.rpr?.rPr?.getElement("w:rStyle")?.getAttribute("w:val");
        if (fnrStyle != null) break;
      }
    }

    // Fallback if no specific ref found but we rely on hardcode
    if (fnrStyle == null) fnrStyle = "FootnoteReference";

    mergeFnrRuns(fnrStyle);
  }

  void mergeFnrRuns(String styleVal) {
    List<runT> fnrRuns = [];
    for (runT r in p.runs) {
      if (isFnr(r, styleVal)) fnrRuns.add(r);
    }
    String newTxt = "";
    for (runT r in fnrRuns) {
      newTxt = newTxt + (r.text ?? "");
      r.text = "";
    }
    if (fnrRuns.isNotEmpty) fnrRuns[0].text = newTxt;
  }

  bool isFnr(runT r, String styleVal) {
    return r.rpr?.rPr?.getElement("w:rStyle")?.getAttribute("w:val") ==
        styleVal;
  }
}
