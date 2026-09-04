import { useMemo, useState } from 'react'
import { executives, initialAccounts, initialStudios } from './data'
import { OpportunityTable, Status } from './components'
import { reportToMarkdown } from './insightEngine'

function SectionHeader({ title, action, onAction, children }) {
  return <div className="section-head"><div><h2>{title}</h2>{children && <p>{children}</p>}</div>{action && <button className="text-action" onClick={onAction}>{action} →</button>}</div>
}

function Metric({ label, value, delta, tone = 'positive' }) {
  return <div className="metric"><span>{label}</span><strong>{value}</strong><small className={tone}>{tone === 'positive' ? '↑' : '↓'} {delta}</small></div>
}

function Funnel() {
  const stages = [
    ['Targeted', '4,380', '100%'],
    ['Engaged', '612', '14.0%'],
    ['Qualified', '184', '4.2%'],
    ['Contracted', '486', '11.1%'],
    ['Live', '342', '7.8%'],
  ]
  return <div className="funnel-wrap"><div className="funnel">{stages.map(([label, value, rate], index) => <div className={`funnel-stage stage-${index}`} key={label}><span>{label}</span><strong>{value}</strong><small>{rate}</small></div>)}</div><div className="funnel-rates"><span>Engagement rate <b>14.0%</b></span><i>→</i><span>Qualification rate <b>30.1%</b></span><i>→</i><span>Contract rate <b>26.4%</b></span><i>→</i><span>Go-live rate <b>70.4%</b></span></div></div>
}

function StudioCoverage({ limit }) {
  const studios = limit ? initialStudios.slice(0, limit) : initialStudios
  return <div className="table-scroll"><table className="data-table studio-table"><thead><tr><th>Studio</th><th>Live</th><th>Contracted</th><th>Pipeline (weighted)</th><th>Gap</th><th>Coverage</th></tr></thead><tbody>{studios.map((studio) => <tr key={studio.id}><td><strong>{studio.name}</strong><small>{studio.corridor}</small></td><td className="mono">{studio.live}</td><td className="mono">{studio.contracted}</td><td className="mono">{studio.pipeline}</td><td className="danger mono">{studio.gap}</td><td><div className="coverage"><span><i style={{ width: `${studio.coverage}%` }} /></span><b>{studio.coverage}%</b></div></td></tr>)}</tbody></table></div>
}

function AttentionRail() {
  const items = [
    ['clock', 'Overdue follow-ups', 'Accounts awaiting action beyond due date', 12],
    ['warning', 'Mobilisation gaps', 'Contracted demand not yet mobilised', 5],
    ['trend', 'Forecast risks', 'Pipeline at risk of slipping this month', 3],
  ]
  return <aside className="attention"><h2>What needs attention</h2>{items.map(([icon, title, body, count]) => <article key={title}><div className={`attention-icon ${icon}`}>{icon === 'clock' ? '◷' : icon === 'warning' ? '△' : '↗'}</div><div><strong>{title}</strong><small>{body}</small><button>View details</button></div><b>{count}</b></article>)}</aside>
}

function resourceRows(opportunities) {
  return executives.map((executive) => {
    const owned = opportunities.filter((item) => item.owner === executive.name)
    const contracted = owned.filter((item) => ['Contracted', 'Studio allocated', 'Mobilisation', 'Live'].includes(item.stage)).reduce((sum, item) => sum + item.committed, 0)
    const live = owned.reduce((sum, item) => sum + item.live, 0)
    return { ...executive, contracted, live }
  })
}

