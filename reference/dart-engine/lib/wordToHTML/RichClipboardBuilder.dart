import 'package:flutter/material.dart';
import 'package:golden_shamela/wordToHTML/Paragraph.dart';

/// يحوّل شجرة InlineSpan لفقرة إلى HTML مع تنسيقات CSS داخلية
/// لاستخدامه في النسخ مع التنسيق إلى الحافظة.
class RichClipboardBuilder {
  RichClipboardBuilder._();

  /// يبني HTML من قائمة الفقرات المحددة.
  /// كل فقرة تُغلّف في <p> مع اتجاه ومحاذاة مناسبين.
  static String buildHtmlFromParagraphs(List<Paragraph> paragraphs) {
    final buf = StringBuffer();
    buf.write('<!DOCTYPE html>\n<html>\n<head>\n');
    buf.write('<meta charset="utf-8">\n');
    buf.write('</head>\n<body>\n');

    for (int i = 0; i < paragraphs.length; i++) {
      final p = paragraphs[i];
      final pHtml = _buildParagraphHtml(p);
      if (pHtml.isNotEmpty) {
        buf.write(pHtml);
        if (i < paragraphs.length - 1) buf.write('\n');
      }
    }

    buf.write('\n</body>\n</html>');
    return buf.toString();
  }

  /// يبني HTML لفقرة واحدة من شجرة InlineSpan الخاصة بها.
  static String _buildParagraphHtml(Paragraph paragraph) {
    final spans = paragraph.getPSpans();
    final dir = paragraph.textDirection == TextDirection.rtl ? 'rtl' : 'ltr';
    final align = _textAlignToCss(paragraph.textAlign);

    final styleAttrs = <String>[];
    styleAttrs.add('dir="$dir"');
    if (align != null) styleAttrs.add('style="text-align: $align; direction: $dir;"');
    else styleAttrs.add('style="direction: $dir;"');

    final innerHtml = _spansToHtml(spans);
    if (innerHtml.trim().isEmpty) return '';

    return '<p ${styleAttrs.join(' ')}>$innerHtml</p>';
  }

  /// يحوّل قائمة InlineSpan إلى HTML.
  static String _spansToHtml(List<InlineSpan> spans) {
    final buf = StringBuffer();
    for (final span in spans) {
      if (span is TextSpan) {
        buf.write(_textSpanToHtml(span));
      }
      // WidgetSpan → skip (images, footnotes, etc.)
    }
    return buf.toString();
  }

  /// يحوّل TextSpan إلى HTML مع تنسيق CSS داخلي.
  /// إذا كان للـ TextSpan أبناء، يُغلّف النص ثم يُعالج الأبناء.
  static String _textSpanToHtml(TextSpan span) {
    final css = _textStyleToCss(span.style);
    final text = span.text ?? '';

    // نص فارغ أو مسافة غير منقسمة فقط
    if (text.isEmpty && span.children == null) return '';

    String content;
    if (span.children != null && span.children!.isNotEmpty) {
      // TextSpan مع أبناء: النص أولاً ثم الأبناء
      final childBuf = StringBuffer();
      if (text.isNotEmpty) childBuf.write(_escapeHtml(text));
      for (final child in span.children!) {
        if (child is TextSpan) {
          childBuf.write(_textSpanToHtml(child));
        }
      }
      content = childBuf.toString();
    } else {
      content = _escapeHtml(text);
    }

    if (content.isEmpty) return '';

    if (css.isNotEmpty) {
      return '<span style="$css">$content</span>';
    }
    return content;
  }

  /// يحوّل TextStyle إلى سلسلة CSS داخلية.
  static String _textStyleToCss(TextStyle? style) {
    if (style == null) return '';
    final parts = <String>[];

    // font-weight
    if (style.fontWeight != null) {
      final w = style.fontWeight!;
      if (w == FontWeight.bold || w.index >= FontWeight.w700.index) {
        parts.add('font-weight: bold');
      } else if (w != FontWeight.normal && w.index != FontWeight.w400.index) {
        parts.add('font-weight: ${w.index + 1}00');
      }
    }

    // font-style
    if (style.fontStyle == FontStyle.italic) {
      parts.add('font-style: italic');
    }

    // color
    if (style.color != null) {
      parts.add('color: ${_colorToCss(style.color!)}');
    }

    // font-size
    if (style.fontSize != null) {
      parts.add('font-size: ${style.fontSize!.toStringAsFixed(1)}px');
    }

    // font-family
    if (style.fontFamily != null) {
      parts.add('font-family: \'${style.fontFamily}\'');
    }

    // text-decoration
    if (style.decoration != null &&
        style.decoration != TextDecoration.none) {
      final decoParts = <String>[];
      if (style.decoration!.contains(TextDecoration.underline)) {
        decoParts.add('underline');
      }
      if (style.decoration!.contains(TextDecoration.lineThrough)) {
        decoParts.add('line-through');
      }
      if (decoParts.isNotEmpty) {
        var decoStr = 'text-decoration: ${decoParts.join(' ')}';
        if (style.decorationColor != null) {
          decoStr += ' ${_colorToCss(style.decorationColor!)}';
        }
        parts.add(decoStr);
      }
    }

    // letter-spacing
    if (style.letterSpacing != null && style.letterSpacing! != 0) {
      parts.add('letter-spacing: ${style.letterSpacing!.toStringAsFixed(1)}px');
    }

    return parts.join('; ');
  }

  /// يحوّل Color إلى CSS color string (#RRGGBB)
  static String _colorToCss(Color color) {
    final r = color.red.toRadixString(16).padLeft(2, '0');
    final g = color.green.toRadixString(16).padLeft(2, '0');
    final b = color.blue.toRadixString(16).padLeft(2, '0');
    return '#$r$g$b';
  }

  /// يحوّل TextAlign إلى CSS text-align
  static String? _textAlignToCss(TextAlign? align) {
    if (align == null) return null;
    switch (align) {
      case TextAlign.left:
        return 'left';
      case TextAlign.right:
        return 'right';
      case TextAlign.center:
        return 'center';
      case TextAlign.justify:
        return 'justify';
      case TextAlign.start:
        return 'start';
      case TextAlign.end:
        return 'end';
    }
  }

  /// يهرب أحرف HTML الخاصة
  static String _escapeHtml(String text) {
    return text
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;');
  }
}
