import { Hono } from 'hono'
import type { Env } from './types'
import { NoimFormPage } from './forms/noim/index'
import { markdownToHtml } from './landing'
import { generateNoimPdf, PdfFieldOverflowError, UnsupportedPdfCharacterError } from './forms/noim/pdf-generator'
import { safePdfFilename, validateNoimSubmission } from './forms/noim/validation'
import { addressSearchQuery, formatNominatimResults } from './forms/noim/address'
import {
  FormBodyTooLargeError,
  formRequestRejection,
  parseFormBodyWithLimit,
} from './lib/form-request'
import {
  getNoticePeriodCalculatorScript,
  getNoticePeriodEmbedCopyScript,
  getNoticePeriodEmbedResizeScript,
  NOTICE_PERIOD_EMBED_CODE,
  NOTICE_PERIOD_EMBED_PATH,
} from './lib/notice-period'
import landingMd from '../content/landing.md'
import logoSvg from '../content/logo.svg'
import faviconPng from '../content/favicon.png'
import ogImagePng from '../content/og-image.png'
import picoCss from '../content/pico.min.css'
import occupationsText from './forms/noim/occupations.txt'

const app = new Hono<Env>()

function NoticePeriodCalculator({ embedded = false }: { embedded?: boolean }) {
  const linkTarget = embedded ? '_blank' : undefined
  const linkRel = embedded ? 'noopener noreferrer' : undefined

  return <section class="notice-calculator" aria-labelledby="notice-calculator-heading">
    <h2 id="notice-calculator-heading">When can you get married?</h2>
    <p>Choose the date your celebrant receives the completed and signed NOIM.</p>
    <label class="notice-date-label" for="notice-received-date">Date received by celebrant</label>
    <input type="date" id="notice-received-date" aria-describedby="notice-rule-note" />

    <div class="notice-window" aria-live="polite">
      <div class="notice-result">
        <span class="notice-result-label">Earliest marriage date</span>
        <strong id="earliest-marriage-output">—</strong>
      </div>
      <div class="notice-result">
        <span class="notice-result-label">Notice valid through</span>
        <strong id="latest-marriage-output">—</strong>
      </div>
    </div>
    <p class="notice-received-summary">Calculated from receipt on <strong id="notice-received-output">—</strong>.</p>
    <p id="notice-period-explanation"></p>
    <p class="notice-rule" id="notice-rule-note">
      This applies the calendar-month rule in section 2G of the
      {' '}<a href="https://www.legislation.gov.au/Current/C1901A00002" target={linkTarget} rel={linkRel}>Acts Interpretation Act 1901</a>
      {' '}to the one-to-18-month window in section 42 of the
      {' '}<a href="https://www.legislation.gov.au/Current/C1961A00012" target={linkTarget} rel={linkRel}>Marriage Act 1961</a>.
      It assumes no prescribed authority has approved a shorter notice period. Your celebrant must confirm the final dates.
    </p>
  </section>
}

// === Static assets ===
app.get('/logo.svg', (c) => {
  return new Response(logoSvg, {
    headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=31536000, immutable' },
  })
})

app.get('/favicon.png', (c) => {
  return new Response(faviconPng, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  })
})

app.get('/og-image.png', (c) => {
  return new Response(ogImagePng, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=31536000, immutable' },
  })
})

app.get('/pico.min.css', (c) => {
  return new Response(picoCss, {
    headers: { 'Content-Type': 'text/css', 'Cache-Control': 'public, max-age=31536000, immutable' },
  })
})

app.get('/occupations.txt', () => {
  return new Response(occupationsText, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  })
})

