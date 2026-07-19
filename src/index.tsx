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
import landingMd from '../content/landing.md'
import logoSvg from '../content/logo.svg'
import faviconPng from '../content/favicon.png'
import ogImagePng from '../content/og-image.png'
import picoCss from '../content/pico.min.css'
import occupationsText from './forms/noim/occupations.txt'

const app = new Hono<Env>()

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

// === Landing page ===
app.get('/', (c) => {
  const content = markdownToHtml(landingMd)
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
            }
          }
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
            max-width: 700px;
            margin: 0 auto;
            padding: 0 1rem;
          }
          .site-header img {
            height: 32px;
            width: auto;
          }
          .landing { max-width: 700px; margin: 0 auto; padding-top: 0.5rem; }
          .landing h1 { margin-top: 2rem; margin-bottom: 0.5rem; color: var(--text); }
          .landing h2 { color: var(--text); border-bottom: 1px solid var(--border); padding-bottom: 0.4rem; }
          .landing h3 { color: var(--text-secondary); }
          .landing hr { margin: 2rem 0; border-color: var(--border); }
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
        `}</style>
      </head>
      <body>
        <div class="site-header">
          <div class="container">
            <img src="/logo.svg" alt="NOIM Easy" width="187" height="32" />
          </div>
        </div>

        <main class="container landing">
          <div dangerouslySetInnerHTML={{ __html: content }} />

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
