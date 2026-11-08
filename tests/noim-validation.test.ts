import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validSubmission } from "./fixtures.ts";
import { noimSteps } from "../src/forms/noim/schema.ts";
import {
  ageOnDate,
  generateDocumentChecklist,
  getNoimClientScript,
} from "../src/forms/noim/logic.ts";
import {
  calendarDateInTimeZone,
  safePdfFilename,
  validateNoimSubmission,
} from "../src/forms/noim/validation.ts";
import { normaliseNoimText } from "../src/forms/noim/text-normalisation.ts";

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function dateYearsFromNow(years: number): string {
  const date = new Date();
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return isoDate(date);
}

function dateForAgeOn(age: number, onDate: string): string {
  const [year, month, day] = onDate.split("-").map(Number);
  return isoDate(new Date(Date.UTC(year - age, month - 1, day)));
}


test("uses the Australian legal-date timezone for date-only checks", () => {
  assert.equal(
    calendarDateInTimeZone(
      new Date("2026-07-24T14:30:00Z"),
      "Australia/Melbourne",
    ),
    "2026-07-25",
  );
});

test("requires a complete residential address and assembles it for the official PDF", () => {
  const input = validSubmission();
  const result = validateNoimSubmission(input);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.equal(
    result.data.p1_address,
    "1 Example Street, Southbank, Melbourne, Victoria 3006, Australia",
  );

  input.p1_address_suburb = "";
  input.p2_address_country = "Atlantis";
  const invalid = validateNoimSubmission(input);
  assert.match(invalid.errors.p1_address_suburb, /required/);
  assert.match(invalid.errors.p2_address_country, /country list/);
});

test("accepts every official conjugal status, including divorce pending", () => {
  for (const status of [
    "never_married",
    "divorced",
    "widowed",
    "divorce_pending",
  ]) {
    const input = validSubmission();
    input.p1_conjugal_status = status;
    const result = validateNoimSubmission(input);
    assert.equal(result.valid, true, JSON.stringify(result.errors));
    assert.equal(result.data.p1_conjugal_status, status);
  }
});

test("accepts localities without a separate city and overseas addresses without a province or postcode", () => {
  const input = validSubmission();
  input.p1_address_city = "";
  input.p2_address_country = "Hong Kong";
  input.p2_address_city = "";
  input.p2_address_state = "";
  input.p2_address_postcode = "";
  const result = validateNoimSubmission(input);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.equal(result.data.p2_address, "2 Example Road, The Rocks, Hong Kong");
});

test("still requires state and a four-digit postcode for Australian addresses", () => {
  const input = validSubmission();
  input.p1_address_state = "";
  input.p1_address_postcode = "ABC";
  const result = validateNoimSubmission(input);
  assert.match(result.errors.p1_address_state, /required/);
  assert.match(result.errors.p1_address_postcode, /four digits/);
});

test("does not duplicate a city that is the same as the locality", () => {
  const input = validSubmission();
  input.p1_address_city = "southbank";
  assert.equal(validateNoimSubmission(input).data.p1_address,
    "1 Example Street, Southbank, Victoria 3006, Australia");
});

test("requires official fields and conditionally requires relationship and Parent 2 details", () => {
  const input = validSubmission();
  input.p1_last_name = "";
  input.parties_related = "yes";
  input.relationship_details = "";
  input.p1_parent2_applicable = "yes";

  const result = validateNoimSubmission(input);
  assert.equal(result.valid, false);
  assert.match(result.errors.p1_last_name, /required/);
  assert.match(result.errors.relationship_details, /required/);
  assert.match(result.errors.p1_parent2_current_name, /required/);
});

test("rejects invalid choices, countries, and dates", () => {
  const input = validSubmission();
  input.p1_description = "spouse";
  input.p1_birth_country = "Atlantis";
  input.p2_dob = "2035-02-31";

  const result = validateNoimSubmission(input);
  assert.equal(result.valid, false);
  assert.match(result.errors.p1_description, /invalid selection/);
  assert.match(result.errors.p1_birth_country, /country list/);
  assert.match(result.errors.p2_dob, /valid date/);
});

test("requires a valid proposed marriage date for age guidance", () => {
  const missing = validSubmission();
  missing.proposed_marriage_date = "";
  assert.match(
    validateNoimSubmission(missing).errors.proposed_marriage_date,
    /required/i,
  );

  const invalid = validSubmission();
  invalid.proposed_marriage_date = "2027-02-31";
  assert.match(
    validateNoimSubmission(invalid).errors.proposed_marriage_date,
    /valid date/i,
  );
});

