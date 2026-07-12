class PageCommentsImportResult {
  final int added;
  final int merged;
  final int unchanged;
  final int skippedMissingBook;
  final int skippedInvalid;

  const PageCommentsImportResult({
    required this.added,
    required this.merged,
    required this.unchanged,
    required this.skippedMissingBook,
    required this.skippedInvalid,
  });
}
