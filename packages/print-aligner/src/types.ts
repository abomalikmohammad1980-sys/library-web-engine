export type MatchStatus = "auto" | "needs_review" | "rejected";
export interface PdfPageText { page: number; text: string; normalized: string; method: "text-layer" | "empty-needs-ocr" }
export interface PageMatch {
  pdfPage: number; paragraphIndex: number | null; wordLogicalPage: number;
  confidence: number; status: MatchStatus; reasons: string[];
  pdfStart: string; pdfEnd: string; docxText: string;
}
export interface AlignmentReport {
  schemaVersion: 1; createdAt: string;
  inputs: { pdf: { path: string; sha256: string; bytes: number }; docx: { path: string; sha256: string; bytes: number } };
  normalization: { arabicDiacritics: "ignored"; tatweel: "ignored"; alefVariants: "unified"; whitespace: "collapsed" };
  metrics: { pdfPages: number; docxParagraphs: number; auto: number; needsReview: number; emptyPdfPages: number; measuredCoverage: number; meanConfidence: number };
  pages: PdfPageText[]; matches: PageMatch[];
  wordPageMap?: { path: string; fingerprint?: string; totalPages?: number };
  limitations: string[];
}
export interface ApprovalFile { reportSha256: string; decisions: { pdfPage: number; action: "accept" | "reject"; paragraphIndex?: number }[] }
