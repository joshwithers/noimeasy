# NOIM Easy

A privacy-focused web application for preparing Australia's **Notice of Intended Marriage (NOIM)** form online. Couples fill in their details through a guided multi-step form and receive a completed NOIM PDF ready to print, sign, and give to their celebrant.

Built for marriage celebrants who want to offer their couples an easy, modern way to prepare the NOIM before their appointment.

## How it works

1. Couples visit the site and fill in the multi-step form (personal details, parent details, ceremony info)
2. A completed NOIM PDF is generated server-side using the official form template
3. The PDF is returned directly as a download — **nothing is stored**
4. Optionally, the couple can email the PDF to their celebrant or to themselves

**No data is stored.** No database, no KV store, no logs. The form data exists only for the duration of the request, is used to generate the PDF, and is then discarded. No identity documents are collected or uploaded.

## Tech stack

- **[Cloudflare Workers](https://developers.cloudflare.com/workers/)** — serverless runtime
- **[Hono](https://hono.dev/)** — lightweight web framework
- **[pdf-lib](https://pdf-lib.js.org/)** — PDF generation (fills in the official NOIM form)
- **[Resend](https://resend.com/)** — transactional email (optional, only if the user chooses to email the PDF)
- **Google Maps Places API** — address autocomplete (optional)

## Prerequisites

- [Node.js](https://nodejs.org/) (v18+)
- A [Cloudflare account](https://dash.cloudflare.com/sign-up) (free tier works)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/) (`npm install -g wrangler`)
- A [Resend account](https://resend.com/) with a verified sending domain (optional — only needed if you want to offer the email-to-celebrant feature)

## Setup

### 1. Clone and install

```sh
git clone <your-repo-url>
cd noim-project
npm install
```

Update (or remove) the `account_id` in `wrangler.toml` to match your own Cloudflare account.

### 2. Set up Resend (optional)

Only needed if you want users to be able to email the PDF to their celebrant or themselves.

1. Create an account at [resend.com](https://resend.com/)
2. Add and verify your sending domain (e.g. `yourdomain.com`) — Resend will give you DNS records to add
3. Generate an API key

### 3. Configure environment variables

Create a `.dev.vars` file in the project root for local development:

```
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxxxxx
GOOGLE_MAPS_API_KEY=your-google-maps-api-key
EMAIL_FROM=NOIM Easy <forms@yourdomain.com>
```

| Variable | Required | Description |
|---|---|---|
| `RESEND_API_KEY` | No | Your Resend API key. Without it, the email-to-celebrant feature won't work but the form and PDF generation will. |
| `GOOGLE_MAPS_API_KEY` | No | Enables address autocomplete. Requires "Places API (New)" enabled in Google Cloud Console. Without it, address fields are plain text inputs. |
| `EMAIL_FROM` | No | The sender address for outgoing emails, e.g. `NOIM Easy <forms@yourdomain.com>`. Must match a verified domain in your Resend account. |

For production, set these as secrets via Wrangler:

```sh
wrangler secret put RESEND_API_KEY
wrangler secret put GOOGLE_MAPS_API_KEY
wrangler secret put EMAIL_FROM
```

### 4. Customise branding (optional)

- **Landing page content**: Edit `content/landing.md`
- **Logo**: Replace `content/logo.svg` and `content/favicon.png`
- **Email footer**: Edit `src/forms/noim/email-template.ts` — look for the footer section and replace with your name/business
- **Site colours**: Defined inline in `src/index.tsx` and `src/forms/noim/index.tsx`

## Development

```sh
npm run dev
```

This starts a local dev server at `http://localhost:8787` using Wrangler. The `.dev.vars` file is loaded automatically.

## Deploy

```sh
npm run deploy
```

This deploys to Cloudflare Workers. Make sure you've:
- Set your `account_id` in `wrangler.toml`
- Set any secrets via `wrangler secret put`

Your app will be live at `https://noim-prep.<your-subdomain>.workers.dev`. You can add a custom domain through the Cloudflare dashboard.

## Privacy

This application is designed to store as little data as possible:

- **No database or storage** — form data is processed in memory and discarded after the PDF is generated
- **No server-side logs** of personal information
- **No analytics or tracking** on the site
- **No identity documents** are collected or uploaded
- **Emails are optional** — the user chooses whether to send the PDF to anyone. If they do, the email is sent via Resend and no copy is retained by the application

## Project structure

```
src/
  index.tsx              Main app — routes, email sending, landing page
  types.ts               TypeScript types for env bindings
  landing.ts             Markdown-to-HTML converter for landing page
  forms/noim/
    schema.ts            Form field definitions and step structure
    logic.ts             Client-side JS (validation, conditional fields, address autocomplete)
    index.tsx            Form page component (multi-step UI)
    pdf-generator.ts     Fills in the official NOIM PDF template
    email-template.ts    Email templates
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