function ResourceTable({ opportunities, compact = false, onSelect }) {
  const rows = resourceRows(opportunities)
  return <div className="table-scroll"><table className="data-table resource-table"><thead><tr><th>BD executive</th><th>Targeted</th><th>Engaged</th><th>Qualified</th><th>Contracted</th><th>Live</th>{!compact && <><th>Campaign → live</th><th>Median cycle</th><th>Overdue</th><th>Forecast</th></>}</tr></thead><tbody>{rows.map((item) => {
    const liveYield = (item.live / item.targeted * 100).toFixed(1)
    return <tr key={item.id} onClick={() => onSelect?.(item.id)}><td><span className="owner-dot">{item.initials}</span><strong>{item.name}</strong><small>{item.territory} · {item.activeAccounts} active accounts</small></td><td className="mono">{item.targeted.toLocaleString()}</td><td><span className="mono">{item.engaged}</span><small>{(item.engaged / item.targeted * 100).toFixed(1)}%</small></td><td><span className="mono">{item.qualified}</span><small>{(item.qualified / item.engaged * 100).toFixed(1)}%</small></td><td className="mono">{item.contracted}</td><td className="mono resource-live">{item.live}</td>{!compact && <><td><strong className="mono">{liveYield}%</strong></td><td className="mono">{item.medianDays} days</td><td className={item.overdue > 3 ? 'danger mono' : 'mono'}>{item.overdue}</td><td><div className="forecast-cell"><span><i style={{ width: `${item.forecastAccuracy}%` }} /></span><b>{item.forecastAccuracy}%</b></div></td></>}</tr>
  })}</tbody></table></div>
}

export function OverviewPage({ opportunities, openOpportunity, setPage }) {
  return <div className="overview-page">
    <div className="page-intro overview-intro"><div><h2>Demand command centre</h2><p>Enterprise demand from first campaign touch to a live member at a Studio.</p></div><button className="secondary" onClick={() => setPage('resources')}>Compare BD team</button></div>
    <section className="metrics-row"><Metric label="Live this month" value="342" delta="12% vs Aug 2026" /><Metric label="Contracted" value="486" delta="8% vs Aug 2026" /><Metric label="Weighted pipeline" value="1,140" delta="15% vs Aug 2026" /><Metric label="Campaign-to-live" value="7.8%" delta="0.6pp vs Aug 2026" tone="negative" /></section>
    <section className="content-section"><SectionHeader title="Campaign-to-live funnel" /><Funnel /></section>
    <section className="content-section"><SectionHeader title="Studio demand coverage" action="View Studios" onAction={() => setPage('studios')} /><StudioCoverage limit={4} /></section>
    <section className="content-section"><SectionHeader title="BD executive funnel" action="Compare resources" onAction={() => setPage('resources')}>Every executive measured from targeted account to live demand.</SectionHeader><ResourceTable opportunities={opportunities} compact /></section>
    <section className="lower-grid"><div className="content-section opportunities"><SectionHeader title="Opportunities at risk" action="View all opportunities" onAction={() => setPage('pipeline')} /><OpportunityTable opportunities={opportunities.slice(0, 5)} openOpportunity={openOpportunity} compact /></div><AttentionRail /></section>
  </div>
}

