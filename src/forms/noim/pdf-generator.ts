import { PDFDocument, PDFName } from 'pdf-lib'
import noimPdfBytes from './noim-blank.pdf'

// Helper to get a string value from submission data
function val(data: Record<string, unknown>, key: string): string {
  const v = data[key]
  return v !== undefined && v !== null && v !== '' ? String(v) : ''
}

// Set a radio-like checkbox field by directly writing the V and AS values
function setCheckbox(
  form: ReturnType<PDFDocument['getForm']>,
  fieldName: string,
  value: string
) {
  try {
    const field = form.getCheckBox(fieldName)
    const acro = field.acroField
    const widgets = acro.getWidgets()

    // Set field value
    acro.dict.set(PDFName.of('V'), PDFName.of(value))

    // Update each widget's appearance state
    widgets.forEach((w) => {
      const onValue = w.getOnValue()
      if (onValue && onValue.decodeText() === value) {
        w.dict.set(PDFName.of('AS'), PDFName.of(value))
      } else {
        w.dict.set(PDFName.of('AS'), PDFName.of('Off'))
      }
    })
  } catch {
    // Field not found or invalid — skip silently
  }
}

// Set a text field value
function setTextField(
  form: ReturnType<PDFDocument['getForm']>,
  fieldName: string,
  value: string
) {
  try {
    if (value) {
      form.getTextField(fieldName).setText(value)
    }
  } catch {
    // Field not found — skip silently
  }
}

