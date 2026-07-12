class IndexingProgress {
  final String message;
  final int totalBooks;
  final int currentBookNum;
  final int totalPagesInBook;
  final int currentPageNum;

  IndexingProgress({
    this.message = '',
    this.totalBooks = 0,
    this.currentBookNum = 0,
    this.totalPagesInBook = 0,
    this.currentPageNum = 0,
  });

  /// Returns the overall progress as a value between 0.0 and 1.0
  double get overallProgress {
    if (totalBooks == 0) return 0.0;
    // This is a simplified overall progress. A more accurate one would
    // consider the progress within the current book.
    return (currentBookNum -1) / totalBooks;
  }

  /// Returns the progress for the current book as a value between 0.0 and 1.0
  double get currentBookProgress {
    if (totalPagesInBook == 0) return 0.0;
    return currentPageNum / totalPagesInBook;
  }
}
