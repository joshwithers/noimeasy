import type { NoimCondition } from './schema'
import { COUNTRIES } from '../shared/countries'

/**
 * Check if a field should be visible given the current form data.
 * Returns true if the field has no conditions, or all conditions are met.
 */
export function isFieldVisible(
  conditions: NoimCondition[] | undefined,
  data: Record<string, string>
): boolean {
  if (!conditions || conditions.length === 0) return true

  return conditions.every((cond) => {
    const fieldValue = (data[cond.field] || '').toLowerCase().trim()
    const compareValue = typeof cond.value === 'string'
      ? cond.value.toLowerCase().trim()
      : cond.value.map((v) => v.toLowerCase().trim())

    switch (cond.operator) {
      case 'eq':
        return fieldValue === compareValue
      case 'neq':
        return fieldValue !== compareValue
      case 'in':
        return Array.isArray(compareValue) && compareValue.includes(fieldValue)
      default:
        return true
    }
  })
}

/**
 * Generate a document checklist based on the form data.
 */
export interface DocumentItem {
  document: string
  party: string
  reason: string
  required: boolean
}

export function generateDocumentChecklist(data: Record<string, string>): DocumentItem[] {
  const docs: DocumentItem[] = []

  for (const prefix of ['p1', 'p2']) {
    const partyLabel = prefix === 'p1' ? 'Party 1' : 'Party 2'
    const name = `${data[`${prefix}_first_name`] || ''} ${data[`${prefix}_last_name`] || ''}`.trim() || partyLabel

    // Everyone needs identity documents
    docs.push({
      document: 'Birth certificate (original or certified copy) OR valid passport',
      party: name,
      reason: 'Proof of identity and age',
      required: true,
    })

    // Conjugal status conditional documents
    const status = data[`${prefix}_conjugal_status`]
    if (status === 'divorced') {
      docs.push({
        document: 'Divorce certificate (not the application or hearing documents)',
        party: name,
        reason: 'Proof of dissolution of previous marriage',
        required: true,
      })
    }
    if (status === 'widowed') {
      docs.push({
        document: 'Death certificate of deceased spouse',
        party: name,
        reason: 'Proof of termination of previous marriage',
        required: true,
      })
    }

    // Name change
    if (data[`${prefix}_father_name_changed`] === 'yes' || data[`${prefix}_mother_name_changed`] === 'yes') {
      // This is about parent name changes — informational only
    }

    // Check if birth country is not Australia — may need translation
    const birthCountry = (data[`${prefix}_birth_country`] || '').toLowerCase()
    if (birthCountry && birthCountry !== 'australia') {
      docs.push({
        document: 'NAATI-accredited translation of any non-English documents',
        party: name,
        reason: `Born outside Australia (${data[`${prefix}_birth_country`]}) — any documents not in English require translation`,
        required: true,
      })
    }
  }

  return docs
}

/**
 * Client-side JavaScript for the NOIM form.
 * This is injected as a <script> tag and handles:
 * - Conditional field visibility
 * - Step navigation
 * - Google Maps address autocomplete
 * - Client-side validation before step transitions
 */
