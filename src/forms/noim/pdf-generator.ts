import unicodeFontBytes from 'dejavu-fonts-ttf/ttf/DejaVuSans.ttf'
import noimPdfBytes from './noim-blank.pdf'
import {
  generateNoimPdfFromAssets,
  UnsupportedPdfCharacterError,
} from './pdf-generator-core'

export { UnsupportedPdfCharacterError }

export async function generateNoimPdf(data: Record<string, unknown>): Promise<Uint8Array> {
  return await generateNoimPdfFromAssets(data, noimPdfBytes, unicodeFontBytes)
}
