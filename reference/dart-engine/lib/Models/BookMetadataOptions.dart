class BookMetadataOptions {
  static const String book = 'book';
  static const String magazine = 'magazine';
  static const String manuscript = 'manuscript';
  static const String thesis = 'thesis';
  static const String electronic = 'electronic';
  static const String transcription = 'transcription';
  static const String _legacyDefinition = 'definition';

  static const List<String> printedTypes = [book, magazine];
  static const List<String> unprintedTypes = [
    manuscript,
    thesis,
    electronic,
    transcription,
  ];

  static const List<String> bookTypes = [
    book,
    magazine,
    manuscript,
    thesis,
    electronic,
    transcription,
  ];

  static String typeLabel(String type) {
    switch (type) {
      case book:
        return 'كتاب';
      case magazine:
        return 'مجلة';
      case manuscript:
        return 'مخطوط';
      case thesis:
        return 'رسالة جامعية';
      case electronic:
        return 'إلكترونية';
      case transcription:
        return 'تفريغات';
      default:
        return 'غير محدد';
    }
  }

  static String normalizeType(String? type) {
    if (type == _legacyDefinition) return transcription;
    if (type == null || type.isEmpty) return book;
    return type;
  }
}