test("preserves legal-name casing and discards fields not on the party-completed NOIM", () => {
  const input = validSubmission();
  input.p1_last_name = "d'ARC-McDONALD";
  input.wedding_location = "Do not put this in the celebrant section";

  const result = validateNoimSubmission(input);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.equal(result.data.p1_last_name, "d'ARC-McDONALD");
  assert.equal("wedding_location" in result.data, false);
});

test("cleans pasted controls and title-cases only uniformly cased legal names", () => {
  assert.equal(normaliseNoimText("  ALEX\n\u200bSMITH\ufe0f  ", true), "Alex Smith");
  assert.equal(normaliseNoimText("mary-jane o'neill", true), "Mary-Jane O'Neill");
  assert.equal(normaliseNoimText("mcdonald", true), "McDonald");
  assert.equal(normaliseNoimText("de Silva", true), "de Silva");
  assert.equal(normaliseNoimText("ACME\tPTY LTD"), "ACME PTY LTD");

  const input = validSubmission();
  input.p1_first_name = "\u200bALEX\n";
  input.p1_middle_names = "MARY\tJANE";
  input.p1_address_line1 = "1 Example\r\nStreet";
  input.p2_parent1_current_name = "taylor nguyen";

  const result = validateNoimSubmission(input);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.equal(result.data.p1_first_name, "Alex");
  assert.equal(result.data.p1_middle_names, "Mary Jane");
  assert.equal(result.data.p1_address.startsWith("1 Example Street, "), true);
  assert.equal(result.data.p2_parent1_current_name, "Taylor Nguyen");
});

test("supports a person with no family name without discarding additional given names", () => {
  const input = validSubmission();
  input.p1_has_family_name = "no";
  input.p1_last_name = "";
  input.p1_first_name = "Jean";
  input.p1_middle_names = "Baptiste Emanuel";

  const result = validateNoimSubmission(input);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.equal(result.data.p1_last_name, "");
  assert.equal(result.data.p1_middle_names, "Baptiste Emanuel");
  assert.equal(safePdfFilename(result.data), "NOIM-Jean-Nguyen.pdf");
});

test("rejects a dash or placeholder used in place of a legal name", () => {
  for (const placeholder of ["-", "—", "−", "/", "·", "′", "N/A", "Unknown"]) {
    const input = validSubmission();
    input.p1_last_name = placeholder;
    const result = validateNoimSubmission(input);
    assert.equal(result.valid, false);
    assert.match(
      result.errors.p1_last_name,
      /not punctuation, a dash, or a placeholder/,
    );
  }
});

test("the public schema does not collect celebrant-only booking or evidence fields", () => {
  const names = noimSteps.flatMap((step) =>
    step.fields.map((field) => field.name),
  );
  assert.equal(
    names.some((name) => name.startsWith("wedding_")),
    false,
  );
  assert.equal(
    names.some((name) =>
      /divorce_date|divorce_court|death_certificate/.test(name),
    ),
    false,
  );
  assert.equal(
    names.some((name) => /email/.test(name)),
    false,
  );
});

test("defaults both legal-family-name questions to yes", () => {
  const familyNameQuestions = noimSteps
    .flatMap((step) => step.fields)
    .filter((field) => field.name.endsWith("_has_family_name"));
  assert.equal(familyNameQuestions.length, 2);
  assert.deepEqual(
    familyNameQuestions.map((field) => field.defaultValue),
    ["yes", "yes"],
  );
});

test("offers every attached occupation while accepting a custom occupation", () => {
  const occupations = readFileSync(
    new URL("../src/forms/noim/occupations.txt", import.meta.url),
    "utf8",
  )
    .trim()
    .split(/\r?\n/u);
  assert.equal(occupations.length, 3338);
  assert.equal(new Set(occupations).size, 3338);
  assert.equal(occupations.includes("Accountant (General)"), true);
  assert.equal(occupations.includes("Zoologist"), true);

  const input = validSubmission();
  input.p1_occupation = "Professional Button Tester";
  const result = validateNoimSubmission(input);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.equal(result.data.p1_occupation, "Professional Button Tester");
});