// Same-origin proxy for the completed-address lookup. Keeping this request on
// noimeasy.au avoids browser CORS/privacy-extension failures while preserving
// Nominatim's required attribution and completed-query-only usage.
app.get('/address-search', async (c) => {
  const query = (c.req.query('q') || '').trim()
  if (query.length < 6 || query.length > 300) {
    return c.json({ error: 'Enter a fuller address before requesting suggestions.' }, 400)
  }

  const upstreamUrl = new URL('https://nominatim.openstreetmap.org/search')
  upstreamUrl.searchParams.set('q', addressSearchQuery(query))
  upstreamUrl.searchParams.set('format', 'jsonv2')
  upstreamUrl.searchParams.set('addressdetails', '1')
  upstreamUrl.searchParams.set('limit', '5')
  upstreamUrl.searchParams.set('accept-language', 'en-AU,en')

  let upstream: Response
  try {
    upstream = await fetch(upstreamUrl, {
      headers: {
        Accept: 'application/json',
        Referer: 'https://noimeasy.au/',
        'User-Agent': 'NOIMEasy/1.0 (+https://noimeasy.au/)',
      },
    })
  } catch {
    return c.json({ error: 'Address suggestions are temporarily unavailable.' }, 503)
  }

  if (!upstream.ok) {
    return c.json({ error: 'Address suggestions are temporarily unavailable.' }, 503)
  }

  const results = await upstream.json<unknown>()
  if (!Array.isArray(results)) {
    return c.json({ error: 'Address suggestions returned an unexpected response.' }, 502)
  }

  return new Response(JSON.stringify(formatNominatimResults(results, query)), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
})

// Standalone calculator intended to be embedded on celebrant websites.
app.get(NOTICE_PERIOD_EMBED_PATH, (c) => {
  c.header('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors *")
  c.header('Referrer-Policy', 'no-referrer')
  c.header('X-Content-Type-Options', 'nosniff')
  c.header('X-Robots-Tag', 'noindex, nofollow')

  return c.html(
    '<!DOCTYPE html>' +
    (<html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>NOIM notice period calculator</title>
        <meta name="color-scheme" content="light dark" />
        <link rel="stylesheet" href="/pico.min.css" />
        <style>{`
          :root {
            --bg:#fff;
            --text:#111;
            --muted:#595959;
            --surface:#fafafa;
            --border:#e0e0e0;
            --card-shadow:0 0 0 1px rgba(0,0,0,0.07), 0 1px 2px -1px rgba(0,0,0,0.07), 0 4px 12px rgba(0,0,0,0.05);
          }
          @media (prefers-color-scheme:dark) {
            :root {
              --bg:#181818;
              --text:#f1f1f1;
              --muted:#b8b8b8;
              --surface:#111;
              --border:#333;
              --card-shadow:0 0 0 1px rgba(255,255,255,0.1);
            }
          }
          * { box-sizing:border-box; }
          html { -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale; background:var(--surface); }
          body { min-width:280px; margin:0; background:var(--surface); color:var(--text); }
          .embed-header { display:flex; align-items:center; min-height:54px; padding:10px 18px; background:#111; }
          .embed-header a { display:inline-flex; align-items:center; min-height:34px; }
          .embed-header img { display:block; width:auto; height:25px; }
          .notice-calculator { margin:0; padding:18px; background:var(--surface); }
          .notice-calculator h2 { margin:0 0 0.35rem; color:var(--text); font-size:1.25rem; text-wrap:balance; }
          .notice-calculator > p { color:var(--muted); text-wrap:pretty; }
          .notice-calculator > p:first-of-type { margin:0; font-size:0.9rem; }
          .notice-date-label { display:block; margin:0.9rem 0 0.35rem; color:var(--text); font-size:0.88rem; font-weight:650; }
          #notice-received-date { min-height:44px; margin:0 0 0.8rem; font-variant-numeric:tabular-nums; }
          .notice-window { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:0.65rem; }
          .notice-result { min-width:0; padding:0.85rem; border-radius:6px; background:var(--bg); box-shadow:var(--card-shadow); }
          .notice-result-label { display:block; min-height:2.2em; margin-bottom:0.3rem; color:var(--muted); font-size:0.68rem; font-weight:750; letter-spacing:0.04em; line-height:1.25; text-transform:uppercase; }
          .notice-result strong { display:block; color:var(--text); font-size:1rem; font-variant-numeric:tabular-nums; line-height:1.3; text-wrap:balance; }
          .notice-received-summary { margin:0.7rem 0 0; font-size:0.78rem; }
          .notice-received-summary strong { color:var(--text); font-variant-numeric:tabular-nums; }
          #notice-period-explanation { min-height:2.5em; margin:0.6rem 0 0; font-size:0.78rem; line-height:1.4; }
          .notice-rule { margin:0.75rem 0 0; padding-top:0.75rem; border-top:1px solid var(--border); font-size:0.72rem; line-height:1.45; }
          .notice-rule a { color:inherit; }
          @media (max-width:360px) {
            .embed-header { padding-inline:14px; }
            .notice-calculator { padding:14px; }
            .notice-result { padding:0.72rem; }
            .notice-result strong { font-size:0.9rem; }
          }
        `}</style>
      </head>
      <body>
        <header class="embed-header">
          <a href="https://noimeasy.au/" target="_blank" rel="noopener noreferrer" aria-label="Visit NOIM Easy">
            <img src="/logo.svg" alt="NOIM Easy" width="187" height="32" />
          </a>
        </header>
        <main>
          <NoticePeriodCalculator embedded />
        </main>
        <script dangerouslySetInnerHTML={{ __html: getNoticePeriodCalculatorScript() }} />
        <script dangerouslySetInnerHTML={{ __html: getNoticePeriodEmbedResizeScript() }} />
      </body>
    </html>).toString()
  )
})

// === Landing page ===
app.get('/', (c) => {
  const [beforeProcessMd, afterProcessMd = ''] = landingMd.split('[[NOTICE_PROCESS]]')
  const beforeProcessContent = markdownToHtml(beforeProcessMd)
  const afterProcessContent = markdownToHtml(afterProcessMd)
  return c.html(
    '<!DOCTYPE html>' +
    (<html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>NOIM Easy — Prepare your Notice of Intended Marriage</title>
        <meta name="description" content="NOIM Easy makes it simple to fill out and prepare your Australian Notice of Intended Marriage (NOIM). Complete the form online, download your PDF, and take it to your celebrant." />
        <meta property="og:title" content="NOIM Easy — Prepare your Notice of Intended Marriage" />
        <meta property="og:description" content="This app helps you prepare your Notice of Intended Marriage form accurately, privately, and in about 10 minutes." />
        <meta property="og:image" content="https://noimeasy.au/og-image.png" />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://noimeasy.au/" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="NOIM Easy — Prepare your Notice of Intended Marriage" />
        <meta name="twitter:description" content="This app helps you prepare your Notice of Intended Marriage form accurately, privately, and in about 10 minutes." />
        <meta name="twitter:image" content="https://noimeasy.au/og-image.png" />
        <meta name="color-scheme" content="light dark" />
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="preload" href="/pico.min.css" as="style" />
        <link rel="stylesheet" href="/pico.min.css" />
        <style>{`
          :root {
            --bg: #fff;
            --text: #111;
            --text-secondary: #222;
            --text-muted: #595959;
            --border: #e0e0e0;
            --surface: #fafafa;
            --header-bg: #111;
            --header-text: #fff;
            --header-border: #333;
            --cta-bg: #111;
            --cta-text: #fff;
            --cta-hover: #333;
            --accent-border: #111;
            --card-shadow:
              0 0 0 1px rgba(0,0,0,0.07),
              0 1px 2px -1px rgba(0,0,0,0.07),
              0 4px 12px rgba(0,0,0,0.05);
          }
          @media (prefers-color-scheme: dark) {
            :root {
              --bg: #1a1a1a;
              --text: #e4e4e4;
              --text-secondary: #d4d4d4;
              --text-muted: #a0a0a0;
              --border: #3a3a3a;
              --surface: #242424;
              --header-bg: #111;
              --header-text: #e4e4e4;
              --header-border: #3a3a3a;
              --cta-bg: #e4e4e4;
              --cta-text: #111;
              --cta-hover: #d0d0d0;
              --accent-border: #e4e4e4;
              --card-shadow: 0 0 0 1px rgba(255,255,255,0.1);
            }
          }
          html { -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; }
          body { background: var(--bg); color: var(--text); }
          .site-header {
            background: var(--header-bg);
            color: var(--header-text);
            padding: 1.25rem 0;
            border-bottom: 1px solid var(--header-border);
          }
          .site-header .container {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
            max-width: 700px;
            margin: 0 auto;
            padding: 0 1rem;
          }
          .site-header img {
            height: 32px;
            width: auto;
          }
          .header-cta {
            display:inline-flex;
            align-items:center;
            justify-content:center;
            min-height:44px;
            padding:10px 17px;
            border-radius:4px;
            background:#fff;
            color:#111;
            box-shadow:0 0 0 1px rgba(255,255,255,0.16), 0 2px 8px rgba(0,0,0,0.2);
            text-decoration:none;
            font-weight:650;
            font-size:0.9rem;
            white-space:nowrap;
            transition-property:background-color, scale, box-shadow;
            transition-duration:150ms;
            transition-timing-function:ease-out;
          }
          .header-cta:hover { background:#f0f0f0; box-shadow:0 0 0 1px rgba(255,255,255,0.22), 0 3px 10px rgba(0,0,0,0.28); }
          .header-cta:active { scale:0.96; }
          .landing { max-width: 700px; margin: 0 auto; padding-top: 0.5rem; }
          .landing h1 { margin-top: 2rem; margin-bottom: 0.5rem; color: var(--text); text-wrap:balance; }
          .landing h2 { color: var(--text); border-bottom: 1px solid var(--border); padding-bottom: 0.4rem; text-wrap:balance; }
          .landing h3 { color: var(--text-secondary); }
          .landing p, .landing li { text-wrap:pretty; }
          .landing hr { margin: 2rem 0; border-color: var(--border); }
          .process-section { margin:2.5rem 0 3rem; }
          .process-intro { color:var(--text-muted); margin-bottom:1.25rem; }
          .process-steps { display:grid; gap:0.75rem; margin:0; padding:0; list-style:none; counter-reset:noim-step; }
          .process-step {
            display:grid;
            grid-template-columns:44px minmax(0,1fr);
            gap:1rem;
            align-items:start;
            padding:1.1rem 1.15rem;
            border-radius:8px;
            background:var(--bg);
            box-shadow:var(--card-shadow);
          }
          .process-number {
            display:grid;
            place-items:center;
            width:44px;
            height:44px;
            border-radius:50%;
            background:var(--text);
            color:var(--bg);
            font-weight:750;
            font-variant-numeric:tabular-nums;
          }
          .process-step h3 { margin:0 0 0.25rem; color:var(--text); font-size:1rem; }
          .process-step p { margin:0; color:var(--text-muted); font-size:0.92rem; line-height:1.55; }
          .notice-calculator {
            margin:3rem 0;
            padding:1.5rem;
            border-radius:14px;
            background:var(--surface);
            box-shadow:var(--card-shadow);
          }
          .notice-calculator h2 { margin-top:0; }
          .notice-calculator > p { color:var(--text-muted); }
          .notice-date-label { display:block; margin:1.25rem 0 0.4rem; font-weight:650; color:var(--text); }
          #notice-received-date { min-height:48px; margin-bottom:1rem; font-variant-numeric:tabular-nums; }
          .notice-window { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:0.75rem; margin-top:0.25rem; }
          .notice-result {
            min-width:0;
            padding:1rem;
            border-radius:6px;
            background:var(--bg);
            box-shadow:var(--card-shadow);
          }
          .notice-result-label { display:block; margin-bottom:0.35rem; color:var(--text-muted); font-size:0.78rem; font-weight:700; letter-spacing:0.04em; text-transform:uppercase; }
          .notice-result strong { display:block; color:var(--text); font-size:1.08rem; line-height:1.35; font-variant-numeric:tabular-nums; text-wrap:balance; }
          #notice-period-explanation { min-height:2.9em; margin:0.9rem 0 0; color:var(--text-muted); font-size:0.84rem; line-height:1.45; }
          .notice-received-summary { margin:0.8rem 0 0; color:var(--text-muted); font-size:0.82rem; }
          .notice-received-summary strong { color:var(--text); font-variant-numeric:tabular-nums; }
          .notice-rule { margin-top:1rem; padding-top:1rem; border-top:1px solid var(--border); color:var(--text-muted); font-size:0.8rem; line-height:1.5; }
          .notice-rule a { color:inherit; }
          .embed-disclosure {
            margin:-2rem 0 3rem;
            border-radius:12px;
            background:var(--surface);
            box-shadow:var(--card-shadow);
          }
          .embed-disclosure summary {
            position:relative;
            display:flex;
            align-items:center;
            min-height:52px;
            padding:0.85rem 3rem 0.85rem 1.1rem;
            color:var(--text);
            cursor:pointer;
            font-weight:650;
            list-style:none;
            text-wrap:balance;
          }
          .embed-disclosure summary::-webkit-details-marker { display:none; }
          .embed-disclosure summary::after {
            content:"";
            position:absolute;
            right:1.25rem;
            width:9px;
            height:9px;
            border-right:2px solid currentColor;
            border-bottom:2px solid currentColor;
            transform:translateY(-2px) rotate(45deg);
            transition-property:transform;
            transition-duration:160ms;
            transition-timing-function:ease-out;
          }
          .embed-disclosure[open] summary::after { transform:translateY(2px) rotate(225deg); }
          .embed-disclosure summary:focus-visible { outline:2px solid var(--text); outline-offset:3px; border-radius:8px; }
          .embed-disclosure-content { padding:1rem 1.1rem 1.1rem; border-top:1px solid var(--border); }
          .embed-disclosure-content > p { margin:0 0 0.85rem; color:var(--text-muted); font-size:0.88rem; text-wrap:pretty; }
          .embed-code {
            max-height:260px;
            margin:0;
            padding:1rem;
            overflow:auto;
            border-radius:7px;
            background:#111;
            box-shadow:0 0 0 1px rgba(255,255,255,0.08) inset;
            color:#f5f5f5;
            font-size:0.76rem;
            line-height:1.55;
            text-align:left;
            white-space:pre;
          }
          .embed-code code { padding:0; background:transparent; color:inherit; }
          .embed-copy-row { display:flex; align-items:center; gap:0.8rem; margin-top:0.85rem; }
          #copy-notice-embed {
            min-height:44px;
            margin:0;
            padding:0.65rem 1rem;
            border:0;
            border-radius:5px;
            background:var(--text);
            color:var(--bg);
            font-size:0.85rem;
            font-weight:700;
            transition-property:scale,opacity;
            transition-duration:150ms;
            transition-timing-function:ease-out;
          }
          #copy-notice-embed:hover { opacity:0.84; }
          #copy-notice-embed:active { scale:0.96; }
          #notice-embed-status { color:var(--text-muted); font-size:0.82rem; }
          .cta { text-align: center; margin: 2.5rem 0; }
          .cta a {
            display: inline-block;
            padding: 14px 36px;
            font-size: 1.05rem;
            font-weight: 600;
            border-radius: 3px;
            text-decoration: none;
            background: var(--cta-bg);
            color: var(--cta-text);
            border: none;
            letter-spacing: 0.02em;
            transition: background 0.15s;
          }
          .cta a:hover { background: var(--cta-hover); }
          .privacy-notice {
            background: var(--surface);
            border: 1px solid var(--border);
            border-left: 3px solid var(--accent-border);
            border-radius: 2px;
            padding: 1.25rem 1.5rem;
            margin: 2rem 0;
            font-size: 0.92rem;
            line-height: 1.65;
          }
          .privacy-notice h3 {
            margin-top: 0;
            font-size: 1rem;
            color: var(--text);
            border: none;
            padding: 0;
          }
          .privacy-notice p { margin-bottom: 0.5rem; }
          .privacy-notice p:last-child { margin-bottom: 0; }
          .site-footer {
            text-align: center;
            padding: 2rem 1rem;
            font-size: 0.78rem;
            color: var(--text-muted);
            border-top: 1px solid var(--border);
            margin-top: 3rem;
            letter-spacing: 0.01em;
          }
          .site-footer a { color: var(--text-muted); text-decoration: underline; }
          .site-footer a:hover { color: var(--text-secondary); }
          .site-footer .credit { margin-top: 0.5rem; }
          .open-source {
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            margin-top: 0.75rem;
            padding: 0.4rem 0.8rem;
            border: 1px solid var(--border);
            border-radius: 3px;
            font-size: 0.78rem;
            color: var(--text-muted);
            text-decoration: none;
            transition: border-color 0.15s, color 0.15s;
          }
          .open-source:hover { border-color: var(--text-muted); color: var(--text-secondary); }
          .open-source svg { flex-shrink: 0; }
          @media (max-width: 520px) {
            .site-header img { height:28px; max-width:150px; }
            .header-cta { min-height:40px; padding:8px 12px; font-size:0.82rem; }
            .process-step { grid-template-columns:40px minmax(0,1fr); gap:0.75rem; padding:1rem; }
            .process-number { width:40px; height:40px; }
            .notice-calculator { padding:1.1rem; border-radius:12px; }
            .notice-window { grid-template-columns:1fr; }
            .embed-copy-row { align-items:stretch; flex-direction:column; }
            #copy-notice-embed { width:100%; }
          }
        `}</style>
      </head>
      <body>
        <div class="site-header">
          <div class="container">
            <a href="/" aria-label="NOIM Easy home">
              <img src="/logo.svg" alt="NOIM Easy" width="187" height="32" />
            </a>
            <nav aria-label="Primary navigation">
              <a class="header-cta" href="/prepare">Prepare a NOIM</a>
            </nav>
          </div>
        </div>

        <main class="container landing">
          <div dangerouslySetInnerHTML={{ __html: beforeProcessContent }} />

          <section class="process-section" aria-labelledby="after-noim-heading">
            <h2 id="after-noim-heading">What happens after your PDF is created?</h2>
            <p class="process-intro">
              Creating the PDF prepares the form. It does not give legal notice by itself.
            </p>
            <ol class="process-steps">
              <li class="process-step">
                <span class="process-number" aria-hidden="true">1</span>
                <div>
                  <h3>Review the prepared NOIM</h3>
                  <p>Download the PDF and check every detail against your supporting documents before anyone signs it.</p>
                </div>
              </li>
              <li class="process-step">
                <span class="process-number" aria-hidden="true">2</span>
                <div>
                  <h3>Sign under an authorised witness's observation</h3>
                  <p>Each party signs in person or by audio-visual link under the current location rules. The witness can be one of the authorised people listed below, including the celebrant who will marry you.</p>
                </div>
              </li>
              <li class="process-step">
                <span class="process-number" aria-hidden="true">3</span>
                <div>
                  <h3>Give the signed NOIM to your celebrant</h3>
                  <p>Your celebrant can receive the completed and witnessed NOIM physically or as a scanned or emailed copy. They will review it and record the date received.</p>
                </div>
              </li>
              <li class="process-step">
                <span class="process-number" aria-hidden="true">4</span>
                <div>
                  <h3>The legal notice window begins</h3>
                  <p>The one-month period starts when the celebrant receives the completed and signed NOIM—not when this PDF is generated, a booking is made, or a deposit is paid. The marriage must ordinarily occur within the following 18-month window.</p>
                </div>
              </li>
            </ol>
          </section>

          <NoticePeriodCalculator />

          <details class="embed-disclosure">
            <summary>Embed this calculator on your website</summary>
            <div class="embed-disclosure-content">
              <p>Copy and paste this code into your website. It includes the calculator and its attribution links.</p>
              <pre class="embed-code"><code id="notice-embed-code">{NOTICE_PERIOD_EMBED_CODE}</code></pre>
              <div class="embed-copy-row">
                <button type="button" id="copy-notice-embed">Copy embed code</button>
                <span id="notice-embed-status" role="status" aria-live="polite"></span>
              </div>
            </div>
          </details>

          <div dangerouslySetInnerHTML={{ __html: afterProcessContent }} />

          <div class="privacy-notice">
            <h3>Privacy notice</h3>
            <p>
              <strong>We do not store any of your data.</strong> The information you enter is used only to generate your NOIM PDF in your browser session. Nothing is saved to a database, no data is logged, and no personal information is retained on our servers after your PDF is generated.
            </p>
            <p>
              No analytics or tracking are used on this site. After you finish editing an address, the completed address is sent once to OpenStreetMap Nominatim to find suggestions. The app does not send address requests on each keystroke.
            </p>
            <p>
              If you have any concerns about providing your information online, you do not need to use this service. You are welcome to contact your marriage celebrant directly and complete the NOIM form in person.
            </p>
          </div>

          <div class="cta">
            <a href="/prepare" role="button">Prepare your NOIM now</a>
          </div>
        </main>

        <footer class="site-footer">
          NOIM Easy is a preparation tool only. It does not constitute legal advice.
          <div class="credit">Another <a href="https://unpopular.au">Unpopular</a> website on <a href="https://theinternet.com.au">The Internet</a> made by <a href="https://marriedbyjosh.com">Josh</a> for the benefit and use of the entire marriage celebrant community.</div>
          <div>
            <a href="https://github.com/joshwithers/noimeasy" class="open-source">
              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 16 16" fill="currentColor"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0016 8c0-4.42-3.58-8-8-8z"/></svg>
              Open source — view code, verify privacy, or run your own
            </a>
          </div>
        </footer>
        <script dangerouslySetInnerHTML={{ __html: getNoticePeriodCalculatorScript() }} />
        <script dangerouslySetInnerHTML={{ __html: getNoticePeriodEmbedCopyScript() }} />
      </body>
    </html>).toString()
  )
})

// === NOIM form ===
app.get('/prepare', (c) => {
  return c.html(
    '<!DOCTYPE html>' +
    (<NoimFormPage
      submitUrl="/submit"
    />).toString()
  )
})

// === Form submission ===
app.post('/submit', async (c) => {
  const requestRejection = formRequestRejection(c.req.raw)
  if (requestRejection) {
    return c.json({ ok: false, error: requestRejection.error }, requestRejection.status)
  }

  const rateLimitKey = c.req.header('CF-Connecting-IP')
    || c.req.header('X-Forwarded-For')?.split(',')[0]?.trim()
    || 'anonymous'
  const rateLimit = await c.env.PDF_RATE_LIMITER.limit({ key: `pdf:${rateLimitKey}` })
  if (!rateLimit.success) {
    return c.json(
      { ok: false, error: 'Too many PDF requests. Please wait a minute and try again.' },
      429,
      { 'Retry-After': '60' },
    )
  }

  let body: Record<string, unknown>
  try {
    body = await parseFormBodyWithLimit(c.req.raw)
  } catch (error) {
    if (error instanceof FormBodyTooLargeError) {
      return c.json({ ok: false, error: 'Form submission is too large.' }, 413)
    }
    throw error
  }

  // Honeypot check
  if (typeof body['_hp'] === 'string' && body['_hp'].trim()) {
    return c.json({ ok: false, error: 'Unable to process this submission.' }, 422)
  }

  const validation = validateNoimSubmission(body)
  if (!validation.valid) {
    const firstError = Object.values(validation.errors)[0] || 'Please check the form and try again.'
    return c.json({ ok: false, error: firstError, fields: validation.errors }, 400)
  }
  const data = validation.data

  // Generate PDF — this is the only thing we do with the data
  let pdfBytes: Uint8Array
  try {
    pdfBytes = await generateNoimPdf(data)
  } catch (error) {
    if (error instanceof UnsupportedPdfCharacterError) {
      return c.json({
        ok: false,
        error: `The character ${JSON.stringify(error.character)} cannot be rendered safely in the official NOIM PDF. Please use the spelling shown in the Roman-alphabet section of the supporting document, or ask your celebrant for help.`,
      }, 422)
    }
    if (error instanceof PdfFieldOverflowError) {
      return c.json({
        ok: false,
        error: `${error.fieldLabel} is too long to fit legibly in the official NOIM PDF. Check the particulars against the supporting documents and ask an authorised celebrant for help rather than letting the legal form clip them.`,
      }, 422)
    }
    throw error
  }
  const pdfFilename = safePdfFilename(data)

  // Return the PDF directly — nothing is stored
  return new Response(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${pdfFilename}"`,
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
})

export default app
