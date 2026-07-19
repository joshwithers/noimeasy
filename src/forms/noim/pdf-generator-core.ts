import fontkit from '@pdf-lib/fontkit'
import { PDFDocument, PDFName, type PDFFont } from 'pdf-lib'

export class UnsupportedPdfCharacterError extends Error {
  readonly fieldName: string
  readonly character: string

  constructor(fieldName: string, character: string) {
    super(`The character ${JSON.stringify(character)} in ${fieldName} cannot be rendered safely in the official NOIM PDF`)
    this.name = 'UnsupportedPdfCharacterError'
    this.fieldName = fieldName
    this.character = character
  }
}

function val(data: Record<string, unknown>, key: string): string {
  const value = data[key]
  return value !== undefined && value !== null && value !== '' ? String(value) : ''
}

function setCheckbox(
  form: ReturnType<PDFDocument['getForm']>,
  fieldName: string,
  value: string,
) {
  const field = form.getCheckBox(fieldName)
  const acro = field.acroField
  const widgets = acro.getWidgets()
  const hasValue = widgets.some((widget) => widget.getOnValue()?.decodeText() === value)

  if (!hasValue) {
    throw new Error(`PDF field ${fieldName} does not support value ${value}`)
  }

  acro.dict.set(PDFName.of('V'), PDFName.of(value))
  widgets.forEach((widget) => {
    const onValue = widget.getOnValue()
    widget.dict.set(
      PDFName.of('AS'),
      PDFName.of(onValue?.decodeText() === value ? value : 'Off'),
    )
  })
}

function assertFontSupports(font: PDFFont, value: string, fieldName: string) {
  const supported = new Set(font.getCharacterSet())
  for (const character of value) {
    const codePoint = character.codePointAt(0)
    // pdf-lib/fontkit embeds these glyphs but does not perform the bidirectional
    // ordering and shaping that these scripts require. Reject them rather than
    // silently putting a corrupted legal name into the NOIM.
    const needsRightToLeftLayout = /\p{Script=Arabic}|\p{Script=Hebrew}|\p{Script=Syriac}|\p{Script=Thaana}|\p{Script=Nko}|\p{Script=Adlam}/u.test(character)
    if (needsRightToLeftLayout || (codePoint !== undefined && !supported.has(codePoint))) {
      throw new UnsupportedPdfCharacterError(fieldName, character)
    }
  }
}

function setTextField(
  form: ReturnType<PDFDocument['getForm']>,
  font: PDFFont,
  fieldName: string,
  value: string,
) {
  if (!value) return

  assertFontSupports(font, value, fieldName)
  const field = form.getTextField(fieldName)
  field.setText(value)
  field.updateAppearances(font)
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateStr)
  if (!match) return dateStr

  const [, year, month, day] = match
  const monthName = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ][Number(month) - 1]

  return `${Number(day)} ${monthName} ${year}`
}

function formatBirthplace(data: Record<string, unknown>, prefix: string): string {
  const country = val(data, `${prefix}_birth_country`)
  const city = val(data, `${prefix}_birth_city`)

  if (country === 'Australia') {
    return [city, val(data, `${prefix}_birth_state`), 'Australia'].filter(Boolean).join(', ')
  }

  return [city, val(data, `${prefix}_birth_state_international`), country].filter(Boolean).join(', ')
}

function mapDescription(value: string): string {
  switch (value) {
    case 'partner': return 'Partner'
    case 'bride': return 'Bride'
    case 'groom': return 'Groom'
    default: return ''
  }
}

function mapGender(value: string): string {
  switch (value) {
    case 'female': return 'Female'
    case 'male': return 'Male'
    case 'non-binary': return 'Non-binary'
    default: return ''
  }
}

function mapConjugalStatus(value: string): string {
  switch (value) {
    case 'never_married': return 'Never validly married'
    case 'divorced': return 'Divorced'
    case 'widowed': return 'Widowed'
    case 'divorce_pending': return 'Divorce pending'
    default: return ''
  }
}

