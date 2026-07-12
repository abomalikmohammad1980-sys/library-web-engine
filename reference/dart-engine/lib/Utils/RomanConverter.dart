
final Map<int, String> romanNumerals = {
  1000: 'm',
  900: 'cm',
  500: 'd',
  400: 'cd',
  100: 'c',
  90: 'xc',
  50: 'l',
  40: 'xl',
  10: 'x',
  9: 'ix',
  5: 'v',
  4: 'iv',
  1: 'i',
};

String _toRoman(int number) {
  if (number < 1 || number > 3999) {
    throw ArgumentError('Number out of range (1-3999)');
  }


  String result = '';
  romanNumerals.forEach((value, numeral) {
    while (number >= value) {
      result += numeral;
      number -= value;
    }
  });

  return result;
}
extension intToRoman on int {
  String toRoman(){
    return _toRoman(this);
  }
}
