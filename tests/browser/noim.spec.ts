import { test, expect, type Page } from '@playwright/test'
import { readFile } from 'node:fs/promises'
import { PDFDocument } from 'pdf-lib'
import { validSubmission } from '../fixtures'
import { validateNoimSubmission } from '../../src/forms/noim/validation'

async function completeForm(page: Page, input = validSubmission()) {
  await page.goto('/prepare')
  for (let step = 1; step <= 6; step++) {
    await expect(page.locator('#step-indicator')).toHaveText(`Step ${step} of 7`)
    for (const [name, value] of Object.entries(input)) {
      const fields = page.locator(`[name="${name}"]`)
      if (!await fields.first().isVisible()) continue
      const tag = await fields.first().evaluate((el) => el.tagName)
      const type = await fields.first().getAttribute('type')
      if (type === 'radio') await fields.filter({ visible: true }).locator(`xpath=self::*[@value="${value}"]`).check()
      else if (tag === 'SELECT') await fields.selectOption(value)
      else {
        await fields.fill(value)
        await fields.press('Tab')
      }
    }
    await expect(page.locator('body')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
    await page.locator('#next-btn').click()
  }
  await expect(page.locator('#step-indicator')).toHaveText('Step 7 of 7')
}

test.beforeEach(async ({ page }, testInfo) => {
  // Isolate local rate-limiter counters; Cloudflare supplies this header in production.
  await page.setExtraHTTPHeaders({ 'CF-Connecting-IP': `browser-${testInfo.project.name}-${testInfo.title}` })
})

test('complete seven-step journey, full address review, edit, PDF and repeat download', async ({ page, context }, testInfo) => {
  const errors: string[] = []
  const externalRequests: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  page.on('request', (request) => {
    if (!['127.0.0.1', 'localhost'].includes(new URL(request.url()).hostname)) externalRequests.push(request.url())
  })
  const input = validSubmission()
  input.p1_address_line2 = 'Unit 1'
  input.p2_address_line2 = 'Apartment 12, Example Building'
  await completeForm(page, input)
  let validated = validateNoimSubmission(input)
  for (const prefix of ['p1', 'p2']) {
    await expect(page.locator('#review-section')).toContainText(validated.data[`${prefix}_address`])
  }
  await page.getByRole('button', { name: 'Edit Party 1: Usual place of residence', exact: true }).click()
  await expect(page.locator('[name="p1_address_line1"]')).toBeFocused()
  input.p1_address_line2 = 'Unit 2'
  await page.locator('[name="p1_address_line2"]').fill(input.p1_address_line2)
  for (let step = 1; step <= 6; step++) await page.locator('#next-btn').click()
  validated = validateNoimSubmission(input)
  await expect(page.locator('#review-section')).toContainText(validated.data.p1_address)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('review.png'), fullPage: true })
  const downloadEvent = page.waitForEvent('download')
  await page.locator('#submit-btn-top').click()
  const download = await downloadEvent
  expect(await download.failure()).toBeNull()
  const output = testInfo.outputPath('prepared-noim.pdf')
  await download.saveAs(output)
  const pdf = await PDFDocument.load(await readFile(output))
  expect(pdf.getPageCount()).toBe(5)
  expect(pdf.getForm().getFields()).toHaveLength(81)
  for (const party of [1, 2]) {
    expect(pdf.getForm().getTextField(`Person${party}PlaceOfResidence`).getText()).toBe(validated.data[`p${party}_address`])
  }
  await expect(page.locator('#form-feedback')).toContainText('It is not legal notice yet')
  await expect(page.locator('#completion-next-steps')).toBeVisible()
  const repeatEvent = page.waitForEvent('download')
  await page.getByRole('link', { name: 'Download your PDF again' }).click()
  expect(await (await repeatEvent).failure()).toBeNull()
  expect(await context.cookies()).toEqual([])
  expect(await page.evaluate(() => [localStorage.length, sessionStorage.length])).toEqual([0, 0])
  expect(externalRequests).toEqual([])
  expect(errors).toEqual([])
})

test('real PDF overflow returns to the right field without losing answers', async ({ page }) => {
  const input = validSubmission()
  input.p1_last_name = 'A'.repeat(160)
  await completeForm(page, input)
  await page.locator('#submit-btn-top').click()
  await expect(page.locator('#form-feedback')).toContainText('too long to fit')
  await expect(page.locator('#completion-next-steps')).toBeHidden()
  await page.getByRole('button', { name: 'Edit the affected details' }).click()
  await expect(page.locator('[name="p1_last_name"]')).toBeFocused()
  await expect(page.locator('[name="p1_address_line1"]')).toHaveValue(input.p1_address_line1)
  await page.locator('[name="p1_last_name"]').fill('Example')
  for (let step = 1; step <= 6; step++) await page.locator('#next-btn').click()
  const responseEvent = page.waitForResponse((response) => response.url().endsWith('/submit'))
  await page.locator('#submit-btn-top').click()
  expect((await responseEvent).status()).toBe(200)
  await expect(page.locator('#form-feedback')).toContainText('PDF is ready')
})