export async function generateNoimPdfFromAssets(
  data: Record<string, unknown>,
  templateBytes: ArrayBuffer | Uint8Array,
  unicodeFontBytes: ArrayBuffer | Uint8Array,
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(templateBytes)
  doc.registerFontkit(fontkit)
  const font = await doc.embedFont(unicodeFontBytes, { subset: true })
  const form = doc.getForm()

  const p1Description = mapDescription(val(data, 'p1_description'))
  if (p1Description) setCheckbox(form, 'Person 1 Description', p1Description)
  setTextField(form, font, 'Person1FamilyName', val(data, 'p1_last_name'))
  setTextField(form, font, 'Person1GivenName', [val(data, 'p1_first_name'), val(data, 'p1_middle_names')].filter(Boolean).join(' '))
  setTextField(form, font, 'Person1UsualOccupation', val(data, 'p1_occupation'))
  setTextField(form, font, 'Person1PlaceOfResidence', val(data, 'p1_address'))
  setTextField(form, font, 'Person1Birthplace', formatBirthplace(data, 'p1'))
  setTextField(form, font, 'Person1DateOfBirth', formatDate(val(data, 'p1_dob')))

  const p1Gender = mapGender(val(data, 'p1_gender'))
  if (p1Gender) setCheckbox(form, 'Person 1 Gender', p1Gender)
  const p1Conjugal = mapConjugalStatus(val(data, 'p1_conjugal_status'))
  if (p1Conjugal) setCheckbox(form, 'Person1ConjugalStatus', p1Conjugal)

  setTextField(form, font, 'Person1Parent1FullCurrentName', val(data, 'p1_parent1_current_name'))
  setTextField(form, font, 'Person1Parent1FullBirthName', val(data, 'p1_parent1_birth_name'))
  setTextField(form, font, 'Person1Parent1CountryofBirth', val(data, 'p1_parent1_birth_country'))
  if (val(data, 'p1_parent2_applicable') === 'yes') {
    setTextField(form, font, 'Person1Parent2FullCurrentName', val(data, 'p1_parent2_current_name'))
    setTextField(form, font, 'Person1Parent2FullBirthName', val(data, 'p1_parent2_birth_name'))
    setTextField(form, font, 'Person1Parent2CountryofBirth', val(data, 'p1_parent2_birth_country'))
  }

  const p2Description = mapDescription(val(data, 'p2_description'))
  if (p2Description) setCheckbox(form, 'Person 2 Description', p2Description)
  setTextField(form, font, 'Person2FamilyName', val(data, 'p2_last_name'))
  setTextField(form, font, 'Person2GivenName', [val(data, 'p2_first_name'), val(data, 'p2_middle_names')].filter(Boolean).join(' '))
  setTextField(form, font, 'Person2UsualOccupation', val(data, 'p2_occupation'))
  setTextField(form, font, 'Person2PlaceOfResidence', val(data, 'p2_address'))
  setTextField(form, font, 'Person2Birthplace', formatBirthplace(data, 'p2'))
  setTextField(form, font, 'Person2DateOfBirth', formatDate(val(data, 'p2_dob')))

  const p2Gender = mapGender(val(data, 'p2_gender'))
  if (p2Gender) setCheckbox(form, 'Person 2 Gender', p2Gender)
  const p2Conjugal = mapConjugalStatus(val(data, 'p2_conjugal_status'))
  if (p2Conjugal) setCheckbox(form, 'Person2ConjugalStatus', p2Conjugal)

  setTextField(form, font, 'Person2Parent1FullCurrentName', val(data, 'p2_parent1_current_name'))
  setTextField(form, font, 'Person2Parent1FullBirthName', val(data, 'p2_parent1_birth_name'))
  setTextField(form, font, 'Person2Parent1CountryofBirth', val(data, 'p2_parent1_birth_country'))
  if (val(data, 'p2_parent2_applicable') === 'yes') {
    setTextField(form, font, 'Person2Parent2FullCurrentName', val(data, 'p2_parent2_current_name'))
    setTextField(form, font, 'Person2Parent2FullBirthName', val(data, 'p2_parent2_birth_name'))
    setTextField(form, font, 'Person2Parent2CountryofBirth', val(data, 'p2_parent2_birth_country'))
  }

  const related = val(data, 'parties_related')
  if (related === 'yes') {
    setCheckbox(form, 'AreThePartiesRelated', 'Yes')
    setTextField(form, font, 'RelatedPartiesRelationship', val(data, 'relationship_details'))
  } else if (related === 'no') {
    setCheckbox(form, 'AreThePartiesRelated', 'No')
  }

  // The celebrant-only, witness, signature and registry fields stay blank and interactive.
  return await doc.save({ updateFieldAppearances: false })
}
