import 'package:golden_shamela/Utils/RomanConverter.dart';

import '../wordToHTML/abstractNum.dart';

String getDisblayNumber(Level level,
    {required int? numId, required int paragraphNumber}) {
  String character = _getDisplayCharacter(level,paragraphNumber);
  return _replceCharacter(level, character);
}

String _getDisplayCharacter(Level level, int paragraphNumber) {
  // إذا كان هناك خط مخصص للترقيم، نستخدم lvlText مباشرة
  if (level.fontFamily != null && level.fontFamily!.isNotEmpty && level.numFmt == "bullet") {
    return level.lvlText;
  }
  
  if (level.numFmt == "bullet") {
    if (level.lvlText.isEmpty) {
      return bullets.values.first;
    }
    
    int codePoint = level.lvlText.codeUnitAt(0);
    String? mappedSymbol = bullets[codePoint.toString()];
    
    if (mappedSymbol == null) {
      return bullets.values.first;
    }
    
    return mappedSymbol;
  } else if (level.numFmt == "decimal")
    return paragraphNumber.toString();
  else if (level.numFmt == "lowerLetter")
    return lowerLetters.substring(paragraphNumber - 1, paragraphNumber);
  else if (level.numFmt == "upperLetter")
    return lowerLetters
        .substring(paragraphNumber! - 1, paragraphNumber!)
        .toUpperCase();
  else if (level.numFmt == "arabicAlpha")
    return arabicAlphas.substring(paragraphNumber! - 1, paragraphNumber!);
  else if (level.numFmt == "lowerRoman")
    return paragraphNumber!.toRoman();
  else
    return level.lvlText;
}

String _replceCharacter(Level level, String character) {
  if(level.numFmt=="bullet")
    return character;
  return level.lvlText.replaceAll(RegExp(r'\d'), character).replaceAll('%', "");
}

String lowerLetters = "abcdefghijklmnopqrstuvwxyz";
String arabicAlphas = "أبتثجحخدذرزسشصضطظعغفقكلمنهوي";
Map<String, String> bullets = {
  "61558": "\u2756",
  "61623": "\u25CF",
  "111": "\u25CB",
  "61607": "\u25A0",
  "61693": "\u2612"
};
