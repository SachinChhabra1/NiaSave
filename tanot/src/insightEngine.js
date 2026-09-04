const CONTRACTED_STAGES = new Set(['Contracted', 'Studio allocated', 'Mobilisation', 'Live'])

const round = (value, digits = 1) => Number(value.toFixed(digits))
const ratio = (numerator, denominator) => denominator ? round(numerator / denominator * 100) : 0
const sum = (items, field) => items.reduce((total, item) => total + Number(item[field] || 0), 0)

function plusDays(asOf, days) {
  const date = new Date(`${asOf}T12:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function action(ruleId, recordId, values, actionState, asOf) {
  const id = `${ruleId}:${recordId}`
  return {
    id,
    ruleId,
    status: actionState[id] || 'Open',
    dueDate: plusDays(asOf, values.dueInDays || 3),
    ...values,
  }
}

function insight(ruleId, recordId, values) {
  return { id: `${ruleId}:${recordId}`, ruleId, causeStatus: 'Unresolved', ...values }
}

export function generateManagementReport({ campaigns, opportunities, studios, executives, actionState = {}, asOf = '2026-09-03' }) {
  const targeted = sum(campaigns, 'contacts')
  const engaged = sum(campaigns, 'engaged')
  const qualified = sum(campaigns, 'qualified')
  const contractedOpportunities = opportunities.filter((item) => CONTRACTED_STAGES.has(item.stage))
  const contracted = sum(contractedOpportunities, 'committed')
  const live = sum(opportunities, 'live')
  const weightedPipeline = Math.round(opportunities.reduce((total, item) => total + item.committed * item.probability / 100, 0))
  const activationGap = Math.max(0, contracted - live)
  const stageDays = opportunities.length ? round(sum(opportunities, 'days') / opportunities.length) : 0

  const metrics = {
    targeted,
    engaged,
    qualified,
    contracted,
    live,
    weightedPipeline,
    activationGap,
    engagementRate: ratio(engaged, targeted),
    qualificationRate: ratio(qualified, engaged),
    campaignToLiveRate: ratio(live, targeted),
    contractToLiveRate: ratio(live, contracted),
    averageStageDays: stageDays,
  }

  const insights = []
  const actions = []

  opportunities.forEach((opportunity) => {
    const gap = CONTRACTED_STAGES.has(opportunity.stage) ? Math.max(0, opportunity.committed - opportunity.live) : 0
    if (gap > 0) {
      insights.push(insight('activation-gap', opportunity.id, {
        priority: gap >= 50 ? 'High' : 'Medium',
        category: 'Activation leakage',
        scope: opportunity.account,
        studio: opportunity.studio,
        finding: `${opportunity.live} of ${opportunity.committed} committed members are live.`,
        impact: `${gap} committed members have not reached live status.`,
        evidence: [`Opportunity ${opportunity.id}`, `Stage: ${opportunity.stage}`, `Committed: ${opportunity.committed}`, `Live: ${opportunity.live}`],
        cause: 'The records prove an activation gap. They do not yet prove its cause.',
      }))
      actions.push(action('activation-gap', opportunity.id, {
        priority: gap >= 50 ? 'High' : 'Medium',
        scope: opportunity.account,
        owner: opportunity.owner,
        title: `Close or explain the ${gap}-member activation gap`,
        nextStep: 'Confirm the next arrival cohort. Record a reason for any quantity that will not activate.',
        proof: `Live reaches ${opportunity.committed}, or every remaining member has a recorded variance reason.`,
        dueInDays: gap >= 50 ? 2 : 3,
      }, actionState, asOf))
    }

    if (opportunity.stage !== 'Live' && opportunity.days > 14) {
      insights.push(insight('stage-stall', opportunity.id, {
        priority: opportunity.days >= 25 ? 'High' : 'Medium',
        category: 'Stage velocity',
        scope: opportunity.account,
        studio: opportunity.studio,
        finding: `${opportunity.account} has remained in ${opportunity.stage} for ${opportunity.days} days.`,
        impact: `${opportunity.days - 14} days beyond the 14-day operating threshold.`,
        evidence: [`Opportunity ${opportunity.id}`, `Stage: ${opportunity.stage}`, `Days in stage: ${opportunity.days}`],
        cause: 'The stage history proves elapsed time. A blocking reason is not recorded.',
      }))
      actions.push(action('stage-stall', opportunity.id, {
        priority: opportunity.days >= 25 ? 'High' : 'Medium',
        scope: opportunity.account,
        owner: opportunity.owner,
        title: `Resolve the ${opportunity.stage.toLowerCase()} stall`,
        nextStep: `Advance the opportunity or record the blocker, owner and revised date. Current next action: ${opportunity.nextAction}.`,
        proof: 'A new stage event or a documented blocker with owner and revised date.',
        dueInDays: opportunity.days >= 25 ? 1 : 2,
      }, actionState, asOf))
    }

    if (!opportunity.due || opportunity.due === 'Not set') {
      insights.push(insight('missing-next-date', opportunity.id, {
        priority: 'High',
        category: 'Follow-up hygiene',
        scope: opportunity.account,
        studio: opportunity.studio,
        finding: 'The active opportunity has no dated next action.',
        impact: `${opportunity.committed} potential members lack a time-bound follow-up.`,
        evidence: [`Opportunity ${opportunity.id}`, `Next action: ${opportunity.nextAction || 'Missing'}`, 'Due date: Missing'],
        cause: 'The required next-action field is incomplete.',
        causeStatus: 'Validated',
      }))
      actions.push(action('missing-next-date', opportunity.id, {
        priority: 'High',
        scope: opportunity.account,
        owner: opportunity.owner,
        title: 'Set the next action and date',
        nextStep: 'Record one specific next action with a named counterparty and due date.',
        proof: 'Opportunity contains a non-empty next action and valid due date.',
        dueInDays: 1,
      }, actionState, asOf))
    }
  })

  executives.forEach((executive) => {
    const qualification = ratio(executive.qualified, executive.engaged)
    if (executive.engaged >= 30 && qualification < 25) {
      insights.push(insight('qualification-conversion', executive.id, {
        priority: 'Medium',
        category: 'Executive funnel',
        scope: executive.name,
        studio: executive.territory,
        finding: `${executive.qualified} of ${executive.engaged} engaged accounts became qualified demand.`,
        impact: `${qualification}% qualification conversion versus the 25% review threshold.`,
        evidence: [`Executive ${executive.id}`, `Engaged: ${executive.engaged}`, `Qualified: ${executive.qualified}`],
        cause: 'The funnel proves lower conversion. Message, audience and meeting-quality causes require review.',
      }))
      actions.push(action('qualification-conversion', executive.id, {
        priority: 'Medium',
        scope: executive.name,
        owner: executive.name,
        title: 'Review engaged accounts that did not qualify',
        nextStep: 'Classify the last 20 non-qualified engagements by persona, need, timing and authority.',
        proof: 'Twenty reviewed accounts have complete disqualification reason codes.',
        dueInDays: 5,
      }, actionState, asOf))
    }
  })

  studios.forEach((studio) => {
    if (studio.gap >= 70) {
      const owner = executives.find((item) => item.territory === studio.name)?.name || 'BD leadership'
      insights.push(insight('studio-demand-gap', studio.id, {
        priority: studio.gap >= 85 ? 'High' : 'Medium',
        category: 'Studio coverage',
        scope: studio.name,
        studio: studio.name,
        finding: `${studio.name} has a ${studio.gap}-member demand gap at ${studio.coverage}% coverage.`,
        impact: `${studio.gap} additional live or sufficiently probable members are needed to close the plan.`,
        evidence: [`Studio ${studio.id}`, `Coverage: ${studio.coverage}%`, `Gap: ${studio.gap}`],
        cause: 'The coverage gap is validated. The mix of insufficient pipeline and conversion leakage needs diagnosis.',
      }))
      actions.push(action('studio-demand-gap', studio.id, {
        priority: studio.gap >= 85 ? 'High' : 'Medium',
        scope: studio.name,
        owner,
        title: `Build a closure plan for the ${studio.gap}-member Studio gap`,
        nextStep: 'Name the opportunities and campaigns expected to close the gap, with probability and activation date.',
        proof: 'Demand plan reconciles to the gap and every contributing opportunity has owner, probability and activation date.',
        dueInDays: 4,
      }, actionState, asOf))
    }
  })

  const priorityRank = { High: 0, Medium: 1, Low: 2 }
  insights.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority])
  actions.sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority])

  const highPriorityOpen = actions.filter((item) => item.priority === 'High' && item.status !== 'Done').length
  const headline = activationGap > 0
    ? `${activationGap} contracted members have not yet reached live status.`
    : 'All currently contracted demand has reached live status.'

  return {
    id: `report-${asOf}`,
    asOf,
    generatedAt: new Date().toISOString(),
    period: 'September 2026 MTD',
    sourceLabel: 'Illustrative in-browser campaign, opportunity, Studio and executive records',
    headline,
    implication: highPriorityOpen
      ? `${highPriorityOpen} high-priority actions need operating review.`
      : 'No high-priority generated action remains open.',
    metrics,
    insights,
    actions,
    definitions: [
      { metric: 'Campaign to live', formula: 'Live members ÷ targeted contacts', source: 'Campaign and opportunity records' },
      { metric: 'Contract to live', formula: 'Live members ÷ committed members in contracted-or-later stages', source: 'Opportunity records' },
      { metric: 'Weighted pipeline', formula: 'Σ opportunity demand × stage probability', source: 'Opportunity records' },
      { metric: 'Stage stall', formula: 'Active opportunity with more than 14 days in its current stage', source: 'Opportunity stage history' },
    ],
  }
}

export function reportToMarkdown(report) {
  const lines = [
    '# Dogra Unit management report',
    '',
    `**Period:** ${report.period}`,
    `**As of:** ${report.asOf}`,
    `**Source:** ${report.sourceLabel}`,
    '',
    '## Executive readout',
    '',
    report.headline,
    report.implication,
    '',
    '## KPI snapshot',
    '',
    '| KPI | Actual |',
    '|---|---:|',
    `| Targeted | ${report.metrics.targeted} |`,
    `| Engaged | ${report.metrics.engaged} |`,
    `| Qualified | ${report.metrics.qualified} |`,
    `| Contracted | ${report.metrics.contracted} |`,
    `| Live | ${report.metrics.live} |`,
    `| Contract to live | ${report.metrics.contractToLiveRate}% |`,
    '',
    '## Generated actions',
    '',
    '| Priority | Action | Owner | Due | Proof | Status |',
    '|---|---|---|---|---|---|',
    ...report.actions.map((item) => `| ${item.priority} | ${item.title} | ${item.owner} | ${item.dueDate} | ${item.proof} | ${item.status} |`),
    '',
    '## Evidence-backed findings',
    '',
    ...report.insights.map((item) => `- **${item.category} · ${item.scope}:** ${item.finding} ${item.impact} Cause status: ${item.causeStatus}. ${item.cause}`),
  ]
  return lines.join('\n')
}
