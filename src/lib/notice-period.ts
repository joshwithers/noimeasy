export interface NoticeWindow {
  received: string
  earliestMarriage: string
  latestMarriage: string
  nextMonthHasCorrespondingDay: boolean
}

export const NOTICE_PERIOD_EMBED_PATH = '/embed/notice-period'

export const NOTICE_PERIOD_EMBED_CODE = `<div style="max-width: 700px; margin: 0 auto;">
  <iframe
    src="https://noimeasy.au/embed/notice-period"
    title="NOIM notice period calculator"
    loading="lazy"
    style="display: block; width: 100%; height: 640px; border: 0; border-radius: 14px; background: #fafafa;"
  ></iframe>
  <p style="margin: 10px 0 0; color: #595959; font: 13px/1.5 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; text-align: center;">
    Provided by <a href="https://noimeasy.au/" target="_blank" rel="noopener noreferrer" style="color: inherit !important; text-decoration: none !important;">NOIM Easy</a> to help <a href="https://marriedbyjosh.com/" target="_blank" rel="noopener noreferrer" style="color: inherit !important; text-decoration: none !important;">celebrants</a>.
  </p>
</div>
<script>
  (function (script) {
    var frame = script.previousElementSibling.querySelector('iframe');
    window.addEventListener('message', function (event) {
      if (event.origin !== 'https://noimeasy.au' || event.source !== frame.contentWindow) return;
      if (!event.data || event.data.type !== 'noim-easy:resize') return;
      var height = Number(event.data.height);
      if (Number.isFinite(height) && height >= 360 && height <= 900) frame.style.height = Math.ceil(height) + 'px';
    });
  })(document.currentScript);
</script>`

interface DateParts {
  year: number
  monthIndex: number
  day: number
}

function parseDateOnly(value: string): DateParts | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return null

  const year = Number(match[1])
  const monthIndex = Number(match[2]) - 1
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, monthIndex, day))
  if (date.getUTCFullYear() !== year
    || date.getUTCMonth() !== monthIndex
    || date.getUTCDate() !== day) return null

  return { year, monthIndex, day }
}

function targetMonth(year: number, monthIndex: number, monthsToAdd: number) {
  const date = new Date(Date.UTC(year, monthIndex + monthsToAdd, 1))
  return { year: date.getUTCFullYear(), monthIndex: date.getUTCMonth() }
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
}

function isoDate(year: number, monthIndex: number, day: number): string {
  return [
    String(year).padStart(4, '0'),
    String(monthIndex + 1).padStart(2, '0'),
    String(day).padStart(2, '0'),
  ].join('-')
}

/**
 * Calculates the ordinary section 42 notice window using the statutory
 * definition of a month in section 2G of the Acts Interpretation Act 1901.
 */
export function calculateNoticeWindow(receivedDate: string): NoticeWindow | null {
  const received = parseDateOnly(receivedDate)
  if (!received) return null

  const next = targetMonth(received.year, received.monthIndex, 1)
  const nextMonthDays = daysInMonth(next.year, next.monthIndex)
  const nextMonthHasCorrespondingDay = received.day <= nextMonthDays

  let earliestMarriage: string
  if (nextMonthHasCorrespondingDay) {
    earliestMarriage = isoDate(next.year, next.monthIndex, received.day)
  } else {
    const followingMonth = targetMonth(received.year, received.monthIndex, 2)
    earliestMarriage = isoDate(followingMonth.year, followingMonth.monthIndex, 1)
  }

  const expiryMonth = targetMonth(received.year, received.monthIndex, 18)
  const latestDay = Math.min(received.day, daysInMonth(expiryMonth.year, expiryMonth.monthIndex))

  return {
    received: receivedDate,
    earliestMarriage,
    latestMarriage: isoDate(expiryMonth.year, expiryMonth.monthIndex, latestDay),
    nextMonthHasCorrespondingDay,
  }
}