export function ResourcesPage({ opportunities, openOpportunity }) {
  const [selectedId, setSelectedId] = useState('r1')
  const [territory, setTerritory] = useState('All territories')
  const rows = resourceRows(opportunities)
  const filteredRows = territory === 'All territories' ? rows : rows.filter((item) => item.territory === territory)
  const selected = rows.find((item) => item.id === selectedId) || rows[0]
  const selectedOpportunities = opportunities.filter((item) => item.owner === selected.name)
  const team = filteredRows.reduce((totals, item) => ({ targeted: totals.targeted + item.targeted, engaged: totals.engaged + item.engaged, qualified: totals.qualified + item.qualified, contracted: totals.contracted + item.contracted, live: totals.live + item.live }), { targeted: 0, engaged: 0, qualified: 0, contracted: 0, live: 0 })
  const stages = [['Targeted', selected.targeted], ['Engaged', selected.engaged], ['Qualified', selected.qualified], ['Contracted', selected.contracted], ['Live', selected.live]]
  return <div className="standard-page resources-page">
    <div className="page-intro"><div><h2>BD team</h2><p>Compare each executive on funnel output, conversion quality, velocity and attributable live demand.</p></div><div className="toolbar"><select value={territory} onChange={(event) => setTerritory(event.target.value)}><option>All territories</option>{[...new Set(executives.map((item) => item.territory))].map((item) => <option key={item}>{item}</option>)}</select><button className="secondary">Export</button></div></div>
    <section className="resource-summary"><div><span>Executives</span><strong>{filteredRows.length}</strong></div><div><span>Targeted</span><strong>{team.targeted.toLocaleString()}</strong></div><div><span>Qualified</span><strong>{team.qualified}</strong><small>{team.engaged ? (team.qualified / team.engaged * 100).toFixed(1) : 0}% of engaged</small></div><div><span>Contracted</span><strong>{team.contracted}</strong></div><div><span>Live</span><strong>{team.live}</strong><small>{team.contracted ? (team.live / team.contracted * 100).toFixed(1) : 0}% of contracted</small></div></section>
    <section className="resource-comparison panel"><SectionHeader title="Executive funnel comparison">Click a row to inspect the funnel and owned opportunities.</SectionHeader><ResourceTable opportunities={opportunities} onSelect={setSelectedId} /></section>
    <div className="resource-detail-grid">
      <section className="panel resource-funnel-panel"><div className="resource-person"><span className="owner-dot large">{selected.initials}</span><div><h3>{selected.name}</h3><p>{selected.territory} · {selected.activeAccounts} active accounts</p></div></div><div className="resource-funnel">{stages.map(([label, value], index) => <div key={label}><div className="resource-stage-head"><span>{label}</span><strong>{value.toLocaleString()}</strong></div><div className="resource-stage-track"><i style={{ width: `${Math.max(4, value / selected.targeted * 100)}%` }} /></div>{index > 0 && <small>{(value / stages[index - 1][1] * 100).toFixed(1)}% from prior stage</small>}</div>)}</div></section>
      <section className="panel resource-health"><SectionHeader title="Execution quality" /><dl><div><dt>Median campaign to live</dt><dd>{selected.medianDays} days</dd></div><div><dt>Campaign to live yield</dt><dd>{(selected.live / selected.targeted * 100).toFixed(1)}%</dd></div><div><dt>Forecast accuracy</dt><dd>{selected.forecastAccuracy}%</dd></div><div><dt>Overdue actions</dt><dd className={selected.overdue > 3 ? 'danger' : ''}>{selected.overdue}</dd></div></dl></section>
    </div>
    <section className="panel resource-owned"><SectionHeader title={`${selected.name}'s active opportunities`} />{selectedOpportunities.length ? <OpportunityTable opportunities={selectedOpportunities} openOpportunity={openOpportunity} /> : <div className="empty-state"><h3>No active opportunities</h3><p>No opportunity records are assigned to this executive in the demo workspace.</p></div>}</section>
  </div>
}

export function CampaignsPage({ campaigns, setPage }) {
  const [filter, setFilter] = useState('All')
  const shown = filter === 'All' ? campaigns : campaigns.filter((item) => item.status === filter)
  return <div className="standard-page">
    <div className="page-intro"><div><h2>Campaign operating view</h2><p>See outreach performance in the same frame as contracted and live Studio demand.</p></div><div className="segmented">{['All', 'Live', 'Scheduled', 'Draft', 'Completed'].map((item) => <button className={filter === item ? 'active' : ''} onClick={() => setFilter(item)} key={item}>{item}</button>)}</div></div>
    <div className="campaign-list">
      {shown.map((campaign) => {
        const engagement = campaign.contacts ? Math.round(campaign.engaged / campaign.contacts * 1000) / 10 : 0
        return <article key={campaign.id}>
          <div className="campaign-main"><div><Status>{campaign.status}</Status><h3>{campaign.name}</h3><p>{campaign.audience} · {campaign.studio}</p></div><button className="more">•••</button></div>
          <div className="campaign-kpis"><span><small>Targeted</small><strong>{campaign.contacts.toLocaleString()}</strong></span><span><small>Engaged</small><strong>{campaign.engaged}</strong><i>{engagement}%</i></span><span><small>Qualified</small><strong>{campaign.qualified}</strong></span><span><small>Contracted</small><strong>{campaign.contracted}</strong></span><span><small>Live</small><strong className="accent">{campaign.live}</strong></span></div>
          <footer><span>Owner {campaign.owner}</span><span>Started {campaign.start}</span><button onClick={() => setPage('insights')}>View attribution →</button></footer>
        </article>
      })}
      {!shown.length && <div className="empty-state"><h3>No {filter.toLowerCase()} campaigns</h3><p>Create a campaign or choose a different status.</p></div>}
    </div>
  </div>
}

