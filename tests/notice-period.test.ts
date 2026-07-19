import assert from 'node:assert/strict'
import test from 'node:test'
import {
  calculateNoticeWindow,
  getNoticePeriodCalculatorScript,
  getNoticePeriodEmbedCopyScript,
  getNoticePeriodEmbedResizeScript,
  NOTICE_PERIOD_EMBED_CODE,
  NOTICE_PERIOD_EMBED_PATH,
} from '../src/lib/notice-period.ts'

test('uses the corresponding day when the following month contains it', () => {
  assert.deepEqual(calculateNoticeWindow('2026-01-05'), {
    received: '2026-01-05',
    earliestMarriage: '2026-02-05',
    latestMarriage: '2027-07-05',
    nextMonthHasCorrespondingDay: true,
  })
})

test('moves to the following day when the next month has no corresponding day', () => {
  assert.deepEqual(calculateNoticeWindow('2026-01-31'), {
    received: '2026-01-31',
    earliestMarriage: '2026-03-01',
    latestMarriage: '2027-07-31',
    nextMonthHasCorrespondingDay: false,
  })
  assert.equal(calculateNoticeWindow('2027-08-31')?.earliestMarriage, '2027-10-01')
})

test('handles leap years at both notice boundaries', () => {
  assert.equal(calculateNoticeWindow('2028-01-29')?.earliestMarriage, '2028-02-29')
  assert.equal(calculateNoticeWindow('2027-01-29')?.earliestMarriage, '2027-03-01')
  assert.equal(calculateNoticeWindow('2026-08-31')?.latestMarriage, '2028-02-29')
  assert.equal(calculateNoticeWindow('2027-08-31')?.latestMarriage, '2029-02-28')
})

test('rejects impossible and malformed dates', () => {
  assert.equal(calculateNoticeWindow('2026-02-29'), null)
  assert.equal(calculateNoticeWindow('31/01/2026'), null)
  assert.equal(calculateNoticeWindow(''), null)
})

test('ships a syntactically valid calculator script', () => {
  const script = getNoticePeriodCalculatorScript()
  assert.doesNotThrow(() => new Function(script))
  assert.equal(script.includes('has no day'), true)
  assert.equal(script.includes('targetMonth(received, 18)'), true)
})

test('provides an iframe embed with external, visually neutral attribution links', () => {
  assert.equal(NOTICE_PERIOD_EMBED_PATH, '/embed/notice-period')
  assert.match(NOTICE_PERIOD_EMBED_CODE, /src="https:\/\/noimeasy\.au\/embed\/notice-period"/)
  assert.match(NOTICE_PERIOD_EMBED_CODE, />NOIM Easy<\/a> to help <a/)
  assert.match(NOTICE_PERIOD_EMBED_CODE, /href="https:\/\/marriedbyjosh\.com\/"/)
  assert.equal((NOTICE_PERIOD_EMBED_CODE.match(/color: inherit !important/g) || []).length, 2)
  assert.equal((NOTICE_PERIOD_EMBED_CODE.match(/text-decoration: none !important/g) || []).length, 2)
  assert.match(NOTICE_PERIOD_EMBED_CODE, /event\.origin !== 'https:\/\/noimeasy\.au'/)
  assert.match(NOTICE_PERIOD_EMBED_CODE, /noim-easy:resize/)
})

test('ships a syntactically valid embed copy script', () => {
  const script = getNoticePeriodEmbedCopyScript()
  assert.doesNotThrow(() => new Function(script))
  assert.equal(script.includes('navigator.clipboard.writeText'), true)
  assert.equal(script.includes("button.textContent = 'Copied'"), true)
})

test('ships a syntactically valid iframe resize script', () => {
  const script = getNoticePeriodEmbedResizeScript()
  assert.doesNotThrow(() => new Function(script))
  assert.equal(script.includes("type: 'noim-easy:resize'"), true)
  assert.equal(script.includes('getBoundingClientRect().height'), true)
})
