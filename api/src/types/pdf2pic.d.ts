declare module 'pdf2pic' {
  export type Pdf2PicResult = {
    base64?: string;
    page?: number;
    [key: string]: unknown;
  };

  export function fromBuffer(
    buffer: Buffer,
    options?: Record<string, unknown>
  ): (page: number, options?: Record<string, unknown>) => Promise<Pdf2PicResult>;
}
