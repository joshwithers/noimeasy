# NOIM Easy

A privacy-focused web application for preparing Australia's **Notice of Intended Marriage (NOIM)** form online. Couples fill in their details through a guided multi-step form and receive a completed official NOIM PDF ready to sign in the presence of an authorised witness and give to their celebrant.

Built for marriage celebrants who want to offer their couples an easy, modern way to prepare the NOIM before their appointment.

## How it works

1. Couples visit the site and fill in the party-completed NOIM fields (personal details, parent details and relationship)
2. A completed NOIM PDF is generated server-side using the official form template
3. The PDF is returned directly as a download — **nothing is stored**

**No data is stored.** No database, no KV store, no logs. The form data exists only for the duration of the request, is used to generate the PDF, and is then discarded. No identity documents are collected or uploaded.

## Tech stack

- **[Cloudflare Workers](https://developers.cloudflare.com/workers/)** — serverless runtime
- **[Hono](https://hono.dev/)** — lightweight web framework
- **[pdf-lib](https://pdf-lib.js.org/)** — PDF generation (fills in the official NOIM form)
- **[OpenStreetMap Nominatim](https://nominatim.org/)** — completed-address lookup after editing finishes (not keystroke autocomplete)

## Prerequisites

- [Node.js](https://nodejs.org/) 24 LTS (the version in `.nvmrc`)
- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works)
- Wrangler is installed locally with the project dependencies

## Setup

### 1. Clone and install

```sh
git clone <your-repo-url>
cd noim-project
npm install
```

Update (or remove) the `account_id` in `wrangler.toml` to match your own Cloudflare account.

### 2. Customise branding (optional)

- **Landing page content**: Edit `content/landing.md`
- **Logo**: Replace `content/logo.svg` and `content/favicon.png`
- **Site colours**: Defined inline in `src/index.tsx` and `src/forms/noim/index.tsx`

## Development

```sh
npm run dev
```

This starts a local dev server at `http://localhost:8787` using Wrangler. The `.dev.vars` file is loaded automatically.

Run the complete local release gate with:

```sh
npm run check
```

This runs TypeScript, the NOIM contract tests, and a Wrangler production dry-run.

## Deploy

```sh
npm run deploy
```

This deploys to Cloudflare Workers. Make sure you've:
- Set your `account_id` in `wrangler.toml`

Your app will be live at `https://noim-prep.<your-subdomain>.workers.dev`. You can add a custom domain through the Cloudflare dashboard.

## Privacy

This application is designed to store as little data as possible:

- **No database or storage** — form data is processed in memory and discarded after the PDF is generated
- **No server-side logs** of personal information
- **No analytics or tracking** on the site
- **No identity documents** are collected or uploaded
- **Address lookup uses a completed query** — after address editing finishes, one completed address is sent to the public Nominatim service for suggestions. No request is made on each keystroke.

## NOIM scope

- The bundled PDF is the official five-page Attorney-General's Department NOIM form.
- The app fills only items 1–16, which are completed by the parties. It deliberately leaves all celebrant-only, registry-only and prescribed-authority sections blank.
- The app supports all four official conjugal-status values, including `Divorce pending`.
- Occupation fields suggest entries from the supplied occupation list while still accepting any custom occupation typed by the user.
- Legal names are preserved exactly as entered. A family name is required unless the person explicitly states they do not have one; dashes, punctuation-only values and other placeholders are rejected.
- The generated PDF embeds a Unicode font for Latin, Greek and Cyrillic names. If the PDF engine cannot safely lay out a script, submission stops with guidance to use the Roman-alphabet spelling from supporting evidence or ask the celebrant, rather than emitting broken glyphs.
- Dates of birth are enforced on both the client and server: a party under 16 is rejected; a party aged 16 or 17 sees the court-approval and parent/guardian-consent requirements; and two parties under 18 are rejected.
- Parent 1 details must be entered or marked `Unknown` after reasonable inquiry. Parent 2 fields are included only where applicable.
- From 12 June 2024, a NOIM may be witnessed in person or remotely by audio-visual link, subject to the Attorney-General's Department's location rules. The approved PDF still contains older physical-presence wording, so the site displays the current rule separately rather than altering the official form.

## Project structure

```
src/
  index.tsx              Main app — routes and landing page
  types.ts               TypeScript types for env bindings
  landing.ts             Markdown-to-HTML converter for landing page
  forms/noim/
    schema.ts            Form field definitions and step structure
    logic.ts             Client-side JS (validation, conditional fields, completed-address lookup)
    index.tsx            Form page component (multi-step UI)
    occupations.ts      Loads occupation suggestions for the form
    occupations.txt     Occupation suggestions (custom values remain valid)
    pdf-generator.ts     Fills in the official NOIM PDF template
    noim-blank.pdf       Blank official NOIM form (used as PDF template)
  forms/shared/
    countries.ts         Country list for dropdown fields
content/
  landing.md             Landing page content (editable)
  logo.svg               Site logo
  favicon.png            Browser favicon
  pico.min.css           Pico CSS framework (self-hosted)
wrangler.toml            Cloudflare Workers configuration
```

## Licence

This project is open source under the [MIT License](LICENSE). Use it, fork it, adapt it for your own celebrant business. If you do run your own version, we'd love to hear about it.
