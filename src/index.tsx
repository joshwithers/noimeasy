import { Hono } from 'hono'
import type { Env } from './types'
import { NoimFormPage } from './forms/noim/index'
import { markdownToHtml } from './landing'
import { generateNoimPdf } from './forms/noim/pdf-generator'
import {
  renderNoimEmail,
  getNoimEmailSubject,
  renderCoupleConfirmationEmail,
} from './forms/noim/email-template'
import landingMd from '../content/landing.md'

const app = new Hono<Env>()

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
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css" />
        <style>{`
          :root {
            --gov-navy: #1c3d5a;
            --gov-dark: #0d1f2d;
            --gov-accent: #2a6496;
            --gov-gold: #b08d2e;
            --gov-border: #d6d9dc;
            --gov-bg: #f5f6f8;
          }
          body { background: var(--gov-bg); color: #1a1a1a; }
          .site-header {
            background: var(--gov-navy);
            color: #fff;
            padding: 1rem 0;
            margin-bottom: 2rem;
            border-bottom: 4px solid var(--gov-gold);
          }
          .site-header .container {
            display: flex;
            align-items: center;
            gap: 14px;
            max-width: 700px;
            margin: 0 auto;
            padding: 0 1rem;
          }
          .site-header svg { flex-shrink: 0; }
          .site-header h1 {
            margin: 0;
            font-size: 1.4rem;
            font-weight: 700;
            letter-spacing: 0.02em;
          }
          .site-header p {
            margin: 2px 0 0;
            font-size: 0.85rem;
            color: #b8c7d6;
          }
          .landing { max-width: 700px; margin: 0 auto; }
          .landing h1 { text-align: center; margin-bottom: 0.5rem; }
          .landing h2 { color: var(--gov-navy); border-bottom: 2px solid var(--gov-border); padding-bottom: 0.4rem; }
          .landing h3 { color: var(--gov-navy); }
          .landing hr { margin: 2rem 0; border-color: var(--gov-border); }
          .cta { text-align: center; margin: 2.5rem 0; }
          .cta a {
            display: inline-block;
            padding: 14px 32px;
            font-size: 1.1rem;
            font-weight: 600;
            border-radius: 4px;
            text-decoration: none;
            background: var(--gov-navy);
            color: #fff;
            border: none;
          }
          .cta a:hover { background: var(--gov-accent); }
          .privacy-notice {
            background: #fff;
            border: 1px solid var(--gov-border);
            border-left: 4px solid var(--gov-navy);
            border-radius: 2px;
            padding: 1.25rem 1.5rem;
            margin: 2rem 0;
            font-size: 0.92rem;
            line-height: 1.6;
          }
          .privacy-notice h3 {
            margin-top: 0;
            font-size: 1rem;
            border: none;
            padding: 0;
          }
          .privacy-notice p { margin-bottom: 0.5rem; }
          .privacy-notice p:last-child { margin-bottom: 0; }
          .site-footer {
            text-align: center;
            padding: 2rem 1rem;
            font-size: 0.8rem;
            color: #6b7280;
            border-top: 1px solid var(--gov-border);
            margin-top: 3rem;
          }
        `}</style>
      </head>
      <body>
        <div class="site-header">
          <div class="container">
            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="8" y1="13" x2="16" y2="13" />
              <line x1="8" y1="17" x2="16" y2="17" />
              <line x1="8" y1="9" x2="10" y2="9" />
            </svg>
            <div>
              <h1>NOIM Easy</h1>
              <p>Prepare your Notice of Intended Marriage</p>
            </div>
          </div>
        </div>

        <main class="container landing">
          <div dangerouslySetInnerHTML={{ __html: content }} />

          <div class="privacy-notice">
            <h3>Privacy notice</h3>
            <p>
              The information you enter into this form is used solely to generate your NOIM PDF and send it to your nominated celebrant. <strong>We do not store, retain, or share your personal information.</strong> Once your PDF is generated and delivered, your data is not kept on our servers.
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

  // Generate PDF
  const pdfBytes = await generateNoimPdf(data)

  // Store PDF in KV with 24h TTL
  const pdfId = crypto.randomUUID()
  const p1Last = data['p1_last_name'] || 'Party1'
  const p2Last = data['p2_last_name'] || 'Party2'
  const pdfFilename = `NOIM-${p1Last}-${p2Last}.pdf`

  await c.env.KV.put(`pdf:${pdfId}`, pdfBytes, {
    expirationTtl: 86400, // 24 hours
    metadata: { filename: pdfFilename },
  })

  // Send emails in background
  c.executionCtx.waitUntil(
    sendEmails(c.env, data, pdfBytes, pdfFilename)
  )

  // Redirect to success page
  return c.redirect(`/success/${pdfId}`, 302)
})