export function getNoticePeriodCalculatorScript(): string {
  return `
(function() {
  var input = document.getElementById('notice-received-date');
  var receivedOutput = document.getElementById('notice-received-output');
  var earliestOutput = document.getElementById('earliest-marriage-output');
  var latestOutput = document.getElementById('latest-marriage-output');
  var explanation = document.getElementById('notice-period-explanation');
  if (!input || !receivedOutput || !earliestOutput || !latestOutput || !explanation) return;

  function parseDateOnly(value) {
    var match = /^(\\d{4})-(\\d{2})-(\\d{2})$/.exec(value);
    if (!match) return null;
    var year = Number(match[1]);
    var monthIndex = Number(match[2]) - 1;
    var day = Number(match[3]);
    var date = new Date(Date.UTC(year, monthIndex, day));
    if (date.getUTCFullYear() !== year || date.getUTCMonth() !== monthIndex || date.getUTCDate() !== day) return null;
    return { year: year, monthIndex: monthIndex, day: day };
  }

  function targetMonth(parts, monthsToAdd) {
    var date = new Date(Date.UTC(parts.year, parts.monthIndex + monthsToAdd, 1));
    return { year: date.getUTCFullYear(), monthIndex: date.getUTCMonth() };
  }

  function daysInMonth(year, monthIndex) {
    return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
  }

  function dateFromParts(parts, day) {
    return new Date(Date.UTC(parts.year, parts.monthIndex, day, 12));
  }

  function formatDate(date) {
    return new Intl.DateTimeFormat('en-AU', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
    }).format(date);
  }

  function updateNoticeWindow() {
    var received = parseDateOnly(input.value);
    if (!received) {
      receivedOutput.textContent = 'Choose a valid date';
      earliestOutput.textContent = '—';
      latestOutput.textContent = '—';
      explanation.textContent = '';
      return;
    }

    var receivedDate = dateFromParts(received, received.day);
    var next = targetMonth(received, 1);
    var nextDays = daysInMonth(next.year, next.monthIndex);
    var hasCorrespondingDay = received.day <= nextDays;
    var earliestDate;

    if (hasCorrespondingDay) {
      earliestDate = dateFromParts(next, received.day);
      explanation.textContent = 'The corresponding day exists in the following calendar month.';
    } else {
      var following = targetMonth(received, 2);
      earliestDate = dateFromParts(following, 1);
      var nextMonthName = new Intl.DateTimeFormat('en-AU', { month: 'long', timeZone: 'UTC' })
        .format(dateFromParts(next, 1));
      explanation.textContent = nextMonthName + ' has no day ' + received.day + ', so the legal month runs to the end of ' + nextMonthName + ' and the first marriage date is the following day.';
    }

    var expiry = targetMonth(received, 18);
    var latestDay = Math.min(received.day, daysInMonth(expiry.year, expiry.monthIndex));
    var latestDate = dateFromParts(expiry, latestDay);

    receivedOutput.textContent = formatDate(receivedDate);
    earliestOutput.textContent = formatDate(earliestDate);
    latestOutput.textContent = formatDate(latestDate);
  }

  if (!input.value) {
    var today = new Date();
    input.value = [
      today.getFullYear(),
      String(today.getMonth() + 1).padStart(2, '0'),
      String(today.getDate()).padStart(2, '0')
    ].join('-');
  }
  input.addEventListener('input', updateNoticeWindow);
  input.addEventListener('change', updateNoticeWindow);
  updateNoticeWindow();
})();
`
}

export function getNoticePeriodEmbedCopyScript(): string {
  return `
(function() {
  var button = document.getElementById('copy-notice-embed');
  var code = document.getElementById('notice-embed-code');
  var status = document.getElementById('notice-embed-status');
  if (!button || !code || !status) return;

  function fallbackCopy(value) {
    var textarea = document.createElement('textarea');
    textarea.value = value;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    var copied = document.execCommand('copy');
    textarea.remove();
    if (!copied) throw new Error('Copy command was not accepted');
  }

  button.addEventListener('click', async function() {
    var value = code.textContent || '';
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(value);
      } else {
        fallbackCopy(value);
      }
      button.textContent = 'Copied';
      status.textContent = 'Embed code copied.';
      window.setTimeout(function() {
        button.textContent = 'Copy embed code';
        status.textContent = '';
      }, 2000);
    } catch {
      status.textContent = 'Select the code and copy it manually.';
    }
  });
})();
`
}

export function getNoticePeriodEmbedResizeScript(): string {
  return `
(function() {
  if (window.parent === window) return;
  function sendHeight() {
    var height = Math.ceil(document.body.getBoundingClientRect().height);
    window.parent.postMessage({ type: 'noim-easy:resize', height: height }, '*');
  }
  window.addEventListener('load', sendHeight);
  if ('ResizeObserver' in window) {
    new ResizeObserver(sendHeight).observe(document.body);
  }
  sendHeight();
})();
`
}
