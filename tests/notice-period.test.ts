import assert from 'node:assert/strict'
import test from 'node:test'
import { calculateNoticeWindow, getNoticePeriodCalculatorScript } from '../src/lib/notice-period.ts'

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
