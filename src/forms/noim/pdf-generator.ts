import unicodeFontBytes from 'dejavu-fonts-ttf/ttf/DejaVuSans.ttf'
import noimPdfBytes from './noim-blank.pdf'
import {
  generateNoimPdfFromAssets,
  PdfFieldOverflowError,
  UnsupportedPdfCharacterError,
} from './pdf-generator-core'

export { PdfFieldOverflowError, UnsupportedPdfCharacterError }
export { pdfFieldInputNames } from './pdf-generator-core'

export async function generateNoimPdf(data: Record<string, unknown>): Promise<Uint8Array> {
  return await generateNoimPdfFromAssets(data, noimPdfBytes, unicodeFontBytes)
}
