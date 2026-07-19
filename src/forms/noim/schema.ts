// NOIM (Notice of Intended Marriage) — Form Schema
// Based on the Australian Marriage Act 1961, Section 42

export interface NoimField {
  name: string
  label: string
  type: 'text' | 'email' | 'select' | 'date' | 'textarea' | 'address' | 'radio' | 'checkbox' | 'country'
  required: boolean
  options?: { value: string; label: string }[]
  placeholder?: string
  helpText?: string
  defaultValue?: string
  conditions?: NoimCondition[]
}

export interface NoimCondition {
  field: string        // which field to check
  operator: 'eq' | 'neq' | 'in'
  value: string | string[]
}

export interface NoimStep {
  id: string
  title: string
  description?: string
  fields: NoimField[]
}

// Australian states/territories
const AU_STATES = [
  { value: 'NSW', label: 'New South Wales' },
  { value: 'VIC', label: 'Victoria' },
  { value: 'QLD', label: 'Queensland' },
  { value: 'WA', label: 'Western Australia' },
  { value: 'SA', label: 'South Australia' },
  { value: 'TAS', label: 'Tasmania' },
  { value: 'ACT', label: 'Australian Capital Territory' },
  { value: 'NT', label: 'Northern Territory' },
]

const DESCRIPTION_OPTIONS = [
  { value: 'partner', label: 'Partner' },
  { value: 'bride', label: 'Bride' },
  { value: 'groom', label: 'Groom' },
]

const GENDER_OPTIONS = [
  { value: '', label: 'Prefer not to say' },
  { value: 'female', label: 'Female' },
  { value: 'male', label: 'Male' },
  { value: 'non-binary', label: 'Non-binary' },
]

const CONJUGAL_STATUS_OPTIONS = [
  { value: 'never_married', label: 'Never validly married' },
  { value: 'divorced', label: 'Divorced' },
  { value: 'widowed', label: 'Widowed' },
  { value: 'divorce_pending', label: 'Divorce pending' },
]

function partyFields(prefix: string, partyLabel: string): NoimField[] {
  return [
    // Item 1: Description
    {
      name: `${prefix}_description`,
      label: `How would ${partyLabel} like to be described?`,
      type: 'select',
      required: true,
      options: DESCRIPTION_OPTIONS,
    },
    // Item 2: Last name (surname)
    {
      name: `${prefix}_has_family_name`,
      label: `Does ${partyLabel}'s legal name include a family name?`,
      type: 'radio',
      required: true,
      defaultValue: 'yes',
      options: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No — this person does not have a family name' },
      ],
      helpText: 'Check the birth certificate, change-of-name certificate or other document supporting the legal name',
    },
    {
      name: `${prefix}_last_name`,
      label: 'Last name (surname)',
      type: 'text',
      required: true,
      helpText: 'Enter it exactly as it appears on the document supporting the legal name. Do not enter a dash or placeholder.',
      conditions: [{ field: `${prefix}_has_family_name`, operator: 'eq', value: 'yes' }],
    },
    // Item 3: Given name(s)
    {
      name: `${prefix}_first_name`,
      label: 'First given name',
      type: 'text',
      required: true,
      helpText: 'Enter it exactly as it appears on the document supporting the legal name',
    },
    // Additional given name(s)
    {
      name: `${prefix}_middle_names`,
      label: 'Additional given name(s)',
      type: 'text',
      required: false,
      helpText: 'Include every given name shown on the document supporting your legal name; leave blank only if none',
    },
    // Item 4: Gender (optional)
    {
      name: `${prefix}_gender`,
      label: 'Gender',
      type: 'select',
      required: false,
      options: GENDER_OPTIONS,
      helpText: 'Optional — you may leave this blank',
    },
    // Item 5: Occupation
    {
      name: `${prefix}_occupation`,
      label: 'Usual occupation',
      type: 'text',
      required: true,
      placeholder: 'e.g. Marketing Manager',
    },
    // Item 6: Place of residence
    {
      name: `${prefix}_address`,
      label: 'Usual place of residence',
      type: 'address',
      required: true,
    },
    // Item 7: Conjugal (marital) status
    {
      name: `${prefix}_conjugal_status`,
      label: 'Conjugal status',
      type: 'select',
      required: true,
      options: CONJUGAL_STATUS_OPTIONS,
    },
    // Item 8: Birthplace
    {
      name: `${prefix}_birth_country`,
      label: 'Country of birth',
      type: 'country',
      required: true,
    },
    {
      name: `${prefix}_birth_city`,
      label: 'City/town of birth',
      type: 'text',
      required: true,
    },
    {
      name: `${prefix}_birth_state`,
      label: 'State/territory of birth',
      type: 'select',
      required: true,
      options: AU_STATES,
      conditions: [{ field: `${prefix}_birth_country`, operator: 'eq', value: 'Australia' }],
    },
    {
      name: `${prefix}_birth_state_international`,
      label: 'State/province of birth',
      type: 'text',
      required: false,
      conditions: [{ field: `${prefix}_birth_country`, operator: 'neq', value: 'Australia' }],
    },
    // Item 9: Date of birth
    {
      name: `${prefix}_dob`,
      label: 'Date of birth',
      type: 'date',
      required: true,
    },
  ]
}

