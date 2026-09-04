import { useState } from 'react'
import { stageOrder } from './data'

const iconPaths = {
  overview: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10.5V21h14V10.5M9 21v-6h6v6"/>',
  campaigns: '<path d="m3 11 14-5v12L3 13v-2Z"/><path d="M7 14v4a2 2 0 0 0 2 2h1"/><path d="M19 8v8"/>',
  accounts: '<rect x="4" y="3" width="16" height="18" rx="1"/><path d="M8 7h2M14 7h2M8 11h2M14 11h2M8 15h2M14 15h2M10 21v-3h4v3"/>',
  pipeline: '<path d="M3 4h18l-7 8v6l-4 2v-8L3 4Z"/>',
  resources: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  studios: '<path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2"/>',
  activations: '<path d="m13 2-9 12h7l-1 8 10-13h-7l0-7Z"/>',
  insights: '<path d="M5 21V10M12 21V3M19 21v-7"/>',
}

function Icon({ name, size = 20 }) {
  return <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: iconPaths[name] || iconPaths.overview }} />
}

export function Sidebar({ items, active, onSelect }) {
  const groups = [
    ['Overview', items.filter(([id]) => id === 'overview')],
    ['Demand', items.filter(([id]) => ['campaigns', 'accounts', 'pipeline', 'resources'].includes(id))],
    ['Delivery', items.filter(([id]) => ['studios', 'activations', 'insights'].includes(id))],
  ]
  return (
    <aside className="sidebar" aria-label="Dogra navigation">
      <nav className="product-navigation">
        {groups.map(([title, groupItems]) => <div className="nav-group" key={title}><p>{title}</p>{groupItems.map(([id, label]) => (
          <button key={id} className={active === id ? 'active' : ''} onClick={() => onSelect(id)} aria-label={label} aria-current={active === id ? 'page' : undefined}>
            <Icon name={id} size={17} /> <span>{label}</span>
          </button>
        ))}</div>)}
      </nav>
      <div className="para-family" aria-label="2 Para Ops products">
        <p>2 Para · Ops</p>
        <a className="para-product" href="/ops.html"><span>Sikh</span><small>Operations</small></a>
        <a className="para-product" href="/bison.html"><span>Jat</span><small>Living</small></a>
        <div className="para-product active"><span>Dogra</span><small>Enterprise demand</small></div>
        <a className="para-product" href="https://para-2-madras.vercel.app"><span>Assam Rifles</span><small>Member acquisition</small></a>
        <a className="para-product" href="/desk.html"><span>2 Para</span><small>All products</small></a>
      </div>
      <div className="profile"><span>Sep MTD · illustrative</span><small>Updated just now</small><a className="photo-credit" href="https://commons.wikimedia.org/wiki/File:Longewala_Post.jpg" target="_blank" rel="noreferrer">Longewala Post image · CC BY-SA 4.0</a></div>
    </aside>
  )
}

export function Header({ title, query, onQuery, onNew }) {
  return (
    <header className="topbar">
      <div className="suite-mark">
        <img src="/assets/nia-logo.png" alt="Nia" />
        <div className="topbar-brand"><span>2 Para · Ops</span><strong>Dogra</strong></div>
      </div>
      <div className="current-view"><span>Current view</span><strong>{title}</strong></div>
      <div className="header-actions">
        <button className="date-control">Sep MTD <span>⌄</span></button>
        <button className="date-control">All Studios <span>⌄</span></button>
        <label className="search"><span>⌕</span><input value={query} onChange={(event) => onQuery(event.target.value)} placeholder="Search…" /></label>
        <button className="primary" onClick={onNew}>＋ New campaign</button>
      </div>
    </header>
  )
}

export function Status({ children, tone }) {
  return <span className={`status ${tone || children.toLowerCase().replaceAll(' ', '-')}`}>{children}</span>
}

