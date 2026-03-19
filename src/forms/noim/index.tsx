import type { FC } from 'hono/jsx'
import { noimSteps, type NoimField, type NoimStep } from './schema'
import { getNoimClientScript } from './logic'
// Countries list is now embedded in client JS (logic.ts) for the custom dropdown

const NoimFieldComponent: FC<{ field: NoimField }> = ({ field }) => {
  const wrapperAttrs: Record<string, string> = { class: 'noim-field' }
  if (field.conditions && field.conditions.length > 0) {
    wrapperAttrs['data-conditions'] = JSON.stringify(field.conditions)
    wrapperAttrs['style'] = 'display:none'
  }

  if (field.type === 'checkbox') {
    return (
      <div {...wrapperAttrs}>
        <label style="display:inline-flex;align-items:center;gap:8px;font-weight:normal;cursor:pointer">
          <input
            type="checkbox"
            name={field.name}
            value="yes"
          />
          {field.label}
        </label>
        {field.helpText && <small style="color:var(--text-hint);display:block;margin-top:4px">{field.helpText}</small>}
      </div>
    )
  }

  return (
    <div {...wrapperAttrs}>
      <label>
        {field.label}
        {field.required && <span style="color:var(--required)"> *</span>}

        {field.type === 'country' ? (
          <div class="country-select">
            <input
              type="text"
              name={field.name}
              class="country-search"
              required={field.required}
              data-was-required={field.required ? 'true' : 'false'}
              placeholder="Start typing a country..."
              autocomplete="off"
            />
            <div class="country-dropdown"></div>
          </div>
        ) : field.type === 'text' || field.type === 'email' || field.type === 'date' ? (
          <input
            type={field.type}
            name={field.name}
            required={field.required}
            data-was-required={field.required ? 'true' : 'false'}
            data-title-case={field.titleCase ? 'true' : undefined}
            placeholder={field.placeholder || ''}
          />
        ) : field.type === 'textarea' ? (
          <textarea
            name={field.name}
            required={field.required}
            data-was-required={field.required ? 'true' : 'false'}
            placeholder={field.placeholder || ''}
            rows={3}
          />
        ) : field.type === 'select' ? (
          <select
            name={field.name}
            required={field.required}
            data-was-required={field.required ? 'true' : 'false'}
          >
            <option value="">— Select —</option>
            {field.options?.map((opt) => (
              <option value={opt.value}>{opt.label}</option>
            ))}
          </select>
        ) : field.type === 'radio' ? (
          <fieldset style="border:none;padding:0;margin:4px 0">
            {field.options?.map((opt) => (
              <label style="display:inline-flex;align-items:center;gap:4px;margin-right:1rem;font-weight:normal">
                <input
                  type="radio"
                  name={field.name}
                  value={opt.value}
                  required={field.required}
                  data-was-required={field.required ? 'true' : 'false'}
                />
                {opt.label}
              </label>
            ))}
          </fieldset>
        ) : field.type === 'address' ? (
          <div class="address-select">
            <input
              type="text"
              name={field.name}
              class="address-input"
              required={field.required}
              data-was-required={field.required ? 'true' : 'false'}
              placeholder="Start typing an address..."
              autocomplete="off"
            />
            <div class="address-dropdown"></div>
            {/* Hidden fields for structured address components */}
            <input type="hidden" name={`${field.name}_street`} />
            <input type="hidden" name={`${field.name}_suburb`} />
            <input type="hidden" name={`${field.name}_state`} />
            <input type="hidden" name={`${field.name}_postcode`} />
          </div>
        ) : null}
      </label>
      {field.helpText && <small style="color:var(--text-hint)">{field.helpText}</small>}
    </div>
  )
}

const NoimStepComponent: FC<{ step: NoimStep; index: number }> = ({ step, index }) => (
  <div class="noim-step" style={index === 0 ? '' : 'display:none'}>
    <hgroup>
      <h3>{step.title}</h3>
      {step.description && <p>{step.description}</p>}
    </hgroup>

    {step.id === 'documents' ? (
      <div id="document-checklist">
        <p style="color:var(--text-muted)">Navigate to this step after filling in your details to see your required documents.</p>
      </div>
    ) : step.id === 'review' ? (
      <div>
        {step.fields.map((field) => <NoimFieldComponent field={field} />)}
        <button type="submit" id="submit-btn-top" style="display:none;width:100%;margin-bottom:1.5rem">Generate my NOIM PDF</button>
        <div id="email-feedback" style="display:none;margin-bottom:1.5rem;padding:12px 16px;border-radius:3px;font-size:0.92rem"></div>
        <div id="review-section">
          <p style="color:var(--text-muted)">Navigate to this step to review all your details before submitting.</p>
        </div>
      </div>
    ) : (
      step.fields.map((field) => <NoimFieldComponent field={field} />)
    )}
  </div>
)

