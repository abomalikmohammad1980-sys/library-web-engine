import 'package:golden_shamela/Utils/NumberUtils.dart';
import 'package:golden_shamela/Models/BookMetadataOptions.dart';

class BookCard {
  String title;
  String sectionId;
  String authorId;
  String description;
  String id;
  String bookType;
  bool matchesPrinted;
  String publisher;
  String edition;
  String pageCount;

  BookCard({
    String? id,
    this.title = '',
    this.sectionId = '',
    this.authorId = '',
    this.description = '',
    this.bookType = BookMetadataOptions.book,
    this.matchesPrinted = false,
    this.publisher = '',
    this.edition = '',
    this.pageCount = '',
  }) : id = id ?? generateRandomKey();

  factory BookCard.fromJson(Map<String, dynamic> json) {
    return BookCard(
      title: json['title'] ?? '',
      sectionId: json['sectionId'] ?? '',
      authorId: json['authorId'] ?? '',
      description: json['description'] ?? '',
      id: json['id'] ?? generateRandomKey(),
      bookType: BookMetadataOptions.normalizeType(json['bookType'] as String?),
      matchesPrinted: _boolFromJson(json['matchesPrinted']),
      publisher: json['publisher'] ?? '',
      edition: json['edition'] ?? '',
      pageCount: json['pageCount']?.toString() ?? '',
    );
  }

  factory BookCard.fromDatabaseRow(Map<String, Object?> row) {
    return BookCard(
      id: row['id'] as String,
      title: row['book_name'] as String,
      authorId: row['author_id'] as String? ?? '',
      sectionId: row['section_id'] as String? ?? '',
      description: row['description'] as String? ?? '',
      bookType: BookMetadataOptions.normalizeType(row['book_type'] as String?),
      matchesPrinted: _boolFromDb(row['matches_printed']),
      publisher: row['publisher'] as String? ?? '',
      edition: row['edition'] as String? ?? '',
      pageCount: row['page_count']?.toString() ?? '',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'title': title,
      'sectionId': sectionId,
      'authorId': authorId,
      'description': description,
      'id': id,
      'bookType': bookType,
      'matchesPrinted': matchesPrinted,
      'publisher': publisher,
      'edition': edition,
      'pageCount': pageCount,
    };
  }

  BookCard copyWith({
    String? title,
    String? authorId,
    String? sectionId,
    String? description,
    String? id,
    String? bookType,
    bool? matchesPrinted,
    String? publisher,
    String? edition,
    String? pageCount,
  }) {
    return BookCard(
      id: id ?? this.id,
      title: title ?? this.title,
      authorId: authorId ?? this.authorId,
      sectionId: sectionId ?? this.sectionId,
      description: description ?? this.description,
      bookType: bookType ?? this.bookType,
      matchesPrinted: matchesPrinted ?? this.matchesPrinted,
      publisher: publisher ?? this.publisher,
      edition: edition ?? this.edition,
      pageCount: pageCount ?? this.pageCount,
    );
  }

  static bool _boolFromJson(dynamic value) {
    if (value == null) return false;
    if (value is bool) return value;
    if (value is num) return value != 0;
    if (value is String) return value == 'true' || value == '1';
    return false;
  }

  static bool _boolFromDb(Object? value) {
    if (value == null) return false;
    if (value is int) return value != 0;
    if (value is bool) return value;
    return false;
  }
}
