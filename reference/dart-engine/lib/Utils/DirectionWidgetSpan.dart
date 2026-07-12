import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart';

import '../UI/WordPageScreen.dart';
import '../main.dart';

//
// class TestApp extends StatelessWidget {
//   @override
//   Widget build(BuildContext context) {
//     return MaterialApp(
//       title: 'Widget Test',
//       home: TestWidgetSpans(),
//     );
//   }
// }

double getYOffsetOf(GlobalKey key) {
  RenderBox box = key.currentContext!.findRenderObject() as RenderBox;
  return box.localToGlobal(Offset.zero).dy;
}

double getXOffsetOf(GlobalKey key) {
  RenderBox box = key.currentContext!.findRenderObject() as RenderBox;
  return box.localToGlobal(Offset.zero).dx;
}

void resolveSameRow(List<GlobalKey<_WidgetSpanWrapperState>> keys) {
  var middle = (keys.length / 2.0).floor();
  for (int i = 0; i < middle; i++) {
    var a = keys[i];
    var b = keys[keys.length - i - 1];
    var left = getXOffsetOf(a);
    var right = getXOffsetOf(b);
    a.currentState!.updateXOffset(right - left);
    b.currentState!.updateXOffset(left - right);
  }
}

initFixWidgetSpan() {
  final keys = <GlobalKey<_WidgetSpanWrapperState>>[];

  SchedulerBinding.instance.addPostFrameCallback((timeStamp) {
    List<GlobalKey<_WidgetSpanWrapperState>>? sameRow;

    GlobalKey<_WidgetSpanWrapperState> prev = keys.removeAt(0);
    keys.forEach((key) {
      if (getYOffsetOf(key) == getYOffsetOf(prev)) {
        if (sameRow == null) {
          sameRow = [prev];
        }
        sameRow?.add(key);
      } else if (sameRow != null) {
        resolveSameRow(sameRow!);
        sameRow = null;
      }
      prev = key;
    });
    if (sameRow != null) {
      resolveSameRow(sameRow!);
    }
  });
  return keys;
}

nextKey() {
  var key = GlobalKey<_WidgetSpanWrapperState>();
  widgetSpanKeys.add(key);
  return key;
}
// class TestWidgetSpans extends StatelessWidget {
//   @override
//   Widget build(BuildContext context) {
//     final widgetSpanKeys= initFixWidgetSpan();
//
//     return Directionality(
//       textDirection: TextDirection.rtl,
//       child: Scaffold(
//         body: Center(
//           child: Text.rich(
//             TextSpan(
//               text: 'هذا اختباhر',
//               style: TextStyle(
//                 backgroundColor: Colors.grey.withOpacity(0.5),
//                 fontSize: 30,
//               ),
//               children: [
//                 WidgetSpan(
//                   child: WidgetSpanWrapper(
//                     key: nextKey(),
//                     child: MyWidgetSpan(color: Colors.red, text: 1),
//                   ),
//                 ),
//                 TextSpan(text: ' و '),
//                 WidgetSpan(
//                   child: WidgetSpanWrapper(
//                     key: nextKey(),
//                     child: MyWidgetSpan(color: Colors.orange, text: 2),
//                   ),
//                 ),
//                 TextSpan(text: ' ثم '),
//                 WidgetSpan(
//                   child: WidgetSpanWrapper(
//                     key: nextKey(),
//                     child: MyWidgetSpan(color: Colors.yellow, text: 3),
//                   ),
//                 ),
//                 TextSpan(text: ' ، لكنه معطل'),
//                 WidgetSpan(
//                   child: WidgetSpanWrapper(
//                     key: nextKey(),
//                     child: MyWidgetSpan(color: Colors.green, text: 4),
//                   ),
//                 ),
//                 TextSpan(text: ' اختبارات '),
//                 WidgetSpan(
//                   child: WidgetSpanWrapper(
//                     key: nextKey(),
//                     child: MyWidgetSpan(color: Colors.blue, text: 5),
//                   ),
//                 ),
//                 TextSpan(text: ' اختبارات '),
//                 WidgetSpan(
//                   child: WidgetSpanWrapper(
//                     key: nextKey(),
//                     child: MyWidgetSpan(color: Colors.purple, text: 6),
//                   ),
//                 ),
//                 TextSpan(text: ' اختبارات '),
//                 WidgetSpan(
//                   child: WidgetSpanWrapper(
//                     key: nextKey(),
//                     child: MyWidgetSpan(color: Colors.pink, text: 7),
//                   ),
//                 ),
//                 TextSpan(text: ' اختبارات '),
//                 WidgetSpan(
//                   child: WidgetSpanWrapper(
//                     key: nextKey(),
//                     child: MyWidgetSpan(color: Colors.lime, text: 8),
//                   ),
//                 ),
//                 TextSpan(text: ' اختبارf ات '),
//                 WidgetSpan(
//                   child: WidgetSpanWrapper(
//                     key: nextKey(),
//                     child: MyWidgetSpan(color: Colors.teal, text: 9),
//                   ),
//                 ),
//                 TextSpan(text: ' اختباراdت '),
//               ],
//             ),
//           ),
//         ),
//       ),
//     );
//   }
// }

class WidgetSpanWrapper extends StatefulWidget {
  WidgetSpanWrapper({Key? key, required this.child}) : super(key: key);

  final Widget child;

  @override
  _WidgetSpanWrapperState createState() => _WidgetSpanWrapperState();
}

class _WidgetSpanWrapperState extends State<WidgetSpanWrapper> {
  Offset offset = Offset.zero;

  void updateXOffset(double xOffset) {
    setState(() {
      this.offset = Offset(xOffset.isFinite ? xOffset : 0, 0);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Transform.translate(offset: offset, child: widget.child);
  }
}

class MyWidgetSpan extends StatelessWidget {
  final String text;
  TextStyle? style;

  MyWidgetSpan({Key? key, required this.text, this.style}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: style,
      textAlign: TextAlign.right,
      textDirection: TextDirection.rtl,
    );
  }
}
