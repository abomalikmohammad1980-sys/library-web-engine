# قياس تقدّمات GDI الأصليّة (تلميح 600dpi) لكل fullText — خاصّ بويندوز.
# الاستخدام: powershell -File gdi_measure.ps1 -Book sample-tadris -Family "Traditional Arabic"
# المدخل: tools/word-oracle/gdi-collect-<Book>.txt (em<TAB>fullText لكل سطر)
# المخرج: tools/word-oracle/gdi-cache-<Book>.json ({ fullText: [cum px @600dpi] })
param(
  [Parameter(Mandatory=$true)][string]$Book,
  [Parameter(Mandatory=$true)][string]$Family
)
Add-Type @"
using System;using System.Runtime.InteropServices;
public class GdiMeasure{
 [DllImport("gdi32.dll")]public static extern IntPtr CreateCompatibleDC(IntPtr h);
 [DllImport("gdi32.dll")]public static extern bool DeleteDC(IntPtr h);
 [DllImport("gdi32.dll",CharSet=CharSet.Unicode)]public static extern IntPtr CreateFontW(int h,int w,int e,int o,int wt,uint i,uint u,uint s,uint c,uint op,uint cp,uint q,uint p,string f);
 [DllImport("gdi32.dll")]public static extern IntPtr SelectObject(IntPtr h,IntPtr o);
 [DllImport("gdi32.dll")]public static extern bool DeleteObject(IntPtr o);
 [StructLayout(LayoutKind.Sequential)]public struct SIZE{public int cx;public int cy;}
 [DllImport("gdi32.dll",CharSet=CharSet.Unicode)]public static extern bool GetTextExtentExPointW(IntPtr h,string s,int c,int mx,IntPtr fit,int[] dx,out SIZE sz);
 public static int[] Cum(string face,int height,string t){
   IntPtr dc=CreateCompatibleDC(IntPtr.Zero);IntPtr fn=CreateFontW(height,0,0,0,400,0,0,0,1,0,0,0,0,face);IntPtr o=SelectObject(dc,fn);
   int[] dx=new int[t.Length];SIZE z;GetTextExtentExPointW(dc,t,t.Length,0,IntPtr.Zero,dx,out z);
   SelectObject(dc,o);DeleteObject(fn);DeleteDC(dc);return dx;
 }
}
"@
$in  = "tools/word-oracle/gdi-collect-$Book.txt"
$out = "tools/word-oracle/gdi-cache-$Book.json"
$lines = [System.IO.File]::ReadAllLines($in,[System.Text.Encoding]::UTF8)
$map = [ordered]@{}
foreach($ln in $lines){
  $tab = $ln.IndexOf("`t"); if($tab -lt 0){ continue }
  $em = [int]$ln.Substring(0,$tab); $txt = $ln.Substring($tab+1)
  if($txt.Length -eq 0 -or $map.Contains($txt)){ continue }
  $h = -[math]::Round($em*600.0/1440.0)
  $dx = [GdiMeasure]::Cum($Family,$h,$txt)
  $map[$txt] = $dx
}
$json = $map | ConvertTo-Json -Depth 3 -Compress
[System.IO.File]::WriteAllText($out,$json,(New-Object System.Text.UTF8Encoding($false)))
Write-Output ("gdi_measure: قِيس " + $map.Count + " fullText → " + $out)
