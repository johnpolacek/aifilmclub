declare module "pdf-parse/lib/pdf-parse.js" {
  interface PDFData {
    text: string;
    numpages: number;
    numrender: number;
    info: {
      PDFFormatVersion?: string;
      IsAcroFormPresent?: boolean;
      IsXFAPresent?: boolean;
      Title?: string;
      Author?: string;
      Subject?: string;
      Creator?: string;
      Producer?: string;
      CreationDate?: string;
      ModDate?: string;
    };
    metadata: unknown;
    version: string;
  }

  function pdfParse(dataBuffer: Buffer | ArrayBuffer, options?: object): Promise<PDFData>;
  export default pdfParse;
}

