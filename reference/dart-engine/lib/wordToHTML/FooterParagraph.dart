
import 'package:golden_shamela/wordToHTML/Paragraph.dart';
import 'package:golden_shamela/wordToHTML/runT.dart';
import 'package:xml/xml.dart';

class FooterParagraph extends Paragraph{
  XmlElement? sdt;
  FooterParagraph(super.parent);
  Paragraph fromXmlFooter(XmlElement paragraphXml, String pagNum){
    Paragraph p = super.fromXml(paragraphXml);
    sdt = paragraphXml.getElement("w:sdt");

    List<runT> sdtRuns = getSdtRuns(sdt,pagNum);

    p.runs.addAll(sdtRuns);

    return p;
  }
  List<runT> getSdtRuns(XmlElement? sdt,String pagNum) {
    List<runT> sdtRuns = [];
    if(sdt!=null){
      bool isPageNum = false;
      sdt.getElement("w:sdtContent")?.childElements.forEach((e){
        if(e.getElement("w:fldChar")?.getAttribute("w:fldCharType")=="begin") {
          runT r = runT(this,prPr:null,pPr: null).fromXml(e);
          r.text = pagNum;
          sdtRuns.add(r);
          isPageNum=true;
        } else if(e.getElement("w:fldChar")?.getAttribute("w:fldCharType")=="end")
          isPageNum=false;
        else if(!isPageNum){
          runT r = runT(this,prPr:null,pPr: null).fromXml(e);
          if(r.text?.isNotEmpty==true)
            sdtRuns.add(r);
        }
      });
    }
    return sdtRuns;
  }

}
//
// List<runT> getSdtRuns2(XmlElement? sdt,String pagNum) {
//   List<runT> sdtRuns = [];
//   if(sdt!=null){
//     bool isPageNum = false;
//     XmlElement? xmlP = sdt.getElement("w:p");
//     Paragraph? p = xmlP!=null?Paragraph().fromXml(xmlP):null;
//
//     sdt.getElement("w:sdtContent")?.findAllElements("w:r").forEach((e){
//       if(e.getElement("w:fldChar")?.getAttribute("w:fldCharType")=="begin") {
//         runT r = runT(prPr:null,pPr: null).fromXml(e);
//         r.text = pagNum;
//         r.parent = p;
//         sdtRuns.add(r);
//         isPageNum=true;
//       } else if(e.getElement("w:fldChar")?.getAttribute("w:fldCharType")=="end")
//         isPageNum=false;
//       else if(!isPageNum){
//         runT r = runT(prPr:p?.prPr,pPr: p?.pPr).fromXml(e);
//         r.parent=p;
//         if(r.text?.isNotEmpty==true)
//           sdtRuns.add(r);
//       }
//     });
//   }
//
//   return sdtRuns;
// }
