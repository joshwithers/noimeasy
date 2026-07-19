# NOIM Easy

[NOIM Easy](https://noimeasy.au) is a privacy-focused web application for preparing an Australian **Notice of Intended Marriage (NOIM)**. It guides a couple through the party-completed particulars, validates those particulars, and fills the current official five-page PDF so it can be reviewed, signed under an authorised witness's observation, and given to the couple's marriage celebrant.

The service is a preparation tool. It does not lodge the NOIM, replace an authorised celebrant, decide whether a marriage may be solemnised, or provide legal advice.

## What the application does

1. Collects the particulars that the two parties complete in items 1–16 of the NOIM.
2. Explains conditional requirements, including no-family-name entries, unknown particulars, previous marriages, and parties aged 16 or 17.
3. Lets users review human-readable answers before submission.
4. Validates the submission again on the server.
5. Fills the bundled official PDF without writing into celebrant-only, prescribed-authority, or registry-only fields.
6. Returns the completed PDF directly as a download with `Cache-Control: no-store`.

The landing page also explains what happens next and includes an interactive statutory notice-period calculator.

## What happens after the PDF is generated

Generating the PDF does **not** itself give legal notice. The ordinary process is:

1. The couple reviews the prepared PDF against the documents supporting their particulars.
2. Each party signs under the observation of an authorised witness, either in person or by audio-visual link where the current location rules permit it.
3. The completed and witnessed NOIM is given to the celebrant physically or as a scanned or emailed copy. The celebrant records when it was received and separately sights the required supporting documents before the marriage.
4. The ordinary one-month notice period begins when the celebrant receives the completed and signed NOIM—not when the PDF is generated, a booking is made, or a deposit is paid.

Section 42 of the [Marriage Act 1961](https://www.legislation.gov.au/Current/C1961A00012) ordinarily requires the celebrant to receive the notice no earlier than 18 months and no later than one month before the marriage. Current practical guidance is published by the [Attorney-General's Department](https://www.ag.gov.au/families-and-marriage/marriage/get-married).

### Calendar-month calculator

The calculator in `src/lib/notice-period.ts` applies the definition of a month in section 2G of the [Acts Interpretation Act 1901](https://www.legislation.gov.au/Current/C1901A00002):

- If the following month has a corresponding numbered day, that is the first ordinary marriage date. For example, notice received on 5 January 2026 produces 5 February 2026.
- If the following month has no corresponding day, the statutory month runs to the end of that month and the first marriage date is the following day. For example, notice received on 31 January 2026 produces 1 March 2026—not 28 February.
- Leap years are calculated rather than approximated as a fixed number of days.
- The calculator also displays the final date in the ordinary 18-month window.
- It does not assume that a prescribed authority has approved a shortening of time; the celebrant remains responsible for confirming the final date.

The date logic is implemented as a dependency-free server helper and mirrored in the browser script. Both paths are covered by tests for corresponding-day, missing-day, invalid-date, and leap-year cases.

## Legal and form behaviour

### Names

- Both “Does this legal name include a family name?” questions default to **Yes**.
- A family name is required unless the person explicitly selects that their legal name has no family name.
- If a person has no family name, the official family-name item is left blank. A dash is never inserted as a substitute.
- Dashes, punctuation-only strings, `N/A`, `none`, `null`, and `unknown` are rejected in party-name fields.
- All given names can be entered separately as the first given name and additional given names.
- Legal-name casing is preserved rather than automatically title-cased.

### Dates of birth and proposed marriage date

- Age is calculated on the **proposed marriage date**, not on the day the form is completed.
- A proposed marriage date in the past is rejected.
- A party who would be under 16 on the proposed marriage date is rejected.
- If one party would be 16 or 17, the interface explains the court-approval and parent/guardian-consent requirements.
- Two parties who would both be under 18 are rejected.
- The proposed marriage date is used for guidance only and is not inserted into a celebrant-only PDF field.

### Birthplace and parent particulars

- Australian and international birthplace particulars are supported.
- Birthplace particulars may be entered as `Unknown` where they cannot be ascertained after reasonable inquiry; the review checklist explains the statutory-declaration pathway.
- Parent 1 particulars must be completed or marked `Unknown` after reasonable inquiry.
- Parent 2 particulars are collected only when applicable.

### Occupations

- Occupation fields use the bundled list in `src/forms/noim/occupations.txt` for suggestions.
- Suggestions do not restrict the field: a user can type and submit a legitimate occupation not in the list.
- The list is fetched lazily from `/occupations.txt` and cached by the browser.

### Residential addresses

- Address fields remain ordinary editable text fields.
- After editing is completed, the browser can request suggestions through the same-origin `/address-search` endpoint.
- The Worker sends one completed query to OpenStreetMap Nominatim; it does not send a request on every keystroke.
- Australian results are reformatted into Australian postal order, including unit information where available.
- Overseas results retain an appropriate international order.
- The original user-entered address remains editable and is preserved when no suggestion is selected.

### Conjugal status and previous marriages

All four official values are supported:

- Never validly married
- Divorced
- Widowed
- Divorce pending

The review page displays the official labels rather than internal storage codes. A pending divorce is allowed as a NOIM particular, with guidance that the divorce must take effect before the new marriage can be solemnised.

### Witnessing

The site reflects the current section 42 witness categories and explains remote witnessing. In Australia, the listed witnesses include an authorised celebrant, a Commissioner for Declarations under the *Statutory Declarations Act 1959*, a Justice of the Peace, a barrister or solicitor, a medical practitioner, and an Australian Federal Police or state/territory police member. The site separately lists the permitted overseas categories and location rule.

The bundled official PDF contains older physical-presence wording. The application leaves the official template unchanged and displays the current rule separately.

### PDF layout and character handling

- The official form template is bundled at `src/forms/noim/noim-blank.pdf`.
- Only party-completed fields are populated.
- A Unicode font is embedded for broad Latin, Greek, and Cyrillic support.
- Text is measured against the actual official PDF field before generation.
- Long values are reduced only to a legible minimum size.
- A value that still cannot fit is rejected rather than silently clipped.
- A character that cannot be rendered safely is rejected rather than emitted as a broken or missing glyph.
- Download filenames are reduced to an ASCII-safe form without modifying the names written inside the document.

## Privacy model

The application intentionally has no database, KV namespace, object store, user accounts, analytics, or advertising trackers.

- Submitted particulars are held in Worker memory only while the request is validated and the PDF is generated.
- Application code does not persist or deliberately log form fields.
- The generated PDF is returned directly and is not retained by the application.
- Identity documents are never uploaded.
- PDF responses use `Cache-Control: no-store`.
- Address lookup is the one exception to wholly local form editing: the completed address query is proxied through the Worker to the public Nominatim service so suggestions can be returned. The UI discloses this before use.

Operators should still understand that Cloudflare and upstream network providers process ordinary connection metadata as part of serving requests. The application-level privacy promises above do not redefine those providers' independent infrastructure policies.

## Request security and abuse controls

`POST /submit` is protected by several independent checks:

- Only `multipart/form-data` and `application/x-www-form-urlencoded` submissions are accepted.
- Declared and streamed request bodies are limited to 64 KiB.
- Cross-origin submissions are rejected using `Origin` and `Sec-Fetch-Site` checks.
- A honeypot field rejects simple automated submissions.
- The Cloudflare rate-limit binding permits five PDF requests per 60 seconds for each connecting-IP key.
- Every field is validated server-side; client-side checks are usability aids, not a trust boundary.
- Invalid enumerated values and hidden conditional fields cannot be injected into the generated PDF.
- PDF field overflow and unsupported characters fail closed with actionable errors.

## Routes

| Method | Path | Purpose |
| --- | --- | --- |
| `GET` | `/` | Landing page, legal process explainer, and notice calculator |
| `GET` | `/prepare` | Multi-step NOIM preparation form |
| `POST` | `/submit` | Validate particulars and return the completed PDF |
| `GET` | `/address-search?q=...` | Same-origin proxy for completed-address Nominatim suggestions |
| `GET` | `/occupations.txt` | Bundled occupation suggestions |
| `GET` | `/logo.svg`, `/favicon.png`, `/og-image.png`, `/pico.min.css` | Self-hosted static assets |

## Technology

- [Cloudflare Workers](https://developers.cloudflare.com/workers/) for the runtime, custom domain, and edge rate limiter
- [Hono](https://hono.dev/) for routing and HTML responses
- [pdf-lib](https://pdf-lib.js.org/) and `@pdf-lib/fontkit` for official-form filling and Unicode font embedding
- [OpenStreetMap Nominatim](https://nominatim.org/) for optional completed-address suggestions
- TypeScript for server, validation, PDF, and browser-script source
- Node's built-in test runner for contract and regression tests

The user-facing application is server-rendered and uses small generated browser scripts. It has no frontend framework runtime, database, or separate build service.

## Requirements

- Node.js 24 or newer; `.nvmrc` currently specifies Node 24
- npm
- A Cloudflare account for deployment
- Wrangler authentication for the target account

## Local setup

```sh
git clone https://github.com/joshwithers/noimeasy.git
cd noimeasy
nvm use
npm install
npm run dev
```

Wrangler serves the project locally, normally at `http://localhost:8787`.

The current application has no application secrets or environment variables. It requires the `PDF_RATE_LIMITER` binding declared in `wrangler.toml`. Old Cloudflare Worker secrets may still exist in an account, but this source does not read them.

## Validation and tests

Run the complete release gate before committing or deploying:

```sh
npm run check
```

That command runs:

1. `npm run typecheck` — TypeScript without emitting files.
2. `npm test` — all Node contract and regression tests.
3. `npm run deploy:dry-run` — a Wrangler production bundle without publishing it.

The test suites cover:

- request origin, content type, declared size, and streamed size enforcement;
- official PDF field mapping, blank no-family-name fields, Unicode, field measurement, and failure behaviour;
- validation of required and conditional particulars, legal names, dates, countries, conjugal status, age, and unknown-particular pathways;
- occupation suggestions and custom values;
- Australian and international address formatting;
- the statutory one-month and 18-month calculations, including leap years.

Useful individual commands:

```sh
npm run typecheck
npm test
npm run deploy:dry-run
npm audit --omit=dev
```

## Deployment

The production Worker is named `noim-prep` and `wrangler.toml` maps it directly to the custom domain [noimeasy.au](https://noimeasy.au).

Authenticate once if necessary:

```sh
npx wrangler login
```

Run the release gate and deploy:

```sh
npm run check
npm run deploy
```

A successful upload is not, by itself, proof that production is serving the release. Confirm the active version and the public response:

```sh
npx wrangler deployments status
curl -I https://noimeasy.au/
```

For behaviour changes, exercise the affected production journey in a browser as well. For calculator changes, verify at least one ordinary corresponding-day case and one missing-day or leap-year case.

Forks should replace the custom-domain route in `wrangler.toml` with their own Worker route or remove it before deploying.

## Project structure

```text
content/
  landing.md                    Landing-page copy around the custom process sections
  logo.svg                      Site logo
  favicon.png                   Browser favicon
  og-image.png                  Social sharing image
  pico.min.css                  Self-hosted Pico CSS
src/
  index.tsx                     Worker routes, landing page, request controls, PDF response
  landing.ts                    Small Markdown-to-HTML converter
  types.ts                      Cloudflare binding types
  lib/
    form-request.ts             Origin, content-type, and body-size enforcement
    notice-period.ts            Section 2G one-month and 18-month calculator
    utils.ts                    Shared escaping and response helpers
  forms/
    shared/
      countries.ts              Country data used by the combobox and validation
    noim/
      index.tsx                 Multi-step form page
      schema.ts                 Party-completed form fields and conditional structure
      logic.ts                  Browser validation, review, age guidance, and suggestions
      validation.ts             Authoritative server-side validation
      address.ts                Nominatim query preparation and result formatting
      occupations.txt           Suggested occupations; custom values remain allowed
      pdf-generator.ts          Production PDF asset adapter
      pdf-generator-core.ts     PDF mapping, measurement, fonts, and fill logic
      noim-blank.pdf             Official five-page source form
tests/
  form-request.test.ts          Request-boundary tests
  noim-validation.test.ts       Field and legal-guidance validation tests
  noim-pdf.test.ts              Official-form rendering and overflow tests
  notice-period.test.ts         Statutory calendar-month tests
wrangler.toml                   Worker, route, asset rules, and rate-limit binding
```

## Maintaining legal and PDF correctness

Changes to form rules should be checked against all three layers:

1. the current legislation and Attorney-General's Department guidance;
2. the actual current official PDF, including its field names, dimensions, and party/celebrant ownership;
3. both client and server behaviour, with a rendered-PDF regression test where layout is affected.

Do not infer a legal requirement from visual space in the PDF, replace an unknown/no-family-name pathway with a dash, or silently truncate accepted particulars. If the Attorney-General's Department publishes a replacement form, update `noim-blank.pdf`, audit every mapping, render representative samples, and update the tests before deploying it.

## Licence

This project is released under the [MIT License](LICENSE). You may use, fork, and adapt it, but you are responsible for checking the current law, official form, hosting configuration, and privacy disclosures for your deployment.
