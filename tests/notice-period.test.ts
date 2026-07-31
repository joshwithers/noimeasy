import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateNoticeWindow,
  getNoticePeriodCalculatorScript,
  getNoticePeriodEmbedCopyScript,
  getNoticePeriodEmbedResizeScript,
  NOTICE_PERIOD_EMBED_ATTRIBUTION,
  NOTICE_PERIOD_EMBED_CODE,
  NOTICE_PERIOD_EMBED_PATH,
} from "../src/lib/notice-period.ts";

test("uses the corresponding day when the following month contains it", () => {
  assert.deepEqual(calculateNoticeWindow("2026-01-05"), {
    received: "2026-01-05",
    earliestMarriage: "2026-02-05",
    latestMarriage: "2027-07-05",
    nextMonthHasCorrespondingDay: true,
  });
});

test("applies the statutory corresponding-day rule to every 31st transition", () => {
  const cases = [
    ["2026-01-31", "2026-03-01", false],
    ["2026-03-31", "2026-05-01", false],
    ["2026-05-31", "2026-07-01", false],
    ["2026-07-31", "2026-08-31", true],
    ["2026-08-31", "2026-10-01", false],
    ["2026-10-31", "2026-12-01", false],
    ["2026-12-31", "2027-01-31", true],
  ] as const;

  for (const [received, earliestMarriage, hasCorrespondingDay] of cases) {
    const result = calculateNoticeWindow(received);
    assert.equal(result?.earliestMarriage, earliestMarriage, received);
    assert.equal(
      result?.nextMonthHasCorrespondingDay,
      hasCorrespondingDay,
      received,
    );
  }
});

test("handles leap years at both notice boundaries", () => {
  assert.equal(
    calculateNoticeWindow("2028-01-29")?.earliestMarriage,
    "2028-02-29",
  );
  assert.equal(
    calculateNoticeWindow("2027-01-29")?.earliestMarriage,
    "2027-03-01",
  );
  assert.equal(
    calculateNoticeWindow("2026-08-31")?.latestMarriage,
    "2028-02-29",
  );
  assert.equal(
    calculateNoticeWindow("2027-08-31")?.latestMarriage,
    "2029-02-28",
  );
});

test("rejects impossible and malformed dates", () => {
  assert.equal(calculateNoticeWindow("2026-02-29"), null);
  assert.equal(calculateNoticeWindow("2026-04-31"), null);
  assert.equal(calculateNoticeWindow("0000-01-01"), null);
  assert.equal(calculateNoticeWindow("31/01/2026"), null);
  assert.equal(calculateNoticeWindow(""), null);
});

