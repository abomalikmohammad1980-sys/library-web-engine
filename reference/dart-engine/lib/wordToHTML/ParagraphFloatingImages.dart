part of 'Paragraph.dart';

/// Extracted from Paragraph.dart to keep the core class small while
/// preserving the same library-private access and rendering behavior.
mixin ParagraphFloatingImages on ParagraphMembers {
  void _ensureParagraphXmlForDecoration();
  Uint8List? _extractImageFromEmf(Uint8List emfData);

  /// Public getter: returns the paragraph fill colour from [w:shd], or null.
  /// Used by [_ParagraphBorderGroupWidget] to paint the background across the
  /// full interior of the border box (including the w:pBdr space gaps).
  Color? get paragraphShadingColor => _getParagraphShadingColor();

  // قراءة تظليل الفقرة من w:pPr/w:shd
  Color? _getParagraphShadingColor() {
    try {
      _ensureParagraphXmlForDecoration();
      final shd = pPr?.xmlpPr?.getElement("w:shd");
      if (shd == null) return null;

      // حل لون التيمة أولاً (themeFill + tint/shade)
      String? themeFill = shd.getAttribute("w:themeFill");
      if (themeFill != null) {
        String? resolved = resolveThemeColor(
          pPr?.wordDocument.themeColors ?? {},
          themeFill,
          shd.getAttribute("w:themeFillTint"),
          shd.getAttribute("w:themeFillShade"),
        );
        if (resolved != null && resolved.length == 6) {
          return Color(int.parse("0xFF$resolved"));
        }
      }

      // fallback: w:fill
      final fill = shd.getAttribute("w:fill");
      if (fill == null || fill.isEmpty) return null;
      String hex = fill;
      if (hex.length == 6) {
        hex = "FF$hex";
      }
      return Color(int.parse(hex, radix: 16));
    } catch (_) {
      return null;
    }
  }

  // دالة معدلة لتقبل فلتر behindDoc
  List<Widget> _getPositionedImages(bool behindDoc) {
    // الحصول على الهوامش لحساب الموقع النسبي الصحيح
    final sectPr = parent.parent.getSectPrForPage(parent.pageIndex);
    double leftMargin = sectPr.leftMargin ?? 0;
    double pageWidth = sectPr.width ?? 595;
    double pageHeight = sectPr.height ?? 842;
    double rightMargin = sectPr.rightMargin ?? 0;
    double marginAreaWidth = pageWidth - leftMargin - rightMargin;

    List<Widget> widgets = [];

    // حساب أقصى ارتفاع للصور الملتفة (Wrapping Images)
    // نستخدم ارتفاع الصورة فقط (وليس موقعها المطلق) لأن أنظمة الإحداثيات قد تختلف
    double maxWrapImageHeight = 0;
    if (!behindDoc) {
      for (var run in runs) {
        if (run.image != null) {
          var img = run.image!;
          // نتحقق إذا كانت الصورة تسبب التفافاً (ليست خلف النص ولها خاصية التفاف)
          if (!img.behindDoc &&
              (img.wrapMode == "Square" ||
                  img.wrapMode == "TopAndBottom" ||
                  img.wrapMode == "Tight" ||
                  img.wrapMode == "Through")) {
            // نستخدم أكبر ارتفاع صورة (وليس موقعها المطلق)
            if (img.height > maxWrapImageHeight) {
              maxWrapImageHeight = img.height;
            }
          }
        }
      }
    }

    // ترتيب الصور حسب z-index/relativeHeight تصاعدياً
    // في Stack، العناصر الأخيرة تظهر فوق العناصر الأولى
    // لذا القيمة الأقل تأتي أولاً (تظهر تحت)
    var sortedImageRuns = imageRunTs
        .where((r) => r.image != null && r.image!.behindDoc == behindDoc)
        .toList();
    final sourceOrder = <runT, int>{};
    for (var i = 0; i < sortedImageRuns.length; i++) {
      sourceOrder[sortedImageRuns[i]] = i;
    }

    double _effectiveHeight(ImageData img) {
      if (img.vmlZIndex != 0) {
        return img.vmlZIndex;
      }
      return img.relativeHeight;
    }

    sortedImageRuns.sort((a, b) {
      final aImg = a.image!;
      final bImg = b.image!;
      final aHeight = _effectiveHeight(aImg);
      final bHeight = _effectiveHeight(bImg);

      if (aHeight != bHeight) {
        return aHeight.compareTo(bHeight);
      }

      final aType = aImg.vmlShapeData?.shapeType.toLowerCase();
      final bType = bImg.vmlShapeData?.shapeType.toLowerCase();
      if (aType == 'line' && bType != 'line') return -1;
      if (bType == 'line' && aType != 'line') return 1;

      return (sourceOrder[a] ?? 0).compareTo(sourceOrder[b] ?? 0);
    });

    // debug ordering for imaging layer decisions
    for (var run in sortedImageRuns) {
      var img = run.image!;
      double left = 0;
      double top = img.posY; // relativeFromV="paragraph" يعني posY نسبي للفقرة

      if (isFooterParagraph) {
        top = FooterFloatingPositionResolver.resolveTop(
          image: img,
          sectPr: sectPr,
          pageHeight: pageHeight,
          footerStoryYOffset: footerStoryYOffset,
        );
      }

      // تصحيح موقع مربعات النص إذا كان هناك صور تسبب التفافاً
      // نستخدم ارتفاع الصورة كموقع جديد (الصورة تبدأ من أعلى الفقرة تقريباً)
      if (!isHeaderParagraph &&
          !isFooterParagraph &&
          maxWrapImageHeight > 0 &&
          img.relativeFromV == "paragraph" &&
          (img.textBoxText != null && img.textBoxText!.isNotEmpty)) {
        // إذا كان موقع مربع النص الأصلي داخل منطقة الصورة الملتفة
        if (top < maxWrapImageHeight) {
          // نضعه مباشرة بعد الصورة (بنسبة 90% من ارتفاعها)
          top = maxWrapImageHeight * 0.90;
        }
        // وإلا نبقي الموقع الأصلي (top) كما هو لأنه أصلاً أسفل الصورة
      }

      // حساب left بناءً على المحاذاة أو الإحداثيات
      // هذا المنطق مشابه لـ ImageToWidget.dart لكن مخصص للفقرة
      bool usesHAlign =
          img.posX == 0 && (img.alignH == "center" || img.alignH == "right");

      if (usesHAlign && img.alignH == "center") {
        // التمركز بالنسبة لمنطقة الهامش (عرض الصفحة - الهوامش)
        // داخل الفقرة، (0,0) هو بداية منطقة الهامش
        if (img.relativeFromH == "page") {
          left = isHeaderParagraph
              ? (pageWidth - img.width) / 2
              : (pageWidth - img.width) / 2 - leftMargin;
        } else if (isHeaderParagraph) {
          left = leftMargin + (marginAreaWidth - img.width) / 2;
        } else {
          left = (marginAreaWidth - img.width) / 2;
        }
      } else if (usesHAlign && img.alignH == "right") {
        if (img.relativeFromH == "page") {
          left = pageWidth - img.width;
        } else if (isHeaderParagraph) {
          left = pageWidth - rightMargin - img.width;
        } else {
          left = marginAreaWidth - img.width;
        }
      } else {
        // استخدام posX
        // إذا كان relativeFromH="page"، فهو نسبي للصفحة الكاملة
        // لكن الفقرات داخل المحتوى تُعرض بعد leftMargin
        if (img.relativeFromH == "page") {
          if (isHeaderParagraph) {
            // في الهيدر نضع الصورة مباشرة بناءً على إحداثيات الصفح
            left = img.posX;
          } else if (img.vmlShapeData?.textBoxElement != null &&
              img.posX == 0 &&
              img.alignH == "left") {
            // Body VML text boxes with anchorx="page" and zero margin-left
            // are already resolved relative to the page edge. Subtracting the
            // body text margin pushes them too far left.
            left = img.posX;
          } else {
            // في المحتوى العام نخصم leftMargin لأن الحاوية تبدأ عند منطقة النص
            left = img.posX - leftMargin;
          }
        } else {
          left = isHeaderParagraph ? img.posX + leftMargin : img.posX;
        }
      }

      widgets.add(
        Positioned(
          left: left.isFinite ? left : 0,
          top: top.isFinite ? top : 0,
          // إذا كانت هذه فقرة هيدر، نجعل الصورة تتجاهل الضغط
          // حتى يعمل الضغط المطول على الهيدر
          // IgnorePointer prevents images from capturing pointer events
          // (which would block text selection/scrolling underneath)
          child: IgnorePointer(
            child: Builder(
                builder: (context) {
                  // NEW: Handle VML shapes via VmlRendererWidget
                  if (img.vmlShapeData != null) {
                    return getImageWidget(img, innerOnly: true);
                  }

                  // NEW: Handle Group Images via ImageToWidget logic
                  if (img.isGroup) {
                    return getImageWidget(img, innerOnly: true);
                  }

                  // NEW: Handle Vector Shapes (Freeform etc.)
                  if (img.isVectorShape && img.vectorPath != null) {
                    return getImageWidget(img, innerOnly: true);
                  }

                  // عرض Text Box (تمت إعادته ليعمل داخل Stack)
                  if (img.textBoxText != null && img.textBoxText!.isNotEmpty) {
                    Color textColor = Colors.black;

                    if (img.textColor != null) {
                      try {
                        String hex = img.textColor!;
                        if (hex.length == 6) {
                          hex = "FF" + hex;
                        }
                        textColor = Color(int.parse(hex, radix: 16));
                      } catch (e) {
                        print("Error parsing color: ${img.textColor}");
                      }
                    }

                    // حجم الخط في الوورد بوحدة نصف-نقطة. في Flutter نحتاج تقريباً 1.33x ليطابق الـ pt.
                    double fontSize = ((img.textSize ?? 20.0) * 1.333);
                    String? fontFamily = img.fontFamily;

                    // استبدال النص برقم الصفحة الفعلي إذا كان يحتوي على حقل PAGE
                    String displayText = img.textBoxText!;
                    if (img.containsPageField && customPageNumber != null) {
                      displayText = resolvePageFieldDisplayNumerals(
                        pageNumber: customPageNumber!,
                        useArabicNumerals: parent.parent.useArabicNumerals,
                        fontFamily: fontFamily,
                      );
                    }

                    return Container(
                      width: img.width > 0 ? img.width : null,
                      height: img.height > 0 ? img.height : null,
                      alignment: Alignment.center,
                      child: Text(
                        displayText,
                        textAlign: TextAlign.center,
                        textDirection: TextDirection.rtl,
                        style: TextStyle(
                          color: textColor,
                          fontSize: fontSize,
                          height: 1.05,
                          fontWeight: FontWeight.bold,
                          fontFamily: fontFamily,
                        ),
                      ),
                    );
                  }

                  if (img.imageMemory == null || img.imageMemory!.isEmpty) {
                    return SizedBox.shrink();
                  }

                  // التحقق من صحة البيانات (Magic Bytes)
                  bool isValid = false;
                  if (img.imageMemory!.length > 4) {
                    // PNG: 89 50 4E 47
                    if (img.imageMemory![0] == 0x89 &&
                        img.imageMemory![1] == 0x50 &&
                        img.imageMemory![2] == 0x4E &&
                        img.imageMemory![3] == 0x47) {
                      isValid = true;
                      // print("✅ Valid PNG detected for ${img.rId} in Paragraph");
                    }
                    // JPEG: FF D8 FF
                    else if (img.imageMemory![0] == 0xFF &&
                        img.imageMemory![1] == 0xD8 &&
                        img.imageMemory![2] == 0xFF) {
                      isValid = true;
                    }
                    // GIF: 47 49 46 38
                    else if (img.imageMemory![0] == 0x47 &&
                        img.imageMemory![1] == 0x49 &&
                        img.imageMemory![2] == 0x46 &&
                        img.imageMemory![3] == 0x38) {
                      isValid = true;
                    }
                    // WebP: 52 49 46 46 ... 57 45 42 50 (RIFF ... WEBP)
                    else if (img.imageMemory![0] == 0x52 &&
                        img.imageMemory![1] == 0x49 &&
                        img.imageMemory![2] == 0x46 &&
                        img.imageMemory![3] == 0x46) {
                      isValid = true;
                    }
                    // EMF: 01 00 00 00
                    else if (img.imageMemory![0] == 0x01 &&
                        img.imageMemory![1] == 0x00 &&
                        img.imageMemory![2] == 0x00 &&
                        img.imageMemory![3] == 0x00) {
                      // محاولة استخراج PNG أو JPEG من داخل EMF
                      Uint8List? extracted = _extractImageFromEmf(
                        img.imageMemory!,
                      );
                      if (extracted != null) {
                        return Image.memory(
                          extracted,
                          width: img.width,
                          height: img.height,
                          fit: BoxFit.fill,
                        );
                      }

                      /* print(
                        "⚠️ EMF Image detected (rId: ${img.rId}) - Not supported natively by Flutter",
                      ); */
                      return Container(
                        width: img.width,
                        height: img.height,
                        decoration: BoxDecoration(
                          border: Border.all(color: Colors.blue),
                          color: Colors.blue.withOpacity(0.1),
                        ),
                        child: Center(
                          child: Text(
                            "EMF Image\n(Not Supported)",
                            textAlign: TextAlign.center,
                            style: TextStyle(fontSize: 10, color: Colors.blue),
                          ),
                        ),
                      );
                    }
                  }

                  if (!isValid) {
                    print(
                      "⚠️ Invalid Image Format for rId: ${img.rId} (First 4 bytes: ${img.imageMemory!.take(4).toList()})",
                    );
                    return Container(
                      width: img.width,
                      height: img.height,
                      color: Colors.orange.withOpacity(0.2),
                      child: Center(
                        child: Text(
                          "Invalid Format",
                          style: TextStyle(fontSize: 10, color: Colors.orange),
                        ),
                      ),
                    );
                  }

                  // إنشاء widget الصورة
                  Widget imageWidget = Image.memory(
                    img.imageMemory!,
                    width: img.width,
                    height: img.height,
                    fit: BoxFit.fill,
                    errorBuilder: (context, error, stackTrace) {
                      /* print(
                        "═══════════════════════════════════════════════════════════",
                      );
                      print("❌ ERROR LOADING IMAGE: ${img.rId}");
                      print("  Error: $error");
                      print("  Data length: ${img.imageMemory?.length} bytes");
                      print(
                        "═══════════════════════════════════════════════════════════",
                      ); */
                      return Container(
                        width: img.width,
                        height: img.height,
                        color: Colors.red.withOpacity(0.2),
                        child: Center(
                          child: Icon(Icons.broken_image, color: Colors.red),
                        ),
                      );
                    },
                  );

                  return imageWidget;
                },
            ),
          ),
        ),
      );
    }
    return widgets;
  }

  /// حفظ XML الفقرة في ملف للديبوج
}