// === Success page ===
app.get('/success/:id', (c) => {
  const id = c.req.param('id')
  return c.html(
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>NOIM Ready — NOIM Easy</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@picocss/pico@2/css/pico.min.css" />
        <style>{`
          :root {
            --gov-navy: #1c3d5a;
            --gov-gold: #b08d2e;
            --gov-border: #d6d9dc;
            --gov-bg: #f5f6f8;
          }
          body { background: var(--gov-bg); color: #1a1a1a; }
          .site-header {
            background: var(--gov-navy);
            color: #fff;
            padding: 1rem 0;
            margin-bottom: 2rem;
            border-bottom: 4px solid var(--gov-gold);
          }
          .site-header .container {
            display: flex;
            align-items: center;
            gap: 14px;
            max-width: 600px;
            margin: 0 auto;
            padding: 0 1rem;
          }
          .site-header svg { flex-shrink: 0; }
          .site-header h1 {
            margin: 0;
            font-size: 1.4rem;
            font-weight: 700;
            letter-spacing: 0.02em;
          }
          .site-header h1 a { color: #fff; text-decoration: none; }
          .site-header p {
            margin: 2px 0 0;
            font-size: 0.85rem;
            color: #b8c7d6;
          }
          .success { max-width: 600px; margin: 0 auto; text-align: center; }
          .checkmark {
            width: 64px; height: 64px;
            background: var(--gov-navy);
            color: #fff;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 2rem;
            margin: 0 auto 1rem;
          }
          .download-btn {
            display: inline-block;
            padding: 14px 32px;
            font-size: 1.1rem;
            font-weight: 600;
            border-radius: 4px;
            text-decoration: none;
            margin: 1.5rem 0;
            background: var(--gov-navy);
            color: #fff;
            border: none;
          }
          .download-btn:hover { background: #2a6496; }
          .next-steps { text-align: left; margin-top: 2rem; background: #fff; border: 1px solid var(--gov-border); border-radius: 4px; padding: 1.5rem; }
          .next-steps h3 { color: var(--gov-navy); margin-top: 0; }
          .next-steps li { margin-bottom: 0.5rem; }
          .expiry { color: #6b7280; font-size: 14px; margin-top: 1rem; }
          .site-footer {
            text-align: center;
            padding: 2rem 1rem;
            font-size: 0.8rem;
            color: #6b7280;
            border-top: 1px solid var(--gov-border);
            margin-top: 3rem;
          }
        `}</style>
      </head>
      <body>
        <div class="site-header">
          <div class="container">
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="8" y1="13" x2="16" y2="13" />
              <line x1="8" y1="17" x2="16" y2="17" />
              <line x1="8" y1="9" x2="10" y2="9" />
            </svg>
            <div>
              <h1><a href="/">NOIM Easy</a></h1>
              <p>Prepare your Notice of Intended Marriage</p>
            </div>
          </div>
        </div>

        <main class="container success">
          <div class="checkmark">&#10003;</div>
          <h1 style="color:var(--gov-navy)">Your NOIM is ready</h1>
          <p>Your Notice of Intended Marriage has been prepared and is ready to download.</p>

          <a href={`/download/${id}`} role="button" class="download-btn">Download NOIM PDF</a>

          <p class="expiry">This download link expires in 24 hours.</p>

          <div class="next-steps">
            <h3>What to do next</h3>
            <ol>
              <li><strong>Print</strong> the PDF</li>
              <li><strong>Sign</strong> the form in front of an authorised witness (JP, solicitor, police officer, doctor, or your celebrant)</li>
              <li><strong>Give</strong> the signed NOIM to your celebrant along with your ID documents</li>
              <li>Your celebrant will verify everything and lodge it officially</li>
            </ol>
          </div>

          <p style="margin-top:2rem">
            <a href="/">&#8592; Back to home</a>
          </p>
        </main>

        <footer class="site-footer">
          NOIM Easy is a preparation tool only. It does not constitute legal advice.
        </footer>
      </body>
    </html>
  )
})

// === PDF download ===
app.get('/download/:id', async (c) => {
  const id = c.req.param('id')
  const { value, metadata } = await c.env.KV.getWithMetadata<{ filename: string }>(
    `pdf:${id}`,
    'arrayBuffer'
  )

  if (!value) {
    return c.text('This download link has expired. Please prepare your NOIM again.', 404)
  }

  const filename = metadata?.filename || 'NOIM.pdf'
  return new Response(value, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  })
})

// === Email sending ===
async function sendEmails(
  env: { RESEND_API_KEY: string; NOTIFICATION_EMAIL: string },
  data: Record<string, string>,
  pdfBytes: Uint8Array,
  pdfFilename: string,
) {
  const from = 'NOIM Easy <forms@noimeasy.au>'

  const attachments: { filename: string; content: string }[] = [
    { filename: pdfFilename, content: toBase64(pdfBytes) },
  ]

  // 1. Notification to Josh
  const subject = getNoimEmailSubject(data)
  const html = renderNoimEmail(data)

  await sendViaResend(env.RESEND_API_KEY, {
    from,
    to: env.NOTIFICATION_EMAIL,
    subject,
    html,
    attachments,
  })

  // 2. Confirmation to couple (with PDF attached)
  const coupleEmails: string[] = []
  if (data['p1_email']) coupleEmails.push(data['p1_email'])
  if (data['p2_email'] && data['p2_email'] !== data['p1_email']) {
    coupleEmails.push(data['p2_email'])
  }

  if (coupleEmails.length > 0 && data['send_copy'] === 'yes') {
    const coupleHtml = renderCoupleConfirmationEmail(data)
    await sendViaResend(env.RESEND_API_KEY, {
      from,
      to: coupleEmails,
      subject: 'Your Notice of Intended Marriage is ready',
      html: coupleHtml,
      attachments: [{ filename: pdfFilename, content: toBase64(pdfBytes) }],
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
    console.error(`Resend error: ${response.status} ${err}`)
  }
}

export default app
