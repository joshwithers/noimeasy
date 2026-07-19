export const MAX_FORM_BODY_BYTES = 64 * 1024

export interface FormRequestRejection {
  status: 403 | 413 | 415
  error: string
}

export class FormBodyTooLargeError extends Error {
  constructor() {
    super('Form submission is too large')
    this.name = 'FormBodyTooLargeError'
  }
}

export function formRequestRejection(request: Request): FormRequestRejection | null {
  const contentType = request.headers.get('Content-Type') || ''
  if (!contentType.startsWith('multipart/form-data')
    && !contentType.startsWith('application/x-www-form-urlencoded')) {
    return { status: 415, error: 'Unsupported form submission format.' }
  }

  const contentLength = Number(request.headers.get('Content-Length'))
  if (Number.isFinite(contentLength) && contentLength > MAX_FORM_BODY_BYTES) {
    return { status: 413, error: 'Form submission is too large.' }
  }

  const expectedOrigin = new URL(request.url).origin
  const origin = request.headers.get('Origin')
  if (origin && origin !== expectedOrigin) {
    return { status: 403, error: 'Cross-site form submissions are not accepted.' }
  }

  if (!origin && request.headers.get('Sec-Fetch-Site') === 'cross-site') {
    return { status: 403, error: 'Cross-site form submissions are not accepted.' }
  }

  return null
}

export async function parseFormBodyWithLimit(
  request: Request,
  limit = MAX_FORM_BODY_BYTES,
): Promise<Record<string, unknown>> {
  if (!request.body) return {}

  const reader = request.body.getReader()
  const chunks: Uint8Array[] = []
  let totalBytes = 0

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    totalBytes += value.byteLength
    if (totalBytes > limit) {
      await reader.cancel()
      throw new FormBodyTooLargeError()
    }
    chunks.push(value)
  }

  const bytes = new Uint8Array(totalBytes)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }

  const formData = await new Response(bytes, {
    headers: { 'Content-Type': request.headers.get('Content-Type') || '' },
  }).formData()
  return Object.fromEntries(formData.entries())
}
