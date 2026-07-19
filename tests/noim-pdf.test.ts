import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { PDFDocument } from 'pdf-lib'
import {
  generateNoimPdfFromAssets,
  PdfFieldOverflowError,
  UnsupportedPdfCharacterError,
} from '../src/forms/noim/pdf-generator-core.ts'

const templateBytes = readFileSync(new URL('../src/forms/noim/noim-blank.pdf', import.meta.url))
const fontBytes = readFileSync(new URL('../node_modules/dejavu-fonts-ttf/ttf/DejaVuSans.ttf', import.meta.url))

function validSubmission(): Record<string, string> {
  return {
    p1_description: 'partner', p1_has_family_name: 'yes', p1_last_name: "O'NEILL",
    p1_first_name: 'Alex', p1_middle_names: 'Quinn', p1_gender: 'non-binary',
    p1_occupation: 'Engineer', p1_address: '1 Example Street, Melbourne VIC 3000',
    p1_conjugal_status: 'divorce_pending', p1_birth_country: 'Australia',
    p1_birth_city: 'Melbourne', p1_birth_state: 'VIC', p1_birth_state_international: '',
    p1_dob: '1990-02-28', p1_parent1_current_name: 'Unknown',
    p1_parent1_birth_name: 'Unknown', p1_parent1_birth_country: 'Unknown',
    p1_parent2_applicable: 'no',
    p2_description: 'groom', p2_has_family_name: 'yes', p2_last_name: 'Nguyen',
    p2_first_name: 'Sam', p2_middle_names: '', p2_gender: '', p2_occupation: 'Teacher',
    p2_address: '2 Example Road, Sydney NSW 2000', p2_conjugal_status: 'never_married',
    p2_birth_country: 'New Zealand', p2_birth_city: 'Auckland', p2_birth_state: '',
    p2_birth_state_international: 'Auckland', p2_dob: '1992-07-09',
    p2_parent1_current_name: 'Taylor Nguyen', p2_parent1_birth_name: 'Taylor Smith',
    p2_parent1_birth_country: 'New Zealand', p2_parent2_applicable: 'yes',
    p2_parent2_current_name: 'Jordan Nguyen', p2_parent2_birth_name: 'Jordan Nguyen',
    p2_parent2_birth_country: 'New Zealand', parties_related: 'no', relationship_details: '',
  }
}

test('fills the attached official 81-field, five-page form and preserves broad Unicode names', async () => {
  const input = validSubmission()
  input.p1_last_name = 'Marín-Παπαδόπουλος'
  input.p1_first_name = 'Łukasz'
  input.p1_middle_names = 'Дмитрий'
  input.p1_parent1_current_name = 'Zoë Šimůnek'

  const bytes = await generateNoimPdfFromAssets(input, templateBytes, fontBytes)
  const pdf = await PDFDocument.load(bytes)
  const form = pdf.getForm()

  assert.equal(pdf.getPageCount(), 5)
  assert.equal(form.getFields().length, 81)
  assert.equal(form.getTextField('Person1FamilyName').getText(), 'Marín-Παπαδόπουλος')
  assert.equal(form.getTextField('Person1GivenName').getText(), 'Łukasz Дмитрий')
  assert.equal(form.getTextField('Person1Parent1FullCurrentName').getText(), 'Zoë Šimůnek')

  for (const celebrantField of [
    'FullNameofCelebrant',
    'CelebrantAuthorisationNumber',
    'CelebrantDateMarriageSolemnised',
    'CelebrantLocation',
  ]) {
    assert.equal(form.getTextField(celebrantField).getText(), undefined)
  }
})

test('leaves the official family-name item blank when a party has no family name', async () => {
  const input = validSubmission()
  input.p1_has_family_name = 'no'
  input.p1_last_name = ''
  input.p1_first_name = 'Jean'
  input.p1_middle_names = 'Baptiste Emanuel'

  const bytes = await generateNoimPdfFromAssets(input, templateBytes, fontBytes)
  const form = (await PDFDocument.load(bytes)).getForm()
  assert.equal(form.getTextField('Person1FamilyName').getText(), undefined)
  assert.equal(form.getTextField('Person1GivenName').getText(), 'Jean Baptiste Emanuel')
})

test('rejects an unsupported PDF glyph instead of crashing or producing a missing-glyph box', async () => {
  for (const unsupportedName of ['李', 'محمد', 'שָׁלוֹם']) {
    const input = validSubmission()
    input.p1_last_name = unsupportedName

    await assert.rejects(
      () => generateNoimPdfFromAssets(input, templateBytes, fontBytes),
      (error: unknown) => error instanceof UnsupportedPdfCharacterError
        && error.fieldName === 'Person1FamilyName',
    )
  }
})

test('shrinks long values to a legible size instead of clipping them', async () => {
  const input = validSubmission()
  input.p1_last_name = 'Alexandria-Montgomery-Worthington-Smythe-Cavendish'

  const bytes = await generateNoimPdfFromAssets(input, templateBytes, fontBytes)
  const field = (await PDFDocument.load(bytes)).getForm().getTextField('Person1FamilyName')
  assert.equal(field.getText(), input.p1_last_name)
  const appearance = field.acroField.getDefaultAppearance() || ''
  const fontSize = Number(/\/DejaVuSans\s+([\d.]+)\s+Tf/.exec(appearance)?.[1])
  assert.equal(fontSize >= 6 && fontSize < 8, true, appearance)
})

test('rejects accepted-length values that cannot fit the official field legibly', async () => {
  const input = validSubmission()
  input.p1_last_name = 'A'.repeat(160)

  await assert.rejects(
    () => generateNoimPdfFromAssets(input, templateBytes, fontBytes),
    (error: unknown) => error instanceof PdfFieldOverflowError
      && error.fieldName === 'Person1FamilyName',
  )
})

test('does not repeat unknown birthplace particulars in the official field', async () => {
  const input = validSubmission()
  input.p1_birth_country = 'Unknown'
  input.p1_birth_city = 'Unknown'
  input.p1_birth_state_international = ''

  const bytes = await generateNoimPdfFromAssets(input, templateBytes, fontBytes)
  const field = (await PDFDocument.load(bytes)).getForm().getTextField('Person1Birthplace')
  assert.equal(field.getText(), 'Unknown')
})
