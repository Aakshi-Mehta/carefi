import fs from 'fs';
// pdf-parse uses CommonJS require under the hood
// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse = require('pdf-parse');

export interface PdfExtractionResult {
  text: string;
  pageCount: number;
  ocrUsed: boolean;
  partial: boolean;
  error?: string;
}

/**
 * Extract text from a PDF buffer.
 * Attempts native text extraction first.
 * Falls back to Tesseract.js OCR if no text is found.
 * If OCR also fails, returns the original file reference with partial=true.
 *
 * NOTE: Tesseract.js in a serverless context processes one page at a time
 * to stay within execution-time limits. Large scanned PDFs may be partial.
 */
export async function extractPdfText(buffer: Buffer): Promise<PdfExtractionResult> {
  // Step 1: Native text extraction
  try {
    const data = await pdfParse(buffer, {
      // Limit pages to prevent OOM in serverless
      max: 20,
    });

    const text: string = (data.text || '').trim();
    const pageCount: number = data.numpages || 1;

    if (text.length > 50) {
      // Sufficient text extracted natively
      return { text, pageCount, ocrUsed: false, partial: false };
    }

    // Text too short — likely scanned PDF, attempt OCR
    return await attemptOcr(buffer, pageCount, 'Too little native text extracted');
  } catch (err) {
    const message = (err as Error).message || 'Unknown pdf-parse error';
    console.warn('[PDF] Native extraction failed:', message);
    return await attemptOcr(buffer, 1, message);
  }
}

async function attemptOcr(
  _buffer: Buffer,
  pageCount: number,
  reason: string
): Promise<PdfExtractionResult> {
  // Tesseract.js requires rendering PDF pages to images first.
  // In a serverless environment without a headless browser, this requires
  // pdf2pic + canvas or similar. We report honestly when OCR cannot proceed.
  //
  // A full OCR pipeline would require:
  //   1. Convert PDF pages to PNG/JPEG images (pdf2pic, pdfjs-dist + canvas)
  //   2. Pass each image to Tesseract.js worker
  //   3. Aggregate text across pages
  //
  // This requires the 'canvas' native module which may not build in all environments.
  // We handle the failure gracefully and report it as partial.

  try {
    // Attempt dynamic import of OCR pipeline if available
    const { ocrPdf } = await import('./ocrPipeline');
    const text = await ocrPdf(_buffer);
    if (text && text.length > 20) {
      return { text, pageCount, ocrUsed: true, partial: false };
    }
    return {
      text: '',
      pageCount,
      ocrUsed: true,
      partial: true,
      error: `OCR returned insufficient text. Reason: ${reason}`,
    };
  } catch (_ocrErr) {
    return {
      text: '',
      pageCount,
      ocrUsed: false,
      partial: true,
      error: `PDF text extraction failed and OCR is unavailable in this environment. Reason: ${reason}. Please review the original file manually.`,
    };
  }
}