test("assesses marriageability on the proposed marriage date", () => {
  const infant = validSubmission();
  infant.p1_dob = dateForAgeOn(15, infant.proposed_marriage_date);
  const infantResult = validateNoimSubmission(infant);
  assert.equal(infantResult.valid, false);
  assert.match(infantResult.errors.p1_dob, /cannot accept a party under 16/i);

  const oneMinor = validSubmission();
  oneMinor.p1_dob = dateForAgeOn(17, oneMinor.proposed_marriage_date);
  const oneMinorResult = validateNoimSubmission(oneMinor);
  assert.equal(
    oneMinorResult.valid,
    true,
    JSON.stringify(oneMinorResult.errors),
  );
  assert.match(
    generateDocumentChecklist(oneMinor)
      .map((item) => item.document)
      .join("\n"),
    /court approval.*parent\/guardian consent.*only one party may be under 18/i,
  );

  const twoMinors = validSubmission();
  twoMinors.p1_dob = dateForAgeOn(17, twoMinors.proposed_marriage_date);
  twoMinors.p2_dob = dateForAgeOn(16, twoMinors.proposed_marriage_date);
  const twoMinorsResult = validateNoimSubmission(twoMinors);
  assert.equal(twoMinorsResult.valid, false);
  assert.match(twoMinorsResult.errors.p1_dob, /only one party/i);
  assert.match(twoMinorsResult.errors.p2_dob, /only one party/i);

  const currently17But18AtMarriage = validSubmission();
  const marriageDate = currently17But18AtMarriage.proposed_marriage_date;
  currently17But18AtMarriage.p1_dob = dateForAgeOn(18, marriageDate);
  const adultAtMarriageResult = validateNoimSubmission(
    currently17But18AtMarriage,
  );
  assert.equal(
    adultAtMarriageResult.valid,
    true,
    JSON.stringify(adultAtMarriageResult.errors),
  );
});

test("detects age from date of birth and explains both under-18 cases", () => {
  assert.equal(ageOnDate("2008-07-19", new Date("2026-07-19T12:00:00Z")), 18);
  assert.equal(ageOnDate("2008-07-20", new Date("2026-07-19T12:00:00Z")), 17);

  const age17 = validSubmission();
  age17.p1_dob = dateForAgeOn(17, age17.proposed_marriage_date);
  assert.match(
    generateDocumentChecklist(age17)
      .map((item) => item.document)
      .join("\n"),
    /court approval.*parent\/guardian consent.*only one party may be under 18/i,
  );

  const age15 = validSubmission();
  age15.p1_dob = dateForAgeOn(15, age15.proposed_marriage_date);
  assert.match(
    generateDocumentChecklist(age15)
      .map((item) => item.document)
      .join("\n"),
    /under 16 cannot marry in Australia/i,
  );
});

test("accepts unknown birthplace particulars and adds statutory-declaration guidance", () => {
  const input = validSubmission();
  input.p1_birth_country = "Unknown";
  input.p1_birth_city = "Unknown";
  input.p1_birth_state = "";

  const result = validateNoimSubmission(input);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.match(
    generateDocumentChecklist(input)
      .map((item) => item.document)
      .join("\n"),
    /statutory declaration.*reasonable inquiry/i,
  );

  const unknownCity = validSubmission();
  unknownCity.p1_birth_city = "Unknown";
  assert.equal(validateNoimSubmission(unknownCity).valid, true);
  assert.match(
    generateDocumentChecklist(unknownCity)
      .map((item) => item.document)
      .join("\n"),
    /statutory declaration.*reasonable inquiry/i,
  );
});

test("ships a syntactically valid client script with the DOB pattern intact", () => {
  const script = getNoimClientScript();
  assert.doesNotThrow(() => new Function(script));
  assert.equal(
    script.includes("var match = /^(\\d{4})-(\\d{2})-(\\d{2})$/"),
    true,
  );
  assert.equal(
    script.includes(
      "input.setCustomValidity('This service cannot accept a party under 16.')",
    ),
    true,
  );
  assert.equal(script.includes("fetch('/occupations.txt')"), true);
  assert.equal(script.includes("option.className = 'occupation-option'"), true);
  assert.equal(script.includes("address-search"), false);
  assert.equal(
    script.includes(
      "calendarDateInTimeZone(new Date(), 'Australia/Melbourne')",
    ),
    true,
  );
  assert.equal(script.includes("proposedMarriageDateInput"), true);
  assert.equal(script.includes("event.key === 'ArrowDown'"), true);
  assert.equal(script.includes("event.key === 'Enter'"), true);
  assert.equal(script.includes("aria-activedescendant"), true);
  assert.equal(script.includes("metadata.options[rawReviewValue]"), true);
  assert.equal(script.includes("completion-next-steps"), true);
  assert.equal(script.includes("It is not legal notice yet"), true);
  assert.equal(script.includes("var normaliseNoimText ="), true);
  assert.equal(script.includes("normaliseFormTextFields();"), true);
  assert.equal(script.includes("isLegalNameFieldName"), true);
  assert.equal(script.includes("localStorage"), false);
  assert.equal(script.includes("sessionStorage"), false);
});

test("creates an ASCII-safe attachment filename", () => {
  assert.equal(
    safePdfFilename({
      p1_last_name: "Marín\r\nX-Test: yes",
      p2_last_name: "O'Neill",
    }),
    "NOIM-Marin-X-Test-yes-O'Neill.pdf",
  );
});
