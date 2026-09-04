import test from 'node:test'
import assert from 'node:assert/strict'
import { executives, initialCampaigns, initialOpportunities, initialStudios } from './src/data.js'
import { generateManagementReport, reportToMarkdown } from './src/insightEngine.js'

const report = (actionState = {}) => generateManagementReport({
  campaigns: initialCampaigns,
  opportunities: initialOpportunities,
  studios: initialStudios,
  executives,
  actionState,
  asOf: '2026-09-03',
})

test('Dogra Unit reconciles campaign and opportunity totals', () => {
  const result = report()
  assert.equal(result.metrics.targeted, 4380)
  assert.equal(result.metrics.contracted, 288)
  assert.equal(result.metrics.live, 144)
  assert.equal(result.metrics.activationGap, 144)
  assert.equal(result.metrics.contractToLiveRate, 50)
})

test('Dogra Unit generates stable owned actions with proof', () => {
  const gap = report().actions.find((item) => item.id === 'activation-gap:o1')
  assert.equal(gap.owner, 'Arjun Rao')
  assert.equal(gap.dueDate, '2026-09-06')
  assert.match(gap.proof, /Live reaches 120/)
})

test('Dogra Unit keeps observed gaps separate from unproven causes', () => {
  const gap = report().insights.find((item) => item.id === 'activation-gap:o1')
  assert.equal(gap.causeStatus, 'Unresolved')
  assert.match(gap.cause, /do not yet prove its cause/)
})

test('Dogra Unit preserves action status and exports its product identity', () => {
  const result = report({ 'activation-gap:o1': 'Done' })
  assert.equal(result.actions.find((item) => item.id === 'activation-gap:o1').status, 'Done')
  assert.match(reportToMarkdown(result), /^# Dogra Unit management report/m)
})
