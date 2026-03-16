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
  conditions?: NoimCondition[]
  titleCase?: boolean  // auto-capitalise on blur (e.g. "john smith" → "John Smith")
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
      name: `${prefix}_last_name`,
      label: 'Last name (surname)',
      type: 'text',
      required: true,
      titleCase: true,
      helpText: 'As it appears on your identification documents',
    },
    // Item 3: First name
    {
      name: `${prefix}_first_name`,
      label: 'First name',
      type: 'text',
      required: true,
      titleCase: true,
    },
    // Middle name(s)
    {
      name: `${prefix}_middle_names`,
      label: 'Middle name(s)',
      type: 'text',
      required: false,
      titleCase: true,
      helpText: 'Leave blank if no middle name',
    },
    // Email (optional — for receiving a copy)
    {
      name: `${prefix}_email`,
      label: 'Email address',
      type: 'email',
      required: false,
      helpText: 'Optional — for receiving a copy of your submission',
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
      titleCase: true,
      placeholder: 'e.g. Marketing Manager',
    },
    // Item 6: Place of residence
    {
      name: `${prefix}_address`,
      label: 'Usual place of residence',
      type: 'address',
      required: true,
      helpText: 'Start typing and select from the suggestions',
    },
    // Item 7: Conjugal (marital) status
    {
      name: `${prefix}_conjugal_status`,
      label: 'Conjugal status',
      type: 'select',
      required: true,
      options: CONJUGAL_STATUS_OPTIONS,
    },
    // Conditional: Divorce details
    {
      name: `${prefix}_divorce_date`,
      label: 'Date divorce became final',
      type: 'date',
      required: true,
      conditions: [{ field: `${prefix}_conjugal_status`, operator: 'eq', value: 'divorced' }],
    },
    {
      name: `${prefix}_divorce_court`,
      label: 'Court that granted the divorce',
      type: 'text',
      required: true,
      titleCase: true,
      placeholder: 'e.g. Family Court of Australia, Sydney',
      conditions: [{ field: `${prefix}_conjugal_status`, operator: 'eq', value: 'divorced' }],
    },
    // Conditional: Widowed details
    {
      name: `${prefix}_death_certificate_number`,
      label: 'Death certificate number',
      type: 'text',
      required: true,
      conditions: [{ field: `${prefix}_conjugal_status`, operator: 'eq', value: 'widowed' }],
    },
    {
      name: `${prefix}_spouse_death_date`,
      label: 'Date of death',
      type: 'date',
      required: true,
      conditions: [{ field: `${prefix}_conjugal_status`, operator: 'eq', value: 'widowed' }],
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
      titleCase: true,
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

function singleParentFields(prefix: string, parentPrefix: string, parentLabel: string): NoimField[] {
  return [
    // Current name
    {
      name: `${prefix}_${parentPrefix}_first_name`,
      label: `${parentLabel}'s first name`,
      type: 'text',
      required: false,
      titleCase: true,
      helpText: 'Leave blank if unknown',
    },
    {
      name: `${prefix}_${parentPrefix}_middle_names`,
      label: `${parentLabel}'s middle name(s)`,
      type: 'text',
      required: false,
      titleCase: true,
    },
    {
      name: `${prefix}_${parentPrefix}_last_name`,
      label: `${parentLabel}'s last name (surname)`,
      type: 'text',
      required: false,
      titleCase: true,
    },
    // Has name changed?
    {
      name: `${prefix}_${parentPrefix}_name_changed`,
      label: "Has this parent's name changed since their birth?",
      type: 'radio',
      required: false,
      options: [
        { value: 'no', label: 'No' },
        { value: 'yes', label: 'Yes' },
      ],
    },
    // Birth name (conditional on name_changed=yes)
    {
      name: `${prefix}_${parentPrefix}_birth_first_name`,
      label: `${parentLabel}'s first name at birth`,
      type: 'text',
      required: true,
      titleCase: true,
      conditions: [{ field: `${prefix}_${parentPrefix}_name_changed`, operator: 'eq', value: 'yes' }],
    },
    {
      name: `${prefix}_${parentPrefix}_birth_middle_names`,
      label: `${parentLabel}'s middle name(s) at birth`,
      type: 'text',
      required: false,
      titleCase: true,
      conditions: [{ field: `${prefix}_${parentPrefix}_name_changed`, operator: 'eq', value: 'yes' }],
    },
    {
      name: `${prefix}_${parentPrefix}_birth_last_name`,
      label: `${parentLabel}'s last name at birth`,
      type: 'text',
      required: true,
      titleCase: true,
      conditions: [{ field: `${prefix}_${parentPrefix}_name_changed`, operator: 'eq', value: 'yes' }],
    },
    // Country of birth
    {
      name: `${prefix}_${parentPrefix}_birth_country`,
      label: `${parentLabel}'s country of birth`,
      type: 'country',
      required: false,
    },
  ]
}

function parentFields(prefix: string): NoimField[] {
  return [
    ...singleParentFields(prefix, 'father', "Father / Parent 1"),
    ...singleParentFields(prefix, 'mother', "Mother / Parent 2"),
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
    description: 'Items 11–16 from the NOIM (optional but helpful for the marriage register)',
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
    description: 'Items 11–16 from the NOIM (optional but helpful for the marriage register)',
    fields: parentFields('p2'),
  },
  {
    id: 'relationship',
    title: 'Relationship & Ceremony Details',
    description: 'Item 10 and wedding/ceremony information',
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
      // Wedding/ceremony fields
      {
        name: 'wedding_location',
        label: 'Wedding/ceremony location',
        type: 'address',
        required: true,
        helpText: 'Start typing the venue or location name',
      },
      {
        name: 'wedding_date',
        label: 'Wedding/ceremony date',
        type: 'date',
        required: true,
      },
      {
        name: 'is_international',
        label: 'Is this an international wedding or elopement?',
        type: 'radio',
        required: true,
        options: [
          { value: 'no', label: 'No' },
          { value: 'yes', label: 'Yes' },
        ],
      },
      {
        name: 'international_date',
        label: 'International ceremony date',
        type: 'date',
        required: true,
        conditions: [{ field: 'is_international', operator: 'eq', value: 'yes' }],
      },
      {
        name: 'has_australian_date',
        label: 'Have we organised an Australian date for paperwork?',
        type: 'radio',
        required: true,
        options: [
          { value: 'no', label: 'No' },
          { value: 'yes', label: 'Yes' },
        ],
        conditions: [{ field: 'is_international', operator: 'eq', value: 'yes' }],
      },
      {
        name: 'australian_paperwork_date',
        label: 'Australian paperwork date',
        type: 'date',
        required: true,
        conditions: [{ field: 'has_australian_date', operator: 'eq', value: 'yes' }],
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
    fields: [
      {
        name: 'send_copy',
        label: 'Send me a copy of this submission',
        type: 'checkbox',
        required: false,
        helpText: 'A confirmation will be sent to the email addresses provided above',
      },
    ],
  },
]