function parentFields(prefix: string): NoimField[] {
  return [
    {
      name: `${prefix}_parent1_current_name`,
      label: "Parent 1's full current name",
      type: 'text',
      required: true,
      helpText: "If it cannot be found after reasonable inquiry, enter 'Unknown'",
    },
    {
      name: `${prefix}_parent1_birth_name`,
      label: "Parent 1's full birth name",
      type: 'text',
      required: true,
      helpText: "If it cannot be found after reasonable inquiry, enter 'Unknown'",
    },
    {
      name: `${prefix}_parent1_birth_country`,
      label: "Parent 1's country of birth",
      type: 'text',
      required: true,
      helpText: "If it cannot be found after reasonable inquiry, enter 'Unknown'",
    },
    {
      name: `${prefix}_parent2_applicable`,
      label: 'Is there a Parent 2 to include on the NOIM?',
      type: 'radio',
      required: true,
      options: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No / not applicable' },
      ],
    },
    {
      name: `${prefix}_parent2_current_name`,
      label: "Parent 2's full current name",
      type: 'text',
      required: true,
      helpText: "If it cannot be found after reasonable inquiry, enter 'Unknown'",
      conditions: [{ field: `${prefix}_parent2_applicable`, operator: 'eq', value: 'yes' }],
    },
    {
      name: `${prefix}_parent2_birth_name`,
      label: "Parent 2's full birth name",
      type: 'text',
      required: true,
      helpText: "If it cannot be found after reasonable inquiry, enter 'Unknown'",
      conditions: [{ field: `${prefix}_parent2_applicable`, operator: 'eq', value: 'yes' }],
    },
    {
      name: `${prefix}_parent2_birth_country`,
      label: "Parent 2's country of birth",
      type: 'text',
      required: true,
      helpText: "If it cannot be found after reasonable inquiry, enter 'Unknown'",
      conditions: [{ field: `${prefix}_parent2_applicable`, operator: 'eq', value: 'yes' }],
    },
  ]
}

export const noimSteps: NoimStep[] = [
  {
    id: 'party1-personal',
    title: 'Party 1 — Personal Details',
    description: 'Items 1–9 from the NOIM for the first party',
    fields: partyFields('p1', 'Party 1'),
  },
  {
    id: 'party1-parents',
    title: 'Party 1 — Parent Details',
    description: "Items 11–16 from the NOIM. Enter 'Unknown' if Parent 1 information cannot be found after reasonable inquiry; Parent 2 is completed only if applicable.",
    fields: parentFields('p1'),
  },
  {
    id: 'party2-personal',
    title: 'Party 2 — Personal Details',
    description: 'Items 1–9 from the NOIM for the second party',
    fields: partyFields('p2', 'Party 2'),
  },
  {
    id: 'party2-parents',
    title: 'Party 2 — Parent Details',
    description: "Items 11–16 from the NOIM. Enter 'Unknown' if Parent 1 information cannot be found after reasonable inquiry; Parent 2 is completed only if applicable.",
    fields: parentFields('p2'),
  },
  {
    id: 'relationship',
    title: 'Relationship Details',
    description: 'Item 10 from the NOIM',
    fields: [
      {
        name: 'parties_related',
        label: 'Are the parties related to each other?',
        type: 'radio',
        required: true,
        options: [
          { value: 'no', label: 'No' },
          { value: 'yes', label: 'Yes' },
        ],
      },
      {
        name: 'relationship_details',
        label: 'If yes, describe the relationship',
        type: 'text',
        required: true,
        helpText: 'Note: marriage between certain close relatives is prohibited under the Marriage Act',
        conditions: [{ field: 'parties_related', operator: 'eq', value: 'yes' }],
      },
    ],
  },
  {
    id: 'documents',
    title: 'Document Checklist',
    description: 'Based on your answers, here are the documents you will need to bring to your celebrant. You do not need to upload anything here.',
    fields: [],  // This step is informational only — no input fields
  },
  {
    id: 'review',
    title: 'Review & Submit',
    description: 'Please review all your details before submitting',
    fields: [],
  },
]
