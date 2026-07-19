import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { noimSteps } from '../src/forms/noim/schema.ts'
import { ageOnDate, generateDocumentChecklist, getNoimClientScript } from '../src/forms/noim/logic.ts'
import { addressSearchQuery, formatAustralianAddress, formatNominatimResults } from '../src/forms/noim/address.ts'
import { safePdfFilename, validateNoimSubmission } from '../src/forms/noim/validation.ts'

function validSubmission(): Record<string, string> {
  return {
    p1_description: 'partner',
    p1_has_family_name: 'yes',
    p1_last_name: "O'NEILL",
    p1_first_name: 'Alex',
    p1_middle_names: 'Quinn',
    p1_gender: 'non-binary',
    p1_occupation: 'Engineer',
    p1_address: '1 Example Street, Melbourne VIC 3000',
    p1_conjugal_status: 'divorce_pending',
    p1_birth_country: 'Australia',
    p1_birth_city: 'Melbourne',
    p1_birth_state: 'VIC',
    p1_birth_state_international: '',
    p1_dob: '1990-02-28',
    p1_parent1_current_name: 'Unknown',
    p1_parent1_birth_name: 'Unknown',
    p1_parent1_birth_country: 'Unknown',
    p1_parent2_applicable: 'no',
    p2_description: 'groom',
    p2_has_family_name: 'yes',
    p2_last_name: 'Nguyen',
    p2_first_name: 'Sam',
    p2_middle_names: '',
    p2_gender: '',
    p2_occupation: 'Teacher',
    p2_address: '2 Example Road, Sydney NSW 2000',
    p2_conjugal_status: 'never_married',
    p2_birth_country: 'New Zealand',
    p2_birth_city: 'Auckland',
    p2_birth_state: '',
    p2_birth_state_international: 'Auckland',
    p2_dob: '1992-07-09',
    p2_parent1_current_name: 'Taylor Nguyen',
    p2_parent1_birth_name: 'Taylor Smith',
    p2_parent1_birth_country: 'New Zealand',
    p2_parent2_applicable: 'yes',
    p2_parent2_current_name: 'Jordan Nguyen',
    p2_parent2_birth_name: 'Jordan Nguyen',
    p2_parent2_birth_country: 'New Zealand',
    parties_related: 'no',
    relationship_details: '',
  }
}

function dateForAge(age: number): string {
  const today = new Date()
  const date = new Date(Date.UTC(today.getUTCFullYear() - age, today.getUTCMonth(), today.getUTCDate()))
  return date.toISOString().slice(0, 10)
}

const georgeStreetResult = {
  display_name: 'AGL Energy Limited, 200, George Street, Quay Quarter, Sydney, Sydney CBD, Sydney, New South Wales, 2000, Australia',
  address: {
    office: 'AGL Energy Limited',
    house_number: '200',
    road: 'George Street',
    neighbourhood: 'Quay Quarter',
    suburb: 'Sydney',
    city: 'Sydney',
    state: 'New South Wales',
    'ISO3166-2-lvl4': 'AU-NSW',
    postcode: '2000',
    country: 'Australia',
    country_code: 'au',
  },
}

test('formats API addresses in Australian postal order', () => {
  assert.equal(formatAustralianAddress(georgeStreetResult), '200 George Street, SYDNEY NSW 2000')
  assert.equal(
    formatAustralianAddress(georgeStreetResult, 'Unit 5, 200 George Street Sydney'),
    'Unit 5, 200 George Street, SYDNEY NSW 2000',
  )
  assert.equal(
    formatAustralianAddress(georgeStreetResult, '5/200 George Street Sydney'),
    '5/200 George Street, SYDNEY NSW 2000',
  )
})

test('searches without an Australian unit prefix while preserving it for display', () => {
  assert.equal(addressSearchQuery('Unit 5, 200 George Street Sydney'), '200 George Street Sydney')
  assert.equal(addressSearchQuery('5/200 George Street Sydney'), '200 George Street Sydney')
  assert.equal(addressSearchQuery('200 George Street Sydney'), '200 George Street Sydney')
})

