// lib/models/author.dart

import 'package:golden_shamela/Utils/NumberUtils.dart';

/// يمثل كائن المؤلف وجميع معلوماته الأساسية.
class Author {
  final String id;
  final String name;
  final String description;
  final String? deathYear;
  final List<String> bookTitles;

  /// منشئ (Constructor) كلاس Author.
  Author({
    String? id,
    required this.name,
    this.description = '',
    this.deathYear,
    this.bookTitles = const [],
  }) : id = id ?? generateRandomKey();

  /// دالة المصنع (Factory Constructor) لإنشاء كائن Author من خريطة JSON.
  factory Author.fromJson(Map<String, dynamic> json) {
    return Author(
      id: json['id'] as String,
      name: json['name'] as String,
      description: json['description'] as String? ?? '',
      deathYear: json['deathYear'] as String?,
      bookTitles: List<String>.from(json['bookTitles'] as List? ?? []),
    );
  }

  /// دالة لتحويل كائن Author إلى خريطة JSON لتسهيل عملية التخزين.
  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'description': description,
      'deathYear': deathYear,
      'bookTitles': bookTitles,
    };
  }

  /// دالة copyWith لإنشاء نسخة جديدة من الكائن مع إمكانية تعديل خصائص معينة.
  Author copyWith({
    String? id,
    String? name,
    String? description,
    String? deathYear,
    List<String>? bookTitles,
  }) {
    return Author(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      deathYear: deathYear ?? this.deathYear,
      bookTitles: bookTitles ?? this.bookTitles,
    );
  }
}