export function AccountsPage({ query, openOpportunity, opportunities }) {
  const needle = query.toLowerCase()
  const accounts = initialAccounts.filter((item) => [item.name, item.segment, item.studio].some((value) => value.toLowerCase().includes(needle)))
  return <div className="standard-page"><div className="page-intro"><div><h2>Enterprise relationships</h2><p>One record for every contact, campaign, demand line and live outcome.</p></div><button className="secondary">＋ Import accounts</button></div>
    <div className="account-grid">{accounts.map((account) => { const opportunity = opportunities.find((item) => item.accountId === account.id); return <article key={account.id} onClick={() => opportunity && openOpportunity(opportunity.id)}><header><div className="account-mark">{account.name.split(' ').map((word) => word[0]).join('').slice(0, 2)}</div><Status>{account.relationship}</Status></header><h3>{account.name}</h3><p>{account.segment}</p><dl><div><dt>Studio</dt><dd>{account.studio}</dd></div><div><dt>Potential demand</dt><dd>{account.demand}</dd></div><div><dt>Contacts</dt><dd>{account.contacts}</dd></div></dl><footer>Last touch {account.lastTouch}<span>→</span></footer></article>})}</div>
  </div>
}

export function PipelinePage({ opportunities, openOpportunity }) {
  const [stage, setStage] = useState('All stages')
  const shown = stage === 'All stages' ? opportunities : opportunities.filter((item) => item.stage === stage)
  return <div className="standard-page"><div className="page-intro"><div><h2>Evidence-gated opportunities</h2><p>Forecasted demand stays separate from contracted, mobilising and live.</p></div><div className="toolbar"><select value={stage} onChange={(event) => setStage(event.target.value)}><option>All stages</option>{[...new Set(opportunities.map((item) => item.stage))].map((item) => <option key={item}>{item}</option>)}</select><button className="secondary">Export</button></div></div>
    <section className="pipeline-summary"><div><span>Open demand</span><strong>{opportunities.reduce((sum, item) => sum + item.committed, 0)}</strong></div><div><span>Weighted demand</span><strong>{Math.round(opportunities.reduce((sum, item) => sum + item.committed * item.probability / 100, 0))}</strong></div><div><span>Contracted</span><strong>{opportunities.filter((item) => ['Contracted', 'Studio allocated', 'Mobilisation', 'Live'].includes(item.stage)).reduce((sum, item) => sum + item.committed, 0)}</strong></div><div><span>Live</span><strong>{opportunities.reduce((sum, item) => sum + item.live, 0)}</strong></div></section>
    <div className="table-panel"><OpportunityTable opportunities={shown} openOpportunity={openOpportunity} /></div>
  </div>
}

export function StudiosPage() {
  return <div className="standard-page"><div className="page-intro"><div><h2>Demand against capacity</h2><p>Know which Studios have coverage and which need focused enterprise campaigns.</p></div><button className="secondary">30 / 60 / 90 days⌄</button></div>
    <section className="studio-map-grid">{initialStudios.map((studio) => <article key={studio.id}><header><div><span>{studio.corridor}</span><h3>{studio.name}</h3></div><strong className={studio.coverage < 75 ? 'warning-text' : ''}>{studio.coverage}%</strong></header><div className="large-coverage"><i style={{ width: `${studio.coverage}%` }} /></div><div className="studio-stats"><span><small>Capacity</small><b>{studio.capacity}</b></span><span><small>Live</small><b>{studio.live}</b></span><span><small>Contracted</small><b>{studio.contracted}</b></span><span><small>Gap</small><b className="danger">{studio.gap}</b></span></div><footer><button>Open demand plan →</button></footer></article>)}</section>
    <section className="content-section studio-detail"><SectionHeader title="Coverage detail" /><StudioCoverage /></section>
  </div>
}