test('keeps overseas formatting and deduplicates Australian API results', () => {
  const overseas = {
    display_name: '10, Downing Street, Westminster, London, Greater London, England, SW1A 2AA, United Kingdom',
    address: { country: 'United Kingdom', country_code: 'gb' },
  }
  assert.equal(formatAustralianAddress(overseas), overseas.display_name)
  assert.deepEqual(
    formatNominatimResults(
      [georgeStreetResult, { ...georgeStreetResult, display_name: `EY Centre, ${georgeStreetResult.display_name}` }],
      '200 George Street Sydney',
    ).map((result) => result.formatted_name),
    ['200 George Street, SYDNEY NSW 2000'],
  )
})

test('accepts every official conjugal status, including divorce pending', () => {
  for (const status of ['never_married', 'divorced', 'widowed', 'divorce_pending']) {
    const input = validSubmission()
    input.p1_conjugal_status = status
    const result = validateNoimSubmission(input)
    assert.equal(result.valid, true, JSON.stringify(result.errors))
    assert.equal(result.data.p1_conjugal_status, status)
  }
})

test('requires official fields and conditionally requires relationship and Parent 2 details', () => {
  const input = validSubmission()
  input.p1_last_name = ''
  input.parties_related = 'yes'
  input.relationship_details = ''
  input.p1_parent2_applicable = 'yes'

  const result = validateNoimSubmission(input)
  assert.equal(result.valid, false)
  assert.match(result.errors.p1_last_name, /required/)
  assert.match(result.errors.relationship_details, /required/)
  assert.match(result.errors.p1_parent2_current_name, /required/)
})

test('rejects invalid choices, countries, and dates', () => {
  const input = validSubmission()
  input.p1_description = 'spouse'
  input.p1_birth_country = 'Atlantis'
  input.p2_dob = '2035-02-31'

  const result = validateNoimSubmission(input)
  assert.equal(result.valid, false)
  assert.match(result.errors.p1_description, /invalid selection/)
  assert.match(result.errors.p1_birth_country, /country list/)
  assert.match(result.errors.p2_dob, /valid date/)
})

test('preserves legal-name casing and discards fields not on the party-completed NOIM', () => {
  const input = validSubmission()
  input.p1_last_name = "d'ARC-McDONALD"
  input.wedding_location = 'Do not put this in the celebrant section'

  const result = validateNoimSubmission(input)
  assert.equal(result.valid, true, JSON.stringify(result.errors))
  assert.equal(result.data.p1_last_name, "d'ARC-McDONALD")
  assert.equal('wedding_location' in result.data, false)
})

test('supports a person with no family name without discarding additional given names', () => {
  const input = validSubmission()
  input.p1_has_family_name = 'no'
  input.p1_last_name = ''
  input.p1_first_name = 'Jean'
  input.p1_middle_names = 'Baptiste Emanuel'

  const result = validateNoimSubmission(input)
  assert.equal(result.valid, true, JSON.stringify(result.errors))
  assert.equal(result.data.p1_last_name, '')
  assert.equal(result.data.p1_middle_names, 'Baptiste Emanuel')
  assert.equal(safePdfFilename(result.data), 'NOIM-Jean-Nguyen.pdf')
})

test('rejects a dash or placeholder used in place of a legal name', () => {
  for (const placeholder of ['-', '—', '−', '/', '·', '′', 'N/A', 'Unknown']) {
    const input = validSubmission()
    input.p1_last_name = placeholder
    const result = validateNoimSubmission(input)
    assert.equal(result.valid, false)
    assert.match(result.errors.p1_last_name, /not punctuation, a dash, or a placeholder/)
  }
})

test('the public schema does not collect celebrant-only booking or evidence fields', () => {
  const names = noimSteps.flatMap((step) => step.fields.map((field) => field.name))
  assert.equal(names.some((name) => name.startsWith('wedding_')), false)
  assert.equal(names.some((name) => /divorce_date|divorce_court|death_certificate/.test(name)), false)
  assert.equal(names.some((name) => /email/.test(name)), false)
})

test('defaults both legal-family-name questions to yes', () => {
  const familyNameQuestions = noimSteps
    .flatMap((step) => step.fields)
    .filter((field) => field.name.endsWith('_has_family_name'))
  assert.equal(familyNameQuestions.length, 2)
  assert.deepEqual(familyNameQuestions.map((field) => field.defaultValue), ['yes', 'yes'])
})

