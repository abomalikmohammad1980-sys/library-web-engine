// lib/models/section.dart

import 'package:golden_shamela/Utils/NumberUtils.dart';

class Section {
  final String id;
  final String title;

  Section({
    String? id,
    required this.title,
  }) : id = id ?? generateRandomKey();

  factory Section.fromJson(Map<String, dynamic> json) {
    return Section(
      id: json['id'] as String,
      title: json['title'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
    };
  }
}