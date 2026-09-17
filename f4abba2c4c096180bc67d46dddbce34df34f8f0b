from __future__ import annotations
import argparse, hashlib, json, os, shutil, tempfile, zipfile
from pathlib import Path
from xml.etree import ElementTree as ET
from pypdf import PdfReader, PdfWriter
from pypdf.generic import ArrayObject, DictionaryObject, NameObject

ACTIVE={"/JavaScript","/Launch","/URI","/GoToR","/SubmitForm","/ImportData"}
REL_NS="http://schemas.openxmlformats.org/package/2006/relationships"
R_NS="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
W_NS="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
ALLOWED_EXTERNAL_SUFFIXES=("/hyperlink","/attachedTemplate")

def sha(path:Path):
 h=hashlib.sha256()
 with path.open("rb") as f:
  for b in iter(lambda:f.read(1024*1024),b""):h.update(b)
 return h.hexdigest()

def image_count(reader:PdfReader):
 total=0
 for page in reader.pages:
  resources=page.get("/Resources") or {}; xobjects=resources.get("/XObject") or {}
  for ref in xobjects.values():
   try:
    if ref.get_object().get("/Subtype")=="/Image":total+=1
   except Exception: pass
 return total

def pdf_snapshot(path:Path):
 r=PdfReader(path,strict=False)
 texts=[(p.extract_text() or "") for p in r.pages]
 return {"pages":len(r.pages),"textSha256":hashlib.sha256("\u0000".join(texts).encode("utf-8")).hexdigest(),"textChars":sum(len(x) for x in texts),"images":image_count(r)}

def scrub_pdf_obj(obj,seen:set[int]):
 try:o=obj.get_object()
 except Exception:return
 oid=id(o)
 if oid in seen:return
 seen.add(oid)
 if isinstance(o,DictionaryObject):
  if str(o.get("/S")) in ACTIVE or str(o.get("/Type"))=="/EmbeddedFile":o.clear();return
  for key in list(o.keys()):
   value=o.get(key)
   if key in ("/OpenAction","/AA"):
    o.pop(key,None);continue
   if key=="/A":
    try: action=value.get_object(); active=str(action.get("/S")) in ACTIVE
    except Exception: active=False
    if active:o.pop(key,None);continue
   if key=="/Names":
    try:
     names=value.get_object(); names.pop(NameObject("/JavaScript"),None); names.pop(NameObject("/EmbeddedFiles"),None)
    except Exception:pass
   scrub_pdf_obj(value,seen)
 elif isinstance(o,ArrayObject):
  for value in list(o):scrub_pdf_obj(value,seen)

def sanitize_pdf(src:Path,dst:Path):
 before=pdf_snapshot(src); reader=PdfReader(src,strict=False); writer=PdfWriter();writer.clone_document_from_reader(reader)
 scrub_pdf_obj(writer.root_object,set())
 for obj in writer._objects:
  if obj is not None:scrub_pdf_obj(obj,set())
 for page in writer.pages:
  annots=page.get("/Annots")
  if annots:
   kept=ArrayObject()
   for ref in annots:
    try: annotation=ref.get_object(); subtype=str(annotation.get("/Subtype"))
    except Exception: kept.append(ref);continue
    if subtype=="/FileAttachment":continue
    scrub_pdf_obj(annotation,set());kept.append(ref)
   page[NameObject("/Annots")]=kept
 dst.parent.mkdir(parents=True,exist_ok=True)
 tmp=dst.with_suffix(dst.suffix+".tmp")
 with tmp.open("wb") as f:writer.write(f)
 after=pdf_snapshot(tmp)
 if before!=after:
  tmp.unlink(missing_ok=True);raise ValueError(f"pdf_fidelity_mismatch:{before['pages']}:{after['pages']}:{before['images']}:{after['images']}")
 os.replace(tmp,dst);return before

def rel_owner(rel_path:str):
 if rel_path=="_rels/.rels":return None
 parent,name=rel_path.rsplit("/_rels/",1);return f"{parent}/{name[:-5]}"

def unwrap_hyperlinks(root:ET.Element,ids:set[str]):
 changed=False
 for parent in root.iter():
  for child in list(parent):
   if child.tag==f"{{{W_NS}}}hyperlink" and child.attrib.get(f"{{{R_NS}}}id") in ids:
    pos=list(parent).index(child);parent.remove(child)
    for item in list(child):parent.insert(pos,item);pos+=1
    changed=True
 return changed

def sanitize_docx(src:Path,dst:Path):
 with zipfile.ZipFile(src) as zin:
  infos=zin.infolist(); payload={i.filename:zin.read(i.filename) for i in infos}
 removals={}
 for name,data in list(payload.items()):
  if not name.endswith(".rels"):continue
  root=ET.fromstring(data);remove=[]
  for rel in list(root):
   if rel.attrib.get("TargetMode")!="External":continue
   typ=rel.attrib.get("Type","")
   if not typ.endswith(ALLOWED_EXTERNAL_SUFFIXES):raise ValueError(f"docx_required_external:{typ.rsplit('/',1)[-1]}")
   remove.append(rel);removals.setdefault(rel_owner(name),set()).add(rel.attrib.get("Id",""))
  for rel in remove:root.remove(rel)
  if remove:payload[name]=ET.tostring(root,encoding="utf-8",xml_declaration=True)
 for owner,ids in removals.items():
  if owner and owner in payload:
   root=ET.fromstring(payload[owner]);unwrap_hyperlinks(root,ids);payload[owner]=ET.tostring(root,encoding="utf-8",xml_declaration=True)
 dst.parent.mkdir(parents=True,exist_ok=True);tmp=dst.with_suffix(dst.suffix+".tmp")
 with zipfile.ZipFile(tmp,"w") as zout:
  for info in infos:zout.writestr(info,payload[info.filename])
 with zipfile.ZipFile(tmp) as check:
  bad=check.testzip()
  if bad:tmp.unlink(missing_ok=True);raise ValueError(f"docx_zip_corrupt:{bad}")
 os.replace(tmp,dst)
 return {"entries":len(infos),"media":sum(1 for n in payload if n.startswith("word/media/"))}

def main():
 a=argparse.ArgumentParser();a.add_argument("--input",required=True);a.add_argument("--output",required=True);a.add_argument("--only",action="append",default=[]);args=a.parse_args()
 src=Path(args.input);out=Path(args.output);results=[]
 for path in sorted(src.iterdir()):
  if path.suffix.lower() not in (".pdf",".docx") or args.only and path.name not in args.only:continue
  target=out/path.name
  try:
   details=sanitize_pdf(path,target) if path.suffix.lower()==".pdf" else sanitize_docx(path,target)
   results.append({"source":path.name,"status":"sanitized","output":str(target),"sourceSha256":sha(path),"outputSha256":sha(target),"details":details})
  except Exception as e:
   target.unlink(missing_ok=True);results.append({"source":path.name,"status":"fail-closed","reason":str(e).splitlines()[0][:240],"sourceSha256":sha(path)})
 manifest=out/"sanitization-manifest.json";out.mkdir(parents=True,exist_ok=True);manifest.write_text(json.dumps({"schemaVersion":1,"sourceRoot":str(src),"results":results},ensure_ascii=False,indent=2),encoding="utf-8")
 print(manifest)
if __name__=="__main__":main()
