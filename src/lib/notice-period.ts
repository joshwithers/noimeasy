export interface NoticeWindow {
  received: string;
  earliestMarriage: string;
  latestMarriage: string;
  nextMonthHasCorrespondingDay: boolean;
}

export const NOTICE_PERIOD_EMBED_PATH = "/embed/notice-period";

export const NOTICE_PERIOD_EMBED_CODE = `<div style="max-width: 700px; margin: 0 auto;">
  <iframe
    src="https://noimeasy.au/embed/notice-period"
    title="NOIM notice period calculator"
    loading="lazy"
    style="display: block; width: 100%; height: 640px; border: 0; border-radius: 14px; background: #fafafa;"
  ></iframe>
</div>
<script>
  (function (script) {
    var container = script.previousElementSibling;
    var frame = container && container.querySelector('iframe');
    if (!frame) return;
    window.addEventListener('message', function (event) {
      if (event.origin !== 'https://noimeasy.au' || event.source !== frame.contentWindow) return;
      if (!event.data || event.data.type !== 'noim-easy:resize') return;
      var height = Number(event.data.height);
      if (Number.isFinite(height) && height >= 360 && height <= 900) frame.style.height = Math.ceil(height) + 'px';
    });
  })(document.currentScript);
</script>`;

export const NOTICE_PERIOD_EMBED_ATTRIBUTION = `<p style="margin: 10px 0 0; color: #595959; font: 13px/1.5 system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; text-align: center;">
  <a href="https://noimeasy.au/" target="_blank" rel="noopener noreferrer" style="color: inherit !important; text-decoration: none !important;">NOIM Easy notice-period calculator</a>
</p>`;

/**
 * Calculates the ordinary section 42 notice window using the statutory
 * definition of a month in section 2G of the Acts Interpretation Act 1901:
 * the period ends immediately before the corresponding day in the next
 * calendar month, or at the end of that month if the day does not exist.
 *
 * The function deliberately contains all calendar arithmetic it needs so the
 * exact same implementation can be shipped in the browser calculator.
 */
export function calculateNoticeWindow(
  receivedDate: string,
): NoticeWindow | null {
  function isLeapYear(year: number): boolean {
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  }

  function daysInMonth(year: number, month: number): number {
    const days = [
      31,
      isLeapYear(year) ? 29 : 28,
      31,
      30,
      31,
      30,
      31,
      31,
      30,
      31,
      30,
      31,
    ];
    return days[month - 1] ?? 0;
  }

  function addCalendarMonths(year: number, month: number, months: number) {
    const absoluteMonth = year * 12 + (month - 1) + months;
    return {
      year: Math.floor(absoluteMonth / 12),
      month: (absoluteMonth % 12) + 1,
    };
  }

  function isoDate(year: number, month: number, day: number): string {
    return [
      String(year).padStart(4, "0"),
      String(month).padStart(2, "0"),
      String(day).padStart(2, "0"),
    ].join("-");
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(receivedDate);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    year < 1 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month)
  ) {
    return null;
  }

  const next = addCalendarMonths(year, month, 1);
  const nextMonthHasCorrespondingDay =
    day <= daysInMonth(next.year, next.month);

  let earliestMarriage: string;
  if (nextMonthHasCorrespondingDay) {
    earliestMarriage = isoDate(next.year, next.month, day);
  } else {
    const followingMonth = addCalendarMonths(year, month, 2);
    earliestMarriage = isoDate(followingMonth.year, followingMonth.month, 1);
  }

  const expiryMonth = addCalendarMonths(year, month, 18);
  const latestDay = Math.min(
    day,
    daysInMonth(expiryMonth.year, expiryMonth.month),
  );

  return {
    received: receivedDate,
    earliestMarriage,
    latestMarriage: isoDate(
      expiryMonth.year,
      expiryMonth.month,
      latestDay,
    ),
    nextMonthHasCorrespondingDay,
  };
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

  // Esbuild may preserve nested function names with calls to its private
  // __name helper when this shared function is bundled for the Worker. The
  // inlined browser copy only needs the functions themselves.
  var __name = function(target) { return target; };
  var calculateNoticeWindow = ${calculateNoticeWindow.toString()};

  function dateFromIso(value) {
    var parts = value.split('-').map(Number);
    return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2], 12));
  }

  function formatDate(date) {
    return new Intl.DateTimeFormat('en-AU', {
      day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
    }).format(date);
  }

  function updateNoticeWindow() {
    var noticeWindow = calculateNoticeWindow(input.value);
    if (!noticeWindow) {
      receivedOutput.textContent = 'Choose a valid date';
      earliestOutput.textContent = '—';
      latestOutput.textContent = '—';
      explanation.textContent = '';
      return;
    }

    var receivedDate = dateFromIso(noticeWindow.received);
    var earliestDate = dateFromIso(noticeWindow.earliestMarriage);
    var latestDate = dateFromIso(noticeWindow.latestMarriage);
    var receivedDay = receivedDate.getUTCDate();
    var nextMonthDate = new Date(Date.UTC(receivedDate.getUTCFullYear(), receivedDate.getUTCMonth() + 1, 1, 12));
    var nextMonthName = new Intl.DateTimeFormat('en-AU', { month: 'long', timeZone: 'UTC' }).format(nextMonthDate);
    var earliestLabel = formatDate(earliestDate);

    if (noticeWindow.nextMonthHasCorrespondingDay) {
      explanation.textContent = nextMonthName + ' has a day ' + receivedDay + '. The statutory month ends immediately before ' + earliestLabel + ', so marriage may take place on that date.';
    } else {
      explanation.textContent = nextMonthName + ' has no day ' + receivedDay + '. The statutory month ends at the end of ' + nextMonthName + ', so marriage may take place from ' + earliestLabel + '.';
    }

    receivedOutput.textContent = formatDate(receivedDate);
    earliestOutput.textContent = earliestLabel;
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
`;
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
`;
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
`;
}
