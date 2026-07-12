import 'package:flutter/widgets.dart';

List<InlineSpan> fixRtlWidgetSpan(List<InlineSpan> list) {
  if (!_needToFix(list)) return list;

  final map = _toWidgetSpanMap(list);
  final reversedMap = _reverseValues(map);
  reversedMap.forEach((i, widget) {
    list[i] = widget;
  });
  return list;
}

bool _needToFix(List<InlineSpan> list) {
  final count = list.where((item) => item is WidgetSpan).length;
  return count > 1;
}

Map<int, InlineSpan> _toWidgetSpanMap(List<InlineSpan> list) {
  final map = <int, InlineSpan>{};
  for (int i = 0; i < list.length; i++) {
    if (list[i] is WidgetSpan) map[i] = list[i];
  }
  return map;
}

Map<K, V> _reverseValues<K, V>(Map<K, V> map) {
  final reversedValues = map.values.toList().reversed.toList();
  return Map.fromIterables(map.keys, reversedValues);
}
