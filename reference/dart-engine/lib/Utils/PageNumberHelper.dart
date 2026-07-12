class PageNumberHelper {
  static String formatPageNumber(int value, String? format) {
    if (value < 1) return value.toString(); // Fallback for invalid numbers

    switch (format) {
      case "upperRoman":
        return _toRoman(value).toUpperCase();
      case "lowerRoman":
        return _toRoman(value).toLowerCase();
      case "upperLetter":
        return _toLetter(value).toUpperCase();
      case "lowerLetter":
        return _toLetter(value).toLowerCase();
      case "arabicAbjad":
        return _toArabicAbjad(value);
      case "arabicAlpha": // أ ب ت
         return _toArabicAlpha(value);
      case "decimal":
      default:
        return value.toString();
    }
  }

  static String _toRoman(int number) {
    if (number < 1 || number > 3999) return number.toString();
    
    const romanTable = [
      MapEntry(1000, "M"),
      MapEntry(900, "CM"),
      MapEntry(500, "D"),
      MapEntry(400, "CD"),
      MapEntry(100, "C"),
      MapEntry(90, "XC"),
      MapEntry(50, "L"),
      MapEntry(40, "XL"),
      MapEntry(10, "X"),
      MapEntry(9, "IX"),
      MapEntry(5, "V"),
      MapEntry(4, "IV"),
      MapEntry(1, "I")
    ];

    var result = StringBuffer();
    var n = number;
    
    for (var entry in romanTable) {
      while (n >= entry.key) {
        result.write(entry.value);
        n -= entry.key;
      }
    }
    return result.toString();
  }

  static String _toLetter(int number) {
    if (number < 1) return number.toString();
    
    // Excel-style column naming: 1=A, 26=Z, 27=AA
    String result = "";
    int n = number;
    
    while (n > 0) {
      n--; // 0-indexed
      result = String.fromCharCode(65 + (n % 26)) + result;
      n ~/= 26;
    }
    return result;
  }
  
  static String _toArabicAbjad(int number) {
    // أبجد هوز حطي كلمن سعفص قرشت ثخذ ضظغ
    // This is a simplified mapping for common page numbers. 
    // Full Abjad calculation is complex (additive), but for page numbers usually it's sequential characters.
    // However, traditional Abjad is additive (1=أ, 2=ب, 10=ي, 11=يا).
    // Let's implement the additive Abjad system.
    
    if (number < 1) return number.toString();
    
    final abjadMap = [
      MapEntry(1000, "غ"), MapEntry(900, "ظ"), MapEntry(800, "ض"),
      MapEntry(700, "ذ"), MapEntry(600, "خ"), MapEntry(500, "ث"),
      MapEntry(400, "ت"), MapEntry(300, "ش"), MapEntry(200, "ر"),
      MapEntry(100, "ق"), MapEntry(90, "ص"), MapEntry(80, "ف"),
      MapEntry(70, "ع"), MapEntry(60, "س"), MapEntry(50, "ن"),
      MapEntry(40, "م"), MapEntry(30, "ل"), MapEntry(20, "ك"),
      MapEntry(10, "ي"), MapEntry(9, "ط"), MapEntry(8, "ح"),
      MapEntry(7, "ز"), MapEntry(6, "و"), MapEntry(5, "ه"),
      MapEntry(4, "د"), MapEntry(3, "ج"), MapEntry(2, "ب"),
      MapEntry(1, "أ")
    ];
    
    var result = StringBuffer();
    var n = number;
    
    for (var entry in abjadMap) {
      while (n >= entry.key) {
        result.write(entry.value);
        n -= entry.key;
      }
    }
    return result.toString();
  }

  static String _toArabicAlpha(int number) {
     // أ ب ت ث ج ح خ د ذ ر ز س ش ص ض ط ظ ع غ ف ق ك ل م ن ه و ي
     const chars = "أبتثجحخدذرزسشصضطظعغفقكلمنهوي";
     if (number < 1) return number.toString();
     
     // Similar to Excel column logic but with Arabic chars
     String result = "";
     int n = number;
     
     while (n > 0) {
       n--;
       result = chars[n % chars.length] + result;
       n ~/= chars.length;
     }
     return result;
  }
}
