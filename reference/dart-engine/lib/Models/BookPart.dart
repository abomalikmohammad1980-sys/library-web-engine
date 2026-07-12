class BookPart {
  final String bookPath;
  final int partNumber;
  final String partTitle;
  final String partPath;
  final int pageOffset;
  final int pageCount;

  const BookPart({
    required this.bookPath,
    required this.partNumber,
    required this.partTitle,
    required this.partPath,
    required this.pageOffset,
    required this.pageCount,
  });

  factory BookPart.fromRow(Map<String, Object?> row) {
    return BookPart(
      bookPath: row['book_path']?.toString() ?? '',
      partNumber: (row['part_number'] as num?)?.toInt() ?? 1,
      partTitle: row['part_title']?.toString() ?? '',
      partPath: row['part_path']?.toString() ?? '',
      pageOffset: (row['page_offset'] as num?)?.toInt() ?? 0,
      pageCount: (row['page_count'] as num?)?.toInt() ?? 0,
    );
  }

  Map<String, Object?> toRow() => {
        'book_path': bookPath,
        'part_number': partNumber,
        'part_title': partTitle,
        'part_path': partPath,
        'page_offset': pageOffset,
        'page_count': pageCount,
      };
}
