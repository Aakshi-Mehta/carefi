/**
 * OCR Pipeline using Tesseract.js.
 * This module is dynamically imported only when native PDF text extraction fails.
 *
 * Requirements:
 * - tesseract.js is already installed.
 * - PDF-to-image conversion requires pdf2pic or pdfjs-dist + canvas.
 *   These have native dependencies and may not be available in all environments.
 *
 * If the environment cannot run OCR, this module throws and the caller
 * falls back gracefully to reporting the file as requiring manual review.
 */

export async function ocrPdf(buffer: Buffer): Promise<string> {
  // Dynamic import to avoid crashing at startup if Tesseract is misconfigured
  const { createWorker } = await import('tesseract.js');

  // We need PDF-to-image conversion. Try pdf2pic.
  // pdf2pic requires GraphicsMagick or ImageMagick to be installed on the OS.
  // In a containerised or serverless environment this may not be present.
  // We throw explicitly so the caller can handle gracefully.

  let convertFn: ((buf: Buffer) => Promise<string[]>) | null = null;

  try {
    const { fromBuffer } = await import('pdf2pic');
    convertFn = async (buf: Buffer): Promise<string[]> => {
      const convert = fromBuffer(buf, {
        density: 200,
        format: 'png',
        width: 1700,
        height: 2200,
      });
      const totalPages = 5; // Process up to 5 pages to stay within time limits
      const results: string[] = [];
      for (let page = 1; page <= totalPages; page++) {
        try {
          const result = await convert(page, { responseType: 'base64' });
          if (result && result.base64) results.push(result.base64);
        } catch {
          break; // Page doesn't exist or conversion failed — stop
        }
      }
      return results;
    };
  } catch {
    throw new Error(
      'pdf2pic is not available. Install pdf2pic and ImageMagick to enable OCR on scanned PDFs.'
    );
  }

  const imageBase64Strings = await convertFn(buffer);
  if (!imageBase64Strings.length) {
    throw new Error('PDF-to-image conversion produced no images.');
  }

  const worker = await createWorker('eng');
  const textParts: string[] = [];

  for (const b64 of imageBase64Strings) {
    const imageBuffer = Buffer.from(b64, 'base64');
    const { data } = await worker.recognize(imageBuffer);
    if (data.text) textParts.push(data.text.trim());
  }

  await worker.terminate();

  return textParts.join('\n\n');
}