test('offers every attached occupation while accepting a custom occupation', () => {
  const occupations = readFileSync(
    new URL('../src/forms/noim/occupations.txt', import.meta.url),
    'utf8',
  ).trim().split(/\r?\n/u)
  assert.equal(occupations.length, 3338)
  assert.equal(new Set(occupations).size, 3338)
  assert.equal(occupations.includes('Accountant (General)'), true)
  assert.equal(occupations.includes('Zoologist'), true)

  const input = validSubmission()
  input.p1_occupation = 'Professional Button Tester'
  const result = validateNoimSubmission(input)
  assert.equal(result.valid, true, JSON.stringify(result.errors))
  assert.equal(result.data.p1_occupation, 'Professional Button Tester')
})

test('rejects parties under 16, allows one 16–17-year-old with guidance, and rejects two', () => {
  const infant = validSubmission()
  const oneMonthAgo = new Date()
  oneMonthAgo.setUTCMonth(oneMonthAgo.getUTCMonth() - 1)
  infant.p1_dob = oneMonthAgo.toISOString().slice(0, 10)
  const infantResult = validateNoimSubmission(infant)
  assert.equal(infantResult.valid, false)
  assert.match(infantResult.errors.p1_dob, /cannot accept a party under 16/i)

  const oneMinor = validSubmission()
  oneMinor.p1_dob = dateForAge(17)
  const oneMinorResult = validateNoimSubmission(oneMinor)
  assert.equal(oneMinorResult.valid, true, JSON.stringify(oneMinorResult.errors))
  assert.match(
    generateDocumentChecklist(oneMinor).map((item) => item.document).join('\n'),
    /court approval.*parent\/guardian consent.*only one party may be under 18/i,
  )

  const twoMinors = validSubmission()
  twoMinors.p1_dob = dateForAge(17)
  twoMinors.p2_dob = dateForAge(16)
  const twoMinorsResult = validateNoimSubmission(twoMinors)
  assert.equal(twoMinorsResult.valid, false)
  assert.match(twoMinorsResult.errors.p1_dob, /only one party/i)
  assert.match(twoMinorsResult.errors.p2_dob, /only one party/i)
})

test('detects age from date of birth and explains both under-18 cases', () => {
  assert.equal(ageOnDate('2008-07-19', new Date('2026-07-19T12:00:00Z')), 18)
  assert.equal(ageOnDate('2008-07-20', new Date('2026-07-19T12:00:00Z')), 17)

  const age17 = validSubmission()
  age17.p1_dob = dateForAge(17)
  assert.match(
    generateDocumentChecklist(age17).map((item) => item.document).join('\n'),
    /court approval.*parent\/guardian consent.*only one party may be under 18/i,
  )

  const age15 = validSubmission()
  age15.p1_dob = dateForAge(15)
  assert.match(
    generateDocumentChecklist(age15).map((item) => item.document).join('\n'),
    /under 16 cannot marry in Australia/i,
  )
})

test('ships a syntactically valid client script with the DOB pattern intact', () => {
  const script = getNoimClientScript()
  assert.doesNotThrow(() => new Function(script))
  assert.equal(script.includes('var match = /^(\\d{4})-(\\d{2})-(\\d{2})$/'), true)
  assert.equal(script.includes("input.setCustomValidity('This service cannot accept a party under 16.')"), true)
  assert.equal(script.includes("input.addEventListener('blur', searchAddress);"), true)
  assert.equal(script.includes('address-search-button'), false)
  assert.equal(script.includes("fetch('/address-search?'"), true)
  assert.equal(script.includes("fetch('https://nominatim.openstreetmap.org"), false)
  assert.equal(script.includes("fetch('/occupations.txt')"), true)
  assert.equal(script.includes("option.className = 'occupation-option'"), true)
  assert.equal(script.includes('Finish editing to load suggestions automatically'), true)
  assert.equal(script.includes("status.textContent = 'Address selected.'"), true)
  assert.equal(script.includes('You can edit it manually if needed'), false)
})

test('creates an ASCII-safe attachment filename', () => {
  assert.equal(
    safePdfFilename({ p1_last_name: 'Marín\r\nX-Test: yes', p2_last_name: "O'Neill" }),
    "NOIM-Marin-X-Test-yes-O'Neill.pdf",
  )
})
