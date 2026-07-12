class PageComment {
  final String bookPath;
  final String bookName;
  final int pageIndex;
  final String content;
  final int updatedAt;
  final String? sourceBookId;
  final String? sourcePart;
  final int? sourceAnchor;

  const PageComment({
    required this.bookPath,
    required this.bookName,
    required this.pageIndex,
    required this.content,
    required this.updatedAt,
    this.sourceBookId,
    this.sourcePart,
    this.sourceAnchor,
  });

  factory PageComment.fromRow(Map<String, Object?> row) {
    return PageComment(
      bookPath: row['book_path']?.toString() ?? '',
      bookName: row['book_name']?.toString() ?? '',
      pageIndex: (row['page_index'] as num?)?.toInt() ?? 0,
      content: row['content']?.toString() ?? '',
      updatedAt: (row['updated_at'] as num?)?.toInt() ?? 0,
      sourceBookId: row['source_book_id']?.toString(),
      sourcePart: row['source_part']?.toString(),
      sourceAnchor: (row['source_anchor'] as num?)?.toInt(),
    );
  }
}