export const NoimFormPage: FC<{
  googleMapsApiKey: string
  submitUrl: string
}> = ({ googleMapsApiKey, submitUrl }) => (
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>Prepare your NOIM — NOIM Easy</title>
      <meta name="description" content="NOIM Easy makes it simple to fill out and prepare your Australian Notice of Intended Marriage (NOIM). Complete the form online, download your PDF, and take it to your celebrant." />
      <meta property="og:title" content="Prepare your NOIM — NOIM Easy" />
      <meta property="og:description" content="This app helps you prepare your Notice of Intended Marriage form accurately, privately, and in about 10 minutes." />
      <meta property="og:image" content="https://noimeasy.au/og-image.png" />
      <meta property="og:type" content="website" />
      <meta property="og:url" content="https://noimeasy.au/prepare" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="Prepare your NOIM — NOIM Easy" />
      <meta name="twitter:description" content="This app helps you prepare your Notice of Intended Marriage form accurately, privately, and in about 10 minutes." />
      <meta name="twitter:image" content="https://noimeasy.au/og-image.png" />
      <meta name="color-scheme" content="light dark" />
      <link rel="icon" type="image/png" href="/favicon.png" />
      <link rel="stylesheet" href="/pico.min.css" />
      <style>{`
        :root {
          --bg: #fff;
          --text: #111;
          --text-muted: #595959;
          --text-hint: #6b7280;
          --border: #e0e0e0;
          --border-subtle: #f0f0f0;
          --border-input: #d0d0d0;
          --surface: #fafafa;
          --surface-hover: #f5f5f5;
          --header-bg: #111;
          --header-text: #fff;
          --header-border: #333;
          --dropdown-shadow: rgba(0,0,0,0.08);
          --powered-text: #888;
          --required: #dc2626;
          --success-bg: #e8f5e9;
          --success-text: #2e7d32;
          --success-border: #c8e6c9;
          --error-bg: #fbe9e7;
          --error-text: #c62828;
          --error-border: #ffccbc;
          --input-bg: #fff;
          --input-text: #111;
          --input-border: #d0d0d0;
        }
        @media (prefers-color-scheme: dark) {
          :root {
            --bg: #1a1a1a;
            --text: #e4e4e4;
            --text-muted: #a0a0a0;
            --text-hint: #9ca3af;
            --border: #3a3a3a;
            --border-subtle: #2e2e2e;
            --border-input: #4a4a4a;
            --surface: #242424;
            --surface-hover: #2e2e2e;
            --header-bg: #111;
            --header-text: #e4e4e4;
            --header-border: #3a3a3a;
            --dropdown-shadow: rgba(0,0,0,0.3);
            --powered-text: #888;
            --required: #f87171;
            --success-bg: #14532d;
            --success-text: #86efac;
            --success-border: #166534;
            --error-bg: #450a0a;
            --error-text: #fca5a5;
            --error-border: #7f1d1d;
            --input-bg: #242424;
            --input-text: #e4e4e4;
            --input-border: #4a4a4a;
          }
          /* Override Pico's form element defaults for dark mode */
          input, select, textarea {
            background-color: var(--input-bg) !important;
            color: var(--input-text) !important;
            border-color: var(--input-border) !important;
          }
          input::placeholder, textarea::placeholder {
            color: var(--text-muted) !important;
          }
          input:focus, select:focus, textarea:focus {
            border-color: #6b9fff !important;
            outline-color: #6b9fff;
          }
          select option {
            background-color: var(--input-bg);
            color: var(--input-text);
          }
        }
        body { background: var(--bg); color: var(--text); }
        .site-header {
          background: var(--header-bg);
          color: var(--header-text);
          padding: 1.25rem 0;
          border-bottom: 1px solid var(--header-border);
        }
        .site-header .inner {
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
        .noim-field { margin-bottom: 1rem; }
        .step-nav { display: flex; justify-content: space-between; align-items: center; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--border); }
        .step-nav button { min-width: 120px; border-radius: 3px; }
        #step-indicator { color: var(--text-muted); font-size: 14px; letter-spacing: 0.02em; }
        hgroup { margin-bottom: 1.5rem; }
        hgroup h3 { color: var(--text); }
        fieldset { margin: 0; }
        .address-input { width: 100%; }
        .middle-name-hint { display:none; margin-top:4px; font-size:13px; }
        .address-fallback-note { color:var(--text-muted); font-size:13px; margin-top:4px; }

        /* Country searchable dropdown */
        .country-select { position: relative; }
        .country-dropdown {
          display: none; position: absolute; z-index: 100; width: 100%;
          max-height: 220px; overflow-y: auto;
          background: var(--bg);
          border: 1px solid var(--border-input);
          border-top: none; border-radius: 0 0 3px 3px;
          box-shadow: 0 4px 12px var(--dropdown-shadow);
        }
        .country-option {
          padding: 10px 14px; cursor: pointer; font-size: 15px;
          border-bottom: 1px solid var(--border-subtle);
          color: var(--text);
        }
        .country-option:last-child { border-bottom: none; }
        .country-option:hover, .country-option:focus {
          background: var(--surface-hover);
        }
        .country-option[style*="display: none"] + .country-option { border-top: none; }

        /* Address searchable dropdown */
        .address-select { position: relative; }
        .address-dropdown {
          display: none; position: absolute; z-index: 100; width: 100%;
          max-height: 260px; overflow-y: auto;
          background: var(--bg);
          border: 1px solid var(--border-input);
          border-top: none; border-radius: 0 0 3px 3px;
          box-shadow: 0 4px 12px var(--dropdown-shadow);
        }
        .address-option {
          padding: 10px 14px; cursor: pointer; font-size: 14px;
          border-bottom: 1px solid var(--border-subtle);
          color: var(--text);
        }
        .address-option:last-child { border-bottom: none; }
        .address-option:hover {
          background: var(--surface-hover);
        }
        .address-option small { display: block; color: var(--text-muted); font-size: 12px; margin-top: 2px; }
        .address-powered { padding: 6px 14px; font-size: 11px; color: var(--powered-text); text-align: right; }

        /* Document checklist styling */
        #document-checklist .doc-item {
          padding: 10px 16px;
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: 3px;
          margin-bottom: 0.5rem;
          font-size: 0.92rem;
        }
        #document-checklist h4 { color: var(--text); border-bottom: 1px solid var(--border); padding-bottom: 6px; }

        .site-footer {
          text-align: center;
          padding: 2rem 1rem;
          font-size: 0.78rem;
          color: var(--text-muted);
          border-top: 1px solid var(--border);
          margin-top: 3rem;
          letter-spacing: 0.01em;
        }
      `}</style>
    </head>
    <body>
      <div class="site-header">
        <div class="inner">
          <a href="/"><img src="/logo.svg" alt="NOIM Easy" width="187" height="32" /></a>
        </div>
      </div>

      <main class="container" style="max-width:700px">
        <header style="text-align:center;margin-bottom:2rem">
          <h2 style="color:var(--text)">Prepare your NOIM</h2>
          <p style="color:var(--text-muted)">
            Fill in your details below. When you're done, you'll get a completed NOIM PDF to
            download, print, and sign with your celebrant and a witness.
          </p>
        </header>

        <form id="noim-form" method="post" action={submitUrl}>
          {noimSteps.map((step, i) => (
            <NoimStepComponent step={step} index={i} />
          ))}

          {/* Honeypot */}
          <div style="position:absolute;left:-9999px" aria-hidden="true">
            <input type="text" name="_hp" tabindex={-1} autocomplete="off" />
          </div>

          <div class="step-nav">
            <button type="button" id="prev-btn" class="secondary" style="display:none">Previous</button>
            <span id="step-indicator">Step 1 of {noimSteps.length}</span>
            <button type="button" id="next-btn">Next</button>
            <button type="submit" id="submit-btn" style="display:none">Generate my NOIM PDF</button>
          </div>
        </form>
      </main>

      <footer class="site-footer">
        NOIM Easy is a preparation tool only. It does not constitute legal advice.
      </footer>

      <script dangerouslySetInnerHTML={{ __html: getNoimClientScript(googleMapsApiKey) }} />
    </body>
  </html>
)