test('overseas address, no family name, unknown birthplace and custom occupation', async ({ page }) => {
  const input = validSubmission()
  Object.assign(input, {
    p1_has_family_name: 'no', p1_last_name: '', p1_birth_country: 'Unknown',
    p1_birth_city: 'Unknown', p1_birth_state: '', p1_occupation: 'Independent Puzzle Designer',
    p1_address_country: 'Hong Kong', p1_address_state: '', p1_address_postcode: '', p1_address_city: '',
  })
  await completeForm(page, input)
  await expect(page.locator('#review-section')).toContainText('Independent Puzzle Designer')
  const responseEvent = page.waitForResponse((response) => response.url().endsWith('/submit'))
  await page.locator('#submit-btn-top').click()
  const response = await responseEvent
  expect(response.status()).toBe(200)
  const pdf = await PDFDocument.load(await response.body())
  expect(pdf.getForm().getTextField('Person1FamilyName').getText()).toBeUndefined()
  expect(pdf.getForm().getTextField('Person1Birthplace').getText()).toBe('Unknown')
})

test('country keyboard selection, invalid country recovery and Australian postcode validation', async ({ page }) => {
  await page.goto('/prepare')
  const country = page.locator('[name="p1_address_country"]')
  await country.fill('Unknown')
  await country.press('Tab')
  await expect(country).toHaveValue('Unknown')
  expect(await country.evaluate((el: HTMLInputElement) => el.checkValidity())).toBe(false)
  await country.fill('austral')
  await country.press('ArrowDown')
  await country.press('Enter')
  await expect(country).toHaveValue('Australia')
  expect(await country.evaluate((el: HTMLInputElement) => el.checkValidity())).toBe(true)
  const postcode = page.locator('[name="p1_address_postcode"]')
  await postcode.fill('abc')
  expect(await postcode.evaluate((el: HTMLInputElement) => el.validationMessage)).toContain('four digits')
  await postcode.fill('0700')
  expect(await postcode.evaluate((el: HTMLInputElement) => el.checkValidity())).toBe(true)
})

test('network failure keeps answers and permits a retry', async ({ page }) => {
  await completeForm(page)
  await page.route('**/submit', (route) => route.abort())
  await page.locator('#submit-btn-top').click()
  await expect(page.locator('#form-feedback')).toBeVisible()
  await expect(page.locator('#submit-btn-top')).toBeEnabled()
  await expect(page.locator('#completion-next-steps')).toBeHidden()
  await page.unroute('**/submit')
  const responseEvent = page.waitForResponse((response) => response.url().endsWith('/submit'))
  await page.locator('#submit-btn-top').click()
  expect((await responseEvent).status()).toBe(200)
})

test('homepage and embeddable notice calculator handle month-end and leap-year dates', async ({ page }) => {
  for (const path of ['/', '/embed/notice-period']) {
    const response = await page.goto(path)
    expect(response?.headers()['cache-control']).toContain('no-transform')
    await page.locator('#notice-received-date').fill('2028-01-31')
    await expect(page.locator('#earliest-marriage-output')).toHaveText('1 March 2028')
    await page.locator('#notice-received-date').fill('2028-07-31')
    await expect(page.locator('#earliest-marriage-output')).toHaveText('31 August 2028')
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  }
})

test('submission boundaries, privacy headers and real rate limit', async ({ request }, testInfo) => {
  const headers = { 'CF-Connecting-IP': `api-${testInfo.project.name}`, Origin: 'http://127.0.0.1:8787' }
  expect((await request.post('/submit', { headers: { ...headers, Origin: 'https://example.com' }, form: validSubmission() })).status()).toBe(403)
  expect((await request.post('/submit', { headers, data: {} })).status()).toBe(415)
  const malformed = await request.post('/submit', { headers: { ...headers, 'Content-Type': 'multipart/form-data' }, data: 'invalid' })
  expect(malformed.status()).toBe(400)
  const invalid = await request.post('/submit', { headers, form: {} })
  expect(invalid.status()).toBe(400)
  expect(invalid.headers()['cache-control']).toContain('no-store')
  for (let index = 0; index < 3; index++) await request.post('/submit', { headers, form: {} })
  const limited = await request.post('/submit', { headers, form: {} })
  expect(limited.status()).toBe(429)
  expect(limited.headers()['retry-after']).toBe('60')
})