export function ActivationsPage({ cohorts, recordActivation, opportunities, openOpportunity }) {
  return <div className="standard-page"><div className="page-intro"><div><h2>Contracted demand becoming live</h2><p>Track every cohort from Studio allocation through confirmed member activation.</p></div><button className="secondary">＋ Plan cohort</button></div>
    <div className="activation-list">{cohorts.map((cohort) => { const opportunity = opportunities.find((item) => item.account === cohort.account); const progress = Math.round(cohort.live / cohort.planned * 100); return <article key={cohort.id}><div className="activation-title"><div><Status>{cohort.status}</Status><h3>{cohort.account}</h3><p>{cohort.studio} · Arrival {cohort.arrival}</p></div><button className="text-action" onClick={() => opportunity && openOpportunity(opportunity.id)}>Open opportunity →</button></div><div className="activation-progress"><div><span style={{ width: `${progress}%` }} /></div><strong>{cohort.live}<small> / {cohort.planned} live</small></strong></div><footer><span>Mobilisation owner <b>{cohort.owner}</b></span><span>{cohort.planned - cohort.live} member gap</span>{cohort.status === 'Mobilising' && opportunity && <button className="secondary small" onClick={() => recordActivation(opportunity.id, Math.min(10, cohort.planned - cohort.live))}>＋ Record 10 live</button>}</footer></article>})}</div>
  </div>
}

