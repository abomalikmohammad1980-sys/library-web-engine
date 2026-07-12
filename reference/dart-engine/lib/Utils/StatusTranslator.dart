class StatusTranslator {
  static final Map<String, String> _translations = {
    'Injecting bookmarks': 'جاري إدراج إشارات مرجعية',
    'Opening document': 'جاري فتح المستند',
    'Repaginating': 'جاري إعادة تخطيط الصفحات',
    'Saving': 'جاري الحفظ',
    'Closing Word': 'إغلاق برنامج Word',
    'Processing pages': 'جاري معالجة الصفحات',
    'Finished': 'اكتملت المعالجة',
    'Word ERROR': 'خطأ في برنامج Word',
    'Word not found': 'برنامج Word غير مثبت',
    'Active document not found': 'لم يتم العثور على المستند النشط',
    'Failed to open': 'فشل فتح المستند',
    'Opening Word for Repaginate': 'جاري فتح Word لتحديث التخطيط',
    'Document saved with updated page breaks':
        'تم حفظ المستند مع فواصل صفحات محدثة',
    'Bookmarks injection complete.': 'اكتمل إدراج الإشارات المرجعية',
    'Bookmarks injection failed': 'فشل إدراج الإشارات المرجعية',
    'No multi-page footnotes found.': 'لا توجد حواشٍ ممتدة عبر الصفحات.',
    'Footnote mapping complete (VBA).': 'اكتمل ربط الحواشي بالصفحات.',
    'Footnote mapping skipped': 'تم تخطي ربط الحواشي',
    'Running unified VBA macro...': 'جاري تشغيل المعالجة الموحدة (VBA)...',
    'Extracting modified XML from Word memory...': 'جاري استخراج XML من ذاكرة Word...',
    'Successfully updated document.xml and document.xml.rels from Word memory without saving.':
        'تم تحديث بيانات المستند بنجاح.',
    'Successfully updated document.xml from memory without saving.': 'تم تحديث بيانات المستند بنجاح.',
    'Processing XML with page break detection...': 'جاري معالجة XML وكشف فواصل الصفحات...',
    'Macro execution skipped (template missing).': 'تم تخطي الماكرو (القالب غير موجود).',
    'Macro execution skipped.': 'تم تخطي الماكرو.',
    'Macro complete (no result property).': 'اكتملت المعالجة.',
    'Access is denied.': 'تم رفض الوصول (قد يكون بسبب برنامج الحماية Antivirus).',
  };

  static String translate(String message) {
    String trimmed = message.trim();

    // First, strip any common prefixes if they slipped through
    if (trimmed.startsWith('STATUS:')) {
      trimmed = trimmed.replaceFirst('STATUS:', '').trim();
    } else if (trimmed.startsWith('ERROR:')) {
      trimmed = trimmed.replaceFirst('ERROR:', '').trim();
    }

    // --- High Priority: Complex Patterns ---

    // Pattern: Injecting bookmarks for 39 pages...
    if (trimmed.toLowerCase().contains('injecting bookmarks')) {
      final match = RegExp(r'(\d+)').firstMatch(trimmed);
      if (match != null) {
        return 'جارٍ إدراج إشارات مرجعية لـ ${match.group(1)} صفحة...';
      }
      return 'جارٍ إدراج إشارات مرجعية...';
    }

    // Pattern: Mapping N footnotes to pages...
    if (trimmed.toLowerCase().contains('mapping') &&
        trimmed.toLowerCase().contains('footnotes')) {
      final match = RegExp(r'(\d+)').firstMatch(trimmed);
      if (match != null) {
        return 'جارٍ ربط ${match.group(1)} حاشية بالصفحات...';
      }
      return 'جارٍ ربط الحواشي بالصفحات...';
    }

    // Pattern: Found N multi-page footnote splits.
    if (trimmed.toLowerCase().contains('multi-page footnote')) {
      final match = RegExp(r'(\d+)').firstMatch(trimmed);
      if (match != null) {
        return 'تم العثور على ${match.group(1)} تقسيم حاشية عبر صفحات.';
      }
    }

    // Pattern: Processed 10/100 pages...
    if (trimmed.contains('Processed') &&
        (trimmed.contains('pages...') || trimmed.contains('pages…'))) {
      return trimmed
          .replaceAll('Processed', 'تمت معالجة')
          .replaceAll('pages...', 'صفحة...')
          .replaceAll('pages…', 'صفحة…');
    }

    // Pattern: Total Pages: 39 / Total Pages (Fallback): 39
    if (trimmed.toLowerCase().contains('total pages')) {
      final match = RegExp(r'(\d+)').firstMatch(trimmed);
      if (match != null) {
        return 'إجمالي الصفحات: ${match.group(1)}';
      }
      return 'إجمالي الصفحات';
    }

    // Pattern: Injected N markers. Last Page: M
    if (trimmed.contains('Injected') && trimmed.contains('markers')) {
      final markersMatch = RegExp(r'Injected\s*(\d+)').firstMatch(trimmed);
      final pageMatch = RegExp(r'Last Page:\s*(\d+)').firstMatch(trimmed);
      String markers = markersMatch?.group(1) ?? '0';
      String lastPage = pageMatch?.group(1) ?? '0';
      return 'تم حقن $markers علامة. آخر صفحة: $lastPage';
    }

    // Pattern: Created output directory: ...
    if (trimmed.startsWith('Created output directory')) {
      return 'تم إنشاء مجلد الإخراج';
    }

    // Pattern: Macro complete: Pages: 57, Multi-page FN: 10
    if (trimmed.startsWith('Macro complete:')) {
      final pagesMatch = RegExp(r'Pages:\s*(\d+)').firstMatch(trimmed);
      final fnMatch = RegExp(r'Multi-page FN:\s*(\d+)').firstMatch(trimmed);
      
      String pages = pagesMatch?.group(1) ?? '0';
      String fns = fnMatch?.group(1) ?? '0';
      
      return 'اكتملت المعالجة: $pages صفحة، وتم تقسيم $fns حاشية ممتدة.';
    }

    // --- Exact Matches ---
    if (_translations.containsKey(trimmed)) {
      return _translations[trimmed]!;
    }

    // --- Low Priority: Simple Partial Matches (Starting with) ---
    for (var key in _translations.keys) {
      if (trimmed.startsWith(key)) {
        // Replace the key part but keep the rest (like numbers)
        return trimmed.replaceFirst(key, _translations[key]!);
      }
    }

    return trimmed;
  }
}