function formatDate(dateStr: string): string {
  if (!dateStr) return ''
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function formatBirthplace(data: Record<string, unknown>, prefix: string): string {
  const country = val(data, `${prefix}_birth_country`)
  const city = val(data, `${prefix}_birth_city`)

  if (country === 'Australia') {
    const state = val(data, `${prefix}_birth_state`)
    return [city, state, 'Australia'].filter(Boolean).join(', ')
  } else {
    const state = val(data, `${prefix}_birth_state_international`)
    return [city, state, country].filter(Boolean).join(', ')
  }
}

// Map our description values to PDF appearance names
function mapDescription(value: string): string {
  switch (value) {
    case 'partner': return 'Partner'
    case 'bride': return 'Bride'
    case 'groom': return 'Groom'
    default: return ''
  }
}

// Map our gender values to PDF appearance names
function mapGender(value: string): string {
  switch (value) {
    case 'female': return 'Female'
    case 'male': return 'Male'
    case 'non-binary': return 'Non-binary'
    default: return ''
  }
}

// Map our conjugal status to PDF appearance names
function mapConjugalStatus(value: string): string {
  switch (value) {
    case 'never_married': return 'Never validly married'
    case 'divorced': return 'Divorced'
    case 'widowed': return 'Widowed'
    default: return ''
  }
}

export async function generateNoimPdf(
  data: Record<string, unknown>
): Promise<Uint8Array> {
  const doc = await PDFDocument.load(noimPdfBytes)
  const form = doc.getForm()

  // ── Party 1 ──────────────────────────────────────────────

  // Description (checkbox group: Partner / Bride / Groom)
  const p1Desc = mapDescription(val(data, 'p1_description'))
  if (p1Desc) setCheckbox(form, 'Person 1 Description', p1Desc)

  // Text fields — assemble given names from first + middle
  setTextField(form, 'Person1FamilyName', val(data, 'p1_last_name'))
  setTextField(form, 'Person1GivenName', [val(data, 'p1_first_name'), val(data, 'p1_middle_names')].filter(Boolean).join(' '))
  setTextField(form, 'Person1UsualOccupation', val(data, 'p1_occupation'))
  setTextField(form, 'Person1PlaceOfResidence', val(data, 'p1_address'))
  setTextField(form, 'Person1Birthplace', formatBirthplace(data, 'p1'))
  setTextField(form, 'Person1DateOfBirth', formatDate(val(data, 'p1_dob')))

  // Gender (checkbox group: Female / Male / Non-binary)
  const p1Gender = mapGender(val(data, 'p1_gender'))
  if (p1Gender) setCheckbox(form, 'Person 1 Gender', p1Gender)

  // Conjugal status (checkbox group)
  const p1Conjugal = mapConjugalStatus(val(data, 'p1_conjugal_status'))
  if (p1Conjugal) setCheckbox(form, 'Person1ConjugalStatus', p1Conjugal)

  // Divorce/widowed details for celebrant section
  if (val(data, 'p1_conjugal_status') === 'divorced') {
    setTextField(form, 'Person1CourtDivorceNullity', val(data, 'p1_divorce_court'))
    setTextField(form, 'Person1DateMarriageEnded', formatDate(val(data, 'p1_divorce_date')))
  }
  if (val(data, 'p1_conjugal_status') === 'widowed') {
    setTextField(form, 'Person1DeathCertificate', val(data, 'p1_death_certificate_number'))
    setTextField(form, 'Person1DateMarriageEnded', formatDate(val(data, 'p1_spouse_death_date')))
  }

  // Party 1 parents — assemble full names from first + middle + last
  const p1FatherName = [val(data, 'p1_father_first_name'), val(data, 'p1_father_middle_names'), val(data, 'p1_father_last_name')].filter(Boolean).join(' ')
  setTextField(form, 'Person1Parent1FullCurrentName', p1FatherName)
  if (val(data, 'p1_father_name_changed') === 'yes') {
    const p1FatherBirth = [val(data, 'p1_father_birth_first_name'), val(data, 'p1_father_birth_middle_names'), val(data, 'p1_father_birth_last_name')].filter(Boolean).join(' ')
    setTextField(form, 'Person1Parent1FullBirthName', p1FatherBirth)
  }
  setTextField(form, 'Person1Parent1CountryofBirth', val(data, 'p1_father_birth_country'))

  const p1MotherName = [val(data, 'p1_mother_first_name'), val(data, 'p1_mother_middle_names'), val(data, 'p1_mother_last_name')].filter(Boolean).join(' ')
  setTextField(form, 'Person1Parent2FullCurrentName', p1MotherName)
  if (val(data, 'p1_mother_name_changed') === 'yes') {
    const p1MotherBirth = [val(data, 'p1_mother_birth_first_name'), val(data, 'p1_mother_birth_middle_names'), val(data, 'p1_mother_birth_last_name')].filter(Boolean).join(' ')
    setTextField(form, 'Person1Parent2FullBirthName', p1MotherBirth)
  }
  setTextField(form, 'Person1Parent2CountryofBirth', val(data, 'p1_mother_birth_country'))

  // ── Party 2 ──────────────────────────────────────────────

  // Description
  const p2Desc = mapDescription(val(data, 'p2_description'))
  if (p2Desc) setCheckbox(form, 'Person 2 Description', p2Desc)

  // Text fields — assemble given names from first + middle
  setTextField(form, 'Person2FamilyName', val(data, 'p2_last_name'))
  setTextField(form, 'Person2GivenName', [val(data, 'p2_first_name'), val(data, 'p2_middle_names')].filter(Boolean).join(' '))
  setTextField(form, 'Person2UsualOccupation', val(data, 'p2_occupation'))
  setTextField(form, 'Person2PlaceOfResidence', val(data, 'p2_address'))
  setTextField(form, 'Person2Birthplace', formatBirthplace(data, 'p2'))
  setTextField(form, 'Person2DateOfBirth', formatDate(val(data, 'p2_dob')))

  // Gender
  const p2Gender = mapGender(val(data, 'p2_gender'))
  if (p2Gender) setCheckbox(form, 'Person 2 Gender', p2Gender)

  // Conjugal status
  const p2Conjugal = mapConjugalStatus(val(data, 'p2_conjugal_status'))
  if (p2Conjugal) setCheckbox(form, 'Person2ConjugalStatus', p2Conjugal)

  // Divorce/widowed details
  if (val(data, 'p2_conjugal_status') === 'divorced') {
    setTextField(form, 'Person2CourtDivorceNullity', val(data, 'p2_divorce_court'))
    setTextField(form, 'Person2DateMarriageEnded', formatDate(val(data, 'p2_divorce_date')))
  }
  if (val(data, 'p2_conjugal_status') === 'widowed') {
    setTextField(form, 'Person2DeathCertificate', val(data, 'p2_death_certificate_number'))
    setTextField(form, 'Person2DateMarriageEnded', formatDate(val(data, 'p2_spouse_death_date')))
  }

  // Party 2 parents — assemble full names from first + middle + last
  const p2FatherName = [val(data, 'p2_father_first_name'), val(data, 'p2_father_middle_names'), val(data, 'p2_father_last_name')].filter(Boolean).join(' ')
  setTextField(form, 'Person2Parent1FullCurrentName', p2FatherName)
  if (val(data, 'p2_father_name_changed') === 'yes') {
    const p2FatherBirth = [val(data, 'p2_father_birth_first_name'), val(data, 'p2_father_birth_middle_names'), val(data, 'p2_father_birth_last_name')].filter(Boolean).join(' ')
    setTextField(form, 'Person2Parent1FullBirthName', p2FatherBirth)
  }
  setTextField(form, 'Person2Parent1CountryofBirth', val(data, 'p2_father_birth_country'))

  const p2MotherName = [val(data, 'p2_mother_first_name'), val(data, 'p2_mother_middle_names'), val(data, 'p2_mother_last_name')].filter(Boolean).join(' ')
  setTextField(form, 'Person2Parent2FullCurrentName', p2MotherName)
  if (val(data, 'p2_mother_name_changed') === 'yes') {
    const p2MotherBirth = [val(data, 'p2_mother_birth_first_name'), val(data, 'p2_mother_birth_middle_names'), val(data, 'p2_mother_birth_last_name')].filter(Boolean).join(' ')
    setTextField(form, 'Person2Parent2FullBirthName', p2MotherBirth)
  }
  setTextField(form, 'Person2Parent2CountryofBirth', val(data, 'p2_mother_birth_country'))

  // ── Relationship ─────────────────────────────────────────

  const related = val(data, 'parties_related')
  if (related === 'yes') {
    setCheckbox(form, 'AreThePartiesRelated', 'Yes')
    setTextField(form, 'RelatedPartiesRelationship', val(data, 'relationship_details'))
  } else if (related === 'no') {
    setCheckbox(form, 'AreThePartiesRelated', 'No')
  }

  // Flatten the form so fields appear as printed text
  form.flatten()

  return await doc.save()
}
