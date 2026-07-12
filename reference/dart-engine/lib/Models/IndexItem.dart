import 'package:golden_shamela/Utils/NumberUtils.dart';
import 'package:json_annotation/json_annotation.dart';

part 'IndexItem.g.dart';

@JsonSerializable(explicitToJson: true)
class IndexItem {
  String title;
  int page;
  String type;
  String id;

  IndexItem({
    required this.title,
    required this.page,
    required this.type,
    this.id = "", // Initialize id with an empty string or a default value
  });

  IndexItem.empty() : title = '', page = 0, type = '', id = '';

  factory IndexItem.fromJson(Map<String, dynamic> json) => _$IndexItemFromJson(json);
  Map<String, dynamic> toJson() => _$IndexItemToJson(this);

  static IndexItem fromMap(Map<String, dynamic> json) {
    return _$IndexItemFromJson(json);
  }
}
