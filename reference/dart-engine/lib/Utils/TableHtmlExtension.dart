
import 'package:flutter/material.dart';
import 'package:flutter_html/flutter_html.dart';

class CustomTableExtension extends HtmlExtension {

  @override
  InlineSpan build(ExtensionContext context) {
    // تخصيص عرض الجدول أو معالجته
    return WidgetSpan(
      child: Container(
        padding: EdgeInsets.all(8),
        color: Colors.grey[200],
        child: Table(
          border: TableBorder.all(),
          children: [
            TableRow(children: [
              Text("الاسم", textAlign: TextAlign.center),
              Text("العمر", textAlign: TextAlign.center),
              Text("المدينة", textAlign: TextAlign.center),
            ]),
            TableRow(children: [
              Text("علي", textAlign: TextAlign.center),
              Text("25", textAlign: TextAlign.center),
              Text("دمشق", textAlign: TextAlign.center),
            ]),
            // يمكنك إضافة صفوف أخرى حسب الحاجة
          ],
        ),
      ),
    );
  }

  @override
  // TODO: implement supportedTags
  Set<String> get supportedTags => throw UnimplementedError();
}
