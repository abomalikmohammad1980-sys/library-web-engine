enum AuthorDeathDateKind {
  exact,
  approximate,
  before,
  after,
  century,
  beforeHijri,
  contemporary,
  unknown,
}

class AuthorDeathDate {
  final AuthorDeathDateKind kind;
  final int? year;
  final int? century;
  final String rawValue;

  const AuthorDeathDate({
    required this.kind,
    required this.rawValue,
    this.year,
    this.century,
  });

  bool get isKnown => sortPosition != null;

  double? get sortPosition {
    switch (kind) {
      case AuthorDeathDateKind.exact:
      case AuthorDeathDateKind.approximate:
        return year?.toDouble();
      case AuthorDeathDateKind.before:
        return year == null ? null : year! - 0.5;
      case AuthorDeathDateKind.after:
        return year == null ? null : year! + 0.5;
      case AuthorDeathDateKind.century:
        return century == null ? null : (centuryStart + centuryEnd) / 2;
      case AuthorDeathDateKind.beforeHijri:
        return 0;
      case AuthorDeathDateKind.contemporary:
      case AuthorDeathDateKind.unknown:
        return null;
    }
  }

  int get centuryStart => century == null ? 0 : ((century! - 1) * 100) + 1;

  int get centuryEnd => century == null ? 0 : century! * 100;

  double get sortValue {
    if (kind == AuthorDeathDateKind.contemporary) return 999998;
    return sortPosition ?? 999999;
  }

  bool matchesRange(num startYear, num endYear) {
    final start = intervalStart;
    final end = intervalEnd;
    if (start == null || end == null) return false;
    return start <= endYear && end >= startYear;
  }

  double? get intervalStart {
    switch (kind) {
      case AuthorDeathDateKind.century:
        return centuryStart.toDouble();
      default:
        return sortPosition;
    }
  }

  double? get intervalEnd {
    switch (kind) {
      case AuthorDeathDateKind.century:
        return centuryEnd.toDouble();
      default:
        return sortPosition;
    }
  }
}

abstract final class AuthorDeathDateParser {
  static const contemporaryValue = 'معاصر';

  static AuthorDeathDate parse(String? value) {
    final raw = value?.trim() ?? '';
    if (raw.isEmpty) {
      return const AuthorDeathDate(
        kind: AuthorDeathDateKind.unknown,
        rawValue: '',
      );
    }

    final normalized = _normalizeDigits(raw);
    if (_isContemporary(normalized)) {
      return AuthorDeathDate(
        kind: AuthorDeathDateKind.contemporary,
        rawValue: raw,
      );
    }

    if (_isUnknown(normalized)) {
      return AuthorDeathDate(
        kind: AuthorDeathDateKind.unknown,
        rawValue: raw,
      );
    }

    if (_isBeforeHijri(normalized)) {
      return AuthorDeathDate(
        kind: AuthorDeathDateKind.beforeHijri,
        rawValue: raw,
      );
    }

    final century = _centuryValue(normalized);
    if (century != null) {
      return AuthorDeathDate(
        kind: AuthorDeathDateKind.century,
        rawValue: raw,
        century: century,
      );
    }

    final year = _firstYear(normalized);
    if (year == null) {
      return AuthorDeathDate(
        kind: AuthorDeathDateKind.unknown,
        rawValue: raw,
      );
    }

    if (normalized.contains('قبل')) {
      return AuthorDeathDate(
        kind: AuthorDeathDateKind.before,
        rawValue: raw,
        year: year,
      );
    }
    if (normalized.contains('بعد')) {
      return AuthorDeathDate(
        kind: AuthorDeathDateKind.after,
        rawValue: raw,
        year: year,
      );
    }
    if (_hasApproximationToken(normalized)) {
      return AuthorDeathDate(
        kind: AuthorDeathDateKind.approximate,
        rawValue: raw,
        year: year,
      );
    }
    return AuthorDeathDate(
      kind: AuthorDeathDateKind.exact,
      rawValue: raw,
      year: year,
    );
  }

  static int compare(String? left, String? right) {
    final leftDate = parse(left);
    final rightDate = parse(right);
    final sort = leftDate.sortValue.compareTo(rightDate.sortValue);
    if (sort != 0) return sort;
    return leftDate.rawValue.compareTo(rightDate.rawValue);
  }

  static bool _isContemporary(String value) {
    const tokens = [
      contemporaryValue,
      'حي',
      'على قيد',
      'لم يمت',
    ];
    return tokens.any(value.contains);
  }

  static bool _isUnknown(String value) {
    const tokens = [
      'غير معروف',
      'مجهول',
    ];
    return tokens.any(value.contains);
  }

  static bool _isBeforeHijri(String value) {
    return value.contains('قبل') &&
        (value.contains('الهجر') || value.contains('الهجرة')) &&
        value.contains('قرن');
  }

  static int? _centuryValue(String value) {
    if (value.contains('قرن') || value.contains('قاف')) {
      return _firstYear(value) ?? _arabicOrdinalCentury(value);
    }
    final shorthand = RegExp(r'(^|\s)ق\s*(\d+)').firstMatch(value);
    return int.tryParse(shorthand?.group(2) ?? '');
  }

  static int? _arabicOrdinalCentury(String value) {
    const values = {
      'الأول': 1,
      'الاول': 1,
      'الثاني': 2,
      'الثالث': 3,
      'الرابع': 4,
      'الخامس': 5,
      'السادس': 6,
      'السابع': 7,
      'الثامن': 8,
      'التاسع': 9,
      'العاشر': 10,
      'الحادي عشر': 11,
      'الثاني عشر': 12,
      'الثالث عشر': 13,
      'الرابع عشر': 14,
      'الخامس عشر': 15,
    };
    for (final entry in values.entries) {
      if (value.contains(entry.key)) return entry.value;
    }
    return null;
  }

  static bool _hasApproximationToken(String value) {
    const tokens = ['نحو', 'حوالي', 'تقريبا', 'تقريباً', 'قريبا', 'قريباً'];
    return tokens.any(value.contains);
  }

  static int? _firstYear(String value) {
    final match = RegExp(r'\d+').firstMatch(value);
    return int.tryParse(match?.group(0) ?? '');
  }

  static String _normalizeDigits(String value) {
    const arabic = '٠١٢٣٤٥٦٧٨٩';
    const persian = '۰۱۲۳۴۵۶۷۸۹';
    var result = value;
    for (var i = 0; i < 10; i++) {
      result = result
          .replaceAll(arabic[i], i.toString())
          .replaceAll(persian[i], i.toString());
    }
    return result;
  }
}
