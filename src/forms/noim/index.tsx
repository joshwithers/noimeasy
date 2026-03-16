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
        {field.helpText && <small style="color:#6b7280;display:block;margin-top:4px">{field.helpText}</small>}
      </div>
    )
  }

  return (
    <div {...wrapperAttrs}>
      <label>
        {field.label}
        {field.required && <span style="color:#dc2626"> *</span>}

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
      {field.helpText && <small style="color:#6b7280">{field.helpText}</small>}
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
        <p style="color:#6b7280">Navigate to this step after filling in your details to see your required documents.</p>
      </div>
    ) : step.id === 'review' ? (
      <div>
        {step.fields.map((field) => <NoimFieldComponent field={field} />)}
        <div id="review-section">
          <p style="color:#6b7280">Navigate to this step to review all your details before submitting.</p>
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
        .site-header .inner {
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
        .site-header h1 a { color: #fff; text-decoration: none; }
        .site-header p {
          margin: 2px 0 0;
          font-size: 0.85rem;
          color: #b8c7d6;
        }
        .noim-field { margin-bottom: 1rem; }
        .step-nav { display: flex; justify-content: space-between; align-items: center; margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--gov-border); }
        .step-nav button { min-width: 120px; border-radius: 4px; }
        #step-indicator { color: #6b7280; font-size: 14px; }
        hgroup { margin-bottom: 1.5rem; }
        hgroup h3 { color: var(--gov-navy); }
        fieldset { margin: 0; }
        .address-input { width: 100%; }
        .middle-name-hint { display:none; margin-top:4px; font-size:13px; }
        .address-fallback-note { color:#6b7280; font-size:13px; margin-top:4px; }

        /* Country searchable dropdown */
        .country-select { position: relative; }
        .country-dropdown {
          display: none; position: absolute; z-index: 100; width: 100%;
          max-height: 220px; overflow-y: auto;
          background: var(--pico-background-color, #fff);
          border: 1px solid var(--pico-muted-border-color, #d1d5db);
          border-top: none; border-radius: 0 0 4px 4px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .country-option {
          padding: 10px 14px; cursor: pointer; font-size: 15px;
          border-bottom: 1px solid var(--pico-muted-border-color, #f3f4f6);
        }
        .country-option:last-child { border-bottom: none; }
        .country-option:hover, .country-option:focus {
          background: var(--pico-primary-focus, #e0e7ff);
        }
        .country-option[style*="display: none"] + .country-option { border-top: none; }

        /* Address searchable dropdown (same pattern as country) */
        .address-select { position: relative; }
        .address-dropdown {
          display: none; position: absolute; z-index: 100; width: 100%;
          max-height: 260px; overflow-y: auto;
          background: var(--pico-background-color, #fff);
          border: 1px solid var(--pico-muted-border-color, #d1d5db);
          border-top: none; border-radius: 0 0 4px 4px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        .address-option {
          padding: 10px 14px; cursor: pointer; font-size: 14px;
          border-bottom: 1px solid var(--pico-muted-border-color, #f3f4f6);
        }
        .address-option:last-child { border-bottom: none; }
        .address-option:hover {
          background: var(--pico-primary-focus, #e0e7ff);
        }
        .address-option small { display: block; color: #6b7280; font-size: 12px; margin-top: 2px; }
        .address-powered { padding: 6px 14px; font-size: 11px; color: #9ca3af; text-align: right; }

        /* Document checklist styling */
        #document-checklist .doc-item {
          padding: 10px 16px;
          background: #fff;
          border: 1px solid var(--gov-border);
          border-radius: 4px;
          margin-bottom: 0.5rem;
          font-size: 0.92rem;
        }
        #document-checklist h4 { color: var(--gov-navy); border-bottom: 1px solid var(--gov-border); padding-bottom: 6px; }

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
        <div class="inner">
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

      <main class="container" style="max-width:700px">
        <header style="text-align:center;margin-bottom:2rem">
          <h2 style="color:var(--gov-navy)">Prepare your NOIM</h2>
          <p style="color:#6b7280">
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
