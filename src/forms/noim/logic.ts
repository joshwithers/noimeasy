import type { NoimCondition } from './schema.ts'
import { COUNTRIES } from '../shared/countries.ts'

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
        return fieldValue !== '' && fieldValue !== compareValue
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

export function ageOnDate(dateOfBirth: string, onDate = new Date()): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateOfBirth)
  if (!match) return null

  const [, year, month, day] = match.map(Number)
  let age = onDate.getUTCFullYear() - year
  const birthdayHasPassed = onDate.getUTCMonth() + 1 > month
    || (onDate.getUTCMonth() + 1 === month && onDate.getUTCDate() >= day)
  if (!birthdayHasPassed) age -= 1
  return age
}

export function generateDocumentChecklist(data: Record<string, string>): DocumentItem[] {
  const docs: DocumentItem[] = []

  for (const prefix of ['p1', 'p2']) {
    const partyLabel = prefix === 'p1' ? 'Party 1' : 'Party 2'
    const name = `${data[`${prefix}_first_name`] || ''} ${data[`${prefix}_last_name`] || ''}`.trim() || partyLabel

    // Everyone needs identity documents
    docs.push({
      document: 'Official birth certificate/extract OR Australian or overseas passport',
      party: name,
      reason: 'Proof of identity and age',
      required: true,
    })

    const age = ageOnDate(data[`${prefix}_dob`] || '')
    if (age !== null && age < 18) {
      docs.push({
        document: age < 16
          ? 'A person under 16 cannot marry in Australia — contact an authorised celebrant immediately'
          : 'Under-18 marriage requirements: court approval from a judge or magistrate and parent/guardian consent are required unless that consent is dispensed with; only one party may be under 18',
        party: name,
        reason: `The entered date of birth indicates this party is currently ${age}`,
        required: true,
      })
    }

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

    // Check if birth country is not Australia — may need translation
    const birthCountry = (data[`${prefix}_birth_country`] || '').toLowerCase()
    if (birthCountry && birthCountry !== 'australia') {
      docs.push({
        document: 'Accredited translation of any non-English documents (confirm requirements with your celebrant)',
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
 * - Explicit OpenStreetMap address search
 * - Client-side validation before step transitions
 */
export function getNoimClientScript(): string {
  return `
(function() {
  var form = document.getElementById('noim-form');
  var steps = document.querySelectorAll('.noim-step');
  var prevBtn = document.getElementById('prev-btn');
  var nextBtn = document.getElementById('next-btn');
  var submitBtn = document.getElementById('submit-btn');
  var submitBtnTop = document.getElementById('submit-btn-top');
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
    submitBtn.style.display = 'none';
    submitBtnTop.style.display = index === steps.length - 1 ? '' : 'none';
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
    var firstInvalid = null;

    // Check standard fields
    visibleFields.forEach(function(field) {
      var wrapper = field.closest('.noim-field');
      if (wrapper && wrapper.style.display === 'none') return;
      if (!field.checkValidity()) {
        field.setAttribute('aria-invalid', 'true');
        valid = false;
        if (!firstInvalid) firstInvalid = field;
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
        if (!firstInvalid) firstInvalid = form.querySelector('input[name="' + name + '"]');
        form.querySelectorAll('input[name="' + name + '"]').forEach(function(r) {
          r.setAttribute('aria-invalid', 'true');
        });
      } else {
        form.querySelectorAll('input[name="' + name + '"]').forEach(function(r) {
          r.removeAttribute('aria-invalid');
        });
      }
    });

    if (firstInvalid && typeof firstInvalid.reportValidity === 'function') {
      firstInvalid.reportValidity();
    }
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

  function ageFromDob(dateOfBirth) {
    var match = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(dateOfBirth);
    if (!match) return null;
    var today = new Date();
    var year = Number(match[1]);
    var month = Number(match[2]);
    var day = Number(match[3]);
    var age = today.getUTCFullYear() - year;
    var birthdayHasPassed = today.getUTCMonth() + 1 > month ||
      (today.getUTCMonth() + 1 === month && today.getUTCDate() >= day);
    return birthdayHasPassed ? age : age - 1;
  }

  function updateDobNotice(input) {
    var note = input.parentElement.querySelector('.dob-age-note');
    if (!note) return;
    var age = ageFromDob(input.value);
    input.setCustomValidity('');
    note.className = 'dob-age-note';
    note.textContent = '';

    if (age === null) return;
    if (age < 16) {
      input.setCustomValidity('This service cannot accept a party under 16.');
      note.classList.add('error');
      note.textContent = 'This service cannot accept a party under 16. A person under 16 cannot marry in Australia. Please contact an authorised celebrant.';
      return;
    }
    if (age < 18) {
      note.classList.add('warning');
      note.textContent = 'This party is aged 16 or 17. Only one party may be under 18. Before marrying, they need court approval from a judge or magistrate and consent from a parent or guardian, unless that consent is dispensed with. Contact an authorised celebrant before proceeding.';
    }
  }

  function updateAllDobNotices() {
    var dobInputs = Array.from(document.querySelectorAll('input[name$="_dob"]'));
    dobInputs.forEach(updateDobNotice);
    var partiesAged16Or17 = dobInputs.filter(function(input) {
      var age = ageFromDob(input.value);
      return age !== null && age >= 16 && age < 18;
    });
    if (partiesAged16Or17.length > 1) {
      partiesAged16Or17.forEach(function(input) {
        var note = input.parentElement.querySelector('.dob-age-note');
        input.setCustomValidity('Only one party may be aged 16 or 17.');
        if (note) {
          note.className = 'dob-age-note error';
          note.textContent = 'Both parties are under 18. Only one party may be aged 16 or 17. Please contact an authorised celebrant.';
        }
      });
    }
  }

  document.querySelectorAll('input[name$="_dob"]').forEach(function(input) {
    input.max = new Date().toISOString().slice(0, 10);
    input.addEventListener('input', updateAllDobNotices);
    input.addEventListener('change', updateAllDobNotices);
  });
  updateAllDobNotices();

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
  // Skip address and country inputs — no conditions depend on them, and
  // rebuilding conditional fields while a dropdown is active can interrupt input.
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

  // === Occupation searchable dropdown ===
  // Load the large suggestion list only when it is first needed. The input is
  // never restricted to the list, so a user can always type a custom value.
  var occupationsPromise = null;
  function loadOccupations() {
    if (!occupationsPromise) {
      occupationsPromise = fetch('/occupations.txt')
        .then(function(response) {
          if (!response.ok) throw new Error('Occupation suggestions returned ' + response.status);
          return response.text();
        })
        .then(function(text) {
          return text.split(/\\r?\\n/).map(function(value) { return value.trim(); }).filter(Boolean);
        });
    }
    return occupationsPromise;
  }

  document.querySelectorAll('.occupation-select').forEach(function(wrapper) {
    var input = wrapper.querySelector('.occupation-input');
    var dropdown = wrapper.querySelector('.occupation-dropdown');
    if (!input || !dropdown) return;
    var activeIndex = -1;
    var visibleOccupations = [];

    function setExpanded(expanded) {
      input.setAttribute('aria-expanded', expanded ? 'true' : 'false');
      dropdown.style.display = expanded ? 'block' : 'none';
    }

    function renderOccupations(occupations) {
      var query = input.value.trim().toLowerCase();
      var startsWith = [];
      var contains = [];
      for (var i = 0; i < occupations.length && startsWith.length + contains.length < 40; i++) {
        var occupation = occupations[i];
        var lower = occupation.toLowerCase();
        if (!query || lower.startsWith(query)) startsWith.push(occupation);
        else if (lower.includes(query)) contains.push(occupation);
      }
      visibleOccupations = startsWith.concat(contains).slice(0, 40);
      activeIndex = -1;
      dropdown.innerHTML = '';

      if (!visibleOccupations.length) {
        var empty = document.createElement('div');
        empty.className = 'occupation-empty';
        empty.textContent = 'No matching suggestion. Keep your own occupation as typed.';
        dropdown.appendChild(empty);
      } else {
        visibleOccupations.forEach(function(occupation, index) {
          var option = document.createElement('button');
          option.type = 'button';
          option.className = 'occupation-option';
          option.setAttribute('role', 'option');
          option.dataset.index = String(index);
          option.textContent = occupation;
          dropdown.appendChild(option);
        });
      }
      setExpanded(true);
    }

    function refreshOccupations() {
      dropdown.innerHTML = '<div class="occupation-empty">Loading suggestions…</div>';
      setExpanded(true);
      loadOccupations().then(renderOccupations).catch(function(error) {
        console.warn('[NOIM Easy] Occupation suggestions failed:', error);
        dropdown.innerHTML = '<div class="occupation-empty">Suggestions are unavailable. Type your occupation normally.</div>';
      });
    }

    function selectOccupation(index) {
      var occupation = visibleOccupations[index];
      if (!occupation) return;
      input.value = occupation;
      setExpanded(false);
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }

    function updateActiveOption() {
      dropdown.querySelectorAll('.occupation-option').forEach(function(option, index) {
        option.classList.toggle('active', index === activeIndex);
        option.setAttribute('aria-selected', index === activeIndex ? 'true' : 'false');
      });
    }

    input.addEventListener('focus', refreshOccupations);
    input.addEventListener('input', refreshOccupations);
    input.addEventListener('keydown', function(event) {
      if (event.key === 'Escape') {
        setExpanded(false);
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        if (!visibleOccupations.length) return;
        event.preventDefault();
        var direction = event.key === 'ArrowDown' ? 1 : -1;
        activeIndex = (activeIndex + direction + visibleOccupations.length) % visibleOccupations.length;
        updateActiveOption();
        return;
      }
      if (event.key === 'Enter' && activeIndex >= 0) {
        event.preventDefault();
        selectOccupation(activeIndex);
      }
    });

    dropdown.addEventListener('mousedown', function(event) {
      event.preventDefault();
      var option = event.target.closest('.occupation-option');
      if (option) selectOccupation(Number(option.dataset.index));
    });
    input.addEventListener('blur', function() {
      setTimeout(function() { setExpanded(false); }, 150);
    });
  });

  // === Document checklist (informational only — no uploads) ===
  function createDocItem(label) {
    var div = document.createElement('div');
    div.className = 'doc-item';
    div.style.cssText = 'margin-bottom:0.5rem;padding:10px 16px;background:var(--surface);border:1px solid var(--border);border-radius:3px;font-size:0.92rem;display:flex;align-items:center;gap:8px';
    var bullet = document.createElement('span');
    bullet.textContent = '\\u2022';
    bullet.style.cssText = 'color:var(--text);font-weight:bold;font-size:1.2em';
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
    intro.style.cssText = 'color:var(--text-muted);margin-bottom:1rem';
    intro.textContent = 'Before the marriage, give your celebrant the documents below. Ask your celebrant whether they need originals and when they need to sight them.';
    container.appendChild(intro);

    ['p1', 'p2'].forEach(function(prefix) {
      var name = (getFieldValue(prefix + '_first_name') + ' ' + getFieldValue(prefix + '_last_name')).trim();
      if (!name) name = prefix === 'p1' ? 'Party 1' : 'Party 2';

      var heading = document.createElement('h4');
      heading.textContent = name;
      heading.style.cssText = 'margin-bottom:0.75rem;margin-top:1.5rem';
      container.appendChild(heading);

      // Proof of birth + identity
      container.appendChild(createDocItem('Proof of date and place of birth: official birth certificate or extract, Australian passport, or overseas passport'));
      container.appendChild(createDocItem('Photo ID to prove identity (e.g. passport, driver licence, or government-issued photo ID)'));

      var age = ageFromDob(getFieldValue(prefix + '_dob'));
      if (age !== null && age < 16) {
        container.appendChild(createDocItem('The entered date of birth indicates this party is under 16. A person under 16 cannot marry in Australia. Contact an authorised celebrant immediately.'));
      } else if (age !== null && age < 18) {
        container.appendChild(createDocItem('The entered date of birth indicates this party is aged 16 or 17. Only one party may be under 18. Before marrying, they need court approval from a judge or magistrate and consent from a parent or guardian, unless that consent is dispensed with. Contact an authorised celebrant before proceeding.'));
      }

      // Conjugal status documents
      var status = getFieldValue(prefix + '_conjugal_status');
      if (status === 'divorced') {
        container.appendChild(createDocItem('Divorce certificate (not the application or hearing documents)'));
      }
      if (status === 'widowed') {
        container.appendChild(createDocItem('Death certificate of deceased spouse'));
      }
      if (status === 'divorce_pending') {
        container.appendChild(createDocItem('Your divorce must take effect before the marriage can be solemnised; give the final divorce evidence to your celebrant'));
      }

      // Translation needed for non-Australian birth
      var country = getFieldValue(prefix + '_birth_country').toLowerCase();
      if (country && country !== 'australia') {
        container.appendChild(createDocItem('Ask your celebrant whether an accredited translation is required for any non-English documents'));
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
      // Skip hidden structured address components
      if (key.match(/_address_(street|suburb|state|postcode)$/)) continue;
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
      var labelCell = document.createElement('td');
      labelCell.style.fontWeight = '600';
      labelCell.textContent = label;
      var valueCell = document.createElement('td');
      valueCell.textContent = String(formData[key]);
      tr.appendChild(labelCell);
      tr.appendChild(valueCell);
      table.appendChild(tr);
    }
    container.appendChild(table);
  }

  // === OpenStreetMap address search ===
  // Nominatim's public policy prohibits autocomplete. A single search happens
  // only after editing is complete (change/Enter), is cached for this page, and
  // requests are spaced at least one second apart.
  var addressSearchCache = new Map();
  var lastAddressSearchAt = 0;

  function waitForAddressRateLimit() {
    var waitMs = Math.max(0, 1100 - (Date.now() - lastAddressSearchAt));
    return new Promise(function(resolve) { setTimeout(resolve, waitMs); });
  }

  function normaliseOsmAddress(address) {
    return {
      street: [address.house_number || '', address.road || address.pedestrian || ''].filter(Boolean).join(' '),
      suburb: address.suburb || address.neighbourhood || address.city_district || address.town || address.city || '',
      state: address.state || address.region || '',
      postcode: address.postcode || ''
    };
  }

  document.querySelectorAll('.address-input').forEach(function(input) {
    var wrapper = input.closest('.address-select');
    if (!wrapper) return;
    var dropdown = wrapper.querySelector('.address-dropdown');
    var status = wrapper.querySelector('.address-search-status');
    if (!dropdown || !status) return;
    var currentResults = [];

    function resultLabel(result) {
      return result.formatted_name || result.display_name || '';
    }

    function chooseResult(result) {
      input.value = resultLabel(result) || input.value;
      dropdown.style.display = 'none';
      status.textContent = 'Address selected.';
      var parts = normaliseOsmAddress(result.address || {});
      var baseName = input.name;
      var hiddenStreet = form.querySelector('[name="' + baseName + '_street"]');
      var hiddenSuburb = form.querySelector('[name="' + baseName + '_suburb"]');
      var hiddenState = form.querySelector('[name="' + baseName + '_state"]');
      var hiddenPostcode = form.querySelector('[name="' + baseName + '_postcode"]');
      if (hiddenStreet) hiddenStreet.value = parts.street;
      if (hiddenSuburb) hiddenSuburb.value = parts.suburb;
      if (hiddenState) hiddenState.value = parts.state;
      if (hiddenPostcode) hiddenPostcode.value = parts.postcode;
    }

    function renderResults(results) {
      dropdown.innerHTML = '';
      currentResults = results;
      if (!results.length) {
        dropdown.style.display = 'none';
        status.textContent = 'No matching address found. Check the spelling or enter the address manually.';
        return;
      }
      results.forEach(function(result, index) {
        var option = document.createElement('button');
        option.type = 'button';
        option.className = 'address-option';
        option.dataset.resultIndex = String(index);
        option.textContent = resultLabel(result);
        dropdown.appendChild(option);
      });
      dropdown.style.display = 'block';
      status.textContent = 'Choose an address from the OpenStreetMap results.';
    }

    function searchAddress() {
      var query = input.value.trim();
      if (query.length < 6) {
        dropdown.style.display = 'none';
        status.textContent = query ? 'Enter a fuller address to see suggestions.' : '';
        return;
      }

      status.textContent = 'Checking the completed address…';
      var cacheKey = query.toLowerCase();
      var cached = addressSearchCache.get(cacheKey);
      var request = cached
        ? Promise.resolve(cached)
        : waitForAddressRateLimit().then(function() {
            lastAddressSearchAt = Date.now();
            return fetch('/address-search?' + new URLSearchParams({ q: query }).toString(), {
              headers: { Accept: 'application/json' }
            }).then(function(response) {
              if (!response.ok) throw new Error('OpenStreetMap search returned ' + response.status);
              return response.json();
            }).then(function(results) {
              addressSearchCache.set(cacheKey, results);
              return results;
            });
          });

      request.then(renderResults).catch(function(error) {
        console.warn('[NOIM Easy] OpenStreetMap address search failed:', error);
        dropdown.style.display = 'none';
        status.textContent = 'Address search is temporarily unavailable. Please enter the address manually.';
      });
    }

    input.addEventListener('input', function() {
      dropdown.style.display = 'none';
      currentResults = [];
      var length = input.value.trim().length;
      status.textContent = length >= 6
        ? 'Finish editing to load suggestions automatically, or press Enter now.'
        : '';
    });
    input.addEventListener('blur', searchAddress);
    input.addEventListener('keydown', function(event) {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      searchAddress();
    });

    dropdown.addEventListener('click', function(event) {
      var option = event.target.closest('.address-option');
      if (!option) return;
      var result = currentResults[Number(option.dataset.resultIndex)];
      if (result) chooseResult(result);
    });
  });

  var formFeedback = document.getElementById('form-feedback');

  // === Form submission via fetch ===
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    var formData = new FormData(form);
    var btn = submitBtnTop;
    var originalText = btn.textContent;
    btn.disabled = true;
    btn.setAttribute('aria-busy', 'true');
    btn.textContent = 'Generating PDF…';
    formFeedback.style.display = 'none';

    fetch(form.action, {
      method: 'POST',
      body: formData,
    })
    .then(function(res) {
      if (!res.ok) {
        return res.text().then(function(text) {
          var message = '';
          try {
            var result = JSON.parse(text);
            message = result.error || '';
          } catch (error) {}
          throw new Error(message || 'PDF generation failed');
        });
      }
      var contentType = res.headers.get('Content-Type') || '';
      if (!contentType.toLowerCase().startsWith('application/pdf')) {
        throw new Error('The server returned an unexpected response instead of a PDF. Please try again.');
      }
      return res.blob().then(function(blob) {
        // Trigger download
        var url = URL.createObjectURL(blob);
        var disposition = res.headers.get('Content-Disposition') || '';
        var match = disposition.match(/filename="?([^"]+)"?/);
        var filename = match ? match[1] : 'NOIM.pdf';
        var a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      });
    })
    .then(function() {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      btn.textContent = originalText;
      formFeedback.style.display = 'block';
      formFeedback.style.background = 'var(--success-bg)';
      formFeedback.style.color = 'var(--success-text)';
      formFeedback.style.border = '1px solid var(--success-border)';
      formFeedback.textContent = 'Your NOIM PDF has been downloaded. Review it carefully before signing.';
    })
    .catch(function(err) {
      btn.disabled = false;
      btn.removeAttribute('aria-busy');
      btn.textContent = originalText;
      formFeedback.style.display = 'block';
      formFeedback.style.background = 'var(--error-bg)';
      formFeedback.style.color = 'var(--error-text)';
      formFeedback.style.border = '1px solid var(--error-border)';
      formFeedback.textContent = err && err.message ? err.message : 'Something went wrong. Please try again.';
      console.error('Submit error:', err);
    });
  });

  // Initialize
  showStep(0);
})();
`
}
