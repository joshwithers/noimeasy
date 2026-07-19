import assert from 'node:assert/strict'
import test from 'node:test'
import {
  FormBodyTooLargeError,
  formRequestRejection,
  MAX_FORM_BODY_BYTES,
  parseFormBodyWithLimit,
} from '../src/lib/form-request.ts'

function formRequest(headers: HeadersInit = {}, body = 'name=Alex'): Request {
  return new Request('https://noimeasy.au/submit', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Origin: 'https://noimeasy.au',
      ...headers,
    },
    body,
  })
}

test('accepts a same-origin form submission', async () => {
  const request = formRequest()
  assert.equal(formRequestRejection(request), null)
  assert.deepEqual(await parseFormBodyWithLimit(request), { name: 'Alex' })
})

test('rejects cross-site, unsupported, and declared oversized submissions before parsing', () => {
  assert.equal(formRequestRejection(formRequest({ Origin: 'https://attacker.example' }))?.status, 403)
  assert.equal(formRequestRejection(formRequest({ Origin: '', 'Sec-Fetch-Site': 'cross-site' }))?.status, 403)
  assert.equal(formRequestRejection(formRequest({ 'Content-Type': 'application/json' }))?.status, 415)
  assert.equal(formRequestRejection(formRequest({ 'Content-Length': String(MAX_FORM_BODY_BYTES + 1) }))?.status, 413)
})

test('stops reading an undeclared oversized body', async () => {
  const request = formRequest({}, `name=${'A'.repeat(MAX_FORM_BODY_BYTES)}`)
  await assert.rejects(
    () => parseFormBodyWithLimit(request),
    (error: unknown) => error instanceof FormBodyTooLargeError,
  )
})