export function getNoimClientScript(googleMapsApiKey: string): string {
  // Only load Google Maps if the API key looks real (not a placeholder)
  const hasRealApiKey = googleMapsApiKey
    && !googleMapsApiKey.includes('your-')
    && !googleMapsApiKey.includes('placeholder')
    && !googleMapsApiKey.includes('change-me')
    && googleMapsApiKey.length > 20

  return `
(function() {
  var form = document.getElementById('noim-form');
  var steps = document.querySelectorAll('.noim-step');
  var prevBtn = document.getElementById('prev-btn');
  var nextBtn = document.getElementById('next-btn');
  var submitBtn = document.getElementById('submit-btn');
  var stepIndicator = document.getElementById('step-indicator');
  var currentStep = 0;
  var COUNTRIES = ${JSON.stringify(COUNTRIES)};

  // === Step Navigation ===
  function showStep(index) {
    steps.forEach(function(s, i) {
      s.style.display = i === index ? 'block' : 'none';
    });
    prevBtn.style.display = index === 0 ? 'none' : '';
    nextBtn.style.display = index === steps.length - 1 ? 'none' : '';
    submitBtn.style.display = index === steps.length - 1 ? '' : 'none';
    stepIndicator.textContent = 'Step ' + (index + 1) + ' of ' + steps.length;
    currentStep = index;
    updateConditionalFields();
    if (index === steps.length - 2) buildDocumentChecklist();
    if (index === steps.length - 1) buildReviewSection();
    window.scrollTo(0, 0);
  }

  function validateCurrentStep() {
    var step = steps[currentStep];
    var visibleFields = step.querySelectorAll('input:not([type=hidden]):not([type=radio]), select, textarea');
    var valid = true;

    // Check standard fields
    visibleFields.forEach(function(field) {
      var wrapper = field.closest('.noim-field');
      if (wrapper && wrapper.style.display === 'none') return;
      if (field.required && !field.value.trim()) {
        field.setAttribute('aria-invalid', 'true');
        valid = false;
      } else {
        field.removeAttribute('aria-invalid');
      }
    });

    // Check radio groups separately (required radio = at least one must be checked)
    var radioGroups = {};
    step.querySelectorAll('input[type=radio][required]').forEach(function(radio) {
      var wrapper = radio.closest('.noim-field');
      if (wrapper && wrapper.style.display === 'none') return;
      radioGroups[radio.name] = true;
    });
    Object.keys(radioGroups).forEach(function(name) {
      var checked = form.querySelector('input[name="' + name + '"]:checked');
      if (!checked) {
        valid = false;
        form.querySelectorAll('input[name="' + name + '"]').forEach(function(r) {
          r.setAttribute('aria-invalid', 'true');
        });
      } else {
        form.querySelectorAll('input[name="' + name + '"]').forEach(function(r) {
          r.removeAttribute('aria-invalid');
        });
      }
    });

    return valid;
  }

  prevBtn.addEventListener('click', function() {
    if (currentStep > 0) showStep(currentStep - 1);
  });

  nextBtn.addEventListener('click', function() {
    if (validateCurrentStep() && currentStep < steps.length - 1) {
      showStep(currentStep + 1);
    }
  });

  // === Helper: get field value (works for radios, selects, inputs) ===
  function getFieldValue(fieldName) {
    var el = form.querySelector('[name="' + fieldName + '"]');
    if (!el) return '';
    // Radio buttons: need to find the checked one
    if (el.type === 'radio') {
      var checked = form.querySelector('[name="' + fieldName + '"]:checked');
      return checked ? checked.value : '';
    }
    return (el.value || '').trim();
  }

  // === Conditional field visibility ===
  function updateConditionalFields() {
    document.querySelectorAll('[data-conditions]').forEach(function(el) {
      var conditions = JSON.parse(el.dataset.conditions);
      var visible = conditions.every(function(cond) {
        var val = getFieldValue(cond.field).toLowerCase();
        var compare = (typeof cond.value === 'string') ? cond.value.toLowerCase().trim() : cond.value;
        if (cond.operator === 'eq') return val === compare;
        if (cond.operator === 'neq') return val !== '' && val !== compare;
        return true;
      });
      el.style.display = visible ? '' : 'none';
      // Toggle required on hidden fields
      var inputs = el.querySelectorAll('input, select, textarea');
      inputs.forEach(function(inp) {
        if (!visible) {
          inp.removeAttribute('required');
          inp.value = '';
        } else if (inp.dataset.wasRequired === 'true') {
          inp.setAttribute('required', '');
        }
      });
    });
  }

  // Listen for changes to trigger condition updates
  // Skip address and country inputs — no conditions depend on them,
  // and running updateConditionalFields while Google Maps or the dropdown is active causes freezes
  form.addEventListener('change', function(e) {
    var t = e.target;
    if (t && t.classList && (t.classList.contains('address-input') || t.classList.contains('country-search'))) return;
    updateConditionalFields();
  });

  // Debounce input events and skip address/country fields
  var inputTimer = null;
  form.addEventListener('input', function(e) {
    var t = e.target;
    if (t && t.classList && (t.classList.contains('address-input') || t.classList.contains('country-search'))) return;
    clearTimeout(inputTimer);
    inputTimer = setTimeout(updateConditionalFields, 150);
  });

  // === Country searchable dropdown ===
  document.querySelectorAll('.country-select').forEach(function(wrapper) {
    var search = wrapper.querySelector('.country-search');
    var dropdown = wrapper.querySelector('.country-dropdown');
    if (!search || !dropdown) return;
    var built = false;

    function buildOptions() {
      if (built) return;
      COUNTRIES.forEach(function(c) {
        var opt = document.createElement('div');
        opt.className = 'country-option';
        opt.dataset.value = c;
        opt.textContent = c;
        dropdown.appendChild(opt);
      });
      built = true;
    }

    function filterOptions() {
      var query = search.value.toLowerCase().trim();
      var options = dropdown.querySelectorAll('.country-option');
      options.forEach(function(opt) {
        var match = !query || opt.textContent.toLowerCase().indexOf(query) !== -1;
        opt.style.display = match ? '' : 'none';
      });
    }

    search.addEventListener('focus', function() {
      buildOptions();
      filterOptions();
      dropdown.style.display = 'block';
    });

    search.addEventListener('input', function() {
      buildOptions();
      filterOptions();
      dropdown.style.display = 'block';
    });

    // Use mousedown so it fires before the blur event closes the dropdown
    dropdown.addEventListener('mousedown', function(e) {
      e.preventDefault();
      var opt = e.target.closest('.country-option');
      if (opt) {
        search.value = opt.dataset.value;
        dropdown.style.display = 'none';
        // Fire change to update conditional fields (e.g. birth_state depends on birth_country)
        updateConditionalFields();
      }
    });

    search.addEventListener('blur', function() {
      setTimeout(function() {
        dropdown.style.display = 'none';
        // Validate: value must match a known country exactly
        var val = search.value.trim();
        if (val) {
          var match = null;
          for (var i = 0; i < COUNTRIES.length; i++) {
            if (COUNTRIES[i].toLowerCase() === val.toLowerCase()) { match = COUNTRIES[i]; break; }
          }
          if (match) {
            search.value = match; // normalise casing
          } else {
            search.value = ''; // clear invalid entry
          }
        }
        updateConditionalFields();
      }, 200);
    });
  });

  // === Title case auto-capitalisation ===
  function toTitleCase(str) {
    return str.replace(/\\S+/g, function(word) {
      // If the word already has mixed case (e.g. "McDonald"), leave it alone
      if (word !== word.toLowerCase() && word !== word.toUpperCase()) return word;
      // Otherwise capitalise first letter, lowercase the rest
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    });
  }

  form.querySelectorAll('[data-title-case="true"]').forEach(function(input) {
    input.addEventListener('blur', function() {
      var val = input.value.trim();
      if (val) {
        input.value = toTitleCase(val);
      }
    });
  });

  // === Document checklist (informational only — no uploads) ===
  function createDocItem(label) {
    var div = document.createElement('div');
    div.className = 'doc-item';
    div.style.cssText = 'margin-bottom:0.5rem;padding:10px 16px;background:#fafafa;border:1px solid #e0e0e0;border-radius:3px;font-size:0.92rem;display:flex;align-items:center;gap:8px';
    var bullet = document.createElement('span');
    bullet.textContent = '\\u2022';
    bullet.style.cssText = 'color:#111;font-weight:bold;font-size:1.2em';
    div.appendChild(bullet);
    var text = document.createElement('span');
    text.textContent = label;
    div.appendChild(text);
    return div;
  }

  function buildDocumentChecklist() {
    var container = document.getElementById('document-checklist');
    if (!container) return;
    container.innerHTML = '';

    var intro = document.createElement('p');
    intro.style.cssText = 'color:#888;margin-bottom:1rem';
    intro.textContent = 'You will need to bring the following original documents when you meet with your celebrant to sign the NOIM.';
    container.appendChild(intro);

    ['p1', 'p2'].forEach(function(prefix) {
      var name = (getFieldValue(prefix + '_first_name') + ' ' + getFieldValue(prefix + '_last_name')).trim();
      if (!name) name = prefix === 'p1' ? 'Party 1' : 'Party 2';

      var heading = document.createElement('h4');
      heading.textContent = name;
      heading.style.cssText = 'margin-bottom:0.75rem;margin-top:1.5rem';
      container.appendChild(heading);

      // Birth certificate / passport
      container.appendChild(createDocItem('Birth certificate (original or certified copy) OR valid passport'));

      // Conjugal status documents
      var status = getFieldValue(prefix + '_conjugal_status');
      if (status === 'divorced') {
        container.appendChild(createDocItem('Divorce certificate (not the application or hearing documents)'));
      }
      if (status === 'widowed') {
        container.appendChild(createDocItem('Death certificate of deceased spouse'));
      }

      // Translation needed for non-Australian birth
      var country = getFieldValue(prefix + '_birth_country').toLowerCase();
      if (country && country !== 'australia') {
        container.appendChild(createDocItem('NAATI-accredited translation of any non-English documents'));
      }
    });
  }

  // === Review section ===
  function buildReviewSection() {
    var container = document.getElementById('review-section');
    if (!container) return;
    var formData = Object.fromEntries(new FormData(form));
    container.innerHTML = '';

    var excludeFields = ['_hp'];
    var table = document.createElement('table');
    table.setAttribute('role', 'grid');

    for (var key in formData) {
      if (excludeFields.includes(key) || !formData[key]) continue;
      // Skip hidden fields (structured address components for address and wedding_location)
      if (key.match(/_(street|suburb|state|postcode)$/) && (key.includes('address_') || key.includes('wedding_location_'))) continue;
      // Skip the send_copy checkbox from the review table (it's rendered separately)
      if (key === 'send_copy') continue;
      // Skip fields whose parent is hidden
      var fieldEl = form.querySelector('[name="' + key + '"]');
      if (fieldEl) {
        var wrapper = fieldEl.closest('.noim-field');
        if (wrapper && wrapper.style.display === 'none') continue;
      }
      var tr = document.createElement('tr');
      var label = key.replace(/^p[12]_/, '').replace(/_/g, ' ');
      label = label.charAt(0).toUpperCase() + label.slice(1);
      if (key.startsWith('p1_')) label = 'Party 1: ' + label;
      if (key.startsWith('p2_')) label = 'Party 2: ' + label;
      tr.innerHTML = '<td style="font-weight:600">' + label + '</td><td>' + formData[key] + '</td>';
      table.appendChild(tr);
    }
    container.appendChild(table);
  }

  // === Google Maps Address Autocomplete — Places API (New) ===
  // Uses AutocompleteSuggestion + Place.fetchFields instead of the legacy
  // Autocomplete widget or AutocompleteService. Custom dropdown, no widget conflicts.
  function initAddressFields(AutocompleteSuggestion, AutocompleteSessionToken) {
    if (!AutocompleteSuggestion || !AutocompleteSuggestion.fetchAutocompleteSuggestions) {
      console.error('[NOIM Easy] AutocompleteSuggestion not available. Ensure "Places API (New)" is enabled in your Google Cloud Console (this is separate from the legacy "Places API").');
      return;
    }
    console.info('[NOIM Easy] Google Maps address autocomplete initialised.');

    document.querySelectorAll('.address-input').forEach(function(input) {
      var wrapper = input.closest('.address-select');
      if (!wrapper) return;
      var dropdown = wrapper.querySelector('.address-dropdown');
      if (!dropdown) return;
      var debounceTimer = null;
      var token = new AutocompleteSessionToken();
      var currentPredictions = {};

      input.addEventListener('input', function() {
        var query = input.value.trim();
        if (query.length < 3) {
          dropdown.style.display = 'none';
          return;
        }

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(function() {
          AutocompleteSuggestion.fetchAutocompleteSuggestions({
            input: query,
            sessionToken: token,
            includedRegionCodes: ['au']
          }).then(function(response) {
            dropdown.innerHTML = '';
            currentPredictions = {};
            if (!response.suggestions || response.suggestions.length === 0) {
              dropdown.style.display = 'none';
              return;
            }
            response.suggestions.forEach(function(suggestion) {
              var pred = suggestion.placePrediction;
              if (!pred) return;
              var opt = document.createElement('div');
              opt.className = 'address-option';
              var main = (pred.mainText && pred.mainText.text) ? pred.mainText.text : (pred.text ? pred.text.text : '');
              var secondary = (pred.secondaryText && pred.secondaryText.text) ? pred.secondaryText.text : '';
              var description = pred.text ? pred.text.text : main;
              opt.innerHTML = '<span>' + main + '</span>' + (secondary ? '<small>' + secondary + '</small>' : '');
              opt.dataset.placeId = pred.placeId;
              opt.dataset.description = description;
              currentPredictions[pred.placeId] = pred;
              dropdown.appendChild(opt);
            });
            var attr = document.createElement('div');
            attr.className = 'address-powered';
            attr.textContent = 'Powered by Google';
            dropdown.appendChild(attr);
            dropdown.style.display = 'block';
          }).catch(function(e) {
            console.warn('[NOIM Easy] Autocomplete request failed:', e);
            dropdown.style.display = 'none';
          });
        }, 300);
      });

      dropdown.addEventListener('mousedown', function(e) {
        e.preventDefault();
        var opt = e.target.closest('.address-option');
        if (!opt) return;

        input.value = opt.dataset.description;
        dropdown.style.display = 'none';

        var pred = currentPredictions[opt.dataset.placeId];
        if (!pred) return;

        var place = pred.toPlace();
        place.fetchFields({
          fields: ['formattedAddress', 'addressComponents']
        }).then(function() {
          if (place.formattedAddress) {
            input.value = place.formattedAddress;
          }
          if (place.addressComponents) {
            var components = {};
            place.addressComponents.forEach(function(c) {
              c.types.forEach(function(t) { components[t] = c.longText; });
            });
            var baseName = input.name;
            var hiddenStreet = form.querySelector('[name="' + baseName + '_street"]');
            var hiddenSuburb = form.querySelector('[name="' + baseName + '_suburb"]');
            var hiddenState = form.querySelector('[name="' + baseName + '_state"]');
            var hiddenPostcode = form.querySelector('[name="' + baseName + '_postcode"]');
            if (hiddenStreet) hiddenStreet.value = ((components.street_number || '') + ' ' + (components.route || '')).trim();
            if (hiddenSuburb) hiddenSuburb.value = components.locality || '';
            if (hiddenState) hiddenState.value = components.administrative_area_level_1 || '';
            if (hiddenPostcode) hiddenPostcode.value = components.postal_code || '';
          }
          token = new AutocompleteSessionToken();
        }).catch(function(e) {
          console.warn('[NOIM Easy] Place details fetch failed:', e);
        });
      });

      input.addEventListener('blur', function() {
        setTimeout(function() { dropdown.style.display = 'none'; }, 200);
      });

      var note = input.parentElement.querySelector('.address-fallback-note');
      if (note) note.remove();
    });
  }

  // Initialize
  showStep(0);

  // Load Google Maps Places API (New) using the Dynamic Library Import bootstrap.
  // This sets up google.maps.importLibrary() synchronously as a stub, then lazily
  // loads the actual JS API on first call. Required for AutocompleteSuggestion.
  // See: https://developers.google.com/maps/documentation/javascript/load-maps-js-api
  ${hasRealApiKey ? `
  (function(g){
    var h,a,k,p="The Google Maps JavaScript API",c="google",l="importLibrary",q="__ib__",m=document,b=window;
    b=b[c]||(b[c]={});
    var d=b.maps||(b.maps={}),r=new Set,e=new URLSearchParams;
    var u=function(){
      return h||(h=new Promise(function(f,n){
        a=m.createElement("script");
        e.set("libraries",Array.from(r)+"");
        for(k in g) e.set(k.replace(/[A-Z]/g,function(t){return"_"+t[0].toLowerCase()}),g[k]);
        e.set("callback",c+".maps."+q);
        a.src="https://maps."+c+"apis.com/maps/api/js?"+e;
        d[q]=f;
        a.onerror=function(){h=n(Error(p+" could not load."))};
        a.nonce=(m.querySelector("script[nonce]")||{}).nonce||"";
        m.head.append(a);
      }))
    };
    d[l]?console.warn(p+" only loads once."):d[l]=function(f){
      r.add(f);
      return u().then(function(){return d[l](f)})
    };
  })({key:"${googleMapsApiKey}",v:"weekly"});

  console.info('[NOIM Easy] Google Maps bootstrap loaded, requesting Places library...');
  google.maps.importLibrary('places').then(function(lib) {
    console.info('[NOIM Easy] Places library loaded. AutocompleteSuggestion available:', !!lib.AutocompleteSuggestion);
    if (lib.AutocompleteSuggestion) {
      initAddressFields(lib.AutocompleteSuggestion, lib.AutocompleteSessionToken);
    } else {
      console.error('[NOIM Easy] AutocompleteSuggestion not found. Enable "Places API (New)" (not legacy "Places API") at https://console.cloud.google.com/apis/library');
    }
  }).catch(function(e) {
    console.error('[NOIM Easy] Failed to load Places library:', e);
  });
  ` : `
  console.info('[NOIM Easy] No Google Maps API key configured. Address fields are plain text.');
  `}
})();
`
}