export function InsightsPage({ report, reportHistory, saveReport, setGeneratedAction, opportunities, openOpportunity }) {
  const [studio, setStudio] = useState('All Studios')
  const [executive, setExecutive] = useState('All executives')
  const [view, setView] = useState('Readout')
  const scopesForExecutive = new Set(opportunities.filter((item) => executive === 'All executives' || item.owner === executive).map((item) => item.account))
  const visibleInsights = report.insights.filter((item) => (studio === 'All Studios' || item.studio === studio) && (executive === 'All executives' || item.scope === executive || scopesForExecutive.has(item.scope)))
  const visibleActions = report.actions.filter((item) => (executive === 'All executives' || item.owner === executive) && (studio === 'All Studios' || report.insights.find((insight) => insight.id === item.id)?.studio === studio || item.scope === studio))
  const openActions = visibleActions.filter((item) => item.status !== 'Done')
  const conversions = [
    ['Targeted → engaged', report.metrics.engagementRate],
    ['Engaged → qualified', report.metrics.qualificationRate],
    ['Contracted → live', report.metrics.contractToLiveRate],
    ['Campaign → live', report.metrics.campaignToLiveRate],
  ]

  const download = () => {
    const blob = new Blob([reportToMarkdown(report)], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `nia-demand-report-${report.asOf}.md`
    document.body.appendChild(anchor)
    anchor.click()
    anchor.remove()
    window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  return <div className="standard-page insights-page">
    <div className="page-intro report-intro"><div><h2>Insights and management report</h2><p>Computed from the current funnel. Findings show evidence separately from unresolved causes.</p></div><div className="toolbar"><select value={studio} onChange={(event) => setStudio(event.target.value)}><option>All Studios</option>{initialStudios.map((item) => <option key={item.id}>{item.name}</option>)}</select><select value={executive} onChange={(event) => setExecutive(event.target.value)}><option>All executives</option>{executives.map((item) => <option key={item.id}>{item.name}</option>)}</select><button className="secondary" onClick={download}>Export report</button><button className="primary" onClick={saveReport}>Generate snapshot</button></div></div>

    <section className="report-banner"><div><span>Executive readout</span><h3>{report.headline}</h3><p>{report.implication}</p></div><dl><div><dt>Period</dt><dd>{report.period}</dd></div><div><dt>As of</dt><dd>{report.asOf}</dd></div><div><dt>Source</dt><dd>Illustrative workspace</dd></div></dl></section>

    <section className="report-kpis"><div><span>Targeted</span><strong>{report.metrics.targeted.toLocaleString()}</strong><small>campaign contacts</small></div><div><span>Qualified</span><strong>{report.metrics.qualified}</strong><small>{report.metrics.qualificationRate}% of engaged</small></div><div><span>Contracted</span><strong>{report.metrics.contracted}</strong><small>contracted-or-later stages</small></div><div><span>Live</span><strong>{report.metrics.live}</strong><small>{report.metrics.contractToLiveRate}% of contracted</small></div><div><span>Activation gap</span><strong className={report.metrics.activationGap ? 'danger' : ''}>{report.metrics.activationGap}</strong><small>contracted less live</small></div></section>

    <div className="report-tabs" role="tablist">{['Readout', `Actions ${openActions.length}`, 'Definitions'].map((item) => { const key = item.split(' ')[0]; return <button role="tab" aria-selected={view === key} className={view === key ? 'active' : ''} onClick={() => setView(key)} key={item}>{item}</button> })}</div>

    {view === 'Readout' && <>
      <div className="report-grid">
        <section className="panel report-findings"><SectionHeader title="Evidence-backed findings">{visibleInsights.length} signals generated by explicit rules.</SectionHeader>{visibleInsights.length ? <div className="finding-list">{visibleInsights.map((item) => { const opportunity = opportunities.find((opportunity) => opportunity.account === item.scope); return <details key={item.id}><summary><div><Status>{item.priority}</Status><span>{item.category} · {item.scope}</span><strong>{item.finding}</strong><small>{item.impact}</small></div><b>＋</b></summary><div className="finding-evidence"><div><h4>Evidence</h4><ul>{item.evidence.map((entry) => <li key={entry}>{entry}</li>)}</ul></div><div><h4>Cause status · {item.causeStatus}</h4><p>{item.cause}</p>{opportunity && <button className="text-action" onClick={() => openOpportunity(opportunity.id)}>Open source record →</button>}</div></div></details>})}</div> : <div className="empty-state"><h3>No signals in this view</h3><p>Change the Studio or executive filter.</p></div>}</section>
        <aside className="panel conversion-panel"><SectionHeader title="Conversion readout" /><div className="conversion-list">{conversions.map(([label, value]) => <div key={label}><span>{label}</span><div><i style={{ width: `${Math.min(100, value)}%` }} /></div><strong>{value}%</strong></div>)}</div><div className="data-caveat"><strong>Comparison basis</strong><p>Current-period targets and prior-period actuals are not connected. The engine reports actual conversion without assigning an on-track status.</p></div></aside>
      </div>
      <section className="panel preview-actions"><SectionHeader title="Actions requiring review" action="Open action register" onAction={() => setView('Actions')} /><ActionTable actions={openActions.slice(0, 5)} setGeneratedAction={setGeneratedAction} /></section>
    </>}

    {view === 'Actions' && <section className="panel action-register"><SectionHeader title="Generated action register">Each action has an owner, due date and proof of closure.</SectionHeader><ActionTable actions={visibleActions} setGeneratedAction={setGeneratedAction} /></section>}

    {view === 'Definitions' && <div className="definitions-grid"><section className="panel"><SectionHeader title="Metric contract" /><table className="data-table"><thead><tr><th>Metric</th><th>Formula</th><th>Source</th></tr></thead><tbody>{report.definitions.map((item) => <tr key={item.metric}><td><strong>{item.metric}</strong></td><td>{item.formula}</td><td>{item.source}</td></tr>)}</tbody></table></section><section className="panel"><SectionHeader title="Report history" />{reportHistory.length ? <div className="report-history">{reportHistory.map((item) => <article key={item.id}><strong>{new Date(item.generatedAt).toLocaleString()}</strong><span>{item.metrics.live} live · {item.openActions} open actions</span><small>{item.headline}</small></article>)}</div> : <div className="empty-state"><h3>No saved snapshots</h3><p>Generate a snapshot to preserve the current report state.</p></div>}</section></div>}
  </div>
}

function ActionTable({ actions, setGeneratedAction }) {
  return <div className="table-scroll"><table className="data-table action-table"><thead><tr><th>Status</th><th>Priority</th><th>Action</th><th>Scope</th><th>Owner</th><th>Due</th><th>Proof required</th></tr></thead><tbody>{actions.map((item) => <tr key={item.id} className={item.status === 'Done' ? 'action-done' : ''}><td><button className="action-check" aria-label={`${item.status === 'Done' ? 'Reopen' : 'Complete'} ${item.title}`} onClick={() => setGeneratedAction(item.id, item.status === 'Done' ? 'Open' : 'Done')}>{item.status === 'Done' ? '✓ Done' : '○ Open'}</button></td><td><Status>{item.priority}</Status></td><td><strong>{item.title}</strong><small>{item.nextStep}</small></td><td>{item.scope}</td><td>{item.owner}</td><td className="mono">{item.dueDate}</td><td>{item.proof}</td></tr>)}</tbody></table>{!actions.length && <div className="empty-state"><h3>No generated actions</h3><p>No current signal requires an action in this view.</p></div>}</div>
}
