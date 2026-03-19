import { Hono } from 'hono'
import type { Env } from './types'
import { NoimFormPage } from './forms/noim/index'
import { markdownToHtml } from './landing'
import { generateNoimPdf } from './forms/noim/pdf-generator'
import {
  getNoimEmailSubject,
  renderNoimEmail,
  renderCoupleConfirmationEmail,
} from './forms/noim/email-template'
import landingMd from '../content/landing.md'
import logoSvg from '../content/logo.svg'
import faviconPng from '../content/favicon.png'
import ogImagePng from '../content/og-image.png'
import picoCss from '../content/pico.min.css'

const app = new Hono<Env>()

// === Static assets ===
app.get('/logo.svg', (c) => {
  return new Response(logoSvg, {
    headers: { 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' },
  })
})

app.get('/favicon.png', (c) => {
  return new Response(faviconPng, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' },
  })
})

app.get('/og-image.png', (c) => {
  return new Response(ogImagePng, {
    headers: { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' },
  })
})

app.get('/pico.min.css', (c) => {
  return new Response(picoCss, {
    headers: { 'Content-Type': 'text/css', 'Cache-Control': 'public, max-age=86400' },
  })
})

// === Landing page ===
app.get('/', (c) => {
  const content = markdownToHtml(landingMd)
  return c.html(
    <html lang="en">
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
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="stylesheet" href="/pico.min.css" />
        <style>{`
          body { background: #fff; color: #111; }
          .site-header {
            background: #111;
            color: #fff;
            padding: 1.25rem 0;
            border-bottom: 1px solid #333;
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
          .landing h1 { margin-top: 2rem; margin-bottom: 0.5rem; color: #111; }
          .landing h2 { color: #111; border-bottom: 1px solid #e0e0e0; padding-bottom: 0.4rem; }
          .landing h3 { color: #222; }
          .landing hr { margin: 2rem 0; border-color: #e0e0e0; }
          .cta { text-align: center; margin: 2.5rem 0; }
          .cta a {
            display: inline-block;
            padding: 14px 36px;
            font-size: 1.05rem;
            font-weight: 600;
            border-radius: 3px;
            text-decoration: none;
            background: #111;
            color: #fff;
            border: none;
            letter-spacing: 0.02em;
            transition: background 0.15s;
          }
          .cta a:hover { background: #333; }
          .privacy-notice {
            background: #fafafa;
            border: 1px solid #e0e0e0;
            border-left: 3px solid #111;
            border-radius: 2px;
            padding: 1.25rem 1.5rem;
            margin: 2rem 0;
            font-size: 0.92rem;
            line-height: 1.65;
          }
          .privacy-notice h3 {
            margin-top: 0;
            font-size: 1rem;
            color: #111;
            border: none;
            padding: 0;
          }
          .privacy-notice p { margin-bottom: 0.5rem; }
          .privacy-notice p:last-child { margin-bottom: 0; }
          .site-footer {
            text-align: center;
            padding: 2rem 1rem;
            font-size: 0.78rem;
            color: #999;
            border-top: 1px solid #e0e0e0;
            margin-top: 3rem;
            letter-spacing: 0.01em;
          }
          .site-footer a { color: #999; text-decoration: underline; }
          .site-footer a:hover { color: #666; }
          .site-footer .credit { margin-top: 0.5rem; }
        `}</style>
      </head>
      <body>
        <div class="site-header">
          <div class="container">
            <img src="/logo.svg" alt="NOIM Easy" />
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
              If you choose to email the PDF to a celebrant or to yourself, that email is sent via a third-party email provider (Resend) and we do not keep a copy. No analytics or tracking are used on this site.
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
          <div class="credit">Another <a href="https://unpopular.au">Unpopular</a> website on <a href="https://theinternet.com.au">The Internet</a></div>
        </footer>
      </body>
    </html>
  )
})

// === NOIM form ===
app.get('/prepare', (c) => {
  return c.html(
    <NoimFormPage
      googleMapsApiKey={c.env.GOOGLE_MAPS_API_KEY}
      submitUrl="/submit"
    />
  )
})

// === Form submission ===
app.post('/submit', async (c) => {
  const body = await c.req.parseBody()
  const data: Record<string, string> = {}
  for (const [key, value] of Object.entries(body)) {
    data[key] = String(value)
  }

  // Honeypot check
  if (data['_hp']) {
    return c.text('Thank you for your submission.', 200)
  }
  delete data['_hp']

  // Generate PDF — this is the only thing we do with the data
  const pdfBytes = await generateNoimPdf(data)
  const p1Last = data['p1_last_name'] || 'Party1'
  const p2Last = data['p2_last_name'] || 'Party2'
  const pdfFilename = `NOIM-${p1Last}-${p2Last}.pdf`

  // Return the PDF directly — nothing is stored
  return new Response(pdfBytes, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${pdfFilename}"`,
    },
  })
})

app.post('/send-emails', async (c) => {
  const body = await c.req.parseBody()
  const data: Record<string, string> = {}
  for (const [key, value] of Object.entries(body)) {
    data[key] = String(value)
  }

  const celebrantEmail = data['celebrant_email']?.trim()
  const coupleEmail = data['couple_email']?.trim()

  if (!celebrantEmail && !coupleEmail) {
    return c.json({ ok: false, error: 'No email addresses provided' }, 400)
  }

  // Generate the PDF again for the attachment
  const pdfBytes = await generateNoimPdf(data)
  const p1Last = data['p1_last_name'] || 'Party1'
  const p2Last = data['p2_last_name'] || 'Party2'
  const pdfFilename = `NOIM-${p1Last}-${p2Last}.pdf`

  if (!c.env.RESEND_API_KEY) {
    return c.json({ ok: false, error: 'Email sending is not configured. Please download your PDF and email it manually.' }, 500)
  }

  try {
    await sendEmails(c.env, data, pdfBytes, pdfFilename, celebrantEmail, coupleEmail)
    return c.json({ ok: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('Email send failed:', message)
    return c.json({ ok: false, error: 'Failed to send emails. Please try again or email the PDF manually.' }, 500)
  }
})

// === Email sending ===
async function sendEmails(
  env: { RESEND_API_KEY: string; EMAIL_FROM: string },
  data: Record<string, string>,
  pdfBytes: Uint8Array,
  pdfFilename: string,
  celebrantEmail?: string,
  coupleEmail?: string,
) {
  const from = env.EMAIL_FROM || 'NOIM Easy <noreply@example.com>'
  const attachments = [{ filename: pdfFilename, content: toBase64(pdfBytes) }]

  // Send to celebrant / third party if provided
  if (celebrantEmail) {
    const html = renderNoimEmail(data)
    await sendViaResend(env.RESEND_API_KEY, {
      from,
      to: celebrantEmail,
      subject: getNoimEmailSubject(data),
      html,
      attachments,
    })
  }

  // Send copy to the couple if provided
  if (coupleEmail) {
    const html = renderCoupleConfirmationEmail(data)
    await sendViaResend(env.RESEND_API_KEY, {
      from,
      to: coupleEmail,
      subject: 'Your Notice of Intended Marriage is ready',
      html,
      attachments,
    })
  }
}

function toBase64(bytes: Uint8Array): string {
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

async function sendViaResend(
  apiKey: string,
  email: {
    from: string
    to: string | string[]
    subject: string
    html: string
    attachments?: { filename: string; content: string }[]
  }
) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: email.from,
      to: Array.isArray(email.to) ? email.to : [email.to],
      subject: email.subject,
      html: email.html,
      attachments: email.attachments,
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Resend error: ${response.status} ${err}`)
  }
}

export default app
