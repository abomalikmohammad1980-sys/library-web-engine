import 'package:golden_shamela/Utils/ImageParser.dart';
import 'package:golden_shamela/wordToHTML/SectPr.dart';

/// يحوّل الإحداثي الرأسي لعناصر الفوتر العائمة من فضاء الصفحة/الهوامش
/// إلى إحداثي محلي داخل حاوية الفوتر في Flutter.
///
/// هذا ضروري لأن `wp:positionV/@relativeFrom` في OOXML لا يعني دائمًا
/// أن `posOffset` محسوب من حافة الصفحة نفسها. حالة `margin` مثلًا تعني
/// Page Margin لا Page Edge، وإذا عاملناها كأنها `page` يسقط العنصر خارج
/// حاوية الفوتر رغم أن Word يضعه داخلها بشكل صحيح.
class FooterFloatingPositionResolver {
  const FooterFloatingPositionResolver._();

  static double resolveTop({
    required ImageData image,
    required SectPr sectPr,
    required double pageHeight,
    required double footerStoryYOffset,
  }) {
    final footerContainerPageTop = pageHeight - sectPr.bottomMargin;
    final relativeFromV = image.relativeFromV;

    if (relativeFromV == "page") {
      return image.posY - footerContainerPageTop - footerStoryYOffset;
    }

    if (relativeFromV == "margin" || relativeFromV == "topMargin") {
      return sectPr.topMargin +
          image.posY -
          footerContainerPageTop -
          footerStoryYOffset;
    }

    if (relativeFromV == "bottomMargin") {
      if (image.alingV == "center") {
        return (sectPr.bottomMargin - image.height) / 2 - footerStoryYOffset;
      }
      return image.posY - footerStoryYOffset;
    }

    // الحالات الأخرى مثل paragraph/line تبقى كما فسّرها مسار الفقرة نفسه.
    return image.posY;
  }
}
