import { COUNTRIES } from '../shared/countries.ts'
import { ageOnDate, isFieldVisible } from './logic.ts'
import { noimSteps, type NoimField } from './schema.ts'

export interface NoimValidationResult {
  valid: boolean
  data: Record<string, string>
  errors: Record<string, string>
}

const fields = noimSteps.flatMap((step) => step.fields)
const countrySet = new Set<string>(COUNTRIES)
const placeholderName = /^(?:n\/?a|none|null|unknown)$/i
const punctuationOnly = /^[-\u2010-\u2015\u2212_.'\u00b7\u2032/\\]+$/u

function isLegalNameField(name: string): boolean {
  return /_(?:first_name|last_name|middle_names|parent[12]_(?:current|birth)_name)$/.test(name)
}

function allowsUnknown(fieldName: string): boolean {
  return /_parent[12]_(?:current|birth)_name$/.test(fieldName)
}

function isValidDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false

  const [, year, month, day] = match.map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day
}

function maxLength(field: NoimField): number {
  if (field.type === 'email') return 254
  if (field.type === 'address' || field.type === 'textarea') return 300
  return 160
}

export function validateNoimSubmission(input: Record<string, unknown>): NoimValidationResult {
  const data: Record<string, string> = {}
  const errors: Record<string, string> = {}

  for (const field of fields) {
    const rawValue = input[field.name]
    if (rawValue === undefined || rawValue === null) {
      data[field.name] = ''
      continue
    }
    if (typeof rawValue !== 'string') {
      errors[field.name] = `${field.label} must be text`
      data[field.name] = ''
      continue
    }
    data[field.name] = rawValue.trim()
  }

  for (const field of fields) {
    const value = data[field.name]
    const visible = isFieldVisible(field.conditions, data)

    if (!visible) {
      data[field.name] = ''
      continue
    }
    if (field.required && !value) {
      errors[field.name] = `${field.label} is required`
      continue
    }
    if (!value) continue

    if (value.length > maxLength(field)) {
      errors[field.name] = `${field.label} is too long`
      continue
    }
    if (/[\u0000-\u001f\u007f]/u.test(value)) {
      errors[field.name] = `${field.label} contains an unsupported control character`
      continue
    }
    if (isLegalNameField(field.name)
      && !(allowsUnknown(field.name) && value.toLowerCase() === 'unknown')
      && (punctuationOnly.test(value) || placeholderName.test(value) || !/\p{L}/u.test(value))) {
      errors[field.name] = `${field.label} must contain a legal name, not punctuation, a dash, or a placeholder`
      continue
    }
    if ((field.type === 'select' || field.type === 'radio')
      && !field.options?.some((option) => option.value === value)) {
      errors[field.name] = `${field.label} has an invalid selection`
      continue
    }
    if (field.type === 'country' && !countrySet.has(value)) {
      errors[field.name] = `${field.label} must be selected from the country list`
      continue
    }
    if (field.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      errors[field.name] = `${field.label} must be a valid email address`
      continue
    }
    if (field.type === 'date' && !isValidDate(value)) {
      errors[field.name] = `${field.label} must be a valid date`
      continue
    }
    if (field.name.endsWith('_dob') && value > new Date().toISOString().slice(0, 10)) {
      errors[field.name] = `${field.label} cannot be in the future`
    }
  }

  const ages = ['p1', 'p2'].map((prefix) => {
    const fieldName = `${prefix}_dob`
    const value = data[fieldName]
    return {
      fieldName,
      age: value && !errors[fieldName] && isValidDate(value) ? ageOnDate(value) : null,
    }
  })

  for (const { fieldName, age } of ages) {
    if (age !== null && age < 16) {
      errors[fieldName] = 'This service cannot accept a party under 16. A person under 16 cannot marry in Australia.'
    }
  }

  const partiesAged16Or17 = ages.filter(({ age }) => age !== null && age >= 16 && age < 18)
  if (partiesAged16Or17.length > 1) {
    for (const { fieldName } of partiesAged16Or17) {
      errors[fieldName] = 'Only one party may be aged 16 or 17. Contact an authorised celebrant.'
    }
  }

  return { valid: Object.keys(errors).length === 0, data, errors }
}

export function safePdfFilename(data: Record<string, string>): string {
  const safePart = (value: string, fallback: string) => {
    const cleaned = value
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/[\u2010-\u2015]/g, '-')
      .replace(/[^A-Za-z0-9'-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 60)
    return cleaned || fallback
  }

  return `NOIM-${safePart(data.p1_last_name || data.p1_first_name, 'Party1')}-${safePart(data.p2_last_name || data.p2_first_name, 'Party2')}.pdf`
}
