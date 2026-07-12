

import 'package:flutter/services.dart';

copyText(String text )async{
  await Clipboard.setData(ClipboardData(text: text));

}
pasteText()async {
  ClipboardData? data = await Clipboard.getData('text/plain');
  String? text = data?.text;
  return text;
}