export function OpportunityTable({ opportunities, openOpportunity, compact = false }) {
  return (
    <div className="table-scroll">
      <table className="data-table opportunity-table">
        <thead><tr><th>Account</th><th>Studio</th><th>Stage</th><th>Demand</th><th>Days in stage</th><th>Next action</th><th>Owner</th></tr></thead>
        <tbody>
          {opportunities.map((item) => (
            <tr key={item.id} onClick={() => openOpportunity(item.id)}>
              <td><span className="risk-dot" />{item.account}</td>
              <td>{item.studio}</td>
              <td><Status>{item.stage}</Status></td>
              <td className="mono">{item.committed}</td>
              <td className={item.days > 15 ? 'danger mono' : 'mono'}>{item.days}</td>
              <td><strong>{item.nextAction}</strong><small>by {item.due}</small></td>
              <td><span className="owner-dot">{item.owner.split(' ').map((part) => part[0]).join('')}</span>{compact ? item.owner.split(' ')[0] : item.owner}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function OpportunityDrawer({ opportunity, onClose, onComplete, onAdvance, onRecord }) {
  const [activation, setActivation] = useState(10)
  const stages = ['Campaign', 'Qualified', 'Contracted', 'Allocated', 'Mobilising', 'Live']
  const activeIndex = opportunity.stage === 'Live' ? 5 : opportunity.stage === 'Mobilisation' ? 4 : opportunity.stage === 'Studio allocated' ? 3 : opportunity.stage === 'Contracted' ? 2 : opportunity.stage === 'Demand diagnosed' || opportunity.stage === 'Solution fit' || opportunity.stage === 'Proposal' || opportunity.stage === 'Commercial' ? 1 : 0
  return (
    <aside className="drawer" aria-label={`${opportunity.account} opportunity details`}>
      <div className="drawer-head">
        <div><h2>{opportunity.account} · {opportunity.studio}</h2><Status>{opportunity.stage}</Status></div>
        <button className="icon-button" onClick={onClose} aria-label="Close opportunity">×</button>
      </div>
      <p className="campaign-link">Campaign: <button>{opportunity.campaign}</button></p>
      <div className="drawer-metrics">
        <div><span>Committed</span><strong>{opportunity.committed}</strong></div>
        <div><span>Live</span><strong>{opportunity.live}</strong></div>
        <div><span>Gap</span><strong className="danger">{opportunity.committed - opportunity.live}</strong></div>
      </div>

      <section className="drawer-section lifecycle-section">
        <h3>Lifecycle</h3>
        <div className="lifecycle">
          {stages.map((stage, index) => <div key={stage} className={index <= activeIndex ? 'done' : ''}><span /><small>{stage}</small></div>)}
        </div>
      </section>

      <section className="next-action-box">
        <div><span>Next action</span><strong>{opportunity.nextAction}</strong><small>Due {opportunity.due}</small></div>
        <button className="secondary" onClick={onComplete}>Mark complete</button>
      </section>

      {opportunity.stage === 'Mobilisation' && opportunity.live < opportunity.committed && (
        <section className="activation-entry">
          <label>Record confirmed live</label>
          <div><input type="number" min="1" max={opportunity.committed - opportunity.live} value={activation} onChange={(event) => setActivation(Number(event.target.value))} /><button className="primary" onClick={() => onRecord(Math.max(1, activation))}>Record</button></div>
        </section>
      )}

      <section className="drawer-section details-grid">
        <h3>About this opportunity</h3>
        <dl>
          <div><dt>Studio</dt><dd>{opportunity.studio}</dd></div>
          <div><dt>Account owner</dt><dd>{opportunity.owner}</dd></div>
          <div><dt>Worker profile</dt><dd>{opportunity.qualified.profile}</dd></div>
          <div><dt>Required date</dt><dd>{opportunity.qualified.requiredDate}</dd></div>
          <div><dt>Decision-maker</dt><dd>{opportunity.qualified.decisionMaker}</dd></div>
          <div><dt>Potential value</dt><dd>₹{opportunity.value.toLocaleString('en-IN')}</dd></div>
        </dl>
        {opportunity.stage !== 'Live' && opportunity.stage !== 'Mobilisation' && <button className="wide-button" onClick={onAdvance}>Advance to next stage →</button>}
      </section>

      <section className="drawer-section timeline-section">
        <h3>Evidence & activity</h3>
        <div className="timeline">
          {opportunity.events.map(([title, time, body], index) => (
            <article key={`${title}-${index}`}><span /><div><strong>{title}</strong><time>{time}</time><small>{body}</small></div></article>
          ))}
        </div>
      </section>
    </aside>
  )
}

export function NewCampaignModal({ onClose, onCreate }) {
  const [form, setForm] = useState({ name: '', studio: 'Hosur', audience: '', contacts: 250, launchNow: false })
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const valid = form.name.trim() && form.audience.trim()
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <form className="modal" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); if (valid) onCreate(form) }}>
        <div className="modal-head"><div><h2>Create campaign</h2><p>Build demand for a specific Studio and audience.</p></div><button type="button" className="icon-button" onClick={onClose}>×</button></div>
        <label>Campaign name<input autoFocus value={form.name} onChange={(event) => update('name', event.target.value)} placeholder="e.g. Hosur auto component leaders" /></label>
        <div className="form-row">
          <label>Target Studio<select value={form.studio} onChange={(event) => update('studio', event.target.value)}><option>Hosur</option><option>Oragadam</option><option>Pune</option><option>NCR</option></select></label>
          <label>Initial contacts<input type="number" min="0" value={form.contacts} onChange={(event) => update('contacts', event.target.value)} /></label>
        </div>
        <label>Audience<input value={form.audience} onChange={(event) => update('audience', event.target.value)} placeholder="Industry and decision-maker persona" /></label>
        <label className="check-row"><input type="checkbox" checked={form.launchNow} onChange={(event) => update('launchNow', event.target.checked)} /><span><strong>Launch immediately</strong><small>Contacts enter the campaign as soon as it is created.</small></span></label>
        <div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button className="primary" disabled={!valid}>{form.launchNow ? 'Launch campaign' : 'Save draft'}</button></div>
      </form>
    </div>
  )
}