function isoDate(date: Date): string {
  return [
    String(date.getUTCFullYear()).padStart(4, "0"),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function expectedWindowFromUtcDate(received: Date) {
  const year = received.getUTCFullYear();
  const monthIndex = received.getUTCMonth();
  const day = received.getUTCDate();
  const nextMonth = new Date(Date.UTC(year, monthIndex + 1, 1));
  const nextMonthDays = new Date(
    Date.UTC(nextMonth.getUTCFullYear(), nextMonth.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const nextMonthHasCorrespondingDay = day <= nextMonthDays;
  const earliestMarriage = nextMonthHasCorrespondingDay
    ? new Date(
        Date.UTC(
          nextMonth.getUTCFullYear(),
          nextMonth.getUTCMonth(),
          day,
        ),
      )
    : new Date(Date.UTC(year, monthIndex + 2, 1));
  const expiryMonth = new Date(Date.UTC(year, monthIndex + 18, 1));
  const expiryMonthDays = new Date(
    Date.UTC(expiryMonth.getUTCFullYear(), expiryMonth.getUTCMonth() + 1, 0),
  ).getUTCDate();
  const latestMarriage = new Date(
    Date.UTC(
      expiryMonth.getUTCFullYear(),
      expiryMonth.getUTCMonth(),
      Math.min(day, expiryMonthDays),
    ),
  );

  return {
    received: isoDate(received),
    earliestMarriage: isoDate(earliestMarriage),
    latestMarriage: isoDate(latestMarriage),
    nextMonthHasCorrespondingDay,
  };
}

test("matches an independent UTC calendar oracle across a 400-year Gregorian cycle", () => {
  for (let year = 2000; year < 2400; year += 1) {
    for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
      const monthDays = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
      for (let day = 1; day <= monthDays; day += 1) {
        const received = new Date(Date.UTC(year, monthIndex, day));
        const receivedIso = isoDate(received);
        assert.deepEqual(
          calculateNoticeWindow(receivedIso),
          expectedWindowFromUtcDate(received),
          receivedIso,
        );
      }
    }
  }
});

interface CalculatorHarness {
  setDate: (value: string) => void;
  received: { textContent: string };
  earliest: { textContent: string };
  latest: { textContent: string };
  explanation: { textContent: string };
}

function runCalculatorScript(initialDate: string): CalculatorHarness {
  const listeners: Record<string, () => void> = {};
  const input = {
    value: initialDate,
    addEventListener(type: string, listener: () => void) {
      listeners[type] = listener;
    },
  };
  const received = { textContent: "" };
  const earliest = { textContent: "" };
  const latest = { textContent: "" };
  const explanation = { textContent: "" };
  const elements: Record<string, unknown> = {
    "notice-received-date": input,
    "notice-received-output": received,
    "earliest-marriage-output": earliest,
    "latest-marriage-output": latest,
    "notice-period-explanation": explanation,
  };
  const document = {
    getElementById(id: string) {
      return elements[id] ?? null;
    },
  };

  const script = getNoticePeriodCalculatorScript();
  assert.doesNotThrow(() => new Function(script));
  assert.match(script, /var __name = function\(target\)/);
  new Function("document", "window", script)(document, {});

  return {
    setDate(value: string) {
      input.value = value;
      listeners.input();
    },
    received,
    earliest,
    latest,
    explanation,
  };
}

test("ships the shared statutory calculation in the page and iframe browser script", () => {
  const calculator = runCalculatorScript("2026-07-31");
  assert.equal(calculator.received.textContent, "31 July 2026");
  assert.equal(calculator.earliest.textContent, "31 August 2026");
  assert.equal(calculator.latest.textContent, "31 January 2028");
  assert.match(calculator.explanation.textContent, /August has a day 31/);
  assert.match(
    calculator.explanation.textContent,
    /month ends immediately before 31 August 2026/,
  );

  calculator.setDate("2026-08-31");
  assert.equal(calculator.earliest.textContent, "1 October 2026");
  assert.match(calculator.explanation.textContent, /September has no day 31/);

  calculator.setDate("2028-01-29");
  assert.equal(calculator.earliest.textContent, "29 February 2028");

  calculator.setDate("2027-02-29");
  assert.equal(calculator.received.textContent, "Choose a valid date");
  assert.equal(calculator.earliest.textContent, "—");
});

test("provides a privacy-preserving iframe embed with optional neutral attribution", () => {
  assert.equal(NOTICE_PERIOD_EMBED_PATH, "/embed/notice-period");
  assert.match(
    NOTICE_PERIOD_EMBED_CODE,
    /src="https:\/\/noimeasy\.au\/embed\/notice-period"/,
  );
  assert.doesNotMatch(NOTICE_PERIOD_EMBED_CODE, /href=/);
  assert.match(
    NOTICE_PERIOD_EMBED_ATTRIBUTION,
    /href="https:\/\/noimeasy\.au\/"/,
  );
  assert.match(NOTICE_PERIOD_EMBED_ATTRIBUTION, /rel="noopener noreferrer"/);
  assert.equal(
    (NOTICE_PERIOD_EMBED_ATTRIBUTION.match(/color: inherit !important/g) || [])
      .length,
    1,
  );
  assert.equal(
    (
      NOTICE_PERIOD_EMBED_ATTRIBUTION.match(
        /text-decoration: none !important/g,
      ) || []
    ).length,
    1,
  );
  assert.match(
    NOTICE_PERIOD_EMBED_CODE,
    /event\.origin !== 'https:\/\/noimeasy\.au'/,
  );
  assert.match(NOTICE_PERIOD_EMBED_CODE, /noim-easy:resize/);
});

test("the copied embed only accepts bounded resize messages from its own iframe", () => {
  const script = NOTICE_PERIOD_EMBED_CODE.match(
    /<script>([\s\S]*?)<\/script>/,
  )?.[1];
  assert.ok(script);

  const frameWindow = {};
  const frame = { contentWindow: frameWindow, style: { height: "640px" } };
  const currentScript = {
    previousElementSibling: {
      querySelector(selector: string) {
        return selector === "iframe" ? frame : null;
      },
    },
  };
  let onMessage: ((event: Record<string, unknown>) => void) | undefined;
  const window = {
    addEventListener(
      type: string,
      listener: (event: Record<string, unknown>) => void,
    ) {
      if (type === "message") onMessage = listener;
    },
  };

  new Function("document", "window", script)({ currentScript }, window);
  assert.ok(onMessage);

  onMessage({
    origin: "https://example.com",
    source: frameWindow,
    data: { type: "noim-easy:resize", height: 500.2 },
  });
  assert.equal(frame.style.height, "640px");

  onMessage({
    origin: "https://noimeasy.au",
    source: {},
    data: { type: "noim-easy:resize", height: 500.2 },
  });
  assert.equal(frame.style.height, "640px");

  onMessage({
    origin: "https://noimeasy.au",
    source: frameWindow,
    data: { type: "noim-easy:resize", height: 500.2 },
  });
  assert.equal(frame.style.height, "501px");

  onMessage({
    origin: "https://noimeasy.au",
    source: frameWindow,
    data: { type: "noim-easy:resize", height: 901 },
  });
  assert.equal(frame.style.height, "501px");
});

test("ships a syntactically valid embed copy script", () => {
  const script = getNoticePeriodEmbedCopyScript();
  assert.doesNotThrow(() => new Function(script));
  assert.equal(script.includes("navigator.clipboard.writeText"), true);
  assert.equal(script.includes("button.textContent = 'Copied'"), true);
});

test("ships a syntactically valid iframe resize script", () => {
  const script = getNoticePeriodEmbedResizeScript();
  assert.doesNotThrow(() => new Function(script));
  assert.equal(script.includes("type: 'noim-easy:resize'"), true);
  assert.equal(script.includes("getBoundingClientRect().height"), true);
});
